# memory 모듈 설계

- 상태: S4 초안 · **S4 구현 완료(2026-10-07, server 381/381, SRV-T-296~327 — 구현 동기화)** · 최종 갱신: 2026-10-07
- 묶음: **S4**(장기기억) = R-MEM-001 🔒(조회·편집) · R-MEM-002 🔒(speak 뒤 자동 요약) · R-MEM-003(중복 요약 방지·Cron 대체 결정) · R-LLM-007 🔒(요약 호출도 월 예산 누적·게이트) · R-LLM-003 🔒·R-LLM-006(요약은 데이터 블록) · R-CHAT-012 🔒(화면 — 계약·ui 인계만) · R-DB-001 🔒(`memory` 테이블은 0001에 있음, 마이그레이션 없음).
- 입력: `doc/100_요구조건/requirements.md`(R-MEM·R-LLM-003/006/007·R-CHAT-012·R-NFR-001), `doc/000_프로젝트_확정사항.md` §5.2·§5.4·§5.5(5단계), `rtm.md` S4 행, [messages.md](messages.md) §2.3·§4.2, [llm.md](llm.md) §2.3·§7.1·§12, [db.md](db.md) §2.3·§3.5·§7, [index.md](index.md) §2.3, [env.md](env.md), 실물 `server/src/{messages/generate.ts, db/{memory,sql,index}.ts, llm/{client,prompt,usage,provider,fake}.ts, services.ts, index.ts, env.ts}`, `shared/src/limits.ts`, `server/migrations/0001_init.sql`.
- 관련 문서(이 묶음의 델타): [messages.md](messages.md) §13(afterSpeak 훅 본체 연결) · [llm.md](llm.md) §14(요약 프롬프트·`CompleteOptions.budgetMs`) · [db.md](db.md) §13(memory·messages 저장소 확장) · [index.md](index.md) §13(배선·`scheduled` 미도입) · [env.md](env.md)(변경 없음 확인).

## 1. 목적

장기기억은 두꺼운 일기장 맨 앞에 끼워 두는 "지난 줄거리" 쪽지다. 일기장이 길어지면 서기(요약기)가 아직 쪽지에 옮기지 않은 오래된 장들을 읽고, 기존 쪽지 내용과 합쳐 새 쪽지를 쓴다. 최근 몇 장(최근 `CONTEXT_MESSAGES`개)은 캐릭터가 직접 펼쳐 보므로 쪽지에 옮기지 않는다. 쪽지에는 "몇 번 장까지 옮겼는지"(`source_until_id`)를 적어 둔다. 두 서기가 같은 쪽지를 동시에 고쳐 쓰면 나중에 끝난 쪽이 "내가 읽을 때와 쪽지가 그대로인가"를 확인하고, 바뀌었으면 자기 원고를 버린다(낙관적 잠금). 사람(등급 통과자)도 쪽지를 직접 고칠 수 있다.

| 요구ID | 내용 | 이 문서 |
|---|---|---|
| R-MEM-001 🔒 | 조회·편집: `summary` 0~4000자, 편집은 `source_until_id` 유지, 토큰 필요 | §2 `get`·`put` · §9 E13·E14 |
| R-MEM-002 🔒 | speak 성공 응답 **뒤** `ctx.waitUntil()`로 자동 요약. 기준 초과 시 `source_until_id` 이후 ~ 최근 `CONTEXT_MESSAGES`개 제외 구간을 LLM 요약해 기존 summary에 합치고 `source_until_id` 전진. 실패해도 speak 성공, 로그만 | §2 `summarizeIfNeeded` · §4.1~§4.3 |
| R-MEM-003 | 동시 요약 방지(조건부 UPDATE). `waitUntil` 한계로 실패가 반복되면 Cron 대체 — **여기서 확정** | §4.4 · §11 D-MEM-2·3 |
| R-LLM-007 🔒 | 요약 호출도 월 예산 누적, 초과면 호출 전 건너뜀 | §4.1 ④ · [llm.md](llm.md) §14 |
| R-LLM-003 🔒 · R-LLM-006 | 요약 본문은 데이터 블록(구분자 안), 시스템 프롬프트에 섞지 않음 | [llm.md](llm.md) §14.3 |
| R-CHAT-012 🔒 | 장기기억 시트(⋯ 메뉴 진입) — 계약·ui 인계만 | 「contract 인계 요구 명세」 · 「ui 인계 메모」 |
| R-DB-001 🔒 | `memory(room_id PK, summary, source_until_id, updated_at)` | §7 (마이그레이션 없음) |

## 2. 공개 API

```ts
// server/src/memory/service.ts — index.ts 가 재노출
import type { MemoryResponse, PutMemoryBody } from '@shared/types'   // contract 가 추가(「contract 인계」)
import type { Db } from '../db'
import type { Llm } from '../llm'
import type { Logger } from '../logger'

/** = @shared/types MemoryResponse. 행이 없으면 { summary: '', sourceUntilId: 0, updatedAt: null } */
export type MemoryState = MemoryResponse
/** = @shared/types PutMemoryBody */
export type PutMemoryInput = PutMemoryBody

export type SummarizeStage = 'read' | 'budget' | 'llm' | 'write'
/** 요약 1회의 결과. summarizeIfNeeded 는 throw 하지 않고 이것을 돌려준다(테스트 단언용, 훅은 버린다) */
export type SummarizeOutcome =
  | { readonly status: 'skipped'; readonly reason: 'below_threshold' | 'empty_range' | 'budget' }
  | {
      readonly status: 'summarized'
      /** 이번에 반영한 마지막 messages.id (= 새 source_until_id) */
      readonly untilId: number
      readonly messages: number
      readonly truncated: boolean
    }
  | { readonly status: 'conflict' }
  | { readonly status: 'failed'; readonly stage: SummarizeStage; readonly code: string }

export type MemoryDeps = {
  db: Db
  now: () => number
  logger: Logger
  /** config.contextMessages (1~100) */
  contextMessages: number
  /** config.memorySummaryThreshold (2~1000, > contextMessages — parseEnv 가 보장) */
  summaryThreshold: number
  /** 지연 생성. 요약이 필요할 때만 부른다(키 확인 포함). 컨테이너가 messages 와 같은 thunk 를 넘긴다 */
  llm: () => Llm
}

export type MemoryService = {
  /** 방의 장기기억. 행 없음 → 기본값. 방 없음 → NOT_FOUND */
  get: (roomId: string) => Promise<MemoryState>
  /** summary 교체(trim, 0~4000 코드 포인트). source_until_id 유지, 행이 없으면 만든다(source 0) */
  put: (roomId: string, input: PutMemoryInput) => Promise<MemoryState>
  /** speak 뒤 훅 본체. 기준 초과면 오래된 구간을 요약해 합치고 전진. 절대 throw 하지 않는다 */
  summarizeIfNeeded: (roomId: string) => Promise<SummarizeOutcome>
}

export const createMemoryService = (deps: MemoryDeps): MemoryService
```

