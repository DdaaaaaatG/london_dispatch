# auth 모듈 설계

- 상태: 초안 · S3c 구현 완료(§12 주인 판정) · **S3d 구현 완료(2026-10-06, SRV-T-261~278 · §13 displayName 저장 전용)** · verify 후속 동기화(2026-10-07 — §6 `tokenSecret` 32자·시험 SECRET, §12.4 `ownerMbIds` [설정]) · 최종 갱신: 2026-10-07
- 묶음: S2(토큰 + 쓰기). 이 문서의 공개 API는 전부 S2에서 구현한다.
- 관련 문서: [env.md](env.md)(`tokenSecret`·`tokenMinLevel`·`rateLimitPerMin`), [db.md](db.md)(`rateLimits` 저장소), [index.md](index.md)(서비스 컨테이너·`AppEnv.Variables.principal`·onError의 `retryAfterSec`), [rooms.md](rooms.md)·[messages.md](messages.md)(쓰기 서비스 — 이 모듈의 미들웨어 뒤에서 호출된다).

## 1. 목적

토큰은 갠홈이 써 준 출입증이다. 서버는 도장(서명)이 진짜인지, 유효기간이 지났는지, 출입 등급이 되는지만 본다. 회원 명부는 갠홈이 갖고 있다. 출입증을 보여 준 사람이 1분에 너무 자주 드나들면 잠시 문을 닫는다(레이트리밋).

auth 모듈은 쓰기 요청의 `Authorization: Bearer <t>`를 검증해 `Principal`(누가 쓰는가)을 만들고, `mb_id` 단위 분당 쓰기 횟수를 D1로 센다. 라우트(contract)는 이 모듈의 Hono 미들웨어만 붙이고 토큰을 직접 다루지 않는다.

| 요구ID | 내용 |
|---|---|
| R-AUTH-001 🔒 | 형식 `base64url(payload).base64url(HMAC-SHA256(payload, SECRET))`, payload `{ mb_id, nick, ch_name, level, exp(초) }`. 교차 테스트 벡터 1건 이상 |
| R-AUTH-002 🔒 | 서명(Web Crypto, 상수시간 비교) → `exp` → `level >= TOKEN_MIN_LEVEL`. 형식·서명·만료 `401 TOKEN_INVALID`, 등급 `403 LEVEL_TOO_LOW` |
| R-AUTH-003 🔒 | 읽기 허용, 쓰기는 토큰 없으면 `401 TOKEN_REQUIRED`. `Authorization: Bearer`만(쿠키·쿼리 금지) |
| R-AUTH-004 (확인 필요 §9-2) | 표시 이름 = `ch_name`이 비어 있지 않으면 `ch_name`, 아니면 `nick` |
| R-AUTH-005 (확인 필요 §9-6) | `mb_id` 분 창당 `RATE_LIMIT_PER_MIN`회, `window_start = floor(now/60000)*60000`, D1 조건부 UPSERT, 초과 `429 RATE_LIMITED` + `retryAfterSec`, 오래된 창 삭제 |
| R-AUTH-006 🔒 | 로그·응답에 토큰 원문·payload 전체·SECRET 금지. 식별은 `mb_id`만 |
| R-TOKEN-001 🔒 (server 몫) | PHP 조각이 만든 토큰과 서버 검증이 같은 벡터로 일치(§2.6) |
| R-API-003 🔒 (server 몫) | Bearer 헤더 추출(§2.4). 화면 쪽 보관은 contract·ui |
| R-NFR-003 🔒 (레이트리밋 몫) | 초과 429. 동시 요청에도 한도를 넘지 않음 |
| R-NFR-004 🔒 · R-NFR-005 | 비밀값 미노출, 요청당 CPU 10ms 안 |

## 2. 공개 API

```ts
// server/src/auth/index.ts — 공개 진입(아래 파일들의 재노출)
import type { Context, MiddlewareHandler } from 'hono'
import type { Db } from '../db'
import type { Config } from '../env'
import type { Logger } from '../logger'
import type { AppEnv } from '../services'

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
/** 레이트리밋 창 길이 */
export const RATE_WINDOW_MS = 60_000

/** 순수 검증(시각 주입). Web Crypto 라 async. throw 하지 않고 Result 로 돌려준다 */
export const verifyToken = (raw: string, opts: VerifyTokenOptions): Promise<VerifyResult>

/** Authorization 헤더 값에서 Bearer 토큰을 꺼낸다. 꺼낼 수 없으면 null (§2.4) */
export const readBearer = (header: string | undefined): string | null

/** 분 창 시작 epoch ms = floor(nowMs / 60000) * 60000 */
export const windowStartOf = (nowMs: number): number
/** 다음 창 시작까지 남은 초. 올림, 최소 1 */
export const retryAfterSecOf = (nowMs: number): number

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

export const createAuthService = (deps: AuthDeps): AuthService

// server/src/auth/middleware.ts — routes(contract)가 쓰기 라우트에 붙이는 미들웨어
/** Bearer 추출 → services.auth.authenticate → c.set('principal', …) → next() */
export const requireToken: MiddlewareHandler<AppEnv>
/** getPrincipal(c).mbId 로 services.auth.hitRateLimit → next(). requireToken 뒤에만 */
export const rateLimitWrites: MiddlewareHandler<AppEnv>
/** requireToken 이 넣은 Principal. 없으면 AppError TOKEN_REQUIRED(401) — 미들웨어 누락 시 닫힌 쪽으로 실패 */
export const getPrincipal = (c: Context<AppEnv>): Principal
```

| 이름 | 인자 | 반환 | 실패 조건(에러 코드) | 요구ID |
|---|---|---|---|---|
| `verifyToken` | `raw, { secret, minLevel, nowMs }` | `Promise<VerifyResult>` | throw 없음. `error.code`: 형식·서명·payload·만료 → `TOKEN_INVALID`, 등급 → `LEVEL_TOO_LOW` | R-AUTH-001·002·004 |
| `readBearer` | `header?: string` | `string \| null` | — | R-AUTH-003 · R-API-003 |
| `windowStartOf` / `retryAfterSecOf` | `nowMs` | `number` | — | R-AUTH-005 |
| `createAuthService` | `AuthDeps` | `AuthService` | — | R-AUTH-002·005 |
| `authenticate` | `raw` | `Promise<Principal>` | `TOKEN_INVALID`(401), `LEVEL_TOO_LOW`(403) | R-AUTH-002 |
| `hitRateLimit` | `mbId` | `Promise<void>` | `RATE_LIMITED`(429, `retryAfterSec`). D1 장애 전파 → `INTERNAL` | R-AUTH-005 · R-NFR-003 |
| `requireToken` | Hono 미들웨어 | — | `TOKEN_REQUIRED`(401), `TOKEN_INVALID`(401), `LEVEL_TOO_LOW`(403) | R-AUTH-003 |
| `rateLimitWrites` | Hono 미들웨어 | — | `RATE_LIMITED`(429), `TOKEN_REQUIRED`(401, requireToken 누락 시) | R-AUTH-005 |
| `getPrincipal` | `c` | `Principal` | `TOKEN_REQUIRED`(401) | R-AUTH-003 |

### 2.1 토큰 형식 (R-AUTH-001 — server 해석)

```
token     = seg1 "." seg2
seg1      = base64url( JSON 바이트 )                       ← PHP json_encode 결과 문자열의 UTF-8 바이트
seg2      = base64url( HMAC-SHA256( key = UTF-8(SECRET), data = JSON 바이트 ) )   ← 32바이트
base64url = RFC 4648 §5 알파벳(A–Z a–z 0–9 - _), 패딩 '=' 없음
```

- **서명 입력은 JSON 바이트**(seg1을 디코드한 바이트)다. seg1 문자열(ASCII)이 아니다(§11 D-AUTH-1). PHP 쪽 기준식:
  `$json = json_encode($payload, FLAGS); $token = b64u($json) . '.' . b64u(hash_hmac('sha256', $json, SECRET, true));`
- 서버는 받은 바이트에 서명하므로 PHP의 `json_encode` 플래그·키 순서가 달라도 검증은 통과한다(§2.6 V7). 다만 교차 벡터의 **바이트 일치**를 위해 contract가 플래그를 하나로 고정한다(§9.3).

payload 스키마(zod, 모르는 키는 버린다):

