# chat 상세 설계 — S4 장기기억 시트 (분할 문서, v2.1)

> 주 문서: `ui/src/chat/design.md`(RTM은 `design/rtm.md`). 40KB 한계 때문에 S4 델타 본문은 이 파일 하나에 모은다. 다른 분할 문서에는 이 파일을 가리키는 짧은 줄만 둔다. 절 표기 `ME` = 이 파일.
> 요구: **R-CHAT-012 🔒**(장기기억 시트: `summary` 보기·편집(0~4000자)·저장, ⋯ 메뉴 진입) · R-CHAT-001 🔒(⋯ 메뉴 항목 순서: 이름 변경 · 장기기억 · 방 삭제) · R-CHAT-008 · R-CHAT-013 🔒(토큰 없으면 미렌더 · 접근성 레이블 · 390px) · R-CHAT-011(오류 안내) · 데이터 R-MEM-001 🔒 · R-NFR-004 🔒(토큰 미저장). 요구 원문 `ui/src/chat/requirements.md` **v2.1**.
> 계약: `doc/200_설계/contract/api.md` **v0.7** §4.17(E13 GET) · §4.18(E14 PUT) · §5.9 `MemoryResponse`·`PutMemoryBody` · §11.16 래퍼 `getMemory`·`putMemory`(`ui/src/api/memory.ts`) · §6.1 S4 행 · 「ui 인계 메모」 S4 — **인용만 한다(재정의 금지)**. server 쪽 근거는 `doc/200_설계/server/memory.md` 「ui 인계 메모」.
> 구성안: `.claude/skills/layout-templates/SKILL.md` **M1 메모리 편집**을 메인 세션 사전 확정 1~7로 좁혀 수용한다. M1의 "전체 화면 뷰"는 사전 확정 2에 따라 **바텀시트**로 그리고, M1의 "출처(자동/수동)" 메타는 계약에 필드가 없어 두지 않는다(D-40).
> 구현 선행 조건: contract S4 구현(`shared/src/types.ts` `MemoryResponse`·`PutMemoryBody` · `ui/src/api/memory.ts` · `ui/src/api/index.ts` 재노출)이 먼저 끝나야 한다. 2026-10-07 기준 `ui/src/api/memory.ts`는 **아직 없다**.

비유: 장기기억은 일기장 맨 앞에 끼워 둔 "지난 줄거리" 쪽지다. 시트를 열 때마다 쪽지를 새로 꺼내 읽고(서기가 방금 고쳐 썼을 수 있다), 고친 뒤 「저장」을 누르면 쪽지 전체를 새 글로 바꾼다. 고친 것을 저장하지 않고 덮으려 하면 "버릴까요?"를 한 번 묻는다.

---

## 0. 레이아웃 [확정 — 사전 확정 1·2 · M1 수용]

390px 기준 48칸. 공용 BottomSheet 패널(최대 높이 70% = 약 395px, 넘치면 패널 안 스크롤) 안이다. `[ ]`는 버튼 경계 표시다.

⋯ 방 메뉴(약 228px, 항목 4개):

```
+----------------------------------------------+
| 방 메뉴 · 티타임                             |  머리 40px
| 이름 변경                                    |
| 장기기억                                     |  (S4) 이름 변경과 방 삭제 사이
| 방 삭제                                      |  danger
| 취소                                         |
+----------------------------------------------+
```

장기기억 시트 · 준비됨(약 388px ±16px):

```
+----------------------------------------------+
| 장기기억                              [닫기] |  머리 40px. 제목 h2 + 닫기(sm ghost)
| AI가 긴 대화를 요약해 기억합니다.            |  안내(--text-sm, fg-muted, 1~2줄)
| 직접 고칠 수 있어요.                         |
| 마지막 갱신 10.07 16:30                      |  updatedAt === null 이면 줄 없음
| +------------------------------------------+ |
| | 시엘은 체스 시합에서 세바스찬에게 졌고,  | |  TextArea maxRows 7(최대 156px)
| | 다음 주 런던 출장을 약속받았다.          | |  넘치면 내부 스크롤
| |                                          | |
| +------------------------------------------+ |
|                                     812/4000 |  카운터(TextArea 내장, always)
| 4000자 이하로 줄여 주세요.                   |  초과일 때만. 저장 실패면 실패 문구 줄
| [ 취소 ]                            [ 저장 ] |  lg. 취소 secondary 왼쪽 · 저장 primary 오른쪽
+----------------------------------------------+
```

변형:

| 변형 | 본문 자리(안내 줄 아래) | 하단 버튼 |
|---|---|---|
| 조회 중 | StateView loading `장기기억을 불러오는 중` | 취소 활성 · 저장 비활성 |
| 조회 실패 | StateView error `장기기억을 불러오지 못했습니다` + 상세(ME §7) + 「다시 시도」 | 취소 활성 · 저장 비활성 |
| 빈 요약 | TextArea 값 `''` + placeholder `아직 요약이 없습니다` · 갱신 줄 없음(`updatedAt` null일 때) · 카운터 `0/4000` | 저장 비활성(변경 없음) |
| 저장 중 | TextArea readOnly · 닫기·취소·저장 비활성 · Esc·덮개로 안 닫힘 | 전부 비활성 |
| 저장 실패 | 입력 유지 · 카운터 아래 `role=alert` 실패 문구 한 줄 | 다시 활성 |
| 버림 확인 | 시트 자리에 ConfirmDialog(약 148px): `고친 내용을 버릴까요?` / `저장하지 않은 내용은 사라집니다.` / [ 계속 고치기 ] [ 버리기 ] | — |

| 조각 | 상태 |
|---|---|
| 방 메뉴 항목 순서 | **확정**(R-CHAT-001 🔒) |
| 시트 구성·순서(머리·안내·갱신·입력·카운터·문구·버튼) | **확정**(사전 확정 2) |
| 시트 높이 | **확정** 근삿값: 패딩 16 + 머리 40 + 안내 40 + 갱신 20 + 입력 156 + 카운터 20 + 문구 20 + 버튼 60 + 패딩 16 = 388px ≤ 395px. 기준은 실측(±16px). 높이 ≤ 480 화면은 TextArea가 1줄로 고정된다(공용 규칙) |
| 갱신 시각 형식 | **확정** `MM.DD HH:mm`(방 생성일 `MM.DD`와 같은 계열) |

