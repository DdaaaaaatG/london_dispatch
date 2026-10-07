# chat 상세 설계 — 컴포넌트·훅·스타일 (분할 문서)

> 주 문서: `ui/src/chat/design.md`(RTM 포함). 이 파일은 주 문서 §3·§11의 상세다.
> **export 규칙(공통, v1.3):** 모든 컴포넌트·훅·순수 함수는 **named export**만 쓴다. `export default` 금지. 대상: `ChatScreen`, `ChatTopBar`, `MessageList`, `Bubble`·`bubbleVariantOf`, `InlineStatus`, `NewMessageBadge`, `ReadOnlyNotice`, `useAutoScroll`, `useChatLoader`, `useScrollMemory`, (S2) `Composer`·`InlineEditor`·`MessageMenuSheet`·`RoomMenuSheet`·`ChatSheets`·`useMessageWrites`·`useRoomActions`, (S3) `SpeakButtons`·`PendingBubble`·`speakErrorText`, `chatReducer`·`initialChatState` 외 `ui/src/state/chat.ts`·`scroll.ts`의 함수와 상수, `labels`. Props 타입은 `export type {Name}Props`. 규칙 원문은 `ui/src/rooms/design/components.md` 머리말.

---

## 0. 토큰 있음 판 레이아웃 [확정 — 구성안 §2, S2·S3] (v1.7: 주 문서 §2.2에서 40KB 한계로 이전)

→ `design/layout.md` §0(본판 ASCII · 시트 4종, v1.7.1 이전).

---

## 1. 공용 요소 시그니처 (인용 — 단일 정의는 `ui/src/rooms/design/components.md` §1)

```ts
TopBarProps     = { title: string; subtitle?: { text: string; dateTime: string; ariaLabel: string };
                    left?: ReactNode; right?: ReactNode; titleRef?: Ref<HTMLHeadingElement>;
                    variant?: 'screen' | 'room' }
ButtonProps     = { children: ReactNode; onClick: () => void; variant?: 'primary'|'secondary'|'danger'|'ghost';
                    size?: 'sm'|'md'|'lg'; isDisabled?: boolean; ariaLabel?: string; buttonRef?: Ref<HTMLButtonElement> }
IconButtonProps = { icon: 'back' | 'more'; ariaLabel: string; onClick: () => void; buttonRef?: Ref<HTMLButtonElement>; isDisabled?: boolean }
StateViewProps  = { kind: 'loading'|'empty'|'error'; message: string; detail?: string;
                    actionLabel?: string; onAction?: () => void }
TextAreaProps   = { value; onChange(v); ariaLabel; placeholder?; maxRows? = 3; maxChars?; counterMode?: 'always'|'overflow';
                    textareaRef?; onEnter?(); onEscape?(); isReadOnly? }                       // §1.13
TextInputProps  = { value; onChange(v); ariaLabel; placeholder?; maxChars?; inputRef?; onEnter?(); onEscape?();
                    isReadOnly? }                                                              // §1.12
ToggleProps     = { isOn; onChange(next); onLabel; offLabel; ariaLabel }                      // §1.14
BottomSheetProps = { ariaLabel; role?: 'dialog'|'alertdialog'; header?: ReactNode; children; onClose();
                     isDismissDisabled?; initialFocusRef? }  ·  SheetItemProps = { label; onSelect(); tone?: 'default'|'danger'; isDisabled? }  // §1.15
ConfirmDialogProps = { title; message; confirmLabel; cancelLabel; onConfirm(); onCancel(); isBusy? }   // §1.16
PromptSheetProps = { title; inputAriaLabel; initialValue; maxChars; canSave(v); saveLabel; cancelLabel;
                     onSave(v); onCancel(); isBusy?; errorText? }                              // §1.17
ToastProps = { message; tone: 'warning'|'danger' } · useToast() => { toast, showToast(m, tone) }  // §1.18
// useLongPress — 삭제됨(S3e 후작업 2026-10-07, 사용처 0)
formatMonthDay(ms): 'MM.DD' · formatTime(ms): 'HH:mm' · toIsoDate(ms) · toIsoDateTime(ms)   // 로컬 시간대
loadLastRoomId() · saveLastRoomId(id) · clearLastRoomId()
loadScrollOffset(roomId): number | null · saveScrollOffset(roomId, distanceFromBottom): void  // try/catch, throw 없음
Viewer = { readonly canWrite: boolean } · READ_ONLY_VIEWER · WRITER_VIEWER
MESSAGE_TEXT_MAX_CHARS = 2000 · ROOM_TITLE_MAX_CHARS = 60 · countChars(v) · isMessageTextValid(v) · isRoomTitleValid(v)  // §1.11
toastToneOf(error): 'warning' | 'danger'                                                       // rooms F-RM-22
```

chat 사용: TopBar `variant='room'`, IconButton `back`·(S2)`more`, StateView(첫 로드 3상태), Button(B0 「다시 시도」 sm secondary · 배지 sm primary · (S2) 전송 md primary · 인라인 수정 취소/저장 sm), (S2) TextArea(입력창·인라인 수정), Toggle(OOC), BottomSheet+SheetItem(방 메뉴), ConfirmDialog(메시지·방 삭제), PromptSheet(이름 변경), Toast(E 줄), useToast. (S3) Button(캐릭터 버튼 2 md secondary · 실패 말풍선 「재시도」 sm secondary). (S3e) Button(말풍선 버튼 줄 sm ghost, AC §1) · 말풍선 메뉴·SheetItem 재작성 사용 중단 · `useLongPress`는 삭제됨(S3e 후작업 2026-10-07). **공용 부품 변경 없음**(Button의 `ariaLabel`·`isDisabled`·`buttonRef`로 충분).

---

## 2. chat 로컬 컴포넌트 (`ui/src/chat/components/`)

### 2.0 ChatTopBar (A) — S1 실물 소급(v1.4) + S2

