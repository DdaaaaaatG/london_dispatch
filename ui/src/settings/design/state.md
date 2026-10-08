# settings 상세 설계 — 상태 모듈 (분할 문서)

> 주 문서: `ui/src/settings/design.md`(RTM 포함). 이 파일은 주 문서 §4의 상세다.
> 대상: `ui/src/state/settings.ts`(초안·검사·리듀서) · `ui/src/state/settingsFile.ts`(내보내기·가져오기). 둘 다 **순수 TS**(React·DOM·`@/api` import 없음), named export, 각 400줄·함수 50줄 이하. 후보 분류 SF-07~SF-10과 `Candidate` 타입은 400줄 한계로 `ui/src/state/settingsCandidate.ts`에 나눴다(export, components.md §5.1). 테스트 `ui/src/settings/test/state/settings.test.ts` · `settingsFile.test.ts`(v1.2.1 정정, 시나리오 가정 ①).

비유: 초안은 연필로 쓴 원고, 기준값은 마지막으로 인쇄해 둔 원고다. 「되돌리기」는 연필 원고를 지우고 인쇄본을 다시 베껴 쓰는 것이고, 「저장」은 연필 원고를 인쇄소(서버)에 보내 새 인쇄본을 받아 오는 것이다.

---

## 1. 화면 상태 (`ui/src/settings/` 소유)

| 상태 | 용도 | 타입 | 초기값 | 소유 |
|---|---|---|---|---|
| `state` | 로드·초안·(S3f) 모델 선택 초안 `modelDraft`·저장·stale | `SettingsState`(§2.1) | `{ phase: 'loading' }`(ready 진입 시 `modelDraft = response.model`) | `useSettingsEditor`(`ui/src/settings/useSettingsEditor.ts`) 안 `useReducer(settingsReducer, INITIAL_SETTINGS_STATE)` |
| `activeTab` | 보이는 탭 | `SettingsTab = 'world' \| CharacterId` | `'world'`(「공통」 탭 — v1.3 이전 이름 「공통 세계관」, 메인 세션 결정) | `useSettingsUi` 안 `useState` |
| `sheet` | 열린 시트 | `SettingsSheet = 'none' \| 'fileMenu' \| 'export' \| 'import' \| 'leave'`(`useSettingsUi.ts` export) | `'none'` | `useSettingsUi` 안 `useState` |
| `toast` | 알림 줄 E | `ToastState` | `null` | `useToast()`(공용, rooms components.md §1.18) — SettingsScreen |
| `isActiveRef` | 언마운트 뒤 응답 무시 | `MutableRefObject<boolean>` | `false` → 마운트 layout effect `true`, cleanup `false` | `useSettingsEditor` |
| `latestRef` | 최신 state·콜백 | `MutableRefObject<{ state; options }>` | 첫 값, 매 렌더 layout effect 갱신 | `useSettingsEditor` |
| `saveInFlightRef` | 같은 틱 저장 연타 방지 | `MutableRefObject<boolean>` | `false` | `useSettingsEditor` |
| `titleRef` · `fileMenuButtonRef` | h1 포커스 · 시트 닫힌 뒤 ⋯ 포커스 복귀 | `RefObject<HTMLHeadingElement>` · `RefObject<HTMLButtonElement>` | `null` | `useSettingsUi` 안 `useRef`(반환해 TopBar·IconButton에 연결) |
| ③ 가져오기 시트 로컬 | 파일·붙여넣기·오류 | `ImportForm = { fileName: string \| null; fileText: string \| null; pasteText: string; error: string \| null; isReading: boolean }` | `{ null, null, '', null, false }` | `useImportForm`(`ui/src/settings/useImportForm.ts`) 안 `useState`. ImportSheet가 부르므로 시트가 닫히면 사라진다 |
| ③ `isActiveRef` · `inputIdRef` | 시트가 닫힌 뒤, 또는 다른 입력으로 바뀐 뒤 도착한 `FileReader` 결과 무시(F-ST-15). 설계 v1.2의 `readerActiveRef`를 대체 | `MutableRefObject<boolean>` · `MutableRefObject<number>` | `false`(마운트 layout effect `true`, cleanup `false`) · `0`(pickFile·changePaste마다 +1) | `useImportForm` |
| `focusTargetRef` | 저장 응답 뒤 포커스 대상 예약(F-ST-09·10) | `MutableRefObject<FocusTarget \| null>`, `FocusTarget = 'title' \| 'save'` | `null` | `useSettingsEditor`가 만들어 적고 반환한다. `useSettingsUi`의 layout effect(`[state]`)가 읽어 포커스한 뒤 비운다 |
| `backButtonRef` · `saveButtonRef` | ④ 닫힘 포커스 복귀 대체 대상 · 저장 실패 뒤 포커스 | `RefObject<HTMLButtonElement>` | `null` | `useSettingsUi` 안 `useRef`(IconButton·StatusBar에 `buttonRef`로 넘김) |
| ② 내보내기 시트 로컬 | 내보낼 문자열 | `{ text: string; fileName: string }` | 시트 마운트 시 1회 계산(`useState(() => …)`) | ExportSheet |

