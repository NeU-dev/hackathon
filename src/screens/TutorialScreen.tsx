import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { motion, useIsPresent } from 'motion/react'
import type { FrameNo } from '../types'
import { useUI } from '../ui'
import { usePapers } from '../store'
import { useBack, useDialogFocus } from '../lib/screens'
import { hasWebGL, useReduced } from '../lib/env'
import { DUR, EASE } from '../lib/motion'
import { CIRCLED, FRAMES } from '../lib/frames'
import * as D from '../claude/dummyData'
import { StepSwap } from '../components/Motion'
import { Icon } from '../components/Icon'
import { HelpLink } from '../components/HelpButton'
import { Phrases } from '../components/Phrases'
import { BubbleField } from '../components/bubbles/BubbleField'
import type { BubbleQ } from '../components/bubbles/sim'

/**
 * 使い方。最初に1回だけ、机にテープで留めた紙として出る（設定からもう一度見られる）。
 * 「ハルさん」が月曜の会議の困りごとを1枚の紙に書いていく話として、アプリの一周を見せる
 * （デモの例の紙と同じ中身）。ハルさんの紙は、ページが進むにつれて埋まっていく。
 * ②の泡だけは本物で、押すとハルさんの答えが書きこまれる。最後は、そのまま新しい紙を出せる
 */

/** ハルさんの紙（デモの例の紙と同じ中身） */
const HARU = {
  dump: '仕事がうまくいかない。月曜がつらい。会議で話せない。',
  problem: '会議で話せない',
  ideas: ['資料に要点を1行書いておく', '同僚に先に話しておく', '最初の一言を決めておく'],
  shrink: D.SHRINK_EXAMPLE[0].first,
}

/** 用紙の枠に書きこまれる言葉 */
const ROW_TEXT: Record<FrameNo, string> = {
  1: HARU.problem,
  2: D.SCENE_EXAMPLE,
  3: D.GOAL_EXAMPLE,
  4: `・${HARU.ideas[0]}　ほか2つ`,
  5: HARU.ideas[0],
  6: `${D.PLAN_EXAMPLE.where}で、${D.PLAN_EXAMPLE.first}`,
  7: 'できた',
}

/** ②の泡の問いと、ハルさんの答え（問いは本物と同じ順） */
const SCENE_ANSWERS: Record<string, string> = {
  '最近だと、いつ？': '先週の月曜、9時の会議',
  'どこに座ってた？': '会議室の、入口に近い席',
  '誰がいた？': '上司と、チームのみんな',
  '最初に何て言われた？': '「で、どうなった？」',
  'その時、体はどうだった？': '頭が真っ白になった',
  '何て答えた？': '何も言えず、3秒黙った',
  '本当はどうしたかった？': '要点を3つ言いたかった',
}
const SCENE_QS = D.QUESTIONS[2] ?? Object.keys(SCENE_ANSWERS)

const PAGES = 7

