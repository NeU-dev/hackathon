import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import { DIST, DUR, EASE, EASE_POP, step, swap } from '../lib/motion'

/**
 * 中身が変わって高さが変わる箱：高さを測って、なめらかに伸び縮みさせる。
 * 伸び縮みしている間だけ、はみ出しを隠す（止まっている時は、ボタンの影を切らない）
 */
export function ResizeBox({ children, className = '' }: { children: ReactNode; className?: string }) {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')
  const [moving, setMoving] = useState(false)
  useLayoutEffect(() => {
    const el = inner.current!
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <motion.div
      className={`relative ${className}`}
      style={{ overflow: moving ? 'hidden' : 'visible' }}
      initial={false}
      animate={{ height }}
      transition={{ duration: DUR.resize, ease: EASE }}
      onAnimationStart={() => setMoving(true)}
      onAnimationComplete={() => setMoving(false)}
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  )
}

/**
 * 段階の入れ替え。id が変わると、古い中身は抜けていき、新しい中身が入る（両方いっしょに、同じ場所で）。
 * kind：page＝横へ送る（進む・戻る）、swap＝その場で入れ替える。resize：高さも伸び縮みさせる
 */
export function StepSwap({
  id,
  dir = 1,
  kind = 'page',
  resize = true,
  className = '',
  outerClassName = '',
  children,
}: {
  id: string
  dir?: number
  kind?: 'page' | 'swap'
  resize?: boolean
  /** 入れ替わる中身の箱 */
  className?: string
  /** 外側の箱（resize しない時。画面いっぱいに伸ばす時など） */
  outerClassName?: string
  children: ReactNode
}) {
  const variants: Variants = kind === 'page' ? step : swap
  const body = (
    <AnimatePresence mode="popLayout" initial={false} custom={dir}>
      <motion.div key={id} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" className={className}>
        {children}
      </motion.div>
    </AnimatePresence>
  )
  return resize ? <ResizeBox>{body}</ResizeBox> : <div className={`relative ${outerClassName}`}>{body}</div>
}

/** 言葉の入れ替え（ボタンの「消す」→「本当に消す」など）。幅の違う言葉でも、その場で入れ替わる */
export function Swap({ id, className = '', children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={id} className="inline-flex items-center" variants={swap} initial="enter" animate="center" exit="exit">
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/**
 * 数字が入る：1けたずつ、下から少し行き過ぎて止まる（ぼかしを解きながら）。
 * 読み上げには数字をそのまま渡す
 */
export function PopNumber({ value, delay = 0, className = '' }: { value: number; delay?: number; className?: string }) {
  return (
    <span className={`inline-flex ${className}`}>
      <span className="sr-only">{value}</span>
      {String(value)
        .split('')
        .map((d, i) => (
          <motion.span
            key={`${value}-${i}`}
            aria-hidden
            className="inline-block"
            initial={{ opacity: 0, y: DIST.base, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
            transition={{
              y: { duration: DUR.verySlow, ease: EASE_POP, delay: delay + i * 0.07 },
              // 行き過ぎるのは位置だけ（濃さとぼかしは行き過ぎない）
              opacity: { duration: DUR.verySlow, ease: EASE, delay: delay + i * 0.07 },
              filter: { duration: DUR.verySlow, ease: EASE, delay: delay + i * 0.07 },
            }}
          >
            {d}
          </motion.span>
        ))}
    </span>
  )
}
