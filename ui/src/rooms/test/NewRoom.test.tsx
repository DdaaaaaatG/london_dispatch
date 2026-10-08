/**
 * rooms S2 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-018 ~ 026)
 * 대상: RoomsScreen(S2) · NewRoomRow · useCreateRoom · TextInput · Toast · useToast
 * - 토큰은 viewer props 로만 준다(WRITER_VIEWER / READ_ONLY_VIEWER). App 통합은 AppWrite.test.tsx.
 * - api 래퍼는 vi.mock('@/api/rooms') 로 대체한다. isAuthFailure 는 실물(@/api/client). fetch 모킹 금지.
 * - 문구는 design.md §8 확정 문구를 그대로 단언한다(labels.ts 를 import 하지 않는다).
 * - 토스트 2초: 실패 resolve 전에 vi.useFakeTimers() → 가짜 시계 구간에서는 findBy/waitFor 를 쓰지 않는다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ERROR_MESSAGES } from '@shared/errors'
import type { RoomSummary } from '@shared/types'
import type { ApiErrorCode, Result } from '@/api'
import { createRoom, deleteRoom, listRooms, renameRoom } from '@/api/rooms'
import { RoomsScreen } from '@/rooms'
import { READ_ONLY_VIEWER, WRITER_VIEWER, type Viewer } from '@/state/viewer'

vi.mock('@/api/rooms', () => ({
  listRooms: vi.fn(),
  createRoom: vi.fn(),
  renameRoom: vi.fn(),
  deleteRoom: vi.fn(),
}))

const mockedListRooms = vi.mocked(listRooms)
const mockedCreateRoom = vi.mocked(createRoom)

// ── 픽스처 ─────────────────────────────────────────────
const ROOM_CHESS: RoomSummary = {
  id: 'r2',
  title: '체스 대결',
  createdAt: new Date(2026, 9, 1, 9, 0).getTime(),
  updatedAt: new Date(2026, 9, 3, 21, 5).getTime(),
  messageCount: 4,
}
const ROOM_TEA: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 2, 10, 0).getTime(),
  updatedAt: new Date(2026, 9, 5, 16, 40).getTime(),
  messageCount: 12,
}
const CREATED: RoomSummary = {
  id: 'r9',
  title: '안개 낀 런던',
  createdAt: new Date(2026, 9, 5, 17, 0).getTime(),
  updatedAt: new Date(2026, 9, 5, 17, 0).getTime(),
  messageCount: 0,
}
const ROOMS: RoomSummary[] = [ROOM_CHESS, ROOM_TEA]
const ROW_CHESS = '체스 대결, 마지막 갱신 10.03'
const ROW_TEA = '티타임, 마지막 갱신 10.05'
const NEW_ROOM = '새 방 만들기'
const INPUT = '새 방 제목'
const SERVER_RAW = 'SERVER-RAW-MESSAGE'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fail = (code: ApiErrorCode, retryAfterSec?: number): Result<never> => ({
  ok: false,
  error:
    retryAfterSec === undefined
      ? { code, message: SERVER_RAW }
      : { code, message: SERVER_RAW, retryAfterSec },
})
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}
const flushPending = async () => {
  await act(async () => {})
}

const renderRooms = (viewer: Viewer = WRITER_VIEWER) => {
  const onOpenRoom = vi.fn()
  const onAutoOpenSettled = vi.fn()
  const onAuthFailure = vi.fn()
  const props = { autoOpenRoomId: null, onOpenRoom, onAutoOpenSettled, onAuthFailure }
  const view = render(<RoomsScreen viewer={viewer} {...props} />)
  const rerenderWith = (next: Viewer) => view.rerender(<RoomsScreen viewer={next} {...props} />)
  return { ...view, onOpenRoom, onAuthFailure, rerenderWith }
}

/** 목록이 그려진 뒤 「+ 새 방」을 눌러 입력 행을 연다 */
const openRow = async () => {
  const user = userEvent.setup()
  await screen.findByRole('button', { name: ROW_TEA })
  await user.click(screen.getByRole('button', { name: NEW_ROOM }))
  const group = screen.getByRole('group', { name: NEW_ROOM })
  const input = within(group).getByRole('textbox', { name: INPUT }) as HTMLInputElement
  const createButton = within(group).getByRole('button', { name: '만들기' }) as HTMLButtonElement
  const cancelButton = within(group).getByRole('button', { name: '취소' }) as HTMLButtonElement
  return { user, group, input, createButton, cancelButton }
}