```ts
export type ChatTopBarProps = {
  room: RoomSummary
  onBack: () => void
  backButtonRef: Ref<HTMLButtonElement>      // 마운트 시 포커스 대상
  onOpenMenu?: () => void                    // S2: 있으면 right = ⋯ 버튼, 없으면 right 미렌더
  menuButtonRef?: Ref<HTMLButtonElement>     // S2: 방 메뉴 시트를 닫은 뒤 포커스 복귀 대상
  isMenuDisabled?: boolean                   // v1.5: 쓰기 대기 중 ⋯ 비활성(design.md §11.2 D-10)
}
```
- 렌더: `TopBar variant='room' title={room.title} subtitle={{ text: formatMonthDay(room.createdAt), dateTime: toIsoDate(room.createdAt), ariaLabel: labels.createdAtAriaLabel(text) }} left={<IconButton icon='back' ariaLabel={labels.backAriaLabel} onClick={onBack} buttonRef={backButtonRef} />} right={onOpenMenu ? <IconButton icon='more' ariaLabel={labels.moreAriaLabel} onClick={onOpenMenu} buttonRef={menuButtonRef} isDisabled={isMenuDisabled} /> : undefined}`.
- ChatScreen은 `viewer.canWrite`일 때만 `onOpenMenu`를 넘긴다(주 문서 §10).

### 2.1 MessageList

```ts
export type MessageListProps = {
  messages: readonly Message[]               // id 오름차순
  containerRef: RefObject<HTMLDivElement | null>   // useAutoScroll 이 준 ref (React 19 타입, 소급)
  onScroll: () => void                       // useAutoScroll 이 준 핸들러
  isLoadingOlder: boolean
  olderError: ApiError | null
  onRetryOlder: () => void
  unseenCount: number
  onShowNewest: () => void
  // ── S2 ──
  // (S3e) onOpenMenu 삭제 → actions? · isActionLocked · regenerateTargetId · editFocusId · onEditFocusDone(AC §2)
  editingId: number | null                   // 인라인 수정 중인 메시지. 읽기 전용이면 호출 쪽이 항상 null 을 넘긴다(v1.5, F-CH-11)
  isEditSaving: boolean                      // state.writing?.kind === 'edit'
  isEditSaveLocked: boolean                  // S3d: state.writing?.kind === 'speak' → InlineEditor isSaveLocked(auto.md §2.3)
  onSaveEdit: (messageId: number, text: string) => void
  onCancelEdit: () => void
  // ── S3 ──
  pending: PendingSpeak | null               // 읽기 전용이면 호출 쪽이 항상 null(F-CH-39)
  isSpeakLocked: boolean                     // !canSpeak(state) → 「재시도」 disabled(편집 중 포함, DC-10)
  onRetrySpeak: (target: SpeakTarget) => void   // S3d: 캐릭터·중립 'auto'
  regeneratingId: number | null              // 재작성 중인 대상 id(없으면 null)
}
```
- (v1.9.1 실물) `<ol>`과 끝의 pending `<li>`는 지역 `MessageRows`가, 한 칸은 지역 `MessageItem`이 그린다(50줄 한계, DOM 불변 — auto.md §2.3).
- (S3) `<ol>` 안 메시지 `<li>`들 **뒤**에 `pending !== null`이면 `<li key="pending"><PendingBubble pending={pending} isRetryDisabled={isSpeakLocked} onRetry={onRetrySpeak} /></li>`를 하나 더 둔다(목록 끝 = 임시 자리. 메시지가 0건이어도 MessageList가 렌더된다, F-CH-39). `MessageItem`은 `isRegenerating={message.id === regeneratingId}`를 Bubble에 넘긴다.
- 렌더: 래퍼 `<div class=wrap>`(`position: relative; flex: 1; min-height: 0`) 안에
  1. 스크롤 박스 `<div ref={containerRef} role="log" aria-live="polite" aria-busy={isLoadingOlder} aria-label={labels.historyAriaLabel} tabIndex={0} onScroll={onScroll}>`(`overflow-y: auto; height: 100%`)
     - 맨 위: 지역 컴포넌트 `OlderStatus`(소급) — `isLoadingOlder` → `InlineStatus kind='loading' message={labels.olderLoading}`. 아니고 `olderError` → `InlineStatus kind='error' message={labels.olderError} actionLabel={labels.retry} onAction={onRetryOlder}`. 둘 다 아니면 없음.
     - `<ol>` → `messages.map(m => <li key={m.id}>{m.id === editingId ? <InlineEditor message={m} isSaving={isEditSaving} isSaveLocked={isEditSaveLocked} onSave={text => onSaveEdit(m.id, text)} onCancel={onCancelEdit} /> : <Bubble message={m} /> + (S3e) BubbleActions(AC §2 MessageItem)}</li>)`.
  2. `unseenCount > 0`이면 `NewMessageBadge label={labels.newMessages} ariaLabel={labels.newMessagesAriaLabel} onClick={onShowNewest}`(스크롤 박스 밖, `position: absolute; right: var(--space-4); bottom: var(--space-2)`).
- `Bubble`은 `React.memo`. key는 서버 id. (S3e) 버튼 줄 핸들러는 `useMemo`로 묶은 `messageActions` 참조라 다시 그려지지 않는다(AC §2).

### 2.2 Bubble

```ts
export type BubbleProps = {
  message: Message
  // (S3e) onOpenMenu 삭제 — AC §3
  isRegenerating?: boolean                   // S3. 기본 false. 재작성 요청 중인 대상(캐릭터 변형에서만 의미가 있다)
}
export type BubbleVariant = 'sebastian' | 'ciel' | 'user' | 'ooc'          // v1.6 (CR-001)
export const bubbleVariantOf = (m: Message): BubbleVariant =>
  m.kind === 'ooc' ? 'ooc' : m.speaker === 'user' ? 'user' : m.speaker   // 'sebastian' | 'ciel'
```
판정 순서는 위 함수 그대로(OOC가 먼저 — speaker가 캐릭터여도 `kind='ooc'`면 OOC). 실물은 지역 컴포넌트 `CharacterBubble`(세바스찬·시엘 공용)·`UserBubble`·`OocBubble`·`SentTime`으로 나뉜다. 변형별 렌더(R-CHAT-002 🔒 CR-001 개정):

