# index(Workers 진입점·공통 기반) 설계

- 상태: 초안 · 최종 갱신: 2026-10-05
- 묶음: S1. `fetch` 진입·Hono 앱 조립·부트스트랩·보안 헤더·공통 에러 핸들러·로거·`/embed` 서빙·health 서비스·`wrangler.toml`을 정한다. `scheduled` 진입은 S2(레이트리밋 정리)·S4(요약) 설계에서 필요할 때 추가한다.
- 라우트(`server/src/routes/`)는 contract 소유다. 이 문서는 **라우트를 정의하지 않고**, 라우트가 쓸 타입·서비스·규약만 정한다.
- 관련 문서: [env.md](env.md), [db.md](db.md), [rooms.md](rooms.md), [messages.md](messages.md).

## 1. 목적

진입점은 건물 정문이다. 모든 방문자는 정문에서 출입 기록(요청 로그)을 남기고, 정문이 건물 규칙(보안 헤더)을 붙이며, 관리실(env)에서 설정을 확인한 뒤 안쪽 사무실(서비스)로 안내된다. 사고가 나면 정문 안내 데스크(에러 핸들러) 한 곳에서만 정해진 양식으로 답한다.

| 요구ID | 내용 |
|---|---|
| R-ENV-001 🔒 | 요청 진입점이 바인딩을 `parseEnv`로 파싱하고 서비스에 값으로 전달 |
| R-ENV-003 | 설정 오류 → 그 요청 `500 CONFIG_INVALID`, 로그엔 키 이름만 |
| R-API-001 🔒 | 엔드포인트 집합 고정. 이 문서는 `/embed`만 직접 처리하고 나머지는 contract 라우트 |
| R-API-002 🔒 | 에러 응답 `{ error: { code, message } }`, 코드는 `shared/src/errors.ts` |
| R-API-005 | `GET /api/health` → `{ ok: true, version }`, DB 접근 없음(서비스 제공) |
| R-API-006 🔒 | `/embed` = Workers Static Assets(`ui/dist`, SPA). 모든 응답에 `Content-Security-Policy: frame-ancestors <ALLOWED_FRAME_ANCESTORS>`, `X-Frame-Options` 미전송 |
| R-API-007 | 라우트가 얇게 유지되도록 서비스·에러 처리를 이쪽에서 제공 |
| R-API-008 🔒 | 경로 문자열은 `shared/src/endpoints.ts` 상수 사용 |
| R-AUTH-006 🔒 · R-NFR-004 🔒 | 로그·응답에 토큰 원문·비밀값 없음(쿼리 `?t=` 미기록, 로거 금지 필드) |
| R-NFR-005 | 요청당 CPU 10ms 안(동기 무거운 연산 없음) |

## 2. 공개 API

### 2.1 Worker 진입 (`server/src/index.ts`)

```ts
import { createApp } from './app'
import { apiRoutes } from './routes'          // contract 소유
import type { Env } from './env'

const app = createApp({ routes: apiRoutes })

export default { fetch: app.fetch } satisfies ExportedHandler<Env>
// S2·S4에서 필요하면 scheduled 를 추가한다: export default { fetch, scheduled }
```

- `export default`는 이 파일에만 허용된다(server-rules). 이 파일은 조립만 하고 로직을 갖지 않는다(10줄 안팎).

### 2.2 앱 조립 (`server/src/app.ts`)

```ts
import type { Hono } from 'hono'
import type { AppEnv } from './services'
import type { LogSink } from './logger'

export type CreateAppOptions = {
  /** contract 의 apiRoutes. 테스트는 시험용 라우트를 넣는다 */
  routes?: Hono<AppEnv>
  /** 로그 출력 대상. 기본은 console(logger.ts 안에서만 console 사용) */
  logSink?: LogSink
  /** 시계. 기본 Date.now. 테스트는 고정값 */
  now?: () => number
}

/** Hono 앱을 만든다: 요청 로그 → 보안 헤더 → 부트스트랩 → /embed → routes, notFound·onError 등록 */
export const createApp = (options?: CreateAppOptions): Hono<AppEnv>

/** CSP frame-ancestors 헤더 값을 만든다. 설정이 없으면 'none' */
export const buildCsp = (frameAncestors?: readonly string[]): string
```

### 2.3 서비스 컨테이너·Hono 타입 (`server/src/services.ts`)