```ts
// server/src/memory/summarize.ts — 순수 함수·상수(index.ts 가 재노출, 테스트가 직접 import)
import { MEMORY_SUMMARY_MAX } from '@shared/limits'
import type { PromptMessage } from '../llm'

/** 요약 1회에 넣는 메시지 수 상한 */
export const SUMMARY_BATCH_MAX = 100
/** 요약 1회에 넣는 메시지 본문 합계 상한(코드 포인트) */
export const SUMMARY_INPUT_CHARS_MAX = 20_000
/** 넘친 출력을 자를 때 경계(줄·문장 끝)를 찾는 최소 위치. 이보다 앞이면 4000에서 그냥 자른다 */
export const SUMMARY_CUT_MIN = 3_000

/** 미요약 메시지 수 → 이번에 요약할 개수. 기준 이하면 0. 순수 */
export const planSummary = (pending: number, threshold: number, contextMessages: number): number
/** countAfter 상한. 기준 판정과 배치 크기 계산에 필요한 만큼만 센다. 순수 */
export const pendingCountCap = (threshold: number, contextMessages: number): number
/** 앞에서부터 본문 합계 ≤ maxChars 인 접두부(최소 1개). 순수 */
export const capByChars = <T extends PromptMessage>(rows: readonly T[], maxChars?: number): T[]
/** ≤ max 면 그대로, 넘으면 줄·문장 경계(≥ SUMMARY_CUT_MIN)에서, 없으면 max 에서 자른다. 순수 */
export const fitSummary = (text: string, max?: number): { text: string; truncated: boolean }
```

| 이름 | 인자 | 반환 | 실패 조건(에러 코드, 판정 순서) | 요구ID |
|---|---|---|---|---|
| `get` | `roomId` | `Promise<MemoryState>` | ① 방 없음 → `NOT_FOUND`(404) ② D1 오류 전파(→ 500 `INTERNAL`) | R-MEM-001 |
| `put` | `roomId, { summary }` | `Promise<MemoryState>` | ① `summary`가 문자열 아님·trim 후 4000 코드 포인트 초과 → `VALIDATION_ERROR`(400, **DB 전**) ② 방 없음 → `NOT_FOUND`(404) ③ D1 오류 전파 | R-MEM-001 |
| `summarizeIfNeeded` | `roomId` | `Promise<SummarizeOutcome>` | **throw 없음.** 실패는 `{ status: 'failed', stage, code }` + warn 로그. 예산 초과는 `skipped/budget` | R-MEM-002·003 · R-LLM-007 |
| `planSummary` | `pending, threshold, contextMessages` | `number` | 없음 | R-MEM-002 |
| `pendingCountCap` | `threshold, contextMessages` | `number` | 없음 | R-MEM-002 |
| `capByChars` | `rows, maxChars = SUMMARY_INPUT_CHARS_MAX` | 접두부 | 없음 | R-MEM-002 |
| `fitSummary` | `text, max = MEMORY_SUMMARY_MAX` | `{ text, truncated }` | 없음 | R-MEM-001(4000 상한)·002 |

### 2.1 값 규칙

| 항목 | 규칙 |
|---|---|
| `planSummary` | `pending <= threshold` → 0. 아니면 `Math.min(pending - contextMessages, SUMMARY_BATCH_MAX)`. `threshold > contextMessages`(parseEnv 보장)이므로 기준 초과면 결과 ≥ 1 |
| `pendingCountCap` | `Math.max(threshold, contextMessages + SUMMARY_BATCH_MAX) + 1`. 기본(60·40) = 141. 이 이상은 세지 않는다(§11 D-MEM-15) |
| `capByChars` | 앞(오래된 쪽)부터 `countCodePoints(text)`를 더해 `maxChars`를 넘기 직전까지. 첫 행이 혼자 넘어도 1개는 넣는다(메시지 상한 2000 < 20000이라 실제로는 생기지 않음) |
| `fitSummary` | `countCodePoints(text) <= max` → `{ text, truncated: false }`. 넘으면 앞 `max` 코드 포인트를 잘라 그 안에서 마지막 `\n` 또는 문장 끝(`.`·`!`·`?`·`。`·`…`) 위치를 찾는다. 그 위치(코드 포인트 기준)가 `SUMMARY_CUT_MIN` 이상이면 거기까지(끝 문자 포함), 아니면 `max`에서 자른다. 결과는 `trimEnd`. `truncated: true` |
| `put`의 `summary` | `normalizeText`(앞뒤 trim) 후 `countCodePoints` 0~`MEMORY_SUMMARY_MAX`(4000). 0자(빈 요약) 허용. 중간 줄바꿈 유지 |
| `MemoryState` | `summary`(string) · `sourceUntilId`(0 이상 정수, 0 = 요약 없음) · `updatedAt`(epoch ms, 행 없으면 `null`) |
| 미요약 메시지 수 | `messages.id > source_until_id`인 그 방 메시지 수(행 없으면 `source_until_id` = 0 → 방 전체). 요구 문구 "방 메시지 수"의 해석 — §11 D-MEM-1 |

## 3. 내부 구조

| 파일 | 책임 | 줄 수 예상 |
|---|---|---|
| `server/src/memory/index.ts` | 재노출(`createMemoryService`·타입·`summarize.ts` 상수와 순수 함수) | ~20 |
| `server/src/memory/service.ts` | `createMemoryService` — `get`·`put`(검증·저장)과 `summarizeIfNeeded` 조립. 오류 분류·로그 | ~150 |
| `server/src/memory/summarize.ts` | 순수 함수·상수(`planSummary`·`pendingCountCap`·`capByChars`·`fitSummary`·`SUMMARY_*`) | ~70 |
| `server/test/memory.test.ts` | §8 SRV-T-296~315 | — |

- **요약 프롬프트는 memory가 아니라 llm에 둔다**(`server/src/llm/summary.ts` — [llm.md](llm.md) §14). memory는 `buildSummaryPrompt`·`postprocessSummary`·`SUMMARY_BUDGET_MS`를 `'../llm'`에서 import해 부른다. messages가 `buildSpeakPrompt`→`llm.complete`→`postprocessLine`을 부르는 것과 같은 모양이다(§11 D-MEM-6).
- 의존: `memory → db`(`memory`·`messages`·`rooms` 저장소), `memory → llm`(프롬프트·`Llm`), `memory → @shared/limits`·`@shared/types`, `memory → app-error`·`logger`(타입). **역방향 없음**: messages는 memory를 import하지 않는다(컨테이너가 `afterSpeak` 함수 값으로 연결 — [index.md](index.md) §13). llm은 db·memory를 import하지 않는다.
- 상태: 없음. 모든 상태는 D1 `memory` 행이다(인스턴스 여럿 — 프로세스 메모리 잠금·캐시 금지).
- 팩토리는 생성 시 `db`·`llm`에 손대지 않는다(클로저만 만든다). `SRV-T-087`의 `trap` 가짜 `Db`가 그대로 통과해야 한다.
- 함수 50줄 한계(golden-principles §1): `summarizeIfNeeded`는 §4.1의 단계(읽기·계획 / 예산 / 생성 / 저장 / 실패 분류)를 내부 함수로 나눈다. 내부 함수 이름은 구현 재량이고 공개하지 않는다.

## 4. 비동기·동시성

### 4.1 자동 요약 흐름 (R-MEM-002 🔒)