- 토큰은 화면 상태에 없다. 주인 여부(`isOwner`)는 App 상태다(rooms `design/functions.md` §1.1).
- 처음 탭은 매 진입마다 `'world'`다. 탭 기억은 하지 않는다(요구 없음).

---

## 2. `ui/src/state/settings.ts`

> **(v1.3 S3f) 파일 크기 규칙.** `ui/src/state/settings.ts`는 S3f 전 373줄이다. S3f 추가분(타입 2줄 · T-11 · S-16 · S-17 · T-02·T-05·T-08 한 줄씩)은 약 +17~20줄로 예상된다. prettier 적용 뒤 **400줄을 넘으면** S-15 `checkPatchedSettings`와 지역 함수 `patchCharacter`(약 21줄)를 `ui/src/state/settingsCandidate.ts`(293줄)로 옮긴다. 가져오기 전용 함수라 그 모듈의 책임과 맞는다. 옮기면 `settingsFile.ts`와 단위 테스트의 import 경로만 바뀌고 동작은 같다. 다른 분할은 하지 않는다.

### 2.1 타입

```ts
import type { CharacterId, CharacterSettingFields, CharacterSettings, CharacterSettingsResponse, LlmModelKey } from '@shared/types'   // LlmModelKey: S3f
import type { ListFieldKey, SettingsCheckResult, TextFieldKey } from '@shared/settings'
import type { ApiError } from '@/api'

export type SettingsTab = 'world' | CharacterId
export const SETTINGS_TABS: readonly SettingsTab[] = ['world', 'sebastian', 'ciel']   // 탭 순서(메인 세션 결정)

/** 초안 한 명분. 글 필드는 입력 그대로, 목록 필드는 "한 줄에 하나" 텍스트 그대로(trim 안 함) */
export type DraftCharacter = { readonly [K in keyof CharacterSettingFields]: string }
export type SettingsDraft = { readonly world: string; readonly characters: Readonly<Record<CharacterId, DraftCharacter>> }

/** 필드 하나의 위치 */
export type DraftFieldRef = { readonly tab: 'world' } | { readonly tab: CharacterId; readonly key: keyof CharacterSettingFields }

/** 필드 하나의 문제(화면 안내용). 사전 검사(checkCharacterSettings)와 같은 spec 에서 나온다 */
export type FieldIssue =
  | { kind: 'required' }
  | { kind: 'tooLong'; max: number }
  | { kind: 'tooManyLines'; maxItems: number }
  | { kind: 'lineTooLong'; lineNo: number; itemMax: number }

export type SettingsState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly error: ApiError }
  | {
      readonly phase: 'ready'
      readonly base: CharacterSettingsResponse   // 마지막으로 읽거나 저장한 응답(기준값). S3f: base.model = 모델 기준값
      readonly draft: SettingsDraft
      readonly modelDraft: LlmModelKey | null    // S3f: 모델 선택 초안. SettingsDraft 밖(D-ST-12). null = 미선택 판
      readonly isSaving: boolean
      readonly isStale: boolean                  // 저장 중 인증 실패 뒤. 되돌아가지 않는다(새로 고침만)
    }

export type SettingsAction =
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; response: CharacterSettingsResponse }
  | { type: 'loadFailed'; error: ApiError }
  | { type: 'worldChanged'; value: string }
  | { type: 'characterFieldChanged'; id: CharacterId; key: keyof CharacterSettingFields; value: string }
  | { type: 'reverted' }
  | { type: 'imported'; patch: SettingsPatch }
  | { type: 'saveStarted' }
  | { type: 'saveSucceeded'; response: CharacterSettingsResponse }
  | { type: 'saveFailed' }
  | { type: 'staleEntered' }
  | { type: 'modelChanged'; value: LlmModelKey }   // S3f. null 로 바꾸는 액션은 없다(미선택으로 돌아가는 길은 reverted 뿐)

export const INITIAL_SETTINGS_STATE: SettingsState = { phase: 'loading' }

/**
 * 가져오기 후보 위치의 값(후보 위치만). 같은 타입을 두 단계가 쓴다:
 *  - S-15 입력 = 검사 전 후보 값(SF-07·09 결과, 정규화 전)
 *  - T-06 입력 = S-15 통과 뒤 SF-10 이 꺼낸 정규화 값
 * Candidate(필드 값 string | string[]) → SettingsPatch 좁히기: 키의 spec.kind 가 'text' 면 string, 'list' 면 string[] 만 넣는다
 * (SF-07·09 가 형이 맞는 값만 후보로 만들므로 늘 성립. 변환은 SF-05 가 spec.kind 분기로 한다 — as 단언 금지)
 */
export type SettingsPatch = {
  readonly world?: string
  readonly characters: Readonly<Partial<Record<CharacterId, Partial<CharacterSettingFields>>>>
}

/** ready 판 하나(S-13 · S-14 입력) */
export type ReadyState = Extract<SettingsState, { phase: 'ready' }>
```

