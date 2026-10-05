# rooms 모듈 설계

- 상태: 초안 · 최종 갱신: 2026-10-05
- 묶음: S1 구현 = R-ROOM-001(목록) · R-ROOM-005(`updated_at` 갱신 규칙). R-ROOM-002~004(생성·이름 변경·삭제)는 §2.2에 시그니처와 에러만 두고 상세는 S2에서 정한다.
- 관련 문서: [db.md](db.md)(`rooms` 테이블·`touchStmt`), [messages.md](messages.md)(갱신 시점의 호출자), [index.md](index.md)(서비스 컨테이너).

## 1. 목적

방은 대화 공책 한 권이다. rooms 모듈은 공책 목록을 "마지막으로 쓴 날짜가 최근인 순"으로 꽂아 두는 책장 관리인이다.

| 요구ID | 내용 |
|---|---|
| R-ROOM-001 🔒 | 방 목록: `id, title, createdAt, updatedAt, messageCount`, `updatedAt` 내림차순, 누구나 |
| R-ROOM-005 | `updated_at`은 메시지 추가·수정·삭제·재작성 시 갱신 |
| R-ROOM-002~004 🔒 | 생성·이름 변경·삭제 — S2 예정(§2.2) |

## 2. 공개 API

### 2.1 S1 구현 대상

```ts
// server/src/rooms/index.ts
import type { Db, RoomSummary } from '../db'

export type { RoomSummary }

export type RoomsService = {
  /** 전 방을 updatedAt 내림차순으로. 방이 없으면 빈 배열 */
  listRooms: () => Promise<RoomSummary[]>
}

export type RoomsDeps = { db: Db }

export const createRoomsService = (deps: RoomsDeps): RoomsService
```

| 이름 | 인자 | 반환 | 실패 조건(에러 코드) | 요구ID |
|---|---|---|---|---|
| `createRoomsService` | `deps: { db: Db }` | `RoomsService` | — | R-ROOM-001 |
| `listRooms` | — | `Promise<RoomSummary[]>` | 업무 에러 없음. D1 장애는 전파 → onError `INTERNAL` | R-ROOM-001 |

- `RoomSummary` = `{ id: string; title: string; createdAt: number; updatedAt: number; messageCount: number }`([db.md](db.md) §2.1). 시각은 epoch ms.
- 정렬: `updatedAt` 내림차순, 같으면 `id` 오름차순(결정적 순서). 정렬은 SQL(`ORDER BY`)이 하고 서비스는 다시 정렬하지 않는다.
- 페이지네이션 없음(요구 없음). 방 수가 많아지면 §11 참고.

### 2.2 S2 예정 (S1 미구현 — 시그니처·에러만)

```ts
// S2에서 RoomsService 에 추가 예정. 반환 타입·입력 검증 상세·actor 인자 필요 여부는 S2 설계에서 확정
createRoom: (input: { title: string }) => Promise<RoomSummary>
renameRoom: (id: string, input: { title: string }) => Promise<RoomSummary>
deleteRoom: (id: string) => Promise<void>
```

| 이름 | 규칙 요지 | 업무 에러 | 공통 에러(라우트 미들웨어) | 요구ID |
|---|---|---|---|---|
| `createRoom` | `title` trim 후 1~60자, id `crypto.randomUUID()`, `createdAt = updatedAt = now` | `VALIDATION_ERROR`(400) | `TOKEN_REQUIRED`·`TOKEN_INVALID`(401), `LEVEL_TOO_LOW`(403), `RATE_LIMITED`(429) | R-ROOM-002 |
| `renameRoom` | 같은 `title` 규칙, 등급 통과자 누구나 | `VALIDATION_ERROR`(400), `NOT_FOUND`(404) | 같음 | R-ROOM-003 |
| `deleteRoom` | memory → messages → rooms 순서로 한 batch 실삭제(soft delete 없음) | `NOT_FOUND`(404) | 같음 | R-ROOM-004 · R-DB-003 |

- 방 이름 변경이 `updated_at`을 바꾸는지는 R-ROOM-005 목록(메시지 추가·수정·삭제·재작성)에 없다. S2에서 정한다.

## 3. 내부 구조

