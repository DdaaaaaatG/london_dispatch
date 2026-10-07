/**
 * chat S3d 전송 뒤 자동 응답 스펙 초안(TDD Red) — 단일 소스 ui/src/chat/test/scenarios.md v0.8
 * (TC-CH-098 ~ 108 · TC-CH-063 S3d 추가분. TC-CH-109 는 수동 — manual-checklist MC-CH-19)
 * 설계 정본: ui/src/chat/design/auto.md — T35 sendSucceeded · F-CH-17 ⑥ · F-CH-32 retrySpeak · F-CH-42 runSpeak ·
 *   §4 잠금·끼어들기 0회 · §6 문구 · §7 접근성·읽기 전용 · §8 D-17(편집 중 전송)
 * 대상: ChatScreen · useMessageWrites(send → speak('auto')) · PendingBubble 중립 변형 · InlineEditor isSaveLocked ·
 *       Bubble·MessageMenuSheet 작성자 표기(userAuthorLabel)
 * - 토큰은 viewer props 로만 준다. localStorage 에 토큰을 넣지 않는다.
 * - api 래퍼는 vi.mock('@/api/messages'·'@/api/rooms'). fetch 모킹 금지. isAuthFailure 는 실물.
 * - speak·regenerate 기본값 = 영원히 대기(never). 저장·생성 응답은 deferred 를 act 안에서 직접 resolve 한다.
 *   화면 타이머가 없으므로 가짜 시계를 쓰지 않는다(실제 sleep 없음).
 * - 계약 이름 USER_DISPLAY_NAME(@shared/characters)은 contract 구현분을 전제로 import 한다(api.md §5.5).
 */
import { useState } from 'react'
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
import { Bubble } from '@/chat/components/Bubble'
import { InlineEditor } from '@/chat/components/InlineEditor'
import { userAuthorLabel } from '@/chat/labels'
import { READ_ONLY_VIEWER, type Viewer, WRITER_VIEWER } from '@/state/viewer'

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
const allMocks = [
  mockedList,
  mockedAppend,
  mockedEdit,
  mockedDelete,
  mockedSpeak,
  mockedRegenerate,
  vi.mocked(listRooms),
  vi.mocked(createRoom),
  vi.mocked(renameRoom),
  vi.mocked(deleteRoom),
]

// ── 픽스처 ─────────────────────────────────────────────
const ROOM: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 5, 9, 0).getTime(),
  updatedAt: new Date(2026, 9, 7, 18, 0).getTime(),
  messageCount: 4,
}
const at = (h: number, m: number): number => new Date(2026, 9, 5, h, m).getTime()
/** 유저 메시지 기본 authorName = 서버 투영 값(USER_DISPLAY_NAME, api.md §4.3 v0.6) */
const msg = (over: Partial<Message> & Pick<Message, 'id'>): Message => ({
  roomId: 'r1',
  speaker: 'user',
  kind: 'line',
  text: '',
  authorName: USER_DISPLAY_NAME,
  createdAt: at(16, 40),
  ...over,
})
const PAGE: MessagesPage = {
  messages: [
    msg({ id: 101, speaker: 'ciel', text: '세바스찬, 홍차.', authorName: null }),
    msg({
      id: 102,
      speaker: 'sebastian',
      text: '예, 도련님.',
      authorName: null,
      createdAt: at(16, 41),
    }),
    // 옛 데이터 가정: 받은 값 그대로 표시(치환 금지, D-21)
    msg({ id: 103, text: '나도 한 잔 부탁해요.', authorName: '미샤', createdAt: at(16, 42) }),
    msg({ id: 104, kind: 'ooc', text: '둘이 체스를 둔다', createdAt: at(16, 43) }),
  ],
  hasMore: false,
}
const SENT = msg({ id: 105, text: '안녕', createdAt: at(16, 44) })
const SENT_OOC = msg({ id: 105, kind: 'ooc', text: '안녕', createdAt: at(16, 44) })
const SENT2 = msg({ id: 107, text: '다시', createdAt: at(16, 46) })
const SEB_REPLY = msg({
  id: 106,
  speaker: 'sebastian',
  text: '분부대로 하겠습니다, 도련님.',
  authorName: null,
  createdAt: at(16, 45),
})
const CIEL_REPLY = msg({
  id: 106,
  speaker: 'ciel',
  text: '오늘 저녁은 조용히 보내고 싶군.',
  authorName: null,
  createdAt: at(16, 45),
})
const SERVER_RAW = 'SERVER-RAW-MESSAGE'
const NOTICE = '열람 전용 - 대화 참여는 등급 회원만'
const BACK = '방 목록으로 돌아가기'
const MENU = '방 메뉴 열기'
const SEB = '세바스찬 대사 생성'
const CIEL = '시엘 대사 생성'
const AUTO_STATUS = '응답을 만드는 중'
const AUTO_RETRY = '응답 재시도'
const LOCK_NOTE = '응답을 만드는 중에는 저장할 수 없습니다'
const AUTH_TEXT = {
  LEVEL_TOO_LOW: '대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.',
  TOKEN_INVALID: '인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.',
  TOKEN_REQUIRED: '로그인 정보가 없어 열람 전용으로 바뀌었습니다.',
} as const
/** 중립 말풍선 루트에 붙으면 안 되는 화자·Bubble 모듈 클래스(auto.md §2.1 테스트 클래스 키) */
const SPEAKER_KEYS = ['root', 'character', 'sebastian', 'ciel', 'user'] as const

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fail = (code: ApiErrorCode, retryAfterSec?: number): Result<never> => ({
  ok: false,
  error:
    retryAfterSec === undefined
      ? { code, message: SERVER_RAW }
      : { code, message: SERVER_RAW, retryAfterSec },
})
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}
/** 자동 응답 기본값 — 영원히 대기(전송 TC 가 의도치 않게 결과·실패로 넘어가지 않게, auto.md §9.1) */
const never = (): Promise<Result<Message>> => new Promise(() => {})
const flushPending = async () => {
  await act(async () => {})
}

