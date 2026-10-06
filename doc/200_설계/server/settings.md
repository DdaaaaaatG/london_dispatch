# settings 모듈 설계

- 상태: 구현 완료(2026-10-06, server 318/318) · api.md v0.5 대조 정정(§12 N1~N7 · §12.1 M1~M6 대조표) · 최종 갱신: 2026-10-06
- 묶음: **S3c**(캐릭터 설정 화면 — 갠홈 주인 전용). 이 문서의 공개 API는 전부 S3c에서 구현한다. 작업 모드는 보강(rooms·chat·server·contract 구현 완료 위에 추가).
- 결정 출처: `doc/200_설계/architecture/s3c-02-전반설계.md`(결정 1~6) · `s3c-03-인계패킷.md` §1 · requirements §11-1(R-SET-001~012) · `doc/state.json` decisions(2026-10-06 승인 ①, 같은 날 Q2 수정 — **`OWNER_MB_IDS`에는 지인(갠홈 주인) 회원 ID만** 둔다. 02 §11 Q2 권고 「지인+사용자」를 대체) · 메인 세션 결정 2026-10-06(400 문구 단일 소스 = shared `checkCharacterSettings`, api.md v0.5 N1~N7 전부 수용).
- 계약 정본: `doc/200_설계/contract/api.md` v0.5 §2.7(주인 판정) · §4.15(E15) · §4.16(E16·400 문구 표·검사 순서) · §5.8(`shared/src/settings.ts`) · §15.12(N1~N7). 이 문서는 그 규약을 server 쪽에서 지키는 방법만 적고 문구·상한을 다시 옮겨 적지 않는다.
- 관련 문서: [env.md](env.md)(`OWNER_MB_IDS`) · [auth.md](auth.md)(§12 `requireOwner`) · [db.md](db.md)(§2.5 `characterSettings`·§7.6 `0003`) · [llm.md](llm.md)(§3.4 시드 강등·§7.3 조립 확장) · [messages.md](messages.md)(§4.4 설정 읽기) · [index.md](index.md)(§2.3.1 `Services.settings` 배선).

## 1. 목적

설정 모듈은 캐릭터 대본 보관함이다. 갠홈 주인만 대본을 꺼내 고치고, 캐릭터가 말할 차례가 오면 그때 보관함에서 최신 대본을 꺼내 읽는다. 보관함이 비었거나 대본이 찢겨 있으면 처음 받은 원본(시드)을 읽는다. 보관함 자체가 고장 나면(D1 장애) 원본으로 덮지 않고 고장이라고 알린다.

세바스찬·시엘 2명 + 공통 `world`(화면 이름 `세계관`)의 캐릭터 관련 텍스트를 D1 `character_settings`(1행 문서)에 저장·조회하고, speak·regenerate가 그 값(없으면 시드)으로 프롬프트를 조립하도록 프롬프트 입력형으로 내준다.

| 요구ID | 내용 | 이 문서의 몫 |
|---|---|---|
| R-SET-001 🔒 | 주인 = 유효 토큰 + `mbId ∈ OWNER_MB_IDS`. 아니면 `403 OWNER_ONLY`. 비우면 전원 403 | 판정은 [auth.md](auth.md) §12. 이 모듈은 주인 판정이 끝난 호출만 받는다 |
| R-SET-002 🔒 | 본체 = `world` + 2명 × 11필드, strict, trim·코드 포인트 상한, 필수 3종 | §2.2 스키마·§2.3 정규화 |
| R-SET-003 🔒 | D1 1행(0003), 행 없으면 시드(`isDefault`), 저장 시 version+1, 캐시 없음, 재검증 실패 행은 시드 + 로그 | §2.4·§4 |
| R-SET-005 🔒 (server 몫) | 400은 첫 위반 1건 한국어 | 문구는 shared가 만든다(§5.1). server는 판정과 `put` 재검증만 |
| R-SET-006 🔒 | 프롬프트 조립 확장, 빈 필드면 현행 문자열, defang, outputRules·GUARD_RULES 편집 불가 | `loadForPrompt`가 입력을 만든다. 조립은 [llm.md](llm.md) §7.3 |
| R-SET-012 | 로그에 설정 본문·필드 값 미기록. 3종 이벤트만 | §5.2 |
| R-LLM-002 🔒(개정) | 저장은 D1, JSON 파일은 시드 | §2.4(시드 대체), 시드 생성은 [llm.md](llm.md) §3.4 |
| R-LLM-003 🔒(개정) | 시스템 = world + 기본 정보·persona·성격 태그·외형·관계·speech·샘플 대사·rules + outputRules + 주입 완화 문구 | `loadForPrompt` 반환형(§2) |
| 관련 R-AUTH-005 · R-AUTH-006 🔒 · R-NFR-005 | PUT 레이트리밋(라우트 미들웨어), 식별은 `mbId`만, CPU 10ms | §4·§5.2 |

## 2. 공개 API

