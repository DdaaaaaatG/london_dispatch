# rooms 모듈 설계

- 상태: S1 확정(구현 동기화) · S2 초안 · **S6 설계 초안(2026-10-08, 승인 ① 완료 — §12 방 비밀번호 잠금: `password.ts`·`entry-key.ts`·`entry.ts` 신규, `enter`·`setPassword`·`clearPassword`·`assertEntry`, `RoomsDeps` 확장, `RoomSummary.locked`. S6 관련 서술은 §12가 §2~§11보다 우선)** · 최종 갱신: 2026-10-08
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

## 12. S6 — 방 비밀번호 잠금 (R-LOCK-001·002·004·005·006·007·008·009 · R-ROOM-001~004 🔒 개정)

- 상태: 초안(2026-10-08, 승인 ① 완료 — 사용자 결정 U1~U10). 근거 `doc/200_설계/architecture/s6-02-전반설계.md` §1~§5·§7, `s6-03-인계패킷.md` §1. **§12.2 공개 시그니처는 인계 패킷 §1.2 그대로다(변경 없음).**
- 비유: 잠긴 방 문 앞의 번호 자물쇠다. 번호를 맞히면 rooms가 그 방 전용 도장(입장 증명)을 찍어 준다. 도장은 "방 id + 지금 자물쇠의 모양(해시)"에 묶여 있어서, 자물쇠를 바꾸거나 떼면 옛 도장은 저절로 안 맞는다. 관장(갠홈 주인)은 번호 없이 도장을 받는다.
- 결론: 새 모듈 없이 rooms를 넓힌다(D-S6-12). 비밀번호는 해시로만, 증명은 저장하지 않고 요청마다 다시 계산한다(무상태). 접근 판정 함수는 `assertEntry` 하나이고, 라우트 관문 `requireRoomEntry`([auth.md](auth.md) §14)가 서비스 호출 전에 부른다. 기존 messages·memory 서비스 시그니처는 바뀌지 않는다.

### 12.1 목적

| 요구ID | 서버 몫 | 반영 |
|---|---|---|
| R-LOCK-001 🔒 | 생성과 동시에 잠금. INSERT 한 문장에 해시까지(잠기지 않은 틈 없음) | `createRoom` |
| R-LOCK-002 🔒 (U9) | 설정·변경·해제. 잠긴 방은 주인 또는 증명 보유자만 — 관문이 먼저 거른다 | `setPassword`·`clearPassword` |
| R-LOCK-003 🔒 (U8) | 서버 몫은 `RoomSummary.locked` 투영뿐. 날짜 숨김은 화면 표시 규칙(E3 필드 불변) | [db.md](db.md) §15 |
| R-LOCK-004 🔒 | 입장 증명 발급·검증. 비밀번호 변경·해제·`TOKEN_SECRET` 교체 시 무효 | `enter`·`entry-key.ts` |
| R-LOCK-005 🔒 | 주인 프리패스: `enter` ③(비밀번호 없이 증명), `assertEntry` 주인 통과 | `enter`·`assertEntry` |
| R-LOCK-006 🔒 | 관문 판정 한 곳 | `assertEntry` |
| R-LOCK-007 🔒 | 원문 미저장 · PBKDF2-SHA256 + salt(반복 수 기록) · 로그·응답에 비밀번호·해시·증명 없음 | `password.ts` · §12.7 |
| R-LOCK-008 (U7) | 방 단위 분당 상한을 **해시 앞에서** 센다. 계수 자체는 auth가 D1로 | `enter` ⑤ · `deps.hitEnterLimit` |
| R-LOCK-009 🔒 | 기존 방은 잠기지 않음(NULL), 기존 함수 동작 불변 | §12.9 |
| R-ROOM-001 🔒 개정(L4) | 목록·요약에 `locked: boolean`. 해시는 응답에 없다 | `listRooms`·`renameRoom` |
| R-ROOM-002 🔒 개정(L5) | 본문 `password?`(4~32자), 응답 `entryKey` | `createRoom` |
| R-ROOM-003·004 🔒 개정(L6) | 잠긴 방의 이름 변경·삭제는 관문 통과 뒤. 서비스 함수는 불변 | 라우트 관문 |

### 12.2 공개 API (인계 패킷 §1.2 — 불변)

