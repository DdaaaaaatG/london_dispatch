/**
 * 공용 BottomSheet · SheetItem 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md (TC-CH-055)
 * 대상: rooms design/components.md §1.15. 덮개 = 패널(role 요소)의 부모 요소.
 * - SheetItem tone='danger' 클래스 키는 'danger' 로 가정(설계에 키 이름 없음).
 */
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomSheet, SheetItem } from '@/components/ui/BottomSheet'

afterEach(() => {
  cleanup()
})

type Opts = { header?: boolean; dismissDisabled?: boolean; useInitial?: boolean; role?: 'dialog' | 'alertdialog' }
const Host = ({ onClose, onSelect, opts }: { onClose: () => void; onSelect: () => void; opts: Opts }) => {
  const [open, setOpen] = useState(false)
  const [outerShown, setOuterShown] = useState(true)
  const initial = useRef<HTMLButtonElement | null>(null)
  return (
    <div>
      {outerShown && (
        <button type="button" onClick={() => setOpen(true)}>
          열기
        </button>
      )}
      <button type="button" onClick={() => setOpen(false)}>
        밖에서 닫기
      </button>
      <button type="button" onClick={() => setOuterShown(false)}>
        여는 버튼 제거
      </button>
      {open && (
        <BottomSheet
          ariaLabel="시트"
          role={opts.role}
          header={opts.header ? <p>머리</p> : undefined}
          onClose={onClose}
          isDismissDisabled={opts.dismissDisabled}
          initialFocusRef={opts.useInitial ? initial : undefined}
        >
          <SheetItem label="하나" onSelect={onSelect} />
          <SheetItem label="둘" onSelect={vi.fn()} tone="danger" isDisabled={false} />
          <button type="button" ref={initial}>
            셋
          </button>
        </BottomSheet>
      )}
    </div>
  )
}
const setup = async (opts: Opts = {}) => {
  const onClose = vi.fn()
  const onSelect = vi.fn()
  render(<Host onClose={onClose} onSelect={onSelect} opts={opts} />)
  const user = userEvent.setup()
  const opener = screen.getByRole('button', { name: '열기' })
  opener.focus()
  await user.click(opener)
  return { user, opener, onClose, onSelect }
}

describe('BottomSheet (R-CHAT-007 · R-CHAT-001 · R-CHAT-013)', () => {
  it('TC-CH-055: role·aria-modal·이름, 머리 유무, 첫 포커스 = 첫 항목, danger 클래스, 항목 클릭 → onSelect', async () => {
    const { user, onSelect } = await setup({ header: true })
    const panel = screen.getByRole('dialog', { name: '시트' })
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByText('머리')).not.toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '하나' }))
    expect(screen.getByRole('button', { name: '둘' }).classList.contains('danger')).toBe(true)
    await user.click(screen.getByRole('button', { name: '하나' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-055: header 없음 → 머리 없음, role=alertdialog, initialFocusRef 우선', async () => {
    await setup({ role: 'alertdialog', useInitial: true })
    expect(screen.getByRole('alertdialog', { name: '시트' })).not.toBeNull()
    expect(screen.queryByText('머리')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '셋' }))
  })

  it('TC-CH-055: Tab 끝 → 처음, Shift+Tab 처음 → 끝(포커스 트랩)', async () => {
    const { user } = await setup()
    await user.tab()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '셋' }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '하나' }))
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '셋' }))
  })

  it('TC-CH-055: Esc·덮개 → onClose, 패널 클릭 → 0회', async () => {
    const { user, onClose } = await setup()
    const panel = screen.getByRole('dialog')
    fireEvent.click(panel)
    expect(onClose).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(panel.parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('TC-CH-055: isDismissDisabled → Esc·덮개 무시', async () => {
    const { user, onClose } = await setup({ dismissDisabled: true })
    await user.keyboard('{Escape}')
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('TC-CH-055: 언마운트 → 이전 포커스(여는 버튼) 복귀, 그 버튼이 DOM 에 없으면 복귀 안 함', async () => {
    const { opener } = await setup()
    act(() => screen.getByRole('button', { name: '밖에서 닫기' }).click())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)

    act(() => opener.click())
    expect(screen.getByRole('dialog')).not.toBeNull()
    act(() => screen.getByRole('button', { name: '여는 버튼 제거' }).click())
    const before = document.activeElement
    act(() => screen.getByRole('button', { name: '밖에서 닫기' }).click())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: '열기' })).toBeNull()
    expect(document.activeElement === opener).toBe(false)
    expect(before).not.toBeNull()
  })
})