```ts
// server/src/settings/index.ts — 공개 진입(아래 두 파일 재노출)

// ---- server/src/settings/schema.ts ----
import { z } from 'zod'
import {
  CHARACTER_FIELD_KEYS,
  CHARACTER_FIELD_SPECS,
  SETTINGS_CHARACTER_IDS,
  WORLD_FIELD_SPEC,
  checkCharacterSettings,
  type SettingsCheckResult,
} from '@shared/settings'

/**
 * 설정 본체 zod 스키마 — 정의 1곳. routes/schemas.ts(contract)의 putCharacterSettingsBody 가 재사용한다.
 * 역할은 통과/실패 판정뿐이다. 한국어 문구를 담지 않는다(문구는 shared checkCharacterSettings — api.md §4.16).
 * strict 3단(본체·characters·캐릭터). 두 캐릭터·11필드 키 전부 필수(선택 필드도 키는 있어야 하고 값은 '' · []).
 * 상한·필수는 WORLD_FIELD_SPEC·CHARACTER_FIELD_SPECS 에서 읽는다(숫자 리터럴 중복 금지).
 * 출력은 정규화된 값이고 z.output<typeof characterSettingsSchema> 는 shared CharacterSettings 에 대입 가능해야 한다(N2).
 * (구현 2026-10-06) 출력 타입을 z.ZodType<CharacterSettings, unknown> 으로 고정했다(as unknown as 단언). CharacterSettings 는 @shared/types 에서 import
 */
export const characterSettingsSchema: z.ZodType<CharacterSettings, unknown>

/**
 * 라우트 밖 검증(서비스 put 재검증·D1 행 재검증)용. throw 하지 않는다. 반환형은 shared SettingsCheckResult 그대로.
 * zod 와 checkCharacterSettings 가 둘 다 통과해야 ok 이고, 값은 checkCharacterSettings(raw).value 다(N4).
 * 실패면 checkCharacterSettings 의 첫 위반(issue.path · issue.message)을, 둘이 어긋나 zod 만 실패하면
 * { path: [], message: ERROR_MESSAGES.VALIDATION_ERROR }(안전망 — api.md §4.16)를 돌려준다.
 */
export const parseCharacterSettings = (raw: unknown): SettingsCheckResult

// ---- server/src/settings/service.ts ----
import type { CharacterSettings, CharacterSettingsResponse } from '@shared/types'
import type { Principal } from '../auth'
import type { Db } from '../db'
import type { PromptSettings } from '../llm'
import type { Logger } from '../logger'

export type SettingsService = {
  /** D1 행 → 재검증 → 응답형. 행 없음·재검증 실패면 시드(isDefault: true, version 0, updatedAt null). D1 throw 는 전파(500 INTERNAL, N5) */
  get: () => Promise<CharacterSettingsResponse>
  /** 입력은 routes 가 zod 로 이미 검증한 값. 정규화(trim·빈 항목 제거) → UPSERT → 응답형 */
  put: (settings: CharacterSettings, by: Principal) => Promise<CharacterSettingsResponse>
  /** speak·regenerate 용. get 과 같은 출처, 프롬프트 입력형으로 */
  loadForPrompt: () => Promise<PromptSettings>
}

export type SettingsDeps = {
  db: Db
  logger: Logger
  now: () => number
}

export const createSettingsService = (deps: SettingsDeps): SettingsService
```

- `SettingsIssue`·`SettingsCheckResult` 타입은 **shared 소유**다. settings 모듈은 같은 이름의 타입을 따로 내보내지 않는다(메인 세션 결정 2).
- `PromptSettings`는 [llm.md](llm.md) §3.4가 정의하는 별칭이다. 구조는 03 §1.3의 `{ profiles: Readonly<Record<CharacterId, CharacterProfile>>; common: CommonPrompt }`와 **같다**(이름만 붙였다 — 유지 결정 4).
- `CharacterSettings`·`CharacterSettingsResponse`는 `@shared/types`(api.md §5.8.1)에서 import한다. 구현 순서상 contract-implementer의 shared 단계(03 §0.1 4단계)가 먼저다.
- 400 문구 생성 함수는 server에 두지 않는다. 라우트 훅 `settingsIssueMessage`(contract, `routes/schemas.ts`)가 shared `checkCharacterSettings`에서 문구를 가져온다.

### 2.1 함수 표

| 이름 | 인자 | 반환 | 실패 조건(에러 코드) | 요구ID |
|---|---|---|---|---|
| `characterSettingsSchema` | (zod) | 정규화된 `CharacterSettings` | zod 이슈(라우트가 400으로, 문구는 shared) | R-SET-002 |
| `parseCharacterSettings` | `unknown` | `SettingsCheckResult`(shared) | throw 없음 | R-SET-002·003·005 |
| `createSettingsService` | `SettingsDeps` | `SettingsService` | — | R-SET-003 |
| `get` | — | `Promise<CharacterSettingsResponse>` | D1 오류 전파 → `INTERNAL`(500). 시드 대체는 행 없음·재검증 실패만 | R-SET-003·004 |
| `put` | `settings, by` | `Promise<CharacterSettingsResponse>` | 재검증 실패 → `VALIDATION_ERROR`(400, 문구 = `parseCharacterSettings`의 `issue.message` — 라우트를 거치면 도달하지 않음). D1 오류 → `INTERNAL` | R-SET-003·005 |
| `loadForPrompt` | — | `Promise<PromptSettings>` | D1 오류 전파 → `INTERNAL`. 재검증 실패는 시드 | R-SET-003·006 |

### 2.2 본체 스키마 (R-SET-002 · N1 · N2)

필드 이름·화면 이름·필수·상한의 **정본은 api.md §5.8.4 `shared/src/settings.ts`**다. server는 아래 shared 이름을 import해서 스키마를 만들고 숫자를 옮겨 적지 않는다.

| shared 이름(api.md §5.8.4) | server에서 쓰는 곳 |
|---|---|
| `WORLD_FIELD_SPEC` | `world` 스키마(필수·상한) |
| `CHARACTER_FIELD_SPECS` | 캐릭터 필드 11개 스키마(`kind: 'text'`면 필수·상한, `'list'`면 개수·항목 상한) |
| `CHARACTER_FIELD_KEYS` | 캐릭터 객체의 키 목록·순서. 스키마 키 집합이 이것과 같아야 한다 |
| `SETTINGS_CHARACTER_IDS` | `characters`의 키 목록(`sebastian`·`ciel`) |
| `checkCharacterSettings` · `SettingsCheckResult` · `SettingsIssue` | `parseCharacterSettings`의 값·실패 정보(N3·N4) |
| `SETTINGS_BODY_MAX_BYTES`(131072) · `settingsScopeOf` | server 서비스는 쓰지 않는다. 라우트(contract)가 본문 상한·문구에 쓴다 |

스키마 규칙(N1 그대로):

