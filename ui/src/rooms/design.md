# rooms(방 목록) 화면 — 상세 설계

## 1. 개요

| 항목 | 값 |
|---|---|
| 화면 | rooms · 폴더 `ui/src/rooms/` |
| 목적 | 방(에피소드) 목록을 최신순으로 보여 주고, 행을 누르면 그 방의 대화 화면으로 보낸다. 패널을 다시 열면 마지막에 본 방으로 바로 들어간다. 등급 통과 회원은 「+ 새 방」으로 방을 만들고 바로 그 방에 들어간다 |
| 요구 | `ui/src/rooms/requirements.md` v1.4(확정) |
| 구성안 | `doc/200_설계/architecture/ui-layout-01-rooms-chat.md` §1(패턴 L1) — **수용, 구조 변경 없음** |
| 계약 | `doc/200_설계/contract/api.md` **v0.3** §2.4(토큰 보관·전환) · §4.2(`listRooms`) · §4.6(`createRoom`) · §11.6 — 확정 |
| 묶음 | S1(R-ROOMS-001·003·004·005) 구현 완료 + **S2 상세**: R-ROOMS-002, 참조 R-CHAT-008(새 방 렌더 쌍)·R-CHAT-009(토큰 보관 — 공용 정의가 이 설계에 있다)·R-CHAT-011(생성 실패 안내·전환) |
| 레이아웃 확정 상태 | **확정**(읽기 전용 판 · 토큰 있음 판). 토큰 있음 판의 토스트 줄 위치는 설계 가정 A-3(구성안 §3 "Toast 두 화면" 근거, 그림에는 없음) |
| 문서 분할 | 40KB 한계로 분할: `design/components.md`(컴포넌트·공용 요소 단일 정의·스타일) · `design/functions.md`(상태·기능) · `design/a11y.md`(접근성). RTM은 이 문서 §14 |
| 이 설계가 단일 정의하는 공용 요소 | `ui/src/App.tsx`(화면 분기·viewer) · `ui/src/main.tsx` · `ui/src/state/{viewer,token,limits,writeFailure}.ts` · `ui/src/components/ui/{TopBar,Button,IconButton,StateView,TextInput,TextArea,Toggle,BottomSheet,ConfirmDialog,PromptSheet,Toast}` · `ui/src/components/hooks/{useToast,useLongPress}.ts` · `ui/src/components/utils/{cx,formatDate,storage}.ts`. chat 설계는 이 정의를 인용한다 |

비유: 앱은 도서관 열람실이다. 방 목록은 서가 안내판이고, 대화 화면은 펼친 책이다. 안내판은 지난번에 펼쳐 둔 책을 기억해 두었다가(책갈피 = `localStorage`) 다시 오면 그 책을 바로 펼쳐 준다. 출입증(토큰)이 있는 회원은 안내판 옆 「+ 새 방」으로 새 책을 꽂고 곧장 펼친다. 출입증은 주머니(메모리)에만 있고 서랍에는 넣지 않는다.

### 변경이력

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v1.0 | 2026-10-05 | 최초 작성(S1 읽기 전용). 40KB 한계로 `design/*.md` 3개 분할 | 구축 S1 |
| v1.1 | 2026-10-05 | ‹ 뒤로 시 마지막 본 방 기록 삭제로 변경: §6.2 · §11.2 D-1 · functions.md F-RM-03 · TC-RM-012 | 메인 세션 결정 |
| v1.2 | 2026-10-05 | 계약 인용 v0.2 · §8.1 `listAriaLabel` 삭제(ul aria-label 없음, components.md §2.2) · §11.2 D-2(main.tsx/App.tsx 분리) · §14 R-NFR-004 행 | 검증 DC-03·04·06·07 |
| v1.3 | 2026-10-05 | named export 규칙(components.md 머리말) · TC-RM-016 판별 기준(React 19) · CF-01: §6.2 자동 진입 시 목록 미커밋 가능 명시, functions.md F-RM-06·08과 TC-RM-008을 "판정 시점에 목록 응답이 성공 상태"로 재정의(동작 변경 없음) | 시나리오 검증 지적 · conflict-checker CF-01 메인 세션 결정 |
| v1.4 | 2026-10-05 | **S1 실물 소급**(§11.3 델타 R-1~R-6: `useRoomsLoader` 분리, `loadRooms`가 loading을 설정하지 않음, `ListArea` 지역 컴포넌트, `selectRoom` 없음, App 콜백 `useCallback`, `READ_ONLY_VIEWER` freeze). **S2 상세**: R-ROOMS-002 본문 승격(§2.2·§6.5·§7·§8.3·§10), 토큰·viewer·한도·공용 입력/시트/토스트 단일 정의(components.md §1.10~§1.20), F-RM-12~23, TC-RM-018~032, 계약 인용 v0.3 | 구축 S2 |
| v1.5 | 2026-10-05 | 검증 MINOR 반영: DC-06 F-RM-03 참조(F-CH-27) · DC-07 변경이력 TC 범위 · DC-09 공용 미사용 표면 삭제(`useToast.dismissToast`·`--btn-busy-opacity`·TextInput/TextArea/Toggle `isDisabled`), IconButton `isDisabled` 추가(chat ⋯, 승인) · DC-10 §14 R-API-003 참조 행(R-CHAT-009로 닫힘) | ui-design-checker MINOR · 메인 세션 결정 DC-10 |

---

## 2. 레이아웃 (ASCII, 390px 기준 약 48칸)

### 2.1 읽기 전용 판 [확정]

토큰이 없는 방문자(또는 인증 실패로 전환된 회원)가 보는 판.

```
+----------------------------------------------+
| ROOMS                                        |  A 상단 바        44px
+----------------------------------------------+
| 티타임                                 10.05 |  C 방 목록 flex   521px (행 56px)
+----------------------------------------------+
| 체스 대결                              10.03 |
+----------------------------------------------+
|                                              |
+----------------------------------------------+
```

