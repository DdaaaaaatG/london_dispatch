/**
 * chat S2 하단 바 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md (TC-CH-031 ~ 038)
 * 대상: ChatScreen(S2) · Composer · TextArea · Toggle · useMessageWrites.send · Toast
 * - 토큰은 viewer props 로만 준다. api 래퍼는 vi.mock('@/api/messages'·'@/api/rooms'). isAuthFailure 실물. fetch 모킹 금지.
 * - jsdom 에 matchMedia 가 없어 스텁한다(TextArea 높이 ≤ 480 판정, C §1.13).
 * - 가짜 시계 구간(토스트 2초)에서는 findBy/waitFor 를 쓰지 않는다.
 * - S3d(CR-002, scenarios.md v0.8 Q-08): 저장 201 → 곧바로 speak('auto')(T35). speak 기본값 = 영원히 대기(never) 라
 *   전송 TC 의 목록 끝에 중립 "…" li 가 하나 더 생긴다(길이 5 → 6). TC-CH-088 은 폐기 → TC-CH-098(AutoReply.test.tsx).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { USER_DISPLAY_NAME } from '@shared/characters'
import { ERROR_MESSAGES } from '@shared/errors'
import type { Message, MessagesPage, RoomSummary } from '@shared/types'
import type { ApiErrorCode, Result } from '@/api'
import * as messagesApi from '@/api/messages'
import * as roomsApi from '@/api/rooms'
import { ChatScreen } from '@/chat'
import { WRITER_VIEWER } from '@/state/viewer'

vi.mock('@/api/messages', () => ({
  listMessages: vi.fn(),
  appendUser: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
  // S3: speak·regenerate 까지 열거해 호출 합계를 센다. S3d: 전송 뒤 speak('auto') 1회(TC-CH-033·034·098)
  speak: vi.fn(),
  regenerate: vi.fn(),
}))
vi.mock('@/api/rooms', () => ({
  listRooms: vi.fn(),
  createRoom: vi.fn(),
  renameRoom: vi.fn(),
  deleteRoom: vi.fn(),
}))

const mockedList = vi.mocked(messagesApi.listMessages)
const mockedAppend = vi.mocked(messagesApi.appendUser)
const mockedSpeak = vi.mocked(messagesApi.speak)
const allMocks = (): Array<[string, ReturnType<typeof vi.fn>]> =>
  [...Object.entries(messagesApi), ...Object.entries(roomsApi)].map(([name, fn]) => [
    name,
    fn as unknown as ReturnType<typeof vi.fn>,
  ])

// ── 픽스처 ─────────────────────────────────────────────
const ROOM: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 5, 9, 0).getTime(),
  updatedAt: new Date(2026, 9, 7, 18, 0).getTime(),
  messageCount: 4,
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
const PAGE: MessagesPage = {
  messages: [
    msg({
      id: 101,
      speaker: 'ciel',
      text: '세바스찬, 홍차.',
      authorName: null,
      createdAt: at(16, 40),
    }),
    msg({
      id: 102,
      speaker: 'sebastian',
      text: '예, 도련님.',
      authorName: null,
      createdAt: at(16, 41),
    }),
    msg({ id: 103, text: '나도 한 잔 부탁해요.', createdAt: at(16, 42) }),
    msg({ id: 104, kind: 'ooc', text: '둘이 체스를 둔다', createdAt: at(16, 43) }),
  ],
  hasMore: false,
}
// S3d: 서버가 유저 메시지 authorName 을 고정 명칭으로 투영한다(api.md §4.3 v0.6) — 화면은 그대로 표시
const SENT = msg({ id: 105, text: '안녕', authorName: USER_DISPLAY_NAME, createdAt: at(16, 44) })
const SENT_OOC = msg({
  id: 106,
  kind: 'ooc',
  text: '체스 두기',
  authorName: USER_DISPLAY_NAME,
  createdAt: at(16, 45),
})
const REPLY = msg({
  id: 107,
  speaker: 'sebastian',
  text: '분부대로 하겠습니다, 도련님.',
  authorName: null,
  createdAt: at(16, 46),
})
const SERVER_RAW = 'SERVER-RAW-MESSAGE'

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
/** S3d 자동 응답 기본값 — 영원히 대기(전송 TC 가 결과·실패로 넘어가지 않게, auto.md §9.1) */
const never = (): Promise<Result<Message>> => new Promise(() => {})
const flushPending = async () => {
  await act(async () => {})
}

