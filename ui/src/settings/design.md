# settings(캐릭터 설정) 화면 — 상세 설계

## 1. 개요

| 항목 | 값 |
|---|---|
| 화면 | settings · 폴더 `ui/src/settings/` (3번째 화면, 갠홈 주인 전용) |
| 목적 | 갠홈 주인이 공통 세계관과 두 캐릭터(세바스찬·시엘)의 설정을 탭 3개로 고쳐 저장하고, 설정을 파일로 내보내거나 가져온다. 저장하면 다음 대사부터 반영된다 |
| 요구 | `ui/src/settings/requirements.md` v1.0.3(확정) — 상세 R-SET-007~011, 영향 R-ROOMS-002·005 · R-CHAT-011 · R-NFR-004 |
| 구성안 | `doc/200_설계/architecture/ui-layout-02-settings.md` — **수용**(M1 변형 + S1 시트 4종, rooms L1 ⚙). 구성안 미해결 질문 1~3은 메인 세션 결정으로 닫음(§11) |
| 계약 | `doc/200_설계/contract/api.md` **v0.5** §2.7 · §3.2(`OWNER_ONLY`) · §4.15 E15 · §4.16 E16 · §5.8 · §11.13 · §16 · 「ui 인계 메모」 S3c — 확정(contract 구현 대기) |
| 묶음 | S3c (보강 모드). rooms 델타는 `ui/src/rooms/design.md` v1.6 · CR-001 |
| 레이아웃 확정 상태 | **확정**(ready · loading · error · stale · 시트 4종 · rooms ⚙) |
| 문서 분할 | `design/components.md`(트리·Props·스타일) · `design/state.md`(상태·순수 함수·리듀서·파일 형식 함수) · `design/functions.md`(F-ST·파이프라인) · `design/a11y.md`. 문구는 `requirements.md` §5. RTM은 이 문서 §14 |
| 공용 요소 | 단일 정의는 `ui/src/rooms/design/components.md` §1. S3c 공용 델타 2건(IconButton `settings`, ToastTone `success`)도 거기 적었다 |

비유: 설정 화면은 극단의 대본 서랍이다. 서랍 열쇠(주인 판정)는 서버만 확인한다. 화면은 대본을 연필로 고치고(초안), 「저장」으로 서버에 새 판을 맡긴다. 복사본(내보내기)은 언제든 뽑을 수 있고, 다른 극단 대본(E.No.S)은 쓸 만한 대목만 옮겨 적는다.

### 변경이력

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v1.0 | 2026-10-06 | 최초 작성(S3c). 4개 분할 문서. TC-ST-001~038 예약 | S3c 인계 패킷 §3.2 · 메인 세션 확정 결정 |
| v1.1 | 2026-10-06 | 검증 반영: 가져오기 분류 3종·무시 계수(SF-07·09 한 곳)·후보 검사 = 마지막 저장값 + 후보 → `checkCharacterSettings`(D-ST-11, api.md 보정 2)·후보 0개 처리 · 보정 벡터 6행(state.md §3.3, TC-ST-041) · 저장 뒤·시트 닫힘 포커스 · 타입 `ReadyState`·`ImportSuccess`·`ImportFailure` · counterMode·최소 줄 · stale+토스트 배분 · §2.1 확정 라벨 · §7 8종. TC-ST-024·026·029·035 기대 갱신, TC-ST-039·040 추가. Toast `success` 승인 | ui-design-checker FAIL(HIGH 1 · MINOR 10) · 메인 세션 결정 |
| v1.2 | 2026-10-06 | 재검증 반영: 가져오기 규칙 정본 = api.md §16.2·§16.3 문구. S-15를 `checkPatchedSettings`(덮기 + `checkCharacterSettings`)로 재정의, 필수 빈 값도 거부, 화면 조립 거부 문구 폐기 · "값 있음" = 키 있음·`undefined`·`null` 아님, E.No.S trim 뒤 빈 값 = 없음 · `importFailureText(ImportFailure)` 호출 통일 · RTM·state.md §2.4에 S-15. TC-ST-026·035·041 기대 갱신 | ui-design-checker 재검증 FAIL(HIGH-A·B · LOW 1·2) · 메인 세션 결정 |
| v1.2.1 | 2026-10-06 | **구현 동기화(동작·문구 변경 없음).** 실물 분해 ReadyBody·SheetLayer·`useSettingsUi`·`useImportForm`·`state/settingsCandidate.ts`, 훅 반환·props·시트 실측 높이 반영(C §1·§2·§5 · S 머리말·§1 · F §1 · A §1). 시나리오 가정 Q1~Q7 확정(C §5.3). §7 mock 표기 `@/api/settings` · §14 R-SET-010 TC 합집합. TC-ST-024·026·029·035 기대 변경과 039·040·041 신규가 §14에 들어 있음을 확인 | S3c 구현 보고 · scenarios.md v0.1 Q1~Q7 · result.md(ui 592/592) · 캡처 `doc/300_검증/screenshots/20261006-2033/` |
| v1.2.2 | 2026-10-07 | **후작업 동기화(동작·문구 변경 없음)**: `NETWORK`·인증 3코드 문구를 공용 `errorText.ts`에서 import(§8 비고 · §13 행 "공용화 완료"). `ui/src/state/settingsCandidate.ts` 주석 정정은 문서 영향 없음(확인) | ui-postprocessor 후작업 · 사용자 승인 |

