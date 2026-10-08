/**
 * useChatSheets — 설계 chat/design/functions.md §4.2 F-CH-21 · 23 · 24 · 25 · 26 · 27 · 28 · design/actions.md §5 F-CH-46 ~ F-CH-49 · design/memory.md ME §3 F-CH-53 · F-CH-60 (50줄 한계 때문에 ChatScreen 에서 분리)
 * 요구: R-CHAT-001 · R-CHAT-007 · R-CHAT-010 · R-CHAT-011 · R-CHAT-012 🔒 · R-LOCK-002 · R-LOCK-006
 * 열린 시트(sheet) 상태와 말풍선 버튼 줄 동작(수정 · 삭제 확인 · 재작성) · ⋯ 방 메뉴 · 이름 변경 · 방 삭제를 조립한다.
 * S3e: 말풍선 메뉴 시트는 없다. 버튼 줄이 startEdit · regenerateFromActions · askDeleteMessage 를 messageActions 로 직접 부른다(참조 안정 — memo 격리).
 * 쓰기 대기 중 · 다른 편집 중 · 방 이름 변경/삭제 중에는 시작하지 않는다(D-10 · D-27, 버튼 줄 잠금과 같은 판정) — 그래서 쓰기는 화면 전체에서 한 번에 하나다.
 * 시트를 연 채 토스트를 띄우지 않는다(D-7): 이름 변경의 비인증 실패만 시트 안 문구로, 그 밖 실패는 시트를 닫은 뒤 토스트로 알린다.
 * S4: 장기기억 시트(kind 'memory')의 상태는 시트 지역(useMemorySheet)이라 여기에는 열기·닫기 콜백만 있다. 저장 성공 토스트도 시트를 닫은 뒤 띄운다.
 * S6(design/lock.md): ⋯ 「잠금」 → 걸기 / 잠금 시트 / 바꾸기 / 풀기 확인. 시트 전환·성공 뒤 처리는 useLockSheets 가 맡고, 여기서는 실패 갈래(F-CH-80)와 방 삭제 뒤 증명 삭제(F-CH-81)를 더한다.
 */
import { useCallback, useMemo, useState } from 'react'
import type { Dispatch } from 'react'
import type { Message, RoomSummary } from '@shared/types'
import { type ApiError, isAuthFailure } from '@/api'
import type { ToastTone } from '@/components/ui/Toast'
import { clearLastRoomId } from '@/components/utils/storage'
import { type ChatAction, type ChatState, canSpeak, chatReducer } from '@/state/chat'
import { forgetRoomKey } from '@/state/roomKeys'
import type { BubbleActionHandlers } from './components/BubbleActions'
import type { ChatSheet } from './components/ChatSheets'
import { labels, type WriteAction, writeErrorText } from './labels'
import { type SetSheet, useLockMenuHandlers, usePasswordResults } from './useLockSheets'
import type { RegenerateResult, RemoveResult } from './useMessageWrites'
import { useRoomActions } from './useRoomActions'

export type UseChatSheetsOptions = {
  room: RoomSummary
  getState: () => ChatState
  dispatch: Dispatch<ChatAction>
  isActive: () => boolean
  loadInitial: () => Promise<void>
  removeMessage: (messageId: number) => Promise<RemoveResult>
  /** S3: F-CH-34 */
  regenerateMessage: (messageId: number) => Promise<RegenerateResult>
  /** S3: 다음 ready 커밋 뒤 히스토리로 포커스(F-CH-41) */
  requestLogFocus: () => void
  /** S3e: 편집기가 닫힌 뒤 그 말풍선의 「수정」으로 포커스(F-CH-50) */
  requestEditFocus: (messageId: number) => void
  handleWriteFailure: (error: ApiError, action: WriteAction) => void
  /** S4: 실패가 아닌 안내(장기기억 저장 성공) 토스트(F-CH-16 확장) */
  showNotice: (message: string, tone: ToastTone) => void
  /** S4: 장기기억 조회·저장 중 방이 사라졌다 — 목록 복귀(F-CH-33) */
  onRoomGone: () => void
  /** 히스토리 스크롤 박스로 포커스(없으면 ‹) */
  focusLog: () => void
  onBack: () => void
  onRoomRenamed: (room: RoomSummary) => void
}

