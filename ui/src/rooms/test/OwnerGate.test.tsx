/**
 * rooms S3c 델타 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-033 ~ 039)
 * 대상: App 주인 판정 effect(F-RM-24) · openSettings/leaveSettings/loseOwner(F-RM-25~27) · ⚙ 렌더(F-RM-28) ·
 *       진입 안내 effect(F-RM-29) · 공용 IconButton 'settings'(C §1.3)
 * - 토큰 주입은 initToken('?t=…') 하나로만(render 전), 정리는 clearToken(). fetch 모킹 금지.
 * - api 래퍼는 vi.mock('@/api/rooms'·'@/api/messages'·'@/api/settings'). isAuthFailure 실물.
 * - 판정 실패는 "조용히": revokeWrite 경로 미호출은 getToken() !== null · 「+ 새 방」 유지 · alert 없음으로 관찰한다.
 */
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CharacterSettingsResponse, MessagesPage, RoomSummary } from '@shared/types'
import type { ApiErrorCode, Result } from '@/api'
import { appendUser, deleteMessage, editMessage, listMessages } from '@/api/messages'
import { createRoom, deleteRoom, listRooms, renameRoom } from '@/api/rooms'
import { getCharacterSettings, saveCharacterSettings } from '@/api/settings'
import { App } from '@/App'
import { IconButton } from '@/components/ui/IconButton'
import { RoomsScreen } from '@/rooms'
import { clearToken, getToken, initToken } from '@/state/token'
import { READ_ONLY_VIEWER, WRITER_VIEWER } from '@/state/viewer'
import { SAVED_RESPONSE, deferred, fail, ok } from '@/settings/test/fixtures'

vi.mock('@/api/rooms', () => ({ listRooms: vi.fn(), createRoom: vi.fn(), renameRoom: vi.fn(), deleteRoom: vi.fn() }))
vi.mock('@/api/messages', () => ({ listMessages: vi.fn(), appendUser: vi.fn(), editMessage: vi.fn(), deleteMessage: vi.fn() }))
vi.mock('@/api/settings', () => ({ getCharacterSettings: vi.fn(), saveCharacterSettings: vi.fn() }))

const mockedListRooms = vi.mocked(listRooms)
const mockedCreateRoom = vi.mocked(createRoom)
const mockedListMessages = vi.mocked(listMessages)
const mockedGet = vi.mocked(getCharacterSettings)
const mockedSave = vi.mocked(saveCharacterSettings)
const otherWrites = [renameRoom, deleteRoom, appendUser, editMessage, deleteMessage].map(f => vi.mocked(f))

const ROOM_TEA: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 2, 10, 0).getTime(),
  updatedAt: new Date(2026, 9, 5, 16, 40).getTime(),
  messageCount: 1,
}
const EMPTY: MessagesPage = { messages: [], hasMore: false }
const ROW_TEA = '티타임, 마지막 갱신 10.05'
const NEW_ROOM = '새 방 만들기'
const GEAR = '캐릭터 설정'
const CHAT_BACK = '방 목록으로 돌아가기'
const TOKEN = 'test-token'
const OWNER_ONLY_TEXT = '캐릭터 설정은 갠홈 주인만 열 수 있습니다.'
const TOKEN_INVALID_TEXT = '인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.'

const flush = async () => {
  await act(async () => {})
}
const roomsH1 = () => screen.getByRole('heading', { level: 1, name: 'ROOMS' })
const renderOwnerApp = async () => {
  initToken(`?t=${TOKEN}`)
  mockedGet.mockResolvedValueOnce(ok(SAVED_RESPONSE))
  render(<App />)
  await screen.findByRole('button', { name: GEAR })
  return userEvent.setup()
}

beforeEach(() => {
  for (const m of [mockedListRooms, mockedCreateRoom, mockedListMessages, mockedGet, mockedSave, ...otherWrites]) m.mockReset()
  mockedListRooms.mockResolvedValue(ok([ROOM_TEA]))
  mockedListMessages.mockResolvedValue(ok(EMPTY))
  localStorage.clear()
  sessionStorage.clear()
  clearToken()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  clearToken()
})

