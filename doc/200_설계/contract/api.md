# API 계약 (api.md)

- 상태: **초안 v0.1** · 최종 갱신 2026-10-05 · 소유 contract-designer
- 묶음: **S1 상세 확정** = `GET /api/health` · `GET /api/rooms` · `GET /api/rooms/:id/messages` · `GET /embed`. 나머지 엔드포인트는 §4.0 표에 행만 두고 S2~S4에서 상세를 정한다.
- 이 문서가 단일 소스다: **api.md → `shared/src/*` → `server/src/routes/*` → `ui/src/api/*` → `doc/handoff/*`(S5)**. 넷이 어긋나면 contract 결함이다(확정사항 §3).
- 입력: `doc/000_프로젝트_확정사항.md` §1·§2·§3·§5.2~§5.4·§6, `doc/100_요구조건/requirements.md` §3·§4·§5·§7(R-LLM-002)·§8·§9, `doc/200_설계/server/{index,env,db,rooms,messages}.md`, `doc/200_설계/architecture/ui-layout-01-rooms-chat.md`.
- 절 구성: §1~§10은 contract-design-strategy §13 고정 절이다(번호 변경 금지). §11~§15는 구현 설계 부록이다.

---

## 1. 개요·위상

계약은 식당 메뉴판이다. 손님(화면)은 메뉴판에 적힌 이름으로만 주문하고, 주방(server)은 메뉴판에 적힌 모양으로만 음식을 내놓는다. 메뉴판 사본(`shared/`)이 주방과 홀에 똑같이 걸려 있어서 한쪽만 바뀌면 컴파일러가 바로 알려 준다.

```
ui (React, iframe /embed)  ──▶  contract  ──▶  server (Workers + Hono + D1)
   ui/src/api/* 래퍼만 호출          │             c.get('services') 의 서비스 함수
                                     │
            api.md · shared/src/{types,errors,endpoints,characters}.ts
            server/src/routes/* · ui/src/api/* · doc/handoff/*(S5)
                                     ↑
                    갠홈 PHP(저쪽) — 토큰 발급·임베드 주소 (S2·S5)
```

### 1.1 소유 파일

| 당사자 | 파일 | S1 내용 |
|---|---|---|
| 문서(정본) | `doc/200_설계/contract/api.md` | 이 문서 |
| 공용 타입 | `shared/src/types.ts` | `CharacterId` · `Speaker` · `MessageKind` · `RoomSummary` · `Message` · `MessagesQuery` · `MessagesPage` · `HealthResponse` · `ApiErrorBody` |
| 에러 코드 | `shared/src/errors.ts` | 13종 전체(`ERROR_CODES` · `ErrorCode` · `ErrorStatus` · `ERROR_STATUS` · `ERROR_MESSAGES` · `isErrorCode`) |
| 경로 | `shared/src/endpoints.ts` | `PATHS`(embed·health·rooms·roomMessages) · `endpoints` 빌더 |
| 캐릭터 표시 메타 | `shared/src/characters.ts` | `CharacterMeta` · `CHARACTERS`(R-LLM-002) |
| 서버 쪽 | `server/src/routes/{index,validate,schemas,health,rooms,messages}.ts` | `apiRoutes` 조립 · zod 검증 · GET 3종 |
| 화면 쪽 | `ui/src/api/{client,health,rooms,messages,index}.ts` | `request` · `getHealth` · `listRooms` · `listMessages` |
| 갠홈 쪽 | `doc/handoff/*` | S5(이번에 쓰지 않음) |

### 1.2 경계 규칙

- **단방향.** 화면·컴포넌트·state는 `@/api`(= `ui/src/api/index.ts`)만 import한다. `fetch`를 `ui/src/api/` 밖에서 쓰면 경계 위반이다.
- **라우트는 얇다.** 핸들러는 zod 검증 → `c.get('services')`의 서비스 호출 → `c.json()`만 한다(30줄 이내, R-API-007). 범위·존재 판정은 서비스가 한다.
- **진입점 소유(server).** `/embed` 서빙, `onError`·`notFound`, CSP 헤더, 요청 로그는 server 진입점(`server/src/app.ts`)이 갖는다. 라우트는 이것들을 정의하지 않는다(server index.md §9.1).
- **경로 리터럴은 `shared/src/endpoints.ts` 한 곳에만** 둔다(R-API-008).

### 1.3 현황 메모 (2026-10-05)

- `shared/`·`ui/`가 없고 `server/`는 빈 폴더다. 대조할 구현이 없으므로 문서↔코드 불일치는 없다.
- 구현 순서는 §11.4를 따른다(shared가 server 구현보다 먼저 필요하다).

### 1.4 묶음별 범위

| 묶음 | 이 문서에서 정하는 것 |
|---|---|
| S1 | §3 에러 코드 13종 전부, §4.1~§4.4, §5 shared 4파일, §11 routes·ui/api, §12~§14 |
| S2 | §2 토큰 상세(형식·전달·검증 순서·`TokenPayload`), 쓰기 엔드포인트(방 생성·변경·삭제, user 저장, 메시지 수정·삭제), §6 레이트리밋 |
| S3 | speak·regenerate |
| S4 | memory GET·PUT |
| S5 | §8 handoff 3종 |

---

## 2. 인증·토큰

토큰은 갠홈이 써 준 출입증이다. 서버는 도장(서명)이 진짜인지, 유효기간이 지났는지, 등급이 충분한지만 본다. 회원 명부는 갠홈이 갖고 있다.

### 2.1 S1 확정 규칙 (R-AUTH-003의 읽기 쪽)

| 규칙 | 값 |
|---|---|
| S1 엔드포인트 토큰 | 전부 **불필요** |
| 읽기 엔드포인트에 `Authorization` 헤더가 있을 때 | **무시한다.** 검증하지 않고, 잘못된 토큰이어도 읽기를 거절하지 않는다(401·403 없음) |
| S2 이후 유지 약속 | 토큰 미들웨어는 쓰기 엔드포인트에만 붙는다. `GET /api/health`·`GET /api/rooms`·`GET /api/rooms/:id/messages`는 계속 토큰 불필요 |
| 예외(요구 명시) | `GET /api/rooms/:id/memory`는 읽기지만 **토큰 필요**(확정사항 §5.2, R-MEM-001). S4에서 상세 |

### 2.2 전달 규약 — **S2 상세 예정**

요구 문구만 옮긴다(R-API-003 🔒, R-AUTH-003 🔒).

- 토큰은 `Authorization: Bearer <t>` 헤더로만 받는다. 쿠키·쿼리로 받지 않는다.
- 화면은 `/embed?t=<토큰>`의 `t`를 읽어 **메모리에만** 둔다. `localStorage`·쿠키 저장 금지. API 호출에 `?t=`를 붙이지 않는다.
- S1의 `ui/src/api/`는 토큰을 읽지도 붙이지도 않는다. 헤더 부착 자리는 §11.3 `buildHeaders`에 TODO로만 남긴다.
- 토큰 보관 위치(`ui/src/api/client.ts` 대 `ui/src/state/token`)는 S2에서 정한다(§15.4 확인 필요).

### 2.3 토큰 형식 — **S2 상세 예정**

요구 문구만 옮긴다(R-AUTH-001 🔒, R-AUTH-002 🔒).

- 형식: `base64url(payload).base64url(HMAC-SHA256(payload, SECRET))`.
- payload: `{ mb_id, nick, ch_name, level, exp }`. `exp`는 epoch **초**이고 발급 시각 + 12h다. 필드 이름은 R-AUTH-001대로 snake_case다. 이 JSON은 갠홈 PHP가 만들기 때문에 API 본문의 camelCase 규칙(§5.1) 예외다.
- 검증 순서와 실패 코드: 서명 → `exp` → `level >= TOKEN_MIN_LEVEL`. 형식·서명·만료 실패는 `401 TOKEN_INVALID`, 등급 미달은 `403 LEVEL_TOO_LOW`, 쓰기 요청에 토큰이 없으면 `401 TOKEN_REQUIRED`.
- 인코딩 세부, `TokenPayload` 타입, 교차 테스트 벡터, PHP 조각은 S2(형식)와 S5(handoff)에서 정한다.

---

## 3. 공통 응답·에러 코드

### 3.1 응답 형태

