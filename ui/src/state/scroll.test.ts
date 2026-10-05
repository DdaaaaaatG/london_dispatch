/**
 * scroll 계산 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md (TC-CH-017)
 * 대상: ui/src/state/scroll.ts (chat design/functions.md §2, F-CH-13). 순수 함수 — DOM·api 의존 없음.
 */
import { describe, expect, it } from 'vitest'
import {
  BOTTOM_THRESHOLD_PX,
  TOP_THRESHOLD_PX,
  anchorScrollTop,
  distanceFromBottom,
  isNearBottom,
  isNearTop,
  restoreScrollTop,
} from '@/state/scroll'

const m = (scrollTop: number, scrollHeight = 3000, clientHeight = 493) => ({ scrollTop, scrollHeight, clientHeight })

describe('scroll.ts (R-CHAT-003 · R-CHAT-010)', () => {
  it('TC-CH-017: 임계값은 위 80px · 아래 120px', () => {
    expect(TOP_THRESHOLD_PX).toBe(80)
    expect(BOTTOM_THRESHOLD_PX).toBe(120)
  })

  it('TC-CH-017: distanceFromBottom = max(0, scrollHeight - scrollTop - clientHeight)', () => {
    expect(distanceFromBottom(m(2507))).toBe(0)
    expect(distanceFromBottom(m(1000))).toBe(1507)
    expect(distanceFromBottom(m(2600))).toBe(0) // 음수는 0
  })

  it('TC-CH-017: isNearTop 경계 — 80 이하 true, 81 false', () => {
    expect(isNearTop(m(0))).toBe(true)
    expect(isNearTop(m(80))).toBe(true)
    expect(isNearTop(m(81))).toBe(false)
  })

  it('TC-CH-017: isNearBottom 경계 — 거리 120 이하 true, 121 false', () => {
    expect(isNearBottom(m(2387))).toBe(true) // 거리 120
    expect(isNearBottom(m(2386))).toBe(false) // 거리 121
    expect(isNearBottom(m(2507))).toBe(true) // 거리 0
  })

  it('TC-CH-017: anchorScrollTop = prev.scrollTop + (새 scrollHeight - prev.scrollHeight)', () => {
    expect(anchorScrollTop(m(40), 6000)).toBe(3040)
    expect(anchorScrollTop(m(40), 3000)).toBe(40)
  })

  it('TC-CH-017: restoreScrollTop — null 은 맨 아래, 저장 거리만큼 위, 범위 밖은 클램프', () => {
    const box = { scrollHeight: 3000, clientHeight: 493 }
    expect(restoreScrollTop(box, null)).toBe(2507)
    expect(restoreScrollTop(box, 0)).toBe(2507)
    expect(restoreScrollTop(box, 300)).toBe(2207)
    expect(restoreScrollTop(box, 5000)).toBe(0) // 저장 거리 > 내용 높이 → 0
    expect(restoreScrollTop({ scrollHeight: 300, clientHeight: 493 }, null)).toBe(0) // 내용이 상자보다 짧다
    expect(restoreScrollTop({ scrollHeight: 300, clientHeight: 493 }, 100)).toBe(0)
  })

  it('TC-CH-017: 입력 객체를 바꾸지 않는다', () => {
    const prev = Object.freeze(m(40))
    expect(() => anchorScrollTop(prev, 6000)).not.toThrow()
    expect(() => distanceFromBottom(prev)).not.toThrow()
    expect(prev.scrollTop).toBe(40)
  })
})
