/**
 * Claude の役割を切り出した関数群。
 * モックではすべてダミーデータを返す。本番ではこのファイルの中身だけを API 呼び出しに差し替える。
 * 呼び出し側が待てるように、すべて Promise を返す。
 */
import type { ConsultMemo, ConsultPaper, Evidence, FrameNo, Paper, Plan, ProblemCandidate, Reflection, ReportLine, ShrinkSuggestion } from '../types'
import {
  collectRecords,
  formatDay,
  formatMinutes,
  tallyRecords,
  writtenPapers,
  type Counts,
} from '../lib/records'
import * as D from './dummyData'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 吐き出した文章から、問題候補を2〜3個切り出す */
export async function splitProblems(text: string): Promise<ProblemCandidate[]> {
  await wait(700)
  if (['会議', '月曜', '部屋'].every((k) => text.includes(k))) return D.SPLIT_EXAMPLE

  let segs = text
    .split(/[。\n！!？?]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (segs.length < 2) segs = text.split(/[、,]+/).map((s) => s.trim()).filter(Boolean)
  const vague = /うまくいかない|なんか|全部|いろいろ|色々/
  const concrete = segs.filter((s) => !vague.test(s))
  const picks = (concrete.length ? concrete : segs).slice(0, 3)
  const unchangeable = /天気|景気|過去|性格|会社の方針|病気|年齢/
  return picks.map((t) => ({ text: t, changeable: !unchangeable.test(t) }))
}

export interface QuestionContext {
  /** もう出した（答えた・飛ばした）問い */
  asked: string[]
  /** いま漂っている問い */
  floating: string[]
  /** この枠で書いた数 */
  entries: number
  /** これまでの補充回数 */
  refills: number
  /** 画面を開いた時の最初の泡か */
  initial?: boolean
}

/** 次に出す泡の問い（0〜2個）。十分埋まったと判断したら空を返す */
export async function nextQuestions(step: FrameNo, ctx: QuestionContext): Promise<string[]> {
  await wait(ctx.initial ? 0 : 400)
  const pool = D.QUESTIONS[step] ?? []
  const used = new Set([...ctx.asked, ...ctx.floating])
  const rest = pool.filter((q) => !used.has(q))
  const room = 4 - ctx.floating.length
  if (room <= 0 || rest.length === 0) return []
  if (!ctx.initial) {
    // 2番：問いの補充は1枠につき最大2回まで
    if (step === 2 && ctx.refills >= 2) return []
    // 4番：案が十分出たら補充しない
    if (step === 4 && ctx.entries >= 8) return []
  }
  const n = Math.min(2, room, rest.length)
  // 2番は順番どおり。4番は「まだ出ていない角度」からランダムに
  if (step === 4) return shuffle(rest).slice(0, n)
  return rest.slice(0, n)
}

/**
 * 場面の答えを一文にまとめる。current があれば、それを土台に新しい答えを足して育てる。
 * （ダミーでは：土台がなければ答えを順につなぎ、あれば最後の答えを1文として足す）
 */
export async function summarizeScene(answers: { text: string }[], current?: string): Promise<string> {
  await wait(150)
  if (answers.length === 0) return current ?? ''
  const clean = (t: string) => t.trim().replace(/[。.]+$/, '')
  if (current) return `${clean(current)}。${clean(answers[answers.length - 1].text)}。`
  return answers.map((a) => clean(a.text)).join('、') + '。'
}

/** できなかった理由の選択肢（3〜4個）。「その他」は画面側で足す */
export async function reasonOptions(plan: Plan): Promise<string[]> {
  await wait(400)
  if (plan.where.includes('廊下') || plan.first.includes('メモ')) return D.REASONS_EXAMPLE
  return ['時間が合わなかった', `「${plan.where}」で始める余裕がなかった`, '始めたけど続かなかった', '気力がなかった']
}

/**
 * 同じ案でもう一度やる時の、縮小版の提案（1〜2個）。採用は本人。
 * reason：できなかった理由に合わせる（今どう？の「同じ案で、もう一度」）。
 * summary：ふりかえりのまとめで見つかった条件（例：5分以内）に合わせて、一歩を縮める。minutes は今の一歩の大きさ
 */
/**
 * 縮めた一歩の決まった言い方（ダミーの言い換えが無い時）。元の一歩を『』でくくって、
 * 「〜するの、最初のひと手だけ」のような読みにくいつながりにならないようにする
 */
function firstPart(first: string, part: string): string {
  return `『${first.trim()}』の、${part}だけ`
}

export async function shrinkPlan(
  plan: Plan,
  ctx: { reason: string } | { summary: Reflection | null; minutes: number },
): Promise<ShrinkSuggestion[]> {
  await wait(300)
  if ('summary' in ctx) {
    const limit = ctx.summary?.stepLimit ?? 5
    const smaller = D.SHRINK_STEPS[plan.first.trim()]
    if (ctx.minutes > limit) return [{ title: `${formatMinutes(limit)}以内の一歩に`, first: smaller ?? firstPart(plan.first, `最初の${formatMinutes(limit)}`) }]
    return [{ title: '最初の30秒に', first: smaller ?? firstPart(plan.first, '最初のひと手') }]
  }
  const { reason } = ctx
  if (reason === '気力がなかった' && (plan.where.includes('廊下') || plan.first.includes('メモ'))) {
    return D.SHRINK_EXAMPLE
  }
  const out: ShrinkSuggestion[] = [{ title: '最初の2分を、最初の30秒に', first: D.SHRINK_STEPS[plan.first.trim()] ?? firstPart(plan.first, '最初のひと手') }]
  if (/時間|余裕|合わなかった/.test(reason)) {
    out.push({ title: '始める場所を、もっと手前に', first: `前の日のうちに、『${plan.first}』の準備だけする` })
  }
  return out
}

/** 深刻な状態かどうか（モックではキーワード） */
export async function isSerious(text: string): Promise<boolean> {
  return D.SERIOUS_KEYWORDS.some((k) => text.includes(k))
}

/**
 * 本人用のふりかえりの文面（まとめの一文、うまくいった条件、効いた変え方、書き方の変化）。
 * 各行に根拠の紙を必ず付け、根拠が2枚未満の項目は null にする。数は counts と records.ts が数えたものを使い、ここでは言葉にするだけ。
 * 語るのは計画の特徴（一歩の大きさ・時間・場所・具体さ・問題の切り替え）だけで、人の性格や状態は語らない
 */
export async function analyzeRecords(papers: Paper[], counts: Counts): Promise<Reflection> {
  await wait(250)
  const none: Reflection = { summary: null, conditions: null, changes: null, wording: null }
  // 紙が少ないうちは、傾向を言わない
  if (counts.papers < 3) return none

  const records = collectRecords(papers)
  const t = tallyRecords(records)
  const ev = (r: Evidence): Evidence => ({ paperId: r.paperId, sheetNo: r.sheetNo, date: r.date })
  const enough = (l: ReportLine) => l.evidence.length >= 2
  const keep = (l: ReportLine | null): ReportLine | null => {
    if (!l || !enough(l)) return null
    const text = filterOutput(l.text)
    return text ? { ...l, text } : null
  }

  // うまくいった時の条件：一歩の大きさ
  const allSmall = t.smallMoved.length === t.small.length
  const small = keep(
    t.small.length >= 2 && t.smallMoved.length > 0
      ? {
          text: allSmall
            ? `最初の一歩が5分以内の紙は、${t.small.length}枚とも動いた`
            : `最初の一歩が5分以内の紙は、${t.small.length}枚のうち${t.smallMoved.length}枚が動いた`,
          evidence: t.smallMoved.map(ev),
        }
      : null,
  )
  const big = keep(
    t.big.length >= 2 && t.bigMoved.length === 0
      ? { text: `一歩が大きめ（${formatMinutes(t.bigMin)}以上）のときは、動きにくかった`, evidence: t.big.map(ev) }
      : null,
  )

  // 効いた変え方：止まったあと、一歩を縮めた・案を変えた
  const n = t.shrunk.length
  const m = t.shrunkMoved.length
  const shrunk = keep(
    m > 0
      ? {
          text: m === n ? (n === 1 ? '一歩を小さく縮めて戻ってきた時に、動けた' : `一歩を小さく縮めて戻ってきた${n}回は、どれも動けた`) : `一歩を小さく縮めて戻ってきた${n}回のうち、${m}回は動けた`,
          evidence: t.shrunkMoved.map(ev),
          quotes: t.shrunkMoved.map((r) => ({
            before: `${r.prev!.first}（${formatMinutes(r.prev!.minutes)}）`,
            after: `${r.first}（${formatMinutes(r.minutes)}）`,
          })),
        }
      : null,
  )
  const switched = keep(
    t.switchedMoved.length > 0
      ? {
          text: '案を変えて戻ってきた時に、動けた',
          evidence: t.switchedMoved.map(ev),
          quotes: t.switchedMoved.map((r) => ({ before: r.prev!.idea!, after: r.idea! })),
        }
      : null,
  )

  // 書き方の変化：いちばん古い紙と、いちばん新しい紙の困りごと
  const list = writtenPapers(papers)
  const a = list[0]
  const b = list[list.length - 1]
  const before = a.sheets[0].problem ?? ''
  const after = b.sheets[0].problem ?? ''
  const wording = keep(
    a !== b && before !== after && after.length > before.length
      ? {
          text: '問題を具体的に書けるようになっている',
          evidence: [a, b].map((p) => ({ paperId: p.id, sheetNo: 1, date: p.createdAt })),
          quotes: [{ before, after }],
        }
      : null,
  )

  // まとめの一文：条件と変え方を、一歩の大きさの話として1〜2文に
  const sentences: string[] = []
  const used: ReportLine[] = []
  if (small) {
    sentences.push(
      allSmall
        ? 'あなたの場合、最初の一歩を5分以内にすると動けています。'
        : `あなたの場合、最初の一歩を5分以内にした紙は、${t.small.length}枚のうち${t.smallMoved.length}枚が動いています。`,
    )
    used.push(small)
  } else if (big) {
    sentences.push(`あなたの場合、一歩が大きめ（${formatMinutes(t.bigMin)}以上）のときは、動きにくかったようです。`)
    used.push(big)
  }
  if (shrunk) {
    sentences.push(m === n ? `止まった${n}回も、一歩を縮めて戻ったら動けました。` : `止まったあと一歩を縮めて戻った${n}回のうち、${m}回は動けました。`)
    used.push(shrunk)
  } else if (switched) {
    sentences.push('止まったあと、案を変えて戻った時に動けました。')
    used.push(switched)
  }
  if (sentences.length === 0 && wording) {
    sentences.push('問題を、前より具体的に書けるようになっています。')
    used.push(wording)
  }
  const seen = new Set<string>()
  const summaryEvidence = used.flatMap((l) => l.evidence).filter((e) => {
    const k = `${e.paperId}-${e.sheetNo}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const summary = keep(sentences.length ? { text: sentences.join(''), evidence: summaryEvidence } : null)

  const conditions = [small, big].filter((l): l is ReportLine => !!l)
  const changes = [shrunk, switched].filter((l): l is ReportLine => !!l)
  return {
    summary,
    conditions: conditions.length ? conditions : null,
    changes: changes.length ? changes : null,
    wording,
    stepLimit: small || big ? 5 : undefined,
  }
}

/**
 * 相談メモの下書き。本人が選んだ紙（1〜3件）だけを使う。
 * 本人用の「記録に基づく一言」と「次に試せること」は入れない
 */
export async function buildConsultMemo(selected: Paper[], counts: Counts, reflection: Reflection, period: string): Promise<ConsultMemo> {
  await wait(350)
  const resultLabel = { done: '実行', partial: '一部', skipped: '今回は見送り' } as const
  const breakdown = [`実行${counts.done}`, counts.partial ? `一部${counts.partial}` : '', counts.skipped ? `今回は見送り${counts.skipped}` : '']
    .filter(Boolean)
    .join('・')

  const papers: ConsultPaper[] = selected.map((p) => {
    const recs = collectRecords([p])
    const many = recs.length > 1
    const label = (i: number, s: string) => (many ? `${i + 1}枚目：${s}` : s)
    // 重ねた紙は下の紙から、同じ困りごとを書きなおした紙は止まった紙から、変えたこと
    const changed = recs
      .filter((r) => r.prev)
      .map((r) =>
        r.prev!.idea && r.idea && r.prev!.idea !== r.idea
          ? `案を「${r.prev!.idea}」から「${r.idea}」に`
          : `最初の一歩を「${r.prev!.first}」から「${r.first}」に`,
      )
    const last = p.sheets[p.sheets.length - 1]
    return {
      paperId: p.id,
      date: formatDay(p.createdAt),
      problem: last.problem ?? '',
      goal: last.goal ?? '',
      method: recs.map((r, i) => label(i, `${r.idea ?? ''}／最初の一歩：${r.first}（${formatMinutes(r.minutes)}）`)).join('\n') || '（まだ決めていない）',
      result: recs.map((r, i) => label(i, r.result ? resultLabel[r.result] : 'まだ')).join('\n') || 'まだ',
      reason: recs.filter((r) => r.reason).map((r) => label(recs.indexOf(r), r.reason!)).join('\n') || '—',
      changed: changed.join('\n') || '—',
    }
  })

  const dated = (l: ReportLine) => {
    const days = [...new Set(l.evidence.map((e) => formatDay(e.date)))].join('、')
    const quote = l.quotes?.length ? `（${l.quotes.map((q) => `「${q.before}」→「${q.after}」`).join('、')}）` : ''
    return `${l.text}${quote}［${days}］`
  }
  const trends = [...(reflection.conditions ?? []), ...(reflection.changes ?? []), ...(reflection.wording ? [reflection.wording] : [])]
    .map((l) => filterOutput(dated(l)))
    .filter(Boolean)
    .slice(0, 3)

  return {
    title: D.MEMO_TITLE,
    period,
    note: D.MEMO_NOTE,
    amount: filterOutput(`紙${counts.papers}枚、計画${counts.plans}件（${breakdown}）、踏み出した一歩${counts.steps}回、戻ってきた回数${counts.returns}回`),
    condition: filterOutput(reflection.conditions?.[0]?.text ?? ''),
    topics: ['', '', ''],
    papers,
    trends,
    disclaimer: D.MEMO_DISCLAIMER,
  }
}

/**
 * 出力チェック：禁止語を含む文を落とす（モックでは単純な語リスト）。
 * 本番では、落とした文があれば作り直す
 */
export function filterOutput(text: string): string {
  const sentences = text.match(/[^。]+。?/g) ?? []
  return sentences
    .filter((s) => !D.BANNED_WORDS.some((w) => s.includes(w)))
    .join('')
    .trim()
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
