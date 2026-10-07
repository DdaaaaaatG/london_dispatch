/**
 * chat S3 재작성(regenerate) 스펙 — 단일 소스 ui/src/chat/test/scenarios.md v0.9
 * (TC-CH-080 ~ 084 · TC-CH-086 writeErrorText(regenerate) · TC-CH-087(regenerate) · TC-CH-095 · TC-CH-097)
 * S3e 개정(actions.md v2.0 AC §11.2): 진입 = 말풍선 아래 「재작성」 버튼(옛 메뉴 → 재작성). 포커스 = 같은 「재작성」(F-CH-51).
 *   재작성 실패 문구 "…재작성을 다시 눌러 주세요."(D-30). 표시 조건 TC-CH-079 는 TC-CH-111(MessageActions.test.tsx)로 대체.
 * 대상: BubbleActions(canRegenerate) · regenerateFromActions(F-CH-48) · useMessageWrites.regenerateMessage(F-CH-34) ·
 *       Bubble isRegenerating · labels.writeErrorText(…, 'regenerate')
 * - api 래퍼는 vi.mock('@/api/messages'·'@/api/rooms'). regenerate 인자는 messageId 하나(본문 없음).
 * - 「재작성」 누름 = 포커스를 비운 뒤 fireEvent.click(브라우저에서 disabled 된 버튼이 포커스를 잃는 상태, jsdom DC-05).
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ERROR_MESSAGES } from '@shared/errors'
import type { Message, MessagesPage, RoomSummary } from '@shared/types'
import type { ApiError, ApiErrorCode, Result } from '@/api'
import {
  appendUser,
  deleteMessage,
  editMessage,
  listMessages,
  regenerate,
  speak,
} from '@/api/messages'
import { ChatScreen } from '@/chat'
import { writeErrorText } from '@/chat/labels'
import { READ_ONLY_VIEWER, WRITER_VIEWER } from '@/state/viewer'

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

const mockedList = vi.mocked(listMessages)
const mockedAppend = vi.mocked(appendUser)
const mockedEdit = vi.mocked(editMessage)
const mockedDelete = vi.mocked(deleteMessage)
const mockedSpeak = vi.mocked(speak)
const mockedRegenerate = vi.mocked(regenerate)

const ROOM: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 5, 9, 0).getTime(),
  updatedAt: new Date(2026, 9, 7, 18, 0).getTime(),
  messageCount: 3,
}
const at = (h: number, m: number): number => new Date(2026, 9, 5, h, m).getTime()
const msg = (over: Partial<Message> & Pick<Message, 'id'>): Message => ({
  roomId: 'r1',
  speaker: 'user',
  kind: 'line',
  text: '',
  authorName: '미샤',
  createdAt: at(16, 40),
  ...over,
})
const M70 = msg({ id: 70, speaker: 'ciel', text: '세바스찬, 홍차.', authorName: null })
const M71 = msg({ id: 71, kind: 'ooc', text: '둘이 체스를 둔다.', createdAt: at(16, 41) })
const M72 = msg({
  id: 72,
  speaker: 'sebastian',
  text: '분부대로 하겠습니다, 도련님.',
  authorName: null,
  createdAt: at(16, 42),
})
const M72_NEW: Message = { ...M72, text: '물론입니다. 오늘 일정부터 말씀드리지요.' }
const M73_USER = msg({ id: 73, text: '나도 한 잔.', createdAt: at(16, 43) })
/** 마지막 = 세바스찬 line(재작성 대상) */
const PAGE: MessagesPage = { messages: [M70, M71, M72], hasMore: false }
const SERVER_RAW = 'SERVER-RAW-MESSAGE'
const NOTICE = '열람 전용 - 대화 참여는 등급 회원만'
const AUTH_TEXT = {
  LEVEL_TOO_LOW: '대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.',
  TOKEN_INVALID: '인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.',
  TOKEN_REQUIRED: '로그인 정보가 없어 열람 전용으로 바뀌었습니다.',
} as const
/** S3e 개정(D-30 · AC §8): 이전 "…메뉴에서 다시 시도해 주세요." */
const REGEN_FAILED = '대사를 다시 만들지 못했습니다. 재작성을 다시 눌러 주세요.'
const NOT_LAST = '다른 메시지가 먼저 이어져 재작성할 수 없습니다. 대화를 새로 불러옵니다.'
const MSG_NOT_FOUND = '메시지를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const err = (code: ApiErrorCode, retryAfterSec?: number): ApiError =>
  retryAfterSec === undefined
    ? { code, message: SERVER_RAW }
    : { code, message: SERVER_RAW, retryAfterSec }