describe('주인 판정 · ⚙ 렌더 (R-SET-009 · R-SET-010 · R-ROOMS-002)', () => {
  it('TC-RM-033: (a) 토큰 + 판정 200 → GET 정확히 1회(인자 없음) · ⚙ 렌더 · DOM 순서 ⚙ → 새 방 · 포커스 h1 유지 · Tab 순서', async () => {
    const user = await renderOwnerApp()
    const gear = screen.getByRole('button', { name: GEAR })
    const newRoom = screen.getByRole('button', { name: NEW_ROOM })
    expect(gear.compareDocumentPosition(newRoom) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(gear.closest('header')).toBe(newRoom.closest('header'))
    expect(document.activeElement).toBe(roomsH1())
    await user.tab()
    expect(document.activeElement).toBe(gear)
    await user.tab()
    expect(document.activeElement).toBe(newRoom)
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: ROW_TEA }))

    expect(getToken()).toBe(TOKEN)
    expect(localStorage.length).toBe(0)
    await flush()
    expect(mockedGet).toHaveBeenCalledTimes(1)
    expect(mockedGet.mock.calls[0]).toEqual([])
    expect(mockedSave).not.toHaveBeenCalled()
    expect(mockedListRooms).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-033: (b) StrictMode 이중 effect 에서도 판정 GET 1회', async () => {
    initToken(`?t=${TOKEN}`)
    mockedGet.mockResolvedValue(ok(SAVED_RESPONSE))
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    expect(await screen.findByRole('button', { name: GEAR })).not.toBeNull()
    await flush()
    expect(mockedGet).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-033: (c) 판정이 늦게 끝나면 ⚙ 가 나중에 나타나고 「+ 새 방」은 오른쪽 끝 그대로', async () => {
    initToken(`?t=${TOKEN}`)
    const probe = deferred<Result<CharacterSettingsResponse>>()
    mockedGet.mockReturnValueOnce(probe.promise)
    render(<App />)
    const newRoom = await screen.findByRole('button', { name: NEW_ROOM })
    expect(screen.queryByRole('button', { name: GEAR })).toBeNull()
    await act(async () => probe.resolve(ok(SAVED_RESPONSE)))
    expect(await screen.findByRole('button', { name: GEAR })).not.toBeNull()
    expect(newRoom.parentElement?.lastElementChild).toBe(newRoom)
    expect(document.activeElement).toBe(roomsH1())
  })

  it.each<ApiErrorCode>(['OWNER_ONLY', 'TOKEN_INVALID', 'TOKEN_REQUIRED', 'LEVEL_TOO_LOW', 'NETWORK', 'INTERNAL'])(
    'TC-RM-034: 판정 %s → 조용히 ⚙ 미렌더 · 「+ 새 방」 유지 · getToken 유지 · alert 없음',
    async code => {
      initToken(`?t=${TOKEN}`)
      mockedGet.mockResolvedValueOnce(fail(code))
      render(<App />)
      expect(await screen.findByRole('button', { name: NEW_ROOM })).not.toBeNull()
      await flush()
      expect(screen.queryByRole('button', { name: GEAR })).toBeNull()
      expect(screen.getByRole('button', { name: NEW_ROOM })).not.toBeNull()
      expect(getToken()).toBe(TOKEN)
      expect(screen.queryByRole('alert')).toBeNull()
      expect(localStorage.length).toBe(0)
      expect(mockedGet).toHaveBeenCalledTimes(1)
      expect(mockedListRooms).toHaveBeenCalledTimes(1)
      for (const m of [mockedCreateRoom, ...otherWrites]) expect(m).not.toHaveBeenCalled()
    },
  )

  it('TC-RM-035: (a) 토큰 없음 → 판정 GET 미호출 · ⚙·「+ 새 방」 DOM 없음', async () => {
    initToken('')
    render(<App />)
    expect(await screen.findByRole('button', { name: ROW_TEA })).not.toBeNull()
    await flush()
    expect(mockedGet).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: GEAR })).toBeNull()
    expect(screen.queryByRole('button', { name: NEW_ROOM })).toBeNull()
    expect(getToken()).toBeNull()
  })

  it('TC-RM-035: (b) RoomsScreen 4분기 — 읽기 전용+주인 · 쓰기+비주인 · 쓰기+주인(콜백 없음) → 없음 / 쓰기+주인+콜백 → 있음', async () => {
    const base = { autoOpenRoomId: null, onOpenRoom: vi.fn(), onAutoOpenSettled: vi.fn(), onAuthFailure: vi.fn() }
    const onOpenSettings = vi.fn()
    const cases = [
      { props: { viewer: READ_ONLY_VIEWER, isOwner: true, onOpenSettings }, expected: false },
      { props: { viewer: WRITER_VIEWER, isOwner: false, onOpenSettings }, expected: false },
      { props: { viewer: WRITER_VIEWER, isOwner: true }, expected: false },
      { props: { viewer: WRITER_VIEWER, isOwner: true, onOpenSettings }, expected: true },
    ]
    for (const { props, expected } of cases) {
      render(<RoomsScreen {...base} {...props} />)
      await screen.findByRole('button', { name: ROW_TEA })
      expect(screen.queryByRole('button', { name: GEAR }) !== null).toBe(expected)
      cleanup()
    }
    expect(onOpenSettings).not.toHaveBeenCalled()
    expect(mockedGet).not.toHaveBeenCalled()
  })
})

