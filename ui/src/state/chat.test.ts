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
  canSend,
  canSpeak,
  isRegenerateTarget,
  regenerateTargetIdOf,
  speakingCharacterOf,
  type MessageWrite,
  type PendingSpeak,
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

// ── S2 (TC-CH-053) — functions.md §1.1 T1 비고 · T13~T26 · §1.2 canSend ─────────────
const SEND: MessageWrite = { kind: 'send' }
const EDIT32: MessageWrite = { kind: 'edit', messageId: 32 }
const DEL32: MessageWrite = { kind: 'delete', messageId: 32 }

describe('chatReducer S2 초기값·T1 비고 (R-CHAT-006 · R-CHAT-007)', () => {
  it('TC-CH-053: 초기값 10필드 — S2 writing·editingId · S3 pending 은 null(Q-05)', () => {
    expect(initialChatState).toEqual({
      phase: 'loading',
      error: null,
      messages: [],
      hasMore: false,
      isLoadingOlder: false,
      olderError: null,
      unseenCount: 0,
      writing: null,
      editingId: null,
      pending: null,
    })
  })

  it('TC-CH-053: T1 을 ready 에서 받으면(삭제 뒤 재로드) editingId·unseenCount 도 초기화', () => {
    const next = chatReducer(ready({ editingId: 32, unseenCount: 2 }), {
      type: 'initialLoadStarted',
    })
    expect(next).toEqual(initialChatState)
  })
})

describe('chatReducer T13~T16 writeStarted·writeFinished (R-CHAT-006)', () => {
  it('TC-CH-053: T13 ready·writing null → writing 설정, 나머지 그대로', () => {
    const before = ready()
    const next = chatReducer(before, { type: 'writeStarted', write: SEND })
    expect(next.writing).toEqual(SEND)
    expect(next.messages).toBe(before.messages)
    expect(next.editingId).toBeNull()
    expect(chatReducer(ready(), { type: 'writeStarted', write: DEL32 }).writing).toEqual(DEL32)
  })

  it('TC-CH-053: T14 loading·error·이미 쓰기 중 → 같은 참조(거절)', () => {
    const loading = freeze(initialChatState)
    const error = freeze({ ...initialChatState, phase: 'error', error: ERR })
    const busy = ready({ writing: SEND })
    expect(chatReducer(loading, { type: 'writeStarted', write: SEND })).toBe(loading)
    expect(chatReducer(error, { type: 'writeStarted', write: SEND })).toBe(error)
    expect(chatReducer(busy, { type: 'writeStarted', write: EDIT32 })).toBe(busy)
  })

  it('TC-CH-053: T15 writing 있음 → null / T16 없음 → 같은 참조', () => {
    expect(chatReducer(ready({ writing: EDIT32 }), { type: 'writeFinished' }).writing).toBeNull()
    const idle = ready()
    expect(chatReducer(idle, { type: 'writeFinished' })).toBe(idle)
  })
})

describe('chatReducer T17~T20 messageReplaced·messageRemoved (R-CHAT-007 · R-MSG-004 · R-MSG-005)', () => {
  it('TC-CH-053: T17 같은 id 교체(순서 유지, 새 배열), 편집 중이던 id 면 editingId null', () => {
    const before = ready({ editingId: 32 })
    const next = chatReducer(before, { type: 'messageReplaced', message: msg(32, '새 본문') })
    expect(ids(next.messages)).toEqual([31, 32, 33])
    expect(next.messages[1]?.text).toBe('새 본문')
    expect(next.messages).not.toBe(before.messages)
    expect(next.editingId).toBeNull()
  })

  it('TC-CH-053: T17 다른 메시지를 편집 중이면 editingId 유지', () => {
    const next = chatReducer(ready({ editingId: 31 }), {
      type: 'messageReplaced',
      message: msg(32, '새 본문'),
    })
    expect(next.editingId).toBe(31)
  })

  it('TC-CH-053: T18 없는 id → 같은 참조', () => {
    const before = ready()
    expect(chatReducer(before, { type: 'messageReplaced', message: msg(99) })).toBe(before)
  })

  it('TC-CH-053: T19 같은 id 제거, 편집 중이던 id 면 editingId null / T20 없는 id → 같은 참조', () => {
    const next = chatReducer(ready({ editingId: 32 }), { type: 'messageRemoved', messageId: 32 })
    expect(ids(next.messages)).toEqual([31, 33])
    expect(next.editingId).toBeNull()
    expect(
      chatReducer(ready({ editingId: 31 }), { type: 'messageRemoved', messageId: 32 }).editingId,
    ).toBe(31)
    const before = ready()
    expect(chatReducer(before, { type: 'messageRemoved', messageId: 99 })).toBe(before)
  })
})

