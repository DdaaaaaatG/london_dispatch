# chat 상세 설계 — 상태·기능 명세 (분할 문서)

> 주 문서: `ui/src/chat/design.md`(RTM 포함). 이 파일은 주 문서 §4·§5의 상세다.
> 컴포넌트·훅 시그니처는 `design/components.md`.

---

## 1. 대화 상태 — `ui/src/state/chat.ts` (순수, React·DOM 의존 없음)

```ts
export type MessageWrite =                         // S2: 진행 중인 메시지 쓰기(한 번에 하나)
  | { readonly kind: 'send' }
  | { readonly kind: 'edit'; readonly messageId: number }
  | { readonly kind: 'delete'; readonly messageId: number }

export type ChatState = {
  readonly phase: 'loading' | 'error' | 'ready'    // 첫 페이지 상태
  readonly error: ApiError | null                  // phase==='error' 일 때만 값
  readonly messages: readonly Message[]            // id 오름차순, id 중복 없음
  readonly hasMore: boolean
  readonly isLoadingOlder: boolean
  readonly olderError: ApiError | null
  readonly unseenCount: number                     // 위를 보는 중 도착한 새 메시지 수
  readonly writing: MessageWrite | null            // S2
  readonly editingId: number | null                // S2: 인라인 수정 중인 메시지 id
}
export const initialChatState: ChatState = {
  phase: 'loading', error: null, messages: [], hasMore: false, isLoadingOlder: false,
  olderError: null, unseenCount: 0, writing: null, editingId: null,
}

export type ChatAction =
  | { type: 'initialLoadStarted' }
  | { type: 'initialLoadSucceeded'; page: MessagesPage }
  | { type: 'initialLoadFailed'; error: ApiError }
  | { type: 'olderLoadStarted' }
  | { type: 'olderLoadSucceeded'; page: MessagesPage }
  | { type: 'olderLoadFailed'; error: ApiError }
  | { type: 'messagesAppended'; messages: readonly Message[]; isNearBottom: boolean }  // S2: 전송 성공이 발생 경로
  | { type: 'unseenCleared' }
  // ── S2 ──
  | { type: 'writeStarted'; write: MessageWrite }
  | { type: 'writeFinished' }                      // 성공·실패 공통 잠금 해제
  | { type: 'messageReplaced'; message: Message }  // 수정 성공
  | { type: 'messageRemoved'; messageId: number }  // 삭제 성공(또는 NOT_FOUND)
  | { type: 'editStarted'; messageId: number }
  | { type: 'editCancelled' }
  | { type: 'writeAccessRevoked' }                 // 읽기 전용 전환

export const chatReducer = (state: ChatState, action: ChatAction): ChatState
```

- `ApiError`는 `@/api`, `Message`·`MessagesPage`는 `@shared/types`에서 type import.
- 비유: `writing`은 방 문 앞의 "사용 중" 팻말이다. 팻말이 걸려 있는 동안은 다른 메시지 쓰기(전송·수정 저장·삭제)를 시작하지 않는다. 응답이 오면 팻말을 내린다.

### 1.1 전이표 (각 행 vitest ≥1). "그대로" = 같은 객체 참조를 돌려준다