- 길이는 `countCodePoints(normalizeText(v))`(`@shared/limits`)로 센다. zod `.max()`(UTF-16 단위)는 쓰지 않고 `refine`으로 센다.
- 글 필드: trim 뒤 길이. `required`면 1~`max`, 아니면 0~`max`.
- 목록 필드: 항목마다 trim → 빈 항목 제거 → 개수(`maxItems`) → 항목 길이(`itemMax`).
- strict 3단: 본체(`world`·`characters`만), `characters`(`SETTINGS_CHARACTER_IDS`만), 캐릭터(`CHARACTER_FIELD_KEYS`만). 모르는 키·세 번째 id는 실패다. `outputRules` 키도 모르는 키로 실패한다(R-SET-006 편집 불가).
- **두 캐릭터·11필드 키는 전부 필수**다. 선택 필드도 키를 빼면 실패이고, 값은 `''`·`[]`로 보낸다.
- 키 집합 일치는 타입 대입(N2 — 출력이 `CharacterSettings`에 대입 가능)과 SRV-T-240의 키 집합 단언으로 확인한다.
- 봉투(`{ settings }` 바깥)는 **`z.object`**(strict 아님)라 모르는 키를 버린다. `z.strictObject`로 감싸지 않는다(api.md §4.16, 계약 결정 4 · M3). 봉투 스키마 `putCharacterSettingsBody`는 contract의 `routes/schemas.ts`가 만들고, `characterSettingsSchema`는 `settings` 안만 다룬다(strict 3단).
- `world`의 화면 이름은 `WORLD_FIELD_SPEC.label` = **`세계관`**이다. 탭 이름(「공통」)은 화면 labels 몫이다(api.md §5.8.4 · M5). server 코드는 라벨을 쓰지 않는다(문구는 shared가 만든다).

### 2.3 정규화 규칙 (N4 — 스키마 출력 = 저장값 = 응답값 = `checkCharacterSettings(input).value`)

| 대상 | 규칙 |
|---|---|
| 문자열 | `normalizeText`(앞뒤 trim) 후 길이 판정. 중간 줄바꿈·공백은 그대로 |
| 배열 항목 | 항목마다 trim → 빈 문자열 제거 → **제거 뒤** 개수 판정 → 항목 길이 판정 |
| 순서 | 배열 순서 유지. 중복 항목은 그대로 둔다 |
| 키 순서 | 저장 JSON은 `checkCharacterSettings`가 만든 값을 `JSON.stringify` 한 그대로. 키 순서에 의미를 두지 않는다 |

- `put`이 저장·응답하는 값은 `parseCharacterSettings(settings).value`이고, 이는 `checkCharacterSettings(settings).value`와 같다. 라우트 경유 요청이면 zod 출력과도 같다(SRV-T-240이 같은 벡터로 세 값의 일치를 단언).
- 정규화는 멱등이다. 정규화 값을 다시 넣어도 같은 값이 나온다.

### 2.4 읽기 재검증·시드 대체 규칙 (R-SET-003 · N5 · N7)

`get`과 `loadForPrompt`는 같은 내부 함수 `readCurrent()`를 쓴다(출처 1곳).

```
readCurrent()
  row = await db.characterSettings.get()                         ── D1 throw → 그대로 전파(500 INTERNAL). 시드로 바꾸지 않는다(N5)
  row === null                         → SEED
  JSON.parse(row.json) 실패            → logger.error('character_settings_invalid', { field: '(json)' }) → SEED
  parseCharacterSettings(parsed) 실패  → logger.error('character_settings_invalid', { field: fieldOf(issue.path) }) → SEED
  성공                                 → { settings: value, version: row.version, updatedAt: row.updatedAt, isDefault: false }

SEED      = { settings: DEFAULT_CHARACTER_SETTINGS, version: 0, updatedAt: null, isDefault: true }
fieldOf(p) = p.length === 0 ? '(root)' : p.join('.')
```

- **시드 대체는 "행 없음 · 재검증 실패" 두 경우뿐이다(N5).** D1 읽기가 throw하면(테이블 없음 포함) 장애를 시드로 숨기지 않고 500 `INTERNAL`로 끝난다(api.md §4.15 에러 표). speak·regenerate도 같은 이유로 500이다([messages.md](messages.md) §4.4).
- 시드 상수 `DEFAULT_CHARACTER_SETTINGS`는 [llm.md](llm.md) §3.4가 `server/characters/*.json`에서 만든다(파일 형식 불변, 신규 필드는 `''`·`[]`).
- 재검증 실패는 수동 DB 조작에서만 생긴다(쓰기 때 같은 규칙으로 검증). 실패해도 speak는 시드로 계속된다(02 §3).
- 재검증 실패 행은 **지우거나 고치지 않는다.** 주인이 저장하면 그 행을 덮어쓴다.
- **version(N7):** 재검증 실패 동안 GET 응답은 `version: 0`이다. 그 위에 저장하면 응답 version은 1이 아니라 그 행 version + 1이다(UPSERT 그대로). 계약은 단조 증가만 약속한다(api.md §4.16).
- 로그는 읽을 때마다 1건이다(speak마다 1건). 훼손 상태를 운영 로그에서 바로 보이게 하려는 의도다.
- `loadForPrompt` = `toPromptSettings((await readCurrent()).settings)`. 변환(표시명 `CHARACTERS[id].name` 주입, `outputRules = OUTPUT_RULES`)은 llm의 순수 함수다([llm.md](llm.md) §3.4).

## 3. 내부 구조

| 파일 | 책임 | 예상 줄 수 |
|---|---|---|
| `server/src/settings/index.ts` | 문서주석 6항목, 재노출(`createSettingsService`·`characterSettingsSchema`·`parseCharacterSettings`, 타입 `SettingsService`·`SettingsDeps`) | 20 |
| `server/src/settings/schema.ts` | shared 필드 명세 → zod 스키마 생성, `parseCharacterSettings`(zod + `checkCharacterSettings` 이중 판정) | 80 |
| `server/src/settings/service.ts` | `createSettingsService`(`readCurrent`·`get`·`put`·`loadForPrompt`), 로그 2종 | 80 |
| `server/test/settings.test.ts` | §8 SRV-T-240~249·259·260 | — |