const renderChat = () => {
  const onBack = vi.fn()
  const onAuthFailure = vi.fn()
  const onRoomRenamed = vi.fn()
  const view = render(
    <ChatScreen
      room={ROOM}
      viewer={WRITER_VIEWER}
      onBack={onBack}
      onAuthFailure={onAuthFailure}
      onRoomRenamed={onRoomRenamed}
    />,
  )
  return { ...view, onBack, onAuthFailure, onRoomRenamed }
}
const composer = () => screen.getByRole('group', { name: '메시지 작성' })
const input = () => screen.getByRole('textbox', { name: '메시지 입력' }) as HTMLTextAreaElement
const sendButton = () => screen.getByRole('button', { name: '전송' }) as HTMLButtonElement
const items = () => within(screen.getByRole('log')).getAllByRole('listitem')

// ── 스크롤 mock(TC-CH-038, S1 ChatScroll 규칙: 비클램프) ─────────────
// contentHeight = 새 말풍선이 **커밋된 뒤**의 내용 높이. 그 전(li 4개)에는 항상 3000.
// S3d: 저장 201 한 커밋에 유저 말풍선 + 중립 "…"(li 2개)가 함께 붙는다 → li 6개도 contentHeight.
// → 응답 시점(붙이기 전) isNearBottom 측정은 3000 기준이고, 뒤붙임 effect 는 3200 을 본다(TK-01).
let contentHeight = 3000
const scrollTops = new WeakMap<Element, number>()
const installScrollMock = () => {
  const isLog = (el: Element) => el.getAttribute('role') === 'log'
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      if (!isLog(this)) return 0
      return this.querySelectorAll('li').length > PAGE.messages.length ? contentHeight : 3000
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
const removeScrollMock = () => {
  for (const key of ['scrollHeight', 'clientHeight', 'scrollTop']) {
    Reflect.deleteProperty(HTMLElement.prototype, key)
  }
}

beforeEach(() => {
  for (const [, fn] of allMocks()) fn.mockReset()
  mockedList.mockResolvedValue(ok(PAGE))
  mockedSpeak.mockImplementation(never)
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
  removeScrollMock()
})

describe('ChatScreen 토큰 있음 렌더 (R-CHAT-004 · R-CHAT-008 · R-CHAT-001)', () => {
  // S3: "캐릭터 버튼 없음" 단언은 TC-CH-066(SpeakFlow.test.tsx)으로 대체됨 — 나머지 단언 유지
  it('TC-CH-031: ⋯·하단 바(OOC·입력·전송) 있음, 열람 안내 없음, 말풍선 메뉴 대상', async () => {
    const { container } = renderChat()
    await screen.findByRole('log')

    const header = container.querySelector('header') as HTMLElement
    expect(
      within(header)
        .getAllByRole('button')
        .map(b => b.getAttribute('aria-label')),
    ).toEqual(['방 목록으로 돌아가기', '방 메뉴 열기'])
    const group = composer()
    const toggle = within(group).getByRole('switch', { name: 'OOC 지시 모드' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(toggle.textContent).toBe('OOC 끔')
    expect(
      within(group).getByRole('textbox', { name: '메시지 입력' }).getAttribute('placeholder'),
    ).toBe('대사나 지시를 입력')
    expect(within(group).getByRole('button', { name: '전송' })).not.toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
    // S3e 개정(actions.md AC §11.2): 옛 "말풍선 메뉴 대상(tabindex·aria-haspopup·Shift+F10·menuEnabled)" →
    // 말풍선마다 버튼 줄 group "{이름} 말풍선 작업"(「수정」「삭제」), 말풍선 루트에는 메뉴 속성 없음
    for (const li of items()) {
      const g = within(li).getByRole('group', { name: /말풍선 작업$/ })
      expect(
        within(g)
          .getAllByRole('button')
          .map(b => b.textContent),
      ).toEqual(['수정', '삭제'])
      const root = li.querySelector('.root') as HTMLElement
      expect(root.getAttribute('tabindex')).toBeNull()
      expect(root.getAttribute('aria-haspopup')).toBeNull()
      expect(root.classList.contains('menuEnabled')).toBe(false)
    }
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    await flushPending()
    expect(mockedList.mock.calls).toEqual([['r1']])
    for (const [name, fn] of allMocks())
      if (name !== 'listMessages') expect(fn).not.toHaveBeenCalled()
  })
})

describe('Composer 전송 (R-CHAT-004 · R-CHAT-006 · R-AUTH-004)', () => {
  it('TC-CH-032: 빈·공백 disabled · 2001자 disabled + 카운터 over·aria-invalid · 2000자 enabled', async () => {
    renderChat()
    await screen.findByRole('log')
    expect(sendButton().disabled).toBe(true)
    fireEvent.change(input(), { target: { value: '   ' } })
    expect(sendButton().disabled).toBe(true)
    expect(within(composer()).queryByText(/\/2000$/)).toBeNull()

    fireEvent.change(input(), { target: { value: 'a'.repeat(2001) } })
    expect(sendButton().disabled).toBe(true)
    expect(within(composer()).getByText('2001/2000').classList.contains('over')).toBe(true)
    expect(input().getAttribute('aria-invalid')).toBe('true')

    fireEvent.change(input(), { target: { value: 'a'.repeat(2000) } })
    expect(sendButton().disabled).toBe(false)
    expect(within(composer()).queryByText('2000/2000')).toBeNull()
    expect(input().value).toHaveLength(2000)
    await flushPending()
    expect(mockedAppend).not.toHaveBeenCalled()
  })

  it('TC-CH-032: 첫 로드 대기(loading)·실패(error) 중에는 입력이 있어도 전송 disabled', async () => {
    const pending = deferred<Result<MessagesPage>>()
    mockedList.mockReturnValueOnce(pending.promise)
    renderChat()
    fireEvent.change(input(), { target: { value: '안녕' } })
    expect(sendButton().disabled).toBe(true)
    await act(async () => {
      pending.resolve(fail('NETWORK'))
    })
    expect(screen.getByRole('alert').textContent).toContain('대화를 불러오지 못했습니다')
    expect(input().value).toBe('안녕')
    expect(sendButton().disabled).toBe(true)
    await flushPending()
    expect(mockedAppend).not.toHaveBeenCalled()
  })

  it('TC-CH-033: (S3d) 안녕 전송 → appendUser(r1,{안녕,false}) 1회, 가운데 유저 말풍선(user) 「어떠한 의지」 + 끝에 중립 "…", 입력 비움·포커스, speak("r1",{auto}) 1회', async () => {
    mockedAppend.mockResolvedValueOnce(ok(SENT))
    renderChat()
    await screen.findByRole('log')
    const user = userEvent.setup()

    await user.type(input(), '안녕')
    await user.click(sendButton())

    await vi.waitFor(() => expect(items()).toHaveLength(6))
    const sent = items()[4] as HTMLElement
    expect(sent.querySelector('.user')).not.toBeNull()
    expect(sent.textContent).toContain(USER_DISPLAY_NAME)
    expect(sent.textContent).toContain('안녕')
    expect((items()[5] as HTMLElement).querySelector('.pending.neutral')).not.toBeNull()
    await vi.waitFor(() => expect(input().value).toBe(''))
    expect(document.activeElement).toBe(input())
    expect(screen.getByRole('switch').textContent).toBe('OOC 끔')
    expect(Object.keys(localStorage)).toEqual(['ld:lastRoomId'])
    await flushPending()
    expect(mockedAppend.mock.calls).toEqual([['r1', { text: '안녕', ooc: false }]])
    expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'auto' }]])
    expect(vi.mocked(messagesApi.regenerate)).not.toHaveBeenCalled()
    const others = allMocks()
      .filter(([name]) => name !== 'appendUser' && name !== 'speak')
      .reduce((sum, [, fn]) => sum + fn.mock.calls.length, 0)
    expect(others).toBe(1) // 첫 로드 listMessages 1회뿐
  })

  // TC-CH-088(전송은 AI 호출 없음) — S3d(R-CHAT-006 🔒 개정, CR-002)로 폐기. 클릭·Enter·OOC 켬 세 경로는
  // TC-CH-098(AutoReply.test.tsx: speak 'auto' 1회 · 캐릭터 값 speak 0회 · regenerate 0회)로 옮겼다.

  it('TC-CH-034: (S3d) OOC 켬 → appendUser(…, ooc: true) → 중앙 OOC 말풍선 + 끝에 중립 "…", 전송 뒤에도 OOC 켬, speak("r1",{auto}) 1회', async () => {
    mockedAppend.mockResolvedValueOnce(ok(SENT_OOC))
    renderChat()
    await screen.findByRole('log')
    const user = userEvent.setup()

    const toggle = screen.getByRole('switch', { name: 'OOC 지시 모드' })
    await user.click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(toggle.textContent).toBe('OOC 켬')
    await user.type(input(), '체스 두기')
    await user.click(sendButton())

    await vi.waitFor(() => expect(items()).toHaveLength(6))
    const sent = items()[4] as HTMLElement
    expect(sent.querySelector('.ooc')).not.toBeNull()
    expect(sent.textContent).toContain('[지시]')
    expect((items()[5] as HTMLElement).querySelector('.pending.neutral')).not.toBeNull()
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('switch').textContent).toBe('OOC 켬')
    await vi.waitFor(() => expect(input().value).toBe(''))
    expect(mockedAppend.mock.calls).toEqual([['r1', { text: '체스 두기', ooc: true }]])
    expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'auto' }]])
  })

  it('TC-CH-035: 빈 Enter·IME Enter·Shift+Enter → 호출 없음(Shift+Enter 는 줄바꿈), Enter → 전송', async () => {
    mockedAppend.mockResolvedValueOnce(ok(SENT))
    renderChat()
    await screen.findByRole('log')
    const user = userEvent.setup()
    input().focus()

    await user.keyboard('{Enter}')
    await user.type(input(), '가')
    fireEvent.keyDown(input(), { key: 'Enter', code: 'Enter', isComposing: true })
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    expect(input().value).toBe('가\n')
    await flushPending()
    expect(mockedAppend).not.toHaveBeenCalled()

    await user.keyboard('{Enter}')
    await vi.waitFor(() => expect(input().value).toBe(''))
    expect(mockedAppend.mock.calls).toEqual([['r1', { text: '가\n', ooc: false }]])
  })

  it('TC-CH-036: (S3d) 저장 대기 중 전송 disabled·입력 readOnly·aria-busy, 클릭·Enter 연타 → 1회 → 저장 응답 뒤 readOnly·aria-busy 해제, 잠금은 유지 → speak 결과 뒤 해제', async () => {
    const pending = deferred<Result<Message>>()
    const gen = deferred<Result<Message>>()
    mockedAppend.mockReturnValueOnce(pending.promise)
    mockedSpeak.mockReturnValueOnce(gen.promise)
    renderChat()
    await screen.findByRole('log')
    const user = userEvent.setup()

    await user.type(input(), '안녕')
    await user.click(sendButton())
    expect(sendButton().disabled).toBe(true)
    expect(input().readOnly).toBe(true)
    expect(composer().getAttribute('aria-busy')).toBe('true')
    await user.click(sendButton())
    input().focus()
    await user.keyboard('{Enter}{Enter}')
    await flushPending()
    expect(mockedAppend).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(ok(SENT))
    })
    expect(composer().getAttribute('aria-busy')).not.toBe('true')
    expect(input().readOnly).toBe(false)
    await vi.waitFor(() => expect(input().value).toBe(''))
    fireEvent.change(input(), { target: { value: '다음' } })
    expect(sendButton().disabled).toBe(true) // 자동 응답 중 — 잠금 유지(auto.md §4.1)
    expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'auto' }]])

    await act(async () => {
      gen.resolve(ok(REPLY))
    })
    expect(sendButton().disabled).toBe(false)
    expect(mockedAppend).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-036: 리렌더 전 같은 틱 클릭 2회 → appendUser 1회(writeInFlightRef)', async () => {
    const pending = deferred<Result<Message>>()
    mockedAppend.mockReturnValueOnce(pending.promise)
    renderChat()
    await screen.findByRole('log')
    fireEvent.change(input(), { target: { value: '안녕' } })
    act(() => {
      fireEvent.click(sendButton())
      fireEvent.click(sendButton())
    })
    await flushPending()
    expect(mockedAppend).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending.resolve(ok(SENT))
    })
  })

  it.each([
    ['INTERNAL', undefined, ERROR_MESSAGES.INTERNAL, 'danger'],
    ['RATE_LIMITED', 40, '요청이 너무 많습니다. 40초 후 다시 시도해 주세요.', 'warning'],
    ['RATE_LIMITED', undefined, ERROR_MESSAGES.RATE_LIMITED, 'warning'],
    ['NOT_FOUND', undefined, '방을 찾을 수 없습니다. 목록으로 돌아가 주세요.', 'danger'],
    ['NETWORK', undefined, '서버에 연결할 수 없습니다.', 'danger'],
    ['VALIDATION_ERROR', undefined, '메시지는 1~2000자로 입력해 주세요.', 'danger'],
  ] as const)(
    'TC-CH-037: 전송 실패 %s(retryAfterSec=%s) → E 토스트 문구·톤, 입력 유지, 2초 뒤 사라짐, 전환 없음',
    async (code, retryAfterSec, text, tone) => {
      const pending = deferred<Result<Message>>()
      mockedAppend.mockReturnValueOnce(pending.promise)
      const { onAuthFailure } = renderChat()
      await screen.findByRole('log')
      const user = userEvent.setup()
      await user.type(input(), '안녕')
      await user.click(sendButton())

      vi.useFakeTimers()
      await act(async () => {
        pending.resolve(fail(code, retryAfterSec))
      })
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toBe(text)
      expect(alert.classList.contains(tone)).toBe(true)
      expect(screen.queryByText(new RegExp(SERVER_RAW))).toBeNull()
      expect(input().value).toBe('안녕')
      expect(items()).toHaveLength(4)
      expect(screen.getByRole('button', { name: '방 메뉴 열기' })).not.toBeNull()
      expect(screen.queryByRole('note')).toBeNull()
      act(() => {
        vi.advanceTimersByTime(1999)
      })
      expect(screen.queryByRole('alert')).not.toBeNull()
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.queryByRole('alert')).toBeNull()
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(mockedAppend).toHaveBeenCalledTimes(1)
    },
  )
})

