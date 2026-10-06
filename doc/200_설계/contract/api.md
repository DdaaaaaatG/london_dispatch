# API 계약 (api.md)

- 상태: **초안 v0.5** · 최종 갱신 2026-10-06 · 소유 contract-designer
- (v0.5) **S3c 상세 확정**(구현 전) = 캐릭터 설정(갠홈 주인 전용) — 설정 엔드포인트 예외·주인 판정 규약(§2.7) · 에러 코드 15종째 `OWNER_ONLY` 403(§3.2) · `GET /api/settings/characters`(E15, §4.15) · `PUT /api/settings/characters`(E16, §4.16) · 설정 타입 4종·`shared/src/settings.ts` 전문(§5.8) · 내보내기 파일 형식·가져오기 매핑(§16). 엔드포인트 14 → 16개. 토큰 형식·handoff 불변. 입력: `requirements.md` §11-1 R-SET-001~012 · R-API-001·002 · R-AUTH-003(2026-10-06 개정), `doc/200_설계/architecture/s3c-02-전반설계.md` §2.1·§4·§6, `s3c-03-인계패킷.md` §0·§1.3·§2.
- 묶음: **S1 상세 확정**(구현 완료) = `GET /api/health` · `GET /api/rooms` · `GET /api/rooms/:id/messages` · `GET /embed`. **S2 상세 확정**(구현 전) = 토큰 규약(§2) · `POST /api/rooms` · `PATCH`·`DELETE /api/rooms/:id` · `POST /api/rooms/:id/user` · `PATCH`·`DELETE /api/messages/:id` · 쓰기 레이트리밋(§6). **S3 상세 확정**(구현 전, v0.4) = 생성 공통 규칙(§4.12) · `POST /api/rooms/:id/speak`(E9, §4.13) · `POST /api/messages/:id/regenerate`(E12, §4.14). **S3b 상세 확정**(구현 전, v0.4.1) = 월 AI 비용 상한(R-LLM-007 🔒) — 에러 코드 14종째 `LLM_BUDGET_EXCEEDED`(§3.2) · 429 두 종류 구분(§3.4) · E9·E12 판정 순서(§4.12~§4.14) · 레이트리밋 카운트(§6.1). 엔드포인트·타입·경로 추가 없음. 나머지(S4 memory)는 §4.0 표에 행만 두고 S4에서 상세를 정한다.
- 이 문서가 단일 소스다: **api.md → `shared/src/*` → `server/src/routes/*` → `ui/src/api/*` → `doc/handoff/*`(S5)**. 넷이 어긋나면 contract 결함이다(확정사항 §3).
- 입력: `doc/000_프로젝트_확정사항.md` §1·§2·§3·§5.2~§5.4·§6, `doc/100_요구조건/requirements.md` §3·§4·§5·§7(R-LLM-002)·§8·§9, `doc/200_설계/server/{index,env,db,rooms,messages}.md`, `doc/200_설계/architecture/ui-layout-01-rooms-chat.md`. (v0.4) `doc/200_설계/server/llm.md` 「contract 인계 요구 명세」·§2.3·§2.6·§4.2·§5, `messages.md` §2.3·§4.2·§4.3·§5·§9, `db.md` §2.3, `ui/src/chat/design.md` §8.3·§14. (v0.4.1) `requirements.md` R-LLM-007·R-API-002(2026-10-06 개정), `llm.md` §11 D-LLM-16~23·§12·「contract 인계」 S3b 절, `messages.md` §4.2·§5, `index.md` §2.4·§5.1·§5.2.
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

| 당사자 | 파일 | S1 내용 | S2 추가(v0.3) |
|---|---|---|---|
| 문서(정본) | `doc/200_설계/contract/api.md` | 이 문서 | §2 토큰 · §4.5~§4.11 · §6 |
| 공용 타입 | `shared/src/types.ts` | `CharacterId` · `Speaker` · `MessageKind` · `RoomSummary` · `Message` · `MessagesQuery` · `MessagesPage` · `HealthResponse` · `ApiErrorBody` | `CreateRoomBody` · `RenameRoomBody` · `UserMessageBody` · `EditMessageBody` · `ApiErrorBody.error.retryAfterSec?` |
| 에러 코드 | `shared/src/errors.ts` | 13종 전체(`ERROR_CODES` · `ErrorCode` · `ErrorStatus` · `ERROR_STATUS` · `ERROR_MESSAGES` · `isErrorCode`) | 변경 없음(13종 그대로) |
| 경로 | `shared/src/endpoints.ts` | `PATHS`(embed·health·rooms·roomMessages) · `endpoints` 빌더 | `PATHS.room` · `PATHS.roomUser` · `PATHS.message` · `endpoints.room/roomUser/message` |
| 캐릭터 표시 메타 | `shared/src/characters.ts` | `CharacterMeta` · `CHARACTERS`(R-LLM-002) | 변경 없음 |
| 길이 규칙 (v0.3.1) | `shared/src/limits.ts` | — | **신규** `ROOM_TITLE_MAX` · `MESSAGE_TEXT_MAX` · `MEMORY_SUMMARY_MAX` · `countCodePoints` · `normalizeText`(§5.7) |
| 서버 쪽 | `server/src/routes/{index,validate,schemas,health,rooms,messages}.ts` | `apiRoutes` 조립 · zod 검증 · GET 3종 | `rooms.ts` POST·PATCH·DELETE · `messages.ts` POST user·PATCH·DELETE · `schemas.ts` 본문·메시지 id 스키마 |
| 화면 쪽 | `ui/src/api/{client,health,rooms,messages,index}.ts` | `request` · `getHealth` · `listRooms` · `listMessages` | `configureClient` · `isAuthFailure` · `createRoom` · `renameRoom` · `deleteRoom` · `appendUser` · `editMessage` · `deleteMessage` |
| 갠홈 쪽 | `doc/handoff/*` | S5(쓰지 않음) | S5(쓰지 않음). §2.6이 참조 규약 |

S3 추가(v0.4):

| 당사자 | 파일 | S3 추가 |
|---|---|---|
| 문서(정본) | `doc/200_설계/contract/api.md` | §4.12~§4.14 · §11.8~§11.10 · §12.2 · §13.2 · §14.9~§14.11 · §15.8~§15.10 · 「ui 인계 메모」 |
| 공용 타입 | `shared/src/types.ts` | `SpeakBody` |
| 에러 코드 | `shared/src/errors.ts` | 변경 없음(S3 코드 5종은 S1부터 13종 안에 있다) |
| 경로 | `shared/src/endpoints.ts` | `PATHS.roomSpeak` · `PATHS.messageRegenerate` · `endpoints.roomSpeak/messageRegenerate` |
| 캐릭터 표시 메타 · 길이 규칙 | `shared/src/characters.ts` · `limits.ts` | 변경 없음 |
| 서버 쪽 | `server/src/routes/{schemas,messages}.ts` | `speakBody` · `messages.ts` POST speak(E9) · POST regenerate(E12) |
| 화면 쪽 | `ui/src/api/{messages,index}.ts` | `speak` · `regenerate` |
| 갠홈 쪽 | `doc/handoff/*` | 영향 없음 |

S3b 추가(v0.4.1):

| 당사자 | 파일 | S3b 추가 |
|---|---|---|
| 문서(정본) | `doc/200_설계/contract/api.md` | §3.2 14행째 · §3.1·§3.4·§3.5 · §4.12~§4.14 판정·에러 행 · §5.2·§5.3 · §6.1 S3b 행 · §8 handoff 예정 · §11.11 · §12.3 · §13.3 · §14.12·§14.13 · §15.11 · 「ui 인계 메모」 S3b · 「contract-implementer 인계 목록」 |
| 공용 타입 | `shared/src/types.ts` | **타입 변경 없음.** `ApiErrorBody.error.retryAfterSec?` 문서주석만 두 코드로 넓힌다 |
| 에러 코드 | `shared/src/errors.ts` | `LLM_BUDGET_EXCEEDED` — `ERROR_CODES` · `ERROR_STATUS` · `ERROR_MESSAGES` 3곳 |
| 경로 · 캐릭터 · 길이 | `endpoints.ts` · `characters.ts` · `limits.ts` | 변경 없음 |
| 서버 쪽 | `server/src/routes/*` | 변경 없음(서비스가 throw, server `onError`가 변환) |
| 화면 쪽 | `ui/src/api/*` | 코드·시그니처 변경 없음. `isErrorCode`가 shared를 따라 14종을 받는다. `retryAfterSec`는 계속 `RATE_LIMITED`에만 싣는다(§3.4) |
| 갠홈 쪽 | `doc/handoff/*` | S5에 AI 비용 추정 안내 1단락(§8) |

S3c 추가(v0.5):

| 당사자 | 파일 | S3c 추가 |
|---|---|---|
| 문서(정본) | `doc/200_설계/contract/api.md` | §2.7 · §3.2 15행째 · §3.4 · §4.0 E15·E16 · §4.15 · §4.16 · §5.8 · §6.1 S3c 행 · §8 TODO · §11.12~§11.14 · §12.4 · §13.4 · §14.14~§14.16 · §15.12 · §16 · 「ui 인계 메모」 S3c · 「contract-implementer 인계 목록」 S3c |
| 공용 타입 | `shared/src/types.ts` | `CharacterSettingFields` · `CharacterSettings` · `CharacterSettingsResponse` · `PutCharacterSettingsBody` |
| 에러 코드 | `shared/src/errors.ts` | `OWNER_ONLY`(403) — `ERROR_CODES` · `ERROR_STATUS` · `ERROR_MESSAGES` 3곳 |
| 경로 | `shared/src/endpoints.ts` | `PATHS.characterSettings` · `endpoints.characterSettings()` |
| 설정 규칙 | **신규** `shared/src/settings.ts` | 필드 화면 이름·필수·상한 표, 파일 형식 상수, 본문·가져오기 바이트 상한, 사전 검사 `checkCharacterSettings`(zod 없음) |
| 캐릭터 표시 메타 · 길이 규칙 | `characters.ts` · `limits.ts` | **변경 없음.** `settings.ts`가 `CHARACTERS`·`countCodePoints`·`normalizeText`를 import한다 |
| 서버 쪽 | `server/src/routes/{settings(신규),index,schemas,validate}.ts` | E15·E16 · `putCharacterSettingsBody` · `settingsIssueMessage` · `validate`의 선택 인자 `toMessage` |
| 화면 쪽 | `ui/src/api/{settings(신규),client,index}.ts` | `getCharacterSettings` · `saveCharacterSettings` · `RequestOptions.method`에 `'PUT'` |
| 갠홈 쪽 | `doc/handoff/*` | **변경 없음**(토큰 형식 불변). S5 embed-guide TODO 1줄(§8) |

### 1.2 경계 규칙

- **단방향.** 화면·컴포넌트·state는 `@/api`(= `ui/src/api/index.ts`)만 import한다. `fetch`를 `ui/src/api/` 밖에서 쓰면 경계 위반이다.
- **라우트는 얇다.** 핸들러는 zod 검증 → `c.get('services')`의 서비스 호출 → `c.json()`만 한다(30줄 이내, R-API-007). 범위·존재 판정은 서비스가 한다.
- **진입점 소유(server).** `/embed` 서빙, `onError`·`notFound`, CSP 헤더, 요청 로그는 server 진입점(`server/src/app.ts`)이 갖는다. 라우트는 이것들을 정의하지 않는다(server index.md §9.1).
- **경로 리터럴은 `shared/src/endpoints.ts` 한 곳에만** 둔다(R-API-008).

### 1.3 현황 메모 (2026-10-05, v0.3 작성 시점)

- S1 4자(문서·shared·routes·ui/api)는 구현돼 있고 계약 값은 일치한다(v0.2.1).
- 문서 초안과 코드 표기 차이(계약 영향 없음, analyst 확인용): `validate.ts`가 `new AppError('VALIDATION_ERROR')`(status·문구는 `AppError`가 코드에서 정함)를 쓰고, §3.5·§11.2 초안은 옛 3인자 표기다. server index.md의 S1 동기화(`AppError(code, message?, options?)`)가 정본이다.
- S2 server 쪽(`server/src/auth/`, `rooms`·`messages`의 쓰기 함수, `AppError`의 `retryAfterSec`, `toErrorBody` 3번째 인자)은 **아직 없다**. S2 routes 구현은 server S2 구현 뒤에 한다(§11.4).
- `ui/src/state/token.ts`는 아직 없다. `viewer.ts`는 S1 상수 `READ_ONLY_VIEWER`뿐이다.
- 구현 순서는 §11.4를 따른다.
- (v0.4, 2026-10-06) S3 4자는 **전부 아직 없다.** `shared/src/endpoints.ts`에 speak·regenerate 경로가 없고 routes에 핸들러가 없어 두 경로는 지금 `404 NOT_FOUND`다. server 쪽도 `server/src/llm/`·`messages.speak`·`regenerate`가 없다(설계만 있음).
- (v0.4) S2 routes 테스트의 실제 파일은 `server/test/routes-write.test.ts`다. §14.5 제목의 `routes.test.ts` 표기와 다르다(계약 영향 없음, analyst 확인용).
- (v0.4.1, 2026-10-06) S3 4자는 구현됐다(§12.2). **S3b 4자는 전부 아직 없다.** `shared/src/errors.ts`는 13종이고(`shared/test/errors.test.ts` API-T-040이 `toHaveLength(13)`), `server/src/llm/usage.ts`·`Llm.ensureBudget`도 없다. `shared/src/types.ts`·`server/src/app-error.ts`·`server/src/app.ts`·`ui/src/api/client.ts`의 `retryAfterSec` 주석은 "RATE_LIMITED 전용"이다. 다만 `app.ts` `errorResponse`는 코드 종류를 보지 않고 `err.retryAfterSec`이 있으면 본문·`Retry-After`를 붙인다. routes 테스트 `expectContractError`(`routes-write.test.ts`·`routes-generate.test.ts` 두 벌)는 `RATE_LIMITED`만 3키를 허용한다(§14.12에서 갱신).

### 1.4 묶음별 범위

| 묶음 | 이 문서에서 정하는 것 |
|---|---|
| S1 | §3 에러 코드 13종 전부, §4.1~§4.4, §5 shared 4파일, §11 routes·ui/api, §12~§14 |
| S2 (**v0.3 확정**) | §2 토큰 상세(형식·전달·검증 순서·`TokenPayload`·화면 보관·전환·교차 벡터), §4.5~§4.11 쓰기 엔드포인트(방 생성·변경·삭제, user 저장, 메시지 수정·삭제), §6 레이트리밋, §11.5~§11.6 routes·ui/api 설계 |
| S3 (**v0.4 확정**) | §4.12 생성 공통(70초 상한·화면 타임아웃 규약·잠금·레이트리밋 카운트), §4.13 speak, §4.14 regenerate, §5.2·§5.4 델타(`SpeakBody`·경로 2개), §11.8~§11.10 routes·ui/api 설계, 「ui 인계 메모」 |
| S3b (**v0.4.1 확정**) | §3.2 14종째 코드, §3.4 429 두 종류 구분, §4.12~§4.14 판정 순서·에러 행, §6.1 카운트, §8 handoff 메모 예정, §11.11 구현 부록, 「ui 인계 메모」 S3b. 엔드포인트 추가 0 |
| S3c (**v0.5 확정**) | §2.7 설정 엔드포인트 예외·주인 판정, §3.2 15종째 `OWNER_ONLY`, §4.15 E15·§4.16 E16, §5.8 타입·`settings.ts`, §6.1 S3c 카운트, §11.12~§11.14 routes·ui/api, §16 파일 형식·가져오기 매핑. 엔드포인트 2개 추가 |
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
| 예외(요구 명시) | `GET /api/rooms/:id/memory`는 읽기지만 **토큰 필요**(확정사항 §5.2, R-MEM-001). S4에서 상세. (v0.5) `GET /api/settings/characters`(E15)도 읽기지만 **토큰 + 주인 판정 필요**(R-AUTH-003 2026-10-06 개정 · R-SET-004, §2.7). 이 경로는 헤더를 무시하지 않고 검증하며, 래퍼 `getCharacterSettings`는 `auth: true`로 헤더를 붙인다 |
| S1 화면 | **항상 읽기 전용**이다. R-CHAT-009(토큰 메모리 보관)는 S2로 옮겨졌다(requirements §0, 2026-10-05) |
| 토큰 보관(S2 확정) | §2.4. 보관은 `ui/src/state/token.ts`가 소유한다. `ui/src/api/client.ts`는 `configureClient({ getToken })`로 getter를 주입받아 **쓰기 요청에만** 헤더를 붙인다 |
| S2 이후 읽기 | 화면이 토큰을 가지고 있어도 읽기 래퍼(`getHealth`·`listRooms`·`listMessages`)는 `Authorization`을 붙이지 않는다. 서버도 읽기 경로에서 헤더를 보지 않는다 |

### 2.2 전달 규약 (S2 확정 — R-API-003 🔒 · R-AUTH-003 🔒)

| 항목 | 규칙 |
|---|---|
| 받는 곳 | `Authorization: Bearer <t>` 헤더 **하나뿐**. scheme 대소문자 무시(`bearer`도 됨), scheme 뒤 공백 1개 이상, 토큰 앞뒤 공백은 버린다(server auth.md §2.4 `readBearer`) |
| 보지 않는 곳 | 쿼리 `?t=`·쿠키·본문. 헤더 없이 `?t=<유효 토큰>`만 붙인 쓰기 요청은 `401 TOKEN_REQUIRED`다 |
| 꺼낼 수 없음 | 헤더 없음 · 빈 값 · 공백뿐 · `Bearer`만 있고 토큰 자리 빔 · 다른 scheme(`Basic …`) → `401 TOKEN_REQUIRED` |
| 꺼냈는데 실패 | §2.3 검증 실패 → `401 TOKEN_INVALID` 또는 `403 LEVEL_TOO_LOW` |
| 적용 범위 | **쓰기 라우트마다** `requireToken → rateLimitWrites → validate → 핸들러` 순서로 붙인다. 전역·라우터 단위(`apiRoutes.use`) 금지(server auth.md §9.1, index.md D-IDX-9) |
| S2 적용 대상 | E4 · E5 · E6 · E8 · E10 · E11(§4.0) 6개 전부. S3 E9·E12도 같다. S4 E13(GET memory)은 `requireToken`만 붙인다(S4에서 확정) |
| 순서의 결과 | 인증 실패가 본문 검증 실패보다 먼저 나온다. 토큰 없이 잘못된 본문을 보내면 `400`이 아니라 `401 TOKEN_REQUIRED`다 |
| 화면 쪽 | 쓰기 래퍼만 `Authorization: Bearer <getToken()>`을 붙인다. getter가 `null`이면 헤더 없이 보낸다(서버가 `TOKEN_REQUIRED`로 답하고 래퍼는 그대로 돌려준다). API 호출 URL에 `?t=`를 붙이지 않는다 |

### 2.3 토큰 형식 (S2 확정 — R-AUTH-001 🔒 · R-AUTH-002 🔒)

server auth.md §2.1~§2.3과 같은 문구다. 둘이 어긋나면 contract 결함이다.

```
token     = seg1 "." seg2
seg1      = base64url( JSON 바이트 )                                         ← PHP json_encode 결과 문자열의 UTF-8 바이트
seg2      = base64url( HMAC-SHA256( key = UTF-8(SECRET), data = JSON 바이트 ) )   ← 32바이트
base64url = RFC 4648 §5 알파벳(A–Z a–z 0–9 - _), 패딩 '=' 없음, 정규 인코딩만
```

- **서명 입력은 JSON 바이트**(seg1을 디코드한 바이트)다. seg1 문자열이 아니다(JWT와 다르다, auth.md D-AUTH-1). PHP 기준식: `$json = json_encode($payload, FLAGS); $token = b64u($json) . '.' . b64u(hash_hmac('sha256', $json, SECRET, true));`
- 토큰 원문은 4096자 이하다(`TOKEN_MAX_LENGTH`). 실제 토큰은 300자 안팎이다.

`TokenPayload` — 문서용 표기다. **shared에 두지 않는다**(화면은 토큰을 해석하지 않고, 서버는 auth 모듈의 zod 스키마가 정본이다). 필드 이름은 R-AUTH-001대로 snake_case이며 API 본문 camelCase 규칙(§5.1)의 유일한 예외다(갠홈 PHP 산출물).

```ts
type TokenPayload = {
  mb_id: string           // 그누보드 로그인 id. 1자 이상. 서버는 trim 하지 않는다(레이트리밋 키·author_mb_id)
  nick: string            // 닉네임. trim 후 1자 이상
  ch_name: string | null  // 캐릭터명. 키는 항상 있어야 한다. '' · 공백뿐 · null 이면 "캐릭터명 없음"
  level: number           // JSON 정수 1~10. 문자열 "5" 거부 → PHP 는 (int)$member['mb_level']
  exp: number             // JSON 정수, epoch 초 = 발급 시각 + 43200(12h). 문자열 거부 → PHP 는 time() + 43200
}
```

```json
{"mb_id":"tester01","nick":"테스터","ch_name":"시엘 팬텀하이브","level":5,"exp":1767268800}
```

- 모르는 키는 무시한다(`iat` 등을 넣어도 통과).
- JSON 직렬화 플래그는 **검증 결과와 무관하다.** 서버는 seg1을 디코드한 바이트에 그대로 HMAC을 계산하고 다시 직렬화하지 않는다. 그래서 PHP 기본 `json_encode`(한글 `\uXXXX`)로 만든 토큰도 통과한다(§2.5 V7).
- 다만 handoff·교차 벡터의 바이트 일치를 위해 **권장값을 `JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES`, 키 순서 `mb_id, nick, ch_name, level, exp`로 고정한다**(§2.5 V1과 같은 바이트).

검증 순서와 실패 코드(R-AUTH-002, auth.md §2.2):

| 단계 | 검사 | 실패 |
|---|---|---|
| 1 | 길이 1~4096, `.` 정확히 1개, 두 조각 모두 비어 있지 않음 | `401 TOKEN_INVALID` |
| 2 | base64url 알파벳·정규 인코딩, seg2 디코드 길이 32 | `401 TOKEN_INVALID` |
| 3 | **서명**: Web Crypto HMAC-SHA256 계산 후 상수시간 비교(`timingSafeEqual`) | `401 TOKEN_INVALID` |
| 4 | UTF-8(fatal) → `JSON.parse` → payload 스키마(위 표). 서명 전에는 JSON을 해석하지 않는다 | `401 TOKEN_INVALID` |
| 5 | **만료**: `nowMs < exp × 1000`일 때만 유효(같으면 만료). 시계 여유 없음 | `401 TOKEN_INVALID` |
| 6 | **등급**: `level >= TOKEN_MIN_LEVEL`(기본 5, `wrangler.toml [vars]`) | `403 LEVEL_TOO_LOW` |

- 응답 문구는 실패 단계와 무관하게 코드별 기본 문구 하나다(§3.2). 어느 단계에서 실패했는지 응답에 싣지 않는다.
- 만료가 등급보다 먼저다. 만료된 저등급 토큰은 `TOKEN_INVALID`다.
- 통과하면 서버는 `Principal { mbId, nick, chName, level, displayName }`을 만든다. `displayName = chName ?? nick`(R-AUTH-004)이고 유저 메시지의 `authorName`이 된다. `mbId`는 저장만 하고 응답에 내지 않는다(§4.3, db.md D-DB-5).

### 2.4 화면 보관·전환 (S2 확정 — R-API-003 🔒 · R-CHAT-009 🔒 · R-CHAT-011)

| 항목 | 규칙 |
|---|---|
| 읽는 시점·곳 | `main.tsx`가 렌더 전에 한 번, `ui/src/state/token.ts`의 함수로 `location.search`의 `t`를 읽는다. 값이 없거나 trim 후 빈 문자열이면 "토큰 없음" |
| 보관 | `ui/src/state/token.ts`의 **메모리(클로저)만**. `localStorage`·`sessionStorage`·쿠키·IndexedDB 저장 금지 |
| URL | 고치지 않는다(R-CHAT-009 "제거하지 않아도 된다"). `?t=`는 서버가 읽지 않고 로그에 남기지 않는다(§4.4) |
| 해석 | 화면은 토큰을 디코드·검사하지 않는다. 만료·등급 판단은 서버 응답 코드로만 한다 |
| 헤더 부착 | `main.tsx`가 렌더 전에 `configureClient({ getToken })`를 **한 번** 부른다. `getToken`은 `token.ts`가 제공한다. `client.ts`는 쓰기 요청 때마다 getter를 불러 헤더만 만들고 토큰을 보관하지 않는다 |
| 쓰기 가능 | `viewer.canWrite = 토큰 있음`. `false`이면 쓰기 UI를 렌더하지 않는다(R-CHAT-008, R-ROOMS-002, R-CHAT-004) |
| 읽기 전용 전환 | 쓰기 래퍼 결과가 `isAuthFailure(error)`(= `TOKEN_REQUIRED` · `TOKEN_INVALID` · `LEVEL_TOO_LOW`)이면 화면 state가 토큰을 버리고 `canWrite = false`로 바꾼다. 쓰기 UI가 언마운트되고 읽기 전용 안내가 뜬다(R-CHAT-011). 되돌리기는 새로 고침뿐이다(갠홈이 새 토큰을 발급) |
| `RATE_LIMITED` | 전환하지 않는다. "잠시 후" 안내만 한다. `error.retryAfterSec`가 있으면 화면이 쓸 수 있다(§3.4) |
| `LLM_BUDGET_EXCEEDED` (S3b) | 전환하지 않는다. 이번 달 한도 안내만 한다. 래퍼는 이 코드에 `retryAfterSec`를 싣지 않는다(§3.4 429 구분) |
| `OWNER_ONLY` (S3c, v0.5) | 전환하지 않는다. 주인 판정은 쓰기 권한과 별개다. `isAuthFailure`의 3코드에 넣지 않는다(§2.7 · R-SET-010) |
| 주인 판정 탐침 결과 (S3c) | E15 판정 호출의 결과로는 **어떤 코드든 전환하지 않는다**(401·`LEVEL_TOO_LOW` 포함, R-SET-010). 전환은 지금처럼 실제 쓰기 실패가 결정한다. 설정 화면 안 저장 실패의 인증 코드는 위 「읽기 전용 전환」 행을 따르되 초안을 보존한다(R-SET-011, ui 설계 몫) |
| 그 밖의 에러 | 전환하지 않는다(`VALIDATION_ERROR`·`NOT_FOUND`·`NETWORK`·`INTERNAL` 등) |
| 노출 금지 | 토큰을 `console`·화면·에러 문구·저장소에 남기지 않는다(R-AUTH-006) |

- `TOKEN_REQUIRED`를 전환 목록에 넣은 이유: 쓰기 UI가 보이는데 서버가 "토큰 없음"이라고 답하면 화면 판단이 틀린 것이다. 읽기 전용으로 닫는 쪽이 안전하다. R-CHAT-011은 `TOKEN_INVALID`·`LEVEL_TOO_LOW`를 적었고, 이 줄은 같은 규칙을 세 번째 인증 코드에 넓힌 계약 결정이다(auth.md D-AUTH-6 "화면은 두 코드 모두 읽기 전용 전환"과 같은 취지).
- 계약이 정하는 것은 위 규칙과 `ClientConfig.getToken` 타입(§11.6), `isAuthFailure` 판정이다. `token.ts`의 함수 이름·강등 방식·`viewer` 계산 위치는 ui 설계가 정한다.

### 2.5 교차 테스트 벡터 V1~V8 (R-AUTH-001 · R-TOKEN-001 — server auth.md §2.6 전사)

server 테스트(SRV-T-100~109), contract 라우트 테스트(§14.5 — 토큰은 `signTestToken`으로 만든다), S5 handoff(`token-snippet.php.md` 자가 점검)가 **같이 쓰는 단일 벡터**다. 아래는 auth.md §2.6을 그대로 옮긴 것이다. 값이 다르면 auth.md가 정본이고 이 절을 고친다.

