# settings 상세 설계 — 기능 명세 (분할 문서)

> 주 문서: `ui/src/settings/design.md`(RTM 포함). 이 파일은 주 문서 §5의 상세다.
> 상태·순수 함수(S-xx · SF-xx · T-xx)는 `design/state.md`, 컴포넌트 Props는 `design/components.md`.
> 문구 키는 `ui/src/settings/requirements.md` §5(labels.ts 단일 소스).

## 1. `useSettingsEditor` (`ui/src/settings/useSettingsEditor.ts`)

```ts
export type UseSettingsEditorOptions = {
  onAuthFailure: () => void
  onOwnerLost: () => void
  onLeave: (notice?: ToastProps) => void
  showToast: (message: string, tone: ToastTone) => void
}
export type UseSettingsEditorResult = {
  state: SettingsState
  dispatch: Dispatch<SettingsAction>     // 편집·되돌리기·가져오기 액션은 화면이 바로 보낸다
  loadSettings: () => Promise<void>      // F-ST-03. SettingsScreen 마운트 effect가 부른다
  retryLoad: () => void
  saveSettings: () => Promise<void>
  focusTargetRef: RefObject<FocusTarget | null>   // FocusTarget = 'title' | 'save'. useSettingsUi가 읽는다
}
export const useSettingsEditor = (options: UseSettingsEditorOptions): UseSettingsEditorResult
```
- 콜백은 `latestRef`(매 렌더 `useLayoutEffect` 갱신)로 읽는다(rooms `useRoomsLoader`와 같은 방식). 활성 플래그 `isActiveRef`는 마운트 `useLayoutEffect` true · cleanup false. 내부는 `useLoadActions`(F-ST-03~05)·`useSaveAction`(F-ST-09·10)로 나뉜다.

### 1.1 실물 배치 (v1.2.1)

| 기능 | 실물 위치 |
|---|---|
| F-ST-01 마운트 effect | SettingsScreen `useEffect([titleRef, loadSettings])` — 두 값 모두 identity가 고정이라 마운트 1회 |
| F-ST-06 `selectTab` · F-ST-12 `openFileMenu`·`closeSheet` · F-ST-13 `openExport` · `openImport` · F-ST-18 `requestBack` · F-ST-19 `confirmLeave` | `useSettingsUi` 반환값. `cancelLeave`는 따로 없고 `closeSheet`가 맡는다. 스크롤 맨 위는 ReadyBody 지역 FormPanel의 layout effect |
| F-ST-08 파생 값 | ReadyBody `useMemo([state])` |
| F-ST-09·10 저장 뒤 포커스 | 훅이 `focusTargetRef`에 적고 `useSettingsUi` 내부 `useSaveFocus`가 옮긴다 |
| F-ST-12 2차 포커스 복귀 | `useSettingsUi` 내부 `useSheetFocusReturn` |
| F-ST-14 · F-ST-17 화면 쪽 | index.tsx 지역 `createSheetResults` — `onDownloadFailed`·`onImported`(닫고 토스트) |
| F-ST-15 `pickFile` · F-ST-16 `changePaste` · F-ST-17 `submitImport` | `useImportForm`의 `pickFile`·`changePaste`·`submit` |
| F-ST-20·21 문구 함수 | `labels` 객체 멤버(`labels.statusText`·`labels.importFailureText` 등. 단독 export 없음) |

## 2. 기능 명세 (function 단위)

