---
name: contract-design-strategy
description: contract(API 계약) 계층의 설계·구현·검토 표준. ui→contract→server 단방향 위상과 4자+handoff 소유 파일(api.md·shared·routes·ui/api·doc/handoff), REST 경로·camelCase·epoch ms·에러코드 명명, `{ error: { code, message } }` 응답 규약, 갠홈 발급 HMAC 토큰 형식과 PHP 조각이 계약의 일부라는 원칙, 유사 기존 엔드포인트 확장 우선, 호환성 분류(추가/비파괴/파괴)와 파괴 변경 시 ui 인계, 레이트리밋·페이지네이션 규약, 계약→shared→routes→ui/api→handoff 동기화 순서와 대조표, 라우트 핸들러 얇게·zod 검증, 테스트(Hono app.request()·api 래퍼 mock), 화면의 fetch 직접 사용 금지, 요구 기반 최소 노출, api.md 절 구성을 정의한다. API 계약을 설계·확장·구현하거나 계약↔코드 일치를 검토할 때 반드시 참조한다.
---

# contract 설계 전략 (표준)

- contract 패키지 전 에이전트(contract-manager / contract-designer / contract-implementer / contract-analyst)가 이 규칙으로 판단한다.
- 계약 실물의 단일 소스는 `doc/200_설계/contract/api.md`. 이 스킬은 **규칙**, api.md는 **현재 계약값**이다.
- 제품 확정값(동작·권한·토큰·데이터)은 `doc/000_프로젝트_확정사항.md` §1·§5·§6을 따른다.

---

## 1. contract의 정의와 위상

```
ui (React, ui/src/)  →  contract (계약)  →  server (서비스, server/src/{rooms,messages,memory,auth,llm})
                            ↑
                   갠홈 PHP (저쪽) — 토큰 발급·임베드 주소
```

| 당사자 | 수단 | 소유 파일 |
|---|---|---|
| 문서(정본) | 계약 명세 | `doc/200_설계/contract/api.md` |
| 공용 타입 | 요청/응답 타입·에러코드·경로 상수 | `shared/src/types.ts` · `shared/src/errors.ts` · `shared/src/endpoints.ts` |
| 서버 쪽 | Hono 라우트 + zod 검증(`@hono/zod-validator`) + 토큰 미들웨어 | `server/src/routes/*.ts` |
| 화면 쪽 | fetch 래퍼(`Result<T>` 정규화) | `ui/src/api/*.ts` |
| 갠홈 쪽 | 토큰 발급 PHP 조각·임베드 안내 | `doc/handoff/*.md` |

- **단방향.** ui는 `ui/src/api/` 래퍼만 호출한다. server는 ui를 모르고 `server/src/routes/`를 통해서만 밖으로 낸다.
- contract는 **얇다.** 검증·저장·AI 호출 로직은 server 서비스가 갖고, 라우트 핸들러는 스키마 검증 → 인증 컨텍스트 전달 → 서비스 호출 → 응답 변환만 한다. 핸들러가 30줄을 넘으면 로직이 server로 가야 할 신호다.
- contract가 server 변경을 필요로 하면 **server 변경 요구 명세**(필요한 서비스 함수 시그니처·입출력·에러)를 만들어 매니저에 보고한다. server 내부를 직접 고치지 않는다.
- **갠홈 PHP 조각은 계약의 일부다.** 토큰 payload·서명 방식·쿼리 파라미터 이름이 바뀌면 `doc/handoff/`도 같은 패스에 갱신하고 변경 이력에 "저쪽 재적용 필요"를 명시한다.

## 2. 명명

