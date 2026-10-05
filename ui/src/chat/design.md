# chat(대화) 화면 — 상세 설계

## 1. 개요

| 항목 | 값 |
|---|---|
| 화면 | chat · 폴더 `ui/src/chat/` |
| 목적 | 고른 방의 히스토리를 메신저 말풍선으로 보여 준다. 위로 올리면 더 오래된 대화를 이어 붙이고 읽던 자리를 지킨다. 토큰이 없으면 쓰기 UI 없이 열람 안내 한 줄만 둔다 |
| 요구 | `ui/src/chat/requirements.md` v1.0(확정) |
| 구성안 | `doc/200_설계/architecture/ui-layout-01-rooms-chat.md` §2(패턴 C1) — **수용, 구조 변경 없음** |
| 계약 | `doc/200_설계/contract/api.md` v0.2 §4.3 · §5.5 · §11.3(`listMessages`, `CHARACTERS`) — 확정, 구현 대기. 말풍선 이름은 `CHARACTERS[speaker].shortName`(v0.2 §5.5) |
| 묶음 | **S1 상세**: R-CHAT-001(‹·제목·날짜)·002·003·008·010·013. 나머지는 §14 후속 묶음 예정 |
| 레이아웃 확정 상태 | **확정**(S1 읽기 전용 판). 토큰 있음 판의 ⋯·하단 바·E 알림 줄·임시 말풍선은 후속 슬롯 |
| 문서 분할 | 40KB 한계로 분할: `design/components.md`(로컬 컴포넌트·useAutoScroll·스타일) · `design/functions.md`(리듀서·스크롤 계산·상태·기능) · `design/a11y.md`(접근성). RTM은 이 문서 §15 |
| 공용 요소 | `App`·`viewer`·`TopBar`·`Button`·`IconButton`·`StateView`·`cx`·`formatDate`·`storage`의 단일 정의는 `ui/src/rooms/design/components.md` §1. chat은 인용만 한다 |

비유: 히스토리는 아래로 길게 이어지는 두루마리다. 처음에는 가장 최근 30줄만 펼친다. 위 끝에 닿으면 더 오래된 30줄을 위에 이어 붙이는데, 읽던 줄이 밀려나지 않도록 붙인 길이만큼 두루마리를 내려 준다.

### 변경이력

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v1.0 | 2026-10-05 | 최초 작성(S1 읽기 전용). 40KB 한계로 `design/*.md` 3개 분할 | 구축 S1 |
| v1.1 | 2026-10-05 | ① `shortName` 확정(api.md v0.2 §5.5) → §1·§7·§13·§15 R-LLM-002 ✅. ② ‹ 뒤로 시 마지막 본 방 기록 삭제(F-CH-10, §6.4, TC-CH-002·024) | 메인 세션 결정 2건 |

---

## 2. 레이아웃 (ASCII, 390px 기준 약 48칸)

### 2.1 S1 판 — 읽기 전용 [확정]

S1에서는 토큰을 읽지 않으므로 모든 방문자가 이 판을 본다.

```
+----------------------------------------------+
| <  티타임                     10.05          |  A 상단 바        44px (... 없음)
+----------------------------------------------+
|            이전 대화 불러오는 중             |  B0 이전 페이지 로드 중일 때만 24px
| (o) 시엘                               16:40 |  B 히스토리 flex  493px
|     세바스찬, 홍차.                          |    캐릭터 = 왼쪽, 아바타·짧은 이름·시각
| (o) 세바스찬                           16:41 |
|     예, 도련님.                              |
|                                  16:42  미샤 |    유저 = 오른쪽, 시각·작성자명
|                         나도 한 잔 부탁해요. |
|         - [지시] 둘이 체스를 둔다 -    16:43 |    OOC = 중앙 구분 한 줄 + 시각
|                                [새 메시지 v] |  B1 위쪽을 볼 때 새 메시지가 오면만
+----------------------------------------------+
|     열람 전용 - 대화 참여는 등급 회원만      |  D 열람 안내 28px
+----------------------------------------------+
```

B 상태 변형(첫 로드, 판정 순서 error → loading → data → empty):

```
+----------------------------------------------+
|               대화를 불러오는 중             |  loading
+----------------------------------------------+
|              아직 대화가 없습니다            |  empty
+----------------------------------------------+
|           대화를 불러오지 못했습니다         |  error 제목
|          서버에 연결할 수 없습니다.          |  error 상세(코드별, §8.2)
|                  [다시 시도]                 |
+----------------------------------------------+
```