| # | 시그니처(위치) | 입력 | 출력·상태 변경 | 동작 | 예외·분기 | 요구ID |
|---|---|---|---|---|---|---|
| F-ST-01 | `SettingsScreen(props: SettingsScreenProps): JSX.Element` (`index.tsx`) | components.md §3.1 | 렌더 | 마운트 `useEffect([])`: `titleRef.current?.focus()` → `loadSettings()`(F-ST-03). 처음 탭 `'world'`. 분기는 components.md §1 트리 | ⋯는 `phase === 'ready'`일 때만 렌더(loading·error에는 내보낼 값이 없다, 구성안 §4) | R-SET-009 · R-ROOMS-005 |
| F-ST-02 | `useSettingsEditor(options)` | §1 | §1 | 리듀서·요청·활성 플래그 소유 | — | R-SET-009 |
| F-ST-03 | `loadSettings(): Promise<void>` (훅 내부, `useCallback([])`) | — | T-02 / T-03 | **설정 화면에 들어올 때마다 다시 GET한다**(App 판정 응답은 쓰지 않는다 — 메인 세션 결정 기본값, stale 방지). `const r = await getCharacterSettings()` → 비활성이면 종료 → 성공 `dispatch(loadSucceeded)` / 실패 `handleLoadFailure(r.error)` | 래퍼 throw 없음 | R-SET-004 · R-SET-009 |
| F-ST-04 | `retryLoad(): void` | — | T-01 → F-ST-03 | StateView 「다시 시도」 | 버튼은 error 상태에서만 있다 | R-SET-009 |
| F-ST-05 | `handleLoadFailure(error: ApiError): void` | 실패 | 아래 | `error.code === 'OWNER_ONLY'` → `onOwnerLost()` → `onLeave({ message: labels.ownerOnly, tone: 'warning' })`. `isAuthFailure(error)` → `onAuthFailure()` → `onLeave({ message: labels.authText(code), tone: 'warning' })`. 그 밖 → `dispatch(loadFailed)`(StateView error, 상세 `loadErrorDetail(code)`) | 순서: `OWNER_ONLY` 먼저(인증 3코드가 아니다, `isAuthFailure` false) | R-SET-010 · R-CHAT-011 · R-SET-001 |
| F-ST-06 | `selectTab(tab: SettingsTab): void` (화면, `setActiveTab`) | 탭 | `activeTab = tab`, 폼 스크롤 맨 위 | Tabs `onSelect`. 초안은 리듀서에 있으므로 탭을 바꿔도 유지된다. 전환 뒤 폼 영역 `scrollTop = 0` | 같은 탭이면 아무것도 안 함 | R-SET-009 |
| F-ST-07 | `changeWorld(value)` · `changeCharacterField(id, key, value)` (화면 → `dispatch`) | 입력값 | T-04 | 잘라 내지 않는다(상한 초과도 그대로 두고 안내·저장 비활성) | 저장 중이면 입력이 readOnly라 오지 않는다(리듀서도 무시) | R-SET-009 · R-SET-002 |
| F-ST-08 | 파생 값 계산 (화면 렌더 중, `useMemo([state])`) | `state` | `status`(S-14) · `canSave`(S-11) · `canRevert`(S-12) · 탭별 `hasIssue`(S-09) · 필드별 안내(S-08) | 매 렌더 순수 계산. 사전 검사 = `precheckDraft`(S-07) | phase가 ready가 아니면 계산하지 않는다 | R-SET-002 · R-SET-005 · R-SET-009 |
| F-ST-09 | `saveSettings(): Promise<void>` (훅) | — | T-07 → T-08 / T-09 / T-10 | `saveInFlightRef`가 true이거나 `!canSaveSettings(state)`면 종료. `check = precheckDraft(draft)`가 ok가 아니면 종료(이중 방어). `saveInFlightRef = true` → `dispatch(saveStarted)` → `r = await saveCharacterSettings(check.value)` → `saveInFlightRef = false` → 비활성이면 종료 → 성공: `dispatch(saveSucceeded(r.value))` → `showToast(labels.saved, 'success')` → 포커스 h1(`titleRef`, 저장 버튼이 clean으로 비활성이 되므로) / 실패: `handleSaveFailure(r.error)` | 본문은 정규화된 검사 통과 값(api.md §4.16). 래퍼 throw 없음. 포커스 이동은 상태가 커밋된 뒤 화면의 layout effect가 한다(훅이 `focusTargetRef`에 `'title' \| 'save'`를 적고, SettingsScreen `useLayoutEffect([state])`가 읽어 포커스한 뒤 비운다) | R-SET-005 · R-SET-009 |
| F-ST-10 | `handleSaveFailure(error: ApiError): void` (훅) | 실패 | 아래 | `OWNER_ONLY` → `onOwnerLost()` → `onLeave({ ownerOnly, warning })`(초안 버림). `isAuthFailure` → `onAuthFailure()`(App 읽기 전용 전환) → `dispatch(staleEntered)`(초안 보존, 토스트 없음 — F 안내 줄이 알린다). 그 밖 → `dispatch(saveFailed)` → `showToast(labels.saveErrorText(error), toastToneOf(error))`(rooms F-RM-22 재사용). **포커스(저장 클릭 뒤, a11y.md §2.6과 같다):** 성공 → h1 · 그 밖 실패 → 다시 활성이 된 「저장」(`saveButtonRef`) · stale → h1 · `OWNER_ONLY` → rooms가 새로 마운트되며 rooms h1 | 400은 탭을 옮기지 않는다(서버 응답에 path가 없다. 사전 검사를 통과한 초안이라 정상 경로에서는 나오지 않는다 — design.md §11 D-ST-4) | R-SET-011 · R-CHAT-011 · R-SET-005 · R-SET-001 |
| F-ST-11 | `revertDraft(): void` (화면 → `dispatch({ type: 'reverted' })`) | — | T-05 | 「되돌리기」. 확인 시트 없음(요구 밖 제안 미채택) | `canRevert` false면 버튼 비활성 | R-SET-009 |
| F-ST-12 | `openFileMenu()` · `closeSheet()` (화면) | — | `sheet = 'fileMenu'` · `'none'` | ⋯ 클릭. **포커스 복귀(a11y.md §2.5와 같은 서술):** 1차는 공용 BottomSheet 복귀다 — ①에서 ②·③으로 바꿀 때 같은 커밋에서 ① cleanup이 ⋯로 포커스를 돌린 뒤 ②·③ 마운트가 ⋯를 기억하므로 ②·③이 닫혀도 ⋯로 돌아간다. 2차(대체): `sheet`가 `'none'`이 된 커밋의 layout effect에서 `document.activeElement`가 `body`이면 ①②③은 `fileMenuButtonRef`, ④는 `backButtonRef`에 포커스 | 저장 중이면 ⋯ 비활성 | R-SET-007 · R-SET-008 |
| F-ST-13 | `openExport(): void` (화면) | — | `sheet = 'export'` | ① 「내보내기」. ExportSheet가 `target = exportTargetOf(state)`(S-13), `note = isStale ? 'stale' : isDirty ? 'dirty' : null`로 마운트 | stale에서도 열린다 | R-SET-007 · R-SET-011 · R-NFR-004 |
| F-ST-14 | `downloadExport(): void` (ExportSheet) | — | 파일 다운로드 | `downloadText(text, fileName)`(components.md §3.10). `false` → `closeSheet()` 뒤 `showToast(labels.fileSaveFailed, 'warning')` | 실패 감지 못 하는 차단(sandbox)은 복사로 대체 | R-SET-007 |
| F-ST-15 | `pickFile(file: File): void` (ImportSheet) | 파일 | 시트 로컬 상태 | `pasteText = ''`, `error = null`, `fileName = file.name`. `file.size > SETTINGS_IMPORT_MAX_BYTES` → `fileText = null`, `error = importFailureText({ ok: false, reason: 'tooLarge' })`(읽지 않는다). 아니면 `isReading = true` → `FileReader.readAsText(file, 'utf-8')` → `onload`: `fileText = 결과 문자열`, `isReading = false` / `onerror`: `error = importFailureText({ ok: false, reason: 'readFailed' })`, `isReading = false` | 시트가 닫힌 뒤 도착한 onload·onerror는 무시(`readerActiveRef`, state.md §1) | R-SET-008 |
| F-ST-16 | `changePaste(value: string): void` (ImportSheet) | 붙여넣기 | `pasteText = value`, `fileName·fileText = null`, `error = null` | — | — | R-SET-008 |
| F-ST-17 | `submitImport(): void` (ImportSheet) | — | 아래 | `text = fileText ?? pasteText` → `result = parseImportFile(text, base)`(SF-05 — `base` = 마지막 저장값 `state.base.settings` 위에 후보만 덮어 `checkCharacterSettings`, 초안 전체는 검사하지 않는다) → 실패: `error = importFailureText(result)`(`invalid`면 `message` 그대로, 예 `시엘 · 말투는 1~800자여야 합니다.`), 초안 불변, 시트 유지 / 성공: `onImported(result)` → 화면이 `applied`를 본다: 후보 0개(전부 0·false)면 **초안을 바꾸지 않고** `closeSheet()` → `showToast(labels.importNothing(ignoredCount), 'warning')` / 아니면 `dispatch({ type: 'imported', patch: result.patch })`(후보 위치만 덮음) → `closeSheet()` → `showToast(labels.importSummary(result), 'success')`. **저장하지 않는다** | stale에서는 메뉴 항목이 비활성이라 오지 않는다(리듀서 T-06도 무시) | R-SET-008 · R-NFR-004 |
| F-ST-18 | `requestBack(): void` (화면, ‹) | — | 아래 | `phase !== 'ready'` 또는 `!isDraftDirty` → `onLeave()`. dirty(stale 포함) → `sheet = 'leave'` | 저장 중이면 ‹ 비활성 | R-SET-009 |
| F-ST-19 | `confirmLeave()` · `cancelLeave()` (화면) | — | `onLeave()` · `sheet = 'none'` | ④ 「나가기」는 초안을 버리고 rooms로. 「취소」·Esc·덮개는 머문다 | — | R-SET-009 |
| F-ST-20 | `statusText(status: SettingsStatus): string` (`labels.ts`) | 상태 | 문구 | requirements.md §5.3. `saved`는 `formatMonthDay(updatedAt)`·`formatTime(updatedAt)` | — | R-SET-009 |
| F-ST-21 | `importSummary(result: ImportSuccess)` · `importNothing(ignoredCount: number)` · `importFailureText(failure: ImportFailure)` · `saveErrorText(error)` · `authText(code)` (`labels.ts`) | — | 문구 | requirements.md §5.5~§5.7 | `VALIDATION_ERROR`는 서버 문장, 가져오기 `invalid`는 `checkCharacterSettings` 문장을 그대로 쓴다 | R-SET-008 · R-CHAT-011 |

