/**
 * chat S4 장기기억 시트 스펙 초안(TDD Red) — 단일 소스 ui/src/chat/test/scenarios.md
 * (TC-CH-122 ~ 133 · 135 ~ 138 화면 단위 + 부품 MemorySheet 콜백. TC-CH-134 App 통합은 AuthTransition.test.tsx, 순수 판정은 ui/src/state/memory.test.ts)
 * 대상: RoomMenuSheet 「장기기억」 · MemorySheet(MemoryEditor ↔ ConfirmDialog 바꿔 그림) · useMemorySheet · useChatSheets(openMemory · memorySaved · memoryLeft)
 * 설계: ui/src/chat/design/memory.md(ME) §0 ~ §9 · 계약 api.md v0.7 §4.17 · §4.18 · §11.16
 * - 화면 단위는 viewer props(WRITER_VIEWER · READ_ONLY_VIEWER). 토큰은 다루지 않는다(래퍼가 헤더를 붙인다).
 * - api 래퍼는 vi.mock('@/api/memory') 의 getMemory · putMemory(화면은 @/api 재노출을 import — 같은 mock). fetch 모킹 금지.
 * - 대기는 deferred 를 act 안에서 직접 resolve. 화면 타이머를 기다리는 TC 가 없어 가짜 시계를 쓰지 않는다. matchMedia 스텁(TextArea).
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ERROR_MESSAGES } from '@shared/errors'
import type { MemoryResponse, MessagesPage, RoomSummary } from '@shared/types'
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
import { createRoom, deleteRoom, listRooms, renameRoom } from '@/api/rooms'
import { ChatScreen } from '@/chat'
import { MemorySheet } from '@/chat/components/MemorySheet'
import { READ_ONLY_VIEWER, WRITER_VIEWER } from '@/state/viewer'

vi.mock('@/api/memory', () => ({
  getMemory: vi.fn(),
  putMemory: vi.fn(),
}))
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

const mockedGet = vi.mocked(getMemory)
const mockedPut = vi.mocked(putMemory)
const mockedList = vi.mocked(listMessages)
/** 장기기억 흐름에서 불리면 안 되는 래퍼 */
const otherWrites = [
  appendUser,
  editMessage,
  deleteMessage,
  speak,
  regenerate,
  listRooms,
  createRoom,
  renameRoom,
  deleteRoom,
].map(f => vi.mocked(f))

const ROOM: RoomSummary = {
  id: 'r1',
  title: '티타임',
  createdAt: new Date(2026, 9, 5, 9, 0).getTime(),
  updatedAt: new Date(2026, 9, 5, 16, 40).getTime(),
  messageCount: 1,
}
const PAGE: MessagesPage = {
  messages: [
    {
      id: 101,
      roomId: 'r1',
      speaker: 'ciel',
      kind: 'line',
      text: '세바스찬, 홍차.',
      authorName: null,
      createdAt: new Date(2026, 9, 5, 16, 40).getTime(),
    },
  ],
  hasMore: false,
}

/** 픽스처 ① 요약 있음 — trim 후 코드 포인트 22자. sourceUntilId 987 은 화면 어디에도 없는 숫자라 미표시 단언에 쓴다 */
const SUMMARY = '시엘은 체스에서 졌다.\n런던 출장 약속.'
const T_UPDATED = new Date(2026, 9, 7, 16, 30).getTime()
const MEM_FULL: MemoryResponse = { summary: SUMMARY, sourceUntilId: 987, updatedAt: T_UPDATED }
/** 픽스처 ② 행 없음 = 빈 요약 */
const MEM_EMPTY: MemoryResponse = { summary: '', sourceUntilId: 0, updatedAt: null }
/** 픽스처 ③ 입력용 4001자(서버는 4000자를 넘겨 주지 않으므로 응답이 아니라 입력 문자열) + 경계 4000자 */
const OVER_4001 = '가'.repeat(4001)
const EXACT_4000 = '가'.repeat(4000)

const MORE = '방 메뉴 열기'
const SHEET = '장기기억'
const INPUT = '장기기억 요약'
const GUIDE = 'AI가 긴 대화를 요약해 기억합니다. 직접 고칠 수 있어요.'
const LOADING = '장기기억을 불러오는 중'
const LOAD_ERROR = '장기기억을 불러오지 못했습니다'
const PLACEHOLDER = '아직 요약이 없습니다'
const OVER_NOTE = '4000자 이하로 줄여 주세요.'
const SAVED = '장기기억을 저장했습니다'
const DISCARD = '고친 내용을 버릴까요?'
const DISCARD_BODY = '저장하지 않은 내용은 사라집니다.'

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
const never = <T,>(): Promise<T> => new Promise<T>(() => {})
const flushPending = async () => {
  await act(async () => {})
}
const storageKeys = (): (string | null)[] =>
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
const btn = (scope: HTMLElement, name: string) =>
  within(scope).getByRole('button', { name }) as HTMLButtonElement
