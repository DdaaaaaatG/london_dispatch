# db 모듈 설계

- 상태: S1 확정(구현 동기화) · S2 초안 · S3 초안(§2.3·§3.5) · S3b 초안(§2.4·§3.6·§7.5) · S3c 구현 완료(§2.5·§3.7·§7.6·§8.1) · **S3d 초안(§12 유저 표시명 투영 — §3.4보다 우선)** · 최종 갱신: 2026-10-06
- 묶음: S1 = 스키마(4테이블 전부)·마이그레이션 `0001_init.sql`·읽기 함수. S2 = 방 생성·이름 변경·연쇄 삭제, 메시지 추가·수정·삭제, 레이트리밋 카운터(§2.1의 "S2" 표시). S3 = speak 잠금 선점·해제, 메시지 단건 조회, 장기기억 summary 읽기(§2.3 — **마이그레이션 없음**). S4용은 §2.2에 예정 시그니처만. S3b = 월 AI 사용량 누적 `llm_usage`(§2.4 — **마이그레이션 `0002_llm_usage.sql`**, R-LLM-007 🔒).
- 관련 문서: [env.md](env.md)(`DB` 바인딩), [index.md](index.md)(`createDb` 호출 지점), [rooms.md](rooms.md), [messages.md](messages.md), [auth.md](auth.md)(레이트리밋).

## 1. 목적

db 모듈은 창고지기다. 무엇을 넣고 뺄지는 사무실(서비스)이 정하고, 창고지기는 정해진 선반(테이블)에 정해진 방식(파라미터 바인딩)으로만 넣고 꺼낸다.

Cloudflare D1 바인딩(`DB`)을 감싸 테이블별 접근 함수를 제공한다. 행(`snake_case`)↔도메인 객체(`camelCase`) 변환은 이 모듈 경계에서 한 번만 한다. 무엇이 유효한지(제목 길이·권한·한도 값)는 갖지 않는다.

| 요구ID | 내용 |
|---|---|
| R-DB-001 🔒 | 4테이블 스키마, CHECK 제약, 시각 epoch ms INTEGER |
| R-DB-002 | 스키마 변경은 `server/migrations/NNNN_*.sql` 추가로만 |
| R-DB-003 | 모든 SQL `prepare().bind()`. 여러 문장은 `batch`. 방 삭제는 messages·memory와 한 batch |
| R-DB-004 | 인덱스 `messages(room_id, id)`, `rooms(updated_at)` |
| R-DB-005 | 테이블별 접근 함수만, 비즈니스 규칙 없음, 서비스 import 금지 |
| R-ROOM-002~005 · R-MSG-002·004·005 | 방·메시지 쓰기 문장과 `updated_at` 갱신 문장(S2) |
| R-AUTH-005 | `rate_limits` 조건부 UPSERT·오래된 창 삭제(S2) |
| R-NFR-002 · R-NFR-005 | 첫 페이지 인덱스 범위 스캔 1회, 핫패스 쿼리 수·행 수 명시(§4.2) |

## 2. 공개 API

### 2.1 S1(구현됨) + S2

```ts
// server/src/db/index.ts
import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types'

// 도메인 타입은 계약 타입을 그대로 재노출한다(db 가 따로 정의하지 않는다) — types.ts
export type { Message, MessageKind, RoomSummary, Speaker } from '@shared/types'

/** S2. 메시지 INSERT 입력. 유저 메시지는 author 둘 다 문자열, 캐릭터 메시지는 둘 다 null (CHECK 가 강제) */
export type NewMessage = {
  roomId: string
  speaker: Speaker
  kind: MessageKind
  text: string
  authorMbId: string | null
  authorName: string | null
}

export type RoomsRepo = {
  /** S1. 전 방 + 메시지 수, updated_at 내림차순(동률은 id 오름차순) */
  listSummaries: () => Promise<RoomSummary[]>
  /** S1. 방 존재 여부 */
  exists: (id: string) => Promise<boolean>
  /** S1. updated_at 갱신 문장(실행하지 않음) */
  touchStmt: (id: string, nowMs: number) => D1PreparedStatement
  /** S2. created_at = updated_at = nowMs, speaking_until NULL */
  insert: (room: { id: string; title: string; nowMs: number }) => Promise<void>
  /** S2. 제목만 변경(updated_at 유지) + 요약 재조회를 한 batch 로. 방이 없으면 null */
  updateTitle: (id: string, title: string) => Promise<RoomSummary | null>
  /** S2. memory → messages → rooms 순서 DELETE 를 한 batch 로. 방이 없었으면 false */
  deleteCascade: (id: string) => Promise<boolean>
}

export type MessagesRepo = {
  /** S1. room 의 메시지를 id 내림차순으로 take 건. beforeId 가 있으면 id < beforeId 만 */
  pageDesc: (roomId: string, take: number, beforeId?: number) => Promise<Message[]>
  /** S2. 방이 있을 때만 INSERT + 그 방 updated_at = nowMs 를 한 batch 로. 방이 없으면 null(아무것도 쓰지 않음) */
  insert: (m: NewMessage, nowMs: number) => Promise<Message | null>
  /** S2. text 교체 + 그 메시지의 방 updated_at = nowMs 를 한 batch 로. 메시지가 없으면 null */
  updateText: (id: number, text: string, nowMs: number) => Promise<Message | null>
  /** S2. 그 메시지의 방 updated_at = nowMs → DELETE 를 한 batch 로. 메시지가 없었으면 false */
  deleteById: (id: number, nowMs: number) => Promise<boolean>
}

export type RateLimitsRepo = {
  /** S2. (mbId, windowStartMs) 창 카운트 +1. count < limit 일 때만 증가하고 새 count 를, 한도면 null */
  hit: (mbId: string, windowStartMs: number, limit: number) => Promise<number | null>
  /** S2. window_start < windowStartMs 인 행(모든 mb_id)을 지우고 지운 행 수 */
  purgeBefore: (windowStartMs: number) => Promise<number>
}

export type Db = {
  readonly rooms: RoomsRepo
  readonly messages: MessagesRepo
  /** S2 */
  readonly rateLimits: RateLimitsRepo
  /** 여러 문장을 원자적으로 실행(D1 batch = 한 트랜잭션, 하나라도 실패하면 전부 롤백) */
  readonly batch: (stmts: readonly D1PreparedStatement[]) => Promise<D1Result[]>
}

/** D1 바인딩을 감싼 접근 객체. 부트스트랩이 요청마다 만든다 */
export const createDb = (binding: D1Database): Db
```

| 이름 | 묶음 | 인자 | 반환 | 실패 조건 | 요구ID |
|---|---|---|---|---|---|
| `createDb` | S1 | `binding` | `Db` | 없음 | R-DB-005 |
| `rooms.listSummaries` | S1 | — | `RoomSummary[]` | D1 오류 전파 | R-ROOM-001 |
| `rooms.exists` | S1 | `id` | `boolean` | 같음 | R-MSG-001 |
| `rooms.touchStmt` | S1 | `id, nowMs` | `D1PreparedStatement` | 실행 시 0행 = 방 없음 | R-ROOM-005 |
| `rooms.insert` | S2 | `{ id, title, nowMs }` | `void` | PK 충돌·CHECK 위반 → D1 오류 전파 | R-ROOM-002 |
| `rooms.updateTitle` | S2 | `id, title` | `RoomSummary \| null` | CHECK 위반 → 전파 | R-ROOM-003 |
| `rooms.deleteCascade` | S2 | `id` | `boolean` | 전파(전체 롤백) | R-ROOM-004 · R-DB-003 |
| `messages.pageDesc` | S1 | `roomId, take, beforeId?` | `Message[]`(id 내림차순) | 전파 | R-MSG-001 |
| `messages.insert` | S2 | `NewMessage, nowMs` | `Message \| null` | CHECK 위반(작성자 조합 등) → 전파 | R-MSG-002 · R-ROOM-005 |
| `messages.updateText` | S2 | `id, text, nowMs` | `Message \| null` | CHECK 위반(빈 text) → 전파 | R-MSG-004 · R-ROOM-005 |
| `messages.deleteById` | S2 | `id, nowMs` | `boolean` | 전파 | R-MSG-005 · R-ROOM-005 |
| `rateLimits.hit` | S2 | `mbId, windowStartMs, limit` | `number \| null` | 전파 | R-AUTH-005 |
| `rateLimits.purgeBefore` | S2 | `windowStartMs` | `number` | 전파(호출자가 무시 가능) | R-AUTH-005 |
| `batch` | S1 | `stmts` | `D1Result[]` | 한 문장이라도 실패 → 전체 롤백 후 throw | R-DB-003 |

- 범위·길이·한도 값 검사는 하지 않는다(서비스 몫, R-DB-005). `limit`·`take`는 받은 값을 그대로 바인딩한다.
- `speaker`·`kind`는 좁히기 함수(`toSpeaker`·`toKind`)로 검사한다. 실패하면 `AppError('INTERNAL', '저장된 데이터 형식이 올바르지 않습니다.')`.
- `Message`에는 `author_mb_id`가 없다(D-DB-5). `NewMessage.authorMbId`는 쓰기 전용이다.
- `touchStmt`는 S1 공개 API로 남긴다. S2 쓰기 함수는 같은 SQL을 자기 batch 안에서 쓴다(D-DB-8).

### 2.2 후속 묶음 예정 (S3·S4 — 스키마가 감당하는지 확인용, 해당 묶음에서 확정)

| 묶음 | 저장소 | 예정 시그니처 | SQL 요지 | 요구ID |
|---|---|---|---|---|
| S3 | rooms·messages·memory | **§2.3에서 확정**(아래 예정안을 대체) | — | R-MSG-006·007 · R-LLM-003 |
| S4 | memory | `get` / `put` / `advance(roomId, expectedUntilId, newUntilId, summary, nowMs): Promise<boolean>` | `advance`는 `WHERE source_until_id = ?` 조건부 UPDATE | R-MEM-001~003 |

- S3 speak 저장은 `messages.insert`, regenerate 교체는 `messages.updateText`를 재사용한다(`updated_at` 갱신이 함께 된다).
- S1·S2 문서의 S3 예정안 중 `acquireSpeakLock(): Promise<boolean>`은 세 값 결과로, `releaseSpeakLock(): Promise<void>`는 `boolean`으로 바뀌고, `recent`·`last`는 만들지 않는다(`pageDesc` 재사용 — D-DB-16).

