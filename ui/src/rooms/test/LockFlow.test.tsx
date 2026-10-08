/**
 * App S6 흐름 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-063 · 064 · 066 · 060(a))
 * 대상: App → RoomsScreen(잠긴 행·입장 시트·새 방 비밀번호) → ChatScreen → ‹ 뒤로 → 같은 행 재진입
 * - 토큰 주입은 initToken('?t=…') / initToken('') 하나로만(render 전). 정리는 clearToken().
 *   main.tsx · configureClient 는 쓰지 않는다. X-Room-Key 헤더 부착은 api 스펙(API-T-UI-035) 몫이라
 *   여기서는 main.tsx 가 넘기는 getter(getRoomKey)의 값으로 관찰한다.
 * - api 래퍼는 vi.mock. isAuthFailure 실물. fetch 모킹 금지. 토큰이 있으면 App 주인 판정 mock(Q-02 규칙).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CreateRoomResponse, MessagesPage, RoomSummary } from '@shared/types'
import type { Result } from '@/api'
import { appendUser, deleteMessage, editMessage, listMessages } from '@/api/messages'
import {
  clearRoomPassword,
  createRoom,
  deleteRoom,
  enterRoom,
  listRooms,
  renameRoom,
  setRoomPassword,
} from '@/api/rooms'
import { getCharacterSettings } from '@/api/settings'
import { App } from '@/App'
import { NOT_OWNER } from '@/settings/test/fixtures'
import { getRoomKey, resetRoomKeyCache } from '@/state/roomKeys'
import { clearToken, getToken, initToken } from '@/state/token'

vi.mock('@/api/settings', () => ({ getCharacterSettings: vi.fn(), saveCharacterSettings: vi.fn() }))
vi.mock('@/api/rooms', () => ({
  listRooms: vi.fn(),
  createRoom: vi.fn(),
  renameRoom: vi.fn(),
  deleteRoom: vi.fn(),
  enterRoom: vi.fn(),
  setRoomPassword: vi.fn(),
  clearRoomPassword: vi.fn(),
}))
vi.mock('@/api/messages', () => ({
  listMessages: vi.fn(),
  appendUser: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
}))

const mockedListRooms = vi.mocked(listRooms)
const mockedEnterRoom = vi.mocked(enterRoom)
const mockedCreateRoom = vi.mocked(createRoom)
const mockedListMessages = vi.mocked(listMessages)
const resetMocks = [renameRoom, deleteRoom, setRoomPassword, clearRoomPassword, appendUser, editMessage, deleteMessage].map(
  f => vi.mocked(f),
)

const ROOM_TEA: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 2, 10, 0).getTime(),
  updatedAt: new Date(2026, 9, 5, 16, 40).getTime(),
  messageCount: 1,
  locked: false,
}
const ROOM_SECRET: RoomSummary = {
  id: 'r3',
  title: '비밀 다과회',
  createdAt: new Date(2026, 9, 2, 8, 0).getTime(),
  updatedAt: new Date(2026, 9, 4, 22, 10).getTime(),
  messageCount: 7,
  locked: true,
}
const CREATED_LOCKED: RoomSummary = {
  id: 'r9',
  title: '안개 낀 런던',
  createdAt: new Date(2026, 9, 5, 17, 0).getTime(),
  updatedAt: new Date(2026, 9, 5, 17, 0).getTime(),
  messageCount: 0,
  locked: true,
}
const EMPTY: MessagesPage = { messages: [], hasMore: false }
const ROW_TEA = '티타임, 마지막 갱신 10.05'
const ROW_SECRET = '비밀 다과회, 잠긴 방'
const ROW_CREATED = '안개 낀 런던, 잠긴 방'
const BACK = '방 목록으로 돌아가기'
const NEW_ROOM = '새 방 만들기'
const KEYS = 'ld:roomKeys'
const TOKEN = 'test-token'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const flushPending = async () => {
  await act(async () => {})
}
const storageDump = (): string[] => {
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i) ?? ''
    out.push(k, localStorage.getItem(k) ?? '')
  }
  for (let i = 0; i < sessionStorage.length; i += 1) out.push(sessionStorage.key(i) ?? '')
  return out
}
/** 열린 입장 시트에 비밀번호를 넣고 입장한다 */
const submitSheet = async (user: ReturnType<typeof userEvent.setup>, password: string) => {
  const dialog = await screen.findByRole('dialog', { name: '비밀번호' })
  await user.type(within(dialog).getByLabelText('방 비밀번호'), password)
  await user.click(within(dialog).getByRole('button', { name: '입장' }))
}
const backToList = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: BACK }))
  expect(await screen.findByRole('main', { name: '방 목록' })).not.toBeNull()
}

beforeEach(() => {
  mockedListRooms.mockReset()
  mockedEnterRoom.mockReset()
  mockedCreateRoom.mockReset()
  mockedListMessages.mockReset()
  for (const m of resetMocks) m.mockReset()
  mockedListRooms.mockResolvedValue(ok([ROOM_TEA, ROOM_SECRET]))
  mockedListMessages.mockResolvedValue(ok(EMPTY))
  vi.mocked(getCharacterSettings).mockReset()
  vi.mocked(getCharacterSettings).mockResolvedValue(NOT_OWNER)
  localStorage.clear()
  sessionStorage.clear()
  clearToken()
  resetRoomKeyCache()
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  clearToken()
  resetRoomKeyCache()
})