B0 오류 변형(이전 페이지 실패, 28px):

```
|  이전 대화를 불러오지 못했습니다 [다시 시도] |
```

- 첫 로드 3상태 문구는 요구 원문에 따로 적혀 있지 않다. tsx-rules §1(조건부 렌더 순서 고정)과 구현 충분성(실패 분기 필수)에 따라 둔 최소 상태다. R-CHAT-002·003의 히스토리 표시에 딸린 상태로 추적한다.

### 2.2 토큰 있음 판 — [미확정: 후속 슬롯]

```
+----------------------------------------------+
| <  티타임                     10.05 [S2: ...]|  A ⋯ 메뉴(S2)
+----------------------------------------------+
| (B 히스토리 + 임시·실패 말풍선(S3)           |
|  + 인라인 수정(S2))                          |
+----------------------------------------------+
| [S2: E 알림 줄 28px]                         |
| [S2·S3: C 하단 바 96~136px]                  |
+----------------------------------------------+
```

S1에서는 위 슬롯을 하나도 렌더하지 않는다(§10). 자리 설명은 §14.

### 2.3 세로·가로 배분

| 영역 | 높이 | 비고 |
|---|---|---|
| 화면 루트 | 부모 100%, `display: flex; flex-direction: column` | `100vh` 금지 |
| A 상단 바 | 44px 고정 | |
| B 히스토리 | 나머지(`flex: 1; min-height: 0`) | 390×565 기준 493px. 스크롤은 B 안의 스크롤 박스만 |
| B0 | 24px(오류 시 28px) | 스크롤 박스 **안** 맨 위(내용과 함께 스크롤) |
| B1 배지 | 28px | 스크롤 박스 **밖** 래퍼에 절대 위치(오른쪽 아래) |
| D 열람 안내 | 28px 고정 | 읽기 전용일 때만 |

- 폭 ≥ 480: 콘텐츠 최대 폭 480 중앙. 폭 ≤ 360: 상단 바 날짜 숨김, 말풍선 최대 폭 85%.
- 가로 스크롤 금지. 말풍선 본문 `white-space: pre-wrap; overflow-wrap: anywhere`.

---

## 3. 컴포넌트 설계

### 3.1 컴포넌트 트리

```
App (ui/src/App.tsx)                               view.screen === 'chat'
└─ ChatScreen (ui/src/chat/index.tsx)              key={room.id}
   ├─ TopBar [공용 ui]  variant='room'
   │   left = IconButton [공용 ui] icon='back'
   │   title = room.title · subtitle = 생성일 MM.DD
   │   right = (S2 슬롯: ⋯, S1 없음)
   ├─ 히스토리 영역 <section>
   │   ├─ StateView [공용 ui]                       첫 로드 error | loading | empty
   │   └─ MessageList [chat 로컬]                   data
   │       ├─ InlineStatus [chat 로컬]              B0 (이전 로드 중·실패)
   │       ├─ <ol> → Bubble [chat 로컬] × n         캐릭터 / 유저 / OOC
   │       └─ NewMessageBadge [chat 로컬]           B1 (unseenCount > 0)
   └─ ReadOnlyNotice [chat 로컬]                    D (!viewer.canWrite)
```

### 3.2 배치 3단계 분류

`component-catalog` 인벤토리는 비어 있다(2026-10-05). 아래는 모두 신규다.

| 컴포넌트·모듈 | 위치 | 분류 | 근거 | 상세 |
|---|---|---|---|---|
| `TopBar`·`Button`·`IconButton`·`StateView` | `ui/src/components/ui/` | ① 공용 ui | rooms 단일 정의 | `ui/src/rooms/design/components.md` §1 |
| `useAutoScroll` | `ui/src/components/hooks/useAutoScroll.ts` | ② 공용 훅 | 구성안 §3 · 카탈로그 후보 | components.md §3 |
| `cx`·`formatDate`·`storage` | `ui/src/components/utils/` | ③ 공용 유틸 | rooms 단일 정의 | rooms components.md §1.5~§1.7 |
| `chatReducer` 외 | `ui/src/state/chat.ts` | 상태(순수) | 스킬 §6.6 | functions.md §1 |
| 스크롤 계산 | `ui/src/state/scroll.ts` | 상태(순수) | 스크롤 앵커 계산 순수 함수 | functions.md §2 |
| `viewer` | `ui/src/state/viewer.ts` | 상태 | rooms 단일 정의 | rooms components.md §1.8 |
| `useChatLoader` | `ui/src/chat/useChatLoader.ts` | 화면 로컬 훅 | 50줄·400줄 한계 분리 | functions.md §4 |
| `MessageList`·`Bubble`·`InlineStatus`·`NewMessageBadge`·`ReadOnlyNotice` | `ui/src/chat/components/` | ④ chat 로컬 | 구성안 §3 | components.md §2 |

