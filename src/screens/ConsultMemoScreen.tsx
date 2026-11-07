import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import type { ConsultMemo, Paper } from '../types'
import { usePapers } from '../store'
import { useUI } from '../ui'
import { useBack, useDialogFocus } from '../lib/screens'
import { collectRecords, countRecords, formatDay, writtenPapers } from '../lib/records'
import { analyzeRecords, buildConsultMemo } from '../claude'
import { Icon } from '../components/Icon'
import { HelpLink } from '../components/HelpButton'
import { StepSwap } from '../components/Motion'
import { DUR, EASE, pageScreen } from '../lib/motion'

type Step = 'pick' | 'edit' | 'done' | 'show'
/** 段階の並び（進むと右から、戻ると左から入る） */
const ORDER: Step[] = ['pick', 'edit', 'done', 'show']
type Range = 'all' | '1m' | '3m'

const RANGES: { value: Range; label: string; days?: number }[] = [
  { value: 'all', label: 'すべて' },
  { value: '3m', label: '直近3か月', days: 90 },
  { value: '1m', label: '直近1か月', days: 30 },
]
const MAX = 3
const DAY = 24 * 3600_000

/**
 * 相談メモ（脇役。本人が選んだ時だけ）。
 * 期間と紙（1〜3件）を本人が選ぶ → 下書きを全文確認・編集 → 確定 → 印刷（PDF）か画面で見せて、本人が手渡す。
 * どこにも自動で送らない
 */
