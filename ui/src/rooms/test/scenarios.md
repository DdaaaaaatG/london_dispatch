# rooms(방 목록) 테스트 시나리오

- 기준: `ui/src/rooms/design.md` v1.5(+ `design/components.md` · `design/functions.md` · `design/a11y.md`) / `ui/src/rooms/requirements.md` v1.4 / `doc/200_설계/contract/api.md` v0.3.1 / chat 쪽 공용 인용 `ui/src/chat/design.md` v1.5
- 작성일: 2026-10-05 · 작성: ui-test-designer · 모드: **증분**(S1 TC-RM-001~017 보존, S2 TC-RM-018~032 추가) · 상태: **초안 v0.5(S2 검증 지적 TK-01~09 반영, 재검증 대기)**
- 묶음: **S1(저장 + 읽기 전용 화면)** + **S2(토큰 + 새 방)**. S1 TC의 토큰 분기는 "없음"(READ_ONLY_VIEWER) 그대로다. S2 TC는 토큰 있음/없음 쌍(TC-RM-011 ↔ 018)과 전환(024)을 더한다.
- **S2 공통 전제(추가 — S1 전제는 아래 그대로 유지)**
  - **토큰 주입 진입점 통일**: 화면 단위 스펙은 `viewer` props(`WRITER_VIEWER`·`READ_ONLY_VIEWER`, `@/state/viewer`)로만 준다. App 통합 스펙은 `render(<App />)` **전에** `initToken('?t=test-token')`(`@/state/token`, 설계가 정한 유일한 읽기 진입점)을 부르고 `afterEach`에서 `clearToken()`. `window.history.replaceState`·`main.tsx` import·`configureClient` 호출은 쓰지 않는다(래퍼를 모킹하므로 Bearer 헤더 부착은 api 스펙 API-T-UI-011~013 몫).
  - **쓰기 래퍼 모킹**: `vi.mock('@/api/rooms', () => ({ listRooms, createRoom, renameRoom, deleteRoom }))`(전부 `vi.fn()`). App 통합은 `vi.mock('@/api/messages', () => ({ listMessages, appendUser, editMessage, deleteMessage }))`도. `isAuthFailure`·`configureClient`는 모킹하지 않는다(`@/api/client` 실물). 실패 = `{ ok: false, error: { code, message: 'SERVER-RAW-MESSAGE', retryAfterSec? } }`. `fetch` 모킹 금지.
  - **RoomsScreen props(S2)**: `viewer · autoOpenRoomId · onOpenRoom · onAutoOpenSettled · onAuthFailure`. App의 전환을 화면 단위로 흉내 낼 때는 `rerender`로 `viewer=READ_ONLY_VIEWER`를 넘긴다.
  - **대기 규칙**: 호출이 생기는 판정은 `findBy*`·`waitFor`. "호출 없음·횟수 유지" 판정 앞에는 `await act(async () => {})`.
  - **토스트 2초**: 실패 응답을 resolve하기 **전에** `vi.useFakeTimers()`를 설치하고 `await act(async () => d.resolve(…))` → `act(() => vi.advanceTimersByTime(1999))` → 아직 있음 → `advanceTimersByTime(1)` → 없음. 가짜 시계 구간에서는 `findBy*`·`waitFor`를 쓰지 않고 `getBy*`·`queryBy*`로 단언한다(RTL `waitFor`가 vitest 가짜 시계를 모른다).
  - **입력**: 60·61자처럼 긴 값은 `fireEvent.change`, 짧은 값·키보드는 `userEvent`. IME 조합 Enter는 `fireEvent.keyDown(input, { key: 'Enter', isComposing: true })`.
  - **토스트 톤 클래스**: Toast 루트 클래스 키 `warning`·`danger`(rooms C §1.18 `cx(root, tone)`, `classNameStrategy: 'non-scoped'`라 클래스명 = 키). 카운터 초과 클래스 `over`(C §1.12).
  - **픽스처(S2)**: 생성 응답 `안개 낀 런던`(id `r9`, createdAt = updatedAt 10.05 17:00, messageCount 0). 입력 원문 `'  안개 낀 런던  '`.
- 공통 전제
  - api 래퍼는 `vi.mock('@/api/rooms')`(App 흐름은 `@/api/messages`도)로 대체하고 `Result<T>`(`{ ok: true, value }` / `{ ok: false, error: { code, message } }`)를 돌려준다. `fetch` 모킹 금지.
  - 응답 순서는 deferred promise + `await findBy*`·`waitFor`로 고정한다. 실제 sleep 없음.
  - vitest globals 미설정 → 각 스펙이 `afterEach(cleanup)`를 직접 부른다. 매 TC 전 `localStorage.clear()`.
  - 날짜 픽스처는 로컬 생성자(`new Date(2026, 9, 5, 16, 40)`)로 만든다(시간대 무관).
  - 픽스처 방: `체스 대결`(id r2, updatedAt 10.03) · `티타임`(id r1, updatedAt 10.05). 행 이름 = `{제목}, 마지막 갱신 {MM.DD}`.
  - **구현 이름 계약(설계 문서에 아직 없음 — 이 문서가 고정, 설계 반영은 메인 세션이 ui-designer에게 요청)**
    1. 컴포넌트·훅은 **named export**다: `App`(`@/App`) · `RoomsScreen`(`@/rooms`) · `ChatScreen`(`@/chat`) · `Bubble`·`bubbleVariantOf`(`@/chat/components/Bubble`) · `MessageList`·`MessageListProps`(`@/chat/components/MessageList`) · `useAutoScroll`·`UseAutoScrollOptions`·`UseAutoScrollResult`(`@/components/hooks/useAutoScroll`).
    2. Bubble 클래스 키(chat 스펙이 쓴다): 변형 `styles.character`·`styles.user`·`styles.ooc` + 캐릭터 색 `styles.ciel`·`styles.sebastian`. 테스트는 `ui/vite.config.ts`의 `classNameStrategy: 'non-scoped'`라 클래스명 = 키다.

## TC 목록

### TC-RM-001 · 목록 렌더(받은 순서 유지) · 종류: 자동 · 요구: R-ROOMS-001 · R-ROOM-001 · 설계: §2.1 · C §2.1·§2.2 · F-RM-05·06·11 · §7 · 토큰: 없음
- Given `listRooms`가 `[체스 대결(10.03), 티타임(10.05)]`(updatedAt 오름차순 — 재정렬 감지용)을 돌려준다. 저장된 방 없음
- When RoomsScreen을 마운트한다
- Then ⓐ `ul` 안 `li` 2개, 행 버튼 이름이 받은 순서 그대로 `체스 대결, 마지막 갱신 10.03` → `티타임, 마지막 갱신 10.05`. 행 안 `<time dateTime="2026-10-03">10.03</time>` ⓑ 저장소 키 0개(자동 진입 판정이 아무것도 쓰지 않음) ⓒ `listRooms` 1회, 인자 없음
- 스펙: `ui/src/rooms/test/RoomsScreen.test.tsx`

### TC-RM-002 · 행 클릭 진입 · 종류: 자동 · 요구: R-ROOMS-001 · 설계: F-RM-09 · C §2.1 · 토큰: 없음
- Given 목록이 그려져 있다
- When `티타임` 행을 클릭한다
- Then ⓐ 화면 전환은 App 몫이므로 RoomsScreen은 그대로 ⓑ `onOpenRoom`이 `티타임` RoomSummary로 1회. `ld:lastRoomId`는 아직 없음(저장은 ChatScreen 마운트 몫, F-RM-02) ⓒ `listRooms` 추가 호출 없음(1회 유지)
- 스펙: `RoomsScreen.test.tsx`