```ts
import type { Config, Env } from './env'
import type { Db } from './db'
import type { Logger } from './logger'
import type { RoomsService } from './rooms'
import type { MessagesService } from './messages'

export type HealthStatus = { ok: true; version: string }

export type ServiceDeps = {
  db: Db
  logger: Logger
  now: () => number
  // S2부터: config: Config — 각 팩토리에 필요한 필드만 골라 넘긴다
}

export type Services = {
  rooms: RoomsService
  messages: MessagesService
  /** DB·외부 호출 없이 상태를 돌려준다 (R-API-005) */
  getHealth: () => HealthStatus
}

/** 라우트(contract)가 쓰는 Hono 타입. c.get('services') 로 서비스에 접근 */
export type AppEnv = {
  Bindings: Env
  Variables: {
    services: Services
    cspFrameAncestors: string
  }
}

export const APP_VERSION: string      // server/package.json 의 version (JSON import)
export const createServices = (deps: ServiceDeps): Services
```

### 2.4 에러 기반 (`server/src/app-error.ts`)

```ts
import type { ErrorCode } from '@shared/errors'     // contract 소유, R-API-002 코드 13종

export type AppErrorStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502

/** 서비스·모듈이 throw 하는 유일한 에러. message 는 사용자에게 그대로 보여도 되는 한국어 한 문장 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: AppErrorStatus
  constructor(code: ErrorCode, status: AppErrorStatus, message: string, options?: { cause?: unknown })
}

export const isAppError = (e: unknown): e is AppError

/** onError·notFound 가 쓰는 응답 본문 생성기 */
export const toErrorBody = (code: ErrorCode, message: string): { error: { code: ErrorCode; message: string } }
```

### 2.5 로거 (`server/src/logger.ts`)

```ts
export type LogLevel = 'info' | 'warn' | 'error'
/** 원시값만 허용 — 객체(Config·env·Error·요청 본문)를 통째로 넘길 수 없게 타입으로 막는다 */
export type LogFields = Readonly<Record<string, string | number | boolean | null | undefined>>
export type Logger = {
  info: (event: string, fields?: LogFields) => void
  warn: (event: string, fields?: LogFields) => void
  error: (event: string, fields?: LogFields) => void
}
export type LogSink = (level: LogLevel, line: string) => void

/** JSON 한 줄 로거. 금지 키는 값을 '[redacted]'로 바꾼다 */
export const createLogger = (sink?: LogSink): Logger
```

### 2.6 함수 표

| 이름 | 인자 | 반환 | 실패 조건(에러 코드) | 요구ID |
|---|---|---|---|---|
| `createApp` | `options?: CreateAppOptions` | `Hono<AppEnv>` | — | R-ENV-001 · R-API-002·006 |
| `buildCsp` | `frameAncestors?: readonly string[]` | `string` | — | R-API-006 |
| `createServices` | `deps: ServiceDeps` | `Services` | — | R-ENV-001(값 주입) |
| `Services.getHealth` | — | `HealthStatus` | 없음(부트스트랩 이후라 설정 오류면 그 전에 `CONFIG_INVALID`) | R-API-005 |
| `AppError` | `code, status, message, options?` | — | — | R-API-002 |
| `isAppError` | `e: unknown` | `boolean` | — | R-API-002 |
| `toErrorBody` | `code, message` | 에러 본문 | — | R-API-002 |
| `createLogger` | `sink?: LogSink` | `Logger` | — | R-AUTH-006 · R-NFR-004 |

## 3. 내부 구조

| 파일 | 책임 | 예상 크기 |
|---|---|---|
| `server/src/index.ts` | Worker `export default` 조립만 | ~10줄 |
| `server/src/app.ts` | `createApp`: 미들웨어 3종, `/embed` 처리, `notFound`, `onError`, `buildCsp` | ~200줄 |
| `server/src/services.ts` | `AppEnv`·`Services` 타입, `createServices`, `APP_VERSION`, `getHealth` | ~50줄 |
| `server/src/app-error.ts` | `AppError`·`isAppError`·`toErrorBody` | ~40줄 |
| `server/src/logger.ts` | `createLogger`, 금지 키 목록, 기본 console 출력(프로젝트에서 `console.*`가 허용되는 유일한 파일) | ~60줄 |
| `server/test/app.test.ts` | SRV-T-080~089 | — |
| `server/test/fixtures/` | 시험용 라우트·가짜 `ASSETS`·로그 수집 sink | — |

- 의존 방향: `index.ts → app.ts → services.ts → {rooms, messages} → db`, 모든 파일 → `app-error.ts`·`logger.ts`. `app-error.ts`·`logger.ts`는 서버 내부 모듈을 import하지 않는다(맨 아래 층).
- `app.ts`와 `services.ts`는 routes를 import하지 않는다. routes는 `index.ts`가 주입한다. 그래서 server 테스트는 contract 코드 없이 돈다.
- 쓰지 않는 Hono 미들웨어: `hono/logger`(console 직접 출력, 형식 불일치), `hono/secure-headers`(기본값이 `X-Frame-Options: SAMEORIGIN`을 붙이고 CSP 값이 생성 시점에 고정됨), `hono/cors`(iframe 동일 출처라 불필요). contract도 이 셋을 추가하지 않는다.

