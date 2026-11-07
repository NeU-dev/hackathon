// スマホの画面まわり：録画のコマ・ステータスバー・日本語キーボード・指の跡・ロック画面・ホームバー
// 録画はアプリの画面だけ（ステータスバーの所はアプリが背景だけ描いている）。OS の部分はここで描く。
import React from "react";
import { Img, staticFile } from "remotion";
import { clamp, EASE, lerp, P, settle } from "../lib/time";
import { K, kbSpans, pad5, RECS, Src, timeOf, Track } from "../lib/mockrec";

export const SCR_W = 396;
export const SCR_H = 856;

/** 録画の 1 コマ */
export const MockFrame: React.FC<{ src: Src; f: number; style?: React.CSSProperties }> = ({ src, f, style }) => (
  <Img
    src={staticFile(`mockrec/${src}/m${pad5(Math.min(f, RECS[src].frames - 1))}.jpg`)}
    style={{ position: "absolute", left: 0, top: 0, width: SCR_W, height: SCR_H, ...style }}
  />
);

// ---- ステータスバー（iOS） ----
export const StatusBar: React.FC<{ time: string; light?: boolean; hideTime?: boolean }> = ({ time, light, hideTime }) => {
  const c = light ? "#fff" : "#1C1B19";
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: SCR_W, height: 54, zIndex: 25, color: c, fontFamily: "-apple-system, 'Noto Sans JP', sans-serif" }}>
      <div style={{ position: "absolute", left: 30, width: 92, top: 17, textAlign: "center", fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", opacity: hideTime ? 0 : 1 }}>{time}</div>
      <svg width="86" height="16" viewBox="0 0 86 16" style={{ position: "absolute", right: 26, top: 21 }}>
        {/* 電波 */}
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i * 5.2} y={11 - i * 3} width={3.6} height={4 + i * 3} rx={1} fill={c} />
        ))}
        {/* Wi-Fi */}
        <g transform="translate(31 1)" fill={c}>
          <path d="M8 3.2c2.5 0 4.8 1 6.5 2.6l1.3-1.4C13.7 2.4 11 1.2 8 1.2S2.3 2.4.2 4.4l1.3 1.4C3.2 4.2 5.5 3.2 8 3.2z" />
          <path d="M8 6.8c1.5 0 2.9.6 3.9 1.5l1.3-1.4C11.8 5.6 10 4.8 8 4.8s-3.8.8-5.2 2.1l1.3 1.4c1-.9 2.4-1.5 3.9-1.5z" />
          <path d="M8 10.2c.6 0 1.2.2 1.6.6L8 12.6l-1.6-1.8c.4-.4 1-.6 1.6-.6z" />
        </g>
        {/* 電池 */}
        <rect x="54.5" y="2.5" width="25" height="12" rx="3.6" fill="none" stroke={c} strokeOpacity={0.4} />
        <rect x="56.5" y="4.5" width="17" height="8" rx="2" fill={c} />
        <path d="M81 6.3v4.4c.9-.3 1.4-1.2 1.4-2.2s-.5-1.9-1.4-2.2z" fill={c} fillOpacity={0.45} />
      </svg>
    </div>
  );
};

export const HomeBar: React.FC<{ light?: boolean; opacity?: number }> = ({ light, opacity = 1 }) => (
  <div style={{ position: "absolute", left: (SCR_W - 136) / 2, bottom: 8, width: 136, height: 5, borderRadius: 3, background: light ? "#fff" : "#1C1B19", opacity, zIndex: 40 }} />
);

// ---- 日本語キーボード（かな・フリック） ----
const KB_H = 336 * K;
const ROW_KEY: Record<string, string> = {
  企: "か", 画: "か", 書: "さ", が: "か", 進: "さ", ま: "ま", な: "な", い: "あ", 何: "な", を: "わ", け: "か", ば: "は",
  か: "か", 分: "わ", ら: "ら", 最: "さ", 初: "さ", の: "な", 1: "☆123", 行: "か",
};
/** 打った文字数 → 予測変換の帯（打っている言葉ごと） */
const CANDS: Record<string, string[][]> = {
  企画書が進まない: [["私", "今日は", "明日"], ["企画", "企業", "企て"], ["企画書", "企画案", "企画会議"], ["が", "を", "の"], ["進まない", "書けない", "終わらない"], ["まない", "む", "んで"], ["ない", "ず", "なくて"], ["い", "くて", "かった"], ["。", "です", "んです"]],
  何を書けばいいか分からない: [["私", "今日は", "何"], ["何を", "何か", "何も"], ["書けば", "すれば", "したら"], ["けば", "く", "いたら"], ["ば", "る", "ない"], ["いいか", "いい", "良いか"], ["いか", "い", "いの"], ["か", "の", "かな"], ["分からない", "わからない", "迷う"], ["からない", "かる", "かって"], ["らない", "る", "った"], ["ない", "なくて", "なかった"], ["い", "くて", "かった"], ["。", "です", "んです"]],
  最初の1行: [["私", "今日は", "最初"], ["最初", "最後", "最近"], ["の", "に", "は"], ["一歩", "1行", "ページ"], ["行", "つ", "回"], ["で", "が", "目"]],
};

