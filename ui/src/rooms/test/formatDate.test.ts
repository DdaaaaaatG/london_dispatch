/**
 * formatDate 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-013)
 * 대상: ui/src/components/utils/formatDate.ts (rooms design/components.md §1.6, F-RM-11)
 * 입력은 로컬 생성자로 만든다 → 시간대에 의존하지 않는다.
 */
import { describe, expect, it } from 'vitest'
import { formatMonthDay, formatTime, toIsoDate, toIsoDateTime } from '@/components/utils/formatDate'

const local = (y: number, m0: number, d: number, h = 0, min = 0): number => new Date(y, m0, d, h, min).getTime()

describe('formatDate (R-ROOMS-001 · R-CHAT-001 · R-CHAT-002)', () => {
  it('TC-RM-013: formatMonthDay → MM.DD 두 자리 0 채움', () => {
    expect(formatMonthDay(local(2026, 9, 5, 16, 40))).toBe('10.05')
    expect(formatMonthDay(local(2026, 0, 5, 9, 7))).toBe('01.05')
    expect(formatMonthDay(local(2026, 11, 31, 23, 59))).toBe('12.31')
  })

  it('TC-RM-013: formatTime → HH:mm 24시간 0 채움', () => {
    expect(formatTime(local(2026, 9, 5, 16, 40))).toBe('16:40')
    expect(formatTime(local(2026, 0, 5, 9, 7))).toBe('09:07')
    expect(formatTime(local(2026, 0, 5, 0, 0))).toBe('00:00')
    expect(formatTime(local(2026, 0, 5, 23, 59))).toBe('23:59')
  })

  it('TC-RM-013: toIsoDate → YYYY-MM-DD, toIsoDateTime → YYYY-MM-DDTHH:mm', () => {
    expect(toIsoDate(local(2026, 0, 5, 9, 7))).toBe('2026-01-05')
    expect(toIsoDate(local(2026, 9, 5, 16, 40))).toBe('2026-10-05')
    expect(toIsoDateTime(local(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07')
    expect(toIsoDateTime(local(2026, 9, 5, 16, 40))).toBe('2026-10-05T16:40')
  })

  it('TC-RM-013: 같은 입력이면 같은 출력(순수), 입력 범위 경계(자정 직전·직후)', () => {
    const t = local(2026, 9, 5, 23, 59)
    expect(formatMonthDay(t)).toBe(formatMonthDay(t))
    expect(formatMonthDay(local(2026, 9, 6, 0, 0))).toBe('10.06')
    expect(toIsoDate(local(2026, 9, 6, 0, 0))).toBe('2026-10-06')
  })
})
