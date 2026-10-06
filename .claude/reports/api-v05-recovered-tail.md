# api.md v0.5 유실 구간 복원본 (2026-10-06, 메인 세션)

> S3c 커밋 0be2f4c에서 §12.4 교체 스크립트(`indexOf` -1)로 잘려 나간 §13.4 · §14.14~16 · §15.12 · §16 · S3c 인계 메모·목록을, s3c-contract-designer의 편집 기록(생성 4건 + 후속 9건)으로 재조립했다. §16은 10:40 UTC ui-test-designer가 줄 번호와 함께 읽은 원문과 60줄 동일 확인. 아래를 api.md의 「유실, 복구 필요」 자리에 contract-designer가 병합한다.

---

- 저쪽 재적용 없음. 토큰·`?t=`·임베드 주소는 그대로다. handoff는 S5에 안내 단락만 더한다(§8).

### 13.4 S3c 변경 분류 (v0.5)

| 변경 | 분류 | 영향 받는 곳 | 비고 |
|---|---|---|---|
| E15 · E16 신설(R-API-001 개정) | 추가 | 없음(이전에는 `404`) | 기존 14개 엔드포인트의 요청·응답·에러·레이트리밋 불변 |
| 에러 코드 `OWNER_ONLY` 추가(R-API-002 개정) | 추가(비파괴) | 옛 화면 번들은 `INTERNAL`로 정규화(§3.4). 옛 번들에는 설정 호출이 없어 실제로 받을 일이 없다 | `AUTH_FAILURE_CODES` 불변 — 기존 화면의 읽기 전용 전환 규칙이 바뀌지 않는다 |
| R-AUTH-003 예외(설정 GET 토큰 필요) | 추가 | 없음(새 경로에만 적용) | 기존 읽기 3종은 계속 토큰 불필요·헤더 무시 |
| 타입 4종 · `PATHS.characterSettings` · `endpoints.characterSettings` | 추가 | 없음(기존 키·타입 그대로) | API-T-042 "PATHS 값 9개" → 10개(테스트 갱신) |
| 신규 `shared/src/settings.ts` | 추가 | 없음 | `limits.ts`·`characters.ts` 불변 |
| routes `validate(target, schema, toMessage?)` | 추가(선택 인자) | routes 내부. 기존 호출은 기본 문구 그대로 | |
| ui/api `RequestOptions.method`에 `'PUT'` | 추가(api 폴더 내부) | 없음 | 화면은 `request`를 쓰지 않는다 |
| `shared/test/errors.test.ts` 14 → 15 | 테스트 갱신 | API-T-040 | |

- **파괴 변경 0건.** 엔드포인트 14개·에러 코드 14종의 status·문구·토큰 규칙·레이트리밋 한도 값은 바뀌지 않았다. E16이 쓰기 공용 분당 한도를 나눠 쓰므로 주인이 설정을 자주 저장하면 그 분의 다른 쓰기 횟수가 그만큼 준다.
- **토큰 형식·handoff 불변.** payload·서명·`?t=`·임베드 주소·PHP 조각이 그대로라 저쪽 재적용이 없다(R-AUTH-001 개정 없음, §2.7). `doc/handoff/**`는 이번에 고치지 않는다.
- 이후 바뀔 수 있는 자리:
  - 설정 필드를 더하면 E16 본문이 strict·키 필수라 **옛 화면 번들의 PUT이 `400`**이 된다(파괴). 같은 Worker로 함께 배포되므로 새로 고치면 풀린다. 내보내기 파일은 가져오기가 없는 키를 현 초안 값으로 채우므로(§16.2) `formatVersion`을 올리지 않아도 된다. 키 이름을 바꾸거나 형을 바꿀 때만 `formatVersion`을 올린다.
  - 상한 완화는 비파괴, 강화는 저장된 값·내보낸 파일에 대해 파괴다(저장 행 재검증 실패 → 시드 대체).
  - 낙관적 잠금(`baseVersion` + `409`)이 요구되면 선택 필드 추가 + 새 에러 코드(R-API-002 개정)가 필요하다.


---

## 14. 테스트 계획
| API-T-UI-023 | `ui/src/api/api.test.ts` | `two_429_codes_are_distinguished_by_code` | 같은 status 429에 `RATE_LIMITED`+`40` → `retryAfterSec === 40`, `LLM_BUDGET_EXCEEDED`+`40` → 키 없음. 두 `error.code`가 다르다 | R-CHAT-011 · R-AUTH-005 |

### 14.14 S3c routes — `server/test/routes-settings.test.ts` (API-T-091 ~ 103)

준비:

