# rooms(방 목록) 테스트 시나리오

- 기준: `ui/src/rooms/design.md` v1.2(+ `design/components.md` · `design/functions.md` · `design/a11y.md`) / `ui/src/rooms/requirements.md` v1.1 / `doc/200_설계/contract/api.md` v0.2
- 작성일: 2026-10-05 · 작성: ui-test-designer · 모드: 신규 · 상태: **초안 v0.3(검증·모순 검사 지적 반영, 재검증 대기)**
- 묶음: **S1(저장 + 읽기 전용 화면)**. S1 화면은 토큰을 읽지 않으므로 모든 TC의 토큰 분기는 "없음"(READ_ONLY_VIEWER)이다. 토큰 있음 렌더 쌍은 S2에서 추가한다(아래 「S2 이월」).
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

### TC-RM-012 · App 흐름 · 종류: 자동 · 요구: R-ROOMS-001 · R-ROOMS-004 · R-NFR-004 · 설계: F-RM-01~04 · §6.1 · §6.2 · §11.2 D-1·D-2 · C §1.8 · 토큰: 없음 / 있음(S1은 읽지 않음)
- Given (a) `ld:lastRoomId='r1'` (b) 저장 없음 (c) URL `?t=TESTTOKEN.SIGNATURE`, 저장 없음. `listRooms`·`listMessages`는 항상 성공
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

## TC-FLOW

S1 행만 만든다. 표기: `A → B`는 **순차 인계**(A의 결과 상태가 B의 Given). `분기:`는 같은 지점에서 갈라지는 **대안·독립 확인**(서로 상태를 넘기지 않는다).

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

### TC-FLOW-RM-06 · U-RM-06 등급 통과 회원(토큰 있음) S1 기간 · Steps: TC-RM-012(c) → TC-RM-011 → TC-RM-001 · 분기: TC-RM-008
- `?t=` 주소로 열어 방 진입 후 뒤로(→ 목록, READ_ONLY_VIEWER) → 새 방 부재(→ 같은 목록) → 목록 렌더 확인. 분기(독립 Given): 저장 id가 있으면 자동 진입이 비회원과 같다

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
| U-RM-06(토큰 있음) | TC-FLOW-RM-06 | S1 |
| U-RM-07(토큰 있음, 새 방) | — S2 이월 | S2 |

## S2 이월 (S1에서 만들지 않는 TC)

| 대상 | 이유 | S2에서 만들 것 |
|---|---|---|
| 「+ 새 방」·입력 행 토큰 있음 렌더 쌍 | 설계 §12 미설계, `viewer.canWrite` 계산이 S2 | 토큰 있음 → 렌더 TC, 생성 호출 인자(`createRoom`)·토큰 헤더, 401·403·429 분기 |
| U-RM-07 TC-FLOW | 같음 | 새 방 → 생성 → 그 방 chat |

## 변경 대기열(미검증)

| Q-nn | 일자 | CR-ID | 변경 요약 | 변경 파일 | 영향 TC 후보 | 신규 TC 필요 | 상태 |
|---|---|---|---|---|---|---|---|

## 변경이력

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v0.1 | 2026-10-05 | 최초 작성(신규 모드). TC-RM-001~017, TC-FLOW-RM-01~06, 추적표 3종, 스펙 초안 4개 | 구축 S1, design.md v1.2 RTM |
| v0.2 | 2026-10-05 | TC-RM-013 ⓑⓒ를 스펙 단언(저장소 0개·api 모킹 0회)과 맞춤. TC-RM-010 콘솔 0회 단언을 함수 5종·차단 2방식으로 확장. TC-FLOW 표기 규약(순차 `→` / `분기:`) 도입, FLOW-RM-02~06 재작성. 공통 전제에 named export·Bubble 클래스 키 명시 | ui-test-checker TK-03 ~ TK-06 |
| v0.3 | 2026-10-05 | TC-RM-008 ⓐ를 "판정 시점 ready(판정 후 status·alert 없음)"로 재정의하고 "목록이 한 번 그려진다" 단언 제거. TC-RM-010 차단 케이스에 사전 값 주입·차단 상태 단언·해제 후 원값 확인 추가. FLOW-RM-01 문구를 "서버가 준 순서 그대로, 재정렬 없음"으로 | ui-test-conflict-checker CF-01(메인 세션 결정) · CF-04 · CF-06 |
