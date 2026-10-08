/**
 * chat S6 입장 재요구(ROOM_LOCKED) 스펙 초안(TDD Red) — 단일 소스 ui/src/chat/test/scenarios.md v1.1
 * (TC-CH-150 ~ 155 · 158 · 159 · 161 · 164 · 165 · TC-FLOW-CH-22 / v1.1.1 신설 166 · 167 · 169)
 * 설계 정본: ui/src/chat/design/lock.md(LK) v2.3.1 — §0.4 판 · §1.3 껍데기·포커스 규칙 · §2 상태 · F-CH-63~73·80 · §4.4 · D-44~55
 * 대상: ChatScreen(껍데기) · ChatRoomView key={epoch} · LockedRoomView · useRoomLockGate · useWriteFailure · useChatLoader
 *   · settleSpeakFailure · useMemorySheet 떠남 조건 · (호출만) useRoomEntry · RoomEntrySheet
 * - useRoomEntry 의 판정 동작 자체(TC-RM-065)는 rooms 소유. 여기서는 chat 이 부른 결과(enterRoom 호출 여부·인자 · 시트 · 재입장)만 본다.
 * - 토큰: 화면 단위는 viewer props. App 통합(TC-FLOW-CH-22)은 토큰 없음(initToken 호출 없음).
 * - api 래퍼는 vi.mock(@/api/messages · @/api/rooms · @/api/memory). fetch 모킹 금지. isAuthFailure 실물.
 * - 기본값: listMessages = ok(PAGE). enterRoom · setRoomPassword · clearRoomPassword · speak · regenerate · getMemory · putMemory
 *   = 영원히 대기. 그래서 토큰 있음 + ROOM_LOCKED 는 TC 가 enterRoom 을 따로 주지 않으면 "조용한 시도 대기 중"에 머문다.
 * - localStorage 는 jsdom 실물. 매 TC 전 clear() → resetRoomKeyCache() → (필요하면) 사전 증명 setItem → 렌더.
 * - 실제 sleep·가짜 시계 없음. 응답은 resolve 된 mock 또는 deferred 를 act 안에서 resolve.
 * - 스크롤 mock(TC-CH-155 · 159)은 해당 describe 안에서만 건다(ChatScroll 규칙, scrollTop 비클램프).
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { USER_DISPLAY_NAME } from '@shared/characters'
import type {
  EnterRoomResponse,
  MemoryResponse,
  Message,
  MessagesPage,
  RoomSummary,
} from '@shared/types'
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
import { clearToken } from '@/state/token'
import { READ_ONLY_VIEWER, WRITER_VIEWER } from '@/state/viewer'

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
  setRoomPassword: vi.fn(),
  clearRoomPassword: vi.fn(),
  enterRoom: vi.fn(),
}))
vi.mock('@/api/memory', () => ({
  getMemory: vi.fn(),
  putMemory: vi.fn(),
}))

const mockedList = vi.mocked(listMessages)
const mockedAppend = vi.mocked(appendUser)
const mockedEdit = vi.mocked(editMessage)
const mockedDelete = vi.mocked(deleteMessage)
const mockedSpeak = vi.mocked(speak)
const mockedRegenerate = vi.mocked(regenerate)
const mockedRename = vi.mocked(renameRoom)
const mockedDeleteRoom = vi.mocked(deleteRoom)
const mockedSetPw = vi.mocked(setRoomPassword)
const mockedClearPw = vi.mocked(clearRoomPassword)
const mockedEnter = vi.mocked(enterRoom)
const mockedListRooms = vi.mocked(listRooms)
const mockedGetMemory = vi.mocked(getMemory)
const mockedPutMemory = vi.mocked(putMemory)
const allMocks = [
  mockedList,
  mockedAppend,
  mockedEdit,
  mockedDelete,
  mockedSpeak,
  mockedRegenerate,
  mockedListRooms,
  vi.mocked(createRoom),
  mockedRename,
  mockedDeleteRoom,
  mockedSetPw,
  mockedClearPw,
  mockedEnter,
  mockedGetMemory,
  mockedPutMemory,
]

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
const M104 = msg({
  id: 104,
  speaker: 'sebastian',
  text: '분부대로 하겠습니다.',
  authorName: null,
  createdAt: at(16, 44),
})
const PAGE: MessagesPage = { messages: [M101, M103, M104], hasMore: false }
const SENT = msg({ id: 105, text: '안녕', createdAt: at(16, 45) })
const MEM: MemoryResponse = { summary: '시엘은 체스에서 졌다.', sourceUntilId: 104, updatedAt: at(16, 30) }
/** 스크롤 TC: 31~60, hasMore true */
const seq = (id: number): Message =>
  msg({ id, speaker: id % 2 === 0 ? 'sebastian' : 'ciel', text: `본문 ${id}`, authorName: null })
const LATEST: MessagesPage = {
  messages: Array.from({ length: 30 }, (_, i) => seq(31 + i)),
  hasMore: true,
}

const MORE = '방 메뉴 열기'
const BACK = '방 목록으로 돌아가기'
const NOTICE = '열람 전용 - 대화 참여는 등급 회원만'
const SEB = '세바스찬 대사 생성'
const CIEL = '시엘 대사 생성'
const LOCKED_TEXT = '잠긴 방입니다'
const KEYS = 'ld:roomKeys'
const LAST = 'ld:lastRoomId'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fail = (code: ApiErrorCode): Result<never> => ({
  ok: false,
  error: { code, message: 'SERVER-RAW-MESSAGE' },
})
const entered = (entryKey: string | null): Result<EnterRoomResponse> => ok({ entryKey })
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
const storageValues = () =>
  Array.from({ length: localStorage.length }, (_, i) => localStorage.getItem(localStorage.key(i) as string) ?? '')