| 대상 | 규칙 | 예 |
|---|---|---|
| 경로 | `/api/{자원}` 복수형, 하위 자원은 중첩, 동작은 마지막 세그먼트 동사 | `/api/rooms/:id/messages`, `/api/rooms/:id/speak`, `/api/messages/:id/regenerate` |
| 메서드 | 조회 GET · 생성 POST · 부분 수정 PATCH · 전체 교체 PUT · 삭제 DELETE. 동작 엔드포인트(speak·regenerate)는 POST | |
| 타입 | PascalCase. 요청은 `XxxRequest`, 응답은 `XxxResponse`, 자원은 명사 | `Room`, `Message`, `SpeakRequest`, `MessagesPage` |
| 필드 | camelCase (JSON·TS). DB snake_case는 server 안에서만 | `createdAt`, `authorName` |
| 에러 코드 | `대문자_스네이크`. 목록은 R-API-002 13종으로 고정(`shared/src/errors.ts` 정본). 새 코드는 요구 승격 뒤에만 | `TOKEN_INVALID`, `NOT_FOUND`, `SPEAK_IN_PROGRESS` |
| 경로 상수 | `shared/src/endpoints.ts`의 함수/상수 | `endpoints.speak(roomId)` |

- 경로에 버전(`/v1`)을 넣지 않는다(단일 소비자). 파괴 변경은 §6 절차로.
- 엔드포인트 이름에 구현 세부(`_v2`, `Impl`)를 넣지 않는다.

## 3. 페이로드 규약

| 항목 | 규칙 |
|---|---|
| 필드 | camelCase. TS 타입과 JSON이 1:1 |
| 시각 | `createdAt: number` = Unix epoch **밀리초** |
| 식별자 | `id: string`(room은 nanoid/uuid), `id: number`(message는 INTEGER PK). 혼용하지 않는다 |
| 열거 | 문자열 리터럴 유니온(`speaker: 'sebastian' \| 'ciel' \| 'user'`, `kind: 'line' \| 'ooc'`). 숫자 열거 금지 |
| 없음 | `null`로 표현(`summary: string \| null`). `undefined`·빈 문자열로 "없음"을 표현하지 않는다 |
| 페이지 | `{ messages: Message[], hasMore: boolean }`(`MessagesPage`). 요청은 `?before={messageId}&limit=`(limit 정수 1~100, 생략 시 **30**, 넘으면 `400`). `messages`는 오래된→새 순. 다음(더 오래된) 페이지는 `hasMore === true`일 때 `before = messages[0].id`로 다시 부른다. 별도 커서 필드는 없다(R-MSG-001) |
| 텍스트 길이 | 요청 스키마에 `maxLength`(user 텍스트 2000, 방 제목 60, memory 8000). 초과는 `400 VALIDATION_ERROR` |
| 한국어 | `message` 문구만 한국어. 코드·키는 영문 |

## 4. 인증·에러 규약

### 4.1 토큰 (확정사항 §5.3)

- 헤더 `Authorization: Bearer <token>`. 화면은 `?t=`에서 읽어 메모리에만 둔다.
- 형식 `base64url(payloadJson) + '.' + base64url(hmacSha256(payloadJson, TOKEN_SECRET))`. payload `{ mb_id: string, nick: string, ch_name: string | null, level: number, exp: number }`(exp = epoch **초**, 발급 + 12h). 이 JSON은 갠홈 PHP가 만들기 때문에 필드 이름은 R-AUTH-001대로 snake_case다 — API 본문 camelCase 규칙(§3)의 유일한 예외.
- 서버 검사 순서: 형식 → 서명(타이밍 안전 비교) → `exp` → `level >= TOKEN_MIN_LEVEL`. 실패 코드: 형식·서명·만료는 모두 `TOKEN_INVALID`(401), 등급 미달은 `LEVEL_TOO_LOW`(403). 쓰기 요청에 토큰 없음은 `TOKEN_REQUIRED`(401). 만료 전용 코드는 없다(R-AUTH-002·003).
- 읽기 엔드포인트(`GET /api/rooms`, `GET …/messages`, `GET /api/health`)는 토큰 없이 허용. 토큰이 있으면 검증해 컨텍스트만 채운다(잘못된 토큰이어도 읽기는 거절하지 않는다 — 화면이 쓰기 UI를 숨길 수 있게 응답에 `viewer: { canWrite: boolean }`을 포함하는 것은 contract-designer가 결정).
- PHP 조각은 같은 payload·같은 서명 방식을 쓴다. `hash_hmac('sha256', $payload, SECRET, true)` + base64url. 조각 원문은 `doc/handoff/token-snippet.php.md`.

### 4.2 에러 응답

