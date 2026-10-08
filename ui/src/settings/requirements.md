# settings(캐릭터 설정) 화면 — 요구 baseline

| 항목 | 값 |
|---|---|
| 화면 | settings (캐릭터 설정, 3번째 화면) · 폴더 `ui/src/settings/` |
| 요구 확정 상태 | **확정** |
| 확정일 | 2026-10-06 (승인 ① S3c — `doc/100_요구조건/requirements.md` §11-1 R-SET-001~012) · **2026-10-08 (승인 ① S3f — R-SET-013 신규, R-SET-004·005·007·009 개정)** |
| 이번 묶음 | **S3f** — 상세 대상 R-SET-013 · R-SET-009(개정), 소비 R-SET-004·005(개정), 불변 확인 R-SET-007(개정). 이전 묶음 S3c — 상세 R-SET-007·008·009·010·011, 영향 R-ROOMS-002·005 · R-CHAT-011 · R-NFR-004, 참조 R-SET-001~006·012 |
| 작업 모드 | 보강(maintain) — S3c: rooms·chat 구현 완료 위에 화면 1개 추가 + rooms 상단 바 변경(rooms CR-001). S3f: 설정 화면 「공통」 탭에 AI 모델 선택 추가(settings CR-001) |
| 소유 | ui-designer |

## 변경이력

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v1.0 | 2026-10-06 | 최초 작성. §11-1 R-SET 전사, 시나리오·계약·기술 기능·확정 문구 표 | S3c 승인 ① · 메인 세션 확정 결정(위임문) |
| v1.0.1 | 2026-10-06 | §5.6 `importNothing` 추가. 요구 원문 변경 없음 | ui-design-checker MINOR 7 |
| v1.0.2 | 2026-10-06 | §5.5 `invalid` 문구 재변경 — 계약 §16.2 문구 그대로: 마지막 저장값 위에 후보만 덮어 `checkCharacterSettings`, 첫 위반 `issue.message`를 그대로 표시(화면 조립 문구 없음). 요구 원문 변경 없음 | ui-design-checker HIGH-1 · HIGH-A · api.md v0.5 보정 2 |
| v1.0.3 | 2026-10-06 | labels.ts 실물과 대조. 문구 글자는 모두 일치. 키 표기만 실물로 정정: §5.2 `fieldIssueText(issue)`·§5.3 `statusText(status)`·§5.5 `importFailureText(failure)`의 kind·reason별 행, `labels` 객체 단일 export. §5.1 목록 필드 aria-label에 힌트 없음. §5.6 요약 구분자 `·` 앞뒤 공백 없음, `importNothing(ignoredCount)`. 요구 원문 변경 없음 | S3c 구현 동기화 · scenarios.md 가정 ③④⑦ |
| v1.0.4 | 2026-10-07 | §5 오류 표 아래 비고: 인증 3코드·`NETWORK` 문구의 단일 정의가 공용 `errorText.ts`로 바뀜(문장 불변). 요구 원문 변경 없음 | ui-postprocessor 후작업 · 사용자 승인 |
| v1.1 | 2026-10-08 | **S3f (CR-001).** §1.1 R-SET-013 원문 전사(신규) · R-SET-009·R-SET-007 개정 원문 전사(옛 행은 `폐기(CR-001로 대체)` 마킹, 삭제 안 함) · §1.2 R-SET-004·005 개정 원문 · §2 U-ST-03 탭 이름, U-ST-13 신규 · §3 계약 행(`model` 응답 · `saveCharacterSettings(settings, model?)`) · §5.1 탭 이름 「공통」·AI 모델 문구 6행 | S3f 승인 ①(2026-10-08 사용자 "승인") · `doc/200_설계/architecture/s3f-03-인계패킷.md` §3.1 |
| v1.1.1 | 2026-10-08 | §1.1 R-SET-013 상위 개정 문안 재전사(미선택 안내 = 응답 `model: null`일 때만, effectiveKey). v1.1 전사 행은 폐기 마킹. §3 계약 인용 api.md v0.8(§4.15·§4.16·§5.8.6·§11.17·§16.1)로 갱신 | 상위 `doc/100_요구조건/requirements.md` §11-1 R-SET-013 개정(사용자 승인 ① 2026-10-08) · ui-design-checker HIGH·MEDIUM |

---

## 1. 요구 목록 (원문 전사 — 추가·삭제·재해석 금지)

🔒 = 사용자 확정. 원문 소유는 `doc/100_요구조건/requirements.md` §11-1.

