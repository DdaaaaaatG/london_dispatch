/**
 * chat S3 캐릭터 버튼 부품 스펙 초안(TDD Red) — 단일 소스 ui/src/chat/test/scenarios.md
 * (TC-CH-066 부품 · TC-CH-089 · TC-CH-093 부품)
 * 대상: ui/src/chat/components/SpeakButtons.tsx (design/components.md §2.11 · functions.md F-CH-38)
 * - 부품은 api 를 모른다. onSpeak 콜백 인자만 단언한다(api 래퍼 호출 단언은 SpeakFlow.test.tsx).
 * - jsdom 은 disabled 가 된 버튼에서 포커스를 빼지 않는다 → 포커스 잃음은 blur() 로 구성한다(DC-05).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CharacterId } from '@shared/types'
import { SpeakButtons, type SpeakButtonsProps } from '@/chat/components/SpeakButtons'

const SEB = '세바스찬 대사 생성'
const CIEL = '시엘 대사 생성'

const setup = (over: Partial<SpeakButtonsProps> = {}) => {
  const props: SpeakButtonsProps = {
    isDisabled: false,
    speakingCharacter: null,
    onSpeak: vi.fn<(c: CharacterId) => void>(),
    ...over,
  }
  const view = render(<SpeakButtons {...props} />)
  const rerenderWith = (next: Partial<SpeakButtonsProps>) => {
    Object.assign(props, next)
    view.rerender(<SpeakButtons {...props} />)
  }
  return { ...view, props, rerenderWith }
}
const btn = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

afterEach(() => {
  cleanup()
})

describe('SpeakButtons 렌더 (R-CHAT-004 · R-CHAT-013)', () => {
  it('TC-CH-066: (부품) 세바스찬 → 시엘 순서, 접근 이름 "{이름} 대사 생성", 보이는 글자 shortName', () => {
    setup()
    const buttons = screen.getAllByRole('button') as HTMLButtonElement[]
    expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual([SEB, CIEL])
    expect(buttons.map(b => b.textContent)).toEqual(['세바스찬', '시엘'])
    expect(buttons.every(b => !b.disabled)).toBe(true)
  })

  it('TC-CH-066: (부품) 클릭 → onSpeak(캐릭터) 1회씩, isDisabled 면 두 버튼 disabled·호출 없음', async () => {
    const { props, rerenderWith } = setup()
    const user = userEvent.setup()
    await user.click(btn(SEB))
    await user.click(btn(CIEL))
    expect(vi.mocked(props.onSpeak).mock.calls).toEqual([['sebastian'], ['ciel']])

    rerenderWith({ isDisabled: true })
    expect(btn(SEB).disabled).toBe(true)
    expect(btn(CIEL).disabled).toBe(true)
    await user.click(btn(SEB))
    expect(props.onSpeak).toHaveBeenCalledTimes(2)
  })
})

describe('SpeakButtons 포커스 복귀 F-CH-38 (R-CHAT-013 · R-CHAT-005)', () => {
  it('TC-CH-089: (부품) 누른 버튼이 포커스를 잃은 채 잠금이 풀리면 그 캐릭터 버튼으로 포커스', () => {
    const { rerenderWith } = setup()
    btn(SEB).focus()
    // jsdom 은 disabled 요소의 blur() 를 무시한다 → disabled 전환 **전**에 포커스를 body 로 뺀다
    // (브라우저에서 누른 버튼이 disabled 가 되며 포커스를 잃는 상황을 흉내, DC-05)
    act(() => (document.activeElement as HTMLElement).blur())
    expect(document.activeElement).toBe(document.body)
    rerenderWith({ isDisabled: true, speakingCharacter: 'sebastian' })
    expect(document.activeElement).toBe(document.body)

    rerenderWith({ isDisabled: false, speakingCharacter: null })
    expect(document.activeElement).toBe(btn(SEB))
  })

  it('TC-CH-089: (부품) 그사이 다른 곳(바깥 입력)으로 포커스를 옮겼으면 건드리지 않는다', () => {
    const outside = document.createElement('input')
    document.body.appendChild(outside)
    const { rerenderWith } = setup()
    btn(CIEL).focus()
    rerenderWith({ isDisabled: true, speakingCharacter: 'ciel' })
    act(() => outside.focus())

    rerenderWith({ isDisabled: false, speakingCharacter: null })
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it('TC-CH-089: (부품) 복귀 대상 기억은 잠금 해제마다 비운다 — 다음 무관한 잠금 해제에서 옛 버튼으로 끌려가지 않음', () => {
    const outside = document.createElement('input')
    document.body.appendChild(outside)
    const { rerenderWith } = setup()
    // ① 세바스찬 생성 중 바깥으로 포커스 이동 → 해제(포커스 건드리지 않음, 기억 비움)
    rerenderWith({ isDisabled: true, speakingCharacter: 'sebastian' })
    act(() => outside.focus())
    rerenderWith({ isDisabled: false, speakingCharacter: null })
    expect(document.activeElement).toBe(outside)
    // ② 다른 쓰기(speak 아님)로 잠김 → 포커스가 body 로 빠진 채 해제
    rerenderWith({ isDisabled: true, speakingCharacter: null })
    act(() => outside.blur())
    outside.remove()
    rerenderWith({ isDisabled: false, speakingCharacter: null })
    expect(document.activeElement).toBe(document.body)
  })

  it('TC-CH-093: (부품) 버튼 클릭 없이(「재시도」로) 시작한 시엘 생성도 잠금 해제 시 시엘 버튼으로', () => {
    const { rerenderWith } = setup()
    // 「재시도」는 PendingBubble 안에 있다 — 부품 단위에서는 speakingCharacter 만 들어오고 포커스는 body 다
    rerenderWith({ isDisabled: true, speakingCharacter: 'ciel' })
    expect(document.activeElement).toBe(document.body)

    rerenderWith({ isDisabled: false, speakingCharacter: null })
    expect(document.activeElement).toBe(btn(CIEL))
  })
})