**테스트 전용 SECRET**: `london-dispatch-test-secret-v1` — 운영 SECRET이 아니다. 운영 값은 문서·코드에 남기지 않는다.
공통: `minLevel = 5`, 기준 시각 `nowMs = 1767225600000`(2026-01-01T00:00:00Z), `exp = 1767268800`(기준 + 12h). JSON은 키 순서 `mb_id, nick, ch_name, level, exp`, `level`·`exp`는 정수, 한글은 UTF-8 그대로(`JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES`와 같은 바이트).

| ID | payload JSON(바이트 수) | 기대 |
|---|---|---|
| V1 | `{"mb_id":"tester01","nick":"테스터","ch_name":"시엘 팬텀하이브","level":5,"exp":1767268800}` (101) | ok. `{ mbId: 'tester01', nick: '테스터', chName: '시엘 팬텀하이브', level: 5, displayName: '시엘 팬텀하이브' }` |
| V2 | `{"mb_id":"tester02","nick":"닉네임","ch_name":"","level":10,"exp":1767268800}` (80) | ok. `chName: null`, `displayName: '닉네임'`, `level: 10` |
| V3 | `{"mb_id":"tester03","nick":"하급","ch_name":"","level":4,"exp":1767268800}` (76) | `LEVEL_TOO_LOW` / `level` |
| V4 | `{"mb_id":"ascii_only","nick":"Tester","ch_name":"Ciel","level":5,"exp":1767268800}` (82) | ok. `displayName: 'Ciel'` |
| V5 | V1의 seg2 **첫 글자** `E`→`F` | `TOKEN_INVALID` / `signature` |
| V5b | V1의 seg2 **마지막 글자** `4`→`5`(패딩 비트만 다름 — 디코드 바이트는 같다) | `TOKEN_INVALID` / `format`(비정규 인코딩) |
| V6 | V1 payload를 SECRET `wrong-secret`으로 서명 | `TOKEN_INVALID` / `signature` |
| V7 | V1과 같은 값, PHP 기본 `json_encode`(한글 `\uXXXX` 이스케이프, 131바이트) | ok. Principal은 V1과 같다 |
| V8 | V1을 `nowMs = 1767268800000`(= exp × 1000)에 검증 | `TOKEN_INVALID` / `expired`. `1767268799999`이면 ok |

토큰 전문(테스트 SECRET 기준, Node `crypto.createHmac`으로 산출):

```text
V1  eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Iu2FjOyKpO2EsCIsImNoX25hbWUiOiLsi5zsl5gg7Yys7YWA7ZWY7J2067iMIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.EWYxcZixnZzWnIjEmFZFc1-_DrqQ8gfOQEOFm3xzMu4
V2  eyJtYl9pZCI6InRlc3RlcjAyIiwibmljayI6IuuLieuEpOyehCIsImNoX25hbWUiOiIiLCJsZXZlbCI6MTAsImV4cCI6MTc2NzI2ODgwMH0.jWSaBGh1d4nF9M5kKORFq2V2sss6O2YWTGvAGi4C15s
V3  eyJtYl9pZCI6InRlc3RlcjAzIiwibmljayI6Iu2VmOq4iSIsImNoX25hbWUiOiIiLCJsZXZlbCI6NCwiZXhwIjoxNzY3MjY4ODAwfQ.X3DOlOqHWy4fJbzpuYxO1TKYegyRQj2Q9udNSsagvXI
V4  eyJtYl9pZCI6ImFzY2lpX29ubHkiLCJuaWNrIjoiVGVzdGVyIiwiY2hfbmFtZSI6IkNpZWwiLCJsZXZlbCI6NSwiZXhwIjoxNzY3MjY4ODAwfQ.bZ5o0FN-_veyz6bFb6gbVejYdIpqhkehp2XuzudLahI
V6  eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Iu2FjOyKpO2EsCIsImNoX25hbWUiOiLsi5zsl5gg7Yys7YWA7ZWY7J2067iMIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.3xEoW7yPl5OjkrJJqXh6huMbZ4p1Lzk55AVgoBtyWX8
V7  eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Ilx1ZDE0Y1x1YzJhNFx1ZDEzMCIsImNoX25hbWUiOiJcdWMyZGNcdWM1ZDggXHVkMzJjXHVkMTQwXHVkNTU4XHVjNzc0XHViZTBjIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.Ppc6_c3yRi28H05QHEZ_gvQMF-neidGMOwQ3a6ukWKs
```

- 테스트 SECRET은 운영 값이 아니다. 운영 SECRET은 문서·코드에 남기지 않는다(R-NFR-004, S5 `secret-handover.md`).
- R-TOKEN-001 수용 기준: S5 PHP 조각을 테스트 SECRET·V1 입력으로 돌려 V1 토큰 문자열이 바이트 단위로 같으면 충족이다. 기본 플래그를 쓴 PHP라면 V7과 같아야 한다(서버는 둘 다 통과).

### 2.6 handoff 참조 (S5에서 작성)

- `doc/handoff/token-snippet.php.md`는 **이 절(§2.2·§2.3·§2.5)을 따른다.** 붙일 위치는 `theme/victorian/inc/rosebell-chatbot.php`, iframe src는 `$rb_chatbot_embed_url . '?t=' . $token`이다(R-TOKEN-001).
- PHP 조각이 지킬 것: 로그인 회원이고 `$member['mb_level'] >= LEVEL`일 때만 발급, `level`은 `(int)` 캐스트, `exp = time() + 43200`, `ch_name` 키는 값이 없어도 `''`로 넣는다, 권장 플래그 `JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES`, base64url 무패딩, 비회원·저등급이면 `?t=` 없이 임베드 주소만.
- 이 절의 형식·payload 필드·`?t=` 이름을 바꾸면 저쪽 PHP 재적용이 필요한 **파괴 변경**이다(§8·§13).

### 2.7 설정 엔드포인트 예외·주인 판정 (S3c 확정 — R-AUTH-003 🔒 개정 · R-SET-001 🔒 · R-SET-004 🔒 · R-SET-010)

설정 화면은 집 열쇠 보관함이다. 출입증(토큰)이 있어야 문 앞까지 가고, 집주인 명단에 이름이 있어야 보관함이 열린다. 명단은 서버만 갖고 있고 출입증 모양은 그대로다.

| 항목 | 규칙 |
|---|---|
| 대상 | E15 `GET /api/settings/characters` · E16 `PUT /api/settings/characters`(§4.0). 이 밖의 엔드포인트는 주인 판정을 하지 않는다 |
| 토큰 | 두 엔드포인트 모두 **필수**. E15는 읽기지만 토큰이 필요하다(R-AUTH-003 예외, §2.1). 받는 곳은 §2.2와 같다(Bearer 헤더만, `?t=` 무시) |
| 주인 정의 | `requireToken`을 통과한 principal의 `mbId`가 서버 설정 `OWNER_MB_IDS` 목록에 있을 때만 주인이다(R-SET-001). 목록에는 **지인(갠홈 주인) 회원 ID만** 둔다. 사용자 본인 ID는 넣지 않는다(2026-10-06 사용자 결정). 목록이 비면 모두 주인이 아니다(닫힌 쪽 실패) |
| 목록 위치 | `OWNER_MB_IDS` 한 키. 파싱·형식 규칙과 위치(Secrets 또는 `[vars]`)는 server env.md가 정한다. 형식 위반이면 모든 경로가 `500 CONFIG_INVALID`다(R-ENV-003). **이 문서와 handoff에는 실제 회원 ID를 쓰지 않는다** |
| 미들웨어 순서 | E15: `requireToken → requireOwner → 핸들러`. E16: `requireToken → requireOwner → rateLimitWrites → 본문 상한 → validate('json') → 핸들러`. 라우트 단위로 붙인다(전역 금지, §2.2) |
| 순서의 결과 | 등급 미달이면 주인이어도 `403 LEVEL_TOO_LOW`다(토큰 검증이 먼저). 주인이 아니면 `403 OWNER_ONLY`이고 레이트리밋을 세지 않는다(`rateLimitWrites`보다 앞) |
| 실패 응답 | `403 OWNER_ONLY` + 기본 문구만. 주인 목록·판정 이유·요청자 `mbId`를 싣지 않는다 |
| 화면이 아는 방법 | 화면은 토큰을 해석하지 않는다(§2.4). 주인 여부는 **E15 응답 status로만** 안다 — `200`이면 주인, 그 밖(`403 OWNER_ONLY`·401·`403 LEVEL_TOO_LOW`·`NETWORK`·`500`)은 주인 아님으로 본다(R-SET-010). 주인 여부를 알려 주는 별도 엔드포인트(`/api/me` 등)는 없다(R-API-001) |
| 판정 시점 | 토큰이 있을 때 App이 첫 렌더 뒤 1회 E15를 부른다. 판정 응답 본문은 버리고 설정 화면은 열 때 다시 읽는다(ui 설계 몫) |
| 읽기 전용 전환 | `OWNER_ONLY`는 `isAuthFailure` 3코드에 넣지 않는다. 판정 탐침 결과로는 어떤 코드든 전환하지 않는다(§2.4 S3c 행, R-SET-010) |
| 토큰 형식·handoff | **변경 없음.** payload·서명·`?t=`·PHP 조각이 그대로라 저쪽 재적용이 없다(R-AUTH-001 개정 없음) |

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
| `error`의 키 (S2) | 정확히 `code`·`message` 둘이다. **예외는 429 두 코드**(v0.4.1): `RATE_LIMITED`(다음 분 창까지 남은 초, R-AUTH-005)와 `LLM_BUDGET_EXCEEDED`(다음 달 1일 00:00 KST까지 남은 초, R-LLM-007)에는 `retryAfterSec`(정수 ≥ 1)가 더 붙고, 같은 값이 응답 헤더 `Retry-After`에도 실린다(server index.md §5.1). 그 밖의 코드에는 붙지 않는다 |
| 성공 본문 없음 (S2) | `DELETE` 두 개(E6·E11)는 `204 No Content`로 답하고 본문·`Content-Type`이 없다. 나머지 성공 응답은 전부 JSON 본문이 있다 |

```json
{ "error": { "code": "RATE_LIMITED", "message": "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", "retryAfterSec": 40 } }
```