### 2.3 S3 확정 — speak·regenerate 지원 ([messages.md](messages.md) §4.2)

```ts
// server/src/db/rooms.ts — RoomsRepo 에 추가
/** 선점 결과. missing = 방 없음 */
export type SpeakLockResult = 'acquired' | 'busy' | 'missing'
  /** S3. speaking_until 이 NULL 이거나 만료(≤ nowMs)일 때만 untilMs 로 선점 + 방 존재 확인을 한 batch 로 */
  acquireSpeakLock: (id: string, untilMs: number, nowMs: number) => Promise<SpeakLockResult>
  /** S3. 내가 건 잠금(speaking_until = untilMs)일 때만 NULL 로. 지웠으면 true */
  releaseSpeakLock: (id: string, untilMs: number) => Promise<boolean>

// server/src/db/messages.ts — MessagesRepo 에 추가
  /** S3. 메시지 1건. 없으면 null. author_mb_id 는 조회하지 않는다(D-DB-5) */
  getById: (id: number) => Promise<Message | null>

// server/src/db/memory.ts — 신규. S3 은 읽기 1개, S4 가 get·put·advance 를 더한다
export type MemoryRepo = {
  /** S3. 방의 memory.summary. memory 행이 없으면 null(빈 문자열 행은 '') */
  getSummary: (roomId: string) => Promise<string | null>
}

// server/src/db/index.ts — Db 에 추가
  readonly memory: MemoryRepo
```

| 이름 | 묶음 | 인자 | 반환 | 실패 | 요구ID |
|---|---|---|---|---|---|
| `rooms.acquireSpeakLock` | S3 | `id, untilMs, nowMs` | `'acquired' \| 'busy' \| 'missing'` | 전파 | R-MSG-007 · R-NFR-003 |
| `rooms.releaseSpeakLock` | S3 | `id, untilMs` | `boolean` | 전파(호출자가 잡아 로그) | R-MSG-007 |
| `messages.getById` | S3 | `id` | `Message \| null` | 전파 | R-MSG-006 |
| `memory.getSummary` | S3 | `roomId` | `string \| null` | 전파 | R-LLM-003 |

- **최근 N개·마지막 메시지 판정은 기존 `pageDesc`를 쓴다.** speak 컨텍스트 = `pageDesc(roomId, contextMessages)`를 뒤집은 것. regenerate는 `pageDesc(roomId, contextMessages + 1)`의 첫 행이 대상인지로 "마지막 메시지"를 판정하고 나머지를 컨텍스트로 쓴다(왕복 1회). 인덱스 `idx_messages_room_id_id` 역순 범위 스캔이다.
- 잠금 판정·`untilMs` 계산(선점 시각 + 90000)은 messages 서비스 몫이다. db는 받은 값을 쓴다(시각을 만들지 않는다 — §3).
- 잠금 선점·해제는 `updated_at`을 바꾸지 않는다(잠금은 대화 활동이 아니다 — R-ROOM-005 목록 밖).
- **마이그레이션 불필요.** `rooms.speaking_until`(NULL 허용)과 `memory` 테이블은 `0001_init.sql`에 이미 있다(§7.1). 새 인덱스도 필요 없다(잠금은 PK 조회, `getById`도 PK, `getSummary`는 `memory` PK).

### 2.4 S3b 확정 — 월 AI 사용량 (`llm_usage`, R-LLM-007)

```ts
// server/src/db/llm-usage.ts — 신규
export type LlmUsageTotals = {
  month: string          // 'YYYY-MM' (KST). 계산은 llm 모듈, db 는 받은 문자열을 쓴다
  calls: number
  promptTokens: number
  outputTokens: number   // candidates + thoughts
  estKrw: number         // REAL, 소수 보존
}
export type LlmUsageDelta = { promptTokens: number; outputTokens: number; estKrw: number }
export type LlmUsageRepo = {
  /** month 행에 1회분을 더한다(없으면 만든다). UPSERT 1문장, 갱신 뒤 누적 행 반환 */
  add: (month: string, delta: LlmUsageDelta, nowMs: number) => Promise<LlmUsageTotals>
  /** month 행. 없으면 null */
  get: (month: string) => Promise<LlmUsageTotals | null>
}
export const createLlmUsageRepo = (binding: D1Database): LlmUsageRepo

// server/src/db/types.ts — 행 타입 추가
export type LlmUsageRow = {
  month: string
  calls: number
  prompt_tokens: number
  output_tokens: number
  est_krw: number
}

// server/src/db/index.ts — Db 에 추가, 타입 재노출 LlmUsageRepo·LlmUsageTotals·LlmUsageDelta
  /** S3b */
  readonly llmUsage: LlmUsageRepo
```

| 이름 | 묶음 | 인자 | 반환 | 실패 | 요구ID |
|---|---|---|---|---|---|
| `llmUsage.add` | S3b | `month, delta, nowMs` | `LlmUsageTotals` | D1 오류 전파, `RETURNING` 행 없음 → `AppError INTERNAL`(호출자 `meter.record`가 삼킨다) | R-LLM-007 |
| `llmUsage.get` | S3b | `month` | `LlmUsageTotals \| null` | 전파(게이트가 500으로 — [llm.md](llm.md) D-LLM-22) | R-LLM-007 |

- `LlmUsageRepo`는 llm의 저장소 포트 `UsageStore`([llm.md](llm.md) §12.2)를 구조적으로 만족한다. db는 llm을 import하지 않는다(R-DB-005). 컨테이너가 `db.llmUsage`를 그대로 넘긴다([index.md](index.md) §2.3 S3b).
- 월 1행(연 12행)이라 정리(purge) 함수가 없다.
- 시각은 `nowMs` 인자만 쓴다(§3 규칙). 월 키도 llm이 만든다.

### 2.5 S3c 확정 — 캐릭터 설정 1행 문서 (`character_settings`, R-SET-003)

- **구현 완료(2026-10-06)**: server 318/318 통과 · `0003` 로컬 적용 · S3c 테스트 SRV-T-234~260(이 문서 몫 SRV-T-239).

설정 보관함은 서랍이 하나뿐인 금고다. 넣을 때는 통째로 바꿔 넣고(전체 교체), 바꿀 때마다 판 번호(version)가 하나 오른다. 금고는 안의 서류를 읽지 않는다. 서류 검사는 settings 모듈이 한다.

```ts
// server/src/db/character-settings.ts — 신규
export type CharacterSettingsRecord = {
  /** 설정 본체 JSON 문자열. db 는 해석·검증하지 않는다(재검증은 settings 모듈) */
  json: string
  /** 1 이상. 저장할 때마다 +1 */
  version: number
  /** epoch ms */
  updatedAt: number
}
export type CharacterSettingsRepo = {
  /** id = 1 행. 없으면 null. updated_by 는 읽지 않는다(응답에 없음) */
  get: () => Promise<CharacterSettingsRecord | null>
  /** id = 1 행을 만들거나(version 1) 덮어쓴다(version + 1). UPSERT 1문장, 갱신 뒤 version·updatedAt 반환 */
  upsert: (json: string, updatedBy: string, nowMs: number) => Promise<{ version: number; updatedAt: number }>
}
export const createCharacterSettingsRepo = (binding: D1Database): CharacterSettingsRepo

// server/src/db/types.ts — 행 타입 추가
export type CharacterSettingsRow = { json: string; version: number; updated_at: number }
export type CharacterSettingsWriteRow = { version: number; updated_at: number }

// server/src/db/index.ts — Db 에 추가, 타입 재노출 CharacterSettingsRepo·CharacterSettingsRecord
  /** S3c */
  readonly characterSettings: CharacterSettingsRepo
// createDb 에 characterSettings: createCharacterSettingsRepo(binding)
```

| 이름 | 묶음 | 인자 | 반환 | 실패 | 요구ID |
|---|---|---|---|---|---|
| `characterSettings.get` | S3c | — | `CharacterSettingsRecord \| null` | D1 오류 전파(`0003` 미적용이면 테이블 없음 → 500) | R-SET-003 |
| `characterSettings.upsert` | S3c | `json, updatedBy, nowMs` | `{ version, updatedAt }` | D1 오류·CHECK 위반 전파, `RETURNING` 행 없음 → `AppError INTERNAL` | R-SET-003 · R-AUTH-006 |

- 1행 문서라 id 인자가 없다. `id = 1`은 SQL 상수 안 리터럴이다.
- `updatedBy`는 호출자(settings `put`)가 `Principal.mbId`를 넘긴다(R-AUTH-006 — mbId만). 주인 ID는 env에서 1~20자로 검증되므로 정상 경로에서 CHECK를 어기지 않는다.
- db는 JSON을 해석하지 않는다. 검증·시드 대체는 [settings.md](settings.md) §2.4.
- 1행이라 정리(purge) 함수가 없다. 시각은 `nowMs` 인자만 쓴다(§3 규칙).

## 3. 내부 구조

| 파일 | 책임 |
|---|---|
| `server/src/db/index.ts` | `createDb`, 공개 타입 재노출 |
| `server/src/db/types.ts` | 계약 타입 재노출, 행 타입(`RoomSummaryRow`·`MessageRow`·S2 `RateLimitRow`), `NewMessage`, `toSpeaker`·`toKind` |
| `server/src/db/sql.ts` | SQL 문자열 상수(§3.1·§3.2). 문자열 연결·템플릿 보간 금지 |
| `server/src/db/rooms.ts` | `createRoomsRepo(binding)` — `toRoomSummary` 포함 |
| `server/src/db/messages.ts` | `createMessagesRepo(binding)`, `toMessage(row)`(파일 export, index 미노출) |
| `server/src/db/rate-limits.ts` | S2 `createRateLimitsRepo(binding)` |
| `server/src/db/memory.ts` | S3 `createMemoryRepo(binding)` — `getSummary`(S4가 확장) |
| `server/src/db/llm-usage.ts` | S3b `createLlmUsageRepo(binding)` — `add`·`get`, `toLlmUsageTotals(row)` |
| `server/migrations/0001_init.sql` | 초기 스키마(§7) |
| `server/migrations/0002_llm_usage.sql` | S3b `llm_usage` 테이블(§7.5) |
| `server/test/db.test.ts` | SRV-T-020~031(S1), SRV-T-121~128(S2), SRV-T-187~190(S3), SRV-T-223·224(S3b) |
| `server/test/helpers.ts` | `resetDb`(자식 먼저 + `rate_limits` + S3b `llm_usage`), S3b `insertUsage(month, estKrw, calls = 1)`·`insertRoom`·`insertLine`·`insertLines` |