| 구분 | 형태 |
|---|---|
| 성공 | 엔드포인트별 본문(§4). `error` 키가 없다 |
| 실패 | `{ "error": { "code": ErrorCode, "message": string } }` + 코드의 HTTP status(§3.2) |
| Content-Type | `application/json`(`/embed` 정적 파일 제외) |
| `message` | 사용자에게 그대로 보여도 되는 **한국어 한 문장**. 내부 경로·SQL·스택·키 이름·제공사 원문 금지 |
| 코드↔status | **코드 1개 = status 1개.** 같은 코드가 다른 status로 나가면 결함 |

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "불러올 개수(limit)는 1~100 사이의 정수여야 합니다." } }
```

- 서버는 상황별 문구를 쓸 수 있다(예: `NOT_FOUND` → `방을 찾을 수 없습니다.`). `ERROR_MESSAGES`는 상황 문구가 없을 때 쓰는 **기본 문구**이자 화면의 폴백이다.
- 화면에 보일 문구는 화면의 `labels.ts`가 `code`로 정한다(R-CHAT-011, ts-rules 에러 처리). 서버 `message`는 참고값이다.

### 3.2 에러 코드 13종 (R-API-002 🔒 — `shared/src/errors.ts`가 정본, 이 표는 전사)

| 코드 | status | 기본 message | 발생 조건 | 내는 곳 | 처음 쓰는 묶음 |
|---|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 요청 형식이 올바르지 않습니다. | 경로·쿼리·본문 스키마 위반, 범위·정수 위반, 본문 JSON 파싱 실패 | routes `validate` · 서비스 · onError(HTTPException 400) | S1 |
| `TOKEN_REQUIRED` | 401 | 로그인한 회원만 사용할 수 있습니다. | 쓰기 요청에 토큰 없음(R-AUTH-003) | auth 미들웨어 | S2 |
| `TOKEN_INVALID` | 401 | 인증 정보가 올바르지 않거나 만료되었습니다. 페이지를 새로 고쳐 주세요. | 형식·서명·만료 실패(R-AUTH-002) | auth 미들웨어 | S2 |
| `LEVEL_TOO_LOW` | 403 | 대화에 참여할 수 있는 회원 등급이 아닙니다. | `level < TOKEN_MIN_LEVEL`(R-AUTH-002) | auth 미들웨어 | S2 |
| `RATE_LIMITED` | 429 | 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요. | `mb_id` 분당 쓰기 초과(R-AUTH-005) | 레이트리밋 미들웨어 | S2 |
| `NOT_FOUND` | 404 | 요청한 대상을 찾을 수 없습니다. | 없는 방·메시지, 매칭 없는 경로·메서드, `/embed` 파일 없음 | 서비스 · notFound · `/embed` | S1 |
| `SPEAK_IN_PROGRESS` | 409 | 이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요. | 방 생성 잠금 선점 실패(R-MSG-007) | messages.speak · regenerate | S3 |
| `NOT_LAST_MESSAGE` | 409 | 방의 마지막 메시지만 다시 생성할 수 있습니다. | 재작성 대상이 마지막 메시지가 아님(R-MSG-006) | messages.regenerate | S3 |
| `NOT_CHARACTER_MESSAGE` | 400 | 캐릭터 메시지만 다시 생성할 수 있습니다. | 재작성 대상이 유저 메시지(R-MSG-006) | messages.regenerate | S3 |
| `LLM_FAILED` | 502 | AI 응답을 받지 못했습니다. 다시 시도해 주세요. | 제공사 호출 최종 실패(R-LLM-005) | llm | S3 |
| `LLM_EMPTY` | 502 | AI 응답이 비어 있습니다. 다시 시도해 주세요. | 후처리 결과가 빈 문자열(R-LLM-004) | llm | S3 |
| `CONFIG_INVALID` | 500 | 서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요. | `parseEnv` 실패(모든 경로, `/embed`·health 포함). `LLM_API_KEY` 누락(speak·regenerate만)(R-ENV-003) | env · 부트스트랩 | S1 |
| `INTERNAL` | 500 | 서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. | 그 밖의 예상 못 한 오류(D1 장애 등) | onError | S1 |

- 13종은 S1에 한 번에 확정한다. S2~S4의 기본 문구는 착수 시 다듬을 수 있다(문구 변경 = 비파괴).
- `CONFIG_INVALID`·`INTERNAL`·`VALIDATION_ERROR` 기본 문구는 server env.md §5와 index.md §5.1의 문구와 같다.

### 3.3 클라이언트 전용 코드 `NETWORK`

- 서버가 내지 않으므로 `ErrorCode`에 넣지 않는다. `ui/src/api/client.ts`의 `ApiErrorCode = ErrorCode | 'NETWORK'`에만 있다.
- 문구: `서버에 연결할 수 없습니다.`(ts-rules 에러 처리와 같다).

### 3.4 화면 쪽 정규화 규칙 (`ui/src/api/client.ts`)

| 상황 | `Result` |
|---|---|
| 2xx + JSON 본문 | `{ ok: true, value: 본문 }` |
| 2xx + 본문이 JSON이 아님 | `{ ok: false, error: { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL } }` |
| 4xx·5xx + 계약 형식 본문(`code`가 13종, `message`가 빈 문자열이 아님) | `{ ok: false, error: 본문.error }` 그대로 |
| 4xx·5xx + `code`는 13종인데 `message`가 없거나 비어 있음 | `{ code, message: ERROR_MESSAGES[code] }` |
| 4xx·5xx + 계약 형식이 아님(HTML 오류 페이지, 모르는 코드) | `{ code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL }` |
| `fetch` 자체 실패(오프라인·DNS·연결 거부) | `{ code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }` |

- 래퍼는 **어떤 경우에도 throw·reject하지 않는다.** 화면은 `result.ok` 분기만 쓰고 `try/catch`를 쓰지 않는다.

### 3.5 에러 변환 위치

- 라우트와 서비스는 `AppError`를 throw만 한다. 응답 본문은 server 진입점의 `onError` 한 곳이 `{ error: { code, message } }`로 만든다(index.md §5.1).
- zod 검증 실패는 라우트의 `validate` 훅이 `AppError('VALIDATION_ERROR', 400, ERROR_MESSAGES.VALIDATION_ERROR)`를 throw한다(§11.2). zod-validator 기본 실패 응답은 계약 형식이 아니라서 쓰지 않는다.
- 매칭 없는 경로와 메서드는 `notFound`가 `404 NOT_FOUND`(`요청한 주소를 찾을 수 없습니다.`)로 닫는다. S1 시점에 `POST /api/rooms` 같은 미구현 쓰기 경로도 이 응답이다.

---

## 4. 엔드포인트별 명세

### 4.0 전체 엔드포인트 (R-API-001 🔒 — 이 밖의 엔드포인트는 만들지 않는다)

| # | 메서드·경로 | 토큰 | 역할 | 묶음 | 상태 | 요구ID | 상세 |
|---|---|---|---|---|---|---|---|
| E1 | `GET /embed` · `GET /embed?t=` | ✕ | 화면(정적 파일) | S1 | **확정** | R-API-006 · R-API-001 | §4.4 · §7 |
| E2 | `GET /api/health` | ✕ | 상태 | S1 | **확정** | R-API-005 | §4.1 |
| E3 | `GET /api/rooms` | ✕ | 방 목록 | S1 | **확정** | R-ROOM-001 | §4.2 |
| E4 | `POST /api/rooms` | ○ | 방 생성 | S2 | S2 상세 예정 | R-ROOM-002 | — |
| E5 | `PATCH /api/rooms/:id` | ○ | 방 이름 변경 | S2 | S2 상세 예정 | R-ROOM-003 | — |
| E6 | `DELETE /api/rooms/:id` | ○ | 방 삭제 | S2 | S2 상세 예정 | R-ROOM-004 | — |
| E7 | `GET /api/rooms/:id/messages?before&limit` | ✕ | 히스토리 한 페이지 | S1 | **확정** | R-MSG-001 | §4.3 |
| E8 | `POST /api/rooms/:id/user` | ○ | 유저 발화·지시 저장(AI 호출 없음) | S2 | S2 상세 예정 | R-MSG-002 | — |
| E9 | `POST /api/rooms/:id/speak` | ○ | 해당 캐릭터 1턴 생성 | S3 | S3 상세 예정 | R-MSG-003 · R-MSG-007 | — |
| E10 | `PATCH /api/messages/:id` | ○ | 메시지 수정 | S2 | S2 상세 예정 | R-MSG-004 | — |
| E11 | `DELETE /api/messages/:id` | ○ | 메시지 삭제 | S2 | S2 상세 예정 | R-MSG-005 | — |
| E12 | `POST /api/messages/:id/regenerate` | ○ | 같은 캐릭터로 재생성 | S3 | S3 상세 예정 | R-MSG-006 · R-MSG-007 | — |
| E13 | `GET /api/rooms/:id/memory` | ○ | 장기기억 보기 | S4 | S4 상세 예정 | R-MEM-001 | — |
| E14 | `PUT /api/rooms/:id/memory` | ○ | 장기기억 편집 | S4 | S4 상세 예정 | R-MEM-001 | — |

- **방 단건 조회(`GET /api/rooms/:id`)는 없다.** 대화 화면 상단 바의 방 제목·생성일(R-CHAT-001)은 `listRooms()` 결과에서 찾는다. 마지막 본 방 복원(R-ROOMS-004)도 `listRooms()`를 먼저 부른 뒤 id로 찾는다.
- S2~S4 행의 요청·응답 필드는 해당 묶음에서 정한다. 이 문서는 아직 추측하지 않는다.

### 4.1 `GET /api/health` (E2)

| 항목 | 값 |
|---|---|
| 토큰 | ✕ |
| 요청 | 경로·쿼리·본문 없음(쿼리가 있어도 무시) |
| 성공 | `200` · `HealthResponse` = `{ ok: true, version: string }` |
| 에러 | `500 CONFIG_INVALID`(부트스트랩) · `500 INTERNAL` |
| 부수 효과 | 없음. **DB에 접근하지 않는다**(R-API-005) |
| 레이트리밋 | 없음 |
| server | `c.get('services').getHealth(): HealthStatus`(index.md §2.3) |
| 요구ID | R-API-005 |
| 테스트 | API-T-001 · 002 · 003 |

```json
{ "ok": true, "version": "0.1.0" }
```

- `version`은 `server/package.json`의 `version`이다(index.md D-IDX-8). `/deploy` 헬스체크 대상이다.
- 부트스트랩이 health에도 적용되므로 Secrets 누락은 배포 직후 health가 `500 CONFIG_INVALID`로 알려 준다(index.md D-IDX-3).

### 4.2 `GET /api/rooms` (E3)

| 항목 | 값 |
|---|---|
| 토큰 | ✕(헤더가 있어도 무시, §2.1) |
| 요청 | 경로·쿼리·본문 없음(쿼리가 있어도 무시) |
| 성공 | `200` · `RoomSummary[]`(배열 그대로, 감싸지 않음). `updatedAt` 내림차순, 같으면 `id` 오름차순. 방이 없으면 `[]` |
| 에러 | `500 CONFIG_INVALID` · `500 INTERNAL`(D1 장애) |
| 부수 효과 | 없음 |
| 레이트리밋 | 없음 |
| 페이지네이션 | 없음(요구 없음) |
| server | `c.get('services').rooms.listRooms(): Promise<RoomSummary[]>`(rooms.md §2.1) |
| 요구ID | R-ROOM-001 · R-ROOMS-001 · R-AUTH-003(읽기) |
| 테스트 | API-T-010 ~ 014 |

```json
[
  { "id": "00000000-0000-4000-8000-000000000001", "title": "안개 낀 런던의 아침", "createdAt": 1767225600000, "updatedAt": 1767229800000, "messageCount": 70 },
  { "id": "00000000-0000-4000-8000-000000000002", "title": "팬텀하이브 저택의 저녁", "createdAt": 1767225600000, "updatedAt": 1767226800000, "messageCount": 2 },
  { "id": "00000000-0000-4000-8000-000000000003", "title": "아직 아무도 없는 방", "createdAt": 1767225600000, "updatedAt": 1767225600000, "messageCount": 0 }
]
```

- 정렬은 서버가 보장한다. 화면은 다시 정렬하지 않는다.
- 방 목록 행의 날짜는 `updatedAt`(R-ROOMS-001), 대화 화면 상단 날짜는 `createdAt`(R-CHAT-001)이다.

### 4.3 `GET /api/rooms/:id/messages?before&limit` (E7)

| 항목 | 값 |
|---|---|
| 토큰 | ✕(헤더가 있어도 무시, §2.1) |
| 경로 | `id: string` — 방 id 문자열 그대로(1자 이상). 형식(UUID) 검사는 하지 않고 없으면 `404` |
| 쿼리 | `before?: number` · `limit?: number`(아래 규칙) |
| 본문 | 없음 |
| 성공 | `200` · `MessagesPage` = `{ messages: Message[], hasMore: boolean }` |
| 에러 | 아래 표 |
| 부수 효과 | 없음 |
| 레이트리밋 | 없음 |
| server | `c.get('services').messages.listMessages(roomId: string, query: MessagePageQuery): Promise<MessagePage>`(messages.md §2.1) |
| 요구ID | R-MSG-001 · R-CHAT-003 · R-API-004 · R-AUTH-003(읽기) |
| 테스트 | API-T-020 ~ 024, API-T-030 ~ 034 |

쿼리·페이지 규칙(messages.md §2.1 페이지 규칙과 같다):

| 규칙 | 값 |
|---|---|
| 쿼리 변환 | 라우트는 문자열을 `Number()`로만 바꾼다. 키가 없거나 값이 빈 문자열(공백만 포함)이면 **생략**으로 본다(`?before=&limit=` = 쿼리 없음) |
| 같은 키 반복(`?limit=1&limit=2`) | 라우트 zod가 거절 → `400 VALIDATION_ERROR`(기본 문구) |
| `limit` 생략 | **30** |
| `limit` 허용 | 정수 **1~100**. 넘으면 잘라 주지 않고 `400`(messages.md D-MSG-2) |
| `before` 생략 | 가장 최신부터 |
| `before` 의미 | `id < before`인 메시지만(엄격히 작음). 메시지 id 커서 |
| `before` 허용 | 1 이상 안전 정수(`Number.isSafeInteger`) |
| 정렬 | `messages`는 id 오름차순(오래된 → 새) |
| `hasMore` | 이 페이지보다 더 오래된 메시지가 있으면 `true` |
| 다음(더 오래된) 페이지 | `hasMore === true`이면 `before = messages[0].id`로 다시 부른다. 별도 커서 필드는 없다 |
| 빈 방 | `{ "messages": [], "hasMore": false }` |
| 검사 순서 | zod 형태 → `limit`·`before` 범위(서비스) → 방 존재 → 페이지. 그래서 없는 방에 `limit=0`을 보내면 `404`가 아니라 `400`이다 |

에러:

| 코드 | status | message | 조건 |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 불러올 개수(limit)는 1~100 사이의 정수여야 합니다. | `limit`이 1~100 정수가 아님(`0`·`101`·`1.5`·`abc`) |
| `VALIDATION_ERROR` | 400 | 기준 메시지 번호(before)가 올바르지 않습니다. | `before`가 1 이상 안전 정수가 아님(`0`·`-1`·`abc`·`2^53`) |
| `VALIDATION_ERROR` | 400 | 요청 형식이 올바르지 않습니다. | 같은 쿼리 키 반복 등 zod 형태 위반 |
| `NOT_FOUND` | 404 | 방을 찾을 수 없습니다. | 없는 방(삭제된 방 포함) |
| `CONFIG_INVALID` | 500 | 서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요. | 부트스트랩 |
| `INTERNAL` | 500 | 서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. | D1 장애 등 |

- `limit`과 `before`가 둘 다 틀리면 서비스 검사 순서(`normalizePageQuery`)의 첫 위반 문구가 나간다.

응답 예시(시드 방 1의 첫 페이지 30건 중 앞 4건만 보인다. id 값은 설명용이다):

```json
{
  "messages": [
    { "id": 41, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "sebastian", "kind": "line", "text": "도련님, 홍차를 준비해 두었습니다. (41)", "authorName": null, "createdAt": 1767228060000 },
    { "id": 42, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "ciel", "kind": "line", "text": "늦었군, 세바스찬. 오늘 일정부터 말해. (42)", "authorName": null, "createdAt": 1767228120000 },
    { "id": 43, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "user", "kind": "line", "text": "창밖으로 안개가 한층 짙어진다. (43)", "authorName": "시드 유저", "createdAt": 1767228180000 },
    { "id": 44, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "user", "kind": "ooc", "text": "분위기를 조금 더 어둡게 이어 가 줘. (44)", "authorName": "시드 유저", "createdAt": 1767228240000 }
  ],
  "hasMore": true
}
```

- 응답에 `authorMbId`(그누보드 로그인 id)는 **없다**(db.md D-DB-5, 공개 응답 노출 방지).

### 4.4 `GET /embed` (E1) — server 진입점 소유

| 항목 | 값 |
|---|---|
| 처리 주체 | server `app.ts`의 `/embed` 처리(index.md §3.2). **routes에 정의하지 않는다** |
| 토큰 | ✕ |
| 요청 | `GET /embed` · `GET /embed/` · `GET /embed?t=<토큰>` → 화면 `index.html`. `GET /embed/<파일>` → 빌드 산출물(JS·CSS·폰트·이미지) |
| `?t=` | 서버는 **읽지 않고 통과**시킨다. `ASSETS`에 넘길 때 쿼리를 떼고, 요청 로그에도 쿼리를 남기지 않는다(R-AUTH-006). 화면 JS가 읽는다(S2) |
| 성공 | `200` · `text/html`(또는 파일 MIME) |
| 헤더 | `Content-Security-Policy: frame-ancestors <ALLOWED_FRAME_ANCESTORS>`. `X-Frame-Options` 없음(§7) |
| 에러 | `404 NOT_FOUND`(파일 없음, JSON 본문) · `500 CONFIG_INVALID`(이때 CSP는 `frame-ancestors 'none'`) |
| 부수 효과 | 없음 |
| 경로 상수 | `PATHS.embed`(shared) — server `app.ts`가 import한다 |
| 요구ID | R-API-006 · R-API-001 · R-AUTH-006 |
| 테스트 | server SRV-T-080 · 086 · 088, contract API-T-004 · 005 |

- `/embed` 아래에 클라이언트 라우팅은 없다(SPA 단일 화면). `/embed/<경로>`는 정적 파일만 뜻한다.

---

## 5. 타입 (TS + JSON 예시 + 스키마 방식)

### 5.1 페이로드 원칙 (R-API-004)

| 항목 | 규칙 |
|---|---|
| 필드 | camelCase. TS 타입과 JSON이 1:1. DB snake_case는 server db 모듈 안에서만 |
| 시각 | `number` = Unix epoch **밀리초**(`createdAt`, `updatedAt`) |
| 식별자 | 방 `id: string`(UUID), 메시지 `id: number`(INTEGER PK) |
| 열거 | 문자열 리터럴 유니온(`speaker`, `kind`) |
| 없음 | `null`(`authorName: string \| null`). 빈 문자열·`undefined`로 없음을 표현하지 않는다 |
| 요청 선택 필드 | TS `?:`(`MessagesQuery.before?`) |

### 5.2 `shared/src/types.ts` 전문 초안

```ts
/**
 * 계약 타입 — 단일 소스 doc/200_설계/contract/api.md §5
 * server(routes·서비스)와 ui(api 래퍼·화면)가 함께 import 한다 (R-API-008)
 * 규칙: camelCase · 시각 epoch ms · room id 문자열 · message id 정수 · 없음은 null (R-API-004)
 */
