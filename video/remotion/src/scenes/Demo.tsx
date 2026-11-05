// ⑤ デモ：同じ困りごとを最後まで（書く → 決める → 止まる → もう一度 → 動けた）
import React from "react";
import { Circle, Highlight } from "@remotion/rough-notation";
import { AbsoluteFill } from "remotion";
import { PhTag, SceneProps, useT } from "../components/common";
import { at, atEnd, camAt, clamp, EASE, En, lerp, mix, P, pop, S, settle, typed, win } from "../lib/time";

// ---- 中身（ダミー） ----
const FR = ["いま困っていること", "目標", "案を出す", "一歩を決める", "いつ・どこで", "最初の2分", "やってみた"];
const PAPER1 = ["封筒を開けるところで止まる。全部いっぺんに書こうとする。", "住所変更の書類を出す", "全部書く／封筒だけ出す／窓口で書く",
  "週末に、書類を全部書く（30分）", "土曜 10:00 ・ リビングの机", "封筒を開ける", ""];
const PAPER2 = [PAPER1[0], PAPER1[1], PAPER1[2], "書類を机に出して、名前だけ書く（2分）", "今日 21:00 ・ リビングの机", "封筒を開ける",
  "名前を書いたら、そのまま最後まで書けた"];
const DUMP = "住所変更の書類が出せない。もう2週間。";
const SC1 = "封筒を開けるところで止まる。";
const SC2 = "全部いっぺんに書こうとして、手が止まる。";
const A1 = "封筒を開けるところ。中を見るのがしんどい";
const A2 = "全部いっぺんに書かなきゃと思う";
const GOAL = "住所変更の書類を出す";
const IDEAS: [string, number, number][] = [["週末に、書類を全部書く（30分）", 93.7, 94.4], ["封筒だけ机に出す", 95.1, 95.5], ["窓口でいっしょに書いてもらう", 96.2, 96.6]];
const EVIDENCE: [string, string, boolean][] = [["10/03", "一歩 3分", true], ["10/08", "一歩 30分", false], ["10/12", "一歩 5分", true], ["10/17", "一歩 1時間", false], ["10/21", "一歩 2分", true], ["10/24", "一歩 5分", true], ["10/31", "一歩 30分", false]];
const STAGES: [string, string, number, number, string][] = [
  ["書く", "困りごとを、そのまま", 60, 93.0, "#2E7672"],
  ["決める", "案を出して、最初の一歩", 93.0, 102.0, "#2E7672"],
  ["止まる", "できなかった日", 102.0, 120.4, "#DE5440"],
  ["もう一度", "同じ紙で、一歩を小さく", 120.4, 138.2, "#DE5440"],
  ["動けた", "2回目の挑戦で", 138.2, 200, "#2E7672"],
];

// ---- 時刻（効果音からも使う） ----
export const Q1 = () => S("n23") + 0.1;
export const SEND1 = () => Q1() + 2.35;
export const Q2 = () => SEND1() + 0.65;
export const SEND2 = () => Q2() + 2.05;
export const IDEA_LAND = (k: number) => IDEAS[k][2] + 0.15 + 0.45;
export const DEMO_TAPS = (): [number, number, number][] => [
  [91.0, 198, 803], [97.3, 120, 251], [102.2, 198, 330], [at("n27", "できません"), 198, 607],
  [120.95, 198, 551], [130.1, 198, 771], [139.3, 198, 686],
];
export const NOTIFY_T = 101.1;
export const STOP_T = () => at("n28", "ここで") - 0.2;
export const STACK_T = 130.6;
export const DONE_T = 140.1;

const PY = (sy: number) => 20 + 1.18 * (12 + sy); // スマホ画面の y → ステージの y
const REST: [number, number, number] = [560, 520, 1];