### TC-RM-003 · 키보드 진입 · 종류: 자동 · 요구: R-ROOMS-001 · 설계: C §2.1 키보드 · A 키보드 · 토큰: 없음
- Given 목록이 그려져 있고 `티타임` 행에 포커스
- When Enter, 이어서 Space를 누른다
- Then ⓐ 행은 `button`이라 기본 동작으로 활성화 ⓑ `onOpenRoom` 1회 → 2회, 인자 `티타임`. `ld:lastRoomId` 없음 ⓒ `listRooms` 1회 유지
- 스펙: `RoomsScreen.test.tsx`

### TC-RM-004 · 로딩 상태 · 종류: 자동 · 요구: R-ROOMS-003 · 설계: §2.1 상태 변형 · C §1.4 · F-RM-05·06 · §8.1 `loading` · 토큰: 없음
- Given `listRooms`가 대기 중(deferred)
- When RoomsScreen을 마운트한다
- Then ⓐ `role=status` "불러오는 중", `list`·`alert` 없음. 응답 후 `status` 사라지고 `list` 표시 ⓑ 대기 중 `onAutoOpenSettled` 미호출(판정 전) ⓒ `listRooms` 1회
- 스펙: `RoomsScreen.test.tsx`

### TC-RM-005 · 빈 목록 · 종류: 자동 · 요구: R-ROOMS-003 · 설계: §2.1 · C §1.4 · §8.1 `empty` · 토큰: 없음
- Given `listRooms` → `ok([])`, 저장된 방 없음
- When 마운트한다
- Then ⓐ `role=status` "아직 방이 없습니다", `ul` 없음, `alert` 없음 ⓑ `onAutoOpenSettled` 1회, `onOpenRoom` 미호출 ⓒ `listRooms` 1회
- 스펙: `RoomsScreen.test.tsx`

### TC-RM-006 · 오류 + 다시 시도 · 종류: 자동 · 요구: R-ROOMS-003 · 설계: §2.1 · C §1.2·§1.4 · F-RM-06·07 · §6.4 · §8.1 `loadError`·`retry` · 토큰: 없음
- Given 1회째 `listRooms` → `INTERNAL` 실패, 2회째 → 대기 후 `ok(목록)`
- When 오류 화면에서 「다시 시도」를 누르고, 2회째 응답이 도착한다
- Then ⓐ 실패 시 `role=alert`에 `목록을 불러오지 못했습니다` + `ERROR_MESSAGES.INTERNAL` + 버튼 `다시 시도`. 클릭 직후 `status` "불러오는 중"·`alert` 없음. 응답 후 행 표시·「다시 시도」 없음 ⓑ 실패 동안 `onAutoOpenSettled` 미호출, 성공 후 1회 ⓒ `listRooms` 2회, 2회째 인자 없음
- 스펙: `RoomsScreen.test.tsx`

### TC-RM-007 · 오류 상세 코드별 · 종류: 자동 · 요구: R-ROOMS-003 · 설계: §8.2 `errorDetail` · §7 · 토큰: 없음
- Given `listRooms` → 실패 `{ code, message: 'SERVER-RAW-MESSAGE' }`, code ∈ `NETWORK` · `INTERNAL` · `CONFIG_INVALID`
- When 마운트한다
- Then ⓐ 상세 = `서버에 연결할 수 없습니다.` / `ERROR_MESSAGES.INTERNAL` / `ERROR_MESSAGES.CONFIG_INVALID`. `SERVER-RAW-MESSAGE` 텍스트 없음 ⓑ 저장소 키 0개 ⓒ `listRooms` 1회
- 스펙: `RoomsScreen.test.tsx`

### TC-RM-008 · 자동 진입 성공 · 종류: 자동 · 요구: R-ROOMS-004 · R-CHAT-010 · 설계: F-RM-08 · §6.2 · 토큰: 없음
- Given `ld:lastRoomId='r1'`, `autoOpenRoomId='r1'`, `listRooms` → 목록에 r1 포함
- When 마운트한다
- Then ⓐ 판정 시점에 목록 응답은 성공 상태(ready)다: 판정 후 `role=status`(로딩·빈)·`alert`가 없다. 목록이 화면에 한 번 커밋되는지는 단언하지 않는다(React 19 배칭으로 보장되지 않음 — 메인 세션 결정 CF-01, 설계 §6.2·F-RM-06/08 문장 갱신은 ui-designer 몫). 전환은 App 몫 ⓑ `onAutoOpenSettled` 1회가 `onOpenRoom(티타임)` 1회보다 먼저(`invocationCallOrder`). `ld:lastRoomId`는 `r1` 그대로 ⓒ `listRooms` 1회(단건 조회 없음)
- 스펙: `RoomsScreen.test.tsx`

### TC-RM-009 · 자동 진입 대상 없음 · 종류: 자동 · 요구: R-ROOMS-004 · 설계: F-RM-08 · §6.3 · 토큰: 없음
- Given (a) `ld:lastRoomId='gone'`, `autoOpenRoomId='gone'`, 목록에 없음 / (b) `autoOpenRoomId=null`
- When 마운트한다
- Then ⓐ 두 경우 모두 목록 유지 ⓑ (a) `ld:lastRoomId` 삭제, `onAutoOpenSettled` 1회, `onOpenRoom` 미호출 / (b) `onAutoOpenSettled` 1회, `onOpenRoom` 미호출, 저장소 키 0개 ⓒ `listRooms` 1회
- 스펙: `RoomsScreen.test.tsx`

### TC-RM-010 · 저장소 throw · 종류: 자동 · 요구: R-ROOMS-004 · R-CHAT-010 · R-NFR-004 · 설계: C §1.7 · F-RM-10 · §6.4 저장소 행 · 토큰: 없음
- Given (a) storage 단위: `Storage.prototype.getItem/setItem/removeItem` throw, 또는 `window.localStorage` 접근 자체가 throw (b) RoomsScreen: `removeItem`만 throw + 대상 없는 저장 id (c) App: 세 메서드 모두 throw
- When (a) storage 함수 5종 호출 (b) 마운트 (c) App 마운트 → 행 클릭 → ‹ 뒤로
- Then ⓐ (b)(c) 일반 목록·진입·뒤로가 정상, `alert` 없음, 자동 진입 없음 ⓑ (a) 차단 전에 값을 넣고 차단 상태(`getItem` throw / `window.localStorage` 접근 throw)를 먼저 확인한 뒤, 값이 있어도 읽기 `null`, 쓰기·삭제 throw 없음, 차단을 풀면 원래 값 그대로(막힌 쓰기·삭제 미반영). 메서드 throw·접근 throw 두 경우에 함수 5종을 모두 불러도 `console.error`·`console.warn`·`console.log` 0회. 정상 환경 왕복(저장→읽기→삭제), 빈 문자열은 `null`. 키 상수는 `ld:lastRoomId`·`ld:scroll:{id}`뿐이고 저장 후 남는 키도 그 둘뿐(토큰 키 없음) ⓒ (b) `listRooms` 1회 (c) `listRooms` 2회, `listMessages('r1')`
- 스펙: `ui/src/state/storage.test.ts` · `RoomsScreen.test.tsx` · `App.test.tsx`

### TC-RM-011 · 읽기 전용 부재 · 종류: 자동 · 요구: R-CHAT-008 · R-ROOMS-002(부재 쪽) · 설계: §2.2 · §10 · C §1.8 · 토큰: 없음
- Given `viewer=READ_ONLY_VIEWER`
- When 로딩 → 목록, 그리고 빈 목록 상태를 본다
- Then ⓐ 모든 상태에서 `button { name: /새 방/ }`·`textbox`·"새 방" 텍스트가 DOM에 없음. `<header>` 안 버튼 0개. 화면 버튼은 행 2개뿐(빈 목록이면 0개) ⓑ `READ_ONLY_VIEWER.canWrite === false`, 저장소 키 0개 ⓒ `listRooms` 1회(쓰기 래퍼 없음)
- 스펙: `RoomsScreen.test.tsx`