- 모든 실패 응답은 `{ error: { code, message } }` + HTTP status. 성공 응답에는 `error` 키가 없다.
- `message`는 **사용자에게 그대로 보여도 되는 한국어 한 문장**. 내부 경로·SQL·스택·제공사 원문은 넣지 않는다.
- 에러 코드는 `shared/src/errors.ts`가 정본이고 api.md §3 표가 이를 전사한다. 목록은 R-API-002 🔒 13종으로 고정 — 새 코드는 요구 승격 뒤에 둘 다에 추가하고 발생 조건·status를 적는다.

| 코드 | status | 발생 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 경로·쿼리·본문 스키마 위반(필드·길이·enum·범위), JSON 파싱 실패 |
| `TOKEN_REQUIRED` | 401 | 쓰기 요청에 토큰 없음 |
| `TOKEN_INVALID` | 401 | 토큰 형식·서명·**만료** 실패(만료 전용 코드 없음) |
| `LEVEL_TOO_LOW` | 403 | 등급 미달 |
| `RATE_LIMITED` | 429 | `mb_id` 단위 분당 쓰기 초과 |
| `NOT_FOUND` | 404 | 없는 방·메시지, 매칭 없는 경로·메서드, `/embed` 파일 없음(자원별 코드 없음) |
| `SPEAK_IN_PROGRESS` | 409 | 같은 방 생성 중(speak·regenerate) |
| `NOT_LAST_MESSAGE` | 409 | 재작성 대상이 마지막 메시지가 아님 |
| `NOT_CHARACTER_MESSAGE` | 400 | 재작성 대상이 유저 메시지 |
| `LLM_FAILED` | 502 | 제공사 호출 최종 실패(타임아웃·인증·제공사 오류 모두 이 하나) |
| `LLM_EMPTY` | 502 | 후처리 결과가 빈 문자열 |
| `CONFIG_INVALID` | 500 | `parseEnv` 실패(모든 경로), `LLM_API_KEY` 누락(speak·regenerate) |
| `INTERNAL` | 500 | 그 밖의 예상 못 한 오류 |

- 라우트·서비스는 `AppError`를 **throw만** 한다. `{ error: { code, message } }` 변환은 server 진입점(`server/src/app.ts`)의 `onError` **한 곳**이 한다. 핸들러마다 `catch`로 문자열을 만들지 않고, routes에 에러 핸들러를 두지 않는다.
- 클라이언트 전용 코드 `NETWORK`(fetch 자체 실패)는 서버가 내지 않으므로 `ErrorCode`에 넣지 않는다. `ui/src/api/client.ts`의 `ApiErrorCode = ErrorCode | 'NETWORK'`에만 있다(§11).

## 5. 확장 vs 신규 판정

새 요구가 오면 **먼저 api.md에서 유사 엔드포인트를 찾는다.**

| 상황 | 판정 |
|---|---|
| 같은 자원의 같은 동작에 필드·쿼리만 더 필요 | **확장** — 선택 필드 추가(호환성 「추가」) |
| 같은 자원의 새 동작 | **신규 엔드포인트**, 같은 경로 접두어 |
| 새 자원 | 신규 타입 + 신규 경로 |
| 기존 엔드포인트의 의미가 바뀜 | 파괴 변경 — §6 절차. 새 경로로 만들고 옛것을 폐기하는 쪽을 우선 검토 |

- "나중에 쓸 것 같아서" 필드·엔드포인트를 미리 만들지 않는다(§12).
- 하나의 엔드포인트가 두 가지 일을 하면 분리한다. 단 `speak`의 "메시지 저장 + 요약 트리거"처럼 한 동작의 부수 효과는 허용 — api.md 「부수 효과」 열에 명시한다.

## 6. 호환성 분류와 파괴 변경 인계

| 분류 | 정의 | ui / 갠홈 영향 |
|---|---|---|
| **추가** | 새 엔드포인트, 응답에 **선택** 필드 추가, 요청에 선택 필드 추가 | 없음 |
| **비파괴 변경** | message 문구, 검증 완화, 레이트리밋 값, 에러 코드 추가 | 없음 |
| **파괴 변경** | 필드 삭제·이름·타입 변경, **필수** 요청 필드 추가, 경로·메서드 변경, 응답 형태 변경, 검증 강화, **토큰 payload·서명·쿼리 이름 변경** | ui 수정 필요 / 갠홈 PHP 재적용 필요 |

