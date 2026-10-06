# env 모듈 설계

- 상태: 확정(S1 구현 동기화) · 최종 갱신: 2026-10-06
- 묶음: S1(저장 + 읽기 전용). 이 문서의 공개 API는 전부 S1에서 구현되었다(`requireLlmApiKey`는 S1에서 만들고 S3 speak가 호출). **S2 변경 없음**: S2가 쓰는 `TOKEN_SECRET`·`TOKEN_MIN_LEVEL`·`RATE_LIMIT_PER_MIN`은 이미 `Config`(`tokenSecret`·`tokenMinLevel`·`rateLimitPerMin`)에 있고, [auth.md](auth.md) §6이 값으로 받는다. **S3 변경 없음**: S3가 쓰는 `llmProvider`·`llmModel`·`llmTimeoutMs`·`contextMessages`와 `requireLlmApiKey`는 이미 구현되어 있다. 컨테이너가 speak·regenerate 시점에만 `requireLlmApiKey`를 부르는 지연 생성 함수로 감싼다([llm.md](llm.md) §3.3, R-ENV-003). `requireLlmApiKey`는 `LLM_PROVIDER=fake`이면 키를 요구하지 않고 `''`을 돌려주며, `FakeProvider`는 그 값을 쓰지 않는다(키 없는 로컬 개발·테스트용).
- 관련 문서: [index.md](index.md)(호출 지점·부트스트랩), [db.md](db.md)(`DB` 바인딩 소비), [auth.md](auth.md)(토큰·레이트리밋 설정 소비), [rooms.md](rooms.md), [messages.md](messages.md).

## 1. 목적

env 모듈은 건물의 열쇠 관리실이다. 열쇠(비밀값)와 안내판(설정)은 관리실 한 곳에서만 꺼내 확인하고, 각 사무실(서비스)에는 필요한 열쇠만 건넨다.

Workers `env` 바인딩 객체를 **유일하게** 읽어 검증·정규화한 설정값(`Config`)을 돌려준다. 다른 파일은 바인딩의 설정 키를 읽지 않고 `Config` 값만 받는다.

| 요구ID | 내용 |
|---|---|
| R-ENV-001 🔒 | 설정·비밀값은 `server/src/env.ts`의 `parseEnv(raw)`에서만 읽는다. `index.ts`가 받아 파싱하고 서비스에는 값으로 전달 |
| R-ENV-002 🔒 | 키 목록·기본값(Secrets 2 · [vars] 8 · 바인딩 2), `.dev.vars.example`·`wrangler.toml [vars]`·스키마 키 일치, 숫자 변환·범위 검사 |
| R-ENV-003 | 필수 키 누락·형식 오류 → 그 요청을 `500 CONFIG_INVALID`, 로그엔 키 이름만. `LLM_API_KEY` 누락은 speak 시점에만 실패 |
| R-NFR-004 🔒 | 비밀값이 로그·응답에 없다(본 모듈은 에러에 값을 싣지 않는다) |
| R-NFR-005 | CPU 10ms/요청 안에서 동작(파싱 비용 추정 §4) |

## 2. 공개 API

```ts
// server/src/env.ts
import type { D1Database, Fetcher } from '@cloudflare/workers-types'

/** Hono Bindings 타입. 리소스 바인딩만 노출한다 — 설정 키는 타입에 없으므로 c.env.TOKEN_SECRET 같은 직접 접근은 컴파일 에러 */
export type Env = {
  DB: D1Database
  ASSETS: Fetcher
}

export const LLM_PROVIDERS = ['google', 'fake'] as const
export type LlmProviderName = (typeof LLM_PROVIDERS)[number]

/** parseEnv 결과. 비밀값(tokenSecret·llmApiKey)을 담으므로 통째로 로그·응답에 넣지 않는다 */
export type Config = {
  readonly tokenSecret: string
  readonly llmApiKey?: string
  readonly tokenMinLevel: number
  readonly llmProvider: LlmProviderName
  readonly llmModel: string
  readonly llmTimeoutMs: number
  readonly allowedFrameAncestors: readonly string[]
  readonly rateLimitPerMin: number
  readonly contextMessages: number
  readonly memorySummaryThreshold: number
}

/** 바인딩 키 이름 전체(설정 10 + 리소스 2). 키 대조 테스트(SRV-T-011)와 문서 대조에 쓴다 */
export const ENV_KEYS: readonly string[]

/** CONFIG_INVALID 전용 에러. keys에는 문제 키 **이름만** 담고 값·zod 메시지·cause는 싣지 않는다 */
export class ConfigError extends AppError {
  readonly keys: readonly string[]
  constructor(keys: readonly string[])
}

/** Workers env 바인딩을 검증·정규화한다. 요청마다 index.ts 부트스트랩이 1회 호출 */
export const parseEnv = (raw: unknown): Config

/** speak(S3)가 호출. llmProvider가 'google'이고 키가 없으면 ConfigError(['LLM_API_KEY']) */
export const requireLlmApiKey = (config: Config): string
```

