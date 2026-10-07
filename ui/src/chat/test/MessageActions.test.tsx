/**
 * chat S3e 말풍선 액션 버튼 화면 통합 스펙 초안(TDD Red) — 단일 소스 ui/src/chat/test/scenarios.md v0.9
 * (신규 TC-CH-110 · 111 · 113 · 114 · 115 · 116 · 117 · 118 · 119 화면 단위 /
 *  개정 TC-CH-042 · 043 · 044 · 045 · 046 · 054 (a)(b) — 옛 BubbleMenu.test.tsx 에서 옮김, 진입 = 버튼)
 * 설계 정본: ui/src/chat/design/actions.md v2.0 — AC §2 배선 · §3 메뉴 제거 · §4 표시·비활성(isActionLocked) ·
 *   §5 F-CH-46~52 · §6 파이프라인 · §7 포커스·접근성 · §8 문구
 * - 옛 BubbleMenu.test.tsx(메뉴 전제: contextmenu·롱프레스·Shift+F10·MessageMenuSheet)는 이 파일과
 *   BubbleActions.test.tsx 로 대체한다. 옛 파일 삭제는 ui-implementer 몫(scenarios.md v0.9 「S3e 공통 전제」).
 * - 토큰은 viewer props 로만. api 래퍼는 vi.mock('@/api/messages'·'@/api/rooms'). fetch 모킹 금지.
 * - speak·regenerate 기본값 = 영원히 대기. 응답은 deferred 를 act 안에서 직접 resolve(실제 sleep 없음).
 *   가짜 시계는 TC-CH-113 의 600ms 누름 구간에만 쓰고, 그 구간에서는 findBy*·waitFor 를 쓰지 않는다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { USER_DISPLAY_NAME } from '@shared/characters'
import { ERROR_MESSAGES } from '@shared/errors'
import type { Message, MessagesPage, RoomSummary } from '@shared/types'
import type { ApiErrorCode, Result } from '@/api'
import {
  appendUser,
  deleteMessage,
  editMessage,
  listMessages,
  regenerate,
  speak,
} from '@/api/messages'
import { createRoom, deleteRoom, listRooms, renameRoom } from '@/api/rooms'
import { ChatScreen } from '@/chat'
import { WRITER_VIEWER } from '@/state/viewer'

vi.mock('@/api/messages', () => ({
  listMessages: vi.fn(),
  appendUser: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
  speak: vi.fn(),
  regenerate: vi.fn(),
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
const mockedSpeak = vi.mocked(speak)
const mockedRegenerate = vi.mocked(regenerate)
const mockedRename = vi.mocked(renameRoom)
const allMocks = [
  mockedList,
  mockedAppend,
  mockedEdit,
  mockedDelete,
  mockedSpeak,
  mockedRegenerate,
  vi.mocked(listRooms),
  vi.mocked(createRoom),
  mockedRename,
  vi.mocked(deleteRoom),
]

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
  authorName: USER_DISPLAY_NAME,
  createdAt: at(16, 40),
  ...over,
})
/** 기본 픽스처: 시엘 · 세바스찬 · 유저 · OOC(마지막이 OOC → 재작성 대상 없음) */
const M101 = msg({ id: 101, speaker: 'ciel', text: '세바스찬, 홍차.', authorName: null })
const M102 = msg({
  id: 102,
  speaker: 'sebastian',
  text: '예, 도련님.',
  authorName: null,
  createdAt: at(16, 41),
})
const M103 = msg({ id: 103, text: '나도 한 잔 부탁해요.', createdAt: at(16, 42) })
const M104 = msg({ id: 104, kind: 'ooc', text: '둘이 체스를 둔다', createdAt: at(16, 43) })
const PAGE: MessagesPage = { messages: [M101, M102, M103, M104], hasMore: false }
/** 재작성 픽스처(Regenerate.test 와 같은 번호): 마지막 = 세바스찬 line 72 */
const M70 = msg({ id: 70, speaker: 'ciel', text: '세바스찬, 홍차?', authorName: null })
const M71 = msg({ id: 71, kind: 'ooc', text: '둘이 체스를 둔다.', createdAt: at(16, 41) })
const M72 = msg({
  id: 72,
  speaker: 'sebastian',
  text: '분부대로 하겠습니다, 도련님.',
  authorName: null,
  createdAt: at(16, 42),
})
const M72_NEW: Message = { ...M72, text: '물론입니다. 오늘 일정부터 말씀드리지요.' }
const M73 = msg({ id: 73, text: '나도 한 잔.', createdAt: at(16, 43) })
const M74 = msg({ id: 74, kind: 'ooc', text: '창밖에 안개.', createdAt: at(16, 44) })
const REGEN_PAGE: MessagesPage = { messages: [M70, M71, M72], hasMore: false }
const SENT = msg({ id: 105, text: '안녕', createdAt: at(16, 44) })
const SEB_REPLY = msg({
  id: 106,
  speaker: 'sebastian',
  text: '분부대로 하겠습니다.',
  authorName: null,
  createdAt: at(16, 45),
})
const USER_NAME = USER_DISPLAY_NAME
const REGEN_FAILED = '대사를 다시 만들지 못했습니다. 재작성을 다시 눌러 주세요.'

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
const never = () => new Promise<Result<Message>>(() => {})
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
const lastItem = () => items()[items().length - 1] as HTMLElement
/** li 안 Bubble 루트(모듈 클래스 root) — 버튼 줄은 그 다음 형제다(D-28) */
const rootIn = (li: HTMLElement) => li.querySelector('.root') as HTMLElement
const btn = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const input = () => screen.getByRole('textbox', { name: '메시지 입력' }) as HTMLTextAreaElement
const groupOf = (name: string) => screen.getByRole('group', { name: `${name} 말풍선 작업` })
const actionOf = (name: string, action: '수정' | '재작성' | '삭제') =>
  within(groupOf(name)).getByRole('button', { name: `${name} 대사 ${action}` }) as HTMLButtonElement
