import { useEffect, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { FrameNo, Sheet } from '../types'
import { CIRCLED, FRAMES, brightFrames, frameText, isFilled } from '../lib/frames'
import { formatWhen } from '../lib/format'
import { NOT_DONE_TEXT, isDoneText } from '../store'
import { useUI } from '../ui'
import { useReduced } from '../lib/env'
import { Icon } from './Icon'
import { TypeText } from './TypeText'

interface Props {
  sheet: Sheet
  /** 何枚目の紙か（1始まり） */
  sheetNo: number
  /** 操作できる紙（いちばん上の紙）か。覗くだけの紙では false */
  live: boolean
  onOpen?: (n: FrameNo, el: HTMLElement) => void
}

type Phase = 'hold' | 'run' | undefined

/**
 * 記入用紙。印刷された部分（緑の特色）と、本人が書いた部分（ブルーブラックのペン）を分ける。
 * 枠ごとに形が違う：1行欄・複数行欄・リスト欄・表・チェック欄
 */
export function SheetFrames({ sheet, sheetNo, live, onOpen }: Props) {
  const bright = live ? brightFrames(sheet) : []
  const typing = useUI((s) => s.typing)
  const setUI = useUI((s) => s.setUI)
  const reduced = useReduced()
  const typingHere = live && typing?.sheetId === sheet.id ? typing : undefined

  // 文字が入り終わったら、入力中の印を外す
  useEffect(() => {
    if (typingHere?.phase !== 'run') return
    const t = setTimeout(() => setUI({ typing: undefined }), reduced ? 400 : 800)
    return () => clearTimeout(t)
  }, [typingHere?.phase, typingHere?.frame, reduced, setUI])

  const created = new Date(sheet.createdAt)

  return (
    <div data-form className="border-[1.5px] border-print-frame">
      <div className="flex items-start justify-between gap-3 border-b-[1.5px] border-print-frame px-3 pt-2.5 pb-2">
        <h2 className="pt-0.5 text-[1.0625rem] font-medium tracking-[0.5em] text-print">考える紙</h2>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-[0.75rem] text-print">
          {sheetNo > 1 && <span className="border border-print-frame px-1.5 leading-5">{sheetNo}枚目</span>}
          <span>
            記入日 <span data-date className="pen inline-block text-[0.875rem]">{`${created.getMonth() + 1}月${created.getDate()}日`}</span>
          </span>
        </div>
      </div>

      {FRAMES.map(({ no, title }) => {
        const filled = isFilled(sheet, no)
        const isBright = bright.includes(no)
        // 7番は紙から直接開けない。空の枠は「次に書く枠」だけ開ける
        const tappable = live && no !== 7 && (filled || isBright)
        const phase: Phase = typingHere?.frame === no ? typingHere.phase : undefined
        const text = frameText(sheet, no)

        const cls = [
          'block w-full border-print-line px-3 pt-2 pb-2.5 text-left transition-colors duration-500',
          no > 1 ? 'border-t' : '',
          isBright ? 'bg-paper-bright' : '',
          tappable ? 'cursor-pointer active:bg-print-tint/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-print' : '',
        ].join(' ')

        const inner = (
          <>
            <span className="flex items-baseline gap-1.5 text-[0.75rem] font-medium text-print">
              <span aria-hidden>{CIRCLED[no - 1]}</span>
              <span>{title}</span>
              {isBright && !filled && <span className="ml-auto text-[0.75rem] font-normal">ここから</span>}
            </span>
            <FrameBody sheet={sheet} no={no} phase={phase} reduced={reduced} />
          </>
        )
        const label = `${no} ${title}${filled ? '：' + text : isBright ? '（ここから）' : ''}`

        return tappable ? (
          <button
            key={no}
            type="button"
            data-frame-live={live ? no : undefined}
            data-bright={isBright || undefined}
            className={cls}
            aria-label={label}
            onClick={(e) => onOpen?.(no, e.currentTarget)}
          >
            {inner}
          </button>
        ) : (
          <section key={no} data-frame-live={live ? no : undefined} className={cls} aria-label={label}>
            {inner}
          </section>
        )
      })}
    </div>
  )
}

/** 本人が書いた文字。枠に入る瞬間だけタイプライター風に */
function Pen({ text, phase, reduced }: { text?: string; phase: Phase; reduced: boolean }) {
  if (!text) return null
  if (phase === 'hold') return null
  if (phase === 'run') return <TypeText text={text} reduced={reduced} />
  return <>{text}</>
}

/** 罫線つきの記入欄 */
function Field({ lines = 1, children }: { lines?: number; children?: ReactNode }) {
  return (
    <span className="field pen mt-0.5 block text-[1.0625rem] whitespace-pre-wrap" style={{ minHeight: `${lines * 1.875}rem` }}>
      {children}
    </span>
  )
}

function FrameBody({ sheet, no, phase, reduced }: { sheet: Sheet; no: FrameNo; phase: Phase; reduced: boolean }) {
  const pen = (text?: string) => <Pen text={text} phase={phase} reduced={reduced} />

  switch (no) {
    case 1:
      return <Field>{pen(sheet.problem)}</Field>
    case 2:
      return <Field lines={3}>{pen(sheet.scene)}</Field>
    case 3:
      return <Field>{pen(sheet.goal)}</Field>
    case 4: {
      const rows = Math.max(3, sheet.ideas.length)
      return (
        <span className="mt-0.5 block">
          {Array.from({ length: rows }, (_, i) => (
            <span key={sheet.ideas[i]?.id ?? i} className="field flex text-[1.0625rem]">
              <span aria-hidden className="w-5 shrink-0 text-print">
                ・
              </span>
              <span className="pen min-w-0 flex-1">{pen(sheet.ideas[i]?.text)}</span>
            </span>
          ))}
        </span>
      )
    }
    case 5:
      return (
        <>
          <Field>{pen(sheet.choice?.idea)}</Field>
          <SubField label="疲れている日でも">{pen(sheet.choice?.tired)}</SubField>
          <SubField label="心配なこと">{pen(sheet.choice?.worry)}</SubField>
        </>
      )
    case 6: {
      const rows: [string, string | undefined][] = [
        ['いつ', sheet.plan ? formatWhen(sheet.plan.when) : undefined],
        ['どこで', sheet.plan?.where],
        ['最初の2分', sheet.plan?.first],
      ]
      return (
        <span className="mt-1.5 grid grid-cols-[5.2em_1fr] border border-print-line">
          {rows.map(([label, value], i) => (
            <span key={label} className="contents">
              <span className={`bg-print-tint px-2 text-[0.75rem] leading-[2.125rem] text-print ${i > 0 ? 'border-t border-print-line' : ''}`}>{label}</span>
              <span className={`pen border-l border-print-line px-2 py-[3px] text-[1rem] leading-[1.75rem] ${i > 0 ? 'border-t' : ''}`}>{pen(value)}</span>
            </span>
          ))}
        </span>
      )
    }
    case 7: {
      const r = sheet.reflection
      const done = isDoneText(r)
      const notDone = !!r && r.startsWith(NOT_DONE_TEXT)
      const reason = notDone ? r.split('理由：')[1] : undefined
      // やった時のひとこと（「「相談したいことがあります」と送れた」）
      const note = done ? r?.split('\n')[1] : undefined
      return (
        <>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.8125rem] text-print">
            <Check on={done} phase={phase} reduced={reduced} label="できた" />
            <Check on={notDone} phase={phase} reduced={reduced} label="今回は進まなかった" />
            {done && phase !== 'hold' && <DoneStamp run={phase === 'run' && !reduced} />}
          </span>
          {note ? <SubField label="ひとこと">{pen(note)}</SubField> : <SubField label="理由">{pen(reason)}</SubField>}
        </>
      )
    }
  }
}