| 키 | 타입 | 규칙 | 실패 |
|---|---|---|---|
| `mb_id` | string | 길이 1 이상 | `payload` |
| `nick` | string | trim 후 1자 이상 | `payload` |
| `ch_name` | string \| null | 키는 있어야 함. trim 후 빈 문자열이면 `chName = null` | `payload` |
| `level` | number | JSON **정수** 1~10(그누보드 등급 범위). 문자열 `"5"`는 거부 | `payload` |
| `exp` | number | JSON **정수**, 1 이상, epoch **초** | `payload` |

### 2.2 검증 순서 (R-AUTH-002)

| 단계 | 검사 | 실패 code / reason |
|---|---|---|
| 1 | `raw.length` 1~`TOKEN_MAX_LENGTH`, `.`이 정확히 1개, 두 조각 모두 비어 있지 않음 | `TOKEN_INVALID` / `format` |
| 2 | 두 조각이 base64url 알파벳만, 길이 `% 4 !== 1`, 디코드 후 다시 인코드한 문자열이 원문과 같음(비정규 인코딩 거부), seg2 디코드 길이 = 32 | `TOKEN_INVALID` / `format` |
| 3 | `importKey('raw', UTF-8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])` → `sign(seg1 바이트)` → `crypto.subtle.timingSafeEqual(expected, seg2 바이트)` | `TOKEN_INVALID` / `signature` |
| 4 | seg1 바이트를 `TextDecoder('utf-8', { fatal: true })` → `JSON.parse` → payload 스키마 | `TOKEN_INVALID` / `payload` |
| 5 | `nowMs < exp * 1000` (같으면 만료) | `TOKEN_INVALID` / `expired` |
| 6 | `level >= minLevel` | `LEVEL_TOO_LOW` / `level` |
| 7 | `Principal` 생성(§2.3) | — |

- **서명 전에는 JSON을 파싱하지 않는다**(인증되지 않은 입력을 해석하지 않는다). 그래서 서명은 맞지만 payload가 깨진 경우는 4단계에서만 생긴다(우리 PHP 조각의 버그).
- 비교는 길이가 같은 32바이트끼리만 한다(길이는 비밀이 아니다 — 2단계에서 거른다). `timingSafeEqual`은 workerd의 Web Crypto 확장이며 `@cloudflare/workers-types`에 타입이 있다.
- 만료가 등급보다 먼저다. 만료된 저등급 토큰은 `TOKEN_INVALID`다(화면은 새로 고침 안내).

### 2.3 Principal 생성 (R-AUTH-004)

| 필드 | 값 |
|---|---|
| `mbId` | `mb_id` 그대로(trim 안 함 — 레이트리밋 키·`author_mb_id`) |
| `nick` | `nick.trim()` |
| `chName` | `ch_name`이 null이거나 trim 후 빈 문자열이면 `null`, 아니면 trim한 값 |
| `level` | `level` |
| `displayName` | `chName ?? nick` |

### 2.4 Bearer 추출 (R-AUTH-003 · R-API-003)

| `Authorization` 헤더 | `readBearer` | 미들웨어 결과 |
|---|---|---|
| 없음 · 빈 문자열 · 공백뿐 | `null` | `401 TOKEN_REQUIRED` |
| `Bearer` · `Bearer   ` (토큰 자리 비어 있음) | `null` | `401 TOKEN_REQUIRED` |
| `Basic xxx` 등 다른 scheme | `null` | `401 TOKEN_REQUIRED` |
| `Bearer <t>` · `bearer <t>` (scheme 대소문자 무시, 공백 1개 이상) | `<t>`(앞뒤 공백 제거) | `verifyToken` 결과 |

- 규칙 한 줄: **Bearer 토큰을 꺼낼 수 없으면 `TOKEN_REQUIRED`, 꺼냈는데 검증에 실패하면 `TOKEN_INVALID`/`LEVEL_TOO_LOW`.**
- 쿼리 `?t=`·쿠키·본문의 토큰은 **보지 않는다**. 헤더 없이 `?t=<유효 토큰>`으로 쓰기 요청 → `TOKEN_REQUIRED`(SRV-T-116).

### 2.5 레이트리밋 (R-AUTH-005 · R-NFR-003)

```
nowMs       = now()
windowStart = windowStartOf(nowMs)                      // floor(nowMs / 60000) * 60000
count       = await db.rateLimits.hit(mbId, windowStart, rateLimitPerMin)
               └ INSERT … VALUES (mbId, windowStart, 1)
                 ON CONFLICT (mb_id, window_start) DO UPDATE SET count = count + 1 WHERE count < limit
                 RETURNING count                         // 갱신이 막히면 행 없음 → null
count === null → logger.warn('rate_limited', { mbId })
                 throw new AppError('RATE_LIMITED', undefined, { retryAfterSec: retryAfterSecOf(nowMs) })
count === 1    → 이 mbId 의 새 창 첫 요청 = 오래된 창 정리 시점
                 try { await db.rateLimits.purgeBefore(windowStart) }      // 모든 mb_id 의 지난 창 삭제
                 catch (e) { logger.warn('rate_limit_purge_failed', { errName }) }  // 쓰기 요청은 계속
```

- 고정 창(fixed window)이다. 한도 20이면 한 창 안에서 1~20번째는 통과, 21번째부터 429. 창 경계를 걸치면 짧은 시간에 최대 2배까지 통과할 수 있다(§11 D-AUTH-8).
- `retryAfterSec = max(1, ceil((windowStart + 60000 - nowMs) / 1000))`. 예: 창 시작 + 15초 → 45.
- 정리(purge)는 Cron 없이 "누군가의 새 창 첫 요청"에서 한다. 표에는 대략 최근 1~2분 안에 쓴 회원 수만큼의 행만 남는다(§11 D-AUTH-7).
- 세는 대상은 `rateLimitWrites`가 붙은 요청 전부다. 본문 검증 실패(400)·대상 없음(404)으로 끝난 요청도 1회로 센다(§11 D-AUTH-9).

### 2.6 교차 테스트 벡터 (R-AUTH-001 · R-TOKEN-001)

**테스트 전용 SECRET**: `london-dispatch-test-secret-v1` — 운영 SECRET이 아니다. 운영 값은 문서·코드에 남기지 않는다.
공통: `minLevel = 5`, 기준 시각 `nowMs = 1767225600000`(2026-01-01T00:00:00Z), `exp = 1767268800`(기준 + 12h). JSON은 키 순서 `mb_id, nick, ch_name, level, exp`, `level`·`exp`는 정수, 한글은 UTF-8 그대로(`JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES`와 같은 바이트).

| ID | payload JSON(바이트 수) | 기대 |
|---|---|---|
| V1 | `{"mb_id":"tester01","nick":"테스터","ch_name":"시엘 팬텀하이브","level":5,"exp":1767268800}` (101) | ok. `{ mbId: 'tester01', nick: '테스터', chName: '시엘 팬텀하이브', level: 5, displayName: '시엘 팬텀하이브' }` |
| V2 | `{"mb_id":"tester02","nick":"닉네임","ch_name":"","level":10,"exp":1767268800}` (80) | ok. `chName: null`, `displayName: '닉네임'`, `level: 10` |
| V3 | `{"mb_id":"tester03","nick":"하급","ch_name":"","level":4,"exp":1767268800}` (76) | `LEVEL_TOO_LOW` / `level` |
| V4 | `{"mb_id":"ascii_only","nick":"Tester","ch_name":"Ciel","level":5,"exp":1767268800}` (82) | ok. `displayName: 'Ciel'` |
| V5 | V1의 seg2 **첫 글자** `E`→`F` | `TOKEN_INVALID` / `signature` |
| V5b | V1의 seg2 **마지막 글자** `4`→`5`(패딩 비트만 다름 — 디코드 바이트는 같다) | `TOKEN_INVALID` / `format`(비정규 인코딩) |
| V6 | V1 payload를 SECRET `wrong-secret`으로 서명 | `TOKEN_INVALID` / `signature` |
| V7 | V1과 같은 값, PHP 기본 `json_encode`(한글 `\uXXXX` 이스케이프, 131바이트) | ok. Principal은 V1과 같다 |
| V8 | V1을 `nowMs = 1767268800000`(= exp × 1000)에 검증 | `TOKEN_INVALID` / `expired`. `1767268799999`이면 ok |

