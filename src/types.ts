export type FrameNo = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** 書いている途中 ／ 実行待ち ／ できた ／ 置いてある */
export type PaperStatus = 'writing' | 'waiting' | 'done' | 'shelved'

/** 作業画面で書いた1行。q は答えた泡の問い */
export interface Entry {
  id: string
  text: string
  q?: string
}

export interface Plan {
  /** datetime-local 形式 (YYYY-MM-DDTHH:mm) */
  when: string
  where: string
  first: string
}

export interface Choice {
  idea: string
  tired?: string
  worry?: string
}

/** 1枚の紙。重なると Paper.sheets に積まれる */
export interface Sheet {
  id: string
  createdAt: number
  dump: Entry[]
  problem?: string
  sceneAnswers: Entry[]
  scene?: string
  goalNotes: Entry[]
  goal?: string
  ideas: Entry[]
  choice?: Choice
  choiceDraft?: Choice
  plan?: Plan
  planDraft?: Plan
  reflection?: string
  /** 重なった紙で、書き直す枠 */
  highlight?: FrameNo[]
  via?: 'same' | 'other'
  prevChoice?: string
  shrink?: ShrinkSuggestion[]
  /** 枠ごとに、もう出した泡の問い */
  asked: Partial<Record<FrameNo, string[]>>
  /** 枠ごとの泡の補充回数 */
  refills: Partial<Record<FrameNo, number>>
  /** 最初の一歩にかかる時間（分）。なければ書いた文（「30秒」「5分」）から読み、それもなければ2分 */
  stepMin?: number
}

export interface Paper {
  id: string
  createdAt: number
  updatedAt: number
  status: PaperStatus
  sheets: Sheet[]
  notifyAt?: number
  notifyStopped?: boolean
  lastRungAt?: number
  shelvedNote?: string
  /** ふりかえりのデモ用に、最初から入っている過去の紙 */
  /** デモ用の紙：past＝ふりかえり用の過去の紙、boss＝上司への相談の例（?demo=boss で入れなおす） */
  sample?: 'past' | 'boss'
}

export interface ProblemCandidate {
  text: string
  changeable: boolean
}

export interface ShrinkSuggestion {
  title: string
  first: string
  /** いつ・どこでも変わる一歩の時だけ。⑥を開いた時に下書きとして入れ、本人が確かめてから決める */
  where?: string
  when?: string
}

/** ふりかえりの根拠になった紙（タップでその紙が開く） */
export interface Evidence {
  paperId: string
  /** 何枚目の紙か（1始まり） */
  sheetNo: number
  date: number
}

/** ふりかえりの1行。quotes は本人が書いた言葉（前 → 後） */
export interface ReportLine {
  text: string
  evidence: Evidence[]
  quotes?: { before: string; after: string }[]
}

/**
 * 本人用のふりかえり（analyzeRecords の返り値）。
 * 根拠の紙が2枚未満の項目は null（画面には出さない）
 */
export interface Reflection {
  /** まとめの一文（1〜2文）。条件と変え方を、計画の特徴の話としてまとめる */
  summary: ReportLine | null
  /** うまくいった時の条件（傾向） */
  conditions: ReportLine[] | null
  /** 効いた変え方（傾向） */
  changes: ReportLine[] | null
  /** 書き方の変化（傾向） */
  wording: ReportLine | null
  /** まとめで見つかった一歩の大きさ（分）。縮小版の提案はこれに合わせる */
  stepLimit?: number
}

/** 相談メモ（buildConsultMemo の返り値）。プレビューで本人がすべて書き換えられる */
export interface ConsultMemo {
  title: string
  period: string
  note: string
  amount: string
  condition: string
  topics: string[]
  papers: ConsultPaper[]
  trends: string[]
  disclaimer: string
}

export interface ConsultPaper {
  paperId: string
  date: string
  problem: string
  goal: string
  method: string
  result: string
  reason: string
  changed: string
}
