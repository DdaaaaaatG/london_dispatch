# rooms 상세 설계 — 상태·기능 명세 (분할 문서)

> 주 문서: `ui/src/rooms/design.md`(RTM 포함). 이 파일은 주 문서 §4·§5의 상세다.
> 컴포넌트 시그니처는 `design/components.md`.

---

## 1. 상태

### 1.1 App (`ui/src/App.tsx`)

| 상태 | 용도 | 타입 | 초기값 | 소유 |
|---|---|---|---|---|
| `view` | 지금 보이는 화면 | `View = { screen: 'rooms' } \| { screen: 'chat'; room: RoomSummary } \| { screen: 'settings' }`(S3c 확장) | `{ screen: 'rooms' }` | App 로컬 `useState` |
| `autoOpenRoomId` | 시작 시 한 번만 쓰는 마지막 본 방 id | `string \| null` | `useState(() => loadLastRoomId())`(최초 렌더 1회) | App 로컬 |
| `viewer` (S2) | 쓰기 가능 여부 | `Viewer` | `useState(() => viewerFromToken(getToken()))`(최초 렌더 1회) | App 로컬 `useState`. 계산은 `ui/src/state/viewer.ts`, 토큰은 `ui/src/state/token.ts` |
| `isOwner` (S3c) | 갠홈 주인 여부(⚙ 렌더 조건) | `boolean` | `false` | App 로컬 `useState`. 판정 F-RM-24만 true로, F-RM-27만 false로 바꾼다 |
| `probeStartedRef` (S3c) | 판정 1회 보장(StrictMode 이중 effect 포함) | `MutableRefObject<boolean>` | `false` | App `useRef` |
| `roomsNotice` (S3c) | 설정 화면에서 rooms로 돌아올 때 1회 띄울 안내 | `ToastProps \| null`(`{ message; tone }`, components.md §1.18) | `null` | App 로컬 `useState`. F-RM-26이 설정, F-RM-29가 비운다 |

- `View` 타입은 `ui/src/App.tsx`에서 export한다.
- `ui/src/main.tsx`(S2): `global.css` import → `initToken(window.location.search)` → `configureClient({ getToken })` → `createRoot(document.getElementById('root'))`가 `null`이 아니면 `.render(<App />)`. URL에서 토큰을 읽어 슬롯에 넣는 곳(`initToken`)은 여기 한 번뿐이다(components.md §1.10). 슬롯 값 조회 `getToken()`은 래퍼 getter·App `viewer` 초기값·(S3c) 주인 판정 effect F-RM-24의 "토큰 있음" 확인에서만 하고, 어디서도 값을 파싱·저장·출력하지 않는다.
- 방 정보(`RoomSummary`)는 rooms 목록에서 고른 객체(또는 생성 응답)를 그대로 chat에 넘긴다(단건 조회 엔드포인트 없음, api.md §4.0).
- `viewer`는 `WRITER_VIEWER → READ_ONLY_VIEWER` 한 방향으로만 바뀐다(F-RM-12). 두 화면 모두 같은 `viewer`를 props로 받으므로 전환이 양쪽에 함께 퍼진다.
- (S3c) **주인 판정은 `viewer`를 바꾸지 않는다.** 판정 결과로 `revokeWrite`·`clearToken`·토스트를 부르지 않는다(R-SET-010). ⚙ 렌더 조건은 `viewer.canWrite && isOwner`라 어느 화면에서든 `revokeWrite`가 일어나면 ⚙도 사라진다.

### 1.2 RoomsScreen (`ui/src/rooms/index.tsx`) + `useRoomsLoader` (`ui/src/rooms/useRoomsLoader.ts`)

