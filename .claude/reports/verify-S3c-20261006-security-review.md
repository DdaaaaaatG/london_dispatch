# S3c 보안 리뷰 (verify-security-reviewer 최종 보고 원문) — 2026-10-06

> 메인 세션이 리뷰어 hand-back 원문을 그대로 보존한 기록. 판정은 리뷰어의 것이다. 비밀값 실값은 리뷰어가 마스킹한 그대로 둔다.

S3c 변경분에서 CRITICAL과 HIGH는 0건입니다. MEDIUM 1, LOW 3이며 셋 중 둘(SEC-002 문서 기록, SEC-003 헤더)은 S3c 이전부터 있던 것입니다. 주인 판정, 비밀값 격리, 본문 상한, SQL 바인딩, 가져오기 경로는 코드상 문제가 없습니다. 이번 리뷰에서 테스트나 빌드는 다시 돌리지 않았습니다.

보안 리뷰: C 0 / H 0 / M 1 / L 3

## 위협 모델 적용
- 토큰 위조·탈취: SEC-001, SEC-004
- 비밀값 유출: SEC-002
- 비용 남용: 문제 없음
- 입력 오염: SEC-004(주인이 쓴 텍스트에 한정)
- 출처 위조: SEC-003(기존)

## 이슈 (심각도순)

### [MEDIUM] SEC-001 server/src/env.ts:116 — `TOKEN_SECRET` 길이·강도 검사가 없습니다. S3c로 이 비밀값 하나에 걸린 권한이 커졌습니다.
- 근거: `const secret = z.preprocess(v => (v === '' ? undefined : v), z.string())` — 길이 하한이 없습니다. `.dev.vars.example`에는 "운영은 32자 이상"이라고만 적혀 있습니다.
- 위험: 주인 판정은 `ownerMbIds.includes(principal.mbId)`(server/src/auth/service.ts:43)뿐입니다. 그누보드 mb_id는 보통 공개돼 있으니, 주인 권한(모든 AI 호출의 시스템 프롬프트를 계속 바꿀 수 있는 PUT)을 막는 건 사실상 TOKEN_SECRET 하나입니다. 개발용 짧은 값(SEC-002)을 운영에 실수로 넣어도 기동이 거부되지 않습니다.
- 조치 방향: `parseEnv`에서 TOKEN_SECRET을 `min(32)`로 막거나, 최소한 `LLM_PROVIDER=google`일 때는 강제합니다. 배포 절차서(S5 handoff)에 "운영 SECRET은 개발 값과 달라야 한다"를 넣습니다. server-manager, 절차서는 contract-manager.

### [LOW] SEC-002 doc/next-session.md:8 — 추적되는 문서에 로컬 개발용 TOKEN_SECRET 실값이 있습니다.
- 근거: `npx wrangler dev --port 3000 --var TOKEN_SECRET:local-*** --var LLM_PROVIDER:fake` (마스킹)
- 같은 문서 :28에 테스트 주인 ID `owner01`과 토큰 발급 방식도 있습니다. 운영 값과 다르면 영향은 없지만 SEC-001과 겹치면 위험합니다.
- `doc/300_검증/screenshots/*/README.md:3`에도 같은 값이 있으나 `.gitignore` 대상이라 커밋되지 않습니다.
- 조치 방향: 문서에서는 `--var TOKEN_SECRET:<로컬 임의값>`처럼 자리표시로 바꿉니다. 메인 세션 문서.
- (메인 세션 조치 2026-10-06: next-session.md의 실값을 자리표시로 교체 완료, 추적 파일 grep 0건.)

### [LOW] SEC-003 server/src/app.ts:52-61 — 보안 헤더가 최소한만 있습니다(S3c 이전부터).
- 근거: `/api/*`를 포함한 모든 응답에 `frame-ancestors http://london-gossip.my https://london-gossip.my`만 붙고 `X-Frame-Options`는 지웁니다. `secureHeaders()`(nosniff, Referrer-Policy 등)는 없습니다.
- 이번에 주인 전용 JSON(`GET /api/settings/characters`)이 늘었습니다. 다만 `Authorization` 헤더가 필요해 실제 악용 가능성은 낮습니다.
- 조치 방향: `/api/*`는 `frame-ancestors 'none'`으로 하고 `hono/secure-headers`를 붙입니다. 이때 X-Frame-Options가 충돌하지 않게 지금처럼 지워야 합니다. server-manager.

### [LOW] SEC-004 server/src/llm/prompt.ts:90, 103-112 — 설정 텍스트는 `<<` `>>`만 바꾸고 줄 단위로는 처리하지 않은 채 시스템 프롬프트에 들어갑니다.
- 근거: `optionalSection = … [\`[${label}]\n${defang(body)}\`]`, `defang(profile.persona)`. persona나 rules에 `[출력 규칙]`, `[대화 기록 취급]` 같은 머리말 줄을 넣어 섹션을 흉내 낼 수 있습니다.
- 막혀 있는 부분: OUTPUT_RULES는 common.json 시드 상수(characters.ts:157), GUARD_RULES는 코드 상수이고, 둘 다 설정 섹션 뒤에 붙으므로 실제로 바뀌지는 않습니다.
- 위협은 주인 토큰이 탈취됐을 때로 한정됩니다(주인은 신뢰 주체). 이 경우 모든 방에 영구적인 프롬프트 오염이 남습니다. 남는 흔적은 version과 updated_by뿐이고 복원 버튼은 없습니다.
- 조치 방향(선택): 설정 텍스트 각 줄에서 줄 머리의 `[`를 무력화하거나 들여쓰기합니다(유저 블록의 `safeText`와 같은 방식). 운영에서는 내보내기 파일로 백업하도록 안내합니다. server-manager.

