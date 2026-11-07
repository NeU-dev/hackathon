import type { TargetAndTransition, Variants } from 'motion/react'

/**
 * 画面の切り替えの物差し。transitions.dev の motion tokens にそろえる。
 * - 入る・開くは少しゆっくり、出る・閉じるは速く（来る時はていねいに、去る時はあっさり）
 * - 動く距離は短く、そのぶん 2〜3px のぼかしを重ねて「入れ替わった」と分かるようにする
 * - カーブは1本（smooth-out）。弾ませるのは数字だけ
 * 紙・クリップボード・紙飛行機・泡（このアプリの見せ場）は、ここに寄せずにそれぞれの動きのまま
 */
export const EASE = [0.22, 1, 0.36, 1] as const
/** 数字が入る時だけ、少し行き過ぎて戻る */
export const EASE_POP = [0.34, 1.45, 0.64, 1] as const

export const DUR = {
  stagger: 0.04,
  quick: 0.15,
  fast: 0.25,
  resize: 0.3,
  medium: 0.35,
  slow: 0.4,
  verySlow: 0.5,
} as const

export const DIST = { micro: 4, base: 8, medium: 12, toast: 16, sheet: 40 } as const

const blur = (px: number) => `blur(${px}px)`
/** 入り終わったら filter を外す（残すと中の fixed の基準が変わり、描くのも重くなる） */
const settle = { filter: 'none' }

/** 全画面のページ（ふりかえり・相談メモ・相談先）：右から少しだけずれて、ぼかしを解きながら入る。戻る時は同じ向きへ速く */
export const pageScreen: Variants = {
  initial: { opacity: 0, x: DIST.base, filter: blur(3) },
  animate: { opacity: 1, x: 0, filter: blur(0), transition: { duration: DUR.fast, ease: EASE }, transitionEnd: settle },
  exit: { opacity: 0, x: DIST.base, filter: blur(3), transition: { duration: DUR.quick, ease: EASE } },
}

/** ページが上に重なっている間、下のページは左へ少しずれてぼける（並んだ2枚の、手前と奥） */
export const recede = (covered: boolean): TargetAndTransition =>
  covered
    ? { x: -DIST.base, filter: blur(3), transition: { duration: DUR.fast, ease: EASE } }
    : { x: 0, filter: blur(0), transition: { duration: DUR.fast, ease: EASE }, transitionEnd: settle }
/** 下がるページの最初の状態（filter を持たない。initial={false} だと blur(0px) が残るので、こちらを使う） */
export const recedeInitial = { x: 0, filter: 'none' }

/** 下に暗い幕を敷く重なり（設定・読むだけの紙） */
export const scrim: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DUR.fast, ease: EASE } },
  exit: { opacity: 0, transition: { duration: DUR.quick, ease: EASE } },
}

/** 真ん中に開く紙（読むだけの紙）：少し小さいところから */
export const modal: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: DUR.fast, ease: EASE } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: DUR.quick, ease: EASE } },
}

/** 下からせり上がる面（設定）：短くせり上がり、ぼかしを解く */
export const sheet: Variants = {
  initial: { opacity: 0, y: DIST.sheet, filter: blur(2) },
  animate: { opacity: 1, y: 0, filter: blur(0), transition: { duration: DUR.slow, ease: EASE }, transitionEnd: settle },
  exit: { opacity: 0, y: DIST.sheet, filter: blur(2), transition: { duration: DUR.medium, ease: EASE } },
}

/** 上から届く通知 */
export const toast: Variants = {
  initial: { opacity: 0, y: -DIST.toast, scale: 0.97, filter: blur(2) },
  animate: { opacity: 1, y: 0, scale: 1, filter: blur(0), transition: { duration: DUR.medium, ease: EASE }, transitionEnd: settle },
  exit: { opacity: 0, y: -DIST.toast, scale: 0.97, filter: blur(2), transition: { duration: DUR.fast, ease: EASE } },
}

/** 同じ枠の中で、段階が進む・戻る（dir：1＝進む、-1＝戻る）。古い段階は反対側へ抜ける */
export const step: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: DIST.base * dir, filter: blur(3) }),
  center: { opacity: 1, x: 0, filter: blur(0), transition: { duration: DUR.fast, ease: EASE }, transitionEnd: settle },
  exit: (dir: number) => ({ opacity: 0, x: -DIST.base * dir, filter: blur(3), transition: { duration: DUR.fast, ease: EASE } }),
}

/** 同じ場所の言葉が入れ替わる：古い言葉は少し上へぼけて消え、新しい言葉が下から入る */
export const swap: Variants = {
  enter: { opacity: 0, y: DIST.micro, filter: blur(2) },
  center: { opacity: 1, y: 0, filter: blur(0), transition: { duration: DUR.quick, ease: 'easeInOut' }, transitionEnd: settle },
  exit: { opacity: 0, y: -DIST.micro, filter: blur(2), transition: { duration: DUR.quick, ease: 'easeInOut' } },
}

/** 並んだ言葉・紙が、上から順に少しずつ浮かび上がる（i：何番目か） */
export const reveal = (i = 0): { initial: TargetAndTransition; animate: TargetAndTransition } => ({
  initial: { opacity: 0, y: DIST.medium, filter: blur(3) },
  animate: {
    opacity: 1,
    y: 0,
    filter: blur(0),
    transition: { duration: DUR.verySlow, ease: EASE, delay: i * DUR.stagger },
    transitionEnd: settle,
  },
})
