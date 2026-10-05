# messages 모듈 설계

- 상태: S1 확정(구현 동기화) · S2 초안 · 최종 갱신: 2026-10-05
- 묶음: S1 = R-MSG-001(히스토리 페이지). S2 = R-MSG-002(유저 발화·지시 저장) · R-MSG-004(수정) · R-MSG-005(삭제) · R-MSG-008(권한). S3 = R-MSG-003·006·007(speak·regenerate·잠금 — §2.3에 시그니처만).
- 관련 문서: [db.md](db.md)(`messages` 저장소), [rooms.md](rooms.md)(`updated_at` 갱신 규칙), [auth.md](auth.md)(`Principal`·쓰기 미들웨어), [index.md](index.md)(서비스 컨테이너·에러 핸들러).

## 1. 목적

히스토리 조회는 두꺼운 일기장을 뒤에서부터 한 묶음씩 넘겨 보는 일이다. 책갈피(`before`)를 끼운 자리 바로 앞의 몇 장(`limit`)을 펼치되, 오래된 장부터 보여 주고 더 앞장이 남았는지(`hasMore`)를 알려 준다. 쓰기는 일기장에 한 줄을 적거나(유저 발화·지시), 적힌 줄을 고치거나 지우는 일이다. 줄을 적을 때 AI는 부르지 않는다 — AI가 말하는 것은 캐릭터 버튼(S3)뿐이다.

| 요구ID | 내용 |
|---|---|
| R-MSG-001 🔒 | `before`·`limit`(기본 30, 최대 100), 오래된→새 순, `hasMore`. 누구나 |
| R-MSG-002 🔒 | 유저 발화/지시: `text` 1~2000자, `ooc` boolean, speaker `user`, kind `ooc ? 'ooc' : 'line'`, `author_mb_id`·`author_name`, **AI 호출 없음**, 토큰 필요 |
| R-MSG-004 🔒 | 수정: `text` 1~2000자, 캐릭터·유저 메시지 모두, 토큰 필요 |
| R-MSG-005 🔒 | 삭제, 토큰 필요 |
| R-MSG-008 (확인 필요) | 수정·삭제는 작성자 제한 없이 등급 통과자 누구나 |
| R-AUTH-004 | `author_name` = `Principal.displayName` |
| R-ROOM-005 | 추가·수정·삭제 시 방 `updated_at` 갱신 |
| R-NFR-002 · R-API-004 | 첫 페이지 1초 이내, camelCase·epoch ms·메시지 id 정수 |

## 2. 공개 API

```ts
// server/src/messages/index.ts
import type { Principal } from '../auth'
import type { Db, Message } from '../db'

export type { Message }

/** R-MSG-001 */
export const MESSAGE_PAGE_LIMIT_DEFAULT = 30
export const MESSAGE_PAGE_LIMIT_MAX = 100
/** R-MSG-002·004 본문 최대 글자 수(코드 포인트) */
export const MESSAGE_TEXT_MAX = 2000

export type MessagePageQuery = { before?: number; limit?: number }
/** = @shared/types MessagesPage */
export type MessagePage = { messages: Message[]; hasMore: boolean }
export type NormalizedPageQuery = { limit: number; before?: number }

/** 작성자 기록에 필요한 Principal 의 일부. 라우트는 getPrincipal(c) 를 그대로 넘긴다 */
export type MessageAuthor = Pick<Principal, 'mbId' | 'displayName'>
export type UserMessageInput = { text: string; ooc: boolean }
export type MessageTextInput = { text: string }

export type MessagesService = {
  /** 방 히스토리 한 페이지 (S1) */
  listMessages: (roomId: string, query: MessagePageQuery) => Promise<MessagePage>
  /** 유저 발화(line)·지시(ooc)를 저장. LLM 을 부르지 않는다 (S2) */
  addUserMessage: (roomId: string, input: UserMessageInput, author: MessageAuthor) => Promise<Message>
  /** 본문만 바꾼다. speaker·kind·작성자·createdAt 유지 (S2) */
  editMessage: (messageId: number, input: MessageTextInput) => Promise<Message>
  /** 실삭제 (S2) */
  deleteMessage: (messageId: number) => Promise<void>
}

export type MessagesDeps = { db: Db; now: () => number }

export const createMessagesService = (deps: MessagesDeps): MessagesService

// server/src/messages/page.ts — 순수 (S1)
export const normalizePageQuery = (query: MessagePageQuery): NormalizedPageQuery
export const toPage = (rowsDesc: readonly Message[], limit: number): MessagePage

// server/src/messages/text.ts — 순수 (S2)
/** trim 후 코드 포인트 1~2000자면 trim 결과를, 아니면 AppError VALIDATION_ERROR */
export const normalizeMessageText = (raw: string): string
/** 메시지 id 로 쓸 수 있는 값인가 (1 이상 안전 정수) */
export const isMessageId = (id: number): boolean
```

