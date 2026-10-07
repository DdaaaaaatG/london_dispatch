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

---

# S3 결과 — chat(AI 발화: 캐릭터 버튼·임시/실패 말풍선·재작성) / 2026-10-06 13:17~13:25
실행: `npx tsc --noEmit -p ui`(exit 0) · `npx vitest run --project ui --reporter=verbose`(34파일 452 통과 / 실패 0) · 루트 `npx vitest run`(52파일 709 통과 / 실패 0) · 스크린샷 7장(Chrome 헤드리스 CDP 스크립트, 390×565) · 토큰 테스트 토큰(level 10, 값 미기록)
환경: wrangler dev 3000(로컬 D1, `LLM_PROVIDER=fake`) · Vite 5173(`/embed/`) · 기존 서버 재사용(재기동 없음). 캡처용 `rooms.speaking_until` 선점 후 NULL로 원복(unlock 로그 확인)
판정: 통과 (자동 TC-CH-066~091·093~095 = 29건 PASS / FAIL 0, 수동 TC-CH-092 = 부분 PASS·잔여 SKIP)

## 자동 TC (vitest verbose 출력에서 TC ID별 ✓ 집계, ✗ 0)
| TC | 판정 | 테스트 수 | 스펙 파일 |
|---|---|---|---|
| 066 버튼 렌더 | PASS | 3 | Composer · SpeakButtons · SpeakFlow |
| 067 토큰 없음 부재 | PASS | 1 | SpeakFlow |
| 068 speak 인자 | PASS | 2 | SpeakFlow |
| 069 생성 중 임시 말풍선 | PASS | 8 | PendingBubble · SpeakFlow |
| 070 생성 중 잠금 | PASS | 1 | SpeakFlow |
| 071 성공 교체 | PASS | 1 | SpeakFlow |
| 072 자동 스크롤·배지 | PASS | 2 | SpeakFlow |
| 073 실패→재시도 | PASS | 3 | PendingBubble · SpeakFlow |
| 074 코드별 문구 | PASS | 6 | PendingBubble · SpeakFlow |
| 075 실패 말풍선 유지·소멸 | PASS | 3 | SpeakFlow |
| 076 인증 실패 전환 | PASS | 4 | SpeakFlow |
| 077 방 사라짐 | PASS | 1 | SpeakFlow |
| 078 빈 방 첫 speak | PASS | 1 | SpeakFlow |
| 079 재작성 표시 조건 | PASS | 9 | BubbleMenu · Regenerate |
| 080 재작성 실행·성공 | PASS | 1 | Regenerate |
| 081 재작성 실패 | PASS | 6 | Regenerate |
| 082 NOT_LAST_MESSAGE | PASS | 2 | Regenerate |
| 083 대상 사라짐 | PASS | 3 | Regenerate |
| 084 재작성 인증 실패 | PASS | 3 | Regenerate |
| 085 리듀서 S3 | PASS | 16 | state/chat.test.ts |
| 086 문구 함수 | PASS | 27 | PendingBubble · Regenerate |
| 087 늦은 응답 무시 | PASS | 9 | Regenerate · SpeakFlow |
| 088 전송은 AI 호출 없음 | PASS | 3 | Composer |
| 089 포커스 복귀 | PASS | 5 | SpeakButtons · SpeakFlow |
| 090 재시도 잠금 | PASS | 2 | PendingBubble · SpeakFlow |
| 091 useAutoScroll tailKey | PASS | 5 | useAutoScrollTail |
| 093 재시도 뒤 포커스 | PASS | 3 | SpeakButtons · SpeakFlow |
| 094 편집 중 생성 잠금 | PASS | 1 | SpeakFlow |
| 095 다른 쓰기 대기 중 잠금 | PASS | 3 | Regenerate |

- 시나리오 TC-CH-066~095 30건 중 092(수동)만 vitest에 없음 — 의도된 수동 TC. 나머지 29건은 스펙에 등록되어 전부 실행됨.
- 출력의 "FAIL" 문자열 6줄은 모두 테스트 이름에 든 `LLM_FAILED`이며 ✓ 줄이다. 콘솔 경고(stderr·act 경고) 0건.

