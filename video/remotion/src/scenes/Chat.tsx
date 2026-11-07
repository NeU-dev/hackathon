// 上司とのチャット：① 相談できないまま3日（mode="before"）／⑤ 送れた（mode="sent"）
import React from "react";
import { Highlight } from "@remotion/rough-notation";
import { AbsoluteFill } from "remotion";
import { SceneProps, useT } from "../components/common";
import { at, atEnd, EASE, lerp, P, pop, S, settle } from "../lib/time";

const DRAFT = "お疲れさまです。ご相談したいことが…";
const DRAFT2 = "ご相談したいことが";

/** ① の入力欄：打っては消す */
function inputText(t: number) {
  const type = (s: string, a: number, b: number) => s.slice(0, Math.round(s.length * P(t, a, b, EASE.lin)));
  const erase = (s: string, a: number, b: number) => s.slice(0, Math.round(s.length * (1 - P(t, a, b, EASE.lin))));
  const t4 = S("n4"), t5 = at("n5", "言い出せない");
  if (t < 3.6) return type(DRAFT, 1.0, 3.2);
  if (t < 5.0) return erase(DRAFT, 3.7, 4.5);
  if (t < 6.6) return type("お疲れさまです。", 5.0, 5.8);
  if (t < 7.4) return erase("お疲れさまです。", 6.6, 7.1);
  if (t < t4) return "";
  if (t < t5) return type(DRAFT2, t4 + 0.1, t4 + 1.0);
  return erase(DRAFT2, t5, t5 + 0.6);
}

export const Chat: React.FC<SceneProps & { mode: "before" | "sent" }> = ({ from, mode }) => {
  const t = useT(from);
  const before = mode === "before";
  const local = t - from;
  const caretOn = Math.floor(local * 2) % 2 === 0;
  const text = before ? inputText(t) : "";
  // 今週の締切（「たとえば」で出る）
  const tEx = before ? at("n3", "たとえば") - 0.1 : -99;
  const panel = before ? settle(t, tEx, 0.6) : 1;
  const late = before ? pop(t, at("n3", "回らない"), 11) : 1;
  // 「3日」で見出しと日数
  const t2w = before ? at("n5", "3日") : -99;
  const head = before ? P(t, t2w - 0.2, t2w + 0.25, EASE.out) : 0;
  const hl = before ? P(t, t2w, atEnd("n5", "3日") + 0.3, EASE.io) : 0;
  const days = before ? Math.round(lerp(1, 3, P(t, t2w - 0.1, t2w + 0.5, EASE.out))) : 3;
  const daysIn = before ? pop(t, t2w - 0.1, 12) : 0;
  // ⑤ 送れた
  const sent = before ? 0 : pop(t, from + 0.35, 12);
  const cam = before ? 1 + 0.03 * P(t, 0, 15, EASE.lin) : 1.04 - 0.04 * P(local, 0, 5, EASE.out);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #EFE8DC 0%, #E6DDCD 100%)" }}>
      <AbsoluteFill style={{ scale: cam.toFixed(4) }}>
        <div className="chat-win">
          <div className="chat-head">
            <div className="chat-av">上</div>
            <div>
              <div className="chat-name">上司（〇〇さん）</div>
              <div className="chat-sub">チャット</div>
            </div>
            {before && (
              <div className="chat-days" style={{ opacity: Math.min(1, daysIn * 2), scale: lerp(0.7, 1, daysIn).toFixed(3) }}>
                相談しないまま <b>{days}</b>日
              </div>
            )}
          </div>
          <div className="chat-body">
            <div className="chat-date">11月3日</div>
            <div className="msg them">
              <div className="bubble-c">お疲れさまです。来週からの案件、よろしくお願いします。</div>
              <span className="msg-time">10:12</span>
            </div>
            <div className="chat-date">{before ? "今日" : "今日 11月9日"}</div>
            {!before && (
              <div className="msg me" style={{ opacity: Math.min(1, sent * 2), translate: `0px ${(24 * (1 - Math.min(1, sent))).toFixed(1)}px`, scale: lerp(0.9, 1, sent).toFixed(3) }}>
                <span className="msg-time">18:02 送信済み</span>
                <div className="bubble-c">相談したいことがあります</div>
              </div>
            )}
          </div>
          <div className="chat-input">
            <div className="chat-field">
              {text}
              {(before ? caretOn : false) && <span className="caret" />}
              {!text && <span className="ph">メッセージを入力</span>}
            </div>
            <div className="chat-send">送信</div>
          </div>
        </div>
        {before && (
          <div className="deadlines" style={{ opacity: panel, translate: `${(60 * (1 - panel)).toFixed(1)}px 0px` }}>
            <div className="dl-title">今週の締切</div>
            <div className="dl-row"><span className="dl-day">水</span><span className="dl-what">見積もり資料</span></div>
            <div className="dl-row"><span className="dl-day">木</span><span className="dl-what">定例レポート</span></div>
            <div className="dl-row">
              <span className="dl-day">金</span>
              <span className="dl-what">提案書の初稿</span>
              <span className="dl-late" style={{ opacity: Math.min(1, late * 2), scale: late.toFixed(3) }}>間に合わない</span>
            </div>
          </div>
        )}
      </AbsoluteFill>
      {before && (
        <div className="headline" style={{ top: 34, opacity: head, translate: `0px ${(-14 * (1 - head)).toFixed(1)}px` }}>
          <span>
            上司に相談できないまま、
            <Highlight progress={hl} color="rgba(222, 84, 64, 0.28)" iterations={1} padding={{ left: 4, right: 4, top: 2, bottom: 2 }}>
              3日
            </Highlight>
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
