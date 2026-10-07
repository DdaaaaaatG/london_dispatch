/**
 * [목적] 로컬 개발 도구의 핵심 함수. ① 테스트 토큰 발급 ② 서버 검증 함수로 토큰 확인 ③ 교차 벡터(auth.md §2.6 V1~V8) 출력.
 *        갠홈 PHP 조각이 만든 토큰이 서버 검증과 일치하는지 대조하는 용도(R-TOKEN-001 🔒, R-AUTH-001·002 🔒).
 * [공개 API] signToken(input), verifyTokenCli(input), formatVerify(report), renderVectors(secret), TOKEN_TEST_DEFAULTS, SECRET_MIN_LENGTH
 * [비동기] crypto.subtle HMAC 만 await. Node·workerd 양쪽에서 돈다(Node 전용 API 없음)
 * [에러] verifyTokenCli 는 throw 하지 않고 서버 verifyToken 의 AuthFailure 를 report 로 돌려준다
 * [설정] 인자로만 받는다. SECRET 은 어떤 출력(stdout·stderr·반환 문자열)에도 싣지 않는다(R-AUTH-006 🔒)
 * [테스트] server/test/token-test-script.test.ts
 * [주의] 사용자가 명시 호출하는 로컬 도구다. 토큰 stdout 출력은 허용, SECRET 출력은 금지. 운영 SECRET 은 쓰지 않는다.
 *        JSON 바이트는 PHP json_encode(JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)와 같게 만든다(auth.md §9.3).
 */
import { encodeBase64Url } from '../src/auth/base64url'
import { verifyToken } from '../src/auth/token'
import type { AuthFailure } from '../src/auth/token'

/** CLI 기본값 */
export const TOKEN_TEST_DEFAULTS = { level: 5, hours: 12, minLevel: 5 } as const

/** SECRET 최소 길이(서버 parseEnv 가 이보다 짧으면 거부한다) */
export const SECRET_MIN_LENGTH = 32

const SECONDS_PER_HOUR = 3600
const MS_PER_SEC = 1000
const WRONG_SECRET = 'wrong-secret'
/** auth.md §2.6 공통 시각 2026-01-01T00:00:00Z 와 exp(+12h) */
const VECTOR_NOW_MS = 1_767_225_600_000
const VECTOR_EXP_SEC = 1_767_268_800

export type SignInput = {
  readonly secret: string
  readonly mbId: string
  readonly nick?: string
  readonly chName?: string
  readonly level?: number
  readonly hours?: number
  /** 현재 시각 epoch ms (기본 Date.now) */
  readonly nowMs?: number
}

export type SignedToken = { readonly token: string; readonly json: string; readonly expSec: number }

type Payload = {
  readonly mb_id: string
  readonly nick: string
  readonly ch_name: string
  readonly level: number
  readonly exp: number
}

const encoder = new TextEncoder()

/** PHP 는 JSON_UNESCAPED_UNICODE 만으로는 U+2028·2029 를 이스케이프하므로 그 점까지 맞춘 직렬화 */
const phpUnescapedJson = (payload: Payload): string =>
  JSON.stringify(payload).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')

/** PHP 기본 json_encode: 비 ASCII 는 \uXXXX(소문자 hex, UTF-16 단위), '/' 는 '\/' */
const phpDefaultJson = (payload: Payload): string =>
  JSON.stringify(payload)
    .replaceAll('/', '\\/')
    .replace(/[^\x20-\x7e]/g, ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)

const hmac = async (secret: string, data: Uint8Array): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data))
}

const signJson = async (json: string, secret: string): Promise<string> => {
  const data = encoder.encode(json)
  return `${encodeBase64Url(data)}.${encodeBase64Url(await hmac(secret, data))}`
}

/** 토큰 1개를 발급한다. exp = now + hours (epoch 초) */
export const signToken = async (input: SignInput): Promise<SignedToken> => {
  const { secret, mbId, nick = mbId, chName = '', level = TOKEN_TEST_DEFAULTS.level } = input
  const hours = input.hours ?? TOKEN_TEST_DEFAULTS.hours
  const nowMs = input.nowMs ?? Date.now()
  const expSec = Math.floor(nowMs / MS_PER_SEC) + Math.round(hours * SECONDS_PER_HOUR)
  const json = phpUnescapedJson({ mb_id: mbId, nick, ch_name: chName, level, exp: expSec })
  return { token: await signJson(json, secret), json, expSec }
}

export type VerifyInput = {
  readonly secret: string
  readonly token: string
  readonly minLevel?: number
  readonly nowMs?: number
}

export type VerifyReport =
  | { readonly ok: true; readonly mbId: string; readonly level: number; readonly expIso: string }
  | {
      readonly ok: false
      readonly failure: AuthFailure
      /** 서명이 맞은 경우(expired·level)에만 채운다 */
      readonly mbId?: string
      readonly level?: number
      readonly expIso?: string
    }

type Claims = { mbId?: string; level?: number; expIso?: string }

/** 서명이 통과한 뒤에만 호출: payload 에서 표시용 값을 뽑는다 */
const readClaims = (token: string): Claims => {
  try {
    const seg1 = token.split('.')[0] ?? ''
    const bytes = Uint8Array.from(atob(seg1.replaceAll('-', '+').replaceAll('_', '/')), c =>
      c.charCodeAt(0),
    )
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof parsed !== 'object' || parsed === null) return {}
    const { mb_id: mbId, level, exp } = parsed as Record<string, unknown>
    return {
      ...(typeof mbId === 'string' ? { mbId } : {}),
      ...(typeof level === 'number' ? { level } : {}),
      ...(typeof exp === 'number' ? { expIso: new Date(exp * MS_PER_SEC).toISOString() } : {}),
    }
  } catch {
    return {}
  }
}

