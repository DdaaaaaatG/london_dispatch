# chat(대화) 테스트 시나리오

- 기준: `ui/src/chat/design.md` v1.6(CR-001 Bubble 배치, ui-designer 반영 중 — components.md §2.2 v1.6 확인)(+ `design/components.md` · `design/functions.md` · `design/a11y.md` · `design/tc.md` v1.5) / `ui/src/chat/requirements.md` v1.4 / `doc/200_설계/contract/api.md` v0.3.1 / 공용 요소 단일 정의 `ui/src/rooms/design/components.md` §1
- **v0.6 기준(S3 증분)**: `ui/src/chat/design.md` **v1.7**(§15 RTM) + `design/tc.md` v1.7 §3 · `design/generate.md` · `design/functions.md` §1·§4.3 · `design/components.md` §0·§2.6·§2.8·§2.11·§2.12·§3 · `design/labels.md` §8.1.2 · `design/a11y.md` / `ui/src/chat/requirements.md` **v1.7** / `doc/200_설계/contract/api.md` **v0.4**(§4.12~§4.14 · §11.9 · 「ui 인계 메모」)
- 작성일: 2026-10-05(v0.6: 2026-10-06) · 작성: ui-test-designer · 모드: **증분**(S1 TC-CH-001~030 · S2 TC-CH-031~065 보존, **S3 TC-CH-066~095 추가**, **S3b TC-CH-096·097 추가**) · 상태: **초안 v0.9(S3e 말풍선 액션 버튼 보강, 검증 전)** · 이전 v0.8(S3d 전송 뒤 자동 응답 증분) · **S3d 기준**: `ui/src/chat/design/auto.md`(정본, 설계 v1.9) · `design/rtm.md` · `design/generate.md` §6 · `design/a11y.md` · `design/components.md` §2.1·§2.2·§2.7·§2.8·§2.12 · `design/tc.md` · `ui/src/chat/requirements.md` **v1.9**(§2 U-CH-13 · §5 확정 문구) · `doc/200_설계/contract/api.md` **v0.6** §4.3·§4.9·§4.13·§5.2·§5.5·「ui 인계 메모」(S3d) · CR-002 · (v0.7) S3b 기준: `design/generate.md` §3 `LLM_BUDGET_EXCEEDED` 행 · `design/tc.md` TC-CH-096·097 · `design/labels.md` §8.1.2 비고 · `doc/200_설계/contract/api.md` **v0.4.1** §3.2·§3.4 · rooms F-RM-22 v1.5.1(`toastToneOf`) · 공용 부품 danger 톤 클래스 키 = `danger` **확정**(메인 세션 결정 TK-09)
- 묶음: **S1(읽기 전용 판)** + **S2(토큰 + 쓰기)** + **S3(AI 발화 speak · 재작성 regenerate)**. S1 TC의 토큰 분기는 "없음" 그대로다. S2 TC는 쓰기 UI마다 토큰 있음(TC-CH-031) ↔ 없음(TC-CH-003·021·022·023) 쌍과 전환(051·052)을 더한다. S3 TC는 캐릭터 버튼 있음(066) ↔ 없음(067·021) 쌍과 전환(076·084)을 더한다. S4(장기기억)는 「후속 이월」. **S3d** TC(098~109)는 새 쓰기 UI(중립 말풍선 · 「응답 재시도」 · 편집 저장 잠금 안내)마다 토큰 있음(099·102·107) ↔ 없음(106(c) · 108 읽기 전용) 쌍과 전환(106(a))을 더한다.
- **v0.9 기준(S3e 보강, CR-003)**: `ui/src/chat/design.md` **v2.0** §10 · `ui/src/chat/design/actions.md` **v2.0**(정본, 절 표기 `AC`) · `design/rtm.md` · `design/generate.md` §2·§3(재작성 실패 문구 개정)·§6 · `design/auto.md`(잠금 `isSaveLocked`·`roomBusy`) · `design/a11y.md` · `design/labels.md` §8.1.4 / `ui/src/chat/requirements.md` **v2.0**(R-CHAT-007 🔒 2026-10-07 개정 · U-CH-14 · U-CH-10 폐기) / `doc/200_설계/contract/api.md` **v0.6**(계약 변경 없음 — `editMessage`·`deleteMessage`·`regenerate` 재사용)
- **S3e 공통 전제(추가 — S1·S2·S3·S3d 전제는 그대로 유지, 단 아래 「폐기 전제」 제외)**
  - **정본·우선순위**: `design/actions.md`. 기존 TC 중 S3e로 단언이 바뀐 것은 「추적표 — S3e 추가분」 「대체·영향 TC (S3e)」 표가 바뀐 단언의 정본이다(본문과 표가 다르면 표가 우선). 폐기·대체(022 · 039 · 040 · 041 · 079 · 108 일부)는 TC 머리에 표시했다. 개정 27건은 S3d 방식대로 본문을 두고 표에 적는다.
  - **폐기 전제**: S2 공통 전제의 「말풍선 메뉴 대상 요소 = `li` 안 `[aria-haspopup="dialog"]`」와 「롱프레스」 가짜 시계 절차는 S3e에서 **폐기**한다. 말풍선 루트에는 읽기·쓰기 모두 `tabIndex`·`aria-haspopup`·`aria-keyshortcuts`·포인터·contextmenu 핸들러가 붙지 않는다(AC §3).
  - **질의**: `getByRole('group', { name: '{이름} 말풍선 작업' })` → `within(group).getByRole('button', { name: '{이름} 대사 수정' | '{이름} 대사 재작성' | '{이름} 대사 삭제' })`. `{이름}` = `세바스찬` · `시엘` · 유저 `userAuthorLabel(authorName)`(비면 `어떠한 의지`, 옛 데이터 `미샤`는 그대로) · OOC `[지시]`(AC §1 `nameOf`). 픽스처마다 이름이 다른 개정 TC는 li 안에서 `{ name: /말풍선 작업$/ }` · `/대사 수정$/`로 찾는다. 같은 이름의 그룹이 둘 이상 생기면(예: 전송으로 유저 말풍선이 하나 더 붙음, D-31) 화면 전체 질의가 중복 오류를 내므로 대상 `li` 안(`within(li)`)으로 범위를 좁힌다(v0.9.1).
  - **클래스 키(non-scoped)**: 그룹 루트 `actions` + 변형 키 하나(`sebastian`·`ciel`·`user`·`ooc`), 「삭제」 래퍼 `danger`. Bubble 루트 = 모듈 `root`이고 버튼 줄은 같은 `li` 안 그 **다음 형제**다(D-28). 읽기 전용 `li` 자식은 Bubble 하나뿐. 공용 Button 루트도 non-scoped 키가 `root`라 `root` 클래스만으로 Bubble을 판별하지 않는다 — Bubble 루트는 `li` 안 첫 `.root`(문서 순서상 버튼 줄 앞), 포커스 판별은 태그(`BUTTON`)로 한다(v0.9.1).
  - **래퍼 모킹**: 기존 스펙과 같은 `vi.mock('@/api/messages')`(화면은 `@/api` 재노출을 import하므로 같은 mock이 걸린다). `editMessage(id, { text })` · `deleteMessage(id)` · `regenerate(id)` 인자는 `mock.calls` 전체로 단언. 새 래퍼·에러 코드 없음. `MessageActions` 스펙은 `speak`·`regenerate` 기본값을 영원히 대기로 둔다. `AuthTransition`은 TC-CH-120 때문에 mock 목록에 `speak`·`regenerate`를 더한다(저장 성공 TC가 없어 speak는 불리지 않는다).
  - **「재작성」 누름(jsdom DC-05)**: jsdom은 disabled가 된 버튼의 포커스를 body로 옮기지 않고, disabled 요소의 `blur()`도 무시한다. 그래서 화면 TC는 누르기 전에 `activeElement.blur()` → `fireEvent.click`(포커스 이동 없는 클릭 = 브라우저의 "포커스를 잃은" 상태)으로 누르고, 부품 TC는 userEvent 클릭 뒤 **disabled 전에** blur한다. 포커스 복귀(F-CH-51)는 `waitFor`로 본다.
  - **대기**: 저장·삭제·생성·재작성·이름 변경 응답은 deferred를 act 안에서 직접 resolve한다. 가짜 시계는 TC-CH-112·113의 600ms 누름 구간에만 쓰고, 그 구간에서는 `findBy*`·`waitFor`를 쓰지 않는다.
  - **스펙 배치(결정)**: 옛 `BubbleMenu.test.tsx`는 고치지 않고 **새 파일로 옮긴다** — 부품 `BubbleActions.test.tsx`, 화면 통합 `MessageActions.test.tsx`(042~046·054(a)(b) 개정분 + 110~119 화면 단위). 근거: ① 595줄 중 메뉴 전제 it(039 4개 · 040 2개 · 041 · 054(d))이 절반 가까이라 고칠 것보다 버릴 것이 많다 ② 삭제되는 `MessageMenuSheet`를 import해 파일째 컴파일이 깨진다 ③ 파일 이름이 사라진 기능을 가리킨다. 옛 파일 **삭제는 ui-implementer**가 한다(이 문서 작성자는 파일 삭제 수단이 없다). `Regenerate.test.tsx`는 같은 이름으로 다시 썼다(079 제거, 진입·포커스·문구 개정).
- **S3d 공통 전제(추가 — S1·S2·S3 전제는 그대로 유지)**
  - **정본·우선순위**: `design/auto.md`. 기존 TC 중 S3d로 단언이 바뀐 것(008 · 033 · 034 · 036 · 038 · 053 · 063 · 075 · 085 · 090, 폐기 088)은 「추적표 — S3d 추가분」 「대체·영향 TC (S3d)」 표가 바뀐 단언의 정본이다. 033·034·036·038은 본문을 갱신했고, 008·075·088·090은 TC 머리에 「S3d 개정」·「폐기」를 적었다(본문과 표가 다르면 표가 우선). 053·063·085는 단언 추가만 있어 본문을 두고 표에 적는다.
  - **래퍼 모킹**: 전송 성공 경로가 있는 스펙(`Composer` · `SpeakFlow` · `AutoReply`)은 `speak` 기본값을 **영원히 대기**(`mockImplementation(() => new Promise(() => {}))`)로 둔다. 저장 201 뒤 자동 응답이 의도치 않게 결과·실패로 넘어가지 않게 한다. TC별 `mockReturnValueOnce(deferred)`가 먼저 쓰인다. `appendUser`가 성공으로 끝나는 TC가 없는 스펙(`AuthTransition` · `BubbleMenu` · `Regenerate` · `ChatScreen` · `RoomMenu` · rooms 쪽)은 바꾸지 않는다 — `speak`가 불리지 않는다.
  - **계약 이름**: `SpeakTarget`(`@shared/types`) · `USER_DISPLAY_NAME`(`@shared/characters`, 값 `어떠한 의지`)을 import한다(contract 구현분 전제, api.md §12.5). 화면 문구: `autoPendingStatus` = `응답을 만드는 중` · `autoRetryAriaLabel` = `응답 재시도` · `speakRetry` = `재시도` · `editSaveLockedNote` = `응답을 만드는 중에는 저장할 수 없습니다`(requirements.md v1.9 §5).
  - **픽스처(S3d, `AutoReply`)**: 말풍선 101~104(103은 옛 데이터 가정 authorName `미샤`) · 전송 응답 105 유저 line `안녕`(authorName `어떠한 의지`) · OOC 변형 105 · 자동 응답 106(세바스찬 `분부대로 하겠습니다, 도련님.` / 시엘 `오늘 저녁은 조용히 보내고 싶군.`) · 두 번째 전송 107 `다시`.
  - **클래스 단언**: 중립 루트 = 지역 `pending` · `neutral`(+`failed`). Bubble 모듈 `root` · `character` · `sebastian` · `ciel` · `user`는 **없음**, `img` 0개(auto.md §2.1 테스트 클래스 키).
  - **한 커밋 관찰(T35)**: 저장 응답 act 동안 세바스찬·시엘·⋯ 버튼의 `disabled` 속성 변화를 `MutationObserver`로 기록해 0건을 단언한다(사이 커밋에서 잠금이 풀렸다 다시 걸리면 기록이 남는다).
  - **대기**: 저장·생성 응답은 deferred를 act 안에서 resolve한다. 화면 타이머가 없어 가짜 시계를 쓰지 않는다.
- **S3 공통 전제(추가 — S1·S2 전제는 그대로 유지)**
  - **토큰**: 화면 단위는 `viewer=WRITER_VIEWER`(있음)·`READ_ONLY_VIEWER`(없음) props, App 통합(TC-CH-076)은 `initToken('?t=test-token')` → `clearToken()`. localStorage에 토큰을 넣지 않는다.
  - **래퍼 모킹**: `vi.mock('@/api/messages')` 목록에 **`speak`·`regenerate`**를 더한다(화면은 `@/api` 재노출을 import하므로 같은 mock이 걸린다, api.md §11.9). `speak(roomId, body)`·`regenerate(messageId)` → `Result<Message>`. 단언은 인자 배열 전체(`mock.calls`)로 한다.
  - **생성 대기**: resolve하지 않은 Promise(deferred)를 만들고 `act` 안에서 직접 resolve/fail. 화면 타이머가 없으므로 70초를 흘릴 필요가 없다. 가짜 시계는 롱프레스(069)·80초 경과(070)에만 쓰고, 그 구간에서는 `findBy*`·`waitFor` 금지.
  - **픽스처(S3)**: SpeakFlow = S2 픽스처 101~104(마지막이 OOC) + speak 응답 105(세바스찬 `분부대로 하겠습니다, 도련님.` / 시엘 `오늘 저녁은 조용히 보내고 싶군.`) · 전송 응답 106. Regenerate = 70 시엘 line · 71 유저 ooc · **72 세바스찬 line(마지막)** · 성공 응답 `{…72, text: '물론입니다. 오늘 일정부터 말씀드리지요.'}` · 73 유저 line · 74 유저 ooc(경계용).
  - **스크롤 수치(072·078)**: log 요소 `clientHeight=493`, `scrollHeight = 2200 + 메시지 li×200 + 임시·실패 li×100`(4건 3000 · 임시 추가 3100 · 성공 5건 3200 · 빈 방+1건 2400), `scrollTop` 비클램프.
  - **클래스 단언**: `non-scoped`라 키 이름 그대로. 임시·실패 말풍선 루트 = Bubble 모듈 `root`·`character`·`sebastian|ciel` + 지역 `pending`(+`failed`), 자식 `avatar`·`content`·`head`·`name`·`body`(DC-01).
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

### TC-CH-008 · 유저 말풍선(가운데 말풍선) · **S3d 개정(Q-08): `authorName` `null`·`''` → `어떠한 의지`, 「이름 없음」 없음 — 본문 Then의 `이름 없음` 단언을 대체. 정본은 「대체·영향 TC (S3d)」 표** · 종류: 자동 · 요구: R-CHAT-002 🔒(CR-001 개정) · 설계: C §2.2 v1.6 `user` 행 · §3.2 비고(일반 텍스트) · §8.1 `unknownAuthor` · 토큰: 없음
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
- Then ⓐ 해당 없음(순수 함수) ⓑ 초기값 10필드 일치(S1 7필드 + S2 `writing`·`editingId` = null + S3 `pending` = null, v0.4 메인 세션 승인 보정 · v0.6 Q-05). T1 → 초기값. T2 → ready·정렬·중복 제거·hasMore. T3 → error·나머지 초기값. T4 → isLoadingOlder true·olderError null. T5(4가지 불충족) → 같은 참조. T6 → 앞 합침·hasMore·로딩 해제, 빈 페이지면 hasMore false. T7 → 같은 참조. T8 → 로딩 해제·olderError·말풍선 유지 ⓒ api 호출 없음
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

### TC-CH-022 · 말풍선 메뉴 부재 · **S3e 대체 → TC-CH-112**(버튼 줄 부재 + 메뉴 부재. 스펙 it 이름·단언을 112로 교체) · 종류: 자동 · 요구: R-CHAT-008 · R-CHAT-007(부재 쪽) · 설계: §10 3행 · C §2.2 마지막 줄 · 토큰: 없음
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

### TC-CH-031 · (S2) 토큰 있음 렌더 쌍 · **S3 일부 대체됨: "`세바스찬`·`시엘` 버튼 없음" 단언 → TC-CH-066**(나머지 단언 유지, 스펙에서 그 두 줄 삭제) · 종류: 자동 · 요구: R-CHAT-004 · R-CHAT-008 · R-CHAT-001 · R-CHAT-013 · 설계: §2.2 · §3.1 · §10 · C §2.0·§2.6 · §8.1.1 · A 랜드마크 · 토큰: 있음
- Given `viewer=WRITER_VIEWER`, 픽스처 4건
- When 마운트한다
- Then ⓐ `<header>` 버튼 2개(‹ · `방 메뉴 열기`). `group "메시지 작성"` 안에 `switch "OOC 지시 모드"`(`aria-checked="false"`, 글자 `OOC 끔`) · `textbox "메시지 입력"`(placeholder `대사나 지시를 입력`) · `button "전송"`. `role=note` 없음. 말풍선 4개 모두 메뉴 대상(`tabindex=0`·`aria-haspopup="dialog"`·`aria-keyshortcuts="Shift+F10"`, `menuEnabled` 클래스). TC-CH-003·021·022·023과 쌍 ⓑ `ld:lastRoomId='r1'` ⓒ `listMessages` 1회 `['r1']`, 쓰기 래퍼 0회
- 스펙: `ui/src/chat/test/Composer.test.tsx`

### TC-CH-032 · (S2) 전송 비활성 · 종류: 자동 · 요구: R-CHAT-004 · R-MSG-002 · 설계: C §2.6 `sendable` · F §1.2 `canSend` · C §1.11·§1.13 · 토큰: 있음
- Given (a) ready (b) `listMessages` 대기(loading) (c) 첫 로드 실패(error)
- When (a) 입력 `''` → `'   '` → `'a'×2001` → `'a'×2000` (b)(c) `안녕` 입력
- Then ⓐ (a) 빈·공백 → `전송` disabled, 카운터 없음 · 2001 → disabled, 카운터 `2001/2000`(`over`), 입력 `aria-invalid="true"` · 2000 → enabled, 카운터 없음(`counterMode='overflow'`) (b)(c) disabled ⓑ 입력값은 넣은 그대로 ⓒ `appendUser` 0회
- 스펙: `Composer.test.tsx`

### TC-CH-033 · (S2) 전송 성공 · **S3d 개정(Q-08)** · 종류: 자동 · 요구: R-CHAT-006 🔒(S3d 개정) · R-CHAT-014 🔒 · R-CHAT-004 · R-AUTH-004 🔒 · R-MSG-002 · 설계: §6.3 · AU §3 F-CH-17 ⑥ · C §2.6 `submit` · §7 `appendUser` · AU §2.2 · 토큰: 있음
- Given ready 4건, `appendUser` → `ok(105 '안녕', authorName '어떠한 의지')`(서버 투영 값), `speak` 기본값 영원히 대기
- When `안녕` 입력 → `전송` 클릭
- Then ⓐ `li` **6개**: 5번째 말풍선 `user` 클래스·작성자명 `어떠한 의지`(응답 값 그대로)·본문 `안녕`, 6번째 = 중립 "…"(`.pending.neutral`). 입력값 `''`, 입력에 포커스, switch `OOC 끔` 유지 ⓑ 저장소 키는 `ld:lastRoomId`(=`r1`)뿐 ⓒ `appendUser` 1회, 인자 정확히 `['r1', { text: '안녕', ooc: false }]` · **`speak` 1회 `['r1', { character: 'auto' }]`** · `regenerate` 0회 · 두 모킹 모듈에서 `appendUser`·`speak`를 뺀 나머지 export 호출 합계 = 첫 `listMessages` 1회뿐
- 스펙: `Composer.test.tsx`

### TC-CH-034 · (S2) OOC 토글 · **S3d 개정(Q-08)** · 종류: 자동 · 요구: R-CHAT-004 · R-CHAT-006 🔒 · R-MSG-009 🔒 · 설계: C §2.6 1행 · C §1.14 · §8.1.1 `oocOn`·`oocOff` · AU §3 F-CH-17 ⑥ · 토큰: 있음
- Given ready, `appendUser` → `ok(106 ooc '체스 두기')`, `speak` 영원히 대기
- When switch 클릭 → `체스 두기` 입력 → 전송
- Then ⓐ 클릭 뒤 `aria-checked="true"`·글자 `OOC 켬` → 전송 뒤 `li` **6개**, 5번째 `ooc` 클래스·`[지시]` 포함, 6번째 중립 "…", switch는 계속 `OOC 켬` ⓑ 입력 `''` ⓒ `appendUser` `['r1', { text: '체스 두기', ooc: true }]` 1회 · **`speak` `['r1', { character: 'auto' }]` 1회**(OOC 뒤에도 같은 동작, R-MSG-009)
- 스펙: `Composer.test.tsx`

### TC-CH-035 · (S2) Enter·Shift+Enter·IME · 종류: 자동 · 요구: R-CHAT-004 · R-CHAT-013 · 설계: C §1.13 `onEnter`·IME · A 키보드 · 토큰: 있음
- Given ready, 입력에 포커스
- When (a) 빈 입력 Enter (b) `가` 입력 후 `keyDown Enter isComposing: true` (c) Shift+Enter (d) Enter
- Then ⓐ (a)(b) 변화 없음 (c) 입력값 `가\n` (d) 전송 → 입력 `''` ⓑ — ⓒ (a)(b)(c) `appendUser` 0회 (d) 1회 `['r1', { text: '가\n', ooc: false }]`
- 스펙: `Composer.test.tsx`

