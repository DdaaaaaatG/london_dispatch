# index(Workers 진입점·공통 기반) 설계

- 상태: S1 확정(구현 동기화) · S2 초안 · S3 초안(§2.3 컨테이너 델타) · S3b 초안(§2.3 meter 배선·§2.4·§5·§6.1 델타) · S3c 구현 완료(§2.3.1 settings 배선·§3.1.2·§5.3·§6.2) · **S3d 구현 완료(2026-10-06, server 343/343, SRV-T-261~281 · §12 배선 변화 없음)** · verify 후속 동기화(2026-10-07 — `/api/*` 보안 헤더 SEC-003: §3·§3.1 ②·②a·SRV-T-291·D-IDX-14, 의존 방향 보충 §3) · **S4 초안(2026-10-07, §13 `Services.memory` 배선·llm thunk 공유·afterSpeak 연결 · `scheduled` 미도입)** · 최종 갱신: 2026-10-07
- 묶음: S1 = `fetch` 진입·Hono 앱 조립·부트스트랩·보안 헤더·공통 에러 핸들러·로거·`/embed` 서빙·health 서비스·`wrangler.toml`. S2 = 서비스 컨테이너에 `auth`·`config` 주입, `AppEnv.Variables.principal`, 인증 미들웨어의 **라우트 단위** 적용 원칙, `RATE_LIMITED`의 `retryAfterSec` 응답 변환. `scheduled` 진입은 S2에서 **추가하지 않는다**(레이트리밋 정리는 요청 경로에서 — [auth.md](auth.md) D-AUTH-7). S4(요약)에서 필요하면 추가한다.
- 라우트(`server/src/routes/`)는 contract 소유다. 이 문서는 **라우트를 정의하지 않고**, 라우트가 쓸 타입·서비스·규약만 정한다.
- 관련 문서: [env.md](env.md), [db.md](db.md), [auth.md](auth.md), [rooms.md](rooms.md), [messages.md](messages.md).

## 1. 목적

진입점은 건물 정문이다. 모든 방문자는 정문에서 출입 기록(요청 로그)을 남기고, 정문이 건물 규칙(보안 헤더)을 붙이며, 관리실(env)에서 설정을 확인한 뒤 안쪽 사무실(서비스)로 안내된다. 사고가 나면 정문 안내 데스크(에러 핸들러) 한 곳에서만 정해진 양식으로 답한다.

| 요구ID | 내용 |
|---|---|
| R-ENV-001 🔒 | 요청 진입점이 바인딩을 `parseEnv`로 파싱하고 서비스에 값으로 전달 |
| R-ENV-003 | 설정 오류 → 그 요청 `500 CONFIG_INVALID`, 로그엔 키 이름만 |
| R-API-001 🔒 | 엔드포인트 집합 고정. 이 문서는 `/embed`만 직접 처리하고 나머지는 contract 라우트 |
| R-API-002 🔒 | 에러 응답 `{ error: { code, message } }`, 코드는 `shared/src/errors.ts` |
| R-API-005 | `GET /api/health` → `{ ok: true, version }`, DB 접근 없음(서비스 제공) |
| R-API-006 🔒 | `/embed` = Workers Static Assets(`ui/dist`, SPA). 모든 응답에 `Content-Security-Policy: frame-ancestors <ALLOWED_FRAME_ANCESTORS>`, `X-Frame-Options` 미전송. (2026-10-07 SEC-003) `/api/*` JSON 응답은 `frame-ancestors 'none'` — §3.1 ②·D-IDX-14 |
| R-API-007 | 라우트가 얇게 유지되도록 서비스·에러 처리를 이쪽에서 제공 |
| R-API-008 🔒 | 경로 문자열은 `shared/src/endpoints.ts` 상수 사용 |
| R-AUTH-006 🔒 · R-NFR-004 🔒 | 로그·응답에 토큰 원문·비밀값 없음(쿼리 `?t=`·`Authorization` 헤더 미기록, 로거 금지 필드) |
| R-AUTH-003 🔒 (S2) | 인증 미들웨어는 쓰기 라우트에만 — 전역 미들웨어에 넣지 않는다(§3.1) |
| R-AUTH-005 (S2) | `RATE_LIMITED` 응답에 `retryAfterSec`(본문 + `Retry-After` 헤더, §5.1) |
| R-NFR-005 | 요청당 CPU 10ms 안(동기 무거운 연산 없음) |

## 2. 공개 API

### 2.1 Worker 진입 (`server/src/index.ts`)

```ts
import { createApp } from './app'
import { apiRoutes } from './routes'          // contract 소유
import type { Env } from './env'

const app = createApp({ routes: apiRoutes })

export default { fetch: app.fetch } satisfies ExportedHandler<Env>
// S2: 변경 없음(scheduled 불필요). S4에서 필요하면 scheduled 를 추가한다: export default { fetch, scheduled }
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
import type { HealthResponse } from '@shared/types'
import type { AuthService, Principal } from './auth'
import type { Config, Env } from './env'
import type { Db } from './db'
import type { Logger } from './logger'
import type { RoomsService } from './rooms'
import type { MessagesService } from './messages'
import { createLlm, createProvider, type Llm } from './llm'   // S3
import { requireLlmApiKey } from './env'                     // S3

/** 계약 타입 HealthResponse 와 같다 (S1 구현) */
export type HealthStatus = HealthResponse

export type ServiceDeps = {
  db: Db
  logger: Logger
  now: () => number
  /** S2. parseEnv 결과. 각 팩토리에 필요한 필드만 골라 넘긴다(통째로 넘기지 않는다) */
  config: Config
}

export type Services = {
  /** S2. 라우트는 직접 호출하지 않는다 — auth 미들웨어만 쓴다 */
  auth: AuthService
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
    /** S2. requireToken 이 넣는다. 읽기는 getPrincipal(c) 로만 ([auth.md](auth.md) §9.1) */
    principal?: Principal
  }
}

export const APP_VERSION: string      // server/package.json 의 version (JSON import)
export const createServices = (deps: ServiceDeps): Services
```

`createServices` 배선(S2):

```ts
auth:     createAuthService({ db, logger, now, config: { tokenSecret, tokenMinLevel, rateLimitPerMin } })
rooms:    createRoomsService({ db, now })
messages: createMessagesService({ db, now })
getHealth: () => ({ ok: true, version: APP_VERSION })   // config·db 를 쓰지 않는다
```

`createServices` 배선 델타(S3 — [llm.md](llm.md) §3.3, [messages.md](messages.md) §2·§2.3):

```ts
// 요청마다. Llm 을 즉시 만들지 않는다 — speak·regenerate 가 부를 때만 키를 확인한다(R-ENV-003)
const llm = (): Llm =>
  createLlm({
    provider: createProvider({
      provider: config.llmProvider,
      apiKey: requireLlmApiKey(config),   // google + 키 없음 → ConfigError(['LLM_API_KEY']) → 500 CONFIG_INVALID
      model: config.llmModel,
    }),
    timeoutMs: config.llmTimeoutMs,
    logger,
    now,
  })

messages: createMessagesService({ db, now, logger, contextMessages: config.contextMessages, llm })
// afterSpeak 는 S3 에서 넘기지 않는다(no-op). S4 memory 가 채운다
```

- `Services`·`AppEnv` 타입은 바뀌지 않는다(`MessagesService`에 `speak`·`regenerate`가 늘 뿐).
- `Config`는 통째로 넘기지 않는다. messages에는 `contextMessages`만, llm에는 지연 생성 함수 안에서 `llmProvider`·`llmModel`·`llmTimeoutMs`·키만 쓴다.
- 읽기 경로(`/embed`·health·목록·히스토리)는 `llm()`을 부르지 않으므로 `LLM_API_KEY`가 없어도 동작한다(D-LLM-11).
- 파급: `server/src/services.ts`의 `createServices`, `ServiceDeps` 변경 없음.

`createServices` 배선 델타(S3b — [llm.md](llm.md) §12.2·§12.7, [db.md](db.md) §2.4):

```ts
import { createUsageMeter } from './llm'   // S3b

const llm = (): Llm =>
  createLlm({
    provider: createProvider({ /* S3 그대로 */ }),
    timeoutMs: config.llmTimeoutMs,
    logger,
    now,
    meter: createUsageMeter({
      store: db.llmUsage,                    // db LlmUsageRepo — llm UsageStore 포트를 구조적으로 만족
      config: {
        monthlyBudgetKrw: config.llmMonthlyBudgetKrw,
        priceInputUsdPerM: config.llmPriceInputUsdPerM,
        priceOutputUsdPerM: config.llmPriceOutputUsdPerM,
        krwPerUsd: config.krwPerUsd,
      },
      logger,
      now,
    }),
  })
```