const moreButton = () => screen.getByRole('button', { name: MORE })
const editorSheet = () => screen.getByRole('dialog', { name: SHEET })
const confirmSheet = () => screen.getByRole('alertdialog', { name: DISCARD })
const textboxIn = (sheet: HTMLElement) =>
  within(sheet).getByRole('textbox', { name: INPUT }) as HTMLTextAreaElement

const noop = () => {}
/** App 의 전환을 흉내 내는 하네스: onAuthFailure → spy + READ_ONLY */
const Harness = (props: { onAuthFailure: () => void; onBack: () => void }) => {
  const [viewer, setViewer] = useState(WRITER_VIEWER)
  return (
    <ChatScreen
      room={ROOM}
      viewer={viewer}
      onBack={props.onBack}
      onRoomRenamed={noop}
      onAuthFailure={() => {
        props.onAuthFailure()
        setViewer(READ_ONLY_VIEWER)
      }}
    />
  )
}
const renderChat = () => {
  const onBack = vi.fn()
  const onAuthFailure = vi.fn()
  render(<Harness onBack={onBack} onAuthFailure={onAuthFailure} />)
  return { onBack, onAuthFailure }
}
const openRoomMenu = async () => {
  const user = userEvent.setup()
  await screen.findByRole('log')
  await user.click(moreButton())
  return { user, menu: screen.getByRole('dialog', { name: '방 메뉴' }) }
}
/** ⋯ → 「장기기억」. 조회 결과를 기다리지 않는다 */
const openMemory = async () => {
  const { user, menu } = await openRoomMenu()
  await user.click(within(menu).getByRole('button', { name: SHEET }))
  return { user, sheet: editorSheet() }
}
/** ⋯ → 「장기기억」 → 조회 성공(textbox 등장)까지 */
const openReady = async () => {
  const { user, sheet } = await openMemory()
  const input = (await within(sheet).findByRole('textbox', { name: INPUT })) as HTMLTextAreaElement
  return { user, sheet, input, save: btn(sheet, '저장') }
}
const change = (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } })
}