```ts
// server/src/rooms/password.ts — 순수(Web Crypto만, DB·env·로그 없음)
/** 실측 확정값(§12.3.3). 해시 1회 CPU ≤ 5ms(Free 요금제 10ms의 절반, U10). 상한 100_000(workerd PBKDF2 한도).
 *  Paid 확인 시 이 상수만 올린다 — 저장 문자열에 반복 수가 있어 옛 해시는 옛 값으로 검증, 마이그레이션 없음 */
export const PASSWORD_HASH_ITERATIONS: number
/** 코드 포인트 4~32면 raw 를 그대로(trim·정규화 없음), 아니면 AppError VALIDATION_ERROR('비밀번호는 4~32자로 입력해 주세요.') */
export const checkPasswordRule = (raw: string): string
/** 'pbkdf2-sha256$<반복 수>$<salt base64url 16바이트>$<유도값 base64url 32바이트>'. salt 는 호출마다 새로 */
export const hashPassword = (password: string): Promise<string>
/** 저장 문자열의 반복 수·salt 로 다시 유도해 timingSafeEqual. 형식이 깨졌으면 false(throw 없음) — 호출자가 error 로그 */
export const verifyPassword = (password: string, stored: string): Promise<boolean>
/** 모듈 내부용(index 미노출). 형식 판정 — entry.ts 가 room_pass_hash_invalid 로그를 가르는 데만 쓴다 */
export const parsePasswordHash = (stored: string): ParsedPasswordHash | null
type ParsedPasswordHash = { iterations: number; salt: Uint8Array; derived: Uint8Array }

// server/src/rooms/entry-key.ts — 순수
export const ENTRY_KEY_PURPOSE = 'london_dispatch/room-entry/v1'
export const ENTRY_KEY_PREFIX = 'e1.'
/** K = HMAC-SHA256(key = UTF-8(tokenSecret), msg = UTF-8(ENTRY_KEY_PURPOSE)) 를 HMAC-SHA256 서명 키로 import(추출 불가, ['sign']) */
export const deriveEntrySecret = (tokenSecret: string): Promise<CryptoKey>
/** 'e1.' + base64url(HMAC(K, UTF-8(roomId + '\n' + passHash))) — 46자 */
export const issueEntryKey = (secret: CryptoKey, roomId: string, passHash: string): Promise<string>
/** null·빈 문자열·ROOM_KEY_MAX_LENGTH(128) 초과·접두사 불일치·디코드 실패·32바이트 아님 = false. 그 밖은 다시 계산해 timingSafeEqual */
export const verifyEntryKey = (secret: CryptoKey, roomId: string, passHash: string, presented: string | null): Promise<boolean>

// server/src/rooms/index.ts (구현: service.ts · entry.ts)
import type { CreateRoomBody, CreateRoomResponse, EnterRoomResponse, RoomSummary, SetRoomPasswordResponse } from '@shared/types'
export type EntryTarget = { kind: 'room'; roomId: string } | { kind: 'message'; messageId: number }
export type EntryAccess = { entryKey: string | null; isOwner: boolean }
export type RoomsDeps = {
  db: Db
  now: () => number
  logger: Logger
  /** 컨테이너가 요청 컨테이너 수명 동안 1회 파생해 메모한 키([index.md](index.md) §15). 필요할 때만 부른다 */
  entrySecret: () => Promise<CryptoKey>
  /** = services.auth.hitEnterLimit. 한도 초과면 AppError RATE_LIMITED(retryAfterSec)를 던진다 */
  hitEnterLimit: (roomId: string) => Promise<void>
}
export type RoomsService = {
  listRooms: () => Promise<RoomSummary[]>                                              // + locked
  createRoom: (input: CreateRoomBody) => Promise<CreateRoomResponse>                   // 제목 → 비밀번호 순 검사, INSERT 1문장
  renameRoom: (id: string, input: { title: string }) => Promise<RoomSummary>          // 불변(+ locked)
  deleteRoom: (id: string) => Promise<void>                                            // 불변
  enter: (roomId: string, input: { password?: string; isOwner: boolean }) => Promise<EnterRoomResponse>
  setPassword: (roomId: string, password: string, by: { mbId: string }) => Promise<SetRoomPasswordResponse>
  clearPassword: (roomId: string, by: { mbId: string }) => Promise<RoomSummary>
  assertEntry: (target: EntryTarget, access: EntryAccess) => Promise<void>             // AppError ROOM_LOCKED
}
export { deriveEntrySecret } from './entry-key'   // 컨테이너(services.ts)용 재노출
```

| 이름 | 인자 | 반환 | 실패 조건(에러 코드) | 요구ID |
|---|---|---|---|---|
| `listRooms` | — | `RoomSummary[]`(+`locked`) | D1 장애 전파 → `INTERNAL` | R-ROOM-001 · R-LOCK-003 |
| `createRoom` | `{ title, password? }` | `CreateRoomResponse` | 제목 위반 → `VALIDATION_ERROR`(제목 문구) **먼저**, 비밀번호 위반 → `VALIDATION_ERROR`(비밀번호 문구). 둘 다 DB 접근·해시 전 | R-ROOM-002 · R-LOCK-001 |
| `renameRoom` · `deleteRoom` | 불변 | 불변(+`locked`) | 불변 | R-ROOM-003·004 |
| `enter` | `roomId, { password?, isOwner }` | `{ entryKey: string \| null }` | `NOT_FOUND` · `ROOM_LOCKED`(비밀번호 없음) · `RATE_LIMITED`(429, `retryAfterSec`) · `ROOM_PASSWORD_WRONG` | R-LOCK-004·005·008 |
| `setPassword` | `roomId, password, by` | `{ room, entryKey }` | 비밀번호 위반 → `VALIDATION_ERROR`(DB·해시 전) · `NOT_FOUND` | R-LOCK-002·004 |
| `clearPassword` | `roomId, by` | `RoomSummary`(`locked: false`) | `NOT_FOUND`. 이미 풀린 방은 성공(멱등) | R-LOCK-002 |
| `assertEntry` | `target, access` | `void` | `ROOM_LOCKED`. 방·메시지가 없으면 **통과**(뒤에서 기존 404) | R-LOCK-005·006 |
| `checkPasswordRule` · `hashPassword` · `verifyPassword` | 위 | 위 | `VALIDATION_ERROR`(규칙만) | R-LOCK-007 |
| `deriveEntrySecret` · `issueEntryKey` · `verifyEntryKey` | 위 | 위 | 없음(검증 실패 = false) | R-LOCK-004 |

- `createRoom` 입력 타입이 `RoomTitleInput` → `CreateRoomBody`(상위 집합), 반환이 `RoomSummary` → `CreateRoomResponse`(상위 집합)로 넓어진다. `{ title }`만 넘기는 기존 호출은 그대로 컴파일된다. `RoomTitleInput`은 `renameRoom`용으로 남긴다.
- **D-ROOM-5 개정**: `setPassword`·`clearPassword`는 `by: { mbId }`를 받는다. 용도는 **로그 필드뿐**이다(권한 판정은 관문·미들웨어, 저장 칸 없음). 기존 4함수는 여전히 `Principal`을 받지 않는다.

### 12.3 규칙

#### 12.3.1 비밀번호 (U6 🔒)

