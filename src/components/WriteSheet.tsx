import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { motion, useIsPresent } from 'motion/react'
import { useReduced } from '../lib/env'
import { useBack } from '../lib/screens'
import { Icon } from './Icon'
import { Swap } from './Motion'

/**
 * 何を書くか。list：枠のリストに1行足す。edit：書いた行を直す。
 * problem／goal／scene：決まった欄を書き直す。それ以外：決まった欄に書く
 */
export interface WriteTarget {
  kind: 'list' | 'edit' | 'tired' | 'worry' | 'where' | 'first' | 'problem' | 'goal' | 'scene'
  /** edit：直す行 */
  entryKey?: 'dump' | 'sceneAnswers' | 'goalNotes' | 'ideas'
  entryId?: string
  /** 上に出す問い（はじけた泡の問い・決まった問い・欄の名前） */
  heading?: string
  initial?: string
  /** 開く起点（はじけた泡の位置など）。そこから紙がふくらんで出てくる */
  origin?: { x: number; y: number }
  /** 書く欄に薄く出す見本（別の誰かの例）。開いている間は変えない */
  example?: string
  /**
   * 書き直す間も見比べたい言葉（前回の一歩・小さくした案など）。押すと、その言葉が書く欄に入る。
   * メモ用紙が上に重なると下の画面は見えなくなるので、見比べるものは用紙の中に置く
   */
  refs?: { label: string; text: string }[]
}

interface Props {
  target: WriteTarget
  frameLabel: string
  placeholder: string
  /** エンターで改行するか（しないならエンターで追加） */
  multiline: boolean
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onSubmit: (text: string, sheetRect: DOMRect, layout: SheetLayout) => void
  onCancel: () => void
  /** edit：この行を消す */
  onDelete?: () => void
}

/** 紙飛行機に折る時に、用紙の上の文字と同じ場所に文字を置くための位置（用紙の左上から） */
export interface SheetLayout {
  heading?: { text: string; top: number; left: number; width: number }
  body: { top: number; left: number; width: number }
}

/**
 * 閉じ方。send：紙飛行機に折られるので、紙はその場で消え、暗い幕だけゆっくり明るくなる。
 * cancel：紙が少し縮んで消える
 */
export type SheetExit = 'send' | 'cancel'
const sheetVariants = {
  exit: (kind: SheetExit) => (kind === 'send' ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.94, y: -8, transition: { duration: 0.18 } }),
}

/** 画面の上の方に出す（キーボードが開いても隠れないように） */
const TOP = 'calc(var(--vvt) + var(--safe-top) + 14px)'
const SIDE = 12

/**
 * 書くためのメモ用紙。画面の上の方に出すので、キーボードが開いても隠れない。
 * いちばん上に「やめる」と「追加」、その下に問い、その下に書く欄。
 */