beforeEach(() => {
  mockedListRooms.mockReset()
  mockedCreateRoom.mockReset()
  vi.mocked(renameRoom).mockReset()
  vi.mocked(deleteRoom).mockReset()
  mockedListRooms.mockResolvedValue(ok(ROOMS))
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('RoomsScreen 토큰 있음 렌더 (R-ROOMS-002 · R-CHAT-008)', () => {
  it('TC-RM-018: WRITER_VIEWER → 상단 바에 「+ 새 방」(이름 새 방 만들기) 1개, 입력 행은 아직 없음', async () => {
    const { container } = renderRooms(WRITER_VIEWER)
    await screen.findByRole('button', { name: ROW_TEA })

    const header = container.querySelector('header') as HTMLElement
    const headerButtons = within(header).getAllByRole('button')
    expect(headerButtons).toHaveLength(1)
    expect(headerButtons[0]?.getAttribute('aria-label')).toBe(NEW_ROOM)
    expect(headerButtons[0]?.textContent).toBe('+ 새 방')
    expect(screen.queryByRole('group', { name: NEW_ROOM })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: ROW_CHESS })).not.toBeNull()
    // ⓑ
    expect(WRITER_VIEWER.canWrite).toBe(true)
    expect(localStorage.length).toBe(0)
    // ⓒ
    await flushPending()
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
    expect(mockedCreateRoom).not.toHaveBeenCalled()
  })
})

describe('RoomsScreen 새 방 입력 행 (R-ROOMS-002 · R-ROOM-002)', () => {
  it('TC-RM-019: 「+ 새 방」 → 입력 포커스, placeholder, 카운터 0/60, 만들기 disabled·취소 enabled', async () => {
    renderRooms()
    const { group, input, createButton, cancelButton } = await openRow()

    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('placeholder')).toBe('새 방 제목 입력')
    expect(input.value).toBe('')
    const counter = within(group).getByText('0/60')
    expect(counter.getAttribute('aria-hidden')).toBe('true')
    expect(createButton.disabled).toBe(true)
    expect(cancelButton.disabled).toBe(false)
    // B 행은 목록보다 DOM 앞
    const list = screen.getByRole('list')
    expect(group.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(localStorage.length).toBe(0)
    await flushPending()
    expect(mockedCreateRoom).not.toHaveBeenCalled()
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-020: 공백만 0/60 disabled · 코드 포인트 60 enabled · 61 over·aria-invalid·disabled · 앞뒤 공백 미집계', async () => {
    renderRooms()
    const { group, input, createButton } = await openRow()
    const sixty = '😀'.repeat(30) + 'a'.repeat(30)

    fireEvent.change(input, { target: { value: '   ' } })
    expect(within(group).getByText('0/60')).not.toBeNull()
    expect(createButton.disabled).toBe(true)

    fireEvent.change(input, { target: { value: sixty } })
    expect(within(group).getByText('60/60')).not.toBeNull()
    expect(createButton.disabled).toBe(false)
    expect(input.getAttribute('aria-invalid')).not.toBe('true')

    fireEvent.change(input, { target: { value: `${sixty}b` } })
    const over = within(group).getByText('61/60')
    expect(over.classList.contains('over')).toBe(true)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(createButton.disabled).toBe(true)
    expect(input.value).toBe(`${sixty}b`) // 잘라 내지 않는다(F-RM-16)

    fireEvent.change(input, { target: { value: '  ab  ' } })
    expect(within(group).getByText('2/60')).not.toBeNull()
    expect(createButton.disabled).toBe(false)
    await flushPending()
    expect(mockedCreateRoom).not.toHaveBeenCalled()
  })
})