- meter는 thunk 안에서 만든다. 읽기 경로는 만들지 않는다(D-LLM-11과 같은 이유, D-IDX-12).
- `Services`·`AppEnv`·`ServiceDeps` 변경 없음. `getHealth`는 사용량·예산을 노출하지 않는다(R-LLM-007 "관리 화면 없음").
- `scheduled` 진입은 추가하지 않는다. 월 해제는 월 키 전환이라 할 작업이 없다.

#### 2.3.1 S3c 델타 — `Services.settings` 배선 (R-SET-001 · R-SET-003)

- **구현 완료(2026-10-06)**: server 318/318 통과 · 라우트 `routes/settings.ts` 등록(contract) · S3c 테스트 SRV-T-234~260.

```ts
import { createSettingsService, type SettingsService } from './settings'   // S3c

export type Services = {
  auth: AuthService
  rooms: RoomsService
  messages: MessagesService
  /** S3c. 캐릭터 설정 GET/PUT(라우트)과 speak·regenerate 의 설정 읽기 */
  settings: SettingsService
  getHealth: () => HealthStatus
}

export const createServices = (deps: ServiceDeps): Services => {
  const settings = createSettingsService({ db: deps.db, logger: deps.logger, now: deps.now })
  return {
    auth: createAuthService({
      db: deps.db,
      logger: deps.logger,
      now: deps.now,
      config: {
        tokenSecret: deps.config.tokenSecret,
        tokenMinLevel: deps.config.tokenMinLevel,
        rateLimitPerMin: deps.config.rateLimitPerMin,
        ownerMbIds: deps.config.ownerMbIds, // S3c
      },
    }),
    rooms: createRoomsService({ db: deps.db, now: deps.now }),
    messages: createMessagesService({
      /* S3·S3b 필드 그대로 */
      loadPromptSettings: settings.loadForPrompt, // S3c — 캐시 없음, 부를 때마다 D1
    }),
    settings,
    getHealth: () => ({ ok: true, version: APP_VERSION }),
  }
}
```

- 본문이 식(`=> ({ … })`)에서 블록으로 바뀐다. `settings` 인스턴스 하나를 라우트와 messages가 같이 쓰기 위해서다.
- `createSettingsService`는 I/O 없는 클로저 생성이라 읽기 경로 비용이 없다.
- `AppEnv`·`ServiceDeps` 변경 없음. `Services`에 키 1개(`settings`)가 는다. `Config`는 여전히 통째로 넘기지 않는다(auth에 `ownerMbIds` 1필드 추가).
- 라우트는 `c.get('services').settings.get()`·`put()`만 쓴다(contract). `loadForPrompt`는 라우트가 부르지 않는다.
- 배선 검증은 [auth.md](auth.md) SRV-T-237(`ownerMbIds` 전달)과 [messages.md](messages.md) SRV-T-256(`loadPromptSettings` 전달)이 한다. 새 index 테스트는 없다.
- 파급: `Services` 객체 키를 단언하는 테스트(SRV-T-087 등)가 있으면 `settings`를 더한다. `Services`를 가짜로 만드는 픽스처가 있으면 `settings` 필드가 필요하다.

### 2.4 에러 기반 (`server/src/app-error.ts`)

```ts
import { ERROR_MESSAGES, ERROR_STATUS, type ErrorCode, type ErrorStatus } from '@shared/errors'  // contract 소유

export type AppErrorStatus = ErrorStatus   // 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502

export type AppErrorOptions = {
  cause?: unknown
  /** S2. RATE_LIMITED 전용. 정수 ≥ 1. onError 가 본문·Retry-After 헤더로 옮긴다 */
  retryAfterSec?: number
}

/** 서비스·모듈이 throw 하는 유일한 에러. status 는 ERROR_STATUS[code], message 기본값은 ERROR_MESSAGES[code] (S1 구현) */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: AppErrorStatus
  /** S2 */
  readonly retryAfterSec?: number
  constructor(code: ErrorCode, message?: string, options?: AppErrorOptions)
}

export const isAppError = (e: unknown): e is AppError

/** onError·notFound 가 쓰는 응답 본문. extra.retryAfterSec 가 있으면 error 안에 싣는다(S2) */
export const toErrorBody = (
  code: ErrorCode,
  message: string,
  extra?: { retryAfterSec?: number },
): { error: { code: ErrorCode; message: string; retryAfterSec?: number } }
```

- S1 문서의 `AppError(code, status, message)`는 구현에서 `AppError(code, message?, options?)`로 바뀌었다(status는 코드 1:1 표 `ERROR_STATUS`에서). 이 문서가 구현을 따른다.
- `retryAfterSec`은 추가 필드라 기존 호출자(전부 `new AppError(code)` 또는 `(code, message)`)에 영향이 없다.
- (S3b) `retryAfterSec` 주석의 적용 코드를 `RATE_LIMITED`·`LLM_BUDGET_EXCEEDED` 둘로 넓힌다(`app-error.ts` 문서주석·필드 주석). onError 변환은 코드 종류를 보지 않으므로 코드 변경 없음(SRV-T-233).

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
| `createServices` | `deps: ServiceDeps`(S2: `config` 추가) | `Services`(S2: `auth` 추가) | — | R-ENV-001(값 주입) · R-AUTH-002·005 |
| `Services.getHealth` | — | `HealthStatus` | 없음(부트스트랩 이후라 설정 오류면 그 전에 `CONFIG_INVALID`) | R-API-005 |
| `AppError` | `code, message?, options?`(S2: `options.retryAfterSec`) | — | — | R-API-002 · R-AUTH-005 |
| `isAppError` | `e: unknown` | `boolean` | — | R-API-002 |
| `toErrorBody` | `code, message, extra?` | 에러 본문 | — | R-API-002 · R-AUTH-005 |
| `createLogger` | `sink?: LogSink` | `Logger` | — | R-AUTH-006 · R-NFR-004 |

## 3. 내부 구조

| 파일 | 책임 | 예상 크기 |
|---|---|---|
| `server/src/index.ts` | Worker `export default` 조립만 | ~10줄 |
| `server/src/app.ts` | `createApp`: 미들웨어 4종(S1 3종 + `/api/*` `secureHeaders`, 2026-10-07), `/embed` 처리, `notFound`, `onError`, `buildCsp` | ~200줄 |
| `server/src/services.ts` | `AppEnv`·`Services` 타입, `createServices`, `APP_VERSION`, `getHealth` | ~50줄 |
| `server/src/app-error.ts` | `AppError`·`isAppError`·`toErrorBody` | ~40줄 |
| `server/src/logger.ts` | `createLogger`, 금지 키 목록, 기본 console 출력(프로젝트에서 `console.*`가 허용되는 유일한 파일) | ~60줄 |
| `server/test/app.test.ts` | SRV-T-080~089 | — |
| `server/test/fixtures/` | 시험용 라우트·가짜 `ASSETS`·로그 수집 sink | — |

- 의존 방향(실물 import 기준 — 2026-10-07 보충, SRV-006): `index.ts → app.ts → services.ts → {auth, rooms, messages, settings, llm, env}`. 서비스 사이는 `messages → {db, llm, auth(타입)}`, `settings → {db, llm, auth(타입)}`, `rooms → db`, `auth → {db(타입), env(타입 Config)}`다. `llm`은 `db`·`messages`·`settings`를 import하지 않는다(`env`는 타입 `LlmProviderName`만). `services.ts`가 `env`의 `requireLlmApiKey`를 값으로 쓰는 것은 llm 지연 생성 때문이다([llm.md](llm.md) §3.3). 모든 파일 → `app-error.ts`·`logger.ts`. `auth/middleware.ts`는 `services.ts`의 `AppEnv`를 `import type`으로만 쓴다(값 순환 없음). `app-error.ts`·`logger.ts`는 서버 내부 모듈을 import하지 않는다(맨 아래 층).
- `app.ts`와 `services.ts`는 routes를 import하지 않는다. routes는 `index.ts`가 주입한다. 그래서 server 테스트는 contract 코드 없이 돈다.
- 쓰지 않는 Hono 미들웨어: `hono/logger`(console 직접 출력, 형식 불일치), `hono/cors`(iframe 동일 출처라 불필요). `hono/secure-headers`는 **`/api/*`에만** 기본값으로 쓴다(2026-10-07 SEC-003, D-IDX-14). 기본값이 붙이는 `X-Frame-Options: SAMEORIGIN`은 바깥의 ② `securityHeaders`가 `next()` 뒤에 지운다. `secureHeaders` 기본값은 CSP를 만들지 않으므로 CSP는 ②가 단독으로 정한다. `/embed`에는 걸지 않는다(정적 자산 응답을 그대로 둔다). contract는 미들웨어를 추가하지 않는다.

### 3.1 미들웨어 순서와 책임

