# settings 상세 설계 — 컴포넌트·스타일 (분할 문서)

> 주 문서: `ui/src/settings/design.md`(RTM 포함). 이 파일은 주 문서 §3의 상세다.
> 공용 요소(TopBar·Button·IconButton·StateView·TextInput·TextArea·BottomSheet·SheetItem·ConfirmDialog·Toast·useToast·cx·formatDate)의 **단일 정의는 `ui/src/rooms/design/components.md` §1**이다. 이 파일은 인용만 한다. S3c 공용 델타 2건(IconButton `settings` · ToastTone `success`)도 거기 적었다.
> export 규칙: named export만(rooms components.md 머리말). Props 타입은 `export type {Name}Props`.
> 표준 HTML 원소: 화면 코드(`index.tsx`·폼 조립 컴포넌트)는 `<main>`·`<section>`·`<div>`·`<h1>`·`<h2>`·`<p>`·`<span>`만 쓴다. `<button>`·`<input>`·`<textarea>`·`<a>`는 공용 ui와 로컬 `Tabs`·`FilePicker`, 유틸 `download.ts` 안에만 있다. (v1.3 S3f) 로컬 `ModelChoice` 안에서만 `<fieldset>`·`<legend>`·`<label>`·`<input type="radio">`를 쓴다(공용 라디오 컴포넌트가 없다, s3f-02 §5.1).

---

## 1. 컴포넌트 트리

```
App (ui/src/App.tsx)                              view.screen === 'settings' (rooms design/functions.md F-RM-26). main.tsx 무수정(App이 SettingsScreen 정적 import)
└─ SettingsScreen (ui/src/settings/index.tsx)     조립만. 요청·전이 = useSettingsEditor, 탭·시트·포커스 = useSettingsUi
   ├─ SettingsTopBar (index.tsx 지역) → TopBar [공용] title=「캐릭터 설정」 titleRef
   │   left  = IconButton [공용] icon='back' (F-ST-18)  isDisabled={isSaving}  buttonRef={backButtonRef}
   │   right = phase==='ready' && IconButton [공용] icon='more' (F-ST-12)  isDisabled={isSaving}  buttonRef={fileMenuButtonRef}
   ├─ SettingsBody (index.tsx 지역)  판정 순서 error → loading → ready
   │   ├─ 'error'   → StateView [공용] error(+다시 시도 F-ST-04)
   │   ├─ 'loading' → StateView [공용] loading
   │   └─ 'ready'   → ReadyBody [로컬]                 파생 값 useMemo([state]) (F-ST-08)
   │        ├─ Tabs [로컬]                             B 40px (F-ST-06)
   │        ├─ FormPanel (ReadyBody 지역) <section role=tabpanel>  C flex · activeTab 바뀌면 scrollTop 0
   │        │   ├─ 'world'   → ModelChoice [로컬, S3f] (위) + WorldForm [로컬] (아래)   §3.11 · §4.1
   │        │   └─ 캐릭터   → CharacterForm [로컬] key={activeTab}
   │        │        └─ TextField | ListField (지역) → FormField [로컬] × 11 (묶음 소제목 3) → TextInput | TextArea [공용]
   │        ├─ toast && Toast [공용]                    E 28px (key={toast.id})
   │        ├─ isStale && StaleNotice [로컬]            F 40px
   │        └─ StatusBar [로컬]                         D 36px — Button [공용] × 2 (저장에 saveButtonRef)
   └─ phase === 'ready' && SheetLayer [로컬]           열린 시트 하나(sheet 상태)
        'fileMenu' → FileMenuSheet [로컬] = BottomSheet + SheetItem × 2 + 취소
        'export'   → ExportSheet [로컬]   = BottomSheet + TextArea(isReadOnly) + Button × 2
        'import'   → ImportSheet [로컬]   = BottomSheet + FilePicker [로컬] + TextArea + Button × 2 (입력 상태 = useImportForm)
        'leave'    → ConfirmDialog [공용]
        'none'     → 렌더 없음
훅: useSettingsEditor · useSettingsUi · useImportForm (ui/src/settings/*.ts) · useToast [공용]
유틸: download.ts (ui/src/settings/download.ts) — downloadText
시트 결과 처리: index.tsx 지역 createSheetResults → onImported · onDownloadFailed (시트를 닫은 뒤 토스트)
```

## 2. 배치 3단계 분류

