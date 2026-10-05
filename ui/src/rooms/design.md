# rooms(방 목록) 화면 — 상세 설계

## 1. 개요

| 항목 | 값 |
|---|---|
| 화면 | rooms · 폴더 `ui/src/rooms/` |
| 목적 | 방(에피소드) 목록을 최신순으로 보여 주고, 행을 누르면 그 방의 대화 화면으로 보낸다. 패널을 다시 열면 마지막에 본 방으로 바로 들어간다 |
| 요구 | `ui/src/rooms/requirements.md` v1.0(확정) |
| 구성안 | `doc/200_설계/architecture/ui-layout-01-rooms-chat.md` §1(패턴 L1) — **수용, 구조 변경 없음** |
| 계약 | `doc/200_설계/contract/api.md` v0.1 §4.2 · §11.3(`listRooms`) — 확정, 구현 대기 |
| 묶음 | **S1 상세**: R-ROOMS-001·003·004·005, 참조 R-CHAT-008(새 방 부재)·R-CHAT-010(마지막 본 방). R-ROOMS-002는 §12 |
| 레이아웃 확정 상태 | **확정**(S1 읽기 전용 판). 토큰 있음 판의 A 오른쪽 버튼·B 입력 행은 S2 예정 슬롯 |
| 문서 분할 | 40KB 한계로 분할: `design/components.md`(컴포넌트·공용 요소 단일 정의·스타일) · `design/functions.md`(상태·기능) · `design/a11y.md`(접근성). RTM은 이 문서 §14 |
| 이 설계가 단일 정의하는 공용 요소 | `ui/src/App.tsx`(화면 분기) · `ui/src/state/viewer.ts` · `ui/src/components/ui/{TopBar,Button,IconButton,StateView}` · `ui/src/components/utils/{cx,formatDate,storage}.ts`. chat 설계는 이 정의를 인용한다 |

비유: 앱은 도서관 열람실이다. 방 목록은 서가 안내판이고, 대화 화면은 펼친 책이다. 안내판은 지난번에 펼쳐 둔 책을 기억해 두었다가(책갈피 = `localStorage`) 다시 오면 그 책을 바로 펼쳐 준다. 책갈피가 없어지거나 꽂을 수 없는 서가여도 안내판은 그대로 쓸 수 있다.

### 변경이력

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v1.0 | 2026-10-05 | 최초 작성(S1 읽기 전용). 40KB 한계로 `design/*.md` 3개 분할 | 구축 S1 |

---

## 2. 레이아웃 (ASCII, 390px 기준 약 48칸)

### 2.1 S1 판 — 읽기 전용 [확정]

S1에서는 토큰을 읽지 않으므로 모든 방문자가 이 판을 본다.

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

### 2.2 토큰 있음 판 — [미확정: S2 예정 슬롯]

구성안 §1의 「+ 새 방」(A 오른쪽)과 B 새 방 입력 행(52px) 자리다. S1에서는 **렌더하지 않는다**(§10). 설계는 S2(§12).

```
+----------------------------------------------+
| ROOMS                        [S2 슬롯: 새 방]|  A
+----------------------------------------------+
| [S2 슬롯: 새 방 입력 행 52px]                |  B
+----------------------------------------------+
| (C 방 목록)                                  |
+----------------------------------------------+
```

### 2.3 세로·가로 배분

| 영역 | 높이 | 비고 |
|---|---|---|
| 화면 루트 | 부모 100%(`height: 100%` 체인), `display: flex; flex-direction: column` | `100vh`·`100dvh` 금지 |
| A 상단 바 | 44px 고정 | `flex: none` |
| C 방 목록 | 나머지(`flex: 1; min-height: 0; overflow-y: auto`) | 390×565 기준 521px |
| 행 | 56px | 터치 타깃 44 이상 |

- 폭 ≥ 480: 콘텐츠 최대 폭 480 중앙. 폭 ≤ 360: 변화 없음(구성안 §4의 날짜 생략은 chat 상단 바 대상).
- 가로 스크롤 금지. 긴 제목은 한 줄 말줄임.