| 변형 | 정렬 | DOM 순서 | 내용 |
|---|---|---|---|
| `sebastian` | **왼쪽** | 아바타 → 이름 → 시각 → 본문 | `meta = CHARACTERS.sebastian`. `<img src={meta.avatar} alt="" width={28} height={28}>` · 이름 `meta.shortName`(sm, accent) · `<time dateTime={toIsoDateTime(createdAt)}>{formatTime(createdAt)}</time>` · 본문(serif base, `--bubble-sebastian-bg` 말풍선, 최대 폭 `--bubble-max-width`) |
| `ciel` | **오른쪽**(오른쪽 정렬) | 아바타 → 이름 → 시각 → 본문(세바스찬과 **같은 DOM 순서**, 읽는 순서 유지) | `meta = CHARACTERS.ciel`. 내용은 위와 같다. 화면 배치만 거울: 루트 행 `flex-direction: row-reverse`(아바타가 오른쪽 끝), 머리 줄도 `row-reverse`라 화면에는 "시각 이름 (아바타)" 순서, 본문 말풍선 오른쪽 정렬(`margin-left: auto`, 글자는 왼쪽 정렬 유지) |
| `user` | **가운데**(말풍선) | 작성자명 → 시각 → 본문 | 머리 줄 가운데 정렬, 화면 순서 "작성자명 · 시각"(row-reverse 없음). 작성자명 (S3d) `userAuthorLabel(message.authorName)`(받은 값 그대로, `null`·빈 문자열이면 `USER_DISPLAY_NAME` 「어떠한 의지」 — `design/auto.md` §2.2, 옛 `authorName ?? labels.unknownAuthor` 대체. §2.8 `nameOf` user 분기도 같은 함수)(sm `--bubble-user-fg`) · 시각(xs). 본문 serif base, 배경 `--bubble-user-bg` 말풍선, 반경 `--radius-lg`, 최대 폭 `--bubble-user-max-width`(86%), 아바타 없음. S2 새 발화의 `authorName`은 응답 값 그대로(R-AUTH-004) |
| `ooc` | **가운데**(한 줄) | 장식 → 접두 → 본문 → 장식 → 시각 | `<span aria-hidden="true">{labels.oocDecor}</span> {labels.oocPrefix} {text} <span aria-hidden="true">{labels.oocDecor}</span>` sm `--bubble-ooc-fg` + 시각 xs. **배경·테두리 없음**, 작성자명 없음 |

- 유저와 OOC는 둘 다 가운데지만 **배경 말풍선 유무 · 작성자명 머리 줄 유무 · 글자 크기(base serif vs sm) · `[지시]` 접두와 `—` 장식**으로 구분한다(색만으로 구분하지 않음).
- **클래스명(확정, v1.6 — CR-001).** 루트 요소 클래스:

| 클래스 | 붙는 조건 | 역할 |
|---|---|---|
| `character` | 변형이 `sebastian` 또는 `ciel` | **캐릭터 공통**: 아바타·이름 행 형태. 정렬은 정하지 않는다 |
| `sebastian` | 변형 `sebastian` | **왼쪽 정렬** + 색(`--bubble-sebastian-*`) |
| `ciel` | 변형 `ciel` | **오른쪽 정렬**(row-reverse) + 색(`--bubble-ciel-*`) |
| `user` | 변형 `user` | **가운데 말풍선**(배경 있음, 최대 폭 86%) |
| `ooc` | 변형 `ooc` | **가운데 한 줄**(배경 없음) |
| ~~`menuEnabled` (S2)~~ | **삭제(S3e)** | — |

  - 조합: 세바스찬 `character sebastian` · 시엘 `character ciel` · 유저 `user` · OOC `ooc`(speaker가 캐릭터여도 캐릭터 키 없음). 캐릭터는 `cx(styles.root, styles.character, styles[variant], isRegenerating && styles.regenerating)`.
  - 정렬은 캐릭터별 키(`sebastian`·`ciel`)가 결정한다. 테스트는 `toHaveClass('sebastian')`(왼쪽)·`toHaveClass('ciel')`(오른쪽)·`toHaveClass('user')`·`toHaveClass('ooc')`로 배치를 단언한다(non-scoped).
- 본문은 **일반 텍스트**(React 이스케이프). `dangerouslySetInnerHTML`·마크다운 해석 금지. `white-space: pre-wrap; overflow-wrap: anywhere`.
- **재작성 중 표시(S3).** `isRegenerating`이면 `CharacterBubble`이 ① 루트에 클래스 `regenerating`을 더하고 ② 본문 `<p class=body>`에 `aria-busy="true"`를 붙이고(기존 텍스트는 **그대로 둔다**) ③ 머리 줄 시각 뒤에 `<span class=regeneratingNote role="status">{labels.regeneratingNote}</span>`(`다시 쓰는 중…`)을 둔다. `regenerating` 스타일: 본문 `opacity: var(--bubble-busy-opacity)`(0.55). 성공하면 `messageReplaced`로 새 본문이 들어오고 표시가 사라진다. 실패하면 표시만 사라지고 원 대사가 남는다. `UserBubble`·`OocBubble`은 이 prop을 무시한다(재작성 대상이 될 수 없다 — `isRegenerateTarget`이 `line`+캐릭터만). `aria-busy`를 루트가 아니라 본문에만 거는 이유: 같은 말풍선 안의 `role=status` 알림이 busy 때문에 미뤄지지 않게 한다.
- ~~메뉴 핸들러(S2)~~ **삭제(S3e)**: `onOpenMenu`·`useLongPress`·`tabIndex`·`aria-haspopup`·`aria-keyshortcuts`·Shift+F10 처리 없음. 말풍선은 읽기·쓰기 모두 포커스·포인터 핸들러가 없다. 버튼 줄은 `MessageItem`의 형제 `BubbleActions`(AC §1·§2).