const actionGroups = () => screen.queryAllByRole('group', { name: /말풍선 작업$/ })
const actionButtons = () =>
  actionGroups().flatMap(g => within(g).getAllByRole('button') as HTMLButtonElement[])
const writeCalls = () => [mockedEdit, mockedDelete, mockedRegenerate].map(m => m.mock.calls.length)
const openEditor = async (name: string = USER_NAME) => {
  const user = userEvent.setup()
  await user.click(actionOf(name, '수정'))
  const group = screen.getByRole('group', { name: '메시지 수정' })
  const box = within(group).getByRole('textbox', { name: '수정할 내용' }) as HTMLTextAreaElement
  const save = within(group).getByRole('button', { name: '저장' }) as HTMLButtonElement
  const cancel = within(group).getByRole('button', { name: '취소' }) as HTMLButtonElement
  return { user, group, box, save, cancel }
}
const openConfirm = async (name: string = USER_NAME) => {
  const user = userEvent.setup()
  await user.click(actionOf(name, '삭제'))
  return { user, confirm: screen.getByRole('alertdialog', { name: '이 메시지를 삭제할까요?' }) }
}
const typeAndSend = (text = '안녕') => {
  fireEvent.change(input(), { target: { value: text } })
  fireEvent.click(btn('전송'))
}
/**
 * 「재작성」 누름. 브라우저는 disabled 가 된 버튼의 포커스를 body 로 빼지만 jsdom 은 그러지 않는다(DC-05).
 * 그래서 누르기 전에 포커스를 비우고 포커스 이동 없는 클릭(fireEvent)으로 누른다 = 브라우저의 "포커스를 잃은" 상태.
 */
