/**
 * chat S2 ⋯ 방 메뉴 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md
 * (TC-CH-047 ~ 050 · TC-CH-054 (c) · TC-CH-064 · TC-CH-065)
 * 대상: ChatTopBar ⋯ · RoomMenuSheet · PromptSheet · ConfirmDialog · useRoomActions · App(replaceRoomInView · backToRooms)
 * - 화면 단위는 viewer props, App 통합은 initToken('?t=test-token') → render(<App />) → clearToken().
 * - api 래퍼는 vi.mock. isAuthFailure 실물. fetch 모킹 금지. matchMedia 스텁.
 * - S4(v1.0): 방 메뉴 항목에 「장기기억」이 들어와 TC-CH-047 을 개정했다(순서 정본 TC-CH-122, MemorySheet.test.tsx).
 *   진입 없는 TC 의 "쓰기 래퍼 0회"에 getMemory·putMemory 를 포함하려고 @/api/memory 도 모킹한다.
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ERROR_MESSAGES } from '@shared/errors'
import type { MessagesPage, RoomSummary } from '@shared/types'
import type { ApiErrorCode, Result } from '@/api'
import { getMemory, putMemory } from '@/api/memory'
import { appendUser, deleteMessage, editMessage, listMessages } from '@/api/messages'
import { createRoom, deleteRoom, listRooms, renameRoom } from '@/api/rooms'
import { App } from '@/App'
import { ChatScreen } from '@/chat'
import { clearToken, initToken } from '@/state/token'
import { READ_ONLY_VIEWER, WRITER_VIEWER } from '@/state/viewer'

vi.mock('@/api/messages', () => ({
  listMessages: vi.fn(),
  appendUser: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
}))
vi.mock('@/api/rooms', () => ({
  listRooms: vi.fn(),
  createRoom: vi.fn(),
  renameRoom: vi.fn(),
  deleteRoom: vi.fn(),
}))
vi.mock('@/api/memory', () => ({
  getMemory: vi.fn(),
  putMemory: vi.fn(),
}))

const mocks = [
  listMessages,
  appendUser,
  editMessage,
  deleteMessage,
  listRooms,
  createRoom,
  renameRoom,
  deleteRoom,
  getMemory,
  putMemory,
].map(f => vi.mocked(f))
const mockedList = vi.mocked(listMessages)
const mockedRename = vi.mocked(renameRoom)
const mockedDeleteRoom = vi.mocked(deleteRoom)
const mockedListRooms = vi.mocked(listRooms)

const ROOM: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 5, 9, 0).getTime(),
  updatedAt: new Date(2026, 9, 5, 16, 40).getTime(),
  messageCount: 1,
}
const ROOM_CHESS: RoomSummary = {
  id: 'r2',
  title: '체스 대결',
  createdAt: new Date(2026, 9, 1, 9, 0).getTime(),
  updatedAt: new Date(2026, 9, 3, 21, 5).getTime(),
  messageCount: 1,
}
const NEW_TITLE = '팬텀하이브 저택의 밤'
const PAGE: MessagesPage = {
  messages: [
    {
      id: 101,
      roomId: 'r1',
      speaker: 'ciel',
      kind: 'line',
      text: '세바스찬, 홍차.',
      authorName: null,
      createdAt: new Date(2026, 9, 5, 16, 40).getTime(),
    },
  ],
  hasMore: false,
}
const MORE = '방 메뉴 열기'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fail = (code: ApiErrorCode, retryAfterSec?: number): Result<never> => ({
  ok: false,
  error:
    retryAfterSec === undefined
      ? { code, message: 'SERVER-RAW-MESSAGE' }
      : { code, message: 'SERVER-RAW-MESSAGE', retryAfterSec },
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

/** App 의 전환을 흉내 내는 하네스: onAuthFailure → spy + READ_ONLY */
const Harness = (props: {
  onAuthFailure: () => void
  onBack: () => void
  onRoomRenamed: (r: RoomSummary) => void
}) => {
  const [viewer, setViewer] = useState(WRITER_VIEWER)
  return (
    <ChatScreen
      room={ROOM}
      viewer={viewer}
      onBack={props.onBack}
      onRoomRenamed={props.onRoomRenamed}
      onAuthFailure={() => {
        props.onAuthFailure()
        setViewer(READ_ONLY_VIEWER)
      }}
    />
  )
}
const renderChat = () => {
  const onBack = vi.fn()
  const onAuthFailure = vi.fn()
  const onRoomRenamed = vi.fn()
  render(<Harness onBack={onBack} onAuthFailure={onAuthFailure} onRoomRenamed={onRoomRenamed} />)
  return { onBack, onAuthFailure, onRoomRenamed }
}
const openRoomMenu = async () => {
  const user = userEvent.setup()
  await screen.findByRole('log')
  await user.click(screen.getByRole('button', { name: MORE }))
  return { user, menu: screen.getByRole('dialog', { name: '방 메뉴' }) }
}
const openRename = async () => {
  const { user, menu } = await openRoomMenu()
  await user.click(within(menu).getByRole('button', { name: '이름 변경' }))
  const sheet = screen.getByRole('dialog', { name: '방 이름 변경' })
  const input = within(sheet).getByRole('textbox', { name: '방 이름' }) as HTMLInputElement
  const save = within(sheet).getByRole('button', { name: '저장' }) as HTMLButtonElement
  return { user, sheet, input, save }
}
const openDeleteRoom = async () => {
  const { user, menu } = await openRoomMenu()
  await user.click(within(menu).getByRole('button', { name: '방 삭제' }))
  return { user, confirm: screen.getByRole('alertdialog', { name: '이 방을 삭제할까요?' }) }
}

