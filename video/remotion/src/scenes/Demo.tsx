// ⑤ デモ：止まった企画書が、もう一度動くまで（書く → 決める → 止まる → もう一度 → 動けた）
import React from "react";
import { Circle, Highlight } from "@remotion/rough-notation";
import { AbsoluteFill } from "remotion";
import { PhTag, SceneProps, useT } from "../components/common";
import { at, atEnd, camAt, clamp, EASE, En, lerp, line, mix, P, pop, S, settle, typed, win } from "../lib/time";
import { W } from "../lib/warp";

// ---- 中身（台本 v5「画面録画で入力する内容」に合わせたダミー） ----
const FR = ["いま困っていること", "目標", "案を出す", "一歩を決める", "いつ・どこで", "最初の2分", "やってみた"];
const PROBLEM2 = "月曜までに出さないといけない。";
const PAPER1 = ["何から書けばいいか分からず、最初の1行で止まる", "月曜までに企画書を出す", "土曜に全部書く／見出しだけ先に作る／先輩の企画書を見る",
  "土曜に、企画書を全部書く（3時間）", "土曜 10:00 ・ 自宅の机", "企画書のファイルを開く", ""];
const NEW_STEP = "見出しを3つだけ書く（5分）";
const PAPER2 = [PAPER1[0], PAPER1[1], PAPER1[2], NEW_STEP, "土曜 15:00 ・ 自宅の机", "ファイルを開いて「1.」と打つ", "見出しを3つ書けた"];
const A1 = "何を書けばいいか分からない";
const A2 = "最初の1行";
const GOAL = "月曜までに企画書を出す";
const IDEAS: [string, number, number][] = [["土曜に全部書く", W(106.8), W(107.2)], ["見出しだけ先に作る", W(107.7), W(108.05)], ["先輩の企画書を見せてもらう", W(108.55), W(108.9)]];
const EVIDENCE: [string, string, boolean][] = [["10/03", "一歩 3分", true], ["10/08", "一歩 30分", false], ["10/12", "一歩 5分", true], ["10/17", "一歩 1時間", false], ["10/21", "一歩 2分", true], ["10/24", "一歩 5分", true], ["11/14", "一歩 3時間", false]];
const STAGES: [string, string, number, number, string][] = [
  ["書く", "困りごとを、そのまま", 60, W(106.5), "#2E7672"],
  ["決める", "案を出して、最初の一歩", W(106.5), W(113.0), "#2E7672"],
  ["止まる", "できなかった日", W(113.0), W(129.4), "#DE5440"],
  ["もう一度", "前の紙に重ねて、一歩を小さく", W(129.4), W(143.0), "#DE5440"],
  ["動けた", "2枚目の紙で", W(143.0), 200, "#2E7672"],
];

// ---- 時刻（効果音からも使う） ----
export const Q1 = () => S("n28") + 0.1;
export const SEND1 = () => Q1() + 1.0;
export const Q2 = () => SEND1() + 0.05;
export const SEND2 = () => at("n28", "何から") - 0.05;
export const IDEA_LAND = (k: number) => IDEAS[k][2] + 0.15 + 0.45;
const TAP_AGAIN = () => at("n36", "もう一度") + 0.1;
const TAP_GO = () => En("n39") + 0.25;
export const DEMO_TAPS = (): [number, number, number][] => [
  [at("n30", "土曜"), 120, 251], [at("n31", "今") - 0.15, 198, 330], [at("n32", "つけられ") + 0.3, 198, 607],
  [TAP_AGAIN(), 198, 551], [TAP_GO(), 198, 772], [W(144.0), 198, 686],
];
export const NOTIFY_T = () => at("n31", "アプリが聞きます") - 0.1;
export const STOP_T = () => at("n33", "終わり") - 0.15;
export const STACK_T = () => S("n37") - 0.1;
export const DONE_T = W(144.8);

const PY = (sy: number) => 20 + 1.18 * (12 + sy); // スマホ画面の y → ステージの y
const REST: [number, number, number] = [560, 520, 1];

