/**
 * App S2 흐름 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-021(b) · 024(b) · 027)
 * 대상: App(viewer 초기값·revokeWrite) → RoomsScreen(새 방) → ChatScreen
 * - 토큰 주입은 설계 진입점 initToken('?t=…') 하나로만 한다(render 전). 정리는 clearToken().
 *   window.history.replaceState · main.tsx · configureClient 는 쓰지 않는다.
 * - api 래퍼는 vi.mock 으로 대체한다. isAuthFailure 는 실물. fetch 모킹 금지.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MessagesPage, RoomSummary } from '@shared/types'
import type { Result } from '@/api'
import { appendUser, deleteMessage, editMessage, listMessages } from '@/api/messages'
import { createRoom, deleteRoom, listRooms, renameRoom } from '@/api/rooms'
import { App } from '@/App'
import { clearToken, getToken, initToken } from '@/state/token'
import { getCharacterSettings } from '@/api/settings'
import { NOT_OWNER } from '@/settings/test/fixtures'

// (S3c, F-RM-24) 토큰이 있으면 App 이 주인 판정 GET 을 1회 부른다 — 실제 fetch 방지 mock, 기본값 비주인(OWNER_ONLY).
// 이 파일의 단언은 바꾸지 않는다(scenarios.md 변경 대기열 Q-02).
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
const mockedCreateRoom = vi.mocked(createRoom)
const mockedListMessages = vi.mocked(listMessages)
const writeMocks = [createRoom, renameRoom, deleteRoom, appendUser, editMessage, deleteMessage].map(
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
const CREATED: RoomSummary = {
  id: 'r9',
  title: '안개 낀 런던',
  createdAt: new Date(2026, 9, 5, 17, 0).getTime(),
  updatedAt: new Date(2026, 9, 5, 17, 0).getTime(),
  messageCount: 0,
  locked: false,
}
const EMPTY: MessagesPage = { messages: [], hasMore: false }
const ROW_TEA = '티타임, 마지막 갱신 10.05'
const NEW_ROOM = '새 방 만들기'
const TOKEN = 'test-token'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const flushPending = async () => {
  await act(async () => {})
}

beforeEach(() => {
  mockedListRooms.mockReset()
  mockedListMessages.mockReset()
  for (const m of writeMocks) m.mockReset()
  mockedListRooms.mockResolvedValue(ok([ROOM_TEA]))
  mockedListMessages.mockResolvedValue(ok(EMPTY))
  vi.mocked(getCharacterSettings).mockReset()
  vi.mocked(getCharacterSettings).mockResolvedValue(NOT_OWNER)
  localStorage.clear()
  sessionStorage.clear()
  clearToken()
  // jsdom 에는 matchMedia 가 없다. TextArea(C §1.13)가 높이 ≤ 480 판정에 쓴다 → 넓은 화면으로 고정
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
})

describe('App 토큰 흐름 (R-ROOMS-002 · R-CHAT-008 · R-CHAT-009)', () => {
  it('TC-RM-027: initToken(?t=test-token) → 「+ 새 방」 있음, 토큰은 메모리에만', async () => {
    const cookieBefore = document.cookie
    initToken(`?t=${TOKEN}`)
    render(<App />)

    expect(await screen.findByRole('button', { name: NEW_ROOM })).not.toBeNull()
    expect(screen.getByRole('button', { name: ROW_TEA })).not.toBeNull()
    expect(getToken()).toBe(TOKEN)
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(document.cookie).toBe(cookieBefore)
    await flushPending()
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
    expect(mockedListRooms.mock.calls[0]).toEqual([])
    for (const m of writeMocks) expect(m).not.toHaveBeenCalled()
  })

  it.each([[''], ['?t=%20%20']])(
    'TC-RM-027: initToken(%j) → 「+ 새 방」 없음, getToken() null',
    async search => {
      initToken(search)
      render(<App />)

      expect(await screen.findByRole('button', { name: ROW_TEA })).not.toBeNull()
      expect(screen.queryByRole('button', { name: NEW_ROOM })).toBeNull()
      expect(getToken()).toBeNull()
      await flushPending()
      expect(mockedListRooms).toHaveBeenCalledTimes(1)
      for (const m of writeMocks) expect(m).not.toHaveBeenCalled()
    },
  )

  it('TC-RM-021: (App) 생성 성공 → 응답 방의 chat, ld:lastRoomId = 응답 id, listMessages(r9)', async () => {
    mockedCreateRoom.mockResolvedValueOnce(ok({ ...CREATED, entryKey: null }))
    initToken(`?t=${TOKEN}`)
    render(<App />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: NEW_ROOM }))
    await user.type(screen.getByRole('textbox', { name: '새 방 제목' }), '  안개 낀 런던  ')
    await user.click(screen.getByRole('button', { name: '만들기' }))

    expect(await screen.findByRole('main', { name: '대화: 안개 낀 런던' })).not.toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: '안개 낀 런던' })).not.toBeNull()
    expect(screen.getByRole('group', { name: '메시지 작성' })).not.toBeNull()
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r9')
    expect(mockedCreateRoom.mock.calls).toEqual([[{ title: '  안개 낀 런던  ' }]])
    await waitFor(() => expect(mockedListMessages).toHaveBeenCalledTimes(1))
    expect(mockedListMessages.mock.calls[0]).toEqual(['r9'])
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-024: (App) 생성이 LEVEL_TOO_LOW → 읽기 전용 전환, h1 포커스, getToken() null', async () => {
    mockedCreateRoom.mockResolvedValueOnce({
      ok: false,
      error: { code: 'LEVEL_TOO_LOW', message: 'SERVER-RAW-MESSAGE' },
    })
    initToken(`?t=${TOKEN}`)
    render(<App />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: NEW_ROOM }))
    await user.type(screen.getByRole('textbox', { name: '새 방 제목' }), '안개 낀 런던')
    await user.click(screen.getByRole('button', { name: '만들기' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.')
    expect(screen.queryByRole('button', { name: NEW_ROOM })).toBeNull()
    expect(screen.queryByRole('group', { name: NEW_ROOM })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'ROOMS' })),
    )
    expect(getToken()).toBeNull()
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) ?? ''
      expect(localStorage.getItem(key) ?? '').not.toContain(TOKEN)
    }
    await flushPending()
    expect(mockedCreateRoom).toHaveBeenCalledTimes(1)
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })
})