const fail = (code: ApiErrorCode, retryAfterSec?: number): Result<never> => ({
  ok: false,
  error: err(code, retryAfterSec),
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

const renderChat = () => {
  const onBack = vi.fn()
  const onAuthFailure = vi.fn()
  const view = render(
    <ChatScreen
      room={ROOM}
      viewer={WRITER_VIEWER}
      onBack={onBack}
      onAuthFailure={onAuthFailure}
      onRoomRenamed={vi.fn()}
    />,
  )
  return { ...view, onBack, onAuthFailure }
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
const items = () => within(screen.getByRole('log')).getAllByRole('listitem')
const textOf = (id: number): string =>
  [M70, M71, M72, M73_USER].find(m => m.id === id)?.text ?? `#${id}`
const itemOf = (id: number) =>
  items().find(li => li.textContent?.includes(textOf(id))) as HTMLElement
/** Bubble 루트(모듈 클래스 root) */
const rootOf = (id: number) => itemOf(id).querySelector('.root') as HTMLElement
/** 그 말풍선의 버튼 줄(S3e AC §1) */
const groupIn = (id: number) =>
  within(itemOf(id)).getByRole('group', { name: /말풍선 작업$/ })
const regenBtn = (id = 72) =>
  within(groupIn(id)).getByRole('button', { name: /대사 재작성$/ }) as HTMLButtonElement
const actionGroups = () => screen.queryAllByRole('group', { name: /말풍선 작업$/ })
const startRegenerate = (id = 72) => {
  const d = deferred<Result<Message>>()
  mockedRegenerate.mockReturnValueOnce(d.promise)
  ;(document.activeElement as HTMLElement | null)?.blur()
  fireEvent.click(regenBtn(id))
  return d
}
const alertTexts = () => screen.queryAllByRole('alert').map(a => a.textContent)
const toastOf = (text: string) =>
  screen.getAllByRole('alert').find(a => a.textContent === text) as HTMLElement
const btn = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

// 스크롤 mock(S2 TC-CH-046(c) 규칙): log 3000/493 → 첫 배치 scrollTop 2507(맨 위 아님)
// → hasMore=true 첫 페이지에서도 첫 배치 자동 이전 로드(before=…)가 일어나지 않는다(CF-02)
const scrollTops = new WeakMap<Element, number>()
const installScrollMock = () => {
  const isLog = (el: Element) => el.getAttribute('role') === 'log'
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isLog(this) ? 3000 : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isLog(this) ? 493 : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get(this: HTMLElement) {
      return scrollTops.get(this) ?? 0
    },
    set(this: HTMLElement, v: number) {
      scrollTops.set(this, v)
    },
  })
}

beforeEach(() => {
  for (const m of [
    mockedList,
    mockedAppend,
    mockedEdit,
    mockedDelete,
    mockedSpeak,
    mockedRegenerate,
  ])
    m.mockReset()
  mockedList.mockResolvedValue(ok(PAGE))
  localStorage.clear()
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
  vi.useRealTimers()
  for (const key of ['scrollHeight', 'clientHeight', 'scrollTop'])
    Reflect.deleteProperty(HTMLElement.prototype, key)
})

describe('재작성 실행·진행·성공 (R-CHAT-007 · R-CHAT-005)', () => {
  it('TC-CH-080: 「재작성」 → confirm 없이 regenerate(72) 1회 → 진행 표시·잠금(버튼 줄 포함) → 200 → 같은 자리 교체, 포커스 = 같은 「재작성」', async () => {
    renderChat()
    await screen.findByRole('log')
    fireEvent.change(screen.getByRole('textbox', { name: '메시지 입력' }), {
      target: { value: '안녕' },
    })
    const d = startRegenerate(72)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mockedRegenerate.mock.calls).toEqual([[72]])

    const root = rootOf(72)
    expect(root.classList.contains('regenerating')).toBe(true)
    const body = root.querySelector('.body') as HTMLElement
    expect(body.getAttribute('aria-busy')).toBe('true')
    expect(body.textContent).toContain('분부대로 하겠습니다, 도련님.')
    expect(within(root).getByRole('status').textContent).toBe('다시 쓰는 중…')
    for (const name of ['세바스찬 대사 생성', '시엘 대사 생성', '전송', '방 메뉴 열기'])
      expect(btn(name).disabled).toBe(true)
    for (const g of actionGroups())
      for (const b of within(g).getAllByRole('button'))
        expect((b as HTMLButtonElement).disabled).toBe(true)
    const box = screen.getByRole('textbox', { name: '메시지 입력' }) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: '안녕하세요' } })
    expect(box.value).toBe('안녕하세요')
    expect(box.readOnly).toBe(false)

    await act(async () => {
      d.resolve(ok(M72_NEW))
    })
    expect(items()).toHaveLength(3)
    const after = items()[2] as HTMLElement
    expect(after.textContent).toContain('물론입니다. 오늘 일정부터 말씀드리지요.')
    expect(after.textContent).not.toContain('분부대로 하겠습니다, 도련님.')
    expect(after.querySelector('.regenerating')).toBeNull()
    expect(within(after.querySelector('.root') as HTMLElement).queryByRole('status')).toBeNull()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(after).getByRole('button', { name: '세바스찬 대사 재작성' }),
      ),
    )
    expect(btn('세바스찬 대사 생성').disabled).toBe(false)
    expect(mockedRegenerate).toHaveBeenCalledTimes(1)
    expect(mockedSpeak).not.toHaveBeenCalled()
    expect(mockedEdit).not.toHaveBeenCalled()
  })
})