### 1.1 이 화면이 상세하는 요구

| ID | 🔒 | 요구(원문) | 수용 기준(원문) |
|---|---|---|---|
| ~~R-SET-007~~ (S3c 원문) | 🔒 | **폐기(CR-001로 대체, 2026-10-08)** — 내보내기: 화면이 마지막 저장값을 02 §4.3 형식(`format`·`formatVersion`·world·characters)으로 화이트리스트 직렬화. 파일 저장(Blob 다운로드) + 복사용 텍스트 영역 둘 다. 비밀값·version·updatedBy 0건. 인증 만료 시만 초안을 내보낸다. | 출력 키 집합 테스트, `apiKey\|API_KEY\|SECRET\|token` 0건. |
| R-SET-007 | 🔒 | 내보내기: 화면이 마지막 저장값을 02 §4.3 형식(`format`·`formatVersion`·world·characters)으로 화이트리스트 직렬화. 파일 저장(Blob 다운로드) + 복사용 텍스트 영역 둘 다. 비밀값·version·updatedBy 0건. 인증 만료 시만 초안을 내보낸다. (S3f 개정 2026-10-08 🔒) 모델 키는 내보내기 파일에 넣지 않고 가져오기로 바뀌지 않는다. | 출력 키 집합 테스트, `apiKey\|API_KEY\|SECRET\|token` 0건. |
| R-SET-008 | | 가져오기: 자체 형식 + E.No.S 부분집합(02 §4.4 매핑표). SETTINGS·chats·성인용 필드는 읽지 않는다. 초안만 바꾸고 저장은 별도. 상한 초과·모르는 형식은 거부(필드 표시). 파일 5MB 상한. | 변환 벡터 5종(자체·E.No.S 백업·world 단독·잘못된 형식·apiKey 포함 파일 → 초안에 키 0). |
| ~~R-SET-009~~ (S3c 원문) | 🔒 | **폐기(CR-001로 대체, 2026-10-08)** — 설정 화면 `ui/src/settings/`(3번째 화면): 탭 3(공통·세바스찬·시엘), 저장·되돌리기·내보내기·가져오기, 미저장 이탈 confirm, 390px·Rosebell. 진입 ⚙는 rooms 상단 바에 **주인일 때만 렌더**(미렌더). 「기본값으로 되돌리기」(시드 복원) 없음. | 비주인·읽기 전용 ⚙ DOM 부재 TC. 3탭·시트 2종 스크린샷. |
| R-SET-009 | 🔒 | 설정 화면 `ui/src/settings/`(3번째 화면): 탭 3(「공통」·세바스찬·시엘 — S3f 개정 2026-10-08 🔒: 첫 탭 이름 「공통 세계관」→「공통」, 공통 탭 = 「AI 모델」 선택(맨 위, Pro/Flash 라디오) + 세계관), 저장·되돌리기·내보내기·가져오기, 미저장 이탈 confirm, 390px·Rosebell. 진입 ⚙는 rooms 상단 바에 **주인일 때만 렌더**(미렌더). 「기본값으로 되돌리기」(시드 복원) 없음. | 비주인·읽기 전용 ⚙ DOM 부재 TC. 3탭·시트 2종 스크린샷. |
| R-SET-010 | | 주인 판정: 토큰이 있을 때 App이 1회 GET(R-SET-004)으로 판정(200만 주인). 실패(401·403·네트워크)는 조용히 ⚙ 미표시. **판정 결과로 읽기 전용 전환(revokeWrite)하지 않는다**(R-CHAT-011 규칙 불변). | 403·401 수신 후에도 canWrite 유지 TC. |
| R-SET-011 | | 인증 만료 중 저장 실패(401) 시 초안 보존(stale)·내보내기 허용. | TC. |
| ~~R-SET-013~~ (v1.1 전사) | 🔒 | **폐기(상위 요구 개정으로 대체, 2026-10-08 · CR-001)** — 갠홈 주인이 설정 화면 「공통」 탭 맨 위에서 AI 모델을 Pro·Flash 중 하나로 고르고 기존 「저장」으로 저장한다. 다음에 시작하는 발화·화자 선택·요약 호출부터 적용, 진행 중 호출은 이전 모델. 고른 적 없으면 서버 기본값(env `LLM_MODEL`)을 쓰고 화면은 미선택 안내 문구. 모델만 바꿔도 dirty·되돌리기·이탈 확인이 동작하고 저장 시 version+1(시드 상태면 `isDefault: false`). 설명 문구에 가격 숫자 없음. 저장 중 라디오 비활성. | (아래 행과 같음) |
| R-SET-013 | 🔒 | **(S3f, 2026-10-08 사용자 지정)** 갠홈 주인이 설정 화면 「공통」 탭 맨 위에서 AI 모델을 Pro·Flash 중 하나로 고르고 기존 「저장」으로 저장한다. 다음에 시작하는 발화·화자 선택·요약 호출부터 적용, 진행 중 호출은 이전 모델. 고른 적 없으면 서버 기본값(env `LLM_MODEL`)을 쓴다. 화면은 응답 `model`(지금 실제로 쓰는 키)을 선택된 판으로 보이고, `model: null`(서버 기본값이 두 후보 밖)일 때만 미선택 안내 문구(02 §2.2 effectiveKey — "저장된 Pro"와 "기본값 Pro"는 구분하지 않는다, 사용자 승인 ① 2026-10-08). 모델만 바꿔도 dirty·되돌리기·이탈 확인이 동작하고 저장 시 version+1(시드 상태면 `isDefault: false`). 설명 문구에 가격 숫자 없음. 저장 중 라디오 비활성. | 저장 → 다음 speak 요청 URL에 고른 모델명(fetch 주입). 화면 TC: 세 판(pro·flash·null) 렌더 · 선택 → 저장 본문 `model` · 본체만 저장 시 `model` 키 없음 · 되돌리기 · 이탈 확인 · 저장 중 비활성 · 내보내기 파일 `model` 0건. |

