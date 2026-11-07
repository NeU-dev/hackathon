import { useEffect, useId, useState, type ReactNode } from 'react'
import type { Evidence, Reflection, ReportLine } from '../types'
import { usePapers } from '../store'
import { useUI } from '../ui'
import { analyzeRecords } from '../claude'
import { countRecords, formatDay, type Counts } from '../lib/records'
import { Icon } from './Icon'

/**
 * ふりかえりの部品。数はプログラムが数え（countRecords）、文面はダミーの Claude 関数が作る（analyzeRecords）
 */
export function useReflection(): { counts: Counts; reflection: Reflection } | undefined {
  const papers = usePapers((s) => s.papers)
  const [state, setState] = useState<{ counts: Counts; reflection: Reflection }>()
  useEffect(() => {
    let alive = true
    const counts = countRecords(papers)
    analyzeRecords(papers, counts).then((reflection) => alive && setState({ counts, reflection }))
    return () => {
      alive = false
    }
  }, [papers])
  return state
}

/** 根拠の日付は、新しい順に4つまで見せる（多いと読めなくなるので、残りは数だけ） */
const SHOW_DATES = 4

/** 根拠になった紙の日付。押すとその紙が開く（読むだけ） */
export function EvidenceDates({ evidence: all }: { evidence: Evidence[] }) {
  const setUI = useUI((s) => s.setUI)
  if (all.length === 0) return null
  const evidence = [...all].sort((a, b) => b.date - a.date).slice(0, SHOW_DATES)
  const rest = all.length - evidence.length
  return (
    <div className="-mx-1.5 mt-0.5 flex flex-wrap items-center">
      <span className="px-1.5 text-[0.75rem] text-ink-soft">根拠の紙</span>
      {evidence.map((e) => (
        <button
          key={`${e.paperId}-${e.sheetNo}`}
          type="button"
          onClick={() => setUI({ recordPeek: { paperId: e.paperId, sheetNo: e.sheetNo } })}
          className="inline-flex min-h-11 items-center rounded-md px-1.5 text-[0.8125rem] text-print underline decoration-print-frame underline-offset-4 active:bg-print-tint"
        >
          {formatDay(e.date)}
          {e.sheetNo > 1 && <span className="text-[0.75rem]">（{e.sheetNo}枚目）</span>}
        </button>
      ))}
      {rest > 0 && <span className="px-1.5 text-[0.75rem] text-ink-soft">ほか{rest}枚</span>}
    </div>
  )
}

/** 本人が書いた言葉（前 → 後）。ペンの字で */
export function Quotes({ quotes, labels = ['', ''] }: { quotes: NonNullable<ReportLine['quotes']>; labels?: [string, string] }) {
  return (
    <ul className="mt-1.5 flex flex-col gap-2">
      {quotes.map((q) => (
        <li key={q.before + q.after} className="text-[0.9375rem] leading-snug">
          <span className="text-[0.75rem] text-ink-soft">{labels[0]}</span>
          <span className="pen">「{q.before}」</span>
          <span className="flex items-baseline gap-1">
            <span aria-label="から" className="text-print">→</span>
            <span>
              <span className="text-[0.75rem] text-ink-soft">{labels[1]}</span>
              <span className="pen">「{q.after}」</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * たたみ表示。押すと中身が開く（根拠・書き方の変化）。
 * 高さは grid の行で伸び縮み（.fold）、矢印は上下に裏返る（.flip）。閉じている間の中身は、押せず読み上げもしない
 */
export function Fold({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="-mx-1.5 flex min-h-11 items-center gap-1 rounded-md px-1.5 text-[0.8125rem] font-medium text-print active:bg-print-tint"
      >
        <span className="flip inline-flex" data-open={open}>
          <Icon name="chevron" size={16} />
        </span>
        {label}
      </button>
      <div id={id} className="fold" data-open={open} inert={!open}>
        <div>
          <div className="pb-3">{children}</div>
        </div>
      </div>
    </div>
  )
}

/** 根拠の中身：見出しと、各行（本人の言葉・根拠の紙の日付つき） */
export function ReportLines({ title, lines }: { title: string; lines: ReportLine[] }) {
  return (
    <div className="mt-1 first:mt-0">
      <p className="text-[0.75rem] text-print">{title}</p>
      {lines.map((l) => (
        <div key={l.text} className="mt-0.5">
          <p className="text-[0.9375rem] leading-relaxed">{l.text}</p>
          {l.quotes && <Quotes quotes={l.quotes} />}
          <EvidenceDates evidence={l.evidence} />
        </div>
      ))}
    </div>
  )
}