describe('설정 진입·복귀 (R-SET-009 · R-SET-010)', () => {
  it('TC-RM-036: ⚙ → 설정 화면(다시 GET) → ‹(clean) → 목록 다시 로드 · ⚙ 유지 · ld:lastRoomId 변화 없음 · h1 포커스', async () => {
    const user = await renderOwnerApp()
    mockedGet.mockResolvedValueOnce(ok(SAVED_RESPONSE))
    await user.click(screen.getByRole('button', { name: GEAR }))
    expect(await screen.findByRole('main', { name: '캐릭터 설정' })).not.toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: '캐릭터 설정' })).not.toBeNull()
    await screen.findByRole('tablist', { name: '설정 묶음' })
    expect(mockedGet).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: '뒤로' }))
    expect(await screen.findByRole('main', { name: '방 목록' })).not.toBeNull()
    expect(await screen.findByRole('button', { name: GEAR })).not.toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(roomsH1()))
    expect(localStorage.getItem('ld:lastRoomId')).toBeNull()
    await flush()
    expect(mockedListRooms).toHaveBeenCalledTimes(2)
    expect(mockedGet).toHaveBeenCalledTimes(2)
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-RM-036: (b) ⚙ 에 포커스 후 Enter → 설정 화면', async () => {
    const user = await renderOwnerApp()
    mockedGet.mockResolvedValueOnce(ok(SAVED_RESPONSE))
    screen.getByRole('button', { name: GEAR }).focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('main', { name: '캐릭터 설정' })).not.toBeNull()
  })

  it('TC-RM-037: (a) 설정 열기 OWNER_ONLY → 목록 · 토스트 warning 1회 · ⚙ 없음 · 「+ 새 방」 유지 · 재마운트 시 반복 없음', async () => {
    const user = await renderOwnerApp()
    mockedGet.mockResolvedValueOnce(fail('OWNER_ONLY'))
    await user.click(screen.getByRole('button', { name: GEAR }))

    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toBe(OWNER_ONLY_TEXT)
    expect(toast.classList.contains('warning')).toBe(true)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('main', { name: '방 목록' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: GEAR })).toBeNull()
    expect(screen.getByRole('button', { name: NEW_ROOM })).not.toBeNull()
    expect(getToken()).toBe(TOKEN)

    await user.click(await screen.findByRole('button', { name: ROW_TEA }))
    await screen.findByRole('main', { name: '대화: 티타임' })
    await user.click(screen.getByRole('button', { name: CHAT_BACK }))
    await screen.findByRole('main', { name: '방 목록' })
    await flush()
    expect(screen.queryByText(OWNER_ONLY_TEXT)).toBeNull()
    expect(screen.queryByRole('button', { name: GEAR })).toBeNull()
    expect(mockedGet).toHaveBeenCalledTimes(2)
    expect(mockedListRooms).toHaveBeenCalledTimes(3)
  })

  it('TC-RM-037: (b) RoomsScreen entryNotice → 마운트 토스트 1회 · onEntryNoticeShown 1회 · 리렌더로 반복 없음', async () => {
    const onEntryNoticeShown = vi.fn()
    const props = {
      viewer: WRITER_VIEWER,
      autoOpenRoomId: null,
      onOpenRoom: vi.fn(),
      onAutoOpenSettled: vi.fn(),
      onAuthFailure: vi.fn(),
      entryNotice: { message: OWNER_ONLY_TEXT, tone: 'warning' as const },
      onEntryNoticeShown,
    }
    const { rerender } = render(<RoomsScreen {...props} />)
    expect((await screen.findByRole('alert')).textContent).toBe(OWNER_ONLY_TEXT)
    expect(onEntryNoticeShown).toHaveBeenCalledTimes(1)
    rerender(<RoomsScreen {...props} entryNotice={null} />)
    rerender(<RoomsScreen {...props} />)
    expect(onEntryNoticeShown).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})