### TC-RM-012 · App 흐름 · 종류: 자동 · 요구: R-ROOMS-001 · R-ROOMS-004 · R-NFR-004 · 설계: F-RM-01~04 · §6.1 · §6.2 · §11.2 D-1·D-2 · C §1.8 · C §1.10 · 토큰: 없음((c)는 URL에만 `?t=`, `initToken` 미호출)
- Given (a) `ld:lastRoomId='r1'` (b) 저장 없음 (c) URL에만 `?t=TESTTOKEN.SIGNATURE`가 있고 `initToken`은 부르지 않는다. App은 URL을 직접 읽지 않는다(토큰을 읽는 곳은 `main.tsx`의 `initToken` 하나, C §1.10 — v0.5 CF-01 재정의). 저장 없음. `listRooms`·`listMessages`는 항상 성공
- When (a) App 마운트 → 자동 진입 → ‹ 뒤로 → App 언마운트 후 재마운트 (b) App 마운트 → `체스 대결` 클릭 (c) App 마운트 → `티타임` 클릭 → ‹ 뒤로
- Then ⓐ (a) `main "대화: 티타임"` → 뒤로 후 `main "방 목록"`·행 표시·h1 `ROOMS` 포커스 → 재마운트 시 chat 없이 목록 (b) `main "대화: 체스 대결"` (c) chat에 `role=note` `열람 전용 - 대화 참여는 등급 회원만`, `textbox` 없음, 목록에 새 방 버튼 없음 ⓑ (a) 진입 후 `ld:lastRoomId='r1'` → 뒤로 후 `null` (b) `'r2'` (c) 저장소 키는 `ld:lastRoomId`·`ld:scroll:*`만, 값에 토큰 문자열 없음 ⓒ (a) `listRooms` 1→2→3회, `listMessages`는 `('r1')` 1회뿐 (b) `listRooms` 1회, `listMessages('r2')` 1회 (c) `listRooms` 2회, `listMessages('r1')`
- 스펙: `ui/src/rooms/test/App.test.tsx`

### TC-RM-013 · formatDate · 종류: 자동 · 요구: R-ROOMS-001 · 설계: C §1.6 · F-RM-11 · 토큰: 무관
- Given 로컬 생성자로 만든 epoch ms
- When `formatMonthDay`·`formatTime`·`toIsoDate`·`toIsoDateTime`을 부른다
- Then ⓐ `10.05`·`01.05`·`12.31` / `16:40`·`09:07`·`00:00`·`23:59` / `2026-01-05` / `2026-01-05T09:07`. 자정 직후 `10.06` ⓑ 같은 입력 같은 출력. 네 함수를 부른 뒤 저장소 키 0개 ⓒ 모킹한 `listRooms`·`listMessages` 0회 호출
- 스펙: `ui/src/rooms/test/formatDate.test.ts`

### TC-RM-014 · 자동 진입 보류 · 종류: 자동 · 요구: R-ROOMS-004 · 설계: F-RM-06·08 · §6.4 2행 · §11.2 A-2 · 토큰: 없음
- Given `ld:lastRoomId='r1'`, `autoOpenRoomId='r1'`, 1회째 `listRooms` → `NETWORK` 실패, 2회째 → 목록(r1 포함)
- When 오류 화면에서 「다시 시도」
- Then ⓐ 1회째 `alert`에 `서버에 연결할 수 없습니다.` ⓑ 실패 동안 `onAutoOpenSettled`·`onOpenRoom` 미호출, `ld:lastRoomId='r1'` 유지 → 재시도 성공 후 settle 1회가 `onOpenRoom(티타임)` 1회보다 먼저 ⓒ `listRooms` 2회
- 스펙: `RoomsScreen.test.tsx`

### TC-RM-015 · 화면 크기·토큰(수동) · 종류: 수동 · 요구: R-ROOMS-005 · 설계: §2.1 · §2.3 · C §3 · A 포커스 링·대비 · 토큰: 없음
- Given 개발 서버, 브라우저 뷰포트 390×565, 시드 방 3개 이상(긴 제목 1개 포함)
- When 목록·로딩·빈 목록·오류 상태를 스크린샷으로 남긴다
- Then ⓐ 가로 스크롤 없음, 상단 바 44px, 행 56px, 긴 제목 한 줄 말줄임, Rosebell 색·serif 제목 ⓑ 해당 없음(시각 확인 항목) ⓒ 해당 없음 — 수동 확인표 `MC-RM-01~05`
- 스펙: `ui/src/rooms/test/manual-checklist.md`

### TC-RM-016 · 언마운트 후 응답 · 종류: 자동 · 요구: R-ROOMS-001 · R-ROOMS-004 · 설계: F §1.2 `isActiveRef` · F-RM-06 · §6.4 마지막 행 · 토큰: 없음
- Given `listRooms`가 대기 중, (a) `autoOpenRoomId='r1'`(목록에 있음) (b) `autoOpenRoomId='gone'`(목록에 없음, 저장소에도 `gone`)
- When 응답 전에 언마운트하고, 그 뒤 응답이 도착한다
- Then ⓐ `list` 없음 ⓑ (a) `onOpenRoom`·`onAutoOpenSettled` 미호출, `console.error` 0회 (b) `ld:lastRoomId='gone'` 유지(판정 자체를 하지 않음) ⓒ `listRooms` 1회
- 스펙: `RoomsScreen.test.tsx`
- 참고: React 19는 언마운트 뒤 setState 경고를 내지 않는다. 그래서 관찰 지점은 콜백·저장소·`console.error`다.

### TC-RM-017 · 포커스·역할 · 종류: 자동 · 요구: R-ROOMS-005 · 설계: A 전 항목 · §8.1 `screenTitle`·`screenAriaLabel`·`rowAriaLabel` · F §1.2 `titleRef` · 토큰: 없음
- Given `listRooms` → 목록 / 또는 → `INTERNAL` 실패
- When 마운트하고 Tab을 누른다
- Then ⓐ `main "방 목록"`, h1 `ROOMS`(`tabindex=-1`)에 포커스, `ul`에 `aria-label` 없음, 행 `type=button`. Tab → `체스 대결` 행 → `티타임` 행. 오류 상태면 Tab → 「다시 시도」 ⓑ 저장소 키 0개 ⓒ `listRooms` 1회
- 스펙: `RoomsScreen.test.tsx`

### TC-RM-018 · (S2) 토큰 있음 렌더 쌍 · 종류: 자동 · 요구: R-ROOMS-002 · R-CHAT-008 · 설계: §2.2 A · §10 1·2행 · F-RM-05 · §8.1 `newRoom`·`newRoomAriaLabel` · C §1.2 · 토큰: 있음
- Given `viewer=WRITER_VIEWER`, `listRooms` → 목록 2개
- When 마운트하고 목록이 그려진 뒤 상단 바를 본다
- Then ⓐ `<header>` 안 버튼 1개 = 이름 `새 방 만들기`, 글자 `+ 새 방`. `group "새 방 만들기"`·`textbox`는 아직 없음(B 행은 누른 뒤에만). 행 버튼 2개는 그대로. TC-RM-011(토큰 없음 → 같은 버튼 `null`)과 쌍 ⓑ `WRITER_VIEWER.canWrite === true`, 저장소 키 0개 ⓒ `listRooms` 1회, `createRoom` 0회
- 스펙: `ui/src/rooms/test/NewRoom.test.tsx`

### TC-RM-019 · (S2) 입력 행 열기 · 종류: 자동 · 요구: R-ROOMS-002 · 설계: §2.2 B · §6.5 1행 · F-RM-14 · C §1.12 · C §2.4 · §8.1 `newRoomGroupAriaLabel`·`newRoomInputAriaLabel`·`newRoomPlaceholder`·`cancel`·`create` · A · 토큰: 있음
- Given TC-RM-018 화면
- When 「+ 새 방」을 클릭한다
- Then ⓐ `group "새 방 만들기"` 안에 `textbox "새 방 제목"`(placeholder `새 방 제목 입력`, 값 `''`)이 **포커스**를 가짐, 카운터 `0/60`(`aria-hidden="true"`), `만들기` disabled, `취소` enabled. B 행이 목록(`list`)보다 DOM 앞 ⓑ 입력값 `''`, 저장소 키 0개 ⓒ `createRoom` 0회, `listRooms` 1회
- 스펙: `NewRoom.test.tsx`