---

## 1. 컴포넌트

### 1.1 배치 3단계 분류

| 컴포넌트·모듈 | 위치 | 분류 | 근거 |
|---|---|---|---|
| `BottomSheet`·`Button`·`TextArea`·`StateView`·`ConfirmDialog`·`SheetItem`·`Toast` | `ui/src/components/ui/` | ① 공용 ui 재사용 | rooms components.md §1. **변경 없음** |
| `formatMonthDay`·`formatTime`·`toIsoDateTime` | `ui/src/components/utils/formatDate.ts` | ③ 공용 유틸 재사용 | 실재 export 확인 |
| `countChars`(`@/state/limits` = `countCodePoints(normalizeText(v))`) · `MEMORY_SUMMARY_MAX`·`normalizeText`(`@shared/limits`) | 공용 | 재사용 | api.md §5.7 · 「ui 인계 메모」 S4 길이 |
| **`MemorySheet`**(컨테이너) · **`MemoryEditor`**(시트 본체) | `ui/src/chat/components/MemorySheet.tsx` | ④ chat 로컬 신규 | 방·장기기억 의미를 안다. 공용만 조립 |
| **`useMemorySheet`** | `ui/src/chat/useMemorySheet.ts` | 화면 로컬 훅 신규 | 조회·초안·저장·버림 확인(D-33) |
| **`memory.ts`**(순수 판정 4개) | `ui/src/state/memory.ts` | 상태(순수) 신규 | `chat.ts`·`settings.ts` 선례. React·DOM 의존 없음 |

- settings 화면의 `FormField`(라벨·카운터·안내 줄)는 재사용하지 않는다. settings 로컬이고 라벨 줄이 필요 없다. 카운터는 공용 TextArea 내장(`counterMode='always'`)을 쓴다 — settings WorldForm·CharacterForm과 같은 방식(D-35).
- 표준 HTML 원소: `<h2>`·`<p>`·`<time>`·`<div>`만 쓴다(시맨틱 컨테이너). `<button>`·`<textarea>`는 공용 안에만 있다.

### 1.2 `MemorySheet` (컨테이너, named export)

```ts
export type MemorySheetProps = {
  roomId: string
  /** 변경 없이 닫기 · 버리기 확정 → 시트 닫기 */
  onClose: () => void
  /** 저장 성공 → 시트 닫기 + 성공 토스트(F-CH-60) */
  onSaved: () => void
  /** 인증 3종 · NOT_FOUND → 시트 닫고 화면 공통 처리(F-CH-60) */
  onLeave: (error: ApiError) => void
}
export const MemorySheet = (props: MemorySheetProps) => {
  const memory = useMemorySheet(props)                         // F-CH-55
  return memory.isAskingDiscard
    ? <ConfirmDialog title={labels.memoryDiscardTitle} message={labels.memoryDiscardBody}
        confirmLabel={labels.memoryDiscardConfirm} cancelLabel={labels.memoryKeepEditing}
        onConfirm={memory.confirmDiscard} onCancel={memory.keepEditing} />
    : <MemoryEditor memory={memory} />
}
```

- 컨테이너가 계속 마운트되어 있으므로 버림 확인으로 바꿔 그려도 초안·조회 결과가 남는다(D-34). 조회는 컨테이너 마운트 때 1회다(시트를 열 때마다 새로 마운트 = 매번 재조회).

### 1.3 `MemoryEditor` (같은 파일 지역 컴포넌트)

```ts
type MemoryEditorProps = { memory: UseMemorySheetResult }
```

**DOM.**

```
<BottomSheet ariaLabel={labels.memory} onClose={memory.requestClose}
             isDismissDisabled={memory.isSaving} initialFocusRef={textareaRef}
             header={<div className={styles.memoryHeader}>
                       <h2 className={styles.memoryTitle}>{labels.memory}</h2>
                       <Button size="sm" variant="ghost" isDisabled={memory.isSaving}
                               onClick={memory.requestClose}>{labels.memoryClose}</Button>
                     </div>}>
  <p className={styles.memoryNote}>{labels.memoryGuide}</p>
  {body}                                   // 아래 표
  <div className={styles.memoryActions}>
    <Button size="lg" variant="secondary" isDisabled={memory.isSaving} onClick={memory.requestClose}>{labels.cancel}</Button>
    <Button size="lg" variant="primary" isDisabled={!memory.canSave} onClick={memory.save}
            ariaDescribedBy={memory.isOver ? overNoteId : undefined}>{labels.save}</Button>
  </div>
</BottomSheet>
```

| `memory.load.phase` | `body` |
|---|---|
| `'error'`(판정 1순위 — v2.1.2, tsx-rules error → loading → data) | `<StateView kind="error" message={labels.memoryLoadError} detail={writeErrorText(load.error, 'memory')} actionLabel={labels.retry} onAction={memory.retryLoad} />` |
| `'loading'` | `<StateView kind="loading" message={labels.memoryLoading} />` |
| `'ready'` | `MemoryReadyBody` — ① `t = load.base.updatedAt`가 `null`이 아니면 `<p className={styles.memoryMeta}>{labels.memoryUpdatedAtPrefix} <time dateTime={toIsoDateTime(t)}>{formatMonthDay(t)} {formatTime(t)}</time></p>` ② `<TextArea value={memory.draft} onChange={memory.setDraft} ariaLabel={labels.memoryInputAriaLabel} placeholder={labels.memoryPlaceholder} maxRows={MEMORY_MAX_ROWS} maxChars={MEMORY_SUMMARY_MAX} counterMode="always" textareaRef={textareaRef} isReadOnly={memory.isSaving} />` ③ `memory.isOver`이면 `<p id={overNoteId} className={styles.memoryOver}>{labels.memoryOverNote}</p>` ④ `memory.saveError !== null`이면 `<p className={styles.memoryError} role="alert">{memory.saveError}</p>` |

