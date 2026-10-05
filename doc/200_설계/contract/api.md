# API 계약 (api.md)

- 상태: **초안 v0.3.1** · 최종 갱신 2026-10-05 · 소유 contract-designer
- 묶음: **S1 상세 확정**(구현 완료) = `GET /api/health` · `GET /api/rooms` · `GET /api/rooms/:id/messages` · `GET /embed`. **S2 상세 확정**(구현 전) = 토큰 규약(§2) · `POST /api/rooms` · `PATCH`·`DELETE /api/rooms/:id` · `POST /api/rooms/:id/user` · `PATCH`·`DELETE /api/messages/:id` · 쓰기 레이트리밋(§6). 나머지 엔드포인트는 §4.0 표에 행만 두고 S3~S4에서 상세를 정한다.
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

### 1.4 묶음별 범위

| 묶음 | 이 문서에서 정하는 것 |
|---|---|
| S1 | §3 에러 코드 13종 전부, §4.1~§4.4, §5 shared 4파일, §11 routes·ui/api, §12~§14 |
| S2 (**v0.3 확정**) | §2 토큰 상세(형식·전달·검증 순서·`TokenPayload`·화면 보관·전환·교차 벡터), §4.5~§4.11 쓰기 엔드포인트(방 생성·변경·삭제, user 저장, 메시지 수정·삭제), §6 레이트리밋, §11.5~§11.6 routes·ui/api 설계 |
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
| `error`의 키 (S2) | 정확히 `code`·`message` 둘이다. **예외는 `RATE_LIMITED` 하나**: `retryAfterSec`(정수 ≥ 1, 다음 분 창까지 남은 초)가 더 붙고, 같은 값이 응답 헤더 `Retry-After`에도 실린다(R-AUTH-005, server index.md §5.1) |
| 성공 본문 없음 (S2) | `DELETE` 두 개(E6·E11)는 `204 No Content`로 답하고 본문·`Content-Type`이 없다. 나머지 성공 응답은 전부 JSON 본문이 있다 |

```json
{ "error": { "code": "RATE_LIMITED", "message": "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", "retryAfterSec": 40 } }
```

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
| `204`(S2, 본문 없음) | `{ ok: true, value: undefined }` — 본문을 읽지 않는다. `DELETE` 래퍼만 `Result<void>`로 받는다 |
| 2xx(204 제외) + 본문이 JSON이 아님 | `{ ok: false, error: { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL } }` |
| 4xx·5xx + 계약 형식 본문(`code`가 13종, `message`가 빈 문자열이 아님) | `{ ok: false, error: { code, message } }`(본문 값 그대로) |
| (S2) 위 경우 + `code === 'RATE_LIMITED'` + `retryAfterSec`가 1 이상 정수 | `error`에 `retryAfterSec`를 함께 싣는다. 값이 없거나 형식이 틀리면 키를 빼고, 다른 코드에 붙어 오면 버린다. `Retry-After` 헤더는 읽지 않는다(본문이 단일 소스) |
| 4xx·5xx + `code`는 13종인데 `message`가 없거나 비어 있음 | `{ code, message: ERROR_MESSAGES[code] }` |
| 4xx·5xx + 계약 형식이 아님(HTML 오류 페이지, 모르는 코드) | `{ code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL }` |
| `fetch` 자체 실패(오프라인·DNS·연결 거부) | `{ code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }` |

- 래퍼는 **어떤 경우에도 throw·reject하지 않는다.** 화면은 `result.ok` 분기만 쓰고 `try/catch`를 쓰지 않는다.

### 3.5 에러 변환 위치