C 상태 변형(판정 순서 error → loading → data → empty):

```
+----------------------------------------------+
|                 불러오는 중                  |  loading
+----------------------------------------------+
|              아직 방이 없습니다              |  empty
+----------------------------------------------+
|          목록을 불러오지 못했습니다          |  error 제목
|         서버에 연결할 수 없습니다.           |  error 상세(코드별, §8.2)
|                 [다시 시도]                  |
+----------------------------------------------+
```

### 2.2 토큰 있음 판 [확정 — 구성안 §1 그대로, S2]

```
+----------------------------------------------+
| ROOMS                              [+ 새 방] |  A 상단 바 44px (오른쪽 Button md primary)
+----------------------------------------------+
| [새 방 제목 입력        0/60] [취소] [만들기]|  B 새 방 입력 행 52px (「+ 새 방」을 누른 뒤에만)
+----------------------------------------------+
| 티타임                                 10.05 |  C 방 목록 flex 469px (B 열림) / 521px (B 닫힘)
+----------------------------------------------+
| 체스 대결                              10.03 |
+----------------------------------------------+
| 요청이 너무 많습니다. 40초 후 다시 ...       |  E' 토스트 줄 28px+ (실패 시 2초만) [설계 가정 A-3]
+----------------------------------------------+
```

- B 변형: 요청 중이면 입력 읽기 전용·취소/만들기 비활성. 카운터가 60을 넘으면 danger 색, 만들기 비활성.
- 생성 성공은 목록을 거치지 않고 chat으로 바뀐다(§6.5).

### 2.3 세로·가로 배분

| 영역 | 높이 | 비고 |
|---|---|---|
| 화면 루트 | 부모 100%(`height: 100%` 체인), `display: flex; flex-direction: column; position: relative` | `100vh`·`100dvh` 금지 |
| A 상단 바 | 44px 고정 | `flex: none` |
| B 새 방 입력 행 (S2) | 52px 고정 | 열렸을 때만 |
| C 방 목록 | 나머지(`flex: 1; min-height: 0; overflow-y: auto`) | 390×565 기준 521px(B 없음) / 469px(B 있음) |
| E' 토스트 줄 (S2) | 최소 28px(두 줄이면 늘어남) | 토스트가 있을 때만, `flex: none` |
| 행 | 56px | 터치 타깃 44 이상 |

- 폭 ≥ 480: 콘텐츠 최대 폭 480 중앙. 폭 ≤ 360: 변화 없음(구성안 §4의 날짜 생략은 chat 상단 바 대상).
- 가로 스크롤 금지. 긴 제목은 한 줄 말줄임. B 행 입력은 `flex: 1; min-width: 0`.

---

## 3. 컴포넌트 설계

### 3.1 컴포넌트 트리

```
ui/src/main.tsx                     global.css · initToken(location.search) · configureClient({ getToken }) · render(<App />)
└─ App (ui/src/App.tsx)             view · autoOpenRoomId · viewer(S2) 로 rooms / chat 분기 (외부 라우터 없음)
   ├─ RoomsScreen (ui/src/rooms/index.tsx)          view.screen === 'rooms'
   │  ├─ TopBar  [공용 ui]          title="ROOMS"
   │  │   right = viewer.canWrite && Button [공용 ui] 「+ 새 방」(S2)
   │  ├─ NewRoomRow [rooms 로컬, S2] viewer.canWrite && create.isOpen
   │  │   ├─ TextInput [공용 ui, S2]
   │  │   └─ Button × 2 (취소 · 만들기)
   │  ├─ 목록 영역 <section>
   │  │  └─ ListArea [rooms 지역 컴포넌트]
   │  │     ├─ StateView [공용 ui]  error | loading | empty
   │  │     └─ RoomList [rooms 로컬] data (ul)
   │  │        └─ ListRow [rooms 로컬, 승격 후보] × n
   │  └─ Toast [공용 ui, S2]        toast !== null
   └─ ChatScreen (ui/src/chat/index.tsx)            view.screen === 'chat'  (chat/design.md)
훅: useRoomsLoader(목록·자동 진입) · useCreateRoom(S2, 새 방) · useToast(S2, 공용)
```

### 3.2 배치 3단계 분류

`component-catalog` 스킬 인벤토리는 비어 있다(2026-10-05 확인, S1 구현분 등록 전). 아래 공용 요소는 카탈로그 「미구현 후보」·구성안 §3 이름과 맞췄다.