beforeEach(() => {
  for (const m of mocks) m.mockReset()
  mockedList.mockResolvedValue(ok(PAGE))
  localStorage.clear()
  clearToken()
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

describe('⋯ 방 메뉴 (R-CHAT-001)', () => {
  it('TC-CH-047: ⋯ → 방 메뉴(머리·항목 4개 순서, S4 장기기억 포함) → 취소·Esc 뒤 ⋯ 포커스, 장기기억 조회 0회', async () => {
    renderChat()
    const { user, menu } = await openRoomMenu()
    expect(menu.querySelector('p')?.textContent).toBe('방 메뉴 · 티타임')
    // S4 개정(v1.0): 옛 ['이름 변경', '방 삭제', '취소'] + "장기기억 없음" 단언 → 4항목(순서 정본 TC-CH-122)
    expect(
      within(menu)
        .getAllByRole('button')
        .map(b => b.textContent),
    ).toEqual(['이름 변경', '장기기억', '방 삭제', '취소'])
    await user.click(within(menu).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: MORE }))

    await user.click(screen.getByRole('button', { name: MORE }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: MORE }))
    await flushPending()
    for (const m of mocks) if (m !== mockedList) expect(m).not.toHaveBeenCalled()
  })
})

describe('이름 변경 (R-CHAT-001 · R-ROOM-003)', () => {
  it('TC-CH-048: 현재 제목·3/60, 그대로·공백·61자 disabled → 새 제목 저장 → renameRoom·onRoomRenamed, ⋯ 포커스', async () => {
    mockedRename.mockResolvedValueOnce(ok({ ...ROOM, title: NEW_TITLE }))
    const { onRoomRenamed } = renderChat()
    const { user, sheet, input, save } = await openRename()

    expect(input.value).toBe('티타임')
    expect(within(sheet).getByText('3/60')).not.toBeNull()
    expect(save.disabled).toBe(true)
    for (const v of ['  티타임  ', '   ', 'a'.repeat(61)]) {
      fireEvent.change(input, { target: { value: v } })
      expect(save.disabled).toBe(true)
    }
    fireEvent.change(input, { target: { value: NEW_TITLE } })
    expect(save.disabled).toBe(false)
    await user.click(save)

    await vi.waitFor(() => expect(onRoomRenamed).toHaveBeenCalledTimes(1))
    expect(onRoomRenamed.mock.calls[0]?.[0]).toEqual({ ...ROOM, title: NEW_TITLE })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: MORE }))
    expect(mockedRename.mock.calls).toEqual([['r1', { title: NEW_TITLE }]])
  })

  it('TC-CH-048: Enter 로도 저장된다', async () => {
    mockedRename.mockResolvedValueOnce(ok({ ...ROOM, title: NEW_TITLE }))
    const { onRoomRenamed } = renderChat()
    const { user, input } = await openRename()
    fireEvent.change(input, { target: { value: NEW_TITLE } })
    input.focus()
    await user.keyboard('{Enter}')
    await vi.waitFor(() => expect(onRoomRenamed).toHaveBeenCalledTimes(1))
    expect(mockedRename).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['INTERNAL', undefined, ERROR_MESSAGES.INTERNAL],
    ['NOT_FOUND', undefined, '방을 찾을 수 없습니다. 목록으로 돌아가 주세요.'],
    ['RATE_LIMITED', 40, '요청이 너무 많습니다. 40초 후 다시 시도해 주세요.'],
    ['VALIDATION_ERROR', undefined, '방 제목은 1~60자로 입력해 주세요.'],
  ] as const)(
    'TC-CH-049: 이름 변경 %s → 시트 유지·입력 유지·시트 안 alert, E 토스트 없음',
    async (code, sec, text) => {
      mockedRename.mockResolvedValueOnce(fail(code, sec))
      const { onRoomRenamed, onAuthFailure } = renderChat()
      const { user, sheet, input, save } = await openRename()
      fireEvent.change(input, { target: { value: '새 제목' } })
      await user.click(save)

      const alert = await within(sheet).findByRole('alert')
      expect(alert.textContent).toBe(text)
      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(screen.getByRole('dialog', { name: '방 이름 변경' })).toBe(sheet)
      expect(input.value).toBe('새 제목')
      expect(onRoomRenamed).not.toHaveBeenCalled()
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(mockedRename).toHaveBeenCalledTimes(1)
    },
  )

  it('TC-CH-049: 이름 변경 LEVEL_TOO_LOW → 시트 닫힘, 전환 안내 토스트, 열람 안내', async () => {
    mockedRename.mockResolvedValueOnce(fail('LEVEL_TOO_LOW'))
    const { onAuthFailure } = renderChat()
    const { user, input, save } = await openRename()
    fireEvent.change(input, { target: { value: '새 제목' } })
    await user.click(save)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('note').textContent).toBe('열람 전용 - 대화 참여는 등급 회원만')
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
    expect(mockedRename).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-054: (c) 이름 변경 대기 중 ⋯ disabled', async () => {
    const pending = deferred<Result<RoomSummary>>()
    mockedRename.mockReturnValueOnce(pending.promise)
    renderChat()
    const { user, input, save } = await openRename()
    fireEvent.change(input, { target: { value: NEW_TITLE } })
    await user.click(save)
    expect((screen.getByRole('button', { name: MORE }) as HTMLButtonElement).disabled).toBe(true)
    expect(input.readOnly).toBe(true)
    await act(async () => {
      pending.resolve(ok({ ...ROOM, title: NEW_TITLE }))
    })
    expect(mockedRename).toHaveBeenCalledTimes(1)
    for (const m of [appendUser, editMessage, deleteMessage, deleteRoom])
      expect(vi.mocked(m)).not.toHaveBeenCalled()
  })
})

