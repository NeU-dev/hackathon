import { Fragment } from 'react'
import { loadDefaultJapaneseParser } from 'budoux'

const parser = loadDefaultJapaneseParser()
const cache = new Map<string, string[]>()

/** 泡の中の文節の長さの上限（全角の字数）。これより長い文節は、まん中あたりで2つに分ける */
export const MAX_PHRASE_EM = 7.5

/** 文字の幅（全角＝1）。数字や英字は全角の6割ほど */
export const emWidth = (s: string) => [...s].reduce((w, c) => w + (c.charCodeAt(0) < 0x2e80 ? 0.6 : 1), 0)

// 行の頭に来てはいけない文字（句読点・小さい仮名・のばす音）
const NO_START = /[、。，．？！）」』ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ]/
const ALNUM = /[0-9A-Za-z]/

/** 長すぎる文節（「やらないとしたら？」）を、まん中に近い切れ目で分ける */
function splitLong(p: string): string[] {
  const total = emWidth(p)
  if (total <= MAX_PHRASE_EM) return [p]
  const chars = [...p]
  let best = -1
  let bestD = Infinity
  let w = 0
  let quote = 0
  for (let i = 1; i < chars.length; i++) {
    w += emWidth(chars[i - 1])
    // かぎかっこの中（「相談先」）では分けない
    if (chars[i - 1] === '「') quote++
    if (chars[i - 1] === '」') quote--
    if (quote > 0 || NO_START.test(chars[i]) || (ALNUM.test(chars[i]) && ALNUM.test(chars[i - 1]))) continue
    const d = Math.abs(w - total / 2)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  if (best < 0) return [p]
  return [...splitLong(chars.slice(0, best).join('')), ...splitLong(chars.slice(best).join(''))]
}

/** 短いかぎかっこ（「最初の2分」「相談先」）は、途中で折り返さないよう1つにまとめる */
function joinQuotes(list: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < list.length; i++) {
    let p = list[i]
    const open = p.lastIndexOf('「')
    if (open >= 0 && p.indexOf('」', open) < 0) {
      let j = i + 1
      let q = p
      while (j < list.length && !q.slice(open).includes('」')) q += list[j++]
      if (q.slice(open).includes('」') && emWidth(q.slice(open, q.indexOf('」', open) + 1)) <= 8) {
        p = q
        i = j - 1
      }
    }
    out.push(p)
  }
  return out
}

/**
 * 文を文節に分ける（「今週できる範囲だと？」→「今週できる」「範囲だと？」）。
 * narrow：泡の中のように幅が狭い時。長すぎる文節も、まん中あたりで分ける
 */
export function phrases(text: string, narrow = false): string[] {
  const key = narrow ? `n:${text}` : text
  let p = cache.get(key)
  if (!p) {
    p = narrow ? phrases(text).flatMap(splitLong) : joinQuotes(parser.parse(text))
    cache.set(key, p)
  }
  return p
}

/**
 * 文節の切れ目でだけ折り返す文字。言葉の途中（「範／囲」）では折り返さない。
 * 置く側に `phrase-wrap` を付ける（文節より狭い時だけ、途中で折り返す）
 */
export function Phrases({ text, narrow = false }: { text: string; narrow?: boolean }) {
  return (
    <>
      {phrases(text, narrow).map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {p}
        </Fragment>
      ))}
    </>
  )
}
