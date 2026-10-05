# chat 상세 설계 — 상태·기능 명세 (분할 문서)

> 주 문서: `ui/src/chat/design.md`(RTM 포함). 이 파일은 주 문서 §4·§5의 상세다.
> 컴포넌트·훅 시그니처는 `design/components.md`.

---

## 1. 대화 상태 — `ui/src/state/chat.ts` (순수, React·DOM 의존 없음)

```ts
export type ChatState = {
  readonly phase: 'loading' | 'error' | 'ready'    // 첫 페이지 상태
  readonly error: ApiError | null                  // phase==='error' 일 때만 값
  readonly messages: readonly Message[]            // id 오름차순, id 중복 없음
  readonly hasMore: boolean                        // 더 오래된 페이지가 있는가
  readonly isLoadingOlder: boolean
  readonly olderError: ApiError | null
  readonly unseenCount: number                     // 위를 보는 중 도착한 새 메시지 수
}
export const initialChatState: ChatState =
  { phase: 'loading', error: null, messages: [], hasMore: false, isLoadingOlder: false, olderError: null, unseenCount: 0 }

export type ChatAction =
  | { type: 'initialLoadStarted' }
  | { type: 'initialLoadSucceeded'; page: MessagesPage }
  | { type: 'initialLoadFailed'; error: ApiError }
  | { type: 'olderLoadStarted' }
  | { type: 'olderLoadSucceeded'; page: MessagesPage }
  | { type: 'olderLoadFailed'; error: ApiError }
  | { type: 'messagesAppended'; messages: readonly Message[]; isNearBottom: boolean }  // S1 발생 경로 없음
  | { type: 'unseenCleared' }

export const chatReducer = (state: ChatState, action: ChatAction): ChatState
```

- `ApiError`는 `@/api`, `Message`·`MessagesPage`는 `@shared/types`에서 type import(런타임 의존 없음).

### 1.1 전이표 (각 행 vitest ≥1). "그대로" = 같은 객체 참조를 돌려준다

| # | 액션 | 조건 | 다음 상태 |
|---|---|---|---|
| T1 | `initialLoadStarted` | 항상 | `initialChatState` |
| T2 | `initialLoadSucceeded` | 항상 | `phase='ready'`, `error=null`, `messages=mergeMessages([], page.messages)`, `hasMore=page.hasMore` |
| T3 | `initialLoadFailed` | 항상 | `phase='error'`, `error=action.error`, 나머지 초기값 |
| T4 | `olderLoadStarted` | `canLoadOlder(state)` | `isLoadingOlder=true`, `olderError=null` |
| T5 | `olderLoadStarted` | 아니면 | 그대로 |
| T6 | `olderLoadSucceeded` | `isLoadingOlder` | `messages=mergeMessages(state.messages, page.messages)`, `hasMore = page.messages.length === 0 ? false : page.hasMore`, `isLoadingOlder=false` |
| T7 | `olderLoadSucceeded`·`olderLoadFailed` | `!isLoadingOlder` | 그대로(늦게 온 응답) |
| T8 | `olderLoadFailed` | `isLoadingOlder` | `isLoadingOlder=false`, `olderError=action.error` |
| T9 | `messagesAppended` | `phase==='ready'` | `messages=mergeMessages(state.messages, action.messages)`. `added` = 기존 마지막 id보다 큰 새 id 개수. `unseenCount = isNearBottom ? 0 : unseenCount + added` |
| T10 | `messagesAppended` | `phase!=='ready'` | 그대로 |
| T11 | `unseenCleared` | `unseenCount > 0` | `unseenCount=0` |
| T12 | `unseenCleared` | `unseenCount === 0` | 그대로 |

### 1.2 같은 파일의 순수 함수

| 함수 | 시그니처 | 규칙 |
|---|---|---|
| `mergeMessages` | `(current: readonly Message[], incoming: readonly Message[]) => Message[]` | id 기준 합집합. 같은 id는 `incoming` 값이 이긴다. id 오름차순 정렬. 입력을 바꾸지 않는다 |
| `canLoadOlder` | `(s: ChatState) => boolean` | `phase==='ready' && hasMore && !isLoadingOlder && messages.length > 0` |
| `canAutoLoadOlder` | `(s: ChatState) => boolean` | `canLoadOlder(s) && olderError === null`(실패 뒤에는 스크롤로 자동 재시도하지 않고 「다시 시도」 버튼만) |
| `nextBefore` | `(s: ChatState) => number \| null` | `hasMore && messages.length > 0 ? messages[0].id : null`(api.md §4.3 다음 페이지 규약) |

---

## 2. 스크롤 계산 — `ui/src/state/scroll.ts` (순수)

