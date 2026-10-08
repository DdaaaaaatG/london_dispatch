# chat 상세 설계 — S6 방 비밀번호 잠금: 예정 TC · 기존 TC 영향 · 인계 (분할 문서, v2.3)

> 본문: `design/lock.md`(절 표기 `LK`). 이 파일 절 표기 `LT`. ui-test-designer가 `test/scenarios.md`로 확정한다. 기대는 3단(화면 · 상태/저장 · api 인자).
> 공통 픽스처: `room = { id: 'r1', title: '비밀 다과회', createdAt, updatedAt, messageCount, locked }`. **`@/api/rooms` 팩토리(`vi.mock('@/api/rooms', …)` 또는 `@/api` 팩토리 안 rooms 래퍼)가 있는 스펙**에 `setRoomPassword` · `clearRoomPassword` · `enterRoom`을 추가한다. `localStorage`는 jsdom 실물(각 TC 뒤 `clear()` + `resetRoomKeyCache()`).

## 1. 예정 TC (TC-CH-140~163)

| TC | 내용 | 기대(요지) |
|---|---|---|
| TC-CH-140 | 방 메뉴 5항목 | 토큰 있음: ⋯ → 시트 항목 글자 순서 `이름 변경`·`장기기억`·`잠금`·`방 삭제`·`취소`, `잠금`에 `danger` 클래스 없음 / 읽기 전용: ⋯·`잠금` DOM 0 · `setRoomPassword`·`clearRoomPassword` 0회 |
| TC-CH-141 | 걸기 시트 열기 | `locked: false` → 잠금 → `role=dialog` 이름 `비밀번호 걸기` · 입력 `type="password"` · `autocomplete="new-password"` · placeholder `6자 이상 권장` · 카운터 `0/32` · 입력 포커스 · 저장 버튼 `잠그기` disabled |
| TC-CH-142 | 길이 경계 | `abc` → 잠그기 disabled · `abcd` enabled · 32자 enabled · 33자 disabled + 카운터 `over` + `aria-invalid` · `' ab '` → `4/32` enabled(trim 없음) · 이모지 4개 enabled |
| TC-CH-143 | 잠그기 성공 | 입력 `abcd` → 잠그기 → `setRoomPassword('r1', 'abcd')` 1회 → 응답 `{ room: {…locked: true}, entryKey: 'e1.k' }` → `ld:roomKeys` = `[["r1","e1.k"]]` · `onRoomRenamed` 인자 `locked: true` · 시트 없음 · `role=alert` 토스트 `방을 잠갔습니다.`(success) · 저장소 어디에도 `abcd` 없음 · ⋯ 포커스 |
| TC-CH-144 | 잠금 시트 | `locked: true` → 잠금 → 이름 `잠금 메뉴` · 머리 `잠금 · 비밀 다과회` · 항목 `비밀번호 바꾸기`·`잠금 풀기`·`취소` · `잠금 풀기`에 `danger` 클래스 없음 · 요청 0회 |
| TC-CH-145 | 바꾸기 성공 | 비밀번호 바꾸기 → 시트 이름 `비밀번호 바꾸기` · 저장 `바꾸기` · placeholder 같음 → `setRoomPassword('r1', 'newpass')` → 새 증명 `e1.n`이 옛 `e1.o`를 덮음(`ld:roomKeys`에 r1 쌍 1개) · 토스트 `비밀번호를 바꿨습니다.` |
| TC-CH-146 | 풀기 | 잠금 풀기 → `role=alertdialog` 이름 `잠금을 풀까요?` · 설명 `잠금을 풀면 누구나 이 방 대화를 볼 수 있습니다.` · 첫 포커스 `취소` / 취소 → `clearRoomPassword` 0회 / 풀기 → `clearRoomPassword('r1')` 1회 → `ld:roomKeys`에서 r1 제거(마지막이면 키 삭제) · `onRoomRenamed` 인자 `locked: false` · 토스트 `잠금을 풀었습니다.` |
| TC-CH-147 | E18 실패 | `VALIDATION_ERROR` → 시트 안 alert `비밀번호는 4~32자로 입력해 주세요.` · `RATE_LIMITED`+`retryAfterSec: 30` → `…30초 후 다시 시도해 주세요.` · `NETWORK` → `서버에 연결할 수 없습니다.` · `NOT_FOUND` → 방 문구 · 각각 시트·입력값 유지, 버튼 다시 활성, 토스트 없음, 저장소 불변 / `TOKEN_INVALID` → 시트 없음 · `onAuthFailure` 1회 · 전환 문구 토스트 |
| TC-CH-148 | E19 실패 | `INTERNAL` → 시트 없음 · E 토스트 `ERROR_MESSAGES.INTERNAL` · 증명 유지 / `LEVEL_TOO_LOW` → 전환 |
| TC-CH-149 | 요청 중 | E18 대기 중: 입력 readOnly · 두 버튼 disabled · Esc·덮개로 안 닫힘 · Enter 연타 → 1회 / E19 대기 중: 두 버튼 disabled · (시트 밖) ⋯ disabled · 말풍선 버튼 disabled |
| TC-CH-150 | 첫 로드 `ROOM_LOCKED`(읽기 전용) | `listMessages` → `ROOM_LOCKED` → `role=status` `잠긴 방입니다` · 말풍선 `li` 0 · ⋯·textbox·캐릭터 버튼 0 · `role=note` 열람 안내 있음 · `role=dialog` 이름 `비밀번호`(placeholder 없음, `0/64`) · **`document.activeElement` = 시트 입력(‹ 아님 — LK §1.3 포커스 규칙)** · `enterRoom` 0회 · 상단 바 날짜 있음 · `onAuthFailure` 0회 · 토스트 없음 |
| TC-CH-151 | 첫 로드 `ROOM_LOCKED`(토큰) | 사전 `ld:roomKeys` = `[["r1","old"]]` → `ROOM_LOCKED` → `ld:roomKeys`에서 r1 제거 → `enterRoom('r1')`(인자 1개) 1회 · **조용한 시도 대기 중 `document.activeElement` = ‹** / 200 `e1.x` → 저장 → `listMessages('r1')` 2번째 호출 → 말풍선 표시 · ‹ 포커스 / 다른 판 `ROOM_LOCKED` → 시트(문구 없음) · **시트 입력 포커스(BottomSheet가 기억한 복귀 대상 = ‹)** · ⋯·하단 바 0 · `role=note` 0 |
| TC-CH-152 | 시트 입장 | `pw1234` → 입장 → `enterRoom('r1', 'pw1234')` → 200 → 시트 없음 · `listMessages` 재호출 · 말풍선 표시 · `ld:lastRoomId` = `r1` · 저장소에 `pw1234` 없음 / `ROOM_PASSWORD_WRONG` → alert `비밀번호가 맞지 않습니다.` · 시트 유지 |
| TC-CH-153 | 취소·사라짐 | 시트 취소·Esc → `onBack` 1회 · `ld:lastRoomId` 없음 · `enterRoom` 추가 0회 / 시트 제출 `NOT_FOUND` → `onBack` 1회 · `ld:lastRoomId` 없음 |
| TC-CH-154 | 쓰기 중 `ROOM_LOCKED` | 각각 send · editMessage · deleteMessage(확인 뒤) · regenerate · speak(캐릭터) · 자동 응답 speak(`'auto'`) · renameRoom · deleteRoom · getMemory · putMemory: 응답 `ROOM_LOCKED` → 증명 삭제 · `잠긴 방입니다` 판 · 시트·편집기·임시/실패 말풍선 DOM 0 · 토스트 0 · `onAuthFailure` 0 · 같은 래퍼 재호출 0(자동 재시도 없음) |
| TC-CH-155 | 이전 페이지 `ROOM_LOCKED` | 위로 스크롤 → `listMessages('r1', { before })` → `ROOM_LOCKED` → 잠긴 판 · B0 오류 줄 없음 |
| TC-CH-156 | 메시지 id 래퍼 `roomId` | 수정 저장 → `editMessage(5, { text: '고침' }, 'r1')` · 삭제 → `deleteMessage(5, 'r1')` · 재작성 → `regenerate(9, 'r1')` |
| TC-CH-157 | 방 삭제 증명 삭제 | 사전 r1·r2 증명 → 방 삭제 204 → `ld:roomKeys` = `[["r2",…]]` · `NOT_FOUND`도 같음 / 증명 없는 방 삭제 → `setItem('ld:roomKeys')` 0회 |
| TC-CH-158 | E18·E19 `ROOM_LOCKED` | 걸기 시트·풀기 확인 각각 → 시트 없음 · 잠긴 판 · 토스트 0 |
| TC-CH-159 | 동시 `ROOM_LOCKED` | 이전 페이지·자동 응답이 같은 틱에 `ROOM_LOCKED` → `enterRoom` 1회 · 판 1개 |
| TC-CH-160 | 저장소·비밀값 | 잠금 미사용 흐름(TC-CH-024) 뒤 키 = `['ld:lastRoomId']` 이하(+ 스크롤 키) · 토큰 값 저장소 0건 · 걸기·입장 뒤 비밀번호 원문 저장소 0건 · (리뷰 grep) chat 소스 `localStorage` 0 · `fetch` 0 · `console.`에 password·entryKey 0 |
| TC-CH-161 | 잠긴 방 메뉴 분기 일치 | `locked: false` 방에서 `ROOM_LOCKED` → `onRoomRenamed`에 `locked: true` 1회 → (App 재렌더 후) 재입장 → 잠금 → 잠금 시트(걸기 시트 아님) |
| TC-CH-162 | TC-FLOW 토큰 | App(`?t=x`) → 방 진입 → 잠금 → `abcd` 잠그기 → ‹ → 목록 행 자물쇠 → 같은 행 탭 → `enterRoom` 0회로 chat 진입(증명 재사용) → 잠금 풀기 → ‹ → 행 자물쇠 없음 |
| TC-FLOW-CH-22 | TC-FLOW 읽기 전용(자동 흐름 — 옛 예약 번호 TC-FLOW-163) | App(토큰 없음) · 증명 있는 잠긴 방 진입 → `listMessages` `ROOM_LOCKED`(비밀번호 바뀜) → 판 + 시트 → 입장 → 대화 표시 / 취소 → 목록 |
| (수동) TC-CH-163 | 스크린샷 390×565 | 방 메뉴 5항목 · 잠금 시트 · 걸기 시트(placeholder · 실패 문구 판) · 풀기 확인 · 입장 재요구 판(토큰 있음/없음) — `doc/300_검증/screenshots/{YYYYMMDD-HHMM}/`. `manual-checklist.md` 행 |