describe('chatReducer T21~T26 편집·전환 (R-CHAT-007 · R-CHAT-011)', () => {
  it('TC-CH-053: T21 ready·쓰기 없음·id 있음 → editingId, 다른 편집 중이면 바뀜', () => {
    expect(chatReducer(ready(), { type: 'editStarted', messageId: 32 }).editingId).toBe(32)
    expect(
      chatReducer(ready({ editingId: 31 }), { type: 'editStarted', messageId: 32 }).editingId,
    ).toBe(32)
  })

  it('TC-CH-053: T22 쓰기 중·없는 id·loading → 같은 참조', () => {
    const busy = ready({ writing: SEND })
    const loading = freeze(initialChatState)
    const idle = ready()
    expect(chatReducer(busy, { type: 'editStarted', messageId: 32 })).toBe(busy)
    expect(chatReducer(idle, { type: 'editStarted', messageId: 99 })).toBe(idle)
    expect(chatReducer(loading, { type: 'editStarted', messageId: 32 })).toBe(loading)
  })

  it('TC-CH-053: T23 편집 중·저장 요청 아님 → editingId null(전송 중이어도 취소 가능)', () => {
    expect(chatReducer(ready({ editingId: 32 }), { type: 'editCancelled' }).editingId).toBeNull()
    expect(
      chatReducer(ready({ editingId: 32, writing: SEND }), { type: 'editCancelled' }).editingId,
    ).toBeNull()
  })

  it('TC-CH-053: T24 편집 아님·저장 요청 중 → 같은 참조', () => {
    const notEditing = ready()
    const saving = ready({ editingId: 32, writing: EDIT32 })
    expect(chatReducer(notEditing, { type: 'editCancelled' })).toBe(notEditing)
    expect(chatReducer(saving, { type: 'editCancelled' })).toBe(saving)
  })

  it('TC-CH-053: T25 writing·editingId 중 하나라도 있으면 둘 다 null / T26 둘 다 null → 같은 참조', () => {
    const revoked = chatReducer(ready({ editingId: 32, writing: EDIT32 }), {
      type: 'writeAccessRevoked',
    })
    expect(revoked.writing).toBeNull()
    expect(revoked.editingId).toBeNull()
    expect(ids(revoked.messages)).toEqual([31, 32, 33])
    expect(chatReducer(ready({ writing: SEND }), { type: 'writeAccessRevoked' }).writing).toBeNull()
    const idle = ready()
    expect(chatReducer(idle, { type: 'writeAccessRevoked' })).toBe(idle)
  })

  it('TC-CH-053: canSend 는 phase=ready 이고 writing=null 일 때만 true', () => {
    expect(canSend(ready())).toBe(true)
    expect(canSend(ready({ writing: SEND }))).toBe(false)
    expect(canSend(initialChatState)).toBe(false)
    expect(canSend({ ...initialChatState, phase: 'error', error: NET })).toBe(false)
  })
})

// ── S3 (TC-CH-085) — functions.md §1.1 T13~T16·T25 개정 · T27~T34 · §1.2 canSpeak·isRegenerateTarget ──────
const SPEAK_SEB: MessageWrite = { kind: 'speak', character: 'sebastian' }
const REGEN33: MessageWrite = { kind: 'regenerate', messageId: 33 }
const GEN_SEB: PendingSpeak = { character: 'sebastian', status: 'generating', error: null }
const FAILED_SEB: PendingSpeak = { character: 'sebastian', status: 'failed', error: ERR }
const FAILED_CIEL: PendingSpeak = { character: 'ciel', status: 'failed', error: NET }
const LLM: ApiError = { code: 'LLM_FAILED', message: 'x' }
const speaking = (over: Partial<ChatState> = {}) =>
  ready({ writing: SPEAK_SEB, pending: GEN_SEB, ...over })