// ── 하네스(App replaceRoomInView · revokeWrite 흉내) ──────────────────
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
const renderChat = (room: RoomSummary = LOCKED_ROOM, viewer = WRITER_VIEWER) => {
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

const back = () => screen.getByRole('button', { name: BACK })
const items = () => within(screen.getByRole('log')).getAllByRole('listitem')
const entrySheet = () => screen.getByRole('dialog', { name: '비밀번호' })
const entryInput = () => within(entrySheet()).getByLabelText('방 비밀번호') as HTMLInputElement
const lockedStatus = () => screen.queryByText(LOCKED_TEXT)
const waitLocked = async () => {
  await waitFor(() => expect(lockedStatus()).not.toBeNull())
}
/** 잠긴 판 공통 단언(LK §0.4 · §1.3 · D-46) */
const expectLockedView = () => {
  const text = screen.getByText(LOCKED_TEXT)
  expect(text.closest('[role="status"]')).not.toBeNull()
  expect(screen.getAllByText(LOCKED_TEXT)).toHaveLength(1)
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  expect(screen.queryByRole('button', { name: MORE })).toBeNull()
  expect(screen.queryByRole('textbox', { name: '메시지 입력' })).toBeNull()
  expect(screen.queryByRole('button', { name: SEB })).toBeNull()
  expect(screen.queryByRole('button', { name: CIEL })).toBeNull()
  expect(screen.queryByRole('group', { name: '메시지 작성' })).toBeNull()
  expect(screen.getByRole('main', { name: '대화: 비밀 다과회' })).not.toBeNull()
  expect(back()).not.toBeNull()
}
const submitEntry = async (password: string) => {
  const user = userEvent.setup()
  fireEvent.change(entryInput(), { target: { value: password } })
  await user.click(within(entrySheet()).getByRole('button', { name: '입장' }))
  return user
}

beforeEach(() => {
  for (const m of allMocks) m.mockReset()
  mockedList.mockResolvedValue(ok(PAGE))
  for (const m of [
    mockedEnter,
    mockedSetPw,
    mockedClearPw,
    mockedSpeak,
    mockedRegenerate,
    mockedGetMemory,
    mockedPutMemory,
  ] as MockInstance[])
    m.mockImplementation(() => never())
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

describe('첫 로드 ROOM_LOCKED (R-LOCK-006 · F-CH-70)', () => {
  it('TC-CH-150: 읽기 전용 → 잠긴 판 + 입장 시트(같은 커밋) · 시트 입력 포커스 · 증명 삭제 · enterRoom 0회', async () => {
    seedKeys([['r1', 'old']])
    mockedList.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    const { onAuthFailure, onBack, onRoomRenamed } = renderChat(LOCKED_ROOM, READ_ONLY_VIEWER)
    await screen.findByRole('dialog', { name: '비밀번호' })

    expectLockedView()
    expect(screen.getByRole('note').textContent).toBe(NOTICE)
    expect(screen.getByRole('main').querySelector('time')).not.toBeNull()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(entryInput().getAttribute('placeholder')).toBeNull()
    expect(within(entrySheet()).getByText('0/64')).not.toBeNull()
    expect(document.activeElement).toBe(entryInput())
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(localStorage.getItem(KEYS)).toBeNull()
    await flushPending()
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(onBack).not.toHaveBeenCalled()
    expect(onRoomRenamed).not.toHaveBeenCalled()
    expect(mockedList.mock.calls.map(c => c[0])).toEqual(['r1'])
    expect(mockedEnter).not.toHaveBeenCalled()
  })

  it('TC-CH-151: (a) 토큰 → 증명 삭제 · enterRoom(r1) 조용한 시도 대기 중 ‹ 포커스 → 200 문자열 → 저장 · 재입장 · 새 ‹ 포커스', async () => {
    seedKeys([['r1', 'old']])
    mockedList.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    const quiet = deferred<Result<EnterRoomResponse>>()
    mockedEnter.mockReturnValueOnce(quiet.promise)
    renderChat(LOCKED_ROOM, WRITER_VIEWER)
    await waitLocked()
    await waitFor(() => expect(mockedEnter).toHaveBeenCalledTimes(1))

    expectLockedView()
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
    expect(screen.queryByRole('note')).toBeNull()
    expect(document.activeElement).toBe(back())
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(mockedEnter.mock.calls).toEqual([['r1']])

    await act(async () => {
      quiet.resolve(entered('e1.x'))
    })
    await waitFor(() => expect(items()).toHaveLength(3))
    expect(lockedStatus()).toBeNull()
    expect(screen.getByRole('button', { name: MORE })).not.toBeNull()
    expect(screen.getByRole('textbox', { name: '메시지 입력' })).not.toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(back()))
    expect(roomKeys()).toEqual([['r1', 'e1.x']])
    expect(localStorage.getItem(LAST)).toBe('r1')
    expect(mockedList.mock.calls.map(c => c[0])).toEqual(['r1', 'r1'])
  })

  it('TC-CH-151: (b) 토큰 → 조용한 시도 ROOM_LOCKED → 입장 시트(문구 없음) · 시트 입력 포커스 · ⋯·하단 바·열람 안내 없음', async () => {
    seedKeys([['r1', 'old']])
    mockedList.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    const quiet = deferred<Result<EnterRoomResponse>>()
    mockedEnter.mockReturnValueOnce(quiet.promise)
    renderChat(LOCKED_ROOM, WRITER_VIEWER)
    await waitFor(() => expect(mockedEnter).toHaveBeenCalledTimes(1))
    expect(document.activeElement).toBe(back())

    await act(async () => {
      quiet.resolve(fail('ROOM_LOCKED'))
    })
    await screen.findByRole('dialog', { name: '비밀번호' })
    expectLockedView()
    expect(within(entrySheet()).queryByRole('alert')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(entryInput()))
    expect(screen.queryByRole('note')).toBeNull()
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(mockedEnter.mock.calls).toEqual([['r1']])
    expect(mockedList).toHaveBeenCalledTimes(1)
  })
})

describe('입장 시트 (F-CH-63 submitPassword · F-CH-65 · F-CH-66)', () => {
  const lockedReadOnly = async () => {
    mockedList.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    const spies = renderChat(LOCKED_ROOM, READ_ONLY_VIEWER)
    await screen.findByRole('dialog', { name: '비밀번호' })
    return spies
  }

  it('TC-CH-152: (a) 비밀번호 입장 200 → 시트 닫힘 · 재입장(첫 로드 다시) · 증명 저장 · 원문 미저장', async () => {
    mockedEnter.mockResolvedValueOnce(entered('e1.y'))
    await lockedReadOnly()
    await submitEntry('pw1234')

    await waitFor(() => expect(items()).toHaveLength(3))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(lockedStatus()).toBeNull()
    expect(screen.getByRole('note').textContent).toBe(NOTICE)
    expect(roomKeys()).toEqual([['r1', 'e1.y']])
    expect(localStorage.getItem(LAST)).toBe('r1')
    for (const v of storageValues()) expect(v.includes('pw1234')).toBe(false)
    expect(mockedEnter.mock.calls).toEqual([['r1', 'pw1234']])
    expect(mockedList).toHaveBeenCalledTimes(2)
  })

  it('TC-CH-152: (b) ROOM_PASSWORD_WRONG → 시트 안 alert · 입력 유지 · 잠긴 판 유지', async () => {
    mockedEnter.mockResolvedValueOnce(fail('ROOM_PASSWORD_WRONG'))
    await lockedReadOnly()
    await submitEntry('pw1234')

    const alert = await within(entrySheet()).findByRole('alert')
    expect(alert.textContent).toBe('비밀번호가 맞지 않습니다.')
    expect(entryInput().value).toBe('pw1234')
    expectLockedView()
    expect(localStorage.getItem(KEYS)).toBeNull()
    for (const v of storageValues()) expect(v.includes('pw1234')).toBe(false)
    expect(mockedEnter.mock.calls).toEqual([['r1', 'pw1234']])
    expect(mockedList).toHaveBeenCalledTimes(1)
  })

  it.each(['취소', 'Escape'] as const)(
    'TC-CH-153: (a)(b) 시트 %s → 기록 지움 · onBack 1회 · enterRoom 0회',
    async how => {
      const { onBack } = await lockedReadOnly()
      expect(localStorage.getItem(LAST)).toBe('r1')
      const user = userEvent.setup()
      if (how === '취소')
        await user.click(within(entrySheet()).getByRole('button', { name: '취소' }))
      else await user.keyboard('{Escape}')
      await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
      expect(localStorage.getItem(LAST)).toBeNull()
      await flushPending()
      expect(mockedEnter).not.toHaveBeenCalled()
    },
  )

  it('TC-CH-153: (c) 시트 제출 NOT_FOUND → 기록 지움 · onBack 1회', async () => {
    mockedEnter.mockResolvedValueOnce(fail('NOT_FOUND'))
    const { onBack } = await lockedReadOnly()
    await submitEntry('pw1234')
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
    expect(localStorage.getItem(LAST)).toBeNull()
    expect(mockedEnter.mock.calls).toEqual([['r1', 'pw1234']])
  })

  it('TC-CH-153: (d) 입장 요청 중 Esc·취소 무시 → 응답 뒤 시트 안 문구', async () => {
    const pending = deferred<Result<EnterRoomResponse>>()
    mockedEnter.mockReturnValueOnce(pending.promise)
    const { onBack } = await lockedReadOnly()
    const user = await submitEntry('pw1234')
    const cancel = within(entrySheet()).getByRole('button', { name: '취소' }) as HTMLButtonElement
    expect(cancel.disabled).toBe(true)
    await user.keyboard('{Escape}')
    fireEvent.click(cancel)
    await flushPending()
    expect(screen.getByRole('dialog', { name: '비밀번호' })).not.toBeNull()
    expect(onBack).not.toHaveBeenCalled()
    expect(localStorage.getItem(LAST)).toBe('r1')

    await act(async () => {
      pending.resolve(fail('ROOM_PASSWORD_WRONG'))
    })
    expect(within(entrySheet()).getByRole('alert').textContent).toBe('비밀번호가 맞지 않습니다.')
    expect(mockedEnter.mock.calls).toEqual([['r1', 'pw1234']])
  })
})

describe('토큰 있음 잠긴 판 — ‹ · 시트 입장·취소 (F-CH-66 · F-CH-63 · U-CH-17)', () => {
  /** 토큰 있음: 첫 로드 ROOM_LOCKED → 조용한 시도 ROOM_LOCKED → 입장 시트(문구 없음) */
  const tokenSheet = async () => {
    mockedList.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    mockedEnter.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    const spies = renderChat(LOCKED_ROOM, WRITER_VIEWER)
    await screen.findByRole('dialog', { name: '비밀번호' })
    return spies
  }

  it('TC-CH-166: 조용한 시도 대기 중 잠긴 판 ‹ → 기록 지움 · onBack 1회', async () => {
    mockedList.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    const quiet = deferred<Result<EnterRoomResponse>>()
    mockedEnter.mockReturnValueOnce(quiet.promise)
    const { onBack } = renderChat(LOCKED_ROOM, WRITER_VIEWER)
    await waitFor(() => expect(mockedEnter).toHaveBeenCalledTimes(1))
    expectLockedView()
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
    expect(localStorage.getItem(LAST)).toBe('r1')
    let lastAtBack: string | null | undefined
    onBack.mockImplementation(() => {
      lastAtBack = localStorage.getItem(LAST)
    })

    await userEvent.setup().click(back())
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(lastAtBack).toBeNull()
    expect(localStorage.getItem(LAST)).toBeNull()
    await flushPending()
    expect(mockedEnter.mock.calls).toEqual([['r1']])
    expect(mockedList).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-167: (a) 토큰 있음 · 시트 입장 200 → 열람 안내 없음 · ⋯·하단 바 복귀 · enterRoom(r1, pw) · listMessages +1', async () => {
    const { onBack, onAuthFailure } = await tokenSheet()
    // Once 큐는 FIFO — 시트가 열린 뒤에 제출 응답을 넣는다
    mockedEnter.mockResolvedValueOnce(entered('e1.y'))
    await submitEntry('pw1234')

    await waitFor(() => expect(items()).toHaveLength(3))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(lockedStatus()).toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.getByRole('button', { name: MORE })).not.toBeNull()
    expect(screen.getByRole('textbox', { name: '메시지 입력' })).not.toBeNull()
    expect(screen.getByRole('button', { name: SEB })).not.toBeNull()
    expect(roomKeys()).toEqual([['r1', 'e1.y']])
    for (const v of storageValues()) expect(v.includes('pw1234')).toBe(false)
    expect(mockedEnter.mock.calls).toEqual([['r1'], ['r1', 'pw1234']])
    expect(mockedList).toHaveBeenCalledTimes(2)
    expect(onBack).not.toHaveBeenCalled()
    expect(onAuthFailure).not.toHaveBeenCalled()
  })

  it('TC-CH-167: (b) 토큰 있음 · 시트 취소 → 기록 지움 · onBack 1회 · enterRoom 증분 0', async () => {
    const { onBack } = await tokenSheet()
    expect(localStorage.getItem(LAST)).toBe('r1')
    await userEvent.setup().click(within(entrySheet()).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
    expect(localStorage.getItem(LAST)).toBeNull()
    await flushPending()
    expect(mockedEnter.mock.calls).toEqual([['r1']])
    expect(mockedList).toHaveBeenCalledTimes(1)
  })
})

describe('쓰기 중 ROOM_LOCKED (F-CH-64 · 69 · 71 · 73 · 80 · D-45 · D-52)', () => {
  type Case = {
    readonly name: string
    readonly arrange: () => void
    readonly run: () => Promise<void>
    readonly target: () => MockInstance
  }
  const user = () => userEvent.setup()
  const openMenuItem = async (item: string) => {
    const u = user()
    await u.click(screen.getByRole('button', { name: MORE }))
    await u.click(within(screen.getByRole('dialog', { name: '방 메뉴' })).getByRole('button', { name: item }))
    return u
  }
  const groupOf = (name: string) => screen.getByRole('group', { name: `${name} 말풍선 작업` })
  const actionOf = (name: string, action: '수정' | '재작성' | '삭제') =>
    within(groupOf(name)).getByRole('button', { name: `${name} 대사 ${action}` })
  const send = (text = '안녕') => {
    fireEvent.change(screen.getByRole('textbox', { name: '메시지 입력' }), { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: '전송' }))
  }

  const cases: readonly Case[] = [
    {
      name: '(1) 전송 appendUser',
      arrange: () => mockedAppend.mockResolvedValueOnce(fail('ROOM_LOCKED')),
      run: async () => send(),
      target: () => mockedAppend,
    },
    {
      name: '(2) 수정 저장 editMessage',
      arrange: () => mockedEdit.mockResolvedValueOnce(fail('ROOM_LOCKED')),
      run: async () => {
        const u = user()
        await u.click(actionOf(USER_DISPLAY_NAME, '수정'))
        const editor = screen.getByRole('group', { name: '메시지 수정' })
        fireEvent.change(within(editor).getByRole('textbox', { name: '수정할 내용' }), {
          target: { value: '고침' },
        })
        await u.click(within(editor).getByRole('button', { name: '저장' }))
      },
      target: () => mockedEdit,
    },
    {
      name: '(3) 삭제 확인 deleteMessage',
      arrange: () => mockedDelete.mockResolvedValueOnce(fail('ROOM_LOCKED')),
      run: async () => {
        const u = user()
        await u.click(actionOf(USER_DISPLAY_NAME, '삭제'))
        const confirm = screen.getByRole('alertdialog', { name: '이 메시지를 삭제할까요?' })
        await u.click(within(confirm).getByRole('button', { name: '삭제' }))
      },
      target: () => mockedDelete,
    },
    {
      name: '(4) 재작성 regenerate',
      arrange: () => mockedRegenerate.mockResolvedValueOnce(fail('ROOM_LOCKED')),
      run: async () => {
        ;(document.activeElement as HTMLElement | null)?.blur()
        fireEvent.click(actionOf('세바스찬', '재작성'))
      },
      target: () => mockedRegenerate,
    },
    {
      name: '(5) 세바스찬 speak',
      arrange: () => mockedSpeak.mockResolvedValueOnce(fail('ROOM_LOCKED')),
      run: async () => {
        await user().click(screen.getByRole('button', { name: SEB }))
      },
      target: () => mockedSpeak,
    },
    {
      name: "(6) 전송 뒤 자동 응답 speak('auto')",
      arrange: () => {
        mockedAppend.mockResolvedValueOnce(ok(SENT))
        mockedSpeak.mockResolvedValueOnce(fail('ROOM_LOCKED'))
      },
      run: async () => send(),
      target: () => mockedSpeak,
    },
    {
      name: '(7) 이름 변경 renameRoom',
      arrange: () => mockedRename.mockResolvedValueOnce(fail('ROOM_LOCKED')),
      run: async () => {
        const u = await openMenuItem('이름 변경')
        const sheet = screen.getByRole('dialog', { name: '방 이름 변경' })
        fireEvent.change(within(sheet).getByRole('textbox', { name: '방 이름' }), {
          target: { value: '새 제목' },
        })
        await u.click(within(sheet).getByRole('button', { name: '저장' }))
      },
      target: () => mockedRename,
    },
    {
      name: '(8) 방 삭제 deleteRoom',
      arrange: () => mockedDeleteRoom.mockResolvedValueOnce(fail('ROOM_LOCKED')),
      run: async () => {
        const u = await openMenuItem('방 삭제')
        const confirm = screen.getByRole('alertdialog', { name: '이 방을 삭제할까요?' })
        await u.click(within(confirm).getByRole('button', { name: '삭제' }))
      },
      target: () => mockedDeleteRoom,
    },
    {
      name: '(9) 장기기억 조회 getMemory(대기 → ROOM_LOCKED)',
      arrange: () => undefined,
      run: async () => {
        const pending = deferred<Result<MemoryResponse>>()
        mockedGetMemory.mockReturnValueOnce(pending.promise)
        await openMenuItem('장기기억')
        await screen.findByRole('dialog', { name: '장기기억' })
        await act(async () => {
          pending.resolve(fail('ROOM_LOCKED'))
        })
      },
      target: () => mockedGetMemory,
    },
    {
      name: '(10) 장기기억 저장 putMemory',
      arrange: () => {
        mockedGetMemory.mockResolvedValueOnce(ok(MEM))
        mockedPutMemory.mockResolvedValueOnce(fail('ROOM_LOCKED'))
      },
      run: async () => {
        const u = await openMenuItem('장기기억')
        const box = await screen.findByRole('textbox', { name: '장기기억 요약' })
        fireEvent.change(box, { target: { value: '고친 요약' } })
        await u.click(
          within(screen.getByRole('dialog', { name: '장기기억' })).getByRole('button', {
            name: '저장',
          }),
        )
      },
      target: () => mockedPutMemory,
    },
  ]

  it.each(cases)(
    'TC-CH-154: $name → ROOM_LOCKED → 증명 삭제 · 잠긴 판 · 시트·편집기·임시 말풍선 0 · 토스트·전환 0 · 재시도 0',
    async c => {
      seedKeys([['r1', 'e1.k']])
      c.arrange()
      const { onAuthFailure } = renderChat(LOCKED_ROOM, WRITER_VIEWER)
      await screen.findByRole('log')
      await c.run()
      await waitLocked()
      await flushPending()

      expectLockedView()
      expect(screen.queryAllByRole('dialog')).toHaveLength(0)
      expect(screen.queryAllByRole('alertdialog')).toHaveLength(0)
      expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()
      expect(document.querySelectorAll('.pending')).toHaveLength(0)
      expect(screen.queryAllByRole('alert')).toHaveLength(0)
      expect(screen.queryByRole('note')).toBeNull()
      expect(localStorage.getItem(KEYS)).toBeNull()
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(c.target()).toHaveBeenCalledTimes(1)
      expect(mockedEnter.mock.calls).toEqual([['r1']])
      if (c.name.startsWith('(6)')) {
        expect(mockedAppend).toHaveBeenCalledTimes(1)
        expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'auto' }]])
      }
    },
  )

  it('TC-CH-154: (11) D-52 입력 중이던 글은 잠긴 판 전환·재입장 뒤 사라진다 · speak 재호출 없음', async () => {
    mockedSpeak.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    mockedEnter.mockResolvedValueOnce(entered('e1.x'))
    renderChat(LOCKED_ROOM, WRITER_VIEWER)
    await screen.findByRole('log')
    fireEvent.change(screen.getByRole('textbox', { name: '메시지 입력' }), {
      target: { value: '쓰던 글' },
    })
    await userEvent.setup().click(screen.getByRole('button', { name: SEB }))
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(items()).toHaveLength(3))
    const input = screen.getByRole('textbox', { name: '메시지 입력' }) as HTMLTextAreaElement
    expect(input.value).toBe('')
    await flushPending()
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
    expect(mockedEnter.mock.calls).toEqual([['r1']])
  })
})

