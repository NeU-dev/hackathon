import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { AnimatePresence, motion, useAnimate } from 'motion/react'
import type { Choice, Entry, FrameNo, Plan, ProblemCandidate, Sheet } from '../types'
import { topSheet, usePaper, usePapers } from '../store'
import { useUI, type Rect } from '../ui'
import { hasWebGL, useReduced, useVisualViewport } from '../lib/env'
import { CIRCLED, frameTitle } from '../lib/frames'
import { atMost, defaultWhen, formatWhen, uid } from '../lib/format'
import { juice } from '../lib/juice'
import { useBack, useDialogFocus } from '../lib/screens'
import { isSerious, nextQuestions, splitProblems, summarizeScene } from '../claude'
import { FIXED_CHOICE_QUESTIONS } from '../claude/dummyData'
import { exampleFor, nextDomain } from '../lib/examples'
import { BubbleField } from '../components/bubbles/BubbleField'
import type { BubbleQ } from '../components/bubbles/sim'
import { launchPlane } from '../components/Plane'
import { WriteSheet, type SheetExit, type SheetLayout, type WriteTarget } from '../components/WriteSheet'
import { Icon } from '../components/Icon'
import { HelpLink } from '../components/HelpButton'
import { DUR, EASE } from '../lib/motion'

type ListKey = 'dump' | 'sceneAnswers' | 'goalNotes' | 'ideas'
const LIST_KEY: Partial<Record<FrameNo, ListKey>> = { 1: 'dump', 2: 'sceneAnswers', 3: 'goalNotes', 4: 'ideas' }
const BUBBLE_FRAMES: FrameNo[] = [2, 3, 4, 6]

const insetFor = (r: Rect, box: { top: number; left: number; width: number; height: number }) =>
  `inset(${r.top - box.top}px ${box.left + box.width - (r.left + r.width)}px ${box.top + box.height - (r.top + r.height)}px ${r.left - box.left}px round 12px)`

/** 文字を打っている（キーボードが出ている）か */
const isTyping = () => {
  const el = document.activeElement
  return !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'datetime-local'))
}

const nextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** C. 作業画面：1つの枠をズームして書く */
export function WorkScreen({ paperId, frame, origin }: { paperId: string; frame: FrameNo; origin: Rect }) {
  const paper = usePaper(paperId)
  const S = usePapers.getState()
  const reduced = useReduced()
  const vv = useVisualViewport()
  // 書くのはメモ用紙（画面の上に出る）なので、この画面はキーボードの出入りで大きさを変えない。
  // 変えてしまうと、泡の場所が途中でずれて、浮き上がった泡が画面の外まで行ってしまう
  const [stable, setStable] = useState(() => ({ h: vv.height, top: vv.top }))
  useEffect(() => {
    if (!isTyping()) setStable({ h: vv.height, top: vv.top })
  }, [vv.height, vv.top])
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const innerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // 書くためのメモ用紙
  const [writer, setWriter] = useState<WriteTarget>()
  const [sheetExit, setSheetExit] = useState<SheetExit>('cancel')
  const writeRef = useRef<HTMLTextAreaElement>(null)
  // 泡をタップした瞬間にキーボードを開くための、見えない受け皿。
  // iOS はタップの処理の中でしかキーボードを開かないので、まずここにフォーカスし、
  // 泡がはじけてメモ用紙が出てきたら、フォーカスを用紙の欄へ移す（キーボードは開いたまま）
  const proxyRef = useRef<HTMLTextAreaElement>(null)
  const sheet = paper ? topSheet(paper) : undefined
  const sheetNow = () => topSheet(usePapers.getState().papers.find((p) => p.id === paperId)!)

  const [floating, setFloating] = useState<BubbleQ[]>([])
  const floatingRef = useRef(floating)
  floatingRef.current = floating
  const [bubblesReady, setBubblesReady] = useState(false)
  const [undo, setUndo] = useState<BubbleQ>()
  const [landing, setLanding] = useState<string>()
  const [flash, setFlash] = useState<string>()
  const [closing, setClosing] = useState(false)
  const hintSeen = usePapers((s) => s.settings.flingHintSeen)
  const textScale = usePapers((s) => s.settings.textScale)

  // 枠ごとの状態
  const [cands, setCands] = useState<ProblemCandidate[] | 'loading'>()
  const [scene, setScene] = useState(sheet?.scene ?? '')
  const [goalPick, setGoalPick] = useState<string | undefined>(sheet?.goal)
  const [choice, setChoice] = useState<Choice | undefined>(sheet?.choiceDraft ?? sheet?.choice)
  const [choiceStep, setChoiceStep] = useState(() => {
    const c = sheet?.choiceDraft ?? sheet?.choice
    return !c ? 0 : c.worry !== undefined ? 2 : c.tired !== undefined ? 1 : 0
  })
  const [plan, setPlan] = useState<Plan>(() => sheet?.plan ?? sheet?.planDraft ?? { when: defaultWhen(), where: '', first: '' })

  const mode = reduced || !hasWebGL() ? 'cards' : '3d'
  const hasBubbles = BUBBLE_FRAMES.includes(frame)
  // もう出した問い：泡で出した・飛ばした問いと、答えが書いてある問い（同じ問いをまた出さない）
  const askedFor = (s: Sheet) => {
    const key = LIST_KEY[frame]
    const answered = key ? s[key].map((e) => e.q).filter((q): q is string => !!q) : []
    return [...new Set([...(s.asked[frame] ?? []), ...answered])]
  }
  const entriesCount = () => {
    const key = LIST_KEY[frame]
    return key ? sheetNow()[key].length : 0
  }

  // 最初の泡
  useEffect(() => {
    if (!hasBubbles) return
    let alive = true
    ;(async () => {
      const s = sheetNow()
      const base = { asked: askedFor(s), entries: entriesCount(), refills: s.refills[frame] ?? 0, initial: true }
      const a = await nextQuestions(frame, { ...base, floating: [] })
      const b = await nextQuestions(frame, { ...base, floating: a })
      if (!alive) return
      setFloating([...a, ...b].map((text) => ({ id: uid(), text })))
      setBubblesReady(true)
    })()
    return () => {
      alive = false
    }
  }, [])

  // 泡が減ったら補充（Claude 関数が 0〜2 個を返す）
  useEffect(() => {
    if (!hasBubbles || !bubblesReady || floating.length >= 3) return
    let alive = true
    const t = setTimeout(async () => {
      const s = sheetNow()
      const got = await nextQuestions(frame, {
        asked: askedFor(s),
        floating: floatingRef.current.map((q) => q.text),
        entries: entriesCount(),
        refills: s.refills[frame] ?? 0,
      })
      if (!alive || got.length === 0) return
      S.patchTop(paperId, (x) => ({ refills: { ...x.refills, [frame]: (x.refills[frame] ?? 0) + 1 } }))
      setFloating((f) => [...f, ...got.filter((text) => !f.some((q) => q.text === text)).map((text) => ({ id: uid(), text }))])
    }, 1100)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [floating.length, bubblesReady])

  // 飛ばした泡は4秒だけ戻せる
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(undefined), 4000)
    return () => clearTimeout(t)
  }, [undo])

  // 開いた時は、いちばん新しい行と、その下の「書く」行が見えるところまで送っておく
  useEffect(() => {
    if (frame > 4) return
    const t = requestAnimationFrame(() => {
      const l = listRef.current
      if (l) l.scrollTop = l.scrollHeight
    })
    return () => cancelAnimationFrame(t)
  }, [])

  // 2番：場面の文章を、今ある答えから作る
  useEffect(() => {
    if (frame !== 2 || !sheet || sheet.scene || sheet.sceneAnswers.length === 0) return
    summarizeScene(sheet.sceneAnswers).then(setScene)
  }, [])

  // Esc／戻る で紙へ。開いたらこの画面にフォーカス
  const backRef = useRef<() => void>(() => {})
  useBack(() => backRef.current())
  useDialogFocus(scope as unknown as React.RefObject<HTMLElement | null>)

  if (!paper || !sheet) return null

  /**
   * メモ用紙を開く。iOS でキーボードを開くため、タップの処理の中で画面を出し切ってからフォーカスする。
   * 書く欄には、開くたびにちがう分野の見本を薄く出す
   */
  // ⑥で書く・書き直す時に、用紙の中で見比べる言葉：前回の紙の一歩（場所）と、小さくした案
  const planRefs = (kind: 'where' | 'first') => {
    const prev = paper && paper.sheets.length > 1 ? paper.sheets[paper.sheets.length - 2].plan : undefined
    const refs: { label: string; text: string }[] = []
    if (prev?.[kind]) refs.push({ label: kind === 'first' ? '前回の一歩' : '前回の場所', text: prev[kind] })
    if (kind === 'first') for (const s of sheet.shrink ?? []) refs.push({ label: '小さくした案', text: s.first })
    return refs.filter((r, i) => r.text.trim() && refs.findIndex((x) => x.text === r.text) === i)
  }

  const openWriter = (t: WriteTarget) => {
    const field = t.kind === 'where' || t.kind === 'first' ? t.kind : undefined
    const rewrite = t.kind === 'edit' || t.kind === 'problem' || t.kind === 'goal' || t.kind === 'scene'
    const example = rewrite ? undefined : (t.example ?? exampleFor({ question: t.heading, field, frame }))
    flushSync(() => {
      setSheetExit('cancel')
      setWriter({ ...t, example })
    })
    writeRef.current?.focus({ preventScroll: true })
  }

  // 泡がはじけたら（膜が破れてから）、その問いだけを書いたメモ用紙が、はじけた所から出てくる
  const onPop = (q: BubbleQ, at?: { x: number; y: number }) => {
    setFloating((f) => f.filter((x) => x.id !== q.id))
    S.markAsked(paperId, frame, q.text, true)
    const open = () => {
      // 浮き上がっている間に打った文字も、用紙に引き継ぐ
      const typed = proxyRef.current?.value ?? ''
      if (proxyRef.current) proxyRef.current.value = ''
      if (frame === 6) openWriter({ kind: 'first', heading: q.text, initial: typed || plan.first, origin: at, refs: planRefs('first') })
      else openWriter({ kind: 'list', heading: q.text, initial: typed, origin: at })
    }
    // 3D の泡：はじけた光と輪が広がるのを少し見せてから、用紙を出す。
    // カード表示（動きを減らす）：タップの処理の中ですぐ開く（キーボードを開くため）
    if (at && !reduced) setTimeout(open, 150)
    else open()
  }

  const onFling = (q: BubbleQ) => {
    if (!hintSeen) S.setSettings({ flingHintSeen: true })
    setFloating((f) => f.filter((x) => x.id !== q.id))
    S.markAsked(paperId, frame, q.text, true)
    setUndo(q)
  }

  const doUndo = () => {
    if (!undo) return
    S.markAsked(paperId, frame, undo.text, false)
    setFloating((f) => [...f, { id: uid(), text: undo.text }])
    setUndo(undefined)
  }

  const openSerious = () => {
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    useUI.getState().setUI({ work: undefined, help: { serious: true } })
  }

  /** 紙飛行機を飛ばして、行に着地させる（着地するまで行は見せない） */
  const flyTo = async (rowId: string, from: DOMRect, layout: SheetLayout, text: string, toBottom: boolean) => {
    setLanding(rowId)
    await nextPaint()
    const list = listRef.current
    const row = () => document.querySelector(`[data-entry="${rowId}"]`)
    if (list && toBottom) list.scrollTop = list.scrollHeight
    else row()?.scrollIntoView({ block: 'nearest' })
    await launchPlane(from, text, layout, () => row()?.getBoundingClientRect() ?? null)
    setLanding(undefined)
    setFlash(rowId)
    setTimeout(() => setFlash((f) => (f === rowId ? undefined : f)), 700)
  }

  /** メモ用紙の「追加」。深刻判定なら紙に書かずに相談先へ */
  const submitWriting = async (text: string, from: DOMRect, layout: SheetLayout) => {
    const w = writer
    if (!w) return
    if ((frame === 1 || frame === 2) && (await isSerious(text))) {
      setWriter(undefined)
      openSerious()
      return
    }
    ;(document.activeElement as HTMLElement | null)?.blur?.()

    // 書き直し：紙飛行機にはせず、その場で書き換わる
    if (w.kind === 'problem') {
      setSheetExit('cancel')
      setWriter(undefined)
      S.patchTop(paperId, { problem: text })
      return close(true)
    }
    if (w.kind === 'goal') {
      setSheetExit('cancel')
      setWriter(undefined)
      S.patchTop(paperId, { goal: text })
      if (frame === 3) setGoalPick(text)
      return
    }
    if (w.kind === 'scene') {
      setSheetExit('cancel')
      setWriter(undefined)
      setScene(text)
      if (sheetNow().scene) S.patchTop(paperId, { scene: text })
      return
    }
    if (w.kind === 'edit' && w.entryKey && w.entryId) {
      setSheetExit('cancel')
      setWriter(undefined)
      rewriteEntry(w.entryKey, w.entryId, text)
      return
    }

    // キーボードを閉じてから、メモを紙飛行機にする（用紙はその場で消え、暗い幕はゆっくり明るくなる）
    setSheetExit('send')
    setWriter(undefined)

    if (w.kind === 'tired' || w.kind === 'worry') {
      if (!choice) return
      const next = { ...choice, [w.kind]: text }
      setChoice(next)
      setChoiceStep((n) => Math.max(n, w.kind === 'tired' ? 1 : 2))
      S.patchTop(paperId, { choiceDraft: next })
      await flyTo(`choice-${w.kind}`, from, layout, text, false)
      return
    }
    if (w.kind === 'where' || w.kind === 'first') {
      const next = { ...plan, [w.kind]: text }
      setPlan(next)
      S.patchTop(paperId, { planDraft: next })
      await flyTo(`plan-${w.kind}`, from, layout, text, false)
      return
    }
    const key = LIST_KEY[frame]
    if (!key) return
    const entry: Entry = { id: uid(), text, q: w.heading }
    S.patchTop(paperId, (s) => ({ [key]: [...s[key], entry] }))
    if (frame === 3) setGoalPick(text)
    await flyTo(entry.id, from, layout, text, true)
    // 場面の文章は、いまの文章に新しい答えを足して育てる（作り直して崩れないように）
    if (frame === 2) setScene(await summarizeScene(sheetNow().sceneAnswers, scene))
  }

  /** 書いた行を直す。目標・選んだ案・場面の文章も、その行から作っていればいっしょに直す */
  const rewriteEntry = async (key: ListKey, id: string, text: string) => {
    const old = sheetNow()[key].find((e) => e.id === id)?.text
    S.patchTop(paperId, (x) => {
      const patch: Partial<Sheet> = { [key]: x[key].map((e) => (e.id === id ? { ...e, text } : e)) }
      if (key === 'goalNotes' && x.goal === old) patch.goal = text
      if (key === 'ideas') {
        if (x.choice?.idea === old) patch.choice = { ...x.choice, idea: text }
        if (x.choiceDraft?.idea === old) patch.choiceDraft = { ...x.choiceDraft, idea: text }
      }
      return patch
    })
    if (key === 'goalNotes' && goalPick === old) setGoalPick(text)
    if (key === 'ideas' && choice?.idea === old) setChoice({ ...choice, idea: text })
    if (key === 'sceneAnswers') await rebuildScene()
  }

  const removeEntry = async (key: ListKey, id: string) => {
    const old = sheetNow()[key].find((e) => e.id === id)?.text
    setSheetExit('cancel')
    setWriter(undefined)
    S.patchTop(paperId, (x) => {
      const patch: Partial<Sheet> = { [key]: x[key].filter((e) => e.id !== id) }
      if (key === 'goalNotes' && x.goal === old) patch.goal = undefined
      if (key === 'ideas') {
        if (x.choice?.idea === old) patch.choice = undefined
        if (x.choiceDraft?.idea === old) patch.choiceDraft = undefined
      }
      return patch
    })
    if (key === 'goalNotes' && goalPick === old) setGoalPick(undefined)
    if (key === 'ideas' && choice?.idea === old) setChoice(undefined)
    if (key === 'sceneAnswers') await rebuildScene()
  }

  // 答えを直したり消したりしたら、場面の文章を答えから作り直す
  const rebuildScene = async () => {
    const answers = sheetNow().sceneAnswers
    const sc = answers.length ? await summarizeScene(answers) : ''
    setScene(sc)
    if (sheetNow().scene !== undefined) S.patchTop(paperId, { scene: sc || undefined })
  }

  const editEntry = (key: ListKey, e: Entry) => openWriter({ kind: 'edit', heading: e.q, initial: e.text, entryKey: key, entryId: e.id })

  /** ⑤から④へ戻って案を足す：この画面を閉じてから、紙の④をすぐ開く */
  const goToFrame = (n: FrameNo) => {
    useUI.getState().setUI({ openFrame: { paperId, frame: n, soon: true } })
    close(false)
  }

  const close = async (filled: boolean) => {
    if (closing) return
    setClosing(true)
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    const ui = useUI.getState()
    if (filled) ui.setUI({ typing: { sheetId: sheet.id, frame, phase: 'hold' } })
    // カメラが紙へ引いていく。紙が元の大きさに戻るので、閉じる先は開いた時の枠の位置
    ui.setUI({ zoomBack: true })
    if (!reduced && scope.current && innerRef.current) {
      const r = origin
      const box = scope.current.getBoundingClientRect()
      await atMost(
        Promise.all([
          // 閉じる時は、開く時より速く（開くのは 250ms、閉じるのは 200ms）
          animate(scope.current, { clipPath: insetFor(r, box) }, { duration: 0.2, ease: EASE }),
          animate(innerRef.current, { opacity: 0, scale: 0.97, filter: 'blur(2px)' }, { duration: DUR.quick, ease: EASE }),
        ]),
        500,
      )
    }
    useUI.getState().setUI({ work: undefined, zoomBack: false, ...(filled ? { typing: { sheetId: sheet.id, frame, phase: 'run' as const } } : {}) })
    // 紙に戻って文字が入る瞬間に、手ごたえを返す
    if (filled) juice.frameFilled()
  }

  const back = () => {
    if (frame === 6) S.patchTop(paperId, { planDraft: plan })
    close(false)
  }
  backRef.current = back

  // 「書けた」
  const finish = async () => {
    switch (frame) {
      case 1: {
        const all = sheetNow().dump.map((e) => e.text).join('\n')
        if (!all.trim()) return
        setCands('loading')
        setCands(await splitProblems(all))
        return
      }
      case 2: {
        const sc = scene || (await summarizeScene(sheetNow().sceneAnswers))
        S.patchTop(paperId, { scene: sc })
        return close(true)
      }
      case 3:
        if (!goalPick) return
        S.patchTop(paperId, { goal: goalPick })
        return close(true)
      case 4:
        return close(true)
      case 5:
        if (!choice) return
        S.patchTop(paperId, { choice, choiceDraft: undefined })
        return close(true)
      case 6:
        S.completePlan(paperId, plan)
        return close(true)
    }
  }

  const canFinish = (() => {
    switch (frame) {
      case 1:
        return sheet.dump.length > 0
      case 2:
        return sheet.sceneAnswers.length > 0
      case 3:
        return !!goalPick
      case 4:
        return sheet.ideas.length > 0
      case 5:
        return !!choice
      case 6:
        return !!plan.when && !!plan.where.trim() && !!plan.first.trim()
      default:
        return false
    }
  })()

  const fieldH = stable.h > 720 ? 200 : stable.h > 560 ? 150 : 112
  // 狭い画面や大きい文字では、上の欄を1行ずつにたたむ（書く欄が泡の後ろに隠れないように）
  const compact = stable.h / textScale < 620
  // 書くための罫線を出す枠（1〜4番。1番は候補を選んでいる間は出さない）。書く入口はこの1つだけ
  const showPad = frame === 1 ? !cands : frame <= 4
  const listKey = LIST_KEY[frame]
  const written = listKey ? sheet[listKey].length > 0 : false
  const padLabel = frame === 1 ? (written ? '続けて書く' : '頭の中にあることを、そのまま書く') : written ? '書き足す' : 'ここに書く'
  const box0 = { top: stable.top, left: 0, width: window.innerWidth, height: stable.h }

  return (
    <motion.div
      ref={scope}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={frameTitle(frame)}
      className="paper-surface fixed inset-x-0 z-40 outline-none"
      style={{ top: stable.top, height: stable.h }}
      // 押した枠から広がる（枠の位置を覚えていて、そこから開き、そこへ閉じる）
      initial={reduced ? false : { clipPath: insetFor(origin, box0) }}
      animate={{ clipPath: 'inset(0px 0px 0px 0px round 0px)' }}
      transition={{ duration: DUR.fast, ease: EASE }}
    >
      <motion.div
        ref={innerRef}
        className="flex h-full flex-col"
        initial={reduced ? false : { opacity: 0, scale: 0.97, filter: 'blur(2px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
        transition={{ duration: DUR.fast, delay: 0.03, ease: EASE }}
      >
        {/* 上部 */}
        <header className="pt-safe flex items-center gap-1 px-2">
          <button type="button" onClick={back} className="flex h-11 min-w-11 items-center gap-1 rounded-full px-3 text-[0.875rem] text-ink active:bg-black/5">
            <Icon name="back" /> 紙へ
          </button>
          {/* 用紙の枠の見出しを、そのまま大きくしたもの */}
          <h1 className="min-w-0 flex-1 truncate text-[1rem] font-medium text-print">
            <span aria-hidden className="mr-1.5">
              {CIRCLED[frame - 1]}
            </span>
            {frameTitle(frame)}
          </h1>
          <HelpLink />
        </header>
        <ContextBar frame={frame} sheet={sheet} compact={compact} onEditGoal={() => openWriter({ kind: 'goal', heading: '今回の目標', initial: sheet.goal })} />

        {/* 中部：これまでの入力（ここだけスクロール） */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4">
          <div className="flex min-h-full flex-col">
          {frame === 1 && (
            <Frame1Middle
              sheet={sheet}
              cands={cands}
              landing={landing}
              flash={flash}
              onPick={(c) => (S.patchTop(paperId, { problem: c.text }), close(true))}
              onOwn={() => openWriter({ kind: 'problem', heading: 'いま困っていること', initial: sheet.problem })}
              onEdit={(e) => editEntry('dump', e)}
            />
          )}
          {frame === 2 && (
            <Frame2Middle
              sheet={sheet}
              scene={scene}
              landing={landing}
              flash={flash}
              onEditScene={() => openWriter({ kind: 'scene', heading: 'どんな場面か', initial: scene })}
              onEdit={(e) => editEntry('sceneAnswers', e)}
            />
          )}
          {frame === 3 && <Frame3Middle sheet={sheet} pick={goalPick} onPick={setGoalPick} landing={landing} flash={flash} onEdit={(e) => editEntry('goalNotes', e)} />}
          {frame === 4 && <EntryList entries={sheet.ideas} landing={landing} flash={flash} count onEdit={(e) => editEntry('ideas', e)} />}
          {frame === 5 && (
            <Frame5Middle
              sheet={sheet}
              choice={choice}
              step={choiceStep}
              landing={landing}
              flash={flash}
              onPick={(idea) => {
                const c = { idea }
                setChoice(c)
                setChoiceStep(0)
                S.patchTop(paperId, { choiceDraft: c })
              }}
              onAnswer={() => openWriter({ kind: choiceStep === 0 ? 'tired' : 'worry', heading: FIXED_CHOICE_QUESTIONS[choiceStep] })}
              onAddIdea={() => goToFrame(4)}
              onSkip={() => {
                if (!choice) return
                const key = choiceStep === 0 ? 'tired' : 'worry'
                const next = { ...choice, [key]: choice[key] ?? '' }
                setChoice(next)
                setChoiceStep((n) => n + 1)
                S.patchTop(paperId, { choiceDraft: next })
              }}
            />
          )}
          {frame === 6 && (
            <Frame6Middle
              sheet={sheet}
              plan={plan}
              landing={landing}
              flash={flash}
              onChange={(p) => setPlan(p)}
              onWrite={(kind, label, value, example) => openWriter({ kind, heading: label, initial: value, example, refs: planRefs(kind) })}
            />
          )}
          {/* 書いたもののすぐ下が、次に書く行。押すと、メモ用紙が出てくる */}
          {showPad && <WritePad label={padLabel} onWrite={() => openWriter({ kind: 'list' })} />}
          </div>
        </div>

        {/* 下部：泡のフィールド + 「書く」の紙片 + 書けた */}
        <div className="pb-safe relative">
          {hasBubbles && (
            <div className="relative">
              <BubbleField
                questions={floating}
                mode={mode}
                height={fieldH}
                onPop={onPop}
                onFling={onFling}
                onTapStart={() => proxyRef.current?.focus({ preventScroll: true })}
                // メモ用紙が出てくるあたりではじける（はじけた所から用紙が広がる）
                popAtY={stable.top + Math.min(170, stable.h * 0.24)}
                paused={!!writer}
              />
              {hasBubbles && mode === '3d' && !hintSeen && floating.length > 0 && (
                <FlingHint onDone={() => S.setSettings({ flingHintSeen: true })} />
              )}
              {undo && (
                <div className="absolute inset-x-0 bottom-1 flex justify-center">
                  <div role="status" className="flex items-center gap-1 rounded-full bg-ink/85 py-0.5 pr-1 pl-4 text-[0.8125rem] text-white shadow">
                    問いを飛ばしました
                    <button type="button" onClick={doUndo} className="h-11 rounded-full px-3 font-medium text-accent-soft">
                      元に戻す
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="px-3 pt-2">
            {frame === 1 && cands && cands !== 'loading' ? (
              <button type="button" onClick={() => setCands(undefined)} className="tactile h-12 w-full rounded-xl text-[0.9375rem] text-ink">
                書き足す
              </button>
            ) : (
              <button
                type="button"
                disabled={!canFinish || cands === 'loading' || closing}
                onClick={finish}
                className="tactile h-13 w-full rounded-xl text-[1rem] font-medium disabled:text-ink-mute"
              >
                {frame === 2 ? '目標を思いついた' : '書けた'}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* キーボードを先に開くための、見えない受け皿（メモ用紙の出てくるあたりに置く） */}
      <textarea
        ref={proxyRef}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none fixed left-0 h-px w-px opacity-0"
        style={{ top: 'calc(var(--vvt) + 160px)', fontSize: 16 }}
        onBlur={(e) => {
          e.currentTarget.value = ''
        }}
      />
      <AnimatePresence custom={sheetExit}>
      {writer && (
        <WriteSheet
          key="writer"
          target={writer}
          frameLabel={`${CIRCLED[frame - 1]} ${frameTitle(frame)}`}
          placeholder={placeholderFor(frame, writer.example)}
          multiline={frame === 1}
          textareaRef={writeRef}
          onSubmit={submitWriting}
          onCancel={() => {
            setSheetExit('cancel')
            setWriter(undefined)
          }}
          onDelete={writer.kind === 'edit' && writer.entryKey && writer.entryId ? () => removeEntry(writer.entryKey!, writer.entryId!) : undefined}
        />
      )}
      </AnimatePresence>
    </motion.div>
  )
}

/** 上部：この枠で必要な情報。狭い時（compact）は1行ずつにたたみ、押すと全文が出る */
function ContextBar({ frame, sheet, compact, onEditGoal }: { frame: FrameNo; sheet: Sheet; compact: boolean; onEditGoal: () => void }) {
  if (frame === 1) return null
  return (
    <div className={`mx-4 mt-1 flex flex-col border border-print-line bg-paper-bright/50 px-3 text-[0.8125rem] ${compact ? 'py-0.5' : 'gap-1.5 py-2'}`}>
      <Info label="いま困っていること" short="困りごと" text={sheet.problem} compact={compact} />
      {frame === 3 && <Info label="どんな場面か" short="場面" text={sheet.scene} compact={compact} />}
      {frame >= 4 && <GoalEditor goal={sheet.goal} compact={compact} onEdit={onEditGoal} />}
      {/* 6番は、選んだ案の計画を立てる画面なので、その案を見せておく */}
      {frame === 6 && <Info label="やってみること" short="やること" text={sheet.choice?.idea} compact={compact} />}
    </div>
  )
}

function Info({ label, short, text, compact }: { label: string; short: string; text?: string; compact: boolean }) {
  const [open, setOpen] = useState(false)
  if (!compact) {
    return (
      <p className="leading-snug">
        <span className="mr-2 text-[0.75rem] text-ink-soft">{label}</span>
        <span className="pen text-[0.9375rem]">{text || '—'}</span>
      </p>
    )
  }
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${label}：${text ?? ''}`}
      onClick={() => setOpen((o) => !o)}
      className="-mx-1 flex min-h-10 items-center gap-2 rounded-lg px-1 text-left active:bg-white/70"
    >
      <span className="w-[4.5em] shrink-0 text-[0.75rem] text-ink-soft">{short}</span>
      <span className={`pen min-w-0 flex-1 text-[0.9375rem] leading-snug ${open ? '' : 'truncate'}`}>{text || '—'}</span>
    </button>
  )
}

/** 目標はその場で直せる（ほかと同じメモ用紙で）。直しても4番の案は消えない */
function GoalEditor({ goal, compact, onEdit }: { goal?: string; compact: boolean; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className={`-mx-1 flex items-center gap-2 rounded-lg px-1 text-left active:bg-white/70 ${compact ? 'min-h-10' : 'min-h-11'}`}
      aria-label={`今回の目標：${goal ?? ''}（タップで直す）`}
    >
      <span className={`shrink-0 text-[0.75rem] text-ink-soft ${compact ? 'w-[4.5em]' : ''}`}>{compact ? '目標' : '今回の目標'}</span>
      <span className={`pen min-w-0 flex-1 text-[0.9375rem] leading-snug ${compact ? 'truncate' : ''}`}>{goal || '—'}</span>
      <span className="flex shrink-0 items-center gap-0.5 text-[0.75rem] text-accent">
        <Icon name="pencil" size={14} />
        直す
      </span>
    </button>
  )
}

/** 書いたものの下に続く、罫線の余白。押すとメモ用紙が出てくる */
/** 書いたもののすぐ下に続く、罫線の余白。1行目に「ここに書く」。押すとメモ用紙が出てくる */
/** 書く欄の薄い字：見本（別の誰かの例）。1番と5番は、ひとこと添える */
function placeholderFor(frame: FrameNo, example?: string) {
  const ex = example ? `例：${example}` : '自分の言葉で'
  if (frame === 1) return `${ex}\n（整理せず、思いつく順で。改行できます。書けたら右上の「追加」）`
  if (frame === 5) return `${ex}\n（書かなくても大丈夫）`
  return ex
}

function WritePad({ label, onWrite }: { label: string; onWrite: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onWrite}
      className="field mt-1 flex min-h-[7.5rem] w-full flex-1 items-start rounded-sm px-2 text-left text-[1rem] text-print active:bg-paper-bright/70"
    >
      <span className="flex items-start gap-2">
        <Icon name="pencil" size={17} className="mt-[0.4rem]" />
        <span className="font-pen">{label}</span>
      </span>
    </button>
  )
}

function rowCls(id: string, landing?: string, flash?: string) {
  // 紙飛行機が着地するまでは見せず、着地したらインクがしみこむように出す
  return ['rounded-lg px-2 py-2', landing === id ? 'opacity-0' : '', flash === id ? 'ink-in' : ''].join(' ')
}

function EntryList({ entries, landing, flash, count, onEdit }: { entries: Entry[]; landing?: string; flash?: string; count?: boolean; onEdit?: (e: Entry) => void }) {
  // 開いた時は弾ませず、増えた時だけ弾ませる
  const opened = useRef(false)
  useEffect(() => {
    opened.current = true
  }, [])
  return (
    <>
      {count && entries.length > 0 && (
        <p className="mb-1 text-[0.75rem] text-ink-soft">
          {/* 数が増えた時だけ、ぽんと弾む（数字ポップ） */}
          <motion.span
            key={entries.length}
            className="inline-block tabular-nums"
            initial={opened.current ? { scale: 1.6, color: 'var(--color-accent)' } : false}
            animate={{ scale: 1, color: 'var(--color-ink-soft)' }}
            transition={{ type: 'spring', stiffness: 520, damping: 14 }}
          >
            {entries.length}
          </motion.span>
          個
        </p>
      )}
      <ul className="flex flex-col">
        {entries.map((e) => (
          <li key={e.id} data-entry={e.id} className={rowCls(e.id, landing, flash) + ' border-b border-rule'}>
            <EntryRow entry={e} onEdit={onEdit} />
          </li>
        ))}
      </ul>
    </>
  )
}

/** 書いた1行。押すとメモ用紙が開いて、直す・消すができる */
function EntryRow({ entry: e, onEdit }: { entry: Entry; onEdit?: (e: Entry) => void }) {
  const body = (
    <>
      {e.q && <span className="block text-[0.75rem] text-ink-faint">{e.q}</span>}
      <span className="pen text-[1rem] leading-relaxed whitespace-pre-wrap">{e.text}</span>
    </>
  )
  if (!onEdit) return body
  return (
    <button type="button" onClick={() => onEdit(e)} aria-label={`直す：${e.text}`} className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-2 rounded-lg px-2 text-left active:bg-paper-bright/70">
      <span className="min-w-0 flex-1">{body}</span>
      <Icon name="pencil" size={14} className="mt-2 shrink-0 text-ink-mute" />
    </button>
  )
}

function Frame1Middle({
  sheet,
  cands,
  landing,
  flash,
  onPick,
  onOwn,
  onEdit,
}: {
  sheet: Sheet
  cands?: ProblemCandidate[] | 'loading'
  landing?: string
  flash?: string
  onPick: (c: ProblemCandidate) => void
  onOwn: () => void
  onEdit: (e: Entry) => void
}) {
  if (cands === 'loading')
    return (
      <p role="status" className="breathe mt-6 text-center text-[0.875rem] text-ink-soft">
        書いたことを整理しています
      </p>
    )
  if (cands) {
    return (
      <div className="mt-2">
        {/* 書いたことから切り出した候補が、1つずつ紙に置かれていく */}
        <motion.p className="mb-3 text-[0.9375rem]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          どれから考える？
        </motion.p>
        <ul className="flex flex-col gap-2">
          {cands.map((c, i) => {
            const current = sheet.problem === c.text
            return (
              <motion.li
                key={c.text}
                initial={{ opacity: 0, y: 14, rotate: -1 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.35, delay: 0.08 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              >
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  aria-label={`${c.text}（${c.changeable ? '自分で変えられる' : '今は変えられない'}${current ? '・いま選んでいる' : ''}）`}
                  className={`flex w-full items-center gap-3 rounded-xl border bg-white/70 px-3.5 py-3 text-left active:bg-white ${current ? 'border-pen' : 'border-frame'}`}
                >
                  <span className="flex-1 text-[1rem]">
                    {c.text}
                    {current && <span className="ml-2 text-[0.75rem] text-accent">いま選んでいる</span>}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.75rem] ${c.changeable ? 'bg-accent-soft text-accent' : 'bg-black/5 text-ink-soft'}`}>
                    {c.changeable ? '自分で変えられる' : '今は変えられない'}
                  </span>
                </button>
              </motion.li>
            )
          })}
          {/* 候補にない時は、自分の言葉で */}
          <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.08 + cands.length * 0.07 }}>
            <button type="button" onClick={onOwn} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3.5 py-2 text-left text-[0.9375rem] text-accent active:bg-white/60">
              <Icon name="pencil" size={16} />
              どれでもない。自分の言葉で書く
            </button>
          </motion.li>
        </ul>
        {sheet.problem && sheet.scene && <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-soft">選び直しても、②からの中身はそのまま残ります。</p>}
      </div>
    )
  }
  if (sheet.dump.length === 0) return null
  return (
    <>
      {/* 開き直した時に、いま選んでいる問題が分かるように */}
      {sheet.problem && (
        <p className="mb-2 flex items-baseline gap-2 border-b border-print-line pb-2 text-[0.8125rem]">
          <span className="shrink-0 text-ink-soft">いま選んでいる</span>
          <span className="pen text-[0.9375rem]">{sheet.problem}</span>
          <span className="ml-auto shrink-0 text-[0.75rem] text-ink-faint">「書けた」で選び直せます</span>
        </p>
      )}
      <EntryList entries={sheet.dump} landing={landing} flash={flash} onEdit={onEdit} />
    </>
  )
}

