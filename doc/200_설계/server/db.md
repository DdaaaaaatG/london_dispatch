# db 모듈 설계

- 상태: 초안 · 최종 갱신: 2026-10-05
- 묶음: S1. 스키마(4테이블 전부)와 마이그레이션 `0001_init.sql`은 S1에서 한 번에 만든다. 접근 함수는 S1이 쓰는 것만 구현하고, S2~S4용은 §2.2에 예정 시그니처로만 둔다.
- 관련 문서: [env.md](env.md)(`DB` 바인딩), [index.md](index.md)(`createDb` 호출 지점), [rooms.md](rooms.md), [messages.md](messages.md).

## 1. 목적

db 모듈은 창고지기다. 무엇을 넣고 뺄지는 사무실(서비스)이 정하고, 창고지기는 정해진 선반(테이블)에 정해진 방식(파라미터 바인딩)으로만 넣고 꺼낸다.

Cloudflare D1 바인딩(`DB`)을 감싸 테이블별 접근 함수를 제공한다. 행(`snake_case`)↔도메인 객체(`camelCase`) 변환은 이 모듈 경계에서 한 번만 한다. 비즈니스 규칙(무엇이 유효한지, 언제 갱신할지)은 갖지 않는다.

| 요구ID | 내용 |
|---|---|
| R-DB-001 🔒 | 4테이블 스키마, CHECK 제약, 시각 epoch ms INTEGER |
| R-DB-002 | 스키마 변경은 `server/migrations/NNNN_*.sql` 추가로만. 로컬 `--local`, 운영 `/deploy` 안 `--remote` |
| R-DB-003 | 모든 SQL `prepare().bind()`. 여러 문장은 `batch`. 방 삭제는 messages·memory와 한 batch |
| R-DB-004 | 인덱스 `messages(room_id, id)`, `rooms(updated_at)` |
| R-DB-005 | 테이블별 접근 함수만, 비즈니스 규칙 없음, 서비스 import 금지 |
| R-ROOM-005 | `updated_at` 갱신 문장 제공(`touchStmt`) — 갱신 시점 규칙은 [rooms.md](rooms.md) §4 |
| R-NFR-002 | 히스토리 첫 페이지 1초 이내 — 인덱스 범위 스캔 1회 |
| R-NFR-005 | 핫패스 쿼리 수·읽기 행 수 명시(§4.2) |

## 2. 공개 API

### 2.1 S1 구현 대상

```ts
// server/src/db/index.ts
import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types'

export type Speaker = 'sebastian' | 'ciel' | 'user'
export type MessageKind = 'line' | 'ooc'

/** 방 목록 한 줄. contract 응답 타입과 1:1 */
export type RoomSummary = {
  id: string
  title: string
  createdAt: number      // epoch ms
  updatedAt: number      // epoch ms
  messageCount: number
}

/** 메시지 한 건. author_mb_id 는 싣지 않는다(공개 응답에 그누보드 로그인 ID 노출 방지 — §11 D-DB-5) */
export type Message = {
  id: number
  roomId: string
  speaker: Speaker
  kind: MessageKind
  text: string
  authorName: string | null   // 캐릭터 메시지는 null
  createdAt: number           // epoch ms
}

export type RoomsRepo = {
  /** 전 방 + 메시지 수, updated_at 내림차순(동률은 id 오름차순) */
  listSummaries: () => Promise<RoomSummary[]>
  /** 방 존재 여부 */
  exists: (id: string) => Promise<boolean>
  /** updated_at 갱신 문장(실행하지 않음). 메시지 쓰기와 같은 batch 에 넣기 위해 문장으로 돌려준다 */
  touchStmt: (id: string, nowMs: number) => D1PreparedStatement
}

export type MessagesRepo = {
  /** room 의 메시지를 id 내림차순으로 take 건. beforeId 가 있으면 id < beforeId 만 */
  pageDesc: (roomId: string, take: number, beforeId?: number) => Promise<Message[]>
}

export type Db = {
  readonly rooms: RoomsRepo
  readonly messages: MessagesRepo
  /** 여러 문장을 원자적으로 실행(D1 batch = 하나의 트랜잭션, 하나라도 실패하면 전부 롤백) */
  readonly batch: (stmts: readonly D1PreparedStatement[]) => Promise<D1Result[]>
}

/** D1 바인딩을 감싼 접근 객체. index.ts 부트스트랩이 요청마다 만든다 */
export const createDb = (binding: D1Database): Db
```