### 1.2 서버·계약 쪽 요구 (참조 — 화면은 결과 코드·응답으로만 안다)

| ID | 🔒 | 화면이 아는 부분 | 원문 소유 · 계약 |
|---|---|---|---|
| R-SET-001 | 🔒 | 주인이 아니면 E15·E16이 `403 OWNER_ONLY`. 화면은 주인 목록을 모른다 | §11-1 · api.md §2.7 |
| R-SET-002 | 🔒 | 필드 11개 × 2명 + `world`, 필수 3종, 상한. 화면은 `@shared/settings` 상수·`checkCharacterSettings`로 같은 규칙을 쓴다 | §11-1 · api.md §5.8.4 |
| R-SET-003 | 🔒 | 저장값 없으면 시드(`isDefault: true`, `version 0`). 저장마다 version 증가. 화면은 표시에만 쓴다 | §11-1 · api.md §4.15·§4.16 |
| R-SET-004 | 🔒 | E15 `GET /api/settings/characters`(토큰·주인 필수). (S3f 개정 2026-10-08 🔒) 응답에 `model`(지금 쓰는 모델 키 `'pro'`·`'flash'`, 두 후보 밖이면 `null`) | §11-1 · api.md §4.15 |
| R-SET-005 | 🔒 | E16 `PUT` 전체 교체, 정규화 값 반환, 레이트리밋, 400 = 첫 위반 1건 문구. (S3f 개정 2026-10-08 🔒) 본문 `model?: 'pro' \| 'flash'`(없으면 저장값 유지, `null`·그 밖 값은 400 `공통 · AI 모델 값이 올바르지 않습니다.`, `settings` 검사 뒤) | §11-1 · api.md §4.16 |
| R-SET-006 | 🔒 | `outputRules`·GUARD_RULES 편집 불가 → 화면에 그 필드가 없다 | §11-1 |
| R-SET-012 | | 서버 로그 규칙. 화면은 설정 본문·파일 내용을 `console`에 남기지 않는다(api.md §16.4) | §11-1 |

### 1.3 이 화면에 걸리는 다른 절의 요구 (참조)

| ID | 🔒 | 이 화면에 걸리는 부분(원문 발췌) | 원문 소유 |
|---|---|---|---|
| R-ROOMS-002 | 🔒 | 「+ 새 방」은 토큰 있을 때만 렌더 — ⚙가 같은 상단 바 오른쪽 슬롯에 들어간다(「+ 새 방」 왼쪽) | `ui/src/rooms/requirements.md` |
| R-ROOMS-005 | 🔒 | 폭 390px, 높이 약 565px, Rosebell 토큰, CSS Modules — 설정 화면에도 같다 | `ui/src/rooms/requirements.md` |
| R-CHAT-011 | | `LEVEL_TOO_LOW`·`TOKEN_INVALID`(쓰기 UI를 읽기 전용으로 전환하고 안내) — 설정 화면을 열거나 저장할 때의 인증 실패에 그대로 적용. **주인 판정 탐침에는 적용하지 않는다**(R-SET-010) | `ui/src/chat/requirements.md` |
| R-CHAT-009 | 🔒 | 토큰은 메모리에만. 설정 화면은 토큰을 읽지도 저장하지도 않는다(래퍼가 헤더를 붙인다) | `ui/src/chat/requirements.md` |
| R-NFR-004 | 🔒 | 비밀값·토큰 원문이 로그·응답·번들에 없다 — 내보내기 파일·가져오기 결과에도 비밀값 0 | `doc/100_요구조건/requirements.md` §12 |