## 캡처 (`doc/300_검증/screenshots/20261006-1318/`, 각 PNG를 Read로 열어 실제 화면 확인)
| 파일 | 확인 결과 |
|---|---|
| s3-chat-writer.png | 하단 1행 왼쪽 「세바스찬」「시엘」, 오른쪽 「OOC 끔」, 아래 입력·전송. 가로 스크롤 없음(scrollWidth 390) |
| s3-chat-pending-attempt.png | 「시엘」 클릭 직후: 오른쪽 시엘 임시 말풍선 "…"(시각 없음), 두 캐릭터 버튼·전송·방 메뉴 disabled. 시엘 오른쪽 거울 배치 |
| s3-chat-after-speak.png | 시엘 오른쪽에 "(가짜 응답) 잠시 생각에 잠긴다." 말풍선 + 시각, 버튼 복귀 |
| s3-chat-failed.png | 세바스찬 쪽 실패 말풍선: 붉은 테두리, `!`, "이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요.", 「재시도」 |
| s3-chat-retry-ok.png | 잠금 해제 후 「재시도」: 같은 자리가 세바스찬 정상 말풍선으로 교체, 실패 말풍선 없음 |
| s3-chat-menu-regenerate.png | 마지막 세바스찬 말풍선 우클릭: 시트에 수정·재작성·삭제(붉은색)·취소 |
| s3-chat-readonly.png | 토큰 없음: 캐릭터 버튼·⋯·입력 없음, 하단 "열람 전용 - 대화 참여는 등급 회원만" |
- 보조 DOM 실측: 쓰기판 버튼 레이블 `세바스찬 대사 생성`·`시엘 대사 생성`, 생성 중 상태 문구 `시엘 대사를 만드는 중`, 실패 시 `세바스찬 대사 재시도`, 읽기 전용은 버튼 1개(뒤로가기)·말풍선 메뉴 0.
- 캡처 스크립트: 스크래치패드 `shoot-s3.mjs`(소스 아님).

## 수동 항목
| 항목 | 판정 | 근거 |
|---|---|---|
| TC-CH-092 / MC-CH-16 ① 하단 1행 | PASS(캡처) | s3-chat-writer.png, 가로 스크롤 없음 |
| MC-CH-16 ② ③ 임시 말풍선 | PASS(캡처, 시엘만) | 시엘 오른쪽 거울 배치, 시각 없음 `…`. 세바스찬 임시는 별도 캡처 없음(왼쪽 배치는 자동 TC-CH-069 클래스 단언). 배경색 토큰 일치는 육안상 같은 캐릭터 말풍선과 같은 톤이나 computed style 미측정 |
| MC-CH-16 ④ 실패 말풍선 | PASS(캡처) | 붉은 테두리·`!`·재시도 확인. 토큰 변수명 일치는 computed style 미측정 |
| MC-CH-16 ⑤ 재작성 중 흐림 0.55 | SKIP | 가짜 제공자가 즉시 응답해 캡처 못 함 → 수동 확인 필요 |
| MC-CH-16 ⑥ 메뉴 | 부분 PASS | 항목 수정·재작성·삭제·취소 확인. 시트 높이는 캡처상 약 247px(상단 y≈318), 기대 "약 232px"보다 약 15px 큼 — 허용 오차 여부 판단 필요(관찰) |
| MC-CH-17 스크린 리더 | 미실행(스크린리더 없음) | aria-label·status 문구만 DOM으로 확인. role=log 안 status 이중 낭독 여부는 미확인 |
| MC-CH-18 실제 생성 체감·두 탭 동시 | 미실행(실제 LLM 키·두 탭 환경 없음) | 잠금 409 안내 문구는 캡처로 확인(위 failed) |

## 요구ID 커버
R-CHAT-002·003·004·005·006·007·008·011·013(S3분)·참조 R-MSG-003·006·007 자동 TC 전부 PASS. 육안 요소(R-CHAT-002 배치, R-CHAT-004 버튼 위치, R-CHAT-013 1행)는 캡처 PASS, 재작성 중 흐림·스크린리더·실 LLM 체감은 수동 이월.

