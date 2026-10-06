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
  | { readonly kind: 'speak'; readonly character: CharacterId }       // S3: speakStarted 로만 시작한다
  | { readonly kind: 'regenerate'; readonly messageId: number }       // S3: writeStarted 로 시작한다

export type PendingSpeak = {                       // S3: 목록 끝 임시(생성 중)·실패 말풍선. 서버에 저장된 것이 아니다
  readonly character: CharacterId                  // 눌린 캐릭터 = 배치 쪽(CR-001)·재시도 대상
  readonly status: 'generating' | 'failed'
  readonly error: ApiError | null                  // status==='failed' 일 때만 값(RATE_LIMITED 의 retryAfterSec 까지 문구에 쓴다)
}

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
  readonly pending: PendingSpeak | null            // S3: 임시·실패 말풍선(없으면 null)
}
export const initialChatState: ChatState = {
  phase: 'loading', error: null, messages: [], hasMore: false, isLoadingOlder: false,
  olderError: null, unseenCount: 0, writing: null, editingId: null, pending: null,
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
  // ── S3 ──
  | { type: 'speakStarted'; character: CharacterId }                              // 캐릭터 버튼 · 「재시도」
  | { type: 'speakSucceeded'; message: Message; isNearBottom: boolean }           // speak 201
  | { type: 'speakFailed'; error: ApiError }                                      // 실패 말풍선으로
  | { type: 'speakDiscarded' }                                                    // 인증 실패 · 방 사라짐: 임시 말풍선을 남기지 않는다

export const chatReducer = (state: ChatState, action: ChatAction): ChatState
```

- `CharacterId`는 `@shared/types`에서 type import. 재작성(regenerate)은 새 액션 없이 S2의 `writeStarted { kind: 'regenerate' }` → `messageReplaced` → `writeFinished`를 그대로 쓴다(성공 반영이 수정 저장과 같은 "같은 id 통째 교체"라서, api.md ui 인계 메모 「성공 반영」).

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
| T13 | `writeStarted` | `canSend(state)`(= `phase==='ready' && writing===null`) && `write.kind !== 'speak'` | `writing=action.write`(S3: `regenerate`도 여기로. `pending`은 건드리지 않는다) |
| T14 | `writeStarted` | 아니면(S3: `write.kind==='speak'`도 — speak 는 `speakStarted`로만 시작해 임시 말풍선과 함께 건다) | 그대로(거절. 호출 쪽은 `getState().writing`으로 먼저 확인한다) |
| T15 | `writeFinished` | `writing!==null && writing.kind !== 'speak'` | `writing=null` |
| T16 | `writeFinished` | `writing===null` 또는 (S3) `writing.kind==='speak'`(speak 는 T29~T33으로만 끝난다 — 임시 말풍선이 남는 일을 막는다) | 그대로 |
| T17 | `messageReplaced` | 같은 id가 `messages`에 있음 | 그 원소만 `action.message`로 바꾼 새 배열(순서 유지). `editingId === id`면 `editingId=null` |
| T18 | `messageReplaced` | 없음 | 그대로 |
| T19 | `messageRemoved` | 같은 id가 있음 | 그 원소를 뺀 새 배열. `editingId === id`면 `editingId=null` |
| T20 | `messageRemoved` | 없음 | 그대로 |
| T21 | `editStarted` | `phase==='ready' && writing===null` && 같은 id가 있음 | `editingId=action.messageId`(다른 메시지를 수정 중이었으면 바뀐다) |
| T22 | `editStarted` | 아니면 | 그대로 |
| T23 | `editCancelled` | `editingId!==null && writing?.kind !== 'edit'` | `editingId=null` |
| T24 | `editCancelled` | 아니면(수정 중 아님 · 저장 요청 중) | 그대로 |
| T25 | `writeAccessRevoked` | `writing!==null \|\| editingId!==null \|\| pending!==null`(S3: `pending` 추가) | `writing=null`, `editingId=null`, `pending=null` |
| T26 | `writeAccessRevoked` | 셋 다 null | 그대로 |
| T27 | `speakStarted` | `canSpeak(state)`(= `canSend` + 편집 중 아님) | `writing={ kind: 'speak', character }`, `pending={ character, status: 'generating', error: null }`. 이전 `pending`이 실패 말풍선이면(같은·다른 캐릭터 모두) **이것으로 바뀐다**(실패 말풍선이 사라지고 새 임시 말풍선) |
| T28 | `speakStarted` | 아니면(첫 로드 전 · 다른 쓰기 중 · 이미 생성 중 · 인라인 수정 중) | 그대로 |
| T29 | `speakSucceeded` | `phase==='ready' && writing?.kind==='speak'` | T9와 같은 규칙으로 `messages`·`unseenCount`(`[action.message]`, `isNearBottom`) + `writing=null`, `pending=null`(임시 말풍선이 결과 말풍선으로 **교체**된다) |
| T30 | `speakSucceeded` | 아니면 | 그대로 |
| T31 | `speakFailed` | `writing?.kind==='speak'` | `writing=null`, `pending={ character: writing.character, status: 'failed', error: action.error }`(같은 자리에 실패 말풍선) |
| T32 | `speakFailed` | 아니면 | 그대로 |
| T33 | `speakDiscarded` | `writing?.kind==='speak'` | `writing=null`, `pending=null` |
| T34 | `speakDiscarded` | 아니면 | 그대로 |

- T1·T2·T3은 `initialChatState`를 펼치므로 `pending`도 null이 된다. 실패 말풍선이 떠 있는 채 재로드(F-CH-23 마지막 삭제 · F-CH-36 `NOT_LAST_MESSAGE`)가 일어나면 실패 말풍선은 사라진다(의도 — 서버에 저장된 것이 없다).
- **(S3d, CR-002)** `SpeakTarget`(`'auto'`) 타입 확장 · T27·T31 `'auto'` 해석 · 신규 **T35·T36 `sendSucceeded`** · `speakingCharacterOf` · F-CH-17·31·32 개정 · F-CH-42~44는 `design/auto.md` §1·§3이 정본이다. 아래 문장의 "유저 전송 성공에도 남는다"는 S3d에서 전송만 예외(T35가 중립 "…"로 교체).
- 실패 말풍선(`status==='failed'`)은 유저 전송·수정·삭제·재작성 성공에도 그대로 목록 끝에 남는다. 「재시도」 결과도 목록 끝에 붙으므로 자리가 맞다. 없어지는 경우는 T27(새 생성) · T1~T3(재로드) · T25(전환) · 화면 언마운트(‹ 뒤로 · 방 전환)뿐이다.

### 1.2 같은 파일의 순수 함수

| 함수 | 시그니처 | 규칙 |
|---|---|---|
| `mergeMessages` | `(current, incoming) => Message[]` | id 기준 합집합. 같은 id는 `incoming`이 이긴다. id 오름차순. 입력을 바꾸지 않는다 |
| `canLoadOlder` | `(s) => boolean` | `phase==='ready' && hasMore && !isLoadingOlder && messages.length > 0` |
| `canAutoLoadOlder` | `(s) => boolean` | `canLoadOlder(s) && olderError === null` |
| `nextBefore` | `(s) => number \| null` | `hasMore ? (messages[0]?.id ?? null) : null`(S1 실물 표기, 의미 동일) |
| `canSend` (S2) | `(s) => boolean` | `phase==='ready' && writing===null`. **S3: 쓰기 잠금의 기본 함수**다 — 전송·수정 저장·삭제·재작성은 이것이 true일 때만 시작한다. 그래서 생성(speak·regenerate) 중에는 전송이 잠기고, 어떤 쓰기 중에도 생성이 잠긴다 |
| `canSpeak` (S3, v1.7 DC-10) | `(s) => boolean` | `canSend(s) && s.editingId === null`. 캐릭터 버튼·「재시도」·`speakStarted`(T27)의 조건. 인라인 수정이 열려 있으면 생성을 시작하지 않는다(편집 중인 말풍선 뒤로 새 대사가 붙어 편집 대상이 마지막이 아니게 되는 혼선을 막는다). 전송은 S2대로 편집 중에도 가능 |
| `isRegenerateTarget` (S3) | `(s: ChatState, messageId: number) => boolean` | `last = s.messages[s.messages.length - 1]` · `last !== undefined && last.id === messageId && last.kind === 'line' && last.speaker !== 'user'`. 재작성 항목 **표시** 조건(R-CHAT-007 🔒 "캐릭터 메시지이고 마지막"). 화면 목록 기준이며 임시·실패 말풍선은 메시지가 아니라 세지 않는다. `kind==='line'` 조건은 말풍선 변형(`sebastian`·`ciel`)과 일치시킨 것이다(E9 결과는 항상 `line`, api.md §4.12) |

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
| `state.pending` (S3) | 임시·실패 말풍선 | `PendingSpeak \| null` | `null` | **리듀서**(§1, T27~T34). 컴포넌트 로컬 상태로 두지 않는다(순수 함수로 테스트) |
| `requested` · `handledRef` (S3, F-CH-41, v1.7.1) | 재조회·제거 뒤 log 포커스 요청 수 · 처리한 요청 수 | `number` · `MutableRefObject<number>` | `0` · `0` | `useChatScreen` 지역 훅 `useLogFocusAfterCommit` 내부 `useState`·`useRef` |
| `lastSpeakerRef` (S3, DC-03) | 마지막으로 생성한 캐릭터(잠금 해제 뒤 포커스 복귀 대상 — 캐릭터 버튼·「재시도」 어느 쪽으로 시작했든) | `MutableRefObject<CharacterId \| null>` | `null`. prop `speakingCharacter`가 null이 아니면 그 값으로 갱신 | `SpeakButtons` 내부(F-CH-38) |

- (S3) 생성 중·재작성 중 표시는 모두 `state.writing`·`state.pending`에서 계산한다: 잠금 = 캐릭터 버튼·「재시도」 `!canSpeak(state)` · 전송 `!canSend(state)`, 재작성 중 대상 = `writing?.kind === 'regenerate' ? writing.messageId : null`. 화면 자체 타이머·타임아웃은 없다(api.md §4.12 「화면 타임아웃」 — 서버 70초 종결에 의존, R-NFR-001).

- `firstId = state.messages[0]?.id ?? null`, `lastId = state.messages[state.messages.length - 1]?.id ?? null`.
- 방 정보는 props `room`(rooms 목록·생성 응답·이름 변경 응답). 토큰 값은 모른다 — `viewer.canWrite`만 본다.
- 방이 바뀌면 `App`이 `key={room.id}`로 새로 마운트한다. 이름 변경은 같은 id라 다시 마운트되지 않는다.

---

## 4. 기능 명세 (function 단위)

### 4.1 S1 (실물 소급 반영)

| # | 시그니처 | 입력 | 출력·상태 변경 | 동작 | 예외·분기 | 요구ID |
|---|---|---|---|---|---|---|
| F-CH-01 | `ChatScreen(props: ChatScreenProps): JSX.Element` | `{ room: RoomSummary; viewer: Viewer; onBack: () => void; onAuthFailure: () => void; onRoomRenamed: (room: RoomSummary) => void }`(뒤 둘 S2) | 주 문서 §2 렌더 | `<main className=root aria-label={labels.screenAriaLabel(room.title)}>` → `ChatTopBar room onBack={back} backButtonRef onOpenMenu={viewer.canWrite ? openRoomMenu : undefined} menuButtonRef isMenuDisabled={state.writing !== null || roomBusy !== null}` → `<section className=history>{renderHistory(…)}</section>` → `toast && <Toast key={toast.id} …/>`(E) → `viewer.canWrite ? <Composer canSend={canSend(state)} isSending={state.writing?.kind === 'send'} onSend={send} canSpeak={canSpeak(state)} speakingCharacter={state.writing?.kind === 'speak' ? state.writing.character : null} onSpeak={speakAs} /> : <ReadOnlyNotice text={labels.readOnlyNotice} />`(S3 props, DC-09) → `viewer.canWrite && sheet && <ChatSheets … onRegenerate={regenerateFromMenu} />`(S3, DC-09) | 읽기 전용이면 ⋯·C·시트·말풍선 메뉴 없음(주 문서 §10). `onAuthFailure`·`onRoomRenamed`는 **필수 props**(선택 아님, v1.5). S1 스펙(기존 테스트)은 빈 콜백 `() => {}`을 넘긴다(메인 세션 승인) | R-CHAT-001 · 002 · 004 · 008 · 013 |
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

### 4.3 S3 — AI 발화(speak) · 재작성(regenerate)

비유·쓰기 팻말 변경(`useWriteGate.begin`이 시작 액션을 받는다)·잠금 표 → `design/generate.md` 머리말·§6.

| # | 시그니처(위치) | 입력 | 출력·상태 변경 | 동작 | 예외·분기 | 요구ID |
|---|---|---|---|---|---|---|
| F-CH-16 (S3 변경) | `handleWriteFailure(error, action)` (`useWriteFailure`, 실물 소급 DC-07) | `WriteAction`에 **`'speak' \| 'regenerate'`** 추가 | 같음 | 같음. speak 는 인증 실패만 여기로 온다(그 밖은 실패 말풍선, F-CH-31). regenerate 는 모든 실패가 여기로 온다(토스트) | — | R-CHAT-011 |
| F-CH-31 | `speakAs(character: CharacterId): Promise<void>` (`useMessageWrites`) | 눌린 캐릭터 | T27 → T29 / T31 / T33 | `begin({ type: 'speakStarted', character })`가 false면 종료 → `const r = await speak(roomId, { character })`(`@/api`, 본문은 이것뿐 — 대화 내용은 보내지 않는다, api.md §4.13) → `release()` → 비활성이면 종료 → **성공**: `dispatch(speakSucceeded { message: r.value, isNearBottom: isNearBottom() })`(붙이기 전 측정) → **실패**: ① `isAuthFailure(r.error)` → `dispatch(speakDiscarded)` → `onFailure(r.error, 'speak')`(전환 + 토스트, 임시 말풍선 없음) ② `r.error.code === 'NOT_FOUND'`(방 사라짐, 생성 중 삭제 포함) → `dispatch(speakDiscarded)` → `onRoomGone()`(F-CH-33) ③ 그 밖(`SPEAK_IN_PROGRESS`·`LLM_FAILED`·`LLM_EMPTY`·`CONFIG_INVALID`·`RATE_LIMITED`·`NETWORK`·`INTERNAL`·`VALIDATION_ERROR`) → `dispatch(speakFailed { error: r.error })`(실패 말풍선, **토스트 없음**) | 시작 전 `!canSpeak(getState())`면 종료(편집 중, DC-10). 자동 재시도 없음. 화면 타이머 없음. `NETWORK`·`INTERNAL`은 서버에 저장됐을 수 있으나 S3는 단순 재호출로 둔다(`design/generate.md` §5 L-1) | R-CHAT-005 · 004 · 011 · R-MSG-003 · R-CHAT-003 |
| F-CH-32 | `retrySpeak(character: CharacterId): void` (ChatScreen 배선, `PendingBubble onRetry`) | 실패 말풍선의 `pending.character` | F-CH-31 | `void speakAs(character)` — **같은 캐릭터로** speak 재호출. T27이 실패 말풍선을 새 임시 말풍선으로 바꾼다. 「재시도」 버튼은 이 커밋에서 언마운트되어 포커스가 `body`로 빠진다 → **포커스 목적지 = 같은 캐릭터 SpeakButton**(잠금이 풀리는 순간, F-CH-38) | `!canSpeak`(다른 쓰기 중·편집 중)면 버튼이 `disabled`, 불려도 거절 | R-CHAT-005 |
| F-CH-33 | `onRoomGone(): void` (`useChatScreen` → `useMessageWrites` 옵션) | — | 저장소·화면 전환 | `clearLastRoomId()` → `onBack()`. 방 삭제 성공(F-CH-27 `onDeleted`)과 **같은 흐름**: 목록이 새로 로드되어 사라진 방이 없다 | 토스트 없음(화면이 바로 바뀐다) | R-CHAT-005 · R-ROOMS-004 |
| F-CH-34 | `regenerateMessage(messageId: number): Promise<RegenerateResult>` (`useMessageWrites`) | 대상 id | T13 → T17 + T15 / T19 + T15 / T15 | `!isRegenerateTarget(getState(), messageId)`면 `'rejected'` → `begin({ type: 'writeStarted', write: { kind: 'regenerate', messageId } })` false면 `'rejected'` → `const r = await regenerate(messageId)`(`@/api`, 본문 없음) → `release()` → 비활성이면 `'rejected'` → **성공(200)**: `messageReplaced(r.value)` → `writeFinished` → `{ kind: 'replaced' }` → **`NOT_FOUND`**(대상 사라짐): `next = chatReducer(getState(), messageRemoved)`로 `isEmptyWithMore` 판정 → `messageRemoved` → `writeFinished` → `onFailure(error, 'regenerate')` → `{ kind: 'removed', isEmptyWithMore }` → **`NOT_LAST_MESSAGE`**: `writeFinished` → `onFailure` → `{ kind: 'stale' }` → **그 밖**: `writeFinished` → `onFailure`(인증이면 전환) → `{ kind: 'failed' }` | 실패면 원 대사 그대로(서버도 유지, api.md §4.14). 별도 재시도 버튼 없음 — 메뉴에서 다시 누른다 | R-CHAT-007 · 011 · R-MSG-006 · 007 |
| F-CH-35 (F-CH-18 변경) | `openMessageMenu(message: Message): void` (`useChatSheets` — F-CH-18의 실제 위치도 `useChatSheets`, 실물 소급 DC-07) | 말풍선 | `sheet = { kind: 'messageMenu', message, canRegenerate: isRegenerateTarget(getState(), message.id) }` | 가드(D-10) 그대로. 재작성 항목 표시 여부를 **열 때** 계산해 시트에 담는다(시트가 화면을 덮는 동안 목록은 이 화면의 조작으로만 바뀌고, 그 조작은 시트 밖에 있다) | — | R-CHAT-007 |
| F-CH-36 | `regenerateFromMenu(message: Message): Promise<void>` (`useChatSheets`) | 메뉴의 대상 | 시트·포커스·재로드 | `setSheet(null)`(confirm 없음 — 요구 🔒. BottomSheet가 포커스를 연 말풍선으로 돌린다) → `const r = await regenerateMessage(message.id)` → `'replaced'`·`'failed'`·`'rejected'`: 더 하지 않는다 · `'removed'`: `isEmptyWithMore`면 `void loadInitial()` → `requestLogFocus()` / 아니면 `requestLogFocus()` · `'stale'`: `void loadInitial()`(첫 페이지 재조회 — 목록을 최신으로, ui 인계 메모 권장 채택) → `requestLogFocus()`. **포커스는 동기로 `focusLog()`를 부르지 않는다**(CF-01: 재조회는 T1로 log가 언마운트되어 `containerRef`가 null, 제거는 커밋 전이라 곧 사라질 log를 잡는다) — F-CH-41이 다음 ready 커밋 뒤에 한다 | 토스트는 F-CH-16이 이미 띄웠다. 재조회 동안 E 토스트는 유지된다(토스트는 `useWriteFailure` 소유라 T1과 무관) | R-CHAT-007 · 011 |
| F-CH-37 | `speakErrorText(error: ApiError): string` (`labels.ts`) | 실패 말풍선의 `pending.error` | 문구 | `design/generate.md` §3 표 그대로. 「재시도」 표시 판정 함수는 없다 — 모든 코드에 렌더(사용자 결정 2026-10-06: 요구 원문 유지, DC-02. 옛 `canRetrySpeak` 삭제) | 인증 3종·`NOT_FOUND`는 실패 말풍선에 오지 않는다(F-CH-31 ①②). 와도 표의 "그 밖" 행 | R-CHAT-005 · 011 |
| F-CH-38 | `SpeakButtons` 포커스 복귀 (`SpeakButtons` 내부 `useEffect([isDisabled])`) | `isDisabled` true → false | 포커스 | 렌더마다 `speakingCharacter !== null`이면 `lastSpeakerRef.current = speakingCharacter`. 잠금이 풀리는 순간(`isDisabled`가 false가 된 렌더) `document.activeElement`가 `document.body` 또는 `null`이면(누른 캐릭터 버튼이 `disabled`가 되며, 또는 「재시도」 버튼이 언마운트되며 포커스를 잃은 경우) `lastSpeakerRef`의 버튼에 `focus()`. 그리고 **포커스 여부와 무관하게** 잠금이 풀릴 때마다 `lastSpeakerRef = null`(옛 값이 남아 나중의 무관한 잠금 해제에서 옛 버튼으로 끌려가지 않게) | 사용자가 그사이 다른 곳(입력창 등)으로 포커스를 옮겼으면 건드리지 않는다. 버튼이 없으면(전환으로 Composer 미렌더) 아무것도 안 함 | R-CHAT-013 · 005 |
| F-CH-39 (F-CH-11 변경) | `renderHistory(props)` | `HistoryProps`에 `pending`·`onRetrySpeak` 추가 | 히스토리 | 먼저 `const pending = canWrite ? state.pending : null`(편집기와 같은 이유 — 전환 커밋에서 바로 사라짐). empty 판정은 **이 걸러진 값으로** `messages.length === 0 && pending === null`(DC-11. 빈 방에서 처음 누른 버튼의 임시 말풍선도 보이게, 읽기 전용이면 남은 `state.pending`이 있어도 빈 상태). MessageList에 `pending={pending}` · `isSpeakLocked={!canSpeak(state)}` · `onRetrySpeak` · `regeneratingId={canWrite && state.writing?.kind === 'regenerate' ? state.writing.messageId : null}` | — | R-CHAT-005 · 007 · 008 |
| F-CH-40 (F-CH-14 변경) | `useAutoScroll` 옵션 `tailKey` | `pending === null ? null : \`${pending.character}:${pending.status}\`` | 스크롤 | components.md §3 「tailKey」 행. 임시 말풍선이 나타나거나 실패로 바뀔 때 맨 아래 근처였으면 맨 아래로 | 위쪽을 보는 중이면 그대로(배지는 메시지가 붙을 때만) | R-CHAT-003 · 005 |

- **F-CH-41 `requestLogFocus(): void` + `useLogFocusAfterCommit` (useChatScreen, CF-01).** 비유: "목록이 다 펼쳐지면 그때 손가락을 올려 둔다." (v1.7.1 실물 동기화) **카운터 state**로 구현한다: `const [requested, setRequested] = useState(0)` · `handledRef = useRef(0)`. `requestLogFocus = useCallback(() => setRequested(c => c + 1), [])` — 요청 자체가 재렌더를 일으키므로 제거·재조회 커밋이 요청보다 먼저 와도 놓치지 않는다(ref 플래그는 재렌더를 일으키지 않아, 요청보다 앞선 커밋 뒤에는 소비 시점이 없다). 소비는 `useLayoutEffect([phase, requested, focusLog])`: `phase === 'ready' && requested !== handledRef.current`이면 `handledRef.current = requested` 후 `focusLog()`(F-CH-30 — log가 있으면 log, **0건이라 빈 상태 뷰로 log가 없으면 ‹ 뒤로**). `phase === 'loading'` 커밋(재조회 T1)에서는 소비하지 않고 ready 커밋(T2)까지 기다린다. 재조회가 실패하면(T3, `phase === 'error'`) 소비하지 않고 남는다 — 「다시 시도」 성공 뒤 ready에서 소비(StateView 「다시 시도」가 이미 포커스를 가지면 log로 옮겨도 무방). `isEmptyWithMore` 경로는 `loadInitial()`을 먼저 부르고 같은 동기 구간에서 요청하므로 첫 커밋이 loading이라 조기 소비가 없다. 요구 R-CHAT-013 · 007. TC-CH-082 · 083.
- `RegenerateResult = { kind: 'replaced' } | { kind: 'removed'; isEmptyWithMore: boolean } | { kind: 'stale' } | { kind: 'failed' } | { kind: 'rejected' }` — `ui/src/chat/useMessageWrites.ts`에서 export.
- `useMessageWrites` 옵션에 `onRoomGone: () => void` 추가, 결과에 `speakAs`·`regenerateMessage` 추가. 파일은 지역 훅 `useSpeak`·`useRegenerate`를 더해 400줄 안(현재 144줄 + 약 90줄). 함수마다 50줄 한계.
- `useChatScreen.useChatWrites`는 `onRoomGone`(F-CH-33)을 만들어 넘기고 `speakAs`를 돌려준다. `useChatSheets` 옵션에 `regenerateMessage`를 더하고 `regenerateFromMenu`를 돌려준다.
- 잠금 표 → `design/generate.md` §6(v1.7.1 이전).