비유: 두루마리 위에 종이를 덧붙이면 그만큼 아래로 감아 줘야 읽던 줄이 제자리에 있다. `anchorScrollTop`이 "덧붙인 길이만큼 감기"다.

```ts
export const TOP_THRESHOLD_PX = 80        // ui-design-strategy §6.4
export const BOTTOM_THRESHOLD_PX = 120    // ui-design-strategy §6.4
export type ScrollMetrics = { scrollTop: number; scrollHeight: number; clientHeight: number }

export const distanceFromBottom = (m: ScrollMetrics): number   // max(0, scrollHeight - scrollTop - clientHeight)
export const isNearTop = (m: ScrollMetrics): boolean           // scrollTop <= TOP_THRESHOLD_PX
export const isNearBottom = (m: ScrollMetrics): boolean        // distanceFromBottom(m) <= BOTTOM_THRESHOLD_PX
export const anchorScrollTop = (prev: ScrollMetrics, nextScrollHeight: number): number
                                                               // prev.scrollTop + (nextScrollHeight - prev.scrollHeight)
export const restoreScrollTop = (m: Pick<ScrollMetrics, 'scrollHeight' | 'clientHeight'>, saved: number | null): number
                                                               // max = max(0, scrollHeight - clientHeight)
                                                               // 결과 = clamp(max - (saved ?? 0), 0, max)
```

---

## 3. ChatScreen 로컬 상태 (`ui/src/chat/index.tsx`)

| 상태 | 용도 | 타입 | 초기값 | 소유 |
|---|---|---|---|---|
| `state` | 대화 상태 | `ChatState` | `initialChatState` | `useReducer(chatReducer, initialChatState)` |
| `initialDistance` | 복원할 스크롤 거리 | `number \| null` | `useState(() => loadScrollOffset(room.id))`(마운트 1회) | 로컬 |
| `olderInFlightRef` | 이전 페이지 요청 중복 방지(같은 틱의 연속 scroll 이벤트) | `MutableRefObject<boolean>` | `false` | 로컬 `useRef` |
| `isActiveRef` | 언마운트 뒤 도착한 응답 무시 | `MutableRefObject<boolean>` | 마운트 시 `true`, 언마운트 시 `false` | 로컬 `useRef` |
| `backButtonRef` | 마운트 시 포커스 대상 | `RefObject<HTMLButtonElement>` | `null` | 로컬 `useRef` |
| `autoScroll` | 스크롤 제어 | `UseAutoScrollResult` | `useAutoScroll({ firstId, lastId, initialDistanceFromBottom: initialDistance, canAutoLoadOlder: canAutoLoadOlder(state), onReachTop: loadOlder, onReachBottom: clearUnseen })` | 훅 |

- `firstId = state.messages[0]?.id ?? null`, `lastId = state.messages[state.messages.length - 1]?.id ?? null`.
- 방 정보는 props `room: RoomSummary`(rooms 목록에서 받은 값, 단건 조회 없음). 토큰 상태 없음 — `viewer.canWrite`만 본다.
- 방이 바뀌면 `App`이 `key={room.id}`로 ChatScreen을 새로 마운트하므로 상태가 섞이지 않는다. 그래서 마운트 effect의 의존 배열이 `[]`여도 `room.id`가 낡지 않는다.

---

## 4. 기능 명세 (function 단위)

