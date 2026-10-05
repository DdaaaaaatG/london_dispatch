/**
 * [목적] routes(contract)가 쓰기 라우트에 붙이는 Hono 미들웨어. 라우트 단위 적용, 전역 등록 금지 (R-AUTH-003·005, R-API-003). 설계 auth.md §2.4·§9.1
 * [공개 API] readBearer(header), requireToken, rateLimitWrites, getPrincipal(c)
 * [비동기] requireToken → services.auth.authenticate, rateLimitWrites → services.auth.hitRateLimit
 * [에러] AppError TOKEN_REQUIRED(401)·TOKEN_INVALID(401)·LEVEL_TOO_LOW(403)·RATE_LIMITED(429)
 * [설정] 없음. 설정은 services.auth 가 값으로 갖고 있다
 * [테스트] server/test/auth.test.ts (SRV-T-109·116~119)
 */
import type { Context, MiddlewareHandler } from 'hono'
import { AppError } from '../app-error'
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

/** getPrincipal(c).mbId 로 services.auth.hitRateLimit → next(). requireToken 뒤에만 */
export const rateLimitWrites: MiddlewareHandler<AppEnv> = async (c, next) => {
  await c.get('services').auth.hitRateLimit(getPrincipal(c).mbId)
  await next()
}
