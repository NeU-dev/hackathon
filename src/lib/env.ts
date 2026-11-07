import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { usePapers } from '../store'

/** 動きを減らすか。設定で上書きできる（初期は端末の設定に従う） */
export function useReduced(): boolean {
  const system = useReducedMotion() ?? false
  const pref = usePapers((s) => s.settings.motion)
  return pref === 'reduce' ? true : pref === 'full' ? false : system
}

let webgl: boolean | undefined
export function hasWebGL(): boolean {
  if (webgl !== undefined) return webgl
  try {
    const c = document.createElement('canvas')
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    webgl = false
  }
  return webgl
}

/**
 * キーボードが開いても入力欄が隠れないよう、visualViewport の高さと位置を CSS 変数に流す。
 * --vvh: 見えている高さ / --vvt: 見えている領域の上端
 */
export function useVisualViewport(): { height: number; top: number } {
  const [vv, setVV] = useState(() => read())
  useEffect(() => {
    const v = window.visualViewport
    const update = () => {
      const next = read()
      document.documentElement.style.setProperty('--vvh', `${next.height}px`)
      document.documentElement.style.setProperty('--vvt', `${next.top}px`)
      setVV(next)
    }
    update()
    v?.addEventListener('resize', update)
    v?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      v?.removeEventListener('resize', update)
      v?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return vv
}

function read() {
  const v = window.visualViewport
  return { height: v ? v.height : window.innerHeight, top: v ? v.offsetTop : 0 }
}
