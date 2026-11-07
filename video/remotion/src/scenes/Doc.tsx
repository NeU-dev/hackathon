// 書けない企画書：① 開いては閉じて、もう3日（mode="before"）／⑤ 見出しが3つ書けた（mode="written"）
import React from "react";
import { Highlight } from "@remotion/rough-notation";
import { AbsoluteFill } from "remotion";
import { SceneProps, useT } from "../components/common";
import { at, atEnd, EASE, lerp, P, pop, S, settle } from "../lib/time";

const FILE = "企画書_新サービス案.docx";
const HEADS = ["1. 背景", "2. 提案", "3. スケジュール"];

/** ① 本文：打っては消す（何から書けばいいか分からない） */
function bodyText(t: number) {
  const type = (s: string, a: number, b: number) => s.slice(0, Math.round(s.length * P(t, a, b, EASE.lin)));
  const erase = (s: string, a: number, b: number) => s.slice(0, Math.round(s.length * (1 - P(t, a, b, EASE.lin))));
  if (t < 3.4) return type("はじめに、", 1.6, 2.6);
  if (t < 4.6) return erase("はじめに、", 3.4, 4.0);
  if (t < 6.2) return type("1. 背景", 4.7, 5.3);
  if (t < 7.2) return erase("1. 背景", 6.2, 6.7);
  return "";
}

