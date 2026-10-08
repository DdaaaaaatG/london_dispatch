# rooms(방 목록) 테스트 시나리오

- 기준: `ui/src/rooms/design.md` v1.5(+ `design/components.md` · `design/functions.md` · `design/a11y.md`) / `ui/src/rooms/requirements.md` v1.4 / `doc/200_설계/contract/api.md` v0.3.1 / chat 쪽 공용 인용 `ui/src/chat/design.md` v1.5
- 작성일: 2026-10-05(S3c 증분 2026-10-06 · **S6 증분 2026-10-08**) · 작성: ui-test-designer · 모드: **증분**(S1 TC-RM-001~017 · S2 TC-RM-018~032 · S3c TC-RM-033~040 보존, **S6 TC-RM-041~066 추가 · TC-RM-023·026 S6 개정**) · 상태: **v0.7.1 — S6 증분, 검증 지적 반영(재검증 대기)**. TC-RM-067 추가. S3c까지의 판정은 v0.6 그대로
- **S3c 기준(추가)**: `ui/src/rooms/design.md` v1.6.1(§2.2.1 · §7 E15 판정 행 · §8.1 `settingsAriaLabel` · §10 ⚙ 행 · §14 R-SET-009·010) · `design/functions.md` §1.1 · F-RM-24~29 · `design/pipeline.md` §6.6 · `design/components.md` §1.3 `settings` · §1.18 `success` · `design/a11y.md` S3c 포커스 순서 · `ui/src/settings/design.md` v1.2 · api.md v0.5 §2.7 · §4.15
- **S3c 공통 전제(추가)**
  - **판정 래퍼 모킹**: 토큰이 있는 App 스펙은 모두 `vi.mock('@/api/settings', () => ({ getCharacterSettings: vi.fn(), saveCharacterSettings: vi.fn() }))`를 둔다. 판정 effect(F-RM-24)가 토큰이 있으면 첫 렌더 뒤 1회 부르기 때문이다. 주인 판정이 주제가 아닌 스펙은 `beforeEach`에서 기본값 비주인 `NOT_OWNER`(`fail('OWNER_ONLY')`, `@/settings/test/fixtures`)를 준다 — 단언은 바뀌지 않는다(변경 대기열 Q-02).
  - **판정 결과 관찰**: "조용히 실패" = ⚙ DOM 없음 · 「+ 새 방」 유지 · `getToken()` 유지(revokeWrite 미호출) · `role=alert` 없음. 응답 본문은 쓰지 않으므로 픽스처 `SAVED_RESPONSE` 하나로 충분하다.
  - **RoomsScreen 새 선택 props**: `isOwner?` · `onOpenSettings?` · `entryNotice?` · `onEntryNoticeShown?`. S1·S2 화면 스펙은 넘기지 않는다(기본값 = 기존 동작).
- **S6 기준(추가, v0.7 2026-10-08)**: `ui/src/rooms/design.md` v1.8.3(§2.4 · §7 E4·E17 행 · §8.1 S6 3행 · §8.3 `VALIDATION_ERROR` 개정 · §10 S6 3행 · §14 RTM S6 행) · `design/lock.md`(§1 레이아웃 · §2 컴포넌트 · §3 상태 · F-RM-30~54 · §6.7~§6.11 · §7 계약 · §8 문구 · §10 읽기 전용 · §11 D-L1~13) · `design/tc.md` §14.2(예정 TC-RM-041~066 — 번호 그대로 확정) · `design/components.md` §1.7 S6 · §1.11 S6 · §1.12 S6 · §1.17 S6 · §1.21~§1.23 · §2.1 S6 · §2.2 S6 · §2.4 S6 · `design/a11y.md` S6 6행 · `ui/src/rooms/requirements.md` v1.7(R-ROOMS-001·002·004 S6 개정 · R-LOCK-001·003~009 · U-RM-12~19) · api.md v0.9 §4.19(E17)
- **S6 공통 전제(추가)**
  - **래퍼 모킹 확장**: `vi.mock('@/api/rooms', () => ({ listRooms, createRoom, renameRoom, deleteRoom, enterRoom, setRoomPassword, clearRoomPassword }))`(전부 `vi.fn()`). 훅(`useRoomEntry`)이 `@/api` 재노출로 import해도 같은 모듈이 모킹된다. App 흐름은 `@/api/messages`·`@/api/settings`도(Q-02 규칙). `fetch` 모킹 금지.
  - **증명 캐시 초기화**: 매 TC 전 `localStorage.clear()` → `resetRoomKeyCache()`(F-RM-37, 테스트 정리 전용). 증명을 미리 심을 때는 `localStorage.setItem('ld:roomKeys', '[["r3","e1.x"]]')`를 **렌더 전에** 한다(캐시는 첫 접근 때 1회 읽음).
  - **픽스처(S6)**: 안 잠긴 방 `체스 대결`(r2, 10.03) · `티타임`(r1, 10.05) — `locked: false`. 잠긴 방 `비밀 다과회`(r3, updatedAt **10.04** — 화면 어디에도 나오면 안 되는 감지값, `locked: true`). 화면 단위 목록 순서 `[r2, r3, r1]`(내림차순이 아님 — 재정렬 감지). 잠긴 행 이름 `비밀 다과회, 잠긴 방`. 새 방 응답 `안개 낀 런던`(r9). tc.md 요지의 `'r1'`은 "잠긴 방 id" 자리이고 이 문서에서는 `r3`이다. 증명 자리표시 `e1.x`·`e1.k`, 비밀번호 자리표시 `pw1234`·`abcd`(실값 아님).
  - **비밀번호 입력 찾기**: `type=password`는 role이 없다 → `getByLabelText('새 방 비밀번호')`·`within(dialog).getByLabelText('방 비밀번호')`. 시트 = `getByRole('dialog', { name: '비밀번호' })`, 덮개 = `dialog.parentElement`(C §1.15 overlay).
  - **인자 개수 단언**: 조용한 시도 `enterRoom(id)`는 `mock.calls[0]`이 `['r3']`이고 **길이 1**(`toHaveLength(1)`)로 본다. `toEqual`만으로는 `['r3', undefined]`를 구분하지 못한다.
  - **비동기 순서**: 조용한 시도·시트 제출은 deferred로 "요청 중" 상태를 먼저 단언 → `await act(async () => d.resolve(…))` → `waitFor`로 결과. "호출 없음" 단언 앞에는 `await act(async () => {})`. 가짜 시계는 쓰지 않는다(S6에 화면 타이머 없음, lock.md §6.8 끝).
  - **원문 미보관 관찰**: `localStorage`·`sessionStorage` 모든 키·값에 비밀번호·토큰 문자열이 없음을 훑어 본다(R-LOCK-007).
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
- Then ⓐ (b)(c) 일반 목록·진입·뒤로가 정상, `alert` 없음, 자동 진입 없음 ⓑ (a) 차단 전에 값을 넣고 차단 상태(`getItem` throw / `window.localStorage` 접근 throw)를 먼저 확인한 뒤, 값이 있어도 읽기 `null`, 쓰기·삭제 throw 없음, 차단을 풀면 원래 값 그대로(막힌 쓰기·삭제 미반영). 메서드 throw·접근 throw 두 경우에 함수 5종을 모두 불러도 `console.error`·`console.warn`·`console.log` 0회. 정상 환경 왕복(저장→읽기→삭제), 빈 문자열은 `null`. **(S6 개정 v0.7.1, C §1.7 S6)** 키 상수 `STORAGE_KEYS`는 3종 `lastRoomId`(`ld:lastRoomId`)·`scrollOffset`(`ld:scroll:{id}`)·`roomKeys`(`ld:roomKeys`, 입장 증명 — 토큰 아님)뿐이고(옛 기대 "두 키뿐" 대체), 토큰 키는 없음 유지. 이 TC의 왕복 뒤 남는 키는 `ld:lastRoomId`·`ld:scroll:{id}`뿐(증명은 저장하지 않음). chat TC-CH-025와 공유 스펙 ⓒ (b) `listRooms` 1회 (c) `listRooms` 2회, `listMessages('r1')`
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
- Then ⓐ `role=alert` 문구·톤: `ERROR_MESSAGES.INTERNAL`(danger) · `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.`(warning) · `ERROR_MESSAGES.RATE_LIMITED`(warning) · `서버에 연결할 수 없습니다.`(danger) · **(S6 개정, D-L12)** `방 제목(1~60자)과 비밀번호(4~32자)를 확인해 주세요.`(danger, 옛 `방 제목은 1~60자로 입력해 주세요.` 대체 — 같은 문구를 TC-RM-057(b)도 단언). `SERVER-RAW-MESSAGE` 없음. B 행·입력값 `'안개 낀 런던'` 유지, 「+ 새 방」 유지, `만들기` enabled. 1999ms에 alert 있음 → 2000ms에 없음 ⓑ 실패 시점: `onAuthFailure` 0회, `onOpenRoom` 0회, 저장소 키 0개 → 재제출 성공 뒤: `onOpenRoom` 1회(응답 RoomSummary), `onAuthFailure` 0회 유지 ⓒ 실패 시점 `createRoom` 1회 `[{ title: '안개 낀 런던' }]` → 재제출 뒤 총 2회, 2회째 인자도 `[{ title: '안개 낀 런던' }]`(실패가 다음 제출을 막지 않음)
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

### TC-RM-026 · (S2) Enter 제출·IME — **(S6 개정 → TC-RM-054)** · 종류: 자동 · 요구: R-ROOMS-002 · 설계: C §1.12 IME 판정 · C §2.4 `onEnter` · F-RM-17 가드 · A 키보드 · 토큰: 있음
- **S6 개정(R-ROOMS-002 S6 개정 · L D-L3 · L F-RM-53)**: (d) "유효 제목 Enter → `createRoom` 1회"는 **폐기**. 제목 Enter는 이제 비밀번호 칸으로 포커스를 옮기고 제출하지 않는다 — 새 기대는 TC-RM-054(a). (a)(b)(c)는 "제목 Enter는 제출하지 않는다"로 S6에서도 성립해 유지한다
- Given 입력 행이 열려 있다
- When (a) `'안개 낀 런던'` 입력 후 `keyDown Enter` + `isComposing: true` (b) 같은 값에서 `keyDown Enter` + `keyCode: 229` (c) `'   '`에서 Enter ~~(d) `'안개 낀 런던'`에서 Enter~~
- Then ⓐ (a)(b)(c) B 행 그대로, 입력값 그대로 ⓑ `onOpenRoom` 0회 ⓒ (a)(b)(c) `createRoom` 0회
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