### 2.3 InlineStatus

```ts
export type InlineStatusProps = { kind: 'loading' | 'error'; message: string; actionLabel?: string; onAction?: () => void }
```
- 렌더: 가운데 한 줄(loading 24px, error 28px). loading `role="status"`, error `role="alert"`. error이고 `actionLabel`·`onAction`이 둘 다 있으면 `Button size='sm' variant='secondary'`.

### 2.4 NewMessageBadge

```ts
export type NewMessageBadgeProps = { label: string; ariaLabel: string; onClick: () => void }
```
- 렌더: `Button size='sm' variant='primary' ariaLabel={ariaLabel}` 안에 `label` + 아래 방향 인라인 SVG(`aria-hidden`). info 톤.

### 2.5 ReadOnlyNotice

```ts
export type ReadOnlyNoticeProps = { text: string }
```
- 렌더: `<p role="note">` 28px 한 줄 가운데, sm `--font-ui`, `--color-info`, 위 1px `--color-border`. S2: 인증 실패 전환 뒤에도 같은 문구로 나타난다(구성안 §2 D "토큰 실패 전환 시에도").

### 2.6 Composer (C 하단 바) — S2, 구성안 §2 C

```ts
export type ComposerProps = {
  canSend: boolean                                         // state.phase === 'ready' && state.writing === null
  isSending: boolean                                       // state.writing?.kind === 'send'
  onSend: (text: string, ooc: boolean) => Promise<boolean> // true = 저장됨(입력 비움)
  onSpeak: (character: CharacterId) => void                // S3: F-CH-31 speakAs
  canSpeak: boolean                                        // S3: canSpeak(state) — canSend + 인라인 수정 중 아님(DC-10)
  speakingCharacter: CharacterId | null                    // S3: writing?.kind==='speak' ? character : null(포커스 복귀용, F-CH-38)
}
```
- (S3) `canSend`는 S2와 같은 값(`canSend(state)`)이다. S3부터 이 값이 false가 되는 경우에 speak·재작성 진행이 더해진다(functions.md §4.3 잠금 표). `isSending`은 여전히 `writing?.kind === 'send'`일 때만 true라서, **생성 중에는 입력창이 `readOnly`가 아니다**(요구 "전송 잠금" — 입력 금지가 아님).
- 로컬 상태: `text`(초기 `''`), `ooc`(초기 `false`). `textareaRef`.
- `sendable = canSend && !isSending && isMessageTextValid(text)`.
- `submit()`: `sendable`이 아니면 종료 → `const saved = await onSend(text, ooc)` → `saved`면 `setText('')`(OOC 토글 값은 그대로 둔다) → `textareaRef.current?.focus()`. 실패면 입력을 그대로 둔다.
- 렌더: `<div role="group" aria-label={labels.composerAriaLabel} aria-busy={isSending} class=composer>`(위 1px `--color-border`, 배경 `--color-bg`, padding `--space-2` `--space-4`, 행 사이 `--space-2`)
  - 1행(36px, 클래스 `topRow` — S2 `toggleRow`를 이름만 바꾼다, `display: flex; justify-content: space-between; align-items: center; gap: var(--space-2)`): **왼쪽 = `SpeakButtons isDisabled={!canSpeak} speakingCharacter={speakingCharacter} onSpeak={onSpeak}`(S3, §2.11)** · 오른쪽 `Toggle isOn={ooc} onChange={setOoc} onLabel={labels.oocOn} offLabel={labels.oocOff} ariaLabel={labels.oocAriaLabel}`
  - 2행(36~76px): `TextArea`(flex 1) `value={text}` `onChange={setText}` `ariaLabel={labels.inputAriaLabel}` `placeholder={labels.inputPlaceholder}` `maxRows={3}` `maxChars={MESSAGE_TEXT_MAX_CHARS}` `counterMode='overflow'` `onEnter={submit}` `isReadOnly={isSending}` `textareaRef` + `Button variant='primary' size='md' isDisabled={!sendable} onClick={submit}` → `labels.send`
- 총 높이 96~136px. 높이 ≤ 480이면 1줄 고정(TextArea §1.13).
- 입력 중 다른 쓰기(수정 저장·삭제) 진행 중이면 `canSend=false`라 전송만 잠기고 타이핑은 된다. 전송 중에는 `readOnly`로 편집도 막는다(성공 시 비울 내용이 바뀌지 않게).

### 2.7 InlineEditor (인라인 수정) — S2, 구성안 §2 "말풍선 자리 textarea + 취소/저장"

