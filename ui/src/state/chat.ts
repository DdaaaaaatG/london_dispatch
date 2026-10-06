/**
 * 대화 상태 리듀서(순수) — 설계 chat/design/functions.md §1 · 전이표 T1~T34 · F-CH-12
 * 요구: R-CHAT-003 · R-CHAT-005 · R-CHAT-006 · R-CHAT-007 · R-CHAT-011 · R-CHAT-014 · R-MSG-001
 * S3d: 전송 저장 201 은 sendSucceeded(T35) 한 번으로 메시지 붙이기 + 자동 응답 시작(중립 'auto')을 원자 전이한다. 사이에 잠금이 풀린 상태가 없다.
 * S3: speak 는 speakStarted 로만 시작해 pending(임시 말풍선)과 writing 을 함께 건다. 끝은 T29~T33 으로만 맺는다.
 * 비유: writing 은 방 문 앞의 "사용 중" 팻말이다. 걸려 있는 동안은 다른 메시지 쓰기(전송·수정 저장·삭제)를 시작하지 않는다.
 * React·DOM 의존 없음(타입 import 만). 그대로 = 같은 객체 참조를 돌려준다.
 * 낙관적 갱신 없음: 쓰기 결과는 응답을 받은 뒤 T9·T17·T19 로만 반영한다.
 */
import type { CharacterId, Message, MessagesPage, SpeakTarget } from '@shared/types'
import type { ApiError } from '@/api'

/** 진행 중인 메시지 쓰기(한 번에 하나) */
export type MessageWrite =
  | { readonly kind: 'send' }
  | { readonly kind: 'edit'; readonly messageId: number }
  | { readonly kind: 'delete'; readonly messageId: number }
  | { readonly kind: 'speak'; readonly character: SpeakTarget }
  | { readonly kind: 'regenerate'; readonly messageId: number }

/** S3: 목록 끝 임시(생성 중)·실패 말풍선. 서버에 저장된 것이 아니다 */
export type PendingSpeak = {
  /** S3d: 'auto' = 중립(화자 미정, 가운데). 캐릭터면 그 캐릭터 쪽 */
  readonly character: SpeakTarget
  readonly status: 'generating' | 'failed'
  /** status === 'failed' 일 때만 값 */
  readonly error: ApiError | null
}

export type ChatState = {
  /** 첫 페이지 상태 */
  readonly phase: 'loading' | 'error' | 'ready'
  /** phase === 'error' 일 때만 값 */
  readonly error: ApiError | null
  /** id 오름차순, id 중복 없음 */
  readonly messages: readonly Message[]
  /** 더 오래된 페이지가 있는가 */
  readonly hasMore: boolean
  readonly isLoadingOlder: boolean
  readonly olderError: ApiError | null
  /** 위를 보는 중 도착한 새 메시지 수 */
  readonly unseenCount: number
  /** S2: 진행 중인 메시지 쓰기 */
  readonly writing: MessageWrite | null
  /** S2: 인라인 수정 중인 메시지 id */
  readonly editingId: number | null
  /** S3: 임시·실패 말풍선(없으면 null) */
  readonly pending: PendingSpeak | null
}

export const initialChatState: ChatState = {
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
}

export type ChatAction =
  | { type: 'initialLoadStarted' }
  | { type: 'initialLoadSucceeded'; page: MessagesPage }
  | { type: 'initialLoadFailed'; error: ApiError }
  | { type: 'olderLoadStarted' }
  | { type: 'olderLoadSucceeded'; page: MessagesPage }
  | { type: 'olderLoadFailed'; error: ApiError }
  | { type: 'messagesAppended'; messages: readonly Message[]; isNearBottom: boolean }
  | { type: 'unseenCleared' }
  | { type: 'writeStarted'; write: MessageWrite }
  | { type: 'writeFinished' }
  | { type: 'messageReplaced'; message: Message }
  | { type: 'messageRemoved'; messageId: number }
  | { type: 'editStarted'; messageId: number }
  | { type: 'editCancelled' }
  | { type: 'writeAccessRevoked' }
  | { type: 'speakStarted'; character: SpeakTarget }
  | { type: 'sendSucceeded'; message: Message; isNearBottom: boolean }
  | { type: 'speakSucceeded'; message: Message; isNearBottom: boolean }
  | { type: 'speakFailed'; error: ApiError }
  | { type: 'speakDiscarded' }

/** id 기준 합집합. 같은 id 는 incoming 이 이기고, id 오름차순으로 돌려준다. 입력은 바꾸지 않는다 */
export const mergeMessages = (
  current: readonly Message[],
  incoming: readonly Message[],
): Message[] => {
  const byId = new Map([...current, ...incoming].map(message => [message.id, message] as const))
  return Array.from(byId.values()).sort((a, b) => a.id - b.id)
}

