# chat(대화) 테스트 시나리오

- 기준: `ui/src/chat/design.md` v1.6(CR-001 Bubble 배치, ui-designer 반영 중 — components.md §2.2 v1.6 확인)(+ `design/components.md` · `design/functions.md` · `design/a11y.md` · `design/tc.md` v1.5) / `ui/src/chat/requirements.md` v1.4 / `doc/200_설계/contract/api.md` v0.3.1 / 공용 요소 단일 정의 `ui/src/rooms/design/components.md` §1
- 작성일: 2026-10-05 · 작성: ui-test-designer · 모드: **증분**(S1 TC-CH-001~030 보존, S2 TC-CH-031~065 추가) · 상태: **초안 v0.5(S2 검증 지적 TK-01~09 반영, 재검증 대기)** · 공용 부품 danger 톤 클래스 키 = `danger` **확정**(메인 세션 결정 TK-09)
- 묶음: **S1(읽기 전용 판)** + **S2(토큰 + 쓰기)**. S1 TC의 토큰 분기는 "없음" 그대로다. S2 TC는 쓰기 UI마다 토큰 있음(TC-CH-031) ↔ 없음(TC-CH-003·021·022·023) 쌍과 전환(051·052)을 더한다. S3(캐릭터 버튼·speak·재작성)·S4(장기기억)는 「후속 이월」.
- **S2 공통 전제(추가 — S1 전제는 아래 그대로 유지)**
  - **토큰 주입 진입점 통일**: 화면 단위는 `viewer` props(`WRITER_VIEWER`·`READ_ONLY_VIEWER`)로만. App 통합은 `render(<App />)` 전에 `initToken('?t=test-token')`(`@/state/token`), `afterEach`에서 `clearToken()`. `history.replaceState`·`main.tsx`·`configureClient`는 쓰지 않는다. 화면 코드가 `getToken`을 부르지 않는 것은 리뷰 TC-CH-062.
  - **ChatScreen props(S2)**: `room · viewer · onBack · onAuthFailure · onRoomRenamed`. App의 전환을 흉내 낼 때는 스펙 안 하네스(`viewer`를 state로 들고 `onAuthFailure`가 spy 호출 + `READ_ONLY_VIEWER`로 바꿈)를 쓴다. 하네스 없이 렌더하면 부모가 전환하지 않은 상황이다(F-CH-16 멱등 확인용).
  - **래퍼 모킹**: `vi.mock('@/api/messages', () => ({ listMessages, appendUser, editMessage, deleteMessage }))` · `vi.mock('@/api/rooms', () => ({ listRooms, createRoom, renameRoom, deleteRoom }))`(전부 `vi.fn()`). `isAuthFailure`는 실물. delete 성공 = `{ ok: true, value: undefined }`. **"AI 호출 없음"(R-CHAT-006) 단언** = 모킹한 두 모듈의 모든 export 중 `appendUser`와 첫 로드 `listMessages` 1회를 뺀 호출 합계 0(S2에는 speak 래퍼가 없으므로 "모듈 전체 열거"로 판정, tc.md v1.5 DC-08).
  - **`matchMedia`**: jsdom에 없다. TextArea(C §1.13)를 그리는 스펙은 `vi.stubGlobal('matchMedia', () => ({ matches: false, … }))`, 높이 ≤ 480 판정 TC만 `matches: true`. `afterEach`에서 `vi.unstubAllGlobals()`.
  - **말풍선 메뉴 대상 요소** = `li` 안 `[aria-haspopup="dialog"]`(쓰기 가능일 때만 붙는다, C §2.2). 메뉴 대상이 없음은 같은 선택자가 `null`.
  - **롱프레스·토스트 시계**: 목록이 그려진 **뒤** `vi.useFakeTimers()` → `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` → `user.pointer(…)` → `act(() => vi.advanceTimersByTime(n))`. 토스트 2초도 실패 resolve 전에 가짜 시계를 건다. 가짜 시계 구간에서는 `findBy*`·`waitFor` 금지, `getBy*`·`queryBy*`만.
  - **대기 규칙**: S1과 같다. "호출 없음·횟수 유지" 앞에 `await act(async () => {})`.
  - **스크롤 수치 TC(038·046(c))**: S1 ChatScroll 규칙(log 요소 `clientHeight=493`, `scrollHeight`는 변수, `scrollTop` 요소별 기억·비클램프)을 그 스펙 안에서 다시 건다.
  - **픽스처(S2)**: S1 말풍선 101~104 그대로. 전송 응답 105 유저 line `안녕`(authorName `미샤`, 16:44) · OOC 응답 106 유저 ooc `체스 두기` · 수정 응답 103 text `새 본문` · 이름 변경 응답 `{ …티타임, title: '팬텀하이브 저택의 밤' }`.
- 공통 전제
  - api 래퍼는 `vi.mock('@/api/messages')`로 대체하고 `Result<T>`를 돌려준다. `fetch` 모킹 금지. `CHARACTERS`는 실제 `@shared/characters`를 쓴다.
  - 응답 순서는 deferred promise + `await findBy*`·`waitFor`로 고정한다. 타이머가 필요한 TC-CH-022만 `vi.useFakeTimers()` 구간을 둔다. 실제 sleep 없음.
  - vitest globals 미설정 → 각 스펙이 `afterEach(cleanup)`를 직접 부른다. 매 TC 전 `localStorage.clear()`.
  - 스크롤 수치 고정(ChatScroll·useAutoScroll 스펙): `role="log"` 요소의 `scrollHeight=3000`·`clientHeight=493`을 `HTMLElement.prototype` 접근자로 고정하고 `scrollTop`은 요소별로 기억한다. 맨 아래 `scrollTop=2507`. 사용자 스크롤 = `scrollTop` 대입 + `fireEvent.scroll`.
  - **스크롤 mock은 `scrollTop` 대입값을 자르지 않는다**(브라우저는 0 ~ `scrollHeight − clientHeight`로 클램프). 그래서 `scrollToBottom()` 뒤 값이 3000이다(브라우저라면 2507). 기대값은 이 mock 기준이다.
  - 판정 대기 규칙(ChatScroll 스펙): 호출이 **생기는** 판정은 `await waitFor(() => expect(…).toHaveBeenCalledTimes(n))`. 호출이 **없다·횟수 유지** 판정은 먼저 `await act(async () => {})`(스펙의 `flushPending()`)로 대기 중 마이크로태스크·effect를 비운 뒤 단언한다.
  - 방 픽스처: `티타임`(id r1, createdAt 10.05, updatedAt 10.07 — 상단 날짜가 createdAt인지 가르기 위해 다르게 둔다).
  - 말풍선 픽스처: 101 시엘 line 16:40 · 102 세바스찬 line 16:41 · 103 유저(미샤) line 16:42 · 104 유저(미샤) ooc 16:43, `hasMore=false`.
  - **구현 이름 계약(설계 문서에 아직 없음 — 이 문서가 고정, 설계 반영은 메인 세션이 ui-designer에게 요청)**
    1. 컴포넌트·훅은 **named export**다: `App`(`@/App`) · `RoomsScreen`(`@/rooms`) · `ChatScreen`(`@/chat`) · `Bubble`·`bubbleVariantOf`(`@/chat/components/Bubble`) · `MessageList`·`MessageListProps`(`@/chat/components/MessageList`) · `useAutoScroll`·`UseAutoScrollOptions`·`UseAutoScrollResult`(`@/components/hooks/useAutoScroll`).
    2. Bubble 클래스 키: 변형 `styles.character`·`styles.user`·`styles.ooc`(BubbleVariant 값과 같은 이름) + 캐릭터 색 `styles.ciel`·`styles.sebastian`(설계 명시). 테스트는 `ui/vite.config.ts`의 `classNameStrategy: 'non-scoped'`라 클래스명 = 키다.

## TC 목록

### TC-CH-001 · 상단 바 · 종류: 자동 · 요구: R-CHAT-001 · R-CHAT-013 · 설계: §2.1 A · F-CH-01 · §8.1 `screenAriaLabel`·`createdAtAriaLabel` · A 제목 · 토큰: 없음
- Given 방 `티타임`(createdAt 10.05, updatedAt 10.07), `listMessages` → 픽스처
- When ChatScreen을 마운트한다
- Then ⓐ `main "대화: 티타임"`, h1 `티타임`, `<time aria-label="방 생성일 10.05" dateTime="2026-10-05">10.05</time>`, 상단 바에 `10.07` 없음 ⓑ `ld:lastRoomId='r1'` ⓒ `listMessages` 첫 호출 인자 `['r1']`
- 스펙: `ui/src/chat/test/ChatScreen.test.tsx`

### TC-CH-002 · ‹ 뒤로 · 종류: 자동 · 요구: R-CHAT-001 · R-ROOMS-004 · 설계: F-CH-02·10 · §6.4 · §8.1 `backAriaLabel` · A 마운트 포커스 · 토큰: 없음
- Given 마운트되어 말풍선이 보인다
- When `방 목록으로 돌아가기`를 클릭한다
- Then ⓐ 마운트 직후 이 버튼에 포커스 ⓑ 클릭 전 `ld:lastRoomId='r1'` → `onBack` 실행 시점에 이미 `null`(삭제 후 호출), `onBack` 1회 ⓒ `listMessages` 1회(뒤로가 재요청하지 않음)
- 스펙: `ChatScreen.test.tsx`

### TC-CH-003 · ⋯ 부재 · 종류: 자동 · 요구: R-CHAT-001(⋯ S2) · R-CHAT-008 · 설계: §2.2 · §10 1행 · F-CH-01 · 토큰: 없음
- Given `viewer=READ_ONLY_VIEWER`, 말풍선 표시
- When 상단 바를 본다
- Then ⓐ `<header>` 안 버튼은 1개(`방 목록으로 돌아가기`)뿐, `/메뉴|더 보기|⋯/` 버튼 없음 ⓑ `READ_ONLY_VIEWER.canWrite === false` ⓒ `listMessages` 1회
- 스펙: `ChatScreen.test.tsx`

### TC-CH-004 · 첫 로드 호출 · 종류: 자동 · 요구: R-CHAT-002 · R-CHAT-003 · R-MSG-001 · 설계: F-CH-03·11 · §6.1 · §7 첫 페이지 · §8.1 `loading` · 토큰: 없음
- Given `listMessages`가 대기 중(deferred)
- When 마운트하고, 응답(픽스처 4건)이 도착한다
- Then ⓐ 대기 중 `role=status` "대화를 불러오는 중", `log` 없음 → 응답 후 `log` 안 `li` 4개가 id 순(첫 줄 `세바스찬, 홍차.`, 끝 줄 `둘이 체스를 둔다`), 로딩 문구 사라짐 ⓑ phase loading → ready(화면으로 관찰) ⓒ `listMessages` 1회, 인자 정확히 `['r1']`(두 번째 인자 없음 — `limit` 미전송)
- 스펙: `ChatScreen.test.tsx`

### TC-CH-005 · 첫 로드 오류·재시도 · 종류: 자동 · 요구: R-CHAT-003 · 설계: F-CH-04·11 · §6.4 1행 · §8.1 `loadError`·`retry` · 토큰: 없음
- Given 1회째 `NETWORK` 실패, 2회째 대기(deferred) 후 성공
- When 「다시 시도」를 누르고, 2회째 응답이 도착한다
- Then ⓐ 실패 시 `role=alert`에 `대화를 불러오지 못했습니다` + `서버에 연결할 수 없습니다.`, `log` 없음, ‹ 뒤로 버튼 존재 → 클릭 직후(응답 전) `role=status` "대화를 불러오는 중", `alert`·「다시 시도」 없음 → 응답 후 말풍선 4개, `alert` 없음 ⓑ phase error → loading → ready(위 세 화면으로 관찰) ⓒ `listMessages` 2회, 2회째 인자 `['r1']`
- 스펙: `ChatScreen.test.tsx`

### TC-CH-006 · 빈 방 · 종류: 자동 · 요구: R-CHAT-002 · R-CHAT-010 · 설계: F-CH-09·11 · §8.1 `empty` · 토큰: 없음
- Given `listMessages` → `{ messages: [], hasMore: false }`
- When 마운트 후 언마운트한다
- Then ⓐ `role=status` "아직 대화가 없습니다", `log`·`alert` 없음 ⓑ 언마운트 뒤 `ld:scroll:r1` 없음(한 번도 배치되지 않아 저장 안 함) ⓒ `listMessages` 1회
- 스펙: `ChatScreen.test.tsx`

### TC-CH-007 · 캐릭터 말풍선(세바스찬 왼쪽 · 시엘 오른쪽) · 종류: 자동 · 요구: R-CHAT-002 🔒(CR-001 개정) · R-LLM-002 · 설계: C §2.2 v1.6 `sebastian`·`ciel` 행·클래스 표 · §7 CHARACTERS · A 이미지 · C §4 · 토큰: 없음
- Given 세바스찬 line 09:05 / 시엘 line 16:40
- When Bubble을 렌더한다
- Then ⓐ 세바스찬 루트 배치 클래스 = 정확히 `character` + `sebastian`(왼쪽), 시엘 = 정확히 `character` + `ciel`(오른쪽). 아바타 `img src="/embed/img/sebastian.png"`·`"/embed/img/ciel.png"`, `alt=""`. 이름 `세바스찬`·`시엘`(전체 이름 `미카엘리스`·`시엘 팬텀하이브` 없음). `<time dateTime="2026-10-05T09:05">09:05</time>`·`16:40`. DOM 순서는 둘 다 아바타 → 이름 → 시각 → 본문(시엘은 화면만 거울) ⓑ 표시 전용 — 상태 변경 없음 ⓒ `listMessages` 미호출
- 스펙: `ui/src/chat/test/Bubble.test.tsx`