- 의존: `@cloudflare/workers-types`(타입), `@shared/types`(타입), `../app-error`. 서비스 모듈(`rooms/`·`messages/`·`auth/` 등) import 금지(R-DB-005).
- 상태 없음. 전역 연결 객체·`PRAGMA` 설정 없음.
- 시각을 만들지 않는다. `Date.now()`·`CURRENT_TIMESTAMP`·`unixepoch()` 대신 서비스가 넘긴 `nowMs`만 쓴다.

### 3.1 S1 SQL 상수 (구현됨)

```sql
-- SQL_ROOMS_LIST_SUMMARIES
SELECT r.id, r.title, r.created_at, r.updated_at,
       (SELECT COUNT(*) FROM messages m WHERE m.room_id = r.id) AS message_count
FROM rooms r
ORDER BY r.updated_at DESC, r.id ASC

-- SQL_ROOMS_EXISTS
SELECT 1 AS found FROM rooms WHERE id = ?1 LIMIT 1

-- SQL_ROOMS_TOUCH
UPDATE rooms SET updated_at = ?1 WHERE id = ?2

-- SQL_MESSAGES_PAGE_LATEST / SQL_MESSAGES_PAGE_BEFORE
SELECT id, room_id, speaker, kind, text, author_name, created_at
FROM messages
WHERE room_id = ?1 [AND id < ?2]
ORDER BY id DESC
LIMIT ?2 | ?3
```

### 3.2 S2 SQL 상수

```sql
-- SQL_ROOMS_INSERT
INSERT INTO rooms (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)

-- SQL_ROOMS_UPDATE_TITLE
UPDATE rooms SET title = ?1 WHERE id = ?2

-- SQL_ROOMS_SUMMARY_BY_ID            (updateTitle batch 두 번째 문장)
SELECT r.id, r.title, r.created_at, r.updated_at,
       (SELECT COUNT(*) FROM messages m WHERE m.room_id = r.id) AS message_count
FROM rooms r
WHERE r.id = ?1

-- SQL_MEMORY_DELETE_BY_ROOM / SQL_MESSAGES_DELETE_BY_ROOM / SQL_ROOMS_DELETE   (deleteCascade, 이 순서)
DELETE FROM memory   WHERE room_id = ?1
DELETE FROM messages WHERE room_id = ?1
DELETE FROM rooms    WHERE id = ?1

-- SQL_MESSAGES_INSERT_IF_ROOM        (방이 있을 때만 — 없으면 0행, RETURNING 없음)
INSERT INTO messages (room_id, speaker, kind, text, author_mb_id, author_name, created_at)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ?1)
RETURNING id, room_id, speaker, kind, text, author_name, created_at

-- SQL_MESSAGES_UPDATE_TEXT
UPDATE messages SET text = ?1 WHERE id = ?2
RETURNING id, room_id, speaker, kind, text, author_name, created_at

-- SQL_ROOMS_TOUCH_BY_MESSAGE          (메시지가 없으면 0행)
UPDATE rooms SET updated_at = ?1 WHERE id = (SELECT room_id FROM messages WHERE id = ?2)

-- SQL_MESSAGES_DELETE
DELETE FROM messages WHERE id = ?1

-- SQL_RATE_LIMITS_HIT
INSERT INTO rate_limits (mb_id, window_start, count) VALUES (?1, ?2, 1)
ON CONFLICT (mb_id, window_start) DO UPDATE SET count = count + 1 WHERE count < ?3
RETURNING count

-- SQL_RATE_LIMITS_PURGE_BEFORE
DELETE FROM rate_limits WHERE window_start < ?1
```

- `RETURNING`은 실제로 넣거나 바꾼 행만 돌려준다. 그래서 "방 없음"(INSERT…SELECT 0행)과 "한도 도달"(`DO UPDATE … WHERE` 거짓)은 결과 행이 없다는 것으로 판정한다(`meta.changes`보다 의도가 분명하다 — D-DB-10).
- 모든 `RETURNING` 목록은 S1 조회와 같은 7컬럼이라 `toMessage`를 그대로 쓴다. `author_mb_id`는 돌려주지 않는다.

### 3.3 S2 batch 구성과 결과 해석

| 함수 | batch 문장(순서) | 결과 해석 |
|---|---|---|
| `rooms.insert` | 단일 `run()` | — |
| `rooms.updateTitle` | `[UPDATE_TITLE(title, id), SUMMARY_BY_ID(id)]` | `results[1].results[0]` → `toRoomSummary`, 없으면 `null` |
| `rooms.deleteCascade` | `[MEMORY_DELETE_BY_ROOM, MESSAGES_DELETE_BY_ROOM, ROOMS_DELETE]` | `results[2].meta.changes > 0` |
| `messages.insert` | `[MESSAGES_INSERT_IF_ROOM(…, nowMs), ROOMS_TOUCH(nowMs, roomId)]` | `results[0].results[0]` → `toMessage`, 없으면 `null`(touch도 0행) |
| `messages.updateText` | `[MESSAGES_UPDATE_TEXT(text, id), ROOMS_TOUCH_BY_MESSAGE(nowMs, id)]` | `results[0].results[0]` → `toMessage`, 없으면 `null` |
| `messages.deleteById` | `[ROOMS_TOUCH_BY_MESSAGE(nowMs, id), MESSAGES_DELETE(id)]` — **touch가 먼저**(삭제 뒤에는 room_id를 못 찾는다) | `results[1].meta.changes > 0` |
| `rateLimits.hit` | 단일 `first<{ count: number }>()` | `row?.count ?? null` |
| `rateLimits.purgeBefore` | 단일 `run()` | `meta.changes` |

- 행 → 도메인 변환은 각 저장소 파일 안에서 끝낸다. 서비스는 `D1Result`를 보지 않는다.

### 3.4 행 ↔ 도메인 변환

| 컬럼 | 도메인 필드 | 변환 |
|---|---|---|
| `rooms.created_at` / `updated_at` | `createdAt` / `updatedAt` | number(epoch ms) |
| `message_count` | `messageCount` | number |
| `messages.room_id` | `roomId` | string |
| `messages.speaker` / `kind` | `speaker` / `kind` | `toSpeaker` / `toKind` |
| `messages.author_name` | `authorName` | `string \| null` |
| `messages.author_mb_id` | (조회 안 함) / `NewMessage.authorMbId`(쓰기) | 쓰기 전용 |
| `rate_limits.count` | `hit` 반환값 | number |

### 3.5 S3 SQL 상수와 batch 해석

```ts
/** 비었거나 만료(≤ ?3)일 때만 선점. 선점하면 1행 RETURNING */
export const SQL_ROOMS_ACQUIRE_SPEAK_LOCK = `UPDATE rooms SET speaking_until = ?1
WHERE id = ?2 AND (speaking_until IS NULL OR speaking_until <= ?3)
RETURNING id`

/** 내가 건 잠금일 때만 해제 */
export const SQL_ROOMS_RELEASE_SPEAK_LOCK =
  'UPDATE rooms SET speaking_until = NULL WHERE id = ?1 AND speaking_until = ?2'

export const SQL_MESSAGES_BY_ID = `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?1`

export const SQL_MEMORY_SUMMARY_BY_ROOM = 'SELECT summary FROM memory WHERE room_id = ?1'
```

| 함수 | 문장 | 결과 해석 |
|---|---|---|
| `acquireSpeakLock(id, untilMs, nowMs)` | `batch[ ACQUIRE.bind(untilMs, id, nowMs), SQL_ROOMS_EXISTS.bind(id) ]` | `results[0].results.length > 0` → `'acquired'`. 아니면 `results[1].results.length > 0` → `'busy'`. 둘 다 0 → `'missing'` |
| `releaseSpeakLock(id, untilMs)` | `RELEASE.bind(id, untilMs).run()` | `meta.changes > 0` |
| `getById(id)` | `BY_ID.bind(id).first<MessageRow>()` | `null` 또는 `toMessage(row)` |
| `getSummary(roomId)` | `SUMMARY_BY_ROOM.bind(roomId).first<{ summary: string }>()` | `null` 또는 `row.summary` |

- 선점 batch는 트랜잭션이다. UPDATE와 존재 확인 사이에 방이 삭제될 틈이 없어 `'busy'`·`'missing'` 구분이 정확하다.
- `RETURNING id`는 S2 `UPDATE … RETURNING`(`SQL_MESSAGES_UPDATE_TEXT`)과 같은 D1 기능이다.

### 3.6 S3b SQL 상수와 결과 해석

```ts
/** 월 행에 1회분 가산. 조건 없는 UPSERT — 이미 쓴 비용은 항상 기록한다(D-DB-20) */
export const SQL_LLM_USAGE_ADD = `INSERT INTO llm_usage (month, calls, prompt_tokens, output_tokens, est_krw, updated_at)
VALUES (?1, 1, ?2, ?3, ?4, ?5)
ON CONFLICT (month) DO UPDATE SET
  calls = calls + 1,
  prompt_tokens = prompt_tokens + excluded.prompt_tokens,
  output_tokens = output_tokens + excluded.output_tokens,
  est_krw = est_krw + excluded.est_krw,
  updated_at = excluded.updated_at
RETURNING month, calls, prompt_tokens, output_tokens, est_krw`

export const SQL_LLM_USAGE_BY_MONTH =
  'SELECT month, calls, prompt_tokens, output_tokens, est_krw FROM llm_usage WHERE month = ?1'
```

| 함수 | 문장 | 결과 해석 |
|---|---|---|
| `add(month, delta, nowMs)` | `ADD.bind(month, delta.promptTokens, delta.outputTokens, delta.estKrw, nowMs).first<LlmUsageRow>()` | 행 → `toLlmUsageTotals`, `null` → `AppError INTERNAL` |
| `get(month)` | `BY_MONTH.bind(month).first<LlmUsageRow>()` | `null` 또는 `toLlmUsageTotals(row)` |