describe('전송 뒤 스크롤·배지 (R-CHAT-003 · R-CHAT-006, F-CH-08 조립)', () => {
  it('TC-CH-038: (a) 맨 아래에서 전송 성공 → (S3d 유저 + 중립 "…" 한 커밋) scrollTop = scrollHeight, 배지 없음', async () => {
    installScrollMock()
    contentHeight = 3000
    const pending = deferred<Result<Message>>()
    mockedAppend.mockReturnValueOnce(pending.promise)
    renderChat()
    const log = await screen.findByRole('log')
    expect(log.scrollTop).toBe(2507)
    fireEvent.change(input(), { target: { value: '안녕' } })
    fireEvent.click(sendButton())

    contentHeight = 3200
    await act(async () => {
      pending.resolve(ok(SENT))
    })
    expect(items()).toHaveLength(6)
    expect(log.scrollTop).toBe(3200)
    expect(screen.queryByRole('button', { name: '새 메시지 보기, 맨 아래로 이동' })).toBeNull()
    expect(mockedAppend).toHaveBeenCalledTimes(1)
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
    expect(mockedList).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-038: (b) 위쪽에서 전송 성공 → scrollTop 유지·배지 → 클릭 → 맨 아래·배지 없음', async () => {
    installScrollMock()
    contentHeight = 3000
    const pending = deferred<Result<Message>>()
    mockedAppend.mockReturnValueOnce(pending.promise)
    renderChat()
    const log = await screen.findByRole('log')
    log.scrollTop = 1000
    fireEvent.scroll(log)
    fireEvent.change(input(), { target: { value: '안녕' } })
    fireEvent.click(sendButton())

    contentHeight = 3200
    await act(async () => {
      pending.resolve(ok(SENT))
    })
    expect(items()).toHaveLength(6)
    expect(log.scrollTop).toBe(1000)
    const badge = screen.getByRole('button', { name: '새 메시지 보기, 맨 아래로 이동' })
    expect(badge.textContent).toContain('새 메시지')
    fireEvent.click(badge)
    expect(log.scrollTop).toBe(3200)
    await flushPending()
    expect(screen.queryByRole('button', { name: '새 메시지 보기, 맨 아래로 이동' })).toBeNull()
    expect(mockedAppend).toHaveBeenCalledTimes(1)
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
    expect(mockedList).toHaveBeenCalledTimes(1)
  })
})
