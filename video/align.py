# -*- coding: utf-8 -*-
"""ナレーションの文字ごとの時刻を求める（tts.py のあとに実行）。

Open JTalk が出す音素ラベルの時刻（build/tts/<id>.trace）から、
モーラ → 形態素 → 読み上げ文の文字 → 字幕の文字、の順に時刻を対応づける。

出力: build/captions.json
  lines[].chars  字幕の文字ごとの [開始秒, 終了秒]
  lines[].tokens @remotion/captions の Caption 形式（形態素ごと）
  lines[].pages  字幕の1枚ごとの文字範囲
"""
import difflib
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from narration import LINES  # noqa: E402

BUILD = os.path.join(HERE, "build")
TTS_DIR = os.path.join(BUILD, "tts")
DIC = "/var/lib/mecab/dic/open-jtalk/naist-jdic"
VOICE = os.path.join(HERE, "assets", "voices", "tohoku-f01-neutral.htsvoice")
VOWELS = set("aiueoAIUEO")


def parse_trace(path):
    """trace から形態素（表層, モーラ数）と音素（開始, 終了, 音素）を読む。"""
    morphs, phones, mode = [], [], None
    for raw in open(path, encoding="utf-8"):
        line = raw.rstrip("\n")
        if line.startswith("[Text analysis result]"):
            mode = "text"; continue
        if line.startswith("[Output label]"):
            mode = "label"; continue
        if line.startswith("["):
            mode = None; continue
        if mode == "text" and line.strip():
            f = line.split(",")
            if len(f) >= 11 and "/" in f[10]:
                morphs.append((f[0], int(f[10].split("/")[1])))
        elif mode == "label" and line.strip():
            a, b, lab = line.split(" ", 2)
            ph = lab.split("-", 1)[1].split("+", 1)[0]
            phones.append((int(a) / 1e7, int(b) / 1e7, ph))
    return morphs, phones


def morae_of(phones):
    """音素列をモーラ（開始, 終了）に区切る。母音・撥音(N)・促音(cl)でモーラが終わる。"""
    out, start = [], None
    for a, b, ph in phones:
        if ph in ("sil", "pau"):
            start = None
            continue
        if start is None:
            start = a
        if ph in VOWELS or ph in ("N", "cl"):
            out.append((start, b))
            start = None
    return out


def char_times_for_tts(text, morphs, morae):
    """読み上げ文の文字ごとの時刻。"""
    total = sum(m for _, m in morphs)
    spans, k = [], 0
    if total == len(morae) and total > 0:
        for surf, m in morphs:
            if m == 0:
                t = morae[k - 1][1] if k > 0 else morae[0][0]
                spans.append((surf, t, t))
            else:
                spans.append((surf, morae[k][0], morae[k + m - 1][1]))
                k += m
    else:   # 数が合わないときは、モーラ数の比で全体に割り振る
        t0, t1 = morae[0][0], morae[-1][1]
        acc = 0
        for surf, m in morphs:
            a = t0 + (t1 - t0) * acc / max(1, total)
            acc += m
            b = t0 + (t1 - t0) * acc / max(1, total)
            spans.append((surf, a, b))
        print("  モーラ数が合わない:", text, total, len(morae))
    # 形態素の表層をつないだ文字列と、入力文字列を対応づける
    surf_chars, surf_times = [], []
    for surf, a, b in spans:
        n = len(surf)
        for i, ch in enumerate(surf):
            surf_chars.append(ch)
            surf_times.append((a + (b - a) * i / n, a + (b - a) * (i + 1) / n))
    return map_chars(text, "".join(surf_chars), surf_times)


