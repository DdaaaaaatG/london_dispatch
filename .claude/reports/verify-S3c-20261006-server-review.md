# S3c 서버 리뷰 (verify-server-reviewer 최종 보고 원문) — 2026-10-06

> 메인 세션이 리뷰어 hand-back 원문을 그대로 보존한 기록. 판정은 리뷰어의 것이다.

서버 리뷰: C 0 / H 0 / M 0 / L 3

결론: S3c 변경분에는 커밋을 막을 서버 이슈(CRITICAL·HIGH)가 없습니다. 위임문에서 특히 보라고 한 8개 항목은 모두 설계·계약과 맞습니다. 남은 것은 테스트 공백 1건과 정리 수준 2건(모두 LOW)입니다. 읽기만 했고 빌드·테스트는 다시 돌리지 않았습니다(위임문 지시 — 매니저 실행 결과 tsc 3종·lint·vitest 1048/1048·build exit 0을 인용만).

## Phase 요약: 경계 1 / 비동기 1 / 에러 0 / DB 0 / LLM 1

## 이슈 (심각도순)

### [LOW] SRV-001 server/src/messages/generate.ts:109-113, 145-149 — speak·regenerate가 잠금 안에서 설정을 읽다 D1 오류가 났을 때를 시험하는 테스트 없음
- 근거: Promise.all([pageDesc, getSummary, loadPromptSettings()])가 withSpeakLock의 try { return await task() } finally { await releaseQuietly(...) }(generate.ts:87-91) 안에 있어 코드는 맞음. 그러나 SRV-T-260(settings.test.ts:378)은 서비스 단독 get·loadForPrompt reject만 보고, SRV-T-256~258(messages-generate.test.ts:756-858)은 정상 읽기·깨진 행(시드 대체)·읽기 횟수만 봄. N5 경로(설정 D1 throw → speak 실패 → speaking_until NULL 복귀)가 speak 단에서 미시험.
- 권고: messages-generate.test.ts에 loadPromptSettings: async () => { throw new Error('d1') } 케이스 추가 — reject, rooms.speaking_until IS NULL, LLM 호출 0회 확인. (server-manager)

### [LOW] SRV-002 server/src/settings/schema.ts:61 — `}) as unknown as z.ZodType<CharacterSettings, unknown>` 이중 단언
- 근거: ts-rules.md:45는 단언을 "테스트·narrowing 불가 지점에만" 허용. Object.fromEntries(schema.ts:49-52)로 키 타입이 사라져 narrowing 불가는 맞고 settings.md:49에 설계 결정으로 기록됨. 다만 스키마 출력과 CharacterSettings 키가 어긋나도 컴파일러가 못 잡고 런타임 SRV-T-240에만 의존.
- 권고: satisfies를 쓴 명시적 11키 shape로 단언 제거, 또는 유지 시 단언 줄에 "SRV-T-240이 키 일치를 보증" 주석. (server-manager)

### [LOW] SRV-003 server/src/auth/index.ts:5 — 모듈 문서주석 [설정]에 ownerMbIds 누락
- 근거: `[설정] config.tokenSecret·tokenMinLevel·rateLimitPerMin`만 적힘. 같은 모듈 service.ts:6과 services.ts:68은 ownerMbIds(S3c)를 넘김. [공개 API]·[에러]·[테스트] 줄은 S3c 반영됨.
- 권고: `…rateLimitPerMin·ownerMbIds(S3c)` 추가. (server-manager)

## Phase별 확인 결과

### Phase 1 경계·env
- OWNER_MB_IDS는 env.ts:64·136-146·167·198에서만 읽음. server/src 전체 process.env·import.meta.env 0건. services.ts:68이 파싱 값만 auth에 전달, settings는 env 미참조. .dev.vars.example에 키 있음, wrangler.toml [vars]에 없음(env.md:163·169 일치).
- 의존 방향: routes/settings.ts → services, routes/schemas.ts:4 → ../settings, settings → db·llm·auth(타입만). llm·db·messages에서 ../settings import 0건. messages는 loadPromptSettings를 deps 값으로 받고(messages/service.ts:59, :71 ...createGenerateOps(deps)) 연결은 컨테이너(services.ts:78)뿐. settings.md:171-172 일치.
- 라우트 얇음(핸들러 각 2줄). 서비스는 HTTP 상태를 모르고 AppError 코드만 던짐. 신규 파일 문서주석 6항목 있음.