const renderChat = (viewer: Viewer = WRITER_VIEWER) => {
  const onBack = vi.fn()
  const onAuthFailure = vi.fn()
  const view = render(
    <ChatScreen
      room={ROOM}
      viewer={viewer}
      onBack={onBack}
      onAuthFailure={onAuthFailure}
      onRoomRenamed={vi.fn()}
    />,
  )
  return { ...view, onBack, onAuthFailure }
}
/** App 의 전환을 흉내 내는 하네스: onAuthFailure 가 spy 호출 + READ_ONLY_VIEWER 로 바꾼다 */
const Harness = (props: { onAuthFailure: () => void }) => {
  const [viewer, setViewer] = useState(WRITER_VIEWER)
  return (
    <ChatScreen
      room={ROOM}
      viewer={viewer}
      onBack={vi.fn()}
      onRoomRenamed={vi.fn()}
      onAuthFailure={() => {
        props.onAuthFailure()
        setViewer(READ_ONLY_VIEWER)
      }}
    />
  )
}

const group = () => screen.getByRole('group', { name: '메시지 작성' })
const btn = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const input = () => screen.getByRole('textbox', { name: '메시지 입력' }) as HTMLTextAreaElement
const items = () => within(screen.getByRole('log')).getAllByRole('listitem')
const lastItem = () => items()[items().length - 1] as HTMLElement
const rootOf = (li: HTMLElement) => li.firstElementChild as HTMLElement
const pendings = () => document.querySelectorAll('.pending')
const neutrals = () => document.querySelectorAll('.pending.neutral')
/** S3e(actions.md AC §1): 그 li 의 말풍선 버튼 줄(group "{이름} 말풍선 작업"). 옛 메뉴 대상(aria-haspopup)은 없다 */
const actionsIn = (li: HTMLElement) => within(li).getByRole('group', { name: /말풍선 작업$/ })
/** 저장·자동 응답 대기를 하나씩 건다 */
const armSend = () => {
  const save = deferred<Result<Message>>()
  const gen = deferred<Result<Message>>()
  mockedAppend.mockReturnValueOnce(save.promise)
  mockedSpeak.mockReturnValueOnce(gen.promise)
  return { save, gen }
}
const typeAndSend = (text = '안녕') => {
  fireEvent.change(input(), { target: { value: text } })
  fireEvent.click(btn('전송'))
}
/** 전송 → 저장 201 까지(S2 생성 중 = 중립 "…") */
const sendToGenerating = async (saved: Message = SENT, text = '안녕') => {
  const d = armSend()
  typeAndSend(text)
  await act(async () => {
    d.save.resolve(ok(saved))
  })
  return d
}
/** 전송 → 저장 201 → 자동 응답 실패(중립 실패) */
const sendToNeutralFailed = async (code: ApiErrorCode = 'LLM_FAILED', sec?: number) => {
  const d = await sendToGenerating()
  await act(async () => {
    d.gen.resolve(fail(code, sec))
  })
  return d
}
/** 잠금 속성(disabled) 변화를 기록한다 — 사이 커밋에서 잠금이 풀렸다 다시 걸리면 기록이 남는다 */
const watchDisabled = (...els: HTMLElement[]) => {
  const records: MutationRecord[] = []
  const mo = new MutationObserver(list => {
    records.push(...list)
  })
  for (const el of els) mo.observe(el, { attributes: true, attributeFilter: ['disabled'] })
  return () => {
    records.push(...mo.takeRecords())
    mo.disconnect()
    return records
  }
}
const openEditorOn103 = async () => {
  const user = userEvent.setup()
  // S3e: 진입 = 103 버튼 줄 「수정」(메뉴 단계 없음)
  await user.click(
    within(actionsIn(items()[2] as HTMLElement)).getByRole('button', { name: /대사 수정$/ }),
  )
  return screen.getByRole('group', { name: '메시지 수정' })
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
})

describe('전송 → 자동 응답 호출 (R-CHAT-006 · R-CHAT-014 · R-MSG-009)', () => {
  it.each([
    ['클릭', false, false],
    ['Enter', true, false],
    ['OOC 켬 + 클릭', false, true],
  ] as const)(
    'TC-CH-098: %s 전송 → appendUser 1회 resolve 뒤에만 speak("r1", { character: "auto" }) 1회, 캐릭터 값 speak·regenerate 0회',
    async (_label, byEnter, ooc) => {
      renderChat()
      await screen.findByRole('log')
      const d = armSend()
      const user = userEvent.setup()
      if (ooc) await user.click(screen.getByRole('switch', { name: 'OOC 지시 모드' }))
      await user.type(input(), '안녕')
      if (byEnter) await user.keyboard('{Enter}')
      else await user.click(btn('전송'))
      await flushPending()
      expect(mockedAppend.mock.calls).toEqual([['r1', { text: '안녕', ooc }]])
      expect(mockedSpeak).not.toHaveBeenCalled() // 저장 응답 전에는 부르지 않는다

      await act(async () => {
        d.save.resolve(ok(ooc ? SENT_OOC : SENT))
      })
      expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'auto' }]])
      expect(Object.keys(mockedSpeak.mock.calls[0]?.[1] ?? {})).toEqual(['character'])
      expect(mockedRegenerate).not.toHaveBeenCalled()
      expect(mockedEdit).not.toHaveBeenCalled()
      expect(mockedDelete).not.toHaveBeenCalled()
      expect(mockedAppend).toHaveBeenCalledTimes(1)
      expect(mockedList).toHaveBeenCalledTimes(1)
    },
  )
})