### TC-RM-033 · (S3c) 주인 ⚙ 렌더 · 종류: 자동 · 요구: R-SET-009 · R-SET-010 · R-ROOMS-002 · 설계: §2.2.1 · §8.1 `settingsAriaLabel` · §10 ⚙ 행 · F §1.1 `isOwner`·`probeStartedRef` · F-RM-01·24·28 · A 포커스 순서(S3c 주인) · 토큰: 있음(주인)
- Given (a) `initToken('?t=test-token')`, `getCharacterSettings` → `ok(SAVED_RESPONSE)` (b) 같은 조건을 `<StrictMode>`로 감싼다 (c) 판정 응답을 대기(deferred)시켰다가 목록이 그려진 뒤 도착시킨다
- When `<App />`을 렌더하고 목록·판정 응답 뒤 Tab 3회
- Then ⓐ (a) `button "캐릭터 설정"` 있음, 같은 `<header>` 안에서 ⚙ → `새 방 만들기` DOM 순서, h1 `ROOMS` 포커스 유지, Tab → ⚙ → 「+ 새 방」 → `티타임` 행 (c) 응답 전 ⚙ 없음·「+ 새 방」 있음 → 응답 뒤 ⚙ 나타남, 「+ 새 방」은 같은 부모의 마지막 자식(오른쪽 끝 고정), 포커스 h1 유지 ⓑ `getToken() === 'test-token'`, 저장소 키 0개 ⓒ (a)(b) `getCharacterSettings` 정확히 1회·인자 없음, `saveCharacterSettings` 0회, `listRooms` 1회
- 스펙: `ui/src/rooms/test/OwnerGate.test.tsx`

### TC-RM-034 · (S3c) 판정 실패 = 조용히 · 종류: 자동 · 요구: R-SET-010 · R-CHAT-011 · R-ROOMS-002 · 설계: F-RM-24 · §7 E15 판정 행 · P §6.6 · §10 「+ 새 방」 행 · 토큰: 있음(비주인)
- Given `initToken('?t=test-token')`, 판정 → `OWNER_ONLY` · `TOKEN_INVALID` · `TOKEN_REQUIRED` · `LEVEL_TOO_LOW` · `NETWORK` · `INTERNAL` 각각
- When `<App />`을 렌더한다
- Then ⓐ ⚙ DOM 없음, `새 방 만들기` 있음, `role=alert` 없음 ⓑ `getToken() === 'test-token'`(revokeWrite 미호출 — canWrite 유지), 저장소 키 0개 ⓒ 판정 1회, `listRooms` 1회, 쓰기 래퍼 0회
- 스펙: `OwnerGate.test.tsx`

### TC-RM-035 · (S3c) 토큰 없음 · ⚙ 렌더 4분기 · 종류: 자동 · 요구: R-SET-009 · R-SET-010 · R-ROOMS-002 · 설계: F-RM-24 첫 줄 · F-RM-28 · F §2 끝 선택 props · §10 ⚙ 행 · 토큰: 없음 / 있음
- Given (a) `initToken('')` (b) RoomsScreen 단독: 읽기 전용 + `isOwner` true + `onOpenSettings` · 쓰기 + `isOwner` false · 쓰기 + `isOwner` true + 콜백 없음 · 쓰기 + `isOwner` true + 콜백
- When (a) `<App />` 렌더 (b) 각각 마운트
- Then ⓐ (a) ⚙·「+ 새 방」 DOM 없음 (b) 앞 셋은 ⚙ DOM 없음, 넷째만 있음 ⓑ (a) `getToken() === null` (b) `onOpenSettings` 0회 ⓒ (a)(b) `getCharacterSettings` 0회(토큰 없으면 판정 요청도 없음)
- 스펙: `OwnerGate.test.tsx`

### TC-RM-036 · (S3c) 설정 진입·복귀 · 종류: 자동 · 요구: R-SET-009 · R-SET-004 · 설계: F-RM-25·26 · P §6.6 · A 포커스(설정에서 돌아오면 h1) · settings design §11 D-ST-5 · 토큰: 있음(주인)
- Given TC-RM-033(a) 화면, 설정 열기 GET → `ok(SAVED_RESPONSE)`
- When (a) ⚙ 클릭 → 설정 ready → ‹(clean) (b) ⚙에 포커스 후 Enter
- Then ⓐ (a) `main "캐릭터 설정"`·h1 `캐릭터 설정`·`tablist "설정 묶음"` → ‹ 뒤 `main "방 목록"`, ⚙ 유지, h1 `ROOMS` 포커스 (b) `main "캐릭터 설정"` ⓑ `ld:lastRoomId` 없음(설정 화면은 방이 아니다), 주인 상태 유지 ⓒ `getCharacterSettings` 2회(판정 1 + 설정 열기 1, 복귀 때 재판정 없음), `listRooms` 2회(재마운트), 저장 0회
- 스펙: `OwnerGate.test.tsx`

### TC-RM-037 · (S3c) 주인 상실 안내 · 종류: 자동 · 요구: R-SET-010 · R-SET-001 · 설계: F-RM-26·27·29 · F §1.1 `roomsNotice` · P §6.6 · settings F-ST-05 · 토큰: 있음(주인 → 주인 아님)
- Given (a) 주인 App, 설정 열기 GET → `OWNER_ONLY` (b) RoomsScreen 단독 `entryNotice = { message: '캐릭터 설정은 갠홈 주인만 열 수 있습니다.', tone: 'warning' }` + `onEntryNoticeShown`
- When (a) ⚙ → 목록 복귀 → `티타임` 행 → chat `방 목록으로 돌아가기` (b) 마운트 → `entryNotice=null`로 리렌더 → 원래 props로 리렌더
- Then ⓐ (a) 목록에 토스트 `캐릭터 설정은 갠홈 주인만 열 수 있습니다.`(`warning`) 1개, ⚙ 없음, 「+ 새 방」 있음 → chat을 다녀온 뒤 같은 안내 없음·⚙ 없음 (b) 토스트 1개 ⓑ (a) `getToken() === 'test-token'`(읽기 전용 전환 아님) (b) `onEntryNoticeShown` 1회(리렌더로 늘지 않음) ⓒ (a) `getCharacterSettings` 2회, `listRooms` 3회
- 스펙: `OwnerGate.test.tsx`

### TC-RM-038 · (S3c) 쓰기 상실 시 ⚙ 소멸 · 종류: 자동 · 요구: R-SET-010 · R-CHAT-011 · 설계: §10 아래 첫 줄 · F-RM-12·18·28 · settings F-ST-05 · P §6.6 마지막 줄 · 토큰: 있음 → 없음
- Given 주인 App (a) 방 생성 → `TOKEN_INVALID` (b) 설정 열기 GET → `TOKEN_INVALID`
- When (a) 「+ 새 방」 → `안개 낀 런던` → 만들기 (b) ⚙
- Then ⓐ 토스트 `인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.`((b) `warning` 확인), ⚙·「+ 새 방」 모두 DOM 없음, (b) `main "방 목록"` ⓑ `getToken() === null` ⓒ (a) `createRoom` 1회, 판정 1회 (b) `getCharacterSettings` 2회
- 스펙: `OwnerGate.test.tsx`

### TC-RM-039 · (S3c) 공용 IconButton `settings` · 종류: 자동 · 요구: R-SET-009 · 설계: C §1.3 `settings` · 토큰: 무관
- Given 공용 IconButton 단독 렌더
- When `icon='settings'`(클릭 1회) → `'back'` → `'more'` + `isDisabled`로 리렌더
- Then ⓐ 이름 `캐릭터 설정`, `type=button`, 클래스 `root`(44×44), SVG `aria-hidden=true`, `circle` r = `3`·`6.5` 2개 + `path` 1개 · back `path d = M15 5l-7 7 7 7` · more 원 3개·disabled(회귀 없음) ⓑ 해당 없음(무상태) ⓒ `onClick` 1회
- 스펙: `OwnerGate.test.tsx`

### TC-RM-040 · (S3c) 주인 판 스크린샷 · 종류: 수동 · 요구: R-SET-009 · R-ROOMS-005 · 설계: §2.2.1 · F-RM-28 간격 · A 터치 · 토큰: 있음(주인)
- Given 주인 토큰 주소, 뷰포트 390×565와 폭 328
- When 방 목록을 캡처한다
- Then ⓐ ⚙ → 「+ 새 방」 한 줄, 간격 `--space-2`, ⚙ 44×44, 가로 스크롤 없음 ⓑ 해당 없음 ⓒ 해당 없음 — 수동 확인표 `ui/src/settings/test/manual-checklist.md` MC-ST-05(S3c 확인표에 묶음)
- 스펙: `ui/src/settings/test/manual-checklist.md`

## TC 목록 — S6 방 비밀번호 잠금 (v0.7, 설계 예약 번호 TC-RM-041~066 유지)

절 표기: `L` = `design/lock.md`, `C` = `design/components.md`, `A` = `design/a11y.md`. 스펙 파일: `lock.test.tsx`(화면 041~053·058) · `NewRoomLock.test.tsx`(054~057) · `useRoomEntry.test.tsx`(065 · 049(c) · 051(e) · 052(d)) · `state/roomKeys.test.ts`(059 · 055(c)) · `passwordInputs.test.tsx`(061) · `LockFlow.test.tsx`(063 · 064 · 066 · 060(a)) — 전부 `ui/src/rooms/test/` 아래.

### TC-RM-041 · (S6) 잠긴 행 표시 · 종류: 자동 · 요구: R-LOCK-003 · R-ROOMS-001(S6 개정) · 설계: §2.4 · L §1.2 · L §1.4 · C §2.1 S6 `LockGlyph` · C §2.2 S6 · L F-RM-54 · L §8.1 `lockedRowAriaLabel` · L §10 2행 · L D-L4 · A S6 잠긴 행 · L §7 끝(E18·E19 미호출) · 토큰: 없음 / 있음(같은 기대)
- Given `listRooms` → `[체스 대결 r2(10.03), 비밀 다과회 r3(locked, 10.04), 티타임 r1(10.05)]`. `viewer` = (a) `READ_ONLY_VIEWER` (b) `WRITER_VIEWER`
- When 마운트하고 목록이 그려진다
- Then ⓐ 행 버튼 이름이 받은 순서 그대로 `체스 대결, 마지막 갱신 10.03` → `비밀 다과회, 잠긴 방` → `티타임, 마지막 갱신 10.05`. 잠긴 행 안 `<svg aria-hidden="true" focusable="false">` 1개, `<time>` **0개**, 글자에 `비밀 다과회` 있고 `10.04` 없음, 화면 전체에 `10.04` 텍스트 0건. 안 잠긴 행은 `<time dateTime="2026-10-05">`가 있고 `svg` 없음 ⓑ 저장소 키 0개 ⓒ `listRooms` 1회, `enterRoom`·`createRoom`·`renameRoom`·`deleteRoom`·`setRoomPassword`·`clearRoomPassword` 0회
- 스펙: `ui/src/rooms/test/lock.test.tsx`

### TC-RM-042 · (S6) 판정 ① 안 잠긴 방 · 종류: 자동 · 요구: R-ROOMS-001 · R-LOCK-009 · 설계: L F-RM-41 ① · L F-RM-47 · L §6.7 1행 · 토큰: 없음 / 있음(같은 기대)
- Given TC-RM-041 목록, 증명 없음
- When `티타임` 행을 클릭한다
- Then ⓐ `dialog` 없음 ⓑ `onOpenRoom` 1회(인자 = `티타임` RoomSummary), `ld:roomKeys` 없음 ⓒ `enterRoom` 0회
- 스펙: `lock.test.tsx`

