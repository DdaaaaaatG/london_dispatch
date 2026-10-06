/**
 * chat S3 AI 발화(speak) 통합 스펙 초안(TDD Red) — 단일 소스 ui/src/chat/test/scenarios.md
 * (TC-CH-066 ~ 078 · 087(speak) · 089 · 090 · 093 · 094)
 * 대상: ChatScreen(S3) · Composer(S3 props) · SpeakButtons · PendingBubble · MessageList(pending) ·
 *       useMessageWrites.speakAs(F-CH-31) · retrySpeak(F-CH-32) · onRoomGone(F-CH-33) · useAutoScroll tailKey(F-CH-40)
 * - 토큰은 viewer props(화면 단위) 또는 initToken(App 통합)으로만 준다. localStorage 에 토큰을 넣지 않는다.
 * - api 래퍼는 vi.mock('@/api/messages'·'@/api/rooms') — 화면은 '@/api' 재노출을 import 하므로 같은 mock 이 걸린다.
 *   speak·regenerate 를 mock 목록에 더한다. fetch 모킹 금지. isAuthFailure 는 실물.
 * - 생성 대기 = resolve 하지 않은 Promise(deferred) 를 만든 뒤 act 안에서 직접 resolve. 화면 타이머가 없으므로
 *   가짜 시계는 롱프레스(TC-CH-069)·80초 경과(TC-CH-070) 확인에만 쓴다. 가짜 시계 구간에서는 findBy/waitFor 금지.
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ERROR_MESSAGES } from '@shared/errors'
import type { Message, MessagesPage, RoomSummary } from '@shared/types'
import type { ApiErrorCode, Result } from '@/api'
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
import { READ_ONLY_VIEWER, type Viewer, WRITER_VIEWER } from '@/state/viewer'

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
const allMocks = [
  mockedList,
  mockedAppend,
  mockedEdit,
  mockedDelete,
  mockedSpeak,
  mockedRegenerate,
  vi.mocked(listRooms),
  vi.mocked(createRoom),
  vi.mocked(renameRoom),
  vi.mocked(deleteRoom),
]

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
    msg({ id: 101, speaker: 'ciel', text: '세바스찬, 홍차.', authorName: null }),
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
const EMPTY: MessagesPage = { messages: [], hasMore: false }
const SEB_REPLY = msg({
  id: 105,
  speaker: 'sebastian',
  text: '분부대로 하겠습니다, 도련님.',
  authorName: null,
  createdAt: at(16, 44),
})
const CIEL_REPLY = msg({
  id: 105,
  speaker: 'ciel',
  text: '오늘 저녁은 조용히 보내고 싶군.',
  authorName: null,
  createdAt: at(16, 44),
})
const SENT = msg({ id: 106, text: '안녕', createdAt: at(16, 45) })
const SERVER_RAW = 'SERVER-RAW-MESSAGE'
const NOTICE = '열람 전용 - 대화 참여는 등급 회원만'
const BACK = '방 목록으로 돌아가기'
const SEB = '세바스찬 대사 생성'
const CIEL = '시엘 대사 생성'
const AUTH_TEXT = {
  LEVEL_TOO_LOW: '대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.',
  TOKEN_INVALID: '인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.',
  TOKEN_REQUIRED: '로그인 정보가 없어 열람 전용으로 바뀌었습니다.',
} as const

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
const flushPending = async () => {
  await act(async () => {})
}

const renderChat = (viewer: Viewer = WRITER_VIEWER) => {
  const onBack = vi.fn()
  const onAuthFailure = vi.fn()
  const view = render(
    <ChatScreen
      room={ROOM}
      viewer={viewer}
      onBack={onBack}
      onAuthFailure={onAuthFailure}
      onRoomRenamed={vi.fn()}
    />,
  )
  return { ...view, onBack, onAuthFailure }
}
/** App 의 전환을 흉내 내는 하네스: onAuthFailure 가 spy 호출 + READ_ONLY_VIEWER 로 바꾼다 */
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

const group = () => screen.getByRole('group', { name: '메시지 작성' })
const btn = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const input = () => screen.getByRole('textbox', { name: '메시지 입력' }) as HTMLTextAreaElement
const items = () => within(screen.getByRole('log')).getAllByRole('listitem')
const lastItem = () => items()[items().length - 1] as HTMLElement
const pendings = () => document.querySelectorAll('.pending')
const bubbleOf = (id: number) =>
  items()[PAGE.messages.findIndex(m => m.id === id)]?.querySelector(
    '[aria-haspopup="dialog"]',
  ) as HTMLElement
