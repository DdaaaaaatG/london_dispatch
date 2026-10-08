/**
 * useChatScreen — 설계 chat/design/functions.md §3 · §4 F-CH-02 · F-CH-10 · F-CH-16 ~ F-CH-30 · F-CH-33 · F-CH-40 · F-CH-41 · design/actions.md F-CH-50 (ChatScreen 50줄 한계 때문에 조립을 분리)
 * 요구: R-CHAT-001 · 003 · 004 · 005 · 006 · 007 · 008 · 010 · 011 · 012 · 013
 * 화면 상태는 이 훅 하나가 한 곳(화면 최상위)에 모은다: 대화 상태(useChatLoader) · 스크롤(useAutoScroll · useScrollMemory) ·
 * 쓰기(useWriteFailure · useMessageWrites) · 시트(useChatSheets) · 읽기 전용 전환(useAccessRevoked). 단방향 흐름이다.
 * 전이 규칙은 ui/src/state/chat.ts 리듀서가 소유한다 — 여기에 다시 쓰지 않는다.
 * S6(design/lock.md): ROOM_LOCKED 는 잠금 관문(useRoomLockGate)의 onRoomLocked 로 수렴한다 — 읽기는 useChatLoader, 쓰기는 useWriteFailure 가 부른다. 요구 R-LOCK-006.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { Dispatch, RefObject } from 'react'
import type { RoomSummary, SpeakTarget } from '@shared/types'
import { useAutoScroll } from '@/components/hooks/useAutoScroll'
import { clearLastRoomId, loadScrollOffset, saveLastRoomId } from '@/components/utils/storage'
import { type ChatAction, type ChatState, canAutoLoadOlder } from '@/state/chat'
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
  /** S6: 어느 요청이든 ROOM_LOCKED 를 받았다(F-CH-64). 껍데기 ChatScreen 이 이 화면을 언마운트하고 입장을 다시 요구한다 */
  onRoomLocked: () => void
  /** S6: 첫 로드 성공(D-55 조용한 재입장 횟수 리셋, F-CH-70) */
  onRoomOpened: () => void
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

/** F-CH-20: 수정이 반영되면(true) 그 말풍선의 「수정」으로 포커스를 요청한다(F-CH-50) */
const useSaveEditAndFocus = (
  saveEdit: (messageId: number, text: string) => Promise<boolean>,
  requestEditFocus: (messageId: number) => void,
) =>
  useCallback(
    (messageId: number, text: string): void => {
      void saveEdit(messageId, text).then(isSaved => {
        if (isSaved) requestEditFocus(messageId)
      })
    },
    [saveEdit, requestEditFocus],
  )

/**
 * F-CH-50(S3e): 편집기가 닫힌 뒤 그 말풍선의 「수정」으로 포커스를 돌려 달라는 요청(editFocusId)을 들고 있다가,
 * 그 버튼 줄이 소비하면(onEditFocusDone) 비운다. 「수정」이 disabled 라 포커스를 못 받았으면(예: 자동 응답 생성 중 편집 취소 — S3d D-17)
 * 히스토리 log 로 대신한다(focusLog, 빈 방이면 ‹)
 */
const useEditFocusReturn = (focusLog: () => void) => {
  const [editFocusId, setEditFocusId] = useState<number | null>(null)
  const requestEditFocus = useCallback((messageId: number): void => setEditFocusId(messageId), [])
  const onEditFocusDone = useCallback(
    (isFocused: boolean): void => {
      if (!isFocused) focusLog()
      setEditFocusId(null)
    },
    [focusLog],
  )
  return { editFocusId, requestEditFocus, onEditFocusDone }
}

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

/** F-CH-29: 쓰기 → 읽기 전용 전환이면 숨은 상태(시트·쓰기 팻말·편집)를 정리하고 포커스를 ‹ 로 */
const useRevokeCleanup = (
  canWrite: boolean,
  closeSheet: () => void,
  dispatch: Dispatch<ChatAction>,
  backButtonRef: RefObject<HTMLButtonElement | null>,
): void =>
  useAccessRevoked(canWrite, () => {
    closeSheet()
    dispatch({ type: 'writeAccessRevoked' })
    backButtonRef.current?.focus()
  })

/**
 * 포커스 복귀 묶음: 히스토리 log(F-CH-30) · 재조회 뒤 log(F-CH-41) · 편집 뒤 「수정」(F-CH-50) · 방 사라짐 시 목록 복귀(F-CH-33).
 * 훅 호출 순서(= effect 순서)는 분리 전과 같다
 */
const useChatFocus = (
  loader: UseChatLoaderResult,
  autoScroll: ReturnType<typeof useAutoScroll>,
  backButtonRef: RefObject<HTMLButtonElement | null>,
  onBack: () => void,
) => {
  const focusLog = useFocusLog(autoScroll.containerRef, backButtonRef)
  const requestLogFocus = useLogFocusAfterCommit(loader.state.phase, focusLog)
  const edit = useEditFocusReturn(focusLog)
  const onRoomGone = useRoomGone(onBack)
  return { focusLog, requestLogFocus, onRoomGone, ...edit }
}

/** 쓰기 6종과 시트, 인증 실패 전환(F-CH-16 · F-CH-29 · F-CH-30) */
const useChatWrites = (
  options: UseChatScreenOptions,
  loader: UseChatLoaderResult,
  autoScroll: ReturnType<typeof useAutoScroll>,
  backButtonRef: RefObject<HTMLButtonElement | null>,
) => {
  const { room, viewer, onBack, onAuthFailure, onRoomRenamed, onRoomLocked } = options
  const { dispatch, getState, isActive, loadInitial } = loader
  const { toast, handleWriteFailure, showNotice } = useWriteFailure(onAuthFailure, onRoomLocked)
  const focus = useChatFocus(loader, autoScroll, backButtonRef, onBack)
  const writes = useMessageWrites({
    roomId: room.id,
    dispatch,
    getState,
    isActive,
    isNearBottom: autoScroll.isNearBottom,
    onFailure: handleWriteFailure,
    onRoomGone: focus.onRoomGone,
  })
  const sheets = useChatSheets({
    room,
    getState,
    dispatch,
    isActive,
    loadInitial,
    removeMessage: writes.removeMessage,
    regenerateMessage: writes.regenerateMessage,
    requestLogFocus: focus.requestLogFocus,
    requestEditFocus: focus.requestEditFocus,
    handleWriteFailure,
    showNotice,
    onRoomGone: focus.onRoomGone,
    focusLog: focus.focusLog,
    onBack,
    onRoomRenamed,
  })
  useRevokeCleanup(viewer.canWrite, sheets.closeSheet, dispatch, backButtonRef)
  const saveEdit = useSaveEditAndFocus(writes.saveEdit, focus.requestEditFocus)
  const retrySpeak = useRetrySpeak(writes.speakAs, focus.focusLog)
  const editFocus = { editFocusId: focus.editFocusId, onEditFocusDone: focus.onEditFocusDone }
  return {
    toast,
    send: writes.send,
    speakAs: writes.speakAs,
    retrySpeak,
    saveEdit,
    sheets,
    editFocus,
  }
}

export const useChatScreen = (options: UseChatScreenOptions) => {
  const { room, onBack, onRoomLocked, onRoomOpened } = options
  const loader = useChatLoader(room.id, { onRoomLocked, onRoomOpened })
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