---

## 2. 사용자·이용 시나리오 명세

대상은 둘뿐이다. 설정 화면은 「등급 통과 회원(토큰 있음)」 중 **갠홈 주인**(R-SET-001, 서버가 판정)만 쓴다. 「비회원·등급 미달 방문자(읽기 전용)」와 주인이 아닌 등급 회원에게는 진입 ⚙가 DOM에 없다.

| # | 대상 | 상황(언제·왜) | 사용 기능 | 요구ID |
|---|---|---|---|---|
| U-ST-01 | 비회원·등급 미달 방문자(읽기 전용) | 방 목록을 본다 | ⚙ 미렌더, 판정 요청도 없다 | R-SET-009 · R-SET-010 |
| U-ST-02 | 등급 통과 회원(토큰 있음) — 주인 아님 | 방 목록을 본다 | 판정 GET 1회가 403·401·네트워크 실패 → ⚙ 미렌더. 「+ 새 방」·쓰기는 그대로(전환 없음, 안내 없음) | R-SET-010 · R-CHAT-011 · R-ROOMS-002 |
| U-ST-03 | 등급 통과 회원 — 주인 | 캐릭터 말투·설정을 고치고 싶다 | ⚙ → 설정 화면(「공통」 탭부터) → 탭 3 편집 → 저장 | R-SET-009 · R-SET-010 · R-SET-005 |
| U-ST-04 | 주인 | 고치다가 글자 수를 넘기거나 필수 칸을 비웠다 | 카운터·필드 안내·탭 표시·저장 비활성·하단 줄 첫 위반 문구 | R-SET-009 · R-SET-002 · R-SET-005 |
| U-ST-05 | 주인 | 고친 것이 마음에 들지 않는다 | 「되돌리기」 → 마지막 저장값 | R-SET-009 |
| U-ST-06 | 주인 | 저장하지 않고 ‹ 뒤로를 눌렀다 | 이탈 확인 시트(취소·나가기) | R-SET-009 |
| U-ST-07 | 주인 | 설정을 백업하거나 다른 곳에 옮기고 싶다 | ⋯ → 설정 파일 → 내보내기(파일로 저장 + 복사용 텍스트) | R-SET-007 · R-NFR-004 |
| U-ST-08 | 주인 | 백업 파일이나 E.No.S 파일로 채우고 싶다 | ⋯ → 가져오기(파일 선택·붙여넣기) → 초안 반영 + 요약 → 직접 저장 | R-SET-008 · R-NFR-004 |
| U-ST-09 | 주인 → 인증 만료 | 오래 열어 둔 화면에서 저장했더니 토큰이 만료됐다 | 초안 보존(stale) · 저장·되돌리기·가져오기 비활성 · 내보내기(초안) 허용 · 안내 줄 · 앱 전체는 읽기 전용으로 전환 | R-SET-011 · R-SET-007 · R-CHAT-011 |
| U-ST-10 | 주인 → 주인 아님 | 열거나 저장하는 사이 주인 목록에서 빠졌다 | 안내 후 방 목록으로, ⚙ 사라짐(읽기 전용 전환 없음) | R-SET-001 · R-SET-010 |
| U-ST-11 | 주인 | 설정을 여는데 서버에 닿지 않는다 | 로딩 · 오류 + 다시 시도 | R-SET-009 · R-SET-004 |
| U-ST-12 | 주인 | 저장이 과다 요청·서버 오류로 거절됐다 | 초안 유지 + 코드별 안내 토스트 | R-SET-005 · R-CHAT-011 |
| U-ST-13 | 주인 | 대답 품질·속도·비용을 맞추려고 AI 모델을 바꾸고 싶다(또는 아직 고른 적이 없다) | 「공통」 탭 맨 위 「AI 모델」에서 Pro·Flash 고르기 → 하단 줄 dirty → 기존 「저장」(본체와 함께) · 되돌리기 · 미저장 이탈 확인 · 미선택 안내. 내보내기·가져오기는 모델과 무관 | R-SET-013 · R-SET-009 · R-SET-004 · R-SET-005 · R-SET-007 |

