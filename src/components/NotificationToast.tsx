import { useEffect } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { topSheet, usePaper, usePapers } from '../store'
import { useUI } from '../ui'
import { Icon } from './Icon'
import { juice } from '../lib/juice'
import { toast } from '../lib/motion'

/** 通知を鳴らす（モック：画面内の通知バナーを出す） */
export function ring(paperId: string) {
  usePapers.getState().patchPaper(paperId, { lastRungAt: Date.now() })
  useUI.getState().setUI({ toastPaperId: paperId })
  juice.notified()
}

function openCheckin(paperId: string) {
  useUI.getState().setUI({
    toastPaperId: undefined,
    view: 'paper',
    paperId,
    work: undefined,
    checkin: true,
    checkinAt: Date.now(),
    peek: false,
    settings: false,
  })
}

/** 予約した時刻が来たら鳴らす（アプリを開いている間だけ） */
export function useNotifier() {
  useEffect(() => {
    const check = () => {
      const now = Date.now()
      const due = usePapers
        .getState()
        .papers.find(
          (p) =>
            p.status === 'waiting' &&
            !p.notifyStopped &&
            p.notifyAt !== undefined &&
            p.notifyAt <= now &&
            (!p.lastRungAt || p.lastRungAt < p.notifyAt),
        )
      if (due && !useUI.getState().toastPaperId) ring(due.id)
    }
    check()
    const t = setInterval(check, 15_000)
    return () => clearInterval(t)
  }, [])
}

export function NotificationToast() {
  const id = useUI((s) => s.toastPaperId)
  const paper = usePaper(id)
  const setUI = useUI((s) => s.setUI)

  useEffect(() => {
    if (!id) return
    const t = setTimeout(() => setUI({ toastPaperId: undefined }), 10_000)
    return () => clearTimeout(t)
  }, [id, setUI])

  return (
    <>
      {/* 通知が出たことを読み上げる（読み上げ用の領域は常に置いておく） */}
      <p aria-live="polite" className="sr-only">
        {id && paper ? '通知：今、どう？' : ''}
      </p>
      <AnimatePresence>{id && paper && <Toast key={id} paperId={id} problem={topSheet(paper).problem} />}</AnimatePresence>
    </>
  )
}

function Toast({ paperId, problem }: { paperId: string; problem?: string }) {
  const setUI = useUI((s) => s.setUI)
  // 消えていく途中の通知は押せないようにする
  const present = useIsPresent()
  return (
    // 見出し（「相談先」も）の下に、机の上へメモが1枚すべりこんでくる
    <motion.div
      className="fixed inset-x-3 z-[70]"
      style={{ top: 'calc(var(--safe-top) + 62px)', pointerEvents: present ? 'auto' : 'none' }}
      variants={toast}
      initial="initial"
      animate="animate"
      exit="exit"
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.6, bottom: 0.1 }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -30) setUI({ toastPaperId: undefined })
      }}
    >
      <button
        type="button"
        onClick={() => openCheckin(paperId)}
        className="paper-sheet relative flex w-full items-center gap-3 rounded-[4px] px-3.5 pt-4 pb-3 text-left"
      >
        <span aria-hidden className="tape absolute -top-2.5 left-6 h-5 w-16 -rotate-3" />
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-print-frame text-print">
          <Icon name="sheet" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.75rem] text-ink-soft">通知（モック）</span>
          <span className="block text-[0.9375rem] font-medium">今、どう？</span>
          {problem && <span className="pen block truncate text-[0.875rem]">{problem}</span>}
        </span>
      </button>
    </motion.div>
  )
}