describe('S3 chatReducer T13~T16·T25 개정 (R-CHAT-005 · R-CHAT-007)', () => {
  it('TC-CH-085: T13 writeStarted regenerate 허용 — writing 설정, 실패 pending 은 같은 참조로 유지', () => {
    const before = ready({ pending: FAILED_SEB })
    const next = chatReducer(before, { type: 'writeStarted', write: REGEN33 })
    expect(next.writing).toEqual(REGEN33)
    expect(next.pending).toBe(FAILED_SEB)
    expect(next.messages).toBe(before.messages)
  })

  it('TC-CH-085: T14 writeStarted speak 는 거절(같은 참조) — speak 는 speakStarted 로만 시작', () => {
    const idle = ready()
    expect(chatReducer(idle, { type: 'writeStarted', write: SPEAK_SEB })).toBe(idle)
  })

  it('TC-CH-085: T15 regenerate 중 writeFinished → null / T16 speak 중 writeFinished → 같은 참조', () => {
    expect(chatReducer(ready({ writing: REGEN33 }), { type: 'writeFinished' }).writing).toBeNull()
    const busy = speaking()
    expect(chatReducer(busy, { type: 'writeFinished' })).toBe(busy)
  })

  it('TC-CH-085: T25 pending 만 있어도 writeAccessRevoked → writing·editingId·pending 모두 null', () => {
    const revoked = chatReducer(ready({ pending: FAILED_CIEL }), { type: 'writeAccessRevoked' })
    expect(revoked.pending).toBeNull()
    expect(revoked.writing).toBeNull()
    expect(revoked.editingId).toBeNull()
    const gen = chatReducer(speaking(), { type: 'writeAccessRevoked' })
    expect(gen.pending).toBeNull()
    expect(gen.writing).toBeNull()
  })

  it('TC-CH-085: T1~T3 는 pending 을 null 로(재로드 시 실패 말풍선 사라짐)', () => {
    const withFailed = ready({ pending: FAILED_SEB })
    expect(chatReducer(withFailed, { type: 'initialLoadStarted' }).pending).toBeNull()
    expect(
      chatReducer(withFailed, { type: 'initialLoadSucceeded', page: page([msg(1)], false) })
        .pending,
    ).toBeNull()
    expect(chatReducer(withFailed, { type: 'initialLoadFailed', error: NET }).pending).toBeNull()
  })
})

