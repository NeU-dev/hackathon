/**
 * 録画モード：URL に rec が付いている時（例：?full&rec）。
 * 画面録画に映ると困るもの（今すぐ鳴らす・通知（モック）・泡のヒント・使い方）を隠す。付けない時は今のまま
 */
const params = new URLSearchParams(location.search)

export const REC = params.has('rec')

/** ?demo=kikaku：企画書の例の紙を入れなおした状態で始める（録画のたびに設定を開かなくて済むように） */
export const DEMO = params.get('demo')

/** 録画モードで通知を出す合図を受ける：N キー、または画面の左上の端を長押し（iPhone） */
export function listenRingShortcut(onRing: () => void): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'n' && e.key !== 'N') return
    if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return
    const t = e.target as HTMLElement | null
    if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
    e.preventDefault()
    onRing()
  }

  // 左上の端（56px 四方）を 0.6 秒押し続けたら鳴らす。そのあとの「離した時のタップ」は、下のボタンに渡さない
  const CORNER = 56
  let timer = 0
  let start: { x: number; y: number } | undefined
  let fired = false
  const cancel = () => {
    clearTimeout(timer)
    start = undefined
  }
  const onDown = (e: PointerEvent) => {
    fired = false
    if (e.clientX > CORNER || e.clientY > CORNER) return
    start = { x: e.clientX, y: e.clientY }
    timer = window.setTimeout(() => {
      fired = true
      start = undefined
      onRing()
    }, 600)
  }
  const onMove = (e: PointerEvent) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel()
  }
  const onClick = (e: MouseEvent) => {
    if (!fired) return
    fired = false
    e.preventDefault()
    e.stopPropagation()
  }

  window.addEventListener('keydown', onKey)
  window.addEventListener('pointerdown', onDown, true)
  window.addEventListener('pointermove', onMove, true)
  window.addEventListener('pointerup', cancel, true)
  window.addEventListener('pointercancel', cancel, true)
  window.addEventListener('click', onClick, true)
  return () => {
    cancel()
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('pointerdown', onDown, true)
    window.removeEventListener('pointermove', onMove, true)
    window.removeEventListener('pointerup', cancel, true)
    window.removeEventListener('pointercancel', cancel, true)
    window.removeEventListener('click', onClick, true)
  }
}
