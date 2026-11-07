import { create } from 'zustand'
import type { FrameNo } from './types'

export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export interface Typing {
  sheetId: string
  frame: FrameNo
  phase: 'hold' | 'run'
}

/** 画面遷移などの一時的な状態（保存しない） */
interface UIState {
  view: 'drawer' | 'paper'
  paperId?: string
  work?: { frame: FrameNo; rect: Rect }
  /** 作業画面を閉じ始めた（紙へカメラが引いていく） */
  zoomBack?: boolean
  checkin: boolean
  /** 開くたびに変える（前の回の状態を持ち越さない） */
  checkinAt?: number
  help?: { serious: boolean }
  settings: boolean
  peek: boolean
  toastPaperId?: string
  typing?: Typing
  glowAt?: number
  shelvingId?: string
  flashCardId?: string
  /** E. ふりかえり */
  report: boolean
  /** ふりかえりから開く相談メモ */
  memo: boolean
  /** ふりかえりの根拠から覗く紙（読むだけ） */
  recordPeek?: { paperId: string; sheetNo: number }
  /** 使い方（最初に1回だけ。設定からもう一度見られる） */
  tutorial: boolean
  /** 紙を開いたら、そのまま開く枠（「もう一度」で紙を重ねた時に6番を開く）。soon：紙がはさまる演出を待たずにすぐ開く */
  openFrame?: { paperId: string; frame: FrameNo; soon?: boolean }

  openDrawer: (flashCardId?: string) => void
  openPaper: (paperId: string) => void
  openWork: (frame: FrameNo, rect: Rect) => void
  closeWork: () => void
  setUI: (patch: Partial<UIState>) => void
}

export const useUI = create<UIState>()((set) => ({
  view: 'drawer',
  checkin: false,
  settings: false,
  peek: false,
  report: false,
  memo: false,
  tutorial: false,

  openDrawer: (flashCardId) =>
    set({ view: 'drawer', paperId: undefined, work: undefined, checkin: false, peek: false, flashCardId }),
  openPaper: (paperId) =>
    set({ view: 'paper', paperId, work: undefined, checkin: false, peek: false, report: false, memo: false, recordPeek: undefined }),
  openWork: (frame, rect) => set({ work: { frame, rect } }),
  closeWork: () => set({ work: undefined, zoomBack: false }),
  setUI: (patch) => set(patch),
}))
