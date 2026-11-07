import { sound } from './sound'
import { addTrauma } from './shake'
import { burst, puff } from '../components/Fx'

/**
 * 手ごたえ（ジュース）の置き場所。出来事ごとに、どの強さの組み合わせで返すかをここで決める。
 * 強さは3段階：
 *   small  … 音か振動のどちらか。揺れなし（泡を飛ばす・通知が届く）
 *   medium … 粒＋音＋振動＋ごく小さな揺れ（泡がはじける・紙飛行機が着地する）
 *   large  … 音＋振動＋はっきりした揺れ（枠が埋まる・紙が重なる）
 * 「やった」は大事な出来事だが、仕様どおり派手にしない（揺らさない）。
 */

/** 振動。画面に一度も触れていない時は呼ばない（ブラウザが警告を出すため） */
export function haptic(pattern: number | number[]) {
  try {
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
    if (ua && !ua.hasBeenActive) return
    navigator.vibrate?.(pattern)
  } catch {
    // 振動できない端末では何もしない
  }
}

export const juice = {
  /** medium：泡がはじける（膜のかけら・しずく・衝撃の輪・光） */
  bubblePop(x: number, y: number, r: number) {
    burst(x, y, r)
    sound.pop()
    haptic(8)
    addTrauma(0.32)
  },
  /** small：泡を飛ばす */
  bubbleFling() {
    sound.whoosh()
    haptic(4)
  },
  /** small：泡どうしが強めにぶつかる（音だけ。strength は 0〜1） */
  bubbleBump(strength: number) {
    sound.bump(strength)
  },
  /** small：書いたメモが紙飛行機になって飛び立つ */
  planeLaunch() {
    sound.whoosh()
    haptic(6)
  },
  /** medium：紙飛行機がリストに着地して、1行になる */
  planeLand(x: number, y: number) {
    puff(x, y)
    sound.land()
    haptic(8)
    addTrauma(0.22)
  },
  /** large：枠が埋まる（紙に戻って文字が入る） */
  frameFilled() {
    sound.done()
    haptic([10, 40, 14])
    addTrauma(0.45)
  },
  /** large：新しい紙をバインダーにはさむ（クリップが閉じる瞬間） */
  sheetClipped() {
    sound.clack()
    haptic(16)
    addTrauma(0.62)
  },
  /** small：引き出しから出した紙を、バインダーにはさむ（開くたびに鳴るので、揺らさず軽く） */
  sheetSet() {
    sound.clip()
    haptic(6)
  },
  /** medium（揺れなし）：やった */
  didIt() {
    sound.done()
    haptic([8, 60, 8])
  },
  /** small：通知が届く */
  notified() {
    sound.chime()
    haptic([6, 50, 6])
  },
}
