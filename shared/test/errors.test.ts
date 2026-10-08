/** [계약] api.md §14.2 API-T-040·041·048 · [요구] R-API-002 */
import { describe, expect, it } from 'vitest'
import { ERROR_CODES, ERROR_MESSAGES, ERROR_STATUS, isErrorCode } from '../src/errors'

const EXPECTED_STATUS = {
  VALIDATION_ERROR: 400,
  TOKEN_REQUIRED: 401,
  TOKEN_INVALID: 401,
  LEVEL_TOO_LOW: 403,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  SPEAK_IN_PROGRESS: 409,
  NOT_LAST_MESSAGE: 409,
  NOT_CHARACTER_MESSAGE: 400,
  LLM_FAILED: 502,
  LLM_EMPTY: 502,
  LLM_BUDGET_EXCEEDED: 429,
  CONFIG_INVALID: 500,
  OWNER_ONLY: 403,
  ROOM_LOCKED: 403,
  ROOM_PASSWORD_WRONG: 403,
  INTERNAL: 500,
} as const

describe('API-T-040 error_table_matches_contract', () => {
  it('코드 집합이 계약 17종과 같다', () => {
    expect([...ERROR_CODES].sort()).toEqual(Object.keys(EXPECTED_STATUS).sort())
    expect(ERROR_CODES).toHaveLength(17)
  })

  it('모든 코드에 status가 있고 계약 표와 같다', () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_STATUS[code]).toBe(EXPECTED_STATUS[code])
    }
  })

  it('모든 코드에 비어 있지 않은 문구가 있다', () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_MESSAGES[code].trim().length).toBeGreaterThan(0)
    }
  })
})

describe('API-T-041 isErrorCode_accepts_only_contract_codes', () => {
  it('계약 코드만 true', () => {
    expect(isErrorCode('NOT_FOUND')).toBe(true)
    for (const code of ERROR_CODES) expect(isErrorCode(code)).toBe(true)
  })

  it('NETWORK·소문자·숫자·undefined는 false', () => {
    expect(isErrorCode('NETWORK')).toBe(false)
    expect(isErrorCode('not_found')).toBe(false)
    expect(isErrorCode(1)).toBe(false)
    expect(isErrorCode(undefined)).toBe(false)
  })
})

describe('API-T-048 errors_include_budget_exceeded', () => {
  it('LLM_EMPTY 다음에 있고 429·요구 원문 문구다', () => {
    expect(ERROR_CODES.indexOf('LLM_BUDGET_EXCEEDED')).toBe(ERROR_CODES.indexOf('LLM_EMPTY') + 1)
    expect(ERROR_STATUS.LLM_BUDGET_EXCEEDED).toBe(429)
    expect(ERROR_MESSAGES.LLM_BUDGET_EXCEEDED).toBe(
      '이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.',
    )
    expect(isErrorCode('LLM_BUDGET_EXCEEDED')).toBe(true)
  })
})

describe('API-T-049 errors_include_owner_only', () => {
  it('CONFIG_INVALID 다음, 403, 계약 문구', () => {
    expect(ERROR_CODES.indexOf('OWNER_ONLY')).toBe(ERROR_CODES.indexOf('CONFIG_INVALID') + 1)
    expect(ERROR_CODES[ERROR_CODES.indexOf('OWNER_ONLY') + 1]).toBe('ROOM_LOCKED')
    expect(ERROR_STATUS.OWNER_ONLY).toBe(403)
    expect(ERROR_MESSAGES.OWNER_ONLY).toBe('캐릭터 설정은 갠홈 주인만 열 수 있습니다.')
    expect(isErrorCode('OWNER_ONLY')).toBe(true)
  })
})

describe('API-T-040b errors_include_room_lock_codes (S6, R-LOCK-004 · R-LOCK-006)', () => {
  it('OWNER_ONLY 다음 ROOM_LOCKED, ROOM_PASSWORD_WRONG, INTERNAL 앞 · 둘 다 403 · 계약 문구', () => {
    const i = ERROR_CODES.indexOf('OWNER_ONLY')
    expect(ERROR_CODES.slice(i + 1)).toEqual(['ROOM_LOCKED', 'ROOM_PASSWORD_WRONG', 'INTERNAL'])
    expect(ERROR_STATUS.ROOM_LOCKED).toBe(403)
    expect(ERROR_STATUS.ROOM_PASSWORD_WRONG).toBe(403)
    expect(ERROR_MESSAGES.ROOM_LOCKED).toBe('이 방은 비밀번호로 잠겨 있습니다.')
    expect(ERROR_MESSAGES.ROOM_PASSWORD_WRONG).toBe('비밀번호가 맞지 않습니다.')
    expect(isErrorCode('ROOM_LOCKED')).toBe(true)
    expect(isErrorCode('ROOM_PASSWORD_WRONG')).toBe(true)
  })
})
