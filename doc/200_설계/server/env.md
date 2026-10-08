# env 모듈 설계

- 상태: 확정(S1 구현 동기화) · S3b 초안(키 4개 — §2 S3b 델타·§3.1·§6) · S3c 구현 완료(`OWNER_MB_IDS` 1키 — §2 S3c 델타) · verify 후속 동기화(`TOKEN_SECRET` 32자 하한, SEC-001 — §3.1·§5·§6.2·§8·D-ENV-13) · S4 확인(2026-10-07, **변경 없음** — memory가 `contextMessages`·`memorySummaryThreshold`를 값으로 받고 새 키·새 검증 없음, [memory.md](memory.md) §6) · **S3f 설계 초안(2026-10-08, §12 `LLM_MODEL` 기본값 `gemini-3.1-pro-preview`·의미 개정, `LLM_PRICE_*` = 단가표 밖 모델의 폴백, 새 키 0, SRV-T-354)** · **S6 설계 초안(2026-10-08, 승인 ① 완료 — §13 `ROOM_ENTER_LIMIT_PER_MIN` 1키(`[vars]`, 정수 1~60, 기본 5) · `TOKEN_SECRET` 용도에 입장 증명 파생 추가, 새 Secret 0)** · 최종 갱신: 2026-10-08
- 묶음: S1(저장 + 읽기 전용). 이 문서의 공개 API는 전부 S1에서 구현되었다(`requireLlmApiKey`는 S1에서 만들고 S3 speak가 호출). **S2 변경 없음**: S2가 쓰는 `TOKEN_SECRET`·`TOKEN_MIN_LEVEL`·`RATE_LIMIT_PER_MIN`은 이미 `Config`(`tokenSecret`·`tokenMinLevel`·`rateLimitPerMin`)에 있고, [auth.md](auth.md) §6이 값으로 받는다. **S3 변경 없음**: S3가 쓰는 `llmProvider`·`llmModel`·`llmTimeoutMs`·`contextMessages`와 `requireLlmApiKey`는 이미 구현되어 있다. 컨테이너가 speak·regenerate 시점에만 `requireLlmApiKey`를 부르는 지연 생성 함수로 감싼다([llm.md](llm.md) §3.3, R-ENV-003). `requireLlmApiKey`는 `LLM_PROVIDER=fake`이면 키를 요구하지 않고 `''`을 돌려주며, `FakeProvider`는 그 값을 쓰지 않는다(키 없는 로컬 개발·테스트용). **S3b 변경**: 월 비용 상한(R-LLM-007 🔒) 키 4개 `LLM_MONTHLY_BUDGET_KRW`·`LLM_PRICE_INPUT_USD_PER_M`·`LLM_PRICE_OUTPUT_USD_PER_M`·`KRW_PER_USD`(전부 `[vars]`, 비밀 아님)와 소수 변환기 `decimalVar`를 더한다.
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

### S3b 델타 — `Config`·`ENV_KEYS`·스키마 (R-LLM-007)

```ts
export type Config = {
  // …기존 10필드 그대로
  /** S3b. 원, 정수 1~10000000 */
  readonly llmMonthlyBudgetKrw: number
  /** S3b. 입력 토큰 100만 개당 USD, 소수 0~100 */
  readonly llmPriceInputUsdPerM: number
  /** S3b. 출력(+사고) 토큰 100만 개당 USD, 소수 0~100 */
  readonly llmPriceOutputUsdPerM: number
  /** S3b. 원/USD, 소수 100~10000 */
  readonly krwPerUsd: number
}

// ENV_KEYS: 설정 14 + 리소스 2 = 16. 'MEMORY_SUMMARY_THRESHOLD' 뒤, 'DB' 앞에 4개
//   'LLM_MONTHLY_BUDGET_KRW', 'LLM_PRICE_INPUT_USD_PER_M', 'LLM_PRICE_OUTPUT_USD_PER_M', 'KRW_PER_USD'

// schema 추가 행
LLM_MONTHLY_BUDGET_KRW: intVar(1, 10_000_000, 100_000),
LLM_PRICE_INPUT_USD_PER_M: decimalVar(0, 100, 0.3),
LLM_PRICE_OUTPUT_USD_PER_M: decimalVar(0, 100, 2.5),
KRW_PER_USD: decimalVar(100, 10_000, 1400),
```

- 공개 함수 시그니처(`parseEnv`·`requireLlmApiKey`)는 바뀌지 않는다. `Config`에 필드 4개, `ENV_KEYS`에 이름 4개가 늘 뿐이다.
- 교차 검사는 없다. 4개 키는 `LLM_API_KEY` 유무와 무관하게 항상 파싱한다. 형식 오류는 다른 `[vars]` 키와 같이 모든 요청 500 `CONFIG_INVALID`다.
- 쓰는 곳은 컨테이너의 meter 배선뿐이다([index.md](index.md) §2.3 S3b, [llm.md](llm.md) §12.11).

### S3c 델타 — `OWNER_MB_IDS` (R-SET-001 · R-ENV-002 개정 2026-10-06)

- **구현 완료(2026-10-06)**: server 318/318 통과 · S3c 테스트 SRV-T-234~260(이 절 몫 SRV-T-234·235).

주인 명단은 건물 관리실이 갖고 있는 "사장실 출입 명단"이다. 출입증(토큰)이 진짜여도 명단에 없는 사람은 사장실(설정 화면)에 못 들어간다. 명단은 배포 설정에 적고, 관리실(env)이 읽어 경비(auth)에게 건넨다.

갠홈 주인 회원 ID 목록 1키를 더한다. auth의 `isOwner`가 값으로 받는다([auth.md](auth.md) §12). 결정 출처: `s3c-02-전반설계.md` §1(권고 B 채택) · `doc/state.json` decisions 2026-10-06 Q2 수정 — **지인(갠홈 주인) ID만** 둔다. 사용자 본인 ID는 넣지 않는다.

```ts
export type Config = {
  // …기존 14필드 그대로
  /** S3c. 갠홈 주인 회원 ID 목록(중복 제거, 입력 순서 유지). 빈 배열 = 주인 없음(설정 엔드포인트 전원 403) */
  readonly ownerMbIds: readonly string[]
}

// ENV_KEYS: 설정 15 + 리소스 2 = 17. 'KRW_PER_USD' 뒤, 'DB' 앞에 'OWNER_MB_IDS'

/** S3c. 그누보드 mb_id 길이 상한 · 목록 개수 상한 (s3c-02 §1) */
const OWNER_MB_ID_MAX = 20
const OWNER_MB_IDS_MAX = 5

const ownerMbIds = z.preprocess(
  blankToUndefined,
  z
    .string()
    .default('')
    .transform(s => [...new Set(s.split(/[\s,]+/).filter(x => x !== ''))])
    .pipe(z.array(z.string().min(1).max(OWNER_MB_ID_MAX)).max(OWNER_MB_IDS_MAX)),
)

// schema 추가 행
OWNER_MB_IDS: ownerMbIds,
// parseEnv 반환 추가
ownerMbIds: v.OWNER_MB_IDS,
```

