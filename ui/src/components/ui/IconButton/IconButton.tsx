/**
 * 공용 IconButton — 설계 rooms/design/components.md §1.3 · 요구 R-CHAT-001 · R-CHAT-013
 * 인라인 SVG(stroke 1.25, aria-hidden). 접근성 이름은 필수 ariaLabel(화면 labels.ts)이 준다.
 */
import type { Ref } from 'react'
import styles from './IconButton.module.css'

export type IconButtonProps = {
  /** S1 은 back 하나. S2 에서 more 추가 */
  icon: 'back'
  ariaLabel: string
  onClick: () => void
  buttonRef?: Ref<HTMLButtonElement>
}

const ICON_PATHS = {
  back: 'M15 5l-7 7 7 7',
} as const

export const IconButton = ({ icon, ariaLabel, onClick, buttonRef }: IconButtonProps) => (
  <button
    type="button"
    ref={buttonRef}
    className={styles.root}
    aria-label={ariaLabel}
    onClick={() => onClick()}
  >
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICON_PATHS[icon]} />
    </svg>
  </button>
)
