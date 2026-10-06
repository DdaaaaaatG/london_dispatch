# rooms 상세 설계 — 상태·기능 명세 (분할 문서)

> 주 문서: `ui/src/rooms/design.md`(RTM 포함). 이 파일은 주 문서 §4·§5의 상세다.
> 컴포넌트 시그니처는 `design/components.md`.

---

## 1. 상태

### 1.1 App (`ui/src/App.tsx`)

| 상태 | 용도 | 타입 | 초기값 | 소유 |
|---|---|---|---|---|
| `view` | 지금 보이는 화면 | `View = { screen: 'rooms' } \| { screen: 'chat'; room: RoomSummary }` | `{ screen: 'rooms' }` | App 로컬 `useState` |
| `autoOpenRoomId` | 시작 시 한 번만 쓰는 마지막 본 방 id | `string \| null` | `useState(() => loadLastRoomId())`(최초 렌더 1회) | App 로컬 |
| `viewer` (S2) | 쓰기 가능 여부 | `Viewer` | `useState(() => viewerFromToken(getToken()))`(최초 렌더 1회) | App 로컬 `useState`. 계산은 `ui/src/state/viewer.ts`, 토큰은 `ui/src/state/token.ts` |

- `View` 타입은 `ui/src/App.tsx`에서 export한다.
- `ui/src/main.tsx`(S2): `global.css` import → `initToken(window.location.search)` → `configureClient({ getToken })` → `createRoot(document.getElementById('root'))`가 `null`이 아니면 `.render(<App />)`. 토큰을 읽는 곳은 여기 한 번뿐이다(components.md §1.10).
- 방 정보(`RoomSummary`)는 rooms 목록에서 고른 객체(또는 생성 응답)를 그대로 chat에 넘긴다(단건 조회 엔드포인트 없음, api.md §4.0).
- `viewer`는 `WRITER_VIEWER → READ_ONLY_VIEWER` 한 방향으로만 바뀐다(F-RM-12). 두 화면 모두 같은 `viewer`를 props로 받으므로 전환이 양쪽에 함께 퍼진다.

### 1.2 RoomsScreen (`ui/src/rooms/index.tsx`) + `useRoomsLoader` (`ui/src/rooms/useRoomsLoader.ts`)

| 상태 | 용도 | 타입 | 초기값 | 소유 |
|---|---|---|---|---|
| `load` | 목록 요청 상태 | `RoomsLoad = { phase: 'loading' } \| { phase: 'error'; error: ApiError } \| { phase: 'ready'; rooms: readonly RoomSummary[] }` | `{ phase: 'loading' }` | `useRoomsLoader` 내부 `useState` |
| `autoOpenSettledRef` | 이 마운트에서 자동 진입 판정을 이미 했는가 | `MutableRefObject<boolean>` | `false` | `useRoomsLoader` 내부 `useRef` |
| `isActiveRef` | 언마운트 뒤 도착한 응답 무시 | `MutableRefObject<boolean>` | `false` → 활성 effect(`useEffect`)가 마운트 시 `true`, cleanup `false` | `useRoomsLoader` 내부 |
| `latestRef` | 부모 콜백(`autoOpenRoomId`·`onOpenRoom`·`onAutoOpenSettled`) 최신 값 | `MutableRefObject<AutoOpenHandlers>` | 첫 handlers, 매 렌더 `useLayoutEffect`로 갱신 | `useRoomsLoader` 내부 |
| `titleRef` | 마운트·전환 시 포커스 대상(h1) | `RefObject<HTMLHeadingElement>` | `null` | RoomsScreen `useRef` |
| `create` (S2) | 새 방 입력 행 상태 | `{ isOpen: boolean; title: string; isSubmitting: boolean }` | `{ isOpen: false, title: '', isSubmitting: false }` | `useCreateRoom`(`ui/src/rooms/useCreateRoom.ts`) 내부 `useState` |
| `submitInFlightRef` (S2) | 같은 틱 연타(Enter·클릭) 중복 제출 방지 | `MutableRefObject<boolean>` | `false` | `useCreateRoom` 내부 |
| `toast` (S2) | 실패 안내 | `ToastState` | `null` | `useToast()`(공용 훅) |
| `newRoomButtonRef` · `titleInputRef` (S2) | 「+ 새 방」 포커스 복귀 · 입력 포커스 | `RefObject<HTMLButtonElement>` · `RefObject<HTMLInputElement>` | `null` | RoomsScreen `useRef` |