describe('재작성 실패 (R-CHAT-007 · R-CHAT-011)', () => {
  it.each([
    ['LLM_FAILED', undefined, REGEN_FAILED, 'danger'],
    ['LLM_EMPTY', undefined, REGEN_FAILED, 'danger'],
    ['SPEAK_IN_PROGRESS', undefined, ERROR_MESSAGES.SPEAK_IN_PROGRESS, 'danger'],
    ['CONFIG_INVALID', undefined, ERROR_MESSAGES.CONFIG_INVALID, 'danger'],
    ['NOT_CHARACTER_MESSAGE', undefined, ERROR_MESSAGES.NOT_CHARACTER_MESSAGE, 'danger'],
    ['RATE_LIMITED', 40, '요청이 너무 많습니다. 40초 후 다시 시도해 주세요.', 'warning'],
  ] as const)(
    'TC-CH-081: %s(retryAfterSec=%s) → 원 본문 그대로, 토스트 문구·톤 %s, 재시도 버튼 없음, 「재작성」 다시 누를 수 있음·포커스',
    async (code, sec, text, tone) => {
      const { onAuthFailure } = renderChat()
      await screen.findByRole('log')
      const d = startRegenerate(72)
      await act(async () => {
        d.resolve(fail(code, sec))
      })
      expect(rootOf(72).textContent).toContain('분부대로 하겠습니다, 도련님.')
      expect(rootOf(72).classList.contains('regenerating')).toBe(false)
      expect(alertTexts()).toEqual([text])
      expect(toastOf(text).classList.contains(tone)).toBe(true)
      expect(toastOf(text).classList.contains(tone === 'danger' ? 'warning' : 'danger')).toBe(false)
      expect(screen.queryByRole('button', { name: /재시도/ })).toBeNull()
      expect(screen.queryByText(new RegExp(SERVER_RAW))).toBeNull()
      expect(screen.queryByText(/메뉴에서/)).toBeNull()
      expect(onAuthFailure).not.toHaveBeenCalled()

      expect(regenBtn(72).disabled).toBe(false)
      await waitFor(() => expect(document.activeElement).toBe(regenBtn(72)))
      expect(mockedRegenerate).toHaveBeenCalledTimes(1)
    },
  )

  it('TC-CH-082: NOT_LAST_MESSAGE → 토스트 → listMessages("r1") 재조회 → loading 중 포커스 이동 없음 → ready 커밋 뒤 포커스 = log', async () => {
    const reloaded: MessagesPage = { messages: [M70, M71, M72, M73_USER], hasMore: false }
    const second = deferred<Result<MessagesPage>>()
    mockedList.mockResolvedValueOnce(ok(PAGE)).mockReturnValueOnce(second.promise)
    renderChat()
    await screen.findByRole('log')
    const d = startRegenerate(72)
    await act(async () => {
      d.resolve(fail('NOT_LAST_MESSAGE'))
    })
    // loading 커밋: log 없음, 포커스는 log 로도 ‹ 로도 가지 않는다(F-CH-41)
    expect(screen.queryByRole('log')).toBeNull()
    expect(document.activeElement).not.toBe(btn('방 목록으로 돌아가기'))
    expect(alertTexts()).toContain(NOT_LAST)
    await act(async () => {
      second.resolve(ok(reloaded))
    })
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('log')))
    expect(items()).toHaveLength(4)
    expect((items()[3] as HTMLElement).textContent).toContain('나도 한 잔.')
    expect(screen.queryAllByRole('button', { name: /대사 재작성$/ })).toHaveLength(0) // 마지막이 유저
    expect(mockedList.mock.calls).toEqual([['r1'], ['r1']])
    expect(mockedRegenerate).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-082: 재조회가 실패하면 포커스 이동 없음(‹·log 아님), regenerate 재호출 없음', async () => {
    mockedList.mockResolvedValueOnce(ok(PAGE)).mockResolvedValueOnce(fail('NETWORK'))
    renderChat()
    await screen.findByRole('log')
    const d = startRegenerate(72)
    await act(async () => {
      d.resolve(fail('NOT_LAST_MESSAGE'))
    })
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
    await flushPending()
    expect(screen.queryByRole('log')).toBeNull()
    expect(document.activeElement).not.toBe(btn('방 목록으로 돌아가기'))
    expect(mockedRegenerate).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-083: (a) NOT_FOUND, 남은 메시지 있음 → 대상·그 버튼 줄 제거·토스트, 재조회 없음, 포커스 = log', async () => {
    renderChat()
    await screen.findByRole('log')
    const d = startRegenerate(72)
    await act(async () => {
      d.resolve(fail('NOT_FOUND'))
    })
    expect(items()).toHaveLength(2)
    expect(screen.queryByText('분부대로 하겠습니다, 도련님.')).toBeNull()
    expect(screen.queryByRole('group', { name: '세바스찬 말풍선 작업' })).toBeNull()
    expect(alertTexts()).toEqual([MSG_NOT_FOUND])
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('log')))
    await flushPending()
    expect(mockedList).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-083: (b) 0건 + hasMore=true → listMessages("r1") 재호출(두 번째 인자 없음) → ready 뒤 포커스 = log', async () => {
    installScrollMock() // 첫 배치 2507 — 자동 이전 로드 없음(CF-02)
    mockedList
      .mockResolvedValueOnce(ok({ messages: [M72], hasMore: true }))
      .mockResolvedValueOnce(ok({ messages: [M70, M71], hasMore: false }))
    renderChat()
    const log = await screen.findByRole('log')
    expect(log.scrollTop).toBe(2507)
    await flushPending()
    expect(mockedList).toHaveBeenCalledTimes(1) // 자동 이전 로드 없음 전제
    const d = startRegenerate(72)
    await act(async () => {
      d.resolve(fail('NOT_FOUND'))
    })
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
    expect(mockedList.mock.calls[1]).toEqual(['r1'])
    await waitFor(() => expect(items()).toHaveLength(2))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('log')))
  })

  it('TC-CH-083: (c) 0건 + hasMore=false → 빈 상태, 재조회 없음, 포커스 = ‹ 뒤로', async () => {
    mockedList.mockResolvedValueOnce(ok({ messages: [M72], hasMore: false }))
    renderChat()
    await screen.findByRole('log')
    const d = startRegenerate(72)
    await act(async () => {
      d.resolve(fail('NOT_FOUND'))
    })
    expect(screen.queryByRole('log')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('아직 대화가 없습니다')
    await waitFor(() => expect(document.activeElement).toBe(btn('방 목록으로 돌아가기')))
    await flushPending()
    expect(mockedList).toHaveBeenCalledTimes(1)
  })

  it.each(['TOKEN_INVALID', 'LEVEL_TOO_LOW', 'TOKEN_REQUIRED'] as const)(
    'TC-CH-084: %s → 읽기 전용 전환, 버튼 줄 전부 미렌더, 대상 표시(regenerating) 없음, 원 본문, 전환 토스트',
    async code => {
      const onAuthFailure = vi.fn()
      render(<Harness onAuthFailure={onAuthFailure} />)
      await screen.findByRole('log')
      const d = startRegenerate(72)
      await act(async () => {
        d.resolve(fail(code))
      })
      expect(screen.getByRole('note').textContent).toBe(NOTICE)
      expect(screen.queryByRole('group', { name: '메시지 작성' })).toBeNull()
      expect(actionGroups()).toHaveLength(0)
      expect(screen.queryByRole('button', { name: /대사 (수정|재작성|삭제)$/ })).toBeNull()
      expect(document.querySelector('.regenerating')).toBeNull()
      expect(screen.getByText('분부대로 하겠습니다, 도련님.')).not.toBeNull()
      expect(alertTexts()).toEqual([AUTH_TEXT[code]])
      expect(toastOf(AUTH_TEXT[code]).classList.contains('warning')).toBe(true)
      expect(onAuthFailure).toHaveBeenCalledTimes(1)
      expect(mockedRegenerate).toHaveBeenCalledTimes(1)
    },
  )
})