// ---- 部品 ----
const Frame: React.FC<{ i: number; text: string; fill: number; cls?: string; typedText?: string; hand?: boolean }> = ({ i, text, fill, cls, typedText, hand }) => (
  <div className={`frame${fill > 0.5 ? " on" : ""}${cls ? " " + cls : ""}`}>
    <div className="fn">{i + 1}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="fl">{FR[i]}</div>
      <div className={`fc${hand ? " hand" : ""}`} style={{ opacity: fill, ...(hand ? { color: "#8C8476", fontSize: 20 } : {}) }}>{typedText ?? text}</div>
    </div>
    <div className="empty" style={{ opacity: 1 - fill }} />
  </div>
);

const Screen: React.FC<{ o: number; id?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ o, id, style, children }) =>
  o <= 0 ? null : (
    <div className="scr" id={id} style={{ opacity: o, ...style }}>
      {children}
    </div>
  );

const Bubble: React.FC<{ t: number; a: number; b: number; dx: number; style: React.CSSProperties; children: React.ReactNode }> = ({ t, a, b, dx, style, children }) => {
  const pu = settle(t, a, 0.5);
  const pp = P(t, b, b + 0.3, EASE.out);
  return (
    <div className="bubble" style={{ ...style, opacity: Math.min(1, pu * 1.4) * (1 - pp), translate: `${(dx * Math.sin((t - a) * 1.3)).toFixed(1)}px ${(110 * (1 - pu) + 6 * Math.sin((t - a) * 2.1)).toFixed(1)}px`, scale: (1 + 0.15 * pp).toFixed(3) }}>
      {children}
    </div>
  );
};

/** 話している言葉に合わせて文字を出す（その文の中の、その言葉の文字ごとの時刻を使う） */
const spokenTyped = (t: number, id: string, phrase: string) => {
  const l = line(id);
  const base = l.text.indexOf(phrase);
  let n = 0;
  for (let i = 0; i < phrase.length; i++) if (t >= l.chars[base + i][0]) n = i + 1;
  return phrase.slice(0, n);
};

/** 右の列：③で言った紙の問題が、ここで解ける */
const ProblemChip: React.FC<{ t: number; n: number; text: string; answer: string; a: number; ok: number; b: number; red?: boolean; zoom: number }> = ({ t, n, text, answer, a, ok, b, red, zoom }) => {
  const o = win(t, a, b, 0.35) * (1 - zoom);
  if (o <= 0) return null;
  const pin = settle(t, a, 0.5);
  const pk = pop(t, ok, 11);
  return (
    <div className={`pchip${red ? " red" : ""}`} style={{ opacity: o, translate: `${(30 * (1 - pin)).toFixed(1)}px 0px` }}>
      <div className="pc-ok" style={{ background: pk > 0 ? "#2E7672" : "transparent", borderColor: pk > 0 ? "#2E7672" : "#C9C0B0", scale: (pk > 0 ? lerp(0.6, 1, Math.min(pk, 1.2)) : 1).toFixed(3) }}>{pk > 0 ? "✓" : ""}</div>
      <div className="pc-l">紙の問題{n}</div>
      <div className="pc-t" style={{ textDecoration: pk > 0.6 ? "line-through" : "none", textDecorationColor: "rgba(46,118,114,.6)", color: pk > 0.6 ? "#8C8476" : undefined }}>{text}</div>
      <div className="pc-a" style={{ opacity: clamp(pk), height: pk > 0 ? undefined : 0 }}>→ {answer}</div>
    </div>
  );
};