---

## 2. 레이아웃 (ASCII, 390px 기준 약 48칸) [확정]

구성안 §1·§3·§5·§6을 그대로 쓴다. 아래는 확정 문구를 넣은 대표 판이다. `[*]`·`...`·`!` 표기는 구성안 규칙.

### 2.1 ready (세바스찬 탭 · 필수 빈 칸 있음)

```
+----------------------------------------------+
| <  캐릭터 설정                           ... |  A 44
+----------------------------------------------+
|  공통 세계관    [ 세바스찬 ! ]     시엘      |  B 40  (role=tablist, 선택 = 아래 2px)
+----------------------------------------------+
| 기본 정보                                    |  C flex 445 (스크롤)
| 원작·장르                                    |
| [흑집사                                3/60] |
| 나이                   성별                  |
| [               0/40]  [               0/20] |
| 신분·직업                                    |
| [집사                                  2/80] |
| 인물                                         |
| 성격·배경 *                                  |
| +------------------------------------------+ |
| |                                          | |
| +------------------------------------------+ |
| 필수 항목입니다.                      0/1500 |  안내 줄(danger) · 카운터
+----------------------------------------------+
| 세바스찬 · 성격·배경은 1~1500자여야 합니다. [되돌리기] [저장] |  D 36 (첫 위반 문구 danger, 실제 폭에서는 말줄임, 저장 비활성)
+----------------------------------------------+
```

### 2.2 상태 변형

| 상태 | 판 | 근거 |
|---|---|---|
| loading | A(‹만) + StateView `설정을 불러오는 중` 521 | 구성안 §6 |
| error | A(‹만) + StateView `설정을 불러오지 못했습니다` + 상세 + 「다시 시도」 | 구성안 §6 |
| clean | D `v3 저장됨 10.06 14:20` / `기본값 사용 중`, 두 버튼 비활성 | 구성안 §3 |
| dirty | D `저장하지 않은 변경 있음`(warning), 되돌리기 활성, 저장은 사전 검사 통과 시 | 구성안 §3 |
| saving | D `저장 중...`, ‹·⋯·되돌리기·저장 비활성, 입력 readOnly | 구성안 §3 + §4 D-ST-3 |
| stale | F 안내 줄 40 + D `인증 만료`(danger), 저장·되돌리기 비활성, ⋯ 유지(① 가져오기 비활성) | 구성안 §6 + 메인 세션 결정 |
| 토스트 | D 바로 위 E 28, C가 28 줄어든다 | 구성안 §1-2 |
| 시트 ①~④ | 구성안 §5(약 188 · 280 · 324/360 · 148px). 실측 ② 약 268 · ③ 약 262(C §5.4) | 구성안 §5 · TC-ST-037 |

세로 배분 표는 `design/components.md` §4.

---

## 3. 컴포넌트 → `design/components.md`

요약: SettingsScreen(조립) · 공용 TopBar·IconButton(back·more)·StateView·TextInput·TextArea·Button·BottomSheet·SheetItem·ConfirmDialog·Toast · 로컬 **Tabs · FormField · FilePicker · StaleNotice**(승격 후보는 앞 셋) · 로컬 ReadyBody·SheetLayer·WorldForm·CharacterForm·StatusBar·FileMenuSheet·ExportSheet·ImportSheet · 훅 `useSettingsEditor`·`useSettingsUi`·`useImportForm` · 유틸 `download.ts`. 실물 파일 목록은 C §5.1.

## 4. 상태 → `design/state.md`

요약: `SettingsState`(loading · error · ready{base, draft, isSaving, isStale}) 리듀서(T-01~T-10)는 `ui/src/state/settings.ts`. 초안 = 목록 필드를 "한 줄에 하나" 문자열로 든 `SettingsDraft`. dirty = 정규화 비교(S-06). 저장 활성 = dirty && 사전 검사 통과 && !saving && !stale(S-11). 화면 로컬 `activeTab`(초기 `'world'`) · `sheet`(초기 `'none'`)는 `useSettingsUi`, `toast`는 `useToast`. 파일 형식 함수 `toExportFile`·`serializeExportFile`·`exportFileName`·`parseImportFile`은 `ui/src/state/settingsFile.ts`, 후보 분류(SF-07~10)는 `ui/src/state/settingsCandidate.ts`. 토큰은 화면 상태에 없다. `isOwner`는 App 상태(rooms).

## 5. 기능 명세 → `design/functions.md`

F-ST-01 SettingsScreen · 02 useSettingsEditor · 03 loadSettings · 04 retryLoad · 05 handleLoadFailure · 06 selectTab · 07 change* · 08 파생 값 · 09 saveSettings · 10 handleSaveFailure · 11 revertDraft · 12 openFileMenu/closeSheet · 13 openExport · 14 downloadExport · 15 pickFile · 16 changePaste · 17 submitImport · 18 requestBack · 19 confirmLeave/cancelLeave · 20 statusText · 21 문구 함수. rooms 쪽 F-RM-24~29(주인 판정·⚙·진입·이탈 안내)는 `ui/src/rooms/design/functions.md`.

## 6. 파이프라인 → `design/functions.md` §3

열기(정상·실패) · 편집·저장(성공·400·429·네트워크·401 stale·OWNER_ONLY) · 내보내기·가져오기 · 이탈 confirm. 파괴 조작 confirm은 미저장 이탈 1건(④, 공용 ConfirmDialog, `window.confirm` 금지).

