/**
 * chat(대화) 화면 — 설계 chat/design.md §2~§10 · design/functions.md §3 · §4 F-CH-01 · 11 · 요구 R-CHAT-001 ~ 013(S2 범위) · R-ROOMS-004
 * 상태 전이는 ui/src/state/chat.ts 리듀서, 요청·스크롤·시트는 useChatScreen 이 조립한 훅들이 한다. 여기서는 렌더만 한다.
 * 토큰이 없으면(viewer.canWrite === false) 쓰기 UI(⋯ 메뉴 · 하단 바 · 말풍선 메뉴 · 시트 · 인라인 수정)는 렌더하지 않는다(숨김 금지).
 * 화면은 토큰을 읽지도 저장하지도 않는다. 인증 실패는 onAuthFailure 로 App 에 알려 읽기 전용으로 전환된다.
 */
import type { RefObject } from 'react'
import type { Message, RoomSummary } from '@shared/types'
import { StateView } from '@/components/ui/StateView'
import { Toast } from '@/components/ui/Toast'
import { type ChatState, canSend } from '@/state/chat'
import type { Viewer } from '@/state/viewer'
import { ChatSheets } from './components/ChatSheets'
import { ChatTopBar } from './components/ChatTopBar'
import { Composer } from './components/Composer'
import { MessageList } from './components/MessageList'
import { ReadOnlyNotice } from './components/ReadOnlyNotice'
import { errorDetail, labels } from './labels'
import styles from './styles/ChatScreen.module.css'
import { useChatScreen } from './useChatScreen'

export type ChatScreenProps = {
  /** rooms 목록에서 고른 방(단건 조회 엔드포인트 없음) */
  room: RoomSummary
  viewer: Viewer
  onBack: () => void
  /** 쓰기 결과가 인증 실패다(App 이 읽기 전용으로 전환한다) */
  onAuthFailure: () => void
  /** 이름 변경 응답. App 이 보는 중인 방 정보를 바꾼다 */
  onRoomRenamed: (room: RoomSummary) => void
}

type HistoryProps = {
  state: ChatState
  canWrite: boolean
  containerRef: RefObject<HTMLDivElement | null>
  onScroll: () => void
  onRetryInitial: () => void
  onRetryOlder: () => void
  onShowNewest: () => void
  onOpenMenu: (message: Message) => void
  onSaveEdit: (messageId: number, text: string) => void
  onCancelEdit: () => void
}

/** F-CH-11: 판정 순서 error → loading → data → empty. 쓰기 UI(말풍선 메뉴·편집기)는 canWrite 일 때만 연결한다 */
const renderHistory = (props: HistoryProps) => {
  const { state, canWrite } = props
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
      onOpenMenu={canWrite ? props.onOpenMenu : undefined}
      editingId={canWrite ? state.editingId : null}
      isEditSaving={state.writing?.kind === 'edit'}
      onSaveEdit={props.onSaveEdit}
      onCancelEdit={props.onCancelEdit}
    />
  )
}

type SheetLayerProps = {
  room: RoomSummary
  state: ChatState
  sheets: ReturnType<typeof useChatScreen>['write']['sheets']
}

/** 열린 시트 하나(없으면 렌더하지 않는다). 호출 쪽이 viewer.canWrite 일 때만 이 컴포넌트를 쓴다 */
const SheetLayer = ({ room, state, sheets }: SheetLayerProps) =>
  sheets.sheet && (
    <ChatSheets
      sheet={sheets.sheet}
      room={room}
      writing={state.writing}
      roomBusy={sheets.roomBusy}
      onClose={sheets.closeSheet}
      onStartEdit={sheets.startEdit}
      onAskDeleteMessage={sheets.askDeleteMessage}
      onConfirmDeleteMessage={sheets.confirmDeleteMessage}
      onAskRename={sheets.askRename}
      onSaveRename={sheets.saveRename}
      onAskDeleteRoom={sheets.askDeleteRoom}
      onConfirmDeleteRoom={sheets.confirmDeleteRoom}
    />
  )

type FooterProps = {
  canWrite: boolean
  state: ChatState
  onSend: (text: string, ooc: boolean) => Promise<boolean>
}

/** C 하단 바(쓰기 가능) 또는 D 열람 안내(읽기 전용) 중 하나 */
const Footer = ({ canWrite, state, onSend }: FooterProps) =>
  canWrite ? (
    <Composer canSend={canSend(state)} isSending={state.writing?.kind === 'send'} onSend={onSend} />
  ) : (
    <ReadOnlyNotice text={labels.readOnlyNotice} />
  )

export const ChatScreen = (props: ChatScreenProps) => {
  const { room, viewer } = props
  const screen = useChatScreen(props)
  const { loader, autoScroll, write } = screen
  const { state } = loader
  const { sheets, toast } = write

  return (
    <main className={styles.root} aria-label={labels.screenAriaLabel(room.title)}>
      <ChatTopBar
        room={room}
        onBack={screen.back}
        backButtonRef={screen.backButtonRef}
        onOpenMenu={viewer.canWrite ? sheets.openRoomMenu : undefined}
        isMenuDisabled={state.writing !== null || sheets.roomBusy !== null}
      />
      <section className={styles.history}>
        {renderHistory({
          state,
          canWrite: viewer.canWrite,
          containerRef: autoScroll.containerRef,
          onScroll: autoScroll.onScroll,
          onRetryInitial: loader.retryInitial,
          onRetryOlder: loader.retryOlder,
          onShowNewest: screen.showNewest,
          onOpenMenu: sheets.openMessageMenu,
          onSaveEdit: write.saveEdit,
          onCancelEdit: sheets.cancelEdit,
        })}
      </section>
      {toast && <Toast key={toast.id} message={toast.message} tone={toast.tone} />}
      <Footer canWrite={viewer.canWrite} state={state} onSend={write.send} />
      {viewer.canWrite && <SheetLayer room={room} state={state} sheets={sheets} />}
    </main>
  )
}