const pressRegenerate = (name = '세바스찬') => {
  ;(document.activeElement as HTMLElement | null)?.blur()
  fireEvent.click(actionOf(name, '재작성'))
}
const expectActionsLocked = (locked: boolean) => {
  const buttons = actionButtons()
  expect(buttons.length).toBeGreaterThan(0)
  for (const b of buttons) expect(b.disabled).toBe(locked)
}
/** 모든 버튼 줄 버튼을 눌러도 래퍼 추가 호출·편집기·확인 시트가 생기지 않는다 */
const pressAllAndExpectNothing = async () => {
  const before = writeCalls()
  const editors = screen.queryAllByRole('group', { name: '메시지 수정' }).length
  const confirms = screen.queryAllByRole('alertdialog').length
  for (const b of actionButtons()) fireEvent.click(b)
  await flushPending()
  expect(writeCalls()).toEqual(before)
  expect(screen.queryAllByRole('group', { name: '메시지 수정' })).toHaveLength(editors)
  expect(screen.queryAllByRole('alertdialog')).toHaveLength(confirms)
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
  for (const m of allMocks) m.mockReset()
  mockedList.mockResolvedValue(ok(PAGE))
  vi.mocked(listRooms).mockResolvedValue(ok([ROOM]))
  mockedSpeak.mockImplementation(never)
  mockedRegenerate.mockImplementation(never)
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

describe('버튼 줄 렌더 (R-CHAT-007 · R-CHAT-002 · R-CHAT-013)', () => {
  it('TC-CH-110: 토큰 있음 — 말풍선 4개마다 같은 li 안 Bubble 바로 뒤 형제로 group, 이름·버튼 순서·변형 클래스', async () => {
    renderChat()
    await screen.findByRole('log')
    const lis = items()
    expect(lis).toHaveLength(4)
    const expected = [
      ['시엘', 'ciel'],
      ['세바스찬', 'sebastian'],
      [USER_NAME, 'user'],
      ['[지시]', 'ooc'],
    ] as const
    expected.forEach(([name, key], i) => {
      const li = lis[i] as HTMLElement
      const g = within(li).getByRole('group', { name: `${name} 말풍선 작업` })
      expect(g.parentElement).toBe(li)
      expect(g.previousElementSibling).toBe(rootIn(li))
      expect(g.classList.contains('actions')).toBe(true)
      expect(g.classList.contains(key)).toBe(true)
      const buttons = within(g).getAllByRole('button')
      expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual([
        `${name} 대사 수정`,
        `${name} 대사 삭제`,
      ])
      expect(buttons.map(b => b.textContent)).toEqual(['수정', '삭제'])
      for (const b of buttons) expect((b as HTMLButtonElement).disabled).toBe(false)
    })
    expect(actionGroups()).toHaveLength(4)
    expect(Object.keys(localStorage)).toEqual(['ld:lastRoomId'])
    await flushPending()
    expect(mockedList.mock.calls).toEqual([['r1']])
    for (const m of [mockedAppend, mockedEdit, mockedDelete, mockedSpeak, mockedRegenerate])
      expect(m).not.toHaveBeenCalled()
  })
})

describe('「재작성」 표시 조건 — TC-CH-079 대체 (R-CHAT-007 · R-MSG-006)', () => {
  it.each<[string, MessagesPage, string | null]>([
    ['마지막이 세바스찬 line', REGEN_PAGE, '세바스찬'],
    ['마지막이 유저 line(세바스찬은 마지막 아님)', { messages: [M70, M72, M73], hasMore: false }, null],
    ['마지막이 OOC', { messages: [M70, M72, M74], hasMore: false }, null],
  ])('TC-CH-111: %s → 「재작성」은 %s 그룹에만', async (_label, page, owner) => {
    mockedList.mockResolvedValue(ok(page))
    renderChat()
    await screen.findByRole('log')
    const regens = screen.queryAllByRole('button', { name: /대사 재작성$/ })
    if (owner === null) {
      expect(regens).toHaveLength(0)
    } else {
      expect(regens).toHaveLength(1)
      expect(
        within(groupOf(owner))
          .getAllByRole('button')
          .map(b => b.textContent),
      ).toEqual(['수정', '재작성', '삭제'])
    }
    // 캐릭터지만 마지막 아님(70 시엘)
    expect(within(groupOf('시엘')).queryByRole('button', { name: /재작성/ })).toBeNull()
    await flushPending()
    expect(mockedRegenerate).not.toHaveBeenCalled()
  })

  it('TC-CH-111: 실패 말풍선이 목록 끝이어도 마지막 메시지가 캐릭터면 그 그룹에 「재작성」, 실패 li 에는 group 없음', async () => {
    mockedList.mockResolvedValue(ok(REGEN_PAGE))
    mockedSpeak.mockResolvedValueOnce(fail('LLM_FAILED'))
    renderChat()
    await screen.findByRole('log')
    fireEvent.click(btn('시엘 대사 생성'))
    await waitFor(() => expect(document.querySelectorAll('.failed')).toHaveLength(1))
    expect(
      within(groupOf('세바스찬'))
        .getAllByRole('button')
        .map(b => b.textContent),
    ).toEqual(['수정', '재작성', '삭제'])
    expect(within(lastItem()).queryAllByRole('group')).toHaveLength(0)
    expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'ciel' }]])
    expect(mockedRegenerate).not.toHaveBeenCalled()
  })
})

