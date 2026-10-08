/**
 * chat S6 방 비밀번호 잠금 — 메뉴·시트·E18/E19 스펙 초안(TDD Red) — 단일 소스 ui/src/chat/test/scenarios.md v1.1
 * (TC-CH-140 ~ 149 · 156 · 157 · 160 · 162)
 * 설계 정본: ui/src/chat/design/lock.md(LK) v2.3.1 · design/lock-tests.md(LT)
 * 대상: RoomMenuSheet 「잠금」 · LockMenuSheet · PromptSheet(inputType='password' · placeholder) · ConfirmDialog(잠금 풀기)
 *   · useRoomActions setPassword/clearPassword · useRoomSheets onPasswordSet/onPasswordCleared/onFailure/onDeleted
 *   · useMessageWrites 메시지 id 래퍼 roomId(F-CH-72) · App 통합(TC-CH-162)
 * - 토큰: 화면 단위는 viewer props. 저장소(TC-CH-160)·App 통합(TC-CH-162)만 initToken('?t=test-token') → clearToken().
 * - api 래퍼는 vi.mock(@/api/messages · @/api/rooms · @/api/memory). fetch 모킹 금지. isAuthFailure 실물.
 * - setRoomPassword · clearRoomPassword · enterRoom · speak · regenerate · getMemory · putMemory 기본값 = 영원히 대기.
 *   TC 별 mock*Once 가 먼저 쓰인다. 응답은 resolve 된 mock 또는 deferred 를 act 안에서 resolve(실제 sleep·가짜 시계 없음).
 * - localStorage 는 jsdom 실물. 매 TC 전 clear() → resetRoomKeyCache() → (필요하면) 사전 증명 setItem → 렌더.
 * - 증명 값은 가짜 문자열(e1.k 등)만. 실제 형식·비밀값 금지.
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { USER_DISPLAY_NAME } from '@shared/characters'
import { ERROR_MESSAGES } from '@shared/errors'
import type { Message, MessagesPage, RoomSummary, SetRoomPasswordResponse } from '@shared/types'
import type { ApiErrorCode, Result } from '@/api'
import { getMemory, putMemory } from '@/api/memory'
import {
  appendUser,
  deleteMessage,
  editMessage,
  listMessages,
  regenerate,
  speak,
} from '@/api/messages'
import {
  clearRoomPassword,
  createRoom,
  deleteRoom,
  enterRoom,
  listRooms,
  renameRoom,
  setRoomPassword,
} from '@/api/rooms'
import { App } from '@/App'
import { ChatScreen } from '@/chat'
import { resetRoomKeyCache } from '@/state/roomKeys'
import { clearToken, initToken } from '@/state/token'
import { READ_ONLY_VIEWER, WRITER_VIEWER } from '@/state/viewer'

vi.mock('@/api/messages', () => ({
  listMessages: vi.fn(),
  appendUser: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
  speak: vi.fn(),
  regenerate: vi.fn(),
}))
// S6(LT §2): 잠금 래퍼 3종을 팩토리에 더한다 — 없으면 import 가 undefined 가 된다
vi.mock('@/api/rooms', () => ({
  listRooms: vi.fn(),
  createRoom: vi.fn(),
  renameRoom: vi.fn(),
  deleteRoom: vi.fn(),
  setRoomPassword: vi.fn(),
  clearRoomPassword: vi.fn(),
  enterRoom: vi.fn(),
}))
vi.mock('@/api/memory', () => ({
  getMemory: vi.fn(),
  putMemory: vi.fn(),
}))

const mockedList = vi.mocked(listMessages)
const mockedEdit = vi.mocked(editMessage)
const mockedDelete = vi.mocked(deleteMessage)
const mockedRegenerate = vi.mocked(regenerate)
const mockedSpeak = vi.mocked(speak)
const mockedListRooms = vi.mocked(listRooms)
const mockedDeleteRoom = vi.mocked(deleteRoom)
const mockedSetPw = vi.mocked(setRoomPassword)
const mockedClearPw = vi.mocked(clearRoomPassword)
const mockedEnter = vi.mocked(enterRoom)
const allMocks = [
  mockedList,
  vi.mocked(appendUser),
  mockedEdit,
  mockedDelete,
  mockedSpeak,
  mockedRegenerate,
  mockedListRooms,
  vi.mocked(createRoom),
  vi.mocked(renameRoom),
  mockedDeleteRoom,
  mockedSetPw,
  mockedClearPw,
  mockedEnter,
  vi.mocked(getMemory),
  vi.mocked(putMemory),
]
const lockMocks = [mockedSetPw, mockedClearPw, mockedEnter]

// ── 픽스처 ─────────────────────────────────────────────
const at = (h: number, m: number, d = 5): number => new Date(2026, 9, d, h, m).getTime()
const OPEN_ROOM: RoomSummary = {
  id: 'r1',
  title: '비밀 다과회',
  createdAt: at(9, 0),
  updatedAt: at(18, 0, 7),
  messageCount: 3,
  locked: false,
}
const LOCKED_ROOM: RoomSummary = { ...OPEN_ROOM, locked: true }
const msg = (over: Partial<Message> & Pick<Message, 'id'>): Message => ({
  roomId: 'r1',
  speaker: 'user',
  kind: 'line',
  text: '',
  authorName: USER_DISPLAY_NAME,
  createdAt: at(16, 40),
  ...over,
})
const M101 = msg({ id: 101, speaker: 'ciel', text: '세바스찬, 홍차.', authorName: null })
const M103 = msg({ id: 103, text: '나도 한 잔 부탁해요.', createdAt: at(16, 42) })
/** 마지막 = 세바스찬 line → 「재작성」 대상 */
const M104 = msg({
  id: 104,
  speaker: 'sebastian',
  text: '분부대로 하겠습니다.',
  authorName: null,
  createdAt: at(16, 44),
})
const PAGE: MessagesPage = { messages: [M101, M103, M104], hasMore: false }