| 컴포넌트·모듈 | 위치 | 분류 | 근거 | 쓰는 화면 | 상세 |
|---|---|---|---|---|---|
| `App` · `main.tsx` | `ui/src/` | 진입 | 스킬 §3.3 #8 | 전체 | functions.md §1.1 |
| `TopBar` | `ui/src/components/ui/TopBar/` | ① 공용 ui | 구성안 §3 | rooms · chat | components.md §1.1 |
| `Button` | `ui/src/components/ui/Button/` | ① 공용 ui (S2 `buttonRef` 추가) | 카탈로그 후보 | rooms · chat | §1.2 |
| `IconButton` | `ui/src/components/ui/IconButton/` | ① 공용 ui (S2 `more` 추가) | 구성안 §3 | chat | §1.3 |
| `StateView` | `ui/src/components/ui/StateView/` | ① 공용 ui | 구성안 §3 | rooms · chat | §1.4 |
| `TextInput` (S2) | `ui/src/components/ui/TextInput/` | ① 공용 ui 신규 | 구성안 §3 | rooms B · chat 이름 변경 | §1.12 |
| `TextArea` · `Toggle` (S2) | `ui/src/components/ui/` | ① 공용 ui 신규 | 구성안 §3 · 카탈로그 후보 | chat | §1.13 · §1.14 |
| `BottomSheet`+`SheetItem` · `ConfirmDialog` · `PromptSheet` (S2) | `ui/src/components/ui/` | ① 공용 ui 신규 | 구성안 §3 · 카탈로그 후보 | chat | §1.15~§1.17 |
| `Toast` (S2) | `ui/src/components/ui/Toast/` | ① 공용 ui 신규 | 구성안 §3(두 화면) | rooms · chat | §1.18 |
| `useToast` · `useLongPress` (S2) | `ui/src/components/hooks/` | ② 공용 훅 신규 | 구성안 §3 · 카탈로그 후보 | rooms·chat · chat | §1.18 · §1.19 |
| `cx` · `formatDate` · `storage` | `ui/src/components/utils/` | ③ 공용 유틸 | ui_design_concept §1 | 전체 | §1.5~§1.7 |
| `viewer` · `token` · `limits` · `writeFailure` | `ui/src/state/` | 상태 모듈(순수·메모리) | 스킬 §6.6 · api.md §2.4 | rooms · chat | §1.8 · §1.10 · §1.11 · functions.md F-RM-22 |
| `useRoomsLoader` · `useCreateRoom`(S2) | `ui/src/rooms/` | 화면 로컬 훅 | 50줄 한계 분리 | rooms | functions.md §1.2 |
| `RoomList` · `ListArea` · `NewRoomRow`(S2) | `ui/src/rooms/` | ④ rooms 로컬 | 목록·입력 행 JSX 분리 | rooms | components.md §2.2~§2.4 |
| `ListRow` | `ui/src/rooms/components/ListRow.tsx` | ④ rooms 로컬 · **공용 승격 후보** | 구성안 §3 | rooms | §2.1 |

- 화면 코드(`index.tsx`)는 표준 HTML 원소를 직접 쓰지 않는다. `<button>`·`<input>`은 공용 ui·`ListRow` 안에만 있다. `<main>`·`<section>`·`<ul>`·`<li>`·`<h1>`은 시맨틱 컨테이너로 허용.
- Props·시그니처 전문: `design/components.md`.

---

## 4. 상태 → `design/functions.md` §1

요약: App `view`(초기 `{ screen: 'rooms' }`) · `autoOpenRoomId`(초기 `loadLastRoomId()`) · **`viewer`(S2, 초기 `viewerFromToken(getToken())`, `revokeWrite`로 한 방향 전환)**. RoomsScreen `useRoomsLoader`(`load` 초기 loading, `autoOpenSettledRef`, `isActiveRef`, `latestRef`) · `titleRef` · **S2** `useCreateRoom`(`create = { isOpen: false, title: '', isSubmitting: false }`, `submitInFlightRef`) · `useToast`(`toast = null`) · `newRoomButtonRef`·`titleInputRef`. 토큰 값은 `ui/src/state/token.ts` 메모리 슬롯에만 있다.

## 5. 기능 명세 → `design/functions.md` §2

F-RM-01 `App` · 02 `openRoom` · 03 `backToRooms` · 04 `settleAutoOpen` · 05 `RoomsScreen` · 06 `loadRooms` · 07 `retry` · 08 `resolveAutoOpen` · 09 행 선택 · 10 `storage.*` · 11 `formatDate`. **S2**: 12 `revokeWrite` · 13 `replaceRoomInView` · 14 `openCreate` · 15 `cancelCreate` · 16 `changeTitle` · 17 `submitCreate` · 18 `handleCreateFailure` · 19 전환 effect · 20 `token.ts` · 21 `viewerFromToken` · 22 `toastToneOf` · 23 `countChars`·`isRoomTitleValid`.

---

## 6. 파이프라인

### 6.1 정상 — 첫 진입(저장된 방 없음)

```
main.tsx: initToken(location.search) → configureClient({ getToken }) → <App />
App 마운트 → viewer = viewerFromToken(getToken()) · autoOpenRoomId = loadLastRoomId() = null
 → RoomsScreen 마운트 → load=loading → StateView "불러오는 중"
 → listRooms() ok(토큰 헤더 없음) → load=ready → RoomList → resolveAutoOpen → onAutoOpenSettled → App.autoOpenRoomId=null
 → 행 탭 → onOpenRoom(room) → App.view=chat → ChatScreen 마운트(saveLastRoomId(room.id))
```

### 6.2 정상 — 재방문(저장된 방 있음, R-ROOMS-004)

```
App 마운트 → autoOpenRoomId = 'r1'
 → RoomsScreen loading → listRooms() ok → 목록에 r1 있음
 → onAutoOpenSettled → onOpenRoom(r1) → ChatScreen(r1)
 → ‹ 뒤로 → clearLastRoomId()(chat F-CH-10) → backToRooms → RoomsScreen 새 마운트(autoOpenRoomId=null) → 목록 다시 로드 → 목록에 머문다
 → 이 상태로 패널을 닫았다 다시 열면 저장된 방이 없으므로 목록에서 시작(§6.1)
```
- 목록 응답 직후 자동 진입 판정이 통과하면 chat으로 바뀐다. 목록 상태 설정과 화면 전환이 같은 비동기 이어짐 안에서 연속으로 일어나므로, React 19 자동 배칭 때문에 목록은 화면에 **커밋되지 않을 수 있다**. 목록이 보였는지는 보장하지도 검증하지도 않는다. 보장하는 것은 "판정 시점에 목록 응답이 성공 상태였다"는 것뿐이다(목록이 와야 방 정보를 안다, 단건 조회 없음).

### 6.3 저장된 방이 사라짐

```
autoOpenRoomId='gone' → listRooms() ok, 목록에 없음 → clearLastRoomId() → onAutoOpenSettled → 목록 유지
```

### 6.4 오류

