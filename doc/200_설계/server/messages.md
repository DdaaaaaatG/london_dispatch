# messages 모듈 설계

- 상태: S1 확정(구현 동기화) · S2 초안 · S3 초안(§2.3·§4.2·§4.3·§8.2) · S3b 초안(§4.2 예산 게이트·§8.3) · S3c 구현 완료(§4.4·§8.4) · **S3d 구현 완료(2026-10-06, server 343/343, SRV-T-261~281 · §12 speak `'auto'` — 앞 절과 다르면 §12가 우선 · R-LLM-008 개정(이름 지목·선택 15초) 설계 반영)** · verify 후속 동기화(2026-10-07 — §12.2·§12.3 `pick` 반환 구조, §4.4·§8.4 SRV-T-292, §5 S3-R1·§9 S3-R2 문구) · **S4 초안(2026-10-07, §13 afterSpeak 훅 본체 = memory.summarizeIfNeeded · 등록 실패 삼킴 — 시그니처 불변)** · **S3f 설계 초안(2026-10-08, §14 `llm: () => Promise<Llm>` · `await deps.llm()` 한 줄씩 — 판정 순서 불변, SRV-T-355)** · 최종 갱신: 2026-10-08
- 묶음: S1 = R-MSG-001(히스토리 페이지). S2 = R-MSG-002(유저 발화·지시 저장) · R-MSG-004(수정) · R-MSG-005(삭제) · R-MSG-008(권한). S3 = R-MSG-003·006·007(speak·regenerate·방당 잠금) · R-ROOM-005(재작성 갱신) · R-NFR-001·003 · R-MEM-002(훅 자리만, S3 no-op). S3b = R-LLM-007 🔒 월 예산 게이트(speak·regenerate 잠금 전 `llm.ensureBudget()` — 사용량 누적은 llm 안, [llm.md](llm.md) §12).
- 관련 문서: [db.md](db.md)(`messages` 저장소), [rooms.md](rooms.md)(`updated_at` 갱신 규칙), [auth.md](auth.md)(`Principal`·쓰기 미들웨어), [index.md](index.md)(서비스 컨테이너·에러 핸들러), [llm.md](llm.md)(S3 프롬프트·제공사·재시도).

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
| R-MSG-003 🔒 (S3) | speak `{ character }`: 해당 캐릭터 1턴, 직전 발화자 무관, 저장·반환, 토큰 필요 |
| R-MSG-006 🔒 (S3) | regenerate: 캐릭터 메시지이고 방의 마지막 메시지일 때만 같은 캐릭터로 `text` 교체. 아니면 `409 NOT_LAST_MESSAGE`, 유저 메시지는 `400 NOT_CHARACTER_MESSAGE` |
| R-MSG-007 🔒 (S3) | speak·regenerate 방당 동시 1건. `rooms.speaking_until` 조건부 UPDATE 선점(만료 90초), 끝나면 해제, 실패 `409 SPEAK_IN_PROGRESS` |
| R-ROOM-005 (S3) | 재작성도 방 `updated_at` 갱신 |
| R-NFR-001 🔒 · R-NFR-003 🔒 (S3) | speak 70초 이내 종결 · 동시 speak 1건만 |
| R-MEM-002 🔒 (S3는 자리만) | speak 성공 응답 뒤 `ctx.waitUntil()` 후처리 훅. 요약 자체는 S4 |

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
  /** 캐릭터 1턴 생성·저장 (S3, §2.3) */
  speak: (roomId: string, input: SpeakInput, background: Background) => Promise<Message>
  /** 마지막 캐릭터 메시지를 같은 캐릭터로 다시 생성 (S3, §2.3) */
  regenerate: (messageId: number) => Promise<Message>
}

export type MessagesDeps = {
  db: Db
  now: () => number
  /** S3 */
  logger: Logger
  /** S3. config.contextMessages (1~100) */
  contextMessages: number
  /** S3. 지연 생성 — 부를 때 키를 확인한다(google + 키 없음 → ConfigError CONFIG_INVALID) */
  llm: () => Llm
  /** S3 자리. 없으면 no-op. S4 memory 가 채운다 */
  afterSpeak?: AfterSpeakHook
}

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

### 2.3 speak·regenerate (S3 — R-MSG-003·006·007)

```ts
// server/src/messages/generate.ts (S3) — index.ts 가 재노출
import type { SpeakBody } from '@shared/types'     // contract 가 추가: { character: CharacterId }
import type { Llm } from '../llm'
import type { Logger } from '../logger'

/** = @shared/types SpeakBody */
export type SpeakInput = SpeakBody
/** 응답 뒤 작업 등록기. 라우트가 c.executionCtx.waitUntil 을 감싸 넘긴다(서비스는 Hono 를 모른다) */
export type Background = { waitUntil: (task: Promise<unknown>) => void }
export type AfterSpeakEvent = { roomId: string; messageId: number }
/** speak 성공 뒤 waitUntil 로 실행되는 훅. 실패는 서비스가 잡아 로그만 남긴다 (R-MEM-002 자리) */
export type AfterSpeakHook = (event: AfterSpeakEvent) => Promise<void>

/** R-MSG-007: 잠금 만료 90초. R-NFR-001 상한 70초보다 길어 생성 중에는 만료되지 않는다 */
export const SPEAK_LOCK_MS = 90_000
```

| 이름 | 인자 | 반환 | 실패 조건(에러 코드, 판정 순서) | 요구ID |
|---|---|---|---|---|
| `speak` | `roomId, { character }, background` | `Promise<Message>` | ① `character`가 두 값 아님 → `VALIDATION_ERROR`(400, DB·LLM 전) ② 키 없음 → `CONFIG_INVALID`(500) ③ 방 없음 → `NOT_FOUND`(404) / 잠금 중 → `SPEAK_IN_PROGRESS`(409) ④ `LLM_FAILED`·`LLM_EMPTY`(502) ⑤ 저장 시 방 없음(생성 중 삭제) → `NOT_FOUND` | R-MSG-003·007 · R-ROOM-005 · R-NFR-001·003 · R-MEM-002(훅) |
| `regenerate` | `messageId` | `Promise<Message>` | ① id 형식 위반·메시지 없음 → `NOT_FOUND`(404) ② 유저 메시지 → `NOT_CHARACTER_MESSAGE`(400) ③ `CONFIG_INVALID` ④ 잠금 중 → `SPEAK_IN_PROGRESS` / 잠금 뒤 확인 시 뒤 메시지 있음 → `NOT_LAST_MESSAGE`(409) / 대상 사라짐 → `NOT_FOUND` ⑤ `LLM_FAILED`·`LLM_EMPTY` ⑥ 교체 시 대상 없음(생성 중 삭제) → `NOT_FOUND` | R-MSG-006·007 · R-ROOM-005 · R-NFR-001 |

규칙:

| 항목 | speak | regenerate |
|---|---|---|
| 캐릭터 | 요청의 `character` | 대상 메시지의 `speaker`(같은 캐릭터) |
| 직전 발화자 | 무관 — 같은 캐릭터 연속 허용(R-MSG-003) | — |
| 잠금 | 방 `roomId` | 대상의 방 `target.roomId` — speak와 **같은 잠금**(R-MSG-007) |
| 컨텍스트 | `pageDesc(roomId, contextMessages)` → 오래된→새 | `pageDesc(roomId, contextMessages + 1)`: 첫 행이 대상이어야 하고(마지막 판정), 나머지 `contextMessages`개 → 오래된→새. 대상 자신은 컨텍스트에서 뺀다 |
| 장기기억 | `db.memory.getSummary(roomId)` — 없거나 빈 값이면 프롬프트에서 생략 | 같음 |
| 프롬프트·후처리 | `buildSpeakPrompt` → `llm.complete` → `postprocessLine`([llm.md](llm.md) §7) | 같음 |
| 저장 | `db.messages.insert({ roomId, speaker: character, kind: 'line', text, authorMbId: null, authorName: null }, now())` — 방 `updated_at` 같은 batch | `db.messages.updateText(id, text, now())` — 방 `updated_at` 같은 batch(R-ROOM-005) |
| 작성자 | **저장하지 않는다**(`author_*` NULL — "누가 눌렀는지 저장" 요구 없음, §11 D-MSG-12) | 바꾸지 않는다(캐릭터 메시지는 원래 NULL) |
| 응답 뒤 | 성공 시 `afterSpeak`가 있으면 `background.waitUntil(…)`로 등록(S3는 없음 → 등록 0회) | 없음(요약 기준인 메시지 수가 늘지 않는다) |
| AI 호출 | 1~2회(재시도) | 1~2회 |

- **`author` 인자 없음**(S1·S2 문서의 예정 시그니처에서 뺐다). 캐릭터 메시지는 `author_*`가 NULL이고, 등급 확인·레이트리밋은 라우트 미들웨어가 이미 `Principal`로 끝낸다. 서비스가 쓸 곳이 없다(§11 D-MSG-12).
- **regenerate에 `MessageAuthor`·`background` 없음.** 작성자를 기록하지 않고 응답 뒤 작업도 없다(§11 D-MSG-13).
- `SpeakInput`은 계약 타입 재노출 관례(`@shared/types`)를 따른다. contract-implementer가 `SpeakBody`를 먼저 추가한다(S1과 같은 순서 — [llm.md](llm.md) 「contract 인계 요구 명세」).

## 3. 내부 구조

| 파일 | 책임 |
|---|---|
| `server/src/messages/index.ts` | 문서주석 6항목, 서비스·상수·순수 함수·타입 재노출 |
| `server/src/messages/service.ts` | `listMessages`·`addUserMessage`·`editMessage`·`deleteMessage` 흐름(§4) |
| `server/src/messages/page.ts` | `normalizePageQuery`·`toPage`·페이지 상수 |
| `server/src/messages/text.ts` | `normalizeMessageText`·`isMessageId`·`MESSAGE_TEXT_MAX`·메시지 문구 상수 |
| `server/src/messages/generate.ts` | (S3) `createGenerateOps(deps)` → `{ speak, regenerate }`, `withSpeakLock`(선점 → 작업 → finally 해제), `SPEAK_LOCK_MS`, 훅 실행기 `runAfterSpeak`. `service.ts`가 펼쳐 `MessagesService`를 만든다(파일 400줄·함수 50줄 한계 — 예상 160줄) |
| `server/test/messages-page.test.ts` | SRV-T-060~065(순수 단위) |
| `server/test/messages.test.ts` | SRV-T-066~070(S1 D1 통합), SRV-T-140~150(S2) |
| `server/test/messages-generate.test.ts` | SRV-T-191~209(S3, D1 + `FakeProvider` + 가짜 시계) |
| `server/test/fixtures/seed-s1.sql` | 수동 확인·화면 캡처용 시드(§8.1) |

- 의존: `../db`, `../app-error`, `../auth`(타입 `Principal`만 — `import type`), (S3) `../llm`(`Llm` 타입·`buildSpeakPrompt`·`postprocessLine`·`isCharacterId`), `../logger`(타입). `memory` 모듈은 import하지 않는다(S4 훅은 deps 주입). HTTP 객체를 모른다.
- 상태 없음. 상수는 §2의 세 개, `SPEAK_LOCK_MS`, 메시지 문구. 잠금은 D1 행(`rooms.speaking_until`)에만 있다(프로세스 메모리 잠금 금지).
- 컨테이너 연결(`services.ts`)은 [llm.md](llm.md) §3.3.

## 4. 비동기·동시성

### 4.1 조회·쓰기 흐름 (S1·S2)

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

### 4.2 speak·regenerate 흐름 (S3)