### 2.2 순수 함수 (초안·변환·검사)

| # | 시그니처 | 동작 | 비고 |
|---|---|---|---|
| S-01 | `listToLines(items: readonly string[]): string` | `items.join('\n')` | 저장값 → 목록 TextArea 글 |
| S-02 | `linesToList(text: string): string[]` | `text.split(/\r?\n/).map(normalizeText).filter(s => s !== '')` | 메인 세션 결정: trim·빈 줄 제거 |
| S-03 | `draftFromSettings(settings: CharacterSettings): SettingsDraft` | `world` 그대로. 캐릭터는 `SETTINGS_CHARACTER_IDS` × `CHARACTER_FIELD_KEYS` 순서로, 글 필드는 그대로, 목록 필드는 S-01 | 새 객체(입력을 바꾸지 않는다) |
| S-04 | `normalizeDraft(draft: SettingsDraft): CharacterSettings` | `world` = `normalizeText`, 글 필드 = `normalizeText`, 목록 필드 = S-02. **길이·개수 검사는 하지 않는다** | dirty 비교·stale 내보내기·가져오기 병합 기준 |
| S-05 | `settingsEqual(a: CharacterSettings, b: CharacterSettings): boolean` | `world`·두 캐릭터 × 11필드를 키 순서대로 비교(목록은 길이 + 항목별 `===`) | `JSON.stringify` 비교 금지(키 순서 의존) |
| S-06 | `isDraftDirty(draft: SettingsDraft, base: CharacterSettings): boolean` | `!settingsEqual(normalizeDraft(draft), normalizeDraft(draftFromSettings(base)))` | 기준값도 초안 왕복을 거쳐 비교한다 — 줄바꿈이 든 목록 항목이 있어도 열자마자 dirty가 되지 않는다(§2.5 L-1). 공백만 바꾼 변경은 dirty가 아니다 |
| S-07 | `precheckDraft(draft: SettingsDraft): SettingsCheckResult` | `checkCharacterSettings(normalizeDraft(draft))` | 사전 검사 래핑(메인 세션 결정). 통과 값이 저장 본문이다 |
| S-08 | `fieldIssueOf(draft: SettingsDraft, ref: DraftFieldRef): FieldIssue \| null` | spec(`WORLD_FIELD_SPEC` 또는 `CHARACTER_FIELD_SPECS[key]`)으로 그 필드만 검사. 글: trim 후 코드 포인트 0 && required → `required`, `> max` → `tooLong`. 목록: S-02 결과 개수 `> maxItems` → `tooManyLines`, 아니면 첫 `> itemMax` 항목 → `lineTooLong(lineNo = 그 항목의 1부터 번호)` | 같은 판정 순서(형 → 길이·개수)를 따른다. 초안은 늘 문자열이라 형 오류는 없다 |
| S-09 | `tabHasIssue(draft: SettingsDraft, tab: SettingsTab): boolean` | `'world'`면 world 필드, 캐릭터면 11필드 중 하나라도 S-08이 null이 아니면 true | 탭 `!` |
| S-10 | `fieldCount(draft: SettingsDraft, ref: DraftFieldRef): { count: number; max: number; unit: 'chars' \| 'lines' }` | 글: `countCodePoints(normalizeText(v))` / `max`. 목록: `linesToList(v).length` / `maxItems` | 목록 필드 라벨 줄 카운터용. 글 필드 카운터는 공용 TextInput/TextArea가 `countChars`로 직접 그린다(같은 셈) |
| S-11 | `canSaveSettings(state: SettingsState): boolean` | `phase === 'ready' && !isSaving && !isStale && hasUnsavedChanges(state) && precheckDraft(draft).ok` | 메인 세션 결정(저장 활성 조건). **(v1.3 S3f) `isDraftDirty` → `hasUnsavedChanges`(S-16)** — 모델만 바꿔도 저장 활성. 사전 검사는 본체만 한다 |
| S-12 | `canRevertSettings(state: SettingsState): boolean` | `phase === 'ready' && !isSaving && !isStale && hasUnsavedChanges(state)` | stale에서 비활성(메인 세션 결정). (v1.3) S-16 사용 |
| S-13 | `exportTargetOf(state: ReadyState): CharacterSettings` | `isStale ? normalizeDraft(draft) : base.settings` | R-SET-007 · R-SET-011. stale 초안은 상한을 넘었어도 그대로 내보낸다(보관이 목적) |
| S-14 | `statusOf(state: ReadyState): SettingsStatus` | 아래 표 순서대로 첫 일치 | D 하단 줄 |
| S-15 | `checkPatchedSettings(base: CharacterSettings, patch: SettingsPatch): SettingsCheckResult` | **재정의(v1.2):** `base`(마지막으로 읽거나 저장한 값) 위에 `patch` 위치만 덮은 새 객체를 만들어 `checkCharacterSettings`를 부른 결과를 그대로 돌려준다. 별도 필드 단위·상한 전용 검사는 없다(형·필수·상한·개수 모두 `checkCharacterSettings`, 문구는 api.md §4.16 표) | 가져오기 후보 검사(SF-05 ⑤) 전용. 정본 api.md §16.2 "후보 검사" |
| S-16 | `hasUnsavedChanges(state: ReadyState): boolean` | `isDraftDirty(state.draft, state.base.settings) \|\| state.modelDraft !== state.base.model` | **(S3f 신규)** 미저장 변경 하나의 정의. S-11·S-12·S-14·F-ST-18(이탈 확인)이 쓴다. 모델 비교는 `===` 한 번(정규화 없음). ② 내보내기 안내만은 본체 `isDraftDirty`를 쓴다(D-ST-15) |
| S-17 | `modelToSave(state: ReadyState): LlmModelKey \| undefined` | `state.modelDraft !== null && state.modelDraft !== state.base.model ? state.modelDraft : undefined` | **(S3f 신규)** 저장 둘째 인자(F-ST-09). 같으면 `undefined` → 래퍼가 본문에 `model` 키를 넣지 않는다(서버 저장값 유지). `null`은 보내지 않는다(계약상 400) — §2.3 불변식으로 "다르면 null 아님"이 성립하지만 조건에 `!== null`을 둬 타입을 좁힌다(`as` 금지) |
`SettingsStatus = { kind: 'saving' } | { kind: 'stale' } | { kind: 'invalid'; message: string } | { kind: 'dirty' } | { kind: 'default' } | { kind: 'saved'; version: number; updatedAt: number }`