def map_chars(dst, src, src_times):
    """src の文字の時刻を、dst の文字へ写す（似た所は対応づけ、違う所は比例で割る）。"""
    out = [None] * len(dst)
    sm = difflib.SequenceMatcher(a=src, b=dst, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for d in range(j2 - j1):
                out[j1 + d] = src_times[i1 + d]
        elif tag == "replace":
            a = src_times[i1][0]
            b = src_times[i2 - 1][1]
            n = j2 - j1
            for d in range(n):
                out[j1 + d] = (a + (b - a) * d / n, a + (b - a) * (d + 1) / n)
    # 対応のない文字（「」など）は前後の文字に寄せる
    last = None
    for i in range(len(out)):
        if out[i] is None:
            nxt = next((out[j] for j in range(i + 1, len(out)) if out[j] is not None), None)
            t = last[1] if last else (nxt[0] if nxt else 0.0)
            out[i] = (t, t)
        last = out[i]
    return out


def morphs_of(text):
    """字幕の文を形態素に分ける（字幕のトークン用）。"""
    tmp_txt = os.path.join(TTS_DIR, "_tok.txt")
    tmp_tr = os.path.join(TTS_DIR, "_tok.trace")
    with open(tmp_txt, "w", encoding="utf-8") as f:
        f.write(text)
    subprocess.run(["open_jtalk", "-x", DIC, "-m", VOICE, "-ow", "/dev/null", "-ot", tmp_tr, tmp_txt], check=True)
    morphs, _ = parse_trace(tmp_tr)
    # 表層を字幕の文字位置に対応づける
    surf = "".join(s for s, _ in morphs)
    idx = list(range(len(surf)))
    pos = map_chars(text, surf, [(i, i + 1) for i in idx])
    owner = [int(p[0]) if p[1] > p[0] else -1 for p in pos]
    bounds, k = [], 0
    for s, _ in morphs:
        bounds.append((k, k + len(s)))
        k += len(s)
    tokens, cur, cur_m = [], [], None
    for ci, o in enumerate(owner):
        m = next((mi for mi, (a, b) in enumerate(bounds) if a <= o < b), cur_m) if o >= 0 else cur_m
        if m != cur_m and cur:
            tokens.append(cur)
            cur = []
        cur.append(ci)
        cur_m = m
    if cur:
        tokens.append(cur)
    return tokens


def main():
    tl = json.load(open(os.path.join(BUILD, "timeline.json"), encoding="utf-8"))
    by_id = {ln["id"]: ln for ln in LINES}
    out = []
    for item in tl["lines"]:
        ln = by_id[item["id"]]
        text = ln["text"]
        if "silent" in ln:
            chars = [(item["start"], item["end"])] * len(text)
        else:
            meta = json.load(open(os.path.join(TTS_DIR, item["id"] + ".meta.json")))
            morphs, phones = parse_trace(os.path.join(TTS_DIR, item["id"] + ".trace"))
            morae = [(a - meta["lead"] + item["start"], b - meta["lead"] + item["start"]) for a, b in morae_of(phones)]
            tts_text = ln.get("tts", text)
            tts_times = char_times_for_tts(tts_text, morphs, morae)
            chars = map_chars(text, tts_text, tts_times)
        chars = [(round(a, 3), round(b, 3)) for a, b in chars]
        # 字幕の1枚ごと
        pages, k = [], 0
        for sub in ln.get("subs") or [text]:
            pages.append({"from": k, "to": k + len(sub), "text": sub})
            k += len(sub)
        # Caption 形式のトークン（形態素ごと。字幕の1枚の終わりで改ページ）
        tokens = []
        page_ends = {p["to"] for p in pages}
        for tok in morphs_of(text):
            a, b = chars[tok[0]][0], chars[tok[-1]][1]
            tokens.append({
                "text": "".join(text[i] for i in tok),
                "startMs": round(a * 1000), "endMs": round(max(a, b) * 1000),
                "timestampMs": round((a + b) / 2 * 1000), "confidence": None,
                "pageBreakAfter": (tok[-1] + 1) in page_ends,
            })
        out.append({"id": item["id"], "sec": item["sec"], "start": item["start"], "end": item["end"],
                    "text": text, "chars": chars, "pages": pages, "tokens": tokens})
    with open(os.path.join(BUILD, "captions.json"), "w", encoding="utf-8") as f:
        json.dump({"sections": tl["sections"], "lines": out}, f, ensure_ascii=False, indent=1)
    print("ok", len(out), "lines")


if __name__ == "__main__":
    main()
