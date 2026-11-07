import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import type { ShrinkSuggestion } from '../types'
import { topSheet, usePapers } from '../store'
import { useUI } from '../ui'
import { useReduced } from '../lib/env'
import { useBack, useDialogFocus } from '../lib/screens'
import { formatDay, formatMinutes, formatPeriod, stoppedPapers } from '../lib/records'
import { shrinkPlan } from '../claude'
import { EvidenceDates, Fold, Quotes, ReportLines, useReflection } from '../components/Report'
import { Icon } from '../components/Icon'
import { HelpLink } from '../components/HelpButton'
import { PopNumber } from '../components/Motion'
import { DUR, EASE, pageScreen, recede, recedeInitial, reveal } from '../lib/motion'

/** 「もう一度やってみる？」の1枚：見送りの紙と、縮小版の提案 */
interface RetryCard {
  paperId: string
  date: number
  problem: string
  first: string
  minutes: number
  suggestion: ShrinkSuggestion
}

/**
 * E. ふりかえり（本人のためのレポート）。
 * 読んで終わりにせず、気づき（まとめの一文）から、その場で一歩を小さくしてもう一度、までを1タップでつなぐ。
 * 持ち上げも励ましもせず、記録を映し返すだけ。事実（数・本人の言葉）と、記録から見えた傾向（参考）は見た目で分ける
 */
