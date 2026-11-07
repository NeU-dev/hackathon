import { useEffect, useState } from 'react'

/** パソコンなどの広い画面：スマホの大きさの窓に入れて、机の真ん中に置く */
const WIDE = '(min-width: 720px) and (min-height: 560px)'

/** 窓の中（iframe）や ?full の時は、そのまま画面いっぱいに出す */
const embedded = (() => {
  try {
    return window.self !== window.top || new URLSearchParams(location.search).has('full')
  } catch {
    return true
  }
})()

export function useDeviceFrame() {
  const [wide, setWide] = useState(() => !embedded && window.matchMedia(WIDE).matches)
  useEffect(() => {
    if (embedded) return
    const mq = window.matchMedia(WIDE)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

/**
 * スマホ向けのモックを、パソコンで見せる時の台。
 * 中身は同じページを iframe で開くので、スマホと同じ幅・同じ動きになる（紙のデータも同じものを使う）
 */
export function DeviceFrame() {
  const [h, setH] = useState(() => frameHeight())
  useEffect(() => {
    const on = () => setH(frameHeight())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  return (
    <div className="desk-calm flex min-h-full flex-col items-center justify-center gap-3 px-6 py-6">
      <iframe
        title="問題解決モック"
        src={location.pathname + location.search}
        className="block rounded-[28px] border-0 bg-desk-calm shadow-[0_2px_4px_rgb(50_35_20/0.14),0_24px_48px_-16px_rgb(50_35_20/0.4)]"
        style={{ width: 390, height: h }}
      />
      <p className="text-center text-[0.8125rem] text-ink-soft">
        スマートフォン向けのモックです。スマホで開くと、画面いっぱいに出ます。
        <a href="?full" className="ml-2 text-accent underline underline-offset-2">
          この画面いっぱいで見る
        </a>
      </p>
    </div>
  )
}

const frameHeight = () => Math.max(480, Math.min(844, window.innerHeight - 88))
