/**
 * [목적] 갠홈 발급 토큰 검증(R-AUTH-001·002·004). 서명 → exp → level 순서, 서명 전에는 JSON 을 해석하지 않는다. 설계 auth.md §2.1~§2.3
 * [공개 API] verifyToken(raw, opts) -> Promise<VerifyResult>, TOKEN_MAX_LENGTH, 타입 Principal·AuthFailReason·AuthFailure·VerifyResult·VerifyTokenOptions
 * [비동기] crypto.subtle importKey·sign 만 await. throw 하지 않고 Result 로 돌려준다
 * [에러] AuthFailure{ code: TOKEN_INVALID | LEVEL_TOO_LOW, reason: format | signature | payload | expired | level }
 * [설정] secret·minLevel·nowMs 를 인자로 받는다(바인딩을 읽지 않는다)
 * [테스트] server/test/auth.test.ts (SRV-T-100~108, 교차 벡터 V1~V8)
 */
import { z } from 'zod'
import { decodeBase64Url } from './base64url'

/** 검증을 통과한 쓰기 주체 (R-AUTH-004). 토큰 원문·exp 는 싣지 않는다 */
export type Principal = {
  readonly mbId: string
  readonly nick: string
  /** trim 후 비어 있으면 null */
  readonly chName: string | null
  readonly level: number
  /** chName ?? nick (R-AUTH-004). messages.author_name 에 기록 */
  readonly displayName: string
}

export type AuthFailReason = 'format' | 'signature' | 'payload' | 'expired' | 'level'
export type AuthFailure = {
  readonly code: 'TOKEN_INVALID' | 'LEVEL_TOO_LOW'
  /** 로그용 분류. 응답에는 싣지 않는다 */
  readonly reason: AuthFailReason
}
export type VerifyResult =
  | { readonly ok: true; readonly value: Principal }
  | { readonly ok: false; readonly error: AuthFailure }

export type VerifyTokenOptions = {
  readonly secret: string
  readonly minLevel: number
  /** 현재 시각 epoch ms */
  readonly nowMs: number
}

/** 토큰 원문 상한(문자). 넘으면 format 실패 */
export const TOKEN_MAX_LENGTH = 4096

const SIGNATURE_BYTES = 32
const LEVEL_MIN = 1
const LEVEL_MAX = 10
const MS_PER_SEC = 1000

const payloadSchema = z.object({
  mb_id: z.string().min(1),
  nick: z.string().refine(s => s.trim().length > 0),
  ch_name: z.string().nullable(),
  level: z.number().int().min(LEVEL_MIN).max(LEVEL_MAX),
  exp: z.number().int().min(1),
})

type TokenPayload = z.infer<typeof payloadSchema>

const fail = (code: AuthFailure['code'], reason: AuthFailReason): VerifyResult => ({
  ok: false,
  error: { code, reason },
})

const invalid = (reason: AuthFailReason): VerifyResult => fail('TOKEN_INVALID', reason)

/** payload 로 Principal 생성 (auth.md §2.3) */
const toPrincipal = (p: TokenPayload): Principal => {
  const nick = p.nick.trim()
  const chTrimmed = p.ch_name === null ? '' : p.ch_name.trim()
  const chName = chTrimmed === '' ? null : chTrimmed
  return { mbId: p.mb_id, nick, chName, level: p.level, displayName: chName ?? nick }
}

/** `a.b` 두 조각을 디코드한다. 형식 위반이면 null (단계 1·2) */
const splitToken = (raw: string): { data: Uint8Array; signature: Uint8Array } | null => {
  if (raw.length < 1 || raw.length > TOKEN_MAX_LENGTH) return null
  const parts = raw.split('.')
  if (parts.length !== 2) return null
  const [seg1, seg2] = parts
  if (!seg1 || !seg2) return null
  const data = decodeBase64Url(seg1)
  const signature = decodeBase64Url(seg2)
  if (data === null || signature === null || signature.length !== SIGNATURE_BYTES) return null
  return { data, signature }
}

/** HMAC-SHA256 서명을 계산해 상수 시간으로 비교한다 (단계 3) */
const signatureMatches = async (
  secret: string,
  data: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, data))
  return crypto.subtle.timingSafeEqual(expected, signature)
}

/** 서명이 맞은 바이트를 payload 로 해석한다. 실패 시 null (단계 4) */
const parsePayload = (data: Uint8Array): TokenPayload | null => {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data)
    const parsed = payloadSchema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** 순수 검증(시각 주입). throw 하지 않고 Result 로 돌려준다 */
export const verifyToken = async (raw: string, opts: VerifyTokenOptions): Promise<VerifyResult> => {
  const parts = splitToken(raw)
  if (parts === null) return invalid('format')
  if (!(await signatureMatches(opts.secret, parts.data, parts.signature))) {
    return invalid('signature')
  }
  const payload = parsePayload(parts.data)
  if (payload === null) return invalid('payload')
  if (opts.nowMs >= payload.exp * MS_PER_SEC) return invalid('expired')
  if (payload.level < opts.minLevel) return fail('LEVEL_TOO_LOW', 'level')
  return { ok: true, value: toPrincipal(payload) }
}