describe('잠긴 방 App 흐름 (U-RM-13 · 16 · 17 · 15 · 19)', () => {
  it('TC-RM-063: 토큰 없음 → 잠긴 행 → 시트 → 성공 → chat → ‹ 뒤로 → 같은 행 → 시트 없이 진입(증명 재사용)', async () => {
    mockedEnterRoom.mockResolvedValueOnce(ok({ entryKey: 'e1.x' }))
    initToken('')
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: ROW_SECRET }))
    await submitSheet(user, 'pw1234')
    expect(await screen.findByRole('main', { name: '대화: 비밀 다과회' })).not.toBeNull()
    await waitFor(() => {
      expect(mockedListMessages.mock.calls[0]?.[0]).toBe('r3')
      expect(localStorage.getItem('ld:lastRoomId')).toBe('r3')
    })
    expect(getRoomKey('r3')).toBe('e1.x')
    expect(localStorage.getItem(KEYS)).toBe('[["r3","e1.x"]]')

    await backToList(user)
    expect(localStorage.getItem('ld:lastRoomId')).toBeNull()
    await user.click(await screen.findByRole('button', { name: ROW_SECRET }))
    expect(await screen.findByRole('main', { name: '대화: 비밀 다과회' })).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()

    expect(mockedEnterRoom).toHaveBeenCalledTimes(1)
    expect(mockedEnterRoom.mock.calls[0]).toEqual(['r3', 'pw1234'])
    expect(getToken()).toBeNull()
    expect(storageDump().some(v => v.includes('pw1234'))).toBe(false)
  })

  it('TC-RM-064(a): 토큰 있음(주인 판정은 서버) → 잠긴 행 → enterRoom(r3) 200 → 시트 없이 chat', async () => {
    mockedEnterRoom.mockResolvedValueOnce(ok({ entryKey: 'e1.x' }))
    initToken(`?t=${TOKEN}`)
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: ROW_SECRET }))
    expect(await screen.findByRole('main', { name: '대화: 비밀 다과회' })).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockedEnterRoom.mock.calls).toEqual([['r3']])
    expect(getRoomKey('r3')).toBe('e1.x')
    expect(storageDump().some(v => v.includes(TOKEN))).toBe(false)
  })

  it('TC-RM-064(b): 토큰 있음(주인 아님) → ROOM_LOCKED → 시트 → 성공 → chat', async () => {
    mockedEnterRoom
      .mockResolvedValueOnce({ ok: false, error: { code: 'ROOM_LOCKED', message: 'SERVER-RAW' } })
      .mockResolvedValueOnce(ok({ entryKey: 'e1.x' }))
    initToken(`?t=${TOKEN}`)
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: ROW_SECRET }))
    await submitSheet(user, 'pw1234')
    expect(await screen.findByRole('main', { name: '대화: 비밀 다과회' })).not.toBeNull()
    expect(mockedEnterRoom.mock.calls).toEqual([['r3'], ['r3', 'pw1234']])
    expect(getRoomKey('r3')).toBe('e1.x')
    expect(getToken()).toBe(TOKEN)
  })

  it('TC-RM-066: 토큰 있음 → 「+ 새 방」 제목+abcd → 만들기 → 증명 저장 → chat → ‹ 뒤로 → 잠긴 행 탭 → enterRoom 0, 시트 없이 chat', async () => {
    const response: CreateRoomResponse = { ...CREATED_LOCKED, entryKey: 'e1.k' }
    mockedCreateRoom.mockResolvedValueOnce(ok(response))
    mockedListRooms.mockResolvedValueOnce(ok([ROOM_TEA])).mockResolvedValue(ok([CREATED_LOCKED, ROOM_TEA]))
    initToken(`?t=${TOKEN}`)
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('button', { name: ROW_TEA })
    await user.click(screen.getByRole('button', { name: NEW_ROOM }))
    const group = screen.getByRole('group', { name: NEW_ROOM })
    fireEvent.change(within(group).getByRole('textbox', { name: '새 방 제목' }), { target: { value: '안개 낀 런던' } })
    fireEvent.change(within(group).getByLabelText('새 방 비밀번호'), { target: { value: 'abcd' } })
    await user.click(within(group).getByRole('button', { name: '만들기' }))

    expect(await screen.findByRole('main', { name: '대화: 안개 낀 런던' })).not.toBeNull()
    expect(mockedCreateRoom.mock.calls[0]).toEqual([{ title: '안개 낀 런던', password: 'abcd' }])
    expect(localStorage.getItem(KEYS)).toBe('[["r9","e1.k"]]')

    await backToList(user)
    await user.click(await screen.findByRole('button', { name: ROW_CREATED }))
    expect(await screen.findByRole('main', { name: '대화: 안개 낀 런던' })).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    await flushPending()
    expect(mockedEnterRoom).not.toHaveBeenCalled()
    expect(storageDump().some(v => v.includes('abcd') || v.includes(TOKEN))).toBe(false)
  })

  it('TC-RM-060(a): 잠긴 방을 열지 않는 흐름 → 저장소 키는 S5 키뿐(ld:roomKeys 없음), 토큰 값 0건', async () => {
    initToken(`?t=${TOKEN}`)
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: ROW_TEA }))
    expect(await screen.findByRole('main', { name: '대화: 티타임' })).not.toBeNull()
    await backToList(user)
    await flushPending()

    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? '')
    expect(keys.every(k => k === 'ld:lastRoomId' || k.startsWith('ld:scroll:'))).toBe(true)
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(storageDump().some(v => v.includes(TOKEN))).toBe(false)
    expect(sessionStorage.length).toBe(0)
    expect(mockedEnterRoom).not.toHaveBeenCalled()
  })
})