- `rate_limits` HIT(D-DB-10)와 같은 UPSERT·`RETURNING` 관례다. 다만 `DO UPDATE … WHERE` 조건이 없다. 한도 판정은 llm 게이트가 읽기로 따로 한다.
- 가산 갱신 한 문장이라 동시 누적에도 유실이 없다(D1이 쓰기를 직렬 실행).
- `est_krw`에 JS 정수(예 `0`)를 bind해도 컬럼 REAL 친화도가 실수로 저장한다. 읽은 값은 JS `number`.
- 비용: speak 1회 = 읽기 1행(게이트, PK) + 쓰기 1~2행(시도 수, PK). 무료 한도(일 쓰기 10만 행)에 영향이 작다.

### 3.7 S3c SQL 상수와 결과 해석

```ts
// ---- S3c ----
export const SQL_CHARACTER_SETTINGS_GET =
  'SELECT json, version, updated_at FROM character_settings WHERE id = 1'

/** 1행 문서 UPSERT. 조건 없음 — 마지막 쓰기 승리(settings.md D-SET-5) */
export const SQL_CHARACTER_SETTINGS_UPSERT = `INSERT INTO character_settings (id, json, version, updated_at, updated_by)
VALUES (1, ?1, 1, ?2, ?3)
ON CONFLICT (id) DO UPDATE SET
  json = excluded.json,
  version = character_settings.version + 1,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by
RETURNING version, updated_at`
```

| 함수 | 문장 | 결과 해석 |
|---|---|---|
| `get()` | `GET.first<CharacterSettingsRow>()` | `null` 또는 `{ json, version, updatedAt: updated_at }` |
| `upsert(json, updatedBy, nowMs)` | `UPSERT.bind(json, nowMs, updatedBy).first<CharacterSettingsWriteRow>()` | 행 → `{ version, updatedAt }`, `null` → `AppError INTERNAL` |

- `llm_usage` ADD(§3.6)와 같은 조건 없는 UPSERT·`RETURNING` 관례다. 새 행은 version 1, 기존 행은 `character_settings.version + 1`(기존 행 값 기준 — 테이블명으로 한정해 뜻을 분명히 한다).
- 한 문장이라 동시 PUT 두 건도 행이 깨지지 않고 version이 각각 +1 된다(D1 쓰기 직렬 실행).
- CHECK 위반(json 길이·`updated_by` 길이)은 D1 오류로 전파되어 500이다. 정상 경로에서는 도달하지 않는다(§7.6).

## 4. 비동기·동시성

```
서비스
  └ (S1) db.rooms.listSummaries() / Promise.all([exists, pageDesc])                     ── 읽기
  └ (S2) db.rooms.insert / updateTitle / deleteCascade                                   ── 단일 또는 batch
  └ (S2) db.messages.insert / updateText / deleteById  ── 각자 batch[메시지 문장, rooms.updated_at] ── 원자적
  └ (S2) db.rateLimits.hit  ── UPSERT 1문장(증가+한도 판정이 한 문장)                      ── 원자적
  └ (S3) db.rooms.acquireSpeakLock ── batch[조건부 UPDATE RETURNING, 존재 확인]             ── 원자적
  └ (S3) db.rooms.releaseSpeakLock ── 조건부 UPDATE 1문장(내 untilMs 일 때만)                ── 원자적
  └ (S3) db.messages.getById · db.memory.getSummary · pageDesc                              ── 읽기
```

- 전부 `async`/`await`.
- 동시성 원칙: 읽고-판단하고-쓰는 흐름을 **한 문장의 조건**(`WHERE EXISTS`, `DO UPDATE … WHERE count < ?`, S3 `speaking_until` 조건부 UPDATE)이나 batch로 닫는다. 프로세스 메모리 잠금·카운터 금지.
- D1은 쓰기를 한 주 인스턴스에서 직렬 실행하고 batch는 트랜잭션이다. 같은 `mb_id`로 동시에 `hit`해도 한도를 넘지 않는다([auth.md](auth.md) SRV-T-114).
- 타임아웃은 두지 않는다(D1 호출은 플랫폼이 제한).

### 4.1 시각 규칙 (epoch ms)

| 컬럼 | 의미 | 값 |
|---|---|---|
| `rooms.created_at`, `rooms.updated_at` | 생성·마지막 메시지 변경 시각 | epoch ms |
| `rooms.speaking_until` | speak 잠금 만료 시각(NULL = 없음) | 선점 시각 + 90000 |
| `messages.created_at` | 작성 시각 | epoch ms(수정해도 유지) |
| `memory.updated_at` | 요약·편집 시각 | epoch ms |
| `rate_limits.window_start` | 분 창 시작 | `Math.floor(nowMs / 60000) * 60000` |

- R-AUTH-005의 `floor(now/60000) * 60000`은 창 시작 epoch ms다. 계산은 auth 모듈(`windowStartOf`)이 하고 db는 받은 값을 쓴다.

### 4.2 핫패스 쿼리 비용 (무료 플랜: 일 읽기 500만 행 · 쓰기 10만 행)

| 요청 | D1 왕복 | 읽기 행(추정) | 쓰기 행(추정, 인덱스 갱신 포함) |
|---|---|---|---|
| `GET /api/rooms` | 1 | 방 수 R + 전체 메시지 수 M | 0 |
| `GET /api/rooms/:id/messages` | 2(병렬) | 1 + 최대 `limit + 1` | 0 |
| `GET /api/health` · `/embed` | 0 | 0 | 0 |
| 모든 쓰기 요청의 레이트리밋 | 1(+ 분당 회원당 ≤ 1 purge) | 1(+ 표 전체 — 최근 활동 회원 수) | 1 |
| `POST /api/rooms` | 1 | 0 | 2 |
| `PATCH /api/rooms/:id` | 1(batch 2) | 1 + 그 방 메시지 수 | 1 |
| `DELETE /api/rooms/:id` | 1(batch 3) | 그 방 메시지 수 + 2 | (1 + 메시지 수) × 2 + memory |
| `POST /api/rooms/:id/user` | 1(batch 2) | 2 | 4 |
| `PATCH` · `DELETE /api/messages/:id` | 1(batch 2) | 2~3 | 2~4 |
| `POST /api/rooms/:id/speak`(S3) | 4(선점 batch 2 → 조회 2 병렬 → insert batch 2 → 해제 1) | 2 + 최대 `CONTEXT_MESSAGES` + 1 + 2 | 1 + 4 + 1 = 약 6 |
| `POST /api/messages/:id/regenerate`(S3) | 5(단건 → 선점 → 조회 2 병렬 → updateText batch 2 → 해제) | 1 + 2 + 최대 `CONTEXT_MESSAGES + 1` + 1 + 2 | 1 + 2~3 + 1 = 약 5 |

- 쓰기 요청 1건 ≈ 3~5행 쓰기 → 하루 약 2만 건 쓰기 요청까지 무료 한도 안이다. 소규모 커뮤니티에는 충분하다.
- 방 목록 읽기 비용이 전체 메시지 수에 비례하는 점은 S1과 같다(§11 제안).

## 5. 에러 타입

| 에러 클래스 | shared 에러 코드 | HTTP | 한국어 메시지 | 원인 |
|---|---|---|---|---|
| `AppError` | `INTERNAL` | 500 | `저장된 데이터 형식이 올바르지 않습니다.` | 행 좁히기 실패(CHECK 우회 데이터). 정상 운영에서는 나오지 않는다 |
| (전파) D1 오류 | `INTERNAL` | 500 | `서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.` | D1 장애·제약 위반. db는 감싸지 않고 전파하며 onError가 `INTERNAL`로 닫는다([index.md](index.md) §5) |

- `AppError` 시그니처는 `new AppError(code, message?, options?)`이며 status는 코드에서 정해진다([index.md](index.md) §2.4).
- "없음"(`null`·`false`)을 업무 에러(`NOT_FOUND`)로 바꾸는 판단은 서비스 몫이다. S2 쓰기는 조건부 문장이라 정상 경로에서 외래 키 오류가 나지 않는다.

## 6. 설정(env)

- 읽는 키: 없음. `createDb`가 `DB` 바인딩을 **인자로** 받는다(부트스트랩이 `c.env.DB`를 넘김).
- 쓰는 키: 없음. 레이트리밋 한도(`rateLimitPerMin`)는 auth 서비스가 `hit`의 `limit` 인자로 넘긴다.

## 7. DB 스키마·마이그레이션

S2는 **새 마이그레이션이 없다.** S2가 쓰는 컬럼·테이블(`rooms` 쓰기, `messages.author_mb_id`·`author_name`, `rate_limits`)은 전부 `0001_init.sql`에 있다. 새 인덱스도 없다(§7.4).

### 7.1 `server/migrations/0001_init.sql` 전문 (구현됨)