/** 요청 없이 시트만 바꾸는 방 쪽 동작: ⋯ 방 메뉴 열기 · 이름 변경 · 장기기억 · 방 삭제 확인으로 넘어가기 (F-CH-24 · F-CH-25 · F-CH-53) */
const useRoomMenuHandlers = (
  getState: () => ChatState,
  isRoomBusy: () => boolean,
  setSheet: SetSheet,
) => {
  /** F-CH-24: 쓰기 대기 중이면 무시(⋯ 도 그때는 비활성이다) */
  const openRoomMenu = useCallback((): void => {
    if (getState().writing !== null || isRoomBusy()) return
    setSheet({ kind: 'roomMenu' })
  }, [getState, isRoomBusy, setSheet])
  const askRename = useCallback(
    (): void => setSheet({ kind: 'rename', errorText: null }),
    [setSheet],
  )
  /** F-CH-53: 방 메뉴 「장기기억」. F-CH-24 와 같은 가드. 방 메뉴는 같은 커밋에서 언마운트된다 */
  const openMemory = useCallback((): void => {
    if (getState().writing !== null || isRoomBusy()) return
    setSheet({ kind: 'memory' })
  }, [getState, isRoomBusy, setSheet])
  const askDeleteRoom = useCallback((): void => setSheet({ kind: 'confirmDeleteRoom' }), [setSheet])
  return { openRoomMenu, askRename, openMemory, askDeleteRoom }
}

type RoomSheetsOptions = Pick<
  UseChatSheetsOptions,
  | 'room'
  | 'getState'
  | 'isActive'
  | 'handleWriteFailure'
  | 'showNotice'
  | 'onBack'
  | 'onRoomRenamed'
> & { setSheet: SetSheet }

/**
 * F-CH-80: 방 쪽 실패 갈래. ROOM_LOCKED · 인증 3종은 시트를 닫고 공통 처리(입장 재요구 · 읽기 전용 전환).
 * 그 밖에는 이름 변경(F-CH-26)과 비밀번호 걸기·바꾸기(E18)만 시트 안 문구로 보이고(입력 유지, mode 유지), 방 삭제·잠금 풀기는 시트를 닫고 토스트(D-50)
 */
const useRoomFailure = (
  setSheet: SetSheet,
  handleWriteFailure: (error: ApiError, action: WriteAction) => void,
) =>
  useCallback(
    (error: ApiError, action: WriteAction): void => {
      if (error.code !== 'ROOM_LOCKED' && !isAuthFailure(error)) {
        if (action === 'renameRoom') {
          setSheet({ kind: 'rename', errorText: writeErrorText(error, action) })
          return
        }
        if (action === 'setRoomPassword') {
          const errorText = writeErrorText(error, action)
          setSheet(current => (current?.kind === 'password' ? { ...current, errorText } : current))
          return
        }
      }
      setSheet(null)
      handleWriteFailure(error, action)
    },
    [setSheet, handleWriteFailure],
  )