| 규칙 | 값 |
|---|---|
| 길이 | 코드 포인트 4~32(`Array.from(raw).length`). 상수는 shared `ROOM_PASSWORD_MIN`·`ROOM_PASSWORD_MAX`(화면 카운터와 같은 값) |
| 정규화 | **없음**. trim·NFC 정규화 없이 받은 그대로 UTF-8로 해시한다(`'  ab  '`은 6자, 앞뒤 공백 포함) |
| 문자 | 제한 없음(이모지 1개 = 1자) |
| 위반 문구 | `비밀번호는 4~32자로 입력해 주세요.`(상수 `ROOM_PASSWORD_RULE_MESSAGE`, password.ts) |
| 입장 입력 | `enter`는 규칙 검사를 하지 않는다. 길이 상한 64(shared `ROOM_ENTER_PASSWORD_MAX`)는 라우트 zod가 400으로 막는다. 빈 문자열 `''`은 "보냄"으로 본다(세고 → 불일치) |

#### 12.3.2 해시 형식·파싱

```
pbkdf2-sha256$<반복 수>$<salt base64url 16바이트 = 22자>$<유도값 base64url 32바이트 = 43자>      // 약 87자(0005 CHECK 20~200 안)
```

- 해시: `salt = crypto.getRandomValues(new Uint8Array(16))` → `importKey('raw', UTF-8(password), 'PBKDF2', false, ['deriveBits'])` → `deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PASSWORD_HASH_ITERATIONS }, key, 256)`.
- 파싱(`parsePasswordHash`): `$`로 나눠 정확히 4조각 · 첫 조각 `pbkdf2-sha256` · 반복 수 `/^[1-9][0-9]{0,5}$/`이고 ≤ 100_000 · salt 디코드 16바이트 · 유도값 디코드 32바이트. 하나라도 어긋나면 `null`.
- 검증: 파싱 `null` → `false`. 아니면 **저장된** 반복 수·salt로 다시 유도해 `crypto.subtle.timingSafeEqual`(token.ts와 같은 방식, 길이는 32로 같음이 보장됨).
- base64url 인코더·디코더는 `server/src/auth/base64url.ts`를 공통 위치 `server/src/base64url.ts`로 옮기고, `auth/base64url.ts`는 한 줄 재노출로 남긴다(기존 import 3곳 — `auth/token.ts`·`test/auth.test.ts`·`test/token.ts`·`scripts/token-tool.ts` — 무수정). rooms가 auth 내부 파일을 import하지 않게 하기 위함(D-ROOM-13).

#### 12.3.3 반복 수 실측 규칙 (U10 — Free 기준 확정)

| 단계 | 내용 |
|---|---|
| 측정 | server-implementer가 Node 22에서 `globalThis.crypto.subtle.deriveBits`(같은 매개변수, 비밀번호 8자)를 후보 `5_000 · 10_000 · 20_000 · 50_000 · 100_000`마다 워밍업 3회 뒤 20회 재서 **중앙값 ms**를 기록한다(스크립트는 저장소에 두지 않아도 된다 — 명령과 결과만 보고) |
| 선택 | 중앙값 ≤ 5ms인 후보 중 가장 큰 값. 5_000도 넘으면 1_000 단위로 내려 다시 잰다. 하한 1_000(그보다 느리면 멈추고 보고) |
| 기록 | `password.ts` 상수 주석과 이 표 아래 「실측 결과」 줄에 측정 명령·환경(CPU 이름)·후보별 중앙값·선택값. 설계 문서 기입은 구현 보고 뒤 server-designer가 동기화한다 |
| 운영 확인 | 배포 뒤 Cloudflare 대시보드 Workers CPU 시간(E17·E18 요청)으로 확인 — 1102 오류가 보이면 상수를 내린다(옛 해시는 저장된 반복 수로 계속 검증) |

- 실측 결과: (구현 보고 후 기입)

#### 12.3.4 입장 증명

```
K       = HMAC-SHA256(key = UTF-8(TOKEN_SECRET), msg = UTF-8("london_dispatch/room-entry/v1"))   // deriveEntrySecret, 요청당 최대 1회
entry   = "e1." + base64url( HMAC-SHA256(K, UTF-8(roomId + "\n" + pass_hash)) )                   // 46자
```

- `TOKEN_SECRET`은 컨테이너가 `config.tokenSecret` 값으로 `deriveEntrySecret`에 넘긴다. rooms는 SECRET 원값을 보지 않고 `CryptoKey`(추출 불가)만 받는다.
- 검증 순서: `presented`가 `null`·`''` → false · 길이 > 128 → false · `e1.`로 시작하지 않음 → false · 나머지 디코드 실패 또는 32바이트 아님 → false · `issue`와 같은 계산값과 `timingSafeEqual`.
- 무효가 되는 경우 셋: 비밀번호 변경(새 salt → 새 해시) · 해제(해시 NULL — 재설정해도 새 salt) · `TOKEN_SECRET` 교체. 만료 없음(U2).

### 12.4 흐름

#### 12.4.1 `enter` 판정 순서 (02 §4.2 ①~⑦)

| 단계 | 조건 | 결과 | D1 | 해시 |
|---|---|---|---|---|
| ① | `db.rooms.getEntryState(roomId)`가 `null` | `NOT_FOUND`(`방을 찾을 수 없습니다.`) | 읽기 1 | ✕ |
| ② | `passHash === null` | `{ entryKey: null }` | — | ✕ |
| ③ | `input.isOwner` | `{ entryKey: issueEntryKey(K, roomId, passHash) }` — 비밀번호 무시, **세지 않음** | — | ✕ |
| ④ | `input.password === undefined` | `ROOM_LOCKED` — **세지 않음** | — | ✕ |
| ⑤ | `await deps.hitEnterLimit(roomId)` | 한도 초과면 auth가 `RATE_LIMITED`(상황 문구·`retryAfterSec`)를 던진다 | 쓰기 1(UPSERT) | ✕ |
| ⑥ | `verifyPassword(password, passHash)`가 false | `ROOM_PASSWORD_WRONG`. 로그: 형식 깨짐(`parsePasswordHash === null`)이면 error `room_pass_hash_invalid{roomId}`, 아니면 info `room_enter_failed{roomId}` | — | 1회 |
| ⑦ | 일치 | `{ entryKey: issueEntryKey(K, roomId, passHash) }` | — | 1회 |