### 3.1 미들웨어 순서와 책임

```
요청 ─▶ ① requestLog ─▶ ② securityHeaders ─▶ ③ bootstrap ─▶ ④ /embed  또는  ⑤ routes(contract)
          │                  │                     │                  │
          │                  │                     │                  └ 매칭 없음 → notFound → 404 NOT_FOUND
          │                  │                     └ throw → onError(③~⑤ 어디서든) → { error } 응답
          │                  └ next() 뒤: CSP 설정 · X-Frame-Options 제거 (에러 응답 포함 전부)
          └ next() 뒤: { method, path(쿼리 제외), status, ms } 기록
```

| 순서 | 이름 | 하는 일 | 실패 시 |
|---|---|---|---|
| ① | `requestLog` | 시작 시각 기록 → `await next()` → `logger.info('request', { method, path: url.pathname, status, ms })`. **쿼리 문자열·헤더는 기록하지 않는다**(`/embed?t=<토큰>`) | — |
| ② | `securityHeaders` | `await next()` 뒤 `c.res.headers.set('Content-Security-Policy', 'frame-ancestors ' + (c.get('cspFrameAncestors') ?? "'none'"))`, `c.res.headers.delete('X-Frame-Options')` | — |
| ③ | `bootstrap` | `config = parseEnv(c.env)` → `c.set('cspFrameAncestors', config.allowedFrameAncestors.join(' '))` → `db = createDb(c.env.DB)` → `c.set('services', createServices({ db, logger, now }))` → `next()` | `ConfigError` throw → onError → 500 `CONFIG_INVALID`. 이때 `cspFrameAncestors`가 없으므로 ②가 `frame-ancestors 'none'`을 붙인다 |
| ④ | `serveEmbed` | §3.2 | 파일 없음 → `AppError('NOT_FOUND', 404, …)` |
| ⑤ | `routes` | contract의 `apiRoutes`를 `app.route('/', routes)`로 마운트 | 라우트·서비스의 `AppError` → onError |

- Hono는 하위 단계에서 throw된 에러를 `onError`로 응답으로 바꾼 뒤 바깥 미들웨어의 `await next()` 다음 줄을 계속 실행한다. 그래서 ①·②는 에러 응답에도 적용된다(SRV-T-080으로 확인).
- `logger`는 설정과 무관하므로 `createApp`에서 한 번 만들어 클로저로 쓴다(요청 상태가 아니라 출력 함수뿐이라 전역 가변 상태가 아니다).
- 서비스 컨테이너는 요청마다 만든다(팩토리 클로저 생성뿐이라 비용 무시 가능, 요청 간 상태 공유 없음).

### 3.2 `/embed` 서빙 (R-API-006)

`[assets] run_worker_first = true`로 모든 요청이 Worker를 먼저 지난다. Worker가 `env.ASSETS`(Workers Static Assets 바인딩)에서 파일을 가져와 헤더를 붙인다.

| 요청 경로 | `ASSETS.fetch`에 넘기는 경로 | 비고 |
|---|---|---|
| `GET /embed`, `GET /embed/` (`?t=` 포함) | `/` | `index.html`. 기본 `html_handling`에서 `/index.html` 요청은 `/`로 307 되므로 `/`를 요청한다. 쿼리는 넘기지 않는다 |
| `GET /embed/<경로>` | `/<경로>` | 빌드 산출물(JS·CSS·폰트·이미지). 쿼리 제거 |
| 그 외(`/`, `/index.html`, `/assets/x.js` 등) | — | `/embed` 밖이므로 routes 또는 404 |

- `ASSETS` 응답이 404면 `AppError('NOT_FOUND', 404, '요청한 주소를 찾을 수 없습니다.')`로 바꿔 에러 형식을 통일한다(R-API-002).
- 정상 응답은 `new Response(res.body, res)`로 **다시 감싸 반환**한다. `fetch`·바인딩이 돌려준 Response의 헤더는 변경 불가라 ②에서 헤더를 못 붙이기 때문이다.
- `/embed` 아래 클라이언트 라우팅은 없다(SPA 단일 화면, "하위 경로 없음"). `/embed/<경로>`는 같은 화면의 정적 파일만 뜻하며 API 엔드포인트가 아니다.
- **ui 쪽 전제**: Vite `base: '/embed/'`로 빌드해야 `index.html`이 `/embed/assets/…`를 참조한다(§9 ui·contract 요구).
- 경로 문자열 `/embed`는 `shared/src/endpoints.ts`의 상수를 import해 쓴다(R-API-008).