파싱 규칙:

| 입력 | 결과 |
|---|---|
| 키 없음 · `''` · 공백만 · `','` | `[]`(주인 없음 — 위반 아님) |
| `'owner_a'` | `['owner_a']` |
| `' owner_a, owner_b  owner_c,,owner_a '` | `['owner_a', 'owner_b', 'owner_c']`(쉼표·공백 둘 다 구분자, 빈 조각 제거, 중복 제거) |
| 조각 하나가 21자 이상 | `ConfigError(['OWNER_MB_IDS'])` → 모든 요청 500 `CONFIG_INVALID` |
| 고유 조각 6개 이상 | 같음 |

- 그누보드 `mb_id`는 영문·숫자·밑줄이라 zod `.max()`(UTF-16 단위)와 글자 수가 같다. 문자 종류는 검사하지 않는다(02 §1 규칙 그대로 — §11 제안 참고).
- 비교는 auth가 **대소문자 구분 정확 일치**로 한다. 운영 값은 갠홈 회원 정보의 `mb_id` 표기 그대로 적는다.
- 출처: **Secrets 권고**(`npx wrangler secret put OWNER_MB_IDS`) — 비밀값은 아니지만 회원 ID를 공개 저장소에 남기지 않기 위해서다. `[vars]`도 허용한다. Workers는 둘을 같은 `env`로 주므로 `parseEnv`는 같다. 두 곳에 같은 이름을 함께 두지 않는다(한 곳만).
- `[vars]` 키와 달리 trim 대상이 조각 단위다(목록 문자열이라 HMAC 키 같은 바이트 보존이 필요 없다).
- `ConfigError`는 키 이름만 싣는다(값 미포함 — SRV-T-235). `Config`를 통째로 로그하지 않는 기존 규칙 그대로.
- 형식 위반은 다른 키와 같이 **모든 요청** 500이다. 빈 값은 위반이 아니다(설정 엔드포인트만 전원 403, 나머지는 정상).
- 쓰는 곳: 컨테이너가 auth 팩토리에 `ownerMbIds`만 넘긴다([index.md](index.md) §2.3.1).

§3.1 키 표 추가 행:

| 키 | 출처 | 비밀 | 원시 타입 | 필수 / 기본값 | 검증 | `Config` 필드 | 쓰는 묶음 |
|---|---|---|---|---|---|---|---|
| `OWNER_MB_IDS` (S3c) | Secrets / `.dev.vars`(권고) · `[vars]` 허용 | △(비밀 아님, 저장소 비노출 권고) | string | 선택, `''` → `[]` | 쉼표·공백 구분, 조각 1~20자, 고유 최대 5개, 중복 제거 | `ownerMbIds` | S3c auth |

§6.1 키 대조표 추가 행:

| 키 | `parseEnv` 스키마 | `wrangler.toml [vars]` | `server/.dev.vars.example` | Cloudflare Secrets |
|---|---|---|---|---|
| `OWNER_MB_IDS` (S3c) | ○ 기본 `[]` | ✕ 값 없음. 머리 주석 1줄만(아래) | ○ 빈 값(활성 키) | ○ `wrangler secret put OWNER_MB_IDS`(권고) |

§6.2 `server/.dev.vars.example` 추가 블록(server-implementer가 「AI 제공사」 블록 뒤, 「참고: wrangler.toml [vars]」 블록 앞에 넣는다):

```ini
# --- 캐릭터 설정 화면 주인 (S3c, R-SET-001) ---
# 갠홈 주인(지인) 회원 아이디 목록. 쉼표나 공백으로 구분, 최대 5개, 각 1~20자. 대소문자까지 그대로 적는다.
# 비우면 설정 화면은 아무도 못 연다(전원 403). 캐릭터 대화는 기본 설정으로 계속 된다.
# 비밀값은 아니지만 회원 아이디를 저장소에 남기지 않도록 여기(.dev.vars)와 운영 Secrets 에만 둔다.
# 운영은 npx wrangler secret put OWNER_MB_IDS 로 넣는다. 로컬 시험은 자리표시 아이디를 넣고 그 아이디로 토큰을 만든다.
OWNER_MB_IDS=
```

- 위 주석 줄은 `KEY=값` 꼴이 아니어야 한다(SRV-T-011의 주석 키 추출에 걸리지 않게).
- `wrangler.toml`은 값 줄을 두지 않고 머리 주석 3번째 줄만 바꾼다([index.md](index.md) §6.2): `# 비밀값(TOKEN_SECRET, LLM_API_KEY)과 갠홈 주인 회원 ID 목록(OWNER_MB_IDS, S3c)은 여기 적지 않는다. 운영은 \`npx wrangler secret put <KEY>\`, 로컬은 server/.dev.vars`
- 문서·예제·테스트에 실제 회원 ID를 쓰지 않는다. 자리표시자(`owner_a`·`owner_test`)만.

테스트(`server/test/env.test.ts`):

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-234 | `parseEnv_parses_owner_mb_ids_list` (S3c) | 없음 · `''` · `'   '` · `','` / `'owner_a'` / `' owner_a, owner_b  owner_c,,owner_a '` / 20자 조각 1개 / 고유 5개 | `[]`×4 / `['owner_a']` / `['owner_a','owner_b','owner_c']` / 통과 / 통과 | R-SET-001 · R-ENV-002 |
| SRV-T-235 | `parseEnv_rejects_invalid_owner_mb_ids_without_value` (S3c) | 감시 문자열을 포함한 21자 조각 / 고유 6개 | `ConfigError`, `keys = ['OWNER_MB_IDS']`, `JSON.stringify(err)`·`err.message`에 감시 문자열 없음 | R-SET-001 · R-ENV-003 · R-NFR-004 |

기존 테스트 파급:

- SRV-T-011: `.dev.vars.example` 활성 키 기대값이 Secrets 계열 3개(`TOKEN_SECRET`·`LLM_API_KEY`·`OWNER_MB_IDS`)로 바뀐다. 테스트 안 `secrets` 배열에 `'OWNER_MB_IDS'`를 더한다. `[vars]` 키 = 설정 키 − 이 3개, 주석 키 = `[vars]` 키는 그대로 성립한다.
- SRV-T-001: 기본값 비교에 `ownerMbIds: []`가 더해진다.
- `Config`를 객체 리터럴로 만드는 테스트 픽스처가 있으면 `ownerMbIds: []`를 넣는다.
- 공개 함수 시그니처(`parseEnv`·`requireLlmApiKey`)는 바뀌지 않는다.

요구 추적 추가:

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-SET-001 🔒 (env 몫) | §2 S3c 델타 | SRV-T-234·235 | ✅(설계) |
| R-ENV-002 🔒 (S3c 개정 +`OWNER_MB_IDS`) | S3c 델타(§3.1·§6.1·§6.2 추가분) | SRV-T-011·234 | ✅(설계) |

결정:

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-ENV-10 (S3c) | 쉼표·공백 둘 다 구분자, 조각 1~20자, 최대 5개 | JSON 배열 문자열 | `wrangler secret put` 입력이 한 줄이라 사람이 치기 쉬운 형식. 02 §1 규칙 그대로 |
| D-ENV-11 (S3c) | `.dev.vars.example`에 활성 빈 키로 둔다(Secrets 계열) | `[vars]` 주석 | Secrets 권고를 예제에서 그대로 보인다. `[vars]`에 두면 운영에서도 그 자리에 실값을 적기 쉽다 |
| D-ENV-12 (S3c) | 형식 위반은 모든 요청 500 | 설정 엔드포인트만 403 | 기존 env 규칙("형식 위반은 배포 실수 — 바로 드러나게")과 같다. R-SET-001 수용 기준 "형식 위반 env → `CONFIG_INVALID`" |

제안(설계 미반영): 조각 문자 종류 검사(`^[A-Za-z0-9_]+$`). 따옴표째 붙여 넣는 실수(`"owner_a"`)를 배포 시점에 잡는다. 02 §1에 없는 규칙이라 보류한다.

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
| `TOKEN_SECRET` | Secrets / `.dev.vars` | ○ | string | **필수** | 빈 문자열 = 누락. trim 하지 않음(HMAC 키가 PHP와 달라지지 않도록). **32자 이상**(`TOKEN_SECRET_MIN_LENGTH = 32`, zod `.min` = UTF-16 코드 단위, SEC-001 2026-10-07). 짧으면 `ConfigError(['TOKEN_SECRET'])`. 운영·로컬·제공사 구분 없음(D-ENV-13) | `tokenSecret` | S2 auth |
| `LLM_API_KEY` | Secrets / `.dev.vars` | ○ | string | 선택(없으면 `undefined`) | 빈 문자열 = 누락. trim 하지 않음 | `llmApiKey` | S3 llm |
| `TOKEN_MIN_LEVEL` | `[vars]` | ✕ | string\|number | 5 | 정수 1~10(그누보드 `mb_level` 범위) | `tokenMinLevel` | S2 auth |
| `LLM_PROVIDER` | `[vars]` | ✕ | string | `google` | `google` \| `fake` | `llmProvider` | S3 llm |
| `LLM_MODEL` | `[vars]` | ✕ | string | `gemini-3.1-pro-preview`(S3f — §12) | `^[A-Za-z0-9._-]{1,64}$`(REST 경로에 들어가므로 `/`·`:`·공백 금지) | `llmModel` | S3 llm |
| `LLM_TIMEOUT_MS` | `[vars]` | ✕ | string\|number | 60000 | 정수 1000~60000(R-NFR-001 70초 상한 때문에 60초 초과 금지) | `llmTimeoutMs` | S3 llm |
| `ALLOWED_FRAME_ANCESTORS` | `[vars]` | ✕ | string | `http://london-gossip.my https://london-gossip.my` | 공백 구분 1개 이상. 각 항목 `^https?://[A-Za-z0-9.-]+(:\d{1,5})?$`(경로·`;`·따옴표·`*` 금지 — CSP 헤더 주입 방지). 중복 제거 | `allowedFrameAncestors` | S1 index |
| `RATE_LIMIT_PER_MIN` | `[vars]` | ✕ | string\|number | 20 | 정수 1~600 | `rateLimitPerMin` | S2 auth |
| `CONTEXT_MESSAGES` | `[vars]` | ✕ | string\|number | 40 | 정수 1~100 | `contextMessages` | S3 llm·S4 memory |
| `MEMORY_SUMMARY_THRESHOLD` | `[vars]` | ✕ | string\|number | 60 | 정수 2~1000, **`> CONTEXT_MESSAGES`**(교차 규칙, 위반 시 두 키 모두 보고) | `memorySummaryThreshold` | S4 memory |
| `LLM_MONTHLY_BUDGET_KRW` (S3b) | `[vars]` | ✕ | string\|number | 100000 | 정수 1~10000000(원) | `llmMonthlyBudgetKrw` | S3b llm |
| `LLM_PRICE_INPUT_USD_PER_M` (S3b) | `[vars]` | ✕ | string\|number | 0.3 | 소수 0~100(`decimalVar`) | `llmPriceInputUsdPerM` | S3b llm |
| `LLM_PRICE_OUTPUT_USD_PER_M` (S3b) | `[vars]` | ✕ | string\|number | 2.5 | 소수 0~100(`decimalVar`) | `llmPriceOutputUsdPerM` | S3b llm |
| `KRW_PER_USD` (S3b) | `[vars]` | ✕ | string\|number | 1400 | 소수 100~10000(`decimalVar`) | `krwPerUsd` | S3b llm |
| `DB` | `[[d1_databases]]` | ✕ | D1Database | **필수** | 객체이고 `prepare`가 함수 | — (`Env.DB`로 index가 직접 전달) | S1 db |
| `ASSETS` | `[assets]` | ✕ | Fetcher | **필수** | 객체이고 `fetch`가 함수 | — (`Env.ASSETS`로 index가 직접 전달) | S1 index |

변환 규칙:

- `[vars]` 문자열: 앞뒤 공백 제거 → 빈 문자열이면 **누락으로 보고 기본값** 적용. 값이 있는데 형식이 틀리면 기본값으로 넘어가지 않고 `CONFIG_INVALID`.
- 숫자 키: `number`(TOML 정수·테스트 바인딩)이거나 `^\d+$` 문자열만 받는다. `"1e3"`·`"5.0"`·`"-1"`·`" 5 "`(trim 후 `"5"`는 허용) 처리 기준이 명확하도록 `z.coerce`는 쓰지 않는다.
- (S3b) 소수 키(`decimalVar`): 유한한 `number`이거나 `^\d+(\.\d{1,6})?$` 문자열만 받는다. `".3"`·`"1e-1"`·`"-0.1"`·`"0,3"`·소수 7자리 이상은 `CONFIG_INVALID`. 정수 문자열(`"1400"`)도 받는다.
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

