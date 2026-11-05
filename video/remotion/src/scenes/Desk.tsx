// 机の上の書類：① 困りごと（before）／⑤ 動けたあと（done）／⑥ 締め（end）
import React from "react";
import { Highlight } from "@remotion/rough-notation";
import { AbsoluteFill } from "remotion";
import { PhTag, SceneProps, useT } from "../components/common";
import { at, En, EASE, P, pop, S, settle } from "../lib/time";

const WD = ["木", "金", "土", "日", "月", "火", "水"]; // 10/15 は木曜
const ZEN = "Zen Maru Gothic";

export const Desk: React.FC<SceneProps & { state: "before" | "done" | "end" }> = ({ from, state }) => {
  const t = useT(from);
  const before = state === "before";
  const local = t - from;

  // カメラ：before はゆっくり寄る。done / end は少し寄った所から引いて落ち着く
  const deskScale = before ? 1 + 0.06 * P(t, 0, 12, EASE.lin) : 1.06 - 0.06 * P(local, 0, 5.5, EASE.out);
  // カレンダー：2週間ぶん日付が進む
  const dayF = before ? 15 + 14 * P(t, S("n2") - 0.1, En("n2") + 0.5, EASE.lin) : 31;
  const day = Math.floor(dayF + 1e-6);
  const flip = before ? dayF - day : 0; // めくれる途中
  // 散らかっていくもの
  const clutter = [0, 1, 2, 3, 4].map((k) => (before ? pop(t, S("n2") + k * 0.7, 14) : k < 2 ? 1 : 0));
  const note2 = before ? pop(t, at("n3", "分かってる") - 0.3) : 0;
  // 動けたあと：返信用封筒がそっと置かれ、付せんにチェックが入る
  const envB = before ? 0 : settle(local, 0.15, 0.7);
  const check = before ? 0 : P(local, 0.9, 1.5, EASE.out);
  const hl1 = before ? P(t, at("n2", "2週間"), at("n2", "2週間") + 0.6, EASE.io) : 0;
  const head1 = before ? P(t, S("n2"), S("n2") + 0.45, EASE.out) : 0;
  const head2 = state === "end" ? P(t, S("n41") - 0.15, S("n41") + 0.3, EASE.out) : 0;
  const hl2 = state === "end" ? P(t, at("n41", "続き"), atEndSafe(), EASE.io) : 0;

  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, #E3D3B6 0%, #D3BE9B 60%, #C2AB86 100%)" }}>
      <div id="deskD" style={{ scale: String(deskScale) }}>
        <svg width={1920} height={1080} viewBox="0 0 1920 1080">
          <defs>
            <filter id="sh" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#3C280A" floodOpacity=".22" />
            </filter>
            <filter id="sh2" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#3C280A" floodOpacity=".22" />
            </filter>
          </defs>
          {/* マグカップ */}
          <g filter="url(#sh2)">
            <circle cx="330" cy="240" r="74" fill="#FBF8F2" stroke="#D8CCB6" strokeWidth="4" />
            <circle cx="330" cy="240" r="56" fill="#8B5E3C" />
            <rect x="398" y="226" width="44" height="28" rx="12" fill="#FBF8F2" stroke="#D8CCB6" strokeWidth="4" />
          </g>
          {/* スマホ（伏せてある） */}
          <g filter="url(#sh2)">
            <rect x="250" y="600" width="160" height="320" rx="28" fill="#34343A" transform="rotate(-12 330 760)" />
          </g>
          {/* レシートなど（日がたつと増える） */}
          {CLUTTER.map((c, k) => (
            <g key={k} filter="url(#sh2)" opacity={Math.min(1, clutter[k] * 1.5)} style={{ scale: String(0.6 + 0.4 * clutter[k]), transformOrigin: `${c.cx}px ${c.cy}px`, transformBox: "view-box" }}>
              {c.el}
            </g>
          ))}
          {/* 卓上カレンダー */}
          <g filter="url(#sh)" transform="rotate(4 1500 250)">
            <rect x="1380" y="110" width="250" height="270" rx="10" fill="#FFFFFF" />
            <rect x="1380" y="110" width="250" height="64" rx="10" fill="#DE5440" />
            <rect x="1380" y="150" width="250" height="24" fill="#DE5440" />
            <text x="1505" y="156" textAnchor="middle" fontSize="34" fontWeight="700" fill="#fff" fontFamily={ZEN}>10月</text>
            <g opacity={1 - 0.7 * Math.sin(Math.PI * flip)} transform={`translate(0 ${(-8 * Math.sin(Math.PI * flip)).toFixed(2)})`}>
              <text x="1505" y="305" textAnchor="middle" fontSize="120" fontWeight="700" fill="#2B2924" fontFamily={ZEN}>{day}</text>
              <text x="1505" y="356" textAnchor="middle" fontSize="28" fontWeight="700" fill="#988F81" fontFamily={ZEN}>{WD[(day - 15) % 7]}</text>
            </g>
          </g>
          {before ? (
            <>
              {/* 届いた封筒（未開封） */}
              <g filter="url(#sh)" transform="rotate(-4 900 520)">
                <rect x="520" y="340" width="760" height="360" rx="8" fill="#F1E3C6" stroke="#D2BE95" strokeWidth="3" />
                <rect x="600" y="410" width="340" height="120" rx="6" fill="#FBF6EA" stroke="#D2BE95" strokeWidth="2" />
                <text x="625" y="458" fontSize="28" fontWeight="700" fill="#5E584E" fontFamily={ZEN}>〇〇市 市民課</text>
                <text x="625" y="500" fontSize="22" fill="#988F81" fontFamily={ZEN}>〒000-0000</text>
                <rect x="980" y="560" width="230" height="84" rx="4" fill="none" stroke="#DE5440" strokeWidth="4" />
                <text x="1095" y="615" textAnchor="middle" fontSize="34" fontWeight="700" fill="#DE5440" fontFamily={ZEN}>住所変更届 在中</text>
                <rect x="1150" y="380" width="80" height="96" rx="4" fill="none" stroke="#C9B48C" strokeWidth="3" strokeDasharray="8 6" />
              </g>
              <g filter="url(#sh2)" transform="rotate(-7 1250 300)">
                <rect x="1170" y="220" width="170" height="160" fill="#FFE58A" />
                <text x="1255" y="318" textAnchor="middle" fontSize="46" fill="#5B4A1E" fontFamily="Klee One" fontWeight="600">出す！</text>
              </g>
              <g filter="url(#sh2)" opacity={Math.min(1, note2 * 1.5)} style={{ scale: String(0.7 + 0.3 * note2), transformOrigin: "645px 820px", transformBox: "view-box" }}>
                <g transform="rotate(6 640 820)">
                  <rect x="560" y="740" width="170" height="160" fill="#FFE58A" />
                  <text x="645" y="812" textAnchor="middle" fontSize="36" fill="#5B4A1E" fontFamily="Klee One" fontWeight="600">今週</text>
                  <text x="645" y="858" textAnchor="middle" fontSize="36" fill="#5B4A1E" fontFamily="Klee One" fontWeight="600">こそ</text>
                </g>
              </g>
            </>
          ) : (
            <>
              {/* 動けたあと：開けた封筒と、書き終えて封をした返信用封筒 */}
              <g filter="url(#sh)" transform="rotate(-10 430 560)">
                <rect x="170" y="420" width="520" height="250" rx="8" fill="#F1E3C6" stroke="#D2BE95" strokeWidth="3" />
                <path d="M170 428 l26 -12 l26 12 l26 -12 l26 12 l26 -12 l26 12 l26 -12 l26 12 l26 -12 l26 12 l26 -12 l26 12 l26 -12 l26 12 l26 -12 l26 12 l26 -12 l26 12 l26 -12 l26 12" fill="none" stroke="#D2BE95" strokeWidth="3" />
                <text x="210" y="520" fontSize="24" fontWeight="700" fill="#988F81" fontFamily={ZEN}>〇〇市 市民課</text>
              </g>
              <g filter="url(#sh)" opacity={Math.min(1, envB * 2)} transform={`translate(0 ${(-60 * (1 - envB)).toFixed(1)}) rotate(${(3 + 4 * (1 - envB)).toFixed(2)} 1000 540)`}>
                <rect x="640" y="360" width="740" height="350" rx="8" fill="#FBF8F2" stroke="#D8CCB6" strokeWidth="3" />
                <path d="M640 368 L1010 560 L1380 368" fill="none" stroke="#D8CCB6" strokeWidth="3" />
                <text x="1010" y="640" textAnchor="middle" fontSize="34" fontWeight="700" fill="#5E584E" fontFamily={ZEN}>返信用封筒</text>
                <circle cx="1010" cy="556" r="26" fill="none" stroke="#DE5440" strokeWidth="4" />
                <text x="1010" y="568" textAnchor="middle" fontSize="30" fontWeight="700" fill="#DE5440" fontFamily={ZEN}>〆</text>
              </g>
              <g filter="url(#sh2)" transform="rotate(-8 1250 300)">
                <rect x="1170" y="220" width="170" height="160" fill="#FFE58A" />
                <text x="1255" y="318" textAnchor="middle" fontSize="46" fill="#5B4A1E" fontFamily="Klee One" fontWeight="600">出す！</text>
                <path d="M1188 300 l40 40 l90 -110" fill="none" stroke="#2E7672" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - check} />
              </g>
            </>
          )}
        </svg>
      </div>
      {before && (
        <div className="headline" style={{ opacity: head1, translate: `0px ${(-14 * (1 - head1)).toFixed(1)}px` }}>
          <span>
            住所変更の書類、
            <Highlight progress={hl1} color="rgba(222, 84, 64, 0.28)" iterations={1} padding={{ left: 4, right: 4, top: 2, bottom: 2 }}>
              2週間
            </Highlight>
          </span>
        </div>
      )}
      {state === "end" && (
        <div className="headline" style={{ opacity: head2, translate: `0px ${(-14 * (1 - head2)).toFixed(1)}px` }}>
          <span>
            書いただけで終わった紙にも、
            <Highlight progress={hl2} color="rgba(240, 190, 94, 0.55)" iterations={1} padding={{ left: 4, right: 4, top: 2, bottom: 2 }}>
              続きが書ける
            </Highlight>
            。
          </span>
        </div>
      )}
      {before ? (
        <PhTag label="仮映像" opacity={P(t, 0.6, 1.1)}>書類（実物か、個人情報のない小道具）の撮影に差し替え</PhTag>
      ) : (
        <PhTag label="仮映像">封筒に入れた書類の撮影に差し替え（実際にやれた場合だけ）</PhTag>
      )}
    </AbsoluteFill>
  );
};

