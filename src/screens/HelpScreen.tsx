import { useRef } from 'react'
import { useBack, useDialogFocus } from '../lib/screens'
import { motion, useIsPresent } from 'motion/react'
import { useUI } from '../ui'
import { Icon } from '../components/Icon'
import { pageScreen } from '../lib/motion'

/**
 * 相談先。
 * モックでは窓口情報はプレースホルダー。本番では公式の相談窓口一覧から取得して表示する。
 */
const PLACEHOLDERS = [
  { kind: '電話で話す', detail: '（窓口名・電話番号・受付時間）' },
  { kind: 'SNS・チャットで話す', detail: '（窓口名・リンク・受付時間）' },
  { kind: '近くの相談先を探す', detail: '（お住まいの自治体の窓口）' },
]

export function HelpScreen() {
  const current = useUI((s) => s.help)
  const setUI = useUI((s) => s.setUI)
  const present = useIsPresent()
  // 閉じていく間も中身を出したままにする
  const last = useRef(current)
  if (current) last.current = current
  const help = current ?? last.current
  const root = useRef<HTMLDivElement>(null)
  useBack(() => setUI({ help: undefined }), present)
  useDialogFocus(root)
  if (!help) return null
  const close = () => setUI({ help: undefined })

  return (
    <motion.div
      ref={root}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label="相談先"
      className="fixed inset-0 z-[80] overflow-y-auto bg-sheet outline-none"
      style={{ pointerEvents: present ? 'auto' : 'none' }}
      variants={pageScreen}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-md flex-col px-5">
        <header className="-ml-3">
          <button type="button" onClick={close} className="flex h-11 items-center gap-1 rounded-full px-3 text-[0.875rem] text-ink-soft active:bg-black/5">
            <Icon name="back" /> {help.serious ? '紙に戻る' : '戻る'}
          </button>
          <h1 className="mt-2 pl-3 text-[1.375rem] font-medium">相談先</h1>
        </header>

        {help.serious && (
          <div className="mt-5 flex flex-col gap-2 text-[1rem] leading-relaxed">
            <p>書いてくれて、ありがとう。</p>
            <p>いまは、問題を整理するより、人と話すほうがいいかもしれません。</p>
            <p className="text-[0.8125rem] text-ink-soft">今の入力は、紙には書いていません。</p>
          </div>
        )}

        <ul className="mt-6 flex flex-col gap-2.5">
          {PLACEHOLDERS.map((p) => (
            <li key={p.kind} className="rounded-2xl bg-white/85 px-4 py-3.5 shadow-[0_1px_3px_rgba(60,50,30,0.08)]">
              <p className="text-[1rem]">{p.kind}</p>
              <p className="mt-0.5 text-[0.8125rem] text-ink-soft">{p.detail}</p>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-[0.75rem] leading-relaxed text-ink-soft">
          ※ モックのため、窓口の情報はプレースホルダーです。本番では、公的機関が公開している相談窓口の一覧から取得して表示します。
        </p>
      </div>
    </motion.div>
  )
}