| 이름 | 인자 | 반환 | 실패 조건 | 요구ID |
|---|---|---|---|---|
| `createDb` | `binding: D1Database` | `Db` | 없음(바인딩 존재는 `parseEnv`가 보장) | R-DB-005 |
| `rooms.listSummaries` | — | `Promise<RoomSummary[]>` | D1 오류 → 그대로 전파(onError가 `INTERNAL`) | R-ROOM-001 |
| `rooms.exists` | `id: string` | `Promise<boolean>` | 같음 | R-MSG-001(404 판정) |
| `rooms.touchStmt` | `id: string, nowMs: number` | `D1PreparedStatement` | 실행 시 0행 변경이면 방 없음(호출자가 `meta.changes`로 판단) | R-ROOM-005 |
| `messages.pageDesc` | `roomId: string, take: number, beforeId?: number` | `Promise<Message[]>`(id 내림차순) | 같음 | R-MSG-001 |
| `batch` | `stmts` | `Promise<D1Result[]>` | 한 문장이라도 실패 → 전체 롤백 후 throw | R-DB-003 |

- `pageDesc`는 `take`·`beforeId`의 범위를 검사하지 않는다. 검증은 서비스 몫이다(R-DB-005).
- 행에서 읽은 `speaker`·`kind`는 좁히기 함수(`toSpeaker`·`toKind`)로 검사한다. CHECK 제약 때문에 정상적으로는 실패하지 않으며, 실패하면 `AppError('INTERNAL', 500, …)`.

### 2.2 후속 묶음 예정 (S1 미구현 — 스키마가 이 쿼리들을 감당하는지 확인용)

| 묶음 | 저장소 | 예정 시그니처 | SQL 요지 | 요구ID |
|---|---|---|---|---|
| S2 | rooms | `insert(room: { id: string; title: string; nowMs: number }): Promise<RoomSummary>` | `INSERT INTO rooms (id,title,created_at,updated_at) VALUES (?,?,?,?)` | R-ROOM-002 |
| S2 | rooms | `rename(id: string, title: string): Promise<boolean>` | `UPDATE rooms SET title=? WHERE id=?` → `changes>0`(`updated_at` 갱신 여부는 S2 결정 — [rooms.md](rooms.md) §2.2) | R-ROOM-003 |
| S2 | rooms | `deleteCascade(id: string): Promise<boolean>` | batch: `DELETE FROM memory WHERE room_id=?` → `DELETE FROM messages WHERE room_id=?` → `DELETE FROM rooms WHERE id=?`(자식 먼저 — 외래 키) | R-ROOM-004 · R-DB-003 |
| S2 | messages | `insertStmt(m: NewMessage, nowMs: number): D1PreparedStatement` | `INSERT … RETURNING id, …` — `touchStmt`와 한 batch | R-MSG-002 · R-ROOM-005 |
| S2 | messages | `findById(id: number): Promise<Message \| undefined>` | `SELECT … WHERE id=?` | R-MSG-004·005 |
| S2 | messages | `updateTextStmt(id: number, text: string): D1PreparedStatement` / `deleteStmt(id: number)` | `UPDATE messages SET text=? WHERE id=?` / `DELETE …` — `touchStmt`와 한 batch | R-MSG-004·005 |
| S2 | rateLimits | `hit(mbId: string, windowStartMs: number, limit: number): Promise<boolean>` | `INSERT INTO rate_limits VALUES (?,?,1) ON CONFLICT(mb_id,window_start) DO UPDATE SET count=count+1 WHERE count < ?` → `changes===0`이면 초과 | R-AUTH-005 |
| S2 | rateLimits | `purgeBefore(windowStartMs: number): Promise<number>` | `DELETE FROM rate_limits WHERE window_start < ?` | R-AUTH-005 |
| S3 | rooms | `acquireSpeakLock(id: string, untilMs: number, nowMs: number): Promise<boolean>` | `UPDATE rooms SET speaking_until=? WHERE id=? AND (speaking_until IS NULL OR speaking_until < ?)` | R-MSG-007 |
| S3 | rooms | `releaseSpeakLock(id: string, untilMs: number): Promise<void>` | `UPDATE rooms SET speaking_until=NULL WHERE id=? AND speaking_until=?`(자기 잠금만 해제) | R-MSG-007 |
| S3 | messages | `recent(roomId: string, n: number): Promise<Message[]>` / `last(roomId: string)` | `ORDER BY id DESC LIMIT ?` | R-LLM-003 · R-MSG-006 |
| S4 | memory | `get(roomId)` / `put(roomId, summary, nowMs)` / `advance(roomId, expectedUntilId, newUntilId, summary, nowMs): Promise<boolean>` | `advance`는 `WHERE source_until_id = ?` 조건부 UPDATE(중복 요약 방지) | R-MEM-001~003 |

