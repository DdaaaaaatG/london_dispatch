/**
 * 공용 ConfirmDialog 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md (TC-CH-056)
 * 대상: rooms design/components.md §1.16. 확인 버튼 danger 클래스 키는 'danger'(Button variant 값)로 **확정**(메인 세션 결정 TK-09).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

afterEach(() => {
  cleanup()
})

const setup = (isBusy = false) => {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      title="이 방을 삭제할까요?"
      message="되돌릴 수 없습니다."
      confirmLabel="삭제"
      cancelLabel="취소"
      onConfirm={onConfirm}
      onCancel={onCancel}
      isBusy={isBusy}
    />,
  )
  const dialog = screen.getByRole('alertdialog', { name: '이 방을 삭제할까요?' })
  return { dialog, onConfirm, onCancel }
}

describe('ConfirmDialog (R-CHAT-007 · R-CHAT-001)', () => {
  it('TC-CH-056: alertdialog 이름 = title, h2·p, 버튼 순서 취소 → 확인, 확인 danger, 첫 포커스 취소', () => {
    const { dialog } = setup()
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe(
      '이 방을 삭제할까요?',
    )
    expect(dialog.querySelector('p')?.textContent).toBe('되돌릴 수 없습니다.')
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.map(b => b.textContent)).toEqual(['취소', '삭제'])
    expect(buttons[1]?.classList.contains('danger')).toBe(true)
    expect(document.activeElement).toBe(buttons[0])
  })

  it('TC-CH-056: 확인 → onConfirm 1회, 취소·Esc → onCancel', async () => {
    const { dialog, onConfirm, onCancel } = setup()
    const user = userEvent.setup()
    await user.click(within(dialog).getByRole('button', { name: '삭제' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await user.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('TC-CH-056: isBusy → 두 버튼 disabled, Esc 무시', () => {
    const { dialog, onCancel } = setup(true)
    for (const b of within(dialog).getAllByRole('button'))
      expect((b as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
  })
})
