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
| `viewer` | 쓰기 가능 여부 | `Viewer` | `READ_ONLY_VIEWER`(S1 상수) | `ui/src/state/viewer.ts` |

- `View` 타입은 `ui/src/App.tsx`에서 export한다.
- `ui/src/main.tsx`는 `ui/src/styles/global.css` import + `createRoot(document.getElementById('root')!).render(<App />)`만 한다(App을 테스트할 수 있게 분리).
- 방 정보(`RoomSummary`)는 rooms 목록에서 고른 객체를 그대로 chat에 넘긴다(단건 조회 엔드포인트 없음, api.md §4.0).

### 1.2 RoomsScreen (`ui/src/rooms/index.tsx`)

| 상태 | 용도 | 타입 | 초기값 | 소유 |
|---|---|---|---|---|
| `load` | 목록 요청 상태 | `RoomsLoad = { phase: 'loading' } \| { phase: 'error'; error: ApiError } \| { phase: 'ready'; rooms: RoomSummary[] }` | `{ phase: 'loading' }` | 로컬 `useState` |
| `autoOpenSettledRef` | 이 마운트에서 자동 진입 판정을 이미 했는가 | `MutableRefObject<boolean>` | `false` | 로컬 `useRef` |
| `isActiveRef` | 언마운트 뒤 도착한 응답 무시 | `MutableRefObject<boolean>` | 마운트 시 `true`, 언마운트 시 `false` | 로컬 `useRef` |
| `titleRef` | 마운트 시 포커스 대상(h1) | `RefObject<HTMLHeadingElement>` | `null` | 로컬 `useRef` |

- `RoomsLoad` 타입은 `ui/src/rooms/index.tsx`에 둔다(화면 전용). 전이는 §2의 F-RM-06만 일으킨다.
- 토큰 상태 없음. 화면은 토큰을 읽거나 저장하지 않는다.

---

## 2. 기능 명세 (function 단위)

| # | 시그니처(위치) | 입력 | 출력·상태 변경 | 동작 | 예외·분기 | 요구ID |
|---|---|---|---|---|---|---|
| F-RM-01 | `App(): JSX.Element` (`App.tsx`) | — | `view`에 따라 렌더 | `'rooms'` → `<RoomsScreen viewer autoOpenRoomId onOpenRoom={openRoom} onAutoOpenSettled={settleAutoOpen} />`. `'chat'` → `<ChatScreen key={view.room.id} room={view.room} viewer onBack={backToRooms} />` | — | R-ROOMS-001 · 004 |
| F-RM-02 | `openRoom(room: RoomSummary): void` (App) | 고른 방 | `view = { screen: 'chat', room }`, `autoOpenRoomId = null` | 화면 전환만. 마지막 본 방 저장은 ChatScreen 마운트가 한다(chat F-CH-02) | — | R-ROOMS-001 · 004 |
| F-RM-03 | `backToRooms(): void` (App) | — | `view = { screen: 'rooms' }` | ChatScreen 언마운트 → RoomsScreen 새로 마운트 → 목록을 다시 불러온다. 마지막 본 방 기록은 ChatScreen의 ‹ 뒤로(chat F-CH-10)가 이미 지웠다(주 문서 §11.2 결정 D-1). App은 저장소를 만지지 않는다 | — | R-ROOMS-004 |
| F-RM-04 | `settleAutoOpen(): void` (App) | — | `autoOpenRoomId = null` | RoomsScreen이 자동 진입 판정을 마쳤다고 알릴 때 | — | R-ROOMS-004 |
| F-RM-05 | `RoomsScreen(props: RoomsScreenProps): JSX.Element` | `{ viewer: Viewer; autoOpenRoomId: string \| null; onOpenRoom: (room: RoomSummary) => void; onAutoOpenSettled: () => void }` | 주 문서 §2.1 렌더 | 마운트 effect: `isActiveRef=true` → `titleRef.current?.focus()` → `loadRooms()`. cleanup `isActiveRef=false`. 목록 영역은 `renderListArea(load)` 지역 함수가 error → loading → data → empty 순서로 그린다 | `viewer.canWrite`는 S1에 분기 대상이 없다(S2 `right` 슬롯) | R-ROOMS-001 · 003 · 005 · R-CHAT-008 |
| F-RM-06 | `loadRooms(): Promise<void>` (RoomsScreen, `useCallback`) | — | `load` 전이 | `setLoad({ phase: 'loading' })` → `const result = await listRooms()` → `isActiveRef` false면 종료 → `result.ok` → `setLoad({ phase: 'ready', rooms: result.value })` 후 같은 이어짐에서 `resolveAutoOpen(result.value)`. 자동 진입 판정은 **목록 응답이 성공 상태일 때만** 일어난다. 두 갱신은 React 19 자동 배칭으로 한 번에 처리될 수 있어, 자동 진입이 통과하면 목록이 화면에 커밋되지 않을 수 있다(의도된 동작). 실패 → `setLoad({ phase: 'error', error: result.error })` | 래퍼는 throw 없음(api.md §3.4). 실패 시 자동 진입 판정은 다음 성공까지 미룬다 | R-ROOMS-001 · 003 · 004 |
| F-RM-07 | `retry(): void` (RoomsScreen) | — | `loadRooms()` | 오류 상태 「다시 시도」. 버튼은 오류 상태에서만 있으므로 중복 요청이 없다 | — | R-ROOMS-003 |
| F-RM-08 | `resolveAutoOpen(rooms: readonly RoomSummary[]): void` (RoomsScreen) | 성공한 목록 응답의 방 배열(호출 시점에 목록 응답이 성공 상태임이 전제. F-RM-06만 부른다) | 아래 | 렌더 결과를 기다리지 않고 응답 값으로 바로 판정한다. `autoOpenSettledRef.current`가 true면 종료. true로 바꾼 뒤: `autoOpenRoomId === null` → `onAutoOpenSettled()`만. 목록에 같은 `id`가 있음 → `onAutoOpenSettled()` 후 `onOpenRoom(room)`. 없음 → `clearLastRoomId()` 후 `onAutoOpenSettled()`(목록에 머문다) | 저장소 실패는 storage가 삼킨다 | R-ROOMS-004 · R-CHAT-010 |
| F-RM-09 | `selectRoom(room: RoomSummary): void` (RoomsScreen) | 행의 방 | `onOpenRoom(room)` | 행 탭·Enter·Space | — | R-ROOMS-001 |
| F-RM-10 | `storage.*` (components.md §1.7) | — | — | components.md §1.7 | 모든 예외 삼킴 | R-ROOMS-004 · R-CHAT-010 |
| F-RM-11 | `formatMonthDay` 등 (components.md §1.6) | epoch ms | 문자열 | components.md §1.6 | — | R-ROOMS-001 |

- 함수 50줄·파일 400줄 한계를 지킨다.