```
요청 ─▶ ① requestLog ─▶ ② securityHeaders ─▶ ③ bootstrap ─▶ ④ /embed  또는  ⑤ routes(contract)
          │                  │                     │                  │
          │                  │                     │                  └ 매칭 없음 → notFound → 404 NOT_FOUND
          │                  │                     └ throw → onError(③~⑤ 어디서든) → { error } 응답
          │                  └ next() 뒤: CSP 설정(/api/* 는 'none') · X-Frame-Options 제거 (에러 응답 포함 전부)
          └ next() 뒤: { method, path(쿼리 제외), status, ms } 기록
```

| 순서 | 이름 | 하는 일 | 실패 시 |
|---|---|---|---|
| ① | `requestLog` | 시작 시각 기록 → `await next()` → `logger.info('request', { method, path: url.pathname, status, ms })`. **쿼리 문자열·헤더는 기록하지 않는다**(`/embed?t=<토큰>`) | — |
| ② | `securityHeaders` | `await next()` 뒤 경로가 `/api/`(`API_PREFIX`)로 시작하면 `buildCsp(undefined)` = `frame-ancestors 'none'`, 아니면 `buildCsp(cspFrameAncestors)`(설정 없으면 `'none'`)를 `Content-Security-Policy`로 `set`하고 `X-Frame-Options`를 지운다(`/api/*` 분기는 2026-10-07 SEC-003) | — |
| ②a | `secureHeaders()` (hono, `app.use('/api/*')` — 2026-10-07 SEC-003) | hono 4 기본 헤더를 붙인다: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, HSTS, `Cross-Origin-Resource-Policy`·`Cross-Origin-Opener-Policy`, `Origin-Agent-Cluster`, `X-DNS-Prefetch-Control`, `X-Download-Options`, `X-Permitted-Cross-Domain-Policies`, `X-XSS-Protection`, `X-Powered-By` 제거. 함께 붙는 `X-Frame-Options`는 ②가 지운다. 등록 순서가 ② 뒤·③ 앞이라 에러 응답(onError·notFound)에도 붙는다 | — |
| ③ | `bootstrap` | `config = parseEnv(c.env)` → `c.set('cspFrameAncestors', config.allowedFrameAncestors.join(' '))` → `db = createDb(c.env.DB)` → `c.set('services', createServices({ db, logger, now, config }))`(S2: `config` 추가) → `next()` | `ConfigError` throw → onError → 500 `CONFIG_INVALID`. 이때 `cspFrameAncestors`가 없으므로 ②가 `frame-ancestors 'none'`을 붙인다 |
| ④ | `serveEmbed` | §3.2 | 파일 없음 → `AppError('NOT_FOUND')` |
| ⑤ | `routes` | contract의 `apiRoutes`를 `app.route('/', routes)`로 마운트. 쓰기 라우트는 안에서 `requireToken → rateLimitWrites → validate → 핸들러`(S2, §3.1.1) | 라우트·미들웨어·서비스의 `AppError` → onError |

#### 3.1.1 인증 미들웨어 위치 (S2, R-AUTH-003)

```
전역(app.use '*'):   ① requestLog → ② securityHeaders → ③ bootstrap          ← 인증 없음
라우트 단위(⑤ 안):   POST/PATCH/DELETE 쓰기 라우트마다
                     requireToken → rateLimitWrites → validate(param/json) → 핸들러
읽기 라우트:          validate → 핸들러                                         ← Authorization 헤더가 있어도 무시
```

- `requireToken`·`rateLimitWrites`는 `server/src/auth/middleware.ts`(server 소유)가 export하고 routes(contract)가 라우트마다 붙인다. 전역·`apiRoutes.use()`로 붙이지 않는다 — 읽기 경로가 토큰 없이 열려야 한다.
- 둘 다 ③ 뒤에 실행되어야 한다(`c.get('services')`가 필요). 라우트 단위라 자동으로 그렇다.
- 인증 실패·레이트리밋 초과도 onError 한 곳에서 응답이 되고 ①·②가 적용된다(CSP 포함).

- Hono는 하위 단계에서 throw된 에러를 `onError`로 응답으로 바꾼 뒤 바깥 미들웨어의 `await next()` 다음 줄을 계속 실행한다. 그래서 ①·②는 에러 응답에도 적용된다(SRV-T-080으로 확인).
- `logger`는 설정과 무관하므로 `createApp`에서 한 번 만들어 클로저로 쓴다(요청 상태가 아니라 출력 함수뿐이라 전역 가변 상태가 아니다).
- 서비스 컨테이너는 요청마다 만든다(팩토리 클로저 생성뿐이라 비용 무시 가능, 요청 간 상태 공유 없음).

#### 3.1.2 S3c 주인 판정 미들웨어 위치 (R-SET-001 · R-AUTH-003 예외)

```
설정 라우트(E15·E16):  requireToken → requireOwner → (PUT만) rateLimitWrites → 본문 상한(SETTINGS_BODY_MAX_BYTES) → validate(settingsIssueMessage) → 핸들러   (api.md §4.16)
```

- `requireOwner`도 `server/src/auth/middleware.ts`가 export하고 routes(contract)가 라우트 단위로 붙인다([auth.md](auth.md) §12). 전역·라우터 단위 금지.
- 설정 GET은 읽기지만 토큰과 주인 판정이 필요하다(R-AUTH-003 S3c 예외). 다른 읽기 라우트는 그대로 토큰 불필요.

### 3.2 `/embed` 서빙 (R-API-006)

`[assets] run_worker_first = true`로 모든 요청이 Worker를 먼저 지난다. Worker가 `env.ASSETS`(Workers Static Assets 바인딩)에서 파일을 가져와 헤더를 붙인다.

| 요청 경로 | `ASSETS.fetch`에 넘기는 경로 | 비고 |
|---|---|---|
| `GET /embed`, `GET /embed/` (`?t=` 포함) | `/` | `index.html`. 기본 `html_handling`에서 `/index.html` 요청은 `/`로 307 되므로 `/`를 요청한다. 쿼리는 넘기지 않는다 |
| `GET /embed/<경로>` | `/<경로>` | 빌드 산출물(JS·CSS·폰트·이미지). 쿼리 제거 |
| 그 외(`/`, `/index.html`, `/assets/x.js` 등) | — | `/embed` 밖이므로 routes 또는 404 |

- `ASSETS` 응답이 404면 `AppError('NOT_FOUND', '요청한 주소를 찾을 수 없습니다.')`로 바꿔 에러 형식을 통일한다(R-API-002).
- 정상 응답은 `new Response(res.body, res)`로 **다시 감싸 반환**한다. `fetch`·바인딩이 돌려준 Response의 헤더는 변경 불가라 ②에서 헤더를 못 붙이기 때문이다.
- `/embed` 아래 클라이언트 라우팅은 없다(SPA 단일 화면, "하위 경로 없음"). `/embed/<경로>`는 같은 화면의 정적 파일만 뜻하며 API 엔드포인트가 아니다.
- **ui 쪽 전제**: Vite `base: '/embed/'`로 빌드해야 `index.html`이 `/embed/assets/…`를 참조한다(§9 ui·contract 요구).
- 경로 문자열 `/embed`는 `shared/src/endpoints.ts`의 상수를 import해 쓴다(R-API-008).

### 3.3 로거 규칙 (R-AUTH-006 · R-NFR-004)

- 출력: `JSON.stringify({ level, event, ...fields })` 한 줄. 수집은 `wrangler tail`.
- 레벨 필터 없음(요구된 `LOG_LEVEL` 키가 없다 — [env.md](env.md) §11 제안).
- 금지 키(대소문자 무시, 정확히 일치하면 값을 `'[redacted]'`로 교체): `token`, `authorization`, `secret`, `tokenSecret`, `apiKey`, `llmApiKey`, `payload`, `prompt`, `text`, `summary`, `query`.
- `LogFields`는 원시값만 받으므로 `Config`·`env`·`Error`·요청 본문 객체를 넘기면 컴파일 에러다.
- 허용 식별자: `mbId`(S2), `roomId`, `messageId`, 길이·건수·ms, 에러 `code`·`errName`, 인증 실패 분류 `reason`(S2).
- `requestLog`는 S2에서도 `Authorization` 헤더를 기록하지 않는다(헤더 전체를 기록하지 않는 S1 규칙 그대로 — SRV-T-162로 고정).
- S2 서비스 로그 이벤트: `auth_rejected { code, reason }`, `rate_limited { mbId }`, `rate_limit_purge_failed { errName }`([auth.md](auth.md) §5). nick·ch_name·본문은 남기지 않는다.
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
| `AppError` + `retryAfterSec`(S2, `RATE_LIMITED`) | 429 | `RATE_LIMITED` | `err.message`. 본문 `error.retryAfterSec = err.retryAfterSec`, 응답 헤더 `Retry-After: <같은 값>` | 위와 같음(로그는 auth 서비스가 `rate_limited`로 남김) |
| `AppError` + `retryAfterSec`(S3b, `LLM_BUDGET_EXCEEDED`) | 429 | `LLM_BUDGET_EXCEEDED` | `err.message`(기본 문구). 본문 `error.retryAfterSec`·헤더 `Retry-After` 규칙은 위 행과 같다 | 원인 로그는 llm `llm_budget_exceeded`([llm.md](llm.md) §6.1) |
| Hono `HTTPException` status 400(본문 JSON 파싱 실패 등) | 400 | `VALIDATION_ERROR` | `요청 형식이 올바르지 않습니다.` | — |
| 그 밖의 모든 에러(`HTTPException` 기타 포함) | 500 | `INTERNAL` | `서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.` | `error` `unhandled_error` `{ errName, errMessage(300자) }` |
| 매칭 없는 경로(`notFound`) | 404 | `NOT_FOUND` | `요청한 주소를 찾을 수 없습니다.` | — |