describe('T35 한 커밋 — S1 저장 중 → S2 생성 중 (R-CHAT-014 · R-CHAT-002 · R-CHAT-013)', () => {
  it('TC-CH-099: S1 잠금·readOnly·aria-busy → 저장 201 한 커밋에 유저 말풍선(어떠한 의지) + 중립 "…"(가운데·이름·아바타 없음·role=status), 잠금 속성 변화 0회, 입력 비움·타이핑 가능', async () => {
    const { onAuthFailure } = renderChat()
    await screen.findByRole('log')
    const d = armSend()
    typeAndSend('안녕')

    // S1 저장 중 — 그림은 입력 상태와 같고 잠금만 다르다(auto.md §0)
    expect(items()).toHaveLength(4)
    expect(pendings()).toHaveLength(0)
    for (const name of [SEB, CIEL, '전송', MENU]) expect(btn(name).disabled).toBe(true)
    expect(input().readOnly).toBe(true)
    expect(input().value).toBe('안녕')
    expect(group().getAttribute('aria-busy')).toBe('true')

    const stop = watchDisabled(btn(SEB), btn(CIEL), btn(MENU))
    await act(async () => {
      d.save.resolve(ok(SENT))
    })
    expect(stop()).toHaveLength(0) // 저장 응답과 생성 시작 사이에 잠금이 풀린 커밋 없음(auto.md §4.2-1)

    expect(items()).toHaveLength(6)
    const userLi = items()[4] as HTMLElement
    expect(userLi.querySelector('.user')).not.toBeNull()
    expect(userLi.textContent).toContain(USER_DISPLAY_NAME)
    expect(userLi.textContent).toContain('안녕')
    const root = rootOf(lastItem())
    expect(root.classList.contains('pending')).toBe(true)
    expect(root.classList.contains('neutral')).toBe(true)
    for (const k of [...SPEAKER_KEYS, 'failed']) expect(root.classList.contains(k)).toBe(false)
    expect(root.querySelector('img')).toBeNull()
    expect(root.querySelector('.name')).toBeNull()
    expect(root.querySelector('time')).toBeNull()
    const status = within(screen.getByRole('log')).getByRole('status')
    expect(status).toBe(root)
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toContain(AUTO_STATUS)
    expect(within(root).getByText('…').getAttribute('aria-hidden')).toBe('true')
    expect(root.getAttribute('tabindex')).toBeNull()
    expect(root.querySelector('[aria-haspopup]')).toBeNull()
    expect(within(root).queryByRole('button')).toBeNull()
    expect(within(lastItem()).queryAllByRole('group')).toHaveLength(0) // S3e: 중립 li 에 버튼 줄 없음(TC-CH-119)

    for (const name of [SEB, CIEL, '전송', MENU]) expect(btn(name).disabled).toBe(true)
    await waitFor(() => expect(input().value).toBe(''))
    expect(input().readOnly).toBe(false)
    expect(document.activeElement).toBe(input())
    expect(group().getAttribute('aria-busy')).not.toBe('true')
    fireEvent.change(input(), { target: { value: '다음' } })
    expect(input().value).toBe('다음')
    expect(btn('전송').disabled).toBe(true)
    // S3e(옛 "메뉴 dialog 없음"): 생성 중에는 버튼 줄이 disabled, 눌러도 편집기·확인 시트 없음
    for (const b of within(actionsIn(items()[2] as HTMLElement)).getAllByRole('button')) {
      expect((b as HTMLButtonElement).disabled).toBe(true)
      fireEvent.click(b)
    }
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()

    expect(Object.keys(localStorage)).toEqual(['ld:lastRoomId'])
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(mockedAppend.mock.calls).toEqual([['r1', { text: '안녕', ooc: false }]])
    expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'auto' }]])
  })
})

