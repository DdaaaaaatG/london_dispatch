# Node/Fastify 서버 코드 작성 규칙

server 계층(`server/src`) 공통 규칙. 설계 기준은 [server-design-strategy](server-design-strategy/SKILL.md), 기본 TS 규칙은 [ts-rules](ts-rules.md).

## 포맷·린트
- prettier 기본(세미콜론 없음, 작은따옴표). eslint 경고 0. `// eslint-disable`은 사유 주석과 함께 줄 단위로만.
- 파일 400줄, 함수 50줄 한계. 라우트 핸들러 30줄. 넘으면 분리한다.

## 모듈 형식
- ESM(`"type": "module"`). import 경로는 확장자 포함(`'./env.js'`) 또는 tsconfig `moduleResolution: bundler` 설정에 맞춘다 — 프로젝트 설정 하나를 따르고 섞지 않는다.
- **named export만.** `export default`는 Fastify 플러그인 파일(`routes/index.ts`)에만 허용.
- 모듈 = 폴더 + `index.ts`. 공개 API는 `index.ts`에서 재노출. 다른 모듈의 내부 파일 직접 import 금지.

## env
```typescript
// Bad — 아무 데서나
const key = process.env.LLM_API_KEY
// Good — env.ts만 읽고, 나머지는 env 객체
import { env } from '../env'
const provider = createProvider(env)
```
- `process.env`는 `server/src/env.ts` 한 파일. zod로 검증해 `env`를 export. 훅이 강제한다.

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
- 변환은 `routes/index.ts`의 `setErrorHandler` 한 곳. 핸들러 안 try/catch로 응답을 직접 만들지 않는다.
- 예상 못 한 에러는 `INTERNAL`(500)로 닫고 `request.log.error({ err })`. 응답에 스택 없음.

## 비동기
- 핸들러·서비스는 `async`. `.then()` 체인 대신 `await`.
- 백그라운드 작업은 명시적으로:
  ```typescript
  void runBackground('summarize', () => memory.maybeSummarize(roomId), request.log)
  ```
  `runBackground`는 에러를 잡아 로그만 남긴다. 떠다니는 promise 금지(eslint `@typescript-eslint/no-floating-promises`).
- 외부 호출에는 항상 `AbortSignal.timeout(ms)`. 무한 대기 금지.

## 의존성 주입
- 서비스 팩토리는 의존을 인자로 받는다: `createMessagesService({ db, llm, memory, logger })`. 모듈 전역 싱글턴 import 금지(테스트에서 FakeProvider·임시 DB를 넣기 위해).
- `request`·`reply` 객체는 라우트 밖으로 나가지 않는다. 서비스는 `AuthContext`·평범한 인자만 받는다.

## SQLite
```typescript
// Bad
db.prepare(`SELECT * FROM messages WHERE room_id = '${roomId}'`)
// Good
const stmt = db.prepare('SELECT * FROM messages WHERE room_id = ? ORDER BY id DESC LIMIT ?')
const rows = stmt.all(roomId, limit)
```
- 파라미터 바인딩만. prepared statement는 모듈 로드 시 1회.
- 행 → 도메인 객체 변환(`snake_case` → `camelCase`, INTEGER → number)은 `db/` 경계 함수 한 곳에서.
- 여러 문장 = `db.transaction(fn)()`. 마이그레이션 파일은 추가만, 수정 금지.

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
- `request.log` 또는 주입된 `logger`(pino). `console.*` 금지.
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
- DB는 임시 파일, LLM은 `FakeProvider`, 시간은 `now` 인자 주입. 실제 네트워크·실제 `data/` 접근 금지.
- 에러 경로 테스트 수 ≥ 정상 경로 테스트 수.

## 주석
- "무엇"이 아니라 "왜"를 적는다. 재시도 정책, 잠금 이유, 요약 임계 근거, 프롬프트 순서 이유.
- TODO는 `// TODO(요구ID): 내용` 형식. 요구ID 없는 TODO 금지.