- 응답 본문은 항상 `toErrorBody(code, message)` = `{ error: { code, message } }`. 스택·SQL·경로·키 이름은 응답에 넣지 않는다.
- 핸들러마다 try/catch로 응답을 만들지 않는다. 라우트·서비스는 throw만 한다.

### 5.2 코드별 HTTP status (R-API-002 14종 — S3b 개정, 이전 13종 — 서버가 쓰는 값, contract `api.md`와 일치해야 함)

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
| `LLM_BUDGET_EXCEEDED` | 429 | S3b |

- 코드 문자열·타입의 단일 소스는 `shared/src/errors.ts`(contract)다. 서버는 그 `ErrorCode` 타입을 import해 `AppError`에 쓴다.

### 5.3 S3c — `OWNER_ONLY` 추가 (R-API-002 15종)

| code | status | 처음 쓰는 묶음 |
|---|---|---|
| `OWNER_ONLY` | 403 | S3c |

- onError 변환은 바뀌지 않는다. `AppError`가 `ERROR_STATUS[code]`로 status를 갖고, 본문은 `toErrorBody`가 만든다. 추가 필드 없음.
- 전제: shared `ErrorCode`·`ERROR_STATUS`·`ERROR_MESSAGES`에 `OWNER_ONLY`가 먼저 들어간다(contract-implementer 4a).

## 6. 설정(env)

| 읽는 값 | 출처 | 쓰는 곳 |
|---|---|---|
| `Config.allowedFrameAncestors` | `parseEnv` 결과 | ② CSP 헤더 |
| `Env.DB` | 리소스 바인딩 | ③ `createDb` |
| `Env.ASSETS` | 리소스 바인딩 | ④ `/embed` |

| `Config.tokenSecret`·`tokenMinLevel`·`rateLimitPerMin` (S2) | `parseEnv` 결과 | ③ `createServices` → `createAuthService`의 `config` 인자([auth.md](auth.md) §6) |

- 그 밖의 설정 키는 S2까지 쓰지 않는다(LLM 키들은 S3, 요약 키들은 S4). 바인딩 설정 키 직접 접근 없음(R-ENV-001). env 모듈은 S2에서 바뀌지 않는다.

### 6.1 `server/wrangler.toml` 전문 초안 (server-implementer가 이 내용으로 생성)

```toml
# 런던_디스패치 Cloudflare Worker 설정
# 설계: doc/200_설계/server/index.md §6.1 · 키 목록 단일 소스: src/env.ts (doc/200_설계/server/env.md §3.1)
# 비밀값(TOKEN_SECRET, LLM_API_KEY)은 여기 적지 않는다. 운영은 `npx wrangler secret put <KEY>`, 로컬은 server/.dev.vars

name = "london-dispatch"
main = "src/index.ts"
compatibility_date = "2026-08-15"          # 설치된 workerd 1.20260815.1 이 지원하는 날짜 이하 (S1 구현 값)
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
LLM_MONTHLY_BUDGET_KRW = "100000"           # S3b 월 AI 비용 상한(원, 추정) — R-LLM-007
LLM_PRICE_INPUT_USD_PER_M = "0.3"           # S3b gemini-2.5-flash 입력 단가(USD/1M 토큰, 배포 전 확인)
LLM_PRICE_OUTPUT_USD_PER_M = "2.5"          # S3b 출력+사고 단가(USD/1M 토큰)
KRW_PER_USD = "1400"                        # S3b 원/달러 환율

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

### 6.2 S3c — `wrangler.toml` 머리 주석 1줄 교체

`OWNER_MB_IDS`는 Secrets 권고라 `[vars]`에 값 줄을 두지 않는다([env.md](env.md) S3c 델타). §6.1 전문과 실제 `server/wrangler.toml`의 3번째 줄만 아래로 바꾼다.

```toml
# 비밀값(TOKEN_SECRET, LLM_API_KEY)과 갠홈 주인 회원 ID 목록(OWNER_MB_IDS, S3c)은 여기 적지 않는다. 운영은 `npx wrangler secret put <KEY>`, 로컬은 server/.dev.vars
```

- 이 줄은 `KEY = 값` 꼴이 아니라 SRV-T-011의 `[vars]` 키 추출에 걸리지 않는다.
- `[[d1_databases]]`·`migrations_dir` 설정은 그대로다. `0003`은 같은 폴더에 들어간다.

## 7. DB 스키마·마이그레이션

없음(스키마는 [db.md](db.md) §7).

## 8. 테스트 계획

`server/test/app.test.ts`. `createApp({ routes: testRoutes, logSink: collect, now: () => 1_700_000_000_000 })`로 앱을 만들고 `app.fetch(new Request('http://test/…'), testEnv, createExecutionContext())`로 부른다. `testEnv`는 `cloudflare:test`의 `env`를 펼친 뒤 필요한 키만 바꾼 객체다. `ASSETS`는 요청 경로를 기록하고 고정 응답을 돌려주는 가짜 Fetcher로 바꾼다(ui 빌드 산출물에 의존하지 않기 위해). `testRoutes`는 시험용 Hono 앱으로, 정상 JSON·`AppError` throw·일반 `Error` throw·`HTTPException(400)` throw·`getHealth` 호출 경로를 가진다.

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| SRV-T-080 | `every_response_has_csp_and_no_x_frame_options` | 200(시험 라우트)·404(notFound)·409(AppError)·200(`/embed`)·500(`CONFIG_INVALID`) 전부 CSP 헤더 존재. 값은 설정이 있으면 `frame-ancestors http://london-gossip.my https://london-gossip.my`, 설정 실패면 `frame-ancestors 'none'`. 가짜 ASSETS가 `X-Frame-Options: DENY`를 붙여도 응답에서 제거됨 | R-API-006 |
| SRV-T-081 | `config_invalid_returns_500_and_logs_key_names_only` | `TOKEN_SECRET` 제거 → 500, 본문 `{ error: { code: 'CONFIG_INVALID', message } }`. `LLM_MODEL: 'SENTINEL/x'` → 로그에 `LLM_MODEL`은 있고 `SENTINEL`은 없음. 본문에 키 이름 없음 | R-ENV-003 · R-NFR-004 |
| SRV-T-082 | `onError_maps_AppError_status_and_body` | 시험 라우트가 `AppError('NOT_FOUND', '방을 찾을 수 없습니다.')` → 404 + 같은 code·message | R-API-002 |
| SRV-T-083 | `onError_hides_unknown_error_details` | `new Error('SENTINEL_DETAIL')` → 500 `INTERNAL`, 본문에 `SENTINEL_DETAIL`·`stack` 없음, 로그 `unhandled_error`에 `errName` 존재 | R-API-002 · R-NFR-004 |
| SRV-T-084 | `http_exception_400_maps_to_VALIDATION_ERROR` | `HTTPException(400)` → 400 `VALIDATION_ERROR` | R-API-002 |
| SRV-T-085 | `notFound_returns_NOT_FOUND_json` | `GET /nope`·`GET /index.html` → 404 `NOT_FOUND` JSON | R-API-001·002 |
| SRV-T-086 | `embed_maps_paths_to_assets_and_drops_query` | `/embed`·`/embed/`·`/embed?t=abc` → ASSETS에 `/` 요청(쿼리 없음), `/embed/assets/a.js` → `/assets/a.js`, ASSETS 404 → 404 `NOT_FOUND` JSON | R-API-006 |
| SRV-T-087 | `getHealth_returns_ok_and_version_without_db` | `createServices`에 모든 메서드가 throw하는 가짜 `Db`를 넣고 `getHealth()` → `{ ok: true, version: APP_VERSION }`, `APP_VERSION`이 빈 문자열 아님 | R-API-005 |
| SRV-T-088 | `logs_never_contain_query_token_or_forbidden_fields` | `GET /embed?t=SENTINEL_TOKEN` → 수집 로그 전체에 `SENTINEL_TOKEN` 없음, `request` 로그 `path === '/embed'`. `logger.info('x', { token: 'S1', text: 'S2', apiKey: 'S3', roomId: 'r' })` → 세 값 `[redacted]`, `roomId` 유지 | R-AUTH-006 · R-NFR-004 |
| SRV-T-089 | `bootstrap_parses_env_on_every_request` | 같은 앱에 `ALLOWED_FRAME_ANCESTORS`가 다른 두 env로 연속 요청 → 각 CSP가 자기 env를 반영(요청 간 캐시 없음) | R-ENV-001 · D-ENV-2 |
| SRV-T-160 | `onError_adds_retryAfterSec_body_and_header` (S2) | 시험 라우트가 `AppError('RATE_LIMITED', undefined, { retryAfterSec: 45 })` → 429, 본문 `{ error: { code: 'RATE_LIMITED', message, retryAfterSec: 45 } }`, 헤더 `Retry-After: 45`, CSP 있음. `retryAfterSec` 없는 `AppError`의 본문에는 키가 없다 | R-AUTH-005 · R-API-002 |
| SRV-T-161 | `createServices_wires_auth_with_config_without_exposing_secret` (S2) | `createServices({ db: trap, logger, now, config })` → `services.auth` 존재, `getHealth()`는 DB 호출 0회. `JSON.stringify(services)`·`Object.keys(services.auth)`에 `tokenSecret` 값 없음 | R-ENV-001 · R-AUTH-006 |
| SRV-T-162 | `request_log_never_contains_authorization_header` (S2) | `Authorization: Bearer SENTINEL_BEARER`로 읽기·쓰기 시험 라우트 요청 → 수집 로그 전체에 `SENTINEL_BEARER` 없음 | R-AUTH-006 · R-NFR-004 |
| SRV-T-233 | `onError_maps_LLM_BUDGET_EXCEEDED_to_429_with_retry_after` (S3b) | 시험 라우트가 `AppError('LLM_BUDGET_EXCEEDED', undefined, { retryAfterSec: 2678400 })` → 429, 본문 `{ error: { code: 'LLM_BUDGET_EXCEEDED', message: <요구 원문>, retryAfterSec: 2678400 } }`, 헤더 `Retry-After: 2678400`, CSP 있음. shared 14종 추가 뒤 실행 | R-LLM-007 · R-API-002 |
| SRV-T-291 | `api_responses_deny_framing_and_set_secure_headers_but_embed_keeps_ancestors` (verify 후속 SEC-003) | 시험 라우트 `/api/t/ok` 200 · `/api/t/conflict` 409(`AppError`) · `/api/nope` 404(notFound) → 셋 다 CSP `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options` 없음. `/embed` → CSP `frame-ancestors <허용 출처>`, `Referrer-Policy` 없음 | R-API-006 |

