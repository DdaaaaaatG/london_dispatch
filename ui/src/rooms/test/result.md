# 테스트 결과 — rooms(방 목록) / 2026-10-05 22:13~22:20
실행: vitest `npx vitest run --project ui --reporter=verbose`(ui 12파일 140 테스트 통과), 전체 `npx vitest run`(22파일 240 통과) · 스크린샷 기존 2장(puppeteer MCP, 재촬영 없음) · 토큰 미사용
환경: Node v24.18.0 · wrangler dev 3000(로컬 D1 시드 방 3·메시지 72)
정적 검사: `npm run typecheck` exit 0 · `npm run lint` exit 0 · `npx prettier --check "ui/src/**/*.{ts,tsx,css}"` All matched files use Prettier code style
콘솔 오류: vitest 출력에 FAIL 0
판정: 통과 (자동 TC-RM-001~014·016·017 = 15건 PASS / FAIL 0 / 미확인 0, 수동 TC-RM-015 = 부분 확인·잔여 SKIP)

- 자동 TC: vitest 출력에서 TC-RM 15개 ID(001~014, 016, 017) 전부 ✓. 시나리오 17건 중 TC-RM-015(수동)만 vitest에 없음 — 의도된 수동 TC.
- 증거: ui/src/rooms/test/{App,RoomsScreen}.test.tsx, formatDate.test.ts 의 ✓ 줄(it 제목에 TC ID).

