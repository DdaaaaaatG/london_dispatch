---
name: contract-design-strategy
description: contract(API 계약) 계층의 설계·구현·검토 표준. ui→contract→server 단방향 위상과 4자+handoff 소유 파일(api.md·shared·routes·ui/api·doc/handoff), REST 경로·camelCase·epoch ms·에러코드 명명, `{ error: { code, message } }` 응답 규약, 갠홈 발급 HMAC 토큰 형식과 PHP 조각이 계약의 일부라는 원칙, 유사 기존 엔드포인트 확장 우선, 호환성 분류(추가/비파괴/파괴)와 파괴 변경 시 ui 인계, 레이트리밋·페이지네이션 규약, 계약→shared→routes→ui/api→handoff 동기화 순서와 대조표, 라우트 핸들러 얇게·스키마 검증, 테스트(supertest·api 래퍼 mock), 화면의 fetch 직접 사용 금지, 요구 기반 최소 노출, api.md 절 구성을 정의한다. API 계약을 설계·확장·구현하거나 계약↔코드 일치를 검토할 때 반드시 참조한다.
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
| 서버 쪽 | Fastify 라우트 + JSON 스키마 + preHandler | `server/src/routes/*.ts` |
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
| 에러 코드 | `대문자_스네이크`, `도메인_원인` | `TOKEN_EXPIRED`, `ROOM_NOT_FOUND`, `SPEAK_IN_PROGRESS` |
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
| 페이지 | `{ items: T[], nextBefore: number \| null }`. 요청은 `?before={messageId}&limit=`(limit ≤ 100, 기본 40). 오래된 순으로 정렬해 반환 |
| 텍스트 길이 | 요청 스키마에 `maxLength`(user 텍스트 2000, 방 제목 60, memory 8000). 초과는 `400 VALIDATION_FAILED` |
| 한국어 | `message` 문구만 한국어. 코드·키는 영문 |

## 4. 인증·에러 규약

### 4.1 토큰 (확정사항 §5.3)

- 헤더 `Authorization: Bearer <token>`. 화면은 `?t=`에서 읽어 메모리에만 둔다.
- 형식 `base64url(payloadJson) + '.' + base64url(hmacSha256(payloadJson, TOKEN_SECRET))`. payload `{ mbId: string, nick: string, chName: string | null, level: number, exp: number }`(exp = epoch 초).
- 서버 검사 순서: 형식 → 서명(타이밍 안전 비교) → `exp` → `level >= TOKEN_MIN_LEVEL`. 실패 코드: `TOKEN_INVALID`(401) · `TOKEN_EXPIRED`(401) · `LEVEL_TOO_LOW`(403). 토큰 없음은 `AUTH_REQUIRED`(401).
- 읽기 엔드포인트(`GET /api/rooms`, `GET …/messages`, `GET /api/health`)는 토큰 없이 허용. 토큰이 있으면 검증해 컨텍스트만 채운다(잘못된 토큰이어도 읽기는 거절하지 않는다 — 화면이 쓰기 UI를 숨길 수 있게 응답에 `viewer: { canWrite: boolean }`을 포함하는 것은 contract-designer가 결정).
- PHP 조각은 같은 payload·같은 서명 방식을 쓴다. `hash_hmac('sha256', $payload, SECRET, true)` + base64url. 조각 원문은 `doc/handoff/token-snippet.php.md`.

### 4.2 에러 응답

- 모든 실패 응답은 `{ error: { code, message } }` + HTTP status. 성공 응답에는 `error` 키가 없다.
- `message`는 **사용자에게 그대로 보여도 되는 한국어 한 문장**. 내부 경로·SQL·스택·제공사 원문은 넣지 않는다.
- 에러 코드는 `shared/src/errors.ts`가 정본이고 api.md §3 표가 이를 전사한다. 새 코드는 둘 다에 추가하고 발생 조건·status를 적는다.

| 코드 | status | 발생 |
|---|---|---|
| `VALIDATION_FAILED` | 400 | 스키마 위반(필드·길이·enum) |
| `AUTH_REQUIRED` · `TOKEN_INVALID` · `TOKEN_EXPIRED` | 401 | 쓰기 요청에 토큰 없음·위조·만료 |
| `LEVEL_TOO_LOW` | 403 | 등급 미달 |
| `ROOM_NOT_FOUND` · `MESSAGE_NOT_FOUND` | 404 | |
| `SPEAK_IN_PROGRESS` | 409 | 같은 방 생성 중 |
| `REGENERATE_NOT_LAST` | 409 | 마지막 메시지가 아님 |
| `RATE_LIMITED` | 429 | 토큰 단위 분당 초과 |
| `LLM_TIMEOUT` · `LLM_PROVIDER_ERROR` · `LLM_AUTH_ERROR` · `LLM_RATE_LIMITED` · `LLM_EMPTY_OUTPUT` | 502 | 제공사 호출 실패 |
| `INTERNAL` | 500 | 그 외 |

- server의 `AppError`를 라우트의 **단일 에러 핸들러 한 곳**에서 변환한다. 핸들러마다 `catch`로 문자열을 만들지 않는다.

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
| 쓰기 레이트리밋 | `@fastify/rate-limit`, 키 = 토큰 `mbId`(없으면 IP), `env.RATE_LIMIT_PER_MIN`(기본 20). 초과 `429 RATE_LIMITED` + `Retry-After` |
| speak 동시성 | 방당 1건(server §4). 라우트는 `409 SPEAK_IN_PROGRESS`를 그대로 전달 |
| 페이지네이션 | `before` 커서(메시지 id) + `limit`(≤100). 첫 요청은 `before` 없음 = 최신부터. 응답 `nextBefore`가 `null`이면 끝 |
| 임베드 | `/embed` 응답에 `Content-Security-Policy: frame-ancestors {env.ALLOWED_FRAME_ANCESTORS}`. `X-Frame-Options`는 보내지 않는다(CSP가 우선). `/api/*`에는 `frame-ancestors 'none'` |
| CORS | 동일 출처(iframe이 서버에서 내려옴)라 기본 미허용. 로컬 dev는 Vite 프록시로 해결. 외부 출처 허용은 요구가 있을 때만 |
| 헬스 | `GET /api/health` → `{ ok: true, version }`. Railway 헬스체크 대상 |

