import { Component, Suspense, lazy, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BubbleSim, MAX_SLOTS, type BubbleQ } from './sim'
import { trail } from '../Fx'
import { haptic, juice } from '../../lib/juice'
import { usePapers } from '../../store'
import { Icon } from '../Icon'
import { Phrases } from '../Phrases'

const Bubble3D = lazy(() => import('./Bubble3D'))

interface Props {
  questions: BubbleQ[]
  /** 3D の泡か、動きを減らす／WebGL 不可の時のカードか */
  mode: '3d' | 'cards'
  height: number
  /** 膜が破れた時に呼ぶ。at：はじけた泡の中心（画面の座標） */
  onPop: (q: BubbleQ, at?: { x: number; y: number }) => void
  onFling: (q: BubbleQ) => void
  /** 泡をタップした瞬間（はじける前）。キーボードを開く準備などに使う */
  onTapStart?: () => void
  /** タップした泡が浮き上がって、はじける高さ（画面の座標）。キーボードに隠れない高さにする */
  popAtY?: number
  /** 止める（メモ用紙を開いている間など） */
  paused?: boolean
  /** 帯の上端から空けておく高さ（px）。帯の中にヒントを出している間、泡がその場所を避ける */
  reserveTop?: number
}

export function BubbleField(props: Props) {
  const [failed, setFailed] = useState(false)
  if (props.mode === 'cards' || failed) return <BubbleCards {...props} />
  return (
    <Guard onError={() => setFailed(true)}>
      <Bubbles3DField {...props} />
    </Guard>
  )
}

/**
 * 泡を描く範囲は、泡が漂う帯から、画面（作業画面）のいちばん上まで。
 * 飛ばした泡も、浮き上がってはじける泡も、どこへ行っても途中で切れないように。
 * 帯の上にどれだけ足すかは、画面の中での帯の位置から測る（端末の大きさで変わる）
 */
const offsetWithin = (el: HTMLElement, host: HTMLElement) => {
  let y = 0
  let n: HTMLElement | null = el
  // offsetTop は変形（拡大・縮小のアニメーション）の影響を受けないので、開く途中でも正しく測れる
  while (n && n !== host) {
    y += n.offsetTop
    n = n.offsetParent as HTMLElement | null
  }
  return y
}