| 이름 | 인자 | 반환 | 실패 조건(에러 코드) | 요구ID |
|---|---|---|---|---|
| `createMessagesService` | `{ db, now }` | `MessagesService` | — | R-MSG-001·002·004·005 |
| `listMessages` | `roomId, query` | `Promise<MessagePage>` | `limit` 1~100 정수 아님 / `before` 1 이상 안전 정수 아님 → `VALIDATION_ERROR`(400, DB 전). 방 없음 → `NOT_FOUND`(404) | R-MSG-001 |
| `addUserMessage` | `roomId, { text, ooc }, author` | `Promise<Message>` | 본문 규칙 위반 → `VALIDATION_ERROR`(400, DB 전). 방 없음 → `NOT_FOUND`(404) | R-MSG-002 · R-AUTH-004 · R-ROOM-005 |
| `editMessage` | `messageId, { text }` | `Promise<Message>` | id가 1 이상 안전 정수 아님 → `NOT_FOUND`(DB 전). 본문 위반 → `VALIDATION_ERROR`(DB 전). 메시지 없음 → `NOT_FOUND` | R-MSG-004·008 · R-ROOM-005 |
| `deleteMessage` | `messageId` | `Promise<void>` | id 형식 위반·메시지 없음 → `NOT_FOUND` | R-MSG-005·008 · R-ROOM-005 |
| `normalizePageQuery` / `toPage` | — | — | §2.1 | R-MSG-001 |
| `normalizeMessageText` | `raw` | `string` | `VALIDATION_ERROR` | R-MSG-002·004 |
| `isMessageId` | `id` | `boolean` | — | R-MSG-004·005 |

`Message` = `{ id: number; roomId: string; speaker: 'sebastian' | 'ciel' | 'user'; kind: 'line' | 'ooc'; text: string; authorName: string | null; createdAt: number }`(`@shared/types`, [db.md](db.md) §2.1). **`authorMbId`는 없다**(공개 응답에 그누보드 로그인 ID 노출 방지). 저장은 한다.

### 2.1 페이지 규칙 (S1, R-MSG-001)

| 규칙 | 값 |
|---|---|
| `limit` 생략 | 30 |
| `limit` 허용 | 정수 1~100. 넘으면 잘라 주지 않고 `VALIDATION_ERROR` |
| `before` 생략 | 가장 최신부터 |
| `before` 의미 | `id < before`인 메시지만(엄격히 작음). 다른 방의 id여도 숫자 커서로만 쓴다 |
| `before` 허용 | `Number.isSafeInteger(before) && before >= 1` |
| 정렬 | 응답 `messages`는 id 오름차순(오래된→새) |
| `hasMore` | 이 페이지보다 더 오래된 메시지가 있으면 `true` |
| 다음 페이지 | `before = messages[0].id`(별도 커서 필드 없음) |
| 빈 방 | `{ messages: [], hasMore: false }` |

### 2.2 쓰기 규칙 (S2)