describe('RoomsScreen 방 생성 (R-ROOMS-002 · R-CHAT-011)', () => {
  it('TC-RM-021: 만들기 → createRoom(원문 그대로) 1회 → onOpenRoom(응답) 1회, 목록 재요청 없음', async () => {
    mockedCreateRoom.mockResolvedValueOnce(ok(CREATED))
    const { onOpenRoom, onAuthFailure } = renderRooms()
    const { user, input, createButton } = await openRow()

    await user.type(input, '  안개 낀 런던  ')
    await user.click(createButton)

    await vi.waitFor(() => expect(onOpenRoom).toHaveBeenCalledTimes(1))
    expect(onOpenRoom.mock.calls[0]?.[0]).toEqual(CREATED)
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(mockedCreateRoom).toHaveBeenCalledTimes(1)
    expect(mockedCreateRoom.mock.calls[0]).toEqual([{ title: '  안개 낀 런던  ' }])
    await flushPending()
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-022: 대기 중 readOnly·두 버튼 disabled, 클릭·Enter 연타 → createRoom 1회, 응답 뒤 해제', async () => {
    const pending = deferred<Result<RoomSummary>>()
    mockedCreateRoom.mockReturnValueOnce(pending.promise)
    renderRooms()
    const { user, input, createButton, cancelButton } = await openRow()

    await user.type(input, '안개 낀 런던')
    await user.click(createButton)
    expect(input.readOnly).toBe(true)
    expect(createButton.disabled).toBe(true)
    expect(cancelButton.disabled).toBe(true)

    await user.click(createButton)
    input.focus()
    await user.keyboard('{Enter}{Enter}')
    await flushPending()
    expect(mockedCreateRoom).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(fail('INTERNAL'))
    })
    expect(input.readOnly).toBe(false)
    expect(cancelButton.disabled).toBe(false)
  })

  it('TC-RM-022: 리렌더 전 같은 틱에 만들기 2회 → createRoom 1회(submitInFlightRef)', async () => {
    const pending = deferred<Result<RoomSummary>>()
    mockedCreateRoom.mockReturnValueOnce(pending.promise)
    renderRooms()
    const { input, createButton } = await openRow()
    fireEvent.change(input, { target: { value: '안개 낀 런던' } })

    act(() => {
      fireEvent.click(createButton)
      fireEvent.click(createButton)
    })
    await flushPending()
    expect(mockedCreateRoom).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending.resolve(ok(CREATED))
    })
  })

  it.each([
    ['INTERNAL', undefined, ERROR_MESSAGES.INTERNAL, 'danger'],
    ['RATE_LIMITED', 40, '요청이 너무 많습니다. 40초 후 다시 시도해 주세요.', 'warning'],
    ['RATE_LIMITED', undefined, ERROR_MESSAGES.RATE_LIMITED, 'warning'],
    ['NETWORK', undefined, '서버에 연결할 수 없습니다.', 'danger'],
    // (S6 개정, lock.md D-L12 · design.md §8.3) 옛 문구 「방 제목은 1~60자로 입력해 주세요.」 대체
    ['VALIDATION_ERROR', undefined, '방 제목(1~60자)과 비밀번호(4~32자)를 확인해 주세요.', 'danger'],
  ] as const)(
    'TC-RM-023: 생성 실패 %s(retryAfterSec=%s) → 토스트 문구·톤, 입력 유지, 2초 뒤 사라짐, 전환 없음',
    async (code, retryAfterSec, text, tone) => {
      const pending = deferred<Result<RoomSummary>>()
      mockedCreateRoom.mockReturnValueOnce(pending.promise)
      const { onAuthFailure, onOpenRoom } = renderRooms()
      const { user, group, input, createButton } = await openRow()
      await user.type(input, '안개 낀 런던')
      await user.click(createButton)

      vi.useFakeTimers()
      await act(async () => {
        pending.resolve(fail(code, retryAfterSec))
      })

      // ⓐ 화면
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toBe(text)
      expect(alert.classList.contains(tone)).toBe(true)
      expect(screen.queryByText(new RegExp(SERVER_RAW))).toBeNull()
      expect(screen.getByRole('group', { name: NEW_ROOM })).toBe(group)
      expect(input.value).toBe('안개 낀 런던')
      expect(createButton.disabled).toBe(false)
      expect(screen.getByRole('button', { name: NEW_ROOM })).not.toBeNull()
      act(() => {
        vi.advanceTimersByTime(1999)
      })
      expect(screen.queryByRole('alert')).not.toBeNull()
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.queryByRole('alert')).toBeNull()
      // ⓑ 상태
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(onOpenRoom).not.toHaveBeenCalled()
      expect(localStorage.length).toBe(0)
      // ⓒ api
      expect(mockedCreateRoom).toHaveBeenCalledTimes(1)
      expect(mockedCreateRoom.mock.calls[0]).toEqual([{ title: '안개 낀 런던' }])

      // 재제출(TK-06): 실패 뒤 같은 입력으로 다시 만들기 → 2회째 같은 인자, 성공이면 onOpenRoom 1회
      mockedCreateRoom.mockResolvedValueOnce(ok(CREATED))
      await act(async () => {
        fireEvent.click(createButton)
      })
      await flushPending()
      expect(mockedCreateRoom).toHaveBeenCalledTimes(2)
      expect(mockedCreateRoom.mock.calls[1]).toEqual([{ title: '안개 낀 런던' }])
      expect(onOpenRoom).toHaveBeenCalledTimes(1)
      expect(onOpenRoom.mock.calls[0]?.[0]).toEqual(CREATED)
    },
  )

  it.each([
    ['LEVEL_TOO_LOW', '대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.'],
    ['TOKEN_INVALID', '인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.'],
    ['TOKEN_REQUIRED', '로그인 정보가 없어 열람 전용으로 바뀌었습니다.'],
  ] as const)(
    'TC-RM-024: 인증 실패 %s → onAuthFailure 1회 + 전환 안내(warning), 전환 뒤 쓰기 UI 없음·h1 포커스',
    async (code, text) => {
      mockedCreateRoom.mockResolvedValueOnce(fail(code))
      const { onAuthFailure, rerenderWith } = renderRooms()
      const { user, input, createButton } = await openRow()
      await user.type(input, '안개 낀 런던')
      await user.click(createButton)

      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toBe(text)
      expect(alert.classList.contains('warning')).toBe(true)
      expect(onAuthFailure).toHaveBeenCalledTimes(1)

      // App 이 viewer 를 READ_ONLY 로 바꾼 것을 흉내 낸다(F-RM-12 → F-RM-19)
      rerenderWith(READ_ONLY_VIEWER)
      expect(screen.queryByRole('button', { name: NEW_ROOM })).toBeNull()
      expect(screen.queryByRole('group', { name: NEW_ROOM })).toBeNull()
      expect(screen.queryByRole('textbox')).toBeNull()
      await vi.waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('heading', { level: 1, name: 'ROOMS' }),
        ),
      )
      expect(screen.getByRole('button', { name: ROW_TEA })).not.toBeNull()
      await flushPending()
      expect(mockedCreateRoom).toHaveBeenCalledTimes(1)
      expect(onAuthFailure).toHaveBeenCalledTimes(1)
    },
  )
})