describe('결과 자리 (R-CHAT-014 · R-CHAT-002 · R-MSG-009)', () => {
  it.each([
    ['sebastian', SEB_REPLY, 'ciel', '/embed/img/sebastian.png', '세바스찬'],
    ['ciel', CIEL_REPLY, 'sebastian', '/embed/img/ciel.png', '시엘'],
  ] as const)(
    'TC-CH-100: 응답 speaker=%s → 중립 "…" 자리를 그 캐릭터 쪽 결과 말풍선이 1회 교체, 잠금 해제, 포커스는 입력창 그대로',
    async (key, reply, other, src, short) => {
      renderChat()
      await screen.findByRole('log')
      const d = await sendToGenerating()
      await waitFor(() => expect(input().value).toBe(''))
      fireEvent.change(input(), { target: { value: '다음' } })

      await act(async () => {
        d.gen.resolve(ok(reply))
      })
      expect(pendings()).toHaveLength(0)
      expect(items()).toHaveLength(6)
      const root = rootOf(lastItem())
      expect(root.classList.contains('character')).toBe(true)
      expect(root.classList.contains(key)).toBe(true)
      expect(root.classList.contains(other)).toBe(false)
      expect(root.classList.contains('neutral')).toBe(false)
      expect(lastItem().querySelector('img')?.getAttribute('src')).toBe(src)
      expect(lastItem().textContent).toContain(short)
      expect(lastItem().textContent).toContain(reply.text)
      expect((items()[4] as HTMLElement).textContent).toContain('안녕')
      for (const name of [SEB, CIEL, '전송', MENU]) expect(btn(name).disabled).toBe(false)
      expect(document.activeElement).toBe(input())
      expect(input().value).toBe('다음')
      expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'auto' }]])
      expect(mockedList).toHaveBeenCalledTimes(1)
    },
  )

  it('TC-CH-100: (c) 자동으로 고른 대사도 결과 말풍선 「재작성」 버튼 = regenerate(그 id) 1회, speak 추가 0회', async () => {
    renderChat()
    await screen.findByRole('log')
    const d = await sendToGenerating()
    await act(async () => {
      d.gen.resolve(ok(SEB_REPLY))
    })
    const user = userEvent.setup()
    await user.click(
      within(actionsIn(lastItem())).getByRole('button', { name: '세바스찬 대사 재작성' }),
    )
    await flushPending()
    expect(mockedRegenerate.mock.calls).toEqual([[106]])
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
  })
})

describe('저장 실패 → AI 호출 0회 (R-CHAT-006 · R-CHAT-011)', () => {
  it.each([
    ['INTERNAL', undefined, ERROR_MESSAGES.INTERNAL],
    ['RATE_LIMITED', 40, '요청이 너무 많습니다. 40초 후 다시 시도해 주세요.'],
  ] as const)(
    'TC-CH-101: 저장 실패 %s(retryAfterSec=%s) → speak 0회 · 입력 유지 · S2 토스트 · 중립 없음 · 전환 없음',
    async (code, sec, text) => {
      const { onAuthFailure } = renderChat()
      await screen.findByRole('log')
      mockedAppend.mockResolvedValueOnce(fail(code, sec))
      typeAndSend('안녕')
      await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(text))
      expect(input().value).toBe('안녕')
      expect(input().readOnly).toBe(false)
      expect(items()).toHaveLength(4)
      expect(pendings()).toHaveLength(0)
      for (const name of [SEB, CIEL, '전송']) expect(btn(name).disabled).toBe(false)
      expect(screen.queryByRole('note')).toBeNull()
      await flushPending()
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(mockedAppend).toHaveBeenCalledTimes(1)
      expect(mockedSpeak).not.toHaveBeenCalled()
      expect(mockedRegenerate).not.toHaveBeenCalled()
    },
  )

  it('TC-CH-101: 저장 실패 TOKEN_INVALID → 읽기 전용 전환(S2 규칙) · speak 0회 · 중립 DOM 없음', async () => {
    const onAuthFailure = vi.fn()
    render(<Harness onAuthFailure={onAuthFailure} />)
    await screen.findByRole('log')
    mockedAppend.mockResolvedValueOnce(fail('TOKEN_INVALID'))
    typeAndSend('안녕')
    await waitFor(() => expect(screen.getByRole('note').textContent).toBe(NOTICE))
    expect(screen.queryByRole('group', { name: '메시지 작성' })).toBeNull()
    expect(pendings()).toHaveLength(0)
    expect(items()).toHaveLength(4)
    expect(screen.getAllByRole('alert')[0]?.textContent).toBe(AUTH_TEXT.TOKEN_INVALID)
    await flushPending()
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
    expect(mockedSpeak).not.toHaveBeenCalled()
  })

  it('TC-CH-101: 이전 캐릭터 실패 말풍선이 있을 때 저장 실패 → 실패 말풍선 그대로(교체 없음), speak 추가 0회', async () => {
    renderChat()
    await screen.findByRole('log')
    const g = deferred<Result<Message>>()
    mockedSpeak.mockReturnValueOnce(g.promise)
    fireEvent.click(btn(SEB))
    await act(async () => {
      g.resolve(fail('LLM_FAILED'))
    })
    mockedAppend.mockResolvedValueOnce(fail('INTERNAL'))
    typeAndSend('안녕')
    await waitFor(() => expect(screen.getByText(ERROR_MESSAGES.INTERNAL)).not.toBeNull())
    const root = rootOf(lastItem())
    for (const k of ['pending', 'failed', 'sebastian']) expect(root.classList.contains(k)).toBe(true)
    expect(root.classList.contains('neutral')).toBe(false)
    expect(btn('세바스찬 대사 재시도').disabled).toBe(false)
    expect(items()).toHaveLength(5)
    await flushPending()
    expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'sebastian' }]])
    expect(mockedAppend).toHaveBeenCalledTimes(1)
  })
})

