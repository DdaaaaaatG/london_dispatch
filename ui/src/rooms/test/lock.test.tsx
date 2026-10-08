/**
 * rooms S6 화면 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-041 ~ 053 · 058 · 067)
 * 대상: RoomsScreen(S6) · RoomList/ListRow 잠긴 변형 · useRoomEntry · RoomEntrySheet · PromptSheet(password)
 * - 설계: ui/src/rooms/design/lock.md (F-RM-40~54 · §6.7 · §6.8 · §6.10 · §8 · §10) · design/components.md §1.21~§1.23 · §2.1 · §2.2
 * - 토큰은 viewer props 로만 준다(WRITER_VIEWER / READ_ONLY_VIEWER). App 통합은 LockFlow.test.tsx.
 * - api 래퍼는 vi.mock('@/api/rooms') 로 대체한다(enterRoom · setRoomPassword · clearRoomPassword 추가).
 *   useRoomEntry 가 '@/api' 재노출로 import 해도 같은 모듈이 모킹된다. isAuthFailure 는 실물. fetch 모킹 금지.
 * - 문구는 design 확정 문구를 그대로 단언한다(labels.ts · roomEntryText.ts 를 import 하지 않는다).
 * - 매 TC 전 localStorage.clear() → resetRoomKeyCache()(증명 캐시 슬롯 초기화, F-RM-37).
 * - 증명·비밀번호 값은 자리표시 문자열이다(실값 아님).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ERROR_MESSAGES } from '@shared/errors'
import type { EnterRoomResponse, RoomSummary } from '@shared/types'
import type { ApiErrorCode, Result } from '@/api'
import {
  clearRoomPassword,
  createRoom,
  deleteRoom,
  enterRoom,
  listRooms,
  renameRoom,
  setRoomPassword,
} from '@/api/rooms'
import { RoomsScreen } from '@/rooms'
import { resetRoomKeyCache } from '@/state/roomKeys'
import { READ_ONLY_VIEWER, WRITER_VIEWER, type Viewer } from '@/state/viewer'

vi.mock('@/api/rooms', () => ({
  listRooms: vi.fn(),
  createRoom: vi.fn(),
  renameRoom: vi.fn(),
  deleteRoom: vi.fn(),
  enterRoom: vi.fn(),
  setRoomPassword: vi.fn(),
  clearRoomPassword: vi.fn(),
}))

const mockedListRooms = vi.mocked(listRooms)
const mockedEnterRoom = vi.mocked(enterRoom)
const otherMocks = [createRoom, renameRoom, deleteRoom, setRoomPassword, clearRoomPassword].map(f => vi.mocked(f))

// ── 픽스처 ─────────────────────────────────────────────
const ROOM_CHESS: RoomSummary = {
  id: 'r2',
  title: '체스 대결',
  createdAt: new Date(2026, 9, 1, 9, 0).getTime(),
  updatedAt: new Date(2026, 9, 3, 21, 5).getTime(),
  messageCount: 4,
  locked: false,
}
const ROOM_SECRET: RoomSummary = {
  id: 'r3',
  title: '비밀 다과회',
  createdAt: new Date(2026, 9, 2, 8, 0).getTime(),
  updatedAt: new Date(2026, 9, 4, 22, 10).getTime(), // 10.04 — 화면 어디에도 나오면 안 된다
  messageCount: 7,
  locked: true,
}
const ROOM_TEA: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 2, 10, 0).getTime(),
  updatedAt: new Date(2026, 9, 5, 16, 40).getTime(),
  messageCount: 12,
  locked: false,
}
/** 일부러 내림차순이 아닌 순서 — 화면 재정렬 감지용 */
const ROOMS: RoomSummary[] = [ROOM_CHESS, ROOM_SECRET, ROOM_TEA]
const ROW_CHESS = '체스 대결, 마지막 갱신 10.03'
const ROW_SECRET = '비밀 다과회, 잠긴 방'
const ROW_TEA = '티타임, 마지막 갱신 10.05'
const NEW_ROOM = '새 방 만들기'
const SHEET = '비밀번호'
const SHEET_INPUT = '방 비밀번호'
const SERVER_RAW = 'SERVER-RAW-MESSAGE'
const KEYS = 'ld:roomKeys'

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
const storageValues = (): string[] => {
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) out.push(localStorage.getItem(localStorage.key(i) ?? '') ?? '')
  for (let i = 0; i < sessionStorage.length; i += 1) out.push(sessionStorage.getItem(sessionStorage.key(i) ?? '') ?? '')
  return out
}

