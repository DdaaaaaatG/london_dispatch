# Workers/Hono 서버 코드 작성 규칙

server 계층(`server/src`, Cloudflare Workers + Hono 4 + D1) 공통 규칙. 설계 기준은 [server-design-strategy](server-design-strategy/SKILL.md), 기본 TS 규칙은 [ts-rules](ts-rules.md).

## 포맷·린트
- prettier 기본(세미콜론 없음, 작은따옴표). eslint 경고 0. `// eslint-disable`은 사유 주석과 함께 줄 단위로만.
- 파일 400줄, 함수 50줄 한계. 라우트 핸들러 30줄. 넘으면 분리한다.

## 모듈 형식
- ESM(`"type": "module"`). wrangler(esbuild)가 번들하므로 tsconfig는 `moduleResolution: bundler`, 타입은 `@cloudflare/workers-types`(또는 `wrangler types` 산출물). 프로젝트 설정 하나를 따르고 섞지 않는다.
- **named export만.** `export default`는 Worker 진입 `index.ts`의 `export default { fetch, scheduled }`에만 허용.
- Node 전용 모듈(`fs`·`path`·`child_process`·네이티브 애드온) import 금지. `node:` 접두 모듈은 `nodejs_compat`가 지원하고 Web 표준 대체가 없을 때만.
- 모듈 = 폴더 + `index.ts`. 공개 API는 `index.ts`에서 재노출. 다른 모듈의 내부 파일 직접 import 금지.

## env
```typescript
// Bad — 아무 데서나 바인딩·process.env 읽기
const key = process.env.LLM_API_KEY
const key2 = (c.env as any).LLM_API_KEY
// Good — index.ts가 parseEnv로 한 번 검증해 값으로 주입
export default {
  async fetch(request: Request, raw: unknown, ctx: ExecutionContext) {
    const env = parseEnv(raw)            // server/src/env.ts — 유일한 읽기 지점
    const provider = createProvider(env)
    …
  },
}
```
- Workers에는 `process.env`가 없다. 바인딩 설정 키를 읽는 곳은 `server/src/env.ts`의 `parseEnv(raw)` 한 함수. zod로 검증한 `Env` 값을 서비스 팩토리 인자로 넘긴다. `process.env`·`import.meta.env`가 다른 파일에 있으면 훅이 차단한다.
- 비밀값은 Cloudflare Secrets(로컬 `server/.dev.vars`), 비밀 아닌 설정은 `server/wrangler.toml [vars]`. 코드에서 둘은 같은 `env` 바인딩으로 보인다.

## 에러 처리
```typescript
// Bad
throw new Error('room not found')
throw 'not found'
// Good
throw new AppError('ROOM_NOT_FOUND', 404, '방을 찾을 수 없습니다.')
// Good — 외부 에러 감싸기
catch (cause) { throw new AppError('LLM_PROVIDER_ERROR', 502, 'AI 응답 생성에 실패했습니다.', { cause }) }
```
- 서비스는 `AppError`만 throw. 코드는 `@shared/errors`의 상수. 메시지는 한국어 한 문장(사용자 노출 가능).
- 변환은 진입점 `server/src/app.ts`의 Hono `app.onError`·`notFound` 한 곳(server 소유). routes는 throw만. 핸들러 안 try/catch로 응답을 직접 만들지 않는다.
- 예상 못 한 에러는 `INTERNAL`(500)로 닫고 `logger.error({ err })`. 응답에 스택 없음.

## 비동기
- 핸들러·서비스는 `async`. D1 호출(`run/first/all/batch`)도 전부 `await`. `.then()` 체인 대신 `await`.
- 응답 뒤에 이어갈 작업은 `ctx.waitUntil`로 명시적으로:
  ```typescript
  c.executionCtx.waitUntil(runBackground('summarize', () => memory.maybeSummarize(roomId), logger))
  ```
  `runBackground`는 에러를 잡아 로그만 남긴다. `waitUntil` 없이 떠다니는 promise는 응답 직후 중단될 수 있고 eslint(`@typescript-eslint/no-floating-promises`)도 막는다.
- 잠금·카운터를 프로세스 메모리(`Map`·모듈 변수)에 두지 않는다(인스턴스 여럿). speak 잠금은 `rooms.speaking_until` 조건부 UPDATE, 레이트리밋은 `rate_limits` 조건부 UPSERT.
- 외부 호출에는 항상 `AbortSignal.timeout(ms)`. 무한 대기 금지.

## 의존성 주입
- 서비스 팩토리는 의존을 인자로 받는다: `createMessagesService({ db, llm, memory, logger })`. 모듈 전역 싱글턴 import 금지(테스트에서 FakeProvider·임시 DB를 넣기 위해).
- Hono `Context`(`c`, `c.req`, `c.env`, `c.executionCtx`)는 라우트 밖으로 나가지 않는다. 서비스는 `AuthContext`·평범한 인자·(필요하면) `waitUntil` 콜백만 받는다.

