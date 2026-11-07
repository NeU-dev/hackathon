import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FrameNo, Paper, Plan, Sheet, ShrinkSuggestion } from './types'
import { defaultWhen, nextMonday, parseWhen, toLocalInput, uid } from './lib/format'
import * as D from './claude/dummyData'

export type MotionPref = 'system' | 'reduce' | 'full'

interface Settings {
  sound: boolean
  /** 音量 0〜1（聞こえ方に合わせて、内部で二乗してから dB に直す） */
  volume: number
  motion: MotionPref
  /** 画面の揺れの強さ 0〜1 */
  shake: number
  /** 文字の大きさ（1 = 16px） */
  textScale: number
  /** 泡を止めるまでの長押しの長さ（ミリ秒）。長押しして離すと、泡が止まって × が出る */
  longPress: number
  /** デバッグ：フレームレートを表示 */
  showFps: boolean
  /** 「泡は長押しして飛ばせる」のヒントをもう見せたか */
  flingHintSeen: boolean
  /** 使い方（最初に1回だけ出す）を、もう見たか・とばしたか */
  tutorialSeen: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  sound: false,
  volume: 0.7,
  motion: 'system',
  shake: 0.7,
  textScale: 1,
  longPress: 380,
  showFps: false,
  flingHintSeen: false,
  tutorialSeen: false,
}

type SheetPatch = Partial<Sheet> | ((s: Sheet) => Partial<Sheet>)

interface PaperState {
  papers: Paper[]
  settings: Settings
  createPaper: () => string
  patchTop: (paperId: string, patch: SheetPatch) => void
  patchPaper: (paperId: string, patch: Partial<Paper>) => void
  markAsked: (paperId: string, frame: FrameNo, q: string, asked: boolean) => void
  completePlan: (paperId: string, plan: Plan) => void
  /** やった。note は⑦に添えるひとこと */
  markDone: (paperId: string, note?: string) => void
  snooze: (paperId: string, at: number) => void
  stopAsking: (paperId: string) => void
  resumeAsking: (paperId: string) => void
  /** reason が空なら理由なし。firstDraft は、重ねた紙の「最初の2分」に下書きとして入れる */
  notDone: (paperId: string, reason: string, next: 'same' | 'other' | 'shelve', shrink?: ShrinkSuggestion[], firstDraft?: string) => void
  retry: (paperId: string, mode: 'same' | 'other', shrink?: ShrinkSuggestion[], firstDraft?: string) => void
  setSettings: (patch: Partial<Settings>) => void
  addExamplePaper: () => string
  /** 上司への相談の例（台本⑤）の紙を1枚つくる（6番まで書いた状態）。ほかの「上司への相談の例」を消して入れなおす時は replace */
  addBossPaper: (replace?: boolean) => string
  /** ふりかえりのデモ用の過去の紙（6枚）を入れなおす */
  addPastPapers: () => void
  clearAll: () => void
  /** 何も書かずに戻った紙は残さない（引き出しが空の紙で埋まらないように） */
  discardIfEmpty: (paperId: string) => void
  /** まだ実行していない1枚だけの紙を消す（間違えて作った紙のため。置いてある紙・やった紙は消さない） */
  deletePaper: (paperId: string) => void
}

export const NOT_DONE_TEXT = '今回は進まなかった。'
/** やった時の⑦。ひとことがあれば、改行して続ける（「できた\n「相談したいことがあります」と送れた」） */
export const DONE_TEXT = 'できた'
export const isDoneText = (t?: string) => t === DONE_TEXT || !!t?.startsWith(`${DONE_TEXT}\n`)
export const SHELVED_NOTE = '今は置いておきます。戻りたくなったら、いつでも'

function emptySheet(): Sheet {
  return {
    id: uid(),
    createdAt: Date.now(),
    dump: [],
    sceneAnswers: [],
    goalNotes: [],
    ideas: [],
    asked: {},
    refills: {},
  }
}