### TC-RM-020 · (S2) 제목 경계 · 종류: 자동 · 요구: R-ROOMS-002 · R-ROOM-002 · 설계: C §1.11 `countChars`·`isRoomTitleValid` · C §1.12 카운터·`over`·`aria-invalid` · C §2.4 3번 · F-RM-16·23 · 토큰: 있음
- Given 입력 행이 열려 있다
- When 값을 차례로 `'   '` → `'😀'×30 + 'a'×30`(코드 포인트 60, UTF-16 90) → 같은 값 + `'b'`(61) → `'  ab  '`로 바꾼다
- Then ⓐ `'   '` → 카운터 `0/60`, `만들기` disabled · 60 → `60/60`, enabled, 입력 `aria-invalid`≠`true` · 61 → `61/60` 카운터에 `over` 클래스, 입력 `aria-invalid="true"`, `만들기` disabled, 입력값은 잘리지 않음(61자 그대로) · `'  ab  '` → `2/60`, enabled ⓑ 입력값 = 넣은 값 그대로(F-RM-16 잘라 내지 않음) ⓒ `createRoom` 0회
- 스펙: `NewRoom.test.tsx`

### TC-RM-021 · (S2) 생성 성공 · 종류: 자동 · 요구: R-ROOMS-002 · R-ROOM-002 · R-ROOMS-004 · 설계: §6.5 201 행 · F-RM-02·17 · §7 `createRoom` · §11.2 D-3 · 토큰: 있음
- Given (a) 화면 단위: 입력 `'  안개 낀 런던  '`, `createRoom` → `ok(안개 낀 런던 r9)` (b) App 통합: `initToken('?t=test-token')`, `listMessages('r9')` → 빈 페이지
- When `만들기`를 클릭한다
- Then ⓐ (a) RoomsScreen은 전환하지 않는다(App 몫) (b) chat `main "대화: 안개 낀 런던"`, h1 `안개 낀 런던`(응답 title), 하단 바 `group "메시지 작성"` 있음 ⓑ (a) `onOpenRoom`이 응답 RoomSummary로 1회, `onAuthFailure` 0회 (b) `ld:lastRoomId='r9'` ⓒ (a) `createRoom` 1회, 인자 정확히 `[{ title: '  안개 낀 런던  ' }]`(원문 그대로, trim 없음·여분 키 없음), `listRooms` 1회 유지(재요청·끼워 넣기 없음) (b) `listMessages` 1회 `['r9']`
- 스펙: `NewRoom.test.tsx`(a) · `ui/src/rooms/test/AppWrite.test.tsx`(b)

### TC-RM-022 · (S2) 중복 제출 · 종류: 자동 · 요구: R-ROOMS-002 · 설계: F-RM-17 `submitInFlightRef`·`isSubmitting` · C §2.4 · §6.5 마지막 줄 · 토큰: 있음
- Given 유효 제목 입력, `createRoom` 대기(deferred)
- When (a) `만들기` 클릭 → 대기 중 `만들기` 클릭·Enter 2회 (b) 리렌더 전 같은 `act` 안에서 `fireEvent.click(만들기)` 2회
- Then ⓐ 대기 중 입력 `readOnly`, `취소`·`만들기` disabled(Enter 연타는 입력에 포커스를 둔 채 누른다) → resolve(실패 `INTERNAL`) 뒤 `readOnly` 해제·`취소` enabled ⓑ `isSubmitting` true → false(위 표시로 관찰) ⓒ (a)(b) `createRoom` 1회
- 스펙: `NewRoom.test.tsx`

### TC-RM-023 · (S2) 생성 실패(비인증) · 종류: 자동 · 요구: R-CHAT-011 · R-ROOMS-002 · 설계: §6.5 실패 행 · F-RM-18·22 · §8.3 · C §1.18 · A 토스트 · 토큰: 있음
- Given 입력 `'안개 낀 런던'`, `createRoom` 대기 → 실패. 코드: `INTERNAL` · `RATE_LIMITED`+`retryAfterSec: 40` · `RATE_LIMITED`(값 없음) · `NETWORK` · `VALIDATION_ERROR`
- When `만들기` → (가짜 시계 설치) → 실패 resolve → 1999ms → 1ms → 같은 입력으로 다시 `만들기`(2회째 응답 `ok(안개 낀 런던 r9)`)
- Then ⓐ `role=alert` 문구·톤: `ERROR_MESSAGES.INTERNAL`(danger) · `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.`(warning) · `ERROR_MESSAGES.RATE_LIMITED`(warning) · `서버에 연결할 수 없습니다.`(danger) · `방 제목은 1~60자로 입력해 주세요.`(danger). `SERVER-RAW-MESSAGE` 없음. B 행·입력값 `'안개 낀 런던'` 유지, 「+ 새 방」 유지, `만들기` enabled. 1999ms에 alert 있음 → 2000ms에 없음 ⓑ 실패 시점: `onAuthFailure` 0회, `onOpenRoom` 0회, 저장소 키 0개 → 재제출 성공 뒤: `onOpenRoom` 1회(응답 RoomSummary), `onAuthFailure` 0회 유지 ⓒ 실패 시점 `createRoom` 1회 `[{ title: '안개 낀 런던' }]` → 재제출 뒤 총 2회, 2회째 인자도 `[{ title: '안개 낀 런던' }]`(실패가 다음 제출을 막지 않음)
- 스펙: `NewRoom.test.tsx`

### TC-RM-024 · (S2) 인증 실패 전환 · 종류: 자동 · 요구: R-CHAT-011 · R-CHAT-009 · R-CHAT-008 · 설계: §6.5 isAuthFailure 행 · F-RM-12·18·19 · §8.3 인증 3행 · §10 전환 · 토큰: 있음 → 없음
- Given (a) 화면 단위: `createRoom` → `LEVEL_TOO_LOW` · `TOKEN_INVALID` · `TOKEN_REQUIRED` 각각 (b) App 통합: `initToken('?t=test-token')`, `createRoom` → `LEVEL_TOO_LOW`
- When `만들기` → 실패 도착 → (a) `rerender(viewer=READ_ONLY_VIEWER)`(App 흉내)
- Then ⓐ 토스트 `role=alert`(warning): `대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.` · `인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.` · `로그인 정보가 없어 열람 전용으로 바뀌었습니다.` 전환 뒤 `button "새 방 만들기"`·`group`·`textbox` DOM 없음, h1 `ROOMS`에 포커스, 목록 행은 그대로 ⓑ (a) `onAuthFailure` 1회, 토스트 표시보다 먼저 불림(F-RM-18 순서는 alert 존재 시점에 이미 1회로 관찰) (b) `getToken() === null`, 저장소 값에 `test-token` 없음 ⓒ `createRoom` 1회. (b) 전환 뒤 `listRooms` 1회 유지(재요청 없음)
- 스펙: `NewRoom.test.tsx`(a) · `AppWrite.test.tsx`(b)

### TC-RM-025 · (S2) 취소·Esc · 종류: 자동 · 요구: R-ROOMS-002 · 설계: F-RM-15 · §6.5 마지막 줄 · C §1.12 `onEscape` · A Esc · 토큰: 있음
- Given 입력 행에 `'임시'`를 입력했다
- When (a) `취소` 클릭 → 「+ 새 방」 다시 클릭 (b) 입력에서 Esc (c) `createRoom` 대기 중 Esc
- Then ⓐ (a)(b) B 행 없음, 「+ 새 방」에 포커스 → 다시 열면 입력값 `''`·카운터 `0/60` (c) B 행 유지, 입력값 유지 ⓑ (a)(b) `create` 초기값(관찰: 빈 입력) (c) 무시 ⓒ (a)(b) `createRoom` 0회 (c) 1회
- 스펙: `NewRoom.test.tsx`

