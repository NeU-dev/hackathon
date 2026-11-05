import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { FPS } from "../lib/time";

/** シーンの中での絶対時刻（秒）。from はそのシーンが始まる秒。 */
export const useT = (from: number) => from + useCurrentFrame() / FPS;

export type SceneProps = { from: number };

/** 差し替えが必要な所に出す札 */
export const PhTag: React.FC<{ label: string; children: React.ReactNode; right?: boolean; opacity?: number }> = ({
  label,
  children,
  right,
  opacity = 1,
}) => (
  <div className={`ph-tag${right ? " r" : ""}`} style={{ opacity }}>
    <b>{label}</b>
    {children}
  </div>
);

export const Person: React.FC<{
  id?: string;
  left: number;
  top: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ id, left, top, color, style }) => (
  <div className="person" id={id} style={{ left, top, color, ...style }}>
    <div className="hd" />
    <div className="bd" />
  </div>
);

/** 紙のざらつき（全体に薄く重ねる） */
export const Grain: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundImage: `url(${staticFile("noise.png")})`,
      opacity: 0.07,
      mixBlendMode: "multiply",
      pointerEvents: "none",
    }}
  />
);

/** 画面の四隅をほんの少し落とす（視線を中央へ） */
export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background: "radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 58%, rgba(40,28,10,0.16) 100%)",
      pointerEvents: "none",
    }}
  />
);
