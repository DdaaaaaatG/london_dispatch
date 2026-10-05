/**
 * 공용 TextArea 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md (TC-CH-058)
 * 대상: rooms design/components.md §1.13
 * - 자동 높이: getComputedStyle(lineHeight 20 · padding 8+8) 과 textarea scrollHeight 를 모킹한다 → 1줄 36 · 3줄 76.
 * - jsdom 에 matchMedia 가 없어 스텁한다(높이 ≤ 480 → 1줄 고정).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TextArea } from '@/components/ui/TextArea'

let textHeight = 36
let shortScreen = false

beforeEach(() => {
  shortScreen = false
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('max-height') ? shortScreen : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
  Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => textHeight,
  })
  const real = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
    const style = real(el, pseudo)
    if (!(el instanceof HTMLTextAreaElement)) return style
    const values: Record<string, string> = { 'line-height': '20px', 'padding-top': '8px', 'padding-bottom': '8px' }
    return new Proxy(style, {
      get(target, key) {
        if (key === 'lineHeight') return '20px'
        if (key === 'paddingTop' || key === 'paddingBottom') return '8px'
        if (key === 'getPropertyValue') return (name: string) => values[name] ?? target.getPropertyValue(name)
        const v = Reflect.get(target, key)
        return typeof v === 'function' ? v.bind(target) : v
      },
    })
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(HTMLTextAreaElement.prototype, 'scrollHeight')
})

const Controlled = (props: Partial<Parameters<typeof TextArea>[0]> & { value: string }) => (
  <TextArea onChange={vi.fn()} ariaLabel="메시지 입력" {...props} />
)

describe('TextArea 자동 높이 (R-CHAT-004 · R-CHAT-013)', () => {
  it('TC-CH-058: rows=1, scrollHeight 36 → 36px hidden · 76 → 76px hidden · 116 → 76px auto', () => {
    textHeight = 36
    const { rerender } = render(<Controlled value="a" />)
    const box = screen.getByRole('textbox', { name: '메시지 입력' }) as HTMLTextAreaElement
    expect(box.getAttribute('rows')).toBe('1')
    expect(box.style.height).toBe('36px')
    expect(box.style.overflowY).toBe('hidden')
    textHeight = 76
    rerender(<Controlled value={'a\nb\nc'} />)
    expect(box.style.height).toBe('76px')
    expect(box.style.overflowY).toBe('hidden')
    textHeight = 116
    rerender(<Controlled value={'a\nb\nc\nd\ne'} />)
    expect(box.style.height).toBe('76px')
    expect(box.style.overflowY).toBe('auto')
  })

  it('TC-CH-058: 높이 ≤ 480 화면이면 1줄 고정(116 에서도 36px)', () => {
    shortScreen = true
    textHeight = 116
    render(<Controlled value={'a\nb\nc\nd\ne'} />)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).style.height).toBe('36px')
  })
})

describe('TextArea 키·카운터 (R-CHAT-004)', () => {
  it('TC-CH-058: onEnter 있음 → Enter 1회·기본 막음, Shift+Enter·IME → 0회', () => {
    const onEnter = vi.fn()
    render(<Controlled value="가" onEnter={onEnter} />)
    const box = screen.getByRole('textbox')
    expect(fireEvent.keyDown(box, { key: 'Enter', code: 'Enter' })).toBe(false)
    expect(onEnter).toHaveBeenCalledTimes(1)
    expect(fireEvent.keyDown(box, { key: 'Enter', code: 'Enter', shiftKey: true })).toBe(true)
    fireEvent.keyDown(box, { key: 'Enter', code: 'Enter', isComposing: true })
    fireEvent.keyDown(box, { key: 'Enter', code: 'Enter', keyCode: 229 })
    expect(onEnter).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-058: onEnter 없음 → Enter 기본 동작 유지, Esc → onEscape', () => {
    const onEscape = vi.fn()
    render(<Controlled value="가" onEscape={onEscape} />)
    const box = screen.getByRole('textbox')
    expect(fireEvent.keyDown(box, { key: 'Enter', code: 'Enter' })).toBe(true)
    fireEvent.keyDown(box, { key: 'Escape', code: 'Escape' })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-058: counterMode overflow(기본) 한도 이하 없음·초과 over, always 항상', () => {
    const { rerender } = render(<Controlled value="abc" maxChars={3} />)
    expect(screen.queryByText('3/3')).toBeNull()
    rerender(<Controlled value="abcd" maxChars={3} />)
    expect(screen.getByText('4/3').classList.contains('over')).toBe(true)
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true')
    rerender(<Controlled value="ab" maxChars={3} counterMode="always" />)
    expect(screen.getByText('2/3')).not.toBeNull()
  })

  it('TC-CH-058: isReadOnly → readOnly, 입력 → onChange(값)', () => {
    const onChange = vi.fn()
    render(<TextArea value="" onChange={onChange} ariaLabel="메시지 입력" isReadOnly />)
    const box = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(box.readOnly).toBe(true)
    fireEvent.change(box, { target: { value: 'x' } })
    expect(onChange).toHaveBeenCalledWith('x')
  })
})
