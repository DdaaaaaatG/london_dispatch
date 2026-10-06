/**
 * S2 쓰기 규칙 순수 함수 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-029)
 * 대상: ui/src/state/viewer.ts(§1.8) · limits.ts(§1.11) · writeFailure.ts(F-RM-22)
 */
import { describe, expect, it } from 'vitest'
import type { ApiErrorCode } from '@/api'
import {
  MESSAGE_TEXT_MAX_CHARS,
  ROOM_TITLE_MAX_CHARS,
  countChars,
  isMessageTextValid,
  isRoomTitleValid,
} from '@/state/limits'
import { READ_ONLY_VIEWER, WRITER_VIEWER, viewerFromToken } from '@/state/viewer'
import { toastToneOf } from '@/state/writeFailure'

describe('viewer (R-CHAT-008 · R-ROOMS-002)', () => {
  it('TC-RM-029: viewerFromToken(null) = READ_ONLY_VIEWER, (문자열) = WRITER_VIEWER, 둘 다 freeze', () => {
    expect(viewerFromToken(null)).toBe(READ_ONLY_VIEWER)
    expect(viewerFromToken('x')).toBe(WRITER_VIEWER)
    expect(READ_ONLY_VIEWER.canWrite).toBe(false)
    expect(WRITER_VIEWER.canWrite).toBe(true)
    expect(Object.isFrozen(READ_ONLY_VIEWER)).toBe(true)
    expect(Object.isFrozen(WRITER_VIEWER)).toBe(true)
  })
})

describe('limits (R-ROOM-002 · R-MSG-002)', () => {
  it('TC-RM-029: 한도 상수 60 · 2000', () => {
    expect(ROOM_TITLE_MAX_CHARS).toBe(60)
    expect(MESSAGE_TEXT_MAX_CHARS).toBe(2000)
  })

  it('TC-RM-029: countChars 는 trim 후 코드 포인트', () => {
    expect(countChars('  a😀b ')).toBe(3)
    expect(countChars('')).toBe(0)
    expect(countChars('   ')).toBe(0)
  })

  it('TC-RM-029: isRoomTitleValid 경계 0·공백·1·60·61, 이모지 60개', () => {
    expect(isRoomTitleValid('')).toBe(false)
    expect(isRoomTitleValid('   ')).toBe(false)
    expect(isRoomTitleValid('a')).toBe(true)
    expect(isRoomTitleValid('a'.repeat(60))).toBe(true)
    expect(isRoomTitleValid('a'.repeat(61))).toBe(false)
    expect(isRoomTitleValid('😀'.repeat(60))).toBe(true)
    expect(isRoomTitleValid(`  ${'a'.repeat(60)}  `)).toBe(true)
  })

  it('TC-RM-029: isMessageTextValid 경계 0·1·2000·2001', () => {
    expect(isMessageTextValid('')).toBe(false)
    expect(isMessageTextValid(' \n ')).toBe(false)
    expect(isMessageTextValid('a')).toBe(true)
    expect(isMessageTextValid('a'.repeat(2000))).toBe(true)
    expect(isMessageTextValid('a'.repeat(2001))).toBe(false)
  })
})

describe('toastToneOf (R-CHAT-011)', () => {
  it.each([
    ['TOKEN_REQUIRED', 'warning'],
    ['TOKEN_INVALID', 'warning'],
    ['LEVEL_TOO_LOW', 'warning'],
    ['RATE_LIMITED', 'warning'],
    ['LLM_BUDGET_EXCEEDED', 'warning'], // v1.5.1 S3b(rooms F-RM-22) — chat TC-CH-097 근거
    ['LLM_FAILED', 'danger'],
    ['SPEAK_IN_PROGRESS', 'danger'],
    ['INTERNAL', 'danger'],
    ['NETWORK', 'danger'],
    ['NOT_FOUND', 'danger'],
    ['VALIDATION_ERROR', 'danger'],
  ] as const)('TC-RM-029: toastToneOf(%s) = %s', (code: ApiErrorCode, tone) => {
    expect(toastToneOf({ code, message: 'x' })).toBe(tone)
  })})
