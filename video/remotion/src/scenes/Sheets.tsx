// ③ 当事者にしか分からない：実物の10枚（を描いたもの）
import React from "react";
import { Highlight } from "@remotion/rough-notation";
import { AbsoluteFill } from "remotion";
import { PhTag, SceneProps, useT } from "../components/common";
import { at, atEnd, EASE, lerp, P, pop, settle } from "../lib/time";

const SHEETS = [
  ["10/03", "役所の書類が出せない", "期限までに出す", "・今週やる ・朝やる", "朝やる", "書類を全部書く", "土曜 9:00"],
  ["10/05", "朝、起きられない", "7時に起きる", "・アラーム2個 ・カーテン", "カーテンを開けて寝る", "夜、カーテンを開ける", "毎晩"],
  ["10/08", "メールの返信がたまる", "今週中に0にする", "・まとめて ・1通ずつ", "まとめて返す", "全部返す", "日曜の夜"],
  ["10/10", "部屋が片づかない", "床が見える", "・1か所だけ ・袋を置く", "机の上だけ", "机の上を5分", "帰ってすぐ"],
  ["10/12", "洗濯物がたまる", "週2回まわす", "・夜にまわす ・予約", "予約する", "夜に予約ボタン", "火・金"],
  ["10/14", "病院の予約ができない", "今月中に予約", "・電話 ・ネット予約", "電話する", "電話してぜんぶ聞く", "平日の昼"],
  ["10/17", "締め切りに間に合わない", "前日に終える", "・先にやる ・分ける", "分ける", "全部の流れを考える", "週末"],
  ["10/19", "■■さんに連絡できない", "お礼を伝える", "・LINE ・手紙", "LINEで一言", "一言だけ送る", "夜9時"],
  ["10/21", "家計簿が続かない", "1か月つける", "・アプリ ・レシート", "レシートを箱へ", "箱を玄関に置く", "毎日"],
  ["10/24", "■■の資料が終わらない", "金曜に出す", "・朝やる ・カフェ", "カフェでやる", "全部しあげる", "土曜"],
];
export const DONE = [1, 3, 4, 7, 8];
const ROT_A = [-2.2, 1.4, -0.8, 2.0, -1.5, 1.1, -2.4, 0.7, 1.8, -1.0];
const W = 250, H = 354;
const posA = (i: number) => ({ x: 243 + (i % 5) * (W + 46), y: 168 + Math.floor(i / 5) * (H + 40), r: ROT_A[i] });
const DONE_B = [[250, 470], [480, 470], [710, 470], [365, 765], [595, 765]];
const NOT_B = [[1300, 500, -9], [1520, 470, 7], [1380, 690, -4], [1600, 720, 11], [1470, 590, 3]];
const posB = (i: number) => {
  const di = DONE.indexOf(i);
  if (di >= 0) return { x: DONE_B[di][0] - W / 2, y: DONE_B[di][1] - H / 2, r: ROT_A[i] * 0.5 };
  const [cx, cy, r] = NOT_B[[0, 2, 5, 6, 9].indexOf(i)];
  return { x: cx - W / 2, y: cy - H / 2, r };
};

// 効果音と合わせる時刻（Audio 側からも使う）
export const SHEET_T0 = 47.0;
export const sheetDealTime = (i: number) => SHEET_T0 + 0.2 + i * 0.42;
export const sheetStampTime = (di: number) => at("n15", "5枚") - 0.55 + di * 0.1;
export const sheetSplitTime = () => at("n15", "5枚") + 0.1;

