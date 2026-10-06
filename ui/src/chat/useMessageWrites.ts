/**
 * useMessageWrites — 설계 chat/design/functions.md §4.2 F-CH-17 · F-CH-20 · F-CH-23 · §4.3 F-CH-31 · F-CH-34 (50줄 한계 때문에 ChatScreen 에서 분리)
 * 요구: R-CHAT-004 · R-CHAT-005 · R-CHAT-006 · R-CHAT-007 · R-CHAT-011 · R-MSG-002 · R-MSG-003 · R-MSG-004 · R-MSG-005 · R-MSG-006 · R-AUTH-004
 * 메시지 쓰기 5종(전송 · 수정 저장 · 삭제 · AI 발화 speak · 재작성 regenerate)을 @/api 래퍼로 보내고 결과를 리듀서에 반영한다. 낙관적 갱신 없음.
 * 직렬화: 쓰기는 writing 하나로 한 번에 하나다. 같은 틱 연타는 inFlightRef 가, 이후는 canSend(상태)가 막는다. 디바운스 없음.
 * 전송은 appendUser 한 곳뿐이다 — AI 를 부르지 않는다(R-CHAT-006). 응답이 언마운트 뒤에 오면(isActive) 아무것도 하지 않는다.
 * speak·regenerate 는 화면 타이머·자동 재시도가 없다(서버가 70초 안에 끝낸다).
 */
import { useCallback, useRef } from 'react'
import type { Dispatch } from 'react'
import type { CharacterId } from '@shared/types'
import {
  type ApiError,
  appendUser,
  deleteMessage,
  editMessage,
  isAuthFailure,
  regenerate,
  speak,
} from '@/api'
import {
  type ChatAction,
  type ChatState,
  canSend,
  canSpeak,
  chatReducer,
  isRegenerateTarget,
} from '@/state/chat'
import { isMessageTextValid } from '@/state/limits'
import type { WriteAction } from './labels'

/** removeMessage 결과: 제거됨(204 또는 이미 없음) · 실패 · 거절(가드에 걸렸거나 언마운트) */
export type RemoveResult =
  { kind: 'removed'; isEmptyWithMore: boolean } | { kind: 'failed' } | { kind: 'rejected' }

/** regenerateMessage 결과: 교체됨 · 대상이 사라져 제거됨 · 목록이 낡음(재조회 필요) · 실패 · 거절(가드·언마운트) */
export type RegenerateResult =
  | { kind: 'replaced' }
  | { kind: 'removed'; isEmptyWithMore: boolean }
  | { kind: 'stale' }
  | { kind: 'failed' }
  | { kind: 'rejected' }

export type UseMessageWritesOptions = {
  roomId: string
  dispatch: Dispatch<ChatAction>
  getState: () => ChatState
  isActive: () => boolean
  /** 응답 시점(붙이기 전)에 맨 아래 근처인가 */
  isNearBottom: () => boolean
  onFailure: (error: ApiError, action: WriteAction) => void
  /** speak 중 방이 사라졌다(NOT_FOUND) — 목록으로 돌아간다(F-CH-33) */
  onRoomGone: () => void
}

export type UseMessageWritesResult = {
  /** true = 저장됨 */
  send: (text: string, ooc: boolean) => Promise<boolean>
  /** true = 수정 반영됨 */
  saveEdit: (messageId: number, text: string) => Promise<boolean>
  removeMessage: (messageId: number) => Promise<RemoveResult>
  /** F-CH-31: 캐릭터 1턴(임시 말풍선 → 결과 말풍선 또는 실패 말풍선) */
  speakAs: (character: CharacterId) => Promise<void>
  /** F-CH-34: 마지막 캐릭터 대사 재작성 */
  regenerateMessage: (messageId: number) => Promise<RegenerateResult>
}

const REJECTED: RemoveResult = { kind: 'rejected' }
const REGENERATE_REJECTED: RegenerateResult = { kind: 'rejected' }

