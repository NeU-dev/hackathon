// 壁と手順の世界：② 動機（phase="motive"）／③ 止まった問題に戻る重さ（phase="heavy"）
import React from "react";
import { Underline } from "@remotion/rough-notation";
import { AbsoluteFill } from "remotion";
import { Person, SceneProps, useT } from "../components/common";
import { at, atEnd, camAt, EASE, lerp, mix, P, pop, S, settle, win } from "../lib/time";

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
  const tD0 = S("n21") - 0.3;

  const cam = heavy
    ? { x: 1460, y: 600, s: 1.45 - 0.03 * P(t, tD0, S("n22"), EASE.lin) }
    : camAt([
        [14.9, 820, 600, 1.2], [S("n8") - 0.2, 820, 600, 1.2], [S("n8") + 1.7, 1460, 560, 1.42],
        [S("n13") - 0.3, 1460, 560, 1.42], [S("n13") + 1.5, 960, 540, 1.0], [57, 955, 540, 1.03],
      ], t);

  // 壁：最初から立っている。「医療の中にしかない」で高く、暗くなる
  const tWall = at("n14", "医療の中");
  const tall = heavy ? 1 : P(t, tWall - 0.3, tWall + 1.0, EASE.io);
  const wallUp = heavy ? 1 : P(t, 15.0, 15.8, EASE.out);
  const lbl = heavy ? 0 : P(t, 15.5, 16.1);
  const door = heavy ? 1 : P(t, S("n8") - 0.6, S("n8") - 0.1, EASE.out);

  // 壁の外にいた私：何から手をつければいいかも分からず、自分を責める
  const tWhat = at("n7", "何から");
  const away = heavy ? 0 : 1 - P(t, S("n8"), S("n8") + 0.5, EASE.lin);
  const tangle = P(t, tWhat - 0.2, at("n7", "分からず") + 0.6, EASE.io);
  const q1 = pop(t, at("n7", "分からず")), q2 = pop(t, at("n7", "分からず") + 0.3);
  const blame = P(t, at("n7", "責める") - 0.2, at("n7", "責める") + 0.5, EASE.io) * (1 - P(t, S("n8") - 0.3, S("n8") + 0.2, EASE.io));
  const mePos = t >= S("n8") ? walk(t, S("n8"), [ME_OUT, ME_DOOR, ME_IN], 1.9) : ME_OUT;
  const meIn = pop(t, at("n6", "ADHD") - 0.3, 14);
  // 「解ける問題に見えました」で私の色が変わる
  const solved = P(t, at("n11", "解ける") - 0.2, at("n11", "解ける") + 0.6, EASE.io);
  const meGlow = win(t, at("n11", "解ける") - 0.2, S("n13"), 0.5);

  // 紙のシートの上の、手順の図
  const sheet = heavy ? 1 : settle(t, at("n9", "紙のシート") - 0.1, 0.7);
  const tSteps = [at("n9", "具体的に"), at("n9", "案を出し"), at("n9", "計画して"), at("n9", "やってみる")];
  const dim = heavy ? 1 - 0.68 * P(t, tD0 + 0.3, tD0 + 0.9) : 1;
  const loopP = heavy ? 1 : P(t, S("n10") - 0.1, atEnd("n10", "もう一度") + 0.2, EASE.io);
  const red = heavy ? P(t, tD0 + 0.4, tD0 + 0.9, EASE.lin) : 0;
  const pulse = red > 0 ? 0.5 + 0.5 * Math.sin((t - tD0) * 5.2) : 0;
  const ll = heavy ? 1 : P(t, at("n10", "直して") - 0.2, at("n10", "直して") + 0.3, EASE.out);
  const underline = heavy ? P(t, at("n21", "重さ") - 0.1, atEnd("n21", "重さ") + 0.4, EASE.io) : 0;
  const glow = heavy ? 0 : win(t, at("n11", "解ける") - 0.2, S("n13"), 0.4);
  const me2 = heavy ? pop(t, tD0 + 0.6, 14) : 0;
  const tAll = at("n13", "誰の日常") - 0.5;
  const titleP = P(t, at("n8", "問題解決技法") - 0.3, at("n8", "問題解決技法") + 0.15, EASE.out);

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
        {/* 紙のシート（手順の図の下敷き） */}
        <div
          style={{
            position: "absolute", left: 1030, top: 340, width: 880, height: 450, background: "#FFFDF8", borderRadius: 8,
            boxShadow: "0 2px 4px rgba(60,40,10,.10), 0 18px 40px rgba(60,40,10,.14)",
            backgroundImage: "repeating-linear-gradient(180deg, transparent 0 46px, rgba(150,170,200,.18) 46px 48px)",
            opacity: Math.min(1, sheet * 1.5) * (heavy ? 0.9 : 1), rotate: `${(-1.2 + 3 * (1 - sheet)).toFixed(2)}deg`,
            translate: `0px ${(40 * (1 - sheet)).toFixed(1)}px`,
          }}
        />
        <div id="wall" style={{ scale: `1 ${(wallUp * (1 + 0.1 * tall)).toFixed(4)}`, filter: `brightness(${1 - 0.12 * tall})` }} />
        <div id="door" style={{ scale: `1 ${door.toFixed(4)}`, opacity: door }} />
        <div id="proc">
          <div id="proc-title" style={{ opacity: titleP, translate: `-50% ${(18 * (1 - titleP)).toFixed(1)}px` }}>問題解決技法</div>
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
              strokeWidth={5 + 4 * red}
              strokeLinecap="round"
              fill="none"
              opacity={loopP > 0 ? 1 : 0}
              markerEnd={loopP < 0.94 ? undefined : red > 0.5 ? "url(#ah-red)" : "url(#ah)"}
              style={{ filter: red > 0 ? `drop-shadow(0 0 ${((6 + 10 * pulse) * red).toFixed(1)}px rgba(222,84,64,${(0.55 * red).toFixed(2)}))` : undefined }}
            />
          </svg>
          {STEPS.map((s, k) => {
            const p = heavy ? 1 : pop(t, tSteps[k] - 0.05, 11);
            return (
              <div key={s} className="step" style={{ left: STEP_X[k], opacity: Math.min(1, p * 2) * dim, translate: `0px ${(14 * (1 - Math.min(p, 1))).toFixed(1)}px`, scale: lerp(0.88, 1, p).toFixed(4) }}>
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
            {meGlow > 0 && (
              <div style={{ position: "absolute", left: mePos[0] - 70, top: mePos[1] - 50, width: 200, height: 220, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(63,143,138,.35), rgba(63,143,138,0) 70%)", opacity: meGlow }} />
            )}
            <Person
              id="me"
              left={mePos[0]}
              top={mePos[1]}
              color={mix("#5E584E", "#2E7672", solved)}
              style={{ scale: `${(1.2 * meIn).toFixed(4)} ${(1.2 * meIn * (1 - 0.08 * blame)).toFixed(4)}`, opacity: Math.min(1, meIn * 2), filter: blame > 0 ? `brightness(${1 - 0.25 * blame})` : undefined }}
            />
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