/** ⋯ 방 메뉴 · 이름 변경 · 방 삭제 확인 · (S6) 잠금 (F-CH-24 ~ F-CH-27 · F-CH-74 ~ F-CH-81) */
const useRoomSheets = (options: RoomSheetsOptions) => {
  const { room, getState, isActive, handleWriteFailure, showNotice } = options
  const { onBack, onRoomRenamed, setSheet } = options
  const onFailure = useRoomFailure(setSheet, handleWriteFailure)
  const results = usePasswordResults({ setSheet, onRoomRenamed, showNotice })
  const actions = useRoomActions({
    room,
    isActive,
    onRenamed: renamed => {
      onRoomRenamed(renamed)
      setSheet(null)
    },
    // F-CH-81: 삭제(또는 이미 없음) 뒤 그 방의 증명도 지운다
    onDeleted: () => {
      forgetRoomKey(room.id)
      clearLastRoomId()
      onBack()
    },
    ...results,
    onFailure,
  })
  const { isRoomBusy, rename, remove, setPassword, clearPassword } = actions
  const menu = useRoomMenuHandlers(getState, isRoomBusy, setSheet)
  const lock = useLockMenuHandlers({ room, getState, isRoomBusy, setSheet })
  const saveRename = useCallback((title: string): void => void rename(title), [rename])
  const savePassword = useCallback((pw: string): void => void setPassword(pw), [setPassword])
  const confirmUnlock = useCallback((): void => void clearPassword(), [clearPassword])
  const confirmDeleteRoom = useCallback((): void => void remove(), [remove])

  return {
    roomBusy: actions.roomBusy,
    isRoomBusy,
    ...menu,
    ...lock,
    saveRename,
    savePassword,
    confirmUnlock,
    confirmDeleteRoom,
  }
}

type MessageSheetsOptions = Pick<
  UseChatSheetsOptions,
  | 'getState'
  | 'dispatch'
  | 'loadInitial'
  | 'removeMessage'
  | 'regenerateMessage'
  | 'requestLogFocus'
  | 'requestEditFocus'
  | 'focusLog'
> & { setSheet: SetSheet; isRoomBusy: () => boolean }

type IsLocked = () => boolean

/**
 * D-27: 버튼 줄 잠금(isActionLocked)과 같은 판정 — 쓰기 대기 · 생성 중 · 다른 편집 중 · 방 이름 변경/삭제 중.
 * 잠기면 버튼이 disabled 라 정상 경로에서는 걸리지 않는다. 같은 틱 방어용 가드다
 */
const useIsActionLocked = (getState: () => ChatState, isRoomBusy: () => boolean): IsLocked =>
  useCallback((): boolean => !canSpeak(getState()) || isRoomBusy(), [getState, isRoomBusy])

type RegenerateActionOptions = Pick<
  MessageSheetsOptions,
  'loadInitial' | 'regenerateMessage' | 'requestLogFocus'
> & { isLocked: IsLocked }

/**
 * F-CH-48: 「재작성」. confirm·시트 없이 바로 요청한다. 대상이 사라졌거나 목록이 낡았으면 재조회하고,
 * 포커스는 동기로 옮기지 않고 다음 ready 커밋 뒤에 옮기도록 요청만 한다(F-CH-41, 재조회 중에는 log 가 없다).
 * 성공·일반 실패 뒤 포커스는 BubbleActions 가 잠금이 풀릴 때 같은 「재작성」으로 돌린다(F-CH-51)
 */
const useRegenerateAction = (options: RegenerateActionOptions) => {
  const { isLocked, loadInitial, regenerateMessage, requestLogFocus } = options
  return useCallback(
    async (message: Message): Promise<void> => {
      if (isLocked()) return
      const result = await regenerateMessage(message.id)
      if (result.kind === 'removed') {
        if (result.isEmptyWithMore) void loadInitial()
        requestLogFocus()
      } else if (result.kind === 'stale') {
        void loadInitial()
        requestLogFocus()
      }
    },
    [isLocked, loadInitial, regenerateMessage, requestLogFocus],
  )
}

type ConfirmDeleteOptions = Pick<
  MessageSheetsOptions,
  'removeMessage' | 'loadInitial' | 'focusLog' | 'setSheet'
>

/** F-CH-23: 제거되면 시트를 닫고 히스토리로 포커스(남은 0건 + 더 있음이면 최신 페이지 재로드). 실패는 시트만 닫는다 */
const useConfirmDeleteMessage = (options: ConfirmDeleteOptions) => {
  const { removeMessage, loadInitial, focusLog, setSheet } = options
  return useCallback(
    async (message: Message): Promise<void> => {
      const result = await removeMessage(message.id)
      if (result.kind === 'rejected') return
      setSheet(null)
      if (result.kind !== 'removed') return
      focusLog()
      if (result.isEmptyWithMore) void loadInitial()
    },
    [removeMessage, setSheet, focusLog, loadInitial],
  )
}