/** 생성 대기를 하나 걸고 버튼을 누른다(같은 커밋에서 임시 말풍선) */
const startSpeak = (name: string = SEB) => {
  const d = deferred<Result<Message>>()
  mockedSpeak.mockReturnValueOnce(d.promise)
  fireEvent.click(btn(name))
  return d
}
/** 한 번 실패시켜 실패 말풍선을 만든다 */
const failOnce = async (name: string, code: ApiErrorCode = 'LLM_FAILED') => {
  const d = startSpeak(name)
  await act(async () => {
    d.resolve(fail(code))
  })
}

// ── 스크롤 mock(S1 ChatScroll 규칙: 비클램프, clientHeight 493) ─────────────
// 내용 높이 = 2200 + 메시지 li × 200 + 임시·실패 li × 100. 4건 = 3000, 임시 추가 = 3100, 성공 교체(5건) = 3200
const scrollTops = new WeakMap<Element, number>()
const installScrollMock = () => {
  const isLog = (el: Element) => el.getAttribute('role') === 'log'
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      if (!isLog(this)) return 0
      const lis = [...this.querySelectorAll('li')]
      const pend = lis.filter(li => li.querySelector('.pending') !== null).length
      return 2200 + (lis.length - pend) * 200 + pend * 100
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
  for (const m of allMocks) m.mockReset()
  mockedList.mockResolvedValue(ok(PAGE))
  vi.mocked(listRooms).mockResolvedValue(ok([ROOM]))
  // S3d(Q-08): 전송 저장 201 뒤 speak('auto') 기본값 = 영원히 대기. 각 TC 의 mockReturnValueOnce 가 먼저 쓰인다
  mockedSpeak.mockImplementation(() => new Promise<Result<Message>>(() => {}))
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
  vi.useRealTimers()
  clearToken()
  for (const key of ['scrollHeight', 'clientHeight', 'scrollTop'])
    Reflect.deleteProperty(HTMLElement.prototype, key)
})