describe('말풍선 메뉴 제거 (R-CHAT-007)', () => {
  it('TC-CH-113: 쓰기 판 — 말풍선 루트에 tabIndex·aria-haspopup·aria-keyshortcuts·menuEnabled 없음, 우클릭·Shift+F10·600ms 누름 뒤에도 dialog 없음·기본 동작 유지', async () => {
    renderChat()
    const log = await screen.findByRole('log')
    for (const li of items()) {
      const root = rootIn(li)
      expect(root.getAttribute('tabindex')).toBeNull()
      expect(root.getAttribute('aria-haspopup')).toBeNull()
      expect(root.getAttribute('aria-keyshortcuts')).toBeNull()
      expect(root.classList.contains('menuEnabled')).toBe(false)
    }
    expect(log.querySelector('[aria-haspopup]')).toBeNull()

    const root = rootIn(items()[1] as HTMLElement)
    expect(fireEvent.contextMenu(root)).toBe(true) // preventDefault 되지 않음 = 브라우저 기본 동작
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fireEvent.keyDown(root, { key: 'F10', shiftKey: true })).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()

    vi.useFakeTimers()
    fireEvent.pointerDown(root)
    fireEvent.mouseDown(root)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    fireEvent.pointerUp(root)
    fireEvent.mouseUp(root)
    vi.useRealTimers()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('dialog', { name: '메시지 메뉴' })).toBeNull()
    await flushPending()
    expect(writeCalls()).toEqual([0, 0, 0])
  })
})

describe('비활성 — isActionLocked = !canSpeak ∨ roomBusy (R-CHAT-007 · R-CHAT-005)', () => {
  type Arm = () => Promise<() => Promise<void>>
  const LOCKS: [string, MessagesPage, Arm][] = [
    [
      '전송 저장 대기(send)',
      PAGE,
      async () => {
        const save = deferred<Result<Message>>()
        const gen = deferred<Result<Message>>()
        mockedAppend.mockReturnValueOnce(save.promise)
        mockedSpeak.mockReturnValueOnce(gen.promise)
        typeAndSend()
        return async () => {
          await act(async () => {
            save.resolve(ok(SENT))
          })
          await act(async () => {
            gen.resolve(ok(SEB_REPLY))
          })
        }
      },
    ],
    [
      '자동 응답 생성 대기(speak auto)',
      PAGE,
      async () => {
        const gen = deferred<Result<Message>>()
        mockedAppend.mockResolvedValueOnce(ok(SENT))
        mockedSpeak.mockReturnValueOnce(gen.promise)
        typeAndSend()
        await waitFor(() => expect(mockedSpeak).toHaveBeenCalledTimes(1))
        return async () => {
          await act(async () => {
            gen.resolve(ok(SEB_REPLY))
          })
        }
      },
    ],
    [
      '캐릭터 생성 대기(speak sebastian)',
      PAGE,
      async () => {
        const gen = deferred<Result<Message>>()
        mockedSpeak.mockReturnValueOnce(gen.promise)
        fireEvent.click(btn('세바스찬 대사 생성'))
        return async () => {
          await act(async () => {
            gen.resolve(ok(SEB_REPLY))
          })
        }
      },
    ],
    [
      '수정 저장 대기(edit)',
      PAGE,
      async () => {
        const save = deferred<Result<Message>>()
        mockedEdit.mockReturnValueOnce(save.promise)
        const editor = await openEditor()
        fireEvent.change(editor.box, { target: { value: '새 본문' } })
        await editor.user.click(editor.save)
        return async () => {
          await act(async () => {
            save.resolve(ok({ ...M103, text: '새 본문' }))
          })
        }
      },
    ],
    [
      '메시지 삭제 대기(delete)',
      PAGE,
      async () => {
        const del = deferred<Result<void>>()
        mockedDelete.mockReturnValueOnce(del.promise)
        const { user, confirm } = await openConfirm('세바스찬')
        await user.click(within(confirm).getByRole('button', { name: '삭제' }))
        return async () => {
          await act(async () => {
            del.resolve(ok(undefined))
          })
        }
      },
    ],
    [
      '재작성 대기(regenerate)',
      REGEN_PAGE,
      async () => {
        const d = deferred<Result<Message>>()
        mockedRegenerate.mockReturnValueOnce(d.promise)
        pressRegenerate()
        return async () => {
          await act(async () => {
            d.resolve(ok(M72_NEW))
          })
        }
      },
    ],
    [
      '방 이름 변경 대기(roomBusy)',
      PAGE,
      async () => {
        const d = deferred<Result<RoomSummary>>()
        mockedRename.mockReturnValueOnce(d.promise)
        const user = userEvent.setup()
        await user.click(btn('방 메뉴 열기'))
        await user.click(
          within(screen.getByRole('dialog', { name: '방 메뉴' })).getByRole('button', {
            name: '이름 변경',
          }),
        )
        const sheet = screen.getByRole('dialog', { name: '방 이름 변경' })
        const title = within(sheet).getByRole('textbox', { name: '방 이름' })
        await user.clear(title)
        await user.type(title, '팬텀하이브 저택의 밤')
        await user.click(within(sheet).getByRole('button', { name: '저장' }))
        return async () => {
          await act(async () => {
            d.resolve(ok({ ...ROOM, title: '팬텀하이브 저택의 밤' }))
          })
        }
      },
    ],
  ]

  it.each(LOCKS)(
    'TC-CH-114: %s → 모든 버튼 줄 disabled, 눌러도 editMessage·deleteMessage·regenerate 추가 0회·편집기·확인 시트 안 열림 → 응답 뒤 활성',
    async (_label, page, arm) => {
      mockedList.mockResolvedValue(ok(page))
      renderChat()
      await screen.findByRole('log')
      const release = await arm()
      expectActionsLocked(true)
      await pressAllAndExpectNothing()
      await release()
      await waitFor(() => expectActionsLocked(false))
    },
  )

  it('TC-CH-114: 다른 말풍선 인라인 수정 중 → 편집 중 말풍선엔 group 없음, 나머지 모든 버튼 disabled → 취소 뒤 4개 모두 활성', async () => {
    renderChat()
    await screen.findByRole('log')
    const { user, cancel } = await openEditor()
    expect(screen.queryByRole('group', { name: `${USER_NAME} 말풍선 작업` })).toBeNull()
    expect(actionGroups()).toHaveLength(3)
    expectActionsLocked(true)
    await pressAllAndExpectNothing()
    await user.click(cancel)
    expect(actionGroups()).toHaveLength(4)
    expectActionsLocked(false)
    expect(mockedEdit).not.toHaveBeenCalled()
  })

  it('TC-CH-114: 캐릭터 실패 말풍선만 있을 때는 활성(writing·editingId 없음)', async () => {
    mockedSpeak.mockResolvedValueOnce(fail('LLM_FAILED'))
    renderChat()
    await screen.findByRole('log')
    fireEvent.click(btn('세바스찬 대사 생성'))
    await waitFor(() => expect(document.querySelectorAll('.failed')).toHaveLength(1))
    expectActionsLocked(false)
    expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'sebastian' }]])
  })
})