---

## 7. contract 계약 사용표

api.md **v0.5**를 **인용**한다(재정의 아님).

| 엔드포인트 | 요청 | 응답 타입 | 래퍼(`@/api`) | 호출 위치 | 토큰 헤더 | 실패 시 표시 |
|---|---|---|---|---|---|---|
| `GET /api/settings/characters` (E15, §4.15) — 주인 판정 | 없음 | `CharacterSettingsResponse`(본문 버림) | `getCharacterSettings(): Promise<Result<CharacterSettingsResponse>>` | App 판정 effect(rooms F-RM-24) | **필요** — 래퍼가 `auth: true`로 부착 | **없음**. 어떤 코드든 `isOwner = false`로 두고 조용히 끝(revokeWrite·토스트 없음, R-SET-010) |
| 같은 E15 — 설정 열기 | 없음 | `CharacterSettingsResponse` = `{ settings: CharacterSettings; version: number; updatedAt: number \| null; isDefault: boolean }` | 같음 | F-ST-03 | 필요 | F-ST-05: `OWNER_ONLY` → rooms+안내 · 인증 3코드 → 전환+rooms+안내 · 그 밖 StateView error |
| `PUT /api/settings/characters` (E16, §4.16) | `PutCharacterSettingsBody = { settings: CharacterSettings }` — `precheckDraft(draft).value`(정규화·검사 통과 값) | `200 CharacterSettingsResponse`(정규화 값, `version` +1, `isDefault: false`) | `saveCharacterSettings(settings): Promise<Result<CharacterSettingsResponse>>` | F-ST-09 | 필요 | F-ST-10: requirements.md §5.7 |
| (엔드포인트 아님) 인증 실패 판정 | — | `isAuthFailure(error): boolean` — `OWNER_ONLY` false | `isAuthFailure` | F-ST-05 · F-ST-10 | — | — |

에러 코드 처리(E15·E16이 낼 수 있는 서버 코드 8종 + 클라이언트 `NETWORK` — 아래 표 행 그대로):

| 코드 | status | 판정(App) | 열기 | 저장 |
|---|---|---|---|---|
| `TOKEN_REQUIRED` · `TOKEN_INVALID` | 401 | 조용히 비주인 | 전환 + rooms 안내 | 전환 + stale |
| `LEVEL_TOO_LOW` | 403 | 조용히 비주인 | 전환 + rooms 안내 | 전환 + stale |
| `OWNER_ONLY` | 403 | 조용히 비주인 | `isOwner=false` + rooms 안내 | 같음 |
| `RATE_LIMITED` | 429 | (E15 없음) | (없음 → error 판) | 토스트 warning + `retryAfterSec` |
| `VALIDATION_ERROR` | 400 | (없음) | (없음 → error 판) | 토스트 danger, 서버 `message` 그대로 |
| `CONFIG_INVALID` · `INTERNAL` | 500 | 조용히 비주인 | error 판 + 재시도 | 토스트 danger |
| `NETWORK` | — | 조용히 비주인 | error 판 + 재시도 | 토스트 danger |

- `@shared/settings` 사용: `CHARACTER_FIELD_SPECS`·`CHARACTER_FIELD_KEYS`·`WORLD_FIELD_SPEC`(라벨·상한·필수) · `SETTINGS_CHARACTER_IDS` · `checkCharacterSettings`(사전 검사·가져오기 병합 뒤 검사) · `SETTINGS_FILE_FORMAT`·`SETTINGS_FILE_FORMAT_VERSION`·`SETTINGS_IMPORT_MAX_BYTES` · 타입 `CharacterSettingsFile`·`SettingsIssue`. `settingsScopeOf`는 화면이 직접 부르지 않는다(사전 검사 문구 안에 이미 들어 있다).
- `@shared/limits`: `countCodePoints`·`normalizeText`. `@shared/characters`: `CHARACTERS[id].shortName`(E.No.S 캐릭터 찾기·탭 이름 대조).
- 래퍼는 throw하지 않는다. 화면에 `try/catch` 없음(예외: `download.ts`의 DOM 호출).
- 테스트는 `vi.mock('@/api/settings')`로 두 래퍼만 모킹한다(barrel 전체를 모킹하지 않는다 — `isAuthFailure`·`configureClient` 실물 사용). `fetch`를 모킹하지 않는다.
- 미확정 계약 없음.

---

## 8. 확정 문구·라벨 → `requirements.md` §5

`ui/src/settings/labels.ts`가 §5의 키를 그대로 가진다. 필드 라벨은 shared spec의 `label`(세계관 필드 `세계관`, 탭 이름은 `공통 세계관`). 하단 줄 사전 검사·저장 400 문구는 `checkCharacterSettings`의 첫 위반 문장을 그대로 쓴다(화면과 서버가 같은 문장). 가져오기 `invalid`도 같은 함수의 문장이다(마지막 저장값 위에 후보만 덮어 검사하므로 위반은 늘 후보 필드, requirements.md §5.5).

- **(후작업 2026-10-07) 공용 `errorText` 사용.** `NETWORK` 문구(`서버에 연결할 수 없습니다.`)와 인증 3코드 문구는 `ui/src/components/utils/errorText.ts`의 `NETWORK_TEXT`·`AUTH_FAILURE_TEXT`를 `labels.ts`가 import해 쓴다(rooms·chat과 같은 단일 정의). 문장은 바뀌지 않았다. 그 밖 문구는 `labels.ts`에 남는다.