- 화면 코드(`index.tsx`)는 표준 HTML 원소를 직접 쓰지 않는다. `<button>`은 Button·IconButton 안에만, `<img>`는 Bubble 안에만 있다. `<main>`·`<section>`·`<ol>`·`<li>`·`<p>`·`<time>`은 시맨틱 컨테이너로 허용.
- 말풍선 본문은 일반 텍스트로만 렌더한다. `dangerouslySetInnerHTML` 금지.

---

## 4. 상태 → `design/functions.md` §1~§3

요약:
- `ui/src/state/chat.ts` `ChatState { phase, error, messages, hasMore, isLoadingOlder, olderError, unseenCount }`, 초기값 `{ 'loading', null, [], false, false, null, 0 }`. 액션 8종, 전이표 T1~T12. 순수 함수 `mergeMessages`·`canLoadOlder`·`canAutoLoadOlder`·`nextBefore`.
- `ui/src/state/scroll.ts` 임계 80px(위)·120px(아래), `distanceFromBottom`·`isNearTop`·`isNearBottom`·`anchorScrollTop`·`restoreScrollTop`.
- ChatScreen: `useReducer` 상태, `initialDistance`(마운트 1회 `loadScrollOffset`), `olderInFlightRef`, `isActiveRef`, `backButtonRef`, `autoScroll`. 토큰 상태 없음.

## 5. 기능 명세 → `design/functions.md` §4

F-CH-01 `ChatScreen` · 02 마운트 effect · 03 `loadInitial` · 04 `retryInitial` · 05 `loadOlder` · 06 `retryOlder` · 07 `clearUnseen` · 08 `showNewest` · 09 스크롤 저장 effect · 10 `back` · 11 `renderHistory` · 12 `chatReducer` 외 · 13 `scroll.ts` · 14 `useAutoScroll` · 15 `bubbleVariantOf`.

---

## 6. 파이프라인

### 6.1 첫 진입

```
ChatScreen 마운트 → saveLastRoomId(room.id) → ‹ 포커스 → phase=loading → "대화를 불러오는 중"
 → listMessages(room.id) ok
   ├ 0건  → phase=ready → "아직 대화가 없습니다"
   └ 1건+ → MessageList → useAutoScroll 첫 배치
             scrollTop = restoreScrollTop(저장 거리 ?? 0)   (저장 없음 → 맨 아래)
             맨 위 근처이고 canAutoLoadOlder → loadOlder 1회
```

### 6.2 이전 페이지 (R-CHAT-003)

```
위로 스크롤 → onScroll → isNearTop(scrollTop ≤ 80) && canAutoLoadOlder
 → loadOlder → B0 "이전 대화 불러오는 중"(aria-busy=true)
 → listMessages(room.id, { before: messages[0].id }) ok
 → mergeMessages(앞에 붙임) · hasMore 갱신 · B0 사라짐
 → useLayoutEffect: firstId 감소 감지
   → scrollTop = 이전 scrollTop + (새 scrollHeight − 이전 scrollHeight)
 → 읽던 말풍선이 같은 자리에 남는다
hasMore=false → 더 요청하지 않는다(B0 없음)
```

### 6.3 새 메시지 (R-CHAT-003 — S1은 상태·훅만, 발생 경로는 S2·S3)

```
(S2·S3) 새 메시지 도착
 → dispatch messagesAppended({ messages, isNearBottom: autoScroll.isNearBottom() })
 ├ 맨 아래 근처(≤120px) → unseenCount=0, lastId 증가 감지 → 맨 아래로 이동
 └ 위쪽을 보는 중        → unseenCount += 추가 수, 스크롤 그대로, B1 「새 메시지」
배지 클릭 → scrollToBottom + unseenCleared
사용자가 맨 아래 근처로 내림 → onReachBottom → unseenCleared
```

