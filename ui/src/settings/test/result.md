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