const renderRooms = (viewer: Viewer, autoOpenRoomId: string | null = null) => {
  const onOpenRoom = vi.fn()
  const onAutoOpenSettled = vi.fn()
  const onAuthFailure = vi.fn()
  const props = { autoOpenRoomId, onOpenRoom, onAutoOpenSettled, onAuthFailure }
  const view = render(<RoomsScreen viewer={viewer} {...props} />)
  const rerenderWith = (next: Viewer) => view.rerender(<RoomsScreen viewer={next} {...props} />)
  return { ...view, onOpenRoom, onAutoOpenSettled, onAuthFailure, rerenderWith }
}

/** 목록이 그려진 뒤 잠긴 행을 탭한다 */
const tapSecret = async () => {
  const user = userEvent.setup()
  const row = await screen.findByRole('button', { name: ROW_SECRET })
  await user.click(row)
  return { user, row }
}
/** 열린 입장 시트의 요소들 */
const sheetParts = () => {
  const dialog = screen.getByRole('dialog', { name: SHEET })
  const input = within(dialog).getByLabelText(SHEET_INPUT) as HTMLInputElement
  const submit = within(dialog).getByRole('button', { name: '입장' }) as HTMLButtonElement
  const cancel = within(dialog).getByRole('button', { name: '취소' }) as HTMLButtonElement
  return { dialog, input, submit, cancel }
}

beforeEach(() => {
  mockedListRooms.mockReset()
  mockedEnterRoom.mockReset()
  for (const m of otherMocks) m.mockReset()
  mockedListRooms.mockResolvedValue(ok(ROOMS))
  localStorage.clear()
  sessionStorage.clear()
  resetRoomKeyCache()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  resetRoomKeyCache()
})

describe('잠긴 행 표시 (R-LOCK-003 · R-ROOMS-001 S6 · F-RM-54)', () => {
  it.each([
    ['토큰 없음', READ_ONLY_VIEWER],
    ['토큰 있음', WRITER_VIEWER],
  ])('TC-RM-041: %s — 잠긴 행은 자물쇠(aria-hidden)+제목, <time>·날짜 없음 · 안 잠긴 행 불변 · 받은 순서', async (_, viewer) => {
    renderRooms(viewer)
    const locked = await screen.findByRole('button', { name: ROW_SECRET })

    // ⓐ 잠긴 행
    expect(locked.querySelectorAll('svg')).toHaveLength(1)
    const svg = locked.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('focusable')).toBe('false')
    expect(locked.querySelectorAll('time')).toHaveLength(0)
    expect(locked.textContent).toContain('비밀 다과회')
    expect(locked.textContent).not.toContain('10.04')
    expect(screen.queryByText(/10\.04/)).toBeNull()
    // ⓐ 안 잠긴 행 불변
    const tea = screen.getByRole('button', { name: ROW_TEA })
    expect(tea.querySelector('time')?.getAttribute('dateTime')).toBe('2026-10-05')
    expect(tea.querySelector('svg')).toBeNull()
    // ⓐ 순서 = 받은 배열
    const names = within(screen.getByRole('list'))
      .getAllByRole('button')
      .map(b => b.getAttribute('aria-label'))
    expect(names).toEqual([ROW_CHESS, ROW_SECRET, ROW_TEA])
    // ⓑ
    expect(localStorage.length).toBe(0)
    // ⓒ
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
    expect(mockedEnterRoom).not.toHaveBeenCalled()
    for (const m of otherMocks) expect(m).not.toHaveBeenCalled()
  })
})