| 항목 | 규칙 |
|---|---|
| 본문 정규화 | `raw.trim()`(앞뒤 공백·줄바꿈 제거, 중간 줄바꿈 유지). 저장·응답은 trim한 값(§11 D-MSG-7) |
| 본문 길이 | trim 후 **코드 포인트** 1~2000(`Array.from(s).length`). 위반 메시지 `메시지는 1~2000자로 입력해 주세요.` |
| `addUserMessage` 저장값 | `speaker: 'user'`, `kind: ooc ? 'ooc' : 'line'`, `text`, `author_mb_id: author.mbId`, `author_name: author.displayName`, `created_at: now()` |
| AI 호출 | 없음. `MessagesDeps`에 llm이 없다(구조로 보장). S3에서 llm 의존이 생기면 `addUserMessage`는 그것을 쓰지 않는다(SRV-T-145가 계속 지킨다) |
| `editMessage` | `text`만 교체. `speaker`·`kind`·`author_mb_id`·`author_name`·`created_at` 유지. 캐릭터 메시지도 같은 규칙 |
| `deleteMessage` | 실삭제. id는 재사용되지 않는다(`AUTOINCREMENT`) |
| 권한(R-MSG-008) | 작성자 검사 없음. 그래서 `editMessage`·`deleteMessage`는 `author`를 받지 않는다(§11 D-MSG-8) |
| 메시지 id | 서비스가 `isMessageId`로 판정. 아니면 DB 접근 없이 `NOT_FOUND`(`메시지를 찾을 수 없습니다.`) — 경로의 자원 식별자라 "없는 자원"으로 본다(§11 D-MSG-9) |
| `updated_at` | 세 쓰기 모두 같은 batch에서 방 `updated_at = now()`([rooms.md](rooms.md) §4.1) |

### 2.3 후속 묶음 예정 (S3 — 시그니처만, 상세는 S3 설계)

```ts
// waitUntil 은 라우트가 c.executionCtx.waitUntil 을 감싸 넘긴다(서비스는 Hono 객체를 모른다)
speak: (roomId: string, input: { character: 'sebastian' | 'ciel' }, author: MessageAuthor,
        background: { waitUntil: (task: Promise<unknown>) => void }) => Promise<Message>
regenerate: (messageId: number,
             background: { waitUntil: (task: Promise<unknown>) => void }) => Promise<Message>
```

| 이름 | 규칙 요지 | 업무 에러 | 요구ID |
|---|---|---|---|
| `speak` | 방당 동시 1건(`speaking_until` 조건부 UPDATE, 90초), LLM 1턴 생성, 저장은 `db.messages.insert` 재사용, 응답 뒤 요약은 `waitUntil` | `VALIDATION_ERROR`, `NOT_FOUND`, `SPEAK_IN_PROGRESS`, `LLM_FAILED`, `LLM_EMPTY`, `CONFIG_INVALID` | R-MSG-003·007 |
| `regenerate` | 캐릭터 메시지이고 방의 마지막 메시지일 때만, 교체는 `db.messages.updateText` 재사용 | `NOT_FOUND`, `NOT_CHARACTER_MESSAGE`, `NOT_LAST_MESSAGE`, `SPEAK_IN_PROGRESS`, `LLM_FAILED`, `LLM_EMPTY`, `CONFIG_INVALID` | R-MSG-006·007 |

- S3 설계에서 정할 것: speak의 `author` 인자 필요 여부(캐릭터 메시지는 `author_*`가 NULL — 누가 눌렀는지 저장 요구 없음), regenerate가 `MessageAuthor`를 받을지.

## 3. 내부 구조

| 파일 | 책임 |
|---|---|
| `server/src/messages/index.ts` | 문서주석 6항목, 서비스·상수·순수 함수·타입 재노출 |
| `server/src/messages/service.ts` | `listMessages`·`addUserMessage`·`editMessage`·`deleteMessage` 흐름(§4) |
| `server/src/messages/page.ts` | `normalizePageQuery`·`toPage`·페이지 상수 |
| `server/src/messages/text.ts` | `normalizeMessageText`·`isMessageId`·`MESSAGE_TEXT_MAX`·메시지 문구 상수 |
| `server/test/messages-page.test.ts` | SRV-T-060~065(순수 단위) |
| `server/test/messages.test.ts` | SRV-T-066~070(S1 D1 통합), SRV-T-140~150(S2) |
| `server/test/fixtures/seed-s1.sql` | 수동 확인·화면 캡처용 시드(§8.1) |

- 의존: `../db`, `../app-error`, `../auth`(타입 `Principal`만 — `import type`). `llm`·`memory`는 S3·S4. HTTP 객체를 모른다.
- 상태 없음. 상수는 §2의 세 개와 메시지 문구.

## 4. 비동기·동시성