- `MEMORY_MAX_ROWS = 7`(파일 지역 상수). `overNoteId = useId()`.
- 갱신 줄은 앞말 키 `memoryUpdatedAtPrefix`(`마지막 갱신`) + 공백 + `<time>`으로 조립한다. 시각 글자는 공용 `formatMonthDay`·`formatTime` 결과(`MM.DD HH:mm`)다.
- TextArea에 `onEnter`·`onEscape`를 넘기지 않는다: Enter = 줄바꿈, Esc는 BottomSheet로 올라가 `requestClose`가 된다.
- 지역 훅 `useFocusWhenReady(phase, textareaRef)`(F-CH-62).
- (v2.1.2 실물) 파일 202줄. 지역 부품 `MemoryHeader`(머리 줄) · `UpdatedAtLine`(갱신 줄) · `MemoryBody`(위 표의 분기) · `MemoryReadyBody`(준비됨 ①~④) · `MemoryActions`(버튼 줄)로 나눴다. DOM은 위 설계와 같다. 스타일은 `MenuSheets.module.css`의 `memory*` 클래스다(별도 모듈 파일 없음).

**스타일(`MenuSheets.module.css`에 추가, 토큰만).**

| 선택자 | 규칙 |
|---|---|
| `.memoryHeader` | `display: flex; align-items: center; justify-content: space-between; width: 100%` |
| `.memoryTitle` | `margin: 0; color: var(--color-fg); font: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap` |
| `.memoryNote` · `.memoryMeta` | `margin: 0 0 var(--space-2); color: var(--color-fg-muted); font-family: var(--font-ui); font-size: var(--text-sm)` |
| `.memoryOver` · `.memoryError` | `margin: var(--space-2) 0 0; color: var(--color-danger); font-family: var(--font-ui); font-size: var(--text-sm); overflow-wrap: anywhere` |
| `.memoryActions` | `display: flex; justify-content: space-between; gap: var(--space-2); margin-top: var(--space-4)` |

- settings `Sheets.module.css`의 `.title`·`.note`·`.error`·`.actions`와 같은 값이다. 화면 간 CSS import는 하지 않는다(공용화 후보, ME §10).

### 1.4 `RoomMenuSheet` 델타

```ts
export type RoomMenuSheetProps = {
  roomTitle: string
  onRename: () => void
  onMemory: () => void        // (S4) 추가 — F-CH-53
  onDelete: () => void
  onClose: () => void
}
```

- 항목 순서: `SheetItem label={labels.rename}` → **`SheetItem label={labels.memory} onSelect={onMemory}`** → `SheetItem label={labels.deleteRoom} tone="danger"` → `SheetItem label={labels.cancel}`. 머리 주석의 "S4 에서 … 렌더하지 않는다" 줄을 지운다.

### 1.5 `ChatSheets` 델타

| 위치 | 변경 |
|---|---|
| `ChatSheet` | **추가** `| { kind: 'memory' }` |
| `ChatSheetsProps` | **추가** `onAskMemory: () => void` · `onMemorySaved: () => void` · `onMemoryLeave: (error: ApiError) => void` |
| `renderRoomSheet` | `roomMenu` → `RoomMenuSheet onMemory={props.onAskMemory}` 추가 |
| `ChatSheets` 본체 | `sheet.kind === 'memory'`면 `<MemorySheet roomId={props.room.id} onClose={props.onClose} onSaved={props.onMemorySaved} onLeave={props.onMemoryLeave} />` |
| 머리 주석 | 시트 목록에 "장기기억(S4)" |

### 1.6 `index.tsx` `SheetLayer` 델타

`onAskMemory={sheets.openMemory}` · `onMemorySaved={sheets.memorySaved}` · `onMemoryLeave={sheets.memoryLeft}`를 넘긴다. `viewer.canWrite && <SheetLayer/>` 조건은 그대로다(ME §9).

---

## 2. 상태

**채팅 리듀서(`ChatState`·`chatReducer`·`initialChatState`)는 바꾸지 않는다**(D-33). 장기기억 상태는 시트가 열려 있는 동안만 사는 시트 지역 상태다.

| 상태 | 용도 | 타입 | 초기값 | 소유 |
|---|---|---|---|---|
| `sheet` | 열린 시트 | `ChatSheet \| null`(+ `{ kind: 'memory' }`) | `null` | `useChatSheets` `useState`(기존) |
| `load` | 조회 단계 | `MemoryLoad`(아래) | `{ phase: 'loading' }` | `useMemorySheet` `useState` |
| `draft` | 입력 초안 | `string` | `''`. 조회 성공 시 `base.summary` | `useMemorySheet` `useState` |
| `isSaving` | 저장 요청 중(렌더용) | `boolean` | `false` | `useMemorySheet` `useState` |
| `savingRef` | 같은 틱 중복 제출 방지 | `MutableRefObject<boolean>` | `false` | `useMemorySheet` `useRef` |
| `saveError` | 저장 실패 문구(시트 안 `role=alert`) | `string \| null` | `null` | `useMemorySheet` `useState` |
| `isAskingDiscard` | 버림 확인 표시 중 | `boolean` | `false` | `useMemorySheet` `useState` |
| `attempt` (v2.1.2) | 조회 시도 횟수 — 조회 effect의 의존값. 「다시 시도」가 1 올린다 | `number` | `0` | `useMemorySheet` 지역 `useMemoryLoad` `useState` |
| `aliveRef` · `latestRef` | 언마운트 뒤 응답 무시 · 진행 중 요청이 최신 콜백(`onClose`·`onSaved`·`onLeave`)을 부르게 | `MutableRefObject<boolean>` · `MutableRefObject<MemorySheetProps>` | `false`(마운트 `useLayoutEffect` `true`, cleanup `false`) · props(매 렌더 `useLayoutEffect` 갱신) | 지역 훅 **`useLifecycle(props): Lifecycle`**이 소유하고, 하위 훅에는 ref 대신 함수 **`Lifecycle = { isAlive: () => boolean; latest: () => MemorySheetProps }`**(`useCallback` 참조 안정)를 넘긴다(v2.1.2, useRoomActions 선례) |

