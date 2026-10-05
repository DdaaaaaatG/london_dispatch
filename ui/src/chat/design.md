# chat(대화) 화면 — 상세 설계

## 1. 개요

| 항목 | 값 |
|---|---|
| 화면 | chat · 폴더 `ui/src/chat/` |
| 목적 | 고른 방의 히스토리를 메신저 말풍선으로 보여 준다. 위로 올리면 더 오래된 대화를 이어 붙이고 읽던 자리를 지킨다. 등급 통과 회원은 대사·지시를 적어 저장하고, 말풍선을 고치거나 지우고, 방 이름을 바꾸거나 방을 지운다. 토큰이 없으면 쓰기 UI 없이 열람 안내 한 줄만 둔다 |
| 요구 | `ui/src/chat/requirements.md` v1.4(확정) |
| 구성안 | `doc/200_설계/architecture/ui-layout-01-rooms-chat.md` §2(C1) · §2-1 · §2-2 · §2-4 — **수용, 구조 변경 없음** |
| 계약 | `doc/200_설계/contract/api.md` **v0.3** §2.4 · §3.4 · §4.3 · §4.5·§4.7~§4.11 · §5.5 · §11.6 — 확정 |
| 묶음 | S1(R-CHAT-001 ‹·제목·날짜, 002·003·008·010·013) 구현 완료 + **S2 상세**: R-CHAT-001(⋯ 메뉴: 이름 변경·방 삭제) · 004(OOC 토글·입력·전송) · 006 · 007(수정·삭제) · 009 · 011(S2 코드) · 013(쓰기 판). S3·S4는 §14 |
| 레이아웃 확정 상태 | **확정**(읽기 전용 판 · 토큰 있음 판). 캐릭터 버튼(S3)·재작성 항목(S3)·장기기억 항목(S4)·임시/실패 말풍선(S3)은 **미렌더 자리** |
| 문서 분할 | 40KB 한계로 분할: `design/components.md`(로컬 컴포넌트·useAutoScroll·스타일) · `design/functions.md`(리듀서·스크롤 계산·상태·기능) · `design/a11y.md`(접근성) · `design/tc.md`(예정 TC 목록, v1.4 분리). RTM은 이 문서 §15 |
| 공용 요소 | `App`·`viewer`·`token`·`limits`·`TopBar`·`Button`·`IconButton`·`StateView`·`TextInput`·`TextArea`·`Toggle`·`BottomSheet`·`ConfirmDialog`·`PromptSheet`·`Toast`·`useToast`·`useLongPress`·`cx`·`formatDate`·`storage`의 단일 정의는 `ui/src/rooms/design/components.md` §1. chat은 인용만 한다 |

비유: 히스토리는 아래로 길게 이어지는 두루마리다. 처음에는 가장 최근 30줄만 펼친다. 위 끝에 닿으면 더 오래된 30줄을 위에 이어 붙이는데, 읽던 줄이 밀려나지 않도록 붙인 길이만큼 두루마리를 내려 준다. 출입증이 있는 회원은 두루마리 끝에 직접 한 줄을 적을 수 있고, 적은 줄은 접수 창구(서버)가 받아 준 뒤에야 두루마리에 붙는다.

### 변경이력

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v1.0 | 2026-10-05 | 최초 작성(S1 읽기 전용). 40KB 한계로 `design/*.md` 3개 분할 | 구축 S1 |
| v1.1 | 2026-10-05 | ① `shortName` 확정(api.md v0.2 §5.5). ② ‹ 뒤로 시 마지막 본 방 기록 삭제(F-CH-10, §6.4, TC-CH-002·024) | 메인 세션 결정 2건 |
| v1.2 | 2026-10-05 | 계약 인용 v0.2 · §15 R-NFR-004 행 · functions.md §3·F-CH-02(활성·중복 방지 ref를 useChatLoader 소유로) | 검증 DC-01·03·06 |
| v1.3 | 2026-10-05 | named export 규칙 · Bubble 클래스명 확정(`character`·`user`·`ooc`·`ciel`·`sebastian`) | 시나리오 검증 지적 |
| v1.4 | 2026-10-05 | **S1 실물 소급**(§11.2 델타 C-1~C-8: ChatTopBar·useScrollMemory 분리, 마운트·활성 플래그 layout effect, renderHistory props 객체, React 19 ref 타입, `isNearBottom` 측정 전 true 등). **S2 상세**: ⋯ 방 메뉴·Composer·말풍선 메뉴·인라인 수정·삭제 확인·이름 변경·E 토스트·읽기 전용 전환. 리듀서 액션 7종(T13~T26)·F-CH-16~30·TC-CH-031~063. TC 목록을 `design/tc.md`로 분리. 계약 인용 v0.3 | 구축 S2 |

---

## 2. 레이아웃 (ASCII, 390px 기준 약 48칸)

### 2.1 읽기 전용 판 [확정]

토큰이 없는 방문자, 또는 인증 실패로 전환된 회원이 보는 판.

```
+----------------------------------------------+
| <  티타임                     10.05          |  A 상단 바        44px (⋯ 없음)
+----------------------------------------------+
|            이전 대화 불러오는 중             |  B0 이전 페이지 로드 중일 때만 24px
| (o) 시엘                               16:40 |  B 히스토리 flex  493px
|     세바스찬, 홍차.                          |    캐릭터 = 왼쪽, 아바타·짧은 이름·시각
|                                  16:42  미샤 |    유저 = 오른쪽, 시각·작성자명
|                         나도 한 잔 부탁해요. |
|         - [지시] 둘이 체스를 둔다 -    16:43 |    OOC = 중앙 구분 한 줄 + 시각
|                                [새 메시지 v] |  B1 위쪽을 볼 때 새 메시지가 오면만
+----------------------------------------------+
| 대화 참여 등급이 아니어서 열람 전용으로 ...  |  E 토스트(전환 직후 2초만, S2)
+----------------------------------------------+
|     열람 전용 - 대화 참여는 등급 회원만      |  D 열람 안내 28px
+----------------------------------------------+
```