```json
{ "error": { "code": "LLM_BUDGET_EXCEEDED", "message": "이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.", "retryAfterSec": 2196000 } }
```

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "불러올 개수(limit)는 1~100 사이의 정수여야 합니다." } }
```

- 서버는 상황별 문구를 쓸 수 있다(예: `NOT_FOUND` → `방을 찾을 수 없습니다.`). `ERROR_MESSAGES`는 상황 문구가 없을 때 쓰는 **기본 문구**이자 화면의 폴백이다.
- 화면에 보일 문구는 화면의 `labels.ts`가 `code`로 정한다(R-CHAT-011, ts-rules 에러 처리). 서버 `message`는 참고값이다.
- (v0.4.1) **모르는 코드를 받은 옛 화면.** 14종째 코드를 모르는 화면 번들은 `LLM_BUDGET_EXCEEDED`를 §3.4 "모르는 코드" 행대로 `INTERNAL`(`ERROR_MESSAGES.INTERNAL`)로 정규화한다. 깨지거나 reject하지 않는다. 화면 번들은 같은 Worker의 Static Assets(`/embed`)로 서버와 함께 배포되므로, 이 상황은 배포 직전에 열어 둔 iframe에서만 생기고 새로 고치면 사라진다.

- (v0.5) 15종째 `OWNER_ONLY`도 같다. 다만 옛 화면 번들에는 설정 화면·E15 호출이 없어 이 코드를 받을 경로가 없다. 받더라도 §3.4대로 `INTERNAL`로 정규화된다.

### 3.2 에러 코드 15종 (R-API-002 🔒, 2026-10-06 개정 13→14→15 — `shared/src/errors.ts`가 정본, 이 표는 전사)

| 코드 | status | 기본 message | 발생 조건 | 내는 곳 | 처음 쓰는 묶음 |
|---|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 요청 형식이 올바르지 않습니다. | 경로·쿼리·본문 스키마 위반, 범위·정수 위반, 본문 JSON 파싱 실패 | routes `validate` · 서비스 · onError(HTTPException 400) | S1 |
| `TOKEN_REQUIRED` | 401 | 로그인한 회원만 사용할 수 있습니다. | 쓰기 요청에 토큰 없음(R-AUTH-003) | auth 미들웨어 | S2 |
| `TOKEN_INVALID` | 401 | 인증 정보가 올바르지 않거나 만료되었습니다. 페이지를 새로 고쳐 주세요. | 형식·서명·만료 실패(R-AUTH-002) | auth 미들웨어 | S2 |
| `LEVEL_TOO_LOW` | 403 | 대화에 참여할 수 있는 회원 등급이 아닙니다. | `level < TOKEN_MIN_LEVEL`(R-AUTH-002) | auth 미들웨어 | S2 |
| `RATE_LIMITED` | 429 | 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요. | `mb_id` 분당 쓰기 초과(R-AUTH-005) | 레이트리밋 미들웨어 | S2 |
| `NOT_FOUND` | 404 | 요청한 대상을 찾을 수 없습니다. | 없는 방·메시지, 매칭 없는 경로·메서드, `/embed` 파일 없음 | 서비스 · notFound · `/embed` | S1 |
| `SPEAK_IN_PROGRESS` | 409 | 이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요. | 방 생성 잠금 선점 실패 — 같은 방 speak·regenerate 진행 중(R-MSG-007) | messages.speak · regenerate | S3(v0.4 확정) |
| `NOT_LAST_MESSAGE` | 409 | 방의 마지막 메시지만 다시 생성할 수 있습니다. | 재작성 대상이 마지막 메시지가 아님 — 잠금을 잡은 뒤 판정(R-MSG-006) | messages.regenerate | S3(v0.4 확정) |
| `NOT_CHARACTER_MESSAGE` | 400 | 캐릭터 메시지만 다시 생성할 수 있습니다. | 재작성 대상이 유저 메시지(R-MSG-006) | messages.regenerate | S3(v0.4 확정) |
| `LLM_FAILED` | 502 | AI 응답을 받지 못했습니다. 다시 시도해 주세요. | 제공사 호출 최종 실패 — 네트워크·타임아웃·5xx는 1회 재시도 뒤, 429·그 밖 4xx·응답 형식 오류는 즉시, 재시도 예산 부족(R-LLM-005) | llm → messages가 그대로 전파 | S3(v0.4 확정) |
| `LLM_EMPTY` | 502 | AI 응답이 비어 있습니다. 다시 시도해 주세요. | 후처리 결과가 빈 문자열(R-LLM-004), 또는 제공사가 차단·후보 없음으로 답함(llm.md D-LLM-6) | llm → messages가 그대로 전파 | S3(v0.4 확정) |
| `LLM_BUDGET_EXCEEDED` | 429 | 이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요. | 이번 달(KST, 월 키 `YYYY-MM`) 추정 AI 비용 누적 ≥ `LLM_MONTHLY_BUDGET_KRW`(기본 100000원). speak·regenerate에서 **잠금 선점·제공사 호출 전**에 판정. 본문 `retryAfterSec` + 헤더 `Retry-After`(§3.1)(R-LLM-007) | llm `usage.ts`(`Llm.ensureBudget`) → messages가 그대로 전파 | S3b(v0.4.1 확정) |
| `CONFIG_INVALID` | 500 | 서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요. | `parseEnv` 실패(모든 경로, `/embed`·health 포함). `LLM_API_KEY` 누락(speak·regenerate만)(R-ENV-003) | env · 부트스트랩 | S1 |
| `OWNER_ONLY` | 403 | 캐릭터 설정은 갠홈 주인만 열 수 있습니다. | 유효 토큰(등급 통과)이지만 `mbId ∉ OWNER_MB_IDS`, 또는 목록이 비어 있음. 설정 엔드포인트(E15·E16)에서만(R-SET-001) | auth `requireOwner` | S3c(v0.5 확정) |
| `INTERNAL` | 500 | 서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. | 그 밖의 예상 못 한 오류(D1 장애 등) | onError | S1 |

- (v0.5) 15종째 `OWNER_ONLY`는 R-API-002 개정(2026-10-06 사용자 승인, R-SET-001)으로 더했다. 순서는 요구 나열대로 `CONFIG_INVALID` 다음·`INTERNAL` 앞이다. 서버는 기본 문구만 보낸다(판정 이유·목록을 드러내지 않음). `LEVEL_TOO_LOW`를 재사용하지 않는 이유: 그 코드는 화면 공통 규칙에서 "쓰기 권한 상실 → 읽기 전용 전환"이라, 주인이 아닌 등급 회원이 판정 한 번에 쓰기 UI를 잃게 된다. **`ui/src/api/client.ts`의 `AUTH_FAILURE_CODES`에 넣지 않는다** — 넣으면 주인 판정 탐침(R-SET-010)이 모든 등급 회원을 읽기 전용으로 떨어뜨린다. 14종의 status·문구는 바뀌지 않았다.
- 13종은 S1에 한 번에 확정한다. S2~S4의 기본 문구는 착수 시 다듬을 수 있다(문구 변경 = 비파괴).
- (v0.4.1) 14종째 `LLM_BUDGET_EXCEEDED`는 R-API-002 개정(2026-10-06 사용자 승인, R-LLM-007)으로 더했다. 문구는 요구 원문 그대로이고 서버는 상황 문구 없이 기본 문구만 보낸다(llm.md §12.10). 내는 엔드포인트는 E9·E12뿐이다. 읽기·방 쓰기·유저 발화·수정·삭제는 이 코드를 내지 않는다. 13종의 status·문구는 바뀌지 않았다.
- (v0.4) S3 5코드의 문구는 v0.1 기본 문구를 **그대로 확정**한다. 다섯 문구 모두 화면이 그대로 띄울 수 있는 한 문장이고 제공사 이름·HTTP 상태·차단 사유·키 이름이 없다(R-LLM-005). 서버는 이 다섯 코드에 상황 문구를 쓰지 않고 기본 문구만 보낸다(llm.md §5, messages.md §5).
- `CONFIG_INVALID`·`INTERNAL`·`VALIDATION_ERROR` 기본 문구는 server env.md §5와 index.md §5.1의 문구와 같다.

### 3.3 클라이언트 전용 코드 `NETWORK`

- 서버가 내지 않으므로 `ErrorCode`에 넣지 않는다. `ui/src/api/client.ts`의 `ApiErrorCode = ErrorCode | 'NETWORK'`에만 있다.
- 문구: `서버에 연결할 수 없습니다.`(ts-rules 에러 처리와 같다).

### 3.4 화면 쪽 정규화 규칙 (`ui/src/api/client.ts`)

| 상황 | `Result` |
|---|---|
| 2xx + JSON 본문 | `{ ok: true, value: 본문 }` |
| `204`(S2, 본문 없음) | `{ ok: true, value: undefined }` — 본문을 읽지 않는다. `DELETE` 래퍼만 `Result<void>`로 받는다 |
| 2xx(204 제외) + 본문이 JSON이 아님 | `{ ok: false, error: { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL } }` |
| 4xx·5xx + 계약 형식 본문(`code`가 15종(v0.5), `message`가 빈 문자열이 아님) | `{ ok: false, error: { code, message } }`(본문 값 그대로) |
| (S2) 위 경우 + `code === 'RATE_LIMITED'` + `retryAfterSec`가 1 이상 정수 | `error`에 `retryAfterSec`를 함께 싣는다. 값이 없거나 형식이 틀리면 키를 빼고, 다른 코드에 붙어 오면 버린다. (v0.4.1) `LLM_BUDGET_EXCEEDED`에 붙어 온 값도 **버린다**(아래 429 구분). `Retry-After` 헤더는 읽지 않는다(본문이 단일 소스) |
| 4xx·5xx + `code`는 15종인데 `message`가 없거나 비어 있음 | `{ code, message: ERROR_MESSAGES[code] }` |
| 4xx·5xx + 계약 형식이 아님(HTML 오류 페이지, 모르는 코드) | `{ code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL }`. (v0.5) `OWNER_ONLY`를 모르는 옛 번들도 이 행으로 `INTERNAL`이 된다 |
| `fetch` 자체 실패(오프라인·DNS·연결 거부) | `{ code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }` |

- 래퍼는 **어떤 경우에도 throw·reject하지 않는다.** 화면은 `result.ok` 분기만 쓰고 `try/catch`를 쓰지 않는다.
- (v0.4) **요청 타임아웃은 없다.** `request`는 `AbortSignal`·타이머를 쓰지 않고 응답이 올 때까지 기다린다. speak·regenerate는 서버가 70초 안에 성공·실패로 끝내므로(R-NFR-001) 화면은 서버 종결에 의존한다. 나중에 타임아웃을 넣으면 두 호출은 **75초 이상**이어야 한다(§4.12).

429 두 종류 구분 (v0.4.1 — R-CHAT-011 · R-LLM-007):

| 코드 | 뜻 | 서버 본문 `retryAfterSec` | ui/api `ApiError.retryAfterSec` | 화면 처리 |
|---|---|---|---|---|
| `RATE_LIMITED` | 이 회원(`mb_id`)이 1분에 너무 많이 썼다 | 1~60초 | 싣는다 | "잠시 후" 안내. 자동 재시도 없음(§6.1) |
| `LLM_BUDGET_EXCEEDED` | 서버 전체가 이번 달 AI 비용 한도에 닿았다 | 1초~최대 2678400초(31일) | **싣지 않는다** | 실패 말풍선 + 한도 문구. 「재시도」를 눌러도 다음 달 전에는 같은 429다. **카운트다운·자동 재시도 금지** |

- 둘은 status가 같으므로 **`code`로 구분한다.** status 429만 보고 분기하면 결함이다.
- 래퍼가 `LLM_BUDGET_EXCEEDED`의 `retryAfterSec`를 버리는 이유: 화면에서 이 값을 쓸 곳은 카운트다운·자동 재시도뿐인데 둘 다 금지다. 래퍼에서 버리면 화면이 잘못 쓸 수 없다. 해제 날짜 안내가 요구되면 ui 요구로 올리고 `toRetryAfter` 허용 코드를 넓힌다(선택 필드라 비파괴).
- `isAuthFailure`는 두 코드 모두 `false`다. 읽기 전용 전환 대상이 아니다.

### 3.5 에러 변환 위치

- 라우트와 서비스는 `AppError`를 throw만 한다. 응답 본문은 server 진입점의 `onError` 한 곳이 `{ error: { code, message } }`로 만든다(index.md §5.1).
- zod 검증 실패는 라우트의 `validate` 훅이 `AppError('VALIDATION_ERROR', 400, ERROR_MESSAGES.VALIDATION_ERROR)`를 throw한다(§11.2). zod-validator 기본 실패 응답은 계약 형식이 아니라서 쓰지 않는다.
- 매칭 없는 경로와 메서드는 `notFound`가 `404 NOT_FOUND`(`요청한 주소를 찾을 수 없습니다.`)로 닫는다. S1 시점에 `POST /api/rooms` 같은 미구현 쓰기 경로도 이 응답이다.
- (S2) `GET /api/rooms/:id`·`PUT /api/rooms/:id`·`GET /api/messages/:id`처럼 경로는 있으나 메서드가 등록되지 않은 요청도 `404 NOT_FOUND`다(405를 쓰지 않는다). S4 경로(memory)는 그 묶음 전까지 이 응답이다. (v0.4) S3 경로도 구현 전까지는 `404`이고, 구현 뒤에도 `GET`·`PUT /api/rooms/:id/speak`, `GET /api/messages/:id/regenerate`처럼 POST가 아닌 메서드는 `404`다.
- (S2) `RATE_LIMITED`의 `retryAfterSec`·`Retry-After`도 `onError`가 `AppError`의 선택 필드에서 옮긴다. 라우트·미들웨어는 헤더를 만들지 않는다(server index.md D-IDX-11). (v0.4.1) `LLM_BUDGET_EXCEEDED`도 같은 경로다 — 서비스가 `new AppError('LLM_BUDGET_EXCEEDED', undefined, { retryAfterSec })`를 throw하고 `onError`가 옮긴다. `onError`는 코드 종류를 보지 않으므로 server 진입점 코드는 바뀌지 않는다(index.md §2.4 S3b · SRV-T-233).
- (S2) 본문 JSON이 깨졌으면 Hono가 `HTTPException(400)`을 던지고 `onError`가 `400 VALIDATION_ERROR`(기본 문구)로 바꾼다. `Content-Type`이 JSON이 아니면 본문을 `{}`로 보고 zod가 실패해 같은 `400`이 나간다(hono 4.13 validator 동작).

---

## 4. 엔드포인트별 명세

### 4.0 전체 엔드포인트 (R-API-001 🔒 — 이 밖의 엔드포인트는 만들지 않는다)

| # | 메서드·경로 | 토큰 | 역할 | 묶음 | 상태 | 요구ID | 상세 |
|---|---|---|---|---|---|---|---|
| E1 | `GET /embed` · `GET /embed?t=` | ✕ | 화면(정적 파일) | S1 | **확정** | R-API-006 · R-API-001 | §4.4 · §7 |
| E2 | `GET /api/health` | ✕ | 상태 | S1 | **확정** | R-API-005 | §4.1 |
| E3 | `GET /api/rooms` | ✕ | 방 목록 | S1 | **확정** | R-ROOM-001 | §4.2 |
| E4 | `POST /api/rooms` | ○ | 방 생성 | S2 | **확정** | R-ROOM-002 | §4.6 |
| E5 | `PATCH /api/rooms/:id` | ○ | 방 이름 변경 | S2 | **확정** | R-ROOM-003 | §4.7 |
| E6 | `DELETE /api/rooms/:id` | ○ | 방 삭제 | S2 | **확정** | R-ROOM-004 | §4.8 |
| E7 | `GET /api/rooms/:id/messages?before&limit` | ✕ | 히스토리 한 페이지 | S1 | **확정** | R-MSG-001 | §4.3 |
| E8 | `POST /api/rooms/:id/user` | ○ | 유저 발화·지시 저장(AI 호출 없음) | S2 | **확정** | R-MSG-002 | §4.9 |
| E9 | `POST /api/rooms/:id/speak` | ○ | 해당 캐릭터 1턴 생성 | S3 | **확정**(구현 전) | R-MSG-003 · R-MSG-007 | §4.12 · §4.13 |
| E10 | `PATCH /api/messages/:id` | ○ | 메시지 수정 | S2 | **확정** | R-MSG-004 · R-MSG-008 | §4.10 |
| E11 | `DELETE /api/messages/:id` | ○ | 메시지 삭제 | S2 | **확정** | R-MSG-005 · R-MSG-008 | §4.11 |
| E12 | `POST /api/messages/:id/regenerate` | ○ | 같은 캐릭터로 재생성 | S3 | **확정**(구현 전) | R-MSG-006 · R-MSG-007 | §4.12 · §4.14 |
| E13 | `GET /api/rooms/:id/memory` | ○ | 장기기억 보기 | S4 | S4 상세 예정 | R-MEM-001 | — |
| E14 | `PUT /api/rooms/:id/memory` | ○ | 장기기억 편집 | S4 | S4 상세 예정 | R-MEM-001 | — |
| E15 | `GET /api/settings/characters` | ○ + 주인 | 캐릭터 설정 읽기(주인 판정 탐침 겸용) | S3c | **확정**(구현 전) | R-SET-004 · R-SET-001 · R-AUTH-003 | §2.7 · §4.15 |
| E16 | `PUT /api/settings/characters` | ○ + 주인 | 캐릭터 설정 전체 교체 저장 | S3c | **확정**(구현 전) | R-SET-005 · R-SET-001 · R-SET-002 | §2.7 · §4.16 |

- (v0.5) 엔드포인트는 **16개**다(R-API-001 2026-10-06 개정). E15·E16은 경로 하나를 두 메서드가 쓴다(`PATHS.characterSettings`). 내보내기·가져오기·시드 복원·주인 여부 조회 엔드포인트는 없다 — 내보내기·가져오기는 화면이 E15 응답과 E16 요청으로 처리한다(§16).

- **방 단건 조회(`GET /api/rooms/:id`)는 없다.** 대화 화면 상단 바의 방 제목·생성일(R-CHAT-001)은 `listRooms()` 결과에서 찾는다. 마지막 본 방 복원(R-ROOMS-004)도 `listRooms()`를 먼저 부른 뒤 id로 찾는다.
- S4 행(E13·E14)의 요청·응답 필드는 S4에서 정한다. 이 문서는 아직 추측하지 않는다. (v0.4) S3 행(E9·E12)은 확정했다.
- 같은 경로 패턴을 여러 메서드가 쓴다: `PATHS.rooms`(GET E3 · POST E4), `PATHS.room`(PATCH E5 · DELETE E6), `PATHS.message`(PATCH E10 · DELETE E11). (v0.4) E9·E12는 경로마다 메서드가 하나다(`PATHS.roomSpeak` POST · `PATHS.messageRegenerate` POST).

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

### 4.5 쓰기 공통 규칙 (S2 — E4 · E5 · E6 · E8 · E10 · E11)

| 항목 | 값 |
|---|---|
| 토큰 | ○ — `Authorization: Bearer <t>`(§2.2) |
| 처리 순서 | 부트스트랩(server) → `requireToken` → `rateLimitWrites` → `validate('param')` → `validate('json')` → 핸들러 → 서비스 |
| 요청 본문 | `Content-Type: application/json`인 JSON 객체. 모르는 키는 버린다. zod는 **타입만** 본다. trim·길이(코드 포인트)·범위 판정은 서비스가 단일 소스다(rooms.md §9, messages.md §9, D-MSG-4) |
| 방 id(`:id`, E5·E6·E8) | 문자열 그대로(`roomIdParam`, §4.3과 같다). 형식 검사 없이 없으면 `404` |
| 메시지 id(`:id`, E10·E11) | 10진 숫자로만 된 문자열이면 `Number()`로, 아니면 `NaN`으로 바꿔 서비스에 넘긴다(`messageIdParam`). 서비스가 1 이상 안전 정수가 아니면 DB 전에 `404`로 닫는다. 그래서 `abc`·`1.5`·`0x10`·`1e1`·`0`은 전부 `404`다 |
| 레이트리밋 | 요청 1건 = 1회 소모(§6). 인증을 통과한 뒤 세므로 `400`·`404`로 끝난 요청도 센다. `401`·`403`은 세지 않는다 |
| 성공 응답 | 생성(E4·E8) `201` + 만든 자원 · 변경(E5·E10) `200` + 바뀐 자원 · 삭제(E6·E11) `204` 본문 없음 |
| 응답 필드 | §5.1 규칙. `Message`에 `authorMbId`는 쓰기 응답에도 없다 |
| 권한 | 등급 통과자 **누구나**. 작성자·방 생성자 검사 없음(R-ROOM-003·004 · R-MSG-008, 확정사항 §9-5 기본값) |

공통 에러(엔드포인트별 표에는 이 표 밖의 것만 적는다):

| 코드 | status | message | 조건 | 판정 위치 |
|---|---|---|---|---|
| `CONFIG_INVALID` | 500 | 기본 문구 | 설정 오류(가장 먼저) | server 부트스트랩 |
| `TOKEN_REQUIRED` | 401 | 기본 문구 | Bearer 토큰을 꺼낼 수 없음(§2.2) | `requireToken` |
| `TOKEN_INVALID` | 401 | 기본 문구 | 형식·서명·payload·만료 실패(§2.3) | `requireToken` |
| `LEVEL_TOO_LOW` | 403 | 기본 문구 | `level < TOKEN_MIN_LEVEL` | `requireToken` |
| `RATE_LIMITED` | 429 | 기본 문구 + `retryAfterSec` + `Retry-After` 헤더 | `mb_id` 분 창 한도 초과(§6) | `rateLimitWrites` |
| `VALIDATION_ERROR` | 400 | `요청 형식이 올바르지 않습니다.` | 본문 JSON 깨짐 · `Content-Type`이 JSON 아님 · 필수 키 없음 · 타입 틀림 | `validate` · onError(HTTPException 400) |
| `INTERNAL` | 500 | 기본 문구 | D1 장애 등 | onError |

### 4.6 `POST /api/rooms` (E4) — 방 생성

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로·쿼리 | 없음 |
| 본문 | `CreateRoomBody` = `{ title: string }` |
| 성공 | `201` · `RoomSummary`. `title`은 trim한 값, `id`는 UUID v4, `createdAt === updatedAt ===` 서버 시각, `messageCount: 0` |
| 에러 | 공통(§4.5) + 아래 |
| 부수 효과 | `rooms` 1행. `updatedAt`이 최신이라 `GET /api/rooms` 맨 위에 온다 |
| 레이트리밋 | 1회 |
| server | `c.get('services').rooms.createRoom(input: RoomTitleInput): Promise<RoomSummary>`(rooms.md §2) |
| 요구ID | R-ROOM-002 · R-ROOMS-002 · R-AUTH-003 · R-AUTH-005 |
| 테스트 | API-T-050 ~ 055 · 057 · 058 |

| 코드 | status | message | 조건 |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 방 제목은 1~60자로 입력해 주세요. | trim 후 코드 포인트 0자 또는 61자 이상(이모지 1개 = 1자) |

```json
{ "title": "  안개 낀 런던  " }
```

```json
{ "id": "6f1c2a0e-4b7d-4c1e-9a3f-2d5b8e7c1a90", "title": "안개 낀 런던", "createdAt": 1767225600000, "updatedAt": 1767225600000, "messageCount": 0 }
```

- 화면은 응답의 `id`로 바로 대화 화면으로 간다(R-ROOMS-002). 목록은 응답을 앞에 끼워 넣거나 다시 불러온다(ui 설계 몫).

### 4.7 `PATCH /api/rooms/:id` (E5) — 방 이름 변경

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로 | `id: string`(§4.5) |
| 본문 | `RenameRoomBody` = `{ title: string }` |
| 성공 | `200` · `RoomSummary`. `title`만 바뀐다. **`updatedAt`은 그대로**라 목록 순서가 바뀌지 않는다(R-ROOM-005 목록에 없음, rooms.md D-ROOM-4) |
| 에러 | 공통 + 아래 |
| 검사 순서 | 제목 규칙(DB 전) → 방 존재. 없는 방에 61자 제목을 보내면 `400`이다 |
| 부수 효과 | `rooms.title` 갱신 |
| 레이트리밋 | 1회 |
| 권한 | 등급 통과자 누구나(방을 만든 사람이 아니어도 된다) |
| server | `rooms.renameRoom(id: string, input: RoomTitleInput): Promise<RoomSummary>` |
| 요구ID | R-ROOM-003 · R-CHAT-001(⋯ 메뉴 이름 변경) |
| 테스트 | API-T-050 ~ 053 · 059 · 066 |

| 코드 | status | message | 조건 |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 방 제목은 1~60자로 입력해 주세요. | E4와 같다 |
| `NOT_FOUND` | 404 | 방을 찾을 수 없습니다. | 없는 방(삭제된 방 포함) |

```json
{ "title": "팬텀하이브 저택의 밤" }
```

```json
{ "id": "00000000-0000-4000-8000-000000000002", "title": "팬텀하이브 저택의 밤", "createdAt": 1767225600000, "updatedAt": 1767226800000, "messageCount": 2 }
```

### 4.8 `DELETE /api/rooms/:id` (E6) — 방 삭제

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로 | `id: string`(§4.5) |
| 본문 | 없음(보내도 읽지 않는다) |
| 성공 | `204` · 본문 없음 |
| 에러 | 공통 + `NOT_FOUND` 404 `방을 찾을 수 없습니다.`(없는 방, 이미 삭제한 방) |
| 부수 효과 | 그 방의 `memory`·`messages`·`rooms`를 한 batch로 **실삭제**(R-DB-003). 이후 `GET /api/rooms/:id/messages`는 `404`, 목록에서 빠진다 |
| 레이트리밋 | 1회 |
| 권한 | 등급 통과자 누구나 |
| 경합 | S3 speak 진행 중이어도 막지 않는다. speak 결과 저장은 `404`가 된다(rooms.md §11, S3 인계) |
| server | `rooms.deleteRoom(id: string): Promise<void>` |
| 요구ID | R-ROOM-004 · R-CHAT-001(⋯ 메뉴 방 삭제, confirm은 화면) |
| 테스트 | API-T-050 ~ 053 · 060 · 066 |

### 4.9 `POST /api/rooms/:id/user` (E8) — 유저 발화·지시 저장

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로 | `id: string`(방 id, §4.5) |
| 본문 | `UserMessageBody` = `{ text: string, ooc: boolean }`. **`ooc`는 필수**다(기본값 없음 — 화면의 OOC 토글 값을 항상 보낸다) |
| 성공 | `201` · `Message`. `speaker: 'user'`, `kind: ooc ? 'ooc' : 'line'`, `text`는 앞뒤 trim(중간 줄바꿈 유지), `authorName` = 토큰의 표시 이름(`ch_name`이 비어 있지 않으면 `ch_name`, 아니면 `nick` — R-AUTH-004), `createdAt` = 서버 시각 |
| 에러 | 공통 + 아래 |
| 검사 순서 | 본문 규칙(DB 전) → 방 존재 |
| 부수 효과 | `messages` 1행(작성자 `mb_id`는 저장만 하고 응답하지 않는다) + 방 `updatedAt` = 서버 시각(같은 batch, R-ROOM-005). **AI를 호출하지 않는다**(R-MSG-002) |
| 레이트리밋 | 1회 |
| server | `messages.addUserMessage(roomId: string, input: UserMessageInput, author: MessageAuthor): Promise<Message>` — `author`는 `getPrincipal(c)` |
| 요구ID | R-MSG-002 · R-AUTH-004 · R-ROOM-005 · R-CHAT-004 · R-CHAT-006 |
| 테스트 | API-T-050 ~ 053 · 061 · 062 |

| 코드 | status | message | 조건 |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 메시지는 1~2000자로 입력해 주세요. | trim 후 코드 포인트 0자 또는 2001자 이상 |
| `VALIDATION_ERROR` | 400 | 요청 형식이 올바르지 않습니다. | `ooc` 없음 · `ooc`가 boolean 아님(`"true"` 포함) · `text`가 문자열 아님 |
| `NOT_FOUND` | 404 | 방을 찾을 수 없습니다. | 없는 방(삭제와 경합해도 고아 없이 `404`) |

```json
{ "text": "둘이 체스를 둔다.", "ooc": true }
```

```json
{ "id": 71, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "user", "kind": "ooc", "text": "둘이 체스를 둔다.", "authorName": "시엘 팬텀하이브", "createdAt": 1767230000000 }
```

### 4.10 `PATCH /api/messages/:id` (E10) — 메시지 수정

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로 | `id`: 메시지 id(§4.5 변환 규칙) |
| 본문 | `EditMessageBody` = `{ text: string }` |
| 성공 | `200` · `Message`. `text`만 바뀐다(trim). `speaker`·`kind`·`authorName`·`createdAt`은 그대로다. 캐릭터 메시지도 같은 규칙이다 |
| 에러 | 공통 + 아래 |
| 검사 순서 | id 형식(DB 전 `404`) → 본문 규칙(DB 전 `400`) → 메시지 존재(`404`). 그래서 `abc` id에 빈 본문을 보내면 `404`다 |
| 부수 효과 | 메시지 `text` 갱신 + 그 방 `updatedAt` = 서버 시각(같은 batch) |
| 레이트리밋 | 1회 |
| 권한 | 등급 통과자 누구나. 다른 `mb_id`가 쓴 메시지도 고칠 수 있다(R-MSG-008) |
| server | `messages.editMessage(messageId: number, input: MessageTextInput): Promise<Message>` |
| 요구ID | R-MSG-004 · R-MSG-008 · R-ROOM-005 · R-CHAT-007(인라인 수정) |
| 테스트 | API-T-050 ~ 053 · 063 · 064 · 066 |

| 코드 | status | message | 조건 |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 메시지는 1~2000자로 입력해 주세요. | E8과 같다 |
| `NOT_FOUND` | 404 | 메시지를 찾을 수 없습니다. | id 형식 위반(§4.5) · 없는 메시지 · 이미 삭제한 메시지 |

```json
{ "text": "도련님, 홍차가 식기 전에 드시지요." }
```

```json
{ "id": 41, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "sebastian", "kind": "line", "text": "도련님, 홍차가 식기 전에 드시지요.", "authorName": null, "createdAt": 1767228060000 }
```

- "수정됨" 표시 필드는 요구가 없어 두지 않는다(§13).

### 4.11 `DELETE /api/messages/:id` (E11) — 메시지 삭제

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로 | `id`: 메시지 id(§4.5 변환 규칙) |
| 본문 | 없음 |
| 성공 | `204` · 본문 없음 |
| 에러 | 공통 + `NOT_FOUND` 404 `메시지를 찾을 수 없습니다.`(id 형식 위반 · 없는 메시지 · 이미 삭제) |
| 부수 효과 | 메시지 실삭제(id는 재사용되지 않는다) + 그 방 `updatedAt` = 서버 시각(같은 batch). 히스토리 커서는 id 기준이라 이후 페이지는 빠진 id를 건너뛰어 이어진다 |
| 레이트리밋 | 1회 |
| 권한 | 등급 통과자 누구나(R-MSG-008) |
| server | `messages.deleteMessage(messageId: number): Promise<void>` |
| 요구ID | R-MSG-005 · R-MSG-008 · R-ROOM-005 · R-CHAT-007(삭제, confirm은 화면) |
| 테스트 | API-T-050 ~ 053 · 064 · 065 · 066 |

### 4.12 생성 공통 규칙 (S3 — E9 · E12)

AI가 대사를 만드는 두 쓰기다. 주방에 화구가 방마다 하나뿐이라 한 방에서는 한 번에 한 접시만 굽는다고 보면 된다. §4.5 쓰기 공통 규칙을 그대로 따르고 아래만 더한다.

| 항목 | 값 |
|---|---|
| 토큰 | ○ — §2.2. 두 엔드포인트 모두 라우트 단위로 `requireToken → rateLimitWrites → validate → 핸들러` |
| 처리 순서 | 부트스트랩 → `requireToken` → `rateLimitWrites` → `validate('param')` → (E9만) `validate('json')` → 핸들러 → 서비스. 서비스 안 판정 순서는 각 절의 「판정 순서」 표(server 설계 고정) |
| 시간 상한 (R-NFR-001 🔒) | 서버는 요청을 받은 뒤 **70초 안에** 성공 또는 실패 응답으로 끝난다. 내역: LLM 단계 최대 66초(1차 최대 60초 + 대기 1초 + 남은 예산 안의 재시도) + D1 왕복 여유 4초(llm.md §4.2). 정상 응답은 보통 수 초다 |
| 화면 타임아웃 | `ui/src/api/client.ts`에는 요청 타임아웃이 **없다 — 서버 종결에 의존한다**(§3.4). 타임아웃을 두게 되면 이 두 호출은 **75초 이상**(70초 + 망 여유 5초)이어야 한다. 그보다 짧으면 서버는 저장했는데 화면은 실패로 보고, 「재시도」가 대사를 하나 더 만든다 |
| 진행 상태 | 응답은 끝날 때 한 번에 온다. 스트리밍·진행 상태 조회·취소 엔드포인트는 없다(R-API-001) |
| 동시 1건 (R-MSG-007 🔒 · R-NFR-003 🔒) | 같은 방의 speak·regenerate는 **하나의 잠금**(`rooms.speaking_until`, 만료 90초)을 나눠 쓴다. 이미 생성 중이면 `409 SPEAK_IN_PROGRESS`. 다른 방끼리는 막지 않는다. 유저 발화·수정·삭제(E8·E10·E11)와 방 삭제(E6)는 잠금을 보지 않는다 |
| 잠금 해제 | 서버가 성공·실패와 무관하게 응답 전에 푼다. 해제 실패나 연결 끊김으로 남은 잠금은 최대 90초 뒤 저절로 풀린다(messages.md §4.3). 그동안 그 방의 생성 요청은 `409`다 |
| 레이트리밋 | 요청 1건 = 1회. 쓰기 6종과 **같은 분당 한도**를 나눠 쓴다. 인증 통과 뒤 세므로 `400`·`404`·`409`·`500 CONFIG_INVALID`·`502`·(v0.4.1) `429 LLM_BUDGET_EXCEEDED`로 끝나도 1회다. `401`·`403`은 세지 않는다(§6.1 S3 행) |
| AI 호출 | 요청당 제공사 호출 1~2회(1회 재시도, R-LLM-005). 래퍼는 자동 재시도하지 않는다. 「재시도」는 사용자가 누르는 새 요청이다(R-CHAT-005) |
| 월 비용 상한 (R-LLM-007 🔒, v0.4.1) | 서버가 제공사 응답의 토큰 사용량 × 단가 × 환율로 **추정 원화**를 월(KST) 단위로 누적한다. 누적이 `LLM_MONTHLY_BUDGET_KRW`(기본 100000) 이상이면 이 두 엔드포인트만 **키 확인 다음·잠금 선점 전·제공사 호출 전**에 `429 LLM_BUDGET_EXCEEDED`로 거절한다. 다음 달 1일 00:00 KST에 저절로 풀린다. 읽기·다른 쓰기는 영향이 없다. 사용량·예산을 보는 엔드포인트는 없고 health에도 싣지 않는다(R-API-001). 성공 응답 모양은 바뀌지 않는다 |
| 응답 메시지 | 기존 `Message` 그대로. `speaker`는 `'sebastian'`·`'ciel'`, `kind: 'line'`, `authorName: null`. 누가 눌렀는지는 저장·응답하지 않는다(messages.md D-MSG-12). 이름·아바타는 화면이 `CHARACTERS[speaker]`로 그린다(R-LLM-002, §5.5) |
| `text` | 제공사 응답의 후처리 결과(앞머리 이름표 제거·양끝 공백·연속 빈 줄 정리, R-LLM-004). 최대 2000자(코드 포인트, llm.md D-LLM-9). 빈 결과면 `502 LLM_EMPTY` |
| 응답 뒤 작업 | S3에는 없다. S4 장기기억 요약(R-MEM-002)이 성공 응답 뒤 백그라운드로 붙어도 응답 형태·status는 바뀌지 않는다 |

공통 에러(§4.5 공통에 더함):

| 코드 | status | message | 조건 | 판정 위치 |
|---|---|---|---|---|
| `CONFIG_INVALID` | 500 | 기본 문구 | `LLM_PROVIDER = google`인데 `LLM_API_KEY`가 없음. **이 두 엔드포인트만** 실패하고 읽기·다른 쓰기는 정상이다(R-ENV-003). `fake` 제공사는 키가 없어도 된다 | 서비스(`deps.llm()`, 잠금 전) |
| `LLM_BUDGET_EXCEEDED` (v0.4.1) | 429 | 기본 문구 + 본문 `retryAfterSec` + 헤더 `Retry-After` | 이번 달 추정 누적 ≥ 예산(§3.2). `retryAfterSec` = 다음 달 1일 00:00 KST까지 초(올림, 최소 1). 예: `2026-10-06T05:00:00Z` → `2196000` | 서비스(`llm.ensureBudget()`, `CONFIG_INVALID` 다음·잠금 전) |
| `SPEAK_IN_PROGRESS` | 409 | 기본 문구 | 같은 방에서 speak·regenerate가 진행 중(잠금 만료 전) | 서비스(잠금 선점) |
| `LLM_FAILED` | 502 | 기본 문구 | 제공사 호출 최종 실패(§3.2 표) | llm |
| `LLM_EMPTY` | 502 | 기본 문구 | 제공사 차단·후보 없음, 또는 후처리 결과가 빈 문자열 | llm |

- `502`이면 저장하지 않는다. 메시지 수·방 `updatedAt`이 그대로이고 잠금은 풀린다(server SRV-T-198).
- 응답 `message`에 제공사 이름·HTTP 상태·차단 사유·키 이름을 싣지 않는다. 원인은 서버 로그(`llm_failed`)에만 있다(R-LLM-005 · R-NFR-004).
- (v0.4.1) `429 LLM_BUDGET_EXCEEDED`이면 잠금·제공사 호출·저장이 모두 0회다. 메시지 수·방 `updatedAt`·`speaking_until`이 그대로다(server SRV-T-225·226). 응답 본문에 누적액·예산·사용률을 싣지 않는다.
- (v0.4.1) 게이트의 D1 읽기가 실패하면 통과시키지 않고 `500 INTERNAL`이다(llm.md D-LLM-22, 닫힌 실패).
- (v0.4.1) 예산 직전에 다른 방의 생성 여러 건이 동시에 게이트를 지나면 모두 진행해 예산을 조금 넘을 수 있다(llm.md §12.8, 수용). 추정은 실제 청구와 다를 수 있다(§8).

### 4.13 `POST /api/rooms/:id/speak` (E9) — 캐릭터 1턴 생성

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로 | `id: string`(방 id, §4.5 `roomIdParam`) |
| 본문 | `SpeakBody` = `{ character: CharacterId }`(`'sebastian' \| 'ciel'`). 필수. 모르는 키는 버린다 |
| 성공 | `201` · `Message`. `speaker = character`, `kind: 'line'`, `authorName: null`, `text` = 후처리 결과, `createdAt` = **저장 시각**(생성이 끝난 시각이지 요청 시각이 아니다). 저장 순서대로 id가 붙어 히스토리 끝에 온다 |
| 직전 발화자 | 무관. 같은 캐릭터가 연속으로 말해도 된다(R-MSG-003) |
| 컨텍스트 | 서버가 그 방의 최근 메시지(`CONTEXT_MESSAGES`개, 기본 40)와 장기기억 요약을 읽어 프롬프트를 만든다. 화면은 대화 내용을 보내지 않는다 |
| 에러 | §4.5 공통 + §4.12 공통 + 아래 |
| 부수 효과 | `messages` 1행 + 방 `updatedAt` = 저장 시각(같은 batch, R-ROOM-005). 잠금 선점·해제(`updatedAt`은 바꾸지 않는다). 제공사 호출 1~2회. 실패면 아무것도 저장하지 않는다 |
| 레이트리밋 | 1회 |
| 소요 | 최대 70초(§4.12) |
| server | `messages.speak(roomId: string, input: SpeakInput, background: Background): Promise<Message>` — `SpeakInput = SpeakBody`, 라우트가 `background = { waitUntil: task => c.executionCtx.waitUntil(task) }`를 넘긴다(messages.md §2.3) |
| 요구ID | R-MSG-003 · R-MSG-007 · R-ROOM-005 · R-NFR-001 · R-NFR-003 · R-LLM-002 · R-LLM-004 · R-LLM-005 · R-CHAT-005 · (v0.4.1) R-LLM-007 |
| 테스트 | API-T-050 ~ 053(쓰기 표에 추가) · 070 ~ 077 · 084 · (v0.4.1) 085 · 086 · 088 ~ 090 |

판정 순서(server 설계 고정 — messages.md §4.2. 앞 단계에서 실패하면 뒤 단계는 보지 않는다):

| 순서 | 검사 | 실패 |
|---|---|---|
| 1 | 토큰(§2.3) | `401 TOKEN_REQUIRED`·`TOKEN_INVALID` / `403 LEVEL_TOO_LOW` |
| 2 | 레이트리밋(§6.1) — 여기서 1회 소모 | `429 RATE_LIMITED` |
| 3 | 본문 `character`(라우트 zod) | `400 VALIDATION_ERROR` |
| 4 | LLM 설정(`LLM_API_KEY`) | `500 CONFIG_INVALID` |
| 4b | (S3b) 월 비용 상한 — D1 읽기 1행. 잠금·제공사 호출 0회 | `429 LLM_BUDGET_EXCEEDED` |
| 5 | 방 존재 · 잠금 선점(한 batch) | `404 NOT_FOUND` / `409 SPEAK_IN_PROGRESS` |
| 6 | 제공사 호출 · 후처리 | `502 LLM_FAILED` / `502 LLM_EMPTY` |
| 7 | 저장(생성 중 방이 삭제됐으면 저장하지 않는다) | `404 NOT_FOUND` |

- 그래서 없는 방에 잘못된 `character`를 보내면 `400`이고, 키가 없는 서버에 없는 방으로 보내면 `500 CONFIG_INVALID`다.
- (v0.4.1) 예산 초과 중에는 없는 방이나 잠긴 방으로 보내도 `429 LLM_BUDGET_EXCEEDED`다(방 존재 확인·잠금 선점이 한 batch라 게이트 뒤에 있다). 잘못된 `character`는 여전히 `400`, 키 없는 서버는 여전히 `500 CONFIG_INVALID`다.

에러(이 엔드포인트만):

| 코드 | status | message | 조건 |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | `요청 형식이 올바르지 않습니다.` | `character` 없음 · 두 값이 아닌 문자열(`'Sebastian'`·`'meirin'`·`''` 포함) · 문자열이 아님(`1`·`null`) · 본문 JSON 깨짐 · `Content-Type`이 JSON 아님 |
| `NOT_FOUND` | 404 | `방을 찾을 수 없습니다.` | 없는 방(삭제된 방 포함) · 생성 중 방이 삭제됨(고아 메시지 없음) |
| `LLM_BUDGET_EXCEEDED` (v0.4.1) | 429 | 기본 문구 | 판정 4b. 저장 없음. `retryAfterSec`·`Retry-After`는 §4.12 공통 |

```json
{ "character": "sebastian" }
```

```json
{ "id": 72, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "sebastian", "kind": "line", "text": "분부대로 하겠습니다, 도련님.", "authorName": null, "createdAt": 1767230012000 }
```

경합(messages.md §4.3):

| 상황 | 결과 |
|---|---|
| 같은 방 speak 2건 동시 | 1건 `201`, 나머지 `409 SPEAK_IN_PROGRESS` |
| 같은 방 speak와 regenerate 동시 | 같은 잠금이라 한쪽 `409 SPEAK_IN_PROGRESS` |
| 다른 방 speak 2건 | 둘 다 진행 |
| speak 중 유저 발화(E8) | 둘 다 성공. 이번 대사는 잠금 직후까지의 대화만 보고, 그 유저 발화보다 뒤(큰 id)에 저장된다 |
| speak 중 방 삭제(E6) | 방 삭제는 `204`, speak는 `404 NOT_FOUND` |
| 연결 끊김(탭 닫기 등) | 서버 실행이 취소될 수 있다. 대사 저장 여부는 취소 시점에 따른다. 남은 잠금은 최대 90초 뒤 풀린다 |

### 4.14 `POST /api/messages/:id/regenerate` (E12) — 같은 캐릭터로 다시 생성

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로 | `id`: 메시지 id(§4.5 `messageIdParam` — 10진 숫자 문자열만 `Number()`, 그 밖은 `404`) |
| 본문 | **없음.** 보내도 읽지 않는다(`validate('json')` 없음). 깨진 JSON·다른 `Content-Type`도 무시하고 진행한다 |
| 대상 조건 (R-MSG-006 🔒) | 캐릭터 메시지(`speaker`가 `'sebastian'`·`'ciel'`)이고 **그 방의 마지막 메시지**(그 방에서 id가 가장 큼)일 때만 |
| 성공 | `200` · `Message`. `text`만 새 대사로 바뀐다. `id`·`roomId`·`speaker`·`kind`·`authorName`(`null`)·`createdAt`은 그대로다. 캐릭터는 대상의 `speaker`이며 요청으로 바꿀 수 없다 |
| 컨텍스트 | 대상을 뺀 그 앞의 최근 메시지(`CONTEXT_MESSAGES`개)와 장기기억 요약. 대상의 원래 대사는 프롬프트에 넣지 않는다 |
| 에러 | §4.5 공통 + §4.12 공통 + 아래 |
| 부수 효과 | 대상 `text` 교체 + 그 방 `updatedAt` = 교체 시각(같은 batch, R-ROOM-005). 잠금 선점·해제. 제공사 호출 1~2회. 실패면 원래 대사가 그대로 남는다 |
| 레이트리밋 | 1회 |
| 소요 | 최대 70초(§4.12) |
| server | `messages.regenerate(messageId: number): Promise<Message>`(messages.md §2.3) |
| 요구ID | R-MSG-006 · R-MSG-007 · R-ROOM-005 · R-NFR-001 · R-NFR-003 · R-LLM-004 · R-LLM-005 · R-CHAT-007(재작성) · (v0.4.1) R-LLM-007 |
| 테스트 | API-T-050 ~ 053(쓰기 표에 추가) · 074 · 075 · 078 ~ 084 · (v0.4.1) 087 · 088 |

판정 순서(server 설계 고정 — messages.md §4.2):

| 순서 | 검사 | 실패 |
|---|---|---|
| 1 | 토큰 | `401` / `403` |
| 2 | 레이트리밋 — 1회 소모 | `429` |
| 3 | id 형식(1 이상 안전 정수) · 메시지 존재 | `404 NOT_FOUND` |
| 4 | 대상이 유저 메시지 | `400 NOT_CHARACTER_MESSAGE` |
| 5 | LLM 설정 | `500 CONFIG_INVALID` |
| 5b | (S3b) 월 비용 상한 — 잠금·제공사 호출 0회 | `429 LLM_BUDGET_EXCEEDED` |
| 6 | 잠금 선점 → (잡았으면) 마지막 메시지 확인 | `409 SPEAK_IN_PROGRESS` → `409 NOT_LAST_MESSAGE` / 그사이 대상이 삭제됨 `404 NOT_FOUND` |
| 7 | 제공사 호출 · 후처리 | `502 LLM_FAILED` / `502 LLM_EMPTY` |
| 8 | 교체(생성 중 대상이 삭제됐으면 교체하지 않는다) | `404 NOT_FOUND` |

- **두 409의 우선순위는 잠금이 먼저다.** 다른 생성이 진행 중이면 대상이 마지막이 아니어도 `SPEAK_IN_PROGRESS`다. 마지막 여부는 잠금을 잡은 뒤에만 본다.
- 유저 메시지는 마지막이든 아니든 `400 NOT_CHARACTER_MESSAGE`다(4가 6보다 먼저). 키가 없는 서버에서도 유저 메시지는 `400`이다.
- (v0.4.1) 예산 게이트(5b)는 대상 검사(3·4)와 키 확인(5) 뒤, 잠금(6) 앞이다. 예산 초과 중에도 없는 id는 `404`, 유저 메시지는 `400 NOT_CHARACTER_MESSAGE`다. 대상이 마지막이 아니거나 방이 잠겨 있어도 예산 초과면 `429 LLM_BUDGET_EXCEEDED`다(두 409는 잠금을 잡을 때 본다).
- 마지막 여부는 잠금을 잡은 시점에 한 번 본다. 생성 중에 유저 발화가 뒤에 붙어도 교체는 된다(messages.md §4.3의 확인 필요 항목).

에러(이 엔드포인트만):

| 코드 | status | message | 조건 |
|---|---|---|---|
| `NOT_FOUND` | 404 | `메시지를 찾을 수 없습니다.` | id 형식 위반(`abc`·`0`·`1.5`·`0x10`·`1e1`) · 없는 메시지 · 이미 삭제 · 생성 중 대상(또는 그 방) 삭제 |
| `NOT_CHARACTER_MESSAGE` | 400 | `캐릭터 메시지만 다시 생성할 수 있습니다.` | 대상 `speaker === 'user'`(`kind` `line`·`ooc` 모두) |
| `NOT_LAST_MESSAGE` | 409 | `방의 마지막 메시지만 다시 생성할 수 있습니다.` | 그 방에 대상보다 큰 id의 메시지가 있음 |
| `LLM_BUDGET_EXCEEDED` (v0.4.1) | 429 | 기본 문구 | 판정 5b. 원래 대사가 그대로 남는다. `retryAfterSec`·`Retry-After`는 §4.12 공통 |

요청: `POST /api/messages/72/regenerate`(본문 없음). 응답:

```json
{ "id": 72, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "sebastian", "kind": "line", "text": "물론입니다. 오늘 일정부터 말씀드리지요.", "authorName": null, "createdAt": 1767230012000 }
```

경합(messages.md §4.3):

| 상황 | 결과 |
|---|---|
| regenerate와 같은 방 speak 동시 | 한쪽 `409 SPEAK_IN_PROGRESS` |
| regenerate 중 같은 메시지 수정(E10) | 둘 다 성공할 수 있고 나중에 쓴 쪽이 남는다(수정은 잠금을 보지 않는다) |
| regenerate 중 대상 삭제(E11)·방 삭제(E6) | 삭제는 `204`, regenerate는 `404 NOT_FOUND` |
| regenerate 중 유저 발화(E8) | 둘 다 성공. 교체된 대사는 이제 마지막이 아니다 |

### 4.15 `GET /api/settings/characters` (E15) — 캐릭터 설정 읽기 (갠홈 주인 전용)

| 항목 | 값 |
|---|---|
| 토큰 | ○ + 주인(§2.7). 읽기지만 토큰이 필요하다(R-AUTH-003 예외) |
| 처리 순서 | 부트스트랩(server) → `requireToken` → `requireOwner` → 핸들러 → `services.settings.get()` |
| 요청 | 경로·쿼리·본문 없음(쿼리가 있어도 무시) |
| 성공 | `200` · `CharacterSettingsResponse`(§5.8). D1에 저장된 적이 없거나 저장 행이 재검증에 실패하면 **시드**를 준다: `isDefault: true` · `version: 0` · `updatedAt: null` |
| 응답 필드 | 정확히 `settings` · `version` · `updatedAt` · `isDefault` 넷. `settings`는 키가 전부 있는 정규화 값이다(필드 11개 × 2명 + `world`). 저장자 `mbId`·`updatedBy`·토큰·설정 키·`outputRules`·GUARD_RULES는 싣지 않는다(R-AUTH-006 · R-SET-006 · R-SET-007) |
| 부수 효과 | 없음(D1 PK 1행 읽기). 응답 캐시 없음 — 화면은 설정 화면을 열 때마다 다시 읽는다 |
| 레이트리밋 | 없음(읽기). 주인 판정 탐침이 첫 로드마다 1회 오므로 세지 않는다 |
| 주인 판정 탐침 | 화면 App이 토큰이 있을 때 1회 부른다. `200`만 주인이다(§2.7 · R-SET-010) |
| server | `services.settings.get(): Promise<CharacterSettingsResponse>`(s3c-03 §1.3, settings.md) |
| 요구ID | R-SET-004 · R-SET-001 · R-SET-003 · R-SET-010 · R-AUTH-003 · R-AUTH-006 |
| 테스트 | API-T-091 · 092 · 093 · 094 · 102 · 103 |

에러:

| 코드 | status | message | 조건 | 판정 위치 |
|---|---|---|---|---|
| `CONFIG_INVALID` | 500 | 기본 문구 | 설정 오류(`OWNER_MB_IDS` 형식 위반 포함, 가장 먼저) | server 부트스트랩 |
| `TOKEN_REQUIRED` | 401 | 기본 문구 | Bearer 토큰을 꺼낼 수 없음(§2.2) | `requireToken` |
| `TOKEN_INVALID` | 401 | 기본 문구 | 형식·서명·payload·만료 실패(§2.3) | `requireToken` |
| `LEVEL_TOO_LOW` | 403 | 기본 문구 | `level < TOKEN_MIN_LEVEL`(주인 ID여도) | `requireToken` |
| `OWNER_ONLY` | 403 | 기본 문구만 | `mbId ∉ OWNER_MB_IDS` 또는 목록 비어 있음 | `requireOwner` |
| `INTERNAL` | 500 | 기본 문구 | D1 읽기 실패(테이블 없음 포함). 시드로 대체하지 않는다 | onError |

응답 예(값은 예시 문구이며 실제 시드 내용이 아니다):

```json
{
  "settings": {
    "world": "19세기 말 런던. 팬텀하이브 저택과 그 주변이 무대다.",
    "characters": {
      "sebastian": {
        "sourceMaterial": "흑집사",
        "age": "",
        "gender": "남성",
        "role": "팬텀하이브 가 집사",
        "persona": "무엇이든 완벽하게 해내는 집사.",
        "personalityTags": "",
        "appearance": "",
        "relationships": "",
        "speech": "정중한 존댓말을 쓴다.",
        "sampleDialogue": [],
        "rules": ["자신의 정체를 먼저 밝히지 않는다."]
      },
      "ciel": {
        "sourceMaterial": "흑집사",
        "age": "13",
        "gender": "남성",
        "role": "팬텀하이브 백작",
        "persona": "어린 나이에 가문을 이끄는 백작.",
        "personalityTags": "",
        "appearance": "",
        "relationships": "",
        "speech": "짧고 단호한 반말.",
        "sampleDialogue": ["쓸데없는 소리는 그만둬."],
        "rules": []
      }
    }
  },
  "version": 0,
  "updatedAt": null,
  "isDefault": true
}
```

### 4.16 `PUT /api/settings/characters` (E16) — 캐릭터 설정 전체 교체 저장 (갠홈 주인 전용)

| 항목 | 값 |
|---|---|
| 토큰 | ○ + 주인(§2.7) |
| 처리 순서 | 부트스트랩 → `requireToken` → `requireOwner` → `rateLimitWrites` → 본문 상한(128KB) → `validate('json', putCharacterSettingsBody, settingsIssueMessage)` → 핸들러 → `services.settings.put(body.settings, getPrincipal(c))` |
| 본문 | `PutCharacterSettingsBody` = `{ settings: CharacterSettings }`(§5.8), `Content-Type: application/json`. **봉투**(`settings` 바깥)의 모르는 키는 버린다(§4.5 규칙). **`settings` 안은 strict** — 모르는 키·세 번째 캐릭터·빠진 키는 `400`(R-SET-002). 필드 11개는 전부 있어야 한다(선택 필드는 `''`·`[]`로 보낸다) |
| 의미 | **전체 교체.** 부분 갱신·병합 없음. 낙관적 잠금 없음 — 동시 저장은 마지막 쓰기가 남는다 |
| 검증 규칙 | `shared/src/settings.ts`의 `WORLD_FIELD_SPEC`·`CHARACTER_FIELD_SPECS`(§5.8). 글 필드는 앞뒤 trim 뒤 코드 포인트로 세고, 필수 3종(`world`·`persona`·`speech`)은 1자 이상. 목록 필드는 항목마다 trim → 빈 항목 제거 → 개수 상한 → 항목 길이 상한 |
| 본문 상한 | **131072바이트(128KB, `SETTINGS_BODY_MAX_BYTES`)**. `Content-Length`가 있으면 그 값으로, 없으면 실제로 읽은 바이트로 판정한다. 넘으면 `400 VALIDATION_ERROR`(`413`을 쓰지 않는다). 일반 글(한글·이모지·줄바꿈)로 필드 상한을 모두 채운 본문은 이 값 안에 든다. 제어 문자 이스케이프(`\u00XX`, 1자 = 6바이트)로만 채운 비정상 본문은 넘을 수 있고 그때도 이 `400`이다. 저장 행 CHECK(200000자)는 server 몫(db.md §7.6) |
| 성공 | `200` · `CharacterSettingsResponse`. `settings` = 서버가 정규화한 값(= `checkCharacterSettings(요청 settings).value`), `version` = 직전 저장 행의 version + 1(처음이면 1), `updatedAt` = 저장 시각(epoch ms), `isDefault: false`. 화면은 이 응답으로 초안과 기준값을 다시 맞춘다 |
| 부수 효과 | `character_settings` 1행 UPSERT. 다음 speak·regenerate부터 새 값으로 프롬프트를 만든다(캐시 없음, R-SET-003). 이미 진행 중인 생성은 이전 값을 쓴다. 서버 로그 `settings_saved { mbId, version }`만 남고 본문은 남지 않는다(R-SET-012) |
| 레이트리밋 | 1회 — 쓰기 공용 분당 한도를 나눠 쓴다(§6.1 S3c 행). `401`·`403`(`OWNER_ONLY` 포함)은 세지 않고, 본문 상한·검증 `400`은 센다 |
| version | 단조 증가만 약속한다. 저장 행이 깨져 시드(`version 0`)로 보이던 상태에서 저장하면 1이 아니라 깨진 행의 version + 1일 수 있다. 화면은 표시에만 쓴다 |
| server | `services.settings.put(settings: CharacterSettings, by: Principal): Promise<CharacterSettingsResponse>`(s3c-03 §1.3) |
| 요구ID | R-SET-005 · R-SET-002 · R-SET-001 · R-SET-003 · R-SET-012 · R-AUTH-005 · R-AUTH-006 · R-API-004 |
| 테스트 | API-T-091 · 092 · 093 · 095 ~ 103 |

판정 순서(앞 단계에서 실패하면 뒤 단계는 보지 않는다):

| 순서 | 검사 | 실패 |
|---|---|---|
| 1 | 토큰(§2.3) | `401 TOKEN_REQUIRED`·`TOKEN_INVALID` / `403 LEVEL_TOO_LOW` |
| 2 | 주인(§2.7) | `403 OWNER_ONLY` — 레이트리밋 소모 없음 |
| 3 | 레이트리밋(§6.1) — 여기서 1회 소모 | `429 RATE_LIMITED` |
| 4 | 본문 크기 | `400 VALIDATION_ERROR` `공통 · 설정 본문은 128KB 이하여야 합니다.` |
| 5 | 본문 JSON 파싱 | `400 VALIDATION_ERROR` 기본 문구(onError, HTTPException 400) |
| 6 | 본문 검증 — 통과 여부는 server zod(`characterSettingsSchema`), 문구는 shared `checkCharacterSettings`의 첫 위반 | `400 VALIDATION_ERROR` + 아래 표 문구 |
| 7 | 저장 | `500 INTERNAL`(D1 장애) |

400 문구 규칙(R-SET-005 — **첫 위반 1건**, 형식 `{캐릭터 shortName 또는 공통} · {필드 화면 이름}은(는) …`):

| 위반 | path(사전 검사 `issue.path`) | message |
|---|---|---|
| `settings`가 객체가 아님·없음(`Content-Type`이 JSON이 아니어서 본문이 `{}`로 읽힌 경우 포함) | `[]` | `공통 · 설정 형식이 올바르지 않습니다.` |
| `settings`에 `world`·`characters` 밖의 키 | `[]` | `공통 · 알 수 없는 항목이 있습니다.` |
| `world` 문자열 아님·없음 | `['world']` | `공통 · 세계관 값의 형식이 올바르지 않습니다.` |
| `world` trim 후 0자 또는 2001자 이상 | `['world']` | `공통 · 세계관은 1~2000자여야 합니다.` |
| `characters`가 객체가 아님·없음 | `['characters']` | `공통 · 캐릭터 설정 형식이 올바르지 않습니다.` |
| `characters`에 `sebastian`·`ciel` 밖의 키 | `['characters']` | `공통 · 알 수 없는 캐릭터가 있습니다.` |
| 캐릭터 값이 객체가 아님·없음 | `['characters', id]` | `{shortName} · 설정 형식이 올바르지 않습니다.` |
| 캐릭터 안에 필드 11개 밖의 키 | `['characters', id]` | `{shortName} · 알 수 없는 항목이 있습니다.` |
| 필드 없음·형 틀림(글 필드에 문자열 아님, 목록 필드에 문자열 배열 아님) | `['characters', id, key]` | `{shortName} · {label} 값의 형식이 올바르지 않습니다.` |
| 필수 글 필드 trim 후 0자 또는 상한 초과 | 〃 | `{shortName} · {label}{은/는} 1~{max}자여야 합니다.` 예: `시엘 · 말투는 1~800자여야 합니다.` |
| 선택 글 필드 상한 초과 | 〃 | `{shortName} · {label}{은/는} {max}자 이하여야 합니다.` 예: `세바스찬 · 외형은 800자 이하여야 합니다.` |
| 목록 필드 빈 항목 제거 뒤 개수 초과 | 〃 | `{shortName} · {label}{은/는} {maxItems}개 이하여야 합니다.` 예: `시엘 · 샘플 대사는 10개 이하여야 합니다.` |
| 목록 항목 하나라도 길이 초과 | 〃 | `{shortName} · {label}{은/는} 한 줄에 {itemMax}자 이하여야 합니다.` |

- **검사 순서**(첫 위반이 무엇인지): `settings` 객체 → 모르는 키 → `world` → `characters` 객체 → 모르는 캐릭터 → `sebastian` → `ciel`. 캐릭터 안은 객체 → 모르는 키 → 필드를 `CHARACTER_FIELD_KEYS` 순서로(각 필드는 형 → 길이·개수). 문구 단일 소스는 shared `checkCharacterSettings`이고 화면 사전 검사와 서버 `400`이 같은 문장을 낸다.
- `{은/는}`은 화면 이름 끝 글자의 받침으로 정한다(`settings.ts` `withTopic`). 응답 `error`의 키는 `code`·`message` 둘뿐이다. `path`·`details` 키는 응답에 없다(§3.1). 경로는 화면 사전 검사에서만 쓴다.
- 모르는 키 문구에 키 이름을 싣지 않는다. 가져오기 파일의 `apiKey` 같은 이름이 응답·화면에 되비치지 않게 한다(§3.1 "키 이름 금지").
- zod 판정과 shared 사전 검사가 어긋나 zod만 실패하면 기본 문구 `요청 형식이 올바르지 않습니다.`가 나간다(안전망). 두 판정은 같은 경계값 벡터로 테스트한다(API-T-106·107 + server SRV-T).

에러(§4.15 표에 더함):

| 코드 | status | message | 조건 |
|---|---|---|---|
| `RATE_LIMITED` | 429 | 기본 문구 + `retryAfterSec` + `Retry-After` | 판정 3. 쓰기 공용 분당 한도 |
| `VALIDATION_ERROR` | 400 | 판정 4·6은 위 문구, 판정 5는 기본 문구 | 본문 상한 · JSON 깨짐 · 형식·필수·길이·개수·모르는 키 |

요청 예(필드 일부는 지면상 생략했다. 실제 요청은 11필드 × 2명이 모두 있어야 한다):

```json
{ "settings": { "world": "  19세기 말 런던.  ", "characters": { "sebastian": { "sourceMaterial": "흑집사", "age": "", "gender": "남성", "role": "집사", "persona": "완벽한 집사.", "personalityTags": "", "appearance": "", "relationships": "", "speech": "정중한 존댓말.", "sampleDialogue": ["  분부대로.  ", "", "   "], "rules": [] }, "ciel": { "…": "…" } } } }
```

응답 예(`world` trim, `sampleDialogue` 빈 항목 제거):

```json
{ "settings": { "world": "19세기 말 런던.", "characters": { "sebastian": { "sourceMaterial": "흑집사", "age": "", "gender": "남성", "role": "집사", "persona": "완벽한 집사.", "personalityTags": "", "appearance": "", "relationships": "", "speech": "정중한 존댓말.", "sampleDialogue": ["분부대로."], "rules": [] }, "ciel": { "…": "…" } } }, "version": 3, "updatedAt": 1767231000000, "isDefault": false }
```

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
  before?: number | undefined
  /** 1~100 정수 */
  limit?: number | undefined
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

/** POST /api/rooms 본문 (R-ROOM-002). trim·1~60자 판정은 서버 (S2) */
export type CreateRoomBody = {
  title: string
}

/** PATCH /api/rooms/:id 본문 (R-ROOM-003). 규칙은 CreateRoomBody 와 같다 (S2) */
export type RenameRoomBody = {
  title: string
}

/** POST /api/rooms/:id/user 본문 (R-MSG-002). ooc = true 이면 지시(kind 'ooc'). 둘 다 필수 (S2) */
export type UserMessageBody = {
  text: string
  ooc: boolean
}

/** PATCH /api/messages/:id 본문 (R-MSG-004). trim·1~2000자 판정은 서버 (S2) */
export type EditMessageBody = {
  text: string
}

/** 모든 실패 응답 본문 (R-API-002) */
export type ApiErrorBody = {
  error: {
    code: ErrorCode
    message: string
    /** 429 두 코드에만 붙는다. RATE_LIMITED = 다음 분 창까지, LLM_BUDGET_EXCEEDED = 다음 달 1일 00:00 KST까지 남은 초(정수 ≥ 1). 같은 값이 Retry-After 헤더에도 실린다 (R-AUTH-005 · R-LLM-007) */
    retryAfterSec?: number
  }
}
```

