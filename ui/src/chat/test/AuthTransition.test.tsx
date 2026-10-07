/**
 * chat S2 인증 실패 전환·늦은 응답 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md
 * (TC-CH-051 · TC-CH-052 · TC-CH-063)
 * 대상: handleWriteFailure(F-CH-16, 멱등) · 전환 effect(F-CH-29) · App.revokeWrite(F-RM-12) · 비활성 응답 무시
 * - App 통합은 initToken('?t=test-token') → render(<App />) → clearToken(). 화면 단위 전환은 하네스.
 * - S4(v1.0, TC-CH-134): 장기기억 조회·저장 중 인증 실패 → 시트 닫힘 + 같은 전환. @/api/memory 를 모킹하고 mock 목록에 더한다.
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MemoryResponse, Message, MessagesPage, RoomSummary } from '@shared/types'
import type { ApiErrorCode, Result } from '@/api'
import { getMemory, putMemory } from '@/api/memory'
import {
  appendUser,
  deleteMessage,
  editMessage,
  listMessages,
  regenerate,
  speak,
} from '@/api/messages'
import { createRoom, deleteRoom, listRooms, renameRoom } from '@/api/rooms'
import { App } from '@/App'
import { ChatScreen } from '@/chat'
import { clearToken, getToken, initToken } from '@/state/token'
import { READ_ONLY_VIEWER, WRITER_VIEWER } from '@/state/viewer'

// S3e(TC-CH-120): 재작성 전환 확인을 위해 speak·regenerate 를 목록에 더한다. 이 스펙에는 저장 성공 TC 가 없어 speak 는 불리지 않는다
vi.mock('@/api/messages', () => ({
  listMessages: vi.fn(),
  appendUser: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
  speak: vi.fn(),
  regenerate: vi.fn(),
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
  speak,
  regenerate,
  listRooms,
  createRoom,
  renameRoom,
  deleteRoom,
  getMemory,
  putMemory,
].map(f => vi.mocked(f))
const mockedGetMemory = vi.mocked(getMemory)
const mockedPutMemory = vi.mocked(putMemory)
const mockedRegenerate = vi.mocked(regenerate)
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
const M101: Message = {
  id: 101,
  roomId: 'r1',
  speaker: 'ciel',
  kind: 'line',
  text: '세바스찬, 홍차.',
  authorName: null,
  createdAt: at(16, 40),
}
const M103: Message = {
  id: 103,
  roomId: 'r1',
  speaker: 'user',
  kind: 'line',
  text: '나도 한 잔 부탁해요.',
  authorName: '미샤',
  createdAt: at(16, 42),
}
const PAGE: MessagesPage = { messages: [M101, M103], hasMore: false }
const NOTICE = '열람 전용 - 대화 참여는 등급 회원만'
const BACK = '방 목록으로 돌아가기'

const fail = (code: ApiErrorCode): Result<never> => ({
  ok: false,
  error: { code, message: 'SERVER-RAW-MESSAGE' },
})
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
/** S3e: index 번째 li 의 버튼 줄에서 「수정」·「재작성」·「삭제」(actions.md AC §1) */
const actionAt = (index: number, action: '수정' | '재작성' | '삭제') =>
  within(
    within(
      within(screen.getByRole('log')).getAllByRole('listitem')[index] as HTMLElement,
    ).getByRole('group', { name: /말풍선 작업$/ }),
  ).getByRole('button', { name: new RegExp(`대사 ${action}$`) })
