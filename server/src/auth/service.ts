/**
 * [목적] 토큰 인증과 쓰기 레이트리밋 서비스(R-AUTH-002·005, R-NFR-003). 실패 사유는 reason 분류만 로그에 남긴다. 설계 auth.md §2.5·§4·§5
 * [공개 API] createAuthService(deps) -> AuthService { authenticate, hitRateLimit }, 타입 AuthDeps·AuthService
 * [비동기] authenticate 는 Web Crypto await, hitRateLimit 는 D1 조건부 UPSERT 1회(+ 새 창 첫 요청에서 purge 1회)
 * [에러] AppError TOKEN_INVALID(401)·LEVEL_TOO_LOW(403)·RATE_LIMITED(429, retryAfterSec). D1 장애는 전파(INTERNAL). purge 실패는 무시
 * [설정] config.tokenSecret(클로저에만 보관), tokenMinLevel, rateLimitPerMin — parseEnv 결과를 값으로 받는다
 * [테스트] server/test/auth.test.ts (SRV-T-111~115·120)
 */
import { AppError } from '../app-error'
import type { Db } from '../db'
import type { Config } from '../env'
import type { Logger } from '../logger'
import { retryAfterSecOf, windowStartOf } from './rate-limit'
import { verifyToken, type Principal } from './token'

export type AuthService = {
  /** 토큰을 검증해 Principal. 실패 시 AppError TOKEN_INVALID(401) / LEVEL_TOO_LOW(403) */
  authenticate: (raw: string) => Promise<Principal>
  /** mbId 의 현재 분 창에 쓰기 1회를 기록. 한도 초과면 AppError RATE_LIMITED(429, retryAfterSec) */
  hitRateLimit: (mbId: string) => Promise<void>
}

export type AuthDeps = {
  db: Db
  logger: Logger
  now: () => number
  config: Pick<Config, 'tokenSecret' | 'tokenMinLevel' | 'rateLimitPerMin'>
}

const FIRST_HIT_COUNT = 1

/** 인증·레이트리밋 서비스를 만든다. SECRET 은 클로저 안에만 있다 */
export const createAuthService = (deps: AuthDeps): AuthService => {
  const { db, logger, now } = deps
  const { tokenSecret, tokenMinLevel, rateLimitPerMin } = deps.config

  const purgeOldWindows = async (windowStart: number): Promise<void> => {
    try {
      await db.rateLimits.purgeBefore(windowStart)
    } catch (e) {
      logger.warn('rate_limit_purge_failed', { errName: e instanceof Error ? e.name : 'unknown' })
    }
  }

  return {
    authenticate: async raw => {
      const result = await verifyToken(raw, {
        secret: tokenSecret,
        minLevel: tokenMinLevel,
        nowMs: now(),
      })
      if (result.ok) return result.value
      logger.warn('auth_rejected', { code: result.error.code, reason: result.error.reason })
      throw new AppError(result.error.code)
    },
    hitRateLimit: async mbId => {
      const nowMs = now()
      const windowStart = windowStartOf(nowMs)
      const count = await db.rateLimits.hit(mbId, windowStart, rateLimitPerMin)
      if (count === null) {
        logger.warn('rate_limited', { mbId })
        throw new AppError('RATE_LIMITED', undefined, { retryAfterSec: retryAfterSecOf(nowMs) })
      }
      if (count === FIRST_HIT_COUNT) await purgeOldWindows(windowStart)
    },
  }
}
