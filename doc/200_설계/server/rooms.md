# rooms 모듈 설계

- 상태: S1 확정(구현 동기화) · S2 초안 · 최종 갱신: 2026-10-05
- 묶음: S1 = R-ROOM-001(목록) · R-ROOM-005(갱신 규칙). S2 = R-ROOM-002(생성) · R-ROOM-003(이름 변경) · R-ROOM-004(삭제).
- 관련 문서: [db.md](db.md)(`rooms` 저장소), [messages.md](messages.md)(`updated_at` 갱신을 일으키는 쓰기), [auth.md](auth.md)(쓰기 라우트 미들웨어), [index.md](index.md)(서비스 컨테이너).

## 1. 목적

방은 대화 공책 한 권이다. rooms 모듈은 공책 목록을 "마지막으로 쓴 날짜가 최근인 순"으로 꽂아 두는 책장 관리인이다. 새 공책을 꽂고(생성), 표지 제목을 바꾸고(이름 변경), 공책을 속지째 버린다(삭제).

| 요구ID | 내용 |
|---|---|
| R-ROOM-001 🔒 | 방 목록: `id, title, createdAt, updatedAt, messageCount`, `updatedAt` 내림차순, 누구나 |
| R-ROOM-002 🔒 | 방 생성: `title` trim 후 1~60자, id `crypto.randomUUID()`, 토큰 필요 |
| R-ROOM-003 🔒 (확인 필요 §9-5) | 이름 변경: 등급 통과자 누구나, `title` 규칙 동일 |
| R-ROOM-004 🔒 (확인 필요 §9-5) | 삭제: 등급 통과자 누구나, messages·memory 실삭제(soft delete 없음), 삭제 후 404·고아 0건 |
| R-ROOM-005 | `updated_at`은 메시지 추가·수정·삭제·재작성 시 갱신 |
| R-DB-003 | 방 삭제는 messages·memory 삭제와 한 batch |

## 2. 공개 API

```ts
// server/src/rooms/index.ts
import type { Db, RoomSummary } from '../db'

export type { RoomSummary }

/** R-ROOM-002 제목 최대 글자 수(코드 포인트) */
export const ROOM_TITLE_MAX = 60

export type RoomTitleInput = { title: string }

export type RoomsService = {
  /** 전 방을 updatedAt 내림차순으로. 방이 없으면 빈 배열 (S1) */
  listRooms: () => Promise<RoomSummary[]>
  /** 방을 만든다. createdAt = updatedAt = now, messageCount 0 (S2) */
  createRoom: (input: RoomTitleInput) => Promise<RoomSummary>
  /** 제목만 바꾼다. updatedAt 은 그대로 (S2) */
  renameRoom: (id: string, input: RoomTitleInput) => Promise<RoomSummary>
  /** memory·messages·rooms 를 한 batch 로 실삭제 (S2) */
  deleteRoom: (id: string) => Promise<void>
}

export type RoomsDeps = { db: Db; now: () => number }

export const createRoomsService = (deps: RoomsDeps): RoomsService

// server/src/rooms/title.ts — 순수 함수
/** trim 후 코드 포인트 1~60자면 trim 결과를, 아니면 AppError VALIDATION_ERROR */
export const normalizeTitle = (raw: string): string
```

| 이름 | 인자 | 반환 | 실패 조건(에러 코드) | 요구ID |
|---|---|---|---|---|
| `createRoomsService` | `{ db, now }` | `RoomsService` | — | R-ROOM-001~004 |
| `listRooms` | — | `Promise<RoomSummary[]>` | 업무 에러 없음. D1 장애 전파 → `INTERNAL` | R-ROOM-001 |
| `createRoom` | `{ title }` | `Promise<RoomSummary>` | 제목 규칙 위반 → `VALIDATION_ERROR`(400, DB 접근 전) | R-ROOM-002 |
| `renameRoom` | `id, { title }` | `Promise<RoomSummary>` | 제목 규칙 위반 → `VALIDATION_ERROR`(400, DB 접근 전), 방 없음 → `NOT_FOUND`(404) | R-ROOM-003 |
| `deleteRoom` | `id` | `Promise<void>` | 방 없음 → `NOT_FOUND`(404) | R-ROOM-004 · R-DB-003 |
| `normalizeTitle` | `raw: string` | `string` | `VALIDATION_ERROR` | R-ROOM-002·003 |
| `ROOM_TITLE_MAX` | — | `60` | — | R-ROOM-002 |

