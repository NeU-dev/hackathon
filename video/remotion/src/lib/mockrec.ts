// 録画したモックの画面（public/mockrec/A|B のコマ）を、ナレーションの時刻に合わせて出す。
// 録画は video/mockrec/record_demo.cjs で撮り、prep.py で「そのコマで画面が動いたか」（act）を足してある。
// 対応表は [秒, コマ] の並びで書く。そのあいだは、動いているコマは等速で流し、止まっているコマで時間を合わせる
// （止まっている所を縮めても伸ばしても見た目は変わらないので、早送りに見えるのは本当に足りない所だけになる）。
import recA from "../data/mockrecA.json";
import recB from "../data/mockrecB.json";
import { FPS } from "./time";

export type Tap = { f: number; x: number; y: number; kind: "tap" | "swipe"; f1?: number; dy?: number };
export type Rec = {
  fps: number; w: number; screenH: number; kbH: number; frames: number;
  meta: string; act: string; marks: Record<string, number>; taps: Tap[]; keys: { f: number; ch: string }[];
};
export type Src = "A" | "B";
export const RECS: Record<Src, Rec> = { A: recA as unknown as Rec, B: recB as unknown as Rec };

/** 録画の幅（CSS px）→ スマホの画面（396px）の倍率 */
export const K = 396 / 390;

/** マークの名前（＋ずれ）でコマを指す */
export const mk = (s: Src, name: string, off = 0) => {
  const v = RECS[s].marks[name];
  if (v == null) throw new Error(`no mark ${s}.${name}`);
  return v + off;
};

type Seg = { t0: number; t1: number; f0: number; f1: number; cum: number[]; wa: number; moving: number };
export type Track = { src: Src; segs: Seg[] };

/** 対応表から、コマの流し方を決める */
export const track = (src: Src, keys: [number, number][]): Track => {
  const act = RECS[src].act;
  const moving = (i: number) => act[i + 1] === "1"; // i → i+1 で画面が変わる
  const segs: Seg[] = [];
  for (let k = 1; k < keys.length; k++) {
    const [t0, f0] = keys[k - 1];
    const [t1, f1] = keys[k];
    const n = f1 - f0;
    const D = (t1 - t0) * FPS; // 使える動画のコマ数
    if (n <= 0) {
      segs.push({ t0, t1, f0, f1: f0, cum: [0], wa: 1, moving: 0 });
      continue;
    }
    let A = 0;
    for (let i = f0; i < f1; i++) if (moving(i)) A++;
    const S = n - A;
    let wa: number;
    let ws: number;
    if (A === 0) {
      wa = 1;
      ws = D / n;
    } else if (D >= A) {
      // 動きは等速。止まっている所で余りを持つ（止まっている所がなければ、動きをゆっくりにする）
      if (S > 0) [wa, ws] = [1, (D - A) / S];
      else [wa, ws] = [D / A, 0];
    } else {
      // 足りない：止まっている所はほぼ飛ばし、動きを早送りにする
      ws = Math.min(0.1, D / n);
      wa = (D - S * ws) / A;
    }
    const cum = [0];
    for (let i = f0; i < f1; i++) cum.push(cum[cum.length - 1] + (moving(i) ? wa : ws));
    segs.push({ t0, t1, f0, f1, cum, wa, moving: A });
  }
  return { src, segs };
};

/** 時刻 t に映すコマ */
export const frameAt = (tr: Track, t: number) => {
  const { segs } = tr;
  if (t <= segs[0].t0) return segs[0].f0;
  for (const s of segs) {
    if (t >= s.t1) continue;
    if (s.f1 === s.f0) return s.f0;
    const u = (t - s.t0) * FPS;
    let lo = 0;
    let hi = s.cum.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (s.cum[m] <= u) lo = m;
      else hi = m;
    }
    return Math.min(s.f0 + lo, s.f1);
  }
  const last = segs[segs.length - 1];
  return last.f1;
};

/** 録画のコマ f が映り始める時刻（タップの印・キーボード・効果音に使う） */
export const timeOf = (tr: Track, f: number) => {
  for (const s of tr.segs) if (f >= s.f0 && f < s.f1) return s.t0 + s.cum[f - s.f0] / FPS;
  const last = tr.segs[tr.segs.length - 1];
  return f >= last.f1 ? last.t1 : tr.segs[0].t0;
};

/** 早送りになっている所（動きが 1.5 倍より速い所）の [始め, 終わり] */
export const ffSpans = (tr: Track): [number, number][] => {
  const out: [number, number][] = [];
  const act = RECS[tr.src].act;
  for (const s of tr.segs) {
    if (!s.moving || s.wa > 0.66) continue;
    let a = -1;
    let b = -1;
    for (let i = s.f0; i < s.f1; i++) {
      if (act[i + 1] !== "1") continue;
      if (a < 0) a = i;
      b = i + 1;
    }
    if (a >= 0) out.push([timeOf(tr, a), timeOf(tr, b)]);
  }
  return out;
};

/** キーボードが出ている区間（録画のコマ）[出た, しまった] */
export const kbSpans = (s: Src): [number, number][] => {
  const m = RECS[s].meta;
  const out: [number, number][] = [];
  let a = -1;
  for (let i = 0; i < m.length; i++) {
    if (m[i] === "1" && a < 0) a = i;
    if (m[i] !== "1" && a >= 0) {
      out.push([a, i]);
      a = -1;
    }
  }
  if (a >= 0) out.push([a, m.length]);
  return out;
};

export const pad5 = (f: number) => String(Math.max(0, Math.round(f))).padStart(5, "0");