const MORE = '방 메뉴 열기'
const BACK = '방 목록으로 돌아가기'
const NOTICE = '열람 전용 - 대화 참여는 등급 회원만'
const LEVEL_NOTICE = '대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.'
const KEYS = 'ld:roomKeys'
const LAST = 'ld:lastRoomId'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fail = (code: ApiErrorCode, retryAfterSec?: number): Result<never> => ({
  ok: false,
  error:
    retryAfterSec === undefined
      ? { code, message: 'SERVER-RAW-MESSAGE' }
      : { code, message: 'SERVER-RAW-MESSAGE', retryAfterSec },
})
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}
const never = <T,>() => new Promise<T>(() => {})
const flushPending = async () => {
  await act(async () => {})
}

// ── 저장소 도우미 ───────────────────────────────────────
const seedKeys = (entries: ReadonlyArray<readonly [string, string]>) => {
  localStorage.setItem(KEYS, JSON.stringify(entries))
}
const roomKeys = (): unknown => {
  const raw = localStorage.getItem(KEYS)
  return raw === null ? null : JSON.parse(raw)
}
const storageKeys = () =>
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) as string)
const storageValues = () => storageKeys().map(k => localStorage.getItem(k) ?? '')
const expectNoStoredText = (...texts: string[]) => {
  for (const v of storageValues()) for (const t of texts) expect(v.includes(t)).toBe(false)
}

// ── 렌더 하네스(App 의 replaceRoomInView · revokeWrite 흉내) ──────────
const Harness = (props: {
  initialRoom: RoomSummary
  initialViewer: typeof WRITER_VIEWER
  onBack: () => void
  onAuthFailure: () => void
  onRoomRenamed: (room: RoomSummary) => void
}) => {
  const [room, setRoom] = useState(props.initialRoom)
  const [viewer, setViewer] = useState(props.initialViewer)
  return (
    <ChatScreen
      room={room}
      viewer={viewer}
      onBack={props.onBack}
      onAuthFailure={() => {
        props.onAuthFailure()
        setViewer(READ_ONLY_VIEWER)
      }}
      onRoomRenamed={r => {
        props.onRoomRenamed(r)
        setRoom(r)
      }}
    />
  )
}
const renderChat = (room: RoomSummary = OPEN_ROOM, viewer = WRITER_VIEWER) => {
  const onBack = vi.fn()
  const onAuthFailure = vi.fn()
  const onRoomRenamed = vi.fn()
  render(
    <Harness
      initialRoom={room}
      initialViewer={viewer}
      onBack={onBack}
      onAuthFailure={onAuthFailure}
      onRoomRenamed={onRoomRenamed}
    />,
  )
  return { onBack, onAuthFailure, onRoomRenamed }
}