## 8. 4자 + handoff 동기화

순서는 항상 **api.md → shared → routes → ui/api → handoff**. 코드를 먼저 고치고 문서를 맞추지 않는다.

구현·감사 시 **대조표**를 남긴다(contract-implementer 완료 보고 필수, contract-analyst 감사 출력 필수):

| 계약 항목 | api.md | shared (`types.ts`/`errors.ts`/`endpoints.ts`) | routes (`server/src/routes/*`) | ui/api (`ui/src/api/*`) | 판정 |
|---|---|---|---|---|---|
| `POST /api/rooms/:id/speak` `SpeakRequest.character` | §4.6 | `SpeakRequest` | `speakRoute` 스키마 `character: enum` | `speak(roomId, character)` | ✅ |
| `TOKEN_EXPIRED` 401 | §3 | `ErrorCode.TOKEN_EXPIRED` | preHandler | `Result.error.code` 분기 | ✅ |

- 대조 기준: 경로·메서드·요청/응답 필드·타입·optional 여부·에러 코드 목록·status·토큰 요구 여부.
- 경로 문자열은 `shared/src/endpoints.ts` **한 곳**에만 둔다. 라우트·래퍼에 리터럴 경로가 나타나면 결함(CON 감사 항목).
- 토큰 형식은 `shared/src/types.ts`의 `TokenPayload` + `doc/handoff/token-snippet.php.md`의 PHP 조각이 같은 필드를 가진다. 대조표에 한 행으로 포함한다.
- JSON 스키마는 **수작업 JSON Schema** 또는 zod→JSON Schema 변환 중 하나를 contract-designer가 api.md §5에서 확정한다(둘 다 쓰지 않는다). 변환 도구 도입은 설치 허가제.

## 9. 라우트 구현 규칙 (`server/src/routes/`)

- 파일 = 자원 단위(`rooms.ts`, `messages.ts`, `memory.ts`, `health.ts`, `embed.ts`), `index.ts`가 플러그인으로 묶어 등록.
- 핸들러 형태 고정: 스키마(`schema: { params, querystring, body, response }`) → `preHandler: [requireAuth]`(쓰기) 또는 `[optionalAuth]`(읽기) → 서비스 호출 → `reply.code(n).send(dto)`.
- 핸들러 위 자기문서화 주석: `// [계약] api.md §4.6 · [요구] R-API-xxx · [에러] SPEAK_IN_PROGRESS, LLM_TIMEOUT · [부수효과] 요약 백그라운드 트리거`
- 서비스는 `AuthContext`를 **인자로** 받는다. 라우트가 `request.user`를 꺼내 넘긴다. 서비스가 request 객체를 알면 결함.
- 정적 파일(`/embed`, `ui/dist`)은 `embed.ts`에서 `@fastify/static`으로. `?t=`는 서버가 읽지 않는다(화면 JS가 읽음).

## 10. 테스트

| 대상 | 방법 | 위치 |
|---|---|---|
| 라우트 | supertest(또는 `app.inject`)로 실제 Fastify 인스턴스에 요청. 서비스는 FakeProvider·임시 DB로 실물 사용. 토큰은 테스트용 SECRET으로 직접 생성 | `server/test/routes/*.test.ts` |
| 스키마 | 잘못된 body·query가 `400 VALIDATION_FAILED`로 닫히는지 | 같은 파일 |
| 토큰 | 위조·만료·등급 미달·정상 4경로 + 타이밍 안전 비교 | `server/test/routes/auth.test.ts` |
| ui 래퍼 | `fetch`를 `vi.stubGlobal`로 대체해 경로·헤더·`Result` 변환 검증 | `ui/src/api/__tests__/*.test.ts` |
| PHP 조각 | 자동 테스트 불가 → Node로 같은 payload·SECRET으로 만든 토큰과 PHP 출력이 일치하는지 수동 체크리스트(`doc/handoff/`에 절차) | — |
| 실물 E2E | ui-tester 소관(브라우저). contract는 하지 않는다 | — |

- 구현 완료 보고에는 `npx vitest run server/test/routes ui/src/api` 결과, `npx tsc --noEmit`(세 워크스페이스) exit 0을 **실행 출력으로** 싣는다.
- 에러 경로(각 에러 코드가 실제로 나오는 요청) 테스트를 정상 경로와 같은 수로 둔다.

## 11. 화면의 contract 사용 규칙 (ui 계층 경계)

- 화면·컴포넌트·훅은 `import { speak, listMessages } from '@/api'`처럼 **래퍼만** 쓴다. `fetch`를 `ui/src/api/` 밖에서 쓰면 경계 위반이다.
- 래퍼는 엔드포인트 하나에 함수 하나. 래퍼 안에 화면 로직(스크롤·낙관적 갱신)을 넣지 않는다.
- **래퍼는 throw하지 않는다.** 모든 함수는 `Promise<Result<T>>`(`{ ok: true, value } | { ok: false, error: { code, message } }`)를 반환한다. 네트워크 실패는 `{ code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }`로 정규화. 표시는 화면이 `labels.ts`로 결정한다. (ts-rules.md와 동일 규칙)
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