B 상태 변형(첫 로드, 판정 순서 error → loading → data → empty): `대화를 불러오는 중` / `아직 대화가 없습니다` / `대화를 불러오지 못했습니다` + 상세(§8.2) + `[다시 시도]`. B0 오류 변형(28px): `이전 대화를 불러오지 못했습니다 [다시 시도]`.

- 첫 로드 3상태 문구는 요구 원문에 따로 적혀 있지 않다. tsx-rules §1과 구현 충분성에 따른 최소 상태이며 R-CHAT-002·003에 딸린 상태로 추적한다.

### 2.2 토큰 있음 판 [확정 — 구성안 §2, S2]

```
+----------------------------------------------+
| <  티타임                     10.05      ... |  A 44px (⋯ = IconButton more)
+----------------------------------------------+
| (o) 시엘                               16:40 |  B 히스토리 flex 385~425px
|     세바스찬, 홍차.                          |    말풍선 = 롱프레스 500ms / 우클릭 / Shift+F10 → 시트
|                                  16:42  미샤 |
|  +----------------------------------------+  |    인라인 수정(말풍선 자리)
|  | 나도 한 잔 부탁해요.|                  |  |      TextArea 1~6줄
|  +----------------------------------------+  |
|                              [취소] [저장]   |
+----------------------------------------------+
| 요청이 너무 많습니다. 40초 후 다시 ...       |  E 알림 줄 28px+ (실패 시 2초만)
+----------------------------------------------+
|                                     [OOC 끔] |  C 1행 36px (왼쪽 = 캐릭터 버튼 자리, S3 · 미렌더)
| [대사나 지시를 입력                ]  [전송] |    2행 36~76px(1~3줄)
+----------------------------------------------+
```

시트(덮개 `--color-overlay` 위, 아래에서 올라옴, 최대 높이 70%):

```
말풍선 메뉴(약 188px, S3 재작성 추가 시 232)   ⋯ 방 메뉴(약 188px)          이름 변경(약 180px)
| 세바스찬 · 16:41  "예, 도련님."  |          | 방 메뉴 · 티타임    |      | 방 이름 변경                 |
| 수정                             |          | 이름 변경           |      | [티타임              ] 3/60  |
| (재작성: S3 자리, 미렌더)        |          | (장기기억: S4 자리) |      | (실패 문구 role=alert)       |
| 삭제            (danger)         |          | 방 삭제   (danger)  |      | [ 취소 ]          [ 저장 ]   |
| 취소                             |          | 취소                |
삭제 확인(약 148px) — 방:     | 이 방을 삭제할까요?                                      |
                              | 메시지와 장기기억이 함께 지워지며 되돌릴 수 없습니다.    |
                              | [ 취소 ]                                    [ 삭제 ]     |
                    메시지:   | 이 메시지를 삭제할까요? / 삭제한 메시지는 되돌릴 수 없습니다. |
```

### 2.3 세로·가로 배분

| 영역 | 높이 | 비고 |
|---|---|---|
| 화면 루트 | 부모 100%, `display: flex; flex-direction: column; position: relative` | `100vh` 금지. 시트 덮개 기준 |
| A 상단 바 | 44px 고정 | |
| B 히스토리 | 나머지(`flex: 1; min-height: 0`) | 읽기 전용 493px · 쓰기 385~425px(565 − 44 − C). 스크롤은 B 안의 스크롤 박스만 |
| B0 | 24px(오류 시 28px) | 스크롤 박스 **안** 맨 위 |
| B1 배지 | 28px | 스크롤 박스 **밖** 래퍼에 절대 위치 |
| E 알림 줄 (S2) | 최소 28px, 토스트가 있을 때만 | in-flow, `flex: none`. 있는 동안 B가 그만큼 줄어든다 |
| C 하단 바 (S2) | 96~136px | 쓰기 가능일 때만 |
| D 열람 안내 | 28px 고정 | 읽기 전용일 때만 |

- 폭 ≥ 480: 콘텐츠 최대 폭 480 중앙. 폭 ≤ 360: 상단 바 날짜 숨김, 말풍선 최대 폭 85%. 높이 ≤ 480: 입력창 1줄 고정, 시트 최대 70%.
- 가로 스크롤 금지. 말풍선 본문 `white-space: pre-wrap; overflow-wrap: anywhere`.

---

## 3. 컴포넌트 설계

### 3.1 컴포넌트 트리

```
App (ui/src/App.tsx)                                view.screen === 'chat'
└─ ChatScreen (ui/src/chat/index.tsx)               key={room.id}
   ├─ ChatTopBar [chat 로컬]  → TopBar [공용] variant='room'
   │   left = IconButton back · title = room.title · subtitle = 생성일
   │   right = viewer.canWrite && IconButton more (S2)
   ├─ 히스토리 <section>
   │   ├─ StateView [공용]                           첫 로드 error | loading | empty
   │   └─ MessageList [chat 로컬]                    data
   │       ├─ OlderStatus → InlineStatus [chat 로컬]  B0
   │       ├─ <ol> → Bubble [chat 로컬] × n           (S2: canWrite면 useLongPress·우클릭·Shift+F10)
   │       │        └ (editingId) InlineEditor [chat 로컬, S2] → TextArea · Button × 2
   │       └─ NewMessageBadge [chat 로컬]            B1
   ├─ Toast [공용, S2]                               E (toast !== null)
   ├─ Composer [chat 로컬, S2]                       C (viewer.canWrite)
   │   ├─ (캐릭터 버튼 2 — S3, 미렌더)
   │   ├─ Toggle [공용] OOC
   │   └─ TextArea [공용] · Button [공용] 전송
   ├─ ReadOnlyNotice [chat 로컬]                     D (!viewer.canWrite)
   └─ ChatSheets [chat 로컬, S2]                     viewer.canWrite && sheet
       ├─ MessageMenuSheet → BottomSheet + SheetItem (수정 · 삭제 · 취소)
       ├─ RoomMenuSheet → BottomSheet + SheetItem (이름 변경 · 방 삭제 · 취소)
       ├─ PromptSheet [공용] (이름 변경)
       └─ ConfirmDialog [공용] (메시지 삭제 · 방 삭제)
훅: useChatLoader · useAutoScroll · useScrollMemory · (S2) useMessageWrites · useRoomActions · useToast
```