### TC-CH-036 · (S2) 전송 중 중복 방지 · **S3d 개정(Q-08)** · 종류: 자동 · 요구: R-CHAT-006 🔒 · R-CHAT-014 🔒 · R-CHAT-013 · 설계: F-CH-17 `writeInFlightRef` · F §1.1 T13·T14 · AU §1.2 T35 · AU §4.1 · C §2.6 `isReadOnly` · A `aria-busy` · AU §7 잠금 표시 · 토큰: 있음
- Given `appendUser` 대기(deferred), (a) `speak` 대기(deferred)
- When (a) 전송 클릭 → 대기 중 클릭·Enter 2회 → 저장 resolve(105) → 입력 `''` 확인 뒤 `다음` 입력 → speak resolve(세바스찬 107) (b) 같은 `act` 안 `fireEvent.click(전송)` 2회
- Then ⓐ 저장 대기 중 `전송` disabled, 입력 `readOnly`, group `aria-busy="true"` → 저장 응답 뒤 `aria-busy`≠`true`, `readOnly` 해제, `다음` 입력되지만 **`전송` disabled 유지**(자동 응답 중) → speak 결과 뒤 `전송` 활성 ⓑ writing send → speak auto → null(표시로 관찰) ⓒ (a)(b) `appendUser` 1회 · (a) `speak` `['r1', { character: 'auto' }]` 1회
- 스펙: `Composer.test.tsx`

### TC-CH-037 · (S2) 전송 실패(비인증) · 종류: 자동 · 요구: R-CHAT-011 · R-CHAT-006 · 설계: §6.6 · F-CH-16 · §8.3 · C §1.18 · §11.2 D-7 · 토큰: 있음
- Given `안녕` 입력, `appendUser` 대기 → 실패: `INTERNAL` · `RATE_LIMITED`+40 · `RATE_LIMITED`(값 없음) · `NOT_FOUND` · `NETWORK` · `VALIDATION_ERROR`
- When 전송 → (가짜 시계) → resolve → 1999ms → 1ms
- Then ⓐ E `role=alert` 문구·톤: `ERROR_MESSAGES.INTERNAL`(danger) · `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.`(warning) · `ERROR_MESSAGES.RATE_LIMITED`(warning) · `방을 찾을 수 없습니다. 목록으로 돌아가 주세요.`(danger) · `서버에 연결할 수 없습니다.`(danger) · `메시지는 1~2000자로 입력해 주세요.`(danger). `SERVER-RAW-MESSAGE` 없음. 입력값 `안녕` 유지, `li` 4개, group·⋯ 그대로, `role=note` 없음. 1999ms 있음 → 2000ms 없음 ⓑ `onAuthFailure` 0회 ⓒ `appendUser` 1회
- 스펙: `Composer.test.tsx`

### TC-CH-038 · (S2) 전송 뒤 스크롤·배지 · **S3d 개정(Q-08): T35가 T9 규칙으로 붙이고 유저 말풍선 + 중립 "…"(li 2개)가 한 커밋 — Then (a)(b) `li` 6개 · ⓒ `speak` 1회 추가, 나머지 불변** · 종류: 자동 · 요구: R-CHAT-003 · R-CHAT-006 🔒 · R-CHAT-014 🔒 · 설계: §6.3 · F-CH-17 `isNearBottom` · F-CH-08 조립 · C §3 뒤붙임 행 · F §1.1 T9·T11 · AU §1.2 T35 · AU §2.3 `tailKey` · 토큰: 있음
- Given 스크롤 mock(493). 내용 높이는 렌더된 말풍선 수에 연동한다: 4개일 때 3000, 새 말풍선이 **커밋된 뒤**(S3d: 유저 + 중립 "…" 6개) 3200. 첫 배치 `scrollTop=2507`. 응답 시점(붙이기 전) `isNearBottom` 측정은 3000 기준이다(TK-01). `speak` 영원히 대기
- When (a) 그대로 전송 성공 (b) `scrollTop=1000` + scroll 후 전송 성공 → 배지 클릭
- Then ⓐ (a) `scrollTop=3200`, 배지 없음 (b) `scrollTop=1000` 그대로, `button "새 메시지 보기, 맨 아래로 이동"`(글자 `새 메시지`) → 클릭 → `scrollTop=3200`, 배지 없음 ⓑ (a) unseen 0 (b) 1 → 0(배지로 관찰) ⓒ `appendUser` 1회, `listMessages` 1회(새 메시지 반영에 재요청 없음)
- 스펙: `Composer.test.tsx`

### TC-CH-039 · (S2) 말풍선 메뉴 열기 · **S3e 폐기**(메뉴 제거, R-CHAT-007 🔒 개정 — 반대 단언은 TC-CH-113. 스펙은 `BubbleMenu.test.tsx`째 삭제) · 종류: 자동 · 요구: R-CHAT-007 · R-CHAT-013 · 설계: §6.4 1행 · C §2.2 메뉴 핸들러 · C §1.19 · F-CH-18 · A Shift+F10 · 토큰: 있음
- Given ready, 102(세바스찬) 말풍선 메뉴 대상
- When (a) `fireEvent.contextMenu` (b) 마우스 왼쪽 누름 → 500ms (c) 누름 → 499ms → 뗌 (d) 누름 → 11px 이동 → 500ms (e) 터치 누름 → 500ms → `contextmenu` (f) 말풍선 포커스 → Shift+F10
- Then ⓐ (a)(b)(e)(f) `dialog "메시지 메뉴"` 1개((e)는 contextmenu 뒤에도 1개) (c)(d) dialog 없음 ⓑ (a) `fireEvent` 반환 `false`(`defaultPrevented`) ⓒ 쓰기 래퍼 0회
- 스펙: `ui/src/chat/test/BubbleMenu.test.tsx`

### TC-CH-040 · (S2) 메뉴 내용 · **S3e 대체 → TC-CH-110 · 111**(메뉴 항목 순서 → 버튼 순서. 머리 줄 이름·시각·발췌는 삭제) · **S3 일부 대체됨: 재작성 표시 조건 → TC-CH-079**(이 픽스처는 마지막이 OOC 104라 102·103·104 모두 대상 아님 — "재작성 없음"은 S3에서도 성립, 테스트 이름만 "재작성 대상 아님"으로) · 종류: 자동 · 요구: R-CHAT-007 · R-LLM-002 · 설계: C §2.8 `nameOf`·`excerptOf` · §8.1.1 `messageMenuHeader`·`edit`·`delete`·`cancel` · 토큰: 있음
- Given 102 세바스찬 · 103 유저(미샤) · 104 OOC · 부품 단위 22자 본문 메시지
- When 각 말풍선의 메뉴를 연다 / `MessageMenuSheet`를 단독 렌더한다
- Then ⓐ 머리 `세바스찬 · 16:41  "예, 도련님."` · `미샤 · 16:42  "나도 한 잔 부탁해요."` · `[지시] · 16:43  "둘이 체스를 둔다"` · 22자 → 앞 20자 + `…`. 버튼 순서 `수정`·`삭제`·`취소`, `재작성` 없음. `삭제` 항목은 danger 톤 ⓑ — ⓒ 쓰기 래퍼 0회
- 스펙: `BubbleMenu.test.tsx`

### TC-CH-041 · (S2) 메뉴 닫기·포커스·트랩 · **S3e 폐기**(메뉴 시트 없음. 시트 Tab 순환은 TC-CH-055, 확인 시트 닫힘 뒤 포커스는 TC-CH-116) · 종류: 자동 · 요구: R-CHAT-007 · R-CHAT-013 · 설계: C §1.15 포커스·트랩·Esc · F-CH-28 · A 시트 · 토큰: 있음
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
- Then ⓐ 해당 없음 ⓑ 초기값 10필드(`writing`·`editingId`·`pending` null, v0.6 Q-05). T1(ready·editingId·unseen 있음) → 초기값. T13 writing 설정 / T14(loading·쓰기 중) 같은 참조 / T15 null / T16 같은 참조 / T17 교체·순서 유지·editingId 같은 id면 null·다른 id면 유지 / T18 같은 참조 / T19 제거·editingId null / T20 같은 참조 / T21 editingId / T22(쓰기 중·없는 id·loading) 같은 참조 / T23 null / T24(저장 중·편집 아님) 같은 참조 / T25 둘 다 null / T26 같은 참조. `canSend` ready·null만 true ⓒ api 호출 없음
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

### TC-CH-066 · (S3) 토큰 있음 — 캐릭터 버튼 렌더 · 종류: 자동 · 요구: R-CHAT-004 · R-CHAT-013 · R-CHAT-008 · 설계: C §0 · §2.6 1행 · §2.11 · F-CH-01 S3 props · labels §8.1.2 `speakAriaLabel` · A 버튼 레이블 · 토큰: 있음
- Given `viewer=WRITER_VIEWER`, 픽스처 4건 / (부품) `SpeakButtons isDisabled=false speakingCharacter=null`
- When 마운트한다 / (부품) 두 버튼을 차례로 클릭, `isDisabled=true`로 다시 렌더 후 클릭
- Then ⓐ `group "메시지 작성"` 안에 button `세바스찬 대사 생성`(글자 `세바스찬`) → `시엘 대사 생성`(글자 `시엘`) → switch `OOC 지시 모드` DOM 순서. ⋯·textbox·`전송` 있음, `role=note` 없음(TC-CH-031 나머지 유지). (부품) `isDisabled`면 두 버튼 `disabled` ⓑ `ld:lastRoomId='r1'` ⓒ `listMessages` `[['r1']]`, `speak` 0회. (부품) `onSpeak` `[['sebastian'], ['ciel']]`, disabled 클릭 뒤에도 2회 유지
- 스펙: `ui/src/chat/test/SpeakFlow.test.tsx` · `ui/src/chat/test/SpeakButtons.test.tsx`

### TC-CH-067 · (S3) 토큰 없음 — 캐릭터 버튼·임시 말풍선 부재 · 종류: 자동 · 요구: R-CHAT-004 · R-CHAT-008 · 설계: F-CH-01 · F-CH-39 · §10 · 토큰: 없음
- Given `viewer=READ_ONLY_VIEWER`, 픽스처 4건
- When 마운트한다
- Then ⓐ `queryByRole('button', { name: /세바스찬|시엘/ })` null(말풍선 이름 글자 `세바스찬`은 보인다 — button 아님), `.pending` 0개, `role=note` 열람 안내 ⓑ 읽기 전용(`canWrite=false`) ⓒ `speak`·`regenerate` 0회
- 스펙: `SpeakFlow.test.tsx`

### TC-CH-068 · (S3) speak 호출 인자 · 종류: 자동 · 요구: R-CHAT-005 · R-MSG-003 · 설계: F-CH-31 · api §4.13·§11.9 · 토큰: 있음
- Given ready 4건, `speak` 대기
- When (a) `세바스찬 대사 생성` 클릭 (b) `시엘 대사 생성` 클릭
- Then ⓐ 임시 말풍선 1개(TC-CH-069) ⓑ writing = speak(표시로 관찰) ⓒ `speak.mock.calls` = (a) `[['r1', { character: 'sebastian' }]]` (b) `[['r1', { character: 'ciel' }]]`, 인자 정확히 2개, 본문 키 `['character']`뿐. `appendUser`·`regenerate`·`editMessage`·`deleteMessage` 0회
- 스펙: `SpeakFlow.test.tsx`

### TC-CH-069 · (S3) 생성 중 임시 말풍선 · 종류: 자동 · 요구: R-CHAT-005 · R-CHAT-002 · R-CHAT-013 · 설계: C §2.12 generating · DC-01 · D-11 · labels `pendingDots`·`pendingStatus` · A 생성 중 알림 · 토큰: 있음
- Given ready 4건, `speak` 대기 / (부품) `PendingBubble pending={{ character, status: 'generating', error: null }}`
- When (a) 세바스찬 클릭 (b) 시엘 클릭 → 목록 끝 li를 본다 → contextmenu → (가짜 시계) 500ms 누름
- Then ⓐ li 5개, 끝 li 루트 클래스 `root`·`pending`·`character`·(a)`sebastian`/(b)`ciel`, 반대 캐릭터 키·`failed` 없음. 아바타 `alt=""`(부품: src `/embed/img/{c}.png`), `.name` = `세바스찬`/`시엘`, `<time>` 없음, `…` `aria-hidden="true"`, 자식 `avatar`·`content`·`head`·`name`·`body`(`.content .head .name`·`.content .body`). 루트 `role=status`·`aria-live=polite`, 글자에 `세바스찬 대사를 만드는 중`/`시엘 대사를 만드는 중`. `tabindex`·`aria-haspopup` 없음, contextmenu 반환 true(기본 동작), 500ms 뒤 dialog 없음. alert·버튼 없음 ⓑ pending generating(표시로 관찰) ⓒ `speak` 1회. 배경색·거울 배치는 수동 TC-CH-092
- 스펙: `SpeakFlow.test.tsx` · `PendingBubble.test.tsx`

### TC-CH-070 · (S3) 생성 중 잠금 · 종류: 자동 · 요구: R-CHAT-005 · R-CHAT-004 · R-NFR-001 · 설계: F §4.3 잠금 표 `speak` 행 · F-CH-31 `begin` 팻말 · C §2.6 `isSending` · D-14 · A-6 · 토큰: 있음
- Given ready 4건, `speak`가 같은 대기 Promise를 돌려준다
- When 같은 `act` 안에서 세바스찬 클릭 2회 + 시엘 클릭 1회 → 입력 `안녕` → 103 contextmenu → (가짜 시계) 80 000ms 경과
- Then ⓐ 두 캐릭터 버튼·`전송`·⋯ `disabled`. 입력값 `안녕` 반영, `readOnly` 아님. dialog 없음. 80초 뒤에도 `.pending` 1개·버튼 disabled(화면 타임아웃 없음) ⓑ writing speak 유지 ⓒ `speak` 총 1회, `appendUser` 0회
- 스펙: `SpeakFlow.test.tsx`

### TC-CH-071 · (S3) 성공 교체 · 종류: 자동 · 요구: R-CHAT-005 · R-CHAT-002 · 설계: F §1.1 T29 · F-CH-31 성공 · 토큰: 있음
- Given 시엘 클릭으로 대기 중, 입력 `안녕`
- When `ok(105 시엘 '오늘 저녁은 조용히 보내고 싶군.')` resolve
- Then ⓐ `.pending` 0개, li 5개(중복 없음), 끝 li에 `.ciel`·이름 `시엘`·`img src="/embed/img/ciel.png"`·본문 응답 text. 두 캐릭터 버튼·`전송` 활성 ⓑ writing·pending null(표시로 관찰) ⓒ `speak` 1회, `listMessages` 1회(재조회 없음)
- 스펙: `SpeakFlow.test.tsx`

### TC-CH-072 · (S3) speak 자동 스크롤·배지 · 종류: 자동 · 요구: R-CHAT-003 · R-CHAT-005 · 설계: F-CH-40 · C §3 tailKey 행·뒤붙임 행 · F §1.1 T29 · 토큰: 있음
- Given 스크롤 mock(S3 공통 전제), 첫 배치 `scrollTop=2507`
- When (a) 그대로 세바스찬 클릭 → 성공 (b) `scrollTop=1000` + scroll → 세바스찬 클릭 → 성공
- Then ⓐ (a) 임시 등장 직후 `scrollTop=3100` → 성공 뒤 `3200`, 배지 없음 (b) 등장·성공 모두 `1000`, 성공 뒤 button `새 메시지 보기, 맨 아래로 이동`(글자 `새 메시지`) ⓑ (a) unseen 0 (b) unseen 1(배지로 관찰) ⓒ `speak` 1회, `listMessages` 1회
- 스펙: `SpeakFlow.test.tsx`

### TC-CH-073 · (S3) 실패 → 재시도 · 종류: 자동 · 요구: R-CHAT-005 · R-CHAT-011 · 설계: F §1.1 T31·T27 · F-CH-31 ③ · F-CH-32 · C §2.12 failed · D-12 · labels `speakRetry`·`speakRetryAriaLabel` · 토큰: 있음
- Given ready 4건, 1회째 `speak` → `LLM_FAILED`(또는 `LLM_EMPTY`), 2회째 대기
- When 세바스찬 클릭 → 실패 → `세바스찬 대사 재시도` 클릭 → 성공 resolve
- Then ⓐ 실패: li 5개, 끝 li 루트 `pending`·`failed`·`sebastian`, 화면 `role=alert`는 그 말풍선 안 1개(E 토스트 없음), 문구 `생성에 실패했습니다.`, `!` `aria-hidden`, 버튼 글자 `재시도`, 두 캐릭터 버튼 활성 → 재시도 클릭 직후 `.failed` 0개·`.pending` 1개·`role=status` `세바스찬 대사를 만드는 중` → 성공 뒤 `.pending` 0개, 끝 본문 응답 text ⓑ pending generating → failed → generating → null ⓒ `speak.mock.calls` = `[['r1', { character: 'sebastian' }], ['r1', { character: 'sebastian' }]]`, `onAuthFailure` 0회. (부품) 「재시도」 → `onRetry('sebastian')` 1회
- 스펙: `SpeakFlow.test.tsx` · `PendingBubble.test.tsx`

### TC-CH-074 · (S3) 실패 코드별 문구 · 종류: 자동 · 요구: R-CHAT-011 · R-CHAT-005 · R-MSG-007 · 설계: generate §3 speak 열 · F-CH-37 · DC-02(사용자 결정 2026-10-06) · 토큰: 있음
- Given 시엘 클릭 대기 → 실패 `SPEAK_IN_PROGRESS` · `RATE_LIMITED`+`retryAfterSec: 40` · `NETWORK` · `INTERNAL` · `CONFIG_INVALID`
- When resolve
- Then ⓐ 실패 말풍선 alert 1개 문구: `이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요.` / `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.` / `서버에 연결할 수 없습니다.` / `ERROR_MESSAGES.INTERNAL` / `서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요.` — **모든 코드에 button `시엘 대사 재시도` 활성**(CONFIG_INVALID 포함). `SERVER-RAW-MESSAGE` 없음, `role=note` 없음 ⓑ pending failed(error = 받은 값) ⓒ `speak` 1회, `onAuthFailure` 0회
- 스펙: `SpeakFlow.test.tsx` · `PendingBubble.test.tsx`(CONFIG_INVALID 부품)

### TC-CH-075 · (S3) 실패 말풍선이 사라지는·남는 경우 · **S3d 개정(Q-08): (b) 유저 전송 성공 → 실패 말풍선이 사라지고 목록 끝은 중립 "…"(T35 교체), 「세바스찬 대사 재시도」 없음, `speak` `[['r1',{sebastian}],['r1',{auto}]]` — 본문 (b)의 "남는다" 단언을 대체. (a)(c) 불변** · 종류: 자동 · 요구: R-CHAT-005 · R-CHAT-014 🔒 · 설계: F §1.1 T27 · §1.1 비고(실패 말풍선 유지 규칙 — S3d 전송만 예외) · AU §1.2 T35 · generate §1 · 토큰: 있음
- Given 세바스찬 실패 말풍선 표시 중
- When (a) 시엘 클릭(대기) (b) `안녕` 전송 → `ok(106)` (c) 언마운트 → 같은 방 재마운트
- Then ⓐ (a) `.failed` 0개, `.pending` 1개이고 `ciel` 클래스 (b) li 6개, 106 `안녕`이 5번째, 끝 li는 여전히 `.failed` (c) `.pending` 0개 ⓑ (a) pending 시엘 generating (b) pending failed 유지 (c) 새 마운트 초기값 ⓒ (a) `speak` 2번째 인자 `['r1', { character: 'ciel' }]` (b) `appendUser` `[['r1', { text: '안녕', ooc: false }]]` (c) `speak` 1회 유지, `listMessages` 2회
- 스펙: `SpeakFlow.test.tsx`

### TC-CH-076 · (S3) speak 인증 실패 전환 · 종류: 자동 · 요구: R-CHAT-011 · R-CHAT-008 · R-CHAT-009 · 설계: F-CH-31 ① · F-CH-16(S3) · F-CH-29 · F-CH-39 · T25 · A 전환 · 토큰: 있음 → 없음
- Given (a) 하네스(전환 흉내), 세바스찬 대기 → `LEVEL_TOO_LOW` · `TOKEN_INVALID` · `TOKEN_REQUIRED` (b) App 통합 `initToken('?t=test-token')`, `speak` → `LEVEL_TOO_LOW`
- When resolve / (b) 티타임 진입 → 세바스찬 클릭
- Then ⓐ (a)(b) 공통: `.pending` 0개, group·캐릭터 버튼(`/세바스찬|시엘/`) 없음, `role=note` 열람 안내, alert 1개 = 코드별 전환 문구((b)는 `대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.`), 그 alert에 `warning` 클래스, 포커스 ‹ ⓑ (a) `onAuthFailure` 1회 (b) `getToken() === null` ⓒ `speak` 1회 (b) `[['r1', { character: 'sebastian' }]]`
- 스펙: `SpeakFlow.test.tsx`

### TC-CH-077 · (S3) speak 방 사라짐 · 종류: 자동 · 요구: R-CHAT-005 · R-ROOMS-004 · 설계: F-CH-31 ② · F-CH-33 · generate §3 NOT_FOUND 행 · 토큰: 있음
- Given ready, `ld:lastRoomId='r1'`, 세바스찬 대기
- When `NOT_FOUND` resolve
- Then ⓐ alert(토스트) 없음, `.pending` 0개(실패 말풍선도 남기지 않음) ⓑ `speakDiscarded`로 pending·writing null. `onBack` 1회, 그 시점 `ld:lastRoomId` 이미 null ⓒ `speak` 1회(재호출 없음)
- 스펙: `SpeakFlow.test.tsx`