### TC-CH-008 · 유저 말풍선(가운데 말풍선) · 종류: 자동 · 요구: R-CHAT-002 🔒(CR-001 개정) · 설계: C §2.2 v1.6 `user` 행 · §3.2 비고(일반 텍스트) · §8.1 `unknownAuthor` · 토큰: 없음
- Given 유저 line(미샤 16:42) / `authorName=null` / 본문 `<b>굵게</b>`
- When Bubble을 렌더한다
- Then ⓐ 배치 클래스 = 정확히 `user`(가운데 말풍선, 캐릭터 키 없음), 아바타 없음, `[지시]` 없음, DOM 순서 작성자명 → 시각(16:42) → 본문. null이면 `이름 없음`. 본문 `<b>`가 요소로 해석되지 않고 글자 그대로 ⓑ 상태 변경 없음 ⓒ `listMessages` 미호출
- 스펙: `Bubble.test.tsx`

### TC-CH-009 · OOC(가운데 한 줄) · 유저와 구분 · 종류: 자동 · 요구: R-CHAT-002 🔒(CR-001 개정) · 설계: C §2.2 v1.6 `ooc` 행·유저/OOC 구분 문단 · §8.1 `oocPrefix`·`oocDecor` · A 장식 · 토큰: 없음
- Given 유저 ooc `둘이 체스를 둔다`(미샤 16:43) / 같은 작성자·같은 본문의 유저 line과 ooc 한 쌍
- When Bubble을 렌더한다
- Then ⓐ 배치 클래스 = 정확히 `ooc`, 텍스트에 `[지시]`가 본문보다 앞, `—` 장식 2개 `aria-hidden="true"`, 작성자명 `미샤` 없음, 아바타 없음, 시각 `16:43`. 쌍 비교: 유저는 `user`(`ooc` 아님)·작성자명 있음·접두·장식 0개, OOC는 `ooc`(`user` 아님)·작성자명 없음·`[지시]`·장식 2개(배경 유무·글자 크기는 수동 MC-CH-02) ⓑ 상태 변경 없음 ⓒ `listMessages` 미호출
- 스펙: `Bubble.test.tsx`

### TC-CH-010 · 변형 판정 · 종류: 자동 · 요구: R-CHAT-002 🔒(CR-001 개정) · 설계: F-CH-15 `bubbleVariantOf` v1.6 · C §2.2 판정 순서 · 토큰: 무관
- Given speaker × kind 6조합, 그리고 시엘 ooc 메시지
- When `bubbleVariantOf`를 부르고 Bubble을 렌더한다
- Then ⓐ 시엘 ooc 렌더는 배치 클래스 정확히 `ooc`, 아바타·`시엘` 이름 없음 ⓑ user/line → `user`, */ooc → `ooc`, ciel/line → `ciel`, sebastian/line → `sebastian` ⓒ api 호출 없음(순수 함수)
- 스펙: `Bubble.test.tsx`

### TC-CH-011 · 이전 페이지 요청 · 종류: 자동 · 요구: R-CHAT-003 · R-MSG-001 · 설계: §6.2 · F-CH-05 · F `nextBefore` · C §2.1·§2.3 · C §3 첫 배치 행 · §8.1 `olderLoading`·`historyAriaLabel` · 토큰: 없음
- Given 첫 페이지 31~60(`hasMore=true`), 스크롤 박스 3000/493, 2회째 `listMessages` 대기
- When (a) `scrollTop=80` + scroll (b) `scrollTop=81` + scroll (c) 같은 첫 페이지 31~60(30건 — 계약상 limit 없이 최대 30건)·`hasMore=true`를, 상자보다 짧은 내용 높이 400으로 첫 배치(짧은 내용은 높이 mock으로만 표현)
- Then ⓐ 첫 배치 `scrollTop=2507`. (a) 박스 안 `role=status` "이전 대화 불러오는 중", 박스 `aria-busy="true"` → 응답 후 B0 사라짐·`li` 60개·`aria-busy`≠`true` (b) 대기를 비운 뒤에도 B0 없음. 부품 단위: B0 status가 박스 안 `ol`보다 앞(맨 위), 로딩·오류가 둘 다 아니면 B0 없음 ⓑ (a) isLoadingOlder true → false. 훅 단위: 첫 배치가 맨 위 근처이고 canAutoLoadOlder면 `onReachTop` 1회, 아니면 0회 ⓒ (a) 2회째 인자 `['r1', { before: 31 }]` (b) 대기를 비운 뒤에도 1회 유지 (c) 자동 1회 `['r1', { before: 31 }]`, 대기를 비운 뒤에도 총 2회(자동 요청은 1회뿐)
- 스펙: `ui/src/chat/test/ChatScroll.test.tsx` · `useAutoScroll.test.tsx` · `MessageList.test.tsx`(B0 렌더·순서)

### TC-CH-012 · 앵커 보존 · 종류: 자동 · 요구: R-CHAT-003 · 설계: §6.2 · C §3 앞붙임 행 · F `anchorScrollTop` · 토큰: 없음
- Given 첫 페이지 31~60, 사용자가 `scrollTop=40`에서 이전 페이지를 요청했다. 응답 전 내용 높이를 6000으로 바꾼다
- When 1~30 응답이 도착한다
- Then ⓐ `scrollTop = 40 + (6000 − 3000) = 3040`, 첫 `li`가 `본문 1`, `li` 60개 ⓑ 훅 단위: 앞붙임만 3040 / 앞·뒤 동시 + 맨 아래 근처 → 6200(앞 보정 후 맨 아래) / 앞·뒤 동시 + 위쪽(1000) → 4200(앞 보정만) ⓒ `listMessages` 2회
- 스펙: `ChatScroll.test.tsx` · `useAutoScroll.test.tsx`

### TC-CH-013 · 중복 요청 방지·종료 · 종류: 자동 · 요구: R-CHAT-003 · 설계: F-CH-05 `olderInFlightRef` · F `canLoadOlder` · §6.2 마지막 줄 · 토큰: 없음
- Given 이전 페이지 요청이 대기 중 / 또는 첫 페이지 `hasMore=false`
- When (a) 맨 위에서 scroll 3회 (b) 리렌더 전 같은 `act` 안에서 scroll 2회 (c) `hasMore=false`에서 맨 위 scroll
- Then ⓐ (a) B0 status 1개 (c) B0(status·alert) 없음 ⓑ (a)(b) 진행 중 플래그가 중복을 막는다 (c) 요청 조건 불충족 ⓒ (a)(b) `listMessages` 총 2회 (c) 1회
- 스펙: `ChatScroll.test.tsx`

### TC-CH-014 · 이전 페이지 오류 · 종류: 자동 · 요구: R-CHAT-003 · 설계: F-CH-06 · F `canAutoLoadOlder` · §6.4 3행 · C §2.3 · §8.1 `olderError`·`retry` · 토큰: 없음
- Given 첫 페이지 31~60, 2회째 `INTERNAL` 실패, 3회째 1~30 성공
- When 맨 위 scroll → 실패 → 다시 맨 위 scroll 2회 → 박스 안 「다시 시도」 클릭
- Then ⓐ 박스 안 `role=alert` "이전 대화를 불러오지 못했습니다" + 「다시 시도」, 기존 `li` 30개 유지, `aria-busy`≠`true` → 재시도 후 `li` 60개·`alert` 없음. 부품 단위: B0 alert가 `ol`보다 앞 ⓑ olderError 기록 → 스크롤 자동 재시도 금지 → 버튼 재시도 허용 ⓒ 실패 뒤 스크롤로는 2회 유지, 버튼으로 3회째 `['r1', { before: 31 }]`. 부품 단위: 버튼 → `onRetryOlder` 1회, `listMessages` 미호출
- 스펙: `ChatScroll.test.tsx` · `MessageList.test.tsx`

### TC-CH-015 · 리듀서 T1~T8 · 종류: 자동 · 요구: R-CHAT-003 · 설계: F §1 · §1.1 T1~T8 · F-CH-12 · 토큰: 무관
- Given 얼린(`Object.freeze`) 입력 상태
- When 액션 `initialLoadStarted`·`initialLoadSucceeded`·`initialLoadFailed`·`olderLoadStarted`·`olderLoadSucceeded`·`olderLoadFailed`를 넣는다
- Then ⓐ 해당 없음(순수 함수) ⓑ 초기값 9필드 일치(S1 7필드 + S2 `writing`·`editingId` = null, v0.4 메인 세션 승인 보정). T1 → 초기값. T2 → ready·정렬·중복 제거·hasMore. T3 → error·나머지 초기값. T4 → isLoadingOlder true·olderError null. T5(4가지 불충족) → 같은 참조. T6 → 앞 합침·hasMore·로딩 해제, 빈 페이지면 hasMore false. T7 → 같은 참조. T8 → 로딩 해제·olderError·말풍선 유지 ⓒ api 호출 없음
- 스펙: `ui/src/state/chat.test.ts`

### TC-CH-016 · 리듀서 T9~T12·순수 함수 · 종류: 자동 · 요구: R-CHAT-003 · R-MSG-001 · 설계: F §1.1 T9~T12 · §1.2 · §6.3 · 토큰: 무관
- Given ready 상태(31~33)
- When `messagesAppended`·`unseenCleared`, `mergeMessages`·`canLoadOlder`·`canAutoLoadOlder`·`nextBefore`
- Then ⓐ 해당 없음 ⓑ T9 위쪽: 끝 id 초과분만 unseen 가산(1+2=3), 같은 id는 incoming 값. 맨 아래: 0. T10 → 같은 참조. T11 → 0, T12 → 같은 참조. merge: 합집합·incoming 우선·오름차순·입력 불변. olderError가 있으면 canLoadOlder true·canAutoLoadOlder false. nextBefore = 31 / null ⓒ api 호출 없음
- 스펙: `ui/src/state/chat.test.ts`

### TC-CH-017 · scroll.ts · 종류: 자동 · 요구: R-CHAT-003 · R-CHAT-010 · 설계: F §2 · F-CH-13 · 토큰: 무관
- Given 수치 객체 `{ scrollTop, scrollHeight: 3000, clientHeight: 493 }`
- When 함수 6종을 부른다
- Then ⓐ 해당 없음 ⓑ 임계 80·120. 거리 0·1507, 음수는 0. isNearTop 80 true·81 false. isNearBottom 거리 120 true·121 false. anchor 3040·40. restore null 2507·0 2507·300 2207·5000 0·짧은 내용 0. 입력 불변 ⓒ api 호출 없음
- 스펙: `ui/src/state/scroll.test.ts`

### TC-CH-018 · useAutoScroll 뒤붙임 · 종류: 자동 · 요구: R-CHAT-003 · 설계: C §3 뒤붙임 행 · §6.3 · F-CH-14 · 토큰: 무관
- Given 하네스로 첫 배치 완료(31~60, `scrollTop=2507`)
- When 내용 높이 3200으로 `lastId` 61 rerender — (a) 그대로 맨 아래 (b) 먼저 `scrollTop=1000`으로 스크롤
- Then ⓐ (a) `scrollTop=3200` (b) `scrollTop=1000` 유지 ⓑ `isNearBottom()` (a) true (b) false ⓒ api 호출 없음(훅은 api를 모른다)
- 스펙: `ui/src/chat/test/useAutoScroll.test.tsx`

### TC-CH-019 · 새 메시지 배지 · 종류: 자동 · 요구: R-CHAT-003 · 설계: C §2.1 2번 · C §2.4 · F-CH-08 · §8.1 `newMessages`·`newMessagesAriaLabel` · 토큰: 없음
- Given MessageList `unseenCount=3`(S1에는 발생 경로가 없어 부품에 직접 넣는다) / `unseenCount=0`
- When 배지를 클릭한다 / 훅 `scrollToBottom()`을 부른다
- Then ⓐ 이름 `새 메시지 보기, 맨 아래로 이동`·글자 `새 메시지` 버튼이 스크롤 박스 **밖**에 있음, 화살표 SVG `aria-hidden`. 0이면 배지 없음 ⓑ 클릭 → `onShowNewest` 1회. 훅 `scrollToBottom()` → `scrollTop=scrollHeight(3000)`·`isNearBottom()` true. `unseenCleared` 전이는 TC-CH-016 T11 ⓒ `listMessages` 미호출
- 스펙: `MessageList.test.tsx` · `useAutoScroll.test.tsx`
- 참고: F-CH-08(배지 클릭 = scrollToBottom + clearUnseen 조립)은 S1 화면에서 `unseenCount>0`을 만들 수 없어 부품 3개로 나눠 검증한다. 조립 TC는 S2(발생 경로 생김)에서 추가.

### TC-CH-020 · 맨 아래 도달 해제 · 종류: 자동 · 요구: R-CHAT-003 · 설계: C §3 onScroll 행 · F-CH-07 · 토큰: 무관
- Given 하네스 첫 배치 완료
- When (a) `scrollTop` 1000 → 2386(거리 121) → 2387(거리 120) (b) `canAutoLoadOlder=false`로 맨 위 → true로 rerender 후 맨 위
- Then ⓐ 해당 없음(하네스) ⓑ (a) `onReachBottom` 121에서 0회, 120에서 1회 (b) false일 때 `onReachTop` 0회, true로 바뀐 뒤 1회(최신 값 사용) ⓒ api 호출 없음
- 스펙: `useAutoScroll.test.tsx`