const moreButton = () => screen.getByRole('button', { name: MORE }) as HTMLButtonElement
const openRoomMenu = async () => {
  const user = userEvent.setup()
  await screen.findByRole('log')
  await user.click(moreButton())
  return { user, menu: screen.getByRole('dialog', { name: '방 메뉴' }) }
}
const openSetSheet = async () => {
  const { user, menu } = await openRoomMenu()
  await user.click(within(menu).getByRole('button', { name: '잠금' }))
  const sheet = screen.getByRole('dialog', { name: '비밀번호 걸기' })
  const input = within(sheet).getByLabelText('새 비밀번호') as HTMLInputElement
  const save = within(sheet).getByRole('button', { name: '잠그기' }) as HTMLButtonElement
  const cancel = within(sheet).getByRole('button', { name: '취소' }) as HTMLButtonElement
  return { user, sheet, input, save, cancel }
}
const openLockMenu = async () => {
  const { user, menu } = await openRoomMenu()
  await user.click(within(menu).getByRole('button', { name: '잠금' }))
  return { user, lockMenu: screen.getByRole('dialog', { name: '잠금 메뉴' }) }
}
const openUnlockConfirm = async () => {
  const { user, lockMenu } = await openLockMenu()
  await user.click(within(lockMenu).getByRole('button', { name: '잠금 풀기' }))
  return { user, confirm: screen.getByRole('alertdialog', { name: '잠금을 풀까요?' }) }
}
const typePassword = (input: HTMLInputElement, value: string) => {
  fireEvent.change(input, { target: { value } })
}
const groupOf = (name: string) => screen.getByRole('group', { name: `${name} 말풍선 작업` })
const actionOf = (name: string, action: '수정' | '재작성' | '삭제') =>
  within(groupOf(name)).getByRole('button', { name: `${name} 대사 ${action}` }) as HTMLButtonElement
const actionButtons = () =>
  screen
    .queryAllByRole('group', { name: /말풍선 작업$/ })
    .flatMap(g => within(g).getAllByRole('button') as HTMLButtonElement[])

beforeEach(() => {
  for (const m of allMocks) m.mockReset()
  mockedList.mockResolvedValue(ok(PAGE))
  for (const m of [mockedSetPw, mockedClearPw, mockedEnter, mockedSpeak, mockedRegenerate])
    m.mockImplementation(() => never())
  vi.mocked(getMemory).mockImplementation(() => never())
  vi.mocked(putMemory).mockImplementation(() => never())
  localStorage.clear()
  resetRoomKeyCache()
  clearToken()
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
  clearToken()
  localStorage.clear()
  resetRoomKeyCache()
})