- 의존: `../db`(`characterSettings` 저장소), `../llm`(`DEFAULT_CHARACTER_SETTINGS`·`toPromptSettings`·타입 `PromptSettings`), `../auth`(타입 `Principal`만), `../app-error`, `../logger`(타입), `@shared/settings`·`@shared/limits`·`@shared/errors`·`@shared/types`, `zod`.
- 의존 방향: settings → db · llm. **llm·db는 settings를 import하지 않는다.** messages도 settings를 import하지 않고 `loadPromptSettings` 함수 값을 deps로 받는다([messages.md](messages.md) §4.4). 컨테이너만 둘을 잇는다([index.md](index.md) §2.3.1). 순환 없음.
- 상태 없음. **격리체(isolate) 캐시 없음**(02 §3 — 격리체가 여럿이라 캐시는 "저장 즉시 반영"을 깬다).
- 새 npm 패키지 없음. 은/는 조사 처리는 shared 안에 있고 server는 하지 않는다.

## 4. 비동기·동시성

```
GET /api/settings/characters   [requireToken → requireOwner]                        (routes = contract, api.md §4.15)
  └ settings.get()
       readCurrent()  ── D1 PK 1행 읽기(throw → 500) → JSON.parse → 재검증 (§2.4)
  ◀ 200 CharacterSettingsResponse

PUT /api/settings/characters   [requireToken → requireOwner → rateLimitWrites → 본문 상한 → validate(zod, settingsIssueMessage)]
  └ settings.put(body.settings, getPrincipal(c))                                      (api.md §4.16 판정 7단계 중 7)
       ① r = parseCharacterSettings(settings) ── !r.ok → AppError('VALIDATION_ERROR', r.issue.message)(라우트 경유면 도달 안 함)
       ② json = JSON.stringify(r.value)
       ③ { version, updatedAt } = await db.characterSettings.upsert(json, by.mbId, now())   ── UPSERT 1문장
       ④ logger.info('settings_saved', { mbId: by.mbId, version })
  ◀ 200 { settings: r.value, version, updatedAt, isDefault: false }

POST …/speak · …/regenerate  (messages.md §4.4)
  └ 잠금 선점 뒤 Promise.all([ pageDesc, getSummary, loadPromptSettings() ])
       loadPromptSettings = settings.loadForPrompt = toPromptSettings(readCurrent().settings)
       → buildSpeakPrompt(input, profiles, common)
```

- **동시 저장: 마지막 쓰기 승리.** UPSERT 한 문장이라 두 PUT이 겹쳐도 행이 깨지지 않고 version은 각각 +1 된다. 낙관적 잠금은 02 §3·api.md §4.16에서 미채택.
- **저장과 speak의 경합:** speak는 잠금 선점 뒤 읽는 시점의 커밋된 행을 쓴다. PUT 응답을 받은 뒤 시작한 speak는 반드시 새 값을 쓴다(캐시 없음 — SRV-T-256). 이미 진행 중인 생성은 이전 값을 쓴다(api.md §4.16 부수 효과).
- **백그라운드 작업 없음**(`waitUntil` 미사용). **외부 호출 없음**(타임아웃 대상 없음, D1 대기는 플랫폼 제한).
- **CPU(R-NFR-005):** 본체 최대 약 2.3만 코드 포인트. PUT은 라우트 zod 1회 + (zod 실패 시 shared 검사 1회) + 서비스 `parseCharacterSettings`(zod + shared 검사) + `JSON.stringify` 1회, GET·speak는 `JSON.parse` + zod + shared 검사 1회씩. 모두 1ms 미만으로 추정한다. 구현 뒤 `wrangler dev` CPU 시간으로 확인(§8 수동).
- **D1 비용:** speak·regenerate 1회당 읽기 +1행(PK). PUT 1회당 쓰기 1행. 무료 한도 영향 무시 가능.

## 5. 에러 타입

| 에러 클래스 | shared 에러 코드 | HTTP | 한국어 메시지 | 원인 |
|---|---|---|---|---|
| `AppError` | `VALIDATION_ERROR` | 400 | `parseCharacterSettings`의 `issue.message`(= shared `checkCharacterSettings` 첫 위반 문구, 어긋나면 기본 문구) | `put` 재검증 실패(라우트를 거치지 않은 호출, 또는 zod·shared 판정 불일치) |
| `AppError` | `OWNER_ONLY` | 403 | `캐릭터 설정은 갠홈 주인만 열 수 있습니다.`(shared 기본 문구, api.md §5.8.2) | `requireOwner`([auth.md](auth.md) §12) — 이 모듈은 던지지 않는다 |
| (전파) D1 오류 | `INTERNAL` | 500 | 기본 문구 | `characterSettings.get`·`upsert` throw, `0003` 미적용(테이블 없음). **시드로 대체하지 않는다**(N5) |

- 재검증 실패는 에러가 아니다(시드 대체 + 로그). 응답에 "훼손됨"을 알리지 않는다(`isDefault: true`로만 보인다).

### 5.1 400 문구 — 단일 소스는 shared (R-SET-005 · N3)

- **문구 표(13행)와 검사 순서의 정본은 api.md §4.16**이다. server 문서에는 옮겨 적지 않는다.
- 문구를 만드는 함수는 shared `checkCharacterSettings` 하나다. 화면 사전 검사와 서버 400이 같은 문장을 낸다(메인 세션 결정 1).
- 라우트 경로: zod(`characterSettingsSchema`)가 통과/실패를 정하고, 실패하면 라우트 훅 `settingsIssueMessage`(contract)가 실패 입력으로 `checkCharacterSettings`를 불러 첫 위반의 `message`를 응답 문구로 쓴다. shared가 통과시키는데 zod만 실패하면 기본 문구(`요청 형식이 올바르지 않습니다.`)가 나간다(안전망).
- 서비스 경로: `put`의 재검증도 `parseCharacterSettings` → `checkCharacterSettings`로 같은 문구를 쓴다(N3). server가 따로 조립하는 문구는 없다.
- 두 판정의 일치는 `shared/test/settings-vectors.ts`(contract, api.md §14.15) 벡터를 server 테스트가 import해서 확인한다(SRV-T-241).

### 5.2 로그 (R-SET-012 · R-AUTH-006 — 이 3종만, 본문·필드 값 0)

| event | level | 필드 | 내는 곳 |
|---|---|---|---|
| `settings_saved` | info | `mbId`, `version` | settings `put` |
| `owner_denied` | info | `mbId` | auth `assertOwner`([auth.md](auth.md) §12) |
| `character_settings_invalid` | error | `field`(경로 문자열 — `'(json)'`·`'(root)'` 또는 shared `issue.path`를 `.`으로 이은 값) | settings `readCurrent` |

