/**
 * 공용 PromptSheet 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md (TC-CH-057)
 * 대상: rooms design/components.md §1.17
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptSheet } from '@/components/ui/PromptSheet'

afterEach(() => {
  cleanup()
})

const setup = (over: { isBusy?: boolean; errorText?: string | null } = {}) => {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  const canSave = vi.fn((v: string) => v !== '티타임' && v.trim() !== '')
  render(
    <PromptSheet
      title="방 이름 변경"
      inputAriaLabel="방 이름"
      initialValue="티타임"
      maxChars={60}
      canSave={canSave}
      saveLabel="저장"
      cancelLabel="취소"
      onSave={onSave}
      onCancel={onCancel}
      {...over}
    />,
  )
  const sheet = screen.getByRole('dialog', { name: '방 이름 변경' })
  const input = within(sheet).getByRole('textbox', { name: '방 이름' }) as HTMLInputElement
  const save = within(sheet).getByRole('button', { name: '저장' }) as HTMLButtonElement
  return { sheet, input, save, onSave, onCancel }
}

describe('PromptSheet (R-CHAT-001)', () => {
  it('TC-CH-057: h2 = title, 입력 초기값·포커스·커서 끝, 카운터 3/60, canSave false → 저장 disabled·Enter 무시', async () => {
    const { sheet, input, save, onSave } = setup()
    expect(within(sheet).getByRole('heading', { level: 2 }).textContent).toBe('방 이름 변경')
    expect(input.value).toBe('티타임')
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(3)
    expect(within(sheet).getByText('3/60')).not.toBeNull()
    expect(save.disabled).toBe(true)
    await userEvent.setup().keyboard('{Enter}')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('TC-CH-057: 값을 바꾸면 저장 enabled → Enter·저장 → onSave(값), 취소 → onCancel', async () => {
    const { input, save, onSave, onCancel } = setup()
    const user = userEvent.setup()
    fireEvent.change(input, { target: { value: '새 이름' } })
    expect(save.disabled).toBe(false)
    input.focus()
    await user.keyboard('{Enter}')
    expect(onSave).toHaveBeenLastCalledWith('새 이름')
    await user.click(save)
    expect(onSave).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: '취소' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-057: isBusy → 입력 readOnly·두 버튼 disabled, errorText → role=alert', () => {
    const { sheet, input } = setup({ isBusy: true, errorText: '서버 내부 오류' })
    expect(input.readOnly).toBe(true)
    for (const b of within(sheet).getAllByRole('button'))
      expect((b as HTMLButtonElement).disabled).toBe(true)
    expect(within(sheet).getByRole('alert').textContent).toBe('서버 내부 오류')
  })
})