### TC-RM-043 · (S6) 판정 ② 저장된 증명 · 종류: 자동 · 요구: R-LOCK-004 · R-ROOMS-001 · 설계: L F-RM-34 · L F-RM-41 ② · L §6.7 2행 · 토큰: 없음 / 있음(같은 기대)
- Given 렌더 전 `ld:roomKeys` = `[["r3","e1.x"]]`, TC-RM-041 목록
- When `비밀 다과회, 잠긴 방` 행을 클릭한다
- Then ⓐ `dialog` 없음 ⓑ `onOpenRoom` 1회(인자 = `비밀 다과회`), `ld:roomKeys` 그대로 `[["r3","e1.x"]]` ⓒ `enterRoom` 0회
- 스펙: `lock.test.tsx`

### TC-RM-044 · (S6) 판정 ③ 조용한 시도 성공 · 종류: 자동 · 요구: R-LOCK-005 · R-LOCK-004 · 설계: L F-RM-41 ③ · L F-RM-42 성공 · L F-RM-35 · L §6.7 ③ 200 두 행 · L §7 E17 행(인자 1개) · L D-L9 · A S6 조용한 시도 · 토큰: 있음
- Given `WRITER_VIEWER`, 증명 없음. (a) `enterRoom` deferred → `ok({ entryKey: 'e1.x' })` (b) `ok({ entryKey: null })`
- When 잠긴 행 클릭 → (a) 대기 상태 확인 → resolve
- Then ⓐ (a) 대기 중 `role=status`·`dialog` 없음(진행 표시 없음, D-L9) → 응답 뒤에도 `dialog` 없음 (b) `dialog` 없음 ⓑ (a) `onOpenRoom` 대기 중 0회 → 응답 뒤 1회(`비밀 다과회`), `ld:roomKeys` = `[["r3","e1.x"]]` (b) `onOpenRoom` 1회, `ld:roomKeys` 없음 ⓒ `enterRoom` 1회, `mock.calls[0]` = `['r3']`, **길이 1**(비밀번호 인자 없음)
- 스펙: `lock.test.tsx`

### TC-RM-045 · (S6) 판정 ③ `ROOM_LOCKED` → 시트 · 종류: 자동 · 요구: R-LOCK-005 · R-LOCK-004 · 설계: L F-RM-42 `ROOM_LOCKED` · L §6.7 403 행 · L §2.1 트리(시트는 `<section>` 다음) · L F-RM-46 · C §1.22 · L §8.2 `title`·`submit`·`cancel` · L §7 끝(`isAuthFailure` false) · A S6 입장 시트 · 토큰: 있음
- Given `WRITER_VIEWER`, 증명 없음, `enterRoom` → `fail('ROOM_LOCKED')`
- When 잠긴 행을 클릭한다
- Then ⓐ `dialog "비밀번호"`(h2 `비밀번호`, `aria-modal="true"`)가 열리고 입력 `방 비밀번호`(값 `''`)에 **포커스**, `role=alert` 0개, `입장` disabled · `취소` enabled. 시트가 DOM에서 목록(`list`) **뒤**. `새 방 만들기` 버튼 그대로(읽기 전용 전환 없음) ⓑ `onOpenRoom` 0회, `onAuthFailure` 0회, `ld:roomKeys` 없음 ⓒ `enterRoom` 1회 `['r3']`(길이 1)
- 스펙: `lock.test.tsx`

### TC-RM-046 · (S6) 판정 ④ 읽기 전용 → 바로 시트 · 종류: 자동 · 요구: R-LOCK-006 · R-ROOMS-001(S6 개정) · 설계: L F-RM-41 ④ · L §6.7 ④ · L §10 3·4행 · §10 S6 입장 시트 행 · 토큰: 없음
- Given `READ_ONLY_VIEWER`, 증명 없음
- When 잠긴 행을 클릭한다
- Then ⓐ 클릭 직후 `dialog "비밀번호"`, 입력 포커스, alert 없음, `입장` disabled. `새 방 만들기` 없음(TC-RM-045와 토큰 쌍) ⓑ `onOpenRoom` 0회, `ld:roomKeys` 없음 ⓒ `enterRoom` **0회**(요청 없이 시트)
- 스펙: `lock.test.tsx`

### TC-RM-047 · (S6) 시트 제출 성공 · 종류: 자동 · 요구: R-LOCK-004 · R-LOCK-007 · R-LOCK-006 · 설계: L F-RM-43 성공 · L §6.8 요청 중·200 두 행 · L §3 끝(원문 미보관) · C §1.17 `isBusy` · 토큰: 없음
- Given `READ_ONLY_VIEWER`, 시트 열림. (a) `enterRoom` deferred → `ok({ entryKey: 'e1.x' })` (b) `ok({ entryKey: null })`
- When 입력 `pw1234` → `입장` 클릭 → (a) 대기 상태 확인 → resolve
- Then ⓐ (a) 대기 중 입력 `readOnly`, `입장`·`취소` disabled → 응답 뒤 `dialog` 없음 (b) `dialog` 없음 ⓑ `onOpenRoom` 1회(`비밀 다과회`). (a) `ld:roomKeys` = `[["r3","e1.x"]]` (b) `ld:roomKeys` 없음. 저장소(local·session) 어떤 값에도 `pw1234` 없음 ⓒ `enterRoom` 1회 `['r3', 'pw1234']`
- 스펙: `lock.test.tsx`

### TC-RM-048 · (S6) 비밀번호 틀림 · 종류: 자동 · 요구: R-LOCK-004 · 설계: L F-RM-43 그 밖 · L §6.8 `ROOM_PASSWORD_WRONG` 행 · L §8.2 · A S6 실패 문구 `role=alert` · 토큰: 없음
- Given `READ_ONLY_VIEWER`, 시트 열림, `enterRoom` → `fail('ROOM_PASSWORD_WRONG')`
- When 입력 `wrong1` → `입장`
- Then ⓐ 시트 안 `role=alert` = `비밀번호가 맞지 않습니다.`, `SERVER-RAW-MESSAGE` 없음, 같은 `dialog` 유지, 입력값 `wrong1` 유지·`readOnly` 해제, `입장`·`취소` enabled ⓑ `onOpenRoom` 0회, `ld:roomKeys` 없음 ⓒ `enterRoom` 1회
- 스펙: `lock.test.tsx`

### TC-RM-049 · (S6) 시트 문구 코드별 · 종류: 자동 · 요구: R-LOCK-008 · R-LOCK-004 · 설계: L F-RM-45 · L §8.2 전 행 · C §1.23 · L F-RM-42 그 밖 · L §6.8 `RATE_LIMITED`·`NETWORK` 행 · L §7 E17 코드 목록 · 토큰: 없음 (a)(c) / 있음 (b)
- Given (a) `READ_ONLY_VIEWER` 시트 제출 실패: `RATE_LIMITED`+`retryAfterSec: 42` · `RATE_LIMITED`(값 없음) · `NETWORK` · `INTERNAL` (b) `WRITER_VIEWER` 조용한 시도 실패: `NETWORK` · `INTERNAL` · `CONFIG_INVALID` · `TOKEN_INVALID`(E17은 내지 않지만 와도 시트, F-RM-42) (c) 단위: `enterErrorText`·`ROOM_ENTRY_TEXT`
- When (a) `pw1234` → `입장` (b) 잠긴 행 클릭 (c) 함수 호출
- Then ⓐ (a) 시트 안 alert = `비밀번호를 너무 자주 입력했습니다. 42초 후 다시 시도해 주세요.` · `비밀번호를 너무 자주 입력했습니다. 잠시 후 다시 시도해 주세요.` · `서버에 연결할 수 없습니다.` · `ERROR_MESSAGES.INTERNAL`. 화면 alert 1개(토스트 없음), `SERVER-RAW-MESSAGE` 없음, 입력값 유지 (b) 시트가 열리며 alert = `서버에 연결할 수 없습니다.` · `ERROR_MESSAGES.INTERNAL` · `ERROR_MESSAGES.CONFIG_INVALID` · `ERROR_MESSAGES.TOKEN_INVALID`, `새 방 만들기` 유지 (c) `ROOM_ENTRY_TEXT` = `{ title: '비밀번호', inputAriaLabel: '방 비밀번호', submit: '입장', cancel: '취소' }`, 코드별 반환이 (a) 문구·`ROOM_PASSWORD_WRONG` 문구·`ERROR_MESSAGES.CONFIG_INVALID`와 같고 서버 `message` 미포함 ⓑ (a)(b) `onAuthFailure` 0회, `onOpenRoom` 0회 ⓒ (a) `enterRoom` 1회(자동 재시도 없음) (b) `enterRoom` 1회, 길이 1
- 스펙: `lock.test.tsx`(a)(b) · `useRoomEntry.test.tsx`(c)

### TC-RM-050 · (S6) `NOT_FOUND` → 목록 다시 받기 · 종류: 자동 · 요구: R-LOCK-004 · 설계: L F-RM-42 `NOT_FOUND` · L F-RM-43 `NOT_FOUND` · L F-RM-48 · L §6.8 `NOT_FOUND` 행 · L D-L10 · A S6 목록 다시 받기 · 토큰: 없음 (a) / 있음 (b)
- Given `listRooms` 1회째 TC-RM-041 목록, 2회째 deferred → `[체스 대결, 티타임]`. (a) `READ_ONLY_VIEWER` 시트 제출 → `fail('NOT_FOUND')` (b) `WRITER_VIEWER` 조용한 시도 → `fail('NOT_FOUND')`
- When (a) `pw1234` → `입장` (b) 잠긴 행 클릭 → 2회째 `listRooms` 대기 상태 확인 → resolve
- Then ⓐ 2회째 대기 중 `role=status`(`불러오는 중`, TC-RM-004와 같은 loading 표시)·`dialog` 없음 → resolve 뒤 `dialog` 없음, 새 목록에서 `비밀 다과회, 잠긴 방` 행 없음·`티타임` 행 있음, `role=alert` 0개(토스트 없음) ⓑ `onOpenRoom` 0회 ⓒ `listRooms` 총 2회, `enterRoom` 1회
- 스펙: `lock.test.tsx`