### TC-CH-078 · (S3) 빈 방 첫 speak · 종류: 자동 · 요구: R-CHAT-005 · R-CHAT-003 · 설계: F-CH-39(DC-11) · C §3 tailKey 행(첫 배치 전 무시) · 토큰: 있음
- Given 스크롤 mock, `listMessages` → `{ messages: [], hasMore: false }`
- When `아직 대화가 없습니다` 확인 → 세바스찬 클릭(대기) → 성공 resolve
- Then ⓐ 클릭 직후 빈 문구 없음, `role=log` 안 li 1개 = 임시 말풍선 → 성공 뒤 li 1개(메시지), `.pending` 0개, `scrollTop = 2400 − 493 = 1907`(맨 아래) ⓑ 첫 배치는 성공 커밋에서 ⓒ `speak` 1회
- 스펙: `SpeakFlow.test.tsx`
- 비고: 2026-10-07 스펙 수정(CR-002) — 빈 문구 대기를 `findByRole('status')` → `findByText('아직 대화가 없습니다')`로 바꿨다. 전체 실행 부하 때 「불러오는 중」 status를 먼저 잡는 경합 때문이다. 판정 기준(ⓐ~ⓒ)은 그대로다

### TC-CH-079 · (S3) 재작성 표시 조건 · **S3e 대체 → TC-CH-111**(메뉴 항목 → 버튼 줄 「재작성」, 순수 `regenerateTargetIdOf`. `Regenerate.test.tsx`에서 it 제거) · 종류: 자동 · 요구: R-CHAT-007 · R-MSG-006 · 설계: F §1.2 `isRegenerateTarget` · F-CH-35 · C §2.8 · §2.10 `canRegenerate` · labels `regenerate` · 토큰: 있음
- Given Regenerate 픽스처 / 변형: 마지막 유저 line([70,72,73]) · 마지막 OOC([70,72,74]) · 실패 말풍선이 끝(시엘 speak `LLM_FAILED`) / (부품) `MessageMenuSheet canRegenerate` true·false, `isWriteBusy`
- When 대상 말풍선 포커스 + Shift+F10으로 메뉴
- Then ⓐ 72(마지막 세바스찬) → 항목 `수정`·`재작성`·`삭제`·`취소` 순서, `재작성` danger 아님 · 70(마지막 아님) · 73(유저 마지막) · 74(OOC 마지막) · 72(뒤에 유저) → `수정`·`삭제`·`취소`, `재작성` DOM 없음 · 실패 말풍선이 끝이어도 72 → 재작성 있음. (부품) false → 없음, `isWriteBusy` → 재작성 disabled. 읽기 전용은 메뉴 자체 없음(TC-CH-022) ⓑ sheet.canRegenerate = 열 때 계산 ⓒ `regenerate` 0회. (부품) 재작성 클릭 → `onRegenerate` 1회
- 스펙: `ui/src/chat/test/Regenerate.test.tsx`

### TC-CH-080 · (S3) 재작성 실행·진행·성공 · 종류: 자동 · 요구: R-CHAT-007 · R-CHAT-005 · R-MSG-006 · 설계: F-CH-34 · F-CH-36 · T13·T17·T15 · C §2.2 재작성 중 표시 · labels `regeneratingNote` · A 재작성 중 알림 · D-13 · 토큰: 있음
- Given 입력 `안녕`, 72 메뉴(포커스 + Shift+F10), `regenerate` 대기
- When `재작성` → 대기 중 입력 `안녕하세요` → `ok({…72, 새 text})` resolve
- Then ⓐ 클릭 직후 dialog·alertdialog 없음(confirm 없음). 대기 중 72 루트 `regenerating`, `.body` `aria-busy="true"`·원 본문 그대로, 루트 안 `role=status` = `다시 쓰는 중…`. 두 캐릭터 버튼·`전송`·⋯(`방 메뉴 열기`) disabled, 다른 말풍선(70) contextmenu → dialog 없음(잠금 표 `regenerate` 행), 입력 `안녕하세요` 반영·`readOnly` 아님 → 응답 뒤 li 3개 그대로, 본문 = 새 text(원문 없음), `regenerating`·status 없음, 포커스 = 72 말풍선, 버튼 활성 ⓑ writing regenerate → null ⓒ `regenerate.mock.calls` = `[[72]]`(인자 하나), `speak`·`editMessage` 0회
- 스펙: `Regenerate.test.tsx`

### TC-CH-081 · (S3) 재작성 실패 · 종류: 자동 · 요구: R-CHAT-007 · R-CHAT-011 · 설계: F-CH-34 그 밖 · generate §3 regenerate 열 · D-13 · 토큰: 있음
- Given 72 재작성 대기
- When 실패 `LLM_FAILED` · `LLM_EMPTY` · `SPEAK_IN_PROGRESS` · `CONFIG_INVALID` · `NOT_CHARACTER_MESSAGE` · `RATE_LIMITED`+40 → 다시 72 메뉴
- Then ⓐ 72 원 본문 그대로·`regenerating` 없음, alert(토스트) 1개 = `대사를 다시 만들지 못했습니다. 메뉴에서 다시 시도해 주세요.`(LLM 두 코드) / `ERROR_MESSAGES.SPEAK_IN_PROGRESS` / `ERROR_MESSAGES.CONFIG_INVALID` / `ERROR_MESSAGES.NOT_CHARACTER_MESSAGE` / `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.`. 톤 클래스: `RATE_LIMITED`만 `warning`, 나머지 5코드 `danger`(반대 클래스 없음, S2 `toastToneOf`). `/재시도/` 버튼 없음, `SERVER-RAW-MESSAGE` 없음. 다시 연 메뉴의 `재작성` 활성 ⓑ `onAuthFailure` 0회 ⓒ `regenerate` 1회
- 스펙: `Regenerate.test.tsx`

### TC-CH-082 · (S3) NOT_LAST_MESSAGE 재조회 · 종류: 자동 · 요구: R-CHAT-007 · R-CHAT-011 · 설계: F-CH-36 `stale` · D-15 · F-CH-30 · 토큰: 있음
- Given 1회째 `listMessages` [70,71,72], 2회째는 (a) 대기(deferred) 후 [70,71,72,73] (b) `NETWORK` 실패. 72 재작성 대기
- When `NOT_LAST_MESSAGE` resolve → (a) 재조회 응답 resolve (b) 재조회 실패
- Then ⓐ 토스트 `다른 메시지가 먼저 이어져 재작성할 수 없습니다. 대화를 새로 불러옵니다.`. (a) 재조회 대기(loading 커밋) 중 log 없음, 포커스는 ‹ 뒤로가 아님 → resolve 뒤 **ready 커밋 다음** 포커스 = `role=log`(waitFor로 기다림), li 4개(끝 `나도 한 잔.`) (b) log 없음, 포커스 이동 없음(‹ 아님) ⓑ T1 → T2(목록 = 재조회 응답) / T1 → T3. 포커스 요청은 ready에서만 소비(F-CH-41) ⓒ `listMessages.mock.calls` = `[['r1'], ['r1']]`(두 번째 인자 없음), `regenerate` 1회
- 스펙: `Regenerate.test.tsx`

### TC-CH-083 · (S3) 재작성 대상 사라짐 · 종류: 자동 · 요구: R-CHAT-007 · R-CHAT-011 · 설계: F-CH-34 `removed` · F-CH-36 · T19 · 토큰: 있음
- Given (a) [70,71,72]·`hasMore=false` (b) 스크롤 mock(3000/493, 첫 배치 `scrollTop=2507` — **맨 위가 아니라 첫 배치 자동 이전 로드가 일어나지 않는다**, 마운트 뒤 `listMessages` 1회 확인), 1회째 [72]·`hasMore=true`, 2회째 [70,71]·`hasMore=false` (c) [72]·`hasMore=false`
- When 72 재작성 → `NOT_FOUND`
- Then ⓐ (a) li 2개, 72 본문 없음, 토스트 `메시지를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.`, 포커스 = `role=log` (b) 재조회 ready 뒤 li 2개, 포커스 = `role=log` (c) log 없음·`아직 대화가 없습니다`, 포커스 = ‹ 뒤로 ⓑ (b) 남은 0건 + hasMore → 재로드. 포커스는 다음 ready 커밋 뒤 F-CH-30 규칙(log 있으면 log, 없으면 ‹)(F-CH-41) ⓒ (a)(c) `listMessages` 1회 (b) 2회, 2회째 정확히 `['r1']`(이전 페이지 `before` 호출 없음)
- 스펙: `Regenerate.test.tsx`

### TC-CH-084 · (S3) 재작성 인증 실패 · 종류: 자동 · 요구: R-CHAT-011 · R-CHAT-008 · 설계: F-CH-34(인증) · F-CH-16 · F-CH-29 · F-CH-39 `regeneratingId` canWrite 조건 · 토큰: 있음 → 없음(하네스)
- Given 하네스, 72 재작성 대기
- When `TOKEN_INVALID` · `LEVEL_TOO_LOW` · `TOKEN_REQUIRED` resolve
- Then ⓐ `role=note`, group 없음, `.regenerating` 없음, 72 원 본문, alert 1개 = 코드별 전환 문구, 그 alert에 `warning` 클래스 ⓑ `onAuthFailure` 1회 ⓒ `regenerate` 1회
- 스펙: `Regenerate.test.tsx`

### TC-CH-085 · (S3) 리듀서 S3 · 종류: 자동(순수) · 요구: R-CHAT-005 · R-CHAT-007 · R-CHAT-003 · 설계: F §1 S3 타입·액션 4종 · §1.1 T13~T16·T25 개정 · T27~T34 · §1.1 비고 · §1.2 `canSpeak`·`isRegenerateTarget` · 토큰: 무관
- Given 얼린 ready 상태(31~33 시엘 line), `pending`·`writing` 변형
- When S3 액션·`writeStarted{regenerate|speak}`·`writeFinished`·`writeAccessRevoked`·T1~T3·T9·T17
- Then ⓐ 해당 없음 ⓑ 초기값 10필드(`pending: null`, Q-05). T13 regenerate 허용·실패 pending 같은 참조 유지 · T14 speak 거절(같은 참조) · T15 regenerate → null · T16 speak 중 → 같은 참조 · T25 pending만 있어도 셋 다 null · T1~T3 → pending null · T27 → writing speak·pending generating, 실패 pending(같은·다른 캐릭터) 덮음 · T28 loading·send·regenerate·이미 speak·편집 중 → 같은 참조 · T29 근처 → 34 붙임·unseen 0·둘 다 null / 위쪽 → unseen 2→3 · T30 → 같은 참조 · T31 → 실패 pending(error)·writing null / T32 같은 참조 · T33 → null / T34 같은 참조 · 실패 pending은 T9·T17에도 같은 참조 · `canSpeak` 편집 중 false(canSend는 true) · writing `send`·`edit`·`delete`·`regenerate`·`speak` 중 false(실패 pending이 있어도, 잠금 표) · `isRegenerateTarget` 마지막 캐릭터 line true / 마지막 아님 / 유저 / OOC / 빈 목록 false, 실패 pending 있어도 true ⓒ api 호출 없음
- 스펙: `ui/src/state/chat.test.ts`(`describe('S3 …')` 3블록)

### TC-CH-086 · (S3) 문구 함수 · 종류: 자동(순수) · 요구: R-CHAT-011 · 설계: generate §3 · F-CH-37 · F-CH-16 `WriteAction` 확장 · labels §8.3 · 토큰: 무관
- Given `ApiError`(message `SERVER-RAW-MESSAGE`)
- When `speakErrorText(e)` · `writeErrorText(e, 'regenerate')` · `writeErrorText(인증, 'speak')`
- Then ⓐ 해당 없음 ⓑ speak: SPEAK_IN_PROGRESS 기본 문구 · LLM_FAILED/LLM_EMPTY `생성에 실패했습니다.` · CONFIG_INVALID 기본 · RATE_LIMITED 40초/기본 · NETWORK `서버에 연결할 수 없습니다.` · INTERNAL·VALIDATION_ERROR `ERROR_MESSAGES[code]`. regenerate: 위 표 + LLM 두 코드 `대사를 다시 만들지 못했습니다. 메뉴에서 다시 시도해 주세요.` · NOT_LAST_MESSAGE 재조회 문구 · NOT_CHARACTER_MESSAGE 기본 · NOT_FOUND 메시지 문구 · VALIDATION_ERROR `ERROR_MESSAGES.VALIDATION_ERROR`(generate §3 "그 밖" 행) · 인증 3종 전환 문구(speak도 같음). 서버 message 미포함 ⓒ api 호출 없음
- 스펙: `PendingBubble.test.tsx`(speakErrorText) · `Regenerate.test.tsx`(writeErrorText)

### TC-CH-087 · (S3) 늦은 생성 응답 무시 · 종류: 자동 · 요구: R-CHAT-005 · R-CHAT-007 · 설계: F-CH-31·34 비활성 분기 · F §3 `isActiveRef` · 토큰: 있음
- Given speak 대기 / regenerate 대기
- When 언마운트 → resolve 성공 · `LLM_FAILED` · `LEVEL_TOO_LOW` · `NOT_FOUND`(regenerate는 `NOT_LAST_MESSAGE`도)
- Then ⓐ 화면 없음 ⓑ `onAuthFailure`·`onBack` 0회, `ld:lastRoomId='r1'` 그대로(speak), `console.error` 0회 ⓒ 각 래퍼 1회, speak·regenerate 두 스펙 모두 `listMessages` 1회(재조회 없음)
- 스펙: `SpeakFlow.test.tsx` · `Regenerate.test.tsx`
- 참고: TC-CH-029·063과 같이 React 19는 언마운트 뒤 dispatch를 경고 없이 무시한다. 판별 지점은 콜백·저장소·재조회 호출 수다.

### TC-CH-088 · (S3) 전송은 AI 호출 없음(유지) · **폐기(S3d, CR-002 · Q-08) → TC-CH-098로 대체** — R-CHAT-006 🔒 개정으로 저장 성공 뒤 `speak('auto')` 1회가 맞는 동작이다. 아래 본문은 이력 보존이며 스펙 it은 삭제했다(`Composer.test.tsx` 주석만) · 종류: 자동 · 요구: R-CHAT-006 · 설계: F-CH-17 · A 키보드(Enter = 전송만) · 토큰: 있음
- Given ready 4건, `appendUser` → `ok(105 안녕)`, mock 목록에 `speak`·`regenerate` 포함
- When (a) `안녕` 입력 → `전송` 클릭 (b) `안녕` 입력 → Enter (c) OOC switch 켬 → `안녕` 입력 → `전송` 클릭
- Then ⓐ li 5개 ⓑ 저장 값은 TC-CH-033·034와 같음 ⓒ `appendUser` (a)(b) `[['r1', { text: '안녕', ooc: false }]]` (c) `[['r1', { text: '안녕', ooc: true }]]`, 세 경우 모두 **`speak`·`regenerate` 0회 명시**, 나머지 mock 합계 = 첫 `listMessages` 1회
- 스펙: `ui/src/chat/test/Composer.test.tsx`

### TC-CH-089 · (S3) 캐릭터 버튼 포커스 복귀 · 종류: 자동 · 요구: R-CHAT-013 · R-CHAT-005 · 설계: F-CH-38 · F §3 `lastSpeakerRef` · A 포커스 유지 · DC-05 · 토큰: 있음
- Given (a) 세바스찬 버튼 포커스 (b) 세바스찬 대기 중 / (부품) SpeakButtons 렌더
- When (a) Enter → 대기 중 `blur()` → 성공 resolve (b) 입력창 포커스 → resolve / (부품) `isDisabled` true·`speakingCharacter` 지정 → blur 또는 바깥 입력 포커스 → false·null
- Then ⓐ (a) 포커스 = `세바스찬 대사 생성` (b) 포커스 = 입력창. 중간(disabled 상태) 포커스 위치는 단언하지 않음(DC-05). (부품 경합, tc.md 083 행의 F-CH-38 항목) 생성 중 바깥으로 옮긴 뒤 해제 → 그 뒤 speak 아닌 잠금(`speakingCharacter=null`)이 body 포커스로 풀려도 포커스는 body 그대로(옛 버튼으로 끌려가지 않음) ⓑ lastSpeakerRef는 잠금 해제마다 비운다(F-CH-38 정정) ⓒ (a) `speak` 1회
- 스펙: `SpeakFlow.test.tsx` · `SpeakButtons.test.tsx`

### TC-CH-090 · (S3) 재시도 잠금 · **S3d 개정(Q-08): 저장 대기 중 「재시도」·세바스찬 disabled는 같음. 저장 응답 뒤에도 세바스찬·시엘 `disabled` 유지(자동 응답 중), 실패 말풍선은 중립 "…"로 바뀌어 「재시도」 없음, `speak` 총 2회(`[1]` = `['r1',{auto}]`) — 본문의 "응답 뒤 활성" 단언을 대체** · 종류: 자동 · 요구: R-CHAT-005 · R-CHAT-014 🔒 · 설계: F §4.3 잠금 표 `send` 행 · AU §4.1 · C §2.1 `isSpeakLocked` · C §2.12 `isRetryDisabled` · 토큰: 있음
- Given 세바스찬 실패 말풍선, `appendUser` 대기 / (부품) `isRetryDisabled=true`
- When `안녕` 전송 → resolve / (부품) 클릭
- Then ⓐ 대기 중 `세바스찬 대사 재시도`·캐릭터 버튼 disabled → 응답 뒤 활성 ⓑ writing send → null ⓒ `speak` 1회 유지. (부품) `onRetry` 0회
- 스펙: `SpeakFlow.test.tsx` · `PendingBubble.test.tsx`

### TC-CH-091 · (S3) useAutoScroll tailKey · 종류: 자동(훅) · 요구: R-CHAT-003 · 설계: C §3 v1.7 tailKey 행 · F-CH-40 · 토큰: 무관
- Given 하네스 첫 배치 완료(3000/493, `scrollTop=2507`) / 첫 배치 전(`firstId=null`)
- When `tailKey` null → `'sebastian:generating'`(내용 3100) · 위쪽(1000)에서 같은 변화 · `'ciel:generating'` → `'ciel:failed'`(3150) · 값 → null · 첫 배치 전 변화 후 `firstId=105`(2400)
- Then ⓐ 해당 없음(하네스) ⓑ `scrollTop` 3100 · 1000 유지 · 3150 · 2900 유지 · 0 유지 → 1907 ⓒ api 호출 없음
- 스펙: `ui/src/chat/test/useAutoScrollTail.test.tsx`

### TC-CH-092 · (S3) 390×565 스크린샷 · 종류: 수동 · 요구: R-CHAT-013 · R-CHAT-002 · R-CHAT-004 · 설계: C §0 · §2.11·§2.12 · §4 S3 행 · generate §0 · DC-01 · 토큰: 있음
- Given 개발 서버, 390×565, 유효 토큰 주소
- When 1행 · 세바스찬 임시 · 시엘 임시 · 실패 말풍선 · 재작성 중 · 재작성 항목 있는 메뉴를 각 1장
- Then ⓐ 1행 `[세바스찬] [시엘] … [OOC 끔]` 한 줄·가로 스크롤 없음 · 임시 말풍선 배경 `--bubble-{c}-bg`·시엘 머리 줄 거울 배치가 메시지 말풍선과 같음 · 실패 테두리 `--bubble-error-border`·`!`·재시도 · 재작성 중 흐림 0.55 + 문구 · 메뉴 약 232px ⓑ 해당 없음 ⓒ 해당 없음 — 수동 확인표 `MC-CH-16`·`MC-CH-17`
- 스펙: `ui/src/chat/test/manual-checklist.md`

### TC-CH-093 · (S3) 「재시도」 뒤 포커스 · 종류: 자동 · 요구: R-CHAT-013 · R-CHAT-005 · 설계: F-CH-32 · F-CH-38 · DC-03 · 토큰: 있음
- Given 시엘 실패 말풍선, 2회째 `speak` 대기 / (부품) 버튼 클릭 없이 `speakingCharacter='ciel'`
- When `시엘 대사 재시도` 클릭 → 응답(성공·`LLM_FAILED` 각각)
- Then ⓐ 클릭 직후 재시도 버튼 DOM 없음 → 응답 뒤 포커스 = `시엘 대사 생성` ⓑ lastSpeakerRef = ciel → 소비 ⓒ `speak` 2회
- 스펙: `SpeakFlow.test.tsx` · `SpeakButtons.test.tsx`

### TC-CH-094 · (S3) 인라인 수정 중 생성 잠금 · 종류: 자동 · 요구: R-CHAT-005 · R-CHAT-007 · 설계: F §1.2 `canSpeak` · F §4.3 잠금 표 편집 행 · D-14 · DC-10 · 토큰: 있음
- Given 세바스찬 실패 말풍선, 103 메뉴 → `수정`으로 편집기 열림
- When 캐릭터 버튼·「재시도」 클릭 → 입력 `안녕` → 편집기 `취소`
- Then ⓐ 편집 중 두 캐릭터 버튼·`세바스찬 대사 재시도` disabled, `전송` 활성(S2 그대로) → 취소 뒤 편집기 없음·버튼 활성 ⓑ editingId 103 → null ⓒ `speak` 1회 유지, `editMessage` 0회
- 스펙: `SpeakFlow.test.tsx`
- 참고: **S2와 달라진 동작.** S2 TC 중 "편집 중 캐릭터 버튼 활성"을 단언한 것은 없다(S2에는 버튼이 없었다). TC-CH-042(편집기 열 때 "하단 바 그대로")는 전송·입력만 보므로 영향 없음

