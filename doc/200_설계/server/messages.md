# messages 모듈 설계

- 상태: 초안 · 최종 갱신: 2026-10-05
- 묶음: S1 구현 = R-MSG-001(히스토리 페이지 조회). R-MSG-002~008은 §2.2에 시그니처만 두고 상세는 각 묶음(S2·S3)에서 정한다.
- 관련 문서: [db.md](db.md)(`messages` 테이블·`pageDesc`), [rooms.md](rooms.md)(`updated_at` 갱신 규칙), [index.md](index.md)(서비스 컨테이너·에러 핸들러).

## 1. 목적

히스토리 조회는 두꺼운 일기장을 뒤에서부터 한 묶음씩 넘겨 보는 일이다. 책갈피(`before`)를 끼운 자리 바로 앞의 몇 장(`limit`)을 펼치되, 읽기 편하게 오래된 장부터 순서대로 보여 주고, 더 앞장이 남았는지(`hasMore`)를 알려 준다.

| 요구ID | 내용 |
|---|---|
| R-MSG-001 🔒 | `before`(메시지 id, 생략 시 최신)·`limit`(기본 30, 최대 100). 반환은 오래된→새 순, `hasMore` 포함. 누구나 |
| R-NFR-002 | 첫 페이지(30건) 응답 로컬 1초 이내 |
| R-API-004 | 필드 camelCase, 시각 epoch ms, 메시지 id 정수 |
| R-MSG-002~008 | 저장·speak·수정·삭제·재작성·잠금·권한 — 후속 묶음(§2.2) |

## 2. 공개 API

### 2.1 S1 구현 대상

```ts
// server/src/messages/index.ts
import type { Db, Message } from '../db'

export type { Message }

/** R-MSG-001 기본·최대 개수 */
export const MESSAGE_PAGE_LIMIT_DEFAULT = 30
export const MESSAGE_PAGE_LIMIT_MAX = 100

/** 라우트가 쿼리 문자열을 숫자로 바꿔 넘긴다. 범위·정수 판정은 서비스가 한다 */
export type MessagePageQuery = {
  before?: number
  limit?: number
}

/** messages 는 오래된→새 순. 다음(더 오래된) 페이지의 before 는 messages[0].id */
export type MessagePage = {
  messages: Message[]
  hasMore: boolean
}

export type MessagesService = {
  /** 방 히스토리 한 페이지 */
  listMessages: (roomId: string, query: MessagePageQuery) => Promise<MessagePage>
}

export type MessagesDeps = { db: Db }

export const createMessagesService = (deps: MessagesDeps): MessagesService
```

```ts
// server/src/messages/page.ts — 순수 함수(DB·시각 의존 없음)
export type NormalizedPageQuery = { limit: number; before?: number }

/** 기본값 적용 + 검증. 실패 시 AppError VALIDATION_ERROR */
export const normalizePageQuery = (query: MessagePageQuery): NormalizedPageQuery

/** id 내림차순 행(limit + 1 건까지)을 오래된→새 순 페이지로 바꾼다 */
export const toPage = (rowsDesc: readonly Message[], limit: number): MessagePage
```

| 이름 | 인자 | 반환 | 실패 조건(에러 코드) | 요구ID |
|---|---|---|---|---|
| `createMessagesService` | `deps: { db: Db }` | `MessagesService` | — | R-MSG-001 |
| `listMessages` | `roomId: string, query: MessagePageQuery` | `Promise<MessagePage>` | `limit`이 1~100 정수가 아님 → `VALIDATION_ERROR`(400). `before`가 1 이상 안전 정수가 아님 → `VALIDATION_ERROR`(400). 방 없음 → `NOT_FOUND`(404) | R-MSG-001 |
| `normalizePageQuery` | `query` | `NormalizedPageQuery` | 위 두 `VALIDATION_ERROR` | R-MSG-001 |
| `toPage` | `rowsDesc, limit` | `MessagePage` | — | R-MSG-001 |
| `MESSAGE_PAGE_LIMIT_DEFAULT` / `_MAX` | — | `30` / `100` | — | R-MSG-001 |

