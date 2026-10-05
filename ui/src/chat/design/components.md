# chat 상세 설계 — 컴포넌트·훅·스타일 (분할 문서)

> 주 문서: `ui/src/chat/design.md`(RTM 포함). 이 파일은 주 문서 §3·§11의 상세다.
> **export 규칙(공통, v1.3):** 모든 컴포넌트·훅·순수 함수는 **named export**만 쓴다. `export default` 금지. 대상: `ChatScreen`, `ChatTopBar`, `MessageList`, `Bubble`·`bubbleVariantOf`, `InlineStatus`, `NewMessageBadge`, `ReadOnlyNotice`, `useAutoScroll`, `useChatLoader`, `useScrollMemory`, (S2) `Composer`·`InlineEditor`·`MessageMenuSheet`·`RoomMenuSheet`·`ChatSheets`·`useMessageWrites`·`useRoomActions`, `chatReducer`·`initialChatState` 외 `ui/src/state/chat.ts`·`scroll.ts`의 함수와 상수, `labels`. Props 타입은 `export type {Name}Props`. 규칙 원문은 `ui/src/rooms/design/components.md` 머리말.

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
useLongPress({ onLongPress, delayMs? = 500 }) => { onPointerDown, onPointerMove, onPointerUp, onPointerLeave,
                                                    onPointerCancel, onContextMenu }           // §1.19
formatMonthDay(ms): 'MM.DD' · formatTime(ms): 'HH:mm' · toIsoDate(ms) · toIsoDateTime(ms)   // 로컬 시간대
loadLastRoomId() · saveLastRoomId(id) · clearLastRoomId()
loadScrollOffset(roomId): number | null · saveScrollOffset(roomId, distanceFromBottom): void  // try/catch, throw 없음
Viewer = { readonly canWrite: boolean } · READ_ONLY_VIEWER · WRITER_VIEWER
MESSAGE_TEXT_MAX_CHARS = 2000 · ROOM_TITLE_MAX_CHARS = 60 · countChars(v) · isMessageTextValid(v) · isRoomTitleValid(v)  // §1.11
toastToneOf(error): 'warning' | 'danger'                                                       // rooms F-RM-22
```

chat 사용: TopBar `variant='room'`, IconButton `back`·(S2)`more`, StateView(첫 로드 3상태), Button(B0 「다시 시도」 sm secondary · 배지 sm primary · (S2) 전송 md primary · 인라인 수정 취소/저장 sm), (S2) TextArea(입력창·인라인 수정), Toggle(OOC), BottomSheet+SheetItem(말풍선 메뉴·방 메뉴), ConfirmDialog(메시지·방 삭제), PromptSheet(이름 변경), Toast(E 줄), useLongPress(Bubble), useToast.

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
  onOpenMenu?: (message: Message) => void    // 쓰기 가능일 때만. 없으면 말풍선 메뉴 핸들러 없음
  editingId: number | null                   // 인라인 수정 중인 메시지. 읽기 전용이면 호출 쪽이 항상 null 을 넘긴다(v1.5, F-CH-11)
  isEditSaving: boolean                      // state.writing?.kind === 'edit'
  onSaveEdit: (messageId: number, text: string) => void
  onCancelEdit: () => void
}
```
- 렌더: 래퍼 `<div class=wrap>`(`position: relative; flex: 1; min-height: 0`) 안에
  1. 스크롤 박스 `<div ref={containerRef} role="log" aria-live="polite" aria-busy={isLoadingOlder} aria-label={labels.historyAriaLabel} tabIndex={0} onScroll={onScroll}>`(`overflow-y: auto; height: 100%`)
     - 맨 위: 지역 컴포넌트 `OlderStatus`(소급) — `isLoadingOlder` → `InlineStatus kind='loading' message={labels.olderLoading}`. 아니고 `olderError` → `InlineStatus kind='error' message={labels.olderError} actionLabel={labels.retry} onAction={onRetryOlder}`. 둘 다 아니면 없음.
     - `<ol>` → `messages.map(m => <li key={m.id}>{m.id === editingId ? <InlineEditor message={m} isSaving={isEditSaving} onSave={text => onSaveEdit(m.id, text)} onCancel={onCancelEdit} /> : <Bubble message={m} onOpenMenu={onOpenMenu} />}</li>)`.
  2. `unseenCount > 0`이면 `NewMessageBadge label={labels.newMessages} ariaLabel={labels.newMessagesAriaLabel} onClick={onShowNewest}`(스크롤 박스 밖, `position: absolute; right: var(--space-4); bottom: var(--space-2)`).
