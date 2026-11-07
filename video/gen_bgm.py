# -*- coding: utf-8 -*-
"""仮の BGM を合成する（素材を持ち込めないため）。

remotion/public/bgm/pad.wav  … やわらかい和音（全編）
remotion/public/bgm/arp.wav  … 明るい粒の分散和音（カリンバ風。場面に応じて Remotion 側で音量を変える）
remotion/public/bgm/perc.wav … 軽いリズム（やさしいキック・手拍子・シェイカー）

D メジャー、100BPM。D(add9) → A/C♯ → Bm7 → G(add9) を1小節ずつ繰り返す（前を向く進行）。
以前の版（F メジャー、76BPM、2小節ごとの和音、低い音域）は暗すぎたので、テンポ・音域・和音の動きを上げた。
"""
import os
import wave

import numpy as np

SR = 48000
DUR = 182.0
BPM = 100
BEAT = 60 / BPM
BAR = BEAT * 4
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "remotion", "public", "bgm")


def hz(n):  # MIDI → 周波数
    return 440.0 * 2 ** ((n - 69) / 12)


# コードの構成音（MIDI）。一番下がベース
CHORDS = [
    [50, 57, 62, 64, 66],   # D3 A3 D4 E4 F#4（D add9）
    [49, 57, 61, 64, 69],   # C#3 A3 C#4 E4 A4（A/C#）
    [47, 54, 57, 62, 66],   # B2 F#3 A3 D4 F#4（Bm7）
    [43, 55, 59, 62, 69],   # G2 G3 B3 D4 A4（G add9）
]
CHORD_LEN = BAR


def chord_at(sec):
    return CHORDS[int(sec // CHORD_LEN) % 4]


def reverb(x, seconds=1.8, mix=0.22, seed=1):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 8, n))
    ir[: int(0.010 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return (1 - mix) * x + mix * wet * 0.6


def pad():
    n = int(DUR * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    k = 0
    while k * CHORD_LEN < DUR:
        c0 = k * CHORD_LEN
        notes = CHORDS[k % 4]
        env = np.clip((t - c0) / 0.25, 0, 1) * np.clip((c0 + CHORD_LEN + 0.6 - t) / 0.6, 0, 1)
        env = np.sin(env * np.pi / 2) ** 2
        idx = env > 0
        for j, m in enumerate(notes):
            f = hz(m)
            amp = 0.34 if j == 0 else 0.26
            for ch, det in ((0, -4.0), (1, 4.0)):
                fd = f * 2 ** (det / 1200)
                ph = 2 * np.pi * fd * t[idx] + j
                s = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
                out[ch, idx] += amp * s * env[idx]
        k += 1
    return out


def pluck(f, L):
    tt = np.arange(L) / SR
    tone = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 9)
            + 0.18 * np.sin(2 * np.pi * 4.1 * f * tt) * np.exp(-tt * 22))
    env = np.exp(-tt * 5.0) * np.clip(tt / 0.004, 0, 1)
    return tone * env


def arp():
    n = int(DUR * SR)
    out = np.zeros((2, n))
    pattern = [1, 2, 3, 4, 3, 2, 4, 3]   # 8分音符で和音の上の方をたどる
    rng = np.random.default_rng(7)
    step = BEAT / 2
    L = int(0.9 * SR)
    i = 0
    while i * step < DUR:
        start = i * step
        chord = chord_at(start)
        m = chord[pattern[i % 8]] + 12
        s0 = int(start * SR)
        LL = min(L, n - s0)
        vel = 0.6 + 0.12 * rng.random() + (0.12 if i % 2 == 0 else -0.05)
        tone = pluck(hz(m), LL)
        pan = 0.5 + 0.3 * np.sin(i * 0.7)
        out[0, s0: s0 + LL] += vel * tone * (1 - pan) * 2
        out[1, s0: s0 + LL] += vel * tone * pan * 2
        # 2小節ごとの最後の拍に、16分音符できらっと上がる
        if i % 16 == 14:
            for q, dm in enumerate((12, 14, 16, 19)):
                s1 = s0 + int(q * BEAT / 4 * SR)
                L2 = min(int(0.5 * SR), n - s1)
                if L2 > 0:
                    out[:, s1: s1 + L2] += 0.32 * pluck(hz(chord[2] + dm), L2)
        i += 1
    return out


def perc():
    n = int(DUR * SR)
    out = np.zeros((2, n))
    rng = np.random.default_rng(3)
    beat = 0
    while beat * BEAT < DUR:
        s0 = int(beat * BEAT * SR)
        # やさしいキック（1拍目と3拍目）
        if beat % 2 == 0:
            L = min(int(0.28 * SR), n - s0)
            tt = np.arange(L) / SR
            f = 46 + 70 * np.exp(-tt * 30)
            k = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 14)
            out[:, s0: s0 + L] += 0.9 * k
        # 手拍子（2拍目と4拍目）：帯域を絞ったノイズを少しずらして重ねる
        if beat % 2 == 1:
            for d in (0.0, 0.009, 0.018):
                s1 = s0 + int(d * SR)
                L = min(int(0.12 * SR), n - s1)
                if L <= 0:
                    continue
                tt = np.arange(L) / SR
                noise = rng.standard_normal(L)
                bp = np.convolve(noise, np.sin(2 * np.pi * 1800 * np.arange(64) / SR) * np.hanning(64), mode="same")
                out[:, s1: s1 + L] += 0.10 * bp * np.exp(-tt * 38)
        # シェイカー（8分音符。裏拍を強く）
        for half in (0, 1):
            s1 = s0 + int(half * BEAT / 2 * SR)
            L = min(int(0.05 * SR), n - s1)
            if L <= 0:
                continue
            tt = np.arange(L) / SR
            noise = rng.standard_normal(L)
            hp = np.diff(noise, prepend=0)
            amp = 0.11 if half else 0.06
            pan = 0.62 if half else 0.42
            out[0, s1: s1 + L] += amp * hp * np.exp(-tt * 70) * (1 - pan) * 2
            out[1, s1: s1 + L] += amp * hp * np.exp(-tt * 70) * pan * 2
        beat += 1
    return out


def save(name, x, target_rms_db, mix=0.22):
    x = np.stack([reverb(x[0], seed=1, mix=mix), reverb(x[1], seed=2, mix=mix)])
    rms = np.sqrt(np.mean(x ** 2))
    x *= 10 ** (target_rms_db / 20) / rms
    peak = np.max(np.abs(x))
    if peak > 0.89:
        x *= 0.89 / peak
    fade = int(1.5 * SR)
    x[:, :fade] *= np.linspace(0, 1, fade)
    x[:, -fade:] *= np.linspace(1, 0, fade)
    os.makedirs(OUT, exist_ok=True)
    pcm = (np.clip(x.T, -1, 1) * 32767).astype("<i2")
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(name, "rms", round(20 * np.log10(np.sqrt(np.mean(x ** 2))), 1), "dB peak", round(20 * np.log10(np.max(np.abs(x))), 1), "dB")


if __name__ == "__main__":
    save("pad.wav", pad(), -23)
    save("arp.wav", arp(), -21)
    save("perc.wav", perc(), -25, mix=0.08)