- (S3f) U-ST-13은 R-SET-013을, U-ST-03·U-ST-13은 개정 R-SET-009(탭 이름 「공통」)를 매핑한다.
- 모든 상세 요구(R-SET-007~011)와 영향 요구(R-ROOMS-002·005는 §1.3 화면 규격, R-CHAT-011·R-NFR-004)가 1행 이상에 매핑된다. R-ROOMS-005는 화면 전체 규격이라 design.md §2·§11에 매핑한다.

---

## 3. 데이터 계약 요구 명세

계약 실체는 `doc/200_설계/contract/api.md` **v0.8**가 소유한다(S3f 해당 절 §4.15 · §4.16 · §5.8.6 · §11.17 · §16.1). 이 표는 이 화면의 필요만 적는다.

| 필요 | 메서드·경로 | 요청 | 응답 | 토큰 | 래퍼(`@/api`) | 재사용/신규 |
|---|---|---|---|---|---|---|
| 주인 판정 · 설정 읽기 | `GET /api/settings/characters` (E15) | 없음 | `200 CharacterSettingsResponse` | ○ + 주인 | `getCharacterSettings(): Promise<Result<CharacterSettingsResponse>>` | **신규 확정** — api.md §4.15 · §11.13(contract 구현 대기) |
| 설정 저장(전체 교체) | `PUT /api/settings/characters` (E16) | `PutCharacterSettingsBody = { settings }` | `200 CharacterSettingsResponse`(정규화 값) | ○ + 주인 | `saveCharacterSettings(settings): Promise<Result<CharacterSettingsResponse>>` | **신규 확정** — api.md §4.16 · §11.13 |
| (S3f) 모델 키 읽기 | 같은 E15 | 없음 | `CharacterSettingsResponse.model: LlmModelKey \| null` 추가(`LlmModelKey = 'pro' \| 'flash'`, `@shared/types`) | ○ + 주인 | `getCharacterSettings()` 그대로 | **기존 확장(비파괴)** — api.md v0.8 §4.15 · §5.8.6 |
| (S3f) 모델 키 저장 | 같은 E16 | `PutCharacterSettingsBody.model?: LlmModelKey` — 없으면 서버 저장값 유지 | 같음(`model` = 저장 뒤 지금 쓰는 키) | ○ + 주인 | `saveCharacterSettings(settings, model?: LlmModelKey)` — `model`이 `undefined`면 본문에 키 없음 | **기존 확장(비파괴)** — api.md v0.8 §4.16 · §5.8.6 · §11.17. contract-implementer가 `ui/src/api/settings.ts`를 바꾼다 |
| 인증 실패 판정 | (엔드포인트 아님) | — | `isAuthFailure(error)` — `OWNER_ONLY`는 false | — | `isAuthFailure` | **재사용** — api.md §2.4 · §3.2 |
| 필드 규칙·사전 검사·파일 상수 | (엔드포인트 아님) | — | `CHARACTER_FIELD_SPECS` · `CHARACTER_FIELD_KEYS` · `WORLD_FIELD_SPEC` · `SETTINGS_CHARACTER_IDS` · `SETTINGS_FILE_FORMAT` · `SETTINGS_FILE_FORMAT_VERSION` · `SETTINGS_IMPORT_MAX_BYTES` · `checkCharacterSettings` · `settingsScopeOf` · 타입 `CharacterSettings`·`CharacterSettingsResponse`·`CharacterSettingsFile`·`SettingsIssue` | — | `@shared/settings` · `@shared/types` | **신규 확정** — api.md §5.8.4(contract 구현 대기) |
| 내보내기 파일 형식 · 가져오기 판별·E.No.S 매핑 | (화면 쪽 규칙) | — | — | — | `ui/src/state/settingsFile.ts`(ui 구현) | 정본 api.md §16 — 인용 |

- 미확정 계약 없음. 새 엔드포인트 요구 없음.
- (S3f) 두 `model` 행은 api.md v0.8 §4.15 · §4.16 · §5.8.6 · §11.17이 정본이다. 화면은 그 형태를 그대로 쓴다. 내보내기 파일 형식은 바뀌지 않는다(api.md v0.8 §16.1 · R-SET-007 개정: 모델 키 없음).

