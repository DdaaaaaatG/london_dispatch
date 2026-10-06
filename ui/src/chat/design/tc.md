# chat 상세 설계 — 예정 TC 목록 (분할 문서, v1.7)

> 주 문서: `ui/src/chat/design.md` §15 RTM. 40KB 한계로 v1.4에서 주 문서 §15.1을 이 파일로 옮겼다(S1 행은 내용 그대로).
> ui-test-designer가 시나리오(`ui/src/chat/test/scenarios.md`)로 확정한다. 기대 결과는 3단(화면 · 상태/저장 값 · api 호출 인자)으로 풀어 쓴다.
> 공통 준비(S2): 쓰기 TC는 `viewer=WRITER_VIEWER`(또는 App 통합이면 `initToken('?t=test-token')`), 끝나면 `clearToken()`. 래퍼는 `vi.mock('@/api')`. 타이머는 `vi.useFakeTimers()`(롱프레스·토스트).
> v1.5: TC-CH-033 단언 범위(DC-08) · TC-CH-046 재로드 스크롤(DC-04) · TC-CH-054 메뉴 진입 막음(DC-05) · TC-CH-064·065 TC-FLOW(DC-11).
> v1.7(S3): §3 TC-CH-066~092 추가. **기존 TC 중 S3로 기대가 바뀌는 것**: TC-CH-031(토큰 있음 — 캐릭터 버튼이 **있다**, TC-CH-066으로 대체) · TC-CH-021(읽기 전용 — 버튼 이름 질의를 `/세바스찬\|시엘/` 정규식으로. 접근 이름이 `세바스찬 대사 생성`이라 정확 일치 질의는 S3에서도 null이 되어 단언이 무의미해진다) · TC-CH-040(메뉴 항목 — 대상이 "캐릭터+마지막"이면 `재작성`이 있다, TC-CH-079로 대체) · TC-CH-033(쓰기 경로 0회 단언에 `speak`·`regenerate` 포함 유지 — TC-CH-088) · TC-CH-053(T13~T16·T25 문구 변경분 — TC-CH-085).
> 공통 준비(S3): `vi.mock('@/api')`에 `speak`·`regenerate`를 더한다. 생성 대기는 "resolve하지 않은 Promise"로 만든 뒤 수동 resolve(화면 타이머가 없으므로 fake timers로 70초를 흘릴 필요 없음 — 흘려도 화면이 바뀌지 않음을 TC-CH-070에서 단언).

## 1. S1

