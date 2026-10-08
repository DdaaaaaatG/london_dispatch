# S6 보안 리뷰 (verify-security-reviewer) — 2026-10-09

- 대상: c6a5531~1..HEAD(코드는 09ae730, 리뷰 중 문서 커밋 f78f0f4 1건 추가 — 코드 변경 없음)
- 요약: `SEC: C0 H0 M2 L4` — 배포 차단 결함 없음. 남은 MEDIUM 2건은 등급 2 개정(cf0dc56)으로 설계 전제가 바뀐 데서 나옴

## 이슈
| 심각도 | 코드 | 위치 | 내용 | 조치 방향 | 라우팅 |
|---|---|---|---|---|---|
| MEDIUM | SEC-001 | server/wrangler.toml:13·15·20, server/src/auth/service.ts:80-89 | 등급 2로 AI 호출 가능자가 관리자 → 일반 회원 전원. mbId 상한은 모든 쓰기 공용 분당 20회뿐이고 AI 전용·회원별 일/월 상한 없음. speak 1회 = 제공사 최대 3회. 월 예산 상한이 금전 피해는 막지만, 회원 1명이 예산을 소진하면 다음 달 1일까지 전원 캐릭터 버튼 429(가용성) | 회원별 AI 호출 상한(일 단위 등) 또는 위험 수용 기록 | 사용자 결정 → contract-manager(api.md §6) → server-manager |
| MEDIUM | SEC-002 | server/src/routes/rooms.ts:83-88, server/src/auth/service.ts:90-94 | E17 입장이 optionalToken(익명 허용) + 카운터 키 `enter:{roomId}`만(분당 5, 최소 4자). 익명 무차별 대입(4자리 숫자 평균 약 17시간)과 익명 잠금 DoS(정상 열람자 계속 429) 가능. 설계 수용 근거("입장자는 토큰 없는 열람자")가 VIEW_LEVEL=LEVEL=2로 사라짐 | password 있는 시도는 토큰 필수 + mbId 카운터 병행 | 사용자 결정 → contract-manager(api.md §4.19·§6.2) → server-manager |
| LOW | SEC-003 | doc/200_설계/contract/api.md:1363, server/src/routes/rooms.ts:99-104 | 안 잠긴 방 잠금 설정이 「등급 통과자 누구나」(Q4 결정 당시 등급 10). 이제 일반 회원 누구나 공개 방을 잠가 다른 회원을 내보낼 수 있음. 로그 room_password_set{roomId,mbId}로 추적 가능 | Q4 재확인(유지 / 방 만든 사람·주인 한정) | 사용자 결정 → contract-manager |
| LOW | SEC-004 | server/src/rooms/entry-key.ts:31-41, ui/src/components/utils/storage.ts:59-65 | 입장 증명 = HMAC(K, roomId+passHash): 만료 없음·사람 비귀속 bearer, localStorage `ld:roomKeys` 저장. 유출 시 비밀번호 바꾸기 전까지 유효(D-S6-1 의도, 피해 방 하나) | 위험 수용 명시, 필요 시 만료 포함 v2 | contract-manager(설계 기록) |
| LOW | SEC-005 | server/src/logger.ts:20-34 | FORBIDDEN_KEYS에 password·passHash·entryKey·roomKey 없음(현재 해당 필드 로그 호출 0건) | 금지 목록 추가(심층 방어) | server-manager |
| LOW | SEC-006 | doc/next-session.md:9 | 갠홈 주인 실제 회원 아이디(b***)가 추적 문서에 있음 — .dev.vars.example:22-23 정책 위반. 토큰 위조 불가(SECRET 필요)하나 표적 정보. SECRET 사본 파일의 로컬 경로(값 없음)도 같은 줄 | 자리표시로 교체, 이력 처리 사용자 판단 | 메인 세션 |

## 이상 없음
- 비밀번호 해시: PBKDF2-SHA256 20,000회, 호출마다 16바이트 salt(getRandomValues), crypto.subtle.timingSafeEqual 비교, 저장 반복수 상한 100,000 검사, 원문 미저장, DB CHECK 20~200.
- 입장 증명: TOKEN_SECRET에서 용도 파생한 추출 불가 HMAC 키, 상수 시간 비교, 128자·접두사·32바이트 선검사, 비정규 base64url 거부, `X-Room-Key` 헤더 전용(쿼리·본문·쿠키 미수용).
- 관문: api.md 대상 전부(GET messages, user, speak, PATCH/DELETE room, GET/PUT memory, PUT/DELETE password, PATCH/DELETE message, regenerate) 적용. 메시지 id 경로는 소속 방 roomId+passHash로 검증 — 타 방 증명 통과 불가. 비정수 id는 서비스 404.
- 레이트리밋: D1 rate_limits, 해시 전 계수, 없는 방은 계수 전 404(PBKDF2 CPU 남용 없음), 본문 1KiB·password 64 코드포인트 상한.
- 로그·응답: 요청 로그 method·path·status·ms만, S6 로그에 비밀번호·해시·증명 없음, 응답은 `locked` 불리언만.
- ui 토큰: localStorage·sessionStorage·쿠키 저장 0(state/token.ts 클로저). 증명은 같은 출처 요청 헤더로만.
- 등급 변경: 코드 기본 5·운영 [vars] 2(빠지면 엄격 쪽 실패), handoff RB_CHATBOT_LEVEL 2·api.md 일치, 주인 판정은 OWNER_MB_IDS로만, 등급 미달 토큰은 주인 프리패스 불가.
- SQL 전부 상수 + `?n` 바인딩. 프롬프트 경로 미변경. [vars]에 비밀값 없음, .gitignore가 .dev.vars·.wrangler 제외, 저장소 실값 0건. CSP·frame-ancestors 회귀 없음(/api/* 'none', run_worker_first).