// ---- 部品 ----
const Frame: React.FC<{ i: number; text: string; fill: number; cls?: string; typedText?: string }> = ({ i, text, fill, cls, typedText }) => (
  <div className={`frame${fill > 0.5 ? " on" : ""}${cls ? " " + cls : ""}`}>
    <div className="fn">{i + 1}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="fl">{FR[i]}</div>
      <div className="fc" style={{ opacity: fill }}>{typedText ?? text}</div>
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
  const pu = settle(t, a, 0.7);
  const pp = P(t, b, b + 0.3, EASE.out);
  return (
    <div className="bubble" style={{ ...style, opacity: Math.min(1, pu * 1.4) * (1 - pp), translate: `${(dx * Math.sin((t - a) * 1.3)).toFixed(1)}px ${(120 * (1 - pu) + 6 * Math.sin((t - a) * 2.1)).toFixed(1)}px`, scale: (1 + 0.15 * pp).toFixed(3) }}>
      {children}
    </div>
  );
};

export const Demo: React.FC<SceneProps> = ({ from }) => {
  const t = useT(from);
  const cam = camAt([
    [76.9, ...REST], [SEND1() - 0.3, ...REST], [SEND1() + 0.5, 508, 430, 1.3], [SEND2() + 0.6, 508, 430, 1.3], [SEND2() + 1.3, ...REST],
    [S("n30") - 0.6, ...REST], [S("n30") + 0.1, 508, 400, 1.5], [En("n30") + 0.2, 508, 400, 1.5], [En("n30") + 0.8, ...REST],
    [126.8, ...REST], [127.5, 508, 560, 1.45], [130.0, 508, 560, 1.45], [130.6, ...REST], [150, ...REST],
  ], t);
  const zoom = clamp((cam.s - 1) / 0.25);
  const pin = settle(t, 76.9, 0.7);

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
            <AgainScreen t={t} />
            <StackScreen t={t} />
            <Tap t={t} />
          </div>
          <div className="island" />
        </div>
        <div className="clabel" style={{ top: PY(480) - 40, ...label(S("n23") - 0.1, 91.0) }}><i /><small>Claude</small>問いかける</div>
        <div className="clabel" style={{ top: PY(160) - 40, ...label(at("n29", "Claudeが") - 0.1, 119.6) }}><i /><small>Claude</small>これまでの紙を読む</div>
        <div className="clabel" style={{ top: PY(470) - 40, ...label(at("n32", "自分の言葉") - 0.25, 130.4) }}><i /><small>Claude</small>あなたの言葉のまま、小さくする</div>
        <div id="rail" style={{ opacity: 1 - zoom }}>
          <div className="eyebrow">一つの困りごとを、最後まで</div>
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
        <div className="rnote" style={{ opacity: win(t, 140.1, 145, 0.3) * (1 - zoom) }}>実際にやれた場合だけ使う一文</div>
      </div>
      <div className="ff-chip" style={{ left: 770, top: 34, opacity: fastForward(t) }}>▶▶ 早送り</div>
      <PhTag label="仮画面" right opacity={P(t, 77.4, 77.9)}>アプリの画面録画（iPhone）に差し替え</PhTag>
    </AbsoluteFill>
  );
};

const fastForward = (t: number) => {
  const typing: [number, number][] = [[80.3, 82.6], [Q1() + 1.1, SEND1() - 0.15], [Q2() + 1.0, SEND2() - 0.15], [91.5, 92.1], [93.7, 96.6]];
  return Math.max(...typing.map(([a, b]) => win(t, a - 0.1, b + 0.25, 0.15)));
};

