/**
 * 공용 useLongPress 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md (TC-CH-060)
 * 대상: rooms design/components.md §1.19. 하네스 요소에 핸들러를 붙이고 가짜 시계 + user.pointer 로 누른다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  LONG_PRESS_MOVE_TOLERANCE_PX,
  LONG_PRESS_MS,
  type LongPressHandlers,
  useLongPress,
} from '@/components/hooks/useLongPress'

let seen: LongPressHandlers[] = []
const Pad = ({ onLongPress }: { onLongPress: () => void }) => {
  const handlers = useLongPress({ onLongPress })
  seen.push(handlers)
  return (
    <div data-testid="pad" {...handlers}>
      말풍선
    </div>
  )
}

let user: ReturnType<typeof userEvent.setup>
const press = async (target: Element, x = 10, y = 10) =>
  user.pointer({ keys: '[MouseLeft>]', target, coords: { clientX: x, clientY: y } })
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

beforeEach(() => {
  seen = []
  vi.useFakeTimers()
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useLongPress (R-CHAT-007)', () => {
  it('TC-CH-060: 상수 500ms · 10px', () => {
    expect(LONG_PRESS_MS).toBe(500)
    expect(LONG_PRESS_MOVE_TOLERANCE_PX).toBe(10)
  })

  it('TC-CH-060: 499ms 0회 → 500ms 1회', async () => {
    const fn = vi.fn()
    render(<Pad onLongPress={fn} />)
    await press(screen.getByTestId('pad'))
    advance(499)
    expect(fn).not.toHaveBeenCalled()
    advance(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-060: 10px 이동은 허용(1회), 11px 이동은 취소(0회)', async () => {
    const fn = vi.fn()
    render(<Pad onLongPress={fn} />)
    const pad = screen.getByTestId('pad')
    await press(pad)
    await user.pointer({ target: pad, coords: { clientX: 20, clientY: 10 } })
    advance(500)
    expect(fn).toHaveBeenCalledTimes(1)
    await user.pointer({ keys: '[/MouseLeft]', target: pad })
    await press(pad)
    await user.pointer({ target: pad, coords: { clientX: 10, clientY: 21 } })
    advance(500)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it.each(['up', 'leave', 'cancel'] as const)('TC-CH-060: pointer%s 가 오면 취소', async kind => {
    const fn = vi.fn()
    render(<Pad onLongPress={fn} />)
    const pad = screen.getByTestId('pad')
    await press(pad)
    advance(200)
    if (kind === 'up') fireEvent.pointerUp(pad)
    if (kind === 'leave') fireEvent.pointerLeave(pad)
    if (kind === 'cancel') fireEvent.pointerCancel(pad)
    advance(500)
    expect(fn).not.toHaveBeenCalled()
  })

  // user-event 14.6 의 우클릭은 contextmenu 를 바로 보내므로 pointerdown(button 2)만 직접 보낸다(TK-02)
  it('TC-CH-060: 오른쪽 버튼 pointerdown 만으로는 타이머가 시작되지 않는다', () => {
    const fn = vi.fn()
    render(<Pad onLongPress={fn} />)
    fireEvent.pointerDown(screen.getByTestId('pad'), {
      button: 2,
      pointerType: 'mouse',
      clientX: 10,
      clientY: 10,
    })
    advance(600)
    expect(fn).not.toHaveBeenCalled()
  })

  it('TC-CH-060: contextmenu(마우스 우클릭) → preventDefault + onLongPress 1회', () => {
    const fn = vi.fn()
    render(<Pad onLongPress={fn} />)
    expect(fireEvent.contextMenu(screen.getByTestId('pad'))).toBe(false)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-060: 롱프레스 직후 contextmenu 는 추가 호출 없음(합계 1), 그다음 contextmenu 는 다시 1회', async () => {
    const fn = vi.fn()
    render(<Pad onLongPress={fn} />)
    const pad = screen.getByTestId('pad')
    await press(pad)
    advance(500)
    expect(fireEvent.contextMenu(pad)).toBe(false)
    expect(fn).toHaveBeenCalledTimes(1)
    fireEvent.contextMenu(pad)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('TC-CH-060: 누름 중 언마운트 → 타이머 0개, 호출 없음', async () => {
    const fn = vi.fn()
    const { unmount } = render(<Pad onLongPress={fn} />)
    await press(screen.getByTestId('pad'))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    advance(500)
    expect(fn).not.toHaveBeenCalled()
  })

  it('TC-CH-060: 핸들러 객체는 리렌더해도 같은 참조, 최신 onLongPress 가 불린다', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<Pad onLongPress={first} />)
    rerender(<Pad onLongPress={second} />)
    expect(seen[seen.length - 1]).toBe(seen[0])
    await press(screen.getByTestId('pad'))
    advance(500)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