토큰 전문(테스트 SECRET 기준, Node `crypto.createHmac`으로 산출):

```text
V1  eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Iu2FjOyKpO2EsCIsImNoX25hbWUiOiLsi5zsl5gg7Yys7YWA7ZWY7J2067iMIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.EWYxcZixnZzWnIjEmFZFc1-_DrqQ8gfOQEOFm3xzMu4
V2  eyJtYl9pZCI6InRlc3RlcjAyIiwibmljayI6IuuLieuEpOyehCIsImNoX25hbWUiOiIiLCJsZXZlbCI6MTAsImV4cCI6MTc2NzI2ODgwMH0.jWSaBGh1d4nF9M5kKORFq2V2sss6O2YWTGvAGi4C15s
V3  eyJtYl9pZCI6InRlc3RlcjAzIiwibmljayI6Iu2VmOq4iSIsImNoX25hbWUiOiIiLCJsZXZlbCI6NCwiZXhwIjoxNzY3MjY4ODAwfQ.X3DOlOqHWy4fJbzpuYxO1TKYegyRQj2Q9udNSsagvXI
V4  eyJtYl9pZCI6ImFzY2lpX29ubHkiLCJuaWNrIjoiVGVzdGVyIiwiY2hfbmFtZSI6IkNpZWwiLCJsZXZlbCI6NSwiZXhwIjoxNzY3MjY4ODAwfQ.bZ5o0FN-_veyz6bFb6gbVejYdIpqhkehp2XuzudLahI
V6  eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Iu2FjOyKpO2EsCIsImNoX25hbWUiOiLsi5zsl5gg7Yys7YWA7ZWY7J2067iMIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.3xEoW7yPl5OjkrJJqXh6huMbZ4p1Lzk55AVgoBtyWX8
V7  eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Ilx1ZDE0Y1x1YzJhNFx1ZDEzMCIsImNoX25hbWUiOiJcdWMyZGNcdWM1ZDggXHVkMzJjXHVkMTQwXHVkNTU4XHVjNzc0XHViZTBjIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.Ppc6_c3yRi28H05QHEZ_gvQMF-neidGMOwQ3a6ukWKs
```

- 이 표가 server 테스트(SRV-T-100~109)·contract `api.md` §2.3·S5 handoff(`doc/handoff/token-snippet.php.md`)가 **같이 쓰는 단일 벡터**다. PHP 조각을 같은 입력·테스트 SECRET으로 돌려 V1 문자열이 바이트 단위로 나오면 R-TOKEN-001 수용 기준을 충족한다.
- 구현자는 이 값을 `server/test/token-vectors.ts`(§3)에 상수로 옮기고, 테스트 안에서 재계산해 대조하지 않는다(벡터가 기준이다).
- 로컬 대조 도구(S5, R-TOKEN-001): `npm run token:test -w server -- sign|verify|vectors --secret <32자 이상 시험값>` — `server/scripts/token-test.ts`(CLI)·`token-tool.ts`(signToken·verifyTokenCli·renderVectors, Node 24 네이티브 TS, 새 패키지 0, `register-ts-resolve.mjs`로 확장자 없는 import 해석). PHP 조각이 만든 토큰을 서버 `verifyToken`으로 검증하고 §2.6 V1~V8(+V5b)을 출력한다. JSON 바이트는 PHP `json_encode`(§9.3 플래그, U+2028/2029 이스케이프 포함)와 일치. 운영 SECRET 사용 금지, SECRET은 출력되지 않음, 환경변수 폴백 없음(env.ts 밖 process.env 금지 훅). 테스트 `server/test/token-test-script.test.ts` 7건.

## 3. 내부 구조

| 파일 | 책임 | 예상 크기 |
|---|---|---|
| `server/src/auth/index.ts` | 문서주석 6항목, 공개 API 재노출 | ~20줄 |
| `server/src/auth/base64url.ts` | `decodeBase64Url(s): Uint8Array \| null`(알파벳·길이·정규형 검사 포함), `encodeBase64Url(bytes): string`. `atob`/`btoa` 사용 | ~40줄 |
| `server/src/auth/token.ts` | `verifyToken`, payload zod 스키마, `toPrincipal`, 상수 `TOKEN_MAX_LENGTH` | ~120줄 |
| `server/src/auth/rate-limit.ts` | `windowStartOf`, `retryAfterSecOf`, `RATE_WINDOW_MS` | ~20줄 |
| `server/src/auth/service.ts` | `createAuthService`(authenticate·hitRateLimit, 실패 로그) | ~70줄 |
| `server/src/auth/middleware.ts` | `readBearer`, `requireToken`, `rateLimitWrites`, `getPrincipal` | ~50줄 |
| `server/test/token-vectors.ts` | §2.6 벡터 상수 `TOKEN_VECTORS`·`VECTOR_SECRET`·`VECTOR_NOW_MS` | 데이터 |
| `server/test/token.ts` | `signTestToken(payload: Record<string, unknown> \| string \| Uint8Array, secret: string): Promise<string>` — Web Crypto로 테스트 토큰 생성(서명은 맞고 payload가 깨진 경우 포함). contract 라우트 테스트도 쓴다 | ~30줄 |
| `server/test/auth-token.test.ts` · `auth-rate-limit.test.ts` · `auth-middleware.test.ts` | §8 | — |

- 의존: `../db`(`rateLimits`), `../app-error`, `../logger`(타입), `../env`(타입 `Config`), `../services`(타입 `AppEnv` — `import type`만, 순환 없음), `hono`(타입·미들웨어), `zod`. rooms·messages·llm을 import하지 않는다.
- 상태 없음. `CryptoKey`를 모듈 전역에 캐시하지 않는다(요청마다 `importKey` — 비용 수 μs, 전역 가변 상태 금지).
- 순수 함수(`verifyToken`·`readBearer`·`windowStartOf`·`retryAfterSecOf`·base64url)는 시각·DB에 의존하지 않는다.

## 4. 비동기·동시성

```
POST /api/rooms  (Authorization: Bearer <t>)
 ① requestLog ─ ② securityHeaders ─ ③ bootstrap: parseEnv → createServices({ db, logger, now, config })
 ④ requireToken                                                         [라우트 단위 — 전역 아님]
      readBearer(c.req.header('Authorization')) ── null → throw TOKEN_REQUIRED
      await services.auth.authenticate(raw)
          verifyToken(raw, { secret, minLevel, nowMs: now() })
             형식 → importKey·sign(HMAC, async) → timingSafeEqual → UTF-8·JSON·zod → exp → level
          실패 → logger.warn('auth_rejected', { code, reason }) → throw AppError(code)
      c.set('principal', principal)
 ⑤ rateLimitWrites
      await services.auth.hitRateLimit(getPrincipal(c).mbId)
          D1 UPSERT … RETURNING count   (조건부 1문장 — 원자적)
            null → warn('rate_limited', { mbId }) → throw RATE_LIMITED(retryAfterSec)
            1    → D1 DELETE … window_start < 현재 창   (실패는 warn 후 무시)
 ⑥ validate(param/json) → 핸들러 → rooms/messages 서비스(principal 은 값으로 전달)
 ◀ 응답 (오류는 전부 onError 한 곳에서 { error } + CSP)
```

- **동시성**: 카운트 증가와 한도 판정이 UPSERT 한 문장 안에서 일어난다. D1은 쓰기를 한 주 인스턴스에서 직렬 실행하므로 같은 `mb_id`로 25건이 동시에 와도 정확히 20건만 통과한다(SRV-T-114). 프로세스 메모리 카운터 없음.
- **시각**: `now()`는 서비스 컨테이너가 주입한 시계(기본 `Date.now`). Workers의 `Date.now()`는 I/O 사이에서만 진행하지만 분 창 판정에는 충분하다.
- **타임아웃**: 외부 호출 없음. D1·Web Crypto 대기는 플랫폼이 제한.
- **CPU(R-NFR-005)**: 요청당 HMAC 1회(네이티브, 수 μs), 4096자 이하 base64url 디코드, 작은 JSON 파싱, UPSERT 1회(+ 분당 최대 1회 purge). 10ms 한도에 비해 무시할 수준.
- **백그라운드 작업**: 없음(`waitUntil` 미사용). purge는 분당 1회 수준이라 요청 경로에서 기다린다.

## 5. 에러 타입