describe('「수정」 — 인라인 수정 (R-CHAT-007 · R-MSG-004 · R-CHAT-013)', () => {
  it('TC-CH-042: 「수정」 → 시트 없이 편집기 = 원문·포커스·커서 끝, 그 말풍선 group 없음, 저장 활성 조건', async () => {
    renderChat()
    await screen.findByRole('log')
    const { box, save } = await openEditor()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('group', { name: `${USER_NAME} 말풍선 작업` })).toBeNull()
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

  it('TC-CH-043: 저장 → 대기 중 잠금·Esc 무시 → 응답 본문 반영, 편집기 없음, 포커스 = 그 말풍선 「수정」(TC-CH-115)', async () => {
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
    await waitFor(() => expect(document.activeElement).toBe(actionOf(USER_NAME, '수정')))
    expect(actionOf(USER_NAME, '수정').disabled).toBe(false)
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
    expect(screen.queryByRole('group', { name: `${USER_NAME} 말풍선 작업` })).toBeNull()
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(mockedEdit).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-044: 취소 버튼·Esc → 원문 말풍선, 포커스 = 그 말풍선 「수정」(TC-CH-115), editMessage 0회', async () => {
    renderChat()
    await screen.findByRole('log')
    let editor = await openEditor()
    fireEvent.change(editor.box, { target: { value: '새 본문' } })
    await editor.user.click(editor.cancel)
    expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()
    expect(items()[2]?.textContent).toContain('나도 한 잔 부탁해요.')
    await waitFor(() => expect(document.activeElement).toBe(actionOf(USER_NAME, '수정')))

    editor = await openEditor()
    fireEvent.change(editor.box, { target: { value: '새 본문' } })
    editor.box.focus()
    await editor.user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()
    expect(items()[2]?.textContent).toContain('나도 한 잔 부탁해요.')
    await waitFor(() => expect(document.activeElement).toBe(actionOf(USER_NAME, '수정')))
    await flushPending()
    expect(mockedEdit).not.toHaveBeenCalled()
  })

  it('TC-CH-115: 자동 응답 생성 중 편집 취소(S3d D-17) → 「수정」 disabled 라 포커스 = 히스토리 log → 생성 끝 뒤 활성, 포커스 그대로', async () => {
    const gen = deferred<Result<Message>>()
    mockedAppend.mockResolvedValueOnce(ok(SENT))
    mockedSpeak.mockReturnValueOnce(gen.promise)
    renderChat()
    const log = await screen.findByRole('log')
    const { user, cancel } = await openEditor()
    typeAndSend()
    await waitFor(() => expect(mockedSpeak).toHaveBeenCalledTimes(1))

    // 전송된 105도 유저(어떠한 의지)라 그룹 이름이 103과 같다 → 103 li(items()[2]) 안으로 범위를 좁힌다
    const editOf103 = () =>
      within(
        within(items()[2] as HTMLElement).getByRole('group', { name: `${USER_NAME} 말풍선 작업` }),
      ).getByRole('button', { name: `${USER_NAME} 대사 수정` }) as HTMLButtonElement
    await user.click(cancel)
    expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()
    expect(items()[2]?.textContent).toContain('나도 한 잔 부탁해요.')
    expect(editOf103().disabled).toBe(true)
    await waitFor(() => expect(document.activeElement).toBe(log))

    await act(async () => {
      gen.resolve(ok(SEB_REPLY))
    })
    expect(editOf103().disabled).toBe(false)
    expect(document.activeElement).toBe(log)
    expect(mockedEdit).not.toHaveBeenCalled()
    expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'auto' }]])
  })
})

