/**
 * chat 스크롤·페이지 로드 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md
 * 대상: ChatScreen + useChatLoader + useAutoScroll + MessageList(B0 InlineStatus) 조립 결과
 * - jsdom 은 레이아웃이 없다. 스크롤 박스(role="log")의 scrollHeight·clientHeight 를 프로토타입 접근자로 고정하고,
 *   scrollTop 은 요소별 값으로 기억한다(requirements.md §4 "스크롤 값은 Object.defineProperty 로 고정").
 * - 기본 수치: scrollHeight 3000 · clientHeight 493 → 맨 아래 scrollTop = 2507.
 * - 사용자의 스크롤 = scrollTop 대입 + fireEvent.scroll. 프로그램 대입만으로는 scroll 이벤트가 나지 않는다.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Message, MessagesPage, RoomSummary } from '@shared/types'
import type { ApiErrorCode, Result } from '@/api'
import { listMessages } from '@/api/messages'
import { ChatScreen } from '@/chat'
import { READ_ONLY_VIEWER } from '@/state/viewer'

vi.mock('@/api/messages', () => ({ listMessages: vi.fn() }))

const mockedListMessages = vi.mocked(listMessages)

// ── 스크롤 수치 고정 ───────────────────────────────────
const box = { scrollHeight: 3000, clientHeight: 493 }
const scrollTops = new WeakMap<Element, number>()
const isScrollBox = (el: Element): boolean => el.getAttribute('role') === 'log'

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isScrollBox(this) ? box.scrollHeight : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isScrollBox(this) ? box.clientHeight : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get(this: HTMLElement) {
      return scrollTops.get(this) ?? 0
    },
    set(this: HTMLElement, value: number) {
      scrollTops.set(this, value)
    },
  })
})

afterAll(() => {
  for (const key of ['scrollHeight', 'clientHeight', 'scrollTop']) Reflect.deleteProperty(HTMLElement.prototype, key)
})

const userScrollTo = (log: HTMLElement, top: number) => {
  log.scrollTop = top
  fireEvent.scroll(log)
}

// ── 픽스처 ─────────────────────────────────────────────
const ROOM: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 5, 9, 0).getTime(),
  updatedAt: new Date(2026, 9, 7, 18, 0).getTime(),
  messageCount: 60,
}
const msg = (id: number): Message => ({
  id,
  roomId: 'r1',
  speaker: id % 2 === 0 ? 'sebastian' : 'ciel',
  kind: 'line',
  text: `본문 ${id}`,
  authorName: null,
  createdAt: new Date(2026, 9, 5, 9, 0).getTime() + id * 60_000,
})
const makePage = (from: number, to: number, hasMore: boolean): MessagesPage => ({
  messages: Array.from({ length: to - from + 1 }, (_, i) => msg(from + i)),
  hasMore,
})
const LATEST = makePage(31, 60, true)
const OLDER = makePage(1, 30, false)
const BACK = '방 목록으로 돌아가기'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fail = (code: ApiErrorCode): Result<never> => ({ ok: false, error: { code, message: 'SERVER-RAW-MESSAGE' } })

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const renderChat = () => {
  const onBack = vi.fn()
  const view = render(<ChatScreen room={ROOM} viewer={READ_ONLY_VIEWER} onBack={onBack} />)
  return { ...view, onBack }
}

const blocked = () => {
  throw new DOMException('blocked', 'SecurityError')
}

beforeEach(() => {
  mockedListMessages.mockReset()
  localStorage.clear()
  box.scrollHeight = 3000
  box.clientHeight = 493
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ── 이전 페이지 ────────────────────────────────────────
describe('이전 페이지 로드 (R-CHAT-003 · R-MSG-001)', () => {
  it('TC-CH-011: scrollTop ≤ 80 + scroll → listMessages(room.id, { before: 첫 id }), B0 "이전 대화 불러오는 중", aria-busy=true', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(LATEST))
    const older = deferred<Result<MessagesPage>>()
    mockedListMessages.mockReturnValueOnce(older.promise)
    renderChat()

    const log = await screen.findByRole('log', { name: '대화 기록' })
    expect(log.scrollTop).toBe(2507) // 첫 배치: 저장 없음 → 맨 아래
    expect(mockedListMessages).toHaveBeenCalledTimes(1)

    userScrollTo(log, 80)
    await waitFor(() => expect(mockedListMessages).toHaveBeenCalledTimes(2))
    expect(mockedListMessages.mock.calls[1]).toEqual(['r1', { before: 31 }])
    const status = within(log).getByRole('status')
    expect(status.textContent).toContain('이전 대화 불러오는 중')
    expect(log.getAttribute('aria-busy')).toBe('true')

    await act(async () => {
      older.resolve(ok(OLDER))
    })
    await waitFor(() => expect(within(log).getAllByRole('listitem')).toHaveLength(60))
    expect(within(log).queryByRole('status')).toBeNull()
    expect(log.getAttribute('aria-busy')).not.toBe('true')
  })

  it('TC-CH-011: scrollTop 81 이면 요청하지 않는다', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(LATEST))
    renderChat()
    const log = await screen.findByRole('log')

    userScrollTo(log, 81)
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
    expect(within(log).queryByRole('status')).toBeNull()
  })

  it('TC-CH-011: 첫 배치가 맨 위 근처(내용이 상자보다 짧음)이고 hasMore 면 자동으로 1회 요청', async () => {
    box.scrollHeight = 400
    mockedListMessages.mockResolvedValueOnce(ok(makePage(51, 60, true)))
    mockedListMessages.mockReturnValueOnce(deferred<Result<MessagesPage>>().promise)
    renderChat()

    await screen.findByRole('log')
    await waitFor(() => expect(mockedListMessages).toHaveBeenCalledTimes(2))
    expect(mockedListMessages.mock.calls[1]).toEqual(['r1', { before: 51 }])
  })

  it('TC-CH-012: 앞붙임 후 scrollTop = 이전 scrollTop + Δ scrollHeight (읽던 자리 유지)', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(LATEST))
    const older = deferred<Result<MessagesPage>>()
    mockedListMessages.mockReturnValueOnce(older.promise)
    renderChat()
    const log = await screen.findByRole('log')

    userScrollTo(log, 40)
    await waitFor(() => expect(mockedListMessages).toHaveBeenCalledTimes(2))
    box.scrollHeight = 6000 // 30건이 위에 붙은 뒤의 높이
    await act(async () => {
      older.resolve(ok(OLDER))
    })

    await waitFor(() => expect(log.scrollTop).toBe(3040)) // 40 + (6000 - 3000)
    const items = within(log).getAllByRole('listitem')
    expect(items).toHaveLength(60)
    expect(items[0].textContent).toContain('본문 1')
  })

  it('TC-CH-013: 로딩 중 scroll 이벤트가 이어져도 요청은 1회', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(LATEST))
    mockedListMessages.mockReturnValueOnce(deferred<Result<MessagesPage>>().promise)
    renderChat()
    const log = await screen.findByRole('log')

    userScrollTo(log, 40)
    userScrollTo(log, 20)
    userScrollTo(log, 0)
    expect(mockedListMessages).toHaveBeenCalledTimes(2)
    expect(within(log).getAllByRole('status')).toHaveLength(1)
  })

  it('TC-CH-013: 같은 틱(리렌더 전)에 scroll 이벤트 2개 → 요청 1회', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(LATEST))
    mockedListMessages.mockReturnValueOnce(deferred<Result<MessagesPage>>().promise)
    renderChat()
    const log = await screen.findByRole('log')

    act(() => {
      log.scrollTop = 10
      log.dispatchEvent(new Event('scroll'))
      log.dispatchEvent(new Event('scroll'))
    })
    expect(mockedListMessages).toHaveBeenCalledTimes(2)
  })

  it('TC-CH-013: hasMore=false → 맨 위에 닿아도 요청 없음, B0 없음', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(makePage(31, 60, false)))
    renderChat()
    const log = await screen.findByRole('log')

    userScrollTo(log, 0)
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
    expect(within(log).queryByRole('status')).toBeNull()
    expect(within(log).queryByRole('alert')).toBeNull()
  })

  it('TC-CH-014: 이전 페이지 실패 → B0 오류 + 「다시 시도」, 스크롤로 재요청 없음, 버튼으로 재요청', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(LATEST))
    mockedListMessages.mockResolvedValueOnce(fail('INTERNAL'))
    mockedListMessages.mockResolvedValueOnce(ok(OLDER))
    renderChat()
    const user = userEvent.setup()
    const log = await screen.findByRole('log')

    userScrollTo(log, 0)
    const alert = await within(log).findByRole('alert')
    expect(alert.textContent).toContain('이전 대화를 불러오지 못했습니다')
    expect(within(log).getAllByRole('listitem')).toHaveLength(30) // 보이던 말풍선 유지
    expect(log.getAttribute('aria-busy')).not.toBe('true')

    userScrollTo(log, 10)
    userScrollTo(log, 0)
    expect(mockedListMessages).toHaveBeenCalledTimes(2)

    await user.click(within(log).getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(within(log).getAllByRole('listitem')).toHaveLength(60))
    expect(mockedListMessages).toHaveBeenCalledTimes(3)
    expect(mockedListMessages.mock.calls[2]).toEqual(['r1', { before: 31 }])
    expect(within(log).queryByRole('alert')).toBeNull()
  })

  it('TC-CH-027: B0 오류 시 포커스 순서 ‹ → 히스토리 → 「다시 시도」', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(LATEST))
    mockedListMessages.mockResolvedValueOnce(fail('NETWORK'))
    renderChat()
    const user = userEvent.setup()
    const log = await screen.findByRole('log')

    userScrollTo(log, 0)
    await within(log).findByRole('alert')
    screen.getByRole('button', { name: BACK }).focus()
    await user.tab()
    expect(document.activeElement).toBe(log)
    await user.tab()
    expect(document.activeElement).toBe(within(log).getByRole('button', { name: '다시 시도' }))
  })

  it('TC-CH-029: 이전 페이지 응답 전 언마운트 → 늦은 응답 무시, 저장된 거리는 언마운트 시점 값', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockedListMessages.mockResolvedValueOnce(ok(LATEST))
    const older = deferred<Result<MessagesPage>>()
    mockedListMessages.mockReturnValueOnce(older.promise)
    const { unmount } = renderChat()
    const log = await screen.findByRole('log')

    userScrollTo(log, 40)
    await waitFor(() => expect(mockedListMessages).toHaveBeenCalledTimes(2))
    unmount()
    expect(localStorage.getItem('ld:scroll:r1')).toBe('2467') // 3000 - 40 - 493
    await act(async () => {
      older.resolve(ok(OLDER))
      await older.promise
    })
    expect(localStorage.getItem('ld:scroll:r1')).toBe('2467')
    expect(errorSpy).not.toHaveBeenCalled()
    expect(mockedListMessages).toHaveBeenCalledTimes(2)
  })
})

// ── 스크롤 위치 저장·복원 ──────────────────────────────
describe('스크롤 위치 저장·복원 (R-CHAT-010)', () => {
  it('TC-CH-025: 저장 거리 300 → 첫 배치 scrollTop = 2507 - 300 = 2207', async () => {
    localStorage.setItem('ld:scroll:r1', '300')
    mockedListMessages.mockResolvedValueOnce(ok(makePage(31, 60, false)))
    renderChat()

    const log = await screen.findByRole('log')
    await waitFor(() => expect(log.scrollTop).toBe(2207))
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-025: 언마운트 → ld:scroll:{id} 에 맨 아래로부터 거리 저장', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(makePage(31, 60, false)))
    const { unmount } = renderChat()
    const log = await screen.findByRole('log')

    userScrollTo(log, 1000)
    unmount()
    expect(localStorage.getItem('ld:scroll:r1')).toBe('1507') // 3000 - 1000 - 493
  })

  it('TC-CH-025: pagehide → 거리 저장(마지막 본 방 기록은 유지)', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(makePage(31, 60, false)))
    renderChat()
    const log = await screen.findByRole('log')

    userScrollTo(log, 1200)
    window.dispatchEvent(new Event('pagehide'))
    expect(localStorage.getItem('ld:scroll:r1')).toBe('1307') // 3000 - 1200 - 493
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
  })

  it('TC-CH-025: 로딩 중 언마운트는 저장하지 않는다(이전 값 유지)', () => {
    localStorage.setItem('ld:scroll:r1', '300')
    mockedListMessages.mockReturnValueOnce(deferred<Result<MessagesPage>>().promise)
    const { unmount } = renderChat()

    unmount()
    expect(localStorage.getItem('ld:scroll:r1')).toBe('300')
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-025: 저장소에 남는 키는 ld:lastRoomId · ld:scroll:r1 뿐', async () => {
    mockedListMessages.mockResolvedValueOnce(ok(makePage(31, 60, false)))
    const { unmount } = renderChat()
    await screen.findByRole('log')
    unmount()

    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) keys.push(localStorage.key(i) ?? '')
    expect(keys.sort()).toEqual(['ld:lastRoomId', 'ld:scroll:r1'])
  })

  it('TC-CH-026: 모든 저장소 접근이 throw → 말풍선 정상, 맨 아래 배치, ‹ 뒤로 동작', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)
    mockedListMessages.mockResolvedValueOnce(ok(makePage(31, 60, false)))
    const { onBack, unmount } = renderChat()
    const user = userEvent.setup()

    const log = await screen.findByRole('log')
    expect(within(log).getAllByRole('listitem')).toHaveLength(30)
    await waitFor(() => expect(log.scrollTop).toBe(2507))
    expect(screen.queryByRole('alert')).toBeNull()
    await user.click(screen.getByRole('button', { name: BACK }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(() => unmount()).not.toThrow()
    expect(mockedListMessages).toHaveBeenCalledTimes(1)
    expect(mockedListMessages.mock.calls[0]).toEqual(['r1'])
  })
})