| 에러 클래스 | shared 에러 코드 | HTTP | 한국어 메시지(`ERROR_MESSAGES` 기본값 그대로) | 원인 |
|---|---|---|---|---|
| `AppError` | `TOKEN_REQUIRED` | 401 | `로그인한 회원만 사용할 수 있습니다.` | Bearer 토큰을 꺼낼 수 없음(§2.4), 또는 `getPrincipal` 호출 시 principal 없음 |
| `AppError` | `TOKEN_INVALID` | 401 | `인증 정보가 올바르지 않거나 만료되었습니다. 페이지를 새로 고쳐 주세요.` | reason `format`·`signature`·`payload`·`expired` |
| `AppError` | `LEVEL_TOO_LOW` | 403 | `대화에 참여할 수 있는 회원 등급이 아닙니다.` | reason `level` |
| `AppError`(`retryAfterSec` 포함) | `RATE_LIMITED` | 429 | `요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.` | 분 창 한도 초과. 응답 본문·헤더에 `retryAfterSec`([index.md](index.md) §5.1) |
| (전파) D1 오류 | `INTERNAL` | 500 | `서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.` | `hit` 실패. purge 실패는 전파하지 않음 |

- 응답 메시지는 reason과 무관하게 코드별 기본 문구 하나다. 어느 단계에서 실패했는지 응답으로 알려 주지 않는다(위조 시도에 정보를 주지 않는다).
- 로그 이벤트(R-AUTH-006 — 토큰·payload·SECRET·nick·ch_name 금지):

| event | level | 필드 |
|---|---|---|
| `auth_rejected` | warn | `code`, `reason` |
| `rate_limited` | warn | `mbId` |
| `rate_limit_purge_failed` | warn | `errName` |

## 6. 설정(env)

`parseEnv` 결과(`Config`)에서 세 값(S3c부터 `ownerMbIds`를 더해 네 값 — §12.4)을 골라 `createAuthService`에 값으로 받는다. 바인딩을 직접 읽지 않는다. 새 키 없음.

| `Config` 필드 | 바인딩 키 | 타입·기본값 | 비밀값 | 쓰는 곳 |
|---|---|---|---|---|
| `tokenSecret` | `TOKEN_SECRET` | string, 필수, **32자 이상**(parseEnv가 보장 — [env.md](env.md) §3.1·D-ENV-13, 2026-10-07. auth는 길이를 다시 보지 않는다) | ○ Secrets / `server/.dev.vars` | HMAC 키 |
| `tokenMinLevel` | `TOKEN_MIN_LEVEL` | int 1~10, 기본 5 | ✕ `wrangler.toml [vars]` | 등급 비교 |
| `rateLimitPerMin` | `RATE_LIMIT_PER_MIN` | int 1~600, 기본 20 | ✕ `wrangler.toml [vars]` | 창당 한도 |

- `tokenSecret`은 `AuthService` 클로저 안에만 있고 속성으로 노출하지 않는다. 라우트가 `services.auth`를 통해 SECRET에 닿을 길이 없다.
- **시험 SECRET(2026-10-07).** §2.6 교차 벡터의 SECRET은 교차 언어 기준이라 바꾸지 않는다. `verifyToken`은 길이를 보지 않으므로 벡터 단위 시험은 그대로 돈다. `parseEnv`를 거치는 HTTP 계층 시험(`server/test/auth.test.ts` 등)은 32자 이상 SECRET으로 같은 payload를 다시 서명해 쓴다.

## 7. DB 스키마·마이그레이션

- 사용 테이블: `rate_limits(mb_id, window_start, count, PK(mb_id, window_start))` — `0001_init.sql`에 이미 있다([db.md](db.md) §7.1). **새 마이그레이션 없음.**
- 인덱스: UPSERT는 PK를 쓴다. purge(`WHERE window_start < ?`)는 표 전체를 훑지만 행 수가 "최근 1~2분 안에 쓴 회원 수"라 새 인덱스를 두지 않는다.
- 쓰기 비용(무료 일 10만 행): 쓰기 요청 1건당 1행. purge는 실제로 지운 행만 센다.

## 8. 테스트 계획

workers pool(`cloudflare:test`의 `env.DB`, setup이 마이그레이션 적용 — [db.md](db.md) §8). 시각은 전부 주입한다.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-100 | `verifyToken_accepts_vector_V1_and_builds_principal` | V1, `VECTOR_SECRET`, minLevel 5, `VECTOR_NOW_MS` | ok, §2.6 Principal과 깊은 일치 | R-AUTH-001·004 · R-TOKEN-001 |
| SRV-T-101 | `verifyToken_uses_nick_when_ch_name_blank` | V2, 그리고 `signTestToken`으로 `ch_name: null`·`"   "` | `chName: null`, `displayName = nick` | R-AUTH-004 |
| SRV-T-102 | `verifyToken_accepts_php_default_escaped_payload` | V7 · V4 | V7 Principal = V1 Principal, V4 ok | R-AUTH-001 |
| SRV-T-103 | `verifyToken_rejects_signature_mismatch` | V5, V6, V4의 seg1을 `level: 9`로 바꾼 것 + V4 seg2 | 전부 `TOKEN_INVALID`/`signature` | R-AUTH-002 |
| SRV-T-104 | `verifyToken_rejects_malformed_format` | 표: `''`, `'abc'`, `'a.b.c'`, `'.x'`, `'x.'`, `'@@.##'`, seg에 `=` 패딩, seg2 31바이트, 4097자, V5b | 전부 `TOKEN_INVALID`/`format` | R-AUTH-002 |
| SRV-T-105 | `verifyToken_rejects_signed_but_invalid_payload` | `signTestToken`으로 서명은 맞게: 비 JSON, 잘못된 UTF-8 바이트, 배열, `mb_id` 누락·`''`, `level: "5"`·`5.5`·`0`·`11`, `exp: "1767268800"`, `nick: " "`, `ch_name` 키 없음 | 전부 `TOKEN_INVALID`/`payload` | R-AUTH-001·002 |
| SRV-T-106 | `verifyToken_rejects_expired_at_boundary` | V8 두 시각 | `exp*1000` → `expired`, `-1ms` → ok | R-AUTH-002 |
| SRV-T-107 | `verifyToken_rejects_low_level_after_signature_and_exp` | V3(minLevel 5 → `LEVEL_TOO_LOW`, minLevel 4 → ok), V3를 틀린 SECRET으로 → `TOKEN_INVALID`/`signature`, 만료된 V3 → `TOKEN_INVALID`/`expired` | 순서대로 | R-AUTH-002 |
| SRV-T-108 | `verifyToken_ignores_unknown_payload_keys` | V1 키 + `iat`·`foo` (signTestToken) | ok, Principal에 추가 키 없음 | R-AUTH-001 |
| SRV-T-109 | `readBearer_extracts_only_bearer_scheme` | `undefined`, `''`, `'   '`, `'Bearer'`, `'Bearer   '`, `'Basic abc'` → null / `'Bearer t'`, `'bearer t'`, `'Bearer   t  '` → `'t'` | 표대로 | R-AUTH-003 |
| SRV-T-110 | `windowStartOf_and_retryAfterSecOf_compute_minute_window` | `nowMs` = 창 시작, +15000, +59999 | 창 시작 동일, retry 60·45·1 | R-AUTH-005 |
| SRV-T-111 | `hitRateLimit_allows_limit_then_throws_RATE_LIMITED` | 한도 20, 같은 `nowMs`(창 시작 + 15000)로 21회 | 1~20 resolve, 21번째 `RATE_LIMITED` 429·`retryAfterSec` 45, `rate_limits.count` = 20, warn 로그 `rate_limited`에 `mbId` | R-AUTH-005 · R-NFR-003 |
| SRV-T-112 | `hitRateLimit_resets_next_window_and_purges_old_rows` | 창 W에서 A 20회·B 1회 → W+60000에서 A 1회 | A 통과(count 1), `window_start < W+60000` 행 0건(B의 지난 창도 삭제) | R-AUTH-005 |
| SRV-T-113 | `hitRateLimit_counts_each_mbId_independently` | A 20회 후 B 1회 | B 통과 | R-AUTH-005 |
| SRV-T-114 | `hitRateLimit_concurrent_hits_never_exceed_limit` | `Promise.allSettled` 25건 동시, 같은 mbId·같은 시각 | fulfilled 20, rejected 5(전부 `RATE_LIMITED`), DB count 20 | R-NFR-003 |
| SRV-T-115 | `hitRateLimit_ignores_purge_failure` | `purgeBefore`가 reject하는 가짜 `Db`(hit은 1 반환) | resolve, warn `rate_limit_purge_failed` | R-AUTH-005 |
| SRV-T-116 | `requireToken_rejects_missing_or_non_header_token` | 시험 라우트(`requireToken` + 200 핸들러)를 `createApp`에 주입. 헤더 없음 / `?t=<유효>`만 / `Cookie: t=<유효>`만 / `Authorization: Basic x` | 전부 401 `TOKEN_REQUIRED`, 핸들러 미실행 | R-AUTH-003 · R-API-003 |
| SRV-T-117 | `requireToken_maps_failures_and_sets_principal` | 위조 → 401 `TOKEN_INVALID`, 저등급 → 403 `LEVEL_TOO_LOW`, 유효 → 200 + 핸들러가 `getPrincipal(c)`로 받은 `mbId`·`displayName`을 응답에 반사 | 표대로 | R-AUTH-002·003·004 |
| SRV-T-118 | `rateLimitWrites_returns_429_with_retryAfterSec` | env `RATE_LIMIT_PER_MIN: '2'`, 같은 토큰 3회 | 3번째 429, 본문 `error.code === 'RATE_LIMITED'`, `error.retryAfterSec` 정수 ≥ 1, `Retry-After` 헤더 같은 값 | R-AUTH-005 |
| SRV-T-119 | `getPrincipal_without_requireToken_fails_closed` | `rateLimitWrites`만 붙인 시험 라우트 | 401 `TOKEN_REQUIRED`, `rate_limits` 0행 | R-AUTH-003 |
| SRV-T-120 | `auth_logs_and_bodies_never_contain_token_or_payload` | 유효 V1(나중 시각으로 만료) · 위조 토큰 · `nick: 'SENTINEL_NICK'` 토큰 · SECRET `SENTINEL_SECRET`으로 각각 요청 | 수집 로그 전체와 응답 본문에 토큰 문자열·seg1·`SENTINEL_NICK`·`SENTINEL_SECRET` 없음. `auth_rejected`에 `reason` 존재 | R-AUTH-006 · R-NFR-004 |