/** 서버 verifyToken 으로 토큰을 검증하고 표시용 report 를 만든다 */
export const verifyTokenCli = async (input: VerifyInput): Promise<VerifyReport> => {
  const { secret, token } = input
  const minLevel = input.minLevel ?? TOKEN_TEST_DEFAULTS.minLevel
  const nowMs = input.nowMs ?? Date.now()
  const result = await verifyToken(token, { secret, minLevel, nowMs })
  if (result.ok) {
    return {
      ok: true,
      mbId: result.value.mbId,
      level: result.value.level,
      expIso: readClaims(token).expIso ?? '',
    }
  }
  const signed = result.error.reason === 'expired' || result.error.reason === 'level'
  return { ok: false, failure: result.error, ...(signed ? readClaims(token) : {}) }
}

/** report 를 사람이 읽는 줄들로 */
export const formatVerify = (report: VerifyReport): string[] => {
  const lines = [report.ok ? 'ok' : `실패 ${report.failure.code} (${report.failure.reason})`]
  if (report.mbId !== undefined) lines.push(`mb_id: ${report.mbId}`)
  if (report.level !== undefined) lines.push(`level: ${report.level}`)
  if (report.expIso) lines.push(`exp: ${report.expIso}`)
  return lines
}

export type VectorRow = {
  readonly id: string
  readonly input: string
  readonly token: string
  readonly expect: string
}

const V1_PAYLOAD: Payload = {
  mb_id: 'tester01',
  nick: '테스터',
  ch_name: '시엘 팬텀하이브',
  level: 5,
  exp: VECTOR_EXP_SEC,
}
const V2_PAYLOAD: Payload = {
  mb_id: 'tester02',
  nick: '닉네임',
  ch_name: '',
  level: 10,
  exp: VECTOR_EXP_SEC,
}
const V3_PAYLOAD: Payload = {
  mb_id: 'tester03',
  nick: '하급',
  ch_name: '',
  level: 4,
  exp: VECTOR_EXP_SEC,
}
const V4_PAYLOAD: Payload = {
  mb_id: 'ascii_only',
  nick: 'Tester',
  ch_name: 'Ciel',
  level: 5,
  exp: VECTOR_EXP_SEC,
}

const row = (id: string, input: string, token: string, expect: string): VectorRow => ({
  id,
  input,
  token,
  expect,
})

const jsonRow = async (
  id: string,
  payload: Payload,
  secret: string,
  expect: string,
): Promise<VectorRow> => {
  const json = phpUnescapedJson(payload)
  const bytes = encoder.encode(json).length
  return row(id, `${json} (${bytes}바이트)`, await signJson(json, secret), expect)
}

const replaceAt = (text: string, index: number, to: string): string =>
  `${text.slice(0, index)}${to}${text.slice(index + 1)}`

/** auth.md §2.6 V1~V8 의 입력과 기대 토큰 행. V8 은 V1 토큰을 시각만 바꿔 검증하는 항목이다 */
export const buildVectorRows = async (secret: string): Promise<VectorRow[]> => {
  const v1 = await signJson(phpUnescapedJson(V1_PAYLOAD), secret)
  const seg2Start = v1.indexOf('.') + 1
  const j1 = phpUnescapedJson(V1_PAYLOAD)
  const j7 = phpDefaultJson(V1_PAYLOAD)
  return [
    await jsonRow('V1', V1_PAYLOAD, secret, 'ok'),
    await jsonRow('V2', V2_PAYLOAD, secret, 'ok (chName null, displayName 닉네임)'),
    await jsonRow('V3', V3_PAYLOAD, secret, 'LEVEL_TOO_LOW / level'),
    await jsonRow('V4', V4_PAYLOAD, secret, 'ok'),
    row('V5', 'V1 seg2 첫 글자 E->F', replaceAt(v1, seg2Start, 'F'), 'TOKEN_INVALID / signature'),
    row(
      'V5b',
      'V1 seg2 마지막 글자 4->5',
      replaceAt(v1, v1.length - 1, '5'),
      'TOKEN_INVALID / format',
    ),
    row(
      'V6',
      `${j1} (SECRET=${WRONG_SECRET})`,
      await signJson(j1, WRONG_SECRET),
      'TOKEN_INVALID / signature',
    ),
    row(
      'V7',
      `${j7} (PHP 기본 json_encode)`,
      await signJson(j7, secret),
      'ok (Principal 은 V1 과 같다)',
    ),
    row(
      'V8',
      `V1 을 nowMs=${VECTOR_EXP_SEC * MS_PER_SEC} 에 검증`,
      v1,
      'TOKEN_INVALID / expired (…99999 이면 ok)',
    ),
  ]
}

/** §2.6 벡터 표를 줄 목록으로. SECRET 은 싣지 않는다 */
export const renderVectors = async (secret: string): Promise<string[]> => {
  const rows = await buildVectorRows(secret)
  const lines = [
    `기준 nowMs=${VECTOR_NOW_MS} minLevel=${TOKEN_TEST_DEFAULTS.minLevel} exp=${VECTOR_EXP_SEC}`,
  ]
  for (const r of rows) {
    lines.push('', `${r.id}  기대: ${r.expect}`, `  입력: ${r.input}`, `  토큰: ${r.token}`)
  }
  return lines
}