function Bubbles3DField({ questions, height, onPop, onFling, onTapStart, popAtY, paused, reserveTop = 0 }: Props) {
  const anchor = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const sim = useMemo(() => new BubbleSim(), [])
  const hintId = useId()
  const [escape, setEscape] = useState(340)
  // 一度に浮かべる泡の数（帯の広さと文字の大きさで決まる）。残りの問いは、泡が減ったら順に出てくる
  const [cap, setCap] = useState(4)
  const shown = useMemo(() => questions.slice(0, cap), [questions, cap])
  const escapeRef = useRef(escape)
  escapeRef.current = escape

  // 帯の上端から、画面のいちばん上までの高さを測る
  useLayoutEffect(() => {
    const measure = () => {
      const a = anchor.current
      const host = a?.closest<HTMLElement>('[role="dialog"]')
      if (!a || !host) return
      const e = Math.max(120, offsetWithin(a, host))
      setEscape((prev) => (Math.abs(prev - e) > 1 ? e : prev))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [height])
  // はじけた泡の id から問いを引けるように（はじける時には、もう一覧から消えていることがある）
  const known = useRef(new Map<string, BubbleQ>())
  for (const q of questions) known.current.set(q.id, q)
  const onPopRef = useRef(onPop)
  onPopRef.current = onPop
  // はじけて問いを渡した泡（同じ泡を二度渡さない）
  const delivered = useRef(new Set<string>())
  const deliver = (q: BubbleQ, at?: { x: number; y: number }) => {
    if (delivered.current.has(q.id)) return
    delivered.current.add(q.id)
    onPopRef.current(q, at)
  }
  sim.paused = !!paused
  // ヒントのために空けておく高さ。変わったら、帯の上端の壁をその分だけ下げる（泡は押されて場所を空ける）
  const reserveRef = useRef(reserveTop)
  reserveRef.current = reserveTop
  useLayoutEffect(() => {
    sim.top = escapeRef.current + reserveTop
  }, [reserveTop, sim])

  useLayoutEffect(() => {
    const el = box.current!
    const measure = () => {
      sim.fontScale = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1
      sim.setSize(el.clientWidth, el.clientHeight, escapeRef.current)
      // 泡の数は、ヒントで空けている所を除かずに決める（ヒントが消えたあとに数が変わらないように）
      setCap(sim.capacity())
      sim.top = escapeRef.current + reserveRef.current
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    // 膜が破れた瞬間・飛ばした泡のしずくを、画面全体の演出に渡す
    const toScreen = (x: number, y: number) => {
      const r = el.getBoundingClientRect()
      return { x: r.left + x, y: r.top + y }
    }
    sim.onBurst = (b) => {
      const p = toScreen(b.x, b.y)
      juice.bubblePop(p.x, p.y, b.r * b.scale)
      sim.hitStop(55)
      // 膜が破れてから、問いを渡す（ここで初めてメモ用紙が開く）
      const q = known.current.get(b.id)
      if (q) deliver(q, p)
    }
    sim.onTrail = (b) => {
      const p = toScreen(b.x, b.y)
      trail(p.x, p.y, b.vx, b.vy)
    }
    // 泡どうしが強めにぶつかった音（続けざまに鳴りすぎないように間をあける）
    let lastBump = 0
    sim.onBump = (strength) => {
      const now = performance.now()
      if (now - lastBump < 70) return
      lastBump = now
      juice.bubbleBump(strength)
    }
    return () => {
      ro.disconnect()
      sim.onBurst = undefined
      sim.onTrail = undefined
      sim.onBump = undefined
    }
  }, [sim])

  useLayoutEffect(() => {
    sim.sync(shown)
    sim.applyDom()
  }, [shown, sim])

  // タップ：まず浮き上がり、着いたところでぷにっとつぶれて、はじける
  const tap = (q: BubbleQ) => {
    if (sim.busy()) return
    const s = sim.get(q.id)
    if (!s) return
    onTapStart?.()
    const r = box.current!.getBoundingClientRect()
    const big = s.r * 1.22 + 6
    const ty = popAtY === undefined ? s.y : Math.min(s.y, Math.max(big, popAtY - r.top))
    const tx = Math.min(Math.max(r.width / 2, big), r.width - big)
    sim.rise(q.id, tx, ty)
    // 保険：描画が止まっていて泡がはじけなくても、少し待てば用紙は開く
    setTimeout(() => {
      const now = sim.get(q.id)
      const box2 = box.current?.getBoundingClientRect()
      deliver(q, now && box2 ? { x: box2.left + now.x, y: box2.top + now.y } : undefined)
    }, 1200)
  }

  return (
    // 泡の層は、リスト（上に貼りつく場面の文章も含めて）より手前に重ねる。浮き上がる泡がその下に隠れないように
    <div ref={anchor} className="relative z-20" style={{ height }}>
    <div ref={box} className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: height + escape }}>
      <p id={hintId} className="sr-only">
        タップすると、問いが入力欄に入ります。長押しして離すと、外すボタンが出ます。
      </p>
      {/* 紙に落ちる影（球より下に描く） */}
      {Array.from({ length: MAX_SLOTS }, (_, i) => (
        <span
          key={i}
          aria-hidden
          ref={(el) => {
            if (el) sim.shadowEls.set(i, el)
            else sim.shadowEls.delete(i)
          }}
          className="absolute top-0 left-0 rounded-[50%]"
          style={{
            opacity: 0,
            // 紙に刷った平らな影（印刷の緑をうすくしたもの）
            background: 'radial-gradient(closest-side, rgb(68 115 106 / 0.15) 72%, rgb(68 115 106 / 0) 100%)',
          }}
        />
      ))}
      <Suspense fallback={null}>
        <Bubble3D sim={sim} />
      </Suspense>
      {shown.map((q) => (
        <Bubble key={q.id} q={q} sim={sim} hintId={hintId} onTap={tap} onFling={onFling} />
      ))}
    </div>
    </div>
  )
}

interface Press {
  x0: number
  y0: number
  offX: number
  offY: number
  grabbed: boolean
  timer: number
  samples: { x: number; y: number; t: number }[]
}

const HOLD_MS = 3000
/** 指がこれだけ動いたら、待たずに泡を持って動かす（px） */
const DRAG_START = 8
/** 離した時の速さがこれより速ければ、はじいて外す（px/秒）。遅ければ、その勢いのまま漂いに戻る */
const FLING_SPEED = 900

/**
 * 泡。タップ＝はじける。指で押して動かす＝そのまま持って動かせる（ほかの泡を押しのける）。
 * 離す時に勢いよくはじくと外れ、ゆっくり離すと、その勢いのまま漂いに戻る。
 * 長押しして動かさずに離すと、その場で少し止まって × が出る（はじけない人のための代わりの操作）
 */
function Bubble({
  q,
  sim,
  hintId,
  onTap,
  onFling,
}: {
  q: BubbleQ
  sim: BubbleSim
  hintId: string
  onTap: (q: BubbleQ) => void
  onFling: Props['onFling']
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const press = useRef<Press | null>(null)
  const suppressClick = useRef(false)
  const [held, setHeld] = useState(false)

  useLayoutEffect(() => {
    sim.els.set(q.id, wrap.current!)
    return () => {
      sim.els.delete(q.id)
    }
  }, [q.id, sim])

  useEffect(() => {
    if (!held) return
    const t = setTimeout(() => {
      setHeld(false)
      sim.release(q.id)
    }, HOLD_MS)
    return () => clearTimeout(t)
  }, [held, q.id, sim])

  const local = (e: React.PointerEvent) => {
    const r = wrap.current!.parentElement!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const fling = (vx: number, vy: number) => {
    setHeld(false)
    // 浮き上がってはじける途中の泡は、もう外せない
    if (!sim.fling(q.id, vx, vy)) return
    juice.bubbleFling()
    onFling(q)
  }

  return (
    <div ref={wrap} className="pointer-events-auto absolute top-0 left-0" style={{ opacity: 0 }}>
      <button
        type="button"
        aria-label={q.text}
        aria-describedby={hintId}
        className="no-callout relative grid h-full w-full touch-none place-items-center rounded-full outline-offset-0"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // 取れなくても動きは変わらない
          }
          const p = local(e)
          const s = sim.get(q.id)
          suppressClick.current = false
          const pr: Press = {
            x0: p.x,
            y0: p.y,
            offX: s ? s.x - p.x : 0,
            offY: s ? s.y - p.y : 0,
            grabbed: false,
            samples: [{ ...p, t: e.timeStamp }],
            // 動かさずに押し続けたら、持ち上げる（離すと × が出る）
            timer: window.setTimeout(() => {
              if (press.current !== pr || pr.grabbed) return
              pr.grabbed = true
              setHeld(false)
              sim.grab(q.id, pr.x0 + pr.offX, pr.y0 + pr.offY)
              haptic(8)
            }, usePapers.getState().settings.longPress),
          }
          press.current = pr
        }}
        onPointerMove={(e) => {
          const pr = press.current
          if (!pr) return
          const p = local(e)
          if (!pr.grabbed) {
            if (Math.hypot(p.x - pr.x0, p.y - pr.y0) <= DRAG_START) return
            // 指が動いたら、待たずにそのまま持つ
            clearTimeout(pr.timer)
            pr.grabbed = true
            setHeld(false)
            sim.grab(q.id, p.x + pr.offX, p.y + pr.offY)
          }
          sim.moveGrab(q.id, p.x + pr.offX, p.y + pr.offY)
          pr.samples.push({ ...p, t: e.timeStamp })
          while (pr.samples.length > 2 && e.timeStamp - pr.samples[0].t > 100) pr.samples.shift()
        }}
        onPointerUp={(e) => {
          const pr = press.current
          press.current = null
          if (!pr) return
          clearTimeout(pr.timer)
          if (!pr.grabbed) return
          suppressClick.current = true
          const p = local(e)
          // 離す直前（100ms）の指の速さ
          const first = pr.samples[0]
          const dtS = Math.max(0.016, (e.timeStamp - first.t) / 1000)
          const vx = (p.x - first.x) / dtS
          const vy = (p.y - first.y) / dtS
          const speed = Math.hypot(vx, vy)
          if (speed > FLING_SPEED) {
            // はじいた向きへ飛ばす（速すぎる時は、目で追える速さまで）
            const k = Math.min(1, 2600 / speed)
            fling(vx * k, vy * k)
          } else if (Math.hypot(p.x - pr.x0, p.y - pr.y0) > DRAG_START) {
            // 動かしてから離した：その勢いのまま、漂いに戻る
            sim.release(q.id, vx, vy)
          } else {
            // 長押しして、動かさずに離した：その場で止めて × を出す
            sim.hold(q.id)
            setHeld(true)
          }
        }}
        onPointerCancel={() => {
          const pr = press.current
          press.current = null
          if (pr) {
            clearTimeout(pr.timer)
            if (pr.grabbed) sim.release(q.id)
          }
          suppressClick.current = true
        }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false
            return
          }
          setHeld(false)
          onTap(q)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Delete' || e.key === 'Backspace') fling(0, -900)
        }}
      >
        {/* 指で押しやすいよう、見た目より少し広く押せる */}
        <span aria-hidden className="absolute -inset-2.5 rounded-full" />
        {/* 問いは用紙に刷られた言葉なので、印刷の緑で。縁取りは白ではなく紙の色（シールのように浮かないように） */}
        <span
          className="phrase-wrap pointer-events-none px-2 text-center leading-[1.35] font-medium text-print [text-shadow:0_0_5px_var(--color-paper-bright),0_0_1px_var(--color-paper-bright)]"
          style={{ fontSize: `${0.875 * sim.labelScale(q.text)}rem` }}
        >
          <Phrases text={q.text} narrow />
        </span>
      </button>
      {held && (
        <button
          type="button"
          aria-label={`「${q.text}」を外す`}
          onClick={() => fling(0, -900)}
          className="absolute -top-2 -right-2 grid h-11 w-11 place-items-center"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-ink/80 text-white shadow-[0_2px_6px_rgba(0,0,0,0.2)]">
            <Icon name="close" size={16} />
          </span>
        </button>
      )}
    </div>
  )
}

/** 動きを減らす設定・WebGL 不可の時：最大3枚のカードを並べる。タップで選ぶ、×で消す */
function BubbleCards({ questions, height, onPop, onFling }: Props) {
  const shown = questions.slice(0, 3)
  return (
    <div className="flex items-center gap-2 px-3" style={{ minHeight: Math.min(height, 120) }}>
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((q) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative min-w-0 flex-1 rounded-2xl bg-white/85 shadow-[0_1px_4px_rgba(40,60,70,0.1)]"
          >
            <button
              type="button"
              aria-label={q.text}
              className="phrase-wrap block min-h-[76px] w-full rounded-2xl py-2.5 pr-8 pl-3 text-left text-[0.875rem] leading-snug active:bg-white"
              onClick={() => onPop(q)}
            >
              <Phrases text={q.text} narrow />
            </button>
            <button
              type="button"
              aria-label={`「${q.text}」を外す`}
              className="absolute top-0 right-0 grid h-11 w-10 place-items-center text-ink-faint"
              onClick={() => onFling(q)}
            >
              <Icon name="close" size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

class Guard extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** 3D の部品を先に読み込んでおく */
export function preloadBubbles() {
  void import('./Bubble3D')
}