S3b 소수 변환기:

```ts
const decimalVar = (min: number, max: number, dflt: number) =>
  z.preprocess(
    blankToUndefined,
    z
      .union([z.number(), z.string().regex(/^\d+(\.\d{1,6})?$/).transform(Number)])
      .pipe(z.number().finite().min(min).max(max))
      .default(dflt),
  )
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
| `ConfigError` | `CONFIG_INVALID` | 500 | `서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요.` | 필수 키 누락, 형식·범위 위반(`TOKEN_SECRET` 32자 미만 포함 — 2026-10-07), 교차 규칙 위반, `DB`·`ASSETS` 바인딩 없음 | `error` 레벨, `{ event: 'config_invalid', keys: 'TOKEN_SECRET,LLM_MODEL' }` — 키 이름만 |
| `ConfigError`(requireLlmApiKey) | `CONFIG_INVALID` | 500 | 위와 같음 | `llmProvider=google`인데 `LLM_API_KEY` 없음(speak 시점만) | 같음, `keys: 'LLM_API_KEY'` |

- `CONFIG_INVALID` 코드 문자열은 `shared/src/errors.ts`(contract 소유)의 상수를 쓴다.
- **`TOKEN_SECRET` 길이 경계(SEC-001, 2026-10-07).** 31자는 거절, 32자는 통과한다(SRV-T-290). 짧은 값도 누락과 같은 `CONFIG_INVALID` 경로라 `/embed`·`/api/health`를 포함한 모든 요청이 500이다. `keys`에는 키 이름만 싣고 값·길이는 싣지 않는다. 로컬 `.dev.vars`도 32자 이상이어야 하고, 갠홈 PHP 조각에는 같은 값을 넣는다(HMAC 키 일치).

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
| `LLM_MODEL` | ○ 기본 gemini-3.1-pro-preview | ○ `"gemini-3.1-pro-preview"` | 주석 | ✕ |
| `LLM_TIMEOUT_MS` | ○ 기본 60000 | ○ `"60000"` | 주석 | ✕ |
| `ALLOWED_FRAME_ANCESTORS` | ○ 기본 2출처 | ○ `"http://london-gossip.my https://london-gossip.my"` | 주석 | ✕ |
| `RATE_LIMIT_PER_MIN` | ○ 기본 20 | ○ `"20"` | 주석 | ✕ |
| `CONTEXT_MESSAGES` | ○ 기본 40 | ○ `"40"` | 주석 | ✕ |
| `MEMORY_SUMMARY_THRESHOLD` | ○ 기본 60 | ○ `"60"` | 주석 | ✕ |
| `LLM_MONTHLY_BUDGET_KRW` (S3b) | ○ 기본 100000 | ○ `"100000"` | 주석 | ✕ |
| `LLM_PRICE_INPUT_USD_PER_M` (S3b) | ○ 기본 0.3 | ○ `"0.3"` | 주석 | ✕ |
| `LLM_PRICE_OUTPUT_USD_PER_M` (S3b) | ○ 기본 2.5 | ○ `"2.5"` | 주석 | ✕ |
| `KRW_PER_USD` (S3b) | ○ 기본 1400 | ○ `"1400"` | 주석 | ✕ |
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
# 갠홈 rosebell-chatbot.php 의 토큰 조각과 같은 값. 운영·로컬 모두 32자 이상(짧으면 모든 요청이 500 CONFIG_INVALID). 비워도 같다
TOKEN_SECRET=

# --- AI 제공사 (Google Gemini) ---
# Gemini API 키. 로그·응답·화면에 절대 찍지 않는다. 비워 두면 읽기 화면은 동작하고 speak 만 실패한다.
# 키 없이 로컬에서 발화를 시험하려면 아래 줄의 주석을 풀어 가짜 제공사를 쓴다.
LLM_API_KEY=
# LLM_PROVIDER=fake

# --- 참고: wrangler.toml [vars] 기본값 (여기 적지 않는다, 설명만) ---
# TOKEN_MIN_LEVEL=5                      쓰기 허용 최소 등급(그누보드 mb_level 1~10). 확정사항 §9-1
# LLM_PROVIDER=google                    google | fake. 확정사항 §9-4
# LLM_MODEL=gemini-3.1-pro-preview       고르기 전 기본 모델(설정 화면에서 Pro·Flash를 고르면 그 값이 우선)
# LLM_TIMEOUT_MS=60000                   제공사 호출 타임아웃(ms, 1000~60000)
# ALLOWED_FRAME_ANCESTORS=http://london-gossip.my https://london-gossip.my   iframe 허용 출처(공백 구분). 확정사항 §9-7
# RATE_LIMIT_PER_MIN=20                  토큰(mb_id) 단위 쓰기 요청 분당 상한. 확정사항 §9-6
# CONTEXT_MESSAGES=40                    speak 에 넣는 최근 메시지 수(1~100)
# MEMORY_SUMMARY_THRESHOLD=60            이 수를 넘으면 오래된 구간을 요약한다(CONTEXT_MESSAGES 보다 커야 함)
# LLM_MONTHLY_BUDGET_KRW=100000          월 AI 비용 상한(원, 추정). 닿으면 다음 달 1일 0시(KST)까지 캐릭터 버튼 429. R-LLM-007
# LLM_PRICE_INPUT_USD_PER_M=0.3          단가표에 없는 모델의 폴백 입력 단가(USD/1M 토큰)
# LLM_PRICE_OUTPUT_USD_PER_M=2.5         단가표에 없는 모델의 폴백 출력+사고 단가(USD/1M 토큰)
# KRW_PER_USD=1400                       원/달러 환율(자동 갱신 없음)
```

## 7. DB 스키마·마이그레이션

없음.

## 8. 테스트 계획

`server/test/env.test.ts`. `parseEnv`는 순수 함수라 바인딩 객체 리터럴로 직접 호출한다. `DB`·`ASSETS`에는 `{ prepare: () => {} }`·`{ fetch: async () => new Response() }` 형태의 가짜 객체를 넣는다. 비밀값 자리에는 감시 문자열 `SENTINEL_SECRET_9f2c`를 넣고 에러·로그에 나타나지 않는지 본다.