- `RoomSummary` = `{ id: string; title: string; createdAt: number; updatedAt: number; messageCount: number }` — `@shared/types`의 계약 타입을 db가 재노출한 것([db.md](db.md) §2.1). 시각은 epoch ms.
- 정렬: `updatedAt` 내림차순, 같으면 `id` 오름차순. 정렬은 SQL이 하고 서비스는 다시 정렬하지 않는다.
- 쓰기 함수는 `Principal`을 받지 않는다. 권한은 "등급 통과자 누구나"(R-ROOM-003·004)라 라우트 미들웨어([auth.md](auth.md))를 통과했으면 충분하고, rooms 테이블에 작성자 컬럼이 없다(§11 D-ROOM-5).

### 2.1 제목 규칙 (R-ROOM-002·003)

| 규칙 | 값 |
|---|---|
| 정규화 | `raw.trim()`(앞뒤 공백·줄바꿈 제거). 저장·응답은 trim한 값 |
| 길이 | trim 후 **코드 포인트** 1~60(`Array.from(s).length`). DB CHECK `length(title)`와 같은 단위 — 이모지 1개 = 1자 |
| 내용 | 그 밖의 제한 없음(중간 공백·특수문자 허용, 중복 제목 허용) |
| 위반 메시지 | `방 제목은 1~60자로 입력해 주세요.` |

- 라우트는 `title`이 문자열인지만 본다. 길이·trim 판정의 단일 소스는 이 함수다(zod `.max()`는 UTF-16 단위라 CHECK와 어긋난다 — §9).

### 2.2 각 함수의 흐름

| 함수 | 흐름 |
|---|---|
| `createRoom` | `title = normalizeTitle(input.title)` → `id = crypto.randomUUID()`, `nowMs = now()` → `db.rooms.insert({ id, title, nowMs })` → `{ id, title, createdAt: nowMs, updatedAt: nowMs, messageCount: 0 }` 반환(재조회 없음) |
| `renameRoom` | `title = normalizeTitle(input.title)` → `summary = await db.rooms.updateTitle(id, title)` → `null`이면 `NOT_FOUND` → `summary` 반환 |
| `deleteRoom` | `deleted = await db.rooms.deleteCascade(id)` → `false`면 `NOT_FOUND` |

## 3. 내부 구조

| 파일 | 책임 |
|---|---|
| `server/src/rooms/index.ts` | 문서주석 6항목, `createRoomsService`·`normalizeTitle`·`ROOM_TITLE_MAX`·타입 재노출 |
| `server/src/rooms/service.ts` | `listRooms`·`createRoom`·`renameRoom`·`deleteRoom` |
| `server/src/rooms/title.ts` | `normalizeTitle`, `ROOM_TITLE_MAX`, 위반 메시지 상수 |
| `server/test/rooms.test.ts` | SRV-T-040~043(S1), SRV-T-130~135(S2) |

- 의존: `../db`(타입·`Db`), `../app-error`. 다른 서비스·`auth`·`llm`·HTTP 객체를 모른다.
- 상태 없음. id 생성은 Workers 전역 `crypto.randomUUID()`(주입하지 않는다 — 테스트는 반환값을 쓴다).

## 4. 비동기·동시성

```
GET    /api/rooms      ─▶ listRooms()            ─▶ db.rooms.listSummaries()                ─▶ D1 (읽기 1)
POST   /api/rooms      ─▶ [requireToken·rateLimitWrites] ─▶ createRoom({title})
                              normalizeTitle ── 위반 → VALIDATION_ERROR (D1 접근 전)
                              db.rooms.insert({ id: randomUUID(), title, nowMs })        ─▶ D1 (쓰기 1)
PATCH  /api/rooms/:id  ─▶ [미들웨어] ─▶ renameRoom(id,{title})
                              normalizeTitle ── 위반 → VALIDATION_ERROR
                              db.rooms.updateTitle(id, title)  ── batch[UPDATE, SELECT 요약]  ─▶ D1 (왕복 1)
                              null → NOT_FOUND
DELETE /api/rooms/:id  ─▶ [미들웨어] ─▶ deleteRoom(id)
                              db.rooms.deleteCascade(id) ── batch[DELETE memory, DELETE messages, DELETE rooms] ─▶ D1 (원자적)
                              false → NOT_FOUND
```

