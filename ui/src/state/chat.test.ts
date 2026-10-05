/**
 * chat 리듀서 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md (TC-CH-015 · TC-CH-016)
 * 대상: ui/src/state/chat.ts (chat design/functions.md §1 전이표 T1~T12 · §1.2 순수 함수, F-CH-12)
 * "그대로" = 같은 객체 참조(toBe). 입력 상태는 Object.freeze 로 얼려 변경 시도를 잡는다(ESM strict).
 */
import { describe, expect, it } from 'vitest'
import type { Message, MessagesPage } from '@shared/types'
import type { ApiError } from '@/api'
import {
  type ChatState,
  canAutoLoadOlder,
  canLoadOlder,
  chatReducer,
  initialChatState,
  mergeMessages,
  nextBefore,
} from '@/state/chat'

const msg = (id: number, text = `본문 ${id}`): Message => ({
  id,
  roomId: 'r1',
  speaker: 'ciel',
  kind: 'line',
  text,
  authorName: null,
  createdAt: 1_767_225_600_000 + id * 60_000,
})
const ids = (messages: readonly Message[]): number[] => messages.map(x => x.id)
const page = (messages: Message[], hasMore: boolean): MessagesPage => ({ messages, hasMore })
const ERR: ApiError = { code: 'INTERNAL', message: 'x' }
const NET: ApiError = { code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }

const freeze = (s: ChatState): ChatState =>
  Object.freeze({ ...s, messages: Object.freeze([...s.messages]) as Message[] })
const ready = (over: Partial<ChatState> = {}): ChatState =>
  freeze({
    ...initialChatState,
    phase: 'ready',
    messages: [msg(31), msg(32), msg(33)],
    hasMore: true,
    ...over,
  })

describe('chatReducer T1~T8 (R-CHAT-003)', () => {
  it('TC-CH-015: 초기값은 { loading, null, [], false, false, null, 0 }', () => {
    expect(initialChatState).toEqual({
      phase: 'loading',
      error: null,
      messages: [],
      hasMore: false,
      isLoadingOlder: false,
      olderError: null,
      unseenCount: 0,
    })
  })

  it('TC-CH-015: T1 initialLoadStarted → 초기 상태(어느 상태에서든)', () => {
    const fromError = freeze({ ...initialChatState, phase: 'error', error: ERR })
    expect(chatReducer(fromError, { type: 'initialLoadStarted' })).toEqual(initialChatState)
    expect(chatReducer(ready({ unseenCount: 2 }), { type: 'initialLoadStarted' })).toEqual(
      initialChatState,
    )
  })

  it('TC-CH-015: T2 initialLoadSucceeded → ready, 정렬·중복 제거, hasMore 반영', () => {
    const next = chatReducer(freeze(initialChatState), {
      type: 'initialLoadSucceeded',
      page: page([msg(33), msg(31), msg(32), msg(31, '나중 값')], true),
    })
    expect(next.phase).toBe('ready')
    expect(next.error).toBeNull()
    expect(ids(next.messages)).toEqual([31, 32, 33])
    expect(next.hasMore).toBe(true)
    expect(next.isLoadingOlder).toBe(false)
    expect(next.unseenCount).toBe(0)
  })

  it('TC-CH-015: T3 initialLoadFailed → error, 나머지 초기값', () => {
    const next = chatReducer(freeze(initialChatState), { type: 'initialLoadFailed', error: NET })
    expect(next).toEqual({ ...initialChatState, phase: 'error', error: NET })
  })

  it('TC-CH-015: T4 olderLoadStarted(canLoadOlder) → isLoadingOlder=true, olderError=null', () => {
    const next = chatReducer(ready({ olderError: ERR }), { type: 'olderLoadStarted' })
    expect(next.isLoadingOlder).toBe(true)
    expect(next.olderError).toBeNull()
    expect(ids(next.messages)).toEqual([31, 32, 33])
  })

  it.each([
    ['phase=loading', freeze({ ...initialChatState, hasMore: true, messages: [msg(31)] })],
    ['hasMore=false', ready({ hasMore: false })],
    ['isLoadingOlder=true', ready({ isLoadingOlder: true })],
    ['messages=[]', ready({ messages: [] })],
  ])('TC-CH-015: T5 olderLoadStarted 조건 불충족(%s) → 그대로(같은 참조)', (_label, state) => {
    expect(chatReducer(state, { type: 'olderLoadStarted' })).toBe(state)
  })

  it('TC-CH-015: T6 olderLoadSucceeded(isLoadingOlder) → 앞에 합침, hasMore 갱신, 로딩 해제', () => {
    const next = chatReducer(ready({ isLoadingOlder: true }), {
      type: 'olderLoadSucceeded',
      page: page([msg(29), msg(30)], true),
    })
    expect(ids(next.messages)).toEqual([29, 30, 31, 32, 33])
    expect(next.hasMore).toBe(true)
    expect(next.isLoadingOlder).toBe(false)
  })

  it('TC-CH-015: T6 빈 페이지면 hasMore=true 가 와도 false', () => {
    const next = chatReducer(ready({ isLoadingOlder: true }), {
      type: 'olderLoadSucceeded',
      page: page([], true),
    })
    expect(next.hasMore).toBe(false)
    expect(next.isLoadingOlder).toBe(false)
    expect(ids(next.messages)).toEqual([31, 32, 33])
  })

  it('TC-CH-015: T7 isLoadingOlder=false 일 때 늦은 olderLoadSucceeded·olderLoadFailed → 그대로', () => {
    const state = ready({ isLoadingOlder: false })
    expect(chatReducer(state, { type: 'olderLoadSucceeded', page: page([msg(1)], false) })).toBe(
      state,
    )
    expect(chatReducer(state, { type: 'olderLoadFailed', error: ERR })).toBe(state)
  })

  it('TC-CH-015: T8 olderLoadFailed(isLoadingOlder) → 로딩 해제, olderError 기록, 말풍선 유지', () => {
    const next = chatReducer(ready({ isLoadingOlder: true }), {
      type: 'olderLoadFailed',
      error: ERR,
    })
    expect(next.isLoadingOlder).toBe(false)
    expect(next.olderError).toEqual(ERR)
    expect(ids(next.messages)).toEqual([31, 32, 33])
    expect(next.hasMore).toBe(true)
  })
})