```
GET /api/rooms/:id/messages?before&limit                        (S1)
  └ listMessages(roomId, { before, limit })
       ① normalizePageQuery ── 실패 → VALIDATION_ERROR (DB 전)
       ② Promise.all([ db.rooms.exists(roomId), db.messages.pageDesc(roomId, limit+1, before) ])
       ③ exists === false → NOT_FOUND
       ④ toPage(rowsDesc, limit)

POST /api/rooms/:id/user  [requireToken·rateLimitWrites]           (S2)
  └ addUserMessage(roomId, { text, ooc }, getPrincipal(c))
       ① normalizeMessageText ── 실패 → VALIDATION_ERROR (DB 전)
       ② db.messages.insert({ roomId, speaker:'user', kind, text, authorMbId, authorName }, now())
            batch[ INSERT … SELECT … WHERE EXISTS(rooms.id) RETURNING …, UPDATE rooms SET updated_at ]  (원자적)
       ③ null → NOT_FOUND (방 없음 — 삭제와 경합해도 고아 없음)
  ◀ Message

PATCH /api/messages/:id  [미들웨어]
  └ editMessage(id, { text })
       ① isMessageId ── 아님 → NOT_FOUND (DB 전)   ② normalizeMessageText ── VALIDATION_ERROR
       ③ db.messages.updateText(id, text, now())  batch[ UPDATE messages … RETURNING, UPDATE rooms(해당 방) ]
       ④ null → NOT_FOUND

DELETE /api/messages/:id  [미들웨어]
  └ deleteMessage(id)
       ① isMessageId ── 아님 → NOT_FOUND
       ② db.messages.deleteById(id, now())  batch[ UPDATE rooms(해당 방), DELETE messages ]
       ③ false → NOT_FOUND
```

- 잠금 없음. 모든 쓰기가 D1 batch 하나(왕복 1회)라 "검사 후 쓰기" 틈이 없다.
  - 방 삭제와 발화 저장이 겹쳐도 INSERT가 "방이 있을 때만"이라 고아가 생기지 않는다.
  - 같은 메시지를 동시에 수정하면 나중 batch가 이긴다(마지막 쓰기 승리). 수정 이력은 요구에 없다.
  - S3 speak 잠금(`speaking_until`)은 수정·삭제를 막지 않는다. regenerate 중 대상이 삭제되면 `updateText`가 `null` → S3가 `NOT_FOUND`로 처리한다(S3 인계).
- 페이지 커서는 id 기준이라 그사이 메시지가 추가·삭제돼도 중복 없이 이어진다. 삭제된 메시지 뒤 페이지는 그 id가 빠진 채 이어진다.
- CPU: 최대 101행 매핑(조회), 본문 2000자 코드 포인트 세기(쓰기). R-NFR-005 안.

## 5. 에러 타입

| 에러 클래스 | shared 에러 코드 | HTTP | 한국어 메시지 | 원인 | 묶음 |
|---|---|---|---|---|---|
| `AppError` | `VALIDATION_ERROR` | 400 | `불러올 개수(limit)는 1~100 사이의 정수여야 합니다.` | `limit` 위반 | S1 |
| `AppError` | `VALIDATION_ERROR` | 400 | `기준 메시지 번호(before)가 올바르지 않습니다.` | `before` 위반 | S1 |
| `AppError` | `NOT_FOUND` | 404 | `방을 찾을 수 없습니다.` | 없는 방(조회·발화 저장) | S1·S2 |
| `AppError` | `VALIDATION_ERROR` | 400 | `메시지는 1~2000자로 입력해 주세요.` | 본문 trim 후 0자 또는 2001자 이상 | S2 |
| `AppError` | `NOT_FOUND` | 404 | `메시지를 찾을 수 없습니다.` | id 형식 위반·없는 메시지(수정·삭제) | S2 |
| (전파) D1 오류 | `INTERNAL` | 500 | `서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.` | D1 장애 | S1 |

- 토큰·등급·레이트리밋 에러는 라우트 미들웨어가 서비스 호출 전에 낸다([auth.md](auth.md) §5).
- 에러 메시지에 유저 입력·`mbId`를 넣지 않는다(로그 `errMessage`로 새지 않게).

## 6. 설정(env)