describe('스크롤 경로 ROOM_LOCKED (F-CH-70 loadOlder · isLockedRef)', () => {
  const scrollTops = new WeakMap<Element, number>()
  const isLog = (el: Element) => el.getAttribute('role') === 'log'
  beforeEach(() => {
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
  })
  afterEach(() => {
    for (const key of ['scrollHeight', 'clientHeight', 'scrollTop'])
      Reflect.deleteProperty(HTMLElement.prototype, key)
  })
  const scrollToTop = (log: HTMLElement) => {
    log.scrollTop = 0
    fireEvent.scroll(log)
  }

  it('TC-CH-155: 이전 페이지 ROOM_LOCKED → 잠긴 판 · B0 오류 줄 없음 · listMessages(r1, { before: 31 })', async () => {
    mockedList.mockResolvedValueOnce(ok(LATEST)).mockResolvedValueOnce(fail('ROOM_LOCKED'))
    const { onAuthFailure } = renderChat(LOCKED_ROOM, READ_ONLY_VIEWER)
    const log = await screen.findByRole('log')
    await flushPending()
    scrollToTop(log)
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
    await screen.findByRole('dialog', { name: '비밀번호' })

    expectLockedView()
    expect(screen.queryByText(/이전 대화를 불러오지 못했습니다/)).toBeNull()
    expect(screen.queryByText(/이전 대화 불러오는 중/)).toBeNull()
    expect(mockedList.mock.calls[1]).toEqual(['r1', { before: 31 }])
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(mockedEnter).not.toHaveBeenCalled()
  })

  it('TC-CH-159: 이전 페이지·자동 응답이 같은 틱에 ROOM_LOCKED → enterRoom 1회 · 판 1개', async () => {
    const older = deferred<Result<MessagesPage>>()
    const auto = deferred<Result<Message>>()
    mockedList.mockResolvedValueOnce(ok(LATEST)).mockReturnValueOnce(older.promise)
    mockedAppend.mockResolvedValueOnce(ok({ ...SENT, id: 61 }))
    mockedSpeak.mockReturnValueOnce(auto.promise)
    // v1.1.1(판별력): 안 잠긴 방으로 시작 — 두 번째 ROOM_LOCKED 가 무시되지 않으면 onRoomRenamed 가 2회가 된다
    const { onRoomRenamed } = renderChat(OPEN_ROOM, WRITER_VIEWER)
    const log = await screen.findByRole('log')
    await flushPending()
    fireEvent.change(screen.getByRole('textbox', { name: '메시지 입력' }), { target: { value: '안녕' } })
    fireEvent.click(screen.getByRole('button', { name: '전송' }))
    await waitFor(() => expect(mockedSpeak).toHaveBeenCalledTimes(1))
    scrollToTop(log)
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))

    await act(async () => {
      auto.resolve(fail('ROOM_LOCKED'))
      older.resolve(fail('ROOM_LOCKED'))
    })
    await waitLocked()
    await flushPending()
    expect(screen.getAllByText(LOCKED_TEXT)).toHaveLength(1)
    expect(mockedEnter.mock.calls).toEqual([['r1']])
    expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'auto' }]])
    expect(onRoomRenamed.mock.calls).toEqual([[LOCKED_ROOM]])
  })

  it.each(['ok', 'TOKEN_INVALID'] as const)(
    'TC-CH-169: 잠긴 뒤 진행 중이던 speak 의 늦은 %s 응답 → 화면 반영·토스트·전환 0 · 재입장 뒤 새 판에도 끼어들지 않음',
    async late => {
      const older = deferred<Result<MessagesPage>>()
      const gen = deferred<Result<Message>>()
      const quiet = deferred<Result<EnterRoomResponse>>()
      const LATE_TEXT = '늦게 도착한 대사'
      mockedList.mockResolvedValueOnce(ok(LATEST)).mockReturnValueOnce(older.promise)
      mockedSpeak.mockReturnValueOnce(gen.promise)
      mockedEnter.mockReturnValueOnce(quiet.promise)
      const { onAuthFailure } = renderChat(LOCKED_ROOM, WRITER_VIEWER)
      const log = await screen.findByRole('log')
      await flushPending()
      await userEvent.setup().click(screen.getByRole('button', { name: SEB }))
      await waitFor(() => expect(mockedSpeak).toHaveBeenCalledTimes(1))
      scrollToTop(log)
      await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
      await act(async () => {
        older.resolve(fail('ROOM_LOCKED'))
      })
      await waitLocked()

      await act(async () => {
        gen.resolve(
          late === 'ok'
            ? ok(msg({ id: 61, speaker: 'sebastian', text: LATE_TEXT, authorName: null }))
            : fail('TOKEN_INVALID'),
        )
      })
      await flushPending()
      expectLockedView()
      expect(screen.queryByText(LATE_TEXT)).toBeNull()
      expect(screen.queryAllByRole('alert')).toHaveLength(0)
      expect(onAuthFailure).not.toHaveBeenCalled()

      await act(async () => {
        quiet.resolve(entered('e1.x'))
      })
      await waitFor(() => expect(items()).toHaveLength(3))
      await flushPending()
      expect(screen.queryByText(LATE_TEXT)).toBeNull()
      expect(document.querySelectorAll('.pending')).toHaveLength(0)
      expect(screen.queryAllByRole('alert')).toHaveLength(0)
      expect(screen.getByRole('button', { name: MORE })).not.toBeNull()
      expect((screen.getByRole('button', { name: SEB }) as HTMLButtonElement).disabled).toBe(false)
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(mockedSpeak).toHaveBeenCalledTimes(1)
      expect(mockedEnter.mock.calls).toEqual([['r1']])
    },
  )
})