# S3b 결과 — chat(월 AI 비용 한도 LLM_BUDGET_EXCEEDED) / 2026-10-06 16:01~16:03
실행: `npx tsc --noEmit -p ui`(exit 0) · `npx vitest run --project ui`(34파일 462 통과 / 실패 0) · `npx vitest run --project ui -t "TC-CH-096|TC-CH-097|TC-RM-029"`(3파일 19 통과 / 실패 0) · 루트 `npx vitest run`(53파일 763 통과 / 실패 0) · 스크린샷 0장 · 토큰 미사용
판정: 통과 (자동 TC-CH-096·097 PASS 2 / FAIL 0 / SKIP 0)

| TC | 판정 | 기대 | 실측 | 증거 |
|---|---|---|---|---|
| TC-CH-096 (speak 한도 초과) | PASS | 실패 말풍선 + 한도 문구 + 「재시도」, 토스트·숫자·카운트다운 없음, 전환 없음, 60초 뒤 자동 재시도 없음, 재시도 = 같은 캐릭터 2번째 호출 | 충족. 같은 429 RATE_LIMITED(retryAfterSec 40)와 문구가 다름(code로만 구분) 별도 테스트도 통과 | SpeakFlow.test.tsx 테스트 2건 ✓ |
| TC-CH-097 (재작성 한도 초과) | PASS | 원 본문 유지·재작성 표시 소멸, warning 토스트, 재조회·전환·자동 재시도 없음 | 충족 | Regenerate.test.tsx 테스트 1건 ✓ |

- 톤 판정: 통합 TC-CH-097이 warning 클래스를 검증하고, 순수 함수 `toastToneOf(LLM_BUDGET_EXCEEDED) = warning`은 writeRules.test.ts ✓.
- 캡처: 해당 없음. 이번 증분은 UI 레이아웃 변경이 없는 문구·톤 분기 추가이며 통합 TC가 DOM·클래스를 직접 검증한다.
- 콘솔 오류·경고: ui 프로젝트 출력 0건. 루트 전체 출력에는 Node MaxListenersExceededWarning(Socket 리스너 12개)이 반복되나 server 프로젝트 소음이며 FAIL 아님.

# S3d 결과 — chat(전송 → 자동 응답·중립 "…" 말풍선·「어떠한 의지」·편집 저장 잠금) / 2026-10-07 00:02~00:12
실행: `npx tsc --noEmit -p ui`(exit 0) · S3d만 `npx vitest run --project ui ui/src/chat/test/AutoReply.test.tsx ui/src/state/chat.test.ts`(exit 0, 2파일 113 통과) · 전체 `npx vitest run --project ui` 2회(둘 다 exit 1, 41파일 통과 / 1파일 실패, 659 통과 / 1 실패 / 총 660) · 스크린샷 8장(Chrome 헤드리스 CDP 스크립트, 390×565, 스크래치패드) · 토큰 tester(값 미기록)
환경: wrangler dev 3000(실제 Gemini) · Vite 5173(`/embed/`) · 기존 서버 재사용(재기동·종료 없음)
판정: 미통과(간헐 1건) — S3d 신규·개정 스펙은 전부 통과, 전체 실행에서 기존 TC-CH-078 1건 반복 실패

## 자동
| 범위 | 결과 |
|---|---|
| S3d 대상 2파일(AutoReply · state/chat) | 113/113 PASS |
| 전체 ui 1회차 | 659/660, FAIL TC-CH-078 (SpeakFlow) |
| 전체 ui 2회차 | 659/660, FAIL TC-CH-078 (SpeakFlow) — 같은 실패 재현 |
| SpeakFlow 단독 | 39/39 PASS |
| TC-RM-027 | 두 번 모두 통과(재현 안 됨) |

- 실패 줄: `SpeakFlow.test.tsx` `빈 방 첫 speak` > TC-CH-078 (`findByRole('status')` 경합 의심, 전체 실행 부하에서만 실패). 1차 분류: **스펙(추정) — 부하 시 타이밍 경합**, 화면 결함 신호 없음(단독 통과).
- TC-CH-098~108 등록 TC는 위 두 파일에서 실행됨(건수는 113에 포함). 파일별 TC 매핑 grep은 하지 않음.