- `Bubble`은 `React.memo`. key는 서버 id. `onOpenMenu`는 ChatScreen의 `useCallback` 참조라 말풍선이 다시 그려지지 않는다.

### 2.2 Bubble

```ts
export type BubbleProps = {
  message: Message
  onOpenMenu?: (message: Message) => void    // S2. 없으면(읽기 전용) 아래 메뉴 핸들러·tabIndex 를 붙이지 않는다
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
| `user` | **가운데**(말풍선) | 작성자명 → 시각 → 본문 | 머리 줄 가운데 정렬, 화면 순서 "작성자명 · 시각"(row-reverse 없음). 작성자명 `authorName ?? labels.unknownAuthor`(sm `--bubble-user-fg`) · 시각(xs). 본문 serif base, 배경 `--bubble-user-bg` 말풍선, 반경 `--radius-lg`, 최대 폭 `--bubble-user-max-width`(86%), 아바타 없음. S2 새 발화의 `authorName`은 응답 값 그대로(R-AUTH-004) |
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
| `menuEnabled` (S2) | `onOpenMenu`가 있을 때 | `-webkit-touch-callout: none`, 포커스 링 |

  - 조합: 세바스찬 `character sebastian` · 시엘 `character ciel` · 유저 `user` · OOC `ooc`(speaker가 캐릭터여도 캐릭터 키 없음). 쓰기 가능이면 넷 모두에 `menuEnabled`가 더 붙는다. 캐릭터는 `cx(styles.root, styles.character, styles[variant], onOpenMenu && styles.menuEnabled)`.
  - 정렬은 캐릭터별 키(`sebastian`·`ciel`)가 결정한다. 테스트는 `toHaveClass('sebastian')`(왼쪽)·`toHaveClass('ciel')`(오른쪽)·`toHaveClass('user')`·`toHaveClass('ooc')`로 배치를 단언한다(non-scoped).
- 본문은 **일반 텍스트**(React 이스케이프). `dangerouslySetInnerHTML`·마크다운 해석 금지. `white-space: pre-wrap; overflow-wrap: anywhere`.
- **메뉴 핸들러(S2).** `BubbleView`는 `useLongPress({ onLongPress: () => onOpenMenu?.(message) })`를 **항상** 호출한다(Hook 규칙). `onOpenMenu`가 있을 때만 루트에 `{...longPressHandlers}` · `tabIndex={0}` · `aria-haspopup="dialog"` · `aria-keyshortcuts="Shift+F10"` · `onKeyDown`(Shift+F10 또는 `key === 'ContextMenu'` → `preventDefault()` 후 `onOpenMenu(message)`)를 붙인다. 없으면 아무것도 붙이지 않는다(우클릭은 브라우저 기본 동작, 주 문서 §10).

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
}
```
- 로컬 상태: `text`(초기 `''`), `ooc`(초기 `false`). `textareaRef`.
- `sendable = canSend && !isSending && isMessageTextValid(text)`.
- `submit()`: `sendable`이 아니면 종료 → `const saved = await onSend(text, ooc)` → `saved`면 `setText('')`(OOC 토글 값은 그대로 둔다) → `textareaRef.current?.focus()`. 실패면 입력을 그대로 둔다.
- 렌더: `<div role="group" aria-label={labels.composerAriaLabel} aria-busy={isSending} class=composer>`(위 1px `--color-border`, 배경 `--color-bg`, padding `--space-2` `--space-4`, 행 사이 `--space-2`)
  - 1행(36px, `justify-content: space-between`): **왼쪽 = 캐릭터 버튼 자리(S3, 미렌더 — 요소 없음)** · 오른쪽 `Toggle isOn={ooc} onChange={setOoc} onLabel={labels.oocOn} offLabel={labels.oocOff} ariaLabel={labels.oocAriaLabel}`
  - 2행(36~76px): `TextArea`(flex 1) `value={text}` `onChange={setText}` `ariaLabel={labels.inputAriaLabel}` `placeholder={labels.inputPlaceholder}` `maxRows={3}` `maxChars={MESSAGE_TEXT_MAX_CHARS}` `counterMode='overflow'` `onEnter={submit}` `isReadOnly={isSending}` `textareaRef` + `Button variant='primary' size='md' isDisabled={!sendable} onClick={submit}` → `labels.send`