const StatusBar: React.FC<{ t: number }> = ({ t }) => (
  <div className="statusbar">
    <span>{t < 100.7 ? "20:15" : t < 102.4 ? "" : t < 120.4 ? "10:00" : "21:00"}</span>
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

// 紙（白紙／目標まで／一歩まで／止まった）
const PaperScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = Math.max(win(t, 76.9, 79.95, 0.25), win(t, 92.4, 93.35, 0.25), win(t, 99.2, 100.95, 0.25), win(t, 104.8, 107.6, 0.25));
  if (o <= 0) return null;
  const fill = (i: number) => {
    if (t > 92 && t < 94) return i === 0 ? 1 : i === 1 ? P(t, 92.6, 92.8, EASE.lin) : 0;
    if (t > 99 && t < 101) return i < 2 ? 1 : i < 6 ? P(t, 99.4 + (i - 2) * 0.12, 99.55 + (i - 2) * 0.12, EASE.lin) : 0;
    if (t > 104) return i < 6 ? 1 : 0;
    return 0;
  };
  const stopped = t > 104 ? P(t, STOP_T() - 0.2, STOP_T() + 0.2, EASE.lin) : 0;
  const ps = t > 104 ? P(t, STOP_T(), STOP_T() + 0.16, EASE.out) : 0;
  const pulse = t < 80 ? win(t, 78.4, 79.8, 0.3) * (0.5 + 0.5 * Math.sin((t - 78.4) * 7)) : 0;
  return (
    <Screen o={o}>
      <div className="scr-head"><span className="chev">‹</span><span>新しい紙</span><span className="pill">1回目</span></div>
      <div className="apaper" style={{ filter: stopped > 0 ? `saturate(${1 - 0.8 * stopped}) brightness(${1 - 0.08 * stopped})` : undefined }}>
        {FR.map((_, i) => (
          <Frame key={i} i={i} text={PAPER1[i]} fill={fill(i)} />
        ))}
      </div>
      {pulse > 0 && <div style={{ position: "absolute", left: 74, right: 32, top: 172, height: 40, borderRadius: 10, border: `2px solid ${mix("#E1D9CB", "#3F8F8A", pulse)}` }} />}
      {ps > 0 && (
        <div className="stopped-tag" style={{ opacity: Math.min(1, ps * 2), translate: "-50% -50%", rotate: "-8deg", scale: lerp(1.7, 1, ps).toFixed(3) }}>ここで止まる</div>
      )}
    </Screen>
  );
};

// 1 いま困っていること
const DumpScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = win(t, 79.5, 92.7, 0.25);
  if (o <= 0) return null;
  const z = settle(t, 79.5, 0.55);
  let txt = typed(DUMP, P(t, 80.3, 82.6, EASE.lin));
  if (t > SEND1()) txt = DUMP + typed(SC1, P(t, SEND1(), SEND1() + 0.55, EASE.lin));
  if (t > SEND2()) txt = DUMP + SC1 + typed(SC2, P(t, SEND2(), SEND2() + 0.65, EASE.lin));
  let a = "";
  if (t < SEND1()) a = typed(A1, P(t, Q1() + 1.1, SEND1() - 0.15, EASE.lin));
  else if (t < SEND2()) a = typed(A2, P(t, Q2() + 1.0, SEND2() - 0.15, EASE.lin));
  const bg = settle(t, 90.4, 0.4);
  const gs = settle(t, 91.15, 0.35) * (1 - P(t, 92.15, 92.45, EASE.io));
  return (
    <Screen o={o} style={{ scale: lerp(0.3, 1, z).toFixed(4), transformOrigin: "198px 185px" }}>
      <div className="scr-head"><span className="chev">‹</span><span>1 いま困っていること</span></div>
      <div className="card" style={{ top: 118 }}>
        <div className="lbl">{t > SEND1() ? "場面" : "そのまま書いて大丈夫"}</div>
        <div className="txt">{txt}</div>
      </div>
      <Bubble t={t} a={Q1()} b={SEND1()} dx={6} style={{ left: 22, top: 450 }}>最後に手が止まったのはどこ？</Bubble>
      <Bubble t={t} a={Q2()} b={SEND2()} dx={8} style={{ left: 60, top: 450 }}>そのとき、何がいちばん重かった？</Bubble>
      <div className="input" style={{ top: 700, opacity: P(t, Q1() + 0.1, Q1() + 0.4, EASE.lin) * (1 - P(t, 90.1, 90.4, EASE.lin)) }}>{a}</div>
      <div className="btn" style={{ top: 772, opacity: bg, translate: `0px ${(20 * (1 - bg)).toFixed(1)}px`, scale: t > 90.95 && t < 91.2 ? "0.96" : "1" }}>目標を思いついた</div>
      <div className="sheet-up" style={{ height: 300, translate: `0px ${(320 * (1 - gs)).toFixed(1)}px` }}>
        <div className="grab" />
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>2 目標</div>
        <div className="input" style={{ position: "relative", left: 0, right: 0 }}>{typed(GOAL, P(t, 91.5, 92.1, EASE.lin))}</div>
      </div>
    </Screen>
  );
};

