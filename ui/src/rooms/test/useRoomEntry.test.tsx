/**
 * roomEntry 묶음 훅·문구 단위 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md
 *   (TC-RM-065 · TC-RM-049(c) · TC-RM-051(e) · TC-RM-052(d))
 * 대상: ui/src/components/roomEntry/ (useRoomEntry · roomEntryText) — design/components.md §1.22 · §1.23, design/lock.md F-RM-40~45
 * - 위치: 훅 소유는 rooms 설계(lock.md §13 "훅 동작 TC(TC-RM-065)는 rooms 소유")라 rooms/test 에 둔다.
 * - enterRoom 은 vi.mock('@/api/rooms') 로 대체한다(훅이 '@/api' 재노출로 import 해도 같은 모듈). fetch 모킹 금지.
 * - 매 TC 전 localStorage.clear() → resetRoomKeyCache().
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { ERROR_MESSAGES } from '@shared/errors'
import type { EnterRoomResponse, RoomSummary } from '@shared/types'
import type { ApiError, Result } from '@/api'
import { enterRoom } from '@/api/rooms'
import {
  ROOM_ENTRY_TEXT,
  enterErrorText,
  useRoomEntry,
  type UseRoomEntryOptions,
} from '@/components/roomEntry'
import { getRoomKey, resetRoomKeyCache } from '@/state/roomKeys'

vi.mock('@/api/rooms', () => ({
  listRooms: vi.fn(),
  createRoom: vi.fn(),
  renameRoom: vi.fn(),
  deleteRoom: vi.fn(),
  enterRoom: vi.fn(),
  setRoomPassword: vi.fn(),
  clearRoomPassword: vi.fn(),
}))

const mockedEnterRoom = vi.mocked(enterRoom)
const KEYS = 'ld:roomKeys'
const base = { createdAt: 0, updatedAt: 0, messageCount: 0 }
const SECRET: RoomSummary = { ...base, id: 'r3', title: '비밀 다과회', locked: true }
const OTHER: RoomSummary = { ...base, id: 'r4', title: '밀실 회의', locked: true }
/** 목록을 받은 뒤 잠긴 방 — chat 이 들고 있는 옛 요약(locked: false) */
const STALE: RoomSummary = { ...base, id: 'r1', title: '티타임', locked: false }

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}
const err = (code: ApiError['code'], retryAfterSec?: number): ApiError =>
  retryAfterSec === undefined ? { code, message: 'SERVER-RAW' } : { code, message: 'SERVER-RAW', retryAfterSec }

const setup = (canWrite: boolean) => {
  const onEntered = vi.fn()
  const onRoomGone = vi.fn()
  const hook = renderHook((props: UseRoomEntryOptions) => useRoomEntry(props), {
    initialProps: { canWrite, onEntered, onRoomGone },
  })
  return { ...hook, onEntered, onRoomGone }
}

beforeEach(() => {
  mockedEnterRoom.mockReset()
  localStorage.clear()
  resetRoomKeyCache()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  resetRoomKeyCache()
})

