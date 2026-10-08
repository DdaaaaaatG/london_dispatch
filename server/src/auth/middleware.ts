/**
 * [목적] routes(contract)가 쓰기 라우트에 붙이는 Hono 미들웨어. 라우트 단위 적용, 전역 등록 금지 (R-AUTH-003·005, R-API-003). 설계 auth.md §2.4·§9.1
 * [공개 API] readBearer(header), requireToken, optionalToken(S6), rateLimitWrites, requireOwner(S3c), getPrincipal(c)
 * [비동기] requireToken → services.auth.authenticate, rateLimitWrites → services.auth.hitRateLimit
 * [에러] AppError TOKEN_REQUIRED(401)·TOKEN_INVALID(401)·LEVEL_TOO_LOW(403)·RATE_LIMITED(429), OWNER_ONLY(403, S3c). optionalToken 은 앞 세 코드를 삼키고 그 밖은 전파
 * [설정] 없음. 설정은 services.auth 가 값으로 갖고 있다
 * [테스트] server/test/auth.test.ts (SRV-T-109·116~119), server/test/auth-owner.test.ts (SRV-T-237·238), server/test/auth-room-entry.test.ts (SRV-T-390)
 */
import type { Context, MiddlewareHandler } from 'hono'
import { AppError } from '../app-error'
import type { ErrorCode } from '@shared/errors'
import type { AppEnv } from '../services'
import type { Principal } from './token'

const BEARER_PATTERN = /^Bearer[ \t]+(.+)$/i

/** Authorization 헤더 값에서 Bearer 토큰을 꺼낸다. 꺼낼 수 없으면 null (auth.md §2.4) */
export const readBearer = (header: string | undefined): string | null => {
  if (header === undefined) return null
  const token = BEARER_PATTERN.exec(header.trim())?.[1]?.trim()
  return token === undefined || token === '' ? null : token
}

/** requireToken 이 넣은 Principal. 없으면 AppError TOKEN_REQUIRED — 미들웨어 누락 시 닫힌 쪽으로 실패 */
export const getPrincipal = (c: Context<AppEnv>): Principal => {
  const principal = c.get('principal')
  if (principal === undefined) throw new AppError('TOKEN_REQUIRED')
  return principal
}

/** Bearer 추출 → services.auth.authenticate → c.set('principal', …) → next() */
export const requireToken: MiddlewareHandler<AppEnv> = async (c, next) => {
  const raw = readBearer(c.req.header('Authorization'))
  if (raw === null) throw new AppError('TOKEN_REQUIRED')
  c.set('principal', await c.get('services').auth.authenticate(raw))
  await next()
}

/** S6. optionalToken 이 삼키는 인증 실패 코드 3종. 그 밖(INTERNAL·D1 장애 등)은 전파한다 */
const SWALLOWED_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'TOKEN_REQUIRED',
  'TOKEN_INVALID',
  'LEVEL_TOO_LOW',
])

/** S6(E17 전용). Bearer 가 있으면 authenticate 해 principal 을 넣고, 인증 실패 3코드는 삼켜 익명으로 next(). next() 는 try 밖 — 뒤 단계 에러는 삼키지 않는다 */
export const optionalToken: MiddlewareHandler<AppEnv> = async (c, next) => {
  const raw = readBearer(c.req.header('Authorization'))
  if (raw !== null) {
    try {
      c.set('principal', await c.get('services').auth.authenticate(raw))
    } catch (e) {
      if (!(e instanceof AppError && SWALLOWED_CODES.has(e.code))) throw e
    }
  }
  await next()
}

/** S3c. requireToken 뒤에만. getPrincipal(c) → services.auth.assertOwner → next(). principal 없으면 TOKEN_REQUIRED(닫힌 쪽) */
export const requireOwner: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.get('services').auth.assertOwner(getPrincipal(c))
  await next()
}

/** getPrincipal(c).mbId 로 services.auth.hitRateLimit → next(). requireToken 뒤에만 */
export const rateLimitWrites: MiddlewareHandler<AppEnv> = async (c, next) => {
  await c.get('services').auth.hitRateLimit(getPrincipal(c).mbId)
  await next()
}
