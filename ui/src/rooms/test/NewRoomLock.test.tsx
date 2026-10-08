/**
 * rooms S6 새 방 + 비밀번호 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-054 ~ 057)
 * 대상: RoomsScreen(S6) · NewRoomRow 2줄 판 · useCreateRoom(password·증명 저장) · TextInput type='password'
 * - 설계: ui/src/rooms/design/lock.md §1.1 · F-RM-49~51 · F-RM-53 · §6.9 · §8.1 · D-L3·D-L5·D-L7·D-L12 · design/components.md §2.4(S6)
 * - TC-RM-054 는 S2 TC-RM-026(d) "유효 제목 Enter = 만들기"를 개정한다(R-ROOMS-002 S6 개정 · D-L3).
 * - 토큰은 viewer props. api 래퍼는 vi.mock('@/api/rooms'). isAuthFailure 실물. fetch 모킹 금지.
 * - 비밀번호 입력은 role 이 없다(type=password) → getByLabelText('새 방 비밀번호')로 찾는다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ERROR_MESSAGES } from '@shared/errors'
import type { CreateRoomResponse, RoomSummary } from '@shared/types'
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
const mockedCreateRoom = vi.mocked(createRoom)
const otherMocks = [renameRoom, deleteRoom, enterRoom, setRoomPassword, clearRoomPassword].map(f => vi.mocked(f))

const ROOM_TEA: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 2, 10, 0).getTime(),
  updatedAt: new Date(2026, 9, 5, 16, 40).getTime(),
  messageCount: 12,
  locked: false,
}
const CREATED: RoomSummary = {
  id: 'r9',
  title: '안개 낀 런던',
  createdAt: new Date(2026, 9, 5, 17, 0).getTime(),
  updatedAt: new Date(2026, 9, 5, 17, 0).getTime(),
  messageCount: 0,
  locked: false,
}
const CREATED_LOCKED: RoomSummary = { ...CREATED, locked: true }
const ROW_TEA = '티타임, 마지막 갱신 10.05'
const NEW_ROOM = '새 방 만들기'
const TITLE = '새 방 제목'
const PASSWORD = '새 방 비밀번호'
const TITLE_TEXT = '안개 낀 런던'
const KEYS = 'ld:roomKeys'
const SERVER_RAW = 'SERVER-RAW-MESSAGE'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fail = (code: ApiErrorCode): Result<never> => ({ ok: false, error: { code, message: SERVER_RAW } })
const created = (room: RoomSummary, entryKey: string | null): Result<CreateRoomResponse> => ok({ ...room, entryKey })
const flushPending = async () => {
  await act(async () => {})
}
const storageValues = (): string[] => {
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) out.push(localStorage.getItem(localStorage.key(i) ?? '') ?? '')
  return out
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

/** 목록이 그려진 뒤 「+ 새 방」을 눌러 2줄 입력 행을 연다 */
const openRow = async () => {
  const user = userEvent.setup()
  await screen.findByRole('button', { name: ROW_TEA })
  await user.click(screen.getByRole('button', { name: NEW_ROOM }))
  const group = screen.getByRole('group', { name: NEW_ROOM })
  const title = within(group).getByRole('textbox', { name: TITLE }) as HTMLInputElement
  const password = within(group).getByLabelText(PASSWORD) as HTMLInputElement
  const createButton = within(group).getByRole('button', { name: '만들기' }) as HTMLButtonElement
  const cancelButton = within(group).getByRole('button', { name: '취소' }) as HTMLButtonElement
  return { user, group, title, password, createButton, cancelButton }
}

beforeEach(() => {
  mockedListRooms.mockReset()
  mockedCreateRoom.mockReset()
  for (const m of otherMocks) m.mockReset()
  mockedListRooms.mockResolvedValue(ok([ROOM_TEA]))
  localStorage.clear()
  resetRoomKeyCache()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  resetRoomKeyCache()
})