- 총 높이 96~136px. 높이 ≤ 480이면 1줄 고정(TextArea §1.13).
- 입력 중 다른 쓰기(수정 저장·삭제) 진행 중이면 `canSend=false`라 전송만 잠기고 타이핑은 된다. 전송 중에는 `readOnly`로 편집도 막는다(성공 시 비울 내용이 바뀌지 않게).

### 2.7 InlineEditor (인라인 수정) — S2, 구성안 §2 "말풍선 자리 textarea + 취소/저장"

```ts
export type InlineEditorProps = {
  message: Message
  isSaving: boolean
  onSave: (text: string) => void
  onCancel: () => void
}
```
- 로컬 상태: `text`(초기 `message.text`). `canSave = !isSaving && isMessageTextValid(text) && text !== message.text`.
- 렌더: `<div role="group" aria-label={labels.editAriaLabel} class={cx(editor, variantClass)}>` — 정렬은 원래 말풍선 변형과 같다(v1.6: `sebastian` 왼쪽 · `ciel` 오른쪽 · `user`·`ooc` 가운데. 폭은 캐릭터 `--bubble-max-width`, 유저·OOC `--bubble-user-max-width`). 클래스는 `cx(styles.editor, styles[bubbleVariantOf(message)])`. 안: `TextArea value onChange ariaLabel={labels.editInputAriaLabel} maxRows={6} maxChars={MESSAGE_TEXT_MAX_CHARS} counterMode='overflow' onEscape={isSaving ? undefined : onCancel} isReadOnly={isSaving}` + 버튼 줄(오른쪽 정렬) `Button sm secondary isDisabled={isSaving}` 취소 · `Button sm primary isDisabled={!canSave}` 저장.
- Enter는 줄바꿈이다(`onEnter` 없음). 저장은 버튼으로만.
- 마운트 `useLayoutEffect([])`: 입력에 포커스, 커서를 끝으로(`setSelectionRange(len, len)`).

### 2.8 MessageMenuSheet (말풍선 메뉴) — S2, 구성안 §2-1

```ts
export type MessageMenuSheetProps = {
  message: Message
  isWriteBusy: boolean          // state.writing !== null
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}
```
- 렌더: `BottomSheet ariaLabel={labels.messageMenuAriaLabel} header={<p class=menuHeader>{labels.messageMenuHeader(nameOf(message), formatTime(message.createdAt), excerptOf(message.text))}</p>} onClose={onClose}` 안에
  1. `SheetItem label={labels.edit} onSelect={onEdit} isDisabled={isWriteBusy}`
  2. (재작성 — **S3, 미렌더**. 자리는 수정과 삭제 사이)
  3. `SheetItem label={labels.delete} tone='danger' onSelect={onDelete} isDisabled={isWriteBusy}`
  4. `SheetItem label={labels.cancel} onSelect={onClose}`