- 에러 경로(081·082·083·084·085·086 일부) 수가 정상 경로(080 일부·087·089)보다 많다.
- 라우트별 통합 테스트(`GET /api/rooms` 등)는 contract 몫(`server/test/routes/`).

수동 체크리스트:

- [ ] `npm run build -w ui` 후 `npx wrangler dev --port 3000` → `curl -i http://localhost:3000/embed`가 200, `Content-Security-Policy: frame-ancestors http://london-gossip.my https://london-gossip.my`, `X-Frame-Options` 없음.
- [ ] 같은 상태에서 `curl -i http://localhost:3000/api/health` → `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options` 없음(SEC-003).
- [ ] `curl -i http://localhost:3000/api/health` → `{"ok":true,"version":"…"}` (contract 라우트 생성 후).
- [ ] `curl -i "http://localhost:3000/embed?t=SENTINEL"` 뒤 `wrangler dev` 터미널 로그에 `SENTINEL`이 없음(R-AUTH-006).
- [ ] R-NFR-004 번들 검사: `npx wrangler deploy --dry-run --outdir dist` 산출물과 `ui/dist`에서 `.dev.vars`의 실제 값 문자열 grep 0건(값을 화면·로그에 출력하지 말고 grep 종료 코드로만 판단).
- [ ] 갠홈이 아닌 출처(예: 로컬 HTML 파일)에서 `/embed`를 iframe으로 열면 브라우저가 차단한다.

## 9. contract 요구 명세

### 9.1 라우트가 쓰는 규약

| 항목 | 내용 | 이유 |
|---|---|---|
| 마운트 | `server/src/routes/index.ts`가 `export const apiRoutes = new Hono<AppEnv>()`를 내보내고, 경로는 `shared/src/endpoints.ts` 상수로 **전체 경로**를 등록한다. `index.ts`가 `app.route('/', apiRoutes)`로 붙인다 | 진입점이 미들웨어 순서를 보장 |
| 서비스 접근 | `const { rooms, messages, getHealth } = c.get('services')`. `services.auth`는 라우트가 직접 부르지 않는다(S2) | 서비스는 부트스트랩이 요청마다 주입 |
| 타입 import | `import type { AppEnv } from '../services'` | 라우트↔진입점 순환 import 방지 |
| 에러 | 라우트는 응답 JSON을 직접 만들지 않고 throw만 한다. 검증 실패는 `AppError('VALIDATION_ERROR')` throw(`@hono/zod-validator`의 기본 실패 응답은 이 형식이 아니므로 hook에서 throw — S1 `routes/validate.ts` 구현) | R-API-002 단일 핸들러 |
| 인증(S2) | 쓰기 라우트마다 `requireToken, rateLimitWrites`를 `validate`보다 앞에 붙인다. principal은 `getPrincipal(c)`로만 읽는다. 전역·`apiRoutes.use()` 적용 금지(§3.1.1, [auth.md](auth.md) §9.1) | R-AUTH-003·005 |
| 금지 | `/embed` 라우트 정의, `hono/logger`·`hono/secure-headers`·`hono/cors` 추가, `c.env`의 설정 키 읽기, `Authorization` 헤더 직접 파싱(S2) | §3.1·§3.2, R-ENV-001, R-AUTH-003 |
| 헤더 | 라우트는 CSP·`X-Frame-Options`·`Retry-After`·보안 기본 헤더를 다루지 않는다(②·②a `secureHeaders`·onError가 일괄 처리). `/api/*` 응답은 어떤 출처의 iframe에도 넣을 수 없다(`frame-ancestors 'none'`, 2026-10-07). 화면은 `/embed` 문서 안에서 `fetch`로만 부른다 | R-API-006 · R-AUTH-005 |

### 9.2 노출 서비스 / 엔드포인트 후보

| 서비스 | 엔드포인트 후보 | 입력 | 출력 | 에러 | 토큰 | 레이트리밋 | 이유 |
|---|---|---|---|---|---|---|---|
| `getHealth()` | `GET /api/health` | 없음 | `HealthStatus { ok: true; version: string }` | `CONFIG_INVALID`(부트스트랩) | ✕ | ✕ | R-API-005 |
| (진입점 직접) | `GET /embed`, `GET /embed?t=` | — | `ui/dist/index.html`(+ `/embed/<파일>` 정적 파일) | `NOT_FOUND`, `CONFIG_INVALID` | ✕ | ✕ | R-API-006 |
| `rooms.listRooms()` | `GET /api/rooms` | — | [rooms.md](rooms.md) §9 | | ✕ | ✕ | R-ROOM-001 |
| `messages.listMessages()` | `GET /api/rooms/:id/messages` | — | [messages.md](messages.md) §9 | | ✕ | ✕ | R-MSG-001 |
| `rooms.createRoom()` · `renameRoom()` · `deleteRoom()` (S2) | `POST /api/rooms` · `PATCH`·`DELETE /api/rooms/:id` | — | [rooms.md](rooms.md) §9 | | ○ | ○ | R-ROOM-002~004 |
| `messages.addUserMessage()` · `editMessage()` · `deleteMessage()` (S2) | `POST /api/rooms/:id/user` · `PATCH`·`DELETE /api/messages/:id` | — | [messages.md](messages.md) §9 | | ○ | ○ | R-MSG-002·004·005 |
| `requireToken` · `rateLimitWrites` · `getPrincipal` (S2) | 위 쓰기 6개 | — | [auth.md](auth.md) §9 | | — | — | R-AUTH-003·005 |

### 9.3 shared에 필요한 것 (contract 소유, server가 import)

