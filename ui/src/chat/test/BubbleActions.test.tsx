/**
 * chat S3e 말풍선 액션 버튼 부품 스펙 초안(TDD Red) — 단일 소스 ui/src/chat/test/scenarios.md v0.9
 * (TC-CH-110 · 111 · 114 · 115 · 117 · 118 의 부품 단위)
 * 설계 정본: ui/src/chat/design/actions.md v2.0 — AC §1 BubbleActions(F-CH-45) · §4 표시·비활성 · §5 F-CH-50 useEditFocus ·
 *   F-CH-51 useRefocusAfterUnlock · §7 접근성 · §8 문구 키
 * - 질의: getByRole('group', { name: '{이름} 말풍선 작업' }) → within(group).getByRole('button', { name: '{이름} 대사 …' })
 * - 클래스 키(non-scoped): 그룹 루트 actions + 변형 키 하나(sebastian·ciel·user·ooc), 삭제 래퍼 danger
 * - 부품은 api 래퍼를 모른다(핸들러에 message 만 넘긴다). 래퍼 호출 인자 단언은 MessageActions.test.tsx.
 * - S3e 이전 BubbleMenu.test.tsx(메뉴 전제)는 이 파일 + MessageActions.test.tsx 로 옮겼다(옛 파일 삭제는 ui-implementer).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { USER_DISPLAY_NAME } from '@shared/characters'
import type { Message } from '@shared/types'
import { BubbleActions, type BubbleActionsProps } from '@/chat/components/BubbleActions'

const at = (h: number, m: number): number => new Date(2026, 9, 7, h, m).getTime()
const msg = (over: Partial<Message> & Pick<Message, 'id'>): Message => ({
  roomId: 'r1',
  speaker: 'user',
  kind: 'line',
  text: '',
  authorName: USER_DISPLAY_NAME,
  createdAt: at(16, 40),
  ...over,
})
const SEB = msg({ id: 102, speaker: 'sebastian', text: '도련님, 홍차입니다.', authorName: null })
const CIEL = msg({ id: 101, speaker: 'ciel', text: '다 됐어, 세바스찬.', authorName: null })
const USER = msg({ id: 103, text: '나도 한 잔 부탁해요.' })
const OOC = msg({ id: 104, kind: 'ooc', text: '둘이 체스를 둔다' })
const KEYS = ['sebastian', 'ciel', 'user', 'ooc'] as const

const renderActions = (over: Partial<BubbleActionsProps> = {}) => {
  let props: BubbleActionsProps = {
    message: SEB,
    canRegenerate: false,
    isDisabled: false,
    shouldFocusEdit: false,
    onEditFocusDone: vi.fn(),
    onEdit: vi.fn(),
    onRegenerate: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  }
  // 포커스 이동 대상(“다른 곳”)을 형제로 둔다 — F-CH-51 “사용자가 옮겼으면 건드리지 않는다” 확인용
  const tree = (p: BubbleActionsProps) => (
    <>
      <BubbleActions {...p} />
      <input aria-label="다른 곳" />
    </>
  )
  const view = render(tree(props))
  const update = (next: Partial<BubbleActionsProps>) => {
    props = { ...props, ...next }
    view.rerender(tree(props))
  }
  return { ...view, props, update }
}
const groupOf = (name: string) => screen.getByRole('group', { name: `${name} 말풍선 작업` })
const buttonsIn = (g: HTMLElement) => within(g).getAllByRole('button') as HTMLButtonElement[]

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('버튼 줄 렌더 (R-CHAT-007 · R-CHAT-002 · R-CHAT-013)', () => {
  it.each([
    [SEB, '세바스찬', 'sebastian'],
    [CIEL, '시엘', 'ciel'],
    [USER, USER_DISPLAY_NAME, 'user'],
    [OOC, '[지시]', 'ooc'],
  ] as const)(
    'TC-CH-110: (부품) %#번 변형 — group "%s 말풍선 작업", 수정 → 삭제 순서, 클래스 actions + %s, 클릭 = 핸들러에 message',
    (message, name, key) => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()
      const onRegenerate = vi.fn()
      const onEditFocusDone = vi.fn()
      renderActions({ message, onEdit, onDelete, onRegenerate, onEditFocusDone })
      const g = groupOf(name)
      expect(g.classList.contains('actions')).toBe(true)
      for (const k of KEYS) expect(g.classList.contains(k)).toBe(k === key)
      const buttons = buttonsIn(g)
      expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual([
        `${name} 대사 수정`,
        `${name} 대사 삭제`,
      ])
      expect(buttons.map(b => b.textContent)).toEqual(['수정', '삭제'])
      expect(buttons[0]?.closest('.danger')).toBeNull()
      expect(buttons[1]?.closest('.danger')).not.toBeNull()
      for (const b of buttons) expect(b.disabled).toBe(false)

      fireEvent.click(buttons[0] as HTMLButtonElement)
      fireEvent.click(buttons[1] as HTMLButtonElement)
      expect(onEdit.mock.calls).toEqual([[message]])
      expect(onDelete.mock.calls).toEqual([[message]])
      expect(onRegenerate).not.toHaveBeenCalled()
      expect(onEditFocusDone).not.toHaveBeenCalled() // shouldFocusEdit=false 면 포커스 요청을 소비하지 않는다
    },
  )
})

describe('「재작성」 표시 (R-CHAT-007 · R-MSG-006)', () => {
  it('TC-CH-111: (부품) canRegenerate=true → 수정 → 재작성 → 삭제, 재작성은 danger 래퍼 밖, 클릭 → onRegenerate(message)', () => {
    const onRegenerate = vi.fn()
    renderActions({ canRegenerate: true, onRegenerate })
    const buttons = buttonsIn(groupOf('세바스찬'))
    expect(buttons.map(b => b.textContent)).toEqual(['수정', '재작성', '삭제'])
    const regen = within(groupOf('세바스찬')).getByRole('button', { name: '세바스찬 대사 재작성' })
    expect(regen.closest('.danger')).toBeNull()
    fireEvent.click(regen)
    expect(onRegenerate.mock.calls).toEqual([[SEB]])
  })

  it('TC-CH-111: (부품) canRegenerate=false → 「재작성」은 DOM 에 없다(비활성 아님)', () => {
    const onRegenerate = vi.fn()
    renderActions({ canRegenerate: false, onRegenerate })
    expect(screen.queryByRole('button', { name: /재작성/ })).toBeNull()
    expect(screen.queryByText('재작성')).toBeNull()
    expect(buttonsIn(groupOf('세바스찬'))).toHaveLength(2)
    expect(onRegenerate).not.toHaveBeenCalled()
  })
})

describe('비활성 (R-CHAT-007 · R-CHAT-005)', () => {
  it('TC-CH-114: (부품) isDisabled=true → 세 버튼 모두 네이티브 disabled(숨기지 않음, aria-disabled 없음), 클릭해도 핸들러 0회 → false 로 바뀌면 활성', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const onRegenerate = vi.fn()
    const { update } = renderActions({
      canRegenerate: true,
      isDisabled: true,
      onEdit,
      onDelete,
      onRegenerate,
    })
    const buttons = buttonsIn(groupOf('세바스찬'))
    expect(buttons).toHaveLength(3)
    for (const b of buttons) {
      expect(b.disabled).toBe(true)
      expect(b.getAttribute('aria-disabled')).toBeNull()
      expect(b.hidden).toBe(false)
      fireEvent.click(b)
    }
    expect(onEdit).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
    expect(onRegenerate).not.toHaveBeenCalled()

    update({ isDisabled: false })
    for (const b of buttonsIn(groupOf('세바스찬'))) expect(b.disabled).toBe(false)
  })
})

describe('「수정」 포커스 복귀 — F-CH-50 useEditFocus (R-CHAT-013 · R-CHAT-007)', () => {
  it('TC-CH-115: (부품) shouldFocusEdit=true · 활성 → 그 「수정」에 포커스, onEditFocusDone(true) 1회', () => {
    const onEditFocusDone = vi.fn()
    renderActions({ shouldFocusEdit: true, onEditFocusDone })
    const edit = within(groupOf('세바스찬')).getByRole('button', { name: '세바스찬 대사 수정' })
    expect(document.activeElement).toBe(edit)
    expect(onEditFocusDone.mock.calls).toEqual([[true]])
  })

  it('TC-CH-115: (부품) shouldFocusEdit=true · isDisabled=true → 포커스 못 받음, onEditFocusDone(false) 1회(호출 쪽이 log 로 대신)', () => {
    const onEditFocusDone = vi.fn()
    renderActions({ shouldFocusEdit: true, isDisabled: true, onEditFocusDone })
    const edit = within(groupOf('세바스찬')).getByRole('button', { name: '세바스찬 대사 수정' })
    expect(document.activeElement).not.toBe(edit)
    expect(onEditFocusDone.mock.calls).toEqual([[false]])
  })
})

describe('「재작성」 잠금 해제 뒤 포커스 — F-CH-51 useRefocusAfterUnlock (R-CHAT-013 · R-CHAT-005)', () => {
  const regenOf = () =>
    within(groupOf('세바스찬')).getByRole('button', { name: '세바스찬 대사 재작성' })

  it('TC-CH-117: (부품) 누름 → 포커스 잃음(body) → disabled → 해제 → 같은 「재작성」에 포커스, 한 번만', async () => {
    const onRegenerate = vi.fn()
    const { update } = renderActions({ canRegenerate: true, onRegenerate })
    await userEvent.setup().click(regenOf())
    expect(onRegenerate.mock.calls).toEqual([[SEB]])
    // jsdom 은 disabled 된 요소의 포커스를 옮기지도, disabled 요소의 blur 를 받지도 않는다(DC-05) → disabled 전에 blur
    regenOf().blur()
    expect(document.activeElement).toBe(document.body)
    update({ isDisabled: true })
    update({ isDisabled: false })
    expect(document.activeElement).toBe(regenOf())

    // 같은 누름으로는 다시 끌어오지 않는다(pressedRef 를 비운다)
    regenOf().blur()
    update({ isDisabled: true })
    update({ isDisabled: false })
    expect(document.activeElement).toBe(document.body)
    expect(onRegenerate).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-117: (부품) 누름 → 그사이 다른 곳으로 옮김 → 해제 뒤에도 그 자리 그대로', async () => {
    const { update } = renderActions({ canRegenerate: true })
    await userEvent.setup().click(regenOf())
    const other = screen.getByRole('textbox', { name: '다른 곳' })
    other.focus()
    update({ isDisabled: true })
    update({ isDisabled: false })
    expect(document.activeElement).toBe(other)
  })

  it('TC-CH-117: (부품) 누르지 않았으면 잠금 해제가 포커스를 옮기지 않는다', () => {
    const { update } = renderActions({ canRegenerate: true })
    expect(document.activeElement).toBe(document.body)
    update({ isDisabled: true })
    update({ isDisabled: false })
    expect(document.activeElement).toBe(document.body)
  })
})

describe('접근성 이름 (R-CHAT-013 · R-CHAT-002)', () => {
  it.each([
    [SEB, '세바스찬'],
    [CIEL, '시엘'],
    [USER, USER_DISPLAY_NAME],
    [OOC, '[지시]'],
  ] as const)('TC-CH-118: (부품) %#번 — 버튼 이름 끝이 보이는 글자(label-in-name), group role', (message, name) => {
    renderActions({ message, canRegenerate: message.speaker !== 'user' && message.kind === 'line' })
    const g = groupOf(name)
    expect(g.getAttribute('role')).toBe('group')
    for (const b of buttonsIn(g)) {
      const label = b.getAttribute('aria-label') ?? ''
      expect(label.startsWith(`${name} 대사 `)).toBe(true)
      expect(label.endsWith(b.textContent ?? '∅')).toBe(true)
    }
  })

  it.each([
    [null, USER_DISPLAY_NAME],
    ['', USER_DISPLAY_NAME],
    ['미샤', '미샤'],
  ] as const)(
    'TC-CH-118: (부품) 유저 authorName=%j → 이름 %s(userAuthorLabel 규칙, TC-CH-108 메뉴 머리 단언 대체), 「이름 없음」 없음',
    (authorName, name) => {
      renderActions({ message: msg({ id: 105, text: '익명', authorName }) })
      expect(groupOf(name)).not.toBeNull()
      expect(
        within(groupOf(name)).getByRole('button', { name: `${name} 대사 수정` }),
      ).not.toBeNull()
      expect(screen.queryByText(/이름 없음/)).toBeNull()
    },
  )
})