describe('다른 쓰기 대기 중 생성 잠금 — 잠금 표 edit·delete·regenerate 행 (R-CHAT-005 · R-CHAT-007)', () => {
  const SEB = '세바스찬 대사 생성'
  const CIEL = '시엘 대사 생성'
  const RETRY = '시엘 대사 재시도'
  /** 시엘 실패 말풍선을 끝에 둔다(「재시도」가 보이게) */
  const withFailedBubble = async () => {
    mockedSpeak.mockResolvedValueOnce(fail('LLM_FAILED'))
    renderChat()
    await screen.findByRole('log')
    fireEvent.click(btn(CIEL))
    await waitFor(() => expect(screen.getByRole('button', { name: RETRY })).not.toBeNull())
  }
  const expectSpeakLocked = (locked: boolean) => {
    for (const name of [SEB, CIEL, RETRY]) expect(btn(name).disabled).toBe(locked)
  }

  it('TC-CH-095: (a) 수정 저장 대기 중 → 캐릭터 버튼 2·「재시도」 disabled → 응답 뒤 활성', async () => {
    await withFailedBubble()
    const save = deferred<Result<Message>>()
    mockedEdit.mockReturnValueOnce(save.promise)
    const user = userEvent.setup()
    await user.click(within(groupIn(72)).getByRole('button', { name: '세바스찬 대사 수정' }))
    const editor = screen.getByRole('group', { name: '메시지 수정' })
    fireEvent.change(within(editor).getByRole('textbox', { name: '수정할 내용' }), {
      target: { value: '고친 대사' },
    })
    await user.click(within(editor).getByRole('button', { name: '저장' }))
    expectSpeakLocked(true)
    fireEvent.click(btn(RETRY))
    await act(async () => {
      save.resolve(ok({ ...M72, text: '고친 대사' }))
    })
    expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()
    expectSpeakLocked(false)
    expect(mockedEdit.mock.calls).toEqual([[72, { text: '고친 대사' }]])
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-095: (b) 메시지 삭제 대기 중 → 캐릭터 버튼 2·「재시도」 disabled → 응답 뒤 활성', async () => {
    await withFailedBubble()
    const del = deferred<Result<undefined>>()
    mockedDelete.mockReturnValueOnce(del.promise)
    const user = userEvent.setup()
    await user.click(within(groupIn(71)).getByRole('button', { name: '[지시] 대사 삭제' }))
    const confirm = screen.getByRole('alertdialog', { name: '이 메시지를 삭제할까요?' })
    await user.click(within(confirm).getByRole('button', { name: '삭제' }))
    expectSpeakLocked(true)
    await act(async () => {
      del.resolve(ok(undefined))
    })
    expectSpeakLocked(false)
    expect(mockedDelete.mock.calls).toEqual([[71]])
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-095: (c) 재작성 대기 중 → 캐릭터 버튼 2·「재시도」 disabled → 응답 뒤 활성', async () => {
    await withFailedBubble()
    const d = startRegenerate(72)
    expectSpeakLocked(true)
    fireEvent.click(btn(SEB))
    await act(async () => {
      d.resolve(ok(M72_NEW))
    })
    expectSpeakLocked(false)
    expect(mockedRegenerate.mock.calls).toEqual([[72]])
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
  })
})

