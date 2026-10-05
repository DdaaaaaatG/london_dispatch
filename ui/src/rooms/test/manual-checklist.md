# rooms(방 목록) 수동 확인표

- 기준: `ui/src/rooms/test/scenarios.md` v0.1 (TC-RM-015 외) · `ui/src/rooms/design.md` v1.2
- 묶음: S1(읽기 전용 판). 자동화가 불가능한 항목(실제 렌더 크기·폰트·색 토큰·시각 품질·코드 리뷰 grep)만 둔다.
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

## 이월(S1 범위 밖)

| 항목 | 이월 묶음 | 이유 |
|---|---|---|
| 실제 갠홈 패널 안 iframe 표시·높이 맞춤·`frame-ancestors` 차단 | S5(handoff) | 갠홈 PHP 조각·배포 주소가 S5 |
| 토큰 있음 판(「+ 새 방」·입력 행) 스크린샷 | S2 | 토큰 읽기가 S2 |
| 모바일 실기기 폭 확인 | S5 이후 | 실제 패널 배치 확정 후 |
