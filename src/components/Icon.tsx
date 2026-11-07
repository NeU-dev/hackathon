import type { PaperStatus } from '../types'

/** アイコンは 24 の枠、線の太さ 1.75 でそろえる */
const PATHS = {
  back: 'M14.5 5.5 8 12l6.5 6.5',
  // 上下に裏返しても位置がずれないよう、24 の枠のまん中（12）をはさんで上下対称に
  chevron: 'M6.5 9.25 12 14.75l5.5-5.5',
  plus: 'M12 5v14M5 12h14',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  pencil: 'M4.5 19.5l1-4.2L15.8 5a1.8 1.8 0 0 1 2.5 0l.7.7a1.8 1.8 0 0 1 0 2.5L8.7 18.5l-4.2 1Z M13.8 7l3.2 3.2',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Z M12 7.5V12l3 2',
  check: 'M5 12.5l4.5 4.5L19 7',
  tray: 'M4 13.5h4.2l1.5 2.2h4.6l1.5-2.2H20 M4 13.5 6.2 6h11.6L20 13.5V19H4v-5.5Z',
  sheet: 'M7 3.5h7.5L18 7v13.5H7V3.5Z M14.5 3.5V7H18 M9.5 11.5h6M9.5 14.5h6M9.5 17.5h4',
  plane: 'M21 3.5 3 10.8l6.6 2.6L21 3.5ZM21 3.5l-7.4 17-4-7.1M9.6 13.4v5.2l2.6-2.6',
  calendar: 'M4.5 6.5h15v13h-15v-13Z M4.5 10.5h15 M8.5 4v4M15.5 4v4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.07-.4.1-.8.1-1.2Z',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

export const STATUS_ICON: Record<PaperStatus, IconName> = {
  writing: 'pencil',
  waiting: 'clock',
  done: 'check',
  shelved: 'tray',
}
