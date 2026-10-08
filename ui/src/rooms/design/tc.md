# rooms 상세 설계 — 예정 TC 목록 (분할 문서)

> 주 문서: `ui/src/rooms/design.md`(RTM §14 — 요구 → 설계 절 → TC 매핑 표는 주 문서에 있다). 이 파일은 주 문서 옛 §14.1(S1~S3c 예정 TC 목록)을 40KB 한계 때문에 v1.8.1에서 **내용 그대로** 옮긴 것이다(chat `design/tc.md` 선례).
> S6 예정 TC(TC-RM-041~064)는 `design/lock.md` §12에 있다.

## 14.1 예정 TC 목록 (ui-test-designer가 시나리오로 확정)

| TC | 내용 | 기대(요지) |
|---|---|---|
| TC-RM-001 | 목록 렌더 | 받은 순서 그대로 제목·`MM.DD`(updatedAt) 표시, 화면이 재정렬하지 않음 |
| TC-RM-002 | 행 클릭 | `onOpenRoom`이 그 `RoomSummary`로 1회 호출 |
| TC-RM-003 | 키보드 진입 | 행 포커스 후 Enter·Space → `onOpenRoom` |
| TC-RM-004 | 로딩 | `listRooms` 대기 중 `role=status` "불러오는 중" |
| TC-RM-005 | 빈 목록 | `[]` → "아직 방이 없습니다", 목록 `ul` 없음 |
| TC-RM-006 | 오류 + 다시 시도 | 실패 → `role=alert` 제목·상세·「다시 시도」, 클릭 → `listRooms` 2회째 호출, 성공 시 목록 |
| TC-RM-007 | 오류 상세 코드별 | `NETWORK` → `서버에 연결할 수 없습니다.`, `INTERNAL` → `ERROR_MESSAGES.INTERNAL`, 서버 `message` 미표시 |
| TC-RM-008 | 자동 진입 성공 | 판정 시점에 목록 응답이 성공 상태이고 저장 id가 그 목록에 있음 → `onAutoOpenSettled` 후 `onOpenRoom(그 방)`. 목록 렌더 여부는 단언하지 않는다 |
| TC-RM-009 | 자동 진입 대상 없음 | 목록에 없음 → `ld:lastRoomId` 삭제, `onOpenRoom` 미호출 |
| TC-RM-010 | 저장소 throw | `localStorage.getItem/setItem/removeItem` throw → storage 함수 전부 throw 없이 `null`/무시, 화면은 일반 목록 |
| TC-RM-011 | 읽기 전용 부재 | `viewer=READ_ONLY_VIEWER` → `새 방 만들기` 버튼·textbox가 DOM에 없음 |
| TC-RM-012 | App 흐름(TC-FLOW) | 저장 id 있음 → chat 자동 진입 → ‹ 뒤로 → 목록 표시, `ld:lastRoomId` 삭제됨 → App 재마운트 시 자동 진입 없이 목록 |
| TC-RM-013 | formatDate | `MM.DD`·`HH:mm` 0 채움, `toIsoDate`·`toIsoDateTime` 형식 |
| TC-RM-014 | 자동 진입 보류 | 첫 로드 실패 → 자동 진입 없음 → 재시도 성공 → 그때 진입 |
| TC-RM-015 | 화면 크기·토큰(수동, 읽기 전용) | 390×565 스크린샷에서 가로 스크롤 없음, 상단 44·행 56, Rosebell 색 |
| TC-RM-016 | 언마운트 후 응답 | 응답 전 언마운트 → `onOpenRoom`·`onAutoOpenSettled` 미호출, 저장소 변화 없음(경고 부재로 판별하지 않는다) |
| TC-RM-017 | 포커스·역할 | 마운트 시 h1 포커스, 행 `button` 이름 = `{제목}, 마지막 갱신 {MM.DD}` |
| TC-RM-018 | (S2) 토큰 있음 렌더 쌍 | `viewer=WRITER_VIEWER` → `새 방 만들기` 버튼(글자 `+ 새 방`) 있음, B 행(`role=group` `새 방 만들기`)은 처음에 없음. TC-RM-011과 쌍 |
| TC-RM-019 | (S2) 입력 행 열기 | 「+ 새 방」 클릭 → textbox `새 방 제목` 포커스, placeholder `새 방 제목 입력`, 카운터 `0/60`, 만들기 disabled, 취소 enabled |
| TC-RM-020 | (S2) 제목 경계 | `'   '` → 만들기 disabled · 60자(이모지 포함 코드 포인트 60) → enabled · 61자 → disabled, 카운터 `61/60` `over` 클래스, 입력 `aria-invalid=true` · 앞뒤 공백은 세지 않음 |
| TC-RM-021 | (S2) 생성 성공 | 만들기 → `createRoom({ title: '  안개 낀 런던  ' })` 1회(원문 그대로), `listRooms` 추가 호출 없음, `onOpenRoom(응답 RoomSummary)` 1회. App 통합: chat h1 = 응답 title, `ld:lastRoomId` = 응답 id |
| TC-RM-022 | (S2) 중복 제출 | 응답 대기 중 만들기 연타·Enter 연타 → `createRoom` 1회. 대기 중 입력 `readOnly`, 취소·만들기 disabled |
| TC-RM-023 | (S2) 생성 실패 | `INTERNAL` → B 행·입력값 유지, `role=alert` `ERROR_MESSAGES.INTERNAL`(danger) · `RATE_LIMITED`+`retryAfterSec: 40` → `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.`(warning) · `RATE_LIMITED` 값 없음 → 기본 문구 · `NETWORK` → `서버에 연결할 수 없습니다.` · 2초 뒤 토스트 사라짐(fake timers) · `onAuthFailure` 미호출 |
| TC-RM-024 | (S2) 인증 실패 전환 | `LEVEL_TOO_LOW`·`TOKEN_INVALID`·`TOKEN_REQUIRED` 각각 → `onAuthFailure` 1회, 문구 §8.3. App 통합(`initToken('?t=x')`): 전환 뒤 `새 방 만들기`·textbox DOM 없음, h1 포커스, `getToken() === null` |
| TC-RM-025 | (S2) 취소·Esc | 입력 후 취소 → B 없음, 다시 열면 빈 입력, 포커스 「+ 새 방」 · Esc 같음 · 요청 중 Esc·취소 무시 |
| TC-RM-026 | (S2) Enter 제출·IME | 유효 제목 Enter → `createRoom` 1회 · `isComposing=true` Enter → 호출 없음 · 무효 제목 Enter → 호출 없음 |
| TC-RM-027 | (S2) App 토큰 흐름(TC-FLOW) | `initToken('?t=abc')` → `<App />` → 「+ 새 방」 있음 → 생성 → chat. `initToken('')` → 「+ 새 방」 없음 |
| TC-RM-028 | (S2) token.ts | `readTokenFromSearch`: `'?t=abc'`→`'abc'` · `'?t=%20abc%20'`→`'abc'` · `'?t='`·`'?t=%20'`·`''`·`'?x=1'`→`null` · `'?t=a%2Bb'`→`'a+b'`. `initToken`→`getToken`, `clearToken`→`null`. 호출 전후 `localStorage`·`sessionStorage` 길이·`document.cookie` 변화 없음 |
| TC-RM-029 | (S2) viewer·limits·tone | `viewerFromToken(null)` = READ_ONLY, `('x')` = WRITER · `countChars('  a😀b ')` = 3 · `isRoomTitleValid` 0/1/60/61 · `toastToneOf` auth·RATE_LIMITED·(v1.5.1) LLM_BUDGET_EXCEEDED = warning, 그 밖 danger |
| TC-RM-030 | (S2) 토큰 비노출(리뷰) | grep: `localStorage`·`sessionStorage`·`document.cookie` 접근은 `storage.ts`뿐이고 토큰 값을 쓰지 않음 · `ui/src` 에서 `?t=`를 API 경로에 붙이는 코드 0건 · `console.` 로 토큰 출력 0건 · `initToken`·`configureClient` 호출은 `main.tsx`뿐 |
| TC-RM-031 | (S2) 쓰기 판 스크린샷(수동) | 390×565, 「+ 새 방」·B 행 열림 상태, 가로 스크롤 없음, B 52·A 44 |
| TC-RM-033 | (S3c) 주인 ⚙ 렌더 | `initToken('?t=x')` + `getCharacterSettings` ok → `getCharacterSettings` 정확히 1회 · 응답 뒤 `캐릭터 설정` 버튼 있음 · DOM 순서 ⚙ → `새 방 만들기` |
| TC-RM-034 | (S3c) 판정 실패 = 조용히 | `OWNER_ONLY`·`TOKEN_INVALID`·`LEVEL_TOO_LOW`·`NETWORK` 각각 → ⚙ 없음 · `새 방 만들기` 있음(canWrite 유지) · `getToken() !== null` · `role=alert` 없음 · revokeWrite 경로 미호출 |
| TC-RM-035 | (S3c) 토큰 없음 | `initToken('')` → `getCharacterSettings` 미호출 · ⚙·「+ 새 방」 없음 |
| TC-RM-036 | (S3c) 진입·복귀(TC-FLOW) | ⚙ 클릭 → 설정 화면 h1 `캐릭터 설정` → ‹(clean) → 목록 다시 로드 · ⚙ 유지 · `ld:lastRoomId` 변화 없음 |
| TC-RM-037 | (S3c) 주인 상실 안내 | 설정 화면 열기 `OWNER_ONLY` → 목록 · 토스트 warning `캐릭터 설정은 갠홈 주인만 열 수 있습니다.` 1회 · ⚙ 없음 · `새 방 만들기` 있음 |
| TC-RM-038 | (S3c) 쓰기 상실 시 ⚙ 소멸 | 주인 상태에서 방 생성 `TOKEN_INVALID` → 「+ 새 방」과 ⚙ 함께 DOM 없음 |
| TC-RM-039 | (S3c) IconButton `settings` | `icon='settings'` → `<svg aria-hidden>` 렌더, `aria-label` 그대로, 44×44 클래스 · 기존 `back`·`more` 회귀 없음 |
| TC-RM-040 | (S3c) 주인 판 스크린샷(수동) | 390×565 상단 바 ⚙ + 「+ 새 방」, 가로 스크롤 없음, 328px 폭에서도 한 줄 |
| TC-RM-032 | (S2) 공용 TextInput·Toast·useToast·Button ref | TextInput 카운터·`over`·Enter/Esc/IME · Toast `role=alert`·톤 클래스 · useToast 2000ms 뒤 null, 새 show가 타이머 재시작·id 증가, 언마운트 시 타이머 해제 · Button `buttonRef`가 button 요소를 가리킴 |
