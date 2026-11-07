/**
 * 枠に文字が入る：ペンで書いたインクが、1文字ずつ紙にしみこむように（全体で 0.5 秒前後）。
 * 動きを減らす設定ではフェードだけ。
 */
export function TypeText({ text, reduced }: { text: string; reduced: boolean }) {
  if (reduced) return <span className="ink-in">{text}</span>
  const chars = [...text]
  const step = Math.min(28, 420 / Math.max(1, chars.length))
  return (
    <span aria-label={text}>
      {chars.map((ch, i) =>
        ch === '\n' ? (
          <br key={i} />
        ) : (
          <span key={i} aria-hidden className="ink-char" style={{ animationDelay: `${Math.round(i * step)}ms` }}>
            {ch}
          </span>
        ),
      )}
    </span>
  )
}