describe('중립 실패 (R-CHAT-014 · R-CHAT-011 · R-CHAT-005)', () => {
  it.each([
    ['LLM_FAILED', undefined, '생성에 실패했습니다.'],
    [
      'SPEAK_IN_PROGRESS',
      undefined,
      '이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요.',
    ],
    ['RATE_LIMITED', 40, '요청이 너무 많습니다. 40초 후 다시 시도해 주세요.'],
    [
      'LLM_BUDGET_EXCEEDED',
      undefined,
      '이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.',
    ],
    ['NETWORK', undefined, '서버에 연결할 수 없습니다.'],
  ] as const)(
    'TC-CH-102: speak(auto) %s(retryAfterSec=%s) → 같은 자리 중립 실패 · role=alert 문구 · 「재시도」(응답 재시도) · 유저 말풍선 남음 · 토스트 없음 · 잠금 해제 · 포커스 이동 없음',
    async (code, sec, text) => {
      const { onAuthFailure } = renderChat()
      await screen.findByRole('log')
      await sendToNeutralFailed(code, sec)
      await waitFor(() => expect(input().value).toBe(''))
      expect(items()).toHaveLength(6)
      const root = rootOf(lastItem())
      for (const k of ['pending', 'neutral', 'failed']) expect(root.classList.contains(k)).toBe(true)
      for (const k of SPEAKER_KEYS) expect(root.classList.contains(k)).toBe(false)
      expect(root.querySelector('img')).toBeNull()
      expect(root.getAttribute('role')).toBeNull()
      expect(within(screen.getByRole('log')).queryByRole('status')).toBeNull()
      const alerts = screen.getAllByRole('alert')
      expect(alerts).toHaveLength(1) // 중립 실패 문구 하나 — E 토스트 없음
      expect(root.contains(alerts[0] as Node)).toBe(true)
      expect(alerts[0]?.textContent).toContain(text)
      expect(screen.queryByText(new RegExp(SERVER_RAW))).toBeNull()
      const retry = btn(AUTO_RETRY)
      expect(retry.textContent).toBe('재시도')
      expect(retry.disabled).toBe(false)
      expect(root.contains(retry)).toBe(true)
      expect((items()[4] as HTMLElement).textContent).toContain('안녕')
      for (const name of [SEB, CIEL, MENU]) expect(btn(name).disabled).toBe(false)
      expect(document.activeElement).toBe(input())
      expect(screen.queryByRole('note')).toBeNull()
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'auto' }]])
    },
  )
})

describe('중립 재시도 (R-CHAT-014 · R-CHAT-013)', () => {
  it.each([
    ['성공', ok(CIEL_REPLY)],
    ['실패', fail('LLM_FAILED')],
  ] as const)(
    'TC-CH-103: 중립 「재시도」 → 포커스 히스토리 log → speak("r1",{auto}) 2번째 · 같은 자리 중립 "…" · 유저 말풍선 추가 0 → 응답(%s) 뒤에도 포커스 log',
    async (_label, result) => {
      renderChat()
      await screen.findByRole('log')
      await sendToNeutralFailed('LLM_FAILED')
      const d2 = deferred<Result<Message>>()
      mockedSpeak.mockReturnValueOnce(d2.promise)
      await userEvent.setup().click(btn(AUTO_RETRY))
      const log = screen.getByRole('log')
      expect(document.activeElement).toBe(log)
      expect(screen.queryByRole('button', { name: AUTO_RETRY })).toBeNull()
      expect(document.querySelectorAll('.failed')).toHaveLength(0)
      expect(neutrals()).toHaveLength(1)
      expect(rootOf(lastItem()).classList.contains('neutral')).toBe(true)
      expect(within(log).getByRole('status').textContent).toContain(AUTO_STATUS)
      expect(items()).toHaveLength(6)
      for (const name of [SEB, CIEL]) expect(btn(name).disabled).toBe(true)
      expect(mockedSpeak.mock.calls).toEqual([
        ['r1', { character: 'auto' }],
        ['r1', { character: 'auto' }],
      ])

      await act(async () => {
        d2.resolve(result)
      })
      expect(document.activeElement).toBe(log)
      expect(mockedAppend).toHaveBeenCalledTimes(1)
      expect(mockedSpeak).toHaveBeenCalledTimes(2)
    },
  )
})

describe('끼어들기 0회 (R-CHAT-014 — 원자 전이 1회 · 쓰기 팻말 유지)', () => {
  it('TC-CH-104: 저장 대기(같은 act 클릭 포함) · 저장 응답 직후 같은 act · 생성 대기 — 캐릭터 버튼·전송·Enter 어느 것도 끼어들지 못한다(speak 총 1회 auto, appendUser 1회)', async () => {
    renderChat()
    await screen.findByRole('log')
    const d = armSend()
    fireEvent.change(input(), { target: { value: '안녕' } })

    // ① 저장 대기 — disabled 반영 전 같은 act 안 클릭(쓰기 팻말이 막는다)
    act(() => {
      fireEvent.click(btn('전송'))
      fireEvent.click(btn(SEB))
      fireEvent.click(btn(CIEL))
      fireEvent.click(btn('전송'))
    })
    fireEvent.click(btn(SEB))
    fireEvent.keyDown(input(), { key: 'Enter', code: 'Enter' })
    await flushPending()
    expect(mockedSpeak).not.toHaveBeenCalled()
    expect(mockedAppend).toHaveBeenCalledTimes(1)

    // ② 저장 응답 직후 — send 의 이어짐(T35·speak 호출)이 먼저 돌고, 같은 act 안(커밋 전)에서 클릭·Enter
    await act(async () => {
      d.save.resolve(ok(SENT))
      await d.save.promise
      fireEvent.click(btn(SEB))
      fireEvent.click(btn(CIEL))
      fireEvent.keyDown(input(), { key: 'Enter', code: 'Enter' })
    })
    expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'auto' }]])

    // ③ 생성 대기 — 입력은 되지만 전송·버튼은 막힌다
    await waitFor(() => expect(input().value).toBe(''))
    fireEvent.change(input(), { target: { value: '끼어들기' } })
    fireEvent.click(btn(SEB))
    fireEvent.click(btn(CIEL))
    fireEvent.click(btn('전송'))
    fireEvent.keyDown(input(), { key: 'Enter', code: 'Enter' })
    await flushPending()
    expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'auto' }]])
    expect(mockedAppend).toHaveBeenCalledTimes(1)
    expect(mockedRegenerate).not.toHaveBeenCalled()

    // 생성 끝 → 잠금 해제
    await act(async () => {
      d.gen.resolve(ok(SEB_REPLY))
    })
    expect(btn(SEB).disabled).toBe(false)
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
  })
})