- (S2) 추가는 본문 타입 4개와 `ApiErrorBody.error.retryAfterSec?` 하나다. 기존 타입·필드는 바꾸지 않았다.
- (v0.4.1, S3b) **타입 변경 없음.** 위 `retryAfterSec?` 문서주석만 두 코드로 넓혔다. `ErrorCode`는 `ERROR_CODES`에서 유도되므로 저절로 14개가 된다.
- `CreateRoomBody`와 `RenameRoomBody`는 모양이 같지만 엔드포인트별 계약이라 따로 둔다. 한쪽만 바뀌어도 다른 쪽에 번지지 않는다.
- `TokenPayload`는 shared에 두지 않는다(§2.3).
- `Message`·`RoomSummary`는 쓰기 응답에 그대로 쓴다. 새 응답 타입은 없다. `DELETE` 성공은 본문이 없다(`204`).

S3 추가분(v0.4 — `shared/src/types.ts`의 `EditMessageBody` 다음):

```ts
/** POST /api/rooms/:id/speak 본문 (R-MSG-003). 두 값 밖이면 400 VALIDATION_ERROR (S3) */
export type SpeakBody = {
  character: CharacterId
}
```

```json
{ "character": "ciel" }
```

- (S3) 추가는 `SpeakBody` 하나다. E12는 본문이 없어 타입이 없다. 두 엔드포인트 응답은 기존 `Message`다(새 응답 타입 없음).
- `CharacterId`를 그대로 쓴다. 캐릭터 문자열 유니온을 새로 만들지 않는다.

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
  'LLM_BUDGET_EXCEEDED',
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
  LLM_BUDGET_EXCEEDED: 429,
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
  LLM_BUDGET_EXCEEDED: '이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.',
  CONFIG_INVALID: '서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요.',
  INTERNAL: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
}

/** 값이 계약 에러 코드인지 (화면이 응답 본문을 정규화할 때 쓴다) */
export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value)
```

- `Record<ErrorCode, …>`라서 코드를 추가하고 status·문구를 빠뜨리면 tsc가 실패한다.
- (v0.4.1) `LLM_BUDGET_EXCEEDED`는 `LLM_EMPTY` 다음(요구 R-API-002 나열 순서)에 둔다. `ErrorStatus`에 429가 이미 있어 유니온은 그대로다. 파일 머리 주석의 "(R-API-002)"도 그대로다.

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
  /** PATCH·DELETE 방 (S2) */
  room: `${API}/rooms/:id`,
  /** POST 유저 발화·지시 (S2) */
  roomUser: `${API}/rooms/:id/user`,
  /** PATCH·DELETE 메시지 (S2). :id 는 메시지 id(정수) */
  message: `${API}/messages/:id`,
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
  /** (S2) */
  room: (roomId: string): string => withId(PATHS.room, roomId),
  /** (S2) */
  roomUser: (roomId: string): string => withId(PATHS.roomUser, roomId),
  /** (S2) 메시지 id 는 정수라 String() 으로 넣는다 */
  message: (messageId: number): string => withId(PATHS.message, String(messageId)),
} as const
```

- (S2) `endpoints.rooms()`는 GET(E3)과 POST(E4)가 같이 쓴다. `endpoints.room()`·`endpoints.message()`도 PATCH·DELETE가 같이 쓴다.

S3 추가분(v0.4):

```ts
// PATHS 에 추가 (message 다음)
  /** POST 캐릭터 1턴 생성 (S3) */
  roomSpeak: `${API}/rooms/:id/speak`,
  /** POST 같은 캐릭터로 재생성 (S3). :id 는 메시지 id(정수) */
  messageRegenerate: `${API}/messages/:id/regenerate`,

// endpoints 에 추가 (message 다음)
  /** (S3) */
  roomSpeak: (roomId: string): string => withId(PATHS.roomSpeak, roomId),
  /** (S3) 메시지 id 는 정수라 String() 으로 넣는다 */
  messageRegenerate: (messageId: number): string =>
    withId(PATHS.messageRegenerate, String(messageId)),
```

- 이름은 기존 규칙(자원 + 하위 경로: `roomMessages`·`roomUser`)을 따른다. 방 아래 경로는 `room…`, 메시지 아래 경로는 `message…`다.
- `PATHS` 값은 9개가 된다(shared 테스트 API-T-042 기대 갱신).

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
  /** 전체 표시명 (확정사항 §1). server/characters/{id}.json 의 name 과 같아야 한다 */
  name: string
  /** 짧은 이름. 말풍선 이름표·버튼 등 좁은 자리에 쓴다 (R-LLM-002 개정 2026-10-05) */
  shortName: string
  /** 아바타 이미지 경로(동일 출처 절대 경로) */
  avatar: string
}

export const CHARACTERS: { readonly [K in CharacterId]: CharacterMeta & { readonly id: K } } = {
  sebastian: {
    id: 'sebastian',
    name: '세바스찬 미카엘리스',
    shortName: '세바스찬',
    avatar: `${PATHS.embed}/img/sebastian.png`,
  },
  ciel: {
    id: 'ciel',
    name: '시엘 팬텀하이브',
    shortName: '시엘',
    avatar: `${PATHS.embed}/img/ciel.png`,
  },
}
```

- 화면 사용: `message.speaker === 'user'`이면 유저 말풍선, 아니면 `CHARACTERS[message.speaker]`(타입 좁히기로 `CharacterId`).
- 말풍선 이름표는 `shortName`을 쓴다(화면 구성안의 "시엘"·"세바스찬"). 전체 이름 `name`은 그대로 유지한다.
- 버튼의 접근성 레이블 문구는 화면 `labels.ts` 몫이다. 버튼에 보이는 이름은 `shortName`을 쓸 수 있다.
- S3 `server/src/llm/characters.ts`가 대조하는 값은 `name`뿐이다. `shortName`은 표시 전용이라 server JSON에 두지 않는다.

### 5.6 스키마 방식 (확정)

| 항목 | 결정 | 이유 |
|---|---|---|
| 검증 도구 | zod 하나 + `@hono/zod-validator`(확정사항 §2) | 스킬 §8 |
| 스키마 위치 | `server/src/routes/schemas.ts` | ui는 런타임 검증이 필요 없다. shared에 zod를 넣으면 화면 번들 의존이 생긴다 |
| 타입과 묶기 | 핸들러에서 `const query: MessagesQuery = c.req.valid('query')`, `const page: MessagesPage = await …`로 **대입 시점에 tsc가 대조**한다 | 별도 단언 타입 없이 어긋나면 컴파일 실패 |
| 범위·정수 규칙 | 서비스(`normalizePageQuery`)가 단일 소스. zod는 형태와 `Number()` 변환만 | messages.md D-MSG-4, R-API-007 |
| 실패 처리 | `validate` 훅이 `AppError('VALIDATION_ERROR', 400, ERROR_MESSAGES.VALIDATION_ERROR)` throw | §3.5 |
| 본문 스키마(S2) | `roomTitleBody`(`{ title: z.string() }`, E4·E5 공용) · `userMessageBody`(`{ text: z.string(), ooc: z.boolean() }`) · `editMessageBody`(`{ text: z.string() }`). `.min()`·`.max()`·`.trim()`을 쓰지 않는다 | zod 길이는 UTF-16 단위라 서비스·DB CHECK(코드 포인트)와 어긋난다. 같은 입력에 문구가 두 가지 나오지 않게 한다(rooms.md §9) |
| 메시지 id(S2) | `messageIdParam`이 10진 숫자 문자열만 `Number()`로, 나머지는 `NaN`으로 바꾼다. 범위 판정·`404`는 서비스 | 경로 식별자는 정규 표기 하나만 인정한다(`0x10`·`1e1`이 다른 메시지를 가리키지 않게) |
| 타입 대조(S2) | 핸들러에서 `const body: CreateRoomBody = c.req.valid('json')`처럼 shared 본문 타입에 대입한다 | S1과 같은 방식 |
| 길이 규칙(v0.3.1) | 상수·정규화·세기 함수는 `@shared/limits`(§5.7) 하나. 서버 서비스가 판정에, 화면이 입력 제한·글자 수 표시에 같은 것을 쓴다 | 화면과 서버가 같은 입력을 다르게 세지 않게 한다 |
| 생성 본문(S3) | `speakBody = z.object({ character: z.enum(CHARACTER_IDS) })`. `CHARACTER_IDS = ['sebastian', 'ciel'] as const satisfies readonly CharacterId[]`(schemas.ts 내부 상수). E12는 본문 스키마가 없다 | 값 두 개뿐인 열거라 타입 검사의 일부로 zod가 끝낸다. 서비스의 `isCharacterId` 재검사는 라우트를 거치지 않는 호출을 위한 안전망이라 HTTP로는 닿지 않는다(§15.9 S3-R1) |

### 5.7 `shared/src/limits.ts` 전문 초안 (v0.3.1 신규)

```ts
/**
 * 길이 상수·규칙 — 단일 소스 doc/200_설계/contract/api.md §5.7
 * 서버 서비스(trim·길이 판정)와 화면(입력 제한·글자 수 표시)이 같이 import 한다
 * 규칙: 앞뒤 trim 후 코드 포인트 수로 센다. DB CHECK length() 와 같은 단위다(이모지 1개 = 1자)
 */