## D1
```typescript
// Bad
db.prepare(`SELECT * FROM messages WHERE room_id = '${roomId}'`)
// Good — 비동기, 바인딩, 타입 지정
const { results } = await db
  .prepare('SELECT * FROM messages WHERE room_id = ? ORDER BY id DESC LIMIT ?')
  .bind(roomId, limit)
  .all<MessageRow>()
// Good — 원자적 다중 문장
await db.batch([
  db.prepare('DELETE FROM memory WHERE room_id = ?').bind(roomId),
  db.prepare('DELETE FROM messages WHERE room_id = ?').bind(roomId),
  db.prepare('DELETE FROM rooms WHERE id = ?').bind(roomId),
])
// Good — 경합은 조건부 UPDATE + meta.changes
const r = await db.prepare('UPDATE rooms SET speaking_until = ? WHERE id = ? AND (speaking_until IS NULL OR speaking_until < ?)').bind(until, roomId, now).run()
if (r.meta.changes === 0) throw new AppError('SPEAK_IN_PROGRESS', 409, '이미 생성 중입니다.')
```
- 파라미터 바인딩만(`?`). `db`는 `createDb(env.DB)`로 감싼 D1 바인딩이며 서비스에 주입한다.
- 행 → 도메인 객체 변환(`snake_case` → `camelCase`, INTEGER → number)은 `db/` 경계 함수 한 곳에서.
- 여러 문장 = `db.batch([...])`. 읽고-쓰는 흐름은 batch로 못 묶으니 조건부 UPDATE로. 마이그레이션은 `server/migrations/NNNN_*.sql` 추가만, 수정 금지, 적용은 `wrangler d1 migrations apply`(코드에서 실행하지 않는다).

## 매직 넘버
```typescript
// Bad
if (messages.length > 60) { ... }
// Good
if (messages.length > env.MEMORY_SUMMARY_THRESHOLD) { ... }
const LLM_TIMEOUT_MS = 60_000 // 확정사항 §5.5
```
- 임계값·타임아웃·상한은 `env` 또는 모듈 상단 `const`. 확정사항 값(40·60·60초·12h·limit 100)은 출처 주석.

## 로그
- 주입된 `logger`(`index.ts`가 만든 얇은 JSON 한 줄 로거, `wrangler tail`로 수집). 서비스·모듈에서 `console.*` 직접 호출 금지(로거 구현 안에서만).
- 금지 필드: 토큰 원문·payload, `TOKEN_SECRET`, `LLM_API_KEY`, 프롬프트 전문, LLM 응답 전문, 유저 입력 텍스트. 허용: `mbId`, `roomId`, `messageId`, 길이, 소요 ms, 에러 코드.
```typescript
// Bad
log.info({ token, prompt })
// Good
log.info({ mbId, roomId, promptChars: prompt.length, ms }, 'speak done')
```

## 문서주석
- 모듈 `index.ts` 상단 블록 주석에 [목적][공개 API][의존][에러][env 키][테스트] 6항목 = `doc/200_설계/server/{module}.md`.
- 공개 함수마다 JSDoc 한 줄 이상. 실패 조건(어떤 `AppError`)을 적는다.
- 라우트 핸들러 위: `// [계약] api.md §4.n · [요구] R-… · [에러] … · [부수효과] …`

## 이름
- 파일·폴더 `kebab-case`. 함수·변수 `camelCase`. 타입 `PascalCase`. 상수 `UPPER_SNAKE_CASE`.
- 동사로 시작하는 서비스 함수: `listRooms`, `createRoom`, `appendUserMessage`, `speak`, `regenerate`, `verifyToken`, `maybeSummarize`.
- 시각 변수는 단위 접미사: `createdAtMs`, `timeoutMs`, `expSec`.

## 테스트
- vitest. 순수 로직은 소스 옆 `*.test.ts`, 서비스는 `server/test/{module}.test.ts`, 라우트는 `server/test/routes/*.test.ts`(contract 몫).
- 테스트 이름은 `동작_조건_기대` 형태: `verifyToken_rejects_when_signature_mismatch`, `speak_throws_SPEAK_IN_PROGRESS_when_locked`.
- 서버 테스트는 `@cloudflare/vitest-pool-workers`(workerd)에서 돈다. DB는 pool이 격리해 주는 D1 바인딩에 setup에서 마이그레이션 적용, LLM은 `FakeProvider`, 시간은 `now` 인자 주입. 실제 네트워크·dev 로컬 D1(`server/.wrangler/`)·운영 DB 접근 금지. 라우트 테스트는 `app.request()`.
- 에러 경로 테스트 수 ≥ 정상 경로 테스트 수.

## 주석
- "무엇"이 아니라 "왜"를 적는다. 재시도 정책, 잠금 이유, 요약 임계 근거, 프롬프트 순서 이유.
- TODO는 `// TODO(요구ID): 내용` 형식. 요구ID 없는 TODO 금지.
