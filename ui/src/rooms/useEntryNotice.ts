/**
 * useEntryNotice — 설계 rooms/design/functions.md F-RM-29(S3c) · 요구 R-SET-010 · R-CHAT-011
 * 설정 화면에서 rooms 로 돌아올 때 App 이 넘긴 안내(entryNotice)를 마운트 때 한 번 토스트로 띄우고, App 에 알려 비우게 한다.
 * 마운트당 1회다: 다시 렌더되거나 같은 안내가 다시 와도 반복하지 않고(shownRef), StrictMode 의 effect 재실행도 막는다.
 * 안내가 없으면 아무것도 하지 않는다. 최신 값은 ref 로 읽는다(마운트 effect 는 deps 가 비어 있다).
 */
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { ToastProps, ToastTone } from '@/components/ui/Toast'

export type UseEntryNoticeOptions = {
  entryNotice: ToastProps | null | undefined
  onEntryNoticeShown: (() => void) | undefined
  showToast: (message: string, tone: ToastTone) => void
}

export const useEntryNotice = (options: UseEntryNoticeOptions): void => {
  const latestRef = useRef(options)
  const shownRef = useRef(false)

  useLayoutEffect(() => {
    latestRef.current = options
  })

  useEffect(() => {
    if (shownRef.current) return
    shownRef.current = true
    const { entryNotice, onEntryNoticeShown, showToast } = latestRef.current
    if (!entryNotice) return
    showToast(entryNotice.message, entryNotice.tone)
    onEntryNoticeShown?.()
  }, [])
}
