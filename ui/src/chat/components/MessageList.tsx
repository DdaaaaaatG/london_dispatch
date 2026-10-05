/**
 * MessageList(B · B0 · B1) — 설계 chat/design/components.md §2.1 · 요구 R-CHAT-002 · R-CHAT-003 · R-CHAT-007 · R-CHAT-013
 * 스크롤 박스(role=log) 안에 B0(이전 로드 중·실패)와 말풍선 목록을, 박스 밖에 새 메시지 배지(B1)를 둔다.
 * 스크롤 계산은 useAutoScroll 이 한다. 여기서는 받은 ref·핸들러를 연결만 한다.
 * S2: editingId 인 메시지는 말풍선 자리에 InlineEditor 를 둔다(읽기 전용이면 호출 쪽이 항상 null 을 넘긴다).
 * onOpenMenu 는 쓰기 가능일 때만 받는다 — 없으면 말풍선에 메뉴 핸들러가 붙지 않는다.
 */
import type { RefObject } from 'react'
import type { Message } from '@shared/types'
import type { ApiError } from '@/api'
import { labels } from '@/chat/labels'
import { Bubble } from './Bubble'
import { InlineEditor } from './InlineEditor'
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
  // ── S2 ──
  /** 쓰기 가능일 때만. 없으면 말풍선 메뉴 핸들러가 없다 */
  onOpenMenu?: ((message: Message) => void) | undefined
  /** 인라인 수정 중인 메시지. 읽기 전용이면 호출 쪽이 항상 null 을 넘긴다 */
  editingId: number | null
  /** state.writing?.kind === 'edit' */
  isEditSaving: boolean
  onSaveEdit: (messageId: number, text: string) => void
  onCancelEdit: () => void
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

type MessageItemProps = Pick<
  MessageListProps,
  'onOpenMenu' | 'isEditSaving' | 'onSaveEdit' | 'onCancelEdit'
> & { message: Message; isEditing: boolean }

/** 목록 한 칸: 수정 중이면 말풍선 자리에 편집기, 아니면 말풍선 */
const MessageItem = ({
  message,
  isEditing,
  onOpenMenu,
  isEditSaving,
  onSaveEdit,
  onCancelEdit,
}: MessageItemProps) => (
  <li>
    {isEditing ? (
      <InlineEditor
        message={message}
        isSaving={isEditSaving}
        onSave={text => onSaveEdit(message.id, text)}
        onCancel={onCancelEdit}
      />
    ) : (
      <Bubble message={message} onOpenMenu={onOpenMenu} />
    )}
  </li>
)

export const MessageList = ({
  messages,
  containerRef,
  onScroll,
  isLoadingOlder,
  olderError,
  onRetryOlder,
  unseenCount,
  onShowNewest,
  onOpenMenu,
  editingId,
  isEditSaving,
  onSaveEdit,
  onCancelEdit,
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
          <MessageItem
            key={message.id}
            message={message}
            isEditing={message.id === editingId}
            onOpenMenu={onOpenMenu}
            isEditSaving={isEditSaving}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
          />
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
