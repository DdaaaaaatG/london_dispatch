/**
 * 공용 훅 useToast — 설계 rooms/design/components.md §1.18 · 요구 R-CHAT-011
 * 알림 하나를 2초 보였다가 지운다. 새 showToast 는 지금 알림을 바꾸고 타이머를 2초로 다시 건다(id 는 1씩 증가).
 * 타이머는 하나뿐이고 언마운트 때 해제한다. 수동 닫기는 요구가 없어 두지 않는다. 위치는 화면이 정한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToastTone } from '@/components/ui/Toast'

export const TOAST_DURATION_MS = 2000

export type ToastState = {
  readonly id: number
  readonly message: string
  readonly tone: ToastTone
} | null

export type UseToastResult = {
  toast: ToastState
  /** 지금 알림을 바꾸고 타이머를 2초로 다시 건다 */
  showToast: (message: string, tone: ToastTone) => void
}

export const useToast = (): UseToastResult => {
  const [toast, setToast] = useState<ToastState>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextIdRef = useRef(1)

  const clearTimer = useCallback((): void => {
    if (timerRef.current === null) return
    clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  // 언마운트 때 남은 타이머를 해제한다
  useEffect(() => clearTimer, [clearTimer])

  const showToast = useCallback(
    (message: string, tone: ToastTone): void => {
      clearTimer()
      const id = nextIdRef.current
      nextIdRef.current += 1
      setToast({ id, message, tone })
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        setToast(null)
      }, TOAST_DURATION_MS)
    },
    [clearTimer],
  )

  return { toast, showToast }
}