```ts
export type InlineEditorProps = {
  message: Message
  isSaving: boolean
  isSaveLocked: boolean          // S3d: MessageList isEditSaveLocked
  onSave: (text: string) => void
  onCancel: () => void
}
```
- (S3d) `isSaveLocked`는 생성 중 저장만 잠근다(취소·입력 활성, `isSaving` 재사용 안 함). (v1.9.1 실물) 버튼 줄은 지역 `EditorActions`, 숨은 안내 `labels.editSaveLockedNote`(지역 `.srOnly`)의 `aria-describedby`는 (후작업 2026-10-07) 공용 Button `ariaDescribedBy` prop으로 건다(D-23 해소, 지역 훅 삭제).
- 로컬 상태: `text`(초기 `message.text`). `canSave = !isSaving && !isSaveLocked && isMessageTextValid(text) && text !== message.text`(S3d `!isSaveLocked` 추가).
- 렌더: `<div role="group" aria-label={labels.editAriaLabel} class={cx(editor, variantClass)}>` — 정렬은 원래 말풍선 변형과 같다(v1.6: `sebastian` 왼쪽 · `ciel` 오른쪽 · `user`·`ooc` 가운데. 폭은 캐릭터 `--bubble-max-width`, 유저·OOC `--bubble-user-max-width`). 클래스는 `cx(styles.editor, styles[bubbleVariantOf(message)])`. 안: `TextArea value onChange ariaLabel={labels.editInputAriaLabel} maxRows={6} maxChars={MESSAGE_TEXT_MAX_CHARS} counterMode='overflow' onEscape={isSaving ? undefined : onCancel} isReadOnly={isSaving}` + 버튼 줄(오른쪽 정렬) `Button sm secondary isDisabled={isSaving}` 취소 · `Button sm primary isDisabled={!canSave}` 저장.
- Enter는 줄바꿈이다(`onEnter` 없음). 저장은 버튼으로만.
- 마운트 `useLayoutEffect([])`: 입력에 포커스, 커서를 끝으로(`setSelectionRange(len, len)`).

### 2.8 ~~MessageMenuSheet (말풍선 메뉴)~~ — **삭제(S3e, CR-003)**

파일·props·`excerptOf` 삭제. `nameOf`는 `BubbleActions`로 이동. 대체 컴포넌트 **`BubbleActions`**(말풍선 아래 「수정」·(「재작성」)·「삭제」 버튼 줄)는 `design/actions.md` §1, 삭제 목록은 AC §3.

### 2.9 RoomMenuSheet (⋯ 방 메뉴) — S2, 구성안 §2-2

```ts
export type RoomMenuSheetProps = { roomTitle: string; onRename: () => void; onDelete: () => void; onClose: () => void }
```
- 렌더: `BottomSheet ariaLabel={labels.roomMenuAriaLabel} header={<p class=menuHeader>{labels.roomMenuHeader(roomTitle)}</p>} onClose={onClose}` 안에 `SheetItem` 이름 변경 → **(S4) 장기기억**(`onMemory`, props 추가 — `design/memory.md` §1.4) → 방 삭제(`danger`) → 취소.

> (S4) `ChatSheet`에 `{ kind: 'memory' }`, `ChatSheetsProps`에 `onAskMemory`·`onMemorySaved`·`onMemoryLeave`가 더해지고 `memory` kind는 `MemorySheet`를 렌더한다 — §2.10 표의 추가 행은 `design/memory.md` §1.5(ME가 우선).

### 2.10 ChatSheets (시트 스위치) — S2

```ts
export type ChatSheet =                     // (S3e) 'messageMenu' 삭제 — AC §3
  | { kind: 'confirmDeleteMessage'; message: Message }
  | { kind: 'roomMenu' }
  | { kind: 'rename'; errorText: string | null }
  | { kind: 'confirmDeleteRoom' }
export type ChatSheetsProps = {
  sheet: ChatSheet
  room: RoomSummary
  writing: MessageWrite | null             // functions.md §1
  roomBusy: 'rename' | 'delete' | null     // useRoomActions
  onClose: () => void
  // (S3e) onStartEdit · onRegenerate · onAskDeleteMessage 삭제(버튼 줄이 직접 부른다)
  onConfirmDeleteMessage: (message: Message) => void
  onAskRename: () => void
  onSaveRename: (title: string) => void
  onAskDeleteRoom: () => void
  onConfirmDeleteRoom: () => void
}
```
- `sheet.kind`별 하나만 렌더:

| kind | 렌더 |
|---|---|
| `confirmDeleteMessage` | `ConfirmDialog title={labels.deleteMessageTitle} message={labels.deleteMessageBody} confirmLabel={labels.delete} cancelLabel={labels.cancel} onConfirm={() => onConfirmDeleteMessage(m)} onCancel={onClose} isBusy={writing?.kind === 'delete'}` |
| `roomMenu` | `RoomMenuSheet roomTitle={room.title} onRename={onAskRename} onDelete={onAskDeleteRoom} onClose` |
| `rename` | `PromptSheet title={labels.renameTitle} inputAriaLabel={labels.renameInputAriaLabel} initialValue={room.title} maxChars={ROOM_TITLE_MAX_CHARS} canSave={v => isRoomTitleValid(v) && v.trim() !== room.title} saveLabel={labels.save} cancelLabel={labels.cancel} onSave={onSaveRename} onCancel={onClose} isBusy={roomBusy === 'rename'} errorText={sheet.errorText}` |
| `confirmDeleteRoom` | `ConfirmDialog title={labels.deleteRoomTitle} message={labels.deleteRoomBody} confirmLabel={labels.delete} cancelLabel={labels.cancel} onConfirm={onConfirmDeleteRoom} onCancel={onClose} isBusy={roomBusy === 'delete'}` |

- ChatScreen이 `viewer.canWrite && sheet !== null`일 때만 이 컴포넌트를 렌더한다.

### 2.11 SpeakButtons (C 1행 왼쪽 — 캐릭터 버튼 2) — S3, 구성안 §2 C 1행

