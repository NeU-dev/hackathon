import { useEffect, useRef } from 'react'

/**
 * 画面全体に重ねる1枚の canvas。泡がはじける・インクが落ちる、といった一瞬の演出を描く。
 * 粒が残っている間だけ描画ループを回し、なくなったら止める。
 */

type Kind = 'flash' | 'ring' | 'shard' | 'drop' | 'mist' | 'dust'

interface P {
  k: Kind
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  r: number
  hue: number
  /** shard：縁のどの角度のかけらか */
  ang: number
  span: number
  rot: number
  vr: number
  g: number
  drag: number
}

/** 粒は最初に作り置きして使い回す（はじけるたびに作って捨てると、GC で引っかかる） */
const POOL_SIZE = 480
const pool: (P & { alive: boolean })[] = Array.from({ length: POOL_SIZE }, () => ({ ...blank('drop'), alive: false }))
let aliveCount = 0
let cursor = 0
let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let last = 0
let W = 0
let H = 0

const reduced = () => document.documentElement.hasAttribute('data-reduced')

/** 粒の色はアプリの色だけ：印刷の緑・ブルーブラック・真鍮の金・うすい緑（p.hue はこの番号） */
const PALETTE = ['68,115,106', '36,55,90', '190,152,84', '141,178,167']
const col = (i: number, a: number) => `rgba(${PALETTE[Math.abs(Math.round(i)) % PALETTE.length]},${a})`
const rand = (a: number, b: number) => a + Math.random() * (b - a)
function blank(k: Kind): P {
  return { k, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0.3, r: 1, hue: 0, ang: 0, span: 0, rot: 0, vr: 0, g: 0, drag: 0 }
}

/** 空いている粒を1つ取り出して、初期値に戻して返す（空きがなければ一番古いものを使う） */
function spawn(k: Kind, x: number, y: number, init: Partial<P>): void {
  let p = pool[cursor]
  for (let i = 0; i < POOL_SIZE; i++) {
    const c = pool[(cursor + i) % POOL_SIZE]
    if (!c.alive) {
      p = c
      cursor = (cursor + i + 1) % POOL_SIZE
      break
    }
  }
  if (!p.alive) aliveCount++
  Object.assign(p, blank(k), { x, y }, init)
  p.alive = true
}

function start() {
  if (raf || !ctx) return
  last = performance.now()
  raf = requestAnimationFrame(tick)
}