describe('중립 실패에서 나가는 길 (R-CHAT-014 · R-CHAT-005)', () => {
  it('TC-CH-105: (a) 중립 실패 → 「시엘」 → 중립 실패 사라짐 · 시엘 임시 말풍선 · speak 2번째 = ciel', async () => {
    renderChat()
    await screen.findByRole('log')
    await sendToNeutralFailed()
    const g = deferred<Result<Message>>()
    mockedSpeak.mockReturnValueOnce(g.promise)
    fireEvent.click(btn(CIEL))
    expect(neutrals()).toHaveLength(0)
    expect(document.querySelectorAll('.failed')).toHaveLength(0)
    expect(pendings()).toHaveLength(1)
    const root = rootOf(lastItem())
    for (const k of ['pending', 'character', 'ciel']) expect(root.classList.contains(k)).toBe(true)
    expect(within(screen.getByRole('log')).getByRole('status').textContent).toContain(
      '시엘 대사를 만드는 중',
    )
    expect(items()).toHaveLength(6)
    expect(mockedSpeak.mock.calls).toEqual([
      ['r1', { character: 'auto' }],
      ['r1', { character: 'ciel' }],
    ])
  })

  it('TC-CH-105: (b) 중립 실패 → 새 전송: 저장 대기 중 중립 실패 유지·「재시도」 disabled → 201 → 중립 실패 사라짐 · 새 유저 말풍선 + 새 중립 "…"', async () => {
    renderChat()
    await screen.findByRole('log')
    await sendToNeutralFailed()
    await waitFor(() => expect(input().value).toBe(''))
    const d2 = armSend()
    typeAndSend('다시')
    expect(rootOf(lastItem()).classList.contains('failed')).toBe(true)
    expect(btn(AUTO_RETRY).disabled).toBe(true)

    await act(async () => {
      d2.save.resolve(ok(SENT2))
    })
    expect(document.querySelectorAll('.failed')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: AUTO_RETRY })).toBeNull()
    expect(items()).toHaveLength(7)
    expect((items()[5] as HTMLElement).textContent).toContain('다시')
    const root = rootOf(lastItem())
    for (const k of ['pending', 'neutral']) expect(root.classList.contains(k)).toBe(true)
    expect(within(screen.getByRole('log')).getByRole('status').textContent).toContain(AUTO_STATUS)
    expect(mockedAppend.mock.calls).toEqual([
      ['r1', { text: '안녕', ooc: false }],
      ['r1', { text: '다시', ooc: false }],
    ])
    expect(mockedSpeak.mock.calls).toEqual([
      ['r1', { character: 'auto' }],
      ['r1', { character: 'auto' }],
    ])
  })
})

describe('자동 응답 인증·방 없음·토큰 없음 (R-CHAT-014 · R-CHAT-011 · R-CHAT-008)', () => {
  it.each(['TOKEN_INVALID', 'LEVEL_TOO_LOW', 'TOKEN_REQUIRED'] as const)(
    'TC-CH-106: speak(auto) %s → 중립 제거 · 읽기 전용 전환(하단 바·.pending DOM 없음) · 유저 말풍선 남음 · ‹ 포커스',
    async code => {
      const onAuthFailure = vi.fn()
      render(<Harness onAuthFailure={onAuthFailure} />)
      await screen.findByRole('log')
      const d = await sendToGenerating()
      await act(async () => {
        d.gen.resolve(fail(code))
      })
      expect(pendings()).toHaveLength(0)
      expect(screen.queryByRole('group', { name: '메시지 작성' })).toBeNull()
      expect(screen.queryByRole('button', { name: /세바스찬|시엘|응답 재시도/ })).toBeNull()
      expect(screen.getByRole('note').textContent).toBe(NOTICE)
      expect(items()).toHaveLength(5)
      expect((items()[4] as HTMLElement).textContent).toContain('안녕')
      expect((items()[4] as HTMLElement).textContent).toContain(USER_DISPLAY_NAME)
      const alerts = screen.getAllByRole('alert')
      expect(alerts).toHaveLength(1)
      expect(alerts[0]?.textContent).toBe(AUTH_TEXT[code])
      expect(alerts[0]?.classList.contains('warning')).toBe(true)
      await waitFor(() => expect(document.activeElement).toBe(btn(BACK)))
      expect(onAuthFailure).toHaveBeenCalledTimes(1)
      expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'auto' }]])
    },
  )

  it('TC-CH-106: speak(auto) NOT_FOUND → ld:lastRoomId 삭제 후 onBack 1회 · 토스트 없음 · 중립 없음', async () => {
    const { onBack } = renderChat()
    let storedAtBack: string | null = 'unset'
    onBack.mockImplementation(() => {
      storedAtBack = localStorage.getItem('ld:lastRoomId')
    })
    await screen.findByRole('log')
    const d = await sendToGenerating()
    await act(async () => {
      d.gen.resolve(fail('NOT_FOUND'))
    })
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(storedAtBack).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(pendings()).toHaveLength(0)
    await flushPending()
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-106: (토큰 없음) 하단 바·전송·중립 말풍선·「응답 재시도」 DOM 없음, appendUser·speak 0회, 토큰 저장 없음', async () => {
    renderChat(READ_ONLY_VIEWER)
    await screen.findByRole('log')
    expect(screen.queryByRole('group', { name: '메시지 작성' })).toBeNull()
    expect(screen.queryByRole('button', { name: '전송' })).toBeNull()
    expect(screen.queryByRole('button', { name: AUTO_RETRY })).toBeNull()
    expect(neutrals()).toHaveLength(0)
    expect(screen.getByRole('note').textContent).toBe(NOTICE)
    await flushPending()
    expect(mockedAppend).not.toHaveBeenCalled()
    expect(mockedSpeak).not.toHaveBeenCalled()
    expect(Object.keys(localStorage)).toEqual(['ld:lastRoomId'])
  })
})