| 순서 | 조건 | 결과 | 문구(requirements.md §5.3) · 색 |
|---|---|---|---|
| 1 | `isSaving` | `saving` | `저장 중...` muted |
| 2 | `isStale` | `stale` | `인증 만료` danger |
| 3 | `hasUnsavedChanges`(S-16) && 사전 검사 실패 | `invalid`(`issue.message`) | 첫 위반 문구 danger |
| 4 | `hasUnsavedChanges`(S-16) | `dirty` | `저장하지 않은 변경 있음` warning — (v1.3) 모델만 바뀐 상태도 여기 |
| 5 | `base.isDefault` 또는 `base.updatedAt === null` | `default` | `기본값 사용 중` muted |
| 6 | 그 밖 | `saved` | `v{n} 저장됨 MM.DD HH:mm` muted |

- 불변식(TC-ST-032): 화면 폼으로 만든 초안에서 `precheckDraft(d).ok === false` ⇔ 어떤 필드든 `fieldIssueOf ≠ null`. 둘 다 같은 spec·같은 정규화를 쓰기 때문이다. 경계 벡터(상한·상한+1·빈 필수·줄 수 +1·줄 길이 +1)로 확인한다.

### 2.3 리듀서 `settingsReducer(state: SettingsState, action: SettingsAction): SettingsState`