describe('캐릭터 버튼 렌더 쌍 (R-CHAT-004 · R-CHAT-013 · R-CHAT-008)', () => {
  it('TC-CH-066: 토큰 있음 — group 1행에 세바스찬 → 시엘 버튼, 그 뒤 OOC switch. ⋯·입력·전송 있음, note 없음', async () => {
    renderChat()
    await screen.findByRole('log')
    const g = group()
    const seb = within(g).getByRole('button', { name: SEB })
    const ciel = within(g).getByRole('button', { name: CIEL })
    const toggle = within(g).getByRole('switch', { name: 'OOC 지시 모드' })
    expect(seb.textContent).toBe('세바스찬')
    expect(ciel.textContent).toBe('시엘')
    expect(seb.compareDocumentPosition(ciel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ciel.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(g).getByRole('textbox', { name: '메시지 입력' })).not.toBeNull()
    expect(within(g).getByRole('button', { name: '전송' })).not.toBeNull()
    expect(btn('방 메뉴 열기')).not.toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    await flushPending()
    expect(mockedList.mock.calls).toEqual([['r1']])
    expect(mockedSpeak).not.toHaveBeenCalled()
  })

  it('TC-CH-067: 토큰 없음 — 캐릭터 버튼(정규식 질의)·임시/실패 말풍선 DOM 없음, speak 0회', async () => {
    renderChat(READ_ONLY_VIEWER)
    await screen.findByRole('log')
    expect(screen.queryByRole('button', { name: /세바스찬|시엘/ })).toBeNull()
    expect(screen.getAllByText('세바스찬').length).toBeGreaterThan(0) // 말풍선 이름 글자는 button 이 아니다
    expect(pendings()).toHaveLength(0)
    expect(screen.getByRole('note').textContent).toBe(NOTICE)
    await flushPending()
    expect(mockedSpeak).not.toHaveBeenCalled()
    expect(mockedRegenerate).not.toHaveBeenCalled()
  })
})

describe('speak 호출 (R-CHAT-005 · R-MSG-003)', () => {
  it.each([
    [SEB, 'sebastian'],
    [CIEL, 'ciel'],
  ] as const)(
    'TC-CH-068: %s 클릭 → speak("r1", { character: "%s" }) 1회, 다른 쓰기 래퍼 0회',
    async (name, character) => {
      renderChat()
      await screen.findByRole('log')
      startSpeak(name)
      await flushPending()
      expect(mockedSpeak.mock.calls).toEqual([['r1', { character }]])
      expect(mockedSpeak.mock.calls[0]).toHaveLength(2)
      expect(Object.keys(mockedSpeak.mock.calls[0]?.[1] ?? {})).toEqual(['character'])
      for (const m of [mockedAppend, mockedRegenerate, mockedEdit, mockedDelete])
        expect(m).not.toHaveBeenCalled()
    },
  )
})

describe('생성 중 임시 말풍선·잠금 (R-CHAT-005 · R-CHAT-002 · R-CHAT-004)', () => {
  it.each([
    [SEB, 'sebastian', 'ciel', '세바스찬'],
    [CIEL, 'ciel', 'sebastian', '시엘'],
  ] as const)(
    'TC-CH-069: %s 대기 중 목록 끝 li = pending+character+%s, role=status 문구, 시각 없음',
    async (name, key, other, short) => {
      renderChat()
      await screen.findByRole('log')
      startSpeak(name)
      const root = lastItem().firstElementChild as HTMLElement
      expect(items()).toHaveLength(5)
      for (const c of ['pending', 'character', key]) expect(root.classList.contains(c)).toBe(true)
      expect(root.classList.contains(other)).toBe(false)
      expect(root.querySelector('img')?.getAttribute('alt')).toBe('')
      expect(root.querySelector('.name')?.textContent).toBe(short)
      expect(root.querySelector('time')).toBeNull()
      expect(within(root).getByText('…').getAttribute('aria-hidden')).toBe('true')
      expect(within(screen.getByRole('log')).getByRole('status').textContent).toContain(
        `${short} 대사를 만드는 중`,
      )
      for (const k of ['avatar', 'content', 'head', 'name', 'body'])
        expect(root.querySelector(`.${k}`)).not.toBeNull()
      expect(root.getAttribute('tabindex')).toBeNull()
      expect(fireEvent.contextMenu(root)).toBe(true)
      expect(screen.queryByRole('dialog')).toBeNull()
    },
  )

  it('TC-CH-069: 임시 말풍선 500ms 누름 → dialog 없음', async () => {
    renderChat()
    await screen.findByRole('log')
    startSpeak(SEB)
    const root = lastItem().firstElementChild as HTMLElement
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.pointer({ keys: '[MouseLeft>]', target: root })
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('TC-CH-070: 대기 중 두 버튼·전송·⋯ disabled, 입력은 타이핑 가능(readOnly 아님), 메뉴 안 열림, 연타 1회, 80초 뒤에도 그대로', async () => {
    renderChat()
    await screen.findByRole('log')
    const d = deferred<Result<Message>>()
    mockedSpeak.mockReturnValue(d.promise)
    act(() => {
      fireEvent.click(btn(SEB))
      fireEvent.click(btn(SEB))
      fireEvent.click(btn(CIEL))
    })
    expect(btn(SEB).disabled).toBe(true)
    expect(btn(CIEL).disabled).toBe(true)
    fireEvent.change(input(), { target: { value: '안녕' } })
    expect(input().value).toBe('안녕')
    expect(input().readOnly).toBe(false)
    expect(btn('전송').disabled).toBe(true)
    expect(btn('방 메뉴 열기').disabled).toBe(true)
    fireEvent.contextMenu(bubbleOf(103))
    expect(screen.queryByRole('dialog')).toBeNull()

    vi.useFakeTimers()
    act(() => vi.advanceTimersByTime(80_000))
    expect(pendings()).toHaveLength(1)
    expect(btn(SEB).disabled).toBe(true)
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
    expect(mockedAppend).not.toHaveBeenCalled()
  })

  it('TC-CH-071: 201 시엘 응답 → 임시 말풍선이 결과 말풍선으로 교체(중복 없음), 잠금 해제', async () => {
    renderChat()
    await screen.findByRole('log')
    const d = startSpeak(CIEL)
    fireEvent.change(input(), { target: { value: '안녕' } })
    await act(async () => {
      d.resolve(ok(CIEL_REPLY))
    })
    expect(pendings()).toHaveLength(0)
    expect(items()).toHaveLength(5)
    const last = lastItem()
    expect(last.querySelector('.ciel')).not.toBeNull()
    expect(last.querySelector('img')?.getAttribute('src')).toBe('/embed/img/ciel.png')
    expect(last.textContent).toContain('시엘')
    expect(last.textContent).toContain('오늘 저녁은 조용히 보내고 싶군.')
    expect(btn(SEB).disabled).toBe(false)
    expect(btn(CIEL).disabled).toBe(false)
    expect(btn('전송').disabled).toBe(false)
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
    expect(mockedList).toHaveBeenCalledTimes(1)
  })
})

describe('speak 자동 스크롤 (R-CHAT-003 · R-CHAT-005)', () => {
  it('TC-CH-072: (a) 맨 아래 근처 — 임시 말풍선 등장 → 맨 아래, 성공 → 다시 맨 아래, 배지 없음', async () => {
    installScrollMock()
    renderChat()
    const log = await screen.findByRole('log')
    expect(log.scrollTop).toBe(2507)
    const d = startSpeak(SEB)
    expect(log.scrollTop).toBe(3100)
    await act(async () => {
      d.resolve(ok(SEB_REPLY))
    })
    expect(log.scrollTop).toBe(3200)
    expect(screen.queryByRole('button', { name: '새 메시지 보기, 맨 아래로 이동' })).toBeNull()
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-072: (b) 위쪽(거리 > 120) — 등장·성공 모두 scrollTop 그대로, 성공 뒤 배지 「새 메시지」', async () => {
    installScrollMock()
    renderChat()
    const log = await screen.findByRole('log')
    log.scrollTop = 1000
    fireEvent.scroll(log)
    const d = startSpeak(SEB)
    expect(log.scrollTop).toBe(1000)
    await act(async () => {
      d.resolve(ok(SEB_REPLY))
    })
    expect(log.scrollTop).toBe(1000)
    const badge = btn('새 메시지 보기, 맨 아래로 이동')
    expect(badge.textContent).toContain('새 메시지')
    expect(mockedList).toHaveBeenCalledTimes(1)
  })
})

describe('생성 실패·재시도 (R-CHAT-005 · R-CHAT-011)', () => {
  it.each(['LLM_FAILED', 'LLM_EMPTY'] as const)(
    'TC-CH-073: %s → 같은 자리 실패 말풍선 + 「재시도」, 토스트 없음 → 재시도 = 같은 캐릭터 speak 2번째 → 성공 교체',
    async code => {
      const { onAuthFailure } = renderChat()
      await screen.findByRole('log')
      await failOnce(SEB, code)
      const root = lastItem().firstElementChild as HTMLElement
      expect(items()).toHaveLength(5)
      for (const c of ['pending', 'failed', 'sebastian'])
        expect(root.classList.contains(c)).toBe(true)
      const alerts = screen.getAllByRole('alert')
      expect(alerts).toHaveLength(1) // 실패 말풍선의 문구 하나 — E 토스트 없음
      expect(root.contains(alerts[0] as Node)).toBe(true)
      expect(alerts[0]?.textContent).toContain('생성에 실패했습니다.')
      const retry = btn('세바스찬 대사 재시도')
      expect(retry.textContent).toBe('재시도')
      expect(btn(SEB).disabled).toBe(false)
      expect(btn(CIEL).disabled).toBe(false)

      const d = deferred<Result<Message>>()
      mockedSpeak.mockReturnValueOnce(d.promise)
      fireEvent.click(retry)
      expect(document.querySelectorAll('.failed')).toHaveLength(0)
      expect(pendings()).toHaveLength(1)
      expect(screen.getByRole('status').textContent).toContain('세바스찬 대사를 만드는 중')
      await act(async () => {
        d.resolve(ok(SEB_REPLY))
      })
      expect(pendings()).toHaveLength(0)
      expect(lastItem().textContent).toContain('분부대로 하겠습니다, 도련님.')
      expect(mockedSpeak.mock.calls).toEqual([
        ['r1', { character: 'sebastian' }],
        ['r1', { character: 'sebastian' }],
      ])
      expect(onAuthFailure).not.toHaveBeenCalled()
    },
  )

  it.each([
    [
      'SPEAK_IN_PROGRESS',
      undefined,
      '이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요.',
    ],
    ['RATE_LIMITED', 40, '요청이 너무 많습니다. 40초 후 다시 시도해 주세요.'],
    ['NETWORK', undefined, '서버에 연결할 수 없습니다.'],
    ['INTERNAL', undefined, ERROR_MESSAGES.INTERNAL],
    ['CONFIG_INVALID', undefined, '서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요.'],
  ] as const)(
    'TC-CH-074: %s(retryAfterSec=%s) → 실패 말풍선 문구 + 「재시도」 있음, 전환 없음',
    async (code, sec, text) => {
      const { onAuthFailure } = renderChat()
      await screen.findByRole('log')
      const d = startSpeak(CIEL)
      await act(async () => {
        d.resolve(fail(code, sec))
      })
      const alerts = screen.getAllByRole('alert')
      expect(alerts).toHaveLength(1)
      expect(alerts[0]?.textContent).toContain(text)
      expect(screen.queryByText(new RegExp(SERVER_RAW))).toBeNull()
      expect(btn('시엘 대사 재시도').disabled).toBe(false)
      expect(screen.queryByRole('note')).toBeNull()
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(mockedSpeak).toHaveBeenCalledTimes(1)
    },
  )

  it('TC-CH-075: (a) 세바스찬 실패 말풍선 → 시엘 클릭 → 세바스찬 실패 말풍선 없음, 시엘 임시 말풍선 1개', async () => {
    renderChat()
    await screen.findByRole('log')
    await failOnce(SEB)
    startSpeak(CIEL)
    expect(document.querySelectorAll('.failed')).toHaveLength(0)
    expect(pendings()).toHaveLength(1)
    expect((pendings()[0] as HTMLElement).classList.contains('ciel')).toBe(true)
    expect(mockedSpeak.mock.calls[1]).toEqual(['r1', { character: 'ciel' }])
  })

  it('TC-CH-075: (b) (S3d) 실패 말풍선 상태에서 유저 전송 성공 → 실패 말풍선이 사라지고 목록 끝은 중립 "…"(T35 교체)', async () => {
    mockedAppend.mockResolvedValueOnce(ok(SENT))
    renderChat()
    await screen.findByRole('log')
    await failOnce(SEB)
    fireEvent.change(input(), { target: { value: '안녕' } })
    fireEvent.click(btn('전송'))
    await waitFor(() => expect(items()).toHaveLength(6))
    expect(document.querySelectorAll('.failed')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: '세바스찬 대사 재시도' })).toBeNull()
    const root = lastItem().firstElementChild as HTMLElement
    for (const c of ['pending', 'neutral']) expect(root.classList.contains(c)).toBe(true)
    expect(root.classList.contains('sebastian')).toBe(false)
    expect((items()[4] as HTMLElement).textContent).toContain('안녕')
    expect(mockedAppend.mock.calls).toEqual([['r1', { text: '안녕', ooc: false }]])
    expect(mockedSpeak.mock.calls).toEqual([
      ['r1', { character: 'sebastian' }],
      ['r1', { character: 'auto' }],
    ])
  })

  it('TC-CH-075: (c) 실패 말풍선 → 언마운트(‹ 뒤로) → 재마운트 → pending 0개, speak 재호출 없음', async () => {
    const first = renderChat()
    await screen.findByRole('log')
    await failOnce(SEB)
    first.unmount()
    renderChat()
    await screen.findByRole('log')
    expect(pendings()).toHaveLength(0)
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
    expect(mockedList).toHaveBeenCalledTimes(2)
  })
})

describe('S3b 월 AI 비용 한도 초과 — speak (R-CHAT-011 · R-CHAT-005 · R-LLM-007)', () => {
  const BUDGET_TEXT = '이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.'
  /** 래퍼 정규화 뒤 모양: retryAfterSec 없음(api.md §3.4 — 래퍼가 버린다). status 는 ApiError 필드가 아니라 싣지 않는다 */
  const budgetFail: Result<never> = {
    ok: false,
    error: { code: 'LLM_BUDGET_EXCEEDED', message: BUDGET_TEXT },
  }

  it('TC-CH-096: LLM_BUDGET_EXCEEDED → 실패 말풍선 + 한도 문구 + 「재시도」, 토스트·숫자·카운트다운 없음, 전환 없음, 60초 뒤 자동 재시도 없음 → 「재시도」 = 같은 캐릭터 2번째 호출', async () => {
    const { onAuthFailure } = renderChat()
    await screen.findByRole('log')
    const d = startSpeak(SEB)
    await act(async () => {
      d.resolve(budgetFail)
    })
    const root = lastItem().firstElementChild as HTMLElement
    for (const c of ['pending', 'failed', 'sebastian']) expect(root.classList.contains(c)).toBe(true)
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(1) // 실패 말풍선 문구 하나 — E 토스트 없음
    expect(root.contains(alerts[0] as Node)).toBe(true)
    expect(alerts[0]?.textContent).toContain(BUDGET_TEXT)
    expect(root.textContent).not.toMatch(/\d/) // 초·날짜·카운트다운 숫자 없음
    expect(btn('세바스찬 대사 재시도').disabled).toBe(false)
    expect(within(group()).getByRole('button', { name: SEB })).toBe(btn(SEB)) // 전환 없음 — 하단 바 그대로
    expect(btn(SEB).disabled).toBe(false)
    expect(screen.queryByRole('note')).toBeNull()
    expect(onAuthFailure).not.toHaveBeenCalled()

    vi.useFakeTimers()
    act(() => vi.advanceTimersByTime(60_000))
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
    expect(root.textContent).toContain(BUDGET_TEXT) // 시간이 흘러도 문구가 바뀌지 않는다
    vi.useRealTimers()

    mockedSpeak.mockResolvedValueOnce(budgetFail)
    fireEvent.click(btn('세바스찬 대사 재시도'))
    await flushPending()
    expect(mockedSpeak.mock.calls).toEqual([
      ['r1', { character: 'sebastian' }],
      ['r1', { character: 'sebastian' }],
    ])
    expect(screen.getAllByRole('alert')[0]?.textContent).toContain(BUDGET_TEXT)
  })

  it('TC-CH-096: 같은 429 RATE_LIMITED(retryAfterSec 40)와 문구가 다르다 — code 로만 구분', async () => {
    const textAfter = async (result: Result<never>) => {
      const view = renderChat()
      await screen.findByRole('log')
      const d = startSpeak(CIEL)
      await act(async () => {
        d.resolve(result)
      })
      const text = screen.getAllByRole('alert')[0]?.textContent ?? ''
      view.unmount()
      return text
    }
    const budget = await textAfter(budgetFail)
    const rate = await textAfter(fail('RATE_LIMITED', 40))
    expect(budget).toContain(BUDGET_TEXT)
    expect(budget).not.toContain('초 후')
    expect(rate).toContain('요청이 너무 많습니다. 40초 후 다시 시도해 주세요.')
    expect(rate).not.toContain(BUDGET_TEXT)
    expect(mockedSpeak).toHaveBeenCalledTimes(2)
  })
})

describe('speak 인증 실패·방 사라짐 (R-CHAT-011 · R-CHAT-008 · R-ROOMS-004)', () => {
  it.each(['LEVEL_TOO_LOW', 'TOKEN_INVALID', 'TOKEN_REQUIRED'] as const)(
    'TC-CH-076: %s → 임시 말풍선·group 없음, note, 전환 토스트 1개, onAuthFailure 1회, ‹ 포커스',
    async code => {
      const onAuthFailure = vi.fn()
      render(<Harness onAuthFailure={onAuthFailure} />)
      await screen.findByRole('log')
      const d = startSpeak(SEB)
      await act(async () => {
        d.resolve(fail(code))
      })
      expect(pendings()).toHaveLength(0)
      expect(screen.queryByRole('group', { name: '메시지 작성' })).toBeNull()
      expect(screen.queryByRole('button', { name: /세바스찬|시엘/ })).toBeNull()
      expect(screen.getByRole('note').textContent).toBe(NOTICE)
      const alerts = screen.getAllByRole('alert')
      expect(alerts).toHaveLength(1)
      expect(alerts[0]?.textContent).toBe(AUTH_TEXT[code])
      expect(alerts[0]?.classList.contains('warning')).toBe(true)
      await waitFor(() => expect(document.activeElement).toBe(btn(BACK)))
      expect(onAuthFailure).toHaveBeenCalledTimes(1)
      expect(mockedSpeak).toHaveBeenCalledTimes(1)
    },
  )

  it('TC-CH-076: (App 통합) speak 가 LEVEL_TOO_LOW → 같은 화면 읽기 전용, 토큰 비움', async () => {
    mockedSpeak.mockResolvedValueOnce(fail('LEVEL_TOO_LOW'))
    initToken('?t=test-token')
    render(<App />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /^티타임, 마지막 갱신/ }))
    await screen.findByRole('log')
    await user.click(btn(SEB))
    await waitFor(() => expect(screen.getByRole('note').textContent).toBe(NOTICE))
    expect(pendings()).toHaveLength(0)
    expect(screen.queryByRole('group', { name: '메시지 작성' })).toBeNull()
    expect(screen.queryByRole('button', { name: /세바스찬|시엘/ })).toBeNull()
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.textContent).toBe(AUTH_TEXT.LEVEL_TOO_LOW)
    expect(alerts[0]?.classList.contains('warning')).toBe(true)
    await waitFor(() => expect(document.activeElement).toBe(btn(BACK)))
    expect(getToken()).toBeNull()
    expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'sebastian' }]])
  })

  it('TC-CH-077: NOT_FOUND(방 사라짐) → ld:lastRoomId 삭제 후 onBack 1회, 토스트 없음, 재호출 없음', async () => {
    const { onBack } = renderChat()
    let storedAtBack: string | null = 'unset'
    onBack.mockImplementation(() => {
      storedAtBack = localStorage.getItem('ld:lastRoomId')
    })
    await screen.findByRole('log')
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    const d = startSpeak(SEB)
    await act(async () => {
      d.resolve(fail('NOT_FOUND'))
    })
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(storedAtBack).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(pendings()).toHaveLength(0) // speakDiscarded — 실패 말풍선을 남기지 않는다
    await flushPending()
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
  })
})