## 9. 접근성 → `design/a11y.md`

요약: `<main aria-label="캐릭터 설정">`, 마운트 h1 포커스, tablist·tab·tabpanel(←/→/Home/End, 로빙 tabindex), 탭 `!` 접근성 이름 접미사, 하단 줄 `aria-live=polite`, 토스트·stale·③ 오류 `role=alert`, 시트 포커스 트랩·복귀(공용 BottomSheet), ConfirmDialog 첫 포커스 취소.

---

## 10. 토큰·주인 분기 명세

"미렌더" = **DOM에 없음**(`display:none`·`hidden`·`aria-hidden` 금지).

| 요소 | 토큰 없음 | 토큰 있음 · 비주인(판정 실패 포함) | 주인 | 방식 | 요구ID |
|---|---|---|---|---|---|
| rooms ⚙ | **미렌더**(판정 요청도 없음) | **미렌더** | 렌더(「+ 새 방」 왼쪽) | `viewer.canWrite && isOwner && <IconButton icon='settings'/>` (rooms F-RM-28) | R-SET-009 · R-SET-010 |
| 설정 화면 전체 | 진입 경로 없음 | 진입 경로 없음 | ⚙로만 진입 | App `view.screen === 'settings'`는 `openSettings`로만 된다 | R-SET-009 |
| rooms 「+ 새 방」·chat 쓰기 UI | 미렌더(기존) | **렌더 유지** — 판정 실패로 `revokeWrite` 하지 않는다 | 렌더 | 판정 effect는 `isOwner`만 바꾼다 | R-SET-010 · R-CHAT-011 · R-ROOMS-002 |
| 설정 화면 안 읽기 전용 판 | — | — | 없음. 저장 중 인증 실패만 **stale 판**(초안·입력 유지, 저장·되돌리기·가져오기 비활성, 내보내기 허용) | 리듀서 `isStale` | R-SET-011 |

- 주인이 앱 안에서 쓰기 권한을 잃으면(어느 화면이든 `revokeWrite`) `viewer.canWrite = false`라 ⚙도 사라진다(TC-RM-038).
- 설정 화면은 토큰을 읽지 않는다. 헤더는 래퍼가 `getToken()`으로 붙인다(R-CHAT-009). 내보내기 파일에 토큰·비밀값·`version`·`updatedAt`·`isDefault`가 없다(SF-01 화이트리스트, R-SET-007 · R-NFR-004).

---

## 11. 결정·가정

| # | 내용 | 근거 |
|---|---|---|
| D-ST-1 | 처음 탭 = 공통 세계관. 탭 순서 공통 세계관·세바스찬·시엘 | 메인 세션 결정(구성안 미해결 3) |
| D-ST-2 | stale에서 되돌리기·가져오기 비활성, 내보내기(초안)만 허용 | 메인 세션 결정(구성안 미해결 1) |
| D-ST-3 | 하단 줄 36px, 버튼 md | 메인 세션 결정(구성안 미해결 2) |
| D-ST-4 | 저장 400은 토스트만 하고 탭을 옮기지 않는다 | 서버 응답에 path가 없다(api.md §4.16). 사전 검사를 통과해야 저장이 눌리므로 정상 경로에서는 나오지 않고, 나와도 서버 문구 앞머리(`시엘 · …`)가 위치를 말한다 |
| D-ST-5 | 판정 응답 본문은 버리고, 설정 화면은 들어올 때마다 다시 GET한다 | 메인 세션 결정 기본값 · api.md §2.7(stale 방지). 판정 → 진입 사이에 다른 기기에서 저장했을 수 있다 |
| D-ST-6 | 저장 중에는 ‹·⋯·입력을 막는다 | 응답 전에 초안이 바뀌면 T-08이 사용자의 새 입력을 응답 값으로 덮는다. 저장은 수 초 안에 끝난다 |
| D-ST-7 | OWNER_ONLY(저장 중)면 초안을 버리고 rooms로 간다 | 메인 세션 결정("안내 후 rooms로"). 주인이 아니면 다시 저장할 수 없다. 한계 L-ST-1 |
| D-ST-8 | 저장 중 인증 실패에는 토스트를 띄우지 않는다 | F 안내 줄(`role=alert`)과 D "인증 만료"가 같은 내용을 말한다. 중복 alert 방지 |
| D-ST-9 | 가져오기는 파일 또는 붙여넣기 중 하나만(나중 입력이 앞 입력을 지운다) | 어느 것을 불러올지 모호하지 않게 |
| D-ST-11 | 가져오기 검사 = 마지막 저장값 위에 후보만 덮어 `checkCharacterSettings`(state.md S-15 `checkPatchedSettings`, 상한 전용 별도 검사 없음). 형·필수·상한·개수 위반이면 전체 거부(자체 형식 `world: ''`·`speech: ''`도 거부)·문구는 그 함수의 첫 위반 message 그대로·자르지 않음·초안 불변. 화면이 문장을 조립하지 않는다. 통과하면 후보 위치의 정규화 값만 초안에 덮는다. 초안 전체 검사는 저장 활성 조건에서만. 후보 0개면 초안 불변 + `가져올 항목이 없습니다.`(warning) | api.md v0.5 보정 2 §16.2(메인 세션 결정 2026-10-06, R-SET-008). 후보 밖 초안 문제로 가져오기가 막히지 않게 한다 |
| D-ST-10 | 필드 안내 줄은 화면 문구(짧은 문장), 하단 줄·400·가져오기 거부는 `checkCharacterSettings` 문장 | 필드 옆에서는 필드 이름 반복이 불필요하고, 하단 줄은 다른 탭의 오류도 가리켜야 한다. 두 판정은 같은 spec이라 어긋나지 않는다(state.md S-08 불변식) |