| 단계 | 상황 | 화면 | 다음 |
|---|---|---|---|
| 목록 로드 | `listRooms` 실패(모든 코드) | StateView error: `목록을 불러오지 못했습니다` + 상세(§8.2) + 「다시 시도」 | 「다시 시도」 → loading → 재요청 |
| 목록 로드 실패 + 저장된 방 있음 | 위와 같음 | 같음 | 자동 진입 보류. 재시도가 성공하면 그때 판정(F-RM-08) |
| 저장소 읽기 실패 | `localStorage` throw | 영향 없음(`autoOpenRoomId = null`과 같다) | 일반 목록 흐름 |
| 저장소 쓰기·삭제 실패 | throw | 영향 없음 | — |
| 언마운트 후 응답 | 자동 진입으로 chat 전환 뒤 늦은 응답 | 버린다(`isActiveRef`) | — |
| (S2) 방 생성 | §6.5 | | |

### 6.5 방 생성 (S2, R-ROOMS-002)

```
「+ 새 방」 → openCreate → B 행 열림 → 입력 포커스 (카운터 0/60, 만들기 비활성)
 → 제목 입력 → isRoomTitleValid = 1~60자(trim 후 코드 포인트) → 만들기 활성
 → 만들기 클릭 또는 Enter(IME 조합 중 제외)
   → submitInFlightRef = true · isSubmitting = true (입력 읽기 전용, 두 버튼 비활성)
   → createRoom({ title })   // Authorization: Bearer <getToken()>, 래퍼가 붙인다
   ├ 201 ok   → onOpenRoom(응답 RoomSummary) → App.view = chat → ChatScreen 마운트 → saveLastRoomId(새 id)
   │            (목록 재요청·끼워 넣기 없음. ‹ 뒤로 때 목록을 다시 불러오면 맨 위에 있다)
   └ 실패     → isSubmitting = false (B 행·입력값 유지)
               ├ isAuthFailure → App.revokeWrite → 「+ 새 방」·B 미렌더 → h1 포커스 → 토스트(전환 안내)
               └ 그 밖        → 토스트(§8.3 코드별 문구), 다시 만들기 가능
취소 · Esc → B 닫힘, 입력 비움, 「+ 새 방」 포커스 (요청 중이면 무시)
```

- 중복 제출 방지는 상태 기반(`submitInFlightRef` + `isSubmitting`)이다. 디바운스 없음.
- 파괴 조작 없음(rooms에는 삭제·변경이 없다 — 방 이름 변경·삭제는 chat ⋯ 메뉴). confirm 대상 없음. 생성 중 상태 없음(S3 speak는 chat).

---

## 7. contract 계약 사용표

api.md **v0.3**을 **인용**한다(재정의 아님).

| 엔드포인트 | 요청 | 응답 타입(`shared/src/types.ts`) | 래퍼(`@/api`) | 호출 위치 | 토큰 헤더 | 실패 시 표시 |
|---|---|---|---|---|---|---|
| `GET /api/rooms` (api.md §4.2, E3) | 없음 | `RoomSummary[]` = `{ id: string; title: string; createdAt: number; updatedAt: number; messageCount: number }[]` | `listRooms(): Promise<Result<RoomSummary[]>>` | F-RM-06 `loadRooms` | 불필요(래퍼가 붙이지 않음, api.md §2.1) | StateView error, 상세 §8.2 |
| `POST /api/rooms` (api.md §4.6, E4) — S2 | `CreateRoomBody = { title: string }`(입력 원문, trim은 서버) | `201` `RoomSummary`(`title` trim됨, `messageCount: 0`) | `createRoom(body: CreateRoomBody): Promise<Result<RoomSummary>>` | F-RM-17 `submitCreate` | **필요** — 래퍼가 `getToken()`으로 `Authorization: Bearer` 부착(api.md §2.2·§11.6). 화면은 헤더를 만들지 않는다 | 토스트 §8.3. 인증 실패면 전환(F-RM-12) |
| (엔드포인트 아님) 토큰 getter 주입 | `configureClient({ getToken })` | `ClientConfig = { getToken: () => string \| null }` | `configureClient` · `isAuthFailure(error): boolean` | `main.tsx` 1회 · F-RM-18 | — | — |

- `Result<T> = { ok: true; value: T } | { ok: false; error: ApiError }`, `ApiError = { code: ApiErrorCode; message: string; retryAfterSec?: number }`, `ApiErrorCode = ErrorCode | 'NETWORK'`(api.md §11.6). 래퍼는 throw하지 않으므로 화면에 `try/catch`가 없다.
- `createRoom`이 낼 수 있는 코드: 공통(api.md §4.5) `CONFIG_INVALID`·`TOKEN_REQUIRED`·`TOKEN_INVALID`·`LEVEL_TOO_LOW`·`RATE_LIMITED`(+`retryAfterSec`)·`VALIDATION_ERROR`·`INTERNAL` + 클라이언트 `NETWORK`. 화면이 1~60자를 먼저 막으므로 `VALIDATION_ERROR`는 정상 경로에서 나오지 않는다.
- 테스트는 `vi.mock('@/api')`(또는 `@/api/rooms`)로 `listRooms`·`createRoom`을 모킹한다. `fetch`를 모킹하지 않는다. 토큰 상태는 `initToken('?t=test-token')`·`clearToken()`으로 준비·정리한다.
- 미확정 계약 없음. 권고 1건(§12 CR-C-2, 막지 않음).

---

## 8. 확정 문구·라벨 표 (`ui/src/rooms/labels.ts` 단일 소스)

