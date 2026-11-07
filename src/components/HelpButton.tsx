import { useUI } from '../ui'

/**
 * 「相談先」ボタン。どの画面でも見出しの右端に置く（画面に浮かせない）。
 * 見出しの一部なので、メモ用紙などの暗い幕が出た時は、ほかと同じように一緒に暗くなる。
 */
export function HelpLink() {
  const setUI = useUI((s) => s.setUI)
  return (
    // 紙の小札：光沢や盛り上がりは付けず、細い縁と紙の地だけで「押せる」と分かるようにする
    <button
      type="button"
      onClick={() => setUI({ help: { serious: false } })}
      className="h-11 shrink-0 rounded-full border border-ink/20 bg-paper/80 px-3.5 text-[0.8125rem] text-ink active:bg-paper-dim"
    >
      相談先
    </button>
  )
}