### 3.2 배치 3단계 분류

`component-catalog` 인벤토리는 비어 있다(2026-10-05, S1 구현분 등록 전).

| 컴포넌트·모듈 | 위치 | 분류 | 근거 | 상세 |
|---|---|---|---|---|
| `TopBar`·`Button`·`IconButton`·`StateView` | `ui/src/components/ui/` | ① 공용 ui | rooms 단일 정의 | rooms components.md §1.1~§1.4 |
| `TextArea`·`TextInput`·`Toggle`·`BottomSheet`·`ConfirmDialog`·`PromptSheet`·`Toast` (S2) | `ui/src/components/ui/` | ① 공용 ui 신규 | 구성안 §3 | rooms components.md §1.12~§1.18 |
| `useAutoScroll` · (S2) `useLongPress`·`useToast` | `ui/src/components/hooks/` | ② 공용 훅 | 구성안 §3 | components.md §3 · rooms §1.18·§1.19 |
| `cx`·`formatDate`·`storage` | `ui/src/components/utils/` | ③ 공용 유틸 | rooms 단일 정의 | rooms §1.5~§1.7 |
| `chatReducer` 외 · `scroll.ts` | `ui/src/state/` | 상태(순수) | 스킬 §6.6 | functions.md §1·§2 |
| `viewer`·`token`·`limits`·`writeFailure` | `ui/src/state/` | 상태 | rooms 단일 정의 | rooms §1.8·§1.10·§1.11 · F-RM-22 |
| `useChatLoader` · `useScrollMemory` · (S2) `useMessageWrites`·`useRoomActions` | `ui/src/chat/` | 화면 로컬 훅 | 50줄·400줄 한계 분리 | functions.md §3·§4 |
| `ChatTopBar`·`MessageList`·`Bubble`·`InlineStatus`·`NewMessageBadge`·`ReadOnlyNotice` · (S2) `Composer`·`InlineEditor`·`MessageMenuSheet`·`RoomMenuSheet`·`ChatSheets` | `ui/src/chat/components/` | ④ chat 로컬 | 구성안 §3 | components.md §2 |

- 화면 코드(`index.tsx`)는 표준 HTML 원소를 직접 쓰지 않는다. `<button>`·`<textarea>`·`<input>`은 공용 ui 안에만, `<img>`는 Bubble 안에만 있다. `<main>`·`<section>`·`<ol>`·`<li>`·`<p>`·`<time>`은 시맨틱 컨테이너로 허용.
- 말풍선 본문은 일반 텍스트로만 렌더한다. `dangerouslySetInnerHTML` 금지.

---

## 4. 상태 → `design/functions.md` §1~§3

요약:
- `ui/src/state/chat.ts` `ChatState { phase, error, messages, hasMore, isLoadingOlder, olderError, unseenCount, writing, editingId }`, 초기값 `{ 'loading', null, [], false, false, null, 0, null, null }`. 액션 15종(S2 추가 `writeStarted`·`writeFinished`·`messageReplaced`·`messageRemoved`·`editStarted`·`editCancelled`·`writeAccessRevoked`), 전이표 T1~T26. 순수 함수 `mergeMessages`·`canLoadOlder`·`canAutoLoadOlder`·`nextBefore`·(S2)`canSend`.
- `ui/src/state/scroll.ts` 임계 80px·120px. S2 변경 없음.
- ChatScreen: useChatLoader(`state`·`dispatch`·`getState`·`isActive`), `initialDistance`, `backButtonRef`, `autoScroll`, (S2) `sheet`(초기 null), `toast`(null), `menuButtonRef`, `wasWritableRef`. `useMessageWrites`(`writeInFlightRef`), `useRoomActions`(`roomBusy` 초기 null). Composer 로컬 `text`('')·`ooc`(false). InlineEditor 로컬 `text`(원문).

## 5. 기능 명세 → `design/functions.md` §4

S1: F-CH-01 `ChatScreen` · 02 마운트 layout effect · 03 `loadInitial` · 04 `retryInitial` · 05 `loadOlder` · 06 `retryOlder` · 07 `clearUnseen` · 08 `showNewest` · 09 `useScrollMemory` · 10 `back` · 11 `renderHistory` · 12 `chatReducer` 외 · 13 `scroll.ts` · 14 `useAutoScroll` · 15 `bubbleVariantOf`.
S2: 16 `handleWriteFailure` · 17 `send` · 18 `openMessageMenu` · 19 `startEdit` · 20 `saveEdit` · 21 `cancelEdit` · 22 `askDeleteMessage` · 23 `confirmDeleteMessage` · 24 `openRoomMenu` · 25 `askRename`·`askDeleteRoom` · 26 `rename` · 27 `confirmDeleteRoom` · 28 `closeSheet` · 29 전환 effect · 30 `focusLog`.

---

## 6. 파이프라인

### 6.1 첫 진입

```
ChatScreen 마운트(layout effect) → saveLastRoomId(room.id) → ‹ 포커스 → phase=loading → "대화를 불러오는 중"
 → listMessages(room.id) ok(토큰 헤더 없음)
   ├ 0건  → phase=ready → "아직 대화가 없습니다" (쓰기 가능이면 하단 바로 첫 발화 가능)
   └ 1건+ → MessageList → useAutoScroll 첫 배치(저장 거리 없으면 맨 아래) → 맨 위 근처면 loadOlder 1회
```

### 6.2 이전 페이지 (R-CHAT-003)

```
위로 스크롤 → isNearTop(≤80) && canAutoLoadOlder → loadOlder → B0(aria-busy)
 → listMessages(room.id, { before: messages[0].id }) ok → 앞에 붙임 → scrollTop 보정(Δ scrollHeight) → 읽던 말풍선 제자리
hasMore=false → 더 요청하지 않는다
```

### 6.3 새 메시지 = 전송 성공 (R-CHAT-003 · 006, S2)