export const Demo: React.FC<SceneProps> = ({ from }) => {
  const t = useT(from);
  const cam = camAt([
    [W(93.9), ...REST], [SEND2() - 0.4, ...REST], [SEND2() + 0.3, 508, 420, 1.32], [W(105.6), 508, 420, 1.32], [W(106.3), ...REST],
    [S("n35") - 0.6, ...REST], [S("n35") + 0.1, 508, 400, 1.5], [En("n35") + 0.2, 508, 400, 1.5], [En("n35") + 0.8, ...REST],
    [at("n38", "小さく") - 0.6, ...REST], [at("n38", "小さく") + 0.1, 508, 640, 1.38], [En("n39") - 0.1, 508, 640, 1.38], [En("n39") + 0.5, ...REST], [160, ...REST],
  ], t);
  const zoom = clamp((cam.s - 1) / 0.25);
  const pin = settle(t, W(93.9), 0.7);

  const label = (a: number, b: number) => {
    const p = settle(t, a, 0.45);
    return { opacity: win(t, a, b, 0.3), translate: `${(-16 * (1 - p)).toFixed(1)}px 0px` };
  };

  return (
    <AbsoluteFill style={{ background: "#F4EEE3" }}>
      <div id="cam5" style={{ translate: `${(560 - cam.x * cam.s).toFixed(2)}px ${(520 - cam.y * cam.s).toFixed(2)}px`, scale: cam.s.toFixed(4) }}>
        <div className="phone" id="phone5" style={{ left: 260, top: 20, scale: "1.18", translate: `0px ${(40 * (1 - pin)).toFixed(1)}px` }}>
          <div className="screen">
            <StatusBar t={t} />
            <PaperScreen t={t} />
            <DumpScreen t={t} />
            <IdeasScreen t={t} />
            <LockScreen t={t} />
            <CheckScreen t={t} />
            <RecordScreen t={t} />
            <StackScreen t={t} />
            <Tap t={t} />
          </div>
          <div className="island" />
        </div>
        <div className="clabel" style={{ top: PY(470) - 40, ...label(at("n28", "Claude") - 0.1, W(106.3)) }}><i /><small>Claude</small>問いかける</div>
        <div className="clabel" style={{ top: PY(160) - 40, ...label(at("n34", "Claude") - 0.1, W(129.6)) }}><i /><small>Claude</small>これまでの紙を読む</div>
        <div className="clabel" style={{ top: PY(560) - 40, ...label(at("n38", "本人の言葉") - 0.25, En("n39") + 0.4) }}><i /><small>Claude</small>あなたの言葉のまま、小さくする</div>
        <div id="rail" style={{ opacity: 1 - zoom }}>
          <div className="eyebrow">止まった企画書が、もう一度動くまで</div>
          {STAGES.map(([tt, dd, a, b, color], k) => {
            const act = win(t, a, b, 0.35);
            const done = t > b;
            const sp = settle(t, a, 0.5) * (1 - P(t, b - 0.3, b, EASE.io));
            return (
              <div className="stage-item" key={tt}>
                <div className="bg" style={{ opacity: act }} />
                <div className="ix" style={{ borderColor: act > 0.5 ? color : done ? "#2E7672" : "#C9C0B0", background: done ? "#2E7672" : act > 0.5 ? "#fff" : "transparent", color: done ? "#fff" : act > 0.5 ? color : "#8C8476" }}>
                  {done ? "✓" : k + 1}
                </div>
                <div className="tt" style={{ color: act > 0.5 ? color : done ? "#5E584E" : "#A79F92", scale: (1 + 0.12 * sp).toFixed(4), transformOrigin: "0 50%" }}>{tt}</div>
                <div className="dd" style={{ opacity: act }}>{dd}</div>
              </div>
            );
          })}
        </div>
      </div>
      <ProblemChip t={t} n={1} text="一人だと、具体的にできない" answer="問いに答えて、具体的に" a={S("n27")} ok={at("n28", "見えてくる")} b={W(106.4)} zoom={zoom} />
      <ProblemChip t={t} n={2} text="「できなかった」と書くのが、つらい" answer="できなかった日が、手がかりになる" a={S("n33")} ok={S("n35")} b={W(129.3)} zoom={zoom} />
      <ProblemChip t={t} n={3} text="もう一度向き合うのは、もっとつらい" answer="前の紙に重ねて、一歩を小さく" a={S("n36")} ok={at("n39", "書く")} b={W(142.9)} red zoom={zoom} />
      <div className="ff-chip" style={{ left: 770, top: 34, opacity: fastForward(t) }}>▶▶ 早送り</div>
      <PhTag label="仮画面" right opacity={P(t, W(94.4), W(94.9))}>アプリの画面録画（iPhone）に差し替え</PhTag>
    </AbsoluteFill>
  );
};

const fastForward = (t: number) => {
  const typing: [number, number][] = [[Q1() + 0.25, SEND1() - 0.1], [Q2() + 0.3, SEND2() - 0.1], [W(106.8), W(108.9)]];
  return Math.max(...typing.map(([a, b]) => win(t, a - 0.1, b + 0.25, 0.15)));
};

const StatusBar: React.FC<{ t: number }> = ({ t }) => (
  <div className="statusbar">
    <span>{t < W(113.3) ? "20:15" : t < at("n31", "今") ? "" : t < W(129.4) ? "10:00" : "15:00"}</span>
    <span className="icons">
      <i style={{ width: 18, height: 11 }} />
      <i style={{ width: 16, height: 11, borderRadius: 6 }} />
      <i style={{ width: 26, height: 12, borderRadius: 4 }} />
    </span>
  </div>
);