### Phase 2 비동기·동시성
- 미들웨어 순서: E15 requireToken, requireOwner(routes/settings.ts:27). E16 requireToken, requireOwner, rateLimitWrites, settingsBodyLimit, validate(:33-38). api.md:259·937 일치. 비주인은 레이트리밋 미소모(auth-owner.test.ts:162). requireOwner 단독이면 getPrincipal이 TOKEN_REQUIRED로 닫힌 쪽 실패(middleware.ts:24-27, SRV-T-238).
- speak·regenerate는 잠금 선점 뒤 loadPromptSettings() 1회(generate.ts:108-113, 144-149). 캐시·모듈 전역 상태 없음, 서비스는 요청마다 생성(services.ts:58). SRV-T-256(배선 reads=1)·SRV-T-258(선점 전 실패 시 0회) 확인.
- 저장 동시성: UPSERT 1문장 `version = character_settings.version + 1 … RETURNING`(db/sql.ts:102-109) — 원자적, 단조 증가. 마지막 쓰기 승리는 D-SET-5 설계.

### Phase 3 에러
- settings.get: readCurrent(settings/service.ts:64-77)는 db.characterSettings.get() throw를 잡지 않고 전파 → app.ts:113-117 unhandled_error → 500 INTERNAL. 시드 대체는 행 없음(:66)·JSON.parse 실패(:68)·재검증 실패(:70) 셋뿐.
- 에러 코드 15종: shared/src/errors.ts:5-21 ERROR_CODES·ERROR_STATUS(OWNER_ONLY 403)·ERROR_MESSAGES = api.md:318·1457-1461. OWNER_ONLY를 던지는 곳은 auth assertOwner(auth/service.ts:55-59) 한 곳, 응답 변환은 단일 handleError.
- 128KB 초과: Hono bodyLimit(node_modules/hono/dist/middleware/body-limit/index.js:45-53)은 Content-Length 유무와 무관하게 onError를 불러 chunked 요청도 계약 문구 `공통 · 설정 본문은 128KB 이하여야 합니다.`가 나옴. 의심 후 이슈 아님 확인.

### Phase 4 DB
- 0003: CREATE TABLE IF NOT EXISTS 멱등, 0001→0002→0003 연속, 코드 내 DDL 없음, 기존 테이블 무변경. CHECK(id=1, json 2~200000자, updated_by 1~20자)는 필드 상한 합계(약 25K자)·OWNER_MB_ID_MAX 20 안이라 정상 입력으로 위반 불가.
- SQL 전부 상수 + ?n 바인딩(sql.ts:98-109). first() null은 AppError INTERNAL로 좁힘(character-settings.ts:45). 테스트 --remote 0건.
- 배포 주의: speak가 character_settings에 의존. 0003 미적용 배포 시 speak 500(설계 N5·SRV-T-260 의도). /deploy의 migrations apply → deploy 순서 준수.

### Phase 5 LLM·프롬프트
- llm/prompt.ts buildSystem: 설정 출처 텍스트(world·persona·신규 8필드·rules·sampleDialogue)만 defang. OUTPUT_RULES(시드 common.json 고정)·GUARD_RULES 편집 불가. 빈 필드 생략, [출력 규칙]·대화 기록 형식 유지.
- 시드: JSON 3개를 parseCharacterFiles에서 checkCharacterSettings로 추가 검사. 캐릭터 상수 출처는 characters.ts 단일.
- 로그 설정 본문 0건: character_settings_invalid {field 경로}(service.ts:59), settings_saved {mbId, version}(:85), owner_denied {mbId}(auth/service.ts:57). SRV-T-257·259 단언.
- 변경 파일 모두 400줄 미만(최대 env.ts 207줄).

## False Positive 제외
- createGenerateOps(generate.ts:64-174, 110줄)는 함수 50줄 한도 초과지만 S3부터 있던 클로저 팩토리, S3c는 약 4줄 추가. 내부 함수는 모두 50줄 이하.
- auth/middleware.ts의 hono import는 설계상 auth 미들웨어 소관.
- OWNER_MB_IDS 형식 위반 → 전체 500 CONFIG_INVALID는 env.md:148 fail-fast 설계.
- regenerate가 NOT_LAST_MESSAGE 판정 전에 설정을 병렬로 읽는 것은 SRV-T-258 설계, 비용 미미.
- 테스트의 자리표시 ID(owner_test)·가짜 Db 스텁.
- 보안 관점(OWNER_MB_IDS의 Secrets/[vars] 배치, 설정 텍스트 프롬프트 주입)은 security 리뷰어 참조.
