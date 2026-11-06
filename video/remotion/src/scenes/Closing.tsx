// ⑥ 締め：Claude の役割／安全と医療／止まった紙と2回目の挑戦／核の一文
import React from "react";
import { Highlight } from "@remotion/rough-notation";
import { AbsoluteFill } from "remotion";
import { PhTag, SceneProps, useT } from "../components/common";
import { at, atEnd, EASE, En, lerp, mix, P, pop, S, settle } from "../lib/time";
import { CoreLine } from "./Statement";

export const Roles: React.FC<SceneProps> = ({ from }) => {
  const t = useT(from);
  const ts = [at("n44", "問いかけて"), at("n44", "読んで"), at("n44", "小さく")];
  const labels = ["問いかける", "これまでの紙を読む", "あなたの言葉のまま、小さくする"];
  const p0 = P(t, S("n43") - 0.1, S("n43") + 0.35, EASE.out);
  const p2 = P(t, S("n45") - 0.1, S("n45") + 0.35, EASE.out);
  const hl = P(t, at("n45", "本人"), atEnd("n45", "本人") + 0.3, EASE.io);
  return (
    <AbsoluteFill style={{ background: "#F4EEE3" }}>
      <div id="roles6" style={{ top: 120 }}>
        <div className="p" style={{ marginTop: 0, marginBottom: 46, fontSize: 60, opacity: p0, translate: `0px ${(18 * (1 - p0)).toFixed(1)}px` }}>
          Claudeは、答えを<span className="acc">出しません</span>。
        </div>
        {labels.map((s, k) => {
          const p = pop(t, ts[k] - 0.15, 12);
          return (
            <div className="row" key={s}>
              <div className="clabel" style={{ flexDirection: "row", alignItems: "baseline", gap: 14, opacity: Math.min(1, p * 2), scale: lerp(0.85, 1, p).toFixed(4) }}>
                <span style={{ color: "var(--gold)", marginRight: 4 }}>Claude</span>
                {s}
              </div>
            </div>
          );
        })}
        <div className="p" style={{ marginTop: 30, opacity: p2, translate: `0px ${(18 * (1 - p2)).toFixed(1)}px` }}>
          決めるのは、いつも
          <Highlight progress={hl} color="rgba(240, 190, 94, 0.5)" iterations={1} padding={{ left: 4, right: 4, top: 2, bottom: 2 }}>
            本人
          </Highlight>
          です。
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Safety: React.FC<SceneProps> = ({ from }) => {
  const t = useT(from);
  const head = P(t, S("n46") - 0.15, S("n46") + 0.3, EASE.out);
  const ph = settle(t, from + 0.1, 0.6);
  const tMemo = at("n47", "相談窓口") + 0.4;
  const side = P(t, tMemo - 0.4, tMemo + 0.4, EASE.io);
  const pm = settle(t, tMemo - 0.1, 0.6);
  const sel = P(t, tMemo + 0.8, tMemo + 1.3, EASE.lin);
  return (
    <AbsoluteFill style={{ background: "#F4EEE3" }}>
      <div id="safe-head" style={{ opacity: head, translate: `0px ${(18 * (1 - head)).toFixed(1)}px` }}>医療の代わりではありません。</div>
      <div className="phone" style={{ left: 410, top: 190, scale: "0.86", translate: `${(370 * (1 - side)).toFixed(1)}px ${(30 * (1 - ph)).toFixed(1)}px`, opacity: ph }}>
        <div className="screen">
          <div className="statusbar">
            <span>21:12</span>
            <span className="icons">
              <i style={{ width: 18, height: 11 }} />
              <i style={{ width: 16, height: 11, borderRadius: 6 }} />
              <i style={{ width: 26, height: 12, borderRadius: 4 }} />
            </span>
          </div>
          <div className="scr" id="scr-safe">
            <div className="safe-ico" />
            <div className="safe-t">ひとりで抱えないで<br />ください</div>
            <div className="safe-b">つらさが強いときは、<br />相談できる窓口があります。</div>
            <div className="btn" style={{ top: 520, opacity: 1, scale: t > at("n47", "相談窓口") && t < at("n47", "相談窓口") + 0.25 ? "0.97" : "1" }}>地域の相談窓口を見る</div>
            <div className="btn outline" style={{ top: 598, opacity: 1 }}>いま話せる窓口（電話・SNS）</div>
            <div className="safe-f">このアプリは、医療の代わりではありません</div>
          </div>
        </div>
        <div className="island" />
      </div>
      <div id="memo" style={{ opacity: pm, translate: `${(80 * (1 - pm)).toFixed(1)}px 0px`, rotate: `${(2 * (1 - pm)).toFixed(2)}deg` }}>
        <h3>相談メモ</h3>
        <div className="sub">10月3日〜11月9日 ・ 本人が選んだ紙から作成</div>
        <div className="m-row"><div className="k">困っていたこと</div><div className="v">締切が3つ重なり、上司に相談できないまま2週間</div></div>
        <div className="m-row"><div className="k">試したこと</div><div className="v">一歩を「1on1で全部話す」から「一言だけ送る」へ</div></div>
        <div className="m-row"><div className="k">動けた時の条件</div><div className="v">一歩が5分以内の時</div></div>
        <div className="m-row"><div className="k">相談したいこと</div><div className="v">（本人が書く）</div></div>
        <div className="m-sel" style={{ background: mix("F6F2EA", "D9ECE9", sel) }}><b>✓</b> 相談メモとして、医療に持っていける<br /><b>✓</b> 載せる紙は、本人が選ぶ</div>
      </div>
      <PhTag label="仮画面" right opacity={P(t, from + 0.3, from + 0.8)}>相談先の画面・相談メモの実物に差し替え</PhTag>
    </AbsoluteFill>
  );
};

/** 皆さんにも、止まったままの問題はありませんか。 */
export const EndPapers: React.FC<SceneProps> = ({ from }) => {
  const t = useT(from);
  const head = P(t, S("n48") - 0.15, S("n48") + 0.35, EASE.out);
  const a = settle(t, from + 0.1, 0.6), b = settle(t, from + 0.4, 0.6);
  const pill = pop(t, at("n48", "問題") - 0.2, 11);
  const lines = (n: number) => Array.from({ length: n }, (_, i) => <div key={i} className={`ln${i % 3 === 2 ? " s" : ""}`} />);
  return (
    <AbsoluteFill style={{ background: "#F4EEE3" }}>
      <div className="headline" style={{ opacity: head, translate: `0px ${(-14 * (1 - head)).toFixed(1)}px` }}>
        <span>皆さんにも、止まったままの問題はありませんか。</span>
      </div>
      <div className="ep gray" style={{ left: 360, top: 330, opacity: a, translate: `0px ${(24 * (1 - a)).toFixed(1)}px`, rotate: "-2deg" }}>
        {lines(8)}
        <div className="fail">できなかった</div>
      </div>
      <div className="ep" style={{ left: 1250, top: 318, opacity: b, translate: `0px ${(24 * (1 - b)).toFixed(1)}px`, rotate: "4deg" }}>{lines(10)}</div>
      <div className="ep glow" style={{ left: 1230, top: 340, opacity: b, translate: `0px ${(24 * (1 - b)).toFixed(1)}px` }}>{lines(10)}</div>
      <div className="count-pill" style={{ position: "absolute", left: 1450, top: 320, fontSize: 26, padding: "6px 18px", opacity: Math.min(1, pill * 2), scale: pill.toFixed(3) }}>2回目の挑戦</div>
      <div className="ep-label" style={{ left: 525, top: 830, translate: "-50% 0", color: "var(--muted)", opacity: a }}>止まった紙</div>
      <div className="ep-label" style={{ left: 1395, top: 830, translate: "-50% 0", opacity: b }}>同じ紙の上で、続きを</div>
    </AbsoluteFill>
  );
};

export const EndLines: React.FC<SceneProps> = ({ from }) => {
  const t = useT(from);
  const nm = P(t, from + 0.2, from + 0.6, EASE.out);
  const thanks = P(t, En("n50") + 0.4, En("n50") + 1.0, EASE.lin);
  return (
    <AbsoluteFill style={{ background: "#F4EEE3" }}>
      <AbsoluteFill style={{ scale: (1 + 0.02 * P(t, from, 180, EASE.lin)).toFixed(4) }}>
        <div className="core" style={{ top: 250, fontSize: 44, color: "var(--ink-2)", opacity: nm }}>【アプリ名】</div>
        <CoreLine t={t} ids={["n49", "n50"]} top={400} />
      </AbsoluteFill>
      <div id="thanks" style={{ opacity: thanks }}>ありがとうございました</div>
    </AbsoluteFill>
  );
};