/** 쓰기 팻말: 같은 틱 연타(ref) · 이미 쓰기 중 · 첫 로드 전(상태)이면 시작을 거절하고, 요청이 끝나면 푼다. 시작 액션은 호출 쪽이 정한다 */
const useWriteGate = (dispatch: Dispatch<ChatAction>, getState: () => ChatState) => {
  const inFlightRef = useRef(false)
  const begin = useCallback(
    (start: ChatAction): boolean => {
      if (inFlightRef.current || !canSend(getState())) return false
      inFlightRef.current = true
      dispatch(start)
      return true
    },
    [dispatch, getState],
  )
  const release = useCallback((): void => {
    inFlightRef.current = false
  }, [])
  return { begin, release }
}

type Gate = ReturnType<typeof useWriteGate>

/** F-CH-17: 전송 = appendUser(AI 호출 없음). 맨 아래 근처 판단은 응답 시점(붙이기 전)에 한다 */
const useSend = (options: UseMessageWritesOptions, gate: Gate) => {
  const { roomId, dispatch, isActive, isNearBottom, onFailure } = options
  const { begin, release } = gate
  return useCallback(
    async (text: string, ooc: boolean): Promise<boolean> => {
      if (!isMessageTextValid(text)) return false
      if (!begin({ type: 'writeStarted', write: { kind: 'send' } })) return false
      const result = await appendUser(roomId, { text, ooc })
      release()
      if (!isActive()) return false
      if (!result.ok) {
        dispatch({ type: 'writeFinished' })
        onFailure(result.error, 'send')
        return false
      }
      dispatch({ type: 'messagesAppended', messages: [result.value], isNearBottom: isNearBottom() })
      dispatch({ type: 'writeFinished' })
      return true
    },
    [roomId, begin, release, dispatch, isActive, isNearBottom, onFailure],
  )
}

/** F-CH-20: 수정 저장. 실패하면 편집기·입력을 그대로 둔다 */
const useSaveEdit = (options: UseMessageWritesOptions, gate: Gate) => {
  const { dispatch, isActive, onFailure } = options
  const { begin, release } = gate
  return useCallback(
    async (messageId: number, text: string): Promise<boolean> => {
      if (!isMessageTextValid(text)) return false
      if (!begin({ type: 'writeStarted', write: { kind: 'edit', messageId } })) return false
      const result = await editMessage(messageId, { text })
      release()
      if (!isActive()) return false
      if (!result.ok) {
        dispatch({ type: 'writeFinished' })
        onFailure(result.error, 'editMessage')
        return false
      }
      dispatch({ type: 'messageReplaced', message: result.value })
      dispatch({ type: 'writeFinished' })
      return true
    },
    [begin, release, dispatch, isActive, onFailure],
  )
}

/** F-CH-23: 삭제. NOT_FOUND 는 "이미 없음 = 목표 상태"라 성공과 같은 흐름이다 */
const useRemoveMessage = (options: UseMessageWritesOptions, gate: Gate) => {
  const { dispatch, getState, isActive, onFailure } = options
  const { begin, release } = gate
  return useCallback(
    async (messageId: number): Promise<RemoveResult> => {
      if (!begin({ type: 'writeStarted', write: { kind: 'delete', messageId } })) return REJECTED
      const result = await deleteMessage(messageId)
      release()
      if (!isActive()) return REJECTED
      if (!result.ok && result.error.code !== 'NOT_FOUND') {
        dispatch({ type: 'writeFinished' })
        onFailure(result.error, 'deleteMessage')
        return { kind: 'failed' }
      }
      // 리듀서를 순수하게 한 번 돌려 "남은 0건 + 더 있음" 을 먼저 판정한다
      const next = chatReducer(getState(), { type: 'messageRemoved', messageId })
      dispatch({ type: 'messageRemoved', messageId })
      dispatch({ type: 'writeFinished' })
      return { kind: 'removed', isEmptyWithMore: next.messages.length === 0 && next.hasMore }
    },
    [begin, release, dispatch, getState, isActive, onFailure],
  )
}

type SpeakFailureDeps = Pick<UseMessageWritesOptions, 'dispatch' | 'onFailure' | 'onRoomGone'>