| # | 현재 | 액션 | 다음 | 비고 |
|---|---|---|---|---|
| T-01 | any | `loadStarted` | `{ phase: 'loading' }` | 다시 시도 |
| T-02 | loading | `loadSucceeded` | `ready` · `base = response` · `draft = draftFromSettings(response.settings)` · `modelDraft = response.model`(S3f) · `isSaving false` · `isStale false` | |
| T-03 | loading | `loadFailed` | `{ phase: 'error', error }` | |
| T-04 | ready, `!isSaving` | `worldChanged` · `characterFieldChanged` | `draft`의 그 필드만 새 값(나머지 참조 유지) | 저장 중이면 무시(입력은 readOnly) |
| T-05 | ready, `!isSaving && !isStale` | `reverted` | `draft = draftFromSettings(base.settings)` · `modelDraft = base.model`(S3f) | stale이면 무시 |
| T-06 | ready, `!isSaving && !isStale` | `imported` | `patch`에 있는 위치만 초안을 바꾼다: 글 필드는 값 그대로, 목록 필드는 `listToLines`(S-01). 그 밖 위치는 초안 문자열 그대로(미저장 입력 보존). **`modelDraft`는 그대로**(S3f, R-SET-007 개정) | 저장하지 않는다. stale이면 무시. 빈 patch는 오지 않는다(F-ST-17이 막는다) |
| T-07 | ready, `!isSaving && !isStale` | `saveStarted` | `isSaving = true` | |
| T-08 | ready, `isSaving` | `saveSucceeded` | `base = response` · `draft = draftFromSettings(response.settings)` · `modelDraft = response.model`(S3f) · `isSaving false` | 서버 정규화 값으로 초안·기준값을 함께 맞춘다(api.md 「ui 인계 메모」 S3c). 모델만 저장해도 같다(D-ST-13) |
| T-09 | ready, `isSaving` | `saveFailed` | `isSaving = false` | 초안·`modelDraft` 유지 |
| T-10 | ready | `staleEntered` | `isSaving = false` · `isStale = true` | 초안·`modelDraft` 유지(R-SET-011) |
| T-11 | ready, `!isSaving` | `modelChanged` | `modelDraft = value`. `value === modelDraft`면 같은 참조 반환 | **(S3f 신규)** stale에서도 반영한다(T-04 편집과 같은 규칙 — 입력은 계속 가능, 저장만 막힘). 저장 중이면 무시(라디오 `disabled`) |
| — | 그 밖 조합 | 아무 액션 | 같은 참조 반환 | 늦은 응답 방어 |

- 리듀서는 새 객체만 만든다(불변). `ready` 이외에서 편집 액션이 오면 그대로 반환한다.
- (S3f) 불변식: `modelDraft === base.model || modelDraft !== null`. `modelDraft`를 `null`로 만드는 전이는 T-02·T-05·T-08뿐이고 셋 다 `base.model`과 같은 값을 넣는다. 그래서 "모델이 다르다"면 `modelDraft`는 늘 키다(S-17).
- (S3f) 상태 전이 요약(s3f-02 §5.2와 같다): `loadSucceeded`·`saveSucceeded` → `response.model` · `modelChanged` → 값 교체 · `reverted` → `base.model` · `imported`·`saveFailed`·`staleEntered` → 유지.

### 2.4 쓰는 곳

| 함수 | 쓰는 곳 |
|---|---|
| S-07 · S-11 · S-12 · S-14 | StatusBar(D) · `saveSettings`(F-ST-09) |
| S-08 · S-09 · S-10 | FormField 안내 줄 · Tabs `!` · 목록 필드 카운터 |
| S-13 | ExportSheet |
| S-15 · `base.settings` | `parseImportFile`(SF-05 ⑤) — 기준값 위 후보 검사. `submitImport`(F-ST-17)가 `base.settings`를 넘긴다 |
| S-16 (S3f) | S-11 · S-12 · S-14 · `useSettingsUi.requestBack`(F-ST-18 이탈 확인) |
| S-17 (S3f) | `saveSettings`(F-ST-09) — `saveCharacterSettings` 둘째 인자 |
| `modelDraft` (S3f) | ReadyBody → ModelChoice `value`(components.md §3.11) |

### 2.5 한계

- L-1: 서버 값의 목록 항목 안에 줄바꿈이 있으면(가져오기·다른 클라이언트) 초안에서는 줄마다 다른 항목이 된다. S-06이 기준값도 같은 왕복을 거쳐 비교하므로 열자마자 dirty가 되지는 않는다. 그 상태에서 다른 필드를 고쳐 저장하면 그 항목은 줄 단위로 나뉘어 저장된다("한 줄에 하나" 규칙과 같은 결과).

### 2.6 모델 선택과 파일 기능의 경계 (S3f 불변식, R-SET-007 개정)

비유: 모델 선택은 대본이 아니라 극장의 조명 스위치다. 대본 복사본(내보내기)에는 스위치 위치가 적히지 않고, 남의 대본을 옮겨 적어도(가져오기) 스위치는 움직이지 않는다.

