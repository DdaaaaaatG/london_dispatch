---
name: server-design-strategy
description: 런던_디스패치 server 계층(Cloudflare Workers + Hono 4 + D1, server/src) 설계·구현·검토 표준. 모듈 경계 6종(env/db/auth/rooms/messages/memory/llm)과 책임, 의존 방향(routes→services→db), env 단일 진입(Workers env 바인딩을 env.ts의 parseEnv로만 파싱), 에러 처리(AppError + shared 에러코드·한국어 메시지), 비동기·동시성(speak 방당 1건 D1 조건부 UPDATE 잠금·요약 ctx.waitUntil), D1 규칙(비동기 prepare/bind/run·batch 트랜잭션·wrangler 마이그레이션), LLM 어댑터 인터페이스(fetch 기반)와 타임아웃·재시도, 프롬프트 조립 규칙(프롬프트 주입 완화), 캐릭터 상수, 로그, 명명, 테스트 표준, 요구 기반 최소 구현, 문서↔코드 일치, contract 인계 규약을 정의한다. "서버 모듈 설계", "speak 구현", "server 감사", "토큰 검증", "장기기억 요약", "LLM 어댑터" 작업 시 반드시 참조한다.
---

# server 계층 설계 전략 (표준)

- server = `server/src/` 아래 Cloudflare Workers(Hono)/TypeScript 서비스 계층. 토큰 검증·방/메시지/장기기억 저장(D1)·AI 호출·레이트리밋을 맡는다. 운영 런타임은 workerd(`nodejs_compat`)이고 Node는 빌드·테스트·wrangler 실행용 로컬 도구다.
- **Workers 제약이 설계 전제다**: 영속 디스크 없음(→ D1), 네이티브 모듈 불가, 인스턴스가 여럿이라 프로세스 메모리로 잠금·카운터 불가(→ D1 행 기반), 응답 후 작업은 `ctx.waitUntil()`, 무료 플랜 요청당 CPU 10ms(LLM 대기는 I/O라 미포함).
- 상위 기준은 `doc/000_프로젝트_확정사항.md`(§2 스택, §3 계층, §4 폴더, §5 규격, §6 외부 당사자). 충돌하면 확정사항이 이긴다.
- server는 **ui를 모른다.** 밖으로 나가는 통로는 contract 계층(라우트·shared 타입)뿐이다.

---

## 1. 모듈 경계 6종 (+ 진입점·인프라)

| 모듈 | 책임 | 금지 |
|---|---|---|
| `env.ts` | Workers `env` 바인딩 객체를 **유일하게** 읽어 zod로 검증한 `Env` 값을 돌려주는 `parseEnv(raw)`. 기본값·필수 여부·타입 | 비즈니스 로직. 다른 모듈에서 바인딩 설정 키(`TOKEN_SECRET` 등) 직접 접근, `process.env` |
| `db/` | D1 바인딩(`env.DB`) 래핑, 쿼리 문자열 상수, 행↔도메인 변환, `batch` 헬퍼 | 비즈니스 판단(어떤 메시지를 요약할지 등은 서비스), 마이그레이션 실행(wrangler 몫) |
| `auth/` | 토큰 파싱·HMAC 검증(Web Crypto `crypto.subtle`)·만료·등급 검사, `Principal{mbId,nick,chName,level}` 생성, Hono 미들웨어 제공 | 토큰 **발급**(갠홈 PHP 몫), 회원 DB 조회(없음) |
| `rooms/` | 방 생성·목록·이름 변경·삭제(메시지·memory 연쇄 삭제) | LLM 호출 |
| `messages/` | 메시지 목록(페이지네이션)·user 저장·speak(생성 파이프라인)·수정·삭제·regenerate·방당 speak 잠금 | 프롬프트 문자열 조립(llm 몫), 요약 판단 로직(memory 몫) |
| `memory/` | 방 단위 장기기억: 요약 기준 판정, 오래된 구간 요약 요청(llm 경유), summary 저장·조회·편집 | 메시지 삭제 |
| `llm/` | 제공사 어댑터(`provider.ts` 인터페이스 + 제공사별 파일), 캐릭터 상수(`characters.ts`), 프롬프트 조립(`prompt.ts`), 출력 후처리 | DB 접근, HTTP 라우트 |