| # | 한계 |
|---|---|
| L-ST-1 | 저장 중 `OWNER_ONLY`면 초안이 사라진다. 이 경로는 주인 목록이 저장 사이에 바뀔 때만 생긴다 |
| L-ST-2 | iframe sandbox가 다운로드를 조용히 막으면 화면이 알 수 없다. 복사용 텍스트가 대체 경로다(api.md §16.1, S5 embed 안내) |
| L-ST-3 | 목록 항목 안 줄바꿈은 초안에서 줄로 나뉜다(state.md §2.5 L-1) |

---

## 12. 구성안·계약과 다르게 정한 것 · 메인 세션 보고

| # | 구성안·지시 | 이 설계 | 근거 |
|---|---|---|---|
| 차이 1 | ② 읽기 전용 TextArea "포커스하면 전체 선택" | 하지 않는다 | 공용 TextArea에 onFocus·select prop이 없다. 공용 변경을 늘리지 않으려고 뺐다. 사용자는 길게 눌러 전체 선택할 수 있다 |
| 차이 2 | 공통 탭 TextArea "C 높이를 채움" | `maxRows=16` + 폼 flex로 근사 | 공용 TextArea는 줄 수 기반 자동 높이다 |
| 차이 3 | 필드별 줄 범위(예: 성격 태그 "2~4줄", 그 밖 "3~n줄") | 최소 줄은 화면 CSS 최소 높이(성격 태그 2줄 56px, 그 밖 3줄 76px), 최대 줄은 공용 `maxRows` | 공용 TextArea에 최소 줄 prop이 없다. 공용 변경 없이 같은 결과(components.md §3.4) |
| 계약 보정으로 일치(2026-10-06) | api.md §16 "무시한 항목" 계수 정의가 이 설계와 달랐다 | 분류 3종(후보·무시·없음)을 후보 만들기(SF-07·09) 한 곳에서. 무시 = 값은 있으나 형이 달라 못 씀(1건씩, appearance 출처 4개 각각, 배열에 문자열 아닌 항목이면 그 출처 1건). 없음(키 없음·null·E.No.S 출처 없는 필드·대응 캐릭터 없음·trim 뒤 빈 값)은 세지 않는다. 후보 검사는 마지막 저장값 + 후보 → `checkCharacterSettings` | api.md v0.5 보정 2 §16.2·§16.3과 같은 문구. ui-design-checker HIGH-1 · 메인 세션 결정 |
| 공용 변경 2건째 | 메인 세션 지시는 공용 변경 1건(IconButton) | **ToastTone에 `'success'` 추가 — 승인(2026-10-06)** | 메인 세션 결정의 "저장 성공 토스트"와 가져오기 요약 토스트를 warning·danger 톤으로 띄우면 상태 색 규칙(ui_design_concept §3: 정상·저장됨 = success)에 어긋난다. 메인 세션 승인(R-SET-009 범위). 미채택 대안: 저장 성공은 D 문구 변화만, 가져오기 요약은 warning 톤 |
| 구현 동기화(v1.2.1) | 설계 v1.2의 파일 구성·훅 반환·시트 높이 | 실물 기준으로 맞춤. 델타 A(분해)·B(가정 7건)·C(실측)는 C §5 표 | TSX 400줄·함수 50줄 한계로 나눈 결과다. 동작·문구 변경 없음(ui 592/592) |

---

## 13. 공용화 후보

| 후보 | 현재 | 조건 | 판정 |
|---|---|---|---|
| Tabs | settings 로컬 | 두 번째 화면에서 탭이 필요할 때 | 후보 표시만(구성안 §8, 승격은 후작업) |
| FormField | settings 로컬 | 라벨+입력+안내 묶음이 다른 화면에 생길 때 | 후보 |
| FilePicker | settings 로컬 | 파일 입력이 다른 화면에 생길 때 | 후보 |
| 탭 폼 편집형 · 내보내기/가져오기 시트 쌍 | 패턴 | 구성안 §12 풀 저장 후보 | ui-manager 사용자 확인 몫 |
| 인증 3코드 안내 문구 · `NETWORK` 문구 | **공용 `ui/src/components/utils/errorText.ts`** | 세 화면 재발 | **공용화 완료(후작업 2026-10-07, 사용자 승인)** — rooms design.md §13 행과 같음 |

---

## 14. RTM (요구 추적 매트릭스)

상태: ✅ = 가리킨 절에 실체 있음. 절 표기: `C` = `design/components.md`, `S` = `design/state.md`, `F` = `design/functions.md`, `A` = `design/a11y.md`, `Rq` = `requirements.md`, `RM` = `ui/src/rooms/design.md`·`design/functions.md`.

