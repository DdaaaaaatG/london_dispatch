/**
 * useLockSheets — 설계 chat/design/lock.md LK §3 F-CH-74 · F-CH-75 · F-CH-77 · F-CH-79 (useChatSheets 400줄·50줄 한계 때문에 분리)
 * 요구: R-CHAT-001 · R-CHAT-010 · R-LOCK-002 · R-LOCK-004
 * ⋯ 방 메뉴 「잠금」 이후의 시트 전환(걸기 / 잠금 시트 / 바꾸기 / 풀기 확인)과, 걸기·바꾸기·풀기 성공 뒤 처리(증명 보관 → 방 갱신 → 시트 닫기 → 토스트)를 맡는다.
 * 비밀번호 원문은 여기에 오지 않는다(PromptSheet 로컬 값이 래퍼로 바로 간다). 증명은 state/roomKeys.ts 한 곳에만 둔다.
 */
import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { RoomSummary, SetRoomPasswordResponse } from '@shared/types'
import type { ToastTone } from '@/components/ui/Toast'
import type { ChatState } from '@/state/chat'
import { forgetRoomKey, saveRoomKey } from '@/state/roomKeys'
import type { ChatSheet } from './components/ChatSheets'
import { labels } from './labels'

export type SetSheet = Dispatch<SetStateAction<ChatSheet | null>>

type LockMenuOptions = {
  room: RoomSummary
  getState: () => ChatState
  isRoomBusy: () => boolean
  setSheet: SetSheet
}

/**
 * F-CH-74: 방 메뉴 「잠금」. F-CH-24 와 같은 가드(UI 로는 도달 불가한 방어적 비행동).
 * 안 잠긴 방 → 「비밀번호 걸기」 시트, 잠긴 방 → 잠금 시트. F-CH-75: 잠금 시트의 두 항목
 */
export const useLockMenuHandlers = ({ room, getState, isRoomBusy, setSheet }: LockMenuOptions) => {
  const isLockedRoom = room.locked
  const openLock = useCallback((): void => {
    if (getState().writing !== null || isRoomBusy()) return
    setSheet(
      isLockedRoom ? { kind: 'lockMenu' } : { kind: 'password', mode: 'set', errorText: null },
    )
  }, [isLockedRoom, getState, isRoomBusy, setSheet])
  const askChangePassword = useCallback(
    (): void => setSheet({ kind: 'password', mode: 'change', errorText: null }),
    [setSheet],
  )
  const askUnlock = useCallback((): void => setSheet({ kind: 'confirmUnlock' }), [setSheet])
  return { openLock, askChangePassword, askUnlock }
}

type PasswordResultsOptions = {
  setSheet: SetSheet
  onRoomRenamed: (room: RoomSummary) => void
  showNotice: (message: string, tone: ToastTone) => void
}

/**
 * F-CH-77: 걸기·바꾸기 성공 — 증명 보관 → 방 갱신(locked true) → 시트 닫기 → 성공 토스트.
 * F-CH-79: 풀기 성공 — 증명 삭제 → 방 갱신(locked false) → 시트 닫기 → 성공 토스트. 시트를 먼저 닫은 뒤 토스트를 띄운다(D-7)
 */
export const usePasswordResults = ({
  setSheet,
  onRoomRenamed,
  showNotice,
}: PasswordResultsOptions) => {
  const onPasswordSet = useCallback(
    (result: SetRoomPasswordResponse, wasLocked: boolean): void => {
      saveRoomKey(result.room.id, result.entryKey)
      onRoomRenamed(result.room)
      setSheet(null)
      showNotice(wasLocked ? labels.passwordChanged : labels.roomLockedNotice, 'success')
    },
    [setSheet, onRoomRenamed, showNotice],
  )
  const onPasswordCleared = useCallback(
    (room: RoomSummary): void => {
      forgetRoomKey(room.id)
      onRoomRenamed(room)
      setSheet(null)
      showNotice(labels.unlockedNotice, 'success')
    },
    [setSheet, onRoomRenamed, showNotice],
  )
  return { onPasswordSet, onPasswordCleared }
}