const Tap: React.FC<{ t: number }> = ({ t }) => {
  const hit = DEMO_TAPS().find(([tt]) => t >= tt - 0.25 && t <= tt + 0.5);
  if (!hit) return null;
  const [tt, x, y] = hit;
  const p1 = P(t, tt - 0.25, tt, EASE.out), p2 = P(t, tt, tt + 0.5, EASE.out);
  return (
    <>
      <div className="tap" style={{ left: x, top: y, opacity: p1 * (1 - p2), scale: (lerp(1.35, 1, p1) * lerp(1, 0.85, p2)).toFixed(3) }} />
      <div className="tap" style={{ left: x, top: y, background: "transparent", borderColor: "rgba(43,41,36,.35)", opacity: (1 - p2) * (t > tt ? 1 : 0), scale: lerp(1, 2.2, p2).toFixed(3) }} />
    </>
  );
};

// 紙（白紙／一歩まで／止まった）
const PaperScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = Math.max(win(t, W(93.9), W(96.7), 0.25), win(t, W(112.4), W(113.65), 0.25), win(t, at("n33", "紙") - 0.4, S("n34") + 0.2, 0.25));
  if (o <= 0) return null;
  const tFail = at("n33", "できなかった");
  const fill = (i: number) => {
    if (t > W(112) && t < W(114)) return i < 2 ? 1 : i < 6 ? P(t, W(112.6) + (i - 2) * 0.12, W(112.75) + (i - 2) * 0.12, EASE.lin) : 0;
    if (t > W(114)) return i < 6 ? 1 : P(t, tFail - 0.05, tFail + 0.1, EASE.lin);
    return 0;
  };
  const stopped = t > W(114) ? P(t, STOP_T() - 0.2, STOP_T() + 0.2, EASE.lin) : 0;
  const ps = t > W(114) ? P(t, STOP_T(), STOP_T() + 0.16, EASE.out) : 0;
  const pulse = t < W(97) ? win(t, W(95.0), W(96.6), 0.3) * (0.5 + 0.5 * Math.sin((t - W(95.0)) * 7)) : 0;
  return (
    <Screen o={o}>
      <div className="scr-head"><span className="chev">‹</span><span>新しい紙</span><span className="pill">1枚目</span></div>
      <div className="apaper" style={{ filter: stopped > 0 ? `saturate(${1 - 0.8 * stopped}) brightness(${1 - 0.08 * stopped})` : undefined }}>
        {FR.map((_, i) => (
          <Frame key={i} i={i} text={PAPER1[i]} fill={fill(i)} hand={i === 6} typedText={i === 6 ? (t > W(114) ? typed("できなかった", P(t, tFail, tFail + 0.6, EASE.lin)) : "") : undefined} />
        ))}
      </div>
      {pulse > 0 && <div style={{ position: "absolute", left: 74, right: 32, top: 172, height: 40, borderRadius: 10, border: `2px solid ${mix("#E1D9CB", "#3F8F8A", pulse)}` }} />}
      {ps > 0 && (
        <div className="stopped-tag" style={{ opacity: Math.min(1, ps * 2), translate: "-50% -50%", rotate: "-8deg", scale: lerp(1.7, 1, ps).toFixed(3) }}>紙なら、ここで終わり</div>
      )}
    </Screen>
  );
};