`Message` = `{ id: number; roomId: string; speaker: 'sebastian' | 'ciel' | 'user'; kind: 'line' | 'ooc'; text: string; authorName: string | null; createdAt: number }`([db.md](db.md) §2.1). `authorMbId`는 없다(공개 응답에 그누보드 로그인 ID 노출 방지).

#### 페이지 규칙

| 규칙 | 값 |
|---|---|
| `limit` 생략 | 30 |
| `limit` 허용 | 정수 1~100. 넘으면 잘라 주지 않고 `VALIDATION_ERROR` |
| `before` 생략 | 가장 최신부터 |
| `before` 의미 | `id < before`인 메시지만(엄격히 작음). 다른 방의 id여도 숫자 커서로만 쓴다 |
| `before` 허용 | `Number.isSafeInteger(before) && before >= 1` |
| 정렬 | 응답 `messages`는 id 오름차순(오래된→새) |
| `hasMore` | 이 페이지보다 더 오래된 메시지가 있으면 `true` |
| 다음 페이지 | `before = messages[0].id`(응답에 별도 커서 필드 없음 — 요구에 없음) |
| 빈 방 | `{ messages: [], hasMore: false }` |

### 2.2 후속 묶음 예정 (S1 미구현 — 시그니처만, 상세는 해당 묶음 설계)

```ts
// S2 — AuthContext(이름·필드는 S2 auth 설계에서 확정: mbId, nick, chName, level)
appendUserMessage: (roomId: string, input: { text: string; ooc: boolean }, actor: AuthContext) => Promise<Message>
editMessage: (messageId: number, input: { text: string }, actor: AuthContext) => Promise<Message>
deleteMessage: (messageId: number, actor: AuthContext) => Promise<void>

// S3 — waitUntil 은 라우트가 c.executionCtx.waitUntil 을 감싸 넘긴다(서비스는 Hono 객체를 모른다)
speak: (roomId: string, input: { character: 'sebastian' | 'ciel' }, actor: AuthContext,
        background: { waitUntil: (task: Promise<unknown>) => void }) => Promise<Message>
regenerate: (messageId: number, actor: AuthContext,
             background: { waitUntil: (task: Promise<unknown>) => void }) => Promise<Message>
```

| 이름 | 묶음 | 규칙 요지 | 업무 에러 | 요구ID |
|---|---|---|---|---|
| `appendUserMessage` | S2 | `text` 1~2000자, speaker `user`, kind `ooc ? 'ooc' : 'line'`, 작성자 기록, **LLM 호출 없음**, 메시지 INSERT + `touchStmt` 한 batch | `VALIDATION_ERROR`, `NOT_FOUND` | R-MSG-002 · R-ROOM-005 |
| `editMessage` | S2 | `text` 1~2000자, 캐릭터·유저 메시지 모두, 작성자 제한 없음 | `VALIDATION_ERROR`, `NOT_FOUND` | R-MSG-004·008 |
| `deleteMessage` | S2 | 작성자 제한 없음, 실삭제 | `NOT_FOUND` | R-MSG-005·008 |
| `speak` | S3 | 방당 동시 1건(`speaking_until` 조건부 UPDATE, 90초), LLM 1턴 생성·저장, 응답 뒤 요약은 `waitUntil` | `VALIDATION_ERROR`, `NOT_FOUND`, `SPEAK_IN_PROGRESS`, `LLM_FAILED`, `LLM_EMPTY`, `CONFIG_INVALID` | R-MSG-003·007 |
| `regenerate` | S3 | 캐릭터 메시지이고 방의 마지막 메시지일 때만 같은 캐릭터로 재생성 | `NOT_FOUND`, `NOT_CHARACTER_MESSAGE`, `NOT_LAST_MESSAGE`, `SPEAK_IN_PROGRESS`, `LLM_FAILED`, `LLM_EMPTY`, `CONFIG_INVALID` | R-MSG-006·007 |