describe('「삭제」 — 확인 시트 (R-CHAT-007 · R-MSG-005 · R-CHAT-013)', () => {
  it('TC-CH-045: 확인 시트 문구·첫 포커스 취소 → 취소 0회·포커스 = 그 「삭제」(TC-CH-116) → 삭제 대기 중 잠금 → 제거·포커스 = log', async () => {
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
    await waitFor(() => expect(document.activeElement).toBe(actionOf(USER_NAME, '삭제')))
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
    expect(screen.queryByRole('group', { name: `${USER_NAME} 말풍선 작업` })).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('log'))
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    expect(mockedDelete.mock.calls).toEqual([[103]])
  })

  it('TC-CH-046: (a) INTERNAL → 말풍선 유지, 시트 닫힘, 토스트, 포커스 = 그 「삭제」(TC-CH-116)', async () => {
    mockedDelete.mockResolvedValueOnce(fail('INTERNAL'))
    const { onAuthFailure } = renderChat()
    await screen.findByRole('log')
    const { user, confirm } = await openConfirm()
    await user.click(within(confirm).getByRole('button', { name: '삭제' }))
    expect((await screen.findByRole('alert')).textContent).toBe(ERROR_MESSAGES.INTERNAL)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(items()).toHaveLength(4)
    await waitFor(() => expect(document.activeElement).toBe(actionOf(USER_NAME, '삭제')))
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
    mockedList.mockReset()
    mockedList.mockResolvedValueOnce(ok({ messages: [M101], hasMore: true }))
    mockedList.mockResolvedValueOnce(
      ok({ messages: [msg({ id: 90, text: '이전 대화' })], hasMore: false }),
    )
    mockedDelete.mockResolvedValueOnce(ok(undefined))
    renderChat()
    const log = await screen.findByRole('log')
    expect(log.scrollTop).toBe(2207)

    const { user, confirm } = await openConfirm('시엘')
    await user.click(within(confirm).getByRole('button', { name: '삭제' }))

    expect(await screen.findByText('이전 대화')).not.toBeNull()
    expect(screen.getByRole('log').scrollTop).toBe(2507)
    expect(mockedList).toHaveBeenCalledTimes(2)
    expect(mockedList.mock.calls[1]).toEqual(['r1'])
    expect(mockedDelete.mock.calls).toEqual([[101]])
  })

  it('TC-CH-046: (d) 마지막 1개 삭제 + hasMore=false → 재호출 없이 "아직 대화가 없습니다"', async () => {
    mockedList.mockReset()
    mockedList.mockResolvedValueOnce(ok({ messages: [M101], hasMore: false }))
    mockedDelete.mockResolvedValueOnce(ok(undefined))
    renderChat()
    await screen.findByRole('log')
    const { user, confirm } = await openConfirm('시엘')
    await user.click(within(confirm).getByRole('button', { name: '삭제' }))

    await vi.waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('아직 대화가 없습니다'),
    )
    await flushPending()
    expect(mockedList).toHaveBeenCalledTimes(1)
  })
})

