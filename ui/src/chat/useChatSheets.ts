/**
 * useChatSheets — 설계 chat/design/functions.md §4.2 F-CH-18 · 19 · 21 · 22 · 23 · 24 · 25 · 26 · 27 · 28 (50줄 한계 때문에 ChatScreen 에서 분리)
 * 요구: R-CHAT-001 · R-CHAT-007 · R-CHAT-011
 * 열린 시트(sheet) 상태와 시트에서 일어나는 동작(말풍선 메뉴 · 수정 · 삭제 확인 · ⋯ 방 메뉴 · 이름 변경 · 방 삭제)을 조립한다.
 * 쓰기 대기 중(writing · roomBusy)에는 메뉴를 열지 않는다(D-10) — 그래서 쓰기는 화면 전체에서 한 번에 하나다.
 * 시트를 연 채 토스트를 띄우지 않는다(D-7): 이름 변경의 비인증 실패만 시트 안 문구로, 그 밖 실패는 시트를 닫은 뒤 토스트로 알린다.
 */
import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Message, RoomSummary } from '@shared/types'
import { type ApiError, isAuthFailure } from '@/api'
import { clearLastRoomId } from '@/components/utils/storage'
import type { ChatAction, ChatState } from '@/state/chat'
import type { ChatSheet } from './components/ChatSheets'
import { type WriteAction, writeErrorText } from './labels'
import type { RemoveResult } from './useMessageWrites'
import { useRoomActions } from './useRoomActions'

type SetSheet = Dispatch<SetStateAction<ChatSheet | null>>

export type UseChatSheetsOptions = {
  room: RoomSummary
  getState: () => ChatState
  dispatch: Dispatch<ChatAction>
  isActive: () => boolean
  loadInitial: () => Promise<void>
  removeMessage: (messageId: number) => Promise<RemoveResult>
  handleWriteFailure: (error: ApiError, action: WriteAction) => void
  /** 히스토리 스크롤 박스로 포커스(없으면 ‹) */
  focusLog: () => void
  onBack: () => void
  onRoomRenamed: (room: RoomSummary) => void
}

/** 요청 없이 시트만 바꾸는 방 쪽 동작: ⋯ 방 메뉴 열기 · 이름 변경 · 방 삭제 확인으로 넘어가기 (F-CH-24 · F-CH-25) */
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
  const askDeleteRoom = useCallback((): void => setSheet({ kind: 'confirmDeleteRoom' }), [setSheet])
  return { openRoomMenu, askRename, askDeleteRoom }
}

type RoomSheetsOptions = Pick<
  UseChatSheetsOptions,
  'room' | 'getState' | 'isActive' | 'handleWriteFailure' | 'onBack' | 'onRoomRenamed'
> & { setSheet: SetSheet }

/** ⋯ 방 메뉴 · 이름 변경 · 방 삭제 확인 (F-CH-24 ~ F-CH-27) */
const useRoomSheets = (options: RoomSheetsOptions) => {
  const { room, getState, isActive, handleWriteFailure, onBack, onRoomRenamed, setSheet } = options

  /** 이름 변경의 비인증 실패는 시트 안 문구로, 그 밖에는 시트를 닫고 공통 처리(인증 전환 · 토스트) */
  const onFailure = useCallback(
    (error: ApiError, action: WriteAction): void => {
      if (action === 'renameRoom' && !isAuthFailure(error)) {
        setSheet({ kind: 'rename', errorText: writeErrorText(error, action) })
        return
      }
      setSheet(null)
      handleWriteFailure(error, action)
    },
    [setSheet, handleWriteFailure],
  )
  const actions = useRoomActions({
    room,
    isActive,
    onRenamed: renamed => {
      onRoomRenamed(renamed)
      setSheet(null)
    },
    onDeleted: () => {
      clearLastRoomId()
      onBack()
    },
    onFailure,
  })
  const { isRoomBusy, rename, remove } = actions
  const menu = useRoomMenuHandlers(getState, isRoomBusy, setSheet)
  const saveRename = useCallback((title: string): void => void rename(title), [rename])
  const confirmDeleteRoom = useCallback((): void => void remove(), [remove])

  return { roomBusy: actions.roomBusy, isRoomBusy, ...menu, saveRename, confirmDeleteRoom }
}

type MessageSheetsOptions = Pick<
  UseChatSheetsOptions,
  'getState' | 'dispatch' | 'loadInitial' | 'removeMessage' | 'focusLog'
> & { setSheet: SetSheet; isRoomBusy: () => boolean }

/** 말풍선 메뉴 · 수정 · 메시지 삭제 확인 (F-CH-18 ~ F-CH-23) */
const useMessageSheets = (options: MessageSheetsOptions) => {
  const { getState, dispatch, loadInitial, removeMessage, focusLog, setSheet, isRoomBusy } = options

  /** F-CH-18: 쓰기 대기 중이면 무시(D-10) */
  const openMessageMenu = useCallback(
    (message: Message): void => {
      if (getState().writing !== null || isRoomBusy()) return
      setSheet({ kind: 'messageMenu', message })
    },
    [getState, isRoomBusy, setSheet],
  )
  /** F-CH-19: 시트가 닫히며 편집기가 같은 커밋에서 마운트되어 입력으로 포커스를 가져간다 */
  const startEdit = useCallback(
    (message: Message): void => {
      setSheet(null)
      dispatch({ type: 'editStarted', messageId: message.id })
    },
    [dispatch, setSheet],
  )
  /** F-CH-21 */
  const cancelEdit = useCallback((): void => {
    dispatch({ type: 'editCancelled' })
    focusLog()
  }, [dispatch, focusLog])
  const askDeleteMessage = useCallback(
    (message: Message): void => setSheet({ kind: 'confirmDeleteMessage', message }),
    [setSheet],
  )
  /** F-CH-23: 제거되면 시트를 닫고 히스토리로 포커스(남은 0건 + 더 있음이면 최신 페이지 재로드). 실패는 시트만 닫는다 */
  const confirmDeleteMessage = useCallback(
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

  return { openMessageMenu, startEdit, cancelEdit, askDeleteMessage, confirmDeleteMessage }
}

export const useChatSheets = (options: UseChatSheetsOptions) => {
  const [sheet, setSheet] = useState<ChatSheet | null>(null)
  const closeSheet = useCallback((): void => setSheet(null), [])
  const rooms = useRoomSheets({ ...options, setSheet })
  const messages = useMessageSheets({ ...options, setSheet, isRoomBusy: rooms.isRoomBusy })
  return { sheet, closeSheet, ...rooms, ...messages }
}