### TC-CH-095 · (S3) 다른 쓰기 대기 중 캐릭터 버튼·재시도 잠금 · 종류: 자동 · 요구: R-CHAT-005 · R-CHAT-007 · 설계: F §4.3 잠금 표 `edit`·`delete`·`regenerate` 행 · F §1.2 `canSpeak` · C §2.12 `isRetryDisabled`(= `!canSpeak`) · 토큰: 있음
- Given Regenerate 픽스처 + 시엘 speak `LLM_FAILED`로 끝에 시엘 실패 말풍선(`시엘 대사 재시도` 보임)
- When (a) 72 메뉴 → `수정` → `고친 대사` → `저장`(대기) → 「재시도」 클릭 → `ok` resolve (b) 71 메뉴 → `삭제` → 확인 `삭제`(대기) → `ok(undefined)` (c) 72 `재작성`(대기) → 세바스찬 클릭 → `ok(새 text)`
- Then ⓐ 대기 중 `세바스찬 대사 생성`·`시엘 대사 생성`·`시엘 대사 재시도` 모두 disabled → 응답 뒤 모두 활성((a) 편집기 닫힘) ⓑ writing edit/delete/regenerate → null, 실패 pending 유지 ⓒ (a) `editMessage` `[[72, { text: '고친 대사' }]]` (b) `deleteMessage` `[[71]]` (c) `regenerate` `[[72]]`. 세 경우 `speak` 1회(실패 말풍선을 만든 1회) 유지
- 스펙: `Regenerate.test.tsx` · 순수 근거 `chat.test.ts` `canSpeak`(TC-CH-085)

### TC-CH-096 · (S3b) speak 월 AI 비용 한도 초과 · 종류: 자동 · 요구: R-CHAT-011 · R-CHAT-005 · R-LLM-007 · 설계: generate §3 `LLM_BUDGET_EXCEEDED` 행 · F-CH-31 ③ · F-CH-37 · labels §8.1.2 비고 · api §3.4 429 구분 · 토큰: 있음
- Given ready 4건. `speak` → `{ ok: false, error: { code: 'LLM_BUDGET_EXCEEDED', message: '이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.' } }`(래퍼 정규화 뒤 모양 — `retryAfterSec` 없음, `ApiError`에 `status` 필드는 없다). 대조용 `RATE_LIMITED`+`retryAfterSec: 40`(별도 마운트)
- When (a) 세바스찬 클릭 → resolve → (가짜 시계) 60 000ms 경과 → 실제 시계로 돌린 뒤 「세바스찬 대사 재시도」 클릭(같은 한도 실패) (b) 시엘 클릭 → 한도 실패 / 다시 마운트 → 시엘 클릭 → `RATE_LIMITED` 40
- Then ⓐ (a) 같은 자리 `pending failed sebastian` 말풍선, 화면 alert는 그 안 1개(E 토스트 없음) = `이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.`, 말풍선 글자에 숫자 없음(초·날짜·카운트다운 없음), 「재시도」 활성, group·캐릭터 버튼 그대로, `role=note` 없음(전환 없음). 60초 뒤에도 문구 그대로 (b) 한도 문구에는 `초 후` 없음, `RATE_LIMITED` 문구는 `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.`이고 한도 문구를 포함하지 않음(같은 429, `code`로만 구분) ⓑ pending failed(error = 한도). 순수: `speakErrorText(LLM_BUDGET_EXCEEDED)` = 한도 문구(message가 `SERVER-RAW-MESSAGE`여도 — code → `ERROR_MESSAGES`) ⓒ (a) 60초 경과 뒤 `speak` 1회 유지(자동 재시도 없음) → 「재시도」 뒤 `[['r1', { character: 'sebastian' }], ['r1', { character: 'sebastian' }]]`. `onAuthFailure` 0회 (b) `speak` 총 2회
- 스펙: `SpeakFlow.test.tsx` · `PendingBubble.test.tsx`(speakErrorText 행)
- 참고: 연타 → 분당 한도 `RATE_LIMITED` 전환은 서버 테스트(API-T-089) 소관이라 화면 TC에 넣지 않는다

### TC-CH-097 · (S3b) 재작성 월 AI 비용 한도 초과 · 종류: 자동 · 요구: R-CHAT-011 · R-CHAT-007 · R-LLM-007 · 설계: generate §3 `LLM_BUDGET_EXCEEDED` 행 · §3 톤 비고 · F-CH-34 그 밖 · F-CH-16 · rooms F-RM-22 v1.5.1 · 토큰: 있음
- Given Regenerate 픽스처, 72 재작성 대기 → `LLM_BUDGET_EXCEEDED`(같은 모양)
- When resolve → (가짜 시계) 60 000ms 경과
- Then ⓐ 72 원 본문 `분부대로 하겠습니다, 도련님.` 그대로, `regenerating` 없음, alert(토스트) 1개 = 한도 문구, 클래스 `warning`(`danger` 아님), `/재시도/` 버튼 없음, `role=note` 없음·group 그대로(전환 없음) ⓑ writing null. 순수: `writeErrorText(LLM_BUDGET_EXCEEDED, 'regenerate')` = 한도 문구, `toastToneOf(LLM_BUDGET_EXCEEDED)` = `warning`(`LLM_FAILED`·`SPEAK_IN_PROGRESS`는 `danger` 유지) ⓒ `regenerate` `[[72]]`(60초 뒤에도 자동 재시도 없음), `listMessages` 1회(재조회 없음), `onAuthFailure` 0회
- 스펙: `Regenerate.test.tsx`(통합 · writeErrorText 행) · 톤 순수 근거는 rooms **TC-RM-029**(`ui/src/state/writeRules.test.ts` 기존 `toastToneOf` 표에 행 추가 — 톤 테스트는 한 곳)

### TC-CH-098 · (S3d) 전송 → 자동 응답 호출 · 종류: 자동 · 요구: R-CHAT-006 🔒 · R-CHAT-014 🔒 · R-MSG-009 🔒 · R-MSG-003 🔒 · 설계: AU §3 F-CH-17 ③·⑥ · F-CH-42 · AU §5 201 행 · A 키보드(S3d Enter) · 토큰: 있음
- Given ready 4건, `appendUser`·`speak` 각각 deferred
- When (a) `안녕` 입력 → 전송 클릭 (b) Enter (c) OOC 켬 → 클릭 → 저장 대기 확인 → 저장 resolve(105 / OOC 105)
- Then ⓐ 표시 단언은 TC-CH-099(유저 말풍선·중립)·TC-CH-034(OOC)에 위임 — 이 TC는 호출 순서 전용 ⓑ writing send → speak auto(호출로 관찰) ⓒ 저장 응답 **전** `speak` 0회 · `appendUser` `[['r1', { text: '안녕', ooc }]]` → 저장 resolve **뒤** `speak` 정확히 `[['r1', { character: 'auto' }]]`, 본문 키 `['character']`뿐 · 캐릭터 값 speak 0회 · `regenerate`·`editMessage`·`deleteMessage` 0회 · `listMessages` 1회
- 스펙: `AutoReply.test.tsx`

### TC-CH-099 · (S3d) T35 한 커밋 — 저장 중 → 생성 중 · 종류: 자동 · 요구: R-CHAT-014 🔒 · R-CHAT-006 🔒 · R-CHAT-002 🔒 · R-CHAT-004 · R-CHAT-013 · 설계: AU §0 S1·S2 · §1.1 타입·F-CH-44 · §1.2 T35·T36 · §1.3 · §2.1 `NeutralPending`(생성 중)·CSS `neutral`·테스트 클래스 키 · §2.3 Composer·SpeakButtons·index `speakingCharacter` 배선 · §4.1 `send`·`speak+auto` 행 · §4.2-1 · §6 `pendingDots`·`autoPendingStatus` · §7 중립 생성 중·잠금 표시·포커스 · §8 D-18·D-20 · 토큰: 있음
- Given ready 4건, `appendUser`·`speak` deferred
- When `안녕` 입력 → 전송 클릭 → (S1 관찰) → 세바스찬·시엘·⋯ `disabled` 속성 관찰 시작 → 저장 resolve(105) → 입력에 `다음` → 103 contextmenu
- Then ⓐ S1: `li` 4개(낙관 표시 없음), `.pending` 0, 세바스찬·시엘·전송·⋯ disabled, 입력 `readOnly`·값 `안녕`, group `aria-busy="true"` → S2(한 커밋): `disabled` 속성 변화 **0건**, `li` 6개, 5번째 `user`·`어떠한 의지`·`안녕`, 6번째 루트 `pending`·`neutral`(`root`·`character`·`sebastian`·`ciel`·`user`·`failed` 없음), `img`·`.name`·`time` 없음, log 안 `role=status`가 그 루트(`aria-live=polite`, 글자 `응답을 만드는 중`), `…` `aria-hidden`, tabindex·aria-haspopup·버튼 없음. 네 버튼 disabled 유지, 입력 `''`·`readOnly` 아님·포커스, `aria-busy`≠`true`, `다음` 입력되고 전송 disabled, 메뉴 dialog 없음 ⓑ 저장소 키 `ld:lastRoomId`뿐 · `onAuthFailure` 0 · writing `{speak,'auto'}`·pending `{auto,generating}`(표시로 관찰) ⓒ `appendUser` `[['r1', { text: '안녕', ooc: false }]]` · `speak` `[['r1', { character: 'auto' }]]`
- 순수(같은 번호, `chat.test.ts`): T35 맨 아래 → 메시지 붙임·unseen 0·writing `{speak,'auto'}`·pending `{auto,generating,null}`·입력 불변 / 위쪽 → unseen +1 / 이전 pending(세바스찬·시엘·중립 실패) → auto generating / `editingId` 유지(D-17) / T36: ready·캐릭터 생성 중·auto 생성 중·edit·regenerate·loading → 같은 참조 / T35 뒤 `canSend`·`canSpeak` false / `speakingCharacterOf`: 세바스찬 speak → `sebastian`, 시엘 → `ciel`, auto·send·regenerate·없음·초기값 → null
- 부품(`PendingBubble.test.tsx`): `generating('auto')` → 루트 `pending`·`neutral`, 화자 클래스 없음, img 0, `.name`·`.head`·`time` 없음, `.body.bodyBox` 있음 · role=status = 루트, `응답을 만드는 중` 포함·`대사를 만드는 중` 미포함, `…` aria-hidden, alert·버튼·tabindex·aria-haspopup 없음, contextmenu 기본 동작 유지
- 스펙: `AutoReply.test.tsx` · `ui/src/state/chat.test.ts` · `PendingBubble.test.tsx`

### TC-CH-100 · (S3d) 결과 자리 2종 · 종류: 자동 · 요구: R-CHAT-014 🔒 · R-CHAT-002 🔒 · R-MSG-009 🔒 · R-CHAT-007 · R-MSG-006 · 설계: AU §1.1 `speakSucceeded`(자리 = `message.speaker`) · §3 F-CH-42 성공 · F-CH-44 · §5 201 행·재작성 줄 · §7 포커스 · 토큰: 있음
- Given 전송 → 저장 201 → 중립 "…"(TC-CH-099 결과), 입력 `''` 확인 뒤 `다음` 입력
- When (a) speak resolve `speaker:'sebastian'` 106 (b) `speaker:'ciel'` 106 (c) (a) 뒤 결과 말풍선 contextmenu → 「재작성」
- Then ⓐ (a)(b) `.pending` 0, `li` 6개, 마지막 루트 `character` + (a) `sebastian`(왼쪽, 아바타 `/embed/img/sebastian.png`, 이름 `세바스찬`) (b) `ciel`(오른쪽, `/embed/img/ciel.png`, `시엘`), 다른 캐릭터·`neutral` 없음, 본문 = 응답 text, 5번째 유저 `안녕` 유지, 세바스찬·시엘·전송·⋯ 활성, 포커스 입력창 그대로(캐릭터 버튼으로 옮기지 않음), 입력값 `다음` 유지 ⓑ writing·pending null(표시로 관찰) ⓒ (a)(b) `speak` `[['r1', { character: 'auto' }]]` 1회, `listMessages` 1회 (c) `regenerate` `[[106]]` 1회, `speak` 추가 0회
- 스펙: `AutoReply.test.tsx`

### TC-CH-101 · (S3d) 저장 실패 → AI 호출 0회 · 종류: 자동 · 요구: R-CHAT-006 🔒 · R-CHAT-011 · R-CHAT-014 🔒 · R-CHAT-008 🔒 · 설계: AU §3 F-CH-17 ⑤ · §1.3 (이탈) S1 저장 실패 · §5 실패 행 · 주 문서 §6.6 · 토큰: 있음 / 있음 → 없음
- Given ready (c)만 세바스찬 실패 말풍선(`LLM_FAILED`) 표시 중
- When `안녕` 전송 → `appendUser` 실패: (a) `INTERNAL` · `RATE_LIMITED`+40 (b) `TOKEN_INVALID`(하네스) (c) `INTERNAL`
- Then ⓐ (a) E 토스트 `ERROR_MESSAGES.INTERNAL` / `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.`, 입력 `안녕` 유지·readOnly 아님, `li` 4개, `.pending` 0, 세바스찬·시엘·전송 활성, note 없음 (b) note `열람 전용 - 대화 참여는 등급 회원만`, group 없음, `.pending` 0, `li` 4개, 첫 alert `인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.` (c) 토스트 + 목록 끝 루트 `pending`·`failed`·`sebastian`(중립 아님) 그대로, 「세바스찬 대사 재시도」 활성, `li` 5개 ⓑ (a) `onAuthFailure` 0 (b) 1 · writing null·pending 이전 값 그대로(순수 TC-CH-053 S3d) ⓒ `appendUser` 1회, `speak` 0회((c)는 처음 세바스찬 1회뿐), `regenerate` 0회
- 스펙: `AutoReply.test.tsx`

### TC-CH-102 · (S3d) 중립 실패 · 종류: 자동 · 요구: R-CHAT-014 🔒 · R-CHAT-011 · R-CHAT-005 🔒 · R-LLM-007 🔒 · R-CHAT-013 · 설계: AU §1.2 T31 · §2.1 `NeutralPending`(실패)·`neutral`·`retryRow` · §3 F-CH-42 ③ · F-CH-37 · §5 그 밖 행·레이트리밋 줄 · §6 `speakRetry`·`autoRetryAriaLabel` · §7 중립 실패·포커스 · generate §3 · 토큰: 있음
- Given 전송 → 저장 201 → 중립 "…"
- When speak(auto) 실패: `LLM_FAILED`(502) · `SPEAK_IN_PROGRESS`(409) · `RATE_LIMITED`(429, retryAfterSec 40) · `LLM_BUDGET_EXCEEDED`(429) · `NETWORK`
- Then ⓐ `li` 6개, 마지막 루트 `pending`·`neutral`·`failed`(화자 클래스·img·role 속성 없음), log 안 status 없음, alert 1개(루트 안) 문구 각각 `생성에 실패했습니다.` · `이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요.` · `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.` · `이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.` · `서버에 연결할 수 없습니다.`, `SERVER-RAW-MESSAGE` 없음, 「재시도」(접근 이름 `응답 재시도`, 글자 `재시도`, 활성, 루트 안), 5번째 유저 `안녕` 유지, 세바스찬·시엘·⋯ 활성, 포커스 입력창 그대로, note 없음, 토스트 없음(alert 1개) ⓑ writing null·pending `{auto, failed, error}`(표시로 관찰) · `onAuthFailure` 0 ⓒ `speak` `[['r1', { character: 'auto' }]]` 1회(자동 재시도 없음)
- 부품(`PendingBubble.test.tsx`): `failed('auto', err)` `LLM_FAILED`·`CONFIG_INVALID`·`RATE_LIMITED`+40 → 루트 `pending`·`neutral`·`failed`, 화자 클래스·img·role·status 없음, alert = `speakErrorText(error)`, `!` aria-hidden, `응답 재시도` 버튼(글자 `재시도`, `.retryRow` 안, 코드와 무관하게 항상) → 클릭 `onRetry` `[['auto']]`, `대사 재시도` 이름 버튼 없음 / `isRetryDisabled` → disabled·`onRetry` 0회
- 순수(`chat.test.ts`, TC-CH-085 S3d): T31 auto → pending `{auto, failed, LLM_FAILED}`
- 스펙: `AutoReply.test.tsx` · `PendingBubble.test.tsx`

### TC-CH-103 · (S3d) 중립 재시도 · 종류: 자동 · 요구: R-CHAT-014 🔒 · R-CHAT-013 · R-MSG-003 🔒 · 설계: AU §3 F-CH-32 · F-CH-31 · §1.2 T27 · §2.3 ChatScreen `onRetrySpeak` → `retrySpeak` · §5 중립 실패 「재시도」 줄 · §7 포커스 · §8 D-19 · 토큰: 있음
- Given 중립 실패(`LLM_FAILED`), 다음 speak deferred
- When 「응답 재시도」 클릭(userEvent) → 응답 (a) 성공(시엘 106) (b) `LLM_FAILED`
- Then ⓐ 클릭 직후 포커스 = 히스토리 log, 「응답 재시도」 없음, `.failed` 0, 중립 "…" 1개(목록 끝 같은 자리), status `응답을 만드는 중`, `li` 6개(유저 말풍선 추가 0), 세바스찬·시엘 disabled → 응답 뒤에도 포커스 log ⓑ writing speak auto(T27, 표시로 관찰) ⓒ `speak` `[['r1', { character: 'auto' }], ['r1', { character: 'auto' }]]`, `appendUser` 1회(재전송 없음)
- 스펙: `AutoReply.test.tsx`

### TC-CH-104 · (S3d) 끼어들기 0회 · 종류: 자동 · 요구: R-CHAT-014 🔒 · R-CHAT-006 🔒 · R-MSG-007 🔒 · 설계: AU §4.2 1~3 · §3 F-CH-17 ⑥(팻말 유지) · F-CH-42(팻말 해제) · §8 D-18 · §7 키보드 · 토큰: 있음
- Given ready, `appendUser`·`speak` deferred, 입력 `안녕`
- When ① 같은 act 안 `전송`·세바스찬·시엘·`전송` 클릭 → 세바스찬 클릭·Enter ② 저장 resolve 후 send 이어짐 뒤 **같은 act(커밋 전)** 세바스찬·시엘 클릭·Enter ③ 입력 `''` 확인 → `끼어들기` → 세바스찬·시엘·전송 클릭·Enter ④ speak resolve(세바스찬 106)
- Then ⓐ ④ 뒤 세바스찬 활성 ⓑ 쓰기 팻말이 저장 시작부터 생성 끝까지 유지(호출로 관찰. 상태 쪽 조건은 TC-CH-099 한 커밋·순수 `canSend`·`canSpeak` false) ⓒ ① 뒤 `speak` 0회·`appendUser` 1회 → ② 뒤 `speak` `[['r1', { character: 'auto' }]]` → ③ 뒤 그대로, `appendUser` 1회, `regenerate` 0회 → ④ 뒤 `speak` 1회
- 스펙: `AutoReply.test.tsx`

### TC-CH-105 · (S3d) 중립 실패에서 나가는 길 · 종류: 자동 · 요구: R-CHAT-014 🔒 · R-CHAT-005 🔒 · R-CHAT-006 🔒 · 설계: AU §1.2 T27·T35(이전 pending 교체) · §1.3 · §5 중립 실패 출구 · generate §6 `null + 중립 실패` 행 · 토큰: 있음
- Given 중립 실패(`LLM_FAILED`)
- When (a) 「시엘」 클릭(speak deferred) (b) `다시` 전송 → 저장 대기 → 저장 resolve(107)
- Then ⓐ (a) 중립·`.failed` 0, `.pending` 1 = 루트 `pending`·`character`·`ciel`, status `시엘 대사를 만드는 중`, `li` 6개 (b) 저장 대기 중 마지막 루트 `failed` 유지·「응답 재시도」 disabled → 201 뒤 `.failed` 0·「응답 재시도」 없음, `li` 7개, 6번째 `다시`, 마지막 루트 `pending`·`neutral`, status `응답을 만드는 중` ⓑ (a) T27 ciel (b) T13 pending 유지 → T35 교체(표시로 관찰) ⓒ (a) `speak` `[['r1', { character: 'auto' }], ['r1', { character: 'ciel' }]]` (b) `appendUser` `[['r1', { text: '안녕', ooc: false }], ['r1', { text: '다시', ooc: false }]]`, `speak` `[['r1', { character: 'auto' }], ['r1', { character: 'auto' }]]`
- 스펙: `AutoReply.test.tsx`