```ts
// ui/src/state/memory.ts (순수)
export type MemoryLoad =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly error: ApiError }
  | { readonly phase: 'ready'; readonly base: MemoryResponse }
export const MEMORY_SUMMARY_MAX_CHARS = MEMORY_SUMMARY_MAX           // @shared/limits 재노출
export const isMemoryOver = (draft: string): boolean => countChars(draft) > MEMORY_SUMMARY_MAX
export const isMemoryDirty = (load: MemoryLoad, draft: string): boolean =>
  load.phase === 'ready' && normalizeText(draft) !== load.base.summary
export const canSaveMemory = (load: MemoryLoad, draft: string, isSaving: boolean): boolean =>
  load.phase === 'ready' && !isSaving && isMemoryDirty(load, draft) && !isMemoryOver(draft)
```

- `base.summary`는 서버가 trim한 값이다(api.md §4.17·§5.9.1). 그래서 "앞뒤 공백만 덧붙임"은 변경이 아니다(settings TC-ST-010 규칙과 같다).
- 토큰은 이 상태 어디에도 없다. 래퍼가 `getToken()`으로 헤더를 붙인다(R-CHAT-009 · R-NFR-004).

`UseMemorySheetResult`:

```ts
export type UseMemorySheetResult = {
  load: MemoryLoad
  draft: string
  setDraft: (value: string) => void
  isSaving: boolean
  isOver: boolean            // isMemoryOver(draft)
  canSave: boolean           // canSaveMemory(load, draft, isSaving)
  saveError: string | null
  isAskingDiscard: boolean
  retryLoad: () => void
  save: () => void
  requestClose: () => void
  keepEditing: () => void
  confirmDiscard: () => void
}
```

---

## 3. 기능 명세 (function 단위)

| # | 시그니처(위치) | 입력 | 출력·상태 변경 | 동작 | 예외·분기 | 요구ID |
|---|---|---|---|---|---|---|
| **F-CH-53** | `openMemory(): void` (`useChatSheets` 지역 `useRoomMenuHandlers`) | 방 메뉴 「장기기억」 | `sheet = { kind: 'memory' }` | `getState().writing !== null \|\| isRoomBusy()`면 무시(F-CH-24와 같은 가드) → `setSheet({ kind: 'memory' })`. 방 메뉴는 같은 커밋에서 언마운트된다 | 방 메뉴가 열려 있으면 정상 경로에서는 가드에 걸리지 않는다 | R-CHAT-001 🔒 · 012 🔒 |
| **F-CH-54** | `MemorySheet(props: MemorySheetProps): JSX.Element` (`components/MemorySheet.tsx`) | ME §1.2 | 시트 | `isAskingDiscard`면 ConfirmDialog, 아니면 MemoryEditor | — | R-CHAT-012 🔒 |
| **F-CH-55** | `useMemorySheet(props: MemorySheetProps): UseMemorySheetResult` (`useMemorySheet.ts`) | props | ME §2 | (v2.1.2 실물) 지역 훅 4개로 조립한다: `useLifecycle(props)`(ME §2) · `useMemoryLoad(roomId, setDraft, life)`(F-CH-56) · `useMemorySave({ roomId, load, draft, life })`(F-CH-57) · `useMemoryClose({ load, draft, isSaving, life })`(F-CH-58·59). `draft`는 본체 `useState('')`. 반환 값은 ME §2 | 각 훅 50줄 안 | R-CHAT-012 🔒 · R-MEM-001 🔒 |
| **F-CH-56** | (v2.1.2 실물) `useMemoryLoad(roomId, setDraft, life): { load, retryLoad }` (`useMemorySheet` 지역 훅) | 마운트 · 「다시 시도」 | `load` · `draft` | `useLayoutEffect([roomId, attempt, setDraft, isAlive, latest])` 안에서 `void getMemory(roomId).then(r => …)` — **effect 본문에서 setState를 동기로 부르지 않고 `then` 콜백에서만 부른다**(lint `set-state-in-effect`). `retryLoad = () => { setLoad({ phase: 'loading' }); setAttempt(n => n + 1) }` → effect 재실행. 콜백: `!isAlive()`면 종료 → `r.ok`: `setLoad({ phase: 'ready', base: r.value })` · `setDraft(r.value.summary)` / 실패: `isAuthFailure(r.error) \|\| r.error.code === 'NOT_FOUND'`면 `latest().onLeave(r.error)`, 아니면 `setLoad({ phase: 'error', error: r.error })` | 캐시 없음(「ui 인계 메모」 S4 "열 때마다"). 레이트리밋 없음(api.md §6.1) | R-CHAT-012 🔒 · 011 · R-MEM-001 🔒 |
| **F-CH-57** | `save(): void` → 내부 `saveMemory(): Promise<void>` | 「저장」 | `isSaving` · `saveError` | `!canSaveMemory(load, draft, isSaving) \|\| savingRef.current`면 무시 → `savingRef = true` · `setIsSaving(true)` · `setSaveError(null)` → `const r = await putMemory(roomId, { summary: draft })`(**원문 그대로 — 화면은 trim하지 않는다**, 주 문서 §7 규칙) → `!isAlive()`면 종료 → `savingRef = false` · `setIsSaving(false)` → `r.ok`: `latest().onSaved()` / 실패: 인증 3종·`NOT_FOUND`면 `onLeave(r.error)`, 아니면 `setSaveError(writeErrorText(r.error, 'memory'))` | 실패해도 `draft` 불변(입력 보존). 성공 응답 `summary`로 입력을 다시 맞추는 일은 시트가 닫혀 생략된다(D-36) | R-CHAT-012 🔒 · 011 · R-MEM-001 🔒 |
| **F-CH-58** | `requestClose(): void` | 닫기 · 취소 · Esc · 덮개 | `isAskingDiscard` 또는 닫기 | `isSaving`이면 무시 → `isMemoryDirty(load, draft)`면 `setIsAskingDiscard(true)`, 아니면 `latestRef.current.onClose()` | 조회 중·실패 상태는 변경이 없어 바로 닫힌다 | R-CHAT-012 🔒 |
| **F-CH-59** | `keepEditing(): void` · `confirmDiscard(): void` | 버림 확인 버튼 | `isAskingDiscard` · 닫기 | `keepEditing`: `setIsAskingDiscard(false)` → MemoryEditor 재마운트, BottomSheet `initialFocusRef`가 TextArea로 포커스(초안 유지). `confirmDiscard`: `latestRef.current.onClose()`(putMemory 0회) | ConfirmDialog Esc·덮개 = `keepEditing`(onCancel) | R-CHAT-012 🔒 |
| **F-CH-60** | `memorySaved(): void` · `memoryLeft(error: ApiError): void` (`useChatSheets`) | 시트 콜백 | `sheet = null` · 토스트 · 전환 · 목록 복귀 | `memorySaved`: `setSheet(null)` → `showNotice(labels.memorySaved, 'success')`. `memoryLeft`: `setSheet(null)` → `error.code === 'NOT_FOUND'`면 `onRoomGone()`(F-CH-33 — `clearLastRoomId` → `onBack`, 토스트 없음), 아니면 `handleWriteFailure(error, 'memory')`(F-CH-16 — 인증 3종 전환 + 전환 문구 토스트) | 시트를 먼저 닫으므로 토스트가 덮개 아래에 숨지 않는다(D-37) | R-CHAT-012 🔒 · 011 · 008 |
| **F-CH-61** | `isMemoryOver` · `isMemoryDirty` · `canSaveMemory` (`state/memory.ts`, 순수) | ME §2 | boolean | ME §2 코드 | `countChars`는 trim 후 코드 포인트(이모지 1자) | R-CHAT-012 🔒 · R-MEM-001 🔒 |
| **F-CH-62** | `useFocusWhenReady(phase, textareaRef)` (`MemoryEditor` 지역 훅, `useLayoutEffect([phase])`) | `load.phase` | 포커스 | `phase`가 `'ready'`로 바뀐 렌더(이전 값 ref와 비교)에서 `textareaRef.current?.focus()` → `setSelectionRange(0, 0)` → `scrollTop = 0`(요약 첫머리를 보인다) | 마운트 때 이미 `'ready'`면(버림 확인에서 돌아옴) BottomSheet `initialFocusRef`가 맡으므로 하지 않는다 | R-CHAT-013 🔒 |
| F-CH-16 (확장) | `useWriteFailure` 반환에 **`showNotice: (message: string, tone: ToastTone) => void`**(= 내부 `showToast`) 추가 | — | 토스트 | 실패가 아닌 안내(저장 성공)를 같은 E 알림 줄로 띄운다 | `handleWriteFailure` 동작 불변 | R-CHAT-012 🔒 |
| 배선 | `useChatSheets` 옵션 추가 `onRoomGone: () => void` · `showNotice` / 반환 추가 `openMemory` · `memorySaved` · `memoryLeft` | — | — | `useChatWrites`가 이미 가진 `onRoomGone`·`useWriteFailure().showNotice`를 넘긴다 | — | — |
| labels | `WriteAction`에 **`'memory'`** 추가 · `validationText('memory')` = `` `장기기억은 0~${MEMORY_SUMMARY_MAX}자로 입력해 주세요.` `` | — | — | ME §6 | `NOT_FOUND`+`'memory'`는 방 문구(`notFoundText` 기본 분기) | R-CHAT-011 |