```
입력 → 전송(클릭 · Enter, IME 조합 중 제외) → canSend && 1~2000자
 → writeStarted(send): 전송 비활성, 입력 readOnly, 하단 바 aria-busy
 → appendUser(room.id, { text, ooc })        // Bearer 헤더는 래퍼, AI 호출 없음
 ├ 201 → isNearBottom 측정 → messagesAppended([msg]) → writeFinished → 입력 비움(OOC 유지) → 입력 포커스
 │        ├ 맨 아래 근처 → lastId 증가 감지 → 맨 아래로
 │        └ 위쪽을 보는 중 → unseenCount+1, B1 「새 메시지」
 │        말풍선 작성자명 = 응답 authorName(R-AUTH-004)
 └ 실패 → writeFinished → 입력 유지 → handleWriteFailure(§6.6)
```

### 6.4 말풍선 메뉴 · 수정 · 삭제 (R-CHAT-007, S2)

```
말풍선 롱프레스 500ms(10px 넘게 움직이면 취소) · 우클릭(기본 메뉴 막음) · Shift+F10
 → 말풍선 메뉴 시트(수정 · 삭제 · 취소, 쓰기 중이면 수정·삭제 비활성)
 ├ 수정 → 시트 닫힘 → editStarted → 말풍선 자리 InlineEditor(원문, 포커스)
 │        → 저장(1~2000자 · 바뀜) → writeStarted(edit) → editMessage(id, { text })
 │          ├ 200 → messageReplaced(편집 닫힘) → writeFinished → 히스토리 포커스
 │          └ 실패 → writeFinished → 편집기·입력 유지 → handleWriteFailure
 │        → 취소 · Esc → editCancelled → 원문 말풍선 → 히스토리 포커스
 └ 삭제 → 확인 시트 「이 메시지를 삭제할까요?」(첫 포커스 = 취소)
          → 삭제 → writeStarted(delete) → 두 버튼 비활성 → deleteMessage(id)
            ├ 204 · NOT_FOUND → messageRemoved → writeFinished → 시트 닫힘 → 히스토리 포커스
            │                   (남은 0건 + hasMore → loadInitial)
            └ 실패 → writeFinished → 시트 닫힘 → handleWriteFailure
```

### 6.5 ⋯ 방 메뉴 (R-CHAT-001, S2)

```
⋯ → 방 메뉴 시트(이름 변경 · 방 삭제 · 취소)
 ├ 이름 변경 → PromptSheet(현재 제목, n/60) → 저장(1~60자 · 바뀜) → renameRoom(room.id, { title })
 │   ├ 200 → App.replaceRoomInView(응답) → 상단 제목 갱신 → 시트 닫힘 → ⋯ 포커스
 │   ├ 인증 실패 → 시트 닫힘 → handleWriteFailure(전환)
 │   └ 그 밖 실패 → 시트 유지, 입력 유지, 시트 안 role=alert 문구
 └ 방 삭제 → 확인 시트 「이 방을 삭제할까요?」 → 삭제 → 두 버튼 비활성 → deleteRoom(room.id)
     ├ 204 · NOT_FOUND → clearLastRoomId() → onBack() → 목록 새로 로드(지운 방 없음)
     └ 실패 → 시트 닫힘 → handleWriteFailure
```

### 6.6 쓰기 실패 · 읽기 전용 전환 (R-CHAT-011, S2)

```
handleWriteFailure(error, action)
 ├ isAuthFailure(TOKEN_REQUIRED · TOKEN_INVALID · LEVEL_TOO_LOW)
 │   → onAuthFailure() = App.revokeWrite → clearToken() · viewer = READ_ONLY
 │   → 같은 렌더: ⋯ · C · 말풍선 메뉴 핸들러 · 시트 · 편집기 DOM 제거, D 표시
 │   → 전환 effect: sheet=null · writeAccessRevoked · ‹ 포커스
 │   → E 토스트(§8.3 전환 문구, warning, 2초)
 ├ RATE_LIMITED → 토스트 "N초 후"(retryAfterSec) 또는 기본 문구, 전환 없음
 └ 그 밖(NETWORK · NOT_FOUND · VALIDATION_ERROR · INTERNAL …) → 토스트, 전환 없음
```

### 6.7 오류(S1 읽기)

| 단계 | 상황 | 화면 | 다음 |
|---|---|---|---|
| 첫 로드 | `listMessages` 실패 | StateView error + 상세(§8.2) + 「다시 시도」 | 재요청. ‹ 뒤로는 언제나 동작 |
| 첫 로드 | `NOT_FOUND` | 상세 `방을 찾을 수 없습니다. 목록으로 돌아가 주세요.` | ‹ 뒤로 → 목록 새로 고침 |
| 이전 페이지 | 실패 | B0 error + 「다시 시도」 | 버튼으로만 재요청 |
| 저장소 | throw | 영향 없음 | — |
| 늦은 응답 | 응답 전 ‹ 뒤로·방 전환·방 삭제 | 버린다(`isActive`) — 읽기·쓰기 모두 | — |

- 마지막 본 방 기록: 들어올 때 저장(F-CH-02), ‹ 뒤로(F-CH-10)·방 삭제(F-CH-27) 때 삭제.
- 파괴 조작 confirm: 메시지 삭제·방 삭제 둘 다 ConfirmDialog(§2.2 문구). 수정 취소는 confirm 없음(스킬 §11). 생성 중 상태(speak)는 S3.

---

## 7. contract 계약 사용표

api.md **v0.3**을 **인용**한다. 쓰기 래퍼는 전부 `Authorization: Bearer <getToken()>`을 래퍼가 붙인다(api.md §2.2·§11.6). 화면은 헤더·토큰을 만지지 않는다.