- 함수 50줄 한계: 판정은 `entry.ts`의 `enterRoom(deps, roomId, input)` 하나 + 보조 `issueFor(roomId, passHash)`로 둔다.

#### 12.4.2 쓰기·관문

| 함수 | 흐름 |
|---|---|
| `createRoom` | `title = normalizeTitle(input.title)` → `password = input.password === undefined ? null : checkPasswordRule(input.password)` → `passHash = password === null ? null : await hashPassword(password)` → `id`·`nowMs` → `db.rooms.insert({ id, title, nowMs, passHash })`(INSERT 1문장) → `entryKey = passHash === null ? null : issueEntryKey(await deps.entrySecret(), id, passHash)` → `{ id, title, createdAt: nowMs, updatedAt: nowMs, messageCount: 0, locked: passHash !== null, entryKey }`(재조회 없음, D-ROOM-7 유지) |
| `setPassword` | `checkPasswordRule(password)` → `passHash = await hashPassword(password)` → `r = await db.rooms.setPassHash(roomId, passHash)` → `null`이면 `NOT_FOUND` → `entryKey = issueEntryKey(K, roomId, passHash)` → info `room_password_set{roomId, mbId: by.mbId, wasLocked: r.wasLocked}` → `{ room: r.room, entryKey }`. `updated_at` 불변(D-S6-11) |
| `clearPassword` | `r = await db.rooms.setPassHash(roomId, null)` → `null`이면 `NOT_FOUND` → info `room_password_cleared{roomId, mbId, wasLocked}`(멱등 호출도 기록, `wasLocked: false`) → `r.room` |
| `assertEntry` | `state = target.kind === 'room' ? db.rooms.getEntryState(target.roomId) : db.rooms.getEntryStateByMessage(target.messageId)` → `null`(없음) 통과 → `state.passHash === null` 통과 → `access.isOwner` 통과 → `access.entryKey !== null && verifyEntryKey(K, state.roomId, state.passHash, access.entryKey)` 통과 → 그 밖 `ROOM_LOCKED`. 로그 없음(정상 흐름에서도 잦다) |

- `K`(=`await deps.entrySecret()`)는 **필요할 때만** 부른다: 잠기지 않은 방·없는 방·주인 아닌 무증명 요청은 파생하지 않는다. 증명 헤더가 없으면(`entryKey === null`) HMAC 계산도 하지 않는다.
- 메시지 대상의 방 id는 증명 계산에 **조회된 `state.roomId`**를 쓴다(다른 방 증명은 그 방 해시와 맞지 않아 무효).

### 12.5 비동기·동시성

```
E17 POST /rooms/:id/enter  ─▶ [optionalToken·validate·bodyLimit] ─▶ rooms.enter(id, { password, isOwner })
                                db.rooms.getEntryState ─▶ D1 읽기 1
                                ├ ①②③④ 즉시 응답(해시 없음, 계수 없음)
                                └ ⑤ deps.hitEnterLimit(id) ─▶ auth ─▶ D1 rate_limits UPSERT('enter:{id}')   ── 초과 → 429
                                  ⑥⑦ verifyPassword(PBKDF2 1회, CPU ≤ 5ms) → issueEntryKey(HMAC, μs)
E18 PUT /rooms/:id/password ─▶ [requireToken·rateLimitWrites·validate(param)·★requireRoomEntry('room')·bodyLimit·json]
                                ─▶ rooms.setPassword: 규칙 → PBKDF2 1회 → db.rooms.setPassHash batch[SELECT 이전 상태, UPDATE, SELECT 요약]
E19 DELETE /rooms/:id/password ─▶ [… ★관문] ─▶ rooms.clearPassword: setPassHash(id, null) batch
★ 관문(E5~E14·E18·E19) ─▶ rooms.assertEntry ─▶ D1 PK 읽기 1(메시지 대상은 JOIN 1) ─▶ (잠긴 방 + 증명 헤더일 때만) HMAC 1회
```

- 상태 없음. 시도 계수는 D1 `rate_limits`(키 `enter:{roomId}`)뿐이고 프로세스 메모리 카운터·캐시를 두지 않는다(인스턴스 여럿).
- 경합: 설정·변경·해제와 입장·관문이 겹치면 증명은 **그 순간 D1에 있던 해시 하나**에만 맞는다. 변경 직후 옛 증명은 다음 요청에서 `ROOM_LOCKED` → 화면이 다시 묻는다(02 §14 동시성 목표). 두 `setPassword`가 겹치면 나중 UPDATE가 이기고, 진 쪽이 받은 증명은 다음 요청에서 무효가 된다(재입력으로 회복). 잠금·대기열은 두지 않는다.
- 생성 + 잠금은 INSERT 1문장이라 원자적이다. `setPassHash`의 batch는 이전 상태 읽기와 UPDATE가 한 트랜잭션이라 `wasLocked`가 정확하다.
- 타임아웃 없음(D1은 플랫폼 제한, LLM 호출 없음). `waitUntil` 없음.
- CPU(Free 10ms/요청): 해시는 요청당 최대 1회(E4 비밀번호 있음 · E17 ⑥⑦ · E18). E17은 ⑤가 해시 앞이라 남용 요청은 해시까지 가지 않는다. 관문은 HMAC 1회(수 μs).