describe('B 2줄 (R-ROOMS-002 S6 · R-LOCK-001 · F-RM-53 · D-L3)', () => {
  it('TC-RM-054(a): 열기 → 제목 포커스 · 비밀번호 password·placeholder·0/32 · DOM 순서 · 제목 Enter = 비밀번호로 · 비밀번호 Enter = 만들기', async () => {
    mockedCreateRoom.mockResolvedValueOnce(created(CREATED, null))
    renderRooms(WRITER_VIEWER)
    const { group, title, password, createButton, cancelButton } = await openRow()

    // ⓐ 열림 상태
    expect(document.activeElement).toBe(title)
    expect(password.getAttribute('type')).toBe('password')
    expect(password.getAttribute('placeholder')).toBe('비밀번호(선택, 6자 이상 권장)')
    expect(password.value).toBe('')
    expect(within(group).getByText('0/32')).not.toBeNull()
    expect(within(group).getByText('0/60')).not.toBeNull()
    const order = Array.from(group.querySelectorAll('input, button'))
    expect(order).toEqual([title, cancelButton, password, createButton])

    // 제목 Enter → 비밀번호 포커스, 제출 없음
    fireEvent.change(title, { target: { value: TITLE_TEXT } })
    fireEvent.keyDown(title, { key: 'Enter', code: 'Enter' })
    await flushPending()
    expect(document.activeElement).toBe(password)
    expect(mockedCreateRoom).not.toHaveBeenCalled()
    expect(title.readOnly).toBe(false)

    // 비밀번호 칸 IME Enter → 무시, Enter → 만들기
    fireEvent.keyDown(password, { key: 'Enter', code: 'Enter', isComposing: true })
    await flushPending()
    expect(mockedCreateRoom).not.toHaveBeenCalled()
    fireEvent.keyDown(password, { key: 'Enter', code: 'Enter' })
    await waitFor(() => expect(mockedCreateRoom).toHaveBeenCalledTimes(1))
    expect(mockedCreateRoom.mock.calls[0]).toEqual([{ title: TITLE_TEXT }])
  })

  it('TC-RM-054(b): 토큰 없음 쌍 — 「+ 새 방」·B·비밀번호 칸 DOM 없음', async () => {
    renderRooms(READ_ONLY_VIEWER)
    await screen.findByRole('button', { name: ROW_TEA })
    expect(screen.queryByRole('button', { name: NEW_ROOM })).toBeNull()
    expect(screen.queryByRole('group', { name: NEW_ROOM })).toBeNull()
    expect(screen.queryByLabelText(PASSWORD)).toBeNull()
    expect(document.querySelector('input[type="password"]')).toBeNull()
    expect(mockedCreateRoom).not.toHaveBeenCalled()
  })
})

describe('비밀번호 경계 (F-RM-39 · F-RM-49 · D-L5 · R-LOCK-001)', () => {
  it('TC-RM-055(a)(b): 빈칸 enabled · 3 disabled(over 없음) · 4·32 enabled · 33 over·aria-invalid·disabled · trim 없음 · 이모지 4', async () => {
    renderRooms(WRITER_VIEWER)
    const { group, title, password, createButton } = await openRow()
    fireEvent.change(title, { target: { value: TITLE_TEXT } })

    const check = (value: string, counter: string, enabled: boolean, over: boolean) => {
      fireEvent.change(password, { target: { value } })
      const c = within(group).getByText(counter)
      expect(createButton.disabled).toBe(!enabled)
      expect(c.classList.contains('over')).toBe(over)
      expect(password.getAttribute('aria-invalid') === 'true').toBe(over)
      expect(password.value).toBe(value)
    }
    check('', '0/32', true, false)
    check('abc', '3/32', false, false)
    check('abcd', '4/32', true, false)
    check('a'.repeat(32), '32/32', true, false)
    check('a'.repeat(33), '33/32', false, true)
    check(' ab ', '4/32', true, false)
    check('😀😀😀😀', '4/32', true, false)

    // 제목이 무효면 비밀번호가 유효해도 비활성
    fireEvent.change(title, { target: { value: '   ' } })
    expect(createButton.disabled).toBe(true)
    await flushPending()
    expect(mockedCreateRoom).not.toHaveBeenCalled()
  })
})

describe('생성 본문·증명 (F-RM-50 · D-L7 · R-LOCK-001 · R-LOCK-004 · R-LOCK-007)', () => {
  it('TC-RM-056(a): 빈 비밀번호 → createRoom({ title })(password 키 없음) · entryKey null → 저장 없음 · onOpenRoom 에 entryKey 없음', async () => {
    mockedCreateRoom.mockResolvedValueOnce(created(CREATED, null))
    const { onOpenRoom } = renderRooms(WRITER_VIEWER)
    const { user, title, createButton } = await openRow()
    fireEvent.change(title, { target: { value: TITLE_TEXT } })
    await user.click(createButton)

    await waitFor(() => expect(onOpenRoom).toHaveBeenCalledTimes(1))
    const body = mockedCreateRoom.mock.calls[0]?.[0] as object
    expect(Object.keys(body)).toEqual(['title'])
    expect(body).toEqual({ title: TITLE_TEXT })
    const arg = onOpenRoom.mock.calls[0]?.[0] as object
    expect(arg).toEqual(CREATED)
    expect('entryKey' in arg).toBe(false)
    expect(localStorage.getItem(KEYS)).toBeNull()
    await flushPending()
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-056(b): abcd → createRoom({ title, password }) · entryKey 저장 · onOpenRoom 에 entryKey 없음 · 원문 미저장', async () => {
    mockedCreateRoom.mockResolvedValueOnce(created(CREATED_LOCKED, 'e1.k'))
    const { onOpenRoom } = renderRooms(WRITER_VIEWER)
    const { user, title, password, createButton } = await openRow()
    fireEvent.change(title, { target: { value: TITLE_TEXT } })
    fireEvent.change(password, { target: { value: 'abcd' } })
    await user.click(createButton)

    await waitFor(() => expect(onOpenRoom).toHaveBeenCalledTimes(1))
    expect(mockedCreateRoom.mock.calls[0]).toEqual([{ title: TITLE_TEXT, password: 'abcd' }])
    const arg = onOpenRoom.mock.calls[0]?.[0] as object
    expect(arg).toEqual(CREATED_LOCKED)
    expect('entryKey' in arg).toBe(false)
    expect(localStorage.getItem(KEYS)).toBe('[["r9","e1.k"]]')
    expect(storageValues().some(v => v.includes('abcd'))).toBe(false)
    expect(mockedCreateRoom).toHaveBeenCalledTimes(1)
  })
})

