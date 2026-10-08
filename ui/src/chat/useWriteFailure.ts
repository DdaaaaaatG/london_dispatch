/**
 * useWriteFailure — 설계 chat/design/functions.md F-CH-16 · design/memory.md ME §3 · design/lock.md F-CH-69 · 요구 R-CHAT-011 · R-CHAT-012 🔒 · R-LOCK-006
 * 쓰기 실패를 한 곳에서 처리한다: 인증 실패(TOKEN_REQUIRED · TOKEN_INVALID · LEVEL_TOO_LOW)면 App 에 알려 읽기 전용으로 전환하고,
 * 그 밖의 코드는 토스트로 안내한다. E 알림 줄의 토스트 상태(2초)도 이 훅이 소유한다.
 * S4: showNotice 는 실패가 아닌 안내(장기기억 저장 성공)를 같은 E 알림 줄로 띄운다. handleWriteFailure 동작은 그대로다.
 * S6: ROOM_LOCKED(비밀번호가 바뀌어 증명이 무효)는 토스트도 전환도 없이 onRoomLocked(잠금 관문)로 보낸다. 쓰기 실패 경로 전부가 여기로 모인다(D-45).
 * 인증 실패 처리는 멱등이다: revokedRef 가 한 번 true 가 되면 늦게 온 두 번째 인증 실패는 전환도 안내도 다시 하지 않는다.
 * 문구는 labels.writeErrorText 가 code 와 동작으로 정한다(서버 error.message · 토큰 값은 쓰지 않는다).
 */
import { useCallback, useLayoutEffect, useRef } from 'react'
import { type ApiError, isAuthFailure } from '@/api'
import { useToast } from '@/components/hooks/useToast'
import type { ToastState } from '@/components/hooks/useToast'
import type { ToastTone } from '@/components/ui/Toast'
import { toastToneOf } from '@/state/writeFailure'
import { type WriteAction, writeErrorText } from './labels'

export type UseWriteFailureResult = {
  /** E 알림 줄에 보일 토스트(없으면 null) */
  toast: ToastState
  handleWriteFailure: (error: ApiError, action: WriteAction) => void
  /** S4: 실패가 아닌 안내(저장 성공 등)를 E 알림 줄로 띄운다(= 내부 showToast) */
  showNotice: (message: string, tone: ToastTone) => void
}

export const useWriteFailure = (
  onAuthFailure: () => void,
  onRoomLocked: () => void,
): UseWriteFailureResult => {
  const { toast, showToast } = useToast()
  const revokedRef = useRef(false)
  const latestRef = useRef({ onAuthFailure, onRoomLocked })

  useLayoutEffect(() => {
    latestRef.current = { onAuthFailure, onRoomLocked }
  })

  const handleWriteFailure = useCallback(
    (error: ApiError, action: WriteAction): void => {
      if (error.code === 'ROOM_LOCKED') {
        latestRef.current.onRoomLocked()
        return
      }
      if (isAuthFailure(error)) {
        if (revokedRef.current) return
        revokedRef.current = true
        latestRef.current.onAuthFailure()
      }
      showToast(writeErrorText(error, action), toastToneOf(error))
    },
    [showToast],
  )

  return { toast, handleWriteFailure, showNotice: showToast }
}
