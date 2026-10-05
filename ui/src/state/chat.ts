/**
 * 대화 상태 리듀서(순수) — 설계 chat/design/functions.md §1 · 전이표 T1~T12 · F-CH-12
 * 요구: R-CHAT-003 · R-MSG-001. React·DOM 의존 없음(타입 import 만). 그대로 = 같은 객체 참조를 돌려준다.
 */
import type { Message, MessagesPage } from '@shared/types'
import type { ApiError } from '@/api'

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
}

export const initialChatState: ChatState = {
  phase: 'loading',
  error: null,
  messages: [],
  hasMore: false,
  isLoadingOlder: false,
  olderError: null,
  unseenCount: 0,
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
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}
