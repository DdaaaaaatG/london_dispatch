/**
 * useRoomEntry — 방 접근 판정 ①~④ 와 입장 시트 상태. 설계 rooms/design/components.md §1.22 · design/lock.md F-RM-40 ~ F-RM-44 · §6.7 · §6.8
 * 요구: R-LOCK-004 · R-LOCK-005 · R-LOCK-006 · R-ROOMS-001
 * 비유: 열람실 문 앞의 안내 데스크. 안 잠겼거나 도장(증명)이 있으면 그냥 들여보내고, 회원이면 먼저 조용히 번호 없이 문을 두드려 보고(주인이면 통과),
 * 안 열리면 번호를 묻는 창(시트)을 연다. 회원이 아니면 바로 묻는다.
 * rooms 는 행 탭(reason 'tap'), chat 은 모든 요청의 ROOM_LOCKED(reason 'locked' — 증명을 먼저 지운다)로 부른다. 결과는 콜백으로만 알린다.
 * 비밀번호 원문은 이 훅·저장소·로그 어디에도 두지 않는다(인자로 받아 래퍼에 넘기고 끝). 증명은 state/roomKeys.ts 한 곳에만 둔다.
 * 호출하는 래퍼는 enterRoom 뿐이다(fetch 직접 사용 없음). 판정 ③(조용한 시도)은 비밀번호 인자를 넘기지 않는다.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { RoomSummary } from '@shared/types'
import { type ApiError, enterRoom } from '@/api'
import { isEnterPasswordValid } from '@/state/limits'
import { forgetRoomKey, getRoomKey, saveRoomKey } from '@/state/roomKeys'

export type EntrySheet = { room: RoomSummary; isBusy: boolean; error: ApiError | null } | null

export type UseRoomEntryOptions = {
  /** viewer.canWrite — ③ 조용한 시도 여부에만 쓴다 */
  canWrite: boolean
  /** 들어가도 된다(rooms: 화면 전환 · chat: 첫 로드 다시) */
  onEntered: (room: RoomSummary) => void
  /** 방이 없어졌다(NOT_FOUND) */
  onRoomGone: (room: RoomSummary) => void
}

/** 'tap' = 행 탭 · 'locked' = 다른 요청이 ROOM_LOCKED 를 받았다(증명을 지우고 ③④ 로 간다) */
export type EntryReason = 'tap' | 'locked'

export type UseRoomEntryResult = {
  sheet: EntrySheet
  requestEntry: (room: RoomSummary, reason?: EntryReason) => void
  /** 내부에서 Promise 를 void 로 버린다 */
  submitPassword: (password: string) => void
  cancelEntry: () => void
}

type EntryDeps = {
  setSheet: Dispatch<SetStateAction<EntrySheet>>
  isActiveRef: RefObject<boolean>
  latestRef: RefObject<UseRoomEntryOptions>
}

/** 성공 응답의 증명이 문자열이면 저장한다. null(그사이 잠금 해제)이면 저장 없이 넘어간다 */
const rememberEntryKey = (roomId: string, entryKey: string | null): void => {
  if (typeof entryKey === 'string') saveRoomKey(roomId, entryKey)
}

/**
 * F-RM-42: 조용한 시도(③). 비밀번호 없이 enterRoom — 주인이면 서버가 200 을 준다(화면은 주인인지 묻지 않는다).
 * 진행 표시는 없다(D-L9). 대기 중에는 다른 행 탭을 무시한다(inFlightRef).
 */
const useQuietEnter = ({ setSheet, isActiveRef, latestRef }: EntryDeps) => {
  const inFlightRef = useRef(false)
  const quietEnter = useCallback(
    async (room: RoomSummary): Promise<void> => {
      inFlightRef.current = true
      const result = await enterRoom(room.id)
      inFlightRef.current = false
      if (!isActiveRef.current) return
      if (result.ok) {
        rememberEntryKey(room.id, result.value.entryKey)
        latestRef.current.onEntered(room)
      } else if (result.error.code === 'NOT_FOUND') {
        latestRef.current.onRoomGone(room)
      } else {
        const error = result.error.code === 'ROOM_LOCKED' ? null : result.error
        setSheet({ room, isBusy: false, error })
      }
    },
    [setSheet, isActiveRef, latestRef],
  )
  return { inFlightRef, quietEnter }
}

/** F-RM-43: 시트 제출. 같은 틱 연타는 inFlightRef 가 막는다. 실패하면 시트와 입력값(PromptSheet 로컬)을 유지한다 */
const useSubmitEntry = ({ setSheet, isActiveRef, latestRef }: EntryDeps) => {
  const inFlightRef = useRef(false)
  return useCallback(
    async (room: RoomSummary, password: string): Promise<void> => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      setSheet({ room, isBusy: true, error: null })
      const result = await enterRoom(room.id, password)
      inFlightRef.current = false
      if (!isActiveRef.current) return
      if (result.ok) {
        rememberEntryKey(room.id, result.value.entryKey)
        setSheet(null)
        latestRef.current.onEntered(room)
      } else if (result.error.code === 'NOT_FOUND') {
        setSheet(null)
        latestRef.current.onRoomGone(room)
      } else {
        setSheet({ room, isBusy: false, error: result.error })
      }
    },
    [setSheet, isActiveRef, latestRef],
  )
}

export const useRoomEntry = (options: UseRoomEntryOptions): UseRoomEntryResult => {
  const [sheet, setSheet] = useState<EntrySheet>(null)
  const isActiveRef = useRef(false)
  // 대기 중 부모가 콜백을 바꿔도 응답은 최신 콜백을 부르도록 ref 로 읽는다
  const latestRef = useRef(options)
  useLayoutEffect(() => {
    latestRef.current = options
  })
  // 언마운트 뒤에 도착한 응답을 버리기 위한 활성 플래그
  useLayoutEffect(() => {
    isActiveRef.current = true
    return () => {
      isActiveRef.current = false
    }
  }, [])
  const deps: EntryDeps = { setSheet, isActiveRef, latestRef }
  const quiet = useQuietEnter(deps)
  const submitEntry = useSubmitEntry(deps)

  /**
   * F-RM-41. 'locked' 면 가드보다 먼저 증명을 지운다(무효 증명은 항상 반영). 그다음 가드(조용한 시도 중·시트 열림)면 끝.
   * ① 안 잠김 → 진입 ② 저장된 증명 → 진입('tap' 만 — 'locked' 는 ①② 를 건너뛴다) ③ 회원 → 조용한 시도 ④ 읽기 전용 → 시트
   */
  const requestEntry = (room: RoomSummary, reason: EntryReason = 'tap'): void => {
    if (reason === 'locked') forgetRoomKey(room.id)
    if (quiet.inFlightRef.current || sheet !== null) return
    if (reason === 'tap' && (!room.locked || getRoomKey(room.id) !== null)) {
      options.onEntered(room)
    } else if (options.canWrite) {
      void quiet.quietEnter(room)
    } else {
      setSheet({ room, isBusy: false, error: null })
    }
  }
  const submitPassword = (password: string): void => {
    if (sheet === null || sheet.isBusy || !isEnterPasswordValid(password)) return
    void submitEntry(sheet.room, password)
  }
  /** F-RM-44: 요청 중이면 무시(PromptSheet 도 막는다) */
  const cancelEntry = (): void => {
    if (sheet !== null && !sheet.isBusy) setSheet(null)
  }

  return { sheet, requestEntry, submitPassword, cancelEntry }
}
