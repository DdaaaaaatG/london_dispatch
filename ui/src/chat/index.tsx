/**
 * chat(대화) 화면 — 설계 chat/design.md §2~§10 · design/functions.md §3 · §4 F-CH-01 · 02 · 07 · 08 · 10 · 11
 * 요구: R-CHAT-001 · 002 · 003 · 008 · 010 · 013 · R-ROOMS-004(마지막 본 방 기록·삭제 시점)
 * 상태 전이는 ui/src/state/chat.ts 리듀서, 로드는 useChatLoader, 스크롤은 useAutoScroll 이 한다. 여기서는 조립만 한다.
 * 토큰이 없으면(viewer.canWrite === false) 쓰기 UI(⋯ 메뉴 · 하단 바 · 말풍선 메뉴)는 렌더하지 않는다(숨김 금지).
 */
import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { RoomSummary } from '@shared/types'
import { useAutoScroll } from '@/components/hooks/useAutoScroll'
import { StateView } from '@/components/ui/StateView'
import { clearLastRoomId, loadScrollOffset, saveLastRoomId } from '@/components/utils/storage'
import { type ChatState, canAutoLoadOlder } from '@/state/chat'
import type { Viewer } from '@/state/viewer'
import { ChatTopBar } from './components/ChatTopBar'
import { MessageList } from './components/MessageList'
import { ReadOnlyNotice } from './components/ReadOnlyNotice'
import { errorDetail, labels } from './labels'
import styles from './styles/ChatScreen.module.css'
import { useChatLoader } from './useChatLoader'
import { useScrollMemory } from './useScrollMemory'

export type ChatScreenProps = {
  /** rooms 목록에서 고른 방(단건 조회 엔드포인트 없음) */
  room: RoomSummary
  viewer: Viewer
  onBack: () => void
}

type HistoryProps = {
  state: ChatState
  containerRef: RefObject<HTMLDivElement | null>
  onScroll: () => void
  onRetryInitial: () => void
  onRetryOlder: () => void
  onShowNewest: () => void
}

/** F-CH-11: 판정 순서 error → loading → data → empty */
const renderHistory = (props: HistoryProps) => {
  const { state } = props
  if (state.phase === 'error') {
    return (
      <StateView
        kind="error"
        message={labels.loadError}
        detail={errorDetail(state.error?.code ?? 'INTERNAL')}
        actionLabel={labels.retry}
        onAction={props.onRetryInitial}
      />
    )
  }
  if (state.phase === 'loading') return <StateView kind="loading" message={labels.loading} />
  if (state.messages.length === 0) return <StateView kind="empty" message={labels.empty} />
  return (
    <MessageList
      messages={state.messages}
      containerRef={props.containerRef}
      onScroll={props.onScroll}
      isLoadingOlder={state.isLoadingOlder}
      olderError={state.olderError}
      onRetryOlder={props.onRetryOlder}
      unseenCount={state.unseenCount}
      onShowNewest={props.onShowNewest}
    />
  )
}

export const ChatScreen = ({ room, viewer, onBack }: ChatScreenProps) => {
  const { state, loadInitial, retryInitial, loadOlder, retryOlder, clearUnseen } = useChatLoader(
    room.id,
  )
  // 복원할 스크롤 거리는 마운트 때 한 번만 읽는다
  const [initialDistance] = useState(() => loadScrollOffset(room.id))
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const autoScroll = useAutoScroll({
    firstId: state.messages[0]?.id ?? null,
    lastId: state.messages[state.messages.length - 1]?.id ?? null,
    initialDistanceFromBottom: initialDistance,
    canAutoLoadOlder: canAutoLoadOlder(state),
    onReachTop: loadOlder,
    onReachBottom: clearUnseen,
  })
  const { scrollToBottom, getDistanceFromBottom } = autoScroll

  // F-CH-02: 마지막 본 방 기록 → ‹ 포커스 → 첫 로드.
  // 화면이 커밋되는 순간 요청이 이미 나가 있도록 layout effect 로 둔다(자동 진입은 비동기 콜백에서 커밋되어
  // 패시브 effect 가 한 박자 늦게 돌 수 있다)
  useLayoutEffect(() => {
    saveLastRoomId(room.id)
    backButtonRef.current?.focus()
    void loadInitial()
  }, [room.id, loadInitial])
  useScrollMemory(room.id, getDistanceFromBottom)

  /** F-CH-10: 마지막으로 본 화면이 목록이 되므로 기록을 지운다. 삭제 실패는 storage 가 삼킨다 */
  const back = () => {
    clearLastRoomId()
    onBack()
  }
  /** F-CH-08 */
  const showNewest = () => {
    scrollToBottom()
    clearUnseen()
  }

  return (
    <main className={styles.root} aria-label={labels.screenAriaLabel(room.title)}>
      <ChatTopBar room={room} onBack={back} backButtonRef={backButtonRef} />
      <section className={styles.history}>
        {renderHistory({
          state,
          containerRef: autoScroll.containerRef,
          onScroll: autoScroll.onScroll,
          onRetryInitial: retryInitial,
          onRetryOlder: retryOlder,
          onShowNewest: showNewest,
        })}
      </section>
      {!viewer.canWrite && <ReadOnlyNotice text={labels.readOnlyNotice} />}
    </main>
  )
}