| 요구ID | 설계 절 | api 계약 | 예정 TC | 상태 |
|---|---|---|---|---|
| R-SET-007 🔒 | §10 · C §3.8·§3.10 · S §2.2 S-13 · S §3.2 SF-01~03 · F F-ST-13·14 · F §3.4 · Rq §5.4·§5.6 | api.md §16.1 · §16.4 | TC-ST-022 · 023 · 034 · 037 · 038 | ✅ |
| R-SET-008 | C §3.7·§3.9 · S §3 확정 규칙(분류 3종) · S §3.1·§3.2 SF-04~10 · S §2.2 S-15 · S §3.3 V-1~V-6 · S §2.3 T-06 · F F-ST-15~17 · Rq §5.5·§5.6 | api.md §16.2 · §16.3 · §16.4 | TC-ST-024 · 025 · 026 · 027 · 035 · 039 · 041 | ✅ |
| R-SET-009 🔒 | §2 · §6 · §10 · C 전부 · S §1·§2 · F F-ST-01~04·06~08·11·18~20 · A · Rq §5.1~§5.4 · RM F-RM-25·26·28 | api.md §4.15 · §4.16 | TC-ST-001~012 · 020 · 021 · 028~031 · 037 · 040 · TC-RM-036 · 039 · 040 | ✅ |
| R-SET-010 | §7(판정 행) · §10 · F F-ST-05 · RM F-RM-24·27·28 | api.md §2.7 · §4.15 | TC-ST-017 · 019 · TC-RM-033 · 034 · 035 · 037 · 038(settings·rooms RTM 합집합) | ✅ |
| R-SET-011 | §2.2 stale · §10 · C §3.6 · S §2.3 T-10 · S-12·S-13 · F F-ST-10 · F §3.3 | api.md 「ui 인계 메모」 S3c | TC-ST-016 · 023 | ✅ |
| R-SET-002 🔒 (참조 — 화면 사전 검사) | C §3.4 · S §2.2 S-07·S-08 · F F-ST-07·08 | api.md §5.8.4 | TC-ST-008 · 009 · 032 | ✅ |
| R-SET-005 🔒 (참조 — 저장·400 문구) | §7 · F F-ST-09·10 · Rq §5.7 | api.md §4.16 | TC-ST-011 · 013 · 014 · 015 | ✅ |
| R-SET-001 🔒 (참조 — OWNER_ONLY) | §7 · F F-ST-05·10 | api.md §2.7 · §3.2 | TC-ST-017 · 019 · TC-RM-037 | ✅ |
| R-SET-004 🔒 (참조 — E15) | §7 · F F-ST-03 | api.md §4.15 | TC-ST-001 · 002 · 003 | ✅ |
| R-SET-003 · 006 · 012 (참조) | §7(isDefault·version 표시) · C(outputRules 필드 없음) · S §3(파일 내용 로그 없음) | api.md §4.15 · §16.4 | TC-ST-021 · 031 · 036 | ✅ |
| R-ROOMS-002 🔒 (영향 — 상단 바) | §10 · RM §2.2 · F-RM-28 | — | TC-RM-033 · 034 · 035 | ✅ |
| R-ROOMS-005 🔒 (영향 — 390px) | §2 · C §4 · A §5 | — | TC-ST-037 · TC-RM-040 | ✅ |
| R-CHAT-011 (영향 — 전환 규칙 불변) | §7 · §10 · F F-ST-05·10 · Rq §5.7 · RM F-RM-24 | api.md §2.4 · §3.2 | TC-ST-014 · 016 · 018 · TC-RM-034 | ✅ |
| R-NFR-004 🔒 (영향 — 번들·파일 비밀값 0) | §10 · S §3.2 SF-01 · C §3.10(로그 없음) | api.md §16.4 | TC-ST-034 · 035 · 036 | ✅ |

### 14.1 예정 TC 목록 (ui-test-designer가 시나리오로 확정)

