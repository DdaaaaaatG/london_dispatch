/**
 * ReadOnlyNotice(D) — 설계 chat/design/components.md §2.5 · 요구 R-CHAT-008 · R-CHAT-013
 * 토큰 없는 방문자에게 열람 전용임을 알리는 한 줄. 문구는 호출 쪽(labels.ts)이 정한다.
 */
import styles from './ReadOnlyNotice.module.css'

export type ReadOnlyNoticeProps = { text: string }

export const ReadOnlyNotice = ({ text }: ReadOnlyNoticeProps) => (
  <p className={styles.root} role="note">
    {text}
  </p>
)