---

## 3. 컴포넌트 설계

### 3.1 컴포넌트 트리

```
ui/src/main.tsx                     global.css import + createRoot(#root).render(<App />)
└─ App (ui/src/App.tsx)             view 상태로 rooms / chat 분기 (외부 라우터 없음)
   ├─ RoomsScreen (ui/src/rooms/index.tsx)          view.screen === 'rooms'
   │  ├─ TopBar  [공용 ui]          title="ROOMS"  (right: S2 슬롯, S1 없음)
   │  └─ 목록 영역 <section>
   │     ├─ StateView [공용 ui]     error | loading | empty
   │     └─ RoomList [rooms 로컬]   data (ul)
   │        └─ ListRow [rooms 로컬, 승격 후보] × n
   └─ ChatScreen (ui/src/chat/index.tsx)            view.screen === 'chat'  (chat/design.md)
```

### 3.2 배치 3단계 분류

`component-catalog` 스킬 인벤토리는 비어 있다(2026-10-05 확인). 아래 공용 요소는 모두 **신규**이며 카탈로그 「미구현 후보」·구성안 §3 이름과 맞췄다.

| 컴포넌트·모듈 | 위치 | 분류 | 근거 | 쓰는 화면 | 상세 |
|---|---|---|---|---|---|
| `App` | `ui/src/App.tsx` | 진입 분기 | 스킬 §3.3 #8 | 전체 | functions.md §1.1 |
| `TopBar` | `ui/src/components/ui/TopBar/` | ① 공용 ui | 구성안 §3 | rooms · chat | components.md §1.1 |
| `Button` | `ui/src/components/ui/Button/` | ① 공용 ui | 카탈로그 후보 | rooms · chat | §1.2 |
| `IconButton` | `ui/src/components/ui/IconButton/` | ① 공용 ui | 구성안 §3 | chat(S1), rooms(S2) | §1.3 |
| `StateView` | `ui/src/components/ui/StateView/` | ① 공용 ui | 구성안 §3 | rooms · chat | §1.4 |
| `cx` | `ui/src/components/utils/cx.ts` | ③ 공용 유틸 | ui_design_concept §1 | 전체 | §1.5 |
| `formatDate` | `ui/src/components/utils/formatDate.ts` | ③ 공용 유틸 | 카탈로그 후보 | rooms · chat | §1.6 |
| `storage` | `ui/src/components/utils/storage.ts` | ③ 공용 유틸 | localStorage 단일 접근 | rooms · chat | §1.7 |
| `viewer` | `ui/src/state/viewer.ts` | 상태 모듈 | 스킬 §6.6 | rooms · chat | §1.8 |
| `RoomList` | `ui/src/rooms/components/RoomList.tsx` | ④ rooms 로컬 | 목록 JSX 분리 | rooms | §2.2 |
| `ListRow` | `ui/src/rooms/components/ListRow.tsx` | ④ rooms 로컬 · **공용 승격 후보** | 구성안 §3 | rooms | §2.1 |

- 화면 코드(`index.tsx`)는 표준 HTML 원소를 직접 쓰지 않는다. `<button>`은 `Button`·`IconButton`·`ListRow` 안에만 있다. `<main>`·`<section>`·`<ul>`·`<li>`·`<h1>`은 시맨틱 컨테이너로 허용.
- Props·시그니처 전문: `design/components.md`.

---

## 4. 상태 → `design/functions.md` §1

요약: App `view`(초기 `{ screen: 'rooms' }`) · `autoOpenRoomId`(초기 `loadLastRoomId()`) · `viewer`(S1 `READ_ONLY_VIEWER`). RoomsScreen `load`(초기 `{ phase: 'loading' }`) · `autoOpenSettledRef`(false) · `isActiveRef` · `titleRef`. 토큰 상태 없음.

