import type { Paper, Sheet } from '../types'

/**
 * ふりかえりの数を数える（ここはプログラムの仕事。Claude は数えない）。
 * 1枚の紙（重なった紙なら1枚ずつ）の計画と結果を、1件の記録にする。
 */

/** 実行 ／ 一部 ／ 今回は見送り */
export type StepResult = 'done' | 'partial' | 'skipped'

export interface StepRecord {
  paperId: string
  /** 何枚目の紙か（1始まり） */
  sheetNo: number
  date: number
  problem: string
  goal?: string
  idea?: string
  first: string
  minutes: number
  /** なし＝まだ聞いていない（実行待ち・書いている途中） */
  result?: StepResult
  /** 動きにくかった条件（本人が選んだ・書いた理由） */
  reason?: string
  /** 止まったあとに戻ってきた時の、前の紙の計画 */
  prev?: { first: string; minutes: number; idea?: string }
}

export interface Counts {
  /** 期間：いちばん古い紙の日〜今日 */
  from?: number
  to: number
  /** 書いた紙の枚数（困りごとまで書いた紙） */
  papers: number
  /** 踏み出した一歩（やった・一部） */
  steps: number
  /** 戻ってきた回数（止まったあとに紙を重ねた・同じ困りごとで書きなおした） */
  returns: number
  /** 結果まで聞いた計画の数 */
  plans: number
  done: number
  partial: number
  skipped: number
}

const moved = (r: StepRecord) => r.result === 'done' || r.result === 'partial'

/** 紙の7番から、結果と理由を読む */
function readResult(s: Sheet): { result?: StepResult; reason?: string } {
  const t = s.reflection
  if (!t) return {}
  if (t === 'できた') return { result: 'done' }
  if (t.startsWith('一部')) return { result: 'partial' }
  const reason = t.match(/理由：(.+)/)?.[1]?.trim()
  return { result: 'skipped', reason }
}