## 실측(캡처·DOM, `doc/300_검증/screenshots/20261007-0004/`, 각 PNG를 Read로 확인)
| 파일 | 확인 결과 |
|---|---|
| s3d-01-pending.png · s3d-01b-pending-held.png | 전송 직후: 유저 말풍선 위에 `어떠한 의지 · 시각`, 아래 가운데 중립 "…"(테두리만). 두 캐릭터 버튼·전송 비활성. 01b는 speak 요청을 보류해 고정한 장면 |
| s3d-02-result.png | 실제 Gemini 응답이 세바스찬 자리에 표시, 중립 말풍선 소멸, 버튼 복귀 |
| s3d-03-edit-locked-pending.png | 편집기 열린 채 전송: 중립 "…" 표시. 편집기 자체는 화면 위쪽이라 이 캡처에는 안 보임(잠금은 DOM으로 확인) |
| s3d-04-fail-retry.png | 409 유도 실패: 가운데 붉은 테두리 말풍선 `! 이 방에서 이미 대사를 만들고 있습니다…` + 「재시도」 |
| s3d-07-readonly.png | 토큰 없음: 입력·캐릭터 버튼 없음, 하단 `열람 전용 - 대화 참여는 등급 회원만`, 유저 머리 `어떠한 의지` 유지 |
- 실패 유도 방식: Chrome Fetch 가로채기로 `POST .../speak`만 보류 후 409(`SPEAK_IN_PROGRESS`) 응답 주입. 서버·DB 변경 없음. speak 본문은 `{"character":"auto"}` 1회 관측.
- s3d-03·04는 같은 흐름에서 찍음. 캡처로 확인 못한 것: 편집기와 잠긴 저장 버튼의 시각(DOM만).

## DOM 실측(MC-CH-19 대응)
| 항목 | 기대 | 실측 |
|---|---|---|
| 가로 스크롤 | 없음 | scrollWidth 390 = clientWidth 390 (전 장면) |
| 중립 생성 중 높이 | 약 48px | 46.1px (전체 폭 343, 본문 상자 39 × 46.1) |
| 중립 위치 | 가운데 | 중심 x 187.5 (열 16~359의 중앙) |
| 본문 상자 | 1px 테두리·배경 없음·radius-lg | 1px solid · rgba(0,0,0,0) · radius 16px · animation none |
| 아바타·이름·시각 | 없음 | 상자 안 텍스트는 "…"와 보이지 않는 상태 문구뿐 |
| 실패 높이 | 약 90px | 99.2px (본문 상자 267.5 × 99.2, 폭 78% 이내), 「재시도」 58×28 가운데 |
| 상태 역할 | status / alert | 생성 중 `status: …응답을 만드는 중`, 실패 `alert: ! 이 방에서…` |
| 편집 중 전송 | 저장 disabled + 안내 연결 | 편집 입력 값 유지·readOnly false, 저장 disabled, `aria-describedby` 글자 `응답을 만드는 중에는 저장할 수 없습니다`, 취소 활성, 두 캐릭터 버튼 disabled |
| 실패 뒤 잠금 해제 | 저장 활성·안내 없음 | 저장 활성(disabled=false)·안내 글자 없음 |
| 실패 뒤 포커스 | (설계 확인) | `메시지 입력`에 있음 |
- 높이는 기대 "약 48 / 약 90"보다 각각 1.9px 작음 / 9.2px 큼. 「약」 허용 범위로 보나, 실패 쪽 9px는 체크리스트 수치 보정 후보로 보고한다(판정은 수동 확인 몫).

## 실제 응답 시간(서버 타임스탬프, Pro 모델)
| 전송 → 응답 | 시간 |
|---|---|
| 방 메시지 100 → 102(세바스찬) | 약 23.4초 |
| 109 → 110(시엘) | 약 21.0초 |
| 111 → 112(세바스찬) | 약 16.3초 |

## 수동 항목
| 항목 | 상태 |
|---|---|
| MC-CH-19 치수·가로 스크롤·중립 48px | DOM 질의로 확인(위 표). 구성안 그림과의 육안 대조는 미실시 → 체크박스 유지 |
| 스크린리더 읽기 | **미실행(SKIP)** |

