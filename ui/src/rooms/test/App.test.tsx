/**
 * App 흐름 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-012 · TC-RM-010 화면 쪽)
 * 대상: App(ui/src/App.tsx) → RoomsScreen / ChatScreen 분기 (design.md §6.1 · §6.2 · functions.md F-RM-01~04)
 * - api 래퍼 2종을 vi.mock 으로 대체한다. fetch 모킹 금지.
 * - S1 은 토큰을 읽지 않는다: ?t= 가 있어도 READ_ONLY_VIEWER 화면이고 저장소에 토큰이 남지 않는다(R-NFR-004).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MessagesPage, RoomSummary } from '@shared/types'
import type { Result } from '@/api'
import { listMessages } from '@/api/messages'
import { listRooms } from '@/api/rooms'
import { App } from '@/App'

vi.mock('@/api/rooms', () => ({ listRooms: vi.fn() }))
vi.mock('@/api/messages', () => ({ listMessages: vi.fn() }))

const mockedListRooms = vi.mocked(listRooms)
const mockedListMessages = vi.mocked(listMessages)

const ROOM_CHESS: RoomSummary = {
  id: 'r2',
  title: '체스 대결',
  createdAt: new Date(2026, 9, 1, 9, 0).getTime(),
  updatedAt: new Date(2026, 9, 3, 21, 5).getTime(),
  messageCount: 1,
}
const ROOM_TEA: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 2, 10, 0).getTime(),
  updatedAt: new Date(2026, 9, 5, 16, 40).getTime(),
  messageCount: 1,
}
const ROOMS: RoomSummary[] = [ROOM_TEA, ROOM_CHESS]
const ROW_TEA = '티타임, 마지막 갱신 10.05'
const ROW_CHESS = '체스 대결, 마지막 갱신 10.03'
const BACK = '방 목록으로 돌아가기'
const TOKEN_LIKE = 'TESTTOKEN.SIGNATURE'
const ALLOWED_KEY = /^ld:(lastRoomId|scroll:.+)$/

const pageOf = (roomId: string): MessagesPage => ({
  messages: [
    {
      id: 1,
      roomId,
      speaker: 'ciel',
      kind: 'line',
      text: '세바스찬, 홍차.',
      authorName: null,
      createdAt: new Date(2026, 9, 5, 16, 40).getTime(),
    },
  ],
  hasMore: false,
})

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })

const storageEntries = (): Array<[string, string]> => {
  const entries: Array<[string, string]> = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key !== null) entries.push([key, localStorage.getItem(key) ?? ''])
  }
  return entries
}

beforeEach(() => {
  mockedListRooms.mockReset()
  mockedListMessages.mockReset()
  mockedListRooms.mockResolvedValue(ok(ROOMS))
  mockedListMessages.mockImplementation(async (roomId: string) => ok(pageOf(roomId)))
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('App 화면 분기 (R-ROOMS-001 · R-ROOMS-004)', () => {
  it('TC-RM-012: 저장 id 있음 → chat 자동 진입 → ‹ 뒤로 → 목록, 기록 삭제 → 재마운트 시 목록에서 시작', async () => {
    localStorage.setItem('ld:lastRoomId', 'r1')
    const user = userEvent.setup()
    const first = render(<App />)

    // 1) 자동 진입
    expect(await screen.findByRole('main', { name: '대화: 티타임' })).not.toBeNull()
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
    // ChatScreen 마운트 effect(저장·첫 로드)는 DOM 커밋 뒤 passive effect 로 돈다 → 기다려서 판정
    await waitFor(() => {
      expect(mockedListMessages.mock.calls[0]).toEqual(['r1'])
      expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    })

    // 2) ‹ 뒤로 → 목록 다시 로드, 기록 삭제, h1 포커스
    await user.click(screen.getByRole('button', { name: BACK }))
    expect(await screen.findByRole('button', { name: ROW_TEA })).not.toBeNull()
    expect(screen.getByRole('main', { name: '방 목록' })).not.toBeNull()
    expect(screen.queryByRole('main', { name: '대화: 티타임' })).toBeNull()
    expect(localStorage.getItem('ld:lastRoomId')).toBeNull()
    expect(mockedListRooms).toHaveBeenCalledTimes(2)
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'ROOMS' }))

    // 3) 패널을 닫았다 다시 연다 → 자동 진입 없이 목록
    first.unmount()
    render(<App />)
    expect(await screen.findByRole('button', { name: ROW_TEA })).not.toBeNull()
    expect(screen.queryByRole('main', { name: /^대화:/ })).toBeNull()
    expect(mockedListRooms).toHaveBeenCalledTimes(3)
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-012: 저장 id 없음 → 목록 → 행 클릭 → 그 방 chat, 기록 = 그 방 id', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: ROW_CHESS }))
    expect(await screen.findByRole('main', { name: '대화: 체스 대결' })).not.toBeNull()
    expect(screen.queryByRole('main', { name: '방 목록' })).toBeNull()
    // (a)와 같은 이유로 마운트 effect 결과는 기다려서 판정
    await waitFor(() => {
      expect(localStorage.getItem('ld:lastRoomId')).toBe('r2')
      expect(mockedListMessages).toHaveBeenCalledTimes(1)
    })
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
    expect(mockedListMessages.mock.calls[0]).toEqual(['r2'])
  })

  it('TC-RM-012: (c) URL 에만 ?t= 가 있고 initToken 미호출 → App 은 URL 을 직접 읽지 않아 읽기 전용, 토큰이 저장소에 남지 않는다', async () => {
    window.history.replaceState(null, '', `/embed/?t=${TOKEN_LIKE}`)
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: ROW_TEA }))
    expect(await screen.findByRole('main', { name: '대화: 티타임' })).not.toBeNull()
    // ⓐ 읽기 전용 판
    expect(screen.getByRole('note').textContent).toBe('열람 전용 - 대화 참여는 등급 회원만')
    expect(screen.queryByRole('textbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: BACK }))
    await screen.findByRole('button', { name: ROW_TEA })
    expect(screen.queryByRole('button', { name: /새 방/ })).toBeNull()
    // ⓑ 저장소: 허용 키만, 토큰 문자열 없음
    for (const [key, value] of storageEntries()) {
      expect(key).toMatch(ALLOWED_KEY)
      expect(value).not.toContain(TOKEN_LIKE)
    }
    // ⓒ 읽기 래퍼만 호출
    expect(mockedListRooms).toHaveBeenCalledTimes(2)
    expect(mockedListMessages.mock.calls[0]).toEqual(['r1'])
  })
})

describe('App 저장 불가 환경 (R-ROOMS-004 "저장 불가 환경에서도 동작")', () => {
  it('TC-RM-010: localStorage 읽기·쓰기·삭제가 모두 throw → 목록·진입·뒤로가 정상', async () => {
    localStorage.setItem('ld:lastRoomId', 'r1')
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)
    const user = userEvent.setup()
    render(<App />)

    // 읽기 실패 = 저장된 방 없음 → 자동 진입 없이 목록
    expect(await screen.findByRole('button', { name: ROW_TEA })).not.toBeNull()
    expect(screen.queryByRole('main', { name: /^대화:/ })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()

    await user.click(screen.getByRole('button', { name: ROW_TEA }))
    expect(await screen.findByRole('main', { name: '대화: 티타임' })).not.toBeNull()
    await user.click(screen.getByRole('button', { name: BACK }))
    expect(await screen.findByRole('button', { name: ROW_TEA })).not.toBeNull()

    expect(mockedListRooms).toHaveBeenCalledTimes(2)
    expect(mockedListMessages.mock.calls[0]).toEqual(['r1'])
  })
})