describe('방 접근 판정 ①② (F-RM-41 · §6.7)', () => {
  it.each([
    ['토큰 없음', READ_ONLY_VIEWER],
    ['토큰 있음', WRITER_VIEWER],
  ])('TC-RM-042: %s — 안 잠긴 행 탭 → onOpenRoom 1회, enterRoom 0, 시트 없음', async (_, viewer) => {
    const user = userEvent.setup()
    const { onOpenRoom } = renderRooms(viewer)
    await user.click(await screen.findByRole('button', { name: ROW_TEA }))
    await flushPending()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onOpenRoom).toHaveBeenCalledTimes(1)
    expect(onOpenRoom.mock.calls[0]?.[0]).toEqual(ROOM_TEA)
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(mockedEnterRoom).not.toHaveBeenCalled()
  })

  it.each([
    ['토큰 없음', READ_ONLY_VIEWER],
    ['토큰 있음', WRITER_VIEWER],
  ])('TC-RM-043: %s — 잠긴 행 + 저장된 증명 → 시트 없이 onOpenRoom 1회, enterRoom 0', async (_, viewer) => {
    localStorage.setItem(KEYS, '[["r3","e1.x"]]')
    const { onOpenRoom } = renderRooms(viewer)
    await tapSecret()
    await flushPending()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onOpenRoom).toHaveBeenCalledTimes(1)
    expect(onOpenRoom.mock.calls[0]?.[0]).toEqual(ROOM_SECRET)
    expect(localStorage.getItem(KEYS)).toBe('[["r3","e1.x"]]')
    expect(mockedEnterRoom).not.toHaveBeenCalled()
  })
})

describe('판정 ③ 조용한 시도 · ④ 읽기 전용 (F-RM-41·42 · R-LOCK-005 · R-LOCK-006)', () => {
  it('TC-RM-044(a): 토큰 있음·증명 없음 → enterRoom(r3) 인자 1개 → entryKey 문자열 저장 → onOpenRoom, 대기 중 표시 없음', async () => {
    const pending = deferred<Result<EnterRoomResponse>>()
    mockedEnterRoom.mockReturnValueOnce(pending.promise)
    const { onOpenRoom } = renderRooms(WRITER_VIEWER)
    await tapSecret()

    // 대기 중: 진행 표시·시트 없음(D-L9)
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
    expect(mockedEnterRoom.mock.calls[0]).toHaveLength(1)
    expect(mockedEnterRoom.mock.calls[0]?.[0]).toBe('r3')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onOpenRoom).not.toHaveBeenCalled()

    await act(async () => {
      pending.resolve(ok({ entryKey: 'e1.x' }))
    })
    await waitFor(() => expect(onOpenRoom).toHaveBeenCalledTimes(1))
    expect(onOpenRoom.mock.calls[0]?.[0]).toEqual(ROOM_SECRET)
    expect(localStorage.getItem(KEYS)).toBe('[["r3","e1.x"]]')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('TC-RM-044(b): entryKey null → 저장 없이 onOpenRoom 1회', async () => {
    mockedEnterRoom.mockResolvedValueOnce(ok({ entryKey: null }))
    const { onOpenRoom } = renderRooms(WRITER_VIEWER)
    await tapSecret()

    await waitFor(() => expect(onOpenRoom).toHaveBeenCalledTimes(1))
    expect(onOpenRoom.mock.calls[0]?.[0]).toEqual(ROOM_SECRET)
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-045: ROOM_LOCKED → 입장 시트(문구 없음)·입력 포커스, 진입 없음, 읽기 전용 전환 없음', async () => {
    mockedEnterRoom.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    const { onOpenRoom, onAuthFailure } = renderRooms(WRITER_VIEWER)
    await tapSecret()

    const dialog = await screen.findByRole('dialog', { name: SHEET })
    const { input, submit, cancel } = sheetParts()
    // ⓐ
    expect(within(dialog).getByRole('heading', { level: 2, name: SHEET })).not.toBeNull()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    await waitFor(() => expect(document.activeElement).toBe(input))
    expect(input.value).toBe('')
    expect(within(dialog).queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(submit.disabled).toBe(true)
    expect(cancel.disabled).toBe(false)
    expect(screen.getByRole('button', { name: NEW_ROOM })).not.toBeNull()
    const list = screen.getByRole('list')
    expect(list.compareDocumentPosition(dialog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // ⓑ
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEYS)).toBeNull()
    // ⓒ
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
    expect(mockedEnterRoom.mock.calls[0]).toHaveLength(1)
  })

  it('TC-RM-046: 토큰 없음 → 탭 즉시 시트(문구 없음), enterRoom 0', async () => {
    const { onOpenRoom } = renderRooms(READ_ONLY_VIEWER)
    await tapSecret()

    const { input, submit } = sheetParts()
    await waitFor(() => expect(document.activeElement).toBe(input))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(submit.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: NEW_ROOM })).toBeNull()
    await flushPending()
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(mockedEnterRoom).not.toHaveBeenCalled()
  })
})