| 테스트ID | 이름(`동작_조건_기대`) | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-001 | `parseEnv_applies_defaults_when_only_required_present` | `TOKEN_SECRET`·`DB`·`ASSETS`만 | 기본값 12개(S3b 4개 포함)가 §3.1과 같음, `llmApiKey === undefined` | R-ENV-002 |
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
| SRV-T-231 | `parseEnv_reads_budget_and_price_keys_with_decimals` (S3b) | 4키 없음 / `'50000'`·`'0.075'`·`'0'`·`'1385.5'` / 숫자 `0.3` / `' 2.5 '` | 기본값 100000·0.3·2.5·1400 / 50000·0.075·0·1385.5 / 0.3 / 2.5 | R-LLM-007 · R-ENV-002 |
| SRV-T-232 | `parseEnv_rejects_invalid_budget_and_price_keys` (S3b) | 표 기반: 예산 `0`·`10000001`·`'1e5'`·`'5.5'`·`'-1'`, 단가 `'-0.1'`·`'.3'`·`'1e-1'`·`'100.1'`·`'0.1234567'`, 환율 `'99'`·`'10000.5'`·`'abc'`·`NaN` | 각 `keys`에 해당 키 1개, 값은 에러에 없음 | R-ENV-002·003 |
| SRV-T-290 | `parseEnv_rejects_TOKEN_SECRET_shorter_than_32_chars_without_echoing_it` (verify 후속 SEC-001) | `TOKEN_SECRET` = `'x'` 31개 / 32개 | `ConfigError`, `keys = ['TOKEN_SECRET']`, 에러의 자기 속성 전부를 직렬화해도 31자 값 없음 / 통과·`tokenSecret`이 입력 그대로 | R-ENV-003 · R-NFR-004 · R-HANDOFF-003(관련) |

- 에러 경로(SRV-T-003~007·009·010 일부) 수가 정상 경로(001·002·008·011)보다 많다.
- SRV-T-011은 workerd 안에서 `?raw` import가 안 되면 vitest 별도 node 프로젝트로 돌리거나 verify 단계 grep 대조로 대체한다(구현 시 확인).

수동·리뷰 체크:

- [ ] `grep -rnE "process\.env|import\.meta\.env" server/src` 결과가 0건(R-ENV-001).
- [ ] `grep -rnE "TOKEN_SECRET|LLM_API_KEY|TOKEN_MIN_LEVEL|LLM_PROVIDER|LLM_MODEL|LLM_TIMEOUT_MS|ALLOWED_FRAME_ANCESTORS|RATE_LIMIT_PER_MIN|CONTEXT_MESSAGES|MEMORY_SUMMARY_THRESHOLD|LLM_MONTHLY_BUDGET_KRW|LLM_PRICE_INPUT_USD_PER_M|LLM_PRICE_OUTPUT_USD_PER_M|KRW_PER_USD" server/src` 결과가 `server/src/env.ts`뿐(R-ENV-001).
- [ ] `server/.dev.vars`에서 `TOKEN_SECRET`을 비우거나 31자로 줄이고 `wrangler dev` → `curl /api/rooms`가 500 `CONFIG_INVALID`, 터미널 로그에 키 이름만 보임(R-ENV-003).
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
| R-ENV-003 | §2·§3.2·§5 | SRV-T-003·004·005·008·009·010·290 | ✅ |
| R-HANDOFF-003 (관련 — 문서 요구 "32자 이상 랜덤"을 server가 길이로 강제) | §3.1·§5·§6.2·D-ENV-13 | SRV-T-290 | ✅(2026-10-07) |
| R-LLM-007 🔒 (S3b 키) | §2 S3b 델타·§3.1·§6.1·§6.2 | SRV-T-231·232·011 | ✅(설계) |
| R-ENV-002 🔒 (S3b 키 4개) | §3.1·§6.1 | SRV-T-011·231 | 부분(요구 R-ENV-002 키 목록 개정 대기 — [llm.md](llm.md) 보고 사항 5) |
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
| D-ENV-8 (S3b) | 소수 변환기 `decimalVar`(정규식 문자열·유한 number만, `z.coerce` 금지) | 단가를 마이크로달러 정수 키로 | 요구 R-LLM-007이 키 이름(`…_USD_PER_M`)과 공개 단가(소수)를 정했다. 형식을 좁게 받는 `intVar` 원칙(§3.1 변환 규칙)을 그대로 따른다 |
| D-ENV-9 (S3b) | 범위: 예산 1~10000000원, 단가 0~100, 환율 100~10000 | 범위 없음 | 자릿수 실수(예 환율 `14000`, 단가 `250`)를 배포 시점에 잡는다. 단가 0은 허용한다(무료 등급 키면 실제 청구 0 — [llm.md](llm.md) §12.13). 예산 0은 막는다(0이면 버튼이 항상 막혀 설정 실수로 보인다) |
| D-ENV-13 (verify 후속 SEC-001) | `TOKEN_SECRET` 32자 하한을 제공사·환경 구분 없이 항상 건다 | `LLM_PROVIDER=google`일 때만(verify 보고의 최소안) · 하한 없음 | parseEnv에는 운영·로컬을 가르는 키가 없다(`LLM_PROVIDER`는 제공사 선택). 조건을 걸면 `fake`로 시험한 짧은 값이 운영 Secrets로 옮겨질 수 있고 검증 경로가 둘이 된다. 대가: 로컬도 32자 이상(`.dev.vars.example` 주석으로 안내) |

확인 필요:

- (해결) `.dev.vars.example`은 S1 구현에서 교체되었다. 현재 키는 `TOKEN_SECRET`·`LLM_API_KEY` 둘(비밀값만)이다(2026-10-05 확인).

제안(설계 미반영, 사용자 판단):

- (반영 2026-10-07 — D-ENV-13·SRV-T-290) `TOKEN_SECRET` 최소 길이 32자 검사. R-HANDOFF-003이 "32자 이상 랜덤"을 요구하므로 운영 실수를 막는다. 다만 로컬 "아무 문자열" 사용과 충돌하므로 도입 시 로컬도 32자 이상을 써야 한다.
- `LOG_LEVEL` 키. server-design-strategy §2 최소 키 목록에 있으나 R-ENV-002에 없어 넣지 않았다. 현재 로거는 레벨 필터 없이 info 이상을 모두 쓴다([index.md](index.md) §3.3).

## 12. S3f — `LLM_MODEL`·`LLM_PRICE_*` 의미 개정 (R-ENV-002 🔒 개정 · R-LLM-009 🔒 · R-LLM-007 🔒 개정)