파괴 변경 절차:
1. contract-designer가 api.md 「변경 이력」에 분류=파괴, 영향 받는 ui 호출 지점(`grep`으로 `ui/src/api` 래퍼 사용처)과 handoff 영향을 적는다.
2. contract-manager가 **ui 변경 요구 명세**(바뀐 계약, 옛→새 매핑, 영향 화면)를 사용자에게 보고한다. 토큰 변경이면 **저쪽 전달 사항**도 함께. contract는 화면을 고치지 않는다.
3. 사용자 허락 후 ui-manager 세션으로 인계한다. 인계는 **단방향** — ui 작업 중 새 contract 요구가 나오면 별도 요구로 사용자 확인 후 contract부터 다시 시작한다(왕복 금지).
4. 구축(build) 모드에서는 task-manager가 server→contract→ui를 한 흐름으로 다루므로 인계 없이 다음 계층 설계 입력으로 넘긴다.

## 7. 레이트리밋·페이지네이션·CSP

| 항목 | 규칙 |
|---|---|
| 쓰기 레이트리밋 | D1 `rate_limits(mb_id, window_start, count)` 조건부 UPSERT(server §4 — Workers는 인스턴스가 여럿이라 메모리 카운터·외부 플러그인 금지), 키 = 토큰 `mb_id`, `env.RATE_LIMIT_PER_MIN`(기본 20). 초과 `429 RATE_LIMITED`, 응답에 `retryAfterSec`(R-AUTH-005) |
| speak 동시성 | 방당 1건(server §4). 라우트는 `409 SPEAK_IN_PROGRESS`를 그대로 전달 |
| 페이지네이션 | `before` 커서(메시지 id) + `limit`(기본 30·최대 100). 첫 요청은 `before` 없음 = 최신부터. 응답 `{ messages, hasMore }`에서 `hasMore`가 `false`면 끝, `true`면 `before = messages[0].id`로 다음 페이지(§3) |
| 임베드·CSP | **모든 응답**(`/embed`·`/api/*`·에러 응답 포함)에 같은 `Content-Security-Policy: frame-ancestors {env.ALLOWED_FRAME_ANCESTORS}`(R-API-006). 헤더는 server 진입점 미들웨어가 붙이고 routes는 건드리지 않는다. `X-Frame-Options`는 보내지 않는다(CSP가 우선). 설정 파싱 실패 응답만 허용 출처를 비운다(server index.md §3.1 ②) |
| CORS | 동일 출처(iframe이 서버에서 내려옴)라 기본 미허용. 로컬 dev는 Vite 프록시로 해결. 외부 출처 허용은 요구가 있을 때만 |
| 헬스 | `GET /api/health` → `{ ok: true, version }`. `/deploy` 헬스체크 대상 |

## 8. 4자 + handoff 동기화

순서는 항상 **api.md → shared → routes → ui/api → handoff**. 코드를 먼저 고치고 문서를 맞추지 않는다.

구현·감사 시 **대조표**를 남긴다(contract-implementer 완료 보고 필수, contract-analyst 감사 출력 필수):

| 계약 항목 | api.md | shared (`types.ts`/`errors.ts`/`endpoints.ts`) | routes (`server/src/routes/*`) | ui/api (`ui/src/api/*`) | 판정 |
|---|---|---|---|---|---|
| `POST /api/rooms/:id/speak` `SpeakRequest.character` | §4.6 | `SpeakRequest` | `speakRoute` 스키마 `character: enum` | `speak(roomId, character)` | ✅ |
| `TOKEN_INVALID` 401(형식·서명·만료) | §3 | `ERROR_CODES`의 `'TOKEN_INVALID'` · `ERROR_STATUS` 401 | `requireAuth` 미들웨어 | `Result.error.code` 분기 | ✅ |