| 경로 | D1 읽기(행) | D1 쓰기(행) | 해시 |
|---|---|---|---|
| E17 ①~④ | 1 | 0 | 0 |
| E17 ⑤ 초과 | 1 | 0~1(UPSERT 거절 시 0) | 0 |
| E17 ⑥⑦ | 1 | 1(+새 창 첫 시도에 purge) | 1 |
| E18 · E19 | 1 + 요약(방 1 + 메시지 수 COUNT) | 1 | E18만 1 |
| E4 + 비밀번호 | 0 | 1 | 1 |
| 관문 1회 | 1(메시지 대상 2) | 0 | 0 |

### 12.6 에러 타입

| 에러 클래스 | shared 코드 | HTTP | 한국어 메시지 | 원인 |
|---|---|---|---|---|
| `AppError` | `VALIDATION_ERROR` | 400 | `비밀번호는 4~32자로 입력해 주세요.` | 생성(`password` 있음)·설정의 규칙 위반. 생성은 제목 위반이 먼저 |
| `AppError` | `NOT_FOUND` | 404 | `방을 찾을 수 없습니다.` | `enter`·`setPassword`·`clearPassword`의 없는 방 |
| `AppError` | `ROOM_LOCKED` (신규, 403) | 403 | 기본 문구 `이 방은 비밀번호로 잠겨 있습니다.`(shared — 덮어쓰지 않음) | `assertEntry` 불통과 · `enter` ④ |
| `AppError` | `ROOM_PASSWORD_WRONG` (신규, 403) | 403 | 기본 문구 `비밀번호가 맞지 않습니다.` | `enter` ⑥(형식 깨진 해시 포함 — 닫힌 쪽) |
| (auth가 던짐) `AppError` | `RATE_LIMITED` | 429 | `비밀번호를 너무 자주 입력했습니다. 잠시 후 다시 시도해 주세요.` + `retryAfterSec` | `enter` ⑤([auth.md](auth.md) §14) |
| (전파) | `INTERNAL` | 500 | 공통 | D1 장애, Web Crypto 예외(정상 입력에서는 없음) |

- 새 코드 2종은 shared `errors.ts`(contract-implementer, 15 → 17종)가 먼저 만든다. rooms는 문자열 리터럴을 쓰지 않고 `ErrorCode` 타입으로만 참조한다.
- 오류 문구·로그·응답 어디에도 비밀번호·해시·증명 값을 넣지 않는다.

### 12.7 로그

| 이벤트 | 레벨 | 필드 | 위치 |
|---|---|---|---|
| `room_password_set` | info | `roomId`, `mbId`, `wasLocked` | `setPassword` |
| `room_password_cleared` | info | `roomId`, `mbId`, `wasLocked` | `clearPassword` |
| `room_enter_failed` | info | `roomId` | `enter` ⑥ |
| `room_pass_hash_invalid` | error | `roomId` | `enter` ⑥(형식 깨짐) |
| `room_enter_limited` | warn | `roomId` | auth `hitEnterLimit`([auth.md](auth.md) §14) |

- 금지 필드: 비밀번호, 해시, 증명, `CryptoKey`, `X-Room-Key` 헤더 값, `TOKEN_SECRET`. 열람자는 익명일 수 있어 `mbId`를 남기지 않는다(`enter`는 `mbId`를 받지 않는다).

### 12.8 설정(env)

- rooms가 읽는 키 없음. `TOKEN_SECRET`은 컨테이너가 파생한 `CryptoKey`(`deps.entrySecret`)로만, `ROOM_ENTER_LIMIT_PER_MIN`은 auth(`deps.hitEnterLimit`) 안에서만 쓰인다([env.md](env.md) §13, [index.md](index.md) §15).

### 12.9 DB 스키마·마이그레이션

- `rooms.pass_hash TEXT NULL`(0005, [db.md](db.md) §15). rooms가 쓰는 db 함수: `insert`(+`passHash?`) · `listSummaries`·`updateTitle`(+`locked`) · `getEntryState` · `getEntryStateByMessage` · `setPassHash`.
- 기존 방은 NULL → 잠기지 않음(R-LOCK-009). `deleteRoom`의 연쇄 삭제 batch는 그대로(해시는 같은 행이라 함께 지워진다).

### 12.10 테스트 계획