## 5. 기능 명세 → `design/functions.md` §2

F-RM-01 `App` · F-RM-02 `openRoom` · F-RM-03 `backToRooms` · F-RM-04 `settleAutoOpen` · F-RM-05 `RoomsScreen` · F-RM-06 `loadRooms` · F-RM-07 `retry` · F-RM-08 `resolveAutoOpen` · F-RM-09 `selectRoom` · F-RM-10 `storage.*` · F-RM-11 `formatDate`.

---

## 6. 파이프라인

### 6.1 정상 — 첫 진입(저장된 방 없음)

```
App 마운트 → autoOpenRoomId = loadLastRoomId() = null
 → RoomsScreen 마운트 → load=loading → StateView "불러오는 중"
 → listRooms() ok → load=ready → RoomList → resolveAutoOpen → onAutoOpenSettled → App.autoOpenRoomId=null
 → 행 탭 → onOpenRoom(room) → App.view=chat → ChatScreen 마운트(saveLastRoomId(room.id))
```

### 6.2 정상 — 재방문(저장된 방 있음, R-ROOMS-004)

```
App 마운트 → autoOpenRoomId = 'r1'
 → RoomsScreen loading → listRooms() ok → 목록에 r1 있음
 → onAutoOpenSettled → onOpenRoom(r1) → ChatScreen(r1)
 → ‹ 뒤로 → backToRooms → RoomsScreen 새 마운트(autoOpenRoomId=null) → 목록 다시 로드 → 목록에 머문다
```
- 자동 진입 중에는 목록이 한 번 그려진 뒤 곧바로 chat으로 바뀐다(목록이 와야 방 정보를 안다 — 단건 조회 없음).

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

- 파괴 조작 없음(S1 rooms에는 삭제·변경이 없다). confirm 대상 없음. 생성 중 상태 없음.

---

## 7. contract 계약 사용표

api.md v0.1을 **인용**한다(재정의 아님).

| 엔드포인트 | 요청 | 응답 타입(`shared/src/types.ts`) | 래퍼(`@/api`) | 호출 위치 | 토큰 헤더 | 실패 시 표시 |
|---|---|---|---|---|---|---|
| `GET /api/rooms` (api.md §4.2, E3) | 없음 | `RoomSummary[]` = `{ id: string; title: string; createdAt: number; updatedAt: number; messageCount: number }[]` | `listRooms(): Promise<Result<RoomSummary[]>>` | F-RM-06 `loadRooms` | 불필요(래퍼가 붙이지 않음, api.md §2.1) | StateView error, 상세 §8.2 |

- `Result<T> = { ok: true; value: T } | { ok: false; error: ApiError }`, `ApiError = { code: ApiErrorCode; message: string }`, `ApiErrorCode = ErrorCode | 'NETWORK'`(api.md §11.3). 래퍼는 throw하지 않으므로 화면에 `try/catch`가 없다.
- 이 엔드포인트가 낼 수 있는 코드: `CONFIG_INVALID`(500) · `INTERNAL`(500) · 클라이언트 `NETWORK`. 그 밖의 코드도 §8.2 기본 규칙으로 처리된다.
- 테스트는 `vi.mock('@/api/rooms')`로 `listRooms`를 모킹한다. `fetch`를 모킹하지 않는다.
- 미확정 계약 없음. S2 `createRoom`은 §12.

---

## 8. 확정 문구·라벨 표 (`ui/src/rooms/labels.ts` 단일 소스)

### 8.1 문구

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `screenTitle` | `ROOMS` | TopBar 제목(h1) |
| `screenAriaLabel` | `방 목록` | 화면 루트 `<main aria-label>` |
| `listAriaLabel` | `방 목록` | `<ul aria-label>` |
| `rowAriaLabel(title, dateText)` | `` `${title}, 마지막 갱신 ${dateText}` `` | ListRow `aria-label` |
| `loading` | `불러오는 중` | StateView loading |
| `empty` | `아직 방이 없습니다` | StateView empty |
| `loadError` | `목록을 불러오지 못했습니다` | StateView error 제목 |
| `retry` | `다시 시도` | StateView error 버튼 |

