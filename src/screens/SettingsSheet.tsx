import { useId, useRef, useState } from 'react'
import { motion, useIsPresent } from 'motion/react'
import { DEFAULT_SETTINGS, usePapers, type MotionPref } from '../store'
import { useUI } from '../ui'
import { useBack, useDialogFocus } from '../lib/screens'
import { addTrauma } from '../lib/shake'
import { sound } from '../lib/sound'
import { scrim, sheet } from '../lib/motion'
import { Icon } from '../components/Icon'

const MOTION_OPTIONS: { value: MotionPref; label: string }[] = [
  { value: 'system', label: '端末に合わせる' },
  { value: 'reduce', label: '減らす' },
  { value: 'full', label: '減らさない' },
]
const SHAKE_OPTIONS = [
  { value: 0, label: 'なし' },
  { value: 0.35, label: '少し' },
  { value: DEFAULT_SETTINGS.shake, label: 'ふつう' },
]
const TEXT_OPTIONS = [
  { value: 1, label: 'ふつう' },
  { value: 1.125, label: '大きめ' },
  { value: 1.25, label: 'もっと大きく' },
]
const LONG_PRESS_OPTIONS = [
  { value: 280, label: '短め' },
  { value: DEFAULT_SETTINGS.longPress, label: 'ふつう' },
  { value: 650, label: '長め' },
]