| 컴포넌트·모듈 | 위치 | 분류 | 근거 |
|---|---|---|---|
| TopBar · Button · StateView · TextInput · TextArea · BottomSheet · SheetItem · ConfirmDialog · Toast · useToast · formatDate · cx | `ui/src/components/**` | ① 공용 재사용(변경 없음) | 구성안 §8 |
| IconButton | `ui/src/components/ui/IconButton/` | ① 공용 **변경** — `settings` 아이콘(rooms ⚙에서 씀). 이 화면은 `back`·`more`만 쓴다 | 구성안 §7·§8, 메인 세션 결정 |
| Toast `ToastTone` | `ui/src/components/ui/Toast/` | ① 공용 **변경** — `'success'` 톤 추가(저장 성공·가져오기 요약) | ui_design_concept §3 "정상·저장됨 = success". 메인 세션 승인 2026-10-06(design.md §12) |
| `settings` · `settingsFile` · `settingsCandidate` | `ui/src/state/` | 상태 모듈(순수). `settingsCandidate`는 후보 분류(SF-07~10)를 400줄 한계로 나눈 것 | 인계 패킷 §3.3 · state.md · §5.1 |
| `useSettingsEditor` | `ui/src/settings/` | 화면 로컬 훅 | 로드·저장 요청, 50줄 한계 분리 |
| `useSettingsUi` · `useImportForm` | `ui/src/settings/` | 화면 로컬 훅 | 탭·시트·포커스 / ③ 입력 상태. §5.1 |
| ReadyBody · SheetLayer | `ui/src/settings/components/` | ④ 로컬 | index.tsx 400줄·함수 50줄 한계 분리. §5.1 |
| Tabs | `ui/src/settings/components/Tabs.tsx` | ④ 로컬 · **공용 승격 후보** | 구성안 §8(승격은 후작업) |
| FormField | `ui/src/settings/components/FormField.tsx` | ④ 로컬 · 승격 후보 | TextInput·TextArea에 보이는 라벨·안내 줄이 없다 |
| FilePicker | `ui/src/settings/components/FilePicker.tsx` | ④ 로컬 · 승격 후보 | 공용 파일 입력 없음 |
| ModelChoice (S3f) | `ui/src/settings/components/ModelChoice.tsx` · `ModelChoice.module.css` (신규) | ④ 로컬 · 승격 후보 | 공용 라디오 묶음 없음(component-catalog에 radio 없음). 네이티브 원소로 방향키 이동을 기본 제공받는다 |
| StaleNotice | `ui/src/settings/components/StaleNotice.tsx` | ④ 로컬 | chat 열람 안내 줄과 같은 틀(chat 로컬이라 재사용 불가) |
| WorldForm · CharacterForm · StatusBar · FileMenuSheet · ExportSheet · ImportSheet | `ui/src/settings/components/` | ④ 로컬 | 화면 전용 |
| `downloadText` | `ui/src/settings/download.ts` | 로컬 유틸(DOM 부수 효과) | 상태 모듈을 순수하게 두려고 분리 |

---

## 3. 로컬 컴포넌트 Props·렌더

### 3.1 SettingsScreen (`index.tsx`)

```ts
export type SettingsScreenProps = {
  onLeave: (notice?: ToastProps) => void   // App.leaveSettings — rooms 로 간다. notice 가 있으면 rooms 가 토스트로 1회 띄운다
  onAuthFailure: () => void                // App.revokeWrite (F-RM-12) — 열기·저장의 인증 3코드에서만
  onOwnerLost: () => void                  // App.loseOwner — OWNER_ONLY 에서만
}
```
- 렌더 순서: `<main className=root aria-label={labels.screenTitle}>` → TopBar → (StateView | Tabs·section·Toast·StaleNotice·StatusBar) → 시트 1개.
- 루트 `display:flex; flex-direction:column; height:100%; position:relative`(시트 기준).
- 파일 400줄 한계: 시트·폼·하단 줄을 컴포넌트로 뺐다. `index.tsx`는 상태 연결·분기만(목표 200줄 안).

### 3.2 Tabs

```ts
export type TabItem<T extends string> = { id: T; label: string; hasIssue: boolean }
export type TabsProps<T extends string> = {
  items: readonly TabItem<T>[]
  activeId: T
  onSelect: (id: T) => void
  ariaLabel: string            // tablist 이름
  idPrefix: string             // tab id = `${idPrefix}-tab-${id}`, panel id = `${idPrefix}-panel`
  issueSuffix: string          // hasIssue 일 때 접근성 이름 뒤에 붙는 말
}
```
- 렌더: `<div role="tablist" aria-label>` 안에 `<button type="button" role="tab" id aria-selected aria-controls={panelId} tabIndex={active ? 0 : -1} aria-label={label + (hasIssue ? issueSuffix : '')}>` × n. 버튼 안 글자 `label` + (`hasIssue`) `<span aria-hidden="true" class=issue>!</span>`.
- 키보드: ←/→ 이전/다음(끝에서 순환), Home/End 처음/끝. 이동한 탭을 바로 선택(자동 활성)하고 그 버튼에 포커스. 클릭·Enter·Space = 선택.
- 3등분 폭(`flex: 1`), 높이 40, 글자 sm `--font-ui`. 선택: `--color-fg` + 아래 2px `--color-primary`. 비선택: `--color-fg-muted`. `!`: `--color-danger` xs bold, 글자 오른쪽 `--space-1`.