### 3.3 로거 규칙 (R-AUTH-006 · R-NFR-004)

- 출력: `JSON.stringify({ level, event, ...fields })` 한 줄. 수집은 `wrangler tail`.
- 레벨 필터 없음(요구된 `LOG_LEVEL` 키가 없다 — [env.md](env.md) §11 제안).
- 금지 키(대소문자 무시, 정확히 일치하면 값을 `'[redacted]'`로 교체): `token`, `authorization`, `secret`, `tokenSecret`, `apiKey`, `llmApiKey`, `payload`, `prompt`, `text`, `summary`, `query`.
- `LogFields`는 원시값만 받으므로 `Config`·`env`·`Error`·요청 본문 객체를 넘기면 컴파일 에러다.
- 허용 식별자: `mbId`(S2), `roomId`, `messageId`, 길이·건수·ms, 에러 `code`·`errName`.
- 예상 못 한 에러는 `errName`과 `errMessage`(앞 300자)만 남긴다. 유저 입력·토큰이 에러 메시지에 실리지 않도록 서비스가 `AppError` 메시지를 고정 문구로 쓴다.

## 4. 비동기·동시성

```
Cloudflare 엣지 ─▶ fetch(request, env, ctx)
                     └ Hono app.fetch
                          ① requestLog ─ ② securityHeaders ─ ③ bootstrap(parseEnv · createDb · createServices)
                                                                   │
                         ┌─────────────────────────────────────────┴──────────────────────┐
                         ▼                                                                ▼
                 ④ /embed: await env.ASSETS.fetch(…)                     ⑤ routes → services → await D1
                         │                                                                │
                         └──────────────▶ 응답(+CSP) ◀────────────────────────────────────┘
                                         (S3~: ctx.waitUntil(runBackground(…)) 로 응답 뒤 요약 — memory 설계)
```

- 모든 핸들러·서비스는 `async`. S1에는 응답 뒤 작업(`waitUntil`)이 없다.
- 요청 간 공유 상태 없음(설정·DB 래퍼·서비스는 요청마다 생성). 인스턴스가 여럿이어도 동작이 같다.
- CPU 예산(R-NFR-005): 요청당 동기 작업은 `parseEnv`(키 10개), 서비스 생성, 최대 101행 매핑, JSON 직렬화뿐이다. D1·ASSETS 대기는 I/O라 CPU 한도에 들어가지 않는다.
- 타임아웃: S1에는 외부 호출이 없다(ASSETS·D1은 플랫폼이 제한). LLM 타임아웃은 S3.

## 5. 에러 타입

### 5.1 onError 변환표 (단일 에러 핸들러)

| 잡힌 에러 | 응답 status | 응답 code | 응답 message | 로그 |
|---|---|---|---|---|
| `ConfigError` | 500 | `CONFIG_INVALID` | `서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요.` | `error` `config_invalid` `{ keys }`(키 이름만) |
| 기타 `AppError` | `err.status` | `err.code` | `err.message` | status ≥ 500이면 `error` `app_error` `{ code }`, 4xx는 요청 로그로 충분 |
| Hono `HTTPException` status 400(본문 JSON 파싱 실패 등) | 400 | `VALIDATION_ERROR` | `요청 형식이 올바르지 않습니다.` | — |
| 그 밖의 모든 에러(`HTTPException` 기타 포함) | 500 | `INTERNAL` | `서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.` | `error` `unhandled_error` `{ errName, errMessage(300자) }` |
| 매칭 없는 경로(`notFound`) | 404 | `NOT_FOUND` | `요청한 주소를 찾을 수 없습니다.` | — |

- 응답 본문은 항상 `toErrorBody(code, message)` = `{ error: { code, message } }`. 스택·SQL·경로·키 이름은 응답에 넣지 않는다.
- 핸들러마다 try/catch로 응답을 만들지 않는다. 라우트·서비스는 throw만 한다.

### 5.2 코드별 HTTP status (R-API-002 13종 — 서버가 쓰는 값, contract `api.md`와 일치해야 함)

| code | status | 처음 쓰는 묶음 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | S1 |
| `NOT_FOUND` | 404 | S1 |
| `CONFIG_INVALID` | 500 | S1 |
| `INTERNAL` | 500 | S1 |
| `TOKEN_REQUIRED` | 401 | S2 |
| `TOKEN_INVALID` | 401 | S2 |
| `LEVEL_TOO_LOW` | 403 | S2 |
| `RATE_LIMITED` | 429 | S2 |
| `SPEAK_IN_PROGRESS` | 409 | S3 |
| `NOT_LAST_MESSAGE` | 409 | S3 |
| `NOT_CHARACTER_MESSAGE` | 400 | S3 |
| `LLM_FAILED` | 502 | S3 |
| `LLM_EMPTY` | 502 | S3 |

