/**
 * useRoomsLoader — 설계 rooms/design/functions.md §1.2 · F-RM-06 ~ F-RM-08 (함수 50줄 한계 때문에 RoomsScreen 에서 분리)
 * 요구: R-ROOMS-001 · 003 · 004 · R-CHAT-010
 * 목록 요청 상태(load) · 자동 진입 판정(마운트당 한 번) · 언마운트 뒤 응답 무시를 소유한다.
 * 자동 진입 판정은 목록 응답이 성공한 시점에만 한다(방 정보는 목록으로만 얻는다, 단건 조회 없음).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RoomSummary } from '@shared/types'
import { type ApiError, listRooms } from '@/api'
import { clearLastRoomId } from '@/components/utils/storage'

export type RoomsLoad =
  | { phase: 'loading' }
  | { phase: 'error'; error: ApiError }
  | { phase: 'ready'; rooms: readonly RoomSummary[] }

export type AutoOpenHandlers = {
  /** 시작 시 한 번만 쓰는 마지막 본 방 id */
  autoOpenRoomId: string | null
  onOpenRoom: (room: RoomSummary) => void
  onAutoOpenSettled: () => void
}

export type UseRoomsLoaderResult = {
  load: RoomsLoad
  loadRooms: () => Promise<void>
  retry: () => void
}

/** F-RM-08 판정 본체. 응답 값으로 바로 판정한다(렌더를 기다리지 않는다) */
const resolveAutoOpen = (rooms: readonly RoomSummary[], handlers: AutoOpenHandlers): void => {
  const { autoOpenRoomId, onOpenRoom, onAutoOpenSettled } = handlers
  if (autoOpenRoomId === null) {
    onAutoOpenSettled()
    return
  }
  const target = rooms.find(room => room.id === autoOpenRoomId)
  if (target === undefined) {
    clearLastRoomId()
    onAutoOpenSettled()
    return
  }
  onAutoOpenSettled()
  onOpenRoom(target)
}

export const useRoomsLoader = (handlers: AutoOpenHandlers): UseRoomsLoaderResult => {
  const [load, setLoad] = useState<RoomsLoad>({ phase: 'loading' })
  const autoOpenSettledRef = useRef(false)
  const isActiveRef = useRef(false)
  // 부모가 콜백을 매번 새로 만들어도 목록을 다시 요청하지 않도록 최신 값은 ref 로 읽는다
  const latestRef = useRef<AutoOpenHandlers>(handlers)

  useLayoutEffect(() => {
    latestRef.current = handlers
  })

  // 언마운트 뒤에 도착한 응답을 버리기 위한 활성 플래그
  useEffect(() => {
    isActiveRef.current = true
    return () => {
      isActiveRef.current = false
    }
  }, [])

  /**
   * F-RM-06: 목록을 요청한다. 실패하면 자동 진입 판정은 다음 성공까지 미룬다.
   * loading 상태 설정은 하지 않는다 — 마운트 때는 초기 상태가 이미 loading 이고, 재시도는 retry 가 먼저 건다.
   */
  const loadRooms = useCallback(async (): Promise<void> => {
    const result = await listRooms()
    if (!isActiveRef.current) return
    if (!result.ok) {
      setLoad({ phase: 'error', error: result.error })
      return
    }
    setLoad({ phase: 'ready', rooms: result.value })
    if (autoOpenSettledRef.current) return
    autoOpenSettledRef.current = true
    resolveAutoOpen(result.value, latestRef.current)
  }, [])

  /** F-RM-07: 오류 상태에서만 보이는 「다시 시도」. loading 으로 돌린 뒤 다시 요청한다 */
  const retry = useCallback((): void => {
    setLoad({ phase: 'loading' })
    void loadRooms()
  }, [loadRooms])

  return { load, loadRooms, retry }
}