- 토큰·등급·레이트리밋 에러(`TOKEN_REQUIRED`·`TOKEN_INVALID`·`LEVEL_TOO_LOW`·`RATE_LIMITED`)는 라우트 미들웨어(S2 auth)가 서비스 호출 전에 낸다.

## 3. 내부 구조

| 파일 | 책임 |
|---|---|
| `server/src/messages/index.ts` | 문서주석 6항목, `createMessagesService`·상수·타입 재노출 |
| `server/src/messages/service.ts` | `listMessages` 흐름(§4) |
| `server/src/messages/page.ts` | `normalizePageQuery`·`toPage` 순수 함수 |
| `server/src/messages/page.test.ts` | SRV-T-060~065(순수 단위) |
| `server/test/messages.test.ts` | SRV-T-066~070(D1 통합) |
| `server/test/fixtures/seed-s1.sql` | 수동 확인·화면 캡처용 시드(§8.1). 테스트 코드는 쓰지 않는다 |

- 의존: `../db`, `../app-error`. `llm`·`memory`는 S3·S4에서 추가된다. HTTP 객체를 모른다.
- 상태 없음. 상수는 §2.1의 두 개뿐.

## 4. 비동기·동시성

```
route GET /api/rooms/:id/messages?before&limit
  └ messages.listMessages(roomId, { before, limit })
       ① normalizePageQuery(query)          ── 실패 → VALIDATION_ERROR (DB 접근 전)
       ② Promise.all([
            db.rooms.exists(roomId),                               ── 읽기 1행
            db.messages.pageDesc(roomId, limit + 1, before),       ── 인덱스 범위 스캔 ≤ limit+1 행
          ])                                                        (두 쿼리 병렬, 왕복 1회 수준)
       ③ exists === false → NOT_FOUND
       ④ toPage(rowsDesc, limit)
            hasMore  = rowsDesc.length > limit
            messages = rowsDesc.slice(0, limit) 를 뒤집어 오름차순
  ◀ MessagePage
```

- 쓰기·잠금 없음. 다른 요청이 그사이 메시지를 추가해도 커서(`before`)가 id 기준이라 중복·누락 없이 이어진다(AUTOINCREMENT라 id가 재사용되지 않는다).
- R-NFR-002: 쿼리 2개가 병렬이고 페이지 쿼리는 `idx_messages_room_id_id` 범위 스캔이다. 로컬 1초 이내를 수동 측정한다(§8).
- CPU: 최대 101행 매핑·배열 뒤집기뿐(R-NFR-005).

## 5. 에러 타입

| 에러 클래스 | shared 에러 코드 | HTTP | 한국어 메시지 | 원인 |
|---|---|---|---|---|
| `AppError` | `VALIDATION_ERROR` | 400 | `불러올 개수(limit)는 1~100 사이의 정수여야 합니다.` | `limit` 범위·정수 위반 |
| `AppError` | `VALIDATION_ERROR` | 400 | `기준 메시지 번호(before)가 올바르지 않습니다.` | `before` 0 이하·정수 아님·안전 정수 초과 |
| `AppError` | `NOT_FOUND` | 404 | `방을 찾을 수 없습니다.` | 없는 방(삭제된 방 포함) |
| (전파) D1 오류 | `INTERNAL` | 500 | `서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.` | D1 장애 |

## 6. 설정(env)

- 읽는 키: 없음(S1). 쓰는 키: 없음.
- 기본·최대 개수(30·100)는 요구 상수라 env가 아니라 모듈 상수다(R-MSG-001).

## 7. DB 스키마·마이그레이션

