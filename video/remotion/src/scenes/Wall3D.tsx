// 壁と手順の世界（3D）：② 動機（phase="motive"）／③ 止まった問題に戻る重さ（phase="heavy"）
// 背景は Blender で描いたコマ（public/wall3d/、blender/wall_scene.py）。3D の中で動きがあるコマだけを描き、
// ほかのコマは直前のコマを使う。手順の図はここで描き、3D の紙のシートの四隅に遠近を合わせて貼る。
import React from "react";
import { Underline } from "@remotion/rough-notation";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { SceneProps, useT } from "../components/common";
import { at, atEnd, camAt, EASE, FPS, lerp, P, pop, S, win } from "../lib/time";
import data from "../data/wall3d.json";

type Pt = [number, number];
const W3 = data as unknown as { fps: number; src: Record<string, number>; at: Record<string, { board: Pt[]; head: Pt }> };
const FRAMES = Object.keys(W3.src).map(Number).sort((a, b) => a - b);

/** そのコマで使う Blender の絵と、紙の四隅・頭の位置 */
function shotAt(t: number) {
  let f = Math.round(t * FPS);
  if (!(String(f) in W3.src)) f = FRAMES.reduce((best, x) => (Math.abs(x - f) < Math.abs(best - f) ? x : best), FRAMES[0]);
  const src = W3.src[String(f)];
  return { src, ...W3.at[String(src)] };
}

