import type { FrameNo, PaperStatus, Sheet } from '../types'
import { formatWhen } from './format'

export const FRAMES: { no: FrameNo; title: string }[] = [
  { no: 1, title: 'いま困っていること' },
  { no: 2, title: 'どんな場面か' },
  { no: 3, title: '今回の目標' },
  { no: 4, title: 'できそうなこと' },
  { no: 5, title: 'やってみること' },
  { no: 6, title: 'いつ・どこで・最初の2分' },
  { no: 7, title: 'やってみてどうだった' },
]

export const frameTitle = (n: FrameNo) => FRAMES[n - 1].title

/** 用紙に印刷された枠の番号 */
export const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦']

export const STATUS_LABEL: Record<PaperStatus, string> = {
  writing: '書いている途中',
  waiting: '実行待ち',
  done: 'できた',
  shelved: '置いてある',
}

export function isFilled(s: Sheet, n: FrameNo): boolean {
  switch (n) {
    case 1:
      return !!s.problem
    case 2:
      return !!s.scene
    case 3:
      return !!s.goal
    case 4:
      return s.ideas.length > 0
    case 5:
      return !!s.choice
    case 6:
      return !!s.plan
    case 7:
      return !!s.reflection
  }
}

/** ほんの少し明るくする枠。重なった紙なら書き直す枠、最初の紙なら次に書く1枠 */
export function brightFrames(s: Sheet): FrameNo[] {
  // やってみた結果まで書いた紙は、もう「ここから」を出さない（空いている枠が残っていても）
  if (isFilled(s, 7)) return []
  if (s.highlight?.length) return s.highlight.filter((n) => !isFilled(s, n))
  const next = ([1, 2, 3, 4, 5, 6] as FrameNo[]).find((n) => !isFilled(s, n))
  return next ? [next] : []
}

/** 紙の枠に印刷される文字 */
export function frameText(s: Sheet, n: FrameNo): string {
  switch (n) {
    case 1:
      return s.problem ?? ''
    case 2:
      return s.scene ?? ''
    case 3:
      return s.goal ?? ''
    case 4:
      return s.ideas.map((e) => `・${e.text}`).join('\n')
    case 5: {
      if (!s.choice) return ''
      const lines = [s.choice.idea]
      if (s.choice.tired) lines.push(`疲れている日でも：${s.choice.tired}`)
      if (s.choice.worry) lines.push(`心配なこと：${s.choice.worry}`)
      return lines.join('\n')
    }
    case 6:
      if (!s.plan) return ''
      return [`いつ：${formatWhen(s.plan.when)}`, `どこで：${s.plan.where}`, `最初の2分：${s.plan.first}`].join('\n')
    case 7:
      return s.reflection ?? ''
  }
}