export const Doc: React.FC<SceneProps & { mode: "before" | "written" }> = ({ from, mode }) => {
  const t = useT(from);
  const before = mode === "before";
  const local = t - from;
  const caretOn = Math.floor(local * 2) % 2 === 0;

  // 締切の付箋（「月曜締切」で出る）
  const tDl = before ? at("n3", "月曜") - 0.15 : -99;
  const note = before ? pop(t, tDl, 12) : 1;
  const dlHl = before ? P(t, at("n3", "月曜"), atEnd("n3", "締切") + 0.2, EASE.io) : 0;
  // 開いては閉じて：窓が一度しまわれて、また開く
  const tClose = before ? at("n4", "閉じて") - 0.1 : -99;
  const shut = before ? P(t, tClose, tClose + 0.25, EASE.io) * (1 - P(t, tClose + 0.55, tClose + 0.85, EASE.out)) : 0;
  // 「もう3日」で見出しと日数
  const t3 = before ? at("n4", "3日") : -99;
  const head = before ? P(t, t3 - 0.25, t3 + 0.2, EASE.out) : 0;
  const hl = before ? P(t, t3, atEnd("n4", "3日") + 0.3, EASE.io) : 0;
  const days = before ? Math.round(lerp(1, 3, P(t, t3 - 0.1, t3 + 0.5, EASE.out))) : 0;
  const daysIn = before ? pop(t, t3 - 0.1, 12) : pop(t, from + 1.2, 12);
  // ⑤ 書けた：見出しが3つ入る
  const typedHead = (k: number) => {
    if (before) return "";
    const a = from + 0.3 + k * 0.38;
    const s = HEADS[k];
    return s.slice(0, Math.round(s.length * P(t, a, a + 0.3, EASE.lin)));
  };
  const okIn = before ? 0 : pop(t, from + 1.5, 11);
  const winIn = before ? settle(t, from + 0.05, 0.6) : 1;
  const cam = before ? 1 + 0.03 * P(t, 0, 15, EASE.lin) : 1.04 - 0.04 * P(local, 0, 5, EASE.out);
  const text = before ? bodyText(t) : "";

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #EFE8DC 0%, #E6DDCD 100%)" }}>
      <AbsoluteFill style={{ scale: cam.toFixed(4) }}>
        <div
          style={{
            position: "absolute", left: 140, top: 170, width: 1060, height: 740, background: "#FFFFFF", borderRadius: 22, overflow: "hidden",
            boxShadow: "0 2px 4px rgba(60,40,10,.08), 0 24px 60px rgba(60,40,10,.16)",
            opacity: winIn * (1 - 0.85 * shut), scale: (lerp(0.94, 1, winIn) * (1 - 0.6 * shut)).toFixed(4), transformOrigin: "50% 120%",
          }}
        >
          {/* タイトルバー */}
          <div style={{ height: 70, display: "flex", alignItems: "center", gap: 12, padding: "0 26px", background: "#F4F1EA", borderBottom: "2px solid #E8E1D4" }}>
            {["#E8806E", "#E9C46A", "#8DC07A"].map((c) => <i key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c, display: "inline-block" }} />)}
            <span style={{ marginLeft: 18, fontSize: 24, fontWeight: 700, color: "var(--ink-2)" }}>{FILE}</span>
            <span
              style={{
                marginLeft: "auto", fontSize: 22, fontWeight: 700, borderRadius: 30, padding: "6px 18px 8px",
                color: before ? "var(--accent)" : "var(--teal)", background: before ? "var(--accent-soft)" : "var(--teal-soft)",
                opacity: Math.min(1, daysIn * 2), scale: lerp(0.7, 1, Math.min(daysIn, 1.1)).toFixed(3),
              }}
            >
              {before ? <>最終更新：<b style={{ fontSize: 30 }}>{days}</b>日前</> : "最終更新：たった今"}
            </span>
          </div>
          {/* 道具の段 */}
          <div style={{ height: 54, display: "flex", alignItems: "center", gap: 26, padding: "0 30px", borderBottom: "2px solid #F0EBE2", color: "#A99F90", fontSize: 22, fontWeight: 700 }}>
            <span>B</span><span style={{ fontStyle: "italic" }}>I</span><span style={{ textDecoration: "underline" }}>U</span><span>見出し ▾</span><span>・ ─</span>
          </div>
          {/* 紙面 */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 124, bottom: 0, background: "#F2EEE6" }}>
            <div style={{ position: "absolute", left: 130, right: 130, top: 34, bottom: -40, background: "#fff", boxShadow: "0 2px 10px rgba(60,40,10,.10)", padding: "56px 70px" }}>
              <div style={{ fontSize: 40, fontWeight: 700, color: "#C9C0B0" }}>（タイトル）</div>
              <div style={{ marginTop: 34, fontSize: 30, lineHeight: 1.9, color: "var(--ink)", minHeight: 60 }}>
                {before ? (
                  <>
                    {text}
                    {caretOn && <span className="caret" />}
                  </>
                ) : (
                  HEADS.map((h, k) => (
                    <div key={h} style={{ fontWeight: 700, fontSize: 32 }}>
                      {typedHead(k)}
                      {k === 2 && typedHead(2) === HEADS[2] && caretOn && <span className="caret" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 締切の付箋 */}
        <div
          style={{
            position: "absolute", left: 1290, top: 250, width: 440, padding: "30px 36px 34px", background: "#FFF3C4", borderRadius: 6, rotate: "2deg",
            boxShadow: "0 2px 4px rgba(60,40,10,.10), 0 14px 30px rgba(60,40,10,.14)", opacity: Math.min(1, note * 2), scale: lerp(0.8, 1, Math.min(note, 1.1)).toFixed(4),
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink-2)" }}>締切</div>
          <div style={{ fontSize: 64, fontWeight: 700, marginTop: 6 }}>
            <Highlight progress={dlHl} color="rgba(222, 84, 64, 0.22)" iterations={1} padding={{ left: 4, right: 4, top: 2, bottom: 2 }}>
              11/16（月）
            </Highlight>
          </div>
          <div style={{ fontSize: 26, color: "var(--ink-2)", marginTop: 10 }}>企画書（新サービス案）</div>
          {!before && (
            <div style={{ marginTop: 16, fontSize: 26, fontWeight: 700, color: "var(--teal)", opacity: Math.min(1, okIn * 2), scale: okIn.toFixed(3), transformOrigin: "0 50%" }}>
              見出し 3/3 ✓
            </div>
          )}
        </div>
      </AbsoluteFill>
      {before && (
        <div className="headline" style={{ top: 34, opacity: head, translate: `0px ${(-14 * (1 - head)).toFixed(1)}px` }}>
          <span>
            開いては閉じて、もう
            <Highlight progress={hl} color="rgba(222, 84, 64, 0.28)" iterations={1} padding={{ left: 4, right: 4, top: 2, bottom: 2 }}>
              3日
            </Highlight>
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** 効果音用：① の時刻 */
export const docTimes = () => ({ deadline: at("n3", "月曜") - 0.15, close: at("n4", "閉じて") - 0.1, days: at("n4", "3日"), start: S("n1") });