| 이름 | 인자 | 반환 | 실패 조건(에러 코드) | 요구ID |
|---|---|---|---|---|
| `parseEnv` | `raw: unknown`(Workers `env` 객체) | `Config` | 필수 키 누락·형식 오류·범위 밖·교차 규칙 위반 → `ConfigError`(`CONFIG_INVALID`, 500, `keys`) | R-ENV-001·002·003 |
| `requireLlmApiKey` | `config: Config` | `string`(키) | `llmProvider === 'google'`이고 `llmApiKey`가 없음 → `ConfigError(['LLM_API_KEY'])`. `fake`면 빈 문자열 반환 | R-ENV-003 |
| `ENV_KEYS` | — | 키 이름 배열 | — | R-ENV-002 |
| `ConfigError` | `keys` | — | — | R-ENV-003 |

- `Env`에 설정 키를 **일부러 넣지 않는다.** `wrangler types`가 만드는 전체 `Env` 인터페이스는 이 프로젝트에서 쓰지 않는다(쓰면 다른 파일에서 `c.env.TOKEN_SECRET`이 타입상 허용됨). 타입은 `@cloudflare/workers-types`만 쓴다.
- 테스트 전용 바인딩(`TEST_MIGRATIONS`, [db.md](db.md) §8)은 `Env`·`ENV_KEYS`에 넣지 않는다. `parseEnv`는 모르는 키를 무시한다(strict 스키마 금지).

## 3. 내부 구조

| 파일 | 책임 |
|---|---|
| `server/src/env.ts` | `Env`·`Config` 타입, zod 스키마, `parseEnv`, `ConfigError`, `requireLlmApiKey`, `ENV_KEYS` (예상 120줄 이하) |
| `server/test/env.test.ts` | SRV-T-001~011 |

- 의존: `zod`, `./app-error`(`AppError` — [index.md](index.md) §3), `@cloudflare/workers-types`(타입만).
- 모듈 상태 없음. 모듈 전역 캐시 없음(§4).

### 3.1 키 표 (단일 소스 — `.dev.vars.example`·`wrangler.toml [vars]`는 이 표를 전사)

| 키 | 출처 | 비밀 | 원시 타입 | 필수 / 기본값 | 검증 | `Config` 필드 | 쓰는 묶음 |
|---|---|---|---|---|---|---|---|
| `TOKEN_SECRET` | Secrets / `.dev.vars` | ○ | string | **필수** | 빈 문자열 = 누락. trim 하지 않음(HMAC 키가 PHP와 달라지지 않도록) | `tokenSecret` | S2 auth |
| `LLM_API_KEY` | Secrets / `.dev.vars` | ○ | string | 선택(없으면 `undefined`) | 빈 문자열 = 누락. trim 하지 않음 | `llmApiKey` | S3 llm |
| `TOKEN_MIN_LEVEL` | `[vars]` | ✕ | string\|number | 5 | 정수 1~10(그누보드 `mb_level` 범위) | `tokenMinLevel` | S2 auth |
| `LLM_PROVIDER` | `[vars]` | ✕ | string | `google` | `google` \| `fake` | `llmProvider` | S3 llm |
| `LLM_MODEL` | `[vars]` | ✕ | string | `gemini-2.5-flash` | `^[A-Za-z0-9._-]{1,64}$`(REST 경로에 들어가므로 `/`·`:`·공백 금지) | `llmModel` | S3 llm |
| `LLM_TIMEOUT_MS` | `[vars]` | ✕ | string\|number | 60000 | 정수 1000~60000(R-NFR-001 70초 상한 때문에 60초 초과 금지) | `llmTimeoutMs` | S3 llm |
| `ALLOWED_FRAME_ANCESTORS` | `[vars]` | ✕ | string | `http://london-gossip.my https://london-gossip.my` | 공백 구분 1개 이상. 각 항목 `^https?://[A-Za-z0-9.-]+(:\d{1,5})?$`(경로·`;`·따옴표·`*` 금지 — CSP 헤더 주입 방지). 중복 제거 | `allowedFrameAncestors` | S1 index |
| `RATE_LIMIT_PER_MIN` | `[vars]` | ✕ | string\|number | 20 | 정수 1~600 | `rateLimitPerMin` | S2 auth |
| `CONTEXT_MESSAGES` | `[vars]` | ✕ | string\|number | 40 | 정수 1~100 | `contextMessages` | S3 llm·S4 memory |
| `MEMORY_SUMMARY_THRESHOLD` | `[vars]` | ✕ | string\|number | 60 | 정수 2~1000, **`> CONTEXT_MESSAGES`**(교차 규칙, 위반 시 두 키 모두 보고) | `memorySummaryThreshold` | S4 memory |
| `DB` | `[[d1_databases]]` | ✕ | D1Database | **필수** | 객체이고 `prepare`가 함수 | — (`Env.DB`로 index가 직접 전달) | S1 db |
| `ASSETS` | `[assets]` | ✕ | Fetcher | **필수** | 객체이고 `fetch`가 함수 | — (`Env.ASSETS`로 index가 직접 전달) | S1 index |