```sql
-- 0001_init.sql — 런던_디스패치 초기 스키마
-- 근거: 확정사항 §5.4, R-DB-001(테이블·CHECK·epoch ms) · R-DB-004(인덱스)
-- 이 파일은 적용 후 수정하지 않는다. 변경은 0002_*.sql 추가로만(R-DB-002).
-- 시각 컬럼은 전부 epoch 밀리초 INTEGER. 값은 서비스가 넣는다(DEFAULT·CURRENT_TIMESTAMP 없음).

-- 방(에피소드)
CREATE TABLE IF NOT EXISTS rooms (
  id              TEXT    PRIMARY KEY,                                   -- crypto.randomUUID() (R-ROOM-002)
  title           TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 60), -- trim 후 1~60자 (R-ROOM-002)
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  speaking_until  INTEGER                                                -- speak 잠금 만료 시각, NULL = 잠금 없음 (R-MSG-007)
);

-- 메시지
CREATE TABLE IF NOT EXISTS messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,                      -- 삭제 후 id 재사용 금지(페이지 커서·"마지막 메시지" 판정 안정)
  room_id       TEXT    NOT NULL REFERENCES rooms (id),
  speaker       TEXT    NOT NULL CHECK (speaker IN ('sebastian', 'ciel', 'user')),
  kind          TEXT    NOT NULL CHECK (kind IN ('line', 'ooc')),
  text          TEXT    NOT NULL CHECK (length(text) >= 1),
  author_mb_id  TEXT,                                                   -- 유저 메시지 작성자 mb_id (R-MSG-002)
  author_name   TEXT,                                                   -- 표시 이름 (R-AUTH-004)
  created_at    INTEGER NOT NULL,
  CHECK (speaker = 'user' OR kind = 'line'),                            -- OOC 는 유저만 (R-MSG-002·003)
  CHECK (speaker <> 'user' OR (author_mb_id IS NOT NULL AND author_name IS NOT NULL))
);

-- 방 단위 장기기억
CREATE TABLE IF NOT EXISTS memory (
  room_id          TEXT    PRIMARY KEY REFERENCES rooms (id),
  summary          TEXT    NOT NULL DEFAULT '' CHECK (length(summary) <= 4000), -- 0~4000자 (R-MEM-001)
  source_until_id  INTEGER NOT NULL DEFAULT 0 CHECK (source_until_id >= 0),     -- 요약에 반영된 마지막 messages.id, 0 = 없음
  updated_at       INTEGER NOT NULL
);

-- 쓰기 레이트리밋 분 창 카운터
CREATE TABLE IF NOT EXISTS rate_limits (
  mb_id         TEXT    NOT NULL,
  window_start  INTEGER NOT NULL,                                       -- 분 창 시작 epoch ms = floor(now/60000)*60000
  count         INTEGER NOT NULL CHECK (count >= 1),
  PRIMARY KEY (mb_id, window_start)
);

-- 인덱스 (R-DB-004)
CREATE INDEX IF NOT EXISTS idx_messages_room_id_id ON messages (room_id, id);
CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms (updated_at);
```

### 7.2 제약 근거

| 제약 | 근거 |
|---|---|
| `rooms.title` 1~60 | R-ROOM-002·003. 서비스가 trim·코드 포인트로 검증하고 CHECK는 최후 방어(같은 단위) |
| `messages.text >= 1` | R-MSG-002·004. 상한 2000은 유저 입력 규칙이라 서비스에서 검사(D-DB-3) |
| `speaker`·`kind` 열거 | R-DB-001 🔒 |
| `speaker = 'user' OR kind = 'line'` | OOC는 유저 입력에서만 생긴다 |
| 유저 메시지의 `author_mb_id`·`author_name` NOT NULL | R-MSG-002. 캐릭터 메시지의 작성자 기록 여부는 S3에서 정한다 |
| `memory.summary <= 4000` | R-MEM-001 |
| `REFERENCES rooms(id)`(ON DELETE 없음) | 고아 차단. 연쇄 삭제는 batch로 명시(D-DB-2). D1은 외래 키를 기본 강제(SRV-T-023) |
| `AUTOINCREMENT` | 삭제된 id 재사용 금지 — 커서·"마지막 메시지" 판정 안정 |
| `rate_limits` PK `(mb_id, window_start)` | UPSERT의 충돌 대상. `count >= 1` |

### 7.3 마이그레이션 절차

| 상황 | 명령 | 실행 주체 |
|---|---|---|
| 새 마이그레이션 파일 | `npx wrangler d1 migrations create DB <설명>` → SQL 작성 | server-implementer |
| 로컬 적용(dev) | `npx wrangler d1 migrations apply DB --local`(= `npm run migrate:local -w server`) | `/dev-start`, server-implementer |
| 로컬 적용 상태 | `npx wrangler d1 migrations list DB --local` | 누구나 |
| 테스트 | `vitest.config.ts`가 `readD1Migrations`로 읽어 `TEST_MIGRATIONS` 바인딩으로 넘기고 setup이 `applyD1Migrations` | 자동 |
| 운영 DB 생성(1회) | `npx wrangler d1 create london-dispatch` → `database_id` 기입 | S5, 사용자 확인 |
| 운영 적용 | `npx wrangler d1 migrations apply DB --remote` | `/deploy` 안에서만, 사용자 확인 |

- 적용된 파일은 수정 금지(R-DB-002). 코드에 DDL·자동 마이그레이션 없음. 되돌리기는 새 번호 마이그레이션.

### 7.4 S2 인덱스 영향 확인

| S2 문장 | 쓰는 인덱스 | 판단 |
|---|---|---|
| `ROOMS_UPDATE_TITLE`·`ROOMS_DELETE`·`ROOMS_TOUCH` | `rooms` PK | 충분 |
| `SUMMARY_BY_ID`의 개수 부분 질의 · `MESSAGES_DELETE_BY_ROOM` | `idx_messages_room_id_id` | 충분 |
| `MEMORY_DELETE_BY_ROOM` | `memory` PK(`room_id`) | 충분 |
| `MESSAGES_INSERT_IF_ROOM`의 `EXISTS` | `rooms` PK | 충분 |
| `MESSAGES_UPDATE_TEXT`·`MESSAGES_DELETE`·`ROOMS_TOUCH_BY_MESSAGE` | `messages` PK | 충분 |
| `RATE_LIMITS_HIT` | `rate_limits` PK | 충분 |
| `RATE_LIMITS_PURGE_BEFORE`(`window_start`만) | 없음 — 전체 훑기 | 표 행 수 ≈ 최근 1~2분 활동 회원 수라 인덱스 불필요([auth.md](auth.md) D-AUTH-7) |

### 7.5 S3b `server/migrations/0002_llm_usage.sql` 전문

```sql
-- 0002_llm_usage.sql — 월 AI 사용량 누적 (R-LLM-007). 설계 doc/200_설계/server/db.md §2.4·§7.5
-- month 는 KST 'YYYY-MM'(llm 모듈이 계산). 시각은 epoch ms INTEGER(R-DB-001 규칙)
CREATE TABLE IF NOT EXISTS llm_usage (
  month          TEXT    PRIMARY KEY
                         CHECK (length(month) = 7 AND month GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'),
  calls          INTEGER NOT NULL CHECK (calls >= 1),
  prompt_tokens  INTEGER NOT NULL CHECK (prompt_tokens >= 0),
  output_tokens  INTEGER NOT NULL CHECK (output_tokens >= 0),
  est_krw        REAL    NOT NULL CHECK (est_krw >= 0),
  updated_at     INTEGER NOT NULL
);
-- 인덱스 없음: 조회·갱신 모두 PK(month)
```

- 파일 생성: `npx wrangler d1 migrations create DB llm_usage` → 번호 `0002`가 붙은 파일의 내용을 위 전문으로 바꾼다(§7.3).
- 멱등: `IF NOT EXISTS`. `0001_init.sql`은 수정하지 않는다(R-DB-002).
- 적용: §7.3 그대로. 로컬은 `migrate:local`, 테스트는 `readD1Migrations`가 0001·0002를 순서대로 읽는다, 운영은 `/deploy` 안 `--remote`.
- 다른 테이블과 외래 키가 없다. 월 합계는 방에 속하지 않으므로 방 삭제 batch(§3.3)와 무관하다.
- 되돌리기는 새 번호 마이그레이션으로만.

### 7.6 S3c `server/migrations/0003_character_settings.sql` 전문

```sql
-- 0003_character_settings.sql — 캐릭터 설정 1행 문서 (R-SET-003). 설계 doc/200_설계/server/db.md §2.5·§7.6
-- 본체 JSON 은 settings 모듈이 zod 로 검증·정규화해 쓰고, 읽을 때 다시 검증한다(훼손 행 → 시드 대체)
-- 시각은 epoch ms INTEGER(R-DB-001 규칙). updated_by 는 mb_id 만(R-AUTH-006)
CREATE TABLE IF NOT EXISTS character_settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  json        TEXT    NOT NULL CHECK (length(json) BETWEEN 2 AND 200000),
  version     INTEGER NOT NULL CHECK (version >= 1),
  updated_at  INTEGER NOT NULL,
  updated_by  TEXT    NOT NULL CHECK (length(updated_by) BETWEEN 1 AND 20)
);
-- 인덱스 없음: 조회·갱신 모두 PK(id = 1)
```

제약 근거:

| 제약 | 근거 |
|---|---|
| `id CHECK (id = 1)` | 1행 문서 강제. 두 번째 행이 생길 수 없다 |
| `json` 길이 2~200000 | 하한 2 = `{}`. 상한은 02 초안 100000에서 **200000으로 올렸다**. PUT 본문 상한 128KB(131072바이트 ≥ 코드 포인트 수) 안의 정상 입력도 `JSON.stringify` 뒤 100000자를 넘을 수 있다(제어 문자 `\u00XX` 이스케이프는 1자가 6자). 정상 저장이 CHECK에 걸려 500이 나는 일을 막고, 행 크기 폭주만 막는 마지막 방어선으로 둔다 |
| `version >= 1` | 0은 "저장된 적 없음(시드)" 응답 전용 값이라 행에 두지 않는다 |
| `updated_by` 1~20 | 그누보드 mb_id 길이. `OWNER_MB_IDS` 조각 검증([env.md](env.md) S3c)과 같은 범위 |
| JSON 형식 CHECK(`json_valid`) 없음 | 형식 검증은 settings가 쓰기·읽기 양쪽에서 한다. 규칙을 두 곳에 두지 않는다. 훼손 행 시험(SRV-T-248)도 직접 INSERT로 만들 수 있다 |

- 파일 생성: `npx wrangler d1 migrations create DB character_settings` → 번호 `0003`이 붙은 파일 내용을 위 전문으로 바꾼다(§7.3).
- 멱등: `IF NOT EXISTS`. `0001`·`0002`는 수정하지 않는다(R-DB-002).
- 적용: 로컬 `migrate:local`, 테스트는 `readD1Migrations`가 0001~0003을 순서대로 읽는다(설정 변경 없음).
- **운영 적용 순서: 코드 배포 전.** `/deploy`는 `npm run build` → `wrangler d1 migrations apply --remote` → `wrangler deploy` 순서라 그대로 맞다. 테이블 없이 새 코드가 돌면 speak·regenerate·설정 GET/PUT이 전부 500(테이블 없음)이다. 운영 D1은 아직 없으므로(S5에서 생성, `wrangler.toml` `database_id` 자리표시) 첫 적용 때 0001~0003이 한꺼번에 들어간다.
- 롤백: 테이블은 남긴 채 코드만 되돌리면 옛 코드가 JSON 파일로 동작한다(옛 코드는 이 테이블을 읽지 않는다). 테이블 삭제 마이그레이션은 만들지 않는다.
- 외래 키 없음. 방에 속하지 않으므로 방 삭제 batch(§3.3)와 무관하다.
- 비용: PUT 1회 = 쓰기 1행. speak·regenerate·설정 GET 1회 = 읽기 1행(PK).