### 6.4 오류

| 단계 | 상황 | 화면 | 다음 |
|---|---|---|---|
| 첫 로드 | `listMessages` 실패(모든 코드) | StateView error: `대화를 불러오지 못했습니다` + 상세(§8.2) + 「다시 시도」 | 「다시 시도」 → loading → 재요청. ‹ 뒤로는 언제나 동작 |
| 첫 로드 | `NOT_FOUND`(목록 뒤에 방이 지워짐) | 위와 같고 상세 `방을 찾을 수 없습니다. 목록으로 돌아가 주세요.` | ‹ 뒤로 → 목록 새로 고침 |
| 이전 페이지 | 실패 | B0 error + 「다시 시도」. 이미 보이던 말풍선 그대로 | 버튼으로만 재요청(스크롤 자동 재시도 없음, `canAutoLoadOlder`) |
| 저장소 | 읽기·쓰기 throw | 영향 없음. 복원 거리 없음 = 맨 아래 | — |
| 늦은 응답 | 응답 전 ‹ 뒤로·방 전환 | 버린다(`isActiveRef`). 이전 페이지 늦은 응답은 T7로도 무시 | — |

- 마지막 본 방 기록(R-ROOMS-004): 방에 들어갈 때 `saveLastRoomId(room.id)`(F-CH-02), ‹ 뒤로로 나갈 때 `clearLastRoomId()`(F-CH-10). 사용자가 마지막으로 본 화면이 목록이면 다음 열기도 목록이다. `pagehide`(패널 닫기)는 기록을 지우지 않는다. 저장소 실패는 storage가 삼킨다.

- 파괴 조작·confirm: S1 chat에는 없다(메시지·방 삭제는 S2, §14). 생성 중 상태: S1 없음(S3).

---

## 7. contract 계약 사용표

api.md v0.2를 **인용**한다.

| 엔드포인트 | 요청 | 응답 타입(`shared/src/types.ts`) | 래퍼(`@/api`) | 호출 위치 | 토큰 헤더 | 실패 표시 |
|---|---|---|---|---|---|---|
| `GET /api/rooms/:id/messages` (api.md §4.3, E7) — 첫 페이지 | `listMessages(room.id)`(query 생략 = 최신 30) | `MessagesPage = { messages: Message[]; hasMore: boolean }`. `Message = { id: number; roomId: string; speaker: 'sebastian'\|'ciel'\|'user'; kind: 'line'\|'ooc'; text: string; authorName: string \| null; createdAt: number }` | `listMessages(roomId: string, query?: MessagesQuery): Promise<Result<MessagesPage>>` | F-CH-03 | 불필요(api.md §2.1) | StateView error · §8.2 |
| 같은 엔드포인트 — 이전 페이지 | `listMessages(room.id, { before: messages[0].id })`(`limit` 보내지 않음) | 같음 | 같음 | F-CH-05 | 불필요 | B0 InlineStatus error |
| (엔드포인트 없음) 캐릭터 표시 메타 | — | `CHARACTERS[speaker]: { id; name; shortName; avatar }`(`@shared/characters`) | 래퍼 아님, shared 상수 import | Bubble | — | — |

- `Result<T>`·`ApiError`·`ApiErrorCode = ErrorCode | 'NETWORK'`은 api.md §11.3. 래퍼는 throw하지 않으므로 화면에 `try/catch`가 없다.
- 이 엔드포인트가 낼 수 있는 코드: `VALIDATION_ERROR`(400) · `NOT_FOUND`(404) · `CONFIG_INVALID`(500) · `INTERNAL`(500) · 클라이언트 `NETWORK`. 화면은 `limit`을 보내지 않고 `before`는 서버가 준 id만 쓰므로 `VALIDATION_ERROR`는 정상 경로에서 나오지 않는다. 나와도 §8.2 기본 규칙으로 표시한다.
- 테스트는 `vi.mock('@/api/messages')`로 래퍼를 모킹한다.
- 미확정 계약 없음. 말풍선 이름은 `CHARACTERS[speaker].shortName`으로 확정(api.md v0.2 §5.5, §13 CR-C-1 반영 완료).

---

## 8. 확정 문구·라벨 표 (`ui/src/chat/labels.ts` 단일 소스)