### TC-CH-021 · 하단 바 부재 · 종류: 자동 · 요구: R-CHAT-008 · R-CHAT-004(부재 쪽) · 설계: §10 2·4·5·6행 · F-CH-01 · 토큰: 없음
- Given `viewer=READ_ONLY_VIEWER`, 말풍선 표시
- When 화면 전체를 본다
- Then ⓐ `button "세바스찬"`·`button "시엘"`·`textbox`·`switch`·`/전송/` 버튼이 DOM에 없음. 화면 버튼은 ‹ 하나뿐(임시 말풍선·인라인 수정·알림 줄 버튼도 없음) ⓑ `ld:lastRoomId='r1'` ⓒ `listMessages` 1회(쓰기 래퍼 없음)
- 스펙: `ChatScreen.test.tsx`

### TC-CH-022 · 말풍선 메뉴 부재 · 종류: 자동 · 요구: R-CHAT-008 · R-CHAT-007(부재 쪽) · 설계: §10 3행 · C §2.2 마지막 줄 · 토큰: 없음
- Given 말풍선 표시
- When 첫 말풍선에 `contextmenu`, 이어서 가짜 시계로 pointer/mouse down → 600ms → up
- Then ⓐ `dialog`·`menu`·`textbox` 없음 ⓑ `contextmenu` 이벤트가 `preventDefault` 되지 않음(`fireEvent` 반환 true = 브라우저 기본 동작) ⓒ `listMessages` 1회
- 스펙: `ChatScreen.test.tsx`

### TC-CH-023 · 열람 안내 · 종류: 자동 · 요구: R-CHAT-008 · R-CHAT-013 · 설계: §10 7행 · C §2.5 · §8.1 `readOnlyNotice` · 토큰: 없음
- Given `viewer=READ_ONLY_VIEWER`
- When 로딩 중·데이터 표시·첫 로드 오류 상태를 각각 본다
- Then ⓐ 세 상태 모두 `role=note` 텍스트가 정확히 `열람 전용 - 대화 참여는 등급 회원만` ⓑ `canWrite === false` ⓒ `listMessages` 총 2회(두 번 마운트)
- 스펙: `ChatScreen.test.tsx`

### TC-CH-024 · 마지막 본 방 기록·삭제 · 종류: 자동 · 요구: R-CHAT-010 · R-ROOMS-004 · 설계: F-CH-02·10 · §6.4 마지막 본 방 줄 · 토큰: 없음
- Given (a) `ld:lastRoomId='r0'`, 첫 로드 대기 중 (b) `setItem`·`removeItem` throw
- When (a) 마운트 → `pagehide` → ‹ 뒤로 (b) 마운트 → ‹ 뒤로
- Then ⓐ (b) 말풍선 정상 표시 ⓑ (a) 마운트 직후(응답 전) `'r1'`, `pagehide` 뒤에도 `'r1'`, 뒤로 후 `null` (b) throw가 밖으로 나오지 않음 ⓒ (a)(b) `onBack` 1회, `listMessages` 1회
- 스펙: `ChatScreen.test.tsx`

### TC-CH-025 · 스크롤 저장·복원 · 종류: 자동 · 요구: R-CHAT-010 · R-NFR-004 · 설계: F-CH-09 · F §3 `initialDistance` · C §3 첫 배치 행 · rooms C §1.7 · §6.1 · 토큰: 없음
- Given 스크롤 박스 3000/493, `hasMore=false`
- When (a) `ld:scroll:r1='300'`으로 마운트 (b) `scrollTop=1000` 후 언마운트 (c) `scrollTop=1200` 후 `pagehide` (d) 첫 로드 대기 중 언마운트(`'300'` 저장돼 있음) (e) 마운트 → 언마운트 후 키 목록 (f) `scrollTop=1000` 후 언마운트 → 저장소 비움 → `pagehide`
- Then ⓐ (a) 첫 배치 `scrollTop=2207` ⓑ (b) `'1507'` (c) `'1307'`, `ld:lastRoomId='r1'` 유지 (d) `'300'` 유지 (e) 키는 `ld:lastRoomId`·`ld:scroll:r1`뿐 (f) 언마운트 시 `'1507'` 저장 → 비운 뒤 `pagehide`가 와도 `ld:scroll:r1` 없음(cleanup이 `pagehide` 리스너를 해제). 훅 단위: 복원 null 2507·300 2207·99999 0, `firstId=null`이면 배치 안 함·거리 null, 언마운트 뒤 마지막 거리 1507. storage 단위: 반올림·음수 0, 파싱(`abc`·`-5`·`Infinity` → null), 방별 키 분리 ⓒ `listMessages` 1회(각 경우)
- 스펙: `ChatScroll.test.tsx` · `useAutoScroll.test.tsx` · `ui/src/state/storage.test.ts`

### TC-CH-026 · 저장소 throw · 종류: 자동 · 요구: R-CHAT-010 · 설계: §6.4 저장소 행 · rooms C §1.7 · 토큰: 없음
- Given `getItem`·`setItem`·`removeItem` 모두 throw, 스크롤 박스 3000/493
- When 마운트 → ‹ 뒤로 → 언마운트
- Then ⓐ 말풍선 30개, `alert` 없음 ⓑ 복원 거리 없음 = 맨 아래 `scrollTop=2507`, 언마운트 시 throw 없음 ⓒ `listMessages` 1회 `['r1']`, `onBack` 1회
- 스펙: `ChatScroll.test.tsx`

### TC-CH-027 · 접근성 · 종류: 자동 · 요구: R-CHAT-013 · 설계: A 전 항목 · §8.1 `historyAriaLabel`·`backAriaLabel` · 토큰: 없음
- Given 말풍선 표시 / 첫 로드 오류 / B0 오류
- When Tab을 누른다
- Then ⓐ 스크롤 박스 `role=log`·이름 `대화 기록`·`aria-live=polite`·`tabindex=0`·`aria-busy`≠`true`, ‹ 아이콘 SVG `aria-hidden`. 포커스 순서: ‹ → 히스토리 / 첫 로드 오류면 ‹ → 「다시 시도」 / B0 오류면 ‹ → 히스토리 → 박스 안 「다시 시도」 ⓑ 마운트 포커스 = ‹ ⓒ `listMessages` 1회(B0 경우 2회)
- 스펙: `ChatScreen.test.tsx` · `ChatScroll.test.tsx`

### TC-CH-028 · 390×565 스크린샷(수동) · 종류: 수동 · 요구: R-CHAT-013 · R-CHAT-002 · 설계: §2.1 · §2.3 · C §4 · A 대비·포커스 링·모션 · 토큰: 없음
- Given 개발 서버, 뷰포트 390×565, 시드 방(캐릭터 2·유저·OOC·긴 단어 포함, 30건 초과)
- When 첫 화면·이전 페이지 로드 중·빈 방·오류를 스크린샷으로 남기고 실제로 스크롤한다
- Then ⓐ 가로 스크롤 없음, A 44·D 28, 화자 정렬(세바스찬 왼쪽·시엘 오른쪽·유저 가운데 말풍선·OOC 가운데 한 줄 — CR-001, 설계 v1.6)·색·아바타 28px, 읽던 자리 유지 체감 ⓑ 해당 없음(시각 확인) ⓒ 해당 없음 — 수동 확인표 `MC-CH-01~08`
- 스펙: `ui/src/chat/test/manual-checklist.md`

### TC-CH-029 · 늦은 응답 무시 · 종류: 자동 · 요구: R-CHAT-003 · 설계: F §3 `isActiveRef` · F-CH-03·05 · §6.4 늦은 응답 행 · 토큰: 없음
- Given (a) 첫 로드 대기 중 (b) 첫 페이지 표시 후 `scrollTop=40`에서 이전 페이지 대기 중
- When 응답 전에 언마운트하고, 그 뒤 응답이 도착한다
- Then ⓐ `log` 없음 ⓑ (a) `ld:scroll:r1` 없음 (b) 언마운트 시 저장된 `'2467'`(3000−40−493)이 응답 뒤에도 그대로. 둘 다 `console.error` 0회 ⓒ (a) `listMessages` 1회 (b) 2회
- 스펙: `ChatScreen.test.tsx` · `ChatScroll.test.tsx`
- 참고: **회귀 방지용 TC다.** React 19는 언마운트 뒤 dispatch를 경고 없이 무시하므로, `isActiveRef`가 없어도 이 단언은 통과할 수 있다(판별력 없음, 검증 TK-02). 관찰 지점은 저장소·DOM·`console.error`다.

### TC-CH-030 · 오류 상세 · 종류: 자동 · 요구: R-CHAT-002 · 설계: §8.2 `errorDetail` · §7 코드 목록 · §6.4 NOT_FOUND 행 · 토큰: 없음
- Given 첫 로드 실패 `{ code, message: 'SERVER-RAW-MESSAGE' }`, code ∈ `NETWORK`·`NOT_FOUND`·`INTERNAL`·`VALIDATION_ERROR`
- When 마운트한다
- Then ⓐ 상세 = `서버에 연결할 수 없습니다.` / `방을 찾을 수 없습니다. 목록으로 돌아가 주세요.` / `ERROR_MESSAGES.INTERNAL` / `ERROR_MESSAGES.VALIDATION_ERROR`, `SERVER-RAW-MESSAGE` 없음 ⓑ `ld:lastRoomId='r1'`(오류여도 기록) ⓒ `listMessages` 1회
- 스펙: `ChatScreen.test.tsx`

### TC-CH-031 · (S2) 토큰 있음 렌더 쌍 · 종류: 자동 · 요구: R-CHAT-004 · R-CHAT-008 · R-CHAT-001 · R-CHAT-013 · 설계: §2.2 · §3.1 · §10 · C §2.0·§2.6 · §8.1.1 · A 랜드마크 · 토큰: 있음
- Given `viewer=WRITER_VIEWER`, 픽스처 4건
- When 마운트한다
- Then ⓐ `<header>` 버튼 2개(‹ · `방 메뉴 열기`). `group "메시지 작성"` 안에 `switch "OOC 지시 모드"`(`aria-checked="false"`, 글자 `OOC 끔`) · `textbox "메시지 입력"`(placeholder `대사나 지시를 입력`) · `button "전송"`. `button "세바스찬"`·`"시엘"` 없음(S3), `role=note` 없음. 말풍선 4개 모두 메뉴 대상(`tabindex=0`·`aria-haspopup="dialog"`·`aria-keyshortcuts="Shift+F10"`, `menuEnabled` 클래스). TC-CH-003·021·022·023과 쌍 ⓑ `ld:lastRoomId='r1'` ⓒ `listMessages` 1회 `['r1']`, 쓰기 래퍼 0회
- 스펙: `ui/src/chat/test/Composer.test.tsx`

### TC-CH-032 · (S2) 전송 비활성 · 종류: 자동 · 요구: R-CHAT-004 · R-MSG-002 · 설계: C §2.6 `sendable` · F §1.2 `canSend` · C §1.11·§1.13 · 토큰: 있음
- Given (a) ready (b) `listMessages` 대기(loading) (c) 첫 로드 실패(error)
- When (a) 입력 `''` → `'   '` → `'a'×2001` → `'a'×2000` (b)(c) `안녕` 입력
- Then ⓐ (a) 빈·공백 → `전송` disabled, 카운터 없음 · 2001 → disabled, 카운터 `2001/2000`(`over`), 입력 `aria-invalid="true"` · 2000 → enabled, 카운터 없음(`counterMode='overflow'`) (b)(c) disabled ⓑ 입력값은 넣은 그대로 ⓒ `appendUser` 0회
- 스펙: `Composer.test.tsx`

### TC-CH-033 · (S2) 전송 성공 · 종류: 자동 · 요구: R-CHAT-006 · R-CHAT-004 · R-AUTH-004 · R-MSG-002 · 설계: §6.3 · F-CH-17 · C §2.6 `submit` · §7 `appendUser` · 토큰: 있음
- Given ready 4건, `appendUser` → `ok(105 미샤 '안녕')`
- When `안녕` 입력 → `전송` 클릭
- Then ⓐ `li` 5개, 끝 말풍선 `user` 클래스·작성자명 `미샤`·본문 `안녕`. 입력값 `''`, 입력에 포커스, switch `OOC 끔` 유지 ⓑ 저장소 키는 `ld:lastRoomId`(=`r1`)뿐 ⓒ `appendUser` 1회, 인자 정확히 `['r1', { text: '안녕', ooc: false }]`. 두 모킹 모듈의 나머지 export 호출 합계 = 첫 `listMessages` 1회뿐(AI 호출 없음)
- 스펙: `Composer.test.tsx`

### TC-CH-034 · (S2) OOC 토글 · 종류: 자동 · 요구: R-CHAT-004 · R-CHAT-006 · 설계: C §2.6 1행 · C §1.14 · §8.1.1 `oocOn`·`oocOff` · 토큰: 있음
- Given ready, `appendUser` → `ok(106 ooc '체스 두기')`
- When switch 클릭 → `체스 두기` 입력 → 전송
- Then ⓐ 클릭 뒤 `aria-checked="true"`·글자 `OOC 켬` → 전송 뒤 끝 말풍선 `ooc` 클래스·`[지시]` 포함, switch는 계속 `OOC 켬` ⓑ 입력 `''` ⓒ `appendUser` `['r1', { text: '체스 두기', ooc: true }]` 1회
- 스펙: `Composer.test.tsx`