describe('취소·실패 (F-RM-50·51 · §6.9 5 · D-L12)', () => {
  it.each(['취소', 'Esc'] as const)('TC-RM-057(a): 비밀번호 입력 후 %s → 다시 열면 두 칸 빈값', async how => {
    renderRooms(WRITER_VIEWER)
    const first = await openRow()
    fireEvent.change(first.title, { target: { value: TITLE_TEXT } })
    fireEvent.change(first.password, { target: { value: 'abcd' } })
    if (how === '취소') await first.user.click(first.cancelButton)
    if (how === 'Esc') fireEvent.keyDown(first.password, { key: 'Escape', code: 'Escape' })

    expect(screen.queryByRole('group', { name: NEW_ROOM })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: NEW_ROOM }))
    await first.user.click(screen.getByRole('button', { name: NEW_ROOM }))
    const group = screen.getByRole('group', { name: NEW_ROOM })
    expect((within(group).getByRole('textbox', { name: TITLE }) as HTMLInputElement).value).toBe('')
    expect((within(group).getByLabelText(PASSWORD) as HTMLInputElement).value).toBe('')
    expect(mockedCreateRoom).not.toHaveBeenCalled()
  })

  it.each([
    ['INTERNAL', ERROR_MESSAGES.INTERNAL],
    ['VALIDATION_ERROR', '방 제목(1~60자)과 비밀번호(4~32자)를 확인해 주세요.'],
  ] as const)('TC-RM-057(b): 생성 실패 %s → 토스트 문구, 제목·비밀번호 유지, 저장 없음', async (code, text) => {
    mockedCreateRoom.mockResolvedValueOnce(fail(code))
    const { onOpenRoom, onAuthFailure } = renderRooms(WRITER_VIEWER)
    const { user, title, password, createButton } = await openRow()
    fireEvent.change(title, { target: { value: TITLE_TEXT } })
    fireEvent.change(password, { target: { value: 'abcd' } })
    await user.click(createButton)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(text)
    expect(screen.queryByText(SERVER_RAW)).toBeNull()
    expect(title.value).toBe(TITLE_TEXT)
    expect(password.value).toBe('abcd')
    expect(createButton.disabled).toBe(false)
    expect(onOpenRoom).not.toHaveBeenCalled()
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(mockedCreateRoom.mock.calls[0]).toEqual([{ title: TITLE_TEXT, password: 'abcd' }])
  })

  it('TC-RM-057(c): 인증 실패(TOKEN_INVALID) → onAuthFailure → 전환 뒤 B·비밀번호 칸 DOM 없음', async () => {
    mockedCreateRoom.mockResolvedValueOnce(fail('TOKEN_INVALID'))
    const { onAuthFailure, rerenderWith } = renderRooms(WRITER_VIEWER)
    const { user, title, password, createButton } = await openRow()
    fireEvent.change(title, { target: { value: TITLE_TEXT } })
    fireEvent.change(password, { target: { value: 'abcd' } })
    await user.click(createButton)

    await waitFor(() => expect(onAuthFailure).toHaveBeenCalledTimes(1))
    rerenderWith(READ_ONLY_VIEWER)
    expect(screen.queryByRole('group', { name: NEW_ROOM })).toBeNull()
    expect(screen.queryByLabelText(PASSWORD)).toBeNull()
    expect(document.querySelector('input[type="password"]')).toBeNull()
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(storageValues().some(v => v.includes('abcd'))).toBe(false)
    expect(mockedCreateRoom).toHaveBeenCalledTimes(1)
  })
})
