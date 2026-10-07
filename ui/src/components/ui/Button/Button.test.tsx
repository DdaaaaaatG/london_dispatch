/**
 * 공용 Button(buttonRef) · IconButton(more·isDisabled) 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-032)
 * 대상: rooms design/components.md §1.2 · §1.3 (S2 추가분)
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'

afterEach(() => {
  cleanup()
})

describe('Button S2 (R-ROOMS-002)', () => {
  it('TC-RM-032: buttonRef.current 가 그 button 요소, isDisabled → disabled·onClick 0회', () => {
    const ref = { current: null as HTMLButtonElement | null }
    const onClick = vi.fn()
    const { rerender } = render(
      <Button onClick={onClick} buttonRef={ref}>
        만들기
      </Button>,
    )
    const button = screen.getByRole('button', { name: '만들기' }) as HTMLButtonElement
    expect(ref.current).toBe(button)
    expect(button.getAttribute('type')).toBe('button')
    rerender(
      <Button onClick={onClick} buttonRef={ref} isDisabled>
        만들기
      </Button>,
    )
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Button ariaDescribedBy', () => {
  it('ariaDescribedBy → aria-describedby 로 전달, 생략하면 속성 없음', () => {
    const { rerender } = render(<Button onClick={vi.fn()}>저장</Button>)
    const button = screen.getByRole('button', { name: '저장' })
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    rerender(
      <Button onClick={vi.fn()} ariaDescribedBy="note-1">
        저장
      </Button>,
    )
    expect(button.getAttribute('aria-describedby')).toBe('note-1')
  })
})

describe('IconButton more (R-CHAT-001)', () => {
  it('TC-RM-032: 이름 = ariaLabel, SVG aria-hidden, isDisabled → disabled, buttonRef 연결', () => {
    const ref = { current: null as HTMLButtonElement | null }
    const onClick = vi.fn()
    const { rerender } = render(
      <IconButton icon="more" ariaLabel="방 메뉴 열기" onClick={onClick} buttonRef={ref} />,
    )
    const button = screen.getByRole('button', { name: '방 메뉴 열기' }) as HTMLButtonElement
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(ref.current).toBe(button)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(<IconButton icon="more" ariaLabel="방 메뉴 열기" onClick={onClick} isDisabled />)
    expect(button.disabled).toBe(true)
  })
})