describe('S3 chatReducer T27~T34 speak (R-CHAT-005 · R-CHAT-003)', () => {
  it('TC-CH-085: T27 speakStarted(canSpeak) → writing speak·pending generating', () => {
    const before = ready()
    const next = chatReducer(before, { type: 'speakStarted', character: 'ciel' })
    expect(next.writing).toEqual({ kind: 'speak', character: 'ciel' })
    expect(next.pending).toEqual({ character: 'ciel', status: 'generating', error: null })
    expect(next.messages).toBe(before.messages)
  })

  it('TC-CH-085: T27 이전 실패 pending(같은·다른 캐릭터)을 새 임시 pending 이 덮는다', () => {
    expect(
      chatReducer(ready({ pending: FAILED_SEB }), { type: 'speakStarted', character: 'sebastian' })
        .pending,
    ).toEqual(GEN_SEB)
    expect(
      chatReducer(ready({ pending: FAILED_SEB }), { type: 'speakStarted', character: 'ciel' })
        .pending,
    ).toEqual({ character: 'ciel', status: 'generating', error: null })
  })

  it('TC-CH-085: T28 첫 로드 전·다른 쓰기 중·이미 생성 중·인라인 수정 중 → 같은 참조', () => {
    const loading = freeze(initialChatState)
    const sending = ready({ writing: SEND })
    const regen = ready({ writing: REGEN33 })
    const already = speaking()
    const editing = ready({ editingId: 32 })
    for (const s of [loading, sending, regen, already, editing])
      expect(chatReducer(s, { type: 'speakStarted', character: 'ciel' })).toBe(s)
  })

  it('TC-CH-085: T29 speakSucceeded 맨 아래 근처 → 메시지 붙임·unseen 0·writing·pending null', () => {
    const next = chatReducer(speaking(), {
      type: 'speakSucceeded',
      message: msg(34, '대사'),
      isNearBottom: true,
    })
    expect(ids(next.messages)).toEqual([31, 32, 33, 34])
    expect(next.unseenCount).toBe(0)
    expect(next.writing).toBeNull()
    expect(next.pending).toBeNull()
  })

  it('TC-CH-085: T29 위쪽을 보는 중 → unseenCount += 1(T9 규칙)', () => {
    const next = chatReducer(speaking({ unseenCount: 2 }), {
      type: 'speakSucceeded',
      message: msg(34),
      isNearBottom: false,
    })
    expect(next.unseenCount).toBe(3)
    expect(next.pending).toBeNull()
  })

  it('TC-CH-085: T30 speak 중이 아니면 speakSucceeded → 같은 참조', () => {
    const idle = ready()
    const sending = ready({ writing: SEND })
    for (const s of [idle, sending])
      expect(chatReducer(s, { type: 'speakSucceeded', message: msg(34), isNearBottom: true })).toBe(
        s,
      )
  })

  it('TC-CH-085: T31 speakFailed → writing null, pending = 그 캐릭터 실패 + error / T32 아니면 같은 참조', () => {
    const next = chatReducer(speaking(), { type: 'speakFailed', error: LLM })
    expect(next.writing).toBeNull()
    expect(next.pending).toEqual({ character: 'sebastian', status: 'failed', error: LLM })
    expect(ids(next.messages)).toEqual([31, 32, 33])
    const idle = ready()
    expect(chatReducer(idle, { type: 'speakFailed', error: LLM })).toBe(idle)
  })

  it('TC-CH-085: T33 speakDiscarded → writing·pending null / T34 아니면 같은 참조', () => {
    const next = chatReducer(speaking(), { type: 'speakDiscarded' })
    expect(next.writing).toBeNull()
    expect(next.pending).toBeNull()
    const withFailed = ready({ pending: FAILED_CIEL })
    expect(chatReducer(withFailed, { type: 'speakDiscarded' })).toBe(withFailed)
  })

  it('TC-CH-085: 실패 pending 은 유저 전송 성공(T9)·수정(T17)에도 그대로 남는다', () => {
    const before = ready({ pending: FAILED_SEB })
    expect(
      chatReducer(before, { type: 'messagesAppended', messages: [msg(34)], isNearBottom: true })
        .pending,
    ).toBe(FAILED_SEB)
    expect(chatReducer(before, { type: 'messageReplaced', message: msg(32, '새') }).pending).toBe(
      FAILED_SEB,
    )
  })
})

describe('S3 canSpeak · isRegenerateTarget (R-CHAT-005 · R-CHAT-007 · R-MSG-006)', () => {
  it('TC-CH-085: canSpeak = canSend && editingId === null(DC-10)', () => {
    expect(canSpeak(ready())).toBe(true)
    expect(canSpeak(ready({ pending: FAILED_SEB }))).toBe(true)
    expect(canSpeak(ready({ editingId: 32 }))).toBe(false)
    expect(canSend(ready({ editingId: 32 }))).toBe(true)
    expect(canSpeak(speaking())).toBe(false)
    expect(canSpeak(ready({ writing: REGEN33 }))).toBe(false)
    // 잠금 표 send·edit·delete 행(TK-03)
    expect(canSpeak(ready({ writing: SEND }))).toBe(false)
    expect(canSpeak(ready({ writing: EDIT32 }))).toBe(false)
    expect(canSpeak(ready({ writing: DEL32 }))).toBe(false)
    expect(canSpeak(ready({ writing: DEL32, pending: FAILED_SEB }))).toBe(false)
    expect(canSpeak(initialChatState)).toBe(false)
  })

  it('TC-CH-085: isRegenerateTarget 5경계 — 마지막 캐릭터 line만 true', () => {
    const userLast = ready({
      messages: [msg(31), { ...msg(32), speaker: 'user', authorName: '미샤' }],
    })
    const oocLast = ready({
      messages: [msg(31), { ...msg(32), speaker: 'sebastian', kind: 'ooc' }],
    })
    const empty = ready({ messages: [], hasMore: false })
    expect(isRegenerateTarget(ready(), 33)).toBe(true)
    expect(isRegenerateTarget(ready(), 32)).toBe(false)
    expect(isRegenerateTarget(userLast, 32)).toBe(false)
    expect(isRegenerateTarget(oocLast, 32)).toBe(false)
    expect(isRegenerateTarget(empty, 33)).toBe(false)
    expect(isRegenerateTarget(ready({ pending: FAILED_SEB }), 33)).toBe(true)
  })
})