- 모듈 = 폴더 + `index.ts`. 공개 API는 `index.ts`에서 named export로 재노출한다. 다른 모듈은 `index.ts` export만 쓴다.
- **의존 방향**: `routes → services(rooms·messages·memory) → db`. `llm`은 `messages`·`memory`만 호출한다. `auth`는 `routes`의 Hono 미들웨어로만 쓰이고 서비스는 `Principal`(auth.md §2: mbId·nick·chName·level·displayName)를 인자로 받는다. `env`는 `index.ts`가 `parseEnv`로 한 번 만들어 서비스 팩토리에 **값으로 주입**한다(모듈이 바인딩을 직접 import·접근하지 않는다). 역방향 import 금지.
- 진입점 `index.ts`: Hono 앱 조립(미들웨어 → routes), `export default { fetch, scheduled }`. `fetch(request, env, ctx)`에서 `parseEnv(env)` → `createDb(env.DB)` → 서비스 팩토리 → 라우트에 주입. 정적 화면은 `env.ASSETS`(Workers Static Assets)가 `/embed`로 서빙한다.
- 새 모듈 추가는 요구ID로 역추적될 때만. "나중에 쓸 것 같아서"는 금지(§10).

## 2. env 단일 진입 (비밀값 격리)

- Workers에는 `process.env`가 없다. 요청마다 `fetch(request, env, ctx)`로 들어오는 **`env` 바인딩 객체**가 설정·비밀값·D1·정적 자산의 유일한 출처다.
- `server/src/env.ts`의 `parseEnv(raw: unknown): Env`가 **유일하게** 바인딩의 설정 키를 읽어 zod로 검증·정규화한다. `index.ts`가 `parseEnv(env)`를 호출해 결과를 서비스에 **값으로 전달**한다. 다른 파일은 `TOKEN_SECRET`·`LLM_API_KEY` 같은 바인딩 키를 직접 읽지 않는다. `process.env`·`import.meta.env`가 env.ts 밖에 있으면 훅(`ld-secret-scope-guard.sh`·`validate-secret-scope.py`)이 차단한다.
- 필수 키가 없으면 **첫 요청에서 즉시 실패**(한국어 메시지, 어떤 키가 없는지 — 값은 찍지 않는다). 런타임에 `undefined`가 흘러가게 두지 않는다.
- 값의 출처는 둘로 나눈다. 비밀값(`TOKEN_SECRET`, `LLM_API_KEY`)은 Cloudflare Secrets(`wrangler secret put`, 로컬은 `server/.dev.vars`). 비밀 아닌 설정은 `server/wrangler.toml [vars]`. 바인딩(`DB`: D1, `ASSETS`: 정적 자산)은 `wrangler.toml`의 `[[d1_databases]]`·`[assets]`.
- 키 목록의 단일 소스는 `env.ts`이고 `server/.dev.vars.example`(비밀값 키 이름 + 설명, 실값 없음)과 `wrangler.toml [vars]`가 그것을 전사한다. 셋이 어긋나면 verify가 잡는다.
- 최소 키: `TOKEN_SECRET`(HMAC), `TOKEN_MIN_LEVEL`, `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `ALLOWED_FRAME_ANCESTORS`, `RATE_LIMIT_PER_MIN`, `MEMORY_SUMMARY_THRESHOLD`, `CONTEXT_MESSAGES`, `LOG_LEVEL` + 바인딩 `DB`·`ASSETS`. `PORT`·DB 파일 경로는 없다(Workers가 관리). 추가는 요구ID와 함께.
- 비밀값(`TOKEN_SECRET`, `LLM_API_KEY`)은 로그·에러 메시지·응답·테스트 스냅샷에 **절대** 나타나지 않는다. `env` 객체를 통째로 로그에 찍지 않는다.

## 3. 에러 처리

- 서비스는 `AppError { code, status, message, cause? }`를 throw한다. `code`는 `shared/src/errors.ts`의 상수만(문자열 리터럴 산재 금지). `message`는 **사용자에게 그대로 보여도 되는 한국어 한 문장**.
- `throw 'string'`·`throw new Error('...')`(코드 없는 에러)는 서비스에서 금지. 외부 라이브러리 에러는 잡아서 `AppError`로 감싸고 `cause`에 원본을 보존한다.
- `AppError`를 `{ error: { code, message } }` + `status`로 변환하는 **단일 에러 핸들러**(Hono `app.onError`·`notFound`)는 **진입점 `server/src/app.ts`(server 소유)** 한 곳에만 둔다. 라우트(contract 소유)는 throw만 한다. 이유: 부트스트랩(CONFIG_INVALID)·`/embed`·notFound까지 한 핸들러로 덮고, `?t=` 토큰을 로그에서 빼기 위해서다(index.md 설계 결정). 핸들러마다 try/catch로 문자열을 만들지 않는다.
- 예상 못 한 에러는 `500 INTERNAL`로 닫고 원본은 로그에만. 스택·경로·SQL을 응답에 넣지 않는다.
- LLM 제공사 에러는 `llm/`에서 `LLM_TIMEOUT`·`LLM_PROVIDER_ERROR`·`LLM_AUTH_ERROR`·`LLM_RATE_LIMITED`로 분류해 올린다. 제공사 원문 메시지는 로그에만.

## 4. 비동기·동시성 (Workers 전제: 인스턴스 여럿, 프로세스 메모리 공유 없음)

- Hono 핸들러와 서비스는 `async`. D1 호출도 전부 비동기(`await`). 미처리 promise 금지 — 응답 뒤에 이어갈 작업은 `ctx.waitUntil(runInBackground(...))`로 넘기고 내부에서 모든 에러를 잡아 로그한다. `waitUntil` 없이 떠 있는 promise는 응답 직후 중단될 수 있다.
- **speak는 방당 동시 1건 — D1 조건부 UPDATE 잠금.** `UPDATE rooms SET speaking_until = ? WHERE id = ? AND (speaking_until IS NULL OR speaking_until < ?)`로 선점하고 `meta.changes === 0`이면 `409 SPEAK_IN_PROGRESS`(대기열 없음). 만료 90초 — 생성이 끝나면 `speaking_until = NULL`로 해제하고, 실패·타임아웃이면 만료가 풀어 준다. 프로세스 메모리 `Map` 잠금은 인스턴스가 여럿이라 금지.
- **요약은 응답 후 `ctx.waitUntil()`.** speak 응답을 만든 뒤 `memory.maybeSummarize(roomId)`를 `waitUntil`로 넘긴다. 실패해도 speak 응답은 성공이며 로그 `warn`. 같은 방 요약 중복은 `memory.source_until_id` 조건부 UPDATE로 막는다. `waitUntil` 지속 한계(응답 후 수십 초)에 걸리면 Cron Trigger(`scheduled` 핸들러, 수 분 주기)로 대체 — memory 설계에서 server-designer가 확정한다.
- 쓰기 레이트리밋도 D1 `rate_limits(mb_id, window_start, count)` 조건부 UPSERT(분 창). 메모리 카운터·외부 레이트리밋 플러그인 금지.
- 타임아웃은 LLM 호출에만(§6, `AbortSignal.timeout`). D1 호출은 플랫폼이 제한한다.
- 종료 훅(`SIGTERM`)은 없다. 요청 단위로 상태를 완결하고, 중단돼도 다음 요청이 복구할 수 있게 설계한다(잠금 만료, 멱등 요약).

## 5. D1 규칙 (`db/`)

- Cloudflare D1(SQLite 호환)을 **바인딩 `env.DB`**로 받는다. API는 비동기: `env.DB.prepare(sql).bind(...).run() / .first<T>() / .all<T>()`. 동기 SQLite 드라이버·네이티브 모듈은 Workers에서 쓸 수 없다.
- `db/`는 바인딩을 인자로 받는 팩토리(`createDb(binding: D1Database)`)로 감싸 서비스에 주입한다. 전역 연결 객체·`PRAGMA` 설정 없음(D1이 관리).
- SQL은 **파라미터 바인딩만**(`?`). 문자열 연결로 SQL을 만들면 보안 리뷰 CRITICAL.
- prepared statement는 요청마다 만들어도 된다(D1이 캐시). 쿼리 문자열은 `db/` 안 상수로 모아 재사용한다.
- 마이그레이션: `server/migrations/NNNN_설명.sql`(4자리 연번). 적용은 코드가 아니라 `wrangler d1 migrations apply <DB> --local`(dev·테스트 setup) / `--remote`(/deploy 안, 사용자 확인). 적용된 파일은 수정 금지(새 번호로 추가). 기동 시 자동 마이그레이션 코드는 두지 않는다.
- 여러 문장을 한 단위로 바꾸는 작업(방 삭제 = rooms·messages·memory)은 `env.DB.batch([stmt1, stmt2, …])`(원자적). 읽고-판단하고-쓰는 흐름은 batch로 못 묶으므로 조건부 UPDATE(`WHERE` 조건 + `meta.changes`)로 경합을 처리한다.
- 테스트는 `@cloudflare/vitest-pool-workers`가 주는 격리 D1 바인딩에 setup에서 마이그레이션을 적용해 쓴다. dev 로컬 상태(`server/.wrangler/`)·운영 DB 접근 금지.
- 스키마 단일 소스는 확정사항 §5.4 + 마이그레이션 파일. 설계 문서 `doc/200_설계/server/db.md`에 현재 스키마를 전사한다.
- 무료 플랜 한도(일 500만 읽기/10만 쓰기)를 감안해 핫패스 쿼리 수를 설계 문서에 적는다(speak 1회 = 읽기 N·쓰기 M).

## 6. LLM 어댑터 (`llm/`)

```ts
// llm/provider.ts
export type LlmMessage = { role: 'user' | 'assistant'; content: string }
export type GenerateInput = { system: string; messages: LlmMessage[]; maxTokens: number; timeoutMs: number }
export interface LlmProvider { generate(input: GenerateInput): Promise<string> }
```

- 제공사별 파일(`anthropic.ts`·`openai.ts`·`gemini.ts`) 중 `env.LLM_PROVIDER`로 하나를 고르는 팩토리 `createProvider(env)`. 서비스는 `LlmProvider`만 안다.
- 타임아웃 60초(`AbortSignal.timeout`), 재시도 1회(타임아웃·5xx·429만, 즉시 재시도 금지 — 1초 대기). 4xx 인증 오류는 재시도하지 않는다.
- 어댑터는 **`fetch` 기반**이 기본이다(Workers 호환). 제공사 SDK는 Workers 호환(네이티브 모듈 없음·`fetch` 사용·workerd 동작 확인)일 때만 후보이며 선택·설치는 사용자 승인 후(설치 허가제). 호환이 불명확하면 `fetch` 직접 호출 어댑터로 간다.
- 출력 후처리(`postprocess.ts`): 앞뒤 공백·따옴표 정리, `세바스찬:`·`시엘:`·`[이름]` 같은 이름표 제거, 마크다운 펜스 제거, 빈 문자열이면 `LLM_EMPTY_OUTPUT`. 길이 상한(확정사항 1~3문장 지침이지만 하드 컷은 문자 수 기준 상수).
- `FakeProvider`(테스트용, 입력을 기록하고 고정 문자열 반환)를 `llm/fake.ts`에 둔다. 서비스 테스트는 전부 이걸 주입한다.

## 7. 프롬프트 조립 규칙 (`llm/prompt.ts`, 확정사항 §5.5)

1. 입력: 방 `memory.summary`(있으면) + 최근 메시지 `env.CONTEXT_MESSAGES`개(기본 40, 오래된 순) + 눌린 캐릭터 id.
2. **시스템 프롬프트** = 세계관 공통(`characters.ts`의 `WORLD`) + 눌린 캐릭터 설정(`characters[id].persona`) + 출력 규칙(고정 문자열: "지금은 {이름} 차례. {이름}의 행동·내면·대사만 1~3문장. 상대 캐릭터의 대사·행동 금지. 이름표·콜론·마크다운 금지.") + 장기기억("지금까지의 요약: …").
3. **대화 기록**은 `messages` 배열로 넘긴다. 캐릭터 발화는 `assistant`(내용 앞에 `시엘: `처럼 화자 표기), 유저 발화·OOC는 `user`(`[지시] …` / `[유저] …`). 마지막에 `user` 역할로 `"{이름}의 차례입니다."` 한 줄을 붙여 턴을 명시한다.
4. **유저 텍스트는 항상 대화 기록 쪽에만** 둔다. 시스템 프롬프트에 유저 입력을 섞지 않는다(프롬프트 주입 완화). 유저 텍스트 안의 `시스템:`·`무시하고` 같은 문구를 필터링하지는 않되, 출력 규칙은 시스템 프롬프트가 마지막에 다시 못 박는다.
5. 토큰 예산: 시스템 + 기록이 상한(상수 `MAX_PROMPT_CHARS`)을 넘으면 오래된 기록부터 자른다(요약이 있으면 요약이 그 자리를 대신한다).
6. `prompt.ts`는 **순수 함수**(DB·env·네트워크 의존 없음) — 입력 객체를 받아 `GenerateInput`을 돌려준다. 테스트 100%.

## 8. 캐릭터 상수 (`llm/characters.ts`)

```ts
export const CHARACTER_IDS = ['sebastian', 'ciel'] as const
export type CharacterId = (typeof CHARACTER_IDS)[number]
export type Character = { id: CharacterId; name: string; profileImage: string; persona: string }
export const WORLD: string
export const CHARACTERS: Record<CharacterId, Character>
```

- 2명 고정(확정사항 §1 🔒). 추가는 횡단 변경(system-architect).
- `persona` 텍스트는 상수 파일에 두되 400줄 한계 예외 대상(데이터 파일). 작성자는 미결(확정사항 §9-3) — 임시 문구에는 `// TODO(R-LLM-xxx): 지인 검수 대기` 표기.
- `speaker` DB 값과 `CharacterId`는 같은 문자열이다. 별도 매핑 금지.