const Row: React.FC<{ text: string; k: number }> = ({ text, k }) => {
  const parts = text.split("■■");
  return (
    <div className="sh-row">
      <i>{k + 1}</i>
      <div className="hand">
        {parts.map((p, j) => (
          <React.Fragment key={j}>
            {j > 0 && <span className="redact" style={{ width: "2.2em" }} />}
            {p}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export const Sheets: React.FC<SceneProps> = ({ from }) => {
  const t = useT(from);
  const tNum = at("n15", "10枚");
  const tSplit = sheetSplitTime();
  const deskScale = 1 + 0.025 * P(t, SHEET_T0, tNum, EASE.lin) - 0.025 * P(t, tNum, tNum + 0.6, EASE.io);
  const gl = P(t, tSplit + 0.9, tSplit + 1.3, EASE.out);
  const head = P(t, at("n15", "書いただけ") - 0.2, at("n15", "書いただけ") + 0.25, EASE.out);
  const hl = P(t, at("n15", "書いただけ"), atEnd("n15", "終わりました"), EASE.io);

  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, #E3D3B6 0%, #D3BE9B 60%, #C2AB86 100%)" }}>
      <div id="desk3" style={{ scale: deskScale.toFixed(4) }}>
        {SHEETS.map((d, i) => {
          const a = posA(i), b = posB(i);
          const pin = settle(t, sheetDealTime(i), 0.5);
          const pm = settle(t, tSplit + i * 0.05, 0.9);
          const done = DONE.includes(i);
          const pn = pop(t, tNum - 0.3 + i * 0.07);
          const di = DONE.indexOf(i);
          const ps = done ? P(t, sheetStampTime(di), sheetStampTime(di) + 0.18, EASE.out) : 0;
          const rows = d.slice(1).concat([`見直す日 ${d[0].slice(0, 3)}${String(+d[0].slice(3) + 7).padStart(2, "0")}`]);
          return (
            <div
              key={i}
              className="sheet"
              style={{
                opacity: Math.min(1, pin * 1.6),
                translate: `${lerp(a.x, b.x, pm).toFixed(1)}px ${(lerp(a.y, b.y, pm) - 40 * (1 - pin)).toFixed(1)}px`,
                rotate: `${(lerp(a.r, b.r, pm) + 6 * (1 - pin) * (i % 2 ? 1 : -1)).toFixed(2)}deg`,
                scale: (lerp(1, 0.78, pm) * lerp(1.08, 1, pin)).toFixed(4),
                filter: !done && pm > 0 ? `saturate(${1 - 0.7 * pm}) brightness(${1 - 0.06 * pm})` : undefined,
              }}
            >
              <div className="sh-head">
                <span className="sh-title">問題解決シート</span>
                <span className="sh-date hand">{d[0]}</span>
              </div>
              {rows.map((s, k) => (
                <Row key={k} text={s} k={k} />
              ))}
              {done && (
                <div className="stamp" style={{ opacity: ps, scale: lerp(1.8, 1, ps).toFixed(4), rotate: "-12deg", transform: "none" }}>
                  できた
                </div>
              )}
              <div className="num" style={{ opacity: Math.min(1, pn * 2) * (1 - P(t, tSplit - 0.3, tSplit, EASE.lin)), scale: pn.toFixed(4) }}>
                {i + 1}
              </div>
            </div>
          );
        })}
      </div>
      <div className="group-label" style={{ left: 180, top: 262, color: "var(--teal)", opacity: gl, translate: `0px ${(12 * (1 - gl)).toFixed(1)}px` }}>
        実行できた 5枚
      </div>
      <div className="group-label" style={{ left: 1160, top: 262, color: "#7A7062", opacity: gl, translate: `0px ${(12 * (1 - gl)).toFixed(1)}px` }}>
        書いただけ 5枚
      </div>
      <div className="headline" style={{ opacity: head, translate: `0px ${(-14 * (1 - head)).toFixed(1)}px` }}>
        <span>
          10枚中5枚、
          <Highlight progress={hl} color="rgba(222, 84, 64, 0.26)" iterations={1} padding={{ left: 4, right: 4, top: 2, bottom: 2 }}>
            書いただけで終わった
          </Highlight>
        </span>
      </div>
      <PhTag label="仮映像" opacity={P(t, SHEET_T0 + 0.3, SHEET_T0 + 0.7)}>実物の10枚（職場・人名を塗りつぶし）の撮影に差し替え</PhTag>
    </AbsoluteFill>
  );
};
