/**
 * rooms S6 상태 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-059 · TC-RM-055(c))
 * 대상: ui/src/state/roomKeys.ts (design/components.md §1.21 · design/lock.md F-RM-30~37)
 *       ui/src/components/utils/storage.ts 증명 키 3함수 (components.md §1.7 S6)
 *       ui/src/state/limits.ts 비밀번호 4함수 (components.md §1.11 S6 · lock.md F-RM-39)
 * - 실제 fetch·네트워크 없음. 저장소는 jsdom localStorage + Storage.prototype spy 로 throw 를 흉내 낸다.
 * - 매 TC 전 localStorage.clear() → resetRoomKeyCache() (모듈 캐시 슬롯 초기화, F-RM-37).
 * - 증명 값은 임의 자리표시 문자열이다(실값 아님).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ROOM_KEYS_MAX,
  findRoomKey,
  forgetRoomKey,
  getRoomKey,
  parseRoomKeys,
  removeRoomKey,
  resetRoomKeyCache,
  saveRoomKey,
  serializeRoomKeys,
  upsertRoomKey,
  type RoomKeyEntry,
} from '@/state/roomKeys'
import { clearRoomKeysRaw, loadRoomKeysRaw, saveRoomKeysRaw } from '@/components/utils/storage'
import {
  countPasswordChars,
  isEnterPasswordValid,
  isRoomPasswordSettable,
  isRoomPasswordValid,
} from '@/state/limits'

const KEY = 'ld:roomKeys'
const blocked = () => {
  throw new DOMException('blocked', 'SecurityError')
}
const entriesOf = (n: number): RoomKeyEntry[] =>
  Array.from({ length: n }, (_, i) => [`r${i}`, `k${i}`] as const)

beforeEach(() => {
  localStorage.clear()
  resetRoomKeyCache()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  resetRoomKeyCache()
})

describe('roomKeys 순수 함수 (F-RM-30~33 · R-LOCK-004 · R-LOCK-007)', () => {
  it('TC-RM-059(a): parseRoomKeys — null·빈 문자열·깨진 JSON·배열 아님 → []', () => {
    expect(parseRoomKeys(null)).toEqual([])
    expect(parseRoomKeys('')).toEqual([])
    expect(parseRoomKeys('not json')).toEqual([])
    expect(parseRoomKeys('{"r1":"k1"}')).toEqual([])
    expect(parseRoomKeys('42')).toEqual([])
  })

  it('TC-RM-059(a): parseRoomKeys — [string, string] 이고 둘 다 빈 문자열이 아닌 원소만 남긴다', () => {
    const raw = JSON.stringify([['r1', 'k1'], { x: 1 }, [1, 'k'], ['r2', ''], ['', 'k'], 'str', ['r3', 'k3']])
    expect(parseRoomKeys(raw)).toEqual([
      ['r1', 'k1'],
      ['r3', 'k3'],
    ])
  })

  it('TC-RM-059(a): parseRoomKeys — 같은 방 id 가 여러 번이면 마지막 증명만(순서는 단언하지 않는다)', () => {
    const parsed = parseRoomKeys(JSON.stringify([['a', 'k1'], ['b', 'k2'], ['a', 'k3']]))
    expect(parsed).toHaveLength(2)
    expect(findRoomKey(parsed, 'a')).toBe('k3')
    expect(findRoomKey(parsed, 'b')).toBe('k2')
  })

  it('TC-RM-059(a): parseRoomKeys — 50 초과면 뒤쪽 50개', () => {
    const parsed = parseRoomKeys(JSON.stringify(entriesOf(60)))
    expect(ROOM_KEYS_MAX).toBe(50)
    expect(parsed).toHaveLength(50)
    expect(parsed[0]).toEqual(['r10', 'k10'])
    expect(parsed[49]).toEqual(['r59', 'k59'])
  })

  it('TC-RM-059(b): upsertRoomKey — 51번째 저장 시 가장 오래된 쌍 탈락, 새 쌍은 맨 뒤, 입력 불변', () => {
    const base = Object.freeze(entriesOf(50)) as readonly RoomKeyEntry[]
    const next = upsertRoomKey(base, 'new', 'kn')
    expect(next).toHaveLength(50)
    expect(next[0]).toEqual(['r1', 'k1'])
    expect(next[49]).toEqual(['new', 'kn'])
    expect(base).toHaveLength(50)
    expect(base[0]).toEqual(['r0', 'k0'])
  })

  it('TC-RM-059(b): upsertRoomKey — 같은 방 재저장 → 기존 쌍을 빼고 새 증명으로 맨 뒤', () => {
    const next = upsertRoomKey(
      [
        ['a', 'k1'],
        ['b', 'k2'],
      ],
      'a',
      'k9',
    )
    expect(next).toEqual([
      ['b', 'k2'],
      ['a', 'k9'],
    ])
  })

  it('TC-RM-059(c): removeRoomKey · findRoomKey · serializeRoomKeys', () => {
    const list: readonly RoomKeyEntry[] = [
      ['a', 'k1'],
      ['b', 'k2'],
    ]
    expect(removeRoomKey(list, 'a')).toEqual([['b', 'k2']])
    expect(removeRoomKey(list, 'zz')).toEqual(list)
    expect(list).toHaveLength(2)
    expect(findRoomKey(list, 'b')).toBe('k2')
    expect(findRoomKey(list, 'zz')).toBeNull()
    expect(serializeRoomKeys([])).toBeNull()
    expect(serializeRoomKeys([['a', 'k1']])).toBe('[["a","k1"]]')
  })
})

describe('roomKeys 메모리 슬롯 + storage (F-RM-34~37 · §6.11 · R-LOCK-004 · R-LOCK-007 · R-CHAT-010)', () => {
  it('TC-RM-059(d): saveRoomKey → ld:roomKeys JSON 저장 · getRoomKey 반환 · 빈 증명은 무시', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    saveRoomKey('r3', '')
    expect(setItem).not.toHaveBeenCalled()
    expect(getRoomKey('r3')).toBeNull()

    saveRoomKey('r3', 'e1.x')
    expect(localStorage.getItem(KEY)).toBe('[["r3","e1.x"]]')
    expect(getRoomKey('r3')).toBe('e1.x')
    expect(getRoomKey('r1')).toBeNull()
  })

  it('TC-RM-059(e): 캐시는 첫 접근 때 1회만 저장소를 읽는다 · resetRoomKeyCache 뒤 다시 읽는다', () => {
    localStorage.setItem(KEY, '[["r3","k-old"]]')
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    expect(getRoomKey('r3')).toBe('k-old')
    localStorage.setItem(KEY, '[["r3","k-new"]]')
    expect(getRoomKey('r3')).toBe('k-old')
    expect(getItem.mock.calls.filter(c => c[0] === KEY)).toHaveLength(1)

    resetRoomKeyCache()
    expect(getRoomKey('r3')).toBe('k-new')
  })

  it('TC-RM-059(f): 없는 방 forgetRoomKey → setItem·removeItem 0회 · 마지막 쌍 삭제 → 키 자체 삭제', () => {
    saveRoomKey('r3', 'e1.x')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')

    forgetRoomKey('zz')
    expect(setItem).not.toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()

    forgetRoomKey('r3')
    expect(getRoomKey('r3')).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(removeItem).toHaveBeenCalledWith(KEY)
  })

  it('TC-RM-059(g): 저장소 읽기 throw → getRoomKey null(throw 없음)', () => {
    localStorage.setItem(KEY, '[["r3","e1.x"]]')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    expect(() => getRoomKey('r3')).not.toThrow()
    expect(getRoomKey('r3')).toBeNull()
  })

  it('TC-RM-059(g): 저장소 쓰기·삭제 throw → save·forget 가 throw 없이 같은 세션 캐시로 동작', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)
    expect(() => saveRoomKey('r3', 'e1.x')).not.toThrow()
    expect(getRoomKey('r3')).toBe('e1.x')
    expect(() => forgetRoomKey('r3')).not.toThrow()
    expect(getRoomKey('r3')).toBeNull()
  })

  it('TC-RM-059(h): storage 원문 3함수 — 빈 문자열은 null · 쓰기·삭제 · throw 삼킴', () => {
    expect(loadRoomKeysRaw()).toBeNull()
    localStorage.setItem(KEY, '')
    expect(loadRoomKeysRaw()).toBeNull()
    saveRoomKeysRaw('[["a","k"]]')
    expect(localStorage.getItem(KEY)).toBe('[["a","k"]]')
    expect(loadRoomKeysRaw()).toBe('[["a","k"]]')
    clearRoomKeysRaw()
    expect(localStorage.getItem(KEY)).toBeNull()

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)
    expect(loadRoomKeysRaw()).toBeNull()
    expect(() => saveRoomKeysRaw('[]')).not.toThrow()
    expect(() => clearRoomKeysRaw()).not.toThrow()
  })
})

describe('limits 비밀번호 (F-RM-39 · R-LOCK-001 · trim 없음)', () => {
  it('TC-RM-055(c): countPasswordChars — trim 없이 코드 포인트', () => {
    expect(countPasswordChars('')).toBe(0)
    expect(countPasswordChars(' ab ')).toBe(4)
    expect(countPasswordChars('😀😀😀😀')).toBe(4)
  })

  it('TC-RM-055(c): isRoomPasswordSettable 4~32 · isRoomPasswordValid 빈칸 허용 · isEnterPasswordValid 1~64', () => {
    const n = (k: number) => 'a'.repeat(k)
    expect([n(0), n(3), n(4), n(32), n(33)].map(isRoomPasswordSettable)).toEqual([false, false, true, true, false])
    expect([n(0), n(3), n(4), n(32), n(33)].map(isRoomPasswordValid)).toEqual([true, false, true, true, false])
    expect(isRoomPasswordValid(' ab ')).toBe(true)
    expect(isRoomPasswordValid('😀😀😀😀')).toBe(true)
    expect([n(0), n(1), n(64), n(65)].map(isEnterPasswordValid)).toEqual([false, true, true, false])
  })
})