- `RoomsLoad`·`AutoOpenHandlers`·`UseRoomsLoaderResult` 타입은 `useRoomsLoader.ts`에서 export한다(S1 실물 소급, v1.4).
- 토큰 값은 화면이 모른다. `viewer.canWrite`만 본다.

---

## 2. 기능 명세 (function 단위)

| # | 시그니처(위치) | 입력 | 출력·상태 변경 | 동작 | 예외·분기 | 요구ID |
|---|---|---|---|---|---|---|
| F-RM-01 | `App(): JSX.Element` (`App.tsx`) | — | `view`에 따라 렌더 | `'rooms'` → `<RoomsScreen viewer autoOpenRoomId onOpenRoom={openRoom} onAutoOpenSettled={settleAutoOpen} onAuthFailure={revokeWrite} />`. `'chat'` → `<ChatScreen key={view.room.id} room={view.room} viewer onBack={backToRooms} onAuthFailure={revokeWrite} onRoomRenamed={replaceRoomInView} />` | 콜백은 전부 `useCallback([])` | R-ROOMS-001 · 004 · R-CHAT-008 |
| F-RM-02 | `openRoom(room: RoomSummary): void` (App) | 고른 방·생성한 방 | `view = { screen: 'chat', room }`, `autoOpenRoomId = null` | 화면 전환만. 마지막 본 방 저장은 ChatScreen 마운트가 한다(chat F-CH-02) | — | R-ROOMS-001 · 002 · 004 |
| F-RM-03 | `backToRooms(): void` (App) | — | `view = { screen: 'rooms' }` | ChatScreen 언마운트 → RoomsScreen 새로 마운트 → 목록을 다시 불러온다. 마지막 본 방 기록은 ChatScreen이 이미 지웠다(‹ 뒤로 F-CH-10, 방 삭제 F-CH-27). App은 저장소를 만지지 않는다 | — | R-ROOMS-004 |
| F-RM-04 | `settleAutoOpen(): void` (App) | — | `autoOpenRoomId = null` | RoomsScreen이 자동 진입 판정을 마쳤다고 알릴 때 | — | R-ROOMS-004 |
| F-RM-05 | `RoomsScreen(props: RoomsScreenProps): JSX.Element` | `{ viewer: Viewer; autoOpenRoomId: string \| null; onOpenRoom: (room: RoomSummary) => void; onAutoOpenSettled: () => void; onAuthFailure: () => void }` | 주 문서 §2 렌더 | 마운트 `useEffect([loadRooms])`: `titleRef.current?.focus()` → `loadRooms()`. 렌더 순서: `<main className=root aria-label>` → `TopBar title={labels.screenTitle} titleRef right={viewer.canWrite ? <Button variant='primary' size='md' ariaLabel={labels.newRoomAriaLabel} buttonRef={newRoomButtonRef} onClick={openCreate}>{labels.newRoom}</Button> : undefined}` → `viewer.canWrite && create.isOpen && <NewRoomRow …/>` → `<section>`(`ListArea`) → `toast && <Toast key={toast.id} message tone />` | 읽기 전용이면 `right`·B를 넘기지도 만들지도 않는다(주 문서 §10). `onAuthFailure`는 **필수 prop**(선택 아님, v1.5). S1 스펙(기존 테스트)은 빈 콜백 `() => {}`을 넘긴다(메인 세션 승인) | R-ROOMS-001 · 002 · 003 · 005 · R-CHAT-008 |
| F-RM-06 | `loadRooms(): Promise<void>` (`useRoomsLoader`, `useCallback([])`) | — | `load` 전이 | `const result = await listRooms()` → `isActiveRef` false면 종료 → 실패 `setLoad({ phase: 'error', error })` / 성공 `setLoad({ phase: 'ready', rooms })` 후 `autoOpenSettledRef`가 false면 true로 바꾸고 `resolveAutoOpen(result.value, latestRef.current)`. **loading으로 되돌리지 않는다** — 마운트 때는 초기값이 이미 loading이고 재시도는 F-RM-07이 먼저 건다(S1 실물 소급). 자동 진입 판정은 목록 응답이 성공 상태일 때만 일어난다. 목록 설정과 화면 전환이 React 19 자동 배칭으로 한 번에 처리되어 목록이 커밋되지 않을 수 있다(의도된 동작) | 래퍼는 throw 없음(api.md §3.4). 실패 시 자동 진입 판정은 다음 성공까지 미룬다 | R-ROOMS-001 · 003 · 004 |
| F-RM-07 | `retry(): void` (`useRoomsLoader`) | — | `setLoad({ phase: 'loading' })` → `loadRooms()` | 오류 상태 「다시 시도」. 버튼은 오류 상태에서만 있으므로 중복 요청이 없다 | — | R-ROOMS-003 |
| F-RM-08 | `resolveAutoOpen(rooms, handlers: AutoOpenHandlers): void` (`useRoomsLoader.ts` 모듈 함수) | 성공한 목록 응답의 방 배열 + 최신 handlers | 아래 | 렌더 결과를 기다리지 않고 응답 값으로 바로 판정한다. `autoOpenRoomId === null` → `onAutoOpenSettled()`만. 목록에 같은 `id`가 있음 → `onAutoOpenSettled()` 후 `onOpenRoom(room)`. 없음 → `clearLastRoomId()` 후 `onAutoOpenSettled()`(목록에 머문다). "이미 판정함" 검사는 호출 쪽 F-RM-06이 한다 | 저장소 실패는 storage가 삼킨다 | R-ROOMS-004 · R-CHAT-010 |
| F-RM-09 | 행 선택 (RoomsScreen → `ListArea onSelect={onOpenRoom}`) | 행의 방 | `onOpenRoom(room)` | 행 탭·Enter·Space. S1 구현은 별도 `selectRoom` 함수 없이 `onOpenRoom`을 그대로 넘긴다(소급) | — | R-ROOMS-001 |
| F-RM-10 | `storage.*` (components.md §1.7) | — | — | components.md §1.7 | 모든 예외 삼킴 | R-ROOMS-004 · R-CHAT-010 |
| F-RM-11 | `formatMonthDay` 등 (components.md §1.6) | epoch ms | 문자열 | components.md §1.6 | — | R-ROOMS-001 |
| F-RM-12 | `revokeWrite(): void` (App, S2) | — | `clearToken()` → `setViewer(READ_ONLY_VIEWER)` | 화면이 쓰기 결과에서 `isAuthFailure(error)`를 보면 부른다. 이후 쓰기 래퍼는 헤더 없이 나간다(getter가 `null`). 두 화면의 쓰기 UI가 언마운트된다. 안내 토스트는 부른 화면이 띄운다 | 이미 읽기 전용이면 같은 값 설정(재렌더 없음) | R-CHAT-009 · R-CHAT-011 · R-CHAT-008 |
| F-RM-13 | `replaceRoomInView(room: RoomSummary): void` (App, S2) | 이름 변경 응답 | `view`가 chat이고 `view.room.id === room.id`면 `{ screen: 'chat', room }`. 아니면 그대로 | 같은 key라 ChatScreen은 다시 마운트되지 않고 상단 제목만 바뀐다. 목록은 ‹ 뒤로 때 다시 불러오므로 따로 고치지 않는다 | — | R-CHAT-001 |
| F-RM-14 | `openCreate(): void` (`useCreateRoom`, S2) | — | `create.isOpen = true` | 이미 열려 있으면 상태는 그대로. 어느 경우든 다음 커밋 뒤 `titleInputRef`에 포커스(RoomsScreen의 `useLayoutEffect([create.isOpen])`가 `isOpen`일 때 `titleInputRef.current?.focus()`) | — | R-ROOMS-002 |
| F-RM-15 | `cancelCreate(): void` (`useCreateRoom`, S2) | — | `create = { isOpen: false, title: '', isSubmitting: false }` | 취소 버튼·Esc. `isSubmitting`이면 무시. 닫힌 뒤 `newRoomButtonRef.current?.focus()` | — | R-ROOMS-002 |
| F-RM-16 | `changeTitle(value: string): void` (`useCreateRoom`, S2) | 입력값 | `create.title = value` | 잘라 내지 않는다(한도 초과도 그대로 두고 만들기만 막는다) | — | R-ROOMS-002 |
| F-RM-17 | `submitCreate(): Promise<void>` (`useCreateRoom`, S2) | — | 아래 | `submitInFlightRef`가 true이거나 `!isRoomTitleValid(title)`이면 종료. `submitInFlightRef = true`, `isSubmitting = true` → `const r = await createRoom({ title })`(trim은 서버 몫, 원문 그대로) → `submitInFlightRef = false` → 언마운트됐으면 종료 → 성공: `onCreated(r.value)` = `onOpenRoom(r.value)`(목록 갱신·재요청 없음. 새 방 기록은 ChatScreen 마운트가 한다) / 실패: `isSubmitting = false`(입력값 유지) → `onFailure(r.error)` | 래퍼는 throw 없음 | R-ROOMS-002 · R-CHAT-011 |
| F-RM-18 | `handleCreateFailure(error: ApiError): void` (RoomsScreen, S2) | 실패 | 토스트·전환 | `isAuthFailure(error)`면 먼저 `onAuthFailure()`(App F-RM-12). 그다음 `showToast(labels.writeErrorText(error), toastToneOf(error))` | 문구 표는 주 문서 §8.3 | R-CHAT-011 · R-ROOMS-002 |
| F-RM-19 | 읽기 전용 전환 effect (RoomsScreen, S2) | `viewer.canWrite` | 입력 행 정리·포커스 | `useEffect([viewer.canWrite])`: `canWrite`가 true였다가 false가 되면(이전 값 ref) `resetCreate()`(상태 초기값, `isSubmitting` 무시) → `titleRef.current?.focus()`(사라진 입력에 있던 포커스를 h1로) | 처음부터 false면 아무것도 안 함 | R-CHAT-011 · R-CHAT-008 |
| F-RM-20 | `token.ts` 함수 (components.md §1.10, S2) | `search` | 슬롯 | components.md §1.10 | 값 없음·공백 → null | R-CHAT-009 · R-NFR-004 |
| F-RM-21 | `viewerFromToken(token)` (components.md §1.8, S2) | 토큰 또는 null | `Viewer` | null이 아니면 `WRITER_VIEWER` | — | R-CHAT-008 · R-ROOMS-002 |
| F-RM-22 | `toastToneOf(error: ApiError): ToastTone` (`ui/src/state/writeFailure.ts`, S2) | 실패 | `'warning' \| 'danger'` | `isAuthFailure(error) \|\| error.code === 'RATE_LIMITED' \|\| error.code === 'LLM_BUDGET_EXCEEDED'` → `'warning'`, 그 밖 → `'danger'`(ui_design_concept §3 상태 색: 토큰 만료·레이트리밋·월 AI 한도 = 주의). (v1.5.1, S3b) `LLM_BUDGET_EXCEEDED`(429, R-LLM-007)는 speak·regenerate만 내므로 사용처는 chat 재작성 토스트(chat `design/generate.md` §3)다. rooms 방 생성은 이 코드를 받지 않는다 | — | R-CHAT-011 · R-LLM-007 |
| F-RM-23 | `countChars` · `isRoomTitleValid` (components.md §1.11, S2) | 문자열 | 수·불리언 | trim 후 코드 포인트 | — | R-ROOMS-002 |

- `useCreateRoom(options: { onCreated: (room: RoomSummary) => void; onFailure: (error: ApiError) => void }) => { create, openCreate, cancelCreate, changeTitle, submitCreate, resetCreate }`. 활성 플래그는 `useRoomsLoader`와 같은 방식(`useEffect` 마운트 true·cleanup false)으로 훅 안에 둔다. 최신 콜백은 ref로 읽는다.
- 함수 50줄·파일 400줄 한계를 지킨다. RoomsScreen은 조립·렌더만 하고 요청은 두 훅이 한다.