beforeEach(() => {
  for (const m of [mockedGet, mockedPut, mockedList, ...otherWrites]) m.mockReset()
  mockedList.mockResolvedValue(ok(PAGE))
  // 기본값은 영원히 대기 — TC 별 mock*Once 가 먼저 쓰인다
  mockedGet.mockImplementation(() => never())
  mockedPut.mockImplementation(() => never())
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

describe('⋯ 방 메뉴 「장기기억」 (R-CHAT-001 🔒 · R-CHAT-012 🔒)', () => {
  it('TC-CH-122: ⋯ → 방 메뉴 항목 4개 순서 이름 변경 · 장기기억 · 방 삭제 · 취소, 누르기 전 getMemory 0회', async () => {
    renderChat()
    const { menu } = await openRoomMenu()
    expect(
      within(menu)
        .getAllByRole('button')
        .map(b => b.textContent),
    ).toEqual(['이름 변경', '장기기억', '방 삭제', '취소'])
    expect(screen.queryByRole('dialog', { name: SHEET })).toBeNull()
    await flushPending()
    expect(mockedGet).not.toHaveBeenCalled()
    expect(mockedPut).not.toHaveBeenCalled()
  })
})

describe('열기 · 조회 (R-CHAT-012 🔒 · R-MEM-001 🔒)', () => {
  it('TC-CH-123: 장기기억 → 방 메뉴 닫힘 · 시트 · getMemory(r1) 1회 · 조회 중 status · 저장 disabled · 포커스 닫기', async () => {
    const pending = deferred<Result<MemoryResponse>>()
    mockedGet.mockReturnValueOnce(pending.promise)
    renderChat()
    const { sheet } = await openMemory()

    expect(screen.queryByRole('dialog', { name: '방 메뉴' })).toBeNull()
    expect(sheet.getAttribute('aria-modal')).toBe('true')
    expect(within(sheet).getByRole('heading', { level: 2, name: SHEET })).not.toBeNull()
    expect(within(sheet).getByText(GUIDE)).not.toBeNull()
    expect(within(sheet).getByRole('status').textContent).toBe(LOADING)
    expect(within(sheet).queryByRole('textbox')).toBeNull()
    expect(btn(sheet, '저장').disabled).toBe(true)
    expect(btn(sheet, '취소').disabled).toBe(false)
    expect(document.activeElement).toBe(btn(sheet, '닫기'))
    expect(mockedGet.mock.calls).toEqual([['r1']])
    expect(mockedPut).not.toHaveBeenCalled()

    await act(async () => {
      pending.resolve(ok(MEM_FULL))
    })
  })

  it('TC-CH-124: 조회 성공 → 요약 · 22/4000 · 마지막 갱신 10.07 16:30 · textbox 포커스(첫머리) · sourceUntilId 미표시 · 저장 disabled', async () => {
    mockedGet.mockResolvedValueOnce(ok(MEM_FULL))
    renderChat()
    const { sheet, input, save } = await openReady()

    expect(input.value).toBe(SUMMARY)
    expect(within(sheet).getByText('22/4000')).not.toBeNull()
    const time = sheet.querySelector('time')
    expect(time?.textContent).toBe('10.07 16:30')
    expect(time?.getAttribute('datetime')).toBe('2026-10-07T16:30')
    expect(time?.parentElement?.textContent).toBe('마지막 갱신 10.07 16:30')
    expect(within(sheet).getByText(GUIDE)).not.toBeNull()
    expect(sheet.textContent).not.toContain('987') // sourceUntilId 미표시
    expect(sheet.textContent).not.toContain('출처') // D-40 출처 메타 없음
    expect(save.disabled).toBe(true) // D-41 변경 없음
    expect(save.getAttribute('aria-describedby')).toBeNull()
    expect(input.getAttribute('aria-invalid')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(input))
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(0)

    expect(storageKeys()).toEqual(['ld:lastRoomId'])
    expect(mockedGet.mock.calls).toEqual([['r1']])
    expect(mockedPut).not.toHaveBeenCalled()
  })

  it('TC-CH-125: 빈 요약 { "", 0, null } → textbox "" · placeholder · 갱신 줄 없음 · 0/4000 · 저장 disabled', async () => {
    mockedGet.mockResolvedValueOnce(ok(MEM_EMPTY))
    renderChat()
    const { sheet, input, save } = await openReady()

    expect(input.value).toBe('')
    expect(input.placeholder).toBe(PLACEHOLDER)
    expect(sheet.querySelector('time')).toBeNull()
    expect(within(sheet).queryByText(/마지막 갱신/)).toBeNull()
    expect(within(sheet).getByText('0/4000')).not.toBeNull()
    expect(save.disabled).toBe(true)
    expect(mockedGet.mock.calls).toEqual([['r1']])
    expect(mockedPut).not.toHaveBeenCalled()
  })

  it.each([
    ['NETWORK', '서버에 연결할 수 없습니다.'],
    ['INTERNAL', ERROR_MESSAGES.INTERNAL],
  ] as const)(
    'TC-CH-126: 조회 %s → 시트 안 alert(제목+상세) · textbox 없음 · 포커스 닫기 → 다시 시도 → 조회 중 → 성공 → textbox 포커스',
    async (code, detail) => {
      const retry = deferred<Result<MemoryResponse>>()
      mockedGet.mockResolvedValueOnce(fail(code)).mockReturnValueOnce(retry.promise)
      const { onAuthFailure, onBack } = renderChat()
      const { user, sheet } = await openMemory()

      const alert = await within(sheet).findByRole('alert')
      expect(alert.textContent).toContain(LOAD_ERROR)
      expect(alert.textContent).toContain(detail)
      expect(alert.textContent).not.toContain('SERVER-RAW-MESSAGE')
      expect(screen.getAllByRole('alert')).toHaveLength(1) // E 토스트 없음
      expect(within(sheet).queryByRole('textbox')).toBeNull()
      expect(btn(sheet, '저장').disabled).toBe(true)
      expect(btn(sheet, '취소').disabled).toBe(false)
      expect(document.activeElement).toBe(btn(sheet, '닫기'))

      await user.click(within(alert).getByRole('button', { name: '다시 시도' }))
      expect(within(sheet).getByRole('status').textContent).toBe(LOADING)
      expect(mockedGet.mock.calls).toEqual([['r1'], ['r1']])

      await act(async () => {
        retry.resolve(ok(MEM_FULL))
      })
      expect(within(sheet).queryByRole('alert')).toBeNull()
      const input = textboxIn(sheet)
      expect(input.value).toBe(SUMMARY)
      await waitFor(() => expect(document.activeElement).toBe(input))
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(onBack).not.toHaveBeenCalled()
      expect(mockedPut).not.toHaveBeenCalled()
    },
  )

  it('TC-CH-127: 닫기 → 다시 열기 → getMemory 2회, 두 번째 응답 값 표시(캐시 없음)', async () => {
    const T_SECOND = new Date(2026, 9, 7, 18, 5).getTime()
    mockedGet
      .mockResolvedValueOnce(ok(MEM_FULL))
      .mockResolvedValueOnce(ok({ summary: '두 번째 요약', sourceUntilId: 990, updatedAt: T_SECOND }))
    renderChat()
    const { user, sheet } = await openReady()
    await user.click(btn(sheet, '닫기'))
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(moreButton())
    await user.click(
      within(screen.getByRole('dialog', { name: '방 메뉴' })).getByRole('button', { name: SHEET }),
    )
    const second = editorSheet()
    const input = (await within(second).findByRole('textbox', { name: INPUT })) as HTMLTextAreaElement
    expect(input.value).toBe('두 번째 요약')
    expect(second.querySelector('time')?.parentElement?.textContent).toBe('마지막 갱신 10.07 18:05')
    expect(mockedGet.mock.calls).toEqual([['r1'], ['r1']])
    expect(mockedPut).not.toHaveBeenCalled()
  })
})

describe('편집 · 카운터 (R-CHAT-012 🔒 · R-MEM-001 🔒)', () => {
  it('TC-CH-128: 카운터는 trim 후 코드 포인트, 앞뒤 공백만 덧붙임·원문 복귀는 변경 아님(저장 disabled)', async () => {
    mockedGet.mockResolvedValueOnce(ok(MEM_FULL))
    renderChat()
    const { sheet, input, save } = await openReady()

    const steps: readonly (readonly [string, string, boolean])[] = [
      ['  x  ', '1/4000', false],
      ['😀', '1/4000', false],
      [`  ${SUMMARY}\n`, '22/4000', true],
      [`${SUMMARY}!`, '23/4000', false],
      [SUMMARY, '22/4000', true],
    ]
    for (const [value, counter, disabled] of steps) {
      change(input, value)
      expect(within(sheet).getByText(counter)).not.toBeNull()
      expect(save.disabled).toBe(disabled)
    }
    await flushPending()
    expect(mockedPut).not.toHaveBeenCalled()
    expect(mockedGet).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-129: 4000자 enabled · 안내 없음 / 4001자 over · aria-invalid · 안내 · 저장 disabled · aria-describedby = 안내 id', async () => {
    mockedGet.mockResolvedValueOnce(ok(MEM_FULL))
    renderChat()
    const { sheet, input, save } = await openReady()

    change(input, EXACT_4000)
    const at4000 = within(sheet).getByText('4000/4000')
    expect(at4000.classList.contains('over')).toBe(false)
    expect(within(sheet).queryByText(OVER_NOTE)).toBeNull()
    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(save.disabled).toBe(false)
    expect(save.getAttribute('aria-describedby')).toBeNull()

    change(input, `  ${EXACT_4000}  `)
    expect(within(sheet).getByText('4000/4000')).not.toBeNull()
    expect(save.disabled).toBe(false)

    change(input, OVER_4001)
    const counter = within(sheet).getByText('4001/4000')
    expect(counter.classList.contains('over')).toBe(true)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const note = within(sheet).getByText(OVER_NOTE)
    expect(note.id).not.toBe('')
    expect(save.disabled).toBe(true)
    expect(save.getAttribute('aria-describedby')).toBe(note.id)
    fireEvent.click(save)

    change(input, EXACT_4000)
    expect(within(sheet).queryByText(OVER_NOTE)).toBeNull()
    expect(save.getAttribute('aria-describedby')).toBeNull()
    expect(save.disabled).toBe(false)
    await flushPending()
    expect(mockedPut).not.toHaveBeenCalled()
  })

  it('TC-CH-130: 요약을 전부 지움 → 저장 enabled → confirm 없이 putMemory(r1, { summary: "" }) 1회 → 시트 닫힘 · 성공 토스트', async () => {
    mockedGet.mockResolvedValueOnce(ok(MEM_FULL))
    mockedPut.mockResolvedValueOnce(
      ok({ summary: '', sourceUntilId: 987, updatedAt: new Date(2026, 9, 7, 17, 0).getTime() }),
    )
    renderChat()
    const { user, sheet, input, save } = await openReady()

    change(input, '')
    expect(within(sheet).getByText('0/4000')).not.toBeNull()
    expect(input.placeholder).toBe(PLACEHOLDER)
    expect(save.disabled).toBe(false)
    await user.click(save)
    expect(screen.queryByRole('alertdialog')).toBeNull() // D-39 비우기 confirm 없음

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('alert').textContent).toBe(SAVED)
    expect(mockedPut.mock.calls).toEqual([['r1', { summary: '' }]])
  })
})

describe('저장 (R-CHAT-012 🔒 · R-CHAT-011)', () => {
  it('TC-CH-131: 저장 대기 중 readOnly·버튼 잠금·Esc·덮개 무시·연타 1회 → 200 → 시트 닫힘 · success 토스트 · ⋯ 포커스 · 원문 그대로 전송', async () => {
    const DRAFT = '  시엘은 체스에서 이겼다.  '
    const pending = deferred<Result<MemoryResponse>>()
    mockedGet.mockResolvedValueOnce(ok(MEM_FULL))
    mockedPut.mockReturnValueOnce(pending.promise)
    const { onAuthFailure, onBack } = renderChat()
    const { user, sheet, input, save } = await openReady()

    change(input, DRAFT)
    await user.click(save)
    expect(mockedPut.mock.calls).toEqual([['r1', { summary: DRAFT }]]) // 화면은 trim 하지 않는다
    expect(input.readOnly).toBe(true)
    for (const name of ['닫기', '취소', '저장']) expect(btn(sheet, name).disabled).toBe(true)
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.click(sheet.parentElement as HTMLElement)
    expect(editorSheet()).toBe(sheet)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    fireEvent.click(save)
    expect(mockedPut).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(
        ok({
          summary: '시엘은 체스에서 이겼다.',
          sourceUntilId: 987,
          updatedAt: new Date(2026, 9, 7, 17, 10).getTime(),
        }),
      )
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.textContent).toBe(SAVED)
    expect(alerts[0]?.classList.contains('success')).toBe(true)
    await waitFor(() => expect(document.activeElement).toBe(moreButton()))

    // 채팅 상태 불변(D-33) · 저장소에 요약·토큰 없음
    expect(within(screen.getByRole('log')).getAllByRole('listitem')).toHaveLength(1)
    expect(storageKeys()).toEqual(['ld:lastRoomId'])
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(onBack).not.toHaveBeenCalled()
    expect(mockedGet).toHaveBeenCalledTimes(1)
    expect(mockedList).toHaveBeenCalledTimes(1)
    for (const m of otherWrites) expect(m).not.toHaveBeenCalled()
  })

  it.each([
    ['INTERNAL', undefined, ERROR_MESSAGES.INTERNAL],
    ['RATE_LIMITED', 12, '요청이 너무 많습니다. 12초 후 다시 시도해 주세요.'],
    ['RATE_LIMITED', undefined, ERROR_MESSAGES.RATE_LIMITED],
    ['VALIDATION_ERROR', undefined, '장기기억은 0~4000자로 입력해 주세요.'],
    ['NETWORK', undefined, '서버에 연결할 수 없습니다.'],
  ] as const)(
    'TC-CH-132: 저장 %s(%s) → 시트 유지 · 입력 유지 · 시트 안 alert · E 토스트 없음 · 버튼 활성 → 다시 저장 시작 시 alert 비움',
    async (code, sec, text) => {
      const second = deferred<Result<MemoryResponse>>()
      mockedGet.mockResolvedValueOnce(ok(MEM_FULL))
      mockedPut.mockResolvedValueOnce(fail(code, sec)).mockReturnValueOnce(second.promise)
      const { onAuthFailure, onBack } = renderChat()
      const { user, sheet, input, save } = await openReady()

      change(input, '새 요약')
      await user.click(save)
      const alert = await within(sheet).findByRole('alert')
      expect(alert.textContent).toBe(text)
      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(editorSheet()).toBe(sheet)
      expect(input.value).toBe('새 요약')
      expect(input.readOnly).toBe(false)
      for (const name of ['닫기', '취소', '저장']) expect(btn(sheet, name).disabled).toBe(false)
      expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(onBack).not.toHaveBeenCalled()

      await user.click(save)
      expect(within(sheet).queryByRole('alert')).toBeNull()
      expect(mockedPut.mock.calls).toEqual([
        ['r1', { summary: '새 요약' }],
        ['r1', { summary: '새 요약' }],
      ])
      await act(async () => {
        second.resolve(ok({ ...MEM_FULL, summary: '새 요약' }))
      })
    },
  )

  it('TC-CH-133: (a) 조회 NOT_FOUND → 시트 닫힘 · 기록 삭제 후 onBack 1회 · 토스트 없음', async () => {
    localStorage.setItem('ld:lastRoomId', 'r1')
    // v1.0.1: 이탈로 끝나는 조회는 대기 Promise 로 준다(이미 resolve 된 mock 이면 클릭 직후 시트가 닫혀 openMemory 의 질의가 실패)
    const pending = deferred<Result<MemoryResponse>>()
    mockedGet.mockReturnValueOnce(pending.promise)
    const { onBack, onAuthFailure } = renderChat()
    let lastAtBack: string | null | undefined
    onBack.mockImplementation(() => {
      lastAtBack = localStorage.getItem('ld:lastRoomId')
    })
    const { sheet } = await openMemory()
    expect(within(sheet).getByRole('status').textContent).toBe(LOADING)
    await act(async () => {
      pending.resolve(fail('NOT_FOUND'))
    })

    await vi.waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
    expect(lastAtBack).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(mockedGet.mock.calls).toEqual([['r1']])
    expect(mockedPut).not.toHaveBeenCalled()
  })

  it('TC-CH-133: (b) 저장 NOT_FOUND → 시트 닫힘 · 기록 삭제 후 onBack 1회 · 토스트 없음', async () => {
    mockedGet.mockResolvedValueOnce(ok(MEM_FULL))
    mockedPut.mockResolvedValueOnce(fail('NOT_FOUND'))
    const { onBack, onAuthFailure } = renderChat()
    let lastAtBack: string | null | undefined
    onBack.mockImplementation(() => {
      lastAtBack = localStorage.getItem('ld:lastRoomId')
    })
    const { user, input, save } = await openReady()
    change(input, '새 요약')
    await user.click(save)

    await vi.waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
    expect(lastAtBack).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(mockedPut.mock.calls).toEqual([['r1', { summary: '새 요약' }]])
  })
})