| TC | 내용 | 기대(요지) |
|---|---|---|
| TC-CH-001 | 상단 바 | h1 = 방 제목, `<time>` = `formatMonthDay(room.createdAt)`(updatedAt 아님), aria-label `방 생성일 MM.DD` |
| TC-CH-002 | ‹ 뒤로 | 클릭 → `ld:lastRoomId` 삭제 후 `onBack` 1회. 마운트 시 이 버튼에 포커스 |
| TC-CH-003 | ⋯ 부재 | 읽기 전용에서 상단 바 버튼은 ‹ 하나뿐 |
| TC-CH-004 | 첫 로드 호출 | `listMessages`가 `(room.id)`로 1회(두 번째 인자 없음), 대기 중 `대화를 불러오는 중` |
| TC-CH-005 | 첫 로드 오류·재시도 | `role=alert` 제목·상세·「다시 시도」 → 재호출 → 성공 시 말풍선 |
| TC-CH-006 | 빈 방 | `{ messages: [], hasMore: false }` → `아직 대화가 없습니다`, `role=log` 없음 |
| TC-CH-007 | 캐릭터 말풍선 2종(v1.6 CR-001) | 세바스찬 → `character`+`sebastian`(왼쪽), `img[src="/embed/img/sebastian.png"]`, 이름 `세바스찬` · 시엘 → `character`+`ciel`(오른쪽), `img[src="/embed/img/ciel.png"]`, 이름 `시엘` · 둘 다 DOM 순서 아바타 → 이름 → 시각(`HH:mm`) → 본문 · 서로의 캐릭터 키는 없음 |
| TC-CH-008 | 유저 말풍선(가운데) | `user` 클래스만(`character`·`sebastian`·`ciel` 없음), 아바타 없음, DOM 순서 작성자명 → 시각 → 본문, `authorName=null` → `이름 없음` |
| TC-CH-009 | OOC(가운데 한 줄) | `ooc` 클래스만(`user`·`character` 없음), `— [지시] 텍스트 —`(장식 `aria-hidden`), 작성자명·아바타 없음, 시각 있음. 유저 말풍선과 클래스로 구분 |
| TC-CH-010 | 변형 판정 | `bubbleVariantOf`: `sebastian/line` → `sebastian` · `ciel/line` → `ciel` · `user/line` → `user` · `*/ooc` → `ooc`(speaker가 캐릭터여도) |
| TC-CH-011 | 이전 페이지 요청 | scrollTop ≤ 80 + scroll 이벤트 → `listMessages(room.id, { before: 첫 id })`, B0, `aria-busy=true` |
| TC-CH-012 | 앵커 보존 | 앞붙임 후 `scrollTop = 이전 scrollTop + Δ scrollHeight` |
| TC-CH-013 | 중복·종료 | 로딩 중 scroll 연속 → 요청 1회. `hasMore=false` → 요청 없음 |
| TC-CH-014 | 이전 페이지 오류 | B0 오류 + 「다시 시도」, 스크롤로 재요청 없음, 버튼으로 재요청 |
| TC-CH-015 | 리듀서 T1~T8 | 전이표 행마다 기대 상태·같은 참조 반환(S2 필드 `writing`·`editingId` 초기값 null 포함) |
| TC-CH-016 | 리듀서 T9~T12 · `mergeMessages` · `nextBefore` · `canAutoLoadOlder` | 중복 id 제거·정렬·unseen 증가/초기화 |
| TC-CH-017 | `scroll.ts` | 경계값(80·120), `restoreScrollTop` 클램프 |
| TC-CH-018 | `useAutoScroll` 뒤붙임 | 맨 아래 근처 → scrollTop = scrollHeight / 위쪽 → 그대로 |
| TC-CH-019 | 새 메시지 배지 | `unseenCount>0` → 배지, 클릭 → 맨 아래 + `unseenCleared` |
| TC-CH-020 | 맨 아래 도달 해제 | onScroll로 맨 아래 근처 → `onReachBottom` |
| TC-CH-021 | 읽기 전용 하단 바 부재 | `세바스찬`·`시엘` 버튼·textbox·switch 없음 |
| TC-CH-022 | 말풍선 메뉴 부재 | 읽기 전용에서 `contextmenu`·500ms 누름·Shift+F10 뒤 `dialog` 없음, 말풍선에 `tabIndex` 없음, contextmenu `defaultPrevented=false` |
| TC-CH-023 | 열람 안내 | `role=note` 문구 일치 |
| TC-CH-024 | 마지막 본 방 기록·삭제 | 마운트 → `ld:lastRoomId = room.id`. ‹ 뒤로 → 삭제. `pagehide`만으로는 삭제 안 함. 저장소 throw여도 `onBack` |
| TC-CH-025 | 스크롤 저장·복원 | 언마운트·`pagehide` → `ld:scroll:{id}` 저장, 재마운트 복원. 로딩 중 언마운트는 저장 안 함 |
| TC-CH-026 | 저장소 throw | 모든 storage 접근 throw → 화면 정상, 맨 아래 배치 |
| TC-CH-027 | 접근성 | `role=log`·`aria-live=polite`, 버튼 레이블, 포커스 순서 |
| TC-CH-028 | 390×565 스크린샷(수동, 읽기 전용) | 가로 스크롤 없음, A 44·D 28, 화자 정렬·색 |
| TC-CH-029 | 늦은 응답 무시 | 응답 전 언마운트 → 상태 갱신 없음 |
| TC-CH-030 | 오류 상세 | `NETWORK`·`NOT_FOUND`·`INTERNAL` 문구, 서버 message 미표시 |

## 2. S2

