/**
 * useRoomActions — 설계 chat/design/functions.md §4.2 F-CH-26 · F-CH-27 · design/lock.md F-CH-76 · F-CH-78 · F-CH-84 (50줄 한계 때문에 ChatScreen 에서 분리)
 * 요구: R-CHAT-001 · R-ROOM-003 · R-ROOM-004 · R-ROOMS-004 · R-LOCK-002
 * 방 이름 변경 · 방 삭제 · (S6) 비밀번호 걸기·바꾸기 · 잠금 풀기를 @/api 래퍼로 보낸다. 요청 중에는 roomBusy 로 중복을 막는다
 * (상태 + 같은 값의 ref — 같은 틱 중복 방지). 시트 상태·화면 전환은 콜백으로 ChatScreen 쪽이 한다.
 * 삭제의 NOT_FOUND 는 "이미 없음 = 목표 상태"라 성공과 같다. 응답이 언마운트 뒤에 오면(isActive) 아무것도 하지 않는다.
 * 비밀번호 원문은 인자로 받아 래퍼에 넘기고 끝이다(상태·로그에 두지 않는다, R-LOCK-007).
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { RoomSummary, SetRoomPasswordResponse } from '@shared/types'
import { type ApiError, clearRoomPassword, deleteRoom, renameRoom, setRoomPassword } from '@/api'
import type { WriteAction } from './labels'

export type RoomBusy = 'rename' | 'delete' | 'setPassword' | 'clearPassword' | null

export type UseRoomActionsOptions = {
  room: RoomSummary
  isActive: () => boolean
  /** 이름 변경 성공 */
  onRenamed: (room: RoomSummary) => void
  /** 삭제 성공 또는 NOT_FOUND */
  onDeleted: () => void
  /** S6: 비밀번호 걸기·바꾸기 성공(E18). wasLocked = 요청을 보낼 때 이미 잠긴 방이었는가 */
  onPasswordSet: (result: SetRoomPasswordResponse, wasLocked: boolean) => void
  /** S6: 잠금 풀기 성공(E19) */
  onPasswordCleared: (room: RoomSummary) => void
  onFailure: (error: ApiError, action: WriteAction) => void
}

export type UseRoomActionsResult = {
  roomBusy: RoomBusy
  /** 렌더 사이에서도 최신인 요청 중 여부(메뉴 진입 가드용) */
  isRoomBusy: () => boolean
  rename: (title: string) => Promise<void>
  remove: () => Promise<void>
  /** S6 F-CH-76 */
  setPassword: (password: string) => Promise<void>
  /** S6 F-CH-78 */
  clearPassword: () => Promise<void>
}

type Handlers = Pick<
  UseRoomActionsOptions,
  'onRenamed' | 'onDeleted' | 'onPasswordSet' | 'onPasswordCleared' | 'onFailure'
>

type RequestDeps = {
  roomId: string
  isActive: () => boolean
  setBusy: (next: RoomBusy) => void
  isRoomBusy: () => boolean
  latestRef: RefObject<Handlers>
}

/** 요청 중 표시: 렌더용 상태 + 같은 값의 ref(같은 틱 중복 방지) */
const useRoomBusy = () => {
  const [roomBusy, setRoomBusy] = useState<RoomBusy>(null)
  const busyRef = useRef<RoomBusy>(null)
  const setBusy = useCallback((next: RoomBusy): void => {
    busyRef.current = next
    setRoomBusy(next)
  }, [])
  const isRoomBusy = useCallback((): boolean => busyRef.current !== null, [])
  return { roomBusy, setBusy, isRoomBusy }
}

/** 이름 변경(F-CH-26) · 방 삭제(F-CH-27) */
const useNameRequests = (deps: RequestDeps) => {
  const { roomId, isActive, setBusy, isRoomBusy, latestRef } = deps

  /** F-CH-26: 응답이 오면 요청 중을 풀고 성공·실패를 알린다(실패 문구 처리는 호출 쪽) */
  const rename = useCallback(
    async (title: string): Promise<void> => {
      if (isRoomBusy()) return
      setBusy('rename')
      const result = await renameRoom(roomId, { title })
      if (!isActive()) return
      setBusy(null)
      if (result.ok) latestRef.current.onRenamed(result.value)
      else latestRef.current.onFailure(result.error, 'renameRoom')
    },
    [roomId, isActive, setBusy, isRoomBusy, latestRef],
  )

  /** F-CH-27: 성공(또는 이미 없음)이면 화면을 떠나므로 요청 중 상태를 그대로 둔다 */
  const remove = useCallback(async (): Promise<void> => {
    if (isRoomBusy()) return
    setBusy('delete')
    const result = await deleteRoom(roomId)
    if (!isActive()) return
    if (result.ok || result.error.code === 'NOT_FOUND') {
      latestRef.current.onDeleted()
      return
    }
    setBusy(null)
    latestRef.current.onFailure(result.error, 'deleteRoom')
  }, [roomId, isActive, setBusy, isRoomBusy, latestRef])

  return { rename, remove }
}

/** S6: 비밀번호 걸기·바꾸기(F-CH-76, E18) · 잠금 풀기(F-CH-78, E19). isRoomLocked = 요청을 보내는 순간의 방 상태 */
const usePasswordRequests = (deps: RequestDeps, isRoomLocked: boolean) => {
  const { roomId, isActive, setBusy, isRoomBusy, latestRef } = deps

  const setPassword = useCallback(
    async (password: string): Promise<void> => {
      if (isRoomBusy()) return
      const wasLocked = isRoomLocked
      setBusy('setPassword')
      const result = await setRoomPassword(roomId, password)
      if (!isActive()) return
      setBusy(null)
      if (result.ok) latestRef.current.onPasswordSet(result.value, wasLocked)
      else latestRef.current.onFailure(result.error, 'setRoomPassword')
    },
    [roomId, isRoomLocked, isActive, setBusy, isRoomBusy, latestRef],
  )

  const clearPassword = useCallback(async (): Promise<void> => {
    if (isRoomBusy()) return
    setBusy('clearPassword')
    const result = await clearRoomPassword(roomId)
    if (!isActive()) return
    setBusy(null)
    if (result.ok) latestRef.current.onPasswordCleared(result.value)
    else latestRef.current.onFailure(result.error, 'clearRoomPassword')
  }, [roomId, isActive, setBusy, isRoomBusy, latestRef])

  return { setPassword, clearPassword }
}

export const useRoomActions = (options: UseRoomActionsOptions): UseRoomActionsResult => {
  const { room, isActive, onRenamed, onDeleted, onPasswordSet, onPasswordCleared, onFailure } =
    options
  const { roomBusy, setBusy, isRoomBusy } = useRoomBusy()
  // 진행 중인 요청이 최신 콜백을 부르도록 ref 로 읽는다
  const latestRef = useRef<Handlers>({
    onRenamed,
    onDeleted,
    onPasswordSet,
    onPasswordCleared,
    onFailure,
  })
  useLayoutEffect(() => {
    latestRef.current = { onRenamed, onDeleted, onPasswordSet, onPasswordCleared, onFailure }
  })
  const deps: RequestDeps = { roomId: room.id, isActive, setBusy, isRoomBusy, latestRef }
  const names = useNameRequests(deps)
  const passwords = usePasswordRequests(deps, room.locked)

  return { roomBusy, isRoomBusy, ...names, ...passwords }
}