변환 규칙:

- `[vars]` 문자열: 앞뒤 공백 제거 → 빈 문자열이면 **누락으로 보고 기본값** 적용. 값이 있는데 형식이 틀리면 기본값으로 넘어가지 않고 `CONFIG_INVALID`.
- 숫자 키: `number`(TOML 정수·테스트 바인딩)이거나 `^\d+$` 문자열만 받는다. `"1e3"`·`"5.0"`·`"-1"`·`" 5 "`(trim 후 `"5"`는 허용) 처리 기준이 명확하도록 `z.coerce`는 쓰지 않는다.
- 기본값의 단일 소스는 이 스키마다. `wrangler.toml [vars]`는 같은 값을 전사한다(키가 빠져도 동작은 같다).

스키마 스케치(구현 참고, 문법은 설치된 zod 버전에 맞춘다):

```ts
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const intVar = (min: number, max: number, dflt: number) =>
  z.preprocess(
    v => (typeof v === 'string' ? blankToUndefined(v.trim()) : v),
    z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
      .pipe(z.number().int().min(min).max(max))
      .default(dflt),
  )
const secret = z.preprocess(v => (v === '' ? undefined : v), z.string())
```

### 3.2 `ConfigError` 생성 규칙 (값 유출 차단)

- zod 실패 시 `issues`에서 **`path[0]`(키 이름)만** 모아 중복 제거·정렬해 `keys`에 넣는다.
- zod `message`·`received`·입력 객체는 `ConfigError`에 싣지 않는다. `cause`도 붙이지 않는다(ZodError 안에 받은 값이 들어 있다 — 예: enum 실패 메시지는 받은 값을 포함).
- `message`는 고정 한국어 문장(§5). 키 이름은 응답 본문에 넣지 않고 로그에만 남는다([index.md](index.md) §4 onError).

## 4. 비동기·동시성

```
fetch(request, env, ctx)                      ← Workers 런타임
  └ index.ts 부트스트랩 미들웨어
       ├ parseEnv(env)  ── 실패 → throw ConfigError ─→ app.onError → 500 CONFIG_INVALID
       │                                                   └ logger.error('config_invalid', { keys })
       └ 성공 → Config 값
            ├ createDb(env.DB)
            └ createServices({ db, now, ...필요한 Config 필드만 })   (index.md §3)
```

- 동기 순수 함수. I/O·`await` 없음.
- **캐시 전략 = 요청당 1회 파싱, 요청 간 캐시 없음.** 근거:
  - 비용: 키 10개 zod 파싱은 수십 µs 수준으로 추정되어 CPU 10ms 한도(R-NFR-005)에 영향이 없다. 구현 후 `wrangler dev` 로그의 CPU 시간으로 확인한다(§8 수동).
  - 모듈 전역 캐시(`WeakMap` 등)는 테스트마다 다른 바인딩을 넣을 때 무효화 문제가 생기고, 모듈 전역 가변 상태 금지 규칙(ts-rules)과 충돌한다.
  - Secrets 교체가 다음 요청부터 바로 반영된다.