// ── S3e (TC-CH-111 순수) — design/actions.md AC §5 F-CH-52 regenerateTargetIdOf ──────
describe('S3e regenerateTargetIdOf (R-CHAT-007 · R-MSG-006, F-CH-52)', () => {
  it('TC-CH-111: 마지막이 캐릭터 line 이면 그 id, 아니면 null — 5경계 · pending 무시 · 잠금과 무관 · 입력 불변', () => {
    const sebLast = ready({
      messages: [msg(31), { ...msg(32), speaker: 'sebastian' }],
    })
    const userLast = ready({
      messages: [msg(31), { ...msg(32), speaker: 'user', authorName: '미샤' }],
    })
    const oocLast = ready({
      messages: [msg(31), { ...msg(32), speaker: 'sebastian', kind: 'ooc' }],
    })
    const empty = ready({ messages: [], hasMore: false })
    expect(regenerateTargetIdOf(ready())).toBe(33) // 시엘 line 마지막
    expect(regenerateTargetIdOf(sebLast)).toBe(32)
    expect(regenerateTargetIdOf(userLast)).toBeNull()
    expect(regenerateTargetIdOf(oocLast)).toBeNull()
    expect(regenerateTargetIdOf(empty)).toBeNull()
    // pending(실패·생성 중)은 보지 않는다 — TC-CH-079 규칙 유지. 잠금은 isActionLocked 몫이라 결과에 영향 없음
    expect(regenerateTargetIdOf(ready({ pending: FAILED_SEB }))).toBe(33)
    expect(regenerateTargetIdOf(speaking())).toBe(33)
    expect(regenerateTargetIdOf(ready({ editingId: 33 }))).toBe(33)
    // isRegenerateTarget 과 일치
    for (const s of [ready(), sebLast, userLast, oocLast]) {
      const last = s.messages[s.messages.length - 1] as Message
      expect(regenerateTargetIdOf(s) === last.id).toBe(isRegenerateTarget(s, last.id))
    }
    // 입력 불변(얼린 상태에서 throw 없음, 참조 그대로)
    const frozen = ready()
    regenerateTargetIdOf(frozen)
    expect(ids(frozen.messages)).toEqual([31, 32, 33])
  })
})

// ── S3d (TC-CH-053·085 확장 · TC-CH-099 순수) — design/auto.md §1.1 SpeakTarget 'auto' · §1.2 T27·T31 개정 · T35·T36 · §1.3 · F-CH-44 ──
const SPEAK_AUTO: MessageWrite = { kind: 'speak', character: 'auto' }
const GEN_AUTO: PendingSpeak = { character: 'auto', status: 'generating', error: null }
const FAILED_AUTO: PendingSpeak = { character: 'auto', status: 'failed', error: LLM }
const autoSpeaking = (over: Partial<ChatState> = {}) =>
  ready({ writing: SPEAK_AUTO, pending: GEN_AUTO, ...over })
const sending = (over: Partial<ChatState> = {}) => ready({ writing: SEND, ...over })
const sent = (id: number): Message => ({ ...msg(id, '안녕'), speaker: 'user', authorName: '어떠한 의지' })

