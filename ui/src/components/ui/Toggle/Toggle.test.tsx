/**
 * 공용 Toggle 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md (TC-CH-059)
 * 대상: rooms design/components.md §1.14
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toggle } from '@/components/ui/Toggle'

afterEach(() => {
  cleanup()
})

describe('Toggle (R-CHAT-004)', () => {
  it('TC-CH-059: role=switch · 이름 = ariaLabel · aria-checked · 글자 on/off', () => {
    const { rerender } = render(
      <Toggle
        isOn={false}
        onChange={vi.fn()}
        onLabel="OOC 켬"
        offLabel="OOC 끔"
        ariaLabel="OOC 지시 모드"
      />,
    )
    const sw = screen.getByRole('switch', { name: 'OOC 지시 모드' })
    expect(sw.tagName).toBe('BUTTON')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(sw.textContent).toBe('OOC 끔')
    rerender(
      <Toggle
        isOn
        onChange={vi.fn()}
        onLabel="OOC 켬"
        offLabel="OOC 끔"
        ariaLabel="OOC 지시 모드"
      />,
    )
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect(sw.textContent).toBe('OOC 켬')
  })

  it('TC-CH-059: 클릭·Space·Enter → onChange(!isOn) 각 1회, 부품은 상태를 바꾸지 않음', async () => {
    const onChange = vi.fn()
    render(
      <Toggle
        isOn={false}
        onChange={onChange}
        onLabel="OOC 켬"
        offLabel="OOC 끔"
        ariaLabel="OOC 지시 모드"
      />,
    )
    const user = userEvent.setup()
    const sw = screen.getByRole('switch')
    await user.click(sw)
    sw.focus()
    await user.keyboard('[Space]')
    await user.keyboard('{Enter}')
    expect(onChange.mock.calls).toEqual([[true], [true], [true]])
    expect(sw.getAttribute('aria-checked')).toBe('false')
  })
})