import type { ErrorCode } from './errors'

/** 캐릭터 id. 두 명 고정 (확정사항 §1, R-LLM-002) */
export type CharacterId = 'sebastian' | 'ciel'

/** 메시지 화자 */
export type Speaker = CharacterId | 'user'

/** 메시지 종류. ooc = 유저의 지시 */
export type MessageKind = 'line' | 'ooc'

/** 방 목록 한 줄 — GET /api/rooms (R-ROOM-001) */
export type RoomSummary = {
  id: string
  title: string
  /** epoch ms */
  createdAt: number
  /** epoch ms. 메시지 추가·수정·삭제·재작성 시 갱신 (R-ROOM-005) */
  updatedAt: number
  messageCount: number
}

/** 메시지 한 건 (R-MSG-001). 작성자 로그인 id 는 싣지 않는다 */
export type Message = {
  id: number
  roomId: string
  speaker: Speaker
  kind: MessageKind
  text: string
  /** 유저 메시지의 작성자 표시 이름. 캐릭터 메시지는 null */
  authorName: string | null
  /** epoch ms */
  createdAt: number
}

/** GET /api/rooms/:id/messages 쿼리. 생략 시 최신부터 30건 */
export type MessagesQuery = {
  /** 이 id 보다 작은(더 오래된) 메시지만. 1 이상 정수 */
  before?: number
  /** 1~100 정수 */
  limit?: number
}

/** 히스토리 한 페이지. messages 는 오래된→새 순. 다음 페이지 before = messages[0].id */
export type MessagesPage = {
  messages: Message[]
  hasMore: boolean
}

/** GET /api/health (R-API-005) */
export type HealthResponse = {
  ok: true
  version: string
}

