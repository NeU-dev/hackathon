const WEEK = ['日', '月', '火', '水', '木', '金', '土']

export function parseWhen(when: string): number | undefined {
  if (!when) return undefined
  const t = new Date(when).getTime()
  return Number.isNaN(t) ? undefined : t
}

/** 11月9日(月) 8:50 */
export function formatAt(t: number): string {
  const d = new Date(t)
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEK[d.getDay()]}) ${d.getHours()}:${mm}`
}

export function formatWhen(when: string): string {
  const t = parseWhen(when)
  return t === undefined ? when : formatAt(t)
}

/** Date → datetime-local の値 */
export function toLocalInput(t: number): string {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 明日の朝（計画の初期値） */
export function defaultWhen(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(8, 50, 0, 0)
  return toLocalInput(d.getTime())
}

/** 次の月曜の hour:minute（今日が月曜なら、来週の月曜）。デモの例の紙の「いつ」 */
export function nextMonday(hour: number, minute: number, now = Date.now()): number {
  const d = new Date(now)
  d.setDate(d.getDate() + (((1 - d.getDay() + 7) % 7) || 7))
  d.setHours(hour, minute, 0, 0)
  return d.getTime()
}

/** アニメーションが止まっている時（裏に回ったタブなど）も先に進めるよう、待つのは最大 ms まで */
export const atMost = (p: { then: (done: () => void) => unknown }, ms: number) =>
  new Promise<void>((resolve) => {
    p.then(resolve)
    setTimeout(resolve, ms)
  })

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
