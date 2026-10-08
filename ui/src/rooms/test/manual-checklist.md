# rooms(방 목록) 수동 확인표

- 확인표 버전: **v0.3**(2026-10-08, S6 추가: MC-RM-10~14 — 아래 S6 절) · v0.2(2026-10-05, S2 추가: MC-RM-07~09)
- 기준: `ui/src/rooms/test/scenarios.md` **v0.7.1** (TC-RM-015 · 030 · 031 · 024 · S6 062 · 060(b) 외) · `ui/src/rooms/design.md` **v1.8.3**(+ `design/lock.md`). S1·S2 항목(MC-RM-01~09)은 작성 당시 기준 v0.5 · v1.5 그대로 유효
- 묶음: S1(읽기 전용 판) + **S2(토큰 있음 판·새 방·전환)**. 자동화가 불가능한 항목(실제 렌더 크기·폰트·색 토큰·시각 품질·실제 토큰 체감·코드 리뷰 grep)만 둔다. S2 항목은 유효·만료 토큰이 붙은 `?t=` 주소가 필요하다(개발 서버에서 발급 방법은 `doc/handoff/` 기준).
- 환경: `/dev-start`(server 3000 + Vite 5173) 또는 `/run-app`. 브라우저 뷰포트 **390×565**. 시드 방 3개 이상(긴 제목 1개 포함).
- 스크린샷 저장: `doc/300_검증/screenshots/{YYYYMMDD-HHMM}/rooms-*.png`. 확인란에 일자·확인자·스크린샷 파일명을 적는다.

| # | 항목 | 절차 | 기대 | 관련 TC / 요구ID | 확인 |
|---|---|---|---|---|---|
| MC-RM-01 | 390×565 목록 판 | 뷰포트 390×565로 `/embed/` 열기 → 목록 스크린샷. DevTools로 상단 바·행 높이 측정 | 가로 스크롤 없음. 상단 바 44px, 행 56px, 목록이 나머지 높이(약 521px)를 채움. `100vh` 미사용(부모 100% 체인) | TC-RM-015 · R-ROOMS-005 | [ ] |
| MC-RM-02 | 긴 제목 말줄임 | 60자 제목 방을 만든 시드로 목록 보기 | 제목 한 줄 말줄임(…), 날짜가 밀려나지 않고 오른쪽에 보임 | TC-RM-015 · R-ROOMS-001 · R-ROOMS-005 | [ ] |
| MC-RM-03 | 상태 3종 시각 | ① 네트워크 Slow 3G로 로딩 ② 빈 DB로 빈 목록 ③ server 중지 후 오류 — 각각 스크린샷 | 문구가 영역 가운데, 오류에 상세 한 줄과 「다시 시도」 버튼(높이 36, 터치 영역 44 이상) | TC-RM-004 · 005 · 006 · R-ROOMS-003 | [ ] |
| MC-RM-04 | Rosebell 토큰 | 목록 스크린샷을 `ui_design_concept.md` 색·타이포와 대조. `ui/src/**/*.module.css`에서 `#`·`rgb(` 하드코딩 색 검색 | `ROOMS` serif xl uppercase accent, 행 제목 serif md, 날짜 `--font-ui` xs muted `tabular-nums`, 배경 `--color-bg`. 하드코딩 색 0건 | TC-RM-015 · R-ROOMS-005 | [ ] |
| MC-RM-05 | 포커스 링·대비·폭 변화 | Tab으로 행 이동, 대비 도구로 제목·날짜 측정, 뷰포트 520px·340px로 바꿔 보기 | `:focus-visible` 2px `--color-focus` 바깥 링. 텍스트 대비 4.5:1 이상. 폭 ≥480에서 콘텐츠 480 중앙, ≤360에서 변화 없음. 애니메이션 없음 | TC-RM-015 · TC-RM-017 · R-ROOMS-005 | [ ] |
| MC-RM-06 | 저장소·토큰 리뷰 grep | `ui/src`에서 `localStorage`·`sessionStorage` 검색, `ui/dist`에서 토큰·SECRET 문자열 검색 | `localStorage` 접근은 `ui/src/components/utils/storage.ts`뿐(테스트 파일 제외). 토큰 저장 코드 0건, 번들에 비밀값 없음 | TC-RM-010 · R-NFR-004 · R-CHAT-009(S1 비저장) | [ ] |
| MC-RM-07 | (S2) 토큰 비노출 리뷰 grep | `ui/src`(테스트 제외)에서 `localStorage`·`sessionStorage`·`document.cookie` · `?t=`·`'t='` · `console.` · `initToken`·`configureClient` 검색 | 저장소·쿠키 접근은 `storage.ts`뿐이고 토큰 값을 쓰지 않음. `initToken`·`configureClient` 호출은 `main.tsx`뿐. `?t=`를 API 경로에 붙이는 코드 0건. `console.`로 토큰 출력 0건. `ui/src/state/token.ts`가 `@/api`를 import하지 않음 | TC-RM-030 · TC-RM-028 · R-CHAT-009 · R-NFR-004 · R-API-003 | [ ] |
| MC-RM-08 | (S2) 쓰기 판 390×565 | 유효 토큰 `?t=` 주소로 `/embed/` 열기 → ① 「+ 새 방」 닫힘 ② 열림(빈 입력) ③ 61자 입력 ④ 생성 실패 토스트(server 중지로 `NETWORK`) 스크린샷. DevTools로 높이 측정 | 가로 스크롤 없음. A 44 · B 52 · 목록 469(열림)/521(닫힘) · 토스트 줄 28 이상(두 줄이면 늘어남). 「+ 새 방」 Button md primary, 입력 `--input-*`, 초과 카운터 `--color-danger` | TC-RM-031 · R-ROOMS-005 · R-ROOMS-002 | [ ] |
| MC-RM-09 | (S2) 실제 토큰 전환 체감 | 만료된 토큰 주소로 열어 새 방 만들기 시도 | 안내 토스트 1회(`인증이 만료되어 …`), 「+ 새 방」·입력 행이 사라지고 h1 포커스 링. 새로 고침 전까지 다시 나타나지 않음. 갠홈 실제 등급별 토큰 발급은 S5 handoff 뒤 재확인 | TC-RM-024 · R-CHAT-011 · R-CHAT-009 | [ ] |