---

## 4. 파이프라인

```
⋯ → 방 메뉴(이름 변경 · 장기기억 · 방 삭제 · 취소)
 └ 장기기억 → openMemory → 방 메뉴 닫힘 · MemorySheet 마운트 → getMemory(room.id)  [토큰 헤더: 래퍼]
     ├ 대기 → "장기기억을 불러오는 중"(role=status) · 저장 비활성 · 포커스 = 닫기
     ├ 200 → 갱신 줄(updatedAt 있을 때) · TextArea = summary(빈 값이면 placeholder) · 카운터 n/4000 · TextArea 포커스(첫머리)
     ├ 인증 3종 → 시트 닫힘 → handleWriteFailure(전환 · ⋯·C·버튼 줄 미렌더 · D · 전환 토스트 · ‹ 포커스)
     ├ 404 → 시트 닫힘 → clearLastRoomId → onBack(목록, 지운 방 없음)
     └ 그 밖(NETWORK · INTERNAL · CONFIG_INVALID) → 시트 안 오류 + 「다시 시도」 → 다시 getMemory
편집 → 카운터 갱신(trim 후 코드 포인트)
 ├ 4001자 이상 → 카운터 over · aria-invalid · "4000자 이하로 줄여 주세요." · 저장 비활성
 └ 변경 없음(trim 기준) → 저장 비활성
저장 → putMemory(room.id, { summary: 초안 원문 }) · 입력 readOnly · 닫기·취소·저장 비활성 · Esc·덮개 무시
 ├ 200 → 시트 닫힘 → ⋯ 포커스 → 토스트 "장기기억을 저장했습니다"(success, 2초)
 ├ 인증 3종 → 시트 닫힘 → 전환(위와 같음)
 ├ 404 → 시트 닫힘 → 목록 복귀
 └ 그 밖(RATE_LIMITED · VALIDATION_ERROR · NETWORK · INTERNAL) → 시트 유지 · 입력 유지 · 시트 안 role=alert 문구 · 버튼 다시 활성
닫기 · 취소 · Esc · 덮개
 ├ 변경 없음(조회 중·실패 포함) → 시트 닫힘 → ⋯ 포커스 (confirm 없음)
 └ 변경 있음 → "고친 내용을 버릴까요?"(alertdialog, 첫 포커스 「계속 고치기」)
     ├ 계속 고치기 · Esc · 덮개 → 편집 시트 복귀(초안 유지, TextArea 포커스)
     └ 버리기 → 시트 닫힘 → ⋯ 포커스 · putMemory 0회
```

- 낙관적 갱신 없음. 저장은 마지막 저장이 남는다(api.md §4.18 경합 표, `409` 없음). 시트에 경합 안내 문구를 두지 않고 매뉴얼에만 적는다(D-38).
- 파괴 조작 confirm: "고친 내용 버리기"만 confirm(스킬 §11 — 저장하지 않은 입력 손실). 요약 비우기(0자 저장)는 사용자가 지우고 「저장」을 눌러야 일어나는 명시 동작이라 confirm하지 않는다(D-39).