### TC-RM-051 · (S6) 시트 닫기 · 종류: 자동 · 요구: R-LOCK-004 · R-LOCK-007 · 설계: L F-RM-44 · L §6.8 취소 행 · C §1.15 Esc·덮개·포커스 복귀 · C §1.17 `isBusy` · L §3 끝 · A S6 입장 시트 · 토큰: 없음
- Given `READ_ONLY_VIEWER`, 잠긴 행 클릭으로 시트 열림, 입력 `pw1234`. (d) `enterRoom` deferred로 제출 중 (e) 훅 단위: `submitPassword` 대기 중
- When (a) `취소` 클릭 (b) Esc (c) 덮개(`dialog.parentElement`) 클릭 → 각각 같은 행 다시 클릭 (d) 요청 중 Esc·덮개 (e) 요청 중 `cancelEntry()` → 응답(`ROOM_PASSWORD_WRONG`) 뒤 `cancelEntry()`
- Then ⓐ (a)(b)(c) `dialog` 없음, 포커스 = 탭한 행 → 다시 열면 입력값 `''` (d) 같은 `dialog` 유지, 입력값 유지 ⓑ (a)(b)(c) 저장소에 `pw1234` 없음 (e) 요청 중 `sheet` = `{ room: r3, isBusy: true, error: null }` 그대로 → 응답 뒤 `cancelEntry()`로 `sheet = null` ⓒ (a)(b)(c) `enterRoom` 0회 (d) 1회(추가 없음)
- 스펙: `lock.test.tsx`(a)~(d) · `useRoomEntry.test.tsx`(e)

### TC-RM-052 · (S6) 시트 입력 규칙 · 종류: 자동 · 요구: R-LOCK-004 · R-LOCK-007 · 설계: C §1.22 `RoomEntrySheet` 렌더(`maxChars` 64·placeholder 없음·`inputType`) · L §1.3 · L §8.2 끝 · L F-RM-39 `isEnterPasswordValid` · L F-RM-43 가드 · L D-L2 · L D-L5 · L D-L6 · C §1.12 IME · 토큰: 없음
- Given `READ_ONLY_VIEWER`, 시트 열림, `enterRoom` → `fail('ROOM_PASSWORD_WRONG')`. (d) 훅 단위
- When 값을 `''` → `'a'` → 64자 → 65자 → `' a '`로 바꾸고 IME Enter(`isComposing`·`keyCode 229`) → Enter. (d) 시트 없이 `submitPassword('pw1234')` → 시트 연 뒤 `submitPassword('')`·`submitPassword(65자)`
- Then ⓐ 입력 `type="password"`·`autocomplete="new-password"`·placeholder 속성 없음, 카운터 `0/64`. `''` → `입장` disabled · `a` → enabled · 64 → `64/64` enabled · 65 → `65/64` 카운터 `over`, `aria-invalid="true"`, disabled, 값 65자 그대로 · `' a '` → `3/64`(trim 없음) enabled ⓑ (d) `sheet` = `{ room: r3, isBusy: false, error: null }` 유지 ⓒ IME Enter 뒤 `enterRoom` 0회 → Enter 뒤 1회 `['r3', ' a ']`(원문 그대로) → 응답 반영(시트 alert `비밀번호가 맞지 않습니다.`)을 기다린 뒤 끝낸다(정리 경합 방지) (d) `enterRoom` 0회
- 스펙: `lock.test.tsx` · `useRoomEntry.test.tsx`(d)

### TC-RM-053 · (S6) 연타 · 종류: 자동 · 요구: R-LOCK-004 · 설계: L §3 `quietInFlightRef`·`submitInFlightRef` · L F-RM-41 가드 · L F-RM-43 가드 · L D-L9 · 토큰: 있음 (a) / 없음 (b)
- Given (a) `WRITER_VIEWER`, 조용한 시도 deferred (b) `READ_ONLY_VIEWER`, 시트 입력 `pw1234`, 제출 deferred
- When (a) 잠긴 행 클릭 → 대기 중 같은 행·`티타임` 행 클릭 → `ok({ entryKey: 'e1.x' })` (b) 한 `act` 안에서 `입장` 클릭 2회 → 대기 중 입력에서 Enter → `ROOM_PASSWORD_WRONG`
- Then ⓐ (a) 대기 중 `dialog` 없음 (b) 대기 중 시트 유지 ⓑ (a) 대기 중 `onOpenRoom` 0회(`티타임` 탭도 무시) → 응답 뒤 1회, 인자 = `비밀 다과회` ⓒ (a) `enterRoom` 1회 (b) 1회 `['r3', 'pw1234']`, 응답 뒤에도 1회
- 스펙: `lock.test.tsx`

### TC-RM-054 · (S6) B 2줄 · 제목 Enter → 비밀번호 (**TC-RM-026(d) 개정**) · 종류: 자동 · 요구: R-ROOMS-002(S6 개정) · R-LOCK-001 · 설계: L §1.1 · C §2.4 S6 · L §3 `passwordInputRef` · L F-RM-53 · L §8.1 `newRoomPasswordAriaLabel`·`newRoomPasswordPlaceholder` · L §10 1행 · L D-L3 · A S6 새 방 2줄 포커스·비밀번호 입력 · 토큰: 있음 (a) / 없음 (b)
- Given (a) `WRITER_VIEWER`, `createRoom` → `ok({ ...안개 낀 런던, entryKey: null })` (b) `READ_ONLY_VIEWER`
- When (a) 「+ 새 방」 → 제목 `안개 낀 런던` → 제목에서 Enter → 비밀번호 칸 IME Enter → Enter (b) 목록이 그려진다
- Then ⓐ (a) 제목 `textbox "새 방 제목"` 포커스, 비밀번호 입력(`새 방 비밀번호`) `type="password"`·placeholder `비밀번호(선택, 6자 이상 권장)`·카운터 `0/32`, 제목 카운터 `0/60`. group 안 DOM 순서 = 제목 → `취소` → 비밀번호 → `만들기`. 제목 Enter 뒤 포커스 = 비밀번호 입력, 제목 `readOnly` 아님 (b) `새 방 만들기`·group·`새 방 비밀번호` 라벨 요소·`input[type=password]` 모두 DOM 없음(토큰 쌍) ⓑ (a) 제목 Enter 뒤 `create.isSubmitting` false(관찰: readOnly 아님) ⓒ (a) 제목 Enter·IME Enter 뒤 `createRoom` 0회 → 비밀번호 Enter 뒤 1회 `[{ title: '안개 낀 런던' }]` (b) `createRoom` 0회
- 스펙: `ui/src/rooms/test/NewRoomLock.test.tsx`

### TC-RM-055 · (S6) 비밀번호 경계 · 종류: 자동 · 요구: R-LOCK-001 · R-ROOMS-002 · 설계: L F-RM-39 · L F-RM-49 · L §6.9 3 · C §1.11 S6 · C §1.12 S6 카운터 · C §2.4 S6 `만들기` 조건 · L D-L5 · L D-L2(32) · 토큰: 있음 / 무관(c)
- Given (a)(b) `WRITER_VIEWER`, B 열림, 제목 `안개 낀 런던` (c) 순수 함수
- When (a) 비밀번호를 `''` → `abc` → `abcd` → 32자 → 33자 → `' ab '` → `'😀😀😀😀'`로 바꾼다 (b) 제목을 `'   '`로 바꾼다 (c) 함수 호출
- Then ⓐ (a) `''` `0/32` enabled · `abc` `3/32` disabled·`over` 없음·`aria-invalid` 아님 · `abcd` `4/32` enabled · 32 `32/32` enabled · 33 `33/32` disabled·`over`·`aria-invalid="true"`·값 33자 그대로 · `' ab '` `4/32` enabled · 이모지 4개 `4/32` enabled (b) `만들기` disabled ⓑ (c) `countPasswordChars('')`=0·`(' ab ')`=4·이모지 4개=4 · `isRoomPasswordSettable` 0/3/4/32/33 → F/F/T/T/F · `isRoomPasswordValid` 0/3/4/32/33 → T/F/T/T/F, `' ab '`·이모지 4개 T · `isEnterPasswordValid` 0/1/64/65 → F/T/T/F ⓒ `createRoom` 0회
- 스펙: `NewRoomLock.test.tsx`(a)(b) · `ui/src/rooms/test/state/roomKeys.test.ts`(c)

### TC-RM-056 · (S6) 생성 본문·증명 · 종류: 자동 · 요구: R-LOCK-001 · R-LOCK-004 · R-LOCK-007 · R-ROOMS-002 · 설계: L F-RM-50 · L §6.9 4 · L §7 E4 행 · L D-L7 · §7 E4 행 · 토큰: 있음
- Given `WRITER_VIEWER`, 제목 `안개 낀 런던`. (a) 비밀번호 `''`, 응답 `{ ...r9(locked false), entryKey: null }` (b) 비밀번호 `abcd`, 응답 `{ ...r9(locked true), entryKey: 'e1.k' }`
- When `만들기` 클릭
- Then ⓐ (a)(b) 화면 전환은 App 몫(RoomsScreen 단위에서는 `onOpenRoom` 호출로 관찰) ⓑ (a) `onOpenRoom` 1회, 인자 = r9 RoomSummary와 같고 `entryKey` 속성 **없음**, `ld:roomKeys` 없음 (b) `onOpenRoom` 1회, 인자 = 잠긴 r9와 같고 `entryKey` 속성 없음, `ld:roomKeys` = `[["r9","e1.k"]]`, 저장소에 `abcd` 없음 ⓒ (a) `createRoom` 1회, 본문 키 = `['title']`만(`password` 키 없음), `listRooms` 1회 유지 (b) `createRoom` 1회 `[{ title: '안개 낀 런던', password: 'abcd' }]`
- 스펙: `NewRoomLock.test.tsx`

### TC-RM-057 · (S6) 새 방 취소·실패 · 종류: 자동 · 요구: R-ROOMS-002 · R-LOCK-001 · R-LOCK-007 · 설계: L F-RM-51 · L F-RM-50 실패 · L §6.9 5 · §8.3 `VALIDATION_ERROR` 개정 · L D-L12 · F-RM-12·18 · L §10 1행(전환 후) · 토큰: 있음 → 없음(c)
- Given `WRITER_VIEWER`, B에 제목 `안개 낀 런던`·비밀번호 `abcd`. (b) `createRoom` → `INTERNAL` · `VALIDATION_ERROR` (c) `createRoom` → `TOKEN_INVALID`
- When (a) `취소` 클릭 또는 비밀번호 칸에서 Esc → 「+ 새 방」 다시 클릭 (b) `만들기` (c) `만들기` → `rerender(viewer=READ_ONLY_VIEWER)`(App 흉내)
- Then ⓐ (a) B 닫힘, 포커스 「+ 새 방」 → 다시 열면 제목·비밀번호 둘 다 `''` (b) 토스트 `role=alert` = `ERROR_MESSAGES.INTERNAL` · `방 제목(1~60자)과 비밀번호(4~32자)를 확인해 주세요.`, `SERVER-RAW-MESSAGE` 없음, 제목·비밀번호 값 유지, `만들기` enabled (c) 전환 뒤 group·`새 방 비밀번호`·`input[type=password]` DOM 없음 ⓑ (b) `onOpenRoom`·`onAuthFailure` 0회 (c) `onAuthFailure` 1회. (a)(b)(c) `ld:roomKeys` 없음, 저장소에 `abcd` 없음 ⓒ (a) `createRoom` 0회 (b)(c) 1회 `[{ title: '안개 낀 런던', password: 'abcd' }]`
- 스펙: `NewRoomLock.test.tsx`