describe('E18 · E19 ROOM_LOCKED (F-CH-80 ①)', () => {
  it('TC-CH-158: (a) 잠그기 ROOM_LOCKED(안 잠긴 방) → 시트 닫힘 · 잠긴 판 · 토스트 0 · 방 locked true 반영', async () => {
    mockedSetPw.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    const { onRoomRenamed, onAuthFailure } = renderChat(OPEN_ROOM, WRITER_VIEWER)
    await screen.findByRole('log')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: MORE }))
    await user.click(within(screen.getByRole('dialog', { name: '방 메뉴' })).getByRole('button', { name: '잠금' }))
    const sheet = screen.getByRole('dialog', { name: '비밀번호 걸기' })
    fireEvent.change(within(sheet).getByLabelText('새 비밀번호'), { target: { value: 'abcd' } })
    await user.click(within(sheet).getByRole('button', { name: '잠그기' }))
    await waitLocked()
    await flushPending()

    expectLockedView()
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(onRoomRenamed.mock.calls).toEqual([[LOCKED_ROOM]])
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(mockedSetPw).toHaveBeenCalledTimes(1)
    expect(mockedEnter.mock.calls).toEqual([['r1']])
  })

  it('TC-CH-158: (b) 풀기 ROOM_LOCKED(잠긴 방) → 확인 닫힘 · 잠긴 판 · 토스트 0 · 증명 삭제 · 방 갱신 0회', async () => {
    seedKeys([['r1', 'e1.k']])
    mockedClearPw.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    const { onRoomRenamed } = renderChat(LOCKED_ROOM, WRITER_VIEWER)
    await screen.findByRole('log')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: MORE }))
    await user.click(within(screen.getByRole('dialog', { name: '방 메뉴' })).getByRole('button', { name: '잠금' }))
    await user.click(within(screen.getByRole('dialog', { name: '잠금 메뉴' })).getByRole('button', { name: '잠금 풀기' }))
    await user.click(
      within(screen.getByRole('alertdialog', { name: '잠금을 풀까요?' })).getByRole('button', { name: '풀기' }),
    )
    await waitLocked()
    await flushPending()

    expectLockedView()
    expect(screen.queryAllByRole('alertdialog')).toHaveLength(0)
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(onRoomRenamed).not.toHaveBeenCalled()
    expect(mockedClearPw).toHaveBeenCalledTimes(1)
    expect(mockedEnter.mock.calls).toEqual([['r1']])
  })
})