/** 最初の一歩にかかる時間（分）。「30秒」「5分」と書いてあれば読む。なければ2分（最初の2分） */
export function stepMinutes(s: Sheet): number {
  if (s.stepMin !== undefined) return s.stepMin
  const text = (s.plan?.first ?? '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  const sec = text.match(/(\d+)\s*秒/)
  if (sec) return Number(sec[1]) / 60
  const min = text.match(/(\d+)\s*分/)
  if (min) return Number(min[1])
  return 2
}

/** 30秒 ／ 5分 */
export function formatMinutes(m: number): string {
  return m < 1 ? `${Math.round(m * 60)}秒` : `${Math.round(m)}分`
}

const problemOf = (p: Paper) => p.sheets.find((s) => s.problem)?.problem?.trim()

/** 困りごとまで書いた紙（古い順） */
export function writtenPapers(papers: Paper[]): Paper[] {
  return papers.filter((p) => problemOf(p)).sort((a, b) => a.createdAt - b.createdAt)
}

interface Return {
  /** 止まった紙（今回は見送りの紙） */
  from: Sheet
  /** 戻ってきて書いた紙 */
  paperId: string
  sheetNo: number
  date: number
}

/**
 * 戻ってきた回数：「今回は見送り」で止まったあと、また紙に戻ってきたこと。1回止まるごとに、数えるのは1回まで。
 * 戻り方は2つ：その紙に新しい紙を重ねた（同じ案で・別の案で・もう一度やる）／同じ困りごとを、あとで新しい紙に書いた
 */
function findReturns(papers: Paper[]): Return[] {
  const out: Return[] = []
  const list = writtenPapers(papers)
  const claimed = new Set<string>()
  list.forEach((p, i) => {
    p.sheets.forEach((s, j) => {
      if (readResult(s).result !== 'skipped') return
      const next = p.sheets[j + 1]
      if (next) {
        out.push({ from: s, paperId: p.id, sheetNo: j + 2, date: next.createdAt })
        return
      }
      const again = list.slice(i + 1).find((q) => !claimed.has(q.id) && problemOf(q) === problemOf(p) && q.createdAt >= s.createdAt)
      if (again) {
        claimed.add(again.id)
        out.push({ from: s, paperId: again.id, sheetNo: 1, date: again.createdAt })
      }
    })
  })
  return out
}

/** 計画を立てた紙を、1枚ずつ記録にする（古い順） */
export function collectRecords(papers: Paper[]): StepRecord[] {
  const out: StepRecord[] = []
  const back = new Map(findReturns(papers).map((r) => [`${r.paperId}-${r.sheetNo}`, r.from]))
  writtenPapers(papers).forEach((p) => {
    const problem = problemOf(p)!
    p.sheets.forEach((s, j) => {
      if (!s.plan) return
      // 前の計画：重ねた紙なら下の紙、同じ困りごとに戻ってきた紙なら、止まった紙
      const prevSheet = j > 0 ? p.sheets[j - 1] : back.get(`${p.id}-1`)
      out.push({
        paperId: p.id,
        sheetNo: j + 1,
        date: s.createdAt,
        problem: s.problem ?? problem,
        goal: s.goal,
        idea: s.choice?.idea,
        first: s.plan.first,
        minutes: stepMinutes(s),
        ...readResult(s),
        prev: prevSheet?.plan ? { first: prevSheet.plan.first, minutes: stepMinutes(prevSheet), idea: prevSheet.choice?.idea } : undefined,
      })
    })
  })
  return out
}

/**
 * まだ戻っていない「今回は見送り」の紙（新しい順）。ふりかえりの「もう一度やってみる？」に出す。
 * いちばん上の紙が見送りで、その紙にも、同じ困りごとの新しい紙にも、まだ戻っていないもの
 */
export function stoppedPapers(papers: Paper[]): { paper: Paper; record: StepRecord }[] {
  const returned = new Set(findReturns(papers).map((r) => r.from.id))
  const records = collectRecords(papers)
  return writtenPapers(papers)
    .filter((p) => {
      const t = p.sheets[p.sheets.length - 1]
      return readResult(t).result === 'skipped' && !returned.has(t.id)
    })
    .map((paper) => ({ paper, record: records.find((r) => r.paperId === paper.id && r.sheetNo === paper.sheets.length)! }))
    .filter((x) => x.record)
    .sort((a, b) => b.record.date - a.record.date)
}

/** 戻ってきて書いた紙（ふりかえりの根拠） */
export function returnedSheets(papers: Paper[]): { paperId: string; sheetNo: number; date: number }[] {
  return findReturns(papers).map(({ paperId, sheetNo, date }) => ({ paperId, sheetNo, date }))
}

export function countRecords(papers: Paper[], now = Date.now()): Counts {
  const list = writtenPapers(papers)
  const records = collectRecords(papers)
  const done = records.filter((r) => r.result === 'done').length
  const partial = records.filter((r) => r.result === 'partial').length
  const skipped = records.filter((r) => r.result === 'skipped').length
  return {
    from: list[0]?.createdAt,
    to: now,
    papers: list.length,
    steps: records.filter(moved).length,
    returns: returnedSheets(papers).length,
    plans: done + partial + skipped,
    done,
    partial,
    skipped,
  }
}

export { moved as hasMoved }

/**
 * 計画の特徴ごとに分ける（数えるのはプログラム。Claude はこの数を言葉にするだけ）。
 * 一歩の大きさ：5分以内か、それより大きいか。戻ってきた紙：一歩を縮めたか、案を変えたか
 */
export function tallyRecords(records: StepRecord[]) {
  const asked = records.filter((r) => r.result)
  const small = asked.filter((r) => r.minutes <= 5)
  const big = asked.filter((r) => r.minutes > 5)
  const shrunk = asked.filter((r) => r.prev && r.minutes < r.prev.minutes)
  const switched = asked.filter((r) => r.prev && r.idea && r.prev.idea && r.idea !== r.prev.idea && !(r.minutes < r.prev.minutes))
  return {
    small,
    smallMoved: small.filter(moved),
    big,
    bigMoved: big.filter(moved),
    bigMin: Math.min(...big.map((r) => r.minutes)),
    shrunk,
    shrunkMoved: shrunk.filter(moved),
    switched,
    switchedMoved: switched.filter(moved),
  }
}

/** 9月17日 */
export const formatDay = (t: number) => {
  const d = new Date(t)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 9月17日〜11月4日 */
export const formatPeriod = (c: Pick<Counts, 'from' | 'to'>) => (c.from ? `${formatDay(c.from)}〜${formatDay(c.to)}` : '')
