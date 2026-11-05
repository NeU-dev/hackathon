// ⑥ 締め：Claude の役割／安全と医療／二文
import React from "react";
import { Highlight } from "@remotion/rough-notation";
import { AbsoluteFill } from "remotion";
import { PhTag, SceneProps, useT } from "../components/common";
import { at, atEnd, EASE, En, lerp, mix, P, pop, S, settle } from "../lib/time";

export const Roles: React.FC<SceneProps> = ({ from }) => {
  const t = useT(from);
  const ts = [at("n36", "問いかけて"), at("n36", "読んで"), at("n36", "小さく")];
  const labels = ["問いかける", "これまでの紙を読む", "あなたの言葉のまま、小さくする"];
  const p1 = P(t, S("n37") - 0.1, S("n37") + 0.35, EASE.out);
  const p2 = P(t, at("n37", "決めるのは") - 0.1, at("n37", "決めるのは") + 0.35, EASE.out);
  const hl = P(t, at("n37", "本人"), atEnd("n37", "本人") + 0.3, EASE.io);
  return (
    <AbsoluteFill style={{ background: "#F4EEE3" }}>
      <div id="roles6">
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
        <div className="p" style={{ marginTop: 40, opacity: p1, translate: `0px ${(18 * (1 - p1)).toFixed(1)}px` }}>
          答えは<span className="acc">出しません</span>。
        </div>
        <div className="p" style={{ opacity: p2, translate: `0px ${(18 * (1 - p2)).toFixed(1)}px` }}>
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
  const head = P(t, S("n38") - 0.15, S("n38") + 0.3, EASE.out);
  const ph = settle(t, 160.0, 0.6);
  const side = P(t, S("n40") - 0.5, S("n40") + 0.35, EASE.io);
  const pm = settle(t, S("n40") - 0.2, 0.6);
  const sel = P(t, at("n40", "医療に") - 0.2, at("n40", "医療に") + 0.3, EASE.lin);
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
            <div className="btn" style={{ top: 520, opacity: 1, scale: t > at("n39", "相談窓口") && t < at("n39", "相談窓口") + 0.25 ? "0.97" : "1" }}>地域の相談窓口を見る</div>
            <div className="btn outline" style={{ top: 598, opacity: 1 }}>いま話せる窓口（電話・SNS）</div>
            <div className="safe-f">このアプリは、医療の代わりではありません</div>
          </div>
        </div>
        <div className="island" />
      </div>
      <div id="memo" style={{ opacity: pm, translate: `${(80 * (1 - pm)).toFixed(1)}px 0px`, rotate: `${(2 * (1 - pm)).toFixed(2)}deg` }}>
        <h3>相談メモ</h3>
        <div className="sub">10月3日〜11月1日 ・ 本人が選んだ紙から作成</div>
        <div className="m-row"><div className="k">困っていたこと</div><div className="v">住所変更の書類が、2週間出せていない</div></div>
        <div className="m-row"><div className="k">試したこと</div><div className="v">一歩を「全部書く」から「名前だけ書く」へ</div></div>
        <div className="m-row"><div className="k">動けた時の条件</div><div className="v">一歩が5分以内の時</div></div>
        <div className="m-row"><div className="k">相談したいこと</div><div className="v">（本人が書く）</div></div>
        <div className="m-sel" style={{ background: mix("F6F2EA", "D9ECE9", sel) }}><b>✓</b> 載せる紙は、本人が選ぶ<br /><b>✓</b> A4一枚で、医療に持っていける</div>
      </div>
      <PhTag label="仮画面" right opacity={P(t, 160.3, 160.8)}>相談先の画面・相談メモの実物に差し替え</PhTag>
    </AbsoluteFill>
  );
};

export const EndLines: React.FC<SceneProps> = ({ from }) => {
  const t = useT(from);
  const nm = P(t, S("n42") - 0.4, S("n42"), EASE.out);
  const l1 = P(t, S("n42") - 0.1, S("n42") + 0.35, EASE.out);
  const l2 = P(t, S("n43") - 0.1, S("n43") + 0.35, EASE.out);
  const hl = P(t, at("n43", "もう一度"), atEnd("n43", "もう一度") + 0.2, EASE.io);
  const thanks = P(t, En("n43") - 0.4, En("n43") + 0.2, EASE.lin);
  return (
    <AbsoluteFill style={{ background: "#F4EEE3" }}>
      <div id="end-lines" style={{ scale: (1 + 0.02 * P(t, from, 180, EASE.lin)).toFixed(4) }}>
        <div className="nm" style={{ opacity: nm, translate: `0px ${(18 * (1 - nm)).toFixed(1)}px` }}>【アプリ名】</div>
        <div className="l" style={{ opacity: l1, translate: `0px ${(18 * (1 - l1)).toFixed(1)}px` }}>問題を解くハードルを下げる。</div>
        <div className="l" style={{ opacity: l2, translate: `0px ${(18 * (1 - l2)).toFixed(1)}px` }}>
          <Highlight progress={hl} color="rgba(222, 84, 64, 0.2)" iterations={1} padding={{ left: 2, right: 2, top: 2, bottom: 2 }}>
            <span className="acc">もう一度</span>
          </Highlight>
          向き合うハードルは、もっと下げる。
        </div>
      </div>
      <div id="thanks" style={{ opacity: thanks }}>ありがとうございました</div>
    </AbsoluteFill>
  );
};
