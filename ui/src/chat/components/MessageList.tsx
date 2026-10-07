/**
 * MessageList(B · B0 · B1) — 설계 chat/design/components.md §2.1 · 요구 R-CHAT-002 · R-CHAT-003 · R-CHAT-007 · R-CHAT-013
 * 스크롤 박스(role=log) 안에 B0(이전 로드 중·실패)와 말풍선 목록을, 박스 밖에 새 메시지 배지(B1)를 둔다.
 * 스크롤 계산은 useAutoScroll 이 한다. 여기서는 받은 ref·핸들러를 연결만 한다.
 * S2: editingId 인 메시지는 말풍선 자리에 InlineEditor 를 둔다(읽기 전용이면 호출 쪽이 항상 null 을 넘긴다).
 * S3d: isEditSaveLocked(생성 중)면 열린 편집기의 저장 버튼만 잠근다. onRetrySpeak 은 캐릭터·중립('auto') 대상을 받는다.
 * S3: 메시지 <li> 뒤에 pending(임시·실패 말풍선) <li> 하나를 더 둔다. regeneratingId 인 말풍선은 재작성 중 표시를 붙인다.
 * S3e: actions 는 쓰기 가능일 때만 받는다 — 있으면 같은 <li> 안 Bubble 의 형제로 버튼 줄(BubbleActions)을 둔다(D-28).
 *   없으면(읽기 전용) 버튼 줄 DOM 이 없다. 수정 중인 말풍선과 임시·실패 말풍선 <li> 에는 버튼 줄이 없다.
 */
import type { RefObject } from 'react'
import type { Message, SpeakTarget } from '@shared/types'
import type { ApiError } from '@/api'
import type { PendingSpeak } from '@/state/chat'
import { labels } from '@/chat/labels'
import { Bubble } from './Bubble'
import { BubbleActions, type BubbleActionHandlers } from './BubbleActions'
import { InlineEditor } from './InlineEditor'
import { InlineStatus } from './InlineStatus'
import { NewMessageBadge } from './NewMessageBadge'
import { PendingBubble } from './PendingBubble'
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
  /** 인라인 수정 중인 메시지. 읽기 전용이면 호출 쪽이 항상 null 을 넘긴다 */
  editingId: number | null
  /** state.writing?.kind === 'edit' */
  isEditSaving: boolean
  /** S3d: state.writing?.kind === 'speak' — 편집기 저장 버튼만 잠근다(D-17) */
  isEditSaveLocked: boolean
  onSaveEdit: (messageId: number, text: string) => void
  onCancelEdit: () => void
  // ── S3 ──
  /** 읽기 전용이면 호출 쪽이 항상 null */
  pending: PendingSpeak | null
  /** !canSpeak(state) — 「재시도」 disabled */
  isSpeakLocked: boolean
  onRetrySpeak: (target: SpeakTarget) => void
  /** 재작성 중인 대상 id(없으면 null) */
  regeneratingId: number | null
  // ── S3e ──
  /** 쓰기 가능일 때만. 없으면 버튼 줄 DOM 이 없다 */
  actions?: BubbleActionHandlers | undefined
  /** isActionLocked = !canSpeak(state) || roomBusy !== null — 모든 버튼 줄의 버튼을 잠근다 */
  isActionLocked: boolean
  /** 「재작성」을 둘 말풍선 id(regenerateTargetIdOf). 읽기 전용이면 null */
  regenerateTargetId: number | null
  /** 편집기가 닫혀 「수정」으로 포커스를 돌려받을 메시지 id. 읽기 전용이면 null */
  editFocusId: number | null
  onEditFocusDone: (isFocused: boolean) => void
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

type ActionsLineProps = Pick<
  MessageListProps,
  'actions' | 'isActionLocked' | 'regenerateTargetId' | 'editFocusId' | 'onEditFocusDone'
> & { message: Message }

/** 말풍선 아래 버튼 줄(쓰기 가능일 때만). 「재작성」은 마지막 캐릭터 대사에만, 포커스 요청은 그 말풍선에만 간다 */
const ActionsLine = (props: ActionsLineProps) => {
  const { message, actions, isActionLocked, regenerateTargetId, editFocusId } = props
  if (actions === undefined) return null
  return (
    <BubbleActions
      {...actions}
      message={message}
      canRegenerate={message.id === regenerateTargetId}
      isDisabled={isActionLocked}
      shouldFocusEdit={message.id === editFocusId}
      onEditFocusDone={props.onEditFocusDone}
    />
  )
}

type MessageItemProps = Pick<
  MessageListProps,
  | 'actions'
  | 'isActionLocked'
  | 'regenerateTargetId'
  | 'editFocusId'
  | 'onEditFocusDone'
  | 'isEditSaving'
  | 'isEditSaveLocked'
  | 'onSaveEdit'
  | 'onCancelEdit'
> & { message: Message; isEditing: boolean; isRegenerating: boolean }

/** 목록 한 칸: 수정 중이면 말풍선 자리에 편집기, 아니면 말풍선 + 그 아래 버튼 줄(형제) */
const MessageItem = (props: MessageItemProps) => {
  const { message, isEditing, isRegenerating, isEditSaving, isEditSaveLocked } = props
  return (
    <li>
      {isEditing ? (
        <InlineEditor
          message={message}
          isSaving={isEditSaving}
          isSaveLocked={isEditSaveLocked}
          onSave={text => props.onSaveEdit(message.id, text)}
          onCancel={props.onCancelEdit}
        />
      ) : (
        <>
          <Bubble message={message} isRegenerating={isRegenerating} />
          <ActionsLine {...props} />
        </>
      )}
    </li>
  )
}

type MessageRowsProps = Omit<
  MessageListProps,
  | 'containerRef'
  | 'onScroll'
  | 'isLoadingOlder'
  | 'olderError'
  | 'onRetryOlder'
  | 'unseenCount'
  | 'onShowNewest'
>

/** 메시지 <li> 들 + 끝의 임시·실패 말풍선 <li> 하나(읽기 전용이면 pending 은 항상 null) */
const MessageRows = (props: MessageRowsProps) => {
  const { messages, editingId, regeneratingId, pending, isSpeakLocked, onRetrySpeak, ...item } =
    props
  return (
    <ol className={styles.list}>
      {messages.map(message => (
        <MessageItem
          key={message.id}
          message={message}
          isEditing={message.id === editingId}
          isRegenerating={message.id === regeneratingId}
          {...item}
        />
      ))}
      {pending !== null && (
        <li key="pending">
          <PendingBubble pending={pending} isRetryDisabled={isSpeakLocked} onRetry={onRetrySpeak} />
        </li>
      )}
    </ol>
  )
}

export const MessageList = ({
  containerRef,
  onScroll,
  isLoadingOlder,
  olderError,
  onRetryOlder,
  unseenCount,
  onShowNewest,
  ...rows
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
      <MessageRows {...rows} />
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