### TC-CH-106 · (S3d) 자동 응답 인증·방 없음·토큰 없음 · 종류: 자동 · 요구: R-CHAT-014 🔒 · R-CHAT-011 · R-CHAT-008 🔒 · R-CHAT-009 🔒 · R-ROOMS-004 · 설계: AU §3 F-CH-42 ①② · §1.2(T33·T25) · §5 인증 3종·NOT_FOUND 행 · §7 읽기 전용 행 · F-CH-39 · 토큰: 있음 → 없음 / 없음
- Given (a)(b) 전송 → 저장 201 → 중립 "…"((a)는 하네스) (c) `READ_ONLY_VIEWER`
- When (a) speak(auto) `TOKEN_INVALID` · `LEVEL_TOO_LOW` · `TOKEN_REQUIRED` (b) `NOT_FOUND` (c) 렌더만
- Then ⓐ (a) `.pending` 0(DOM에 없음), group·`/세바스찬|시엘|응답 재시도/` 버튼 없음, note 안내, `li` 5개(유저 `안녕`·`어떠한 의지` 남음), alert 1개 = 코드별 전환 문구·`warning`, 포커스 ‹ (b) alert 없음, `.pending` 0 (c) group·전송·「응답 재시도」 없음, 중립 0, note 안내 ⓑ (a) `onAuthFailure` 1회 (b) `onBack` 1회, 그 시점 `ld:lastRoomId` 없음 (c) 저장소 키 `ld:lastRoomId`뿐(토큰 저장 없음) ⓒ (a)(b) `speak` `[['r1', { character: 'auto' }]]` 1회 (c) `appendUser`·`speak` 0회
- 스펙: `AutoReply.test.tsx`

### TC-CH-107 · (S3d) 편집기 열린 채 전송(D-17) · 종류: 자동 · 요구: R-CHAT-006 🔒 · R-CHAT-014 🔒 · R-CHAT-007 🔒 · R-CHAT-013 · 설계: AU §8 D-17 · §1.2 T35(`editingId` 유지) · §2.3 `isEditSaveLocked`·InlineEditor `isSaveLocked` · §6 `editSaveLockedNote` · §7 잠긴 저장 버튼 · components.md §2.7 · generate §6 편집 저장 열 · DC-10 · 토큰: 있음
- Given 103 인라인 수정 열림(메뉴 「수정」)
- When (a) `안녕` 전송 → 저장 201 → 편집 내용 `새 본문` → 저장 클릭 → speak resolve(세바스찬) → 취소 (b) 저장 201 → 편집 「취소」 → speak resolve(시엘) (부품) InlineEditor `isSaveLocked` true / false, 내용 `새 본문`
- Then ⓐ (a) 편집기(group `메시지 수정`) 같은 요소로 유지, 편집 입력 `새 본문`·readOnly 아님, 저장 disabled + `aria-describedby` 대상 글자 `응답을 만드는 중에는 저장할 수 없습니다`, 취소 활성, 세바스찬·시엘 disabled → 결과 뒤 저장 활성·안내 글자 없음, 세바스찬·시엘 계속 disabled(편집기 열림, DC-10) → 취소 → 편집기 없음·세바스찬 활성 (b) 취소 즉시 편집기 없음, 중립 1개 유지, 세바스찬 disabled → 결과 뒤 세바스찬·시엘 활성 (부품 true) 저장 disabled·안내 연결, 취소 활성, 입력 readOnly 아님 (부품 false) 저장 활성·안내 없음 ⓑ `editingId` 유지(순수 TC-CH-099 T35) ⓒ (a)(b) `speak` `[['r1', { character: 'auto' }]]` 1회, `editMessage` 0회 (부품 true) `onSave` 0회·`onCancel` 1회 (부품 false) `onSave` `[['새 본문']]`
- 스펙: `AutoReply.test.tsx`

### TC-CH-108 · (S3d) 작성자 표기 · **S3e 일부 대체 → TC-CH-118**(메뉴 머리 줄 `authorName` 단언 → 버튼 이름 `{이름} 대사 …`. Bubble·`userAuthorLabel`·읽기 전용 단언은 유지) · 종류: 자동(순수·부품·화면) · 요구: R-CHAT-002 🔒 · R-AUTH-004 🔒 · R-CHAT-008 🔒(읽기 전용 쪽) · 설계: AU §2.2 `userAuthorLabel`·Bubble·MessageMenuSheet `nameOf` · §3 F-CH-43 · §6 `unknownAuthor` 삭제 · §7 읽기 전용 행 · §8 D-21 · components.md §2.2 user 행·§2.8 · labels `messageMenuHeader` · 토큰: 무관(순수·부품) · 있음(메뉴) · 없음(읽기 전용)
- Given 순수 함수 · Bubble 부품 · 103 `authorName` `미샤`/`null` 페이지 · 읽기 전용 + 105 `authorName null`
- When `userAuthorLabel` 4값 · Bubble 렌더 4값 · 103 contextmenu · READ_ONLY 렌더
- Then ⓐ Bubble: `어떠한 의지` → `어떠한 의지`, `미샤` → `미샤`(그리고 `어떠한 의지` 글자 없음 — 치환 금지), `null`·`''` → `어떠한 의지`, `이름 없음` 없음 / 메뉴 머리 `미샤 · …` · `어떠한 의지 · …`, `이름 없음` 없음 / 읽기 전용: 103 `미샤`, 105 `어떠한 의지` ⓑ `USER_DISPLAY_NAME === '어떠한 의지'` · `userAuthorLabel` 반환 `어떠한 의지`·`미샤`·`어떠한 의지`·`어떠한 의지` ⓒ 읽기 전용 `speak` 0회(순수·부품은 래퍼 미호출 — 모킹만)
- 스펙: `AutoReply.test.tsx` · `Bubble.test.tsx`(TC-CH-008 S3d)

### TC-CH-109 · (S3d) 390×565 자동 응답 판 스크린샷(수동) · 종류: 수동 · 요구: R-CHAT-013 · R-CHAT-014 🔒 · R-CHAT-002 🔒 · 설계: AU §0(구성안 ui-layout-03 §2.2·§2.4) · §2.1 CSS `neutral`·높이 · §7 · 토큰: 있음
- Given 유효 토큰 주소, 맨 아래에서 대화 중인 방(개발 서버)
- When `안녕` 전송 → ① 자동 생성 중 ② 자동 실패(가짜 제공자 실패 또는 `CONFIG_INVALID`) 스크린샷
- Then ⓐ `manual-checklist.md` MC-CH-19 기대(중립 가운데·테두리만·배경 없음·약 48px, 실패 약 90px·「재시도」 가운데, 유저 머리 줄 `어떠한 의지 · 시각`) ⓑ — (화면 측정 전용, 상태는 TC-CH-099·102) ⓒ — (api 단언은 TC-CH-098)
- 스펙: 없음(수동 — MC-CH-19)

### TC-CH-110 · (S3e) 토큰 있음 버튼 줄 렌더 · 종류: 자동(화면·부품) · 요구: R-CHAT-007 🔒 · R-CHAT-002 🔒 · R-CHAT-013 🔒 · 설계: AC §0 · §1 BubbleActions DOM·스타일 표·테스트 클래스 키 · §2 `MessageItem`(D-28) · §4 버튼 줄·「수정」·「삭제」 행 · §5 F-CH-45 · §8 `bubbleActionsAriaLabel`·`editActionAriaLabel`·`deleteActionAriaLabel` · 토큰: 있음
- Given `WRITER_VIEWER`, 픽스처 101 시엘 line · 102 세바스찬 line · 103 유저 line(`authorName` `어떠한 의지`) · 104 OOC(마지막이 OOC — 재작성 대상 없음) / (부품) `BubbleActions` 4변형, `canRegenerate=false`·`isDisabled=false`·`shouldFocusEdit=false`
- When 마운트한다 / 부품의 「수정」·「삭제」를 누른다
- Then ⓐ 말풍선 4개마다 같은 `li` 안 Bubble 루트(`root`) **바로 다음 형제**로 `group` `시엘 말풍선 작업` · `세바스찬 말풍선 작업` · `어떠한 의지 말풍선 작업` · `[지시] 말풍선 작업`. 그 안 button 접근 이름 `{이름} 대사 수정`(글자 `수정`) → `{이름} 대사 삭제`(글자 `삭제`) 순서, 모두 활성. 그룹 클래스 `actions` + 변형 키 정확히 하나(`ciel`·`sebastian`·`user`·`ooc`). 「삭제」만 `danger` 래퍼 안 ⓑ 저장소 키 `ld:lastRoomId`뿐 · (부품) `onEditFocusDone` 0회(포커스 요청 없음) ⓒ `listMessages` `[['r1']]`, `appendUser`·`editMessage`·`deleteMessage`·`speak`·`regenerate` 0회 · (부품) 클릭 → `onEdit` `[[message]]`·`onDelete` `[[message]]`, `onRegenerate` 0회
- 스펙: `ui/src/chat/test/MessageActions.test.tsx` · `ui/src/chat/test/BubbleActions.test.tsx`

### TC-CH-111 · (S3e) 「재작성」 표시 조건(TC-CH-079 대체) · 종류: 자동(화면·순수·부품) · 요구: R-CHAT-007 🔒 · R-MSG-006 🔒 · 설계: AC §4 「재작성」 행 · §5 F-CH-52 `regenerateTargetIdOf` · §1 `canRegenerate`(false면 DOM 없음) · §2 `regenerateTargetId` 배선 · 토큰: 있음
- Given 재작성 픽스처 70 시엘 line · 71 OOC · 72 세바스찬 line(마지막) / 변형 [70, 72, 73 유저] · [70, 72, 74 OOC] · 72 마지막 + 시엘 `LLM_FAILED` 실패 말풍선이 목록 끝 / (순수) 얼린 `ChatState` / (부품) `canRegenerate` true·false
- When 마운트한다 / `regenerateTargetIdOf(s)`를 부른다 / 부품을 렌더하고 「재작성」을 누른다
- Then ⓐ 72 마지막 → `세바스찬 말풍선 작업` 그룹만 `수정` → `재작성` → `삭제`, 시엘(캐릭터지만 마지막 아님)·`[지시]` 그룹엔 재작성 없음 · 마지막 유저·OOC → 화면 어디에도 `/대사 재작성$/` 버튼 없음 · 실패 말풍선이 끝에 있어도 세바스찬 그룹에 재작성, 실패 `li` 안 group 0 · (부품) false면 「재작성」이 DOM에 없다(비활성 아님), true면 `세바스찬 대사 재작성`이 `danger` 래퍼 밖 ⓑ (순수) 시엘 line 마지막 → 33 · 세바스찬 line 마지막 → 32 · 유저 → null · OOC → null · 빈 목록 → null · `pending`(실패·생성 중)·`editingId`와 무관(33) · `isRegenerateTarget(s, last.id)`와 일치 · 입력 불변 ⓒ 표시만 — `regenerate` 0회, 실패 변형 `speak` `[['r1', { character: 'ciel' }]]` · (부품) 클릭 → `onRegenerate` `[[message]]`
- 스펙: `MessageActions.test.tsx` · `ui/src/state/chat.test.ts` · `BubbleActions.test.tsx`

### TC-CH-112 · (S3e) 읽기 전용 버튼 줄 미렌더(TC-CH-022 대체) · 종류: 자동 · 요구: R-CHAT-008 🔒 · R-CHAT-007 🔒 · 설계: AC §9 · §2 `renderHistory` `actions={canWrite ? … : undefined}` · §3 Bubble 삭제 목록 · 토큰: 없음
- Given `READ_ONLY_VIEWER`, S1 픽스처 4건
- When 마운트 → 첫 말풍선 `contextmenu` → 가짜 시계로 pointer/mouse down → 600ms → up
- Then ⓐ group `/말풍선 작업/` 0개, button `/수정|재작성|삭제/` 없음, 글자 `수정`·`삭제` 없음, 각 `li` 자식은 Bubble 하나뿐, 말풍선 루트 `tabindex`·`aria-haspopup` 없음, `dialog`·`menu`·`textbox` 없음 ⓑ `contextmenu` `fireEvent` 반환 `true`(기본 동작 유지) ⓒ `listMessages` 1회, 쓰기 래퍼 없음
- 스펙: `ChatScreen.test.tsx`

### TC-CH-113 · (S3e) 말풍선 메뉴 제거(쓰기 판) · 종류: 자동 · 요구: R-CHAT-007 🔒 · 설계: AC §3 · §9 2행 · §10 D-24 · §8 삭제 키(`messageMenuAriaLabel`·`messageMenuHeader`) · 토큰: 있음
- Given `WRITER_VIEWER`, 픽스처 4건
- When 102 말풍선 루트에 `contextmenu` → `keyDown` Shift+F10 → (가짜 시계) pointer/mouse down → 600ms → up
- Then ⓐ 모든 말풍선 루트에 `tabindex`·`aria-haspopup`·`aria-keyshortcuts`·`menuEnabled` 없음, log 안 `[aria-haspopup]` 0개, 세 조작 뒤 `dialog`(`메시지 메뉴` 포함) 없음 ⓑ `contextmenu`·`keyDown` `fireEvent` 반환 `true`(preventDefault 없음 = 브라우저 기본 동작) ⓒ `editMessage`·`deleteMessage`·`regenerate` 0회
- 스펙: `MessageActions.test.tsx`

### TC-CH-114 · (S3e) 비활성 · 종류: 자동(화면·부품) · 요구: R-CHAT-007 🔒 · R-CHAT-005 🔒 · 설계: AC §4 `isActionLocked` 표 · §10 D-27 · §1 `isDisabled` · auto.md §4.1 · 토큰: 있음
- Given `WRITER_VIEWER`. deferred 대기: ① 전송 저장 ② 자동 응답 생성(저장 201 뒤 `speak` auto) ③ 세바스찬 생성 ④ 103 수정 저장 ⑤ 102 삭제(확인 시트 「삭제」 뒤) ⑥ 재작성(재작성 픽스처 72) ⑦ 방 이름 변경(⋯ → 이름 변경 → 저장) / ⑧ 103 인라인 수정 중(저장 전) / ⑨ 세바스찬 `LLM_FAILED` 실패 말풍선만 / (부품) `isDisabled` true → false
- When 모든 버튼 줄 버튼을 `fireEvent.click` → 대기를 resolve(①은 저장·생성 둘 다) / ⑧ 편집 취소
- Then ⓐ ①~⑦ 모든 그룹 버튼 `disabled`(숨기지 않음), 눌러도 편집기(`메시지 수정`)·확인 시트(`alertdialog`) 수가 늘지 않음 → 응답 뒤 모두 활성 · ⑧ 103 그룹 없음(편집기 자리), 나머지 3그룹 `disabled` → 취소 뒤 4그룹 활성 · ⑨ 활성 · (부품) 3버튼 네이티브 `disabled`, `aria-disabled` 없음, `hidden` 아님 → false면 활성 ⓑ `isActionLocked = !canSpeak(state) ∨ roomBusy !== null`(표시로 관찰) ⓒ ①~⑧ 클릭 전후 `editMessage`·`deleteMessage`·`regenerate` 호출 수 불변 · ⑧ `editMessage` 0회 · ⑨ `speak` `[['r1', { character: 'sebastian' }]]` · (부품) 핸들러 0회
- 스펙: `MessageActions.test.tsx` · `BubbleActions.test.tsx`

### TC-CH-115 · (S3e) 「수정」 위임·포커스 · 종류: 자동(화면·부품) · 요구: R-CHAT-007 🔒 · R-MSG-004 · R-CHAT-013 🔒 · 설계: AC §5 F-CH-46 · F-CH-49 · F-CH-20(포커스만) · F-CH-50 · §6 [수정] · §7 포커스 목적지 · §10 D-26 · 토큰: 있음
- Given `WRITER_VIEWER` 4건 / (D-17) 103 편집기를 연 채 `안녕` 전송 → 저장 201 → `speak`(auto) 대기 / (부품) `shouldFocusEdit=true`, `isDisabled` false·true
- When 103 「수정」 클릭 → (a) 저장 → 200 (b) 「취소」 (c) Esc / (D-17) 편집 「취소」 → `speak` resolve / (부품) 렌더
- Then ⓐ 「수정」 → 시트 없이 group `메시지 수정`, textbox `수정할 내용` = 원문·포커스·커서 끝, 103 그룹 없음(042) · (a) 본문 교체·편집기 없음 → 포커스 = `어떠한 의지 대사 수정`(활성)(043) · (b)(c) 원문 그대로 → 포커스 = 같은 「수정」(044) · (D-17) 취소 → 편집기 없음, 103 `li` 안 「수정」 `disabled`(전송된 105도 같은 이름 `어떠한 의지 말풍선 작업`이라 103 `li`로 범위를 좁혀 조회) → 포커스 = 히스토리 log → 생성 끝 뒤 103 「수정」 활성, 포커스 log 그대로 · (부품) 활성이면 그 「수정」에 포커스, `disabled`면 포커스 안 감 ⓑ `editingId` null 복귀 · `editFocusId` 소비(부품 `onEditFocusDone` `[[true]]` / `[[false]]` — false면 호출 쪽이 log) ⓒ (a) `editMessage` `[[103, { text: '새 본문' }]]` · (b)(c)(D-17) `editMessage` 0회 · (D-17) `speak` `[['r1', { character: 'auto' }]]`
- 스펙: `MessageActions.test.tsx`(042·043·044 개정 it 포함) · `BubbleActions.test.tsx`

### TC-CH-116 · (S3e) 「삭제」 위임·포커스 · 종류: 자동 · 요구: R-CHAT-007 🔒 · R-MSG-005 · R-CHAT-013 🔒 · 설계: AC §5 F-CH-47 · F-CH-23 · F-CH-28 · §6 [삭제] · §7 포커스 목적지 · §8 확인 문구 · 토큰: 있음
- Given `WRITER_VIEWER` 4건(대상 103) / 단일 메시지 101 페이지(`hasMore` true·false)
- When 103 「삭제」(userEvent) → 「취소」 / 다시 「삭제」 → 「삭제」(대기 → 204) / `INTERNAL` / `NOT_FOUND` / 101 「삭제」 → 「삭제」
- Then ⓐ `alertdialog` `이 메시지를 삭제할까요?`·본문 `삭제한 메시지는 되돌릴 수 없습니다.`·첫 포커스 `취소` → 취소 → 시트 없음, `li` 4, 포커스 = `어떠한 의지 대사 삭제` · 삭제 대기 중 시트 두 버튼 `disabled` → 204 → `li` 3, 그 말풍선·그룹 없음, 포커스 = log · `INTERNAL` → 토스트 `ERROR_MESSAGES.INTERNAL`, 시트 닫힘, `li` 4, 포커스 = 그 「삭제」 · `NOT_FOUND` → 제거·토스트 없음 · 0건 + `hasMore` → 재조회 뒤 `scrollTop=2507` / 0건 + false → `아직 대화가 없습니다` ⓑ `ld:lastRoomId='r1'` 유지 · `onAuthFailure` 0회 ⓒ 취소 `deleteMessage` 0회 · 삭제 `[[103]]` · 단일 `[[101]]`, `hasMore`면 `listMessages` 2회(2번째 `['r1']`), 아니면 1회
- 스펙: `MessageActions.test.tsx`(045·046 개정 it 포함)

### TC-CH-117 · (S3e) 「재작성」 위임·포커스 · 종류: 자동(화면·부품) · 요구: R-CHAT-007 🔒 · R-CHAT-005 🔒 · R-MSG-006 🔒 · R-CHAT-013 🔒 · 설계: AC §5 F-CH-48 · F-CH-51 · F-CH-34 · F-CH-41 · §6 [재작성] · §8 재작성 실패 문구(D-30) · 토큰: 있음
- Given 재작성 픽스처(72 마지막), `regenerate` deferred. 화면은 「S3e 공통 전제」의 재작성 누름(blur → `fireEvent.click`) / (부품) userEvent 클릭 → disabled 전에 blur
- When 「재작성」 → (a) 200 (b) 대기 중 입력창에 포커스 → 200 (c) `LLM_FAILED` / (부품) `isDisabled` true → false를 두 번, 그사이 다른 곳 포커스, 누르지 않은 경우
- Then ⓐ `dialog`·`alertdialog` 없음, 대기 중 72 루트 `regenerating`·본문 `aria-busy="true"`·status `다시 쓰는 중…`, 모든 버튼 줄·`세바스찬 대사 생성`·`시엘 대사 생성`·`전송` `disabled`, 포커스 body → (a) 본문 교체, 포커스 = `세바스찬 대사 재작성`, 버튼 줄 활성 (b) 포커스 입력창 그대로 (c) 토스트 1개 `대사를 다시 만들지 못했습니다. 재작성을 다시 눌러 주세요.`, `/메뉴에서/` 없음, 원 본문, 「재작성」 활성·포커스. `NOT_LAST_MESSAGE`·`NOT_FOUND`는 TC-CH-082·083(포커스 log) · (부품) 잠금 해제 뒤 같은 「재작성」 포커스, 두 번째 해제엔 끌어오지 않음 · 옮겼으면 그 자리 · 안 눌렀으면 이동 없음 ⓑ writing regenerate → null(표시로 관찰) · `onAuthFailure` 0회 ⓒ `regenerate` `[[72]]`(인자 하나), `speak`·`editMessage` 0회 · (부품) `onRegenerate` `[[message]]` 1회
- 스펙: `MessageActions.test.tsx` · `BubbleActions.test.tsx` · `Regenerate.test.tsx`(080~084 개정)

