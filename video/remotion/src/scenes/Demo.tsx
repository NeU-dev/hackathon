// ⑤ デモ：止まった企画書が、もう一度動くまで（書く → 決める → 止まる → もう一度 → 動けた）
// スマホの中は、アプリ（モック）を iPhone と同じ大きさで操作して撮った画面録画（public/mockrec）。
// 録画は video/mockrec/record_demo.cjs、ナレーションとの対応はこのファイルの TRACK_A / TRACK_B。
import React from "react";
import { AbsoluteFill } from "remotion";
import { useT, SceneProps } from "../components/common";
import { HomeBar, Keyboard, LockScreen, MockFrame, SCR_H, SCR_W, StatusBar, Touches } from "../components/MockPhone";
import { ffSpans, frameAt, K, mk, RECS, timeOf, track } from "../lib/mockrec";
import { at, atEnd, camAt, clamp, EASE, En, lerp, P, pop, S, settle, typed, win } from "../lib/time";
import { W } from "../lib/warp";

const STAGES: [string, string, number, number, string][] = [
  ["書く", "困りごとを、そのまま", 60, W(106.5), "#2E7672"],
  ["決める", "案を出して、最初の一歩", W(106.5), W(113.0), "#2E7672"],
  ["止まる", "できなかった日", W(113.0), W(129.4), "#DE5440"],
  ["もう一度", "前の紙に重ねて、一歩を小さく", W(129.4), W(143.0), "#DE5440"],
  ["動けた", "2枚目の紙で", W(143.0), 200, "#2E7672"],
];

// ---- 録画の中のコマ ----
const a = (n: string, o = 0) => mk("A", n, o);
const b = (n: string, o = 0) => mk("B", n, o);
const tapB = (k: number) => RECS.B.taps.filter((x) => x.kind === "tap")[k].f; // B の k 番目のタップ
const swipeB = (k: number) => RECS.B.taps.filter((x) => x.kind === "swipe")[k];
const keysA = RECS.A.keys;
/** B で映さないタップ（引き出しで紙を開く・アプリの中の通知を押す＝ロック画面の通知に置きかえた）と、動かなかった2回目のスクロール */
const SKIP_B = () => [RECS.B.taps[0].f, tapB(1), tapB(6), swipeB(1).f];

// ---- 場面の切り替え（秒） ----
const T_AB = 117.05; // ①②を書いた → 次の日に、続きを書いた紙
const SLEEP1 = 122.95; // 画面を消す → 土曜の朝
const WAKE1 = SLEEP1 + 0.3;
export const NOTIFY1 = () => at("n31", "アプリが聞きます") - 0.1;
const TAP1 = () => at("n31", "今") - 0.42;
const SLEEP2 = W(143.0) - 0.35; // 2枚目の紙を書いた → 日曜の朝
const WAKE2 = SLEEP2 + 0.25;
export const NOTIFY2 = () => WAKE2 + 0.12;
const TAP2 = () => WAKE2 + 0.62;
const OPEN = 0.36; // 通知を押して、アプリが開くまで

// 録画 A：白紙の紙に ①いま困っていること・②どんな場面か を書く
const TRACK_A = () =>
  track("A", [
    [103.4, 0],
    [104.62, a("new_tap", -1)], // 「新しい紙」
    [106.1, a("f1_tap", -1)], // ① を開く
    [at("n27", "企") - 0.03, keysA[0].f], // 「企画書が進まない」と打つ（話すのに合わせて）
    [at("n27", "」") + 0.02, keysA[7].f + 3],
    [110.35, a("f2_tap", -1)], // 追加 → 書けた → ② を開く
    [113.25, a("scene", -25)], // 問い（泡）に答えるうちに、場面の一文ができる（ここは早送り）
    [T_AB + 0.4, a("end", -1)],
  ]);

