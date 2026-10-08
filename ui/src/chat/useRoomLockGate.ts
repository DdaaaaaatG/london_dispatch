/**
 * useRoomLockGate — 설계 chat/design/lock.md LK §2 · §3 F-CH-63 ~ F-CH-66 · §4.4 · D-44 · D-48 · D-55
 * 요구: R-LOCK-004 · R-LOCK-005 · R-LOCK-006
 * 비유: 잠긴 방 안에 앉아 있다가 누가 자물쇠 번호를 바꾸면 손에 든 도장(입장 증명)이 그 자리에서 무효가 된다. 그때 화면은 하던 일을 모두 내려놓고
 * 문 앞으로 나가 번호를 다시 묻는다. 맞히면 방에 처음 들어올 때와 똑같이 다시 들어온다.
 * 껍데기 ChatScreen 이 이 훅을 부른다. ROOM_LOCKED(어느 요청에서든)를 받으면 isLocked 를 켜 ChatRoomView 를 언마운트하고(진행 중 요청·시트·편집·임시 말풍선 폐기),
 * useRoomEntry 로 증명을 지운 뒤 다시 입장을 시도한다(토큰 있음 = 비밀번호 없이 조용히, 안 되거나 토큰 없음 = 입장 시트).
 * 입장에 성공하면 epoch 를 올려 새 ChatRoomView 를 마운트한다(첫 진입 F-CH-02 와 같은 경로). 비밀번호 원문·토큰·증명 값은 여기에 두지 않는다.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { RoomSummary } from '@shared/types'
import { type EntrySheet, useRoomEntry } from '@/components/roomEntry'
import { clearLastRoomId } from '@/components/utils/storage'
import { getRoomKey } from '@/state/roomKeys'
import type { Viewer } from '@/state/viewer'

/** D-55: 한 ROOM_LOCKED 에피소드 안에서 조용한 시도로 재입장하는 연속 횟수 상한. 넘으면 조용한 시도 없이 입장 시트 */
const QUIET_REENTRY_MAX = 2

export type UseRoomLockGateOptions = {
  room: RoomSummary
  viewer: Viewer
  onBack: () => void
  /** App 이 보는 방 정보를 바꾼다(= onRoomRenamed) */
  onRoomUpdated: (room: RoomSummary) => void
}

export type UseRoomLockGateResult = {
  isLocked: boolean
  /** 재입장 때 ChatRoomView 를 새로 마운트하는 key */
  epoch: number
  sheet: EntrySheet
  /** ChatRoomView 가 ROOM_LOCKED 를 받았을 때 부른다(F-CH-64) */
  onRoomLocked: () => void
  /** 재입장 뒤 첫 로드가 성공했다(D-55 카운터 리셋) */
  onRoomOpened: () => void
  submitPassword: (password: string) => void
  cancelLockedEntry: () => void
  back: () => void
}

type Latest = UseRoomLockGateOptions & { canQuiet: boolean }