### TC-CH-118 · (S3e) 접근성 · 종류: 자동(화면·부품) · 요구: R-CHAT-013 🔒 · R-CHAT-002 🔒 · 설계: AC §7(그룹·버튼 이름·Tab 순서·키보드·잠금) · §8 · §1 `nameOf` · §10 D-31 · 토큰: 있음
- Given `WRITER_VIEWER` 4건 / 103 `authorName` `미샤`·`null` / (부품) 4변형, `authorName` `null`·`''`·`미샤`
- When 히스토리 log에 포커스 → Tab 9회 / 렌더
- Then ⓐ 포커스 순서 `시엘 대사 수정` → `시엘 대사 삭제` → `세바스찬 대사 수정` → `세바스찬 대사 삭제` → `어떠한 의지 대사 수정` → `어떠한 의지 대사 삭제` → `[지시] 대사 수정` → `[지시] 대사 삭제` → `세바스찬 대사 생성`, 매 단계 포커스 요소의 태그가 `BUTTON`(말풍선 루트 div는 포커스를 받지 않음 — 공용 Button도 non-scoped `root` 키라 클래스로 판별하지 않는다) · 그룹 `role=group` · 버튼 이름 = `{이름} 대사 ` + 보이는 글자(label-in-name) · 유저 `null`·`''` → `어떠한 의지 말풍선 작업`·`어떠한 의지 대사 수정`, 옛 데이터 `미샤` → `미샤 말풍선 작업`(TC-CH-108 메뉴 머리 단언 대체), `이름 없음` 없음 ⓑ 상태 변경 없음 ⓒ `editMessage`·`deleteMessage`·`regenerate`·`speak` 0회
- 스펙: `MessageActions.test.tsx` · `BubbleActions.test.tsx` · `AutoReply.test.tsx`(108 메뉴 머리 it 대체)

### TC-CH-119 · (S3e) 임시·실패 말풍선 버튼 줄 없음 · 종류: 자동 · 요구: R-CHAT-005 🔒 · R-CHAT-007 🔒 · 설계: AC §4 버튼 줄 렌더 조건(서버 메시지만) · §2 pending `li` 제외 · §7 임시·실패 행 · 토큰: 있음
- Given `WRITER_VIEWER` 4건
- When ① 세바스찬 생성 중 ② `안녕` 저장 201 → 중립 생성 중 ③ 세바스찬 `LLM_FAILED` ④ 중립 `LLM_FAILED`
- Then ⓐ 마지막 `li`(`.pending`) 안 group 0개 · button ①② 0개, ③④ 1개(글자 `재시도`) ⓑ pending 상태(표시로 관찰) ⓒ `speak` ①③ `[['r1', { character: 'sebastian' }]]` · ②④ `[['r1', { character: 'auto' }]]`, `editMessage`·`deleteMessage`·`regenerate` 0회
- 스펙: `MessageActions.test.tsx`(+ `SpeakFlow.test.tsx` 069 · `AutoReply.test.tsx` 099 개정 단언)

### TC-CH-120 · (S3e) 인증 실패 전환 — 버튼 줄 · 종류: 자동(App 통합) · 요구: R-CHAT-008 🔒 · R-CHAT-011 · R-CHAT-009 🔒 · 설계: AC §9 · §6 인증 3종 줄 · F-CH-29 · F-RM-12 · 토큰: 있음 → 없음
- Given `initToken('?t=test-token')` → `<App />` → 방 `티타임` 진입. (a) 메시지 [101 시엘, 103 유저, 104 세바스찬(마지막)], `regenerate` deferred (b) [101, 103], `deleteMessage` → `LEVEL_TOO_LOW`
- When (a) 104 「재작성」 → `TOKEN_INVALID` (b) 103 「삭제」 → 확인 「삭제」
- Then ⓐ (a) resolve 한 커밋에서 그룹 0개·`/대사 (수정|재작성|삭제)$/` 버튼 없음(waitFor 없이), ⋯·하단 바 없음, note `열람 전용 - 대화 참여는 등급 회원만`, alert 1개 `인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.`, ‹ 포커스 (b) `alertdialog` 없음, 그룹 0개, `li` 2 유지, note ⓑ 둘 다 `getToken()` null ⓒ (a) `regenerate` `[[104]]` 1회 (b) `deleteMessage` `[[103]]`
- 스펙: `AuthTransition.test.tsx`(+ `Regenerate.test.tsx` 084 화면 단위 그룹 0 단언)

### TC-CH-121 · (S3e) 390×565 버튼 줄 스크린샷(수동) · 종류: 수동 · 요구: R-CHAT-013 🔒 · R-CHAT-002 🔒 · R-CHAT-007 🔒 · 설계: AC §0 · §1 스타일 표 · §7 대비·포커스 링 · §10 D-25 · 토큰: 있음
- Given 유효 토큰 주소, 시드 방(세바스찬·시엘·유저·OOC, 마지막이 캐릭터 대사)
- When `manual-checklist.md` MC-CH-20 절차 ①~④
- Then ⓐ MC-CH-20 기대(세바스찬 왼쪽 본문 시작선 · 시엘 오른쪽 본문 끝선 · 유저·OOC 가운데, 28px + 위 여백 `--space-1`, 「수정 재작성 삭제」 한 줄, 가로 스크롤 없음, muted·danger 글자 대비 4.5:1, 비활성 흐림, 터치 영역) ⓑ —(화면 측정 전용, 상태는 TC-CH-114) ⓒ —(api는 TC-CH-115~117)
- 스펙: 없음(수동 — MC-CH-20)

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

### TC-FLOW-CH-14 · U-CH-09 캐릭터에게 한 턴 말 시키기(S3) · Steps: TC-CH-066 → TC-CH-068(a) → TC-CH-069(a) · 분기(대기 중 확인): TC-CH-070 · 분기(응답 도착 — 각자 Given): ① 성공 TC-CH-071 | TC-CH-072(a) ② 실패 TC-CH-073 | TC-CH-074 ③ 방 사라짐 TC-CH-077 · 분기(실패 말풍선 뒤, 각자 Given): TC-CH-075 | TC-CH-090 | TC-CH-093 | TC-CH-094 | TC-CH-095 · 그 밖 분기: TC-CH-078 | TC-CH-089 · 시각: TC-CH-092
- 순차 인계(→)는 같은 상태가 실제로 넘어가는 단계만이다: 쓰기 판 4건(→ 캐릭터 버튼 2, ready) → 세바스찬 클릭(→ `speak('r1', { character: 'sebastian' })` 1회, 대기) → 같은 대기 상태에서 목록 끝 왼쪽 "…" 임시 말풍선 확인. 그 뒤는 Given이 서로 달라 `분기:`로 둔다(CF·TK-01): 대기 중 잠금·연타·80초(070, 자기 Given) | 성공 교체(071은 시엘 대기 Given) · 맨 아래 자동 스크롤(072(a)는 스크롤 mock 새 첫 배치) | 실패 말풍선 + 「재시도」(073, LLM 실패 Given) · 코드별 문구(074) | 방 사라짐 → 목록(077) | 실패 말풍선이 있는 상태의 사라짐·남음(075)·전송 중 재시도 잠금(090)·「재시도」 뒤 포커스(093, 시엘 실패 Given)·편집 중 잠금(094)·수정 저장·삭제·재작성 중 잠금(095) | 빈 방 첫 대사(078) | 포커스 복귀(089)

### TC-FLOW-CH-15 · U-CH-10 마지막 캐릭터 대사 재작성(S3) · Steps: TC-CH-079 → TC-CH-080 · 분기: TC-CH-081 | TC-CH-082 | TC-CH-083 | TC-CH-084
- 마지막 캐릭터 말풍선 메뉴(→ `재작성` 항목 있음) → 재작성(→ confirm 없이 `regenerate(72)`, 대상 흐림 + `다시 쓰는 중…`, 잠금) → 200(→ 같은 자리 본문 교체, 포커스 = 그 말풍선). 분기: 생성 실패는 토스트 + 원 대사 | 다른 메시지가 먼저 이어짐 → 재조회 | 대상 사라짐 → 제거 | 인증 실패 → 전환

### TC-FLOW-CH-16 · U-CH-06 위를 읽는 중 캐릭터 대사(S3 speak 경로) · Steps: TC-CH-072(b) ① 위로 스크롤 → ② 세바스찬 클릭 → ③ 201 → ④ 배지 · 근거 분기: TC-CH-091(위쪽이면 tailKey 변화에도 그대로) | TC-CH-085(T29 unseen 가산)
- 한 TC(072(b)) 안의 순차 단계다: `scrollTop=1000` + scroll(→ 거리 1507, 위쪽) → 캐릭터 버튼 클릭(→ 목록 끝 임시 말풍선, 스크롤 1000 유지) → 201(→ 임시 말풍선이 결과로 교체, 스크롤 1000 유지) → 배지 「새 메시지」(unseen 1). 훅·리듀서 근거는 독립 확인이라 `분기:`(TK-02)

### TC-FLOW-CH-17 · U-CH-12 생성 요청 거절 → 안내·전환(S3) · Steps: TC-CH-066 → TC-CH-076(b)(App 통합 — 체인 끝 = 같은 화면 읽기 전용, 토큰 비움) · 분기: TC-CH-076(a) | TC-CH-084 | TC-CH-074(SPEAK_IN_PROGRESS·RATE_LIMITED — 전환 없음) | TC-CH-087
- 쓰기 판(→ 캐릭터 버튼) → speak가 인증 실패(→ 임시 말풍선 제거, 쓰기 UI 제거, 전환 토스트 1회, ‹ 포커스, `getToken()` null). 분기: 인증 3종 각 문구 | 재작성 중 인증 실패 | 생성 중·과다 요청은 안내만 | 늦은 응답은 무시

### TC-FLOW-CH-18 · U-CH-13 대사·지시 전송 → 자동 응답(S3d) · Steps: TC-CH-066 → TC-CH-098(a) → TC-CH-099 → TC-CH-100(a) · 분기(저장 응답 전): TC-CH-101 | TC-CH-104 · 분기(자동 응답 결과 — 각자 Given): ① 성공 TC-CH-100(b) | TC-CH-100(c) ② 실패 TC-CH-102 → TC-CH-103 | TC-CH-105 ③ 인증·방 없음 TC-CH-106(a)(b) · 그 밖 분기: TC-CH-034 | TC-CH-038 | TC-CH-107 | TC-CH-108 | TC-CH-063(S3d) · 시각: TC-CH-109
- 상태 전달: 066(토큰 있음 판) → 098(a) 저장 201 → 099 결과(유저 말풍선 `어떠한 의지` + 중립 "…", writing speak auto)가 100의 Given → 100(a) 세바스찬 결과 말풍선·잠금 해제로 끝난다. **U-CH-08 폐기(CR-002)**: TC-FLOW-CH-08은 이력으로 남기고, S3d 이후 같은 사용자 흐름은 이 체인이 대신한다(FLOW-CH-08의 033 단계 "AI 호출 없음"은 더 이상 성립하지 않는다).

### TC-FLOW-CH-19 · U-CH-14 말풍선 아래 버튼으로 수정·삭제·재작성(S3e) · Steps: TC-CH-110 → TC-CH-115 → TC-CH-116 · 분기(재작성 — 재작성 픽스처 Given): TC-CH-111 → TC-CH-117 | 실패 TC-CH-081 | TC-CH-082 | TC-CH-083 · 분기(대기 중 확인): TC-CH-114 | TC-CH-119 · 분기(전환): TC-CH-120 | TC-CH-084 · 메뉴 없음 확인: TC-CH-113 · 시각: TC-CH-121
- 상태 전달: 110(쓰기 판, 말풍선마다 「수정」「삭제」) → 115 「수정」 → 인라인 편집 → 저장 200(→ 본문 교체, 포커스 = 그 「수정」) → 116 같은 화면의 「삭제」 → 확인 시트 → 취소(→ 포커스 = 「삭제」) → 다시 「삭제」 → 삭제(→ 말풍선·그룹 제거, 포커스 log). 재작성은 마지막 캐릭터 대사가 있는 Given이라 `분기:`로 둔다: 111 「재작성」 표시 → 117 confirm 없이 `regenerate(72)` → 200(→ 같은 자리 교체, 포커스 = 「재작성」). **U-CH-10 폐기(CR-003)**: TC-FLOW-CH-09·15는 이력으로 남기고 S3e 이후 같은 사용자 흐름은 이 체인이 대신한다(FLOW-CH-09의 039·040·041 단계는 폐기·대체). TC-FLOW-CH-05·11의 022 단계는 112로, TC-FLOW-CH-13의 "말풍선 메뉴"는 버튼 줄(110)로 읽는다.

## 추적표 — S3e 추가분 (v0.9)

화면 TC는 버튼이 기존 래퍼를 계약 인자로 부르는지(`editMessage(id, { text })` · `deleteMessage(id)` · `regenerate(id)`)·잠금 중 부르지 않는지를 단언한다. 계약·Bearer 부착 불변. 자동 TC 11개(110~120) · 수동 1개(121).

### 대체·영향 TC (S3e) — 바뀐 단언의 정본

| 기존 TC | S3e 처리 | 바뀐 단언 | 스펙 변경 |
|---|---|---|---|
| TC-CH-022 | **대체 → 112** | 읽기 전용 메뉴 부재 → 버튼 줄 부재 + 메뉴 부재 | `ChatScreen.test.tsx` it 이름·단언 교체 |
| TC-CH-031 | 개정 | "말풍선 4개 메뉴 대상(tabindex·aria-haspopup·Shift+F10·`menuEnabled`)" → 말풍선마다 group `/말풍선 작업$/`(「수정」「삭제」), 루트에 메뉴 속성 없음 | `Composer.test.tsx` |
| TC-CH-039 | **폐기** | 메뉴 열기 — 반대 단언은 113 | `BubbleMenu.test.tsx` 파일 삭제(ui-implementer) |
| TC-CH-040 | **대체 → 110 · 111** | 메뉴 항목 순서 → 버튼 순서. 머리 줄(이름·시각·발췌)·부품 `MessageMenuSheet` 단언 삭제 | 같은 파일 삭제 |
| TC-CH-041 | **폐기** | 메뉴 닫기·말풍선 포커스 복귀. 시트 Tab 순환은 055, 확인 시트 닫힘 포커스는 116 | 같은 파일 삭제 |
| TC-CH-042 · 043 · 044 | 개정 | 진입 = 「수정」 클릭(시트 단계 없음), 042 그 말풍선 그룹 없음. 043·044 포커스 = 그 말풍선 「수정」(옛 히스토리 log) | `MessageActions.test.tsx`로 이동 |
| TC-CH-045 · 046 | 개정 | 진입 = 「삭제」 클릭. 045 취소 뒤 포커스 = 「삭제」. 046(a) 실패 뒤 포커스 = 「삭제」(116). (c)(d) 진입 = 101 「삭제」 | `MessageActions.test.tsx`로 이동 |
| TC-CH-051 | 개정 | "이후 말풍선 contextmenu → dialog 없음" 앞에 그룹 0개·`/대사 (수정\|재작성\|삭제)$/` 없음 추가(contextmenu 기본 동작 단언은 그대로 성립) | `AuthTransition.test.tsx` |
| TC-CH-052 | 개정 | 편집기 진입 = 「수정」, 삭제 확인 진입 = 「삭제」 | `AuthTransition.test.tsx` |
| TC-CH-054 | 개정 | (a) 전송 대기 중 "contextmenu·롱프레스 → 메뉴 없음" → 버튼 줄 `disabled`·눌러도 편집기·시트 없음 (b) 진입 = 「수정」 (c) 불변 (d) 부품 `MessageMenuSheet isWriteBusy` → 삭제(부품 비활성은 114 `BubbleActions`) | `MessageActions.test.tsx`((a)(b)) · `RoomMenu.test.tsx`((c) 불변) |
| TC-CH-061 | 개정 | 시트 장면에서 말풍선 메뉴 제외(방 메뉴·이름 변경·확인 시트). 버튼 줄은 121 | `manual-checklist.md` MC-CH-11 |
| TC-CH-063 | 개정 | (b)(c) 진입 = 버튼. (a)(d)·S3d 분은 불변 | `AuthTransition.test.tsx` |
| TC-CH-069 · 099 | 개정 | 화면 단위 "임시·중립 말풍선 contextmenu·롱프레스 → dialog 없음" → pending `li` group 0(119와 같은 단언). 069 롱프레스 it → 생성 중 메시지 버튼 줄 `disabled`. 099 "103 contextmenu → dialog 없음" → 103 버튼 줄 `disabled`. 부품(`PendingBubble.test.tsx`) tabindex·aria-haspopup·contextmenu 단언은 그대로 성립해 변경 없음 | `SpeakFlow.test.tsx` · `AutoReply.test.tsx` |
| TC-CH-070 | 개정 | "말풍선 contextmenu → dialog 없음" → 103 버튼 줄 `disabled`, 눌러도 편집기·확인 시트 없음 | `SpeakFlow.test.tsx` |
| TC-CH-079 | **대체 → 111** | 재작성 표시 조건(화면 4행 + 부품 2) | `Regenerate.test.tsx`에서 제거 |
| TC-CH-080 | 개정 | 진입 = 「재작성」 클릭, "시트 닫힘" 삭제(dialog·alertdialog 없음 = confirm 없음은 유지), "말풍선 contextmenu → 메뉴 없음" → 버튼 줄 `disabled`, 포커스 = 「재작성」(옛 "그 말풍선") | `Regenerate.test.tsx` |
| TC-CH-081 | 개정 | `LLM_FAILED`·`LLM_EMPTY` 토스트 = `대사를 다시 만들지 못했습니다. 재작성을 다시 눌러 주세요.`(AC §8 · D-30), `/메뉴에서/` 없음 · "다시 메뉴 → 재작성 활성" → 「재작성」 활성·포커스 | `Regenerate.test.tsx` |
| TC-CH-082 · 083 · 084 · 087 · 097 | 개정 | 재작성 진입 = 버튼(나머지 기대 그대로). 082 재조회 뒤 재작성 버튼 0(마지막 유저) · 083(a) 그 그룹 제거 · 084 그룹 0 · 097 「재작성」 활성 추가 | `Regenerate.test.tsx` |
| TC-CH-086 | 개정(**문구** — AC §11.2 표에 없음, 설계 확인 필요 1) | `writeErrorText(LLM_FAILED·LLM_EMPTY, 'regenerate')` 기대 = 개정 문구 | `Regenerate.test.tsx`(상수 `REGEN_FAILED`) |
| TC-CH-092 | 개정 | "재작성 항목 있는 메뉴 실측" 삭제 → 121 | `manual-checklist.md` MC-CH-16 ⑥ |
| TC-CH-094 · 095 · 107 | 개정 | 편집기·삭제·재작성 진입 = 버튼(095(b)는 71 `[지시] 대사 삭제`) | `SpeakFlow` · `Regenerate` · `AutoReply`(`openEditorOn103`) |
| TC-CH-100 | 개정 | (c) 자동으로 고른 대사 재작성 = 결과 말풍선 `세바스찬 대사 재작성` 버튼 | `AutoReply.test.tsx` |
| TC-CH-108 | **대체(일부) → 118** | 메뉴 머리 줄 `authorName` it → 버튼 이름 it(`미샤`·`어떠한 의지`). Bubble·`userAuthorLabel`·읽기 전용 단언 유지 | `AutoReply.test.tsx` |
| TC-CH-053 · 055 · 056 · 060 | **유지** | 리듀서 불변 · 공용 BottomSheet·ConfirmDialog·useLongPress는 공용 부품 TC로 남는다(060은 chat 사용처 0, 공용 정리 후보) | 없음 |
| TC-CH-015 | 유지 | `ChatState`·초기값 10필드 불변(AC §2) | 없음 |
| TC-CH-011 · 014 · 019 | 영향(렌더 도우미) | `MessageList` S3e 필수 prop `isActionLocked: false`·`regenerateTargetId: null`·`editFocusId: null`·`onEditFocusDone` 기본값(Q-09). `actions` 생략 = 버튼 줄 없음. 단언 불변 | `MessageList.test.tsx` |
| S2 공통 전제 "말풍선 메뉴 대상 요소" · 롱프레스 절차 | **폐기** | 「S3e 공통 전제」 폐기 전제 | — |
| TC-FLOW-CH-09 · 15 | 대체 → FLOW-CH-19 | U-CH-10 폐기(CR-003) → U-CH-14 | 없음 |
| TC-FLOW-CH-05 · 11 · 13 | 개정 | 022 단계 → 112 · "말풍선 메뉴" → 버튼 줄(110) | 없음 |
| MC-CH-11 · 12 · 13 · 16 · 17 | 개정 · 12 폐기 | 확인표 v0.5 | `manual-checklist.md` |

집계: **폐기 2**(039 · 041) · **대체 4**(022 · 040 · 079 · 108 일부) · **개정 27**(AC §11.2의 26 + 086 문구) · **유지 명시 4**(053 · 055 · 056 · 060).

### 요구 ↔ TC (S3e)

| 요구ID | TC | 비고 |
|---|---|---|
| R-CHAT-007 🔒(2026-10-07 개정) | TC-CH-110 · 111 · 112 · 113 · 114 · 115 · 116 · 117 · 119 · 121(수동) · 개정 031 · 042~046 · 051 · 052 · 054 · 063 · 070 · 080~084 · 087 · 094 · 095 · 097 · 099 · 100 · 107 | 렌더 · 재작성 조건 · 토큰 없음 미렌더 · 메뉴 제거 · 비활성 · 수정·삭제·재작성 위임 |
| R-CHAT-002 🔒 | TC-CH-110 · 118 · 121(수동) | 배치 쪽·이름 |
| R-CHAT-005 🔒 | TC-CH-114 · 117 · 119 · 095 · 069 | 생성 중 잠금 · 재작성 흐름 재사용 · 임시 말풍선 제외 |
| R-CHAT-008 🔒 | TC-CH-112 · 120 · 084 · 051 | 토큰 없음·전환 후 버튼 줄 DOM 없음 |
| R-CHAT-013 🔒 | TC-CH-110 · 115 · 116 · 117 · 118 · 121(수동) | 레이블 · 포커스 복귀 · Tab 순서 · 390px |
| R-MSG-004 | TC-CH-115 · 042 · 043 · 044 | |
| R-MSG-005 | TC-CH-116 · 045 · 046 | confirm 유지 |
| R-MSG-006 🔒 | TC-CH-111 · 117 · 080 | 마지막 캐릭터만 · confirm 없음 |
| R-CHAT-011(영향) | TC-CH-120 · 081 · 086 · 117(c) | 개정 문구 · 전환 |
| R-CHAT-009 🔒(영향) | TC-CH-120 | 전환 뒤 `getToken()` null |