```
POST /api/rooms/:id/speak  (messages.speak — messages.md §4.2·§12.3)
  … 잠금 → 생성 → 저장 → 잠금 해제
  ⑤ background.waitUntil(runAfterSpeak(afterSpeak, { roomId, messageId }))   등록 실패도 삼킨다(messages.md §13)
  ◀ 201 Message                         ← 사용자는 여기서 끝. 아래는 응답과 무관
        │  Workers: 응답 뒤 최대 30초까지 이어서 실행(waitUntil 한계)
        ▼
memory.summarizeIfNeeded(roomId)          stage = 'read'
  ① state = await db.memory.getState(roomId)                    읽기 1행(PK)
     base  = state ?? { summary: '', sourceUntilId: 0 }
  ② pending = await db.messages.countAfter(roomId, base.sourceUntilId, pendingCountCap(…))
                                                                 범위 스캔 ≤ 141행(기본)
  ③ take = planSummary(pending, summaryThreshold, contextMessages)
     take === 0 → { skipped, below_threshold }   (로그 없음 — speak마다 생기므로)
  ④ stage = 'budget'
     llm = deps.llm()                         ── google + 키 없음 → ConfigError(CONFIG_INVALID) → failed
     await llm.ensureBudget()                 ── 초과 → { skipped, budget } + info memory_summary_skipped
                                                 (D1 읽기 1행. 저장소 오류는 failed/budget)
  ⑤ stage = 'read'
     rows  = await db.messages.listAfter(roomId, base.sourceUntilId, take)   오름차순 ≤ 100행
     batch = capByChars(rows)                 ── 비면 { skipped, empty_range } (그 사이 삭제)
  ⑥ stage = 'llm'
     prompt = buildSummaryPrompt({ previous: base.summary, messages: batch })   (llm.md §14.3)
     raw    = await llm.complete(prompt, { budgetMs: SUMMARY_BUDGET_MS })      ≤ 25초, 재시도 포함,
                                                                               시도마다 usage 누적(R-LLM-007)
     { text, truncated } = fitSummary(postprocessSummary(raw))                 빈 출력 → LLM_EMPTY
  ⑦ stage = 'write'
     ok = await db.memory.advance(roomId,
            { summary: text, sourceUntilId: last(batch).id },
            { summary: base.summary, sourceUntilId: base.sourceUntilId },     ← 읽을 때의 값(기대값)
            now())
     ok === false → { conflict } + info memory_summary_conflict             (다른 요약·편집·방 삭제가 먼저)
  ⑧ info memory_summarized { roomId, fromId: base.sourceUntilId, untilId, messages, inChars, outChars, truncated, ms }
     → { summarized, untilId, messages, truncated }
  catch (e) → warn memory_summary_failed { roomId, stage, code, errName, ms } → { failed, stage, code }
```

- 판정·요약·저장이 **모두 훅 안**이다. speak 응답 본문·상태 코드는 이 흐름의 어떤 결과에도 바뀌지 않는다(사전 확정 1).
- `code`는 `AppError`면 `e.code`(`LLM_FAILED`·`LLM_EMPTY`·`CONFIG_INVALID`·`INTERNAL` 등), 그 밖이면 `'INTERNAL'`. `errName`은 `e.name`.
- 요약 결과는 다음 speak·regenerate의 프롬프트에 자동으로 들어간다. 두 흐름은 이미 잠금 뒤 `db.memory.getSummary(roomId)`를 읽어 `[지난 이야기 요약]` 줄로 넣는다(S3 경로 그대로, 사전 확정 6).
- **regenerate는 요약을 부르지 않는다**(메시지 수가 늘지 않는다 — [messages.md](messages.md) D-MSG-13). 유저 발화 저장도 부르지 않는다(요구는 speak 뒤만).

### 4.2 구간 계산 규칙

```
방의 메시지 (id 오름차순)
  ┌──── 요약됨 ────┐┌──────────── 미요약(pending) ─────────────┐
  [1 … source_until_id] [source_until_id+1 … ] … [최근 CONTEXT_MESSAGES개]
                        └─ 이번 요약 대상: 앞에서 take개 ─┘└─ speak 프롬프트가 직접 본다 ─┘
  take = min(pending − CONTEXT_MESSAGES, 100), pending > THRESHOLD 일 때만
  다시 capByChars(본문 합계 ≤ 20000자)로 접두부만
  새 source_until_id = 대상 마지막 메시지 id
```

| 예(기본 60·40) | pending | take | 결과 |
|---|---|---|---|
| 첫 요약 직전 | 60 | 0 | 건너뜀 |
| 61번째 메시지 뒤 speak | 61 | 21 | 1~21번을 요약, `source_until_id` = 21번 id. pending → 40 |
| 그 뒤 매 speak | 41~60 | 0 | 건너뜀 |
| 다시 61 | 61 | 21 | 이어서 21개 |
| 요약 실패가 쌓인 방 | 250(상한 141로 셈) | 100 | 100개만, 남은 구간은 다음 speak가 이어서 |

- 대상과 "최근 40개"는 겹치지 않는다. ②와 ⑤ 사이에 새 메시지가 붙어도 뒤쪽에 붙으므로 앞 `take`개는 여전히 최근 40개 밖이다. 그 사이 삭제가 있으면 대상이 줄 뿐이다.
- 요구 구조상 요약과 speak 컨텍스트 사이에는 최대 `THRESHOLD − CONTEXT_MESSAGES`(기본 20)개의 "어느 쪽에도 없는" 메시지가 생긴다. 기준이 60·40인 요구의 성질이며 이 설계가 만든 공백이 아니다.
- 요약에 반영된 뒤(`id ≤ source_until_id`) 그 메시지를 수정·삭제해도 요약은 바뀌지 않는다. 유저가 시트에서 고친다(R-MEM-001).

### 4.3 시간 상한 (R-NFR-001과 분리)

| 구간 | 상한 | 근거 |
|---|---|---|
| speak 응답 | 70초(R-NFR-001 🔒) — **요약과 무관** | 요약은 응답 뒤 `waitUntil`. speak는 요약을 기다리지 않는다 |
| 요약 전 D1(①②④⑤) | 왕복 4회, 1초 미만 | PK 1행·범위 스캔 ≤ 141행·PK 1행·범위 ≤ 100행 |
| 요약 LLM 단계(⑥) | `SUMMARY_BUDGET_MS` = **25초**(재시도 포함) | 1차 타임아웃 = `min(LLM_TIMEOUT_MS, 25000)`. 1차가 25초를 다 쓰면 재시도하지 않는다(`planRetryTimeout` 남은 예산 < 2초). 네트워크 즉시 실패면 1초 뒤 남은 예산으로 1회 |
| 저장(⑦) | 쓰기 1회 | 조건부 UPSERT 한 문장 |
| 합계 | 약 27초 이하 | Workers `waitUntil`은 응답 뒤 30초까지 이어서 실행한다. 훅은 응답 전에 이미 시작하므로 실제 여유는 더 크다 |

- 30초를 넘겨 런타임이 작업을 끊으면 ⑦ 전이므로 D1은 그대로다. 다음 speak가 같은 구간을 다시 요약한다(멱등, 스킬 §4 "중단돼도 다음 요청이 복구").
- CPU: 무료 플랜 요청당 CPU 10ms는 `waitUntil` 작업까지 포함한다. 요약의 CPU 일은 100행 문자열 조립·NFC 정규화·응답 JSON 파싱뿐이라 수 ms 안이다. LLM 대기는 I/O라 CPU에 들지 않는다. 수동 체크리스트에서 `wrangler tail`의 `cpuTime`을 확인한다(§8.3).
- 요약 출력 길이는 지시 2000자(llm.md §14.3 `SUMMARY_TARGET_CHARS`)다. 25초 안에 끝내기 위한 값이다(§11 D-MEM-4).

### 4.4 동시성 (R-MEM-003)

중복 방지는 **memory 행 하나에 대한 조건부 UPSERT 한 문장**이다([db.md](db.md) §13.3 `SQL_MEMORY_ADVANCE`). 플래그 컬럼·마이그레이션은 없다.

```
advance(roomId, next, expected)
  INSERT INTO memory … SELECT … WHERE EXISTS(rooms.id = roomId)      ← 행이 없으면 새로 넣는다
  ON CONFLICT (room_id) DO UPDATE SET summary, source_until_id, updated_at
    WHERE memory.source_until_id = expected.sourceUntilId
      AND memory.summary         = expected.summary                   ← 읽은 뒤 아무도 안 바꿨을 때만
  RETURNING room_id   → 1행이면 true
```