---

## 5. contract 계약 사용표 (api.md v0.7 인용)

| 엔드포인트 | 요청 | 응답 타입(`shared/src/types.ts`) | 래퍼(`@/api`) | 호출 위치 | 토큰 | 실패 표시 |
|---|---|---|---|---|---|---|
| `GET /api/rooms/:id/memory` (§4.17, E13) | 없음 | `200` `MemoryResponse = { summary: string; sourceUntilId: number; updatedAt: number \| null }`. 행 없음 = `{ '', 0, null }` | `getMemory(roomId: string): Promise<Result<MemoryResponse>>` | F-CH-56 | ○(읽기지만 필요) | 인증 3종 = 전환 · `NOT_FOUND` = 목록 복귀 · 그 밖 = 시트 안 StateView error |
| `PUT /api/rooms/:id/memory` (§4.18, E14) | `PutMemoryBody = { summary: string }`(원문, trim 안 함) | `200` `MemoryResponse`(`summary` = trim된 저장값, `sourceUntilId` 유지) | `putMemory(roomId: string, body: PutMemoryBody): Promise<Result<MemoryResponse>>` | F-CH-57 | ○ | 인증 3종 = 전환 · `NOT_FOUND` = 목록 복귀 · 그 밖 = 시트 안 `role=alert`(ME §7) |

- `sourceUntilId`는 표시하지 않는다(「ui 인계 메모」 S4 표시 필드). `updatedAt`은 갱신 줄로 표시한다(사전 확정 2).
- 「ui 인계 메모」 S4 "성공하면 응답 `summary`로 입력을 다시 맞춘다"는 **구현하지 않는다**. 저장에 성공하면 시트가 닫혀 맞출 입력이 없다(D-36). 다음에 열면 다시 조회한다.
- 저장 성공 토스트는 공용 Toast `success` 톤이다. 공용 Toast 머리 주석의 "success는 settings 전용" 문구는 chat도 쓴다는 내용으로 고쳤다(v2.1.2, 동작 변경 없음).
- 화면이 4000자 초과를 먼저 막으므로 길이 `VALIDATION_ERROR`는 정상 경로에서 나오지 않는다. 와도 ME §7 문구를 쓴다.
- 「ui 인계 메모」 S4 "400은 서버 `message`를 그대로"는 **문장이 같은 labels 문구로 대신한다**(주 문서 §8 "서버 `error.message`는 표시하지 않는다" 규칙 유지 — 길이 위반 문장 `장기기억은 0~4000자로 입력해 주세요.`는 서버와 글자까지 같다).
- 테스트는 `vi.mock('@/api')`(또는 `@/api/memory`)로 `getMemory`·`putMemory`를 모킹한다. `fetch`를 모킹하지 않는다.
- 미확정 계약 없음. contract 구현 대기(머리 "구현 선행 조건").

---

## 6. 확정 문구 · 라벨 (`ui/src/chat/labels.ts` 단일 소스)

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| **`memory`** | `장기기억` | 방 메뉴 항목 · 시트 제목 h2 · 시트 `aria-label` |
| **`memoryClose`** | `닫기` | 머리 줄 닫기 버튼 |
| **`memoryGuide`** | `AI가 긴 대화를 요약해 기억합니다. 직접 고칠 수 있어요.` | 안내 줄(사전 확정 2) |
| **`memoryUpdatedAtPrefix`** | `마지막 갱신` | 갱신 줄 앞말. 뒤에 `<time>` `MM.DD HH:mm` |
| **`memoryInputAriaLabel`** | `장기기억 요약` | TextArea 접근 이름 |
| **`memoryPlaceholder`** | `아직 요약이 없습니다` | TextArea placeholder(사전 확정 2) |
| **`memoryLoading`** | `장기기억을 불러오는 중` | 조회 중 StateView |
| **`memoryLoadError`** | `장기기억을 불러오지 못했습니다` | 조회 실패 StateView 제목 |
| `retry`(재사용) | `다시 시도` | 조회 실패 버튼 |
| **`memoryOverNote`** | `` `${MEMORY_SUMMARY_MAX}자 이하로 줄여 주세요.` `` = `4000자 이하로 줄여 주세요.` | 초과 안내 줄 · 저장 버튼 `aria-describedby` |
| `cancel` · `save`(재사용) | `취소` · `저장` | 하단 버튼 |
| **`memorySaved`** | `장기기억을 저장했습니다` | 저장 성공 토스트(success, 사전 확정 2 원문) |
| **`memoryDiscardTitle`** | `고친 내용을 버릴까요?` | 버림 확인 제목·`aria-label`(사전 확정 2 원문) |
| **`memoryDiscardBody`** | `저장하지 않은 내용은 사라집니다.` | 버림 확인 설명 |
| **`memoryDiscardConfirm`** | `버리기` | 버림 확인 danger 버튼 |
| **`memoryKeepEditing`** | `계속 고치기` | 버림 확인 취소 쪽(첫 포커스) |

오류 문구(`writeErrorText(error, 'memory')`, 조회 실패 상세 · 저장 실패 줄 공통):

| code | 문구 | 표시 |
|---|---|---|
| `TOKEN_REQUIRED`·`TOKEN_INVALID`·`LEVEL_TOO_LOW` | L §8.3 전환 문구 그대로 | 시트 닫고 E 토스트(warning) + 전환 |
| `NOT_FOUND` | (표시 안 함 — 목록 복귀) | 시트 닫고 목록 |
| `RATE_LIMITED` + `retryAfterSec` | `` `요청이 너무 많습니다. ${retryAfterSec}초 후 다시 시도해 주세요.` `` · 값 없음 `ERROR_MESSAGES.RATE_LIMITED` | 시트 안(PUT만 — GET은 세지 않는다) |
| `VALIDATION_ERROR` | `장기기억은 0~4000자로 입력해 주세요.`(**신규** `validationText('memory')`) | 시트 안 |
| `NETWORK` | `서버에 연결할 수 없습니다.`(공용 `NETWORK_TEXT`) | 시트 안 |
| 그 밖(`INTERNAL`·`CONFIG_INVALID`) | `ERROR_MESSAGES[code]` | 시트 안 |