### 설계 항목 ↔ TC (S3e, `design/actions.md`)

| 설계 항목 | TC |
|---|---|
| AC §0 레이아웃 조각(위치·정렬·순서 · 28px · 390px 한 줄 · 바텀시트 메뉴 삭제) | 110 · 121 · 113 |
| AC §1 `BubbleActions` props·DOM·`nameOf`·`canRegenerate` DOM 부재·`pressRegenerate`·지역 훅 2개 | 110 · 111 · 118 · 115 · 117 |
| AC §1 `memo`(같은 props면 다시 그리지 않음) | 비행동(성능 — 렌더 횟수 TC 대상 아님, 리뷰 몫) |
| AC §1 스타일 표(`actions`·변형 4 · muted · danger · inline-flex) | 110(클래스 키·danger 래퍼) · 121(치수·색·정렬) |
| AC §2 배선(`MessageListProps` · `MessageItem` 형제 · `HistoryProps` · `renderHistory` · `ChatSheets` 확인 시트만 · `useChatSheets.messageActions` · `useEditFocusReturn` · `regenerateTargetIdOf`) | 110 · 112 · 114 · 115 · 116 · 111 |
| AC §2 상태 `editFocusId` · `regeneratePressedRef` | 115 · 117 |
| AC §3 메뉴 제거 델타 | 113 · 112 · (039·041 폐기, 파일 삭제는 ui-implementer 인계) |
| AC §4 표시·비활성 표(렌더 조건 4행 · 잠금 6행) | 110 · 111 · 114 · 119 |
| AC §5 F-CH-45 · 46 · 47 · 48 · 49 · F-CH-20(포커스) · 50 · 51 · 52 | 110 · 115(042) · 116(045) · 117(080) · 115(044) · 043·115 · 115 · 117 · 111 |
| AC §5 불변 F-CH-20(저장 본체) · 23 · 28 · 34 · 41 | 043 · 045·046 · 116 · 080 · 082·083 |
| AC §6 파이프라인([수정] 저장·실패·취소 · [삭제] 취소·성공·실패 · [재작성] 200·NOT_LAST·NOT_FOUND·인증·그 밖) | 115·043·044 · 116·045·046 · 117·082·083·084·120·081 |
| AC §7 접근성 표(그룹 · 버튼 이름 · 같은 화자 · Tab 순서 · 키보드 · 잠금 · 포커스 목적지 · 임시·실패 · 포커스 링 · 대비) | 118 · 118 · 118(D-31) · 118 · 113(Shift+F10 삭제) · 114 · 115·116·117 · 119 · 121 · 121 |
| AC §8 문구 키(새 4 · 개정 재작성 실패 · 삭제 2) | 110·118 · 081·086·117 · 113(`메시지 메뉴` dialog 없음) |
| AC §9 읽기 전용 4행 | 112 · 113 · 120 · 115(편집 포커스 요청은 쓰기 판만) |
| AC §10 D-24 · 25 · 26 · 27 · 28 · 29 · 30 · 31 | 113 · 110·121 · 115·116·117 · 114 · 110 · 비행동(스킬 갱신은 메인 세션) · 081·086·117 · 118 |

### 사용자행 ↔ TC-FLOW (S3e)

| 사용자행 | TC-FLOW | 비고 |
|---|---|---|
| U-CH-14(S3e 신규) | TC-FLOW-CH-19 | 버튼으로 수정·삭제·재작성 |
| ~~U-CH-10~~(폐기, CR-003) | ~~TC-FLOW-CH-09 · 15~~ → TC-FLOW-CH-19 | 이력 보존 |
| U-CH-05(문구 갱신) | TC-FLOW-CH-05(022 단계 → 112) | 읽기 전용 버튼 줄 부재 |
| U-CH-12 | TC-FLOW-CH-11(022 → 112) · 17 + 분기 TC-CH-120 | 재작성·삭제 중 인증 거절 |
| U-CH-07 | TC-FLOW-CH-13(말풍선 메뉴 → 버튼 줄 110) | |

## 추적표 — S3d 추가분 (v0.8)

화면 TC는 저장 뒤 래퍼를 계약 인자로 부르는지(`speak(roomId, { character: 'auto' })`)·부르지 않는지를 단언한다. Bearer 부착은 래퍼 몫. 자동 TC 11개(098~108) · 수동 1개(109).

### 대체·영향 TC (S3d) — 바뀐 단언의 정본

| 기존 TC | S3d 처리 | 바뀐 단언 | 스펙 변경 |
|---|---|---|---|
| TC-CH-008 | **개정** | `authorName` `null`·`''` → `어떠한 의지`(`USER_DISPLAY_NAME` import 비교), 「이름 없음」 없음. 본문 Then의 `이름 없음` 단언을 대체 | `Bubble.test.tsx`(import 1줄 · it → it.each) |
| TC-CH-033 | **개정**(본문 갱신) | `li` 5 → 6 · 작성자 `미샤` → 응답 값 `어떠한 의지` · `speak` `['r1',{auto}]` 1회 · 나머지 합계 필터에서 `speak` 제외 | `Composer.test.tsx` |
| TC-CH-034 | **개정**(본문 갱신) | `li` 6 · 6번째 중립 · `speak` auto 1회(R-MSG-009) | `Composer.test.tsx` |
| TC-CH-036 | **개정**(본문 갱신) | 저장 응답 뒤 readOnly·aria-busy 해제, 잠금(전송 disabled)은 유지 → speak 결과 뒤 해제 | `Composer.test.tsx` |
| TC-CH-038 | **개정**(머리·Given 갱신) | (a)(b) `li` 6 · `speak` 1회. 스크롤·배지 수치 불변(T35 = T9 규칙) | `Composer.test.tsx` |
| TC-CH-053 | **단언 추가** | T13 send 시작 시 이전 pending(중립·캐릭터 실패) 같은 참조 · T15 send 실패 시 pending 유지(auto.md §1.3). 기존 단언 불변 | `ui/src/state/chat.test.ts` |
| TC-CH-063 | **단언 추가** | (S3d-a) 저장 대기 중 언마운트 → 저장 201 → `speak` 0회 · (S3d-b) 자동 응답 대기 중 언마운트 → 성공·`LLM_FAILED`·`TOKEN_INVALID`·`NOT_FOUND` → 콜백 0·저장소 그대로·재조회 없음. 기존 (a)~(c) 불변 | `AutoReply.test.tsx`(auto-tests.md §9.1 "또는 해당 스펙") |
| TC-CH-075 | **개정** | (b) 실패 말풍선 → 유저 전송 성공 → 실패 말풍선 **사라짐** · 목록 끝 중립 "…" · `speak` `[sebastian, auto]`. (a)(c) 불변 | `SpeakFlow.test.tsx` |
| TC-CH-085 | **단언 추가** | T27·T28·T29·T31·T33·T25 `'auto'` 케이스 · `canSpeak`(중립 실패 true · auto 생성 중 false). 기존 단언 불변 | `ui/src/state/chat.test.ts` |
| TC-CH-088 | **폐기 → TC-CH-098** | 전송 = speak 0회 단언은 R-CHAT-006 🔒 개정으로 성립하지 않는다 | `Composer.test.tsx` it 삭제(주석) |
| TC-CH-090 | **개정** | 저장 대기 중 disabled는 같음. 저장 응답 뒤에도 세바스찬·시엘 disabled(자동 응답 중) · 「재시도」 없음(중립 "…"로 교체) · `speak` 총 2회(`[1]` = auto) | `SpeakFlow.test.tsx` |
| TC-CH-094 | 불변 | 편집 중 전송의 결과는 TC-CH-107 | 없음 |
| TC-CH-040 · 079 | 불변 | 유저 fixture `authorName`이 값(`미샤`)이라 그대로. `null` 머리는 TC-CH-108 | 없음 |
| TC-CH-011 · 014 · 019 | 영향(렌더 도우미) | `MessageList` S3d 필수 prop `isEditSaveLocked: false` 기본값. 단언 불변 | `MessageList.test.tsx` |
| 전송 성공 경로 스펙 공통 | 영향 | `speak` 기본값 영원히 대기 | `Composer` · `SpeakFlow`(beforeEach). `AuthTransition`·`BubbleMenu`·`Regenerate`·`ChatScreen`은 저장 성공 TC가 없어 변경 없음 |
| TC-CH-073 · 093 부품 | 영향(타입) | `PendingBubble` `onRetry` 인자 `SpeakTarget` — mock 타입만 | `PendingBubble.test.tsx` |
| TC-FLOW-CH-08 | 대체 | U-CH-08 폐기 → TC-FLOW-CH-18 | 없음 |

### 요구 ↔ TC (S3d)

| 요구ID | TC | 비고 |
|---|---|---|
| R-CHAT-014 🔒 | TC-CH-098 · 099 · 100 · 102 · 103 · 104 · 105 · 106 · 107 · 109(수동) · 033 · 036 · 038 · 075 · 090 · 085(S3d) · 063(S3d) | 성공 2종 100 · 실패 102 · 재시도 103 · 끼어들기 0회 104(+099 한 커밋) · 캐릭터 버튼 유지 099·105 |
| R-CHAT-006 🔒(S3d 개정) | TC-CH-098 · 099 · 101 · 104 · 107 · 033 · 034 · 036 · 038 · 053(S3d) · 063(S3d) | 저장 성공 → speak(auto) 1회 / 저장 실패 → 0회 |
| R-CHAT-002 🔒(S3d 개정) | TC-CH-008 · 099 · 100 · 108 · 109(수동) | 작성자 표기 · 결과 자리 · 중립 가운데 |
| R-MSG-009 🔒 | TC-CH-098 · 100 · 034 | 화면은 응답 `speaker`대로 배치 · OOC 뒤에도 같은 동작 |
| R-AUTH-004 🔒(S3d 개정) | TC-CH-108 · 033 · 008 | 받은 값 그대로, 비었으면 고정 명칭 |
| R-MSG-003 🔒(S3d `'auto'` 개정) | TC-CH-098 · 103 | 본문 `{ character: 'auto' }`뿐 |
| R-LLM-008(데이터) | TC-CH-070(기존 — 화면 타이머 없음·70초 규칙 공통 경로) | 화면 영향은 소요 상한 불변뿐(rtm.md) — 새 TC 없음 |
| R-CHAT-005 🔒(영향) | TC-CH-102 · 105 · 075 · 090 · 085(S3d) | 캐릭터 버튼으로 중립 실패 탈출 |
| R-CHAT-011(영향) | TC-CH-101 · 102 · 106 | 저장 실패 S2 규칙 · 중립 실패 문구 · 인증 전환 |
| R-CHAT-013 🔒(영향) | TC-CH-099 · 102 · 103 · 107 · 109(수동) | role=status/alert · 포커스 · aria-describedby |
| R-CHAT-008 🔒 | TC-CH-106 · 101(b) · 108(읽기 전용) | 중립·「응답 재시도」 미렌더 |
| R-CHAT-004 | TC-CH-099 · 036 | 잠금 |
| R-CHAT-007 🔒 | TC-CH-107 · 100(c) | 편집 중 전송 · 자동 대사 재작성 |
| R-CHAT-009 🔒 | TC-CH-106(c) | 토큰 저장 없음 |
| R-MSG-002 | TC-CH-033 · 098 | 저장 인자 불변 |
| R-MSG-006 · R-MSG-007 🔒 | TC-CH-100(c) · 104 | |
| R-LLM-007 🔒 | TC-CH-102(`LLM_BUDGET_EXCEEDED`) | |
| R-ROOMS-004 | TC-CH-106(b) | |

### 설계 항목 ↔ TC (S3d, `design/auto.md`)

| 설계 항목 | TC |
|---|---|
| §0 레이아웃 조각(S1 저장 중 · S2 중립 "…" · 결과 교체 · 중립 실패 · 유저 작성자 줄 · 하단 바 불변) | 099 · 100 · 102 · 108 · 109 |
| §1.1 타입(`SpeakTarget` · `MessageWrite.speak` · `PendingSpeak` · `ChatAction`) · 초기값 10필드 불변 | 085(S3d) · 099(순수) · 015·053(기존 초기값) |
| §1.1 `speakingCharacterOf`(F-CH-44) | 099(순수) · 100(포커스 이동 없음) |
| §1.2 T27(개정) · T31(개정) | 085(S3d) · 103 · 102 |
| §1.2 T35 · T36 | 099(순수·화면) · 105(b) · 075 |
| §1.3 화면 상태 5단계 + 이탈 2행 | 099 · 100 · 102 · 106 · 101 · 053(S3d) |
| §2.1 PendingBubble `NeutralPending` DOM(생성 중·실패) · `CharacterPending` 불변 | 099(부품) · 102(부품) · 069·073(기존) |
| §2.1 CSS `neutral` · 높이 48/90 · 테스트 클래스 키 | 099 · 102(클래스) · 109(치수·색) |
| §2.2 `userAuthorLabel` · Bubble · MessageMenuSheet `nameOf` · `unknownAuthor` 삭제 | 108 · 008 |
| §2.3 index `speakingCharacter` · Composer 불변(입력 비움·포커스) · SpeakButtons 불변 | 099 · 100 |
| §2.3 MessageList `onRetrySpeak` · ChatScreen `retrySpeak` | 103 |
| §2.3 `renderHistory` pending 필터(중립 포함) | 106(a)(c) |
| §2.3 `useAutoScroll` `tailKey`(`auto:generating`) | 038(a)(b) · 091(기존 규칙) |
| §2.3 `isEditSaveLocked` · InlineEditor `isSaveLocked` | 107(화면·부품) |
| §3 F-CH-17 ①~⑥ | ①② 032·035(기존) · ③ 098 · ④ 063(S3d-a) · ⑤ 101 · ⑥ 099·104 · T36 분기 = 099(순수 T36, 화면 도달 불가 — 설계 명시 방어) |
| §3 F-CH-31(개정) · F-CH-42 runSpeak(성공 · ① 인증 · ② NOT_FOUND · ③ 그 밖 · 비활성) | 103 · 100 · 106(a) · 106(b) · 102 · 063(S3d-b) |
| §3 F-CH-32(개정) | 103(auto → log) · 093(캐릭터, 기존) |
| §3 F-CH-37 · F-CH-43 · F-CH-44 | 102 · 108 · 099 |
| §4.1 잠금 표 3행 | `send` 099·036 · `speak+auto` 099·104 · `null` 100·102 |
| §4.2 끼어들기 0회 1~4 | 1 → 099(MutationObserver) · 2 → 104 · 3 → 099+104 · 4 → 101 · 063(S3d-a) · 100 · 102 · 106 |
| §5 파이프라인 분기(저장 실패 · 비활성 · 201 · speak 201 · 인증 · NOT_FOUND · 그 밖 · 중립 실패 출구 4 · 재작성 줄) | 101 · 063 · 099 · 100 · 106 · 106 · 102 · 103·105(a)(b)·063(S3d-b) · 100(c) |
| §5 레이트리밋 2회 소모 · NETWORK 중복 한계 · confirm 없음 | 102(`RATE_LIMITED` 화면 쪽) · 비행동 항목(한계 기록) |
| §6 문구 7키 | `pendingDots`·`autoPendingStatus` 099 · `speakRetry`·`autoRetryAriaLabel` 102 · `speakErrorText` 102 · `userAuthorLabel` 108 · `unknownAuthor` 삭제 008·108 · `editSaveLockedNote` 107 |
| §7 접근성·읽기 전용 7행 | 중립 생성 중 099 · 중립 실패 102 · 잠긴 저장 버튼 107 · 잠금 표시 099·036 · 포커스 099·100·102·103 · 키보드 098(b)·104 · 읽기 전용 106·108 |
| §8 D-17 · D-18 · D-19 · D-20 · D-21 · D-22 | 107 · 099·104 · 103 · 085(S3d) · 108 · 비행동(미채택 — TC 대상 아님) |

### 사용자행 ↔ TC-FLOW (S3d)

| 사용자행 | TC-FLOW | 비고 |
|---|---|---|
| U-CH-13(S3d 신규) | TC-FLOW-CH-18 | 전송 → 자동 응답 |
| ~~U-CH-08~~(폐기, CR-002) | ~~TC-FLOW-CH-08~~ → TC-FLOW-CH-18 | 이력 보존 |
| U-CH-06 | TC-FLOW-CH-12(체인 불변, 038 S3d 개정 반영) | |
| U-CH-09 | TC-FLOW-CH-14(분기 075·090 단언 S3d 개정) | |
| U-CH-12 | TC-FLOW-CH-17 + 분기 TC-CH-101(b) · 106(a) | 자동 응답·저장의 인증 거절 |

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
| U-CH-06(토큰 있음) | TC-FLOW-CH-12(S2 순차 체인) · TC-FLOW-CH-06(S1 상태·훅 층별) · **TC-FLOW-CH-16(S3 speak 경로)** | S1 · S2 · S3 |
| U-CH-07(토큰 있음) | TC-FLOW-CH-13(S2) · TC-FLOW-CH-07(S1 기간 한정) | S1 · S2 |
| U-CH-08(전송) | TC-FLOW-CH-08 | S2 |
| U-CH-09(캐릭터 한 턴) | **TC-FLOW-CH-14** | S3 |
| U-CH-10(수정·삭제·재작성) | TC-FLOW-CH-09 · **TC-FLOW-CH-15(재작성)** | S2 · S3 |
| U-CH-11(이름 변경·방 삭제) | TC-FLOW-CH-10 | S2(장기기억 S4) |
| U-CH-12(쓰기 거절·전환) | TC-FLOW-CH-11 · **TC-FLOW-CH-17(생성 요청 거절)** | S2 · S3 |

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

## 추적표 — S3 추가분 (v0.6)

위 S1·S2 표의 "S3" 후속 칸은 이 절로 닫는다. 화면 TC는 래퍼를 계약 인자로 부르는지(`speak(roomId, { character })`·`regenerate(messageId)`)·부르지 않는지를 단언한다. Bearer 부착은 래퍼 몫(api.md API-T-UI-019~021).

### 대체·영향 TC (S3)

| 기존 TC | S3 처리 | 근거 | 스펙 변경 |
|---|---|---|---|
| TC-CH-031 | **일부 대체됨** — "`세바스찬`·`시엘` 버튼 없음" → TC-CH-066(있음). 나머지(⋯·OOC·입력·전송·note 없음·말풍선 메뉴 대상) 유지 | tc.md v1.7 | `Composer.test.tsx` 두 줄 삭제·이름 변경 |
| TC-CH-040 | **일부 대체됨** — 재작성 표시 조건 → TC-CH-079. 픽스처 마지막이 OOC라 "재작성 없음" 단언은 그대로 성립 | tc.md v1.7 | `BubbleMenu.test.tsx` 이름 변경, `MessageMenuSheet` 부품 렌더에 `canRegenerate={false}`·`onRegenerate` 추가(필수 props) |
| TC-CH-054 (d) | 영향 — `MessageMenuSheet` 필수 props 추가(단언 불변) | C §2.8 | 같은 파일 props 추가 |
| TC-CH-021 | 영향 — 버튼 질의를 `/세바스찬\|시엘/` 정규식으로(접근 이름 `세바스찬 대사 생성`) | tc.md v1.7 | `ChatScreen.test.tsx` 두 줄 → 한 줄 |
| TC-CH-033 | 영향 — mock 목록에 `speak`·`regenerate`가 들어가 "나머지 export 합계 = 1"이 S3 래퍼까지 센다. 명시 단언은 TC-CH-088 | tc.md v1.7 · R-CHAT-006 | `Composer.test.tsx` mock 목록 |
| TC-CH-015 · TC-CH-053 | 영향 — 초기값 9 → **10필드**(`pending: null`). 시나리오 본문 Then도 10필드로 맞춤(CF-03) | F §1 S3 | `chat.test.ts` 두 곳(Q-05) |
| TC-CH-031 Then | 영향 — "`세바스찬`·`시엘` 없음(S3)" 구절 삭제(CF-04, 스펙과 일치) | tc.md v1.7 | 없음(v0.6에서 이미 삭제) |
| TC-CH-053 T13~T16·T25 | 영향 — S3 개정분은 TC-CH-085가 맡는다(S2 단언은 그대로 성립) | F §1.1 | 없음 |
| TC-CH-011 · 014 · 019 | 영향 — `MessageList` S3 필수 props(`pending`·`isSpeakLocked`·`onRetrySpeak`·`regeneratingId`) 기본값 | C §2.1 | `MessageList.test.tsx` 렌더 도우미(Q-06) |
| TC-CH-094(신규) | **S2와 달라진 동작** — 편집 중 캐릭터 버튼·재시도 disabled(DC-10). 이를 반대로 단언한 S2 TC 없음 | D-14 | 없음 |
| `AuthTransition`·`RoomMenu`·`ChatScroll` 스펙 | 영향 없음 — S3 래퍼를 부르지 않으므로 mock 목록 그대로(부르면 vitest가 "export 없음"으로 알려 준다) | — | 없음 |