describe('S3b 월 AI 비용 한도 초과 — regenerate (R-CHAT-011 · R-CHAT-007 · R-LLM-007)', () => {
  const BUDGET_TEXT = '이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.'

  it('TC-CH-097: LLM_BUDGET_EXCEEDED → 원 본문 유지·재작성 표시 사라짐, warning 토스트, 재조회·전환·자동 재시도 없음', async () => {
    const { onAuthFailure } = renderChat()
    await screen.findByRole('log')
    const d = startRegenerate(72)
    await act(async () => {
      d.resolve({ ok: false, error: { code: 'LLM_BUDGET_EXCEEDED', message: BUDGET_TEXT } })
    })
    expect(rootOf(72).textContent).toContain('분부대로 하겠습니다, 도련님.')
    expect(rootOf(72).classList.contains('regenerating')).toBe(false)
    expect(alertTexts()).toEqual([BUDGET_TEXT])
    expect(toastOf(BUDGET_TEXT).classList.contains('warning')).toBe(true)
    expect(toastOf(BUDGET_TEXT).classList.contains('danger')).toBe(false)
    expect(screen.queryByRole('button', { name: /재시도/ })).toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.getByRole('group', { name: '메시지 작성' })).not.toBeNull()
    expect(regenBtn(72).disabled).toBe(false)
    expect(onAuthFailure).not.toHaveBeenCalled()

    vi.useFakeTimers()
    act(() => vi.advanceTimersByTime(60_000))
    expect(mockedRegenerate.mock.calls).toEqual([[72]])
    expect(mockedList).toHaveBeenCalledTimes(1) // 재조회 없음
  })
})