- 코드 문자열·타입의 단일 소스는 `shared/src/errors.ts`(contract)다. 서버는 그 `ErrorCode` 타입을 import해 `AppError`에 쓴다.

## 6. 설정(env)

| 읽는 값 | 출처 | 쓰는 곳 |
|---|---|---|
| `Config.allowedFrameAncestors` | `parseEnv` 결과 | ② CSP 헤더 |
| `Env.DB` | 리소스 바인딩 | ③ `createDb` |
| `Env.ASSETS` | 리소스 바인딩 | ④ `/embed` |

- 그 밖의 설정 키는 S1에서 쓰지 않는다. 바인딩 설정 키 직접 접근 없음(R-ENV-001).

### 6.1 `server/wrangler.toml` 전문 초안 (server-implementer가 이 내용으로 생성)

```toml
# 런던_디스패치 Cloudflare Worker 설정
# 설계: doc/200_설계/server/index.md §6.1 · 키 목록 단일 소스: src/env.ts (doc/200_설계/server/env.md §3.1)
# 비밀값(TOKEN_SECRET, LLM_API_KEY)은 여기 적지 않는다. 운영은 `npx wrangler secret put <KEY>`, 로컬은 server/.dev.vars

name = "london-dispatch"
main = "src/index.ts"
compatibility_date = "2026-10-01"          # 구현 시 설치된 wrangler 가 지원하는 날짜 이하로 맞춘다
compatibility_flags = ["nodejs_compat"]

# 비밀 아닌 설정 — 값은 env.ts 기본값과 같다(문자열로 적고 parseEnv 가 숫자로 변환)
[vars]
TOKEN_MIN_LEVEL = "5"
LLM_PROVIDER = "google"
LLM_MODEL = "gemini-2.5-flash"
LLM_TIMEOUT_MS = "60000"
ALLOWED_FRAME_ANCESTORS = "http://london-gossip.my https://london-gossip.my"
RATE_LIMIT_PER_MIN = "20"
CONTEXT_MESSAGES = "40"
MEMORY_SUMMARY_THRESHOLD = "60"

# D1 — 스키마는 migrations/*.sql (doc/200_설계/server/db.md §7)
[[d1_databases]]
binding = "DB"
database_name = "london-dispatch"
database_id = "00000000-0000-0000-0000-000000000000"   # 자리표시. S5에서 `wrangler d1 create london-dispatch` 결과로 교체
migrations_dir = "migrations"

# 정적 화면 — ui 빌드 산출물을 /embed 로 서빙 (R-API-006)
[assets]
directory = "../ui/dist"
binding = "ASSETS"
run_worker_first = true                     # 정적 파일 요청도 Worker 를 거쳐 CSP 헤더를 붙인다
```

- `database_id`는 비밀값이 아니다. 자리표시 값으로도 `--local` 개발·테스트는 된다.
- Cron Trigger(`[triggers] crons`)는 S1에 없다.

## 7. DB 스키마·마이그레이션

없음(스키마는 [db.md](db.md) §7).

## 8. 테스트 계획