| TC | 내용 | 기대(요지) |
|---|---|---|
| TC-ST-001 | 로딩 | GET 대기 중 `role=status` `설정을 불러오는 중`, tablist·⋯·저장 버튼 DOM 없음, ‹ 있음 |
| TC-ST-002 | 오류 + 다시 시도 | `NETWORK` → `role=alert` 제목·`서버에 연결할 수 없습니다.`·「다시 시도」 → GET 2회째 → ready |
| TC-ST-003 | 처음 진입 | GET 1회(화면 마운트마다), 선택 탭 `공통 세계관`, `세계관, 필수` textbox 값 = 응답 world, h1 포커스 |
| TC-ST-004 | 탭 전환 초안 유지 | 세바스찬 말투 수정 → 시엘 → 세바스찬 → 값 유지, dirty 유지 |
| TC-ST-005 | 탭 키보드 | →·← 순환, Home·End, `aria-selected`·`tabIndex` 로빙, 패널 `aria-labelledby` 갱신 |
| TC-ST-006 | 필드 11개 | 라벨·순서 = `CHARACTER_FIELD_KEYS`·spec label, 필수 3종 `*`·`, 필수`, 나이·성별 같은 줄, outputRules 필드 없음 |
| TC-ST-007 | 목록 필드 | `['a','b']` → TextArea `a\nb` · `' x \n\n y '` 입력 → 줄 카운터 `2/10줄` · 저장 본문 `['x','y']` |
| TC-ST-008 | 상한 초과 | 말투 801자 → 카운터 over·`aria-invalid`·안내 `800자 이하로 줄여 주세요.`·탭 `!`(이름 `, 확인할 항목 있음`)·저장 disabled·D = `세바스찬 · 말투는 1~800자여야 합니다.` · 샘플 대사 11줄 → `10줄 이하로…` · 201자 줄 → `n번째 줄이 200자를 넘습니다.` |
| TC-ST-009 | 필수 빈 칸 | 세계관 공백만 → `필수 항목입니다.`·D `공통 · 세계관은 1~2000자여야 합니다.`·저장 disabled |
| TC-ST-010 | dirty | 수정 → D `저장하지 않은 변경 있음`·되돌리기 enabled · 앞뒤 공백만 추가 → dirty 아님 |
| TC-ST-011 | 저장 성공 | `saveCharacterSettings` 1회(정규화 값) → D `v4 저장됨 MM.DD HH:mm`·dirty 해제·토스트 success `저장했습니다. 다음 대사부터 반영됩니다.`·초안 = 응답 settings |
| TC-ST-012 | 저장 중 | 대기 중 입력 readOnly·‹·⋯·되돌리기·저장 disabled·D `저장 중...` · 저장 연타 → 호출 1회 |
| TC-ST-013 | 저장 400 | 토스트 danger = 서버 message, 탭·초안 유지, 저장 다시 enabled |
| TC-ST-014 | 저장 429 | `retryAfterSec: 40` → `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.` warning · 값 없음 → 기본 문구 · `onAuthFailure` 미호출 |
| TC-ST-015 | 저장 네트워크·서버 오류 | `NETWORK`·`INTERNAL` → 토스트 danger, 초안 유지 |
| TC-ST-016 | 저장 중 인증 실패 → stale | `TOKEN_INVALID`·`LEVEL_TOO_LOW`·`TOKEN_REQUIRED` 각각 → `onAuthFailure` 1회 · F `role=alert` 문구 · D `인증 만료` · 저장·되돌리기 disabled · 초안 유지·입력 가능 · ⋯ → 가져오기 disabled·내보내기 enabled · 토스트 없음 |
| TC-ST-017 | 저장 OWNER_ONLY | `onOwnerLost` 1회 → `onLeave({ message: '캐릭터 설정은 갠홈 주인만 열 수 있습니다.', tone: 'warning' })` · `onAuthFailure` 미호출 |
| TC-ST-018 | 열기 인증 실패 | 401·`LEVEL_TOO_LOW` → `onAuthFailure` 1회 → `onLeave(authText)` |
| TC-ST-019 | 열기 OWNER_ONLY | `onOwnerLost` → `onLeave(ownerOnly)` · `onAuthFailure` 미호출 · error 판 없음 |
| TC-ST-020 | 되돌리기 | 수정 → 되돌리기 → 값 = 기준값, dirty 해제, 확인 시트 없음 |
| TC-ST-021 | 기본값 표시 | `isDefault: true` → D `기본값 사용 중` · 저장 성공 뒤 `vN 저장됨` |
| TC-ST-022 | 내보내기 | dirty 상태 → ② 텍스트 = 기준값 JSON(초안 아님)·안내 `저장하지 않은 변경은 포함되지 않습니다.` · 「파일로 저장」 → `URL.createObjectURL` 1회·`a.download` = `london-dispatch-characters-YYYYMMDD-HHmm.json` · 예외 모킹 → 시트 닫힘·토스트 `fileSaveFailed` |
| TC-ST-023 | stale 내보내기 | stale → ② 텍스트 = 정규화 초안·안내 `인증이 만료되어 현재 초안을 내보냅니다.` |
| TC-ST-024 | 가져오기(파일) | 자체 형식 파일 선택 → 불러오기 → 초안 반영·시트 닫힘·토스트 success 요약 · `saveCharacterSettings` 미호출 · 되돌리기로 취소 가능 · 후보 밖 필드(예: 시엘 말투)가 초안에서 이미 상한 초과여도 가져오기는 성공하고, 그 뒤 저장만 비활성 |
| TC-ST-025 | 가져오기(붙여넣기) | E.No.S 백업 JSON 붙여넣기 → 매핑 필드만 반영, persona·relationships·rules 유지 |
| TC-ST-026 | 가져오기 거부 | 모르는 형식 → `알 수 없는 파일 형식입니다.`(role=alert) · `formatVersion: 2` → 버전 문구 · 자체 형식 `characters.ciel.speech` 801자 → `시엘 · 말투는 1~800자여야 합니다.`(api.md §16.3 벡터 4행과 같음) · 자체 형식 `world: ''` → `공통 · 세계관은 1~2000자여야 합니다.` · 자체 형식 `characters.sebastian.speech: ''` → `세바스찬 · 말투는 1~800자여야 합니다.` · 문구는 모두 `checkCharacterSettings` 첫 위반 message 그대로 · `size > 5MB` 파일 → `파일이 5MB를 넘어 읽지 않았습니다.`·FileReader 미호출 · 모든 경우 초안 불변 |
| TC-ST-027 | 가져오기 입력 규칙 | 둘 다 비면 불러오기 disabled · 파일 선택 → 붙여넣기 비움 · 붙여넣기 → 파일 이름 `선택한 파일 없음` |
| TC-ST-028 | 미저장 이탈 | clean ‹ → `onLeave()` 즉시 · dirty ‹ → ④(취소 포커스) → 취소 머묾 / 나가기 → `onLeave()` · stale+dirty도 ④ |
| TC-ST-029 | 시트 포커스 | ⋯ → ① 첫 항목 포커스 · Esc → 닫힘·⋯ 포커스 · ① → ② → 닫기 → ⋯ 포커스 · ③ 취소 → ⋯ 포커스 · ④ 취소 → ‹ 포커스 · Tab 순환 |
| TC-ST-030 | 역할·이름 | main 이름, h1 포커스, tablist·tab·tabpanel, D `aria-live=polite` |
| TC-ST-031 | 라벨 단일 소스 | 필드 라벨 = spec label, 세계관 라벨 `세계관`, 탭 `공통 세계관`, 캐릭터 탭 = `CHARACTERS[id].shortName` |
| TC-ST-032 | state/settings.ts 단위 | S-01~S-15 · 리듀서 T-01~T-10(무시 조합 포함) · S-08 ⇔ S-07 불변식 경계 벡터. **S-15 직접 단위 확인 포함** — 벡터는 state.md §3.3 V-4(`ciel.speech` 801자 → `ok: false`, `시엘 · 말투는 1~800자여야 합니다.`)·V-6(`base` 통과 값 + world만 → `ok: true`) 재사용, `base` 객체 불변 확인 |
| TC-ST-033 | download.ts 단위 | 성공 true·revoke 호출 · Blob 생성 예외 → false |
| TC-ST-034 | toExportFile | 최상위 키 = 4개, settings 키 = world + 2×11, 순서, 입력에 `apiKey`·`version`을 섞어도 출력 0 · 직렬화 문자열 `apiKey\|API_KEY\|SECRET\|token` 0건 · 파일명 0 채움 |
| TC-ST-035 | parseImportFile 벡터 | 자체 · E.No.S 백업(첫 맞는 world) · world 단독(캐릭터 없으면 world만) · 잘못된 형식 · `SETTINGS.apiKey` 포함 백업 → 결과에 키 0 · 5MB+1 바이트 텍스트 → `tooLarge` · 맞는 world 없음 → `noMatchingWorld`. **`ignoredCount` 기대값:** 자체 형식 `speech: 3`·`rules: 'x'` → 2 · 키 생략·`null`·화이트리스트 밖 키 → 0 · E.No.S `voice: 5`·`hair_style: []` → 2(appearance 출처 각각) · persona·relationships·rules·대응 캐릭터 없음 → 0. 계수는 후보 만들기에서만(덮기 뒤 값이 같아도 다시 세지 않음) · 후보 0개 → `ok: true`, 빈 patch, `applied` 전부 0·false. **api.md §16.3 벡터 6행(state.md §3.3 V-1~V-6):** ① E.No.S 백업, 매핑 출처 모두 문자열 → 무시 0, patch에 persona·relationships·rules 없음 ② `age: 13`·`gender: {}`·`sample_dialogue: ['a', 1]` → patch `age = '13'`, 무시 2, gender·sampleDialogue 초안 유지 ③ `voice: ''`·`job: null` → 둘 다 없음, 무시 0, patch에 speech·role 없음(`applied`에 안 잡힘) ④ 자체 `characters.ciel.speech` 801자 → `{ ok: false, reason: 'invalid', message: '시엘 · 말투는 1~800자여야 합니다.' }`, 초안 불변 ⑤ 자체 `characters.sebastian.rules: 'a'` → 무시 1, 나머지 후보 patch 반영 ⑥ world 단독(`description`만 유효) + 초안 `sebastian.appearance` 801자 → 성공, patch = world만, 무시 0, 덮은 뒤 `precheckDraft` 실패 `세바스찬 · 외형은 800자 이하여야 합니다.` → 저장 비활성 |
| TC-ST-041 | 가져오기 화면 통합(벡터 ④·⑥) | ③ 시트에서 ④ 파일 → 오류 줄 `시엘 · 말투는 1~800자여야 합니다.`(role=alert)·초안 불변 · ⑥ 파일 → 시트 닫힘·토스트 요약·세계관만 바뀜·외형 801자 입력 그대로·하단 줄 `세바스찬 · 외형은 800자 이하여야 합니다.`·저장 disabled |
| TC-ST-039 | 가져올 항목 없음 | 쓸 값이 없는 자체 형식 파일(`settings: {}`) → 시트 닫힘 · 토스트 warning `가져올 항목이 없습니다.` · 초안·dirty 불변 · 무시 항목 있으면 `… 무시한 항목 n개.` |
| TC-ST-040 | 저장 뒤 포커스 | 성공 → h1 포커스 · `INTERNAL` 실패 → 「저장」 포커스 · `TOKEN_INVALID`(stale) → h1 포커스 |
| TC-ST-036 | 리뷰 grep | `ui/src/settings`·`state/settings*.ts`에 `fetch(`·`localStorage`·`sessionStorage`·`document.cookie`·`getToken`·`console.` 0건 · `ui/dist` 비밀값 grep 0건 |
| TC-ST-037 | 스크린샷(수동) | 390×565: 세 탭 · ①②③④ 시트 · stale · loading/error. 가로 스크롤 없음, A44·B40·D36 |
| TC-ST-038 | 실제 iframe 파일 저장(수동, S5 이후) | 갠홈 패널 안 「파일로 저장」 동작 여부. 막히면 복사 경로 확인 |