---

## 4. 확보한 기술 기능

`ui/package.json` 기준. **새 라이브러리 없음.**

| 기능 | 수단 | 비고 |
|---|---|---|
| 파일로 저장 | `Blob` · `URL.createObjectURL` · `a.download`(브라우저 내장) | iframe sandbox에 `allow-downloads`가 없으면 막힐 수 있다 → 복사용 텍스트 영역이 대체 경로(api.md §16.1) |
| 파일 읽기 | `FileReader.readAsText` · `File.size` | 5MB(`SETTINGS_IMPORT_MAX_BYTES`) 넘으면 읽지 않는다 |
| 붙여넣기 바이트 수 | `TextEncoder` | UTF-8 바이트 |
| JSON | `JSON.parse` · `JSON.stringify(_, null, 2)` | 내장 |
| 글자 수 | `countCodePoints` · `normalizeText`(`@shared/limits`) | 서버와 같은 셈 |
| 테스트 | vitest · jsdom · @testing-library/react · user-event | `URL.createObjectURL`은 jsdom에 없어 `vi.stubGlobal`·`Object.defineProperty`로 모킹 |

---

## 5. 확정 문구 표 (`ui/src/settings/labels.ts` 단일 소스)

필드 라벨은 labels.ts에 두지 않는다. `CHARACTER_FIELD_SPECS[key].label`·`WORLD_FIELD_SPEC.label`을 그대로 쓴다(서버 400 문구와 같은 이름, api.md 「ui 인계 메모」 S3c).

### 5.1 화면·탭·필드

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `screenTitle` | `캐릭터 설정` | 상단 바 h1 · `<main aria-label>` |
| `backAriaLabel` | `뒤로` | ‹ IconButton |
| `fileMenuAriaLabel` | `설정 파일 메뉴` | ⋯ IconButton |
| `tabListAriaLabel` | `설정 묶음` | Tabs `role=tablist` |
| `tabLabel.world` · `.sebastian` · `.ciel` | `공통` · `세바스찬` · `시엘` | 탭 글자. 캐릭터 탭은 `CHARACTERS[id].shortName`과 같은 값(테스트로 확인). (v1.1 S3f) `world` 탭 글자 `공통 세계관` → `공통`(R-SET-009 개정). 탭 id `'world'`는 바꾸지 않는다 |
| `modelLegend` | `AI 모델` | (S3f) 공통 탭 맨 위 `<legend>` 보이는 글자 = 묶음 접근성 이름 |
| `modelOption.pro.name` · `modelOption.pro.description` | `Pro` · `더 정교하지만 느리고 비용이 큼` | (S3f) 라디오 1행. 이름 = 라디오 접근성 이름, 설명 = `aria-describedby`. 가격 숫자 없음(R-SET-013) |
| `modelOption.flash.name` · `modelOption.flash.description` | `Flash` · `빠르고 비용이 적음` | (S3f) 라디오 2행. 같은 규칙 |
| `modelNoteSelected` | `저장하면 다음 대답부터 이 모델을 씁니다.` | (S3f) 안내 줄(sm muted). `modelDraft`가 `'pro'`·`'flash'`일 때 |
| `modelNoteUnset` | `아직 고르지 않았습니다. 지금은 서버 기본 모델을 씁니다.` | (S3f) 안내 줄(sm muted). `modelDraft`가 `null`일 때(미선택 판) |
| `tabIssueSuffix` | `, 확인할 항목 있음` | 탭 `!` 표시가 있을 때 탭 접근성 이름 뒤에 붙음 |
| `groupBasic` · `groupPersona` · `groupSpeech` | `기본 정보` · `인물` · `말투·규칙` | 캐릭터 탭 묶음 소제목 |
| `requiredMark` | `*` | 필수 필드 라벨 뒤(보이는 글자, `aria-hidden`) |
| `requiredAria(label)` | `` `${label}, 필수` `` | 필수 필드 입력 `aria-label` |
| `listHint(maxItems)` | `` `(한 줄에 하나, 최대 ${maxItems})` `` | 목록 필드 보이는 라벨 뒤. 입력 `aria-label`에는 넣지 않는다(목록 필드 이름 = `샘플 대사`·`규칙·금기`, 필수 아님) |
| `lineCounter(n, max)` | `` `${n}/${max}줄` `` | 목록 필드 라벨 줄 오른쪽 |