describe('⋯ 방 메뉴 「잠금」 (R-CHAT-001 S6 개정 · R-LOCK-002)', () => {
  it('TC-CH-140: (a) 토큰 있음 → 방 메뉴 5항목 순서, 「잠금」 default 톤 · 「방 삭제」 danger, 잠금 래퍼 0회', async () => {
    renderChat(OPEN_ROOM)
    const { user, menu } = await openRoomMenu()
    expect(menu.querySelector('p')?.textContent).toBe('방 메뉴 · 비밀 다과회')
    expect(
      within(menu)
        .getAllByRole('button')
        .map(b => b.textContent),
    ).toEqual(['이름 변경', '장기기억', '잠금', '방 삭제', '취소'])
    expect(within(menu).getByRole('button', { name: '잠금' }).closest('.danger')).toBeNull()
    expect(within(menu).getByRole('button', { name: '방 삭제' }).closest('.danger')).not.toBeNull()
    await user.click(within(menu).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await flushPending()
    for (const m of lockMocks) expect(m).not.toHaveBeenCalled()
  })

  it('TC-CH-140: (b) 토큰 없음 → ⋯·「잠금」 DOM 없음, 시트 0, 잠금 래퍼 0회', async () => {
    renderChat(OPEN_ROOM, READ_ONLY_VIEWER)
    await screen.findByRole('log')
    await flushPending()
    expect(screen.queryByRole('button', { name: MORE })).toBeNull()
    expect(screen.queryByRole('button', { name: '잠금' })).toBeNull()
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
    for (const m of lockMocks) expect(m).not.toHaveBeenCalled()
  })

  it('TC-CH-141: 안 잠긴 방 → 「비밀번호 걸기」 시트(password · new-password · placeholder · 0/32 · 입력 포커스 · 잠그기 disabled)', async () => {
    renderChat(OPEN_ROOM)
    const { sheet, input, save, cancel } = await openSetSheet()
    expect(screen.queryByRole('dialog', { name: '방 메뉴' })).toBeNull()
    expect(within(sheet).getByRole('heading', { level: 2 }).textContent).toBe('비밀번호 걸기')
    expect(input.getAttribute('type')).toBe('password')
    expect(input.getAttribute('autocomplete')).toBe('new-password')
    expect(input.getAttribute('placeholder')).toBe('6자 이상 권장')
    expect(within(sheet).getByText('0/32')).not.toBeNull()
    expect(document.activeElement).toBe(input)
    expect(save.disabled).toBe(true)
    expect(cancel.disabled).toBe(false)
    expect(within(sheet).queryByRole('alert')).toBeNull()
    expect(localStorage.getItem(KEYS)).toBeNull()
    await flushPending()
    for (const m of lockMocks) expect(m).not.toHaveBeenCalled()
  })

  it('TC-CH-142: 길이 경계 — 3 disabled · 4 · 32 활성 · 33 over+aria-invalid · trim 없음 · 코드 포인트', async () => {
    renderChat(OPEN_ROOM)
    const { sheet, input, save } = await openSetSheet()
    const rows: ReadonlyArray<readonly [string, string, boolean]> = [
      ['abc', '3/32', false],
      ['abcd', '4/32', true],
      ['a'.repeat(32), '32/32', true],
      ['a'.repeat(33), '33/32', false],
      [' ab ', '4/32', true],
      [String.fromCodePoint(0x1f375).repeat(4), '4/32', true],
    ]
    for (const [value, counter, enabled] of rows) {
      typePassword(input, value)
      const counterEl = within(sheet).getByText(counter)
      expect(save.disabled).toBe(!enabled)
      if (value.length === 33) {
        expect(counterEl.classList.contains('over')).toBe(true)
        expect(input.getAttribute('aria-invalid')).toBe('true')
      } else {
        expect(counterEl.classList.contains('over')).toBe(false)
        expect(input.getAttribute('aria-invalid')).not.toBe('true')
      }
    }
    await flushPending()
    expect(mockedSetPw).not.toHaveBeenCalled()
  })

  it('TC-CH-143: 잠그기 성공 → 증명 저장 · 방 갱신(locked true) · 시트 닫힘 · success 토스트 · ⋯ 포커스 · 원문 미저장', async () => {
    const res: SetRoomPasswordResponse = { room: LOCKED_ROOM, entryKey: 'e1.k' }
    mockedSetPw.mockResolvedValueOnce(ok(res))
    const { onRoomRenamed } = renderChat(OPEN_ROOM)
    const { user, input, save } = await openSetSheet()
    typePassword(input, 'abcd')
    await user.click(save)

    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toBe('방을 잠갔습니다.')
    expect(toast.classList.contains('success')).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(moreButton())
    expect(roomKeys()).toEqual([['r1', 'e1.k']])
    expectNoStoredText('abcd')
    expect(onRoomRenamed.mock.calls).toEqual([[LOCKED_ROOM]])
    expect(mockedSetPw.mock.calls).toEqual([['r1', 'abcd']])
    expect(mockedClearPw).not.toHaveBeenCalled()
    expect(mockedEnter).not.toHaveBeenCalled()
  })

  it('TC-CH-144: 잠긴 방 → 잠금 시트(이름·머리·항목 3개, 「잠금 풀기」 default 톤) → 취소 뒤 ⋯ 포커스, 요청 0회', async () => {
    renderChat(LOCKED_ROOM)
    const { user, lockMenu } = await openLockMenu()
    expect(screen.queryByRole('dialog', { name: '비밀번호 걸기' })).toBeNull()
    expect(lockMenu.querySelector('p')?.textContent).toBe('잠금 · 비밀 다과회')
    expect(
      within(lockMenu)
        .getAllByRole('button')
        .map(b => b.textContent),
    ).toEqual(['비밀번호 바꾸기', '잠금 풀기', '취소'])
    expect(within(lockMenu).getByRole('button', { name: '잠금 풀기' }).closest('.danger')).toBeNull()
    await user.click(within(lockMenu).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(moreButton())
    await flushPending()
    for (const m of lockMocks) expect(m).not.toHaveBeenCalled()
  })

  it('TC-CH-145: 비밀번호 바꾸기 → 바꾸기 판 문구 → 새 증명이 옛 증명을 덮음 · 토스트 「비밀번호를 바꿨습니다.」', async () => {
    seedKeys([['r1', 'e1.o']])
    mockedSetPw.mockResolvedValueOnce(ok({ room: LOCKED_ROOM, entryKey: 'e1.n' }))
    const { onRoomRenamed } = renderChat(LOCKED_ROOM)
    const { user, lockMenu } = await openLockMenu()
    await user.click(within(lockMenu).getByRole('button', { name: '비밀번호 바꾸기' }))
    const sheet = screen.getByRole('dialog', { name: '비밀번호 바꾸기' })
    const input = within(sheet).getByLabelText('새 비밀번호') as HTMLInputElement
    expect(input.getAttribute('placeholder')).toBe('6자 이상 권장')
    expect(within(sheet).getByText('0/32')).not.toBeNull()
    expect(within(sheet).queryByRole('button', { name: '잠그기' })).toBeNull()
    typePassword(input, 'newpass')
    await user.click(within(sheet).getByRole('button', { name: '바꾸기' }))

    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toBe('비밀번호를 바꿨습니다.')
    expect(toast.classList.contains('success')).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(roomKeys()).toEqual([['r1', 'e1.n']])
    expectNoStoredText('newpass')
    expect(onRoomRenamed.mock.calls).toEqual([[LOCKED_ROOM]])
    expect(mockedSetPw.mock.calls).toEqual([['r1', 'newpass']])
  })

  it('TC-CH-146: (a) 잠금 풀기 확인 문구·첫 포커스 취소 → 취소·Esc 는 요청 없음', async () => {
    seedKeys([['r1', 'e1.k']])
    renderChat(LOCKED_ROOM)
    const { user, confirm } = await openUnlockConfirm()
    expect(confirm.textContent).toContain('잠금을 풀면 누구나 이 방 대화를 볼 수 있습니다.')
    expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: '취소' }))
    await user.click(within(confirm).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()

    const again = await openUnlockConfirm()
    await again.user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await flushPending()
    expect(mockedClearPw).not.toHaveBeenCalled()
    expect(roomKeys()).toEqual([['r1', 'e1.k']])
  })

  it('TC-CH-146: (b) 풀기 → clearRoomPassword(r1) → 증명 키 삭제 · 방 갱신(locked false) · 토스트 「잠금을 풀었습니다.」', async () => {
    seedKeys([['r1', 'e1.k']])
    mockedClearPw.mockResolvedValueOnce(ok(OPEN_ROOM))
    const { onRoomRenamed } = renderChat(LOCKED_ROOM)
    const { user, confirm } = await openUnlockConfirm()
    await user.click(within(confirm).getByRole('button', { name: '풀기' }))

    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toBe('잠금을 풀었습니다.')
    expect(toast.classList.contains('success')).toBe(true)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(onRoomRenamed.mock.calls).toEqual([[OPEN_ROOM]])
    expect(mockedClearPw.mock.calls).toEqual([['r1']])
    expect(mockedSetPw).not.toHaveBeenCalled()
  })
})

