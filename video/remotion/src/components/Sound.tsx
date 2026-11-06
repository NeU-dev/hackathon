// 音：ナレーション（文ごと）・効果音・BGM
import React from "react";
import { Audio } from "@remotion/media";
import { Sequence, staticFile } from "remotion";
import { at, EASE, En, FPS, lerp, LINES, P, S, win } from "../lib/time";
import { problemTimes, sheetDealTime, sheetSplitTime, sheetStampTime } from "../scenes/Sheets";
import { DEMO_TAPS, DONE_T, IDEA_LAND, NOTIFY_T, Q1, Q2, STACK_T, STOP_T } from "../scenes/Demo";

const f = (sec: number) => Math.round(sec * FPS);
const SILENT = new Set(["n23"]);

/** ナレーション：文ごとに置く（Studio で1文ずつ動かせる） */
export const Narration: React.FC = () => (
  <>
    {LINES.filter((l) => !SILENT.has(l.id)).map((l) => (
      <Audio key={l.id} name={`ナレーション ${l.id}`} from={f(l.start)} src={staticFile(`narration/${l.id}.wav`)} volume={0.85} />
    ))}
  </>
);

type Cue = [number, string, number]; // 秒, ファイル, 音量

const cues = (): Cue[] => {
  const c: Cue[] = [];
  // ① チャット：締切の一覧、「間に合わない」、日数
  c.push([at("n3", "たとえば") - 0.1, "swoosh", 0.1]);
  c.push([at("n3", "回らない"), "stamp", 0.2]);
  c.push([at("n5", "2週間") - 0.1, "select", 0.18]);
  // ② 壁と手順
  c.push([at("n7", "分からず"), "bubble", 0.16]);
  c.push([S("n8") - 0.2, "swoosh", 0.1]);
  c.push([at("n9", "紙のシート") - 0.1, "paper1", 0.22]);
  [at("n9", "具体的に"), at("n9", "案を出し"), at("n9", "計画して"), at("n9", "やってみる")].forEach((tt) => c.push([tt - 0.05, "select", 0.2]));
  c.push([at("n11", "解ける") - 0.1, "notify", 0.18]);
  c.push([S("n13") - 0.3, "swoosh", 0.1]);
  // ③ 10枚と紙の問題
  for (let i = 0; i < 10; i++) c.push([sheetDealTime(i) + 0.05, i % 2 ? "paper2" : "paper1", 0.2]);
  for (let k = 0; k < 5; k++) c.push([sheetStampTime(k), "stamp", 0.3]);
  c.push([sheetSplitTime(), "slide", 0.28]);
  problemTimes().forEach((tt, k) => c.push([tt + 0.05, k === 2 ? "stamp" : "paper2", k === 2 ? 0.3 : 0.24]));
  // ④ コンセプト
  c.push([S("n23") - 0.2, "notify", 0.22]);
  // ⑤ デモ
  c.push([93.9, "swoosh", 0.1]);
  DEMO_TAPS().forEach(([tt]) => c.push([tt - 0.02, "tap", 0.45]));
  c.push([Q1(), "bubble", 0.22], [Q2(), "bubble", 0.22]);
  [0, 1, 2].forEach((k) => c.push([IDEA_LAND(k) - 0.05, "drop", 0.22]));
  c.push([NOTIFY_T(), "notify", 0.32]);
  c.push([STOP_T(), "stamp", 0.4]);
  c.push([STACK_T() + 0.35, "paper1", 0.28]);
  c.push([at("n37", "同じ紙"), "select", 0.2]);
  c.push([at("n38", "小さく"), "select", 0.18]);
  c.push([DONE_T + 0.25, "success", 0.34]);
  // 紙の問題が解けた印
  c.push([at("n28", "見えてくる"), "select", 0.16], [S("n35"), "select", 0.16], [at("n39", "送る"), "select", 0.16]);
  // ⑤ 送れた（チャット）
  c.push([147.3 + 0.35, "drop", 0.24]);
  // ⑥ 締め
  [at("n44", "問いかけて"), at("n44", "読んで"), at("n44", "小さく")].forEach((tt) => c.push([tt - 0.15, "select", 0.14]));
  c.push([at("n47", "相談窓口") + 0.3, "slide", 0.18]);
  c.push([at("n48", "問題") - 0.2, "select", 0.16]);
  return c;
};

export const Sfx: React.FC = () => (
  <>
    {cues().map(([sec, file, vol], i) => (
      <Audio key={i} name={`効果音 ${file}`} from={f(sec)} src={staticFile(`sfx/${file}.wav`)} volume={vol} />
    ))}
  </>
);

/** 話しているあいだは BGM を下げる */
const speaking = (t: number) => {
  let v = 0;
  for (const l of LINES) {
    if (SILENT.has(l.id)) continue;
    if (t > l.start - 0.6 && t < l.end + 0.8) v = Math.max(v, win(t, l.start - 0.35, l.end + 0.45, 0.3));
  }
  return v;
};

/** 分散和音の濃さ：①〜③は無し、④から入り、止まるで消え、もう一度で戻り、動けたで一番濃く */
const arpLevel = (t: number) => {
  const keys: [number, number][] = [
    [0, 0], [S("n23") - 0.4, 0], [S("n23") + 0.6, 0.85], [112.6, 0.7], [113.8, 0], [129.2, 0], [130.4, 0.6],
    [143.0, 0.6], [145.2, 1.0], [153.0, 0.9], [154.5, 0.45], [En("n47"), 0.45], [S("n48") - 0.2, 0.2], [S("n49") - 0.6, 0.95], [178.5, 0.95], [180, 0],
  ];
  let k = 0;
  while (k < keys.length - 2 && t > keys[k + 1][0]) k++;
  return lerp(keys[k][1], keys[k + 1][1], P(t, keys[k][0], keys[k + 1][0], EASE.io));
};

export const Bgm: React.FC = () => (
  <Sequence name="BGM" layout="none">
    <Audio
      name="BGM 和音"
      src={staticFile("bgm/pad.wav")}
      volume={(fr) => {
        const t = fr / FPS;
        const fade = P(t, 0, 2.5, EASE.lin) * (1 - P(t, 177.5, 180, EASE.lin));
        return 0.54 * fade * lerp(1, 0.42, speaking(t));
      }}
    />
    <Audio
      name="BGM 分散和音"
      src={staticFile("bgm/arp.wav")}
      volume={(fr) => {
        const t = fr / FPS;
        return 0.47 * arpLevel(t) * lerp(1, 0.4, speaking(t));
      }}
    />
  </Sequence>
);