- `nameOf(m)`: 변형 `sebastian`·`ciel` → `CHARACTERS[variant].shortName` · `user` → `authorName ?? labels.unknownAuthor` · `ooc` → `labels.oocPrefix`. `excerptOf(text)`: 코드 포인트 20자 넘으면 앞 20자 + `…`. 둘 다 이 파일 지역 함수.
- 약 188px(머리 40 + 항목 44×3 + 여백 16). S3에서 재작성 항목이 들어오면 약 232px로 구성안 §2-1 높이와 같아진다.

### 2.9 RoomMenuSheet (⋯ 방 메뉴) — S2, 구성안 §2-2

```ts
export type RoomMenuSheetProps = { roomTitle: string; onRename: () => void; onDelete: () => void; onClose: () => void }
```
- 렌더: `BottomSheet ariaLabel={labels.roomMenuAriaLabel} header={<p class=menuHeader>{labels.roomMenuHeader(roomTitle)}</p>} onClose={onClose}` 안에 `SheetItem` 이름 변경 → (장기기억 — **S4, 미렌더**. 자리는 이름 변경과 방 삭제 사이) → 방 삭제(`danger`) → 취소.

### 2.10 ChatSheets (시트 스위치) — S2

```ts
export type ChatSheet =
  | { kind: 'messageMenu'; message: Message }
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
  onStartEdit: (message: Message) => void
  onAskDeleteMessage: (message: Message) => void
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
| `messageMenu` | `MessageMenuSheet message isWriteBusy={writing !== null} onEdit={() => onStartEdit(m)} onDelete={() => onAskDeleteMessage(m)} onClose` |
| `confirmDeleteMessage` | `ConfirmDialog title={labels.deleteMessageTitle} message={labels.deleteMessageBody} confirmLabel={labels.delete} cancelLabel={labels.cancel} onConfirm={() => onConfirmDeleteMessage(m)} onCancel={onClose} isBusy={writing?.kind === 'delete'}` |
| `roomMenu` | `RoomMenuSheet roomTitle={room.title} onRename={onAskRename} onDelete={onAskDeleteRoom} onClose` |
| `rename` | `PromptSheet title={labels.renameTitle} inputAriaLabel={labels.renameInputAriaLabel} initialValue={room.title} maxChars={ROOM_TITLE_MAX_CHARS} canSave={v => isRoomTitleValid(v) && v.trim() !== room.title} saveLabel={labels.save} cancelLabel={labels.cancel} onSave={onSaveRename} onCancel={onClose} isBusy={roomBusy === 'rename'} errorText={sheet.errorText}` |
| `confirmDeleteRoom` | `ConfirmDialog title={labels.deleteRoomTitle} message={labels.deleteRoomBody} confirmLabel={labels.delete} cancelLabel={labels.cancel} onConfirm={onConfirmDeleteRoom} onCancel={onClose} isBusy={roomBusy === 'delete'}` |

- ChatScreen이 `viewer.canWrite && sheet !== null`일 때만 이 컴포넌트를 렌더한다.

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
| 컴포넌트 변수 값 | `--bubble-user-bg: var(--color-bg-elevated)` · `--bubble-max-width: 78%`(폭 ≤ 360px에서 85%, 캐릭터) · `--bubble-user-max-width: 86%`(v1.6, 유저·OOC·모든 폭) — `global.css`. S2 추가분은 rooms components.md §1.20 |
| 파일 | `ui/src/chat/styles/ChatScreen.module.css`, 컴포넌트별 `{Name}.module.css`. 하드코딩 색 금지 |

- 아바타 파일 `ui/public/img/ciel.png`·`sebastian.png`. 경로는 `CHARACTERS.*.avatar`(`/embed/img/{id}.png`).
- `prefers-reduced-motion: reduce`면 B0·배지·시트 모션 0ms(ui_design_concept §8).