- 잠금 없음. 경합은 D1 문장 단위 원자성으로 정리된다.
  - 이름 변경과 삭제가 겹치면 먼저 실행된 쪽이 이기고, 나중 것은 `NOT_FOUND`(삭제 후 변경) 또는 성공 후 삭제된다.
  - 삭제와 메시지 추가가 겹치면 메시지 INSERT가 "방이 있을 때만" 조건이라 고아가 생기지 않는다([messages.md](messages.md) §4). 삭제 batch 안에서는 외래 키 순서(memory → messages → rooms)를 지킨다.
  - S3 speak 진행 중(`speaking_until` 잠금) 방 삭제는 막지 않는다. speak 결과 저장이 방 없음으로 실패하는 처리는 S3 설계에 인계한다(§11).
- 비용: 생성 쓰기 1행. 이름 변경 쓰기 1행 + 읽기(방 1 + 메시지 수). 삭제는 쓰기 = 1 + 그 방 메시지 수 + memory 0~1행.

### 4.1 `updated_at` 갱신 규칙 (R-ROOM-005)

| 사건 | 묶음 | 갱신 방법 | 담당 |
|---|---|---|---|
| 방 생성 | S2 | `created_at`과 같은 값으로 INSERT | `rooms.createRoom` → `db.rooms.insert` |
| 이름 변경 | S2 | **갱신하지 않는다**(R-ROOM-005 목록에 없음 — §11 D-ROOM-4) | — |
| 유저 발화·지시 저장 | S2 | 메시지 INSERT와 같은 batch에서 `UPDATE rooms SET updated_at` | `db.messages.insert`([db.md](db.md) §2) |
| 메시지 수정 | S2 | 메시지 UPDATE와 같은 batch | `db.messages.updateText` |
| 메시지 삭제 | S2 | 메시지 DELETE와 같은 batch(삭제 전에 room_id를 찾아 갱신) | `db.messages.deleteById` |
| 캐릭터 발화(speak) 저장 | S3 | `db.messages.insert` 재사용 | messages.speak |
| 재작성(regenerate) | S3 | `db.messages.updateText` 재사용 | messages.regenerate |

- 갱신은 항상 메시지 쓰기와 **같은 batch**에서 원자적으로 한다. 이를 서비스가 batch를 짜는 방식(S1 설계 D-ROOM-2)에서 **db 쓰기 함수 안에 포함**하는 방식으로 바꿨다(§11 D-ROOM-2 개정, [db.md](db.md) D-DB-8). 서비스가 갱신을 빠뜨릴 수 없다.
- 시각은 서비스가 주입받은 `now()`로 만들어 db에 넘긴다(db는 시각을 만들지 않는다).

## 5. 에러 타입

| 에러 클래스 | shared 에러 코드 | HTTP | 한국어 메시지 | 원인 | 묶음 |
|---|---|---|---|---|---|
| `AppError` | `VALIDATION_ERROR` | 400 | `방 제목은 1~60자로 입력해 주세요.` | 제목 규칙 위반(생성·이름 변경) | S2 |
| `AppError` | `NOT_FOUND` | 404 | `방을 찾을 수 없습니다.` | 없는 방 이름 변경·삭제(이미 삭제된 방 포함) | S2 |
| (전파) D1 오류 | `INTERNAL` | 500 | `서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.` | D1 장애, UUID 충돌(사실상 없음) | S1 |