describe('입장 시트 제출 (F-RM-43 · §6.8 · R-LOCK-004 · R-LOCK-007 · R-LOCK-008)', () => {
  it('TC-RM-047(a): pw1234 → 입장 → enterRoom(r3, pw1234) → 대기 잠금 → 성공: 시트 닫힘·증명 저장·진입, 원문 미저장', async () => {
    const pending = deferred<Result<EnterRoomResponse>>()
    mockedEnterRoom.mockReturnValueOnce(pending.promise)
    const { onOpenRoom } = renderRooms(READ_ONLY_VIEWER)
    const { user } = await tapSecret()
    const { input, submit, cancel } = sheetParts()

    await user.type(input, 'pw1234')
    await user.click(submit)
    // 요청 중
    expect(input.readOnly).toBe(true)
    expect(submit.disabled).toBe(true)
    expect(cancel.disabled).toBe(true)
    expect(mockedEnterRoom.mock.calls[0]).toEqual(['r3', 'pw1234'])

    await act(async () => {
      pending.resolve(ok({ entryKey: 'e1.x' }))
    })
    await waitFor(() => expect(onOpenRoom).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onOpenRoom.mock.calls[0]?.[0]).toEqual(ROOM_SECRET)
    expect(localStorage.getItem(KEYS)).toBe('[["r3","e1.x"]]')
    expect(storageValues().some(v => v.includes('pw1234'))).toBe(false)
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-047(b): 성공 entryKey null(그사이 해제) → 시트 닫힘·저장 없이 진입', async () => {
    mockedEnterRoom.mockResolvedValueOnce(ok({ entryKey: null }))
    const { onOpenRoom } = renderRooms(READ_ONLY_VIEWER)
    const { user } = await tapSecret()
    const { input, submit } = sheetParts()
    await user.type(input, 'pw1234')
    await user.click(submit)

    await waitFor(() => expect(onOpenRoom).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(mockedEnterRoom.mock.calls[0]).toEqual(['r3', 'pw1234'])
  })

  it('TC-RM-048: ROOM_PASSWORD_WRONG → alert 「비밀번호가 맞지 않습니다.」, 시트·입력값 유지, 버튼 활성 복귀', async () => {
    mockedEnterRoom.mockResolvedValueOnce(fail('ROOM_PASSWORD_WRONG'))
    const { onOpenRoom } = renderRooms(READ_ONLY_VIEWER)
    const { user } = await tapSecret()
    const { dialog, input, submit, cancel } = sheetParts()
    await user.type(input, 'wrong1')
    await user.click(submit)

    const alert = await within(dialog).findByRole('alert')
    expect(alert.textContent).toBe('비밀번호가 맞지 않습니다.')
    expect(screen.queryByText(SERVER_RAW)).toBeNull()
    expect(screen.getByRole('dialog', { name: SHEET })).toBe(dialog)
    expect(input.value).toBe('wrong1')
    expect(input.readOnly).toBe(false)
    expect(submit.disabled).toBe(false)
    expect(cancel.disabled).toBe(false)
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['RATE_LIMITED', 42, '비밀번호를 너무 자주 입력했습니다. 42초 후 다시 시도해 주세요.'],
    ['RATE_LIMITED', undefined, '비밀번호를 너무 자주 입력했습니다. 잠시 후 다시 시도해 주세요.'],
    ['NETWORK', undefined, '서버에 연결할 수 없습니다.'],
    ['INTERNAL', undefined, ERROR_MESSAGES.INTERNAL],
  ] as const)('TC-RM-049(a): 시트 제출 %s(retryAfterSec=%s) → 시트 안 alert 문구, 토스트·전환 없음', async (code, sec, text) => {
    mockedEnterRoom.mockResolvedValueOnce(fail(code, sec))
    const { onAuthFailure, onOpenRoom } = renderRooms(READ_ONLY_VIEWER)
    const { user } = await tapSecret()
    const { dialog, input, submit } = sheetParts()
    await user.type(input, 'pw1234')
    await user.click(submit)

    const alert = await within(dialog).findByRole('alert')
    expect(alert.textContent).toBe(text)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByText(SERVER_RAW)).toBeNull()
    expect(input.value).toBe('pw1234')
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['NETWORK', '서버에 연결할 수 없습니다.'],
    ['INTERNAL', ERROR_MESSAGES.INTERNAL],
    ['CONFIG_INVALID', ERROR_MESSAGES.CONFIG_INVALID],
    ['TOKEN_INVALID', ERROR_MESSAGES.TOKEN_INVALID],
  ] as const)('TC-RM-049(b): 조용한 시도 %s → 시트 + 문구, 읽기 전용 전환 없음', async (code, text) => {
    mockedEnterRoom.mockResolvedValueOnce(fail(code))
    const { onAuthFailure, onOpenRoom } = renderRooms(WRITER_VIEWER)
    await tapSecret()

    const dialog = await screen.findByRole('dialog', { name: SHEET })
    expect(within(dialog).getByRole('alert').textContent).toBe(text)
    expect(screen.getByRole('button', { name: NEW_ROOM })).not.toBeNull()
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(mockedEnterRoom.mock.calls[0]).toHaveLength(1)
  })

  it('TC-RM-050(a): 시트 제출 NOT_FOUND → 시트 닫힘·목록 다시 받기·토스트 없음', async () => {
    const reload = deferred<Result<RoomSummary[]>>()
    mockedListRooms.mockResolvedValueOnce(ok(ROOMS)).mockReturnValueOnce(reload.promise)
    mockedEnterRoom.mockResolvedValueOnce(fail('NOT_FOUND'))
    const { onOpenRoom } = renderRooms(READ_ONLY_VIEWER)
    const { user } = await tapSecret()
    const { input, submit } = sheetParts()
    await user.type(input, 'pw1234')
    await user.click(submit)

    await waitFor(() => expect(mockedListRooms).toHaveBeenCalledTimes(2))
    // 다시 받는 동안 loading role=status(F-RM-48 retry · A S6 목록 다시 받기), 시트는 이미 없음
    expect(screen.getByRole('status').textContent).toContain('불러오는 중')
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => {
      reload.resolve(ok([ROOM_CHESS, ROOM_TEA]))
    })
    expect(await screen.findByRole('button', { name: ROW_TEA })).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: ROW_SECRET })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-050(b): 조용한 시도 NOT_FOUND → 시트 없이 목록 다시 받기·토스트 없음', async () => {
    const reload = deferred<Result<RoomSummary[]>>()
    mockedListRooms.mockResolvedValueOnce(ok(ROOMS)).mockReturnValueOnce(reload.promise)
    mockedEnterRoom.mockResolvedValueOnce(fail('NOT_FOUND'))
    const { onOpenRoom } = renderRooms(WRITER_VIEWER)
    await tapSecret()

    await waitFor(() => expect(mockedListRooms).toHaveBeenCalledTimes(2))
    // 다시 받는 동안 loading role=status(F-RM-48 retry · A S6 목록 다시 받기), 시트는 이미 없음
    expect(screen.getByRole('status').textContent).toContain('불러오는 중')
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => {
      reload.resolve(ok([ROOM_CHESS, ROOM_TEA]))
    })
    expect(await screen.findByRole('button', { name: ROW_TEA })).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
  })
})