describe('S3d chatReducer T35·T36 sendSucceeded (R-CHAT-006 · R-CHAT-014)', () => {
  it('TC-CH-099: (순수) T35 send 중 sendSucceeded 맨 아래 근처 → 한 번에 메시지 붙임·unseen 0 + writing speak auto + pending auto generating', () => {
    const before = sending()
    const next = chatReducer(before, { type: 'sendSucceeded', message: sent(34), isNearBottom: true })
    expect(ids(next.messages)).toEqual([31, 32, 33, 34])
    expect(next.unseenCount).toBe(0)
    expect(next.phase).toBe('ready')
    expect(next.writing).toEqual({ kind: 'speak', character: 'auto' })
    expect(next.pending).toEqual({ character: 'auto', status: 'generating', error: null })
    expect(before.writing).toEqual(SEND) // 입력 불변(freeze)
    expect(ids(before.messages)).toEqual([31, 32, 33])
  })

  it('TC-CH-099: (순수) T35 위쪽을 보는 중 → unseenCount += 1(T9 규칙)', () => {
    const next = chatReducer(sending({ unseenCount: 2 }), {
      type: 'sendSucceeded',
      message: sent(34),
      isNearBottom: false,
    })
    expect(next.unseenCount).toBe(3)
    expect(next.pending).toEqual(GEN_AUTO)
  })

  it('TC-CH-099: (순수) T35 이전 pending(캐릭터 실패·중립 실패)은 새 중립 generating 으로 바뀐다', () => {
    for (const prev of [FAILED_SEB, FAILED_CIEL, FAILED_AUTO]) {
      const next = chatReducer(sending({ pending: prev }), {
        type: 'sendSucceeded',
        message: sent(34),
        isNearBottom: true,
      })
      expect(next.pending).toEqual(GEN_AUTO)
      expect(next.writing).toEqual(SPEAK_AUTO)
    }
  })

  it('TC-CH-099: (순수) T35 는 editingId 를 건드리지 않는다(D-17 — 편집기는 열린 채 남는다)', () => {
    const next = chatReducer(sending({ editingId: 32 }), {
      type: 'sendSucceeded',
      message: sent(34),
      isNearBottom: true,
    })
    expect(next.editingId).toBe(32)
    expect(next.writing).toEqual(SPEAK_AUTO)
  })

  it('TC-CH-099: (순수) T36 send 중이 아니면 같은 참조(ready · 캐릭터·auto 생성 중 · edit 중 · regenerate 중 · loading)', () => {
    const states = [
      ready(),
      speaking(),
      autoSpeaking(),
      ready({ writing: EDIT32 }),
      ready({ writing: REGEN33 }),
      freeze(initialChatState),
    ]
    for (const s of states)
      expect(chatReducer(s, { type: 'sendSucceeded', message: sent(34), isNearBottom: true })).toBe(
        s,
      )
  })

  it('TC-CH-099: (순수) T35 직후 상태에서 canSend·canSpeak 모두 false(끼어들기 0회 — 상태 쪽 조건)', () => {
    const next = chatReducer(sending(), { type: 'sendSucceeded', message: sent(34), isNearBottom: true })
    expect(canSend(next)).toBe(false)
    expect(canSpeak(next)).toBe(false)
    expect(canSend(sending())).toBe(false)
    expect(canSpeak(sending())).toBe(false)
  })
})