- 한 요청 안에서는 부트스트랩이 만든 `Config`를 Hono 컨텍스트 변수와 서비스 팩토리 인자로 재사용한다. 서비스·라우트가 `parseEnv`를 다시 부르지 않는다.
- 이후 `scheduled` 핸들러(S2·S4에서 필요 시)도 호출 1회당 `parseEnv` 1회.

## 5. 에러 타입

| 에러 클래스 | shared 에러 코드 | HTTP | 한국어 메시지(응답) | 원인 | 로그 |
|---|---|---|---|---|---|
| `ConfigError` | `CONFIG_INVALID` | 500 | `서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요.` | 필수 키 누락, 형식·범위 위반, 교차 규칙 위반, `DB`·`ASSETS` 바인딩 없음 | `error` 레벨, `{ event: 'config_invalid', keys: 'TOKEN_SECRET,LLM_MODEL' }` — 키 이름만 |
| `ConfigError`(requireLlmApiKey) | `CONFIG_INVALID` | 500 | 위와 같음 | `llmProvider=google`인데 `LLM_API_KEY` 없음(speak 시점만) | 같음, `keys: 'LLM_API_KEY'` |

- `CONFIG_INVALID` 코드 문자열은 `shared/src/errors.ts`(contract 소유)의 상수를 쓴다.

## 6. 설정(env)

- 읽는 키: §3.1 표 전부. **이 파일이 유일한 읽기 지점**이다.
- 쓰는 키: 없음.

### 6.1 키 대조표 (R-ENV-002 수용 기준)

| 키 | `parseEnv` 스키마 | `wrangler.toml [vars]` | `server/.dev.vars.example` | Cloudflare Secrets |
|---|---|---|---|---|
| `TOKEN_SECRET` | ○ 필수 | ✕(넣으면 비밀값 노출) | ○ 빈 값 | ○ `wrangler secret put TOKEN_SECRET` |
| `LLM_API_KEY` | ○ 선택 | ✕ | ○ 빈 값 | ○ `wrangler secret put LLM_API_KEY` |
| `TOKEN_MIN_LEVEL` | ○ 기본 5 | ○ `"5"` | 주석(설명만) | ✕ |
| `LLM_PROVIDER` | ○ 기본 google | ○ `"google"` | 주석 | ✕ |
| `LLM_MODEL` | ○ 기본 gemini-2.5-flash | ○ `"gemini-2.5-flash"` | 주석 | ✕ |
| `LLM_TIMEOUT_MS` | ○ 기본 60000 | ○ `"60000"` | 주석 | ✕ |
| `ALLOWED_FRAME_ANCESTORS` | ○ 기본 2출처 | ○ `"http://london-gossip.my https://london-gossip.my"` | 주석 | ✕ |
| `RATE_LIMIT_PER_MIN` | ○ 기본 20 | ○ `"20"` | 주석 | ✕ |
| `CONTEXT_MESSAGES` | ○ 기본 40 | ○ `"40"` | 주석 | ✕ |
| `MEMORY_SUMMARY_THRESHOLD` | ○ 기본 60 | ○ `"60"` | 주석 | ✕ |
| `DB` | 존재 검사 | `[[d1_databases]] binding = "DB"` | ✕ | ✕ |
| `ASSETS` | 존재 검사 | `[assets] binding = "ASSETS"` | ✕ | ✕ |

- `wrangler.toml` 전문은 [index.md](index.md) §6.
- 로컬에서 `.dev.vars`의 키는 `[vars]`의 같은 키를 덮어쓴다. 키 없는 로컬 개발은 `.dev.vars`에 `LLM_PROVIDER=fake`를 적어 쓴다(S3).

### 6.2 `server/.dev.vars.example` 개정 전문 (server-implementer가 이 내용으로 교체)

현재 파일은 Gemini 확정·배포 주체 확정 전 문구("제공사 미정", "anthropic | openai | google", "지인이 수행한다")가 남아 있어 확정사항 §2·§6·§9-4·§9-8과 어긋난다.