| # | 액션 | 조건 | 다음 상태 |
|---|---|---|---|
| T1 | `initialLoadStarted` | 항상 | `initialChatState`(S2 필드도 초기값). 첫 로드·재시도는 ready 전이라 쓰기가 없다. S2에서는 마지막 메시지 삭제 뒤 재로드(F-CH-23)로 **ready에서도** 일어난다. 이때는 `writeFinished` 뒤라 `writing`은 이미 null이고, `editingId`·`unseenCount`도 초기화된다(의도) |
| T2 | `initialLoadSucceeded` | 항상 | `{ ...initialChatState, phase: 'ready', messages: mergeMessages([], page.messages), hasMore: page.hasMore }` |
| T3 | `initialLoadFailed` | 항상 | `{ ...initialChatState, phase: 'error', error }` |
| T4 | `olderLoadStarted` | `canLoadOlder(state)` | `isLoadingOlder=true`, `olderError=null` |
| T5 | `olderLoadStarted` | 아니면 | 그대로 |
| T6 | `olderLoadSucceeded` | `isLoadingOlder` | `messages=mergeMessages(state.messages, page.messages)`, `hasMore = page.messages.length === 0 ? false : page.hasMore`, `isLoadingOlder=false` |
| T7 | `olderLoadSucceeded`·`olderLoadFailed` | `!isLoadingOlder` | 그대로 |
| T8 | `olderLoadFailed` | `isLoadingOlder` | `isLoadingOlder=false`, `olderError=action.error` |
| T9 | `messagesAppended` | `phase==='ready'` | `messages=mergeMessages(state.messages, action.messages)`. `added` = 기존 마지막 id(없으면 0)보다 큰 새 id 개수. `unseenCount = isNearBottom ? 0 : unseenCount + added` |
| T10 | `messagesAppended` | `phase!=='ready'` | 그대로 |
| T11 | `unseenCleared` | `unseenCount > 0` | `unseenCount=0` |
| T12 | `unseenCleared` | `unseenCount === 0` | 그대로 |
| T13 | `writeStarted` | `phase==='ready' && writing===null` | `writing=action.write` |
| T14 | `writeStarted` | 아니면 | 그대로(거절. 호출 쪽은 `getState().writing`으로 먼저 확인한다) |
| T15 | `writeFinished` | `writing!==null` | `writing=null` |
| T16 | `writeFinished` | `writing===null` | 그대로 |
| T17 | `messageReplaced` | 같은 id가 `messages`에 있음 | 그 원소만 `action.message`로 바꾼 새 배열(순서 유지). `editingId === id`면 `editingId=null` |
| T18 | `messageReplaced` | 없음 | 그대로 |
| T19 | `messageRemoved` | 같은 id가 있음 | 그 원소를 뺀 새 배열. `editingId === id`면 `editingId=null` |
| T20 | `messageRemoved` | 없음 | 그대로 |
| T21 | `editStarted` | `phase==='ready' && writing===null` && 같은 id가 있음 | `editingId=action.messageId`(다른 메시지를 수정 중이었으면 바뀐다) |
| T22 | `editStarted` | 아니면 | 그대로 |
| T23 | `editCancelled` | `editingId!==null && writing?.kind !== 'edit'` | `editingId=null` |
| T24 | `editCancelled` | 아니면(수정 중 아님 · 저장 요청 중) | 그대로 |
| T25 | `writeAccessRevoked` | `writing!==null \|\| editingId!==null` | `writing=null`, `editingId=null` |
| T26 | `writeAccessRevoked` | 둘 다 null | 그대로 |

### 1.2 같은 파일의 순수 함수

| 함수 | 시그니처 | 규칙 |
|---|---|---|
| `mergeMessages` | `(current, incoming) => Message[]` | id 기준 합집합. 같은 id는 `incoming`이 이긴다. id 오름차순. 입력을 바꾸지 않는다 |
| `canLoadOlder` | `(s) => boolean` | `phase==='ready' && hasMore && !isLoadingOlder && messages.length > 0` |
| `canAutoLoadOlder` | `(s) => boolean` | `canLoadOlder(s) && olderError === null` |
| `nextBefore` | `(s) => number \| null` | `hasMore ? (messages[0]?.id ?? null) : null`(S1 실물 표기, 의미 동일) |
| `canSend` (S2) | `(s) => boolean` | `phase==='ready' && writing===null` |

- 낙관적 갱신 없음. 쓰기 결과는 응답을 받은 뒤 T9·T17·T19로만 반영한다(ui-design-strategy §6.5).

---

## 2. 스크롤 계산 — `ui/src/state/scroll.ts` (순수, S2 변경 없음)

```ts
export const TOP_THRESHOLD_PX = 80
export const BOTTOM_THRESHOLD_PX = 120
export type ScrollMetrics = { scrollTop: number; scrollHeight: number; clientHeight: number }
export const distanceFromBottom = (m: ScrollMetrics): number   // max(0, scrollHeight - scrollTop - clientHeight)
export const isNearTop = (m: ScrollMetrics): boolean           // scrollTop <= 80
export const isNearBottom = (m: ScrollMetrics): boolean        // distanceFromBottom(m) <= 120
export const anchorScrollTop = (prev: ScrollMetrics, nextScrollHeight: number): number
export const restoreScrollTop = (m: Pick<ScrollMetrics, 'scrollHeight' | 'clientHeight'>, saved: number | null): number
```