| 상태 | 용도 | 타입 | 초기값 | 소유 |
|---|---|---|---|---|
| `load` | 목록 요청 상태 | `RoomsLoad = { phase: 'loading' } \| { phase: 'error'; error: ApiError } \| { phase: 'ready'; rooms: readonly RoomSummary[] }` | `{ phase: 'loading' }` | `useRoomsLoader` 내부 `useState` |
| `autoOpenSettledRef` | 이 마운트에서 자동 진입 판정을 이미 했는가 | `MutableRefObject<boolean>` | `false` | `useRoomsLoader` 내부 `useRef` |
| `isActiveRef` | 언마운트 뒤 도착한 응답 무시 | `MutableRefObject<boolean>` | `false` → 활성 effect(`useEffect`)가 마운트 시 `true`, cleanup `false` | `useRoomsLoader` 내부 |
| `latestRef` | 부모 콜백(`autoOpenRoomId`·`onOpenRoom`·`onAutoOpenSettled`) 최신 값 | `MutableRefObject<AutoOpenHandlers>` | 첫 handlers, 매 렌더 `useLayoutEffect`로 갱신 | `useRoomsLoader` 내부 |
| `titleRef` | 마운트·전환 시 포커스 대상(h1) | `RefObject<HTMLHeadingElement>` | `null` | RoomsScreen `useRef` |
| `create` (S2 · **S6 `password` 추가**) | 새 방 입력 행 상태 | `{ isOpen: boolean; title: string; password: string; isSubmitting: boolean }` | `{ isOpen: false, title: '', password: '', isSubmitting: false }` | `useCreateRoom`(`ui/src/rooms/useCreateRoom.ts`) 내부 `useState` |
| `submitInFlightRef` (S2) | 같은 틱 연타(Enter·클릭) 중복 제출 방지 | `MutableRefObject<boolean>` | `false` | `useCreateRoom` 내부 |
| `toast` (S2) | 실패 안내 | `ToastState` | `null` | `useToast()`(공용 훅) |
| `newRoomButtonRef` · `titleInputRef` (S2) | 「+ 새 방」 포커스 복귀 · 입력 포커스 | `RefObject<HTMLButtonElement>` · `RefObject<HTMLInputElement>` | `null` | RoomsScreen `useRef` |

- `RoomsLoad`·`AutoOpenHandlers`·`UseRoomsLoaderResult` 타입은 `useRoomsLoader.ts`에서 export한다(S1 실물 소급, v1.4).
- **(S6)** RoomsScreen은 `const entry = useRoomEntry({ canWrite: viewer.canWrite, onEntered: onOpenRoom, onRoomGone: retry })`를 더 부르고 `entry.sheet && <RoomEntrySheet sheet={entry.sheet} onSubmit={entry.submitPassword} onCancel={entry.cancelEntry} />`를 렌더한다. 입장 시트 상태(`sheet`·`quietInFlightRef`·`submitInFlightRef`)와 증명 캐시는 `design/lock.md` §3.
- 토큰 값은 화면이 모른다. `viewer.canWrite`만 본다.

---

## 2. 기능 명세 (function 단위)