| 경합 | 결과 | 근거 |
|---|---|---|
| 같은 방 요약 2건 동시(연이은 speak 두 번의 훅) | 먼저 끝난 쪽만 반영, 나중 쪽 `conflict`(원고 버림). LLM 호출은 2회 일어날 수 있다 | 둘 다 같은 기대값을 읽었고, 첫 반영이 `source_until_id`를 바꿔 둘째 조건이 거짓. D1은 쓰기를 직렬 실행 |
| 행이 없을 때 요약 2건 동시 | 첫 INSERT 성공, 둘째는 충돌 → `DO UPDATE` 조건(`source_until_id = 0`) 거짓 → `conflict` | 같은 문장 하나로 처리 — "INSERT 후 재시도"가 필요 없다(사전 확정 2의 재시도 1회를 대체) |
| 요약 중 유저 편집(PUT) | 편집 보존, 요약 `conflict`. `source_until_id` 불변 → 다음 speak가 **편집본을 기준으로** 같은 구간을 다시 요약 | 기대값에 `summary`가 들어 있다. `source_until_id`만 보면 편집이 지워진다 |
| 요약이 먼저 끝나고 그 뒤 PUT(시트를 미리 열어 둔 경우) | PUT이 이긴다(마지막 쓰기). 요약이 더한 내용은 사라지고 `source_until_id`는 전진한 채 | R-MEM-001 "편집은 `source_until_id` 유지". 충돌 감지는 요구·에러 코드 밖(§11 D-MEM-10, 열린 질문) |
| 요약 중 방 삭제 | `WHERE EXISTS` 거짓 → 0행 → `conflict`. 외래 키 오류·고아 행 없음 | [db.md](db.md) D-DB-9와 같은 방식 |
| 요약 중 다음 speak | 그대로 진행(요약은 speak 잠금을 쓰지 않는다). 다음 speak는 이전 요약을 읽는다 | 요약이 speak를 409로 막으면 사용자 체감이 나빠진다(§11 D-MEM-14) |
| 요약 중 regenerate | 그대로 진행 | 같은 이유 |

- 한 방에서 동시에 도는 요약 수의 상한: speak는 방당 1건씩 직렬이고 각 요약은 30초 안에 끝나므로, 30초 창 안의 speak 수(실사용 2~3건)를 넘지 않는다. 낭비되는 LLM 호출은 요약 주기(미요약 21개마다)당 최대 그 수만큼이다.
- **Cron(`scheduled`)은 S4에서 도입하지 않는다.** 근거·전환 기준·전환 설계 요지는 §11 D-MEM-3.

## 5. 에러 타입

새 에러 클래스·새 에러 코드 없음. 서비스는 `AppError`만 던진다(`summarizeIfNeeded`는 던지지 않는다).

| 상황 | 에러 클래스 | shared 에러 코드 | 한국어 메시지 | 원인 |
|---|---|---|---|---|
| `put`: `summary`가 문자열 아님·trim 후 4000 코드 포인트 초과 | `AppError` | `VALIDATION_ERROR`(400) | `장기기억은 0~4000자로 입력해 주세요.` | 입력 위반. DB 전 판정 |
| `get`·`put`: 방 없음 | `AppError` | `NOT_FOUND`(404) | `방을 찾을 수 없습니다.` | rooms·messages와 같은 문구 |
| D1 오류 | (전파) | → onError `INTERNAL`(500) | shared 기본 문구 | 플랫폼 장애 |
| `summarizeIfNeeded` 실패 | 없음(삼킴) | 로그 `code`에만 | — | §4.1 catch. speak 응답 불변 |

- 문구 상수는 `service.ts` 안: `SUMMARY_INVALID_MESSAGE`·`ROOM_NOT_FOUND_MESSAGE`. `MEMORY_SUMMARY_MAX`로 문구를 만든다(`messages/text.ts`의 `TEXT_MESSAGE`와 같은 방식).

### 5.1 로그 규칙

| 이벤트 | 레벨 | 필드 | 언제 |
|---|---|---|---|
| `memory_summarized` | info | `roomId`·`fromId`·`untilId`·`messages`·`inChars`·`outChars`·`truncated`·`ms` | ⑦ 성공 |
| `memory_summary_skipped` | info | `roomId`·`reason: 'budget'` | ④ 예산 초과 |
| `memory_summary_conflict` | info | `roomId`·`expectedUntilId`·`ms` | ⑦ 0행 |
| `memory_summary_failed` | warn | `roomId`·`stage`·`code`·`errName`·`ms` | catch |
| (llm 쪽) `llm_done`·`llm_failed`·`llm_usage` | 기존 | 기존 | `complete` 안 — 요약도 같은 이벤트 |

- **요약 본문·메시지 본문·프롬프트·모델 응답은 어떤 로그에도 넣지 않는다**(R-NFR-004, 스킬 §9). 길이(`inChars`·`outChars`)와 id·ms만.
- `below_threshold`·`empty_range`는 로그를 남기지 않는다(speak마다 생기는 정상 경로).
- `mbId`는 없다(훅은 `Principal`을 받지 않는다).

## 6. 설정(env)

**env 변경 없음.** 새 키·새 검증 규칙이 없다([env.md](env.md) 머리말에 명시).

| 읽는 값 | 출처(`Config` 필드, parseEnv 결과를 컨테이너가 값으로 전달) | 타입·범위·기본 | 비밀값 |
|---|---|---|---|
| `contextMessages` | `CONTEXT_MESSAGES` (`wrangler.toml [vars]`) | 정수 1~100, 40 | 아님 |
| `summaryThreshold` | `MEMORY_SUMMARY_THRESHOLD` (`wrangler.toml [vars]`) | 정수 2~1000, 60. `> CONTEXT_MESSAGES` 검증은 parseEnv에 이미 있음 | 아님 |
| (간접) LLM 키·모델·타임아웃·예산 | `llm` thunk 안에서만 — memory는 키를 모른다 | — | `LLM_API_KEY`는 Secrets |

- 요약 상수(`SUMMARY_BATCH_MAX` 100 · `SUMMARY_INPUT_CHARS_MAX` 20000 · `SUMMARY_BUDGET_MS` 25000 · `SUMMARY_TARGET_CHARS` 2000)는 코드 상수다. env 키로 올리지 않는다(요구에 운영 조정 항목이 없다 — 스킬 §11).
- 쓰는 키 없음. 바인딩을 읽지 않는다.

## 7. DB 스키마·마이그레이션

- **마이그레이션 없음.** `memory` 테이블(`room_id` PK · `summary` NOT NULL DEFAULT '' CHECK ≤ 4000 · `source_until_id` NOT NULL DEFAULT 0 CHECK ≥ 0 · `updated_at` NOT NULL)과 `messages(room_id, id)` 인덱스는 `0001_init.sql`에 있다. 다음 번호 `0004`는 쓰지 않는다.
- 저장소 확장(공개 API·SQL 전문)은 [db.md](db.md) §13: `memory.getState`·`memory.putSummary`·`memory.advance`, `messages.countAfter`·`messages.listAfter`. 기존 `memory.getSummary`(speak 경로)·`SQL_MEMORY_DELETE_BY_ROOM`(방 삭제 batch)은 그대로.
- `memory.updated_at` = 마지막 저장 시각(자동 요약 반영·PUT). **`rooms.updated_at`은 두 경우 모두 바꾸지 않는다**(§11 D-MEM-5).
- CHECK `length(summary) <= 4000`은 SQLite 문자 수(코드 포인트)다. 서비스의 `countCodePoints`와 단위가 같다. 자동 요약은 `fitSummary`가, PUT은 검증이 이 상한을 먼저 지킨다.

