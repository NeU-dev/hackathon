# -*- coding: utf-8 -*-
"""仮の BGM を合成する（素材を持ち込めないため）。

remotion/public/bgm/pad.wav … やわらかい和音（全編）
remotion/public/bgm/arp.wav … オルゴール風の分散和音（④以降、場面に応じて Remotion 側で音量を変える）

F メジャー、76BPM。F(add9) → Am7 → Dm7 → B♭maj7 を2小節ずつ繰り返す。
"""
import os
import wave

import numpy as np

SR = 48000
DUR = 182.0
BPM = 76
BEAT = 60 / BPM
BAR = BEAT * 4
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "remotion", "public", "bgm")


def hz(n):  # MIDI → 周波数
    return 440.0 * 2 ** ((n - 69) / 12)


# コードの構成音（MIDI）
CHORDS = [
    [41, 53, 57, 60, 67],   # F2 F3 A3 C4 G4（F add9）
    [45, 52, 55, 60, 64],   # A2 E3 G3 C4 E4（Am7）
    [38, 53, 57, 60, 62],   # D2 F3 A3 C4 D4（Dm7）
    [46, 50, 53, 57, 62],   # B♭2 D3 F3 A3 D4（B♭maj7）
]
CHORD_LEN = BAR * 2


def reverb(x, seconds=2.6, mix=0.32, seed=1):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n))
    ir[: int(0.012 * SR)] = 0
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
        # 和音ごとの音量の形（ゆっくり立ち上がり、次の和音と重なって消える）
        env = np.clip((t - c0) / 1.6, 0, 1) * np.clip((c0 + CHORD_LEN + 1.8 - t) / 1.8, 0, 1)
        env = np.sin(env * np.pi / 2) ** 2
        idx = env > 0
        for j, m in enumerate(notes):
            f = hz(m)
            amp = 0.5 if j == 0 else 0.32
            for ch, det in ((0, -3.5), (1, 3.5)):   # 左右で少しずらして広がりを出す
                fd = f * 2 ** (det / 1200)
                ph = 2 * np.pi * fd * t[idx] + j
                s = np.sin(ph) + 0.12 * np.sin(2 * ph) + 0.04 * np.sin(3 * ph)
                trem = 1 + 0.06 * np.sin(2 * np.pi * 0.23 * t[idx] + j + ch)
                out[ch, idx] += amp * s * trem * env[idx]
        k += 1
    return out


def arp():
    n = int(DUR * SR)
    out = np.zeros((2, n))
    pattern = [0, 2, 3, 4, 3, 2, 1, 2]   # 和音の中の何番目の音を鳴らすか（8分音符）
    rng = np.random.default_rng(7)
    step = BEAT / 2
    i = 0
    while i * step < DUR:
        start = i * step
        chord = CHORDS[int(start // CHORD_LEN) % 4]
        m = chord[pattern[i % 8]] + 12
        f = hz(m)
        L = int(1.6 * SR)
        s0 = int(start * SR)
        if s0 + L > n:
            L = n - s0
        tt = np.arange(L) / SR
        vel = 0.55 + 0.15 * rng.random() - (0.15 if i % 2 else 0)
        tone = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 6)
                + 0.08 * np.sin(2 * np.pi * 3 * f * tt) * np.exp(-tt * 9))
        env = np.exp(-tt * 3.2) * np.clip(tt / 0.010, 0, 1)
        pan = 0.5 + 0.35 * np.sin(i * 0.9)
        out[0, s0: s0 + L] += vel * tone * env * (1 - pan) * 2
        out[1, s0: s0 + L] += vel * tone * env * pan * 2
        i += 1
    return out


def save(name, x, target_rms_db):
    x = np.stack([reverb(x[0], seed=1), reverb(x[1], seed=2)])
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
    save("pad.wav", pad(), -20)
    save("arp.wav", arp(), -22)