```
POST /api/rooms/:id/speak  [requireToken·rateLimitWrites]
  └ speak(roomId, { character }, background)
       ① isCharacterId(character) ── 아님 → VALIDATION_ERROR (DB·LLM 전)
       ② llm = deps.llm()          ── google + 키 없음 → ConfigError → 500 CONFIG_INVALID (잠금 전)
       ②b await llm.ensureBudget() ── 이번 달(KST) 추정 누적 ≥ 예산 → 429 LLM_BUDGET_EXCEEDED (S3b · 잠금 0회 · LLM 0회)
       ③ startMs = now(); untilMs = startMs + SPEAK_LOCK_MS
          db.rooms.acquireSpeakLock(roomId, untilMs, startMs)
            'missing' → NOT_FOUND(방)   'busy' → SPEAK_IN_PROGRESS
       ④ try {
            [rowsDesc, summary] = await Promise.all([ db.messages.pageDesc(roomId, contextMessages),
                                                      db.memory.getSummary(roomId) ])
            prompt = buildSpeakPrompt({ character, summary, history: rowsDesc 뒤집기 })
            raw    = await llm.complete(prompt)          ── LLM_FAILED / LLM_EMPTY  (재시도·66초 예산은 llm)
            text   = postprocessLine(raw)                ── LLM_EMPTY
            saved  = await db.messages.insert({ speaker: character, kind: 'line', author 둘 다 null … }, now())
            saved === null → NOT_FOUND(방 — 생성 중 삭제)
          } finally {
            await releaseQuietly(roomId, untilMs)   ── db.rooms.releaseSpeakLock, 실패는 warn 로그만(원래 결과·에러 유지)
          }
       ⑤ afterSpeak 있으면 background.waitUntil(runAfterSpeak({ roomId, messageId: saved.id }))   (S3: 없음)
       ⑥ logger.info('speak_done', { roomId, messageId, character, ms: now() − startMs })
  ◀ 201 Message

POST /api/messages/:id/regenerate  [requireToken·rateLimitWrites]
  └ regenerate(messageId)
       ① isMessageId ── 아님 → NOT_FOUND (DB 전)
       ② target = db.messages.getById(id) ── null → NOT_FOUND
          target.speaker === 'user' → NOT_CHARACTER_MESSAGE
       ③ llm = deps.llm()                ── CONFIG_INVALID
       ③b await llm.ensureBudget()       ── LLM_BUDGET_EXCEEDED (S3b · 대상 검사 뒤 · 잠금 전)
       ④ acquireSpeakLock(target.roomId, …)  'missing' → NOT_FOUND(메시지)  'busy' → SPEAK_IN_PROGRESS
       ⑤ try {
            [rowsDesc, summary] = Promise.all([ pageDesc(roomId, contextMessages + 1), getSummary(roomId) ])
            head = rowsDesc[0]
            head 없음 또는 head.id < id → NOT_FOUND(대상 삭제됨)
            head.id > id               → NOT_LAST_MESSAGE
            prompt = buildSpeakPrompt({ character: target.speaker, summary, history: rowsDesc.slice(1) 뒤집기 })
            text   = postprocessLine(await llm.complete(prompt))
            saved  = db.messages.updateText(id, text, now()) ── null → NOT_FOUND(생성 중 삭제)
          } finally { releaseQuietly(roomId, untilMs) }
       ⑥ logger.info('regenerate_done', { roomId, messageId, character, ms })
  ◀ 200 Message
```

- 잠금 선점 → 작업 → 해제는 `withSpeakLock(roomId, onMissing, task)` 하나로 두 흐름이 공유한다(try/finally가 한 곳).
- (S3b) `ensureBudget`은 **키 확인 다음·잠금 선점 전**이다. 초과면 D1 읽기 1행만 쓰고 잠금·LLM·저장 0회로 끝난다(R-LLM-007 "LLM 호출 전 거절"). 판정 순서는 speak `VALIDATION → CONFIG → BUDGET → NOT_FOUND/409`, regenerate `NOT_FOUND → NOT_CHARACTER → CONFIG → BUDGET → 409`(D-MSG-20·21).
- (S3b) 사용량 누적은 `llm.complete` 안에서 시도마다 일어나며 messages는 모른다([llm.md](llm.md) §12.7). 누적 실패는 speak 결과를 바꾸지 않는다.
- (S3b) `MessagesDeps`·`GenerateDeps` 시그니처는 바뀌지 않는다. `Llm` 타입에 `ensureBudget`이 늘 뿐이다. `generate.ts`에 `await llm.ensureBudget()` 두 줄만 추가된다.
- `releaseQuietly`가 해제 실패를 삼키는 이유: 해제 실패(D1 장애)로 이미 저장된 대사를 500으로 바꾸면 화면이 재시도해 같은 대사가 두 번 생긴다. 잠금은 90초 뒤 스스로 풀린다. 로그 `speak_lock_release_failed { roomId, errName }`(warn).
- `runAfterSpeak`는 훅을 `try/catch`로 감싸 `after_speak_failed { roomId, errName }`(warn)만 남긴다. `waitUntil`에 넘긴 promise는 항상 resolve한다(R-MEM-002 "실패해도 speak 응답은 성공").
- 시간 상한: 잠금 선점부터 해제까지 = D1 왕복(선점·조회·저장·해제) + LLM 단계(≤ 66초, [llm.md](llm.md) §4.2) ≤ 70초(R-NFR-001). `SPEAK_LOCK_MS` 90초는 이보다 20초 길다.
- 로그에 본문·프롬프트·요약을 남기지 않는다(`speak_done`·`regenerate_done`은 id·캐릭터·ms만). `mbId`도 남기지 않는다(서비스가 `Principal`을 받지 않는다 — 레이트리밋 로그가 이미 `mbId`를 가진다).

### 4.3 동시성·경합 (S3)

| 경합 | 결과 | 근거 |
|---|---|---|
| 같은 방 speak 2건 동시 | 하나만 선점, 나머지 `409 SPEAK_IN_PROGRESS`(R-NFR-003) | 조건부 UPDATE 1문장 — D1이 쓰기를 직렬 실행 |
| 같은 방 speak ∥ regenerate | 같은 잠금이라 한쪽 409 | R-MSG-007 |
| 다른 방 speak 2건 | 둘 다 진행 | 잠금은 방 단위 행 |
| speak ∥ 유저 발화(`addUserMessage`) | 둘 다 성공. 컨텍스트는 선점 직후 조회 시점까지라, 그 뒤 들어온 유저 발화는 이번 대사가 못 본다 | 유저 발화는 잠금을 쓰지 않는다(R-MSG-007 대상 아님) |
| regenerate ∥ 유저 발화 | 둘 다 성공 가능. 마지막 판정은 잠금 뒤 1회라, 생성 중 뒤에 유저 발화가 붙어도 교체는 된다 | 위와 같다. §11 확인 필요 |
| speak 중 방 삭제 | 저장 `insert`가 `null` → `NOT_FOUND`, 고아 없음, 해제는 0행(무해) | `INSERT … WHERE EXISTS`(D-DB-9) · [rooms.md](rooms.md) §11 인계 |
| regenerate 중 대상 삭제 | `updateText`가 `null` → `NOT_FOUND` | §4(S2 절) 인계 그대로 |
| regenerate 중 같은 메시지 수정(`editMessage`) | 나중 쓰기가 이긴다 | 수정은 잠금을 쓰지 않는다(S2 규칙 유지) |
| 잠금 만료(90초) 뒤 남은 요청의 해제 | 해제는 내 `untilMs`일 때만이라 남의 잠금을 지우지 않는다 | D-DB-15 |
| 클라이언트 연결 끊김으로 Worker 실행 취소 | `finally`가 못 돌 수 있다. 잠금은 최대 90초 뒤 풀리고 그동안 그 방 생성은 409. 대사 저장 여부는 취소 시점에 따른다 | Workers 동작. 수동 확인 대상(§8.2) |
| (S3b) 예산 직전, 다른 방 speak 여러 건 동시 | 모두 게이트 통과·진행, 예산을 약간 넘길 수 있다 | 게이트는 읽기만 한다. 허용·문서화([llm.md](llm.md) §12.8) |
| (S3b) 예산 초과 상태에서 유저 발화·수정·삭제·조회 | 모두 정상 | 게이트는 speak·regenerate에만 있다(R-LLM-007) |

### 4.4 S3c — 설정 읽기 (R-SET-003 · R-SET-006 · 개정 R-LLM-003)

- **구현 완료(2026-10-06)**: server 318/318 통과 · S3c 테스트 SRV-T-234~260(이 문서 몫 SRV-T-256~258).

캐릭터는 말하기 직전에 보관함에서 최신 대본을 꺼내 읽는다. 대본을 미리 복사해 두지 않으므로 주인이 고친 대본이 바로 다음 차례부터 쓰인다.

```ts
// server/src/messages/service.ts — MessagesDeps 에 추가 (generate.ts 의 GenerateDeps 도 같은 필드)
import type { PromptSettings } from '../llm'

  /** S3c. 잠금 선점 뒤 speak·regenerate 마다 1회 부른다(캐시 없음). 없으면 시드(llm DEFAULT_PROMPT_SETTINGS) */
  loadPromptSettings?: () => Promise<PromptSettings>
```

흐름 델타(§4.2의 ④·⑤ 안):

```
speak ④ try {
     [rowsDesc, summary, promptSettings] = await Promise.all([
         db.messages.pageDesc(roomId, contextMessages),
         db.memory.getSummary(roomId),
         loadPromptSettings(),            ── S3c. settings.loadForPrompt — D1 PK 1행 + 재검증. 훼손 행은 시드(에러 아님)
     ])
     prompt = buildSpeakPrompt({ character, summary, history }, promptSettings.profiles, promptSettings.common)
     …(이하 S3 그대로)

regenerate ⑤ try {
     [rowsDesc, summary, promptSettings] = Promise.all([ pageDesc(roomId, contextMessages + 1), getSummary(roomId), loadPromptSettings() ])
     …head 검사(NOT_FOUND·NOT_LAST_MESSAGE)는 그대로…
     prompt = buildSpeakPrompt({ character: target.speaker, summary, history }, promptSettings.profiles, promptSettings.common)
```

- **읽는 시점은 잠금 선점 뒤, LLM 호출 전**이다(02 §3). 그래서 `VALIDATION_ERROR`·`CONFIG_INVALID`·`LLM_BUDGET_EXCEEDED`·방 없음·`SPEAK_IN_PROGRESS`로 끝나는 speak는 설정을 읽지 않는다(SRV-T-258). regenerate의 `NOT_LAST_MESSAGE`·대상 삭제는 잠금 안에서 판정되므로 병렬 읽기 1회가 일어난다(허용).
- **캐시 없음.** 서비스·모듈 어디에도 설정을 보관하지 않는다. 매 speak·regenerate가 D1을 읽는다(R-SET-003 "저장 즉시 반영").
- **실패(api.md §15.12 N5):** `loadPromptSettings`의 D1 오류는 시드로 바뀌지 않고 `Promise.all`로 전파되어 500 `INTERNAL`이고, finally가 잠금을 푼다(기존 조회 실패와 같은 경로). 재검증 실패는 settings가 시드로 바꿔 돌려주므로 messages는 모른다. 잠금 해제 보증은 SRV-T-292가 버튼 speak·`'auto'` speak·regenerate 세 경로에서 단언한다(잠금 해제·제공사 호출 0·`waitUntil` 0, verify 후속 2026-10-07).
- **의존:** messages는 settings 모듈을 import하지 않는다. 함수 값만 deps로 받는다. 컨테이너가 `settings.loadForPrompt`를 넘긴다([index.md](index.md) §2.3.1).
- **기본값:** 없으면 `async () => DEFAULT_PROMPT_SETTINGS`([llm.md](llm.md) §3.4). `createMessagesService`를 직접 만드는 기존 테스트(`IDLE_GENERATE_DEPS` 사용처 등 10여 곳)가 수정 없이 통과한다. 운영 배선 누락은 SRV-T-256(`createServices` 경유)이 잡는다.
- 판정 순서(D-MSG-20·21)와 로그(`speak_done`·`regenerate_done`)는 바뀌지 않는다. 로그에 설정 version·본문을 싣지 않는다(R-SET-012).
- 시간 상한: D1 읽기 1회가 기존 두 읽기와 병렬이라 추가 지연은 거의 없다. 70초 예산(R-NFR-001) 영향 없음.

## 5. 에러 타입