## 9. 로그

- 요청 로그는 `server/src/app.ts`의 자체 미들웨어(server 소유. `hono/logger`는 쓰지 않는다 — 쿼리의 `?t=` 토큰을 로그에서 제외해야 하므로). 서비스 로그는 주입받은 `Logger { info, warn, error }`를 쓴다 — 구현은 `index.ts`에서 만든 얇은 함수 하나(JSON 한 줄, 레벨은 `env.LOG_LEVEL`)이며 Workers `console`에 쓰는 것은 그 안에서만. 서비스·모듈에서 `console.*` 직접 호출·모듈 전역 logger import 금지(테스트에서 끄기 위해). 수집은 `wrangler tail`.
- **금지 필드**: 토큰 원문·payload 전체, `TOKEN_SECRET`, `LLM_API_KEY`, 프롬프트 전문·LLM 응답 전문(길이·소요 ms만). 식별은 `mbId`·`roomId`·`messageId`.
- 유저가 입력한 텍스트는 로그에 남기지 않는다(개인 커뮤니티 대화).

## 10. 명명 규칙

- 파일·폴더: `kebab-case.ts`. 함수·변수: `camelCase`. 타입: `PascalCase`. 상수: `UPPER_SNAKE_CASE`.
- 서비스 공개 함수는 동사로 시작: `listRooms`, `createRoom`, `appendUserMessage`, `speak`, `regenerate`, `maybeSummarize`, `verifyToken`.
- DB 컬럼은 `snake_case`, 서비스 반환 객체는 `camelCase`(contract 타입과 1:1). 변환은 `db/` 경계에서 한 번만.
- 시각은 epoch **밀리초** `number`. DB에는 INTEGER로 저장.

