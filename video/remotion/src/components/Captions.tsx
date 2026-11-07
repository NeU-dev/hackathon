// 字幕：ナレーションと同じ文。読まれた所から文字が白くなる（音素の時刻に合わせる）。
// 画面に同じ文が大きく出る所は出さない。デモ中は右の列に出し、スマホに重ねない。
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Caption } from "@remotion/captions";
import { FPS, LINES, P, EASE } from "../lib/time";
import { W } from "../lib/warp";

// 画面に同じ文が大きく出る所：③の最後の一文、④（アプリの一言も）、⑥の役割・問いかけ・核の一文
const NOSUB = new Set(["n22", "n23", "n23b", "n24", "n25", "n43", "n45", "n48", "n49", "n50"]);
const SIDE: [number, number] = [103.4, W(147.6)];

type Page = { start: number; show: number; text: string; from: number; chars: [number, number][]; groups: { text: string; from: number }[] };

/** 助詞や句読点は前の語にくっつけて、文節に近いまとまりで改行させる */
function groupTokens(tokens: Caption[]) {
  const out: { text: string; from: number }[] = [];
  let pos = 0;
  let open: { text: string; from: number } | null = null; // 開きかっこは次の語にくっつける
  for (const tok of tokens) {
    const glue = /^[ぁ-んー、。」）]{1,3}$/.test(tok.text) || /^[、。」）！？]+$/.test(tok.text);
    if (/^[「（]+$/.test(tok.text)) {
      open = open ? { text: open.text + tok.text, from: open.from } : { text: tok.text, from: pos };
    } else if (open) {
      out.push({ text: open.text + tok.text, from: open.from });
      open = null;
    } else if (glue && out.length && out[out.length - 1].text.length + tok.text.length <= 10) out[out.length - 1].text += tok.text;
    else out.push({ text: tok.text, from: pos });
    pos += tok.text.length;
  }
  if (open) out.push(open);
  return out;
}

const PAGES: Page[] = (() => {
  const pages: Page[] = [];
  for (const l of LINES) {
    if (NOSUB.has(l.id)) continue;
    const groups = groupTokens(l.tokens);
    for (const pg of l.pages) {
      const chars = l.chars.slice(pg.from, pg.to) as [number, number][];
      pages.push({
        start: chars[0][0],
        show: chars[chars.length - 1][1],
        text: pg.text,
        from: pg.from,
        chars,
        groups: groups
          .filter((g) => g.from >= pg.from && g.from < pg.to)
          .map((g) => ({ text: g.text.slice(0, pg.to - g.from), from: g.from - pg.from })),
      });
    }
  }
  pages.sort((a, b) => a.start - b.start);
  pages.forEach((p, i) => {
    const nx = pages[i + 1];
    p.show = Math.min(p.show + 0.45, nx ? nx.start - 0.04 : p.show + 0.45);
  });
  return pages;
})();

export const Captions: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const page = PAGES.find((p) => t >= p.start - 0.12 && t < p.show);
  if (!page) return null;
  const side = t > SIDE[0] && t < SIDE[1];
  const enter = P(t, page.start - 0.12, page.start + 0.08, EASE.out);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: side ? 1250 : 0,
          right: side ? 50 : 0,
          bottom: side ? 64 : 44,
          textAlign: side ? "left" : "center",
          opacity: enter,
          translate: `0px ${(10 * (1 - enter)).toFixed(1)}px`,
        }}
      >
        <span
          style={{
            display: "inline-block",
            maxWidth: 1640,
            padding: side ? "12px 26px 14px" : "12px 34px 15px",
            borderRadius: 18,
            background: "rgba(34, 31, 27, .86)",
            fontSize: side ? 36 : 42,
            fontWeight: 700,
            letterSpacing: ".02em",
            lineHeight: 1.38,
            color: "#fff",
          }}
        >
          {page.groups.map((g) => (
            <span key={g.from} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
              {Array.from(g.text).map((c, i) => {
                const ct = page.chars[g.from + i]?.[0] ?? page.start;
                const lit = P(t, ct - 0.04, ct + 0.06, EASE.lin);
                return (
                  <span key={i} style={{ color: `rgba(255,255,255,${(0.5 + 0.5 * lit).toFixed(3)})` }}>
                    {c}
                  </span>
                );
              })}
            </span>
          ))}
        </span>
      </div>
    </AbsoluteFill>
  );
};
