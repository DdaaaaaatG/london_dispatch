/**
 * StaleNotice(F) — 설계 settings/design/components.md §3.6 · 요구 R-SET-011
 * 저장 중 인증이 만료됐을 때 하단 줄 위에 남는 안내(role=alert, danger). 초안은 보존되고 내보내기로 보관할 수 있다.
 * 문구는 호출 쪽(labels.ts)이 정한다.
 */
import styles from './StaleNotice.module.css'

export type StaleNoticeProps = { message: string }

export const StaleNotice = ({ message }: StaleNoticeProps) => (
  <p className={styles.root} role="alert">
    {message}
  </p>
)
