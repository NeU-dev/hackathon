import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useAnimate, type Transition } from 'motion/react'
import type { FrameNo, ShrinkSuggestion } from '../types'
import { topSheet, usePaper, usePapers } from '../store'
import { shrinkPlan } from '../claude'
import { formatMinutes, stepMinutes } from '../lib/records'
import { useReflection } from '../components/Report'
import { useUI } from '../ui'
import { useReduced } from '../lib/env'
import { STATUS_LABEL } from '../lib/frames'
import { Icon, STATUS_ICON } from '../components/Icon'
import { HelpLink } from '../components/HelpButton'
import { atMost, formatAt } from '../lib/format'
import { juice } from '../lib/juice'
import { useBack } from '../lib/screens'
import { SheetFrames } from '../components/SheetFrames'
import { ring } from '../components/NotificationToast'
import { StepSwap, Swap } from '../components/Motion'
import { DUR, EASE } from '../lib/motion'

// 動きの値は毎回同じものを渡す（描き直しのたびに動きがやり直されないように）
/** 重ねる紙：上から落ちてきて、少し行き過ぎてから収まる（下の紙の上に落ちるので、板の茶色は見えない） */
const DROP_FROM = { y: -90, opacity: 0, rotate: -2 }
const REST = { y: 0, opacity: 1, rotate: 0 }
const DROP = { duration: 0.5, delay: 0.1, ease: [0.3, 1.25, 0.5, 1] } as const
/**
 * 引き出しから開いた紙：はじめから板に載っていて、開いたクリップの口へ、下から差しこまれる。
 * 何も載っていない板（一面の茶色）は見せない
 */
const SETTLE_FROM = { y: 30, opacity: 1, rotate: 0.6 }
const SETTLE = { duration: 0.34, delay: 0.22, ease: EASE }
/** バインダーが机の手前から、すっと置かれる。クリップが閉じた瞬間に、ほんの少し沈む */
const BOARD_FROM = { y: 24, opacity: 0, rotate: -0.6 }
const BOARD_IN = { y: [24, 0, 0, 2, 0], opacity: [0, 1, 1, 1, 1], rotate: [-0.6, 0, 0, 0, 0] }
const BOARD_REST = { y: 0, opacity: 1, rotate: 0 }

/**
 * クリップ：上の輪のところを蝶番にして、口（下の縁）が手前へ持ち上がって開き、紙が入ると「カチ」と閉じる。
 * 開いている間は、紙に落ちる影が口から離れて、うすくぼける。閉じる時は少し押しこんでから戻る
 */
const CLIP_T: Transition = { duration: 0.9, times: [0, 0.25, 0.62, 0.7, 1], ease: 'easeOut' }
/** バインダーは 0.3 秒で置かれ、クリップが閉じる瞬間（CLIP_T と同じ 0.62〜0.7）に沈む */
const BOARD_T: Transition = { duration: 0.9, times: [0, 0.33, 0.62, 0.7, 1], ease: 'easeOut' }
/** 紙をはさむ音は、口が紙に当たる瞬間（0.62〜0.7 のあいだ）に */
const CLIP_CLICK_MS = 600
/** クリップ全体が手前へ持ち上がり（上へずれて大きく）、閉じる時は少しつぶれてから戻る */
const CLIP_SNAP = { y: [0, -9, -9, 2, 0], scale: [1, 1.12, 1.12, 0.96, 1] }
const CLIP_IDLE = { y: 0, scale: 1 }
const CLIP_FROM = { y: 0, scale: 1 }
/** 口（下の縁）は、輪のところを蝶番にして手前へ傾く */
const JAW_SNAP = { rotateX: [0, -28, -28, 6, 0] }
const JAW_IDLE = { rotateX: 0 }
const JAW_FROM = { rotateX: 0 }
/** 紙に落ちる影：クリップが持ち上がっている間は、下へ離れてうすくぼける */
const LIFT_SNAP = { y: [0, 16, 16, 0, 0], opacity: [0, 0.6, 0.6, 0, 0], scaleX: [1, 1.1, 1.1, 1, 1] }
const LIFT_IDLE = { y: 0, opacity: 0, scaleX: 1 }
const LIFT_FROM = { y: 0, opacity: 0, scaleX: 1 }