/** 방 제목 최대 글자 수. 최소 1 (R-ROOM-002 · R-ROOM-003) */
export const ROOM_TITLE_MAX = 60

/** 메시지 본문 최대 글자 수. 최소 1 (R-MSG-002 · R-MSG-004 · R-CHAT-004) */
export const MESSAGE_TEXT_MAX = 2000

/** 장기기억 요약 최대 글자 수. 최소 0 — 빈 요약 허용 (R-MEM-001 · R-CHAT-012, S4에서 사용) */
export const MEMORY_SUMMARY_MAX = 4000

/** 코드 포인트 수. UTF-16 길이와 다르다('😀'.length === 2, countCodePoints('😀') === 1) */
export const countCodePoints = (s: string): number => [...s].length

/** 판정·저장 전 정규화. 앞뒤 공백·줄바꿈만 지우고 중간은 그대로 둔다 */
export const normalizeText = (s: string): string => s.trim()
```

| 쓰는 곳 | 쓰는 방식 |
|---|---|
| server `rooms.normalizeTitle` | `t = normalizeText(raw)` → `1 <= countCodePoints(t) <= ROOM_TITLE_MAX` 아니면 `VALIDATION_ERROR`(§4.6 문구). 상수는 rooms 모듈이 새로 정의하지 않는다 |
| server `messages.normalizeMessageText` | 같은 방식, 상한 `MESSAGE_TEXT_MAX`(§4.9 문구) |
| server memory(S4) | 하한 0, 상한 `MEMORY_SUMMARY_MAX`. trim 여부는 S4 설계가 정한다 |
| ui `limits.ts`(화면) | 상수·함수를 재노출하거나 그대로 import한다. 전송 비활성 판정(`countCodePoints(normalizeText(s)) === 0`)과 글자 수 표시에 쓴다 |
| routes zod | 쓰지 않는다. zod는 타입만 본다(§5.6) |

- 화면 판정은 편의일 뿐이다. 최종 판정과 에러 문구는 서버가 낸다. 같은 함수를 쓰므로 화면이 통과시킨 입력이 서버에서 길이 때문에 거부되는 일은 없다.
- 세는 단위는 코드 포인트다. 결합 이모지(`👨‍👩‍👧`)는 화면에 한 글자로 보여도 5로 센다. SQLite `length()`와 같은 단위라 서비스 통과 후 CHECK 실패(500)가 생기지 않는다(rooms.md D-ROOM-6).
- `String.prototype.trim`은 전각 공백(`U+3000`)도 지운다. 서버와 화면이 같은 함수를 쓰므로 결과가 같다.
- shared 규칙(런타임 중립)을 지킨다. 브라우저·workerd 전용 API를 쓰지 않는다.
- (v0.5, S3c) **`limits.ts`는 바꾸지 않는다.** 설정 필드 상한·본문 바이트 상한·가져오기 파일 상한은 필드 표와 한 몸이라 `shared/src/settings.ts`(§5.8)에 모은다. `settings.ts`가 이 파일의 `countCodePoints`·`normalizeText`를 import해 같은 세기 규칙을 쓴다.

### 5.8 S3c 추가분 (v0.5 — 캐릭터 설정)

§5.2·§5.3·§5.4 전문 초안에 아래 추가분을 합친 것이 v0.5 전문이다. `shared/src/settings.ts`는 신규 파일 전문이다.

#### 5.8.1 `shared/src/types.ts` 추가분 (`SpeakBody` 다음)

```ts
/** 캐릭터 1명의 설정 필드 (R-SET-002). id·표시명·아바타는 없다(CHARACTERS 가 단일 소스). 화면 이름·상한은 shared/src/settings.ts */
export type CharacterSettingFields = {
  /** 원작·장르. 선택 */
  sourceMaterial: string
  /** 나이. 선택 */
  age: string
  /** 성별. 선택 */
  gender: string
  /** 신분·직업. 선택 */
  role: string
  /** 성격·배경. 필수 */
  persona: string
  /** 성격 태그. 선택 */
  personalityTags: string
  /** 외형. 선택 */
  appearance: string
  /** 관계 메모. 선택 */
  relationships: string
  /** 말투. 필수 */
  speech: string
  /** 샘플 대사(한 줄에 하나). 빈 배열 허용 */
  sampleDialogue: string[]
  /** 규칙·금기(한 줄에 하나). 빈 배열 허용 */
  rules: string[]
}

/** 캐릭터 설정 본체 — API·D1·내보내기 파일 공통, 전체 교체 단위 (R-SET-002). outputRules 는 없다(편집 불가, R-SET-006) */
export type CharacterSettings = {
  /** 공통 세계관. 필수 */
  world: string
  /** 정확히 두 키(sebastian · ciel) */
  characters: Record<CharacterId, CharacterSettingFields>
}

/** GET · PUT /api/settings/characters 응답 (R-SET-004 · R-SET-005). 저장자 mbId 는 싣지 않는다 (R-AUTH-006) */
export type CharacterSettingsResponse = {
  /** 정규화된 본체(앞뒤 trim · 목록 빈 항목 제거) */
  settings: CharacterSettings
  /** 0 = 시드 사용 중. 저장할 때마다 증가(단조 증가만 약속) */
  version: number
  /** epoch ms. 시드면 null */
  updatedAt: number | null
  /** true = 저장값이 없거나 저장 행이 깨져 시드를 쓰는 중 */
  isDefault: boolean
}

/** PUT /api/settings/characters 본문 (R-SET-005). settings 안은 strict, 바깥 모르는 키는 버린다 */
export type PutCharacterSettingsBody = {
  settings: CharacterSettings
}
```

- `Record<CharacterId, …>`라서 캐릭터가 늘면 tsc가 모든 사용처를 잡는다. 캐릭터 문자열 유니온을 새로 만들지 않는다.
- 시각은 epoch ms(R-API-004). 없음은 `null`. `version`은 정수.
- 선택 필드도 키는 필수다(빈 문자열·빈 배열). 없음을 `undefined`·키 생략으로 나타내지 않는다(§5.1).

#### 5.8.2 `shared/src/errors.ts` 추가분 (3곳)

```ts
// ERROR_CODES — 'CONFIG_INVALID' 다음, 'INTERNAL' 앞 (R-API-002 나열 순서)
  'OWNER_ONLY',
// ERROR_STATUS
  OWNER_ONLY: 403,
// ERROR_MESSAGES
  OWNER_ONLY: '캐릭터 설정은 갠홈 주인만 열 수 있습니다.',
```

- `ErrorStatus`에 403이 이미 있어 유니온은 그대로다. 파일 머리 주석은 그대로 둔다.

#### 5.8.3 `shared/src/endpoints.ts` 추가분

```ts
// PATHS 에 추가 (messageRegenerate 다음)
  /** GET · PUT 캐릭터 설정 (S3c, R-SET-004 · R-SET-005). 갠홈 주인 전용 */
  characterSettings: `${API}/settings/characters`,

// endpoints 에 추가 (messageRegenerate 다음)
  /** (S3c) GET · PUT 이 같이 쓴다 */
  characterSettings: (): string => PATHS.characterSettings,
```

- 이름은 자원 기준이다(`settings/characters` = 캐릭터 설정). `PATHS` 값은 10개가 된다(API-T-042 기대 갱신).

#### 5.8.4 `shared/src/settings.ts` 전문 초안 (신규)

```ts
/**
 * 캐릭터 설정 규칙 — 단일 소스 doc/200_설계/contract/api.md §5.8 · §16 (R-SET-002 · R-SET-005 · R-SET-007 · R-SET-008)
 * 필드 화면 이름·필수·상한, 파일 형식 상수, 바이트 상한, 저장 전 사전 검사(400 문구 단일 소스)
 * server(zod 스키마가 상한을 import, routes 400 문구)와 ui(입력 제한·사전 검사·내보내기·가져오기)가 같이 쓴다
 * zod 를 쓰지 않는다(화면 번들 의존 금지, §5.6). 런타임 중립(브라우저·workerd 공용)
 */
import { CHARACTERS } from './characters'
import { countCodePoints, normalizeText } from './limits'
import type { CharacterId, CharacterSettingFields, CharacterSettings } from './types'

/** 내보내기 파일 식별자 (§16.1) */
export const SETTINGS_FILE_FORMAT = 'london-dispatch/character-settings'

/** 내보내기 파일 형식 버전. 가져오기는 이 값만 받는다 (§16.2) */
export const SETTINGS_FILE_FORMAT_VERSION = 1

/** PUT 본문 상한(바이트, 128KB). 넘으면 400 (R-SET-005, §4.16) */
export const SETTINGS_BODY_MAX_BYTES = 128 * 1024

/** 가져오기 파일 상한(바이트, 5MB). 화면이 읽기 전에 거부한다 (R-SET-008, §16.2) */
export const SETTINGS_IMPORT_MAX_BYTES = 5 * 1024 * 1024

/** 400 문구 앞머리 — 캐릭터 밖 항목 (§4.16) */
export const SETTINGS_COMMON_SCOPE = '공통'

/** 캐릭터 순서 — 검사·파일 직렬화가 이 순서를 쓴다. 집합 = CHARACTERS 의 키 (API-T-105) */
export const SETTINGS_CHARACTER_IDS = ['sebastian', 'ciel'] as const satisfies readonly CharacterId[]

/** 내보내기 파일 (§16.1). API 페이로드가 아니므로 exportedAt 은 ISO 8601 문자열이다 */
export type CharacterSettingsFile = {
  format: typeof SETTINGS_FILE_FORMAT
  formatVersion: typeof SETTINGS_FILE_FORMAT_VERSION
  exportedAt: string
  settings: CharacterSettings
}

type FieldKey = keyof CharacterSettingFields

/** 값이 string[] 인 필드(sampleDialogue · rules) */
export type ListFieldKey = {
  [K in FieldKey]: CharacterSettingFields[K] extends string[] ? K : never
}[FieldKey]

/** 값이 string 인 필드 */
export type TextFieldKey = Exclude<FieldKey, ListFieldKey>

/** 글 필드. 앞뒤 trim 후 코드 포인트로 센다. required 면 1자 이상 */
export type TextFieldSpec = { kind: 'text'; label: string; required: boolean; max: number }

/** 목록 필드(화면은 "한 줄에 하나"). 항목 trim → 빈 항목 제거 → 개수 · 항목 길이 */
export type ListFieldSpec = { kind: 'list'; label: string; maxItems: number; itemMax: number }

/** 공통 세계관 필드 (R-SET-002). 화면 이름은 '세계관' — 탭 이름은 화면 labels 몫 (api.md §15.12 결정 2) */
export const WORLD_FIELD_SPEC: TextFieldSpec = {
  kind: 'text',
  label: '세계관',
  required: true,
  max: 2000,
}

/** 캐릭터 필드 11개의 화면 이름·필수·상한 (R-SET-002 — s3c-02 §2.1 표 그대로) */
export const CHARACTER_FIELD_SPECS: { readonly [K in TextFieldKey]: TextFieldSpec } & {
  readonly [K in ListFieldKey]: ListFieldSpec
} = {
  sourceMaterial: { kind: 'text', label: '원작·장르', required: false, max: 60 },
  age: { kind: 'text', label: '나이', required: false, max: 40 },
  gender: { kind: 'text', label: '성별', required: false, max: 20 },
  role: { kind: 'text', label: '신분·직업', required: false, max: 80 },
  persona: { kind: 'text', label: '성격·배경', required: true, max: 1500 },
  personalityTags: { kind: 'text', label: '성격 태그', required: false, max: 200 },
  appearance: { kind: 'text', label: '외형', required: false, max: 800 },
  relationships: { kind: 'text', label: '관계 메모', required: false, max: 800 },
  speech: { kind: 'text', label: '말투', required: true, max: 800 },
  sampleDialogue: { kind: 'list', label: '샘플 대사', maxItems: 10, itemMax: 200 },
  rules: { kind: 'list', label: '규칙·금기', maxItems: 20, itemMax: 200 },
}

/** 필드 순서 — 검사·폼·파일 직렬화(화이트리스트)가 이 순서를 쓴다. 집합 = CHARACTER_FIELD_SPECS 의 키 (API-T-105) */
export const CHARACTER_FIELD_KEYS = [
  'sourceMaterial',
  'age',
  'gender',
  'role',
  'persona',
  'personalityTags',
  'appearance',
  'relationships',
  'speech',
  'sampleDialogue',
  'rules',
] as const satisfies readonly FieldKey[]

/** 위반 한 건. path 는 필드 위치(['world'] · ['characters', 'ciel', 'speech']). 객체 단위 위반은 그 객체까지 */
export type SettingsIssue = { path: readonly string[]; message: string }

export type SettingsCheckResult =
  | { ok: true; value: CharacterSettings }
  | { ok: false; issue: SettingsIssue }

/** 400 문구 앞머리: 캐릭터면 shortName, 아니면 '공통' */
export const settingsScopeOf = (id?: CharacterId): string =>
  id === undefined ? SETTINGS_COMMON_SCOPE : CHARACTERS[id].shortName

/** 끝 글자 받침이 있으면 '은', 없으면 '는'. 한글 음절이 아니면 '은(는)' */
const withTopic = (word: string): string => {
  const offset = word.charCodeAt(word.length - 1) - 0xac00
  if (!(offset >= 0 && offset <= 11171)) return `${word}은(는)`
  return `${word}${offset % 28 === 0 ? '는' : '은'}`
}

type Checked<T> = { ok: true; value: T } | { ok: false; message: string }
type Failed = { ok: false; issue: SettingsIssue }

const fail = (path: readonly string[], message: string): Failed => ({ ok: false, issue: { path, message } })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasUnknownKey = (obj: Record<string, unknown>, known: readonly string[]): boolean =>
  Object.keys(obj).some(key => !known.includes(key))

const typeMessage = (scope: string, label: string): string =>
  `${scope} · ${label} 값의 형식이 올바르지 않습니다.`

const checkText = (raw: unknown, spec: TextFieldSpec, scope: string): Checked<string> => {
  if (typeof raw !== 'string') return { ok: false, message: typeMessage(scope, spec.label) }
  const value = normalizeText(raw)
  const length = countCodePoints(value)
  if (spec.required && (length < 1 || length > spec.max))
    return { ok: false, message: `${scope} · ${withTopic(spec.label)} 1~${spec.max}자여야 합니다.` }
  if (length > spec.max)
    return { ok: false, message: `${scope} · ${withTopic(spec.label)} ${spec.max}자 이하여야 합니다.` }
  return { ok: true, value }
}

const checkList = (raw: unknown, spec: ListFieldSpec, scope: string): Checked<string[]> => {
  if (!Array.isArray(raw)) return { ok: false, message: typeMessage(scope, spec.label) }
  const items: unknown[] = raw
  if (!items.every((item): item is string => typeof item === 'string'))
    return { ok: false, message: typeMessage(scope, spec.label) }
  const value = items.map(normalizeText).filter(item => item !== '')
  if (value.length > spec.maxItems)
    return { ok: false, message: `${scope} · ${withTopic(spec.label)} ${spec.maxItems}개 이하여야 합니다.` }
  if (value.some(item => countCodePoints(item) > spec.itemMax))
    return { ok: false, message: `${scope} · ${withTopic(spec.label)} 한 줄에 ${spec.itemMax}자 이하여야 합니다.` }
  return { ok: true, value }
}

const checkCharacter = (
  raw: unknown,
  id: CharacterId,
): { ok: true; value: CharacterSettingFields } | Failed => {
  const scope = settingsScopeOf(id)
  const base = ['characters', id]
  if (!isRecord(raw)) return fail(base, `${scope} · 설정 형식이 올바르지 않습니다.`)
  if (hasUnknownKey(raw, CHARACTER_FIELD_KEYS)) return fail(base, `${scope} · 알 수 없는 항목이 있습니다.`)
  const value: Record<string, string | string[]> = {}
  for (const key of CHARACTER_FIELD_KEYS) {
    const spec = CHARACTER_FIELD_SPECS[key]
    const checked = spec.kind === 'text' ? checkText(raw[key], spec, scope) : checkList(raw[key], spec, scope)
    if (!checked.ok) return fail([...base, key], checked.message)
    value[key] = checked.value
  }
  // 키 집합이 CharacterSettingFields 와 같다는 것은 CHARACTER_FIELD_KEYS 의 satisfies 와 API-T-105 가 보장한다
  return { ok: true, value: value as CharacterSettingFields }
}

/**
 * 저장 전 사전 검사 (R-SET-002 · R-SET-005). 서버 400 과 같은 판정·같은 문구(첫 위반 1건, api.md §4.16 표)
 * 순서: 본체 → 본체의 모르는 키 → world → characters → 모르는 캐릭터 → sebastian → ciel
 * 통과하면 정규화 값(앞뒤 trim · 목록 빈 항목 제거)을 돌려준다. 서버 PUT 응답의 settings 와 같다
 */