function atEndSafe() {
  return at("n41", "続き") + 0.8;
}

const CLUTTER: { cx: number; cy: number; el: React.ReactNode }[] = [
  {
    cx: 1520, cy: 655,
    el: (
      <>
        <rect x="1460" y="560" width="120" height="190" rx="3" fill="#FFFFFF" transform="rotate(9 1520 655)" />
        <path d="M1476 600h80M1476 624h64M1476 648h80M1476 672h50" stroke="#D3CBBE" strokeWidth="6" transform="rotate(9 1520 655)" />
      </>
    ),
  },
  {
    cx: 1600, cy: 725,
    el: (
      <>
        <rect x="1540" y="640" width="120" height="170" rx="3" fill="#FFFFFF" transform="rotate(-14 1600 725)" />
        <path d="M1556 676h80M1556 700h64M1556 724h80" stroke="#D3CBBE" strokeWidth="6" transform="rotate(-14 1600 725)" />
      </>
    ),
  },
  {
    cx: 270, cy: 460,
    el: (
      <>
        <rect x="150" y="380" width="240" height="160" rx="4" fill="#F7F3EA" transform="rotate(-6 270 460)" />
        <path d="M175 420h180M175 448h150M175 476h170" stroke="#D3CBBE" strokeWidth="7" transform="rotate(-6 270 460)" />
      </>
    ),
  },
  {
    cx: 1525, cy: 870,
    el: (
      <>
        <rect x="1420" y="800" width="210" height="140" rx="4" fill="#F7F3EA" transform="rotate(5 1525 870)" />
        <path d="M1440 836h160M1440 864h130" stroke="#D3CBBE" strokeWidth="7" transform="rotate(5 1525 870)" />
      </>
    ),
  },
  {
    cx: 560, cy: 900,
    el: (
      <>
        <circle cx="560" cy="900" r="60" fill="#FBF8F2" stroke="#D8CCB6" strokeWidth="4" />
        <circle cx="560" cy="900" r="44" fill="#B88A5E" opacity=".6" />
      </>
    ),
  },
];