- 사용 테이블: `messages`(페이지), `rooms`(존재 확인). 정의는 [db.md](db.md) §7.1.
- 인덱스: `idx_messages_room_id_id`.
- 새 마이그레이션 없음.

## 8. 테스트 계획

순수 함수는 소스 옆 `page.test.ts`, 서비스는 `server/test/messages.test.ts`(workers pool D1 바인딩 + 마이그레이션, [db.md](db.md) §8). 메시지 id는 INSERT 결과에서 얻고 절대값(1부터 시작 등)을 가정하지 않는다.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-060 | `normalizePageQuery_applies_default_limit_30` | `{}` / `{ before: 5 }` | `{ limit: 30 }` / `{ limit: 30, before: 5 }` | R-MSG-001 |
| SRV-T-061 | `normalizePageQuery_rejects_limit_out_of_range` | `limit` 0·101 (1·100은 통과) | `VALIDATION_ERROR` | R-MSG-001 |
| SRV-T-062 | `normalizePageQuery_rejects_non_integer_limit` | `limit` 1.5·`NaN`·`Infinity` | `VALIDATION_ERROR` | R-MSG-001 |
| SRV-T-063 | `normalizePageQuery_rejects_before_not_positive` | `before` 0·-1 | `VALIDATION_ERROR` | R-MSG-001 |
| SRV-T-064 | `normalizePageQuery_rejects_non_safe_integer_before` | `before` 1.5·`NaN`·`2 ** 53` | `VALIDATION_ERROR` | R-MSG-001 |
| SRV-T-065 | `toPage_returns_ascending_messages_and_hasMore` | 내림차순 `limit+1`건 / `limit`건 / 0건 | 오름차순 `limit`건 + `true` / `limit`건 + `false` / `[]` + `false` | R-MSG-001 |
| SRV-T-066 | `listMessages_pages_three_times_oldest_to_newest` | 한 방에 70건, `limit` 30으로 `before` 없이 → `messages[0].id`로 2회 더 | 1쪽 최신 30건(41~70번째) `hasMore=true`, 2쪽 11~40번째 `true`, 3쪽 1~10번째 `false`. 각 쪽 오름차순, 쪽 사이 중복·누락 없음 | R-MSG-001 수용 기준(3페이지 연속) |
| SRV-T-067 | `listMessages_excludes_other_rooms` | 두 방에 교차 삽입 | 대상 방 메시지만 | R-MSG-001 |
| SRV-T-068 | `listMessages_returns_empty_page_for_empty_room` | 메시지 0건 방 | `{ messages: [], hasMore: false }` | R-MSG-001 |
| SRV-T-069 | `listMessages_throws_NOT_FOUND_for_unknown_room` | 없는 id(`before` 유무 둘 다) | `NOT_FOUND` 404 | R-MSG-001 · R-ROOM-004 수용 기준(삭제 후 404)의 읽기 측 |
| SRV-T-070 | `listMessages_validates_before_touching_db` | `limit: 0`, 모든 메서드가 호출되면 실패하는 가짜 `Db` | `VALIDATION_ERROR`, `Db` 호출 0회 | R-MSG-001 |

- 에러 경로 6건(061~064·069·070) ≥ 정상 경로 5건(060·065~068).

### 8.1 시드 픽스처 `server/test/fixtures/seed-s1.sql` (수동 확인·`/run-app` 캡처용)

S1에는 쓰기 API가 없어 읽기 전용 화면에 보여 줄 데이터가 없다. 로컬 D1에만 아래 시드를 넣는다. **`--remote`에는 절대 적용하지 않는다.**

