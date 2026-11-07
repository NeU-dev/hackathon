// 3分の発表動画（台本 v5：上司に相談できない／紙の問題。初見で分かりにくい所を直した版）。場面は TransitionSeries でつなぎ、
// 音（ナレーション・効果音・BGM）と字幕は動画全体の時刻で重ねる。
import React from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { AbsoluteFill } from "remotion";
import { Captions } from "./components/Captions";
import { Grain, Vignette } from "./components/common";
import { Bgm, Narration, Sfx } from "./components/Sound";
import { Chat } from "./scenes/Chat";
import { EndLines, EndPapers, Roles } from "./scenes/Closing";
import { Demo } from "./scenes/Demo";
import { Sheets } from "./scenes/Sheets";
import { Concept, Maker } from "./scenes/Statement";
import { Wall3D } from "./scenes/Wall3D";
import { World } from "./scenes/World";
import { EASE, FPS, S } from "./lib/time";
import { W } from "./lib/warp";
import "./styles.css";

// 壁の場面：true で Blender の3D（public/wall3d/ が要る）、false で2Dの図
const WALL_3D = true;
const Wall: React.FC<{ from: number; phase: "motive" | "heavy" }> = (p) => (WALL_3D ? <Wall3D {...p} /> : <World {...p} />);

type Scene = { name: string; a: number; b: number; render: (from: number) => React.ReactNode; enter?: "fade" | "slide" };

// 場面の表示区間（秒）。隣どうしが重なる所がトランジションになる。
const scenes = (): Scene[] => [
  { name: "① 困りごと：上司に相談できない", a: 0, b: 15.3, render: (from) => <Chat from={from} mode="before" /> },
  { name: "② 動機：助けられた、でも届かない", a: 14.9, b: 63.5, render: (from) => <Wall from={from} phase="motive" /> },
  { name: "③ 10枚と紙の問題", a: 63.1, b: S("n21") - 0.05, render: (from) => <Sheets from={from} /> },
  { name: "③ 止まった問題に戻る重さ", a: S("n21") - 0.3, b: S("n22") - 0.25, render: (from) => <Wall from={from} phase="heavy" /> },
  { name: "③ だから、当事者の私が作りました", a: S("n22") - 0.4, b: 94.25, render: (from) => <Maker from={from} /> },
  { name: "④ コンセプト：誰でも。何度でも。", a: 93.95, b: 103.7, render: (from) => <Concept from={from} /> },
  { name: "⑤ デモ", a: 103.4, b: W(147.6), render: (from) => <Demo from={from} />, enter: "slide" },
  { name: "⑤ 送れた（チャット）", a: W(147.3), b: W(154.3), render: (from) => <Chat from={from} mode="sent" /> },
  { name: "⑥ Claudeは答えを出さない", a: W(153.95), b: S("n48") - 0.3, render: (from) => <Roles from={from} /> },
  { name: "⑥ 止まったままの問題", a: S("n48") - 0.6, b: S("n49") - 0.4, render: (from) => <EndPapers from={from} /> },
  { name: "⑥ 問題解決技法を、誰でも。何度でも。", a: S("n49") - 0.7, b: 180, render: (from) => <EndLines from={from} /> },
];

export const HackathonVideo: React.FC = () => {
  const frames = scenes().map((s) => ({ ...s, fa: Math.round(s.a * FPS), fb: Math.round(s.b * FPS) }));
  return (
    <AbsoluteFill className="stage" lang="ja">
      <TransitionSeries name="場面">
        {frames.map((s, i) => {
          const prev = frames[i - 1];
          const overlap = prev ? prev.fb - s.fa : 0;
          return (
            <React.Fragment key={s.name}>
              {overlap > 0 && (
                <TransitionSeries.Transition
                  presentation={s.enter === "slide" ? slide({ direction: "from-right" }) : fade()}
                  timing={linearTiming({ durationInFrames: overlap, easing: EASE.io })}
                />
              )}
              <TransitionSeries.Sequence name={s.name} durationInFrames={s.fb - s.fa}>
                {s.render(s.fa / FPS)}
              </TransitionSeries.Sequence>
            </React.Fragment>
          );
        })}
      </TransitionSeries>
      <Vignette />
      <Grain />
      <Captions />
      <Narration />
      <Sfx />
      <Bgm />
    </AbsoluteFill>
  );
};