| 에러 클래스 | shared 에러 코드 | HTTP | 한국어 메시지 | 원인 | 묶음 |
|---|---|---|---|---|---|
| `AppError` | `VALIDATION_ERROR` | 400 | `불러올 개수(limit)는 1~100 사이의 정수여야 합니다.` | `limit` 위반 | S1 |
| `AppError` | `VALIDATION_ERROR` | 400 | `기준 메시지 번호(before)가 올바르지 않습니다.` | `before` 위반 | S1 |
| `AppError` | `NOT_FOUND` | 404 | `방을 찾을 수 없습니다.` | 없는 방(조회·발화 저장) | S1·S2 |
| `AppError` | `VALIDATION_ERROR` | 400 | `메시지는 1~2000자로 입력해 주세요.` | 본문 trim 후 0자 또는 2001자 이상 | S2 |
| `AppError` | `NOT_FOUND` | 404 | `메시지를 찾을 수 없습니다.` | id 형식 위반·없는 메시지(수정·삭제) | S2 |
| (전파) D1 오류 | `INTERNAL` | 500 | `서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.` | D1 장애 | S1 |
| `AppError` | `VALIDATION_ERROR` | 400 | `캐릭터는 sebastian·ciel·auto 중 하나여야 합니다.`(S3d 문구 — `generate.ts` `CHARACTER_INVALID_MESSAGE`) | speak `character` 위반. **HTTP로는 닿지 않는다**: 라우트 zod `enum`이 먼저 걸러 응답은 기본 문구 `요청 형식이 올바르지 않습니다.`다(api.md §4.13·§15.9 S3-R1). 서비스 직접 호출(테스트·내부)용 안전망 | S3·S3d |
| `AppError` | `NOT_FOUND` | 404 | `방을 찾을 수 없습니다.` | speak 방 없음·생성 중 삭제 | S3 |
| `AppError` | `NOT_FOUND` | 404 | `메시지를 찾을 수 없습니다.` | regenerate id 형식 위반·없음·생성 중 삭제 | S3 |
| `AppError` | `SPEAK_IN_PROGRESS` | 409 | 기본 문구(`이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요.`) | 잠금 선점 실패 | S3 |
| `AppError` | `NOT_LAST_MESSAGE` | 409 | 기본 문구 | 대상 뒤에 메시지 있음 | S3 |
| `AppError` | `NOT_CHARACTER_MESSAGE` | 400 | 기본 문구 | 대상이 유저 메시지 | S3 |
| `AppError`(llm) | `LLM_FAILED` · `LLM_EMPTY` | 502 | 기본 문구 | [llm.md](llm.md) §5 — messages는 그대로 전파 | S3 |
| `ConfigError`(env) | `CONFIG_INVALID` | 500 | 기본 문구 | `deps.llm()`에서 `requireLlmApiKey` 실패 — 그대로 전파 | S3 |
| `AppError`(llm `usage.ts`) | `LLM_BUDGET_EXCEEDED` | 429 | 기본 문구(`이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.`) + `retryAfterSec` | `llm.ensureBudget()` 거절 — 그대로 전파 | S3b |

- 토큰·등급·레이트리밋 에러는 라우트 미들웨어가 서비스 호출 전에 낸다([auth.md](auth.md) §5).
- 에러 메시지에 유저 입력·`mbId`를 넣지 않는다(로그 `errMessage`로 새지 않게).
- (S3-R1, 2026-10-07) 위 `character` 위반 문구는 내부 id(`sebastian`·`ciel`·`auto`)를 문장에 담는다. 라우트 선검사 때문에 사용자 화면에는 나가지 않으므로 현재 소스 문구를 그대로 기록한다. 이 문구가 사용자에게 보일 경로가 생기면 내부 id 없는 문장으로 바꾼다(소스 변경 — server-implementer 몫, 현재 미적용).

## 6. 설정(env)

- 읽는 키: 없음. 쓰는 키: 없음. 30·100·2000은 요구 상수라 모듈 상수다. `now`는 서비스 컨테이너가 주입하는 시계다.
- (S3) `contextMessages`(= `CONTEXT_MESSAGES`, 기본 40)를 deps 값으로 받는다. LLM 키·모델·타임아웃은 `llm` 지연 생성 함수 안에 갇혀 있어 messages가 보지 않는다([llm.md](llm.md) §3.3). `SPEAK_LOCK_MS` 90000은 요구 상수(R-MSG-007)라 모듈 상수다.

## 7. DB 스키마·마이그레이션

- 사용 테이블: `messages`(읽기·쓰기), `rooms`(존재 확인·`updated_at`). 정의는 [db.md](db.md) §7.1.
- 제약이 지키는 것: 유저 메시지의 `author_mb_id`·`author_name` NOT NULL, `speaker = 'user' OR kind = 'line'`, `length(text) >= 1`. 2000자 상한은 서비스 규칙(CHECK 없음 — D-DB-3).
- 인덱스: `idx_messages_room_id_id`. 새 마이그레이션 없음.
- (S3) `rooms.speaking_until`(잠금), `memory.summary`(읽기만)를 추가로 쓴다. 둘 다 `0001_init.sql`에 있어 **마이그레이션 없음**([db.md](db.md) §2.3·D-DB-17). 캐릭터 메시지 행은 `speaker IN ('sebastian','ciel')`·`kind 'line'`·`author_* NULL`(CHECK 통과).

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

### 8.2 S3 테스트 — `server/test/messages-generate.test.ts`

준비: D1(workers pool) + `createMessagesService({ db, now, logger, contextMessages, llm })`. `llm`은 `() => createLlm({ provider: fake, timeoutMs: 60000, logger, now, sleep })`이고 `fake = new FakeProvider(steps)`. 시계는 가짜(`now`가 변수를 읽고 `sleep`·각본 함수가 올린다). 로그는 수집 sink. 동시성 테스트는 각본 함수가 외부 deferred를 기다리게 해 첫 요청이 잠금을 잡은 상태를 만든다.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-191 | `speak_saves_character_line_and_touches_room` | 방(`updated_at` 100), fake `'세바스찬: 분부대로.'`, now 999 | 반환 `speaker 'sebastian'`·`kind 'line'`·`text '분부대로.'`·`authorName null`·`createdAt 999`. DB `author_mb_id` NULL, 방 `updated_at 999`, `speaking_until` NULL | R-MSG-003 · R-ROOM-005 |
| SRV-T-192 | `speak_allows_same_character_twice_in_a_row` | `ciel` 2회 연속 | 둘 다 성공, 메시지 2건 모두 `ciel`, 두 번째 호출 컨텍스트에 첫 대사 포함 | R-MSG-003 |
| SRV-T-193 | `speak_sends_recent_context_with_summary_in_order` | 방 A 45건 + 방 B 3건, `contextMessages 40`, memory 행 `summary 'S'` / memory 행 없음 | `fake.calls[0].turns[0].text`에 `[지난 이야기 요약] S`와 방 A의 6~45번째만 오래된→새 순, 방 B 없음. memory 없으면 요약 줄 없음. `system`에 눌린 캐릭터 설정 | R-LLM-003 · R-MSG-003 |
| SRV-T-194 | `speak_validates_character_before_llm_and_db` | `{ character: 'meirin' }`(캐스팅), 호출 시 실패하는 가짜 `Db`·`llm` 스파이 | `VALIDATION_ERROR`, `Db` 0회, `llm()` 0회 | R-MSG-003 |
| SRV-T-195 | `speak_throws_NOT_FOUND_for_unknown_room_without_llm_call` | 없는 방 | `NOT_FOUND`, `fake.calls` 0, 메시지 0건 | R-MSG-003 |
| SRV-T-196 | `speak_throws_SPEAK_IN_PROGRESS_when_locked_and_retakes_after_expiry` | `speaking_until = now + 1` / `= now`(만료 경계) | 409 `SPEAK_IN_PROGRESS`, `fake.calls` 0, 값 불변 / 성공 | R-MSG-007 |
| SRV-T-197 | `speak_and_regenerate_throw_CONFIG_INVALID_only_when_called` | `llm`을 실제 컨테이너 방식으로 `google`·키 없는 `Config`에서 만든 것 | speak·regenerate 500 `CONFIG_INVALID`(`keys ['LLM_API_KEY']`), `speaking_until` NULL(잠금 전 실패). 같은 서비스의 `listMessages`·`addUserMessage`는 성공. `fake`+키 없음은 speak 성공 | R-ENV-003 |
| SRV-T-198 | `speak_releases_lock_and_saves_nothing_on_llm_failure` | 각본 `[http_5xx, http_5xx]` / `[blocked]` / `[{ text: '시엘: ' }]` | 각각 `LLM_FAILED` / `LLM_EMPTY` / `LLM_EMPTY`, 메시지 0건, `speaking_until` NULL, 방 `updated_at` 불변 | R-MSG-007 · R-LLM-004·005 |
| SRV-T-199 | `speak_concurrent_requests_allow_only_one` | 같은 방 speak 2건을 `Promise.allSettled`(첫 요청은 deferred 대기) / 다른 방 2건 | 같은 방: 정확히 1건 성공·1건 `SPEAK_IN_PROGRESS`, 해제 뒤 3번째 성공. 다른 방: 둘 다 성공 | R-NFR-003 · R-MSG-007 |
| SRV-T-200 | `speak_returns_NOT_FOUND_when_room_deleted_during_generation` | 각본 함수가 `db.rooms.deleteCascade(roomId)` 후 텍스트 반환 | `NOT_FOUND`, `messages`에 그 방 행 0(고아 없음), 예외 없이 해제 시도 | R-MSG-003 · R-ROOM-004 |
| SRV-T-201 | `speak_keeps_result_when_lock_release_fails` | `releaseSpeakLock`만 reject하는 `Db` 래퍼, 성공 각본 / 실패 각본(`http_4xx`) | 성공: 메시지 반환·저장됨 + `speak_lock_release_failed` warn 1건. 실패: 원래 `LLM_FAILED` 유지 + 같은 warn | R-MSG-007 |
| SRV-T-202 | `speak_schedules_afterSpeak_via_waitUntil_only_on_success` | `afterSpeak` 스파이 + `waitUntil` 스파이: 성공 / LLM 실패 / 훅 reject / 훅 없음 | 성공: `waitUntil` 1회, 넘긴 promise await 후 훅이 `{ roomId, messageId }`로 1회. 실패: 0회. 훅 reject: promise는 resolve, `after_speak_failed` warn. 훅 없음: `waitUntil` 0회 | R-MEM-002(자리) |
| SRV-T-203 | `regenerate_replaces_last_character_message_text` | 유저 발화 → 세바스찬(마지막), fake `'세바스찬: 다시 말씀드리지요.'`, now 999 | 같은 `id`·`speaker`·`kind`·`createdAt`, `text '다시 말씀드리지요.'`, 방 `updated_at 999`, 컨텍스트에 유저 발화는 있고 대상 원문은 없음, 마지막 줄 `다음 발화자: 세바스찬.`으로 시작, 잠금 해제 | R-MSG-006 · R-ROOM-005 |
| SRV-T-204 | `regenerate_rejects_user_message_with_NOT_CHARACTER_MESSAGE` | 유저 메시지 id | 400 `NOT_CHARACTER_MESSAGE`, `fake.calls` 0, `speaking_until` NULL | R-MSG-006 |
| SRV-T-205 | `regenerate_rejects_non_last_with_NOT_LAST_MESSAGE` | 세바스찬 → 유저 발화, 세바스찬 id로 | 409 `NOT_LAST_MESSAGE`, `fake.calls` 0, 원문 불변, 잠금 해제 | R-MSG-006 |
| SRV-T-206 | `regenerate_throws_NOT_FOUND_for_bad_unknown_or_deleted_target` | id `0`·`NaN`(Db 0회), 없는 id, 각본 함수가 대상 `deleteById` 후 텍스트 반환 | 전부 `NOT_FOUND`, 마지막 경우 잠금 해제·메시지 0건 | R-MSG-006 |
| SRV-T-207 | `regenerate_shares_speak_lock` | 선점된 방에서 regenerate / regenerate 진행 중(deferred) 같은 방 speak | 409 `SPEAK_IN_PROGRESS` / speak 409, regenerate 성공 | R-MSG-007 |
| SRV-T-208 | `speak_finishes_within_70s_budget_on_repeated_timeouts` | 가짜 시계, 각본 `[timeout(+60000), timeout(+5000)]` | `LLM_FAILED`, 선점부터 응답까지 시계 경과 ≤ 70000(D1은 시계를 안 올림 → 실제 ≤ 66000), 잠금 `untilMs = 선점 + 90000` > 선점 + 70000, 해제됨 | R-NFR-001 |
| SRV-T-209 | `addUserMessage_and_edit_never_create_llm` | `llm` 스파이 thunk로 `addUserMessage`·`editMessage`·`deleteMessage`·`listMessages` | `llm()` 호출 0회(SRV-T-145의 `fetch` 0회와 함께) | R-MSG-002 |

