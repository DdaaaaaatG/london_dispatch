/**
 * [목적] auth 모듈 공개 진입. 갠홈 토큰 검증(Principal 생성)과 mb_id 단위 분당 쓰기 레이트리밋 (R-AUTH-001~006, R-TOKEN-001, R-API-003). 설계 auth.md
 * [공개 API] verifyToken, readBearer, requireToken, rateLimitWrites, requireOwner(S3c), optionalToken(S6), isOwnerRequest(S6), requireRoomEntry(S6), getPrincipal, createAuthService, windowStartOf, retryAfterSecOf, TOKEN_MAX_LENGTH, RATE_WINDOW_MS, 타입 Principal·AuthService·AuthDeps·VerifyResult 등
 * [비동기] HMAC 검증(crypto.subtle)과 D1 UPSERT 만 await. 상태 없음
 * [에러] AppError TOKEN_REQUIRED·TOKEN_INVALID(401), LEVEL_TOO_LOW(403), RATE_LIMITED(429, retryAfterSec), OWNER_ONLY(403, S3c), ROOM_LOCKED(403, S6 관문 — rooms 가 던짐), RATE_LIMITED(S6 입장 상한)
 * [설정] config.tokenSecret(32자 이상은 parseEnv 가 보장)·tokenMinLevel·rateLimitPerMin·ownerMbIds(S3c, 선택·기본 [] = 설정 엔드포인트 전원 403)·roomEnterLimitPerMin(S6, 선택·기본 5) (parseEnv 결과를 createServices 가 값으로 전달)
 * [테스트] server/test/auth.test.ts (SRV-T-100~120, 236~238), server/test/auth-room-entry.test.ts (SRV-T-390~394)
 */
export {
  getPrincipal,
  optionalToken,
  rateLimitWrites,
  readBearer,
  requireOwner,
  requireToken,
} from './middleware'
export { isOwnerRequest, requireRoomEntry } from './room-entry'
export { RATE_WINDOW_MS, retryAfterSecOf, windowStartOf } from './rate-limit'
export { createAuthService, ENTER_LIMIT_KEY_PREFIX, ROOM_ENTER_LIMITED_MESSAGE } from './service'
export type { AuthDeps, AuthService } from './service'
export { TOKEN_MAX_LENGTH, verifyToken } from './token'
export type {
  AuthFailReason,
  AuthFailure,
  Principal,
  VerifyResult,
  VerifyTokenOptions,
} from './token'