### 8.2 오류 상세 `errorDetail(code: ApiErrorCode): string`

| code | 문구 | 근거 |
|---|---|---|
| `NETWORK` | `서버에 연결할 수 없습니다.` | api.md §3.3 |
| 그 밖의 13종 | `ERROR_MESSAGES[code]`(`@shared/errors`) | api.md §3.2 기본 문구. 예: `INTERNAL` → `서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.` |

- 서버 `error.message`는 화면에 쓰지 않는다. 화면 문구는 `code`로 정한다(api.md §3.1).

---

## 9. 접근성 → `design/a11y.md`

요약: `<main aria-label="방 목록">`, 마운트 시 h1 포커스, 행은 `button`(Enter·Space), 로딩·빈 `role=status`, 오류 `role=alert`, `<time dateTime>`.

---

## 10. 읽기 전용 분기 명세

| 요소 | 토큰 없음(S1 전원) | 방식 | 요구ID |
|---|---|---|---|
| 「+ 새 방」 버튼(A 오른쪽) | **미렌더** — DOM에 없다 | `TopBar`에 `right`를 넘기지 않는다. `display:none`·`disabled` 금지 | R-CHAT-008 · R-ROOMS-002 |
| 새 방 입력 행(B) | **미렌더** | 컴포넌트 자체를 만들지 않는다(S2) | R-ROOMS-002 |
| 방 목록·진입·상태·자동 진입 | 렌더 | 토큰과 무관 | R-ROOMS-001 · 003 · 004 |
| 대신 보여 줄 안내 | 없음 | rooms에는 열람 안내 줄이 없다(구성안 §1). 안내는 chat D 영역 | — |

- TC는 `queryByRole('button', { name: /새 방/ })`·`queryByRole('textbox')`가 `null`임을 단언한다.
- 토큰은 화면이 읽지도 저장하지도 않는다(S1).

---

## 11. 스타일·설계 가정

### 11.1 스타일 → `design/components.md` §3

`--color-bg` 배경, 행 56px·`--row-divider`, 제목 serif, 날짜 `--font-ui` xs. `--row-hover-bg`·`--row-divider` 값은 components.md §3에서 정한다.

### 11.2 설계 가정 (구현은 이대로, 사용자 확인 시 값만 바뀜)

| # | 가정 | 이유 |
|---|---|---|
| A-1 | ‹ 뒤로로 목록에 돌아와도 마지막 본 방 기록을 지우지 않는다. 다음에 패널을 열면 그 방으로 다시 들어간다 | R-ROOMS-004 원문 "앱 시작 시 있으면 그 방 대화 화면으로 바로 열고". 지우는 조건은 "목록에 없는 방"뿐. 요구가 「확인 필요」라 사용자 확인 대상 |
| A-2 | 목록 로드가 실패하면 자동 진입을 미루고, 재시도가 성공한 시점에 판정한다 | 방 정보는 목록으로만 얻는다(단건 조회 없음) |

---

## 12. 후속 묶음 예정 (S1에서 설계하지 않음)

| 요구ID | 묶음 | 자리 | S1 상태 |
|---|---|---|---|
| R-ROOMS-002 「+ 새 방」 · 입력 행 · 생성 후 chat 이동 | S2 | A `TopBar.right` 슬롯(Button primary md), B 입력 행 52px(TextInput · 취소 · 만들기) | 미렌더. `createRoom` 계약은 api.md E4 S2 상세 예정 |
| `viewer.canWrite` 계산 | S2 | `ui/src/state/viewer.ts`가 토큰 상태에서 계산 | S1은 `READ_ONLY_VIEWER` 상수 |

---

## 13. 공용화 후보