export const checkCharacterSettings = (value: unknown): SettingsCheckResult => {
  const common = SETTINGS_COMMON_SCOPE
  if (!isRecord(value)) return fail([], `${common} · 설정 형식이 올바르지 않습니다.`)
  if (hasUnknownKey(value, ['world', 'characters'])) return fail([], `${common} · 알 수 없는 항목이 있습니다.`)
  const world = checkText(value.world, WORLD_FIELD_SPEC, common)
  if (!world.ok) return fail(['world'], world.message)
  const characters = value.characters
  if (!isRecord(characters)) return fail(['characters'], `${common} · 캐릭터 설정 형식이 올바르지 않습니다.`)
  if (hasUnknownKey(characters, SETTINGS_CHARACTER_IDS))
    return fail(['characters'], `${common} · 알 수 없는 캐릭터가 있습니다.`)
  const sebastian = checkCharacter(characters.sebastian, 'sebastian')
  if (!sebastian.ok) return sebastian
  const ciel = checkCharacter(characters.ciel, 'ciel')
  if (!ciel.ok) return ciel
  return {
    ok: true,
    value: { world: world.value, characters: { sebastian: sebastian.value, ciel: ciel.value } },
  }
}
```

| 쓰는 곳 | 쓰는 방식 |
|---|---|
| server `settings/schema.ts`(zod) | 상한·필수는 `WORLD_FIELD_SPEC`·`CHARACTER_FIELD_SPECS`에서 읽는다. 상수를 다시 정의하지 않는다. 길이는 `countCodePoints(normalizeText(v))`로 세고 zod `.max()`(UTF-16 단위)를 쓰지 않는다. strict 3단(본체·`characters`·캐릭터), 두 캐릭터·11필드 키 필수 |
| server `settings.put` | 정규화 결과가 `checkCharacterSettings(input).value`와 같아야 한다(같은 함수를 써도 된다). 응답 `settings`가 이 값이다 |
| routes `schemas.ts` | `settingsIssueMessage`가 400 문구를 이 함수의 `issue.message`에서 가져온다(§11.12) |
| ui `state/settings.ts` | 저장 버튼 활성 조건·필드 안내(`issue.path`로 탭·필드를 찾는다), 글자 수 표시(`countCodePoints(normalizeText(v))` / `max`) |
| ui `state/settingsFile.ts` | 내보내기 화이트리스트(`SETTINGS_CHARACTER_IDS`·`CHARACTER_FIELD_KEYS` 순서), 형식 상수, 가져오기 상한·후보 분류(후보·무시·없음)·후보 필드만 검사(저장값 위에 후보를 덮어 이 함수로, §16.2) |

#### 5.8.5 스키마 방식 (S3c 예외)

| 항목 | S1~S3 규칙(§5.6) | E16 |
|---|---|---|
| 스키마 위치 | `server/src/routes/schemas.ts` | 본체 스키마는 server `settings/schema.ts`의 `characterSettingsSchema`(server 소유, s3c-03 §1.3). routes `schemas.ts`는 봉투만 `putCharacterSettingsBody = z.object({ settings: characterSettingsSchema })`로 감싼다(정의 1곳) |
| zod가 보는 것 | 타입만. 길이·범위는 서비스 | **타입 + strict + 필수 + 코드 포인트 상한 + 개수.** server `put`이 "이미 검증된 값"을 받기 때문이다(s3c-03 §1.3) |
| 실패 문구 | 기본 문구 | shared `checkCharacterSettings`의 첫 위반 문구(§4.16 표). zod 문구는 쓰지 않는다 |
| 타입 대조 | `const body: X = c.req.valid('json')` | 같다 — `const body: PutCharacterSettingsBody = c.req.valid('json')`가 zod 출력과 shared 타입을 tsc로 대조한다 |

---

## 6. 레이트리밋·페이지네이션

| 항목 | S1 | 이후 |
|---|---|---|
| 읽기 레이트리밋 | 없음(E2·E3·E7) | 없음 |
| 쓰기 레이트리밋 | 해당 없음 | **S2 확정** — §6.1. (S3) speak·regenerate도 같은 한도 |
| 방 목록 페이지네이션 | 없음(요구 없음) | 요구가 생기면 §13 참고 |
| 히스토리 페이지네이션 | `before` 커서 + `limit`(기본 30, 최대 100), `hasMore`(§4.3) | 변경 없음 |

- 기본·최대 개수(30·100)의 코드 단일 소스는 server 상수 `MESSAGE_PAGE_LIMIT_DEFAULT`·`MESSAGE_PAGE_LIMIT_MAX`다(messages.md §2.1). 화면은 `limit`을 보내지 않고 기본값을 쓰므로 shared로 옮기지 않는다.

### 6.1 쓰기 레이트리밋 (S2 확정 — R-AUTH-005 · R-NFR-003 🔒, server auth.md §2.5)

| 항목 | 값 |
|---|---|
| 단위 | 토큰의 `mb_id` 하나. 같은 사람이 여러 탭·방에서 써도 합산한다 |
| 창 | 고정 1분 창. `windowStart = floor(nowMs / 60000) × 60000` |
| 한도 | 창당 `RATE_LIMIT_PER_MIN`회(기본 **20**, `wrangler.toml [vars]`, 1~600). 1~20번째 통과, **21번째부터 `429`** |
| 대상 | `rateLimitWrites`가 붙은 요청 전부. S2는 E4·E5·E6·E8·E10·E11. S3 speak·regenerate도 같은 한도를 나눠 쓴다 |
| 세는 시점 | `requireToken` 통과 직후, 본문 검증 전. 그래서 `400`·`404`로 끝난 요청도 1회다. 인증 실패(`401`·`403`)는 세지 않는다 |
| S3 카운트 (v0.4) | speak·regenerate도 요청 1건 = 1회. `409 SPEAK_IN_PROGRESS`·`409 NOT_LAST_MESSAGE`·`400 NOT_CHARACTER_MESSAGE`·`500 CONFIG_INVALID`·`502 LLM_FAILED`·`502 LLM_EMPTY`로 끝나도 센다. 근거: ① 세는 시점이 핸들러 전이라 결과를 보고 되돌리는 경로가 없다(S2 규칙 그대로) ② `502`는 이미 제공사 호출을 1~2회 썼다 ③ 실패 뒤 연타가 제공사 할당량을 태우는 것을 분당 한도가 막는다. `401`·`403`은 여전히 세지 않는다 |
| S3b 카운트 (v0.4.1) | `429 LLM_BUDGET_EXCEEDED`로 끝난 speak·regenerate도 1회다. 레이트리밋 미들웨어가 서비스(예산 게이트)보다 먼저 돌아 되돌릴 경로가 없다(S3 규칙 그대로). 분 한도를 넘긴 요청은 예산 상태와 무관하게 `429 RATE_LIMITED`다(미들웨어가 먼저). 예산 초과 중 버튼을 연타하면 `LLM_BUDGET_EXCEEDED`가 이어지다가 `RATE_LIMITED`로 바뀐다 — 두 429는 코드로 구분한다(§3.4) |
| S3c 카운트 (v0.5) | E16(PUT 설정)은 요청 1건 = 1회이고 쓰기 공용 분당 한도를 나눠 쓴다. `rateLimitWrites`가 `requireOwner` **뒤**라 `403 OWNER_ONLY`는 세지 않는다(주인 아닌 회원의 저장 시도가 한도를 태우지 않고, 주인 판정은 설정값만 보는 싼 검사다). 본문 상한·검증 `400`은 센다(S2 규칙 그대로). E15(GET 설정)는 읽기라 세지 않는다 — 주인 판정 탐침이 첫 로드마다 오기 때문이다 |
| 읽기 | 세지 않는다(E2·E3·E7). (v0.5) E15도 세지 않는다 |
| 초과 응답 | `429 RATE_LIMITED`, 본문 `error.retryAfterSec`(정수 ≥ 1) + 헤더 `Retry-After`(같은 값). 핸들러·서비스는 실행되지 않는다 |
| `retryAfterSec` | `max(1, ceil((windowStart + 60000 − nowMs) / 1000))`. 예: 창 시작 후 20초 → `40` |
| 동시성 | D1 조건부 UPSERT 한 문장이라 동시 요청에도 한도를 넘지 않는다 |
| 경계 | 고정 창이라 창 경계를 걸치면 짧은 시간에 최대 2배까지 통과할 수 있다(auth.md D-AUTH-8, 수용) |
| 화면 | 전환 없이 안내만 한다(§2.4). 자동 재시도는 하지 않는다(요구 없음) |

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
| `?t=` (S2) | 서버는 읽지 않는다. 화면 `ui/src/state/token.ts`가 시작 시 한 번 읽어 메모리에 둔다(§2.4). 파라미터 이름 `t`는 저쪽 PHP와의 계약이다 | R-API-003 · R-CHAT-009 · R-TOKEN-001 |

---

## 8. handoff (저쪽 전달물) — **S5 예정**

| 파일 | 내용(요구) | 요구ID |
|---|---|---|
| `doc/handoff/embed-guide.md` | https 임베드 주소 입력 위치(`$rb_chatbot_embed_url`), 패널 390×640 전제, `?t=` 전달 방식, 허용 출처 | R-HANDOFF-001 |
| `doc/handoff/token-snippet.php.md` | R-TOKEN-001 PHP 조각 전문, 붙이는 위치, LEVEL 바꾸는 법 | R-HANDOFF-002 · R-TOKEN-001 |
| `doc/handoff/secret-handover.md` | SECRET 생성(32자 이상 랜덤)·전달 경로·양쪽 입력 위치·교체 절차. 실값 없음 | R-HANDOFF-003 |

- 저쪽 재적용이 필요한 변경: 토큰 payload 필드·서명 방식·`?t=` 파라미터 이름·임베드 주소. 이런 변경은 파괴 변경이며 §9에 "저쪽 재적용 필요"로 남긴다.
- S1 변경은 handoff에 영향이 없다.
- (v0.3) 토큰 형식·payload·`?t=` 이름이 §2.3·§2.5에서 확정됐다. `token-snippet.php.md`는 그 절을 그대로 따른다(§2.6). 아직 저쪽에 전달한 것이 없으므로 재적용 대상도 없다.
- (v0.4.1, S3b — R-LLM-007) S5에서 handoff에 **AI 비용 상한 안내** 한 단락을 넣는다(위치는 `embed-guide.md` 운영 메모 절 예정, S5에서 확정). 원문은 llm.md 「contract 인계」 S3b 절의 handoff 메모다. 요지: ① 한도는 토큰 수 × 공개 단가 × 환율로 낸 **추정**이며 실제 청구와 다를 수 있다(단가 변경·환율·캐시 할인·무료 등급·부가세 미반영). ② 키를 발급한 Google 계정의 Cloud Billing에서 **월 10만원 예산 알림**을 따로 설정하기를 권고한다. 예산 알림은 메일만 보내고 사용을 막지 않는다. ③ 한도·단가·환율은 `wrangler.toml [vars]`의 `LLM_MONTHLY_BUDGET_KRW`·`LLM_PRICE_INPUT_USD_PER_M`·`LLM_PRICE_OUTPUT_USD_PER_M`·`KRW_PER_USD`를 고쳐 재배포하면 바뀐다(비밀값 아님). ④ 현황은 `wrangler tail`의 `llm_usage` 로그와 D1 `llm_usage` 테이블 조회로 본다. 토큰·`?t=`·임베드 주소가 그대로라 저쪽 재적용은 없다.
- (v0.5, S3c) **handoff 변경 없음**(토큰 형식·PHP 조각 불변). S5 TODO 2건: ① `embed-guide.md`에 "갠홈 iframe에 `sandbox` 속성을 쓰면 `allow-downloads`를 넣어야 설정 화면 「파일로 저장」이 된다(없어도 복사로 내보낼 수 있다)" 한 줄. ② 갠홈 주인 회원 ID(`OWNER_MB_IDS`)를 지인에게 받는 절차는 server 셋팅 절차 몫이다. handoff·이 문서에는 실제 회원 ID를 쓰지 않는다.

---

## 9. 변경 이력

| 버전 | 일자 | 변경 | 호환성 | 저쪽 재적용 |
|---|---|---|---|---|
| v0.1 | 2026-10-05 | 최초 작성(S1). 전체 엔드포인트 표, 에러 코드 13종, S1 엔드포인트 4종 상세, shared 4파일·routes·ui/api 설계 | 추가(신규) | 아니오 |
| v0.2 | 2026-10-05 | §15.4 결정 반영. `CharacterMeta.shortName` 추가(R-LLM-002 개정). S1 화면은 항상 읽기 전용이고 R-CHAT-009는 S2로 이동. 토큰 보관은 `ui/src/state/token.ts`, `client.ts`는 getter 주입(S2 상세 예정). 방 목록 배열 응답과 §10 위치는 유지 | 추가(구현 전이라 영향 없음) | 아니오 |
| v0.2.1 | 2026-10-05 | 구현 완료(S1 routes·ui/api). `MessagesQuery`의 `before?`·`limit?`에 `undefined` 유니온 추가(exactOptionalPropertyTypes 대응). routes 는 서비스 `MessagePageQuery`가 undefined 값을 못 받아 `toPageQuery`로 키를 뺀다 | 비파괴(타입 완화) | 아니오 |
| v0.3 | 2026-10-05 | S2 상세 확정. §2 토큰(전달·형식·`TokenPayload`·검증 순서·화면 보관·읽기 전용 전환·교차 벡터 V1~V8·handoff 참조), §4.5 쓰기 공통, §4.6~§4.11 E4·E5·E6·E8·E10·E11, §6.1 레이트리밋, shared 본문 타입 4개·`ApiErrorBody.error.retryAfterSec?`·`PATHS.room/roomUser/message`, `204` 정규화, ui/api `configureClient`·`isAuthFailure`·쓰기 래퍼 6개, §14.5~§14.7 테스트 | 추가(기존 엔드포인트·타입·필드 변경 없음. `retryAfterSec`는 선택 필드 추가 = 비파괴) | 아니오(handoff 미전달) |
| v0.3.1 | 2026-10-05 | ui-designer 요청(메인 세션 승인). `shared/src/limits.ts` 신규: `ROOM_TITLE_MAX`·`MESSAGE_TEXT_MAX`·`MEMORY_SUMMARY_MAX`·`countCodePoints`·`normalizeText`(§5.7). 서버 서비스와 화면이 같은 길이 규칙을 import. §12.1 행, §13.1 행, API-T-046, S2-R4 | 추가(새 파일, 기존 export 변경 없음) | 아니오 |
| v0.3.1 구현 | 2026-10-05 | S2 구현 완료(routes 쓰기 6종 · ui/api 쓰기 래퍼 6종 · `configureClient` · `isAuthFailure` · `retryAfterSec`). 테스트 API-T-050~066 · API-T-UI-011~018. 계약 내용 변경 없음 | 변경 없음 | 아니오 |
| v0.4 | 2026-10-06 | S3 상세 확정. §4.12 생성 공통(70초 상한·화면 타임아웃 없음/두면 75초 이상·잠금·레이트리밋 카운트), §4.13 E9 speak, §4.14 E12 regenerate, §3.2 S3 5코드 문구 확정(v0.1 문구 유지), `SpeakBody`·`PATHS.roomSpeak/messageRegenerate`·`endpoints` 빌더 2개, routes `speakBody`·`messages.ts` 핸들러 2개, ui/api `speak`·`regenerate`, §12.2·§13.2·§14.9~§14.11·§15.8~§15.10, 「ui 인계 메모」 | 추가(기존 엔드포인트·타입·필드·에러 코드 변경 없음) | 아니오 |
| v0.4.1 | 2026-10-06 | S3b 상세 확정(R-LLM-007 🔒 · R-API-002 개정 13→14종). §3.2 14종째 `LLM_BUDGET_EXCEEDED`(429, 요구 원문 문구, E9·E12만), §3.1·§3.4 `retryAfterSec` 대상 429 두 코드·429 두 종류 구분(ui/api는 `RATE_LIMITED`에만 싣는 현 동작 유지), §3.5, §4.12 월 비용 상한 행·공통 에러, §4.13 판정 4b·§4.14 판정 5b, §5.2 주석·§5.3 errors.ts 3곳, §6.1 S3b 카운트, §8 handoff 메모 예정, §11.11·§12.3·§13.3·§14.12·§14.13·§15.11, 「ui 인계 메모」 S3b, 「contract-implementer 인계 목록」. 엔드포인트·타입·경로 추가 없음 | 추가(에러 코드 1개 추가 = 비파괴. 옛 화면 번들은 §3.4대로 `INTERNAL`로 정규화) | 아니오 |
| v0.4.1 구현 | 2026-10-06 | S3b 구현 완료. shared `errors.ts` 14종, routes·ui/api 소스 변경 없음(재사용), 테스트 API-T-040(갱신)·048·085~090·API-T-UI-022·023, `expectContractError` 두 벌 코드별 `retryAfterSec`(40 / 1356400). 계약 내용 변경 없음 | 변경 없음 | 아니오 |
| v0.5 | 2026-10-06 | S3c 상세 확정(R-SET-001~012 중 contract 몫 · R-API-001 개정 14→16개 · R-API-002 개정 14→15종 · R-AUTH-003 개정). §2.7 설정 엔드포인트 예외·주인 판정, §2.1·§2.4 행, §3.2 15종째 `OWNER_ONLY` 403, §3.1·§3.4 정규화, §4.0 E15·E16, §4.15 GET·§4.16 PUT(본문 128KB·400 첫 위반 문구 규칙·판정 순서), §5.8 타입 4종·errors·endpoints 추가분·`shared/src/settings.ts` 전문·스키마 예외, §6.1 S3c 카운트, §8 S5 TODO, §11.12~§11.14, §12.4, §13.4, §14.14~§14.16, §15.12, §16 파일 형식·가져오기 매핑·비밀값 규칙, 인계 2종 | 추가(엔드포인트 2·에러 코드 1·타입 4·경로 1·shared 파일 1. 기존 요청·응답·status·문구 불변. `validate`·`request` 선택 인자 확장은 내부) | 아니오 |
| v0.5 보정 | 2026-10-06 | server `settings.md`·`auth.md` §12·`env.md` S3c·`db.md` §7.6 대조(시그니처·정규화·에러 매핑 불일치 0건). 메인 세션 결정 5건 반영: `WORLD_FIELD_SPEC.label` `'공통 세계관'` → `'세계관'`(400 문구 `공통 · 세계관은 …`), 나머지 4건 승인 확정. §4.16 본문 상한 설명 보정, §14.14·§14.15 문구 기대값, §15.12 대조 결과·결정 표·남은 불일치(settings.md 쪽 M1~M6), 「ui 인계 메모」 S3c 라벨 행 | 비파괴(구현 전 라벨·문구 변경, 이름 변경 없음) | 아니오 |
| v0.5 보정 2 | 2026-10-06 | ui-design-checker 지적 2건 반영(메인 세션 결정). ① "무시한 항목" = 출처에 값이 있으나 형이 달라 쓸 수 없는 위치만, 출처에 없는 키·매핑 없는 필드·`null`·E.No.S 빈 값은 "없음", 계수는 후보 만들기 한 곳(§16.2 분류 표·§16.3). ② 가져오기는 파일이 준 후보 필드만 검사(저장값 위에 후보를 덮어 `checkCharacterSettings`), 초안 전체 검사는 저장 버튼 활성 조건에서만(§16.2). §16.3 가져오기 단위 테스트 기대값 6행 추가, §5.8.4 쓰는 곳 표·§10 R-SET-008 행·§15.12 결정 6·7 | 비파괴(구현 전 화면 규칙 보정. API·shared 이름·서버 영향 없음) | 아니오 |
| v0.5 구현 | 2026-10-06 | S3c 구현 완료(routes E15·E16 · `validate` `toMessage` · ui/api `getCharacterSettings`·`saveCharacterSettings` · `client` `'PUT'`). 테스트 API-T-091~103 · API-T-UI-024~027. 계약 내용 변경 없음 | 변경 없음 | 아니오 |

---

## 10. 요구 추적표

| 요구ID | 계약 항목 | 절 | 판정 | 호환성 | 테스트ID | 상태 |
|---|---|---|---|---|---|---|
| R-API-001 🔒 | 엔드포인트 집합 14행, `PATHS`, 단건 방 조회 없음, 미등록 메서드 404 | §4.0 · §3.5 · §5.4 · §12 | 신규(S2·S3 확장) | 추가 | API-T-013 · 042 · 045 · 047 · 084 | S1~S3 행 확정, S4 행 예정 |
| R-API-002 🔒 | `{ error: { code, message } }`, 13종 status·문구, (S2) `RATE_LIMITED`만 `retryAfterSec` 추가 | §3 · §5.2 · §5.3 | 신규(S2 확장) | 추가 | API-T-040 · 041 · 054, 모든 에러 테스트의 `expectContractError`, API-T-UI-002·004·005·014 | 확정 |
| R-API-003 🔒 | Bearer 헤더만, `?t=` → `state/token.ts` 메모리, `configureClient` getter 주입, 쓰기 래퍼만 헤더 부착 | §2.2 · §2.4 · §11.6 | 신규 | 추가 | API-T-051, API-T-UI-011 · 012 · 013 · 018 | 확정(S2) |
| R-API-004 | camelCase · epoch ms · id 타입 · zod 검증 · `400 VALIDATION_ERROR` | §5.1 · §5.6 · §4.3 | 신규 | 추가 | API-T-011 · 023 · 030 ~ 032 | 확정 |
| R-API-005 | `GET /api/health` `{ ok: true, version }`, DB 미접근 | §4.1 | 신규 | 추가 | API-T-001 · 002 | 확정 |
| R-API-006 🔒 | `/embed` 정적 서빙, 모든 응답 CSP, `X-Frame-Options` 없음 | §4.4 · §7 | 신규 | 추가 | API-T-004 · 005, SRV-T-080 · 086 | 확정 |
| R-API-007 | 라우트 30줄 이내, 검증 → 서비스 → 응답 | §1.2 · §11.1 | 신규 | 추가 | 리뷰(§14.4) | 확정 |
| R-API-008 🔒 | shared 공유, 경로 리터럴 중복 0 | §5.4 · §11 · §12 | 신규 | 추가 | API-T-042 · 044 | 확정 |
| R-ROOM-001 🔒 | `GET /api/rooms` → `RoomSummary[]` 정렬 보장 | §4.2 · §5.2 | 신규 | 추가 | API-T-010 · 011 · 014 | 확정 |
| R-MSG-001 🔒 | `GET …/messages?before&limit` → `MessagesPage` | §4.3 · §5.2 | 신규 | 추가 | API-T-020 ~ 024 · 030 ~ 034, API-T-UI-008 | 확정 |
| R-AUTH-003 🔒 | 읽기 경로 토큰 불필요·헤더 무시, 쓰기 6개 전건 `requireToken`(라우트 단위), 없으면 `401 TOKEN_REQUIRED` | §2.1 · §2.2 · §4.5 · §11.5 | 신규 | 추가 | API-T-012 · 024 · 050 · 051 · 056 | 확정(S1 읽기 · S2 쓰기) |
| R-AUTH-001 🔒 | 형식·`TokenPayload`·서명 입력 = JSON 바이트·base64url 무패딩, 교차 벡터 V1~V8 | §2.3 · §2.5 | 신규 | 추가 | server SRV-T-100~108, API-T-052 · 061 | 확정(S2) |
| R-AUTH-002 🔒 | 검증 순서 서명 → exp → level, `401 TOKEN_INVALID` / `403 LEVEL_TOO_LOW`, 단계 무관 기본 문구 | §2.3 · §4.5 | 신규 | 추가 | API-T-052 · 053, server SRV-T-103~107 | 확정(S2) |
| R-AUTH-004 (확인 필요 §9-2) | `authorName` = `ch_name` 있으면 `ch_name`, 없으면 `nick` | §2.3 · §4.9 | 신규 | 추가 | API-T-061 | 확정(기본값) |
| R-AUTH-005 (확인 필요 §9-6) | `mb_id` 분 창 20회, `429` + `retryAfterSec` + `Retry-After` | §3.1 · §4.5 · §6.1 | 신규 | 추가 | API-T-054 · 055 · 056, API-T-UI-014 | 확정(기본값) |
| R-AUTH-006 🔒 | 응답에 토큰·payload·`mb_id` 없음, 화면이 토큰을 로그·저장소에 남기지 않음 | §2.3 · §2.4 · §4.5 | 신규 | 추가 | API-T-061(키 대조), API-T-UI-018, server SRV-T-120 | 확정(S2) |
| R-TOKEN-001 🔒 (contract 몫) | handoff가 따를 형식·플래그·벡터, `?t=` 이름 | §2.5 · §2.6 · §8 | 신규 | 추가 | S5 PHP 대조(V1·V7) | 계약 확정, PHP 조각은 S5 |
| R-ROOM-002 🔒 | `POST /api/rooms` `CreateRoomBody` → `201 RoomSummary`, 0·61자 `400` | §4.6 · §5.2 | 신규 | 추가 | API-T-057 · 058 | 확정(S2) |
| R-ROOM-003 🔒 (확인 필요 §9-5) | `PATCH /api/rooms/:id` → `200 RoomSummary`, `updatedAt` 유지, 누구나 | §4.7 | 신규 | 추가 | API-T-059 · 066 | 확정(기본값) |
| R-ROOM-004 🔒 (확인 필요 §9-5) | `DELETE /api/rooms/:id` → `204`, 연쇄 실삭제, 이후 `404`, 누구나 | §4.8 | 신규 | 추가 | API-T-060 · 066 | 확정(기본값) |
| R-MSG-002 🔒 | `POST /api/rooms/:id/user` `UserMessageBody` → `201 Message`, AI 호출 없음 | §4.9 · §5.2 | 신규 | 추가 | API-T-061 · 062, server SRV-T-145 | 확정(S2) |
| R-MSG-004 🔒 | `PATCH /api/messages/:id` `EditMessageBody` → `200 Message` | §4.10 · §5.2 | 신규 | 추가 | API-T-063 · 064 | 확정(S2) |
| R-MSG-005 🔒 | `DELETE /api/messages/:id` → `204` | §4.11 | 신규 | 추가 | API-T-064 · 065 | 확정(S2) |
| R-ROOM-002 · R-MSG-002 · R-MSG-004 · R-MEM-001 (길이 규칙, v0.3.1) | 상한 60·2000·4000, trim 후 코드 포인트 세기를 `@shared/limits` 한 곳에 | §5.7 | 신규 | 추가 | API-T-046 · 058 · 062 | 확정(MEMORY는 S4에서 사용) |
| R-MSG-008 (확인 필요) | 수정·삭제 작성자 제한 없음 | §4.5 · §4.10 · §4.11 | 신규 | 추가 | API-T-066 | 확정(기본값) |
| R-ROOM-005 | 발화 저장·수정·삭제 시 방 `updatedAt` 갱신, 이름 변경은 유지 | §4.7 · §4.9 ~ §4.11 | 신규 | 추가 | API-T-059 · 061 · 063 · 065 | 확정(S2 경로) |
| R-NFR-003 🔒 (레이트리밋 몫) | 초과 `429` | §6.1 | 신규 | 추가 | API-T-054, server SRV-T-114 | 확정(S2 429 · S3 409 — 아래 S3 행) |
| R-ROOMS-002 🔒 | 「+ 새 방」이 쓰는 `createRoom`, 토큰 있을 때만 | §2.4 · §4.6 · §11.6 | 신규 | 추가 | API-T-UI-011, 화면 TC | 계약 확정 |
| R-CHAT-004 🔒 · R-CHAT-006 🔒 | 하단 바 전송이 쓰는 `appendUser`(OOC 토글 = `ooc`), AI 미호출 | §4.9 · §11.6 | 신규 | 추가 | API-T-UI-011, 화면 TC | 계약 확정 |
| R-CHAT-007 🔒 (수정·삭제) | 말풍선 메뉴가 쓰는 `editMessage`·`deleteMessage` | §4.10 · §4.11 · §11.6 | 신규 | 추가 | API-T-UI-011 · 015, 화면 TC | 계약 확정(재작성은 아래 S3 행) |
| R-CHAT-001 🔒 (⋯ 메뉴) | 이름 변경·방 삭제가 쓰는 `renameRoom`·`deleteRoom` | §4.7 · §4.8 · §11.6 | 신규 | 추가 | API-T-UI-011 · 015, 화면 TC | 계약 확정(장기기억은 S4) |
| R-CHAT-009 🔒 | `?t=` 1회 읽기, 메모리만, 쓰기 헤더 부착 | §2.4 · §11.6 | 신규 | 추가 | API-T-UI-011 · 018 | 계약 확정 |
| R-CHAT-011 | 인증 실패 3코드 → 읽기 전용 전환(`isAuthFailure`), `RATE_LIMITED` 안내·`retryAfterSec` | §2.4 · §3.4 · §11.6 | 신규 | 추가 | API-T-UI-014 · 016, 화면 TC | 계약 확정 |
| R-ENV-003 | 모든 경로 `500 CONFIG_INVALID` | §3.2 · §4.1 | 신규 | 추가 | API-T-003 | 확정 |
| R-LLM-002 🔒 (표시 메타, 2026-10-05 개정) | `CHARACTERS`(id·name·shortName·avatar) | §5.5 | 신규 | 추가 | API-T-043 | 확정 |
| R-CHAT-002 🔒 | 말풍선이 쓰는 `speaker`·`kind`·`authorName`·`createdAt`, 캐릭터 메타 | §5.2 · §5.5 | 신규 | 추가 | 화면 TC | 계약 확정 |
| R-CHAT-003 🔒 | 위로 스크롤 시 `before` 페이지, `hasMore` | §4.3 | 신규 | 추가 | API-T-021, 화면 TC | 계약 확정 |
| R-ROOMS-001 🔒 | 방 목록 데이터 | §4.2 | 신규 | 추가 | 화면 TC | 계약 확정 |
| R-NFR-004 🔒 | 응답·로그에 토큰 없음(`?t=` 미기록), 에러 본문에 내부 정보 없음 | §3.1 · §4.4 | 신규 | 추가 | API-T-014, SRV-T-083 · 088 | 확정 |
| R-MSG-003 🔒 (S3) | `POST /api/rooms/:id/speak` `SpeakBody` → `201 Message`(`speaker = character`, `kind 'line'`, `authorName null`), 직전 발화자 무관 | §4.13 · §5.2 · §5.4 | 신규 | 추가 | API-T-070 · 071 · 072 · 073, API-T-UI-019 | 확정(S3, 구현 전) |
| R-MSG-006 🔒 (S3) | `POST /api/messages/:id/regenerate` 본문 없음 → `200 Message`(`text`만 교체), `400 NOT_CHARACTER_MESSAGE` · `409 NOT_LAST_MESSAGE` · `404` | §4.14 · §5.4 | 신규 | 추가 | API-T-078 ~ 083, API-T-UI-019 | 확정(S3, 구현 전) |
| R-MSG-007 🔒 (S3) | 방당 1건, speak·regenerate 같은 잠금, `409 SPEAK_IN_PROGRESS`, 우선순위(잠금 → 마지막 판정) | §4.12 · §4.13 · §4.14 | 신규 | 추가 | API-T-075, server SRV-T-196 · 199 · 207 | 확정(S3) |
| R-NFR-001 🔒 (S3) | 서버 70초 종결, 화면 요청 타임아웃 없음(두면 75초 이상) | §3.4 · §4.12 · §11.9 | 신규 | 추가 | server SRV-T-208, API-T-UI-021 | 확정(S3) |
| R-NFR-003 🔒 (S3 409 몫) | 동시 생성 `409`, 실패한 생성도 레이트리밋 1회 | §4.12 · §6.1 | 확장 | 추가 | API-T-075 · 077, server SRV-T-199 | 확정(S3) |
| R-LLM-002 🔒 (S3 응답 쪽) | 생성 응답 `speaker`는 `CharacterId`, 표시 메타는 화면이 `CHARACTERS[speaker]`(shared). 조회 엔드포인트 없음 | §4.12 · §5.5 | 확장 | 추가 | API-T-070 · 043 | 확정(S3) |
| R-LLM-004 🔒 | 후처리된 `text`(최대 2000자), 빈 결과 `502 LLM_EMPTY` | §3.2 · §4.12 | 신규 | 추가 | API-T-076, server SRV-T-172 · 198 | 확정(S3) |
| R-LLM-005 🔒 | 최종 실패 `502 LLM_FAILED`, 응답은 기본 문구만(제공사 정보 없음), 저장 없음 | §3.2 · §4.12 | 신규 | 추가 | API-T-076 · 083 | 확정(S3) |
| R-API-002 🔒 (S3) | 13종 안 5코드(`SPEAK_IN_PROGRESS`·`NOT_LAST_MESSAGE`·`NOT_CHARACTER_MESSAGE`·`LLM_FAILED`·`LLM_EMPTY`) + `CONFIG_INVALID`, 형식 `{ error: { code, message } }`, 문구 확정 | §3.2 · §4.12 ~ §4.14 | 확장 | 추가 | API-T-072 ~ 083의 `expectContractError`, API-T-UI-020 | 확정(S3) |
| R-ROOM-005 (S3) | speak 저장·regenerate 교체 시 방 `updatedAt` 갱신, 실패 시 불변 | §4.13 · §4.14 | 확장 | 추가 | API-T-070 · 076 · 078 · 083 | 확정(S3) |
| R-ENV-003 (S3) | 키 없음 → speak·regenerate만 `500 CONFIG_INVALID` | §4.12 | 확장 | 추가 | API-T-073 · 074 · 081 | 확정(S3) |
| R-CHAT-005 🔒 | 캐릭터 버튼이 쓰는 `speak`, 「재시도」는 같은 호출, 소요 최대 70초 | §4.13 · §11.9 · 「ui 인계 메모」 | 신규 | 추가 | API-T-UI-019 · 020, 화면 TC | 계약 확정(S3) |
| R-CHAT-007 🔒 (재작성) | 메뉴 재작성이 쓰는 `regenerate`, 표시 조건(캐릭터·마지막)과 `409 NOT_LAST_MESSAGE`의 관계 | §4.14 · 「ui 인계 메모」 | 신규 | 추가 | API-T-UI-019, 화면 TC | 계약 확정(S3) |
| R-CHAT-011 (S3) | `SPEAK_IN_PROGRESS`(생성 중)·`LLM_FAILED`·`LLM_EMPTY`(재시도)·`CONFIG_INVALID`(관리자) 안내의 근거 코드. 생성 실패 코드는 읽기 전용 전환 대상 아님 | §2.4 · §4.12 · 「ui 인계 메모」 | 확장 | 추가 | API-T-UI-020, 화면 TC | 계약 확정(S3) |
| R-API-002 🔒 (S3b 개정, 14종) | 14종째 `LLM_BUDGET_EXCEEDED` 429·요구 원문 문구, `retryAfterSec`가 붙는 코드는 429 두 개 | §3.1 · §3.2 · §3.4 · §5.2 · §5.3 | 확장 | 추가 | API-T-040(갱신) · 048 · 085, API-T-UI-022 · 023 | 확정(S3b) |
| R-LLM-007 🔒 | E9·E12만 키 확인 다음·잠금·제공사 호출 전 `429 LLM_BUDGET_EXCEEDED`, `retryAfterSec` = 다음 달 1일 00:00 KST까지, 다른 엔드포인트 영향 없음, 조회 엔드포인트·health 노출 없음, handoff 추정 안내 | §3.2 · §4.12 · §4.13 · §4.14 · §8 | 확장 | 추가 | API-T-085 ~ 088 · 090, server SRV-T-210~233 | 확정(S3b) |
| R-NFR-003 🔒 (S3b 몫) | 예산 거절도 레이트리밋 1회, 분 한도 초과가 먼저 | §6.1 | 확장 | 추가 | API-T-089 | 확정(S3b) |
| R-CHAT-011 (S3b) | `LLM_BUDGET_EXCEEDED` 안내의 근거 코드, `RATE_LIMITED`와 코드로 구분, 카운트다운·자동 재시도 없음, 읽기 전용 전환 대상 아님 | §2.4 · §3.4 · 「ui 인계 메모」 | 확장 | 추가 | API-T-UI-022 · 023, 화면 TC | 계약 확정(S3b) |
| R-SET-001 🔒 (S3c) | 주인 = 토큰 통과 + `mbId ∈ OWNER_MB_IDS`(지인 ID만), 아니면 `403 OWNER_ONLY`, 빈 목록 전원 403, 등급 검사가 먼저 | §2.7 · §3.2 · §4.15 · §4.16 | 신규 | 추가 | API-T-091 · 092 · 093 · 049 | 계약 확정(S3c) |
| R-SET-002 🔒 (S3c) | 본체 타입(`world` + 2명 × 11필드), strict, trim·코드 포인트 상한·필수 3종·목록 개수, 화면 이름·상한 단일 소스 `settings.ts` | §4.16 · §5.8 | 신규 | 추가 | API-T-096 · 097 · 098 · 105 · 106 · 107 | 계약 확정(S3c) |
| R-SET-003 🔒 (contract 몫) | 응답 `version`·`updatedAt`·`isDefault`(시드 = 0·null·true), 저장 뒤 다음 생성 반영은 부수 효과로 명시 | §4.15 · §4.16 · §5.8 | 신규 | 추가 | API-T-094 · 095 | 계약 확정(S3c) |
| R-SET-004 🔒 | E15 GET, 토큰·주인 필수, `CharacterSettingsResponse`, 레이트리밋 없음 | §4.0 · §4.15 · §11.12 · §11.13 · §12.4 | 신규 | 추가 | API-T-091 ~ 094 · 102 · 103 · 104, API-T-UI-024 · 026 · 027 | 계약 확정(S3c) |
| R-SET-005 🔒 | E16 PUT 전체 교체, 정규화 값 반환, 레이트리밋 1회, 본문 128KB, 400 첫 위반 1건 문구 규칙 | §4.0 · §4.16 · §5.8 · §6.1 · §11.12 · §11.13 | 신규 | 추가 | API-T-095 ~ 103, API-T-UI-025 · 026 | 계약 확정(S3c) |
| R-SET-007 🔒 (contract 몫) | 내보내기 파일 형식(`format`·`formatVersion`·`exportedAt`·`settings`), 화이트리스트, 금지 문자열 | §5.8 · §16.1 · §16.4 | 신규 | 추가 | ui 단위(`toExportFile`) · API-T-105 | 계약 확정(S3c, 구현은 ui) |
| R-SET-008 (contract 몫) | 가져오기 판별·E.No.S 매핑표·5MB·읽지 않는 키·후보 분류(무시 = 값은 있으나 형이 다른 위치만)·후보 필드만 상한 검사, 서버 strict가 마지막 방어 | §16.2 · §16.3 · §16.4 · §4.16 | 신규 | 추가 | ui 단위(`parseImportFile` 벡터 5종) · API-T-096 | 계약 확정(S3c, 구현은 ui) |
| R-SET-010 (contract 몫) | 주인 여부는 E15 status로만, `OWNER_ONLY`는 `isAuthFailure` 밖, 탐침 결과로 전환하지 않음 | §2.4 · §2.7 · §3.2 | 신규 | 추가 | API-T-UI-026, 화면 TC | 계약 확정(S3c) |
| R-API-001 🔒 (S3c 개정) | 엔드포인트 16개, `PATHS.characterSettings`, 미등록 메서드 404 | §4.0 · §5.8 · §12.4 | 확장 | 추가 | API-T-042(갱신) · 103 · 104 | 계약 확정(S3c) |
| R-API-002 🔒 (S3c 개정, 15종) | 15종째 `OWNER_ONLY` 403·문구, 순서 `CONFIG_INVALID` 다음 | §3.2 · §5.8 | 확장 | 추가 | API-T-040(갱신) · 049 · 093 | 계약 확정(S3c) |
| R-AUTH-003 🔒 (S3c 개정) | 설정 GET도 토큰 필요(예외), 두 엔드포인트 라우트 단위 미들웨어 | §2.1 · §2.7 · §4.15 · §11.12 | 확장 | 추가 | API-T-091 | 계약 확정(S3c) |
| R-AUTH-005 (S3c) | E16도 쓰기 공용 분당 한도, `OWNER_ONLY`는 세지 않음, E15는 세지 않음 | §6.1 · §4.16 | 확장 | 추가 | API-T-093 · 102 | 계약 확정(S3c) |
| R-AUTH-006 🔒 (S3c) | 설정 응답·403 본문에 `mbId`·주인 목록·토큰 없음 | §2.7 · §4.15 | 확장 | 추가 | API-T-093 · 094 | 계약 확정(S3c) |
| R-API-003 🔒 · R-API-004 · R-API-007 · R-API-008 (S3c) | 설정 래퍼도 Bearer 헤더만 · camelCase·epoch ms·`null` · 라우트 30줄 이내 · 경로 리터럴은 `endpoints.ts`만 | §2.7 · §5.8 · §11.12 · §11.13 | 확장 | 추가 | API-T-UI-024 · 027, 리뷰 grep(§14.16) | 계약 확정(S3c) |

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
// TODO(R-API-003): S2 상세 예정 — 토큰은 ui/src/state/token.ts 가 보관한다. client.ts 는 getter 를 주입받아
//   쓰기 요청에 Authorization: Bearer 헤더만 붙인다(토큰을 직접 읽거나 저장하지 않는다)

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

### 11.5 S2 routes 설계 (`server/src/routes/`)

| 파일 | S2 변경 | 크기(예상) |
|---|---|---|
| `schemas.ts` | `messageIdParam` · `roomTitleBody` · `userMessageBody` · `editMessageBody` 추가 | ~45줄 |
| `rooms.ts` | POST(E4) · PATCH(E5) · DELETE(E6) 추가 | ~45줄 |
| `messages.ts` | POST user(E8) · PATCH(E10) · DELETE(E11) 추가 | ~65줄 |
| `index.ts` · `validate.ts` · `health.ts` | 변경 없음 | — |

규약(server auth.md §9.1, index.md §9.1):

- 쓰기 핸들러마다 `requireToken, rateLimitWrites`를 `validate`보다 **앞에** 붙인다. 둘은 `server/src/auth`에서 import한다. 전역·`apiRoutes.use()` 금지.
- principal은 `getPrincipal(c)`로만 읽는다(`c.get('principal')` 직접 읽기·`!` 단언 금지). S2에서 principal을 넘기는 곳은 E8 하나다.
- `services.auth`·`Authorization` 헤더·`?t=`·쿠키를 라우트가 직접 다루지 않는다. `Retry-After` 헤더도 만들지 않는다(onError 몫).
- `204`는 `c.body(null, 204)`로 답한다. CSP는 진입점 미들웨어가 붙인다.

```ts
// server/src/routes/schemas.ts — S2 추가분 (S1 내용은 그대로)
/** 10진 숫자만 Number(), 그 밖은 NaN. 범위 판정·NOT_FOUND 는 서비스 isMessageId (api.md §4.5) */
const toMessageId = (raw: string): number => (/^[0-9]+$/.test(raw) ? Number(raw) : Number.NaN)