export function ConsultMemoScreen() {
  const setUI = useUI((s) => s.setUI)
  const all = usePapers((s) => s.papers)
  const present = useIsPresent()
  const root = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<Step>('pick')
  const [range, setRange] = useState<Range>('all')
  // 初めは何も選ばない（入れる紙は本人が決める）
  const [picked, setPicked] = useState<string[]>([])
  const [memo, setMemo] = useState<ConsultMemo>()
  const [busy, setBusy] = useState(false)
  useDialogFocus(root)

  const now = useMemo(() => Date.now(), [])
  const days = RANGES.find((r) => r.value === range)?.days
  const inRange = useMemo(() => writtenPapers(all).filter((p) => !days || p.createdAt >= now - days * DAY), [all, days, now])
  const choices = [...inRange].reverse()
  const selected = inRange.filter((p) => picked.includes(p.id))

  const back = () => {
    if (step === 'show') setStep('done')
    else if (step === 'done') setStep('edit')
    else if (step === 'edit') setStep('pick')
    else setUI({ memo: false })
  }
  useBack(back, present)

  const draft = async () => {
    if (busy || selected.length === 0) return
    setBusy(true)
    const counts = countRecords(inRange, now)
    const reflection = await analyzeRecords(inRange, counts)
    const from = days ? now - days * DAY : counts.from
    const period = from ? `${formatDay(from)}〜${formatDay(now)}` : ''
    setMemo(await buildConsultMemo(selected, counts, reflection, period))
    setBusy(false)
    setStep('edit')
  }

  // 画面で見せている間も、下は「確定」の段階のまま（白い紙が上に重なるだけ）
  const pane = step === 'show' ? 'done' : step
  const prevPane = useRef(pane)
  const dir = useRef(1)
  if (prevPane.current !== pane) {
    dir.current = ORDER.indexOf(pane) > ORDER.indexOf(prevPane.current) ? 1 : -1
    prevPane.current = pane
  }
  // 次の段階は、いちばん上から読めるように
  useLayoutEffect(() => {
    root.current?.scrollTo({ top: 0 })
  }, [pane])

  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX ? cur : [...cur, id]))

  return (
    <motion.div
      ref={root}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label="相談メモ"
      className="desk-calm fixed inset-x-0 z-[42] flex flex-col overflow-y-auto overscroll-contain outline-none"
      style={{ top: 'var(--vvt)', height: 'var(--vvh)', pointerEvents: present ? 'auto' : 'none' }}
      variants={pageScreen}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <header className="pt-safe sticky top-0 z-10 flex items-center justify-between bg-desk-calm px-2 pb-1 shadow-[0_1px_0_rgb(90_70_40/0.14)]">
        <button type="button" onClick={back} className="flex h-11 min-w-11 items-center gap-1 rounded-full px-3 text-[0.875rem] text-ink active:bg-black/5">
          <Icon name="back" /> {step === 'pick' ? 'ふりかえり' : step === 'edit' ? '紙を選びなおす' : step === 'done' ? '直す' : '戻る'}
        </button>
        <HelpLink />
      </header>

      <StepSwap id={pane} dir={dir.current} resize={false} outerClassName="flex flex-1 flex-col" className="flex flex-1 flex-col">
      {pane === 'pick' && (
        <div className="flex flex-1 flex-col px-3 pt-3">
          <h1 className="px-1 text-[1.375rem] font-medium">相談メモをつくる</h1>
          <p className="mt-1.5 px-1 text-[0.875rem] leading-relaxed text-ink">入れる紙を、1〜3件選んでください。選んだ紙のことだけが、メモに入ります。</p>

          <p className="mt-5 mb-1.5 px-1 text-[0.8125rem] text-ink-soft">期間</p>
          <div role="radiogroup" aria-label="期間" className="flex gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={range === r.value}
                onClick={() => {
                  setRange(r.value)
                  setPicked([])
                }}
                className={`h-11 flex-1 rounded-full border text-[0.875rem] ${range === r.value ? 'border-accent bg-accent-soft text-accent' : 'border-ink/20 bg-paper/80 text-ink'}`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <p className="mt-5 mb-1.5 flex items-baseline justify-between px-1 text-[0.8125rem] text-ink-soft">
            <span>紙</span>
            <span aria-live="polite">
              {picked.length}件 選んでいます（3件まで）
            </span>
          </p>
          <ul className="flex flex-col gap-2 pb-4">
            {choices.length === 0 && <li className="px-1 py-6 text-center text-[0.875rem] text-ink">この期間の紙はありません</li>}
            {choices.map((p) => {
              const on = picked.includes(p.id)
              const full = !on && picked.length >= MAX
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={full}
                    onClick={() => toggle(p.id)}
                    className={`paper-sheet flex min-h-14 w-full items-center gap-3 rounded-[6px] px-3.5 py-2.5 text-left disabled:opacity-55 ${on ? 'ring-2 ring-accent' : ''}`}
                  >
                    <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-[4px] border-[1.5px] ${on ? 'border-accent bg-accent text-paper-bright' : 'border-print-frame bg-paper-bright'}`}>
                      {on && <Icon name="check" size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="pen block truncate text-[1rem]">{p.sheets[0].problem}</span>
                      <span className="mt-0.5 block text-[0.75rem] text-ink-soft">
                        {formatDay(p.createdAt)}・{resultSummary(p)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="pb-safe sticky bottom-0 -mx-3 mt-auto bg-gradient-to-t from-desk-calm via-desk-calm/95 to-desk-calm/0 px-3 pt-4 pb-4">
            <button type="button" disabled={selected.length === 0 || busy} onClick={draft} className="tactile-accent h-14 w-full rounded-xl text-[1rem] font-medium">
              {busy ? '下書きを書いています' : '下書きをつくる'}
            </button>
          </div>
        </div>
      )}

      {memo && (pane === 'edit' || pane === 'done') && (
        <div className="flex flex-1 flex-col px-3 pt-3" inert={step === 'show'}>
          <p className="px-1 text-[0.875rem] leading-relaxed text-ink">
            {step === 'edit' ? '下書きです。色のついたところは、押すと書き換えられます。' : 'このメモは、どこにも送られません。印刷するか、画面を見せて手渡してください。'}
          </p>
          <div className="mt-3">
            <MemoDoc memo={memo} editing={step === 'edit'} onChange={setMemo} />
          </div>
          <div className="pb-safe sticky bottom-0 -mx-3 mt-auto flex gap-2 bg-gradient-to-t from-desk-calm via-desk-calm/95 to-desk-calm/0 px-3 pt-5 pb-4">
            {step === 'edit' ? (
              <button type="button" onClick={() => setStep('done')} className="tactile-accent h-14 flex-1 rounded-xl text-[1rem] font-medium">
                この内容で確定
              </button>
            ) : (
              <>
                <button type="button" onClick={() => window.print()} className="tactile-accent flex h-14 flex-1 items-center justify-center gap-1.5 rounded-xl text-[0.9375rem] font-medium">
                  印刷する（PDF）
                </button>
                <button type="button" onClick={() => setStep('show')} className="tactile h-14 flex-1 rounded-xl text-[0.9375rem]">
                  画面で見せる
                </button>
              </>
            )}
          </div>
        </div>
      )}
      </StepSwap>

      {/* 画面で見せる：白い紙を画面いっぱいに */}
      <AnimatePresence>
        {memo && step === 'show' && (
          <motion.div
            className="fixed inset-0 z-10 overflow-y-auto bg-white"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: DUR.fast, ease: EASE } }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: DUR.quick, ease: EASE } }}
          >
            <div className="pt-safe sticky top-0 flex justify-end bg-white/95 px-2 pb-1">
              <button type="button" onClick={() => setStep('done')} className="h-11 rounded-full px-4 text-[0.875rem] text-ink-soft active:bg-black/5">
                閉じる
              </button>
            </div>
            <div className="pb-safe px-1 pb-8">
              <MemoDoc memo={memo} editing={false} large />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 印刷するのは、確定したメモだけ */}
      {memo && (step === 'done' || step === 'show') &&
        createPortal(
          <div className="print-only">
            <MemoDoc memo={memo} editing={false} print />
          </div>,
          document.body,
        )}
    </motion.div>
  )
}

/** 紙ごとの結果（実行／今回は見送り／まだ） */
function resultSummary(p: Paper) {
  const label = { done: '実行', partial: '一部', skipped: '今回は見送り' } as const
  const recs = collectRecords([p])
  if (recs.length === 0) return 'まだ計画なし'
  return recs.map((r) => (r.result ? label[r.result] : 'まだ')).join(' → ')
}

const PAPER_ROWS = [
  { key: 'problem', label: '問題' },
  { key: 'goal', label: '目標' },
  { key: 'method', label: '選んだ方法と最初の一歩' },
  { key: 'result', label: '結果' },
  { key: 'reason', label: '動きにくかった条件（本人の言葉）' },
  { key: 'changed', label: '次に変えたこと' },
] as const

/** A4一枚の相談メモ。editing の時は、本人が全文を書き換えられる */
function MemoDoc({ memo, editing, onChange, large, print }: { memo: ConsultMemo; editing: boolean; onChange?: (m: ConsultMemo) => void; large?: boolean; print?: boolean }) {
  const set = (patch: Partial<ConsultMemo>) => onChange?.({ ...memo, ...patch })
  const topics = editing ? memo.topics : memo.topics.filter((t) => t.trim())
  const h2 = 'mt-4 mb-1.5 border-b border-ink/60 pb-0.5 text-[0.9375rem] font-bold'
  const dt = 'text-[0.75rem] text-ink-soft pt-0.5'

  return (
    <article
      className={`${print ? '' : 'rounded-[3px] bg-white px-4 py-5 shadow-[0_1px_2px_rgb(60_40_15/0.18),0_6px_18px_-6px_rgb(60_40_15/0.35)]'} ${large ? 'text-[1.0625rem]' : 'text-[0.875rem]'} leading-relaxed text-ink`}
    >
      <h1 className="text-[1.125rem] leading-snug font-bold">{memo.title}</h1>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="shrink-0">期間：</span>
        <Editable value={memo.period} editing={editing} onChange={(v) => set({ period: v })} label="期間" />
      </div>
      <p className="mt-1 text-[0.75rem] text-ink-soft">※ {memo.note}</p>

      <h2 className={h2}>1. 30秒サマリー</h2>
      <dl className="grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1.5">
        <dt className={dt}>取り組み量</dt>
        <dd>
          <Editable value={memo.amount} editing={editing} onChange={(v) => set({ amount: v })} label="取り組み量" />
        </dd>
        <dt className={dt}>うまくいった条件</dt>
        <dd>
          <Editable value={memo.condition || (editing ? '' : '—')} editing={editing} onChange={(v) => set({ condition: v })} label="うまくいった条件" />
        </dd>
        {topics.length > 0 && (
          <>
            <dt className={dt}>今日話したいこと</dt>
            <dd>
              <ol className="flex flex-col gap-1">
                {topics.map((t, i) => (
                  <li key={i} className="flex items-baseline gap-1">
                    <span className="shrink-0 tabular-nums">{i + 1}.</span>
                    <Editable
                      value={t}
                      editing={editing}
                      placeholder={i === 0 ? '本人が書く' : '（書かなくても大丈夫）'}
                      onChange={(v) => set({ topics: memo.topics.map((x, j) => (j === i ? v : x)) })}
                      label={`今日話したいこと${i + 1}`}
                    />
                  </li>
                ))}
              </ol>
            </dd>
          </>
        )}
      </dl>

      <h2 className={h2}>2. 選んだ紙の経過</h2>
      <div className="flex flex-col gap-3">
        {memo.papers.map((p, i) => (
          <section key={p.paperId} className="break-inside-avoid">
            <h3 className="mb-1 text-[0.8125rem] font-bold">
              {p.date}の紙
            </h3>
            <dl className="grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1 border-l-2 border-ink/20 pl-2">
              {PAPER_ROWS.map((row) => (
                <div key={row.key} className="contents">
                  <dt className={dt}>{row.label}</dt>
                  <dd>
                    <Editable
                      value={p[row.key]}
                      editing={editing}
                      onChange={(v) => set({ papers: memo.papers.map((x, j) => (j === i ? { ...x, [row.key]: v } : x)) })}
                      label={`${p.date}の紙の${row.label}`}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <h2 className={h2}>3. 記録から見えた傾向（参考）</h2>
      {memo.trends.length === 0 ? (
        <p className="text-ink-soft">まだ傾向とは言えません。</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {memo.trends.map((t, i) => (
            <li key={i} className="flex items-baseline gap-1">
              <span aria-hidden className="shrink-0">・</span>
              <Editable value={t} editing={editing} onChange={(v) => set({ trends: memo.trends.map((x, j) => (j === i ? v : x)) })} label={`傾向${i + 1}`} />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 border-t border-ink/30 pt-2 text-[0.75rem] leading-relaxed text-ink-soft">{memo.disclaimer}</p>
    </article>
  )
}

/** 書き換えられる文。確定後はただの文 */
function Editable({ value, editing, onChange, placeholder, label }: { value: string; editing: boolean; onChange: (v: string) => void; placeholder?: string; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, editing])
  if (!editing) return <span className="block min-w-0 flex-1 whitespace-pre-wrap">{value}</span>
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className="-mx-1 block w-full min-w-0 flex-1 resize-none overflow-hidden rounded-[3px] bg-print-tint px-1 leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:bg-paper-bright focus:ring-2 focus:ring-print-frame"
    />
  )
}