// 録画 B：続きを書いた紙 → 土曜の朝の「今、どう？」→ できなかった → もう一度 → 日曜の朝に、やった
const TRACK_B = () => {
  const sw = swipeB(0);
  return track("B", [
    [T_AB - 0.1, b("paper", -4)],
    [S("n29") - 0.05, sw.f], // 案を出して…（下へ送る）
    [S("n29") + 0.85, (sw.f1 ?? sw.f) + 2],
    [SLEEP1 + 0.2, b("decided")],
    [TAP1(), tapB(1) + 13], // 通知を押した所から（今、どう？）
    [at("n32", "つけられ") + 0.18, tapB(2)], // できなかった
    [at("n32", "つけられ") + 0.3, b("loading")],
    [at("n34", "見つけて") - 0.4, b("loading_end")], // Claude が記録を読むあいだ
    [at("n34", "見つけて") + 0.05, b("loading_end", 12)],
    [at("n36", "もう一度") + 0.05, tapB(3)], // これで、もう一度
    [at("n37", "白紙") + 0.15, tapB(4)], // 手がつけられなかった
    [at("n37", "重ねて") + 0.5, b("stack")], // 2枚目の紙が重なり、⑥へ
    [En("n39") - 0.2, tapB(5)], // 書けた
    [SLEEP2 + 0.2, b("kakeda", 40)],
    [TAP2(), tapB(6) + 15], // 日曜の朝：今、どう？
    [TAP2() + 0.75, tapB(7)], // やった
    [TAP2() + 2.0, tapB(7) + 40], // できた・ひとこと
    [160, b("end", -1)],
  ]);
};

let cache: { A: ReturnType<typeof track>; B: ReturnType<typeof track> } | null = null;
const tracks = () => (cache ??= { A: TRACK_A(), B: TRACK_B() });

/** 録画の点（CSS px）→ ステージの点（カメラの寄り先・ラベルの位置） */
const PX = (x: number) => 260 + 1.18 * (12 + x * K);
const PY = (y: number) => 20 + 1.18 * (12 + y * K);
const REST: [number, number, number] = [560, 520, 1];

// 寄る所（録画の座標）
const Z_SCENE: [number, number, number] = [PX(195), PY(240), 1.5]; // 場面の一文
const Z_STEP: [number, number, number] = [PX(195), PY(540), 1.45]; // ⑤⑥ 土曜に全部書く
const Z_RECORD: [number, number, number] = [PX(195), PY(520), 1.5]; // あなたの記録
const Z_SHRINK: [number, number, number] = [PX(195), PY(300), 1.45]; // 前より小さくするなら
const Z_DONE: [number, number, number] = [PX(195), PY(630), 1.4]; // ⑥ 2枚目の一歩・⑦ できた