- 에러 경로(194~201·204~208) 13 ≥ 정상 경로 6.
- 수동 체크리스트(S3):
  - [ ] 로컬 `LLM_PROVIDER=fake`로 `/run-app` → 두 버튼이 각 캐릭터 말풍선을 만들고, 재작성은 마지막 캐릭터 메시지에서만 성공.
  - [ ] 두 브라우저 탭에서 같은 방 버튼을 거의 동시에 눌러 한쪽 409 안내(R-NFR-003).
  - [ ] speak 중 탭을 닫은 뒤 다른 탭에서 같은 방 speak → 최대 90초 동안 409, 이후 성공(§4.3 연결 끊김 행 확인).
  - [ ] `wrangler dev` 로그 `speak_done`에 본문·`mbId` 없음.

### 8.3 S3b 테스트 — `server/test/messages-generate.test.ts`에 추가

준비: §8.2와 같고, `llm`을 `() => createLlm({ …, meter: createUsageMeter({ store: db.llmUsage, config: { monthlyBudgetKrw: 100000, priceInputUsdPerM: 0.3, priceOutputUsdPerM: 2.5, krwPerUsd: 1400 }, logger, now }) })`로 만든다. 예산 상태는 `llm_usage`에 직접 시드한다(`server/test/helpers.ts`에 `insertUsage(month, estKrw, calls?)` 추가 — [db.md](db.md) §3). 월 키는 `kstMonthKey(now())`.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-225 | `speak_rejects_LLM_BUDGET_EXCEEDED_before_lock_and_llm` | 이번 달 `est_krw 100000` 시드 / 같은 시드 + `google`·키 없는 `Config` | 429 `LLM_BUDGET_EXCEEDED`, `retryAfterSec === budgetRetryAfterSec(now)`, `fake.calls` 0, `acquireSpeakLock` 0회(Db 스파이), `speaking_until` NULL, 메시지 0건, 방 `updated_at`·`llm_usage` 행 불변 / `CONFIG_INVALID`(키 확인이 먼저) | R-LLM-007 · R-NFR-003 |
| SRV-T-226 | `regenerate_rejects_LLM_BUDGET_EXCEEDED_after_target_checks` | 같은 시드. 마지막 캐릭터 메시지 / 유저 메시지 id / 없는 id | 429·원문 불변·잠금 0회·`fake.calls` 0 / `NOT_CHARACTER_MESSAGE` / `NOT_FOUND`(대상 검사가 게이트보다 먼저) | R-LLM-007 · R-MSG-006 |
| SRV-T-227 | `speak_allows_just_below_budget_then_rejects_next` | 시드 `est_krw 99999.95`, speak 2회 | 1번째 201(누적 → 약 100000.062, `calls` 시드+1), 2번째 429·`fake.calls` 그대로 1 | R-LLM-007 |
| SRV-T-228 | `speak_accumulates_per_attempt_including_failed_responses` | 각본 `[LlmError('http_5xx', { usage: FAKE_USAGE }), { text }]` / `[LlmError('blocked', { usage: FAKE_USAGE })]` / `[LlmError('http_4xx')]` | 성공·`calls` +2·`est_krw` +0.224 / `LLM_EMPTY`·`calls` +1 / `LLM_FAILED`·행 없음 | R-LLM-007 |
| SRV-T-229 | `non_generate_paths_ignore_budget` | 예산 초과 시드에서 `listMessages`·`addUserMessage`·`editMessage`·`deleteMessage` | 모두 성공, `llm_usage` 불변, `llm()` 0회 | R-LLM-007 |
| SRV-T-230 | `speak_resumes_in_next_kst_month` | `2026-10` 행 `est_krw` = 예산, now = `2026-10-31T15:00:00.000Z`(11월 1일 00:00 KST) | speak 201, `2026-11` 행 `calls 1`, `2026-10` 행 불변 | R-LLM-007 |

- 에러 경로(225·226·228 일부) 3 ≥ 정상 경로(227·229·230) 3.
- 수동: [llm.md](llm.md) §12.12 수동 2항목(예산 1원 설정 → 429, 다른 쓰기는 성공).

### 8.4 S3c 테스트 — `server/test/messages-generate.test.ts`에 추가

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-256 | `speak_and_regenerate_use_settings_saved_just_before` | `createServices`(fake 제공사, `OWNER_MB_IDS: 'owner_test'`)로 `settings.put`(persona·speech에 감시 문구 A) → speak → 다시 `put`(감시 문구 B) → 같은 대사 regenerate | 첫 FakeProvider 호출 system에 A 포함, 둘째 호출 system에 B 포함·A 없음(캐시 없음 증명) | R-SET-003 · R-SET-006 |
| SRV-T-257 | `speak_uses_seed_when_settings_row_corrupted` | `character_settings`에 `json = '{{'` 행을 직접 INSERT → speak | 201, system = 시드 기반 문자열([llm.md](llm.md) SRV-T-252 기대와 같음), error 로그 `character_settings_invalid` 정확히 1건, 로그에 행 본문 없음 | R-SET-003 · R-SET-012 |
| SRV-T-258 | `settings_read_only_after_lock_acquired` | `loadPromptSettings` 스파이. speak: 잘못된 character / google + 키 없음 / 예산 초과 / 방 없음 / 잠금 busy / 정상. regenerate: 유저 메시지 대상(`NOT_CHARACTER_MESSAGE`) / 정상 | 실패 경로 호출 0회, 정상 경로 각 1회 | R-SET-003 · R-LLM-007 |
| SRV-T-292 | `settings_read_failure_inside_lock_releases_lock_and_skips_llm` (verify 후속 S3c SRV-001) | `loadPromptSettings`가 throw. 버튼 speak `ciel` / `'auto'` speak / regenerate(캐릭터 대사) | 셋 다 같은 에러로 reject(HTTP로는 500 `INTERNAL`), 매번 잠금 해제(`speaking_until` NULL), FakeProvider 호출 0(선택·발화 모두), `waitUntil` 0 | R-SET-003 · R-MSG-003 · api.md §15.12 N5 |

- 기존 SRV-T-191~209·S3b 테스트는 수정하지 않는다(`loadPromptSettings` 선택 필드).

## 9. contract 요구 명세

| 서비스 | 엔드포인트 후보 | 입력 | 출력 | 에러 | 토큰 | 레이트리밋 | 이유 |
|---|---|---|---|---|---|---|---|
| `messages.listMessages(roomId, query)` | `GET /api/rooms/:id/messages?before=&limit=` | 경로 `id`(문자열 그대로), 쿼리는 `Number(문자열)` 변환만 | `MessagePage` | `VALIDATION_ERROR`(400), `NOT_FOUND`(404), `CONFIG_INVALID`, `INTERNAL` | ✕ | ✕ | R-MSG-001 |
| `messages.addUserMessage(roomId, { text, ooc }, getPrincipal(c))` | `POST /api/rooms/:id/user` | 경로 `id`(문자열), 본문 `{ text: string; ooc: boolean }` | `Message` | `VALIDATION_ERROR`(400), `NOT_FOUND`(404) + 공통 | ○ | ○ | R-MSG-002 |
| `messages.editMessage(id, { text })` | `PATCH /api/messages/:id` | 경로 `id` → `messageIdParam`(10진 숫자 문자열만 `Number()`, 그 밖은 `NaN`), 본문 `{ text: string }` | `Message` | `VALIDATION_ERROR`(400), `NOT_FOUND`(404) + 공통 | ○ | ○ | R-MSG-004·008 |
| `messages.deleteMessage(id)` | `DELETE /api/messages/:id` | 경로 `id` → `messageIdParam`(10진 숫자 문자열만 `Number()`, 그 밖은 `NaN`) | 없음(`void`) | `NOT_FOUND`(404) + 공통 | ○ | ○ | R-MSG-005·008 |
| `messages.speak(id, body, { waitUntil: p => c.executionCtx.waitUntil(p) })` (S3) | `POST /api/rooms/:id/speak` | 경로 `id`(문자열), 본문 `SpeakBody = { character: 'sebastian' \| 'ciel' }` | **201** `Message` | `VALIDATION_ERROR`(400), `CONFIG_INVALID`(500), `NOT_FOUND`(404), `SPEAK_IN_PROGRESS`(409), `LLM_BUDGET_EXCEEDED`(429, S3b), `LLM_FAILED`·`LLM_EMPTY`(502) + 공통 | ○ | ○ | R-MSG-003·007 · R-LLM-007 |
| `messages.regenerate(id)` (S3) | `POST /api/messages/:id/regenerate` | 경로 `id` → `messageIdParam`(10진 숫자 문자열만 `Number()`, 그 밖은 `NaN`), 본문 없음(읽지 않음) | **200** `Message` | `NOT_FOUND`(404), `NOT_CHARACTER_MESSAGE`(400), `CONFIG_INVALID`(500), `SPEAK_IN_PROGRESS`·`NOT_LAST_MESSAGE`(409), `LLM_BUDGET_EXCEEDED`(429, S3b), `LLM_FAILED`·`LLM_EMPTY`(502) + 공통 | ○ | ○ | R-MSG-006·007 · R-LLM-007 |

- 공통 = `TOKEN_REQUIRED`·`TOKEN_INVALID`(401), `LEVEL_TOO_LOW`(403), `RATE_LIMITED`(429), `CONFIG_INVALID`·`INTERNAL`(500). 미들웨어 순서·`getPrincipal`은 [auth.md](auth.md) §9.1.
- 라우트 zod는 **타입만**: `{ text: z.string(), ooc: z.boolean() }`, `{ text: z.string() }`. trim·길이(코드 포인트)는 서비스가 판정한다(zod `.min/.max`는 UTF-16 단위라 CHECK·서비스와 어긋난다 — D-MSG-4와 같은 원칙). `ooc`를 필수로 할지 기본값 `false`를 둘지는 contract가 정한다(서비스는 boolean을 받는다).
- 메시지 경로 `:id`는 라우트(`messageIdParam`, api.md §4.5)가 10진 숫자로만 된 문자열이면 `Number()`로, 아니면 `NaN`으로 바꿔 넘긴다(`0x10`·`1e1`이 다른 메시지를 가리키지 않게 — S2-R1·S3-R2). 정수·범위 판정과 `NOT_FOUND`는 서비스 단일 소스다(`NaN`도 `NOT_FOUND`).
- `Message`에 `authorMbId`를 넣지 않는다(쓰기 응답 포함).
- R-MSG-008 확인: contract 라우트 테스트에서 토큰 A로 쓴 메시지를 **토큰 B(다른 `mb_id`)**로 수정·삭제해 성공함을 확인한다.
- 수정 응답에 "수정됨" 표시 필드는 요구가 없어 두지 않는다(api.md §호환성 표의 선택 필드 후보).
- (S3) 상세 계약(판정 순서·화면 타임아웃 75초 이상·`executionCtx` 지연 접근)은 [llm.md](llm.md) 「contract 인계 요구 명세」가 정본이다.

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
| R-MSG-003 🔒 | §2.3·§4.2·§9 | SRV-T-191~195·200 | ✅(설계) |
| R-MSG-006 🔒 | §2.3·§4.2·§9 | SRV-T-203~206 | ✅(설계) |
| R-MSG-007 🔒 | §2.3·§4.2·§4.3, [db.md](db.md) §2.3 | SRV-T-196·198·199·201·207, [db.md](db.md) SRV-T-187~189 | ✅(설계) |
| R-ROOM-005 (재작성) | §2.3 저장 행 | SRV-T-191·203 | ✅(설계) |
| R-NFR-001 🔒 | §4.2 시간 상한, [llm.md](llm.md) §4.2 | SRV-T-208, [llm.md](llm.md) SRV-T-183 | ✅(설계) |
| R-NFR-003 🔒 (speak 몫) | §4.3 | SRV-T-199 | ✅(설계) |
| R-ENV-003 (speak 시점) | §2.3 판정 ② | SRV-T-197 | ✅(설계) |
| R-MEM-002 🔒 | §2.3 `afterSpeak` 자리 | SRV-T-202 | 부분(S4에서 요약 구현) |
| R-LLM-007 🔒 (S3b 게이트) | §4.2 ②b·③b, §4.3, §5, §9 | SRV-T-225~230 | ✅(설계) |
| R-NFR-003 🔒 (S3b — 429 경로) | §4.2 ②b | SRV-T-225 | ✅(설계) |