- 위 표의 시그니처는 해당 묶음 설계에서 확정한다. S1 구현자는 만들지 않는다(요구 기반 최소 구현).

## 3. 내부 구조

| 파일 | 책임 |
|---|---|
| `server/src/db/index.ts` | `createDb`, 공개 타입 재노출 |
| `server/src/db/types.ts` | `Speaker`·`MessageKind`·`RoomSummary`·`Message`·행 타입(`RoomSummaryRow`·`MessageRow`) |
| `server/src/db/sql.ts` | SQL 문자열 상수(§3.1). 문자열 연결·템플릿 보간 금지 |
| `server/src/db/rooms.ts` | `createRoomsRepo(binding): RoomsRepo` |
| `server/src/db/messages.ts` | `createMessagesRepo(binding): MessagesRepo`, `toMessage(row)` |
| `server/migrations/0001_init.sql` | 초기 스키마(§7) |
| `server/test/db.test.ts` | SRV-T-020~031 |

- 의존: `@cloudflare/workers-types`(타입), `../app-error`(좁히기 실패 시 `INTERNAL`). 서비스 모듈(`rooms/`·`messages/` 등) import 금지(R-DB-005).
- 상태 없음. 전역 연결 객체·`PRAGMA` 설정 없음(D1이 관리).
- 시각을 직접 만들지 않는다. `Date.now()`·SQL `CURRENT_TIMESTAMP`·`unixepoch()`를 쓰지 않고 서비스가 넘긴 `nowMs`만 쓴다(테스트 결정성).

### 3.1 S1 SQL 상수

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

-- SQL_MESSAGES_PAGE_LATEST            (beforeId 없음)
SELECT id, room_id, speaker, kind, text, author_name, created_at
FROM messages
WHERE room_id = ?1
ORDER BY id DESC
LIMIT ?2

-- SQL_MESSAGES_PAGE_BEFORE            (beforeId 있음)
SELECT id, room_id, speaker, kind, text, author_name, created_at
FROM messages
WHERE room_id = ?1 AND id < ?2
ORDER BY id DESC
LIMIT ?3
```

- `author_mb_id`는 S1 조회 SQL에서 선택하지 않는다.
- 두 페이지 쿼리 모두 `idx_messages_room_id_id`의 범위 스캔으로 끝난다(`EXPLAIN QUERY PLAN` 확인 — §8 수동).

### 3.2 행 ↔ 도메인 변환

| 컬럼 | 도메인 필드 | 변환 |
|---|---|---|
| `rooms.created_at` / `updated_at` | `createdAt` / `updatedAt` | number 그대로(epoch ms) |
| `message_count` | `messageCount` | number |
| `messages.room_id` | `roomId` | string |
| `messages.speaker` / `kind` | `speaker` / `kind` | `toSpeaker` / `toKind`(유니온 좁히기) |
| `messages.author_name` | `authorName` | `string \| null` 그대로 |
| `messages.author_mb_id` | (없음) | 조회하지 않음 |

## 4. 비동기·동시성

```
서비스(rooms/messages)
  └ db.rooms.listSummaries()  ── await binding.prepare(SQL).all<RoomSummaryRow>() ──→ D1
  └ Promise.all([ db.rooms.exists(id), db.messages.pageDesc(id, take, before) ])  ── 두 쿼리 병렬 ──→ D1
  └ (S2~) db.batch([ insertStmt, touchStmt ])  ── 원자적 ──→ D1