- 경합 안내 문구(server memory.md 후보 "저장하면 지금 요약을 …")는 시트에 두지 않는다(D-38, 매뉴얼 몫).

---

## 7. 접근성

| 항목 | 규칙 |
|---|---|
| 시트 | BottomSheet `role="dialog"` `aria-modal="true"` `aria-label="장기기억"`(= 제목 h2 글자). 공용 BottomSheet가 `aria-labelledby`를 받지 않아 `aria-label`로 같은 이름을 준다(PromptSheet 선례, D-35) |
| 버림 확인 | ConfirmDialog `role="alertdialog"` 이름 `고친 내용을 버릴까요?` · 첫 포커스 「계속 고치기」 |
| 포커스 — 열 때 | 조회 중: BottomSheet 첫 포커스 요소 = 「닫기」. 조회 성공: TextArea(F-CH-62). 조회 실패: 「닫기」 유지(StateView `role=alert`가 읽힌다) |
| 포커스 — 닫을 때 | 저장 성공·변경 없이 닫기·버리기 → ⋯ 버튼(BottomSheet 복귀 규칙. 방 메뉴가 같은 커밋에 ⋯로 돌려 둔 상태에서 시트가 열린다). 전환 → ‹(F-CH-29). 목록 복귀 → rooms 화면 규칙 |
| Tab 순서(준비됨) | 닫기 → TextArea → 취소 → 저장(비활성이면 건너뜀). 패널 안 순환(포커스 트랩) |
| 키보드 | TextArea Enter = 줄바꿈(전송 없음) · Esc = `requestClose`(저장 중 무시) · 버튼 Enter·Space |
| 카운터 | 공용 TextArea 내장 카운터는 `aria-hidden`이다. 초과는 TextArea `aria-invalid="true"`가 알리고, 안내 줄 `4000자 이하로 줄여 주세요.`를 비활성 「저장」의 `aria-describedby`로 잇는다. TextArea에 `aria-describedby`를 거는 일은 공용 변경이라 하지 않는다(D-35, 공용화 후보 ME §10) |
| 상태 알림 | 조회 중 `role=status` · 조회 실패 `role=alert` · 저장 실패 줄 `role=alert` · 저장 중은 네이티브 `disabled`·`readOnly`(별도 live 없음) · 저장 성공은 E 토스트(공용 Toast 규칙) |
| 레이블 | 방 메뉴 항목 = 보이는 글자 `장기기억` · 닫기 = `닫기` · TextArea = `장기기억 요약` |
| 대비 | 안내·갱신 줄 `--color-fg-muted`, 오류 `--color-danger` — 기존 시트 문구와 같은 토큰(수동 확인 TC-CH-139) |

---

## 8. 읽기 전용 분기

"미렌더" = DOM에 없음(`display:none`·`hidden`·`disabled`·`aria-hidden` 금지). 판정은 `viewer.canWrite` 하나.

| 요소 | 토큰 없음 · 전환 후 | 토큰 있음 | 구현 |
|---|---|---|---|
| 방 메뉴 「장기기억」 항목 | **미렌더**(⋯ 버튼 자체가 없다) | 렌더(이름 변경과 방 삭제 사이) | `ChatTopBar onOpenMenu={canWrite ? … : undefined}`(기존) |
| 장기기억 시트 · 버림 확인 | **미렌더** | `sheet.kind === 'memory'`일 때 | `canWrite && <SheetLayer/>`(기존) — 전환 커밋에서 바로 언마운트 + 전환 effect `closeSheet`(F-CH-29, 기존) |
| `getMemory`·`putMemory` 호출 | **0회**(진입 경로 없음) | 시트를 열 때 · 저장할 때 | — |
| 진행 중 요청의 늦은 응답 | 버린다(`aliveRef`) | — | F-CH-56·57 |

- 보기만 하는 경로도 없다(「ui 인계 메모」 S4 권한 · R-MEM-001 🔒 토큰 필요).
- 토큰은 화면이 읽지도 저장하지도 않는다(R-CHAT-009 · R-NFR-004). 요약 본문도 저장소에 두지 않는다.

---

## 9. 설계 결정 (S4)

