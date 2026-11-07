import { useEffect, useRef, useState } from 'react'
import { animate } from 'motion'
import { juice } from '../lib/juice'
import type { SheetLayout } from './WriteSheet'

/**
 * 紙飛行機：書いたメモの紙が、その場で折りたたまれて紙飛行機になり、
 * 線を描きながらリストの行まで飛んで、着地すると1行になる。
 */

interface Flight {
  id: number
  from: DOMRect
  text: string
  layout: SheetLayout
  /** 着地先（行）。飛んでいる間も毎回測り直す（キーボードが閉じて画面が動いても追いかける） */
  target: () => DOMRect | null
  resolve: () => void
}

let push: ((f: Flight) => void) | undefined
let seq = 0

export function launchPlane(from: DOMRect, text: string, layout: SheetLayout, target: () => DOMRect | null): Promise<void> {
  return new Promise((done) => {
    if (!push || document.documentElement.hasAttribute('data-reduced')) return done()
    let settled = false
    const resolve = () => {
      if (settled) return
      settled = true
      done()
    }
    // 画面が閉じられても待ち続けないための保険
    setTimeout(resolve, 2400)
    push({ id: ++seq, from, text, layout, target, resolve })
  })
}

export function PlaneLayer() {
  const [flights, setFlights] = useState<Flight[]>([])
  useEffect(() => {
    push = (f) => setFlights((list) => [...list, f])
    return () => {
      push = undefined
    }
  }, [])
  return (
    <>
      {flights.map((f) => (
        <FlightView key={f.id} flight={f} onEnd={() => setFlights((list) => list.filter((x) => x.id !== f.id))} />
      ))}
    </>
  )
}

const FOLD = 0.4
const FLY = 0.85
const PLANE_W = 58
const PLANE_H = 40