export const Demo: React.FC<SceneProps> = ({ from }) => {
  const t = useT(from);
  const cam = camAt([
    [W(93.9), ...REST], [at("n28", "何から") + 0.4, ...REST], [at("n28", "何から") + 1.1, ...Z_SCENE], [En("n28") - 0.1, ...Z_SCENE], [En("n28") + 0.4, ...REST],
    [S("n30") - 0.4, ...REST], [S("n30") + 0.3, ...Z_STEP], [En("n30") + 0.1, ...Z_STEP], [SLEEP1 - 0.1, ...REST],
    [S("n35") - 0.6, ...REST], [S("n35") + 0.1, ...Z_RECORD], [En("n35") + 0.2, ...Z_RECORD], [En("n35") + 0.8, ...REST],
    [at("n38", "小さく") - 0.6, ...REST], [at("n38", "小さく") + 0.1, ...Z_SHRINK], [En("n39") - 0.25, ...Z_SHRINK], [En("n39") + 0.25, ...REST],
    [TAP2() + 1.0, ...REST], [TAP2() + 1.7, ...Z_DONE], [170, ...Z_DONE],
  ], t);
  const zoom = clamp((cam.s - 1) / 0.25);
  const pin = settle(t, W(93.9), 0.7);

  const label = (a0: number, b0: number) => {
    const p = settle(t, a0, 0.45);
    return { opacity: win(t, a0, b0, 0.3), translate: `${(-16 * (1 - p)).toFixed(1)}px 0px` };
  };

  return (
    <AbsoluteFill style={{ background: "#F4EEE3" }}>
      <div id="cam5" style={{ translate: `${(560 - cam.x * cam.s).toFixed(2)}px ${(520 - cam.y * cam.s).toFixed(2)}px`, scale: cam.s.toFixed(4) }}>
        <div className="phone" id="phone5" style={{ left: 260, top: 20, scale: "1.18", translate: `0px ${(40 * (1 - pin)).toFixed(1)}px` }}>
          <div className="screen" style={{ background: "#000" }}>
            <PhoneScreen t={t} />
          </div>
          <div className="island" />
        </div>
        <div className="clabel" style={{ top: PY(600) - 40, ...label(at("n28", "Claude") - 0.1, at("n28", "何から") + 0.3) }}><i /><small>Claude</small>問いかける</div>
        <div className="clabel" style={{ top: PY(470) - 40, ...label(at("n34", "Claude") - 0.1, En("n35") + 0.3) }}><i /><small>Claude</small>これまでの紙を読む</div>
        <div className="clabel" style={{ top: PY(262) - 40, ...label(at("n38", "本人の言葉") - 0.25, En("n39") - 0.1) }}><i /><small>Claude</small>あなたの言葉のまま、小さくする</div>
        <div id="rail" style={{ opacity: 1 - zoom }}>
          <div className="eyebrow">止まった企画書が、もう一度動くまで</div>
          {STAGES.map(([tt, dd, a0, b0, color], k) => {
            const act = win(t, a0, b0, 0.35);
            const done = t > b0;
            const sp = settle(t, a0, 0.5) * (1 - P(t, b0 - 0.3, b0, EASE.io));
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
        <PaperIfOnly t={t} />
      </div>
      <ProblemChip t={t} n={1} text="一人だと、具体的にできない" answer="問いに答えて、具体的に" a={S("n27")} ok={at("n28", "見えてくる")} b={W(106.4)} zoom={zoom} />
      <ProblemChip t={t} n={2} text="「できなかった」と書くのが、つらい" answer="できなかった日が、手がかりになる" a={S("n33")} ok={S("n35")} b={W(129.3)} zoom={zoom} />
      <ProblemChip t={t} n={3} text="もう一度向き合うのは、もっとつらい" answer="前の紙に重ねて、一歩を小さく" a={S("n36")} ok={at("n39", "書く")} b={W(142.9)} red zoom={zoom} />
      <div className="ff-chip" style={{ left: 770, top: 34, opacity: fastForward(t) }}>▶▶ 早送り</div>
    </AbsoluteFill>
  );
};

/** スマホの画面：録画 A → 録画 B、あいだにロック画面（土曜の朝・日曜の朝） */
const PhoneScreen: React.FC<{ t: number }> = ({ t }) => {
  const { A, B } = tracks();
  const fa = frameAt(A, t);
  const fb = frameAt(B, t);
  const xAB = P(t, T_AB, T_AB + 0.2, EASE.io);
  // ロック画面：画面が消えて（黒）、また点く
  const lockWin = (sleep: number, wake: number, tap: number) => ({
    dark: P(t, sleep, sleep + 0.16, EASE.out) * (1 - P(t, wake, wake + 0.25, EASE.out)),
    on: t >= sleep + 0.16 && t < tap + OPEN + 0.05,
    open: P(t, tap + 0.05, tap + 0.05 + OPEN, EASE.out),
    app: t < sleep + 0.16 || t >= tap + 0.05,
  });
  const L1 = lockWin(SLEEP1, WAKE1, TAP1());
  const L2 = lockWin(SLEEP2, WAKE2, TAP2());
  const lock = t < SLEEP2 - 1 ? L1 : L2;
  const inLock = lock.on;
  const appVisible = lock.app;
  const opening = inLock && t >= (t < SLEEP2 - 1 ? TAP1() : TAP2()) + 0.05;
  const appStyle: React.CSSProperties = opening
    ? { position: "absolute", inset: 0, transformOrigin: "198px 554px", scale: lerp(0.22, 1, lock.open).toFixed(4), opacity: clamp(lock.open * 2.5), borderRadius: lerp(40, 0, lock.open), overflow: "hidden" }
    : { position: "absolute", inset: 0 };

  // 時刻（ステータスバー）
  const isA = t < T_AB + 0.15;
  const time = isA ? "20:15" : t < SLEEP1 ? "20:40" : t < SLEEP2 ? "10:00" : "8:50";
  const tapNotif = [TAP1(), TAP2()].find((tt) => t > tt - 0.16 && t < tt + 0.45);

  return (
    <>
      {inLock && (
        <LockScreen
          t={t}
          date={t < SLEEP2 - 1 ? "11月14日 土曜日" : "11月15日 日曜日"}
          time={t < SLEEP2 - 1 ? "10:00" : "8:50"}
          notifyAt={t < SLEEP2 - 1 ? NOTIFY1() : NOTIFY2()}
          tapAt={t < SLEEP2 - 1 ? TAP1() : TAP2()}
          body="企画書が進まない"
        />
      )}
      {appVisible && (
        <div style={appStyle}>
          {xAB < 1 && <MockFrame src="A" f={fa} />}
          {t >= T_AB && <MockFrame src="B" f={fb} style={{ opacity: xAB }} />}
          {isA ? <Keyboard tr={tracks().A} t={t} /> : null}
          {isA ? <Touches tr={tracks().A} t={t} /> : <Touches tr={tracks().B} t={t} skip={SKIP_B()} />}
          <HighlightOnScreen t={t} />
        </div>
      )}
      {tapNotif != null && <NotifTap t={t} tt={tapNotif} />}
      <StatusBar time={time} light={inLock && !opening} hideTime={inLock && !opening} />
      <HomeBar light={inLock && !opening} />
      {/* 画面が消える・点く */}
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: Math.max(L1.dark, L2.dark), zIndex: 60 }} />
    </>
  );
};

const NotifTap: React.FC<{ t: number; tt: number }> = ({ t, tt }) => {
  const p1 = P(t, tt - 0.16, tt, EASE.out);
  const p2 = P(t, tt + 0.05, tt + 0.45, EASE.out);
  return <div className="tap" style={{ left: 198, top: 556, zIndex: 50, opacity: p1 * (1 - p2), scale: (lerp(1.3, 0.92, p1) * lerp(1, 0.8, p2)).toFixed(3) }} />;
};

/** 録画の上に引くマーカー（話している言葉の所） */
const HighlightOnScreen: React.FC<{ t: number }> = ({ t }) => {
  const RED = "rgba(222, 84, 64, 0.24)";
  const TEAL = "rgba(63, 143, 138, 0.28)";
  const marks: [number, number, number, number, number, number, number, string][] = [
    // [引き始め, 引き終わり, 消す, x, y, 幅, 高さ, 色]（x 以降は録画の CSS px）
    [at("n28", "最初の1行"), atEnd("n28", "止まる") + 0.25, T_AB, 74, 226, 135, 23, RED],
    // 「土曜に、企画書を全部書く」（⑤ と ⑥）
    [at("n30", "土曜"), at("n30", "企画書") - 0.05, SLEEP1, 44, 430, 124, 25, RED],
    [at("n30", "企画書"), atEnd("n30", "書く") + 0.1, SLEEP1, 139, 641, 198, 24, RED],
    // 動けた時は（4枚が動いています）、一歩が5分以内だった（最初の一歩を5分以内）
    [at("n35", "動けた"), atEnd("n35", "時は"), at("n36", "もう一度"), 104, 506, 194, 24, TEAL],
    [at("n35", "一歩"), atEnd("n35", "5分以内") + 0.1, at("n36", "もう一度"), 127, 482, 190, 24, TEAL],
    // 「見出しを3つだけ書く」（前より小さくするなら）
    [at("n39", "見出し"), at("n39", "だけ"), En("n39") - 0.25, 109, 270, 133, 23, RED],
    [at("n39", "だけ"), atEnd("n39", "書く") + 0.05, En("n39") - 0.25, 27, 293, 85, 23, RED],
    // これが、2枚目の一歩です（⑥ 最初の2分）
    [at("n40", "2枚目"), atEnd("n40", "一歩") + 0.1, 999, 139, 578, 142, 24, TEAL],
  ];
  return (
    <>
      {marks.map(([a0, b0, c0, x, y, w, h, c], i) => {
        const p = P(t, a0, b0, EASE.io);
        const o = 1 - P(t, c0 - 0.15, c0, EASE.lin);
        if (p <= 0 || o <= 0) return null;
        return <div key={i} style={{ position: "absolute", left: x * K, top: y * K, width: w * K * p, height: h * K, background: c, opacity: o, borderRadius: 3, mixBlendMode: "multiply" }} />;
      })}
    </>
  );
};

// ---- 紙なら、ここで終わり（③で見せた紙のシートと同じ姿） ----
const PaperIfOnly: React.FC<{ t: number }> = ({ t }) => {
  const a0 = S("n33") - 0.15;
  const b0 = S("n34") + 0.15;
  const o = win(t, a0, b0, 0.3);
  if (o <= 0) return null;
  const pin = settle(t, a0, 0.55);
  const tFail = at("n33", "できなかった");
  const ps = P(t, STOP_T(), STOP_T() + 0.16, EASE.out);
  const gray = P(t, STOP_T() - 0.1, STOP_T() + 0.3, EASE.lin);
  const rows: [string, string][] = [
    ["⑤ やってみること", "土曜に、企画書を全部書く"],
    ["⑥ いつ・どこで", "土曜 10:00 ・ 自宅の机"],
  ];
  return (
    <div style={{ position: "absolute", left: 790, top: 250, width: 440, opacity: o, translate: `${(60 * (1 - pin)).toFixed(1)}px ${(-6 * (1 - pin)).toFixed(1)}px`, rotate: "-2.5deg" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#8C8476", marginBottom: 10 }}>紙なら</div>
      <div style={{ background: "#FFFDF8", borderRadius: 6, padding: "18px 24px 24px", boxShadow: "0 2px 4px rgba(60,40,10,.10), 0 16px 34px rgba(60,40,10,.16)", filter: gray > 0 ? `saturate(${1 - 0.7 * gray})` : undefined, position: "relative" }}>
        <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: ".3em", color: "#5E584E", borderBottom: "2px solid #E7DFD0", paddingBottom: 8, marginBottom: 6 }}>考える紙</div>
        {rows.map(([l, v]) => (
          <div key={l} style={{ borderBottom: "1px solid #EEE7DA", padding: "10px 0 12px" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#8C8476" }}>{l}</div>
            <div className="hand" style={{ fontSize: 26, color: "#3B3833", marginTop: 4 }}>{v}</div>
          </div>
        ))}
        <div style={{ padding: "10px 0 4px" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#8C8476" }}>⑦ やってみてどうだった</div>
          <div className="hand" style={{ fontSize: 36, color: "#3B3833", marginTop: 6, minHeight: 42 }}>{typed("できなかった", P(t, tFail, tFail + 0.7, EASE.lin))}</div>
        </div>
        {ps > 0 && (
          <div className="stopped-tag" style={{ top: "84%", left: "76%", fontSize: 26, opacity: Math.min(1, ps * 2), translate: "-50% -50%", rotate: "-8deg", scale: lerp(1.7, 1, ps).toFixed(3) }}>ここで終わり</div>
        )}
      </div>
    </div>
  );
};
export const STOP_T = () => at("n33", "終わり") - 0.15;

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

/** 早送りの札：録画を 1.5 倍より速く流している所だけ */
const fastForward = (t: number) => {
  const { A, B } = tracks();
  const spans = [...ffSpans(A).filter(([x]) => x < T_AB), ...ffSpans(B).filter(([x]) => x >= T_AB)];
  return Math.max(0, ...spans.map(([x, y]) => win(t, x - 0.1, y + 0.15, 0.12)));
};

/** 効果音：タップ・キー・通知・紙・できた */
export const demoCues = (): [number, string, number][] => {
  const { A, B } = tracks();
  const c: [number, string, number][] = [];
  RECS.A.taps.forEach((tp) => tp.kind === "tap" && c.push([timeOf(A, tp.f) - 0.02, "tap", 0.4]));
  RECS.B.taps.forEach((tp) => tp.kind === "tap" && !SKIP_B().includes(tp.f) && c.push([timeOf(B, tp.f) - 0.02, "tap", 0.4]));
  RECS.A.keys.forEach((k) => c.push([timeOf(A, k.f) - 0.01, "key", 0.22]));
  c.push([NOTIFY1(), "notify", 0.32], [NOTIFY2(), "notify", 0.28]);
  c.push([TAP1() - 0.02, "tap", 0.4], [TAP2() - 0.02, "tap", 0.4]);
  c.push([STOP_T(), "stamp", 0.4]);
  c.push([timeOf(B, b("loading_end", 10)), "select", 0.2]); // 記録が読めた
  c.push([timeOf(B, b("reason", 2)) + 0.2, "paper1", 0.28]); // 2枚目の紙が重なる
  c.push([timeOf(B, tapB(7) + 4), "success", 0.34]); // できた
  return c;
};

export const SCREEN = { W: SCR_W, H: SCR_H };