describe('메뉴 분기 일치 · 재입장 뒤 locked 복귀 (D-48)', () => {
  const openLockFromMenu = async () => {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: MORE }))
    await user.click(within(screen.getByRole('dialog', { name: '방 메뉴' })).getByRole('button', { name: '잠금' }))
  }

  it('TC-CH-161: 안 잠긴 방에서 ROOM_LOCKED → onRoomRenamed(locked true) 1회 → 재입장 → 「잠금」 = 잠금 시트', async () => {
    mockedList.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    mockedEnter.mockResolvedValueOnce(entered('e1.x'))
    const { onRoomRenamed } = renderChat(OPEN_ROOM, WRITER_VIEWER)
    await waitFor(() => expect(items()).toHaveLength(3))
    expect(onRoomRenamed.mock.calls).toEqual([[LOCKED_ROOM]])

    await openLockFromMenu()
    expect(screen.getByRole('dialog', { name: '잠금 메뉴' })).not.toBeNull()
    expect(screen.queryByRole('dialog', { name: '비밀번호 걸기' })).toBeNull()
    expect(mockedEnter.mock.calls).toEqual([['r1']])
    expect(mockedSetPw).not.toHaveBeenCalled()
  })

  it('TC-CH-164: (a) 잠긴 방 · 조용한 시도 200 entryKey null → 증명 없음 · onRoomRenamed(locked false) 1회 · 「잠금」 = 걸기 시트', async () => {
    mockedList.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    mockedEnter.mockResolvedValueOnce(entered(null))
    const { onRoomRenamed } = renderChat(LOCKED_ROOM, WRITER_VIEWER)
    await waitFor(() => expect(items()).toHaveLength(3))

    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(onRoomRenamed.mock.calls).toEqual([[OPEN_ROOM]])
    expect(mockedList).toHaveBeenCalledTimes(2)
    await openLockFromMenu()
    expect(screen.getByRole('dialog', { name: '비밀번호 걸기' })).not.toBeNull()
    expect(mockedEnter.mock.calls).toEqual([['r1']])
  })

  it('TC-CH-164: (b) 잠긴 방 · 조용한 시도 200 문자열 → onRoomRenamed 0회(locked 그대로)', async () => {
    mockedList.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    mockedEnter.mockResolvedValueOnce(entered('e1.x'))
    const { onRoomRenamed } = renderChat(LOCKED_ROOM, WRITER_VIEWER)
    await waitFor(() => expect(items()).toHaveLength(3))
    await flushPending()
    expect(onRoomRenamed).not.toHaveBeenCalled()
    expect(roomKeys()).toEqual([['r1', 'e1.x']])
  })
})