// 3 案を出す
const IdeasScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = win(t, 93.1, 99.45, 0.25);
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
  const ps = settle(t, 97.6, 0.4);
  return (
    <Screen o={o} style={{ translate: `${(40 * (1 - settle(t, 93.1, 0.4))).toFixed(1)}px 0px` }}>
      <div className="scr-head"><span className="chev">‹</span><span>3 案を出す</span></div>
      <div className="card" style={{ top: 116, padding: "12px 18px" }}>
        <div className="lbl" style={{ margin: 0 }}>目標</div>
        <div className="txt b">住所変更の書類を出す</div>
      </div>
      {IDEAS.map(([str], k) => {
        const pl = pop(t, IDEA_LAND(k), 12);
        return (
          <div key={k} className={`li${k === 0 && t > 97.35 ? " sel" : ""}`} style={{ top: 226 + k * 60, opacity: Math.min(1, pl * 2), scale: lerp(0.9, 1, pl).toFixed(4) }}>
            {str}
          </div>
        );
      })}
      {["5分だけなら、何をする？", "だれかに頼むなら？", "場所を変えるなら？"].map((q, k) => {
        const u = t - 93;
        return (
          <div key={q} className="bubble" style={{ left: [30, 150, 60][k], top: [470, 560, 640][k], fontSize: 17, opacity: P(t, 93.3 + k * 0.3, 93.8 + k * 0.3, EASE.out), translate: `${(10 * Math.sin(u * 0.7 + k)).toFixed(1)}px ${(-16 * Math.sin(u * 0.9 + k * 1.7) - u * 5).toFixed(1)}px` }}>
            {q}
          </div>
        );
      })}
      <div className="input" style={{ top: 760 }}>{txt}</div>
      {ball}
      <div className="sheet-up" style={{ height: 380, translate: `0px ${(400 * (1 - ps)).toFixed(1)}px` }}>
        <div className="grab" />
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>一歩：週末に、書類を全部書く</div>
        <div className="ev"><span className="d">いつ</span><span className="s">{typed("土曜 10:00", P(t, 98.0, 98.2, EASE.lin))}</span></div>
        <div className="ev"><span className="d">どこで</span><span className="s">{typed("リビングの机", P(t, 98.2, 98.4, EASE.lin))}</span></div>
        <div className="ev"><span className="d" style={{ flexBasis: 96 }}>最初の2分</span><span className="s">{typed("封筒を開ける", P(t, 98.4, 98.65, EASE.lin))}</span></div>
      </div>
    </Screen>
  );
};

const LockScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = win(t, 100.7, 102.6, 0.25);
  if (o <= 0) return null;
  const pn = settle(t, NOTIFY_T, 0.45);
  return (
    <Screen o={o} id="scr-lock">
      <div className="lock-date">10月31日 土曜日</div>
      <div className="lock-time">10:00</div>
      <div className="notif" style={{ opacity: pn, translate: `0px ${(-140 * (1 - pn)).toFixed(1)}px`, scale: t > 102.15 && t < 102.4 ? "0.97" : "1" }}>
        <div className="app-ico" />
        <div style={{ flex: 1 }}>
          <div className="nt"><span>【アプリ名】</span><span>いま</span></div>
          <div className="nh">今、どう？</div>
          <div className="nb">今日は「書類を全部書く」の日です</div>
        </div>
      </div>
    </Screen>
  );
};

const CheckScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = win(t, 102.35, 105.0, 0.25);
  if (o <= 0) return null;
  const pressed = t > at("n27", "できません") + 0.05;
  return (
    <Screen o={o}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 170, textAlign: "center", fontSize: 46, fontWeight: 700 }}>今、どう？</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 240, textAlign: "center", fontSize: 18, color: "var(--ink-2)" }}>書類を全部書く ・ 土曜 10:00</div>
      <div className="btn" style={{ top: 420 }}>やった</div>
      <div className="btn outline" style={{ top: 498 }}>まだこれから</div>
      <div className="btn outline" style={{ top: 576, background: pressed ? "#ECE6DB" : "#fff", borderColor: pressed ? "#9A9284" : "#D9D0C0" }}>できなかった</div>
    </Screen>
  );
};

