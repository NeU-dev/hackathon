import { useEffect, useRef, useState } from 'react'
import { motion, useIsPresent } from 'motion/react'
import { topSheet, usePaper, usePapers } from '../store'
import { useUI } from '../ui'
import { useReduced } from '../lib/env'
import { formatWhen, parseWhen, toLocalInput } from '../lib/format'
import { doneNote, reasonOptions, shrinkPlan } from '../claude'
import { juice } from '../lib/juice'
import { useBack, useDialogFocus } from '../lib/screens'
import { Icon } from '../components/Icon'
import { HelpLink } from '../components/HelpButton'
import { useReflection } from '../components/Report'
import { stepMinutes } from '../lib/records'
import { StepSwap } from '../components/Motion'
import { DUR, EASE } from '../lib/motion'
import type { Plan, ShrinkSuggestion } from '../types'

type Step = 'choose' | 'later' | 'later-custom' | 'record' | 'reasons' | 'reason-other' | 'next' | 'quiet'
/** 「あなたの記録」で先に選んだ次の一手（理由を聞いたあと、そのまま進める） */
type Intent = { kind: 'again'; shrink: ShrinkSuggestion } | { kind: 'other' } | { kind: 'shelve' }

/** D. 今どう？画面（通知から開く） */
export function CheckinScreen({ paperId }: { paperId: string }) {
  const paper = usePaper(paperId)
  const S = usePapers.getState()
  const setUI = useUI((s) => s.setUI)
  const reduced = useReduced()
  const [step, setStep] = useState<Step>('choose')
  const [reasons, setReasons] = useState<string[]>()
  const [reason, setReason] = useState('')
  const [otherText, setOtherText] = useState('')
  const [customAt, setCustomAt] = useState(() => toLocalInput(Date.now() + 3 * 3600_000))
  const [busy, setBusy] = useState(false)
  const [intent, setIntent] = useState<Intent>()
  // 閉じる途中は押せないようにする
  const present = useIsPresent()
  const root = useRef<HTMLDivElement>(null)
  useBack(() => setUI({ checkin: false }), present)
  useDialogFocus(root)

  if (!paper) return null
  const sheet = topSheet(paper)
  const plan = sheet.plan

  const closeToPaper = (patch: Parameters<typeof setUI>[0] = {}) => setUI({ checkin: false, ...patch })

  const did = () => {
    S.markDone(paperId, doneNote(plan))
    juice.didIt()
    closeToPaper({ typing: { sheetId: sheet.id, frame: 7, phase: 'run' }, glowAt: Date.now() })
  }

  const later = (at: number) => {
    S.snooze(paperId, at)
    closeToPaper()
  }

  const tomorrow = () => {
    const base = plan ? parseWhen(plan.when) : undefined
    const d = new Date()
    d.setDate(d.getDate() + 1)
    if (base) {
      const b = new Date(base)
      d.setHours(b.getHours(), b.getMinutes(), 0, 0)
    } else d.setHours(9, 0, 0, 0)
    return d.getTime()
  }

  // できなかった：理由を聞く前に、まず「あなたの記録」を見せる（理由の選択肢はその間に用意しておく）
  const couldNot = async () => {
    setStep('record')
    if (!reasons && plan) setReasons(await reasonOptions(plan))
  }

  // 理由を選んだら（とばしたら空）、「あなたの記録」で選んだ一手があればそのまま進め、なければ3択へ
  const pickReason = (r: string) => {
    setReason(r)
    if (!intent) return setStep('next')
    if (intent.kind === 'again') return again(intent.shrink, r)
    next(intent.kind, r)
  }

  // これで、もう一度：紙を重ねて6番を開き、最初の一歩に提案を下書きで入れる
  const again = (shrink: ShrinkSuggestion, r: string) => {
    if (busy) return
    setBusy(true)
    S.notDone(paperId, r, 'same', [shrink], shrink.first)
    closeToPaper({ openFrame: { paperId, frame: 6 } })
  }

  const next = async (choice: 'same' | 'other' | 'shelve', why = reason) => {
    if (busy) return
    setBusy(true)
    if (choice === 'same') {
      const shrink = plan ? await shrinkPlan(plan, { reason: why }) : undefined
      S.notDone(paperId, why, 'same', shrink)
      closeToPaper()
    } else if (choice === 'other') {
      S.notDone(paperId, why, 'other')
      closeToPaper()
    } else {
      S.notDone(paperId, why, 'shelve')
      closeToPaper({ shelvingId: paperId })
    }
  }

  const btn = 'tactile flex min-h-14 w-full items-center rounded-xl px-4 py-3 text-left text-[1rem] disabled:opacity-60'

  return (
    <motion.div
      ref={root}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label="今、どう？"
      className="desk-calm fixed inset-x-0 z-40 flex flex-col overflow-y-auto outline-none"
      style={{ top: 'var(--vvt)', height: 'var(--vvh)', pointerEvents: present ? 'auto' : 'none' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: DUR.fast, ease: EASE } }}
      exit={{ opacity: 0, transition: { duration: DUR.quick, ease: EASE } }}
    >
      <header className="pt-safe flex items-center justify-between px-2">
        <button type="button" onClick={() => closeToPaper()} className="flex h-11 min-w-11 items-center gap-1 rounded-full px-3 text-[0.875rem] text-ink active:bg-black/5">
          <Icon name="back" /> 紙へ
        </button>
        <HelpLink />
      </header>

      {/* 机に、メモが1枚テープで貼られて届く */}
      {/*
        メモの上端は固定する（段階が変わって高さが変わっても、伸び縮みするのは下だけ）。
        まん中寄せにすると、高さが変わるたびにメモの頭が上下に動き、スクロールが逆に動いたように見える
      */}
      <div className="pt-[3vh] pb-10">
      <motion.div
        className="paper-sheet relative mx-3 mt-4 rounded-[4px] px-4 pt-6 pb-5"
        initial={reduced ? false : { y: -60, rotate: -3, opacity: 0 }}
        animate={{ y: 0, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
      >
        <span aria-hidden className="tape absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 -rotate-2" />
        <h1 className="mb-4 text-[1.5rem] font-medium">今、どう？</h1>

        {plan && (
          <dl className="mb-6 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 border border-print-line bg-paper-bright/60 px-3.5 py-3 text-[0.8125rem]">
            {/* 何の紙かが分かるように（翌日に開いても思い出せる） */}
            {sheet.problem && (
              <>
                <dt className="text-print">困りごと</dt>
                <dd className="pen text-[0.9375rem]">{sheet.problem}</dd>
              </>
            )}
            {sheet.choice?.idea && (
              <>
                <dt className="text-print">やること</dt>
                <dd className="pen text-[0.9375rem]">{sheet.choice.idea}</dd>
              </>
            )}
            <dt className="text-print">いつ</dt>
            <dd className="pen text-[0.9375rem]">{formatWhen(plan.when)}</dd>
            <dt className="text-print">どこで</dt>
            <dd className="pen text-[0.9375rem]">{plan.where}</dd>
            <dt className="text-print">最初の2分</dt>
            <dd className="pen text-[0.9375rem]">{plan.first}</dd>
          </dl>
        )}

        {/* 段階が進むと、前の段階は左へ抜け、次の段階が右から入る。メモの高さも合わせて伸び縮みする */}
        <StepSwap id={step}>
        {step === 'choose' && (
          <div className="flex flex-col gap-2.5">
            <button type="button" className={btn} onClick={did}>
              やった
            </button>
            <button type="button" className={btn} onClick={() => setStep('later')}>
              まだ（あとで聞いて）
            </button>
            <button type="button" className={btn} onClick={couldNot}>
              できなかった
            </button>
            <button
              type="button"
              className={btn}
              onClick={() => {
                S.stopAsking(paperId)
                setStep('quiet')
              }}
            >
              今は考えたくない
            </button>
          </div>
        )}

        {step === 'later' && (
          <Section title="次はいつ聞く？">
            <button type="button" className={btn} onClick={() => later(Date.now() + 3 * 3600_000)}>
              3時間後
            </button>
            <button type="button" className={btn} onClick={() => later(tomorrow())}>
              明日
            </button>
            <button type="button" className={btn} onClick={() => setStep('later-custom')}>
              自分で決める
            </button>
          </Section>
        )}

        {step === 'later-custom' && (
          <Section title="次はいつ聞く？">
            <input
              type="datetime-local"
              value={customAt}
              onChange={(e) => setCustomAt(e.target.value)}
              aria-label="次に聞く日時"
              className="h-12 w-full rounded-xl border border-frame bg-white px-3"
            />
            <button type="button" className={btn + ' justify-center'} disabled={!parseWhen(customAt)} onClick={() => later(parseWhen(customAt)!)}>
              この時間に聞いて
            </button>
          </Section>
        )}

        {step === 'record' && plan && (
          <RecordCard
            plan={plan}
            minutes={stepMinutes(sheet)}
            onPick={(i) => {
              setIntent(i)
              setStep('reasons')
            }}
          />
        )}

        {step === 'reasons' && (
          <Section
            title="近いものを選んでください"
            lead={
              // 「あなたの記録」で選んだ一歩は、理由を選ぶ間も見えるように（問いより先に）
              intent?.kind === 'again' && (
                <p className="mb-1 rounded-[3px] bg-print-tint/70 px-3 py-2 text-[0.8125rem] leading-relaxed text-ink-soft">
                  もう一度やる一歩
                  <span className="pen block text-[0.9375rem] text-pen">「{intent.shrink.first}」</span>
                </p>
              )
            }
          >
            {!reasons ? (
              <p role="status" className="breathe text-[0.875rem] text-ink-soft">
                近いものを用意しています
              </p>
            ) : (
              <>
                {reasons.map((r) => (
                  <button key={r} type="button" className={btn} onClick={() => pickReason(r)}>
                    {r}
                  </button>
                ))}
                <button type="button" className={btn} onClick={() => setStep('reason-other')}>
                  その他（書く）
                </button>
                {intent && (
                  <button type="button" disabled={busy} onClick={() => pickReason('')} className="h-11 w-full rounded-xl text-[0.9375rem] text-ink-soft active:bg-black/5">
                    とばす
                  </button>
                )}
              </>
            )}
          </Section>
        )}

        {step === 'reason-other' && (
          <Section title="その他">
            <input
              autoFocus
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              aria-label="理由"
              className="h-12 w-full rounded-xl border border-frame bg-white px-3"
            />
            <button type="button" className={btn + ' justify-center'} disabled={!otherText.trim()} onClick={() => pickReason(otherText.trim())}>
              次へ
            </button>
          </Section>
        )}

        {step === 'next' && (
          <Section title="今回は進まなかった。次はどうする？">
            <button type="button" className={btn} disabled={busy} onClick={() => next('same')}>
              同じ案で、もう一度
            </button>
            <button type="button" className={btn} disabled={busy} onClick={() => next('other')}>
              別の案で
            </button>
            <button type="button" className={btn} disabled={busy} onClick={() => next('shelve')}>
              この問題は、今は置いておく
            </button>
          </Section>
        )}

        {step === 'quiet' && (
          <div className="flex flex-col gap-4">
            <p className="text-[0.9375rem] leading-relaxed">また聞いてほしくなったら、紙を開いてください。</p>
            <button
              type="button"
              className={btn + ' justify-center'}
              onClick={() => {
                setUI({ checkin: false })
                useUI.getState().openDrawer()
              }}
            >
              閉じる
            </button>
          </div>
        )}
        </StepSwap>
      </motion.div>
      </div>
    </motion.div>
  )
}

/**
 * あなたの記録：ふりかえりの中から、今に関係する2つだけ。
 * まとめの一文と、今の紙への縮小版の提案（「これで、もう一度」）。ほかの道（別の方法・置いておく）は小さく残す
 */
function RecordCard({ plan, minutes, onPick }: { plan: Plan; minutes: number; onPick: (i: Intent | undefined) => void }) {
  const data = useReflection()
  const [shrink, setShrink] = useState<ShrinkSuggestion>()
  useEffect(() => {
    if (!data) return
    let alive = true
    shrinkPlan(plan, { summary: data.reflection, minutes }).then(([s]) => alive && setShrink(s))
    return () => {
      alive = false
    }
  }, [data, plan, minutes])
  const summary = data?.reflection.summary
  const link = 'h-11 rounded-full px-3 text-[0.875rem] text-accent underline decoration-accent/40 underline-offset-4 active:bg-accent-soft'

  return (
    <Section title="あなたの記録">
      <div className="border border-print-line bg-paper-bright/60 px-3.5 py-3" aria-live="polite">
        {!data || !shrink ? (
          <p role="status" className="breathe text-[0.875rem] text-ink-soft">
            記録を読んでいます
          </p>
        ) : (
          <>
            {summary && (
              <div className="mb-3 border-b border-dashed border-print-frame pb-2.5">
                <p className="mb-0.5 text-[0.75rem] text-print">記録から見えた傾向（参考）</p>
                <p className="text-[1rem] leading-relaxed">{summary.text}</p>
              </div>
            )}
            {/* 今回の最初の一歩は、すぐ上の計画に出ているので繰り返さない */}
            <p className="text-[1rem] leading-relaxed">{shrink.title}して、もう一度やってみる？</p>
            <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-soft">
              最初の一歩の下書き <span className="text-[0.9375rem] text-ink">「{shrink.first}」</span>
            </p>
            {/* いつ・どこでも変わる一歩は、それも下書きになることを先に伝える（⑥で確かめてから決める） */}
            {shrink.where && (
              <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-soft">
                どこでの下書き <span className="text-[0.9375rem] text-ink">「{shrink.where}」</span>
              </p>
            )}
          </>
        )}
      </div>
      <button
        type="button"
        disabled={!shrink}
        onClick={() => shrink && onPick({ kind: 'again', shrink })}
        className="tactile-accent mt-1 h-12 w-full rounded-xl text-[1rem] font-medium"
      >
        これで、もう一度
      </button>
      <div className="flex flex-wrap justify-center">
        <button type="button" onClick={() => onPick({ kind: 'other' })} className={link}>
          別の方法を考える
        </button>
        <button type="button" onClick={() => onPick({ kind: 'shelve' })} className={link}>
          今は置いておく
        </button>
      </div>
      <button type="button" onClick={() => onPick(undefined)} className="h-11 w-full rounded-xl text-[0.9375rem] text-ink-soft active:bg-black/5">
        今は見ない
      </button>
    </Section>
  )
}

function Section({ title, lead, children }: { title: string; lead?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      {lead}
      <p className="mb-1 text-[0.9375rem] text-ink-soft">{title}</p>
      {children}
    </div>
  )
}