## 11. 요구 기반 최소 구현

- 모든 모듈·함수·env 키·컬럼은 요구ID(R-xx)로 역추적된다. 역추적 안 되면 만들지 않는다.
- "DDB ABC에 있어서", "나중에 관리 화면이 생기면"은 사유가 아니다. 필요해 보이면 산출물에 **후보·사유**로 적고 사용자 판단에 넘긴다.
- 표준 강제 항목(AppError, env 검증, 마이그레이션 버전, FakeProvider, 로그 금지 필드)은 예외다.

## 12. 테스트 표준

- vitest + `@cloudflare/vitest-pool-workers`(`server/vitest.config.ts`가 `wrangler.toml`을 참조). 서버 테스트는 Node가 아니라 workerd 안에서 돌며 D1 바인딩을 받는다. 파일은 `server/test/{module}.test.ts`(모듈 단위) + 순수 함수는 소스 옆 `*.test.ts` 허용.
- **순수 로직**(토큰 파싱·서명 검증·프롬프트 조립·후처리·페이지네이션 커서·요약 기준 판정)은 입력→출력 단위 테스트. 시간은 `now` 인자로 주입한다.
- **DB 서비스**는 workers pool이 테스트마다 격리해 주는 D1 바인딩(`env.DB`)에 setup/`beforeEach`에서 마이그레이션 SQL을 적용해 쓴다. dev 로컬 상태(`server/.wrangler/`)·운영 DB 접근 금지.
- **LLM**은 항상 `FakeProvider` 주입. 실제 제공사 호출 테스트는 두지 않는다(수동 체크리스트 `doc/200_설계/server/llm.md`).
- **라우트** 테스트는 contract 계층 몫(`server/test/routes/`, Hono `app.request()`로 호출). server 테스트는 서비스 함수를 직접 부른다.
- Node 전용 API(`fs`·`path`·`child_process`)·네이티브 모듈을 쓰는 테스트·소스는 Workers 호환 위반이다. `nodejs_compat`로 되는 것(`node:crypto` 일부, `Buffer`)도 Web 표준(`crypto.subtle`, `TextEncoder`)이 있으면 그쪽을 쓴다.
- 에러 경로(각 에러 코드가 실제로 나오는 입력)를 정상 경로와 같은 수로 둔다.
- 완료 기준: `npx tsc --noEmit -p server` exit 0, `npx vitest run server` 전건 PASS. 결과 출력이 보고에 있어야 완료다.