/** 이전 페이지를 요청해도 되는가(버튼 재시도 기준) */
export const canLoadOlder = (s: ChatState): boolean =>
  s.phase === 'ready' && s.hasMore && !s.isLoadingOlder && s.messages.length > 0

/** 스크롤만으로 이전 페이지를 자동 요청해도 되는가(실패 뒤에는 버튼으로만) */
export const canAutoLoadOlder = (s: ChatState): boolean => canLoadOlder(s) && s.olderError === null

/** 다음 페이지 before 커서(api.md §4.3). 더 없으면 null */
export const nextBefore = (s: ChatState): number | null =>
  s.hasMore ? (s.messages[0]?.id ?? null) : null

/** 메시지 쓰기(전송·수정 저장·삭제)를 시작해도 되는가: 첫 로드가 끝났고 진행 중인 쓰기가 없다 */
export const canSend = (s: ChatState): boolean => s.phase === 'ready' && s.writing === null

/** 인라인 수정이 열려 있으면 생성하지 않는다(DC-10). 캐릭터 버튼·「재시도」·T27 의 조건 */
export const canSpeak = (s: ChatState): boolean => canSend(s) && s.editingId === null

/** 진행 중 speak 의 캐릭터(포커스 복귀 F-CH-38 대상). 중립('auto')은 누른 버튼이 없으므로 null */
export const speakingCharacterOf = (s: ChatState): CharacterId | null =>
  s.writing?.kind === 'speak' && s.writing.character !== 'auto' ? s.writing.character : null

/** 재작성 항목 표시 조건: 화면 목록 마지막이고 캐릭터 대사(line)다. 임시·실패 말풍선은 세지 않는다 */
export const isRegenerateTarget = (s: ChatState, messageId: number): boolean => {
  const last = s.messages[s.messages.length - 1]
  return (
    last !== undefined && last.id === messageId && last.kind === 'line' && last.speaker !== 'user'
  )
}

const onInitialLoadSucceeded = (page: MessagesPage): ChatState => ({
  ...initialChatState,
  phase: 'ready',
  messages: mergeMessages([], page.messages),
  hasMore: page.hasMore,
})

const onOlderLoadStarted = (state: ChatState): ChatState =>
  canLoadOlder(state) ? { ...state, isLoadingOlder: true, olderError: null } : state

const onOlderLoadSucceeded = (state: ChatState, page: MessagesPage): ChatState =>
  state.isLoadingOlder
    ? {
        ...state,
        messages: mergeMessages(state.messages, page.messages),
        hasMore: page.messages.length === 0 ? false : page.hasMore,
        isLoadingOlder: false,
      }
    : state

const onOlderLoadFailed = (state: ChatState, error: ApiError): ChatState =>
  state.isLoadingOlder ? { ...state, isLoadingOlder: false, olderError: error } : state

const onMessagesAppended = (
  state: ChatState,
  incoming: readonly Message[],
  isNearBottom: boolean,
): ChatState => {
  if (state.phase !== 'ready') return state
  const lastId = state.messages[state.messages.length - 1]?.id ?? 0
  const added = new Set(incoming.filter(m => m.id > lastId).map(m => m.id)).size
  return {
    ...state,
    messages: mergeMessages(state.messages, incoming),
    unseenCount: isNearBottom ? 0 : state.unseenCount + added,
  }
}

/**
 * T35·T36: 저장 201 → 같은 팻말로 자동 응답 시작. T9 규칙으로 메시지를 붙이고, writing 을 send → speak('auto') 로,
 * pending 을 중립 generating 으로 한 번에 바꾼다(사이에 null 인 상태 없음). 이전 pending(캐릭터·중립 실패)은 이것으로 바뀐다.
 * editingId 는 건드리지 않는다(D-17). 저장 중(send)이 아니면 그대로
 */
const onSendSucceeded = (state: ChatState, message: Message, isNearBottom: boolean): ChatState =>
  state.phase === 'ready' && state.writing?.kind === 'send'
    ? {
        ...onMessagesAppended(state, [message], isNearBottom),
        writing: { kind: 'speak', character: 'auto' },
        pending: { character: 'auto', status: 'generating', error: null },
      }
    : state

/** T13·T14: 첫 로드가 끝났고 다른 쓰기가 없을 때만 팻말을 건다. speak 는 speakStarted 로만 시작한다 */
const onWriteStarted = (state: ChatState, write: MessageWrite): ChatState =>
  canSend(state) && write.kind !== 'speak' ? { ...state, writing: write } : state

/** T15·T16: speak 는 T29~T33 으로만 끝난다(임시 말풍선이 남는 일을 막는다) */
const onWriteFinished = (state: ChatState): ChatState =>
  state.writing !== null && state.writing.kind !== 'speak' ? { ...state, writing: null } : state