| # | 시그니처 | 입력 | 출력·상태 변경 | 동작 | 예외·분기 | 요구ID |
|---|---|---|---|---|---|---|
| F-CH-01 | `ChatScreen(props: ChatScreenProps): JSX.Element` | `{ room: RoomSummary; viewer: Viewer; onBack: () => void }` | 주 문서 §2.1 렌더 | `<main aria-label={labels.screenAriaLabel(room.title)}>` → TopBar(`variant='room'`, `title=room.title`, `subtitle={ text: formatMonthDay(room.createdAt), dateTime: toIsoDate(room.createdAt), ariaLabel: labels.createdAtAriaLabel(text) }`, `left=<IconButton icon='back' ariaLabel={labels.backAriaLabel} onClick={back} buttonRef={backButtonRef} />`) → 히스토리 `<section>`(`renderHistory(state)`) → `!viewer.canWrite && <ReadOnlyNotice text={labels.readOnlyNotice} />` | `right` 슬롯·하단 바 없음(S1) | R-CHAT-001 · 002 · 008 · 013 |
| F-CH-02 | 마운트 effect (`useEffect(…, [])`) | — | 저장소 기록·첫 로드·포커스 | `isActiveRef=true` → `saveLastRoomId(room.id)` → `backButtonRef.current?.focus()` → `loadInitial()`. cleanup `isActiveRef=false` | 저장 실패는 storage가 삼킨다 | R-CHAT-010 · R-ROOMS-004 |
| F-CH-03 | `loadInitial(): Promise<void>` | — | T1 → T2/T3 | `dispatch({ type: 'initialLoadStarted' })` → `const r = await listMessages(room.id)`(query 없음 = 최신 30건) → `isActiveRef` false면 종료 → `r.ok ? initialLoadSucceeded(r.value) : initialLoadFailed(r.error)` | 래퍼는 throw 없음 | R-CHAT-002 · 003 |
| F-CH-04 | `retryInitial(): void` | — | `loadInitial()` | 첫 로드 오류 StateView 「다시 시도」 | — | R-CHAT-003 |
| F-CH-05 | `loadOlder(): Promise<void>` | — | T4 → T6/T8 | `olderInFlightRef`가 true이거나 `!canLoadOlder(state)`면 종료. `before = nextBefore(state)`가 null이면 종료. `olderInFlightRef=true` → `dispatch(olderLoadStarted)` → `const r = await listMessages(room.id, { before })` → `olderInFlightRef=false` → `isActiveRef` false면 종료 → 성공/실패 dispatch | 스크롤 보정은 useAutoScroll 앞붙임 분기 | R-CHAT-003 |
| F-CH-06 | `retryOlder(): void` | — | `loadOlder()` | B0 오류 「다시 시도」. `olderError`가 있어도 `canLoadOlder`는 true라 진행된다 | — | R-CHAT-003 |
| F-CH-07 | `clearUnseen(): void` | — | T11/T12 | `dispatch({ type: 'unseenCleared' })`. useAutoScroll `onReachBottom` | — | R-CHAT-003 |
| F-CH-08 | `showNewest(): void` | — | 스크롤 + T11 | 배지 클릭: `autoScroll.scrollToBottom()` → `clearUnseen()` | — | R-CHAT-003 |
| F-CH-09 | 스크롤 위치 저장 effect (`useEffect(…, [])`) | — | 저장소 기록 | `save = () => { const d = autoScroll.getDistanceFromBottom(); if (d !== null) saveScrollOffset(room.id, d) }`. `window`의 `pagehide`에 `save` 등록. cleanup: 등록 해제 후 `save()` 1회(‹ 뒤로·방 전환) | 한 번도 배치되지 않았으면(로딩·오류·빈 방) 저장하지 않는다 → 이전에 저장된 값이 그대로 남는다 | R-CHAT-010 |
| F-CH-10 | `back(): void` | — | 저장소 삭제 + `onBack()` | ‹ 버튼. `clearLastRoomId()` → `onBack()`(마지막으로 본 화면이 목록이 되므로 다음 열기는 목록). 스크롤 위치 저장은 F-CH-09 cleanup이 한다 | 삭제 실패는 storage가 삼키고 `onBack()`은 항상 호출 | R-CHAT-001 · R-ROOMS-004 · R-CHAT-010 |
| F-CH-11 | `renderHistory(state: ChatState): JSX.Element` (지역 함수) | 상태 | 히스토리 영역 | 판정 순서: `phase==='error'` → `StateView kind='error' message={labels.loadError} detail={errorDetail(state.error.code)} actionLabel={labels.retry} onAction={retryInitial}` / `'loading'` → `StateView kind='loading' message={labels.loading}` / `messages.length > 0` → `MessageList …` / 그 밖 → `StateView kind='empty' message={labels.empty}` | — | R-CHAT-002 · 003 |
| F-CH-12 | `chatReducer` 외 순수 함수 | §1 | §1 | §1.1 전이표 · §1.2 | — | R-CHAT-003 |
| F-CH-13 | `scroll.ts` 순수 함수 | §2 | §2 | §2 | — | R-CHAT-003 · 010 |
| F-CH-14 | `useAutoScroll(options)` | components.md §3 | components.md §3 | components.md §3 표 | 요소 없으면 아무것도 안 함 | R-CHAT-003 · 010 |
| F-CH-15 | `bubbleVariantOf(m)` | `Message` | `BubbleVariant` | components.md §2.2 | — | R-CHAT-002 |

- 함수 50줄·파일 400줄 한계: F-CH-03~06은 화면 로컬 훅 `ui/src/chat/useChatLoader.ts`(`useChatLoader(roomId) => { state, loadInitial, retryInitial, loadOlder, retryOlder, clearUnseen }`)로 묶고, `index.tsx`는 조립·렌더만 한다.
- `loadOlder`는 useAutoScroll이 최신 콜백 ref로 부르므로 낡은 `state`를 보지 않는다. `useChatLoader`는 최신 `state`를 ref(`stateRef`)에도 담아 `loadOlder`가 그 값을 읽는다.