### TC-RM-058 · (S6) 자동 진입 보류 · 종류: 자동 · 요구: R-ROOMS-004(S6 개정) · R-LOCK-004 · 설계: L F-RM-52 · L §6.10 · L D-L11 · F-RM-08 · 토큰: 있음 (a) / 없음 (b) / 무관 (c)(d)
- Given TC-RM-041 목록, 렌더 전 `ld:lastRoomId`. (a)(b) = `r3`(잠김), 증명 없음, `autoOpenRoomId='r3'`, viewer (a) WRITER (b) READ_ONLY (c) = `r3` + `ld:roomKeys` `[["r3","e1.x"]]`, viewer READ_ONLY (d) = `r1`(안 잠김), viewer READ_ONLY(두 경우 모두 판정에 토큰을 쓰지 않음)
- When 마운트하고 목록 응답이 온다
- Then ⓐ (a)(b) 잠긴 행이 보이고 `dialog` 없음 (c)(d) `dialog` 없음 ⓑ (a)(b) `onAutoOpenSettled` 1회, `onOpenRoom` 0회, `ld:lastRoomId` **삭제**, `ld:roomKeys` 없음 (c) `onAutoOpenSettled` 1회 + `onOpenRoom(비밀 다과회)` 1회 (d) `onOpenRoom(티타임)` 1회(회귀) ⓒ (a)~(d) `enterRoom` 0회(토큰이 있어도 조용한 시도 안 함)
- 스펙: `lock.test.tsx`

### TC-RM-059 · (S6) roomKeys 단위 · 종류: 자동 · 요구: R-LOCK-004 · R-LOCK-007 · R-CHAT-010(S6 개정) · 설계: C §1.21 · L F-RM-30~37 · L `commit` · L §3 증명 캐시 · C §1.7 S6 원문 3함수 · L §6.11 · 토큰: 무관
- Given 매 TC `localStorage.clear()` → `resetRoomKeyCache()`. 저장소 throw는 `Storage.prototype` spy
- When 아래 (a)~(h)를 호출한다
- Then ⓐ 해당 없음(화면 없음) ⓑ (a) `parseRoomKeys`: `null`·`''`·`'not json'`·객체·숫자 → `[]` · 원소 `{x:1}`·`[1,'k']`·`['r2','']`·`['','k']`·`'str'` 제외 · **(v0.7.1, 설계 결정 2026-10-08)** 중복 id → 마지막 증명이 이기고 **맨 뒤**(`[['a','k1'],['b','k2'],['a','k3']]` → `[['b','k2'],['a','k3']]`) · 길이 2가 아닌 배열(`['r1','k1','extra']`·`['r2']`) 버림 · 60개 → 뒤쪽 50개(`r10`~`r59`), `ROOM_KEYS_MAX === 50` (b) `upsertRoomKey`: 50개 + 새 쌍 → 50개, `r0` 탈락, 새 쌍 맨 뒤, 입력(동결 배열) 불변 · 같은 방 재저장 → 기존 쌍 빼고 새 증명으로 맨 뒤 (c) `removeRoomKey`·`findRoomKey`(없으면 `null`) · `serializeRoomKeys([])` = `null`, `[['a','k1']]` → `'[["a","k1"]]'` (d) `saveRoomKey('r3','')` 무시 → `saveRoomKey('r3','e1.x')` → `ld:roomKeys` = `'[["r3","e1.x"]]'`, `getRoomKey('r3')` = `'e1.x'`, 없는 방 `null` (e) 첫 `getRoomKey` 뒤 저장소를 바꿔도 캐시 값 유지, 그 키 `getItem` 1회 → `resetRoomKeyCache()` 뒤 새 값 (f) 없는 방 `forgetRoomKey` → 마지막 쌍 삭제 → `ld:roomKeys` 키 자체 삭제 (g) `getItem` throw → `getRoomKey` `null`(throw 없음) · `setItem`·`removeItem` throw → `saveRoomKey` 뒤 같은 세션 `getRoomKey` = `'e1.x'`, `forgetRoomKey` 뒤 `null` (h) `loadRoomKeysRaw` 없음·`''` → `null`, `saveRoomKeysRaw`·`clearRoomKeysRaw` 쓰기·삭제, throw는 삼킴 ⓒ (d) 빈 증명 저장 시 `setItem` 0회 (f) 없는 방 삭제 시 `setItem`·`removeItem` 0회, 마지막 쌍 삭제 시 `removeItem('ld:roomKeys')`. api 호출 없음
- 스펙: `ui/src/rooms/test/state/roomKeys.test.ts`

### TC-RM-060 · (S6) 저장소 회귀·비노출 · 종류: 자동(a) · 수동(b 리뷰) · 요구: R-LOCK-009 · R-LOCK-007 · R-LOCK-006 · R-CHAT-010 · 설계: L §6.11 끝 · L F-RM-33·36 · L F-RM-38 · C §1.7 끝(리뷰 grep) · C §1.21 끝 · 토큰: 있음
- Given (a) `initToken('?t=test-token')` → `<App />`, 목록 `[티타임, 비밀 다과회(잠김)]` (b) 구현 뒤 소스 트리
- When (a) `티타임` 진입 → ‹ 뒤로(잠긴 방은 열지 않음) (b) 수동 확인표 MC-RM-14 절차
- Then ⓐ (a) 목록으로 돌아옴 ⓑ (a) 저장소 키가 S5 키(`ld:lastRoomId`·`ld:scroll:*`)뿐이고 `ld:roomKeys` 없음, local·session 어디에도 `test-token` 없음, `sessionStorage` 0개 (b) `localStorage` 접근은 `storage.ts`뿐 · `configureClient` 호출은 `main.tsx`뿐이고 순서 `initToken` → `configureClient({ getToken, getRoomKey })` → render · 비밀번호·증명 변수의 `console.` 출력 0건 ⓒ (a) `enterRoom` 0회
- 스펙: `ui/src/rooms/test/LockFlow.test.tsx`(a) · `test/manual-checklist.md` MC-RM-14(b)

### TC-RM-061 · (S6) 공용 델타 TextInput·PromptSheet · 종류: 자동 · 요구: R-LOCK-001 · R-ROOMS-002 · 설계: C §1.12 S6 · C §1.17 S6 · L §2.2 1·2행 · L D-L1 · L D-L5 · L D-L6 · 토큰: 무관
- Given 공용 부품 단독 렌더(라벨은 임의 문자열 — 공용 부품은 문구를 갖지 않음)
- When (a) `TextInput type="password" value=" ab " maxChars={32}` · 같은 type 33자 (b) `type` 생략 `value=" ab " maxChars={60}` (c) `PromptSheet inputType="password" placeholder="6자 이상 권장" maxChars={32}` (d) 두 props 생략
- Then ⓐ (a) `<input type="password" autocomplete="new-password" autocapitalize="off" spellcheck="false">`, 카운터 `4/32`(trim 없음) · 33자 → `33/32` `over`·`aria-invalid="true"` (b) `type="text"`·`autocomplete="off"`, 카운터 `2/60`(trim 후, 회귀 없음) (c) 시트 안 입력 `type="password"`·`autocomplete="new-password"`·placeholder `6자 이상 권장`, 카운터 `0/32` (d) `textbox` `type="text"`, placeholder 없음, `dialog` 이름 그대로 ⓑ 해당 없음(부품 상태는 props로 관찰) ⓒ api 호출 없음
- 스펙: `ui/src/rooms/test/passwordInputs.test.tsx`

### TC-RM-062 · (S6) 스크린샷 · 종류: 수동 · 요구: R-LOCK-003 · R-ROOMS-005 · R-LOCK-001 · 설계: L §1.1~§1.4 · L §1.1 표(B 96·목록 425) · L §1.1 끝(354px 미만 잘림) · 토큰: 없음 / 있음
- Given 잠긴 방이 섞인 시드, 뷰포트 390×565·328
- When 목록 자물쇠 판 · B 2줄 판 · 입장 시트 틀림 문구 판을 캡처
- Then ⓐ 잠긴 행 자물쇠 16 + 간격 8 + 제목, 날짜 없음. B 96·목록 425, 두 입력 오른쪽 끝 한 세로선. 시트 문구 1줄 약 185px. 328px에서 B2 placeholder 잘림 정도 기록 ⓑ 해당 없음 ⓒ 해당 없음 — 수동 확인표 MC-RM-10
- 스펙: `test/manual-checklist.md` MC-RM-10

### TC-RM-063 · (S6) App 흐름 읽기 전용 잠긴 방 · 종류: 자동 · 요구: R-LOCK-004 · R-LOCK-006 · R-ROOMS-001 · R-LOCK-007 · 설계: L §6.7 ④ · L §6.8 · L F-RM-34(getter) · L F-RM-38 · F-RM-02·03 · 토큰: 없음
- Given `initToken('')` → `<App />`, 목록 `[티타임, 비밀 다과회(잠김)]`, `enterRoom` → `ok({ entryKey: 'e1.x' })`, `listMessages` → 빈 페이지
- When 잠긴 행 탭 → 시트에 `pw1234` → `입장` → chat → ‹ 뒤로 → 같은 행 탭
- Then ⓐ 첫 진입 `main "대화: 비밀 다과회"` → 뒤로 뒤 `main "방 목록"` → 두 번째 탭에서 `dialog` 없이 다시 `main "대화: 비밀 다과회"` ⓑ 첫 진입 뒤 `ld:lastRoomId='r3'`, `ld:roomKeys` = `[["r3","e1.x"]]`, `getRoomKey('r3')` = `'e1.x'`(main.tsx가 래퍼에 넘기는 getter 값) → 뒤로 뒤 `ld:lastRoomId` 삭제. `getToken() === null`, 저장소에 `pw1234` 없음 ⓒ `enterRoom` 총 1회 `['r3', 'pw1234']`(두 번째 탭은 0회 추가), `listMessages` 첫 인자 `'r3'`
- 스펙: `LockFlow.test.tsx`

### TC-RM-064 · (S6) App 흐름 토큰 있음 · 종류: 자동 · 요구: R-LOCK-005 · R-LOCK-004 · 설계: L §6.7 ③ · L F-RM-42 · L §7 E17 토큰 헤더 열(헤더 자체는 api 스펙 API-T-UI-037) · 토큰: 있음
- Given `initToken('?t=test-token')` → `<App />`(주인 판정 mock 비주인 — 화면은 주인 여부를 이 흐름에 쓰지 않음, L §3 끝). (a) `enterRoom` → `ok({ entryKey: 'e1.x' })`(서버가 주인으로 판정한 경우) (b) 1회째 `ROOM_LOCKED` → 2회째 `ok({ entryKey: 'e1.x' })`
- When 잠긴 행 탭 → (b) 시트에 `pw1234` → `입장`
- Then ⓐ (a) `dialog` 없이 `main "대화: 비밀 다과회"` (b) 시트 → `main "대화: 비밀 다과회"` ⓑ `getRoomKey('r3')` = `'e1.x'`. (a) 저장소에 `test-token` 없음 (b) `getToken()` = `'test-token'`(전환 없음) ⓒ (a) `enterRoom` 호출 = `[['r3']]`, 1회째 길이 1 (b) `[['r3'], ['r3', 'pw1234']]`, 1회째 길이 1
- 스펙: `LockFlow.test.tsx`