function FlightView({ flight, onEnd }: { flight: Flight; onEnd: () => void }) {
  const sheet = useRef<HTMLDivElement>(null)
  const words = useRef<HTMLDivElement>(null)
  const crease = useRef<HTMLDivElement>(null)
  const plane = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const trail = useRef<SVGPathElement>(null)
  const { from, layout } = flight

  useEffect(() => {
    let stopped = false
    const ctrls: { stop: () => void }[] = []
    const run = async () => {
      // 1. 折る：文字が消え、紙がまん中で折れて、先のとがった紙飛行機の形に
      const sx = PLANE_W / from.width
      const sy = (PLANE_H * 1.5) / from.height
      ctrls.push(animate(words.current!, { opacity: 0 }, { duration: 0.14 }))
      ctrls.push(animate(crease.current!, { opacity: [0, 1] }, { duration: FOLD * 0.6, delay: 0.08 }))
      const fold = animate(
        sheet.current!,
        {
          clipPath: [
            'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
            'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
            'polygon(50% 0%, 100% 100%, 50% 74%, 0% 100%)',
          ],
          scaleX: [1, 0.9, sx],
          scaleY: [1, 0.55, sy],
          rotate: [0, -3, 90],
        },
        { duration: FOLD, times: [0, 0.35, 1], ease: [0.5, 0, 0.2, 1] },
      )
      ctrls.push(fold)
      await fold
      if (stopped) return

      // 2. 飛ぶ：まず外へふくらみ、ひと回りしてから行へ向かう
      const a = { x: from.left + from.width / 2, y: from.top + from.height / 2 }
      juice.planeLaunch()
      const end = () => {
        const r = flight.target()
        return r ? { x: r.left + 26, y: r.top + r.height / 2 } : { x: a.x, y: a.y + 200 }
      }
      const pts: string[] = []
      let landed = false
      const fly = animate(0, 1, {
        duration: FLY,
        ease: [0.45, 0, 0.3, 1],
        onUpdate: (t) => {
          const b = end()
          const c1 = { x: a.x + 150, y: a.y - 70 }
          const c2 = { x: b.x + 190, y: b.y - 150 }
          const u = 1 - t
          const x = u ** 3 * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * b.x
          const y = u ** 3 * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * b.y
          // 進む向き（3次ベジェの微分）
          const dx = 3 * u * u * (c1.x - a.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (b.x - c2.x)
          const dy = 3 * u * u * (c1.y - a.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (b.y - c2.y)
          const ang = (Math.atan2(dy, dx) * 180) / Math.PI
          // 機体をひらひら傾ける（バンク）
          const bank = 1 - 0.3 * Math.abs(Math.sin(t * Math.PI * 2.2))
          plane.current!.style.transform = `translate3d(${x - PLANE_W / 2}px, ${y - PLANE_H / 2}px, 0) rotate(${ang}deg)`
          body.current!.style.transform = `scaleY(${bank})`
          // 最初の位置が決まってから見せる（左上に一瞬出ないように）。折った紙と入れ替える
          if (pts.length === 0) {
            sheet.current!.style.opacity = '0'
            plane.current!.style.opacity = '1'
          }
          pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
          trail.current?.setAttribute('d', `M${pts.join(' L')}`)
        },
        onComplete: () => {
          landed = true
        },
      })
      ctrls.push(fly)
      await fly
      if (stopped || !landed) return

      // 3. 着地：機首を下げて小さくなり、行に吸いこまれる
      const b = end()
      juice.planeLand(b.x, b.y)
      flight.resolve()
      ctrls.push(animate(trail.current!, { opacity: 0 }, { duration: 0.45 }))
      await animate(plane.current!, { opacity: 0, scale: 0.3 }, { duration: 0.2, ease: 'easeIn' })
      onEnd()
    }
    run()
    // 片付けの時は待ち合わせを解かない（開発時の二重実行で、着地前に行が出てしまわないように）。
    // 画面が閉じられた時は launchPlane の保険の時間で解ける
    return () => {
      stopped = true
      ctrls.forEach((c) => c.stop())
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-[56]" aria-hidden>
      <svg className="absolute inset-0 h-full w-full">
        <path ref={trail} fill="none" stroke="var(--color-pen)" strokeOpacity={0.28} strokeWidth={1.4} strokeDasharray="1 6" strokeLinecap="round" />
      </svg>

      {/* 折られていくメモの紙 */}
      <div
        ref={sheet}
        className="paper-sheet absolute overflow-hidden rounded-[4px]"
        style={{ left: from.left, top: from.top, width: from.width, height: from.height, transformOrigin: '50% 50%' }}
      >
        {/* 用紙に書いてあった時と同じ場所に、同じ文字を置く（折り始めに文字が跳ねないように） */}
        <div ref={words} className="absolute inset-0">
          <div aria-hidden className="mx-3 h-2.5 border-b-2 border-dotted border-print-line" />
          {layout.heading && (
            <p
              className="absolute text-[1.0625rem] leading-snug font-medium text-accent"
              style={{ top: layout.heading.top, left: layout.heading.left, width: layout.heading.width }}
            >
              {layout.heading.text}
            </p>
          )}
          <p
            className="field pen absolute text-[1.125rem] whitespace-pre-wrap"
            style={{ top: layout.body.top, left: layout.body.left, width: layout.body.width }}
          >
            {flight.text}
          </p>
        </div>
        <div ref={crease} className="absolute inset-0 opacity-0" style={{ background: 'linear-gradient(90deg, rgb(255 255 255 / 0.5), rgb(160 140 105 / 0.35) 50%, rgb(255 255 255 / 0.2) 50.5%, rgb(120 100 70 / 0.25))' }} />
      </div>

      {/* 紙飛行機（上から見た形。左の翼は光、右の翼は影） */}
      <div ref={plane} className="absolute top-0 left-0 opacity-0" style={{ width: PLANE_W, height: PLANE_H }}>
        <div ref={body} className="h-full w-full">
          <svg viewBox="-30 -20 60 40" width={PLANE_W} height={PLANE_H} style={{ overflow: 'visible' }}>
            <path d="M28 0 L-26 -16 L-14 0 L-26 16 Z" transform="translate(5 11)" fill="rgb(60 45 25 / 0.16)" />
            <path d="M28 0 L-26 -16 L-12 0 Z" fill="#fffdf6" stroke="#c9bc9f" strokeWidth={0.8} strokeLinejoin="round" />
            <path d="M28 0 L-12 0 L-26 16 Z" fill="#ebe1cc" stroke="#c9bc9f" strokeWidth={0.8} strokeLinejoin="round" />
            <path d="M28 0 L-12 0 L-19 5 Z" fill="#d6c9ad" />
            <line x1={28} y1={0} x2={-12} y2={0} stroke="#ad9d7e" strokeWidth={0.9} />
          </svg>
        </div>
      </div>
    </div>
  )
}