### 8.1 문구

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `screenAriaLabel(title)` | `` `대화: ${title}` `` | 화면 루트 `<main aria-label>` |
| `backAriaLabel` | `방 목록으로 돌아가기` | ‹ IconButton |
| `createdAtAriaLabel(dateText)` | `` `방 생성일 ${dateText}` `` | TopBar subtitle `<time aria-label>` |
| `historyAriaLabel` | `대화 기록` | 스크롤 박스 `role="log"` |
| `loading` | `대화를 불러오는 중` | 첫 로드 StateView |
| `empty` | `아직 대화가 없습니다` | 빈 방 StateView |
| `loadError` | `대화를 불러오지 못했습니다` | 첫 로드 오류 제목 |
| `retry` | `다시 시도` | 첫 로드 오류·B0 오류 버튼 |
| `olderLoading` | `이전 대화 불러오는 중` | B0 loading |
| `olderError` | `이전 대화를 불러오지 못했습니다` | B0 error |
| `oocPrefix` | `[지시]` | OOC 말풍선 접두 |
| `oocDecor` | `—` | OOC 앞뒤 장식(`aria-hidden`) |
| `unknownAuthor` | `이름 없음` | 유저 말풍선 `authorName === null`일 때 |
| `newMessages` | `새 메시지` | B1 배지 글자 |
| `newMessagesAriaLabel` | `새 메시지 보기, 맨 아래로 이동` | B1 배지 |
| `readOnlyNotice` | `열람 전용 - 대화 참여는 등급 회원만` | D |

- 캐릭터 이름은 labels가 아니라 `CHARACTERS[id].shortName`(`시엘`·`세바스찬`, R-LLM-002)이 단일 소스다.

### 8.2 오류 상세 `errorDetail(code: ApiErrorCode): string`

| code | 문구 | 근거 |
|---|---|---|
| `NETWORK` | `서버에 연결할 수 없습니다.` | api.md §3.3 |
| `NOT_FOUND` | `방을 찾을 수 없습니다. 목록으로 돌아가 주세요.` | 화면 상황 문구(api.md §3.1: 화면 문구는 code로 labels가 정한다) |
| 그 밖의 코드 | `ERROR_MESSAGES[code]`(`@shared/errors`) | api.md §3.2 기본 문구 |

- 서버 `error.message`는 표시하지 않는다.
- S2·S3 코드별 안내(R-CHAT-011)는 이 함수에 행을 더하는 방식으로 확장한다(§14).

---

## 9. 접근성 → `design/a11y.md`

요약: 마운트 시 ‹ 포커스, 히스토리 `role="log" aria-live="polite"`(이전 로드 중 `aria-busy`)·`tabIndex=0`, 상태 `role=status/alert`, D `role=note`, 버튼 레이블 전부 labels.ts, 아바타 `alt=""`.

---

## 10. 읽기 전용 분기 명세

S1은 `viewer = READ_ONLY_VIEWER`(`canWrite: false`) 고정이다. 아래 "미렌더"는 **DOM에 없음**이다(`display:none`·`hidden`·`disabled`·`aria-hidden` 금지).

| 요소 | 토큰 없음 | 구현 방식 | 요구ID |
|---|---|---|---|
| ⋯ 방 메뉴 버튼(A 오른쪽) | 미렌더 | `TopBar`에 `right`를 넘기지 않는다 | R-CHAT-001 · 008 |
| C 하단 바 전체(세바스찬·시엘 버튼, OOC 토글, 입력창, 전송) | 미렌더 | 컴포넌트 없음(S2·S3에서 `viewer.canWrite && <Composer/>`) | R-CHAT-004 · 008 |
| 말풍선 롱프레스·우클릭 메뉴(바텀시트) | 미렌더 | Bubble에 `onContextMenu`·포인터 핸들러를 붙이지 않는다. 우클릭은 브라우저 기본 동작 | R-CHAT-007 · 008 |
| "…" 임시 말풍선·생성 실패 말풍선 | 미렌더 | 상태 자체가 없다(S3) | R-CHAT-005 |
| 인라인 수정 | 미렌더 | S2 | R-CHAT-007 |
| E 알림 줄(토스트) | 미렌더 | S2 | R-CHAT-011 |
| D 열람 안내 | **렌더** | `!viewer.canWrite && <ReadOnlyNotice text={labels.readOnlyNotice} />` | R-CHAT-008 · 013 |
| 히스토리·이전 페이지·새 메시지 배지·상단 바(‹·제목·날짜) | 렌더 | 토큰과 무관 | R-CHAT-001 · 002 · 003 |