- 상태: 초안(2026-10-08, 승인 ① 완료 — Q1 기본 모델 = Pro). 근거 `s3f-02-전반설계.md` §2.2·§3·§9 L1 · `s3f-03-인계패킷.md` §1.1.
- **새 env 키 0.** `Config` 필드·`ENV_KEYS`·`parseEnv`·`requireLlmApiKey` 시그니처와 `ConfigError` 규칙은 그대로다. 바뀌는 것은 `LLM_MODEL` 기본값 1곳과 두 키의 **뜻**(문서·주석)이다.
- 관련: [llm.md](llm.md) §15(상수표·단가표·해석 규칙) · [index.md](index.md) §14(공장이 `Config.llmModel`·`llmPrice*`를 해석 입력으로 씀).

### 12.1 키 표 델타 (§3.1·§6.1의 해당 행을 대체)

| 키 | 위치 | 타입·검증 | 기본값 | 뜻(S3f) | 비밀 |
|---|---|---|---|---|---|
| `LLM_MODEL` | `wrangler.toml [vars]` | 문자열, `MODEL_PATTERN` `/^[A-Za-z0-9._-]{1,64}$/`(불변) | **`gemini-3.1-pro-preview`**(이전 `gemini-2.5-flash`) | 주인이 설정 화면에서 모델을 **고른 적이 없을 때** 쓰는 기본 모델. 고른 키가 있으면 그 키의 상수표 모델명이 우선 | 아님 |
| `LLM_PRICE_INPUT_USD_PER_M` | `[vars]` | 소수 0~100(불변) | `0.3`(불변) | **모델 단가표(`llm/models.ts`)에 없는 모델**의 폴백 입력 단가(USD/100만 토큰) | 아님 |
| `LLM_PRICE_OUTPUT_USD_PER_M` | `[vars]` | 소수 0~100(불변) | `2.5`(불변) | 단가표에 없는 모델의 폴백 출력+사고 단가 | 아님 |

- 두 상수표 모델명(`gemini-3.1-pro-preview`·`gemini-3.8-flash`)은 `MODEL_PATTERN`을 통과한다(영문·숫자·`.`·`-`). 패턴은 바꾸지 않는다.
- env `LLM_MODEL`에 Pro·Flash 모델명을 넣으면 단가는 단가표 값이 쓰이고 `LLM_PRICE_*`는 쓰이지 않는다([llm.md](llm.md) §15.4 V3). `LLM_PRICE_*`는 env가 표 밖 모델(예: `gemini-2.5-flash`)일 때만 의미가 있다(V5).
- `LLM_API_KEY`(Secrets)·`LLM_PROVIDER`·`LLM_TIMEOUT_MS`·`KRW_PER_USD`·`LLM_MONTHLY_BUDGET_KRW`는 그대로다.

### 12.2 `server/src/env.ts` 델타

```ts
  LLM_MODEL: z.preprocess(
    blankToUndefined,
    z.string().regex(MODEL_PATTERN).default('gemini-3.1-pro-preview'), // S3f: 고르기 전 기본 모델(R-ENV-002 🔒 개정)
  ),
```

- 문서주석 `[설정]` 줄은 키 목록이 같아 그대로 둔다. `Config.llmModel` 주석을 "고르기 전 기본 모델(저장 키가 있으면 상수표가 우선 — llm.md §15)"으로 고친다.
- 다른 파일은 `process.env`·바인딩을 읽지 않는다(불변). `fallbackModelKey`는 컨테이너가 `Config.llmModel`에서 계산한다.

### 12.3 `server/wrangler.toml [vars]`·`server/.dev.vars.example` 델타 (3줄씩 교체 — 실값·비밀값 없음)

Workers에서는 `[vars]` 값이 스키마 기본값보다 먼저 쓰이므로 **`wrangler.toml` 값도 반드시 같이 바꾼다**(스키마 기본값만 바꾸면 배포 동작은 그대로 Flash 2.5다).

```toml
LLM_MODEL = "gemini-3.1-pro-preview"        # S3f 주인이 설정 화면에서 모델을 고르기 전 기본 모델(R-ENV-002 🔒)
LLM_PRICE_INPUT_USD_PER_M = "0.3"           # 단가표(server/src/llm/models.ts)에 없는 모델의 폴백 입력 단가(USD/1M 토큰)
LLM_PRICE_OUTPUT_USD_PER_M = "2.5"          # 단가표에 없는 모델의 폴백 출력+사고 단가(USD/1M 토큰)
```

```
# LLM_MODEL=gemini-3.1-pro-preview       고르기 전 기본 모델(설정 화면에서 Pro·Flash를 고르면 그 값이 우선)
# LLM_PRICE_INPUT_USD_PER_M=0.3          단가표에 없는 모델의 폴백 입력 단가(USD/1M 토큰)
# LLM_PRICE_OUTPUT_USD_PER_M=2.5         단가표에 없는 모델의 폴백 출력+사고 단가(USD/1M 토큰)
```

- 열 맞춤은 기존 파일 형식을 따른다. `.dev.vars.example`의 나머지 줄·`LLM_API_KEY` 안내는 그대로다.
- 지인 Cloudflare 대시보드에 `LLM_MODEL`을 따로 넣어 두었다면 그 값이 `wrangler.toml`보다 우선할 수 있다. handoff 안내 1~2줄은 contract-designer 몫이다(02 §12).

### 12.4 테스트

| ID | 대상 | 조건 | 기대 |
|---|---|---|---|
| SRV-T-354 | `parseEnv` | ① `LLM_MODEL` 없음 ② `'gemini-3.8-flash'` ③ `'gemini-3.1-pro-preview'` | ① `llmModel: 'gemini-3.1-pro-preview'` ②③ 그 값 그대로(상수표 모델명이 패턴을 통과). `llmPriceInputUsdPerM` 0.3·`llmPriceOutputUsdPerM` 2.5 기본값 불변 |

- 기존 테스트 영향: `env.test.ts` 30행 기본값 기대 `llmModel: 'gemini-2.5-flash'` → `'gemini-3.1-pro-preview'`. `ENV_KEYS` 길이 단언은 불변.
- 수동: `wrangler.toml`·`.dev.vars.example`·`parseEnv` 스키마의 `LLM_MODEL` 기본값 3곳이 같은지 눈으로 대조(R-ENV-002 수용 기준).

### 12.5 요구 추적

| 요구 | 반영 | 테스트 | 상태 |
|---|---|---|---|
| R-ENV-002 🔒(개정) | §12.1~12.3 | SRV-T-354 | 설계 ✅ |
| R-LLM-009 🔒 | §12.1 해석 입력의 뜻 | SRV-T-354 · [llm.md](llm.md) SRV-T-337·338 | 설계 ✅ |
| R-LLM-007 🔒(개정) | `LLM_PRICE_*` = 표 밖 폴백 | [llm.md](llm.md) SRV-T-339 | 설계 ✅ |