### 10.1 S3c 추적

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-SET-003 🔒 (speak 반영) | §4.4 | SRV-T-256~258·292 | ✅(설계) |
| R-SET-006 🔒 · R-LLM-003 🔒(개정) | §4.4(입력 전달 — 조립은 [llm.md](llm.md) §7.3) | SRV-T-256 | ✅(설계) |

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
| D-MSG-12 (S3) | speak에 `author` 인자 없음, 캐릭터 메시지 `author_*` NULL | `MessageAuthor`를 받아 `author_*`에 누른 사람 기록 | 요구에 "누가 눌렀는지 저장"이 없다. 기록하면 `authorName`이 응답에 실려 화면이 캐릭터 말풍선에 유저 이름을 보일 위험이 있다. 등급·레이트리밋은 미들웨어가 이미 처리 |
| D-MSG-13 (S3) | regenerate에 `MessageAuthor`·`background` 없음 | speak와 같은 시그니처 | 작성자를 바꾸지 않고, 메시지 수가 늘지 않아 요약 훅도 필요 없다 |
| D-MSG-14 (S3) | 키 확인(`deps.llm()`)을 잠금 **전**에 | 잠금 뒤 | 설정 오류가 잠금 쓰기 비용을 쓰지 않는다. 판정 순서가 `VALIDATION → CONFIG → NOT_FOUND/409`로 고정된다 |
| D-MSG-15 (S3) | regenerate의 "마지막" 판정은 잠금 뒤 1회, 교체는 기존 `updateText`(조건 없음) | 교체 문장에 "아직 마지막일 때만" 조건 추가 | 유저 발화는 잠금 대상이 아니다(R-MSG-007). 요구 판정 시점은 요청 처리 시점이다. 조건부 교체는 새 SQL·새 실패 코드 처리가 필요해 요구 밖이다(아래 확인 필요) |
| D-MSG-16 (S3) | 생성 중 방 삭제(speak)·대상 삭제(regenerate)는 `NOT_FOUND` | 생성 결과를 버리고 성공 처리 / 500 | 자원이 없어졌다는 뜻이 정확하다. 고아 행이 생기지 않는다([rooms.md](rooms.md) §11 인계 처리) |
| D-MSG-17 (S3) | 해제는 항상 `finally`에서 시도(방이 삭제됐어도) | 방 삭제 시 해제 건너뛰기([rooms.md](rooms.md) §11 인계 문구) | 해제 문장은 행이 없으면 0행이라 무해하다. 분기를 없애 실수(잠금 누수)를 막는다 |
| D-MSG-18 (S3) | 해제 실패는 로그만 남기고 원래 결과·에러를 유지 | 해제 실패를 500으로 | 이미 저장된 대사를 실패로 보이면 화면 재시도로 중복 대사가 생긴다. 잠금은 90초 뒤 풀린다 |
| D-MSG-19 (S3) | speak·regenerate는 `generate.ts`로 분리 | `service.ts`에 추가 | `service.ts`가 400줄·함수 50줄 한계에 걸리지 않게. 잠금 공용 헬퍼를 한 파일에 둔다 |
| D-MSG-20 (S3b) | 예산 게이트는 키 확인 다음·잠금 선점 전 | 잠금 뒤 / 라우트 미들웨어 | R-LLM-007 "LLM 호출 전 거절"과 사전 확정(잠금 0회)을 지킨다. 초과 상태에서 잠금 쓰기·409 오판이 없다. 판단은 서비스에 둔다(라우트는 얇게). 키 확인을 먼저 두는 이유는 D-MSG-14와 같다(설정 오류가 가장 먼저 드러난다) |
| D-MSG-21 (S3b) | regenerate는 대상 검사(`NOT_FOUND`·`NOT_CHARACTER_MESSAGE`) 뒤에 게이트 | 게이트를 맨 앞에 | 다시 눌러도 안 되는 요청에 "다음 달에 다시" 안내를 하지 않는다. 대상 검사는 D1 읽기 1회라 비용이 같다. `NOT_LAST_MESSAGE`는 잠금 뒤 판정이라 게이트 다음이 된다 |

확인 필요:

- R-MSG-008(§9-5) 기본값 "누구나"를 적용했다.
- D-MSG-7(본문 trim)은 요구 문구에 없다. 앞뒤 공백을 보존해야 하는 사용 사례가 있으면 알려 달라(그 경우에도 공백뿐인 본문은 거부를 권고).
- (S3) D-MSG-15: regenerate 생성 중 유저가 발화를 덧붙이면 재작성된 캐릭터 메시지가 더는 마지막이 아니게 된다. 화면이 생성 중 입력창을 막는지(R-CHAT-005 "버튼 잠금"의 범위)와 함께 판단이 필요하다. 막지 않는다면 "교체 시점에도 마지막일 때만" 조건을 요구로 승격할 수 있다(db에 조건부 교체 함수 1개 추가).

### 11.1 S3c 결정

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-MSG-22 | 설정을 함수 값 deps(`loadPromptSettings`)로 받는다 | messages가 settings 모듈 import | settings → llm, messages → llm 단방향을 지킨다. 테스트에서 대체가 쉽다 |
| D-MSG-23 | 선택 deps + 시드 기본값 | 필수 deps | 기존 직접 생성 테스트 10여 곳 무수정. 배선은 SRV-T-256이 보장 |
| D-MSG-24 | 잠금 뒤 `Promise.all`로 병렬 읽기 | 잠금 전 읽기 · 직렬 | 02 §3 "잠금 뒤 요약·히스토리와 함께". 잠금 전에 읽으면 409로 끝날 요청도 읽고, 잠금 대기 중 저장된 값을 놓칠 수 있다 |

## 12. S3d — speak `'auto'` 자동 화자 선택 (R-MSG-009 🔒 · R-MSG-003 🔒 개정 · R-NFR-001 🔒 개정)

- 상태: 구현 완료(2026-10-06, server 343/343, SRV-T-261~281) · 설계 승인 ① 반영 · **R-LLM-008 개정(이름 지목·선택 15초) 반영 — 구현 완료**. 근거 `doc/200_설계/architecture/s3d-02-전반설계.md` §2~§4, 인계패킷 §1.
- **이 절이 앞 절보다 우선한다.** 대체 대상: §2.3 speak 실패 조건 ①(허용값), §4.2 ①·④·⑥(선택 단계 삽입·로그 필드). 버튼 경로(`'sebastian'`·`'ciel'`)의 동작·로그는 그대로다.

비유: 전송 버튼은 "다음 배우 아무나"라고 적은 쪽지다. 무대 감독(서버)이 대본 끝 몇 줄을 보고 받을 배우를 먼저 정한 뒤, 그 배우에게 평소 대본을 그대로 준다. 무대(방)는 한 번에 한 공연만 하므로 잠금은 버튼과 같은 것을 쓴다.

### 12.1 목적

| 요구ID | 이 모듈 몫 |
|---|---|
| R-MSG-009 🔒 | `'auto'`면 잠금 안에서 화자 1명을 골라 1턴 생성·저장. 잠금·월 상한·레이트리밋·에러는 speak와 같다. 응답 `speaker` = 고른 캐릭터 |
| R-MSG-003 🔒 개정 | 허용값 `'sebastian' \| 'ciel' \| 'auto'` |
| R-NFR-001 🔒 개정 | 선택 포함 70초. LLM 단계 66초를 선택과 발화가 나눠 쓴다(조립은 [llm.md](llm.md) §13.7) |
| R-LLM-008 (개정) | 이름 지목·선택 호출·파싱·기본 화자는 llm 몫(지목 규칙은 [llm.md](llm.md) §13.5a). 이 모듈은 결과만 받는다([llm.md](llm.md) §13) |
| R-MSG-007 🔒 · R-LLM-007 🔒 | 상속. 잠금 1회·예산 게이트 1회가 선택과 발화를 함께 덮는다 |
| R-AUTH-004 🔒 개정 | 유저 메시지 응답 `authorName` 고정은 [db.md](db.md) §12 투영. 이 모듈 코드 변경 없음 |

### 12.2 공개 API (시그니처 불변 — 입력 타입만 넓어짐)

```ts
// server/src/messages/generate.ts
import type { SpeakBody, SpeakTarget } from '@shared/types'
// contract-implementer 가 추가: SpeakTarget = CharacterId | 'auto' · SpeakBody = { character: SpeakTarget }

/** = @shared/types SpeakBody (S3d: character 가 SpeakTarget) */
export type SpeakInput = SpeakBody

export type GenerateOps = {
  /** 캐릭터 1턴 생성·저장. 'auto' 면 서버가 화자를 고른다. 반환 speaker 는 늘 CharacterId */
  speak: (roomId: string, input: SpeakInput, background: Background) => Promise<Message>
  regenerate: (messageId: number) => Promise<Message>   // 변경 없음
}

// ---- 모듈 내부(export 안 함) ----
/** 'auto' 허용 판정. 대소문자·공백 변형은 거절 */
const isSpeakTarget = (v: unknown): v is SpeakTarget => v === 'auto' || isCharacterId(v)

/** 이번 차례 캐릭터. selected 'request' = 버튼 */
type ResolvedSpeaker = {
  readonly character: CharacterId
  readonly selected: 'request' | 'mention' | 'model' | 'fallback'
  /** 선택 단계에 쓴 ms. 버튼은 0. llm.complete 의 spentMs 로 넘긴다 */
  readonly spentMs: number
}

/** 'auto' 만 llm.selectSpeaker 를 부른다. throw 하지 않는다(선택 실패는 기본 화자) */
const resolveSpeaker = async (
  llm: Llm,
  roomId: string,
  target: SpeakTarget,
  history: readonly Message[],
  settings: PromptSettings,
): Promise<ResolvedSpeaker>
```

| 이름 | 인자 | 반환 | 실패 조건(판정 순서) | 요구ID |
|---|---|---|---|---|
| `speak` | `roomId, { character: SpeakTarget }, background` | `Promise<Message>` (`speaker` = 요청 캐릭터 또는 고른 캐릭터) | ① `character`가 `'sebastian'`·`'ciel'`·`'auto'` 아님(`'Auto'`·`''`·`null`·생략·`'user'`) → `VALIDATION_ERROR`(400, DB·LLM 전) ② `CONFIG_INVALID`(500) ③ `LLM_BUDGET_EXCEEDED`(429, 잠금·LLM 0회) ④ 방 없음 `NOT_FOUND`(404) / 잠금 중 `SPEAK_IN_PROGRESS`(409) — 선택 호출 0회 ⑤ (`'auto'`) 선택 실패는 **에러 아님** → 기본 화자 ⑥ 발화 `LLM_FAILED`·`LLM_EMPTY`(502, 저장 0) ⑦ 저장 시 방 없음 `NOT_FOUND` | R-MSG-003·007·009 · R-NFR-001 · R-LLM-007 |