function tick(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  for (const p of pool) {
    if (!p.alive) continue
    p.age += dt
    p.vy += p.g * dt
    const f = Math.max(0, 1 - p.drag * dt)
    p.vx *= f
    p.vy *= f
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rot += p.vr * dt
    if (p.age >= p.life) {
      p.alive = false
      aliveCount--
    }
  }
  draw()
  raf = aliveCount > 0 ? requestAnimationFrame(tick) : 0
}

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  for (const p of pool) {
    if (!p.alive) continue
    const t = p.age / p.life
    const a = 1 - t
    switch (p.k) {
      case 'flash': {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (0.6 + 0.7 * t))
        g.addColorStop(0, `rgba(255,253,244,${0.9 * a})`)
        g.addColorStop(1, 'rgba(255,253,244,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * (0.6 + 0.7 * t), 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'ring': {
        const e = 1 - (1 - t) ** 3
        const rr = p.r * (1 + 0.75 * e)
        ctx.lineWidth = 2 * a + 0.3
        ctx.strokeStyle = col(0, 0.7 * a)
        ctx.beginPath()
        ctx.arc(p.x, p.y, rr, 0, Math.PI * 2)
        ctx.stroke()
        break
      }
      case 'shard': {
        // 膜のかけら：縁の弧が外へ飛びながら縮む
        const cx = p.x - Math.cos(p.ang) * p.r
        const cy = p.y - Math.sin(p.ang) * p.r
        const span = p.span * (1 - 0.5 * t)
        // 泡の輪郭線が、ちぎれて飛んでいく
        ctx.lineCap = 'round'
        ctx.lineWidth = 2.2 * a + 0.4
        ctx.strokeStyle = col(p.hue, 0.9 * a)
        ctx.beginPath()
        ctx.arc(cx, cy, p.r, p.ang + p.rot - span / 2, p.ang + p.rot + span / 2)
        ctx.stroke()
        break
      }
      case 'drop':
      case 'mist': {
        const r = p.k === 'mist' ? p.r * (1 + t) : p.r
        const alpha = p.k === 'mist' ? 0.22 * a : a
        // しずく：紙色の丸に、印刷の線
        ctx.fillStyle = p.k === 'drop' ? `rgba(255,253,244,${0.9 * alpha})` : col(p.hue, 0.6 * alpha)
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
        if (p.k === 'drop') {
          ctx.lineWidth = 1.1
          ctx.strokeStyle = col(p.hue, 0.85 * alpha)
          ctx.stroke()
        }
        break
      }
      case 'dust': {
        // 紙が着地した時に舞う、ほこりのような小さな粒
        ctx.fillStyle = `rgba(150,130,100,${0.35 * a})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * (1 + 0.6 * t), 0, Math.PI * 2)
        ctx.fill()
        break
      }
    }
  }
}

/** 泡がはじける：光・衝撃の輪・膜のかけら・しずく・霧 */
export function burst(x: number, y: number, r: number) {
  if (reduced() || !ctx) return
  const hue0 = Math.floor(rand(0, PALETTE.length))
  spawn('flash', x, y, { r: r * 0.95, life: 0.16 })
  spawn('ring', x, y, { r, life: 0.36 })
  const shards = 16
  for (let i = 0; i < shards; i++) {
    const ang = (i / shards) * Math.PI * 2 + rand(-0.12, 0.12)
    const sp = rand(150, 320)
    spawn('shard', x + Math.cos(ang) * r, y + Math.sin(ang) * r, {
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      ang,
      span: rand(0.2, 0.42),
      r: r * rand(0.5, 0.85),
      // かけらは、ほとんどが泡の輪郭と同じ緑。ときどきほかの色
      hue: i % 4 === 0 ? hue0 + i : 0,
      vr: rand(-5, 5),
      life: rand(0.26, 0.42),
      g: 260,
      drag: 3.2,
    })
  }
  for (let i = 0; i < 26; i++) {
    const ang = rand(0, Math.PI * 2)
    const sp = rand(160, 460)
    spawn('drop', x + Math.cos(ang) * r * rand(0.7, 1), y + Math.sin(ang) * r * rand(0.7, 1), {
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - rand(40, 140),
      r: rand(1.4, 3.8),
      hue: Math.floor(rand(0, PALETTE.length)),
      life: rand(0.5, 0.95),
      g: 1150,
      drag: 1.4,
    })
  }
  for (let i = 0; i < 9; i++) {
    const ang = rand(0, Math.PI * 2)
    const d = rand(0, r * 0.6)
    spawn('mist', x + Math.cos(ang) * d, y + Math.sin(ang) * d, {
      vx: Math.cos(ang) * rand(30, 90),
      vy: Math.sin(ang) * rand(30, 90),
      r: rand(5, 11),
      hue: 3,
      life: rand(0.25, 0.4),
      drag: 2,
    })
  }
  start()
}

/** 飛ばした泡がこぼす、しずく */
export function trail(x: number, y: number, vx: number, vy: number) {
  if (reduced() || !ctx) return
  spawn('drop', x + rand(-6, 6), y + rand(-6, 6), {
    vx: vx * 0.15 + rand(-40, 40),
    vy: vy * 0.15 + rand(-40, 20),
    r: rand(1.2, 2.6),
    hue: Math.floor(rand(0, PALETTE.length)),
    life: rand(0.35, 0.55),
    g: 700,
    drag: 2,
  })
  start()
}

/** 紙飛行機が着地する：小さな輪と、ふわっと舞う粒 */
export function puff(x: number, y: number) {
  if (reduced() || !ctx) return
  spawn('ring', x, y, { r: 12, life: 0.3 })
  for (let i = 0; i < 9; i++) {
    const ang = rand(Math.PI * 0.9, Math.PI * 2.1)
    const sp = rand(40, 120)
    spawn('dust', x, y, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.6 - 20, r: rand(1.2, 2.6), life: rand(0.35, 0.6), drag: 4, g: 60 })
  }
  start()
}

export function FxLayer() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      W = window.innerWidth
      H = window.innerHeight
      c.width = Math.round(W * dpr)
      c.height = Math.round(H * dpr)
      c.style.width = `${W}px`
      c.style.height = `${H}px`
      ctx = c.getContext('2d')
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
      raf = 0
      ctx = null
      for (const p of pool) p.alive = false
      aliveCount = 0
    }
  }, [])
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed top-0 left-0 z-[57]" />
}