| # | 시그니처(위치) | 입력 | 출력·상태 변경 | 동작 | 예외·분기 | 요구ID |
|---|---|---|---|---|---|---|
| F-RM-01 | `App(): JSX.Element` (`App.tsx`) | — | `view`에 따라 렌더 | (S3c) `'settings'` → F-RM-26의 `<SettingsScreen …/>`. `'rooms'` → `<RoomsScreen viewer autoOpenRoomId onOpenRoom={openRoom} onAutoOpenSettled={settleAutoOpen} onAuthFailure={revokeWrite} isOwner onOpenSettings={openSettings} entryNotice={roomsNotice} onEntryNoticeShown={clearRoomsNotice} />`(S3c 4개 추가, `clearRoomsNotice = useCallback(() => setRoomsNotice(null), [])`). `'chat'` → `<ChatScreen key={view.room.id} room={view.room} viewer onBack={backToRooms} onAuthFailure={revokeWrite} onRoomRenamed={replaceRoomInView} />` | 콜백은 전부 `useCallback([])` | R-ROOMS-001 · 004 · R-CHAT-008 |
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
| F-RM-19 | 읽기 전용 전환 effect (RoomsScreen, S2) | `viewer.canWrite` | 입력 행 정리·포커스 | `useEffect([viewer.canWrite])`: `canWrite`가 true였다가 false가 되면(이전 값 ref) `resetCreate()`(상태 초기값, `isSubmitting` 무시) → `titleRef.current?.focus()`(사라진 입력에 있던 포커스를 h1로). **(S6) 입장 시트가 열려 있으면(`entry.sheet !== null`) h1 포커스를 건너뛴다**(포커스는 시트 안, lock.md §10) | 처음부터 false면 아무것도 안 함 | R-CHAT-011 · R-CHAT-008 |
| F-RM-20 | `token.ts` 함수 (components.md §1.10, S2) | `search` | 슬롯 | components.md §1.10 | 값 없음·공백 → null | R-CHAT-009 · R-NFR-004 |
| F-RM-21 | `viewerFromToken(token)` (components.md §1.8, S2) | 토큰 또는 null | `Viewer` | null이 아니면 `WRITER_VIEWER` | — | R-CHAT-008 · R-ROOMS-002 |
| F-RM-22 | `toastToneOf(error: ApiError): ToastTone` (`ui/src/state/writeFailure.ts`, S2) | 실패 | `'warning' \| 'danger'` | `isAuthFailure(error) \|\| error.code === 'RATE_LIMITED' \|\| error.code === 'LLM_BUDGET_EXCEEDED'` → `'warning'`, 그 밖 → `'danger'`(ui_design_concept §3 상태 색: 토큰 만료·레이트리밋·월 AI 한도 = 주의). (v1.5.1, S3b) `LLM_BUDGET_EXCEEDED`(429, R-LLM-007)는 speak·regenerate만 내므로 사용처는 chat 재작성 토스트(chat `design/generate.md` §3)다. rooms 방 생성은 이 코드를 받지 않는다 | — | R-CHAT-011 · R-LLM-007 |
| F-RM-23 | `countChars` · `isRoomTitleValid` (components.md §1.11, S2) | 문자열 | 수·불리언 | trim 후 코드 포인트 | — | R-ROOMS-002 |
| F-RM-24 | 주인 판정 effect (App, S3c) | — | `isOwner` | `useEffect(() => { if (probeStartedRef.current) return; probeStartedRef.current = true; if (getToken() === null) return; void getCharacterSettings().then(r => { if (r.ok) setIsOwner(true) }) }, [])`. **첫 렌더 뒤 1회.** 응답 본문은 버린다(설정 화면은 들어갈 때 다시 읽는다, settings design.md §11 D-ST-5). 실패(401·403 `LEVEL_TOO_LOW`·403 `OWNER_ONLY`·`NETWORK`·5xx)는 **아무것도 하지 않는다** — `revokeWrite`·`onAuthFailure`·토스트 없음(R-SET-010) | 취소 플래그를 두지 않는다: App은 앱 수명 내내 마운트돼 있고, StrictMode의 effect 재실행은 ref 가드가 막으므로 cleanup으로 결과를 버리면 판정이 영영 안 된다. 응답 전에 `revokeWrite`가 일어나도 ⚙는 `viewer.canWrite` 조건으로 안 보인다 | R-SET-010 · R-CHAT-011 |
| F-RM-25 | `openSettings(): void` (App, `useCallback([])`, S3c) | — | `view = { screen: 'settings' }`, `autoOpenRoomId = null` | rooms ⚙ 클릭 | — | R-SET-009 |
| F-RM-26 | `leaveSettings(notice?: ToastProps): void` (App, `useCallback([])`, S3c) | 안내(선택) | `roomsNotice = notice ?? null` → `view = { screen: 'rooms' }` | SettingsScreen `onLeave`. RoomsScreen이 새로 마운트되어 목록을 다시 불러온다(F-RM-03과 같다). 렌더 분기: `view.screen === 'settings'` → `<SettingsScreen onLeave={leaveSettings} onAuthFailure={revokeWrite} onOwnerLost={loseOwner} />` | 마지막 본 방 기록은 건드리지 않는다(설정 화면은 방이 아니다) | R-SET-009 |
| F-RM-27 | `loseOwner(): void` (App, `useCallback([])`, S3c) | — | `isOwner = false` | SettingsScreen이 열기·저장에서 `OWNER_ONLY`를 받으면 부른다. `viewer`는 그대로(읽기 전용 전환 아님) | 다시 true로 되는 경로는 새로 고침(판정 재실행)뿐 | R-SET-010 · R-SET-001 |
| F-RM-28 | ⚙ 렌더 (RoomsScreen, S3c) | `viewer.canWrite` · `isOwner` · `onOpenSettings` | 상단 바 오른쪽 | `TopBar right={viewer.canWrite ? <div className={styles.topActions}>{isOwner && onOpenSettings && <IconButton icon='settings' ariaLabel={labels.settingsAriaLabel} onClick={onOpenSettings} />}<Button …「+ 새 방」/></div> : undefined}`. ⚙가 「+ 새 방」 **왼쪽**, 간격 `--space-2`. 판정이 늦게 끝나 ⚙가 나중에 나타나도 「+ 새 방」 위치는 그대로다(오른쪽 끝 고정) | 비주인·판정 실패·토큰 없음이면 DOM에 없음(숨김 아님) | R-SET-009 · R-SET-010 · R-ROOMS-002 |
| F-RM-29 | `useEntryNotice({ entryNotice, onEntryNoticeShown, showToast }): void` (`ui/src/rooms/useEntryNotice.ts`, S3c · v1.6.2 실물) | `entryNotice` · `onEntryNoticeShown` · `showToast`(= `useNewRoomUi` 반환값) | 토스트 1회 | RoomsScreen이 부른다. 마운트 `useEffect([])`: `shownRef`가 true면 종료 → true로 → `latestRef`(매 렌더 layout effect 갱신)에서 읽어 `entryNotice`가 있으면 `showToast(entryNotice.message, entryNotice.tone)` → `onEntryNoticeShown?.()`(App `roomsNotice = null`). 다시 렌더되거나 StrictMode effect 재실행이어도 마운트당 1회 | 없으면 아무것도 안 함 | R-SET-010 · R-CHAT-011 |

