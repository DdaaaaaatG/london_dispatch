/**
 * useChatLoader — 설계 chat/design/functions.md §3 · §4 F-CH-03~07 (50줄·400줄 한계 때문에 분리)
 * 요구: R-CHAT-002 · R-CHAT-003 · R-MSG-001
 * 상태 전이는 ui/src/state/chat.ts 의 순수 리듀서가 소유한다. 이 훅은 listMessages 호출과 dispatch 만 잇는다.
 * 활성 플래그 · 중복 요청 방지 · 최신 상태 ref 는 이 훅이 소유한다(ChatScreen 은 모른다).
 */
import { useCallback, useLayoutEffect, useReducer, useRef } from 'react'
import { listMessages } from '@/api'
import {
  type ChatState,
  canLoadOlder,
  chatReducer,
  initialChatState,
  nextBefore,
} from '@/state/chat'

export type UseChatLoaderResult = {
  state: ChatState
  loadInitial: () => Promise<void>
  retryInitial: () => void
  loadOlder: () => Promise<void>
  retryOlder: () => void
  clearUnseen: () => void
}

export const useChatLoader = (roomId: string): UseChatLoaderResult => {
  const [state, dispatch] = useReducer(chatReducer, initialChatState)
  const stateRef = useRef<ChatState>(initialChatState)
  const isActiveRef = useRef(false)
  const olderInFlightRef = useRef(false)

  // loadOlder 가 오래된 상태를 보지 않게 렌더마다 최신 상태를 담는다.
  // useAutoScroll 의 배치 effect 보다 먼저 실행돼야 하므로 호출 순서(이 훅이 먼저)와 layout effect 를 지킨다
  useLayoutEffect(() => {
    stateRef.current = state
  })

  // 언마운트 뒤에 도착한 응답을 버리기 위한 활성 플래그.
  // 마운트 layout effect(ChatScreen 의 첫 로드)보다 먼저 켜져야 이미 끝난 응답이 버려지지 않으므로 layout effect 로 둔다
  useLayoutEffect(() => {
    isActiveRef.current = true
    return () => {
      isActiveRef.current = false
    }
  }, [])

  /** F-CH-03: 최신 페이지(query 없음 = 최신 30건) */
  const loadInitial = useCallback(async (): Promise<void> => {
    dispatch({ type: 'initialLoadStarted' })
    const result = await listMessages(roomId)
    if (!isActiveRef.current) return
    dispatch(
      result.ok
        ? { type: 'initialLoadSucceeded', page: result.value }
        : { type: 'initialLoadFailed', error: result.error },
    )
  }, [roomId])

  /** F-CH-05: 이전 페이지. 같은 틱의 연속 scroll 이벤트는 진행 중 플래그가 막는다 */
  const loadOlder = useCallback(async (): Promise<void> => {
    const current = stateRef.current
    const before = nextBefore(current)
    if (olderInFlightRef.current || !canLoadOlder(current) || before === null) return
    olderInFlightRef.current = true
    dispatch({ type: 'olderLoadStarted' })
    const result = await listMessages(roomId, { before })
    olderInFlightRef.current = false
    if (!isActiveRef.current) return
    dispatch(
      result.ok
        ? { type: 'olderLoadSucceeded', page: result.value }
        : { type: 'olderLoadFailed', error: result.error },
    )
  }, [roomId])

  /** F-CH-04 */
  const retryInitial = useCallback((): void => {
    void loadInitial()
  }, [loadInitial])

  /** F-CH-06: olderError 가 있어도 canLoadOlder 는 true 라 진행된다 */
  const retryOlder = useCallback((): void => {
    void loadOlder()
  }, [loadOlder])

  /** F-CH-07 */
  const clearUnseen = useCallback((): void => {
    dispatch({ type: 'unseenCleared' })
  }, [])

  return { state, loadInitial, retryInitial, loadOlder, retryOlder, clearUnseen }
}