- 함수 50줄·파일 400줄 한계를 지킨다. `index.tsx`는 조립, 요청은 훅, 시트 내부 상태는 각 시트가 갖는다.
- 시트가 열린 동안 토스트를 띄우지 않는다: F-ST-14·17은 `closeSheet()` 뒤에 토스트를 띄운다.
- 화면 코드에 `fetch`·토큰 접근·`console` 없음(TC-ST-036).

## 3. 파이프라인

### 3.1 열기 · 정상

```
rooms ⚙ → App.openSettings (rooms F-RM-25) → SettingsScreen 마운트 → h1 포커스 → state=loading (StateView "설정을 불러오는 중")
 → getCharacterSettings()  (Authorization 헤더는 래퍼가 붙인다)
 → 200 → loadSucceeded → ready: 탭 [공통 세계관] · 폼 · D "기본값 사용 중" | "v3 저장됨 10.06 14:20"
```

### 3.2 열기 · 실패

```
NETWORK · INTERNAL · CONFIG_INVALID → error 판 + 「다시 시도」 → loading → 재요청
OWNER_ONLY → onOwnerLost(isOwner=false) → onLeave(ownerOnly) → rooms: ⚙ 없음 · 토스트 1회
401 · LEVEL_TOO_LOW → onAuthFailure(revokeWrite) → onLeave(authText) → rooms 읽기 전용 · 토스트 1회
```