// あなたの記録：Claude が紙を読む → 動けた時の条件
const RecordScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = win(t, 107.3, 121.4, 0.25);
  if (o <= 0) return null;
  const r0 = at("n29", "これまでの紙") - 0.2, r1 = at("n29", "動けた時") - 0.2;
  const ev = settle(t, r0 + 0.1, 0.45) * (1 - P(t, S("n30") - 0.7, S("n30") - 0.3, EASE.io));
  const main = P(t, S("n30") - 0.35, S("n30") + 0.05, EASE.out);
  const ins = P(t, S("n30") - 0.15, S("n30") + 0.3, EASE.out);
  const hl = P(t, at("n30", "5分以内"), atEnd("n30", "5分以内") + 0.15, EASE.io);
  const ba = settle(t, En("n30") + 0.9, 0.4);
  const pulse = win(t, En("n30") + 1.4, 120.5, 0.2) * Math.sin((t - En("n30")) * 8);
  return (
    <Screen o={o} style={{ translate: `0px ${(30 * (1 - settle(t, 107.3, 0.5))).toFixed(1)}px` }}>
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
          一歩が
          <Highlight progress={hl} color="rgba(63, 143, 138, 0.3)" iterations={1} padding={{ left: 2, right: 2, top: 1, bottom: 1 }}>
            <span style={{ color: "var(--teal)" }}>5分以内</span>
          </Highlight>
          の時は、
          <br />
          動けていた。
        </div>
      </div>
      <div className="btn red" style={{ top: 520, opacity: ba, translate: `0px ${(20 * (1 - ba)).toFixed(1)}px`, scale: ((1 + 0.025 * pulse) * (t > 120.95 && t < 121.2 ? 0.96 : 1)).toFixed(4) }}>↻ この紙で、もう一度</div>
      <div className="sheet-up" style={{ height: 560, translate: `0px ${(600 * (1 - ev)).toFixed(1)}px` }}>
        <div className="grab" />
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>根拠：これまでの紙</div>
        {EVIDENCE.map(([d, s, ok], k) => (
          <div className="ev" key={d} style={{ opacity: P(t, r0 + 0.4 + k * 0.32, r0 + 0.6 + k * 0.32, EASE.lin) }}>
            <span className="d">{d}</span>
            <span className="s">{s}</span>
            <span className={`r ${ok ? "ok" : "ng"}`}>{ok ? "動けた" : "できなかった"}</span>
          </div>
        ))}
      </div>
    </Screen>
  );
};

// もう一度（下書き）
const AgainScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = win(t, 121.3, 130.6, 0.25);
  if (o <= 0) return null;
  const a1 = P(t, 121.6, 122.0, EASE.out);
  const a2 = P(t, S("n32") - 0.1, S("n32") + 0.3, EASE.out);
  const tA = at("n32", "小さくした") - 0.3;
  const pa = P(t, tA, tA + 0.35, EASE.out);
  const pd = pop(t, at("n32", "下書き") - 0.25, 12);
  const kw = t > S("n33");
  const circ = P(t, at("n33", "名前だけ"), atEnd("n33", "名前だけ") + 0.3, EASE.io);
  const pg = settle(t, 129.4, 0.35);
  return (
    <Screen o={o} style={{ translate: `${(40 * (1 - settle(t, 121.3, 0.4))).toFixed(1)}px 0px` }}>
      <div className="scr-head"><span className="chev">‹</span><span>もう一度</span><span className="pill" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>下書き</span></div>
      <div className="again-blk" style={{ top: 116, opacity: a1, translate: `0px ${(18 * (1 - a1)).toFixed(1)}px` }}><div className="lbl">目標（あなたが書いた言葉）</div><div className="txt">住所変更の書類を出す</div></div>
      <div className="again-blk old" style={{ top: 236, opacity: a2, translate: `0px ${(18 * (1 - a2)).toFixed(1)}px` }}>
        <div className="lbl">前回の一歩</div>
        <div className="txt">週末に、<span className={kw ? "kw" : ""}>書類</span>を全部<span className={kw ? "kw" : ""}>書く</span>（30分）</div>
      </div>
      <div className="arrow-down" style={{ top: 352, height: 40 * pa, opacity: Math.min(1, pa * 3) }} />
      <div className="again-blk draft" style={{ top: 416, opacity: Math.min(1, pd * 2), scale: lerp(0.92, 1, pd).toFixed(4) }}>
        <div className="lbl" style={{ color: "var(--accent)" }}>小さくした下書き</div>
        <div className="txt">
          <span className={kw ? "kw" : ""}>書類</span>を机に出して、
          <Circle progress={circ} color="#DE5440" strokeWidth={2.5} iterations={1} padding={{ left: 6, right: 6, top: 4, bottom: 4 }}>
            名前だけ
          </Circle>
          <span className={kw ? "kw" : ""}>書く</span>（2分）
        </div>
      </div>
      <div className="btn" style={{ top: 740, opacity: pg, translate: `0px ${(20 * (1 - pg)).toFixed(1)}px`, scale: t > 130.05 && t < 130.3 ? "0.96" : "1" }}>この一歩でいく</div>
    </Screen>
  );
};