- §14.9 준비 그대로(`NOW = 1_700_000_000_000`, `signTestToken`, env 덮어쓰기 방식). 추가 바인딩 `OWNER_MB_IDS: 'owner01'`(테스트 자리표시자 — 실제 회원 ID 금지).
- 토큰 3종: 주인 `mb_id 'owner01'`·통과 등급, 비주인 `mb_id 'member01'`·통과 등급, 등급 미달 주인 `mb_id 'owner01'`·`TOKEN_MIN_LEVEL - 1`.
- 유효 본문은 `shared/test/settings-vectors.ts`의 `validSettings()`(§14.15)로 만든다. D1 `character_settings`는 server 0003 마이그레이션이 만든다.
- `expectContractError(res, code)`는 S3b 판 그대로 쓴다(`OWNER_ONLY`·`VALIDATION_ERROR`는 `code`·`message` 두 키).

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-091 | `settings_require_token` | GET·PUT 각각 ① 헤더 없음 ② `Bearer garbage` ③ 헤더 없이 `?t=<주인 토큰>` ④ 헤더 없이 깨진 JSON PUT | ① 401 `TOKEN_REQUIRED` ② 401 `TOKEN_INVALID` ③ 401 `TOKEN_REQUIRED` ④ 401(400 아님) | R-AUTH-003 · R-SET-004 |
| API-T-092 | `settings_level_checked_before_owner` | 등급 미달 주인 토큰으로 GET·PUT | 403 `LEVEL_TOO_LOW`(`OWNER_ONLY` 아님) | R-AUTH-002 · R-SET-001 |
| API-T-093 | `settings_non_owner_gets_owner_only` | ① 비주인 GET·PUT ② `OWNER_MB_IDS: ''`에서 주인 토큰 GET ③ `RATE_LIMIT_PER_MIN: '1'`에서 비주인 PUT 3회 | ① 403 `OWNER_ONLY`, message = 기본 문구, 응답 문자열에 `owner01`·`member01` 없음 ② 403 `OWNER_ONLY` ③ 403 × 3(429 없음), D1 행 없음 | R-SET-001 · R-AUTH-006 · R-AUTH-005 |
| API-T-094 | `settings_get_returns_seed_when_never_saved` | 빈 D1, 주인 GET | 200, 키 정확히 `settings`·`version`·`updatedAt`·`isDefault`, `isDefault true`·`version 0`·`updatedAt null`, `checkCharacterSettings(body.settings).ok`, 캐릭터 키 `sebastian`·`ciel`, 각 11키. 응답 문자열에 `owner01`·`updatedBy`·`mbId`·`outputRules` 없음 | R-SET-004 · R-SET-003 · R-AUTH-006 |
| API-T-095 | `settings_put_replaces_and_normalizes` | 주인 PUT(앞뒤 공백 값, `sampleDialogue: ['  a ', '', '   ']`) → GET → 두 번째 PUT | 200, `settings` = `checkCharacterSettings(input).value`, `version 1`, `updatedAt === NOW`, `isDefault false` / GET이 같은 값 / 두 번째 `version 2` | R-SET-005 · R-SET-003 |
| API-T-096 | `settings_put_rejects_unknown_keys` | ① `sebastian.apiKey` ② `characters.meirin` ③ `settings.outputRules` ④ 봉투에 `extra: 1` + 유효 `settings` | ①~③ 400 `VALIDATION_ERROR`, 문구 = §4.16 표(`세바스찬 · 알 수 없는 항목이 있습니다.` / `공통 · 알 수 없는 캐릭터가 있습니다.` / `공통 · 알 수 없는 항목이 있습니다.`), 문구에 `apiKey` 없음, D1 불변 ④ 200 | R-SET-002 · R-SET-008 |
| API-T-097 | `settings_put_limits_by_code_points` | ① `ciel.speech` 800자 / 801자 ② 이모지 800개(UTF-16 1600) ③ `sebastian.sampleDialogue` 10개 / 11개 ④ `ciel.rules` 항목 200자 / 201자 ⑤ `world` 2000자 / 2001자 | 상한은 200, 상한+1은 400과 문구(`시엘 · 말투는 1~800자여야 합니다.` · `세바스찬 · 샘플 대사는 10개 이하여야 합니다.` · `시엘 · 규칙·금기는 한 줄에 200자 이하여야 합니다.` · `공통 · 세계관은 1~2000자여야 합니다.`) ② 200 | R-SET-002 · R-SET-005 |
| API-T-098 | `settings_put_rejects_empty_required_and_bad_types` | ① `world: '   '` ② `sebastian.persona: ''` ③ `ciel.speech` 키 없음 ④ `ciel.rules: 'a'` ⑤ `characters.ciel` 없음 | 400 각각 `공통 · 세계관은 1~2000자여야 합니다.` · `세바스찬 · 성격·배경은 1~1500자여야 합니다.` · `시엘 · 말투 값의 형식이 올바르지 않습니다.` · `시엘 · 규칙·금기 값의 형식이 올바르지 않습니다.` · `시엘 · 설정 형식이 올바르지 않습니다.` | R-SET-002 |
| API-T-099 | `settings_put_reports_first_violation_only` | `world` 빈 값 + `ciel.speech` 801자 + `ciel.apiKey` | 400, message = `공통 · 세계관은 1~2000자여야 합니다.` 하나. `error` 키 `code`·`message` 둘 | R-SET-005 · R-API-002 |
| API-T-100 | `settings_put_body_over_128kb` | ① 유효 JSON + 공백 패딩으로 131073바이트 ② 131072바이트 이하 유효 본문 ③ `RATE_LIMIT_PER_MIN: '1'`에서 ① 다음 유효 PUT | ① 400 `VALIDATION_ERROR` `공통 · 설정 본문은 128KB 이하여야 합니다.`(413 아님), D1 불변 ② 200 ③ 429 `RATE_LIMITED`(① 이 1회 소모) | R-SET-005 · R-AUTH-005 |
| API-T-101 | `settings_put_malformed_body` | ① 깨진 JSON ② `Content-Type: text/plain` ③ `{}` ④ `{ "settings": null }` | ① 400 기본 문구 ②③④ 400 `공통 · 설정 형식이 올바르지 않습니다.` | R-API-004 · R-SET-005 |
| API-T-102 | `settings_put_rate_limited_get_not` | `RATE_LIMIT_PER_MIN: '2'`: ① 주인 PUT 3회 ② 주인 GET 3회 ③ (새 분 창) PUT · `POST /api/rooms` · PUT | ① 200 · 200 · 429 `RATE_LIMITED`(`retryAfterSec` 40) ② 200 × 3 ③ 200 · 201 · 429(쓰기 공용 한도) | R-AUTH-005 · R-SET-004 · R-SET-005 |
| API-T-103 | `settings_unregistered_routes_404` | 주인 토큰으로 `POST`·`PATCH`·`DELETE /api/settings/characters`, `GET /api/settings`, `GET /api/settings/characters/sebastian` | 404 `NOT_FOUND` | R-API-001 |

- 정상 경로 3건(094·095·097 일부)보다 에러 입력이 많다(091~093·096~101만 30건 이상).
- 저장 직후 speak 프롬프트 반영·행 훼손 시 시드 대체·로그 grep은 server SRV-T가 맡는다(s3c-03 §1.4).

### 14.15 S3c shared — `shared/test/*.test.ts`