### 8.1 문구

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `screenTitle` | `ROOMS` | TopBar 제목(h1) |
| `screenAriaLabel` | `방 목록` | 화면 루트 `<main aria-label>`. 같은 이름이 겹치지 않도록 `<ul>`에는 aria-label을 두지 않는다 |
| `rowAriaLabel(title, dateText)` | `` `${title}, 마지막 갱신 ${dateText}` `` | ListRow `aria-label` |
| `loading` | `불러오는 중` | StateView loading |
| `empty` | `아직 방이 없습니다` | StateView empty |
| `loadError` | `목록을 불러오지 못했습니다` | StateView error 제목 |
| `retry` | `다시 시도` | StateView error 버튼 |
| `newRoom` (S2) | `+ 새 방` | 상단 바 오른쪽 버튼 글자 |
| `newRoomAriaLabel` (S2) | `새 방 만들기` | 위 버튼 `aria-label` |
| `newRoomGroupAriaLabel` (S2) | `새 방 만들기` | B 행 `role="group"` |
| `newRoomInputAriaLabel` (S2) | `새 방 제목` | B 행 입력 |
| `newRoomPlaceholder` (S2) | `새 방 제목 입력` | B 행 입력 placeholder(구성안 §1) |
| `cancel` (S2) | `취소` | B 행 |
| `create` (S2) | `만들기` | B 행 |

### 8.2 오류 상세 `errorDetail(code: ApiErrorCode): string` (목록 로드)

| code | 문구 | 근거 |
|---|---|---|
| `NETWORK` | `서버에 연결할 수 없습니다.` | api.md §3.3 |
| 그 밖의 13종 | `ERROR_MESSAGES[code]`(`@shared/errors`) | api.md §3.2 기본 문구. 예: `INTERNAL` → `서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.` |

### 8.3 쓰기 실패 토스트 `writeErrorText(error: ApiError): string` (S2, 방 생성)

| 조건 | 문구 | 톤(F-RM-22) |
|---|---|---|
| `TOKEN_REQUIRED` | `로그인 정보가 없어 열람 전용으로 바뀌었습니다.` | warning |
| `TOKEN_INVALID` | `인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.` | warning |
| `LEVEL_TOO_LOW` | `대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.` | warning |
| `RATE_LIMITED` + `retryAfterSec` 있음 | `` `요청이 너무 많습니다. ${retryAfterSec}초 후 다시 시도해 주세요.` `` | warning |
| `RATE_LIMITED` + 없음 | `ERROR_MESSAGES.RATE_LIMITED` | warning |
| `VALIDATION_ERROR` | `방 제목은 1~60자로 입력해 주세요.` | danger |
| `NETWORK` | `서버에 연결할 수 없습니다.` | danger |
| 그 밖 | `ERROR_MESSAGES[code]` | danger |

- 서버 `error.message`는 화면에 쓰지 않는다. 화면 문구는 `code`로 정한다(api.md §3.1).
- 같은 규칙의 chat판은 chat design.md §8.3(대상 동작별 `NOT_FOUND`·`VALIDATION_ERROR` 문구가 더 있다). 두 표의 인증·레이트리밋 행은 같은 문구다(§13 공용화 후보).

---

## 9. 접근성 → `design/a11y.md`

요약: `<main aria-label="방 목록">`, 마운트 시 h1 포커스, 행은 `button`(Enter·Space), 로딩·빈 `role=status`, 오류·토스트 `role=alert`, `<time dateTime>`. (S2) 「+ 새 방」 이름 `새 방 만들기`, B 행 `role=group`, Enter 만들기·Esc 취소, 전환 시 h1 포커스.

---

## 10. 읽기 전용 분기 명세

"미렌더" = **DOM에 없음**(`display:none`·`hidden`·`disabled`·`aria-hidden` 금지). 판정은 `viewer.canWrite` 하나.