/** 경로 :id — 메시지 id */
export const messageIdParam = z.object({ id: z.string().transform(toMessageId) })

/** POST /api/rooms · PATCH /api/rooms/:id 본문. 타입만 — trim·1~60자는 rooms.normalizeTitle */
export const roomTitleBody = z.object({ title: z.string() })

/** POST /api/rooms/:id/user 본문. ooc 필수 — trim·1~2000자는 messages.normalizeMessageText */
export const userMessageBody = z.object({ text: z.string(), ooc: z.boolean() })

/** PATCH /api/messages/:id 본문 */
export const editMessageBody = z.object({ text: z.string() })
```

```ts
// server/src/routes/rooms.ts — S2 전문
import { PATHS } from '@shared/endpoints'
import type { CreateRoomBody, RenameRoomBody, RoomSummary } from '@shared/types'
import { Hono } from 'hono'
import { rateLimitWrites, requireToken } from '../auth'
import type { AppEnv } from '../services'
import { roomIdParam, roomTitleBody } from './schemas'
import { validate } from './validate'

export const roomsRoutes = new Hono<AppEnv>()
  /// [계약] api.md §4.2 · [요구] R-ROOM-001 · R-AUTH-003(읽기 토큰 불필요) · [에러] CONFIG_INVALID · INTERNAL · [부수효과] 없음
  .get(PATHS.rooms, async c => {
    const rooms: RoomSummary[] = await c.get('services').rooms.listRooms()
    return c.json(rooms, 200)
  })
  /// [계약] api.md §4.6 · [요구] R-ROOM-002 · R-AUTH-003·005 · [에러] §4.5 공통 + VALIDATION_ERROR(제목) · [부수효과] rooms 1행 · 레이트리밋 1회
  .post(PATHS.rooms, requireToken, rateLimitWrites, validate('json', roomTitleBody), async c => {
    const body: CreateRoomBody = c.req.valid('json')
    const room: RoomSummary = await c.get('services').rooms.createRoom(body)
    return c.json(room, 201)
  })
  /// [계약] api.md §4.7 · [요구] R-ROOM-003 · [에러] §4.5 공통 + VALIDATION_ERROR · NOT_FOUND · [부수효과] title 갱신(updatedAt 유지) · 레이트리밋 1회
  .patch(
    PATHS.room,
    requireToken,
    rateLimitWrites,
    validate('param', roomIdParam),
    validate('json', roomTitleBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: RenameRoomBody = c.req.valid('json')
      const room: RoomSummary = await c.get('services').rooms.renameRoom(id, body)
      return c.json(room, 200)
    },
  )
  /// [계약] api.md §4.8 · [요구] R-ROOM-004 · R-DB-003 · [에러] §4.5 공통 + NOT_FOUND · [부수효과] memory·messages·rooms 실삭제 · 레이트리밋 1회
  .delete(PATHS.room, requireToken, rateLimitWrites, validate('param', roomIdParam), async c => {
    const { id } = c.req.valid('param')
    await c.get('services').rooms.deleteRoom(id)
    return c.body(null, 204)
  })
```

```ts
// server/src/routes/messages.ts — S2 전문
import { PATHS } from '@shared/endpoints'
import type { EditMessageBody, Message, MessagesPage, MessagesQuery, UserMessageBody } from '@shared/types'
import { Hono } from 'hono'
import { getPrincipal, rateLimitWrites, requireToken } from '../auth'
import type { AppEnv } from '../services'
import {
  editMessageBody,
  messageIdParam,
  messagesQuery,
  roomIdParam,
  toPageQuery,
  userMessageBody,
} from './schemas'
import { validate } from './validate'

export const messagesRoutes = new Hono<AppEnv>()
  /// [계약] api.md §4.3 · (S1 그대로)
  .get(PATHS.roomMessages, validate('param', roomIdParam), validate('query', messagesQuery), async c => {
    const { id } = c.req.valid('param')
    const query: MessagesQuery = c.req.valid('query')
    const page: MessagesPage = await c.get('services').messages.listMessages(id, toPageQuery(query))
    return c.json(page, 200)
  })
  /// [계약] api.md §4.9 · [요구] R-MSG-002 · R-AUTH-004 · [에러] §4.5 공통 + VALIDATION_ERROR · NOT_FOUND · [부수효과] messages 1행 + 방 updatedAt · AI 호출 없음 · 레이트리밋 1회
  .post(
    PATHS.roomUser,
    requireToken,
    rateLimitWrites,
    validate('param', roomIdParam),
    validate('json', userMessageBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: UserMessageBody = c.req.valid('json')
      const message: Message = await c.get('services').messages.addUserMessage(id, body, getPrincipal(c))
      return c.json(message, 201)
    },
  )
  /// [계약] api.md §4.10 · [요구] R-MSG-004 · R-MSG-008 · [에러] §4.5 공통 + VALIDATION_ERROR · NOT_FOUND · [부수효과] text 갱신 + 방 updatedAt · 레이트리밋 1회
  .patch(
    PATHS.message,
    requireToken,
    rateLimitWrites,
    validate('param', messageIdParam),
    validate('json', editMessageBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: EditMessageBody = c.req.valid('json')
      const message: Message = await c.get('services').messages.editMessage(id, body)
      return c.json(message, 200)
    },
  )
  /// [계약] api.md §4.11 · [요구] R-MSG-005 · R-MSG-008 · [에러] §4.5 공통 + NOT_FOUND · [부수효과] 실삭제 + 방 updatedAt · 레이트리밋 1회
  .delete(PATHS.message, requireToken, rateLimitWrites, validate('param', messageIdParam), async c => {
    const { id } = c.req.valid('param')
    await c.get('services').messages.deleteMessage(id)
    return c.body(null, 204)
  })
```

- 핸들러 본문은 전부 5줄 이내다(R-API-007). 로직은 서비스에 있다.
- 체인에 미들웨어를 앞에 두어도 `c.req.valid()` 타입 추론은 유지된다. 깨지면 S1 §11.2 메모처럼 `onInvalid` 훅을 직접 쓴다.
- `getPrincipal(c)`가 돌려주는 `Principal`은 서비스 인자 `MessageAuthor`(`Pick<Principal, 'mbId' | 'displayName'>`)에 그대로 들어간다.

### 11.6 S2 ui/api 설계 (`ui/src/api/`)

| 파일 | S2 추가 export | 비고 |
|---|---|---|
| `client.ts` | `type ClientConfig` · `configureClient` · `isAuthFailure` · `ApiError.retryAfterSec?` · `request(path, options?)`(`RequestOptions`) | 토큰은 getter로만 읽는다 |
| `rooms.ts` | `createRoom(body: CreateRoomBody): Promise<Result<RoomSummary>>` · `renameRoom(roomId: string, body: RenameRoomBody): Promise<Result<RoomSummary>>` · `deleteRoom(roomId: string): Promise<Result<void>>` | |
| `messages.ts` | `appendUser(roomId: string, body: UserMessageBody): Promise<Result<Message>>` · `editMessage(messageId: number, body: EditMessageBody): Promise<Result<Message>>` · `deleteMessage(messageId: number): Promise<Result<void>>` | `appendUser` = server `addUserMessage`(이름은 화면 구성안을 따른다) |
| `index.ts` | 위 함수 전부와 `ClientConfig` 타입 재노출 | 화면은 `@/api`만 import |

```ts
// ui/src/api/client.ts — S2 전문
/**
 * fetch 래퍼 — 단일 소스 doc/200_설계/contract/api.md §2.4 · §3.4 · §11.6
 * 모든 래퍼는 throw 하지 않고 Result<T> 를 돌려준다 (ts-rules 에러 처리)
 * 토큰은 보관하지 않는다. main.tsx 가 configureClient 로 넘긴 getter 를 쓰기 요청 때만 부른다 (R-API-003)
 */
import { ERROR_MESSAGES, isErrorCode, type ErrorCode } from '@shared/errors'

export type ApiErrorCode = ErrorCode | 'NETWORK'
export type ApiError = {
  code: ApiErrorCode
  message: string
  /** RATE_LIMITED 에만. 다음 시도까지 기다릴 초(정수 ≥ 1) (api.md §3.4) */
  retryAfterSec?: number
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError }

/** 토큰 getter 주입. 보관은 ui/src/state/token.ts (api.md §2.4) */
export type ClientConfig = { getToken: () => string | null }

/** 서버가 내지 않는 클라이언트 전용 실패 (api.md §3.3) */
export const NETWORK_ERROR: ApiError = { code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }
const INTERNAL_ERROR: ApiError = { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL }

/** 동일 출처. 화면은 서버가 /embed 로 내려주고, dev 는 Vite 가 /api 를 프록시한다 */
const BASE_URL = ''

/** getter 슬롯 하나. 바꾸는 곳은 configureClient 뿐이다 (ts-rules 클로저 캡슐화) */
const createTokenSlot = () => {
  let getToken: ClientConfig['getToken'] = () => null
  return {
    set: (next: ClientConfig['getToken']): void => {
      getToken = next
    },
    read: (): string | null => getToken(),
  }
}
const tokenSlot = createTokenSlot()

/** main.tsx 가 렌더 전에 한 번 부른다 (api.md §2.4). 테스트는 매번 다시 불러 바꾼다 */
export const configureClient = (config: ClientConfig): void => tokenSlot.set(config.getToken)

/** 읽기 전용으로 전환해야 하는 인증 실패인가 (api.md §2.4, R-CHAT-011) */
const AUTH_FAILURE_CODES: readonly ApiErrorCode[] = ['TOKEN_REQUIRED', 'TOKEN_INVALID', 'LEVEL_TOO_LOW']
export const isAuthFailure = (error: ApiError): boolean => AUTH_FAILURE_CODES.includes(error.code)

/** api 폴더 내부 전용. auth = 쓰기 요청(토큰 헤더 부착). index 에서 내보내지 않는다 */
export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
}

const buildHeaders = ({ body, auth }: RequestOptions): Headers => {
  const headers = new Headers({ Accept: 'application/json' })
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  const token = auth === true ? tokenSlot.read() : null
  if (token !== null && token !== '') headers.set('Authorization', `Bearer ${token}`)
  return headers
}

const readJson = async (res: Response): Promise<unknown> => {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

/** RATE_LIMITED 이고 1 이상 정수일 때만 retryAfterSec 를 싣는다 (api.md §3.4) */
const toRetryAfter = (code: ErrorCode, value: unknown): { retryAfterSec?: number } =>
  code === 'RATE_LIMITED' && typeof value === 'number' && Number.isInteger(value) && value >= 1
    ? { retryAfterSec: value }
    : {}

/** 실패 응답 본문을 계약 형식으로 맞춘다. 계약 형식이 아니면 INTERNAL (api.md §3.4) */
export const toApiError = (body: unknown): ApiError => {
  const error = (
    body as { error?: { code?: unknown; message?: unknown; retryAfterSec?: unknown } } | null | undefined
  )?.error
  const code = error?.code
  if (!isErrorCode(code)) return INTERNAL_ERROR
  const message = error?.message
  return {
    code,
    message: typeof message === 'string' && message !== '' ? message : ERROR_MESSAGES[code],
    ...toRetryAfter(code, error?.retryAfterSec),
  }
}

/** 계약 경로로 요청을 보내고 Result 로 정규화한다. 204 는 value undefined (api.md §3.4) */
export const request = async <T>(path: string, options: RequestOptions = {}): Promise<Result<T>> => {
  const { method = 'GET', body } = options
  let res: Response
  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers: buildHeaders(options),
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }
  if (!res.ok) return { ok: false, error: toApiError(await readJson(res)) }
  if (res.status === 204) return { ok: true, value: undefined as T }
  const parsed = await readJson(res)
  return parsed === undefined ? { ok: false, error: INTERNAL_ERROR } : { ok: true, value: parsed as T }
}
```

```ts
// ui/src/api/rooms.ts — S2 추가분
import type { CreateRoomBody, RenameRoomBody } from '@shared/types'

/** [계약] api.md §4.6 · [요구] R-ROOM-002 · R-ROOMS-002 — 방 생성(201 RoomSummary) */
export const createRoom = (body: CreateRoomBody): Promise<Result<RoomSummary>> =>
  request<RoomSummary>(endpoints.rooms(), { method: 'POST', body: { title: body.title }, auth: true })

/** [계약] api.md §4.7 · [요구] R-ROOM-003 · R-CHAT-001 — 이름 변경(updatedAt 유지) */
export const renameRoom = (roomId: string, body: RenameRoomBody): Promise<Result<RoomSummary>> =>
  request<RoomSummary>(endpoints.room(roomId), { method: 'PATCH', body: { title: body.title }, auth: true })

/** [계약] api.md §4.8 · [요구] R-ROOM-004 · R-CHAT-001 — 방 삭제(204 → value undefined) */
export const deleteRoom = (roomId: string): Promise<Result<void>> =>
  request<void>(endpoints.room(roomId), { method: 'DELETE', auth: true })
```

```ts
// ui/src/api/messages.ts — S2 추가분
import type { EditMessageBody, Message, UserMessageBody } from '@shared/types'

/** [계약] api.md §4.9 · [요구] R-MSG-002 · R-CHAT-004 · R-CHAT-006 — 유저 발화·지시 저장(201 Message). AI 호출 없음 */
export const appendUser = (roomId: string, body: UserMessageBody): Promise<Result<Message>> =>
  request<Message>(endpoints.roomUser(roomId), {
    method: 'POST',
    body: { text: body.text, ooc: body.ooc },
    auth: true,
  })

/** [계약] api.md §4.10 · [요구] R-MSG-004 · R-CHAT-007 — 메시지 수정(200 Message) */
export const editMessage = (messageId: number, body: EditMessageBody): Promise<Result<Message>> =>
  request<Message>(endpoints.message(messageId), { method: 'PATCH', body: { text: body.text }, auth: true })

/** [계약] api.md §4.11 · [요구] R-MSG-005 · R-CHAT-007 — 메시지 삭제(204 → value undefined) */
export const deleteMessage = (messageId: number): Promise<Result<void>> =>
  request<void>(endpoints.message(messageId), { method: 'DELETE', auth: true })
```

```ts
// ui/src/api/index.ts — S2 전문
export type { ApiError, ApiErrorCode, ClientConfig, Result } from './client'
export { configureClient, isAuthFailure } from './client'
export { getHealth } from './health'
export { appendUser, deleteMessage, editMessage, listMessages } from './messages'
export { createRoom, deleteRoom, listRooms, renameRoom } from './rooms'
```

- 쓰기 래퍼는 본문을 **계약 키로 다시 만든다**(`{ title: body.title }`). 변수로 넘긴 객체에 남는 여분 키가 서버로 새지 않는다. trim은 하지 않는다(서버 몫).
- 읽기 래퍼(`getHealth`·`listRooms`·`listMessages`)는 `auth`를 주지 않는다. 그래서 토큰이 있어도 헤더가 붙지 않는다(§2.1).
- `request`·`RequestOptions`·`toApiError`·`NETWORK_ERROR`는 api 폴더 내부용이다. index에서 내보내지 않는다.
- 화면 쪽 연결(ui 설계 몫, 계약이 요구하는 것만): `main.tsx`가 렌더 전에 `ui/src/state/token.ts`로 `?t=`를 읽고 `configureClient({ getToken })`를 부른다. 화면은 쓰기 결과가 `isAuthFailure(result.error)`이면 토큰 state를 버려 읽기 전용으로 바꾼다(§2.4).

### 11.7 S2 구현 순서

1. contract-implementer: `shared/src/types.ts`(본문 타입 4개 · `retryAfterSec?`) · `endpoints.ts`(경로 3개 · 빌더 3개) + shared 테스트(API-T-042 갱신 · 045). server `toErrorBody`가 `ApiErrorBody`를 쓰려면 이것이 먼저다.
2. server-implementer: `auth/` · rooms·messages S2 함수 · `services.ts` · `app-error.ts`(`retryAfterSec`) · onError(server index.md §484 순서).
3. contract-implementer: routes S2(§11.5) + `server/test/routes.test.ts`의 API-T-050~066(§14.5). `signTestToken`은 server가 만든 `server/test/token.ts`를 쓴다.
4. contract-implementer: ui/api S2(§11.6) + API-T-UI-011~018(§14.7). 3과 서로 의존하지 않는다(shared만 필요).
5. ui-implementer: `ui/src/state/token.ts` · `main.tsx`의 `configureClient` 호출 · `viewer` 계산 · 쓰기 화면.
6. 증거: `npx vitest run server shared ui/src/api` 결과와 세 워크스페이스 `tsc --noEmit` exit 0.

### 11.8 S3 routes 설계 (`server/src/routes/`)

| 파일 | S3 변경 | 크기(예상) |
|---|---|---|
| `schemas.ts` | `CHARACTER_IDS`(내부 상수) · `speakBody` 추가 | ~48줄 |
| `messages.ts` | POST speak(E9) · POST regenerate(E12) 추가 | ~110줄 |
| `rooms.ts` · `index.ts` · `validate.ts` · `health.ts` | 변경 없음 | — |

- **E9를 `messages.ts`에 두는 이유:** 라우트 파일은 경로 접두어가 아니라 **부르는 서비스**로 나눈다. S2의 `POST /api/rooms/:id/user`(E8)도 `messages.addUserMessage`를 불러 `messages.ts`에 있다. E9는 `messages.speak`를 부르고, `rooms.ts`는 `rooms` 서비스만 부른다. 합쳐도 ~110줄로 400줄 한계 안이다.
- 미들웨어 순서는 S2와 같다: `requireToken, rateLimitWrites, validate('param', …), validate('json', …)`. E12는 `validate('json')`을 붙이지 않는다(본문 무시).
- `background`는 `{ waitUntil: task => c.executionCtx.waitUntil(task) }`로 만든다. `c.executionCtx`는 **콜백 안에서만** 읽는다. 핸들러 본문에서 미리 읽어 변수에 두지 않는다. S3에는 훅이 없어 콜백이 불리지 않는다(llm.md 「contract 인계 요구 명세」).
- 에러 변환은 S2와 같다. 서비스가 던진 `AppError`·`ConfigError`를 server `onError`가 `{ error: { code, message } }`로 바꾼다. 라우트는 try/catch·`c.json({ error })`를 쓰지 않는다.
- principal을 쓰지 않는다. `getPrincipal(c)`를 부르지 않는다(서비스가 작성자를 받지 않는다, messages.md D-MSG-12). 인증·레이트리밋은 미들웨어가 끝낸다.

```ts
// server/src/routes/schemas.ts — S3 추가분
import type { CharacterId } from '@shared/types'

/** CharacterId 와 같은 두 값. 캐릭터는 2명 고정(확정사항 §1) */
const CHARACTER_IDS = ['sebastian', 'ciel'] as const satisfies readonly CharacterId[]

/** POST /api/rooms/:id/speak 본문. 두 값 밖 → 400 VALIDATION_ERROR(기본 문구) (api.md §4.13) */
export const speakBody = z.object({ character: z.enum(CHARACTER_IDS) })
```

```ts
// server/src/routes/messages.ts — S3 추가분 (S2 체인의 .delete 다음에 잇는다)
// import: SpeakBody 는 '@shared/types' 목록에, speakBody 는 './schemas' 목록에 합친다

  /// [계약] api.md §4.13 · [요구] R-MSG-003 · R-MSG-007 · R-NFR-001 · [에러] §4.5·§4.12 공통 + VALIDATION_ERROR · NOT_FOUND · [부수효과] messages 1행 + 방 updatedAt · 잠금 · AI 1~2회 · 레이트리밋 1회
  .post(
    PATHS.roomSpeak,
    requireToken,
    rateLimitWrites,
    validate('param', roomIdParam),
    validate('json', speakBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: SpeakBody = c.req.valid('json')
      const message: Message = await c
        .get('services')
        .messages.speak(id, body, { waitUntil: task => c.executionCtx.waitUntil(task) })
      return c.json(message, 201)
    },
  )
  /// [계약] api.md §4.14 · [요구] R-MSG-006 · R-MSG-007 · R-NFR-001 · [에러] §4.5·§4.12 공통 + NOT_FOUND · NOT_CHARACTER_MESSAGE · NOT_LAST_MESSAGE · [부수효과] text 교체 + 방 updatedAt · 잠금 · AI 1~2회 · 레이트리밋 1회
  .post(
    PATHS.messageRegenerate,
    requireToken,
    rateLimitWrites,
    validate('param', messageIdParam),
    async c => {
      const { id } = c.req.valid('param')
      const message: Message = await c.get('services').messages.regenerate(id)
      return c.json(message, 200)
    },
  )
```

- 핸들러 본문은 5줄 이내다(R-API-007).
- `const body: SpeakBody = c.req.valid('json')` 대입이 zod 결과와 shared 타입을 tsc로 대조한다(§5.6).

### 11.9 S3 ui/api 설계 (`ui/src/api/`)

| 파일 | S3 추가 export | 비고 |
|---|---|---|
| `messages.ts` | `speak(roomId: string, body: SpeakBody): Promise<Result<Message>>` · `regenerate(messageId: number): Promise<Result<Message>>` | 이름은 서버 서비스와 같다 |
| `index.ts` | `speak` · `regenerate` 재노출 | 화면은 `@/api`만 import |
| `client.ts` | **변경 없음** | 타임아웃·재시도를 넣지 않는다 |

```ts
// ui/src/api/messages.ts — S3 추가분
// import: SpeakBody 를 '@shared/types' 목록에 합친다

/** [계약] api.md §4.13 · [요구] R-MSG-003 · R-CHAT-005 — 캐릭터 1턴 생성(201 Message). 최대 70초 */
export const speak = (roomId: string, body: SpeakBody): Promise<Result<Message>> =>
  request<Message>(endpoints.roomSpeak(roomId), {
    method: 'POST',
    body: { character: body.character },
    auth: true,
  })

/** [계약] api.md §4.14 · [요구] R-MSG-006 · R-CHAT-007 — 같은 캐릭터로 재생성(200 Message). 본문 없음. 최대 70초 */
export const regenerate = (messageId: number): Promise<Result<Message>> =>
  request<Message>(endpoints.messageRegenerate(messageId), { method: 'POST', auth: true })