- `field`에는 경로만 둔다. shared `issue.path`는 모르는 키 이름을 담지 않는다(그 키를 가진 객체까지만 — api.md §4.16). 그래서 키 이름도 로그에 남지 않는다.
- 문구(`issue.message`)는 로그에 싣지 않는다. 문구는 값을 담지 않지만 로그 형식을 3종 필드로 고정하기 위해서다.
- `put`·`get`은 그 밖의 로그를 남기지 않는다. 요청 로그(index)는 경로·상태만 남긴다.

## 6. 설정(env)

이 모듈은 env 키를 읽지 않는다. `OWNER_MB_IDS`는 auth가 값으로 받는다([env.md](env.md) S3c 델타, [auth.md](auth.md) §12). 쓰는 키 없음.

## 7. DB 스키마·마이그레이션

- 테이블 `character_settings`(1행 문서, `id = 1` 고정) — 마이그레이션 `server/migrations/0003_character_settings.sql`. 전문·제약 근거·적용 순서는 [db.md](db.md) §7.6. `json` 길이 CHECK 상한은 **200000**이다(02 초안 100000 대체 — 근거는 db.md §7.6, 유지 결정 4).
- 저장소 함수 `db.characterSettings.get()`·`upsert(json, updatedBy, nowMs)` — [db.md](db.md) §2.5.
- `updated_by`에는 `mbId`만 쓴다(R-AUTH-006). 응답에는 싣지 않는다.

## 8. 테스트 계획

S3c 테스트 번호는 **SRV-T-234~260**이다. 모듈별 상세는 각 문서에 있고, 이 표가 전체 색인이다.

| 대역 | 문서 | 내용 |
|---|---|---|
| SRV-T-234·235 | [env.md](env.md) S3c | `OWNER_MB_IDS` 파싱·형식 위반 |
| SRV-T-236~238 | [auth.md](auth.md) §12.5 | `isOwner`·`requireOwner` 4경로·닫힌 쪽 실패·레이트리밋 미소모 |
| SRV-T-239 | [db.md](db.md) §8.1 | 저장소·CHECK |
| SRV-T-240~249 · 259 · 260 | 이 문서 | 스키마·서비스·로그 grep·D1 장애 전파 |
| SRV-T-250~255 | [llm.md](llm.md) §8.2 | 시드·조립 확장·호환·defang |
| SRV-T-256~258 | [messages.md](messages.md) §8.4 | 저장 → 다음 speak 반영·행 훼손·읽는 시점 |

이 문서 몫 — `server/test/settings.test.ts`(workers pool D1, 마이그레이션 0001~0003 적용은 기존 `readD1Migrations` setup 그대로). 유효 본문은 `shared/test/settings-vectors.ts`의 `validSettings()`로 만든다.

| 테스트ID | 이름(`동작_조건_기대`) | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| SRV-T-240 | `schema_accepts_boundary_and_normalizes_like_shared` | 모든 글 필드 = 상한 코드 포인트(이모지 섞음), 앞뒤 공백, 목록 10·20개 + 빈 줄 3개, 항목 앞뒤 공백 | zod 통과, zod 출력 = `parseCharacterSettings(x).value` = `checkCharacterSettings(x).value`(깊은 일치), 캐릭터 키 집합 = `CHARACTER_FIELD_KEYS`, `characters` 키 집합 = `SETTINGS_CHARACTER_IDS`, 다시 넣어도 같은 값 | R-SET-002 · N1 · N2 · N4 |
| SRV-T-241 | `schema_and_shared_agree_on_vectors` | `shared/test/settings-vectors.ts`의 경계값 벡터 전부(상한·상한+1·빈 필수·형 틀림·모르는 키·세 번째 id·키 누락) | 벡터마다 `characterSettingsSchema.safeParse(x).success === checkCharacterSettings(x).ok`. 실패 벡터의 `parseCharacterSettings(x).issue`가 shared `issue`와 같음 | R-SET-002 · R-SET-005 · N1 · N3 |
| SRV-T-242 | `schema_rejects_missing_optional_keys_and_blank_required` | 선택 필드 키 1개 삭제(`age` 없음), `world`·`persona`·`speech`가 `''`·`'   '`, 선택 필드 `''`(통과 확인), 글 자리에 숫자·null, 목록 자리에 문자열 | 키 없음·필수 빈 값·형 틀림 실패, 선택 `''` 통과 | R-SET-002 · N1 |
| SRV-T-243 | `schema_is_strict_on_keys_and_ids` | ① 본체 모르는 키(`outputRules`) ② 캐릭터 안 `name`·`id`·`avatar` ③ `characters.claude`(세 번째 id) ④ `ciel` 누락 | 전부 zod 실패. `parseCharacterSettings`의 `issue`가 api.md §4.16 표 문구와 글자 단위로 같다: ① `[]`·`공통 · 알 수 없는 항목이 있습니다.` ② `['characters','sebastian']`·`세바스찬 · 알 수 없는 항목이 있습니다.` ③ `['characters']`·`공통 · 알 수 없는 캐릭터가 있습니다.` ④ `['characters','ciel']`·`시엘 · 설정 형식이 올바르지 않습니다.` 문구에 모르는 키 이름 없음 | R-SET-002 · R-SET-006(outputRules 편집 불가) |
| SRV-T-244 | `parseCharacterSettings_matches_api_table_and_never_echoes_values` | api.md §4.16 400 문구 표 13행을 하나씩 일으키는 입력 13개(값 자리에는 감시 문자열 `SENTINEL_VALUE_7c1`을 섞음) | 13개 모두 실패, `issue.path`·`issue.message`가 표의 path·message와 **글자 단위로 같음**(예 `['world']`·`공통 · 세계관은 1~2000자여야 합니다.`, `['characters','ciel','speech']`·`시엘 · 말투는 1~800자여야 합니다.`). 문구·경로에 감시 문자열 없음 | R-SET-005 · R-SET-012 · M1 |
| SRV-T-245 | `get_returns_seed_when_no_row` | 빈 D1 | `{ settings: DEFAULT_CHARACTER_SETTINGS, version: 0, updatedAt: null, isDefault: true }`, 로그 0건 | R-SET-003 |
| SRV-T-246 | `put_upserts_increments_version_and_returns_normalized` | 주인 Principal(자리표시 ID `owner_test`), 앞뒤 공백·빈 줄 섞인 본체로 PUT 2회, `now` 고정 | 1회 version 1·2회 version 2, `updatedAt = now`, `isDefault: false`, 응답 `settings` = `checkCharacterSettings(입력).value`, 이어서 `get()` 같은 값, D1 `updated_by = 'owner_test'`, info 로그 `settings_saved { mbId, version }` 2건 | R-SET-003·005 · R-SET-012 · N4 |
| SRV-T-247 | `put_rejects_invalid_when_called_directly` | 상한+1 본체로 서비스 직접 호출 | `VALIDATION_ERROR` 400, 문구 = `checkCharacterSettings(입력).issue.message`, D1 행 0개, `settings_saved` 0건 | R-SET-002 · N3 |
| SRV-T-248 | `get_falls_back_to_seed_when_row_corrupted` | 표: 직접 `INSERT`로 `json='{{'` / `'[]'` / `world` 빈 값 / 정상 본체 + 캐릭터 안 모르는 키 / `characters`에 세 번째 id. 각 행 위에 PUT 1회 | 읽기는 전부 시드 응답(`isDefault: true`, version 0). error 로그 `character_settings_invalid` 각 1건, `field`가 `'(json)'`·`'(root)'`·`'world'`·`'characters.ciel'`·`'characters'`, 로그 줄에 행 본문 없음. 뒤이은 PUT 응답 version = 깨진 행 version + 1 | R-SET-003 · R-SET-012 · N7 |
| SRV-T-249 | `loadForPrompt_matches_get_source` | 행 없음 / 저장 후 / 훼손 행 | 행 없음·훼손: `DEFAULT_PROMPT_SETTINGS`와 깊은 일치. 저장 후: `profiles.{id}.name = CHARACTERS[id].name`, `persona` 등 = 저장값, `common.world` = 저장값, `common.outputRules` = `OUTPUT_RULES` | R-SET-003·006 |
| SRV-T-259 | `settings_logs_never_contain_field_values` | 모든 필드에 감시 문자열을 넣어 PUT → GET → 훼손 → GET, 비주인 `assertOwner`, FakeProvider speak 1회. 로그 sink 수집 | 수집 로그 전체에 감시 문자열 0건. settings·auth 이벤트는 §5.2 3종뿐이고 필드 집합이 표와 같음 | R-SET-012 · R-AUTH-006 |
| SRV-T-260 | `get_and_loadForPrompt_propagate_d1_failure` | `characterSettings.get`이 reject하는 가짜 `Db` / 0003을 적용하지 않은 D1(테이블 없음) | `get()`·`loadForPrompt()`가 reject(시드 응답 아님), `character_settings_invalid` 로그 0건. `createApp` 경유 E15 시험 라우트는 500 `INTERNAL` | R-SET-003 · N5 |