- 라우트와 서비스는 `AppError`를 throw만 한다. 응답 본문은 server 진입점의 `onError` 한 곳이 `{ error: { code, message } }`로 만든다(index.md §5.1).
- zod 검증 실패는 라우트의 `validate` 훅이 `AppError('VALIDATION_ERROR', 400, ERROR_MESSAGES.VALIDATION_ERROR)`를 throw한다(§11.2). zod-validator 기본 실패 응답은 계약 형식이 아니라서 쓰지 않는다.
- 매칭 없는 경로와 메서드는 `notFound`가 `404 NOT_FOUND`(`요청한 주소를 찾을 수 없습니다.`)로 닫는다. S1 시점에 `POST /api/rooms` 같은 미구현 쓰기 경로도 이 응답이다.
- (S2) `GET /api/rooms/:id`·`PUT /api/rooms/:id`·`GET /api/messages/:id`처럼 경로는 있으나 메서드가 등록되지 않은 요청도 `404 NOT_FOUND`다(405를 쓰지 않는다). S3·S4 경로(speak·regenerate·memory)는 그 묶음 전까지 이 응답이다.
- (S2) `RATE_LIMITED`의 `retryAfterSec`·`Retry-After`도 `onError`가 `AppError`의 선택 필드에서 옮긴다. 라우트·미들웨어는 헤더를 만들지 않는다(server index.md D-IDX-11).
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
| E9 | `POST /api/rooms/:id/speak` | ○ | 해당 캐릭터 1턴 생성 | S3 | S3 상세 예정 | R-MSG-003 · R-MSG-007 | — |
| E10 | `PATCH /api/messages/:id` | ○ | 메시지 수정 | S2 | **확정** | R-MSG-004 · R-MSG-008 | §4.10 |
| E11 | `DELETE /api/messages/:id` | ○ | 메시지 삭제 | S2 | **확정** | R-MSG-005 · R-MSG-008 | §4.11 |
| E12 | `POST /api/messages/:id/regenerate` | ○ | 같은 캐릭터로 재생성 | S3 | S3 상세 예정 | R-MSG-006 · R-MSG-007 | — |
| E13 | `GET /api/rooms/:id/memory` | ○ | 장기기억 보기 | S4 | S4 상세 예정 | R-MEM-001 | — |
| E14 | `PUT /api/rooms/:id/memory` | ○ | 장기기억 편집 | S4 | S4 상세 예정 | R-MEM-001 | — |