describe('방 삭제 (R-CHAT-001 · R-ROOM-004 · R-ROOMS-004)', () => {
  it('TC-CH-050: (a) 확인 문구·첫 포커스 취소 → 삭제 대기 중 잠금·Esc·덮개 무시 → 기록 삭제 후 onBack', async () => {
    localStorage.setItem('ld:lastRoomId', 'r1')
    const pending = deferred<Result<void>>()
    mockedDeleteRoom.mockReturnValueOnce(pending.promise)
    const { onBack } = renderChat()
    let lastAtBack: string | null | undefined
    onBack.mockImplementation(() => {
      lastAtBack = localStorage.getItem('ld:lastRoomId')
    })
    const { user, confirm } = await openDeleteRoom()

    expect(confirm.textContent).toContain('메시지와 장기기억이 함께 지워지며 되돌릴 수 없습니다.')
    expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: '취소' }))
    await user.click(within(confirm).getByRole('button', { name: '삭제' }))
    for (const b of within(confirm).getAllByRole('button'))
      expect((b as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(confirm, { key: 'Escape' })
    fireEvent.click(confirm.parentElement as HTMLElement)
    expect(screen.getByRole('alertdialog')).toBe(confirm)

    await act(async () => {
      pending.resolve(ok(undefined))
    })
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(lastAtBack).toBeNull()
    expect(mockedDeleteRoom.mock.calls).toEqual([['r1']])
  })

  it('TC-CH-050: (b) NOT_FOUND 도 성공처럼 onBack', async () => {
    localStorage.setItem('ld:lastRoomId', 'r1')
    mockedDeleteRoom.mockResolvedValueOnce(fail('NOT_FOUND'))
    const { onBack } = renderChat()
    const { user, confirm } = await openDeleteRoom()
    await user.click(within(confirm).getByRole('button', { name: '삭제' }))
    await vi.waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
    expect(localStorage.getItem('ld:lastRoomId')).toBeNull()
    expect(mockedDeleteRoom).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-050: (c) INTERNAL → onBack 0회, 시트 닫힘, 토스트, 기록 유지', async () => {
    localStorage.setItem('ld:lastRoomId', 'r1')
    mockedDeleteRoom.mockResolvedValueOnce(fail('INTERNAL'))
    const { onBack } = renderChat()
    const { user, confirm } = await openDeleteRoom()
    await user.click(within(confirm).getByRole('button', { name: '삭제' }))
    expect((await screen.findByRole('alert')).textContent).toBe(ERROR_MESSAGES.INTERNAL)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onBack).not.toHaveBeenCalled()
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    expect(mockedDeleteRoom).toHaveBeenCalledTimes(1)
  })
})