describe('편집 중 전송 — D-17 (R-CHAT-006 · R-CHAT-014 · R-CHAT-007 · R-CHAT-013)', () => {
  it('TC-CH-107: 편집기 열린 채 전송 → speak(auto) 1회 · 편집기 유지 · 생성 중 저장만 disabled + 안내, 취소·입력 활성 → 생성 끝 저장 활성·안내 미렌더 · 캐릭터 버튼은 편집기 열린 동안 계속 disabled(DC-10)', async () => {
    renderChat()
    await screen.findByRole('log')
    const editor = await openEditorOn103()
    const d = await sendToGenerating()
    expect(mockedSpeak.mock.calls).toEqual([['r1', { character: 'auto' }]])
    expect(screen.getByRole('group', { name: '메시지 수정' })).toBe(editor)

    const box = within(editor).getByRole('textbox', { name: '수정할 내용' }) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: '새 본문' } })
    expect(box.value).toBe('새 본문')
    expect(box.readOnly).toBe(false)
    const save = within(editor).getByRole('button', { name: '저장' }) as HTMLButtonElement
    const cancel = within(editor).getByRole('button', { name: '취소' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(cancel.disabled).toBe(false)
    const noteId = save.getAttribute('aria-describedby')
    expect(noteId).not.toBeNull()
    expect(document.getElementById(noteId ?? '')?.textContent).toBe(LOCK_NOTE)
    fireEvent.click(save)
    for (const name of [SEB, CIEL]) expect(btn(name).disabled).toBe(true)

    await act(async () => {
      d.gen.resolve(ok(SEB_REPLY))
    })
    expect(save.disabled).toBe(false)
    expect(screen.queryByText(LOCK_NOTE)).toBeNull()
    for (const name of [SEB, CIEL]) expect(btn(name).disabled).toBe(true) // 편집기 열림 — DC-10
    await flushPending()
    expect(mockedEdit).not.toHaveBeenCalled()

    await userEvent.setup().click(cancel)
    expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()
    expect(btn(SEB).disabled).toBe(false)
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-107: 생성 중 편집 「취소」 → 편집기 닫힘, 중립 "…" 유지, 캐릭터 버튼은 생성 끝까지 disabled → 결과 뒤 활성', async () => {
    renderChat()
    await screen.findByRole('log')
    const editor = await openEditorOn103()
    const d = await sendToGenerating()
    fireEvent.click(within(editor).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('group', { name: '메시지 수정' })).toBeNull()
    expect(neutrals()).toHaveLength(1)
    expect(btn(SEB).disabled).toBe(true)
    await act(async () => {
      d.gen.resolve(ok(CIEL_REPLY))
    })
    expect(btn(SEB).disabled).toBe(false)
    expect(btn(CIEL).disabled).toBe(false)
    expect(mockedEdit).not.toHaveBeenCalled()
    expect(mockedSpeak).toHaveBeenCalledTimes(1)
  })

  const renderEditor = (isSaveLocked: boolean) => {
    const onSave = vi.fn<(text: string) => void>()
    const onCancel = vi.fn<() => void>()
    render(
      <InlineEditor
        message={PAGE.messages[2] as Message}
        isSaving={false}
        isSaveLocked={isSaveLocked}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )
    const box = screen.getByRole('textbox', { name: '수정할 내용' }) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: '새 본문' } })
    return { onSave, onCancel, box, save: btn('저장'), cancel: btn('취소') }
  }

  it('TC-CH-107: (부품) InlineEditor isSaveLocked=true → 저장만 disabled + aria-describedby 안내, 취소·입력 활성', () => {
    const { onSave, onCancel, box, save, cancel } = renderEditor(true)
    expect(box.value).toBe('새 본문')
    expect(box.readOnly).toBe(false)
    expect(save.disabled).toBe(true)
    const noteId = save.getAttribute('aria-describedby')
    expect(document.getElementById(noteId ?? '')?.textContent).toBe(LOCK_NOTE)
    expect(cancel.disabled).toBe(false)
    fireEvent.click(save)
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(cancel)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-107: (부품) InlineEditor isSaveLocked=false → 저장 활성 · 안내 미렌더 · 클릭 → onSave("새 본문")', () => {
    const { onSave, save } = renderEditor(false)
    expect(save.disabled).toBe(false)
    expect(screen.queryByText(LOCK_NOTE)).toBeNull()
    fireEvent.click(save)
    expect(onSave.mock.calls).toEqual([['새 본문']])
  })
})

