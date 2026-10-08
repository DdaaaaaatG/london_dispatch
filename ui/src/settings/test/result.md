# 테스트 결과 — settings(캐릭터 설정) / 2026-10-06 20:32~20:40
실행: vitest ui 전체 + S3c 한정 · 스크린샷 10장(Chrome 헤드리스 CDP, 390x565) · 토큰: 주인(owner01)·비주인(tester)·없음 사용(토큰 값 미기록)
환경: Node v24 · wrangler dev 3000(fake LLM) · Vite 5173, 재시작 없음 · 설정 저장 0회(미저장 초안만 만들고 나가기 확인 화면에서 멈춤)
판정: 자동 통과 / 수동 일부 대기

| 명령 | exit | 결과 |
|---|---|---|
| npx tsc --noEmit -p ui | 0 | 오류 0 |
| npx vitest run --project ui | 0 | 41파일 592/592 통과 |
| npx vitest run --project ui ui/src/settings ui/src/rooms/test/OwnerGate.test.tsx | 0 | 6파일 126/126 통과 |

## 자동 TC
- TC-ST-001~041 중 수동 036·037·038을 뺀 38건과 TC-RM-033~039가 스펙에 등록돼 있고 FAIL 0. TC-FLOW-ST-01~12는 구성 TC의 자동 스펙으로 덮임(흐름 단위 별도 스펙 없음).
- 증거: 위 verbose 출력의 통과 줄. 알려진 stderr는 vi.fn 사용 경고 1건(TC-ST-033 download 단위, 판정 무관).

## 수동·캡처
| TC | 판정 | 근거 |
|---|---|---|
| TC-ST-037 / MC-ST-02 | 부분 PASS | 캡처 doc/300_검증/screenshots/20261006-2033/settings-world·sebastian·filemenu·export·import·dirty·leave-confirm.png. 가로 스크롤 없음(scrollWidth 390). 공통·세바스찬 탭, 나이·성별 같은 줄, 필수 * 표시, 카운터 확인. 시트 높이 실측은 아래 관찰. stale·loading·error 캡처는 미실행 |
| TC-ST-036 / MC-ST-01 | 미실행 | 리뷰 grep 미수행 |
| TC-ST-038 / MC-ST-03 | 미실행(수동 대기) | 실제 iframe sandbox 파일 저장 |
| MC-ST-04 스크린리더 | 미실행(수동 대기) | |
| 미저장 이탈 confirm | PASS(육안) | doc/300_검증/screenshots/20261006-2033/settings-leave-confirm.png: "저장하지 않은 변경이 있습니다 / 나갈까요?" 취소·나가기 |

캡처 폴더: doc/300_검증/screenshots/20261006-2033 (git 제외)

## 관찰
- 내보내기 시트 높이 268px(설계 약 280), 가져오기 시트 약 262px(설계 약 324/360). 설계 대비 낮음, 기능 문제 없음. 설계 차이 판정은 ui-designer 몫.
- 설정 화면 body scrollHeight 568 vs 뷰포트 565, 3px 차이. 가로 스크롤은 없고 세로 3px 초과 여부 육안 확인 필요(수동).
- 실패 1차 분류 대상 FAIL: 없음.

---

# S3f 절 — AI 모델 Pro/Flash 선택 (CR-001) / 2026-10-08 12:04~12:08
실행: vitest ui 전체 + settings 폴더 · 스크린샷 0장(TC-ST-053은 메인 세션 수행 예정) · 토큰: 테스트 내부 mock
판정: 자동 통과 / 수동 보류 (scenarios v0.2 기준)

| 명령 | exit | 결과 |
|---|---|---|
| npx vitest run --project ui | 0 | 47파일 784/784 통과 (rooms·chat 무수정 통과) |
| npx vitest run --project ui ui/src/settings | 0 | 7파일 149/149 통과 |
| npx tsc --noEmit -p ui | 0 | 오류 0 |

| TC | 판정 | 증거(verbose 통과 줄) |
|---|---|---|
| TC-ST-003 | PASS | SettingsScreen.test.tsx, 선택 탭 「공통」 |
| TC-ST-005 | PASS | SettingsScreen.test.tsx, 탭 키보드 |
| TC-ST-007 | PASS | SettingsScreen·SettingsSave, 둘째 인자 undefined |
| TC-ST-009 | PASS | SettingsScreen.test.tsx |
| TC-ST-011 | PASS | SettingsSave.test.tsx |
| TC-ST-030 | PASS | SettingsScreen.test.tsx, 라디오 정지 1회 |
| TC-ST-031 | PASS | SettingsScreen.test.tsx |
| TC-ST-042 | PASS | ModelChoice.test.tsx 4건(pro·flash·null·타 탭 없음) |
| TC-ST-043 | PASS | ModelChoice.test.tsx |
| TC-ST-044 | PASS | ModelChoice.test.tsx (a)~(d) |
| TC-ST-045 | PASS | ModelChoice.test.tsx (a)(b)(c) |
| TC-ST-046 | PASS | ModelChoice.test.tsx (a)(b) |
| TC-ST-047 | PASS | ModelChoice.test.tsx + settingsModel 리듀서 |
| TC-ST-048 | PASS | ModelChoice.test.tsx |
| TC-ST-049 | PASS | ModelChoice.test.tsx (a)(b)(c) |
| TC-ST-050 | PASS | ModelChoice.test.tsx + settingsFile 단위 |
| TC-ST-051 | PASS | settingsModel.test.ts 전건 |
| TC-ST-052 | PASS | ModelChoice.test.tsx 5건 (방향키는 수동) |
| TC-ST-036 | 보류 | 수동 리뷰 grep, 이번 범위에서 미실행 |
| TC-ST-053 · MC-ST-07~09 | 보류 | 메인 세션 수행 예정(스크린샷·방향키·터치) |

FAIL 0 / SKIP 보류 2. 콘솔 오류 판정 대상 출력 없음(tail 기준).