/**
 * 前の紙の上に重ねる新しい紙。1〜4番は引き継ぐ。
 * 6番は前の計画を下書きにする（日時が過ぎていれば明日の朝に。firstDraft があれば最初の2分に入れる）。
 * 選んだ縮小版が、いつ・どこでも変える一歩なら、それも下書きに入れる（本人が⑥で確かめてから決める）
 */
function stackSheet(prev: Sheet, mode: 'same' | 'other', shrink?: ShrinkSuggestion[], firstDraft?: string): Sheet {
  const old = prev.plan
  const picked = firstDraft ? shrink?.find((s) => s.first === firstDraft) : undefined
  const when = picked?.when ?? (old && (parseWhen(old.when) ?? 0) > Date.now() ? old.when : defaultWhen())
  return {
    ...emptySheet(),
    dump: prev.dump,
    problem: prev.problem,
    sceneAnswers: prev.sceneAnswers,
    scene: prev.scene,
    goalNotes: prev.goalNotes,
    goal: prev.goal,
    ideas: prev.ideas,
    choice: mode === 'same' ? prev.choice : undefined,
    planDraft: old ? { ...old, when, where: picked?.where ?? old.where, first: firstDraft ?? old.first } : undefined,
    prevChoice: prev.choice?.idea,
    // もう出した問いは引き継ぐ（重ねた紙で同じ問いがまた出てこないように）
    asked: prev.asked,
    via: mode,
    highlight: mode === 'same' ? [6] : [5, 6],
    shrink,
  }
}

const top = (p: Paper) => p.sheets[p.sheets.length - 1]

/** ふりかえりのデモ用に、最初から入っている過去の紙（今日から数えた日付で作る） */
function pastPapers(now = Date.now()): Paper[] {
  const DAY = 24 * 3600_000
  return D.PAST_PAPERS.map((row) => {
    const created = now - row.daysAgo * DAY
    const e = (text: string) => ({ id: uid(), text })
    const base: Sheet = {
      ...emptySheet(),
      createdAt: created,
      dump: [e(row.problem)],
      problem: row.problem,
      scene: row.scene,
      goalNotes: [e(row.goal)],
      goal: row.goal,
      ideas: [...new Set([...row.steps.map((st) => st.idea), ...row.more])].map(e),
    }
    let prev: Sheet | undefined
    const sheets = row.steps.map((st) => {
      const at = created + (st.daysLater ?? 0) * DAY
      // 計画は、書いた次の日の朝
      const day = new Date(at)
      day.setDate(day.getDate() + 1)
      day.setHours(8, 50, 0, 0)
      const when = toLocalInput(day.getTime())
      const sheet: Sheet = {
        ...base,
        id: uid(),
        createdAt: at,
        choice: { idea: st.idea },
        plan: { when, where: st.where, first: st.first },
        stepMin: st.min,
        reflection: st.result === 'done' ? 'できた' : `${NOT_DONE_TEXT}\n理由：${st.reason}`,
        ...(prev ? { via: 'same' as const, prevChoice: prev.choice?.idea, highlight: [6] as FrameNo[] } : {}),
      }
      prev = sheet
      return sheet
    })
    const last = row.steps[row.steps.length - 1]
    return {
      id: uid(),
      createdAt: created,
      updatedAt: sheets[sheets.length - 1].createdAt + DAY,
      status: last.result === 'done' ? 'done' : 'shelved',
      shelvedNote: last.result === 'done' ? undefined : SHELVED_NOTE,
      notifyStopped: last.result !== 'done' || undefined,
      sample: 'past',
      sheets,
    }
  })
}