const actionGroups = () => screen.queryAllByRole('group', { name: /말풍선 작업$/ })
/** 마지막 = 세바스찬 line(재작성 대상, TC-CH-120) */
const M104_SEB: Message = {
  id: 104,
  roomId: 'r1',
  speaker: 'sebastian',
  kind: 'line',
  text: '분부대로 하겠습니다.',
  authorName: null,
  createdAt: at(16, 44),
}
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
  ] as const)(
    'TC-CH-051: 전송이 %s → 같은 화면 읽기 전용, 토스트 1개, ‹ 포커스, 토큰 비움 → rooms 도 읽기 전용',
    async (code, text) => {
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
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: BACK })),
      )
      expect(getToken()).toBeNull()

      // S3e 개정: 옛 "이후 말풍선 contextmenu → dialog 없음" → 버튼 줄 group 0개(+ 메뉴 없음 유지)
      expect(actionGroups()).toHaveLength(0)
      expect(screen.queryByRole('button', { name: /대사 (수정|재작성|삭제)$/ })).toBeNull()
      const bubble = bubbleOf(0)
      expect(bubble.getAttribute('aria-haspopup')).toBeNull()
      expect(fireEvent.contextMenu(bubble)).toBe(true)
      expect(screen.queryByRole('dialog')).toBeNull()

      await user.click(screen.getByRole('button', { name: BACK }))
      expect(await screen.findByRole('main', { name: '방 목록' })).not.toBeNull()
      expect(screen.queryByRole('button', { name: '새 방 만들기' })).toBeNull()
      expect(mockedAppend).toHaveBeenCalledTimes(1)
    },
  )

  it('TC-CH-051: (b) 부모가 전환하지 않아도 두 번째 인증 실패는 다시 알리지 않는다(멱등)', async () => {
    mockedAppend.mockResolvedValue(fail('LEVEL_TOO_LOW'))
    const onAuthFailure = vi.fn()
    render(
      <ChatScreen
        room={ROOM}
        viewer={WRITER_VIEWER}
        onBack={vi.fn()}
        onAuthFailure={onAuthFailure}
        onRoomRenamed={vi.fn()}
      />,
    )
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
    await user.click(actionAt(1, '수정')) // S3e: 진입 = 버튼 줄 「수정」
    fireEvent.change(screen.getByRole('textbox', { name: '수정할 내용' }), {
      target: { value: '새 본문' },
    })
    await user.click(screen.getByRole('button', { name: '저장' }))

    await screen.findByRole('note')
    expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()
    expect(bubbleOf(1).textContent).toContain('나도 한 잔 부탁해요.')
    expectReadOnly()
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: BACK })),
    )
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
    expect(mockedEdit).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-052: (b) 메시지 삭제 확인에서 LEVEL_TOO_LOW → 시트 없음, 말풍선 유지', async () => {
    mockedDelete.mockResolvedValueOnce(fail('LEVEL_TOO_LOW'))
    const onAuthFailure = vi.fn()
    render(<Harness onAuthFailure={onAuthFailure} />)
    await screen.findByRole('log')
    const user = userEvent.setup()
    await user.click(actionAt(1, '삭제')) // S3e: 진입 = 버튼 줄 「삭제」
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '삭제' }))

    await screen.findByRole('note')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(within(screen.getByRole('log')).getAllByRole('listitem')).toHaveLength(2)
    expectReadOnly()
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: BACK })),
    ) // TK-07
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
    expect(mockedDelete).toHaveBeenCalledTimes(1)
  })
})

describe('S3e 인증 실패 전환 — 버튼 줄 미렌더, App 통합 (R-CHAT-008 · R-CHAT-011)', () => {
  const enterRoom = async () => {
    initToken('?t=test-token')
    render(<App />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /^티타임, 마지막 갱신/ }))
    await screen.findByRole('log')
    return user
  }

  it('TC-CH-120: (App) 재작성이 TOKEN_INVALID → 같은 커밋에서 버튼 줄 전부 없음, 열람 안내, 전환 토스트 1개, ‹ 포커스, 토큰 비움', async () => {
    vi.mocked(listMessages).mockResolvedValue(
      ok({ messages: [M101, M103, M104_SEB], hasMore: false }),
    )
    const d = deferred<Result<Message>>()
    mockedRegenerate.mockReturnValueOnce(d.promise)
    await enterRoom()
    expect(actionGroups()).toHaveLength(3)
    fireEvent.click(actionAt(2, '재작성'))
    expect(mockedRegenerate.mock.calls).toEqual([[104]])

    await act(async () => {
      d.resolve(fail('TOKEN_INVALID'))
    })
    // 같은 커밋 — waitFor 없이 바로 본다(전환 effect 가 아니라 renderHistory 의 actions=undefined 로 사라진다, AC §9)
    expect(actionGroups()).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /대사 (수정|재작성|삭제)$/ })).toBeNull()
    expectReadOnly()
    expect(screen.getAllByRole('alert').map(a => a.textContent)).toEqual([
      '인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.',
    ])
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: BACK })),
    )
    expect(getToken()).toBeNull()
    expect(mockedRegenerate).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-120: (App) 메시지 삭제 확인에서 LEVEL_TOO_LOW → 확인 시트·버튼 줄 없음, 말풍선 유지, 토큰 비움', async () => {
    mockedDelete.mockResolvedValueOnce(fail('LEVEL_TOO_LOW'))
    const user = await enterRoom()
    await user.click(actionAt(1, '삭제'))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '삭제' }))

    await screen.findByRole('note')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(actionGroups()).toHaveLength(0)
    expect(within(screen.getByRole('log')).getAllByRole('listitem')).toHaveLength(2)
    expectReadOnly()
    expect(getToken()).toBeNull()
    expect(mockedDelete.mock.calls).toEqual([[103]])
  })
})