### 7.1 D1 비용 (무료 플랜: 일 읽기 500만 행 · 쓰기 10만 행)

| 경로 | 읽기 | 쓰기 |
|---|---|---|
| speak 뒤 훅, 기준 이하(대부분) | 쿼리 2개: memory PK 1행 + 미요약 범위 ≤ 141행(보통 ≤ 60) | 0 |
| 요약 실행 1회 | 위 + 예산 1행 + 대상 ≤ 100행 | 사용량 누적 1~2회 + `advance` 1회 |
| E13 GET | `rooms.exists` 1행 + memory 1행 | 0 |
| E14 PUT | 레이트리밋(미들웨어) + `putSummary` 1문장(존재 확인 포함) | 1~2(레이트리밋) + 1 |

## 8. 테스트 계획

번호는 server 설계 전체 연번 다음(`SRV-T-295` 다음 296부터). 이 문서는 296~315, 델타 문서가 316~327.

### 8.1 단위·통합 — `server/test/memory.test.ts` (workers pool D1 + `FakeProvider` + 가짜 시계·수집 로거)

공통 준비: `resetDb` → 방 1개 + 메시지 N개 직접 INSERT(오래된 → 새), 서비스는 `createMemoryService({ db: createDb(env.DB), now, logger, contextMessages: 40, summaryThreshold: 60, llm: () => createLlm({ provider: fake, timeoutMs: 60000, logger, now, sleep, meter? }) })`.

| ID | 대상 | 조건 | 기대 |
|---|---|---|---|
| SRV-T-296 | `planSummary`·`pendingCountCap` | (60,60,40)·(61,60,40)·(80,60,40)·(250,60,40)·(42,41,40)·cap(60,40)·cap(1000,40) | 0·21·40·100·2·141·1001 |
| SRV-T-297 | `capByChars` | 2000자 × 15행 / 10자 × 5행 / 첫 행 25000자(직접 만든 값) | 10행 / 5행 / 1행 |
| SRV-T-298 | `fitSummary` | 4000자 정확히 · 4001자(3500 위치에 `\n`) · 4001자(경계가 2000 위치뿐) · 이모지 4000개 + 1 | 그대로(false) · 3500까지(true) · 4000에서(true) · 4000 코드 포인트(true), 모두 `countCodePoints ≤ 4000` |
| SRV-T-299 | 기준 이하 | 메시지 60개, 행 없음 | `skipped/below_threshold`, `fake.calls` 0, memory 행 없음, 로그 없음 |
| SRV-T-300 | 첫 요약 | 메시지 61개, 행 없음 | `summarized`, `messages` 21, `untilId` = 21번째 id. 프롬프트 사용자 턴에 1~21번 본문이 있고 22~61번 본문은 **없음**, `[지난 이야기 요약]` 줄 없음. 행 생성: `summary` = Fake 출력, `source_until_id` = 21번째 id, `updated_at` = now |
| SRV-T-301 | 이어 요약 | 행(`'지난 요약'`, source = 10번째 id) + 메시지 80개 | pending 70 → take 30(11~40번). 프롬프트에 `[지난 이야기 요약] 지난 요약`, 1~10번 본문 없음. 저장 `source_until_id` = 40번째 id, summary 교체 |
| SRV-T-302 | 배치 상한 | 메시지 250개, 행 없음 | 1회차 100개(`untilId` = 100번째), 2회차 호출 시 pending 141(상한) → 100개 더, 3회차 pending 50 → 건너뜀 |
| SRV-T-303 | 글자 상한 | 2000자 메시지 61개 | take 21이지만 `messages` 10, `untilId` = 10번째 id |
| SRV-T-304 | 동시 2회 | 61개. Fake 각본을 지연 promise로 두 호출 모두 LLM 대기에 세운 뒤 순서대로 풀기 | 결과 하나 `summarized`, 하나 `conflict`. 행은 먼저 풀린 쪽 출력, `source_until_id` 1회 전진. `fake.calls` 2 |
| SRV-T-305 | 요약 중 PUT | 61개, LLM 대기 중 `put(roomId, { summary: '사람이 고침' })` | 요약 `conflict`, 행 summary `'사람이 고침'`, `source_until_id` 0 그대로. 다음 호출은 `'사람이 고침'`을 `previous`로 같은 구간을 요약 |
| SRV-T-306 | 요약 중 방 삭제 | LLM 대기 중 `rooms.deleteRoom` | `conflict`, memory 행 0, throw 없음 |
| SRV-T-307 | LLM 실패 | 각본 `http_5xx`×2 / `http_4xx` / `blocked` / 공백 출력 | 각각 `failed/llm`(`LLM_FAILED`·`LLM_FAILED`·`LLM_EMPTY`·`LLM_EMPTY`), memory 불변, resolve, warn `memory_summary_failed` |
| SRV-T-308 | 예산 초과 | meter 주입 + `llm_usage` 이번 달 `est_krw` = 예산 | `skipped/budget`, `fake.calls` 0, info `memory_summary_skipped` |
| SRV-T-309 | D1 실패 | `getState`가 throw하는 가짜 `Db` / `advance`가 throw하는 가짜 `Db` | `failed/read` / `failed/write`(`code` `INTERNAL`), resolve |
| SRV-T-310 | 출력 초과 | Fake 출력 4500자(3600 위치 `\n`) | 저장 summary 3600자, `truncated: true`, D1 CHECK 통과, `memory_summarized.truncated` true |
| SRV-T-311 | 요약 시간 예산 | `timeoutMs` 60000, Fake가 `input.timeoutMs` 기록. ① 정상 ② 1차 `timeout`(가짜 시계 25000 진행) | ① 1차 `timeoutMs` 25000 ② 재시도 없음(`calls` 1), `failed/llm` `LLM_FAILED` |
| SRV-T-312 | 로그 비노출 | 고유 문자열을 메시지·기존 요약·Fake 출력에 넣고 요약 1회 | 수집 로그 JSON 어디에도 그 문자열 없음. `memory_summarized` 필드 집합이 §5.1과 같다 |
| SRV-T-313 | `get` | 행 없음 / 행 있음 / 방 없음 | `{ '', 0, null }` / 행 값 / `NOT_FOUND` |
| SRV-T-314 | `put` | `'  a  '` · `''` · 이모지 4000개 · 4001자 · `summary: 1`(비문자열) · 행 없음 · 행(source 7) 있음 · 방 없음 | `'a'` · `''` 저장 · 저장 · `VALIDATION_ERROR`(trap `Db`로 DB 0회) · `VALIDATION_ERROR` · 행 생성 source 0 · source 7 유지 · `NOT_FOUND`. 모든 경우 `rooms.updated_at` 불변 |
| SRV-T-315 | 키 없음 | `llm` thunk가 `ConfigError` throw, 메시지 61개 | `failed/budget`(`CONFIG_INVALID`), resolve |

- SRV-T-298·310의 경계 위치(3500·3600)는 경계 문자 **앞**의 글자 수다. 경계 문자(`\n`)는 `trimEnd`로 빠지므로 결과는 정확히 3500·3600자다(구현 동기화).

### 8.2 다른 문서의 테스트 (델타)