---

## 3. ChatScreen 로컬 상태 (`ui/src/chat/index.tsx`)

| 상태 | 용도 | 타입 | 초기값 | 소유 |
|---|---|---|---|---|
| `state` | 대화 상태 | `ChatState` | `initialChatState` | **`useChatLoader` 내부** `useReducer`. 훅이 `state`·`dispatch`·`getState`·`isActive`를 돌려준다(S2) |
| `stateRef` | 최신 상태 읽기 | `MutableRefObject<ChatState>` | `initialChatState`, 매 렌더 `useLayoutEffect`로 갱신 | `useChatLoader` 내부(소급: layout effect) |
| `isActiveRef` | 언마운트 뒤 응답 무시 | `MutableRefObject<boolean>` | `false` → 활성 **`useLayoutEffect`**가 마운트 시 `true`, cleanup `false`(소급: ChatScreen 마운트 layout effect의 첫 로드보다 먼저 켜져야 한다) | `useChatLoader` 내부 |
| `olderInFlightRef` | 이전 페이지 중복 방지 | `MutableRefObject<boolean>` | `false` | `useChatLoader` 내부 |
| `initialDistance` | 복원할 스크롤 거리 | `number \| null` | `useState(() => loadScrollOffset(room.id))` | ChatScreen |
| `backButtonRef` | 마운트·전환 시 포커스 대상 | `RefObject<HTMLButtonElement>` | `null` | ChatScreen |
| `autoScroll` | 스크롤 제어 | `UseAutoScrollResult` | `useAutoScroll({ firstId, lastId, initialDistanceFromBottom: initialDistance, canAutoLoadOlder: canAutoLoadOlder(state), onReachTop: loadOlder, onReachBottom: clearUnseen })` | 훅 |
| `sheet` (S2) | 열린 시트 | `ChatSheet \| null`(components.md §2.10) | `null` | ChatScreen `useState` |
| `toast` (S2) | E 알림 줄 | `ToastState` | `null` | `useToast()` |
| `menuButtonRef` (S2) | ⋯ 포커스 복귀 | `RefObject<HTMLButtonElement>` | `null` | ChatScreen |
| `writeInFlightRef` (S2) | 같은 틱 연타 방지(전송 Enter 연타 등) | `MutableRefObject<boolean>` | `false` | `useMessageWrites` 내부 |
| `roomBusy` (S2) | 방 이름 변경·삭제 요청 중 | `'rename' \| 'delete' \| null` | `null` | `useRoomActions` 내부 `useState` + 같은 값의 ref(같은 틱 중복 방지) |
| `wasWritableRef` (S2) | 전환 감지(이전 `canWrite`) | `MutableRefObject<boolean>` | `viewer.canWrite` | ChatScreen |
| `revokedRef` (v1.5) | 인증 실패 처리 1회 보장(F-CH-16 멱등) | `MutableRefObject<boolean>` | `false` | ChatScreen |

- `firstId = state.messages[0]?.id ?? null`, `lastId = state.messages[state.messages.length - 1]?.id ?? null`.
- 방 정보는 props `room`(rooms 목록·생성 응답·이름 변경 응답). 토큰 값은 모른다 — `viewer.canWrite`만 본다.
- 방이 바뀌면 `App`이 `key={room.id}`로 새로 마운트한다. 이름 변경은 같은 id라 다시 마운트되지 않는다.

---

## 4. 기능 명세 (function 단위)

### 4.1 S1 (실물 소급 반영)