- labels.ts는 `labels` 객체 하나만 export한다. 아래 문구 함수도 그 멤버다(`labels.fieldIssueText(…)` 등).

### 5.2 필드 아래 안내 (한 줄, danger) — `fieldIssueText(issue: FieldIssue)`

| `issue.kind` | 문구 | 조건 |
|---|---|---|
| `required` | `필수 항목입니다.` | 필수 글 필드 trim 후 0자 |
| `tooLong` | `` `${max}자 이하로 줄여 주세요.` `` | 글 필드 상한 초과 |
| `tooManyLines` | `` `${maxItems}줄 이하로 줄여 주세요.` `` | 목록 필드 빈 줄 제거 뒤 줄 수 초과 |
| `lineTooLong` | `` `${lineNo}번째 줄이 ${itemMax}자를 넘습니다.` `` | 목록 항목 길이 초과(첫 번째 넘은 줄, 빈 줄 제거 뒤 번호) |

### 5.3 하단 줄 D — `statusText(status: SettingsStatus)`

| `status.kind` | 문구 | 상태 |
|---|---|---|
| `saved` | `` `v${version} 저장됨 ${formatMonthDay(updatedAt)} ${formatTime(updatedAt)}` `` | clean · `isDefault` false |
| `default` | `기본값 사용 중` | clean · `isDefault` true |
| `dirty` | `저장하지 않은 변경 있음` | dirty · 사전 검사 통과 (warning 색) |
| `invalid` | `checkCharacterSettings` 첫 위반 `issue.message` 그대로 | dirty · 사전 검사 실패 (danger 색). 예: `시엘 · 말투는 1~800자여야 합니다.` |
| `saving` | `저장 중...` | saving |
| `stale` | `인증 만료` | stale (danger 색) |
| `revert` · `save` | `되돌리기` · `저장` | 버튼 |

### 5.4 시트

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `fileMenuTitle` | `설정 파일` | ① 메뉴 시트 머리·aria-label |
| `exportItem` · `importItem` · `cancel` | `내보내기` · `가져오기` · `취소` | ① 항목 |
| `exportTitle` | `내보내기` | ② 머리·aria-label |
| `exportDirtyNote` | `저장하지 않은 변경은 포함되지 않습니다.` | ② dirty·비stale일 때 안내(sm muted) |
| `exportStaleNote` | `인증이 만료되어 현재 초안을 내보냅니다.` | ② stale일 때 안내(danger) |
| `exportTextAriaLabel` | `내보낼 설정 JSON` | ② 읽기 전용 TextArea |
| `close` · `saveFile` | `닫기` · `파일로 저장` | ② 버튼 |
| `importTitle` | `가져오기` | ③ 머리·aria-label |
| `chooseFile` | `파일 선택` | ③ FilePicker 버튼 |
| `noFileChosen` | `선택한 파일 없음` | ③ 파일 이름 자리 |
| `pasteLabel` | `또는 JSON 붙여넣기` | ③ 라벨 · TextArea `aria-label` |
| `importNote` | `초안에만 반영되고 저장은 따로 합니다.` | ③ 안내(sm muted) |
| `importSubmit` | `불러오기` | ③ primary |
| `leaveTitle` | `저장하지 않은 변경이 있습니다` | ④ ConfirmDialog title |
| `leaveMessage` | `나가면 고친 내용이 사라집니다. 나갈까요?` | ④ message |
| `leaveConfirm` · (취소 = `cancel`) | `나가기` | ④ danger |

### 5.5 가져오기 거부 사유 (③ 오류 줄, `role=alert`) — `importFailureText(failure: ImportFailure)`

| `failure.reason` | 문구 |
|---|---|
| `tooLarge` | `파일이 5MB를 넘어 읽지 않았습니다.` |
| `readFailed` | `파일을 읽지 못했습니다.` |
| `notJson` · `unknownFormat` | `알 수 없는 파일 형식입니다.` |
| `unsupportedVersion` | `지원하지 않는 파일 버전입니다.` |
| `noMatchingWorld` | `세바스찬·시엘이 들어 있는 세계를 찾지 못했습니다.` |
| `invalid` | 후보 검사(마지막 저장값 위에 후보만 덮어 `checkCharacterSettings`, state.md SF-05)의 `issue.message` 그대로. 위반은 늘 후보 필드에서 나오고 앞머리가 어느 탭·필드인지 말한다. 예: `시엘 · 말투는 1~800자여야 합니다.` |

### 5.6 토스트·안내