```ts
export type SpeakButtonsProps = {
  isDisabled: boolean                        // !canSpeak(state) — 생성·재작성·전송·수정 저장·삭제 중, 인라인 수정 열림, 첫 로드 전
  speakingCharacter: CharacterId | null      // 진행 중 speak 의 캐릭터(버튼·「재시도」 어느 쪽으로 시작했든)
  onSpeak: (character: CharacterId) => void  // F-CH-31
}
```
- 위치 `ui/src/chat/components/SpeakButtons.tsx`(Composer 400줄·50줄 한계와 무관하게 역할이 달라 분리. 로컬, 공용 후보 아님 — 캐릭터를 안다).
- 순서 상수(파일 지역): `SPEAK_ORDER: readonly CharacterId[] = ['sebastian', 'ciel']`(구성안 `[세바스찬] [시엘]`).
- 렌더: `<div class=speakButtons>`(`display: flex; gap: var(--space-2)`) 안에 순서대로 `Button variant='secondary' size='md' ariaLabel={labels.speakAriaLabel(CHARACTERS[c].shortName)} isDisabled={isDisabled} buttonRef={refs[c]} onClick={() => onSpeak(c)}` → 보이는 글자 `CHARACTERS[c].shortName`(`세바스찬`·`시엘`). 라벨 단일 소스는 `CHARACTERS`(labels에 이름을 두지 않는다).
- 지역 상태: `refs`(캐릭터별 `useRef<HTMLButtonElement>(null)` 2개) · `lastSpeakerRef`(DC-03). 포커스 복귀 effect는 functions.md F-CH-38 — 「재시도」로 시작한 생성도 같은 캐릭터 버튼으로 돌아온다.
- 눌린 버튼만 다르게 보이게 하지 않는다(진행 표시는 임시 말풍선 하나 — 요구 밖 진행 UI 금지).
- 폭: 세바스찬 약 80px + 시엘 약 56px + 간격 8 ≈ 144px. 오른쪽 OOC 토글 약 84px. 390px(내용 폭 358px)에서 한 줄에 들어간다.

### 2.12 PendingBubble (B 끝 임시·실패 말풍선) — S3, 구성안 §2 "생성 중 임시 말풍선"·"생성 실패 말풍선"

```ts
export type PendingBubbleProps = {
  pending: PendingSpeak                       // functions.md §1
  isRetryDisabled: boolean                    // !canSpeak(state)(MessageList isSpeakLocked, CF-05)
  onRetry: (target: SpeakTarget) => void      // F-CH-32(S3d: 캐릭터·'auto')
}
```
- **(S3d, CR-002) 중립 변형.** `'auto'`면 지역 `NeutralPending`: 가운데, 아바타·이름·시각 없음, 배경 없음, 지역 클래스 **`neutral`**, Bubble 모듈 `root`·`character`·`sebastian`·`ciel`·`user` 없음. 숨은 안내 `응답을 만드는 중`, 「재시도」 aria `응답 재시도`. 캐릭터면 지역 `CharacterPending`(아래 S3 서술). (v1.9.1 실물) 두 변형의 본문 상자는 지역 **`PendingBody`** 공통이다. 정본 `design/auto.md` §2.1.
- **판정: Bubble 변형이 아니라 별도 로컬 컴포넌트**(`ui/src/chat/components/PendingBubble.tsx`). 근거: Bubble은 서버 `Message`(id·createdAt·text)를 그리고 `memo`·메뉴 핸들러·`bubbleVariantOf`(4변형, CR-001 확정 클래스)를 가진다. 임시 자리는 id·시각·본문이 없고 메뉴가 없어야 한다(R-CHAT-007 말풍선 메뉴의 대상은 서버에 저장된 메시지뿐 — 수정·재작성·삭제 모두 메시지 id가 필요하다. `design/generate.md` §4 D-11). 변형으로 넣으면 `Message`에 가짜 값을 채우거나 Bubble props가 두 갈래가 된다. 구성안 표의 "Bubble(pending/error)"는 **보이는 모양**이 캐릭터 말풍선과 같다는 뜻으로 받는다.
- **스타일 방식(확정, v1.7 DC-01).** PendingBubble은 **`Bubble.module.css`를 그대로 import**(`import bubbleStyles from './Bubble.module.css'`)해 같은 클래스를 같은 DOM 구조에 붙인다: 루트 `cx(bubbleStyles.root, bubbleStyles.character, bubbleStyles[c], styles.pending, isFailed && styles.failed)` → 자식 `bubbleStyles.avatar` · `bubbleStyles.content` → `bubbleStyles.head`(안에 `bubbleStyles.name`) · `bubbleStyles.body`. 그래서 실물의 자손 선택자(`.sebastian .body`·`.sebastian .name`·`.ciel .head`·`.ciel .content` 등 배경색·거울 배치)가 그대로 걸린다. CSS Modules `composes`는 **쓰지 않는다**(루트만 합성되고 자식의 자손 선택자 대상 클래스가 지역 모듈 이름으로 바뀌어 스타일이 빠진다). 지역 `PendingBubble.module.css`에는 상태·보조 클래스 **`pending`** · **`failed`** · **`bodyBox`**(v1.7.1) · `dots`(`…` 글자색 `--bubble-pending-fg`) · `errorText`·`errorMark`·`retryRow` · **`srOnly`**만 둔다(모양 클래스는 두지 않는다).
- 배치(R-CHAT-002 🔒 CR-001 유지): `pending.character`가 `sebastian`이면 왼쪽, `ciel`이면 오른쪽(row-reverse). 루트 클래스는 위 「스타일 방식」 그대로라 DOM 클래스에 Bubble 모듈의 `root`·`character`·`sebastian`/`ciel`이 붙고, 자식에 `avatar`·`content`·`head`·`name`·`body`가 붙는다(테스트는 non-scoped 이름으로 `toHaveClass('ciel')` 등 단언). 메시지 말풍선과 구분하는 키는 **`pending`**(루트에 항상)·**`failed`**(실패일 때).
- 공통 머리: 아바타 `<img src={CHARACTERS[c].avatar} alt="" width={28} height={28}>` · 이름 `CHARACTERS[c].shortName`. **시각 없음**(아직 저장되지 않았다).
- **본문 요소(v1.7.1 실물 동기화).** 본문은 `<p>`가 아니라 **`<div className={cx(bubbleStyles.body, styles.bodyBox)}>`**다(실패일 때 안에 문단 + 버튼 줄이 들어가 `<p>` 안에 블록을 둘 수 없다). Bubble `.body` 클래스를 그대로 써서 자손 선택자 색이 걸리고, 지역 보조 클래스 **`bodyBox`**는 실패 테두리(`.failed .bodyBox`)와 숨은 안내 `.srOnly`의 위치 기준점(`position: relative`)을 맡는다.
- `status === 'generating'`: 루트 `role="status" aria-live="polite"`. 본문 `div` 안에 `<span aria-hidden="true">{labels.pendingDots}</span>`(`…`, 글자색 `--bubble-pending-fg`) + `<span class=srOnly>{labels.pendingStatus(shortName)}</span>`(`세바스찬 대사를 만드는 중`). 애니메이션 없음(진행률·타이머 표시 금지).
- `status === 'failed'`: 루트 role 없음. 본문 테두리 1px `--bubble-error-border`(`.failed .bodyBox`). 본문 `div` 안 `<p role="alert" class=errorText><span class=errorMark aria-hidden="true">!</span> {speakErrorText(pending.error)}</p>`, 그 아래 `<div class=retryRow>` 안에 **항상** `Button variant='secondary' size='sm' ariaLabel={labels.speakRetryAriaLabel(shortName)} isDisabled={isRetryDisabled} onClick={() => onRetry(pending.character)}` → `labels.speakRetry`(`재시도`). `CONFIG_INVALID`도 관리자 안내 문구 + 버튼(사용자 결정 2026-10-06: 요구 원문 유지, DC-02).
- 롱프레스·우클릭·Shift+F10 핸들러·`tabIndex` **없음**(메뉴 없음 — 메뉴 대상은 서버 메시지뿐, D-11). 우클릭은 브라우저 기본 동작.
- `.srOnly`는 이 모듈 지역 클래스(`position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap`). 전역 유틸은 없다.
- 높이: 생성 중 약 60px(머리 20 + 본문 한 줄 40). 실패 약 96~120px(문구 1~2줄 + 버튼 28).