### TC-RM-065 · (S6) `requestEntry(room, 'locked')` 훅 단위 · 종류: 자동 · 요구: R-LOCK-004 · R-LOCK-006 · 설계: L F-RM-40 · L F-RM-41(순서 확정: `'locked'`면 가드보다 먼저 `forgetRoomKey`) · L F-RM-42 · L §3 `quietInFlightRef`·`isActiveRef`·`latestRef` · C §1.22 · L §13 4행(rooms 소유) · L §6.7 끝 · 토큰: 있음 (a1)(a2)(c1)(d)(e) / 없음 (b)(c2)
- Given `renderHook(useRoomEntry, { canWrite, onEntered, onRoomGone })`. 필요 시 렌더 전 증명 심기
- When **(a1)(a2)는 각각 별도 렌더(서로 상태를 넘기지 않음)** — (a1) `ld:roomKeys`=`[["r3","e1.x"]]`, `requestEntry(r3, 'locked')` → `ROOM_LOCKED` resolve (a2) 새 렌더에서 옛 요약 `{ r1, locked: false }`로 `requestEntry(…, 'locked')` → `ok({ entryKey: 'e2.y' })` (b) 토큰 없음, 같은 증명, `requestEntry(r3, 'locked')` (c1) 증명 `[["r4","e4.z"]]`, `requestEntry(r3)` 대기 중 `requestEntry(r4, 'locked')` (c2) 토큰 없음, `requestEntry(r3)`로 시트 연 뒤 `requestEntry(r4, 'locked')` (d) `requestEntry(r3)` 대기 중 언마운트 → `ok({ entryKey: 'e1.x' })` (e) 대기 중 `rerender`로 `onEntered`를 새 함수로 바꿈 → 성공
- Then ⓐ 해당 없음(훅 단위 — 화면 쪽은 TC-RM-045·046) ⓑ (a1) 호출 직후 `getRoomKey('r3')` `null`·`ld:roomKeys` 키 삭제·`sheet` `null` → 응답 뒤 `sheet` = `{ room: r3, isBusy: false, error: null }`, `onEntered` 0회 (a2) `onEntered` 1회(그 요약), `getRoomKey('r1')` = `'e2.y'`(① 건너뜀) (b) 증명 삭제, `sheet` = `{ room: r3, isBusy: false, error: null }` (c1) `getRoomKey('r4')` `null`, `sheet` `null` 유지 → r3 응답(`ROOM_LOCKED`) 뒤 `sheet.room` = r3 (c2) `getRoomKey('r4')` `null`, `sheet` = r3 그대로 (d) `onEntered` 0회, `ld:roomKeys` 없음 (e) 옛 `onEntered` 0회, 새 함수 1회(r3) ⓒ (a1) `enterRoom` `['r3']` 길이 1 (a2) `['r1']` 길이 1 (b) 0회 (c1) 총 1회(추가 없음) (c2) 0회. 훅 호출은 `act(() => { … })` 중괄호 본문(`submitPassword`는 void 반환 — 설계 결정)
- 스펙: `ui/src/rooms/test/useRoomEntry.test.tsx`

### TC-RM-066 · (S6) App 흐름 잠긴 새 방(U-RM-15) · 종류: 자동 · 요구: R-LOCK-001 · R-LOCK-004 · R-ROOMS-002 · R-LOCK-007 · 설계: L §6.9 · L F-RM-50 · L D-L7 · L F-RM-41 ② · 토큰: 있음
- Given `initToken('?t=test-token')` → `<App />`, `listRooms` 1회째 `[티타임]`·2회째 `[안개 낀 런던(r9, 잠김), 티타임]`, `createRoom` → `ok({ ...r9 잠김, entryKey: 'e1.k' })`
- When 「+ 새 방」 → 제목 `안개 낀 런던` + 비밀번호 `abcd` → `만들기` → chat → ‹ 뒤로 → `안개 낀 런던, 잠긴 방` 행 탭
- Then ⓐ 생성 뒤 `main "대화: 안개 낀 런던"` → 목록(잠긴 행) → 탭 뒤 `dialog` 없이 `main "대화: 안개 낀 런던"` ⓑ 생성 직후 `ld:roomKeys` = `[["r9","e1.k"]]`, 저장소에 `abcd`·`test-token` 없음 ⓒ `createRoom` 1회 `[{ title: '안개 낀 런던', password: 'abcd' }]`, `enterRoom` **0회**(판정 ②)
- 스펙: `LockFlow.test.tsx`

### TC-RM-067 · (S6) 시트가 열린 채 읽기 전용 전환 · 종류: 자동 · 요구: R-LOCK-006 · R-LOCK-004 · R-ROOMS-002 · 설계: L §10 끝 줄("시트는 쓰기 UI가 아니다") · L §10 1행 · F-RM-12·19 전환 · 메인 결정 2026-10-08(전환 시 포커스는 시트 입력에 남음, h1 이동 없음) · 토큰: 있음 → 없음
- Given `WRITER_VIEWER`, 「+ 새 방」으로 B 열림(비밀번호 칸 있음), `enterRoom` 1회째 `ROOM_LOCKED` → 2회째 `ok({ entryKey: 'e1.x' })`
- When 잠긴 행 탭 → 시트 입력 포커스 확인 → `pw1234` 입력 → `rerender(viewer=READ_ONLY_VIEWER)`(App revokeWrite 흉내, TC-RM-057(c)와 같은 방식) → `입장` 클릭
- Then ⓐ 전환 뒤 같은 `dialog "비밀번호"` 유지, 입력값 `pw1234` 유지, `document.activeElement` = 시트 입력(h1 `ROOMS` 아님). `새 방 만들기`·group·`새 방 비밀번호` DOM 없음. 제출 뒤 `dialog` 없음 ⓑ `onOpenRoom` 1회(`비밀 다과회`), `ld:roomKeys` = `[["r3","e1.x"]]`, 저장소에 `pw1234` 없음 ⓒ `enterRoom` 호출 = `[['r3'], ['r3', 'pw1234']]`, 1회째 길이 1(전환이 제출을 막지 않음)
- 스펙: `lock.test.tsx`

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

### TC-FLOW-RM-10 · U-RM-10 주인 → 설정 → 복귀(S3c) · Steps: TC-RM-033(a) → TC-RM-036 → TC-RM-037(a) · 분기: TC-RM-038(b) · 설정 화면 안: settings TC-FLOW-ST-03 · ST-10
- 판정 200(→ ⚙, 포커스 h1 유지) → ⚙ 진입·‹ 복귀(→ 목록 재로드, ⚙ 유지) → 다시 진입했을 때 OWNER_ONLY(→ 안내 토스트 1회, ⚙ 없음, 「+ 새 방」 유지, 재마운트 때 반복 없음). 분기: 설정 열기 인증 실패면 읽기 전용 목록

### TC-FLOW-RM-11 · U-RM-11 등급 회원 비주인(S3c) · Steps: TC-RM-034 → TC-RM-035(b) · 분기: TC-RM-035(a)
- 판정 403·401·네트워크·5xx(→ ⚙ 없음, 「+ 새 방」·토큰 유지, 안내 없음) → 비주인 렌더 분기. 분기: 토큰이 없으면 판정 요청 자체가 없다

S6 행(v0.7). 표기 규약은 위와 같다(`→` 순차 인계, `분기:` 독립 대안, ⓒ는 단계 증분). TC-RM-063·064·066은 App 통합 TC 자체가 시작→완료 체인이라 마지막 Step으로 둔다.

### TC-FLOW-RM-12 · U-RM-12 잠긴 방이 섞인 목록(읽기 전용) · Steps: TC-RM-041(a) → TC-RM-042 · 분기: TC-RM-041(b)
- 목록 응답(→ 잠긴 행 = 자물쇠 + 제목, 날짜 DOM 없음, 안 잠긴 행 불변, 받은 순서) → 같은 목록에서 안 잠긴 행 탭은 지금처럼 바로 진입(`enterRoom` 0회). 분기: 토큰이 있어도 행 표시는 같다

### TC-FLOW-RM-13 · U-RM-13 비밀번호를 아는 잠긴 방 읽기(읽기 전용) · Steps: TC-RM-046 → TC-RM-052 → TC-RM-047(a) → TC-RM-043 → TC-RM-063
- 잠긴 행 탭(→ 요청 없이 시트, 입력 포커스) → 입력 규칙(password·0/64·trim 없음) → 제출 성공(→ 증명 저장·진입, 원문 미저장) → 그 증명이 있는 상태의 재탭 = 시트 없이 진입 → App 단위로 같은 체인(시트 → chat → ‹ 뒤로 → 재탭 무요청 진입)

### TC-FLOW-RM-14 · U-RM-14 틀림·과다 시도·연결 실패 · Steps: TC-RM-046 → TC-RM-048 → TC-RM-049(a) · 분기: TC-RM-051 | TC-RM-047(a) | TC-RM-053(b) | TC-RM-050(a)
- 시트(→ 열림) → 틀림 문구·입력 유지(→ 다시 입력 가능) → 429 초 문구·연결 실패 문구(코드마다 독립 Given). 분기: 취소·Esc·덮개로 닫기 | 맞는 비밀번호로 성공 | 연타 1회 | 방이 사라짐 → 목록 다시 받기

### TC-FLOW-RM-15 · U-RM-15 잠긴 새 방 만들기(토큰 있음) · Steps: TC-RM-054(a)(비밀번호 칸 포커스까지) → TC-RM-055 → TC-RM-056(b) → TC-RM-066 · 분기: TC-RM-056(a) | TC-RM-057 | TC-RM-054(b)
- 「+ 새 방」 2줄(→ 제목 Enter = 비밀번호 칸 포커스. Step 1은 여기까지만 인계하고, 054(a) 뒷부분의 빈 비밀번호 Enter 제출은 이 체인에 쓰지 않는다) → 비밀번호 경계(4~32, 빈칸 = 잠그지 않음) → `createRoom({ title, password })` → 증명 저장·entryKey 없는 RoomSummary로 진입 → App 단위로 생성 → chat → ‹ 뒤로 → 같은 방 재탭 무요청 진입. 분기: 빈 비밀번호(잠그지 않은 방) | 취소·실패·인증 실패 전환 | 토큰 없음이면 B·비밀번호 칸 DOM 없음

### TC-FLOW-RM-16 · U-RM-16 갠홈 주인이 잠긴 방 입장 · Steps: TC-RM-044(a) → TC-RM-064(a)
- 잠긴 행 탭(→ 조용한 `enterRoom(id)`, 서버가 주인으로 판정해 200 + 증명) → 시트 없이 진입·증명 저장 → App 단위 같은 체인. 화면은 주인 여부를 묻지 않는다(서버 판정은 서버 TC 몫)