| # | 시그니처 | 입력 | 출력·상태 변경 | 동작 | 예외·분기 | 요구ID |
|---|---|---|---|---|---|---|
| F-CH-01 | `ChatScreen(props: ChatScreenProps): JSX.Element` | `{ room: RoomSummary; viewer: Viewer; onBack: () => void; onAuthFailure: () => void; onRoomRenamed: (room: RoomSummary) => void }`(뒤 둘 S2) | 주 문서 §2 렌더 | `<main className=root aria-label={labels.screenAriaLabel(room.title)}>` → `ChatTopBar room onBack={back} backButtonRef onOpenMenu={viewer.canWrite ? openRoomMenu : undefined} menuButtonRef isMenuDisabled={state.writing !== null || roomBusy !== null}` → `<section className=history>{renderHistory(…)}</section>` → `toast && <Toast key={toast.id} …/>`(E) → `viewer.canWrite ? <Composer canSend={canSend(state)} isSending={state.writing?.kind === 'send'} onSend={send} /> : <ReadOnlyNotice text={labels.readOnlyNotice} />` → `viewer.canWrite && sheet && <ChatSheets …/>` | 읽기 전용이면 ⋯·C·시트·말풍선 메뉴 없음(주 문서 §10). `onAuthFailure`·`onRoomRenamed`는 **필수 props**(선택 아님, v1.5). S1 스펙(기존 테스트)은 빈 콜백 `() => {}`을 넘긴다(메인 세션 승인) | R-CHAT-001 · 002 · 004 · 008 · 013 |
| F-CH-02 | 마운트 **`useLayoutEffect([room.id, loadInitial])`**(소급) | — | 기록·포커스·첫 로드 | `saveLastRoomId(room.id)` → `backButtonRef.current?.focus()` → `void loadInitial()`. layout effect인 이유: 자동 진입은 비동기 콜백에서 커밋되어 패시브 effect가 한 박자 늦을 수 있다. `room.id`·`loadInitial`은 마운트 동안 바뀌지 않으므로 1회 | 저장 실패는 storage가 삼킨다 | R-CHAT-010 · R-ROOMS-004 |
| F-CH-03 | `loadInitial(): Promise<void>` (useChatLoader) | — | T1 → T2/T3 | `dispatch(initialLoadStarted)` → `await listMessages(roomId)` → 비활성이면 종료 → 성공/실패 dispatch | 래퍼는 throw 없음 | R-CHAT-002 · 003 |
| F-CH-04 | `retryInitial(): void` | — | `loadInitial()` | 첫 로드 오류 「다시 시도」 | — | R-CHAT-003 |
| F-CH-05 | `loadOlder(): Promise<void>` (useChatLoader) | — | T4 → T6/T8 | `current = stateRef.current` → `before = nextBefore(current)` → `olderInFlightRef`·`!canLoadOlder(current)`·`before === null`이면 종료 → in-flight true → `olderLoadStarted` → `await listMessages(roomId, { before })` → in-flight false → 비활성이면 종료 → dispatch | 스크롤 보정은 useAutoScroll | R-CHAT-003 |
| F-CH-06 | `retryOlder(): void` | — | `loadOlder()` | B0 오류 「다시 시도」 | — | R-CHAT-003 |
| F-CH-07 | `clearUnseen(): void` | — | T11/T12 | `useAutoScroll onReachBottom` | — | R-CHAT-003 |
| F-CH-08 | `showNewest(): void` | — | 스크롤 + T11 | `scrollToBottom()` → `clearUnseen()` | — | R-CHAT-003 |
| F-CH-09 | `useScrollMemory(roomId, getDistanceFromBottom): void` (`ui/src/chat/useScrollMemory.ts`, 소급 분리) | — | 저장소 기록 | `useEffect([roomId, getDistanceFromBottom])`: `save` = 거리가 null이 아니면 `saveScrollOffset`. `pagehide`에 등록, cleanup에서 해제 후 `save()` 1회 | 배치 전이면 저장 안 함 | R-CHAT-010 |
| F-CH-10 | `back(): void` | — | `clearLastRoomId()` → `onBack()` | ‹ 버튼 | 삭제 실패해도 `onBack()` | R-CHAT-001 · R-ROOMS-004 · R-CHAT-010 |
| F-CH-11 | `renderHistory(props: HistoryProps): JSX.Element` (지역 함수, 소급: props 객체) | `{ state, containerRef, onScroll, onRetryInitial, onRetryOlder, onShowNewest, onOpenMenu?, onSaveEdit, onCancelEdit }` | 히스토리 영역 | error(`detail = errorDetail(state.error?.code ?? 'INTERNAL')`) → loading → `messages.length > 0`이면 `MessageList`(S2 props: `onOpenMenu`·`editingId={viewer.canWrite ? state.editingId : null}`(v1.5: 전환 커밋에서 편집기가 남지 않게)·`isEditSaving={state.writing?.kind === 'edit'}`·`onSaveEdit`·`onCancelEdit`) → empty | — | R-CHAT-002 · 003 · 007 |
| F-CH-12 | `chatReducer` 외 순수 함수 | §1 | §1 | §1.1 · §1.2 | — | R-CHAT-003 · 006 · 007 · 011 |
| F-CH-13 | `scroll.ts` | §2 | §2 | §2 | — | R-CHAT-003 · 010 |
| F-CH-14 | `useAutoScroll(options)` | components.md §3 | components.md §3 | components.md §3 | — | R-CHAT-003 · 006 · 010 |
| F-CH-15 | `bubbleVariantOf(m)` | `Message` | `BubbleVariant` | components.md §2.2 | — | R-CHAT-002 |