### 3.3 FormField

```ts
export type FormFieldProps = {
  label: string                // spec.label (+ listHint)
  isRequired: boolean          // 라벨 뒤 '*'(aria-hidden)
  issueText: string | null     // 필드 아래 안내 한 줄
  counter?: string             // 목록 필드: 라벨 줄 오른쪽 `n/10줄`
  isCounterOver?: boolean      // counter danger 색
  halfWidth?: boolean          // 나이·성별 2열
  children: ReactNode          // TextInput | TextArea (ariaLabel 은 호출 쪽이 requiredAria 로 넘긴다)
}
```
- 렌더: `<div class=field>` → `<div class=labelRow><span class=label>{label}{isRequired && <span aria-hidden>*</span>}</span>{counter && <span class=counter aria-hidden>}</div>` → children → `issueText && <p class=issue>{issueText}</p>`.
- 라벨은 보이는 글자다. 입력의 접근성 이름은 children의 `ariaLabel`이 맡는다(공용 입력에 `<label for>` 연결이 없다). 안내 줄은 live region이 아니다(입력할 때마다 읽히지 않게). 상한 초과는 공용 입력의 `aria-invalid`가 알린다.
- 라벨 줄 20px sm `--color-fg-muted`, 필수 `*` `--color-danger`. 안내 줄 xs `--color-danger`, 위 `--space-1`.

### 3.4 WorldForm · CharacterForm

```ts
export type WorldFormProps = {
  draft: SettingsDraft
  isReadOnly: boolean                       // isSaving
  onChange: (value: string) => void         // dispatch worldChanged
}
export type CharacterFormProps = {
  id: CharacterId
  draft: SettingsDraft
  isReadOnly: boolean
  onChange: (key: keyof CharacterSettingFields, value: string) => void
}
```

WorldForm: FormField(`label = WORLD_FIELD_SPEC.label`('세계관'), required) 안 `TextArea maxChars={2000} counterMode="always" maxRows={9} ariaLabel={requiredAria('세계관')}`. 구성안 §1 "C 높이를 채움"은 `maxRows`와 폼 영역 flex로 근사한다. **(v1.3 S3f) `WORLD_MAX_ROWS` 16 → 9** — 같은 탭 위에 ModelChoice(169px)가 들어가서다. 계산은 §4.1. 최소 높이 76px(3줄, `.area textarea`)는 그대로다. Props는 바뀌지 않는다(모델은 WorldForm이 아니라 ReadyBody가 ModelChoice에 넘긴다).

CharacterForm: `CHARACTER_FIELD_KEYS` 순서로 FormField 11개, 묶음 소제목 `<h2>` 3개.

| 순서 | key | 묶음 | 입력 | 공용 props |
|---|---|---|---|---|
| 1 | `sourceMaterial` | 기본 정보 | TextInput 전체 폭 | `maxChars={60}` |
| 2·3 | `age` · `gender` | 기본 정보 | TextInput 반 폭 2열(`halfWidth`) | `maxChars={40}` · `{20}` |
| 4 | `role` | 기본 정보 | TextInput 전체 폭 | `maxChars={80}` |
| 5 | `persona` | 인물 | TextArea | `maxChars={1500} counterMode="always" maxRows={10}` |
| 6 | `personalityTags` | 인물 | TextArea | `maxChars={200} counterMode="always" maxRows={4}` · 최소 2줄 |
| 7·8 | `appearance` · `relationships` | 인물 | TextArea | `maxChars={800} counterMode="always" maxRows={8}` |
| 9 | `speech` | 말투·규칙 | TextArea | `maxChars={800} counterMode="always" maxRows={8}` |
| 10 | `sampleDialogue` | 말투·규칙 | TextArea(목록) | maxChars 없음 · `maxRows={10}` · FormField `counter = lineCounter(n, 10)` |
| 11 | `rules` | 말투·규칙 | TextArea(목록) | maxChars 없음 · `maxRows={12}` · `counter = lineCounter(n, 20)` |

- `maxChars`·`maxItems`는 숫자를 적지 않고 spec에서 읽는다(`CHARACTER_FIELD_SPECS[key].max`). 위 숫자는 확인용.
- 목록 필드 라벨 = `spec.label + ' ' + listHint(spec.maxItems)`. 줄 수 = state.md S-10.
- 공용 TextArea의 최소 높이는 1줄이다. 구성안 줄 범위의 최소값은 화면 CSS로 맞춘다: 기본 `.rows3 textarea { min-height: 76px }`(3줄, 목록 필드 포함), `personalityTags`만 `.rows2 textarea { min-height: 56px }`(2줄, 구성안 "2~4줄"). 최대값은 `maxRows` prop. 공용 변경 없음(design.md §12 차이 3).
- `onEnter`를 넘기지 않는다(Enter = 줄바꿈). TextInput은 `onEnter` 없음(Enter 무동작).
- 각 필드의 `issueText` = `fieldIssueOf` → requirements.md §5.2 문구.