---

## 3. 공용 훅 `useAutoScroll` (`ui/src/components/hooks/useAutoScroll.ts`)

```ts
export type UseAutoScrollOptions = {
  firstId: number | null                    // 현재 목록 첫 메시지 id (없으면 null)
  lastId: number | null                     // 현재 목록 끝 메시지 id
  initialDistanceFromBottom: number | null  // 복원할 거리(px). null = 맨 아래
  canAutoLoadOlder: boolean                 // 위 끝 도달 시 onReachTop 을 불러도 되는가
  onReachTop: () => void
  onReachBottom: () => void                 // 맨 아래 근처 도달(배지 해제)
  tailKey?: string | null                   // v1.7(S3): 목록 끝에 붙는 메시지 아닌 조각(임시·실패 말풍선)의 식별 값. 기본 null
}
export type UseAutoScrollResult = {
  containerRef: RefObject<HTMLDivElement | null>
  onScroll: () => void
  isNearBottom: () => boolean               // S2 전송 성공 시점에 쓴다. 측정 전(metrics null)이면 true (소급)
  scrollToBottom: () => void
  getDistanceFromBottom: () => number | null  // 첫 배치 전이면 null. 언마운트 뒤에도 마지막 값
}
```

내부 ref: `metricsRef: ScrollMetrics | null`(마지막 측정) · `prevIdsRef: { firstId, lastId }` · `positionedRef: boolean`(첫 배치 완료) · `lastDistanceRef: number | null` · 최신 `canAutoLoadOlder`·콜백을 담는 ref. 계산 함수는 `ui/src/state/scroll.ts`(functions.md §2).

| 시점 | 동작 |
|---|---|
| `useLayoutEffect([firstId, lastId])`, `firstId === null`이고 `positionedRef === true` (v1.5) | 목록이 비었다(마지막 메시지 삭제 → 재로드). `positionedRef = false`, `repositionToBottomRef = true`, `prevIdsRef = { null, null }`. 그 밖은 하지 않는다 |
| 같은 effect, 요소 없음 또는 `firstId === null` | 아무것도 안 함 |
| 같은 effect, `positionedRef === false` | `el.scrollTop = restoreScrollTop(el, repositionToBottomRef ? null : initialDistanceFromBottom)`(재배치면 **맨 아래**, 마운트 첫 배치면 저장 거리) → `positionedRef = true`, `repositionToBottomRef = false` → 측정 기록 → `isNearTop` && `canAutoLoadOlder`면 `onReachTop()` 1회 |
| 같은 effect, `firstId < prev.firstId`(앞에 붙음) | `el.scrollTop = anchorScrollTop(metricsRef, el.scrollHeight)` |
| 같은 effect, `lastId > prev.lastId`(뒤에 붙음 — S2 전송 성공) | 붙기 **전** 측정(`metricsRef`)이 `isNearBottom`이면 `el.scrollTop = el.scrollHeight`. 아니면 그대로 |
| (v1.7) 별도 `useLayoutEffect([tailKey])`, `positionedRef === true`이고 `tailKey`가 **null이 아닌 새 값**으로 바뀜 | 바뀌기 **전** 측정(`metricsRef`)이 `isNearBottom`이면 `el.scrollTop = el.scrollHeight` 후 측정 기록. 아니면 그대로(배지는 늘리지 않는다 — 메시지가 아니다). `tailKey`가 null이 되는 경우(성공 교체 · 폐기)는 아무것도 하지 않는다 — 성공 교체는 같은 커밋의 `lastId` 증가 분기가 처리한다. 첫 배치 전(`positionedRef === false`, 빈 방에서 첫 임시 말풍선)이면 첫 배치 분기가 맨 아래/저장 거리로 놓는다. chat 사용: `tailKey = pending === null ? null : \`${pending.character}:${pending.status}\`` |
| effect 끝 | `metricsRef`·`lastDistanceRef`·`prevIdsRef` 갱신 |
| `onScroll()` | 측정 기록·`lastDistanceRef` 갱신 → `isNearTop` && `canAutoLoadOlder` → `onReachTop()` · `isNearBottom` → `onReachBottom()` |
| `scrollToBottom()` | `el.scrollTop = el.scrollHeight` 후 측정 기록 |