/** 모든 실패 응답 본문 (R-API-002) */
export type ApiErrorBody = {
  error: {
    code: ErrorCode
    message: string
  }
}
```

JSON 예시(열거·nullable):

```json
{ "id": 7, "roomId": "00000000-0000-4000-8000-000000000002", "speaker": "ciel", "kind": "line", "text": "오늘 저녁은 조용히 보내고 싶군.", "authorName": null, "createdAt": 1767226740000 }
```

```json
{ "id": 8, "roomId": "00000000-0000-4000-8000-000000000002", "speaker": "user", "kind": "ooc", "text": "둘이 체스를 둔다.", "authorName": "미샤", "createdAt": 1767226800000 }
```

### 5.3 `shared/src/errors.ts` 전문 초안

```ts
/**
 * 에러 코드 — 단일 소스 doc/200_설계/contract/api.md §3.2 (R-API-002)
 * 코드 1개 = HTTP status 1개. ERROR_MESSAGES 는 기본 문구(서버는 상황별 문구를 쓸 수 있다)
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'TOKEN_REQUIRED',
  'TOKEN_INVALID',
  'LEVEL_TOO_LOW',
  'RATE_LIMITED',
  'NOT_FOUND',
  'SPEAK_IN_PROGRESS',
  'NOT_LAST_MESSAGE',
  'NOT_CHARACTER_MESSAGE',
  'LLM_FAILED',
  'LLM_EMPTY',
  'CONFIG_INVALID',
  'INTERNAL',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502

/** 코드별 HTTP status */
export const ERROR_STATUS: Readonly<Record<ErrorCode, ErrorStatus>> = {
  VALIDATION_ERROR: 400,
  TOKEN_REQUIRED: 401,
  TOKEN_INVALID: 401,
  LEVEL_TOO_LOW: 403,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  SPEAK_IN_PROGRESS: 409,
  NOT_LAST_MESSAGE: 409,
  NOT_CHARACTER_MESSAGE: 400,
  LLM_FAILED: 502,
  LLM_EMPTY: 502,
  CONFIG_INVALID: 500,
  INTERNAL: 500,
}

/** 코드별 기본 한국어 문구 */
export const ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  VALIDATION_ERROR: '요청 형식이 올바르지 않습니다.',
  TOKEN_REQUIRED: '로그인한 회원만 사용할 수 있습니다.',
  TOKEN_INVALID: '인증 정보가 올바르지 않거나 만료되었습니다. 페이지를 새로 고쳐 주세요.',
  LEVEL_TOO_LOW: '대화에 참여할 수 있는 회원 등급이 아닙니다.',
  RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  NOT_FOUND: '요청한 대상을 찾을 수 없습니다.',
  SPEAK_IN_PROGRESS: '이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요.',
  NOT_LAST_MESSAGE: '방의 마지막 메시지만 다시 생성할 수 있습니다.',
  NOT_CHARACTER_MESSAGE: '캐릭터 메시지만 다시 생성할 수 있습니다.',
  LLM_FAILED: 'AI 응답을 받지 못했습니다. 다시 시도해 주세요.',
  LLM_EMPTY: 'AI 응답이 비어 있습니다. 다시 시도해 주세요.',
  CONFIG_INVALID: '서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요.',
  INTERNAL: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
}

/** 값이 계약 에러 코드인지 (화면이 응답 본문을 정규화할 때 쓴다) */
export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value)
```

- `Record<ErrorCode, …>`라서 코드를 추가하고 status·문구를 빠뜨리면 tsc가 실패한다.

### 5.4 `shared/src/endpoints.ts` 전문 초안

```ts
/**
 * 경로 상수 — 단일 소스 doc/200_설계/contract/api.md §4 (R-API-001 · R-API-008)
 * PATHS = 서버 등록용 패턴(Hono), endpoints = 화면 호출용 빌더. 경로 리터럴은 이 파일에만 둔다
 */
import type { MessagesQuery } from './types'

const API = '/api'

export const PATHS = {
  /** 화면(정적). server 진입점이 처리하며 routes 에 등록하지 않는다 (R-API-006) */
  embed: '/embed',
  health: `${API}/health`,
  rooms: `${API}/rooms`,
  roomMessages: `${API}/rooms/:id/messages`,
} as const

/** :id 자리에 인코딩한 값을 넣는다 */
const withId = (pattern: string, id: string): string => pattern.replace(':id', encodeURIComponent(id))

/** 쿼리 객체 → '?a=1&b=2'. undefined 는 뺀다. 값이 숫자뿐이라 인코딩하지 않는다 */
const toQueryString = (query: Readonly<Record<string, number | undefined>>): string => {
  const pairs = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
  return pairs.length === 0 ? '' : `?${pairs.join('&')}`
}

export const endpoints = {
  health: (): string => PATHS.health,
  rooms: (): string => PATHS.rooms,
  roomMessages: (roomId: string, query: MessagesQuery = {}): string =>
    withId(PATHS.roomMessages, roomId) + toQueryString(query),
} as const
```

- `PATHS`는 `as const`라 Hono가 `'/api/rooms/:id/messages'` 리터럴 타입을 그대로 받는다.
- S2~S4는 `PATHS`·`endpoints`에 키를 **추가**한다(기존 키 변경 없음).
- `URLSearchParams`를 쓰지 않는 이유: shared는 런타임 중립이어야 한다(브라우저·workerd 공용, lib 설정 의존 제거).

### 5.5 `shared/src/characters.ts` 전문 초안

```ts
/**
 * 캐릭터 표시 메타 — 단일 소스 (R-LLM-002). 화면은 speaker → 이름·아바타를 이것으로 그린다
 * 별도 조회 엔드포인트는 없다 (R-API-001). server/characters/{id}.json 의 name 은 여기 name 과 같아야 한다 (S3 검증)
 * 아바타 파일은 ui/public/img/{id}.png → 배포 경로 /embed/img/{id}.png
 */
import { PATHS } from './endpoints'
import type { CharacterId } from './types'

export type CharacterMeta = {
  id: CharacterId
  /** 표시명 (확정사항 §1) */
  name: string
  /** 아바타 이미지 경로(동일 출처 절대 경로) */
  avatar: string
}