### 3.5 StatusBar (D)

```ts
export type StatusBarProps = {
  status: SettingsStatus                 // state.md S-14
  canRevert: boolean
  canSave: boolean
  onRevert: () => void
  onSave: () => void
  saveButtonRef: Ref<HTMLButtonElement>   // 저장 실패 뒤 포커스 복귀(F-ST-10)
}
```
- 렌더: `<div class=bar>` → `<p class={cx(text, tone)} role="status" aria-live="polite">{statusText(status)}</p>` → `Button size='md' variant='secondary' isDisabled={!canRevert}` 되돌리기 → `Button size='md' variant='primary' isDisabled={!canSave}` 저장.
- 높이 36(+위아래 `--space-1`이면 넘치므로 패딩 0, 버튼 md 36이 꽉 참), 위 1px `--color-border`, 좌우 `--space-4`. 문구 sm 한 줄 말줄임(`min-width:0; flex:1`). 색 클래스: `muted`·`warning`·`danger`(state.md S-14 표). 버튼 사이 `--space-2`.
- 버튼은 조건이 안 맞으면 **비활성**(미렌더 아님, 구성안 §3).

### 3.6 StaleNotice (F)

```ts
export type StaleNoticeProps = { message: string }
```
- `<p role="alert" class=root>` 40px(두 줄), sm, 배경 `--color-bg-elevated`, 글자 `--color-danger`, 왼쪽 3px 막대 `--color-danger`, 좌우 `--space-4`. stale 진입 렌더 1회로 읽힌다.

### 3.7 FileMenuSheet (①)

```ts
export type FileMenuSheetProps = {
  isImportDisabled: boolean      // isStale
  onExport: () => void
  onImport: () => void
  onClose: () => void
}
```
- `BottomSheet ariaLabel={fileMenuTitle} header={<h2>{fileMenuTitle}</h2>} onClose` 안 `SheetItem 내보내기` · `SheetItem 가져오기 isDisabled={isImportDisabled}` · `SheetItem 취소`. 약 188px.

### 3.8 ExportSheet (②)

```ts
export type ExportSheetProps = {
  target: CharacterSettings     // state.md S-13
  note: 'dirty' | 'stale' | null
  onClose: () => void
  onDownloadFailed: () => void  // 토스트 fileSaveFailed (시트를 닫은 뒤)
}
```
- 마운트 시 1회: `now = new Date()` → `text = serializeExportFile(toExportFile(target, now))`, `fileName = exportFileName(now)`(`useState(() => …)`). 열려 있는 동안 바뀌지 않는다.
- 렌더: header h2 `내보내기` → `note` 안내 `<p>`(dirty: sm muted / stale: sm danger) → `TextArea value={text} onChange={noop} isReadOnly maxRows={6} ariaLabel={exportTextAriaLabel} textareaRef`(초기 포커스) → 버튼 줄 `Button lg secondary 닫기` 왼쪽 · `Button lg primary 파일로 저장` 오른쪽.
- 「파일로 저장」 → `downloadText(text, fileName)`. `false`면 `onDownloadFailed()`. 성공이면 시트 유지(복사도 할 수 있게).
- 약 280px(최대 70%). 구성안의 "포커스하면 전체 선택"은 하지 않는다(공용 TextArea에 onFocus가 없다, design.md §12 차이 1).

### 3.9 ImportSheet (③) · FilePicker

```ts
export type ImportSheetProps = {
  base: CharacterSettings                      // state.base.settings — 마지막으로 읽거나 저장한 값(후보 검사 기준, state.md SF-05)
  onImported: (result: ImportSuccess) => void  // ImportSuccess = state/settingsFile.ts(state.md §3.1). 반영 0이면 초안 불변 + importNothing, 아니면 imported + 요약(F-ST-17)
  onClose: () => void
}
export type FilePickerProps = {
  label: string                 // 「파일 선택」
  fileName: string | null       // null 이면 noFileChosen
  emptyText: string
  accept: string                // 'application/json,.json'
  onPick: (file: File) => void
  isDisabled?: boolean          // isReading
}
```
- FilePicker 렌더: `<div class=row>` → `Button secondary md onClick={() => inputRef.current?.click()}` → `<input type="file" accept hidden ref onChange>`(선택 뒤 `value = ''`로 비워 같은 파일 재선택 허용) → `<span class=name>`(sm muted, 말줄임).
- ImportSheet 렌더: header h2 `가져오기` → FilePicker → `<p>` pasteLabel → `TextArea value={pasteText} maxRows={5} ariaLabel={pasteLabel}` → `error && <p role="alert" class=error>! {error}</p>` → `<p>` importNote → 버튼 줄 `취소`(lg secondary) · `불러오기`(lg primary, `isDisabled = isReading || (fileText === null && pasteText.trim() === '')`).
- 파일과 붙여넣기는 하나만 쓴다: 파일을 고르면 `pasteText = ''`, 붙여넣기에 입력하면 `fileName·fileText = null`. 둘 다 `error = null`로 지운다.
- 약 324px(오류 줄 있으면 약 360px).