- 읽는 키: 없음. 쓰는 키: 없음. 30·100·2000은 요구 상수라 모듈 상수다. `now`는 서비스 컨테이너가 주입하는 시계다.

## 7. DB 스키마·마이그레이션

- 사용 테이블: `messages`(읽기·쓰기), `rooms`(존재 확인·`updated_at`). 정의는 [db.md](db.md) §7.1.
- 제약이 지키는 것: 유저 메시지의 `author_mb_id`·`author_name` NOT NULL, `speaker = 'user' OR kind = 'line'`, `length(text) >= 1`. 2000자 상한은 서비스 규칙(CHECK 없음 — D-DB-3).
- 인덱스: `idx_messages_room_id_id`. 새 마이그레이션 없음.

## 8. 테스트 계획

순수 함수는 `server/test/messages-page.test.ts`, 서비스는 `server/test/messages.test.ts`(workers pool D1 + 마이그레이션, [db.md](db.md) §8). `createMessagesService({ db: createDb(env.DB), now: () => NOW })`. 메시지 id는 INSERT 결과에서 얻고 절대값을 가정하지 않는다. 작성자 픽스처: `AUTHOR_A = { mbId: 'mb_a', displayName: '시엘 팬텀하이브' }`, `AUTHOR_B = { mbId: 'mb_b', displayName: '닉네임' }`.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-060 | `normalizePageQuery_applies_default_limit_30` | `{}` / `{ before: 5 }` | `{ limit: 30 }` / `{ limit: 30, before: 5 }` | R-MSG-001 |
| SRV-T-061 | `normalizePageQuery_rejects_limit_out_of_range` | `limit` 0·101 (1·100 통과) | `VALIDATION_ERROR` | R-MSG-001 |
| SRV-T-062 | `normalizePageQuery_rejects_non_integer_limit` | 1.5·`NaN`·`Infinity` | `VALIDATION_ERROR` | R-MSG-001 |
| SRV-T-063 | `normalizePageQuery_rejects_before_not_positive` | 0·-1 | `VALIDATION_ERROR` | R-MSG-001 |
| SRV-T-064 | `normalizePageQuery_rejects_non_safe_integer_before` | 1.5·`NaN`·`2 ** 53` | `VALIDATION_ERROR` | R-MSG-001 |
| SRV-T-065 | `toPage_returns_ascending_messages_and_hasMore` | 내림차순 `limit+1`·`limit`·0건 | 오름차순 + `true`/`false`/`[]` | R-MSG-001 |
| SRV-T-066 | `listMessages_pages_three_times_oldest_to_newest` | 70건, `limit` 30, 3회 | 41~70·11~40·1~10번째, `hasMore` true·true·false, 중복·누락 없음 | R-MSG-001 |
| SRV-T-067 | `listMessages_excludes_other_rooms` | 두 방 교차 삽입 | 대상 방만 | R-MSG-001 |
| SRV-T-068 | `listMessages_returns_empty_page_for_empty_room` | 0건 방 | `{ messages: [], hasMore: false }` | R-MSG-001 |
| SRV-T-069 | `listMessages_throws_NOT_FOUND_for_unknown_room` | 없는 id | `NOT_FOUND` | R-MSG-001 · R-ROOM-004 |
| SRV-T-070 | `listMessages_validates_before_touching_db` | `limit: 0`, 호출 시 실패하는 가짜 `Db` | `VALIDATION_ERROR`, `Db` 호출 0회 | R-MSG-001 |
| SRV-T-140 | `addUserMessage_stores_line_with_author_and_touches_room` | 방(`updated_at` 100), `{ text: ' 안녕 ', ooc: false }`, `AUTHOR_A`, now 999 | 반환 `speaker 'user'`·`kind 'line'`·`text '안녕'`·`authorName '시엘 팬텀하이브'`·`createdAt 999`, 키에 `authorMbId` 없음. DB 행 `author_mb_id = 'mb_a'`, 방 `updated_at = 999` | R-MSG-002 · R-ROOM-005 |
| SRV-T-141 | `addUserMessage_stores_ooc_kind_for_instruction` | `ooc: true` | `kind 'ooc'`, `speaker 'user'` | R-MSG-002 |
| SRV-T-142 | `addUserMessage_records_displayName_as_author_name` | `AUTHOR_A`(ch_name 쪽)·`AUTHOR_B`(nick 쪽) | 각 `authorName`이 `displayName`과 같음 | R-AUTH-004 |
| SRV-T-143 | `addUserMessage_validates_text_before_db` | `''`, `'  \n '`, 2001자, 이모지 2001개 / 통과: 2000자, 이모지 2000개, 중간 줄바꿈 | 위반은 `VALIDATION_ERROR` + 가짜 `Db` 호출 0회. 통과는 저장, 중간 `\n` 유지 | R-MSG-002 |
| SRV-T-144 | `addUserMessage_throws_NOT_FOUND_for_unknown_room_without_insert` | 없는 방 id | `NOT_FOUND`, `messages` 0행, 다른 방 `updated_at` 불변 | R-MSG-002 · R-DB-003 |
| SRV-T-145 | `addUserMessage_never_calls_fetch` | `vi.spyOn(globalThis, 'fetch')` 후 line·ooc 각 1회 | `fetch` 호출 0회(LLM 어댑터는 `fetch` 기반 — R-LLM-001) | R-MSG-002 수용 기준(LLM 0회) |
| SRV-T-146 | `editMessage_replaces_text_for_user_and_character_messages` | 유저 메시지(`mb_a`)·캐릭터 메시지 각각 수정, now 999 | `text` 교체(trim), `speaker`·`kind`·`authorName`·`createdAt` 유지, DB `author_mb_id` 유지, 방 `updated_at = 999` | R-MSG-004·008 · R-ROOM-005 |
| SRV-T-147 | `editMessage_rejects_bad_id_text_or_unknown_message` | id `0`·`-1`·`1.5`·`NaN` → `NOT_FOUND`(Db 0회), 본문 2001자 → `VALIDATION_ERROR`(Db 0회), 없는 id → `NOT_FOUND`(방 `updated_at` 불변) | 표대로 | R-MSG-004 |
| SRV-T-148 | `deleteMessage_removes_message_and_touches_room` | 메시지 3건 중 가운데 삭제, now 999 | 남은 2건, `listMessages`에서 빠짐, 방 `updated_at = 999`, 다른 방 불변 | R-MSG-005 · R-ROOM-005 |
| SRV-T-149 | `deleteMessage_throws_NOT_FOUND_for_bad_or_unknown_id` | `0`·`NaN`(Db 0회), 없는 id, 같은 id 두 번 | 전부 `NOT_FOUND` | R-MSG-005 |
| SRV-T-150 | `edit_and_delete_do_not_check_original_author` | `mb_a`가 쓴 유저 메시지를 `editMessage`·`deleteMessage`(작성자 인자 없음) | 둘 다 성공. 시그니처에 작성자 인자가 없음을 타입 테스트(`expectTypeOf`)로 고정 | R-MSG-008 |