`server/test/app.test.ts`. `createApp({ routes: testRoutes, logSink: collect, now: () => 1_700_000_000_000 })`로 앱을 만들고 `app.fetch(new Request('http://test/…'), testEnv, createExecutionContext())`로 부른다. `testEnv`는 `cloudflare:test`의 `env`를 펼친 뒤 필요한 키만 바꾼 객체다. `ASSETS`는 요청 경로를 기록하고 고정 응답을 돌려주는 가짜 Fetcher로 바꾼다(ui 빌드 산출물에 의존하지 않기 위해). `testRoutes`는 시험용 Hono 앱으로, 정상 JSON·`AppError` throw·일반 `Error` throw·`HTTPException(400)` throw·`getHealth` 호출 경로를 가진다.

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| SRV-T-080 | `every_response_has_csp_and_no_x_frame_options` | 200(시험 라우트)·404(notFound)·409(AppError)·200(`/embed`)·500(`CONFIG_INVALID`) 전부 CSP 헤더 존재. 값은 설정이 있으면 `frame-ancestors http://london-gossip.my https://london-gossip.my`, 설정 실패면 `frame-ancestors 'none'`. 가짜 ASSETS가 `X-Frame-Options: DENY`를 붙여도 응답에서 제거됨 | R-API-006 |
| SRV-T-081 | `config_invalid_returns_500_and_logs_key_names_only` | `TOKEN_SECRET` 제거 → 500, 본문 `{ error: { code: 'CONFIG_INVALID', message } }`. `LLM_MODEL: 'SENTINEL/x'` → 로그에 `LLM_MODEL`은 있고 `SENTINEL`은 없음. 본문에 키 이름 없음 | R-ENV-003 · R-NFR-004 |
| SRV-T-082 | `onError_maps_AppError_status_and_body` | 시험 라우트가 `AppError('NOT_FOUND', 404, '방을 찾을 수 없습니다.')` → 404 + 같은 code·message | R-API-002 |
| SRV-T-083 | `onError_hides_unknown_error_details` | `new Error('SENTINEL_DETAIL')` → 500 `INTERNAL`, 본문에 `SENTINEL_DETAIL`·`stack` 없음, 로그 `unhandled_error`에 `errName` 존재 | R-API-002 · R-NFR-004 |
| SRV-T-084 | `http_exception_400_maps_to_VALIDATION_ERROR` | `HTTPException(400)` → 400 `VALIDATION_ERROR` | R-API-002 |
| SRV-T-085 | `notFound_returns_NOT_FOUND_json` | `GET /nope`·`GET /index.html` → 404 `NOT_FOUND` JSON | R-API-001·002 |
| SRV-T-086 | `embed_maps_paths_to_assets_and_drops_query` | `/embed`·`/embed/`·`/embed?t=abc` → ASSETS에 `/` 요청(쿼리 없음), `/embed/assets/a.js` → `/assets/a.js`, ASSETS 404 → 404 `NOT_FOUND` JSON | R-API-006 |
| SRV-T-087 | `getHealth_returns_ok_and_version_without_db` | `createServices`에 모든 메서드가 throw하는 가짜 `Db`를 넣고 `getHealth()` → `{ ok: true, version: APP_VERSION }`, `APP_VERSION`이 빈 문자열 아님 | R-API-005 |
| SRV-T-088 | `logs_never_contain_query_token_or_forbidden_fields` | `GET /embed?t=SENTINEL_TOKEN` → 수집 로그 전체에 `SENTINEL_TOKEN` 없음, `request` 로그 `path === '/embed'`. `logger.info('x', { token: 'S1', text: 'S2', apiKey: 'S3', roomId: 'r' })` → 세 값 `[redacted]`, `roomId` 유지 | R-AUTH-006 · R-NFR-004 |
| SRV-T-089 | `bootstrap_parses_env_on_every_request` | 같은 앱에 `ALLOWED_FRAME_ANCESTORS`가 다른 두 env로 연속 요청 → 각 CSP가 자기 env를 반영(요청 간 캐시 없음) | R-ENV-001 · D-ENV-2 |

- 에러 경로(081·082·083·084·085·086 일부) 수가 정상 경로(080 일부·087·089)보다 많다.
- 라우트별 통합 테스트(`GET /api/rooms` 등)는 contract 몫(`server/test/routes/`).

수동 체크리스트:

- [ ] `npm run build -w ui` 후 `npx wrangler dev --port 3000` → `curl -i http://localhost:3000/embed`가 200, `Content-Security-Policy: frame-ancestors http://london-gossip.my https://london-gossip.my`, `X-Frame-Options` 없음.
- [ ] `curl -i http://localhost:3000/api/health` → `{"ok":true,"version":"…"}` (contract 라우트 생성 후).
- [ ] `curl -i "http://localhost:3000/embed?t=SENTINEL"` 뒤 `wrangler dev` 터미널 로그에 `SENTINEL`이 없음(R-AUTH-006).
- [ ] R-NFR-004 번들 검사: `npx wrangler deploy --dry-run --outdir dist` 산출물과 `ui/dist`에서 `.dev.vars`의 실제 값 문자열 grep 0건(값을 화면·로그에 출력하지 말고 grep 종료 코드로만 판단).
- [ ] 갠홈이 아닌 출처(예: 로컬 HTML 파일)에서 `/embed`를 iframe으로 열면 브라우저가 차단한다.

## 9. contract 요구 명세

### 9.1 라우트가 쓰는 규약