| 테스트ID | 파일 | 이름 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-040(갱신) | `errors.test.ts` | `error_table_matches_contract` | 기대 표에 `OWNER_ONLY: 403`, `toHaveLength(15)`, 설명 "계약 15종" | R-API-002 |
| API-T-049 | `errors.test.ts` | `errors_include_owner_only` | `indexOf('OWNER_ONLY') === indexOf('CONFIG_INVALID') + 1`, 바로 다음이 `INTERNAL`, `ERROR_STATUS` 403, 문구 = §3.2, `isErrorCode('OWNER_ONLY')` true | R-API-002 · R-SET-001 |
| API-T-042(갱신) | `endpoints.test.ts` | `endpoints_build_paths_and_queries` | `PATHS` 값 10개 | R-API-001 · R-API-008 |
| API-T-104 | `endpoints.test.ts` | `endpoints_build_settings_path` | `PATHS.characterSettings === '/api/settings/characters'`, `endpoints.characterSettings()` 같은 값 | R-API-001 · R-SET-004 |
| API-T-105 | 신규 `settings.test.ts` | `settings_specs_match_contract` | `CHARACTER_FIELD_KEYS` 11개·중복 없음·`Object.keys(CHARACTER_FIELD_SPECS)`와 같은 순서, 라벨·상한·필수가 s3c-02 §2.1 표와 같음(예외 1건: `WORLD_FIELD_SPEC.label === '세계관'`, §15.12 결정 2. 필수는 `persona`·`speech` + `WORLD_FIELD_SPEC`), `SETTINGS_CHARACTER_IDS`와 `Object.keys(CHARACTERS)` 집합 같음, 상수 4개 값(`'london-dispatch/character-settings'` · 1 · 131072 · 5242880) | R-SET-002 · R-SET-005 · R-SET-007 · R-SET-008 |
| API-T-106 | `settings.test.ts` | `check_accepts_boundaries_and_normalizes` | 벡터 `accept` 전부 `ok`. 값은 trim·목록 빈 항목 제거, 이모지 800개 통과, 입력 객체를 바꾸지 않는다 | R-SET-002 |
| API-T-107 | `settings.test.ts` | `check_rejects_with_contract_messages` | 벡터 `reject` 전부 `ok: false`, `issue.path`·`issue.message`가 §4.16 표와 정확히 같다(13행 전부 + 첫 위반 순서 + 라벨 12개의 은/는) | R-SET-002 · R-SET-005 |

- 벡터 파일 `shared/test/settings-vectors.ts`: `validSettings(): CharacterSettings`와 `SETTINGS_VECTORS: { name; input; expect: { ok: true } | { ok: false; path; message } }[]`. server 스키마 테스트(SRV-T, server-designer 번호)가 같은 파일을 상대 경로로 import해 zod 통과 여부가 `expect.ok`와 같은지 본다(s3c-03 §2.3). workerd 풀에서 import가 막히면 server 쪽 사본을 두고 리뷰로 동일성을 본다.

### 14.16 S3c ui/api — `ui/src/api/api.test.ts` (§14.7 준비 그대로)

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| API-T-UI-024 | `get_character_settings_sends_token_get` | `configureClient({ getToken: () => 'tok' })` → `fetch`가 `GET /api/settings/characters`, `Authorization: Bearer tok`, 본문·`Content-Type` 없음. 200 본문 → `ok: true`, `value` 그대로 | R-SET-004 · R-API-003 |
| API-T-UI-025 | `save_character_settings_sends_put_body` | `PUT` 같은 경로, `Content-Type: application/json`, `JSON.parse(body)` 키 정확히 `['settings']`, `Authorization` 있음. 200 → `value` 그대로 | R-SET-005 · R-API-003 |
| API-T-UI-026 | `owner_only_is_not_auth_failure` | 두 래퍼에 403 `OWNER_ONLY` → `ok: false`, `code`·`message` 그대로, `isAuthFailure(error) === false`. 같은 래퍼에 401 `TOKEN_INVALID` → `isAuthFailure` true(판정만 돌려준다). reject 없음. `message`가 빈 문자열이면 `ERROR_MESSAGES.OWNER_ONLY` | R-SET-010 · R-API-002 |
| API-T-UI-027 | `settings_wrappers_without_token` | getter가 `null` → `Authorization` 없음, 서버 401 `TOKEN_REQUIRED`를 그대로 돌려준다 | R-AUTH-003 · R-API-003 |

리뷰 grep(S3c):

```bash
# 경로 리터럴은 shared/src/endpoints.ts 에만
grep -rn "/api/settings" shared/src server/src ui/src --include=*.ts --include=*.tsx | grep -v "shared/src/endpoints.ts"
# 화면 코드의 fetch 0건, 토큰 저장 0건(§14.8 그대로)
# AUTH_FAILURE_CODES 에 OWNER_ONLY 없음
grep -n "OWNER_ONLY" ui/src/api/client.ts
```

- 첫 grep과 셋째 grep은 결과가 0줄이어야 한다.

### 15.12 S3c server 의존 · 통보 · 현황 · 확인 필요 (v0.5)

사용하는 server 함수·타입(s3c-03 §1.3 전제, 모두 구현 전):

| 사용처 | server 쪽 | 출처 |
|---|---|---|
| E15 · E16 | `requireOwner: MiddlewareHandler<AppEnv>` — `server/src/auth/index.ts`에서 export, `requireToken` 뒤, 아니면 `AppError('OWNER_ONLY')` | s3c-03 §1.3 · auth.md(S3c) |
| E15 | `SettingsService.get(): Promise<CharacterSettingsResponse>` | s3c-03 §1.3 · settings.md |
| E16 | `SettingsService.put(settings: CharacterSettings, by: Principal): Promise<CharacterSettingsResponse>` | 같음 |
| E16 스키마 | `characterSettingsSchema`(zod) — `server/src/settings/index.ts`에서 export | 같음 |
| 서비스 접근 | `Services.settings`(`c.get('services').settings`) | s3c-03 §1.2 · index.md |
| 기존 | `requireToken` · `rateLimitWrites` · `getPrincipal` · `Principal` · `AppError` | auth.md §9.1 · index.md §2.4 |