## 특히 볼 것 — 확인했고 문제 없음
- 주인 판정: 경로 `requireToken` → `requireOwner` → `rateLimitWrites` → `bodyLimit` → zod(routes/settings.ts:27, 32-38). 토큰 검증은 서명(`crypto.subtle.sign` + `timingSafeEqual`, 길이 32 선검사) → exp → level 순, 서명이 맞기 전에는 JSON 미해석(token.ts:82, 99-100, 118-124). 주인 비교는 대소문자 정확 일치·trim 없음. env 쪽은 공백·쉼표 분리, 빈 조각·중복 제거, 최대 5개·각 1~20자(env.ts:140-147). 목록이 비면 `[]`라 전원 403(service.ts:42), 컨테이너가 항상 값을 넘김(services.ts:69). principal 없으면 `getPrincipal`이 TOKEN_REQUIRED.
- 비노출: OWNER_MB_IDS는 `wrangler.toml [vars]`에 없고 `.dev.vars.example`은 빈 값. 로그는 `owner_denied{mbId}`·`settings_saved{mbId,version}`·`character_settings_invalid{field}`만. 응답에 `updated_by` 없음(character-settings.ts:362). ui/dist에서 `TOKEN_SECRET|LLM_API_KEY|OWNER_MB_IDS|ownerMbIds|AIza…|sk-…|owner01|local-dev` 0건, `Bearer`는 헤더 구성 코드 1건. doc/handoff에는 `.gitkeep`만.
- PUT 본문: 128KB `bodyLimit`은 requireOwner 뒤. 설정 본체 `z.strictObject` 3단·두 캐릭터·11필드 필수·코드 포인트 길이. 봉투 바깥 모르는 키 버림(설계 의도). `__proto__` 거절. 서비스·D1 읽기 시점 재검증, 훼손 행은 시드.
- 400 문구는 라벨·상한만, 입력값 미반환. 500 고정 문구, errMessage 로그 300자.
- SQL: 상수 문자열 + `?1~?3` 바인딩.
- 0003: `CHECK (id = 1)`, `length(json) BETWEEN 2 AND 200000`, `version >= 1`, `length(updated_by) BETWEEN 1 AND 20`. 최대 설정 이스케이프 후 약 13.6만 자.
- 프롬프트: 표시명 shared 상수. outputRules·GUARD_RULES 편집 불가(`toPromptSettings`가 OUTPUT_RULES 고정 주입). 설정 텍스트 defang, 유저 텍스트는 구분자 블록 안.
- 내보내기: `toExportFile` 화이트리스트 복사(settingsFile.ts:68-94). Blob URL revoke, `rel=noopener`.
- 가져오기: 읽기 전 `file.size > 5MB` 거부(useImportForm.ts:70), 붙여넣기도 UTF-8 바이트 재측정(settingsFile.ts:138). JSON → 형식·버전 → 후보 → `checkCharacterSettings` 전체 검사, 위반 시 전체 거부. patch로 초안만, 저장은 별도(useSettingsEditor:122). E.No.S 백업은 화이트리스트만, `SETTINGS.apiKey` 미열람(settingsCandidate.ts:126, 177-185, 210).
- 레이트리밋: 비주인 403 미카운트지만 HMAC 검증·로그 1줄뿐(D1 쓰기·AI·본문 읽기 없음) → 새 남용 경로 아님. 주인 PUT은 mb_id 기준 D1 카운터 공유.
- 화면 토큰: 저장소 접근은 `components/utils/storage.ts` 한 곳. settings 쪽 `localStorage`·`sessionStorage`·쿠키·`console.` 0.

## 사실 기록
- HTTPS: workers.dev 기본. 레이트리밋 분당 20회(D1 rate_limits, mb_id 키), 설정 PUT 포함. frame-ancestors 출처 2개, env 경유. `wrangler.toml [vars]`에 비밀값 없음, OWNER_MB_IDS는 Secrets 권고. `.gitignore`가 `.dev.vars`·`.wrangler/`·`.ld-token.local` 제외. handoff에 토큰 PHP 조각 아직 없음(S5). `compatibility_date` 2026-08-15, 플래그 `nodejs_compat`.
- 참고(결함 아님): 토큰이 있는 방문자는 열 때마다 주인 판정 GET 1회(ui/src/App.tsx:110) → 비주인 쓰기 회원마다 `owner_denied` info 로그 1줄. 로그 양만.

## False Positive 제외
- 테스트 파일의 `OWNER_MB_IDS: 'owner_a'`·`'owner01'`·`'owner_test'`는 자리표시. design 문서 `TOKEN_SECRET: 'test-secret'`·`SENTINEL`은 픽스처 설명. ui/dist `Bearer ${r}`는 헤더 코드. 마지막 쓰기 승리 UPSERT는 D-SET-5 설계.