## 13. 문서↔코드 양방향 일치

- 설계 문서 `doc/200_설계/server/{module}.md`와 모듈 `index.ts` 상단 문서주석은 같은 6항목([목적][공개 API][의존][에러][env 키][테스트])을 가진다.
- 구현 중 설계와 달라지면 코드를 맞추거나, 불가하면 **보고**한다. implementer가 설계 문서를 직접 고치지 않는다(designer 소관).
- 설계 문서의 공개 API 시그니처와 코드의 export 시그니처가 다르면 server-analyst가 HIGH로 잡는다.

## 14. contract 인계 규약

- server는 **엔드포인트 경로·응답 JSON 모양을 정의하지 않는다.** 대신 설계 문서에 「contract 요구 명세」 절을 둔다: 노출할 서비스 함수(시그니처·입력·반환·AppError 코드), 인증 필요 여부, 레이트리밋 필요 여부.
- contract-designer가 그 명세로 `doc/200_설계/contract/api.md`를 확정하고, contract-implementer가 `server/src/routes/`에서 서비스 공개 API를 호출한다.
- server 작업 중 contract 변경이 필요하면 server는 멈추지 않고 요구 명세만 갱신해 보고한다. 계약 확정은 contract-manager 세션.

## 15. 검토 체크리스트 (server-analyst · verify-server-reviewer 공용)