// 1 いま困っていること
const DumpScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = win(t, at("n27", "最初") - 0.2, W(106.75), 0.25);
  if (o <= 0) return null;
  const z = settle(t, at("n27", "最初") - 0.2, 0.55);
  let txt = spokenTyped(t, "n27", "企画書が進まない");
  if (t > SEND1()) txt = "企画書が進まない。何を書けばいいか分からない。";
  if (t > SEND2()) txt = spokenTyped(t, "n28", "何から書けばいいか分からず、最初の1行で止まる") + (t > atEnd("n28", "止まる") ? "。" : "");
  const extra = t > atEnd("n28", "止まる") + 0.1 ? typed(PROBLEM2, P(t, atEnd("n28", "止まる") + 0.1, atEnd("n28", "止まる") + 0.8, EASE.lin)) : "";
  let a = "";
  if (t < SEND1()) a = typed(A1, P(t, Q1() + 0.25, SEND1() - 0.1, EASE.lin));
  else if (t < SEND2()) a = typed(A2, P(t, Q2() + 0.3, SEND2() - 0.1, EASE.lin));
  const hl = P(t, at("n28", "最初の1行"), atEnd("n28", "止まる") + 0.2, EASE.io);
  return (
    <Screen o={o} style={{ scale: lerp(0.3, 1, z).toFixed(4), transformOrigin: "198px 185px" }}>
      <div className="scr-head"><span className="chev">‹</span><span>1 いま困っていること</span></div>
      <div className="card" style={{ top: 118 }}>
        <div className="lbl">{t > SEND1() ? "場面" : "そのまま書いて大丈夫"}</div>
        <div className="txt">
          {t > SEND2() ? (
            <>
              {txt.slice(0, 14)}
              {txt.length > 14 && (
                <Highlight progress={hl} color="rgba(222, 84, 64, 0.22)" iterations={1} padding={{ left: 2, right: 2, top: 1, bottom: 1 }}>
                  {txt.slice(14)}
                </Highlight>
              )}
            </>
          ) : (
            txt
          )}
          {extra && <><br />{extra}</>}
        </div>
      </div>
      <Bubble t={t} a={Q1()} b={SEND1()} dx={6} style={{ left: 22, top: 440 }}>何が一番困ってる？</Bubble>
      <Bubble t={t} a={Q2()} b={SEND2()} dx={8} style={{ left: 70, top: 440 }}>どこで手が止まる？</Bubble>
      <div className="input" style={{ top: 700, opacity: P(t, Q1(), Q1() + 0.3, EASE.lin) * (1 - P(t, SEND2(), SEND2() + 0.3, EASE.lin)) }}>{a}</div>
    </Screen>
  );
};

// 3 案を出す
const IdeasScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = win(t, W(106.55), W(112.65), 0.25);
  if (o <= 0) return null;
  let txt = "";
  for (const [str, a, b] of IDEAS) if (t >= a - 0.05 && t < b + 0.15) txt = typed(str, P(t, a, b, EASE.lin));
  let ball: React.ReactNode = null;
  IDEAS.forEach(([, , b], k) => {
    const f0 = b + 0.15, f1 = f0 + 0.45;
    if (t >= f0 && t <= f1) {
      const p = P(t, f0, f1, EASE.io);
      ball = <div className="ball" style={{ opacity: 1, translate: `${(lerp(330, 40, p) - 17).toFixed(1)}px ${(lerp(788, 251 + k * 60, p) - 150 * Math.sin(Math.PI * p) - 17).toFixed(1)}px` }} />;
    }
  });
  const tSel = at("n30", "土曜");
  const ps = settle(t, tSel + 0.35, 0.4);
  return (
    <Screen o={o} style={{ translate: `${(40 * (1 - settle(t, W(106.55), 0.4))).toFixed(1)}px 0px` }}>
      <div className="scr-head"><span className="chev">‹</span><span>3 案を出す</span></div>
      <div className="card" style={{ top: 116, padding: "12px 18px" }}>
        <div className="lbl" style={{ margin: 0 }}>目標</div>
        <div className="txt b">{GOAL}</div>
      </div>
      {IDEAS.map(([str], k) => {
        const pl = pop(t, IDEA_LAND(k), 12);
        return (
          <div key={k} className={`li${k === 0 && t > tSel + 0.05 ? " sel" : ""}`} style={{ top: 226 + k * 60, opacity: Math.min(1, pl * 2), scale: lerp(0.9, 1, pl).toFixed(4) }}>
            {str}
          </div>
        );
      })}
      {["5分だけなら、何をする？", "だれかに聞くなら？", "先に決められることは？"].map((q, k) => {
        const u = t - W(106.5);
        return (
          <div key={q} className="bubble" style={{ left: [30, 150, 60][k], top: [470, 560, 640][k], fontSize: 17, opacity: P(t, W(106.7) + k * 0.25, W(107.1) + k * 0.25, EASE.out), translate: `${(10 * Math.sin(u * 0.7 + k)).toFixed(1)}px ${(-16 * Math.sin(u * 0.9 + k * 1.7) - u * 5).toFixed(1)}px` }}>
            {q}
          </div>
        );
      })}
      <div className="input" style={{ top: 760 }}>{txt}</div>
      {ball}
      <div className="sheet-up" style={{ height: 380, translate: `0px ${(400 * (1 - ps)).toFixed(1)}px` }}>
        <div className="grab" />
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>一歩：土曜に、企画書を全部書く（3時間）</div>
        <div className="ev" style={{ opacity: 1 }}><span className="d">いつ</span><span className="s">{typed("土曜 10:00", P(t, tSel + 0.8, tSel + 1.0, EASE.lin))}</span></div>
        <div className="ev" style={{ opacity: 1 }}><span className="d">どこで</span><span className="s">{typed("自宅の机", P(t, tSel + 1.0, tSel + 1.15, EASE.lin))}</span></div>
        <div className="ev" style={{ opacity: 1 }}><span className="d" style={{ flexBasis: 96 }}>最初の2分</span><span className="s">{typed("企画書のファイルを開く", P(t, tSel + 1.15, tSel + 1.45, EASE.lin))}</span></div>
      </div>
    </Screen>
  );
};

const LockScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = win(t, W(113.4), at("n31", "今") + 0.05, 0.25);
  if (o <= 0) return null;
  const pn = settle(t, NOTIFY_T(), 0.45);
  return (
    <Screen o={o} id="scr-lock">
      <div className="lock-date">11月14日 土曜日</div>
      <div className="lock-time">10:00</div>
      <div className="notif" style={{ opacity: pn, translate: `0px ${(-140 * (1 - pn)).toFixed(1)}px` }}>
        <div className="app-ico" />
        <div style={{ flex: 1 }}>
          <div className="nt"><span>ポケット問題解決</span><span>いま</span></div>
          <div className="nh">今、どう？</div>
          <div className="nb">今日は「企画書を全部書く」日です</div>
        </div>
      </div>
    </Screen>
  );
};

const CheckScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = win(t, at("n31", "今") - 0.2, at("n33", "紙") - 0.2, 0.25);
  if (o <= 0) return null;
  const pressed = t > at("n32", "つけられ") + 0.35;
  return (
    <Screen o={o}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 170, textAlign: "center", fontSize: 46, fontWeight: 700 }}>今、どう？</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 240, textAlign: "center", fontSize: 18, color: "var(--ink-2)" }}>企画書を全部書く ・ 今日 10:00</div>
      <div className="btn" style={{ top: 420, opacity: 1 }}>やった</div>
      <div className="btn outline" style={{ top: 498, opacity: 1 }}>まだこれから</div>
      <div className="btn outline" style={{ top: 576, opacity: 1, background: pressed ? "#ECE6DB" : "#fff", borderColor: pressed ? "#9A9284" : "#D9D0C0" }}>できなかった</div>
    </Screen>
  );
};