```

- 전부 `async`/`await`. 동기 SQLite 드라이버 없음.
- 동시성 원칙: 읽고-판단하고-쓰는 흐름은 `batch`로 묶을 수 없으므로 조건부 UPDATE + `meta.changes`로 경합을 처리한다(S2 레이트리밋, S3 잠금, S4 요약 — §2.2). 프로세스 메모리 잠금·카운터 금지.
- 타임아웃은 두지 않는다(D1 호출은 플랫폼이 제한).

### 4.1 시각 규칙 (epoch ms)

| 컬럼 | 의미 | 값 |
|---|---|---|
| `rooms.created_at`, `rooms.updated_at` | 생성·마지막 변경 시각 | epoch ms |
| `rooms.speaking_until` | speak 잠금 만료 시각(NULL = 잠금 없음) | epoch ms(선점 시각 + 90000) |
| `messages.created_at` | 작성 시각 | epoch ms |
| `memory.updated_at` | 요약·편집 시각 | epoch ms |
| `rate_limits.window_start` | 분 창 시작 시각 | `Math.floor(nowMs / 60000) * 60000`(epoch ms) |

- R-AUTH-005의 "분 창 `floor(now/60000)`"은 창 **번호**다. R-DB-001의 "시각은 epoch ms" 규칙에 맞추기 위해 컬럼에는 번호 × 60000(창 시작 epoch ms)을 저장한다(§11 D-DB-4).

### 4.2 핫패스 쿼리 비용 (무료 플랜: 일 읽기 500만 행 · 쓰기 10만 행)

| 요청 | 쿼리 수 | 읽기 행(추정) | 쓰기 행 |
|---|---|---|---|
| `GET /api/rooms` | 1 | 방 수 R + **전체 메시지 수 M**(방별 `COUNT(*)`가 인덱스 항목을 센다) | 0 |
| `GET /api/rooms/:id/messages` | 2(병렬) | 1 + 최대 `limit + 1` | 0 |
| `GET /api/health` · `/embed` | 0 | 0 | 0 |

- 방 목록의 읽기 행이 전체 메시지 수에 비례한다. 예를 들어 메시지 2만 건이면 목록 1회에 약 2만 행이고, 하루 250회 조회면 한도(500만)에 닿는다. 사용 규모상 당장은 문제없을 것으로 보이나 §11 제안에 대안을 적는다.

## 5. 에러 타입

| 에러 클래스 | shared 에러 코드 | HTTP | 한국어 메시지 | 원인 |
|---|---|---|---|---|
| `AppError` | `INTERNAL` | 500 | `저장된 데이터 형식이 올바르지 않습니다.` | 행 좁히기 실패(CHECK 우회 데이터). 정상 운영에서는 나오지 않는다 |
| (전파) D1 오류 | `INTERNAL` | 500 | `서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.` | D1 장애·제약 위반. db는 감싸지 않고 전파하며 index.ts `onError`가 `INTERNAL`로 닫고 원본은 로그에만([index.md](index.md) §5) |

- 제약 위반을 업무 에러(`NOT_FOUND` 등)로 바꾸는 판단은 서비스 몫이다(예: S2에서 없는 방에 메시지 넣기 → 서비스가 먼저 `exists`로 판정).

## 6. 설정(env)

- 읽는 키: 없음. `createDb`가 `DB` 바인딩(D1Database)을 **인자로** 받는다(index.ts가 `c.env.DB`를 넘김 — 리소스 바인딩이라 [env.md](env.md) §2에서 `Env.DB`로 노출).
- 쓰는 키: 없음.

## 7. DB 스키마·마이그레이션

### 7.1 `server/migrations/0001_init.sql` 전문

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
| `rooms.title` 1~60 | R-ROOM-002·003. 서비스가 trim·검증하고 CHECK는 최후 방어 |
| `messages.text >= 1` | R-MSG-002·004(1~2000). 상한 2000은 **유저 입력 규칙**이라 서비스에서 검사한다. LLM 결과에는 요구된 상한이 없어 CHECK에 넣지 않았다(넣으면 긴 생성 결과가 `INTERNAL`로 실패) |
| `speaker`·`kind` 열거 | R-DB-001 🔒 |
| `speaker = 'user' OR kind = 'line'` | OOC는 유저 입력에서만 생긴다(R-MSG-002: `kind = ooc ? 'ooc' : 'line'`, R-MSG-003 캐릭터 발화) |
| 유저 메시지의 `author_mb_id`·`author_name` NOT NULL | R-MSG-002. 캐릭터 메시지의 작성자 기록 여부는 S3에서 정한다(지금은 NULL 허용) |
| `memory.summary <= 4000` | R-MEM-001. S4 자동 요약도 이 상한을 지켜야 한다(S4 설계에 인계) |
| `REFERENCES rooms(id)`(ON DELETE 없음) | 고아 레코드 차단. 연쇄 삭제는 R-DB-003대로 **batch로 명시** — 순서가 틀리면 외래 키 오류로 드러난다. D1은 외래 키를 기본으로 강제한다(SRV-T-023로 로컬 확인) |
| `AUTOINCREMENT` | R-DB-001 🔒. 삭제된 id가 다시 쓰이지 않아 `before` 커서와 "마지막 메시지" 판정이 흔들리지 않는다 |

### 7.3 마이그레이션 절차

`<DATABASE>` 자리는 바인딩 이름 `DB`(또는 `database_name` `london-dispatch`). 명령은 `server/`에서 실행하거나 루트에서 `-c server/wrangler.toml`을 붙인다.

| 상황 | 명령 | 실행 주체 |
|---|---|---|
| 새 마이그레이션 파일 | `npx wrangler d1 migrations create DB <설명>` → `server/migrations/000N_<설명>.sql` 생성 후 SQL 작성 | server-implementer |
| 로컬 적용(dev) | `npx wrangler d1 migrations apply DB --local` | `/dev-start`, server-implementer(가드 허용) |
| 로컬 적용 상태 | `npx wrangler d1 migrations list DB --local` | 누구나 |
| 테스트 | `server/vitest.config.ts`에서 `readD1Migrations('./migrations')`로 읽어 `TEST_MIGRATIONS` 바인딩으로 넘기고, setup 파일에서 `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`(§8) | 자동 |
| 운영 DB 생성(1회) | `npx wrangler d1 create london-dispatch` → 출력된 `database_id`를 `wrangler.toml`에 기입 | S5, 사용자 확인 |
| 운영 적용 | `npx wrangler d1 migrations apply DB --remote` | `/deploy` 안에서만, 사용자 확인 |

- 적용 상태는 wrangler가 D1 안의 `d1_migrations` 테이블로 추적한다. 적용된 파일은 수정 금지(R-DB-002).
- 코드에 DDL·기동 시 자동 마이그레이션을 두지 않는다.
- 되돌리기는 새 번호 마이그레이션으로 한다. 운영 데이터 복구는 D1 Time Travel(S5 배포 문서에서 다룬다).
- 로컬 D1 상태는 `server/.wrangler/`(git 제외)에 생긴다. 테스트는 이 상태를 쓰지 않는다.

## 8. 테스트 계획

`server/test/db.test.ts`. `@cloudflare/vitest-pool-workers`가 테스트 파일마다 격리해 주는 D1 바인딩(`import { env } from 'cloudflare:test'`의 `env.DB`)에 setup 파일이 마이그레이션을 적용한다. 데이터는 각 테스트에서 직접 `INSERT`로 넣는다(고정 `nowMs`).

테스트 설정 요지(구현 시 설치된 `@cloudflare/vitest-pool-workers` 버전의 API 이름을 따른다):

```ts
// server/vitest.config.ts (요지)
// migrations = await readD1Migrations(path.join(__dirname, 'migrations'))
// poolOptions.workers = { wrangler: { configPath: './wrangler.toml' },
//                         miniflare: { bindings: { TEST_MIGRATIONS: migrations, TOKEN_SECRET: 'test-secret' } } }
// setupFiles: ['./test/apply-migrations.ts']

