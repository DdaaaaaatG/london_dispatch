// server/scripts/token-tool.ts 단위 시험 — 발급·검증·교차 벡터 (R-TOKEN-001 · R-AUTH-001·002)
import { describe, expect, it } from 'vitest'
import { verifyToken } from '../src/auth/token'
import {
  buildVectorRows,
  formatVerify,
  renderVectors,
  signToken,
  verifyTokenCli,
} from '../scripts/token-tool'
import {
  TOKEN_V5,
  TOKEN_V5B,
  TOKEN_VECTORS,
  VECTOR_EXP_SEC,
  VECTOR_MIN_LEVEL,
  VECTOR_NOW_MS,
  VECTOR_SECRET,
} from './token-vectors'

const SECRET = 'token-test-script-secret-0123456789'
const NOW = VECTOR_NOW_MS

describe('token-tool 벡터', () => {
  it('buildVectorRows 가 §2.6 기준 토큰과 바이트 단위로 같다', async () => {
    const rows = await buildVectorRows(VECTOR_SECRET)
    const byId = Object.fromEntries(rows.map(r => [r.id, r.token]))
    expect(byId).toMatchObject({ ...TOKEN_VECTORS, V5: TOKEN_V5, V5b: TOKEN_V5B })
    expect(rows.map(r => r.id)).toEqual(['V1', 'V2', 'V3', 'V4', 'V5', 'V5b', 'V6', 'V7', 'V8'])
  })

  it('renderVectors 에 SECRET 이 없고 V1 토큰이 있다', async () => {
    const text = (await renderVectors(VECTOR_SECRET)).join('\n')
    expect(text).toContain(TOKEN_VECTORS.V1)
    expect(text).not.toContain(VECTOR_SECRET)
  })
})

describe('signToken', () => {
  it('서버 verifyToken 이 통과시키고 PHP 플래그와 같은 JSON 바이트를 만든다', async () => {
    const { token, json, expSec } = await signToken({
      secret: SECRET,
      mbId: 'owner01',
      nick: '주인',
      chName: '세바스찬/집사',
      level: 10,
      nowMs: NOW,
    })
    expect(json).toBe(
      `{"mb_id":"owner01","nick":"주인","ch_name":"세바스찬/집사","level":10,"exp":${VECTOR_EXP_SEC}}`,
    )
    expect(expSec).toBe(VECTOR_EXP_SEC)
    const result = await verifyToken(token, {
      secret: SECRET,
      minLevel: VECTOR_MIN_LEVEL,
      nowMs: NOW,
    })
    expect(result).toMatchObject({
      ok: true,
      value: { mbId: 'owner01', level: 10, displayName: '세바스찬/집사' },
    })
  })

  it('V1 입력을 테스트 SECRET 으로 발급하면 V1 토큰과 같다', async () => {
    const { token } = await signToken({
      secret: VECTOR_SECRET,
      mbId: 'tester01',
      nick: '테스터',
      chName: '시엘 팬텀하이브',
      level: 5,
      nowMs: VECTOR_EXP_SEC * 1000 - 12 * 3600 * 1000,
    })
    expect(token).toBe(TOKEN_VECTORS.V1)
  })
})

describe('verifyTokenCli', () => {
  const issue = (level: number) =>
    signToken({ secret: SECRET, mbId: 'u1', level, nowMs: NOW }).then(r => r.token)

  it('정상 토큰은 ok 와 mb_id·level·exp 를 돌려준다', async () => {
    const report = await verifyTokenCli({ secret: SECRET, token: await issue(7), nowMs: NOW })
    expect(report).toEqual({ ok: true, mbId: 'u1', level: 7, expIso: '2026-01-01T12:00:00.000Z' })
    expect(formatVerify(report)[0]).toBe('ok')
  })

  it('만료·등급 미달·잘못된 서명을 분류한다', async () => {
    const token = await issue(7)
    const expired = await verifyTokenCli({ secret: SECRET, token, nowMs: VECTOR_EXP_SEC * 1000 })
    expect(expired).toMatchObject({
      ok: false,
      failure: { code: 'TOKEN_INVALID', reason: 'expired' },
      mbId: 'u1',
    })

    const low = await verifyTokenCli({ secret: SECRET, token: await issue(3), nowMs: NOW })
    expect(low).toMatchObject({
      ok: false,
      failure: { code: 'LEVEL_TOO_LOW', reason: 'level' },
      level: 3,
    })

    const wrong = await verifyTokenCli({
      secret: 'another-secret-another-secret-0000',
      token,
      nowMs: NOW,
    })
    expect(wrong).toEqual({ ok: false, failure: { code: 'TOKEN_INVALID', reason: 'signature' } })
  })

  it('형식이 깨지면 format 이고 payload 를 노출하지 않는다', async () => {
    const report = await verifyTokenCli({ secret: SECRET, token: 'abc', nowMs: NOW })
    expect(report).toEqual({ ok: false, failure: { code: 'TOKEN_INVALID', reason: 'format' } })
  })

  it('--min-level 을 반영한다', async () => {
    const report = await verifyTokenCli({
      secret: SECRET,
      token: await issue(7),
      minLevel: 8,
      nowMs: NOW,
    })
    expect(report).toMatchObject({ ok: false, failure: { code: 'LEVEL_TOO_LOW' } })
  })
})
