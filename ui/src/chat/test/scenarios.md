# chat(대화) 테스트 시나리오

- 기준: `ui/src/chat/design.md` v1.1(+ `design/components.md` · `design/functions.md` · `design/a11y.md`) / `ui/src/chat/requirements.md` v1.1 / `doc/200_설계/contract/api.md` v0.2 / 공용 요소 단일 정의 `ui/src/rooms/design/components.md` §1
- 작성일: 2026-10-05 · 작성: ui-test-designer · 모드: 신규 · 상태: **초안 v0.3(검증·모순 검사 지적 반영, 재검증 대기)**
- 묶음: **S1(읽기 전용 판)**. S1 화면은 토큰을 읽지 않으므로 모든 TC의 토큰 분기는 "없음"(READ_ONLY_VIEWER)이다. 쓰기 UI 렌더 쌍은 S2·S3에서 추가한다(아래 「후속 이월」).
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

### TC-CH-007 · 캐릭터 말풍선 · 종류: 자동 · 요구: R-CHAT-002 · R-LLM-002 · 설계: C §2.2 `character` 행 · §7 CHARACTERS · A 이미지 · C §4 · 토큰: 없음
- Given 시엘 line 16:40 / 세바스찬 line 09:05
- When Bubble을 렌더한다
- Then ⓐ `character` + `ciel`(또는 `sebastian`) 클래스, `img src="/embed/img/ciel.png" alt=""`(세바스찬은 `/embed/img/sebastian.png`), 이름 `시엘`·`세바스찬`(전체 이름 `시엘 팬텀하이브`·`미카엘리스` 없음), `<time dateTime="2026-10-05T16:40">16:40</time>`, DOM 순서 아바타 → 이름 → 시각 → 본문 ⓑ 표시 전용 — 상태 변경 없음 ⓒ `listMessages` 미호출
- 스펙: `ui/src/chat/test/Bubble.test.tsx`

### TC-CH-008 · 유저 말풍선 · 종류: 자동 · 요구: R-CHAT-002 · 설계: C §2.2 `user` 행 · §3.2 비고(일반 텍스트) · §8.1 `unknownAuthor` · 토큰: 없음
- Given 유저 line(미샤 16:42) / `authorName=null` / 본문 `<b>굵게</b>`
- When Bubble을 렌더한다
- Then ⓐ `user` 클래스(`character` 아님), 아바타 없음, DOM 순서 작성자명 → 시각(16:42) → 본문. null이면 `이름 없음`. 본문 `<b>`가 요소로 해석되지 않고 글자 그대로 ⓑ 상태 변경 없음 ⓒ `listMessages` 미호출
- 스펙: `Bubble.test.tsx`

### TC-CH-009 · OOC 말풍선 · 종류: 자동 · 요구: R-CHAT-002 · 설계: C §2.2 `ooc` 행 · §8.1 `oocPrefix`·`oocDecor` · A 장식 · 토큰: 없음
- Given 유저 ooc `둘이 체스를 둔다`(미샤 16:43)
- When Bubble을 렌더한다
- Then ⓐ `ooc` 클래스, 텍스트에 `[지시]`가 본문보다 앞, `—` 장식 2개가 `aria-hidden="true"`, 작성자명 `미샤` 없음, 아바타 없음, 시각 `16:43` ⓑ 상태 변경 없음 ⓒ `listMessages` 미호출
- 스펙: `Bubble.test.tsx`

### TC-CH-010 · 변형 판정 · 종류: 자동 · 요구: R-CHAT-002 · 설계: F-CH-15 `bubbleVariantOf` · C §2.2 판정 순서 · 토큰: 무관
- Given speaker × kind 6조합, 그리고 시엘 ooc 메시지
- When `bubbleVariantOf`를 부르고 Bubble을 렌더한다
- Then ⓐ 시엘 ooc 렌더는 `ooc` 클래스, 아바타·`시엘` 이름 없음 ⓑ user/line → `user`, */ooc → `ooc`, ciel·sebastian/line → `character` ⓒ api 호출 없음(순수 함수)
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
- Then ⓐ 해당 없음(순수 함수) ⓑ 초기값 7필드 일치. T1 → 초기값. T2 → ready·정렬·중복 제거·hasMore. T3 → error·나머지 초기값. T4 → isLoadingOlder true·olderError null. T5(4가지 불충족) → 같은 참조. T6 → 앞 합침·hasMore·로딩 해제, 빈 페이지면 hasMore false. T7 → 같은 참조. T8 → 로딩 해제·olderError·말풍선 유지 ⓒ api 호출 없음
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
- Then ⓐ 가로 스크롤 없음, A 44·D 28, 화자 정렬(캐릭터 왼쪽·유저 오른쪽·OOC 중앙)·색·아바타 28px, 읽던 자리 유지 체감 ⓑ 해당 없음(시각 확인) ⓒ 해당 없음 — 수동 확인표 `MC-CH-01~08`
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

