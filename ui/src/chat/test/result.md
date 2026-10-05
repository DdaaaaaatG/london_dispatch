# 테스트 결과 — chat(대화) / 2026-10-05 22:13~22:20
실행: vitest `npx vitest run --project ui --reporter=verbose`(ui 12파일 140 테스트 통과), 전체 `npx vitest run`(22파일 240 통과) · 스크린샷 기존 2장(puppeteer MCP, 재촬영 없음) · 토큰 미사용
환경: Node v24.18.0 · wrangler dev 3000(로컬 D1 시드 방 3·메시지 72)
정적 검사: `npm run typecheck` exit 0 · `npm run lint` exit 0 · `npx prettier --check "ui/src/**/*.{ts,tsx,css}"` All matched files use Prettier code style
콘솔 오류: vitest 출력에 FAIL 0
판정: 통과 (자동 TC-CH-001~027·029·030 = 29건 PASS / FAIL 0 / 미확인 0, 수동 TC-CH-028 = 부분 확인·잔여 SKIP)

- 자동 TC: vitest 출력에서 TC-CH 29개 ID 전부 ✓. 시나리오 30건 중 TC-CH-028(수동)만 vitest에 없음 — 의도된 수동 TC.
- 증거: ui/src/chat/test/{Bubble,ChatScreen,ChatScroll,MessageList,useAutoScroll}.test.tsx 의 ✓ 줄.

## 수동 항목
| 항목 | 판정 | 근거 |
|---|---|---|
| TC-CH-028 / MC-CH-02 화자 구분 | PASS(육안) | s1-chat-readonly-390x565.png(Read로 확인): 캐릭터 왼쪽 아바타+이름·시각, 시엘 파랑/세바스찬 적색 구분, 유저 오른쪽 작성자명, OOC 중앙 `— [지시] … —`, 하단 "열람 전용" 안내, 상단 ‹ 제목 날짜 |
| MC-CH-01 영역 높이 | 미확인 | 44/28px 실측 기록 없음. 캡처상 맨 아래(최신 70)부터 보임, 가로 스크롤 없음 |
| MC-CH-03 긴 본문 줄바꿈 | 미확인 | 긴 단어 시드 없음 |
| MC-CH-04 이전 페이지 | 부분 PASS | README: 맨 위 스크롤 시 60건, scrollTop 1847 보존. 체감 문구 표시는 미확인 |
| MC-CH-05 다시 열기 복원 | 부분 PASS | README: 뒤로 시 ld:lastRoomId 삭제·ld:scroll 유지 |
| MC-CH-06 폭 변화 | 미확인 | 340·520px 캡처 없음 |
| MC-CH-07 토큰·포커스·대비·모션 | 미확인 | 하드코딩 색 grep 0건만 확인 |
| MC-CH-08 상태 시각 | 미확인 | 로딩·빈·오류 캡처 없음(자동 TC PASS) |
| MC-CH-09 리뷰 grep | PASS | dangerouslySetInnerHTML 코드 사용 0건(Bubble.tsx 4행 주석에만 언급), localStorage는 storage.ts뿐, 화면 코드 fetch 직접 사용은 이번에 별도 grep 안 함 → 미확인 |

## API 실물(curl, 토큰 없음)
- GET /api/health → {"ok":true,"version":"0.1.0"}
- GET /api/rooms → 방 3개(메시지 70·2·0)
- GET /api/rooms/{첫 방}/messages → 30건, hasMore=true, 첫 id 41
- ?before=41 → 30건(id 11~40), hasMore=true
- GET /embed → 200, Content-Security-Policy: frame-ancestors http://london-gossip.my https://london-gossip.my
- GET /nope → 404 {"error":{"code":"NOT_FOUND","message":"요청한 주소를 찾을 수 없습니다."}}

## 요구ID 커버
R-CHAT-001~013 자동 TC 1건 이상 PASS(R-CHAT-010 스크롤 저장 TC-CH-025·026 포함). R-CHAT-013 레이아웃은 수동 부분 확인.

---

# S2 결과 — chat(대화, 토큰+쓰기, CR-001) / 2026-10-06 00:47~00:55
실행: `npx vitest run --project ui --reporter=verbose`(ui 29파일 315 통과), 전체 `npx vitest run`(42파일 488 통과) · 스크린샷 기존 1장(`doc/300_검증/screenshots/20261006-0046/s2-chat-writer-390x565.png`, puppeteer MCP) · 토큰 테스트 토큰(원문 미기록)
환경: Node v24.18.0 · wrangler dev 3000
정적 검사: typecheck exit 0 · lint exit 0 · prettier `.` exit 1(tsconfig.json 2건, 소스 아님)
콘솔 오류: FAIL 0
판정: 통과 (자동 TC-CH-001~027·029~060·063~065 = 62건 PASS / FAIL 0, 수동 TC-CH-028 PASS(육안), TC-CH-061 부분·잔여 SKIP, TC-CH-062 PASS)

| TC | 판정 | 증거 |
|---|---|---|
| TC-CH-007~010 (CR-001 배치) | PASS | Bubble.test ✓ 줄 4건 |
| TC-CH-031~060 · 063~065 | PASS | verbose ✓ 줄, 등록 수 = 시나리오 자동 수 |
| TC-CH-028 / MC-CH-02 | PASS(육안) | s2-chat-writer 캡처: 세바스찬 왼쪽(아바타·이름 좌), 시엘 오른쪽(이름 우측), 유저 발화 가운데 말풍선+작성자명, OOC 가운데 `— [지시] … —` 한 줄. 가로 스크롤 없음 |
| TC-CH-061 / MC-CH-10~13 | 부분 확인 | 캡처로 하단 바(OOC 토글·입력창·전송)·390폭 확인. 메뉴 시트·인라인 편집·3줄 입력 높이 캡처 없음 → 미확인 |
| TC-CH-062 / MC-CH-14 | PASS | rooms TC-RM-030과 같은 grep + `dangerouslySetInnerHTML` 코드 사용 0건(주석만) |
| MC-CH-15 | 미확인 | 확인 근거 캡처 없음. manual-checklist 인계 |

## API 실물(curl, 토큰 원문 미기록)
| 호출 | 기대 | 실측 |
|---|---|---|
| POST /api/rooms (토큰) | 201 | 201, 방 생성 |
| POST /api/rooms/:id/user (토큰 없음) | 401 | 401 |
| 같은 호출, 위조 토큰 | 401 | 401 |
| PATCH /api/messages/999999 (본문 `{"text":"x"}`) | 404 | 404 NOT_FOUND |
| 위 호출 본문 `{"content":"x"}` | — | 400 VALIDATION_ERROR (필드명은 text. 계약 기준 정상) |
| DELETE /api/rooms/:id | 204 | 204, 이후 GET 404. 테스트 데이터 원복 |

요구ID 커버: R-CHAT-002(CR-001 포함)·004·008·009·011 자동 TC PASS. R-CHAT-013 쓰기판 레이아웃은 부분.

## CR-001 검증
Bubble.test TC-CH-007~010 PASS + 캡처 육안 일치 → 「검증됨」.