/** 말풍선 버튼 줄 동작: 수정(F-CH-46) · 삭제 확인(F-CH-47) · 재작성(F-CH-48) · 편집 취소(F-CH-49) · 삭제 실행(F-CH-23) */
const useMessageSheets = (options: MessageSheetsOptions) => {
  const { getState, dispatch, requestEditFocus, setSheet, isRoomBusy } = options
  const isLocked = useIsActionLocked(getState, isRoomBusy)
  const regenerateFromActions = useRegenerateAction({ ...options, isLocked })
  const confirmDeleteMessage = useConfirmDeleteMessage(options)

  /** F-CH-46: 시트 없이 편집기가 같은 커밋에서 마운트되어 입력으로 포커스를 가져간다 */
  const startEdit = useCallback(
    (message: Message): void => {
      if (isLocked()) return
      dispatch({ type: 'editStarted', messageId: message.id })
    },
    [isLocked, dispatch],
  )
  /** F-CH-47: 확인 시트(첫 포커스 취소). 닫히면 BottomSheet 가 열기 전 요소(「삭제」 버튼)로 포커스를 돌린다 */
  const askDeleteMessage = useCallback(
    (message: Message): void => {
      if (isLocked()) return
      setSheet({ kind: 'confirmDeleteMessage', message })
    },
    [isLocked, setSheet],
  )
  /** F-CH-49: 편집이 실제로 닫히면(저장 요청 중 취소 T24 는 무시) 그 말풍선의 「수정」으로 포커스를 요청한다 */
  const cancelEdit = useCallback((): void => {
    const current = getState()
    const editingId = current.editingId
    const next = chatReducer(current, { type: 'editCancelled' })
    dispatch({ type: 'editCancelled' })
    if (editingId !== null && next.editingId === null) requestEditFocus(editingId)
  }, [getState, dispatch, requestEditFocus])

  const messageActions = useMemo<BubbleActionHandlers>(
    () => ({ onEdit: startEdit, onRegenerate: regenerateFromActions, onDelete: askDeleteMessage }),
    [startEdit, regenerateFromActions, askDeleteMessage],
  )

  return {
    startEdit,
    cancelEdit,
    askDeleteMessage,
    confirmDeleteMessage,
    regenerateFromActions,
    messageActions,
  }
}

type MemoryResultsOptions = Pick<
  UseChatSheetsOptions,
  'handleWriteFailure' | 'onRoomGone' | 'showNotice'
> & { setSheet: SetSheet }

/**
 * F-CH-60: 장기기억 시트가 알려 오는 두 결과. 시트를 먼저 닫으므로 토스트가 덮개 아래에 숨지 않는다(D-37).
 * 저장 성공 = 성공 토스트. 인증 3종 = 읽기 전용 전환 + 전환 문구 토스트(F-CH-16), NOT_FOUND = 목록 복귀(토스트 없음, F-CH-33)
 */
const useMemoryResults = (options: MemoryResultsOptions) => {
  const { setSheet, handleWriteFailure, onRoomGone, showNotice } = options
  const memorySaved = useCallback((): void => {
    setSheet(null)
    showNotice(labels.memorySaved, 'success')
  }, [setSheet, showNotice])
  const memoryLeft = useCallback(
    (error: ApiError): void => {
      setSheet(null)
      if (error.code === 'NOT_FOUND') onRoomGone()
      else handleWriteFailure(error, 'memory')
    },
    [setSheet, handleWriteFailure, onRoomGone],
  )
  return { memorySaved, memoryLeft }
}

export const useChatSheets = (options: UseChatSheetsOptions) => {
  const [sheet, setSheet] = useState<ChatSheet | null>(null)
  const closeSheet = useCallback((): void => setSheet(null), [])
  const rooms = useRoomSheets({ ...options, setSheet })
  const messages = useMessageSheets({ ...options, setSheet, isRoomBusy: rooms.isRoomBusy })
  const memory = useMemoryResults({ ...options, setSheet })
  return { sheet, closeSheet, ...rooms, ...messages, ...memory }
}
