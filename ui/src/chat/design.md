# chat(대화) 화면 — 상세 설계

## 1. 개요

| 항목 | 값 |
|---|---|
| 화면 | chat · 폴더 `ui/src/chat/` |
| 목적 | 고른 방의 히스토리를 메신저 말풍선으로 보여 준다. 위로 올리면 더 오래된 대화를 이어 붙이고 읽던 자리를 지킨다. 등급 통과 회원은 대사·지시를 적어 저장하고, 말풍선을 고치거나 지우고, 방 이름을 바꾸거나 방을 지운다. 토큰이 없으면 쓰기 UI 없이 열람 안내 한 줄만 둔다 |
| 요구 | `ui/src/chat/requirements.md` v1.7(확정) |
| 구성안 | `doc/200_설계/architecture/ui-layout-01-rooms-chat.md` §2(C1) · §2-1 · §2-2 · §2-4 — **수용, 구조 변경 없음** |
| 계약 | `doc/200_설계/contract/api.md` **v0.4** §2.4 · §3.2 · §3.4 · §4.3 · §4.5·§4.7~§4.14 · §5.2 `SpeakBody` · §5.5 · §11.6 · §11.9 · 「ui 인계 메모」 — 확정 |
| 묶음 | S1 · S2 구현 완료 + **S3 상세**: R-CHAT-004(캐릭터 버튼 2) · 005(speak · 임시/실패 말풍선 · 재시도) · 007(재작성) · 011(S3 코드) · 003(speak 트리거) · 002(임시 말풍선 배치) · 013(S3 요소). S4는 §14 |
| 레이아웃 확정 상태 | **확정**(읽기 전용 판 · 토큰 있음 판 · S3 생성 중/실패/재작성 중 조각). 장기기억 항목(S4)만 **미렌더 자리** |
| 문서 분할 | 40KB 한계로 분할: **`design/layout.md`**(§0 토큰 있음 판·시트 ASCII = 옛 §2.2, v1.7.1 이전) · `design/components.md`(로컬 컴포넌트·useAutoScroll·스타일) · `design/functions.md`(리듀서·스크롤 계산·상태·기능) · `design/a11y.md`(접근성) · `design/tc.md`(예정 TC 목록, v1.4 분리) · **`design/labels.md`**(§8.1~§8.3 문구·라벨, v1.7 이전) · **`design/generate.md`**(S3 speak·재작성 흐름 = 옛 §6.8·§6.9, 생성 실패 문구 = 옛 §8.4, 결정 D-11~15·A-6, 한계 L-1~3 = 옛 §13.1, v1.7 신규) · **`design/decisions.md`**(§11.2 결정·가정·S1 소급 델타 · §13 contract 변경 요청, v1.7 이전). RTM은 이 문서 §15. 절 표기 `L` = labels.md, `G` = generate.md, `D` = decisions.md |
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
| v1.5 | 2026-10-05 | 검증 MINOR 반영: DC-01 전환 직후 E 토스트 허용(§11.2 D-9) · DC-02 편집기 렌더에 canWrite 조건(F-CH-11·29) · DC-03 삭제 결과 규칙·빈 목록 판정 근거·T1 비고(F-CH-23, functions.md §1.1) · DC-04 재로드 시 맨 아래 배치(components.md §3, TC-CH-046) · DC-05 쓰기 대기 중 메뉴 진입 막음·전환 안내 1회(F-CH-16·18·24, §11.2 D-10) · DC-08 TC-CH-033 · DC-09 미사용 표면 삭제 · DC-11 TC-CH-064·065 | ui-design-checker MINOR 11 · 메인 세션 결정 DC-01·DC-10 |
| v1.6 | 2026-10-05 | **CR-001 적용** — R-CHAT-002 🔒 개정(지인 지정): 세바스찬 왼쪽 · 시엘 오른쪽 · 유저 가운데 말풍선(최대 폭 86%) · OOC 가운데 한 줄. §2.1·§2.2 ASCII, §11.1 스타일, §15 RTM R-CHAT-002 행, components.md §2.2 Bubble(4변형·클래스 키·`bubbleVariantOf`)·§2.7 InlineEditor 정렬·§2.8 `nameOf`·§4 스타일, tc.md TC-CH-007~010·033 | 사용자 🔒 요구 개정 CR-001 |
| v1.7 | 2026-10-06 | **S3 상세**(§14 자리 → 본문): 캐릭터 버튼 `SpeakButtons` · 임시/실패 말풍선 `PendingBubble`(별도 컴포넌트) · 재작성 항목 · 재작성 중 표시. 리듀서 `pending` 필드 · 액션 4종(`speakStarted`·`speakSucceeded`·`speakFailed`·`speakDiscarded`) · T13~T16·T25 개정 · T27~T34 · `isRegenerateTarget`. F-CH-31~40. §6.8·§6.9 파이프라인, §7 E9·E12, §8.1.2·§8.4 문구, §10 S3 행 "렌더", §11.2 D-11~D-15, §13 L-1, §15 RTM S3 행. `useAutoScroll` `tailKey` 옵션. tc.md TC-CH-066~092. 계약 인용 v0.4. **40KB 분할**: §8 표 본문 → `design/labels.md`, §6.8·§6.9·§8.4·§11.2 D-11~15·A-6·§13.1 → `design/generate.md`(신규), 이 문서에는 요약·절 대응표와 RTM만. 2차(44.7KB 실측): §11.2 전체·§13 → `design/decisions.md`(신규) | 구축 S3 · 메인 세션 지적(56KB · 44.7KB) |
| v1.7.1 | 2026-10-06 | **구현 동기화**: F-CH-41을 카운터 state로(functions.md·generate.md D-15) · PendingBubble 본문 `div.body.bodyBox`(components.md §2.12·§4) · 말풍선 메뉴 높이 실측 약 247px ±16px(components.md §0·§2.8) · 재작성 중 흐림은 수동 확인 유지(a11y.md·tc.md TC-CH-092) | S3 구현·테스트 보고(ui 452/452) |

