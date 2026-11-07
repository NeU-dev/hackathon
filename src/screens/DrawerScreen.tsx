import { useEffect, useState } from 'react'
import { motion, useIsPresent } from 'motion/react'
import type { Paper } from '../types'
import { topSheet, usePapers } from '../store'
import { useUI } from '../ui'
import { useReduced } from '../lib/env'
import { CIRCLED, STATUS_LABEL, isFilled } from '../lib/frames'
import { formatAt } from '../lib/format'
import { Phrases } from '../components/Phrases'
import { Icon, STATUS_ICON } from '../components/Icon'
import { HelpLink } from '../components/HelpButton'
import { DUR, EASE, recede, recedeInitial, reveal } from '../lib/motion'

/** 書く枠（⑦ふりかえりは、実行してから書くので数えない） */
const WRITE_FRAMES = [1, 2, 3, 4, 5, 6] as const

/**
 * A. 引き出し：過去の紙の一覧。評価や達成率は置かない。数を見せるだけ。
 * 机の上に紙が並んでいる、というところだけ残して、飾りの凹凸（真鍮の札・光るボタン・へこんだ箱）は持たない
 */
export function DrawerScreen() {
  const papers = usePapers((s) => s.papers)
  const createPaper = usePapers((s) => s.createPaper)
  const ui = useUI()
  const reduced = useReduced()
  // 最近さわった順（作った日順だと、今日さわった古い紙が下に沈む）
  const newest = (a: Paper, b: Paper) => b.updatedAt - a.updatedAt
  const active = papers.filter((p) => p.status !== 'shelved').sort(newest)
  const shelved = papers.filter((p) => p.status === 'shelved').sort(newest)

  // ふりかえり・相談先が上に重なっている間は、左へ少しずれて奥に下がる
  const covered = ui.report || !!ui.help
  // 大きな見出しが隠れるまでスクロールしたら、上の帯に小さな見出しを出す
  const [scrolled, setScrolled] = useState(false)
  let order = 0
  const next = () => Math.min(order++, 8)

  // 紙を手に取る：束のいちばん上の紙がはがれる・押した紙が少し持ち上がってから、机にバインダーが出てくる
  const [taking, setTaking] = useState(false)
  const [lifting, setLifting] = useState<string>()
  const busy = taking || !!lifting
  // 消えていく途中で引き出しへ戻ってきた時は、同じ引き出しがそのまま戻る。手に取った紙を元に戻しておく
  const present = useIsPresent()
  useEffect(() => {
    if (!present) return
    setTaking(false)
    setLifting(undefined)
  }, [present])
  const take = () => {
    if (busy) return
    if (reduced) return ui.openPaper(createPaper())
    setTaking(true)
    setTimeout(() => ui.openPaper(createPaper()), 190)
  }
  const open = (id: string) => {
    if (busy) return
    if (reduced) return ui.openPaper(id)
    setLifting(id)
    setTimeout(() => ui.openPaper(id), 170)
  }

  return (
    <motion.div
      className="desk-calm absolute inset-0 overflow-y-auto overscroll-contain"
      onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 44)}
      // 紙を開くと、引き出しの紙は消えていく（その上に、紙の画面が重なって出てくる）
      exit={{ opacity: 0, transition: { duration: DUR.fast, ease: EASE } }}
    >
      <motion.div initial={recedeInitial} animate={recede(covered)}>
        <header
          className={`pt-safe sticky top-0 z-20 flex items-center gap-1 px-2 pb-1 transition-[background-color,box-shadow] duration-150 ${
            scrolled ? 'bg-desk-calm shadow-[0_1px_0_rgb(90_70_40/0.14)]' : ''
          }`}
        >
          <span aria-hidden className={`mr-auto pl-3 text-[1rem] font-medium transition-opacity duration-150 ${scrolled ? 'opacity-100' : 'opacity-0'}`}>
            引き出し
          </span>
          <button
            type="button"
            aria-label="設定"
            onClick={() => ui.setUI({ settings: true })}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-soft active:bg-black/5"
          >
            <Icon name="gear" size={20} />
          </button>
          <HelpLink />
        </header>

        <div className="px-5">
          <h1 className="text-[1.875rem] leading-tight font-medium tracking-[-0.01em]">引き出し</h1>
          <div className="mt-0.5 flex items-center gap-4">
            <p className="text-[0.875rem] text-ink-soft">紙 {papers.length}枚</p>
            {/* E. ふりかえり：過去の紙から作る、本人のためのレポート */}
            <button
              type="button"
              onClick={() => ui.setUI({ report: true })}
              className="-mx-2 flex h-11 items-center gap-1 rounded-full px-2 text-[0.875rem] font-medium text-print active:bg-print-tint"
            >
              <Icon name="sheet" size={17} />
              ふりかえり
              <Icon name="chevron" size={16} className="-rotate-90" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 pt-4 pb-10">
          {/* まっさらな紙の束から、1枚取る */}
          <button type="button" onClick={take} className="group relative mb-2 h-16 w-full text-[1rem]">
            <span aria-hidden className="paper-sheet absolute inset-x-1.5 inset-y-0 translate-y-[7px] rounded-[6px] opacity-70 shadow-none" />
            <span aria-hidden className="paper-sheet absolute inset-x-0.5 inset-y-0 translate-y-[3.5px] rounded-[6px] shadow-none" />
            {/* 押すと、いちばん上の1枚が束からはがれて持ち上がる */}
            <motion.span
              className="relative block h-full"
              initial={false}
              animate={taking ? { y: -26, rotate: -1.5, scale: 1.03 } : { y: 0, rotate: 0, scale: 1 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              <span
                className={`paper-sheet flex h-full items-center justify-center gap-2 rounded-[6px] font-medium text-print transition-[translate,box-shadow] duration-150 group-active:translate-y-[2px] ${
                  taking
                    ? 'shadow-[0_2px_4px_rgb(60_45_25/0.12),0_18px_30px_-12px_rgb(60_45_25/0.4)]'
                    : 'shadow-[0_1px_1px_rgb(60_45_25/0.1),0_8px_18px_-8px_rgb(60_45_25/0.3)]'
                }`}
              >
                <Icon name="plus" size={20} />
                新しい紙
              </span>
            </motion.span>
          </button>

          {papers.length === 0 && (
            <p className="mt-8 text-center text-[0.875rem] leading-relaxed text-ink">
              まだ紙はありません。
              <br />
              頭の中にあることを、新しい紙に書き出せます。
            </p>
          )}

          {active.map((p) => (
            <PaperCard key={p.id} paper={p} index={next()} flash={ui.flashCardId === p.id} lifting={lifting === p.id} onOpen={() => open(p.id)} />
          ))}

          {shelved.length > 0 && (
            <>
              <h2 className="mt-5 px-1 text-[0.875rem] font-medium text-ink-soft">置いてある</h2>
              {shelved.map((p) => (
                <PaperCard key={p.id} paper={p} index={next()} faded flash={ui.flashCardId === p.id} lifting={lifting === p.id} onOpen={() => open(p.id)} />
              ))}
            </>
          )}

          {shelved.length >= 3 && (
            <p className="mt-4 text-center text-[0.8125rem] text-ink">
              <button type="button" className="min-h-11 px-2 underline underline-offset-4" onClick={() => ui.setUI({ help: { serious: false } })}>
                誰かに相談するのも、ひとつの選択です
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

/**
 * 書いている途中の紙：①〜⑥のどこが書けているか。用紙に刷られた番号をそのまま並べ、
 * 書けた枠はペンの色、まだの枠はうすく（読み上げは「③まで書いた」のような一言で）
 */
function Progress({ paper }: { paper: Paper }) {
  const s = topSheet(paper)
  const filled = WRITE_FRAMES.filter((n) => isFilled(s, n))
  const label = filled.length === 0 ? 'まだ何も書いていない' : `${CIRCLED[filled.length - 1]}まで書いた`
  return (
    <span role="img" aria-label={label} className="flex items-center gap-[3px] text-[0.8125rem] leading-none">
      {WRITE_FRAMES.map((n) => (
        <span key={n} aria-hidden className={isFilled(s, n) ? 'font-medium text-pen' : 'text-ink-mute'}>
          {CIRCLED[n - 1]}
        </span>
      ))}
    </span>
  )
}

/** 状態のくわしい一言（いつ聞くか） */
function waitingNote(paper: Paper): string {
  return paper.notifyAt && !paper.notifyStopped ? `${formatAt(paper.notifyAt)} に聞く` : '聞くのを止めている'
}

function PaperCard({
  paper,
  faded,
  flash,
  lifting,
  index,
  onOpen,
}: {
  paper: Paper
  faded?: boolean
  flash?: boolean
  /** 開く直前：机から少し持ち上がる */
  lifting?: boolean
  index: number
  onOpen: () => void
}) {
  const reduced = useReduced()
  const problem = topSheet(paper).problem
  // まだ困りごとを選んでいない紙は、しまってある紙と同じく少し沈ませる
  faded = faded || !problem
  const n = paper.sheets.length
  const created = new Date(paper.createdAt)
  // 机の上の紙は、ほんの少しずつ傾いて置かれている
  const tilt = (((paper.id.charCodeAt(0) + paper.id.charCodeAt(1)) % 5) * 0.25 - 0.5) * 0.6
  // 上の紙から順に（1枚ずつ 40ms ずらす）
  const enter = reveal(index + 1)
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      className="group relative w-full text-left"
      // しまった紙が戻ってくる時は、上から落ちてくる。それ以外は、上から順に少しずつ浮かび上がる
      initial={reduced ? false : flash ? { y: -60, opacity: 0, rotate: -4, scale: 0.94 } : { ...enter.initial, rotate: tilt * 3 }}
      animate={
        lifting
          ? { y: -6, rotate: 0, scale: 1.025, opacity: 1, transition: { duration: 0.17, ease: EASE } }
          : flash
            ? { y: 0, opacity: 1, rotate: tilt, scale: 1 }
            : { ...enter.animate, rotate: tilt }
      }
      transition={flash ? { type: 'spring', stiffness: 220, damping: 18, delay: 0.15 } : undefined}
    >
      {/* 重なった紙は、下の紙の端が少しのぞく */}
      {n > 1 && (
        <span
          aria-hidden
          className={`absolute inset-0 translate-x-[3px] translate-y-[4px] rotate-[0.6deg] rounded-[6px] ${faded ? 'bg-paper-dim ring-1 ring-frame/70' : 'paper-sheet shadow-[0_1px_2px_rgb(60_45_25/0.12)]'}`}
        />
      )}
      {/* 置いてある紙は、影を落とさない、少しくすんだ紙に（透けさせない）。文字の濃さは変えない */}
      <span
        className={`relative block rounded-[6px] px-4 pt-3 pb-3 transition-shadow duration-150 ${
          lifting
            ? 'paper-sheet shadow-[0_2px_4px_rgb(60_45_25/0.12),0_16px_28px_-10px_rgb(60_45_25/0.36)]'
            : faded
              ? 'bg-paper-dim ring-1 ring-frame/70'
              : 'paper-sheet shadow-[0_1px_1px_rgb(60_45_25/0.1),0_6px_14px_-6px_rgb(60_45_25/0.24)] group-active:shadow-[0_1px_2px_rgb(60_45_25/0.12)]'
        }`}
      >
        <span className="flex items-baseline gap-2">
          {problem ? (
            <span className="pen phrase-wrap line-clamp-2 min-w-0 flex-1 text-[1.125rem]">
              <Phrases text={problem} />
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-ink-faint">まだ言葉になっていない紙</span>
          )}
          {/* 同じ困りごとの紙が並んでも見分けられるように、書きはじめた日 */}
          <span className="pen shrink-0 text-[0.875rem] text-ink-soft">{`${created.getMonth() + 1}月${created.getDate()}日`}</span>
        </span>
        <span className="mt-1.5 flex min-h-5 items-center gap-1.5 text-[0.8125rem] text-ink-soft">
          <Icon name={STATUS_ICON[paper.status]} size={15} />
          {paper.status === 'writing' ? (
            <>
              <span className="sr-only">{STATUS_LABEL.writing}</span>
              <Progress paper={paper} />
            </>
          ) : paper.status === 'waiting' ? (
            <span className="min-w-0 truncate">{waitingNote(paper)}</span>
          ) : (
            STATUS_LABEL[paper.status]
          )}
          {n > 1 && <span className="ml-auto shrink-0 border border-print-frame px-1.5 text-[0.75rem] leading-5 text-print">{n}枚目</span>}
        </span>
      </span>
    </motion.button>
  )
}