- 검증 문구: `CHARACTER_INVALID_MESSAGE`를 `'캐릭터는 sebastian·ciel·auto 중 하나여야 합니다.'`로 바꾼다. SRV-T-194는 코드만 단언한다(`codeOf`) — 무수정. 라우트 zod가 먼저 400을 내므로 이 문구는 서비스 직접 호출에서만 보인다.
- **새 에러 코드·서비스 메서드·deps·env 키·마이그레이션 0건.** `GenerateDeps`·`MessagesDeps`·`MessagesService` 불변.
- `speak` 본문이 50줄을 넘지 않게 `resolveSpeaker`를 분리한다(golden-principles §1).
- **`pick`은 잠금 안 작업의 반환값이다(verify 후속 SRV-003, 2026-10-07).** `withSpeakLock`의 작업 함수가 `{ saved, pick }`을 돌려주고 바깥은 구조 분해로 받는다. 바깥 `let pick`과 가짜 초기값(`sebastian`·`request`·0)은 없앴다. 잠금 안에서 throw하면 ⑧ 훅·⑨ `speak_done` 로그까지 가지 않으므로, 로그의 `character`·`selected`는 언제나 실제로 고른 값이다. 공개 API 변경 없음.

| 항목 | 버튼(`'sebastian'`·`'ciel'`) | `'auto'` |
|---|---|---|
| 캐릭터 | 요청값 | 잠금 안에서 `llm.selectSpeaker` 결과 — 이름 지목(호출 없음) → 모델 선택 → 실패면 기본 화자 |
| 컨텍스트 읽기 | `pageDesc(roomId, contextMessages)` 1회 | 같은 1회. 선택과 발화가 같은 `history`를 쓴다(선택 프롬프트는 끝 12개만 — llm 몫) |
| AI 호출 | 1~2회 | 1~3회(선택 0~1 — 이름 지목이면 0 · 발화 1~2) |
| 예산 게이트 | 잠금 전 1회 | 같은 1회 |
| 저장 | `speaker` = 요청 캐릭터, `author_*` NULL | `speaker` = 고른 캐릭터, `author_*` NULL. `'auto'` 흔적은 D1·응답에 없다 |
| 재작성 | 같은 캐릭터 | 같은 캐릭터. 선택을 다시 하지 않는다(R-MSG-006 불변) |
| 레이트리밋 | 라우트 `rateLimitWrites` 1회 | 같은 1회. 화면의 전송 1회 = `/user` 1 + `speak` 1 = **2회**(같은 분당 버킷, [auth.md](auth.md) §2.5) |
| 로그 | `speak_done{roomId, messageId, character, ms}` (변경 없음) | `speak_done{roomId, messageId, character, auto: true, selected: 'mention'\|'model'\|'fallback', ms}` + 기본 화자일 때만 `speaker_select_fallback{roomId, reason}`(warn — 지목·모델 선택이면 없음). 지목이면 `selected: 'mention'` |

### 12.3 흐름

```
POST /api/rooms/:id/speak { character: 'auto' }   [requireToken · rateLimitWrites — /user 와 같은 버킷]
  └ speak(roomId, { character: 'auto' }, background)
       ① isSpeakTarget ─ 아님 → VALIDATION_ERROR                (라우트 zod 가 먼저 400)
       ② llm = deps.llm() ─ CONFIG_INVALID                      (잠금 전)
       ③ await llm.ensureBudget() ─ 429 LLM_BUDGET_EXCEEDED     (잠금 0 · 선택 0 · 발화 0)
       ④ withSpeakLock(roomId) ─ 'missing' 404 / 'busy' 409     (선택 0)
          try {
            [rowsDesc, summary, settings] = Promise.all(pageDesc ∥ getSummary ∥ loadPromptSettings)   (기존과 같음)
            history = rowsDesc 뒤집기(오래된→새)
            ⑤ const pick = await resolveSpeaker(llm, roomId, 'auto', history, settings)   (잠금 안 지역 값)
                 └ llm.selectSpeaker({ history, profiles, common })   마지막 유저 글에 「세바스찬」·「시엘」 한쪽만 → 지목(호출 0 · usage 0) / 아니면 ≤ 15초 · 재시도 없음 · usage 누적 · throw 없음
                   choice.source === 'fallback' → logger.warn('speaker_select_fallback', { roomId, reason })
                 → { character: choice.speaker, selected: choice.source, spentMs: choice.ms }
            ⑥ prompt = buildSpeakPrompt({ character: pick.character, summary, history }, settings.profiles, settings.common)
               raw = await llm.complete(prompt, { spentMs: pick.spentMs })   ── 남은 예산(보통 ≥ 51초) · 재시도 1 · usage 누적 · 502
               text = postprocessLine(raw)
            ⑦ saved = db.messages.insert({ speaker: pick.character, kind: 'line', authorMbId: null, authorName: null }, now())
            return { saved, pick }     ── 잠금 밖으로는 반환값으로만 나간다(바깥 let·가짜 초기값 없음)
          } finally { releaseQuietly(roomId, untilMs) }
       ⑧ afterSpeak 있으면 waitUntil(기존과 같음)
       ⑨ logger.info('speak_done', { roomId, messageId, character: pick.character, auto: true, selected: pick.selected, ms })
  ◀ 201 Message (speaker = 고른 캐릭터)

버튼: ⑤ 에서 pick = { character: target, selected: 'request', spentMs: 0 }, 선택 호출 0회. ⑨ 는 기존 필드만 남긴다.
```

| 시간(R-NFR-001 🔒 70초) | 상한 |
|---|---|
| D1(잠금·읽기 3종·저장·해제) | 약 4초 여유(기존 가정 그대로) |
| 선택 | 이름 지목이면 0초. 아니면 `min(15초, llmTimeoutMs)` + usage 누적 1왕복 |
| 발화 | `66초 − spentMs` 안에서 1차 + (조건부) 1초 대기 + 2차 |
| 최악 | 선택 15초 타임아웃 + 발화 51초 타임아웃(재시도 생략) = 66초 → 전체 70초 |

### 12.4 동시성

- **선택은 잠금 안에서 한다.** 잠금 밖에서 고르면 같은 방 `'auto'` 두 건이 둘 다 선택 호출(비용)을 쓴 뒤 하나가 409가 된다. 잠금 안이면 진 쪽은 AI 0회로 409다. 또 선택이 본 기록과 발화가 본 기록이 같아진다.
- 잠금 만료 90초 > 70초 상한은 그대로 성립한다. `'auto'`·버튼·regenerate가 같은 `rooms.speaking_until`을 쓴다(R-MSG-007).
- 프로세스 메모리 상태 없음. `resolveSpeaker`는 지역 값만 쓴다.

### 12.5 에러

새 코드 없음. 선택 단계의 모든 실패(timeout·network·http_429·http_4xx·http_5xx·blocked·bad_response·응답 파싱 불가)는 llm 안에서 기본 화자로 바뀌고 이 모듈에는 성공으로 온다. 발화 실패는 §5 표 그대로(502). 저장 전 실패라 유저 메시지만 남고, 화면은 `'auto'` 재호출로 다시 시도한다.

### 12.6 설정(env) · DB

- 읽는 env 키 변경 없음. 선택 상수(15초·12개)는 llm 코드 상수([llm.md](llm.md) §13.2).
- 스키마·마이그레이션 없음. 기존 `rooms.speaking_until`·`messages`·`llm_usage`만 쓴다.

### 12.7 테스트 (`server/test/messages-generate.test.ts`에 추가 — D1 + FakeProvider + 가짜 시계)

FakeProvider 각본의 0번째는 선택 호출, 1번째부터 발화 호출이다. 단 마지막 유저 글에 「세바스찬」·「시엘」 중 한쪽만 있으면 선택 호출이 없어 0번째부터 발화다. SRV-T-270~276의 기록은 유저 글에 이름을 넣지 않는다.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-270 | `speak_auto_saves_model_choice_ciel` | 기록(시엘 1 · 유저 1 — 기본 화자라면 세바스찬), 각본 `[{text:'ciel'}, {text:'대사'}]` | 201 `speaker 'ciel'`(기본 화자와 다름 = 모델 선택 증명), `fake.calls` 2건, `calls[0].timeoutMs === 15000`, `calls[1].system`이 `buildSpeakPrompt({character:'ciel',…})`와 같다, `speak_done.auto === true`·`selected 'model'` | R-MSG-009 · R-LLM-008 |
| SRV-T-271 | `speak_auto_accepts_korean_choice_sebastian` | 기록(세바스찬 1 · 유저 1 — 기본 화자라면 시엘), 각본 `['세바스찬.', '대사']` | 201 `speaker 'sebastian'`, `selected 'model'`, warn 로그 0건 | R-MSG-009 · R-LLM-008 |
| SRV-T-272 | `speak_auto_falls_back_on_unparsable_choice` | 기록 끝 캐릭터 = 세바스찬, 각본 `['모르겠다', '대사']` | `speaker 'ciel'`, warn `speaker_select_fallback{roomId, reason:'unparsable'}` 1건, 로그 어디에도 `모르겠다`·유저 본문 없음 | R-LLM-008 · R-NFR-004 |
| SRV-T-273 | `speak_auto_falls_back_after_select_timeout_then_speaks` | 유저 메시지만 있는 방, 각본 0번 = 가짜 시계 +15000 후 `LlmError('timeout')`, 1번 = `'대사'` | 201 `speaker 'sebastian'`, `fake.calls` 2건(선택 재시도 없음), `reason 'timeout'` | R-LLM-008 · R-MSG-009 |
| SRV-T-274 | `speak_auto_records_usage_for_both_calls_and_gate_blocks_before_select` | meter 주입. ⓐ 정상 `'auto'` ⓑ 누적을 예산 이상으로 만든 뒤 `'auto'` | ⓐ `llm_usage` 누적 = `FAKE_USAGE` 2회분 ⓑ `LLM_BUDGET_EXCEEDED`, `fake.calls` 0, 잠금 0 | R-LLM-007 · R-MSG-009 |
| SRV-T-275 | `speak_auto_shares_speak_lock` | ⓐ 잠금 중인 방에 `'auto'` ⓑ 같은 방 `'auto'` ∥ `'sebastian'` 동시 | ⓐ `SPEAK_IN_PROGRESS`, `fake.calls` 0 ⓑ 정확히 1건 409, 성공 1건 | R-MSG-007 · R-MSG-009 |
| SRV-T-276 | `speak_auto_finishes_within_66s_llm_budget` | 가짜 시계. ⓐ 선택 +15000 timeout, 발화 1차 `input.timeoutMs`만큼 +후 timeout ⓑ 선택 +15000 timeout, 발화 1차 +1000 `network`, 2차 성공 | ⓐ `LLM_FAILED`, `calls[1].timeoutMs === 51000`, 2차 없음, 경과 ≤ 70000, 잠금 해제 ⓑ 201, `calls[2].timeoutMs === 49000` | R-NFR-001 · R-LLM-008 |
| SRV-T-277 | `speak_auto_then_regenerate_keeps_character_without_select` | `'auto'`로 `'ciel'` 저장 → 그 메시지 regenerate | regenerate 호출 1건(선택 없음), system = 시엘 프롬프트, `speaker 'ciel'` | R-MSG-006 · R-MSG-009 |
| SRV-T-278 | `speak_rejects_invalid_targets_before_llm_and_db` | `'Auto'`·`''`·`null`·`undefined`·`'user'`·`' auto'` | 모두 `VALIDATION_ERROR`, `fake.calls` 0, 잠금 0 | R-MSG-003 |
| SRV-T-281 | `speak_auto_mention_skips_select_call_and_still_speaks` — 파일 `messages-generate.test.ts` | 기록 끝 캐릭터 = 시엘(기본 화자라면 세바스찬). ⓐ 마지막 유저 글(line) `세바스찬, 차를 내와` ⓑ 마지막 유저 글(지시) `시엘이 대답하게 해`. 각본 `['대사']` | ⓐ `speaker 'sebastian'` ⓑ `speaker 'ciel'`. 각 `fake.calls` 1건(발화만, system = 해당 캐릭터 프롬프트), meter 기록 1회, `speak_done.selected 'mention'`, `speaker_select_fallback` 0건 | R-LLM-008 ① · R-MSG-009 |

**기존 테스트 영향(이 모듈 소관).**