- 위치: 순수 함수 `server/test/rooms-password.test.ts`(신규), 서비스 `server/test/rooms-lock.test.ts`(신규, workers pool D1 + `apply-migrations.ts` 전체 적용 + 가짜 시계 + 수집 로거). `createRoomsService`는 헬퍼 `makeRooms({ now, ownerLimit })`로 만든다 — `entrySecret = () => deriveEntrySecret(TEST_SECRET)`(32자 이상 시험값), `hitEnterLimit = createAuthService({…, config: { …, roomEnterLimitPerMin: 5 } }).hitEnterLimit`(실제 D1 계수).
- 해시 호출 감시: `vi.spyOn(crypto.subtle, 'deriveBits')` 호출 수로 본다(RoomsDeps에 해시 주입을 추가하지 않는다 — §1.2 불변). workerd에서 spy가 막히면 `vi.mock('../src/rooms/password')` 부분 모킹으로 대체한다.
- 기존 `server/test/rooms.test.ts`: `createRoomsService({ db, now })` 호출을 같은 헬퍼로 바꾸고(필수 deps 3개 추가) SRV-T-042 키 집합에 `locked`, SRV-T-130 생성 반환 키에 `locked`·`entryKey`를 더한다. 그 밖 단언 무수정.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-360 | `hashPassword_format` | `'abcd'` | `/^pbkdf2-sha256\$[1-9][0-9]*\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/`, 반복 수 = `PASSWORD_HASH_ITERATIONS`, 길이 20~200 | R-LOCK-007 |
| SRV-T-361 | `hashPassword_new_salt_each_time` | 같은 비밀번호 2회 | 두 문자열 다름, 둘 다 `verifyPassword` true | R-LOCK-004 |
| SRV-T-362 | `verifyPassword_true_false` | 맞음 / 한 글자 다름 / 앞뒤 공백 추가 | true / false / false(trim 없음) | R-LOCK-007 |
| SRV-T-363 | `verifyPassword_uses_stored_iterations` | 테스트가 `deriveBits`로 반복 수 1_000짜리 해시 문자열을 직접 만듦 + 상수로 만든 해시 | 둘 다 true(반복 수가 다른 두 해시 동시 검증 — 인계 §1.4) | R-LOCK-007 · U10 |
| SRV-T-364 | `verifyPassword_false_for_broken` | `''`·`'x'`·접두사 `pbkdf2-sha1`·반복 수 `0`·`100001`·`'1e3'`·salt 15바이트·유도값 31바이트·`$` 5조각 | 모두 false, throw 없음, `parsePasswordHash` null | R-LOCK-007 |
| SRV-T-365 | `checkPasswordRule_code_points` | 통과: 4자·32자·이모지 4개(UTF-16 8)·`'  ab  '`(반환값 그대로) / 위반: `''`·3자·33자·이모지 33개 | 통과는 입력 그대로, 위반은 `VALIDATION_ERROR` + 비밀번호 문구 | R-LOCK-001 · U6 |
| SRV-T-366 | `issueEntryKey_deterministic_and_bound` | 같은 입력 2회 / 해시만 다름 / 방만 다름 / SECRET만 다름 | 같음 / 다름 / 다름 / 다름. 형식 `/^e1\.[A-Za-z0-9_-]{43}$/`(46자) | R-LOCK-004 |
| SRV-T-367 | `verifyEntryKey_rejects` | 정상 / **가운데** 한 글자 변조(마지막 글자는 하위 비트만 바뀌어 같은 바이트로 디코드될 수 있어 쓰지 않는다) / `null` / `''` / 129자 / `e2.` 접두사 / 잘못된 base64url | true / 나머지 false | R-LOCK-004·006 |
| SRV-T-368 | `createRoom_with_password` | `{ title: '밀실', password: 'abcd' }` | D1 행 `pass_hash` 형식 일치, 반환 `locked: true`·`entryKey`가 `assertEntry({kind:'room'})` 통과, `listRooms` 해당 행 `locked: true`, 응답 객체에 해시 없음 | R-LOCK-001·003 |
| SRV-T-369 | `createRoom_validation_order_before_db` | 제목 61자 + 비밀번호 3자 / 제목 정상 + 3자 / 제목 정상 + `''` | 제목 문구 / 비밀번호 문구 / 비밀번호 문구. 가짜 `Db` 호출 0회, `deriveBits` 0회 | R-LOCK-001 · R-ROOM-002 |
| SRV-T-370 | `createRoom_without_password_unchanged` | `{ title }` | `entryKey: null`, `locked: false`, 키 집합 `id,title,createdAt,updatedAt,messageCount,locked,entryKey`, D1 `pass_hash` NULL | R-LOCK-009 |
| SRV-T-371 | `enter_1_not_found` | 없는 id | `NOT_FOUND`, `rate_limits` 0행 | R-LOCK-004 |
| SRV-T-372 | `enter_2_unlocked_returns_null` | 안 잠긴 방 + 아무 비밀번호 | `{ entryKey: null }`, `rate_limits` 0행, `deriveBits` 0회 | R-LOCK-008 |
| SRV-T-373 | `enter_3_owner_free_pass` | 잠긴 방 + `isOwner: true` + 틀린 비밀번호 / 비밀번호 없음 | 둘 다 증명 → `assertEntry` 통과, `rate_limits` 0행, `deriveBits` 0회 | R-LOCK-005 |
| SRV-T-374 | `enter_4_no_password_locked` | 잠긴 방 + `password` 없음 | `ROOM_LOCKED`, `rate_limits` 0행 | R-LOCK-006·008 |
| SRV-T-375 | `enter_5_limit_before_hash` | 틀린 비밀번호 5회 → 6번째 **맞는** 비밀번호 | 1~5회 `ROOM_PASSWORD_WRONG`, 6번째 `RATE_LIMITED`·`retryAfterSec` ≥ 1·상황 문구, 6번째에서 `deriveBits` 증가 0, warn `room_enter_limited{roomId}` | R-LOCK-008 |
| SRV-T-376 | `enter_5_recovers_next_window` | 375 뒤 시계 +60초 | 맞는 비밀번호 → 증명 | R-LOCK-008 |
| SRV-T-377 | `enter_5_limit_is_per_room` | 방 A 한도 소진 뒤 방 B 맞는 비밀번호 | B 성공 | R-LOCK-008 |
| SRV-T-378 | `enter_6_wrong_password` | 틀린 비밀번호 | `ROOM_PASSWORD_WRONG`, info `room_enter_failed` 필드 키 = `['roomId']` | R-LOCK-004 |
| SRV-T-379 | `enter_6_broken_hash_closed` | D1에 길이 30의 형식 깨진 `pass_hash` 직접 UPDATE | `ROOM_PASSWORD_WRONG`, error `room_pass_hash_invalid{roomId}`, 주인은 ③으로 통과 | R-LOCK-007 |
| SRV-T-380 | `enter_7_correct_password` | 맞는 비밀번호 | 증명이 `issueEntryKey(K, id, 저장 해시)`와 같고 `assertEntry` 통과 | R-LOCK-004 |
| SRV-T-381 | `setPassword_locks_unlocked_room` | 안 잠긴 방(`updated_at` 100), now 999 | `room.locked: true`, `room.updatedAt === 100`, 증명 통과, info `room_password_set{roomId, mbId, wasLocked:false}` | R-LOCK-002 · D-S6-11 |
| SRV-T-382 | `setPassword_change_invalidates_old_key` | 잠긴 방 증명 k1 → 다른 비밀번호로 변경(k2) / **같은 비밀번호로** 재설정(k3) | k1 `ROOM_LOCKED`·k2 통과 / k2 `ROOM_LOCKED`·k3 통과, `wasLocked: true` | R-LOCK-004 |
| SRV-T-383 | `setPassword_errors` | 3자 / 없는 방 | `VALIDATION_ERROR`(D1·해시 0회) / `NOT_FOUND` | R-LOCK-002 |
| SRV-T-384 | `clearPassword_idempotent_and_reset_invalidates` | 잠긴 방 증명 k1 → 해제 2회 → 같은 비밀번호로 재설정 | 해제 두 번 다 `locked: false`·`updatedAt` 불변(둘째 `wasLocked: false`), 재설정 뒤 k1 `ROOM_LOCKED`, 없는 방 `NOT_FOUND` | R-LOCK-002·004 |
| SRV-T-385 | `assertEntry_room_target` | 없는 방 / 안 잠김 / 잠김+주인 / 잠김+맞는 증명 / 잠김+`null` / 잠김+다른 방 증명 | 통과 ×4 / `ROOM_LOCKED` ×2 | R-LOCK-005·006 |
| SRV-T-386 | `assertEntry_message_target` | 없는 메시지 / 안 잠긴 방 메시지 / 잠긴 방 메시지 + 주인 / + 그 방 증명 / + 다른 방 증명 / 증명 없음 | 통과 ×4 / `ROOM_LOCKED` ×2 | R-LOCK-006 |
| SRV-T-387 | `assertEntry_skips_crypto_when_unneeded` | 안 잠긴 방 + 증명 헤더 / 잠긴 방 + `entryKey: null` | `entrySecret` 호출 0회(spy) | R-LOCK-006(비용) |
| SRV-T-388 | `logs_never_contain_secrets` | 360~387 시나리오의 수집 로그 전체 `JSON.stringify` | 쓰인 비밀번호·해시·증명 문자열 0건 | R-LOCK-007 |
| SRV-T-389 | `existing_rooms_unlocked_after_0005` | 0005 적용 D1에 기존 방식 `INSERT`(칸 생략) | `listRooms` `locked: false`, `assertEntry` 통과 | R-LOCK-009 |

