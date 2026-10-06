/**
 * chat 화면 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md
 * 대상: ChatScreen(ui/src/chat/index.tsx) · useChatLoader · TopBar · IconButton · StateView · ReadOnlyNotice
 * - api 래퍼는 vi.mock('@/api/messages') 로 대체한다. fetch 모킹 금지.
 * - 이 파일은 스크롤 수치를 고정하지 않는다. 그래서 픽스처는 hasMore=false(첫 배치 자동 이전 로드가 일어나지 않게).
 *   스크롤 수치가 필요한 TC 는 ChatScroll.test.tsx.
 * - vitest globals 미설정 → afterEach 에서 cleanup() 을 직접 부른다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ERROR_MESSAGES } from '@shared/errors'
import type { MessagesPage, RoomSummary } from '@shared/types'
import type { ApiErrorCode, Result } from '@/api'
import { listMessages } from '@/api/messages'
import { ChatScreen } from '@/chat'
import { READ_ONLY_VIEWER } from '@/state/viewer'

vi.mock('@/api/messages', () => ({ listMessages: vi.fn() }))

const mockedListMessages = vi.mocked(listMessages)

// ── 픽스처 ─────────────────────────────────────────────
// createdAt(10.05) 과 updatedAt(10.07) 을 다르게 둔다 → 상단 바가 createdAt 을 쓰는지 TC-CH-001 이 가른다
const ROOM: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 5, 9, 0).getTime(),
  updatedAt: new Date(2026, 9, 7, 18, 0).getTime(),
  messageCount: 4,
}
const at = (hour: number, minute: number): number => new Date(2026, 9, 5, hour, minute).getTime()
const PAGE: MessagesPage = {
  messages: [
    {
      id: 101,
      roomId: 'r1',
      speaker: 'ciel',
      kind: 'line',
      text: '세바스찬, 홍차.',
      authorName: null,
      createdAt: at(16, 40),
    },
    {
      id: 102,
      roomId: 'r1',
      speaker: 'sebastian',
      kind: 'line',
      text: '예, 도련님.',
      authorName: null,
      createdAt: at(16, 41),
    },
    {
      id: 103,
      roomId: 'r1',
      speaker: 'user',
      kind: 'line',
      text: '나도 한 잔 부탁해요.',
      authorName: '미샤',
      createdAt: at(16, 42),
    },
    {
      id: 104,
      roomId: 'r1',
      speaker: 'user',
      kind: 'ooc',
      text: '둘이 체스를 둔다',
      authorName: '미샤',
      createdAt: at(16, 43),
    },
  ],
  hasMore: false,
}
const BACK = '방 목록으로 돌아가기'
const NOTICE = '열람 전용 - 대화 참여는 등급 회원만'
const SERVER_RAW = 'SERVER-RAW-MESSAGE'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fail = (code: ApiErrorCode, message = SERVER_RAW): Result<never> => ({
  ok: false,
  error: { code, message },
})

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}

const renderChat = () => {
  const onBack = vi.fn()
  const view = render(
    <ChatScreen
      room={ROOM}
      viewer={READ_ONLY_VIEWER}
      onBack={onBack}
      onAuthFailure={vi.fn()}
      onRoomRenamed={vi.fn()}
    />,
  )
  return { ...view, onBack }
}

const blocked = () => {
  throw new DOMException('blocked', 'SecurityError')
}

beforeEach(() => {
  mockedListMessages.mockReset()
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ── 상단 바 ────────────────────────────────────────────
describe('ChatScreen 상단 바 (R-CHAT-001 ‹·제목·날짜)', () => {
  it('TC-CH-001: h1 = 방 제목, 생성일 <time> = createdAt MM.DD(updatedAt 아님), aria-label', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(PAGE))
    const { container } = renderChat()

    expect(screen.getByRole('main', { name: '대화: 티타임' })).not.toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: '티타임' })).not.toBeNull()
    const time = screen.getByLabelText('방 생성일 10.05')
    expect(time.tagName).toBe('TIME')
    expect(time.textContent).toBe('10.05')
    expect(time.getAttribute('datetime')).toBe('2026-10-05')
    const header = container.querySelector('header') as HTMLElement
    expect(header.textContent).not.toContain('10.07')

    await screen.findByRole('log')
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    expect(mockedListMessages.mock.calls[0]).toEqual(['r1'])
  })

  it('TC-CH-002: 마운트 시 ‹ 포커스, 클릭 → ld:lastRoomId 삭제 후 onBack 1회', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(PAGE))
    const { onBack } = renderChat()
    const user = userEvent.setup()
    let storedAtBack: string | null = 'unset'
    onBack.mockImplementation(() => {
      storedAtBack = localStorage.getItem('ld:lastRoomId')
    })

    const back = screen.getByRole('button', { name: BACK })
    expect(document.activeElement).toBe(back)
    await screen.findByRole('log')
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')

    await user.click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(storedAtBack).toBeNull() // onBack 시점에 이미 지워져 있다
    expect(localStorage.getItem('ld:lastRoomId')).toBeNull()
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-003: 상단 바 버튼은 ‹ 하나뿐(⋯ 메뉴 미렌더)', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(PAGE))
    const { container } = renderChat()
    await screen.findByRole('log')

    const header = container.querySelector('header') as HTMLElement
    const buttons = within(header).getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]?.getAttribute('aria-label')).toBe(BACK)
    expect(screen.queryByRole('button', { name: /메뉴|더 보기|⋯/ })).toBeNull()
    expect(READ_ONLY_VIEWER.canWrite).toBe(false)
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
  })
})

// ── 첫 로드 ────────────────────────────────────────────
describe('ChatScreen 첫 로드 (R-CHAT-002 · R-CHAT-003 · R-MSG-001)', () => {
  it('TC-CH-004: listMessages(room.id) 1회(두 번째 인자 없음), 대기 중 "대화를 불러오는 중", 응답 후 id 순 말풍선', async () => {
    const pending = deferred<Result<MessagesPage>>()
    mockedListMessages.mockReturnValueOnce(pending.promise)
    renderChat()

    expect(screen.getByRole('status').textContent).toContain('대화를 불러오는 중')
    expect(screen.queryByRole('log')).toBeNull()
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
    expect(mockedListMessages.mock.calls[0]).toEqual(['r1'])
    expect(mockedListMessages.mock.calls[0]).toHaveLength(1)

    await act(async () => {
      pending.resolve(ok(PAGE))
    })
    const log = await screen.findByRole('log')
    const items = within(log).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items[0]?.textContent).toContain('세바스찬, 홍차.')
    expect(items[3]?.textContent).toContain('둘이 체스를 둔다')
    expect(screen.queryByText('대화를 불러오는 중')).toBeNull()
  })

  it('TC-CH-005: 첫 로드 오류 → role=alert 제목·상세·「다시 시도」 → 재호출 → 성공 시 말풍선', async () => {
    mockedListMessages.mockResolvedValueOnce(fail('NETWORK'))
    const second = deferred<Result<MessagesPage>>()
    mockedListMessages.mockReturnValueOnce(second.promise)
    renderChat()
    const user = userEvent.setup()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('대화를 불러오지 못했습니다')
    expect(alert.textContent).toContain('서버에 연결할 수 없습니다.')
    expect(screen.queryByRole('log')).toBeNull()
    expect(screen.getByRole('button', { name: BACK })).not.toBeNull() // 뒤로는 언제나 동작

    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    // 재시도 직후(응답 전) 중간 상태: error → loading
    expect(screen.getByRole('status').textContent).toContain('대화를 불러오는 중')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()

    await act(async () => {
      second.resolve(ok(PAGE))
    })
    const log = await screen.findByRole('log')
    expect(within(log).getAllByRole('listitem')).toHaveLength(4)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(mockedListMessages).toHaveBeenCalledTimes(2)
    expect(mockedListMessages.mock.calls[1]).toEqual(['r1'])
  })

  it('TC-CH-006: 빈 방 → "아직 대화가 없습니다", role=log 없음, 스크롤 거리 저장 안 함', async () => {
    mockedListMessages.mockResolvedValueOnce(ok({ messages: [], hasMore: false }))
    const { unmount } = renderChat()

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('아직 대화가 없습니다'),
    )
    expect(screen.queryByRole('log')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    unmount()
    expect(localStorage.getItem('ld:scroll:r1')).toBeNull()
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['NETWORK', '서버에 연결할 수 없습니다.'],
    ['NOT_FOUND', '방을 찾을 수 없습니다. 목록으로 돌아가 주세요.'],
    ['INTERNAL', ERROR_MESSAGES.INTERNAL],
    ['VALIDATION_ERROR', ERROR_MESSAGES.VALIDATION_ERROR],
  ] as const)(
    'TC-CH-030: 오류 상세 %s → 코드별 문구, 서버 message 미표시',
    async (code, detail) => {
      mockedListMessages.mockResolvedValueOnce(fail(code))
      renderChat()

      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toContain('대화를 불러오지 못했습니다')
      expect(alert.textContent).toContain(detail)
      expect(screen.queryByText(new RegExp(SERVER_RAW))).toBeNull()
      expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
      expect(mockedListMessages).toHaveBeenCalledTimes(1)
    },
  )
})

// ── 읽기 전용 ──────────────────────────────────────────
describe('ChatScreen 읽기 전용 (R-CHAT-008 · R-CHAT-004/007 부재 쪽)', () => {
  it('TC-CH-021: 하단 바 부재 — 세바스찬·시엘 버튼·textbox·switch 가 DOM 에 없다', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(PAGE))
    renderChat()
    await screen.findByRole('log')

    // S3: 캐릭터 버튼 접근 이름이 "세바스찬 대사 생성"이라 정확 일치 질의는 무의미 → 정규식(tc.md v1.7)
    expect(screen.queryByRole('button', { name: /세바스찬|시엘/ })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('button', { name: /전송/ })).toBeNull()
    expect(
      screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent),
    ).toEqual([BACK])
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-022: 말풍선 우클릭·500ms 누름 뒤에도 dialog·menu 가 없고 우클릭 기본 동작을 막지 않는다', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(PAGE))
    renderChat()
    const log = await screen.findByRole('log')
    const bubble = within(log).getAllByRole('listitem')[0]?.firstElementChild as HTMLElement

    expect(fireEvent.contextMenu(bubble)).toBe(true) // preventDefault 되지 않음
    vi.useFakeTimers()
    fireEvent.pointerDown(bubble)
    fireEvent.mouseDown(bubble)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    fireEvent.pointerUp(bubble)
    fireEvent.mouseUp(bubble)
    vi.useRealTimers()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-023: 열람 안내 role=note 문구 일치 — 로딩·데이터·오류 상태 모두', async () => {
    const pending = deferred<Result<MessagesPage>>()
    mockedListMessages.mockReturnValueOnce(pending.promise)
    const first = renderChat()
    expect(screen.getByRole('note').textContent).toBe(NOTICE)
    await act(async () => {
      pending.resolve(ok(PAGE))
    })
    await screen.findByRole('log')
    expect(screen.getByRole('note').textContent).toBe(NOTICE)
    first.unmount()

    mockedListMessages.mockResolvedValueOnce(fail('INTERNAL'))
    renderChat()
    await screen.findByRole('alert')
    expect(screen.getByRole('note').textContent).toBe(NOTICE)
    expect(READ_ONLY_VIEWER.canWrite).toBe(false)
    expect(mockedListMessages).toHaveBeenCalledTimes(2)
  })
})

// ── 마지막 본 방 기록 ──────────────────────────────────
describe('ChatScreen 마지막 본 방 (R-ROOMS-004 · R-CHAT-010)', () => {
  it('TC-CH-024: 마운트 → ld:lastRoomId = room.id(응답 전), pagehide 만으로는 지우지 않음, ‹ 뒤로 → 삭제', async () => {
    localStorage.setItem('ld:lastRoomId', 'r0')
    const pending = deferred<Result<MessagesPage>>()
    mockedListMessages.mockReturnValueOnce(pending.promise)
    const { onBack } = renderChat()
    const user = userEvent.setup()

    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    window.dispatchEvent(new Event('pagehide'))
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')

    await user.click(screen.getByRole('button', { name: BACK }))
    expect(localStorage.getItem('ld:lastRoomId')).toBeNull()
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-024: 저장소 쓰기·삭제가 throw 해도 화면이 뜨고 ‹ 뒤로는 onBack 을 부른다', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)
    mockedListMessages.mockResolvedValueOnce(ok(PAGE))
    const { onBack } = renderChat()
    const user = userEvent.setup()

    expect(await screen.findByRole('log')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: BACK }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
  })
})

// ── 접근성 ─────────────────────────────────────────────
describe('ChatScreen 접근성 (R-CHAT-013 · a11y.md)', () => {
  it('TC-CH-027: role=log·aria-live=polite·aria-label·tabIndex=0, 버튼 레이블, 포커스 순서 ‹ → 히스토리', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(PAGE))
    renderChat()
    const user = userEvent.setup()

    const back = screen.getByRole('button', { name: BACK })
    expect(document.activeElement).toBe(back)
    expect(back.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    const log = await screen.findByRole('log', { name: '대화 기록' })
    expect(log.getAttribute('aria-live')).toBe('polite')
    expect(log.getAttribute('tabindex')).toBe('0')
    expect(log.getAttribute('aria-busy')).not.toBe('true')

    await user.tab()
    expect(document.activeElement).toBe(log)
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-027: 첫 로드 오류면 포커스 순서 ‹ → 「다시 시도」', async () => {
    mockedListMessages.mockResolvedValueOnce(fail('INTERNAL'))
    renderChat()
    const user = userEvent.setup()

    await screen.findByRole('alert')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: BACK }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '다시 시도' }))
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
  })
})

// ── 늦은 응답 ─────────────────────────────────────────
describe('ChatScreen 늦은 응답 (useChatLoader isActiveRef)', () => {
  it('TC-CH-029: 첫 로드 응답 전 언마운트 → 상태 갱신·저장·오류 로그 없음', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pending = deferred<Result<MessagesPage>>()
    mockedListMessages.mockReturnValueOnce(pending.promise)
    const { unmount } = renderChat()

    unmount()
    await act(async () => {
      pending.resolve(ok(PAGE))
      await pending.promise
    })

    expect(screen.queryByRole('log')).toBeNull()
    expect(localStorage.getItem('ld:scroll:r1')).toBeNull()
    expect(errorSpy).not.toHaveBeenCalled()
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
  })
})
