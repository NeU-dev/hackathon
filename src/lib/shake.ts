import { useEffect, type RefObject } from 'react'
import { usePapers } from '../store'

/**
 * 画面のゆれ（trauma 方式）。
 * 出来事が trauma を足し、trauma は毎秒一定の量だけ減る。ゆれの大きさは trauma の二乗なので、
 * 小さな出来事はほとんど揺れず、大きな出来事だけがはっきり揺れ、必ず自然に止まる。
 * 揺らすのは見た目（CSS の translate / rotate）だけで、配置やタップ位置の計算には触れない。
 */

const MAX_X = 7
const MAX_Y = 5
const MAX_ROLL = 0.7 // 度
const DECAY = 1.4 // 1秒あたりに減る trauma

let trauma = 0
let t = 0
let raf = 0
let last = 0
const targets = new Set<HTMLElement>()

const reduced = () => document.documentElement.hasAttribute('data-reduced')

function apply(x: number, y: number, rot: number) {
  for (const el of targets) {
    if (x === 0 && y === 0 && rot === 0) {
      el.style.translate = ''
      el.style.rotate = ''
    } else {
      el.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`
      el.style.rotate = `${rot.toFixed(3)}deg`
    }
  }
}

function tick(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  trauma = Math.max(0, trauma - DECAY * dt)
  t += dt
  const s = trauma * trauma
  // 毎回の乱数ではなく、速さの違う sin を重ねる（ジリジリした震えにならないように）
  const n = (seed: number) => 0.6 * Math.sin(t * 31 + seed) + 0.4 * Math.sin(t * 57 + seed * 2)
  apply(MAX_X * s * n(1), MAX_Y * s * n(4), MAX_ROLL * s * n(7))
  if (trauma > 0) raf = requestAnimationFrame(tick)
  else {
    raf = 0
    apply(0, 0, 0)
  }
}

/** 揺れを足す（0〜1）。出来事が重なると足し算になる */
export function addTrauma(amount: number) {
  const scale = usePapers.getState().settings.shake
  if (reduced() || scale <= 0 || targets.size === 0) return
  trauma = Math.min(1, trauma + amount * scale)
  if (!raf) {
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }
}

/** この要素を揺らす対象にする */
export function useShakeTarget(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    targets.add(el)
    return () => {
      targets.delete(el)
      el.style.translate = ''
      el.style.rotate = ''
    }
  }, [ref])
}