| 후보 | 현재 위치 | 승격 조건 | 판정 |
|---|---|---|---|
| ListRow | rooms 로컬 | 두 번째 화면에서 같은 행 패턴이 생길 때 | 후보 표시만. 임의 승격 금지 |
| TopBar · Button · IconButton · StateView | 처음부터 공용 | 두 화면이 S1에서 이미 함께 쓴다 | 공용 신규 |

---

## 14. RTM (요구 추적 매트릭스)

상태: ✅ = 가리킨 절에 실체 있음. `후속(Sn)` = 이번 묶음 범위 밖, §12에 자리만 있음. 절 표기: `C` = `design/components.md`, `F` = `design/functions.md`, `A` = `design/a11y.md`.

| 요구ID | 설계 절 | api 계약 | 예정 TC | 상태 |
|---|---|---|---|---|
| R-ROOMS-001 🔒 | §2.1 · C §2.1·§2.2 · F §2 F-RM-01·02·05·06·09·11 · §6.1 | api.md §4.2 `listRooms` | TC-RM-001 · 002 · 003 · 013 · 016 | ✅ |
| R-ROOMS-002 🔒 | §2.2 · §10 · §12 | api.md E4(S2 예정) | 부재 TC-RM-011 | 후속(S2) — S1 부재 쪽 ✅ |
| R-ROOMS-003 | §2.1 상태 변형 · C §1.4 · F §2 F-RM-06·07 · §6.4 · §8 | api.md §3.3·§3.4 | TC-RM-004 · 005 · 006 · 007 | ✅ |
| R-ROOMS-004 (확인 필요) | C §1.7 · F §1.1 · F §2 F-RM-02·03·04·08 · §6.2·§6.3 · §11.2 | — (localStorage) | TC-RM-008 · 009 · 010 · 012 · 014 | ✅ |
| R-ROOMS-005 🔒 | §2.3 · C §3 · A | — | TC-RM-015(수동·스크린샷) · 017 | ✅ |
| R-CHAT-008 🔒 (새 방 부분) | §10 · C §1.8 | — | TC-RM-011 | ✅ |
| R-CHAT-010 (마지막 본 방) | C §1.7 · F §2 F-RM-08 | — | TC-RM-008 · 010 | ✅ |
| R-ROOM-001 🔒 (데이터) | §7 | api.md §4.2 | TC-RM-001(서버 순서 유지) | ✅ |

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
| TC-RM-008 | 자동 진입 성공 | 저장 id가 목록에 있음 → `onAutoOpenSettled` 후 `onOpenRoom(그 방)` |
| TC-RM-009 | 자동 진입 대상 없음 | 목록에 없음 → `ld:lastRoomId` 삭제, `onOpenRoom` 미호출 |
| TC-RM-010 | 저장소 throw | `localStorage.getItem/setItem/removeItem` throw → storage 함수 전부 throw 없이 `null`/무시, 화면은 일반 목록 |
| TC-RM-011 | 읽기 전용 부재 | 「+ 새 방」 버튼·텍스트 입력이 DOM에 없음 |
| TC-RM-012 | App 흐름(TC-FLOW) | 저장 id 있음 → chat 진입 → ‹ 뒤로 → 목록 표시, 다시 자동 진입하지 않음 |
| TC-RM-013 | formatDate | `MM.DD`·`HH:mm` 0 채움, `toIsoDate`·`toIsoDateTime` 형식 |
| TC-RM-014 | 자동 진입 보류 | 첫 로드 실패 → 자동 진입 없음 → 재시도 성공 → 그때 진입 |
| TC-RM-015 | 화면 크기·토큰(수동) | 390×565 스크린샷에서 가로 스크롤 없음, 상단 44·행 56, Rosebell 색 |
| TC-RM-016 | 언마운트 후 응답 | 응답 전 언마운트 → 상태 갱신 없음(경고 없음) |
| TC-RM-017 | 포커스·역할 | 마운트 시 h1 포커스, 행 `button` 이름 = `{제목}, 마지막 갱신 {MM.DD}` |