- 앞·뒤가 한 번에 바뀌면 앞붙임 보정 → 뒤붙임 판정 순서로 둘 다 적용한다.
- S2 메시지 삭제로 `lastId`가 줄거나 `firstId`가 커지는 경우는 어느 분기에도 걸리지 않는다(스크롤 그대로). 수정은 id가 바뀌지 않아 effect가 돌지 않는다.
- 애니메이션 없음. `IntersectionObserver` 미사용. 훅은 메시지 타입을 모른다 → 화면 비종속.

---

## 4. 스타일 토큰

| 대상 | 토큰(`.claude/skills/ui_design_concept.md`) |
|---|---|
| 배경 | `--color-bg`. 상단 바 아래·D 위·C 위 1px `--color-border` |
| 방 제목 | serif lg(16px) `--color-fg`, 한 줄 말줄임 |
| 생성일 | `--font-ui` xs `--color-fg-muted`, `tabular-nums` |
| 시엘 말풍선 | 배경 `--bubble-ciel-bg`, 글자 `--bubble-ciel-fg`, 이름 `--bubble-ciel-accent`, 1px `--color-border` |
| 세바스찬 말풍선 | `--bubble-sebastian-bg` · `-fg` · `-accent`, 1px `--color-border` |
| 유저 말풍선 | 배경 `--bubble-user-bg`, 본문 `--color-fg`, 작성자명 `--bubble-user-fg` |
| OOC | `--bubble-ooc-fg`, sm, 배경 없음 |
| 말풍선 공통 | 반경 `--radius-lg`, 패딩 `--space-3`, 말풍선 사이 `--space-2`, 최대 폭 `--bubble-max-width` |
| 아바타 | 28px 원형 |
| 시각·B0 | `--font-ui` xs/sm, `--color-fg-muted` |
| D 열람 안내 | sm `--color-info` |
| 배지 | Button sm primary, info 톤 |
| (S2) C 하단 바 | 배경 `--color-bg`, 위 1px `--color-border`, padding `--space-2` `--space-4`, 96~136px |
| (S2) 입력창·인라인 수정 | TextArea `--input-*` |
| (S2) E 알림 줄 | Toast(rooms components.md §1.18), C·D 바로 위 in-flow |
| (S2) 시트 | `--sheet-*`, 덮개 `--color-overlay`, `--z-sheet`. 머리 줄 40px sm muted 한 줄 말줄임 |
| (S2) 화면 루트 | `.root { position: relative }`(BottomSheet 덮개 기준) |
| 화면 좌우 여백 | `--space-4` |
| (v1.6) 배치 | 세바스찬 왼쪽 · 시엘 오른쪽(row-reverse) · 유저 가운데 말풍선 · OOC 가운데 한 줄(§2.2) |
| (S3) 캐릭터 버튼 | Button md secondary(`--btn-*`), 1행 왼쪽 `gap: var(--space-2)`. 비활성 글자 `--color-fg-disabled`(Button 기본) |
| (S3) 임시 말풍선 | 캐릭터 말풍선 모양 그대로(`Bubble.module.css` 클래스를 import해 같은 DOM 구조에 사용 — `composes` 아님, §2.12. 색 `--bubble-{c}-bg`). `…` 글자 `--bubble-pending-fg`(기존 전역 변수) |
| (S3) 실패 말풍선 | 본문 테두리 1px `--bubble-error-border`(기존 전역 변수), 문구 sm `--color-fg`, `!` 기호 `--color-danger`, 「재시도」 Button sm secondary(문구 아래, 말풍선 안쪽 정렬 — 세바스찬 왼쪽·시엘 오른쪽) |
| (S3) 재작성 중 | 본문 `opacity: var(--bubble-busy-opacity)` · 머리 줄 `다시 쓰는 중…` xs `--color-fg-muted`. **신규 전역 변수** `--bubble-busy-opacity: 0.55`를 `global.css` `:root`의 `--bubble-*` 묶음에 더한다(색이 아닌 값이지만 하드코딩하지 않는다) |
| (S3) 파일 | `SpeakButtons.module.css` · `PendingBubble.module.css`(상태·보조 클래스 `pending`·`failed`·`bodyBox`·`dots`·`errorText`·`errorMark`·`retryRow`·`srOnly`만. 모양 클래스는 `Bubble.module.css` import. 본문은 `div.body.bodyBox`, v1.7.1). `Composer.module.css`의 `toggleRow` → `topRow`. `Bubble.module.css`에 `regenerating`·`regeneratingNote` |
| 컴포넌트 변수 값 | `--bubble-user-bg: var(--color-bg-elevated)` · `--bubble-max-width: 78%`(폭 ≤ 360px에서 85%, 캐릭터) · `--bubble-user-max-width: 86%`(v1.6, 유저·OOC·모든 폭) — `global.css`. S2 추가분은 rooms components.md §1.20 |
| (S3e) 버튼 줄 | `BubbleActions.module.css` — AC §1 스타일 표(정렬·`--space-1`·보조색 `--color-fg-muted`·삭제 `--color-danger`). `Bubble.module.css` `.menuEnabled` 삭제 |
| 파일 | `ui/src/chat/styles/ChatScreen.module.css`, 컴포넌트별 `{Name}.module.css`. 하드코딩 색 금지 |

- 아바타 파일 `ui/public/img/ciel.png`·`sebastian.png`. 경로는 `CHARACTERS.*.avatar`(`/embed/img/{id}.png`).
- `prefers-reduced-motion: reduce`면 B0·배지·시트 모션 0ms(ui_design_concept §8).
