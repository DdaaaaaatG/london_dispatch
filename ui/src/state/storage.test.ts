/**
 * storage 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-010) · ui/src/chat/test/scenarios.md (TC-CH-025)
 * 대상: ui/src/components/utils/storage.ts (rooms design/components.md §1.7, F-RM-10)
 * 위치: 위임 범위에 따라 순수 함수 스펙을 ui/src/state/ 에 둔다(대상 모듈은 components/utils).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STORAGE_KEYS,
  clearLastRoomId,
  loadLastRoomId,
  loadScrollOffset,
  saveLastRoomId,
  saveScrollOffset,
} from '@/components/utils/storage'

const blocked = () => {
  throw new DOMException('blocked', 'SecurityError')
}

const storageKeys = (): string[] => {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key !== null) keys.push(key)
  }
  return keys.sort()
}

/** window.localStorage 접근 자체가 throw 하는 환경(iframe 저장 차단)을 흉내 낸다 */
const blockStorageAccess = (): (() => void) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: blocked })
  return () => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('storage 키·왕복 (R-ROOMS-004 · R-CHAT-010 · R-NFR-004)', () => {
  it('TC-RM-010: 키 이름은 ld:lastRoomId · ld:scroll:{roomId} 뿐이다', () => {
    expect(STORAGE_KEYS.lastRoomId).toBe('ld:lastRoomId')
    expect(STORAGE_KEYS.scrollOffset('r1')).toBe('ld:scroll:r1')
    expect(Object.keys(STORAGE_KEYS).sort()).toEqual(['lastRoomId', 'scrollOffset'])
  })

  it('TC-RM-010: 마지막 본 방 저장 → 읽기 → 삭제 왕복, 빈 문자열은 null', () => {
    expect(loadLastRoomId()).toBeNull()
    saveLastRoomId('r1')
    expect(localStorage.getItem('ld:lastRoomId')).toBe('r1')
    expect(loadLastRoomId()).toBe('r1')
    clearLastRoomId()
    expect(localStorage.getItem('ld:lastRoomId')).toBeNull()
    expect(loadLastRoomId()).toBeNull()
    localStorage.setItem('ld:lastRoomId', '')
    expect(loadLastRoomId()).toBeNull()
  })

  it('TC-RM-010: 저장 후 저장소에 남는 키는 허용 키뿐(토큰 키 없음)', () => {
    saveLastRoomId('r1')
    saveScrollOffset('r1', 10)
    expect(storageKeys()).toEqual(['ld:lastRoomId', 'ld:scroll:r1'])
  })
})

describe('storage 예외 삼킴 (R-ROOMS-004 "저장 불가 환경에서도 동작")', () => {
  it('TC-RM-010: getItem/setItem/removeItem 이 throw → 읽기는 null, 쓰기·삭제는 무시(throw 없음)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)

    expect(loadLastRoomId()).toBeNull()
    expect(loadScrollOffset('r1')).toBeNull()
    expect(() => saveLastRoomId('r1')).not.toThrow()
    expect(() => clearLastRoomId()).not.toThrow()
    expect(() => saveScrollOffset('r1', 100)).not.toThrow()
  })

  it('TC-RM-010: window.localStorage 접근 자체가 throw → 모든 함수가 throw 없이 null/무시', () => {
    const restore = blockStorageAccess()
    try {
      expect(loadLastRoomId()).toBeNull()
      expect(loadScrollOffset('r1')).toBeNull()
      expect(() => saveLastRoomId('r1')).not.toThrow()
      expect(() => clearLastRoomId()).not.toThrow()
      expect(() => saveScrollOffset('r1', 100)).not.toThrow()
    } finally {
      restore()
    }
  })

  it('TC-RM-010: 실패해도 콘솔에 남기지 않는다(로그 없음)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)

    loadLastRoomId()
    saveLastRoomId('r1')
    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })
})

describe('storage 스크롤 거리 (R-CHAT-010)', () => {
  it('TC-CH-025: saveScrollOffset 은 0 이상 정수로 반올림해 저장한다', () => {
    saveScrollOffset('r1', 12.6)
    expect(localStorage.getItem('ld:scroll:r1')).toBe('13')
    saveScrollOffset('r1', -4)
    expect(localStorage.getItem('ld:scroll:r1')).toBe('0')
    saveScrollOffset('r2', 300)
    expect(localStorage.getItem('ld:scroll:r2')).toBe('300')
  })

  it('TC-CH-025: loadScrollOffset 은 0 이상 유한수만 돌려주고 나머지는 null', () => {
    expect(loadScrollOffset('r1')).toBeNull()
    localStorage.setItem('ld:scroll:r1', '300')
    expect(loadScrollOffset('r1')).toBe(300)
    localStorage.setItem('ld:scroll:r1', '0')
    expect(loadScrollOffset('r1')).toBe(0)
    localStorage.setItem('ld:scroll:r1', 'abc')
    expect(loadScrollOffset('r1')).toBeNull()
    localStorage.setItem('ld:scroll:r1', '-5')
    expect(loadScrollOffset('r1')).toBeNull()
    localStorage.setItem('ld:scroll:r1', 'Infinity')
    expect(loadScrollOffset('r1')).toBeNull()
  })

  it('TC-CH-025: 방마다 키가 분리된다', () => {
    saveScrollOffset('r1', 100)
    saveScrollOffset('r2', 200)
    expect(loadScrollOffset('r1')).toBe(100)
    expect(loadScrollOffset('r2')).toBe(200)
  })
})
