/** [계약] api.md §14.2 API-T-040·041 · [요구] R-API-002 */
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
  CONFIG_INVALID: 500,
  INTERNAL: 500,
} as const

describe('API-T-040 error_table_matches_contract', () => {
  it('코드 집합이 계약 13종과 같다', () => {
    expect([...ERROR_CODES].sort()).toEqual(Object.keys(EXPECTED_STATUS).sort())
    expect(ERROR_CODES).toHaveLength(13)
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
