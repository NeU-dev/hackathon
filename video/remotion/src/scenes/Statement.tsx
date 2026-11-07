// ③ の最後の一文と、④ コンセプト
import React from "react";
import { Highlight } from "@remotion/rough-notation";
import { AbsoluteFill } from "remotion";
import { PhTag, SceneProps, useT } from "../components/common";
import { at, atEnd, EASE, lerp, line, P, pop, S } from "../lib/time";

/** 話した所から文字が出てくる（文字ごとの時刻を使う） */
export const Spoken: React.FC<{ t: number; id: string; text: string; lead?: number }> = ({ t, id, text, lead = 0.06 }) => {
  const l = line(id);
  const base = l.text.indexOf(text);
  if (base < 0) throw new Error(`not in ${id}: ${text}`);
  return (
    <>
      {Array.from(text).map((c, i) => {
        const ct = l.chars[base + i][0] - lead;
        const p = P(t, ct, ct + 0.25, EASE.out);
        return (
          <span key={i} style={{ display: "inline-block", opacity: p, translate: `0px ${(14 * (1 - p)).toFixed(1)}px` }}>
            {c}
          </span>
        );
      })}
    </>
  );
};

export const Maker: React.FC<SceneProps> = ({ from }) => {
  const t = useT(from);
  const hl = P(t, at("n22", "当事者"), atEnd("n22", "私") + 0.25, EASE.io);
  return (
    <AbsoluteFill style={{ background: "#F4EEE3" }}>
      <div id="maker" style={{ opacity: 1, scale: (1 + 0.025 * P(t, S("n22"), 87.2, EASE.lin)).toFixed(4) }}>
        <Spoken t={t} id="n22" text="だから、" />
        <Highlight progress={hl} color="rgba(222, 84, 64, 0.26)" iterations={1} padding={{ left: 6, right: 6, top: 4, bottom: 4 }}>
          <Spoken t={t} id="n22" text="当事者の私" />
        </Highlight>
        <Spoken t={t} id="n22" text="が作りました。" />
      </div>
    </AbsoluteFill>
  );
};

/** 核の一文：「問題解決技法を、」「誰でも。」「何度でも。」（赤） */
export const CoreLine: React.FC<{ t: number; ids: [string, string]; top: number; scale?: number }> = ({ t, ids, top, scale = 1 }) => {
  const [a, b] = ids;
  const hl = P(t, at(b, "何度でも"), atEnd(b, "何度でも") + 0.25, EASE.io);
  const anyone = P(t, at(a, "誰でも") - 0.1, at(a, "誰でも") + 0.3, EASE.out);
  const again = P(t, at(b, "何度でも") - 0.1, at(b, "何度でも") + 0.3, EASE.out);
  return (
    <>
      <div className="core" style={{ top, fontSize: 64 * scale, color: "var(--ink-2)" }}>
        <Spoken t={t} id={a} text="問題解決技法を、" />
      </div>
      <div className="core" style={{ top: top + 110 * scale, fontSize: 112 * scale }}>
        <span style={{ display: "inline-block", opacity: anyone, translate: `0px ${(20 * (1 - anyone)).toFixed(1)}px`, marginRight: 70 * scale }}>誰でも。</span>
        <span style={{ display: "inline-block", opacity: again, translate: `0px ${(20 * (1 - again)).toFixed(1)}px`, color: "var(--accent)" }}>
          <Highlight progress={hl} color="rgba(222, 84, 64, 0.16)" iterations={1} padding={{ left: 6, right: 6, top: 4, bottom: 4 }}>
            何度でも。
          </Highlight>
        </span>
      </div>
    </>
  );
};

export const Concept: React.FC<SceneProps> = ({ from }) => {
  const t = useT(from);
  const t0 = S("n23");
  const pl = pop(t, t0 - 0.2, 11);
  const loop = P(t, t0 + 0.15, t0 + 0.75, EASE.io);
  const name = P(t, t0 + 0.1, t0 + 0.55, EASE.out);
  const lift = P(t, S("n24") - 0.5, S("n24") + 0.1, EASE.io);
  const glow = P(t, t0 - 0.3, t0 + 1.2, EASE.out) * (1 - 0.6 * lift);
  return (
    <AbsoluteFill style={{ background: "#F4EEE3" }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 38%, rgba(240,190,94,0.35) 0%, rgba(240,190,94,0) 45%)", opacity: glow }} />
      <svg id="logo" viewBox="0 0 200 200" style={{ opacity: Math.min(1, pl * 2), scale: lerp(0.6, 1, pl).toFixed(4), translate: `0px ${(-190 * lift).toFixed(1)}px` }}>
        <g transform="rotate(-9 100 110)"><rect x="52" y="40" width="96" height="128" rx="10" fill="#D9ECE9" stroke="#3F8F8A" strokeWidth="5" /></g>
        <g>
          <rect x="66" y="30" width="96" height="128" rx="10" fill="#fff" stroke="#2E7672" strokeWidth="6" />
          <path d="M84 66 H144 M84 88 H144 M84 110 H124" stroke="#C9C0B0" strokeWidth="6" strokeLinecap="round" />
        </g>
        <path d="M150 168 C 186 160, 190 112, 168 96" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - loop} fill="none" stroke="#DE5440" strokeWidth="8" strokeLinecap="round" />
        <path d="M156 92 L172 90 L172 108" fill="none" stroke="#DE5440" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity={P(t, t0 + 0.65, t0 + 0.8, EASE.lin)} />
      </svg>
      <div id="app-name" style={{ opacity: name, translate: `0px ${(18 * (1 - name) - 190 * lift).toFixed(1)}px`, scale: lerp(1, 0.8, lift).toFixed(4) }}>【アプリ名】</div>
      {(() => {
        const d = P(t, S("n23b") - 0.15, S("n23b") + 0.35, EASE.out);
        return (
          <div style={{ position: "absolute", left: 0, right: 0, top: 650, textAlign: "center", fontSize: 40, fontWeight: 700, color: "var(--ink-2)", opacity: d, translate: `0px ${(14 * (1 - d) - 222 * lift).toFixed(1)}px`, scale: lerp(1, 0.76, lift).toFixed(4) }}>
            <span style={{ color: "var(--teal)" }}>Claude</span>と一緒に、紙のシートを書くアプリ
          </div>
        );
      })()}
      <CoreLine t={t} ids={["n24", "n25"]} top={500} />
      <PhTag label="未定" opacity={P(t, t0 + 0.3, t0 + 0.8)}>【アプリ名】を決めて差し替え</PhTag>
    </AbsoluteFill>
  );
};