- 에러·경계 경로(241~244·247·248·259·260)가 정상 경로(240·245·246·249)보다 많다.
- 테스트 회원 ID는 자리표시자(`owner_test`·`member_test`)만 쓴다. 실제 갠홈 회원 ID를 테스트·문서에 쓰지 않는다.
- SRV-T-260의 "테이블 없음" 변형은 별도 D1 바인딩이 필요하면 가짜 `Db` 경우만 남긴다(구현 시 판단). → 구현(2026-10-06): 가짜 `Db` 경우만 두었다.

수동 체크:

- [ ] 로컬 `server/.dev.vars`에 `OWNER_MB_IDS=<시험용 ID>`를 넣고 그 ID로 서명한 토큰으로 GET → 200 `isDefault: true`, PUT → 200 version 1, 같은 방에서 speak → 새 말투가 반영된 대사(실제 Gemini 키 있는 경우).
- [ ] 로컬 D1에서 `UPDATE character_settings SET json='{{' WHERE id=1`(로컬 `wrangler d1 execute DB --local`) 뒤 speak → 200(시드), 터미널에 `character_settings_invalid` 1줄, 본문 없음.
- [ ] `wrangler dev` 로그에서 PUT·speak 요청 CPU 시간이 수 ms 이하(R-NFR-005).

## 9. contract 요구 명세

| 노출 서비스 | 엔드포인트(api.md v0.5) | 입력 | 출력 | 에러 | 이유 |
|---|---|---|---|---|---|
| `services.settings.get()` | E15 `GET /api/settings/characters` — `requireToken → requireOwner` | 없음 | 200 `CharacterSettingsResponse` | api.md §4.15 표(`INTERNAL`은 시드로 대체하지 않음) | R-SET-004 · R-AUTH-003 예외 |
| `services.settings.put(body.settings, getPrincipal(c))` | E16 `PUT /api/settings/characters` — `requireToken → requireOwner → rateLimitWrites → 본문 상한 → validate('json', putCharacterSettingsBody, settingsIssueMessage)` | `{ settings: CharacterSettings }` | 200 `CharacterSettingsResponse`(정규화 값) | api.md §4.16 판정 7단계 | R-SET-005 · R-AUTH-005 |

server가 제공하는 것(라우트가 import):

- `characterSettingsSchema`(`server/src/settings/index.ts`) — `putCharacterSettingsBody`의 `settings` 자리에 그대로 쓴다. 정의를 복사하지 않는다.
- `requireOwner`(`server/src/auth/index.ts`) — [auth.md](auth.md) §12.
- `Services.settings` — [index.md](index.md) §2.3.1.

server가 하지 않는 것(contract 소관, api.md §4.16·§11): 본문 상한(`SETTINGS_BODY_MAX_BYTES`, `hono/body-limit`), 봉투 모르는 키 버리기, 400 문구(`settingsIssueMessage` → `checkCharacterSettings`), `validate.ts`의 `toMessage` 선택 인자.

## 10. 요구 추적표