| 범위 | ID | 문서 |
|---|---|---|
| llm 요약 프롬프트·후처리·`budgetMs`·사용량 | SRV-T-316~321 | [llm.md](llm.md) §14.7 |
| db 저장소 5함수 | SRV-T-322~325 | [db.md](db.md) §13.5 |
| messages 등록 실패 삼킴 | SRV-T-326 | [messages.md](messages.md) §13.4 |
| 컨테이너 배선(speak → 훅 → 요약) | SRV-T-327 | [index.md](index.md) §13.3 |

- 라우트(E13·E14)와 "실패 주입 시 speak 201" 종단 테스트는 contract 몫이다(「contract 인계」 테스트 요청).

### 8.3 수동 체크리스트 (실제 Gemini — 지인 키를 `server/.dev.vars`에 넣은 로컬에서만)

1. 메시지 61개 이상인 방(시드 또는 직접 입력)에서 speak → `wrangler tail`(또는 `.dev.log`)에 `memory_summarized`가 찍히고 `ms`가 25000 미만인지.
2. GET memory로 요약을 읽어 3인칭·한국어·2000자 안팎·지시 문장이 그대로 들어가지 않았는지 눈으로 확인.
3. 기존 요약이 약 2000자인 상태에서 다시 기준을 넘겨 합본 시간을 잰다. 20초를 넘으면 §11 D-MEM-3 기준에 따라 보고.
4. 다음 speak의 대사가 요약 내용(이름·약속)을 이어받는지.
5. `llm_usage` 행의 `calls`가 요약 1회만큼 늘었는지(`wrangler d1 execute --local`의 SELECT).
6. 배포 환경에서는 `wrangler tail`의 요약 요청 `cpuTime`이 10ms 안인지.

## 9. contract 요구 명세

server가 노출할 서비스와 엔드포인트 후보다. 경로·JSON 확정은 contract(api.md v0.7 예정). 상세 형식은 아래 「contract 인계 요구 명세」.

| 서비스 | 엔드포인트 후보 | 입력 | 출력 | 에러 | 인증·레이트리밋 | 이유 |
|---|---|---|---|---|---|---|
| `memory.get(roomId)` | E13 `GET /api/rooms/:id/memory` | 경로 `id` | `MemoryState` 200 | `NOT_FOUND` + 토큰 3종 | 토큰 필요 · 카운트 안 함 | R-MEM-001 "토큰 필요"(읽기지만 예외) |
| `memory.put(roomId, { summary })` | E14 `PUT /api/rooms/:id/memory` | 경로 `id`, 본문 `{ summary }` | `MemoryState` 200 | `VALIDATION_ERROR`·`NOT_FOUND`·`RATE_LIMITED` + 토큰 3종 | 토큰 필요 · 쓰기 레이트리밋 1회 | R-MEM-001 · R-AUTH-005 |
| `memory.summarizeIfNeeded` | 없음(컨테이너가 speak 훅으로만 연결) | — | — | — | — | R-MEM-002 — 수동 요약 버튼은 요구 밖 |

## 10. 요구 추적표

| 요구ID | 반영 절 | 테스트 | 상태 |
|---|---|---|---|
| R-MEM-001 🔒 | §2 `get`·`put` · §2.1 · §5 · §9 · 「contract 인계」 | SRV-T-298·313·314·323 · API-T(contract) | ✅(설계) |
| R-MEM-002 🔒 | §4.1~§4.3 · [messages.md](messages.md) §13 · [index.md](index.md) §13 | SRV-T-296·297·299~303·307·309~311·315·326·327 | ✅(설계) |
| R-MEM-003 | §4.4 · §11 D-MEM-2·3 | SRV-T-304~306·324 | ✅(설계 — Cron 미도입 결정·전환 기준 기록) |
| R-LLM-007 🔒 | §4.1 ④⑥ · [llm.md](llm.md) §14.5 | SRV-T-308·321 | ✅(설계) |
| R-LLM-003 🔒 · R-LLM-006 | [llm.md](llm.md) §14.3 | SRV-T-316·317 | ✅(설계) |
| R-CHAT-012 🔒 | 「contract 인계」 · 「ui 인계 메모」 | ui 몫 | 인계 |
| R-DB-001 🔒 | §7 (변경 없음) | SRV-T-310·324(CHECK) | ✅(변경 없음) |
| R-NFR-001 🔒 | §4.3 (speak와 분리, 요약 25초) | SRV-T-311 | ✅(영향 없음 확인) |
| R-NFR-004 | §5.1 | SRV-T-312 | ✅(설계) |