| 엔드포인트 | 요청 | 응답 타입(`shared/src/types.ts`) | 래퍼(`@/api`) | 호출 위치 | 토큰 | 실패 표시 |
|---|---|---|---|---|---|---|
| `GET /api/rooms/:id/messages` (§4.3, E7) 첫 페이지 | `listMessages(room.id)` | `MessagesPage = { messages: Message[]; hasMore: boolean }`. `Message = { id: number; roomId: string; speaker: 'sebastian'\|'ciel'\|'user'; kind: 'line'\|'ooc'; text: string; authorName: string \| null; createdAt: number }` | `listMessages(roomId, query?): Promise<Result<MessagesPage>>` | F-CH-03 | ✕ | StateView error · §8.2 |
| 같은 엔드포인트 이전 페이지 | `{ before: messages[0].id }` | 같음 | 같음 | F-CH-05 | ✕ | B0 |
| `POST /api/rooms/:id/user` (§4.9, E8) | `UserMessageBody = { text: string; ooc: boolean }`(ooc 필수, 토글 값) | `201` `Message`(`speaker: 'user'`, `kind`, `authorName` = 토큰 표시 이름) | `appendUser(roomId: string, body: UserMessageBody): Promise<Result<Message>>` | F-CH-17 | ○ | E 토스트 §8.3 |
| `PATCH /api/messages/:id` (§4.10, E10) | `EditMessageBody = { text: string }` | `200` `Message`(`text`만 바뀜) | `editMessage(messageId: number, body: EditMessageBody): Promise<Result<Message>>` | F-CH-20 | ○ | E 토스트, 편집기 유지 |
| `DELETE /api/messages/:id` (§4.11, E11) | 없음 | `204` → `Result<void>`(`value: undefined`) | `deleteMessage(messageId: number): Promise<Result<void>>` | F-CH-23 | ○ | 시트 닫고 E 토스트. `NOT_FOUND` = 제거 |
| `PATCH /api/rooms/:id` (§4.7, E5) | `RenameRoomBody = { title: string }` | `200` `RoomSummary`(`updatedAt` 그대로) | `renameRoom(roomId: string, body: RenameRoomBody): Promise<Result<RoomSummary>>` | F-CH-26 | ○ | PromptSheet 안 문구(인증 실패만 토스트) |
| `DELETE /api/rooms/:id` (§4.8, E6) | 없음 | `204` → `Result<void>` | `deleteRoom(roomId: string): Promise<Result<void>>` | F-CH-27 | ○ | 시트 닫고 E 토스트. `NOT_FOUND` = 성공처럼 목록 복귀 |
| (엔드포인트 아님) | — | `isAuthFailure(error): boolean` · `ApiError.retryAfterSec?: number` | `@/api` | F-CH-16 | — | — |
| (엔드포인트 아님) 캐릭터 메타 | — | `CHARACTERS[speaker]: { id; name; shortName; avatar }` | `@shared/characters` | Bubble · MessageMenuSheet | — | — |

- 쓰기 6종 공통 코드(api.md §4.5): `CONFIG_INVALID`·`TOKEN_REQUIRED`·`TOKEN_INVALID`·`LEVEL_TOO_LOW`·`RATE_LIMITED`(+`retryAfterSec`)·`VALIDATION_ERROR`·`INTERNAL` + 클라이언트 `NETWORK`. 엔드포인트별 `NOT_FOUND`(방·메시지). 화면이 길이를 먼저 막으므로 `VALIDATION_ERROR`는 정상 경로에서 나오지 않는다.
- 래퍼는 본문을 계약 키로 다시 만든다(여분 키 없음). 화면은 trim하지 않는다(서버 몫).
- 테스트는 `vi.mock('@/api')`(또는 `@/api/messages`·`@/api/rooms`)로 래퍼를 모킹한다. `fetch`를 모킹하지 않는다. 전송 TC는 `appendUser` 외 쓰기·speak 경로 호출이 0회임을 단언한다(R-CHAT-006 "AI 호출 없음").
- 미확정 계약 없음. 권고 CR-C-2(§13).

---

## 8. 확정 문구·라벨 표 (`ui/src/chat/labels.ts` 단일 소스)

### 8.1 문구 (S1)

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `screenAriaLabel(title)` | `` `대화: ${title}` `` | `<main aria-label>` |
| `backAriaLabel` | `방 목록으로 돌아가기` | ‹ |
| `createdAtAriaLabel(dateText)` | `` `방 생성일 ${dateText}` `` | 생성일 `<time>` |
| `historyAriaLabel` | `대화 기록` | `role="log"` |
| `loading` · `empty` · `loadError` · `retry` | `대화를 불러오는 중` · `아직 대화가 없습니다` · `대화를 불러오지 못했습니다` · `다시 시도` | 첫 로드 StateView · 「다시 시도」 |
| `olderLoading` · `olderError` | `이전 대화 불러오는 중` · `이전 대화를 불러오지 못했습니다` | B0 |
| `oocPrefix` · `oocDecor` | `[지시]` · `—` | OOC 말풍선·메뉴 머리 |
| `unknownAuthor` | `이름 없음` | 유저 `authorName === null` |
| `newMessages` · `newMessagesAriaLabel` | `새 메시지` · `새 메시지 보기, 맨 아래로 이동` | B1 |
| `readOnlyNotice` | `열람 전용 - 대화 참여는 등급 회원만` | D |

### 8.1.1 문구 (S2)

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `moreAriaLabel` | `방 메뉴 열기` | ⋯ IconButton |
| `composerAriaLabel` | `메시지 작성` | C `role="group"` |
| `inputAriaLabel` | `메시지 입력` | 입력창 |
| `inputPlaceholder` | `대사나 지시를 입력` | 입력창(구성안 §2) |
| `send` | `전송` | 전송 버튼 |
| `oocAriaLabel` · `oocOn` · `oocOff` | `OOC 지시 모드` · `OOC 켬` · `OOC 끔` | Toggle |
| `messageMenuAriaLabel` | `메시지 메뉴` | 말풍선 메뉴 시트 |
| `messageMenuHeader(name, time, excerpt)` | `` `${name} · ${time}  "${excerpt}"` `` | 말풍선 메뉴 머리(구성안 §2-1) |
| `edit` · `delete` · `cancel` · `save` | `수정` · `삭제` · `취소` · `저장` | 시트 항목·버튼 |
| `editAriaLabel` · `editInputAriaLabel` | `메시지 수정` · `수정할 내용` | InlineEditor 그룹·입력 |
| `deleteMessageTitle` · `deleteMessageBody` | `이 메시지를 삭제할까요?` · `삭제한 메시지는 되돌릴 수 없습니다.` | 메시지 삭제 확인(구성안 §2-4 "같은 틀", 문구는 이 설계가 정함) |
| `roomMenuAriaLabel` · `roomMenuHeader(title)` | `방 메뉴` · `` `방 메뉴 · ${title}` `` | 방 메뉴 시트 |
| `rename` · `deleteRoom` | `이름 변경` · `방 삭제` | 방 메뉴 항목 |
| `renameTitle` · `renameInputAriaLabel` | `방 이름 변경` · `방 이름` | PromptSheet |
| `deleteRoomTitle` · `deleteRoomBody` | `이 방을 삭제할까요?` · `메시지와 장기기억이 함께 지워지며 되돌릴 수 없습니다.` | 방 삭제 확인(구성안 §2-4 원문) |