const Key: React.FC<{ label: string; dark?: boolean; down?: boolean; style?: React.CSSProperties; small?: boolean }> = ({ label, dark, down, style, small }) => (
  <div
    style={{
      position: "absolute", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
      background: down ? (dark ? "#FCFCFE" : "#AEB3BD") : dark ? "#ABB1BA" : "#FCFCFE",
      boxShadow: "0 1px 0 rgba(0,0,0,.32)", color: "#111", fontSize: small ? 15 : 23, fontWeight: small ? 500 : 400,
      fontFamily: "-apple-system, 'Noto Sans JP', sans-serif", ...style,
    }}
  >
    {label}
  </div>
);

/** 録画の keys と meta（キーボードが出ているか）から描く */
export const Keyboard: React.FC<{ tr: Track; t: number }> = ({ tr, t }) => {
  const rec = RECS[tr.src];
  let show = 0;
  let span: [number, number] | null = null;
  for (const [a, b] of kbSpans(tr.src)) {
    const ta = timeOf(tr, a);
    const tb = timeOf(tr, b);
    const v = P(t, ta, ta + 0.28, EASE.out) * (1 - P(t, tb, tb + 0.24, EASE.io));
    if (v > show) [show, span] = [v, [a, b]];
  }
  if (show <= 0 || !span) return null;
  const keys = rec.keys.filter((k) => k.f >= span![0] && k.f < span![1]);
  const word = keys.map((k) => k.ch).join("");
  let typedN = 0;
  let down = "";
  for (const k of keys) {
    const tk = timeOf(tr, k.f);
    if (t >= tk) typedN++;
    if (t >= tk - 0.05 && t < tk + 0.09) down = ROW_KEY[k.ch] ?? "あ";
  }
  const cands = (CANDS[word] ?? [])[Math.min(typedN, (CANDS[word]?.length ?? 1) - 1)] ?? [];
  const W = SCR_W;
  const side = 62;
  const gap = 7;
  const top0 = 50;
  const rowH = 52;
  const midW = (W - 2 * side - 6 * gap) / 3;
  const colX = (c: number) => (c === 0 ? gap : c === 4 ? W - side - gap : side + gap * 2 + (c - 1) * (midW + gap));
  const colW = (c: number) => (c === 0 || c === 4 ? side - gap : midW);
  const rows: [string, string, string, string, string][] = [
    ["→", "あ", "か", "さ", "⌫"],
    ["↺", "た", "な", "は", "空白"],
    ["ABC", "ま", "や", "ら", "改行"],
    ["☆123", "^^", "わ", "、。?!", ""],
  ];
  return (
    <div style={{ position: "absolute", left: 0, bottom: 0, width: W, height: KB_H, background: "#D3D6DC", zIndex: 30, translate: `0px ${(KB_H * (1 - show)).toFixed(1)}px` }}>
      {/* 予測変換 */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 44, display: "flex", alignItems: "center", fontSize: 18, color: "#111", fontFamily: "-apple-system, 'Noto Sans JP', sans-serif" }}>
        {cands.map((c, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", borderLeft: i ? "1px solid rgba(0,0,0,.14)" : undefined }}>{c}</div>
        ))}
      </div>
      {rows.map((r, ri) =>
        r.map((lab, ci) => {
          if (!lab) return null;
          const dark = ci === 0 || ci === 4;
          const tall = lab === "改行";
          return (
            <Key
              key={`${ri}-${ci}`}
              label={lab}
              dark={dark}
              small={dark || lab.length > 2}
              down={down === lab}
              style={{ left: colX(ci), top: top0 + ri * (rowH + gap), width: colW(ci), height: tall ? rowH * 2 + gap : rowH }}
            />
          );
        }),
      )}
      {/* 地球儀とマイク */}
      <svg width="26" height="26" viewBox="0 0 24 24" style={{ position: "absolute", left: 22, bottom: 22 }} fill="none" stroke="#50545B" strokeWidth="1.6">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M2.5 12h19M12 2.5c3 3 3 16 0 19M12 2.5c-3 3-3 16 0 19" />
      </svg>
      <svg width="24" height="26" viewBox="0 0 24 26" style={{ position: "absolute", right: 22, bottom: 22 }} fill="none" stroke="#50545B" strokeWidth="1.6">
        <rect x="8" y="2" width="8" height="14" rx="4" />
        <path d="M4 12a8 8 0 0 0 16 0M12 20v4" />
      </svg>
    </div>
  );
};