- `AuthService.isOwner`는 routes가 직접 부르지 않는다. env 바인딩 추가는 server 몫 `OWNER_MB_IDS` 하나이고 contract가 더하는 설정은 없다.

server에 통보할 것(s3c-03 §1.3 **시그니처와 어긋나는 것은 없다.** 아래는 시그니처 밖에서 계약이 정한 값이다):

| # | 대상 | 계약이 정한 것 | 이유 |
|---|---|---|---|
| N1 | `settings/schema.ts` zod | 상한·필수는 `@shared/settings`(`WORLD_FIELD_SPEC`·`CHARACTER_FIELD_SPECS`)에서 import. 길이는 `countCodePoints(normalizeText(v))`(zod `.max()` 금지). 목록은 항목 trim → 빈 항목 제거 → 개수 → 항목 길이. strict 3단(본체·`characters`·캐릭터), 두 캐릭터·11필드 키 필수(선택 필드도 키는 있어야 함) | 화면 사전 검사·서버 판정이 같은 벡터에서 같아야 한다(s3c-03 §2.3) |
| N2 | 같은 스키마 | 출력 타입이 shared `CharacterSettings`에 대입 가능해야 한다(routes가 `const body: PutCharacterSettingsBody = c.req.valid('json')`로 대조) | tsc 대조(§5.8.5) |
| N3 | 400 문구 | 문구는 routes가 shared `checkCharacterSettings`에서 만든다. zod에 한국어 문구를 둘 필요가 없다. `put`이 라우트를 거치지 않는 호출을 위해 다시 검증한다면 문구도 같은 함수에서 가져온다 | 문구 단일 소스(§4.16) |
| N4 | `settings.put` 정규화 | 결과가 `checkCharacterSettings(input).value`와 같아야 한다(같은 함수 사용 권고). 응답 `settings`가 이 값이다 | API-T-095 |
| N5 | `settings.get` | 시드 대체는 "행 없음 · 재검증 실패"만. D1 읽기가 throw하면 `500 INTERNAL`(§4.15) | 장애를 시드로 숨기지 않는다 |
| N6 | `requireOwner` | D1에 접근하지 않고, 403 본문은 기본 문구만(목록·`mbId` 없음). `rateLimitWrites`보다 앞에 붙는 것을 전제로 계약이 "`OWNER_ONLY`는 세지 않음"을 약속했다 | §2.7 · §6.1 |
| N7 | `version` | 재검증 실패 행 위에 저장하면 응답 version = 그 행 version + 1(s3c-02 §3 UPSERT 그대로). 계약은 "단조 증가"만 약속한다 | §4.16 |

현황 메모(v0.5 작성 시점, 2026-10-06):

- S3c 4자는 **전부 없다.** `shared/src/errors.ts`는 14종(`OWNER_ONLY` 없음), `PATHS` 값 9개, `shared/src/settings.ts` 없음, routes에 `settings.ts` 없음, `validate.ts`는 2인자, `ui/src/api/client.ts` `method`는 `'GET' | 'POST' | 'PATCH' | 'DELETE'`다.
- server 쪽 `server/src/settings/`·`requireOwner`·`Services.settings` 소스도 없다(설계만 있음).

settings.md 대조 결과(v0.5 보정, 2026-10-06 — `server/settings.md` · `auth.md` §12 · `env.md` S3c 델타 · `db.md` §7.6):

| 항목 | 계약 | server 설계 | 판정 |
|---|---|---|---|
| `SettingsService` `get`·`put`·`loadForPrompt` 시그니처 | §4.15 · §4.16 · 이 절 | settings.md §2 그대로(`loadForPrompt` 반환형에 llm 별칭 `PromptSettings`만 붙음, 구조 같음) | 일치 |
| `characterSettingsSchema` 위치·이름·재노출 | §5.8.5 · §11.12 | settings.md §2·§3(`schema.ts`, `settings/index.ts` 재노출) | 일치 |
| `requireOwner` 위치·순서·I/O 없음 | §2.7 · N6 | auth.md §12.1·§12.2(`requireToken` 뒤·`rateLimitWrites` 앞, 대소문자 정확 일치, 동기 판정) | 일치 |
| `OWNER_ONLY` 403·기본 문구만·`owner_denied` info | §3.2 · §2.7 | auth.md §12.3 | 일치 |
| 정규화(trim · 목록 trim → 빈 항목 제거 → 개수 → 항목 길이, 순서·중복 유지) | §4.16 · §5.8.4 · N4 | settings.md §2.3 | 일치 |
| 시드 대체(행 없음·재검증 실패 → `version 0`·`null`·`true`), D1 throw → `INTERNAL` | §4.15 · N5 | settings.md §2.4·§5 | 일치 |
| version 단조 증가(훼손 행 위 저장 = 그 행 + 1) | §4.16 · N7 | settings.md §2.4 · db.md §7.6 | 일치 |
| 본문 128KB → 400 · 비주인 레이트리밋 미소모 | §4.16 · §6.1 | settings.md §9 · auth.md D-AUTH-17 | 일치 |
| 에러 매핑(`VALIDATION_ERROR`·`OWNER_ONLY`·`INTERNAL`·`CONFIG_INVALID`) | §4.15 · §4.16 | settings.md §5·§9 · env.md S3c(형식 위반 → `CONFIG_INVALID`) | 일치 |
| 로그 3종·본문 미기록 | §4.16 부수 효과 | settings.md §5.2 | 일치 |

