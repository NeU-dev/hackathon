// 3分の発表動画（台本 v4 修正版）。場面は TransitionSeries でつなぎ、
// 音（ナレーション・効果音・BGM）と字幕は動画全体の時刻で重ねる。
import React from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { AbsoluteFill } from "remotion";
import { Captions } from "./components/Captions";
import { Grain, Vignette } from "./components/common";
import { Bgm, Narration, Sfx } from "./components/Sound";
import { Roles, Safety, EndLines } from "./scenes/Closing";
import { Demo } from "./scenes/Demo";
import { Desk } from "./scenes/Desk";
import { Sheets } from "./scenes/Sheets";
import { Concept, Maker } from "./scenes/Statement";
import { World } from "./scenes/World";
import { EASE, FPS, S } from "./lib/time";
import "./styles.css";

type Scene = { name: string; a: number; b: number; render: (from: number) => React.ReactNode; enter?: "fade" | "slide" };

// 場面の表示区間（秒）。隣どうしが重なる所がトランジションになる。
const scenes = (): Scene[] => [
  { name: "① 困りごと", a: 0, b: 12.3, render: (from) => <Desk from={from} state="before" /> },
  { name: "② 動機：助けられた、でも届かない", a: 11.9, b: 47.35, render: (from) => <World from={from} phase="motive" /> },
  { name: "③ 10枚", a: 46.95, b: S("n16") - 0.05, render: (from) => <Sheets from={from} /> },
  { name: "③ 戻るのは重い", a: S("n16") - 0.3, b: S("n17") - 0.25, render: (from) => <World from={from} phase="heavy" /> },
  { name: "③ だから、当事者の私が作りました", a: S("n17") - 0.4, b: 68.25, render: (from) => <Maker from={from} /> },
  { name: "④ コンセプト", a: 67.95, b: 77.2, render: (from) => <Concept from={from} /> },
  { name: "⑤ デモ", a: 76.9, b: 144.9, render: (from) => <Demo from={from} />, enter: "slide" },
  { name: "⑤ 動けた（書類）", a: 144.6, b: 150.3, render: (from) => <Desk from={from} state="done" /> },
  { name: "⑥ Claudeの役割", a: 150.0, b: 160.25, render: (from) => <Roles from={from} /> },
  { name: "⑥ 安全", a: 159.95, b: 170.25, render: (from) => <Safety from={from} /> },
  { name: "⑥ 続きが書ける", a: 169.95, b: 174.0, render: (from) => <Desk from={from} state="end" /> },
  { name: "⑥ 二文", a: 173.7, b: 180, render: (from) => <EndLines from={from} /> },
];

export const HackathonVideo: React.FC = () => {
  const list = scenes();
  const frames = list.map((s) => ({ ...s, fa: Math.round(s.a * FPS), fb: Math.round(s.b * FPS) }));
  return (
    <AbsoluteFill className="stage">
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