export function ReportScreen() {
  const ui = useUI()
  const papers = usePapers((s) => s.papers)
  const reduced = useReduced()
  const present = useIsPresent()
  const root = useRef<HTMLDivElement>(null)
  const data = useReflection()
  const [cards, setCards] = useState<RetryCard[]>([])
  // 「今はいい」で閉じたカード。何も記録しない（この画面を閉じれば元に戻る）
  const [dismissed, setDismissed] = useState<string[]>([])
  const close = () => ui.setUI({ report: false })
  useBack(close, present)
  useDialogFocus(root)

  // 見送りの紙（まだ戻っていないもの）を最大2枚。まとめで見つかった条件で、一歩を縮める提案をつける
  useEffect(() => {
    if (!data) return
    let alive = true
    const stopped = stoppedPapers(papers).slice(0, 2)
    Promise.all(
      stopped.map(async ({ paper, record }) => {
        const plan = topSheet(paper).plan!
        const [suggestion] = await shrinkPlan(plan, { summary: data.reflection, minutes: record.minutes })
        return { paperId: paper.id, date: record.date, problem: record.problem, first: record.first, minutes: record.minutes, suggestion }
      }),
    ).then((list) => alive && setCards(list))
    return () => {
      alive = false
    }
  }, [data, papers])

  // この紙で、もう一度：紙を重ねて（同じ案でもう一度と同じ）、6番を開き、最初の一歩に提案を下書きで入れる
  const again = (c: RetryCard) => {
    usePapers.getState().retry(c.paperId, 'same', [c.suggestion], c.suggestion.first)
    ui.openPaper(c.paperId)
    ui.setUI({ openFrame: { paperId: c.paperId, frame: 6 } })
  }

  const counts = data?.counts
  const r = data?.reflection
  const visible = cards.filter((c) => !dismissed.includes(c.paperId))

  return (
    <motion.div
      ref={root}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label="ふりかえり"
      className="desk-calm fixed inset-x-0 z-40 overflow-y-auto overscroll-contain outline-none"
      style={{ top: 'var(--vvt)', height: 'var(--vvh)', pointerEvents: present ? 'auto' : 'none' }}
      variants={pageScreen}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* 相談メモが重なっている間は、左へ少しずれて奥に下がる */}
      <motion.div initial={recedeInitial} animate={recede(ui.memo)}>
      <header className="pt-safe sticky top-0 z-10 flex items-center justify-between bg-desk-calm px-2 pb-1 shadow-[0_1px_0_rgb(90_70_40/0.14)]">
        <button type="button" onClick={close} className="flex h-11 min-w-11 items-center gap-1 rounded-full px-3 text-[0.875rem] text-ink active:bg-black/5">
          <Icon name="back" /> 引き出し
        </button>
        <HelpLink />
      </header>

      {/* 引き出しから、ふりかえりの紙を1枚取り出す */}
      <motion.article
        className="paper-sheet mx-3 mt-3 rounded-[4px] p-3"
        initial={reduced ? false : reveal(1).initial}
        animate={reveal(1).animate}
      >
        <div className="border-[1.5px] border-print-frame">
          {/* 1. 見出しと期間 */}
          <div className="flex items-end justify-between gap-3 border-b-[1.5px] border-print-frame px-3 pt-2.5 pb-2">
            <h1 className="text-[1.0625rem] font-medium tracking-[0.5em] text-print">ふりかえり</h1>
            {counts?.from && (
              <p className="shrink-0 text-[0.75rem] text-print">
                期間 <span className="text-[0.875rem] text-ink">{formatPeriod(counts)}</span>
              </p>
            )}
          </div>

          {!counts || !r ? (
            <p role="status" className="breathe px-3 py-8 text-center text-[0.875rem] text-ink-soft">
              紙を読んでいます
            </p>
          ) : counts.papers === 0 ? (
            <p className="px-3 py-8 text-center text-[0.875rem] leading-relaxed text-ink-soft">
              まだ、ふりかえる紙がありません。
              <br />
              紙を書くと、ここに記録がたまっていきます。
            </p>
          ) : (
            <>
              {/* 2. 減らない数字だけ。戻ってきた回数が主役（書いた紙と一歩を並べて、割り算させない） */}
              <div className="flex items-end gap-3 border-b border-print-line px-3 pt-3 pb-3">
                {counts.returns > 0 && (
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.8125rem] text-print">戻ってきた回数</p>
                    <p className="mt-1.5 leading-none">
                      <PopNumber value={counts.returns} delay={0.2} className="text-[3.25rem] font-medium tracking-tight tabular-nums" />
                      <span className="ml-1 text-[1rem]">回</span>
                    </p>
                  </div>
                )}
                <div className={counts.returns > 0 ? 'shrink-0 border-l border-print-line pb-0.5 pl-3' : 'flex-1'}>
                  <p className="text-[0.75rem] text-print">書いた紙</p>
                  <p className={counts.returns > 0 ? 'mt-0.5 text-[1.125rem] tabular-nums' : 'mt-1.5 text-[2rem] leading-none font-medium tabular-nums'}>
                    <PopNumber value={counts.papers} delay={counts.returns > 0 ? 0.32 : 0.2} />
                    <span className="ml-0.5 text-[0.8125rem] font-normal">枚</span>
                  </p>
                </div>
              </div>

              {/* 3. まとめの一文（傾向）。根拠はたたみの中 */}
              {r.summary ? (
                <section className="border-b border-print-line bg-print-tint/60 px-3 pt-2.5 last:border-b-0">
                  <p className="text-[0.75rem] text-print">記録から見えた傾向（参考）</p>
                  <motion.p className="mt-1 text-[1.0625rem] leading-relaxed" {...(reduced ? {} : reveal(6))}>
                    {r.summary.text}
                  </motion.p>
                  <Fold label="根拠を見る">
                    {r.conditions && <ReportLines title="うまくいった時の条件" lines={r.conditions} />}
                    {r.changes && <ReportLines title="効いた変え方" lines={r.changes} />}
                    {!r.conditions && !r.changes && <EvidenceDates evidence={r.summary.evidence} />}
                  </Fold>
                </section>
              ) : (
                <p className="border-b border-print-line px-3 py-3 text-[0.9375rem] leading-relaxed last:border-b-0">
                  まだ紙が少ないので、傾向は書けません。書いた紙：{counts.papers}枚
                </p>
              )}

              {/* 4. もう一度やってみる？（見送りの紙がある時だけ） */}
              {visible.length > 0 && (
                <section className="border-b border-print-line px-3 pt-3 pb-2.5 last:border-b-0">
                  <h2 className="text-[0.9375rem] font-medium">もう一度やってみる？</h2>
                  <ul className="mt-2 flex flex-col gap-2.5">
                    <AnimatePresence initial={false}>
                      {visible.map((c) => (
                        <motion.li
                          key={c.paperId}
                          layout
                          exit={{ opacity: 0, height: 0, marginTop: -10, filter: 'blur(2px)' }}
                          transition={{ duration: DUR.fast, ease: EASE }}
                          className="overflow-hidden rounded-[3px] border border-print-frame bg-paper-bright/80"
                        >
                          <div className="px-3 pt-2.5 pb-2.5">
                            <p className="flex items-baseline gap-2">
                              <span className="pen min-w-0 flex-1 truncate text-[1.0625rem]">{c.problem}</span>
                              <span className="shrink-0 text-[0.75rem] text-ink-soft">{formatDay(c.date)}</span>
                            </p>
                            <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">
                              前回の最初の一歩 <span className="pen text-[0.9375rem] text-pen">「{c.first}」</span>（{formatMinutes(c.minutes)}）
                            </p>
                            <div className="mt-2 border-t border-dashed border-print-line pt-2">
                              <p className="text-[0.9375rem] leading-relaxed">{c.suggestion.title}して、もう一度やってみる？</p>
                              <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-soft">
                                最初の一歩の下書き <span className="text-[0.9375rem] text-ink">「{c.suggestion.first}」</span>
                              </p>
                            </div>
                            <div className="mt-2.5 flex gap-2">
                              <button type="button" onClick={() => again(c)} className="tactile-accent h-11 flex-1 rounded-xl text-[0.9375rem] font-medium">
                                この紙で、もう一度
                              </button>
                              <button
                                type="button"
                                onClick={() => setDismissed((d) => [...d, c.paperId])}
                                className="h-11 shrink-0 rounded-xl px-3 text-[0.875rem] text-ink-soft active:bg-black/5"
                              >
                                今はいい
                              </button>
                            </div>
                          </div>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                  <p className="mt-2 text-[0.75rem] text-ink-soft">どれを選んでも、選ばなくても大丈夫です。</p>
                </section>
              )}

              {/* 5. 書き方の変化（中身がある時だけ。たたみ表示） */}
              {r.wording && (
                <section className="border-b border-print-line bg-print-tint/60 px-3 last:border-b-0">
                  <Fold label="書き方の変化（参考）">
                    {r.wording.quotes && <Quotes quotes={r.wording.quotes} labels={['最初は', '最近は']} />}
                    <p className="mt-1.5 text-[0.9375rem] leading-relaxed">{r.wording.text}</p>
                    <EvidenceDates evidence={r.wording.evidence} />
                  </Fold>
                </section>
              )}
            </>
          )}
        </div>
        {/* 6. 注記 */}
        <p className="mt-2 px-1 text-[0.75rem] leading-relaxed text-ink-soft">数はアプリが数えたもの、傾向は Claude が紙を読んで書いたものです。</p>
      </motion.article>

      {/* 7. 相談メモは脇役：本人が選んだ時だけ */}
      <div className="pb-safe mx-3 mt-5 mb-10">
        <button
          type="button"
          disabled={!counts?.papers}
          onClick={() => ui.setUI({ memo: true })}
          className="tactile flex h-14 w-full items-center justify-center gap-2 rounded-xl text-[1rem]"
        >
          <Icon name="sheet" size={19} />
          相談メモをつくる
        </button>
        <p className="mt-2 text-center text-[0.8125rem] leading-relaxed text-ink">誰かに相談する時に手渡せる、A4一枚のメモです。</p>
      </div>
      </motion.div>
    </motion.div>
  )
}