- 에러 경로(103~107·109 일부·111·114~120) > 정상 경로(100~102·108·110·112·113).
- 미들웨어 테스트(116~120)는 시험용 Hono 라우트를 `createApp({ routes, logSink, now })`에 주입해 contract 라우트 없이 돈다. 실제 쓰기 라우트 전건 적용 여부(R-AUTH-003 수용 기준 "라우트 표 대조")는 contract 테스트 몫(§9.1).

수동 체크:

- [ ] `wrangler dev`에서 `curl -X POST http://localhost:3000/api/rooms -H 'content-type: application/json' -d '{"title":"x"}'` → 401 `TOKEN_REQUIRED`(contract 라우트 생성 후).
- [ ] 로컬 `.dev.vars`의 SECRET으로 만든 토큰으로 21회 연속 쓰기 → 21번째 429, `Retry-After` 헤더 확인.
- [ ] `wrangler tail`(또는 dev 콘솔) 로그에 토큰·닉네임이 찍히지 않는다.

## 9. contract 요구 명세

### 9.1 라우트가 쓰는 미들웨어와 principal

```ts
import { getPrincipal, rateLimitWrites, requireToken } from '../auth'

// 쓰기 라우트: requireToken → rateLimitWrites → validate(...) → 핸들러 (이 순서 고정)
export const roomsRoutes = new Hono<AppEnv>()
  .post(PATHS.rooms, requireToken, rateLimitWrites, validate('json', createRoomBody), async c => {
    const room = await c.get('services').rooms.createRoom(c.req.valid('json'))
    return c.json(room, 201)
  })
// principal 이 필요한 서비스(addUserMessage)는 getPrincipal(c) 를 값으로 넘긴다
```

| 항목 | 규약 | 이유 |
|---|---|---|
| 적용 범위 | **라우트 단위**로 붙인다. 전역(`app.use('*')`)·라우터 단위(`apiRoutes.use`) 금지 | 읽기 경로는 토큰 불필요(R-AUTH-003). 헤더가 있어도 읽기는 무시 |
| S2 적용 대상 | E4 `POST /api/rooms`, E5 `PATCH /api/rooms/:id`, E6 `DELETE /api/rooms/:id`, E8 `POST /api/rooms/:id/user`, E10 `PATCH /api/messages/:id`, E11 `DELETE /api/messages/:id` — 전부 `requireToken, rateLimitWrites` | R-AUTH-003·005 |
| 이후 묶음 | S3 E9 speak·E12 regenerate도 둘 다. S4 `GET/PUT …/memory`는 `requireToken` 필수, `rateLimitWrites`는 PUT에만(GET은 쓰기가 아니다 — S4 설계에서 확정) | R-AUTH-005 "쓰기 요청" |
| 순서 | `requireToken` → `rateLimitWrites` → `validate` → 핸들러. 인증 실패가 검증 오류보다 먼저 나온다 | 미인증 요청에 본문 규칙을 알려 주지 않는다 |
| principal 읽기 | `getPrincipal(c)`만 쓴다. `c.get('principal')` 직접 읽기·`!` 단언 금지 | 미들웨어 누락 시 401로 닫힌다(SRV-T-119) |
| 금지 | `services.auth.authenticate`·`hitRateLimit` 직접 호출, 헤더 직접 파싱, `?t=`·쿠키 읽기 | 토큰 처리 단일 지점 |
| 타입 | `AppEnv.Variables.principal?: Principal` (server `services.ts`가 선언 — [index.md](index.md) §2.3). `Principal`은 `server/src/auth`에서 `import type` | Hono `c.set`/`c.get` 타입 |
| 대조 테스트 | contract 라우트 테스트가 S2 쓰기 6개 엔드포인트 전건에 "헤더 없음 → 401 `TOKEN_REQUIRED`"를 표로 확인(R-AUTH-003 수용 기준) | 라우트 표 대조 |
| 테스트 토큰 | `server/test/token.ts`의 `signTestToken(payload, 'test-secret')`(vitest 바인딩 `TOKEN_SECRET`과 같은 값), `createApp({ routes: apiRoutes, now: () => 고정 })`로 만료를 결정적으로 | — |

### 9.2 에러 코드·응답

| code | status | 응답 추가 필드 | 비고 |
|---|---|---|---|
| `TOKEN_REQUIRED` | 401 | — | 기본 문구 |
| `TOKEN_INVALID` | 401 | — | 형식·서명·payload·만료 구분 없음 |
| `LEVEL_TOO_LOW` | 403 | — | |
| `RATE_LIMITED` | 429 | **`error.retryAfterSec: number`**(정수 ≥ 1) + 헤더 `Retry-After: <같은 값>` | R-AUTH-005 "응답에 retryAfterSec". `shared/src/types.ts` `ApiErrorBody.error`에 `retryAfterSec?: number` 추가 요청(추가 = 비파괴). 위치를 contract가 다르게 정하면 server onError를 그에 맞춘다 |

### 9.3 토큰 형식 — `api.md` §2.3·handoff에 전사할 것

| 항목 | 값 |
|---|---|
| 형식 | §2.1(서명 입력 = JSON 바이트, base64url 무패딩) |
| payload | §2.1 표. `level`·`exp`는 **정수**로 직렬화(PHP `(int)$member['mb_level']`, `time() + 43200`) — 그누보드는 `mb_level`을 문자열로 돌려주므로 캐스트가 없으면 서버가 `TOKEN_INVALID`로 거부한다 |
| `ch_name` | 캐릭터명이 없으면 `''`(또는 null). 키는 항상 넣는다 |
| JSON 플래그(권고) | `JSON_UNESCAPED_UNICODE \| JSON_UNESCAPED_SLASHES`, 키 순서 `mb_id, nick, ch_name, level, exp` → §2.6 V1과 바이트 일치. 기본 플래그를 택하면 V7과 일치(서버는 둘 다 통과) |
| 교차 벡터 | §2.6 V1~V8 전부를 `api.md`에 그대로 싣고, handoff는 V1(필수)·V7(플래그 확인용)을 PHP 자가 점검 예로 쓴다 |
| 만료 | `exp` = 발급 + 12h(초). 서버는 `nowMs < exp*1000`일 때만 유효 |