/** T27·T28: 실패 말풍선이 있었으면 새 임시 말풍선으로 바뀐다 */
const onSpeakStarted = (state: ChatState, character: SpeakTarget): ChatState =>
  canSpeak(state)
    ? {
        ...state,
        writing: { kind: 'speak', character },
        pending: { character, status: 'generating', error: null },
      }
    : state

/** T29·T30: 임시 말풍선이 결과 말풍선으로 교체된다(T9 와 같은 규칙으로 붙인다) */
const onSpeakSucceeded = (state: ChatState, message: Message, isNearBottom: boolean): ChatState =>
  state.phase === 'ready' && state.writing?.kind === 'speak'
    ? {
        ...onMessagesAppended(state, [message], isNearBottom),
        writing: null,
        pending: null,
      }
    : state

/** T31·T32: 같은 자리에 실패 말풍선 */
const onSpeakFailed = (state: ChatState, error: ApiError): ChatState =>
  state.writing?.kind === 'speak'
    ? {
        ...state,
        writing: null,
        pending: { character: state.writing.character, status: 'failed', error },
      }
    : state

/** T33·T34: 인증 실패·방 사라짐 — 임시 말풍선을 남기지 않는다 */
const onSpeakDiscarded = (state: ChatState): ChatState =>
  state.writing?.kind === 'speak' ? { ...state, writing: null, pending: null } : state

/** T17·T18: 같은 id 를 응답 본문으로 바꾼다. 그 메시지를 편집 중이었으면 편집을 닫는다 */
const onMessageReplaced = (state: ChatState, message: Message): ChatState => {
  if (!state.messages.some(m => m.id === message.id)) return state
  return {
    ...state,
    messages: state.messages.map(m => (m.id === message.id ? message : m)),
    editingId: state.editingId === message.id ? null : state.editingId,
  }
}

/** T19·T20: 같은 id 를 뺀다. 그 메시지를 편집 중이었으면 편집을 닫는다 */
const onMessageRemoved = (state: ChatState, messageId: number): ChatState => {
  if (!state.messages.some(m => m.id === messageId)) return state
  return {
    ...state,
    messages: state.messages.filter(m => m.id !== messageId),
    editingId: state.editingId === messageId ? null : state.editingId,
  }
}

/** T21·T22: 첫 로드가 끝났고 쓰기가 없고 그 메시지가 있을 때만 편집을 연다(다른 편집 중이면 바뀐다) */
const onEditStarted = (state: ChatState, messageId: number): ChatState =>
  canSend(state) && state.messages.some(m => m.id === messageId)
    ? { ...state, editingId: messageId }
    : state

/** T23·T24: 편집 중이고 저장 요청 중이 아니면 편집을 닫는다(전송 중이어도 취소할 수 있다) */
const onEditCancelled = (state: ChatState): ChatState =>
  state.editingId !== null && state.writing?.kind !== 'edit' ? { ...state, editingId: null } : state

/** T25·T26: 읽기 전용 전환. 숨은 상태(쓰기 팻말·편집·임시 말풍선)를 정리한다 */
const onWriteAccessRevoked = (state: ChatState): ChatState =>
  state.writing !== null || state.editingId !== null || state.pending !== null
    ? { ...state, writing: null, editingId: null, pending: null }
    : state

/** 대화 상태 전이. 전이 규칙의 단일 소스(컴포넌트에 다시 쓰지 않는다) */
export const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'initialLoadStarted':
      return initialChatState
    case 'initialLoadSucceeded':
      return onInitialLoadSucceeded(action.page)
    case 'initialLoadFailed':
      return { ...initialChatState, phase: 'error', error: action.error }
    case 'olderLoadStarted':
      return onOlderLoadStarted(state)
    case 'olderLoadSucceeded':
      return onOlderLoadSucceeded(state, action.page)
    case 'olderLoadFailed':
      return onOlderLoadFailed(state, action.error)
    case 'messagesAppended':
      return onMessagesAppended(state, action.messages, action.isNearBottom)
    case 'unseenCleared':
      return state.unseenCount > 0 ? { ...state, unseenCount: 0 } : state
    case 'writeStarted':
      return onWriteStarted(state, action.write)
    case 'writeFinished':
      return onWriteFinished(state)
    case 'messageReplaced':
      return onMessageReplaced(state, action.message)
    case 'messageRemoved':
      return onMessageRemoved(state, action.messageId)
    case 'editStarted':
      return onEditStarted(state, action.messageId)
    case 'editCancelled':
      return onEditCancelled(state)
    case 'writeAccessRevoked':
      return onWriteAccessRevoked(state)
    case 'speakStarted':
      return onSpeakStarted(state, action.character)
    case 'sendSucceeded':
      return onSendSucceeded(state, action.message, action.isNearBottom)
    case 'speakSucceeded':
      return onSpeakSucceeded(state, action.message, action.isNearBottom)
    case 'speakFailed':
      return onSpeakFailed(state, action.error)
    case 'speakDiscarded':
      return onSpeakDiscarded(state)
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}