| 파일 | 필요한 export | server 사용처 |
|---|---|---|
| `shared/src/errors.ts` | `ErrorCode`·`ERROR_STATUS`·`ERROR_MESSAGES`(S1 구현됨) | `app-error.ts`, 모든 `AppError` 생성 |
| `shared/src/endpoints.ts` | `PATHS.embed`(S1). S2: 쓰기 경로 패턴(`/api/rooms/:id`, `/api/rooms/:id/user`, `/api/messages/:id` — 키 이름은 contract) | `app.ts`(embed), routes(쓰기) |
| `shared/src/types.ts` (S2) | `ApiErrorBody.error`에 `retryAfterSec?: number` 추가(비파괴). 위치·이름을 contract가 다르게 정하면 server `toErrorBody`를 맞춘다 | `app-error.ts` `toErrorBody` 반환 타입과 대조 |

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
| R-API-006 🔒 | §3.1 ②·②a, §3.2, §6.1 `[assets]` | SRV-T-080·086·291, 수동 curl·iframe | ✅(`/api/*` 'none'은 D-IDX-14 — §11 확인 필요) |
| R-API-007 | §9.1(라우트는 throw·서비스 호출만) | contract 리뷰 | 부분(contract) |
| R-API-008 🔒 | §3.2, §9.3 | 리뷰 grep | 부분(shared 생성 후) |
| R-AUTH-006 🔒 | §3.1 ①, §3.3 | SRV-T-088·161·162, [auth.md](auth.md) SRV-T-120 | ✅ |
| R-AUTH-003 🔒 (S2) | §3.1.1, §9.1 인증 | [auth.md](auth.md) SRV-T-116·119, contract 전건 대조 | ✅(전건 적용은 contract 테스트) |
| R-AUTH-005 (S2) | §2.4 `retryAfterSec`, §5.1 | SRV-T-160, [auth.md](auth.md) SRV-T-118 | ✅ |
| R-LLM-007 🔒 (S3b) | §2.3 meter 배선, §2.4, §5.1·§5.2, §6.1 `[vars]` | SRV-T-233, [llm.md](llm.md) SRV-T-210~222 | ✅(설계) |
| R-API-002 🔒 (S3b 14종) | §5.2 | SRV-T-233 | 부분(shared 추가는 contract) |
| R-NFR-004 🔒 | §3.3, §5.1, §8 번들 검사 | SRV-T-081·083·088·162, 수동 grep | ✅ |
| R-NFR-005 | §4 CPU 예산 | 수동(`wrangler dev` CPU 시간) | ✅ |

### 10.1 S3c 추적

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-SET-001 🔒 (배선) | §2.3.1(`ownerMbIds` 전달)·§3.1.2 | [auth.md](auth.md) SRV-T-237 | ✅(설계) |
| R-SET-003 🔒 (배선) | §2.3.1(`loadPromptSettings` 전달) | [messages.md](messages.md) SRV-T-256 | ✅(설계) |
| R-API-002 🔒 (S3c 15종) | §5.3 | contract 테스트(shared 개수 단언 15) | 부분(shared 추가는 contract) |
| R-ENV-002 🔒 (S3c) | §6.2 | SRV-T-011 | ✅(설계) |

## 11. 설계 결정 노트

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-IDX-1 | `[assets] run_worker_first = true` + Worker가 `ASSETS.fetch`로 서빙 | (a) 기본값(정적 파일은 Worker 없이 응답) (b) `ui/dist/_headers` 파일 (c) `run_worker_first = ["/embed*"]` | (a)는 정적 응답에 CSP를 못 붙인다. (b)는 값이 빌드 시 고정되어 `ALLOWED_FRAME_ANCESTORS` 단일 소스가 깨진다. (c)는 문서만 보호하는데 R-API-006은 "모든 응답"이다. 대가: 정적 파일 요청도 Workers 요청 수(무료 일 10만)에 포함된다. 화면 1회 로드 ≈ 5~10요청으로 추정되어 소규모 커뮤니티에는 여유가 있다 |
| D-IDX-2 | `app.ts`(조립)와 `index.ts`(export만) 분리 | `index.ts` 한 파일 | server 테스트가 contract의 routes 없이 돈다. routes는 `index.ts`에서만 import |
| D-IDX-3 | 부트스트랩을 health·`/embed` 포함 전 요청에 적용 | health는 부트스트랩 제외 | 배포 직후 `/api/health`로 Secrets 누락을 바로 잡는다(R-ENV-003). DB는 건드리지 않으므로 R-API-005 충족 |
| D-IDX-4 | 설정 실패 응답의 CSP = `frame-ancestors 'none'` | CSP 생략 | 설정을 못 읽어도 "모든 응답에 CSP"를 지키고, 안전한 쪽으로 닫는다 |
| D-IDX-5 | 요청 로그·CSP를 자체 미들웨어로 | `hono/logger`·`hono/secure-headers` | secure-headers 기본값이 `X-Frame-Options`를 붙여 R-API-006과 충돌하고 CSP 값이 요청별 설정을 못 따른다. 로그는 주입 로거·쿼리 제외 규칙을 지키기 위해. server-design-strategy §9의 "요청 로그는 Hono `logger()`(routes 소유)" 문구와 다르다 — 스킬 문구 갱신 필요(메인 세션). (2026-10-07) `/api/*`에 한해 `secureHeaders()`를 더했다. CSP는 여전히 ②가 정하고 `X-Frame-Options`는 ②가 지운다(D-IDX-14) |
| D-IDX-6 | `onError`·`notFound` 등록은 진입점(server)에서 | `routes/index.ts`(contract)에서 | 부트스트랩 실패·`/embed`·notFound까지 한 핸들러로 덮으려면 최상위 앱에 있어야 한다. server-rules.md "변환은 routes/index.ts의 app.onError" 문구와 다르다 — 스킬 문구 갱신 필요(메인 세션) |
| D-IDX-7 | `AppEnv.Variables`에 `Config`를 넣지 않고 `cspFrameAncestors` 문자열만 | `config` 통째 | 라우트가 `tokenSecret` 등에 닿지 못하게(최소 권한) |
| D-IDX-8 | `APP_VERSION` = `server/package.json`의 `version`(JSON import) | 환경변수·상수 | 요구된 env 키가 없다. 번들에 들어가는 것은 package.json 필드 중 실제 참조한 값뿐(esbuild 트리 셰이킹) |
| D-IDX-9 (S2) | 인증 미들웨어는 라우트 단위, 전역 아님 | 전역 미들웨어에서 메서드로 분기 | 읽기 경로는 토큰 없이 열려야 하고(R-AUTH-003), 경로·메서드 분기를 진입점에 두면 라우트 표와 이중 관리가 된다. 누락은 `getPrincipal` 닫힌 실패 + contract 전건 대조 테스트로 잡는다 |
| D-IDX-10 (S2) | `ServiceDeps.config`로 `Config`를 받고 팩토리마다 필요한 필드만 전달 | 각 값을 `ServiceDeps`에 펼침 | `bootstrap`이 한 줄로 유지된다. `Config`는 컨테이너 생성 함수 안에서만 보이고 `Services`·`Variables`에는 실리지 않는다(D-IDX-7 유지, SRV-T-161) |
| D-IDX-11 (S2) | `retryAfterSec`을 `AppError` 선택 필드로, onError가 본문·`Retry-After` 헤더로 변환 | 레이트리밋 전용 에러 클래스 + 미들웨어가 직접 응답 | 응답 생성은 onError 한 곳(D-IDX-6)이라는 원칙을 지킨다. 필드 하나 추가라 기존 호출자 영향 없음 |
| D-IDX-12 (S3b) | 사용량 meter를 llm 지연 생성 thunk 안에서 만들어 `createLlm`에 주입 | `Services`에 `usage` 서비스 노출 / `ServiceDeps`에 meter | 쓰는 곳이 llm뿐이다. 라우트가 사용량을 볼 요구가 없다(관리 화면·health 노출 없음). 읽기 경로 비용 0 |
| D-IDX-14 (verify 후속 SEC-003) | `/api/*` 응답은 CSP `frame-ancestors 'none'` + hono `secureHeaders()` 기본값. `/embed`·그 밖은 기존(허용 출처 CSP, 추가 헤더 없음) | 모든 응답에 같은 허용 출처 CSP(S1) · 전 경로 `secureHeaders` | JSON API는 iframe에 넣을 이유가 없어 허용 출처까지 막아도 화면 동작이 같다(화면은 `/embed` 안에서 `fetch`). `/embed`는 정적 자산 응답을 그대로 둬 기존 헤더 계약(SRV-T-080·086)을 바꾸지 않는다. 판정은 경로 접두 상수 `API_PREFIX = '/api/'` 하나 |

확인 필요:

