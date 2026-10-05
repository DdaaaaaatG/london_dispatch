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