- 토큰·등급·레이트리밋 에러(`TOKEN_REQUIRED`·`TOKEN_INVALID`·`LEVEL_TOO_LOW`·`RATE_LIMITED`)는 라우트 미들웨어가 서비스 호출 전에 낸다([auth.md](auth.md) §5).
- `방을 찾을 수 없습니다.`는 messages 모듈의 `ROOM_NOT_FOUND_MESSAGE`와 같은 문구다. 두 모듈이 각자 상수로 둔다(서비스 간 import 금지).

## 6. 설정(env)

- 읽는 키: 없음. 쓰는 키: 없음. `now`는 설정이 아니라 서비스 컨테이너가 주입하는 시계다.

## 7. DB 스키마·마이그레이션

- 사용 테이블: `rooms`(쓰기·읽기), `messages`(개수·연쇄 삭제), `memory`(연쇄 삭제). 정의는 [db.md](db.md) §7.1 `0001_init.sql`.
- 인덱스: `idx_rooms_updated_at`(정렬), `idx_messages_room_id_id`(방별 개수·연쇄 삭제의 `WHERE room_id`). 새 인덱스 없음.
- 새 마이그레이션 없음. `rooms.title` CHECK(1~60)가 최후 방어다.

## 8. 테스트 계획

`server/test/rooms.test.ts`. workers pool D1 + 마이그레이션([db.md](db.md) §8). `createRoomsService({ db: createDb(env.DB), now: () => NOW })`. 데이터는 `test/helpers.ts`의 `insertRoom`·`insertLine`과 직접 `INSERT`로 넣는다.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-040 | `listRooms_returns_empty_array_when_no_rooms` | 빈 DB | `[]` | R-ROOM-001 |
| SRV-T-041 | `listRooms_sorts_by_updatedAt_desc` | 방 3개 `updated_at` 100·300·200 | 300·200·100 순 | R-ROOM-001 |
| SRV-T-042 | `listRooms_includes_messageCount_and_fields` | 메시지 0·2·5개인 방 | 각 `messageCount`, 키 집합 = `id,title,createdAt,updatedAt,messageCount` | R-ROOM-001 |
| SRV-T-043 | `listRooms_propagates_db_failure` | `listSummaries`가 reject하는 가짜 `Db` | 같은 에러로 reject | R-ROOM-001 |
| SRV-T-130 | `createRoom_trims_title_and_returns_summary` | `'  안개 낀 런던  '` | `title === '안개 낀 런던'`, id가 UUID v4 정규식, `createdAt === updatedAt === NOW`, `messageCount 0`. 이어서 `listRooms()` 첫 항목과 같음 | R-ROOM-002 |
| SRV-T-131 | `createRoom_rejects_title_out_of_range_before_db` | `''`, `'   '`, 61자, 이모지 61개 / 통과: 1자, 60자, 이모지 60개 | 위반은 `VALIDATION_ERROR` + 가짜 `Db` 호출 0회, 통과는 저장 성공(CHECK와 단위 일치) | R-ROOM-002 수용 기준(0·61자 400) |
| SRV-T-132 | `renameRoom_updates_title_and_keeps_updatedAt` | 메시지 2개인 방, `updated_at` 100, now 999 | 반환 `title` 변경, `updatedAt === 100`, `messageCount 2`, DB 반영 | R-ROOM-003 · R-ROOM-005 |
| SRV-T-133 | `renameRoom_throws_for_invalid_title_or_unknown_room` | 61자 → `VALIDATION_ERROR`(DB 0회), 없는 id → `NOT_FOUND` | 표대로 | R-ROOM-003 |
| SRV-T-134 | `deleteRoom_removes_room_messages_and_memory_without_orphans` | 방 A(메시지 3 + memory 1), 방 B(메시지 2) → A 삭제 | `rooms` A 없음, `SELECT COUNT(*) FROM messages WHERE room_id NOT IN (SELECT id FROM rooms)` = 0, memory도 0, B의 메시지 2건 유지, 이어서 `listMessages(A)` → `NOT_FOUND` | R-ROOM-004 · R-DB-003 |
| SRV-T-135 | `deleteRoom_throws_NOT_FOUND_for_unknown_or_already_deleted` | 없는 id, 같은 방 두 번 삭제 | 둘 다 `NOT_FOUND` | R-ROOM-004 |