| TC-CH-164 | 재입장 뒤 `locked` 복귀(D-48) | `locked: true` 방 · E7 `ROOM_LOCKED` → `onRoomRenamed`에 `locked: true`는 원래 true라 0회 / 토큰 있음 · `enterRoom('r1')` 200 `entryKey: null` → `ld:roomKeys`에 r1 없음 · `onRoomRenamed` 인자 `{ …, locked: false }` 1회 · `listMessages` 재호출 / 200 문자열이면 `locked: false` 호출 0회 |
| TC-CH-165 | 조용한 재입장 상한(D-55) | 토큰 있음 · `enterRoom` 항상 200 `e1.x` · `listMessages` 항상 `ROOM_LOCKED` → `enterRoom` 정확히 2회 → 3번째 `ROOM_LOCKED`에서 `enterRoom` 호출 없이 시트(`role=dialog` 이름 `비밀번호`, 같은 커밋에 열려 입력 포커스 — 카운터는 껍데기 상태라 2회째 재입장 렌더에서 `canWrite`가 false로 재계산됨) / (c) 시트 경로는 세지 않는다: 조용한 시도가 `ROOM_LOCKED` → 시트 → 비밀번호 입장 200으로 재입장한 경우는 카운터가 늘지 않아(판별 = gate 플래그 `quietAttemptRef`, `entry.sheet` 아님), 그 뒤 `ROOM_LOCKED`에서도 조용한 시도가 횟수대로 다시 일어난다 / 대조: 2번째 재입장 뒤 `listMessages` 200이면 카운터 0 → 다음 `ROOM_LOCKED`에서 다시 조용한 시도 1회 |