- **R-API-006 문구와 `/api/*` CSP(2026-10-07).** 요구 원문은 "모든 응답에 `frame-ancestors <ALLOWED_FRAME_ANCESTORS>`"다. SEC-003 이후 `/api/*`는 `'none'`이라 문자 그대로는 어긋난다(설정 실패 응답의 `'none'`도 이미 같은 예외 — D-IDX-4). 갠홈 밖 삽입을 막는 취지는 더 강하게 지켜진다. 요구 문구를 "`/embed`는 허용 출처, 그 밖은 `'none'`"으로 고칠지 메인 세션 판단.
- **S2 구현 순서 의존**: contract의 쓰기 라우트가 `server/src/auth`(미들웨어)·서비스 S2 함수를 import한다. 권고 순서: ① server-implementer가 db·auth·rooms·messages·services·app-error·app(onError) S2 → ② contract-implementer가 `shared`(경로·`retryAfterSec`)·routes. ①의 vitest는 시험 라우트 기준이라 contract 없이 돈다. 단, `app-error.ts` `toErrorBody`의 반환 타입을 `shared` `ApiErrorBody`에 맞추는 대조는 ② 뒤에 한다.
- **`ui/dist` 부재**: `[assets] directory`가 없으면 `wrangler dev`와 vitest pool 기동이 실패할 수 있다(S1에서 확인된 상태 유지).
- (해결) `compatibility_date`는 S1 구현에서 `2026-08-15`(workerd 1.20260815.1 지원 범위)로 정해졌다. §6.1 초안의 `2026-10-01`보다 실물이 기준이다.

### 11.1 S3c 결정

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-IDX-13 | `settings` 서비스를 컨테이너에서 한 번 만들고 messages에 `loadForPrompt` 함수 값을 넘긴다 | messages가 settings를 직접 생성 | 의존 방향 유지(messages는 settings를 모른다). 한 요청 안에서 라우트와 speak가 같은 인스턴스를 쓴다 |

## 12. S3d — 배선 변화 없음 (R-MSG-009 · R-LLM-008 · R-NFR-001 🔒 개정)

- 상태: 구현 완료(2026-10-06, server 343/343, SRV-T-261~281) · 설계 승인 ① 반영. 결론: **`services.ts`·`app.ts`·`index.ts`·`wrangler.toml`·onError 변환표는 바뀌지 않는다.**

비유: 새 배우를 들이는 게 아니라 무대 감독(speak)이 쪽지 한 장(선택 호출)을 더 쓰는 일이라, 극장 배선(컨테이너)은 그대로다.

```ts
// server/src/services.ts — 변경 없음(확인용)
// createLlm({ provider, timeoutMs: config.llmTimeoutMs, logger, now, meter }) 그대로.
// Llm.selectSpeaker 는 같은 provider·meter·logger·now·timeoutMs 를 쓴다(llm.md §13.6).
// messages 의 GenerateDeps(db, now, logger, contextMessages, llm, afterSpeak?, loadPromptSettings?) 그대로.
```

| 항목 | S3d 영향 |
|---|---|
| `Services` 타입·`createServices` | 없음. 새 deps·새 서비스 없음 |
| env 키(`parseEnv`) | 없음. 선택 상수 8초·12개는 llm 코드 상수 |
| 라우트 등록 | 없음. contract가 `routes/schemas.ts`의 `speakBody.character`에 `'auto'`만 더한다 |
| onError·코드별 status(§5.2·§5.3) | 없음. 새 에러 코드 0 |
| 70초 종결(R-NFR-001 🔒) | 유지. 선택 8초 + 발화가 LLM 단계 66초를 나눠 쓴다([llm.md](llm.md) §13.7). D1 여유 4초 가정 그대로 |
| 로그 키(§3.3 규칙 적용) | 추가: `speaker_select`(info, llm — `provider·result·reason·httpStatus?·outChars?·ms`), `speaker_select_fallback`(warn, messages — `roomId·reason`). `speak_done`은 `'auto'`일 때만 `auto·selected` 필드 추가. 본문·이름·모델 원문 미기록(R-NFR-004) |
| 로그 — 이름 지목(R-LLM-008 ①) | `speaker_select{provider, result:'mention', character, ms:0}`(info, reason·outChars 없음) · `speak_done{…, auto: true, selected: 'mention'}` · 지목이면 `speaker_select_fallback`(warn)은 남지 않는다 |
| 마이그레이션 | 없음. 배포는 `wrangler deploy` 1회 |

- 테스트: 컨테이너 배선 테스트(SRV-T-256 배선 케이스 등)는 무수정. `'auto'` 경로는 [messages.md](messages.md) §12.7·[llm.md](llm.md) §13.9가 맡는다.

| 요구ID | 반영 | 상태 |
|---|---|---|
| R-NFR-001 🔒 개정 | §12 표 · [llm.md](llm.md) §13.7 | ✅(설계) |
| R-MSG-009 · R-LLM-008 | 배선 불변 확인 | ✅(설계) |

## 13. S4 — memory 배선 · `scheduled` 미도입 (R-MEM-001 🔒 · R-MEM-002 🔒 · R-MEM-003)

- 상태: 초안(2026-10-07). 결론: **컨테이너에 `memory` 서비스 1개가 늘고 messages의 `afterSpeak`가 그것을 부른다. `index.ts`·`app.ts`·`wrangler.toml`·onError 변환표는 바뀌지 않는다.** Cron(`scheduled`)은 도입하지 않는다([memory.md](memory.md) D-MEM-3).

비유: 극장(컨테이너)에 기록 담당(memory)을 한 명 들이고, 무대 감독(messages)의 퇴장 쪽지 수신인으로 적어 둔다. 극장 출입문(index.ts)과 야간 경비 일정표(Cron)는 그대로다.

### 13.1 `server/src/services.ts` 델타

```ts
import { createMemoryService, type MemoryService } from './memory'
import { createLlm, createProvider, createUsageMeter, type Llm } from './llm'

export type Services = {
  auth: AuthService
  rooms: RoomsService
  messages: MessagesService
  settings: SettingsService
  /** S4. 장기기억 GET/PUT(라우트 E13·E14)과 speak 뒤 자동 요약 */
  memory: MemoryService
  getHealth: () => HealthStatus
}

export const createServices = (deps: ServiceDeps): Services => {
  const settings = createSettingsService({ db: deps.db, logger: deps.logger, now: deps.now })
  // S4: messages·memory 가 같은 지연 생성 함수를 쓴다(부를 때마다 새 Llm — 상태 없음). 본문은 기존 thunk 그대로 옮긴다
  const llm = (): Llm =>
    createLlm({
      provider: createProvider({
        provider: deps.config.llmProvider,
        apiKey: requireLlmApiKey(deps.config),
        model: deps.config.llmModel,
      }),
      timeoutMs: deps.config.llmTimeoutMs,
      logger: deps.logger,
      now: deps.now,
      meter: createUsageMeter({ store: deps.db.llmUsage, config: { /* 기존 4필드 */ }, logger: deps.logger, now: deps.now }),
    })
  const memory = createMemoryService({
    db: deps.db,
    now: deps.now,
    logger: deps.logger,
    contextMessages: deps.config.contextMessages,
    summaryThreshold: deps.config.memorySummaryThreshold,
    llm,
  })
  return {
    auth: createAuthService({ /* 기존 그대로 */ }),
    rooms: createRoomsService({ db: deps.db, now: deps.now }),
    messages: createMessagesService({
      db: deps.db,
      now: deps.now,
      logger: deps.logger,
      contextMessages: deps.config.contextMessages,
      loadPromptSettings: settings.loadForPrompt,
      llm,
      // S4: speak 성공 뒤 waitUntil 로 실행(messages.md §13). messages 는 memory 를 import 하지 않는다
      afterSpeak: async ({ roomId }) => {
        await memory.summarizeIfNeeded(roomId)
      },
    }),
    settings,
    memory,
    getHealth: () => ({ ok: true, version: APP_VERSION }),
  }
}
```

- `Config.memorySummaryThreshold`를 처음 소비한다(키·검증은 S1부터 있음 — [env.md](env.md) 변경 없음).
- 팩토리는 생성 시 `db`에 손대지 않는다(SRV-T-087 `trap` 통과 유지). `llm`은 부를 때만 키를 확인한다(R-ENV-003 그대로).

### 13.2 진입점·설정·라우트

| 항목 | S4 영향 |
|---|---|
| `server/src/index.ts` | 없음. `export default { fetch: app.fetch }` 그대로 — **`scheduled` export 없음** |
| `server/wrangler.toml` | 없음. `[triggers] crons` 없음. `[vars]`의 `CONTEXT_MESSAGES`·`MEMORY_SUMMARY_THRESHOLD`는 이미 있음 |
| `server/src/app.ts`·onError(§5) | 없음. 새 에러 코드 0(15종 유지) |
| 라우트 등록(contract) | E13 `GET /api/rooms/:id/memory`(`requireToken`) · E14 `PUT`(`requireToken` → `rateLimitWrites`) 추가 — [memory.md](memory.md) 「contract 인계」 |
| 로그 키 | 추가: `memory_summarized`·`memory_summary_skipped`·`memory_summary_conflict`(info), `memory_summary_failed`(warn) — [memory.md](memory.md) §5.1. `after_speak_schedule_failed`(warn) — [messages.md](messages.md) §13.2. 본문·요약 미기록(R-NFR-004) |
| 마이그레이션 | 없음. 배포는 `wrangler deploy` 1회 |