| # | 결정 | 근거 |
|---|---|---|
| D-33(**훅 구조**) | 신규 `useMemorySheet`(시트 지역 상태)를 `MemorySheet` 컨테이너가 소유한다. `useRoomActions`에 넣지 않고 채팅 리듀서도 바꾸지 않는다. `useChatSheets`는 `memory` 시트 종류와 열기·닫기 콜백 3개만 더한다 | 상태가 시트 수명과 같다 — 마운트 = 조회, 언마운트 = 폐기라 "열 때마다 재조회"가 구조로 보장된다. 리듀서를 그대로 두면 `initialChatState`(TC-CH-015·053)와 전이표가 불변이다. `useRoomActions`는 `roomBusy`로 ⋯를 잠그는데, 장기기억 저장은 모달 안이라 다른 쓰기가 끼어들 수 없어 그 잠금이 필요 없다 |
| D-34(**confirm**) | 버림 확인은 컨테이너가 MemoryEditor 대신 ConfirmDialog를 **바꿔 그린다**(시트 두 장을 겹치지 않는다). 확인 대상 = 변경 있음(trim 기준) + 닫기·취소·Esc·덮개 | 공용 BottomSheet 두 장을 겹치면 포커스 트랩·Esc 처리가 바깥 시트로 새어 나간다. 바꿔 그리면 공용 변경 없이 BottomSheet 복귀 규칙만으로 포커스가 맞는다(ME §7). 초안은 컨테이너에 남는다 |
| D-35(**카운터 부품 재사용**) | 공용 TextArea 내장 카운터(`maxChars`·`counterMode='always'`)를 쓴다. 형식은 공용 그대로 `n/4000`(사전 확정 2의 `n / 4000`과 띄어쓰기만 다르다). TextArea `aria-describedby`·시트 `aria-labelledby`는 공용 prop이 없어 쓰지 않고, 초과 안내를 저장 버튼 `aria-describedby`로 잇는다 | 내장 카운터가 이미 `countChars`(= trim 후 코드 포인트, 「ui 인계 메모」 S4 길이 규칙)로 센다. settings WorldForm·CharacterForm과 같은 부품·같은 형식이다. 공용 부품 변경 금지(제약) — 필요하면 공용화 후보로 보고한다 |
| D-36 | 저장 성공이면 시트를 닫는다. 그래서 「ui 인계 메모」의 "응답 `summary`로 입력을 다시 맞춘다"는 할 일이 없다(다음에 열면 재조회) | 사전 확정 2 "성공 → 시트 닫고 토스트" |
| D-37(**사전 확정과 다름 — 기존 결정 우선** · 메인 세션 채택 2026-10-07) | 저장 실패 중 인증 3종·`NOT_FOUND`만 시트를 닫고 화면 공통 처리(전환 토스트 · 목록 복귀)를 한다. **그 밖의 실패는 E 토스트가 아니라 시트 안 `role=alert` 한 줄**로 보인다 | ① D-7(S2) "시트가 열린 채 토스트를 띄우지 않는다" — 이름 변경 PromptSheet와 같은 처리 ② E 알림 줄은 덮개(`--color-overlay`) 아래에 있어 시트가 열린 동안 보이지 않는다 ③ 입력 보존(사전 확정 2)을 지키려면 시트가 열려 있어야 한다. 사전 확정 2의 "E 토스트(§8.3 흐름)"는 문구 표(L §8.3)를 같이 쓰는 것으로 수용한다 |
| D-38 | 경합 안내 문구를 시트에 두지 않는다. 열 때마다 재조회만 한다 | 사전 확정 3(결정 노트) — 매뉴얼에만 |
| D-39 | 요약 비우기(0자 저장)에 별도 confirm을 두지 않는다 | 요구 0~4000자 허용(R-MEM-001 🔒). 지우고 「저장」을 누르는 두 단계 명시 동작이다. "다시 요약되지 않음" 안내는 매뉴얼 몫(「ui 인계 메모」 S4 "안내 여부는 ui 결정") |
| D-40(**구성안과 다름**) | M1의 전체 화면 뷰·상단 바 「저장」·메타 "출처(자동/수동)"를 쓰지 않는다. 바텀시트 + 하단 「취소」「저장」 + 갱신 시각만 | 사전 확정 2(시트 구성). 출처 필드는 계약 `MemoryResponse`에 없다(api.md §4.17 응답 필드 3개) |
| D-41(메인 세션 채택 2026-10-07) | 「저장」은 변경이 있을 때만 활성이다(trim 기준). 조회 실패·조회 중에도 비활성 | 이름 변경(`canSave` = 유효 ∧ 바뀜)·settings dirty 선례. 바뀌지 않은 저장은 레이트리밋 1회만 쓴다 |
| D-42 | 갱신 시각 형식 `MM.DD HH:mm`(연도 없음) | 방 생성일 `MM.DD`와 같은 계열. M1 예시의 연도는 390px 한 줄 여유를 줄인다 |

구성안·계약과 다르게 정한 것: D-40(구성안). 사전 확정과 다른 것: D-35(카운터 띄어쓰기 · `aria-labelledby`·TextArea `aria-describedby` 대체) · D-37(실패 표시 위치). 스킬과 다른 것: 없음.

---

## 10. 공용화 후보 (임의 공용화 금지 — 보고만)

| 후보 | 재발 | 판단 |
|---|---|---|
| 공용 TextArea `ariaDescribedBy?` | chat 장기기억 카운터·초과 안내 · settings 필드 안내 줄 | **보류 2026-10-07**(메인 세션). 두 화면 재발 · 비종속 · 비중복(Button에는 이미 있다). 승인 시 카운터·안내를 입력에 잇는다 |
| 공용 BottomSheet `ariaLabelledBy?` | chat 장기기억 · settings ②③ · PromptSheet | **보류 2026-10-07**(메인 세션). 이름이 이미 `aria-label`로 같아 기능 차이는 없다 |
| 시트 문구 스타일(`.title`·`.note`·`.error`·`.actions`) | settings `Sheets.module.css` · chat `MenuSheets.module.css` | 값이 같다. 공용 CSS 모듈로 묶을지 판단 필요 |

---

## 11. TC 예정 → `design/memory-tests.md` §11

v2.1.1에 40KB 한계로 이전(TC-CH-122~139 · §11.1 기존 TC 영향표 — TC-CH-047·061 개정, 003·015·021·023·053 유지 명시).

## 12. 인계 → `design/memory-tests.md` §12

ui-implementer 새 파일·export 표 · ui-test-designer 모킹·질의 이름·픽스처.

---

## 13. 변경이력 (이 분할 문서)

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v2.1 | 2026-10-07 | 최초 작성(S4 전체 델타): 레이아웃 · MemorySheet/MemoryEditor · RoomMenuSheet·ChatSheets 델타 · 상태(시트 지역) · F-CH-53~62 · 파이프라인 · 계약 · 문구 · 접근성 · 읽기 전용 · D-33~42 · 공용화 후보 · TC-CH-122~139 · 기존 TC 영향 · 인계 | R-CHAT-012 🔒 · 메인 세션 사전 확정 1~7 · api.md v0.7 |
| v2.1.1 | 2026-10-07 | §11·§12 → `design/memory-tests.md`(내용 그대로). D-37·D-41 메인 세션 채택 표기. §10 공용화 후보 2건 보류 표기 | 메인 세션 실측 44,268바이트 · 결정 공지 |
| v2.1.2 | 2026-10-07 | **구현 동기화(동작·문구 변경 없음)**: §2 `attempt` 상태 · `useLifecycle`/`Lifecycle`(`isAlive`·`latest` 함수 전달) · §3 F-CH-55 지역 훅 4개 · F-CH-56 조회는 effect 안 `then` 콜백에서만 setState, 「다시 시도」 = `attempt` 증가로 effect 재실행 · F-CH-57 `isAlive()`·`latest()` · §1.3 본문 분기 순서 error → loading → ready · 지역 부품 5개(DOM 같음) · §5 응답 `summary` 재동기화 없음 정정(D-36) · §5 공용 Toast 머리 주석 갱신 기록 | S4 구현 보고(ui 738/741) |