### 9.4 노출 서비스 / 엔드포인트 후보

| 서비스·미들웨어 | 엔드포인트 | 입력 | 출력 | 에러 | 이유 |
|---|---|---|---|---|---|
| `requireToken` | S2 쓰기 6개(+S3·S4) | `Authorization: Bearer <t>` | `c` 에 `principal` | `TOKEN_REQUIRED`·`TOKEN_INVALID`·`LEVEL_TOO_LOW` | R-AUTH-002·003 |
| `rateLimitWrites` | 같음(S4 GET memory 제외) | principal | — | `RATE_LIMITED` | R-AUTH-005 |
| `getPrincipal` | principal이 필요한 핸들러(E8 user, S3 speak) | `c` | `Principal` | `TOKEN_REQUIRED` | R-AUTH-004 |

새 엔드포인트는 없다(토큰 확인용 `GET /api/me` 같은 것은 요구에 없다).

## 10. 요구 추적표

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-AUTH-001 🔒 | §2.1·§2.6·§9.3 | SRV-T-100·102·105·108 | ✅ |
| R-AUTH-002 🔒 | §2.2·§5 | SRV-T-103~107·117 | ✅ |
| R-AUTH-003 🔒 | §2.4·§9.1 | SRV-T-109·116·117·119, contract 전건 대조 | ✅(전건 적용 확인은 contract 테스트) |
| R-AUTH-004 (확인 필요 §9-2) | §2.3 | SRV-T-100·101, [messages.md](messages.md) SRV-T-142 | ✅(기본값) |
| R-AUTH-005 (확인 필요 §9-6) | §2.5·§7·§9.2 | SRV-T-110~115·118, [db.md](db.md) SRV-T-126·127 | ✅(기본값) |
| R-AUTH-006 🔒 | §5 로그 표 | SRV-T-120, [index.md](index.md) SRV-T-162 | ✅ |
| R-TOKEN-001 🔒 (server 몫) | §2.6·§9.3 | SRV-T-100·102 | 부분(PHP 조각 대조는 contract·S5 handoff) |
| R-API-003 🔒 (server 몫) | §2.4 | SRV-T-109·116 | 부분(화면 보관은 contract·ui) |
| R-NFR-003 🔒 (레이트리밋 몫) | §2.5·§4 | SRV-T-111·114 | 부분(speak 409는 S3) |
| R-NFR-004 🔒 | §5·§6 | SRV-T-120 | ✅ |
| R-NFR-005 | §4 CPU | 리뷰 | ✅ |

## 11. 설계 결정 노트

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-AUTH-1 | 서명 입력 = JSON 바이트(seg1 디코드 결과) | seg1 문자열(JWT 방식) | R-AUTH-001 문구 "HMAC-SHA256(payload, SECRET)"를 글자 그대로 따른다. PHP는 `hash_hmac('sha256', $json, …)` 한 줄이라 실수 여지가 작다. 서버는 디코드한 바이트에 서명하므로 PHP 직렬화 차이에 강하다(V7) |
| D-AUTH-2 | `sign` 후 `crypto.subtle.timingSafeEqual` | `crypto.subtle.verify('HMAC', …)` | R-AUTH-002 "상수시간 비교"를 코드에서 명시적으로 보인다. `verify`의 상수시간성은 표준이 보장하지 않는다(구현 의존) |
| D-AUTH-3 | 비정규 base64url(패딩 비트 ≠ 0, `=` 포함) 거부 | `atob`이 받는 대로 수용 | 같은 서명의 다른 문자열 표현을 막아 "토큰 문자열 = 서명" 1:1을 유지한다. 위조 위험은 아니지만 테스트(V5b)가 결정적이 된다 |
| D-AUTH-4 | 타입 이름 `Principal`(+`displayName`) | server-design-strategy·server-rules의 `AuthContext{mbId,nick,chName,level}` | 위임문 지정. 표시 이름 규칙(R-AUTH-004)을 한 곳에서 계산한다. 스킬 문구(`AuthContext`) 갱신은 메인 세션 몫 |
| D-AUTH-5 | 미들웨어 둘(`requireToken`, `rateLimitWrites`) 분리 | 하나로 합침 | S4 `GET …/memory`는 토큰이 필요하지만 쓰기가 아니다(R-AUTH-005 "쓰기 요청"). 합치면 읽기도 한도에 걸린다 |
| D-AUTH-6 | Bearer를 꺼낼 수 없으면 `TOKEN_REQUIRED`, 꺼낸 뒤 실패는 `TOKEN_INVALID` | 다른 scheme을 `TOKEN_INVALID`로 | 규칙이 한 줄로 끝난다. 화면은 두 코드 모두 읽기 전용 전환이라 동작 차이 없음 |
| D-AUTH-7 | 오래된 창 정리 = 새 창 첫 hit(`count === 1`)에서 `purgeBefore(현재 창)` | Cron Trigger(`scheduled`) · 매 요청 batch DELETE | Cron은 `wrangler.toml [triggers]`·`scheduled` 진입이 늘어난다. 매 요청 DELETE는 불필요한 쓰기 쿼리. 이 방식은 분당 회원당 최대 1회. [index.md](index.md)가 S2 후보로 적었던 `scheduled`는 **추가하지 않는다** |
| D-AUTH-8 | 고정 창 | 슬라이딩 창(직전 창 가중) | R-AUTH-005가 `window_start` 고정 창을 명시. 경계 버스트(최대 2배)는 소규모 커뮤니티에서 수용 |
| D-AUTH-9 | 검증 실패·404 요청도 1회로 센다(미들웨어에서 셈) | 성공한 쓰기만 셈 | 셈이 서비스 결과에 의존하면 서비스마다 호출을 넣어야 하고 빠뜨릴 수 있다. 쓰레기 요청 반복도 막는다 |
| D-AUTH-10 | `level`·`exp`는 JSON 정수만, 모르는 키 무시, `ch_name` null 허용 | 문자열 숫자 허용 | 서명된 입력이라도 형식을 하나로 고정해야 PHP·서버 대조가 결정적이다. 캐스트 요구는 contract §9.3으로 인계 |
| D-AUTH-11 | 만료 경계 `nowMs < exp*1000`만 유효, 시계 오차 여유 없음 | ±60초 허용 | 12시간 토큰이라 여유가 필요 없다. 규칙이 단순하고 테스트가 결정적 |
| D-AUTH-12 | 원문 길이 상한 4096자 | 상한 없음 | HMAC·디코드 전에 큰 입력을 버린다(CPU 10ms). 실제 토큰은 300자 안팎 |
| D-AUTH-13 | 실패 로그에 `reason`(분류)만 | 로그 없음 | 만료가 잦은지(새로 고침 안내 필요) 위조 시도인지 운영에서 구분. 토큰·payload는 남기지 않는다(R-AUTH-006) |
| D-AUTH-14 | 옵션 이름 `nowMs`(숫자) | 위임문의 `now` | 이 코드베이스에서 `now`는 `() => number` 함수 이름이다(`ServiceDeps.now`). 숫자 시각은 db 함수와 같이 `nowMs`로 구분한다 |

확인 필요:

- R-AUTH-004(§9-2 표시 이름)·R-AUTH-005(§9-6 분당 20)는 기본값을 적용했다. 값이 바뀌어도 코드 구조는 같다(§9-6은 `[vars]`만 변경).
- PHP `json_encode` 플래그는 contract가 정한다(§9.3). 서버는 어느 쪽이든 통과한다.

제안(설계 미반영, 사용자 판단):

- `TOKEN_SECRET` 최소 길이(32자) 검사 — [env.md](env.md) §11 제안과 같다. 짧은 SECRET은 오프라인 추측 공격에 약하다.
- `exp` 상한 검사(`exp*1000 <= nowMs + 12h + 5분`). PHP 조각 버그로 만료가 아주 먼 토큰이 나오는 일을 막는다. 요구 문구에 없어 보류.
- 쓰기 요청의 요청 로그에 `mbId` 추가(남용 추적). R-AUTH-006은 `mb_id` 식별을 허용하지만 요구된 기능이 아니라 보류.

## 12. S3c 주인 판정 (R-SET-001 · R-AUTH-003 예외)