| # | 불변식 | 보장 수단 | TC |
|---|---|---|---|
| M-1 | 내보내기 파일에 모델 키가 없다 | SF-01 `toExportFile(settings: CharacterSettings, now)` 입력에 모델이 없다. S-13 `exportTargetOf`는 `base.settings` 또는 `normalizeDraft(draft)`만 돌려준다. **코드 변경 없음** | TC-ST-049 · 034 |
| M-2 | 가져오기로 모델이 바뀌지 않는다 | SF-05~10은 `CharacterSettings` 화이트리스트만 읽고 `SettingsPatch`에 모델 자리가 없다. T-06은 `modelDraft`를 건드리지 않는다. 파일 안 `model` 키는 화이트리스트 밖이라 무시 계수에도 안 잡힌다. **코드 변경 없음** | TC-ST-050 · 051 |
| M-3 | 사전 검사는 본체만 본다 | S-07 `precheckDraft(draft)` 입력은 `SettingsDraft`. 모델 값은 두 키 중 하나만 들어올 수 있어 검사할 것이 없다 | TC-ST-051 |
| M-4 | `settingsFile.ts`·`settingsCandidate.ts`는 `LlmModelKey`를 import하지 않는다 | 리뷰 grep(0건) | TC-ST-036 확장 권고 |

---

## 3. `ui/src/state/settingsFile.ts`

정본: api.md §16(형식·판별·병합·매핑·금지 규칙). 이 절은 함수 경계만 정한다. 파일 내용·결과를 `console`에 남기지 않는다(R-SET-012 · §16.4).

확정 규칙(api.md v0.5 보정 2 §16.2·§16.3 문구 그대로):

- **분류 3종 — 후보 만들기(SF-07·SF-09) 한 곳에서만.** 화이트리스트 위치마다 셋 중 하나다.

| 분류 | 조건 | 처리 | 무시 수 |
|---|---|---|---|
| 후보 | 값이 있고 형이 맞다(글 = 문자열, 목록 = 문자열 배열, E.No.S는 §16.3 변환을 거친 값) | 초안에 덮을 값 | 세지 않음 |
| 무시 | 값이 있으나(`undefined`·`null` 아님) 형이 달라 쓸 수 없다 | 초안 값 유지 | **1건** |
| 없음 | 키 없음 · `undefined`·`null` · E.No.S 출처가 없는 필드(`persona`·`relationships`·`rules`) · 대응 캐릭터 없음 · E.No.S 출처가 trim 뒤 빈 값 | 초안 값 유지 | 세지 않음 |

- `appearance`는 E.No.S 출처 4개를 **각각** 분류한다(형이 다른 출처 1개 = 무시 1건, 쓸 출처가 하나도 없으면 "없음"). 배열 출처(`sample_dialogue`·`personality_tags`, 자체 형식 목록 필드)에 문자열이 아닌 항목이 하나라도 있으면 그 출처가 무시 1건이다. world·캐릭터를 고르는 판별 키(`DB.worlds`·`characters`·`name`)는 세지 않는다.
- 무시 수는 이 단계에서만 센다. 검사·덮기 단계는 다시 세지 않는다.
- **후보 검사.** 기준값 = **마지막으로 읽거나 저장한 값**(`base.settings`, 서버가 검증해 언제나 통과). 그 위에 **후보만** 덮은 객체를 `checkCharacterSettings`로 검사한다(S-15 `checkPatchedSettings` = 덮기 + 이 호출). 상한만 보는 별도 필드 단위 검사 함수는 없다. 기준이 통과하는 값이라 위반은 반드시 후보 필드에서 나온다(형·필수·상한·개수 모두, 문구는 api.md §4.16 표). 실패하면 가져오기 **전체 거부**, 잘라 넣지 않음, 초안 불변.
- **덮기.** 통과하면 검사 결과 `value`에서 **후보 위치의 정규화 값만** 꺼내 `SettingsPatch`로 돌려준다. 리듀서 T-06이 그 위치만 현 초안에 덮는다. 후보가 아닌 위치는 초안 그대로다.
- **초안 전체 검사는 가져오기에서 하지 않는다.** 파일과 무관한 기존 초안 오류는 가져오기를 막지 않고, 저장 활성 조건(S-07·S-11)에서 드러난다.
- **후보 0개**면 초안을 바꾸지 않고 알린다(F-ST-17 `importNothing`).

### 3.1 타입