### 3.10 `downloadText` (`download.ts`)

```ts
/** Blob 다운로드. 예외가 나면 false. 성공 여부(실제 저장)는 브라우저가 알려 주지 않는다 */
export const downloadText = (text: string, fileName: string, mime = 'application/json'): boolean
```
- `try`: `blob = new Blob([text], { type: mime })` → `url = URL.createObjectURL(blob)` → `a = document.createElement('a')`, `a.href = url`, `a.download = fileName`, `a.rel = 'noopener'` → `document.body.appendChild(a)` → `a.click()` → `a.remove()` → `setTimeout(() => URL.revokeObjectURL(url), 0)` → `true`. `catch` → `false`. 로그 없음.
- sandbox가 다운로드를 조용히 막으면 감지할 수 없다. 복사용 텍스트가 대체 경로다(수동 확인 TC-ST-038).

### 3.11 ModelChoice (S3f, 「공통」 탭 맨 위)

```ts
import type { LlmModelKey } from '@shared/types'

export type ModelChoiceProps = {
  value: LlmModelKey | null           // state.modelDraft. null = 미선택 판(두 라디오 모두 unchecked)
  isReadOnly: boolean                 // state.isSaving → 두 라디오 disabled (stale에서는 false — 다른 입력과 같다)
  onChange: (value: LlmModelKey) => void   // dispatch({ type: 'modelChanged', value }) (F-ST-22)
}
```

렌더(위에서 아래):

```
<fieldset class=root aria-describedby="settings-model-note">
  <legend class=legend>{labels.modelLegend}</legend>                         「AI 모델」
  LLM_MODEL_KEYS.map(key =>                                                  순서 pro → flash
    <label class={cx(option, isReadOnly && disabled)} key={key}>              행 전체가 클릭 영역
      <input type="radio" class=radio name="settings-model" value={key}
             checked={value === key} disabled={isReadOnly}
             aria-label={labels.modelOption[key].name}                     이름 = 「Pro」·「Flash」만
             aria-describedby={`settings-model-${key}-desc`}
             onChange={() => onChange(key)} />
      <span class=name aria-hidden="true">{labels.modelOption[key].name}</span>
      <span class=description id={`settings-model-${key}-desc`}>{labels.modelOption[key].description}</span>
    </label>)
  <p class=note id="settings-model-note">{value === null ? labels.modelNoteUnset : labels.modelNoteSelected}</p>
</fieldset>
```

- 라디오 이름은 `aria-label`로 고정한다. `<label>`이 설명까지 감싸므로 그대로 두면 설명 문장이 이름에 섞인다. 보이는 이름 `<span>`은 `aria-hidden`이다(이중 읽기 방지). 설명은 `aria-describedby`로 읽힌다.
- `checked`는 제어 값이다. `value === null`이면 둘 다 `false`. `onChange`는 그 라디오가 새로 선택될 때만 온다(같은 라디오 재클릭은 이벤트 없음).
- `name="settings-model"` 하나로 묶어 브라우저 기본 방향키 이동(↑↓←→, 이동 = 선택)을 쓴다. 키 처리 코드를 쓰지 않는다.
- id는 화면에 한 벌뿐이라 고정 문자열이다(탭 id `settings-tab-*` 관례와 같다).
- 문구는 모두 `labels.ts`(requirements.md §5.1). 모델명(`gemini-…`)·가격 숫자는 화면에 없다(R-SET-013 · R-LLM-009).

스타일(`ModelChoice.module.css`, Rosebell 토큰):