describe("requestEntry(room, 'locked') (F-RM-41 · R-LOCK-004 · chat 입장 재요구 경로)", () => {
  it('TC-RM-065(a): 토큰 있음 — 증명 삭제 → ①② 건너뜀 → enterRoom(id) 인자 1개 → ROOM_LOCKED 면 시트', async () => {
    localStorage.setItem(KEYS, '[["r3","e1.x"]]')
    const pending = deferred<Result<EnterRoomResponse>>()
    mockedEnterRoom.mockReturnValueOnce(pending.promise)
    const { result, onEntered } = setup(true)

    act(() => result.current.requestEntry(SECRET, 'locked'))
    expect(getRoomKey('r3')).toBeNull()
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
    expect(mockedEnterRoom.mock.calls[0]).toEqual(['r3'])
    expect(mockedEnterRoom.mock.calls[0]).toHaveLength(1)
    expect(onEntered).not.toHaveBeenCalled()
    expect(result.current.sheet).toBeNull()

    await act(async () => {
      pending.resolve({ ok: false, error: err('ROOM_LOCKED') })
    })
    expect(result.current.sheet).toEqual({ room: SECRET, isBusy: false, error: null })
    expect(onEntered).not.toHaveBeenCalled()
  })

  it('TC-RM-065(a): 토큰 있음 — locked:false 인 옛 요약이라도 ① 을 건너뛰고 조용한 시도', async () => {
    mockedEnterRoom.mockResolvedValueOnce({ ok: true, value: { entryKey: 'e2.y' } })
    const { result, onEntered } = setup(true)

    await act(async () => {
      result.current.requestEntry(STALE, 'locked')
    })
    expect(mockedEnterRoom.mock.calls[0]).toEqual(['r1'])
    expect(onEntered).toHaveBeenCalledTimes(1)
    expect(onEntered.mock.calls[0]?.[0]).toEqual(STALE)
    expect(getRoomKey('r1')).toBe('e2.y')
  })

  it('TC-RM-065(b): 토큰 없음 — 증명 삭제 → enterRoom 0 → 시트(오류 없음)', () => {
    localStorage.setItem(KEYS, '[["r3","e1.x"]]')
    const { result, onEntered } = setup(false)

    act(() => result.current.requestEntry(SECRET, 'locked'))
    expect(getRoomKey('r3')).toBeNull()
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(mockedEnterRoom).not.toHaveBeenCalled()
    expect(result.current.sheet).toEqual({ room: SECRET, isBusy: false, error: null })
    expect(onEntered).not.toHaveBeenCalled()
  })

  it('TC-RM-065(c): 조용한 시도 대기 중 다른 방 locked 호출 → 그 방 증명은 지워지고 enterRoom·시트 추가 없음', async () => {
    localStorage.setItem(KEYS, '[["r4","e4.z"]]')
    const pending = deferred<Result<EnterRoomResponse>>()
    mockedEnterRoom.mockReturnValueOnce(pending.promise)
    const { result } = setup(true)

    act(() => result.current.requestEntry(SECRET))
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
    act(() => result.current.requestEntry(OTHER, 'locked'))
    expect(getRoomKey('r4')).toBeNull()
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
    expect(result.current.sheet).toBeNull()

    await act(async () => {
      pending.resolve({ ok: false, error: err('ROOM_LOCKED') })
    })
    expect(result.current.sheet?.room).toEqual(SECRET)
  })

  it('TC-RM-065(c): 시트가 열린 상태에서 다른 방 locked 호출 → 증명 삭제, 시트는 그대로', () => {
    localStorage.setItem(KEYS, '[["r4","e4.z"]]')
    const { result } = setup(false)

    act(() => result.current.requestEntry(SECRET))
    expect(result.current.sheet?.room).toEqual(SECRET)
    act(() => result.current.requestEntry(OTHER, 'locked'))
    expect(getRoomKey('r4')).toBeNull()
    expect(result.current.sheet).toEqual({ room: SECRET, isBusy: false, error: null })
    expect(mockedEnterRoom).not.toHaveBeenCalled()
  })

  it('TC-RM-065(d): 응답 전 언마운트 → onEntered 0, 증명 저장 없음(isActiveRef)', async () => {
    const pending = deferred<Result<EnterRoomResponse>>()
    mockedEnterRoom.mockReturnValueOnce(pending.promise)
    const { result, unmount, onEntered } = setup(true)

    act(() => result.current.requestEntry(SECRET))
    unmount()
    await act(async () => {
      pending.resolve({ ok: true, value: { entryKey: 'e1.x' } })
    })
    expect(onEntered).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEYS)).toBeNull()
  })

  it('TC-RM-065(e): 대기 중 콜백이 바뀌면 최신 onEntered 를 부른다(latestRef)', async () => {
    const pending = deferred<Result<EnterRoomResponse>>()
    mockedEnterRoom.mockReturnValueOnce(pending.promise)
    const { result, rerender, onEntered, onRoomGone } = setup(true)
    const onEnteredNext = vi.fn()

    act(() => result.current.requestEntry(SECRET))
    rerender({ canWrite: true, onEntered: onEnteredNext, onRoomGone })
    await act(async () => {
      pending.resolve({ ok: true, value: { entryKey: 'e1.x' } })
    })
    expect(onEntered).not.toHaveBeenCalled()
    expect(onEnteredNext).toHaveBeenCalledTimes(1)
    expect(onEnteredNext.mock.calls[0]?.[0]).toEqual(SECRET)
  })
})