```sql
-- seed-s1.sql — S1 읽기 전용 화면 확인용 로컬 시드. 운영(--remote) 적용 금지.
-- 주의: 아래 DELETE 가 로컬 D1(server/.wrangler/)의 기존 방·메시지·장기기억을 모두 지운다.
-- 적용: (server/ 에서) npx wrangler d1 execute DB --local --file=test/fixtures/seed-s1.sql
-- 시각 기준 1767225600000 = 2026-01-01T00:00:00Z
DELETE FROM memory;
DELETE FROM messages;
DELETE FROM rooms;

INSERT INTO rooms (id, title, created_at, updated_at, speaking_until) VALUES
  ('00000000-0000-4000-8000-000000000001', '안개 낀 런던의 아침', 1767225600000, 1767229800000, NULL),
  ('00000000-0000-4000-8000-000000000002', '팬텀하이브 저택의 저녁', 1767225600000, 1767226800000, NULL),
  ('00000000-0000-4000-8000-000000000003', '아직 아무도 없는 방', 1767225600000, 1767225600000, NULL);

-- 방 1: 70건(4종 순환 — 세바스찬 · 시엘 · 유저 발화 · 유저 지시)
INSERT INTO messages (room_id, speaker, kind, text, author_mb_id, author_name, created_at)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 70)
SELECT '00000000-0000-4000-8000-000000000001',
       CASE n % 4 WHEN 1 THEN 'sebastian' WHEN 2 THEN 'ciel' ELSE 'user' END,
       CASE n % 4 WHEN 0 THEN 'ooc' ELSE 'line' END,
       CASE n % 4
         WHEN 1 THEN '도련님, 홍차를 준비해 두었습니다. (' || n || ')'
         WHEN 2 THEN '늦었군, 세바스찬. 오늘 일정부터 말해. (' || n || ')'
         WHEN 3 THEN '창밖으로 안개가 한층 짙어진다. (' || n || ')'
         ELSE '분위기를 조금 더 어둡게 이어 가 줘. (' || n || ')'
       END,
       CASE WHEN n % 4 IN (0, 3) THEN 'seed_user' END,
       CASE WHEN n % 4 IN (0, 3) THEN '시드 유저' END,
       1767225600000 + n * 60000
FROM seq;

-- 방 2: 2건
INSERT INTO messages (room_id, speaker, kind, text, author_mb_id, author_name, created_at) VALUES
  ('00000000-0000-4000-8000-000000000002', 'ciel', 'line', '오늘 저녁은 조용히 보내고 싶군.', NULL, NULL, 1767226740000),
  ('00000000-0000-4000-8000-000000000002', 'sebastian', 'line', '분부대로, 도련님.', NULL, NULL, 1767226800000);
```

- 결과: 방 목록은 방 1(70건)·방 2(2건)·방 3(0건) 순서. 방 1 첫 페이지 30건은 `hasMore = true`.
- 문구는 화면 확인용 임시 문장이며 캐릭터 설정(persona)과 무관하다.

수동 체크리스트:

- [ ] 시드 적용 후 `curl -s -o /dev/null -w "%{time_total}\n" "http://localhost:3000/api/rooms/00000000-0000-4000-8000-000000000001/messages"`가 1초 미만(R-NFR-002, contract 라우트 생성 후).
- [ ] 같은 주소의 응답이 30건·오름차순·`hasMore: true`, 각 항목에 `authorMbId` 없음.
- [ ] `?limit=101` → 400 `VALIDATION_ERROR`, 없는 방 id → 404 `NOT_FOUND`.

## 9. contract 요구 명세