describe('writeErrorText(…, "regenerate") (R-CHAT-011, design/generate.md §3 · S3e D-30)', () => {
  it.each([
    ['SPEAK_IN_PROGRESS', undefined, ERROR_MESSAGES.SPEAK_IN_PROGRESS],
    ['LLM_FAILED', undefined, REGEN_FAILED],
    ['LLM_EMPTY', undefined, REGEN_FAILED],
    ['CONFIG_INVALID', undefined, ERROR_MESSAGES.CONFIG_INVALID],
    ['NOT_LAST_MESSAGE', undefined, NOT_LAST],
    ['NOT_CHARACTER_MESSAGE', undefined, ERROR_MESSAGES.NOT_CHARACTER_MESSAGE],
    ['NOT_FOUND', undefined, MSG_NOT_FOUND],
    ['RATE_LIMITED', 40, '요청이 너무 많습니다. 40초 후 다시 시도해 주세요.'],
    ['RATE_LIMITED', undefined, ERROR_MESSAGES.RATE_LIMITED],
    ['NETWORK', undefined, '서버에 연결할 수 없습니다.'],
    ['INTERNAL', undefined, ERROR_MESSAGES.INTERNAL],
    ['VALIDATION_ERROR', undefined, ERROR_MESSAGES.VALIDATION_ERROR],
    // S3b TC-CH-097: 서버 message 가 아니라 code → ERROR_MESSAGES(SERVER-RAW-MESSAGE 로 확인)
    ['LLM_BUDGET_EXCEEDED', undefined, '이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.'],
    ['LEVEL_TOO_LOW', undefined, AUTH_TEXT.LEVEL_TOO_LOW],
    ['TOKEN_INVALID', undefined, AUTH_TEXT.TOKEN_INVALID],
    ['TOKEN_REQUIRED', undefined, AUTH_TEXT.TOKEN_REQUIRED],
  ] as const)(
    'TC-CH-086: writeErrorText(%s, retryAfterSec=%s, regenerate) = %s',
    (code, sec, text) => {
      expect(writeErrorText(err(code, sec), 'regenerate')).toBe(text)
    },
  )

  it.each(['LEVEL_TOO_LOW', 'TOKEN_INVALID', 'TOKEN_REQUIRED'] as const)(
    'TC-CH-086: 인증 %s 는 speak 동작에서도 같은 전환 문구',
    code => {
      expect(writeErrorText(err(code), 'speak')).toBe(AUTH_TEXT[code])
    },
  )
})

describe('늦은 생성 응답 무시 — regenerate (R-CHAT-007)', () => {
  it.each([
    ['성공', ok(M72_NEW)],
    ['LLM_FAILED', fail('LLM_FAILED')],
    ['LEVEL_TOO_LOW', fail('LEVEL_TOO_LOW')],
    ['NOT_FOUND', fail('NOT_FOUND')],
    ['NOT_LAST_MESSAGE', fail('NOT_LAST_MESSAGE')],
  ] as const)(
    'TC-CH-087: regenerate 대기 중 언마운트 → %s 도착 → 콜백·재조회 없음',
    async (_label, result) => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { unmount, onAuthFailure, onBack } = renderChat()
      await screen.findByRole('log')
      const d = startRegenerate(72)
      unmount()
      await act(async () => {
        d.resolve(result)
      })
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(onBack).not.toHaveBeenCalled()
      expect(mockedList).toHaveBeenCalledTimes(1)
      expect(consoleError).not.toHaveBeenCalled()
    },
  )
})