- 캐릭터 이름은 labels가 아니라 `CHARACTERS[id].shortName`이 단일 소스다.

### 8.2 오류 상세 `errorDetail(code)` (읽기, S1)

| code | 문구 |
|---|---|
| `NETWORK` | `서버에 연결할 수 없습니다.` |
| `NOT_FOUND` | `방을 찾을 수 없습니다. 목록으로 돌아가 주세요.` |
| 그 밖 | `ERROR_MESSAGES[code]` |

### 8.3 쓰기 실패 문구 `writeErrorText(error: ApiError, action: WriteAction): string` (S2, R-CHAT-011)

| 조건 | 문구 | 톤 | 전환 |
|---|---|---|---|
| `TOKEN_REQUIRED` | `로그인 정보가 없어 열람 전용으로 바뀌었습니다.` | warning | ○ |
| `TOKEN_INVALID` | `인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.` | warning | ○ |
| `LEVEL_TOO_LOW` | `대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.` | warning | ○ |
| `RATE_LIMITED` + `retryAfterSec` | `` `요청이 너무 많습니다. ${retryAfterSec}초 후 다시 시도해 주세요.` `` | warning | ✕ |
| `RATE_LIMITED` 값 없음 | `ERROR_MESSAGES.RATE_LIMITED` | warning | ✕ |
| `VALIDATION_ERROR` + `send`·`editMessage` | `메시지는 1~2000자로 입력해 주세요.` | danger | ✕ |
| `VALIDATION_ERROR` + `renameRoom` | `방 제목은 1~60자로 입력해 주세요.` | danger | ✕ |
| `NOT_FOUND` + `send`·`renameRoom` | `방을 찾을 수 없습니다. 목록으로 돌아가 주세요.` | danger | ✕ |
| `NOT_FOUND` + `editMessage` | `메시지를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.` | danger | ✕ |
| `NETWORK` | `서버에 연결할 수 없습니다.` | danger | ✕ |
| 그 밖(`INTERNAL`·`CONFIG_INVALID` 등) | `ERROR_MESSAGES[code]` | danger | ✕ |

- `deleteMessage`·`deleteRoom`의 `NOT_FOUND`는 실패로 보지 않는다(F-CH-23·27). 인증·레이트리밋 행은 rooms §8.3과 같은 문구다.
- `SPEAK_IN_PROGRESS`·`LLM_FAILED`·`LLM_EMPTY` 행은 S3에서 이 표에 더한다.
- 서버 `error.message`·토큰 값은 표시하지 않는다.

---

## 9. 접근성 → `design/a11y.md`

요약: 마운트 ‹ 포커스, `role="log" aria-live="polite"`, 상태 `role=status/alert`, D `role=note`. (S2) ⋯ `방 메뉴 열기`, OOC `role=switch`, Enter 전송·Shift+Enter 줄바꿈·IME 가드, 말풍선 Shift+F10, 시트 `aria-modal`·포커스 트랩·Esc·포커스 복귀, 확인 첫 포커스 취소, 전환 시 ‹ 포커스.

---

## 10. 읽기 전용 분기 명세

"미렌더" = **DOM에 없음**(`display:none`·`hidden`·`disabled`·`aria-hidden` 금지). 판정은 `viewer.canWrite` 하나(App 상태, F-RM-12로 true → false 한 방향).

| 요소 | 토큰 없음 · 전환 후 | 토큰 있음 | 구현 방식 | 요구ID |
|---|---|---|---|---|
| ⋯ 방 메뉴 버튼 | 미렌더 | 렌더 | `ChatTopBar onOpenMenu={canWrite ? openRoomMenu : undefined}` | R-CHAT-001 · 008 |
| C 하단 바(OOC·입력·전송) | 미렌더 | 렌더 | `canWrite ? <Composer/> : <ReadOnlyNotice/>` | R-CHAT-004 · 008 |
| 세바스찬·시엘 버튼 | 미렌더 | **미렌더(S3)** | Composer 1행 왼쪽에 요소 없음 | R-CHAT-004 · 005 |
| 말풍선 메뉴(롱프레스·우클릭·Shift+F10) | 미렌더(핸들러·tabIndex 없음, 우클릭은 브라우저 기본) | 연결 | `MessageList onOpenMenu={canWrite ? openMessageMenu : undefined}` | R-CHAT-007 · 008 |
| 시트(메뉴·확인·이름 변경) | 미렌더 | `sheet`가 있을 때 | `canWrite && sheet && <ChatSheets/>` + 전환 effect `sheet=null` | R-CHAT-001 · 007 |
| 재작성 항목 | 미렌더 | **미렌더(S3)** | MessageMenuSheet에 항목 없음 | R-CHAT-007 |
| 장기기억 항목 | 미렌더 | **미렌더(S4)** | RoomMenuSheet에 항목 없음 | R-CHAT-001 · 012 |
| 인라인 수정 | 미렌더 | `editingId`일 때 | 진입 경로가 말풍선 메뉴뿐 + 전환 시 T25 | R-CHAT-007 |
| "…" 임시·실패 말풍선 | 미렌더 | **미렌더(S3)** | 상태 없음 | R-CHAT-005 |
| E 알림 줄 | 토스트 있을 때만(읽기 전용 시작이면 발생 경로 없음, 전환 직후 안내 1회) | 토스트 있을 때만 | `toast && <Toast/>` | R-CHAT-011 |
| D 열람 안내 | **렌더** | 미렌더 | `!canWrite && <ReadOnlyNotice/>` | R-CHAT-008 · 011 · 013 |
| 히스토리·이전 페이지·배지·‹·제목·날짜 | 렌더 | 렌더 | 토큰과 무관 | R-CHAT-001 · 002 · 003 |

