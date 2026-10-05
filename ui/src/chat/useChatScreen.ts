/**
 * useChatScreen — 설계 chat/design/functions.md §3 · §4 F-CH-02 · F-CH-10 · F-CH-16 ~ F-CH-30 (ChatScreen 50줄 한계 때문에 조립을 분리)
 * 요구: R-CHAT-001 · 003 · 004 · 006 · 007 · 008 · 010 · 011
 * 화면 상태는 이 훅 하나가 한 곳(화면 최상위)에 모은다: 대화 상태(useChatLoader) · 스크롤(useAutoScroll · useScrollMemory) ·
 * 쓰기(useWriteFailure · useMessageWrites) · 시트(useChatSheets) · 읽기 전용 전환(useAccessRevoked). 단방향 흐름이다.
 * 전이 규칙은 ui/src/state/chat.ts 리듀서가 소유한다 — 여기에 다시 쓰지 않는다.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { RoomSummary } from '@shared/types'
import { useAutoScroll } from '@/components/hooks/useAutoScroll'
import { clearLastRoomId, loadScrollOffset, saveLastRoomId } from '@/components/utils/storage'
import { canAutoLoadOlder } from '@/state/chat'
import type { Viewer } from '@/state/viewer'
import { useAccessRevoked } from './useAccessRevoked'
import { type UseChatLoaderResult, useChatLoader } from './useChatLoader'
import { useChatSheets } from './useChatSheets'
import { useMessageWrites } from './useMessageWrites'
import { useScrollMemory } from './useScrollMemory'
import { useWriteFailure } from './useWriteFailure'

export type UseChatScreenOptions = {
  room: RoomSummary
  viewer: Viewer
  onBack: () => void
  onAuthFailure: () => void
  onRoomRenamed: (room: RoomSummary) => void
}

/** 스크롤: 저장 거리 복원 · 앞붙임 앵커 · 뒤붙임 자동 스크롤 · 이탈 시 저장, 그리고 새 메시지 배지 동작(F-CH-08) */
const useChatScroll = (roomId: string, loader: UseChatLoaderResult) => {
  const { state, loadOlder, clearUnseen } = loader
  // 복원할 스크롤 거리는 마운트 때 한 번만 읽는다
  const [initialDistance] = useState(() => loadScrollOffset(roomId))
  const autoScroll = useAutoScroll({
    firstId: state.messages[0]?.id ?? null,
    lastId: state.messages[state.messages.length - 1]?.id ?? null,
    initialDistanceFromBottom: initialDistance,
    canAutoLoadOlder: canAutoLoadOlder(state),
    onReachTop: loadOlder,
    onReachBottom: clearUnseen,
  })
  const { scrollToBottom, getDistanceFromBottom } = autoScroll
  useScrollMemory(roomId, getDistanceFromBottom)
  /** F-CH-08 */
  const showNewest = useCallback((): void => {
    scrollToBottom()
    clearUnseen()
  }, [scrollToBottom, clearUnseen])
  return { autoScroll, showNewest }
}

/** F-CH-30: 히스토리 스크롤 박스로 포커스. 없으면(빈 방) ‹ 로 */
const useFocusLog = (
  containerRef: RefObject<HTMLDivElement | null>,
  backButtonRef: RefObject<HTMLButtonElement | null>,
) =>
  useCallback((): void => {
    const target = containerRef.current ?? backButtonRef.current
    target?.focus()
  }, [containerRef, backButtonRef])

/** F-CH-20: 수정이 반영되면(true) 히스토리로 포커스한다 */
const useSaveEditAndFocus = (
  saveEdit: (messageId: number, text: string) => Promise<boolean>,
  focusLog: () => void,
) =>
  useCallback(
    (messageId: number, text: string): void => {
      void saveEdit(messageId, text).then(isSaved => {
        if (isSaved) focusLog()
      })
    },
    [saveEdit, focusLog],
  )

/** 쓰기 6종과 시트, 인증 실패 전환(F-CH-16 · F-CH-29 · F-CH-30) */
const useChatWrites = (
  options: UseChatScreenOptions,
  loader: UseChatLoaderResult,
  autoScroll: ReturnType<typeof useAutoScroll>,
  backButtonRef: RefObject<HTMLButtonElement | null>,
) => {
  const { room, viewer, onBack, onAuthFailure, onRoomRenamed } = options
  const { dispatch, getState, isActive, loadInitial } = loader
  const { toast, handleWriteFailure } = useWriteFailure(onAuthFailure)
  const { containerRef, isNearBottom } = autoScroll

  const focusLog = useFocusLog(containerRef, backButtonRef)
  const writes = useMessageWrites({
    roomId: room.id,
    dispatch,
    getState,
    isActive,
    isNearBottom,
    onFailure: handleWriteFailure,
  })
  const sheets = useChatSheets({
    room,
    getState,
    dispatch,
    isActive,
    loadInitial,
    removeMessage: writes.removeMessage,
    handleWriteFailure,
    focusLog,
    onBack,
    onRoomRenamed,
  })
  const { closeSheet } = sheets
  // F-CH-29: 쓰기 → 읽기 전용 전환이면 숨은 상태를 정리하고 포커스를 ‹ 로
  useAccessRevoked(viewer.canWrite, () => {
    closeSheet()
    dispatch({ type: 'writeAccessRevoked' })
    backButtonRef.current?.focus()
  })
  const saveEdit = useSaveEditAndFocus(writes.saveEdit, focusLog)
  return { toast, send: writes.send, saveEdit, sheets }
}

export const useChatScreen = (options: UseChatScreenOptions) => {
  const { room, onBack } = options
  const loader = useChatLoader(room.id)
  const { loadInitial } = loader
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const { autoScroll, showNewest } = useChatScroll(room.id, loader)
  const write = useChatWrites(options, loader, autoScroll, backButtonRef)

  // F-CH-02: 마지막 본 방 기록 → ‹ 포커스 → 첫 로드.
  // 화면이 커밋되는 순간 요청이 이미 나가 있도록 layout effect 로 둔다(자동 진입은 비동기 콜백에서 커밋되어
  // 패시브 effect 가 한 박자 늦게 돌 수 있다)
  useLayoutEffect(() => {
    saveLastRoomId(room.id)
    backButtonRef.current?.focus()
    void loadInitial()
  }, [room.id, loadInitial])

  /** F-CH-10: 마지막으로 본 화면이 목록이 되므로 기록을 지운다. 삭제 실패는 storage 가 삼킨다 */
  const back = (): void => {
    clearLastRoomId()
    onBack()
  }

  return { loader, autoScroll, showNewest, write, backButtonRef, back }
}