/** speak 실패: 인증 실패는 말풍선을 남기지 않고 전환, 방 사라짐은 목록 복귀, 그 밖은 실패 말풍선(토스트 없음) */
const settleSpeakFailure = (deps: SpeakFailureDeps, error: ApiError): void => {
  const { dispatch, onFailure, onRoomGone } = deps
  if (isAuthFailure(error)) {
    dispatch({ type: 'speakDiscarded' })
    onFailure(error, 'speak')
    return
  }
  if (error.code === 'NOT_FOUND') {
    dispatch({ type: 'speakDiscarded' })
    onRoomGone()
    return
  }
  dispatch({ type: 'speakFailed', error })
}

/** F-CH-31: 캐릭터 1턴. 본문은 character 뿐이다(대화 내용은 보내지 않는다) */
const useSpeak = (options: UseMessageWritesOptions, gate: Gate) => {
  const { roomId, dispatch, getState, isActive, isNearBottom, onFailure, onRoomGone } = options
  const { begin, release } = gate
  return useCallback(
    async (character: CharacterId): Promise<void> => {
      if (!canSpeak(getState())) return
      if (!begin({ type: 'speakStarted', character })) return
      const result = await speak(roomId, { character })
      release()
      if (!isActive()) return
      if (!result.ok) {
        settleSpeakFailure({ dispatch, onFailure, onRoomGone }, result.error)
        return
      }
      dispatch({ type: 'speakSucceeded', message: result.value, isNearBottom: isNearBottom() })
    },
    [roomId, begin, release, dispatch, getState, isActive, isNearBottom, onFailure, onRoomGone],
  )
}

type RegenerateFailureDeps = Pick<UseMessageWritesOptions, 'dispatch' | 'getState' | 'onFailure'>

/** 재작성 실패를 상태에 반영하고 호출 쪽이 이어서 할 일(제거 · 재조회 · 없음)을 돌려준다 */
const settleRegenerateFailure = (
  deps: RegenerateFailureDeps,
  messageId: number,
  error: ApiError,
): RegenerateResult => {
  const { dispatch, getState, onFailure } = deps
  if (error.code === 'NOT_FOUND') {
    const next = chatReducer(getState(), { type: 'messageRemoved', messageId })
    dispatch({ type: 'messageRemoved', messageId })
    dispatch({ type: 'writeFinished' })
    onFailure(error, 'regenerate')
    return { kind: 'removed', isEmptyWithMore: next.messages.length === 0 && next.hasMore }
  }
  dispatch({ type: 'writeFinished' })
  onFailure(error, 'regenerate')
  return error.code === 'NOT_LAST_MESSAGE' ? { kind: 'stale' } : { kind: 'failed' }
}

/** F-CH-34: 재작성(본문 없음). 성공은 같은 id 를 통째로 교체한다. 실패면 원 대사 그대로 */
const useRegenerate = (options: UseMessageWritesOptions, gate: Gate) => {
  const { dispatch, getState, isActive, onFailure } = options
  const { begin, release } = gate
  return useCallback(
    async (messageId: number): Promise<RegenerateResult> => {
      if (!isRegenerateTarget(getState(), messageId)) return REGENERATE_REJECTED
      const start: ChatAction = { type: 'writeStarted', write: { kind: 'regenerate', messageId } }
      if (!begin(start)) return REGENERATE_REJECTED
      const result = await regenerate(messageId)
      release()
      if (!isActive()) return REGENERATE_REJECTED
      if (!result.ok) {
        return settleRegenerateFailure({ dispatch, getState, onFailure }, messageId, result.error)
      }
      dispatch({ type: 'messageReplaced', message: result.value })
      dispatch({ type: 'writeFinished' })
      return { kind: 'replaced' }
    },
    [begin, release, dispatch, getState, isActive, onFailure],
  )
}

export const useMessageWrites = (options: UseMessageWritesOptions): UseMessageWritesResult => {
  const gate = useWriteGate(options.dispatch, options.getState)
  return {
    send: useSend(options, gate),
    saveEdit: useSaveEdit(options, gate),
    removeMessage: useRemoveMessage(options, gate),
    speakAs: useSpeak(options, gate),
    regenerateMessage: useRegenerate(options, gate),
  }
}