export const usePapers = create<PaperState>()(
  persist(
    (set, get) => {
      const mapPaper = (id: string, fn: (p: Paper) => Paper) =>
        set((st) => ({ papers: st.papers.map((p) => (p.id === id ? { ...fn(p), updatedAt: Date.now() } : p)) }))
      const mapTop = (id: string, fn: (s: Sheet) => Partial<Sheet>) =>
        mapPaper(id, (p) => {
          const t = top(p)
          return { ...p, sheets: [...p.sheets.slice(0, -1), { ...t, ...fn(t) }] }
        })

      return {
        papers: pastPapers(),
        settings: DEFAULT_SETTINGS,

        createPaper: () => {
          const now = Date.now()
          const paper: Paper = { id: uid(), createdAt: now, updatedAt: now, status: 'writing', sheets: [emptySheet()] }
          set((st) => ({ papers: [paper, ...st.papers] }))
          return paper.id
        },

        patchTop: (id, patch) => mapTop(id, typeof patch === 'function' ? patch : () => patch),

        patchPaper: (id, patch) => mapPaper(id, (p) => ({ ...p, ...patch })),

        markAsked: (id, frame, q, asked) =>
          mapTop(id, (s) => {
            const cur = s.asked[frame] ?? []
            const next = asked ? (cur.includes(q) ? cur : [...cur, q]) : cur.filter((x) => x !== q)
            return { asked: { ...s.asked, [frame]: next } }
          }),

        completePlan: (id, plan) =>
          mapPaper(id, (p) => {
            const t = top(p)
            return {
              ...p,
              status: 'waiting',
              notifyAt: parseWhen(plan.when) ?? Date.now() + 3 * 3600_000,
              notifyStopped: false,
              lastRungAt: undefined,
              sheets: [...p.sheets.slice(0, -1), { ...t, plan, planDraft: undefined }],
            }
          }),

        markDone: (id, note) =>
          mapPaper(id, (p) => {
            const t = top(p)
            return {
              ...p,
              status: 'done',
              notifyAt: undefined,
              sheets: [...p.sheets.slice(0, -1), { ...t, reflection: note ? `${DONE_TEXT}\n${note}` : DONE_TEXT }],
            }
          }),

        snooze: (id, at) => mapPaper(id, (p) => ({ ...p, notifyAt: at, notifyStopped: false, lastRungAt: undefined })),

        stopAsking: (id) => mapPaper(id, (p) => ({ ...p, notifyStopped: true })),

        resumeAsking: (id) =>
          mapPaper(id, (p) => ({
            ...p,
            notifyStopped: false,
            lastRungAt: undefined,
            notifyAt: p.notifyAt && p.notifyAt > Date.now() ? p.notifyAt : Date.now() + 3 * 3600_000,
          })),

        notDone: (id, reason, next, shrink, firstDraft) =>
          mapPaper(id, (p) => {
            const t = top(p)
            const done: Sheet = { ...t, reflection: reason ? `${NOT_DONE_TEXT}\n理由：${reason}` : NOT_DONE_TEXT }
            if (next === 'shelve') {
              return {
                ...p,
                status: 'shelved',
                notifyAt: undefined,
                notifyStopped: true,
                shelvedNote: SHELVED_NOTE,
                sheets: [...p.sheets.slice(0, -1), done],
              }
            }
            return {
              ...p,
              status: 'writing',
              notifyAt: undefined,
              notifyStopped: false,
              shelvedNote: undefined,
              sheets: [...p.sheets.slice(0, -1), done, stackSheet(done, next, shrink, firstDraft)],
            }
          }),

        retry: (id, mode, shrink, firstDraft) =>
          mapPaper(id, (p) => ({
            ...p,
            status: 'writing',
            shelvedNote: undefined,
            notifyStopped: false,
            sheets: [...p.sheets, stackSheet(top(p), mode, shrink, firstDraft)],
          })),

        setSettings: (patch) => set((st) => ({ settings: { ...st.settings, ...patch } })),

        addExamplePaper: () => {
          // デバッグ用の例の紙は、作るたびに1日ずつ前の日付にする（引き出しで見分けられるように）
          const examples = get().papers.filter((p) => p.sheets[0]?.dump[0]?.text.startsWith('仕事がうまくいかない')).length
          const now = Date.now()
          const created = now - examples * 24 * 3600_000
          const e = (text: string, q?: string) => ({ id: uid(), text, q })
          const sheet: Sheet = {
            ...emptySheet(),
            createdAt: created,
            dump: [e('仕事がうまくいかない。月曜がつらい。会議で話せない。部屋も片付いてない。')],
            problem: '会議で話せない',
            sceneAnswers: [e('月曜9時', '最近だと、いつ？'), e('会議室', 'どこに座ってた？')],
            scene: D.SCENE_EXAMPLE,
            goalNotes: [e(D.GOAL_EXAMPLE)],
            goal: D.GOAL_EXAMPLE,
            ideas: [e('資料に要点を1行書いておく'), e('同僚に先に話しておく'), e('最初の一言を決めておく')],
            choice: { idea: '資料に要点を1行書いておく', tired: '1行ならできそう' },
            plan: { when: toLocalInput(nextMonday(D.HARU_TIME.hour, D.HARU_TIME.minute)), ...D.PLAN_EXAMPLE },
          }
          const paper: Paper = {
            id: uid(),
            createdAt: created,
            updatedAt: now,
            status: 'waiting',
            // 話は「月曜の会議」なので、聞くのは次の月曜の朝（土日に作っても）
            notifyAt: nextMonday(D.HARU_TIME.hour, D.HARU_TIME.minute),
            sheets: [sheet],
          }
          set((st) => ({ papers: [paper, ...st.papers] }))
          return paper.id
        },

        addBossPaper: (replace = false) => {
          const B = D.BOSS
          const kept = get().papers.filter((p) => !(replace && p.sample === 'boss'))
          // ハルさんの例と同じく、作るたびに1日ずつ前の日付にする
          const examples = kept.filter((p) => p.sample === 'boss').length
          const now = Date.now()
          const created = now - examples * 24 * 3600_000
          const at = nextMonday(B.hour, B.minute)
          const e = (text: string, q?: string) => ({ id: uid(), text, q })
          const sheet: Sheet = {
            ...emptySheet(),
            createdAt: created,
            dump: [e(B.problem)],
            problem: B.problem,
            sceneAnswers: B.answers.map((a, i) => e(a, B.questions[i])),
            scene: B.scene,
            goalNotes: [e(B.goal)],
            goal: B.goal,
            ideas: B.ideas.map((i) => e(i)),
            choice: { idea: B.choice },
            plan: { when: toLocalInput(at), ...B.plan },
            // ②の問いは、もう答えたもの
            asked: { 2: [...B.questions] },
          }
          const paper: Paper = {
            id: uid(),
            createdAt: created,
            updatedAt: now,
            status: 'waiting',
            notifyAt: at,
            sample: 'boss',
            sheets: [sheet],
          }
          set({ papers: [paper, ...kept] })
          return paper.id
        },

        addPastPapers: () => set((st) => ({ papers: [...st.papers.filter((p) => p.sample !== 'past'), ...pastPapers()] })),

        clearAll: () => set({ papers: [] }),

        deletePaper: (id) => set((st) => ({ papers: st.papers.filter((p) => p.id !== id || p.sheets.length > 1 || p.status !== 'writing') })),

        discardIfEmpty: (id) =>
          set((st) => ({
            papers: st.papers.filter((p) => {
              if (p.id !== id || p.sheets.length > 1) return true
              const s = p.sheets[0]
              return !!(s.problem || s.dump.length || s.sceneAnswers.length || s.ideas.length)
            }),
          })),
      }
    },
    {
      name: 'mondai-mock-v1',
      // 2：ふりかえりのデモ用の過去の紙を、前から使っている端末にも1回だけ入れる
      version: 2,
      migrate: (persisted, version) => {
        const p = persisted as { papers?: Paper[]; settings: Settings }
        const papers = p?.papers ?? []
        return { ...p, papers: version < 2 ? [...papers, ...pastPapers()] : papers }
      },
      partialize: (s) => ({ papers: s.papers, settings: s.settings }),
      // 後から増えた設定項目に、初期値を入れる
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PaperState>
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } }
      },
    },
  ),
)

export const topSheet = top
export const usePaper = (id?: string) => usePapers((s) => s.papers.find((p) => p.id === id))