describe('App 통합 — 이름 변경·방 삭제 뒤 목록 (TC-FLOW, R-CHAT-001)', () => {
  const enterTea = async () => {
    initToken('?t=test-token')
    render(<App />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /^티타임, 마지막 갱신/ }))
    await screen.findByRole('log')
    return user
  }

  it('TC-CH-048: (App) 이름 변경 → h1·main 이름 갱신, 재마운트 없음', async () => {
    mockedListRooms.mockResolvedValue(ok([ROOM]))
    mockedRename.mockResolvedValueOnce(ok({ ...ROOM, title: NEW_TITLE }))
    const user = await enterTea()
    await user.click(screen.getByRole('button', { name: MORE }))
    await user.click(screen.getByRole('button', { name: '이름 변경' }))
    fireEvent.change(screen.getByRole('textbox', { name: '방 이름' }), {
      target: { value: NEW_TITLE },
    })
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByRole('heading', { level: 1, name: NEW_TITLE })).not.toBeNull()
    expect(screen.getByRole('main', { name: `대화: ${NEW_TITLE}` })).not.toBeNull()
    await flushPending()
    expect(mockedList).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-064: 방 삭제 → rooms, listRooms 총 2회, 두 번째 응답 그대로, 기록 없음', async () => {
    mockedListRooms
      .mockResolvedValueOnce(ok([ROOM, ROOM_CHESS]))
      .mockResolvedValueOnce(ok([ROOM_CHESS]))
    mockedDeleteRoom.mockResolvedValueOnce(ok(undefined))
    const user = await enterTea()
    await user.click(screen.getByRole('button', { name: MORE }))
    await user.click(screen.getByRole('button', { name: '방 삭제' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '삭제' }))

    expect(await screen.findByRole('main', { name: '방 목록' })).not.toBeNull()
    expect(
      await screen.findByRole('button', { name: '체스 대결, 마지막 갱신 10.03' }),
    ).not.toBeNull()
    expect(screen.queryByRole('button', { name: /^티타임/ })).toBeNull()
    expect(localStorage.getItem('ld:lastRoomId')).toBeNull()
    expect(mockedDeleteRoom.mock.calls).toEqual([['r1']])
    expect(mockedListRooms).toHaveBeenCalledTimes(2)
  })

  it('TC-CH-065: 이름 변경 → ‹ 뒤로 → listRooms 재호출 1회, 행은 두 번째 응답 그대로', async () => {
    mockedListRooms
      .mockResolvedValueOnce(ok([ROOM]))
      .mockResolvedValueOnce(ok([{ ...ROOM, title: '새 이름' }]))
    mockedRename.mockResolvedValueOnce(ok({ ...ROOM, title: '새 이름' }))
    const user = await enterTea()
    await user.click(screen.getByRole('button', { name: MORE }))
    await user.click(screen.getByRole('button', { name: '이름 변경' }))
    fireEvent.change(screen.getByRole('textbox', { name: '방 이름' }), {
      target: { value: '새 이름' },
    })
    await user.click(screen.getByRole('button', { name: '저장' }))
    await screen.findByRole('heading', { level: 1, name: '새 이름' })
    await user.click(screen.getByRole('button', { name: '방 목록으로 돌아가기' }))

    expect(await screen.findByRole('button', { name: '새 이름, 마지막 갱신 10.05' })).not.toBeNull()
    expect(localStorage.getItem('ld:lastRoomId')).toBeNull()
    expect(mockedRename).toHaveBeenCalledTimes(1)
    expect(mockedListRooms).toHaveBeenCalledTimes(2)
  })
})
