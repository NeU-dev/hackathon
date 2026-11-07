import { useEffect, useRef, type RefObject } from 'react'

/**
 * 画面の重なり（スタック）。開いた順に積み、いちばん上の画面だけが「戻る」を受け取る。
 * Esc キーや戻る操作は、いつも一番上の画面を閉じる。
 */
const stack: (() => void)[] = []

export function useBack(handler: () => void, active = true) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!active) return
    const fn = () => ref.current()
    stack.push(fn)
    return () => {
      const i = stack.lastIndexOf(fn)
      if (i >= 0) stack.splice(i, 1)
    }
  }, [active])
}

export function goBack(): boolean {
  const fn = stack[stack.length - 1]
  if (!fn) return false
  fn()
  return true
}

/**
 * 画面が開いたら、その画面にフォーカスを移す（キーボードや読み上げが、後ろの画面に取り残されないように）。
 * 閉じたら、開く前にフォーカスがあった場所へ戻す。
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    ref.current?.focus({ preventScroll: true })
    return () => {
      if (before && before.isConnected) before.focus({ preventScroll: true })
    }
  }, [ref])
}