| 요구ID | 반영 절 | 테스트ID | 상태 |
|---|---|---|---|
| R-SET-001 🔒 | §1(경계), 판정은 [auth.md](auth.md) §12 · [env.md](env.md) S3c | SRV-T-234~238 | ✅(설계) |
| R-SET-002 🔒 | §2.2·§2.3 | SRV-T-240~243·247 | ✅(설계) |
| R-SET-003 🔒 | §2.4·§4·§7, [db.md](db.md) §2.5·§7.6 | SRV-T-239·245·246·248·249·256·257·260 | ✅(설계) |
| R-SET-005 🔒 (server 몫) | §5.1(문구는 shared), §2(`put` 재검증) | SRV-T-241·244·247, 라우트는 contract(API-T-095~107) | ✅(설계) |
| R-SET-006 🔒 | §2(`loadForPrompt`), 조립은 [llm.md](llm.md) §7.3 | SRV-T-249·250~255 | ✅(설계) |
| R-SET-012 | §5.2 | SRV-T-244·246·248·259 | ✅(설계) |
| R-LLM-002 🔒(개정) | §2.4, [llm.md](llm.md) §3.4 | SRV-T-245·250·251 | ✅(설계) |
| R-LLM-003 🔒(개정) | §2, [llm.md](llm.md) §7.3 | SRV-T-252~255 | ✅(설계) |
| R-SET-004 (server 몫) | §9 | 라우트 테스트는 contract(API-T-091~094) | 부분(라우트는 contract) |
| R-AUTH-005 · R-AUTH-006 🔒 | §5.2·§9 | SRV-T-237·259 | ✅(설계) |
| R-NFR-005 | §4 CPU | 수동 | 부분(실측은 구현 후) |

## 11. 설계 결정 노트

| # | 결정 | 대안 | 채택 근거 |
|---|---|---|---|
| D-SET-1 | 새 모듈 `server/src/settings/` | llm에 저장 로직 추가 · messages에 추가 | llm은 DB를 모른다(llm.md §3 의존 규칙). 설정은 GET/PUT 두 엔드포인트의 주체라 독립 서비스가 맞다. 요구 R-SET-001~012로 역추적된다(L7 모듈 목록 개정) |
| D-SET-2 | 프롬프트 변환(`toPromptSettings`)과 시드는 llm에, 저장·재검증은 settings에 | 변환도 settings에 | 프롬프트 입력형(`CharacterProfile`)의 주인은 llm이다. settings → llm 단방향이 되고 llm이 settings를 몰라도 된다 |
| D-SET-3 | `put`이 `parseCharacterSettings`로 한 번 더 검증한다(라우트 검증과 중복) | 라우트 검증만 믿고 정규화만 | 저장된 행이 언제나 읽기 재검증을 통과해야 한다. 그렇지 않으면 쓰기는 성공하고 읽기는 조용히 시드로 떨어진다. 비용은 1ms 미만 |
| D-SET-4 | 재검증 실패·행 없음 응답을 같은 시드 응답(`version 0`)으로. D1 throw는 500 | 훼손 시 500 · 별도 플래그 · D1 장애도 시드 | R-SET-003 "시드로 대체하고 로그". 장애를 시드로 숨기지 않는다(N5). 응답 계약(`isDefault`)을 늘리지 않는다 |
| D-SET-5 | 마지막 쓰기 승리 | `baseVersion` 낙관적 잠금 | 02 §3·api.md §4.16 미채택. 주인 1~2명 |
| D-SET-6 | **400 문구의 단일 소스는 shared `checkCharacterSettings`.** server zod는 통과/실패만, 문구 생성 함수를 server에 두지 않는다 | server 스키마 옆 문구 함수(`firstSettingsIssue` — 초안, 폐기) | 메인 세션 결정 2026-10-06. 화면 사전 검사와 서버 응답이 같은 문장을 내야 한다(api.md §4.16). 두 곳에서 문구를 만들면 어긋난다 |
| D-SET-7 | 시드 상수를 응답에 그대로 싣는다(복제 없음) | 매 요청 깊은 복제 | 상수는 읽기 전용으로만 쓰이고 `c.json` 직렬화만 거친다. 코드에서 수정하지 않는다(ts-rules 불변성) |
| D-SET-8 | 재검증 실패 로그를 읽을 때마다 남긴다 | 격리체당 1회 | 격리체 상태 금지. 훼손은 드물고 고치면 멈춘다 |
| D-SET-9 | `parseCharacterSettings` = zod와 shared 검사 둘 다 통과해야 ok, 값은 shared 정규화 값 | zod만 · shared만 | 라우트(zod 판정)와 화면(shared 판정) 어느 쪽 기준으로도 통과한 값만 저장된다. 값을 shared에서 가져오므로 N4가 구조적으로 성립한다 |

03 §1.3 시그니처 대비:

- `SettingsService.get`·`put`·`loadForPrompt`, `characterSettingsSchema` 위치·이름은 **그대로**다.
- `loadForPrompt` 반환형에 llm 별칭 `PromptSettings`를 붙였다. 구조는 같다(유지 결정 4).
- 추가 export(비파괴): `parseCharacterSettings`(유지 결정 4). 반환형은 shared `SettingsCheckResult`다.
- 초안에 있던 `firstSettingsIssue`·server 쪽 `SettingsIssue` 타입은 **폐기**했다(결정 1·2).

## 12. api.md v0.5 N1~N7 대조표

메인 세션 결정 3으로 N1~N7을 전부 수용했다. 아래는 server 설계 문서의 반영 위치와 대조 결과다. **불일치 0건.**