- 에러 경로(364·365 위반·369·371·374·375·378·379·383·385·386 일부) ≥ 정상 경로 수.
- 수동 체크: [ ] `wrangler dev`에서 E4(비밀번호) → E3 `locked: true` → E7 무헤더 403 → E17 → 받은 증명으로 E7 200(contract 라우트 생성 뒤) · [ ] `wrangler tail`에 비밀번호·증명 문자열이 안 나온다 · [ ] 배포 뒤 대시보드 CPU 시간 E17 ≤ 10ms.

### 12.11 contract 요구 명세

| 서비스 | 엔드포인트(02 §4 — 확정은 contract) | 입력 | 출력 | 에러 | 토큰 | 레이트리밋 | 관문 |
|---|---|---|---|---|---|---|---|
| `rooms.listRooms()` | E3 `GET /api/rooms` | — | `RoomSummary[]`(+`locked`) | 불변 | ✕ | ✕ | ✕ |
| `rooms.createRoom({ title, password? })` | E4 `POST /api/rooms` | 본문 `CreateRoomBody` — zod는 `password: z.string().optional()`(길이는 서비스) | `201 CreateRoomResponse` | `VALIDATION_ERROR` + 공통 | ○ | ○ | ✕ |
| `rooms.enter(id, { password, isOwner: isOwnerRequest(c) })` | E17 `POST /api/rooms/:id/enter` | 본문 `EnterRoomBody`(문자열·코드 포인트 ≤ 64, 1KiB) | `200 EnterRoomResponse` | `NOT_FOUND`·`ROOM_LOCKED`·`ROOM_PASSWORD_WRONG`·`RATE_LIMITED`·`VALIDATION_ERROR`(형식) | `optionalToken` | ✕(`rateLimitWrites` 없음 — 방 단위 계수는 서비스 안) | ✕ |
| `rooms.setPassword(id, password, { mbId })` | E18 `PUT /api/rooms/:id/password` | 본문 `SetRoomPasswordBody`(문자열, 1KiB) | `200 SetRoomPasswordResponse` | `VALIDATION_ERROR`·`NOT_FOUND`·`ROOM_LOCKED` + 공통 | ○ | ○ | ★room |
| `rooms.clearPassword(id, { mbId })` | E19 `DELETE /api/rooms/:id/password` | — | `200 RoomSummary` | `NOT_FOUND`·`ROOM_LOCKED` + 공통 | ○ | ○ | ★room |
| `rooms.assertEntry` | 관문 미들웨어 `requireRoomEntry`만 호출(라우트 직접 호출 금지) | — | — | `ROOM_LOCKED` | — | — | E5~E14·E18·E19 |

- `by.mbId`는 `getPrincipal(c).mbId`. E4는 `by`를 넘기지 않는다(생성 로그는 기존대로 없음).
- `ROOM_LOCKED`·`ROOM_PASSWORD_WRONG`은 `isAuthFailure`에 넣지 않는다(02 D-S6-9). 응답 문구는 shared 기본 문구, 429 상황 문구는 서비스가 정한 문구가 그대로 나간다.

### 12.12 요구 추적

