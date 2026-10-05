/**
 * 공용 StateView — 설계 rooms/design/components.md §1.4 · 요구 R-ROOMS-003 · R-CHAT-002 · R-CHAT-003
 * loading·empty = role=status, error = role=alert. 버튼은 actionLabel 과 onAction 이 둘 다 있을 때만.
 * 문구는 호출 쪽(화면 labels.ts)이 정한다.
 */
import { Button } from '@/components/ui/Button'
import styles from './StateView.module.css'

export type StateViewProps = {
  kind: 'loading' | 'empty' | 'error'
  /** 한 줄 제목 */
  message: string
  /** error 상세 한 줄 */
  detail?: string
  /** error 버튼 글자 */
  actionLabel?: string
  onAction?: () => void
}

export const StateView = ({ kind, message, detail, actionLabel, onAction }: StateViewProps) => (
  <div className={styles.root} role={kind === 'error' ? 'alert' : 'status'}>
    <p className={styles.message}>{message}</p>
    {detail && <p className={styles.detail}>{detail}</p>}
    {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
  </div>
)