| 클래스 | 값 |
|---|---|
| `.root` | 브라우저 기본 fieldset 스타일 제거: `margin:0; min-width:0; border:0; padding:0 0 var(--space-4); border-bottom:1px solid var(--color-border); margin-bottom:var(--space-4)` |
| `.legend` | `padding:0; margin:0 0 var(--space-1); line-height:20px; font-family:var(--font-ui); font-size:var(--text-sm); color:var(--color-fg-muted)`(FormField 라벨과 같은 모양). 필수 표시 없음 |
| `.option` | `display:flex; align-items:center; gap:var(--space-2); min-height:44px; cursor:pointer`(터치 44 이상) |
| `.radio` | `width:20px; height:20px; margin:0; flex-shrink:0; accent-color:var(--color-primary)`. `:focus-visible { outline:2px solid var(--color-focus); outline-offset:2px }` |
| `.name` | `width:48px; flex-shrink:0; font-size:var(--text-base); color:var(--color-fg)` |
| `.description` | `min-width:0; flex:1; font-size:var(--text-sm); color:var(--color-fg-muted)` — 줄바꿈 허용(말줄임 없음) |
| `.disabled` | `cursor:default; opacity:0.5`(isReadOnly일 때 행 전체) |
| `.note` | `margin:var(--space-1) 0 0; line-height:20px; font-size:var(--text-sm); color:var(--color-fg-muted)` — 줄바꿈 허용 |

ReadyBody 연결(실물 §5.1 `ReadyBodyProps`에 추가):

```ts
onChangeModel: (value: LlmModelKey) => void   // index.tsx: value => dispatch({ type: 'modelChanged', value })
```
- FormPanel의 `Pick`에 `onChangeModel`을 더한다. `activeTab === 'world'`일 때 `<ModelChoice value={state.modelDraft} isReadOnly={state.isSaving} onChange={onChangeModel} />` 다음에 `<WorldForm …/>`(두 형제, 감싸는 원소는 기존 WorldForm 바깥 그대로). 캐릭터 탭에는 렌더하지 않는다.
- 파일 크기: ModelChoice 약 50줄, ReadyBody +6줄 안팎. 400줄·함수 50줄 한계 안.

---

## 4. 스타일 (CSS Modules · `ui_design_concept.md` 토큰)

| 요소 | 값 |
|---|---|
| 루트 | `--color-bg`, 높이 100% 체인(`100vh` 금지), 폭 100%, 콘텐츠 최대 480 중앙 |
| A | TopBar 44(공용) |
| B Tabs | 40, 아래 1px `--color-border` |
| C 폼 | `flex:1; min-height:0; overflow-y:auto`, 좌우 `--space-4`, 위아래 `--space-4`, 필드 사이 `--space-3`, 묶음 사이 `--space-5`, 소제목 xs `--color-fg-muted` uppercase 아님 |
| 2열 | `.pair { display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-3) }` |
| E | Toast(공용) — C 아래 in-flow, C를 줄인다 |
| F | 40 |
| D | 36 |
| 시트 | BottomSheet 공용 값. 버튼 줄 `display:flex; justify-content:space-between` |
| 가로 스크롤 | 금지. 긴 파일 이름·상태 문구 말줄임 |

390×565 세로 배분(구성안 §1-2 그대로):

| 상태 | A | B | C | E | F | D |
|---|---|---|---|---|---|---|
| ready | 44 | 40 | 445 | — | — | 36 |
| ready + 토스트 | 44 | 40 | 417 | 28 | — | 36 |
| stale | 44 | 40 | 405 | — | 40 | 36 |
| stale + 토스트 | 44 | 40 | 377 | 28 | 40 | 36 |
| loading · error | 44 | — | 521(StateView) | — | — | — |

### 4.1 「공통」 탭 C 안 세로 배분과 세계관 `maxRows` (v1.3 S3f)

**결론: `maxRows` 16 → 9 (TextArea 최대 196px).** 아래는 CSS 값으로 계산한 수치다. 화면 실측은 구현 뒤 TC-ST-053 스크린샷으로 확인한다(이 단계는 문서만 쓰므로 브라우저 측정을 하지 않았다).

입력값(실물 CSS): C 폼 영역 패딩 위아래 `--space-4` 16씩(`ReadyBody.module.css .panel`) · TextArea 높이 = `20 × 줄 + 16`(line-height 20, 패딩 8×2, `box-sizing: border-box`라 테두리는 높이 안, `TextArea.tsx fitHeight`) · FormField 라벨 줄 20 · 필드 안내 줄 = 위 4 + 약 16(xs 11px) = 20.

| 묶음 | 높이(px) |
|---|---|
| legend 20 + 아래 4 | 24 |
| 라디오 행 44 × 2 | 88 |
| 안내 줄 위 4 + 20 | 24 |
| fieldset 아래 패딩 16 + 구분선 1 + 아래 바깥 여백 16 | 33 |
| **ModelChoice 합계** | **169** |
| 세계관 라벨 줄 | 20 |
| 세계관 TextArea(9줄) | 196 |
| 필드 안내 줄(필수 빈 칸·상한 초과일 때만) | 20 |