describe('RoomsScreen 취소·Esc·Enter (R-ROOMS-002 · a11y)', () => {
  it('TC-RM-025: 취소 → 입력 행 닫힘·「+ 새 방」 포커스 → 다시 열면 빈 입력', async () => {
    renderRooms()
    const { user, input, cancelButton } = await openRow()
    await user.type(input, '임시')
    await user.click(cancelButton)

    expect(screen.queryByRole('group', { name: NEW_ROOM })).toBeNull()
    const newRoomButton = screen.getByRole('button', { name: NEW_ROOM })
    expect(document.activeElement).toBe(newRoomButton)
    await user.click(newRoomButton)
    const reopened = screen.getByRole('textbox', { name: INPUT }) as HTMLInputElement
    expect(reopened.value).toBe('')
    expect(screen.getByText('0/60')).not.toBeNull()
    await flushPending()
    expect(mockedCreateRoom).not.toHaveBeenCalled()
  })

  it('TC-RM-025: Esc → 닫힘·「+ 새 방」 포커스, 요청 중 Esc 는 무시', async () => {
    renderRooms()
    const { user, input } = await openRow()
    await user.type(input, '임시')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: NEW_ROOM })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: NEW_ROOM }))

    const pending = deferred<Result<RoomSummary>>()
    mockedCreateRoom.mockReturnValueOnce(pending.promise)
    await user.click(screen.getByRole('button', { name: NEW_ROOM }))
    const again = screen.getByRole('textbox', { name: INPUT }) as HTMLInputElement
    await user.type(again, '안개 낀 런던')
    await user.click(screen.getByRole('button', { name: '만들기' }))
    again.focus()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('group', { name: NEW_ROOM })).not.toBeNull()
    expect(again.value).toBe('안개 낀 런던')
    expect(mockedCreateRoom).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending.resolve(fail('INTERNAL'))
    })
  })

  // (S6 개정) (d) "유효 제목 Enter → createRoom 1회"는 폐기 — 제목 Enter = 비밀번호 칸으로 포커스(D-L3).
  // 새 기대는 NewRoomLock.test.tsx TC-RM-054(a). 여기서는 (a)(b)(c) "제목 Enter 는 제출하지 않는다"만 남긴다.
  it('TC-RM-026: IME 조합 Enter·keyCode 229·무효 제목 Enter → 호출 없음 ((d)는 TC-RM-054 로 개정)', async () => {
    renderRooms()
    const { user, input } = await openRow()

    fireEvent.change(input, { target: { value: '안개 낀 런던' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', isComposing: true })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 229 })
    await flushPending()
    expect(input.value).toBe('안개 낀 런던') // (a)(b) 입력값 그대로(TK-07)
    expect(input.readOnly).toBe(false)
    fireEvent.change(input, { target: { value: '   ' } })
    await user.keyboard('{Enter}')
    await flushPending()
    expect(input.value).toBe('   ') // (c) 입력값 그대로
    expect(mockedCreateRoom).not.toHaveBeenCalled()
    expect(screen.getByRole('group', { name: NEW_ROOM })).not.toBeNull()
  })
})