- TC는 `queryByRole('button', { name: '세바스찬' })`·`{ name: '시엘' }`·`queryByRole('textbox')`·`queryByRole('switch')`·`queryByRole('dialog')`가 모두 `null`이고, 상단 바 버튼이 ‹ 하나뿐이며, `getByRole('note')` 문구가 `열람 전용 - 대화 참여는 등급 회원만`임을 단언한다.
- 토큰은 화면이 읽지도 저장하지도 않는다(S1). `storage.ts`에 토큰 키 없음.

---

## 11. 스타일 → `design/components.md` §4

요약: 시엘 `--bubble-ciel-*`·세바스찬 `--bubble-sebastian-*`(둘 다 왼쪽, 색·아바타·이름으로 구분), 유저 `--bubble-user-bg`(값 `var(--color-bg-elevated)`) 오른쪽, OOC `--bubble-ooc-fg` 중앙, 말풍선 최대 폭 78%(≤360px 85%), 아바타 28px, D `--color-info`.

---

## 12. 공용화 후보

| 후보 | 현재 위치 | 판정 |
|---|---|---|
| `useAutoScroll` | 처음부터 공용 훅 | 화면 비종속(id 두 개·스크롤 박스만 앎). 공용 신규 |
| `InlineStatus` | chat 로컬 | StateView와 모양이 다르고(한 줄) 사용처가 chat뿐. 후보 아님 |
| `NewMessageBadge`·`ReadOnlyNotice`·`Bubble`·`MessageList` | chat 로컬 | chat 전용. 후보 아님 |

---

## 13. contract 변경 요청 (설계에 끼워 넣지 않음)

| # | 대상 | 요청 | 이유 | 막는 것 |
|---|---|---|---|---|
| CR-C-1 | api.md §5.5 `shared/src/characters.ts` · API-T-043 | `CharacterMeta`에 `shortName: string` 추가. 값 `sebastian → '세바스찬'`, `ciel → '시엘'` | R-LLM-002 개정 | **반영 완료**(api.md v0.2, 2026-10-05). 막는 것 없음 |

- 현재 열린 contract 변경 요청 없음.

---

## 14. 후속 묶음 예정 (S1에서 설계하지 않음 — 영역·슬롯만)

| 요구ID | 묶음 | 영역·슬롯 | S1과 이어지는 접점 |
|---|---|---|---|
| R-CHAT-001(⋯ 메뉴: 이름 변경·장기기억·방 삭제 confirm) | S2 | A `TopBar.right` ← `IconButton icon='more'`(아이콘 추가), 구성안 §2-2 방 메뉴·이름 변경 시트, §2-4 확인 | `viewer.canWrite` 분기 |
| R-CHAT-004 하단 바 | S2 | C 96~136px(Composer: 캐릭터 버튼 2·OOC Toggle·TextArea·전송) | `viewer.canWrite && …`, 히스토리 높이 385~425 |
| R-CHAT-005 speak · 임시/실패 말풍선 | S3 | B 끝 임시 말풍선(Bubble pending/error 변형) | `chatReducer`에 pending 액션 추가, 성공 시 `messagesAppended` 경로 재사용 |
| R-CHAT-006 user 저장 | S2 | C 2행 | 성공 응답 → `messagesAppended({ isNearBottom: autoScroll.isNearBottom() })` |
| R-CHAT-007 말풍선 메뉴·수정·삭제·재작성 | S2·S3 | 구성안 §2-1 바텀시트, 인라인 수정 | Bubble에 `useLongPress`·`onContextMenu`는 `canWrite`일 때만 연결 |
| R-CHAT-009 토큰 메모리 보관 | S2 | `ui/src/state/token.ts`, `client.ts` getter로 헤더 부착 | `viewer.canWrite` 계산 |
| R-CHAT-011 코드별 안내·읽기 전용 전환 | S2·S3 | E 알림 줄 28px, D 재사용 | `errorDetail` 확장, `LEVEL_TOO_LOW`·`TOKEN_INVALID` → `canWrite=false` 전환 |
| R-CHAT-012 장기기억 | S4 | 구성안 §2-3 M1 전체 덮는 뷰 | ⋯ 메뉴 진입 |
| R-CHAT-013 쓰기 판 스크린샷 | S2 | — | — |

---

## 15. RTM (요구 추적 매트릭스)

