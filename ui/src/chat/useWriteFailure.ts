/**
 * useWriteFailure — 설계 chat/design/functions.md F-CH-16 · 요구 R-CHAT-011
 * 쓰기 실패를 한 곳에서 처리한다: 인증 실패(TOKEN_REQUIRED · TOKEN_INVALID · LEVEL_TOO_LOW)면 App 에 알려 읽기 전용으로 전환하고,
 * 그 밖의 코드는 토스트로 안내한다. E 알림 줄의 토스트 상태(2초)도 이 훅이 소유한다.
 * 인증 실패 처리는 멱등이다: revokedRef 가 한 번 true 가 되면 늦게 온 두 번째 인증 실패는 전환도 안내도 다시 하지 않는다.
 * 문구는 labels.writeErrorText 가 code 와 동작으로 정한다(서버 error.message · 토큰 값은 쓰지 않는다).
 */
import { useCallback, useLayoutEffect, useRef } from 'react'
import { type ApiError, isAuthFailure } from '@/api'
import { useToast } from '@/components/hooks/useToast'
import type { ToastState } from '@/components/hooks/useToast'
import { toastToneOf } from '@/state/writeFailure'
import { type WriteAction, writeErrorText } from './labels'

export type UseWriteFailureResult = {
  /** E 알림 줄에 보일 토스트(없으면 null) */
  toast: ToastState
  handleWriteFailure: (error: ApiError, action: WriteAction) => void
}

export const useWriteFailure = (onAuthFailure: () => void): UseWriteFailureResult => {
  const { toast, showToast } = useToast()
  const revokedRef = useRef(false)
  const latestRef = useRef(onAuthFailure)

  useLayoutEffect(() => {
    latestRef.current = onAuthFailure
  })

  const handleWriteFailure = useCallback(
    (error: ApiError, action: WriteAction): void => {
      if (isAuthFailure(error)) {
        if (revokedRef.current) return
        revokedRef.current = true
        latestRef.current()
      }
      showToast(writeErrorText(error, action), toastToneOf(error))
    },
    [showToast],
  )

  return { toast, handleWriteFailure }
}