## 8. 테스트 계획

`server/test/db.test.ts`. `@cloudflare/vitest-pool-workers` 0.22가 테스트 파일마다 격리한 D1(`cloudflare:test`의 `env.DB`)에 setup이 마이그레이션을 적용한다. 각 테스트는 `resetDb()` 후 고정 `nowMs`로 데이터를 넣는다.

테스트 설정(구현됨 — `server/vitest.config.ts`):

```ts
// defineProject(async () => ({
//   plugins: [cloudflareTest({                                     // 0.22: 루트 export 의 Vite 플러그인
//     wrangler: { configPath: './wrangler.toml' },
//     miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations('migrations'), TOKEN_SECRET: 'test-secret' } },
//   })],
//   resolve: { alias: { '@shared': '../shared/src' } },
//   test: { name: 'server', include: ['test/**/*.test.ts'], setupFiles: ['./test/apply-migrations.ts'] },
// }))
// test/apply-migrations.ts: await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
// test/env.d.ts: Cloudflare.Env 에 DB·ASSETS·TOKEN_SECRET·TEST_MIGRATIONS 선언(테스트 전용)
```

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| SRV-T-020 | `migration_creates_four_tables_with_columns` | `PRAGMA table_info`가 §7.1과 일치 | R-DB-001 |
| SRV-T-021 | `migration_check_constraints_reject_invalid_rows` | 표 기반 직접 INSERT 실패 | R-DB-001 |
| SRV-T-022 | `migration_creates_required_indexes` | 두 인덱스·컬럼 순서 | R-DB-004 |
| SRV-T-023 | `foreign_key_rejects_message_for_unknown_room` | 없는 방 INSERT 실패, 메시지 있는 방 단독 DELETE 실패 | R-DB-001·003 |
| SRV-T-024 | `listSummaries_returns_empty_array_when_no_rooms` | `[]` | R-ROOM-001 |
| SRV-T-025 | `listSummaries_orders_by_updatedAt_desc_with_counts` | 정렬·개수·동률 | R-ROOM-001 |
| SRV-T-026 | `exists_returns_true_only_for_existing_room` | true/false | R-MSG-001 |
| SRV-T-027 | `touchStmt_updates_updated_at_and_reports_zero_changes_for_unknown` | 반영, 없는 id 0행 | R-ROOM-005 |
| SRV-T-028 | `pageDesc_returns_desc_rows_before_cursor_within_room` | 대상 방만·내림차순·엄격히 작음 | R-MSG-001 |
| SRV-T-029 | `pageDesc_maps_row_to_camelCase_without_author_mb_id` | 키 7개, 캐릭터 `authorName null` | R-DB-005 |
| SRV-T-030 | `batch_rolls_back_all_when_one_statement_fails` | 전체 롤백 | R-DB-003 |
| SRV-T-031 | `narrowing_throws_INTERNAL_on_unexpected_speaker` | `AppError INTERNAL` | R-DB-005 |
| SRV-T-121 | `rooms_insert_sets_created_and_updated_at_equal` | 행 `created_at = updated_at = nowMs`, `speaking_until NULL`. 같은 id 재삽입 → throw(PK) | R-ROOM-002 |
| SRV-T-122 | `rooms_updateTitle_returns_summary_or_null_and_keeps_updated_at` | 메시지 2개 방 → `RoomSummary`(새 제목, `messageCount 2`, `updatedAt` 불변). 없는 id → `null`, 다른 방 불변 | R-ROOM-003 |
| SRV-T-123 | `rooms_deleteCascade_removes_children_then_room` | 메시지·memory 있는 방 → `true`, 세 테이블에 그 방 행 0, 다른 방 유지, 고아 질의 0. 없는 id → `false` | R-ROOM-004 · R-DB-003 |
| SRV-T-124 | `messages_insert_returns_row_and_touches_room_or_null` | 유저 메시지 → `Message`(키 7개), DB `author_mb_id` 저장, 방 `updated_at = nowMs`. 없는 방 → `null`, `messages` 0행. 유저인데 author null → throw(CHECK) 후 방 `updated_at` 불변(롤백) | R-MSG-002 · R-ROOM-005 · R-DB-003 |
| SRV-T-125 | `messages_updateText_returns_row_and_touches_owning_room` | `text`만 바뀐 `Message`, 그 방만 `updated_at = nowMs`. 없는 id → `null`, 어떤 방도 불변 | R-MSG-004 · R-ROOM-005 |
| SRV-T-126 | `rateLimits_hit_counts_up_to_limit_then_returns_null` | limit 3: 1·2·3 → 4번째 `null`, 행 `count = 3`. 다른 창·다른 mbId는 1부터 | R-AUTH-005 |
| SRV-T-127 | `rateLimits_purgeBefore_deletes_only_older_windows` | 창 W−120000·W−60000·W 행 → `purgeBefore(W)` = 2, W 행만 남음 | R-AUTH-005 |
| SRV-T-128 | `messages_deleteById_touches_room_before_delete` | `true`, 행 없음, 그 방 `updated_at = nowMs`. 없는 id → `false`, 방 불변 | R-MSG-005 · R-ROOM-005 |
| SRV-T-187 | `rooms_acquireSpeakLock_acquires_only_when_free_or_expired` | `speaking_until` NULL → `'acquired'`, 행 값 = `untilMs`. `until > now` → `'busy'`, 값 불변. `until == now`·`until < now` → `'acquired'`(만료 경계). 모든 경우 `updated_at` 불변 | R-MSG-007 |
| SRV-T-188 | `rooms_acquireSpeakLock_returns_missing_for_unknown_room` | 없는 id → `'missing'`, 다른 방 `speaking_until` 불변 | R-MSG-007 |
| SRV-T-189 | `rooms_releaseSpeakLock_clears_only_own_lock` | 내 `untilMs` → `true`, NULL. 다른 `untilMs`(만료 후 남이 재선점) → `false`, 값 불변. 없는 방 → `false` | R-MSG-007 |
| SRV-T-190 | `messages_getById_and_memory_getSummary` | `getById`: 키 7개(`authorMbId` 없음)·없는 id `null`. `getSummary`: 행 있음 → 문자열(`''` 포함), 행 없음 → `null` | R-MSG-006 · R-LLM-003 · R-DB-005 |
| SRV-T-223 | `migration_0002_creates_llm_usage_with_checks` | `PRAGMA table_info(llm_usage)` 6열(이름·타입·NOT NULL·PK가 §7.5와 같음). `month 'bad'`·`'2026-1'`·`est_krw -1`·`calls 0` INSERT → 각각 throw(CHECK) | R-DB-002 · R-LLM-007 |
| SRV-T-224 | `llmUsage_add_accumulates_and_get_reads` | `add('2026-10', { 100, 20, 0.112 }, 1)` → `{ calls 1, promptTokens 100, outputTokens 20, estKrw 0.112 }`. 두 번째 `add(…, 2)` → `calls 2`·토큰 합·`estKrw` ≈ 0.224(`toBeCloseTo`)·행 `updated_at 2`. `'2026-11'`은 독립. `get` 없는 월 → `null`, 있는 월 → 마지막 `add` 반환과 같음 | R-LLM-007 · R-DB-003 |

수동·리뷰 체크:

- [ ] `npx wrangler d1 migrations apply DB --local` 후 `PRAGMA table_info(messages)` 확인(R-DB-001).
- [ ] `EXPLAIN QUERY PLAN`으로 페이지 쿼리·`MESSAGES_DELETE_BY_ROOM`이 `idx_messages_room_id_id`를 쓰는지(R-NFR-002, §7.4).
- [ ] 리뷰 grep: `server/src/db`의 SQL에 `${` 또는 `+` 연결 0건(R-DB-003).
- [ ] 리뷰: `server/src/db`가 `../rooms`·`../messages`·`../memory`·`../llm`·`../auth`를 import하지 않음(R-DB-005).

### 8.1 S3c 테스트 (`server/test/db.test.ts`에 추가)

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-239 | `characterSettings_get_upsert_and_checks` | 빈 DB `get` / `upsert('{"a":1}', 'owner_test', T1)` / `upsert('{"a":2}', 'owner_test', T2)` / `get` / 직접 `INSERT … id = 2` / `updatedBy` 21자 upsert / `json` 200001자 upsert / `json = '{{'` 직접 INSERT 후 `get` | `null` / `{ version: 1, updatedAt: T1 }` / `{ version: 2, updatedAt: T2 }` / `{ json: '{"a":2}', version: 2, updatedAt: T2 }` / CHECK 실패 / D1 오류 전파 / D1 오류 전파 / 문자열 그대로 반환(db는 해석 안 함) | R-SET-003 · R-DB-002 |

- 0003 적용 확인은 위 테스트가 겸한다(setup이 0001~0003을 적용한 뒤 테이블이 있어야 첫 `get`이 `null`).

## 9. contract 요구 명세

db는 contract에 직접 노출되지 않는다. contract가 알아야 할 데이터 규칙만 적는다.

| 항목 | 내용 | 이유 |
|---|---|---|
| 시각 필드 | epoch ms 정수 | R-API-004 · R-DB-001 |
| id 타입 | 방 id 문자열(UUID v4), 메시지 id 정수 | R-API-004 |
| `speaker` / `kind` | `'sebastian' \| 'ciel' \| 'user'` / `'line' \| 'ooc'`, 캐릭터 메시지는 항상 `'line'` | CHECK |
| `authorName` | 유저 메시지는 문자열(작성 당시 표시 이름 — 이후 닉네임이 바뀌어도 그대로), 캐릭터 메시지는 `null` | §3.4 · R-AUTH-004 |
| `authorMbId` | **응답에 포함하지 않는다**(쓰기 응답 포함) | 공개 읽기 응답에 그누보드 로그인 ID 노출 방지 |
| 수정 | `createdAt`은 수정해도 바뀌지 않는다. 수정 시각 필드는 없다 | 요구 없음 |

