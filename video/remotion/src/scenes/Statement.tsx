// ③ の最後の一文と、④ コンセプト
import React from "react";
import { Highlight } from "@remotion/rough-notation";
import { AbsoluteFill } from "remotion";
import { PhTag, SceneProps, useT } from "../components/common";
import { at, atEnd, EASE, lerp, line, P, pop, S } from "../lib/time";

/** 話した所から文字が出てくる（文字ごとの時刻を使う） */
const Spoken: React.FC<{ t: number; id: string; text: string }> = ({ t, id, text }) => {
  const l = line(id);
  const base = l.text.indexOf(text);
  const chars = Array.from(text);
  return (
    <>
      {chars.map((c, i) => {
        const ct = l.chars[base + i][0] - 0.06;
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
  const hl = P(t, at("n17", "当事者"), atEnd("n17", "私") + 0.25, EASE.io);
  return (
    <AbsoluteFill style={{ background: "#F4EEE3" }}>
      <div id="maker" style={{ opacity: 1, scale: (1 + 0.025 * P(t, S("n17"), 68.2, EASE.lin)).toFixed(4) }}>
        <Spoken t={t} id="n17" text="だから、" />
        <Highlight progress={hl} color="rgba(222, 84, 64, 0.26)" iterations={1} padding={{ left: 6, right: 6, top: 4, bottom: 4 }}>
          <Spoken t={t} id="n17" text="当事者の私" />
        </Highlight>
        <Spoken t={t} id="n17" text="が作りました。" />
      </div>
    </AbsoluteFill>
  );
};

export const Concept: React.FC<SceneProps> = ({ from }) => {
  const t = useT(from);
  const t0 = S("n18");
  const lift = P(t, S("n19") - 0.6, S("n19") + 0.1, EASE.io);
  const pl = pop(t, t0 - 0.2, 11);
  const loop = P(t, t0 + 0.15, t0 + 0.75, EASE.io);
  const name = P(t, t0 + 0.1, t0 + 0.55, EASE.out);
  const c1 = P(t, S("n19") - 0.1, S("n19") + 0.35, EASE.out);
  const c2 = P(t, S("n20") - 0.1, S("n20") + 0.35, EASE.out);
  const bar1 = c1 > 0 ? P(t, S("n19") + 0.5, S("n19") + 1.3, EASE.io) : 0;
  const bar2 = c2 > 0 ? P(t, at("n20", "もっと") - 0.3, at("n20", "もっと") + 0.6, EASE.io) : 0;
  const glow = P(t, t0 - 0.3, t0 + 1.2, EASE.out) * (1 - 0.6 * lift);
  const hl = P(t, at("n20", "もう一度"), atEnd("n20", "もう一度") + 0.2, EASE.io);
  return (
    <AbsoluteFill style={{ background: "#F4EEE3" }}>
      {/* 名前が出る所に、あたたかい光 */}
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 38%, rgba(240,190,94,0.35) 0%, rgba(240,190,94,0) 45%)", opacity: glow }} />
      <svg id="logo" viewBox="0 0 200 200" style={{ opacity: Math.min(1, pl * 2), scale: lerp(0.6, 1, pl).toFixed(4), translate: `0px ${(-175 * lift).toFixed(1)}px` }}>
        <g transform="rotate(-9 100 110)"><rect x="52" y="40" width="96" height="128" rx="10" fill="#D9ECE9" stroke="#3F8F8A" strokeWidth="5" /></g>
        <g>
          <rect x="66" y="30" width="96" height="128" rx="10" fill="#fff" stroke="#2E7672" strokeWidth="6" />
          <path d="M84 66 H144 M84 88 H144 M84 110 H124" stroke="#C9C0B0" strokeWidth="6" strokeLinecap="round" />
        </g>
        <path d="M150 168 C 186 160, 190 112, 168 96" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - loop} fill="none" stroke="#DE5440" strokeWidth="8" strokeLinecap="round" />
        <path d="M156 92 L172 90 L172 108" fill="none" stroke="#DE5440" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity={P(t, t0 + 0.65, t0 + 0.8, EASE.lin)} />
      </svg>
      <div id="app-name" style={{ opacity: name, translate: `0px ${(18 * (1 - name) - 175 * lift).toFixed(1)}px` }}>【アプリ名】</div>
      <div className="concept-line" style={{ top: 560, opacity: c1, translate: `0px ${(18 * (1 - c1)).toFixed(1)}px` }}>
        <span className="hurdle"><i /><i /><b style={{ top: lerp(6, 34, bar1) }} /></span>問題を解くハードルを下げる。
      </div>
      <div className="concept-line" style={{ top: 660, opacity: c2, translate: `0px ${(18 * (1 - c2)).toFixed(1)}px` }}>
        <span className="hurdle"><i /><i /><b style={{ top: lerp(6, 46, bar2) }} /></span>
        <Highlight progress={hl} color="rgba(222, 84, 64, 0.2)" iterations={1} padding={{ left: 2, right: 2, top: 2, bottom: 2 }}>
          <span className="acc">もう一度</span>
        </Highlight>
        向き合うハードルは、もっと下げる。
      </div>
      <PhTag label="未定" opacity={P(t, t0 + 0.3, t0 + 0.8)}>【アプリ名】を決めて差し替え</PhTag>
    </AbsoluteFill>
  );
};