- 대조 기준: 경로·메서드·요청/응답 필드·타입·optional 여부·에러 코드 목록·status·토큰 요구 여부.
- 경로 문자열은 `shared/src/endpoints.ts` **한 곳**에만 둔다. 라우트·래퍼에 리터럴 경로가 나타나면 결함(CON 감사 항목).
- 토큰 형식은 `shared/src/types.ts`의 `TokenPayload` + `doc/handoff/token-snippet.php.md`의 PHP 조각이 같은 필드를 가진다. 대조표에 한 행으로 포함한다.
- 요청 검증 스키마는 **zod 하나**로 통일한다(`@hono/zod-validator`). `shared/src/types.ts`의 타입과 라우트의 zod 스키마는 `z.infer`·`satisfies`로 묶어 어긋나면 tsc가 잡게 한다. 스키마 위치(shared vs routes)는 contract-designer가 api.md §5에서 확정한다.

## 9. 라우트 구현 규칙 (`server/src/routes/`)

- 파일 = 자원 단위(`health.ts`, `rooms.ts`, `messages.ts`, `memory.ts`) + 공통 `validate.ts`(zod-validator 래퍼)·`schemas.ts`(zod 스키마). `index.ts`는 `export const apiRoutes = new Hono<AppEnv>()`에 자원 라우트를 `route()`로 묶어 **내보내기만** 한다. 앱 조립은 server 진입점(`server/src/index.ts` → `app.ts`)이 `apiRoutes`를 마운트해서 한다.
- **routes가 갖지 않는 것:** `/embed` 서빙, `onError`, `notFound`, 요청 로그, CSP 헤더. 모두 server 진입점 `server/src/app.ts` 소유다(server index.md §9.1). routes는 `AppError`를 throw만 하고 응답 본문을 직접 만들지 않는다. routes에 `embed` 파일·에러 핸들러가 있으면 결함.
- 핸들러 형태 고정: `validate('param'|'query'|'json', schema)`(실패 시 `AppError('VALIDATION_ERROR', 400)` throw — zod-validator 기본 응답은 계약 형식이 아니라 쓰지 않는다) → `requireAuth`(쓰기) 또는 `optionalAuth`(읽기) 미들웨어 → 서비스 호출 → `c.json(dto, status)`.
- 핸들러 위 자기문서화 주석: `// [계약] api.md §4.6 · [요구] R-API-xxx · [에러] SPEAK_IN_PROGRESS, LLM_FAILED · [부수효과] 요약 백그라운드 트리거`
- 서비스는 `AuthContext`를 **인자로** 받는다. 라우트가 `c.get('auth')`를 꺼내 넘긴다. 서비스가 Hono `Context`를 알면 결함. 응답 뒤 작업은 라우트가 `c.executionCtx.waitUntil()`로 넘긴다.
- 정적 파일(`/embed`, `ui/dist`)은 Workers Static Assets(`server/wrangler.toml [assets]`, 바인딩 `ASSETS`)가 서빙하고, `/embed` → `ASSETS.fetch` 매핑은 server `app.ts`가 한다(routes 밖). contract 몫은 경로 상수 `PATHS.embed`(shared)와 api.md §4의 `/embed` 명세(헤더·에러·`?t=` 전달)뿐이다. `?t=`는 서버가 읽지 않는다(화면 JS가 읽음).

## 10. 테스트

| 대상 | 방법 | 위치 |
|---|---|---|
| 라우트 | Hono `app.request(path, init, env)`로 실제 앱에 요청(`@cloudflare/vitest-pool-workers`, workerd 안에서 D1 바인딩 포함). 서비스는 FakeProvider·격리 D1로 실물 사용. 토큰은 테스트용 SECRET으로 Web Crypto로 직접 생성 | `server/test/routes/*.test.ts` |
| 스키마 | 잘못된 body·query가 `400 VALIDATION_ERROR`로 닫히는지 | 같은 파일 |
| 토큰 | 위조·만료·등급 미달·정상 4경로 + 타이밍 안전 비교 | `server/test/routes/auth.test.ts` |
| ui 래퍼 | `fetch`를 `vi.stubGlobal`로 대체해 경로·헤더·`Result` 변환 검증 | `ui/src/api/__tests__/*.test.ts` |
| PHP 조각 | 자동 테스트 불가 → Node로 같은 payload·SECRET으로 만든 토큰과 PHP 출력이 일치하는지 수동 체크리스트(`doc/handoff/`에 절차) | — |
| 실물 E2E | ui-tester 소관(브라우저). contract는 하지 않는다 | — |