## TC-FLOW

S1 행만 만든다. 표기: `A → B`는 **순차 인계**(A의 결과 상태가 B의 Given). `분기:`는 같은 지점에서 갈라지는 **대안·독립 확인**(서로 상태를 넘기지 않는다).

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

### TC-FLOW-CH-07 · U-CH-07 등급 통과 회원(토큰 있음) S1 기간 · Steps: TC-RM-012(c) → TC-CH-004 → TC-CH-021 → TC-CH-023
- `?t=` 주소로 열어 방 진입(→ READ_ONLY_VIEWER chat) → 같은 히스토리(→ 말풍선 표시) → 하단 바 없음 → 열람 안내

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
| U-CH-06(토큰 있음, 상태 모델) | TC-FLOW-CH-06 | S1 상태·훅 / 발생 경로 S2·S3 |
| U-CH-07(토큰 있음) | TC-FLOW-CH-07 | S1 |
| U-CH-08 ~ U-CH-12(토큰 있음, 쓰기) | — 후속 이월 | S2 ~ S4 |

## 후속 이월 (S1에서 만들지 않는 TC)

| 대상 | 묶음 | 이유 | 그때 만들 것 |
|---|---|---|---|
| 하단 바·⋯ 메뉴·말풍선 메뉴의 토큰 있음 렌더 쌍 | S2·S3 | 설계 §14 슬롯만 있음, `viewer.canWrite` 계산 S2 | 토큰 있음 → 렌더 TC, 쓰기 래퍼 호출 인자·토큰 헤더, OOC 전송 시 speak 미호출 |
| 생성 중 "…" 임시 말풍선·잠금·실패 재시도 | S3 | R-CHAT-005 후속 | 가짜 시계·잠금 해제·오류 말풍선 |
| 401·403·429 코드별 안내·읽기 전용 전환 | S2·S3 | R-CHAT-011 후속 | `errorDetail` 확장 TC |
| F-CH-08 조립(배지 클릭 → 맨 아래 + unseenCleared) | S2 | S1에 새 메시지 발생 경로 없음 | 화면 단위 조립 TC |
| TC-FLOW-CH-06 순차 체인 | S2·S3 | 같음 | 발생 → 배지 → 클릭 → 해제 체인 |

## 변경 대기열(미검증)

| Q-nn | 일자 | CR-ID | 변경 요약 | 변경 파일 | 영향 TC 후보 | 신규 TC 필요 | 상태 |
|---|---|---|---|---|---|---|---|

## 변경이력

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v0.1 | 2026-10-05 | 최초 작성(신규 모드). TC-CH-001~030, TC-FLOW-CH-01~07, 추적표 3종, 스펙 초안 7개 | 구축 S1, design.md v1.1 RTM |
| v0.2 | 2026-10-05 | TC-CH-025 (f) pagehide 리스너 해제 단언 추가. TC-CH-005 재시도 중간 loading 단언. TC-CH-011·014 B0가 `ol`보다 앞(부품 단위). TC-CH-024 요구에서 R-NFR-004 제거, TC-CH-030 요구를 R-CHAT-002로 정정, 요구↔TC 표 맞춤. TC-CH-029 회귀 방지 비고. TC-FLOW 표기 규약(순차 `→` / `분기:`) 도입, FLOW-CH-01~07 재작성. 공통 전제에 named export·Bubble 클래스 키 명시 | ui-test-checker TK-01 ~ TK-07 |
| v0.3 | 2026-10-05 | TC-CH-011 (c) 픽스처를 계약 가능한 첫 페이지(31~60, 30건, hasMore=true)로 바꾸고 기대를 `before: 31`로 정정. 공통 전제에 스크롤 mock 비클램프·판정 대기 규칙 명시, ChatScroll 스펙의 "호출 없음·횟수 유지" 판정 앞에 `flushPending()` 추가(TC-CH-011 (b)(c)·013·014) | ui-test-conflict-checker CF-02 · CF-03 · CF-05 |