export function WriteSheet({ target, frameLabel, placeholder, multiline, textareaRef, onSubmit, onCancel, onDelete }: Props) {
  // 直す時は、紙飛行機にはならず、その場で書き換わる
  const rewrite = target.kind === 'edit' || target.kind === 'problem' || target.kind === 'goal' || target.kind === 'scene'
  // 1つだけ入る欄（どこで・最初の2分・疲れている日でも・心配なこと）は「追加」ではない。もう書いてあれば「直す」
  const single = target.kind === 'where' || target.kind === 'first' || target.kind === 'tired' || target.kind === 'worry'
  const submitLabel = rewrite ? '直す' : single ? (target.initial?.trim() ? '直す' : '書く') : '追加'
  const [confirmDelete, setConfirmDelete] = useState(false)
  const reduced = useReduced()
  const [text, setText] = useState(target.initial ?? '')
  const sheet = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLParagraphElement>(null)
  const present = useIsPresent()
  useBack(onCancel, present)

  // 書いた文に合わせて欄が伸びる（最大6行ほど。それ以上は中でスクロール）
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const h = el.scrollHeight + 2
    el.style.height = `${Math.min(h, 186)}px`
    el.style.overflowY = h > 186 ? 'auto' : 'hidden'
  }, [text, textareaRef])

  const submit = () => {
    const t = text.trim()
    if (!t || !sheet.current || !textareaRef.current) return
    const box = sheet.current.getBoundingClientRect()
    const rel = (r: DOMRect) => ({ top: r.top - box.top, left: r.left - box.left, width: r.width })
    const h = headingRef.current
    onSubmit(t, box, {
      heading: h && target.heading ? { text: target.heading, ...rel(h.getBoundingClientRect()) } : undefined,
      body: rel(textareaRef.current.getBoundingClientRect()),
    })
  }

  // 泡の位置から紙がふくらんで出てくる
  const origin = target.origin
  const transformOrigin = origin ? `${origin.x - SIDE}px ${origin.y - 70}px` : '50% 0%'

  return (
    <div
      className="fixed inset-0 z-[45]"
      style={{ pointerEvents: present ? 'auto' : 'none' }}
      role="dialog"
      aria-modal="true"
      aria-label={target.heading ?? frameLabel}
    >
      <motion.div
        className="absolute inset-0 bg-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.28 } }}
        transition={{ duration: 0.2 }}
        aria-hidden
      />
      <motion.div
        ref={sheet}
        className="paper-sheet absolute rounded-[4px]"
        style={{ top: TOP, left: SIDE, right: SIDE, transformOrigin }}
        variants={sheetVariants}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.25, rotate: -6 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        exit="exit"
        transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 360, damping: 26 }}
      >
        {/* メモ帳から1枚はがした紙：上のミシン目 */}
        <div aria-hidden className="mx-3 h-2.5 border-b-2 border-dotted border-print-line" />
        <div className="flex items-center gap-2 px-2 pt-1">
          <button type="button" onClick={onCancel} className="h-11 rounded-full px-3 text-[0.9375rem] text-ink-soft active:bg-black/5">
            やめる
          </button>
          <span className="min-w-0 flex-1 truncate text-center text-[0.8125rem] text-print">{frameLabel}</span>
          <button
            type="button"
            disabled={!text.trim()}
            onPointerDown={(e) => e.preventDefault()}
            onClick={submit}
            className="tactile-accent flex h-11 items-center gap-1.5 rounded-xl px-3.5 text-[0.9375rem] font-medium"
          >
            {rewrite ? <Icon name="pencil" size={16} /> : <Icon name="plane" size={17} />}
            {submitLabel}
          </button>
        </div>
        <div className="px-4 pt-1 pb-4">
          {target.heading && (
            <p ref={headingRef} className="mt-1 text-[1.0625rem] leading-snug font-medium text-accent">
              {target.heading}
            </p>
          )}
          {target.refs && target.refs.length > 0 && (
            <ul aria-label="見比べる" className="-mx-1 mt-1.5 mb-1 flex flex-col border-b border-dashed border-print-line pb-1">
              {target.refs.map((r) => {
                const on = text.trim() === r.text
                return (
                  <li key={r.label + r.text}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setText(r.text)
                        textareaRef.current?.focus({ preventScroll: true })
                      }}
                      className="flex min-h-11 w-full items-baseline gap-2 rounded-md px-1 py-1.5 text-left active:bg-print-tint"
                    >
                      <span className="w-[6.5em] shrink-0 text-[0.75rem] whitespace-nowrap text-print">{r.label}</span>
                      <span className="pen min-w-0 flex-1 text-[0.9375rem] leading-snug">{r.text}</span>
                      <span className={`shrink-0 text-[0.75rem] ${on ? 'text-ink-faint' : 'text-accent'}`}>{on ? '入っています' : 'これにする'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <textarea
            ref={textareaRef}
            value={text}
            rows={3}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // 日本語の変換確定のエンターでは送らない
              if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
              if (multiline && !(e.metaKey || e.ctrlKey)) return
              e.preventDefault()
              submit()
            }}
            enterKeyHint={multiline ? 'enter' : 'send'}
            placeholder={placeholder}
            aria-label={target.heading ?? frameLabel}
            className="field pen mt-1 block min-h-[5.625rem] w-full resize-none border-0 bg-transparent p-0 text-[1.125rem] outline-none"
          />
          {onDelete && (
            <div className="-mb-2 flex justify-end">
              <Swap id={confirmDelete ? 'confirm' : 'ask'}>
              {!confirmDelete ? (
                <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => setConfirmDelete(true)} className="h-11 rounded-full px-3 text-[0.8125rem] text-ink-soft active:bg-black/5">
                  この行を消す
                </button>
              ) : (
                <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={onDelete} className="h-11 rounded-full px-3 text-[0.8125rem] text-danger active:bg-black/5">
                  本当に消す
                </button>
              )}
              </Swap>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