| 항목 | 내용 | 이유 |
|---|---|---|
| 마운트 | `server/src/routes/index.ts`가 `export const apiRoutes = new Hono<AppEnv>()`를 내보내고, 경로는 `shared/src/endpoints.ts` 상수로 **전체 경로**를 등록한다. `index.ts`가 `app.route('/', apiRoutes)`로 붙인다 | 진입점이 미들웨어 순서를 보장 |
| 서비스 접근 | `const { rooms, messages, getHealth } = c.get('services')` | 서비스는 부트스트랩이 요청마다 주입 |
| 타입 import | `import type { AppEnv } from '../services'` | 라우트↔진입점 순환 import 방지 |
| 에러 | 라우트는 응답 JSON을 직접 만들지 않고 throw만 한다. 검증 실패는 `AppError('VALIDATION_ERROR', 400, <한국어>)` throw(`@hono/zod-validator`의 기본 실패 응답은 이 형식이 아니므로 hook에서 throw) | R-API-002 단일 핸들러 |
| 금지 | `/embed` 라우트 정의, `hono/logger`·`hono/secure-headers`·`hono/cors` 추가, `c.env`의 설정 키 읽기 | §3.1·§3.2, R-ENV-001 |
| 헤더 | 라우트는 CSP·`X-Frame-Options`를 다루지 않는다(②가 일괄 처리) | R-API-006 |

### 9.2 노출 서비스 / 엔드포인트 후보

| 서비스 | 엔드포인트 후보 | 입력 | 출력 | 에러 | 토큰 | 레이트리밋 | 이유 |
|---|---|---|---|---|---|---|---|
| `getHealth()` | `GET /api/health` | 없음 | `HealthStatus { ok: true; version: string }` | `CONFIG_INVALID`(부트스트랩) | ✕ | ✕ | R-API-005 |
| (진입점 직접) | `GET /embed`, `GET /embed?t=` | — | `ui/dist/index.html`(+ `/embed/<파일>` 정적 파일) | `NOT_FOUND`, `CONFIG_INVALID` | ✕ | ✕ | R-API-006 |
| `rooms.listRooms()` | `GET /api/rooms` | — | [rooms.md](rooms.md) §9 | | ✕ | ✕ | R-ROOM-001 |
| `messages.listMessages()` | `GET /api/rooms/:id/messages` | — | [messages.md](messages.md) §9 | | ✕ | ✕ | R-MSG-001 |

### 9.3 shared에 필요한 것 (contract 소유, server가 import)

| 파일 | 필요한 export | server 사용처 |
|---|---|---|
| `shared/src/errors.ts` | `ErrorCode` 타입(R-API-002 13종 유니온)과 코드 상수 | `app-error.ts`, 모든 `AppError` 생성 |
| `shared/src/endpoints.ts` | `/embed` 경로 상수(이름은 contract가 정함) | `app.ts` `/embed` 매칭 |

### 9.4 ui 쪽 전제 (ui 설계·`vite.config.ts`)

- Vite `base: '/embed/'`. 정적 파일은 `/embed/` 아래 경로로 참조된다(§3.2).
- 개발 모드는 Vite(5173)가 `/api`를 Worker(3000)로 프록시하므로 CSP는 운영·`wrangler dev`에서만 확인한다.

## 10. 요구 추적표

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-ENV-001 🔒 | §3.1 ③ bootstrap, §6 | SRV-T-089, [env.md](env.md) 리뷰 grep | ✅ |
| R-ENV-003 | §3.1 ③, §5.1 | SRV-T-081 | ✅ |
| R-API-001 🔒 | §3.2(`/embed`만 직접), §9.1 금지 | SRV-T-085·086 | 부분(엔드포인트 4자 대조는 contract) |
| R-API-002 🔒 | §2.4, §5 | SRV-T-081~086 | ✅ |
| R-API-005 | §2.3 `getHealth`, §9.2 | SRV-T-087, 수동 curl | ✅(라우트는 contract) |
| R-API-006 🔒 | §3.1 ②, §3.2, §6.1 `[assets]` | SRV-T-080·086, 수동 curl·iframe | ✅ |
| R-API-007 | §9.1(라우트는 throw·서비스 호출만) | contract 리뷰 | 부분(contract) |
| R-API-008 🔒 | §3.2, §9.3 | 리뷰 grep | 부분(shared 생성 후) |
| R-AUTH-006 🔒 | §3.1 ①, §3.3 | SRV-T-088 | 부분(토큰 처리 자체는 S2 auth) |
| R-NFR-004 🔒 | §3.3, §5.1, §8 번들 검사 | SRV-T-081·083·088, 수동 grep | ✅ |
| R-NFR-005 | §4 CPU 예산 | 수동(`wrangler dev` CPU 시간) | ✅ |

