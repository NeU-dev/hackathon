// 壁と手順の世界：② 動機（phase="motive"）／③ 戻るのは重い（phase="heavy"）
import React from "react";
import { Underline } from "@remotion/rough-notation";
import { AbsoluteFill } from "remotion";
import { Person, SceneProps, useT } from "../components/common";
import { at, atEnd, camAt, EASE, En, lerp, mix, P, pop, S, win } from "../lib/time";

const CROWD: [number, number][] = [[110, 640], [205, 760], [300, 610], [655, 690], [760, 770], [830, 620], [150, 480], [720, 480], [250, 790], [560, 770], [405, 760], [70, 770], [345, 690], [610, 560], [820, 800], [480, 820]];
const STEPS = ["具体的に", "案を出す", "計画する", "やってみる"];
const STEP_X = [1054, 1268, 1482, 1696];
const ARROWS = ["M1228 560 H1262", "M1442 560 H1476", "M1656 560 H1690"];
const ME_OUT: [number, number] = [452, 560], ME_DOOR: [number, number] = [922, 700], ME_IN: [number, number] = [1010, 740];
const TANGLE = "M40 120 C 20 60, 110 30, 140 70 S 220 140, 170 150 S 70 160, 90 100 S 190 40, 210 90 S 160 170, 120 130 S 80 70, 150 60 S 240 110, 200 140 S 100 150, 60 130";

function walk(t: number, a: number, pts: [number, number][], d: number): [number, number] {
  const p = P(t, a, a + d, EASE.io);
  const seg = p < 0.5 ? 0 : 1, q = p < 0.5 ? p * 2 : (p - 0.5) * 2;
  const [x0, y0] = pts[seg], [x1, y1] = pts[seg + 1];
  const bob = p > 0 && p < 1 ? -7 * Math.abs(Math.sin(p * Math.PI * 6)) : 0;
  return [lerp(x0, x1, q), lerp(y0, y1, q) + bob];
}

