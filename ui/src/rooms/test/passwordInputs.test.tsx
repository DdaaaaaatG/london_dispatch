/**
 * 공용 델타 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-061)
 * 대상: TextInput `type`(design/components.md §1.12 S6) · PromptSheet `inputType`·`placeholder`(§1.17 S6)
 * - 설계: design/lock.md §2.2 · D-L1 · D-L5 · D-L6. 공용 부품은 문구를 갖지 않으므로 라벨은 임의 문자열을 넘긴다.
 * - 위치: 공용 폴더(components/ui/*)의 자체 테스트는 ui-component 담당 몫이라, S6 델타 판정은 rooms/test 에 둔다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PromptSheet } from '@/components/ui/PromptSheet'
import { TextInput } from '@/components/ui/TextInput'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const promptProps = {
  title: '시트',
  inputAriaLabel: '입력',
  initialValue: '',
  maxChars: 32,
  canSave: () => true,
  saveLabel: '저장',
  cancelLabel: '취소',
  onSave: vi.fn(),
  onCancel: vi.fn(),
}

describe('TextInput type (C §1.12 S6 · D-L5 · D-L6)', () => {
  it("TC-RM-061(a): type='password' → <input type=password autocomplete=new-password autocapitalize=off spellcheck=false>, 카운터 trim 없음", () => {
    render(<TextInput type="password" value=" ab " onChange={vi.fn()} ariaLabel="비번" maxChars={32} />)
    const input = screen.getByLabelText('비번') as HTMLInputElement
    expect(input.getAttribute('type')).toBe('password')
    expect(input.getAttribute('autocomplete')).toBe('new-password')
    expect(input.getAttribute('autocapitalize')).toBe('off')
    expect(input.getAttribute('spellcheck')).toBe('false')
    expect(screen.getByText('4/32')).not.toBeNull()
  })

  it("TC-RM-061(a): type='password' 33자 → 카운터 over · aria-invalid", () => {
    render(<TextInput type="password" value={'a'.repeat(33)} onChange={vi.fn()} ariaLabel="비번" maxChars={32} />)
    expect(screen.getByText('33/32').classList.contains('over')).toBe(true)
    expect(screen.getByLabelText('비번').getAttribute('aria-invalid')).toBe('true')
  })

  it('TC-RM-061(b): type 생략 → 기존 그대로(type=text · autocomplete=off · trim 카운터) 회귀 없음', () => {
    render(<TextInput value=" ab " onChange={vi.fn()} ariaLabel="제목" maxChars={60} />)
    const input = screen.getByRole('textbox', { name: '제목' })
    expect(input.getAttribute('type')).toBe('text')
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(screen.getByText('2/60')).not.toBeNull()
  })
})

describe('PromptSheet inputType · placeholder (C §1.17 S6 · D-L1)', () => {
  it("TC-RM-061(c): inputType='password' · placeholder 전달 → 내부 입력이 password, placeholder 그대로", () => {
    render(<PromptSheet {...promptProps} inputType="password" placeholder="6자 이상 권장" />)
    const input = screen.getByLabelText('입력') as HTMLInputElement
    expect(input.getAttribute('type')).toBe('password')
    expect(input.getAttribute('autocomplete')).toBe('new-password')
    expect(input.getAttribute('placeholder')).toBe('6자 이상 권장')
    expect(screen.getByText('0/32')).not.toBeNull()
  })

  it('TC-RM-061(d): 둘 다 생략 → 기존 그대로(type=text, placeholder 없음) 회귀 없음', () => {
    render(<PromptSheet {...promptProps} />)
    const input = screen.getByRole('textbox', { name: '입력' })
    expect(input.getAttribute('type')).toBe('text')
    expect(input.getAttribute('placeholder')).toBeNull()
    expect(screen.getByRole('dialog', { name: '시트' })).not.toBeNull()
  })
})