// あなたの記録：Claude が紙を読む → 動けた時の条件
const RecordScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = win(t, S("n34") - 0.1, TAP_AGAIN() + 0.7, 0.25);
  if (o <= 0) return null;
  const r0 = at("n34", "これまでの紙") - 0.2, r1 = at("n34", "見つけて") - 0.1;
  const ev = settle(t, r0 + 0.1, 0.45) * (1 - P(t, S("n35") - 0.6, S("n35") - 0.25, EASE.io));
  const main = P(t, S("n35") - 0.35, S("n35") + 0.05, EASE.out);
  const ins = P(t, S("n35") - 0.15, S("n35") + 0.3, EASE.out);
  const hl = P(t, at("n35", "5分以内"), atEnd("n35", "5分以内") + 0.15, EASE.io);
  const ba = settle(t, En("n35") + 0.6, 0.4);
  return (
    <Screen o={o} style={{ translate: `0px ${(30 * (1 - settle(t, S("n34") - 0.1, 0.5))).toFixed(1)}px` }}>
      <div className="scr-head"><span className="chev">‹</span><span>あなたの記録</span></div>
      <div className="card" style={{ top: 116 }}>
        <div className="lbl">{t > r1 ? "これまでの紙 10枚を読みました" : "これまでの紙を読んでいます"}</div>
        <div className="mini-papers">
          {Array.from({ length: 10 }, (_, k) => (
            <i key={k} className={t > lerp(r0, r1, k / 9) ? "on" : ""} />
          ))}
        </div>
      </div>
      <div className="card" style={{ top: 262, opacity: main, translate: `0px ${(18 * (1 - main)).toFixed(1)}px` }}>
        <div className="lbl">あなたが動けた時の条件</div>
        <div className="big-insight" style={{ opacity: ins, translate: `0px ${(10 * (1 - ins)).toFixed(1)}px` }}>
          動けた時は、
          <br />
          一歩が
          <Highlight progress={hl} color="rgba(63, 143, 138, 0.3)" iterations={1} padding={{ left: 2, right: 2, top: 1, bottom: 1 }}>
            <span style={{ color: "var(--teal)" }}>5分以内</span>
          </Highlight>
          だった。
        </div>
      </div>
      <div className="btn red" style={{ top: 520, opacity: ba, translate: `0px ${(20 * (1 - ba)).toFixed(1)}px`, scale: t > TAP_AGAIN() && t < TAP_AGAIN() + 0.25 ? "0.96" : "1" }}>↻ これで、もう一度</div>
      <div className="sheet-up" style={{ height: 560, translate: `0px ${(600 * (1 - ev)).toFixed(1)}px` }}>
        <div className="grab" />
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>根拠：これまでの紙</div>
        {EVIDENCE.map(([d, s, ok], k) => (
          <div className="ev" key={d} style={{ opacity: P(t, r0 + 0.35 + k * 0.28, r0 + 0.55 + k * 0.28, EASE.lin) }}>
            <span className="d">{d}</span>
            <span className="s">{s}</span>
            <span className={`r ${ok ? "ok" : "ng"}`}>{ok ? "動けた" : "できなかった"}</span>
          </div>
        ))}
      </div>
    </Screen>
  );
};

