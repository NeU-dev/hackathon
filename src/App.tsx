import { useEffect, useRef } from 'react'
import { AnimatePresence, MotionConfig } from 'motion/react'
import { useUI } from './ui'
import { hasWebGL, useReduced, useVisualViewport } from './lib/env'
import { DrawerScreen } from './screens/DrawerScreen'
import { PaperScreen } from './screens/PaperScreen'
import { WorkScreen } from './screens/WorkScreen'
import { CheckinScreen } from './screens/CheckinScreen'
import { HelpScreen } from './screens/HelpScreen'
import { SettingsSheet } from './screens/SettingsSheet'
import { PeekSheet, RecordPeek } from './screens/PeekSheet'
import { ReportScreen } from './screens/ReportScreen'
import { ConsultMemoScreen } from './screens/ConsultMemoScreen'
import { TutorialScreen } from './screens/TutorialScreen'
import { PlaneLayer } from './components/Plane'
import { FxLayer } from './components/Fx'
import { NotificationToast, useNotifier } from './components/NotificationToast'
import { preloadBubbles } from './components/bubbles/BubbleField'
import { FpsMeter } from './components/FpsMeter'
import { usePapers } from './store'
import { useShakeTarget } from './lib/shake'
import { goBack } from './lib/screens'

export default function App() {
  useVisualViewport()
  useNotifier()
  const reduced = useReduced()
  const { view, paperId, work, checkin, checkinAt, help, settings, peek, report, memo, recordPeek, tutorial } = useUI()
  const textScale = usePapers((s) => s.settings.textScale)
  // 揺らすのは画面（紙や机）だけ。通知・粒・相談先ボタンは揺らさない
  const stage = useRef<HTMLDivElement>(null)
  useShakeTarget(stage)

  useEffect(() => {
    if (hasWebGL()) preloadBubbles()
    // はじめて開いた時だけ、使い方を出す
    if (!usePapers.getState().settings.tutorialSeen) useUI.getState().setUI({ tutorial: true })
  }, [])

  // CSS 側の演出（インクのにじみ・押した時の沈み）も、動きを減らす設定に合わせる
  useEffect(() => {
    document.documentElement.toggleAttribute('data-reduced', reduced)
  }, [reduced])

  // 文字の大きさ：文字や余白は rem で書いてあるので、基準の大きさを変えるだけで全体が大きくなる
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * textScale}px`
  }, [textScale])

  // Esc で、いちばん上の画面を閉じる（日本語の変換中は除く）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing && goBack()) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <div className="fixed inset-0 overflow-hidden">
        <div ref={stage} className="absolute inset-0">
          {/* 引き出しと紙は重ねて入れ替える（引き出しが消えていく上に、机へバインダーが出てくる） */}
          <AnimatePresence initial={false}>
            {view === 'drawer' || !paperId ? <DrawerScreen key="drawer" /> : <PaperScreen key={paperId} paperId={paperId} />}
          </AnimatePresence>

          {work && paperId && <WorkScreen key={`${paperId}-${work.frame}`} paperId={paperId} frame={work.frame} origin={work.rect} />}
          <AnimatePresence>{peek && paperId && <PeekSheet paperId={paperId} />}</AnimatePresence>
          <AnimatePresence>{checkin && paperId && <CheckinScreen key={checkinAt} paperId={paperId} />}</AnimatePresence>
          <AnimatePresence>{report && <ReportScreen />}</AnimatePresence>
          <AnimatePresence>{memo && <ConsultMemoScreen />}</AnimatePresence>
          <AnimatePresence>
            {recordPeek && <RecordPeek key={`${recordPeek.paperId}-${recordPeek.sheetNo}`} paperId={recordPeek.paperId} sheetNo={recordPeek.sheetNo} />}
          </AnimatePresence>
        </div>
        <AnimatePresence>{settings && <SettingsSheet />}</AnimatePresence>
        <AnimatePresence>{tutorial && <TutorialScreen />}</AnimatePresence>

        <NotificationToast />
        <PlaneLayer />
        <FxLayer />
        <AnimatePresence>{help && <HelpScreen />}</AnimatePresence>
        <FpsMeter />
      </div>
    </MotionConfig>
  )
}
