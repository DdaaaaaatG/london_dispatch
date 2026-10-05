/**
 * chat S2 인증 실패 전환·늦은 응답 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md
 * (TC-CH-051 · TC-CH-052 · TC-CH-063)
 * 대상: handleWriteFailure(F-CH-16, 멱등) · 전환 effect(F-CH-29) · App.revokeWrite(F-RM-12) · 비활성 응답 무시
 * - App 통합은 initToken('?t=test-token') → render(<App />) → clearToken(). 화면 단위 전환은 하네스.
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Message, MessagesPage, RoomSummary } from '@shared/types'
import type { ApiErrorCode, Result } from '@/api'
import { appendUser, deleteMessage, editMessage, listMessages } from '@/api/messages'
import { createRoom, deleteRoom, listRooms, renameRoom } from '@/api/rooms'
import { App } from '@/App'
import { ChatScreen } from '@/chat'
import { clearToken, getToken, initToken } from '@/state/token'
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

const mocks = [listMessages, appendUser, editMessage, deleteMessage, listRooms, createRoom, renameRoom, deleteRoom].map(
  f => vi.mocked(f),
)
const mockedAppend = vi.mocked(appendUser)
const mockedEdit = vi.mocked(editMessage)
const mockedDelete = vi.mocked(deleteMessage)
const mockedDeleteRoom = vi.mocked(deleteRoom)

const ROOM: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 5, 9, 0).getTime(),
  updatedAt: new Date(2026, 9, 5, 16, 40).getTime(),
  messageCount: 2,
}
const at = (h: number, m: number): number => new Date(2026, 9, 5, h, m).getTime()
const M101: Message = { id: 101, roomId: 'r1', speaker: 'ciel', kind: 'line', text: '세바스찬, 홍차.', authorName: null, createdAt: at(16, 40) }
const M103: Message = { id: 103, roomId: 'r1', speaker: 'user', kind: 'line', text: '나도 한 잔 부탁해요.', authorName: '미샤', createdAt: at(16, 42) }
const PAGE: MessagesPage = { messages: [M101, M103], hasMore: false }
const NOTICE = '열람 전용 - 대화 참여는 등급 회원만'
const BACK = '방 목록으로 돌아가기'

const fail = (code: ApiErrorCode): Result<never> => ({ ok: false, error: { code, message: 'SERVER-RAW-MESSAGE' } })
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
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
const bubbleOf = (index: number) =>
  within(screen.getByRole('log')).getAllByRole('listitem')[index]?.firstElementChild as HTMLElement
const expectReadOnly = () => {
  expect(screen.queryByRole('button', { name: '방 메뉴 열기' })).toBeNull()
  expect(screen.queryByRole('group', { name: '메시지 작성' })).toBeNull()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByRole('switch')).toBeNull()
  expect(screen.getByRole('note').textContent).toBe(NOTICE)
}

const Harness = (props: { onAuthFailure: () => void }) => {
  const [viewer, setViewer] = useState(WRITER_VIEWER)
  return (
    <ChatScreen
      room={ROOM}
      viewer={viewer}
      onBack={vi.fn()}
      onRoomRenamed={vi.fn()}
      onAuthFailure={() => {
        props.onAuthFailure()
        setViewer(READ_ONLY_VIEWER)
      }}
    />
  )
}

beforeEach(() => {
  for (const m of mocks) m.mockReset()
  vi.mocked(listMessages).mockResolvedValue(ok(PAGE))
  vi.mocked(listRooms).mockResolvedValue(ok([ROOM]))
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

describe('인증 실패 전환 — App 통합 (R-CHAT-011 · R-CHAT-008 · R-CHAT-009)', () => {
  it.each([
    ['LEVEL_TOO_LOW', '대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.'],
    ['TOKEN_INVALID', '인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.'],
    ['TOKEN_REQUIRED', '로그인 정보가 없어 열람 전용으로 바뀌었습니다.'],
  ] as const)('TC-CH-051: 전송이 %s → 같은 화면 읽기 전용, 토스트 1개, ‹ 포커스, 토큰 비움 → rooms 도 읽기 전용', async (code, text) => {
    mockedAppend.mockResolvedValueOnce(fail(code))
    initToken('?t=test-token')
    render(<App />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /^티타임, 마지막 갱신/ }))
    await screen.findByRole('log')

    await user.type(screen.getByRole('textbox', { name: '메시지 입력' }), '안녕')
    await user.click(screen.getByRole('button', { name: '전송' }))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.textContent).toBe(text)
    expect(alerts[0]?.classList.contains('warning')).toBe(true)
    expectReadOnly()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: BACK })))
    expect(getToken()).toBeNull()

    const bubble = bubbleOf(0)
    expect(bubble.getAttribute('aria-haspopup')).toBeNull()
    expect(fireEvent.contextMenu(bubble)).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: BACK }))
    expect(await screen.findByRole('main', { name: '방 목록' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: '새 방 만들기' })).toBeNull()
    expect(mockedAppend).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-051: (b) 부모가 전환하지 않아도 두 번째 인증 실패는 다시 알리지 않는다(멱등)', async () => {
    mockedAppend.mockResolvedValue(fail('LEVEL_TOO_LOW'))
    const onAuthFailure = vi.fn()
    render(<ChatScreen room={ROOM} viewer={WRITER_VIEWER} onBack={vi.fn()} onAuthFailure={onAuthFailure} onRoomRenamed={vi.fn()} />)
    await screen.findByRole('log')
    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: '메시지 입력' })

    await user.type(input, '안녕')
    await user.click(screen.getByRole('button', { name: '전송' }))
    // CF-05: 첫 토스트 요소를 잡아 둔다. 재표시면 key(toast.id)가 바뀌어 새 요소가 된다
    const firstAlert = await screen.findByRole('alert')
    const firstText = firstAlert.textContent
    await user.click(screen.getByRole('button', { name: '전송' }))
    await vi.waitFor(() => expect(mockedAppend).toHaveBeenCalledTimes(2))
    await flushPending()
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toBe(firstAlert)
    expect(firstAlert.textContent).toBe(firstText)
  })
})

describe('전환 시 열린 상태 정리 (R-CHAT-011 · R-CHAT-007)', () => {
  it('TC-CH-052: (a) 편집기 저장이 TOKEN_INVALID → 편집기 없음, 원문 말풍선, 열람 안내, ‹ 포커스', async () => {
    mockedEdit.mockResolvedValueOnce(fail('TOKEN_INVALID'))
    const onAuthFailure = vi.fn()
    render(<Harness onAuthFailure={onAuthFailure} />)
    await screen.findByRole('log')
    const user = userEvent.setup()
    fireEvent.contextMenu(bubbleOf(1))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '수정' }))
    fireEvent.change(screen.getByRole('textbox', { name: '수정할 내용' }), { target: { value: '새 본문' } })
    await user.click(screen.getByRole('button', { name: '저장' }))

    await screen.findByRole('note')
    expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()
    expect(bubbleOf(1).textContent).toContain('나도 한 잔 부탁해요.')
    expectReadOnly()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: BACK })))
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
    expect(mockedEdit).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-052: (b) 메시지 삭제 확인에서 LEVEL_TOO_LOW → 시트 없음, 말풍선 유지', async () => {
    mockedDelete.mockResolvedValueOnce(fail('LEVEL_TOO_LOW'))
    const onAuthFailure = vi.fn()
    render(<Harness onAuthFailure={onAuthFailure} />)
    await screen.findByRole('log')
    const user = userEvent.setup()
    fireEvent.contextMenu(bubbleOf(1))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '삭제' }))

    await screen.findByRole('note')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(within(screen.getByRole('log')).getAllByRole('listitem')).toHaveLength(2)
    expectReadOnly()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: BACK }))) // TK-07
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
    expect(mockedDelete).toHaveBeenCalledTimes(1)
  })
})

describe('늦은 쓰기 응답 무시 (R-CHAT-006 · R-CHAT-007 · R-CHAT-001)', () => {
  const setup = async () => {
    const onBack = vi.fn()
    const onAuthFailure = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const view = render(
      <ChatScreen room={ROOM} viewer={WRITER_VIEWER} onBack={onBack} onAuthFailure={onAuthFailure} onRoomRenamed={vi.fn()} />,
    )
    await screen.findByRole('log')
    return { ...view, onBack, onAuthFailure, errorSpy, user: userEvent.setup() }
  }

  it('TC-CH-063: (a) 전송 대기 중 언마운트 → 인증 실패가 와도 콜백 없음', async () => {
    const pending = deferred<Result<Message>>()
    mockedAppend.mockReturnValueOnce(pending.promise)
    const { unmount, user, onAuthFailure, onBack, errorSpy } = await setup()
    await user.type(screen.getByRole('textbox', { name: '메시지 입력' }), '안녕')
    await user.click(screen.getByRole('button', { name: '전송' }))
    unmount()
    await act(async () => {
      pending.resolve(fail('LEVEL_TOO_LOW'))
      await pending.promise
    })
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(onBack).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    expect(mockedAppend).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-063: (b) 수정 저장 대기 중 언마운트 → 콜백 없음', async () => {
    const pending = deferred<Result<Message>>()
    mockedEdit.mockReturnValueOnce(pending.promise)
    const { unmount, user, onAuthFailure, errorSpy } = await setup()
    fireEvent.contextMenu(bubbleOf(1))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '수정' }))
    fireEvent.change(screen.getByRole('textbox', { name: '수정할 내용' }), { target: { value: '새 본문' } })
    await user.click(screen.getByRole('button', { name: '저장' }))
    unmount()
    await act(async () => {
      pending.resolve(fail('LEVEL_TOO_LOW'))
      await pending.promise
    })
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    expect(mockedEdit).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-063: (c) 메시지 삭제 대기 중 언마운트 → 콜백 없음', async () => {
    const pending = deferred<Result<void>>()
    mockedDelete.mockReturnValueOnce(pending.promise)
    const { unmount, user, onAuthFailure, errorSpy } = await setup()
    fireEvent.contextMenu(bubbleOf(1))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '삭제' }))
    unmount()
    await act(async () => {
      pending.resolve(fail('LEVEL_TOO_LOW'))
      await pending.promise
    })
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    expect(mockedDelete).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-063: (d) 방 삭제 대기 중 언마운트 → onBack 없음, 기록 유지', async () => {
    const pending = deferred<Result<void>>()
    mockedDeleteRoom.mockReturnValueOnce(pending.promise)
    const { unmount, user, onBack, errorSpy } = await setup()
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    await user.click(screen.getByRole('button', { name: '방 메뉴 열기' }))
    await user.click(screen.getByRole('button', { name: '방 삭제' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '삭제' }))
    unmount()
    await act(async () => {
      pending.resolve(ok(undefined))
      await pending.promise
    })
    expect(onBack).not.toHaveBeenCalled()
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    expect(errorSpy).not.toHaveBeenCalled()
    expect(mockedDeleteRoom).toHaveBeenCalledTimes(1)
  })
})