export function SettingsSheet() {
  const settings = usePapers((s) => s.settings)
  const { setSettings, addExamplePaper, addPastPapers, clearAll } = usePapers.getState()
  const ui = useUI()
  const [confirmClear, setConfirmClear] = useState(false)
  const present = useIsPresent()
  const dialog = useRef<HTMLDivElement>(null)
  useBack(() => ui.setUI({ settings: false }), present)
  useDialogFocus(dialog)
  const close = () => ui.setUI({ settings: false })
  const volumeId = useId()

  return (
    <motion.div className="fixed inset-0 z-[65]" style={{ pointerEvents: present ? 'auto' : 'none' }} initial="initial" animate="animate" exit="exit">
      <motion.button type="button" aria-label="閉じる" className="absolute inset-0 bg-scrim" onClick={close} variants={scrim} />
      <motion.div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label="設定"
        className="pb-safe absolute inset-x-0 bottom-0 max-h-[88%] overflow-y-auto rounded-t-3xl bg-sheet px-5 pt-4 shadow-[0_-8px_30px_rgba(60,50,30,0.12)] outline-none"
        variants={sheet}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[1.125rem] font-medium">設定</h2>
          <button type="button" onClick={close} className="h-11 rounded-full px-4 text-[0.875rem] text-ink-soft">
            閉じる
          </button>
        </div>

        <div className="mt-3 flex min-h-12 items-center justify-between">
          <span id="sound-label" className="text-[0.9375rem]">
            効果音
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.sound}
            aria-labelledby="sound-label"
            onClick={() => {
              setSettings({ sound: !settings.sound })
              if (!settings.sound) setTimeout(() => sound.pop(), 0)
            }}
            className={`flex h-11 min-w-20 items-center justify-center rounded-full border text-[0.875rem] ${settings.sound ? 'border-accent bg-accent-soft text-accent' : 'border-frame text-ink-soft'}`}
          >
            {settings.sound ? 'オン' : 'オフ'}
          </button>
        </div>

        {settings.sound && (
          <div className="mt-1 flex min-h-12 items-center gap-3">
            <label htmlFor={volumeId} className="shrink-0 text-[0.875rem] text-ink-soft">
              音量
            </label>
            <input
              id={volumeId}
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              onChange={(e) => setSettings({ volume: Number(e.target.value) })}
              onPointerUp={() => sound.pop()}
              onKeyUp={() => sound.pop()}
              className="h-11 flex-1 accent-[var(--color-accent)]"
            />
            <span className="w-10 text-right text-[0.8125rem] text-ink-soft tabular-nums">{Math.round(settings.volume * 100)}%</span>
          </div>
        )}

        <Choice
          label="動きを減らす"
          options={MOTION_OPTIONS}
          value={settings.motion}
          onChange={(v) => setSettings({ motion: v })}
        />
        <Choice
          label="画面の揺れ"
          note="泡がはじけた時や、紙をはさんだ時の小さな揺れ"
          options={SHAKE_OPTIONS}
          value={settings.shake}
          onChange={(v) => {
            setSettings({ shake: v })
            if (v > 0) setTimeout(() => addTrauma(0.6), 0)
          }}
        />
        <Choice label="文字の大きさ" options={TEXT_OPTIONS} value={settings.textScale} onChange={(v) => setSettings({ textScale: v })} />
        <Choice
          label="泡を止めるまでの長押し"
          options={LONG_PRESS_OPTIONS}
          value={settings.longPress}
          onChange={(v) => setSettings({ longPress: v })}
        />

        <button
          type="button"
          onClick={() => ui.setUI({ settings: false, tutorial: true })}
          className="mt-5 flex h-12 w-full items-center justify-between rounded-xl border border-frame bg-paper-bright/70 px-4 text-[0.9375rem] active:bg-white"
        >
          使い方をもう一度見る
          <Icon name="chevron" size={16} className="-rotate-90 text-ink-soft" />
        </button>

        <div className="mt-6 border-t border-frame pt-4 pb-2">
          <p className="mb-2 text-[0.75rem] text-ink-faint">デバッグ</p>
          <div className="flex flex-col gap-2">
            <div className="flex min-h-11 items-center justify-between">
              <span id="fps-label" className="text-[0.875rem] text-ink-soft">
                フレームレートを表示
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.showFps}
                aria-labelledby="fps-label"
                onClick={() => setSettings({ showFps: !settings.showFps })}
                className={`flex h-11 min-w-20 items-center justify-center rounded-full border text-[0.875rem] ${settings.showFps ? 'border-accent bg-accent-soft text-accent' : 'border-frame text-ink-soft'}`}
              >
                {settings.showFps ? 'オン' : 'オフ'}
              </button>
            </div>
            <button
              type="button"
              className="h-11 rounded-xl border border-frame bg-paper-bright/70 text-[0.875rem] text-ink-soft active:bg-white"
              onClick={() => {
                const id = addExamplePaper()
                ui.setUI({ settings: false })
                ui.openPaper(id)
              }}
            >
              例の紙を1枚つくる（6番まで書いた状態）
            </button>
            <button
              type="button"
              className="h-11 rounded-xl border border-frame bg-paper-bright/70 text-[0.875rem] text-ink-soft active:bg-white"
              onClick={() => {
                addPastPapers()
                ui.setUI({ settings: false, report: true })
              }}
            >
              ふりかえり用の過去の紙（6枚）を入れなおす
            </button>
            {!confirmClear ? (
              <button type="button" className="h-11 rounded-xl border border-frame bg-paper-bright/70 text-[0.875rem] text-ink-soft active:bg-white" onClick={() => setConfirmClear(true)}>
                すべての紙を消す
              </button>
            ) : (
              <button
                type="button"
                className="h-11 rounded-xl border border-danger text-[0.875rem] text-danger"
                onClick={() => {
                  clearAll()
                  setConfirmClear(false)
                  ui.setUI({ settings: false })
                }}
              >
                本当に消す（元に戻せません）
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Choice<T extends string | number>({
  label,
  note,
  options,
  value,
  onChange,
}: {
  label: string
  note?: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  const id = useId()
  return (
    <div className="mt-4">
      <p id={id} className="text-[0.9375rem]">
        {label}
      </p>
      {note && <p className="mt-0.5 text-[0.75rem] text-ink-soft">{note}</p>}
      <div role="radiogroup" aria-labelledby={id} className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-h-11 rounded-xl border px-1 text-[0.8125rem] ${value === o.value ? 'border-accent bg-accent-soft text-accent' : 'border-frame text-ink-soft'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