describe('E18 · E19 실패 (R-LOCK-002 · R-CHAT-011)', () => {
  it.each([
    ['VALIDATION_ERROR', undefined, '비밀번호는 4~32자로 입력해 주세요.'],
    ['RATE_LIMITED', 30, '요청이 너무 많습니다. 30초 후 다시 시도해 주세요.'],
    ['NETWORK', undefined, '서버에 연결할 수 없습니다.'],
    ['NOT_FOUND', undefined, '방을 찾을 수 없습니다. 목록으로 돌아가 주세요.'],
  ] as const)(
    'TC-CH-147: 잠그기 %s → 시트 유지 · 시트 안 alert · 입력 유지 · 버튼 다시 활성 · 토스트·저장 없음',
    async (code, sec, text) => {
      mockedSetPw.mockResolvedValueOnce(fail(code, sec))
      const { onRoomRenamed, onAuthFailure } = renderChat(OPEN_ROOM)
      const { user, sheet, input, save, cancel } = await openSetSheet()
      typePassword(input, 'abcd')
      await user.click(save)

      const alert = await within(sheet).findByRole('alert')
      expect(alert.textContent).toBe(text)
      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(screen.getByRole('dialog', { name: '비밀번호 걸기' })).toBe(sheet)
      expect(input.value).toBe('abcd')
      expect(save.disabled).toBe(false)
      expect(cancel.disabled).toBe(false)
      expect(localStorage.getItem(KEYS)).toBeNull()
      expect(onRoomRenamed).not.toHaveBeenCalled()
      expect(onAuthFailure).not.toHaveBeenCalled()
      await flushPending()
      expect(mockedSetPw.mock.calls).toEqual([['r1', 'abcd']])
    },
  )

  it('TC-CH-147: 잠그기 TOKEN_INVALID → 시트 닫힘 · 전환 토스트 · 열람 안내 · ⋯ 없음', async () => {
    mockedSetPw.mockResolvedValueOnce(fail('TOKEN_INVALID'))
    const { onAuthFailure, onRoomRenamed } = renderChat(OPEN_ROOM)
    const { user, input, save } = await openSetSheet()
    typePassword(input, 'abcd')
    await user.click(save)

    await waitFor(() => expect(onAuthFailure).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('note').textContent).toBe(NOTICE)
    expect(screen.queryByRole('button', { name: MORE })).toBeNull()
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(onRoomRenamed).not.toHaveBeenCalled()
    expect(mockedSetPw).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-148: (a) 풀기 INTERNAL → 확인 닫힘 · E 토스트 · 증명 유지', async () => {
    seedKeys([['r1', 'e1.k']])
    mockedClearPw.mockResolvedValueOnce(fail('INTERNAL'))
    const { onRoomRenamed, onAuthFailure } = renderChat(LOCKED_ROOM)
    const { user, confirm } = await openUnlockConfirm()
    await user.click(within(confirm).getByRole('button', { name: '풀기' }))

    expect((await screen.findByRole('alert')).textContent).toBe(ERROR_MESSAGES.INTERNAL)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(roomKeys()).toEqual([['r1', 'e1.k']])
    expect(onRoomRenamed).not.toHaveBeenCalled()
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(mockedClearPw.mock.calls).toEqual([['r1']])
  })

  it('TC-CH-148: (b) 풀기 LEVEL_TOO_LOW → 확인 닫힘 · 전환 토스트 · 열람 안내', async () => {
    seedKeys([['r1', 'e1.k']])
    mockedClearPw.mockResolvedValueOnce(fail('LEVEL_TOO_LOW'))
    const { onAuthFailure, onRoomRenamed } = renderChat(LOCKED_ROOM)
    const { user, confirm } = await openUnlockConfirm()
    await user.click(within(confirm).getByRole('button', { name: '풀기' }))

    expect((await screen.findByRole('alert')).textContent).toBe(LEVEL_NOTICE)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('note').textContent).toBe(NOTICE)
    expect(screen.queryByRole('button', { name: MORE })).toBeNull()
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
    expect(roomKeys()).toEqual([['r1', 'e1.k']])
    expect(onRoomRenamed).not.toHaveBeenCalled()
    expect(mockedClearPw.mock.calls).toEqual([['r1']])
  })

  it('TC-CH-149: (a) 잠그기 대기 중 → 입력 readOnly · 두 버튼 disabled · Esc·덮개 무시 · Enter 연타 1회', async () => {
    const pending = deferred<Result<SetRoomPasswordResponse>>()
    mockedSetPw.mockReturnValueOnce(pending.promise)
    renderChat(OPEN_ROOM)
    const { user, sheet, input, save, cancel } = await openSetSheet()
    typePassword(input, 'abcd')
    await user.click(save)

    expect(input.readOnly).toBe(true)
    expect(save.disabled).toBe(true)
    expect(cancel.disabled).toBe(true)
    fireEvent.keyDown(sheet, { key: 'Escape' })
    fireEvent.click(sheet.parentElement as HTMLElement)
    expect(screen.getByRole('dialog', { name: '비밀번호 걸기' })).toBe(sheet)
    input.focus()
    await user.keyboard('{Enter}{Enter}')
    await flushPending()
    expect(mockedSetPw).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(ok({ room: LOCKED_ROOM, entryKey: 'e1.k' }))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('TC-CH-149: (b) 풀기 대기 중 → 두 버튼 disabled · Esc·덮개 무시 · ⋯·말풍선 버튼 줄 disabled → 응답 뒤 해제', async () => {
    seedKeys([['r1', 'e1.k']])
    const pending = deferred<Result<RoomSummary>>()
    mockedClearPw.mockReturnValueOnce(pending.promise)
    renderChat(LOCKED_ROOM)
    const { user, confirm } = await openUnlockConfirm()
    await user.click(within(confirm).getByRole('button', { name: '풀기' }))

    for (const b of within(confirm).getAllByRole('button'))
      expect((b as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(confirm, { key: 'Escape' })
    fireEvent.click(confirm.parentElement as HTMLElement)
    expect(screen.getByRole('alertdialog')).toBe(confirm)
    expect(moreButton().disabled).toBe(true)
    const buttons = actionButtons()
    expect(buttons.length).toBeGreaterThan(0)
    for (const b of buttons) expect(b.disabled).toBe(true)
    expect(mockedClearPw).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(ok(OPEN_ROOM))
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(moreButton().disabled).toBe(false)
    for (const b of actionButtons()) expect(b.disabled).toBe(false)
  })
})

describe('메시지 id 래퍼 roomId (F-CH-72 · R-LOCK-006)', () => {
  it('TC-CH-156: (a) 수정 저장 → editMessage(103, { text }, r1)', async () => {
    mockedEdit.mockResolvedValueOnce(ok({ ...M103, text: '고침' }))
    renderChat(OPEN_ROOM)
    await screen.findByRole('log')
    const user = userEvent.setup()
    await user.click(actionOf(USER_DISPLAY_NAME, '수정'))
    const editor = screen.getByRole('group', { name: '메시지 수정' })
    fireEvent.change(within(editor).getByRole('textbox', { name: '수정할 내용' }), {
      target: { value: '고침' },
    })
    await user.click(within(editor).getByRole('button', { name: '저장' }))
    expect(await screen.findByText('고침')).not.toBeNull()
    expect(mockedEdit.mock.calls).toEqual([[103, { text: '고침' }, 'r1']])
    expect(localStorage.getItem(KEYS)).toBeNull()
  })

  it('TC-CH-156: (b) 삭제 확인 → deleteMessage(103, r1)', async () => {
    mockedDelete.mockResolvedValueOnce(ok(undefined))
    renderChat(OPEN_ROOM)
    await screen.findByRole('log')
    const user = userEvent.setup()
    await user.click(actionOf(USER_DISPLAY_NAME, '삭제'))
    const confirm = screen.getByRole('alertdialog', { name: '이 메시지를 삭제할까요?' })
    await user.click(within(confirm).getByRole('button', { name: '삭제' }))
    await waitFor(() =>
      expect(within(screen.getByRole('log')).getAllByRole('listitem')).toHaveLength(2),
    )
    expect(mockedDelete.mock.calls).toEqual([[103, 'r1']])
  })

  it('TC-CH-156: (c) 재작성 → regenerate(104, r1)', async () => {
    mockedRegenerate.mockReset()
    mockedRegenerate.mockResolvedValueOnce(ok({ ...M104, text: '물론입니다.' }))
    renderChat(OPEN_ROOM)
    await screen.findByRole('log')
    ;(document.activeElement as HTMLElement | null)?.blur()
    fireEvent.click(actionOf('세바스찬', '재작성'))
    expect(await screen.findByText('물론입니다.')).not.toBeNull()
    expect(mockedRegenerate.mock.calls).toEqual([[104, 'r1']])
  })
})

describe('방 삭제 성공 → 증명 삭제 (F-CH-81 · R-CHAT-010)', () => {
  const deleteThisRoom = async () => {
    const { user, menu } = await openRoomMenu()
    await user.click(within(menu).getByRole('button', { name: '방 삭제' }))
    const confirm = screen.getByRole('alertdialog', { name: '이 방을 삭제할까요?' })
    await user.click(within(confirm).getByRole('button', { name: '삭제' }))
  }

  it.each([
    ['204', ok(undefined)],
    ['NOT_FOUND', fail('NOT_FOUND')],
  ] as const)(
    'TC-CH-157: 방 삭제 %s → onBack 시점에 ld:roomKeys 에서 r1 만 빠짐 · 기록 삭제',
    async (_label, result) => {
      seedKeys([
        ['r1', 'e1.k'],
        ['r2', 'e2.k'],
      ])
      mockedDeleteRoom.mockResolvedValueOnce(result as Result<void>)
      const { onBack } = renderChat(LOCKED_ROOM)
      let keysAtBack: unknown = 'not-called'
      let lastAtBack: string | null | undefined
      onBack.mockImplementation(() => {
        keysAtBack = roomKeys()
        lastAtBack = localStorage.getItem(LAST)
      })
      await deleteThisRoom()

      await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
      expect(keysAtBack).toEqual([['r2', 'e2.k']])
      expect(lastAtBack).toBeNull()
      expect(roomKeys()).toEqual([['r2', 'e2.k']])
      expect(mockedDeleteRoom.mock.calls).toEqual([['r1']])
    },
  )

  it('TC-CH-157: 증명 없는 방 삭제 → ld:roomKeys 쓰기 0회', async () => {
    mockedDeleteRoom.mockResolvedValueOnce(ok(undefined))
    const { onBack } = renderChat(OPEN_ROOM)
    await screen.findByRole('log')
    const setSpy = vi.spyOn(Storage.prototype, 'setItem')
    await deleteThisRoom()
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
    expect(setSpy.mock.calls.filter(c => c[0] === KEYS)).toHaveLength(0)
    expect(localStorage.getItem(KEYS)).toBeNull()
  })
})

describe('저장소·비밀값 (R-LOCK-007 · R-LOCK-009 · R-CHAT-009)', () => {
  it('TC-CH-160: (a) 잠금 미사용 흐름 → 저장소 키 = [ld:lastRoomId], 토큰 값 없음', async () => {
    initToken('?t=test-token')
    renderChat(OPEN_ROOM)
    await screen.findByRole('log')
    await flushPending()
    expect(storageKeys()).toEqual([LAST])
    expectNoStoredText('test-token')
  })

  it('TC-CH-160: (b) 잠그기 뒤 → ld:roomKeys 생김, 비밀번호 원문·토큰 값 없음', async () => {
    initToken('?t=test-token')
    mockedSetPw.mockResolvedValueOnce(ok({ room: LOCKED_ROOM, entryKey: 'e1.k' }))
    renderChat(OPEN_ROOM)
    const { user, input, save } = await openSetSheet()
    typePassword(input, 'abcd')
    await user.click(save)
    await screen.findByRole('alert')
    expect(storageKeys()).toContain(KEYS)
    expectNoStoredText('abcd', 'test-token')
  })
})

describe('App 통합 — 잠그기 → 증명 재사용 → 풀기 (TC-CH-162 · U-CH-16)', () => {
  it('TC-CH-162: (App ?t=) 잠그기 → ‹ → 잠긴 행 → enterRoom 0회로 재진입 → 풀기 → ‹ → 행 자물쇠 없음', async () => {
    initToken('?t=test-token')
    mockedListRooms
      .mockResolvedValueOnce(ok([OPEN_ROOM]))
      .mockResolvedValueOnce(ok([LOCKED_ROOM]))
      .mockResolvedValueOnce(ok([OPEN_ROOM]))
    mockedSetPw.mockResolvedValueOnce(ok({ room: LOCKED_ROOM, entryKey: 'e1.k' }))
    mockedClearPw.mockResolvedValueOnce(ok(OPEN_ROOM))
    render(<App />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '비밀 다과회, 마지막 갱신 10.07' }))
    await screen.findByRole('log')
    await user.click(moreButton())
    await user.click(
      within(screen.getByRole('dialog', { name: '방 메뉴' })).getByRole('button', { name: '잠금' }),
    )
    const sheet = screen.getByRole('dialog', { name: '비밀번호 걸기' })
    typePassword(within(sheet).getByLabelText('새 비밀번호') as HTMLInputElement, 'abcd')
    await user.click(within(sheet).getByRole('button', { name: '잠그기' }))
    expect((await screen.findByRole('alert')).textContent).toBe('방을 잠갔습니다.')
    expect(roomKeys()).toEqual([['r1', 'e1.k']])

    await user.click(screen.getByRole('button', { name: BACK }))
    const lockedRow = await screen.findByRole('button', { name: '비밀 다과회, 잠긴 방' })
    expect(lockedRow.querySelector('time')).toBeNull()
    await user.click(lockedRow)
    await screen.findByRole('log')
    await flushPending()
    expect(mockedEnter).not.toHaveBeenCalled()

    await user.click(moreButton())
    await user.click(
      within(screen.getByRole('dialog', { name: '방 메뉴' })).getByRole('button', { name: '잠금' }),
    )
    await user.click(
      within(screen.getByRole('dialog', { name: '잠금 메뉴' })).getByRole('button', {
        name: '잠금 풀기',
      }),
    )
    await user.click(
      within(screen.getByRole('alertdialog', { name: '잠금을 풀까요?' })).getByRole('button', {
        name: '풀기',
      }),
    )
    expect((await screen.findByRole('alert')).textContent).toBe('잠금을 풀었습니다.')
    expect(localStorage.getItem(KEYS)).toBeNull()

    await user.click(screen.getByRole('button', { name: BACK }))
    expect(
      await screen.findByRole('button', { name: '비밀 다과회, 마지막 갱신 10.07' }),
    ).not.toBeNull()
    expect(screen.queryByRole('button', { name: '비밀 다과회, 잠긴 방' })).toBeNull()
    expect(mockedSetPw.mock.calls).toEqual([['r1', 'abcd']])
    expect(mockedClearPw.mock.calls).toEqual([['r1']])
    expect(mockedEnter).not.toHaveBeenCalled()
    expect(mockedList.mock.calls.map(c => c[0])).toEqual(['r1', 'r1'])
    expect(mockedListRooms).toHaveBeenCalledTimes(3)
    expectNoStoredText('abcd', 'test-token')
  })
})