- **방 단건 조회(`GET /api/rooms/:id`)는 없다.** 대화 화면 상단 바의 방 제목·생성일(R-CHAT-001)은 `listRooms()` 결과에서 찾는다. 마지막 본 방 복원(R-ROOMS-004)도 `listRooms()`를 먼저 부른 뒤 id로 찾는다.
- S3~S4 행의 요청·응답 필드는 해당 묶음에서 정한다. 이 문서는 아직 추측하지 않는다.
- 같은 경로 패턴을 여러 메서드가 쓴다: `PATHS.rooms`(GET E3 · POST E4), `PATHS.room`(PATCH E5 · DELETE E6), `PATHS.message`(PATCH E10 · DELETE E11).

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
    /** RATE_LIMITED 에만 붙는다. 다음 분 창까지 남은 초(정수 ≥ 1). 같은 값이 Retry-After 헤더에도 실린다 (R-AUTH-005, S2) */
    retryAfterSec?: number
  }
}
```

- (S2) 추가는 본문 타입 4개와 `ApiErrorBody.error.retryAfterSec?` 하나다. 기존 타입·필드는 바꾸지 않았다.
- `CreateRoomBody`와 `RenameRoomBody`는 모양이 같지만 엔드포인트별 계약이라 따로 둔다. 한쪽만 바뀌어도 다른 쪽에 번지지 않는다.
- `TokenPayload`는 shared에 두지 않는다(§2.3).
- `Message`·`RoomSummary`는 쓰기 응답에 그대로 쓴다. 새 응답 타입은 없다. `DELETE` 성공은 본문이 없다(`204`).

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

---

## 6. 레이트리밋·페이지네이션

| 항목 | S1 | 이후 |
|---|---|---|
| 읽기 레이트리밋 | 없음(E2·E3·E7) | 없음 |
| 쓰기 레이트리밋 | 해당 없음 | **S2 확정** — §6.1 |
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
| 읽기 | 세지 않는다(E2·E3·E7) |
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

---

## 10. 요구 추적표

| 요구ID | 계약 항목 | 절 | 판정 | 호환성 | 테스트ID | 상태 |
|---|---|---|---|---|---|---|
| R-API-001 🔒 | 엔드포인트 집합 14행, `PATHS`, 단건 방 조회 없음, 미등록 메서드 404 | §4.0 · §3.5 · §5.4 · §12 | 신규(S2 확장) | 추가 | API-T-013 · 042 · 045 | S1·S2 행 확정, S3~S4 행 예정 |
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
| R-NFR-003 🔒 (레이트리밋 몫) | 초과 `429` | §6.1 | 신규 | 추가 | API-T-054, server SRV-T-114 | 확정(S2), speak 409는 S3 |
| R-ROOMS-002 🔒 | 「+ 새 방」이 쓰는 `createRoom`, 토큰 있을 때만 | §2.4 · §4.6 · §11.6 | 신규 | 추가 | API-T-UI-011, 화면 TC | 계약 확정 |
| R-CHAT-004 🔒 · R-CHAT-006 🔒 | 하단 바 전송이 쓰는 `appendUser`(OOC 토글 = `ooc`), AI 미호출 | §4.9 · §11.6 | 신규 | 추가 | API-T-UI-011, 화면 TC | 계약 확정 |
| R-CHAT-007 🔒 (수정·삭제) | 말풍선 메뉴가 쓰는 `editMessage`·`deleteMessage` | §4.10 · §4.11 · §11.6 | 신규 | 추가 | API-T-UI-011 · 015, 화면 TC | 계약 확정(재작성은 S3) |
| R-CHAT-001 🔒 (⋯ 메뉴) | 이름 변경·방 삭제가 쓰는 `renameRoom`·`deleteRoom` | §4.7 · §4.8 · §11.6 | 신규 | 추가 | API-T-UI-011 · 015, 화면 TC | 계약 확정(장기기억은 S4) |
| R-CHAT-009 🔒 | `?t=` 1회 읽기, 메모리만, 쓰기 헤더 부착 | §2.4 · §11.6 | 신규 | 추가 | API-T-UI-011 · 018 | 계약 확정 |
| R-CHAT-011 | 인증 실패 3코드 → 읽기 전용 전환(`isAuthFailure`), `RATE_LIMITED` 안내·`retryAfterSec` | §2.4 · §3.4 · §11.6 | 신규 | 추가 | API-T-UI-014 · 016, 화면 TC | 계약 확정 |
| R-ENV-003 | 모든 경로 `500 CONFIG_INVALID` | §3.2 · §4.1 | 신규 | 추가 | API-T-003 | 확정 |
| R-LLM-002 🔒 (표시 메타, 2026-10-05 개정) | `CHARACTERS`(id·name·shortName·avatar) | §5.5 | 신규 | 추가 | API-T-043 | 확정 |
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

### 13.1 S2 변경 분류 (v0.3)

| 변경 | 분류 | 영향 받는 곳 | 비고 |
|---|---|---|---|
| 엔드포인트 E4·E5·E6·E8·E10·E11 상세 확정 | 추가 | 없음(이전에는 `404`) | §4.0 집합은 S1부터 같다(R-API-001) |
| `PATHS.room` · `roomUser` · `message`, `endpoints.room/roomUser/message` | 추가 | 없음(기존 키 그대로) | shared 테스트 API-T-042의 "PATHS 값 4개" 기대를 7개로 고친다(테스트 갱신, 소비자 영향 없음) |
| `CreateRoomBody` · `RenameRoomBody` · `UserMessageBody` · `EditMessageBody` | 추가 | 없음 | |
| `ApiErrorBody.error.retryAfterSec?` | 추가(선택 필드) = **비파괴** | 없음. 기존 소비자는 모르는 키를 무시한다 | routes 테스트 `expectContractError`가 "키 정확히 2개"를 검사하므로 `RATE_LIMITED`만 3개로 허용하도록 고친다(테스트 갱신) |
| `ApiError.retryAfterSec?`(ui) | 추가(선택 필드) | 없음 | 화면은 아직 쓰지 않는다 |
| `request(path)` → `request(path, options?)` | 추가(선택 인자) | api 폴더 내부만. 기존 호출 그대로 동작 | 화면은 `request`를 쓰지 않는다 |
| `204` 정규화 규칙 | 추가 | 없음(기존 엔드포인트는 204를 내지 않는다) | |
| `configureClient` · `isAuthFailure` | 추가 | 없음 | `configureClient`를 부르지 않으면 getter가 `null`이라 S1 동작과 같다 |
| 토큰 형식·payload·`?t=` 확정 | 추가(처음 확정) | 저쪽 PHP — **아직 전달 전**이라 재적용 없음 | 이후 바꾸면 **파괴 + 저쪽 PHP 재적용**(§8) |
| `ERROR_CODES`·status·문구 | 변경 없음 | — | 13종 그대로 |
| `shared/src/limits.ts` 신규(v0.3.1) | 추가 | 없음(새 파일). server rooms·messages의 모듈 상수는 shared 재노출로 바뀐다(값 같음, S2-R4) | 상한 값을 바꾸면 화면·서버가 함께 바뀐다. 완화는 비파괴, 강화는 기존 데이터·화면 입력에 대해 파괴 |

- **파괴 변경 0건.** S1 엔드포인트(E1·E2·E3·E7)의 요청·응답·에러는 바뀌지 않았다. `GET /api/rooms/:id`는 여전히 `404`다(API-T-013).
- 이후 바뀔 수 있는 자리: 확정사항 §9-5(권한 "누구나")가 "작성자만"·"관리자만"으로 바뀌면 E5·E6·E10·E11에 `403` 계열 조건이 생긴다. 새 코드가 필요하면 13종 밖이라 R-API-002 개정이 필요하다(파괴는 아니지만 화면 안내 추가).

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
| API-T-043 | `characters_meta_matches_contract` | 키가 정확히 `sebastian`·`ciel`, 각 `id`가 키와 같음, `name`이 확정사항 §1 전체 이름, `shortName`이 `세바스찬`·`시엘`, `avatar === '/embed/img/{id}.png'` | R-LLM-002 · R-CHAT-002 |
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

### 14.5 S2 routes — `server/test/routes.test.ts` (API-T-050 ~ 066)

준비:

- 토큰: server가 만드는 `server/test/token.ts`의 `signTestToken(payload, 'test-secret')`(vitest 바인딩 `TOKEN_SECRET`과 같은 값, auth.md §3·§9.1). 기본 payload는 `{ mb_id: 'writer_a', nick: '테스터', ch_name: '시엘 팬텀하이브', level: 5, exp: NOW / 1000 + 43200 }`이고 테스트마다 필요한 키만 바꾼다.
- 시각: 기존 `NOW = 1_700_000_000_000` 그대로. 분 창 시작이 `1_699_999_980_000`이라 `retryAfterSec`는 항상 **40**이다.
- 설정: `TOKEN_MIN_LEVEL`·`RATE_LIMIT_PER_MIN`은 기본값(5·20)을 쓰고, 한도 테스트만 `baseEnv({ RATE_LIMIT_PER_MIN: '2' })`처럼 바꾼다. `resetDb`가 `rate_limits`도 비운다(이미 구현됨).
- `WRITES` 표: 6개 엔드포인트의 `{ method, path, body }`를 시드 방·메시지로 채워 050~053이 같은 표를 돈다.
- `expectContractError(res, code)` 갱신: `RATE_LIMITED`만 `error` 키가 정확히 `code`·`message`·`retryAfterSec`이고 `Retry-After` 헤더가 같은 값이다. 나머지 코드는 S1처럼 정확히 `code`·`message`다.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-050 | `writes_require_token_on_all_six_endpoints` | `WRITES` 6개, `Authorization` 없음 | 전부 `expectContractError(res, 'TOKEN_REQUIRED')`. 방 수·메시지 본문 불변 | R-AUTH-003(라우트 표 전건 대조) |
| API-T-051 | `writes_ignore_query_cookie_and_non_bearer_token` | `POST /api/rooms`에 유효 토큰을 `?t=`로만 · `Cookie: t=`로만 · `Authorization: Basic <t>` · `Authorization: Bearer ` | 전부 401 `TOKEN_REQUIRED` | R-AUTH-003 · R-API-003 |
| API-T-052 | `writes_reject_forged_or_expired_token` | `WRITES` 6개 × SECRET `wrong-secret` 토큰. 추가로 `exp = NOW / 1000`(경계) · `level: "5"`(문자열) | 전부 401 `TOKEN_INVALID`, message = 기본 문구(단계 정보 없음) | R-AUTH-001 · R-AUTH-002 |
| API-T-053 | `writes_reject_low_level_with_LEVEL_TOO_LOW` | `WRITES` 6개 × `level: 4`. 추가로 만료된 `level: 4` | 6개 403 `LEVEL_TOO_LOW`. 만료+저등급은 401 `TOKEN_INVALID`(만료 우선) | R-AUTH-002 |
| API-T-054 | `writes_rate_limited_on_21st_request` | 같은 토큰으로 `POST /api/rooms` 21회, 이어서 다른 `mb_id`로 1회 | 1~20번째 201, 21번째 `expectContractError(res, 'RATE_LIMITED')` + `retryAfterSec === 40` + `Retry-After: 40`, 방 20개. 다른 `mb_id`는 201 | R-AUTH-005 · R-NFR-003 · R-API-002 |
| API-T-055 | `auth_precedes_validation_and_failed_writes_are_counted` | 한도 2. ① 토큰 없이 `{}` ② 위조 토큰 3회 ③ 유효 토큰으로 `{}` 2회 ④ 유효 토큰으로 정상 본문 | ① 401(400 아님) ② 401 ×3(세지 않음) ③ 400 ×2(셈) ④ 429 | R-AUTH-003 · R-AUTH-005 |
| API-T-056 | `reads_stay_open_and_do_not_count` | 한도 1. 쓰기 1회(201) 뒤 `GET /api/rooms`·`GET …/messages`를 헤더 없음·위조 토큰·유효 토큰으로 | 읽기 전부 200. `rate_limits.count` = 1 그대로 | R-AUTH-003 |
| API-T-057 | `create_room_returns_201_summary` | `{ title: '  안개 낀 런던  ' }` · `{ title: 'x', foo: 1 }` | 201. 키가 정확히 `id,title,createdAt,updatedAt,messageCount`, `title === '안개 낀 런던'`, `id`가 UUID v4, `createdAt === updatedAt === NOW`, `messageCount === 0`. `GET /api/rooms` 첫 항목과 같음. 모르는 키는 무시하고 201 | R-ROOM-002 · R-API-004 |
| API-T-058 | `create_room_rejects_bad_title_or_body` | 제목 `''`·`'   '`·61자·이모지 61개 / 통과 60자·이모지 60개 / 본문 `{}`·`{ title: 1 }`·깨진 JSON·`Content-Type` 없는 JSON | 제목 위반 400 `방 제목은 1~60자로 입력해 주세요.`, 통과 201, 형식 위반 400 `요청 형식이 올바르지 않습니다.` | R-ROOM-002 · R-API-004 |
| API-T-059 | `rename_room_keeps_updatedAt_and_validates` | 메시지 2개·`updated_at` 100인 방 → `{ title: '새 이름' }` / 61자 / 없는 id / 없는 id + 61자 | 200 `title` 변경·`updatedAt === 100`·`messageCount === 2`, 목록 순서 불변 / 400 / 404 `방을 찾을 수 없습니다.` / 400 | R-ROOM-003 · R-ROOM-005 |
| API-T-060 | `delete_room_returns_204_and_cascades` | 메시지 3개 방 삭제, 같은 방 다시 삭제 | 204·본문 빈 문자열. 이어 `GET …/messages` 404, 목록에서 빠짐, 두 번째 삭제 404 | R-ROOM-004 · R-DB-003 |
| API-T-061 | `append_user_returns_201_message` | `{ text: ' 안녕 ', ooc: false }` · `ooc: true` · `ch_name: ''` 토큰 | 201. 키가 정확히 `id,roomId,speaker,kind,text,authorName,createdAt`(`authorMbId` 없음), `speaker 'user'`, `kind` `line`/`ooc`, `text '안녕'`, `authorName` `'시엘 팬텀하이브'` / nick `'테스터'`, `createdAt === NOW`. 방 `updatedAt === NOW`, DB `author_mb_id === 'writer_a'` | R-MSG-002 · R-AUTH-004 · R-ROOM-005 · R-AUTH-006 |
| API-T-062 | `append_user_rejects_bad_body_or_room` | `text` `''`·`'  \n '`·2001자 / `{ text: 'x' }`·`{ text: 'x', ooc: 'true' }`·`{ text: 1, ooc: false }` / 없는 방 | 400 `메시지는 1~2000자로 입력해 주세요.` / 400 기본 문구 / 404 `방을 찾을 수 없습니다.`. 메시지 0건 추가 | R-MSG-002 |
| API-T-063 | `edit_message_returns_200_and_keeps_meta` | 유저 메시지·캐릭터 메시지에 `{ text: ' 고침 ' }` | 200, `text '고침'`, `speaker`·`kind`·`authorName`·`createdAt` 그대로, 방 `updatedAt === NOW` | R-MSG-004 · R-ROOM-005 |
| API-T-064 | `message_id_and_text_errors` | PATCH·DELETE에 id `abc`·`0`·`1.5`·`0x10`·`1e1`·없는 큰 수 / 있는 id에 2001자 / `abc` + 빈 본문 | 404 `메시지를 찾을 수 없습니다.` / 400 / 404(id 판정이 먼저) | R-MSG-004 · R-MSG-005 |
| API-T-065 | `delete_message_returns_204` | 메시지 3개 중 가운데 삭제, 같은 id 다시 삭제 | 204, 페이지에 2건, 방 `updatedAt === NOW`, 두 번째 404 | R-MSG-005 · R-ROOM-005 |
| API-T-066 | `other_mb_id_can_modify_rooms_and_messages` | `writer_a`가 방·유저 메시지 생성 → `writer_b` 토큰으로 방 이름 변경·메시지 수정·메시지 삭제·방 삭제 | 200 · 200 · 204 · 204 | R-ROOM-003 · R-ROOM-004 · R-MSG-008 |

- 정상 경로 9개(054 일부·056·057·059 일부·060·061·063·065·066)보다 에러 입력이 많다(050~053만 27건).

### 14.6 S2 shared — `shared/test/*.test.ts`

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| API-T-042(갱신) | `endpoints_build_paths_and_queries` | `PATHS` 값 **7개**. 나머지 기대는 S1 그대로 | R-API-001 · R-API-008 |
| API-T-045 | `endpoints_build_write_paths` | `PATHS.room === '/api/rooms/:id'`, `roomUser === '/api/rooms/:id/user'`, `message === '/api/messages/:id'`. `room('a b/c')` → `/api/rooms/a%20b%2Fc`, `roomUser('r1')` → `/api/rooms/r1/user`, `message(41)` → `/api/messages/41` | R-API-001 · R-API-008 |
| API-T-046 | `limits_match_requirements_and_count_code_points` (v0.3.1) | 상수 `60`·`2000`·`4000`. `countCodePoints`: `''` → 0, `'abc'` → 3, `'한글'` → 2, `'😀'` → 1(`.length`는 2), `'👨‍👩‍👧'` → 5, 이모지 60개 → 60. `normalizeText`: `'  a \n b \n'` → `'a \n b'`(중간 유지), `'　x　'` → `'x'`, `'   '` → `''` | R-ROOM-002 · R-MSG-002 · R-MSG-004 · R-MEM-001 |

### 14.7 S2 ui/api — `ui/src/api/api.test.ts` (`vi.stubGlobal('fetch', …)`, 각 테스트 전에 `configureClient({ getToken: () => null })`)

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| API-T-UI-011 | `write_wrappers_send_method_url_body_and_bearer` | getter `'tok'`. `createRoom({ title: 't' })` POST `/api/rooms` 본문 `{"title":"t"}` · `renameRoom('a b', …)` PATCH `/api/rooms/a%20b` · `deleteRoom('r1')` DELETE `/api/rooms/r1`(본문·`Content-Type` 없음) · `appendUser('r1', { text: 'x', ooc: true })` POST `/api/rooms/r1/user` · `editMessage(41, { text: 'y' })` PATCH `/api/messages/41` · `deleteMessage(41)` DELETE `/api/messages/41`. 6개 모두 `Authorization: Bearer tok`, 본문이 있으면 `Content-Type: application/json` | R-API-003 · R-CHAT-009 · R-ROOMS-002 · R-CHAT-006 · R-CHAT-007 |
| API-T-UI-012 | `read_wrappers_never_send_authorization` | getter `'tok'`인데 `listRooms`·`listMessages`·`getHealth`에 `Authorization`·`Content-Type` 없음, method GET | R-AUTH-003 · R-API-003 |
| API-T-UI-013 | `write_without_token_sends_no_authorization` | getter `null` · `''` 각각 `createRoom` → 헤더 없음. 서버 401 `TOKEN_REQUIRED` 본문을 그대로 `Result.error`로 | R-API-003 |
| API-T-UI-014 | `rate_limited_carries_retryAfterSec` | 429 `{ error: { code: 'RATE_LIMITED', message, retryAfterSec: 40 } }` → `error.retryAfterSec === 40`. 값이 `0`·`'40'`·`1.5`·없음이면 키 없음(`'retryAfterSec' in error === false`). `NOT_FOUND`에 붙어 오면 버림 | R-AUTH-005 · R-CHAT-011 |
| API-T-UI-015 | `delete_wrappers_map_204_to_ok_undefined` | 204 본문 없음 → `{ ok: true, value: undefined }`, `json()` 미호출. 201 빈 본문(`createRoom`)은 S1 규칙대로 `INTERNAL` | R-ROOM-004 · R-MSG-005 · R-API-002 |
| API-T-UI-016 | `isAuthFailure_matches_three_auth_codes` | `TOKEN_REQUIRED`·`TOKEN_INVALID`·`LEVEL_TOO_LOW` → true. `RATE_LIMITED`·`VALIDATION_ERROR`·`NOT_FOUND`·`NETWORK`·`INTERNAL` → false | R-CHAT-011 |
| API-T-UI-017 | `write_wrappers_send_contract_keys_only_and_never_reject` | `createRoom({ title: 't', extra: 1 } as CreateRoomBody)` → 본문 `{"title":"t"}`. `appendUser`도 `text`·`ooc`만. 6개 쓰기 래퍼가 `fetch` throw·500 HTML에서도 reject하지 않음(`NETWORK`·`INTERNAL`) | R-API-002 · R-API-004 |
| API-T-UI-018 | `token_never_persisted_or_sent_in_query`(리뷰 grep) | §14.8의 grep 결과 0건 | R-API-003 · R-CHAT-009 · R-AUTH-006 |

### 14.8 S2 리뷰·수동

```bash
# 토큰 저장 금지 (API-T-UI-018) — token.ts 는 ui 구현 후 대상에 포함
grep -rnE "localStorage|sessionStorage|document\.cookie|indexedDB" ui/src/api ui/src/state/token.ts
# API 호출에 ?t= 금지
grep -rn "?t=" ui/src/api
# 인증 미들웨어 전역 적용·principal 직접 읽기 금지
grep -rnE "\.use\(|get\('principal'\)" server/src/routes
```

- 라우트 핸들러 30줄 이내, 쓰기 핸들러 6개 모두 `requireToken`·`rateLimitWrites`가 `validate` 앞(R-API-007, API-T-050이 자동 대조).
- 수동: `wrangler dev`에서 토큰 없이 `curl -i -X POST http://localhost:3000/api/rooms -H 'content-type: application/json' -d '{"title":"x"}'` → 401 `TOKEN_REQUIRED`. 로컬 SECRET으로 만든 토큰으로 21회 → 21번째 `429`·`Retry-After`.

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

### 15.4 확인 필요: 결정 완료 (v0.2, 2026-10-05 메인 세션 결정)

| # | 결정 | 반영 절 |
|---|---|---|
| 1 | R-LLM-002를 개정해 `CharacterMeta`에 `shortName`(세바스찬 / 시엘)을 추가한다. `name`은 전체 이름을 유지한다 | §5.5 · §10 · §12 · §14.2 |
| 2 | R-CHAT-009는 S2로 이동했다. S1 화면은 항상 읽기 전용이다. 토큰 보관은 `ui/src/state/token.ts`, `client.ts`는 getter 주입으로 헤더만 붙인다(S2 상세 예정) | §2.1 · §2.2 · §11.3 |
| 3 | `GET /api/rooms` 응답은 배열 그대로 유지한다(방 목록 페이지네이션 요구 없음) | 변경 없음 |
| 4 | 요구 추적표는 §10 위치를 유지한다 | 변경 없음 |

아래는 v0.1 당시 질문 원문이다(기록용).

1. **캐릭터 표시명.** 확정사항 §1과 위임문대로 `name`은 전체 이름(`세바스찬 미카엘리스`·`시엘 팬텀하이브`)이다. 화면 구성안은 말풍선에 짧은 이름(`시엘`·`세바스찬`)을 그린다. 짧은 이름이 필요하면 R-LLM-002의 표시 메타에 필드를 추가하는 요구 개정이 필요하다. 그전까지 화면은 `name`을 그대로 쓴다.
2. **R-CHAT-009 묶음과 토큰 보관 위치.** requirements.md §0은 CHAT-009를 S1에, rtm.md는 S2(`ui/src/state/token`)에 둔다. ui-design-strategy는 `ui/src/api/client.ts` 보관을 말한다. 이 계약은 S1에서 토큰을 다루지 않는다고 가정했다. 그러면 S1 화면은 언제나 읽기 전용이고, 쓰기 UI가 아직 없으니 R-CHAT-008은 자연히 충족된다. 보관 위치는 S2에서 정해야 한다.
3. **`GET /api/rooms` 응답 형태.** 위임문대로 배열 그대로 둔다. 방 목록에 페이지네이션이나 부가 정보가 요구되면 응답 형태 변경(파괴)이 된다. 지금 `{ rooms: [...] }`로 감싸면 그 위험이 없다. 다만 위임문과 다르므로 바꾸려면 결정이 필요하다.
4. **절 배치.** 위임문은 요구 추적표를 끝에 두라고 했다. 스킬 §13의 고정 절 번호에 따라 §10에 두었고, 구현 설계는 §11~§15 부록으로 붙였다.

### 15.5 S2에서 쓰는 server 함수·타입 (모두 server S2 설계에 있음, 구현 전)

| 사용처 | server 쪽 | 출처 |
|---|---|---|
| 쓰기 라우트 6개 | `requireToken: MiddlewareHandler<AppEnv>` · `rateLimitWrites: MiddlewareHandler<AppEnv>` (`server/src/auth`) | auth.md §2 · §9.1 |
| E8 | `getPrincipal(c: Context<AppEnv>): Principal` | auth.md §2 |
| E4 | `RoomsService.createRoom(input: RoomTitleInput): Promise<RoomSummary>` | rooms.md §2 |
| E5 | `RoomsService.renameRoom(id: string, input: RoomTitleInput): Promise<RoomSummary>` | rooms.md §2 |
| E6 | `RoomsService.deleteRoom(id: string): Promise<void>` | rooms.md §2 |
| E8 | `MessagesService.addUserMessage(roomId: string, input: UserMessageInput, author: MessageAuthor): Promise<Message>` | messages.md §2 |
| E10 | `MessagesService.editMessage(messageId: number, input: MessageTextInput): Promise<Message>` | messages.md §2 |
| E11 | `MessagesService.deleteMessage(messageId: number): Promise<void>` | messages.md §2 |
| `RATE_LIMITED` 응답 | `AppError(code, message?, { retryAfterSec })` → onError가 본문 `error.retryAfterSec` + `Retry-After` | index.md §2.4 · §5.1 |
| 라우트 테스트 | `signTestToken(payload, secret)`(`server/test/token.ts`) | auth.md §3 |

- env 바인딩·설정 추가: **없음.** `TOKEN_SECRET`(Secrets)·`TOKEN_MIN_LEVEL`·`RATE_LIMIT_PER_MIN`(`wrangler.toml [vars]`)은 이미 있다.

### 15.6 server 설계 변경 요청 (S2 — 막는 것 없음, 권고·문구 정리)

| # | 대상 | 요청 | 이유 |
|---|---|---|---|
| S2-R1 | messages.md §9 "메시지 경로 `:id`는 라우트가 `Number(문자열)`로만 바꿔 넘긴다" | 문구를 "10진 숫자 문자열만 `Number()`, 그 밖은 `NaN`"(§4.5 `messageIdParam`)으로 맞춘다. **서비스 변경 없음**(`isMessageId(NaN)` → `NOT_FOUND` 그대로) | `Number('0x10') = 16`·`Number('1e1') = 10`이라 한 메시지에 여러 URL이 생긴다. 라우트 변환은 contract 소관이라 계약에서 좁혔다 |
| S2-R2 | index.md §2.4 `toErrorBody` | 반환 타입을 `@shared/types`의 `ApiErrorBody`로 둔다(`import type`) | `retryAfterSec` 위치·이름이 바뀌면 server가 컴파일에서 바로 알게 한다(auth.md §9.2·index.md §9 "contract가 다르게 정하면 맞춘다"에 대한 답: **위치는 `error.retryAfterSec`, 이름 그대로**) |
| S2-R3 | rooms.md §9 · messages.md §9의 "contract가 정한다" 항목 | 결정값을 반영한다: 성공 status 생성 `201`·변경 `200`·삭제 `204`(본문 없음), `ooc`는 필수(기본값 없음) | 문서 간 미결 표시 정리 |
| S2-R4 (v0.3.1) | rooms.md §2·§2.1 · messages.md §2·§2.2 | rooms·messages 서비스가 `@shared/limits`를 쓴다. `normalizeTitle`·`normalizeMessageText`는 `normalizeText`·`countCodePoints`·`ROOM_TITLE_MAX`·`MESSAGE_TEXT_MAX`로 판정하고, 모듈의 `ROOM_TITLE_MAX`·`MESSAGE_TEXT_MAX`는 새로 정의하지 않고 shared에서 재노출한다(S4 memory는 `MEMORY_SUMMARY_MAX`) | 화면과 서버가 같은 상수·같은 세기 함수를 써서 길이 판정이 어긋나지 않게 한다(메인 세션 승인, 2026-10-05) |

### 15.7 확인 필요 (S2)

계약이 정한 것(되돌리려면 알려 달라, 지금은 막지 않음):

1. **`TOKEN_REQUIRED`도 읽기 전용 전환**(§2.4). R-CHAT-011은 `TOKEN_INVALID`·`LEVEL_TOO_LOW` 두 개만 적었다. 쓰기 UI가 보이는데 서버가 토큰 없음으로 답하는 경우도 같은 처리로 닫았다.
2. **삭제 성공은 `204` 본문 없음.** `{ ok: true }` 대신 택했다. 요구에 없는 필드를 만들지 않고, 화면은 `Result<void>`만 본다.
3. **`ooc`는 필수.** 기본값 `false`를 두면 같은 요청에 두 표기가 생긴다.
4. **`?t=`는 URL에서 지우지 않는다**(R-CHAT-009가 요구하지 않음).

사용자 확인이 남은 기본값(확정사항 §9, 값이 바뀌어도 계약 구조는 같다):

- §9-1 `TOKEN_MIN_LEVEL` = 5 · §9-2 표시 이름(`ch_name` 우선) · §9-5 이름 변경·삭제·메시지 수정·삭제 권한 "등급 통과자 누구나" · §9-6 분당 20회.