| 파일 | TC | 바뀌는 단언 | 이유 |
|---|---|---|---|
| `server/test/messages.test.ts` | SRV-T-140 | `authorName: '시엘 팬텀하이브'` → `USER_DISPLAY_NAME` | [db.md](db.md) §12 투영 |
| `server/test/messages.test.ts` | SRV-T-142 | 이름을 `addUserMessage_stores_displayName_but_returns_fixed_name`으로 바꾼다. 응답 `authorName === USER_DISPLAY_NAME`, D1 `SELECT author_name` = `author.displayName`(두 작성자) | R-AUTH-004 개정 |
| `server/test/routes-write.test.ts` | API-T-061(301~322행) | 응답 `authorName` 두 곳 → `USER_DISPLAY_NAME`. 닉네임 경우는 D1 `author_name = '테스터'`를 직접 SELECT로 단언 | 같음. 02 §6에 따라 server-implementer가 고친다 |
| `server/test/messages-generate.test.ts` | SRV-T-191~209 · 225~230 · 256~258 | 무수정 | 버튼 경로·로그 필드 불변 |

**contract 쪽 요청(`server/test/routes-generate.test.ts` — contract-implementer 소유).** ① `'auto'` 201·응답 `speaker`가 두 캐릭터 중 하나 ② `'Auto'`·`''` 400 ③ **레이트리밋 공유**: 한도 2로 `/user` 201 → `speak 'auto'` 201 → 다음 `/user`가 `429 RATE_LIMITED`(전송 1회 = 2회 소모 증명).

### 12.8 contract 요구 명세

| 노출 | 입력 | 출력 | 에러 | 이유 |
|---|---|---|---|---|
| `speak` (E9 `POST /api/rooms/:id/speak` 확장) | `{ character: SpeakTarget }` | `201 Message`, `speaker`는 `CharacterId`만 | 기존 E9와 같음. 새 코드 0 | R-MSG-009. 가장 가까운 기존 엔드포인트 확장(02 §2 Z) |

- zod: `character` = `z.enum(['sebastian', 'ciel', 'auto'])`. 대소문자 변형·빈 문자열·`null` 400.
- api.md §4.12의 AI 호출 횟수 "1~2회(`'auto'`는 1~3회 — 이름 지목이면 선택 0)"와 시간 내역 "선택 최대 15초(이름 지목이면 0)"는 §12.3 표를 따른다.

### 12.9 요구 추적

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-MSG-009 🔒 | §12.2·§12.3 | SRV-T-270~277·281 · routes-generate(contract) | ✅(설계) |
| R-MSG-003 🔒 개정 | §12.2 ① | SRV-T-278 · routes-generate 400 | ✅(설계) |
| R-NFR-001 🔒 개정 | §12.3 시간표 | SRV-T-276 | ✅(설계) |
| R-MSG-007 🔒 (상속) | §12.4 | SRV-T-275 | ✅(설계) |
| R-LLM-007 🔒 (상속) | §12.2 ③ | SRV-T-274 | ✅(설계) |
| R-AUTH-004 🔒 개정 (응답) | [db.md](db.md) §12 | SRV-T-140·142 개정 · API-T-061 개정 | ✅(설계) |

### 12.10 설계 결정

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-MSG-25 | 선택을 잠금 안, 읽기 3종 뒤에 한다 | 잠금 전 선택 | 409로 끝날 요청이 AI를 쓰지 않는다. 선택과 발화가 같은 기록을 본다 |
| D-MSG-26 | `selectSpeaker`가 throw하지 않고 기본 화자를 돌려준다 | messages가 try/catch로 기본 화자 | 기본 화자 규칙·실패 분류가 llm 한 곳에 모인다. messages는 분기 1개만 |
| D-MSG-27 | 버튼 경로 `speak_done` 필드를 그대로 둔다 | 모든 경로에 `auto`·`selected` | 기존 로그 단언 무수정(수용 기준 "기존 테스트 무수정") |
| D-MSG-28 | 예산 게이트는 요청당 1회 | 선택 뒤 발화 전에 한 번 더 | 기존 "재시도는 게이트 1회" 규칙과 같다. 선택 1회(약 1.7원)로 한도를 넘어도 같은 요청의 발화는 끝낸다. 다음 요청부터 429 |

- 확인 필요 없음. 요구 밖 기능(저장만 전송·두 캐릭터 연속·자동 여부 저장)은 만들지 않는다.

## 13. S4 — afterSpeak 훅 본체 연결 (R-MEM-002 🔒)

- 상태: 초안(2026-10-07). 결론: **`GenerateDeps`·`MessagesDeps`·`MessagesService` 시그니처는 바뀌지 않는다.** 컨테이너가 `afterSpeak`에 memory 훅을 넣고([index.md](index.md) §13.1), `generate.ts`는 등록 호출을 try/catch로 감싸는 변경만 있다.

비유: 무대 감독(speak)은 공연이 끝나면 "기록 담당에게 연락" 쪽지를 우체통(`waitUntil`)에 넣고 퇴장한다. 기록 담당이 누구인지는 극장(컨테이너)이 정한다. 우체통이 고장 나도 이미 끝난 공연을 취소하지 않는다.

### 13.1 연결

```ts
// server/src/services.ts (index.md §13.1) — messages deps 에 1항목
afterSpeak: async ({ roomId }) => {
  await memory.summarizeIfNeeded(roomId)   // SummarizeOutcome 은 버린다. throw 하지 않는다(memory.md D-MEM-9)
},
```

- messages는 memory를 import하지 않는다(함수 값 주입 — 의존 방향 `routes → messages`, `memory → db·llm` 유지).
- `AfterSpeakEvent.messageId`는 memory가 쓰지 않는다(판정은 D1 미요약 수 기준). 타입은 그대로 둔다(D-MSG-30).
- 요약 판정·구간·실패 처리 전체는 [memory.md](memory.md) §4.1. messages 쪽 계약은 "성공 뒤 1회 등록, 결과는 speak 응답에 영향 없음"뿐이다.

### 13.2 `generate.ts` 델타

```ts
// speak — withSpeakLock 반환 뒤(잠금 해제 뒤)
const hook = deps.afterSpeak
if (hook !== undefined) {
  try {
    background.waitUntil(runAfterSpeak(hook, { roomId, messageId: saved.id }))
  } catch (e) {
    // S4: 실행 컨텍스트가 없는 런타임 등에서 등록 자체가 throw 해도 저장된 대사를 실패로 바꾸지 않는다
    logger.warn('after_speak_schedule_failed', { roomId, errName: errName(e) })
  }
}
```

- 이유: Hono `c.executionCtx`는 런타임이 실행 컨텍스트를 주지 않으면(예: `app.request()`를 컨텍스트 없이 호출) 접근 시 throw한다. S3까지는 훅이 없어 이 줄이 돌지 않았다. S4부터는 항상 돌므로, 등록 실패가 이미 저장된 대사를 500으로 바꾸면 화면 재시도로 같은 대사가 두 번 생긴다(D-MSG-18과 같은 이유).
- 인자 평가 순서상 `runAfterSpeak(...)`는 `waitUntil` 호출 전에 이미 시작된다. 등록이 실패하면 그 promise는 기다려지지 않은 채 돌다 끊길 수 있다. `runAfterSpeak`는 항상 resolve하므로 처리되지 않은 거부는 생기지 않고, 끊겨도 D1은 그대로라 다음 speak가 복구한다([memory.md](memory.md) §4.3).
- 운영(Workers `fetch`)에서는 컨텍스트가 늘 있으므로 이 경로는 방어용이다.

### 13.3 흐름 위치 (변경 없음 확인)

| 항목 | 값 |
|---|---|
| 등록 시점 | `withSpeakLock` 반환 뒤 = **잠금 해제 뒤**. 요약은 speak 잠금 밖에서 돈다([memory.md](memory.md) D-MEM-14) |
| 경로 | 버튼(`sebastian`·`ciel`)·`'auto'` 모두 같은 훅 1회 |
| 실패한 speak | 등록 0회(기존 SRV-T-202) |
| regenerate | 훅 없음 유지(D-MSG-13 — 메시지 수가 늘지 않는다) |
| 유저 발화·수정·삭제 | 훅 없음(요구는 speak 뒤만) |
| 로그 | `speak_done` 불변. 추가 `after_speak_schedule_failed{roomId, errName}`(warn). 요약 로그는 memory(§5.1) |
| 시간 | speak 응답 시간 불변(R-NFR-001 🔒). 훅은 응답 뒤 `waitUntil` 30초 안 |

### 13.4 테스트 (`server/test/messages-generate.test.ts`에 추가)

| ID | 조건 | 기대 |
|---|---|---|
| SRV-T-326 | `afterSpeak` 있음, `background.waitUntil`이 `throw new Error('no ctx')` | speak가 저장된 `Message`를 돌려준다(throw 없음), DB에 캐릭터 메시지 1행, 훅 함수는 1회 호출됨, warn `after_speak_schedule_failed{roomId, errName: 'Error'}` |

- 기존 SRV-T-202(성공 시에만 등록·훅 실패 `after_speak_failed`)는 무수정.
- speak → 훅 → 실제 요약까지의 배선은 [index.md](index.md) §13.3 SRV-T-327, 요약 자체는 [memory.md](memory.md) §8.

### 13.5 요구 추적

| 요구ID | 반영 | 테스트 | 상태 |
|---|---|---|---|
| R-MEM-002 🔒 | §13.1 연결 · §13.2 등록 실패 삼킴 · §13.3 | SRV-T-202(기존)·326·327 | ✅(설계) |
| R-NFR-001 🔒 | §13.3 응답 시간 불변 | 기존 | ✅(영향 없음) |

### 13.6 설계 결정

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-MSG-29 | `waitUntil` 등록 실패를 잡아 warn만 남긴다 | 그대로 전파 · 라우트가 처리 | 저장된 대사를 실패로 보이면 중복 대사가 생긴다(D-MSG-18). "실패해도 speak 응답은 성공"(R-MEM-002)을 등록 단계까지 넓힌다. 라우트를 얇게 유지 |
| D-MSG-30 | `AfterSpeakEvent`에서 `messageId`를 빼지 않는다 | `{ roomId }`만 | 시그니처·기존 테스트(SRV-T-202) 무수정. 값 1개라 비용 없음 |

## 14. S3f — `llm` 공장 비동기화 반영 (R-LLM-009 🔒 · R-SET-013 🔒)

- 상태: 초안(2026-10-08, 승인 ① 완료). 근거 `s3f-02-전반설계.md` §2.3·§7·§8 · `s3f-03-인계패킷.md` §1.2.
- 관련: [index.md](index.md) §14(공장 순서 — 키 확인 → D1 모델 읽기 → 해석 → 생성) · [llm.md](llm.md) §15(모델 해석·자동 전환 금지).
- messages는 모델을 모른다. 공장이 돌려준 `Llm`을 쓰기만 하고, 모델 키·모델명·단가를 읽거나 넘기지 않는다.

### 14.1 공개 API 델타

```ts
// server/src/messages/service.ts · generate.ts — MessagesDeps · GenerateDeps
llm: () => Promise<Llm>      // 이전 () => Llm
```

- `MessagesService`·`GenerateOps`·`AfterSpeakEvent`·`speak`/`regenerate` 시그니처와 응답 형태는 그대로다.

### 14.2 `generate.ts` 델타 (두 줄)

| 위치 | 이전 | 이후 |
|---|---|---|
| `speak` | `const llm = deps.llm()` | `const llm = await deps.llm()` |
| `regenerate` | `const llm = deps.llm()` | `const llm = await deps.llm()` |

- `resolveSpeaker(llm: Llm, …)`·`llm.ensureBudget()`·`llm.complete(…)`·`llm.selectSpeaker(…)` 호출은 그대로다. 'auto' 선택과 발화가 **같은 `Llm` 인스턴스**라 같은 모델이다(R-LLM-008 문구 그대로 참).
- 문서주석 `[비동기]`의 "llm() 확인"을 "await llm()(S3f: 키 확인 → D1 모델 키 1행 → 해석)"으로, `[설정]`의 "llm 지연 생성 함수"를 "llm 비동기 공장"으로 고친다.

### 14.3 판정 순서 (불변 확인)