| 서비스 | 엔드포인트 후보 | 입력 | 출력 | 에러 | 토큰 | 레이트리밋 | 이유 |
|---|---|---|---|---|---|---|---|
| `messages.listMessages(roomId, query)` | `GET /api/rooms/:id/messages?before=&limit=` | 경로 `id`(문자열 그대로), 쿼리 `before`·`limit` — 비어 있거나 없으면 생략, 있으면 `Number(문자열)`로만 바꿔 넘긴다. 정수·범위 판정은 서비스가 한다 | `MessagePage { messages: Message[]; hasMore: boolean }` | `VALIDATION_ERROR`(400), `NOT_FOUND`(404), `CONFIG_INVALID`(500), `INTERNAL`(500) | ✕ | ✕ | R-MSG-001 · R-CHAT-003 |
| `appendUserMessage` (S2) | `POST /api/rooms/:id/user` | `{ text: string; ooc: boolean }` | `Message` | §2.2 + 공통 | ○ | ○ | R-MSG-002 |
| `editMessage` (S2) | `PATCH /api/messages/:id` | `{ text: string }` | `Message` | §2.2 + 공통 | ○ | ○ | R-MSG-004 |
| `deleteMessage` (S2) | `DELETE /api/messages/:id` | — | 없음 | §2.2 + 공통 | ○ | ○ | R-MSG-005 |
| `speak` (S3) | `POST /api/rooms/:id/speak` | `{ character: 'sebastian' \| 'ciel' }` | `Message` | §2.2 + 공통 | ○ | ○ | R-MSG-003 |
| `regenerate` (S3) | `POST /api/messages/:id/regenerate` | — | `Message` | §2.2 + 공통 | ○ | ○ | R-MSG-006 |

- `Message` 필드: `id: number`, `roomId: string`, `speaker: 'sebastian' | 'ciel' | 'user'`, `kind: 'line' | 'ooc'`, `text: string`, `authorName: string | null`, `createdAt: number`(epoch ms). **`authorMbId`는 응답에 넣지 않는다.**
- 다음 페이지 커서는 `messages[0].id`다. 별도 `nextBefore` 필드는 요구에 없어 두지 않는다.
- 기본·최대 개수 30·100은 서버 상수(`MESSAGE_PAGE_LIMIT_DEFAULT`·`_MAX`)가 단일 소스다. `api.md`에 같은 값을 적고, ui가 값을 써야 하면 shared로 옮길지는 contract가 정한다.
- 라우트가 zod로 쿼리를 미리 검증하더라도 실패 메시지와 코드는 §5와 같아야 한다(같은 쿼리에 두 가지 메시지가 나오지 않게).

## 10. 요구 추적표

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-MSG-001 🔒 | §2.1·§4·§5·§9 | SRV-T-060~070, [db.md](db.md) SRV-T-028·029 | ✅ |
| R-NFR-002 | §4, §8 수동 | 수동 curl 시간, [db.md](db.md) 수동 EXPLAIN | ✅(측정은 구현 후) |
| R-API-004 | §2.1 `Message` 형태 | [db.md](db.md) SRV-T-029 | 부분(본문 검증은 contract) |
| R-MSG-002·004·005·008 | §2.2 | S2 | ❌(S2 예정) |
| R-MSG-003·006·007 | §2.2 | S3 | ❌(S3 예정) |

## 11. 설계 결정 노트

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-MSG-1 | `limit + 1`건 조회로 `hasMore` 판정 | 별도 `COUNT` 쿼리 | 쿼리 1개 절약, 읽기 행 최소 |
| D-MSG-2 | 범위 밖 `limit`은 잘라 주지 않고 400 | 100으로 자르기 | 요구 "최대 100"을 조용히 바꾸지 않는다. 계약이 명확해진다 |
| D-MSG-3 | 입력 검증 → DB 순서, 존재 확인과 페이지 조회는 병렬 | 존재 확인 후 조회(직렬) | 잘못된 입력은 DB 비용 0, 정상 요청은 왕복 1회 수준 |
| D-MSG-4 | 범위·정수 판정의 단일 소스를 서비스에 둔다 | 라우트 zod에 범위 규칙 | 규칙(30·100)은 R-MSG-001(server 요구)이다. 라우트는 문자열→숫자 변환만 해 얇게 유지(R-API-007) |
| D-MSG-5 | 시드 SQL을 `server/test/fixtures/`에 둔다 | 시드 없음 | S1에는 쓰기 API가 없어 R-NFR-002 측정과 읽기 전용 화면 캡처에 데이터가 필요하다. 로컬 전용 |

확인 필요:

- 없음.