// 前の紙に重ねて、もう一度 → 一歩を小さく → 動けた
const StackScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = t >= TAP_AGAIN() + 0.15 ? 1 : 0;
  if (o <= 0) return null;
  const pf = settle(t, STACK_T(), 0.9);
  const tSame = at("n37", "前の紙");
  const pc = pop(t, tSame, 11);
  // 下書きのシート
  const sh = settle(t, S("n38") - 0.2, 0.5) * (1 - P(t, TAP_GO() + 0.2, TAP_GO() + 0.6, EASE.io));
  const tSmall = at("n38", "小さく");
  const arrow = P(t, tSmall - 0.3, tSmall + 0.05, EASE.out);
  const draft = pop(t, tSmall, 12);
  const circ = P(t, at("n39", "3つだけ"), atEnd("n39", "3つだけ") + 0.3, EASE.io);
  const go = settle(t, En("n39") - 0.3, 0.35);
  const updated = t > TAP_GO() + 0.3;
  // 動けた
  const ck = settle(t, W(143.1), 0.4) * (1 - P(t, W(144.3), W(144.7), EASE.io));
  const glow = P(t, W(145.0), W(146.2), EASE.io);
  const fill7 = P(t, DONE_T, DONE_T + 0.4, EASE.lin);
  const push = settle(t, TAP_AGAIN() + 0.15, 0.45); // 記録の画面を押し出して入る
  return (
    <Screen o={Math.max(o, push > 0 ? 1 : 0)} style={{ translate: `${(396 * (1 - push)).toFixed(1)}px 0px`, boxShadow: push < 1 ? "-12px 0 30px rgba(0,0,0,.12)" : undefined }}>
      <div className="scr-head"><span className="chev">‹</span><span>月曜までに企画書を出す</span></div>
      <div className="stack-paper back" style={{ translate: "14px -20px", rotate: "2.6deg" }}>
        {FR.map((_, i) => <Frame key={i} i={i} text={PAPER1[i]} fill={i < 6 ? 1 : 1} hand={i === 6} typedText={i === 6 ? "できなかった" : undefined} />)}
      </div>
      <div className="back-tab" style={{ left: 40, top: 104, opacity: P(t, STACK_T(), STACK_T() + 0.4, EASE.lin) }}>1枚目 ・ 11/14</div>
      <div className="stack-paper" style={{ translate: `0px ${lerp(-760, 8, pf).toFixed(1)}px`, rotate: `${lerp(-4, 0, pf).toFixed(2)}deg`, background: mix("#FFFFFF", "#FFF4DA", glow), boxShadow: `0 0 0 ${(5 * glow).toFixed(1)}px rgba(240,190,94,${(0.6 * glow).toFixed(2)}), 0 6px 20px rgba(60,40,10,.14), 0 0 ${(40 * glow).toFixed(0)}px rgba(240,190,94,${(0.45 * glow).toFixed(2)})` }}>
        {FR.map((_, i) => (
          <Frame
            key={i}
            i={i}
            text={i === 3 ? (updated ? NEW_STEP : PAPER1[3]) : PAPER2[i]}
            fill={i < 3 ? 1 : i < 6 ? (updated ? 1 : i === 3 ? 0.35 : 0) : fill7}
            cls={i < 3 && t > tSame + 0.3 ? "carry" : i === 3 && updated ? "new" : undefined}
            typedText={i === 6 ? typed(PAPER2[6], P(t, DONE_T, DONE_T + 0.7, EASE.lin)) : undefined}
          />
        ))}
      </div>
      <div className="count-pill" style={{ right: 30, top: 112, opacity: Math.min(1, pc * 2), scale: pc.toFixed(4) }}>2枚目</div>
      <Sparkles t={t} />
      {sh > 0 && (
        <div className="sheet-up" style={{ height: 560, translate: `0px ${(600 * (1 - sh)).toFixed(1)}px` }}>
          <div className="grab" />
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>もう一度：前の一歩を、小さく</div>
          <div className="again-blk old" style={{ position: "relative", left: 0, right: 0, opacity: 1 }}>
            <div className="lbl">前回の一歩</div>
            <div className="txt">土曜に、企画書を全部書く（3時間）</div>
          </div>
          <div style={{ position: "relative", height: 56 }}>
            <div className="arrow-down" style={{ top: 6, height: 30 * arrow, opacity: Math.min(1, arrow * 3) }} />
          </div>
          <div className="again-blk draft" style={{ position: "relative", left: 0, right: 0, opacity: Math.min(1, draft * 2), scale: lerp(0.92, 1, draft).toFixed(4) }}>
            <div className="lbl" style={{ color: "var(--accent)" }}>小さくした下書き</div>
            <div className="txt">
              見出しを
              <Circle progress={circ} color="#DE5440" strokeWidth={2.5} iterations={1} padding={{ left: 6, right: 6, top: 4, bottom: 4 }}>
                3つだけ
              </Circle>
              書く（5分）
            </div>
          </div>
          <div className="btn" style={{ position: "absolute", left: 18, right: 18, top: 445, opacity: go, scale: t > TAP_GO() && t < TAP_GO() + 0.25 ? "0.96" : "1" }}>この一歩でいく</div>
        </div>
      )}
      <div className="sheet-up" style={{ height: 300, translate: `0px ${(320 * (1 - ck)).toFixed(1)}px` }}>
        <div className="grab" />
        <div style={{ textAlign: "center", fontSize: 30, fontWeight: 700, margin: "8px 0 22px" }}>今、どう？</div>
        <div className="btn" style={{ position: "relative", left: 0, right: 0, opacity: 1, scale: t > W(144.0) && t < W(144.25) ? "0.96" : "1" }}>やった</div>
      </div>
    </Screen>
  );
};

/** 動けた瞬間に、紙のまわりで小さく光る */
const Sparkles: React.FC<{ t: number }> = ({ t }) => {
  const a = W(145.1);
  if (t < a || t > a + 1.6) return null;
  const pts: [number, number, number][] = [[60, 160, 0], [330, 190, 0.1], [40, 520, 0.2], [350, 600, 0.05], [200, 140, 0.15], [330, 780, 0.25]];
  return (
    <>
      {pts.map(([x, y, d], k) => {
        const p = P(t, a + d, a + d + 1.0, EASE.out);
        const s = Math.sin(Math.PI * p);
        return (
          <svg key={k} width="28" height="28" viewBox="-14 -14 28 28" style={{ position: "absolute", left: x, top: y, opacity: s, scale: (0.4 + 0.8 * s).toFixed(3), rotate: `${(40 * p).toFixed(1)}deg` }}>
            <path d="M0 -13 L3 -3 L13 0 L3 3 L0 13 L-3 3 L-13 0 L-3 -3 Z" fill="#F0BE5E" />
          </svg>
        );
      })}
    </>
  );
};