```ini
# 런던_디스패치 로컬 비밀값 예제 (Cloudflare Workers · wrangler dev 용)
# 이 파일을 같은 폴더의 .dev.vars 로 복사하고 값을 채운다. .dev.vars 는 git 에 올리지 않는다.
# 운영(Workers)에는 `npx wrangler secret put <KEY>` 로 넣는다(배포 담당이 수행, 확정사항 §6).
# 키 목록의 단일 소스는 server/src/env.ts 의 parseEnv 스키마이고, 설계 문서는 doc/200_설계/server/env.md 이다.
# 모든 키는 parseEnv(바인딩) 에서만 읽는다. 다른 파일이 바인딩 값을 직접 읽으면 훅이 차단한다.

# --- 토큰 (갠홈 등급 연동) ---
# 갠홈 rosebell-chatbot.php 의 토큰 조각과 같은 값. 운영은 32자 이상 랜덤. 로컬은 아무 문자열(비우면 모든 요청이 500 CONFIG_INVALID)
TOKEN_SECRET=

# --- AI 제공사 (Google Gemini) ---
# Gemini API 키. 로그·응답·화면에 절대 찍지 않는다. 비워 두면 읽기 화면은 동작하고 speak 만 실패한다.
# 키 없이 로컬에서 발화를 시험하려면 아래 줄의 주석을 풀어 가짜 제공사를 쓴다.
LLM_API_KEY=
# LLM_PROVIDER=fake

# --- 참고: wrangler.toml [vars] 기본값 (여기 적지 않는다, 설명만) ---
# TOKEN_MIN_LEVEL=5                      쓰기 허용 최소 등급(그누보드 mb_level 1~10). 확정사항 §9-1
# LLM_PROVIDER=google                    google | fake. 확정사항 §9-4
# LLM_MODEL=gemini-2.5-flash             Gemini 모델 식별자
# LLM_TIMEOUT_MS=60000                   제공사 호출 타임아웃(ms, 1000~60000)
# ALLOWED_FRAME_ANCESTORS=http://london-gossip.my https://london-gossip.my   iframe 허용 출처(공백 구분). 확정사항 §9-7
# RATE_LIMIT_PER_MIN=20                  토큰(mb_id) 단위 쓰기 요청 분당 상한. 확정사항 §9-6
# CONTEXT_MESSAGES=40                    speak 에 넣는 최근 메시지 수(1~100)
# MEMORY_SUMMARY_THRESHOLD=60            이 수를 넘으면 오래된 구간을 요약한다(CONTEXT_MESSAGES 보다 커야 함)
```

## 7. DB 스키마·마이그레이션

없음.

## 8. 테스트 계획

`server/test/env.test.ts`. `parseEnv`는 순수 함수라 바인딩 객체 리터럴로 직접 호출한다. `DB`·`ASSETS`에는 `{ prepare: () => {} }`·`{ fetch: async () => new Response() }` 형태의 가짜 객체를 넣는다. 비밀값 자리에는 감시 문자열 `SENTINEL_SECRET_9f2c`를 넣고 에러·로그에 나타나지 않는지 본다.