/** 비동기 콜백이 최신 값을 읽도록 매 렌더 layout effect 로 담는다(렌더 중 ref 쓰기 금지) */
const useLatest = <T>(value: T): RefObject<T> => {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

/** 관문 상태: 잠긴 판 표시 · 재입장 key · 조용한 재입장 횟수(렌더 중 읽으므로 상태 — D-55) · 같은 틱 방어 ref 둘 */
const useGateState = () => {
  const [isLocked, setIsLocked] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [quietReentryCount, setQuietReentryCount] = useState(0)
  const isLockedRef = useRef(false)
  const quietAttemptRef = useRef(false)
  return {
    isLocked,
    setIsLocked,
    epoch,
    setEpoch,
    quietReentryCount,
    setQuietReentryCount,
    isLockedRef,
    quietAttemptRef,
  }
}
type GateState = ReturnType<typeof useGateState>

/**
 * F-CH-66 leave: 마지막 본 방 기록을 지우고 목록으로.
 * F-CH-65 enterAgain: 입장 성공 → 조용한 시도로 왔으면 횟수 +1(판별은 quietAttemptRef — entry.sheet 로 판별하지 않는다),
 * 그사이 잠금이 풀린 방(증명 없음)이면 방 정보를 locked:false 로 되돌리고(D-48), 잠긴 판을 내리고 ChatRoomView 를 새로 마운트한다
 */
const useReenter = (state: GateState, latestRef: RefObject<Latest>) => {
  const { setIsLocked, setEpoch, setQuietReentryCount, isLockedRef, quietAttemptRef } = state
  const leave = useCallback((): void => {
    clearLastRoomId()
    latestRef.current.onBack()
  }, [latestRef])
  const enterAgain = useCallback((): void => {
    const { room, onRoomUpdated } = latestRef.current
    if (quietAttemptRef.current) {
      quietAttemptRef.current = false
      setQuietReentryCount(count => count + 1)
    }
    if (getRoomKey(room.id) === null) onRoomUpdated({ ...room, locked: false })
    isLockedRef.current = false
    setIsLocked(false)
    setEpoch(count => count + 1)
  }, [latestRef, quietAttemptRef, isLockedRef, setQuietReentryCount, setIsLocked, setEpoch])
  return { leave, enterAgain }
}

type EntryRef = RefObject<ReturnType<typeof useRoomEntry>>

/**
 * F-CH-64: ROOM_LOCKED 수신. 이미 잠긴 판이면 무시 → 잠긴 판 켬 → 안 잠긴 방이면 방 정보를 locked:true 로(메뉴 분기 일치, D-48)
 * → 조용한 시도 가능 여부를 표시하고 requestEntry(room, 'locked') (증명 삭제는 이 호출이 한다)
 */
const useRoomLocked = (state: GateState, latestRef: RefObject<Latest>, entryRef: EntryRef) => {
  const { setIsLocked, isLockedRef, quietAttemptRef } = state
  return useCallback((): void => {
    if (isLockedRef.current) return
    isLockedRef.current = true
    const { room, onRoomUpdated, canQuiet } = latestRef.current
    setIsLocked(true)
    if (!room.locked) onRoomUpdated({ ...room, locked: true })
    quietAttemptRef.current = canQuiet
    entryRef.current.requestEntry(room, 'locked')
  }, [latestRef, entryRef, setIsLocked, isLockedRef, quietAttemptRef])
}

/**
 * F-CH-63 submitPassword: 시트 경로로 들어온 재입장은 조용한 재입장 횟수에 세지 않는다(플래그를 내리고 그대로 전달).
 * F-CH-66 cancelLockedEntry: 요청 중이면 무시, 아니면 시트를 닫고 목록으로
 */
const useEntryHandlers = (state: GateState, entryRef: EntryRef, leave: () => void) => {
  const { quietAttemptRef } = state
  const submitPassword = useCallback(
    (password: string): void => {
      quietAttemptRef.current = false
      entryRef.current.submitPassword(password)
    },
    [entryRef, quietAttemptRef],
  )
  const cancelLockedEntry = useCallback((): void => {
    const current = entryRef.current
    if (current.sheet?.isBusy) return
    current.cancelEntry()
    leave()
  }, [entryRef, leave])
  return { submitPassword, cancelLockedEntry }
}

/** F-CH-63: 잠금 관문. 조용한 시도는 viewer.canWrite 이고 연속 재입장 상한 미만일 때만 허용한다(rooms 공용 시그니처는 canWrite 값만 좁힌다) */
export const useRoomLockGate = (options: UseRoomLockGateOptions): UseRoomLockGateResult => {
  const state = useGateState()
  const { setQuietReentryCount } = state
  const canQuiet = options.viewer.canWrite && state.quietReentryCount < QUIET_REENTRY_MAX
  const latestRef = useLatest<Latest>({ ...options, canQuiet })
  const { leave, enterAgain } = useReenter(state, latestRef)
  const entry = useRoomEntry({ canWrite: canQuiet, onEntered: enterAgain, onRoomGone: leave })
  const entryRef = useLatest(entry)
  const onRoomLocked = useRoomLocked(state, latestRef, entryRef)
  const handlers = useEntryHandlers(state, entryRef, leave)
  const onRoomOpened = useCallback((): void => setQuietReentryCount(0), [setQuietReentryCount])

  return {
    isLocked: state.isLocked,
    epoch: state.epoch,
    sheet: entry.sheet,
    onRoomLocked,
    onRoomOpened,
    ...handlers,
    back: leave,
  }
}