- TC는 읽기 전용에서 `세바스찬`·`시엘` 버튼·textbox·switch·dialog가 `null`, 상단 바 버튼이 ‹ 하나, `role=note` 문구 일치를 단언하고(TC-CH-003·021·022·023), 토큰 있음에서 ⋯·textbox·switch·전송이 있고 `세바스찬`·`시엘` 버튼과 note는 없음을 **쌍으로** 단언한다(TC-CH-031).
- 토큰은 화면이 저장하지 않는다. 읽는 곳은 `main.tsx`의 `initToken` 한 번, 보관은 `ui/src/state/token.ts` 메모리(R-CHAT-009).

---

## 11. 스타일 · S1 실물 소급

### 11.1 스타일 → `design/components.md` §4

시엘 `--bubble-ciel-*`·세바스찬 `--bubble-sebastian-*`(둘 다 왼쪽), 유저 `--bubble-user-bg` 오른쪽, OOC 중앙, 최대 폭 78%(≤360px 85%), 아바타 28px, D `--color-info`. (S2) C 96~136px `--input-*`, 시트 `--sheet-*`·`--color-overlay`, E Toast.

### 11.2 설계 결정·가정 · S1 실물 소급 델타 (v1.4)

| # | 내용 |
|---|---|
| C-1 | 상단 바 조립을 로컬 컴포넌트 `ChatTopBar`로 분리(components.md §2.0). S2 `onOpenMenu`·`menuButtonRef` 추가 |
| C-2 | 스크롤 저장 effect를 `useScrollMemory(roomId, getDistanceFromBottom)`로 분리(F-CH-09). 의존 `[roomId, getDistanceFromBottom]` |
| C-3 | 마운트 effect는 `useLayoutEffect([room.id, loadInitial])`(설계 v1.3은 `useEffect([])`). 자동 진입 커밋 직후 요청이 나가게 한다(F-CH-02) |
| C-4 | `useChatLoader`의 `stateRef` 갱신·활성 플래그는 `useLayoutEffect`(설계 v1.3은 `useEffect`). 첫 로드보다 먼저 활성이 켜져야 한다 |
| C-5 | `renderHistory`는 props 객체 `HistoryProps`를 받는다. 오류 상세는 `errorDetail(state.error?.code ?? 'INTERNAL')` |
| C-6 | ref 타입은 React 19 `RefObject<HTMLDivElement \| null>`(MessageList·useAutoScroll) |
| C-7 | `useAutoScroll.isNearBottom()`은 측정 전(metrics null)이면 `true` |
| C-8 | Bubble은 지역 컴포넌트 `CharacterBubble`·`UserBubble`·`OocBubble`·`SentTime`, MessageList는 지역 `OlderStatus`로 나뉜다(출력 동일). `nextBefore`는 `hasMore ? (messages[0]?.id ?? null) : null` |
| D-5(결정, S2) | 메시지 쓰기는 `writing` 하나로 직렬화한다. 전송·수정 저장·삭제가 동시에 나가지 않는다. 디바운스 없음, 상태 기반 |
| D-6(결정, S2) | 메시지·방 삭제의 `NOT_FOUND`는 "이미 없음 = 목표 상태"로 보고 성공과 같은 흐름을 탄다 |
| D-7(결정, S2) | 시트가 열린 채로 토스트를 띄우지 않는다. 이름 변경의 비인증 실패는 시트 안 문구, 확인 시트 실패는 시트를 닫은 뒤 토스트 |
| D-8(결정, S2) | 인증 실패 전환 안내 = E 토스트 1회(2초, `role=alert`) + D 상시. 되돌리기는 새로 고침뿐 |
| A-4(가정, S2) | E 줄은 in-flow라 토스트가 있는 2초 동안 히스토리가 28px 줄어든다(구성안 "하단 바 바로 위 28px" 그대로). 맨 아래 내용이 그만큼 가려졌다가 돌아온다 |
| A-5(가정, S2) | 방 삭제 뒤 언마운트 저장으로 `ld:scroll:{지운 방 id}`가 남을 수 있다. UUID라 재사용되지 않아 무해하다. 정리 함수는 요구가 없어 만들지 않는다 |

---

## 12. 공용화 후보

| 후보 | 현재 위치 | 판정 |
|---|---|---|
| `useAutoScroll` | 공용 훅 | 화면 비종속. 공용 |
| S2 공용 부품(TextArea·Toggle·BottomSheet·ConfirmDialog·PromptSheet·Toast·useLongPress·useToast) | 공용 | rooms design.md §13 판정 인용 |
| `InlineStatus` | chat 로컬 | 사용처 chat뿐. 후보 아님 |
| `Composer`·`InlineEditor`·`MessageMenuSheet`·`RoomMenuSheet`·`ChatSheets`·`NewMessageBadge`·`ReadOnlyNotice`·`Bubble`·`MessageList`·`ChatTopBar` | chat 로컬 | chat 전용(메시지·방 의미를 안다). 후보 아님 |
| `writeErrorText` 인증·레이트리밋 행 | 두 화면 labels | 후보 표시만(rooms design.md §13) |

---

## 13. contract 변경 요청 (설계에 끼워 넣지 않음)

| # | 대상 | 요청 | 이유 | 막는 것 |
|---|---|---|---|---|
| CR-C-1 | api.md §5.5 `shortName` | (S1) | R-LLM-002 개정 | **반영 완료**(v0.2) |
| CR-C-2 | api.md §5.2 · `shared/src/` | 길이 한도(60·2000)와 trim 후 코드 포인트 세기를 shared 상수·함수로 | ui `ui/src/state/limits.ts`와 서버가 같은 숫자를 따로 가진다 | **없음**(권고, rooms design.md §12와 같은 건) |

---

## 14. 후속 묶음 예정 (S2에서 설계하지 않음 — 자리만)