| 요소 | 토큰 없음 · 전환 후 | 토큰 있음 | 방식 | 요구ID |
|---|---|---|---|---|
| 「+ 새 방」 버튼(A 오른쪽) | **미렌더** | 렌더 | `TopBar right={viewer.canWrite ? <Button…/> : undefined}` | R-CHAT-008 · R-ROOMS-002 |
| 새 방 입력 행(B) | **미렌더** | `create.isOpen`일 때만 렌더 | `viewer.canWrite && create.isOpen && <NewRoomRow/>` | R-ROOMS-002 |
| 토스트 줄(E') | 토스트가 있을 때만(읽기 전용 시작이면 발생 경로 없음. 전환 직후 안내 1회만) | 토스트가 있을 때만 | `toast && <Toast/>` | R-CHAT-011 |
| 방 목록·진입·상태·자동 진입 | 렌더 | 렌더 | 토큰과 무관 | R-ROOMS-001 · 003 · 004 |
| 대신 보여 줄 안내 | 없음 | — | rooms에는 열람 안내 줄이 없다(구성안 §1). 안내는 chat D 영역 | — |

- 전환(F-RM-12): 쓰기 결과가 `isAuthFailure`면 `clearToken()` + `viewer = READ_ONLY_VIEWER`. 같은 렌더에서 「+ 새 방」·B가 DOM에서 빠지고 h1로 포커스한다(F-RM-19). 되돌리기는 새로 고침뿐이다.
- TC는 읽기 전용에서 `queryByRole('button', { name: '새 방 만들기' })`·`queryByRole('textbox')`가 `null`, 토큰 있음에서 같은 버튼이 있음을 **쌍으로** 단언한다(TC-RM-011 · 018).
- 토큰은 화면이 저장하지 않는다. `storage.ts`에 토큰 키 없음. 토큰을 읽는 곳은 `main.tsx`의 `initToken` 한 번뿐이다.

---

## 11. 스타일·설계 가정

### 11.1 스타일 → `design/components.md` §3

`--color-bg` 배경, 행 56px·`--row-divider`, 제목 serif, 날짜 `--font-ui` xs. (S2) 「+ 새 방」 Button md primary, B 행 52px, TextInput `--input-*`, 토스트 줄. 전역 토큰 추가는 components.md §1.20.

### 11.2 설계 결정·가정

| # | 내용 | 이유 |
|---|---|---|
| D-1(결정) | 방에 들어갈 때 마지막 본 방을 기록하고(chat F-CH-02), ‹ 뒤로로 목록에 돌아오면 기록을 지운다(chat F-CH-10). 목록에 없는 방이면 자동 진입 판정에서도 지운다(F-RM-08). 저장 불가 환경은 try/catch로 무시 | 메인 세션 결정 2026-10-05 |
| D-2(결정) | `ui/src/main.tsx`는 `global.css` import, 토큰 초기화(`initToken`·`configureClient`)와 `<App />` 렌더만 하고, 화면 분기는 `ui/src/App.tsx`가 한다 | App을 테스트할 수 있게 분리(메인 세션 승인). S2에서 토큰 두 줄이 더해졌다(api.md §2.4 "main.tsx가 렌더 전에 한 번") |
| A-2(가정) | 목록 로드가 실패하면 자동 진입을 미루고, 재시도가 성공한 시점에 판정한다 | 방 정보는 목록으로만 얻는다(단건 조회 없음) |
| D-3(결정, S2) | 생성 성공 시 목록을 갱신하지 않고 응답 `RoomSummary`로 바로 chat에 들어간다 | R-ROOMS-002 "생성 → 그 방의 대화 화면으로 이동", api.md §4.6 "목록 갱신 방식은 ui 몫". 돌아올 때 목록을 다시 불러온다(F-RM-03) |
| D-4(결정, S2) | `viewer`는 App 상태 하나다. 쓰기 실패가 `isAuthFailure`면 어느 화면에서든 App이 토큰을 비우고 읽기 전용으로 바꾼다. 안내 토스트는 실패를 받은 화면이 띄운다 | api.md §2.4가 "강등 방식·viewer 계산 위치는 ui 설계" |
| A-3(가정, S2) | rooms 토스트 줄은 화면 맨 아래 in-flow 28px다. 구성안 §1 그림에는 없고 §3이 Toast를 "두 화면" 공용으로 적었다. chat E 줄(하단 바 바로 위)과 같은 "화면 아래쪽 한 줄" 규칙을 따른다 | 생성 실패 안내 자리가 필요하다. 구조 변경이 아니라 상태 조각 배치로 본다. 다르게 원하면 ui-layout-designer 확인 |

### 11.3 S1 실물 소급 델타 (v1.4)

| # | 설계 v1.3 | S1 실물(`ui/src/**`) → 설계 반영 |
|---|---|---|
| R-1 | 목록 요청·자동 진입을 RoomsScreen이 직접 소유 | `ui/src/rooms/useRoomsLoader.ts`가 `load`·`autoOpenSettledRef`·`isActiveRef`·`latestRef`와 `loadRooms`·`retry`를 소유. RoomsScreen은 조립만(functions.md §1.2) |
| R-2 | `loadRooms`가 먼저 `setLoad(loading)` | 설정하지 않는다. 마운트 초기값이 loading이고 재시도는 `retry`가 loading을 먼저 건다(F-RM-06·07) |
| R-3 | 지역 함수 `renderListArea(load)` | 지역 컴포넌트 `ListArea`(components.md §2.3) |
| R-4 | `selectRoom(room)` 함수 | 없음. `onOpenRoom`을 그대로 `onSelect`로 넘긴다(F-RM-09) |
| R-5 | `resolveAutoOpen`이 `autoOpenSettledRef`를 직접 확인 | 모듈 함수 `resolveAutoOpen(rooms, handlers)`. "이미 판정함" 검사는 `loadRooms`가 한다. 콜백은 `latestRef`(매 렌더 `useLayoutEffect`)로 읽어 부모 콜백이 바뀌어도 목록을 다시 요청하지 않는다 |
| R-6 | App 콜백 형태 미지정 · `READ_ONLY_VIEWER` 리터럴 | App 콜백은 `useCallback([])`. `READ_ONLY_VIEWER = Object.freeze({ canWrite: false })` |

---

## 12. 후속 묶음 · contract 변경 요청

| 항목 | 묶음 | 내용 | S2 상태 |
|---|---|---|---|
| (없음) | — | rooms 요구는 S2로 전부 상세됐다 | — |

contract 변경 요청(설계에 끼워 넣지 않음):

| # | 대상 | 요청 | 이유 | 막는 것 |
|---|---|---|---|---|
| CR-C-2 | api.md §5.2 · `shared/src/` | 방 제목·메시지 길이 한도(60·2000)와 "trim 후 코드 포인트" 세는 함수를 shared 상수로 내보내 달라 | 지금은 서버 서비스와 ui `ui/src/state/limits.ts`가 같은 숫자를 따로 가진다. 한도가 바뀌면 두 곳이 어긋난다 | **없음**(권고). 반영 전에는 `limits.ts`가 값을 가진다 |

---

## 13. 공용화 후보

| 후보 | 현재 위치 | 승격 조건 | 판정 |
|---|---|---|---|
| ListRow | rooms 로컬 | 두 번째 화면에서 같은 행 패턴이 생길 때 | 후보 표시만. 임의 승격 금지 |
| TopBar · Button · IconButton · StateView | 처음부터 공용 | 두 화면이 S1에서 이미 함께 쓴다 | 공용 |
| TextInput · Toast · useToast (S2) | 처음부터 공용 | 두 화면이 S2에서 함께 쓴다(rooms B·토스트, chat 이름 변경·E 줄) | 공용 신규 |
| TextArea · Toggle · BottomSheet · ConfirmDialog · PromptSheet · useLongPress (S2) | 공용 | 지금은 chat만 쓰지만 구성안 §3이 공용으로 배치했고 문구 없이 동작하는 비종속 부품이다 | 공용 신규(구성안 수용) |
| 쓰기 실패 문구 `writeErrorText`의 인증·레이트리밋 행 | 두 화면 `labels.ts`에 같은 문구 | 두 화면 재발 · 화면 비종속 | **후보 표시만**(labels는 화면 단일 소스 규칙이라 지금은 두 곳에 같은 행을 두고 TC로 같음을 확인한다) |

---

## 14. RTM (요구 추적 매트릭스)

상태: ✅ = 가리킨 절에 실체 있음. 절 표기: `C` = `design/components.md`, `F` = `design/functions.md`, `A` = `design/a11y.md`.

| 요구ID | 설계 절 | api 계약 | 예정 TC | 상태 |
|---|---|---|---|---|
| R-ROOMS-001 🔒 | §2.1 · C §2.1~§2.3 · F §2 F-RM-01·02·05·06·09·11 · §6.1 | api.md §4.2 `listRooms` | TC-RM-001 · 002 · 003 · 013 · 016 | ✅ |
| R-ROOMS-002 🔒 | §2.2 · §3.1 · C §1.11·§1.12·§2.4 · F §2 F-RM-05·14~18·23 · §6.5 · §8.1·§8.3 · §10 · A | api.md §4.6 `createRoom` · §2.2 | TC-RM-011 · 018 · 019 · 020 · 021 · 022 · 023 · 025 · 026 · 027 · 029 · 032 | ✅ |
| R-ROOMS-003 | §2.1 상태 변형 · C §1.4 · F §2 F-RM-06·07 · §6.4 · §8 | api.md §3.3·§3.4 | TC-RM-004 · 005 · 006 · 007 | ✅ |
| R-ROOMS-004 (확인 필요) | C §1.7 · F §1.1 · F §2 F-RM-02·03·04·08 · §6.2·§6.3 · §11.2 | — (localStorage) | TC-RM-008 · 009 · 010 · 012 · 014 · 021(새 방 진입 시 기록) | ✅ |
| R-ROOMS-005 🔒 | §2.3 · C §3 · C §1.20 · A | — | TC-RM-015 · 031(수동·스크린샷 2종) · 017 | ✅ |
| R-CHAT-008 🔒 (새 방 부분) | §10 · C §1.8 | — | TC-RM-011 · 018 · 024 | ✅ |
| R-CHAT-009 🔒 (토큰 보관 — 공용 정의) | C §1.10 · F §1.1 · F §2 F-RM-12·20 · §7 · §10 | api.md §2.4 · §11.6 `configureClient` | TC-RM-024 · 027 · 028 · 030(리뷰 grep) | ✅ |
| R-API-003 🔒 (참조) | R-CHAT-009 행으로 닫힘(헤더 부착은 래퍼, 화면은 메모리 보관만) | api.md §2.2 · §2.4 | R-CHAT-009와 같음 | ✅ |
| R-CHAT-010 (마지막 본 방) | C §1.7 · F §2 F-RM-08 | — | TC-RM-008 · 010 | ✅ |
| R-CHAT-011 (생성 실패·전환 — rooms 쪽) | F §2 F-RM-12·18·19·22 · §6.5 · §8.3 · §10 | api.md §2.4 `isAuthFailure` · §3.4 `retryAfterSec` | TC-RM-023 · 024 | ✅ |
| R-ROOM-001 🔒 (데이터) | §7 | api.md §4.2 | TC-RM-001(서버 순서 유지) | ✅ |
| R-ROOM-002 🔒 (데이터) | §7 · C §1.11 | api.md §4.6 | TC-RM-020 · 021 | ✅ |
| R-NFR-004 🔒 (화면 쪽) | §10 · C §1.7(storage에 토큰 키 없음) · C §1.10(메모리 슬롯, 로그 금지) | api.md §2.1 · §2.4 | TC-RM-010 · 028 · 030(리뷰 grep) | ✅ |

### 14.1 예정 TC 목록 (ui-test-designer가 시나리오로 확정)

| TC | 내용 | 기대(요지) |
|---|---|---|
| TC-RM-001 | 목록 렌더 | 받은 순서 그대로 제목·`MM.DD`(updatedAt) 표시, 화면이 재정렬하지 않음 |
| TC-RM-002 | 행 클릭 | `onOpenRoom`이 그 `RoomSummary`로 1회 호출 |
| TC-RM-003 | 키보드 진입 | 행 포커스 후 Enter·Space → `onOpenRoom` |
| TC-RM-004 | 로딩 | `listRooms` 대기 중 `role=status` "불러오는 중" |
| TC-RM-005 | 빈 목록 | `[]` → "아직 방이 없습니다", 목록 `ul` 없음 |
| TC-RM-006 | 오류 + 다시 시도 | 실패 → `role=alert` 제목·상세·「다시 시도」, 클릭 → `listRooms` 2회째 호출, 성공 시 목록 |
| TC-RM-007 | 오류 상세 코드별 | `NETWORK` → `서버에 연결할 수 없습니다.`, `INTERNAL` → `ERROR_MESSAGES.INTERNAL`, 서버 `message` 미표시 |
| TC-RM-008 | 자동 진입 성공 | 판정 시점에 목록 응답이 성공 상태이고 저장 id가 그 목록에 있음 → `onAutoOpenSettled` 후 `onOpenRoom(그 방)`. 목록 렌더 여부는 단언하지 않는다 |
| TC-RM-009 | 자동 진입 대상 없음 | 목록에 없음 → `ld:lastRoomId` 삭제, `onOpenRoom` 미호출 |
| TC-RM-010 | 저장소 throw | `localStorage.getItem/setItem/removeItem` throw → storage 함수 전부 throw 없이 `null`/무시, 화면은 일반 목록 |
| TC-RM-011 | 읽기 전용 부재 | `viewer=READ_ONLY_VIEWER` → `새 방 만들기` 버튼·textbox가 DOM에 없음 |
| TC-RM-012 | App 흐름(TC-FLOW) | 저장 id 있음 → chat 자동 진입 → ‹ 뒤로 → 목록 표시, `ld:lastRoomId` 삭제됨 → App 재마운트 시 자동 진입 없이 목록 |
| TC-RM-013 | formatDate | `MM.DD`·`HH:mm` 0 채움, `toIsoDate`·`toIsoDateTime` 형식 |
| TC-RM-014 | 자동 진입 보류 | 첫 로드 실패 → 자동 진입 없음 → 재시도 성공 → 그때 진입 |
| TC-RM-015 | 화면 크기·토큰(수동, 읽기 전용) | 390×565 스크린샷에서 가로 스크롤 없음, 상단 44·행 56, Rosebell 색 |
| TC-RM-016 | 언마운트 후 응답 | 응답 전 언마운트 → `onOpenRoom`·`onAutoOpenSettled` 미호출, 저장소 변화 없음(경고 부재로 판별하지 않는다) |
| TC-RM-017 | 포커스·역할 | 마운트 시 h1 포커스, 행 `button` 이름 = `{제목}, 마지막 갱신 {MM.DD}` |
| TC-RM-018 | (S2) 토큰 있음 렌더 쌍 | `viewer=WRITER_VIEWER` → `새 방 만들기` 버튼(글자 `+ 새 방`) 있음, B 행(`role=group` `새 방 만들기`)은 처음에 없음. TC-RM-011과 쌍 |
| TC-RM-019 | (S2) 입력 행 열기 | 「+ 새 방」 클릭 → textbox `새 방 제목` 포커스, placeholder `새 방 제목 입력`, 카운터 `0/60`, 만들기 disabled, 취소 enabled |
| TC-RM-020 | (S2) 제목 경계 | `'   '` → 만들기 disabled · 60자(이모지 포함 코드 포인트 60) → enabled · 61자 → disabled, 카운터 `61/60` `over` 클래스, 입력 `aria-invalid=true` · 앞뒤 공백은 세지 않음 |
| TC-RM-021 | (S2) 생성 성공 | 만들기 → `createRoom({ title: '  안개 낀 런던  ' })` 1회(원문 그대로), `listRooms` 추가 호출 없음, `onOpenRoom(응답 RoomSummary)` 1회. App 통합: chat h1 = 응답 title, `ld:lastRoomId` = 응답 id |
| TC-RM-022 | (S2) 중복 제출 | 응답 대기 중 만들기 연타·Enter 연타 → `createRoom` 1회. 대기 중 입력 `readOnly`, 취소·만들기 disabled |
| TC-RM-023 | (S2) 생성 실패 | `INTERNAL` → B 행·입력값 유지, `role=alert` `ERROR_MESSAGES.INTERNAL`(danger) · `RATE_LIMITED`+`retryAfterSec: 40` → `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.`(warning) · `RATE_LIMITED` 값 없음 → 기본 문구 · `NETWORK` → `서버에 연결할 수 없습니다.` · 2초 뒤 토스트 사라짐(fake timers) · `onAuthFailure` 미호출 |
| TC-RM-024 | (S2) 인증 실패 전환 | `LEVEL_TOO_LOW`·`TOKEN_INVALID`·`TOKEN_REQUIRED` 각각 → `onAuthFailure` 1회, 문구 §8.3. App 통합(`initToken('?t=x')`): 전환 뒤 `새 방 만들기`·textbox DOM 없음, h1 포커스, `getToken() === null` |
| TC-RM-025 | (S2) 취소·Esc | 입력 후 취소 → B 없음, 다시 열면 빈 입력, 포커스 「+ 새 방」 · Esc 같음 · 요청 중 Esc·취소 무시 |
| TC-RM-026 | (S2) Enter 제출·IME | 유효 제목 Enter → `createRoom` 1회 · `isComposing=true` Enter → 호출 없음 · 무효 제목 Enter → 호출 없음 |
| TC-RM-027 | (S2) App 토큰 흐름(TC-FLOW) | `initToken('?t=abc')` → `<App />` → 「+ 새 방」 있음 → 생성 → chat. `initToken('')` → 「+ 새 방」 없음 |
| TC-RM-028 | (S2) token.ts | `readTokenFromSearch`: `'?t=abc'`→`'abc'` · `'?t=%20abc%20'`→`'abc'` · `'?t='`·`'?t=%20'`·`''`·`'?x=1'`→`null` · `'?t=a%2Bb'`→`'a+b'`. `initToken`→`getToken`, `clearToken`→`null`. 호출 전후 `localStorage`·`sessionStorage` 길이·`document.cookie` 변화 없음 |
| TC-RM-029 | (S2) viewer·limits·tone | `viewerFromToken(null)` = READ_ONLY, `('x')` = WRITER · `countChars('  a😀b ')` = 3 · `isRoomTitleValid` 0/1/60/61 · `toastToneOf` auth·RATE_LIMITED = warning, 그 밖 danger |
| TC-RM-030 | (S2) 토큰 비노출(리뷰) | grep: `localStorage`·`sessionStorage`·`document.cookie` 접근은 `storage.ts`뿐이고 토큰 값을 쓰지 않음 · `ui/src` 에서 `?t=`를 API 경로에 붙이는 코드 0건 · `console.` 로 토큰 출력 0건 · `initToken`·`configureClient` 호출은 `main.tsx`뿐 |
| TC-RM-031 | (S2) 쓰기 판 스크린샷(수동) | 390×565, 「+ 새 방」·B 행 열림 상태, 가로 스크롤 없음, B 52·A 44 |
| TC-RM-032 | (S2) 공용 TextInput·Toast·useToast·Button ref | TextInput 카운터·`over`·Enter/Esc/IME · Toast `role=alert`·톤 클래스 · useToast 2000ms 뒤 null, 새 show가 타이머 재시작·id 증가, 언마운트 시 타이머 해제 · Button `buttonRef`가 button 요소를 가리킴 |