| 판(C 높이 → 안쪽 = C − 32) | 쓸 수 있는 높이 | 사용(안내 줄 없음 / 있음) | 결과 |
|---|---|---|---|
| ready (445 → 413) | 413 | 385 / 405 | 둘 다 스크롤 없음(남는 28 / 8) |
| ready + 토스트 (417 → 385) | 385 | 385 / 405 | 안내 없음은 딱 맞음, 안내 있으면 20 스크롤 |
| stale (405 → 373) | 373 | 385 / 405 | 12 / 32 스크롤 |
| stale + 토스트 (377 → 345) | 345 | 385 / 405 | 40 / 60 스크롤 |

- 기준은 "ready 판에서 안내 줄까지 스크롤 없이 보인다"이다: `169 + 20 + (20N + 16) + 20 ≤ 413` → `N ≤ 9.4` → **9**. 10줄이면 안내 줄이 있을 때 12px 넘친다.
- 토스트·stale 판은 기존 캐릭터 탭처럼 C가 스크롤한다(`overflow-y:auto`). 맨 위로 스크롤한 상태에서 모델 묶음이 늘 먼저 보인다(F-ST-06 탭 전환 시 `scrollTop = 0`).
- 세계관이 9줄보다 길면 TextArea 안에서 스크롤한다(공용 동작). 높이 ≤ 480 화면에서는 공용 규칙대로 1줄 고정이다(바뀌지 않음).
- 문구 폭: 라디오 행 = 20 + 8 + 48 + 8 + 설명(Pro 약 180px) ≈ 264 ≤ 콘텐츠 폭 358(390 − 좌우 16×2). 미선택 안내 `아직 고르지 않았습니다. 지금은 서버 기본 모델을 씁니다.`는 한글 23자 × 12px + 공백·마침표 ≈ 310px로 한 줄이다. 글꼴 대체로 두 줄이 되면 +20px이고, ready 판 안내 줄 없음 기준 405 ≤ 413이라 여전히 스크롤 없다.

---

## 5. 구현 실물 동기화 (v1.2.1, 2026-10-06)

S3c 구현·테스트가 끝난 뒤 실물에 맞춘 절이다. 동작·문구는 v1.2와 같다. 아래와 위 절이 다르면 이 절이 실물이다.

### 5.1 파일 구성 (델타 A)

| 파일 | 실물 | 설계 v1.2 대비 |
|---|---|---|
| `ui/src/settings/index.tsx` | SettingsScreen + 지역 `SettingsTopBar`·`SettingsBody`·`createSheetResults`. 175줄(TSX 최대) | 조립만 하는 것은 같다 |
| `components/ReadyBody.tsx` | `ReadyBodyProps = { state: ReadyState; activeTab: SettingsTab; toast: ToastState; saveButtonRef: Ref<HTMLButtonElement>; onSelectTab; onChangeWorld(value); onChangeField(id, key, value); onRevert; onSave }`. 파생 값(S-09·11·12·14) `useMemo([state])`. 지역 FormPanel이 `useLayoutEffect([activeTab])`로 `scrollTop = 0`. 탭 DOM id 접두사 `'settings'`(Tabs의 `tabDomId`·`panelDomId` export) | 신규 분해. F-ST-06·08 위치 |
| `components/SheetLayer.tsx` | `SheetLayerProps = { sheet: SettingsSheet; state: ReadyState; onClose; onExport; onImport; onImported; onDownloadFailed; onConfirmLeave }`. ② 안내 `exportNoteOf(state)` = stale → `'stale'`, dirty → `'dirty'`, 그 밖 `null`. 여기 dirty는 본체 dirty(`isDraftDirty`)다 — **S3f 무수정**(모델만 바뀐 상태는 안내 없음, design.md D-ST-15) | 신규 분해 |
| `useSettingsUi.ts` | `useSettingsUi({ state, focusTargetRef, onLeave })` → `{ titleRef, saveButtonRef, fileMenuButtonRef, backButtonRef, activeTab, selectTab, sheet, openFileMenu, openExport, openImport, closeSheet, requestBack, confirmLeave }`. `SettingsSheet` 타입을 export. 내부 `useSaveFocus`(layout effect, 저장 뒤 포커스)·`useSheetFocusReturn`(시트 닫힘 2차 복귀) | 신규. 설계의 "SettingsScreen useState·useRef·layout effect"를 이 훅이 갖는다 |
| `useImportForm.ts` | `useImportForm({ base, onImported })` → `{ form: ImportForm, canSubmit, pickFile, changePaste, submit }`. 늦은 읽기 무시 = `isActiveRef`(마운트) + `inputIdRef`(입력이 바뀔 때마다 1 증가) | 신규. 설계의 ImportSheet `useState`·`readerActiveRef`를 대체 |
| `useSettingsEditor.ts` | 반환에 `loadSettings`·`focusTargetRef` 추가(functions.md §1) | 반환 2개 추가 |
| `download.ts` | `ui/src/settings/download.ts`(components/utils 아님) | 같음 |
| `ui/src/state/settingsCandidate.ts` | settingsFile.ts 400줄 한계로 분리. export `candidateOf(source, root): Candidate \| null`(SF-07·08·09, null = `noMatchingWorld`) · `rawPatchOf(candidate)`(S-15 입력) · `patchFromChecked(value, candidate)`(SF-10) · 타입 `Candidate`·`ImportSource`·`ImportApplied` · `isRecord`·`isStringArray`. `candidateFromSelf`·`pickEnosWorld`·`candidateFromEnosWorld`는 모듈 내부 | 신규. `Candidate`가 모듈 사이에서 쓰여 export된다. settingsFile.ts는 SF-01~06·`parseImportFile`만 두고 `ImportSource`·`ImportApplied`를 다시 export한다 |
| `ui/src/main.tsx` | 수정 없음 | 같음 |
| 크기 | TSX 최대 175줄, TS 최대 373줄 | 400줄 한계 안 |