| 요구ID | 묶음 | 자리 | S2와 이어지는 접점 |
|---|---|---|---|
| R-CHAT-004(캐릭터 버튼 2) · R-CHAT-005 speak · 임시/실패 말풍선 | S3 | Composer 1행 왼쪽 · B 끝 Bubble pending/error 변형 | `writing`에 `speak` 종류 추가, 성공 시 `messagesAppended` 재사용, 잠금은 `canSend` 확장 |
| R-CHAT-007 재작성 | S3 | MessageMenuSheet 수정과 삭제 사이(캐릭터·마지막 메시지일 때만, confirm 없음 — 요구 🔒) | `messageReplaced` 재사용 |
| R-CHAT-011 `SPEAK_IN_PROGRESS`·`LLM_FAILED` | S3 | §8.3 행 추가 | `handleWriteFailure` |
| R-CHAT-012 장기기억 | S4 | RoomMenuSheet 이름 변경과 방 삭제 사이 → 구성안 §2-3 M1 | ⋯ 메뉴 |

---

## 15. RTM (요구 추적 매트릭스)

상태: ✅ = 가리킨 절에 실체 있음. `후속(Sn)` = 이번 묶음 범위 밖, §14에 자리만. 절 표기: `C` = components.md, `F` = functions.md, `A` = a11y.md. TC 상세는 `design/tc.md`.

| 요구ID | 설계 절 | api 계약 | 예정 TC | 상태 |
|---|---|---|---|---|
| R-CHAT-001 🔒 | §2.1·§2.2 A · §3.1 · C §2.0·§2.9·§2.10 · F F-CH-01·10·24~28 · §6.5 · §8 · §10 · A | api.md §4.7 · §4.8 | TC-CH-001 · 002 · 003 · 031 · 047 · 048 · 049 · 050 · 055 · 056 · 057 | ✅(‹·제목·생성일·⋯·이름 변경·방 삭제) / 후속(S4: 장기기억 항목) |
| R-CHAT-002 🔒 | §2.1 B · C §2.1·§2.2 · F F-CH-03·11·15 · §8 · C §4 | api.md §4.3 · §5.5 | TC-CH-004~010 · 030 | ✅ |
| R-CHAT-003 🔒 | C §2.1·§2.3·§2.4·§3 · F §1·§2 · F F-CH-03~09·11~14·17 · §6.2·§6.3 | api.md §4.3 | TC-CH-004 · 005 · 006 · 011~020 · 029 · 038 | ✅(새 메시지 실제 경로 = S2 전송) |
| R-CHAT-004 🔒 | §2.2 C · C §2.6 · F F-CH-01·17 · §8.1.1 · §10 · A | api.md §4.9 | TC-CH-021 · 031 · 032 · 034 · 035 · 058 · 059 | ✅(OOC 토글·입력 1~2000·전송) / 후속(S3: 캐릭터 버튼) |
| R-CHAT-005 🔒 | §10 · §14 | E9(S3) | (S3) | 후속(S3) |
| R-CHAT-006 🔒 | §6.3 · C §2.6 · F §1.1 T9·T13·T15 · F F-CH-17 · §7 | api.md §4.9 | TC-CH-032 · 033 · 035 · 036 · 037 · 038 · 053 · 063 | ✅ |
| R-CHAT-007 🔒 | §2.2 · §6.4 · C §2.1·§2.2·§2.7·§2.8·§2.10 · F §1.1 T17~T24 · F F-CH-18~23 · §8.1.1 · §10 · A | api.md §4.10 · §4.11 | TC-CH-022 · 039~046 · 053 · 054 · 055 · 056 · 060 · 063 | ✅(수정·삭제) / 후속(S3: 재작성) |
| R-CHAT-008 🔒 | §10 · F F-CH-01·29 · C §2.5 | — | TC-CH-003 · 021 · 022 · 023 · 031 · 051 | ✅ |
| R-CHAT-009 🔒 | §10 · rooms C §1.10 · rooms F F-RM-12·20 · §7 | api.md §2.4 · §11.6 | TC-CH-051 · 062 · TC-RM-028 · 030 | ✅ |
| R-CHAT-010 | rooms C §1.7 · F §3 · F F-CH-02·09 · §6.1 | — (localStorage) | TC-CH-024 · 025 · 026 | ✅ |
| R-CHAT-011 | §6.6 · §8.3 · F F-CH-16·23·26·27·29 · §10 · rooms F F-RM-12·22 | api.md §2.4 · §3.2 · §3.4 | TC-CH-037 · 044 · 046 · 049 · 050 · 051 · 052 | ✅(S2 코드: 인증 3종·RATE_LIMITED) / 후속(S3: SPEAK_IN_PROGRESS·LLM_FAILED) |
| R-CHAT-012 🔒 | §14 | E13·E14(S4) | (S4) | 후속(S4) |
| R-CHAT-013 🔒 | §2.3 · A · C §4 · §8 aria-label | — | TC-CH-027 · 028 · 031 · 061 | ✅(읽기 전용 판·쓰기 판) |
| R-LLM-002 🔒 (표시 메타) | C §2.2·§2.8 · §7 | api.md §5.5 | TC-CH-007 · 040 | ✅ |
| R-MSG-001 🔒 (데이터) | §7 · F §1.2 `nextBefore` | api.md §4.3 | TC-CH-004 · 011 | ✅ |
| R-MSG-002·004·005 🔒 (데이터) | §7 · F F-CH-17·20·23 | api.md §4.9~§4.11 | TC-CH-033 · 043 · 045 | ✅ |
| R-ROOM-003·004 🔒 (데이터) | §7 · F F-CH-26·27 | api.md §4.7 · §4.8 | TC-CH-048 · 050 | ✅ |
| R-AUTH-004 (표시) | C §2.2 user · F F-CH-17 | api.md §4.9 `authorName` | TC-CH-033 | ✅ |
| R-NFR-004 🔒 (화면 쪽) | §10 · rooms C §1.7·§1.10 | api.md §2.1 · §2.4 | TC-CH-024 · 025 · 062 | ✅ |
| R-ROOMS-004 (기록·삭제 시점) | F F-CH-02·10·27 · §6.7 | — | TC-CH-002 · 024 · 050 | ✅ |