describe('S3d chatReducer SpeakTarget auto — T27·T28·T29·T31·T33·T25 (R-CHAT-014 · R-CHAT-005)', () => {
  it('TC-CH-085: (S3d) T27 speakStarted auto(canSpeak) → writing speak auto · pending auto generating', () => {
    const before = ready()
    const next = chatReducer(before, { type: 'speakStarted', character: 'auto' })
    expect(next.writing).toEqual(SPEAK_AUTO)
    expect(next.pending).toEqual(GEN_AUTO)
    expect(next.messages).toBe(before.messages)
  })

  it('TC-CH-085: (S3d) T27 이전 실패(캐릭터·중립)는 새 임시로 바뀐다 — 중립 실패 → auto 재시도 · 중립 실패 → 캐릭터 버튼', () => {
    expect(
      chatReducer(ready({ pending: FAILED_AUTO }), { type: 'speakStarted', character: 'auto' })
        .pending,
    ).toEqual(GEN_AUTO)
    expect(
      chatReducer(ready({ pending: FAILED_SEB }), { type: 'speakStarted', character: 'auto' })
        .pending,
    ).toEqual(GEN_AUTO)
    expect(
      chatReducer(ready({ pending: FAILED_AUTO }), { type: 'speakStarted', character: 'ciel' })
        .pending,
    ).toEqual({ character: 'ciel', status: 'generating', error: null })
  })

  it('TC-CH-085: (S3d) T28 auto 도 첫 로드 전·send 중·편집 중·이미 생성 중이면 같은 참조', () => {
    for (const s of [freeze(initialChatState), sending(), ready({ editingId: 32 }), autoSpeaking()])
      expect(chatReducer(s, { type: 'speakStarted', character: 'auto' })).toBe(s)
  })

  it('TC-CH-085: (S3d) T29 auto 생성 중 speakSucceeded(speaker=ciel) → 메시지 붙임 · writing·pending null', () => {
    const reply: Message = { ...msg(34, '대사'), speaker: 'ciel' }
    const next = chatReducer(autoSpeaking(), {
      type: 'speakSucceeded',
      message: reply,
      isNearBottom: true,
    })
    expect(ids(next.messages)).toEqual([31, 32, 33, 34])
    expect(next.messages[3]?.speaker).toBe('ciel')
    expect(next.writing).toBeNull()
    expect(next.pending).toBeNull()
  })

  it('TC-CH-085: (S3d) T31 auto 생성 중 speakFailed → writing null · pending = 중립 실패(character auto) + error', () => {
    const next = chatReducer(autoSpeaking(), { type: 'speakFailed', error: LLM })
    expect(next.writing).toBeNull()
    expect(next.pending).toEqual(FAILED_AUTO)
    expect(ids(next.messages)).toEqual([31, 32, 33])
  })

  it('TC-CH-085: (S3d) T33 speakDiscarded · T25 writeAccessRevoked — auto 생성 중·중립 실패도 writing·pending null', () => {
    const discarded = chatReducer(autoSpeaking(), { type: 'speakDiscarded' })
    expect(discarded.writing).toBeNull()
    expect(discarded.pending).toBeNull()
    for (const s of [autoSpeaking(), ready({ pending: FAILED_AUTO })]) {
      const revoked = chatReducer(s, { type: 'writeAccessRevoked' })
      expect(revoked.writing).toBeNull()
      expect(revoked.pending).toBeNull()
    }
  })

  it('TC-CH-085: (S3d) canSpeak — 중립 실패만 있으면 true, auto 생성 중이면 false', () => {
    expect(canSpeak(ready({ pending: FAILED_AUTO }))).toBe(true)
    expect(canSpeak(autoSpeaking())).toBe(false)
    expect(canSend(autoSpeaking())).toBe(false)
  })
})

describe('S3d T13·T15 — S1 저장 중·저장 실패에서 pending 유지 (R-CHAT-006 · auto.md §1.3)', () => {
  it('TC-CH-053: (S3d) T13 writeStarted send 는 이전 pending(중립 실패·캐릭터 실패)을 같은 참조로 둔다', () => {
    for (const prev of [FAILED_AUTO, FAILED_SEB]) {
      const next = chatReducer(ready({ pending: prev }), { type: 'writeStarted', write: SEND })
      expect(next.writing).toEqual(SEND)
      expect(next.pending).toBe(prev)
    }
  })

  it('TC-CH-053: (S3d) T15 send 실패 writeFinished → writing null, 이전 pending 그대로(speak 이탈 없음)', () => {
    const next = chatReducer(sending({ pending: FAILED_AUTO }), { type: 'writeFinished' })
    expect(next.writing).toBeNull()
    expect(next.pending).toBe(FAILED_AUTO)
  })
})

describe('S3d speakingCharacterOf (R-CHAT-013 · R-CHAT-005, F-CH-44)', () => {
  it('TC-CH-099: (순수) speakingCharacterOf — 캐릭터 speak 이면 그 캐릭터, auto·send·regenerate·없음이면 null', () => {
    expect(speakingCharacterOf(speaking())).toBe('sebastian')
    expect(
      speakingCharacterOf(ready({ writing: { kind: 'speak', character: 'ciel' } })),
    ).toBe('ciel')
    expect(speakingCharacterOf(autoSpeaking())).toBeNull()
    expect(speakingCharacterOf(sending())).toBeNull()
    expect(speakingCharacterOf(ready({ writing: REGEN33 }))).toBeNull()
    expect(speakingCharacterOf(ready())).toBeNull()
    expect(speakingCharacterOf(initialChatState)).toBeNull()
  })
})

describe('chatReducer T1~T8 (R-CHAT-003)', () => {
  it('TC-CH-015: 초기값은 { loading, null, [], false, false, null, 0, null, null, null }(S3 pending 포함, Q-05)', () => {
    expect(initialChatState).toEqual({
      phase: 'loading',
      error: null,
      messages: [],
      hasMore: false,
      isLoadingOlder: false,
      olderError: null,
      unseenCount: 0,
      writing: null,
      editingId: null,
      pending: null,
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