- **server 내부, 계약 영향 없음:** `assertOwner`(auth.md §12.1) · `PromptSettings`(llm 별칭) · `parseCharacterSettings`·`firstSettingsIssue`(서비스 재검증·로그 경로용) · 0003 `json` CHECK 상한 200000(db.md §7.6, s3c-02 초안 100000에서 올림) · `OWNER_MB_IDS` 파싱 상세(env.md S3c).
- **server 400 문구는 §4.16 참조, 서버 zod는 판정만 한다.** (확정 — 2026-10-06 메인 세션 결정) 라우트 경유 400 문구는 routes `settingsIssueMessage`(= shared `checkCharacterSettings`)가 만든다. `put`을 라우트 없이 부른 경우의 400 문구도 같은 shared 함수에서 가져온다.

남은 불일치(전부 settings.md 쪽 문구·이름이다. server-designer가 고치는 중이고 계약은 바꾸지 않는다):

| # | settings.md 위치 | 지금 적힌 것 | 계약 기준 |
|---|---|---|---|
| M1 | §5.1 문구 표 · SRV-T-243·244 | 자체 문구(`최대 10개까지 넣을 수 있습니다` · `{이름}의 각 줄은` · `{이름} 형식이…` · 모르는 키·세 번째 id·캐릭터 누락은 범위 접두 없는 `설정 형식이 올바르지 않습니다.`) | §4.16 표 13행(범위 접두 항상 있음) |
| M2 | §9 라우트 규약 · §5 표 · D-SET-6 | 라우트가 `firstSettingsIssue(error, ['settings'])`로 400 문구를 만든다 | routes `settingsIssueMessage`(shared 함수, §11.12) |
| M3 | §9 라우트 규약 | 봉투 `z.strictObject({ settings })` | 봉투는 `z.object` — 바깥 모르는 키는 버린다(§4.16, 결정 4) |
| M4 | §2.2 가칭 명세 | `CHARACTER_SETTING_FIELDS`(배열, `key` 포함) · `WORLD_FIELD` · `issue.path` 문자열 | `CHARACTER_FIELD_SPECS`(키별 객체) + `CHARACTER_FIELD_KEYS`(순서) · `WORLD_FIELD_SPEC` · `SettingsIssue.path: readonly string[]`(§5.8.4) |
| M5 | §2.2 화면 이름 표 | `world` 화면 이름 `공통 세계관` | `세계관`(결정 2) |
| M6 (권고) | §2 · §3 server 타입 `SettingsIssue { path: string }` | shared `SettingsIssue`와 이름이 같고 모양이 다르다 | server 내부 타입 이름을 바꾸거나(예: `SchemaIssue`) shared 타입을 쓴다. 한 파일에서 둘을 import하면 충돌한다 |
- `hono/body-limit`(hono 4.13.13)은 `Content-Length`가 있으면 그 값으로, 없으면 스트림을 세어 `onError(c)`를 부른다. `onError`에서 throw하면 server `onError`가 받는다. `@hono/zod-validator` 0.9.1 훅은 실패 때도 `result.data`에 원래 입력을 준다 — `settingsIssueMessage`가 이것을 쓴다.

v0.5 확인 필요 5건은 모두 결정됐다.

결정 완료(2026-10-06 메인 세션 결정, 출처 `doc/state.json` decisions):

| # | 항목 | 결정 | 반영 |
|---|---|---|---|
| 1 | 필드 11개 키 전부 필수, 선택 필드는 `''`·`[]` | 승인 | §4.16 · §5.8.1 |
| 2 | 공통 탭 400 문구에 "공통"이 두 번 나옴 | `world` 필드의 **화면 이름을 `세계관`**으로 한다. 문구는 `공통 · 세계관은 …`. 탭 이름("공통 세계관")은 화면 `labels.ts` 몫이라 그대로다. s3c-02 §2.1 표(화면 이름 `공통 세계관`)는 system-architect 소유라 고치지 않았고, 이 결정이 그 칸보다 우선한다 | §4.16 문구 표 · §5.8.4 `WORLD_FIELD_SPEC.label` · §14.14 · §14.15 · 「ui 인계 메모」 S3c |
| 3 | 내보내기 `exportedAt` ISO 8601 문자열(epoch ms 규칙 예외) | 승인 | §16.1 |
| 4 | PUT 봉투 바깥 모르는 키 버림, `settings` 안만 strict | 승인 | §4.16 · §11.12 |
| 5 | E.No.S 매핑에서 문자열·문자열 배열 둘 다 수용 | 승인 | §16.3 |
| 6 | 가져오기 "무시한 항목" 정의(ui-design-checker 지적, v0.5 보정 2) | 출처에 값이 있으나 형이 달라 쓸 수 없는 위치만 센다. 출처에 없는 키·매핑 없는 필드(`persona`·`relationships`·`rules`)·`null`·E.No.S 빈 값은 "없음"이고 세지 않는다. 계수는 후보 만들기 단계 한 곳에서만 한다 | §16.2 · §16.3 |
| 7 | 가져오기 검사 범위(ui-design-checker 지적, v0.5 보정 2) | 파일이 준 후보 필드만 각 spec으로 검사하고, 상한 초과면 가져오기를 거부한다. 초안 전체 검사는 저장 버튼 활성 조건에서만 한다. 파일과 무관한 기존 초안 오류는 가져오기를 막지 않는다 | §16.2 · §5.8.4 쓰는 곳 표 |

남은 확인(막지 않음): 설정 상한을 `limits.ts`가 아니라 `settings.ts`에 둔 것(§5.7 메모). E.No.S 실물 백업 파일 1개로 §16.3 키 이름을 확인하면 좋다.

---

## 16. 부록 — 캐릭터 설정 파일 형식 · 가져오기 매핑 (S3c — R-SET-007 🔒 · R-SET-008)

서버 엔드포인트가 없는 화면 쪽 규칙이다. 구현은 ui `state/settingsFile.ts`(ui 설계 몫)이고 형식·매핑·금지 규칙의 정본은 이 절이다. 상수는 `shared/src/settings.ts`(§5.8.4)에 있다.

### 16.1 내보내기 파일 형식