### 12.6 설계 결정

| ID | 결정 | 대안·근거 |
|---|---|---|
| D-ENV-14 | 기본값 = `gemini-3.1-pro-preview`(Q1 사용자 결정) | 이전 기본값 2.5 Flash는 새 계정에서 막혀 있고, "몰래 가벼운 모델로 바꾸지 않기" 지시와 맞춘다 |
| D-ENV-15 | `LLM_PRICE_*`를 지우지 않고 표 밖 폴백으로 남긴다 | 지우면 env 로 표 밖 모델을 쓸 때 단가가 없다. 키를 지우는 것은 R-ENV-002 🔒 키 목록 개정이라 범위 밖 |
| D-ENV-16 | 모델 키(`'pro'`·`'flash'`) 선택은 env가 아니라 D1(설정 화면) | R-SET-013 🔒. env는 "고르기 전" 값만 맡는다 |

## 13. S6 — `ROOM_ENTER_LIMIT_PER_MIN` 신규 · `TOKEN_SECRET` 용도 추가 (R-ENV-002 🔒 개정 L15 · R-LOCK-004·008)

- 상태: 초안(2026-10-08, 승인 ① 완료 — U7 분당 5회 확정). 근거 `s6-02-전반설계.md` §5·§7, `s6-03-인계패킷.md` §1.1·§1.3.
- 결론: 비밀 아닌 키 1개를 `[vars]`에 더한다. 새 Secret은 없다 — 입장 증명 키는 `TOKEN_SECRET`에서 용도 문자열로 파생한다(02 D-S6-3). 바인딩 파싱은 여전히 `parseEnv` 한 곳이다.

### 13.1 키 표 델타 (§3.1·§6.1에 행 추가·설명 보충)

| 키 | 타입·검증 | 기본값 | 출처 | 비밀 | 설명 |
|---|---|---|---|---|---|
| `ROOM_ENTER_LIMIT_PER_MIN` (신규) | 정수 1~60 | `5` | `wrangler.toml [vars]` | ✕ | 잠긴 방 비밀번호 입장 시도, **방마다** 분당 상한. 주인·비밀번호 없는 요청·안 잠긴 방은 세지 않는다. 쓰는 곳: auth `hitEnterLimit`([auth.md](auth.md) §14.4) |
| `TOKEN_SECRET` (의미 추가) | 불변(32자 이상) | — | Secrets · `.dev.vars` | ○ | 토큰 HMAC 검증 + **방 입장 증명 파생 키의 재료**(`HMAC(TOKEN_SECRET, 'london_dispatch/room-entry/v1')`, [rooms.md](rooms.md) §12.3.4). 바꾸면 모든 방의 비밀번호 기억이 무효가 되어 열람자에게 다시 묻는다 |

### 13.2 `server/src/env.ts` 델타

```ts
/** S6. 스키마 기본값과 auth 폴백이 같은 값을 쓰도록 내보낸다(바인딩을 읽지 않는 상수) */
export const ROOM_ENTER_LIMIT_PER_MIN_DEFAULT = 5

export type Config = {
  // … 기존 불변
  /** S6. 방 단위 비밀번호 입장 시도 분당 상한(1~60) */
  readonly roomEnterLimitPerMin: number
}
// ENV_KEYS 에 'ROOM_ENTER_LIMIT_PER_MIN' 추가(17 → 18)
// 스키마: 기존 RATE_LIMIT_PER_MIN 과 같은 정수 변환 규칙(문자열 → 정수, 범위 1~60, 생략 시 ROOM_ENTER_LIMIT_PER_MIN_DEFAULT)
```

- 위반(0·61·소수·숫자 아님)은 기존 `ConfigError` 규칙(§3.2)대로 **키 이름만** 담은 한국어 메시지 → 첫 요청 `500 CONFIG_INVALID`. 값은 메시지·로그에 넣지 않는다.
- 빈 문자열의 처리는 기존 정수 키(`RATE_LIMIT_PER_MIN`)와 같게 한다(규칙을 새로 만들지 않는다).

### 13.3 `server/wrangler.toml [vars]`·`server/.dev.vars.example` 델타 (실값·비밀값 없음)

`wrangler.toml [vars]` — `RATE_LIMIT_PER_MIN` 줄 다음에 1줄:

```toml
ROOM_ENTER_LIMIT_PER_MIN = "5"          # 잠긴 방 비밀번호 입장 시도, 방마다 분당 상한(1~60). 주인·비밀번호 없는 요청은 세지 않는다
```

`.dev.vars.example` — 「참고: wrangler.toml [vars] 기본값」 블록의 `RATE_LIMIT_PER_MIN` 줄 다음에 1줄, 「토큰」 블록 `TOKEN_SECRET` 설명 아래에 1줄:

```
# ROOM_ENTER_LIMIT_PER_MIN=5              잠긴 방 비밀번호 입장 시도, 방마다 분당 상한(1~60). 주인·비밀번호 없는 요청은 세지 않는다
# 같은 값으로 방 입장 증명(비밀번호를 맞힌 브라우저의 기억)도 만든다. 바꾸면 잠긴 방은 모두 비밀번호를 다시 묻는다
```

### 13.4 테스트 (`server/test/env.test.ts`에 추가)

| ID | 조건 | 기대 |
|---|---|---|
| SRV-T-400 | 키 생략 / `'10'` / `'0'`·`'61'`·`'5.5'`·`'abc'` / `ENV_KEYS` / `.dev.vars.example`·`wrangler.toml` 대조(SRV-T-011 확장) | `roomEnterLimitPerMin === 5`(= `ROOM_ENTER_LIMIT_PER_MIN_DEFAULT`) / `10` / `ConfigError` — 메시지에 `ROOM_ENTER_LIMIT_PER_MIN` 포함·입력값 미포함 / 길이 18 / 두 파일 모두 키 존재, 비밀값 실값 없음 |

- 기존 테스트 영향: SRV-T-001(기본값 구조 비교)에 `roomEnterLimitPerMin: 5`, `ENV_KEYS` 길이 단언(있으면) 18. `Config`를 객체 리터럴로 만드는 테스트 픽스처가 있으면 필드 1개 추가.

### 13.5 요구 추적

