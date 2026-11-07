import { useEffect, useRef } from 'react'
import { usePapers } from '../store'

/**
 * デバッグ用：1秒ごとのフレームレートと、いちばん重かった1フレームの時間。
 * iPhone 実機で泡やズームがカクつくかを、数字で確かめるために使う（目標 60fps = 16.7ms）。
 */
export function FpsMeter() {
  const show = usePapers((s) => s.settings.showFps)
  const el = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!show) return
    let raf = 0
    let last = performance.now()
    let frames = 0
    let worst = 0
    let windowStart = last
    const tick = (now: number) => {
      const dt = now - last
      last = now
      frames++
      worst = Math.max(worst, dt)
      if (now - windowStart >= 1000) {
        const fps = (frames * 1000) / (now - windowStart)
        if (el.current) el.current.textContent = `${fps.toFixed(0)} fps · 最大 ${worst.toFixed(1)} ms`
        el.current?.setAttribute('data-slow', String(fps < 50 || worst > 33))
        frames = 0
        worst = 0
        windowStart = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [show])

  if (!show) return null
  return (
    <div
      ref={el}
      aria-hidden
      className="pointer-events-none fixed left-2 z-[90] rounded-md bg-ink/80 px-2 py-1 font-mono text-[0.6875rem] text-white tabular-nums data-[slow=true]:bg-danger/90"
      style={{ bottom: 'calc(var(--safe-bottom) + 6px)' }}
    >
      …
    </div>
  )
}
