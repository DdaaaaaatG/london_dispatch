/**
 * 쓰기 실패 안내 톤 — 설계 rooms/design/functions.md F-RM-22 · 요구 R-CHAT-011
 * 토큰 만료·등급 미달·레이트리밋은 "주의"(warning), 그 밖은 "오류"(danger)다(ui_design_concept §3 상태 색).
 */
import { type ApiError, isAuthFailure } from '@/api'
import type { ToastTone } from '@/components/ui/Toast'

/** 인증 실패 또는 RATE_LIMITED 면 warning, 그 밖은 danger */
export const toastToneOf = (error: ApiError): ToastTone =>
  isAuthFailure(error) || error.code === 'RATE_LIMITED' ? 'warning' : 'danger'