### 요구 ↔ TC (S3)

| 요구ID | TC | 비고 |
|---|---|---|
| R-CHAT-002 🔒(임시·실패 말풍선 배치) | TC-CH-069 · 071 · 073 · 092(수동) | 캐릭터 쪽 배치 = 클래스 단언, 색·거울은 수동 |
| R-CHAT-003 🔒(speak 트리거 스크롤) | TC-CH-072 · 078 · 085 · 091 | |
| R-CHAT-004 🔒(캐릭터 버튼) | TC-CH-066 · 067 · 070 · 092 | 부재 쪽 021·067 |
| R-CHAT-005 🔒 | TC-CH-068 ~ 075 · 077 · 078 · 080 · 085 · 087 · 089 · 090 · 093 · 094 · 095 | 성공 071 · 실패 073·074 · 재시도 073·093 · 잠금 070·080·090·094·095 |
| R-CHAT-006 🔒(전송 시 speak·regenerate 0회 유지) | TC-CH-088(클릭·Enter·OOC 켬) · 033 | |
| R-CHAT-007 🔒(재작성) | TC-CH-079 ~ 084 · 085 · 087 · 094 · 095 | confirm 없음 080 |
| R-CHAT-008 🔒 | TC-CH-066 · 067 · 076 · 084 | |
| R-CHAT-009 🔒 | TC-CH-076(b) | `getToken()` null |
| R-CHAT-011(S3 코드 · S3b) | TC-CH-073 · 074 · 076 · 081 · 082 · 083 · 084 · 086 · **096 · 097** | SPEAK_IN_PROGRESS 074·081 · LLM_FAILED 073·081 · CONFIG_INVALID 074·081 · NOT_LAST 082 · NOT_CHARACTER 081 |
| R-CHAT-013 🔒(S3 요소) | TC-CH-066 · 069 · 089 · 092 · 093 · MC-CH-17 | |
| R-MSG-003 🔒(참조) | TC-CH-068 | 본문 `{ character }`뿐 |
| R-MSG-006 🔒(참조) | TC-CH-079 · 080 | 표시 조건·인자 하나 |
| R-MSG-007 🔒(참조) | TC-CH-070 · 074 | 화면 직렬화·409 안내 |
| R-NFR-001 🔒(참조) | TC-CH-070 · MC-CH-18 | 화면 타임아웃 없음 |
| R-ROOMS-004 | TC-CH-077 | 방 사라짐 → 기록 삭제 |
| R-LLM-007 🔒(S3b 월 비용 한도 — 화면 쪽) | TC-CH-096 · 097 | 한도 판정·연타 → RATE_LIMITED는 server·contract 테스트 소관 |
| R-CHAT-005 🔒 · R-CHAT-007 🔒(S3b 보강) | TC-CH-096(재시도 있음) · 097(원 대사 유지) | |

### 설계 항목 ↔ TC (S3)

| 설계 항목 | TC |
|---|---|
| C §0 토큰 있음 판 1행·임시 자리 | TC-CH-066 · 069 · 092 |
| generate §0 실패·재작성 중 조각 | TC-CH-073 · 080 · 092 |
| generate §1 speak 흐름(201 · 인증 · NOT_FOUND · 그 밖 · 재시도 · 다른 캐릭터 · 뒤로) | TC-CH-071 · 076 · 077 · 073 · 074 · 075 |
| generate §2 regenerate 흐름(200 · NOT_LAST · NOT_FOUND · 인증 · 그 밖) | TC-CH-080 · 082 · 083 · 084 · 081 |
| generate §3 문구 표(speak 열 · regenerate 열 · 톤) | TC-CH-074 · 086 · 081 · 076 |
| generate §3 `LLM_BUDGET_EXCEEDED` 행(S3b: 문구 · 재시도 ○ · warning · 카운트다운·자동 재시도 없음 · code로 429 구분) · 톤 비고 · labels §8.1.2 S3b 비고 · rooms F-RM-22 v1.5.1 | TC-CH-096 · 097 |
| generate §4 D-11 · D-12 · D-13 · D-14 · D-15 · D-16 · A-6 | 069 · 073·074 · 081 · 070·094 · 082 · 074·069·080 · 070 |
| generate §5 L-1~L-3 | 비행동 항목(한계 기록) — TC 대상 아님 |
| F §1 S3 `MessageWrite`·`PendingSpeak`·`ChatState.pending`·액션 4종 | TC-CH-085 |
| F §1.1 T13~T16·T25 개정 · T27~T34 · T1~T3 pending · 실패 유지 비고 | TC-CH-085 · 075 |
| F §1.2 `canSpeak` · `isRegenerateTarget` | TC-CH-085 · 094 · 079 |
| F §3 `state.pending` · `lastSpeakerRef` | TC-CH-069 · 089 · 093 |
| F §4.3 쓰기 팻말(`begin` 시작 액션) · 잠금 표 6행 | ready 066·071 · 편집 열림 094 · `speak` 070 · `regenerate` 080(⋯·메뉴)·095(c)(재시도) · `send` 090 · `edit`·`delete` 095(a)(b) · 순수 085(`canSpeak`) |
| F-CH-41 `requestLogFocus`·ready 커밋 뒤 포커스 | TC-CH-082 · 083 |
| F-CH-01 S3 props(`canSpeak`·`speakingCharacter`·`onSpeak`·`onRegenerate`) | TC-CH-066 · 089 |
| F-CH-16(S3 `WriteAction` 확장) | TC-CH-076 · 081 · 084 · 086 |
| F-CH-31 speakAs | TC-CH-068 · 070 · 071 · 073 · 074 · 076 · 077 |
| F-CH-32 retrySpeak | TC-CH-073 · 093 |
| F-CH-33 onRoomGone | TC-CH-077 |
| F-CH-34 regenerateMessage(`RegenerateResult` 5분기) | TC-CH-080 · 081 · 082 · 083 · 084 · 087 |
| F-CH-35 openMessageMenu `canRegenerate` | TC-CH-079 |
| F-CH-36 regenerateFromMenu | TC-CH-080 · 082 · 083 |
| F-CH-37 speakErrorText | TC-CH-086 · 074 |
| F-CH-38 포커스 복귀 · 해제마다 기억 비움 | TC-CH-089 · 093 |
| F-CH-39 renderHistory(pending canWrite 조건 · empty 판정 · `isSpeakLocked` · `regeneratingId`) | TC-CH-067 · 076 · 078 · 090 · 084 |
| F-CH-40 tailKey | TC-CH-072 · 091 |
| C §2.1 MessageList S3 props | TC-CH-069 · 080 · 090 |
| C §2.2 Bubble `isRegenerating` | TC-CH-080 · 084 |
| C §2.6 Composer S3(`topRow` 왼쪽 SpeakButtons · 생성 중 readOnly 아님) | TC-CH-066 · 070 |
| C §2.8 MessageMenuSheet 재작성 항목·순서·disabled | TC-CH-079 |
| C §2.10 ChatSheets `canRegenerate`·`onRegenerate` | TC-CH-079 · 080 |
| C §2.11 SpeakButtons | TC-CH-066 · 089 · 093 |
| C §2.12 PendingBubble(generating · failed · 메뉴 없음 · DC-01 모양 클래스 · `isRetryDisabled = !canSpeak`) | TC-CH-069 · 073 · 074 · 090 · 094 · 095 · 092 |
| C §3 tailKey 행 | TC-CH-091 · 072 · 078 |
| C §4 S3 스타일 행(버튼·임시·실패·재작성 중·`--bubble-busy-opacity`) | TC-CH-092 |
| labels §8.1.2 7키 | `speakAriaLabel` 066 · `pendingDots`·`pendingStatus` 069 · `speakRetry`·`speakRetryAriaLabel` 073 · `regenerate` 079 · `regeneratingNote` 080 |
| A(S3) 포커스 순서·키보드·생성 중 알림·재작성 중 알림·잠금·포커스 유지·전환·레이블·장식 | TC-CH-066 · 089 · 069 · 080 · 070 · 093 · 076 · 073 · MC-CH-17 |

## 후속 이월 (S2에서 만들지 않는 TC)

S3 행 4개는 v0.6에서 **해소**(TC-CH-066~094). S4 행만 남는다.

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
| Q-05 | 2026-10-06 | —(설계 v1.7 S3 상태 모델, S1·S2 불변 예외 — 메인 세션 확인 요청) | `ChatState`에 `pending` 추가로 초기값 단언 9 → 10필드(`pending: null`). 다른 단언 불변 | `ui/src/state/chat.test.ts`(TC-CH-015·053 초기값 it 2개) | TC-CH-015 · TC-CH-053 | 없음(TC-CH-085가 S3 전이 담당) | 전환됨(TC-CH-015 · 053) |
| Q-06 | 2026-10-06 | —(설계 v1.7 C §2.1 S3 필수 props) | `MessageList` 렌더 도우미에 `pending: null`·`isSpeakLocked: false`·`onRetrySpeak`·`regeneratingId: null` 기본값. 단언 불변 | `ui/src/chat/test/MessageList.test.tsx`(renderList) | TC-CH-011 · 014 · 019 | 없음 | 전환됨(TC-CH-011 · 014 · 019 스펙 렌더 도우미) |
| Q-07 | 2026-10-06 | —(tc.md v1.7 대체 지정) | S3 캐릭터 버튼·재작성 항목 등장으로 S2 단언 대체·조정: 031 버튼 부재 두 줄 삭제(→ 066) · 040 이름 조정(→ 079) · 021 정규식 질의 · `MessageMenuSheet` 필수 props(040 부품·054(d)) · S2 mock 목록에 `speak`·`regenerate`(Composer·BubbleMenu) | `Composer.test.tsx` · `BubbleMenu.test.tsx` · `ChatScreen.test.tsx` | TC-CH-021 · 031 · 033 · 040 · 054 | TC-CH-066 · 079 · 088 | 전환됨(TC-CH-066 · 079 · 088) |
| Q-08 | 2026-10-06 | CR-002 | S3d(설계 v1.9 `design/auto.md`): 전송 저장 성공 → 곧바로 `speak('auto')`(T35 원자 전이) · 중립 "…"·중립 실패 + 재시도 · 유저 작성자 표기 = 받은 값, 비었으면 `어떠한 의지`(`unknownAuthor` 삭제). 기존 단언 변경 목록은 `design/auto.md` §9.1 표 그대로. 검증 반영: `Composer.test` TC-CH-033·034·038·088의 `items()` 길이 5 → 6(중립 `li`) · `SpeakFlow` TC-CH-090은 저장 응답 뒤 세바스찬 버튼 `disabled` 유지·`speak` 총 2회 · 생성 중 편집 저장만 비활성(InlineEditor `isSaveLocked`, TC-CH-107) | `Bubble.test.tsx` · `Composer.test.tsx`(283·309행 필터) · `SpeakFlow.test.tsx` · `AuthTransition.test.tsx` · `BubbleMenu.test.tsx` · `Regenerate.test.tsx` · `ChatScreen.test.tsx` · `ui/src/state/chat.test.ts` · `PendingBubble.test.tsx` | TC-CH-008 · 033 · 034 · 036 · 038 · 063 · 075 · 088(폐기 → 098) · 090 · 053 · 085 · 040·079(null fixture만) | TC-CH-098 ~ 109(`design/auto.md` §9.2 예약) | **반영됨(v0.8)** · 전환됨(TC-CH-098 ~ 109 · 개정 008·033·034·036·038·053·063·075·085·090 · 폐기 088 → 098) |
| Q-09 | 2026-10-07 | CR-003 | S3e(`design/actions.md` v2.0): 말풍선 롱프레스·우클릭·Shift+F10 바텀시트 메뉴 → 말풍선 아래 항상 보이는 「수정」「삭제」 + 마지막 캐릭터 「재작성」(`BubbleActions`). 비활성 = `!canSpeak ∨ roomBusy`. 포커스: 편집 닫힘 → 그 「수정」(disabled면 log) · 재작성 잠금 해제 → 같은 「재작성」 · 삭제 취소·실패 → 「삭제」. 재작성 실패 문구 개정(D-30). 기존 단언 변경은 actions.md §11.2 표 + TC-CH-086 문구 | 신규 `BubbleActions.test.tsx` · `MessageActions.test.tsx` / 갱신 `Regenerate.test.tsx`(재작성) · `AutoReply.test.tsx` · `AuthTransition.test.tsx` · `SpeakFlow.test.tsx` · `Composer.test.tsx` · `ChatScreen.test.tsx` · `MessageList.test.tsx`(렌더 도우미) · `ui/src/state/chat.test.ts` · `manual-checklist.md` / **삭제 대상** `BubbleMenu.test.tsx`(ui-implementer) | 폐기 039·041 · 대체 022·040·079·108(일부) · 개정 031·042~046·051·052·054·061·063·069·070·080~084·086·087·092·094·095·097·099·100·107 · 유지 053·055·056·060 · 렌더 도우미 011·014·019 | TC-CH-110 ~ 121(actions.md §11.1 예약) | **반영됨(v0.9)** · 전환됨(TC-CH-110 ~ 121 · 개정 27 · 폐기 039·041 · 대체 022 → 112 · 040 → 110·111 · 079 → 111 · 108 → 118) |

### 변경이력 보충 — v0.9 (2026-10-07)

**S3e 보강(CR-003 · Q-09 마감)**: 머리말 v0.9 기준·상태 · 「S3e 공통 전제」(정본 우선순위 · S2 메뉴 대상 전제 폐기 · group/button 질의 · 클래스 키 · 래퍼 모킹 · jsdom 재작성 누름 방식 · 대기 · 스펙 배치 결정과 근거). **신규** TC-CH-110 ~ 120(자동 11) · TC-CH-121(수동 1, `manual-checklist.md` MC-CH-20) · TC-FLOW-CH-19(U-CH-14). **폐기·대체** 머리 표시 022 · 039 · 040 · 041 · 079 · 108. **개정 27건**은 「대체·영향 TC (S3e)」 표(정본). 「추적표 — S3e 추가분」(대체·영향 · 요구 · 설계 · 사용자행). 스펙: 신규 `BubbleActions.test.tsx`(부품) · `MessageActions.test.tsx`(화면, 옛 `BubbleMenu.test.tsx`의 042~046·054(a)(b) 이동) · 다시 씀 `Regenerate.test.tsx`(079 제거) · 갱신 `AutoReply` · `AuthTransition`(TC-CH-120 · mock 목록 `speak`·`regenerate`) · `SpeakFlow` · `Composer` · `ChatScreen`(022 → 112) · `MessageList`(렌더 도우미) · `ui/src/state/chat.test.ts`(`regenerateTargetIdOf`). `PendingBubble.test.tsx`는 단언이 그대로 성립해 변경 없음. 근거: `design/actions.md` v2.0 §11 · requirements.md v2.0 · 메인 세션 위임(S3e)

### 변경이력 보충 — v0.8 (2026-10-06)

**S3d 증분(CR-002 · Q-08 마감)**: 머리말 S3d 기준·S3d 공통 전제(정본 우선순위 · `speak` 영원히 대기 기본값 · 계약 이름 · 픽스처 · 중립 클래스 키 · MutationObserver 한 커밋 관찰). **신규** TC-CH-098 ~ 108(자동 11) · TC-CH-109(수동 1, `manual-checklist.md` MC-CH-19) · TC-FLOW-CH-18(U-CH-13). **개정** 033·034·036·038 본문 · 075·088(폐기)·090 머리 · 008·053·063·085는 「대체·영향 TC (S3d)」 표. 「추적표 — S3d 추가분」(대체·영향 · 요구 · 설계 · 사용자행). 스펙: 신규 `AutoReply.test.tsx` · 갱신 `Composer`(TC-CH-088 it 삭제) · `SpeakFlow` · `PendingBubble`(중립 부품) · `Bubble`(008) · `MessageList`(렌더 도우미) · `ui/src/state/chat.test.ts`(S3d 4블록). 버전 표기: 위임문은 "v0.7"로 지시했으나 v0.7은 S3b 증분이 이미 사용해 v0.8로 올렸다. 근거: `design/auto.md` §9 · requirements.md v1.9 · 메인 세션 결정(전송마다 자동 응답 · 중립 가운데 · 생성 중 편집 저장만 비활성 · authorName 그대로 · 재시도 = 'auto')

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
| v0.6 | 2026-10-06 | **S3 증분**: 머리말 기준 v1.7·api v0.4, S3 공통 전제(토큰·mock 목록 `speak`·`regenerate`·deferred 생성 대기·픽스처·스크롤 수치·클래스 단언). TC-CH-066~094 추가(자동 28 · 수동 1), TC-FLOW-CH-14~17, 「추적표 — S3 추가분」(대체·영향 표 · 요구 · 설계), 사용자행 U-CH-06·09·10·12 연결, 「후속 이월」 S3 행 해소, Q-05~07. 스펙 신규 `SpeakButtons`·`PendingBubble`·`SpeakFlow`·`Regenerate`·`useAutoScrollTail`, `chat.test.ts`에 `describe('S3 …')` 3블록 추가, 기존 스펙 대체·영향 조정(Composer·BubbleMenu·ChatScreen·MessageList). 확인표 v0.3(MC-CH-16~18) | 구축 S3, design.md v1.7 · tc.md v1.7 §3 |
| v0.6.1 | 2026-10-06 | S3 검증 반영. **모순**: 083(b) 스크롤 mock으로 첫 배치 자동 이전 로드 없음 전제(CF-02) · 082·083 포커스 = ready 커밋 뒤(F-CH-41, loading 중 이동 없음·재조회 실패 시 이동 없음·0건이면 ‹, CF-01·TK-05) · 015·053 본문 10필드(CF-03) · 031 Then 구절 삭제(CF-04). **완결성**: FLOW-CH-14 순차 인계를 066 → 068(a) → 069(a)로 줄이고 나머지 `분기:`(TK-01) · FLOW-CH-16 072(b) 단계 순서로 재구성(TK-02) · 080 ⋯ disabled·메뉴 무반응, **TC-CH-095 신규**(수정 저장·삭제·재작성 대기 중 캐릭터 버튼·재시도 disabled), `canSpeak` send·edit·delete 케이스(TK-03) · 081 톤·084 warning(TK-04) · 088 OOC 켬 변형(TK-06) · 076(b) ‹ 포커스·warning·버튼 부재(TK-08) · 087 listMessages 1회·077 `.pending` 0개(TK-09) · 086 가정 표기 삭제(TK-10) · 089 F-CH-38 기억 비움 경합(부품). 자동 29 · 수동 1 | ui-test-checker TK-01~10 · ui-test-conflict-checker CF-01~04 · 설계 정정(F-CH-36·38·41, components.md `isRetryDisabled`) |
| v0.6.2 | 2026-10-06 | 스펙 결함 2건 수정: TC-CH-089 부품(disabled 전환 **전**에 blur — jsdom 30은 disabled 요소 blur 무시) · TC-CH-079 `it.each` 행 타입을 가변 `[string, MessagesPage, number]`로(tsc). Given/When/Then 불변 | 구현 후 ui 실행 결과(메인 세션) |
| v0.7 | 2026-10-06 | **S3b 증분**: TC-CH-096(speak 한도 초과 — 실패 말풍선·재시도·RATE_LIMITED와 문구 구분·숫자 없음·60초 뒤 자동 재시도 없음·전환 없음) · TC-CH-097(재작성 한도 초과 — 원문 유지·warning 토스트·재조회·전환·자동 재시도 없음). 순수 행 추가(speakErrorText · writeErrorText regenerate · toastToneOf). 추적표 R-CHAT-011·R-LLM-007·설계 행 갱신. 자동 31 · 수동 1 | S3b, generate.md §3 · tc.md 096·097 · api.md v0.4.1 |
| v0.8 | 2026-10-06 | **S3d 증분**(전송 뒤 자동 응답): TC-CH-098~109 · TC-FLOW-CH-18 · 「추적표 — S3d 추가분」. 상세는 「변경이력 보충 — v0.8」 | S3d, design/auto.md · CR-002 · Q-08 |
| v0.9 | 2026-10-07 | **S3e 보강**(말풍선 액션 버튼, 메뉴 대체): TC-CH-110~121(자동 11 · 수동 1) · TC-FLOW-CH-19(U-CH-14) · 「S3e 공통 전제」 · 「추적표 — S3e 추가분」. 폐기 2(039·041) · 대체 4(022·040·079·108 일부) · 개정 27(actions.md §11.2의 26 + 086 문구) · 유지 명시 4(053·055·056·060). 스펙 신규 `BubbleActions`·`MessageActions`, `BubbleMenu.test.tsx` 삭제 대상. 확인표 v0.5(MC-CH-20). 상세는 「변경이력 보충 — v0.9」 | S3e, design/actions.md v2.0 · requirements.md v2.0 · CR-003 · Q-09 |
| v0.9.1 | 2026-10-07 | 스펙 결함 2건 수정(Given/When/기대 의미 불변, 조회 방식만): TC-CH-115 D-17 it — 전송된 105와 103의 그룹 이름이 같아 화면 전체 `getByRole('group')`이 중복 오류 → 103 `li` 안으로 범위를 좁힘 · TC-CH-118 — 공용 Button도 non-scoped `root` 키라 `classList.contains('root')` 판별이 항상 참 → 포커스 요소 태그 `BUTTON` 단언. 「S3e 공통 전제」 질의·클래스 키 줄에 같은 규칙 추가 | 구현 후 ui 실행 결과(686건 중 684 통과, 메인 세션) |