### TC-RM-026 · (S2) Enter 제출·IME · 종류: 자동 · 요구: R-ROOMS-002 · 설계: C §1.12 IME 판정 · C §2.4 `onEnter` · F-RM-17 가드 · A 키보드 · 토큰: 있음
- Given 입력 행이 열려 있다
- When (a) `'안개 낀 런던'` 입력 후 `keyDown Enter` + `isComposing: true` (b) 같은 값에서 `keyDown Enter` + `keyCode: 229` (c) `'   '`에서 Enter (d) `'안개 낀 런던'`에서 Enter
- Then ⓐ (a)(b)(c) B 행 그대로, 입력값 그대로 (d) 대기 표시(`readOnly`) ⓑ `onOpenRoom` 0회(응답 전) ⓒ (a)(b)(c) `createRoom` 0회 (d) 1회 `[{ title: '안개 낀 런던' }]`
- 스펙: `NewRoom.test.tsx`

### TC-RM-027 · (S2) App 토큰 흐름 · 종류: 자동 · 요구: R-ROOMS-002 · R-CHAT-008 · R-CHAT-009 · R-NFR-004 · 설계: F §1.1 `viewer` 초기값 · F-RM-01·21 · C §1.8·§1.10 · §6.1 · 토큰: 있음 / 없음
- Given (a) `initToken('?t=test-token')` (b) `initToken('')` (c) `initToken('?t=%20%20')`
- When `<App />`을 렌더하고 목록이 그려진다
- Then ⓐ (a) `button "새 방 만들기"` 있음 (b)(c) 없음, 행은 같음 ⓑ (a) `getToken() === 'test-token'`, 저장소 키 0개·`sessionStorage` 0개·`document.cookie` 변화 없음 (b)(c) `getToken() === null` ⓒ (a)(b)(c) `listRooms` 1회 인자 없음, 쓰기 래퍼 0회
- 스펙: `AppWrite.test.tsx`

### TC-RM-028 · (S2) token.ts · 종류: 자동 · 요구: R-CHAT-009 · R-NFR-004 · R-API-003 · 설계: C §1.10 · F-RM-20 · 토큰: 무관
- Given `clearToken()`으로 비운 슬롯, 비운 `localStorage`·`sessionStorage`
- When `readTokenFromSearch`·`initToken`·`getToken`·`clearToken`을 부른다
- Then ⓐ 해당 없음(순수·메모리) ⓑ `readTokenFromSearch`: `'?t=abc'`→`'abc'` · `'?t=%20abc%20'`→`'abc'` · `'?t='`·`'?t=%20'`·`''`·`'?x=1'`→`null` · `'?t=a%2Bb'`→`'a+b'` · `'?x=1&t=abc'`→`'abc'`. `initToken('?t=abc')` → `getToken()==='abc'` → `clearToken()` → `null`. 호출 전후 `localStorage.length`·`sessionStorage.length` 0, `document.cookie` 같음, `window`에 토큰 값을 가진 새 속성 없음 ⓒ api 호출 없음(모듈이 api를 import하지 않음 — 리뷰 MC-RM-07)
- 스펙: `ui/src/state/token.test.ts`

### TC-RM-029 · (S2) viewer·limits·tone · 종류: 자동 · 요구: R-ROOMS-002 · R-CHAT-008 · R-CHAT-011 · R-ROOM-002 · R-MSG-002 · 설계: C §1.8 · C §1.11 · F-RM-21·22·23 · 토큰: 무관
- Given 순수 함수
- When 경계값을 넣는다
- Then ⓐ 해당 없음 ⓑ `viewerFromToken(null)`=`READ_ONLY_VIEWER`(같은 참조), `('x')`=`WRITER_VIEWER`, 두 객체 `Object.isFrozen`. `ROOM_TITLE_MAX_CHARS=60`·`MESSAGE_TEXT_MAX_CHARS=2000`. `countChars('  a😀b ')=3`·`('')=0`. `isRoomTitleValid` 0자·공백만 false · 1·60 true · 61 false(이모지 60개 true). `isMessageTextValid` 0 false · 1·2000 true · 2001 false. `toastToneOf`: `TOKEN_REQUIRED`·`TOKEN_INVALID`·`LEVEL_TOO_LOW`·`RATE_LIMITED`·(v1.5.1 S3b, F-RM-22) `LLM_BUDGET_EXCEEDED` → `warning`, `LLM_FAILED`·`SPEAK_IN_PROGRESS`·`INTERNAL`·`NETWORK`·`NOT_FOUND`·`VALIDATION_ERROR` → `danger`(톤 함수 순수 테스트는 이 TC 한 곳 — chat TC-CH-097이 근거로 인용) ⓒ api 호출 없음
- 스펙: `ui/src/state/writeRules.test.ts`

### TC-RM-030 · (S2) 토큰 비노출(리뷰) · 종류: 수동 · 요구: R-CHAT-009 · R-NFR-004 · R-API-003 · 설계: C §1.7 · C §1.10 · §10 마지막 줄 · 토큰: 무관
- Given `ui/src` 소스(테스트 파일 제외)
- When grep: `localStorage`·`sessionStorage`·`document.cookie` · `?t=`·`'t='` · `console.` · `initToken`·`configureClient`
- Then ⓐ 해당 없음(코드 리뷰) ⓑ 저장소 접근은 `storage.ts`뿐이고 토큰 값을 쓰지 않음. `initToken`·`configureClient` 호출은 `main.tsx`뿐. `console.`로 토큰 출력 0건 ⓒ `?t=`를 API 경로에 붙이는 코드 0건 — 수동 확인표 `MC-RM-07`
- 스펙: `ui/src/rooms/test/manual-checklist.md`

### TC-RM-031 · (S2) 쓰기 판 스크린샷 · 종류: 수동 · 요구: R-ROOMS-005 · R-ROOMS-002 · 설계: §2.2 · §2.3 · C §3 S2 행 · C §1.20 · 토큰: 있음
- Given 개발 서버, 390×565, `?t=` 유효 토큰(등급 통과)으로 연 주소
- When 「+ 새 방」 닫힘·열림·61자 초과·생성 실패 토스트 상태를 스크린샷으로 남긴다
- Then ⓐ 가로 스크롤 없음, A 44 · B 52 · 목록 469(열림)/521(닫힘), 토스트 줄 28 이상, 카운터 danger 색 ⓑ 해당 없음 ⓒ 해당 없음 — 수동 확인표 `MC-RM-08`·`MC-RM-09`
- 스펙: `manual-checklist.md`

### TC-RM-032 · (S2) 공용 TextInput·Toast·useToast·Button ref · 종류: 자동 · 요구: R-ROOMS-002 · R-CHAT-011 · R-ROOMS-005 · 설계: C §1.2 `buttonRef` · C §1.3 `more` · C §1.12 · C §1.18 · C §1.9 무문구 · 토큰: 무관
- Given 부품 단독 렌더(문구는 props)
- When 입력·키·타이머·ref 연결
- Then ⓐ TextInput: `input type=text aria-label autoComplete=off`, `maxChars` 있으면 카운터 `n/max`(`aria-hidden`), 초과 시 `over`·`aria-invalid=true`, `maxChars` 없으면 카운터 없음, `isReadOnly` → `readOnly`. Toast: `p role=alert`, 톤 클래스. IconButton `more`: `aria-label` 이름, SVG `aria-hidden`, `isDisabled` → disabled ⓑ useToast: `showToast` → `{ id: 1, message, tone }` → 2000ms 뒤 `null` · 1000ms에 새 `showToast` → id 2, 그 시점부터 2000ms(첫 호출 기준 2000ms에 아직 있음) · `showToast` 뒤 언마운트 → 타이머 0개(`vi.getTimerCount()`). `dismissToast`는 설계 v1.5에서 삭제돼 단언하지 않는다. TextInput `isDisabled`도 v1.5에서 삭제돼 단언하지 않는다 · `TOAST_DURATION_MS=2000` ⓒ 콜백: Enter → `onEnter` 1회(`preventDefault`), `isComposing`·`keyCode 229` Enter → 0회, Esc → `onEscape` 1회, 입력 → `onChange(값)`. Button `buttonRef.current`가 그 `button` 요소, `isDisabled` → disabled·클릭 시 `onClick` 0회
- 스펙: `ui/src/components/ui/TextInput/TextInput.test.tsx` · `ui/src/components/ui/Toast/Toast.test.tsx` · `ui/src/components/ui/Button/Button.test.tsx`