describe('「재작성」 — confirm 없음 (R-CHAT-007 · R-CHAT-005 · R-MSG-006 · R-CHAT-013)', () => {
  it('TC-CH-117: 「재작성」 → 시트 없이 regenerate(72) 1회 → 대상 흐림·aria-busy·다시 쓰는 중…, 모든 버튼 줄·캐릭터 버튼·전송 disabled → 200 → 본문 교체, 포커스 = 같은 「재작성」', async () => {
    mockedList.mockResolvedValue(ok(REGEN_PAGE))
    const d = deferred<Result<Message>>()
    mockedRegenerate.mockReturnValueOnce(d.promise)
    renderChat()
    await screen.findByRole('log')
    pressRegenerate()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mockedRegenerate.mock.calls).toEqual([[72]])
    const root = rootIn(items()[2] as HTMLElement)
    expect(root.classList.contains('regenerating')).toBe(true)
    expect((root.querySelector('.body') as HTMLElement).getAttribute('aria-busy')).toBe('true')
    expect(within(root).getByRole('status').textContent).toBe('다시 쓰는 중…')
    expectActionsLocked(true)
    for (const name of ['세바스찬 대사 생성', '시엘 대사 생성', '전송'])
      expect(btn(name).disabled).toBe(true)
    expect(document.activeElement).toBe(document.body)

    await act(async () => {
      d.resolve(ok(M72_NEW))
    })
    const after = items()[2] as HTMLElement
    expect(after.textContent).toContain('물론입니다. 오늘 일정부터 말씀드리지요.')
    expect(after.textContent).not.toContain('분부대로 하겠습니다, 도련님.')
    await waitFor(() => expect(document.activeElement).toBe(actionOf('세바스찬', '재작성')))
    expectActionsLocked(false)
    expect(mockedRegenerate).toHaveBeenCalledTimes(1)
    expect(mockedSpeak).not.toHaveBeenCalled()
    expect(mockedEdit).not.toHaveBeenCalled()
  })

  it('TC-CH-117: 대기 중 입력창으로 포커스를 옮겼으면 응답 뒤에도 입력창 그대로', async () => {
    mockedList.mockResolvedValue(ok(REGEN_PAGE))
    const d = deferred<Result<Message>>()
    mockedRegenerate.mockReturnValueOnce(d.promise)
    renderChat()
    await screen.findByRole('log')
    pressRegenerate()
    input().focus()
    await act(async () => {
      d.resolve(ok(M72_NEW))
    })
    await flushPending()
    expect(document.activeElement).toBe(input())
    expect(mockedRegenerate.mock.calls).toEqual([[72]])
  })

  it('TC-CH-117: LLM_FAILED → 토스트 "재작성을 다시 눌러 주세요"(D-30), 원 본문, 「재작성」 활성·포커스', async () => {
    mockedList.mockResolvedValue(ok(REGEN_PAGE))
    mockedRegenerate.mockResolvedValueOnce(fail('LLM_FAILED'))
    const { onAuthFailure } = renderChat()
    await screen.findByRole('log')
    pressRegenerate()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(REGEN_FAILED)
    expect(screen.queryByText(/메뉴에서/)).toBeNull()
    expect((items()[2] as HTMLElement).textContent).toContain('분부대로 하겠습니다, 도련님.')
    await waitFor(() => expect(document.activeElement).toBe(actionOf('세바스찬', '재작성')))
    expect(actionOf('세바스찬', '재작성').disabled).toBe(false)
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(mockedRegenerate.mock.calls).toEqual([[72]])
  })
})

