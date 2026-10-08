/** [계약] api.md §14.6 API-T-046 · [요구] R-ROOM-002, R-MSG-002, R-MSG-004, R-MEM-001 */
import { describe, expect, it } from 'vitest'
import {
  countCodePoints,
  MEMORY_SUMMARY_MAX,
  MESSAGE_TEXT_MAX,
  normalizeText,
  ROOM_ENTER_PASSWORD_MAX,
  ROOM_KEY_MAX_LENGTH,
  ROOM_PASSWORD_MAX,
  ROOM_PASSWORD_MIN,
  ROOM_TITLE_MAX,
} from '../src/limits'

describe('API-T-046 limits_match_requirements_and_count_code_points', () => {
  it('상수가 요구와 같다', () => {
    expect(ROOM_TITLE_MAX).toBe(60)
    expect(MESSAGE_TEXT_MAX).toBe(2000)
    expect(MEMORY_SUMMARY_MAX).toBe(4000)
  })

  it('countCodePoints는 코드 포인트로 센다', () => {
    expect(countCodePoints('')).toBe(0)
    expect(countCodePoints('abc')).toBe(3)
    expect(countCodePoints('한글')).toBe(2)
    expect(countCodePoints('😀')).toBe(1)
    expect('😀'.length).toBe(2)
    expect(countCodePoints('👨‍👩‍👧')).toBe(5)
    expect(countCodePoints('😀'.repeat(60))).toBe(60)
  })

  it('경계 60/2000/4000', () => {
    expect(countCodePoints('가'.repeat(ROOM_TITLE_MAX))).toBe(60)
    expect(countCodePoints('가'.repeat(ROOM_TITLE_MAX + 1))).toBeGreaterThan(ROOM_TITLE_MAX)
    expect(countCodePoints('😀'.repeat(MESSAGE_TEXT_MAX))).toBe(MESSAGE_TEXT_MAX)
    expect(countCodePoints('😀'.repeat(MEMORY_SUMMARY_MAX))).toBe(MEMORY_SUMMARY_MAX)
  })

  it('normalizeText는 앞뒤만 지운다', () => {
    expect(normalizeText('  a \n b \n')).toBe('a \n b')
    expect(normalizeText('\u3000x\u3000')).toBe('x')
    expect(normalizeText('   ')).toBe('')
  })
})

describe('API-T-164 room_password_limits (S6, R-LOCK-001)', () => {
  it('상수가 계약과 같다', () => {
    expect(ROOM_PASSWORD_MIN).toBe(4)
    expect(ROOM_PASSWORD_MAX).toBe(32)
    expect(ROOM_ENTER_PASSWORD_MAX).toBe(64)
    expect(ROOM_KEY_MAX_LENGTH).toBe(128)
  })
})