```

```ts
// ui/src/api/index.ts — S3 변경 줄
export { appendUser, deleteMessage, editMessage, listMessages, regenerate, speak } from './messages'
```

래퍼 규약(S3):

| 항목 | 규칙 |
|---|---|
| 반환 | `Result<Message>`. throw·reject 없음(§3.4). 실패는 `error.code`로만 분기한다 |
| 토큰 | `auth: true` — 쓰기 래퍼 규칙 그대로(§2.2). getter가 `null`이면 헤더 없이 보내고 서버의 `TOKEN_REQUIRED`를 그대로 돌려준다 |
| 본문 | `speak`는 `{ character }`만 다시 만들어 보낸다. `regenerate`는 본문·`Content-Type`을 보내지 않는다 |
| 타임아웃 | **없음 — 서버 종결(70초)에 의존한다.** `client.ts`에 `AbortSignal`·타이머가 없고 S3에서도 넣지 않는다. 넣게 되면 이 두 래퍼는 75초 이상이어야 한다(§4.12) |
| 자동 재시도 | 없음. 「재시도」는 화면이 같은 래퍼를 다시 부르는 것이다(R-CHAT-005) |
| 동시 호출 | 래퍼는 막지 않는다. 생성 중 두 버튼·전송 잠금은 화면 몫이다(R-CHAT-005). 다른 탭·다른 사람과 겹치면 서버가 `409`로 막는다 |
| 인증 실패 | `isAuthFailure(error)`이면 S2와 같이 읽기 전용 전환(§2.4). 생성 실패 코드(`409`·`400 NOT_CHARACTER_MESSAGE`·`500`·`502`)는 전환하지 않는다 |

### 11.10 S3 구현 순서

1. contract-implementer: `shared/src/types.ts`(`SpeakBody`) · `endpoints.ts`(경로 2개 · 빌더 2개) + shared 테스트(API-T-042 갱신 · 047). server `messages/generate.ts`가 `SpeakBody`를 import하므로 이것이 먼저다(messages.md §2.3).
2. server-implementer: `server/src/llm/` · `messages.speak`·`regenerate` · db 잠금 함수 · `services.ts` 배선(llm.md §3.3).
3. contract-implementer: routes S3(§11.8) + `server/test/routes-generate.test.ts`의 API-T-070~084 + `server/test/routes-write.test.ts`의 쓰기 표에 E9·E12 추가(API-T-050~053이 8개를 돈다).
4. contract-implementer: ui/api S3(§11.9) + API-T-UI-019~021(§14.11). 3과 서로 의존하지 않는다(shared만 필요).
5. ui-implementer: 캐릭터 버튼·임시 말풍선·재작성 메뉴·S3 오류 문구(ui 설계 몫).
6. 증거: `npx vitest run --project shared` · `--project server` · `--project ui` 결과와 세 워크스페이스 `tsc --noEmit` exit 0.

### 11.11 S3b 구현 부록 (v0.4.1 — 엔드포인트·래퍼 추가 없음)

| 파일 | 소유 | 변경 |
|---|---|---|
| `shared/src/errors.ts` | contract | `ERROR_CODES`에 `'LLM_BUDGET_EXCEEDED'`(`'LLM_EMPTY'` 다음) · `ERROR_STATUS.LLM_BUDGET_EXCEEDED = 429` · `ERROR_MESSAGES.LLM_BUDGET_EXCEEDED` = 요구 원문(§5.3). 3곳 |
| `shared/src/types.ts` | contract | `ApiErrorBody.error.retryAfterSec?` 문서주석만(§5.2). 타입 변경 없음 |
| `server/src/routes/*` | contract | **변경 없음.** 라우트는 판정 순서를 모른다. 미들웨어 순서(`requireToken → rateLimitWrites → validate`)가 §6.1 S3b 카운트를 이미 만족한다 |
| `server/src/app.ts` · `app-error.ts` | server | 주석만 두 코드로 넓힘(index.md §2.4 S3b). `errorResponse`는 코드 종류를 보지 않으므로 코드 변경 없음 — contract는 재사용만 한다 |
| `ui/src/api/client.ts` | contract | **코드 변경 없음.** `isErrorCode`가 shared를 따라 14종을 받고, `toRetryAfter`는 `RATE_LIMITED`에만 싣는다(§3.4 429 구분). `ApiError.retryAfterSec?` 주석 "RATE_LIMITED 에만"은 그대로 맞다 |
| `ui/src/api/{messages,index}.ts` | contract | 변경 없음. `speak`·`regenerate` 시그니처·`Result<Message>` 그대로 |

구현 순서:

1. contract-implementer: `shared/src/errors.ts` 3곳 + `types.ts` 주석 + shared 테스트(API-T-040 갱신 · 048). server `AppError`가 `ErrorCode`로 이 코드를 받으려면 이것이 먼저다(llm.md §12.10).
2. server-implementer: S3b(llm `usage.ts`·`ensureBudget`, db `llm_usage`·`0002_llm_usage.sql`·`helpers.ts insertUsage`, env 4키, messages 게이트 2줄, app 주석).
3. contract-implementer: `server/test/routes-generate.test.ts` API-T-085~090 + `expectContractError` 두 벌(`routes-write.test.ts`·`routes-generate.test.ts`) 갱신(§14.12). 2 뒤.
4. contract-implementer: `ui/src/api/api.test.ts` API-T-UI-022·023(§14.13). 1 뒤면 2·3과 무관.
5. ui-implementer: `labels.ts` 문구 · 실패 말풍선 처리(ui 설계 몫).
6. 증거: `npx vitest run --project shared` · `--project server` · `--project ui` 결과와 세 워크스페이스 `tsc --noEmit` exit 0.


### 11.12 S3c routes 설계 (`server/src/routes/`)

| 파일 | S3c 변경 | 크기(예상) |
|---|---|---|
| `validate.ts` | 세 번째 선택 인자 `toMessage?: (data: unknown) => string \| undefined`. 기존 호출은 그대로(기본 문구) | ~20줄 |
| `schemas.ts` | `putCharacterSettingsBody` · `settingsIssueMessage` · `SETTINGS_BODY_TOO_LARGE` 추가 | ~70줄 |
| **신규** `settings.ts` | `settingsRoutes` — E15 GET · E16 PUT · 본문 상한 미들웨어 | ~45줄 |
| `index.ts` | `apiRoutes.route('/', settingsRoutes)` 한 줄 | ~16줄 |
| `rooms.ts` · `messages.ts` · `health.ts` | 변경 없음 | — |

- **파일을 따로 두는 이유:** 라우트 파일은 부르는 서비스로 나눈다(§11.8). E15·E16은 `services.settings`만 부른다.
- 미들웨어 순서는 §2.7 · §4.16 판정 순서 그대로다. `requireOwner`는 server `auth`가 내보낸다(s3c-03 §1.3). 라우트는 `isOwner`를 직접 부르지 않는다.
- 본문 상한은 `hono/body-limit`의 `bodyLimit`(hono 4.13 내장, 새 패키지 아님)이다. 기본 실패는 `413` 텍스트라 `onError` 옵션에서 `AppError('VALIDATION_ERROR', SETTINGS_BODY_TOO_LARGE)`를 throw한다. throw는 server `onError`로 간다(본문 형식·CSP 그대로). §7의 라우트 금지 목록(secure-headers·cors·logger)에 들지 않는다.
- 에러 변환·try/catch 금지·principal 규칙은 S2·S3와 같다. principal은 E16에서만 `getPrincipal(c)`로 꺼내 `put`에 넘긴다(저장자 기록 = `mbId`만, server 몫).

```ts
// server/src/routes/validate.ts — S3c 변경 (선택 인자 추가, 기존 호출 영향 없음)
export const validate = <Target extends keyof ValidationTargets, Schema extends ZodType>(
  target: Target,
  schema: Schema,
  /** 실패 문구를 정하는 함수(E16). undefined 를 돌려주거나 생략하면 기본 문구 (api.md §4.16) */
  toMessage?: (data: unknown) => string | undefined,
) =>
  zValidator(target, schema, result => {
    if (!result.success) throw new AppError('VALIDATION_ERROR', toMessage?.(result.data))
  })
```

```ts
// server/src/routes/schemas.ts — S3c 추가분
// import 추가: checkCharacterSettings 는 '@shared/settings', characterSettingsSchema 는 '../settings'(server 소유)

/** PUT /api/settings/characters 본문. 봉투 모르는 키는 버리고, settings 안은 server 스키마가 strict (api.md §4.16) */
export const putCharacterSettingsBody = z.object({ settings: characterSettingsSchema })

/** E16 400 문구 — 판정은 zod, 문구는 shared 사전 검사의 첫 위반 1건. 둘이 어긋나면 undefined → 기본 문구 */
export const settingsIssueMessage = (data: unknown): string | undefined => {
  const settings = typeof data === 'object' && data !== null && 'settings' in data ? data.settings : undefined
  const checked = checkCharacterSettings(settings)
  return checked.ok ? undefined : checked.issue.message
}

/** E16 본문 상한 초과 문구 (api.md §4.16 판정 4) */
export const SETTINGS_BODY_TOO_LARGE = '공통 · 설정 본문은 128KB 이하여야 합니다.'
```

```ts
// server/src/routes/settings.ts — 신규
/**
 * [목적] 캐릭터 설정 E15 · E16 (api.md §4.15 · §4.16). 갠홈 주인 전용
 * [요구] R-SET-001 · R-SET-004 · R-SET-005 · R-AUTH-003(설정 GET 토큰 예외) · R-AUTH-005
 * [에러] 서비스·미들웨어가 throw → server onError. 라우트는 변환하지 않는다
 */
import { PATHS } from '@shared/endpoints'
import { SETTINGS_BODY_MAX_BYTES } from '@shared/settings'
import type { CharacterSettingsResponse, PutCharacterSettingsBody } from '@shared/types'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { AppError } from '../app-error'
import { getPrincipal, rateLimitWrites, requireOwner, requireToken } from '../auth'
import type { AppEnv } from '../services'
import { putCharacterSettingsBody, SETTINGS_BODY_TOO_LARGE, settingsIssueMessage } from './schemas'
import { validate } from './validate'

/** 본문 128KB 초과 → 400 VALIDATION_ERROR (hono 기본 413 을 쓰지 않는다) */
const settingsBodyLimit = bodyLimit({
  maxSize: SETTINGS_BODY_MAX_BYTES,
  onError: () => {
    throw new AppError('VALIDATION_ERROR', SETTINGS_BODY_TOO_LARGE)
  },
})

export const settingsRoutes = new Hono<AppEnv>()
  /// [계약] api.md §4.15 · [요구] R-SET-004 · [에러] TOKEN_* · LEVEL_TOO_LOW · OWNER_ONLY · INTERNAL · [부수효과] 없음
  .get(PATHS.characterSettings, requireToken, requireOwner, async c => {
    const response: CharacterSettingsResponse = await c.get('services').settings.get()
    return c.json(response, 200)
  })
  /// [계약] api.md §4.16 · [요구] R-SET-005 · [에러] §4.15 + RATE_LIMITED · VALIDATION_ERROR · [부수효과] D1 1행 UPSERT · 레이트리밋 1회
  .put(
    PATHS.characterSettings,
    requireToken,
    requireOwner,
    rateLimitWrites,
    settingsBodyLimit,
    validate('json', putCharacterSettingsBody, settingsIssueMessage),
    async c => {
      const body: PutCharacterSettingsBody = c.req.valid('json')
      const response: CharacterSettingsResponse = await c
        .get('services')
        .settings.put(body.settings, getPrincipal(c))
      return c.json(response, 200)
    },
  )
```

- 핸들러 본문은 5줄 이내, 파일 전체도 30줄 한계(R-API-007)를 핸들러 기준으로 지킨다. 로직(정규화·저장·시드 대체)은 전부 server다.
- `const body: PutCharacterSettingsBody = c.req.valid('json')` 대입이 server zod 출력과 shared 타입을 tsc로 대조한다. zod 출력이 맞지 않으면 컴파일이 실패한다(§15.12 N2).
- `'settings' in data`로 좁히므로 타입 단언(`as`)이 없다.

### 11.13 S3c ui/api 설계 (`ui/src/api/`)

| 파일 | S3c 변경 | 비고 |
|---|---|---|
| `client.ts` | `RequestOptions.method`에 `'PUT'` 추가. `auth` 주석을 "토큰 헤더 부착(쓰기 + 설정 GET)"으로 | S4 memory PUT과 같은 변경 — 먼저 하는 쪽이 넣고 나중 쪽은 재사용(s3c-03 §0.2). `AUTH_FAILURE_CODES`·`isAuthFailure`는 **바꾸지 않는다** |
| **신규** `settings.ts` | `getCharacterSettings` · `saveCharacterSettings` | 이름은 화면 동작 기준(서버 서비스 이름 `get`·`put`은 너무 일반적이다) |
| `index.ts` | 두 래퍼 재노출 | 화면은 `@/api`만 import |

```ts
// ui/src/api/client.ts — S3c 변경 줄
/** api 폴더 내부 전용. auth = 토큰 헤더 부착(쓰기 + 설정 GET). index 에서 내보내지 않는다 */
export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  auth?: boolean
}
```

```ts
// ui/src/api/settings.ts — 신규
import { endpoints } from '@shared/endpoints'
import type {
  CharacterSettings,
  CharacterSettingsResponse,
  PutCharacterSettingsBody,
} from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.15 · [요구] R-SET-004 · R-SET-010 — 설정 읽기(토큰 필요). 200 = 주인, 403 OWNER_ONLY = 주인 아님 */
export const getCharacterSettings = (): Promise<Result<CharacterSettingsResponse>> =>
  request<CharacterSettingsResponse>(endpoints.characterSettings(), { auth: true })

/** [계약] api.md §4.16 · [요구] R-SET-005 — 전체 교체 저장(200). 응답 settings 가 정규화 값이다 */
export const saveCharacterSettings = (
  settings: CharacterSettings,
): Promise<Result<CharacterSettingsResponse>> => {
  const body: PutCharacterSettingsBody = { settings }
  return request<CharacterSettingsResponse>(endpoints.characterSettings(), {
    method: 'PUT',
    body,
    auth: true,
  })
}
```

```ts
// ui/src/api/index.ts — S3c 추가 줄
export { getCharacterSettings, saveCharacterSettings } from './settings'
```

래퍼 규약(S3c):

| 항목 | 규칙 |
|---|---|
| 반환 | `Result<CharacterSettingsResponse>`. throw·reject 없음(§3.4) |
| 토큰 | 둘 다 `auth: true`. getter가 `null`이면 헤더 없이 보내고 서버의 `401 TOKEN_REQUIRED`를 그대로 돌려준다 |
| 본문 | `saveCharacterSettings`는 `{ settings }`만 보낸다. 래퍼는 사전 검사·정규화를 하지 않는다 — 화면 state가 `checkCharacterSettings`로 한다. 초안에 모르는 키가 섞이면 서버가 `400`으로 거절한다 |
| 오류 판정 | `OWNER_ONLY`는 `isAuthFailure` false. 401·`LEVEL_TOO_LOW`는 true지만 **판정 탐침에서는 화면이 전환하지 않는다**(§2.7, R-SET-010) — 래퍼는 판정만 돌려주고 상태를 바꾸지 않는다 |
| 타임아웃·재시도 | 없음(§3.4). 저장 「재시도」는 화면이 같은 래퍼를 다시 부른다 |

### 11.14 S3c 구현 순서

1. contract-implementer(4단계): `shared/src/errors.ts`(`OWNER_ONLY`) · `types.ts`(4타입) · 신규 `settings.ts` · `endpoints.ts` + shared 테스트(API-T-040·042 갱신, 049, 104~107)와 벡터 파일 `shared/test/settings-vectors.ts`. server `settings/schema.ts`가 `@shared/settings` 상수를 import하므로 이것이 먼저다.
2. server-implementer(5단계): env `OWNER_MB_IDS` · auth `isOwner`·`requireOwner` · `settings/` · db · `0003` · llm · generate · services(s3c-03 §1.2).
3. contract-implementer(6단계): routes S3c(§11.12) + `server/test/routes-settings.test.ts` API-T-091~103(§14.14). 2 뒤 — `requireOwner`·`characterSettingsSchema`·`services.settings`가 있어야 컴파일된다.
4. contract-implementer(6단계): ui/api S3c(§11.13) + API-T-UI-024~027(§14.16). 1 뒤면 2·3과 무관하다.
5. ui-implementer: App 주인 판정·rooms ⚙·설정 화면·`state/settings.ts`·`state/settingsFile.ts`(ui 설계 몫).
6. 증거: `npx vitest run --project shared` · `--project server` · `--project ui` 결과와 세 워크스페이스 `tsc --noEmit` exit 0.

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
| 캐릭터 표시 메타 `id`·`name`·`shortName`·`avatar` | §5.5 | `CHARACTERS` · `CharacterMeta`(`shortName` 포함) · `CharacterId` | 없음(S3 `llm/characters.ts`가 `name`만 대조) | 없음(화면이 shared 직접 import, 이름표는 `shortName`) | 설계 일치 |
| 토큰 형식·전달 | §2.2 · §2.3 | S2 | S2 | S2(`buildHeaders` TODO) | S2 행으로 이동(아래) |
| 경로 리터럴 | §5.4 | `endpoints.ts`에만 | `PATHS.*`만 | `endpoints.*`만 | 설계 일치(API-T-044로 검사) |

### 12.1 4자 대조표 (S2 — 설계 기준, 구현 후 contract-implementer가 다시 채운다)

| 계약 항목 | api.md | shared | routes | ui/api | 판정 |
|---|---|---|---|---|---|
| `POST /api/rooms` `{ title }` → `201 RoomSummary` | §4.6 | `PATHS.rooms` · `endpoints.rooms` · `CreateRoomBody` · `RoomSummary` | `rooms.ts` `.post` · `roomTitleBody` → `const body: CreateRoomBody` | `createRoom(body: CreateRoomBody)` → `Result<RoomSummary>` | 설계 일치 |
| `PATCH /api/rooms/:id` `{ title }` → `200 RoomSummary` | §4.7 | `PATHS.room` · `endpoints.room` · `RenameRoomBody` | `rooms.ts` `.patch` · `roomIdParam` · `roomTitleBody` | `renameRoom(roomId, body)` | 설계 일치 |
| `DELETE /api/rooms/:id` → `204` | §4.8 | `PATHS.room` · `endpoints.room` | `rooms.ts` `.delete` → `c.body(null, 204)` | `deleteRoom(roomId)` → `Result<void>` · `request`의 204 분기 | 설계 일치 |
| `POST /api/rooms/:id/user` `{ text, ooc }` → `201 Message` | §4.9 | `PATHS.roomUser` · `endpoints.roomUser` · `UserMessageBody` · `Message` | `messages.ts` `.post` · `userMessageBody` · `getPrincipal(c)` | `appendUser(roomId, body)` | 설계 일치 |
| `PATCH /api/messages/:id` `{ text }` → `200 Message` | §4.10 | `PATHS.message` · `endpoints.message(messageId: number)` · `EditMessageBody` | `messages.ts` `.patch` · `messageIdParam` · `editMessageBody` | `editMessage(messageId: number, body)` | 설계 일치 |
| `DELETE /api/messages/:id` → `204` | §4.11 | `PATHS.message` · `endpoints.message` | `messages.ts` `.delete` · `messageIdParam` | `deleteMessage(messageId: number)` → `Result<void>` | 설계 일치 |
| 메시지 id 표기(10진 숫자) | §4.5 | `endpoints.message`가 `String(number)` | `messageIdParam`(`toMessageId`) | `messageId: number` | 설계 일치 |
| 길이 규칙 60·2000·4000, trim 후 코드 포인트 (v0.3.1) | §5.7 | `limits.ts` `ROOM_TITLE_MAX` · `MESSAGE_TEXT_MAX` · `MEMORY_SUMMARY_MAX` · `countCodePoints` · `normalizeText` | 쓰지 않음(zod는 타입만). 판정은 server 서비스가 `@shared/limits`로 | 쓰지 않음(api 래퍼는 trim하지 않음). 화면 `limits.ts`가 import | 설계 일치(server 쪽은 S2-R4 반영 후) |
| 토큰 전달 `Authorization: Bearer` | §2.2 | — | `requireToken`(server auth) 라우트 단위 6개 | `buildHeaders` — `auth: true`이고 getter 값이 있을 때만 | 설계 일치 |
| 토큰 보관 `?t=` → 메모리 | §2.4 | — | — | `configureClient({ getToken })` · `ClientConfig`(보관은 `state/token.ts`) | 설계 일치(보관 구현은 ui) |
| 토큰 형식·payload·벡터 | §2.3 · §2.5 | 없음(의도 — `TokenPayload`는 문서 표기) | 없음(server auth zod가 정본) | 없음(화면은 해석하지 않음) | 설계 일치(server auth.md §2와 대조) |
| `RATE_LIMITED` `retryAfterSec` | §3.1 · §6.1 | `ApiErrorBody.error.retryAfterSec?` | 없음(server onError가 본문·헤더) | `ApiError.retryAfterSec?` · `toRetryAfter` | 설계 일치 |
| 인증 실패 → 읽기 전용 | §2.4 | `ErrorCode`(3코드) | — | `isAuthFailure` | 설계 일치 |
| 레이트리밋 적용 | §6.1 | — | `rateLimitWrites` 라우트 단위 6개 | — | 설계 일치 |

### 12.2 4자 대조표 (S3 — 구현 완료 2026-10-06, contract-implementer 실물 기준)

| 계약 항목 | api.md | shared | routes | ui/api | 판정 |
|---|---|---|---|---|---|
| `POST /api/rooms/:id/speak` `{ character }` → `201 Message` | §4.13 | `endpoints.ts` `PATHS.roomSpeak` · `endpoints.roomSpeak(roomId)` · `types.ts` `SpeakBody` · 기존 `CharacterId` · `Message` | `routes/messages.ts` `.post(PATHS.roomSpeak, requireToken, rateLimitWrites, validate('param', roomIdParam), validate('json', speakBody))` → `const body: SpeakBody` → `messages.speak(id, body, { waitUntil })` | `api/messages.ts` `speak(roomId, body: SpeakBody)` → `Result<Message>` | 구현 일치. 테스트 API-T-070~077 · 084 · T-UI-019~021 |
| `POST /api/messages/:id/regenerate` 본문 없음 → `200 Message` | §4.14 | `PATHS.messageRegenerate` · `endpoints.messageRegenerate(messageId: number)` | `routes/messages.ts` `.post(PATHS.messageRegenerate, requireToken, rateLimitWrites, validate('param', messageIdParam))` · json 검증 없음 → `messages.regenerate(id)` | `api/messages.ts` `regenerate(messageId: number)` 본문·`Content-Type` 없음 | 구현 일치. 테스트 API-T-074 · 075 · 078~084 · T-UI-019~021 |
| 생성 에러 5코드 + `CONFIG_INVALID` | §3.2 · §4.12 | `ERROR_CODES` 변경 없음 | 서비스 throw → server `onError`(라우트 변환 없음) | `toApiError` 변경 없음 | 구현 일치. API-T-073~083 · T-UI-020 |
| 시간 상한 70초 · 화면 타임아웃 없음 | §4.12 | — | 없음(서비스·llm 예산) | `request` 타임아웃 없음, 래퍼 `signal` 없음 | 구현 일치. T-UI-021 + grep 0건 |
| 토큰·레이트리밋 | §4.12 · §6.1 | — | `requireToken` · `rateLimitWrites` 2개 추가(라우트 단위 총 8개) | `auth: true` | 구현 일치. API-T-050~053(8개) · 077 |
| 캐릭터 값 두 개 | §5.2 · §5.6 | `CharacterId` | `routes/schemas.ts` `CHARACTER_IDS` `satisfies readonly CharacterId[]` · `speakBody` | `SpeakBody` | 구현 일치. API-T-072 |

### 12.3 4자 대조표 (S3b — 구현 완료 2026-10-06, contract-implementer 실물 기준)

| 계약 항목 | api.md | shared | routes | ui/api | 판정 |
|---|---|---|---|---|---|
| `LLM_BUDGET_EXCEEDED` 429 · 요구 원문 문구 | §3.2 | `shared/src/errors.ts` `ERROR_CODES`(17) · `ERROR_STATUS`(39) · `ERROR_MESSAGES`(57) | 변경 없음(서비스 throw → server `onError`). 테스트 `routes-generate.test.ts` API-T-085 | `client.ts` `isErrorCode`·`toApiError` 자동 수용. 테스트 `api.test.ts` API-T-UI-022 | ✅ |
| 본문 `retryAfterSec` + `Retry-After` | §3.1 · §4.12 | `ApiErrorBody.error.retryAfterSec?`(`types.ts`) | 변경 없음. `expectContractError` 두 벌이 코드별 값(40 / 1356400)과 헤더 검증 | `toRetryAfter`(`client.ts` 75)가 `RATE_LIMITED`에만 싣는다. API-T-UI-022가 버림을 검증 | ✅ |
| 판정 순서 4b(E9) · 5b(E12) | §4.13 · §4.14 | — | 변경 없음. API-T-086(speak 순서) · API-T-087(regenerate 순서·원문 유지) | — | ✅ |
| 예산 거절도 레이트리밋 1회 · 분 한도 우선 | §6.1 | — | 기존 미들웨어 순서. API-T-089 | API-T-UI-023(두 429를 `code`로 구분) | ✅ |
| 다른 엔드포인트·health 영향 없음 | §4.12 | — | 변경 없음. API-T-088 | 변경 없음 | ✅ |
| 이번 달(KST)만 집계 | §4.12 | — | API-T-090 · 임계 직전(99999.9) 허용은 API-T-085 후반 | — | ✅ |

### 12.4 4자 대조표 (S3c — 구현 완료 2026-10-06, 실물 파일:줄)

| 계약 항목 | api.md | shared | routes | ui/api | 판정 |
|---|---|---|---|---|---|
| E15 `GET /api/settings/characters` → `200 CharacterSettingsResponse` | §4.0 · §4.15 | `endpoints.ts:26` `PATHS.characterSettings` · `endpoints.ts:58` · `types.ts:122` | `routes/settings.ts:27` `.get(PATHS.characterSettings, requireToken, requireOwner)` → `settings.get()`(:28) | `api/settings.ts:10` `getCharacterSettings()` `auth: true`(:11) | ✅ |
| E16 `PUT` `{ settings }` → `200 CharacterSettingsResponse` | §4.0 · §4.16 | 같은 경로 · `types.ts:114` `CharacterSettings` · `types.ts:134` `PutCharacterSettingsBody` | `settings.ts:32~46` `.put(…, requireToken, requireOwner, rateLimitWrites, settingsBodyLimit, validate('json', putCharacterSettingsBody, settingsIssueMessage))` → `const body: PutCharacterSettingsBody` → `settings.put(body.settings, getPrincipal(c))`(:43) | `api/settings.ts:14` `saveCharacterSettings(settings)` → `method: 'PUT'`(:19) `body: { settings }` `auth: true`(:21) | ✅ |
| 경로 집합 16개 · 리터럴 1곳 | §4.0 | `PATHS` 값 10개 | `routes/index.ts:11·17` `route('/', settingsRoutes)` | `ui/api/index.ts:6` · `endpoints.*`만 | ✅ (리터럴 grep: 소스 0건, 주석·테스트 기대값만) |
| `OWNER_ONLY` 403 · 문구 | §3.2 · §5.8.2 | `errors.ts:19` · `:42` · `:61` | server `requireOwner` throw → `onError`(API-T-093) | `isErrorCode` 자동 수용, `AUTH_FAILURE_CODES` 불변(`client.ts` grep 0건, UI-026) | ✅ |
| 주인 판정 순서 · 토큰 예외 | §2.7 | — | 라우트 단위 미들웨어 2종, `requireOwner`가 `rateLimitWrites` 앞(`settings.ts:27·34~36`) | `auth: true`(GET 포함) | ✅ (API-T-091·092·093, UI-024·027) |
| 필드·상한·필수 · 400 문구 | §4.16 · §5.8.4 | `settings.ts` `checkCharacterSettings`(:173) | `schemas.ts:52` `putCharacterSettingsBody` · `:55` `settingsIssueMessage` · `validate.ts:14·17` `toMessage` | 없음 | ✅ (API-T-096~099·101) |
| 본문 상한 128KB → 400 | §4.16 | `settings.ts:18` `SETTINGS_BODY_MAX_BYTES` | `settings.ts:18~23` `bodyLimit` onError → `AppError('VALIDATION_ERROR', SETTINGS_BODY_TOO_LARGE)`(`schemas.ts:63`) | 없음 | ✅ (API-T-100) |
| 레이트리밋 | §6.1 | — | E16만 `rateLimitWrites`(`settings.ts:36`), 비주인 403 미카운트 | — | ✅ (API-T-093③·102) |
| 파일 형식 · 가져오기 | §16 | `SETTINGS_FILE_FORMAT` 외 | 없음(서버 엔드포인트 없음) | 없음(화면 `state/settingsFile.ts`, ui-implementer) | 해당 없음 |
| `request` method `'PUT'` | §11.13 | — | — | `client.ts:53` `RequestOptions.method` | ✅ |

실행 증거(2026-10-06): `npx tsc --noEmit -p server` exit 0 · `-p ui`의 `ui/src/api` 오류 0건 · `vitest run --project server` 18파일 318/318(305 + API-T-091~103 13건) · `vitest run --project ui ui/src/api` 2파일 27/27(API-T-UI-024~027 4건 포함). ui 전체의 실패 17건은 ui-implementer 미구현 화면(`OwnerGate`·`settings/`)용 선작성 테스트다.

