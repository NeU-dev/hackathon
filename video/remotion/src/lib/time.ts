// 時間のヘルパー。ナレーションは絶対時刻（秒）で置いているので、
// 各シーンも「動画の頭からの秒」で考える。
import { Easing, spring } from "remotion";
import data from "../data/captions.json";

export const FPS = 30;
export const TOTAL_SECONDS = 180;

export type Caption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
  pageBreakAfter?: boolean;
};
export type Line = {
  id: string;
  sec: string;
  start: number;
  end: number;
  text: string;
  chars: [number, number][];
  pages: { from: number; to: number; text: string }[];
  tokens: Caption[];
};

export const LINES = data.lines as unknown as Line[];
const BY_ID: Record<string, Line> = Object.fromEntries(LINES.map((l) => [l.id, l]));

export const line = (id: string) => {
  const l = BY_ID[id];
  if (!l) throw new Error(`no line ${id}`);
  return l;
};
/** 文の開始・終了（秒） */
export const S = (id: string) => line(id).start;
export const En = (id: string) => line(id).end;
/** その文の中で、ある言葉が話し始められる時刻（音素の時刻から求めた正確な値） */
export const at = (id: string, phrase: string) => {
  const l = line(id);
  const i = l.text.indexOf(phrase);
  if (i < 0) throw new Error(`phrase not found: ${id} ${phrase}`);
  return l.chars[i][0];
};
/** その言葉を言い終える時刻 */
export const atEnd = (id: string, phrase: string) => {
  const l = line(id);
  const i = l.text.indexOf(phrase);
  if (i < 0) throw new Error(`phrase not found: ${id} ${phrase}`);
  return l.chars[i + phrase.length - 1][1];
};

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

// イージング（Remotion の Easing.bezier を使う）
export const EASE = {
  lin: (p: number) => p,
  out: Easing.bezier(0.16, 1, 0.3, 1),    // すっと入って、やわらかく止まる
  io: Easing.bezier(0.65, 0, 0.35, 1),    // 動き出しと止まりがなめらか
  soft: Easing.bezier(0.33, 1, 0.68, 1),
};
/** t が a→b を進む割合（0〜1） */
export const P = (t: number, a: number, b: number, e: (p: number) => number = EASE.io) =>
  e(clamp((t - a) / (b - a)));
/** a〜b のあいだ 1、前後 f 秒でフェード */
export const win = (t: number, a: number, b: number, f = 0.3) =>
  Math.min(P(t, a, a + f, EASE.lin), 1 - P(t, b - f, b, EASE.lin));
/** バネで「ぽん」と出る（少し行き過ぎて戻る）。0 → 1 */
export const pop = (t: number, a: number, damping = 12) =>
  t < a ? 0 : spring({ frame: (t - a) * FPS, fps: FPS, config: { damping, mass: 0.55, stiffness: 170 } });
/** バネで行き過ぎずに収まる。0 → 1 */
export const settle = (t: number, a: number, durationSec = 0.6) =>
  t < a ? 0 : spring({ frame: (t - a) * FPS, fps: FPS, config: { damping: 200 }, durationInFrames: durationSec * FPS });
export const fadeUp = (t: number, a: number, d = 0.45, dy = 18) => {
  const p = P(t, a, a + d, EASE.out);
  return { opacity: p, translate: `0px ${(dy * (1 - p)).toFixed(2)}px` };
};
export const mix = (a: string, b: string, p: number) => {
  const pa = a.replace("#", "").match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const pb = b.replace("#", "").match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], clamp(p)))).join(",")})`;
};
/** キーフレーム [秒, x, y, 倍率] をなめらかにつなぐ（倍率は対数で補間） */
export const camAt = (keys: [number, number, number, number][], t: number) => {
  let k = 0;
  while (k < keys.length - 2 && t > keys[k + 1][0]) k++;
  const a = keys[k], b = keys[k + 1];
  const p = P(t, a[0], b[0], EASE.io);
  return { x: lerp(a[1], b[1], p), y: lerp(a[2], b[2], p), s: Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), p)) };
};
/** 文字を少しずつ出す */
export const typed = (str: string, p: number) => str.slice(0, Math.round(str.length * clamp(p)));