describe('빈 방 첫 speak (R-CHAT-005 · R-CHAT-003)', () => {
  it('TC-CH-078: 빈 상태 → 세바스찬 클릭 → 빈 문구 없음·log 안 임시 말풍선 → 성공 → 말풍선 1개, 맨 아래 배치', async () => {
    installScrollMock()
    mockedList.mockResolvedValue(ok(EMPTY))
    renderChat()
    expect(await screen.findByText('아직 대화가 없습니다')).toBeTruthy()
    const d = startSpeak(SEB)
    expect(screen.queryByText('아직 대화가 없습니다')).toBeNull()
    expect(items()).toHaveLength(1)
    expect(pendings()).toHaveLength(1)
    await act(async () => {
      d.resolve(ok(SEB_REPLY))
    })
    expect(pendings()).toHaveLength(0)
    expect(items()).toHaveLength(1)
    expect(screen.getByRole('log').scrollTop).toBe(2400 - 493)
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
  })
})

describe('늦은 생성 응답 무시 — speak (R-CHAT-005)', () => {
  it.each([
    ['성공', ok(SEB_REPLY)],
    ['LLM_FAILED', fail('LLM_FAILED')],
    ['LEVEL_TOO_LOW', fail('LEVEL_TOO_LOW')],
    ['NOT_FOUND', fail('NOT_FOUND')],
  ] as const)(
    'TC-CH-087: speak 대기 중 언마운트 → %s 도착 → onAuthFailure·onBack 0회, 저장소 그대로',
    async (_label, result) => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { unmount, onAuthFailure, onBack } = renderChat()
      await screen.findByRole('log')
      const d = startSpeak(SEB)
      unmount()
      await act(async () => {
        d.resolve(result)
      })
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(onBack).not.toHaveBeenCalled()
      expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
      expect(consoleError).not.toHaveBeenCalled()
      expect(mockedSpeak).toHaveBeenCalledTimes(1)
      expect(mockedList).toHaveBeenCalledTimes(1) // 재조회 없음
    },
  )
})