- 에러 경로(061~064·069·070·143·144·147·149) 10 ≥ 정상 경로.
- R-MSG-008 "다른 mb_id로 수정 성공"의 HTTP 수준 확인은 contract 라우트 테스트(§9).

### 8.1 시드 픽스처 `server/test/fixtures/seed-s1.sql` (수동 확인·`/run-app` 캡처용)

로컬 D1에만 넣는다. **`--remote`에는 절대 적용하지 않는다.** S2부터는 쓰기 API로 데이터를 만들 수 있지만, 읽기 전용 화면·페이지 확인용으로 그대로 둔다.

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

수동 체크리스트:

- [ ] 시드 적용 후 `curl -s -o /dev/null -w "%{time_total}\n" "http://localhost:3000/api/rooms/00000000-0000-4000-8000-000000000001/messages"`가 1초 미만(R-NFR-002).
- [ ] 같은 주소의 응답이 30건·오름차순·`hasMore: true`, 각 항목에 `authorMbId` 없음.
- [ ] (S2) 토큰을 붙여 `POST /api/rooms/<방1>/user {"text":"테스트","ooc":true}` → 응답 `kind: "ooc"`, `authorName`이 토큰의 캐릭터명(없으면 닉네임). 이어 `GET /api/rooms`에서 방 1이 맨 위.
- [ ] (S2) `wrangler dev` 로그에 입력 본문(`테스트`)이 찍히지 않는다.