describe('쓰기 상실 시 ⚙ 소멸 (R-SET-010 · R-CHAT-011)', () => {
  it('TC-RM-038: (a) 주인 상태에서 방 생성 TOKEN_INVALID → 「+ 새 방」과 ⚙ 함께 DOM 없음, getToken null', async () => {
    const user = await renderOwnerApp()
    mockedCreateRoom.mockResolvedValueOnce(fail('TOKEN_INVALID'))
    await user.click(screen.getByRole('button', { name: NEW_ROOM }))
    await user.type(screen.getByRole('textbox', { name: '새 방 제목' }), '안개 낀 런던')
    await user.click(screen.getByRole('button', { name: '만들기' }))

    expect((await screen.findByRole('alert')).textContent).toBe(TOKEN_INVALID_TEXT)
    expect(screen.queryByRole('button', { name: NEW_ROOM })).toBeNull()
    expect(screen.queryByRole('button', { name: GEAR })).toBeNull()
    expect(getToken()).toBeNull()
    expect(mockedCreateRoom).toHaveBeenCalledTimes(1)
    expect(mockedGet).toHaveBeenCalledTimes(1)
  })

  it('TC-RM-038: (b) 설정 열기 TOKEN_INVALID → 읽기 전용 목록 · 토스트 1회 · ⚙·「+ 새 방」 없음', async () => {
    const user = await renderOwnerApp()
    mockedGet.mockResolvedValueOnce(fail('TOKEN_INVALID'))
    await user.click(screen.getByRole('button', { name: GEAR }))

    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toBe(TOKEN_INVALID_TEXT)
    expect(toast.classList.contains('warning')).toBe(true)
    expect(screen.getByRole('main', { name: '방 목록' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: GEAR })).toBeNull()
    expect(screen.queryByRole('button', { name: NEW_ROOM })).toBeNull()
    expect(getToken()).toBeNull()
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })
})

describe('공용 IconButton settings (C §1.3 S3c 델타)', () => {
  it('TC-RM-039: icon=settings → svg aria-hidden · 원 2개(r 3·6.5) + 선 path · 이름 · 44 클래스 · back/more 회귀 없음', async () => {
    const onClick = vi.fn()
    const { rerender } = render(<IconButton icon="settings" ariaLabel={GEAR} onClick={onClick} />)
    const btn = screen.getByRole('button', { name: GEAR })
    const svg = btn.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(Array.from(svg?.querySelectorAll('circle') ?? []).map(c => c.getAttribute('r'))).toEqual(['3', '6.5'])
    expect(svg?.querySelectorAll('path')).toHaveLength(1)
    expect(btn.classList.contains('root')).toBe(true)
    expect(btn.getAttribute('type')).toBe('button')
    await userEvent.setup().click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(<IconButton icon="back" ariaLabel="뒤로" onClick={onClick} />)
    expect(screen.getByRole('button', { name: '뒤로' }).querySelector('path')?.getAttribute('d')).toBe('M15 5l-7 7 7 7')
    rerender(<IconButton icon="more" ariaLabel="메뉴" onClick={onClick} isDisabled />)
    const more = screen.getByRole('button', { name: '메뉴' }) as HTMLButtonElement
    expect(more.querySelectorAll('circle')).toHaveLength(3)
    expect(more.disabled).toBe(true)
  })
})
