# settings(캐릭터 설정) 수동 확인표

- 기준: `ui/src/settings/test/scenarios.md` v0.1 · design.md v1.2 · rooms design.md v1.6.1
- 작성일: 2026-10-06 · 작성: ui-test-designer · 상태: 초안 v0.1
- 대상: jsdom으로 확인할 수 없는 것(실제 다운로드·iframe sandbox·스크린리더 낭독·실제 폭·실제 갠홈 토큰)과 코드 리뷰 grep
- 결과는 `ui/src/settings/test/result.md`(ui-tester)에 적고 이 표의 확인란을 채운다. 스크린샷은 `doc/300_검증/screenshots/{YYYYMMDD-HHMM}/`

| ID | 항목 | 절차 | 기대 | 관련 TC · 요구ID | 확인 |
|---|---|---|---|---|---|
| MC-ST-01 | 리뷰 grep(토큰·저장소·로그·fetch) | `ui/src/settings/**`(test 폴더 제외)·`ui/src/state/settings.ts`·`ui/src/state/settingsFile.ts`에서 `fetch(` · `localStorage` · `sessionStorage` · `document.cookie` · `getToken` · `console.` 검색. `npm run build` 뒤 `ui/dist`에서 `LLM_API_KEY`·`TOKEN_SECRET`·`sk-` 등 비밀값 패턴 검색 | 소스 6패턴 0건. api 접근은 `@/api` 래퍼 import뿐. `ui/dist` 비밀값 실값 0건 | TC-ST-036 · R-NFR-004 · R-CHAT-009 · R-SET-012 | [ ] |
| MC-ST-02 | 390×565 화면 캡처 | 개발 서버, 주인 토큰 `?t=` 주소로 `/embed/` → ⚙ → 설정 화면. ① 공통 세계관 ② 세바스찬(필수 빈 칸 + 말투 801자) ③ 시엘 ④ ① 시트 ⑤ ② 시트 ⑥ ③ 시트(오류 줄 있음) ⑦ ④ 확인 ⑧ stale(저장 중 server를 끄지 말고 만료 토큰으로 저장) ⑨ loading(네트워크 느리게) ⑩ error(server 중지) ⑪ 저장 성공 토스트. DevTools로 높이 측정 | 가로 스크롤 없음. A 44 · B 40 · D 36 · (stale) F 40 · 토스트 28. 나이·성별 같은 줄. 필수 `*`·탭 `!`·카운터 초과 `--color-danger`. 저장 성공 토스트 왼쪽 막대 `--color-success`. 시트 높이 약 188 · 280 · 324/360 · 148px. 하단 줄 문구 한 줄 말줄임 | TC-ST-037 · R-SET-009 · R-ROOMS-005 | [ ] |
| MC-ST-03 | 실제 iframe 파일 저장(S5 이후) | 갠홈 패널 안 iframe(실제 `sandbox` 속성)에서 ② 「파일로 저장」. 막히면 텍스트 영역을 길게 눌러 전체 선택·복사해 메모장에 붙여 넣는다 | 파일 `london-dispatch-characters-YYYYMMDD-HHmm.json`이 내려받아진다. 막혀도 복사한 글이 같은 JSON이고 `apiKey`·`version`·`updatedAt` 키가 없다 | TC-ST-038 · R-SET-007 · L-ST-2 | [ ] |
| MC-ST-04 | 스크린리더 낭독 | Windows 내레이터(또는 NVDA)로 설정 화면을 연다. 탭 이동, 말투 801자 입력, 저장 성공, 저장 중 인증 만료, ③ 거부 | 진입 시 `캐릭터 설정` 제목. 탭 `세바스찬, 확인할 항목 있음`. 하단 줄 `저장 중...`·`v4 저장됨 …`·`인증 만료`가 polite로 읽힘. 토스트·stale 안내·③ 오류 줄은 즉시 읽힘(alert). 입력마다 alert가 나지 않음 | TC-ST-030 · TC-ST-016 · TC-ST-026 · R-SET-009 | [ ] |
| MC-ST-05 | rooms 주인 판 캡처 | 주인 토큰 주소로 방 목록을 390×565, 그리고 328px 폭으로 캡처 | 상단 바 오른쪽 ⚙ → 「+ 새 방」 순서, 간격 `--space-2`, ⚙ 44×44, 한 줄 유지, 가로 스크롤 없음 | TC-RM-040 · R-SET-009 · R-ROOMS-005 | [ ] |
| MC-ST-06 | 실제 갠홈 토큰 판정(S5 이후) | 갠홈 주인 계정·주인 아닌 등급 회원·비회원으로 각각 iframe을 연다 | 주인만 ⚙ 보임. 등급 회원은 ⚙ 없음·「+ 새 방」 있음·안내 토스트 없음. 비회원은 둘 다 없음 | TC-RM-033 · TC-RM-034 · TC-RM-035 · R-SET-010 | [ ] |