- (S3c) `RoomsScreenProps`에 **선택** props 4개를 더한다: `isOwner?: boolean`(기본 false) · `onOpenSettings?: () => void` · `entryNotice?: ToastProps | null`(기본 null) · `onEntryNoticeShown?: () => void`. 선택으로 두어 S1·S2 스펙은 고치지 않아도 된다. App은 넷 다 넘긴다.
- (S3c) App 통합 테스트 주의: 토큰이 있는 App 테스트는 `getCharacterSettings`도 모킹해야 한다(`vi.mock('@/api')` 반환 객체에 추가). 없으면 판정 effect가 undefined를 호출한다.
- (v1.6.2 실측) chat 스펙 3개(AuthTransition·RoomMenu·SpeakFlow)는 판정 래퍼 mock 없이 통과한다. 실물 래퍼가 throw하지 않고 실패를 조용히 비주인으로 끝내기 때문이다. 다만 완전 격리는 아니다. 격리용 mock 2줄 추가를 보강 모드 CR 후보로 둔다(rooms scenarios 대기열 Q-02, 소유 ui-test-designer).
- (v1.6.2 실물) App은 설정 진입·이탈(F-RM-25·26, `roomsNotice`)을 지역 훅 `useSettingsNav`로, 주인 판정(F-RM-24·27, `isOwner`·`probeStartedRef`)을 지역 훅 `useOwner`로 나눴다. `openSettings`는 `useCallback([setView, settleAutoOpen])`이고 `settleAutoOpen()`으로 자동 진입 id를 비운다. `useNewRoomUi`는 `showToast`도 반환한다(F-RM-29 입력).