```ts
import type { CharacterSettingsFile } from '@shared/settings'
import type { CharacterSettings } from '@shared/types'

export type ImportSource = 'self' | 'enosBackup' | 'enosWorld'

export type ImportFailureReason =
  | 'tooLarge' | 'readFailed' | 'notJson' | 'unknownFormat' | 'unsupportedVersion' | 'noMatchingWorld' | 'invalid'

export type ImportApplied = {
  readonly world: boolean            // world 를 파일 값으로 바꿨는가
  readonly sebastian: number         // 파일 값으로 채운 필드 수(0~11)
  readonly ciel: number
}

export type ImportResult =
  | { ok: true; patch: SettingsPatch; source: ImportSource; applied: ImportApplied; ignoredCount: number }
  | { ok: false; reason: Exclude<ImportFailureReason, 'invalid'> }
  | { ok: false; reason: 'invalid'; message: string }   // 후보 검사의 checkCharacterSettings issue.message 그대로

export type ImportSuccess = Extract<ImportResult, { ok: true }>
export type ImportFailure = Extract<ImportResult, { ok: false }>
```

`SettingsPatch`는 `state/settings.ts`(§2.1)에서 import한다. 후보가 0개인 성공(맞는 형식이지만 쓸 값이 없음)도 `ok: true`(빈 patch, `applied` 전부 0·false)로 돌려준다. 화면이 따로 처리한다(F-ST-17).

### 3.2 함수

| # | 시그니처 | 동작 |
|---|---|---|
| SF-01 | `toExportFile(settings: CharacterSettings, now: Date): CharacterSettingsFile` | `{ format: SETTINGS_FILE_FORMAT, formatVersion: SETTINGS_FILE_FORMAT_VERSION, exportedAt: now.toISOString(), settings: 화이트리스트 사본 }`. 사본은 `world` + `SETTINGS_CHARACTER_IDS` × `CHARACTER_FIELD_KEYS` 순서로 **새로 만든다**(입력 객체를 펼치지 않는다, 목록은 배열 복사). 최상위 키 정확히 4개 |
| SF-02 | `serializeExportFile(file: CharacterSettingsFile): string` | `JSON.stringify(file, null, 2)` |
| SF-03 | `exportFileName(now: Date): string` | `london-dispatch-characters-YYYYMMDD-HHmm.json`, 브라우저 현지 시각, 0 채움(api.md §16.1). 예: `2026-10-06 09:05` → `london-dispatch-characters-20261006-0905.json` |
| SF-04 | `utf8ByteLength(text: string): number` | `new TextEncoder().encode(text).length` |
| SF-05 | `parseImportFile(text: string, base: CharacterSettings): ImportResult` | `base` = 마지막으로 읽거나 저장한 값(`state.base.settings`). 순서: ① `utf8ByteLength(text) > SETTINGS_IMPORT_MAX_BYTES` → `tooLarge` ② `JSON.parse` 실패·최상위가 객체 아님 → `notJson` ③ `detectImportSource` ④ 출처별 후보 만들기(SF-07~09, 분류·무시 계수는 여기서만) ⑤ `checkPatchedSettings(base, candidate 값)`(S-15 = 덮어쓴 뒤 `checkCharacterSettings`) → 실패면 `{ ok: false, reason: 'invalid', message: issue.message }`(그 문장 그대로, 초안 불변, 자르지 않음). 자체 형식이 `world: ''`·`speech: ''`를 주면 필수 위반으로 거부된다 ⑥ 통과 값에서 후보 위치만 꺼낸 `patch` ⑦ `{ ok: true, patch, source, applied, ignoredCount: candidate.ignoredCount }`. 현 초안은 입력으로 받지 않는다(초안 전체 검사 없음). throw 없음 |
| SF-06 | `detectImportSource(root: Record<string, unknown>): ImportSource \| 'unsupportedVersion' \| 'unknownFormat'` | api.md §16.2 순서 2~5: `format === SETTINGS_FILE_FORMAT` → 버전이 같으면 `self`, 다르면 `unsupportedVersion` · `root.DB`가 객체이고 `DB.worlds`가 배열 → `enosBackup` · `root.characters`가 배열 && `root.description`이 문자열 → `enosWorld` · 그 밖 `unknownFormat` |
| SF-07 | `candidateFromSelf(root): Candidate` | `root.settings`의 화이트리스트 키만 읽는다(`world`, `characters.{sebastian\|ciel}.{CHARACTER_FIELD_KEYS}`). 위 분류표대로. **"값 있음" = 키가 있고 값이 `undefined`·`null`이 아님.** 값 있음 + 형 맞음 → 후보(글 = 문자열, 목록 = 문자열 배열. 자체 형식은 빈 문자열도 후보 — S-15 검사가 필수 위반으로 거부한다) · 키 없음·`undefined`·`null` → 없음(세지 않음, 초안 유지) · 값 있음 + 형 다름 → 무시 1건(문자열 아닌 항목이 섞인 배열도 1건). `settings`·`characters`·캐릭터 값 자체가 객체가 아니면 그 아래는 "없음" |
| SF-08 | `pickEnosWorld(root): Record<string, unknown> \| null` | 백업: `DB.worlds`를 앞에서부터 보고 `characters` 배열에 `name`이 shortName(`CHARACTERS[id].shortName`)을 포함하는 항목이 있는 첫 world. 없으면 null → `noMatchingWorld`. world 단독: root 자체 |
| SF-09 | `candidateFromEnosWorld(world): Candidate` | api.md §16.3 매핑표 그대로: `world.description` → `world`, 캐릭터마다 `name`에 shortName이 든 첫 항목 → 필드 매핑(`source_material`·`age`(숫자면 `String`)·`gender`·`job`→role·`personality_tags`(배열이면 `', '`)·`appearance_desc`+`hair_style`+`eyes`+`accessories`(`'\n'`)·`voice`→speech·`sample_dialogue`(문자열이면 줄 나눔·trim·빈 줄 제거)). 분류는 위 표: 출처 키 없음·`undefined`·`null`·**trim 뒤 빈 문자열** → 없음(세지 않음, 후보 아님, `applied`에 안 잡힘 — 예: `voice: ''` → `speech` 초안 유지, `job: null` → `role` 초안 유지), 받는 형(문자열, 표가 허용한 문자열 배열, `age`의 숫자)이 아니면 무시 1건, `appearance`는 출처 4개 각각, 배열 출처에 문자열 아닌 항목이 있으면 그 출처 1건. `persona`·`relationships`·`rules`·대응 캐릭터 없음은 없음. **`SETTINGS`·`DB.chats`·표에 없는 키는 접근하지 않는다** |
| SF-10 | `patchFromChecked(value: CharacterSettings, candidate: Candidate): { patch: SettingsPatch; applied: ImportApplied }` | 덮어쓰기·검사는 S-15가 한다. 이 함수는 검사 통과 `value`에서 **후보 위치만** 꺼낸다(정규화된 값). `applied` = 후보 위치 수(world는 boolean). **무시 계수는 하지 않는다** — SF-05가 `candidate.ignoredCount`를 그대로 돌려준다 |