| 테스트ID | 이름(`동작_조건_기대`) | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-001 | `parseEnv_applies_defaults_when_only_required_present` | `TOKEN_SECRET`·`DB`·`ASSETS`만 | 기본값 8개가 §3.1과 같음, `llmApiKey === undefined` | R-ENV-002 |
| SRV-T-002 | `parseEnv_converts_numeric_strings_and_numbers` | `TOKEN_MIN_LEVEL: '7'` / `7` / `' 7 '` | 셋 다 `7` | R-ENV-002 |
| SRV-T-003 | `parseEnv_throws_CONFIG_INVALID_when_required_missing` | `TOKEN_SECRET` 없음 / `''`, `DB` 없음, `ASSETS` 없음(각각) | `ConfigError`, `code === 'CONFIG_INVALID'`, `status === 500`, `keys`가 해당 키 1개 | R-ENV-003 |
| SRV-T-004 | `parseEnv_throws_when_number_out_of_range` | 표 기반: `TOKEN_MIN_LEVEL` 0·11, `LLM_TIMEOUT_MS` 999·60001, `RATE_LIMIT_PER_MIN` 0·601, `CONTEXT_MESSAGES` 0·101, `MEMORY_SUMMARY_THRESHOLD` 1·1001, `'5.0'`·`'1e3'`·`'-1'` | 각 `keys`에 해당 키 | R-ENV-002·003 |
| SRV-T-005 | `parseEnv_throws_when_threshold_not_greater_than_context` | `CONTEXT_MESSAGES: 60`, `MEMORY_SUMMARY_THRESHOLD: 60` | `keys = ['CONTEXT_MESSAGES','MEMORY_SUMMARY_THRESHOLD']` | R-ENV-003 |
| SRV-T-006 | `parseEnv_throws_when_provider_or_model_invalid` | `LLM_PROVIDER: 'openai'`, `LLM_MODEL: 'a/b'`, `LLM_MODEL: 'x:y'` | 해당 키 | R-ENV-002 |
| SRV-T-007 | `parseEnv_validates_frame_ancestors` | 정상 2개 + 중복, `'london-gossip.my'`(scheme 없음), `"https://a.my; script-src *"`, `"'self'"`, `'https://a.my/path'`, `'   '` | 정상은 배열·중복 제거, 나머지는 `keys = ['ALLOWED_FRAME_ANCESTORS']`(공백만이면 기본값) | R-ENV-002 · R-API-006 |
| SRV-T-008 | `parseEnv_allows_missing_llm_api_key` | `LLM_API_KEY` 없음 / `''` | 성공, `llmApiKey === undefined` | R-ENV-003 |
| SRV-T-009 | `ConfigError_never_contains_values` | `TOKEN_SECRET: SENTINEL`, `LLM_PROVIDER: 'SENTINEL_PROVIDER'` | `JSON.stringify(err)`·`err.message`·`String(err.keys)`·`err.cause`에 감시 문자열 없음, `err.cause === undefined` | R-ENV-003 · R-NFR-004 |
| SRV-T-010 | `requireLlmApiKey_throws_when_google_without_key` | google+키 없음 / google+키 / fake+키 없음 | `ConfigError(['LLM_API_KEY'])` / 키 반환 / `''` 반환 | R-ENV-003 |
| SRV-T-011 | `env_keys_match_wrangler_vars_and_dev_vars_example` | `?raw` import로 `wrangler.toml`·`.dev.vars.example` 텍스트를 읽어 키 집합 추출 | `[vars]` 키 = 설정 키 − 비밀 2개, `.dev.vars.example` 활성 키 = 비밀 2개, 주석 키 = `[vars]` 키 | R-ENV-002 |

- 에러 경로(SRV-T-003~007·009·010 일부) 수가 정상 경로(001·002·008·011)보다 많다.
- SRV-T-011은 workerd 안에서 `?raw` import가 안 되면 vitest 별도 node 프로젝트로 돌리거나 verify 단계 grep 대조로 대체한다(구현 시 확인).

수동·리뷰 체크:

- [ ] `grep -rnE "process\.env|import\.meta\.env" server/src` 결과가 0건(R-ENV-001).
- [ ] `grep -rnE "TOKEN_SECRET|LLM_API_KEY|TOKEN_MIN_LEVEL|LLM_PROVIDER|LLM_MODEL|LLM_TIMEOUT_MS|ALLOWED_FRAME_ANCESTORS|RATE_LIMIT_PER_MIN|CONTEXT_MESSAGES|MEMORY_SUMMARY_THRESHOLD" server/src` 결과가 `server/src/env.ts`뿐(R-ENV-001).
- [ ] `server/.dev.vars`에서 `TOKEN_SECRET`을 비우고 `wrangler dev` → `curl /api/rooms`가 500 `CONFIG_INVALID`, 터미널 로그에 키 이름만 보임(R-ENV-003).
- [ ] `wrangler dev` 로그에서 요청당 CPU 시간이 수 ms 이하인지 확인(R-NFR-005).

## 9. contract 요구 명세

env 모듈은 엔드포인트를 노출하지 않는다. contract가 알아야 할 것은 다음뿐이다.

| 항목 | 내용 | 이유 |
|---|---|---|
| 에러 코드 | `CONFIG_INVALID`(500) — 모든 엔드포인트(`/embed`·`/api/health` 포함)에서 나올 수 있다 | 부트스트랩이 라우트보다 먼저 돈다 |
| 응답 본문 | `{ error: { code: 'CONFIG_INVALID', message } }`. 키 이름은 본문에 없다 | 설정 구조 노출 방지 |
| speak(S3) | `LLM_API_KEY` 누락 시 speak·regenerate만 500 `CONFIG_INVALID` | R-ENV-003 |
| 라우트 금지 사항 | 라우트는 `c.env`의 설정 키를 읽지 않는다(`Env` 타입에 없음). 설정이 필요하면 server에 요구 명세로 요청 | R-ENV-001 |

