/**
 * chat S2 말풍선 메뉴·인라인 수정·삭제 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md
 * (TC-CH-039 ~ 046 · TC-CH-054 (a)(b)(d))
 * 대상: Bubble 메뉴 핸들러 · useLongPress · MessageMenuSheet · InlineEditor · ConfirmDialog · useMessageWrites
 * - 메뉴 대상 = li 안 [aria-haspopup="dialog"] (C §2.2). 롱프레스는 목록이 그려진 뒤 가짜 시계 + user.pointer.
 * - SheetItem tone='danger' 클래스 키는 'danger' 로 **확정**(메인 세션 결정 TK-09, 설계 명시는 ui-designer 몫).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ERROR_MESSAGES } from '@shared/errors'
import type { Message, MessagesPage, RoomSummary } from '@shared/types'
import type { ApiErrorCode, Result } from '@/api'
import { appendUser, deleteMessage, editMessage, listMessages } from '@/api/messages'
import { ChatScreen } from '@/chat'
import { MessageMenuSheet } from '@/chat/components/MessageMenuSheet'
import { WRITER_VIEWER } from '@/state/viewer'

vi.mock('@/api/messages', () => ({
  listMessages: vi.fn(),
  appendUser: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
}))
vi.mock('@/api/rooms', () => ({
  listRooms: vi.fn(),
  createRoom: vi.fn(),
  renameRoom: vi.fn(),
  deleteRoom: vi.fn(),
}))

const mockedList = vi.mocked(listMessages)
const mockedAppend = vi.mocked(appendUser)
const mockedEdit = vi.mocked(editMessage)
const mockedDelete = vi.mocked(deleteMessage)

const ROOM: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 5, 9, 0).getTime(),
  updatedAt: new Date(2026, 9, 7, 18, 0).getTime(),
  messageCount: 4,
}
const at = (h: number, m: number): number => new Date(2026, 9, 5, h, m).getTime()
const msg = (over: Partial<Message> & Pick<Message, 'id'>): Message => ({
  roomId: 'r1',
  speaker: 'user',
  kind: 'line',
  text: '',
  authorName: '미샤',
  createdAt: at(16, 40),
  ...over,
})
const M103 = msg({ id: 103, text: '나도 한 잔 부탁해요.', createdAt: at(16, 42) })
const PAGE: MessagesPage = {
  messages: [
    msg({
      id: 101,
      speaker: 'ciel',
      text: '세바스찬, 홍차.',
      authorName: null,
      createdAt: at(16, 40),
    }),
    msg({
      id: 102,
      speaker: 'sebastian',
      text: '예, 도련님.',
      authorName: null,
      createdAt: at(16, 41),
    }),
    M103,
    msg({ id: 104, kind: 'ooc', text: '둘이 체스를 둔다', createdAt: at(16, 43) }),
  ],
  hasMore: false,
}
const IDS = [101, 102, 103, 104]

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fail = (code: ApiErrorCode): Result<never> => ({
  ok: false,
  error: { code, message: 'SERVER-RAW-MESSAGE' },
})
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}
const flushPending = async () => {
  await act(async () => {})
}

const renderChat = () => {
  const onAuthFailure = vi.fn()
  const view = render(
    <ChatScreen
      room={ROOM}
      viewer={WRITER_VIEWER}
      onBack={vi.fn()}
      onAuthFailure={onAuthFailure}
      onRoomRenamed={vi.fn()}
    />,
  )
  return { ...view, onAuthFailure }
}
const items = () => within(screen.getByRole('log')).getAllByRole('listitem')
const bubbleOf = (id: number): HTMLElement =>
  items()[IDS.indexOf(id)]?.querySelector('[aria-haspopup="dialog"]') as HTMLElement
const openMenu = (id: number) => {
  fireEvent.contextMenu(bubbleOf(id))
  return screen.getByRole('dialog', { name: '메시지 메뉴' })
}
const openEditor = async (id = 103) => {
  const user = userEvent.setup()
  await user.click(within(openMenu(id)).getByRole('button', { name: '수정' }))
  const group = screen.getByRole('group', { name: '메시지 수정' })
  const box = within(group).getByRole('textbox', { name: '수정할 내용' }) as HTMLTextAreaElement
  const save = within(group).getByRole('button', { name: '저장' }) as HTMLButtonElement
  const cancel = within(group).getByRole('button', { name: '취소' }) as HTMLButtonElement
  return { user, group, box, save, cancel }
}
const openConfirm = async (id = 103) => {
  const user = userEvent.setup()
  await user.click(within(openMenu(id)).getByRole('button', { name: '삭제' }))
  return { user, confirm: screen.getByRole('alertdialog', { name: '이 메시지를 삭제할까요?' }) }
}

// 스크롤 mock(TC-CH-046 (c) — S1 ChatScroll 규칙)
const scrollTops = new WeakMap<Element, number>()
const installScrollMock = () => {
  const isLog = (el: Element) => el.getAttribute('role') === 'log'
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isLog(this) ? 3000 : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isLog(this) ? 493 : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get(this: HTMLElement) {
      return scrollTops.get(this) ?? 0
    },
    set(this: HTMLElement, v: number) {
      scrollTops.set(this, v)
    },
  })
}

beforeEach(() => {
  for (const m of [mockedList, mockedAppend, mockedEdit, mockedDelete]) m.mockReset()
  mockedList.mockResolvedValue(ok(PAGE))
  localStorage.clear()
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  for (const key of ['scrollHeight', 'clientHeight', 'scrollTop'])
    Reflect.deleteProperty(HTMLElement.prototype, key)
})

describe('말풍선 메뉴 열기 (R-CHAT-007 · R-CHAT-013)', () => {
  it('TC-CH-039: contextmenu → 메시지 메뉴, 기본 메뉴 막음', async () => {
    renderChat()
    await screen.findByRole('log')
    expect(fireEvent.contextMenu(bubbleOf(102))).toBe(false)
    expect(screen.getAllByRole('dialog', { name: '메시지 메뉴' })).toHaveLength(1)
    expect(mockedEdit).not.toHaveBeenCalled()
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('TC-CH-039: 마우스 왼쪽 500ms → 열림 / 499ms 뗌 → 안 열림 / 11px 이동 → 안 열림', async () => {
    renderChat()
    await screen.findByRole('log')
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const target = bubbleOf(102)

    await user.pointer({ keys: '[MouseLeft>]', target, coords: { clientX: 10, clientY: 10 } })
    act(() => vi.advanceTimersByTime(499))
    await user.pointer({ keys: '[/MouseLeft]', target })
    act(() => vi.advanceTimersByTime(100))
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.pointer([
      { keys: '[MouseLeft>]', target, coords: { clientX: 10, clientY: 10 } },
      { target, coords: { clientX: 21, clientY: 10 } },
    ])
    act(() => vi.advanceTimersByTime(500))
    await user.pointer({ keys: '[/MouseLeft]', target })
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.pointer({ keys: '[MouseLeft>]', target, coords: { clientX: 10, clientY: 10 } })
    act(() => vi.advanceTimersByTime(500))
    expect(screen.getAllByRole('dialog', { name: '메시지 메뉴' })).toHaveLength(1)
  })

  it('TC-CH-039: 터치 롱프레스 뒤 브라우저 contextmenu → 시트 1개만', async () => {
    renderChat()
    await screen.findByRole('log')
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const target = bubbleOf(102)
    await user.pointer({ keys: '[TouchA>]', target })
    act(() => vi.advanceTimersByTime(500))
    expect(fireEvent.contextMenu(target)).toBe(false)
    expect(screen.getAllByRole('dialog', { name: '메시지 메뉴' })).toHaveLength(1)
  })

  it('TC-CH-039: 말풍선 포커스 + Shift+F10 → 열림', async () => {
    renderChat()
    await screen.findByRole('log')
    const user = userEvent.setup()
    bubbleOf(102).focus()
    await user.keyboard('{Shift>}{F10}{/Shift}')
    expect(screen.getByRole('dialog', { name: '메시지 메뉴' })).not.toBeNull()
  })
})

describe('말풍선 메뉴 내용·닫기 (R-CHAT-007 · R-LLM-002)', () => {
  it.each([
    [102, '세바스찬 · 16:41  "예, 도련님."'],
    [103, '미샤 · 16:42  "나도 한 잔 부탁해요."'],
    [104, '[지시] · 16:43  "둘이 체스를 둔다"'],
  ])('TC-CH-040: %i 메뉴 머리 = %s, 항목 수정·삭제·취소(재작성 없음)', async (id, header) => {
    renderChat()
    await screen.findByRole('log')
    const dialog = openMenu(id)
    expect(dialog.querySelector('p')?.textContent).toBe(header)
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.map(b => b.textContent)).toEqual(['수정', '삭제', '취소'])
    expect(buttons[1]?.classList.contains('danger')).toBe(true)
    expect(within(dialog).queryByRole('button', { name: '재작성' })).toBeNull()
    await flushPending()
    expect(mockedEdit).not.toHaveBeenCalled()
  })

  it('TC-CH-040: (부품) 본문이 코드 포인트 20자를 넘으면 앞 20자 + …', () => {
    const long = msg({
      id: 200,
      text: '가나다라마바사아자차카타파하가나다라마바사아',
      createdAt: at(16, 42),
    })
    render(
      <MessageMenuSheet
        message={long}
        isWriteBusy={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('dialog', { name: '메시지 메뉴' }).querySelector('p')?.textContent,
    ).toBe('미샤 · 16:42  "가나다라마바사아자차카타파하가나다라마바…"')
  })

  it('TC-CH-041: 취소·Esc·덮개 → 닫힘, 포커스가 연 말풍선으로 / Tab·Shift+Tab 순환', async () => {
    renderChat()
    await screen.findByRole('log')
    const user = userEvent.setup()
    const target = bubbleOf(103)
    const open = async () => {
      target.focus()
      await user.keyboard('{Shift>}{F10}{/Shift}')
      return screen.getByRole('dialog', { name: '메시지 메뉴' })
    }

    let dialog = await open()
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '수정' }))
    await user.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(target)

    await open()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(target)

    dialog = await open()
    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(target)

    dialog = await open()
    const [edit, del, cancel] = within(dialog).getAllByRole('button')
    await user.tab()
    expect(document.activeElement).toBe(del)
    await user.tab()
    expect(document.activeElement).toBe(cancel)
    await user.tab()
    expect(document.activeElement).toBe(edit)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(cancel)
    expect(mockedEdit).not.toHaveBeenCalled()
    expect(mockedDelete).not.toHaveBeenCalled()
  })
})

describe('인라인 수정 (R-CHAT-007 · R-MSG-004)', () => {
  it('TC-CH-042: 수정 → 시트 닫힘, 편집기 = 원문·포커스·커서 끝, 저장 활성 조건', async () => {
    renderChat()
    await screen.findByRole('log')
    const { box, save } = await openEditor()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(box.value).toBe('나도 한 잔 부탁해요.')
    expect(document.activeElement).toBe(box)
    expect(box.selectionStart).toBe(box.value.length)
    expect(box.selectionEnd).toBe(box.value.length)
    expect(save.disabled).toBe(true)
    fireEvent.change(box, { target: { value: '나도 한 잔 부탁해요!' } })
    expect(save.disabled).toBe(false)
    fireEvent.change(box, { target: { value: '   ' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(box, { target: { value: 'a'.repeat(2001) } })
    expect(save.disabled).toBe(true)
    expect(items()).toHaveLength(4)
    expect(screen.getByRole('group', { name: '메시지 작성' })).not.toBeNull()
    await flushPending()
    expect(mockedEdit).not.toHaveBeenCalled()
  })

  it('TC-CH-043: 저장 → 대기 중 잠금·Esc 무시 → 응답 본문 반영, 편집기 없음, 히스토리 포커스', async () => {
    const pending = deferred<Result<Message>>()
    mockedEdit.mockReturnValueOnce(pending.promise)
    renderChat()
    await screen.findByRole('log')
    const { user, box, save, cancel } = await openEditor()
    fireEvent.change(box, { target: { value: '새 본문' } })
    await user.click(save)

    expect(save.disabled).toBe(true)
    expect(cancel.disabled).toBe(true)
    expect(box.readOnly).toBe(true)
    box.focus()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('group', { name: '메시지 수정' })).not.toBeNull()

    await act(async () => {
      pending.resolve(ok({ ...M103, text: '새 본문' }))
    })
    expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()
    expect(items()[2]?.textContent).toContain('새 본문')
    expect(document.activeElement).toBe(screen.getByRole('log'))
    expect(mockedEdit.mock.calls).toEqual([[103, { text: '새 본문' }]])
  })

  it.each([
    ['INTERNAL', ERROR_MESSAGES.INTERNAL],
    ['NOT_FOUND', '메시지를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.'],
  ] as const)('TC-CH-044: 수정 실패 %s → 편집기·입력 유지, 토스트', async (code, text) => {
    mockedEdit.mockResolvedValueOnce(fail(code))
    const { onAuthFailure } = renderChat()
    await screen.findByRole('log')
    const { user, box, save } = await openEditor()
    fireEvent.change(box, { target: { value: '새 본문' } })
    await user.click(save)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(text)
    expect(alert.classList.contains('danger')).toBe(true)
    expect(
      (screen.getByRole('textbox', { name: '수정할 내용' }) as HTMLTextAreaElement).value,
    ).toBe('새 본문')
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(mockedEdit).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-044: 취소 버튼·Esc → 원문 말풍선, 히스토리 포커스, editMessage 0회', async () => {
    renderChat()
    await screen.findByRole('log')
    let editor = await openEditor()
    fireEvent.change(editor.box, { target: { value: '새 본문' } })
    await editor.user.click(editor.cancel)
    expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()
    expect(items()[2]?.textContent).toContain('나도 한 잔 부탁해요.')
    expect(document.activeElement).toBe(screen.getByRole('log'))

    editor = await openEditor()
    fireEvent.change(editor.box, { target: { value: '새 본문' } })
    editor.box.focus()
    await editor.user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()
    expect(items()[2]?.textContent).toContain('나도 한 잔 부탁해요.')
    await flushPending()
    expect(mockedEdit).not.toHaveBeenCalled()
  })
})

describe('메시지 삭제 (R-CHAT-007 · R-MSG-005)', () => {
  it('TC-CH-045: 확인 시트 문구·첫 포커스 취소 → 취소 0회 → 삭제 대기 중 잠금 → 제거·히스토리 포커스', async () => {
    const pending = deferred<Result<void>>()
    mockedDelete.mockReturnValueOnce(pending.promise)
    renderChat()
    await screen.findByRole('log')
    let { user, confirm } = await openConfirm()

    expect(confirm.textContent).toContain('삭제한 메시지는 되돌릴 수 없습니다.')
    expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: '취소' }))
    await user.click(within(confirm).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(items()).toHaveLength(4)
    await flushPending()
    expect(mockedDelete).not.toHaveBeenCalled()

    ;({ user, confirm } = await openConfirm())
    await user.click(within(confirm).getByRole('button', { name: '삭제' }))
    for (const b of within(confirm).getAllByRole('button'))
      expect((b as HTMLButtonElement).disabled).toBe(true)
    await act(async () => {
      pending.resolve(ok(undefined))
    })
    expect(items()).toHaveLength(3)
    expect(screen.queryByText('나도 한 잔 부탁해요.')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('log'))
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    expect(mockedDelete.mock.calls).toEqual([[103]])
  })

  it('TC-CH-046: (a) INTERNAL → 말풍선 유지, 시트 닫힘, 토스트', async () => {
    mockedDelete.mockResolvedValueOnce(fail('INTERNAL'))
    const { onAuthFailure } = renderChat()
    await screen.findByRole('log')
    const { user, confirm } = await openConfirm()
    await user.click(within(confirm).getByRole('button', { name: '삭제' }))
    expect((await screen.findByRole('alert')).textContent).toBe(ERROR_MESSAGES.INTERNAL)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(items()).toHaveLength(4)
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(mockedDelete.mock.calls).toEqual([[103]])
  })

  it('TC-CH-046: (b) NOT_FOUND → 말풍선 제거, 토스트 없음', async () => {
    mockedDelete.mockResolvedValueOnce(fail('NOT_FOUND'))
    renderChat()
    await screen.findByRole('log')
    const { user, confirm } = await openConfirm()
    await user.click(within(confirm).getByRole('button', { name: '삭제' }))
    await vi.waitFor(() => expect(items()).toHaveLength(3))
    await flushPending()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(mockedDelete).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-046: (c) 마지막 1개 삭제 + hasMore → listMessages(r1) 재호출 → 맨 아래 배치(저장 거리 무시)', async () => {
    installScrollMock()
    localStorage.setItem('ld:scroll:r1', '300')
    const only = msg({ id: 101, speaker: 'ciel', text: '세바스찬, 홍차.', authorName: null })
    mockedList.mockReset()
    mockedList.mockResolvedValueOnce(ok({ messages: [only], hasMore: true }))
    mockedList.mockResolvedValueOnce(
      ok({ messages: [msg({ id: 90, text: '이전 대화' })], hasMore: false }),
    )
    mockedDelete.mockResolvedValueOnce(ok(undefined))
    renderChat()
    const log = await screen.findByRole('log')
    expect(log.scrollTop).toBe(2207)

    fireEvent.contextMenu(log.querySelector('[aria-haspopup="dialog"]') as HTMLElement)
    const user = userEvent.setup()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '삭제' }))

    expect(await screen.findByText('이전 대화')).not.toBeNull()
    expect(screen.getByRole('log').scrollTop).toBe(2507)
    expect(mockedList).toHaveBeenCalledTimes(2)
    expect(mockedList.mock.calls[1]).toEqual(['r1'])
  })

  it('TC-CH-046: (d) 마지막 1개 삭제 + hasMore=false → 재호출 없이 "아직 대화가 없습니다"', async () => {
    mockedList.mockReset()
    mockedList.mockResolvedValueOnce(
      ok({
        messages: [msg({ id: 101, speaker: 'ciel', text: '세바스찬, 홍차.', authorName: null })],
        hasMore: false,
      }),
    )
    mockedDelete.mockResolvedValueOnce(ok(undefined))
    renderChat()
    const log = await screen.findByRole('log')
    fireEvent.contextMenu(log.querySelector('[aria-haspopup="dialog"]') as HTMLElement)
    const user = userEvent.setup()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '삭제' }))

    await vi.waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('아직 대화가 없습니다'),
    )
    await flushPending()
    expect(mockedList).toHaveBeenCalledTimes(1)
  })
})

describe('쓰기 직렬화 (R-CHAT-007 · R-CHAT-006, D-5 · D-10)', () => {
  it('TC-CH-054: (a) 전송 대기 중 contextmenu·롱프레스 → 메뉴 없음, ⋯ disabled', async () => {
    const pending = deferred<Result<Message>>()
    mockedAppend.mockReturnValueOnce(pending.promise)
    renderChat()
    await screen.findByRole('log')
    fireEvent.change(screen.getByRole('textbox', { name: '메시지 입력' }), {
      target: { value: '안녕' },
    })
    fireEvent.click(screen.getByRole('button', { name: '전송' }))

    fireEvent.contextMenu(bubbleOf(103))
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.pointer({ keys: '[MouseLeft>]', target: bubbleOf(103) })
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      (screen.getByRole('button', { name: '방 메뉴 열기' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(mockedAppend).toHaveBeenCalledTimes(1)
    expect(mockedEdit).not.toHaveBeenCalled()
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('TC-CH-054: (b) 수정 저장 대기 중 하단 입력은 가능, 전송·⋯ disabled', async () => {
    const pending = deferred<Result<Message>>()
    mockedEdit.mockReturnValueOnce(pending.promise)
    renderChat()
    await screen.findByRole('log')
    const { user, box, save } = await openEditor()
    fireEvent.change(box, { target: { value: '새 본문' } })
    await user.click(save)

    const composerInput = screen.getByRole('textbox', {
      name: '메시지 입력',
    }) as HTMLTextAreaElement
    await user.type(composerInput, 'x')
    expect(composerInput.value).toBe('x')
    expect((screen.getByRole('button', { name: '전송' }) as HTMLButtonElement).disabled).toBe(true)
    expect(
      (screen.getByRole('button', { name: '방 메뉴 열기' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    await flushPending()
    expect(mockedEdit).toHaveBeenCalledTimes(1)
    expect(mockedAppend).not.toHaveBeenCalled()
  })

  it.each([
    [true, [true, true, false]],
    [false, [false, false, false]],
  ])(
    'TC-CH-054: (d) MessageMenuSheet isWriteBusy=%s → 수정·삭제·취소 disabled = %j',
    (busy, expected) => {
      render(
        <MessageMenuSheet
          message={M103}
          isWriteBusy={busy}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onClose={vi.fn()}
        />,
      )
      const buttons = within(screen.getByRole('dialog')).getAllByRole(
        'button',
      ) as HTMLButtonElement[]
      expect(buttons.map(b => b.disabled)).toEqual(expected)
    },
  )
})