describe('작성자 표기 (R-CHAT-002 · R-AUTH-004)', () => {
  it.each([
    ['어떠한 의지', '어떠한 의지'],
    ['미샤', '미샤'],
    [null, '어떠한 의지'],
    ['', '어떠한 의지'],
  ] as const)(
    'TC-CH-108: userAuthorLabel(%j) = %s — 받은 값 그대로, 비었을 때만 USER_DISPLAY_NAME',
    (name, expected) => {
      expect(USER_DISPLAY_NAME).toBe('어떠한 의지')
      expect(userAuthorLabel(name)).toBe(expected)
    },
  )

  it.each([
    [USER_DISPLAY_NAME, USER_DISPLAY_NAME],
    ['미샤', '미샤'],
    [null, USER_DISPLAY_NAME],
    ['', USER_DISPLAY_NAME],
  ] as const)(
    'TC-CH-108: (부품) Bubble 유저 authorName=%j → 작성자 줄 %s, 「이름 없음」 없음, 치환 없음',
    (authorName, shown) => {
      const { container } = render(<Bubble message={msg({ id: 1, text: '발화', authorName })} />)
      const root = container.firstElementChild as HTMLElement
      expect(root.classList.contains('user')).toBe(true)
      expect(within(root).getByText(shown)).not.toBeNull()
      expect(screen.queryByText('이름 없음')).toBeNull()
      if (shown !== USER_DISPLAY_NAME) expect(screen.queryByText(USER_DISPLAY_NAME)).toBeNull()
    },
  )

  // S3e: 옛 "TC-CH-108 말풍선 메뉴 머리" it 은 TC-CH-118 버튼 이름 단언으로 대체(메뉴 머리 줄 삭제, actions.md AC §11.2)
  it.each([
    ['미샤', '미샤'],
    [null, USER_DISPLAY_NAME],
  ] as const)(
    'TC-CH-118: (TC-CH-108 대체) 유저 authorName=%j → 버튼 줄 이름 "%s 말풍선 작업"·"%s 대사 수정", 「이름 없음」 없음',
    async (authorName, name) => {
      const page: MessagesPage = {
        ...PAGE,
        messages: PAGE.messages.map(m => (m.id === 103 ? { ...m, authorName } : m)),
      }
      mockedList.mockResolvedValue(ok(page))
      renderChat()
      await screen.findByRole('log')
      const g = within(items()[2] as HTMLElement).getByRole('group', {
        name: `${name} 말풍선 작업`,
      })
      expect(within(g).getByRole('button', { name: `${name} 대사 수정` }).textContent).toBe(
        '수정',
      )
      expect(within(g).getByRole('button', { name: `${name} 대사 삭제` }).textContent).toBe(
        '삭제',
      )
      expect(screen.queryByText(/이름 없음/)).toBeNull()
      await flushPending()
      expect(mockedSpeak).not.toHaveBeenCalled()
    },
  )

  it('TC-CH-108: (토큰 없음) 읽기 전용에서도 같은 규칙 — 옛 값 그대로 · null 은 어떠한 의지, speak 0회', async () => {
    const page: MessagesPage = {
      ...PAGE,
      messages: [
        ...PAGE.messages,
        msg({ id: 105, text: '익명', authorName: null, createdAt: at(16, 44) }),
      ],
    }
    mockedList.mockResolvedValue(ok(page))
    renderChat(READ_ONLY_VIEWER)
    await screen.findByRole('log')
    expect((items()[2] as HTMLElement).textContent).toContain('미샤')
    expect((items()[4] as HTMLElement).textContent).toContain(USER_DISPLAY_NAME)
    expect(screen.queryByText('이름 없음')).toBeNull()
    await flushPending()
    expect(mockedSpeak).not.toHaveBeenCalled()
  })
})

describe('늦은 응답 — 자동 응답 경로 (R-CHAT-006 · R-CHAT-014, F-CH-17 ④ · F-CH-42 비활성)', () => {
  it('TC-CH-063: (S3d-a) 저장 대기 중 언마운트 → 저장 201 도착 → speak 0회, 콜백·console.error 0', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount, onAuthFailure, onBack } = renderChat()
    await screen.findByRole('log')
    const d = armSend()
    typeAndSend('안녕')
    unmount()
    await act(async () => {
      d.save.resolve(ok(SENT))
      await d.save.promise
    })
    await flushPending()
    expect(mockedSpeak).not.toHaveBeenCalled()
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(onBack).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
    expect(mockedAppend).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['성공', ok(SEB_REPLY)],
    ['LLM_FAILED', fail('LLM_FAILED')],
    ['TOKEN_INVALID', fail('TOKEN_INVALID')],
    ['NOT_FOUND', fail('NOT_FOUND')],
  ] as const)(
    'TC-CH-063: (S3d-b) 자동 응답 대기 중 언마운트 → %s 도착 → onAuthFailure·onBack 0회, 저장소 그대로, 재조회 없음',
    async (_label, result) => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { unmount, onAuthFailure, onBack } = renderChat()
      await screen.findByRole('log')
      const d = await sendToGenerating()
      unmount()
      await act(async () => {
        d.gen.resolve(result)
      })
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(onBack).not.toHaveBeenCalled()
      expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
      expect(consoleError).not.toHaveBeenCalled()
      expect(mockedSpeak).toHaveBeenCalledTimes(1)
      expect(mockedList).toHaveBeenCalledTimes(1)
    },
  )
})