describe('submitPassword · cancelEntry 가드 (F-RM-43 · F-RM-44)', () => {
  it('TC-RM-051(e): 요청 중 cancelEntry → 무시(시트 유지, isBusy true)', async () => {
    const pending = deferred<Result<EnterRoomResponse>>()
    mockedEnterRoom.mockReturnValueOnce(pending.promise)
    const { result } = setup(false)

    act(() => result.current.requestEntry(SECRET))
    act(() => result.current.submitPassword('pw1234'))
    expect(result.current.sheet).toEqual({ room: SECRET, isBusy: true, error: null })
    act(() => result.current.cancelEntry())
    expect(result.current.sheet).toEqual({ room: SECRET, isBusy: true, error: null })

    await act(async () => {
      pending.resolve({ ok: false, error: err('ROOM_PASSWORD_WRONG') })
    })
    expect(result.current.sheet).toEqual({ room: SECRET, isBusy: false, error: err('ROOM_PASSWORD_WRONG') })
    act(() => result.current.cancelEntry())
    expect(result.current.sheet).toBeNull()
  })

  it('TC-RM-052(d): 시트가 없거나 입력이 무효(빈칸·65자)면 submitPassword 가 enterRoom 을 부르지 않는다', () => {
    const { result } = setup(false)
    act(() => result.current.submitPassword('pw1234'))
    expect(mockedEnterRoom).not.toHaveBeenCalled()

    act(() => result.current.requestEntry(SECRET))
    act(() => result.current.submitPassword(''))
    act(() => result.current.submitPassword('a'.repeat(65)))
    expect(mockedEnterRoom).not.toHaveBeenCalled()
    expect(result.current.sheet).toEqual({ room: SECRET, isBusy: false, error: null })
  })
})

describe('roomEntryText (F-RM-45 · lock.md §8.2 · R-LOCK-008)', () => {
  it('TC-RM-049(c): 고정 문구 4개와 enterErrorText 코드별 문구, 서버 message 미사용', () => {
    expect(ROOM_ENTRY_TEXT).toEqual({ title: '비밀번호', inputAriaLabel: '방 비밀번호', submit: '입장', cancel: '취소' })
    expect(enterErrorText(err('ROOM_PASSWORD_WRONG'))).toBe('비밀번호가 맞지 않습니다.')
    expect(enterErrorText(err('RATE_LIMITED', 42))).toBe(
      '비밀번호를 너무 자주 입력했습니다. 42초 후 다시 시도해 주세요.',
    )
    expect(enterErrorText(err('RATE_LIMITED'))).toBe('비밀번호를 너무 자주 입력했습니다. 잠시 후 다시 시도해 주세요.')
    expect(enterErrorText(err('NETWORK'))).toBe('서버에 연결할 수 없습니다.')
    expect(enterErrorText(err('INTERNAL'))).toBe(ERROR_MESSAGES.INTERNAL)
    expect(enterErrorText(err('CONFIG_INVALID'))).toBe(ERROR_MESSAGES.CONFIG_INVALID)
    expect(enterErrorText(err('INTERNAL'))).not.toContain('SERVER-RAW')
  })
})