상태: ✅ = 가리킨 절에 실체 있음. `후속(Sn)` = 이번 묶음 범위 밖, §14에 자리만 있음. 절 표기: `C` = `design/components.md`, `F` = `design/functions.md`, `A` = `design/a11y.md`.

| 요구ID | 설계 절 | api 계약 | 예정 TC | 상태 |
|---|---|---|---|---|
| R-CHAT-001 🔒 | §2.1 A · §3.1 · F §4 F-CH-01·10 · §8 · A | — (방 정보는 rooms에서 전달) | TC-CH-001 · 002 · 003 | ✅(‹·제목·생성일) / 후속(S2: ⋯) |
| R-CHAT-002 🔒 | §2.1 B · C §2.1·§2.2 · F §4 F-CH-03·11·15 · §8 · C §4 | api.md §4.3 `Message`, §5.5 `CHARACTERS` | TC-CH-004 · 005 · 006 · 007 · 008 · 009 · 010 · 030 | ✅ |
| R-CHAT-003 🔒 | C §2.1·§2.3·§2.4 · C §3 · F §1 · F §2 · F §4 F-CH-03~09·11~14 · §6.2·§6.3 | api.md §4.3 `before`·`hasMore` | TC-CH-004 · 005 · 006 · 011~020 · 029 | ✅(새 메시지 실제 발생은 S2·S3, 상태·훅은 TC로 검증) |
| R-CHAT-004 🔒 | §10 · §14 | E8(S2) | 부재 TC-CH-021 | 후속(S2) — S1 부재 쪽 ✅ |
| R-CHAT-005 🔒 | §10 · §14 | E9(S3) | (S3) | 후속(S3) |
| R-CHAT-006 🔒 | §14 | E8(S2) | (S2) | 후속(S2) |
| R-CHAT-007 🔒 | §10 · §14 | E10·E11·E12 | 부재 TC-CH-022 | 후속(S2·S3) — S1 부재 쪽 ✅ |
| R-CHAT-008 🔒 | §10 · F §4 F-CH-01 · C §2.5 | — | TC-CH-003 · 021 · 022 · 023 | ✅ |
| R-CHAT-009 🔒 | §10(토큰 비저장) · §14 | api.md §2.2(S2) | (S2) | 후속(S2) |
| R-CHAT-010 | rooms C §1.7 · F §3 · F §4 F-CH-02·09 · §6.1 | — (localStorage) | TC-CH-024 · 025 · 026 | ✅ |
| R-CHAT-011 | §8.2(확장 지점) · §14 | api.md §3.2 | (S2·S3) | 후속(S2·S3) |
| R-CHAT-012 🔒 | §14 | E13·E14(S4) | (S4) | 후속(S4) |
| R-CHAT-013 🔒 | §2.3 · A · C §4 · §8 aria-label | — | TC-CH-027 · 028(수동) | ✅(읽기 전용 판) / 후속(S2: 쓰기 판 스크린샷) |
| R-LLM-002 🔒 (표시 메타) | C §2.2 · §7 · §13 | api.md v0.2 §5.5 `shortName` | TC-CH-007 | ✅ |
| R-MSG-001 🔒 (데이터) | §7 · F §1.2 `nextBefore` | api.md §4.3 | TC-CH-004 · 011 | ✅ |
| R-NFR-004 🔒 (화면 쪽) | §10(토큰을 읽지도 저장하지도 않음) · rooms C §1.7(storage에 토큰 키 없음) | api.md §2.1(읽기 경로 토큰 불필요) | TC-CH-024 · 025(저장 키가 `ld:lastRoomId`·`ld:scroll:{id}`뿐) · 리뷰 grep | ✅ |
| R-ROOMS-004 (기록·삭제 시점) | F §4 F-CH-02·10 · §6.4 | — | TC-CH-002 · 024 | ✅ |

### 15.1 예정 TC 목록 (ui-test-designer가 시나리오로 확정)