export function TutorialScreen() {
  const setUI = useUI((s) => s.setUI)
  const openPaper = useUI((s) => s.openPaper)
  const setSettings = usePapers((s) => s.setSettings)
  const createPaper = usePapers((s) => s.createPaper)
  const present = useIsPresent()
  const reduced = useReduced()
  const root = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const [dir, setDir] = useState(1)

  const close = () => {
    setSettings({ tutorialSeen: true })
    setUI({ tutorial: false })
  }
  useBack(close, present)
  useDialogFocus(root)

  const go = (n: number) => {
    setDir(n > page ? 1 : -1)
    setPage(n)
    // 新しいページは、紙の頭から読めるように
    root.current?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }
  const start = () => {
    close()
    openPaper(createPaper())
  }

  const last = page === PAGES - 1
  const link = 'h-11 rounded-full px-3 text-[0.875rem] text-accent underline decoration-accent/40 underline-offset-4 active:bg-accent-soft'

  return (
    <motion.div
      ref={root}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label="使い方"
      className="desk-calm fixed inset-x-0 z-[75] flex flex-col overflow-y-auto overscroll-contain outline-none"
      style={{ top: 'var(--vvt)', height: 'var(--vvh)', pointerEvents: present ? 'auto' : 'none' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: DUR.fast, ease: EASE } }}
      exit={{ opacity: 0, transition: { duration: DUR.quick, ease: EASE } }}
    >
      <header className="pt-safe flex items-center justify-between px-2">
        <button type="button" onClick={close} className="h-11 rounded-full px-3 text-[0.875rem] text-ink-soft active:bg-black/5">
          {last ? '閉じる' : 'とばす'}
        </button>
        <HelpLink />
      </header>

      <div className="pb-safe pt-[1vh]">
        <motion.div
          className="paper-sheet relative mx-3 mt-3 mb-8 rounded-[4px] px-4 pt-6 pb-4"
          initial={reduced ? false : { y: -60, rotate: -3, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        >
          <span aria-hidden className="tape absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 -rotate-2" />

          <StepSwap id={String(page)} dir={dir}>
            {page === 0 && <PageMonday />}
            {page === 1 && <PageWriteDown onTry={() => go(2)} />}
            {page === 2 && <PageBubbles onFlung={() => setSettings({ flingHintSeen: true })} />}
            {page === 3 && <PagePlan />}
            {page === 4 && <PageTheDay />}
            {page === 5 && <PageAgain />}
            {page === 6 && <PageYourTurn />}
          </StepSwap>

          {last && (
            <button type="button" onClick={start} className="tactile-accent mt-5 h-13 w-full rounded-xl text-[1rem] font-medium">
              新しい紙を出す
            </button>
          )}
          <nav className="mt-3 flex items-center gap-2">
            <div className="flex-1">
              {page > 0 && (
                <button type="button" onClick={() => go(page - 1)} className="-ml-3 flex h-11 items-center gap-1 rounded-full px-3 text-[0.875rem] text-ink-soft active:bg-black/5">
                  <Icon name="back" size={16} /> 前へ
                </button>
              )}
            </div>
            <p className="text-[0.8125rem] text-ink-soft tabular-nums">
              <span className="sr-only">全{PAGES}ページの</span>
              {page + 1} / {PAGES}
            </p>
            <div className="flex flex-1 justify-end">
              {last ? (
                <button type="button" onClick={close} className={`${link} -mr-3`}>
                  引き出しを見る
                </button>
              ) : (
                <button type="button" onClick={() => go(page + 1)} className="tactile-accent h-12 rounded-xl px-6 text-[1rem] font-medium">
                  次へ
                </button>
              )}
            </div>
          </nav>
        </motion.div>
      </div>
    </motion.div>
  )
}

/* ───────── 部品 ───────── */

function Heading({ children }: { children: string }) {
  return (
    <h1 className="phrase-wrap text-[1.375rem] leading-snug font-medium">
      <Phrases text={children} />
    </h1>
  )
}

/** 地の文。文節の区切りで折り返し、行の長さをそろえる（「もう／一度。」と最後だけ落ちないように） */
function Text({ children, muted = false, className = '' }: { children: string; muted?: boolean; className?: string }) {
  return (
    <p className={`phrase-wrap mt-3 text-[0.9375rem] leading-relaxed ${muted ? 'text-ink-soft' : ''} ${className}`}>
      <Phrases text={children} />
    </p>
  )
}

/** ハルさんが書いたメモ（本人のペン書き） */
function Memo({ children }: { children: string }) {
  return (
    <p className="pen phrase-wrap mt-3 -rotate-1 border border-print-line bg-paper-bright px-3.5 py-2.5 text-[1rem] leading-relaxed shadow-[0_1px_2px_rgb(60_45_25/0.1)]">
      <Phrases text={children} />
    </p>
  )
}

/** インクがしみこむように入る（delay ミリ秒あとに）。動きを減らす設定では、そのまま出す */
function Ink({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const reduced = useReduced()
  const style: CSSProperties | undefined = reduced ? undefined : { animation: `ink-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms both` }
  return (
    <span className={className} style={style}>
      {children}
    </span>
  )
}

/**
 * ハルさんの紙（本物の用紙を小さくしたもの）。filled の枠に字が入り、fresh の枠はインクがしみこむように順に入る。
 * bright は次に書く枠（明るく光り、onTry があれば押せる）
 */
function HaruPaper({ filled, fresh = [], bright, onTry }: { filled: FrameNo[]; fresh?: FrameNo[]; bright?: FrameNo; onTry?: () => void }) {
  return (
    <div className="mt-4 border-[1.5px] border-print-frame bg-paper/60 text-print">
      <p className="flex items-baseline justify-between border-b-[1.5px] border-print-frame px-3 py-1.5">
        <span className="text-[0.875rem] font-medium tracking-[0.5em]">考える紙</span>
        <span className="text-[0.6875rem]">ハルさん</span>
      </p>
      {FRAMES.map(({ no, title }) => {
        const text = filled.includes(no) ? ROW_TEXT[no] : undefined
        const order = fresh.indexOf(no)
        const head = (
          <span className="flex items-baseline gap-1.5 text-[0.6875rem] font-medium">
            <span aria-hidden>{CIRCLED[no - 1]}</span>
            <span>{title}</span>
            {no === bright && <span className="ml-auto font-normal">ここから</span>}
          </span>
        )
        const cls = `block w-full px-3 py-1.5 text-left ${no > 1 ? 'border-t border-print-line' : ''}`
        if (no === bright && onTry) {
          return (
            <button
              key={no}
              type="button"
              onClick={onTry}
              aria-label={`${no} ${title}（ここから）。押すと、次へ進みます`}
              className={`${cls} tut-glow bg-paper-bright pb-4 active:bg-print-tint/60`}
            >
              {head}
            </button>
          )
        }
        return (
          <div key={no} className={`${cls} ${no === bright ? 'tut-glow bg-paper-bright pb-4' : ''}`}>
            {head}
            {text && (
              <Ink
                delay={order < 0 ? 0 : 250 + order * 380}
                className={`pen mt-0.5 block text-[0.875rem] leading-snug ${no === 2 ? 'line-clamp-2' : 'truncate'}`}
              >
                {text}
              </Ink>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ───────── ページ ───────── */

/** 1：はじまり */
function PageMonday() {
  return (
    <div>
      <Heading>ハルさんの、月曜日</Heading>
      <Text>ハルさんは、月曜の会議がにがてです。言いたいことはあるのに、いざ聞かれると、言葉が出てきません。</Text>
      <Memo>また、何も言えなかった。</Memo>
      <Text>このアプリは、そんなもやもやを1枚の紙に書いて、小さな一歩に変えていくための道具です。</Text>
      <Text muted>ハルさんの紙を、いっしょにのぞいてみましょう。</Text>
    </div>
  )
}

/** 2：①に書き出す。明るい②は本物と同じように押せる */
function PageWriteDown({ onTry }: { onTry: () => void }) {
  return (
    <div>
      <Heading>まず、紙に書き出す</Heading>
      <Text>頭の中にあることを、整理しないまま書き出します。</Text>
      <Memo>{HARU.dump}</Memo>
      <Text>アプリがそれを分けてくれて、ハルさんは「会議で話せない」を選びました。紙の①に、そう書きこまれます。</Text>
      <HaruPaper filled={[1]} fresh={[1]} bright={2} onTry={onTry} />
      <Text muted className="text-[0.875rem]">
        次に書く枠は、少し明るくなります。②を押してみてください。
      </Text>
    </div>
  )
}

/** 3：②の泡の問い。本物の泡を押すと、ハルさんの答えが書きこまれ、2つで場面が一文になる */
function PageBubbles({ onFlung }: { onFlung: () => void }) {
  const reduced = useReduced()
  const mode = reduced || !hasWebGL() ? 'cards' : '3d'
  const seq = useRef(0)
  const next = useRef(3)
  const make = (text: string): BubbleQ => ({ id: `tut-${seq.current++}`, text })
  const [qs, setQs] = useState<BubbleQ[]>(() => SCENE_QS.slice(0, 3).map(make))
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>([])
  const [flung, setFlung] = useState(false)

  // 減った泡は、少しおいて次の問いで補う（問いが尽きたら、はじめから）
  const refill = (q: BubbleQ) => {
    setQs((list) => list.filter((x) => x.id !== q.id))
    setTimeout(() => {
      const text = SCENE_QS[next.current++ % SCENE_QS.length]
      setQs((list) => (list.some((x) => x.text === text) ? list : [...list, make(text)]))
    }, 900)
  }

  return (
    <div>
      <Heading>泡の問いに、答えていく</Heading>
      <Text>②は「どんな場面だったか」。アプリは、その時の様子を思い出すための問いを、泡にして浮かべます。</Text>
      <Text muted>ハルさんの代わりに、泡を押してみてください。</Text>

      {/* 練習の帯。紙の左右いっぱいに広げ、入ってくる泡は紙の端で切る（上へ飛んでいく泡は切らない） */}
      <div className="-mx-4 mt-3 overflow-x-clip border-y border-print-line bg-paper-bright/50">
        <BubbleField
          questions={qs}
          mode={mode}
          height={mode === '3d' ? 150 : 96}
          onPop={(q) => {
            const a = SCENE_ANSWERS[q.text]
            if (a) setAnswers((list) => (list.some((x) => x.q === q.text) ? list : [...list, { q: q.text, a }]))
            refill(q)
          }}
          onFling={(q) => {
            setFlung(true)
            onFlung()
            refill(q)
          }}
        />
      </div>

      {answers.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5" aria-live="polite">
          {answers.slice(-3).map(({ q, a }) => (
            <li key={q} className="border-b border-print-line pb-1">
              <span className="block text-[0.6875rem] text-print">{q}</span>
              <Ink className="pen block text-[0.9375rem]">{a}</Ink>
            </li>
          ))}
        </ul>
      )}
      {answers.length >= 2 && (
        <div className="mt-3 border border-print-frame bg-paper-bright/70 px-3 py-2.5">
          <p className="text-[0.75rem] text-print">答えがつながって、場面が一文になりました</p>
          <Ink delay={200} className="pen mt-1 block text-[0.9375rem] leading-relaxed">
            {D.SCENE_EXAMPLE}
          </Ink>
        </div>
      )}
      <Text muted className="text-[0.8125rem]">
        {flung
          ? 'はじいた問いは、外れます。書く画面では、4秒だけ元に戻せます。'
          : mode === '3d'
            ? 'いらない問いは、指ではじいて外せます。泡は指で動かすこともできます。'
            : 'いらない問いは、×で外せます。'}
      </Text>
    </div>
  )
}

/** 4：③〜⑥ 目標・案・いつどこで */
function PagePlan() {
  return (
    <div>
      <Heading>小さな目標と、最初の2分</Heading>
      <Text>場面が見えると、目標を小さく決められます。できそうなことを3つ出して1つ選び、いつ・どこで・最初の2分まで決めました。</Text>
      <HaruPaper filled={[1, 2, 3, 4, 5, 6]} fresh={[3, 4, 5, 6]} />
      <Text muted>「最初の2分」は、始めるための、ほんの小さな動きです。</Text>
    </div>
  )
}

/** 5：当日。「今、どう？」と届き、ハルさんは「できなかった」を選ぶ */
function PageTheDay() {
  const reduced = useReduced()
  return (
    <div>
      <Heading>当日、アプリが聞きます</Heading>
      <Text>月曜の朝。決めておいた時間に、通知が届きます。</Text>

      {/* 本物の通知と同じ形（押せない見本） */}
      <motion.div
        aria-hidden
        className="paper-sheet relative mt-5 flex items-center gap-3 rounded-[4px] px-3.5 pt-4 pb-3"
        initial={reduced ? false : { y: -14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.25 }}
      >
        <span className="tape absolute -top-2.5 left-6 h-5 w-16 -rotate-3" />
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-print-frame text-print">
          <Icon name="sheet" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.75rem] text-ink-soft">通知</span>
          <span className="block text-[0.9375rem] font-medium">今、どう？</span>
          <span className="pen block truncate text-[0.875rem]">{HARU.problem}</span>
        </span>
      </motion.div>

      <Text>でもその日、ハルさんは廊下で書く余裕がなくて、「できなかった」を選びました。</Text>
      {/* 「今、どう？」の画面の見本（押せない）。選んだ答えにだけ印を付ける */}
      <div className="mt-3 border border-print-line bg-paper-bright/50 px-3 pt-2 pb-2.5">
        <p className="text-[0.75rem] text-print">今、どう？</p>
        <ul aria-label="今、どう？の答え（見本）" className="mt-1 flex flex-col text-[0.8125rem]">
          {['やった', 'まだ（あとで聞いて）', 'できなかった', '今は考えたくない'].map((label) => {
            const on = label === 'できなかった'
            return (
              <li key={label} className={`flex min-h-8 items-center gap-2 border-b border-print-line/70 last:border-b-0 ${on ? 'font-medium text-ink' : 'text-ink-soft'}`}>
                <span
                  aria-hidden
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${on ? 'border-accent bg-accent text-white' : 'border-print-frame'}`}
                >
                  {on && <Icon name="check" size={11} />}
                </span>
                {label}
                {on && <span className="sr-only">（選んだ答え）</span>}
              </li>
            )
          })}
        </ul>
      </div>
      <Text muted>できなかった日も、ちゃんと記録になります。</Text>
    </div>
  )
}

/** 6：一歩を小さくして、紙を重ねて、もう一度。次の月曜は言えた */
function PageAgain() {
  const reduced = useReduced()
  return (
    <div>
      <Heading>一歩を小さくして、もう一度</Heading>
      <Text>できなかった日は、責めずに、一歩を小さくします。アプリが「最初の30秒にして、もう一度やってみる？」と聞きました。</Text>

      {/* 前の紙の上に、2枚目を重ねる */}
      <div className="relative mt-5 mb-2">
        <div aria-hidden className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-[1.5deg] border-[1.5px] border-print-frame bg-paper-dim" />
        <div className="relative border-[1.5px] border-print-frame bg-paper text-print">
          <p className="flex items-baseline justify-between border-b-[1.5px] border-print-frame px-3 py-1.5">
            <span className="text-[0.875rem] font-medium tracking-[0.5em]">考える紙</span>
            <span className="border border-print-frame px-1.5 text-[0.6875rem] leading-5">2枚目</span>
          </p>
          <div className="px-3 py-1.5">
            <span className="text-[0.6875rem] font-medium">{CIRCLED[5]} 最初の2分</span>
            <span className="mt-0.5 block text-[0.75rem] text-ink-soft line-through decoration-ink-mute">{D.PLAN_EXAMPLE.first}</span>
            <Ink delay={300} className="pen block text-[0.875rem] leading-snug">
              {HARU.shrink}
            </Ink>
          </div>
          <div className="relative border-t border-print-line px-3 pt-1.5 pb-3">
            <span className="text-[0.6875rem] font-medium">{CIRCLED[6]} やってみてどうだった</span>
            {/* 「できた」の判子 */}
            <motion.span
              className="absolute top-1/2 right-4 flex -translate-y-1/2 -rotate-6 items-center gap-1 rounded-full border-2 border-accent px-3 py-1 text-[0.9375rem] font-medium text-accent"
              initial={reduced ? false : { scale: 1.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 1.1 }}
            >
              <Icon name="check" size={16} />
              できた
            </motion.span>
          </div>
        </div>
      </div>

      <Text>次の月曜。ハルさんは、要点を1つ、言えました。</Text>
    </div>
  )
}

/** 7：引き出しとふりかえり、相談先。次はあなたの番 */
function PageYourTurn() {
  return (
    <div>
      <Heading>次は、あなたの番です</Heading>
      <Text>書いた紙は、引き出しにたまっていきます。「ふりかえり」を開くと、どのくらいの一歩なら動けたのか、自分に合う進め方が見えてきます。</Text>

      {/* 引き出しに入ったハルさんの紙（見本） */}
      <div aria-hidden className="relative mt-4 mb-1">
        <div className="absolute inset-x-1 -bottom-1.5 h-full rounded-xl bg-paper-dim shadow-[0_1px_2px_rgb(60_45_25/0.1)]" />
        <div className="paper-sheet relative rounded-xl px-4 py-3">
          <span className="flex items-baseline justify-between gap-2">
            <span className="pen text-[1.0625rem]">{HARU.problem}</span>
            <span className="pen text-[0.8125rem] text-ink-soft">月曜</span>
          </span>
          <span className="mt-1 flex items-center justify-between text-[0.8125rem] text-ink-soft">
            <span className="flex items-center gap-1.5">
              <Icon name="check" size={15} /> できた
            </span>
            <span className="border border-print-frame px-1.5 text-[0.75rem] leading-5 text-print">2枚目</span>
          </span>
        </div>
      </div>

      <Text muted>つらい時は、右上の「相談先」から、人に相談できます。</Text>
      <Text>あなたの困りごとも、1枚の紙から始めてみませんか。</Text>
    </div>
  )
}
