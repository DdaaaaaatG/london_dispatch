/**
 * NewMessageBadge(B1) — 설계 chat/design/components.md §2.4 · 요구 R-CHAT-003 · R-CHAT-013
 * 위쪽을 보는 중 새 메시지가 오면 보이는 배지. Button sm primary + 아래 방향 SVG(aria-hidden).
 * info 톤은 래퍼에서 --btn-* 변수를 덮어써 만든다.
 */
import { Button } from '@/components/ui/Button'
import styles from './NewMessageBadge.module.css'

export type NewMessageBadgeProps = {
  label: string
  ariaLabel: string
  onClick: () => void
}

export const NewMessageBadge = ({ label, ariaLabel, onClick }: NewMessageBadgeProps) => (
  <div className={styles.root}>
    <Button size="sm" variant="primary" ariaLabel={ariaLabel} onClick={onClick}>
      {label}
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 9l7 7 7-7" />
      </svg>
    </Button>
  </div>
)
