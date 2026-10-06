/**
 * [목적] auth 모듈 공개 진입. 갠홈 토큰 검증(Principal 생성)과 mb_id 단위 분당 쓰기 레이트리밋 (R-AUTH-001~006, R-TOKEN-001, R-API-003). 설계 auth.md
 * [공개 API] verifyToken, readBearer, requireToken, rateLimitWrites, requireOwner(S3c), getPrincipal, createAuthService, windowStartOf, retryAfterSecOf, TOKEN_MAX_LENGTH, RATE_WINDOW_MS, 타입 Principal·AuthService·AuthDeps·VerifyResult 등
 * [비동기] HMAC 검증(crypto.subtle)과 D1 UPSERT 만 await. 상태 없음
 * [에러] AppError TOKEN_REQUIRED·TOKEN_INVALID(401), LEVEL_TOO_LOW(403), RATE_LIMITED(429, retryAfterSec), OWNER_ONLY(403, S3c)
 * [설정] config.tokenSecret·tokenMinLevel·rateLimitPerMin (parseEnv 결과를 createServices 가 값으로 전달)
 * [테스트] server/test/auth.test.ts (SRV-T-100~120, 236~238)
 */
export { getPrincipal, rateLimitWrites, readBearer, requireOwner, requireToken } from './middleware'
export { RATE_WINDOW_MS, retryAfterSecOf, windowStartOf } from './rate-limit'
export { createAuthService } from './service'
export type { AuthDeps, AuthService } from './service'
export { TOKEN_MAX_LENGTH, verifyToken } from './token'
export type {
  AuthFailReason,
  AuthFailure,
  Principal,
  VerifyResult,
  VerifyTokenOptions,
} from './token'