- **(S6 개정 — 상세 `design/lock.md` §4)** F-RM-08 `resolveAutoOpen`: 대상이 잠긴 방이고 저장된 증명이 없으면 기록 삭제 후 목록(F-RM-52). F-RM-09 행 선택: `onSelect = entry.requestEntry`(F-RM-47). F-RM-15·19: 초기값에 `password: ''`(F-RM-51). F-RM-17 `submitCreate`: 비밀번호 가드·본문·증명 저장(F-RM-50). 신규 `changePassword`(F-RM-49). `useNewRoomUi`는 `changePassword`를 더 반환하고 `NewRoomSection`이 `password`·`onChangePassword`를 넘긴다. S6 함수 F-RM-30~54는 lock.md에만 있다.
- `useCreateRoom(options: { onCreated: (room: RoomSummary) => void; onFailure: (error: ApiError) => void }) => { create, openCreate, cancelCreate, changeTitle, changePassword /* S6 */, submitCreate, resetCreate }`. 활성 플래그는 `useRoomsLoader`와 같은 방식(`useEffect` 마운트 true·cleanup false)으로 훅 안에 둔다. 최신 콜백은 ref로 읽는다.
- 함수 50줄·파일 400줄 한계를 지킨다. RoomsScreen은 조립·렌더만 하고 요청은 두 훅이 한다.

---

## 부록 A. 주 문서 변경이력 v1.0~v1.5 (v1.6.2에 주 문서에서 옮김, 내용 그대로)

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v1.0 | 2026-10-05 | 최초 작성(S1 읽기 전용). 40KB 한계로 `design/*.md` 3개 분할 | 구축 S1 |
| v1.1 | 2026-10-05 | ‹ 뒤로 시 마지막 본 방 기록 삭제로 변경: §6.2 · §11.2 D-1 · functions.md F-RM-03 · TC-RM-012 | 메인 세션 결정 |
| v1.2 | 2026-10-05 | 계약 인용 v0.2 · §8.1 `listAriaLabel` 삭제(ul aria-label 없음, components.md §2.2) · §11.2 D-2(main.tsx/App.tsx 분리) · §14 R-NFR-004 행 | 검증 DC-03·04·06·07 |
| v1.3 | 2026-10-05 | named export 규칙(components.md 머리말) · TC-RM-016 판별 기준(React 19) · CF-01: §6.2 자동 진입 시 목록 미커밋 가능 명시, functions.md F-RM-06·08과 TC-RM-008을 "판정 시점에 목록 응답이 성공 상태"로 재정의(동작 변경 없음) | 시나리오 검증 지적 · conflict-checker CF-01 메인 세션 결정 |
| v1.4 | 2026-10-05 | **S1 실물 소급**(§11.3 델타 R-1~R-6: `useRoomsLoader` 분리, `loadRooms`가 loading을 설정하지 않음, `ListArea` 지역 컴포넌트, `selectRoom` 없음, App 콜백 `useCallback`, `READ_ONLY_VIEWER` freeze). **S2 상세**: R-ROOMS-002 본문 승격(§2.2·§6.5·§7·§8.3·§10), 토큰·viewer·한도·공용 입력/시트/토스트 단일 정의(components.md §1.10~§1.20), F-RM-12~23, TC-RM-018~032, 계약 인용 v0.3 | 구축 S2 |
| v1.5 | 2026-10-05 | 검증 MINOR 반영: DC-06 F-RM-03 참조(F-CH-27) · DC-07 변경이력 TC 범위 · DC-09 공용 미사용 표면 삭제(`useToast.dismissToast`·`--btn-busy-opacity`·TextInput/TextArea/Toggle `isDisabled`), IconButton `isDisabled` 추가(chat ⋯, 승인) · DC-10 §14 R-API-003 참조 행(R-CHAT-009로 닫힘) | ui-design-checker MINOR · 메인 세션 결정 DC-10 |