## 10. 요구 추적표

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-ENV-001 🔒 | §2(`Env` 타입 제한)·§4·§8 수동 grep | SRV-T-011, 리뷰 grep | ✅ |
| R-ENV-002 🔒 | §3.1·§6.1·§6.2 | SRV-T-001·002·004·006·007·011 | ✅ |
| R-ENV-003 | §2·§3.2·§5 | SRV-T-003·004·005·008·009·010 | ✅ |
| R-NFR-004 🔒 | §3.2(값 미적재) | SRV-T-009 | 부분(로그 전반은 [index.md](index.md)) |
| R-NFR-005 | §4(파싱 비용) | 수동 CPU 확인 | 부분(전체는 index.md) |

## 11. 설계 결정 노트

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-ENV-1 | 원시 바인딩 타입 `Env`와 정규화 결과 `Config`를 분리하고, `Env`에는 `DB`·`ASSETS`만 둔다 | `wrangler types` 생성 `Env` 사용 | 설정 키 직접 접근을 타입 단계에서 막는다(R-ENV-001). 훅 차단과 이중 방어 |
| D-ENV-2 | 요청당 1회 파싱, 요청 간 캐시 없음 | isolate 단위 `WeakMap` 캐시 | §4 근거. 비용 무시 가능, 전역 상태·테스트 간섭 없음 |
| D-ENV-3 | `parseEnv`는 throw(`ConfigError`), 반환은 `Config` | `Result` 반환 | 위임문 시그니처(`parseEnv(raw): Config`)와 단일 에러 핸들러 경로를 따른다 |
| D-ENV-4 | 빈 문자열 = 누락. `[vars]`는 trim, Secrets는 trim 안 함 | 둘 다 trim | `.dev.vars.example`을 그대로 복사한 상태(`KEY=`)를 누락으로 다루고, HMAC 키가 PHP 쪽과 달라지는 일을 막는다 |
| D-ENV-5 | `MEMORY_SUMMARY_THRESHOLD > CONTEXT_MESSAGES` 교차 검사 | 검사 없음 | R-MEM-002는 "최근 CONTEXT_MESSAGES개를 제외한 구간"을 요약하므로 임계가 같거나 작으면 요약 구간이 비어 기능이 조용히 죽는다. 형식 오류로 본다 |
| D-ENV-6 | `LLM_PROVIDER` 허용값은 `google`·`fake` 둘 | `anthropic`·`openai` 포함 | R-LLM-001 구현 2종. 다른 제공사는 어댑터 추가 시 값도 추가 |
| D-ENV-7 | `LLM_TIMEOUT_MS` 상한 60000 | 상한 없음 | R-NFR-001(70초 종결). 재시도 포함 총 예산 배분은 S3 llm 설계 |

확인 필요:

- (해결) `.dev.vars.example`은 S1 구현에서 교체되었다. 현재 키는 `TOKEN_SECRET`·`LLM_API_KEY` 둘(비밀값만)이다(2026-10-05 확인).

제안(설계 미반영, 사용자 판단):

- `TOKEN_SECRET` 최소 길이 32자 검사. R-HANDOFF-003이 "32자 이상 랜덤"을 요구하므로 운영 실수를 막는다. 다만 로컬 "아무 문자열" 사용과 충돌하므로 도입 시 로컬도 32자 이상을 써야 한다.
- `LOG_LEVEL` 키. server-design-strategy §2 최소 키 목록에 있으나 R-ENV-002에 없어 넣지 않았다. 현재 로거는 레벨 필터 없이 info 이상을 모두 쓴다([index.md](index.md) §3.3).

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-05 | S1 초안 작성 |
| 2026-10-05 | S1 구현 동기화(상태 확정). 공개 API·키 표는 `server/src/env.ts`와 일치해 본문 변경 없음. S2는 env 변경 없음(머리말에 명시), `.dev.vars.example` 확인 필요 항목 해결 처리 |
| 2026-10-06 | S3 확인: env 변경 없음(머리말에 명시). `requireLlmApiKey` 호출 지점·fake 제공사 동작을 [llm.md](llm.md) §3.3에 연결 |