function Frame2Middle({
  sheet,
  scene,
  landing,
  flash,
  onEditScene,
  onEdit,
}: {
  sheet: Sheet
  scene: string
  landing?: string
  flash?: string
  onEditScene: () => void
  onEdit: (e: Entry) => void
}) {
  // 答えが1つのうちは、文章は答えそのもの（下の行と同じ）なので、文章の箱には次の案内を出す
  const n = sheet.sceneAnswers.length
  const ready = !!scene && n >= 2
  return (
    <>
      {/* 育っていく場面の文章は、答えが増えてスクロールしても上に貼りついて見えたまま */}
      <div className="paper-surface sticky -top-2 z-10 -mx-4 px-4 pt-2 pb-3">
        <p className="mb-2 flex items-baseline text-[0.75rem] text-ink-faint">
          他の人が読んで、同じ場面が浮かぶか
          {ready && <span className="ml-auto text-ink-soft">押すと直せます</span>}
        </p>
        <motion.div
          key={ready ? scene : n}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          aria-live="polite"
        >
          {ready ? (
            <button
              type="button"
              onClick={onEditScene}
              aria-label={`どんな場面か：${scene}（押すと直せます）`}
              className="max-h-[7.5rem] min-h-[3.5rem] w-full overflow-y-auto border border-print-line bg-paper-bright/50 px-3 py-2.5 text-left text-[0.9375rem] leading-relaxed active:bg-paper-bright"
            >
              <span className="pen text-[1rem]">{scene}</span>
            </button>
          ) : (
            <p className="min-h-[3.5rem] border border-print-line bg-paper-bright/50 px-3 py-2.5 text-[0.9375rem] leading-relaxed text-ink-faint">
              {n === 0 ? '答えると、ここに場面が書かれていきます' : 'もう1つ答えると、ここで場面が一文になります'}
            </p>
          )}
        </motion.div>
      </div>
      <EntryList entries={sheet.sceneAnswers} landing={landing} flash={flash} onEdit={onEdit} />
    </>
  )
}