| TC | 내용 | 기대(요지) |
|---|---|---|
| TC-CH-001 | 상단 바 | h1 = 방 제목, `<time>` = `formatMonthDay(room.createdAt)`(updatedAt 아님), aria-label `방 생성일 MM.DD` |
| TC-CH-002 | ‹ 뒤로 | 클릭 → `ld:lastRoomId` 삭제 후 `onBack` 1회. 마운트 시 이 버튼에 포커스 |
| TC-CH-003 | ⋯ 부재 | 상단 바 버튼은 ‹ 하나뿐 |
| TC-CH-004 | 첫 로드 호출 | `listMessages`가 `(room.id)`로 1회(두 번째 인자 없음), 대기 중 `대화를 불러오는 중` |
| TC-CH-005 | 첫 로드 오류·재시도 | `role=alert` 제목·상세·「다시 시도」 → 재호출 → 성공 시 말풍선 |
| TC-CH-006 | 빈 방 | `{ messages: [], hasMore: false }` → `아직 대화가 없습니다`, `role=log` 없음 |
| TC-CH-007 | 캐릭터 말풍선 | 왼쪽 클래스, `img[src="/embed/img/ciel.png"]`, 이름 `시엘`, 시각 `HH:mm` |
| TC-CH-008 | 유저 말풍선 | 오른쪽 클래스, 작성자명, `authorName=null` → `이름 없음` |
| TC-CH-009 | OOC | 중앙 클래스, `[지시] 텍스트`, 작성자명 없음 |
| TC-CH-010 | 변형 판정 | `bubbleVariantOf`: `kind='ooc'`면 speaker와 무관하게 ooc |
| TC-CH-011 | 이전 페이지 요청 | scrollTop ≤ 80 + scroll 이벤트 → `listMessages(room.id, { before: 첫 id })`, B0 `이전 대화 불러오는 중`, `aria-busy=true` |
| TC-CH-012 | 앵커 보존 | 앞붙임 후 `scrollTop = 이전 scrollTop + Δ scrollHeight`(jsdom 값 고정) |
| TC-CH-013 | 중복·종료 | 로딩 중 scroll 이벤트 연속 → 요청 1회. `hasMore=false` → 요청 없음 |
| TC-CH-014 | 이전 페이지 오류 | B0 `이전 대화를 불러오지 못했습니다` + 「다시 시도」, 스크롤로 재요청 없음, 버튼으로 재요청 |
| TC-CH-015 | 리듀서 T1~T8 | 전이표 행마다 기대 상태·같은 참조 반환 |
| TC-CH-016 | 리듀서 T9~T12 · `mergeMessages` · `nextBefore` · `canAutoLoadOlder` | 중복 id 제거·정렬·unseen 증가/초기화 |
| TC-CH-017 | `scroll.ts` | 경계값(80·120), `restoreScrollTop` 클램프(저장 거리 > 내용 높이 → 0) |
| TC-CH-018 | `useAutoScroll` 뒤붙임 | 맨 아래 근처 → scrollTop = scrollHeight / 위쪽 → 그대로 |
| TC-CH-019 | 새 메시지 배지 | `unseenCount>0` → 배지, 클릭 → 맨 아래 + `unseenCleared` |
| TC-CH-020 | 맨 아래 도달 해제 | onScroll로 맨 아래 근처 → `onReachBottom` |
| TC-CH-021 | 읽기 전용 하단 바 부재 | `세바스찬`·`시엘` 버튼·textbox·switch 없음 |
| TC-CH-022 | 말풍선 메뉴 부재 | 말풍선 `contextmenu`·500ms 누름 뒤 `dialog`·`menu` 없음 |
| TC-CH-023 | 열람 안내 | `role=note` 문구 일치 |
| TC-CH-024 | 마지막 본 방 기록·삭제 | 마운트 → `ld:lastRoomId = room.id`. ‹ 뒤로 → 키 삭제. `pagehide`만으로는 삭제 안 함. 저장소 throw여도 `onBack` 호출 |
| TC-CH-025 | 스크롤 저장·복원 | 언마운트·`pagehide` → `ld:scroll:{id}` 저장, 재마운트 시 `restoreScrollTop` 적용. 로딩 중 언마운트는 저장 안 함 |
| TC-CH-026 | 저장소 throw | 모든 storage 접근 throw → 화면 정상, 맨 아래 배치 |
| TC-CH-027 | 접근성 | `role=log`·`aria-live=polite`, 버튼 레이블, 포커스 순서 |
| TC-CH-028 | 390×565 스크린샷(수동) | 가로 스크롤 없음, A 44·D 28, 화자 정렬·색 |
| TC-CH-029 | 늦은 응답 무시 | 응답 전 언마운트 → 상태 갱신 없음 |
| TC-CH-030 | 오류 상세 | `NETWORK`·`NOT_FOUND`·`INTERNAL` 문구, 서버 message 미표시 |