```json
{
  "format": "london-dispatch/character-settings",
  "formatVersion": 1,
  "exportedAt": "2026-10-06T14:20:00.000Z",
  "settings": { "world": "…", "characters": { "sebastian": { "sourceMaterial": "…", "…": "…" }, "ciel": { "…": "…" } } }
}
```

| 키 | 값 |
|---|---|
| `format` | `SETTINGS_FILE_FORMAT` |
| `formatVersion` | `SETTINGS_FILE_FORMAT_VERSION`(1) |
| `exportedAt` | 내보낸 시각, ISO 8601 UTC 문자열(`new Date().toISOString()`). 사람이 파일을 열어 읽는 용도다 |
| `settings` | `CharacterSettings`. 응답 객체를 펼치지 않고 `world` + `SETTINGS_CHARACTER_IDS` 순서 × `CHARACTER_FIELD_KEYS` 순서로 **새로 만든다**(화이트리스트) |

- 최상위 키는 정확히 위 4개다. `version`·`updatedAt`·`isDefault`·`updatedBy`·`mbId`·토큰·설정 키(`LLM_API_KEY` 등)·`outputRules`는 넣지 않는다.
- 대상은 **마지막으로 읽거나 저장한 값**(E15·E16 응답의 `settings`)이다. 인증 만료로 저장할 수 없는 상태(stale)일 때만 현재 초안을 내보낸다(R-SET-007 · R-SET-011).
- 직렬화는 `JSON.stringify(file, null, 2)`, UTF-8, MIME `application/json`. 파일명은 `london-dispatch-characters-YYYYMMDD-HHmm.json`(브라우저 현지 시각)이다.
- 전달 수단은 둘이고 내용은 같은 문자열이다: Blob 다운로드(`URL.createObjectURL` + `a.download`)와 복사용 읽기 전용 텍스트 영역. iframe `sandbox`가 다운로드를 막아도 복사로 내보낼 수 있다(§8 TODO).

### 16.2 가져오기 판별·병합

| 순서 | 입력 | 판별 | 처리 |
|---|---|---|---|
| 0 | 파일 크기 | `> SETTINGS_IMPORT_MAX_BYTES`(5MB) | 읽지 않고 거부. 붙여넣기 텍스트도 같은 상한(UTF-8 바이트) |
| 1 | `JSON.parse` 실패 · 최상위가 객체가 아님 | — | 거부(알 수 없는 파일 형식) |
| 2 | 자체 형식 | `format === SETTINGS_FILE_FORMAT` | `formatVersion !== SETTINGS_FILE_FORMAT_VERSION`이면 거부(버전). 같으면 `settings`를 매핑 없이 후보로 쓴다 |
| 3 | E.No.S 백업 | 최상위 `DB` 객체에 `worlds` 배열 | §16.3 매핑. `SETTINGS`·`DB.chats`는 열지 않는다 |
| 4 | E.No.S world 단독 | 최상위 `characters` 배열 + `description` 문자열 | §16.3 매핑(그 파일 자체가 world) |
| 5 | 그 밖 | — | 거부 — `알 수 없는 파일 형식입니다.` |

- **후보 만들기(계수는 여기 한 곳).** 판별한 파일에서 화이트리스트 위치(`world`, `characters.{sebastian|ciel}.{CHARACTER_FIELD_KEYS}`)만 읽는다. 그 밖의 키는 읽지 않는다. 위치마다 아래 셋 중 하나로 나눈다(v0.5 보정 2).

| 분류 | 조건 | 처리 | 무시한 항목 수 |
|---|---|---|---|
| 후보 | 값이 있고 형이 맞다. 글 필드는 문자열, 목록 필드는 문자열 배열이다. E.No.S는 §16.3 변환을 거친 값이다 | 초안에 덮을 값 | 세지 않음 |
| 무시 | 값이 있으나(`undefined`·`null`이 아님) 형이 달라 쓸 수 없다. 예: 글 필드에 객체, 목록 필드에 숫자가 섞인 배열 | 현 초안 값 유지 | **1건** |
| 없음 | 키가 없다, 값이 `undefined`·`null`이다, E.No.S에 출처가 없는 우리 필드다(`persona`·`relationships`·`rules`), 대응 캐릭터가 없다, E.No.S 출처가 trim 뒤 빈 값이다 | 현 초안 값 유지 | 세지 않음 |

- "무시한 항목" 수는 **후보 만들기 단계에서만** 센다. 검사·덮기 단계는 다시 세지 않는다. 그래서 E.No.S 가져오기에서 매핑이 없는 필드는 매번 "없음"이고 요약에 무시로 잡히지 않는다.
- **후보 검사(파일이 준 후보 필드만).** 마지막으로 읽거나 저장한 값(E15·E16 응답 `settings`, 서버가 검증해 언제나 통과하는 값)을 기준으로 삼는다. 그 위에 후보만 덮은 객체를 `checkCharacterSettings`로 검사한다. 기준이 통과하는 값이므로 위반은 반드시 후보 필드에서 나온다. 결과는 각 후보 필드를 그 spec(형·필수·상한·개수)으로 검사한 것과 같고 문구는 §4.16 표 그대로다. 실패하면 초안을 바꾸지 않고 가져오기 전체를 거부한다. `issue.message`로 어느 필드인지 알리고, 상한을 넘은 값을 잘라 넣지 않는다(R-SET-008, s3c-02 Q5).
- **덮기.** 검사를 통과하면 결과 `value`에서 후보 위치의 값(정규화된 값)만 꺼내 현 초안에 덮는다. 후보가 아닌 위치는 초안 값을 그대로 둔다.
- **초안 전체 검사는 가져오기에서 하지 않는다.** 파일과 무관한 기존 초안 오류(미저장 입력의 상한 초과 등)는 가져오기를 막지 않는다. 초안 전체 사전 검사는 저장 버튼 활성 조건(「ui 인계 메모」 S3c 사전 검사 행)에서 그대로 한다. 가져온 뒤에도 기존 오류가 남아 있으면 저장 버튼은 비활성이다.
- **저장하지 않는다.** 가져오기는 초안만 바꾸고, 저장은 사용자가 「저장」(E16)을 눌러야 한다. 「변경 되돌리기」로 취소할 수 있다.
- 결과 요약은 반영한 범위(후보가 1개 이상인 세바스찬·시엘·공통)와 무시한 항목 수를 알린다. 후보가 0개면 초안을 바꾸지 않고 그 사실을 알린다. 문구는 화면 `labels.ts` 몫이다.
- 옛 `formatVersion` 1 파일에 나중에 더한 필드가 없으면 그 위치는 "없음"이라 초안 값이 남는다. 그래서 필드 추가만으로는 `formatVersion`을 올리지 않는다(§13.4).