## 11. 설계 결정 노트

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-MEM-1 | 기준 판정의 "방 메시지 수" = **`source_until_id` 이후(미요약) 메시지 수** | 방 전체 메시지 수 | 첫 요약 전에는 두 값이 같다. 전체 수로 세면 61개를 넘은 뒤 **speak마다** 요약이 돈다(대상 1~2개, 2000자 요약을 매번 다시 씀 — 요약 1회 추정 약 10~20원, speak 1회의 수 배). 미요약 수로 세면 21개마다 1회다. 요구 문구와 다른 해석이라 열린 질문 1로 확인받는다 |
| D-MEM-2 | 중복 방지 = memory 행 조건부 UPSERT 한 문장(기대값 `source_until_id` **와 `summary`**) | ① `summarizing_until` 플래그 컬럼(0004) ② `source_until_id`만 비교 ③ speak 잠금 재사용 | ① 마이그레이션이 필요하고 플래그 만료·해제 경로가 는다. 중복 LLM 호출 비용만 줄인다(정확성은 같다). ② 요약 중 PUT 편집을 덮어쓴다. ③ 요약 30초 동안 speak가 409로 막힌다. 한 문장이라 "INSERT … DO NOTHING 후 재시도"도 필요 없다 |
| D-MEM-3 | **Cron(`scheduled`) 미도입.** `waitUntil` 경로만 | S4에서 Cron 병행·대체 | 요구가 "실패가 반복되면" 대체라 근거(관찰)가 먼저다. 요약 1회가 25초 예산 안이고(목표 2000자), 30초를 넘겨 끊겨도 D1이 그대로라 다음 speak가 복구한다. Cron은 `wrangler.toml [triggers]`·`scheduled` 진입점·대상 방 선정 쿼리·주기 비용이 는다. **전환 기준**: ⓐ 운영 D1에서 아래 점검 SQL로 미요약 수가 `THRESHOLD + 40`(기본 100)을 넘는 방이 있고 ⓑ 그 방의 `memory_summary_failed`가 `stage: 'llm'`·`ms ≥ 24000`(시간 초과)이거나, `wrangler tail` 관찰에서 요약 시도의 10% 이상이 시간 초과면 Cron 전환을 요구로 올린다(사용자 승인). 그 전 완화책: `SUMMARY_TARGET_CHARS`·`SUMMARY_BATCH_MAX` 축소. **전환 설계 요지**: `[triggers] crons = ["*/10 * * * *"]`, `index.ts`에 `scheduled` export, 미요약 수 > 기준인 방 최대 몇 개를 골라 같은 `summarizeIfNeeded`를 호출(예산만 크게). 조건부 UPSERT라 `waitUntil`과 공존해도 안전하고 마이그레이션은 필요 없다 |
| D-MEM-4 | 4000자 초과 출력은 **줄·문장 경계에서 잘라 저장**(+ 프롬프트로 2000자 목표 지시) | ① 재요청 1회 ② 저장하지 않고 다음 기회 | ① 25초짜리 호출을 한 번 더 하면 30초 한계를 넘는다. ② 같은 구간이 매번 실패해 비용만 반복된다. 목표 2000자라 초과는 드물고, 잘린 사실은 `truncated` 로그로 남는다. 대가: 잘린 꼬리(최근 사건)가 빠질 수 있다 — 유저가 시트에서 고친다 |
| D-MEM-5 | 자동 요약·PUT 모두 `rooms.updated_at`을 **바꾸지 않는다** | PUT만 갱신 · 둘 다 갱신 | `updated_at`은 방 목록 정렬 기준(대화 활동, R-ROOM-005 목록에 메시지 쓰기만 있음). 백그라운드 요약이 목록 순서를 바꾸면 사용자가 원인을 알 수 없다. 이름 변경도 갱신하지 않는 선례(D-ROOM-4) |
| D-MEM-6 | 요약 프롬프트·후처리는 `llm/summary.ts`(llm 소유) | `memory/prompt.ts`(위임문 예시) | 스킬 §1: 프롬프트 조립은 llm 몫. 구분자·`defang`·`toDataLine`이 `llm/prompt.ts` 내부 export라 llm 안에서 공유해야 주입 완화 규칙이 한 곳에서 바뀐다(D-LLM-28 선례). memory는 조립 결과만 받는다 |
| D-MEM-7 | 요약 시간 예산은 `CompleteOptions.budgetMs?`(llm 델타)로 넘긴다 | ① `spentMs`에 66000−25000을 넣는 우회 ② `Llm.summarize` 새 메서드 | ① 이름과 뜻이 어긋난다. ② 재시도·사용량·로그 경로를 복제한다. 선택 필드라 기존 호출 무수정 |
| D-MEM-8 | 1회 상한 100개·본문 합계 2만 자 | 무제한 · 200개 | 입력이 크면 지연·비용이 커져 25초를 넘긴다. 정상 경로는 21개라 상한은 실패 누적·설정 변경 때만 걸린다. 남은 구간은 다음 speak가 이어서 한다 |
| D-MEM-9 | `summarizeIfNeeded`는 throw하지 않고 `SummarizeOutcome`을 돌려준다 | 실패를 throw해 `runAfterSpeak`가 잡게 | 단계별 실패 분류·로그를 memory 한 곳에 둔다. 테스트가 로그 대신 결과로 단언한다. `runAfterSpeak`의 catch는 최종 안전망으로 남는다 |
| D-MEM-10 | PUT은 마지막 쓰기 승리(기대 버전 없음) | PUT 본문에 기대 `updatedAt`, 어긋나면 409 | 요구에 충돌 감지가 없고 새 에러 코드(R-API-002 15종 고정)가 필요하다. 반대 방향(요약 중 PUT)은 D-MEM-2로 편집을 지킨다. ui 메모로 안내 — 열린 질문 2 |
| D-MEM-11 | PUT `summary`는 앞뒤 trim 후 판정·저장 | 원문 그대로 | 다른 텍스트 필드(D-MSG-7·R-ROOM-002)와 같다. api.md §5.7 "trim 여부는 S4 설계가 정한다"에 대한 답 |
| D-MEM-12 | GET은 행이 없으면 404가 아니라 기본값(`''`·0·`null`) | 404 | 행은 첫 요약·첫 편집 때 생긴다. 방은 있는데 요약이 없는 상태는 정상이다. `updatedAt: null`은 settings 기본값 선례(`isDefault` 응답의 `updatedAt null`) |
| D-MEM-13 | 함수 이름 `get`·`put`·`summarizeIfNeeded` | 스킬 §4 예시 `maybeSummarize` · `getMemory` | `SettingsService.get`·`put` 선례와 rtm.md·위임문 이름을 따른다. 스킬 예시 이름은 설명용이다 |
| D-MEM-14 | 요약은 speak 잠금(`speaking_until`)을 쓰지 않는다 | 요약 동안 잠금 | 요약 정확성은 D-MEM-2가 지킨다. 잠그면 요약 30초 동안 버튼이 409다 |
| D-MEM-15 | 미요약 수는 `pendingCountCap`까지만 센다 | 전체 COUNT | 요약이 계속 실패한 방에서도 speak마다 읽는 행 수가 141행(기본)을 넘지 않는다. 판정·배치 계산에 그 이상은 필요 없다 |
| D-MEM-16 | 요약 전 `ensureBudget`, 초과면 건너뜀(info) | 게이트 없이 호출 · 실패 처리 | R-LLM-007 "호출 전 거절"과 [llm.md](llm.md) §12.7 권고. 건너뛴 구간은 다음 달 첫 speak 뒤에 요약된다 |

점검 SQL(D-MEM-3 ⓐ — 읽기 전용, `wrangler d1 execute <DB> --remote --command`로 실행. 삭제·변경 문장 아님):

```sql
SELECT r.id,
       (SELECT COUNT(*) FROM messages m
         WHERE m.room_id = r.id AND m.id > COALESCE(mem.source_until_id, 0)) AS pending
FROM rooms r LEFT JOIN memory mem ON mem.room_id = r.id
ORDER BY pending DESC
LIMIT 10
```

확인 필요(열린 질문은 보고에도 적는다):

1. D-MEM-1 기준 해석(미요약 수). 요구 문구 그대로(전체 수)면 speak마다 요약 비용이 든다.
2. D-MEM-10 편집 경합. 시트를 연 채 자동 요약이 끝나면 저장이 그 요약을 덮는다. 충돌 감지(409)가 필요하면 요구·에러 코드 추가가 필요하다.
3. 요약 목표 2000자(`SUMMARY_TARGET_CHARS`)는 30초 한계에서 정한 값이다. 더 긴 요약을 원하면 Cron 전환과 함께 다시 정한다.

## 「contract 인계 요구 명세」 (api.md v0.7 반영용)

공통: 두 경로 모두 방 id 경로 파라미터 규칙은 기존 방 경로와 같다(아무 문자열 → 없으면 404). 에러 본문은 `{ error: { code, message } }`(R-API-002, 새 코드 없음). 시각은 epoch ms, 필드는 camelCase(R-API-004).

### shared 타입 (contract-implementer가 먼저 추가 — server는 `@shared/types`에서 재노출)

```ts
// shared/src/types.ts — 이름은 contract 확정. 아래는 server 쪽 요청안(PutCharacterSettingsBody·CharacterSettingsResponse 선례)
/** E13·E14 응답 */
export type MemoryResponse = {
  /** 0~4000 코드 포인트. 요약이 없으면 '' */
  summary: string
  /** 요약에 반영된 마지막 메시지 id. 0 = 아직 없음. 화면은 표시하지 않아도 된다 */
  sourceUntilId: number
  /** 마지막 저장 시각(자동 요약·편집). 한 번도 저장되지 않았으면 null */
  updatedAt: number | null
}
/** E14 요청 본문 */
export type PutMemoryBody = { summary: string }
```

`shared/src/endpoints.ts`에 경로 상수(예: `roomMemory`) 1개. `MEMORY_SUMMARY_MAX`·`countCodePoints`·`normalizeText`는 이미 `@shared/limits`에 있다.

### E13 `GET /api/rooms/:id/memory` — 장기기억 보기

| 항목 | 값 |
|---|---|
| 미들웨어 | `requireToken`만(등급 통과자 누구나 — 주인 전용 아님). 레이트리밋 **카운트 안 함**(읽기) |
| 서비스 | `services.memory.get(id)` |
| 200 | `MemoryResponse` — 예: `{ "summary": "시엘은 …", "sourceUntilId": 1234, "updatedAt": 1791350400000 }` |
| 200(행 없음) | `{ "summary": "", "sourceUntilId": 0, "updatedAt": null }` |
| 404 | `NOT_FOUND` `방을 찾을 수 없습니다.` |
| 401·403 | `TOKEN_REQUIRED`·`TOKEN_INVALID`·`LEVEL_TOO_LOW`(기존 토큰 규약 — 토큰 없으면 읽기 전용 화면이라 호출하지 않는다) |
| 500 | `INTERNAL`(D1 장애) |
| 캐시 | 다른 `/api/*`와 같다. 자동 요약이 바꾸므로 화면이 캐시하지 않는다 |