### 5.2 Props·렌더 실물 차이

| 항목 | 실물 | 판정 |
|---|---|---|
| FormField | `requiredMark` prop이 없다. `*`는 `labels.requiredMark`를 직접 읽는다. `counter?: string \| undefined` | §3.3 props와 일치. 필수 글자 출처만 명시 |
| 목록 필드 입력 이름 | `ariaLabel = spec.label`만(`샘플 대사`·`규칙·금기`). 보이는 라벨은 `spec.label + ' ' + listHint(maxItems)`. 목록 필드는 필수가 아니다 | 확정(가정 ④) |
| 최소 줄 CSS 클래스 | `.rows2`(성격 태그)·`.rows3`(그 밖 TextArea, 목록 포함) | §3.4의 `.minRows2`·`.minRows3` 표기를 실물 이름으로 읽는다 |
| ExportSheet | `export type ExportNote = 'dirty' \| 'stale' \| null`. 초기 포커스 = BottomSheet `initialFocusRef={areaRef}` | §3.8과 같은 동작 |
| ImportSheet 오류 줄 | `<p role="alert">` 안에 `<span aria-hidden="true">! </span>` + 문구. 읽히는 이름에 `!`가 없다 | §3.9와 같은 동작 |
| 시트 스타일 | ②③ 공용 `components/Sheets.module.css` | — |

### 5.3 시나리오 가정 확정 (델타 B — scenarios.md Q1~Q7, 스펙 그대로)

| # | 확정 내용 | 반영 위치 |
|---|---|---|
| ① | 단위 스펙 위치 = `ui/src/settings/test/state/settings.test.ts`·`settingsFile.test.ts` | state.md 머리말 |
| ② | 모킹 = `vi.mock('@/api/settings')` | design.md §7 |
| ③ | labels export 형태 = `labels` 객체 하나. 문구 함수(`fieldIssueText`·`statusText`·`importFailureText`·`importSummary`·`importNothing`·`authText`·`saveErrorText`·`loadErrorDetail`)도 그 멤버로 부른다 | requirements.md §5.2·§5.3·§5.5 · functions.md §1 |
| ④ | 목록 필드 접근성 이름 = `샘플 대사`·`규칙·금기`(힌트 없음) | §5.2 · a11y.md §1 · requirements.md §5.1 |
| ⑤ | ① 「가져오기」 비활성 = `button[disabled]`(공용 SheetItem `isDisabled`) | a11y.md §1 |
| ⑥ | R-SET-010 TC = settings·rooms RTM 합집합(TC-ST-017·019 · TC-RM-033·034·035·037·038) | design.md §14 |
| ⑦ | 가져오기 요약 범위 구분자 `·` 앞뒤 공백 없음(예 `공통 1·세바스찬 8·시엘 8`) | requirements.md §5.6 |

### 5.4 실측 (델타 C — TC-ST-037, 캡처 `doc/300_검증/screenshots/20261006-2033/`)

| 항목 | 설계 | 실측 | 판정 |
|---|---|---|---|
| ② 내보내기 시트 | 약 280px | 약 268px | 허용. 내용 기반 높이(최대 70% 안), 기능 영향 없음 |
| ③ 가져오기 시트 | 약 324px(오류 줄 360) | 약 262px(오류 줄 없음) | 허용. 공용 TextArea는 줄 수 기반 자동 높이라 빈 붙여넣기 칸이 설계 추정보다 낮다 |
| 설정 화면 세로 | 565(뷰포트) | body scrollHeight 568 | 관찰로 기록. 육안 영향 없음. 가로 스크롤 없음(scrollWidth 390). 원인 미확인이라 CR 후보로 올리지 않는다 |
| rooms ⚙ | 44×44 | 44×44 | 일치 |
| stale·loading·error 캡처 | TC-ST-037 대상 | 미실행 | 수동 대기(result.md) |