describe('S4 인증 실패 전환 — 장기기억 시트 닫힘, App 통합 (R-CHAT-012 · R-CHAT-008 · R-CHAT-011)', () => {
  const MEMORY: MemoryResponse = {
    summary: '시엘은 체스에서 졌다.',
    sourceUntilId: 987,
    updatedAt: new Date(2026, 9, 7, 16, 30).getTime(),
  }
  const openMemoryInApp = async () => {
    initToken('?t=test-token')
    render(<App />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /^티타임, 마지막 갱신/ }))
    await screen.findByRole('log')
    await user.click(screen.getByRole('button', { name: '방 메뉴 열기' }))
    await user.click(
      within(screen.getByRole('dialog', { name: '방 메뉴' })).getByRole('button', {
        name: '장기기억',
      }),
    )
    return { user, sheet: screen.getByRole('dialog', { name: '장기기억' }) }
  }

  it('TC-CH-134: (App) 저장이 TOKEN_INVALID → 시트 닫힘(입력 버림) · 읽기 전용 · 전환 토스트 1개 · ‹ 포커스 · 토큰 비움', async () => {
    mockedGetMemory.mockResolvedValueOnce(ok(MEMORY))
    mockedPutMemory.mockResolvedValueOnce(fail('TOKEN_INVALID'))
    const { user, sheet } = await openMemoryInApp()
    const input = await within(sheet).findByRole('textbox', { name: '장기기억 요약' })
    fireEvent.change(input, { target: { value: '고친 요약' } })
    await user.click(within(sheet).getByRole('button', { name: '저장' }))

    await screen.findByRole('note')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByDisplayValue('고친 요약')).toBeNull()
    expectReadOnly()
    const alerts = screen.getAllByRole('alert')
    expect(alerts.map(a => a.textContent)).toEqual([
      '인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.',
    ])
    expect(alerts[0]?.classList.contains('warning')).toBe(true)
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: BACK })),
    )
    expect(getToken()).toBeNull()
    expect(mockedGetMemory.mock.calls).toEqual([['r1']])
    expect(mockedPutMemory.mock.calls).toEqual([['r1', { summary: '고친 요약' }]])
  })

  it.each([
    ['LEVEL_TOO_LOW', '대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.'],
    ['TOKEN_REQUIRED', '로그인 정보가 없어 열람 전용으로 바뀌었습니다.'],
  ] as const)(
    'TC-CH-134: (App) 조회가 %s → 시트 닫힘 · 읽기 전용 · 전환 토스트 1개 · ‹ 포커스 · 토큰 비움 · putMemory 0회',
    async (code, text) => {
      // v1.0.1: 이탈로 끝나는 조회는 대기 Promise 로 준다(이미 resolve 된 mock 이면 클릭 직후 시트가 닫혀 openMemoryInApp 의 질의가 실패)
      const pending = deferred<Result<MemoryResponse>>()
      mockedGetMemory.mockReturnValueOnce(pending.promise)
      const { sheet } = await openMemoryInApp()
      expect(within(sheet).getByRole('status').textContent).toBe('장기기억을 불러오는 중')
      await act(async () => {
        pending.resolve(fail(code))
      })

      await screen.findByRole('note')
      expect(screen.queryByRole('dialog')).toBeNull()
      expectReadOnly()
      const alerts = screen.getAllByRole('alert')
      expect(alerts.map(a => a.textContent)).toEqual([text])
      expect(alerts[0]?.classList.contains('warning')).toBe(true)
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: BACK })),
      )
      expect(getToken()).toBeNull()
      expect(mockedGetMemory.mock.calls).toEqual([['r1']])
      expect(mockedPutMemory).not.toHaveBeenCalled()
    },
  )
})

describe('늦은 쓰기 응답 무시 (R-CHAT-006 · R-CHAT-007 · R-CHAT-001)', () => {
  const setup = async () => {
    const onBack = vi.fn()
    const onAuthFailure = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const view = render(
      <ChatScreen
        room={ROOM}
        viewer={WRITER_VIEWER}
        onBack={onBack}
        onAuthFailure={onAuthFailure}
        onRoomRenamed={vi.fn()}
      />,
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
    await user.click(actionAt(1, '수정')) // S3e: 진입 = 버튼 줄 「수정」
    fireEvent.change(screen.getByRole('textbox', { name: '수정할 내용' }), {
      target: { value: '새 본문' },
    })
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
    await user.click(actionAt(1, '삭제')) // S3e: 진입 = 버튼 줄 「삭제」
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