- 에러 경로(043·131·133·135) 4 ≥ 정상 경로 6의 절반 이상. 권한 "등급 통과자 누구나"는 서비스에 권한 인자가 없다는 구조로 보장하고, 다른 `mb_id` 토큰으로의 성공은 contract 라우트 테스트가 확인한다(§9).

수동 체크:

- [ ] 토큰을 붙여 `POST /api/rooms {"title":"  테스트  "}` → 201 계열 응답에 `title: "테스트"`, 이어 `GET /api/rooms` 첫 줄(contract 라우트 생성 후).
- [ ] `DELETE /api/rooms/:id` 후 같은 id의 `GET /api/rooms/:id/messages` → 404.

## 9. contract 요구 명세

| 서비스 | 엔드포인트 후보 | 입력 | 출력 | 에러 | 토큰 | 레이트리밋 | 이유 |
|---|---|---|---|---|---|---|---|
| `rooms.listRooms()` | `GET /api/rooms` | 없음 | `RoomSummary[]`(이미 정렬됨) | `CONFIG_INVALID`, `INTERNAL` | ✕ | ✕ | R-ROOM-001 |
| `rooms.createRoom({ title })` | `POST /api/rooms` | 본문 `{ title: string }` | `RoomSummary`(`messageCount: 0`) | `VALIDATION_ERROR`(400) + 공통 | ○ | ○ | R-ROOM-002 |
| `rooms.renameRoom(id, { title })` | `PATCH /api/rooms/:id` | 경로 `id`(문자열 그대로), 본문 `{ title: string }` | `RoomSummary` | `VALIDATION_ERROR`(400), `NOT_FOUND`(404) + 공통 | ○ | ○ | R-ROOM-003 |
| `rooms.deleteRoom(id)` | `DELETE /api/rooms/:id` | 경로 `id` | 없음(`void`) | `NOT_FOUND`(404) + 공통 | ○ | ○ | R-ROOM-004 |

- 공통 = `TOKEN_REQUIRED`·`TOKEN_INVALID`(401), `LEVEL_TOO_LOW`(403), `RATE_LIMITED`(429, `retryAfterSec`), `CONFIG_INVALID`·`INTERNAL`(500). 미들웨어 순서·principal은 [auth.md](auth.md) §9.1.
- 라우트 zod 스키마는 **타입만** 본다: `z.object({ title: z.string() })`. trim·길이는 서비스(`normalizeTitle`)가 판정하고 같은 `VALIDATION_ERROR` 문구를 낸다(같은 입력에 두 가지 메시지가 나오지 않게 — D-MSG-4와 같은 원칙). 본문 JSON 파싱 실패·`title` 누락·문자열 아님은 라우트 `validate` → `VALIDATION_ERROR`(기본 문구).
- 성공 status(생성 201·삭제 204 등)와 삭제 응답 본문 유무는 contract가 정한다. 서비스는 `RoomSummary`/`void`를 돌려준다.
- ui는 생성·이름 변경 응답의 `RoomSummary`로 목록을 바로 갱신할 수 있다(재조회 불필요). 이름 변경은 목록 순서를 바꾸지 않는다(`updatedAt` 유지).
- R-ROOM-003·004 "누구나" 확인: contract 라우트 테스트에서 방을 만든 토큰과 **다른 `mb_id` 토큰**으로 이름 변경·삭제가 성공함을 1건 확인한다.

## 10. 요구 추적표

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-ROOM-001 🔒 | §2·§4·§9 | SRV-T-040~043, [db.md](db.md) SRV-T-024·025 | ✅ |
| R-ROOM-002 🔒 | §2·§2.1·§2.2·§9 | SRV-T-130·131, [db.md](db.md) SRV-T-121 | ✅ |
| R-ROOM-003 🔒 (확인 필요 §9-5) | §2·§2.2·§4.1·§9 | SRV-T-132·133, [db.md](db.md) SRV-T-122, contract 다른 mb_id 테스트 | ✅(기본값) |
| R-ROOM-004 🔒 (확인 필요 §9-5) | §2·§2.2·§4·§9 | SRV-T-134·135, [db.md](db.md) SRV-T-123 | ✅(기본값) |
| R-ROOM-005 | §4.1 | [db.md](db.md) SRV-T-027·124·125·128, [messages.md](messages.md) SRV-T-140·146·148 | ✅(S3 경로는 같은 db 함수 재사용) |
| R-DB-003 | §4 삭제 batch | SRV-T-134, [db.md](db.md) SRV-T-123 | ✅ |