export const CHARACTERS: { readonly [K in CharacterId]: CharacterMeta & { readonly id: K } } = {
  sebastian: { id: 'sebastian', name: '세바스찬 미카엘리스', avatar: `${PATHS.embed}/img/sebastian.png` },
  ciel: { id: 'ciel', name: '시엘 팬텀하이브', avatar: `${PATHS.embed}/img/ciel.png` },
}
```

- 화면 사용: `message.speaker === 'user'`이면 유저 말풍선, 아니면 `CHARACTERS[message.speaker]`(타입 좁히기로 `CharacterId`).
- 버튼 문구 「세바스찬」「시엘」은 화면 `labels.ts` 몫이다. 말풍선에 짧은 이름을 쓸지는 §15.4 확인 필요.

### 5.6 스키마 방식 (확정)

| 항목 | 결정 | 이유 |
|---|---|---|
| 검증 도구 | zod 하나 + `@hono/zod-validator`(확정사항 §2) | 스킬 §8 |
| 스키마 위치 | `server/src/routes/schemas.ts` | ui는 런타임 검증이 필요 없다. shared에 zod를 넣으면 화면 번들 의존이 생긴다 |
| 타입과 묶기 | 핸들러에서 `const query: MessagesQuery = c.req.valid('query')`, `const page: MessagesPage = await …`로 **대입 시점에 tsc가 대조**한다 | 별도 단언 타입 없이 어긋나면 컴파일 실패 |
| 범위·정수 규칙 | 서비스(`normalizePageQuery`)가 단일 소스. zod는 형태와 `Number()` 변환만 | messages.md D-MSG-4, R-API-007 |
| 실패 처리 | `validate` 훅이 `AppError('VALIDATION_ERROR', 400, ERROR_MESSAGES.VALIDATION_ERROR)` throw | §3.5 |

---

## 6. 레이트리밋·페이지네이션

| 항목 | S1 | 이후 |
|---|---|---|
| 읽기 레이트리밋 | 없음(E2·E3·E7) | 없음 |
| 쓰기 레이트리밋 | 해당 없음 | **S2 상세 예정.** 요구 요지: `mb_id` 단위 분 창당 `RATE_LIMIT_PER_MIN`(기본 20), D1 `rate_limits` 조건부 UPSERT, 초과 `429 RATE_LIMITED`, 응답에 `retryAfterSec`(R-AUTH-005) |
| 방 목록 페이지네이션 | 없음(요구 없음) | 요구가 생기면 §13 참고 |
| 히스토리 페이지네이션 | `before` 커서 + `limit`(기본 30, 최대 100), `hasMore`(§4.3) | 변경 없음 |

- 기본·최대 개수(30·100)의 코드 단일 소스는 server 상수 `MESSAGE_PAGE_LIMIT_DEFAULT`·`MESSAGE_PAGE_LIMIT_MAX`다(messages.md §2.1). 화면은 `limit`을 보내지 않고 기본값을 쓰므로 shared로 옮기지 않는다.

---

## 7. 임베드·CSP

| 항목 | 값 | 근거 |
|---|---|---|
| 서빙 | Workers Static Assets(`ui/dist`, 바인딩 `ASSETS`, `run_worker_first = true`) | R-API-006, index.md D-IDX-1 |
| 경로 매핑 | `/embed`·`/embed/`(+`?t=`) → `ASSETS` `/` · `/embed/<파일>` → `ASSETS` `/<파일>` · 쿼리 제거 | index.md §3.2 |
| CSP | **모든 응답**(`/embed`, `/api/*`, 에러 포함)에 `Content-Security-Policy: frame-ancestors <ALLOWED_FRAME_ANCESTORS>`. 설정 실패 응답은 `frame-ancestors 'none'` | R-API-006, index.md §3.1 ② |
| `X-Frame-Options` | 보내지 않는다(받은 응답에 있으면 제거) | R-API-006 |
| 허용 출처 | `ALLOWED_FRAME_ANCESTORS` 기본 `http://london-gossip.my https://london-gossip.my`(단일 소스 `server/src/env.ts`) | R-ENV-002, 확정사항 §9-7 |
| CORS | 없음. 화면이 서버와 같은 출처에서 내려온다 | 확정사항 §6 |
| 화면 빌드 | Vite `base: '/embed/'` | index.md §9.4 |
| 아바타 | `ui/public/img/{id}.png` → `/embed/img/{id}.png`(`CHARACTERS.*.avatar`) | R-LLM-002 |
| 로컬 개발 | Vite(5173)가 `/embed/`를 서빙하고 `/api`를 Worker(3000)로 프록시. CSP 확인은 `wrangler dev`·운영에서 | index.md §9.4 |
| 라우트 금지 | routes는 CSP·`X-Frame-Options`를 다루지 않고 `hono/secure-headers`·`hono/cors`·`hono/logger`를 쓰지 않는다 | index.md §9.1 |

---

## 8. handoff (저쪽 전달물) — **S5 예정**

| 파일 | 내용(요구) | 요구ID |
|---|---|---|
| `doc/handoff/embed-guide.md` | https 임베드 주소 입력 위치(`$rb_chatbot_embed_url`), 패널 390×640 전제, `?t=` 전달 방식, 허용 출처 | R-HANDOFF-001 |
| `doc/handoff/token-snippet.php.md` | R-TOKEN-001 PHP 조각 전문, 붙이는 위치, LEVEL 바꾸는 법 | R-HANDOFF-002 · R-TOKEN-001 |
| `doc/handoff/secret-handover.md` | SECRET 생성(32자 이상 랜덤)·전달 경로·양쪽 입력 위치·교체 절차. 실값 없음 | R-HANDOFF-003 |

- 저쪽 재적용이 필요한 변경: 토큰 payload 필드·서명 방식·`?t=` 파라미터 이름·임베드 주소. 이런 변경은 파괴 변경이며 §9에 "저쪽 재적용 필요"로 남긴다.
- S1 변경은 handoff에 영향이 없다.

---

## 9. 변경 이력

| 버전 | 일자 | 변경 | 호환성 | 저쪽 재적용 |
|---|---|---|---|---|
| v0.1 | 2026-10-05 | 최초 작성(S1). 전체 엔드포인트 표, 에러 코드 13종, S1 엔드포인트 4종 상세, shared 4파일·routes·ui/api 설계 | 추가(신규) | 아니오 |

---

## 10. 요구 추적표

| 요구ID | 계약 항목 | 절 | 판정 | 호환성 | 테스트ID | 상태 |
|---|---|---|---|---|---|---|
| R-API-001 🔒 | 엔드포인트 집합 14행, `PATHS`, 단건 방 조회 없음 | §4.0 · §5.4 · §12 | 신규 | 추가 | API-T-013 · API-T-042 | S1 행 확정, S2~S4 행 예정 |
| R-API-002 🔒 | `{ error: { code, message } }`, 13종 status·문구 | §3 · §5.3 | 신규 | 추가 | API-T-040 · 041, 모든 에러 테스트의 `expectContractError`, API-T-UI-002·004·005 | 확정 |
| R-API-003 🔒 | Bearer 헤더, `?t=` → 메모리 | §2.2 · §11.3 TODO | 신규 | 추가 | S2 | S2 상세 예정 |
| R-API-004 | camelCase · epoch ms · id 타입 · zod 검증 · `400 VALIDATION_ERROR` | §5.1 · §5.6 · §4.3 | 신규 | 추가 | API-T-011 · 023 · 030 ~ 032 | 확정 |
| R-API-005 | `GET /api/health` `{ ok: true, version }`, DB 미접근 | §4.1 | 신규 | 추가 | API-T-001 · 002 | 확정 |
| R-API-006 🔒 | `/embed` 정적 서빙, 모든 응답 CSP, `X-Frame-Options` 없음 | §4.4 · §7 | 신규 | 추가 | API-T-004 · 005, SRV-T-080 · 086 | 확정 |
| R-API-007 | 라우트 30줄 이내, 검증 → 서비스 → 응답 | §1.2 · §11.1 | 신규 | 추가 | 리뷰(§14.4) | 확정 |
| R-API-008 🔒 | shared 공유, 경로 리터럴 중복 0 | §5.4 · §11 · §12 | 신규 | 추가 | API-T-042 · 044 | 확정 |
| R-ROOM-001 🔒 | `GET /api/rooms` → `RoomSummary[]` 정렬 보장 | §4.2 · §5.2 | 신규 | 추가 | API-T-010 · 011 · 014 | 확정 |
| R-MSG-001 🔒 | `GET …/messages?before&limit` → `MessagesPage` | §4.3 · §5.2 | 신규 | 추가 | API-T-020 ~ 024 · 030 ~ 034, API-T-UI-008 | 확정 |
| R-AUTH-003 🔒 (S1 범위) | 읽기 경로 토큰 불필요, 헤더가 있어도 무시 | §2.1 | 신규 | 추가 | API-T-012 · 024 | 읽기 쪽 확정, 쓰기 쪽 S2 |
| R-AUTH-001 🔒 | 토큰 형식 전사 | §2.3 | — | — | S2 | S2 상세 예정 |
| R-ENV-003 | 모든 경로 `500 CONFIG_INVALID` | §3.2 · §4.1 | 신규 | 추가 | API-T-003 | 확정 |
| R-LLM-002 🔒 (표시 메타) | `CHARACTERS`(id·표시명·아바타) | §5.5 | 신규 | 추가 | API-T-043 | 확정(이름 표기는 §15.4) |
| R-CHAT-002 🔒 | 말풍선이 쓰는 `speaker`·`kind`·`authorName`·`createdAt`, 캐릭터 메타 | §5.2 · §5.5 | 신규 | 추가 | 화면 TC | 계약 확정 |
| R-CHAT-003 🔒 | 위로 스크롤 시 `before` 페이지, `hasMore` | §4.3 | 신규 | 추가 | API-T-021, 화면 TC | 계약 확정 |
| R-ROOMS-001 🔒 | 방 목록 데이터 | §4.2 | 신규 | 추가 | 화면 TC | 계약 확정 |
| R-NFR-004 🔒 | 응답·로그에 토큰 없음(`?t=` 미기록), 에러 본문에 내부 정보 없음 | §3.1 · §4.4 | 신규 | 추가 | API-T-014, SRV-T-083 · 088 | 확정 |

---

## 11. 구현 설계 — routes · ui/api (부록)

### 11.1 `server/src/routes/` 파일 표

| 파일 | 책임 | S1 크기 |
|---|---|---|
| `index.ts` | `apiRoutes = new Hono<AppEnv>()` 조립. 하위 라우터를 `route('/', …)`로 붙인다 | ~15줄 |
| `validate.ts` | zod-validator 래퍼(실패 → `AppError` throw) | ~20줄 |
| `schemas.ts` | `roomIdParam` · `messagesQuery` | ~20줄 |
| `health.ts` | `GET PATHS.health` | ~15줄 |
| `rooms.ts` | `GET PATHS.rooms`(S2에서 POST·PATCH·DELETE 추가) | ~15줄 |
| `messages.ts` | `GET PATHS.roomMessages`(S2·S3에서 user·speak·수정·삭제·재작성 추가) | ~25줄 |

공통 규약(server index.md §9.1):

- 경로는 `PATHS`의 **전체 경로**로 등록한다. `server/src/index.ts`가 `createApp({ routes: apiRoutes })`로 주입하고 `app.route('/', apiRoutes)`로 붙인다.
- 서비스는 `c.get('services')`로만 얻는다. `AppEnv`는 `import type { AppEnv } from '../services'`.
- `c.env`의 설정 키를 읽지 않는다(R-ENV-001). `/embed`·`onError`·`notFound`·CSP를 정의하지 않는다.
- 핸들러 위에 자기문서화 주석 `[계약] · [요구] · [에러] · [부수효과]`를 단다.

### 11.2 routes 초안

```ts
// server/src/routes/index.ts
/**
 * contract 라우트 묶음 — 단일 소스 doc/200_설계/contract/api.md §4 · §11
 * server/src/index.ts 가 createApp({ routes: apiRoutes }) 로 주입한다
 * /embed · onError · notFound · CSP 는 여기 두지 않는다 (server 진입점 소유)
 */
import { Hono } from 'hono'
import type { AppEnv } from '../services'
import { healthRoutes } from './health'
import { messagesRoutes } from './messages'
import { roomsRoutes } from './rooms'

export const apiRoutes = new Hono<AppEnv>()
apiRoutes.route('/', healthRoutes)
apiRoutes.route('/', roomsRoutes)
apiRoutes.route('/', messagesRoutes)
```

- 체인 대신 문장으로 붙인다. 그래야 `apiRoutes`의 타입이 `Hono<AppEnv>` 그대로 남아 `CreateAppOptions.routes`와 맞는다(RPC 타입 추론은 쓰지 않는다).

```ts
// server/src/routes/validate.ts
import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodTypeAny } from 'zod'
import { ERROR_MESSAGES } from '@shared/errors'
import { AppError } from '../app-error'

/**
 * zod 검증 미들웨어. 실패하면 VALIDATION_ERROR(400)를 throw 하고 응답은 진입점 onError 가 만든다
 * zod-validator 기본 실패 응답은 계약 형식이 아니므로 hook 에서 throw 한다 (api.md §3.5)
 */
export const validate = <Target extends keyof ValidationTargets, Schema extends ZodTypeAny>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, result => {
    if (!result.success) throw new AppError('VALIDATION_ERROR', 400, ERROR_MESSAGES.VALIDATION_ERROR)
  })
```

- 구현 시 제네릭 래퍼 때문에 `c.req.valid()` 타입 추론이 깨지면, 훅만 `onInvalid`로 export하고 `zValidator(target, schema, onInvalid)`를 직접 쓴다. 동작은 같다.
- 설치된 zod 메이저 버전에 따라 `ZodTypeAny`를 `ZodType`으로 바꾼다.

```ts
// server/src/routes/schemas.ts
import { z } from 'zod'

/** 경로 :id — 문자열 그대로. 존재 판정은 서비스(NOT_FOUND) */
export const roomIdParam = z.object({ id: z.string().min(1) })

/** 없음·빈 값 → undefined, 나머지는 Number() 변환만. 정수·범위 판정은 서비스 (messages.md D-MSG-4) */
const numberLike = z
  .string()
  .optional()
  .transform(value => (value === undefined || value.trim() === '' ? undefined : Number(value)))