### TC-FLOW-RM-17 · U-RM-17 등급 회원(주인 아님) 잠긴 방 입장 · Steps: TC-RM-045 → TC-RM-047(a)(시트 동작은 토큰 무관 — 047(a)는 READ_ONLY Given이지만 열린 시트의 제출·저장·진입 기대가 같아 참조) → TC-RM-064(b) · 분기: TC-RM-067(시트가 열린 채 전환) · 분기: TC-RM-049(b) | TC-RM-050(b) | TC-RM-053(a)
- 잠긴 행 탭(→ 조용한 시도 `ROOM_LOCKED` → 문구 없는 시트, 읽기 전용 전환 없음) → 비밀번호 제출 성공 → App 단위 같은 체인. 분기: 조용한 시도 실패 코드(시트 + 문구) | 방 사라짐 | 대기 중 연타 무시

### TC-FLOW-RM-18 · U-RM-18 잠긴 방을 보다 닫았고 증명이 없다 · Steps: TC-RM-058(a) · 분기: TC-RM-058(b) | TC-RM-058(c) | TC-RM-058(d) | TC-RM-065(a)
- 저장 id = 잠긴 방 + 증명 없음(→ 자동 진입 없음, 기록 삭제, 시트·요청 없음, 목록에 머묾). 분기: 토큰 없음도 같음 | 증명이 있으면 자동 진입 | 안 잠긴 방 회귀 | chat이 증명 무효(`ROOM_LOCKED`)를 받으면 훅이 증명을 지우고 다시 판정

### TC-FLOW-RM-19 · U-RM-19 잠긴 방을 쓰지 않는다 · Steps: TC-RM-060(a) → TC-RM-042 · 분기: TC-RM-059(f) | TC-RM-056(a)
- 안 잠긴 방 진입·복귀(→ 저장소 키 S5 그대로, `ld:roomKeys` 없음, 토큰 값 없음) → 안 잠긴 행 탭은 지금처럼 진입. 분기: 마지막 쌍 삭제 시 키 자체 삭제 | 비밀번호 없이 만든 새 방은 증명 저장 없음

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
| C §1.19 useLongPress | chat TC-CH-060 — **삭제됨**(S3e 후작업 2026-10-07: 공용 훅·테스트 파일 삭제, chat TC-CH-060 폐기) |
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

## 추적표 — S3c 추가분 (v0.6, CR-001)

### 요구 ↔ TC (S3c)

| 요구ID | TC | 비고 |
|---|---|---|
| R-SET-009 🔒(⚙ 진입 부분) | TC-RM-033 · 035(b) · 036 · 039 · 040 | 수용 기준 "비주인·읽기 전용 ⚙ DOM 부재" = 034 · 035 |
| R-SET-010(주인 판정) | TC-RM-033 · 034 · 035 · 037 · 038 | 수용 기준 "403·401 수신 후에도 canWrite 유지" = 034 |
| R-ROOMS-002 🔒(상단 바 공유) | TC-RM-033 · 034 · 035 | 「+ 새 방」 위치·유지 |
| R-CHAT-011(판정에는 미적용) | TC-RM-034 · 038 | |
| R-SET-001 🔒 · R-SET-004 🔒(참조) | TC-RM-037 · 036 | |
| R-ROOMS-005 🔒(주인 판) | TC-RM-040 | |

### 설계 항목 ↔ TC (S3c)

| 설계 항목 | TC |
|---|---|
| §2.2.1 주인 판 | TC-RM-033 · 040 |
| §7 E15 판정 행(본문 버림·표시 없음) | TC-RM-033 · 034 |
| §8.1 `settingsAriaLabel` | TC-RM-033 · 039 |
| §10 ⚙ 행 · 아래 첫 줄(revokeWrite 시 ⚙ 소멸) | TC-RM-033 · 034 · 035 · 038 |
| F §1.1 `view` settings · `isOwner` · `probeStartedRef` · `roomsNotice` | TC-RM-036 · 033 · 033(b) · 037 |
| F-RM-01 App 분기(settings) | TC-RM-036 |
| F-RM-24 판정 effect | TC-RM-033 · 034 · 035(a) |
| F-RM-25 openSettings · F-RM-26 leaveSettings · F-RM-27 loseOwner | TC-RM-036 · 036/037 · 037 |
| F-RM-28 ⚙ 렌더 · F-RM-29 진입 안내 effect | TC-RM-033 · 035(b) · 038 · 040 · 037 |
| F §2 끝 선택 props 4개(S1·S2 스펙 무수정) | TC-RM-035(b) · 037(b) · 기존 TC-RM-001~032 회귀 |
| P §6.6 판정·진입 파이프라인 | TC-RM-033 · 034 · 036 · 037 · 038 |
| C §1.3 IconButton `settings` | TC-RM-039 |
| C §1.18 ToastTone `success` | settings TC-ST-011 · 024 |
| A 포커스 순서(S3c 주인) · 설정 복귀 h1 | TC-RM-033 · 036 |

### 사용자행 ↔ TC-FLOW (S3c)

| 사용자행 | TC-FLOW |
|---|---|
| U-RM-10 | TC-FLOW-RM-10 |
| U-RM-11 | TC-FLOW-RM-11 |

## 추적표 — S6 추가분 (v0.7)

### 요구 ↔ TC (S6)

| 요구ID | TC | 비고 |
|---|---|---|
| R-ROOMS-001 🔒 (S6 개정: 잠긴 방 제목+자물쇠·날짜 숨김·탭 → 증명 없으면 시트) | TC-RM-041 · 042 · 043 · 046 · 063 | S1 기대는 TC-RM-001~003 유지 |
| R-ROOMS-002 🔒 (S6 개정: 비밀번호 칸) | TC-RM-054 · 055 · 056 · 057 · 061 · 066 · 023(S6 개정 문구) · 026(S6 개정) | 토큰 없음 쌍 = TC-RM-054(b) |
| R-ROOMS-004 (S6 개정: 잠긴 방 + 증명 없음 = 자동 진입 안 함) | TC-RM-058 | S1 기대는 TC-RM-008·009·014 유지 |
| R-LOCK-001 🔒 | TC-RM-054 · 055 · 056 · 057 · 061 · 066 | |
| R-LOCK-003 🔒 | TC-RM-041 · 062 | |
| R-LOCK-004 🔒 | TC-RM-043 · 044 · 045 · 047 · 048 · 049 · 050 · 051 · 052 · 053 · 056 · 058 · 059 · 063 · 064 · 065 · 066 | "변경·해제 시 무효 → 다시 묻는다"의 화면 몫 = TC-RM-065(`'locked'` 재판정) |
| R-LOCK-005 🔒 | TC-RM-044 · 045 · 064 | 서버 판정 자체는 서버 TC |
| R-LOCK-006 🔒 | TC-RM-046 · 047 · 060(b) · 063 · 065 · 067 | 헤더 부착은 api 스펙 API-T-UI-035. 067 = 시트가 열린 채 읽기 전용 전환돼도 증명 받기 유지 |
| R-LOCK-007 🔒 | TC-RM-047 · 051 · 052 · 056 · 057 · 059 · 060 · 063 · 066 | |
| R-LOCK-008 | TC-RM-049 | 화면은 429 문구만 |
| R-LOCK-009 🔒 | TC-RM-042 · 060 · 058(d) + 기존 TC 픽스처 `locked: false`(변경 대기열 Q-03) | |
| R-CHAT-010 (S6 개정 L12: 증명 저장소) | TC-RM-059 · 060 | |

### 설계 항목 ↔ TC (S6)

| 설계 항목 | TC |
|---|---|
| §2.4 S6 판 · L §1.1 B 2줄 레이아웃·높이 | TC-RM-054 · 062 |
| L §1.2 읽기 전용 판 | TC-RM-041(a) · 046 · 054(b) |
| L §1.3 입장 시트(제목 h2·password·n/64·문구 한 줄) | TC-RM-045 · 048 · 052 · 062 |
| L §1.4 ListRow 잠긴 변형(날짜 DOM 없음·이름) · C §2.1 S6 `LockGlyph` | TC-RM-041 · 062 |
| L §2.1 트리(시트 위치 `<section>` 다음) | TC-RM-045 |
| L §2.2 분류(공용 델타 · roomKeys · storage · limits · roomEntry · ListRow · NewRoomRow) | TC-RM-061 · 059 · 055(c) · 065 · 041 · 054 |
| L §3 `create.password` · `passwordInputRef` | TC-RM-054 · 055 · 057(a) |
| L §3 `sheet` | TC-RM-045 · 047 · 048 · 065 |
| L §3 `quietInFlightRef` · `submitInFlightRef` | TC-RM-053 · 065(c1) |
| L §3 `isActiveRef` · `latestRef` | TC-RM-065(d) · 065(e) |
| L §3 증명 캐시 · 원문 미보관 | TC-RM-059(e) · 047 · 056 · 063 |
| L F-RM-30 parse · F-RM-31 upsert · F-RM-32 remove/find · F-RM-33 serialize | TC-RM-059(a)(b)(c) |
| L F-RM-34 getRoomKey · F-RM-35 saveRoomKey · F-RM-36 forgetRoomKey · `commit` · F-RM-37 reset | TC-RM-059(d)(e)(f)(g) · 043 |
| L F-RM-38 main.tsx 주입 | TC-RM-060(b) · 063(getter 값) |
| L F-RM-39 limits 4함수 | TC-RM-055(c) · 052 |
| L F-RM-40 useRoomEntry | TC-RM-065 |
| L F-RM-41 requestEntry ①~④·가드·`'locked'` 순서 | TC-RM-042 · 043 · 044 · 045 · 046 · 053(a) · 065 |
| L F-RM-42 quietEnter 성공·`ROOM_LOCKED`·`NOT_FOUND`·그 밖 | TC-RM-044 · 045 · 050(b) · 049(b) |
| L F-RM-43 submitPassword 성공·`NOT_FOUND`·그 밖·가드 | TC-RM-047 · 050(a) · 048 · 049(a) · 053(b) · 052(d) |
| L F-RM-44 cancelEntry | TC-RM-051 |
| L F-RM-45 enterErrorText | TC-RM-049 |
| L F-RM-46 RoomEntrySheet · C §1.22 렌더 | TC-RM-045 · 052 |
| L F-RM-47 행 선택 → requestEntry | TC-RM-042 · 043 |
| L F-RM-48 onRoomGone = retry | TC-RM-050 |
| L F-RM-49 changePassword | TC-RM-055 |
| L F-RM-50 submitCreate(본문·증명·실패 유지) | TC-RM-056 · 057(b) |
| L F-RM-51 cancelCreate·resetCreate | TC-RM-057(a) |
| L F-RM-52 resolveAutoOpen | TC-RM-058 |
| L F-RM-53 B1 Enter · B2 Enter · Esc | TC-RM-054 · 057(a) |
| L F-RM-54 잠긴 행 매핑 · C §2.2 S6 | TC-RM-041 |
| L §6.7 판정 파이프라인 | TC-RM-042~046 |
| L §6.8 시트 제출 표 전 행 | TC-RM-047 · 048 · 049 · 050 · 051 |
| L §6.9 새 방 + 비밀번호 1~5 | TC-RM-054 · 055 · 056 · 057 |
| L §6.10 자동 진입 표 | TC-RM-058 |
| L §6.11 저장소 실패·저장소 불변 | TC-RM-059(g) · 060(a) |
| L §7 / §7 E4·E17 행 · getter 주입 행 | TC-RM-056 · 044 · 047 · 063 |
| L §8.1 `lockedRowAriaLabel` · `newRoomPasswordAriaLabel` · `newRoomPasswordPlaceholder` | TC-RM-041 · 054 |
| L §8.2 `ROOM_ENTRY_TEXT` · `enterErrorText` 전 행 | TC-RM-045 · 049 |
| §8.3 `VALIDATION_ERROR` 개정 문구 | TC-RM-057(b) · 023 |
| L §9 · A S6 6행(잠긴 행·2줄 포커스·비밀번호 입력·입장 시트·조용한 시도·목록 다시 받기) | TC-RM-041 · 054 · 055 · 045 · 051 · 044 · 050 |
| L §10 · §10 S6 3행(B2 미렌더 · 잠긴 행 토큰 무관 · 시트 토큰 무관 · 조용한 시도 토큰 있을 때만) | TC-RM-054(b) · 057(c) · 041 · 045/046 · 044/046 |
| L §10 끝 줄(시트가 열린 채 읽기 전용 전환 → 시트 유지) · 메인 결정(포커스 시트 유지) | TC-RM-067 |
| L F-RM-48 retry 중 loading 표시 | TC-RM-050(대기 중 `role=status`) · 기존 TC-RM-004 |
| C §1.15 `aria-modal` | TC-RM-045 |
| L §11 D-L1 · D-L2 · D-L3 · D-L4 · D-L5 · D-L6 · D-L7 | TC-RM-061 · 052/055 · 054 · 041 · 055/061 · 052/061 · 056 |
| L §11 D-L8 · D-L9 · D-L10 · D-L11 · D-L12 | TC-RM-065(import 경로) · 044/053 · 050 · 058 · 057 |
| L §11 D-L13 · L §13 chat 몫 | 비행동 항목 — rooms TC 대상 아님(chat 설계·TC 몫). 훅 동작은 TC-RM-065가 rooms 소유 |
| C §1.7 S6 storage 원문 3함수 | TC-RM-059(h) |
| C §1.11 S6 · C §1.12 S6 · C §1.17 S6 | TC-RM-055(c) · 061 · 061 |
| C §1.21 · C §1.22 · C §1.23 | TC-RM-059 · 065 · 049(c) |
| C §2.4 S6 NewRoomRow 2줄(props·DOM 순서·버튼 md·`만들기` 조건) | TC-RM-054 · 055 · 062 |