/** 「できた」の判子（使い方の6ページと同じ形）。チェックが入ったあとに押される */
function DoneStamp({ run }: { run: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="ml-auto flex -rotate-6 items-center gap-1 rounded-full border-2 border-accent px-3 py-0.5 text-[0.9375rem] font-medium text-accent"
      initial={run ? { scale: 1.6, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 18, delay: run ? 0.55 : 0 }}
    >
      <Icon name="check" size={16} />
      できた
    </motion.span>
  )
}

function SubField({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <span className="field mt-0.5 flex items-baseline gap-2">
      <span className="shrink-0 text-[0.75rem] text-print">{label}</span>
      <span className="pen min-w-0 flex-1 text-[0.9375rem]">{children}</span>
    </span>
  )
}

/** チェック欄。チェックはペンで書いたように */
function Check({ on, label, phase, reduced }: { on: boolean; label: string; phase: Phase; reduced: boolean }) {
  const show = on && phase !== 'hold'
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="relative grid h-[18px] w-[18px] place-items-center border-[1.5px] border-print-frame bg-white/50">
        {show && (
          <motion.svg
            viewBox="0 0 20 20"
            className="absolute -top-1 -left-0.5 h-6 w-6"
            initial={phase === 'run' && !reduced ? { pathLength: 0, opacity: 0 } : false}
            animate={{ opacity: 1 }}
          >
            <motion.path
              d="M3 11 L8 16 L18 3"
              fill="none"
              stroke="var(--color-pen)"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={phase === 'run' && !reduced ? { pathLength: 0 } : false}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
          </motion.svg>
        )}
      </span>
      <span>{label}</span>
      {on && <span className="sr-only">（チェックあり）</span>}
    </span>
  )
}