- 번호(재배정 확정): 자동 흐름은 **TC-FLOW-CH-22**, TC-CH-163은 수동(**MC-CH-23·24**, `test/manual-checklist.md`). 이전 메모 — TC-FLOW-163(자동)과 TC-CH-163(수동)은 ui-test-designer가 겹치지 않게 다시 매길 수 있다(예약 범위 140~169 — 시나리오 보정으로 TC-CH-166(‹ 클릭 F-CH-66) · 167(토큰 있음 시트 입장 성공·취소) · 168(바꾸기 판 실패 mode 유지 F-CH-80 ④) · 169(잠긴 뒤 늦은 응답 폐기 F-CH-64 `isActive`) 신설, 상세는 `test/scenarios.md`).

## 2. 기존 TC 영향

| 대상 | 변경 | 사유 |
|---|---|---|
| `@/api/rooms` 팩토리가 있는 chat 스펙(또는 `@/api` 팩토리 안에 rooms 래퍼를 직접 나열한 스펙) | `setRoomPassword` · `clearRoomPassword` · `enterRoom` 추가 — 팩토리에 없으면 import가 `undefined`가 된다 | `index.tsx`·`useRoomActions`·`useRoomLockGate` import |
| `RoomSummary` 픽스처(ChatScreen · ChatScroll · RoomMenu · MemorySheet · MessageActions · Regenerate · SpeakFlow · AutoReply · AuthTransition · Composer · MessageList · Bubble 테스트) | `locked: false` 추가(공용 픽스처 도우미 권고) | 필수 필드(api.md §5.10.1) |
| 메시지 id 래퍼 호출 단언(MessageActions · Regenerate · AuthTransition · ChatScreen 테스트 중 `editMessage`·`deleteMessage`·`regenerate` 인자 단언 전부) | 마지막 인자 `'r1'`(방 id) 추가 | F-CH-72 |
| TC-CH-047(방 메뉴 항목, S4 개정) | 4항목 → 5항목(TC-CH-140이 대체 단언) | R-CHAT-001 S6 개정 |
| `role=dialog`·`role=alertdialog` 개수 단언 | 불변(잠긴 판 테스트 외) | — |
| 저장소 단언 `['ld:lastRoomId']`(TC-CH-024 등) | 유지 — 잠금 미사용 흐름은 `ld:roomKeys`를 만들지 않는다 | LK §9 |
| `RoomBusy` 타입을 쓰는 테스트 | 값 2개 추가, 기존 단언 불변 | LK §2 |
| `ChatScreen` 렌더 테스트 | 진입점 이름 불변(껍데기), DOM 불변 | D-44 |