describe('포커스 (R-CHAT-013 · R-CHAT-005)', () => {
  it('TC-CH-089: 세바스찬 버튼 Enter → 대기 중 포커스 잃음(blur) → 응답 → 세바스찬 버튼 포커스', async () => {
    renderChat()
    await screen.findByRole('log')
    const d = deferred<Result<Message>>()
    mockedSpeak.mockReturnValueOnce(d.promise)
    const user = userEvent.setup()
    btn(SEB).focus()
    await user.keyboard('{Enter}')
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
    act(() => btn(SEB).blur())
    await act(async () => {
      d.resolve(ok(SEB_REPLY))
    })
    expect(document.activeElement).toBe(btn(SEB))
  })

  it('TC-CH-089: 대기 중 입력창으로 포커스를 옮겼으면 응답 뒤에도 입력창', async () => {
    renderChat()
    await screen.findByRole('log')
    const d = startSpeak(SEB)
    act(() => input().focus())
    await act(async () => {
      d.resolve(ok(SEB_REPLY))
    })
    expect(document.activeElement).toBe(input())
  })

  it.each([
    ['성공', ok(CIEL_REPLY)],
    ['실패', fail('LLM_FAILED')],
  ] as const)(
    'TC-CH-093: 시엘 실패 말풍선 「재시도」 클릭 → 버튼 언마운트 → 응답(%s) → 포커스 = 시엘 대사 생성',
    async (_label, result) => {
      renderChat()
      await screen.findByRole('log')
      await failOnce(CIEL)
      const d = deferred<Result<Message>>()
      mockedSpeak.mockReturnValueOnce(d.promise)
      await userEvent.setup().click(btn('시엘 대사 재시도'))
      expect(screen.queryByRole('button', { name: '시엘 대사 재시도' })).toBeNull()
      await act(async () => {
        d.resolve(result)
      })
      expect(document.activeElement).toBe(btn(CIEL))
      expect(mockedSpeak).toHaveBeenCalledTimes(2)
    },
  )
})