// ---- 指の跡（タップ・スクロール） ----
export const Touches: React.FC<{ tr: Track; t: number; skip?: number[] }> = ({ tr, t, skip = [] }) => (
  <>
    {RECS[tr.src].taps.map((tp, i) => {
      if (skip.includes(tp.f)) return null;
      const tt = timeOf(tr, tp.f);
      if (tp.kind === "tap") {
        if (t < tt - 0.16 || t > tt + 0.45) return null;
        const p1 = P(t, tt - 0.16, tt, EASE.out);
        const p2 = P(t, tt + 0.05, tt + 0.45, EASE.out);
        return (
          <div key={i}>
            <div className="tap" style={{ left: tp.x * K, top: tp.y * K, opacity: p1 * (1 - p2), scale: (lerp(1.3, 0.92, p1) * lerp(1, 0.8, p2)).toFixed(3) }} />
            {t > tt && <div className="tap" style={{ left: tp.x * K, top: tp.y * K, background: "transparent", borderColor: "rgba(43,41,36,.3)", opacity: 1 - p2, scale: lerp(1, 2.0, p2).toFixed(3) }} />}
          </div>
        );
      }
      // スクロール：指が下から上へなでる（指を離したあとは、画面だけ少し流れる）
      const t1 = timeOf(tr, tp.f1 ?? tp.f);
      if (t < tt - 0.15 || t > t1 + 0.3) return null;
      const dur = Math.max(0.25, (t1 - tt) * 0.7);
      const p = P(t, tt, tt + dur, EASE.io);
      const o = P(t, tt - 0.15, tt, EASE.out) * (1 - P(t, tt + dur, tt + dur + 0.25, EASE.out));
      const y = lerp(tp.y + 150, tp.y + 150 - Math.min(tp.dy ?? 300, 420), p);
      return <div key={i} className="tap" style={{ left: tp.x * K, top: y * K, opacity: o, scale: "0.92" }} />;
    })}
  </>
);

// ---- ロック画面（iOS）と通知 ----
export const LockScreen: React.FC<{ t: number; date: string; time: string; notifyAt: number; body: string; tapAt: number }> = ({ t, date, time, notifyAt, body, tapAt }) => {
  const pn = settle(t, notifyAt, 0.5);
  const pressed = t > tapAt - 0.05 && t < tapAt + 0.2;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "linear-gradient(170deg, #3E6E6A 0%, #8FB3AA 42%, #E8D9BE 100%)" }}>
      <div style={{ position: "absolute", left: -80, top: 420, width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,240,210,.55), rgba(255,240,210,0) 65%)" }} />
      {/* 錠前 */}
      <svg width="22" height="28" viewBox="0 0 22 28" style={{ position: "absolute", left: (SCR_W - 22) / 2, top: 60 }} fill="none" stroke="#fff" strokeWidth="2.6">
        <rect x="2" y="12" width="18" height="14" rx="3" fill="#fff" />
        <path d="M6 12V8a5 5 0 0 1 10 0v4" />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 104, textAlign: "center", fontSize: 21, fontWeight: 600, color: "rgba(255,255,255,.92)" }}>{date}</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 124, textAlign: "center", fontSize: 104, fontWeight: 700, letterSpacing: "-0.02em", color: "rgba(255,255,255,.95)", fontFamily: "-apple-system, 'Noto Sans JP', sans-serif" }}>{time}</div>
      {/* 通知 */}
      <div
        style={{
          position: "absolute", left: 12, right: 12, top: 512, borderRadius: 24, padding: "14px 16px 15px", display: "flex", gap: 12,
          background: pressed ? "rgba(236,236,236,.9)" : "rgba(250,250,250,.86)", boxShadow: "0 8px 24px rgba(0,0,0,.14)",
          opacity: pn, translate: `0px ${(70 * (1 - pn)).toFixed(1)}px`, scale: (pressed ? 0.97 : lerp(0.94, 1, pn)).toFixed(3),
        }}
      >
        <div className="app-ico" style={{ flex: "0 0 40px", height: 40, borderRadius: 10 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: "#1C1B19" }}>
            <span>ポケット問題解決</span>
            <span style={{ fontWeight: 500, color: "#6F6A62", fontSize: 14 }}>今</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: "#1C1B19" }}>今、どう？</div>
          <div style={{ fontSize: 15, color: "#3B3833", marginTop: 1 }}>{body}</div>
        </div>
      </div>
      {/* 懐中電灯とカメラ */}
      {[44, SCR_W - 44].map((x, i) => (
        <div key={i} style={{ position: "absolute", left: x - 25, bottom: 50, width: 50, height: 50, borderRadius: 25, background: "rgba(40,50,50,.32)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {i === 0 ? (
            <svg width="16" height="24" viewBox="0 0 16 24" fill="#fff"><path d="M3 1h10v5l-3 4v13H6V10L3 6z" /></svg>
          ) : (
            <svg width="24" height="20" viewBox="0 0 24 20" fill="#fff"><path d="M8 2h8l2 3h4v14H2V5h4z" /><circle cx="12" cy="11.5" r="4" fill="#5A6A68" /></svg>
          )}
        </div>
      ))}
    </div>
  );
};

/** 通知を押してアプリが開く：通知の場所から画面いっぱいに広がる（0→1） */
export const openFromNotification = (p: number): React.CSSProperties => {
  const q = clamp(p);
  const top = lerp(512, 0, q);
  const left = lerp(12, 0, q);
  const w = lerp(SCR_W - 24, SCR_W, q);
  const h = lerp(84, SCR_H, q);
  return {
    position: "absolute", left, top, width: w, height: h, overflow: "hidden", borderRadius: lerp(24, 52, q),
    opacity: clamp(q * 3),
  };
};