/** B. 紙画面：机の上のバインダーに、記入用紙がはさんである */
export function PaperScreen({ paperId }: { paperId: string }) {
  const paper = usePaper(paperId)
  const ui = useUI()
  const reduced = useReduced()
  const { resumeAsking, retry, deletePaper } = usePapers.getState()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const camera = useRef<HTMLDivElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // 引き出しから開いた時の出方（開いた時に一度だけ決める）。
  // fresh：出したばかりのまっさらな紙。バインダーにはさまってから、用紙の印刷・記入日・「ここから」が順に整う
  // open：書きかけ・書き終えた紙。バインダーにはさまってから、次に書く枠がそっと光る
  const [arrive, setArrive] = useState<'fresh' | 'open' | undefined>(() => {
    if (reduced || !paper) return undefined
    const s = topSheet(paper)
    return paper.sheets.length === 1 && !s.problem && Date.now() - paper.createdAt < 5000 ? 'fresh' : 'open'
  })
  const toDrawer = () => {
    usePapers.getState().discardIfEmpty(paperId)
    useUI.getState().openDrawer()
  }
  useBack(toDrawer)

  // 置いておく → 紙をバインダーから外して、引き出しへしまう
  useEffect(() => {
    if (ui.shelvingId !== paperId) return
    let cancelled = false
    const run = async () => {
      await new Promise((r) => setTimeout(r, reduced ? 900 : 1200))
      if (cancelled) return
      if (!reduced && scope.current) {
        await atMost(
          animate(scope.current, { y: [0, -14, 420], rotate: [0, -1.5, 4], scale: [1, 1.01, 0.7], opacity: [1, 1, 0] }, { duration: 0.75, times: [0, 0.2, 1], ease: [0.5, 0, 0.75, 0] }),
          1100,
        )
      }
      if (cancelled) return
      useUI.getState().setUI({ shelvingId: undefined })
      useUI.getState().openDrawer(paperId)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [ui.shelvingId, paperId, reduced, animate, scope])

  // 枠を開くと、カメラが紙に寄っていく（作業画面が開く間に、紙が大きく・ぼやける）
  useEffect(() => {
    const el = camera.current
    if (!el || reduced) return
    const w = ui.work
    if (w && !ui.zoomBack) {
      el.style.transformOrigin = `${w.rect.left + w.rect.width / 2}px ${w.rect.top + w.rect.height / 2}px`
      animate(el, { scale: 1.6, filter: 'blur(3px)' }, { duration: 0.3, ease: [0.4, 0, 0.2, 1] })
    } else {
      animate(el, { scale: 1, filter: 'blur(0px)' }, { duration: 0.32, ease: [0.16, 1, 0.3, 1] })
    }
  }, [ui.work, ui.zoomBack, reduced, animate])

  // 文字が入る枠は見えるところへ（⑦は紙の下の方にあるので、そこまで送ってからチェックが入る）。
  // 入り終わったら、次の枠が見えるところまでそっと送る。
  // ⑥のあとは送らない（「◯時に聞きます」の帯は見出しといっしょに上に貼りついているので、紙の頭へ戻さなくても見える。
  // 下へ送ってすぐ上へ戻すと、スクロールが逆に動いたように見える）
  const wasTyping = useRef<FrameNo | undefined>(undefined)
  useEffect(() => {
    const behavior = reduced ? 'auto' : 'smooth'
    if (ui.typing) {
      wasTyping.current = ui.typing.frame
      if (ui.typing.phase === 'run') {
        document.querySelector<HTMLElement>(`[data-frame-live="${ui.typing.frame}"]`)?.scrollIntoView({ block: 'center', behavior })
      }
      return
    }
    const done = wasTyping.current
    if (!done) return
    wasTyping.current = undefined
    if (done === 6) return
    const el = document.querySelector<HTMLElement>('[data-bright]')
    el?.scrollIntoView({ block: 'nearest', behavior })
  }, [ui.typing, reduced])

  const sheetId = paper ? topSheet(paper).id : undefined
  // 重ねたばかりの紙か（紙ごとに一度だけ決める）
  const isNewSheet = useMemo(
    () => !!paper && paper.sheets.length > 1 && Date.now() - topSheet(paper).createdAt < 2500,
    [sheetId],
  )

  // 新しい紙をはさむ瞬間に、クリップが「カチッ」と閉じる音。はさまるところが見えるよう、紙の頭から
  useEffect(() => {
    if (!isNewSheet) return
    camera.current?.scrollTo({ top: 0 })
    if (reduced) return
    const t = setTimeout(() => juice.sheetClipped(), CLIP_CLICK_MS)
    return () => clearTimeout(t)
  }, [isNewSheet, reduced])

  // 引き出しから開いた紙も、クリップが閉じる瞬間に軽く「カチ」。演出が終わったら印を外す
  // （外さないと、書いた枠が描き直された時に、印刷の演出がもう一度走る）
  useEffect(() => {
    if (!arrive) return
    const snap = isNewSheet ? undefined : setTimeout(() => juice.sheetSet(), CLIP_CLICK_MS)
    const done = setTimeout(() => setArrive(undefined), 2600)
    return () => {
      clearTimeout(snap)
      clearTimeout(done)
    }
    // 開いた時に一度だけ
  }, [])

  // 「もう一度」で紙を重ねた時：新しい紙がはさまってクリップが閉じたら、そのまま6番を開く
  const want = ui.openFrame?.paperId === paperId && !ui.work && !ui.checkin ? ui.openFrame : undefined
  useEffect(() => {
    if (!want) return
    const t = setTimeout(() => {
      useUI.getState().setUI({ openFrame: undefined })
      const el = document.querySelector<HTMLElement>(`[data-frame-live="${want.frame}"]`)
      if (!el) return
      el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      useUI.getState().openWork(want.frame, { top: r.top, left: r.left, width: r.width, height: r.height })
    }, want.soon || reduced ? 160 : 1100)
    return () => clearTimeout(t)
  }, [want, reduced])

  if (!paper) return null
  const sheet = topSheet(paper)
  const drop = !reduced && (!!arrive || isNewSheet)
  const lower = paper.sheets.slice(0, -1)

  const openFrame = (n: FrameNo, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    ui.openWork(n, { top: r.top, left: r.left, width: r.width, height: r.height })
  }

  return (
    <motion.div
      ref={camera}
      className="desk-calm absolute inset-0 overflow-y-auto overscroll-contain"
      aria-hidden={!!ui.work || ui.checkin}
      // 引き出しの上に重なって出てくる（下で引き出しの紙が消えていく）。戻る時は、引き出しが上に重なる
      initial={arrive ? { opacity: 0 } : false}
      animate={{ opacity: 1, transition: { duration: DUR.fast, ease: EASE } }}
      exit={{ opacity: 0, transition: { duration: DUR.quick, ease: EASE } }}
    >
      {/*
        見出しは机の色で塗りつぶす（下を流れる紙の文字が、ぼやけて透けないように）。
        実行待ちの紙は「◯時に聞きます」の帯も見出しといっしょに上に貼りつける（紙のどこを見ていても、いつ聞くかが見える）
      */}
      <div className="sticky top-0 z-30 bg-desk-calm shadow-[0_1px_0_rgb(90_70_40/0.14)]">
      <header className="pt-safe flex items-center gap-2 px-2 pr-2 pb-1.5">
        <button type="button" onClick={toDrawer} className="flex h-11 min-w-11 items-center gap-1 rounded-full px-3 text-[0.875rem] text-ink active:bg-black/5">
          <Icon name="back" /> 引き出し
        </button>
        <h1 className="sr-only">{sheet.problem ?? '新しい紙'}</h1>
        <span className="mr-1 ml-auto flex items-center gap-1 text-[0.8125rem] text-ink">
          <Icon name={STATUS_ICON[paper.status]} size={15} />
          {STATUS_LABEL[paper.status]}
        </span>
        <HelpLink />
      </header>

      {paper.status === 'waiting' && (
        <div className="paper-sheet mx-4 mb-2.5 flex items-center gap-2 rounded-[4px] px-3 py-1.5 text-[0.8125rem]">
          {paper.notifyStopped ? (
            <>
              <span className="flex-1 whitespace-nowrap text-ink-soft">聞くのを止めています</span>
              <button type="button" className="h-11 shrink-0 rounded-full px-2.5 text-accent active:bg-accent-soft" onClick={() => resumeAsking(paperId)}>
                また聞いて
              </button>
              <button type="button" className="h-11 shrink-0 rounded-full px-2.5 text-accent active:bg-accent-soft" onClick={() => ui.setUI({ checkin: true, checkinAt: Date.now() })}>
                今どう？
              </button>
            </>
          ) : (
            <>
              <span className="flex flex-1 items-center gap-1.5">
                <Icon name="clock" size={15} className="text-accent" />
                {paper.notifyAt ? `あとは当日。${formatAt(paper.notifyAt)} に聞きます` : 'あとで聞きます'}
              </span>
              <button type="button" className="tactile h-11 rounded-full px-3 text-[0.75rem] text-ink-soft" onClick={() => ring(paperId)}>
                今すぐ鳴らす
              </button>
            </>
          )}
        </div>
      )}
      </div>

      {paper.status === 'shelved' && !ui.shelvingId && sheet.plan && (
        <RetryBand
          plan={sheet.plan}
          minutes={stepMinutes(sheet)}
          onSame={(shrink) => {
            retry(paperId, 'same', [shrink], shrink.first)
            ui.setUI({ openFrame: { paperId, frame: 6 } })
          }}
          onOther={() => {
            retry(paperId, 'other')
            ui.setUI({ openFrame: { paperId, frame: 5 } })
          }}
        />
      )}

      {lower.length > 0 && (
        <div className="mx-4 mt-2 flex justify-end">
          <button type="button" className="h-11 rounded-full px-3 text-[0.8125rem] text-ink active:bg-black/5" onClick={() => ui.setUI({ peek: true })}>
            下の紙を見る（{lower.length}枚）
          </button>
        </div>
      )}

      <div ref={scope} className={`relative mx-3 mb-10 ${lower.length > 0 ? 'mt-6' : 'mt-9'}`}>
        <motion.div
          className="clipboard relative px-2.5 pt-6 pb-3"
          initial={arrive ? BOARD_FROM : false}
          animate={arrive ? BOARD_IN : BOARD_REST}
          transition={arrive ? BOARD_T : { duration: DUR.slow, ease: EASE }}
        >
          <Clip snapKey={sheet.id} snap={drop} />

          <div className="relative">
            {/* 下の紙が端から少し見える */}
            {lower.map((s, i) => {
              const depth = lower.length - i
              return (
                <div
                  key={s.id}
                  aria-hidden
                  className="paper-sheet absolute inset-0 rounded-[3px]"
                  style={{ transform: `translate(${depth * 5}px, ${depth * 5}px) rotate(${depth * 0.8}deg)` }}
                />
              )
            })}

            <motion.article
              key={sheet.id}
              // 重ねた紙は上から落ちてくる。引き出しから開いた紙は、板に載ったまま、開いたクリップの下へ差しこまれる
              initial={!drop ? false : isNewSheet ? DROP_FROM : SETTLE_FROM}
              animate={REST}
              transition={isNewSheet ? DROP : SETTLE}
              data-arrive={arrive}
              className="paper-sheet relative z-10 rounded-[3px] px-3 pt-4 pb-4"
            >
              <SheetFrames sheet={sheet} sheetNo={paper.sheets.length} live onOpen={openFrame} />

              {paper.shelvedNote && <p className="mt-3 px-1 text-[0.8125rem] leading-relaxed text-print">※ {paper.shelvedNote}</p>}

              {/* まだ何も実行していない1枚だけの紙は消せる（間違えて作った紙のため） */}
              {paper.status === 'writing' && paper.sheets.length === 1 && (
                <div className="mt-4 flex justify-end">
                  {/* 「この紙を消す」と確かめのボタンは、その場で入れ替わる */}
                  <Swap id={confirmDelete ? 'confirm' : 'ask'}>
                  {!confirmDelete ? (
                    <button type="button" onClick={() => setConfirmDelete(true)} className="h-11 rounded-full px-3 text-[0.8125rem] text-ink-soft active:bg-black/5">
                      この紙を消す
                    </button>
                  ) : (
                    <span className="flex items-center gap-1">
                      <button type="button" onClick={() => setConfirmDelete(false)} className="h-11 rounded-full px-3 text-[0.8125rem] text-ink-soft active:bg-black/5">
                        やめる
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deletePaper(paperId)
                          useUI.getState().openDrawer()
                        }}
                        className="h-11 rounded-full border border-danger px-3 text-[0.8125rem] text-danger active:bg-black/5"
                      >
                        本当に消す（元に戻せません）
                      </button>
                    </span>
                  )}
                  </Swap>
                </div>
              )}

              {/* やった：やわらかい光が紙の上をすっと通り、紙全体がほんの少し明るくなる */}
              {ui.glowAt && Date.now() - ui.glowAt < 2000 && <Glow key={ui.glowAt} reduced={reduced} />}
            </motion.article>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

/** バインダーの金属のクリップ。紙をはさむ時に、口が手前へ開いてから「カチ」と閉じる */
function Clip({ snapKey, snap }: { snapKey: string; snap: boolean }) {
  return (
    <div key={snapKey} aria-hidden className="absolute -top-5 left-1/2 z-20 h-[54px] w-40 -translate-x-1/2">
      {/* 持ち上がっている間だけ、紙に落ちる影（クリップから離れて、うすくぼける） */}
      <motion.div
        className="absolute inset-x-2 bottom-[-4px] h-[30px] rounded-[10px_10px_14px_14px] bg-[rgb(40_30_20/0.5)] blur-[6px]"
        // 新しくはさむ時は、閉じた形から動かし直す（initial={false} だと、最後の形から始まって動かない）
        initial={snap ? LIFT_FROM : false}
        animate={snap ? LIFT_SNAP : LIFT_IDLE}
        transition={CLIP_T}
      />
      <motion.div
        className="absolute inset-0"
        style={{ transformOrigin: '50% 30%', perspective: 240 }}
        initial={snap ? CLIP_FROM : false}
        animate={snap ? CLIP_SNAP : CLIP_IDLE}
        transition={CLIP_T}
      >
        <div className="clip-ring absolute top-0 left-1/2 h-7 w-[72px] -translate-x-1/2" />
        <motion.div
          className="clip absolute inset-x-0 bottom-0 h-[38px]"
          style={{ transformOrigin: '50% 0%' }}
          initial={snap ? JAW_FROM : false}
          animate={snap ? JAW_SNAP : JAW_IDLE}
          transition={CLIP_T}
        >
          <div className="absolute top-2 left-1/2 h-1.5 w-20 -translate-x-1/2 rounded-full bg-black/15 shadow-[0_1px_0_rgb(255_255_255/0.7)]" />
        </motion.div>
      </motion.div>
    </div>
  )
}

function Glow({ reduced }: { reduced: boolean }) {
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[3px]"
        style={{ background: 'radial-gradient(120% 80% at 50% 40%, rgba(255,250,225,0.95), rgba(255,250,225,0.35))' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0] }}
        transition={{ duration: 1, times: [0, 0.35, 1] }}
      />
      {!reduced && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[3px]">
          <motion.div
            className="absolute -inset-y-10 w-1/2"
            style={{ background: 'linear-gradient(100deg, transparent, rgba(255,252,235,0.85), transparent)' }}
            initial={{ x: '-120%', rotate: 8 }}
            animate={{ x: '260%' }}
            transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
      )}
    </>
  )
}