describe('접근성 — Tab 순서 (R-CHAT-013 · R-CHAT-002)', () => {
  it('TC-CH-118: log → 말풍선마다 위→아래 「수정」 → 「삭제」 → 세바스찬 대사 생성, 말풍선 루트는 Tab 대상 아님', async () => {
    renderChat()
    const log = await screen.findByRole('log')
    const user = userEvent.setup()
    log.focus()
    const order = [
      '시엘 대사 수정',
      '시엘 대사 삭제',
      '세바스찬 대사 수정',
      '세바스찬 대사 삭제',
      `${USER_NAME} 대사 수정`,
      `${USER_NAME} 대사 삭제`,
      '[지시] 대사 수정',
      '[지시] 대사 삭제',
      '세바스찬 대사 생성',
    ]
    for (const name of order) {
      await user.tab()
      expect(document.activeElement).toBe(btn(name))
      // 말풍선 루트(div)는 Tab 대상이 아니다. 공용 Button 도 non-scoped 'root' 키라 클래스가 아니라 태그로 본다
      expect(document.activeElement?.tagName).toBe('BUTTON')
    }
    for (const g of actionGroups()) expect(g.getAttribute('role')).toBe('group')
    await flushPending()
    expect(writeCalls()).toEqual([0, 0, 0])
  })
})

describe('임시·실패 말풍선에는 버튼 줄 없음 (R-CHAT-005 · R-CHAT-007)', () => {
  it.each<[string, () => Promise<void>, number, string]>([
    [
      '캐릭터 생성 중',
      async () => {
        fireEvent.click(btn('세바스찬 대사 생성'))
      },
      0,
      'sebastian',
    ],
    [
      '중립 생성 중',
      async () => {
        mockedAppend.mockResolvedValueOnce(ok(SENT))
        typeAndSend()
        await waitFor(() => expect(document.querySelectorAll('.pending.neutral')).toHaveLength(1))
      },
      0,
      'auto',
    ],
    [
      '캐릭터 실패',
      async () => {
        mockedSpeak.mockResolvedValueOnce(fail('LLM_FAILED'))
        fireEvent.click(btn('세바스찬 대사 생성'))
        await waitFor(() => expect(document.querySelectorAll('.failed')).toHaveLength(1))
      },
      1,
      'sebastian',
    ],
    [
      '중립 실패',
      async () => {
        mockedAppend.mockResolvedValueOnce(ok(SENT))
        mockedSpeak.mockResolvedValueOnce(fail('LLM_FAILED'))
        typeAndSend()
        await waitFor(() => expect(document.querySelectorAll('.failed')).toHaveLength(1))
      },
      1,
      'auto',
    ],
  ])('TC-CH-119: %s → pending li 안 group 0개, 버튼은 「재시도」 %i개뿐', async (_l, arm, retries, character) => {
    renderChat()
    await screen.findByRole('log')
    await arm()
    const li = lastItem()
    expect(li.querySelector('.pending')).not.toBeNull()
    expect(within(li).queryAllByRole('group')).toHaveLength(0)
    const buttons = within(li).queryAllByRole('button')
    expect(buttons).toHaveLength(retries)
    if (retries === 1) expect(buttons[0]?.textContent).toBe('재시도')
    expect(mockedSpeak.mock.calls).toEqual([['r1', { character }]])
    expect(writeCalls()).toEqual([0, 0, 0])
  })
})

describe('쓰기 직렬화 — 버튼 줄 기준 (R-CHAT-007 · R-CHAT-006, D-5 · D-10 · D-27)', () => {
  it('TC-CH-054: (a) 전송 대기 중 → 모든 버튼 줄 disabled(옛 "메뉴 안 열림"), ⋯ disabled', async () => {
    const pending = deferred<Result<Message>>()
    mockedAppend.mockReturnValueOnce(pending.promise)
    renderChat()
    await screen.findByRole('log')
    typeAndSend()
    expectActionsLocked(true)
    fireEvent.click(actionOf(USER_NAME, '수정'))
    fireEvent.click(actionOf(USER_NAME, '삭제'))
    expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(btn('방 메뉴 열기').disabled).toBe(true)
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

    await user.type(input(), 'x')
    expect(input().value).toBe('x')
    expect(btn('전송').disabled).toBe(true)
    expect(btn('방 메뉴 열기').disabled).toBe(true)
    await flushPending()
    expect(mockedEdit).toHaveBeenCalledTimes(1)
    expect(mockedAppend).not.toHaveBeenCalled()
  })
})