### E14 `PUT /api/rooms/:id/memory` — 장기기억 편집

| 항목 | 값 |
|---|---|
| 미들웨어 | `requireToken` → `rateLimitWrites`(1회 카운트, 기존 쓰기와 같은 분 창) |
| 요청 | `Content-Type: application/json`, 본문 `{ "summary": string }`. 타입 검증(zod)은 라우트, 길이 판정은 서비스(D-MSG-4 원칙). 알 수 없는 키·비객체 처리는 기존 쓰기 경로 규약을 따른다 |
| 길이 규칙 | 앞뒤 trim 후 코드 포인트 0~4000(`MEMORY_SUMMARY_MAX`). 0자 허용(요약 비우기). 중간 줄바꿈 유지. 저장값은 trim 결과 |
| 본문 상한 | 4000 코드 포인트 × UTF-8 최대 4바이트 + JSON 이스케이프 여유 → **32 KiB 이상** 권고(값은 contract 확정) |
| 서비스 | `services.memory.put(id, { summary })` |
| 200 | `MemoryResponse` — `summary` = 저장값(trim 결과), `sourceUntilId` = **기존 값 유지**(행이 없었으면 0), `updatedAt` = 저장 시각 |
| 400 | `VALIDATION_ERROR` `장기기억은 0~4000자로 입력해 주세요.`(길이·비문자열 — 서비스 문구) / 라우트 본문 형식 오류는 기존 라우트 문구 |
| 404 | `NOT_FOUND` `방을 찾을 수 없습니다.` |
| 429 | `RATE_LIMITED` + `retryAfterSec`·`Retry-After` (기존 규약) |
| 401·403·500 | E13과 같다 |
| 부수 효과 | `memory` 행 UPSERT 1문장. **`rooms.updated_at` 갱신 없음**(목록 순서 불변). AI 호출 없음 |
| 판정 순서 | 토큰 → 레이트리밋 → 본문 형식(라우트) → 길이(서비스, DB 전) → 방 존재 |

### speak(E9) 쪽 변화 (계약 형식 불변)

- E9 응답·에러·판정 순서는 바뀌지 않는다. 성공 뒤 서버가 백그라운드로 요약할 수 있다는 사실만 api.md §4.13 부수 효과 줄에 더한다("응답 뒤 장기기억 자동 요약 — 실패해도 응답 불변, R-MEM-002").
- **라우트 테스트 요청**: speak 성공 케이스는 `createExecutionContext()`로 만든 컨텍스트를 `waitOnExecutionContext(ctx)`로 기다린 뒤 끝낸다. S4부터 speak가 백그라운드 작업을 등록하므로, 기다리지 않으면 다음 테스트의 `resetDb`와 겹칠 수 있다(현재 `routes-generate.test.ts`는 컨텍스트를 만들기만 한다).
- 테스트 요청(contract API-T 번호): E13 행 없음 기본값·행 값·404·401 / E14 0자·4000자(이모지)·4001자 400·비문자열 400·404·429 카운트·GET은 카운트 안 함·`sourceUntilId` 유지·`rooms.updatedAt` 불변 / E9 "요약 실패 주입(Fake 각본 2번째 호출 실패)에도 201·본문 동일".

### handoff

- 갠홈 쪽에 전달할 것 없음(토큰·임베드 주소 불변). 운영 메모로 "요약 호출도 월 AI 비용에 포함된다"를 기존 S3b 비용 메모 옆에 한 줄 더하는 것을 권고(contract-designer 판단).

## 「ui 인계 메모」 (R-CHAT-012 — MemorySheet 설계용)

- **진입·권한**: ⋯ 메뉴의 "장기기억" 항목. E13 GET도 토큰이 필요하므로 **토큰 없는 읽기 전용 화면에서는 항목을 렌더하지 않는다**(보기만 하는 경로도 없다).
- **빈 상태**: `summary === ''`(특히 `updatedAt === null`)이면 빈 입력창과 안내를 보인다. 자동 요약은 미요약 메시지가 60개(기본)를 넘은 뒤 speak가 끝나면 생긴다.
- **길이**: 앞뒤 trim 후 코드 포인트 0~4000. 화면 카운터는 `@shared/limits`의 `countCodePoints(normalizeText(v))`와 `MEMORY_SUMMARY_MAX`를 쓴다(이모지 1개 = 1자). 4000 초과면 저장 버튼 비활성. 0자 저장은 허용(요약 비우기).
- **저장 중 잠금**: PUT 동안 저장 버튼·입력 비활성(중복 제출 방지). 실패하면 입력 내용을 보존하고 에러 문구를 보인다(400 문구는 서버 메시지 그대로, 429는 기존 쓰기와 같은 안내).
- **저장 결과**: 응답 `summary`(trim된 저장값)로 입력을 갱신한다. `sourceUntilId`는 내부 값이라 표시하지 않아도 된다. `updatedAt`은 표시 여부를 ui가 정한다(요구 없음).
- **자동 요약과의 경합**: speak가 끝난 뒤 최대 약 30초 동안 서버가 백그라운드로 요약을 고쳐 쓸 수 있다.
  - 시트를 **열 때마다 GET**한다(캐시 금지). speak 직후 열면 아직 이전 요약일 수 있다.
  - 시트를 연 채 자동 요약이 끝난 뒤 저장하면, 저장한 내용이 그 자동 요약을 **대체**한다(서버는 마지막 저장을 따른다).
  - 반대로 자동 요약 도중에 저장하면 편집이 남고, 자동 요약은 다음 캐릭터 발화 뒤에 편집본을 기준으로 다시 이루어진다.
  - 안내 문구 후보: "저장하면 지금 요약을 이 내용으로 바꿉니다. 대화가 길어지면 이 요약에 새 줄거리가 자동으로 덧붙습니다." (문구·노출 위치는 ui 결정)
- **요구 밖**: 요약 이력·여러 요약본·"지금 요약" 수동 버튼은 만들지 않는다.
- **편집 내용이 AI에 주는 영향**: 저장된 요약은 다음 캐릭터 발화부터 프롬프트의 "지난 이야기 요약"으로 들어간다. 요약 안의 지시 문장은 설정을 바꾸지 못한다(주입 완화 — 서버 처리, 화면 안내 불필요).

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-07 | S4 구현 동기화(소스 기준, server 381/381, SRV-T-296~327): 상태 줄, §8.1 SRV-T-298·310 경계 위치 해석 1줄. 파일 구성(`server/src/memory/{index,service,summarize}.ts`·`server/src/llm/summary.ts`)·공개 API·순수 함수 4종·상수 3종·`MemoryDeps`·`SummarizeOutcome`은 설계와 같다. 요약 프롬프트 쪽 차이(`SUMMARY_LABEL` 내부 export·라벨 제거 방식)는 [llm.md](llm.md) §14에 반영 |
| 2026-10-07 | S4 초안 작성(신규): `get`·`put`·`summarizeIfNeeded`, 순수 함수 4종·상수, 자동 요약 흐름·구간 규칙·25초 예산, 조건부 UPSERT 낙관적 잠금(`source_until_id` + `summary`), Cron 미도입·전환 기준, SRV-T-296~315, D-MEM-1~16, contract·ui 인계 |
