/**
 * rooms 화면 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md
 * 대상: RoomsScreen(ui/src/rooms/index.tsx) · RoomList · ListRow · StateView · TopBar
 * - api 래퍼는 vi.mock('@/api/rooms') 로 대체한다. fetch 모킹 금지.
 * - 문구는 design.md §8 확정 문구를 그대로 단언한다(labels.ts 를 import 하지 않는다 — 문구 자체를 검증).
 * - vitest globals 미설정 → RTL 자동 cleanup 이 없으므로 afterEach 에서 cleanup() 을 직접 부른다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ERROR_MESSAGES } from '@shared/errors'
import type { RoomSummary } from '@shared/types'
import type { ApiErrorCode, Result } from '@/api'
import { listRooms } from '@/api/rooms'
import { RoomsScreen } from '@/rooms'
import { READ_ONLY_VIEWER } from '@/state/viewer'

vi.mock('@/api/rooms', () => ({ listRooms: vi.fn() }))

const mockedListRooms = vi.mocked(listRooms)

// ── 픽스처 ─────────────────────────────────────────────
// 일부러 updatedAt 오름차순으로 넣는다. 화면이 다시 정렬하면 TC-RM-001 이 잡는다.
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
const ROOMS: RoomSummary[] = [ROOM_CHESS, ROOM_TEA]
const ROW_CHESS = '체스 대결, 마지막 갱신 10.03'
const ROW_TEA = '티타임, 마지막 갱신 10.05'
const SERVER_RAW = 'SERVER-RAW-MESSAGE'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fail = (code: ApiErrorCode, message = SERVER_RAW): Result<never> => ({
  ok: false,
  error: { code, message },
})

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}

const renderRooms = (autoOpenRoomId: string | null = null) => {
  const onOpenRoom = vi.fn()
  const onAutoOpenSettled = vi.fn()
  const view = render(
    <RoomsScreen
      viewer={READ_ONLY_VIEWER}
      autoOpenRoomId={autoOpenRoomId}
      onOpenRoom={onOpenRoom}
      onAutoOpenSettled={onAutoOpenSettled}
      onAuthFailure={vi.fn()}
    />,
  )
  return { ...view, onOpenRoom, onAutoOpenSettled }
}

const expectNoWriteUi = () => {
  expect(screen.queryByRole('button', { name: /새 방/ })).toBeNull()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByText(/새 방/)).toBeNull()
}

beforeEach(() => {
  mockedListRooms.mockReset()
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ── 목록 렌더·진입 ─────────────────────────────────────
describe('RoomsScreen 목록 (R-ROOMS-001 · R-ROOM-001)', () => {
  it('TC-RM-001: 받은 순서 그대로 제목·updatedAt MM.DD 를 그리고 다시 정렬하지 않는다', async () => {
    mockedListRooms.mockResolvedValueOnce(ok(ROOMS))
    renderRooms()

    const list = await screen.findByRole('list')
    const rows = within(list).getAllByRole('button')
    // ⓐ 화면
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(rows.map(row => row.getAttribute('aria-label'))).toEqual([ROW_CHESS, ROW_TEA])
    expect(rows[0]?.textContent).toContain('체스 대결')
    const chessTime = rows[0]?.querySelector('time')
    expect(chessTime?.textContent).toBe('10.03')
    expect(chessTime?.getAttribute('datetime')).toBe('2026-10-03')
    expect(rows[1]?.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-05')
    // ⓑ 저장 — 저장된 방이 없으면 저장소를 건드리지 않는다
    expect(localStorage.length).toBe(0)
    // ⓒ api — 인자 없이 1회
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
    expect(mockedListRooms.mock.calls[0]).toEqual([])
  })

  it('TC-RM-002: 행 클릭 → onOpenRoom 이 그 RoomSummary 로 1회 호출된다', async () => {
    mockedListRooms.mockResolvedValueOnce(ok(ROOMS))
    const { onOpenRoom } = renderRooms()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: ROW_TEA }))

    // ⓐ·ⓑ 전환은 App 몫 — RoomsScreen 은 콜백만 부른다. 마지막 본 방 저장은 ChatScreen 몫(F-RM-02)
    expect(onOpenRoom).toHaveBeenCalledTimes(1)
    expect(onOpenRoom.mock.calls[0]?.[0]).toEqual(ROOM_TEA)
    expect(localStorage.getItem('ld:lastRoomId')).toBeNull()
    // ⓒ 클릭으로 재요청하지 않는다
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-003: 행 포커스 후 Enter·Space → onOpenRoom', async () => {
    mockedListRooms.mockResolvedValueOnce(ok(ROOMS))
    const { onOpenRoom } = renderRooms()
    const user = userEvent.setup()

    const row = await screen.findByRole('button', { name: ROW_TEA })
    row.focus()
    await user.keyboard('{Enter}')
    expect(onOpenRoom).toHaveBeenCalledTimes(1)
    await user.keyboard('[Space]')
    expect(onOpenRoom).toHaveBeenCalledTimes(2)
    expect(onOpenRoom.mock.calls[1]?.[0]).toEqual(ROOM_TEA)
    expect(localStorage.getItem('ld:lastRoomId')).toBeNull()
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })
})

// ── 상태 3종 ───────────────────────────────────────────
describe('RoomsScreen 상태 (R-ROOMS-003)', () => {
  it('TC-RM-004: listRooms 대기 중 role=status "불러오는 중"', async () => {
    const pending = deferred<Result<RoomSummary[]>>()
    mockedListRooms.mockReturnValueOnce(pending.promise)
    const { onAutoOpenSettled } = renderRooms()

    // ⓐ
    expect(screen.getByRole('status').textContent).toContain('불러오는 중')
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    // ⓑ 판정 전
    expect(onAutoOpenSettled).not.toHaveBeenCalled()
    // ⓒ
    expect(mockedListRooms).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(ok(ROOMS))
    })
    expect(await screen.findByRole('list')).not.toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('TC-RM-005: [] → "아직 방이 없습니다", 목록 ul 없음', async () => {
    mockedListRooms.mockResolvedValueOnce(ok([]))
    const { onAutoOpenSettled, onOpenRoom } = renderRooms()

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('아직 방이 없습니다'),
    )
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onAutoOpenSettled).toHaveBeenCalledTimes(1)
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-006: 실패 → role=alert 제목·상세·「다시 시도」, 클릭 → listRooms 2회째, 성공 시 목록', async () => {
    mockedListRooms.mockResolvedValueOnce(fail('INTERNAL'))
    const second = deferred<Result<RoomSummary[]>>()
    mockedListRooms.mockReturnValueOnce(second.promise)
    const { onAutoOpenSettled } = renderRooms()
    const user = userEvent.setup()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('목록을 불러오지 못했습니다')
    expect(alert.textContent).toContain(ERROR_MESSAGES.INTERNAL)
    expect(screen.queryByRole('list')).toBeNull()
    expect(onAutoOpenSettled).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(mockedListRooms).toHaveBeenCalledTimes(2)
    expect(mockedListRooms.mock.calls[1]).toEqual([])
    expect(screen.getByRole('status').textContent).toContain('불러오는 중')
    expect(screen.queryByRole('alert')).toBeNull()

    await act(async () => {
      second.resolve(ok(ROOMS))
    })
    expect(await screen.findByRole('button', { name: ROW_CHESS })).not.toBeNull()
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(onAutoOpenSettled).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['NETWORK', '서버에 연결할 수 없습니다.'],
    ['INTERNAL', ERROR_MESSAGES.INTERNAL],
    ['CONFIG_INVALID', ERROR_MESSAGES.CONFIG_INVALID],
  ] as const)(
    'TC-RM-007: 오류 상세 %s → 코드별 문구, 서버 message 미표시',
    async (code, detail) => {
      mockedListRooms.mockResolvedValueOnce(fail(code))
      renderRooms()

      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toContain('목록을 불러오지 못했습니다')
      expect(alert.textContent).toContain(detail)
      expect(screen.queryByText(new RegExp(SERVER_RAW))).toBeNull()
      expect(localStorage.length).toBe(0)
      expect(mockedListRooms).toHaveBeenCalledTimes(1)
    },
  )
})

// ── 마지막 본 방 자동 진입 ─────────────────────────────
describe('RoomsScreen 자동 진입 (R-ROOMS-004 · R-CHAT-010)', () => {
  it('TC-RM-008: 저장 id 가 목록에 있음 → onAutoOpenSettled 후 onOpenRoom(그 방)', async () => {
    localStorage.setItem('ld:lastRoomId', 'r1')
    mockedListRooms.mockResolvedValueOnce(ok(ROOMS))
    const { onOpenRoom, onAutoOpenSettled } = renderRooms('r1')

    await waitFor(() => expect(onOpenRoom).toHaveBeenCalledTimes(1))
    // ⓐ 판정은 목록 응답이 성공(ready)한 뒤에만 일어난다 → 판정 후 로딩·빈(status)·오류(alert) 표시가 없다.
    //   "목록이 한 번 그려진 뒤 전환"은 단언하지 않는다(React 19 배칭으로 보장 안 됨 — CF-01, 설계 §6.2 갱신 예정)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    // ⓑ 순서: settle → open. 기록은 그대로
    expect(onOpenRoom.mock.calls[0]?.[0]).toEqual(ROOM_TEA)
    expect(onAutoOpenSettled).toHaveBeenCalledTimes(1)
    expect(onAutoOpenSettled.mock.invocationCallOrder[0]).toBeLessThan(
      onOpenRoom.mock.invocationCallOrder[0] ?? Number.NaN,
    )
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    // ⓒ 단건 조회 없음 — 목록 1회로 판정
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-009: 저장 id 가 목록에 없음 → ld:lastRoomId 삭제, onOpenRoom 미호출, 목록 유지', async () => {
    localStorage.setItem('ld:lastRoomId', 'gone')
    mockedListRooms.mockResolvedValueOnce(ok(ROOMS))
    const { onOpenRoom, onAutoOpenSettled } = renderRooms('gone')

    await waitFor(() => expect(onAutoOpenSettled).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: ROW_CHESS })).not.toBeNull()
    expect(localStorage.getItem('ld:lastRoomId')).toBeNull()
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-009: 저장 id 없음(null) → onAutoOpenSettled 만 1회, onOpenRoom 미호출', async () => {
    mockedListRooms.mockResolvedValueOnce(ok(ROOMS))
    const { onOpenRoom, onAutoOpenSettled } = renderRooms(null)

    await screen.findByRole('list')
    await waitFor(() => expect(onAutoOpenSettled).toHaveBeenCalledTimes(1))
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-010: 대상 없음 판정 중 removeItem 이 throw 해도 화면은 일반 목록', async () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    mockedListRooms.mockResolvedValueOnce(ok(ROOMS))
    const { onOpenRoom, onAutoOpenSettled } = renderRooms('gone')

    expect(await screen.findByRole('button', { name: ROW_TEA })).not.toBeNull()
    await waitFor(() => expect(onAutoOpenSettled).toHaveBeenCalledTimes(1))
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-014: 첫 로드 실패 → 자동 진입 보류 → 재시도 성공 시 그때 진입', async () => {
    localStorage.setItem('ld:lastRoomId', 'r1')
    mockedListRooms.mockResolvedValueOnce(fail('NETWORK'))
    mockedListRooms.mockResolvedValueOnce(ok(ROOMS))
    const { onOpenRoom, onAutoOpenSettled } = renderRooms('r1')
    const user = userEvent.setup()

    expect((await screen.findByRole('alert')).textContent).toContain('서버에 연결할 수 없습니다.')
    expect(onAutoOpenSettled).not.toHaveBeenCalled()
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')

    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(onOpenRoom).toHaveBeenCalledTimes(1))
    expect(onOpenRoom.mock.calls[0]?.[0]).toEqual(ROOM_TEA)
    expect(onAutoOpenSettled).toHaveBeenCalledTimes(1)
    expect(onAutoOpenSettled.mock.invocationCallOrder[0]).toBeLessThan(
      onOpenRoom.mock.invocationCallOrder[0] ?? Number.NaN,
    )
    expect(mockedListRooms).toHaveBeenCalledTimes(2)
  })
})

// ── 읽기 전용 부재 ─────────────────────────────────────
describe('RoomsScreen 읽기 전용 (R-CHAT-008 · R-ROOMS-002 부재 쪽)', () => {
  it('TC-RM-011: 로딩·목록 상태 모두 「+ 새 방」 버튼·텍스트 입력이 DOM 에 없다', async () => {
    const pending = deferred<Result<RoomSummary[]>>()
    mockedListRooms.mockReturnValueOnce(pending.promise)
    const { container } = renderRooms()

    expectNoWriteUi()
    await act(async () => {
      pending.resolve(ok(ROOMS))
    })
    await screen.findByRole('list')
    expectNoWriteUi()
    // 상단 바에는 버튼이 없다(right 슬롯 미렌더). 화면의 버튼은 행 2개뿐
    const header = container.querySelector('header')
    expect(header).not.toBeNull()
    expect(within(header as HTMLElement).queryAllByRole('button')).toHaveLength(0)
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual([
      ROW_CHESS,
      ROW_TEA,
    ])
    expect(READ_ONLY_VIEWER.canWrite).toBe(false)
    expect(localStorage.length).toBe(0)
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-011: 빈 목록에서도 새 방 유도·버튼이 없다', async () => {
    mockedListRooms.mockResolvedValueOnce(ok([]))
    renderRooms()

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('아직 방이 없습니다'),
    )
    expectNoWriteUi()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })
})

// ── 늦은 응답 ─────────────────────────────────────────
describe('RoomsScreen 언마운트 후 응답 (F-RM-06 isActiveRef)', () => {
  it('TC-RM-016: 응답 전 언마운트 → 자동 진입 콜백 없음, 오류 로그 없음', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('ld:lastRoomId', 'r1')
    const pending = deferred<Result<RoomSummary[]>>()
    mockedListRooms.mockReturnValueOnce(pending.promise)
    const { unmount, onOpenRoom, onAutoOpenSettled } = renderRooms('r1')

    unmount()
    await act(async () => {
      pending.resolve(ok(ROOMS))
      await pending.promise
    })

    expect(screen.queryByRole('list')).toBeNull()
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(onAutoOpenSettled).not.toHaveBeenCalled()
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    expect(errorSpy).not.toHaveBeenCalled()
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-016: 응답 전 언마운트 → 목록에 없는 저장 id 도 지우지 않는다(판정 자체를 하지 않음)', async () => {
    localStorage.setItem('ld:lastRoomId', 'gone')
    const pending = deferred<Result<RoomSummary[]>>()
    mockedListRooms.mockReturnValueOnce(pending.promise)
    const { unmount, onAutoOpenSettled } = renderRooms('gone')

    unmount()
    await act(async () => {
      pending.resolve(ok(ROOMS))
      await pending.promise
    })

    expect(localStorage.getItem('ld:lastRoomId')).toBe('gone')
    expect(onAutoOpenSettled).not.toHaveBeenCalled()
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })
})

// ── 접근성 ─────────────────────────────────────────────
describe('RoomsScreen 접근성 (R-ROOMS-005 · a11y.md)', () => {
  it('TC-RM-017: 마운트 시 h1 포커스, main 이름, ul aria-label 없음, 행 이름, Tab 순서', async () => {
    mockedListRooms.mockResolvedValueOnce(ok(ROOMS))
    renderRooms()
    const user = userEvent.setup()

    const h1 = screen.getByRole('heading', { level: 1, name: 'ROOMS' })
    expect(document.activeElement).toBe(h1)
    expect(h1.getAttribute('tabindex')).toBe('-1')
    expect(screen.getByRole('main', { name: '방 목록' })).not.toBeNull()

    const list = await screen.findByRole('list')
    expect(list.getAttribute('aria-label')).toBeNull()
    const chess = screen.getByRole('button', { name: ROW_CHESS })
    const tea = screen.getByRole('button', { name: ROW_TEA })
    expect(chess.getAttribute('type')).toBe('button')

    await user.tab()
    expect(document.activeElement).toBe(chess)
    await user.tab()
    expect(document.activeElement).toBe(tea)
    expect(localStorage.length).toBe(0)
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-017: 오류 상태에서 Tab → 「다시 시도」', async () => {
    mockedListRooms.mockResolvedValueOnce(fail('INTERNAL'))
    renderRooms()
    const user = userEvent.setup()

    await screen.findByRole('alert')
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '다시 시도' }))
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })
})