describe('시트 닫기·입력·연타 (F-RM-44 · F-RM-46 · F-RM-39 · D-L2 · D-L6)', () => {
  it.each(['취소', 'Esc', '덮개'] as const)('TC-RM-051: %s → 시트 닫힘·포커스 = 탭한 행 → 다시 열면 빈 입력', async how => {
    renderRooms(READ_ONLY_VIEWER)
    const { user, row } = await tapSecret()
    const { dialog, input, cancel } = sheetParts()
    await user.type(input, 'pw1234')

    if (how === '취소') await user.click(cancel)
    if (how === 'Esc') fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })
    if (how === '덮개') fireEvent.click(dialog.parentElement as HTMLElement)

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(row))
    await user.click(row)
    expect(sheetParts().input.value).toBe('')
    expect(storageValues().some(v => v.includes('pw1234'))).toBe(false)
    expect(mockedEnterRoom).not.toHaveBeenCalled()
  })

  it('TC-RM-051(d): 요청 중 Esc·덮개 → 무시(시트 유지)', async () => {
    const pending = deferred<Result<EnterRoomResponse>>()
    mockedEnterRoom.mockReturnValueOnce(pending.promise)
    renderRooms(READ_ONLY_VIEWER)
    const { user } = await tapSecret()
    const { dialog, input, submit } = sheetParts()
    await user.type(input, 'pw1234')
    await user.click(submit)

    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })
    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(screen.getByRole('dialog', { name: SHEET })).toBe(dialog)
    expect(input.value).toBe('pw1234')
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending.resolve(fail('ROOM_PASSWORD_WRONG'))
    })
  })

  it('TC-RM-052: 시트 입력 password·new-password·placeholder 없음·카운터 0/64 · 경계 · trim 없음 · Enter 제출 · IME 무시', async () => {
    mockedEnterRoom.mockResolvedValueOnce(fail('ROOM_PASSWORD_WRONG'))
    renderRooms(READ_ONLY_VIEWER)
    await tapSecret()
    const { dialog, input, submit } = sheetParts()

    expect(input.getAttribute('type')).toBe('password')
    expect(input.getAttribute('autocomplete')).toBe('new-password')
    expect(input.getAttribute('placeholder')).toBeNull()
    expect(within(dialog).getByText('0/64')).not.toBeNull()
    expect(submit.disabled).toBe(true)

    fireEvent.change(input, { target: { value: 'a' } })
    expect(submit.disabled).toBe(false)
    fireEvent.change(input, { target: { value: 'a'.repeat(64) } })
    expect(within(dialog).getByText('64/64')).not.toBeNull()
    expect(submit.disabled).toBe(false)
    fireEvent.change(input, { target: { value: 'a'.repeat(65) } })
    const over = within(dialog).getByText('65/64')
    expect(over.classList.contains('over')).toBe(true)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(submit.disabled).toBe(true)
    expect(input.value).toHaveLength(65)

    fireEvent.change(input, { target: { value: ' a ' } })
    expect(within(dialog).getByText('3/64')).not.toBeNull()
    expect(submit.disabled).toBe(false)
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', isComposing: true })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 229 })
    await flushPending()
    expect(mockedEnterRoom).not.toHaveBeenCalled()

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    await waitFor(() => expect(mockedEnterRoom).toHaveBeenCalledTimes(1))
    expect(mockedEnterRoom.mock.calls[0]).toEqual(['r3', ' a '])
    // 응답(ROOM_PASSWORD_WRONG)이 반영된 뒤 끝낸다 — cleanup 과 상태 갱신 경합 방지
    expect((await within(dialog).findByRole('alert')).textContent).toBe('비밀번호가 맞지 않습니다.')
  })

  it('TC-RM-053(a): 조용한 시도 대기 중 같은 행·다른 행 탭 → 무시, enterRoom 1회', async () => {
    const pending = deferred<Result<EnterRoomResponse>>()
    mockedEnterRoom.mockReturnValueOnce(pending.promise)
    const { onOpenRoom } = renderRooms(WRITER_VIEWER)
    const { user, row } = await tapSecret()

    await user.click(row)
    await user.click(screen.getByRole('button', { name: ROW_TEA }))
    await flushPending()
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()

    await act(async () => {
      pending.resolve(ok({ entryKey: 'e1.x' }))
    })
    await waitFor(() => expect(onOpenRoom).toHaveBeenCalledTimes(1))
    expect(onOpenRoom.mock.calls[0]?.[0]).toEqual(ROOM_SECRET)
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-053(b): 시트 제출 같은 틱 연타·대기 중 Enter → enterRoom 1회', async () => {
    const pending = deferred<Result<EnterRoomResponse>>()
    mockedEnterRoom.mockReturnValueOnce(pending.promise)
    renderRooms(READ_ONLY_VIEWER)
    await tapSecret()
    const { input, submit } = sheetParts()
    fireEvent.change(input, { target: { value: 'pw1234' } })

    act(() => {
      fireEvent.click(submit)
      fireEvent.click(submit)
    })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    await flushPending()
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
    expect(mockedEnterRoom.mock.calls[0]).toEqual(['r3', 'pw1234'])
    await act(async () => {
      pending.resolve(fail('ROOM_PASSWORD_WRONG'))
    })
    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
  })
})