| 파일 | 책임 |
|---|---|
| `server/src/rooms/index.ts` | 문서주석 6항목, `createRoomsService`·타입 재노출 |
| `server/src/rooms/service.ts` | `listRooms` 구현(S2에서 생성·변경·삭제 추가) |
| `server/test/rooms.test.ts` | SRV-T-040~043 |

- 의존: `../db`(타입·`Db`). 다른 서비스·`llm`·`auth`·HTTP 객체를 모른다.
- 상태 없음. 상수 없음(S2에서 `ROOM_TITLE_MAX = 60` 추가 예정, R-ROOM-002).

## 4. 비동기·동시성

```
route GET /api/rooms ─▶ rooms.listRooms() ─▶ db.rooms.listSummaries() ─▶ D1 (쿼리 1회)
                                ◀── RoomSummary[] (이미 정렬됨) ──┘
```

- 쿼리 1회, 쓰기 없음, 잠금 없음.
- 읽기 비용은 방 수 + 전체 메시지 수에 비례한다([db.md](db.md) §4.2).

### 4.1 `updated_at` 갱신 규칙 (R-ROOM-005)

| 사건 | 묶음 | 갱신 방법 | 담당 서비스 |
|---|---|---|---|
| 유저 발화·지시 저장 | S2 | `db.batch([messages.insertStmt(…), rooms.touchStmt(roomId, now)])` | messages.appendUserMessage |
| 캐릭터 발화(speak) 저장 | S3 | 같음 | messages.speak |
| 메시지 수정 | S2 | `db.batch([messages.updateTextStmt(…), rooms.touchStmt(…)])` | messages.editMessage |
| 메시지 삭제 | S2 | `db.batch([messages.deleteStmt(…), rooms.touchStmt(…)])` | messages.deleteMessage |
| 재작성(regenerate) | S3 | 같음 | messages.regenerate |
| 방 생성 | S2 | `created_at`과 같은 값으로 INSERT | rooms.createRoom |

- 갱신은 항상 메시지 쓰기와 **같은 batch**에 넣어 원자적으로 한다. 메시지는 바뀌었는데 목록 순서가 안 바뀌는 상태를 만들지 않는다.
- 시각은 서비스가 주입받은 `now()`로 만든다(db는 시각을 만들지 않는다).
- S1에는 쓰기 경로가 없으므로 S1 구현물은 `db.rooms.touchStmt`(SRV-T-027)와 이 규칙표다. 규칙 이행 테스트는 각 쓰기 서비스의 묶음에서 추가한다.

## 5. 에러 타입

| 에러 클래스 | shared 에러 코드 | HTTP | 한국어 메시지 | 원인 | 묶음 |
|---|---|---|---|---|---|
| (전파) D1 오류 | `INTERNAL` | 500 | `서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.` | D1 장애 | S1 |
| `AppError` | `VALIDATION_ERROR` | 400 | `방 제목은 1~60자로 입력해 주세요.` | 제목 규칙 위반 | S2 |
| `AppError` | `NOT_FOUND` | 404 | `방을 찾을 수 없습니다.` | 없는 방 이름 변경·삭제 | S2 |

## 6. 설정(env)

- 읽는 키: 없음. 쓰는 키: 없음.

## 7. DB 스키마·마이그레이션

- 사용 테이블: `rooms`, `messages`(개수만). 정의는 [db.md](db.md) §7.1 `0001_init.sql`.
- 인덱스: `idx_rooms_updated_at`(정렬), `idx_messages_room_id_id`(방별 개수).
- 새 마이그레이션 없음.

## 8. 테스트 계획

`server/test/rooms.test.ts`. workers pool의 D1 바인딩에 마이그레이션을 적용하고([db.md](db.md) §8), `createRoomsService({ db: createDb(env.DB) })`로 서비스를 만든다. 데이터는 직접 `INSERT`로 넣는다.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-040 | `listRooms_returns_empty_array_when_no_rooms` | 빈 DB | `[]` | R-ROOM-001 |
| SRV-T-041 | `listRooms_sorts_by_updatedAt_desc` | 방 3개 `updated_at` 100·300·200 | 300·200·100 순 | R-ROOM-001 |
| SRV-T-042 | `listRooms_includes_messageCount_and_fields` | 메시지 0·2·5개인 방 | 각 `messageCount`, 키 집합 = `id,title,createdAt,updatedAt,messageCount`, 시각이 number | R-ROOM-001 |
| SRV-T-043 | `listRooms_propagates_db_failure` | `listSummaries`가 reject하는 가짜 `Db` | 같은 에러로 reject(삼키지 않음) | R-ROOM-001 |

