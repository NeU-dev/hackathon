import { useRef, useState, type ReactNode } from 'react'
import { motion, useIsPresent } from 'motion/react'
import type { Sheet } from '../types'
import { usePaper } from '../store'
import { useUI } from '../ui'
import { SheetFrames } from '../components/SheetFrames'
import { useBack, useDialogFocus } from '../lib/screens'
import { modal, scrim } from '../lib/motion'

/** 下の紙を覗く（読むだけ） */
export function PeekSheet({ paperId }: { paperId: string }) {
  const paper = usePaper(paperId)
  const setUI = useUI((s) => s.setUI)
  const lower = paper ? paper.sheets.slice(0, -1) : []
  if (!paper || lower.length === 0) return null
  return <SheetViewer sheets={lower} initial={lower.length - 1} onClose={() => setUI({ peek: false })} />
}

/** ふりかえりの根拠の紙を覗く（読むだけ）。紙そのものを開くこともできる */
export function RecordPeek({ paperId, sheetNo }: { paperId: string; sheetNo: number }) {
  const paper = usePaper(paperId)
  const ui = useUI()
  if (!paper) return null
  return (
    <SheetViewer
      sheets={paper.sheets}
      initial={Math.min(sheetNo, paper.sheets.length) - 1}
      onClose={() => ui.setUI({ recordPeek: undefined })}
      footer={
        <button type="button" onClick={() => ui.openPaper(paperId)} className="tactile mt-2 h-12 w-full shrink-0 rounded-xl text-[0.9375rem]">
          この紙を開く
        </button>
      }
    />
  )
}

function SheetViewer({ sheets, initial, onClose, footer }: { sheets: Sheet[]; initial: number; onClose: () => void; footer?: ReactNode }) {
  const [index, setIndex] = useState(initial)
  const present = useIsPresent()
  const dialog = useRef<HTMLDivElement>(null)
  useBack(onClose, present)
  useDialogFocus(dialog)
  const i = Math.min(index, sheets.length - 1)

  return (
    <motion.div className="fixed inset-0 z-[45]" style={{ pointerEvents: present ? 'auto' : 'none' }} initial="initial" animate="animate" exit="exit">
      <motion.button type="button" aria-label="閉じる" className="absolute inset-0 bg-scrim" onClick={onClose} variants={scrim} />
      <motion.div
        variants={modal}
        ref={dialog}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={`${i + 1}枚目の紙（読むだけ）`}
        className="pb-safe absolute inset-x-3 top-16 bottom-4 flex flex-col outline-none"
      >
        <div className="mb-2 flex items-center gap-1.5">
          {sheets.length > 1 &&
            sheets.map((s, n) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={n === i}
                onClick={() => setIndex(n)}
                className={`h-11 rounded-full px-3.5 text-[0.8125rem] ${n === i ? 'bg-paper text-ink' : 'bg-white/30 text-white'}`}
              >
                {n + 1}枚目
              </button>
            ))}
          <button type="button" onClick={onClose} className="ml-auto h-11 rounded-full bg-paper px-4 text-[0.8125rem]">
            閉じる
          </button>
        </div>
        <div className="paper-sheet min-h-0 flex-1 overflow-y-auto rounded-[3px] px-3 pt-3 pb-6">
          <p className="mb-3 text-[0.75rem] text-ink-soft">読むだけ</p>
          <SheetFrames sheet={sheets[i]} sheetNo={i + 1} live={false} />
        </div>
        {footer}
      </motion.div>
    </motion.div>
  )
}