// server/test/apply-migrations.ts (요지)
// import { applyD1Migrations, env } from 'cloudflare:test'
// await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
```

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| SRV-T-020 | `migration_creates_four_tables_with_columns` | `PRAGMA table_info` 결과가 §7.1 컬럼명·타입·NOT NULL·PK와 일치(4테이블) | R-DB-001 |
| SRV-T-021 | `migration_check_constraints_reject_invalid_rows` | 표 기반 직접 INSERT 실패: speaker `'bob'`, kind `'x'`, 캐릭터+`ooc`, text `''`, title `''`·61자, 유저 메시지 author 누락, summary 4001자, count 0 | R-DB-001 |
| SRV-T-022 | `migration_creates_required_indexes` | `PRAGMA index_list`에 `idx_messages_room_id_id`·`idx_rooms_updated_at`, `PRAGMA index_info` 컬럼 순서 `(room_id, id)` | R-DB-004 |
| SRV-T-023 | `foreign_key_rejects_message_for_unknown_room` | 없는 `room_id`로 messages INSERT → 실패. 메시지가 있는 방을 rooms만 DELETE → 실패 | R-DB-001·003 |
| SRV-T-024 | `listSummaries_returns_empty_array_when_no_rooms` | `[]` | R-ROOM-001 |
| SRV-T-025 | `listSummaries_orders_by_updatedAt_desc_with_counts` | 방 3개(updated_at 100·300·200, 메시지 0·2·5) → 순서 300·200·100, `messageCount` 2·5·0, 동률은 id 오름차순 | R-ROOM-001 |
| SRV-T-026 | `exists_returns_true_only_for_existing_room` | true / false | R-MSG-001 |
| SRV-T-027 | `touchStmt_updates_updated_at_and_reports_zero_changes_for_unknown` | 실행 후 `updated_at = nowMs`, 없는 id는 `meta.changes === 0` | R-ROOM-005 |
| SRV-T-028 | `pageDesc_returns_desc_rows_before_cursor_within_room` | 두 방에 메시지 교차 삽입 → 대상 방만, id 내림차순, `beforeId` 미포함(엄격히 작음), `take` 건수 | R-MSG-001 |
| SRV-T-029 | `pageDesc_maps_row_to_camelCase_without_author_mb_id` | 키 집합 = `id, roomId, speaker, kind, text, authorName, createdAt`, 캐릭터 `authorName === null` | R-DB-005 |
| SRV-T-030 | `batch_rolls_back_all_when_one_statement_fails` | `[정상 rooms INSERT, CHECK 위반 INSERT]` → throw, rooms 0건 | R-DB-003 |
| SRV-T-031 | `narrowing_throws_INTERNAL_on_unexpected_speaker` | `toSpeaker('bob')` → `AppError` `INTERNAL`(순수 함수 단위) | R-DB-005 |

- 방 삭제 후 고아 0건 테스트(R-DB-003 수용 기준 후반)는 `deleteCascade`가 생기는 S2에서 추가한다.

수동·리뷰 체크:

- [ ] `npx wrangler d1 migrations apply DB --local` 성공 후 `npx wrangler d1 execute DB --local --command "PRAGMA table_info(messages)"`로 컬럼 확인(R-DB-001 수용 기준).
- [ ] `EXPLAIN QUERY PLAN`으로 두 페이지 쿼리가 `idx_messages_room_id_id`를 쓰는지 확인(R-NFR-002).
- [ ] 리뷰 grep: `server/src/db`에서 SQL 문자열에 `${` 또는 `+` 연결이 0건(R-DB-003).
- [ ] 리뷰: `server/src/db`가 `../rooms`·`../messages`·`../memory`·`../llm`·`../auth`를 import하지 않음(R-DB-005).

## 9. contract 요구 명세

db는 contract에 직접 노출되지 않는다. contract가 알아야 할 데이터 규칙만 적는다.

| 항목 | 내용 | 이유 |
|---|---|---|
| 시각 필드 | 모든 시각은 epoch ms 정수(`createdAt`·`updatedAt`) | R-API-004 · R-DB-001 |
| id 타입 | 방 id 문자열(UUID), 메시지 id 정수 | R-API-004 |
| `speaker` 값 | `'sebastian' \| 'ciel' \| 'user'` — 캐릭터 id와 같은 문자열 | 확정사항 §5.4 |
| `kind` 값 | `'line' \| 'ooc'`, 캐릭터 메시지는 항상 `'line'` | CHECK 제약 |
| `authorName` | 유저 메시지는 문자열, 캐릭터 메시지는 `null` | §3.2 |
| `authorMbId` | **응답에 포함하지 않는다** | 누구나 읽는 공개 응답에 그누보드 로그인 ID가 실리면 계정 정보가 노출된다. 화면 요구(R-CHAT-002)는 작성자 이름만 쓴다 |

## 10. 요구 추적표

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-DB-001 🔒 | §7.1·§7.2·§4.1 | SRV-T-020·021·023 | ✅ |
| R-DB-002 | §7.3 | 리뷰(DDL 코드 0건) | ✅ |
| R-DB-003 | §2.1 `batch`·§2.2 `deleteCascade`·§3.1·§8 grep | SRV-T-023·030, 리뷰 grep | 부분(연쇄 삭제 테스트는 S2) |
| R-DB-004 | §7.1 인덱스 | SRV-T-022 | ✅ |
| R-DB-005 | §1·§3·§3.2 | SRV-T-029·031, 리뷰 import | ✅ |
| R-ROOM-005 | §2.1 `touchStmt` | SRV-T-027 | 부분(호출은 S2·S3 쓰기 경로, 규칙은 [rooms.md](rooms.md)) |
| R-NFR-002 | §3.1 인덱스 범위 스캔 | 수동 EXPLAIN | 부분(응답 시간 측정은 [messages.md](messages.md)) |
| R-NFR-005 | §4.2 | 리뷰 | ✅ |

## 11. 설계 결정 노트

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-DB-1 | 4테이블을 `0001_init.sql` 하나에 | 묶음마다 마이그레이션 | 위임문 지시. 스키마 🔒(확정사항 §5.4)가 이미 확정 |
| D-DB-2 | 외래 키 `REFERENCES`만, `ON DELETE CASCADE` 없음 | CASCADE | R-DB-003이 batch 명시 삭제를 요구. CASCADE를 두면 batch 순서 실수를 숨긴다 |
| D-DB-3 | `messages.text` 상한 CHECK 없음 | `<= 2000` | 2000은 유저 입력 규칙. LLM 결과 상한은 S3 후처리가 정한다 |
| D-DB-4 | `rate_limits.window_start` = 창 시작 epoch ms | 창 번호(`floor(now/60000)`) | R-AUTH-005 문구(창 번호)와 R-DB-001(시각은 epoch ms)을 함께 만족. 계산식은 같고 단위만 맞춘다 |
| D-DB-5 | 메시지 조회에서 `author_mb_id` 제외 | 응답에 포함 | 공개 읽기 응답에 로그인 ID 노출 방지. 저장은 R-MSG-002대로 한다 |
| D-DB-6 | 읽기 2개는 `batch` 대신 `Promise.all` 병렬 | `batch([exists, page])` | 저장소 간 결합 없이 왕복 1회 수준 지연. 읽기는 원자성이 필요 없다 |
| D-DB-7 | `touchStmt`는 실행하지 않고 문장을 돌려준다 | 즉시 실행 함수 | S2·S3에서 메시지 쓰기와 같은 batch에 넣어야 R-ROOM-005가 원자적으로 지켜진다 |

확인 필요:

- D1의 외래 키 기본 강제는 SRV-T-023으로 로컬(miniflare) 동작을 확인한다. 운영(remote) 동작은 S5 배포 후 스모크에서 확인한다.

제안(설계 미반영, 사용자 판단):

- **방 목록 읽기 비용**: `rooms.message_count` 컬럼을 추가하고 메시지 추가·삭제 batch에서 함께 증감하면 `GET /api/rooms`의 읽기 행이 방 수 R로 줄어든다(§4.2). 스키마가 🔒(확정사항 §5.4)라 사용자 승인 후 `0002_*.sql`로만 가능하다. 메시지 수가 수만 건에 이르기 전에는 필요 없다.
- `rate_limits` 오래된 행 정리는 S2에서 같은 `mb_id`의 지난 창을 `hit`과 한 batch로 지우는 방식이면 Cron 없이 된다(S2 설계 판단).