### 3.3 편집 · 저장

```
입력 → characterFieldChanged → dirty → D "저장하지 않은 변경 있음" · 되돌리기 활성
  └ 상한 초과·필수 빈 칸 → 카운터 over · 필드 안내 · 탭 ! · D 첫 위반 문구(danger) · 저장 비활성
저장 클릭 → saveStarted (입력 readOnly · ‹ ⋯ 되돌리기 저장 비활성 · D "저장 중...")
 → saveCharacterSettings(precheck.value)
 ├ 200 → saveSucceeded (초안·기준값 = 응답) → D "v4 저장됨 …" → 토스트 success "저장했습니다. …"
 ├ 400 → saveFailed → 토스트 danger = 서버 message (초안·탭 유지)
 ├ 429 → saveFailed → 토스트 warning "…40초 후…"
 ├ NETWORK · 5xx → saveFailed → 토스트 danger
 ├ 401 · LEVEL_TOO_LOW → onAuthFailure → staleEntered → F 안내 줄 · D "인증 만료" · 저장·되돌리기 비활성 · 가져오기 비활성 · 내보내기(초안) 가능 · 입력은 계속 가능
 └ OWNER_ONLY → onOwnerLost → onLeave(ownerOnly) → rooms
```

### 3.4 내보내기 · 가져오기

```
⋯ → ① 설정 파일 → 내보내기 → ② (대상: 기준값, stale이면 초안) JSON 보기 · 「파일로 저장」 → Blob 다운로드
⋯ → ① → 가져오기 → ③ 파일 선택(>5MB 거부) 또는 붙여넣기 → 불러오기 → parseImportFile(후보 분류 → 마지막 저장값 + 후보 → checkCharacterSettings)
 ├ 실패 → ③ 오류 줄(role=alert, "시엘 · 말투는 1~800자여야 합니다.") · 초안 불변 · 자르지 않음
 ├ 성공 · 반영 0 → 시트 닫힘 → 토스트 warning "가져올 항목이 없습니다." · 초안 불변
 └ 성공 → imported(초안만) → 시트 닫힘 → 토스트 요약(success) → (사용자가) 저장 — 후보 밖 초안 필드의 문제는 저장 비활성·하단 줄로 드러난다
```

### 3.5 이탈

```
‹ → clean → rooms
‹ → dirty(stale 포함) → ④ "저장하지 않은 변경이 있습니다" → 취소(머묾) | 나가기(rooms, 초안 버림)
```

- 파괴 조작 confirm: 미저장 이탈만 confirm이다(구성안 §5-4). 「되돌리기」·가져오기(초안 덮어쓰기)는 confirm 없이 한다 — 둘 다 저장 전이고 되돌릴 경로가 있다(되돌리기는 저장값이 남아 있고, 가져오기는 「되돌리기」로 취소). 요구 밖 「되돌리기 확인」 제안은 미채택(메인 세션 결정).