export const World: React.FC<SceneProps & { phase: "motive" | "heavy" }> = ({ from, phase }) => {
  const t = useT(from);
  const heavy = phase === "heavy";
  const tD0 = S("n16") - 0.3;

  const cam = heavy
    ? { x: 1460, y: 600, s: 1.45 - 0.03 * P(t, tD0, S("n17"), EASE.lin) }
    : camAt([
        [11.9, 820, 600, 1.2], [S("n6") - 0.2, 820, 600, 1.2], [S("n6") + 1.7, 1460, 570, 1.45],
        [S("n11") - 0.3, 1460, 570, 1.45], [S("n11") + 1.5, 960, 540, 1.0], [48, 955, 540, 1.03],
      ], t);

  // 壁：最初から立っている。「医療の中にしかない」で高く、暗くなる
  const tWall = at("n12", "医療の中");
  const tall = heavy ? 1 : P(t, tWall - 0.3, tWall + 1.0, EASE.io);
  const wallUp = heavy ? 1 : P(t, 12.0, 12.8, EASE.out);
  const lbl = heavy ? 0 : P(t, 12.5, 13.1);
  const door = heavy ? 1 : P(t, S("n6") - 0.6, S("n6") - 0.1, EASE.out);

  // 壁の外にいた私
  const tWhat = at("n5", "何から");
  const away = heavy ? 0 : 1 - P(t, S("n6"), S("n6") + 0.5, EASE.lin);
  const tangle = P(t, at("n5", "こういう時") - 0.2, tWhat + 1.0, EASE.io);
  const q1 = pop(t, tWhat + 0.2), q2 = pop(t, tWhat + 0.5);
  const mePos = t >= S("n6") ? walk(t, S("n6"), [ME_OUT, ME_DOOR, ME_IN], 1.9) : ME_OUT;
  const meIn = pop(t, at("n4", "ADHD") - 0.3, 14);

  // 手順の図
  const tSteps = [at("n7", "具体的に"), at("n7", "案を出し"), at("n7", "計画して"), at("n7", "やってみる")];
  const dim = heavy ? 1 - 0.68 * P(t, tD0 + 0.3, tD0 + 0.9) : 1;
  const tHelp = at("n9", "何度も") - 0.2;
  const cyc = !heavy && t > tHelp && t < En("n9") + 0.6 ? ((t - tHelp) / 0.9) % 1 : -1;
  const loopP = heavy ? 1 : P(t, S("n8") - 0.1, atEnd("n8", "もう一度") + 0.2, EASE.io);
  const red = heavy ? P(t, tD0 + 0.4, tD0 + 0.9, EASE.lin) : 0;
  const pulse = red > 0 ? 0.5 + 0.5 * Math.sin((t - tD0) * 5.2) : 0;
  const loopLit = cyc >= 0 ? Math.max(0, 1 - Math.abs(cyc * 5 - 4.4) * 1.2) : 0;
  const ll = heavy ? 1 : P(t, at("n8", "直して") - 0.2, at("n8", "直して") + 0.3, EASE.out);
  const underline = heavy ? P(t, at("n16", "戻る") - 0.1, atEnd("n16", "重さ") + 0.2, EASE.io) : 0;
  const glow = heavy ? 0 : win(t, tHelp, S("n11"), 0.4);
  const me2 = heavy ? pop(t, tD0 + 0.6, 14) : 0;
  const tAll = at("n11", "誰の日常") - 0.5;

  return (
    <AbsoluteFill style={{ background: "#F4EEE3" }}>
      <div id="world" style={{ translate: `${(960 - cam.x * cam.s).toFixed(2)}px ${(540 - cam.y * cam.s).toFixed(2)}px`, scale: cam.s.toFixed(4) }}>
        <div className="region" id="w-left">
          <div className="region-label" style={{ left: 1070, opacity: lbl, translate: "-50% 0" }}>日常</div>
        </div>
        <div className="region" id="w-right">
          <div className="region-label" style={{ left: 510, opacity: lbl, translate: "-50% 0" }}>医療・支援の場</div>
        </div>
        {CROWD.map(([x, y], k) => {
          const p = heavy ? 0 : pop(t, tAll + k * 0.06, 13);
          return <Person key={k} left={x} top={y} style={{ scale: (0.7 * p).toFixed(4), opacity: Math.min(1, p * 2) }} />;
        })}
        <div id="proc-glow" style={{ opacity: glow }} />
        <div id="wall" style={{ scale: `1 ${(wallUp * (1 + 0.1 * tall)).toFixed(4)}`, filter: `brightness(${1 - 0.12 * tall})` }} />
        <div id="door" style={{ scale: `1 ${door.toFixed(4)}`, opacity: door }} />
        <div id="proc">
          <div id="proc-title" style={{ ...fade(t, at("n6", "問題解決技法") - 0.3), translate: `-50% ${(18 * (1 - P(t, at("n6", "問題解決技法") - 0.3, at("n6", "問題解決技法") + 0.15, EASE.out))).toFixed(1)}px` }}>
            問題解決技法
          </div>
          <svg width={1920} height={1080} viewBox="0 0 1920 1080">
            <defs>
              <marker id="ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#2E7672" /></marker>
              <marker id="ah-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#DE5440" /></marker>
            </defs>
            {ARROWS.map((d, k) => {
              const p = heavy ? 1 : P(t, tSteps[k + 1] - 0.2, tSteps[k + 1] + 0.1, EASE.out);
              return <path key={k} d={d} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} stroke="#2E7672" strokeWidth={4} fill="none" markerEnd={p > 0.9 ? "url(#ah)" : undefined} opacity={p > 0 ? dim : 0} />;
            })}
            <path
              d="M1781 612 C 1781 712, 1139 712, 1139 622"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - loopP}
              stroke={red > 0.5 ? "#DE5440" : "#2E7672"}
              strokeWidth={5 + 4 * red + 3 * loopLit}
              strokeLinecap="round"
              fill="none"
              opacity={loopP > 0 ? 1 : 0}
              markerEnd={loopP < 0.94 ? undefined : red > 0.5 ? "url(#ah-red)" : "url(#ah)"}
              style={{ filter: red > 0 ? `drop-shadow(0 0 ${((6 + 10 * pulse) * red).toFixed(1)}px rgba(222,84,64,${(0.55 * red).toFixed(2)}))` : undefined }}
            />
          </svg>
          {STEPS.map((s, k) => {
            const p = heavy ? 1 : pop(t, tSteps[k] - 0.05, 11);
            const lit = cyc >= 0 ? Math.max(0, 1 - Math.abs(cyc * 5 - k) * 1.2) : 0;
            return (
              <div key={s} className="step" style={{ left: STEP_X[k], opacity: Math.min(1, p * 2) * dim, translate: `0px ${(14 * (1 - Math.min(p, 1))).toFixed(1)}px`, scale: lerp(0.88, 1, p).toFixed(4), background: mix("#FFFFFF", "#CFE8E4", lit) }}>
                {s}
              </div>
            );
          })}
          <div id="loop-label" style={{ opacity: ll, translate: `-50% ${(8 * (1 - ll)).toFixed(1)}px`, color: red > 0.5 ? "#DE5440" : "#2E7672" }}>
            うまくいかなければ、直して
            <Underline progress={underline} color="#DE5440" strokeWidth={4} iterations={2} padding={{ top: 6 }}>
              もう一度
            </Underline>
          </div>
          <Person id="me2" left={1735} top={745} style={{ scale: (0.75 * me2).toFixed(4), opacity: Math.min(1, me2 * 2) }} />
        </div>
        {!heavy && (
          <>
            <svg viewBox="0 0 260 200" style={{ position: "absolute", left: 350, top: 330, width: 260, height: 200, overflow: "visible", opacity: tangle > 0 ? away : 0 }}>
              <path d={TANGLE} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - tangle} fill="none" stroke="#5E584E" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="qmark" style={{ left: 330, top: 300, scale: q1.toFixed(4), rotate: "-10deg", opacity: Math.min(1, q1 * 2) * away }}>?</div>
            <div className="qmark" style={{ left: 600, top: 320, scale: q2.toFixed(4), rotate: "12deg", opacity: Math.min(1, q2 * 2) * away }}>?</div>
            <Person id="me" left={mePos[0]} top={mePos[1]} style={{ scale: (1.2 * meIn).toFixed(4), opacity: Math.min(1, meIn * 2) }} />
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};

const fade = (t: number, a: number) => ({ opacity: P(t, a, a + 0.45, EASE.out) });