| 요구 | 반영 | 테스트 | 상태 |
|---|---|---|---|
| R-LOCK-001 🔒 | §12.4.2 `createRoom` | SRV-T-365·368·369 | 설계 ✅ |
| R-LOCK-002 🔒 | §12.4.2 `setPassword`·`clearPassword` | SRV-T-381~384 | 설계 ✅ |
| R-LOCK-003 🔒 | `locked` 투영([db.md](db.md) §15) | SRV-T-368, db SRV-T-396 | 설계 ✅(날짜 숨김은 ui) |
| R-LOCK-004 🔒 | §12.3.4 · §12.4.1 | SRV-T-361·366·367·378·380·382·384 | 설계 ✅ |
| R-LOCK-005 🔒 | `enter` ③ · `assertEntry` 주인 | SRV-T-373·385·386 | 설계 ✅ |
| R-LOCK-006 🔒 | `assertEntry` · 관문([auth.md](auth.md) §14) | SRV-T-374·385~387 | 설계 ✅(경로 전수는 contract API-T) |
| R-LOCK-007 🔒 | §12.3.2 · §12.7 | SRV-T-360·362~364·379·388 | 설계 ✅ |
| R-LOCK-008 | `enter` ⑤ · auth `hitEnterLimit` | SRV-T-372~377 | 설계 ✅ |
| R-LOCK-009 🔒 | NULL 기본 · 생성 무비밀번호 불변 | SRV-T-370·389 | 설계 ✅ |
| R-ROOM-001~004 🔒 개정 | §12.1 · §12.2 | SRV-T-042(개정)·130(개정)·368~370 | 설계 ✅ |

### 12.13 설계 결정

| ID | 결정 | 대안·근거 |
|---|---|---|
| D-ROOM-5 (개정 S6) | `setPassword`·`clearPassword`만 `by: { mbId }`를 받고 로그에만 쓴다 | 권한은 관문·미들웨어가 정한다. 작성자 칸은 여전히 없다 |
| D-ROOM-9 | 판정 순서에서 계수(⑤)를 해시(⑥) 앞에 둔다 | 남용 요청이 CPU를 쓰기 전에 끊긴다(U7·U10). 주인·무비밀번호·안 잠긴 방은 해시가 없으니 세지 않는다 |
| D-ROOM-10 | 형식 깨진 해시 = 불일치(닫힌 쪽) + error 로그 | 500을 내면 원인 노출·재시도 유도. 주인은 ③으로 들어가 다시 설정할 수 있다 |
| D-ROOM-11 | 해시 감시는 `vi.spyOn(crypto.subtle, 'deriveBits')` | `RoomsDeps`에 해시 함수 주입을 더하면 §1.2 시그니처가 바뀐다 |
| D-ROOM-12 | `setPassHash`는 batch[이전 상태 SELECT, UPDATE, 요약 SELECT] | 로그 `wasLocked`를 정확히(같은 트랜잭션) 얻는다. 읽기 1행 추가뿐 |
| D-ROOM-13 | base64url을 `server/src/base64url.ts`로 옮기고 auth는 재노출 | rooms가 auth 내부 파일을 import하지 않는다(모듈 경계). 기존 import 경로는 재노출로 무수정 |
| D-ROOM-14 | `enter`에서 비밀번호 규칙(4~32)을 검사하지 않는다 | 규칙 밖 입력도 "틀림"으로 세야 대입 시도가 계수된다. 길이 상한 64는 라우트 400이 막는다 |
| D-ROOM-15 | `K`는 필요할 때만 파생(지연) | 안 잠긴 방·주인·무증명 경로에서 Web Crypto 호출 0회 |

확인 필요:

- `doc/100_요구조건/requirements.md`에 R-LOCK-001~009 행이 아직 없다(2026-10-08 grep). 요구 원문은 02 §10을 따랐다 — 메인 세션 반영 필요.
- `rate_limits.mb_id` 칸에 `enter:{roomId}`를 함께 넣는다. 그누보드 `mb_id`는 영숫자·밑줄이라 `:`가 없어 회원 버킷과 겹치지 않는다는 전제다([auth.md](auth.md) §14 · [db.md](db.md) §15).

### 12.14 파급

- `RoomsDeps` 필수 3필드 추가 → 호출자 `server/src/services.ts`([index.md](index.md) §15), `server/test/rooms.test.ts`의 `createRoomsService({ db, now })`(헬퍼로 교체). `RoomsService` 함수 4개 추가·`createRoom` 입출력 확장 → 라우트 `server/src/routes/rooms.ts`(contract 소유)가 E4 응답·E17~E19를 바꾼다. `RoomSummary.locked`(shared) 추가 → `RoomSummary`를 리터럴로 만드는 server 테스트 픽스처에 `locked` 추가.

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-08 | S6 설계(§12, 승인 ① 완료 — U6~U10): `password.ts`(PBKDF2-SHA256 기록형·반복 수 실측 규칙·trim 없는 4~32자 규칙)·`entry-key.ts`(TOKEN_SECRET 용도 파생 키·`e1.` 46자 증명)·`entry.ts`(`enter` 7단계·`assertEntry`), `setPassword`·`clearPassword`(`updated_at` 불변·`by` 로그 전용 — D-ROOM-5 개정), `createRoom` 비밀번호 동시 잠금, `RoomsDeps`에 `logger`·`entrySecret`·`hitEnterLimit`, 로그 4종, base64url 공통 위치 이동, SRV-T-360~389, D-ROOM-9~15. 인계 패킷 §1.2 시그니처 불변 |
| 2026-10-05 | S1 초안 작성 |
| 2026-10-05 | S1 구현 동기화(상태 확정). S2 설계: §2.2 "S2 예정"을 본문으로 승격, `RoomsDeps`에 `now` 추가(파급 §11 아래), `normalizeTitle`·`ROOM_TITLE_MAX` 추가, D-ROOM-2 개정, D-ROOM-4~8 추가 |

파급(공개 API 변경): `RoomsDeps`에 `now` 필수 추가 → 호출자 `server/src/services.ts`(`createServices`), `server/test/rooms.test.ts` 11행·48행의 `createRoomsService({ db })`를 `{ db, now }`로 고친다. 라우트(`server/src/routes/rooms.ts`)는 `listRooms` 호출만 있어 영향 없다.