describe('버림 확인 (R-CHAT-012 🔒 · D-34)', () => {
  it('TC-CH-135: (a) 변경 후 취소 → alertdialog(시트와 겹치지 않음) · 첫 포커스 계속 고치기 → 편집 복귀 · 초안 유지 · textbox 포커스', async () => {
    mockedGet.mockResolvedValueOnce(ok(MEM_FULL))
    renderChat()
    const { user, sheet, input } = await openReady()
    change(input, '고친 요약')
    await user.click(btn(sheet, '취소'))

    const confirm = confirmSheet()
    expect(screen.queryByRole('dialog', { name: SHEET })).toBeNull()
    expect(confirm.textContent).toContain(DISCARD_BODY)
    expect(
      within(confirm)
        .getAllByRole('button')
        .map(b => b.textContent),
    ).toEqual(['계속 고치기', '버리기'])
    expect(document.activeElement).toBe(btn(confirm, '계속 고치기'))

    await user.click(btn(confirm, '계속 고치기'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    const again = editorSheet()
    const input2 = textboxIn(again)
    expect(input2.value).toBe('고친 요약')
    expect(within(again).getByText('5/4000')).not.toBeNull()
    expect(btn(again, '저장').disabled).toBe(false)
    await waitFor(() => expect(document.activeElement).toBe(input2))
    await flushPending()
    expect(mockedGet).toHaveBeenCalledTimes(1)
    expect(mockedPut).not.toHaveBeenCalled()
  })

  it('TC-CH-135: (b) 닫기·Esc·덮개 모두 확인 → 확인의 Esc·덮개 = 계속 고치기 → 버리기 → 시트 없음 · ⋯ 포커스 · putMemory 0 · 다시 열면 서버 요약', async () => {
    mockedGet.mockResolvedValue(ok(MEM_FULL))
    renderChat()
    const { user, sheet, input } = await openReady()
    change(input, '고친 요약')

    await user.click(btn(sheet, '닫기'))
    fireEvent.keyDown(confirmSheet(), { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(textboxIn(editorSheet()).value).toBe('고친 요약')

    fireEvent.keyDown(textboxIn(editorSheet()), { key: 'Escape' })
    fireEvent.click(confirmSheet().parentElement as HTMLElement)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(textboxIn(editorSheet()).value).toBe('고친 요약')

    fireEvent.click(editorSheet().parentElement as HTMLElement)
    await user.click(btn(confirmSheet(), '버리기'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(moreButton()))
    expect(mockedGet).toHaveBeenCalledTimes(1)

    await user.click(moreButton())
    await user.click(
      within(screen.getByRole('dialog', { name: '방 메뉴' })).getByRole('button', { name: SHEET }),
    )
    const reopened = (await within(editorSheet()).findByRole('textbox', {
      name: INPUT,
    })) as HTMLTextAreaElement
    expect(reopened.value).toBe(SUMMARY)
    expect(mockedGet).toHaveBeenCalledTimes(2)
    expect(mockedPut).not.toHaveBeenCalled()
  })

  it('TC-CH-135: (c) 변경 없음(앞뒤 공백만) · 조회 중 · 조회 실패 → 확인 없이 닫힘 · ⋯ 포커스', async () => {
    const loading = deferred<Result<MemoryResponse>>()
    mockedGet
      .mockResolvedValueOnce(ok(MEM_FULL))
      .mockReturnValueOnce(loading.promise)
      .mockResolvedValueOnce(fail('INTERNAL'))
    renderChat()
    const { user, sheet, input } = await openReady()
    change(input, `  ${SUMMARY}  `)
    await user.click(btn(sheet, '취소'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(moreButton()))

    await user.click(moreButton())
    await user.click(screen.getByRole('button', { name: SHEET }))
    expect(within(editorSheet()).getByRole('status').textContent).toBe(LOADING)
    await user.click(btn(editorSheet(), '취소'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(moreButton())
    await user.click(screen.getByRole('button', { name: SHEET }))
    await within(editorSheet()).findByRole('alert')
    await user.click(btn(editorSheet(), '닫기'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(moreButton()))

    await act(async () => {
      loading.resolve(ok(MEM_FULL))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockedGet).toHaveBeenCalledTimes(3)
    expect(mockedPut).not.toHaveBeenCalled()
  })
})

describe('토큰 없음 (R-CHAT-008 · R-MEM-001 🔒 · R-NFR-004)', () => {
  it('TC-CH-136: READ_ONLY → ⋯ · 장기기억 항목 · 시트 없음, getMemory·putMemory 0회, 저장소에 토큰·요약 없음', async () => {
    render(
      <ChatScreen
        room={ROOM}
        viewer={READ_ONLY_VIEWER}
        onBack={vi.fn()}
        onAuthFailure={vi.fn()}
        onRoomRenamed={vi.fn()}
      />,
    )
    await screen.findByRole('log')
    expect(screen.queryByRole('button', { name: MORE })).toBeNull()
    expect(screen.queryByRole('button', { name: SHEET })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(/장기기억/)).toBeNull()
    await flushPending()
    expect(storageKeys()).toEqual(['ld:lastRoomId'])
    expect(mockedGet).not.toHaveBeenCalled()
    expect(mockedPut).not.toHaveBeenCalled()
    expect(mockedList).toHaveBeenCalledTimes(1)
  })
})

describe('늦은 응답 무시 (R-CHAT-012 🔒 · ME §2 aliveRef)', () => {
  it.each<[string, Result<MemoryResponse>]>([
    ['요약 있음', ok(MEM_FULL)],
    ['NOT_FOUND', fail('NOT_FOUND')],
    ['TOKEN_INVALID', fail('TOKEN_INVALID')],
  ])(
    'TC-CH-137: (a) 조회 대기 중 닫기 → 늦은 %s 응답 → 시트·토스트·onBack·전환 변화 없음',
    async (_label, late) => {
      const pending = deferred<Result<MemoryResponse>>()
      mockedGet.mockReturnValueOnce(pending.promise)
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { onBack, onAuthFailure } = renderChat()
      const { user, sheet } = await openMemory()
      await user.click(btn(sheet, '닫기'))
      expect(screen.queryByRole('dialog')).toBeNull()

      await act(async () => {
        pending.resolve(late)
        await pending.promise
      })
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.queryAllByRole('alert')).toHaveLength(0)
      expect(moreButton()).not.toBeNull()
      expect(onBack).not.toHaveBeenCalled()
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
      expect(errorSpy).not.toHaveBeenCalled()
      expect(mockedGet).toHaveBeenCalledTimes(1)
      expect(mockedPut).not.toHaveBeenCalled()
    },
  )

  it('TC-CH-137: (b) 첫 시트의 늦은 응답은 다시 연 시트에 끼어들지 않는다', async () => {
    const first = deferred<Result<MemoryResponse>>()
    const second = deferred<Result<MemoryResponse>>()
    mockedGet.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    renderChat()
    const { user, sheet } = await openMemory()
    await user.click(btn(sheet, '닫기'))
    await user.click(moreButton())
    await user.click(screen.getByRole('button', { name: SHEET }))
    const reopened = editorSheet()

    await act(async () => {
      first.resolve(ok({ ...MEM_FULL, summary: '첫 응답' }))
    })
    expect(within(reopened).getByRole('status').textContent).toBe(LOADING)
    expect(within(reopened).queryByRole('textbox')).toBeNull()

    await act(async () => {
      second.resolve(ok(MEM_FULL))
    })
    expect(textboxIn(editorSheet()).value).toBe(SUMMARY)
    expect(mockedGet).toHaveBeenCalledTimes(2)
    expect(mockedPut).not.toHaveBeenCalled()
  })
})

describe('접근성 (R-CHAT-013 🔒)', () => {
  it('TC-CH-138: dialog 이름·aria-modal · 카운터 aria-hidden · Enter = 줄바꿈 · Tab 순환(저장 enabled/disabled)', async () => {
    mockedGet.mockResolvedValueOnce(ok(MEM_FULL))
    renderChat()
    const { user, sheet, input, save } = await openReady()
    expect(sheet.getAttribute('aria-modal')).toBe('true')
    expect(sheet.getAttribute('aria-label')).toBe(SHEET)
    expect(within(sheet).getByText('22/4000').getAttribute('aria-hidden')).toBe('true')

    await user.type(input, 'z{Enter}', {
      initialSelectionStart: SUMMARY.length,
      initialSelectionEnd: SUMMARY.length,
    })
    expect(input.value).toBe(`${SUMMARY}z\n`)
    expect(editorSheet()).toBe(sheet)
    expect(save.disabled).toBe(false)

    const close = btn(sheet, '닫기')
    const cancel = btn(sheet, '취소')
    close.focus()
    await user.tab()
    expect(document.activeElement).toBe(input)
    await user.tab()
    expect(document.activeElement).toBe(cancel)
    await user.tab()
    expect(document.activeElement).toBe(save)
    await user.tab()
    expect(document.activeElement).toBe(close)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(save)

    change(input, SUMMARY)
    expect(save.disabled).toBe(true)
    close.focus()
    await user.tab()
    expect(document.activeElement).toBe(input)
    await user.tab()
    expect(document.activeElement).toBe(cancel)
    await user.tab()
    expect(document.activeElement).toBe(close)

    await flushPending()
    expect(mockedPut).not.toHaveBeenCalled()
  })
})

describe('MemorySheet 부품 — 콜백 계약 (F-CH-54 ~ 59, ME §1.2)', () => {
  const renderSheet = () => {
    const onClose = vi.fn()
    const onSaved = vi.fn()
    const onLeave = vi.fn()
    const view = render(
      <MemorySheet roomId="r1" onClose={onClose} onSaved={onSaved} onLeave={onLeave} />,
    )
    return { ...view, onClose, onSaved, onLeave, user: userEvent.setup() }
  }
  const readyInput = async () =>
    (await screen.findByRole('textbox', { name: INPUT })) as HTMLTextAreaElement

  it('TC-CH-131: (부품) 저장 200 → onSaved 1회 · onClose·onLeave 0회 · putMemory(roomId, 원문)', async () => {
    mockedGet.mockResolvedValueOnce(ok(MEM_FULL))
    mockedPut.mockResolvedValueOnce(ok({ ...MEM_FULL, summary: '새 요약' }))
    const { user, onClose, onSaved, onLeave } = renderSheet()
    change(await readyInput(), ' 새 요약 ')
    await user.click(screen.getByRole('button', { name: '저장' }))
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onClose).not.toHaveBeenCalled()
    expect(onLeave).not.toHaveBeenCalled()
    expect(mockedGet.mock.calls).toEqual([['r1']])
    expect(mockedPut.mock.calls).toEqual([['r1', { summary: ' 새 요약 ' }]])
  })

  it('TC-CH-132: (부품) 저장 INTERNAL → 콜백 0회 · 시트 안 alert', async () => {
    mockedGet.mockResolvedValueOnce(ok(MEM_FULL))
    mockedPut.mockResolvedValueOnce(fail('INTERNAL'))
    const { user, onClose, onSaved, onLeave } = renderSheet()
    change(await readyInput(), '새 요약')
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect((await screen.findByRole('alert')).textContent).toBe(ERROR_MESSAGES.INTERNAL)
    expect(onClose).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('TC-CH-133: (부품) 조회 NOT_FOUND → onLeave(error) 1회 · 시트 안 alert 없음', async () => {
    mockedGet.mockResolvedValueOnce(fail('NOT_FOUND'))
    const { onClose, onSaved, onLeave } = renderSheet()
    await vi.waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1))
    expect(onLeave.mock.calls[0]?.[0]).toMatchObject({ code: 'NOT_FOUND' })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('TC-CH-134: (부품) 저장 TOKEN_INVALID → onLeave(error) 1회 · 시트 안 alert 없음', async () => {
    mockedGet.mockResolvedValueOnce(ok(MEM_FULL))
    mockedPut.mockResolvedValueOnce(fail('TOKEN_INVALID'))
    const { user, onClose, onSaved, onLeave } = renderSheet()
    change(await readyInput(), '고친 요약')
    await user.click(screen.getByRole('button', { name: '저장' }))
    await vi.waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1))
    expect(onLeave.mock.calls[0]?.[0]).toMatchObject({ code: 'TOKEN_INVALID' })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('TC-CH-135: (부품) 버리기 → onClose 1회 · putMemory 0회', async () => {
    mockedGet.mockResolvedValueOnce(ok(MEM_FULL))
    const { user, onClose, onSaved, onLeave } = renderSheet()
    change(await readyInput(), '고친 요약')
    await user.click(screen.getByRole('button', { name: '취소' }))
    expect(onClose).not.toHaveBeenCalled()
    await user.click(btn(confirmSheet(), '버리기'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSaved).not.toHaveBeenCalled()
    expect(onLeave).not.toHaveBeenCalled()
    expect(mockedPut).not.toHaveBeenCalled()
  })

  it('TC-CH-135: (부품) 변경 없이 취소 → 확인 없이 onClose 1회', async () => {
    mockedGet.mockResolvedValueOnce(ok(MEM_FULL))
    const { user, onClose } = renderSheet()
    await readyInput()
    await user.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-137: (부품) 조회 대기 중 언마운트 → 늦은 TOKEN_INVALID 에도 콜백 0회 · console.error 0회', async () => {
    const pending = deferred<Result<MemoryResponse>>()
    mockedGet.mockReturnValueOnce(pending.promise)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount, onClose, onSaved, onLeave } = renderSheet()
    unmount()
    await act(async () => {
      pending.resolve(fail('TOKEN_INVALID'))
      await pending.promise
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(onLeave).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