- 구현 완료 보고에는 `npx vitest run server/test/routes ui/src/api` 결과, `npx tsc --noEmit`(세 워크스페이스) exit 0을 **실행 출력으로** 싣는다.
- 에러 경로(각 에러 코드가 실제로 나오는 요청) 테스트를 정상 경로와 같은 수로 둔다.

## 11. 화면의 contract 사용 규칙 (ui 계층 경계)

- 화면·컴포넌트·훅은 `import { speak, listMessages } from '@/api'`처럼 **래퍼만** 쓴다. `fetch`를 `ui/src/api/` 밖에서 쓰면 경계 위반이다.
- 래퍼는 엔드포인트 하나에 함수 하나. 래퍼 안에 화면 로직(스크롤·낙관적 갱신)을 넣지 않는다.
- **래퍼는 어떤 경우에도 throw·reject하지 않는다.** 모든 함수는 `Promise<Result<T>>`를 반환한다 — `type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError }`, `type ApiError = { code: ApiErrorCode; message: string }`, `type ApiErrorCode = ErrorCode | 'NETWORK'`. `ApiError`는 **타입**이다(에러 클래스·`instanceof` 분기 금지). 네트워크 실패(오프라인·DNS·연결 거부)는 `{ code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }`로, 계약 형식이 아닌 응답은 `INTERNAL` 기본 문구로 정규화한다(api.md §3.4). 화면은 `result.ok` 분기만 쓰고 `try/catch`를 쓰지 않으며, 표시는 `labels.ts`로 결정한다. (ts-rules.md와 동일 규칙)
- 토큰은 `ui/src/api/client.ts`가 생성 시 1회 받아 메모리에 보관하고 헤더에 붙인다. 화면은 토큰 문자열을 만지지 않는다.
- contract-analyst는 `grep -rn "fetch(" ui/src --include=*.ts --include=*.tsx`로 `ui/src/api/` 밖 사용을 감사한다.

## 12. 요구 기반 최소 노출

- 엔드포인트·필드는 **요구ID(R-xx)로 역추적**될 때만 만든다. api.md 표의 요구ID 열이 비어 있으면(`미정`) 요구 확정 후 채우고, 어떤 요구에도 닿지 않으면 제거 후보다.
- 디버그·진단용 엔드포인트(`/api/debug/*`)는 사용자가 요구했을 때만, `env.NODE_ENV !== 'production'`에서만 등록한다.
- server 내부 상태(전체 env, 캐릭터 persona 원문)를 통째로 넘기는 엔드포인트를 만들지 않는다. 화면이 필요한 형태로 잘라서 준다.

## 13. 산출물·문서 규약

- api.md 절 구성 고정: **§1 개요·위상 / §2 인증·토큰 / §3 공통 응답·에러 코드 / §4 엔드포인트별 명세(경로·메서드·토큰·요청·응답·에러·부수효과·요구ID) / §5 타입(TS + JSON 예시 + 스키마 방식) / §6 레이트리밋·페이지네이션 / §7 임베드·CSP / §8 handoff(저쪽 전달물 목록·재적용 조건) / §9 변경 이력 / §10 요구 추적표**. 절 번호를 바꾸지 않는다(에이전트가 §번호로 인용).
- 변경 이력에는 버전·일자·변경·호환성 분류·저쪽 재적용 여부를 한 줄로 남긴다. 초안 `v0.x`, 사용자 확정 시 `v1`.
- `doc/handoff/` 파일 3종: `embed-guide.md`(저쪽이 할 일 순서·주소 입력 위치·확인 방법), `token-snippet.php.md`(PHP 조각 원문·붙이는 위치·발급 조건·`?t=` 부착·비회원 분기·검증 절차), `secret-handover.md`(SECRET 생성·전달·교체 절차). 실값(SECRET·도메인)은 넣지 않고 `{{PLACEHOLDER}}`로.