## TC-FLOW

S1·S2 행. **ⓒ 호출 횟수는 단계 증분으로 읽는다**: 체인 안에서 각 Step의 ⓒ 횟수는 그 Step에서 새로 생긴 호출 수이고 앞 Step 호출에 더해진다(CF-02). 표기: `A → B`는 **순차 인계**(A의 결과 상태가 B의 Given). `분기:`는 같은 지점에서 갈라지는 **대안·독립 확인**(서로 상태를 넘기지 않는다).

### TC-FLOW-RM-01 · U-RM-01 처음 열어 방 목록 보기(읽기 전용) · Steps: TC-RM-004 → TC-RM-001 → TC-RM-017 → TC-RM-015
- 로딩 표시(→ 목록 응답) → 서버가 준 순서 그대로 제목·날짜 렌더, 재정렬 없음(→ 목록 표시, 포커스 h1) → 같은 목록의 접근성 이름·Tab 순서 → 같은 화면을 390×565로 시각 확인

### TC-FLOW-RM-02 · U-RM-02 방을 골라 대화 읽기 · Steps: TC-RM-001 → 분기: TC-RM-002 | TC-RM-003 → TC-RM-012(b)
- 목록 표시(→ 행 존재). 분기: 클릭 진입 | 키보드 진입(둘 다 `onOpenRoom(고른 RoomSummary)`, 서로 인계 없음). 이어서 App 단위로 그 방 chat이 열리고 기록 = 그 방 id

### TC-FLOW-RM-03 · U-RM-03 로딩·빈 목록·서버 불통 · Steps: TC-RM-004 → 분기: ① TC-RM-005 ② TC-RM-006(코드별 세부 문구 TC-RM-007)
- 로딩(→ 응답 대기). 분기 ① 빈 응답 → 빈 목록 ② 실패 응답 → 오류 화면 → 다시 시도 성공(→ 목록). ②의 상세 문구는 코드마다 독립 Given인 TC-RM-007이 맡는다

### TC-FLOW-RM-04 · U-RM-04 닫았다 다시 열기 · Steps: TC-RM-008 → TC-RM-012(a) · 분기: TC-RM-009 | TC-RM-014 | TC-RM-010
- 저장 id로 자동 진입(→ chat r1) → ‹ 뒤로로 기록 삭제·재마운트 시 목록(→ 저장 없음). 분기(독립 Given): 저장된 방이 사라졌으면 기록 삭제·목록 유지 | 첫 로드 실패면 진입 보류 후 재시도 성공 때 진입 | 저장 불가 브라우저에서도 목록·진입·뒤로 정상

### TC-FLOW-RM-05 · U-RM-05 쓰기 UI 부재·토큰 비저장 · Steps: 분기: TC-RM-011 | TC-RM-010(키 단언) | TC-RM-012(c)
- 독립 확인 3건: 새 방 버튼·입력 부재(버튼은 행뿐) | 저장 키가 허용 2종뿐 | `?t=`가 있어도 저장소에 토큰 없음

### TC-FLOW-RM-06 · U-RM-06 등급 통과 회원(토큰 있음) S1 기간 · Steps: TC-RM-012(c) → TC-RM-011 → TC-RM-001 · 분기: TC-RM-008 · **S1 기간 한정 — S2에서 TC-FLOW-RM-07로 대체**(CF-01. S2에서는 "initToken 미호출이면 읽기 전용" 회귀 확인으로만 남는다)
- `?t=` 주소로 열어 방 진입 후 뒤로(→ 목록, READ_ONLY_VIEWER) → 새 방 부재(→ 같은 목록) → 목록 렌더 확인. 분기(독립 Given): 저장 id가 있으면 자동 진입이 비회원과 같다

### TC-FLOW-RM-07 · U-RM-07 새 방 → 그 방 진입(토큰 있음, S2) · Steps: TC-RM-027(a) → TC-RM-018 → TC-RM-019 → TC-RM-020 → TC-RM-021(a) → TC-RM-021(b) · 분기: TC-RM-022 | TC-RM-025 | TC-RM-026 · 시각: TC-RM-031
- `?t=` 토큰으로 App 시작(→ WRITER, 「+ 새 방」 있음) → 렌더 쌍 확인(→ B 행 없음) → 「+ 새 방」(→ 빈 입력 포커스) → 제목 경계(→ 유효 제목) → 만들기(→ `createRoom` 원문 1회, `onOpenRoom(응답)`) → App에서 그 방 chat, `ld:lastRoomId='r9'`. 분기(독립 Given): 연타해도 1회 | 취소·Esc로 닫기 | Enter 제출·IME 조합 중 무시

### TC-FLOW-RM-08 · U-RM-08 생성 거절(429·서버 오류, S2) · Steps: TC-RM-019 → TC-RM-023 → TC-RM-021(a)
- 입력 행에 제목 입력(→ 유효) → 만들기가 `RATE_LIMITED`(40초)·`INTERNAL` 등으로 실패(→ 코드별 토스트 2초, 입력값·B 행 유지, 전환 없음) → 같은 입력으로 다시 만들기 성공(→ `onOpenRoom`)

### TC-FLOW-RM-09 · U-RM-09 인증 실패 → 읽기 전용 전환(S2) · Steps: TC-RM-019 → TC-RM-024(b) → TC-RM-011 · 분기: TC-RM-024(a)
- 입력 행에 제목 입력 → 만들기가 `LEVEL_TOO_LOW`(→ `onAuthFailure`→ App이 토큰 비움·READ_ONLY, 안내 토스트 1회, h1 포커스, `getToken()===null`) → 읽기 전용 판과 같은 부재 상태(「+ 새 방」·입력 없음). 분기: 인증 3코드별 문구

## 추적표

### 요구 ↔ TC

| 요구ID | TC | 비고 |
|---|---|---|
| R-ROOMS-001 🔒 | TC-RM-001 · 002 · 003 · 012 · 013 · 016 | |
| R-ROOMS-002 🔒 | TC-RM-011(부재 쪽) | 렌더 쪽은 S2 |
| R-ROOMS-003 | TC-RM-004 · 005 · 006 · 007 | 수용 기준 "TC 3종" 충족 |
| R-ROOMS-004 | TC-RM-008 · 009 · 010 · 012 · 014 · 016 | 수용 기준 "throw 모킹 TC" = 010, "뒤로 → 재마운트 시 목록 TC" = 012 |
| R-ROOMS-005 🔒 | TC-RM-015(수동) · 017 | 수용 기준 "스크린샷" = 015 |
| R-CHAT-008 🔒(새 방 부분) | TC-RM-011 | |
| R-CHAT-010(마지막 본 방) | TC-RM-008 · 010 | |
| R-ROOM-001 🔒(데이터) | TC-RM-001 | 서버 순서 유지 |
| R-NFR-004 🔒(화면 쪽) | TC-RM-010 · 012(c) | 리뷰 grep(`localStorage` 접근은 storage.ts만)은 수동 `MC-RM-06` |

### 설계 항목 ↔ TC