## 10. 요구 추적표

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-DB-001 🔒 | §7.1·§7.2·§4.1 | SRV-T-020·021·023 | ✅ |
| R-DB-002 | §7.3 | 리뷰 | ✅ |
| R-DB-003 | §3.2·§3.3 batch, §8 grep | SRV-T-023·030·123·124 | ✅ |
| R-DB-004 | §7.1·§7.4 | SRV-T-022 | ✅ |
| R-DB-005 | §1·§2·§3 | SRV-T-029·031, 리뷰 import | ✅ |
| R-ROOM-002 | §2.1 `rooms.insert`, §3.2 | SRV-T-121 | ✅ |
| R-ROOM-003 | `rooms.updateTitle` | SRV-T-122 | ✅ |
| R-ROOM-004 | `rooms.deleteCascade` | SRV-T-123 | ✅ |
| R-ROOM-005 | `touchStmt`, S2 쓰기 batch | SRV-T-027·124·125·128 | ✅ |
| R-MSG-002·004·005 | `messages.insert`·`updateText`·`deleteById` | SRV-T-124·125·128 | ✅ |
| R-AUTH-005 | `rateLimits.hit`·`purgeBefore` | SRV-T-126·127 | ✅ |
| R-NFR-002 | §3.1 인덱스 범위 스캔 | 수동 EXPLAIN | 부분(응답 시간은 [messages.md](messages.md)) |
| R-NFR-005 | §4.2 | 리뷰 | ✅ |
| R-MSG-007 🔒 · R-NFR-003 (S3) | §2.3·§3.5 `acquireSpeakLock`·`releaseSpeakLock` | SRV-T-187~189 | ✅(설계) |
| R-MSG-006 🔒 (S3) | §2.3 `getById`, `pageDesc` 재사용 | SRV-T-190 | ✅(설계) |
| R-LLM-003 🔒 (S3) | §2.3 `memory.getSummary`, `pageDesc` 재사용 | SRV-T-190 | ✅(설계) |
| R-LLM-007 🔒 (S3b) | §2.4·§3.6·§7.5 | SRV-T-223·224 | ✅(설계) |
| R-DB-002 (S3b) | §7.5 `0002_llm_usage.sql` | SRV-T-223, 리뷰 | ✅(설계) |

### 10.1 S3c 추적

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-SET-003 🔒 | §2.5·§3.7·§7.6 | SRV-T-239, [settings.md](settings.md) SRV-T-245~248 | ✅(설계) |
| R-DB-002 (S3c) | §7.6(새 번호 0003, 기존 파일 불변) | SRV-T-239 | ✅(설계) |
| R-AUTH-006 🔒 (S3c) | §2.5(`updated_by` = mbId만, 조회 안 함) | — | ✅(설계) |

## 11. 설계 결정 노트

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-DB-1 | 4테이블을 `0001_init.sql` 하나에 | 묶음마다 마이그레이션 | 스키마 🔒 확정. S2는 새 마이그레이션 없이 진행 |
| D-DB-2 | 외래 키 `REFERENCES`만, `ON DELETE CASCADE` 없음 | CASCADE | R-DB-003이 batch 명시 삭제를 요구. CASCADE는 순서 실수를 숨긴다 |
| D-DB-3 | `messages.text` 상한 CHECK 없음 | `<= 2000` | 2000은 유저 입력 규칙. LLM 결과 상한은 S3 |
| D-DB-4 | `rate_limits.window_start` = 창 시작 epoch ms | 창 번호 | R-DB-001 시각 단위와 일치 |
| D-DB-5 | 메시지 조회·RETURNING에서 `author_mb_id` 제외 | 포함 | 로그인 ID 노출 방지. 저장은 한다 |
| D-DB-6 | 읽기 2개는 `Promise.all` | `batch` | 읽기는 원자성 불필요 |
| D-DB-7 | (S1) `touchStmt`는 문장을 돌려준다 | 즉시 실행 | S1 공개 API로 유지. S2부터는 D-DB-8 방식이 주 경로 |
| D-DB-8 | 메시지 쓰기 함수가 자기 batch 안에 `rooms.updated_at` 갱신을 포함 | 서비스가 `insertStmt`+`touchStmt`로 batch 조립(S1 문서 계획) | 쓰기는 `RETURNING` 행이 필요한데 서비스가 `D1Result`를 해석하면 행 변환이 db 밖으로 샌다(§1 원칙 위반). 함수 안에 두면 서비스가 갱신을 빠뜨릴 수 없다. "메시지가 바뀌면 방 활동 시각도 바뀐다"는 파생 컬럼 유지라 업무 판단이 아니다 |
| D-DB-9 | 메시지 INSERT를 `INSERT … SELECT … WHERE EXISTS(방)`로 | `exists` 확인 후 INSERT | 왕복 1회. 방 삭제와 경합해도 외래 키 오류(500) 대신 `null` → `NOT_FOUND` |
| D-DB-10 | "없음"·"한도 도달"을 `RETURNING` 행 유무로 판정 | `meta.changes` | UPSERT의 `DO UPDATE … WHERE` 거짓·`INSERT…SELECT` 0행을 같은 방식으로 다룬다. 새 count를 바로 얻어 purge 시점(`count === 1`)도 판정한다 |
| D-DB-11 | `deleteById`는 touch를 DELETE보다 먼저 | DELETE 후 touch | 삭제 뒤에는 `room_id`를 메시지에서 찾을 수 없다. 같은 batch라 원자성은 같다 |
| D-DB-12 | `updateTitle`이 요약까지 돌려준다 | `boolean`만 | 서비스가 응답용 재조회를 따로 하지 않게(왕복 1회) |
| D-DB-13 (S3) | 잠금 선점과 방 존재 확인을 한 batch로, 결과 세 값 | `boolean` 반환 후 실패 시 `exists` 재조회 | `SPEAK_IN_PROGRESS`·`NOT_FOUND` 구분을 왕복 1회·원자적으로 |
| D-DB-14 (S3) | 만료 판정 `speaking_until <= nowMs`(만료 시각 자체에 만료) | `<`(S2 문서 예정안) | 잠금 유효 구간을 `[선점, untilMs)`로 정의. 경계 테스트(SRV-T-187)가 명확하다 |
| D-DB-15 (S3) | 해제는 `speaking_until = untilMs`일 때만 | 무조건 NULL | 만료 뒤 다른 요청이 다시 건 잠금을 지우지 않는다. 같은 방의 다음 선점은 이전 잠금 만료 뒤에만 가능하므로 `untilMs`가 겹치지 않는다(다음 값 = 더 늦은 now + 90000) |
| D-DB-16 (S3) | 최근 N개·마지막 판정에 `pageDesc` 재사용 | `recent`·`last` 신규 함수 | 같은 SQL·인덱스. 공개 API를 늘리지 않는다 |
| D-DB-17 (S3) | 새 마이그레이션 없음 | `0002_*.sql` | 필요한 컬럼·테이블이 `0001`에 모두 있다. 인덱스도 PK·기존 인덱스로 충분 |
| D-DB-18 (S3b) | 월 1행 집계 테이블 `llm_usage(month PK)` | 호출마다 로그 행 INSERT 후 SUM | 게이트가 PK 조회 1행, 누적이 쓰기 1행이다. 행이 연 12개라 정리가 필요 없다. 호출별 이력은 요구에 없다 |
| D-DB-19 (S3b) | `est_krw REAL`(소수 보존) | 정수 원 / 마이크로원 INTEGER | [llm.md](llm.md) D-LLM-17 |
| D-DB-20 (S3b) | 누적은 조건 없는 UPSERT | `rate_limits`처럼 `WHERE est_krw < 한도` 조건부 | 응답을 받은 시점에 비용은 이미 났다. 누적을 거절하면 과소 추정이 된다. 판정은 다음 요청의 게이트가 한다 |
| D-DB-21 (S3b) | `LlmUsageRepo` 타입을 db에 두고 llm `UsageStore` 포트와 모양을 맞춤 | `shared`에 공용 타입 | 계약 타입이 아니라 shared 대상이 아니다. 컨테이너에서 대입할 때 타입 검사가 두 모양의 일치를 보장한다 |
| D-DB-22 (S3b) | 마이그레이션 `0002_llm_usage.sql` 새 파일 | `0001` 수정 | R-DB-002. 적용된 파일은 수정 금지 |

확인 필요:

- D1 외래 키 기본 강제·`RETURNING`·`INSERT…SELECT…RETURNING` 동작은 SRV-T-023·124·126으로 로컬(miniflare)에서 확인한다. 운영(remote)은 S5 배포 후 스모크에서 확인한다.

제안(설계 미반영, 사용자 판단):

- **방 목록 읽기 비용**: `rooms.message_count` 컬럼을 추가하고 메시지 추가·삭제 batch에서 증감하면 `GET /api/rooms`의 읽기 행이 방 수로 줄어든다(§4.2). 스키마 🔒라 사용자 승인 후 `0002_*.sql`로만 가능하다. 메시지 수만 건 전에는 필요 없다.

### 11.1 S3c 결정

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-DB-23 | 1행 문서(`id = 1` CHECK) + JSON TEXT | 캐릭터별 3행 · 필드별 컬럼 | 02 §3 권고. 내보내기·가져오기·PUT이 모두 전체 교체라 원자적이고, 필드가 늘어도 마이그레이션이 없다 |
| D-DB-24 | `json` 길이 상한 200000 | 02 초안 100000 | §7.6 제약 근거. 정상 PUT이 CHECK에 걸리지 않게 128KB 본문보다 넉넉히 |
| D-DB-25 | `get`이 `updated_by`를 읽지 않는다 | 응답·로그에 포함 | 요구에 쓰임이 없다. 회원 ID 노출을 최소로(R-AUTH-006) |

## 12. S3d — 유저 표시명 투영 (R-AUTH-004 🔒 개정 · R-CHAT-002 🔒 개정)

- 상태: 초안(2026-10-06, 승인 ① 반영). 근거 `doc/200_설계/architecture/s3d-02-전반설계.md` §1(대안 B), 인계패킷 §1.
- **이 절이 §3.4(행 ↔ 도메인 변환)보다 우선한다.**

비유: 출석부(D1)에는 실명을 그대로 적고, 무대 자막(응답)에는 누가 적었든 「어떠한 의지」를 띄운다. 자막 담당은 한 명(`toMessage`)뿐이라 규칙이 한 곳에 있다.