describe('조용한 재입장 상한 (D-55 · F-CH-63 · F-CH-65 · F-CH-70 onRoomOpened)', () => {
  it('TC-CH-165: (a) E17 은 늘 200 · E7 은 늘 ROOM_LOCKED → enterRoom 정확히 2회 → 3번째는 요청 없이 입장 시트', async () => {
    mockedList.mockResolvedValue(fail('ROOM_LOCKED'))
    mockedEnter.mockResolvedValue(entered('e1.x'))
    renderChat(LOCKED_ROOM, WRITER_VIEWER)
    await screen.findByRole('dialog', { name: '비밀번호' })
    await flushPending()

    expectLockedView()
    await waitFor(() => expect(document.activeElement).toBe(entryInput()))
    expect(mockedEnter.mock.calls).toEqual([['r1'], ['r1']])
    expect(mockedList).toHaveBeenCalledTimes(3)
  })

  it('TC-CH-165: (b) 2회째 재입장 뒤 첫 로드 200 → 카운터 0 → 다음 ROOM_LOCKED 에서 다시 조용한 시도', async () => {
    mockedList
      .mockResolvedValueOnce(fail('ROOM_LOCKED'))
      .mockResolvedValueOnce(fail('ROOM_LOCKED'))
      .mockResolvedValueOnce(ok(PAGE))
    mockedEnter.mockResolvedValueOnce(entered('e1.x')).mockResolvedValueOnce(entered('e1.x'))
    mockedAppend.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    renderChat(LOCKED_ROOM, WRITER_VIEWER)
    await waitFor(() => expect(items()).toHaveLength(3))
    expect(mockedEnter).toHaveBeenCalledTimes(2)

    fireEvent.change(screen.getByRole('textbox', { name: '메시지 입력' }), { target: { value: '안녕' } })
    fireEvent.click(screen.getByRole('button', { name: '전송' }))
    await waitFor(() => expect(mockedEnter).toHaveBeenCalledTimes(3))
    await flushPending()
    expectLockedView()
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
    expect(mockedEnter.mock.calls).toEqual([['r1'], ['r1'], ['r1']])
  })

  it('TC-CH-165: (c) 시트로 들어온 재입장은 카운터를 올리지 않는다', async () => {
    mockedList.mockResolvedValue(fail('ROOM_LOCKED'))
    mockedEnter
      .mockResolvedValueOnce(entered('e1.x'))
      .mockResolvedValueOnce(fail('ROOM_LOCKED'))
      .mockResolvedValueOnce(entered('e1.y'))
    renderChat(LOCKED_ROOM, WRITER_VIEWER)
    await screen.findByRole('dialog', { name: '비밀번호' })
    expect(mockedEnter.mock.calls).toEqual([['r1'], ['r1']])

    await submitEntry('pw1234')
    await waitFor(() => expect(mockedEnter).toHaveBeenCalledTimes(4))
    await flushPending()
    expect(mockedEnter.mock.calls).toEqual([['r1'], ['r1'], ['r1', 'pw1234'], ['r1']])
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
    expectLockedView()
    expect(mockedList).toHaveBeenCalledTimes(3)
  })
})

