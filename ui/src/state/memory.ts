/**
 * 장기기억 시트 순수 판정 — 설계 chat/design/memory.md ME §2 · F-CH-61 · D-39 · D-41 · 요구 R-CHAT-012 🔒 · R-MEM-001 🔒
 * 비유: 쪽지를 고쳐 쓸 때 "글자 수가 넘쳤나", "원문과 달라졌나", "지금 저장해도 되나"만 따지는 심판이다.
 * 길이·변경 판정은 trim 후 코드 포인트(api.md §5.7 · @shared/limits, 이모지 1개 = 1자). React·DOM 의존 없음(타입 import 만).
 * 토큰은 이 상태 어디에도 없다 — 래퍼가 헤더를 붙인다(R-CHAT-009 · R-NFR-004).
 */
import { MEMORY_SUMMARY_MAX, normalizeText } from '@shared/limits'
import type { MemoryResponse } from '@shared/types'
import type { ApiError } from '@/api'
import { countChars } from '@/state/limits'

/** 장기기억 조회 단계. ready 의 base 는 서버가 돌려준 값(summary 는 서버가 trim 한 저장값) */
export type MemoryLoad =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly error: ApiError }
  | { readonly phase: 'ready'; readonly base: MemoryResponse }

/** 요약 최대 글자 수. @shared/limits 재노출(0~4000, 빈 요약 허용) */
export const MEMORY_SUMMARY_MAX_CHARS = MEMORY_SUMMARY_MAX

/** 앞뒤 공백을 뺀 코드 포인트 수가 한도를 넘는가 */
export const isMemoryOver = (draft: string): boolean => countChars(draft) > MEMORY_SUMMARY_MAX_CHARS

/** 조회된 원문과 달라졌는가(trim 기준 — 앞뒤 공백만 덧붙인 것은 변경이 아니다). ready 가 아니면 언제나 false */
export const isMemoryDirty = (load: MemoryLoad, draft: string): boolean =>
  load.phase === 'ready' && normalizeText(draft) !== load.base.summary

/** 「저장」 활성: 조회됨 ∧ 저장 중 아님 ∧ 변경 있음 ∧ 한도 이내. 0자(비우기)도 변경이면 저장할 수 있다 */
export const canSaveMemory = (load: MemoryLoad, draft: string, isSaving: boolean): boolean =>
  load.phase === 'ready' && !isSaving && isMemoryDirty(load, draft) && !isMemoryOver(draft)