### 사용자행 ↔ TC-FLOW (S6)

| 사용자행 | TC-FLOW |
|---|---|
| U-RM-12 | TC-FLOW-RM-12 |
| U-RM-13 | TC-FLOW-RM-13 |
| U-RM-14 | TC-FLOW-RM-14 |
| U-RM-15 | TC-FLOW-RM-15 |
| U-RM-16 | TC-FLOW-RM-16 |
| U-RM-17 | TC-FLOW-RM-17 |
| U-RM-18 | TC-FLOW-RM-18 |
| U-RM-19 | TC-FLOW-RM-19 |

## 변경 대기열(미검증)

| Q-nn | 일자 | CR-ID | 변경 요약 | 변경 파일 | 영향 TC 후보 | 신규 TC 필요 | 상태 |
|---|---|---|---|---|---|---|---|
| Q-01 | 2026-10-05 | —(메인 세션 결정 TK-05, S1 불변 예외 승인) | S2에서 `RoomsScreen` props `onAuthFailure`가 필수가 되어 S1 스펙 렌더 도우미에 빈 콜백 `onAuthFailure={vi.fn()}`을 더함. S1 단언은 바꾸지 않음 | `ui/src/rooms/test/RoomsScreen.test.tsx`(renderRooms) | TC-RM-001~011 · 014 · 016 · 017(같은 렌더 도우미) | 없음(단언 불변) | 전환됨(TC-RM-001~017 스펙 렌더 도우미) |
| Q-02 | 2026-10-06 | CR-001(S3c) | App 주인 판정(F-RM-24)이 토큰 있을 때 `getCharacterSettings`를 1회 부른다 → 토큰 있는 App 스펙에 `vi.mock('@/api/settings')` + `beforeEach` 기본 비주인(`NOT_OWNER`) 추가. 단언은 바꾸지 않음 | `ui/src/rooms/test/AppWrite.test.tsx`(반영) · `ui/src/chat/test/AuthTransition.test.tsx`·`RoomMenu.test.tsx`·`SpeakFlow.test.tsx`(chat 소유 — 같은 mock 3줄 필요, 미반영) | TC-RM-021(b) · 024(b) · 027 · chat 쪽 App 통합 TC | 없음(단언 불변) | AppWrite 전환됨(TC-RM-021·024·027 스펙) · chat 3파일 대기 |
| Q-03 | 2026-10-08 | —(S6 구축, tc.md §14.2 끝 "기존 TC 영향") | `RoomSummary`에 `locked: boolean` 필수 추가(E3) → 기존 스펙 픽스처에 `locked: false`를 더해야 tsc가 통과한다. 래퍼 mock 팩토리에 `enterRoom`·`setRoomPassword`·`clearRoomPassword` 추가(App 통합 스펙은 chat이 import할 수 있어 필요). **ui-test-designer는 목록만 적고 고치지 않음 — ui-implementer가 구현 때 일괄**(위임문 지시). 단언은 바꾸지 않는다 | rooms: `RoomsScreen.test.tsx`(2곳) · `NewRoom.test.tsx`(3곳: ROOM_CHESS·ROOM_TEA·CREATED) · `App.test.tsx`(2곳) · `AppWrite.test.tsx`(2곳: ROOM_TEA·CREATED) · `OwnerGate.test.tsx`(1곳). chat 소유(같은 조치 필요, 미반영): `SpeakFlow`·`RoomMenu`(2)·`Regenerate`·`ChatScreen`·`Composer`·`MessageActions`·`AutoReply`·`AuthTransition`·`ChatScroll`·`MemorySheet` `.test.tsx` | TC-RM-001~040 전부(픽스처 공유) | 없음(단언 불변) | 대기 |
| Q-04 | 2026-10-08 | —(S6 검증 C5-1) | TC-RM-010 ⓑ S6 개정(`STORAGE_KEYS` 3종 `lastRoomId`·`roomKeys`·`scrollOffset`)에 맞춰 `ui/src/state/storage.test.ts` L55-59 키 단언을 바꿔야 함: 제목 `…ld:roomKeys 뿐이다(토큰 키 없음)`, `expect(STORAGE_KEYS.roomKeys).toBe('ld:roomKeys')` 추가, `Object.keys(STORAGE_KEYS).sort()` = `['lastRoomId', 'roomKeys', 'scrollOffset']`. **ui-test-designer 쓰기가 문서 가드(`validate-doc-write.py`)에 막힘**(`ui/src/state/`는 화면 `test/` 밖) — ui-implementer가 구현 때 반영 | `ui/src/state/storage.test.ts`(chat TC-CH-025 공유 스펙) | TC-RM-010 · chat TC-CH-025 | 없음 | 대기 |

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
| v0.6 | 2026-10-06 | **S3c 증분(CR-001)**: S3c 기준·공통 전제 추가, TC-RM-033~040 추가(자동 7 · 수동 1), TC-FLOW-RM-10·11, 「추적표 — S3c 추가분」, 변경 대기열 Q-02(AppWrite mock 추가, chat 3파일 대기). TC-RM-001~032 변경 없음. 스펙 신규 `OwnerGate.test.tsx`. 수동 절차는 settings 확인표 MC-ST-05·06 | rooms design v1.6.1 §14 · settings design v1.2 §14 |
| v0.7 | 2026-10-08 | **S6 증분(방 비밀번호 잠금)**: S6 기준·공통 전제 추가. TC-RM-041~066 확정(설계 예약 번호 유지 — 자동 24 · 수동 1(062) · 자동+리뷰 1(060)). TC-FLOW-RM-12~19(U-RM-12~19). 「추적표 — S6 추가분」. **기존 TC 개정 2건**: TC-RM-023 `VALIDATION_ERROR` 문구를 §8.3 개정 문구로(D-L12 — TC-RM-057(b)와 모순 방지) · TC-RM-026 (d) 폐기 → TC-RM-054(D-L3). 변경 대기열 Q-03(픽스처 `locked: false`·mock 확장 — 목록만). 스펙 신규 `lock.test.tsx` · `NewRoomLock.test.tsx` · `useRoomEntry.test.tsx` · `state/roomKeys.test.ts` · `passwordInputs.test.tsx` · `LockFlow.test.tsx`, `NewRoom.test.tsx` TC-RM-023 문구 1행·TC-RM-026 (d) 블록 삭제. 확인표 v0.3(MC-RM-10~14) | rooms design v1.8.3 §14 · lock.md · tc.md §14.2 · requirements v1.7 · 승인 ②(2026-10-08) |
| v0.7.1 | 2026-10-08 | 검증 반영(test-checker BLOCKER 1·MINOR 9, conflict-checker 확정 3·후보 2): **TC-RM-067 신설**(시트가 열린 채 읽기 전용 전환 — 시트·입력값·입력 포커스 유지, B 소멸, 제출 정상, 메인 결정). TC-RM-010 ⓑ S6 개정(`STORAGE_KEYS` 3종, 토큰 키 없음 유지 — 스펙 반영은 가드에 막혀 Q-04). TC-RM-065 (a1)(a2) 별도 렌더 명시·(a2) 길이 1·(c1)(c2) 이름 통일·`act` 중괄호(submitPassword void). TC-RM-064 길이 1. TC-RM-058 (c)(d) viewer 명시. TC-RM-041 svg 1개(스펙). TC-RM-045 `aria-modal`. TC-RM-050 다시 받는 동안 `role=status`. TC-RM-052 끝에 응답 반영 대기. TC-RM-059 parseRoomKeys 결정 2단언(중복 = 마지막·맨 뒤, 길이 2만). TC-FLOW-RM-15 Step 1 한정 · TC-FLOW-RM-17 주석·067 분기. 추적표 R-LOCK-006·L §10 끝 줄 등 4행. chat scenarios TC-CH-025에 개정 한 줄. 확인표 MC-RM-10 말줄임 폭·머리 기준 | 메인 세션 위임(검증 결과) · 설계 결정 submitPassword void · parseRoomKeys |