| 요구 | 반영 | 테스트 | 상태 |
|---|---|---|---|
| R-ENV-002 🔒 개정(L15) | §13.1~13.3 | SRV-T-400 | 설계 ✅ |
| R-LOCK-008 | 기본 5 · 1~60 | SRV-T-400, [auth.md](auth.md) SRV-T-393·394 | 설계 ✅ |
| R-LOCK-004 🔒 | `TOKEN_SECRET` 용도 추가(키 불변) | [rooms.md](rooms.md) SRV-T-366 | 설계 ✅ |

### 13.6 설계 결정

| ID | 결정 | 대안·근거 |
|---|---|---|
| D-ENV-17 | 기본값 상수 `ROOM_ENTER_LIMIT_PER_MIN_DEFAULT`를 env.ts에서 내보낸다 | auth의 선택 config 폴백이 같은 값을 쓴다(값 두 곳 중복 방지). 상수는 바인딩 읽기가 아니다 |
| D-ENV-18 | 새 Secret `ROOM_KEY_SECRET`을 만들지 않는다 | 지인의 `wrangler secret put` 작업이 늘지 않는다(02 D-S6-3). 대가(SECRET 교체 = 기억 초기화)는 handoff 1줄(contract-designer) |

파급(S6): `Config`에 필드 1개, `ENV_KEYS` 1개, 상수 export 1개. 호출자는 `server/src/services.ts`(auth config에 값 전달, [index.md](index.md) §15)뿐. `wrangler.toml [vars]` 1줄·`.dev.vars.example` 주석 2줄.

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-08 | S6 설계(§13, 승인 ① 완료 — U7): `ROOM_ENTER_LIMIT_PER_MIN`(정수 1~60, 기본 5, `[vars]`) — `Config.roomEnterLimitPerMin`·`ENV_KEYS` 18개·`ROOM_ENTER_LIMIT_PER_MIN_DEFAULT` export, `TOKEN_SECRET` 용도에 입장 증명 파생 추가(새 Secret 0), `wrangler.toml` 1줄·`.dev.vars.example` 주석 2줄 문안, SRV-T-400, D-ENV-17·18 |
| 2026-10-08 | verify 후속 SRV-002(LOW): 현재 값을 서술하던 `LLM_MODEL` 기본값 잔재를 `gemini-3.1-pro-preview`로 정정 — §3.1 키 표(235행)·§6.1 대조표(331행)·§6.2 `.dev.vars.example` 전사(371행, `LLM_PRICE_*` 두 줄 378·379행 뜻 주석 포함 — 실물과 일치). 이력·이전 값 서술(§12.1 「이전」, §12.4 테스트 영향, 이 표)은 유지 |
| 2026-10-08 | S3f 설계(§12, 승인 ① 완료 — Q1 Pro): `LLM_MODEL` 기본값 `gemini-2.5-flash` → `gemini-3.1-pro-preview`(뜻 = 고르기 전 기본 모델), `LLM_PRICE_*` 뜻 = 단가표 밖 모델의 폴백(기본값 불변), `wrangler.toml [vars]`·`.dev.vars.example` 3줄 교체 문안, 새 키 0. SRV-T-354, D-ENV-14~16 |
| 2026-10-07 | S4 확인: env 변경 없음(머리말에 명시). memory 서비스가 기존 `Config.contextMessages`·`Config.memorySummaryThreshold`를 컨테이너에서 값으로 받는다([index.md](index.md) §13.1). 검증 규칙 `MEMORY_SUMMARY_THRESHOLD > CONTEXT_MESSAGES`가 요약 배치 크기 ≥ 1을 보장한다([memory.md](memory.md) §2.1). 요약 상수(배치 100·2만 자·25초·목표 2000자)는 코드 상수라 키를 만들지 않는다 |
| 2026-10-05 | S1 초안 작성 |
| 2026-10-05 | S1 구현 동기화(상태 확정). 공개 API·키 표는 `server/src/env.ts`와 일치해 본문 변경 없음. S2는 env 변경 없음(머리말에 명시), `.dev.vars.example` 확인 필요 항목 해결 처리 |
| 2026-10-06 | S3 확인: env 변경 없음(머리말에 명시). `requireLlmApiKey` 호출 지점·fake 제공사 동작을 [llm.md](llm.md) §3.3에 연결 |
| 2026-10-06 | S3b 설계: 키 4개(`LLM_MONTHLY_BUDGET_KRW`·`LLM_PRICE_INPUT_USD_PER_M`·`LLM_PRICE_OUTPUT_USD_PER_M`·`KRW_PER_USD`) — §2 S3b 델타(`Config`·`ENV_KEYS` 16개·스키마 행), §3.1 행·`decimalVar` 규칙·스케치, §6.1 대조표, §6.2 주석 4줄, SRV-T-231·232, SRV-T-001 기본값 수, §8 grep 목록, D-ENV-8·9 |
| 2026-10-06 | S3c 설계: `OWNER_MB_IDS` 1키 — S3c 델타(`Config.ownerMbIds`·`ENV_KEYS` 17개·스키마·파싱 규칙·키 표/대조표/`.dev.vars.example` 추가 블록·`wrangler.toml` 머리 주석), SRV-T-234·235, SRV-T-011 Secrets 계열 3개, D-ENV-10~12. 결정 출처 state.json(Q2 — 지인 ID만) |
| 2026-10-06 | S3c 델타에 구현 완료 표기(server 318/318, SRV-T-234~260). 설계와 다른 점 없음 |
| 2026-10-07 | verify 후속 동기화(소스 기준, SEC-001): `TOKEN_SECRET` 32자 하한 — §3.1 검증 칸, §5 원인·경계 문단, §6.2 `.dev.vars.example` 주석 줄(실물 전사), §8 SRV-T-290·수동 체크, §10 R-ENV-003·R-HANDOFF-003, D-ENV-13, 제안 항목 반영 표기. 공개 API·키 목록 불변 |

파급(S3b): `Config`에 필드 4개, `ENV_KEYS`에 4개 추가. `parseEnv` 결과를 구조 비교하는 테스트(SRV-T-001)와 `ENV_KEYS` 길이를 단언하는 테스트가 있으면 갱신한다. `server/wrangler.toml [vars]`에 4줄([index.md](index.md) §6.1 S3b), `server/.dev.vars.example`에 주석 4줄(§6.2)을 더해야 SRV-T-011이 통과한다. `Config`를 직접 만드는 테스트 픽스처(`parseEnv` 대신 객체 리터럴)가 있으면 4필드를 넣는다.

파급(S3f): `Config`·`ENV_KEYS`·`parseEnv` 시그니처 불변. `env.ts` 기본값 1곳, `wrangler.toml [vars]`·`.dev.vars.example` 주석·값 3줄. 기본값을 단언하는 `env.test.ts` 30행 갱신.