## 비용·부작용
- 실제 Gemini 호출 3회(허용 1~2회 초과 1회): 계획한 2회 중 1회는 의도, 나머지 1회는 캡처 스크립트를 실수로 한 번 더 백그라운드 실행해 발생(메시지 111·112). 이후 반복 호출 없음.
- 저장된 테스트 메시지: 방 `아직 아무도 없는 방`(id …0003)에 유저·AI 메시지 7건 추가(시작 4건, 현재 총 11건, 삭제하지 않음). 방 `어떠한 임무` 사용 안 함.


---

# S3e 결과 — chat(말풍선 액션 버튼 「수정」「재작성」「삭제」, CR-003) / 2026-10-07 14:51~14:58
실행: `npx tsc --noEmit -p ui` · `npx vitest run --project ui` · `-t "TC-CH-11[0-9]|TC-CH-12[01]"` · `npx vitest run`(루트) · 스크린샷 6장(Chrome 헤드리스 CDP, 390×565) · 토큰 테스트 토큰 사용(값 비기록)
판정: **통과** (자동 PASS 전건 / FAIL 0 / 수동 TC-CH-121 캡처 판정 PASS · 스크린리더·실기기 SKIP)
시나리오: v0.9.1

## 자동
| 항목 | 실측 |
|---|---|
| tsc ui | exit 0 |
| vitest ui | 43파일 686 통과 · 0 실패 |
| TC-CH-110~120 필터 | 6파일 53 통과(633 skipped) · 0 실패. 110~120 11건 모두 스펙에 등록됨(BubbleActions·MessageActions·ChatScreen·Regenerate·AutoReply·SpeakFlow·AuthTransition) |
| vitest 루트 | 67파일 1169 통과 · 0 실패(MaxListenersExceededWarning만 — 서버 풀 소켓 경고, 실패 아님) |

## 캡처(`doc/300_검증/screenshots/20261007-1453/`, 각 PNG를 Read로 확인)
| 파일 | 판정 | 실측 |
|---|---|---|
| s3e-actions-writer.png | PASS | 모든 말풍선 아래 「수정 삭제」, 마지막 시엘 대사만 「수정 재작성 삭제」 한 줄. 삭제 글자 danger(rgb 217,123,115), 수정·재작성 muted(159,178,201). sw=cw=390 가로 스크롤 없음 |
| s3e-actions-edit.png | PASS | 수정 클릭 → 편집기(취소·저장), 그 말풍선 버튼 줄 사라짐, 나머지 버튼 줄 흐림(disabled) |
| s3e-actions-delete-confirm.png | PASS | 확인 시트 "이 메시지를 삭제할까요?", 취소·삭제(danger 배경), 뒤 덮개 |
| s3e-actions-regenerating.png | PASS | 재작성 직후 잡힘: 상태 "다시 쓰는 중…", 모든 버튼 disabled·흐림 |
| s3e-actions-regen-result.png | PASS(참고) | 재작성 완료 후 장면 |
| s3e-actions-readonly.png | PASS | 토큰 없음: 버튼 줄 없음(role=group 0개), 하단 "열람 전용" |

## DOM 실측(MC-CH-20 ①②③⑤ 대응)
- 버튼 줄 높이 28px · 위 여백 4px(`--space-1`) · 버튼 28px
- 세바스찬 첫 버튼 x=52(= 16+아바타 28+8, 본문 시작선) · 시엘 마지막 버튼 right=338(= 374-28-8, 본문 끝선) · 어떠한 의지(OOC) 줄 147~243 중심 195(= 390/2) 가운데
- 대비: muted·danger는 어두운 배경 위 밝은 색이라 4.5:1 이상으로 판단하나 대비 수치 계산은 하지 않음(추정)

## 수동 항목
- TC-CH-121 / MC-CH-20 ①~③⑤: 캡처·DOM으로 PASS. ④(세바스찬 클릭 직후 임시 말풍선 비활성)는 재작성 중 장면으로 대체 확인. 터치 영역 44px · 실기기 탭: SKIP(실기기 필요) → 확인표 유지
- MC-CH-17: SKIP(스크린리더·실기기 포커스 필요) → 확인표 유지

## 환경·부작용
- wrangler :3000·Vite :5173 기존 서버 재사용(종료하지 않음). 가짜 제공사로 방 000…003에 메시지 몇 건 증가(재작성 1회 포함)
- 콘솔 오류 확인 못 함(캡처 스크립트는 콘솔 수집 안 함). vitest 출력에는 오류 없음