/** 横 w・縦 h の板を、画面上の四角形 q（左上・右上・右下・左下）に貼る matrix3d */
function quadMatrix(w: number, h: number, q: Pt[]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, k = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    k = (dx1 * dy3 - dx3 * dy1) / det;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3;
  const d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => v.toFixed(10)).join(",")})`;
}

// 紙のシート（880×450）の上の配置
const BW = 880, BH = 450;
const STEPS = ["具体的に", "案を出す", "計画する", "やってみる"];
const STEP_X = [24, 238, 452, 666];
const ARROWS = ["M198 220 H232", "M412 220 H446", "M626 220 H660"];
const LOOP = "M751 272 C 751 372, 109 372, 109 282";
const TANGLE = "M40 120 C 20 60, 110 30, 140 70 S 220 140, 170 150 S 70 160, 90 100 S 190 40, 210 90 S 160 170, 120 130 S 80 70, 150 60 S 240 110, 200 140 S 100 150, 60 130";

// Blender 側と同じ時刻
const T_WALK = () => S("n8");
const T_SOLVED = () => at("n11", "解ける") - 0.2;
const T_WIDE = () => S("n13") - 0.3;

/** 3D のカメラが止まっているあいだだけ、ゆっくり寄る（動くあいだに元へ戻す）。[秒, 寄る中心x, y, 倍率] */
const zoomKeys = (heavy: boolean): [number, number, number, number][] =>
  heavy
    ? [[S("n21") - 0.3, 1100, 520, 1.0], [S("n22"), 1100, 520, 1.045]]
    : [
        [14.9, 760, 560, 1.0], [T_WALK() - 0.25, 760, 560, 1.07], [T_WALK() + 1.9, 960, 540, 1.0],
        [T_WALK() + 3.0, 1100, 500, 1.0], [T_WIDE(), 1100, 500, 1.06], [T_WIDE() + 1.8, 1100, 500, 1.0],
        [57, 1150, 520, 1.04],
      ];

export const Wall3D: React.FC<SceneProps & { phase: "motive" | "heavy" }> = ({ from, phase }) => {
  const t = useT(from);
  const heavy = phase === "heavy";
  const tD0 = S("n21") - 0.3;
  const sh = shotAt(t);
  const z = camAt(zoomKeys(heavy), t);

  // 図が見えるのは、カメラが壁を越えてから
  const onBoard = heavy ? 1 : P(t, T_WALK() + 1.5, T_WALK() + 2.1, EASE.lin);
  const tTitle = Math.max(at("n8", "問題解決技法") - 0.3, T_WALK() + 1.8);
  const titleP = heavy ? 1 : P(t, tTitle, tTitle + 0.45, EASE.out);
  const tSheet = at("n9", "紙のシート");
  const sheetFlash = heavy ? 0 : win(t, tSheet - 0.15, tSheet + 0.9, 0.35);
  const tSteps = [at("n9", "具体的に"), at("n9", "案を出し"), at("n9", "計画して"), at("n9", "やってみる")];
  const dim = heavy ? 1 - 0.68 * P(t, tD0 + 0.3, tD0 + 0.9) : 1;
  const loopP = heavy ? 1 : P(t, S("n10") - 0.1, atEnd("n10", "もう一度") + 0.2, EASE.io);
  const red = heavy ? P(t, tD0 + 0.4, tD0 + 0.9, EASE.lin) : 0;
  const pulse = red > 0 ? 0.5 + 0.5 * Math.sin((t - tD0) * 5.2) : 0;
  const ll = heavy ? 1 : P(t, at("n10", "直して") - 0.2, at("n10", "直して") + 0.3, EASE.out);
  const underline = heavy ? P(t, at("n21", "重さ") - 0.1, atEnd("n21", "重さ") + 0.4, EASE.io) : 0;
  const glow = heavy ? 0 : win(t, T_SOLVED(), S("n13"), 0.5);

  // 壁の外の私：何から手をつければいいかも分からない
  const tWhat = at("n7", "何から");
  const away = heavy ? 0 : 1 - P(t, S("n8") - 0.4, S("n8") + 0.1, EASE.lin);
  const tangle = P(t, tWhat - 0.2, at("n7", "分からず") + 0.6, EASE.io);
  const q1 = pop(t, at("n7", "分からず")), q2 = pop(t, at("n7", "分からず") + 0.3);
  const [hx, hy] = sh.head;

  // 重さ：画面全体を少し沈ませる
  const sink = heavy ? P(t, tD0 + 0.3, tD0 + 1.2) : 0;
  const m = quadMatrix(BW, BH, sh.board);

  return (
    <AbsoluteFill style={{ background: "#CFC6B6", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${z.x.toFixed(1)}px ${z.y.toFixed(1)}px`, scale: z.s.toFixed(4) }}>
        <Img
          src={staticFile(`wall3d/f${String(sh.src).padStart(5, "0")}.jpg`)}
          style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, filter: sink > 0 ? `saturate(${1 - 0.25 * sink}) brightness(${1 - 0.07 * sink})` : undefined }}
        />

        {/* 解けた：紙のまわりがほのかに明るくなる */}
        {glow > 0 && (
          <div style={{ position: "absolute", left: 0, top: 0, width: BW, height: BH, transformOrigin: "0 0", transform: m, mixBlendMode: "screen", pointerEvents: "none" }}>
            <div style={{ position: "absolute", left: -120, top: -90, width: BW + 240, height: BH + 180, borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(63,143,138,.30), rgba(63,143,138,0) 68%)", opacity: glow }} />
          </div>
        )}
        {sheetFlash > 0 && (
          <div style={{ position: "absolute", left: 0, top: 0, width: BW, height: BH, transformOrigin: "0 0", transform: m, mixBlendMode: "screen", pointerEvents: "none" }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(255,248,225,.22)", opacity: sheetFlash }} />
          </div>
        )}

        {/* 紙のシートの上の手順の図（インクのように紙に重ねる） */}
        <div
          className="board3d"
          style={{ position: "absolute", left: 0, top: 0, width: BW, height: BH, transformOrigin: "0 0", transform: m, mixBlendMode: "multiply", opacity: onBoard }}
        >
          <div className="b3-title" style={{ opacity: titleP, translate: `-50% ${(14 * (1 - titleP)).toFixed(1)}px` }}>
            問題解決技法
          </div>
          <svg width={BW} height={BH} viewBox={`0 0 ${BW} ${BH}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <defs>
              <marker id="ah3" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#2E7672" /></marker>
              <marker id="ah3-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#DE5440" /></marker>
            </defs>
            {ARROWS.map((d, k) => {
              const p = heavy ? 1 : P(t, tSteps[k + 1] - 0.2, tSteps[k + 1] + 0.1, EASE.out);
              return <path key={k} d={d} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} stroke="#2E7672" strokeWidth={4} fill="none" markerEnd={p > 0.9 ? "url(#ah3)" : undefined} opacity={p > 0 ? dim : 0} />;
            })}
            <path
              d={LOOP}
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - loopP}
              stroke={red > 0.5 ? "#DE5440" : "#2E7672"}
              strokeWidth={5 + 4 * red}
              strokeLinecap="round"
              fill="none"
              opacity={loopP > 0 ? 1 : 0}
              markerEnd={loopP < 0.94 ? undefined : red > 0.5 ? "url(#ah3-red)" : "url(#ah3)"}
            />
          </svg>
          {STEPS.map((s, k) => {
            const p = heavy ? 1 : pop(t, tSteps[k] - 0.05, 11);
            return (
              <div key={s} className="b3-step" style={{ left: STEP_X[k], opacity: Math.min(1, p * 2) * dim, translate: `0px ${(14 * (1 - Math.min(p, 1))).toFixed(1)}px`, scale: lerp(0.88, 1, p).toFixed(4) }}>
                {s}
              </div>
            );
          })}
          <div className="b3-loop" style={{ opacity: ll, translate: `-50% ${(8 * (1 - ll)).toFixed(1)}px`, color: red > 0.5 ? "#DE5440" : "#2E7672" }}>
            うまくいかなければ、直して
            <Underline progress={underline} color="#DE5440" strokeWidth={4} iterations={2} padding={{ top: 6 }}>
              もう一度
            </Underline>
          </div>
        </div>

        {/* 重さ：赤い輪がにじむ（紙の上に光として重ねる） */}
        {red > 0 && (
          <div style={{ position: "absolute", left: 0, top: 0, width: BW, height: BH, transformOrigin: "0 0", transform: m, mixBlendMode: "screen", pointerEvents: "none" }}>
            <svg width={BW} height={BH} viewBox={`0 0 ${BW} ${BH}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
              <path d={LOOP} stroke={`rgba(222,84,64,${(0.35 * red * (0.4 + 0.6 * pulse)).toFixed(3)})`} strokeWidth={26} strokeLinecap="round" fill="none" style={{ filter: "blur(10px)" }} />
            </svg>
          </div>
        )}

        {/* 壁の外の私の頭の上：もつれた線と「?」 */}
        {!heavy && tangle > 0 && away > 0 && (
          <>
            <svg viewBox="0 0 260 200" style={{ position: "absolute", left: hx - 150, top: hy - 235, width: 260, height: 200, overflow: "visible", opacity: away }}>
              <path d={TANGLE} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - tangle} fill="none" stroke="#4A453E" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="qmark" style={{ fontSize: 66, left: hx - 200, top: hy - 270, scale: q1.toFixed(4), rotate: "-10deg", opacity: Math.min(1, q1 * 2) * away }}>?</div>
            <div className="qmark" style={{ fontSize: 66, left: hx + 105, top: hy - 250, scale: q2.toFixed(4), rotate: "12deg", opacity: Math.min(1, q2 * 2) * away }}>?</div>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