## 9. contract 요구 명세

| 서비스 | 엔드포인트 후보 | 입력 | 출력 | 에러 | 토큰 | 레이트리밋 | 이유 |
|---|---|---|---|---|---|---|---|
| `messages.listMessages(roomId, query)` | `GET /api/rooms/:id/messages?before=&limit=` | 경로 `id`(문자열 그대로), 쿼리는 `Number(문자열)` 변환만 | `MessagePage` | `VALIDATION_ERROR`(400), `NOT_FOUND`(404), `CONFIG_INVALID`, `INTERNAL` | ✕ | ✕ | R-MSG-001 |
| `messages.addUserMessage(roomId, { text, ooc }, getPrincipal(c))` | `POST /api/rooms/:id/user` | 경로 `id`(문자열), 본문 `{ text: string; ooc: boolean }` | `Message` | `VALIDATION_ERROR`(400), `NOT_FOUND`(404) + 공통 | ○ | ○ | R-MSG-002 |
| `messages.editMessage(Number(id), { text })` | `PATCH /api/messages/:id` | 경로 `id` → `Number()` 변환만, 본문 `{ text: string }` | `Message` | `VALIDATION_ERROR`(400), `NOT_FOUND`(404) + 공통 | ○ | ○ | R-MSG-004·008 |
| `messages.deleteMessage(Number(id))` | `DELETE /api/messages/:id` | 경로 `id` → `Number()` 변환만 | 없음(`void`) | `NOT_FOUND`(404) + 공통 | ○ | ○ | R-MSG-005·008 |
| `speak` (S3) | `POST /api/rooms/:id/speak` | `{ character }` | `Message` | §2.3 + 공통 | ○ | ○ | R-MSG-003 |
| `regenerate` (S3) | `POST /api/messages/:id/regenerate` | — | `Message` | §2.3 + 공통 | ○ | ○ | R-MSG-006 |

- 공통 = `TOKEN_REQUIRED`·`TOKEN_INVALID`(401), `LEVEL_TOO_LOW`(403), `RATE_LIMITED`(429), `CONFIG_INVALID`·`INTERNAL`(500). 미들웨어 순서·`getPrincipal`은 [auth.md](auth.md) §9.1.
- 라우트 zod는 **타입만**: `{ text: z.string(), ooc: z.boolean() }`, `{ text: z.string() }`. trim·길이(코드 포인트)는 서비스가 판정한다(zod `.min/.max`는 UTF-16 단위라 CHECK·서비스와 어긋난다 — D-MSG-4와 같은 원칙). `ooc`를 필수로 할지 기본값 `false`를 둘지는 contract가 정한다(서비스는 boolean을 받는다).
- 메시지 경로 `:id`는 라우트가 `Number(문자열)`로만 바꿔 넘긴다. 정수·범위 판정과 `NOT_FOUND`는 서비스 단일 소스다.
- `Message`에 `authorMbId`를 넣지 않는다(쓰기 응답 포함).
- R-MSG-008 확인: contract 라우트 테스트에서 토큰 A로 쓴 메시지를 **토큰 B(다른 `mb_id`)**로 수정·삭제해 성공함을 확인한다.
- 수정 응답에 "수정됨" 표시 필드는 요구가 없어 두지 않는다(api.md §호환성 표의 선택 필드 후보).

## 10. 요구 추적표

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-MSG-001 🔒 | §2·§2.1·§4·§5·§9 | SRV-T-060~070, [db.md](db.md) SRV-T-028·029 | ✅ |
| R-MSG-002 🔒 | §2·§2.2·§4·§9 | SRV-T-140~145, [db.md](db.md) SRV-T-124 | ✅ |
| R-MSG-004 🔒 | §2·§2.2·§4·§9 | SRV-T-146·147, [db.md](db.md) SRV-T-125 | ✅ |
| R-MSG-005 🔒 | §2·§2.2·§4·§9 | SRV-T-148·149, [db.md](db.md) SRV-T-128 | ✅ |
| R-MSG-008 (확인 필요) | §2.2·§9 | SRV-T-150, contract 다른 mb_id 테스트 | ✅(기본값) |
| R-AUTH-004 | §2.2 | SRV-T-142 | ✅ |
| R-ROOM-005 | §2.2·§4 | SRV-T-140·146·148 | ✅ |
| R-NFR-002 | §4, §8 수동 | 수동 curl | ✅(측정은 구현 후) |
| R-API-004 | §2 `Message` | [db.md](db.md) SRV-T-029 | 부분(본문 검증은 contract) |
| R-MSG-003·006·007 | §2.3 | S3 | ❌(S3 예정) |