`Candidate = { world?: string; characters: Partial<Record<CharacterId, Partial<Record<keyof CharacterSettingFields, string | string[]>>>>; ignoredCount: number }`(`ui/src/state/settingsCandidate.ts`에서 export한다. settingsFile.ts의 `parseImportFile`이 모듈 경계를 넘어 쓰기 때문이다. 화면 코드는 쓰지 않는다). `ignoredCount`는 SF-07·SF-09만 올린다.

- 파일 읽기(`FileReader`)는 DOM이라 여기 두지 않는다. ImportSheet(F-ST-15)가 읽고 문자열을 SF-05에 넘긴다. 파일 크기 사전 거부(`File.size`)도 ImportSheet가 한다(읽기 전에).
- `base`는 호출 쪽이 `state.base.settings`를 넘긴다. 초안에는 리듀서 `imported`(T-06)로 patch 위치만 들어간다.

### 3.3 가져오기 단위 벡터 (TC-ST-035 · TC-ST-041)

기존 5종(자체 · E.No.S 백업 · world 단독 · 잘못된 형식 · `SETTINGS.apiKey` 포함 → 결과에 키 0)에 api.md §16.3 보정 벡터 6행을 더한다.

| # | 벡터 | 기대 |
|---|---|---|
| V-1 | E.No.S 백업, 매핑 출처가 모두 문자열 | 무시 0. patch에 `persona`·`relationships`·`rules` 없음(초안 그대로) |
| V-2 | E.No.S 백업, `age: 13` · `gender: {}` · `sample_dialogue: ['a', 1]` | patch `age = '13'`, 무시 2(`gender`·`sample_dialogue`), 두 필드는 patch에 없음 |
| V-3 | E.No.S 백업, `voice: ''` · `job: null` | 둘 다 없음, 무시 0, patch에 `speech`·`role` 없음 |
| V-4 | 자체 형식, `characters.ciel.speech` 801자 | `{ ok: false, reason: 'invalid', message: '시엘 · 말투는 1~800자여야 합니다.' }`, 초안 불변 |
| V-5 | 자체 형식, `characters.sebastian.rules: 'a'` | `rules`만 무시 1, 나머지 후보는 patch에 반영 |
| V-6 | world 단독(`description`만 유효) + 현 초안 `sebastian.appearance` 801자(미저장 입력) | 성공(patch = `world`만), 무시 0. 덮은 뒤 `precheckDraft`는 `세바스찬 · 외형은 800자 이하여야 합니다.`로 실패 → 저장 비활성, 초안의 801자 입력은 그대로 |