### TC-CH-035 · (S2) Enter·Shift+Enter·IME · 종류: 자동 · 요구: R-CHAT-004 · R-CHAT-013 · 설계: C §1.13 `onEnter`·IME · A 키보드 · 토큰: 있음
- Given ready, 입력에 포커스
- When (a) 빈 입력 Enter (b) `가` 입력 후 `keyDown Enter isComposing: true` (c) Shift+Enter (d) Enter
- Then ⓐ (a)(b) 변화 없음 (c) 입력값 `가\n` (d) 전송 → 입력 `''` ⓑ — ⓒ (a)(b)(c) `appendUser` 0회 (d) 1회 `['r1', { text: '가\n', ooc: false }]`
- 스펙: `Composer.test.tsx`

### TC-CH-036 · (S2) 전송 중 중복 방지 · 종류: 자동 · 요구: R-CHAT-006 · R-CHAT-013 · 설계: F-CH-17 `writeInFlightRef` · F §1.1 T13·T14 · C §2.6 `isReadOnly` · A `aria-busy` · 토큰: 있음
- Given `appendUser` 대기(deferred)
- When (a) 전송 클릭 → 대기 중 클릭·Enter 2회 → resolve (b) 같은 `act` 안 `fireEvent.click(전송)` 2회
- Then ⓐ 대기 중 `전송` disabled, 입력 `readOnly`, group `aria-busy="true"` → 응답 뒤 `aria-busy`≠`true`, `readOnly` 해제 ⓑ writing send → null(표시로 관찰) ⓒ (a)(b) `appendUser` 1회
- 스펙: `Composer.test.tsx`

### TC-CH-037 · (S2) 전송 실패(비인증) · 종류: 자동 · 요구: R-CHAT-011 · R-CHAT-006 · 설계: §6.6 · F-CH-16 · §8.3 · C §1.18 · §11.2 D-7 · 토큰: 있음
- Given `안녕` 입력, `appendUser` 대기 → 실패: `INTERNAL` · `RATE_LIMITED`+40 · `RATE_LIMITED`(값 없음) · `NOT_FOUND` · `NETWORK` · `VALIDATION_ERROR`
- When 전송 → (가짜 시계) → resolve → 1999ms → 1ms
- Then ⓐ E `role=alert` 문구·톤: `ERROR_MESSAGES.INTERNAL`(danger) · `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.`(warning) · `ERROR_MESSAGES.RATE_LIMITED`(warning) · `방을 찾을 수 없습니다. 목록으로 돌아가 주세요.`(danger) · `서버에 연결할 수 없습니다.`(danger) · `메시지는 1~2000자로 입력해 주세요.`(danger). `SERVER-RAW-MESSAGE` 없음. 입력값 `안녕` 유지, `li` 4개, group·⋯ 그대로, `role=note` 없음. 1999ms 있음 → 2000ms 없음 ⓑ `onAuthFailure` 0회 ⓒ `appendUser` 1회
- 스펙: `Composer.test.tsx`

### TC-CH-038 · (S2) 전송 뒤 스크롤·배지 · 종류: 자동 · 요구: R-CHAT-003 · R-CHAT-006 · 설계: §6.3 · F-CH-17 `isNearBottom` · F-CH-08 조립 · C §3 뒤붙임 행 · F §1.1 T9·T11 · 토큰: 있음
- Given 스크롤 mock(493). 내용 높이는 렌더된 말풍선 수에 연동한다: 4개일 때 3000, 새 말풍선(5번째)이 **커밋된 뒤** 3200. 첫 배치 `scrollTop=2507`. 응답 시점(붙이기 전) `isNearBottom` 측정은 3000 기준이다(TK-01)
- When (a) 그대로 전송 성공 (b) `scrollTop=1000` + scroll 후 전송 성공 → 배지 클릭
- Then ⓐ (a) `scrollTop=3200`, 배지 없음 (b) `scrollTop=1000` 그대로, `button "새 메시지 보기, 맨 아래로 이동"`(글자 `새 메시지`) → 클릭 → `scrollTop=3200`, 배지 없음 ⓑ (a) unseen 0 (b) 1 → 0(배지로 관찰) ⓒ `appendUser` 1회, `listMessages` 1회(새 메시지 반영에 재요청 없음)
- 스펙: `Composer.test.tsx`

### TC-CH-039 · (S2) 말풍선 메뉴 열기 · 종류: 자동 · 요구: R-CHAT-007 · R-CHAT-013 · 설계: §6.4 1행 · C §2.2 메뉴 핸들러 · C §1.19 · F-CH-18 · A Shift+F10 · 토큰: 있음
- Given ready, 102(세바스찬) 말풍선 메뉴 대상
- When (a) `fireEvent.contextMenu` (b) 마우스 왼쪽 누름 → 500ms (c) 누름 → 499ms → 뗌 (d) 누름 → 11px 이동 → 500ms (e) 터치 누름 → 500ms → `contextmenu` (f) 말풍선 포커스 → Shift+F10
- Then ⓐ (a)(b)(e)(f) `dialog "메시지 메뉴"` 1개((e)는 contextmenu 뒤에도 1개) (c)(d) dialog 없음 ⓑ (a) `fireEvent` 반환 `false`(`defaultPrevented`) ⓒ 쓰기 래퍼 0회
- 스펙: `ui/src/chat/test/BubbleMenu.test.tsx`

### TC-CH-040 · (S2) 메뉴 내용 · 종류: 자동 · 요구: R-CHAT-007 · R-LLM-002 · 설계: C §2.8 `nameOf`·`excerptOf` · §8.1.1 `messageMenuHeader`·`edit`·`delete`·`cancel` · 토큰: 있음
- Given 102 세바스찬 · 103 유저(미샤) · 104 OOC · 부품 단위 22자 본문 메시지
- When 각 말풍선의 메뉴를 연다 / `MessageMenuSheet`를 단독 렌더한다
- Then ⓐ 머리 `세바스찬 · 16:41  "예, 도련님."` · `미샤 · 16:42  "나도 한 잔 부탁해요."` · `[지시] · 16:43  "둘이 체스를 둔다"` · 22자 → 앞 20자 + `…`. 버튼 순서 `수정`·`삭제`·`취소`, `재작성` 없음. `삭제` 항목은 danger 톤 ⓑ — ⓒ 쓰기 래퍼 0회
- 스펙: `BubbleMenu.test.tsx`

### TC-CH-041 · (S2) 메뉴 닫기·포커스·트랩 · 종류: 자동 · 요구: R-CHAT-007 · R-CHAT-013 · 설계: C §1.15 포커스·트랩·Esc · F-CH-28 · A 시트 · 토큰: 있음
- Given 103 말풍선에 포커스 → Shift+F10으로 메뉴 열림(첫 포커스 `수정`)
- When (a) `취소` (b) Esc (c) 덮개(dialog의 부모) 클릭 (d) Tab×3 · Shift+Tab
- Then ⓐ (a)(b)(c) dialog 없음, 포커스 = 103 말풍선 (d) `수정`→`삭제`→`취소`→`수정`, Shift+Tab `수정`→`취소` ⓑ sheet null ⓒ 쓰기 래퍼 0회
- 스펙: `BubbleMenu.test.tsx`

### TC-CH-042 · (S2) 인라인 수정 열기 · 종류: 자동 · 요구: R-CHAT-007 · R-MSG-004 · 설계: §6.4 수정 · F-CH-19 · C §2.7 · §8.1.1 `editAriaLabel`·`editInputAriaLabel` · F §1.1 T21 · 토큰: 있음
- Given 103 메뉴가 열려 있다
- When `수정` → 값 변경(`나도 한 잔 부탁해요!` · `'   '` · `'a'×2001`)
- Then ⓐ dialog 없음, `group "메시지 수정"` 안 `textbox "수정할 내용"` 값 = 원문, 포커스, `selectionStart = selectionEnd = 원문 길이`. 저장 disabled(안 바뀜) → 1글자 바꾸면 enabled → 공백만·2001 disabled. 다른 말풍선·하단 바 그대로 ⓑ editingId 103(편집기로 관찰) ⓒ `editMessage` 0회
- 스펙: `BubbleMenu.test.tsx`

### TC-CH-043 · (S2) 수정 저장 · 종류: 자동 · 요구: R-CHAT-007 · R-MSG-004 · 설계: F-CH-20 · F-CH-30 · F §1.1 T17 · C §2.7 `isSaving` · 토큰: 있음
- Given 편집기에서 `새 본문`으로 바꿨다, `editMessage` 대기
- When 저장 → 대기 중 Esc → resolve `ok({…103, text: '새 본문'})`
- Then ⓐ 대기 중 `취소`·`저장` disabled, 입력 `readOnly`, Esc 뒤에도 편집기 있음 → 응답 뒤 편집기 없음, 103 본문 `새 본문`, 포커스 = `role=log` ⓑ editingId·writing null ⓒ `editMessage` 1회 `[103, { text: '새 본문' }]`
- 스펙: `BubbleMenu.test.tsx`

### TC-CH-044 · (S2) 수정 실패·취소 · 종류: 자동 · 요구: R-CHAT-007 · R-CHAT-011 · 설계: F-CH-20 실패 · F-CH-21 · §8.3 `editMessage` 행 · F §1.1 T23 · 토큰: 있음
- Given 편집기에서 `새 본문`으로 바꿨다
- When (a) 저장 → `INTERNAL` (b) 저장 → `NOT_FOUND` (c) `취소` (d) Esc
- Then ⓐ (a)(b) 편집기·입력값 `새 본문` 유지, 토스트 `ERROR_MESSAGES.INTERNAL` / `메시지를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.`(danger) (c)(d) 편집기 없음, 103 본문 원문, 포커스 = `role=log` ⓑ (a)(b) `onAuthFailure` 0회 ⓒ (a)(b) `editMessage` 1회 (c)(d) 0회
- 스펙: `BubbleMenu.test.tsx`

### TC-CH-045 · (S2) 메시지 삭제 · 종류: 자동 · 요구: R-CHAT-007 · R-MSG-005 · 설계: §6.4 삭제 · F-CH-22·23 · C §1.16 · §8.1.1 `deleteMessageTitle`·`deleteMessageBody` · F §1.1 T19 · 토큰: 있음
- Given 103 메뉴가 열려 있다
- When `삭제` → `취소` → 다시 메뉴 → `삭제` → 확인 `삭제`(대기) → resolve `ok(undefined)`
- Then ⓐ `alertdialog "이 메시지를 삭제할까요?"`, 본문 `삭제한 메시지는 되돌릴 수 없습니다.`, 첫 포커스 `취소` → 취소 뒤 dialog 없음·103 있음 → 대기 중 두 버튼 disabled → 응답 뒤 `li` 3개(103 없음), dialog 없음, 포커스 = `role=log` ⓑ 저장소 변화 없음 ⓒ `deleteMessage` 취소 시 0회, 확인 뒤 1회 `[103]`
- 스펙: `BubbleMenu.test.tsx`

### TC-CH-046 · (S2) 삭제 실패·NOT_FOUND·빈 결과 재로드 · 종류: 자동 · 요구: R-CHAT-007 · R-CHAT-011 · R-MSG-005 · 설계: F-CH-23 `RemoveResult` · functions.md `useMessageWrites` · C §3 v1.5 첫 행 · §11.2 D-6 · 토큰: 있음
- Given (a) `INTERNAL` (b) `NOT_FOUND` (c) 스크롤 mock, `ld:scroll:r1='300'`, 첫 페이지 [101]·`hasMore=true`, 2회째 `listMessages` → [90]·`hasMore=false` (d) 첫 페이지 [101]·`hasMore=false`
- When 그 말풍선(a·b는 103)을 삭제 확인
- Then ⓐ (a) 103 유지, dialog 없음, 토스트 `ERROR_MESSAGES.INTERNAL` (b) 103 없음, `alert` 없음 (c) 첫 배치 `scrollTop=2207` → 재로드 뒤 90 말풍선, `scrollTop=2507`(맨 아래, 저장 거리 무시) (d) `role=status` `아직 대화가 없습니다` ⓑ (a) `onAuthFailure` 0회 ⓒ (a)(b) `deleteMessage` 1회 `[103]` (c) `listMessages` 2회, 2회째 정확히 `['r1']` (d) `listMessages` 1회
- 스펙: `BubbleMenu.test.tsx`

### TC-CH-047 · (S2) ⋯ 방 메뉴 · 종류: 자동 · 요구: R-CHAT-001 · 설계: §6.5 · C §2.0·§2.9 · F-CH-24 · §8.1.1 `moreAriaLabel`·`roomMenuHeader`·`rename`·`deleteRoom` · 토큰: 있음
- Given ready
- When `방 메뉴 열기` → (a) `취소` (b) Esc
- Then ⓐ `dialog "방 메뉴"`, 머리 `방 메뉴 · 티타임`, 버튼 순서 `이름 변경`·`방 삭제`·`취소`, `장기기억` 없음 → 닫힌 뒤 포커스 = ⋯ ⓑ — ⓒ 쓰기 래퍼 0회
- 스펙: `ui/src/chat/test/RoomMenu.test.tsx`