| # | 계약 내용(api.md §15.12) | 반영 위치 | 결과 |
|---|---|---|---|
| N1 | 상한·필수는 `WORLD_FIELD_SPEC`·`CHARACTER_FIELD_SPECS` import, 길이는 `countCodePoints(normalizeText(v))`(zod `.max()` 금지), 목록은 trim → 빈 항목 제거 → 개수 → 항목 길이, strict 3단, 두 캐릭터·11필드 키 필수 | §2 스키마 주석 · §2.2 스키마 규칙 · SRV-T-240~243 | 정정(초안의 가칭 이름을 확정 이름으로, "선택 필드도 키 필수"를 명시) |
| N2 | 스키마 출력이 shared `CharacterSettings`에 대입 가능 | §2 스키마 주석 · §2.2 · SRV-T-240 | 일치 |
| N3 | 400 문구는 shared `checkCharacterSettings`가 만든다. `put` 재검증 문구도 같은 함수에서 | §2 `parseCharacterSettings` · §5 · §5.1 · D-SET-6 · SRV-T-241·247 | 정정(server 문구 규칙 6행·`firstSettingsIssue` 폐기, api.md §4.16 참조로 대체) |
| N4 | `put` 정규화 결과 = `checkCharacterSettings(input).value`, 응답 `settings`가 이 값 | §2.3 · §4 PUT ①·② · D-SET-9 · SRV-T-240·246 | 정정(값 출처를 shared 함수로 고정) |
| N5 | `get` 시드 대체는 "행 없음 · 재검증 실패"만. D1 throw는 500 `INTERNAL` | §2 `get` 주석 · §2.1 · §2.4 · §5 · D-SET-4 · SRV-T-260 · [messages.md](messages.md) §4.4 | 정정(명시 강화, SRV-T-260 추가) |
| N6 | `requireOwner`는 D1에 접근하지 않고 403 본문은 기본 문구만, `rateLimitWrites`보다 앞 | [auth.md](auth.md) §12.2(I/O 없음·순서·기본 문구)·§12.5 SRV-T-237 · [index.md](index.md) §3.1.2 | 일치(auth.md에 N6 출처 표기·레이트리밋 미소모 단언 보강) |
| N7 | 재검증 실패 행 위 저장 → 응답 version = 그 행 version + 1, 계약은 단조 증가만 | §2.4 version 항목 · [db.md](db.md) §3.7 UPSERT · SRV-T-248 | 일치(SRV-T-248에 단언 추가) |

### 12.1 contract 대조 M1~M6 (api.md §15.12)

contract-designer가 이 문서 초안과 대조한 6건이다. 전부 반영했다. **남은 불일치 0건.**

| # | 초안의 어긋남 | 반영 위치 | 결과 |
|---|---|---|---|
| M1 | 자체 400 문구 표(범위 접두 없는 행 포함) | §5.1을 api.md §4.16 참조로 대체(문구 표 전사 안 함) · SRV-T-243·244 기대 문구 = §4.16 표 13행 그대로 | 반영 |
| M2 | 라우트가 `firstSettingsIssue(error, ['settings'])`로 문구 생성 | `firstSettingsIssue` 폐기 · §5.1·§9 = 라우트 훅 `settingsIssueMessage`(shared `checkCharacterSettings`) · D-SET-6 | 반영 |
| M3 | 봉투 `z.strictObject({ settings })` | §2.2 봉투 항목 = `z.object`(바깥 모르는 키 버림, `settings` 안만 strict) · §9 "server가 하지 않는 것" | 반영 |
| M4 | 가칭 명세(`CHARACTER_SETTING_FIELDS` 배열 · `WORLD_FIELD` · 문자열 `issue.path`) | §2 import · §2.2 표 = `WORLD_FIELD_SPEC` · `CHARACTER_FIELD_SPECS`(키별 객체) · `CHARACTER_FIELD_KEYS`(순서) · `SettingsIssue.path: readonly string[]` · §5.2 `fieldOf(path)` | 반영 |
| M5 | `world` 화면 이름 `공통 세계관` | §1 서술 · §2.2 라벨 항목 = `세계관`(탭 이름은 화면 labels 몫). server 문서 다른 곳에 옛 라벨 없음(grep) | 반영 |
| M6 | server 내부 `SettingsIssue { path: string }`가 shared 이름과 충돌 | server 쪽 타입을 **없앴다**(개명 대신 shared `SettingsIssue`·`SettingsCheckResult`를 그대로 사용 — §2 · §11 "03 §1.3 시그니처 대비"). 같은 이름의 server 타입 0개 | 반영 |

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-06 | 신규 작성(S3c). 02 결정 1~6·03 §1 기준. Q2 사용자 결정(지인 ID만) 반영 |
| 2026-10-06 | api.md v0.5 대조 정정. shared 이름 확정(`WORLD_FIELD_SPEC`·`CHARACTER_FIELD_SPECS`·`CHARACTER_FIELD_KEYS`·`SETTINGS_CHARACTER_IDS`·`checkCharacterSettings`·`SettingsCheckResult`·`SettingsIssue`). 400 문구 단일 소스를 shared로 — §5.1 문구 표·`firstSettingsIssue`·server `SettingsIssue` 폐기. `parseCharacterSettings` 반환형을 shared `SettingsCheckResult`로, 값은 shared 정규화 값(N4). N5 D1 장애 전파 명시·SRV-T-260 추가. SRV-T-240~244·247·248 기대값 정정. §12 N1~N7 대조표(불일치 0) |
| 2026-10-06 | contract 대조 M1~M6 반영: 봉투 `z.object` 명시(M3), `world` 화면 이름 `세계관`(M5), SRV-T-243·244 기대 문구를 api.md §4.16 표 13행 그대로(M1), §12.1 M1~M6 대조표(불일치 0). M6은 server 타입 제거로 해소 |
| 2026-10-06 | 테스트 입력 정정(server-implementer 보고): 훼손 행 입력 `json='{'`(1자)는 0003 CHECK `length(json) BETWEEN 2 AND 200000`에 걸려 INSERT·UPDATE 자체가 실패한다. SRV-T-248·수동 체크의 입력을 `'{{'`(2자, JSON 파싱 실패)로 바꿨다. 마이그레이션 전문은 그대로 |
| 2026-10-06 | 구현 완료 동기화(server 318/318 · tsc 0 · eslint 0). 설계와 다른 점 3건: ① SRV-T-260은 가짜 `Db` 경우만(설계 허용 선택) ② `characterSettingsSchema` 출력 타입을 `z.ZodType<CharacterSettings, unknown>`로 고정(`as unknown as` 단언 — §2 시그니처 줄 갱신) ③ `server/test/settings.test.ts`에 lint용 `Draft` 타입 추가 |