/** GET /api/rooms/:id/messages 쿼리 (api.md §4.3). 모르는 키는 버린다 */
export const messagesQuery = z.object({ before: numberLike, limit: numberLike })
```

- `Number('abc')`는 `NaN`이 되어 서비스가 `limit`·`before` 문구로 `400`을 낸다(SRV-T-062·064). 같은 키가 반복되면 값이 배열이라 `z.string()`이 실패해 기본 문구 `400`이 나간다.

```ts
// server/src/routes/health.ts
import { Hono } from 'hono'
import { PATHS } from '@shared/endpoints'
import type { HealthResponse } from '@shared/types'
import type { AppEnv } from '../services'

// [계약] api.md §4.1 · [요구] R-API-005 · [에러] CONFIG_INVALID(부트스트랩) · INTERNAL · [부수효과] 없음(DB 미접근)
export const healthRoutes = new Hono<AppEnv>().get(PATHS.health, c => {
  const body: HealthResponse = c.get('services').getHealth()
  return c.json(body, 200)
})
```

```ts
// server/src/routes/rooms.ts
import { Hono } from 'hono'
import { PATHS } from '@shared/endpoints'
import type { RoomSummary } from '@shared/types'
import type { AppEnv } from '../services'

// [계약] api.md §4.2 · [요구] R-ROOM-001 · R-AUTH-003(읽기 토큰 불필요) · [에러] CONFIG_INVALID · INTERNAL · [부수효과] 없음
export const roomsRoutes = new Hono<AppEnv>().get(PATHS.rooms, async c => {
  const rooms: RoomSummary[] = await c.get('services').rooms.listRooms()
  return c.json(rooms, 200)
})
```

```ts
// server/src/routes/messages.ts
import { Hono } from 'hono'
import { PATHS } from '@shared/endpoints'
import type { MessagesPage, MessagesQuery } from '@shared/types'
import type { AppEnv } from '../services'
import { messagesQuery, roomIdParam } from './schemas'
import { validate } from './validate'

// [계약] api.md §4.3 · [요구] R-MSG-001 · R-AUTH-003(읽기 토큰 불필요)
// [에러] VALIDATION_ERROR 400 · NOT_FOUND 404 · CONFIG_INVALID · INTERNAL · [부수효과] 없음
export const messagesRoutes = new Hono<AppEnv>().get(
  PATHS.roomMessages,
  validate('param', roomIdParam),
  validate('query', messagesQuery),
  async c => {
    const { id } = c.req.valid('param')
    const query: MessagesQuery = c.req.valid('query')
    const page: MessagesPage = await c.get('services').messages.listMessages(id, query)
    return c.json(page, 200)
  },
)
```

### 11.3 `ui/src/api/` 초안

| 파일 | export | 비고 |
|---|---|---|
| `client.ts` | `type ApiErrorCode` · `type ApiError` · `type Result<T>` · `NETWORK_ERROR` · `toApiError` · `request` | `request`는 api 폴더 내부 전용(index에서 내보내지 않는다) |
| `health.ts` | `getHealth(): Promise<Result<HealthResponse>>` | 화면에서 쓰지 않아도 4자 대조를 위해 둔다(R-API-001) |
| `rooms.ts` | `listRooms(): Promise<Result<RoomSummary[]>>` | S2: `createRoom`·`renameRoom`·`deleteRoom` 추가 |
| `messages.ts` | `listMessages(roomId: string, query?: MessagesQuery): Promise<Result<MessagesPage>>` | S2·S3: 쓰기 래퍼 추가 |
| `index.ts` | 위 래퍼 함수와 `Result`·`ApiError`·`ApiErrorCode` 타입 재노출 | 화면은 `@/api`만 import |

```ts
// ui/src/api/client.ts
/**
 * fetch 래퍼 — 단일 소스 doc/200_설계/contract/api.md §3.4 · §11.3
 * 모든 래퍼는 throw 하지 않고 Result<T> 를 돌려준다 (ts-rules 에러 처리)
 * 화면·컴포넌트·state 는 fetch 를 직접 쓰지 않는다 (확정사항 §3)
 */
import { ERROR_MESSAGES, isErrorCode, type ErrorCode } from '@shared/errors'

export type ApiErrorCode = ErrorCode | 'NETWORK'
export type ApiError = { code: ApiErrorCode; message: string }
export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError }

/** 서버가 내지 않는 클라이언트 전용 실패 (api.md §3.3) */
export const NETWORK_ERROR: ApiError = { code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }
const INTERNAL_ERROR: ApiError = { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL }

/** 동일 출처. 화면은 서버가 /embed 로 내려주고, dev 는 Vite 가 /api 를 프록시한다 */
const BASE_URL = ''

const buildHeaders = (): Headers => new Headers({ Accept: 'application/json' })
// TODO(R-API-003): S2 — 쓰기 요청에 Authorization: Bearer <메모리 토큰> 을 붙인다