| 키 | 문구 | 톤 | 조건 |
|---|---|---|---|
| `saved` | `저장했습니다. 다음 대사부터 반영됩니다.` | success | 저장 성공 |
| `importSummary(s)` | `` `가져왔습니다(${범위}). 무시한 항목 ${n}개. 저장해야 반영됩니다.` `` — 범위 = 반영된 것만 `공통 1`·`세바스찬 {k}`·`시엘 {k}`를 `·`로 잇는다(앞뒤 공백 없음, 예 `가져왔습니다(공통 1·세바스찬 8·시엘 8). 저장해야 반영됩니다.`). 무시 0이면 가운데 문장 생략 | success | 가져오기 성공 |
| `importNothing(ignoredCount)` | `가져올 항목이 없습니다.` | warning | 가져오기 성공이지만 후보가 0개(`applied` 전부 0·false, 초안 변경 없음). 무시 항목이 있으면 `` `가져올 항목이 없습니다. 무시한 항목 ${n}개.` `` |
| `fileSaveFailed` | `파일로 저장하지 못했습니다. 위 글을 복사해 주세요.` | warning | `downloadText` 예외 |
| `saveErrorText(error)` | 아래 §5.7 | §5.7 | 저장 실패 |
| `loadError` | `설정을 불러오지 못했습니다` | — | StateView error 제목 |
| `loadErrorDetail(code)` | `NETWORK` → `서버에 연결할 수 없습니다.` · 그 밖 → `ERROR_MESSAGES[code]` | — | StateView error 상세 |
| `loading` · `retry` | `설정을 불러오는 중` · `다시 시도` | — | StateView |
| `staleNotice` | `인증이 만료되었습니다. 내보내기로 변경을 보관한 뒤 새로 고쳐 주세요.` | — | F 안내 줄(`role=alert`, danger) |

### 5.7 오류 코드별 안내 (설정 화면 · rooms로 넘기는 안내)

| 코드 | 열 때(E15) | 저장할 때(E16) |
|---|---|---|
| `OWNER_ONLY` (403) | rooms 토스트 warning `캐릭터 설정은 갠홈 주인만 열 수 있습니다.`(`ownerOnly`) + ⚙ 사라짐 | 같음(초안 버림) |
| `TOKEN_REQUIRED` (401) | rooms 토스트 warning `로그인 정보가 없어 열람 전용으로 바뀌었습니다.` + 읽기 전용 전환 | stale + F 안내 줄(토스트 없음) + 읽기 전용 전환 |
| `TOKEN_INVALID` (401) | rooms 토스트 warning `인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.` + 전환 | 위와 같음 |
| `LEVEL_TOO_LOW` (403) | rooms 토스트 warning `대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.` + 전환 | 위와 같음 |
| `RATE_LIMITED` (429) | (E15는 세지 않아 나오지 않음 — 나오면 아래 "그 밖") | 토스트 warning `` `요청이 너무 많습니다. ${retryAfterSec}초 후 다시 시도해 주세요.` ``, 값 없으면 `ERROR_MESSAGES.RATE_LIMITED` |
| `VALIDATION_ERROR` (400) | (요청 본문 없음 — 나오면 "그 밖") | 토스트 danger = 서버 `error.message` 그대로(계약 문구, §4.16 첫 위반) |
| `NETWORK` | StateView error + 상세 `서버에 연결할 수 없습니다.` | 토스트 danger `서버에 연결할 수 없습니다.` |
| `CONFIG_INVALID` · `INTERNAL` · 그 밖 | StateView error + 상세 `ERROR_MESSAGES[code]` | 토스트 danger `ERROR_MESSAGES[code]` |

- labels.ts 키: `ownerOnly`(OWNER_ONLY 문구) · `authText(code)`(인증 3코드, 열 때 rooms로 넘김) · `saveErrorText(error)`(저장 열) · `loadErrorDetail(code)`(열 때 StateView 상세).
- 인증 3코드 문구는 rooms `writeErrorText`와 같은 문장이다. (v1.0.4) 후작업 2026-10-07부터 단일 정의는 공용 `ui/src/components/utils/errorText.ts`(`AUTH_FAILURE_TEXT`·`NETWORK_TEXT`)이고 rooms·chat·settings `labels.ts`가 import한다(옛 "두 labels에 같은 행" 규칙 대체).
- `VALIDATION_ERROR`만 서버 `message`를 쓴다(api.md 「ui 인계 메모」 S3c). 그 밖은 `code`로 정한다.