### TC-CH-048 · (S2) 이름 변경 성공 · 종류: 자동 · 요구: R-CHAT-001 · R-ROOM-003 · 설계: §6.5 이름 변경 · F-CH-25·26 · C §1.17 · C §2.10 `rename` · rooms F-RM-13 · 토큰: 있음
- Given (a) 화면 단위 (b) App 통합 `initToken`, 티타임 진입
- When `이름 변경` → 값 확인 → `'  티타임  '`·`'   '`·61자 → `팬텀하이브 저택의 밤` → 저장(또는 Enter)
- Then ⓐ `dialog "방 이름 변경"`, `textbox "방 이름"` = `티타임`, 카운터 `3/60`, 저장 disabled(그대로·공백·61자) → enabled → 응답 뒤 dialog 없음, 포커스 = ⋯. (b) h1·`main` 이름이 `팬텀하이브 저택의 밤` ⓑ (a) `onRoomRenamed` 1회(응답 RoomSummary) ⓒ `renameRoom` 1회 `['r1', { title: '팬텀하이브 저택의 밤' }]`. (b) `listMessages` 1회 유지(재마운트 없음)
- 스펙: `RoomMenu.test.tsx`

### TC-CH-049 · (S2) 이름 변경 실패 · 종류: 자동 · 요구: R-CHAT-001 · R-CHAT-011 · 설계: F-CH-26 실패 · §8.3 `renameRoom` 행 · §11.2 D-7 · 토큰: 있음
- Given 이름 변경 시트에 `새 제목` 입력
- When 저장 → `INTERNAL` · `NOT_FOUND` · `RATE_LIMITED`+40 · `VALIDATION_ERROR` · `LEVEL_TOO_LOW`(하네스)
- Then ⓐ 비인증: dialog 유지, 입력 `새 제목` 유지, dialog **안** `role=alert` = `ERROR_MESSAGES.INTERNAL` / `방을 찾을 수 없습니다. 목록으로 돌아가 주세요.` / `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.` / `방 제목은 1~60자로 입력해 주세요.`, 화면의 alert는 그 1개(E 토스트 없음). `LEVEL_TOO_LOW`: dialog 없음, E 토스트 `대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.`, `role=note` ⓑ 비인증 `onRoomRenamed`·`onAuthFailure` 0회 / 인증 `onAuthFailure` 1회 ⓒ `renameRoom` 1회
- 스펙: `RoomMenu.test.tsx`

### TC-CH-050 · (S2) 방 삭제 · 종류: 자동 · 요구: R-CHAT-001 · R-ROOM-004 · R-ROOMS-004 · 설계: §6.5 방 삭제 · F-CH-27 · §8.1.1 `deleteRoomTitle`·`deleteRoomBody` · §11.2 D-6 · 토큰: 있음
- Given ready, `ld:lastRoomId='r1'`
- When `방 삭제` → (a) 확인 `삭제`(대기) → 대기 중 Esc·덮개 클릭 → `ok(undefined)` (b) `NOT_FOUND` (c) `INTERNAL`
- Then ⓐ `alertdialog "이 방을 삭제할까요?"` + `메시지와 장기기억이 함께 지워지며 되돌릴 수 없습니다.`, 첫 포커스 `취소`. (a) 대기 중 두 버튼 disabled, Esc·덮개 뒤에도 dialog 있음 (c) dialog 없음, 토스트 `ERROR_MESSAGES.INTERNAL` ⓑ (a)(b) `onBack` 1회, 그 시점에 `ld:lastRoomId` 이미 `null` (c) `onBack` 0회, `ld:lastRoomId='r1'` ⓒ `deleteRoom` 1회 `['r1']`
- 스펙: `RoomMenu.test.tsx`

### TC-CH-051 · (S2) 인증 실패 전환(App 통합) · 종류: 자동 · 요구: R-CHAT-011 · R-CHAT-008 · R-CHAT-009 · 설계: §6.6 · F-CH-16·29 · §8.3 인증 3행 · §10 · §11.2 D-8·D-9·D-10 · rooms F-RM-12 · 토큰: 있음 → 없음
- Given (a) `initToken('?t=test-token')` → App → 티타임 진입, `appendUser` → `LEVEL_TOO_LOW` · `TOKEN_INVALID` · `TOKEN_REQUIRED` (b) 화면 단위(하네스 없음 = 부모가 전환하지 않음), 전송 2회 연속 `LEVEL_TOO_LOW`
- When (a) `안녕` 전송 → 실패 → 말풍선 contextmenu → ‹ 뒤로 (b) 전송 → 실패 → 다시 전송 → 실패
- Then ⓐ (a) 같은 화면에서 ⋯·`group`·`textbox`·`switch` DOM 없음, `role=note` `열람 전용 - 대화 참여는 등급 회원만`, E 토스트 1개(warning) 코드별 문구, 포커스 = ‹. contextmenu 뒤 dialog 없음·`defaultPrevented` 아님. ‹ 뒤로 → rooms에 `새 방 만들기` 없음 (b) alert 1개 ⓑ (a) `getToken() === null` (b) `onAuthFailure` 1회(멱등) ⓒ (a) `appendUser` 1회 (b) 2회
- 스펙: `ui/src/chat/test/AuthTransition.test.tsx`

### TC-CH-052 · (S2) 전환 시 열린 상태 정리 · 종류: 자동 · 요구: R-CHAT-011 · R-CHAT-008 · R-CHAT-007 · 설계: F-CH-11 v1.5 `editingId` 조건 · F-CH-29 · F §1.1 T25 · 토큰: 있음 → 없음(하네스)
- Given (a) 103 편집기 `새 본문` (b) 103 삭제 확인 시트
- When (a) 저장 → `TOKEN_INVALID` (b) 확인 `삭제` → `LEVEL_TOO_LOW`
- Then ⓐ (a) 편집기 없음, 103 본문 원문 (b) dialog 없음, 103 있음. 둘 다 `role=note`, 포커스 ‹ ⓑ `onAuthFailure` 1회(writing·editingId null은 TC-CH-053 T25) ⓒ (a) `editMessage` 1회 (b) `deleteMessage` 1회
- 스펙: `AuthTransition.test.tsx`

### TC-CH-053 · (S2) 리듀서 T13~T26 · canSend · 종류: 자동 · 요구: R-CHAT-006 · R-CHAT-007 · R-CHAT-011 · R-CHAT-003 · 설계: F §1 · §1.1 T1 비고·T13~T26 · §1.2 `canSend` · F-CH-12 · 토큰: 무관
- Given 얼린 상태
- When S2 액션 7종 + ready에서 `initialLoadStarted`
- Then ⓐ 해당 없음 ⓑ 초기값 9필드(`writing`·`editingId` null). T1(ready·editingId·unseen 있음) → 초기값. T13 writing 설정 / T14(loading·쓰기 중) 같은 참조 / T15 null / T16 같은 참조 / T17 교체·순서 유지·editingId 같은 id면 null·다른 id면 유지 / T18 같은 참조 / T19 제거·editingId null / T20 같은 참조 / T21 editingId / T22(쓰기 중·없는 id·loading) 같은 참조 / T23 null / T24(저장 중·편집 아님) 같은 참조 / T25 둘 다 null / T26 같은 참조. `canSend` ready·null만 true ⓒ api 호출 없음
- 스펙: `ui/src/state/chat.test.ts`

### TC-CH-054 · (S2) 쓰기 직렬화 · 종류: 자동 · 요구: R-CHAT-007 · R-CHAT-006 · R-CHAT-001 · 설계: §11.2 D-5·D-10 · F-CH-18·24 · C §2.0 `isMenuDisabled` · C §2.8 `isWriteBusy` · 토큰: 있음
- Given (a) `appendUser` 대기 (b) `editMessage` 대기 (c) `renameRoom` 대기 (d) 부품 `MessageMenuSheet isWriteBusy`
- When (a) 말풍선 contextmenu·롱프레스 (b) 하단 입력에 `x` 입력 (c) 시트 뒤 ⋯ 확인 (d) true / false로 렌더
- Then ⓐ (a) dialog 없음, ⋯ disabled (b) 입력값 `x`, `전송` disabled, ⋯ disabled (c) ⋯ disabled (d) true면 `수정`·`삭제` disabled·`취소` enabled, false면 셋 다 enabled ⓑ writing·roomBusy 대기(표시로 관찰) ⓒ 대기 중인 래퍼 1회, 다른 쓰기 래퍼 0회
- 스펙: `BubbleMenu.test.tsx`(a)(b)(d) · `RoomMenu.test.tsx`(c)

### TC-CH-055 · (S2) BottomSheet·SheetItem · 종류: 자동 · 요구: R-CHAT-007 · R-CHAT-001 · R-CHAT-013 · 설계: C §1.15 · 토큰: 무관
- Given 바깥 버튼에 포커스한 뒤 시트 렌더(항목 3, `header` 있음/없음, `initialFocusRef`)
- When Tab·Shift+Tab·Esc·덮개 클릭·패널 클릭·`isDismissDisabled`·언마운트(바깥 버튼 제거 후 포함)
- Then ⓐ `role=dialog`(또는 `alertdialog`)·`aria-modal="true"`·이름, `header` 없으면 머리 없음, 첫 포커스 = 첫 항목(또는 `initialFocusRef`), Tab 끝→처음·Shift+Tab 처음→끝. SheetItem `danger` 클래스·`isDisabled` → disabled ⓑ 언마운트 → 포커스가 바깥 버튼으로, 그 버튼이 DOM에 없으면 복귀 안 함 ⓒ Esc·덮개 → `onClose` 1회, 패널 클릭 0회, `isDismissDisabled` 0회, 항목 클릭 → `onSelect` 1회
- 스펙: `ui/src/components/ui/BottomSheet/BottomSheet.test.tsx`

### TC-CH-056 · (S2) ConfirmDialog · 종류: 자동 · 요구: R-CHAT-007 · R-CHAT-001 · 설계: C §1.16 · 토큰: 무관
- Given title·message·라벨 props
- When 렌더 / `isBusy` / 버튼·Esc
- Then ⓐ `alertdialog` 이름 = title, `h2` title·`p` message, 버튼 순서 취소 → 확인, 확인 `danger` 클래스, 첫 포커스 취소. `isBusy` → 두 버튼 disabled ⓑ — ⓒ 확인 → `onConfirm` 1회, 취소·Esc → `onCancel` 1회, `isBusy`면 Esc 0회
- 스펙: `ui/src/components/ui/ConfirmDialog/ConfirmDialog.test.tsx`

### TC-CH-057 · (S2) PromptSheet · 종류: 자동 · 요구: R-CHAT-001 · 설계: C §1.17 · 토큰: 무관
- Given `initialValue='티타임'`, `maxChars=60`, `canSave = v => v !== '티타임'`
- When 렌더 / 값 변경 / Enter / `isBusy` / `errorText`
- Then ⓐ dialog 이름·h2 = title, 입력 포커스·커서 끝, 카운터 `3/60`, 저장 disabled → 바꾸면 enabled. `isBusy` → 입력 `readOnly`·두 버튼 disabled. `errorText` → `role=alert` ⓑ 입력 로컬 값 유지 ⓒ `canSave` false면 저장·Enter → `onSave` 0회, true면 Enter → `onSave(값)` 1회, 취소 → `onCancel` 1회
- 스펙: `ui/src/components/ui/PromptSheet/PromptSheet.test.tsx`

### TC-CH-058 · (S2) TextArea · 종류: 자동 · 요구: R-CHAT-004 · R-CHAT-013 · 설계: C §1.13 · 토큰: 무관
- Given `getComputedStyle` lineHeight 20·padding 8+8, textarea `scrollHeight` 변수, `matchMedia` false/true
- When 값 변경(scrollHeight 36 · 76 · 116) / Enter·Shift+Enter·IME / `counterMode`
- Then ⓐ 높이 `36px` hidden · `76px` hidden · `76px` `overflow-y: auto`. `matchMedia(max-height:480)` true면 116에서도 `36px`. `rows=1`. `counterMode='overflow'` 한도 이하 카운터 없음·초과 `over`, `'always'` 항상 ⓑ — ⓒ `onEnter` 있음: Enter → 1회·기본 막음, Shift+Enter → 0회. IME → 0회. `onEnter` 없음: Enter 기본 동작 유지(`defaultPrevented` 아님)
- 스펙: `ui/src/components/ui/TextArea/TextArea.test.tsx`

### TC-CH-059 · (S2) Toggle · 종류: 자동 · 요구: R-CHAT-004 · 설계: C §1.14 · 토큰: 무관
- Given `isOn=false`, 라벨 props
- When 클릭 · Space · Enter / `isOn=true` 다시 렌더
- Then ⓐ `button role=switch` 이름 = ariaLabel, `aria-checked` false → 글자 offLabel / true → onLabel ⓑ 상태는 props(부품은 바꾸지 않음) ⓒ 클릭·Space·Enter → `onChange(true)` 각 1회
- 스펙: `ui/src/components/ui/Toggle/Toggle.test.tsx`

### TC-CH-060 · (S2) useLongPress · 종류: 자동 · 요구: R-CHAT-007 · 설계: C §1.19 · 토큰: 무관
- Given 하네스 요소에 핸들러, 가짜 시계
- When 누름 → 499/500ms · 10px/11px 이동 · up·leave·cancel · 오른쪽 버튼 · contextmenu · 누름 500ms 뒤 contextmenu · 누름 중 언마운트
- Then ⓐ 해당 없음 ⓑ `LONG_PRESS_MS=500`·`LONG_PRESS_MOVE_TOLERANCE_PX=10`. 언마운트 뒤 타이머 0개 ⓒ `onLongPress`: 500ms 1회·499ms 0회 · 10px 1회·11px 0회 · up·leave·cancel 0회 · 오른쪽 버튼 0회 · contextmenu 1회 + `defaultPrevented` · 롱프레스 직후 contextmenu 추가 0회(합계 1) · 핸들러 객체는 리렌더해도 같은 참조, 리렌더로 바뀐 최신 `onLongPress`가 불림
- 스펙: `ui/src/components/hooks/useLongPress.test.tsx`

