// SRV-T-360~367 — doc/200_설계/server/rooms.md §12.10 (비밀번호 해시·입장 증명 순수 함수)
import { describe, expect, it } from 'vitest'
import { AppError } from '../src/app-error'
import { decodeBase64Url, encodeBase64Url } from '../src/base64url'
import { deriveEntrySecret, issueEntryKey, verifyEntryKey } from '../src/rooms/entry-key'
import {
  checkPasswordRule,
  hashPassword,
  parsePasswordHash,
  PASSWORD_HASH_ITERATIONS,
  ROOM_PASSWORD_RULE_MESSAGE,
  verifyPassword,
} from '../src/rooms/password'

const SECRET = 'test-secret-0123456789-abcdefghijklmnop'
const HASH_FORMAT = /^pbkdf2-sha256\$[1-9][0-9]*\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/

/** 테스트가 직접 만드는 해시 문자열(반복 수·salt 지정) */
const buildHash = async (password: string, iterations: number): Promise<string> => {
  const salt = new Uint8Array(16).fill(7)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )
  return `pbkdf2-sha256$${iterations}$${encodeBase64Url(salt)}$${encodeBase64Url(new Uint8Array(bits))}`
}

const codeAndMessage = (fn: () => unknown): [string, string] => {
  try {
    fn()
  } catch (e) {
    if (e instanceof AppError) return [e.code, e.message]
    throw e
  }
  return ['NO_ERROR', '']
}

describe('password.ts', () => {
  it('SRV-T-360 hashPassword_format', async () => {
    const hash = await hashPassword('abcd')
    expect(hash).toMatch(HASH_FORMAT)
    expect(hash.split('$')[1]).toBe(String(PASSWORD_HASH_ITERATIONS))
    expect(hash.length).toBeGreaterThanOrEqual(20)
    expect(hash.length).toBeLessThanOrEqual(200)
  })

  it('SRV-T-361 hashPassword_new_salt_each_time', async () => {
    const [a, b] = [await hashPassword('same-pass'), await hashPassword('same-pass')]
    expect(a).not.toBe(b)
    expect(await verifyPassword('same-pass', a)).toBe(true)
    expect(await verifyPassword('same-pass', b)).toBe(true)
  })

  it('SRV-T-362 verifyPassword_true_false', async () => {
    const hash = await hashPassword('abcd')
    expect(await verifyPassword('abcd', hash)).toBe(true)
    expect(await verifyPassword('abce', hash)).toBe(false)
    expect(await verifyPassword(' abcd ', hash)).toBe(false)
  })

  it('SRV-T-363 verifyPassword_uses_stored_iterations', async () => {
    const low = await buildHash('abcd', 1_000)
    const current = await hashPassword('abcd')
    expect(PASSWORD_HASH_ITERATIONS).not.toBe(1_000)
    expect(await verifyPassword('abcd', low)).toBe(true)
    expect(await verifyPassword('abcd', current)).toBe(true)
    expect(await verifyPassword('abcx', low)).toBe(false)
  })

  it('SRV-T-364 verifyPassword_false_for_broken', async () => {
    const good = await hashPassword('abcd')
    const [scheme, , salt, derived] = good.split('$') as [string, string, string, string]
    const short = (s: string, n: number): string => encodeBase64Url(decodeBase64Url(s)!.slice(0, n))
    const broken = [
      '',
      'x',
      `pbkdf2-sha1$1000$${salt}$${derived}`,
      `${scheme}$0$${salt}$${derived}`,
      `${scheme}$100001$${salt}$${derived}`,
      `${scheme}$1e3$${salt}$${derived}`,
      `${scheme}$1000$${short(salt, 15)}$${derived}`,
      `${scheme}$1000$${salt}$${short(derived, 31)}`,
      `${good}$extra`,
    ]
    for (const stored of broken) {
      expect(parsePasswordHash(stored)).toBeNull()
      expect(await verifyPassword('abcd', stored)).toBe(false)
    }
    expect(parsePasswordHash(good)).not.toBeNull()
  })

  it('SRV-T-365 checkPasswordRule_code_points', () => {
    for (const ok of ['abcd', 'a'.repeat(32), '😀😀😀😀', '  ab  '])
      expect(checkPasswordRule(ok)).toBe(ok)
    for (const bad of ['', 'abc', 'a'.repeat(33), '😀'.repeat(33)]) {
      expect(codeAndMessage(() => checkPasswordRule(bad))).toEqual([
        'VALIDATION_ERROR',
        ROOM_PASSWORD_RULE_MESSAGE,
      ])
    }
    expect(ROOM_PASSWORD_RULE_MESSAGE).toBe('비밀번호는 4~32자로 입력해 주세요.')
  })
})

describe('entry-key.ts', () => {
  it('SRV-T-366 issueEntryKey_deterministic_and_bound', async () => {
    const k = await deriveEntrySecret(SECRET)
    const base = await issueEntryKey(k, 'room-a', 'hash-1')
    expect(base).toMatch(/^e1\.[A-Za-z0-9_-]{43}$/)
    expect(base).toHaveLength(46)
    expect(await issueEntryKey(k, 'room-a', 'hash-1')).toBe(base)
    expect(await issueEntryKey(k, 'room-a', 'hash-2')).not.toBe(base)
    expect(await issueEntryKey(k, 'room-b', 'hash-1')).not.toBe(base)
    const other = await deriveEntrySecret(`${SECRET}-other`)
    expect(await issueEntryKey(other, 'room-a', 'hash-1')).not.toBe(base)
  })

  it('SRV-T-367 verifyEntryKey_rejects', async () => {
    const k = await deriveEntrySecret(SECRET)
    const good = await issueEntryKey(k, 'room-a', 'hash-1')
    const mid = Math.floor(good.length / 2)
    const tampered = `${good.slice(0, mid)}${good[mid] === 'A' ? 'B' : 'A'}${good.slice(mid + 1)}`
    expect(await verifyEntryKey(k, 'room-a', 'hash-1', good)).toBe(true)
    const bad: (string | null)[] = [
      tampered,
      null,
      '',
      `e1.${'A'.repeat(126)}`,
      good.replace('e1.', 'e2.'),
      `e1.${'!'.repeat(43)}`,
    ]
    expect(bad[3]).toHaveLength(129)
    for (const presented of bad) {
      expect(await verifyEntryKey(k, 'room-a', 'hash-1', presented)).toBe(false)
    }
    expect(await verifyEntryKey(k, 'room-b', 'hash-1', good)).toBe(false)
  })
})