### 16.3 E.No.S 매핑표 (읽는 키 = 아래 표뿐)

world 고르기: 백업은 `DB.worlds`를 앞에서부터 보고, `characters` 배열에 `name`이 shortName(`세바스찬` · `시엘`)을 포함하는 항목이 있는 **첫 world**를 고른다. 없으면 거부한다. world 단독 파일은 그 world를 쓰고, 맞는 캐릭터가 없으면 `world`만 반영한다. 캐릭터는 그 world의 `characters`에서 `name`에 shortName이 들어간 **첫 항목**이다.

| 우리 필드 | E.No.S 출처 | 변환 |
|---|---|---|
| `world` | `world.description` | 문자열이면 그대로 |
| `sourceMaterial` | `source_material` | 문자열 |
| `age` | `age` | 문자열. 숫자면 `String()` |
| `gender` | `gender` | 문자열 |
| `role` | `job` | 문자열 |
| `persona` | (없음) | 현 초안 유지 |
| `personalityTags` | `personality_tags` | 문자열이면 그대로, 문자열 배열이면 `', '`로 잇는다 |
| `appearance` | `appearance_desc` + `hair_style` + `eyes` + `accessories` | 넷 중 문자열만 trim, 빈 것 제외, 이 순서로 `'\n'`으로 잇는다 |
| `relationships` | (없음) | 현 초안 유지 |
| `speech` | `voice` | 문자열 |
| `sampleDialogue` | `sample_dialogue` | 문자열이면 줄(`\r?\n`)로 나눠 trim·빈 줄 제거, 문자열 배열이면 그대로 |
| `rules` | (없음) | 현 초안 유지 |

- 분류는 §16.2 표를 따른다(v0.5 보정 2). 출처 키가 없거나 값이 `null`이거나 trim 뒤 빈 값이면 "없음"이다. 값이 있으나 위 표가 받는 형(문자열, 표가 허용한 문자열 배열, `age`의 숫자)이 아니면 "무시" 1건이다.
- `persona`·`relationships`·`rules`는 E.No.S에 출처가 없어 늘 "없음"이고 세지 않는다. 대응 캐릭터가 없으면 그 캐릭터의 11필드가 모두 "없음"이다.
- `appearance`는 출처 4개를 각각 나눈다. 형이 다른 출처 1개가 무시 1건이다. 쓸 수 있는 출처가 하나도 없으면 `appearance`는 "없음"이다. `sampleDialogue`·`personalityTags`의 배열 출처에 문자열이 아닌 항목이 하나라도 있으면 그 출처가 무시 1건이다.
- world·캐릭터를 고르는 데 쓰는 판별 키(`DB.worlds`·`characters`·`name`)는 매핑 출처가 아니므로 세지 않는다.

가져오기 단위 테스트 기대값(ui `state/settingsFile.ts` — 기존 벡터 5종에 더한다, v0.5 보정 2):

| 벡터 | 기대 |
|---|---|
| E.No.S 백업, 매핑 출처가 모두 문자열 | 무시 0. `persona`·`relationships`·`rules`는 초안 값 그대로 |
| E.No.S 백업, `age: 13` · `gender: {}` · `sample_dialogue: ['a', 1]` | `age` 후보 `'13'`, 무시 2(`gender`·`sample_dialogue`), 두 필드 초안 값 유지 |
| E.No.S 백업, `voice: ''` · `job: null` | 둘 다 "없음", 무시 0, 초안 값 유지 |
| 자체 형식, `characters.ciel.speech` 801자 | 가져오기 거부, 메시지 `시엘 · 말투는 1~800자여야 합니다.`, 초안 불변 |
| 자체 형식, `characters.sebastian.rules: 'a'`(문자열) | `rules`만 무시 1, 나머지 후보 반영 |
| world 단독 파일(`description`만 유효) + 현 초안 `sebastian.appearance` 801자(미저장 입력) | 가져오기 성공(`world`만 덮음), 무시 0. 이어서 초안 전체 사전 검사는 `세바스찬 · 외형은 800자 이하여야 합니다.`로 실패해 저장 버튼 비활성 |
- **읽지 않는다:** `SETTINGS`(키 저장소), `DB.chats`, 성인용 필드 8종, 신체 치수, `entries`, `lorebook`, 그리고 위 표에 없는 모든 키.

### 16.4 비밀값 금지 규칙 (R-SET-007 · R-SET-008 · R-NFR-004)

| 단계 | 규칙 | 확인 |
|---|---|---|
| 서버 응답 | E15·E16 응답은 `settings`·`version`·`updatedAt`·`isDefault`뿐이다 | API-T-094 |
| 내보내기 | 화이트리스트로 새 객체를 만든다. 출력 키 집합 = 최상위 4개 + `world` + 2명 × 11필드 | ui 단위: 키 집합 일치, 출력 문자열에 `apiKey`·`API_KEY`·`SECRET`·`token` 0건 |
| 가져오기 | 화이트리스트로만 읽는다. `SETTINGS`를 열지 않는다. 파일 내용을 `console`·로그에 남기지 않는다 | ui 단위 벡터 5종(자체 · E.No.S 백업 · world 단독 · 잘못된 형식 · `SETTINGS`에 `apiKey`가 있는 파일 → 초안에 키 0) |
| 서버 저장 | strict가 모르는 키를 거부한다(마지막 방어). 400 문구에 키 이름을 싣지 않는다 | API-T-096 |
| 로그 | 설정 본문·필드 값을 남기지 않는다 | server SRV-T(R-SET-012) |