| TC | 내용 | 기대(요지) |
|---|---|---|
| TC-CH-031 | 토큰 있음 렌더 쌍 | `WRITER_VIEWER` → ⋯(`방 메뉴 열기`) 있음, `group` `메시지 작성` 안에 switch `OOC 지시 모드`(`aria-checked=false`, 글자 `OOC 끔`)·textbox `메시지 입력`(placeholder `대사나 지시를 입력`)·`전송`. `role=note` 없음. TC-CH-003·021·023과 쌍. **캐릭터 버튼 단언은 TC-CH-066으로 대체**(TK-07) |
| TC-CH-032 | 전송 비활성 | 빈 입력·공백만 → 전송 disabled · `phase=loading`·`error` → disabled · 2001자 → disabled, 카운터 `2001/2000`·`aria-invalid=true` · 2000자 → enabled |
| TC-CH-033 | 전송 성공 | `안녕` 입력 → 전송 → `appendUser(room.id, { text: '안녕', ooc: false })` 1회 · **모킹한 `@/api`의 `appendUser` 외 export(첫 로드 `listMessages` 1회 제외) 호출 0회**(AI 호출 없음, R-CHAT-006) · 응답 `Message`(authorName `미샤`)가 가운데 말풍선(`user` 클래스, v1.6 CR-001)으로 붙음(작성자명 `미샤`) · 입력 비움, 입력에 포커스 · OOC 값 유지 |
| TC-CH-034 | OOC 토글 | switch 클릭 → `aria-checked=true`, 글자 `OOC 켬` → 전송 → `appendUser(…, { text, ooc: true })` · 응답 `kind='ooc'`면 중앙 말풍선 · 전송 뒤에도 `OOC 켬` 유지 |
| TC-CH-035 | Enter·Shift+Enter·IME | Enter → 전송 1회 · Shift+Enter → 줄바꿈(호출 없음) · `isComposing=true` Enter → 호출 없음 · 빈 입력 Enter → 호출 없음 |
| TC-CH-036 | 전송 중 중복 방지 | 응답 대기 중 전송 disabled, 입력 `readOnly`, group `aria-busy=true` · Enter 연타·클릭 연타 → `appendUser` 1회 · 응답 뒤 해제 |
| TC-CH-037 | 전송 실패 | `INTERNAL` → 입력 유지, E `role=alert` `ERROR_MESSAGES.INTERNAL` · `RATE_LIMITED`+`retryAfterSec: 40` → `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.`(warning) · `NOT_FOUND` → `방을 찾을 수 없습니다. 목록으로 돌아가 주세요.` · `NETWORK` 문구 · 2000ms 뒤 토스트 없음 · 말풍선 추가 없음 · `onAuthFailure` 미호출 |
| TC-CH-038 | 전송 뒤 스크롤 | 맨 아래 근처에서 전송 성공 → `scrollTop = scrollHeight`, 배지 없음 · 위쪽(거리 > 120)에서 성공 → scrollTop 그대로, 배지 `새 메시지` |
| TC-CH-039 | 말풍선 메뉴 열기 | `contextmenu` → `dialog` `메시지 메뉴`, `defaultPrevented=true` · pointerdown 후 500ms → 열림 · 499ms에 pointerup → 안 열림 · 11px 이동 → 안 열림 · 터치 롱프레스 뒤 contextmenu → 시트 1개만 · 말풍선 포커스 + Shift+F10 → 열림 |
| TC-CH-040 | 메뉴 내용 | 머리 `세바스찬 · 16:41  "예, 도련님."`(20자 넘으면 `…`), 유저는 작성자명, OOC는 `[지시]` · 항목 `수정`·`삭제`·`취소` 순서, `재작성` 없음(S3) |
| TC-CH-041 | 메뉴 닫기·포커스 | 취소·Esc·덮개 클릭 → dialog 없음, 포커스가 연 말풍선으로 · 시트 안 Tab 순환 |
| TC-CH-042 | 인라인 수정 열기 | 수정 → 시트 닫힘 → `group` `메시지 수정` 안 textbox `수정할 내용` = 원문, 포커스, 커서 끝 · 저장 disabled(바뀌지 않음) · 1글자 바꾸면 enabled · 공백만·2001자 → disabled |
| TC-CH-043 | 수정 저장 | 저장 → `editMessage(id, { text: '새 본문' })` 1회 → 말풍선 본문 = 응답 text, 편집기 없음, 히스토리 포커스 · 대기 중 취소·저장 disabled, Esc 무시 |
| TC-CH-044 | 수정 실패·취소 | `INTERNAL` → 편집기·입력 유지, 토스트 · `NOT_FOUND` → `메시지를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.` · 취소·Esc → 원문 말풍선, `editMessage` 0회 |
| TC-CH-045 | 메시지 삭제 | 삭제 → `alertdialog` `이 메시지를 삭제할까요?`, 본문 `삭제한 메시지는 되돌릴 수 없습니다.`, 첫 포커스 `취소` · 취소 → `deleteMessage` 0회 · 삭제 → `deleteMessage(id)` 1회(대기 중 두 버튼 disabled) → 말풍선 없음, 시트 없음, 히스토리 포커스 |
| TC-CH-046 | 삭제 실패·NOT_FOUND·빈 결과 | `INTERNAL` → 말풍선 유지, 시트 닫힘, 토스트(`removeMessage` = `failed`) · `NOT_FOUND` → 말풍선 제거, 토스트 없음(`removed`) · 마지막 한 개 삭제 + `hasMore=true` → `isEmptyWithMore=true` → `listMessages(room.id)` 재호출(두 번째 인자 없음) → 재로드 성공 시 **맨 아래 배치**(`scrollTop = scrollHeight − clientHeight`, 마운트 때 저장 거리 무시) · `hasMore=false`면 재호출 없이 `아직 대화가 없습니다` |
| TC-CH-047 | ⋯ 방 메뉴 | ⋯ → `dialog` `방 메뉴`, 머리 `방 메뉴 · 티타임`, 항목 `이름 변경`·`방 삭제`·`취소`, `장기기억` 없음(S4) · 닫으면 ⋯ 포커스 |
| TC-CH-048 | 이름 변경 성공 | 이름 변경 → `dialog` `방 이름 변경`, textbox `방 이름` = 현재 제목, 카운터 `3/60` · 그대로·공백만·61자 → 저장 disabled · 새 제목 → 저장(또는 Enter) → `renameRoom(room.id, { title })` 1회 → `onRoomRenamed(응답)` · App 통합: h1·`main` aria-label이 새 제목, 재마운트 없음(`listMessages` 추가 호출 0), 시트 닫힘, ⋯ 포커스 |
| TC-CH-049 | 이름 변경 실패 | `INTERNAL` → 시트 유지, 입력값 유지, 시트 안 `role=alert` 문구, E 토스트 없음 · `NOT_FOUND` → `방을 찾을 수 없습니다. 목록으로 돌아가 주세요.` · `LEVEL_TOO_LOW` → 시트 닫힘, 전환(TC-CH-051 기대), 토스트 |
| TC-CH-050 | 방 삭제 | 방 삭제 → `alertdialog` `이 방을 삭제할까요?` + `메시지와 장기기억이 함께 지워지며 되돌릴 수 없습니다.` · 삭제 → `deleteRoom(room.id)` 1회 → `ld:lastRoomId` 삭제 → `onBack` 1회 · `NOT_FOUND`도 같음 · `INTERNAL` → `onBack` 0회, 시트 닫힘, 토스트 · 대기 중 Esc·덮개로 안 닫힘 |
| TC-CH-051 | 인증 실패 전환(TC-FLOW, App 통합) | `initToken('?t=x')` → 전송이 `LEVEL_TOO_LOW` → 같은 화면에서 ⋯·group·textbox·switch DOM 없음, `role=note` 나타남, 토스트 `대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.`(warning) 1개, ‹ 포커스, `getToken() === null` · 이후 말풍선 contextmenu → dialog 없음 · ‹ 뒤로 → rooms에도 `새 방 만들기` 없음 · `TOKEN_INVALID`·`TOKEN_REQUIRED` 문구 각각 · F-CH-16을 같은 인증 실패로 두 번 불러도 `onAuthFailure` 1회·토스트 1회(멱등) |
| TC-CH-052 | 전환 시 열린 상태 정리 | 편집기 열린 채 수정 저장이 `TOKEN_INVALID` → **전환 커밋에서** 편집기 없음, 원문 말풍선 · 메시지 삭제 확인에서 `LEVEL_TOO_LOW` → 시트 없음 · 리듀서 `writing`·`editingId` = null |
| TC-CH-053 | 리듀서 T13~T26 · `canSend` | 전이표 행마다 기대 상태·같은 참조 반환. T1을 ready에서 받으면 `editingId`·`unseenCount` 초기화 · T14 · T17/T19 · T24 · T25/T26 |
| TC-CH-054 | 쓰기 직렬화 | 전송 대기 중: 말풍선 contextmenu·롱프레스 → dialog 없음, ⋯ `disabled` · 수정 저장 대기 중 전송 disabled(입력은 가능) · 이름 변경 대기 중 ⋯ `disabled` |
| TC-CH-055 | BottomSheet(공용) | `aria-modal=true`, 첫 포커스, Tab/Shift+Tab 순환, Esc·덮개 → `onClose`, 패널 클릭은 닫지 않음, `isDismissDisabled`면 Esc·덮개 무시, 언마운트 시 이전 포커스 복귀(대상이 DOM에 없으면 복귀 안 함) |
| TC-CH-056 | ConfirmDialog(공용) | `role=alertdialog`, 이름 = title, 첫 포커스 취소, 확인 danger 클래스, `isBusy`면 두 버튼 disabled |
| TC-CH-057 | PromptSheet(공용) | 초기값·카운터, `canSave` false면 저장 disabled·Enter 무시, `isBusy`면 입력 readOnly, `errorText` → `role=alert` |
| TC-CH-058 | TextArea(공용) | `scrollHeight` 모킹 → 1줄 36px·3줄 76px 상한·넘으면 `overflow-y: auto` · `onEnter` 있음/없음 Enter 동작 · IME 가드 · `counterMode` overflow/always |
| TC-CH-059 | Toggle(공용) | `role=switch`, `aria-checked`, 클릭·Space → `onChange(!isOn)`, 글자 on/off |
| TC-CH-060 | useLongPress(공용) | 500ms 발화, 이동 10px 허용/11px 취소, up·leave·cancel 취소, 오른쪽 버튼 pointerdown 무시, contextmenu preventDefault + 발화, 롱프레스 직후 contextmenu 중복 없음, 언마운트 타이머 해제 |
| TC-CH-061 | 390×565 쓰기 판 스크린샷(수동) | 하단 바 96(1줄)·136(3줄), A 44, 가로 스크롤 없음, 시트 3종·확인 시트 각 1장, E 토스트 1장 |
| TC-CH-062 | 토큰 비노출(리뷰) | rooms TC-RM-030과 같은 grep + `ui/src/chat` 안 `getToken`·`initToken` 호출 0건 |
| TC-CH-063 | 늦은 쓰기 응답 무시 | 전송·수정·삭제 대기 중 언마운트(‹ 뒤로) → dispatch·토스트·`onAuthFailure`·`onBack` 호출 없음 |
| TC-CH-064 | 방 삭제 후 목록(TC-FLOW, App 통합) | 목록 `[r1, r2]` → r1 진입 → ⋯ → 방 삭제 → 확인 → `deleteRoom('r1')` 204 → rooms 화면, `listRooms` **재호출 1회**(총 2회), 두 번째 응답 `[r2]`가 그대로 표시, `ld:lastRoomId` 없음 |
| TC-CH-065 | 이름 변경 후 목록(TC-FLOW, App 통합) | r1 진입 → 이름 변경 성공(응답 title `새 이름`) → ‹ 뒤로 → `listRooms` **재호출 1회**, 행이 두 번째 응답 그대로(`새 이름`) 표시, 화면이 목록을 직접 고치지 않음(재요청 결과만) |