describe('「재시도」·생성 잠금 (R-CHAT-005 · R-CHAT-007)', () => {
  it('TC-CH-090: (S3d) 실패 말풍선 표시 중 유저 전송 대기 → 「재시도」·캐릭터 버튼 disabled → 저장 응답 뒤에도 캐릭터 버튼 disabled(자동 응답 중), 실패 말풍선은 중립 "…"로 바뀌어 「재시도」 없음, speak 총 2회', async () => {
    renderChat()
    await screen.findByRole('log')
    await failOnce(SEB)
    const d = deferred<Result<Message>>()
    mockedAppend.mockReturnValueOnce(d.promise)
    fireEvent.change(input(), { target: { value: '안녕' } })
    fireEvent.click(btn('전송'))
    expect(btn('세바스찬 대사 재시도').disabled).toBe(true)
    expect(btn(SEB).disabled).toBe(true)
    await act(async () => {
      d.resolve(ok(SENT))
    })
    expect(screen.queryByRole('button', { name: '세바스찬 대사 재시도' })).toBeNull()
    expect(btn(SEB).disabled).toBe(true)
    expect(btn(CIEL).disabled).toBe(true)
    expect(document.querySelectorAll('.pending.neutral')).toHaveLength(1)
    expect(mockedSpeak).toHaveBeenCalledTimes(2)
    expect(mockedSpeak.mock.calls[1]).toEqual(['r1', { character: 'auto' }])
  })

  it('TC-CH-094: 인라인 수정 열림 → 캐릭터 버튼·「재시도」 disabled, 클릭해도 speak 0회 추가, 전송은 활성 → 편집 취소 → 활성', async () => {
    renderChat()
    await screen.findByRole('log')
    await failOnce(SEB)
    const user = userEvent.setup()
    fireEvent.contextMenu(bubbleOf(103))
    await user.click(
      within(screen.getByRole('dialog', { name: '메시지 메뉴' })).getByRole('button', {
        name: '수정',
      }),
    )
    const editor = screen.getByRole('group', { name: '메시지 수정' })
    expect(btn(SEB).disabled).toBe(true)
    expect(btn(CIEL).disabled).toBe(true)
    expect(btn('세바스찬 대사 재시도').disabled).toBe(true)
    fireEvent.click(btn(SEB))
    fireEvent.click(btn('세바스찬 대사 재시도'))
    fireEvent.change(input(), { target: { value: '안녕' } })
    expect(btn('전송').disabled).toBe(false)

    await user.click(within(editor).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()
    expect(btn(SEB).disabled).toBe(false)
    expect(btn('세바스찬 대사 재시도').disabled).toBe(false)
    await flushPending()
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
    expect(mockedEdit).not.toHaveBeenCalled()
  })
})