### S6 방 비밀번호 잠금 (v0.3.1, 2026-10-08 — 기준 `ui/src/rooms/test/scenarios.md` **v0.7(.1)** · `ui/src/rooms/design.md` **v1.8.3** · `design/lock.md`)

- 준비: 로컬 D1에 잠긴 방 1개 이상(긴 제목 1개 포함)과 안 잠긴 방 2개. 잠긴 방 비밀번호는 확인자만 아는 시험용 값(문서·스크린샷·커밋에 적지 않는다). 토큰 있음 판은 개발용 `?t=` 주소.

| # | 항목 | 절차 | 기대 | 관련 TC / 요구ID | 확인 |
|---|---|---|---|---|---|
| MC-RM-10 | (S6) 스크린샷 3판 | 뷰포트 390×565로 ① 잠긴 방이 섞인 목록(토큰 없음) ② 토큰 있음 「+ 새 방」 2줄 열림 ③ 잠긴 행 탭 → 틀린 비밀번호 → 문구가 뜬 입장 시트를 캡처. 뷰포트 328로 ②를 다시 캡처. DevTools로 높이 측정 | ① 잠긴 행 = 자물쇠(16, 이모지 아님) + 간격 8 + 제목, 날짜 없음, 행 56. 안 잠긴 행은 날짜 그대로. 긴 제목 말줄임 폭(DevTools로 제목 요소 폭 측정): 390px 패널에서 잠긴 행 **334**·안 잠긴 행 316, 328px 패널에서 잠긴 행 **272**·안 잠긴 행 254(lock.md §1.4) ② A 44 · B 96 · 목록 425, 두 입력의 오른쪽 끝이 한 세로선, 버튼 높이 36·최소 폭 72 ③ 시트 문구 1줄 약 185px, 덮개 반투명, 가로 스크롤 없음. 328px에서 B2 placeholder 잘림 정도(어디서 잘리는지) 기록 | TC-RM-062 · R-LOCK-003 · R-LOCK-001 · R-ROOMS-005 | [ ] |
| MC-RM-11 | (S6) 실기기 비밀번호 입력 | 모바일 실기기(iOS Safari·Android Chrome 각 1)에서 토큰 없는 주소로 잠긴 행 탭 → 시트 입력에 비밀번호 입력 → 입장. 새 방 2줄 칸(토큰 있음)에도 같은 방식으로 입력 | 입력 글자가 가려져(●) 보이고 보기 토글 없음. 화상 키보드가 시트 입력·「입장」을 가리지 않음(가리면 스크롤로 닿음). 첫 글자 자동 대문자·맞춤법 밑줄 없음. 입력 Enter(키보드 「이동/완료」)로 입장 | TC-RM-052 · TC-RM-055 · R-LOCK-004 · R-LOCK-001 · L D-L6 | [ ] |
| MC-RM-12 | (S6) 브라우저 자동 채움·저장 제안 차단 | 갠홈 로그인 비밀번호를 브라우저에 저장해 둔 상태에서 ① 입장 시트 열기 ② 「+ 새 방」 비밀번호 칸 포커스 ③ 입장 성공·방 생성 뒤 브라우저 동작 관찰(Chrome·Safari·삼성 인터넷 중 2개 이상) | ①② 저장된 회원 비밀번호가 자동으로 채워지지 않음(제안 목록이 떠도 선택 전에는 빈칸). ③ "비밀번호를 저장할까요?" 제안이 뜨지 않거나, 뜨더라도 갠홈 로그인 항목을 덮어쓰지 않음 — 브라우저별 결과를 기록 | TC-RM-052 · TC-RM-061 · R-LOCK-007 · L D-L6 | [ ] |
| MC-RM-13 | (S6) 브라우저 재시작 뒤 기억 | 잠긴 방에 비밀번호로 입장 → 탭·브라우저를 완전히 닫음 → 같은 브라우저로 다시 열기 → 같은 잠긴 행 탭. 이어서 사생활(시크릿) 창에서 같은 절차 | 일반 창: 비밀번호를 다시 묻지 않고 바로 대화(`ld:roomKeys` 유지). 시크릿 창: 창을 닫았다 열면 다시 묻는다(저장소 비움) — 같은 창 안에서는 다시 묻지 않음. DevTools Application 탭에서 `ld:roomKeys`에 비밀번호 원문·토큰이 없음(증명 문자열만) | TC-RM-063 · TC-RM-059 · R-LOCK-004 · R-LOCK-007 | [ ] |
| MC-RM-14 | (S6) 리뷰 grep | `ui/src`(테스트 제외)에서 `localStorage`·`sessionStorage` · `configureClient` · `console.` 검색, `ui/src/main.tsx` 읽기 | 저장소 접근은 `components/utils/storage.ts`뿐. `configureClient` 호출은 `main.tsx` 1곳이고 순서 `import global.css` → `initToken(window.location.search)` → `configureClient({ getToken, getRoomKey })` → render. 비밀번호·증명 값을 `console.`로 찍는 코드 0건. `ui/src/state/roomKeys.ts`가 토큰·비밀번호를 받지 않음 | TC-RM-060(b) · R-LOCK-007 · R-LOCK-006 · R-CHAT-010 | [ ] |

## 이월(S2 범위 밖)

| 항목 | 이월 묶음 | 이유 |
|---|---|---|
| 실제 갠홈 패널 안 iframe 표시·높이 맞춤·`frame-ancestors` 차단 | S5(handoff) | 갠홈 PHP 조각·배포 주소가 S5 |
| 갠홈 실제 등급별 토큰 발급(등급 미달·만료 토큰으로 전환 재확인) | S5(handoff) | 토큰 PHP 조각 전달이 S5. S2는 개발용 토큰으로 MC-RM-09 |
| 모바일 실기기 폭 확인 | S5 이후 | 실제 패널 배치 확정 후 |
| ~~토큰 있음 판(「+ 새 방」·입력 행) 스크린샷~~ | ~~S2~~ | **해소**: MC-RM-08(v0.2) |