/**
 * 置いてある紙の「もう一度やる」。紙の頭に置き、ふりかえり・今どう？と同じく、
 * 一歩を小さくした提案つきで、押せば紙が重なって⑥が開く
 */
function RetryBand({ plan, minutes, onSame, onOther }: { plan: { first: string; where: string; when: string }; minutes: number; onSame: (s: ShrinkSuggestion) => void; onOther: () => void }) {
  const [open, setOpen] = useState(false)
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
  return (
    <div className="paper-sheet mx-4 mt-3 rounded-[4px] px-3 py-2 text-[0.8125rem]">
      {/* 帯が開くと、高さを伸ばしながら中身がその場で入れ替わる */}
      <StepSwap id={open ? 'open' : 'closed'} kind="swap">
      {!open ? (
        <div className="flex items-center gap-2">
          <span className="flex flex-1 items-center gap-1.5 text-ink-soft">
            <Icon name="tray" size={15} />
            今は置いてあります
          </span>
          <button type="button" className="tactile-accent h-11 shrink-0 rounded-xl px-3.5 text-[0.875rem] font-medium" onClick={() => setOpen(true)}>
            もう一度やる
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[0.8125rem] text-ink-soft">
            前回の最初の一歩 <span className="pen text-[0.9375rem] text-pen">「{plan.first}」</span>（{formatMinutes(minutes)}）
          </p>
          {shrink ? (
            <>
              <p className="text-[0.9375rem] leading-relaxed">{shrink.title}して、もう一度やってみる？</p>
              <p className="text-[0.8125rem] leading-relaxed text-ink-soft">
                最初の一歩の下書き <span className="text-[0.9375rem] text-ink">「{shrink.first}」</span>
              </p>
            </>
          ) : (
            <p role="status" className="breathe text-ink-soft">
              記録を読んでいます
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" disabled={!shrink} className="tactile-accent h-11 flex-1 rounded-xl text-[0.9375rem] font-medium" onClick={() => shrink && onSame(shrink)}>
              同じ案で、もう一度
            </button>
            <button type="button" className="tactile h-11 flex-1 rounded-xl text-[0.9375rem]" onClick={onOther}>
              別の案で
            </button>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="h-10 self-center rounded-full px-3 text-[0.8125rem] text-ink-soft active:bg-black/5">
            今はいい
          </button>
        </div>
      )}
      </StepSwap>
    </div>
  )
}