- **구현 완료(2026-10-06)**: server 318/318 통과 · S3c 테스트 SRV-T-234~260(이 절 몫 SRV-T-236~238).

출입증(토큰)이 진짜여도 사장실(설정 화면)은 명단에 있는 사람만 들어간다. 명단은 배포 설정 `OWNER_MB_IDS`에 있고, 경비(auth)는 출입증의 회원 ID가 명단에 있는지만 본다.

결정 출처: `s3c-02-전반설계.md` §1(권고 B — 토큰 형식·PHP 조각·handoff 불변) · `doc/state.json` decisions 2026-10-06(Q2 수정: 명단에는 지인 ID만).

### 12.1 공개 API

```ts
// server/src/auth/service.ts — AuthService·AuthDeps 확장
export type AuthService = {
  authenticate: (raw: string) => Promise<Principal>   // 그대로
  hitRateLimit: (mbId: string) => Promise<void>        // 그대로
  /** S3c. principal.mbId ∈ ownerMbIds(대소문자 구분 정확 일치). 목록이 비면 항상 false. 부수 효과 없음(03 §1.3) */
  isOwner: (principal: Principal) => boolean
  /** S3c. isOwner 가 false 면 logger.info('owner_denied', { mbId }) 후 AppError('OWNER_ONLY') 403. requireOwner 가 쓴다 */
  assertOwner: (principal: Principal) => void
}

export type AuthDeps = {
  db: Db
  logger: Logger
  now: () => number
  config: Pick<Config, 'tokenSecret' | 'tokenMinLevel' | 'rateLimitPerMin'> &
    /** S3c. 없으면 [](닫힌 쪽 — 아무도 주인 아님). 컨테이너는 항상 넘긴다 */
    Partial<Pick<Config, 'ownerMbIds'>>
}

// server/src/auth/middleware.ts — 추가 (auth/index.ts 재노출에 requireOwner 추가)
/** S3c. requireToken 뒤에만. getPrincipal(c) → services.auth.assertOwner(principal) → next(). principal 없으면 TOKEN_REQUIRED(닫힌 쪽) */
export const requireOwner: MiddlewareHandler<AppEnv>
```

| 이름 | 인자 | 반환 | 실패 조건(에러 코드) | 요구ID |
|---|---|---|---|---|
| `isOwner` | `principal` | `boolean` | — | R-SET-001 |
| `assertOwner` | `principal` | `void` | `OWNER_ONLY`(403) | R-SET-001 · R-SET-012 |
| `requireOwner` | Hono 미들웨어 | — | `TOKEN_REQUIRED`(401, requireToken 누락 시), `OWNER_ONLY`(403) | R-SET-001 · R-AUTH-003 예외 |

- `AuthDeps.config.ownerMbIds`를 선택으로 둔 이유: `createAuthService`를 직접 만드는 기존 테스트 픽스처(SRV-T-111~115 등)를 고치지 않기 위해서다. 기본값 `[]`은 닫힌 쪽이다. 운영 배선은 SRV-T-237(`createApp` 경유)이 확인한다.
- `isOwner`·`requireOwner` 이름과 역할은 03 §1.3 그대로다. `assertOwner`는 **추가**(비파괴)다. 라우트는 `requireOwner`만 쓴다.

### 12.2 판정 순서

```
GET /api/settings/characters · PUT /api/settings/characters        (routes = contract, 라우트 단위)
 ④  requireToken    ── 401 TOKEN_REQUIRED / 401 TOKEN_INVALID / 403 LEVEL_TOO_LOW   (기존 그대로)
 ④b requireOwner    ── principal = getPrincipal(c)                 (없으면 401 TOKEN_REQUIRED)
                       services.auth.assertOwner(principal)
                         ownerMbIds.includes(principal.mbId) ? 통과
                                                             : info('owner_denied', { mbId }) → throw OWNER_ONLY(403)
 ⑤  rateLimitWrites (PUT만) ── 429 RATE_LIMITED
 ⑥  (PUT만) 본문 상한 128KB → validate(zod 판정, 400 문구는 shared — api.md §4.16) → 핸들러 → services.settings.get() / put(body.settings, principal)
```

- 동기 판정이다. D1·I/O에 접근하지 않는다(api.md §15.12 N6). CPU 무시 가능.
- 주인 판정은 등급 검사(`TOKEN_MIN_LEVEL`) 뒤다. 명단에 있어도 토큰 등급이 모자라면 `LEVEL_TOO_LOW`가 먼저 난다.
- 403 응답은 기본 문구만 싣는다. 주인 목록·사유를 알려 주지 않는다(02 §6 탐침 방지).
- `LEVEL_TOO_LOW`를 재사용하지 않는다. 화면은 그 코드를 "쓰기 권한 상실"로 처리해 읽기 전용으로 떨어진다(02 §4.2).
- 비주인 PUT은 레이트리밋 카운트를 쓰지 않는다(④b가 ⑤보다 앞).

### 12.3 에러·로그

| 에러 클래스 | shared 에러 코드 | HTTP | 한국어 메시지 | 원인 |
|---|---|---|---|---|
| `AppError` | `OWNER_ONLY` | 403 | shared `ERROR_MESSAGES.OWNER_ONLY` 기본 문구 `캐릭터 설정은 갠홈 주인만 열 수 있습니다.`(api.md §5.8.2 확정). 목록·`mbId`·사유를 싣지 않는다(N6) | 유효 토큰이지만 `mbId ∉ OWNER_MB_IDS`. 목록이 빈 경우 포함 |

| event | level | 필드 | 비고 |
|---|---|---|---|
| `owner_denied` | info | `mbId` | 화면의 주인 판정 탐침(R-SET-010)이 등급 회원마다 첫 로드에 1건 내는 정상 흐름이라 warn이 아니다. nick·토큰·목록은 남기지 않는다(R-AUTH-006 · R-SET-012) |

- `AppError('OWNER_ONLY')`는 shared `ErrorCode`에 `OWNER_ONLY`(403)가 들어간 뒤에 컴파일된다. contract-implementer의 shared 단계(03 §0.1 4a)가 선행이다.

### 12.4 설정(env)

| `Config` 필드 | 바인딩 키 | 타입·기본값 | 비밀값 | 쓰는 곳 |
|---|---|---|---|---|
| `ownerMbIds` (S3c) | `OWNER_MB_IDS` | `readonly string[]`, 기본 `[]` | 비밀 아님. Secrets 권고, `[vars]` 허용([env.md](env.md) S3c 델타) | `isOwner` |

- 기본 `[]`이면 설정 엔드포인트는 전원 `OWNER_ONLY` 403이고 캐릭터 대화는 기본 설정으로 계속된다. 모듈 머리 주석(`auth/index.ts` [설정])도 `tokenSecret`(32자 이상은 parseEnv 보장)·`tokenMinLevel`·`rateLimitPerMin`·`ownerMbIds` 네 값을 적는다(verify 후속, 2026-10-07).

### 12.5 테스트 (`server/test/auth-middleware.test.ts`·`auth-rate-limit.test.ts` 옆 신규 `auth-owner.test.ts`)

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-236 | `isOwner_matches_exact_mbId_only` | 목록 `['owner_a','owner_b']` × principal `owner_a`·`owner_b`·`OWNER_A`·`owner_a `·`member_x` / 목록 `[]`·미지정 × `owner_a` | `true`·`true`·`false`·`false`·`false` / `false`·`false`. 로그 0건(순수) | R-SET-001 |
| SRV-T-237 | `requireOwner_four_paths_via_app` | 시험 라우트(`requireToken, requireOwner` + 200 핸들러)를 `createApp`에 주입. ① env `OWNER_MB_IDS: 'owner_a'`, `owner_a` 토큰 ② 같은 env, `member_x` 토큰 ③ `OWNER_MB_IDS: ''`, `owner_a` 토큰 ④ `OWNER_MB_IDS`에 21자 조각 ⑤ 무토큰 · 저등급 `owner_a` 토큰 | ① 200 ② 403 `OWNER_ONLY` + info `owner_denied { mbId: 'member_x' }` ③ 403 `OWNER_ONLY` ④ 500 `CONFIG_INVALID` ⑤ 401 `TOKEN_REQUIRED` · 403 `LEVEL_TOO_LOW`(주인 판정 전). ②~⑤ 핸들러 미실행 | R-SET-001 · R-AUTH-003 |
| SRV-T-238 | `requireOwner_without_requireToken_fails_closed` | `requireOwner`만 붙인 시험 라우트 | 401 `TOKEN_REQUIRED`, `owner_denied` 로그 없음 | R-SET-001 |