## 11. 설계 결정 노트

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-IDX-1 | `[assets] run_worker_first = true` + Worker가 `ASSETS.fetch`로 서빙 | (a) 기본값(정적 파일은 Worker 없이 응답) (b) `ui/dist/_headers` 파일 (c) `run_worker_first = ["/embed*"]` | (a)는 정적 응답에 CSP를 못 붙인다. (b)는 값이 빌드 시 고정되어 `ALLOWED_FRAME_ANCESTORS` 단일 소스가 깨진다. (c)는 문서만 보호하는데 R-API-006은 "모든 응답"이다. 대가: 정적 파일 요청도 Workers 요청 수(무료 일 10만)에 포함된다. 화면 1회 로드 ≈ 5~10요청으로 추정되어 소규모 커뮤니티에는 여유가 있다 |
| D-IDX-2 | `app.ts`(조립)와 `index.ts`(export만) 분리 | `index.ts` 한 파일 | server 테스트가 contract의 routes 없이 돈다. routes는 `index.ts`에서만 import |
| D-IDX-3 | 부트스트랩을 health·`/embed` 포함 전 요청에 적용 | health는 부트스트랩 제외 | 배포 직후 `/api/health`로 Secrets 누락을 바로 잡는다(R-ENV-003). DB는 건드리지 않으므로 R-API-005 충족 |
| D-IDX-4 | 설정 실패 응답의 CSP = `frame-ancestors 'none'` | CSP 생략 | 설정을 못 읽어도 "모든 응답에 CSP"를 지키고, 안전한 쪽으로 닫는다 |
| D-IDX-5 | 요청 로그·CSP를 자체 미들웨어로 | `hono/logger`·`hono/secure-headers` | secure-headers 기본값이 `X-Frame-Options`를 붙여 R-API-006과 충돌하고 CSP 값이 요청별 설정을 못 따른다. 로그는 주입 로거·쿼리 제외 규칙을 지키기 위해. server-design-strategy §9의 "요청 로그는 Hono `logger()`(routes 소유)" 문구와 다르다 — 스킬 문구 갱신 필요(메인 세션) |
| D-IDX-6 | `onError`·`notFound` 등록은 진입점(server)에서 | `routes/index.ts`(contract)에서 | 부트스트랩 실패·`/embed`·notFound까지 한 핸들러로 덮으려면 최상위 앱에 있어야 한다. server-rules.md "변환은 routes/index.ts의 app.onError" 문구와 다르다 — 스킬 문구 갱신 필요(메인 세션) |
| D-IDX-7 | `AppEnv.Variables`에 `Config`를 넣지 않고 `cspFrameAncestors` 문자열만 | `config` 통째 | 라우트가 `tokenSecret` 등에 닿지 못하게(최소 권한) |
| D-IDX-8 | `APP_VERSION` = `server/package.json`의 `version`(JSON import) | 환경변수·상수 | 요구된 env 키가 없다. 번들에 들어가는 것은 package.json 필드 중 실제 참조한 값뿐(esbuild 트리 셰이킹) |

확인 필요:

- **구현 순서 의존**: `app-error.ts`가 `shared/src/errors.ts`를, `app.ts`가 `shared/src/endpoints.ts`를, `index.ts`가 `server/src/routes/index.ts`를 import한다. server-implementer는 shared·routes를 쓸 수 없다(가드). 권고 순서: ① contract-implementer가 `shared/src/errors.ts`·`endpoints.ts` 생성 → ② server-implementer가 env·db·rooms·messages·app·services·logger·app-error·`index.ts` → ③ contract-implementer가 routes. ②의 vitest는 `app.ts` 기준이라 통과하지만 `tsc --noEmit -p server`는 ③ 뒤에 초록이 된다.
- **`ui/dist` 부재**: `[assets] directory`가 없으면 `wrangler dev`와 vitest pool 기동이 실패할 수 있다. `/dev-start`는 ui 빌드를 먼저 하거나, vitest 설정에서 assets 디렉터리를 테스트용으로 덮어쓰는 방법을 구현 시 확인한다.
- `compatibility_date`는 설치된 wrangler 버전에 맞춰 구현 시 확정한다.

제안(설계 미반영, 사용자 판단):

- `Referrer-Policy: no-referrer` 헤더. `/embed?t=<토큰>` 화면이 외부 리소스(웹폰트 등)를 부를 때 브라우저 기본 정책(`strict-origin-when-cross-origin`)은 이미 쿼리를 보내지 않지만, 명시하면 토큰 유출 경로가 하나 더 닫힌다. R-NFR-004로 역추적 가능하나 요구 문구에 없어 보류.
- CSP에 `frame-ancestors` 외 지시어(`default-src 'self'` 등) 추가. 요구는 frame-ancestors만이다.
- `[observability] enabled = true`(Workers Logs 보관). 지금은 `wrangler tail` 실시간 수집뿐이다.