const readJson = async (res: Response): Promise<unknown> => {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

/** 실패 응답 본문을 계약 형식으로 맞춘다. 계약 형식이 아니면 INTERNAL (api.md §3.4) */
export const toApiError = (body: unknown): ApiError => {
  const error = (body as { error?: { code?: unknown; message?: unknown } } | null | undefined)?.error
  const code = error?.code
  if (!isErrorCode(code)) return INTERNAL_ERROR
  const message = error?.message
  return { code, message: typeof message === 'string' && message !== '' ? message : ERROR_MESSAGES[code] }
}

/** 계약 경로로 GET 요청을 보내고 Result 로 정규화한다. S2 에서 method·body 옵션을 추가한다 */
export const request = async <T>(path: string): Promise<Result<T>> => {
  let res: Response
  try {
    res = await fetch(BASE_URL + path, { method: 'GET', headers: buildHeaders() })
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }
  const body = await readJson(res)
  if (!res.ok) return { ok: false, error: toApiError(body) }
  return body === undefined ? { ok: false, error: INTERNAL_ERROR } : { ok: true, value: body as T }
}
```

- `fetch`를 `try/catch`로 감싼다. 그래야 동기 throw(테스트 스텁)와 reject(오프라인)를 모두 `NETWORK`로 닫는다. `.catch()`만으로는 동기 throw를 놓친다.
- 성공 본문은 런타임 검증 없이 `T`로 본다. 동일 출처 서버이고 tsc가 양쪽 타입을 같은 shared 타입으로 묶는다.

```ts
// ui/src/api/health.ts
import { endpoints } from '@shared/endpoints'
import type { HealthResponse } from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.1 · [요구] R-API-005 — 서버 상태 */
export const getHealth = (): Promise<Result<HealthResponse>> => request<HealthResponse>(endpoints.health())
```

```ts
// ui/src/api/rooms.ts
import { endpoints } from '@shared/endpoints'
import type { RoomSummary } from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.2 · [요구] R-ROOM-001 · R-ROOMS-001 — 방 목록(updatedAt 내림차순, 서버 정렬) */
export const listRooms = (): Promise<Result<RoomSummary[]>> => request<RoomSummary[]>(endpoints.rooms())
```

```ts
// ui/src/api/messages.ts
import { endpoints } from '@shared/endpoints'
import type { MessagesPage, MessagesQuery } from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.3 · [요구] R-MSG-001 · R-CHAT-003 — 히스토리 한 페이지(오래된→새 순) */
export const listMessages = (roomId: string, query: MessagesQuery = {}): Promise<Result<MessagesPage>> =>
  request<MessagesPage>(endpoints.roomMessages(roomId, query))
```

```ts
// ui/src/api/index.ts
export type { ApiError, ApiErrorCode, Result } from './client'
export { getHealth } from './health'
export { listMessages } from './messages'
export { listRooms } from './rooms'
```

- 화면은 계약 타입(`RoomSummary`·`Message`·`MessagesPage`)을 `@shared/types`에서, 캐릭터 메타를 `@shared/characters`에서 직접 import한다(ts-rules alias 예시와 같다).
- 화면 테스트는 `vi.mock('@/api/rooms')`처럼 래퍼를 모킹한다(tsx-rules). `fetch` 모킹은 `ui/src/api/` 테스트에서만 한다.

### 11.4 구현 순서 (server index.md 확인 필요 항목과 맞춤)

1. contract-implementer: `shared/src/{errors,types,endpoints,characters}.ts` + shared 단위 테스트(API-T-040~043).
2. server-implementer: env·db·rooms·messages·app·services·logger·app-error·`index.ts`(server 테스트는 시험용 라우트로 돈다).
3. contract-implementer: `server/src/routes/*` + `server/test/routes/*`(API-T-001~034), `ui/src/api/*` + `ui/src/api/__tests__/*`(API-T-UI-001~010).
4. 증거: `npx vitest run server/test/routes ui/src/api shared` 결과와 세 워크스페이스 `tsc --noEmit` exit 0.

---

## 12. 4자 대조표 (S1)

판정은 설계 기준이다. 구현 후 contract-implementer가 실제 파일로 다시 채운다.

| 계약 항목 | api.md | shared | routes | ui/api | 판정 |
|---|---|---|---|---|---|
| `GET /api/health` → `HealthResponse` | §4.1 | `PATHS.health` · `endpoints.health` · `HealthResponse` | `health.ts` `healthRoutes` | `health.ts` `getHealth()` | 설계 일치 |
| `GET /api/rooms` → `RoomSummary[]` | §4.2 | `PATHS.rooms` · `endpoints.rooms` · `RoomSummary` | `rooms.ts` `roomsRoutes` | `rooms.ts` `listRooms()` | 설계 일치 |
| `GET /api/rooms/:id/messages` 경로 `id: string` | §4.3 | `PATHS.roomMessages` · `endpoints.roomMessages(roomId)`(인코딩) | `schemas.ts` `roomIdParam` | `listMessages(roomId, …)` | 설계 일치 |
| 같은 엔드포인트 쿼리 `before?` · `limit?` | §4.3 | `MessagesQuery` · `toQueryString` | `schemas.ts` `messagesQuery` → `const query: MessagesQuery` | `listMessages(…, query?: MessagesQuery)` | 설계 일치 |
| 같은 엔드포인트 응답 `MessagesPage` · `Message` · `Speaker` · `MessageKind` | §4.3 · §5.2 | `types.ts` | `const page: MessagesPage` | `Result<MessagesPage>` | 설계 일치 |
| `GET /embed`(+`?t=`) | §4.4 · §7 | `PATHS.embed` | 정의 없음(server `app.ts` 소유) | 해당 없음(`main.tsx` 진입) | 설계 일치 |
| 에러 본문 `{ error: { code, message } }` | §3.1 | `ApiErrorBody` | `validate` throw → server `onError` | `toApiError` → `Result.error` | 설계 일치 |
| 에러 코드 13종·status | §3.2 | `ERROR_CODES` · `ERROR_STATUS` · `ERROR_MESSAGES` · `isErrorCode` | `AppError(code, status, …)` | `ApiErrorCode = ErrorCode \| 'NETWORK'` | 설계 일치(server 권고 §15.2 R2) |
| `NETWORK` | §3.3 | 없음(의도) | 없음 | `NETWORK_ERROR` | 설계 일치 |
| 읽기 토큰 불필요 | §2.1 | — | 토큰 미들웨어 없음 | `Authorization` 헤더 안 붙임 | 설계 일치 |
| 캐릭터 표시 메타 | §5.5 | `CHARACTERS` · `CharacterMeta` · `CharacterId` | 없음(S3 `llm/characters.ts`가 name 대조) | 없음(화면이 shared 직접 import) | 설계 일치 |
| 토큰 형식·전달 | §2.2 · §2.3 | S2 | S2 | S2(`buildHeaders` TODO) | S2 예정 |
| 경로 리터럴 | §5.4 | `endpoints.ts`에만 | `PATHS.*`만 | `endpoints.*`만 | 설계 일치(API-T-044로 검사) |

---

## 13. 호환성 분류

S1은 처음 만드는 계약이라 **전부 「추가」**다. ui·갠홈 영향은 없다.

이후 묶음에서 바뀔 수 있는 자리:

| 자리 | 예상 변경 | 분류 | 대비 |
|---|---|---|---|
| `GET /api/rooms` 응답이 배열 그대로 | 방 목록 페이지네이션·부가 정보가 요구되면 응답 형태 변경 | **파괴** | 요구가 생기면 기존 경로 형태는 유지하고 쿼리 추가로 해결하는 쪽을 먼저 검토(§15.4) |
| `Message` | S2 수정 기능에 "수정됨" 표시 등이 요구되면 선택 필드 추가 | 추가 | 화면은 모르는 필드를 무시한다 |
| `MessagesPage` | 커서 필드 추가 | 추가 | — |
| `ERROR_MESSAGES` 문구 | S2~S4 착수 시 다듬기 | 비파괴 | 화면 표시는 `labels.ts`라 영향 없음 |
| `PATHS`·`endpoints` | S2~S4 키 추가 | 추가 | 기존 키는 바꾸지 않는다 |
| `ui/src/api/client.ts` `request` | S2에서 method·body·토큰 옵션 추가 | 추가(api 폴더 내부) | 화면은 `request`를 쓰지 않는다 |
| `limit` 기본·최대(30·100) | 값 변경 | 완화는 비파괴, 강화는 파괴 | server 상수가 단일 소스 |
| 토큰 형식(S2 확정 후) | payload·서명·`?t=` 이름 변경 | **파괴 + 저쪽 PHP 재적용** | §8 |
| `CHARACTERS.*.name` | 표시명 변경 | 비파괴(표시만) | S3부터는 `server/characters/*.json` name도 함께 바꾼다 |

---

## 14. 테스트 계획

### 14.1 routes — `server/test/routes/*.test.ts`

- 실행: `@cloudflare/vitest-pool-workers`(workerd, D1 바인딩, 마이그레이션 적용 — db.md §8).
- 앱: `const app = createApp({ routes: apiRoutes, now: () => 1_700_000_000_000 })`. 호출: `app.request(path, init, testEnv, createExecutionContext())`.
- `testEnv`: `cloudflare:test`의 `env`를 펼치고 필요한 키만 바꾼다(index.md §8 방식). `ASSETS`는 index.md 픽스처의 가짜 Fetcher를 쓴다.
- 데이터: 직접 `INSERT`로 넣는다. 메시지 id는 INSERT 결과에서 얻고 절대값을 가정하지 않는다.
- 공용 단언 `expectContractError(res, code)`: status가 `ERROR_STATUS[code]`이고, 본문 키가 정확히 `error` 하나이며, `error` 키가 정확히 `code`·`message`이고, `message`가 비어 있지 않음을 확인한다(R-API-002). 모든 에러 테스트가 이 단언을 쓴다.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-001 | `health_returns_ok_and_version` | `GET /api/health` | 200, 본문 키가 정확히 `ok`·`version`, `ok === true`, `version`이 빈 문자열 아님 | R-API-005 |
| API-T-002 | `health_ok_even_if_db_unusable` | `DB`를 모든 `prepare`가 throw하는 가짜로 교체 | 200(DB 미접근) | R-API-005 |
| API-T-003 | `health_returns_CONFIG_INVALID_when_secret_missing` | `TOKEN_SECRET` 제거 | `expectContractError(res, 'CONFIG_INVALID')`, 본문에 키 이름 없음 | R-ENV-003 · R-API-002 |
| API-T-004 | `api_responses_carry_csp_without_x_frame_options` | `GET /api/rooms` | `Content-Security-Policy: frame-ancestors http://london-gossip.my https://london-gossip.my`, `X-Frame-Options` 없음 | R-API-006 |
| API-T-005 | `embed_is_not_shadowed_by_api_routes` | `GET /embed?t=x`(실제 `apiRoutes` 장착) | 가짜 `ASSETS`가 `/`를 받고 200 | R-API-006 · R-API-001 |
| API-T-010 | `rooms_returns_empty_array` | 빈 DB | 200 `[]` | R-ROOM-001 |
| API-T-011 | `rooms_sorted_desc_with_contract_fields` | `updated_at` 100·300·200, 메시지 0·2·5 | 300·200·100 순, 각 항목 키가 정확히 `id,title,createdAt,updatedAt,messageCount`, 시각·개수가 number | R-ROOM-001 · R-API-004 |
| API-T-012 | `rooms_ignores_authorization_header` | `Authorization: Bearer garbage` | 200, API-T-011과 같은 본문 | R-AUTH-003 |
| API-T-013 | `single_room_get_does_not_exist` | `GET /api/rooms/<존재하는 id>` | `expectContractError(res, 'NOT_FOUND')` | R-API-001 |
| API-T-014 | `rooms_hides_db_failure_as_INTERNAL` | `prepare`가 `Error('SENTINEL_DB')`를 throw하는 `DB` | `expectContractError(res, 'INTERNAL')`, 본문에 `SENTINEL_DB`·`stack` 없음 | R-API-002 · R-NFR-004 |
| API-T-020 | `messages_first_page_defaults_to_30_ascending` | 70건 방, 쿼리 없음 | 200, 30건, id 오름차순, 최신 30건, `hasMore === true` | R-MSG-001 |
| API-T-021 | `messages_three_pages_via_before_cursor` | 70건, `before = messages[0].id`로 2회 더 | 30·30·10건, `hasMore` true·true·false, 쪽 사이 중복·누락 없음 | R-MSG-001 · R-CHAT-003 |
| API-T-022 | `messages_accepts_limit_bounds_and_empty_values` | `limit=1` · `limit=100` · `?before=&limit=` | 1건 · 70건(전부) · 쿼리 없음과 같은 결과 | R-MSG-001 |
| API-T-023 | `messages_item_shape_has_no_authorMbId` | 캐릭터·유저 line·유저 ooc 각 1건 | 키가 정확히 `id,roomId,speaker,kind,text,authorName,createdAt`, `id`·`createdAt` number, 캐릭터 `authorName === null` | R-API-004 · R-MSG-001 |
| API-T-024 | `messages_ignores_authorization_header` | `Authorization: Bearer garbage` | 200 | R-AUTH-003 |
| API-T-030 | `messages_rejects_invalid_limit` | `limit` = `0` · `101` · `1.5` · `abc` | 각 `expectContractError(res, 'VALIDATION_ERROR')`, message = `불러올 개수(limit)는 1~100 사이의 정수여야 합니다.` | R-MSG-001 · R-API-004 |
| API-T-031 | `messages_rejects_invalid_before` | `before` = `0` · `-1` · `abc` · `9007199254740992` | 각 400 `VALIDATION_ERROR`, message = `기준 메시지 번호(before)가 올바르지 않습니다.` | R-MSG-001 · R-API-004 |
| API-T-032 | `messages_rejects_repeated_query_key` | `?limit=1&limit=2` | 400 `VALIDATION_ERROR`, message = `요청 형식이 올바르지 않습니다.` | R-API-004 |
| API-T-033 | `messages_unknown_room_returns_NOT_FOUND` | 없는 id(`before` 유무 둘 다) | `expectContractError(res, 'NOT_FOUND')`, message = `방을 찾을 수 없습니다.` | R-MSG-001 |
| API-T-034 | `messages_validates_before_room_lookup` | 없는 id + `limit=0` | 400 `VALIDATION_ERROR`(404 아님) | R-MSG-001 |

- 정상 경로는 12건이다(001·002·004·005·010·011·012·020~024). 에러 경로는 8개 테스트에 입력 15건이다(030·031은 입력 4개씩, 033은 2개). 에러 입력 수가 정상 경로 수보다 많다(스킬 §10).

### 14.2 shared — `shared/test/*.test.ts`

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| API-T-040 | `error_table_matches_contract` | `ERROR_CODES` 집합이 R-API-002 13종과 같음, 모든 코드에 `ERROR_STATUS`·`ERROR_MESSAGES`가 있음, status가 §3.2 표와 같음, 문구가 비어 있지 않음 | R-API-002 |
| API-T-041 | `isErrorCode_accepts_only_contract_codes` | `'NOT_FOUND'` true · `'NETWORK'`·`'not_found'`·`1`·`undefined` false | R-API-002 |
| API-T-042 | `endpoints_build_paths_and_queries` | `PATHS` 값 4개, `roomMessages('a b/c')` → `/api/rooms/a%20b%2Fc/messages`, `{ before: 41 }` → `?before=41`, `{ before: 41, limit: 30 }` → `?before=41&limit=30`, `{}`·`{ limit: undefined }` → 물음표 없음 | R-API-001 · R-API-008 |
| API-T-043 | `characters_meta_matches_contract` | 키가 정확히 `sebastian`·`ciel`, 각 `id`가 키와 같음, 이름이 확정사항 §1, `avatar === '/embed/img/{id}.png'` | R-LLM-002 · R-CHAT-002 |
| API-T-044 | `no_path_literals_outside_shared`(리뷰 grep) | §14.4 경로 리터럴 grep 결과 0건 | R-API-008 |

### 14.3 ui/api — `ui/src/api/__tests__/*.test.ts` (`vi.stubGlobal('fetch', …)`)

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| API-T-UI-001 | `request_returns_ok_value_on_2xx_json` | 200 JSON → `{ ok: true, value }` | R-API-002 |
| API-T-UI-002 | `request_passes_contract_error_body_through` | 404 `{ error: { code: 'NOT_FOUND', message: '방을 찾을 수 없습니다.' } }` → 같은 `code`·`message` | R-API-002 |
| API-T-UI-003 | `request_maps_fetch_failure_to_NETWORK` | `fetch`가 reject / 동기 throw → `{ code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }` | R-API-002 |
| API-T-UI-004 | `request_maps_non_contract_error_body_to_INTERNAL` | 502 HTML 본문 → `INTERNAL` + `ERROR_MESSAGES.INTERNAL` | R-API-002 |
| API-T-UI-005 | `request_handles_unknown_code_and_missing_message` | 모르는 code → `INTERNAL`. `{ code: 'RATE_LIMITED' }`(message 없음) → `ERROR_MESSAGES.RATE_LIMITED` | R-API-002 |
| API-T-UI-006 | `request_maps_non_json_success_to_INTERNAL` | 200 + 본문 `'not json'` → `INTERNAL` | R-API-002 |
| API-T-UI-007 | `listRooms_calls_GET_api_rooms_without_auth` | URL `/api/rooms`, method `GET`, `Authorization` 헤더 없음 | R-ROOM-001 · R-AUTH-003 |
| API-T-UI-008 | `listMessages_builds_path_and_query` | `('r1')` → `/api/rooms/r1/messages`, `('r1', { before: 41 })` → `…?before=41`, `('a b', { limit: 10 })` → `/api/rooms/a%20b/messages?limit=10` | R-MSG-001 · R-API-008 |
| API-T-UI-009 | `getHealth_calls_GET_api_health` | URL `/api/health` | R-API-005 |
| API-T-UI-010 | `wrappers_never_reject` | `fetch` throw · `json()` throw · 500 등 모든 경우에 `await`가 reject하지 않음 | R-API-002 |

### 14.4 리뷰·수동

- 라우트 핸들러 30줄 이내, try/catch·`c.env` 설정 키·`c.json({ error … })` 직접 생성 0건(R-API-007·R-ENV-001·R-API-002).
- `fetch(` 사용이 `ui/src/api/` 밖에서 0건이어야 한다(경계). 경로 리터럴은 `shared/src/endpoints.ts` 밖에서 0건이어야 한다(API-T-044, R-API-008).

```bash
grep -rn "fetch(" ui/src --include=*.ts --include=*.tsx | grep -v "^ui/src/api/"
grep -rnE "[\"'\`]/(api|embed)" server/src/routes ui/src/api
```
- 시드 적용 후 `curl -i http://localhost:3000/api/rooms/00000000-0000-4000-8000-000000000001/messages`가 30건·오름차순·`hasMore: true`, `authorMbId` 없음.

---

## 15. server 의존 · 변경 요청 · 확인 필요

### 15.1 사용하는 server 함수·타입 (모두 server 설계에 있음)

| 사용처 | server 쪽 | 출처 |
|---|---|---|
| `health.ts` | `Services.getHealth(): HealthStatus` | index.md §2.3 |
| `rooms.ts` | `RoomsService.listRooms(): Promise<RoomSummary[]>` | rooms.md §2.1 |
| `messages.ts` | `MessagesService.listMessages(roomId: string, query: MessagePageQuery): Promise<MessagePage>` | messages.md §2.1 |
| `validate.ts` | `AppError(code: ErrorCode, status: AppErrorStatus, message: string)` | index.md §2.4 |
| 모든 라우트 | `type AppEnv`(`Variables.services`) | index.md §2.3 |
| 테스트 | `createApp({ routes, logSink?, now? })` | index.md §2.2 |

- env 바인딩·설정 추가: **없음**(`ALLOWED_FRAME_ANCESTORS`·`DB`·`ASSETS`는 이미 R-ENV-002에 있다).

### 15.2 server 설계 변경 요청 (막는 것 없음 — 권고 3건)

| # | 대상 | 요청 | 이유 |
|---|---|---|---|
| R1 | db.md §2.1 · messages.md §2.1 · index.md §2.3 | 계약 타입을 server에서 다시 정의하지 말고 `@shared/types`에서 import해 재노출한다. 대상: `Speaker`·`MessageKind`·`RoomSummary`·`Message`(db), `MessagePage`→`MessagesPage`·`MessagePageQuery`→`MessagesQuery`(messages), `HealthStatus`→`HealthResponse`(services). 서버 내부 이름을 유지하려면 `export type MessagePage = MessagesPage`처럼 별칭으로 둔다 | 지금도 구조가 같아 tsc는 통과한다. 하지만 같은 모양을 두 곳에서 정의하면 한쪽만 바뀔 여지가 남는다. 라우트의 대입 검사(§5.6)가 안전망이다 |
| R2 | index.md §2.4 `AppError` | status 인자를 받지 않고 `ERROR_STATUS[code]`로 정하거나, 최소한 server 테스트에서 `status === ERROR_STATUS[code]`를 검사한다. `AppErrorStatus`는 shared `ErrorStatus`로 대체할 수 있다 | §3.1 "코드 1개 = status 1개". 지금 시그니처는 다른 status를 넣을 수 있다 |
| R3 | index.md §5.1 · env.md §5 | `CONFIG_INVALID`·`INTERNAL`·`VALIDATION_ERROR`(HTTPException 400) 응답 문구를 `ERROR_MESSAGES`에서 가져온다 | 문구가 이미 같으니 상수로 묶으면 단일 소스가 된다. `notFound` 문구(`요청한 주소를 찾을 수 없습니다.`)는 상황 문구라 그대로 둔다 |

### 15.3 스킬·에이전트 문구와 다른 결정 (요구가 우선, 메인 세션이 문구 갱신 필요)

| 문서 | 옛 문구 | 이 계약(근거) |
|---|---|---|
| contract-design-strategy §3 · §7 | 페이지 `{ items, nextBefore }`, 기본 40 | `{ messages, hasMore }`, 기본 30(R-MSG-001) |
| contract-design-strategy §3 · §4.1 · §4.2 | `VALIDATION_FAILED` · `AUTH_REQUIRED` · `TOKEN_EXPIRED` · `ROOM_NOT_FOUND` · `LLM_TIMEOUT` 등 | R-API-002 13종(만료는 `TOKEN_INVALID`, 없음은 `NOT_FOUND`) |
| contract-design-strategy §4.1 | payload `{ mbId, nick, chName, level, exp }` | `{ mb_id, nick, ch_name, level, exp }`(R-AUTH-001) |
| contract-design-strategy §7 | `/api/*`에는 `frame-ancestors 'none'` | 모든 응답에 같은 허용 출처(R-API-006, index.md §3.1) |
| contract-design-strategy §9 | routes에 `embed.ts`, `app.onError`는 routes/index.ts | `/embed`·`onError`는 server 진입점(index.md D-IDX-6, §9.1) |
| contract-designer 에이전트 본문 | 시각은 ISO 8601 문자열 | epoch ms(R-API-004, R-DB-001) |
| 위임문 | ui/api `ApiError` **클래스**로 정규화 | `ApiError`는 **타입**, 래퍼는 `Result<T>` 반환·throw 금지(ts-rules 에러 처리, contract-design-strategy §11) |

### 15.4 확인 필요 (사용자 판단)

1. **캐릭터 표시명.** 확정사항 §1과 위임문대로 `name`은 전체 이름(`세바스찬 미카엘리스`·`시엘 팬텀하이브`)이다. 화면 구성안은 말풍선에 짧은 이름(`시엘`·`세바스찬`)을 그린다. 짧은 이름이 필요하면 R-LLM-002의 표시 메타에 필드를 추가하는 요구 개정이 필요하다. 그전까지 화면은 `name`을 그대로 쓴다.
2. **R-CHAT-009 묶음과 토큰 보관 위치.** requirements.md §0은 CHAT-009를 S1에, rtm.md는 S2(`ui/src/state/token`)에 둔다. ui-design-strategy는 `ui/src/api/client.ts` 보관을 말한다. 이 계약은 S1에서 토큰을 다루지 않는다고 가정했다. 그러면 S1 화면은 언제나 읽기 전용이고, 쓰기 UI가 아직 없으니 R-CHAT-008은 자연히 충족된다. 보관 위치는 S2에서 정해야 한다.
3. **`GET /api/rooms` 응답 형태.** 위임문대로 배열 그대로 둔다. 방 목록에 페이지네이션이나 부가 정보가 요구되면 응답 형태 변경(파괴)이 된다. 지금 `{ rooms: [...] }`로 감싸면 그 위험이 없다. 다만 위임문과 다르므로 바꾸려면 결정이 필요하다.
4. **절 배치.** 위임문은 요구 추적표를 끝에 두라고 했다. 스킬 §13의 고정 절 번호에 따라 §10에 두었고, 구현 설계는 §11~§15 부록으로 붙였다.