---

## 2. 레이아웃 (ASCII, 390px 기준 약 48칸)

### 2.1 읽기 전용 판 [확정]

토큰이 없는 방문자, 또는 인증 실패로 전환된 회원이 보는 판.

```
+----------------------------------------------+
| <  티타임                     10.05          |  A 상단 바        44px (⋯ 없음)
+----------------------------------------------+
|            이전 대화 불러오는 중             |  B0 이전 페이지 로드 중일 때만 24px
| (o) 세바스찬                           16:40 |  B 히스토리 flex  493px
|     도련님, 홍차입니다.                      |    세바스찬 = 왼쪽, 아바타·짧은 이름·시각 (v1.6)
| 16:41                              시엘 (o) |    시엘 = 오른쪽, 아바타·짧은 이름·시각, 오른쪽 정렬
|                       고마워, 세바스찬.     |
|                 미샤 · 16:42                 |    유저 = 가운데 말풍선(배경 있음, 최대 폭 86%), 작성자명·시각 위
|           [ 나도 한 잔 부탁해요. ]           |
|         - [지시] 둘이 체스를 둔다 -    16:43 |    OOC = 가운데 한 줄(배경 없음) + 시각
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

→ `design/layout.md` §0(본판 ASCII · 시트 4종, v1.7 이전). S3 히스토리 조각은 `design/generate.md` §0.

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
   │       ├─ <ol> → Bubble [chat 로컬] × n           (S2: canWrite면 useLongPress·우클릭·Shift+F10 · S3: isRegenerating)
   │       │        └ (editingId) InlineEditor [chat 로컬, S2] → TextArea · Button × 2
   │       │   └ (pending) PendingBubble [chat 로컬, S3]   목록 끝 li · 실패면 Button [공용] 재시도
   │       └─ NewMessageBadge [chat 로컬]            B1
   ├─ Toast [공용, S2]                               E (toast !== null)
   ├─ Composer [chat 로컬, S2]                       C (viewer.canWrite)
   │   │   props(S3): canSpeak · speakingCharacter · onSpeak={speakAs}
   │   ├─ SpeakButtons [chat 로컬, S3] → Button [공용] × 2 (세바스찬 · 시엘)
   │   ├─ Toggle [공용] OOC
   │   └─ TextArea [공용] · Button [공용] 전송
   ├─ ReadOnlyNotice [chat 로컬]                     D (!viewer.canWrite)
   └─ ChatSheets [chat 로컬, S2]                     viewer.canWrite && sheet · (S3) onRegenerate={regenerateFromMenu}
       ├─ MessageMenuSheet → BottomSheet + SheetItem (수정 · (재작성, S3) · 삭제 · 취소)
       ├─ RoomMenuSheet → BottomSheet + SheetItem (이름 변경 · 방 삭제 · 취소)
       ├─ PromptSheet [공용] (이름 변경)
       └─ ConfirmDialog [공용] (메시지 삭제 · 방 삭제)
훅: useChatScreen(조립) · useChatLoader · useAutoScroll · useScrollMemory · (S2) useWriteFailure · useMessageWrites(S3: speakAs · regenerateMessage) · useChatSheets(S3: regenerateFromMenu) · useRoomActions · useAccessRevoked · useToast
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
| (S3) `SpeakButtons`·`PendingBubble` | `ui/src/chat/components/` | ④ chat 로컬 신규 | 캐릭터·생성 의미를 안다. 공용 Button만 조립 | components.md §2.11·§2.12 |

- 화면 코드(`index.tsx`)는 표준 HTML 원소를 직접 쓰지 않는다. `<button>`·`<textarea>`·`<input>`은 공용 ui 안에만, `<img>`는 Bubble 안에만 있다. `<main>`·`<section>`·`<ol>`·`<li>`·`<p>`·`<time>`은 시맨틱 컨테이너로 허용.
- 말풍선 본문은 일반 텍스트로만 렌더한다. `dangerouslySetInnerHTML` 금지.

---

## 4. 상태 → `design/functions.md` §1~§3

요약:
- `ui/src/state/chat.ts` `ChatState { phase, error, messages, hasMore, isLoadingOlder, olderError, unseenCount, writing, editingId }`, 초기값 `{ 'loading', null, [], false, false, null, 0, null, null }`. 액션 15종(S2 추가 `writeStarted`·`writeFinished`·`messageReplaced`·`messageRemoved`·`editStarted`·`editCancelled`·`writeAccessRevoked`), 전이표 T1~T26. 순수 함수 `mergeMessages`·`canLoadOlder`·`canAutoLoadOlder`·`nextBefore`·(S2)`canSend`.
- (S3) `ChatState.pending: PendingSpeak | null`(초기 null) — 임시·실패 말풍선은 리듀서 상태다. `MessageWrite`에 `speak`·`regenerate`. 액션 4종 추가(`speakStarted`·`speakSucceeded`·`speakFailed`·`speakDiscarded`), 재작성은 S2 `writeStarted`·`messageReplaced`·`writeFinished` 재사용. 전이 T27~T34, T13~T16·T25 개정. 순수 함수 `isRegenerateTarget` 추가. 잠금은 `canSend` 하나(functions.md §4.3 잠금 표).
- `ui/src/state/scroll.ts` 임계 80px·120px. S2·S3 변경 없음.
- ChatScreen: useChatLoader(`state`·`dispatch`·`getState`·`isActive`), `initialDistance`, `backButtonRef`, `autoScroll`, (S2) `sheet`(초기 null), `toast`(null), `menuButtonRef`, `wasWritableRef`. `useMessageWrites`(`writeInFlightRef`), `useRoomActions`(`roomBusy` 초기 null). Composer 로컬 `text`('')·`ooc`(false). InlineEditor 로컬 `text`(원문).

## 5. 기능 명세 → `design/functions.md` §4

S1: F-CH-01 `ChatScreen` · 02 마운트 layout effect · 03 `loadInitial` · 04 `retryInitial` · 05 `loadOlder` · 06 `retryOlder` · 07 `clearUnseen` · 08 `showNewest` · 09 `useScrollMemory` · 10 `back` · 11 `renderHistory` · 12 `chatReducer` 외 · 13 `scroll.ts` · 14 `useAutoScroll` · 15 `bubbleVariantOf`.
S2: 16 `handleWriteFailure` · 17 `send` · 18 `openMessageMenu` · 19 `startEdit` · 20 `saveEdit` · 21 `cancelEdit` · 22 `askDeleteMessage` · 23 `confirmDeleteMessage` · 24 `openRoomMenu` · 25 `askRename`·`askDeleteRoom` · 26 `rename` · 27 `confirmDeleteRoom` · 28 `closeSheet` · 29 전환 effect · 30 `focusLog`.
S3(functions.md §4.3): 16 변경(`WriteAction` + `speak`·`regenerate`) · 31 `speakAs` · 32 `retrySpeak` · 33 `onRoomGone` · 34 `regenerateMessage` · 35 `openMessageMenu` 변경(`canRegenerate`) · 36 `regenerateFromMenu` · 37 `speakErrorText` · 38 `SpeakButtons` 포커스 복귀 · 39 `renderHistory` 변경 · 40 `useAutoScroll` `tailKey` · 41 `requestLogFocus`(재조회·제거 뒤 ready 커밋 후 포커스).

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
- 파괴 조작 confirm: 메시지 삭제·방 삭제 둘 다 ConfirmDialog(문구 `design/layout.md` §0 · L §8.1.1). 수정 취소는 confirm 없음(스킬 §11). 재작성은 confirm 없음(요구 🔒 R-CHAT-007).

### 6.8 · 6.9 S3 speak · 재작성 → `design/generate.md` §1 · §2

요약: 캐릭터 버튼 → `speakStarted`(임시 말풍선 · 잠금) → `speak` → 성공 교체 / 실패 말풍선 + 「재시도」(인증 = 전환, `NOT_FOUND` = 목록 복귀). 메뉴 「재작성」(confirm 없음) → `regenerate` → 같은 id 교체 / 토스트(`NOT_LAST_MESSAGE` = 첫 페이지 재조회).

---

## 7. contract 계약 사용표

api.md **v0.4**를 **인용**한다. 쓰기 래퍼는 전부 `Authorization: Bearer <getToken()>`을 래퍼가 붙인다(api.md §2.2·§11.6). 화면은 헤더·토큰을 만지지 않는다.

| 엔드포인트 | 요청 | 응답 타입(`shared/src/types.ts`) | 래퍼(`@/api`) | 호출 위치 | 토큰 | 실패 표시 |
|---|---|---|---|---|---|---|
| `GET /api/rooms/:id/messages` (§4.3, E7) 첫 페이지 | `listMessages(room.id)` | `MessagesPage = { messages: Message[]; hasMore: boolean }`. `Message = { id: number; roomId: string; speaker: 'sebastian'\|'ciel'\|'user'; kind: 'line'\|'ooc'; text: string; authorName: string \| null; createdAt: number }` | `listMessages(roomId, query?): Promise<Result<MessagesPage>>` | F-CH-03 | ✕ | StateView error · §8.2 |
| 같은 엔드포인트 이전 페이지 | `{ before: messages[0].id }` | 같음 | 같음 | F-CH-05 | ✕ | B0 |
| `POST /api/rooms/:id/user` (§4.9, E8) | `UserMessageBody = { text: string; ooc: boolean }`(ooc 필수, 토글 값) | `201` `Message`(`speaker: 'user'`, `kind`, `authorName` = 토큰 표시 이름) | `appendUser(roomId: string, body: UserMessageBody): Promise<Result<Message>>` | F-CH-17 | ○ | E 토스트 §8.3 |
| `PATCH /api/messages/:id` (§4.10, E10) | `EditMessageBody = { text: string }` | `200` `Message`(`text`만 바뀜) | `editMessage(messageId: number, body: EditMessageBody): Promise<Result<Message>>` | F-CH-20 | ○ | E 토스트, 편집기 유지 |
| `DELETE /api/messages/:id` (§4.11, E11) | 없음 | `204` → `Result<void>`(`value: undefined`) | `deleteMessage(messageId: number): Promise<Result<void>>` | F-CH-23 | ○ | 시트 닫고 E 토스트. `NOT_FOUND` = 제거 |
| `PATCH /api/rooms/:id` (§4.7, E5) | `RenameRoomBody = { title: string }` | `200` `RoomSummary`(`updatedAt` 그대로) | `renameRoom(roomId: string, body: RenameRoomBody): Promise<Result<RoomSummary>>` | F-CH-26 | ○ | PromptSheet 안 문구(인증 실패만 토스트) |
| `DELETE /api/rooms/:id` (§4.8, E6) | 없음 | `204` → `Result<void>` | `deleteRoom(roomId: string): Promise<Result<void>>` | F-CH-27 | ○ | 시트 닫고 E 토스트. `NOT_FOUND` = 성공처럼 목록 복귀 |
| `POST /api/rooms/:id/speak` (§4.13, E9, S3) | `SpeakBody = { character: CharacterId }`(`'sebastian' \| 'ciel'`, 필수) | `201` `Message`(`speaker = character`, `kind: 'line'`, `authorName: null`, `createdAt` = 저장 시각) | `speak(roomId: string, body: SpeakBody): Promise<Result<Message>>` | F-CH-31 | ○ | 실패 말풍선 §8.4(인증 = 전환 · `NOT_FOUND` = 목록 복귀) |
| `POST /api/messages/:id/regenerate` (§4.14, E12, S3) | 본문 없음 | `200` `Message`(`text`만 바뀜) | `regenerate(messageId: number): Promise<Result<Message>>` | F-CH-34 | ○ | E 토스트 §8.4 · `NOT_LAST_MESSAGE` = 토스트 + 첫 페이지 재조회 · `NOT_FOUND` = 제거 |
| (엔드포인트 아님) | — | `isAuthFailure(error): boolean` · `ApiError.retryAfterSec?: number` | `@/api` | F-CH-16 | — | — |
| (엔드포인트 아님) 캐릭터 메타 | — | `CHARACTERS[speaker]: { id; name; shortName; avatar }` | `@shared/characters` | Bubble · MessageMenuSheet | — | — |

- 쓰기 6종 공통 코드(api.md §4.5): `CONFIG_INVALID`·`TOKEN_REQUIRED`·`TOKEN_INVALID`·`LEVEL_TOO_LOW`·`RATE_LIMITED`(+`retryAfterSec`)·`VALIDATION_ERROR`·`INTERNAL` + 클라이언트 `NETWORK`. 엔드포인트별 `NOT_FOUND`(방·메시지). 화면이 길이를 먼저 막으므로 `VALIDATION_ERROR`는 정상 경로에서 나오지 않는다.
- 래퍼는 본문을 계약 키로 다시 만든다(여분 키 없음). 화면은 trim하지 않는다(서버 몫).
- 테스트는 `vi.mock('@/api')`(또는 `@/api/messages`·`@/api/rooms`)로 래퍼를 모킹한다. `fetch`를 모킹하지 않는다. 전송 TC는 `appendUser` 외 쓰기·speak 경로 호출이 0회임을 단언한다(R-CHAT-006 "AI 호출 없음").
- (S3) 생성 2종 공통(api.md §4.12): 래퍼 타임아웃·자동 재시도 없음(서버 70초 종결, R-NFR-001) · 같은 방 동시 1건(`409 SPEAK_IN_PROGRESS`, R-MSG-007) · 실패해도 레이트리밋 1회 · `502`·`409`·`400`·`500`이면 저장 없음. 화면은 api.md 「ui 인계 메모」 표를 `design/generate.md` §1~§3으로 옮겼다. `speak`·`regenerate`는 `@/api`에서만 import한다.
- 미확정 계약 없음. 권고 CR-C-2(`design/decisions.md` §13).

---

## 8. 확정 문구·라벨 표 (`ui/src/chat/labels.ts` 단일 소스)

v1.7에서 40KB 한계로 표 본문을 분할 문서로 옮겼다. 절 번호는 그대로 쓴다(다른 문서의 `§8.x` 인용이 유효).

| 절 | 내용 | 위치 |
|---|---|---|
| §8.1 · §8.1.1 · §8.1.2 | 문구 S1 · S2 · S3(캐릭터 버튼·임시/실패 말풍선·재작성) | `design/labels.md` |
| §8.2 | 읽기 오류 상세 `errorDetail(code)` | `design/labels.md` |
| §8.3 | 쓰기 실패 문구 `writeErrorText(error, action)` | `design/labels.md` |
| §8.4 | S3 생성 실패 문구 `speakErrorText` · `writeErrorText(…, 'regenerate')` | `design/generate.md` §3 |

- 캐릭터 이름은 labels가 아니라 `CHARACTERS[id].shortName`이 단일 소스다. 서버 `error.message`·토큰 값은 표시하지 않는다.

---

## 9. 접근성 → `design/a11y.md`

요약: 마운트 ‹ 포커스, `role="log" aria-live="polite"`, 상태 `role=status/alert`, D `role=note`. (S2) ⋯ `방 메뉴 열기`, OOC `role=switch`, Enter 전송·Shift+Enter 줄바꿈·IME 가드, 말풍선 Shift+F10, 시트 `aria-modal`·포커스 트랩·Esc·포커스 복귀, 확인 첫 포커스 취소, 전환 시 ‹ 포커스. (S3) 캐릭터 버튼 `세바스찬 대사 생성`·`시엘 대사 생성`, 잠금은 네이티브 `disabled`, 임시 말풍선 `role=status aria-live=polite`, 실패 문구 `role=alert`, 재작성 대상 본문 `aria-busy`, 잠금 해제 뒤 누른 버튼으로 포커스 복귀.

---

## 10. 읽기 전용 분기 명세

"미렌더" = **DOM에 없음**(`display:none`·`hidden`·`disabled`·`aria-hidden` 금지). 판정은 `viewer.canWrite` 하나(App 상태, F-RM-12로 true → false 한 방향).

| 요소 | 토큰 없음 · 전환 후 | 토큰 있음 | 구현 방식 | 요구ID |
|---|---|---|---|---|
| ⋯ 방 메뉴 버튼 | 미렌더 | 렌더(쓰기 대기 중 `disabled`, D-10) | `ChatTopBar onOpenMenu={canWrite ? openRoomMenu : undefined} isMenuDisabled={state.writing !== null \|\| roomBusy !== null}` | R-CHAT-001 · 008 |
| C 하단 바(OOC·입력·전송) | 미렌더 | 렌더 | `canWrite ? <Composer/> : <ReadOnlyNotice/>` | R-CHAT-004 · 008 |
| 세바스찬·시엘 버튼 | 미렌더 | **렌더(S3)**(쓰기 대기 중 `disabled`) | Composer 안 `SpeakButtons` — Composer 자체가 `canWrite`일 때만 렌더되므로 따로 분기하지 않는다 | R-CHAT-004 · 005 |
| 말풍선 메뉴(롱프레스·우클릭·Shift+F10) | 미렌더(핸들러·tabIndex 없음, 우클릭은 브라우저 기본) | 연결 | `MessageList onOpenMenu={canWrite ? openMessageMenu : undefined}` | R-CHAT-007 · 008 |
| 시트(메뉴·확인·이름 변경) | 미렌더 | `sheet`가 있을 때 | `canWrite && sheet && <ChatSheets/>` + 전환 effect `sheet=null` | R-CHAT-001 · 007 |
| 재작성 항목 | 미렌더(메뉴 자체가 없다) | **렌더(S3)** — 캐릭터 `line`이고 화면 목록 마지막일 때만, 아니면 DOM에 없음 | `sheet.canRegenerate && <SheetItem 재작성/>`(F-CH-35) | R-CHAT-007 |
| 재작성 중 표시 | 미렌더 | `writing.kind==='regenerate'`일 때 대상 하나 | `regeneratingId={canWrite && … ? id : null}`(F-CH-39) | R-CHAT-007 · 005 |
| 장기기억 항목 | 미렌더 | **미렌더(S4)** | RoomMenuSheet에 항목 없음 | R-CHAT-001 · 012 |
| 인라인 수정 | 미렌더 | `editingId`일 때 | `renderHistory`가 `editingId={viewer.canWrite ? state.editingId : null}`로 넘긴다(전환 커밋에서 바로 사라짐) + 전환 effect T25 | R-CHAT-007 |
| "…" 임시·실패 말풍선 | 미렌더(전환 커밋에서 바로 사라짐 + T25가 `pending` 정리) | **렌더(S3)** — `state.pending`이 있을 때 목록 끝 | `pending={canWrite ? state.pending : null}`(F-CH-39) | R-CHAT-005 · 008 |
| E 알림 줄 | 토스트 있을 때만(읽기 전용 시작이면 발생 경로 없음, 전환 직후 안내 1회) | 토스트 있을 때만 | `toast && <Toast/>` | R-CHAT-011 |
| D 열람 안내 | **렌더** | 미렌더 | `!canWrite && <ReadOnlyNotice/>` | R-CHAT-008 · 011 · 013 |
| 히스토리·이전 페이지·배지·‹·제목·날짜 | 렌더 | 렌더 | 토큰과 무관 | R-CHAT-001 · 002 · 003 |

- TC는 읽기 전용에서 `세바스찬`·`시엘` 버튼(이름 정규식 `/세바스찬|시엘/`)·textbox·switch·dialog·임시 말풍선이 `null`, 상단 바 버튼이 ‹ 하나, `role=note` 문구 일치를 단언하고(TC-CH-003·021·022·023·067), 토큰 있음에서 ⋯·캐릭터 버튼 2·textbox·switch·전송이 있고 note는 없음을 **쌍으로** 단언한다(TC-CH-031 → S3 TC-CH-066).
- 토큰은 화면이 저장하지 않는다. 읽는 곳은 `main.tsx`의 `initToken` 한 번, 보관은 `ui/src/state/token.ts` 메모리(R-CHAT-009).

---

## 11. 스타일 · S1 실물 소급

### 11.1 스타일 → `design/components.md` §4

(v1.6, CR-001) 세바스찬 `--bubble-sebastian-*` **왼쪽** · 시엘 `--bubble-ciel-*` **오른쪽**(아바타·이름 행 좌우 반전) · 유저 `--bubble-user-bg` **가운데 말풍선**(최대 폭 `--bubble-user-max-width` 86%) · OOC **가운데 한 줄**(배경 없음). 캐릭터 말풍선 최대 폭 78%(≤360px 85%), 아바타 28px, D `--color-info`. (S2) C 96~136px `--input-*`, 시트 `--sheet-*`·`--color-overlay`, E Toast.

### 11.2 설계 결정·가정 · S1 실물 소급 델타 (v1.4)

→ `design/decisions.md` §11.2(C-1~C-8 · D-5~D-10 · A-4·A-5, v1.7 이전). S3 D-11~D-15·A-6은 `design/generate.md` §4.

---

## 12. 공용화 후보

| 후보 | 현재 위치 | 판정 |
|---|---|---|
| `useAutoScroll` | 공용 훅 | 화면 비종속. 공용 |
| S2 공용 부품(TextArea·Toggle·BottomSheet·ConfirmDialog·PromptSheet·Toast·useLongPress·useToast) | 공용 | rooms design.md §13 판정 인용 |
| `InlineStatus` | chat 로컬 | 사용처 chat뿐. 후보 아님 |
| `Composer`·`InlineEditor`·`MessageMenuSheet`·`RoomMenuSheet`·`ChatSheets`·`NewMessageBadge`·`ReadOnlyNotice`·`Bubble`·`MessageList`·`ChatTopBar` | chat 로컬 | chat 전용(메시지·방 의미를 안다). 후보 아님 |
| `writeErrorText` 인증·레이트리밋 행 | 두 화면 labels | 후보 표시만(rooms design.md §13) |
| (S3) `SpeakButtons`·`PendingBubble`·`speakErrorText` | chat 로컬 | 캐릭터·생성을 안다, 사용처 chat뿐. 후보 아님 |
| (S3) `useAutoScroll` `tailKey` | 공용 훅 | 메시지 타입을 모르는 문자열 키라 비종속 유지 |

---

## 13. contract 변경 요청 (설계에 끼워 넣지 않음)

→ `design/decisions.md` §13(CR-C-1 반영 완료 · CR-C-2 권고 · S3 요청 없음, v1.7 이전). S3 한계 L-1~L-3은 `design/generate.md` §5.

---

## 14. 후속 묶음 예정 (S3에서 설계하지 않음 — 자리만)

| 요구ID | 묶음 | 자리 | 이어지는 접점 |
|---|---|---|---|
| R-CHAT-012 장기기억 | S4 | RoomMenuSheet 이름 변경과 방 삭제 사이 → 구성안 §2-3 M1 | ⋯ 메뉴 |

---

## 15. RTM (요구 추적 매트릭스)

상태: ✅ = 가리킨 절에 실체 있음. `후속(Sn)` = 이번 묶음 범위 밖, §14에 자리만. 절 표기: `C` = components.md, `F` = functions.md, `A` = a11y.md, `L` = labels.md, `G` = generate.md, `D` = decisions.md(v1.7), `Y` = layout.md(v1.7.1). 잠금 표는 `G §6`(v1.7.1, 옛 functions.md §4.3). TC 상세는 `design/tc.md`.

| 요구ID | 설계 절 | api 계약 | 예정 TC | 상태 |
|---|---|---|---|---|
| R-CHAT-001 🔒 | §2.1 · Y §0 A · §3.1 · C §2.0·§2.9·§2.10 · F F-CH-01·10·24~28 · §6.5 · L §8.1·§8.1.1 · §10 · A | api.md §4.7 · §4.8 | TC-CH-001 · 002 · 003 · 031 · 047 · 048 · 049 · 050 · 055 · 056 · 057 · 064 · 065 | ✅(‹·제목·생성일·⋯·이름 변경·방 삭제) / 후속(S4: 장기기억 항목) |
| R-CHAT-002 🔒 (CR-001 개정) | §2.1 B · §11.1 · C §2.1·§2.2(4변형) · C §2.7 · F F-CH-03·11·15 · L §8.1 · C §4 | api.md §4.3 · §5.5 | TC-CH-004~010 · 030 · 028(4종 스크린샷) · (S3 임시·실패 말풍선 배치: C §2.12) 069 · 092 | ✅ |
| R-CHAT-003 🔒 | C §2.1·§2.3·§2.4·§3(S3 `tailKey`) · F §1·§2 · F F-CH-03~09·11~14·17·31·40 · §6.2·§6.3 · G §1 | api.md §4.3 · §4.13 | TC-CH-004 · 005 · 006 · 011~020 · 029 · 038 · 072 · 078 · 091 | ✅(새 메시지 트리거 = S2 전송 · S3 speak) |
| R-CHAT-004 🔒 | Y §0 C · C §2.6·§2.11 · F F-CH-01·17·31 · G §6 잠금 표 · L §8.1.1·§8.1.2 · §10 · A | api.md §4.9 · §4.13 | TC-CH-021 · 031 · 032 · 034 · 035 · 058 · 059 · 066 · 067 · 068 · 070 | ✅(OOC 토글·입력 1~2000·전송 · S3 캐릭터 버튼 2) |
| R-CHAT-005 🔒 | Y §0 · G §0·§1·§3·§4·§5 · C §2.11·§2.12 · F §1(`pending`, T27~T34) · F F-CH-31·32·33·37·38·39·40 · L §8.1.2 · §10 · A | api.md §4.12 · §4.13 · §11.9 | TC-CH-068 · 069 · 070 · 071 · 073 · 074 · 075 · 077 · 078 · 085 · 087 · 089 · 090 · 092 · 093 · 094 · 095 | ✅(버튼 → speak · "…" 임시 말풍선 · 두 버튼·전송 잠금 · 성공 교체 · 실패 문구 + 재시도) |
| R-CHAT-006 🔒 | §6.3 · C §2.6 · F §1.1 T9·T13·T15 · F F-CH-17 · §7 | api.md §4.9 | TC-CH-032 · 033 · 035 · 036 · 037 · 038 · 053 · 063 | ✅ |
| R-CHAT-007 🔒 | Y §0 · §6.4 · C §2.1·§2.2·§2.7·§2.8·§2.10 · F §1.1 T17~T24 · F F-CH-18~23 · L §8.1.1·§8.1.2 · §10 · A | api.md §4.10 · §4.11 | TC-CH-022 · 039~046 · 053 · 054 · 055 · 056 · 060 · 063 · (S3) 079 · 080 · 081 · 082 · 083 · 084 · 085 · 095 | ✅(수정·삭제 · S3 재작성: G §2·§3 · C §2.2·§2.8·§2.10 · F F-CH-34·35·36 · api.md §4.14) |
| R-CHAT-008 🔒 | §10 · F F-CH-01·29·39 · C §2.5 | — | TC-CH-003 · 021 · 022 · 023 · 031 · 051 · (S3) 067 · 076 | ✅ |
| R-CHAT-009 🔒 | §10 · rooms C §1.10 · rooms F F-RM-12·20 · §7 | api.md §2.4 · §11.6 | TC-CH-051 · 062 · TC-RM-028 · 030 | ✅ |
| R-API-003 🔒 (참조) | R-CHAT-009 행으로 닫힘(헤더 부착은 래퍼, 화면은 메모리 보관만) | api.md §2.2 · §2.4 | R-CHAT-009와 같음 | ✅ |
| R-CHAT-010 | rooms C §1.7 · F §3 · F F-CH-02·09 · §6.1 | — (localStorage) | TC-CH-024 · 025 · 026 | ✅ |
| R-CHAT-011 | §6.6 · L §8.3 · F F-CH-16·23·26·27·29 · §10 · rooms F F-RM-12·22 | api.md §2.4 · §3.2 · §3.4 | TC-CH-037 · 044 · 046 · 049 · 050 · 051 · 052 · (S3) 073 · 074 · 076 · 081 · 082 · 083 · 084 · 086 | ✅(S2 코드: 인증 3종·RATE_LIMITED · S3 코드: SPEAK_IN_PROGRESS·LLM_FAILED·LLM_EMPTY·CONFIG_INVALID·NOT_LAST_MESSAGE·NOT_CHARACTER_MESSAGE — G §1·§2·§3 · F F-CH-16·31·34·37) |
| R-MSG-003·006·007 🔒 (데이터, S3) | §7 E9·E12 · F F-CH-31·34 · F `isRegenerateTarget` | api.md §4.12~§4.14 | TC-CH-068 · 074 · 079 · 080 · 082 | ✅ |
| R-NFR-001 🔒 (화면 쪽, S3) | F §3(화면 타이머 없음) · G §4 A-6 · G §5 L-3 | api.md §4.12 「화면 타임아웃」 | TC-CH-070(80초 경과 후에도 임시 말풍선 유지) | ✅ |
| R-CHAT-012 🔒 | §14 | E13·E14(S4) | (S4) | 후속(S4) |
| R-CHAT-013 🔒 | §2.3 · A · C §4 · L §8 aria-label | — | TC-CH-027 · 028 · 031 · 061 · (S3) 066 · 089 · 092 | ✅(읽기 전용 판·쓰기 판·S3 조각) |
| R-LLM-002 🔒 (표시 메타) | C §2.2·§2.8 · §7 | api.md §5.5 | TC-CH-007 · 040 | ✅ |
| R-MSG-001 🔒 (데이터) | §7 · F §1.2 `nextBefore` | api.md §4.3 | TC-CH-004 · 011 | ✅ |
| R-MSG-002·004·005 🔒 (데이터) | §7 · F F-CH-17·20·23 | api.md §4.9~§4.11 | TC-CH-033 · 043 · 045 | ✅ |
| R-ROOM-003·004 🔒 (데이터) | §7 · F F-CH-26·27 | api.md §4.7 · §4.8 | TC-CH-048 · 050 | ✅ |
| R-AUTH-004 (표시) | C §2.2 user · F F-CH-17 | api.md §4.9 `authorName` | TC-CH-033 | ✅ |
| R-NFR-004 🔒 (화면 쪽) | §10 · rooms C §1.7·§1.10 | api.md §2.1 · §2.4 | TC-CH-024 · 025 · 062 | ✅ |
| R-ROOMS-004 (기록·삭제 시점) | F F-CH-02·10·27 · §6.7 | — | TC-CH-002 · 024 · 050 | ✅ |
