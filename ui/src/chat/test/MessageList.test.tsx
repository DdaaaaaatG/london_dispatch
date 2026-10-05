/**
 * MessageList 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md (TC-CH-019 · TC-CH-011/014 부품 쪽)
 * 대상: ui/src/chat/components/MessageList.tsx (chat design/components.md §2.1 · §2.3 · §2.4)
 * S1 에는 새 메시지 발생 경로가 없다(S2·S3). 그래서 배지는 MessageList 에 unseenCount 를 직접 넣어 검증하고,
 * 배지 클릭의 "맨 아래 이동"은 useAutoScroll.test.tsx(scrollToBottom), "unseenCleared" 는 state/chat.test.ts(T11)가 맡는다.
 */
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Message } from '@shared/types'
import type { ApiError } from '@/api'
import { listMessages } from '@/api/messages'
import { MessageList, type MessageListProps } from '@/chat/components/MessageList'

vi.mock('@/api/messages', () => ({ listMessages: vi.fn() }))

const msg = (id: number): Message => ({
  id,
  roomId: 'r1',
  speaker: 'ciel',
  kind: 'line',
  text: `본문 ${id}`,
  authorName: null,
  createdAt: new Date(2026, 9, 5, 16, id % 60).getTime(),
})
const ERR: ApiError = { code: 'INTERNAL', message: 'x' }
const BADGE = '새 메시지 보기, 맨 아래로 이동'

const renderList = (over: Partial<MessageListProps> = {}) => {
  const props: MessageListProps = {
    messages: [msg(1), msg(2), msg(3)],
    containerRef: createRef<HTMLDivElement>(),
    onScroll: vi.fn(),
    isLoadingOlder: false,
    olderError: null,
    onRetryOlder: vi.fn(),
    unseenCount: 0,
    onShowNewest: vi.fn(),
    ...over,
  }
  return { ...render(<MessageList {...props} />), props }
}

beforeEach(() => {
  vi.mocked(listMessages).mockReset()
})

afterEach(() => {
  cleanup()
})

describe('MessageList 새 메시지 배지 (R-CHAT-003)', () => {
  it('TC-CH-019: unseenCount>0 → 스크롤 박스 밖에 배지(글자 "새 메시지"), 클릭 → onShowNewest 1회', async () => {
    const { props } = renderList({ unseenCount: 3 })
    const user = userEvent.setup()

    const badge = screen.getByRole('button', { name: BADGE })
    expect(badge.textContent).toContain('새 메시지')
    const log = screen.getByRole('log', { name: '대화 기록' })
    expect(within(log).queryByRole('button', { name: BADGE })).toBeNull()
    expect(badge.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')

    await user.click(badge)
    expect(props.onShowNewest).toHaveBeenCalledTimes(1)
    expect(vi.mocked(listMessages)).not.toHaveBeenCalled()
  })

  it('TC-CH-019: unseenCount=0 → 배지 없음', () => {
    renderList({ unseenCount: 0 })
    expect(screen.queryByRole('button', { name: BADGE })).toBeNull()
  })
})

describe('MessageList B0 · 스크롤 박스 (R-CHAT-003)', () => {
  it('TC-CH-011: isLoadingOlder → 박스 맨 위 role=status "이전 대화 불러오는 중", aria-busy=true, 말풍선 id 순', () => {
    const { props } = renderList({ isLoadingOlder: true })
    const log = screen.getByRole('log', { name: '대화 기록' })

    expect(within(log).getByRole('status').textContent).toContain('이전 대화 불러오는 중')
    expect(log.getAttribute('aria-busy')).toBe('true')
    expect(log.getAttribute('aria-live')).toBe('polite')
    expect(props.containerRef.current).toBe(log)
    const items = within(log).getAllByRole('listitem')
    expect(items.map((li) => li.textContent?.includes('본문 1'))).toEqual([true, false, false])
  })

  it('TC-CH-014: olderError → role=alert "이전 대화를 불러오지 못했습니다" + 「다시 시도」 → onRetryOlder', async () => {
    const { props } = renderList({ olderError: ERR })
    const user = userEvent.setup()
    const log = screen.getByRole('log')

    expect(within(log).getByRole('alert').textContent).toContain('이전 대화를 불러오지 못했습니다')
    await user.click(within(log).getByRole('button', { name: '다시 시도' }))
    expect(props.onRetryOlder).toHaveBeenCalledTimes(1)
    expect(vi.mocked(listMessages)).not.toHaveBeenCalled()
  })

  it('TC-CH-011: 로딩·오류가 둘 다 아니면 B0 없음', () => {
    renderList()
    const log = screen.getByRole('log')
    expect(within(log).queryByRole('status')).toBeNull()
    expect(within(log).queryByRole('alert')).toBeNull()
  })
})