| # | 항목 | 심각도 |
|---|---|---|
| 1 | `process.env`·바인딩 설정 키 직접 읽기가 `env.ts` 밖에 있음 / 비밀값이 로그·응답·`wrangler.toml [vars]`에 노출 | CRITICAL |
| 2 | SQL 문자열 연결(파라미터 바인딩 미사용) | CRITICAL |
| 3 | 유저 입력이 시스템 프롬프트에 섞임 | HIGH |
| 4 | speak 방당 잠금 없음 또는 메모리 `Map` 잠금(D1 조건부 UPDATE 아님) / 요약이 응답을 블로킹(`waitUntil` 미사용) / 메모리 레이트리밋 카운터 | HIGH |
| 5 | 미처리 promise, `waitUntil` 작업 에러 미포착 | HIGH |
| 6 | 코드 없는 에러 throw, 라우트별 산발 try/catch 문자열 | HIGH |
| 7 | LLM 호출 타임아웃·재시도 규칙 위반, 제공사 SDK가 `llm/` 밖에서 import | HIGH |
| 8 | 마이그레이션 파일 사후 수정, 기동 시 자동 마이그레이션 코드, `batch` 없는 연쇄 삭제 | HIGH |
| 9 | 모듈 의존 방향 위반(§1), 서비스가 라우트·HTTP 객체를 앎 | HIGH |
| 10 | 요구ID로 역추적되지 않는 함수·컬럼·env 키 | MEDIUM |
| 11 | 문서주석 항목 누락, 설계 문서와 시그니처 불일치, `server/.dev.vars.example`·`wrangler.toml [vars]` ≠ `env.ts` | MEDIUM |
| 12 | 파일 400줄·함수 50줄 초과, `console.log`, eslint 경고 | LOW |