- `useChatLoader(roomId) => { state, dispatch, getState, isActive, loadInitial, retryInitial, loadOlder, retryOlder, clearUnseen }`(S2: `dispatch: Dispatch<ChatAction>` · `getState = () => stateRef.current` · `isActive = () => isActiveRef.current` 추가).

### 4.2 S2 — 쓰기

비유: 쓰기 요청은 접수 창구 하나로만 들어간다. 창구가 바쁘면(`writing`) 다음 손님은 버튼이 잠겨 기다린다. 창구가 "출입증이 없다"고 돌려보내면(인증 실패) 그 자리에서 쓰기 창구가 닫히고 열람실만 남는다.

| # | 시그니처(위치) | 입력 | 출력·상태 변경 | 동작 | 예외·분기 | 요구ID |
|---|---|---|---|---|---|---|
| F-CH-16 | `handleWriteFailure(error: ApiError, action: WriteAction): void` (ChatScreen) | 실패, `WriteAction = 'send' \| 'editMessage' \| 'deleteMessage' \| 'renameRoom' \| 'deleteRoom'` | 전환·토스트 | `isAuthFailure(error)`면: `revokedRef.current`가 true면 **아무것도 하지 않는다**(멱등, v1.5). 아니면 `revokedRef.current = true` → `onAuthFailure()`(App F-RM-12) → 전환 안내 토스트. 그 밖 코드면 `showToast(labels.writeErrorText(error, action), toastToneOf(error))`. `revokedRef`는 ChatScreen `useRef(false)` | 이름 변경의 비인증 실패는 여기로 오지 않는다(F-CH-26) | R-CHAT-011 |
| F-CH-17 | `send(text: string, ooc: boolean): Promise<boolean>` (`useMessageWrites`) | 입력값·토글 | 저장 여부 | `writeInFlightRef`가 true이거나 `!canSend(getState())`이거나 `!isMessageTextValid(text)`면 `false`. in-flight true → `dispatch(writeStarted { kind: 'send' })` → `const r = await appendUser(roomId, { text, ooc })`(원문 그대로, AI 호출 없음) → in-flight false → 비활성이면 `false` → 성공: `dispatch(messagesAppended { messages: [r.value], isNearBottom: isNearBottom() })` → `dispatch(writeFinished)` → `true` / 실패: `dispatch(writeFinished)` → `onFailure(r.error, 'send')` → `false` | `isNearBottom`은 응답 시점(붙이기 전) 측정. 맨 아래 근처면 자동 스크롤, 아니면 배지(T9 재사용) | R-CHAT-006 · 004 · R-AUTH-004 · R-CHAT-003 |
| F-CH-18 | `openMessageMenu(message: Message): void` (ChatScreen, `useCallback([])`) | 말풍선 | `sheet = { kind: 'messageMenu', message }` | Bubble 롱프레스·우클릭·Shift+F10. `getState().writing !== null` 또는 `roomBusy !== null`이면 무시한다(v1.5 DC-05, 쓰기 대기 중 메뉴 진입 없음) | `viewer.canWrite`가 false면 Bubble에 핸들러가 없어 불리지 않는다 | R-CHAT-007 |
| F-CH-19 | `startEdit(message: Message): void` (ChatScreen) | 대상 | `sheet = null` → `dispatch(editStarted { messageId })` | 시트가 닫히며 말풍선으로 포커스가 돌아간 뒤, 같은 커밋에서 InlineEditor 마운트가 입력으로 포커스를 가져간다 | T22면 편집기 없음(쓰기 중이면 항목이 비활성이라 정상 경로에서는 오지 않는다) | R-CHAT-007 |
| F-CH-20 | `saveEdit(messageId: number, text: string): Promise<void>` (`useMessageWrites`) | id·새 본문 | T13 → T17 + T15 / T15 | 가드(in-flight · `getState().writing !== null` · `!isMessageTextValid`) → `writeStarted { kind: 'edit', messageId }` → `await editMessage(messageId, { text })` → 비활성이면 종료 → 성공: `messageReplaced(r.value)`(T17이 편집 닫음) → `writeFinished` → `focusLog()` / 실패: `writeFinished`(편집기·입력 유지) → `onFailure(r.error, 'editMessage')` | — | R-CHAT-007 · R-MSG-004 |
| F-CH-21 | `cancelEdit(): void` (ChatScreen) | — | T23/T24 | 취소 버튼·Esc → `dispatch(editCancelled)` → `focusLog()` | 저장 중이면 T24(버튼도 비활성) | R-CHAT-007 |
| F-CH-22 | `askDeleteMessage(message: Message): void` (ChatScreen) | 대상 | `sheet = { kind: 'confirmDeleteMessage', message }` | 말풍선 메뉴 「삭제」 → 확인 시트(confirm 필수, 스킬 §11) | — | R-CHAT-007 |
| F-CH-23 | `confirmDeleteMessage(message: Message): Promise<void>` (ChatScreen → `useMessageWrites.removeMessage`) | 대상 | T13 → T19 + T15 / T15 | `const r = await removeMessage(message.id)` 후 `r.kind`로 나눈다. **`'rejected'`**(가드에 걸려 요청 안 함): 아무것도 바꾸지 않는다(시트 그대로, 버튼은 이미 비활성). **`'removed'`**(204 또는 `NOT_FOUND` = 이미 없음): `sheet = null` → `focusLog()` → `r.isEmptyWithMore`면 `loadInitial()`(빈 화면에 "아직 대화가 없습니다"가 잘못 뜨지 않게 최신 페이지를 다시 받는다). **`'failed'`**(그 밖 실패): `sheet = null` → 토스트(`onFailure`가 이미 불림). 비활성(언마운트)이면 훅이 `'rejected'`를 돌려준다 | 시트를 닫은 뒤 토스트(시트가 열린 채로 토스트를 띄우지 않는다) | R-CHAT-007 · R-MSG-005 |
| F-CH-24 | `openRoomMenu(): void` (ChatScreen) | — | `sheet = { kind: 'roomMenu' }` | ⋯ 버튼. 쓰기 대기 중이면 ⋯가 `disabled`라 불리지 않고, 불려도 `getState().writing !== null \|\| roomBusy !== null`이면 무시(D-10) | — | R-CHAT-001 |
| F-CH-25 | `askRename(): void` · `askDeleteRoom(): void` (ChatScreen) | — | `sheet = { kind: 'rename', errorText: null }` · `{ kind: 'confirmDeleteRoom' }` | 방 메뉴 항목 | — | R-CHAT-001 |
| F-CH-26 | `rename(title: string): Promise<void>` (`useRoomActions`) | 새 제목 | `roomBusy` | `roomBusy !== null`(ref)이면 종료 → `'rename'` → `await renameRoom(room.id, { title })` → `null` → 비활성이면 종료 → 성공: `onRoomRenamed(r.value)`(App F-RM-13 → 상단 제목 갱신) → `sheet = null`(포커스는 BottomSheet가 ⋯로 되돌린다) / 실패: 인증이면 `sheet = null` → `handleWriteFailure(error, 'renameRoom')` · 그 밖이면 시트를 연 채 `sheet = { kind: 'rename', errorText: labels.writeErrorText(error, 'renameRoom') }`(PromptSheet 안 `role=alert`, 입력값은 PromptSheet 로컬 상태라 유지) | `updatedAt`은 서버가 그대로 둔다(목록 순서 불변) | R-CHAT-001 · R-ROOM-003 |
| F-CH-27 | `confirmDeleteRoom(): Promise<void>` (`useRoomActions.remove`) | — | 저장소·화면 전환 | `roomBusy` 가드 → `'delete'` → `await deleteRoom(room.id)` → 비활성이면 종료 → 성공 **또는 `NOT_FOUND`**: `clearLastRoomId()` → `onBack()`(목록 복귀·재로드) / 그 밖 실패: `roomBusy = null` → `sheet = null` → `handleWriteFailure(error, 'deleteRoom')` | 삭제된 방의 `ld:scroll:{id}` 키는 언마운트 저장으로 남을 수 있다(무해, 주 문서 §11.2 A-5) | R-CHAT-001 · R-ROOM-004 · R-ROOMS-004 |
| F-CH-28 | `closeSheet(): void` (ChatScreen) | — | `sheet = null` | 시트 취소·Esc·덮개. 요청 중에는 시트가 `isDismissDisabled`라 불리지 않는다 | — | R-CHAT-001 · 007 |
| F-CH-29 | 읽기 전용 전환 effect (ChatScreen `useEffect([viewer.canWrite])`) | `viewer.canWrite` | 정리·포커스 | `wasWritableRef.current && !viewer.canWrite`면: `setSheet(null)` → `dispatch(writeAccessRevoked)`(T25) → `backButtonRef.current?.focus()`. 끝에 `wasWritableRef.current = viewer.canWrite` | 처음부터 읽기 전용이면 아무것도 안 함. 렌더도 `canWrite`로 막혀 있어(⋯·Composer·시트·말풍선 메뉴, 편집기는 F-CH-11의 `editingId` 조건) effect 전 커밋에도 쓰기 UI가 그려지지 않는다. effect는 숨은 상태(`sheet`·`writing`·`editingId`)를 정리하는 일만 한다 | R-CHAT-011 · 008 |
| F-CH-30 | `focusLog(): void` (ChatScreen 지역) | — | 포커스 | `autoScroll.containerRef.current?.focus()`(스크롤 박스, `tabIndex=0`). 없으면(빈 방) `backButtonRef`로 | — | R-CHAT-013 |

