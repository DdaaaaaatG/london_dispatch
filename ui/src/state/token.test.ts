/**
 * token.ts 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-028)
 * 대상: ui/src/state/token.ts (rooms design/components.md §1.10 · F-RM-20) — 메모리 슬롯, 저장소·쿠키 금지
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearToken, getToken, initToken, readTokenFromSearch } from '@/state/token'

beforeEach(() => {
  clearToken()
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  clearToken()
})

describe('readTokenFromSearch (R-CHAT-009 · R-API-003)', () => {
  it.each([
    ['?t=abc', 'abc'],
    ['?t=%20abc%20', 'abc'],
    ['?t=a%2Bb', 'a+b'],
    ['?x=1&t=abc', 'abc'],
    ['?t=', null],
    ['?t=%20', null],
    ['', null],
    ['?x=1', null],
  ] as const)('TC-RM-028: readTokenFromSearch(%j) → %j', (search, expected) => {
    expect(readTokenFromSearch(search)).toBe(expected)
  })
})

describe('토큰 슬롯 (R-CHAT-009 · R-NFR-004)', () => {
  it('TC-RM-028: initToken → getToken, clearToken → null, 저장소·쿠키·window 변화 없음', () => {
    const cookieBefore = document.cookie
    const windowKeysBefore = new Set(Object.keys(window))

    expect(getToken()).toBeNull()
    initToken('?t=abc')
    expect(getToken()).toBe('abc')

    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(document.cookie).toBe(cookieBefore)
    const added = Object.keys(window).filter(k => !windowKeysBefore.has(k))
    for (const key of added) {
      expect(String((window as unknown as Record<string, unknown>)[key])).not.toBe('abc')
    }

    clearToken()
    expect(getToken()).toBeNull()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('TC-RM-028: 빈 값으로 initToken 하면 슬롯은 null', () => {
    initToken('?t=abc')
    initToken('?t=%20')
    expect(getToken()).toBeNull()
  })
})
