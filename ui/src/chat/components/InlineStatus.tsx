/**
 * InlineStatus(B0) — 설계 chat/design/components.md §2.3 · 요구 R-CHAT-003
 * 이전 페이지 로드 중·실패를 한 줄로 보인다. loading = role=status, error = role=alert.
 * error 이고 actionLabel·onAction 이 둘 다 있으면 Button sm secondary.
 */
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/utils/cx'
import styles from './InlineStatus.module.css'

export type InlineStatusProps = {
  kind: 'loading' | 'error'
  message: string
  actionLabel?: string
  onAction?: () => void
}

export const InlineStatus = ({ kind, message, actionLabel, onAction }: InlineStatusProps) => (
  <div className={cx(styles.root, styles[kind])} role={kind === 'error' ? 'alert' : 'status'}>
    <span>{message}</span>
    {kind === 'error' && actionLabel && onAction && (
      <Button size="sm" variant="secondary" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
)