- `useMessageWrites({ roomId, dispatch, getState, isActive, isNearBottom, onFailure }) => { send, saveEdit, removeMessage }` — `ui/src/chat/useMessageWrites.ts`. `removeMessage(id): Promise<RemoveResult>`, `RemoveResult = { kind: 'removed'; isEmptyWithMore: boolean } | { kind: 'failed' } | { kind: 'rejected' }`. 규칙: 가드(in-flight · `getState().writing !== null`)에 걸리면 `'rejected'`. 요청 후 비활성이면 `'rejected'`. 204·`NOT_FOUND`면 **`const next = chatReducer(getState(), { type: 'messageRemoved', messageId })`로 dispatch 결과와 같은 다음 상태를 순수 계산**해 `isEmptyWithMore = next.messages.length === 0 && next.hasMore`를 정한 뒤 `messageRemoved` → `writeFinished`를 dispatch하고 `'removed'`. 그 밖 실패면 `writeFinished` → `onFailure(error, 'deleteMessage')` → `'failed'`. 시트 닫기·포커스·재로드는 F-CH-23(ChatScreen)이 한다.
- `useRoomActions({ room, isActive, onRenamed, onDeleted, onFailure }) => { roomBusy, rename, remove }` — `ui/src/chat/useRoomActions.ts`. `onDeleted = () => { clearLastRoomId(); onBack() }`. 시트 상태 변경은 콜백으로 ChatScreen이 한다.
- 함수 50줄·파일 400줄 한계: `index.tsx`는 조립·렌더와 F-CH-16·18·19·21·22·24·25·28·29·30만 둔다. 시트 분기 JSX는 `ChatSheets`로 뺀다.
- 동시성: 메시지 쓰기는 `writing` 하나로 직렬화한다. 방 쓰기(이름 변경·삭제)는 시트가 화면을 덮는 동안만 일어나므로 메시지 쓰기와 겹쳐도 서로의 상태를 건드리지 않는다.