- SRV-T-237이 lead 수용 기준 "주인 판정 4경로(주인·비주인·빈 목록·형식 위반 env)"를 덮는다. 실제 설정 라우트 전건 대조(무토큰 401·등급 미달 403·비주인 403·주인 200)는 contract 라우트 테스트 몫이다.
- SRV-T-237 변형 ⑥(api.md N6): `requireToken, requireOwner, rateLimitWrites` 순서의 시험 라우트에 비주인 요청 3회(`RATE_LIMIT_PER_MIN: '2'`) → 전부 403 `OWNER_ONLY`, `rate_limits` 0행, 응답 본문에 `mbId` 없음. `requireOwner` 경로가 D1을 쓰지 않음을 함께 보인다.

### 12.6 contract 요구 명세

| 항목 | 규약 |
|---|---|
| 적용 라우트 | E15 `GET /api/settings/characters`: `requireToken, requireOwner`. E16 `PUT`: `requireToken, requireOwner, rateLimitWrites`, 본문 상한, `validate('json', putCharacterSettingsBody, settingsIssueMessage)`(api.md §4.16) |
| 적용 단위 | 라우트 단위만. 전역·라우터 단위 금지(기존 §9.1 규약 그대로) |
| 순서 | `requireOwner`는 반드시 `requireToken` 바로 뒤. 빠지면 401로 닫힌다(SRV-T-238) |
| 화면 규약 | `OWNER_ONLY`는 화면 `AUTH_FAILURE_CODES`에 넣지 않는다(02 §4.2, R-SET-010) |
| shared 선행 | `ErrorCode`·`ERROR_STATUS`·`ERROR_MESSAGES`에 `OWNER_ONLY`(403) 추가(15종) |

### 12.7 요구 추적 (S3c)

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-SET-001 🔒 | §12.1·§12.2 | SRV-T-236~238, [env.md](env.md) SRV-T-234·235 | ✅(설계) |
| R-AUTH-003 🔒 (S3c 예외 — 설정 GET도 토큰) | §12.2·§12.6 | SRV-T-237 ⑤, contract 라우트 테스트 | ✅(설계) |
| R-AUTH-006 🔒 · R-SET-012 | §12.3(`owner_denied`는 `mbId`만) | [settings.md](settings.md) SRV-T-259 | ✅(설계) |

### 12.8 설계 결정 (S3c)

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-AUTH-15 | 판정 함수 둘: 순수 `isOwner` + 로그·throw `assertOwner` | `isOwner` 안에서 로그 | 미들웨어는 logger에 닿지 않는다(`AppEnv.Variables`에 logger 없음). 술어에 부수 효과를 두지 않는다 |
| D-AUTH-16 | 대소문자 구분 정확 일치 | 소문자 정규화 | 토큰 `mb_id`는 갠홈 DB 값 그대로 서명된다. 정규화하면 다른 회원과 겹칠 여지를 만든다 |
| D-AUTH-17 | 주인 판정을 레이트리밋 앞에 | 뒤에 | 비주인 요청이 쓰기 카운트를 쓰지 않는다. 02 §4.1 미들웨어 순서 |
| D-AUTH-18 | `AuthDeps.config.ownerMbIds` 선택(기본 `[]`) | 필수 | 기존 테스트 픽스처 무수정. 기본값이 닫힌 쪽이라 누락돼도 열리지 않는다 |

파급: `auth/index.ts` 재노출에 `requireOwner` 추가. `AuthService`에 메서드 2개 추가 — `AuthService`를 가짜 객체로 만드는 테스트가 있으면 두 메서드를 넣는다. 컨테이너 배선은 [index.md](index.md) §2.3.1.

## 13. S3d — `displayName`은 저장 전용 (R-AUTH-004 🔒 개정)

- 상태: 구현 완료(2026-10-06, server 336/336, SRV-T-261~278) · 설계 승인 ① 반영. **이 절이 §2.3의 `displayName` 용도 설명보다 우선한다.** auth 코드 변경 없음.

비유: 출입증에 적힌 이름은 출석부에 옮겨 적을 때만 쓴다. 무대 자막과 대본에는 쓰지 않는다.

```ts
// server/src/auth — Principal 시그니처 불변
export type Principal = {
  readonly mbId: string
  readonly nick: string
  readonly chName: string | null
  readonly level: number
  /** 저장 이름 = chName 이 비어 있지 않으면 chName, 아니면 nick (R-AUTH-004).
   *  S3d: messages.addUserMessage 가 D1 author_name 에 저장할 때만 쓴다.
   *  응답(authorName 은 db toMessage 가 USER_DISPLAY_NAME 으로 투영)·프롬프트(PromptMessage 에 이름 없음)·로그에는 쓰지 않는다 */
  readonly displayName: string
}
```

| 사용처(Grep `displayName`, 2026-10-06) | 용도 | S3d 뒤 |
|---|---|---|
| `server/src/messages/service.ts` 90행 `authorName: author.displayName` | `NewMessage.authorName` → D1 `author_name` | 그대로(유일한 소비처) |
| 응답 `Message.authorName` | 이전: 저장값 그대로 | 유저 메시지 = 「어떠한 의지」 고정([db.md](db.md) §12) |
| 프롬프트 유저 줄 | 이전: `[유저 {authorName}]` | `[어떠한 의지]`, 이름 입력 없음([llm.md](llm.md) §13.3) |
| 로그 | 원래 미기록 | 그대로 미기록 |

- 실패 코드·검증 순서·레이트리밋·토큰 형식 불변. env·마이그레이션 없음.
- 테스트: auth 쪽 `displayName` 도출 테스트(`ch_name` 우선·빈 값이면 `nick`)는 "저장 두 경우" 수용 기준으로 그대로 유효하다. 응답 고정·D1 실명은 [messages.md](messages.md) §12.7(SRV-T-142 개정)·[db.md](db.md) §12.3(SRV-T-269)이 맡는다.
- 레이트리밋(§2.5): 화면의 전송 1회는 `/user`와 `speak 'auto'` 두 요청이라 같은 분당 버킷에서 2회를 쓴다. 키·한도는 그대로다(기본 20/분 → 전송 최대 10/분). 공유 증명 테스트는 contract의 routes-generate에 요청했다([messages.md](messages.md) §12.7).

| 요구ID | 반영 | 상태 |
|---|---|---|
| R-AUTH-004 🔒 개정 | §13 · [db.md](db.md) §12 | ✅(설계) |

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-06 | S3d(§13): `Principal.displayName`은 D1 `author_name` 저장 전용으로 명시(응답·프롬프트·로그 미사용). 사용처 표, 전송 1회 = 레이트리밋 2회 메모. 코드·시그니처 변경 없음 |
| 2026-10-05 | 신규 작성(S2). 교차 벡터 V1~V8 산출(테스트 SECRET) |
| 2026-10-06 | S3c 설계: §12 주인 판정 — `isOwner`(순수)·`assertOwner`(로그 `owner_denied`·`OWNER_ONLY` 403)·`requireOwner` 미들웨어, `AuthDeps.config.ownerMbIds`(선택, 기본 `[]`), SRV-T-236~238, D-AUTH-15~18 |
| 2026-10-06 | api.md v0.5 대조: §12.2 D1 미접근(N6)·본문 상한 단계, §12.3 `OWNER_ONLY` 문구 확정(§5.8.2), §12.5 SRV-T-237 변형 ⑥(레이트리밋 미소모), §12.6 E16 미들웨어 줄 |
| 2026-10-06 | §12에 구현 완료 표기(server 318/318, SRV-T-234~260). 설계와 다른 점 없음 |
| 2026-10-07 | verify 후속 동기화(소스 기준): §6 `tokenSecret` 32자 이상은 parseEnv 보장([env.md](env.md) D-ENV-13), 시험 SECRET 메모(교차 벡터 불변·HTTP 계층은 긴 SECRET으로 재서명), §12.4 `ownerMbIds` 기본값 의미·머리 주석 [설정]. auth 코드·공개 API 변경 없음 |
| 2026-10-07 | S5 토큰 대조 도구(scripts/token-test.ts) 추가 — 소스 무변경, 테스트 7건 |