describe('App 통합 — 읽기 전용 · 비밀번호 바뀐 방 (TC-FLOW-CH-22 · U-CH-18)', () => {
  const enterLockedRowWithStaleProof = async () => {
    seedKeys([['r1', 'old']])
    mockedListRooms.mockResolvedValue(ok([LOCKED_ROOM]))
    mockedList.mockResolvedValueOnce(fail('ROOM_LOCKED'))
    render(<App />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '비밀 다과회, 잠긴 방' }))
    await screen.findByRole('dialog', { name: '비밀번호' })
    return user
  }

  it('TC-FLOW-CH-22: (a) 잠긴 행(증명 있음) → enterRoom 0회 진입 → ROOM_LOCKED → 판+시트 → 입장 → 대화 표시', async () => {
    mockedEnter.mockResolvedValueOnce(entered('e1.y'))
    await enterLockedRowWithStaleProof()
    expect(mockedEnter).not.toHaveBeenCalled()
    expectLockedView()
    expect(screen.getByRole('note').textContent).toBe(NOTICE)

    await submitEntry('pw1234')
    await waitFor(() => expect(items()).toHaveLength(3))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: MORE })).toBeNull()
    expect(roomKeys()).toEqual([['r1', 'e1.y']])
    for (const v of storageValues()) expect(v.includes('pw1234')).toBe(false)
    expect(mockedEnter.mock.calls).toEqual([['r1', 'pw1234']])
    expect(mockedList.mock.calls.map(c => c[0])).toEqual(['r1', 'r1'])
  })

  it('TC-FLOW-CH-22: (b) 시트 취소 → 방 목록 · 기록 없음', async () => {
    const user = await enterLockedRowWithStaleProof()
    await user.click(within(screen.getByRole('dialog', { name: '비밀번호' })).getByRole('button', { name: '취소' }))
    expect(await screen.findByRole('main', { name: '방 목록' })).not.toBeNull()
    expect(localStorage.getItem(LAST)).toBeNull()
    expect(localStorage.getItem(KEYS)).toBeNull()
    expect(mockedEnter).not.toHaveBeenCalled()
  })
})