---

## 「ui 인계 메모」 (S3 · S3b — 화면이 계약에서 알아야 할 것만)
## 「ui 인계 메모」 S3c (v0.5 — 설정 화면·주인 판정)

| 주제 | 계약 |
|---|---|
| 호출 | 주인 판정·설정 화면 열기 → `getCharacterSettings()`, 저장 → `saveCharacterSettings(settings)`. 둘 다 `@/api`에서 import한다. 성공 값은 `CharacterSettingsResponse`다 |
| 주인 판정 | 토큰이 있을 때 App이 1회 `getCharacterSettings()`. `ok`면 `isOwner = true`, 그 밖은 모두 `false`. **판정 결과로 `revokeWrite`·`onAuthFailure`를 부르지 않는다**, 토스트도 없다(R-SET-010). 본문은 버린다 |
| `OWNER_ONLY` (403) | 설정 화면을 열거나 저장하다 받으면 안내 후 rooms로 가고 `isOwner = false`. 읽기 전용 전환 대상이 아니다(`isAuthFailure` false) |
| 인증 3코드 (설정 화면 안) | 여는 중이면 S2 규칙대로 전환 후 rooms. 저장 중이면 전환하되 **초안을 남기고** 저장 비활성·내보내기 허용(stale, R-SET-011) |
| `VALIDATION_ERROR` (400) | `message`가 §4.16 표의 첫 위반 1건이다. 이 코드는 `labels.ts` 고정 문구 대신 `message`를 그대로 보여도 된다(계약 문구). 사전 검사를 통과한 초안이면 정상적으로는 나오지 않는다 |
| `RATE_LIMITED` (429) | S2와 같다. 저장 1회 = 1회 소모. 판정 GET은 세지 않는다 |
| 사전 검사 | `checkCharacterSettings(draft)` — `issue.path`로 탭·필드를 찾고 `issue.message`를 보인다. 저장 버튼 활성 = dirty && 검사 통과 && !saving && !stale |
| 글자 수 | `countCodePoints(normalizeText(v))` / `max`(`WORLD_FIELD_SPEC`·`CHARACTER_FIELD_SPECS`). 목록 필드는 "한 줄에 하나" — 줄 나눔 뒤 trim·빈 줄 제거한 개수 / `maxItems`, 줄마다 `itemMax` |
| 저장 성공 | 응답 `settings`로 초안·기준값을 함께 바꾼다(서버가 정규화했다). `version`·`updatedAt`은 하단 줄 표시용이다. `isDefault`(= `version 0`)면 "기본값 사용 중" |
| 화면 이름 | 필드 라벨은 `CHARACTER_FIELD_SPECS[key].label`·`WORLD_FIELD_SPEC.label`을 쓴다(서버 400 문구와 같은 이름). `world` 필드 라벨은 `세계관`이고, 탭 이름("공통 세계관")은 `labels.ts` 몫이다(§15.12 결정 2) |
| 내보내기·가져오기 | §16 전부. 상수는 `@shared/settings` |

---

## 「contract-implementer 인계 목록」 (S3c — v0.5)

| 순서 | 파일 | 식별자 | 할 일 | 테스트 |
|---|---|---|---|---|
| 4a | `shared/src/errors.ts` · `shared/test/errors.test.ts` | `ERROR_CODES` · `ERROR_STATUS` · `ERROR_MESSAGES` | `OWNER_ONLY` 403·문구, `CONFIG_INVALID` 다음(§5.8.2) | API-T-040(갱신) · 049 |
| 4b | `shared/src/types.ts` | `CharacterSettingFields` · `CharacterSettings` · `CharacterSettingsResponse` · `PutCharacterSettingsBody` | §5.8.1 그대로 | tsc |
| 4c | 신규 `shared/src/settings.ts` · `shared/test/settings.test.ts` · `shared/test/settings-vectors.ts` | §5.8.4 전 식별자 | 전문 그대로. 벡터는 §4.16 표 13행 + 경계값(상한·상한+1·이모지·빈 필수·모르는 키·3번째 id) | API-T-105 ~ 107 |
| 4d | `shared/src/limits.ts` | — | **변경 없음** | — |
| 4e | `shared/src/endpoints.ts` · `shared/test/endpoints.test.ts` | `PATHS.characterSettings` · `endpoints.characterSettings` | §5.8.3 | API-T-042(갱신) · 104 |
| 6a | `server/src/routes/validate.ts` | `validate` | 선택 인자 `toMessage`(§11.12) | 기존 routes 테스트 회귀 |
| 6a | `server/src/routes/schemas.ts` | `putCharacterSettingsBody` · `settingsIssueMessage` · `SETTINGS_BODY_TOO_LARGE` | §11.12 | API-T-096 ~ 101 |
| 6a | 신규 `server/src/routes/settings.ts` · `routes/index.ts` · 신규 `server/test/routes-settings.test.ts` | `settingsRoutes` | §11.12. server 5단계(`requireOwner`·`characterSettingsSchema`·`services.settings`) 뒤 | API-T-091 ~ 103 |
| 6b | `ui/src/api/client.ts` | `RequestOptions` | `method`에 `'PUT'`, `auth` 주석. `AUTH_FAILURE_CODES` 불변 | 기존 ui/api 회귀 |
| 6c | 신규 `ui/src/api/settings.ts` · `ui/src/api/index.ts` · `ui/src/api/api.test.ts` | `getCharacterSettings` · `saveCharacterSettings` | §11.13 | API-T-UI-024 ~ 027 |
| 끝 | `doc/200_설계/contract/api.md` | §12.4 · §9 | 구현 후 실물로 대조표를 다시 채우고 §9에 "v0.5 구현" 행 | 리뷰 grep(§14.16) |

---

## 「contract-implementer 인계 목록」 (S3b — v0.4.1)