function Frame3Middle({
  sheet,
  pick,
  onPick,
  landing,
  flash,
  onEdit,
}: {
  sheet: Sheet
  pick?: string
  onPick: (t: string) => void
  landing?: string
  flash?: string
  onEdit: (e: Entry) => void
}) {
  if (sheet.goalNotes.length === 0) return <p className="mt-6 text-center text-[0.875rem] text-ink-faint">1行で書いてみる</p>
  return (
    <>
      <p className="mb-1 text-[0.75rem] text-ink-soft">目標にする行を選べます</p>
      <ul className="flex flex-col gap-1">
        {sheet.goalNotes.map((e) => {
          const on = pick === e.text
          return (
            <li key={e.id} data-entry={e.id} className={rowCls(e.id, landing, flash) + ' flex items-center gap-1'}>
              <button type="button" aria-pressed={on} onClick={() => onPick(e.text)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left">
                <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${on ? 'border-accent bg-accent text-white' : 'border-frame'}`}>
                  {on && <Icon name="check" size={13} />}
                </span>
                <span className="flex-1">
                  {e.q && <span className="block text-[0.75rem] text-ink-faint">{e.q}</span>}
                  <span className="pen text-[1rem]">{e.text}</span>
                </span>
                {on && <span className="shrink-0 text-[0.75rem] text-accent">目標</span>}
              </button>
              <button type="button" onClick={() => onEdit(e)} aria-label={`直す：${e.text}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-mute active:bg-black/5">
                <Icon name="pencil" size={14} />
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function Frame5Middle({
  sheet,
  choice,
  step,
  landing,
  flash,
  onPick,
  onAnswer,
  onSkip,
  onAddIdea,
}: {
  sheet: Sheet
  choice?: Choice
  step: number
  landing?: string
  flash?: string
  onPick: (idea: string) => void
  onAnswer: () => void
  onSkip: () => void
  onAddIdea: () => void
}) {
  const addLink = (
    <button type="button" onClick={onAddIdea} className="mt-3 flex min-h-11 items-center gap-1.5 self-start rounded-full px-2 text-[0.875rem] text-accent active:bg-accent-soft">
      <Icon name="back" size={15} />
      ④に戻って、案を足す
    </button>
  )
  if (sheet.ideas.length === 0)
    return (
      <div className="mt-6 flex flex-col items-center">
        <p className="text-center text-[0.875rem] text-ink-faint">先に「できそうなこと」を書くと、ここに並びます</p>
        {addLink}
      </div>
    )
  return (
    <>
      <p className="mb-2 text-[0.75rem] text-ink-soft">1つ選ぶ</p>
      <ul className="flex flex-col gap-2">
        {sheet.ideas.map((e) => {
          const on = choice?.idea === e.text
          return (
            <li key={e.id}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={e.text}
                onClick={() => !on && onPick(e.text)}
                className={`flex min-h-12 w-full items-center gap-2 border px-3 py-2.5 text-left transition-colors duration-150 ${on ? 'border-pen bg-paper-bright' : 'border-print-line bg-paper-bright/40 active:bg-paper-bright'}`}
              >
                <span className="pen flex-1 text-[1rem]">{e.text}</span>
                {on ? (
                  <span className="shrink-0 text-[0.75rem] text-accent">{sheet.prevChoice === e.text ? '選んだ（前回と同じ）' : '選んだ'}</span>
                ) : (
                  sheet.prevChoice === e.text && <span className="shrink-0 text-[0.75rem] text-ink-faint">前回</span>
                )}
              </button>
              {on && (
                <div className="mt-1 ml-3 flex flex-col border-l-2 border-accent-soft pl-3">
                  {choice.tired !== undefined && (
                    <p data-entry="choice-tired" className={rowCls('choice-tired', landing, flash) + ' text-[0.875rem]'}>
                      <span className="block text-[0.75rem] text-ink-faint">{FIXED_CHOICE_QUESTIONS[0]}</span>
                      {choice.tired ? <span className="pen">{choice.tired}</span> : <span className="text-ink-faint">（とばした）</span>}
                    </p>
                  )}
                  {choice.worry !== undefined && (
                    <p data-entry="choice-worry" className={rowCls('choice-worry', landing, flash) + ' text-[0.875rem]'}>
                      <span className="block text-[0.75rem] text-ink-faint">{FIXED_CHOICE_QUESTIONS[1]}</span>
                      {choice.worry ? <span className="pen">{choice.worry}</span> : <span className="text-ink-faint">（とばした）</span>}
                    </p>
                  )}
                  {/* 選んだ案のすぐ下に、問いが順に出る（答えは書かなくてもいい） */}
                  {step < 2 && (
                    <div className="py-2">
                      <p className="text-[0.9375rem] leading-snug font-medium text-accent">{FIXED_CHOICE_QUESTIONS[step]}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <button type="button" onClick={onAnswer} className="tactile flex h-11 items-center gap-1.5 rounded-xl px-3.5 text-[0.9375rem]">
                          <Icon name="pencil" size={16} className="text-print" />
                          答える
                        </button>
                        <button type="button" onClick={onSkip} className="h-11 rounded-full px-3 text-[0.8125rem] text-ink-soft active:bg-black/5">
                          とばす
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {addLink}
    </>
  )
}

function Frame6Middle({
  sheet,
  plan,
  landing,
  flash,
  onChange,
  onWrite,
}: {
  sheet: Sheet
  plan: Plan
  landing?: string
  flash?: string
  onChange: (p: Plan) => void
  onWrite: (kind: 'where' | 'first', label: string, value: string, example?: string) => void
}) {
  // 空の欄の見本は、2つの欄で分野をそろえる（開くたびに分野は変わる）
  const [domain] = useState(nextDomain)
  // 「どこで」「最初の2分」は、押すとメモ用紙が出てきて、書いたものが紙飛行機でこの欄に入る
  const lines = (['where', 'first'] as const).map((kind) => ({
    kind,
    label: kind === 'where' ? 'どこで' : '最初の2分で何をするか',
    example: exampleFor({ field: kind, frame: 6 }, domain),
  }))
  return (
    <div className="flex flex-col gap-3">
      {sheet.shrink && sheet.shrink.length > 0 && (
        <div className="border border-dashed border-print-frame bg-paper-bright/50 px-3 py-2.5">
          <p className="mb-1.5 text-[0.75rem] text-ink-soft">前より小さくするなら</p>
          <ul className="flex flex-col gap-1.5">
            {sheet.shrink.map((s) => {
              const on = plan.first === s.first
              return (
                <li key={s.title + s.first} className="flex items-center gap-2">
                  <p className="flex-1 text-[0.875rem] leading-snug">
                    <span className="text-ink-soft">{s.title}：</span>
                    {s.first}
                  </p>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange({ ...plan, first: s.first })}
                    className={`h-11 shrink-0 rounded-full px-3 text-[0.8125rem] ${on ? 'bg-accent-soft text-accent' : 'border border-accent/50 text-accent'}`}
                  >
                    {on ? '使っています' : 'これにする'}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-[0.75rem] text-print">いつ</span>
        {/* 見た目はほかの欄と同じペン書きの線。押すと端末の日時の選び方が開く（本物の入力欄を透明にして重ねる） */}
        <span className="relative flex min-h-12 items-center gap-2 border-b-[1.5px] border-print-frame px-1 py-2">
          <span className={`flex-1 text-[1.125rem] ${plan.when ? 'pen' : 'text-ink-faint'}`}>{plan.when ? formatWhen(plan.when) : '日時を選ぶ'}</span>
          <Icon name="calendar" size={17} className="shrink-0 text-print" />
          <input
            type="datetime-local"
            value={plan.when}
            onChange={(e) => onChange({ ...plan, when: e.target.value })}
            aria-label="いつ"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </span>
      </label>
      {lines.map(({ kind, label, example }) => (
        <div key={kind} className="flex flex-col gap-1">
          <span className="text-[0.75rem] text-print">{label}</span>
          <button
            type="button"
            data-entry={`plan-${kind}`}
            aria-label={`${label}：${plan[kind] || 'まだ書いていない'}`}
            onClick={() => onWrite(kind, label, plan[kind], example)}
            className={`flex min-h-12 w-full items-center gap-2 border-b-[1.5px] border-print-frame px-1 py-2 text-left active:bg-paper-bright ${rowCls(`plan-${kind}`, landing, flash)}`}
          >
            <span className={`flex-1 text-[1.125rem] ${plan[kind] ? 'pen' : 'text-ink-faint'}`}>{plan[kind] || `例：${example}`}</span>
            <Icon name="pencil" size={16} className="shrink-0 text-print" />
          </button>
        </div>
      ))}
    </div>
  )
}

/** 初めて泡を見た時だけ：長押し→スワイプで飛ばせることを1回だけ知らせる */
function FlingHint({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 9000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 -top-4 z-30 flex justify-center"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.3 }}
    >
      <button type="button" onClick={onDone} className="pointer-events-auto flex min-h-9 items-center gap-2 rounded-full bg-ink/80 py-1 pr-2 pl-3.5 text-[0.8125rem] text-white shadow">
        泡は指で動かせます。はじくと外れます
        <span aria-label="閉じる" className="grid h-7 w-7 place-items-center rounded-full bg-white/15">
          <Icon name="close" size={14} />
        </span>
      </button>
    </motion.div>
  )
}