```
speak:      입력 검증(VALIDATION_ERROR) → await llm()  ← 여기서 CONFIG_INVALID · D1 오류(500 INTERNAL)
            → ensureBudget(LLM_BUDGET_EXCEEDED) → 잠금 선점(SPEAK_IN_PROGRESS) → 읽기 3종 → ('auto' 선택) → 발화 → 저장 → finally 해제 → waitUntil afterSpeak
regenerate: (기존 앞단 검증) → await llm() → ensureBudget → 잠금 → … (§4.3과 같음)
```

- `await`가 붙은 자리만 같고 단계 순서는 바뀌지 않는다. 공장 실패(키 없음·D1 오류)는 **잠금 선점 앞**이라 잠금 해제가 필요 없고 LLM 호출 0회다(이전 `CONFIG_INVALID`와 같은 자리).
- 진행 중인 speak는 시작 때 만든 `Llm`의 모델로 끝난다. 그 사이 주인이 저장하면 다음 speak부터 바뀐다(R-SET-013).
- afterSpeak(요약)는 memory가 자기 시작 시점에 공장을 다시 부른다([memory.md](memory.md) §12).

### 14.4 동시성·에러·env·DB

- 새 잠금·에러 코드·env 키·마이그레이션 없음(0004는 settings 칸 — [db.md](db.md) §14). 시간 예산: D1 PK 읽기 1회(수 ms)가 잠금 밖에서 늘 뿐, 66초 LLM 분배·70초 종결 불변.

### 14.5 테스트 (`server/test/messages-generate.test.ts` — D1 + FakeProvider + 가짜 시계)

| ID | 조건 | 기대 |
|---|---|---|
| SRV-T-355 | `llm: vi.fn(async () => { throw new Error('d1 down') })`(공장의 D1 오류 흉내)로 speak · regenerate | 같은 오류로 reject. `rooms.speaking_until` 불변(잠금 선점 0), `messages` 행 수 불변, `ensureBudget`·제공사 호출 0 |

- 기존 테스트 영향(무수정 통과가 목표이고, 바뀌는 것은 공장 감싸기뿐):
  - 65행 `const llm = (): Llm => createLlm(…)` → `const llm = async (): Promise<Llm> => createLlm(…)`.
  - 224·561·707행 `vi.fn((): Llm => { throw … })` → `vi.fn(async (): Promise<Llm> => { throw … })`. `not.toHaveBeenCalled()`·에러 코드 단언은 그대로 성립한다.
  - 754·810행 `createSettingsService({ … })`에 `fallbackModelKey: null` 추가([settings.md](settings.md) §13).
- 통합(저장 → speak URL·단가, 'auto' 선택 URL, 자동 전환 금지 종단)은 컨테이너 경로라 [index.md](index.md) §14.5 SRV-T-350~352가 본다.

### 14.6 요구 추적

| 요구 | 반영 | 테스트 | 상태 |
|---|---|---|---|
| R-LLM-009 🔒 | §14.2(공장 결과만 사용, 자동 전환 경로 없음) | SRV-T-355 · [index.md](index.md) SRV-T-352 | 설계 ✅ |
| R-SET-013 🔒 | §14.3(다음 speak부터, 진행 중은 이전 모델) | [index.md](index.md) SRV-T-350·351 | 설계 ✅ |
| R-MSG-003·006·009 🔒 | 판정 순서 불변(§14.3) | 기존 speak·regenerate·auto 테스트 | ✅ |

### 14.7 설계 결정

| ID | 결정 | 대안·근거 |
|---|---|---|
| D-MSG-31 | `await deps.llm()`을 기존 `deps.llm()` 자리에 그대로 둔다 | 잠금 안으로 옮기면 D1 오류 때 잠금 해제 경로가 늘고 409 판정보다 늦어진다. 앞에 두면 실패가 잠금 전에 닫힌다 |
| D-MSG-32 | messages는 모델 키를 받지 않는다 | 모델·단가 해석은 공장 한 곳(D-IDX-18). messages가 알면 해석이 두 곳에 갈라진다 |

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-08 | S3f 설계(§14, 승인 ① 완료): `MessagesDeps`·`GenerateDeps.llm` `() => Llm` → `() => Promise<Llm>`, `generate.ts` speak·regenerate `await deps.llm()` 두 줄, 판정 순서 불변(공장 실패는 잠금 앞). 기존 테스트 감싸기(65·224·561·707행)·`fallbackModelKey`(754·810행). SRV-T-355, D-MSG-31·32 |
| 2026-10-07 | S4 설계(§13): `afterSpeak` 훅 본체를 컨테이너가 `memory.summarizeIfNeeded`로 연결(messages는 memory를 import하지 않음), `generate.ts`의 `background.waitUntil` 등록을 try/catch로 감싸 `after_speak_schedule_failed`(warn), 훅 위치(잠금 해제 뒤)·regenerate 훅 없음 유지 확인, SRV-T-326, D-MSG-29·30. `GenerateDeps`·`MessagesDeps`·`MessagesService` 시그니처 불변 |
| 2026-10-07 | verify 후속 동기화(소스 기준, SRV-001·SRV-003·S3-R1·S3-R2): §12.2 `pick` 반환 구조 문단, §12.3 흐름 ⑤·⑦ 뒤 `return { saved, pick }`, §4.4 실패 문단·§8.4 SRV-T-292(설정 읽기 실패 시 잠금 해제), §5 `character` 위반 행(실물 문구·HTTP 미도달)·S3-R1 메모, §9 메시지 id 10진 규칙(S3-R2), §10.1. 공개 API 변경 없음 |
| 2026-10-06 | 마감 동기화(server 343/343): 상태 줄 문구 확정. 번호·파일은 실물 기준(SRV-T-281 `messages-generate` 서비스 경로). SRV-T-270·273·276의 15000·51000·49000 값은 실물과 같다 |
| 2026-10-06 | 구현 동기화(343/343, SRV-T-261~281): 지목 `ms: 0`·로그 `speaker_select{provider, result:'mention', character, ms:0}`(reason·outChars 없음), "마지막 유저 글" = 기록 전체의 마지막 유저 메시지(맨 끝이 캐릭터여도 — 승인), 벡터 M7 추가, 테스트 번호를 실물에 맞춤(279 지목 벡터 · 280 호출·사용량 0 · 281 서비스 경로) |
| 2026-10-06 | R-LLM-008 개정(사용자 승인) 반영: §12.3 흐름 ⑤에 이름 지목 경로(호출 0) · 선택 15초, `ResolvedSpeaker.selected`에 `'mention'`, AI 호출 1~3회, 시간표 15 + 51초, SRV-T-270·273·276 값 갱신, SRV-T-279 추가, §12.8 api.md 요청 문구 |
| 2026-10-06 | S3d 설계(§12): speak `SpeakTarget`(`'auto'`) 처리 — 잠금 안 `llm.selectSpeaker` → 고른 캐릭터로 기존 생성 경로, `resolveSpeaker` 내부 함수, 검증 문구, 로그 `speak_done.auto·selected`·`speaker_select_fallback`, 66초 분배, SRV-T-270~278, 기존 SRV-T-140·142·API-T-061 개정, contract 테스트 요청(레이트리밋 공유), D-MSG-25~28. 공개 시그니처 불변 |
| 2026-10-05 | S1 초안 작성 |
| 2026-10-06 | S3 설계: §2.3 예정 시그니처를 본문으로 승격(speak `author` 인자 제거, regenerate `background` 제거), `MessagesDeps`에 `logger`·`contextMessages`·`llm`·`afterSpeak?`, `generate.ts` 추가, §4.2 흐름·§4.3 경합, §5 S3 에러, §8.2 SRV-T-191~209, §9·§10 갱신, D-MSG-12~19 |
| 2026-10-06 | S3b 설계: §4.2 speak ②b·regenerate ③b 예산 게이트(`llm.ensureBudget()`), §4.3 경합 2행, §5 `LLM_BUDGET_EXCEEDED`, §8.3 SRV-T-225~230, §9 에러 목록, §10 R-LLM-007·R-NFR-003, D-MSG-20·21 |
| 2026-10-05 | S1 구현 동기화(상태 확정): 페이지 단위 테스트 위치 `server/test/messages-page.test.ts`, `MessagePage`는 `@shared/types` `MessagesPage` 별칭, `NormalizedPageQuery` 재노출. S2 설계: `addUserMessage`(S1 문서의 `appendUserMessage` 개명)·`editMessage`·`deleteMessage` 본문 확정, `MessagesDeps`에 `now`, `text.ts` 추가, `AuthContext` → `MessageAuthor`(Principal 일부), D-MSG-6~11 |
| 2026-10-06 | S3c 설계: §4.4 잠금 뒤 `loadPromptSettings()`(= `settings.loadForPrompt`)를 요약·히스토리와 병렬로 1회 읽어 `buildSpeakPrompt`에 전달(캐시 없음, 선택 deps·시드 기본값), §8.4 SRV-T-256~258, §10.1, D-MSG-22~24 |
| 2026-10-06 | api.md v0.5 대조: §4.4 D1 오류는 시드로 바꾸지 않음(N5) 출처 표기 |
| 2026-10-06 | 테스트 입력 정정: SRV-T-257의 훼손 행 직접 INSERT 입력 `'{'`(1자)는 0003 CHECK 하한 2에 걸린다. `'{{'`(2자, JSON 파싱 실패)로 바꿨다(settings.md·db.md와 같은 정정) |
| 2026-10-06 | §4.4에 구현 완료 표기(server 318/318, SRV-T-234~260). 설계와 다른 점 없음 |

파급(공개 API 변경): `MessagesDeps`에 `now` 필수 추가 → 호출자 `server/src/services.ts`(`createServices`), `server/test/messages.test.ts` 11행·68행의 `createMessagesService({ db })`를 `{ db, now }`로 고친다. 라우트(`server/src/routes/messages.ts`)의 `listMessages` 호출은 영향 없다.

파급(S3 공개 API 변경): `MessagesDeps`에 필수 `logger`·`contextMessages`·`llm` 추가 → 호출자 `server/src/services.ts`(`createServices`, 델타는 [llm.md](llm.md) §3.3), `server/test/messages.test.ts`의 `createMessagesService({ db, now })` 호출(테스트 헬퍼로 묶어 기본 `FakeProvider`·수집 로거·`contextMessages 40`을 넣는다). `MessagesService`에 `speak`·`regenerate` 추가 → 라우트(`server/src/routes/messages.ts` 등, contract 소유)가 E9·E12를 추가한다. 기존 4개 함수 시그니처는 바뀌지 않는다.

파급(S3b): `MessagesDeps`·`GenerateDeps`·`MessagesService` 시그니처 변경 없음. `generate.ts`에 `await llm.ensureBudget()` 2줄과 문서주석 `[에러]`에 `LLM_BUDGET_EXCEEDED` 추가. `server/test/messages-generate.test.ts`의 `llm` 헬퍼는 meter 없이 만들어도 기존 SRV-T-191~209가 그대로 돈다(`LlmDeps.meter?` 선택). S3b 테스트만 meter를 넣는다.

파급(S4): `MessagesDeps`·`GenerateDeps`·`MessagesService`·`AfterSpeakEvent` 시그니처 변경 없음. 호출자 `server/src/services.ts`가 `afterSpeak`를 넣는다([index.md](index.md) §13.1). `generate.ts`는 등록 3줄을 try/catch로 감싸고 문서주석 `[비동기]`에 "등록 실패는 warn"을 더한다. 기존 SRV-T-202(훅 등록·훅 실패 삼킴)는 무수정. 라우트 테스트(`server/test/routes-generate.test.ts`, contract 소유)는 speak 성공 뒤 `waitOnExecutionContext(ctx)`를 기다리도록 바꾸기를 contract에 요청했다([memory.md](memory.md) 「contract 인계」).

파급(S3f 공개 API 변경): `MessagesDeps.llm`·`GenerateDeps.llm` 타입이 `() => Promise<Llm>` → 호출자 `server/src/services.ts`(공장 제공, [index.md](index.md) §14.1)와 직접 생성 테스트 `messages-generate.test.ts`(65·224·561·707행). `MessagesService`·응답 형태 불변이라 라우트(contract) 영향 없음.