## 수동 항목
| 항목 | 판정 | 근거 |
|---|---|---|
| TC-RM-015 / MC-RM-01 390×565 목록 | 부분 확인 | doc/300_검증/screenshots/20261005-2207/s1-rooms-readonly-390x565.png, README: 목록·「+ 새 방」 미렌더 확인. 상단 바 44px·행 56px 실측은 README에 없음 → 미확인 |
| MC-RM-02 긴 제목 말줄임 | 미확인 | 60자 제목 시드 없음(방 3개: 안개 낀 런던의 아침 등) |
| MC-RM-03 상태 3종 | 미확인 | 로딩·빈·오류 캡처 없음(자동 TC-RM-004~006은 PASS) |
| MC-RM-04 토큰 | 부분 | module.css 하드코딩 색(#·rgb) grep 0건. 타이포 대조는 미확인 |
| MC-RM-05 포커스·대비·폭 | 미확인 | 캡처 없음 |
| MC-RM-06 저장소 grep | PASS | localStorage 접근 소스는 ui/src/components/utils/storage.ts뿐(테스트 제외). 번들 SECRET 검색은 미실시 |

수동 SKIP 항목은 manual-checklist.md로 인계.

## 요구ID 커버
R-ROOMS-001~005 모두 자동 TC 1건 이상 PASS. R-ROOMS-005(레이아웃)는 수동 부분 확인.

---

# S2 결과 — rooms(방 목록, 토큰+쓰기) / 2026-10-06 00:47~00:55
실행: `npx vitest run --project ui --reporter=verbose`(ui 29파일 315 통과), 전체 `npx vitest run`(42파일 488 통과) · 스크린샷 기존 1장(`doc/300_검증/screenshots/20261006-0046/s2-rooms-writer-390x565.png`, puppeteer MCP, 재촬영 없음) · 토큰 테스트 토큰(원문 미기록)
환경: Node v24.18.0 · wrangler dev 3000
정적 검사: `npm run typecheck` exit 0 · `npm run lint` exit 0 · `npx prettier --check .` exit 1(`server/tsconfig.json`·`ui/tsconfig.json` 2건 경고, 소스 아님·S1 점검 범위 밖. 별도 정리 권고)
콘솔 오류: vitest 출력에 FAIL 0
판정: 통과 (자동 TC-RM-018~029·032 = 13건 PASS / FAIL 0, 수동 TC-RM-030 PASS, TC-RM-031 부분 확인·잔여 SKIP)

| TC | 판정 | 증거 |
|---|---|---|
| TC-RM-018~029 · 032 | PASS | verbose 출력의 해당 ID ✓ 줄(it 제목에 TC ID). 등록 TC 수 = 시나리오 자동 TC 수 |
| TC-RM-030 (토큰 비노출) | PASS | grep: localStorage 접근 = `components/utils/storage.ts`뿐, `state/token.ts`는 모듈 변수만 · `initToken`/`configureClient` 호출 = `main.tsx`뿐 · 화면 소스 `console.` 0건 · `Authorization` 헤더 구성 = `api/client.ts` 1곳 |
| TC-RM-031 / MC-RM-08 | 부분 확인 | s2-rooms-writer 캡처(Read로 확인): 390폭 가로 스크롤 없음, 「+ 새 방」 우상단 렌더, 목록 3행. 열림/닫힘 높이·토스트·카운터 danger 색 캡처 없음 → 미확인 |
| MC-RM-07 | PASS | TC-RM-030과 같은 grep |
| MC-RM-09 | 미확인 | 캡처 없음. manual-checklist 인계 |

요구ID 커버: R-ROOMS-002 자동+캡처 · R-CHAT-009·R-NFR-004·R-API-003 자동+grep. R-ROOMS-005 쓰기판 레이아웃은 부분.

## S3b 갱신 (2026-10-06 16:01)
- TC-RM-029: PASS — `writeRules.test.ts` 해당 ID 11건 ✓. `toastToneOf(LLM_BUDGET_EXCEEDED)=warning`, `LLM_FAILED`·`SPEAK_IN_PROGRESS`=danger 행 포함. ui 전체 34파일 462 통과 / 실패 0, 루트 53파일 763 통과 / 실패 0.

## S3c 절 — ⚙ · 주인 판정 (2026-10-06 20:40)
실행: npx vitest run --project ui ui/src/settings ui/src/rooms/test/OwnerGate.test.tsx → exit 0, 126/126 통과. ui 전체 592/592 통과, tsc --noEmit exit 0.
- TC-RM-033~039: 자동 PASS(OwnerGate 스펙 ✓).
- TC-RM-040(수동, 주인 스크린샷): 부분 PASS. doc/300_검증/screenshots/20261006-2033/rooms-owner.png에서 ⚙ 실측 44x44, 상단 바에서 ⚙ 다음 「+ 새 방」 한 줄, scrollWidth 390=clientWidth(가로 스크롤 없음). 폭 328 캡처와 간격 --space-2 실측은 미실행.
- 비주인: doc/300_검증/screenshots/20261006-2033/rooms-nonowner.png, 읽기 전용(토큰 없음): doc/300_검증/screenshots/20261006-2033/rooms-readonly.png. 두 화면 모두 ⚙ 없음(DOM 질의 null), 가로 스크롤 없음.
- FAIL 없음.

## 2026-10-08 시각 보강(CR-002/CR-004)
실행: tsc --noEmit -p ui exit 0 · npm run lint exit 0 · vitest run(루트 전체) 76 파일 / 1368 테스트 전부 통과(FAIL 0, 재실행 불필요) · npm run build exit 0 · 헤드리스 Chrome 390x565@2x 캡처 4장 · 토큰 사용(값 비기록)
캡처: doc/300_검증/screenshots/20261008-estate/{rooms-reader,rooms-writer,settings-common,chat-writer}.png
- rooms 읽기 전용: PASS — 상단 바 머리띠 + 제목 위 라벨 THE PHANTOMHIVE ESTATE, 가로 스크롤 없음(scrollWidth 390=clientWidth).
- rooms 쓰기: PASS — 버튼 투명 + 1px 직각 선(+ 새 방), 보라·초록 없음.
- §8 ④ 접근성: PASS — CDP AX 트리 heading 이름이 'ROOMS'뿐(라벨 미포함, document.innerText에도 라벨 없음 = 장식 의사요소).

# S6 방 비밀번호 잠금 — 테스트 결과 / 2026-10-09 00:00~
실행: vitest ui 937/937 · server 515/515 · shared 149/149 · tsc ui/server/shared exit 0 · eslint ui/src server/src exit 0 · npm run build exit 0 · 스크린샷 Chrome 헤드리스+CDP(390x565) · 토큰 주인 테스트 토큰 사용(값 미기록)
캡처: doc/300_검증/screenshots/20261009-0000-s6/
판정: 통과(자동) / 수동 TC-RM-062·MC-RM-10 부분 확인(아래)
- TC-RM-062 / MC-RM-10 ① 목록 자물쇠 행(rooms-reader-locked-row.png): PASS(자물쇠+제목, 날짜 없음 육안)
- MC-RM-10 ② 새 방 2줄(rooms-newroom-2line.png): PASS(제목 0/60 + 취소, 비밀번호 0/32 + 만들기, 오른쪽 끝 정렬 육안)
- MC-RM-10 ③ 입장 시트·틀림 문구(rooms-entry-sheet.png · rooms-entry-wrong.png): PASS('비밀번호가 맞지 않습니다.' 표시). 맞는 비밀번호 -> chat 입장(rooms-entry-ok-chat.png): PASS
- 미실행: 328px 폭 B2 placeholder 잘림 측정, B 96/목록 425 실측, MC-RM-11~14(실기기·자동채움·재시작·리뷰 grep)
- 참고: CDP 마우스 클릭으로는 「만들기」 버튼이 POST를 안 보냄(Enter로는 201). vitest 클릭 TC는 통과 — 하네스 한계로 추정, 실브라우저 수동 확인 권장
- 참고: 서버 DB를 다른 세션(매뉴얼 작성)이 공유해 목록 방들이 바뀜