## 3. S3 (AI 발화 · 재작성)

자동 = vitest(jsdom), 수동 = 스크린샷·실기기.

| TC | 내용 | 요구ID | 방식 | 기대(요지) |
|---|---|---|---|---|
| TC-CH-066 | 토큰 있음 렌더 쌍(S3) | R-CHAT-004 · 013 · 008 | 자동 | `group` `메시지 작성` 안 1행에 button `세바스찬 대사 생성`(글자 `세바스찬`) → `시엘 대사 생성`(글자 `시엘`) 순서, 그 뒤 switch `OOC 지시 모드`. TC-CH-031의 나머지 단언(⋯·textbox·전송·note 없음) 유지 |
| TC-CH-067 | 읽기 전용 버튼 부재(S3) | R-CHAT-004 · 008 | 자동 | `READ_ONLY_VIEWER` → `queryByRole('button', { name: /세바스찬\|시엘/ })` null(말풍선 이름 글자는 button이 아니다) · 임시·실패 말풍선 DOM 없음(`.pending` 0개) |
| TC-CH-068 | speak 호출 인자 | R-CHAT-005 · R-MSG-003 | 자동 | 세바스찬 클릭 → `speak(room.id, { character: 'sebastian' })` 1회(인자 정확히 두 개, 본문 키 `character`만) · 시엘 → `{ character: 'ciel' }` · `appendUser`·`regenerate`·`editMessage`·`deleteMessage` 0회 |
| TC-CH-069 | 생성 중 임시 말풍선 | R-CHAT-005 · 002 · 013 | 자동 | 대기 중 목록 끝 `li`에 `pending`+`character`+`sebastian` 클래스(왼쪽) / 시엘이면 `ciel`(오른쪽) · 아바타·짧은 이름 있음, `<time>` 없음 · `…`는 `aria-hidden` · `role=status` 이름 없는 영역 글자에 `세바스찬 대사를 만드는 중` · **모양 적용(DC-01)**: 자식에 Bubble 모듈 클래스 `avatar`·`content`·`head`·`name`·`body`가 있다(같은 `Bubble.module.css` 클래스라 실물 자손 선택자 `.sebastian .body`·`.ciel .head`가 걸린다). 수동 확인(TC-CH-092)에서 배경 `--bubble-{c}-bg`와 시엘 머리 줄 거울 배치를 computed style로 본다(jsdom은 CSS Modules 스타일을 계산하지 않음) · contextmenu `defaultPrevented=false`, 500ms 누름 뒤 dialog 없음, `tabIndex` 없음 |
| TC-CH-070 | 생성 중 잠금 | R-CHAT-005 · 004 | 자동 | 대기 중: 두 캐릭터 버튼 `disabled` · 입력 `안녕` 있어도 전송 `disabled` · textbox `readOnly` **아님**, 타이핑 반영 · ⋯ `disabled` · 말풍선 contextmenu → dialog 없음 · 같은 틱 클릭 연타·시엘 클릭 → `speak` 총 1회 · `vi.advanceTimersByTime(80_000)` 뒤에도 임시 말풍선 그대로(화면 타임아웃 없음) |
| TC-CH-071 | 성공 교체 | R-CHAT-005 | 자동 | resolve `201 Message(speaker 'ciel', id 99)` → `pending` 0개, 끝 말풍선 `ciel` 클래스·`시엘`·`/embed/img/ciel.png`·본문 = 응답 text, 말풍선 수 +1(중복 없음) · 두 버튼·전송(내용 있으면) 다시 활성 |
| TC-CH-072 | speak 자동 스크롤 | R-CHAT-003 · 005 | 자동 | 맨 아래 근처: 임시 말풍선 등장 → `scrollTop = scrollHeight`, 성공 → 다시 맨 아래, 배지 없음 · 위쪽(거리 > 120): 등장·성공 모두 scrollTop 그대로, 성공 뒤 배지 `새 메시지`, `unseenCount=1` |
| TC-CH-073 | 실패 → 재시도 | R-CHAT-005 · 011 | 자동 | `LLM_FAILED` → 같은 자리·같은 쪽에 `pending failed` 말풍선, `role=alert` `생성에 실패했습니다.`, button `세바스찬 대사 재시도`(글자 `재시도`) · E 토스트 **없음** · 두 버튼 활성 · 「재시도」 → `speak(room.id, { character: 'sebastian' })` 2번째 호출, 실패 말풍선이 임시 말풍선으로 · 성공 → 교체. `LLM_EMPTY`도 같은 문구·같은 흐름 |
| TC-CH-074 | 실패 코드별 문구 | R-CHAT-011 · 005 | 자동 | `SPEAK_IN_PROGRESS` → `이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요.` + 재시도 · `RATE_LIMITED`+`retryAfterSec: 40` → `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.` + 재시도 · `NETWORK` → `서버에 연결할 수 없습니다.` + 재시도 · `INTERNAL` → `ERROR_MESSAGES.INTERNAL` + 재시도 · `CONFIG_INVALID` → `서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요.` + 재시도 button **있음**(사용자 결정 2026-10-06) · 어느 경우도 `onAuthFailure` 0회, 서버 message 미표시 |
| TC-CH-075 | 실패 말풍선 사라짐 | R-CHAT-005 | 자동 | 세바스찬 실패 말풍선 → 시엘 클릭 → 세바스찬 실패 말풍선 없음, 시엘 임시 말풍선 1개 · 실패 말풍선 상태에서 유저 전송 성공 → 실패 말풍선은 목록 끝에 남는다 · ‹ 뒤로 → 재마운트 → `pending` 0개 |
| TC-CH-076 | speak 인증 실패 전환 | R-CHAT-011 · 008 | 자동(App 통합 포함) | `LEVEL_TOO_LOW` → **같은 커밋**에서 임시 말풍선·group 없음, `role=note`, 토스트 `대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.` 1개, `onAuthFailure` 1회, ‹ 포커스, 리듀서 `pending`·`writing` null · `TOKEN_INVALID`·`TOKEN_REQUIRED` 각각 |
| TC-CH-077 | speak 방 사라짐 | R-CHAT-005 · R-ROOMS-004 | 자동 | `NOT_FOUND` → `ld:lastRoomId` 삭제, `onBack` 1회, 토스트 없음, `speak` 재호출 없음 |
| TC-CH-078 | 빈 방 첫 speak | R-CHAT-005 · 003 | 자동 | `{ messages: [], hasMore: false }` → `아직 대화가 없습니다` → 세바스찬 클릭 → 빈 상태 문구 없음, `role=log` 안 임시 말풍선 → 성공 → 말풍선 1개, 맨 아래 배치 |
| TC-CH-079 | 재작성 표시 조건 | R-CHAT-007 · R-MSG-006 | 자동 | 마지막이 세바스찬 `line` → 메뉴 항목 `수정`·`재작성`·`삭제`·`취소` 순서 · 캐릭터이지만 마지막 아님 → `재작성` 없음 · 마지막이 유저 → 없음 · 마지막이 OOC → 없음 · 실패 말풍선이 끝에 있어도 마지막 메시지가 캐릭터면 있음 · 읽기 전용 → 메뉴 자체 없음(TC-CH-022) |
| TC-CH-080 | 재작성 실행·진행·성공 | R-CHAT-007 · 005 | 자동 | `재작성` → confirm·alertdialog 없이 시트 닫힘 → `regenerate(72)` 1회(인자 하나) · 대기 중 대상: `regenerating` 클래스, 본문 `aria-busy=true`, 원 본문 그대로, `다시 쓰는 중…`(`role=status`) · 두 버튼·전송 `disabled`, 입력 타이핑 가능 · `200 Message(id 72, 새 text)` → 같은 자리 본문 교체, 말풍선 수 그대로, 표시 사라짐, 포커스 = 그 말풍선 |
| TC-CH-081 | 재작성 실패 | R-CHAT-007 · 011 | 자동 | `LLM_FAILED`·`LLM_EMPTY` → 원 본문 그대로, 토스트 `대사를 다시 만들지 못했습니다. 메뉴에서 다시 시도해 주세요.` · `SPEAK_IN_PROGRESS` → `ERROR_MESSAGES.SPEAK_IN_PROGRESS` · `CONFIG_INVALID` → `ERROR_MESSAGES.CONFIG_INVALID` · `NOT_CHARACTER_MESSAGE` → `ERROR_MESSAGES.NOT_CHARACTER_MESSAGE` · `RATE_LIMITED`+40 → 초 문구 · 재시도 button 없음 · 다시 메뉴 → `재작성` 다시 가능 |
| TC-CH-082 | `NOT_LAST_MESSAGE` 재조회 | R-CHAT-007 · 011 | 자동 | 409 → 토스트 `다른 메시지가 먼저 이어져 재작성할 수 없습니다. 대화를 새로 불러옵니다.` · `listMessages(room.id)` 재호출 1회(두 번째 인자 없음) · 목록 = 재조회 응답 · 재조회 응답을 **resolve하기 전**(loading 커밋)에는 포커스가 log로 가지 않고 ‹로도 끌려가지 않는다 → resolve 후(ready 커밋) 포커스 = 히스토리 스크롤 박스(CF-01, F-CH-41) · 재조회 실패면 포커스 이동 없음 · `regenerate` 재호출 없음 |
| TC-CH-083 | 재작성 대상 사라짐 | R-CHAT-007 · 011 | 자동 | `NOT_FOUND` → 대상 말풍선 제거, 토스트 `메시지를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.` · 남은 0건 + `hasMore` → `listMessages(room.id)` 재호출 → ready 뒤 포커스 = log · 남은 1건+ → 포커스 = log · 남은 0건 + `!hasMore`(빈 상태 뷰) → 포커스 = ‹ 뒤로(F-CH-41) |
| TC-CH-084 | 재작성 인증 실패 | R-CHAT-011 · 008 | 자동 | `TOKEN_INVALID` → 전환(TC-CH-051 기대), 대상 표시(`regenerating`) 없음, 원 본문 |
| TC-CH-085 | 리듀서 S3 | R-CHAT-005 · 007 | 자동(순수) | T13(`regenerate` 허용) · T14(`writeStarted speak` 거절, 같은 참조) · T15/T16(`writing.kind==='speak'`에 `writeFinished` → 같은 참조) · T25(`pending`만 있어도 정리) · T27~T34 각 행 · T27이 실패 `pending`을 덮음 · T29 unseen 규칙(T9와 같음) · T1~T3 뒤 `pending` null · `isRegenerateTarget` 5경계(마지막 캐릭터 line / 마지막 아님 / 유저 / OOC / 빈 목록) · `canSpeak`(편집 중 false, DC-10) · T27이 `editingId !== null`이면 같은 참조 |
| TC-CH-086 | 문구 함수 | R-CHAT-011 | 자동(순수) | `speakErrorText` `design/generate.md` §3 표 행마다 · `writeErrorText(e, 'regenerate')` §8.4 표 행마다 · 인증 3종은 동작과 무관하게 전환 문구 |
| TC-CH-087 | 늦은 생성 응답 무시 | R-CHAT-005 · 007 | 자동 | speak·regenerate 대기 중 ‹ 뒤로(언마운트) → resolve(성공·실패·인증 실패·NOT_FOUND 각각) → dispatch·토스트·`onAuthFailure`·`onBack` 추가 호출 없음 |
| TC-CH-088 | 전송은 AI 호출 없음(유지) | R-CHAT-006 | 자동 | TC-CH-033 단언 그대로 + 모킹 `speak`·`regenerate` 호출 0회를 명시 단언 · Enter 전송도 같음 |
| TC-CH-089 | 캐릭터 버튼 포커스 복귀 | R-CHAT-013 · 005 | 자동 | 세바스찬 버튼 포커스 → Enter → 대기 중 `button.blur()`로 포커스 잃은 상태 구성(jsdom은 disabled 포커스 이동을 흉내 내지 않음 — 중간 단언 없음, DC-05) → 응답 → 세바스찬 버튼 포커스 · F-CH-38 경합: 생성 중 입력창으로 포커스 이동 → 응답 → 이후 다른 쓰기 잠금 해제에서 캐릭터 버튼으로 끌려가지 않음(복귀 대상 기억이 잠금 해제마다 비워짐) · 대기 중 입력창으로 포커스를 옮겼으면 응답 뒤에도 입력창 |
| TC-CH-090 | 재시도 잠금 | R-CHAT-005 | 자동 | 실패 말풍선 표시 중 유저 전송 대기 → 「재시도」 `disabled`, 응답 뒤 활성 |
| TC-CH-091 | `useAutoScroll` tailKey | R-CHAT-003 | 자동(훅) | `tailKey` null → `'sebastian:generating'`: 측정이 맨 아래 근처면 `scrollTop = scrollHeight`, 위쪽이면 그대로 · `generating` → `failed`도 같음 · 값 → null: 변화 없음 · 첫 배치 전이면 무시 |
| TC-CH-092 | 390×565 스크린샷(수동) | R-CHAT-013 · 002 · 004 | 수동 | 1행 `[세바스찬] [시엘] … [OOC 끔]` 한 줄, 가로 스크롤 없음 · 세바스찬 임시(왼쪽)·시엘 임시(오른쪽) · 실패 말풍선(테두리·`!`·재시도) · 재작성 중(흐림 + 문구 — 가짜 제공사는 즉시 응답해 자동 캡처 불가, **수동 항목 유지**: 실제 제공사 또는 응답 지연 상태에서 사람이 캡처, v1.7.1) · 재작성 항목 있는 메뉴 실측 약 247px(±16px 허용) · 각 1장 · 임시 말풍선 배경색·시엘 머리 줄 거울 배치가 메시지 말풍선과 같음(DC-01) |
| TC-CH-093 | 「재시도」 뒤 포커스(DC-03) | R-CHAT-013 · 005 | 자동 | 시엘 실패 말풍선 「재시도」 클릭 → 버튼 언마운트 → 응답(성공·실패 각각) → 포커스 = button `시엘 대사 생성` |
| TC-CH-094 | 인라인 수정 중 생성 잠금(DC-10) | R-CHAT-005 · 007 | 자동 | 편집기 열림 → 두 캐릭터 버튼·「재시도」 `disabled`, 클릭해도 `speak` 0회 · 전송은 내용 있으면 활성(S2 그대로) · 편집 취소 → 버튼 활성 |
| TC-CH-096 | speak 월 한도 초과(S3b) | R-CHAT-011 · 005 · R-LLM-007 | 자동 | 모킹 `speak` → `{ ok: false, error: { code: 'LLM_BUDGET_EXCEEDED', status: 429, message } }` → 같은 자리 `pending failed` 말풍선, `role=alert` `이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.`, 「재시도」 있음 · E 토스트 없음 · 같은 status 429 `RATE_LIMITED`+`retryAfterSec: 40`과 **문구가 다름**(초 문구 아님) · 숫자·날짜·카운트다운 글자 없음 · `vi.advanceTimersByTime(60_000)` 뒤에도 `speak` 추가 호출 0회(자동 재시도 없음) · `onAuthFailure` 0회, group·캐릭터 버튼 그대로(전환 없음) · 「재시도」 → `speak` 2번째 호출(같은 캐릭터) |
| TC-CH-097 | 재작성 월 한도 초과(S3b) | R-CHAT-011 · 007 · R-LLM-007 | 자동 | 모킹 `regenerate` → 같은 429 `LLM_BUDGET_EXCEEDED` → 원 본문 그대로, 재작성 중 표시 사라짐 · E 토스트 `이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.`, **톤 warning**(Toast 클래스) · 재조회(`listMessages` 추가 호출) 없음 · 전환 없음 · 자동 재시도 없음 |
| TC-CH-095 | 수정 저장·삭제 대기 중 캐릭터 버튼·재시도 disabled | R-CHAT-005 · 007 | 자동 | **확정**(시나리오 v0.6.1) — 실패 말풍선을 둔 상태에서 수정 저장·삭제·재작성 대기 중 캐릭터 버튼 2·「재시도」 `disabled` → 응답 후 복원. 대상: functions.md §4.3 잠금 표의 `edit`·`delete`·`regenerate` 행 |