| 설계 항목 | TC |
|---|---|
| §2.1 S1 판 레이아웃(A 44 · C 행 56) | TC-RM-001 · 015 |
| §2.1 상태 변형·판정 순서(error → loading → data → empty) | TC-RM-004 · 005 · 006 |
| §2.2 토큰 있음 판 슬롯(미렌더) | TC-RM-011 |
| §2.3 세로·가로 배분(100% 체인·가로 스크롤 금지·말줄임·480 중앙) | TC-RM-015 |
| §3.1 App | TC-RM-012 |
| §3.1 RoomsScreen | TC-RM-001 ~ 011 · 014 · 016 · 017 |
| C §1.1 TopBar(h1 tabIndex -1 · right 미렌더) | TC-RM-011 · 017 |
| C §1.2 Button | TC-RM-006 |
| C §1.3 IconButton | (rooms S1 미사용) chat TC-CH-002 · 027 |
| C §1.4 StateView(role status/alert, 버튼 조건) | TC-RM-004 · 005 · 006 |
| C §1.5 cx | 간접: chat TC-CH-007(변형 + 캐릭터 색 클래스 동시 부여) — 직접 TC는 RTM에 없음(보고서 참조) |
| C §1.6 formatDate | TC-RM-013 · 001 |
| C §1.7 storage(키·try/catch·빈 문자열·토큰 키 없음) | TC-RM-010 · 008 · 009 · 012 |
| C §1.8 viewer(READ_ONLY_VIEWER) | TC-RM-011 · 012(c) |
| C §1.9 문구는 labels에서(공용 컴포넌트 무문구) | TC-RM-004 · 005 · 006 · 007 · 017 |
| C §2.1 ListRow(button · aria-label · time · Enter/Space) | TC-RM-001 · 002 · 003 · 017 |
| C §2.2 RoomList(ul aria-label 없음 · 받은 순서) | TC-RM-001 · 005 · 017 |
| C §3 스타일 토큰 | TC-RM-015 |
| F §1.1 App 상태(view · autoOpenRoomId · viewer) | TC-RM-012 |
| F §1.2 `load` | TC-RM-004 · 005 · 006 |
| F §1.2 `autoOpenSettledRef` | TC-RM-008 · 014 |
| F §1.2 `isActiveRef` | TC-RM-016 |
| F §1.2 `titleRef` | TC-RM-017 · 012(a) |
| F-RM-01 App | TC-RM-012 |
| F-RM-02 openRoom | TC-RM-012(a)(b) |
| F-RM-03 backToRooms | TC-RM-012(a) |
| F-RM-04 settleAutoOpen | TC-RM-012(a) · 008 |
| F-RM-05 RoomsScreen | TC-RM-001 · 004 · 017 |
| F-RM-06 loadRooms | TC-RM-004 · 006 · 014 · 016 |
| F-RM-07 retry | TC-RM-006 · 014 |
| F-RM-08 resolveAutoOpen | TC-RM-008 · 009 · 010(b) |
| F-RM-09 selectRoom | TC-RM-002 · 003 |
| F-RM-10 storage.* | TC-RM-010 |
| F-RM-11 formatDate | TC-RM-013 |
| §6.1 첫 진입 파이프라인 | TC-RM-012(b) |
| §6.2 재방문 파이프라인 | TC-RM-012(a) |
| §6.3 저장된 방 사라짐 | TC-RM-009 |
| §6.4 오류 표 5행 | TC-RM-006 · 014 · 010 · 016 |
| §7 계약 사용표(`listRooms` 인자 없음, 실패 표시) | TC-RM-001 · 006 · 007 |
| §8.1 문구 7키 | `screenTitle`·`screenAriaLabel` 017 · `rowAriaLabel` 001 · `loading` 004 · `empty` 005 · `loadError`·`retry` 006 |
| §8.2 errorDetail | TC-RM-007 |
| A 랜드마크·제목·포커스 순서·키보드·역할·상태 알림·날짜 | TC-RM-017 · 003 · 004 · 006 · 001 |
| A 포커스 링·대비·모션 없음 | TC-RM-015 |
| §10 읽기 전용 분기 | TC-RM-011 · 012(c) |
| §11.2 D-1 기록·삭제 | TC-RM-012(a) · 009 |
| §11.2 D-2 main/App 분리(App 단독 렌더) | TC-RM-012 |
| §11.2 A-2 자동 진입 보류 | TC-RM-014 |
| §12 후속(S2) · §13 공용화 후보 | 비행동 항목 — TC 대상 아님(S2 이월 · 판정 기록) |

### 사용자행 ↔ TC-FLOW

| 사용자행 | TC-FLOW | 묶음 |
|---|---|---|
| U-RM-01 | TC-FLOW-RM-01 | S1 |
| U-RM-02 | TC-FLOW-RM-02 | S1 |
| U-RM-03 | TC-FLOW-RM-03 | S1 |
| U-RM-04 | TC-FLOW-RM-04 | S1 |
| U-RM-05 | TC-FLOW-RM-05 | S1 |
| U-RM-06(토큰 있음) | TC-FLOW-RM-07(S2) · TC-FLOW-RM-06(S1 기간 한정) | S1 · S2 |
| U-RM-07(토큰 있음, 새 방) | TC-FLOW-RM-07 | S2 |
| U-RM-08(토큰 있음, 생성 거절) | TC-FLOW-RM-08 | S2 |
| U-RM-09(토큰 있음 → 전환) | TC-FLOW-RM-09 | S2 |

## 추적표 — S2 추가분 (v0.4)

위 S1 표의 "렌더 쪽은 S2"·"S2 이월" 칸은 이 절로 닫는다. Bearer 헤더 부착은 화면이 아니라 래퍼 몫이라 api 스펙(API-T-UI-011~013)이 맡고, 화면 TC는 "화면이 헤더·토큰을 만지지 않고 래퍼를 계약 인자로 부른다"를 단언한다.

### 요구 ↔ TC (S2)

| 요구ID | TC | 비고 |
|---|---|---|
| R-ROOMS-002 🔒 | TC-RM-011 · 018 · 019 · 020 · 021 · 022 · 023 · 025 · 026 · 027 · 029 · 031 · 032 | 렌더 쌍 011 ↔ 018 |
| R-ROOM-002 🔒(데이터) | TC-RM-020 · 021 · 029 | 1~60자 코드 포인트, 원문 전송 |
| R-CHAT-008 🔒(새 방 부분) | TC-RM-011 · 018 · 024 · 027 · 029 | |
| R-CHAT-009 🔒(토큰 보관) | TC-RM-024(b) · 027 · 028 · 030 | 030 수동 리뷰 |
| R-CHAT-011(생성 실패·전환) | TC-RM-023 · 024 · 029 · 032 | 429 `retryAfterSec` = 023 |
| R-ROOMS-004(새 방 진입 기록) | TC-RM-021(b) | |
| R-ROOMS-005 🔒(쓰기 판) | TC-RM-031 · 032 | |
| R-NFR-004 🔒 · R-API-003 🔒(화면 쪽) | TC-RM-027 · 028 · 030 | |
| R-MSG-002 🔒(한도 상수) | TC-RM-029 | chat 쪽 사용은 chat TC-CH-032 |

### 설계 항목 ↔ TC (S2)

