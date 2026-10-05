/**
 * MessageList(B · B0 · B1) — 설계 chat/design/components.md §2.1 · 요구 R-CHAT-002 · R-CHAT-003 · R-CHAT-013
 * 스크롤 박스(role=log) 안에 B0(이전 로드 중·실패)와 말풍선 목록을, 박스 밖에 새 메시지 배지(B1)를 둔다.
 * 스크롤 계산은 useAutoScroll 이 한다. 여기서는 받은 ref·핸들러를 연결만 한다.
 */
import type { RefObject } from 'react'
import type { Message } from '@shared/types'
import type { ApiError } from '@/api'
import { labels } from '@/chat/labels'
import { Bubble } from './Bubble'
import { InlineStatus } from './InlineStatus'
import { NewMessageBadge } from './NewMessageBadge'
import styles from './MessageList.module.css'

export type MessageListProps = {
  /** id 오름차순 */
  messages: readonly Message[]
  /** useAutoScroll 이 준 ref */
  containerRef: RefObject<HTMLDivElement | null>
  /** useAutoScroll 이 준 핸들러 */
  onScroll: () => void
  isLoadingOlder: boolean
  olderError: ApiError | null
  onRetryOlder: () => void
  unseenCount: number
  onShowNewest: () => void
}

type OlderStatusProps = Pick<MessageListProps, 'isLoadingOlder' | 'olderError'> & {
  onRetry: () => void
}

/** B0: 로딩이면 로딩, 아니고 실패면 실패, 둘 다 아니면 없음 */
const OlderStatus = ({ isLoadingOlder, olderError, onRetry }: OlderStatusProps) => {
  if (isLoadingOlder) return <InlineStatus kind="loading" message={labels.olderLoading} />
  if (olderError === null) return null
  return (
    <InlineStatus
      kind="error"
      message={labels.olderError}
      actionLabel={labels.retry}
      onAction={onRetry}
    />
  )
}

export const MessageList = ({
  messages,
  containerRef,
  onScroll,
  isLoadingOlder,
  olderError,
  onRetryOlder,
  unseenCount,
  onShowNewest,
}: MessageListProps) => (
  <div className={styles.wrap}>
    <div
      ref={containerRef}
      className={styles.log}
      role="log"
      aria-live="polite"
      aria-busy={isLoadingOlder}
      aria-label={labels.historyAriaLabel}
      tabIndex={0}
      onScroll={onScroll}
    >
      <OlderStatus isLoadingOlder={isLoadingOlder} olderError={olderError} onRetry={onRetryOlder} />
      <ol className={styles.list}>
        {messages.map(message => (
          <li key={message.id}>
            <Bubble message={message} />
          </li>
        ))}
      </ol>
    </div>
    {unseenCount > 0 && (
      <NewMessageBadge
        label={labels.newMessages}
        ariaLabel={labels.newMessagesAriaLabel}
        onClick={onShowNewest}
      />
    )}
  </div>
)