- R-ROOM-005 테스트는 [db.md](db.md) SRV-T-027(문장 동작) + S2·S3 쓰기 서비스 테스트(규칙 이행).
- S1 `listRooms`는 업무 에러 경로가 없어 에러 테스트가 1건(043)이다. 응답 형식 쪽 에러 경로는 [index.md](index.md) SRV-T-081~083이 맡는다.

수동 체크:

- [ ] 시드 적용 후 `curl http://localhost:3000/api/rooms`가 최근 갱신 순(contract 라우트 생성 후). 시드는 [messages.md](messages.md) §8.

## 9. contract 요구 명세

| 서비스 | 엔드포인트 후보 | 입력 | 출력 | 에러 | 토큰 | 레이트리밋 | 이유 |
|---|---|---|---|---|---|---|---|
| `rooms.listRooms()` | `GET /api/rooms` | 없음 | `RoomSummary[]` — `{ id: string; title: string; createdAt: number; updatedAt: number; messageCount: number }[]`, 이미 정렬됨 | `CONFIG_INVALID`(500), `INTERNAL`(500) | ✕ | ✕ | R-ROOM-001 · R-ROOMS-001 |
| `rooms.createRoom()` (S2) | `POST /api/rooms` | `{ title: string }` | S2 확정 | `VALIDATION_ERROR` + 토큰·레이트리밋 에러 | ○ | ○ | R-ROOM-002 |
| `rooms.renameRoom()` (S2) | `PATCH /api/rooms/:id` | `id`, `{ title: string }` | S2 확정 | `VALIDATION_ERROR`, `NOT_FOUND` + 공통 | ○ | ○ | R-ROOM-003 |
| `rooms.deleteRoom()` (S2) | `DELETE /api/rooms/:id` | `id` | 없음 | `NOT_FOUND` + 공통 | ○ | ○ | R-ROOM-004 |

- 응답을 배열 그대로 둘지 `{ rooms: [...] }`로 감쌀지는 contract가 정한다. 서비스는 배열을 돌려준다.
- 정렬은 서버가 보장하므로 ui는 다시 정렬하지 않아도 된다.

## 10. 요구 추적표

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-ROOM-001 🔒 | §2.1·§4·§9 | SRV-T-040~043, [db.md](db.md) SRV-T-024·025 | ✅ |
| R-ROOM-005 | §4.1 | [db.md](db.md) SRV-T-027 | 부분(규칙 이행은 S2·S3) |
| R-ROOM-002 🔒 | §2.2 | S2 | ❌(S2 예정) |
| R-ROOM-003 🔒 | §2.2 | S2 | ❌(S2 예정) |
| R-ROOM-004 🔒 | §2.2 | S2 | ❌(S2 예정) |

## 11. 설계 결정 노트

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-ROOM-1 | 정렬은 SQL, 동률은 `id` 오름차순 | 서비스에서 정렬 | 결정적 순서. 테스트가 흔들리지 않는다 |
| D-ROOM-2 | `updated_at` 갱신을 db 문장(`touchStmt`)으로 제공하고 각 쓰기 서비스가 자기 batch에 넣는다 | rooms 서비스의 `touch()` 함수를 messages가 호출 | 원자성(R-DB-003). 서비스 간 호출 없이 같은 batch에 묶인다 |
| D-ROOM-3 | S1 `RoomsService`에 S2 함수를 빈 구현으로 두지 않는다 | 미리 스텁 | 요구 기반 최소 구현 |

제안(설계 미반영):

- 방 목록 페이지네이션은 요구가 없다. 방이 수백 개를 넘으면 `GET /api/rooms` 응답 크기와 [db.md](db.md) §4.2 읽기 비용이 커진다. 그때 요구로 승격한다.