// 重なる紙 → 動けた
const StackScreen: React.FC<{ t: number }> = ({ t }) => {
  const o = win(t, 130.4, 146, 0.25);
  if (o <= 0) return null;
  const pf = settle(t, STACK_T, 0.9);
  const tCarry = at("n34", "前の紙") - 0.2;
  const pc = pop(t, at("n34", "重なります") - 0.15, 11);
  const ck = settle(t, 138.3, 0.4) * (1 - P(t, 139.6, 140.0, EASE.io));
  const glow = P(t, 140.3, 141.5, EASE.io);
  const fill7 = P(t, DONE_T, DONE_T + 0.4, EASE.lin);
  return (
    <Screen o={o}>
      <div className="scr-head"><span className="chev">‹</span><span>住所変更の書類を出す</span></div>
      <div className="stack-paper back" style={{ translate: "14px -20px", rotate: "2.6deg" }}>
        {FR.map((_, i) => <Frame key={i} i={i} text={PAPER1[i]} fill={i < 6 ? 1 : 0} />)}
      </div>
      <div className="back-tab" style={{ left: 40, top: 104, opacity: P(t, 130.5, 130.9, EASE.lin) }}>1回目 ・ 10/31</div>
      <div className="stack-paper" style={{ translate: `0px ${lerp(-760, 8, pf).toFixed(1)}px`, rotate: `${lerp(-4, 0, pf).toFixed(2)}deg`, background: mix("#FFFFFF", "#FFF4DA", glow), boxShadow: `0 0 0 ${(5 * glow).toFixed(1)}px rgba(240,190,94,${(0.6 * glow).toFixed(2)}), 0 6px 20px rgba(60,40,10,.14), 0 0 ${(40 * glow).toFixed(0)}px rgba(240,190,94,${(0.45 * glow).toFixed(2)})` }}>
        {FR.map((_, i) => (
          <Frame
            key={i}
            i={i}
            text={PAPER2[i]}
            fill={i < 6 ? 1 : fill7}
            cls={i < 3 && t > tCarry ? "carry" : i === 3 ? "new" : undefined}
            typedText={i === 6 ? typed(PAPER2[6], P(t, DONE_T, DONE_T + 0.7, EASE.lin)) : undefined}
          />
        ))}
      </div>
      <div className="count-pill" style={{ right: 30, top: 112, opacity: Math.min(1, pc * 2), scale: pc.toFixed(4) }}>2回目の挑戦</div>
      <Sparkles t={t} />
      <div className="sheet-up" style={{ height: 300, translate: `0px ${(320 * (1 - ck)).toFixed(1)}px` }}>
        <div className="grab" />
        <div style={{ textAlign: "center", fontSize: 30, fontWeight: 700, margin: "8px 0 22px" }}>今、どう？</div>
        <div className="btn" style={{ position: "relative", left: 0, right: 0, opacity: 1, scale: t > 139.25 && t < 139.5 ? "0.96" : "1" }}>やった</div>
      </div>
    </Screen>
  );
};

/** 動けた瞬間に、紙のまわりで小さく光る */
const Sparkles: React.FC<{ t: number }> = ({ t }) => {
  const a = 140.4;
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
