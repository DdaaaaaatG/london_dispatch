/**
 * useChatScreen — 설계 chat/design/functions.md §3 · §4 F-CH-02 · F-CH-10 · F-CH-16 ~ F-CH-30 · F-CH-33 · F-CH-40 · F-CH-41 (ChatScreen 50줄 한계 때문에 조립을 분리)
 * 요구: R-CHAT-001 · 003 · 004 · 005 · 006 · 007 · 008 · 010 · 011 · 013
 * 화면 상태는 이 훅 하나가 한 곳(화면 최상위)에 모은다: 대화 상태(useChatLoader) · 스크롤(useAutoScroll · useScrollMemory) ·
 * 쓰기(useWriteFailure · useMessageWrites) · 시트(useChatSheets) · 읽기 전용 전환(useAccessRevoked). 단방향 흐름이다.
 * 전이 규칙은 ui/src/state/chat.ts 리듀서가 소유한다 — 여기에 다시 쓰지 않는다.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { RoomSummary, SpeakTarget } from '@shared/types'
import { useAutoScroll } from '@/components/hooks/useAutoScroll'
import { clearLastRoomId, loadScrollOffset, saveLastRoomId } from '@/components/utils/storage'
import { type ChatState, canAutoLoadOlder } from '@/state/chat'
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
  const { pending } = state
  // 복원할 스크롤 거리는 마운트 때 한 번만 읽는다
  const [initialDistance] = useState(() => loadScrollOffset(roomId))
  const autoScroll = useAutoScroll({
    firstId: state.messages[0]?.id ?? null,
    lastId: state.messages[state.messages.length - 1]?.id ?? null,
    initialDistanceFromBottom: initialDistance,
    canAutoLoadOlder: canAutoLoadOlder(state),
    onReachTop: loadOlder,
    onReachBottom: clearUnseen,
    // F-CH-40: 임시·실패 말풍선이 나타나거나 실패로 바뀔 때 맨 아래 근처였으면 따라간다
    tailKey: pending === null ? null : `${pending.character}:${pending.status}`,
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

/**
 * F-CH-41: 재조회·제거 뒤 포커스. 요청(requestLogFocus)은 state 로 남기고, 다음 ready 커밋에서 소비해 focusLog 한다.
 * 재조회 중(loading)·실패(error)에는 log 가 없으므로 소비하지 않고 기다린다. 요청이 커밋보다 늦어도 놓치지 않게 state 로 둔다
 */
const useLogFocusAfterCommit = (phase: ChatState['phase'], focusLog: () => void) => {
  const [requested, setRequested] = useState(0)
  const handledRef = useRef(0)
  useLayoutEffect(() => {
    if (phase !== 'ready' || requested === handledRef.current) return
    handledRef.current = requested
    focusLog()
  }, [phase, requested, focusLog])
  return useCallback((): void => setRequested(count => count + 1), [])
}

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

/**
 * F-CH-32(S3d): 실패 말풍선의 「재시도」. 중립('auto')은 돌아갈 캐릭터 버튼이 없으므로,
 * 「재시도」 버튼이 언마운트되기 전에 히스토리 log 로 포커스를 옮긴다(D-19). 캐릭터는 F-CH-38 이 같은 캐릭터 버튼으로 돌린다
 */
const useRetrySpeak = (speakAs: (target: SpeakTarget) => Promise<void>, focusLog: () => void) =>
  useCallback(
    (target: SpeakTarget): void => {
      if (target === 'auto') focusLog()
      void speakAs(target)
    },
    [speakAs, focusLog],
  )

/** F-CH-33: 생성 중 방이 사라졌다 — 방 삭제 성공과 같은 흐름(목록 복귀) */
const useRoomGone = (onBack: () => void) =>
  useCallback((): void => {
    clearLastRoomId()
    onBack()
  }, [onBack])

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
  const requestLogFocus = useLogFocusAfterCommit(loader.state.phase, focusLog)
  const onRoomGone = useRoomGone(onBack)
  const writes = useMessageWrites({
    roomId: room.id,
    dispatch,
    getState,
    isActive,
    isNearBottom,
    onFailure: handleWriteFailure,
    onRoomGone,
  })
  const sheets = useChatSheets({
    room,
    getState,
    dispatch,
    isActive,
    loadInitial,
    removeMessage: writes.removeMessage,
    regenerateMessage: writes.regenerateMessage,
    requestLogFocus,
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
  const retrySpeak = useRetrySpeak(writes.speakAs, focusLog)
  return { toast, send: writes.send, speakAs: writes.speakAs, retrySpeak, saveEdit, sheets }
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