describe('chatReducer T9~T12 · 순수 함수 (R-CHAT-003 · R-MSG-001)', () => {
  it('TC-CH-016: T9 messagesAppended 위쪽을 보는 중 → unseenCount += 새 id 수(기존 끝 id 초과분만)', () => {
    const next = chatReducer(ready({ unseenCount: 1 }), {
      type: 'messagesAppended',
      messages: [msg(33, '고친 본문'), msg(34), msg(35)],
      isNearBottom: false,
    })
    expect(ids(next.messages)).toEqual([31, 32, 33, 34, 35])
    expect(next.messages[2]?.text).toBe('고친 본문') // 같은 id 는 incoming 이 이긴다
    expect(next.unseenCount).toBe(3) // 1 + 2
  })

  it('TC-CH-016: T9 맨 아래 근처 → unseenCount=0', () => {
    const next = chatReducer(ready({ unseenCount: 4 }), {
      type: 'messagesAppended',
      messages: [msg(34)],
      isNearBottom: true,
    })
    expect(next.unseenCount).toBe(0)
    expect(ids(next.messages)).toEqual([31, 32, 33, 34])
  })

  it('TC-CH-016: T10 phase!==ready 에서 messagesAppended → 그대로', () => {
    const loading = freeze(initialChatState)
    const failed = freeze({ ...initialChatState, phase: 'error', error: ERR })
    expect(
      chatReducer(loading, { type: 'messagesAppended', messages: [msg(1)], isNearBottom: false }),
    ).toBe(loading)
    expect(
      chatReducer(failed, { type: 'messagesAppended', messages: [msg(1)], isNearBottom: true }),
    ).toBe(failed)
  })

  it('TC-CH-016: T11 unseenCleared(unseenCount>0) → 0 / T12 이미 0 → 그대로', () => {
    expect(chatReducer(ready({ unseenCount: 2 }), { type: 'unseenCleared' }).unseenCount).toBe(0)
    const zero = ready({ unseenCount: 0 })
    expect(chatReducer(zero, { type: 'unseenCleared' })).toBe(zero)
  })

  it('TC-CH-016: mergeMessages — id 합집합, incoming 우선, 오름차순, 입력 불변', () => {
    const current = Object.freeze([msg(3), msg(1)]) as readonly Message[]
    const incoming = Object.freeze([msg(2), msg(3, '새 값')]) as readonly Message[]
    const merged = mergeMessages(current, incoming)
    expect(ids(merged)).toEqual([1, 2, 3])
    expect(merged[2]?.text).toBe('새 값')
    expect(ids(current)).toEqual([3, 1])
    expect(ids(incoming)).toEqual([2, 3])
    expect(mergeMessages([], [])).toEqual([])
  })

  it('TC-CH-016: canLoadOlder / canAutoLoadOlder 진리표', () => {
    expect(canLoadOlder(ready())).toBe(true)
    expect(canLoadOlder(ready({ hasMore: false }))).toBe(false)
    expect(canLoadOlder(ready({ isLoadingOlder: true }))).toBe(false)
    expect(canLoadOlder(ready({ messages: [] }))).toBe(false)
    expect(canLoadOlder(freeze({ ...initialChatState, hasMore: true, messages: [msg(1)] }))).toBe(
      false,
    )
    // olderError 가 있어도 버튼 재시도는 가능(canLoadOlder true), 스크롤 자동 재시도는 불가
    expect(canLoadOlder(ready({ olderError: ERR }))).toBe(true)
    expect(canAutoLoadOlder(ready({ olderError: ERR }))).toBe(false)
    expect(canAutoLoadOlder(ready())).toBe(true)
    expect(canAutoLoadOlder(ready({ hasMore: false }))).toBe(false)
  })

  it('TC-CH-016: nextBefore — hasMore 이고 메시지가 있으면 messages[0].id, 아니면 null', () => {
    expect(nextBefore(ready())).toBe(31)
    expect(nextBefore(ready({ hasMore: false }))).toBeNull()
    expect(nextBefore(ready({ messages: [] }))).toBeNull()
  })
})