## 11. 설계 결정 노트

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-ROOM-1 | 정렬은 SQL, 동률은 `id` 오름차순 | 서비스에서 정렬 | 결정적 순서. 테스트가 흔들리지 않는다 |
| D-ROOM-2 (개정 S2) | `updated_at` 갱신을 db 메시지 쓰기 함수 안의 batch에 포함 | (S1 원안) 서비스가 `touchStmt`를 자기 batch에 넣음 | 메시지 쓰기는 `RETURNING` 행이 필요한데, 서비스가 batch 결과(`D1Result`)를 직접 해석하면 행→도메인 변환이 db 밖으로 샌다. db 함수 안에 두면 갱신 누락도 불가능하다. `touchStmt`는 S1 공개 API로 유지 |
| D-ROOM-3 | (S1) `RoomsService`에 S2 함수를 빈 구현으로 두지 않았다 | 미리 스텁 | 요구 기반 최소 구현. S2에서 실제 구현으로 추가 |
| D-ROOM-4 | 이름 변경은 `updated_at`을 바꾸지 않는다 | 갱신 | R-ROOM-005 목록(메시지 추가·수정·삭제·재작성)에 없다. 목록 순서는 "대화가 최근에 움직인 방" 의미를 유지 |
| D-ROOM-5 | 쓰기 함수에 `Principal` 인자 없음 | `actor` 인자 | 권한이 "누구나"이고 저장할 작성자 컬럼이 없다. §9-5가 "관리자만"으로 바뀌면 그때 인자와 등급 검사를 추가한다 |
| D-ROOM-6 | 제목 길이 = 코드 포인트, trim 후 | UTF-16 길이(`s.length`) | DB CHECK `length()`와 같은 단위라 서비스 통과 → CHECK 실패(500)가 생기지 않는다 |
| D-ROOM-7 | 생성 응답은 재조회 없이 서비스가 조립 | INSERT 후 요약 SELECT | 새 방의 `messageCount`는 항상 0이고 시각은 서비스가 정했다. D1 왕복 1회 절약 |
| D-ROOM-8 | 이름 변경 응답 = `UPDATE` + 요약 `SELECT`를 한 batch | `UPDATE … RETURNING`에 개수 부분 질의 | batch가 SQLite `RETURNING` 제약(부분 질의)과 무관하고 원자적이다 |

확인 필요:

- §9-5(방 이름 변경·삭제 권한)는 기본값 "등급 통과자 누구나"를 적용했다.
- S3 인계: speak 진행 중 방이 삭제되면 결과 저장(`db.messages.insert`)이 `null`(방 없음)을 돌려준다. S3 speak는 이를 `NOT_FOUND`로 바꾸고 잠금 해제를 건너뛴다(방이 없으니 해제할 행도 없다).

제안(설계 미반영, 사용자 판단):

- 방 목록 페이지네이션은 요구가 없다. 방이 수백 개를 넘으면 `GET /api/rooms` 응답 크기와 [db.md](db.md) §4.2 읽기 비용이 커진다. 그때 요구로 승격한다.

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-05 | S1 초안 작성 |
| 2026-10-05 | S1 구현 동기화(상태 확정). S2 설계: §2.2 "S2 예정"을 본문으로 승격, `RoomsDeps`에 `now` 추가(파급 §11 아래), `normalizeTitle`·`ROOM_TITLE_MAX` 추가, D-ROOM-2 개정, D-ROOM-4~8 추가 |

파급(공개 API 변경): `RoomsDeps`에 `now` 필수 추가 → 호출자 `server/src/services.ts`(`createServices`), `server/test/rooms.test.ts` 11행·48행의 `createRoomsService({ db })`를 `{ db, now }`로 고친다. 라우트(`server/src/routes/rooms.ts`)는 `listRooms` 호출만 있어 영향 없다.
