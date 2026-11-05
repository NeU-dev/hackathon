// 音：ナレーション（文ごと）・効果音・BGM
import React from "react";
import { Audio } from "@remotion/media";
import { Sequence, staticFile } from "remotion";
import { at, EASE, FPS, lerp, LINES, P, S, win } from "../lib/time";
import { sheetDealTime, sheetSplitTime, sheetStampTime } from "../scenes/Sheets";
import { DEMO_TAPS, DONE_T, IDEA_LAND, NOTIFY_T, Q1, Q2, STACK_T, STOP_T } from "../scenes/Demo";

const f = (sec: number) => Math.round(sec * FPS);

/** ナレーション：文ごとに置く（Studio で1文ずつ動かせる） */
export const Narration: React.FC = () => (
  <>
    {LINES.filter((l) => l.id !== "n18").map((l) => (
      <Audio key={l.id} name={`ナレーション ${l.id}`} from={f(l.start)} src={staticFile(`narration/${l.id}.wav`)} volume={1} />
    ))}
  </>
);

type Cue = [number, string, number]; // 秒, ファイル, 音量

const cues = (): Cue[] => {
  const c: Cue[] = [];
  // ① 机：散らかっていく
  [0, 2, 4].forEach((k) => c.push([S("n2") + k * 0.7, "paper2", 0.14]));
  c.push([at("n3", "分かってる") - 0.3, "paper1", 0.14]);
  // ② 壁と手順
  c.push([at("n5", "何から") + 0.2, "bubble", 0.16]);
  c.push([S("n6") - 0.2, "swoosh", 0.1]);
  [at("n7", "具体的に"), at("n7", "案を出し"), at("n7", "計画して"), at("n7", "やってみる")].forEach((tt) => c.push([tt - 0.05, "select", 0.2]));
  c.push([S("n11") - 0.3, "swoosh", 0.1]);
  // ③ 10枚
  for (let i = 0; i < 10; i++) c.push([sheetDealTime(i) + 0.05, i % 2 ? "paper2" : "paper1", 0.22]);
  for (let k = 0; k < 5; k++) c.push([sheetStampTime(k), "stamp", 0.3]);
  c.push([sheetSplitTime(), "slide", 0.28]);
  // ④ コンセプト
  c.push([S("n18") - 0.2, "notify", 0.22]);
  // ⑤ デモ
  c.push([76.9, "swoosh", 0.1]);
  DEMO_TAPS().forEach(([tt]) => c.push([tt - 0.02, "tap", 0.45]));
  c.push([Q1(), "bubble", 0.22], [Q2(), "bubble", 0.22]);
  [0, 1, 2].forEach((k) => c.push([IDEA_LAND(k) - 0.05, "drop", 0.22]));
  c.push([NOTIFY_T, "notify", 0.32]);
  c.push([STOP_T(), "stamp", 0.4]);
  c.push([STACK_T + 0.35, "paper1", 0.28]);
  c.push([at("n34", "重なります") - 0.15, "select", 0.2]);
  c.push([DONE_T + 0.25, "success", 0.34]);
  // 動けたあとの机
  c.push([144.75, "paper2", 0.24], [145.5, "select", 0.16]);
  // ⑥ 締め
  [at("n36", "問いかけて"), at("n36", "読んで"), at("n36", "小さく")].forEach((tt) => c.push([tt - 0.15, "select", 0.14]));
  c.push([S("n40") - 0.2, "slide", 0.18]);
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
    if (l.id === "n18") continue;
    if (t > l.start - 0.6 && t < l.end + 0.8) v = Math.max(v, win(t, l.start - 0.35, l.end + 0.45, 0.3));
  }
  return v;
};

/** 分散和音の濃さ：①〜③は無し、④から入り、止まるで消え、もう一度で戻り、動けたで一番濃く */
const arpLevel = (t: number) => {
  const keys: [number, number][] = [
    [0, 0], [S("n18") - 0.4, 0], [S("n18") + 0.6, 0.85], [101.5, 0.7], [103.2, 0], [120.2, 0], [121.4, 0.6],
    [138.0, 0.6], [140.3, 1.0], [149.0, 0.9], [150.5, 0.45], [170.0, 0.45], [172.0, 0.95], [178.5, 0.95], [180, 0],
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
        return 0.34 * fade * lerp(1, 0.42, speaking(t));
      }}
    />
    <Audio
      name="BGM 分散和音"
      src={staticFile("bgm/arp.wav")}
      volume={(fr) => {
        const t = fr / FPS;
        return 0.3 * arpLevel(t) * lerp(1, 0.4, speaking(t));
      }}
    />
  </Sequence>
);

