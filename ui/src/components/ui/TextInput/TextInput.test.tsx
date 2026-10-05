/**
 * 공용 TextInput 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-032)
 * 대상: ui/src/components/ui/TextInput (rooms design/components.md §1.12). 문구는 props 로만 받는다(§1.9).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TextInput } from '@/components/ui/TextInput'

afterEach(() => {
  cleanup()
})

const setup = (over: Partial<Parameters<typeof TextInput>[0]> = {}) => {
  const onChange = vi.fn()
  const onEnter = vi.fn()
  const onEscape = vi.fn()
  const view = render(
    <TextInput
      value=""
      onChange={onChange}
      ariaLabel="이름"
      onEnter={onEnter}
      onEscape={onEscape}
      {...over}
    />,
  )
  const input = screen.getByRole('textbox', { name: '이름' }) as HTMLInputElement
  return { ...view, input, onChange, onEnter, onEscape }
}

describe('TextInput (R-ROOMS-002 · R-CHAT-001)', () => {
  it('TC-RM-032: input type=text · aria-label · autoComplete=off, maxChars 없으면 카운터 없음', () => {
    const { input, container } = setup({ value: 'ab' })
    expect(input.getAttribute('type')).toBe('text')
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('TC-RM-032: 카운터 n/max(aria-hidden), 초과 시 over·aria-invalid, 코드 포인트·trim 기준', () => {
    const { rerender } = setup({ value: '  a😀 ', maxChars: 3 })
    const counter = screen.getByText('2/3')
    expect(counter.getAttribute('aria-hidden')).toBe('true')
    expect(counter.classList.contains('over')).toBe(false)
    rerender(<TextInput value="abcd" onChange={vi.fn()} ariaLabel="이름" maxChars={3} />)
    expect(screen.getByText('4/3').classList.contains('over')).toBe(true)
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true')
  })

  it('TC-RM-032: 입력 → onChange(값), Enter → onEnter 1회(기본 막음), IME·229 → 0회, Esc → onEscape', () => {
    const { input, onChange, onEnter, onEscape } = setup()
    fireEvent.change(input, { target: { value: '가' } })
    expect(onChange).toHaveBeenCalledWith('가')
    expect(fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })).toBe(false)
    expect(onEnter).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', isComposing: true })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 229 })
    expect(onEnter).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  // v1.5: TextInput 의 isDisabled 는 삭제됐다 → 단언하지 않는다(TK-04)
  it('TC-RM-032: isReadOnly → readOnly, inputRef 가 input 을 가리킴', () => {
    const ref = { current: null as HTMLInputElement | null }
    const { input } = setup({ isReadOnly: true, inputRef: ref })
    expect(input.readOnly).toBe(true)
    expect(ref.current).toBe(input)
  })
})