### 12.1 공개 API (시그니처 불변 — 값 규칙만 변경)

```ts
// server/src/db/messages.ts
import { USER_DISPLAY_NAME } from '@shared/characters'   // contract-implementer 가 추가(값 '어떠한 의지')

/** 행(snake_case)을 도메인 객체로 변환.
 *  S3d: authorName 은 저장값(author_name)을 쓰지 않는다 — 유저 메시지면 USER_DISPLAY_NAME, 캐릭터 메시지면 null */
export const toMessage = (row: MessageRow): Message => {
  const speaker = toSpeaker(row.speaker)
  return {
    id: row.id,
    roomId: row.room_id,
    speaker,
    kind: toKind(row.kind),
    text: row.text,
    authorName: speaker === 'user' ? USER_DISPLAY_NAME : null,
    createdAt: row.created_at,
  }
}
```

| 이름 | 인자 | 반환 | 실패 조건 | 요구ID |
|---|---|---|---|---|
| `toMessage` | `MessageRow` | `Message` — `authorName` = `speaker === 'user' ? USER_DISPLAY_NAME : null` | 기존과 같음(`speaker`·`kind` 좁히기 실패 → `INTERNAL`) | R-AUTH-004 · R-CHAT-002 |
| `MessagesRepo.insert` | 기존 | 기존 | 기존 | R-AUTH-004(저장: `NewMessage.authorName` → `author_name` 그대로) |

- **읽기 경로 4개가 모두 `toMessage`를 지난다**: `pageDesc`(`.map(toMessage)`), `insert`·`updateText`의 `RETURNING`(`firstMessage`), `getById`. 따라서 GET 목록·`/user` 201·수정 200·speak 201 응답이 모두 투영된다. 이미 쌓인 실명 행도 다음 조회부터 바뀐다(Q6, 마이그레이션 없음).
- **저장은 바뀌지 않는다.** `insert`는 `NewMessage.authorName`(= `Principal.displayName`)을 `author_name`에 그대로 쓴다. 실명은 운영자의 D1 직접 조회로만 본다.
- SQL 상수 불변. `SELECT`는 `author_name`을 계속 읽는다(`MessageRow` 타입·S1 열 단언 유지). 응답에 쓰지 않는 열이라 다음 정리 때 빼도 된다(D-DB-S3d-2).
- 캐릭터 행은 원래 `author_name` NULL이다. 손으로 넣은 비정상 행(캐릭터인데 이름 있음)도 응답은 null이다.
- 의존: db → shared(`@shared/characters`). shared는 최하위 계층이라 방향 위반이 아니다(db/types.ts가 이미 `@shared/types`를 쓴다).
- 프롬프트는 이제 `authorName`을 받지 않는다([llm.md](llm.md) §13.3). 실명이 D1 밖으로 나가는 경로가 없다.

### 12.2 내부 구조 · 동시성 · 에러 · env · 마이그레이션

- 파일: `server/src/db/messages.ts`의 `toMessage` 1곳. 상태·상수 추가 없음(상수는 shared).
- 동시성·에러: 변경 없음. 순수 변환이다.
- env: 없음. 마이그레이션: **없음**(스키마 불변, 저장값 불변).

### 12.3 테스트

| 테스트ID | 파일 | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|---|
| SRV-T-269 | `server/test/db.test.ts` | `toMessage_projects_user_authorName_to_fixed_name_on_all_read_paths` | 유저 행(`author_name '닉'`) · 유저 행(`author_name NULL`) · 캐릭터 행을 직접 INSERT → `pageDesc`·`getById`·`insert`(유저, `authorName '닉'`)·`updateText`(유저 행) | 유저 4경로 모두 `authorName === USER_DISPLAY_NAME`, 캐릭터 `null`. 같은 행의 `SELECT author_name`은 `'닉'`(NULL 행은 NULL) 그대로 | R-AUTH-004 · R-CHAT-002 |

**기존 테스트 영향.**

| 파일 | TC | 영향 |
|---|---|---|
| `server/test/db.test.ts` | SRV-T-029 · SRV-T-124 · S1 열 단언 | 무수정(`insertLine`은 sebastian 행 → null 유지, 124는 `authorName`을 단언하지 않음) |
| `server/test/messages.test.ts` | SRV-T-140 · 142 | 개정 필요 — [messages.md](messages.md) §12.7 |
| `server/test/routes-write.test.ts` | API-T-061 | 개정 필요 — [messages.md](messages.md) §12.7 |
| `server/test/routes.test.ts` | API-T-023 | 무수정(`messages[0]`은 캐릭터 행). 유저 행 `authorName` 단언 추가는 contract 판단 |
| `server/test/messages-page.test.ts` | — | 무수정(DB 없는 순수 페이지 테스트) |

### 12.4 contract 요구 명세

- 응답 `Message.authorName` 값 규칙: 유저 메시지 = `USER_DISPLAY_NAME`(항상 문자열), 캐릭터 메시지 = `null`. 타입(`string | null`)은 그대로다. api.md §4.3·4.9·4.10 예시를 `"authorName": "어떠한 의지"`로 맞춰 달라.

### 12.5 요구 추적

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-AUTH-004 🔒 개정 | §12.1 | SRV-T-269 · SRV-T-142 개정 · API-T-061 개정 | ✅(설계) |
| R-CHAT-002 🔒 개정 (서버 몫) | §12.1 | SRV-T-269 | ✅(설계) |

### 12.6 설계 결정

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-DB-S3d-1 | 투영 위치 = `toMessage` 한 곳 | 라우트 직렬화 · 화면 상수 · 저장부터 상수 | 02 §1 대안 B. 모든 읽기 경로가 이미 이 함수를 지난다. 저장값(감사 정보)을 지키고 공개 GET에 실명이 남지 않는다 |
| D-DB-S3d-2 | `SELECT`에서 `author_name`을 빼지 않는다 | 열 제거 | SQL 상수·S1 열 단언 무수정. 변경 범위 최소 |

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-06 | S3d 설계(§12): `toMessage` 투영 — 유저 메시지 `authorName` = shared `USER_DISPLAY_NAME`, 캐릭터 null, 저장 `author_name`은 실명 유지. SQL·스키마·마이그레이션 불변. SRV-T-269, 기존 테스트 영향표, D-DB-S3d-1·2 |
| 2026-10-05 | S1 초안 작성 |
| 2026-10-05 | S1 구현 동기화(상태 확정): 도메인 타입은 `@shared/types` 재노출, `toMessage`는 파일 export(index 미노출), `AppError(code, message?)` 시그니처, vitest 0.22 `cloudflareTest` 설정, `test/helpers.ts`. S2 설계: §2.1 S2 함수 8종·`NewMessage`·`RateLimitsRepo`, §3.2 SQL, §3.3 batch 구성, §7.4 인덱스 영향 없음, D-DB-8~12. 기존 §2.2의 S2 예정 시그니처(`rename`·`insertStmt`·`findById`·`updateTextStmt`·`deleteStmt`)는 위 함수로 대체 |
| 2026-10-06 | S3 설계: §2.3(`acquireSpeakLock`·`releaseSpeakLock`·`getById`·`MemoryRepo.getSummary`·`Db.memory`), §3.5 SQL·batch 해석, §4.2 speak·regenerate 비용, SRV-T-187~190, D-DB-13~17. 마이그레이션 없음 |
| 2026-10-06 | S3b 설계: §2.4 `LlmUsageRepo`(`add`·`get`)·`Db.llmUsage`·`LlmUsageRow`, §3 파일 표(`llm-usage.ts`·`0002`·helpers), §3.6 UPSERT·조회 SQL, §7.5 `0002_llm_usage.sql` 전문, SRV-T-223·224, §10 R-LLM-007·R-DB-002, D-DB-18~22 |
| 2026-10-06 | S3c 설계: §2.5 `characterSettings.{get, upsert}`·행 타입, §3.7 SQL 상수(조건 없는 UPSERT·RETURNING), §7.6 `0003_character_settings.sql` 전문·제약 근거(json 상한 200000으로 조정)·적용 순서(코드 배포 전), §8.1 SRV-T-239, §10.1·§11.1 |
| 2026-10-06 | 테스트 입력 정정(server-implementer 보고): SRV-T-239의 훼손 행 직접 INSERT 입력 `'{'`(1자)는 CHECK 하한 2에 걸린다. `'{{'`(2자, JSON 파싱 실패)로 바꿨다. §7.6 전문은 그대로 |
| 2026-10-06 | 구현 완료 동기화(server 318/318 · `0003` 로컬 적용). 설계와 다른 점: 테스트 도우미 `server/test/helpers.ts`의 `resetDb`에 `character_settings` 삭제를 더했다(테스트 간 행 격리) |

파급(공개 API 변경): `Db`에 `rateLimits` 추가 → `Db`를 직접 구현하는 테스트 가짜 객체(`server/test/app.test.ts` 188행 근처 `trap`, `rooms.test.ts`·`messages.test.ts`의 가짜 `Db`)가 타입 오류가 나면 `rateLimits`를 추가한다. 기존 S1 함수 시그니처는 바뀌지 않는다.

파급(S3 공개 API 변경): `Db`에 `memory` 추가 → `Db`를 직접 구현하는 테스트 가짜 객체(`server/test/app.test.ts`의 `trap`, `rooms.test.ts`·`messages.test.ts`의 가짜 `Db`)에 `memory`를 추가한다. `RoomsRepo`·`MessagesRepo`는 함수 추가만이라 기존 호출자 영향 없다. 서비스 호출자는 [messages.md](messages.md) §2.3뿐.

파급(S3b 공개 API 변경): `Db`에 `llmUsage` 추가 → `Db`를 직접 구현하는 테스트 가짜 객체(`server/test/app.test.ts`의 `trap`, `rooms.test.ts`·`messages.test.ts`·`auth.test.ts`의 가짜 `Db`)에 `llmUsage`를 추가한다. `server/test/helpers.ts` `resetDb`에 `DELETE FROM llm_usage`를 더하고 `insertUsage` 헬퍼를 추가한다. 기존 저장소 함수 시그니처는 바뀌지 않는다. 호출자는 [index.md](index.md) §2.3 S3b 배선(컨테이너)뿐이다.