| 설계 항목 | TC |
|---|---|
| §2.2 토큰 있음 판 A 「+ 새 방」 · B 52px · E' 토스트 줄(A-3) | TC-RM-018 · 019 · 023 · 031 |
| §2.3 B·E' 높이 배분 | TC-RM-031 |
| §3.1 트리 S2(NewRoomRow · Toast · useCreateRoom · useToast) | TC-RM-019 · 021 · 023 |
| §6.5 방 생성 파이프라인(열기 → 유효 → 제출 → 201/실패/전환 · 취소·Esc) | TC-RM-019 · 020 · 021 · 022 · 023 · 024 · 025 · 026 |
| §7 `createRoom` 인자·실패 표시 · `configureClient`·`isAuthFailure` | TC-RM-021 · 023 · 024 · 027 |
| §8.1 S2 문구 7키(`newRoom`·`newRoomAriaLabel`·`newRoomGroupAriaLabel`·`newRoomInputAriaLabel`·`newRoomPlaceholder`·`cancel`·`create`) | TC-RM-018 · 019 |
| §8.3 `writeErrorText` 8행 | TC-RM-023(5행) · 024(인증 3행) |
| §10 읽기 전용 분기 S2(버튼·B 미렌더, 토스트 조건, 전환) | TC-RM-011 · 018 · 024 · 027 |
| §11.2 D-3 생성 후 목록 갱신 없음 · D-4 viewer 한 곳 · A-3 토스트 줄 | TC-RM-021 · 024 · 031 |
| C §1.2 Button `buttonRef` | TC-RM-032 · 025(포커스 복귀) |
| C §1.3 IconButton `more`·`isDisabled` | TC-RM-032 · chat TC-CH-047 |
| C §1.8 viewer `WRITER_VIEWER`·`viewerFromToken`·freeze | TC-RM-018 · 029 |
| C §1.10 token.ts(읽기·보관·비우기·비저장·URL 불변) | TC-RM-028 · 027 · 030 |
| C §1.11 limits | TC-RM-020 · 029 |
| C §1.12 TextInput | TC-RM-019 · 020 · 026 · 032 |
| C §1.13~§1.17 TextArea·Toggle·BottomSheet·ConfirmDialog·PromptSheet | chat TC-CH-055 ~ 059 |
| C §1.18 Toast·useToast | TC-RM-023 · 032 |
| C §1.19 useLongPress | chat TC-CH-060 |
| C §1.20 S2 전역 토큰 | TC-RM-031 |
| C §2.4 NewRoomRow | TC-RM-019 · 020 · 022 · 025 · 026 |
| C §3 S2 스타일 행 | TC-RM-031 |
| F §1.1 `viewer` 초기값 | TC-RM-027 |
| F §1.2 `create` · `submitInFlightRef` · `toast` · `newRoomButtonRef`·`titleInputRef` | TC-RM-019 · 022 · 023 · 025 |
| F-RM-12 revokeWrite | TC-RM-024(b) · chat TC-CH-051 |
| F-RM-13 replaceRoomInView | chat TC-CH-048(App) · 064 |
| F-RM-14 openCreate | TC-RM-019 |
| F-RM-15 cancelCreate | TC-RM-025 |
| F-RM-16 changeTitle | TC-RM-020 |
| F-RM-17 submitCreate | TC-RM-021 · 022 · 026 |
| F-RM-18 handleCreateFailure | TC-RM-023 · 024 |
| F-RM-19 전환 effect | TC-RM-024 |
| F-RM-20 token.ts | TC-RM-028 |
| F-RM-21 viewerFromToken | TC-RM-027 · 029 |
| F-RM-22 toastToneOf | TC-RM-023 · 029 |
| F-RM-23 countChars·isRoomTitleValid | TC-RM-020 · 029 |
| A(S2) 「+ 새 방」 이름 · B 행 group · Enter·Esc · 전환 h1 포커스 | TC-RM-018 · 019 · 025 · 026 · 024 |
| §12 CR-C-2 · §13 공용화 후보 | 비행동 항목 — TC 대상 아님(권고·판정 기록) |

## 변경 대기열(미검증)

| Q-nn | 일자 | CR-ID | 변경 요약 | 변경 파일 | 영향 TC 후보 | 신규 TC 필요 | 상태 |
|---|---|---|---|---|---|---|---|
| Q-01 | 2026-10-05 | —(메인 세션 결정 TK-05, S1 불변 예외 승인) | S2에서 `RoomsScreen` props `onAuthFailure`가 필수가 되어 S1 스펙 렌더 도우미에 빈 콜백 `onAuthFailure={vi.fn()}`을 더함. S1 단언은 바꾸지 않음 | `ui/src/rooms/test/RoomsScreen.test.tsx`(renderRooms) | TC-RM-001~011 · 014 · 016 · 017(같은 렌더 도우미) | 없음(단언 불변) | 전환됨(TC-RM-001~017 스펙 렌더 도우미) |

### 변경이력 보충 — v0.5 (2026-10-05)

ui-test-checker S2 판정 FAIL 지적 반영: TC-RM-023 재제출 2회 단언 추가(TK-06) · TC-RM-026 (a)(b)(c) 입력값 유지 단언 보강(TK-07) · TC-RM-032 `dismissToast`·TextInput `isDisabled` 단언 삭제(TK-03·04, 설계 v1.5) · 기준 설계 v1.5 · S1 렌더 도우미 빈 콜백(Q-01, TK-05) · 공용 부품 danger 클래스 키 `danger` 확정(TK-09). 확인표 v0.2(TK-08). 근거: ui-test-checker TK-01~09 · 메인 세션 결정 TK-05·TK-09. ui-test-conflict-checker 반영: CF-01 TC-RM-012(c) Given을 "URL에만 `?t=`, `initToken` 미호출, App은 URL을 직접 읽지 않는다"로 재정의(토큰 비저장 단언 유지, `App.test.tsx` 제목 맞춤) · TC-FLOW-RM-06 "S1 기간 한정 — FLOW-RM-07로 대체", U-RM-06 행 정리 · CF-02 TC-FLOW 머리에 "ⓒ 호출 횟수는 단계 증분" 규약(FLOW-RM-08의 023 → 021(a) 연결 포함)

## 변경이력

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v0.1 | 2026-10-05 | 최초 작성(신규 모드). TC-RM-001~017, TC-FLOW-RM-01~06, 추적표 3종, 스펙 초안 4개 | 구축 S1, design.md v1.2 RTM |
| v0.2 | 2026-10-05 | TC-RM-013 ⓑⓒ를 스펙 단언(저장소 0개·api 모킹 0회)과 맞춤. TC-RM-010 콘솔 0회 단언을 함수 5종·차단 2방식으로 확장. TC-FLOW 표기 규약(순차 `→` / `분기:`) 도입, FLOW-RM-02~06 재작성. 공통 전제에 named export·Bubble 클래스 키 명시 | ui-test-checker TK-03 ~ TK-06 |
| v0.3 | 2026-10-05 | TC-RM-008 ⓐ를 "판정 시점 ready(판정 후 status·alert 없음)"로 재정의하고 "목록이 한 번 그려진다" 단언 제거. TC-RM-010 차단 케이스에 사전 값 주입·차단 상태 단언·해제 후 원값 확인 추가. FLOW-RM-01 문구를 "서버가 준 순서 그대로, 재정렬 없음"으로 | ui-test-conflict-checker CF-01(메인 세션 결정) · CF-04 · CF-06 |
| v0.4 | 2026-10-05 | **S2 증분**: S2 공통 전제(토큰 주입 = `viewer` props / App은 `initToken`·`clearToken`, 쓰기 래퍼 모킹, 가짜 시계 규칙). TC-RM-018~032 추가, TC-FLOW-RM-07~09 추가, 사용자행 U-RM-07~09 연결, 「S2 이월」 절을 「추적표 — S2 추가분」으로 대체. 스펙 신규 `NewRoom.test.tsx`·`AppWrite.test.tsx`·`ui/src/state/{token,writeRules}.test.ts`·공용 부품 3종. S1 TC-RM-001~017 변경 없음 | 구축 S2, design.md v1.4 §14.1 RTM |
| v0.4.1 | 2026-10-06 | TC-RM-029 `toastToneOf` 기대에 `LLM_BUDGET_EXCEEDED` → `warning`, `LLM_FAILED`·`SPEAK_IN_PROGRESS` → `danger` 행 추가(스펙 `writeRules.test.ts` 같은 표). rooms 화면 동작 변경 없음(방 생성은 이 코드를 받지 않는다) | rooms design v1.5.1 F-RM-22 · chat S3b TC-CH-097 |