### TC-CH-061 · (S2) 390×565 쓰기 판 스크린샷 · 종류: 수동 · 요구: R-CHAT-013 · R-CHAT-004 · 설계: §2.2 · §2.3 · C §4 S2 행 · rooms C §1.20 · 토큰: 있음
- Given 개발 서버, 390×565, 유효 토큰 주소
- When 하단 바 1줄·3줄, 말풍선 메뉴·방 메뉴·이름 변경·확인 시트, 인라인 수정, E 토스트를 스크린샷으로 남긴다
- Then ⓐ 가로 스크롤 없음, A 44, C 96(1줄)·136(3줄), 시트 최대 70%·덮개, E 28 이상 ⓑ 해당 없음 ⓒ 해당 없음 — 수동 확인표 `MC-CH-10~13`
- 스펙: `ui/src/chat/test/manual-checklist.md`

### TC-CH-062 · (S2) 토큰 비노출(리뷰) · 종류: 수동 · 요구: R-CHAT-009 · R-NFR-004 · R-API-003 · 설계: §10 마지막 줄 · §7 머리말 · 토큰: 무관
- Given `ui/src/chat` 소스(테스트 제외)
- When grep `getToken`·`initToken`·`Authorization`·`fetch(`·`localStorage`
- Then ⓐ 해당 없음 ⓑ 0건(화면은 `viewer`만 본다) ⓒ 헤더를 만드는 코드 0건 — 수동 확인표 `MC-CH-14`(rooms `MC-RM-07`과 같은 grep 포함)
- 스펙: `manual-checklist.md`

### TC-CH-063 · (S2) 늦은 쓰기 응답 무시 · 종류: 자동 · 요구: R-CHAT-006 · R-CHAT-007 · R-CHAT-001 · 설계: §6.7 늦은 응답 행 · F-CH-17·20·23·27 비활성 분기 · 토큰: 있음
- Given (a) `appendUser` 대기 (b) `editMessage` 대기 (c) `deleteMessage` 대기 (d) `deleteRoom` 대기
- When 응답 전에 언마운트 → (a)(b)(c) `LEVEL_TOO_LOW`, (d) `ok(undefined)`로 resolve
- Then ⓐ 화면 없음 ⓑ `onAuthFailure`·`onBack` 0회, `console.error` 0회, (d) `ld:lastRoomId='r1'` 그대로 ⓒ 각 래퍼 1회
- 스펙: `AuthTransition.test.tsx`
- 참고: S1 TC-CH-029와 같이 React 19는 언마운트 뒤 dispatch를 경고 없이 무시한다. 판별 지점은 콜백·저장소다.

### TC-CH-064 · (S2) 방 삭제 후 목록(App 통합) · 종류: 자동 · 요구: R-CHAT-001 · R-ROOM-004 · R-ROOMS-004 · 설계: §6.5 · F-CH-27 · rooms F-RM-03 · tc.md v1.5 · 토큰: 있음
- Given `initToken`, `listRooms` 1회째 `[r1, r2]` · 2회째 `[r2]`
- When 티타임 진입 → ⋯ → `방 삭제` → `삭제`(`ok(undefined)`)
- Then ⓐ rooms 화면(`main "방 목록"`), 행은 `체스 대결` 하나 ⓑ `ld:lastRoomId` 없음 ⓒ `deleteRoom` `['r1']` 1회, `listRooms` 총 2회
- 스펙: `RoomMenu.test.tsx`

### TC-CH-065 · (S2) 이름 변경 후 목록(App 통합) · 종류: 자동 · 요구: R-CHAT-001 · R-ROOM-003 · 설계: F-CH-26 · rooms F-RM-13 · tc.md v1.5 · 토큰: 있음
- Given r1 = `RoomMenu.test.tsx` 지역 픽스처 `티타임`(updatedAt **10.05**. S1 공통 픽스처의 10.07과 다르다 — CF-04). `initToken`, `listRooms` 1회째 `[r1]` · 2회째 `[{…r1, title: '새 이름'}]`, `renameRoom` → `ok({…r1, title: '새 이름'})`
- When 티타임 진입 → 이름 변경 `새 이름` 저장 → ‹ 뒤로
- Then ⓐ 목록 행 이름이 `새 이름, 마지막 갱신 10.05`(두 번째 응답 그대로) ⓑ `ld:lastRoomId` 없음 ⓒ `renameRoom` 1회, `listRooms` 총 2회(화면이 목록을 직접 고치지 않음)
- 스펙: `RoomMenu.test.tsx`

## TC-FLOW

S1·S2 행. **ⓒ 호출 횟수는 단계 증분으로 읽는다**: 체인 안에서 각 Step의 ⓒ 횟수는 그 Step에서 새로 생긴 호출 수이고 앞 Step 호출에 더해진다(CF-02). 표기: `A → B`는 **순차 인계**(A의 결과 상태가 B의 Given). `분기:`는 같은 지점에서 갈라지는 **대안·독립 확인**(서로 상태를 넘기지 않는다).

### TC-FLOW-CH-01 · U-CH-01 어느 방인지 확인 · Steps: TC-RM-012(b) → TC-CH-001 → TC-CH-003 → TC-CH-027 → TC-CH-002
- 목록에서 방 선택(→ ChatScreen 마운트, 방 = RoomSummary) → 제목·생성일(→ 말풍선 표시) → ⋯ 없음(→ 같은 화면) → 레이블·포커스 순서(→ 같은 화면) → ‹ 뒤로(→ 목록·기록 삭제)

### TC-FLOW-CH-02 · U-CH-02 대화 읽기 · Steps: TC-CH-004 → 분기: TC-CH-007 | TC-CH-008 | TC-CH-009 | TC-CH-010 → TC-CH-028
- 첫 로드(→ 말풍선 4건). 분기: 4건을 변형별로 나눠 본다(캐릭터 · 유저 · OOC · 변형 판정 함수, 서로 인계 없음). 이어서 같은 화면을 390×565로 시각 확인

### TC-FLOW-CH-03 · U-CH-03 오래된 대화 거슬러 읽기 · Steps: TC-CH-011 → 분기: ① TC-CH-012 ② TC-CH-014 · 대기 중 확인: TC-CH-013
- 맨 위 도달(→ before 요청, B0 로딩). 분기 ① 응답 성공 → 앞붙임·읽던 자리 유지 ② 응답 실패 → B0 오류·버튼 재시도. 대기 중 확인: 요청이 끝나기 전 scroll이 이어져도 중복 없음, `hasMore=false`면 요청 종료

### TC-FLOW-CH-04 · U-CH-04 닫았다 다시 열기 · Steps: TC-CH-024 → TC-CH-025 → TC-RM-008 → TC-RM-012(a) · 분기: TC-CH-026
- 진입 시 기록(→ `ld:lastRoomId='r1'`) → 언마운트·pagehide 시 거리 저장(→ `ld:scroll:r1`) → 다시 열면 자동 진입(→ chat r1, 거리 복원) → ‹ 뒤로면 기록 삭제·재마운트 시 목록. 분기(독립 Given): 저장소 접근이 모두 throw하는 브라우저에서도 같은 화면이 동작

### TC-FLOW-CH-05 · U-CH-05 쓰기 UI 부재·안내 · Steps: TC-CH-003 → TC-CH-021 → TC-CH-022 → TC-CH-023 · 분기: TC-CH-025(e)
- 말풍선이 보이는 같은 화면을 이어서 확인: ⋯ 없음 → 하단 바 없음 → 말풍선 우클릭·길게 누름 뒤에도 메뉴 없음(→ 화면 변화 없음) → 열람 안내. 분기(독립 Given): 언마운트 뒤 저장 키에 토큰 없음

### TC-FLOW-CH-06 · U-CH-06 위를 읽는 중 새 메시지(상태 모델) · Steps: 분기: TC-CH-016 | TC-CH-018 | TC-CH-019 | TC-CH-020
- S1에는 새 메시지 발생 경로가 없어 층별로 독립 확인한다: 리듀서(unseen 가산·초기화) | 훅 뒤붙임(위쪽이면 스크롤 유지) | 배지 표시·클릭 | 맨 아래 도달 해제. 순차 체인은 S2·S3에서 발생 경로와 함께 만든다

### TC-FLOW-CH-07 · U-CH-07 등급 통과 회원(토큰 있음) S1 기간 · Steps: TC-RM-012(c) → TC-CH-004 → TC-CH-021 → TC-CH-023 · **S1 기간 한정 — S2에서 TC-FLOW-CH-13으로 대체**(CF-01)
- URL에만 `?t=`가 있고 `initToken`을 부르지 않은 App으로 방 진입(→ READ_ONLY_VIEWER chat) → 같은 히스토리(→ 말풍선 표시) → 하단 바 없음 → 열람 안내. S2에서는 "initToken 미호출이면 읽기 전용"이라는 회귀 확인으로만 남는다

### TC-FLOW-CH-08 · U-CH-08 대사·지시 전송 → 뒤붙임·자동 스크롤(S2) · Steps: TC-RM-027(a) → TC-CH-031 → TC-CH-032 → TC-CH-033 → TC-CH-034 → TC-CH-038 · 분기: TC-CH-035 | TC-CH-036 | TC-CH-037 · 시각: TC-CH-061
- 토큰으로 App 시작 → 방 진입(→ 하단 바 렌더) → 빈 입력이면 전송 잠김(→ 입력) → `안녕` 전송(→ `appendUser` 1회·AI 호출 없음, 가운데 유저 말풍선 `미샤`(CR-001), 입력 비움) → OOC 켜고 지시 전송(→ 중앙 말풍선, OOC 유지) → 맨 아래면 자동 스크롤, 위를 보는 중이면 배지 → 배지 클릭으로 맨 아래. 분기: Enter·IME | 연타 1회 | 실패 문구(429 포함)

### TC-FLOW-CH-09 · U-CH-10 말풍선 수정·삭제(S2) · Steps: TC-CH-039 → TC-CH-040 → TC-CH-042 → TC-CH-043 → TC-CH-039 → TC-CH-045 · 분기: TC-CH-041 | TC-CH-044 | TC-CH-046 | TC-CH-054
- 롱프레스·우클릭·Shift+F10으로 메뉴(→ 머리·항목) → 수정(→ 인라인 편집기) → 저장(→ 본문 교체, 히스토리 포커스) → 다른 말풍선 메뉴 → 삭제 확인(→ 말풍선 제거). 분기: 닫기·포커스 복귀 | 수정 실패·취소 | 삭제 실패·이미 없음·빈 결과 재로드 | 쓰기 대기 중 메뉴 막힘

### TC-FLOW-CH-10 · U-CH-11 이름 변경·방 삭제 → 목록 복귀(S2) · Steps: TC-CH-047 → TC-CH-048 → TC-CH-065 · TC-CH-047 → TC-CH-050 → TC-CH-064 · 분기: TC-CH-049 | TC-CH-054(c)
- ⋯ 방 메뉴(→ 항목) → 이름 변경 성공(→ 상단 제목 갱신, 재마운트 없음) → ‹ 뒤로(→ 목록 재요청, 새 이름 행). 또는 ⋯ → 방 삭제 확인(→ 기록 삭제, `onBack`) → App 목록 재요청(→ 지운 방 없음). 분기: 이름 변경 실패는 시트 안 문구 | 이름 변경 대기 중 ⋯ 잠김

### TC-FLOW-CH-11 · U-CH-12 쓰기 거절 → 안내·읽기 전용 전환(S2) · Steps: TC-CH-031 → TC-CH-051(a)(체인 끝 = ‹ 뒤로 → rooms에도 「새 방 만들기」 없음) · 전환 후 부재 분기: TC-CH-003 | TC-CH-021 | TC-CH-022 | TC-CH-023(CF-03, 같은 부재 상태를 독립 확인) · 그 밖 분기: TC-CH-037(429) | TC-CH-049(LEVEL_TOO_LOW) | TC-CH-052 | TC-CH-051(b) | TC-RM-024
- 쓰기 판(→ 하단 바) → 전송이 인증 실패(→ 토큰 비움, 같은 화면 쓰기 UI 제거, 안내 토스트 1회, ‹ 포커스) → 이후 화면은 읽기 전용 판과 같다(⋯ 없음 → 하단 바 없음 → 메뉴 없음 → 열람 안내). 분기: 429는 안내만·전환 없음 | 이름 변경 중 인증 실패 | 편집기·확인 시트가 열린 채 전환 | 두 번째 인증 실패는 다시 알리지 않음 | rooms에서 생성 중 전환

### TC-FLOW-CH-12 · U-CH-06 위를 읽는 중 내 발화(S2 순차 체인) · Steps: TC-CH-033 → TC-CH-038(b) → TC-CH-016(T9·T11)
- S1 TC-FLOW-CH-06의 층별 확인을 S2 발생 경로로 잇는다: 전송 성공(→ 응답 Message) → 위쪽이면 스크롤 유지·배지 → 배지 클릭(→ 맨 아래, unseen 0). 리듀서 근거는 T9·T11