describe('시트가 열린 채 읽기 전용 전환 (L §10 끝 줄 · R-LOCK-006 · 메인 결정: 포커스는 시트에 남음)', () => {
  it('TC-RM-067: 입장 시트 열림 → viewer READ_ONLY 전환 → 시트·입력값·입력 포커스 유지(h1 이동 없음), B·비밀번호 칸 소멸 → 제출 정상', async () => {
    mockedEnterRoom.mockResolvedValueOnce(fail('ROOM_LOCKED')).mockResolvedValueOnce(ok({ entryKey: 'e1.x' }))
    const user = userEvent.setup()
    const { onOpenRoom, rerenderWith } = renderRooms(WRITER_VIEWER)
    await screen.findByRole('button', { name: ROW_SECRET })
    await user.click(screen.getByRole('button', { name: NEW_ROOM }))
    expect(screen.getByLabelText('새 방 비밀번호')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: ROW_SECRET }))
    const dialog = await screen.findByRole('dialog', { name: SHEET })
    const { input, submit } = sheetParts()
    await waitFor(() => expect(document.activeElement).toBe(input))
    await user.type(input, 'pw1234')

    // App 의 revokeWrite 흉내(057(c)와 같은 방식)
    rerenderWith(READ_ONLY_VIEWER)
    await flushPending()

    // ⓐ 시트는 쓰기 UI 가 아니다 → 그대로. 포커스는 시트 입력에 남는다(h1 로 옮기지 않음)
    expect(screen.getByRole('dialog', { name: SHEET })).toBe(dialog)
    expect(input.value).toBe('pw1234')
    expect(document.activeElement).toBe(input)
    expect(document.activeElement).not.toBe(screen.getByRole('heading', { level: 1, name: 'ROOMS' }))
    expect(screen.queryByRole('button', { name: NEW_ROOM })).toBeNull()
    expect(screen.queryByRole('group', { name: NEW_ROOM })).toBeNull()
    expect(screen.queryByLabelText('새 방 비밀번호')).toBeNull()

    // 제출은 정상
    await user.click(submit)
    await waitFor(() => expect(onOpenRoom).toHaveBeenCalledTimes(1))
    expect(onOpenRoom.mock.calls[0]?.[0]).toEqual(ROOM_SECRET)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem(KEYS)).toBe('[["r3","e1.x"]]')
    expect(storageValues().some(v => v.includes('pw1234'))).toBe(false)
    expect(mockedEnterRoom.mock.calls).toEqual([['r3'], ['r3', 'pw1234']])
    expect(mockedEnterRoom.mock.calls[0]).toHaveLength(1)
  })
})

