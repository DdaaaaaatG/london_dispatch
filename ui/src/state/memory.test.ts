/**
 * chat S4 장기기억 순수 판정 스펙 초안(TDD Red) — 단일 소스 ui/src/chat/test/scenarios.md
 * (TC-CH-128 · 129 · 130 순수 행) · 설계 ui/src/chat/design/memory.md ME §2 · F-CH-61 · D-39 · D-41
 * 대상: ui/src/state/memory.ts — MEMORY_SUMMARY_MAX_CHARS · isMemoryOver · isMemoryDirty · canSaveMemory · type MemoryLoad
 * 규칙: 길이·변경 판정은 trim 후 코드 포인트(api.md §5.7 · @shared/limits, 이모지 1개 = 1자). React·DOM 의존 없음.
 * 입력은 Object.freeze 로 얼려 넘긴다(불변 — 함수가 고치려 하면 strict 모드에서 throw).
 */
import { describe, expect, it } from 'vitest'
import { MEMORY_SUMMARY_MAX } from '@shared/limits'
import type { MemoryResponse } from '@shared/types'
import {
  MEMORY_SUMMARY_MAX_CHARS,
  canSaveMemory,
  isMemoryDirty,
  isMemoryOver,
  type MemoryLoad,
} from '@/state/memory'

const base = (summary: string): MemoryResponse =>
  Object.freeze({
    summary,
    sourceUntilId: 987,
    updatedAt: new Date(2026, 9, 7, 16, 30).getTime(),
  })
const ready = (summary: string): MemoryLoad =>
  Object.freeze({ phase: 'ready' as const, base: base(summary) })
const LOADING: MemoryLoad = Object.freeze({ phase: 'loading' as const })
const ERROR: MemoryLoad = Object.freeze({
  phase: 'error' as const,
  error: Object.freeze({ code: 'NETWORK' as const, message: '서버에 연결할 수 없습니다.' }),
})

const G4000 = '가'.repeat(4000)
const G4001 = '가'.repeat(4001)
const E4000 = '😀'.repeat(4000)
const E4001 = '😀'.repeat(4001)

describe('MEMORY_SUMMARY_MAX_CHARS (R-MEM-001 🔒)', () => {
  it('TC-CH-129: (순수) 한도는 @shared/limits MEMORY_SUMMARY_MAX 재노출 = 4000', () => {
    expect(MEMORY_SUMMARY_MAX_CHARS).toBe(MEMORY_SUMMARY_MAX)
    expect(MEMORY_SUMMARY_MAX_CHARS).toBe(4000)
  })
})

describe('isMemoryOver (R-CHAT-012 🔒 · R-MEM-001 🔒)', () => {
  it.each<[string, string, boolean]>([
    ['빈 값', '', false],
    ['4000자', G4000, false],
    ['앞뒤 공백 + 4000자', `  ${G4000}\n`, false],
    ['이모지 4000개', E4000, false],
    ['4001자', G4001, true],
    ['이모지 4001개', E4001, true],
  ])('TC-CH-129: (순수) %s → %s', (_label, draft, expected) => {
    expect(isMemoryOver(draft)).toBe(expected)
  })
})

describe('isMemoryDirty (R-CHAT-012 🔒 · D-41)', () => {
  it.each<[string, MemoryLoad, string, boolean]>([
    ['loading 은 언제나 false', LOADING, '아무 글', false],
    ['error 는 언제나 false', ERROR, '아무 글', false],
    ['ready "abc" + 같은 값', ready('abc'), 'abc', false],
    ['ready "abc" + 앞뒤 공백만 덧붙임', ready('abc'), '  abc\n', false],
    ['ready "abc" + 글자 변경', ready('abc'), 'abd', true],
    ['ready "abc" + 비움', ready('abc'), '', true],
    ['ready "" + 빈 값', ready(''), '', false],
    ['ready "" + 공백만', ready(''), '   ', false],
    ['ready "" + 글자', ready(''), 'x', true],
  ])('TC-CH-128: (순수) %s', (_label, load, draft, expected) => {
    expect(isMemoryDirty(load, draft)).toBe(expected)
  })
})

describe('canSaveMemory (R-CHAT-012 🔒 · D-39 · D-41)', () => {
  it.each<[string, MemoryLoad, string, boolean, boolean]>([
    ['ready + 변경 + 미초과 + 저장 중 아님', ready('abc'), 'abd', false, true],
    ['저장 중이면 false', ready('abc'), 'abd', true, false],
    ['변경 없음(앞뒤 공백만)이면 false', ready('abc'), ' abc ', false, false],
    ['4001자(변경이지만 초과)면 false', ready('abc'), G4001, false, false],
    ['4000자 변경은 true', ready('abc'), G4000, false, true],
    ['loading 이면 false', LOADING, 'abd', false, false],
    ['error 이면 false', ERROR, 'abd', false, false],
  ])('TC-CH-128: (순수) %s', (_label, load, draft, isSaving, expected) => {
    expect(canSaveMemory(load, draft, isSaving)).toBe(expected)
  })

  it('TC-CH-130: (순수) 요약 있음에서 전부 지움 → 저장 가능(비우기 confirm 없음, 0자 허용)', () => {
    expect(canSaveMemory(ready('abc'), '', false)).toBe(true)
  })

  it('TC-CH-128: (순수) 얼린 입력을 고치지 않는다', () => {
    const load = ready('abc')
    expect(() => {
      isMemoryOver('abc')
      isMemoryDirty(load, 'abd')
      canSaveMemory(load, 'abd', false)
    }).not.toThrow()
    expect(load).toEqual({ phase: 'ready', base: base('abc') })
  })
})
