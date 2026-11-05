# -*- coding: utf-8 -*-
"""ナレーションを Open JTalk で合成し、台本の時間枠に収めて並べる。

出力:
  build/tts/<id>.wav     文ごとの音声
  build/narration.wav    3分ぶんに並べた音声
  build/timeline.json    文ごとの開始・終了（画面と字幕が使う）
  build/timeline.js      同じ内容を HTML から読めるようにしたもの
  build/subtitles.srt    字幕ファイル（編集ソフト用）
"""
import array
import json
import os
import subprocess
import sys
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from narration import LINES, SECTIONS  # noqa: E402

BUILD = os.path.join(HERE, "build")
TTS_DIR = os.path.join(BUILD, "tts")
DIC = "/var/lib/mecab/dic/open-jtalk/naist-jdic"
VOICE = os.environ.get(
    "VOICE",
    os.path.join(HERE, "assets", "voices", "tohoku-f01-neutral.htsvoice"),
)
SR = 48000
TOTAL = 180.0
GAP = 0.32          # 文と文のあいだの既定値（秒）
TAIL = 0.35         # パートの終わりに残す余白（秒）
BASE_RATE = 1.08
MAX_RATE = 1.25


def synth(line, rate):
    os.makedirs(TTS_DIR, exist_ok=True)
    txt = os.path.join(TTS_DIR, line["id"] + ".txt")
    wav = os.path.join(TTS_DIR, line["id"] + ".wav")
    if "silent" in line:   # 【アプリ名】のように、まだ読めない所は無音で長さだけ取る
        with wave.open(wav, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(b"\0\0" * int(line["silent"] * SR))
        return line["silent"]
    with open(txt, "w", encoding="utf-8") as f:
        f.write(line.get("tts", line["text"]))
    subprocess.run(
        ["open_jtalk", "-x", DIC, "-m", VOICE, "-r", f"{rate:.3f}",
         "-fm", "0.6", "-ow", wav, txt],
        check=True,
    )
    return trim(wav)


def read_wav(path):
    with wave.open(path, "rb") as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2, path
        sr = w.getframerate()
        data = array.array("h", w.readframes(w.getnframes()))
    return sr, data


def trim(path, thresh=400, pad=0.04):
    """前後の無音を切る。"""
    sr, d = read_wav(path)
    assert sr == SR, (path, sr)
    i, j = 0, len(d) - 1
    while i < len(d) and abs(d[i]) < thresh:
        i += 1
    while j > i and abs(d[j]) < thresh:
        j -= 1
    p = int(pad * sr)
    d = d[max(0, i - p): min(len(d), j + p)]
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(d.tobytes())
    return len(d) / sr


def main():
    by_sec = {}
    for ln in LINES:
        by_sec.setdefault(ln["sec"], []).append(ln)

    timeline = []
    report = []
    for sid, s0, s1, label in SECTIONS:
        lines = by_sec.get(sid, [])
        if not lines:
            continue
        rate = BASE_RATE
        for _ in range(6):
            durs = [synth(ln, rate) for ln in lines]
            need = lines[0].get("lead", 0.4)
            for k, (ln, d) in enumerate(zip(lines, durs)):
                if k:
                    need += ln.get("gap", GAP)
                need += d + ln.get("hold", 0.0)
            need += TAIL
            slot = s1 - s0
            if need <= slot or rate >= MAX_RATE:
                break
            speech = sum(durs)
            fixed = need - speech
            # 話す部分だけ縮める（速さは時間にほぼ反比例）
            rate = min(MAX_RATE, rate * speech / max(0.1, slot - fixed) * 1.01)
        t = s0 + lines[0].get("lead", 0.4)
        for k, (ln, d) in enumerate(zip(lines, durs)):
            if k:
                t += ln.get("gap", GAP)
            subs = ln.get("subs") or [ln["text"]]
            # 字幕は文字数の比で時間を分ける
            total_chars = sum(len(x) for x in subs)
            cues, u = [], t
            for x in subs:
                du = d * len(x) / total_chars
                cues.append(dict(start=round(u, 3), end=round(u + du, 3), text=x))
                u += du
            timeline.append(dict(id=ln["id"], sec=sid, start=round(t, 3),
                                 end=round(t + d, 3), text=ln["text"], subs=cues))
            t += d + ln.get("hold", 0.0)
        over = t + TAIL - s1
        report.append((sid, label, s0, s1, round(t, 2), round(rate, 3), round(over, 2)))

    # 枠からはみ出したパートがあれば、そのぶん後ろへずらさず報告だけする
    print("part            slot          ends   rate  over")
    for sid, label, s0, s1, end, rate, over in report:
        flag = "  <-- はみ出し" if over > 0 else ""
        print(f"{label:<16}{s0:6.1f}-{s1:6.1f}  {end:6.2f}  {rate:5.3f} {over:+5.2f}{flag}")

    # 1本の音声に並べる
    out = array.array("h", [0]) * int(TOTAL * SR)
    for item in timeline:
        _, d = read_wav(os.path.join(TTS_DIR, item["id"] + ".wav"))
        off = int(item["start"] * SR)
        for i, v in enumerate(d):
            if off + i < len(out):
                out[off + i] = v
    with wave.open(os.path.join(BUILD, "narration.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(out.tobytes())

    data = dict(sections=[dict(id=a, start=b, end=c, label=d) for a, b, c, d in SECTIONS],
                lines=timeline)
    with open(os.path.join(BUILD, "timeline.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    with open(os.path.join(BUILD, "timeline.js"), "w", encoding="utf-8") as f:
        f.write("window.TIMELINE = " + json.dumps(data, ensure_ascii=False) + ";\n")

    def ts(x):
        h, r = divmod(x, 3600)
        m, s = divmod(r, 60)
        return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s % 1) * 1000)):03d}"

    with open(os.path.join(BUILD, "subtitles.srt"), "w", encoding="utf-8") as f:
        n = 1
        for item in timeline:
            for c in item["subs"]:
                f.write(f"{n}\n{ts(c['start'])} --> {ts(c['end'] + 0.25)}\n{c['text']}\n\n")
                n += 1


if __name__ == "__main__":
    main()