### TC-FLOW-CH-13 · U-CH-07 등급 통과 회원 읽기 + 쓰기(S2) · Steps: TC-RM-027(a) → TC-CH-004 → TC-CH-031
- 토큰 있는 App에서 방 진입(→ 같은 히스토리) → 쓰기 UI 렌더(⋯·하단 바·말풍선 메뉴). 읽기 기능은 S1 FLOW-CH-01~04와 같다

## 추적표

### 요구 ↔ TC

| 요구ID | TC | 비고 |
|---|---|---|
| R-CHAT-001 🔒 | TC-CH-001 · 002 · 003 | ⋯ 메뉴 렌더는 S2 |
| R-CHAT-002 🔒 | TC-CH-004 · 006 · 007 · 008 · 009 · 010 · 028 · 030 | 수용 기준 "스크린샷" = 028 |
| R-CHAT-003 🔒 | TC-CH-004 · 005 · 011 ~ 020 · 029 | 새 메시지 실제 발생은 S2·S3. 029는 회귀 방지용 |
| R-CHAT-004 🔒 | TC-CH-021(부재 쪽) | 렌더 쪽 S2 |
| R-CHAT-005 🔒 | — 후속(S3) | |
| R-CHAT-006 🔒 | — 후속(S2) | |
| R-CHAT-007 🔒 | TC-CH-022(부재 쪽) | 메뉴 동작 S2·S3 |
| R-CHAT-008 🔒 | TC-CH-003 · 021 · 022 · 023 | |
| R-CHAT-009 🔒 | — 후속(S2). S1 토큰 비저장은 R-NFR-004 행 | |
| R-CHAT-010 | TC-CH-006 · 017 · 024 · 025 · 026 | |
| R-CHAT-011 | — 후속(S2·S3) | |
| R-CHAT-012 🔒 | — 후속(S4) | |
| R-CHAT-013 🔒 | TC-CH-001 · 023 · 027 · 028(수동) | 쓰기 판 스크린샷 S2 |
| R-LLM-002 🔒 | TC-CH-007 | `shortName`·아바타 경로 |
| R-MSG-001 🔒 | TC-CH-004 · 011 · 016 | before·hasMore·nextBefore |
| R-NFR-004 🔒 | TC-CH-025(e) · TC-RM-010 · TC-RM-012(c) | 리뷰 grep은 verify 단계 자동 grep으로 이관(메인 세션 기록), 수동 `MC-CH-09`는 보조 |
| R-ROOMS-004 | TC-CH-002 · 024 | 기록·삭제 시점 |

### 설계 항목 ↔ TC

| 설계 항목 | TC |
|---|---|
| §2.1 A 상단 바 | TC-CH-001 · 002 · 003 |
| §2.1 B 상태 변형(error → loading → data → empty) | TC-CH-004 · 005 · 006 |
| §2.1 B0 로딩·오류 변형 | TC-CH-011 · 014 |
| §2.1 B1 배지 | TC-CH-019 |
| §2.1 D 열람 안내 | TC-CH-023 |
| §2.2 토큰 있음 슬롯(미렌더) | TC-CH-003 · 021 · 022 |
| §2.3 세로·가로 배분 · ≤360 날짜 숨김 · 말풍선 폭 | TC-CH-028 |
| §3.1 ChatScreen | TC-CH-001 ~ 006 · 021 ~ 027 · 029 · 030 |
| §3.1 TopBar(variant room · subtitle) | TC-CH-001 · 003 |
| §3.1 IconButton(back) | TC-CH-002 · 027 |
| §3.1 StateView | TC-CH-004 · 005 · 006 · 030 |
| §3.1 MessageList | TC-CH-011 · 014 · 019 |
| §3.1 InlineStatus | TC-CH-011 · 014 |
| §3.1 Bubble | TC-CH-007 · 008 · 009 · 010 |
| §3.1 NewMessageBadge | TC-CH-019 |
| §3.1 ReadOnlyNotice | TC-CH-023 |
| §3.2 useAutoScroll | TC-CH-011 · 012 · 018 · 019 · 020 · 025 |
| §3.2 useChatLoader | TC-CH-004 · 005 · 011 · 013 · 014 · 029 |
| §3.2 state/chat.ts · state/scroll.ts | TC-CH-015 · 016 · 017 |
| §3.2 viewer | TC-CH-003 · 021 · 023 |
| §3.2 비고: 본문 일반 텍스트(dangerouslySetInnerHTML 금지) | TC-CH-008 |
| F §1 ChatState·초기값·액션 8종 | TC-CH-015 · 016 |
| F §1.1 T1 ~ T8 | TC-CH-015 |
| F §1.1 T9 ~ T12 | TC-CH-016 |
| F §1.2 mergeMessages · canLoadOlder · canAutoLoadOlder · nextBefore | TC-CH-016 |
| F §2 scroll.ts 임계·함수 5종 | TC-CH-017 |
| F §3 initialDistance | TC-CH-025 |
| F §3 olderInFlightRef | TC-CH-013 |
| F §3 isActiveRef | TC-CH-029 — 회귀 방지용, React 19에서 판별력 없음(TK-02) |
| F §3 stateRef(최신 상태 읽기) | TC-CH-011(c) · 013 · 014 |
| F §3 backButtonRef | TC-CH-002 · 027 |
| F §3 autoScroll 배선 | TC-CH-011 · 012 · 025 |
| F-CH-01 ChatScreen 렌더 | TC-CH-001 · 003 · 021 · 023 |
| F-CH-02 마운트 effect | TC-CH-002 · 004 · 024 |
| F-CH-03 loadInitial | TC-CH-004 · 005 · 029 |
| F-CH-04 retryInitial | TC-CH-005 |
| F-CH-05 loadOlder | TC-CH-011 · 012 · 013 · 029 |
| F-CH-06 retryOlder | TC-CH-014 |
| F-CH-07 clearUnseen | TC-CH-016(T11·T12) · 020 |
| F-CH-08 showNewest | TC-CH-019(부품 분해, 조립 TC는 S2) |
| F-CH-09 스크롤 저장 effect(pagehide 등록·cleanup 해제·save 1회) | TC-CH-006 · 025(b)(c)(d)(f) · 029 |
| F-CH-10 back | TC-CH-002 · 024 |
| F-CH-11 renderHistory | TC-CH-004 · 005 · 006 · 030 |
| F-CH-12 chatReducer 외 | TC-CH-015 · 016 |
| F-CH-13 scroll.ts | TC-CH-017 |
| F-CH-14 useAutoScroll | TC-CH-011 · 012 · 018 · 019 · 020 · 025 |
| F-CH-15 bubbleVariantOf | TC-CH-010 |
| C §2.1 MessageList 렌더 규칙(role log · aria-busy · B0가 ol보다 앞 · 배지 박스 밖) | TC-CH-011 · 014 · 019 · 027 |
| C §2.2 Bubble 3변형·DOM 순서·캐릭터 색 클래스 | TC-CH-007 · 008 · 009 |
| C §2.2 롱프레스·onContextMenu 미연결 | TC-CH-022 |
| C §2.3 InlineStatus | TC-CH-011 · 014 |
| C §2.4 NewMessageBadge | TC-CH-019 |
| C §2.5 ReadOnlyNotice | TC-CH-023 |
| C §3 첫 배치·앞붙임·뒤붙임·동시·onScroll·scrollToBottom | TC-CH-025 · 011 · 012 · 018 · 020 · 019 |
| C §4 스타일 토큰 | TC-CH-028 |
| §6.1 첫 진입 파이프라인 | TC-CH-004 · 025 · 011(c) |
| §6.2 이전 페이지 파이프라인 | TC-CH-011 · 012 · 013 |
| §6.3 새 메시지 파이프라인(상태·훅) | TC-CH-016 · 018 · 019 · 020 |
| §6.4 오류 표 5행 | TC-CH-005 · 030 · 014 · 026 · 029 |
| §6.4 마지막 본 방 기록·삭제·pagehide | TC-CH-024 |
| §7 계약 사용표(첫 페이지·이전 페이지·CHARACTERS) | TC-CH-004 · 011 · 014 · 007 |
| §8.1 문구 16키 | `screenAriaLabel`·`createdAtAriaLabel` 001 · `backAriaLabel` 002 · `historyAriaLabel` 027 · `loading` 004 · `empty` 006 · `loadError`·`retry` 005 · `olderLoading` 011 · `olderError` 014 · `oocPrefix`·`oocDecor` 009 · `unknownAuthor` 008 · `newMessages`·`newMessagesAriaLabel` 019 · `readOnlyNotice` 023 |
| §8.2 errorDetail | TC-CH-030 · 005 |
| A 랜드마크·제목·마운트 포커스·포커스 순서·키보드(Tab)·히스토리 역할·상태 알림·버튼 레이블·이미지 alt·장식 | TC-CH-001 · 002 · 027 · 011 · 014 · 023 · 019 · 007 · 009 |
| A 화자 구분·대비·포커스 링·모션 | TC-CH-007 · 008 · 028 |
| §10 읽기 전용 분기 7행 | TC-CH-003 · 021 · 022 · 023 |
| §13 CR-C-1 shortName(반영 완료) | TC-CH-007 |
| §12 공용화 후보 · §14 후속 묶음 | 비행동 항목 — TC 대상 아님(판정 기록 · 후속 이월) |

### 사용자행 ↔ TC-FLOW

| 사용자행 | TC-FLOW | 묶음 |
|---|---|---|
| U-CH-01 | TC-FLOW-CH-01 | S1 |
| U-CH-02 | TC-FLOW-CH-02 | S1 |
| U-CH-03 | TC-FLOW-CH-03 | S1 |
| U-CH-04 | TC-FLOW-CH-04 | S1 |
| U-CH-05 | TC-FLOW-CH-05 | S1 |
| U-CH-06(토큰 있음) | TC-FLOW-CH-12(S2 순차 체인) · TC-FLOW-CH-06(S1 상태·훅 층별) | S1 · S2(speak 경로 S3) |
| U-CH-07(토큰 있음) | TC-FLOW-CH-13(S2) · TC-FLOW-CH-07(S1 기간 한정) | S1 · S2 |
| U-CH-08(전송) | TC-FLOW-CH-08 | S2 |
| U-CH-09(캐릭터 한 턴) | — 후속 이월 | S3 |
| U-CH-10(수정·삭제) | TC-FLOW-CH-09 | S2(재작성 S3) |
| U-CH-11(이름 변경·방 삭제) | TC-FLOW-CH-10 | S2(장기기억 S4) |
| U-CH-12(쓰기 거절·전환) | TC-FLOW-CH-11 | S2(SPEAK_IN_PROGRESS·LLM_FAILED S3) |

## 추적표 — S2 추가분 (v0.4)

위 S1 표의 "S2" 후속 칸은 이 절로 닫는다. Bearer 헤더 부착은 래퍼 몫(api 스펙 API-T-UI-011~013)이고, 화면 TC는 래퍼를 계약 인자로 부르는지·화면이 토큰을 만지지 않는지를 단언한다.

### 요구 ↔ TC (S2)

| 요구ID | TC | 비고 |
|---|---|---|
| R-CHAT-001 🔒(⋯·이름 변경·방 삭제) | TC-CH-031 · 047 · 048 · 049 · 050 · 054(c) · 055 · 056 · 057 · 063 · 064 · 065 | 장기기억 항목은 S4 |
| R-CHAT-003 🔒(새 메시지 실제 경로) | TC-CH-038 · 053 | |
| R-CHAT-004 🔒(OOC·입력·전송) | TC-CH-031 · 032 · 033 · 034 · 035 · 058 · 059 · 061 | 캐릭터 버튼 S3(031에서 부재 단언) |
| R-CHAT-006 🔒(전송·AI 호출 없음) | TC-CH-033 · 034 · 036 · 037 · 038 · 053 · 054 · 063 | |
| R-CHAT-007 🔒(수정·삭제) | TC-CH-039 ~ 046 · 052 · 053 · 054 · 055 · 056 · 060 · 063 | 재작성 S3(040에서 부재 단언) |
| R-CHAT-008 🔒(쓰기 판 쌍·전환) | TC-CH-031 · 051 · 052 | 부재 쪽 S1 003·021·022·023 |
| R-CHAT-009 🔒 · R-API-003 🔒 | TC-CH-051 · 062 · TC-RM-027 · 028 | |
| R-CHAT-011(인증 3종·429) | TC-CH-037 · 044 · 046 · 049 · 050 · 051 · 052 · 053 | SPEAK_IN_PROGRESS·LLM_FAILED S3 |
| R-CHAT-013 🔒(쓰기 판) | TC-CH-031 · 035 · 036 · 039 · 041 · 058 · 061 | |
| R-LLM-002 🔒(메뉴 머리 이름) | TC-CH-040 | |
| R-MSG-002 · 004 · 005 🔒(데이터) | TC-CH-032 · 033 · 042 · 043 · 045 · 046 | |
| R-ROOM-003 · 004 🔒(데이터) | TC-CH-048 · 050 · 064 · 065 | |
| R-AUTH-004(작성자명) | TC-CH-033 | |
| R-NFR-004 🔒(화면 쪽) | TC-CH-062 · 033(저장 키) | |
| R-ROOMS-004(방 삭제 시 기록 삭제) | TC-CH-050 · 064 | |

### 설계 항목 ↔ TC (S2)