### 13.3 테스트 (`server/test/app.test.ts`에 추가)

| ID | 조건 | 기대 |
|---|---|---|
| SRV-T-327 | ① `createServices({ db: trap, … })` ② 실제 D1 + `parseEnv`(`LLM_PROVIDER=fake`) + 메시지 60개인 방, `services.messages.speak(roomId, { character: 'ciel' }, { waitUntil: t => tasks.push(t) })` 후 `await Promise.all(tasks)` | ① `services.memory`의 `get`·`put`·`summarizeIfNeeded`가 함수이고 생성 시 `db` 미접촉 ② `tasks` 1개, memory 행 생성(`source_until_id` = 21번째 메시지 id, `summary` = Fake 출력), speak 반환값은 훅 결과와 무관 |

### 13.4 요구 추적

| 요구ID | 반영 | 테스트 | 상태 |
|---|---|---|---|
| R-MEM-001 🔒 | §13.1 `Services.memory` · §13.2 라우트 행 | SRV-T-327 ① · contract | ✅(설계) |
| R-MEM-002 🔒 | §13.1 `afterSpeak` 연결 | SRV-T-327 ② | ✅(설계) |
| R-MEM-003 | §13.2 `scheduled` 미도입 | 설계 기록 | ✅(결정 기록) |

### 13.5 설계 결정

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-IDX-15 | `scheduled`·`[triggers]`를 S4에서 만들지 않는다 | 미리 빈 `scheduled` 핸들러 | 요구ID로 역추적되는 동작이 없다(스킬 §11). 전환 기준·설계 요지는 [memory.md](memory.md) D-MEM-3 |
| D-IDX-16 | llm thunk를 지역 상수로 뽑아 messages·memory가 공유 | 서비스마다 thunk 복제 | Config에서 고르는 필드·meter 배선이 한 곳이다. 동작은 기존과 같다(부를 때마다 새 `Llm`) |
| D-IDX-17 | `afterSpeak`는 컨테이너의 화살표 함수로 연결 | messages가 memory를 import | 서비스끼리 import하지 않는다. 테스트는 훅을 바꿔 끼운다 |

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-07 | S4 설계(§13): `Services.memory`(`createMemoryService` — `contextMessages`·`memorySummaryThreshold`·공유 `llm` thunk), messages `afterSpeak` = `memory.summarizeIfNeeded`, llm thunk 지역 상수 추출, `index.ts`·`wrangler.toml`·`app.ts`·onError 불변, `scheduled`·`[triggers]` 미도입, 로그 키 5개, SRV-T-327, D-IDX-15~17 |
| 2026-10-07 | verify 후속 동기화(소스 기준, SEC-003·SRV-006): `/api/*` CSP `'none'` + `secureHeaders` 기본값(§1 R-API-006 행, §3 파일 표·미사용 미들웨어 줄, §3.1 그림·② 행·②a 행, §8 SRV-T-291·수동 curl, §9.1 헤더 행, §10, D-IDX-5 보충·D-IDX-14, 확인 필요 1건, Referrer-Policy 제안 부분 반영). §3 의존 방향을 실물 import로 보충(services→llm·settings·env, messages→llm, settings→db·llm). 공개 API 변경 없음 |
| 2026-10-07 | §12 로그 키에 이름 지목 형태 1행 추가(`speaker_select` mention·`speak_done.selected 'mention'`·fallback warn 없음), 상태 줄 "구현 완료(server 343/343, SRV-T-261~281)" — 구현 실물 기준 |
| 2026-10-06 | S3d(§12): 배선·env·라우트 등록·onError·마이그레이션 변화 없음 확인, 로그 키 `speaker_select`·`speaker_select_fallback`·`speak_done.auto·selected` 추가 기록, 70초 분배 참조 |
| 2026-10-05 | S1 초안 작성 |
| 2026-10-05 | S1 구현 동기화(상태 확정): `AppError(code, message?, options?)`(status는 `ERROR_STATUS`), `HealthStatus = HealthResponse`, `compatibility_date = 2026-08-15`. S2 설계: `ServiceDeps.config`·`Services.auth`·`Variables.principal?`, §3.1.1 인증 미들웨어 라우트 단위 원칙, `retryAfterSec` 변환(§2.4·§5.1), 로그 이벤트, SRV-T-160~162, D-IDX-9~11. `scheduled`는 S2에서 추가하지 않음 |
| 2026-10-06 | S3 델타: §2.3 `createServices` 배선에 `llm` 지연 생성(`() => Llm`)과 messages deps 확장(`logger`·`contextMessages`·`llm`)을 반영([llm.md](llm.md) §3.3) |
| 2026-10-06 | S3b 델타: §2.3 `createUsageMeter` 배선(`store: db.llmUsage`·Config 4필드), §2.4 `retryAfterSec` 적용 코드 확대, §5.1 행·§5.2 14종, §6.1 `[vars]` 4줄, SRV-T-233, §10 R-LLM-007·R-API-002, D-IDX-12 |
| 2026-10-06 | S3c 설계: §2.3.1 `Services.settings` 배선(`createSettingsService`, auth에 `ownerMbIds`, messages에 `loadPromptSettings`), §3.1.2 `requireOwner` 위치, §5.3 `OWNER_ONLY` 403(15종), §6.2 `wrangler.toml` 머리 주석, §10.1·§11.1 |
| 2026-10-06 | api.md v0.5 대조: §3.1.2 설정 라우트 순서에 본문 상한·`settingsIssueMessage` 추가 |
| 2026-10-06 | 구현 완료 동기화(server 318/318). 설계와 다른 점(구현자 보고): `server/test/app.test.ts` SRV-T-161의 `services.auth` 키 비교를 정렬 비교로 바꿨다(`AuthService`에 `isOwner`·`assertOwner`가 늘어 키 순서에 의존하지 않게) |

파급(공개 API 변경): `ServiceDeps`에 `config` 필수 추가 → 호출자 `server/src/app.ts` `bootstrap`(1줄), `server/test/app.test.ts` 188행의 `createServices({ db: trap, logger, now })`에 `config`(예: `parseEnv(env)` 결과)를 넣는다. `Services`·`AppEnv.Variables`·`AppError`·`toErrorBody`는 필드 추가뿐이라 기존 routes(`health.ts`·`rooms.ts`·`messages.ts`)·`validate.ts` 영향 없음.

제안(설계 미반영, 사용자 판단):

- (부분 반영 2026-10-07) `Referrer-Policy: no-referrer` 헤더. `/api/*`에는 hono `secureHeaders` 기본값으로 붙는다(SRV-T-291). 아래 제안의 대상인 `/embed` 문서 응답에는 여전히 없다(SRV-T-291이 없음을 단언). `/embed?t=<토큰>` 화면이 외부 리소스(웹폰트 등)를 부를 때 브라우저 기본 정책(`strict-origin-when-cross-origin`)은 이미 쿼리를 보내지 않지만, 명시하면 토큰 유출 경로가 하나 더 닫힌다. R-NFR-004로 역추적 가능하나 요구 문구에 없어 보류.
- CSP에 `frame-ancestors` 외 지시어(`default-src 'self'` 등) 추가. 요구는 frame-ancestors만이다.
- `[observability] enabled = true`(Workers Logs 보관). 지금은 `wrangler tail` 실시간 수집뿐이다.

파급(S3b): `services.ts` `createServices`의 `llm` thunk에 `meter` 1항목. `ServiceDeps`·`Services`·`AppEnv` 변경 없음. `server/wrangler.toml [vars]` 4줄 추가(§6.1 전문 반영). `app-error.ts`는 주석만. `Db.llmUsage` 추가로 `app.test.ts` `trap` 가짜 `Db` 갱신은 [db.md](db.md) 파급 문단.

파급(S4 공개 API 변경): `Services`에 `memory: MemoryService` 필수 추가 → 라우트(contract)가 E13·E14에서 `c.get('services').memory`를 쓴다. `Services` 키 집합을 단언하는 테스트(`server/test/app.test.ts` SRV-T-161 주변)가 있으면 `memory`를 더한다. `ServiceDeps`·`AppEnv`·`createServices` 시그니처 불변. `createServices` 본문은 llm thunk를 지역 상수로 옮기고 memory 생성·`afterSpeak` 1항목을 더한다. `server/src/index.ts`·`app.ts`·`wrangler.toml` 변경 없음.
