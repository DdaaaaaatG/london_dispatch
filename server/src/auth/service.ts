/**
 * [목적] 토큰 인증과 쓰기 레이트리밋 서비스(R-AUTH-002·005, R-NFR-003). 실패 사유는 reason 분류만 로그에 남긴다. 설계 auth.md §2.5·§4·§5
 * [공개 API] createAuthService(deps) -> AuthService { authenticate, hitRateLimit, isOwner(S3c), assertOwner(S3c), hitEnterLimit(S6) }, ENTER_LIMIT_KEY_PREFIX·ROOM_ENTER_LIMITED_MESSAGE(S6), 타입 AuthDeps·AuthService
 * [비동기] authenticate 는 Web Crypto await, hitRateLimit 는 D1 조건부 UPSERT 1회(+ 새 창 첫 요청에서 purge 1회)
 * [에러] AppError TOKEN_INVALID(401)·LEVEL_TOO_LOW(403)·RATE_LIMITED(429, retryAfterSec). D1 장애는 전파(INTERNAL). purge 실패는 무시. S3c assertOwner: OWNER_ONLY(403). S6 hitEnterLimit: RATE_LIMITED(429, 상황 문구·retryAfterSec)
 * [설정] config.tokenSecret(클로저에만 보관), tokenMinLevel, rateLimitPerMin, ownerMbIds(S3c, 선택·기본 [] = 닫힘), roomEnterLimitPerMin(S6, 선택·기본 ROOM_ENTER_LIMIT_PER_MIN_DEFAULT) — parseEnv 결과를 값으로 받는다
 * [테스트] server/test/auth.test.ts (SRV-T-111~115·120), server/test/auth-owner.test.ts (SRV-T-236~238), server/test/auth-room-entry.test.ts (SRV-T-393·394)
 */
import { AppError } from '../app-error'
import type { Db } from '../db'
import { ROOM_ENTER_LIMIT_PER_MIN_DEFAULT, type Config } from '../env'
import type { Logger } from '../logger'
import { retryAfterSecOf, windowStartOf } from './rate-limit'
import { verifyToken, type Principal } from './token'

export type AuthService = {
  /** 토큰을 검증해 Principal. 실패 시 AppError TOKEN_INVALID(401) / LEVEL_TOO_LOW(403) */
  authenticate: (raw: string) => Promise<Principal>
  /** mbId 의 현재 분 창에 쓰기 1회를 기록. 한도 초과면 AppError RATE_LIMITED(429, retryAfterSec) */
  hitRateLimit: (mbId: string) => Promise<void>
  /** S3c. principal.mbId ∈ ownerMbIds(대소문자 구분 정확 일치). 목록이 비면 항상 false. 부수 효과 없음 */
  isOwner: (principal: Principal) => boolean
  /** S3c. isOwner 가 false 면 info 'owner_denied'{mbId} 후 AppError OWNER_ONLY(403) */
  assertOwner: (principal: Principal) => void
  /** S6. rate_limits 키 'enter:{roomId}' 의 현재 분 창에 1회 기록. 한도 초과면 warn 'room_enter_limited'{roomId} 후 AppError RATE_LIMITED(상황 문구, retryAfterSec) */
  hitEnterLimit: (roomId: string) => Promise<void>
}

export type AuthDeps = {
  db: Db
  logger: Logger
  now: () => number
  config: Pick<Config, 'tokenSecret' | 'tokenMinLevel' | 'rateLimitPerMin'> &
    /** S3c. 없으면 [](닫힌 쪽 — 아무도 주인 아님). 컨테이너는 항상 넘긴다 */
    /** S6. 없으면 ROOM_ENTER_LIMIT_PER_MIN_DEFAULT(5). 컨테이너는 항상 넘긴다 */
    Partial<Pick<Config, 'ownerMbIds' | 'roomEnterLimitPerMin'>>
}

/** S6. 입장 시도 버킷 키 접두사. 그누보드 mb_id 에는 ':' 가 없어 회원 버킷과 겹치지 않는다(서버의 mb_id 검증은 min(1)뿐이라 이 전제는 갠홈 규칙에 기댄다) */
export const ENTER_LIMIT_KEY_PREFIX = 'enter:'
/** S6. 방 단위 입장 상한 초과 문구(응답에 그대로 나간다) */
export const ROOM_ENTER_LIMITED_MESSAGE =
  '비밀번호를 너무 자주 입력했습니다. 잠시 후 다시 시도해 주세요.'

const FIRST_HIT_COUNT = 1

/** 인증·레이트리밋 서비스를 만든다. SECRET 은 클로저 안에만 있다 */
export const createAuthService = (deps: AuthDeps): AuthService => {
  const { db, logger, now } = deps
  const { tokenSecret, tokenMinLevel, rateLimitPerMin } = deps.config
  const ownerMbIds: readonly string[] = deps.config.ownerMbIds ?? []
  const roomEnterLimitPerMin = deps.config.roomEnterLimitPerMin ?? ROOM_ENTER_LIMIT_PER_MIN_DEFAULT
  const isOwner = (principal: Principal): boolean => ownerMbIds.includes(principal.mbId)

  const purgeOldWindows = async (windowStart: number): Promise<void> => {
    try {
      await db.rateLimits.purgeBefore(windowStart)
    } catch (e) {
      logger.warn('rate_limit_purge_failed', { errName: e instanceof Error ? e.name : 'unknown' })
    }
  }

  return {
    isOwner,
    assertOwner: principal => {
      if (isOwner(principal)) return
      logger.info('owner_denied', { mbId: principal.mbId })
      throw new AppError('OWNER_ONLY')
    },
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
    hitEnterLimit: async roomId => {
      const nowMs = now()
      const windowStart = windowStartOf(nowMs)
      const key = `${ENTER_LIMIT_KEY_PREFIX}${roomId}`
      const count = await db.rateLimits.hit(key, windowStart, roomEnterLimitPerMin)
      if (count === null) {
        logger.warn('room_enter_limited', { roomId })
        throw new AppError('RATE_LIMITED', ROOM_ENTER_LIMITED_MESSAGE, {
          retryAfterSec: retryAfterSecOf(nowMs),
        })
      }
      if (count === FIRST_HIT_COUNT) await purgeOldWindows(windowStart)
    },
  }
}