| 설계 항목 | TC |
|---|---|
| §2.2 토큰 있음 판(A ⋯ · C · E · 시트 4종) | TC-CH-031 · 037 · 039 · 047 · 048 · 050 · 061 |
| §2.3 C·E 높이, ≤480 1줄 | TC-CH-058 · 061 |
| §3.1 트리 S2(Composer · InlineEditor · MessageMenuSheet · RoomMenuSheet · ChatSheets · Toast) | TC-CH-031 · 042 · 040 · 047 · 048 · 050 · 037 |
| §3.2 공용 신규 부품·훅 | TC-CH-055 ~ 060 · TC-RM-032 |
| §3.2 useMessageWrites · useRoomActions | TC-CH-033 · 043 · 045 · 046 · 048 · 050 · 063 |
| F §1 S2 필드·액션 7종 · T1 비고 · T13~T26 · `canSend` | TC-CH-053 |
| F §3 `sheet` · `toast` · `menuButtonRef` · `writeInFlightRef` · `roomBusy` · `wasWritableRef` · `revokedRef` | TC-CH-039 · 037 · 047 · 036 · 054 · 052 · 051(b) |
| F-CH-11 v1.5 `editingId` canWrite 조건 | TC-CH-052 |
| F-CH-16 handleWriteFailure(멱등 v1.5) | TC-CH-037 · 049 · 051 |
| F-CH-17 send | TC-CH-033 · 034 · 036 · 038 |
| F-CH-18 openMessageMenu(쓰기 대기 중 무시 v1.5) | TC-CH-039 · 054 |
| F-CH-19 startEdit | TC-CH-042 |
| F-CH-20 saveEdit | TC-CH-043 · 044 |
| F-CH-21 cancelEdit | TC-CH-044 |
| F-CH-22 askDeleteMessage | TC-CH-045 |
| F-CH-23 confirmDeleteMessage(`RemoveResult` 3분기) | TC-CH-045 · 046 · 054 |
| F-CH-24 openRoomMenu(대기 중 무시) | TC-CH-047 · 054 |
| F-CH-25 askRename·askDeleteRoom | TC-CH-048 · 050 |
| F-CH-26 rename | TC-CH-048 · 049 · 065 |
| F-CH-27 confirmDeleteRoom | TC-CH-050 · 063 · 064 |
| F-CH-28 closeSheet | TC-CH-041 · 047 |
| F-CH-29 전환 effect | TC-CH-051 · 052 |
| F-CH-30 focusLog | TC-CH-043 · 044 · 045 |
| C §2.0 ChatTopBar `onOpenMenu`·`menuButtonRef`·`isMenuDisabled` | TC-CH-031 · 047 · 054 |
| C §2.1 MessageList S2 props(`onOpenMenu`·`editingId`·`isEditSaving`) | TC-CH-031 · 042 · 043 |
| C §2.2 Bubble 메뉴 핸들러·`menuEnabled`·tabIndex·aria | TC-CH-031 · 039 · 041 |
| C §2.6 Composer | TC-CH-031 ~ 038 |
| C §2.7 InlineEditor | TC-CH-042 · 043 · 044 |
| C §2.8 MessageMenuSheet | TC-CH-040 · 054(d) |
| C §2.9 RoomMenuSheet | TC-CH-047 |
| C §2.10 ChatSheets 5종 분기 | TC-CH-039 · 045 · 047 · 048 · 050 |
| C §3 v1.5 빈 목록 재배치(맨 아래) · 뒤붙임 | TC-CH-046(c) · 038 |
| C §4 S2 스타일 행 | TC-CH-061 |
| §6.3 ~ §6.6 파이프라인 | TC-CH-033 · 038 / 039 ~ 046 / 047 ~ 050 / 037 · 051 |
| §6.7 늦은 응답 행(쓰기) | TC-CH-063 |
| §7 계약 사용표 쓰기 6종 + `isAuthFailure`·`retryAfterSec` | TC-CH-033 · 043 · 045 · 048 · 050 · 037 · 051 · TC-RM-021 |
| §8.1.1 S2 문구 22키 | `moreAriaLabel` 031·047 · `composerAriaLabel`·`inputAriaLabel`·`inputPlaceholder`·`send`·`oocAriaLabel`·`oocOn`·`oocOff` 031·034 · `messageMenuAriaLabel`·`messageMenuHeader`·`edit`·`delete`·`cancel` 039·040 · `save`·`editAriaLabel`·`editInputAriaLabel` 042 · `deleteMessageTitle`·`deleteMessageBody` 045 · `roomMenuAriaLabel`·`roomMenuHeader`·`rename`·`deleteRoom` 047 · `renameTitle`·`renameInputAriaLabel` 048 · `deleteRoomTitle`·`deleteRoomBody` 050 |
| §8.3 writeErrorText 11행 | 인증 3행 051 · RATE_LIMITED 2행 037 · VALIDATION 2행 037·049 · NOT_FOUND 2행 037·049·044 · NETWORK 037 · 그 밖 037·044·046·050 |
| §10 읽기 전용 분기 12행 | TC-CH-031(있음) ↔ S1 003·021·022·023(없음) · 051 · 052 |
| §11.2 D-5 · D-6 · D-7 · D-8 · D-9 · D-10 · A-4 · A-5 | 054 · 046·050 · 049·050 · 051 · 051 · 054·051(b) · 061 · 050(비행동 기록) |
| A(S2) 포커스 순서·키보드·시트·상태 알림·전환 | TC-CH-035 · 039 · 041 · 036 · 051 · 058 |
| §12 공용화 후보 · §13 CR-C-2 · §14 S3·S4 | 비행동 항목 — TC 대상 아님 |

## 후속 이월 (S2에서 만들지 않는 TC)

| 대상 | 묶음 | 이유 | 그때 만들 것 |
|---|---|---|---|
| 세바스찬·시엘 버튼 렌더 쌍 · speak 호출 인자 · OOC 전송 시 speak 미호출 | S3 | 설계 §14 슬롯만(TC-CH-031이 부재 단언) | 토큰 있음 렌더, `speak` 래퍼 인자, OOC 전송 뒤 speak 0회 |
| 생성 중 "…" 임시 말풍선·버튼 잠금·실패 말풍선·재시도 | S3 | R-CHAT-005 후속 | 가짜 시계·잠금 해제·오류 말풍선 |
| 재작성 메뉴 항목 | S3 | R-CHAT-007 후속(TC-CH-040이 부재 단언) | 캐릭터·마지막 메시지 조건, `messageReplaced` |
| `SPEAK_IN_PROGRESS`·`LLM_FAILED`·`LLM_EMPTY` 문구 | S3 | §8.3 행 추가 예정 | `writeErrorText` 확장 TC |
| 장기기억 메뉴 항목 | S4 | R-CHAT-012 | 방 메뉴 항목·요약 화면 |

## 변경 대기열(미검증)

| Q-nn | 일자 | CR-ID | 변경 요약 | 변경 파일 | 영향 TC 후보 | 신규 TC 필요 | 상태 |
|---|---|---|---|---|---|---|---|
| Q-01 | 2026-10-05 | —(메인 세션 결정 TK-05, S1 불변 예외 승인) | S2에서 `ChatScreen` props `onAuthFailure`·`onRoomRenamed`가 필수가 되어 S1 스펙 렌더 도우미 2곳에 빈 콜백 `vi.fn()`을 더함. S1 단언은 바꾸지 않음 | `ui/src/chat/test/ChatScreen.test.tsx` · `ui/src/chat/test/ChatScroll.test.tsx`(renderChat) | TC-CH-001 ~ 006 · 011 ~ 014 · 021 ~ 027 · 029 · 030(같은 렌더 도우미) | 없음(단언 불변) | 전환됨(위 TC 스펙 렌더 도우미) |
| Q-02 | 2026-10-05 | —(메인 세션 결정, S1 불변 예외 승인) | 상태 모델 S2 확장으로 TC-CH-015 초기값 단언을 9필드로(`writing`·`editingId` = null) | `ui/src/state/chat.test.ts` · 이 문서 TC-CH-015 Then | TC-CH-015 | 없음(TC-CH-053이 S2 전이 담당) | 전환됨(TC-CH-015) |
| Q-03 | 2026-10-05 | CR-001 | R-CHAT-002 개정(🔒 사용자·지인): 세바스찬 왼쪽 · 시엘 오른쪽 · 유저 가운데 말풍선 · OOC 가운데 한 줄. `BubbleVariant`·루트 클래스 키 변경(설계 v1.6 C §2.2) | `ui/src/chat/test/Bubble.test.tsx` · 이 문서 TC-CH-007~010·028 · `manual-checklist.md` MC-CH-02 | TC-CH-007 · 008 · 009 · 010 · 028 | 없음(기존 TC 갱신, 009에 유저·OOC 구분 쌍 단언 추가) | 전환됨(TC-CH-007~010 · 028) |
| Q-04 | 2026-10-06 | —(메인 세션 결정, S1 불변 예외 승인) | 설계 C §2.1 S2 필수 props(`editingId`·`isEditSaving`·`onSaveEdit`·`onCancelEdit`)가 S1 스펙 렌더 도우미에 빠져 `tsc -p ui` 오류 → 기본값(`null`·`false`·`vi.fn()`×2) 추가. 단언 변경 없음 | `ui/src/chat/test/MessageList.test.tsx`(renderList) | TC-CH-011 · 014 · 019(같은 렌더 도우미) | 없음(단언 불변) | 전환됨(TC-CH-011 · 014 · 019 스펙 렌더 도우미) |

### 변경이력 보충 — v0.5 (2026-10-05)

CR-001 반영(Q-03): TC-CH-007~010을 4종 배치로 갱신(S1 TC 변경 예외 승인), TC-CH-028·MC-CH-02 배치 문구 갱신, FLOW-CH-08 "가운데 유저 말풍선". ui-test-conflict-checker 반영: CF-01 TC-FLOW-CH-07 "S1 기간 한정 — FLOW-CH-13으로 대체", 사용자행 U-CH-06·07 중복 행 통합 · CF-02 TC-FLOW 머리에 "ⓒ 호출 횟수는 단계 증분" 규약 · CF-03 FLOW-CH-11 체인을 031 → 051(a)로 줄이고 003~023은 `분기:` · CF-04 TC-CH-065 Given에 지역 픽스처 updatedAt 10.05 명시 · CF-05 TC-CH-051(b) 같은 토스트 요소 단언.

ui-test-checker S2 판정 FAIL 지적 반영: TC-CH-038 내용 높이 mock을 "새 말풍선 커밋 뒤에만 3200"으로(TK-01, Given 갱신) · TC-CH-060 오른쪽 버튼은 `pointerdown(button 2)` 직접 발송, contextmenu 1회는 별도 it(TK-02) · TC-CH-052 (b) ‹ 포커스 단언 추가(TK-07) · S1 렌더 도우미 빈 콜백(Q-01, TK-05) · TC-CH-015 초기값 9필드(Q-02) · danger 클래스 키 확정(TK-09) · 확인표 v0.2(TK-08). 근거: ui-test-checker TK-01~09 · 메인 세션 결정 TK-05·TK-09

## 변경이력

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v0.1 | 2026-10-05 | 최초 작성(신규 모드). TC-CH-001~030, TC-FLOW-CH-01~07, 추적표 3종, 스펙 초안 7개 | 구축 S1, design.md v1.1 RTM |
| v0.2 | 2026-10-05 | TC-CH-025 (f) pagehide 리스너 해제 단언 추가. TC-CH-005 재시도 중간 loading 단언. TC-CH-011·014 B0가 `ol`보다 앞(부품 단위). TC-CH-024 요구에서 R-NFR-004 제거, TC-CH-030 요구를 R-CHAT-002로 정정, 요구↔TC 표 맞춤. TC-CH-029 회귀 방지 비고. TC-FLOW 표기 규약(순차 `→` / `분기:`) 도입, FLOW-CH-01~07 재작성. 공통 전제에 named export·Bubble 클래스 키 명시 | ui-test-checker TK-01 ~ TK-07 |
| v0.3 | 2026-10-05 | TC-CH-011 (c) 픽스처를 계약 가능한 첫 페이지(31~60, 30건, hasMore=true)로 바꾸고 기대를 `before: 31`로 정정. 공통 전제에 스크롤 mock 비클램프·판정 대기 규칙 명시, ChatScroll 스펙의 "호출 없음·횟수 유지" 판정 앞에 `flushPending()` 추가(TC-CH-011 (b)(c)·013·014) | ui-test-conflict-checker CF-02 · CF-03 · CF-05 |
| v0.4 | 2026-10-05 | **S2 증분**: S2 공통 전제(토큰 주입 = `viewer` props / App은 `initToken`·`clearToken`, 쓰기 래퍼 모킹·AI 호출 없음 판정, `matchMedia` 스텁, 롱프레스·토스트 가짜 시계). TC-CH-031~065 추가(tc.md v1.5 반영: 033 단언 범위·046 재로드 맨 아래·054 메뉴 진입 막힘·064·065 App 흐름), TC-FLOW-CH-08~13 추가, 사용자행 U-CH-06~12 연결, F-CH-08 조립(038)·FLOW-CH-06 순차 체인(FLOW-CH-12) 이월 해소. 「후속 이월」을 S3·S4만 남기고 「추적표 — S2 추가분」 신설. 스펙 신규 `Composer`·`BubbleMenu`·`RoomMenu`·`AuthTransition`·공용 부품 6종, `ui/src/state/chat.test.ts` 확장. S1 TC-CH-001~030 변경 없음 | 구축 S2, design.md v1.5 · tc.md v1.5 |