describe('자동 진입 (F-RM-52 · §6.10 · R-ROOMS-004 S6 · D-L11)', () => {
  it.each([
    ['토큰 있음', WRITER_VIEWER],
    ['토큰 없음', READ_ONLY_VIEWER],
  ])('TC-RM-058(a)(b): %s — lastRoomId = 잠긴 방 + 증명 없음 → 진입·시트·enterRoom 없음, 기록 삭제', async (_, viewer) => {
    localStorage.setItem('ld:lastRoomId', 'r3')
    const { onOpenRoom, onAutoOpenSettled } = renderRooms(viewer, 'r3')

    expect(await screen.findByRole('button', { name: ROW_SECRET })).not.toBeNull()
    await waitFor(() => expect(onAutoOpenSettled).toHaveBeenCalledTimes(1))
    await flushPending()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(localStorage.getItem('ld:lastRoomId')).toBeNull()
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(mockedEnterRoom).not.toHaveBeenCalled()
  })

  it('TC-RM-058(c): lastRoomId = 잠긴 방 + 증명 있음 → 자동 진입, enterRoom 0', async () => {
    localStorage.setItem('ld:lastRoomId', 'r3')
    localStorage.setItem(KEYS, '[["r3","e1.x"]]')
    const { onOpenRoom, onAutoOpenSettled } = renderRooms(READ_ONLY_VIEWER, 'r3')

    await waitFor(() => expect(onOpenRoom).toHaveBeenCalledTimes(1))
    expect(onAutoOpenSettled).toHaveBeenCalledTimes(1)
    expect(onOpenRoom.mock.calls[0]?.[0]).toEqual(ROOM_SECRET)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockedEnterRoom).not.toHaveBeenCalled()
  })

  it('TC-RM-058(d): lastRoomId = 안 잠긴 방 → 자동 진입(회귀)', async () => {
    localStorage.setItem('ld:lastRoomId', 'r1')
    const { onOpenRoom } = renderRooms(READ_ONLY_VIEWER, 'r1')

    await waitFor(() => expect(onOpenRoom).toHaveBeenCalledTimes(1))
    expect(onOpenRoom.mock.calls[0]?.[0]).toEqual(ROOM_TEA)
    expect(mockedEnterRoom).not.toHaveBeenCalled()
  })
})