## 3. 인계

### 3.1 ui-implementer — 파일

| 파일 | 할 일 |
|---|---|
| `ui/src/chat/index.tsx` | 옛 `ChatScreen` → `ChatRoomView`(+`onRoomLocked`), 새 껍데기 `ChatScreen`(LK §1.3), `SheetLayer` 배선(F-CH-83) |
| `ui/src/chat/useRoomLockGate.ts`(신규) | F-CH-63~66 |
| `ui/src/chat/components/LockedRoomView.tsx`(신규) · `LockMenuSheet.tsx`(신규) | LK §1.3 · §1.4 |
| `ui/src/chat/components/RoomMenuSheet.tsx` · `ChatSheets.tsx` | LK §1.5 |
| `ui/src/chat/useChatScreen.ts` · `useChatLoader.ts` · `useWriteFailure.ts` | `onRoomLocked` · `onRoomOpened` 전달 · F-CH-69 · F-CH-70(`useChatLoader(roomId, { onRoomLocked, onRoomOpened })`) |
| `ui/src/chat/useMessageWrites.ts` | F-CH-71 · F-CH-72 |
| `ui/src/chat/useMemorySheet.ts` | F-CH-73 |
| `ui/src/chat/useRoomActions.ts` · `useChatSheets.ts` | F-CH-74~81 · F-CH-84. `useChatSheets.ts`가 400줄·함수 50줄을 넘으면 잠금 핸들러를 `useLockSheets.ts`로 분리 |
| `ui/src/chat/labels.ts` | LK §6 · F-CH-85 |
| 머리 주석 | 각 파일 요구 R-LOCK-002·004·006 · 설계 `design/lock.md` |

- 쓰지 않는다: 공용 `components/ui/*`·`components/roomEntry/*`·`state/roomKeys.ts`(rooms 묶음) · `ui/src/api/*`(contract) · `App.tsx`(불변).

### 3.2 ui-test-designer

- 질의 이름: 메뉴 항목 `getByRole('button', { name: '잠금' })` · 시트 `getByRole('dialog', { name: '비밀번호 걸기' })` · 입력 `getByLabelText('새 비밀번호')` · 입장 입력 `getByLabelText('방 비밀번호')` · 잠긴 판 `getByRole('status')` 글자 `잠긴 방입니다`.
- mock 응답: `setRoomPassword` → `{ ok: true, value: { room: { …locked: true }, entryKey: 'e1.k' } }` · `clearRoomPassword` → `{ ok: true, value: { …locked: false } }` · 실패 `{ ok: false, error: { code: 'ROOM_LOCKED', message: '…' } }`.
- 증명 값은 가짜 문자열만(`e1.k` 등). 실제 형식·비밀값 금지.