## 11. 설계 결정 노트

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-MSG-1 | `limit + 1`건 조회로 `hasMore` | 별도 `COUNT` | 쿼리 1개 절약 |
| D-MSG-2 | 범위 밖 `limit`은 400 | 100으로 자르기 | 요구를 조용히 바꾸지 않는다 |
| D-MSG-3 | 검증 → DB, 존재 확인과 페이지 조회 병렬 | 직렬 | 잘못된 입력은 DB 비용 0 |
| D-MSG-4 | 범위·길이 판정의 단일 소스는 서비스 | 라우트 zod 규칙 | 규칙이 server 요구다. 라우트는 타입·변환만(R-API-007) |
| D-MSG-5 | 시드 SQL을 `server/test/fixtures/`에 | 시드 없음 | 읽기 전용 화면·R-NFR-002 측정용. 로컬 전용 |
| D-MSG-6 | 쓰기 서비스는 db 쓰기 함수 1회 호출(내부 batch에 `updated_at` 포함) | 서비스가 batch 조립 | [rooms.md](rooms.md) D-ROOM-2 개정과 같다 |
| D-MSG-7 | 본문은 앞뒤 trim 후 검사·저장 | 원문 그대로 저장, 공백뿐 허용 | 공백뿐인 메시지는 대화 기록·프롬프트(S3)에 빈 줄로 들어간다. R-ROOM-002의 trim 규칙과 일관. 중간 줄바꿈은 유지 |
| D-MSG-8 | `editMessage`·`deleteMessage`에 작성자 인자 없음 | `actor` 인자 | R-MSG-008 "누구나"를 구조로 보장. §9-5가 바뀌면 그때 인자 추가 |
| D-MSG-9 | 잘못된 메시지 id는 `NOT_FOUND` | `VALIDATION_ERROR` | 경로의 자원 식별자다. 방 id(아무 문자열 → 404)와 같은 취급 |
| D-MSG-10 | `addUserMessage`는 `Principal` 전체가 아닌 `Pick<Principal, 'mbId' \| 'displayName'>` | `Principal` | 필요한 두 필드만 의존. 테스트 픽스처가 간단하다 |
| D-MSG-11 | 발화 저장의 방 존재 확인을 INSERT 조건(`WHERE EXISTS`)에 넣음 | `exists` 후 INSERT | 왕복 1회, 방 삭제와 경합해도 외래 키 오류(500) 대신 `NOT_FOUND` |

확인 필요:

- R-MSG-008(§9-5) 기본값 "누구나"를 적용했다.
- D-MSG-7(본문 trim)은 요구 문구에 없다. 앞뒤 공백을 보존해야 하는 사용 사례가 있으면 알려 달라(그 경우에도 공백뿐인 본문은 거부를 권고).

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-05 | S1 초안 작성 |
| 2026-10-05 | S1 구현 동기화(상태 확정): 페이지 단위 테스트 위치 `server/test/messages-page.test.ts`, `MessagePage`는 `@shared/types` `MessagesPage` 별칭, `NormalizedPageQuery` 재노출. S2 설계: `addUserMessage`(S1 문서의 `appendUserMessage` 개명)·`editMessage`·`deleteMessage` 본문 확정, `MessagesDeps`에 `now`, `text.ts` 추가, `AuthContext` → `MessageAuthor`(Principal 일부), D-MSG-6~11 |

파급(공개 API 변경): `MessagesDeps`에 `now` 필수 추가 → 호출자 `server/src/services.ts`(`createServices`), `server/test/messages.test.ts` 11행·68행의 `createMessagesService({ db })`를 `{ db, now }`로 고친다. 라우트(`server/src/routes/messages.ts`)의 `listMessages` 호출은 영향 없다.
