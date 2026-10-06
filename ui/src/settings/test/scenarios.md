# settings(캐릭터 설정) 테스트 시나리오

- 기준: `ui/src/settings/design.md` v1.2(+ `design/components.md` · `design/state.md` · `design/functions.md` · `design/a11y.md`) / `ui/src/settings/requirements.md` v1.0.2 / `doc/200_설계/contract/api.md` v0.5(§4.15 · §4.16 · §5.8 · §16 · 「ui 인계 메모」 S3c) / rooms 델타 `ui/src/rooms/design.md` v1.6.1
- 작성일: 2026-10-06 · 작성: ui-test-designer · 모드: **신규**(settings 화면 첫 시나리오, 묶음 S3c 보강) · 상태: **초안 v0.1(검증 대기)**
- 수량: TC-ST-001 ~ 041 = 41건(자동 38 · 수동 3) · TC-FLOW-ST-01 ~ 12 · rooms 델타 TC-RM-033 ~ 040은 `ui/src/rooms/test/scenarios.md`

## 공통 전제

- **api 래퍼 모킹**: `vi.mock('@/api/settings', () => ({ getCharacterSettings: vi.fn(), saveCharacterSettings: vi.fn() }))`. 화면이 `@/api` 재노출을 import해도 같은 mock이 걸린다. `isAuthFailure`(`@/api/client`)·`toastToneOf`(`@/state/writeFailure`)는 실물이다. `fetch` 모킹·실제 네트워크 금지.
- **결과 값**: 성공 `{ ok: true, value: CharacterSettingsResponse }`, 실패 `{ ok: false, error: { code, message: 'SERVER-RAW-MESSAGE', retryAfterSec? } }`. `VALIDATION_ERROR`만 `message`를 화면에 쓴다.
- **토큰**: 설정 화면은 토큰을 모른다. 화면 단위 스펙은 props 콜백(`onLeave`·`onAuthFailure`·`onOwnerLost`)만 준다. 주인 판정·토큰 슬롯은 rooms App 스펙(`OwnerGate.test.tsx`)이 `initToken('?t=test-token')`·`clearToken()`으로 다룬다. 이 화면의 모든 TC는 "토큰 있음 · 주인"으로 들어온 화면이다. 토큰 없음·비주인은 화면 진입 경로가 없다(design.md §10) → TC-RM-034·035가 ⚙ 미렌더로 확인한다.
- **대기 규칙**: 응답 순서는 deferred promise로 고정한다. 호출이 생기는 판정은 `findBy*`·`waitFor`, "호출 없음·횟수 유지" 앞에는 `await act(async () => {})`. 실제 sleep 없음. 시각 고정은 `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime`(타이머는 실제 → `findBy*` 사용 가능). `download.ts` 단위만 전체 가짜 시계(`setTimeout 0` 확인).
- **입력**: 긴 값·여러 줄은 `fireEvent.change`, 클릭·키보드는 `userEvent`. 파일 선택은 숨은 `input[type=file]`에 `fireEvent.change(…, { target: { files } })`. `FileReader`는 jsdom 실물. 지연·실패는 `FileReader.prototype.readAsText` spy로 만든다. `URL.createObjectURL`·`revokeObjectURL`은 jsdom에 없어 정적 속성에 `vi.fn`을 심고 `afterEach`에서 되돌린다.
- **클래스 키**: `classNameStrategy: 'non-scoped'`라 클래스명 = 키. Toast 톤 `success`·`warning`·`danger`, 하단 줄 색 `muted`·`warning`·`danger`, 카운터 초과 `over`.
- **픽스처**: `ui/src/settings/test/fixtures.ts`(스펙 아님). 기준값 `SAVED_RESPONSE`(version 3 · updatedAt 2026-10-06 14:20 로컬 · isDefault false → D `v3 저장됨 10.06 14:20`) · `DEFAULT_RESPONSE`(version 0 · updatedAt null · isDefault true) · 세바스찬 `sampleDialogue` 2줄 · 문구 표 `T`(requirements.md §5 원문). E.No.S 백업 픽스처는 `SETTINGS.apiKey`·`DB.chats`를 넣어 둔다(읽지 않아야 한다).
- **구현 이름 계약(설계 인용)**: `SettingsScreen`(`@/settings`, named) · `@/settings/download`의 `downloadText` · `@/state/settings`(S-01~S-15 · `settingsReducer` · `INITIAL_SETTINGS_STATE` · `SETTINGS_TABS` · 타입 `ReadyState`·`SettingsDraft`·`SettingsState`) · `@/state/settingsFile`(`toExportFile`·`serializeExportFile`·`exportFileName`·`utf8ByteLength`·`parseImportFile`·`detectImportSource` · 타입 `ImportResult`). SF-07~SF-10은 내부 함수라 `parseImportFile` 결과로 관찰한다.
- **접근성 이름 가정**: 필드 입력 이름 = spec label(필수면 `{label}, 필수`). 목록 필드도 `listHint` 없이 `샘플 대사`·`규칙·금기`(아래 「설계 확인 필요」 Q4).

## TC 목록

### TC-ST-001 · 로딩 · 종류: 자동 · 요구: R-SET-009 · R-SET-004 · 설계: §2.2 loading · F-ST-01·03 · C §1 트리 · S §1 `isActiveRef` · A §1 · Rq §5.6 `loading` · 토큰: 있음(주인)
- Given `getCharacterSettings`가 대기 중(deferred) / (b) 같은 대기 중에 화면을 언마운트한다
- When SettingsScreen을 마운트한다 / (b) 언마운트 뒤 `OWNER_ONLY` 응답이 도착한다
- Then ⓐ `role=status`에 `설정을 불러오는 중`. `tablist`·`설정 파일 메뉴`·`저장` 버튼 DOM 없음, `뒤로` 있음. 응답 뒤 tablist 표시 ⓑ 저장소 키 0개. (b) `onLeave`·`onAuthFailure`·`onOwnerLost` 0회, `console.error` 0회 ⓒ `getCharacterSettings` 1회, 인자 없음. `saveCharacterSettings` 0회
- 스펙: `ui/src/settings/test/SettingsScreen.test.tsx`

### TC-ST-002 · 오류 + 다시 시도 · 종류: 자동 · 요구: R-SET-009 · R-SET-004 · 설계: §2.2 error · §7 에러 표(열기 열) · F-ST-04·05 · F §3.2 · Rq §5.6 `loadError`·`loadErrorDetail`·`retry` · 토큰: 있음(주인)
- Given (a) 1회째 GET → `NETWORK`, 2회째 → 대기 후 `ok(SAVED_RESPONSE)` (b) 1회째 GET → `INTERNAL` · `CONFIG_INVALID` · `RATE_LIMITED` · `VALIDATION_ERROR` 각각
- When 오류 판에서 「다시 시도」를 누르고 2회째 응답이 도착한다 / (b) 마운트한다
- Then ⓐ `role=alert` 안에 `설정을 불러오지 못했습니다` + `서버에 연결할 수 없습니다.` + 버튼 `다시 시도`. 클릭 직후 `status` `설정을 불러오는 중`·alert 없음 → 응답 뒤 tablist. (b) 상세 = `ERROR_MESSAGES[code]`, `SERVER-RAW-MESSAGE` 없음 ⓑ `onLeave`·`onAuthFailure`·`onOwnerLost` 0회(그 밖 코드는 화면 안 오류) ⓒ (a) GET 2회, 2회째 인자 없음 (b) GET 1회
- 스펙: `SettingsScreen.test.tsx`

### TC-ST-003 · 처음 진입 · 종류: 자동 · 요구: R-SET-009 · R-SET-004 · 설계: §11 D-ST-1·D-ST-5 · F-ST-01·03 · S §1 `activeTab`·`titleRef` · S-14 saved · A §2.1 · 토큰: 있음(주인)
- Given GET → `ok(SAVED_RESPONSE)`
- When 마운트하고 ready가 된다
- Then ⓐ 선택 탭 `공통 세계관`(`aria-selected=true`), `세계관, 필수` 입력값 = 응답 world, h1 `캐릭터 설정`에 포커스, D = `v3 저장됨 10.06 14:20`, 「되돌리기」·「저장」 disabled ⓑ 저장소 키 0개(탭·초안을 저장하지 않음) ⓒ GET 1회(화면 마운트마다 1회 — App 판정 응답을 재사용하지 않는다), 저장 0회
- 스펙: `SettingsScreen.test.tsx`

### TC-ST-004 · 탭 전환 초안 유지 · 종류: 자동 · 요구: R-SET-009 · 설계: F-ST-06·07 · T-04 · C §3.4 `key={activeTab}` · 토큰: 있음(주인)
- Given ready, 세바스찬 탭
- When 말투를 `바뀐 말투`로 바꾸고 → 시엘 탭(폼 영역 `scrollTop` 120) → 세바스찬 탭으로 돌아온다
- Then ⓐ 시엘 탭에서 말투 = 시엘 기준값, 돌아오면 세바스찬 말투 = `바뀐 말투`, D `저장하지 않은 변경 있음`, 「되돌리기」 enabled ⓑ 탭 전환 시 tabpanel `scrollTop`에 0을 쓴다(F-ST-06). 초안은 리듀서에 남는다 ⓒ 저장 0회, GET 1회 유지
- 스펙: `SettingsScreen.test.tsx`

### TC-ST-005 · 탭 키보드 · 종류: 자동 · 요구: R-SET-009 · 설계: C §3.2 Tabs · A §1 탭·폼 영역 · A §3 키보드 · 토큰: 있음(주인)
- Given ready, `공통 세계관` 탭에 포커스
- When → · → · →(끝에서 순환) · ← · Home · End
- Then ⓐ 매 단계 선택 탭만 `aria-selected=true`·`tabIndex=0`, 나머지 `-1`, 포커스가 선택 탭에 있음, 모든 탭 `aria-controls=settings-panel`, 탭 id `settings-tab-{id}` ⓑ 패널 `id=settings-panel`, `aria-labelledby` = `settings-tab-{선택 id}`(세바스찬 → 시엘 → 공통 → 시엘 → 공통 → 시엘) ⓒ api 추가 호출 없음(GET 1회)
- 스펙: `SettingsScreen.test.tsx`

### TC-ST-006 · 필드 11개 · 종류: 자동 · 요구: R-SET-009 · R-SET-002 · R-SET-006 · 설계: C §3.3 FormField · C §3.4 표 · Rq §5.1 `groupBasic`·`groupPersona`·`groupSpeech`·`requiredMark`·`requiredAria`·`listHint` · 토큰: 있음(주인)
- Given ready
- When 세바스찬 탭을 연다
- Then ⓐ tabpanel 안 textbox 이름 순서 = `원작·장르 · 나이 · 성별 · 신분·직업 · 성격·배경, 필수 · 성격 태그 · 외형 · 관계 메모 · 말투, 필수 · 샘플 대사 · 규칙·금기`(나이 → 성별 인접), h2 `기본 정보 · 인물 · 말투·규칙`, `aria-hidden` `*` 2개(캐릭터 탭 필수 2종, 세계관 탭 1종과 합쳐 3종), 보이는 라벨 `샘플 대사 (한 줄에 하나, 최대 10)`·`규칙·금기 (한 줄에 하나, 최대 20)`, `outputRules`·출력 규칙 입력 없음 ⓑ 해당 없음(렌더만, 저장소 변화 없음) ⓒ 저장 0회. 같은 줄 배치는 수동 TC-ST-037
- 스펙: `SettingsScreen.test.tsx`

### TC-ST-007 · 목록 필드 · 종류: 자동 · 요구: R-SET-009 · R-SET-002 · R-SET-005 · 설계: S-01·S-02·S-10 · C §3.4 10·11행 · F-ST-09 본문 · 토큰: 있음(주인)
- Given ready, 기준 `sampleDialogue = ['예, 도련님.', '팬텀하이브 가의 집사라면 이 정도는.']`
- When 세바스찬 탭 `샘플 대사`를 `' x \n\n y '`로 바꾸고 (저장 스펙) 「저장」을 누른다
- Then ⓐ 처음 값 = 두 항목을 `\n`으로 이은 글, 입력 뒤 카운터 `2/10줄`, 입력값은 원문 그대로 ⓑ 초안 = 원문 문자열(trim 안 함) ⓒ `saveCharacterSettings` 1회, 인자 = 기준값에서 세바스찬 `sampleDialogue`만 `['x', 'y']`인 `CharacterSettings`
- 스펙: `SettingsScreen.test.tsx`(화면) · `SettingsSave.test.tsx`(저장 본문)

### TC-ST-008 · 상한 초과 · 종류: 자동 · 요구: R-SET-009 · R-SET-002 · 설계: S-08·S-09·S-14 invalid · C §3.3·§3.5 · §11 D-ST-10 · A §4 필드 오류 · Rq §5.2 · 토큰: 있음(주인)
- Given ready, 세바스찬 탭
- When (a) 말투 801자 (b) 말투를 되돌리고 샘플 대사 11줄 (c) 샘플 대사 `'\n' + 201자`
- Then ⓐ (a) 카운터 `801/800`에 `over`, 입력 `aria-invalid=true`, 입력값 801자 그대로(잘리지 않음), 안내 `800자 이하로 줄여 주세요.`, 탭 이름 `세바스찬, 확인할 항목 있음`, 「저장」 disabled, D `세바스찬 · 말투는 1~800자여야 합니다.`(`danger`) (b) 안내 `10줄 이하로 줄여 주세요.`, 카운터 `11/10줄`, D `세바스찬 · 샘플 대사는 10개 이하여야 합니다.` (c) 안내 `1번째 줄이 200자를 넘습니다.`(빈 줄 제거 뒤 번호), D `세바스찬 · 샘플 대사는 한 줄에 200자 이하여야 합니다.` ⓑ 초안에 입력값 그대로 ⓒ 저장 0회
- 스펙: `SettingsScreen.test.tsx`

### TC-ST-009 · 필수 빈 칸 · 종류: 자동 · 요구: R-SET-009 · R-SET-002 · 설계: S-08 required · S-14 invalid · Rq §5.2 `fieldRequired` · 토큰: 있음(주인)
- Given ready
- When (a) 세계관을 공백만으로 (b) 세계관을 채우고 세바스찬 `성격·배경`을 비운다
- Then ⓐ (a) 안내 `필수 항목입니다.`, 탭 `공통 세계관, 확인할 항목 있음`, D `공통 · 세계관은 1~2000자여야 합니다.`, 「저장」 disabled (b) 안내 `필수 항목입니다.`, D `세바스찬 · 성격·배경은 1~1500자여야 합니다.`, 「저장」 disabled ⓑ 초안 = 입력값 ⓒ 저장 0회
- 스펙: `SettingsScreen.test.tsx`

### TC-ST-010 · dirty · 종류: 자동 · 요구: R-SET-009 · 설계: S-06·S-11·S-12·S-14 dirty · C §3.5 색 · 토큰: 있음(주인)
- Given ready, 세바스찬 탭
- When (a) 말투 `바뀐 말투` (b) 말투 = 기준값 앞뒤에 공백만 붙인 값
- Then ⓐ (a) D `저장하지 않은 변경 있음`(`warning`), 「되돌리기」·「저장」 enabled (b) D `v3 저장됨 10.06 14:20`, 두 버튼 disabled ⓑ (b) 정규화 비교라 dirty 아님 ⓒ 저장 0회
- 스펙: `SettingsScreen.test.tsx`

### TC-ST-011 · 저장 성공 · 종류: 자동 · 요구: R-SET-005 · R-SET-009 · R-SET-003 · 설계: F-ST-09 · T-07·T-08 · §7 E16 행 · F §3.3 200 · C §1.18 Toast `success`(rooms 공용 델타) · Rq §5.6 `saved` · 토큰: 있음(주인)
- Given ready, 말투 `'  새 말투  '`, `saveCharacterSettings` → `ok({ settings: 말투 '새 말투(서버 정규화)', version: 4, updatedAt: 10.06 15:30, isDefault: false })`
- When 「저장」
- Then ⓐ 토스트 `role=alert` `저장했습니다. 다음 대사부터 반영됩니다.`(`success`), D `v4 저장됨 10.06 15:30`, 말투 입력값 = `새 말투(서버 정규화)`(초안 = 응답), 「되돌리기」·「저장」 disabled ⓑ 기준값·초안 = 응답, `onAuthFailure`·`onLeave` 0회, 저장소 키 0개 ⓒ 저장 1회, 인자 = 기준값에서 세바스찬 말투만 `'새 말투'`(정규화 값). GET 1회 유지
- 스펙: `ui/src/settings/test/SettingsSave.test.tsx`

### TC-ST-012 · 저장 중 · 종류: 자동 · 요구: R-SET-009 · R-SET-005 · 설계: §2.2 saving · §11 D-ST-6 · F-ST-09 `saveInFlightRef` · S §1 · C §1 트리 `isDisabled={isSaving}` · 토큰: 있음(주인)
- Given 유효 dirty, 저장 응답 대기(deferred) / (b) 리렌더 전 같은 `act` 안
- When 「저장」 → 대기 중 「저장」 클릭 2회 / (b) `fireEvent.click(저장)` 2회
- Then ⓐ D `저장 중...`, tabpanel 안 모든 입력 `readOnly`, `뒤로`·`설정 파일 메뉴`·「되돌리기」·「저장」 disabled. 응답 뒤 D `v4 저장됨 10.06 15:30` ⓑ `isSaving` true → false(위 표시로 관찰) ⓒ (a)(b) 저장 1회
- 스펙: `SettingsSave.test.tsx`

### TC-ST-013 · 저장 400 · 종류: 자동 · 요구: R-SET-005 · 설계: §7 VALIDATION_ERROR · §11 D-ST-4 · F-ST-10 · Rq §5.7 · 토큰: 있음(주인)
- Given 유효 dirty, 저장 → `VALIDATION_ERROR`, `message: '시엘 · 말투는 1~800자여야 합니다.'`
- When 「저장」
- Then ⓐ 토스트 `시엘 · 말투는 1~800자여야 합니다.`(`danger`), 선택 탭 세바스찬 유지(탭 이동 없음), 입력값 유지, D `저장하지 않은 변경 있음`, 「저장」 enabled ⓑ 초안 유지, `onAuthFailure` 0회 ⓒ 저장 1회
- 스펙: `SettingsSave.test.tsx`

### TC-ST-014 · 저장 429 · 종류: 자동 · 요구: R-SET-005 · R-CHAT-011 · 설계: §7 RATE_LIMITED · F-ST-10 · F-RM-22 `toastToneOf` · Rq §5.7 · 토큰: 있음(주인)
- Given 유효 dirty, 저장 → `RATE_LIMITED` (a) `retryAfterSec: 40` (b) 값 없음
- When 「저장」
- Then ⓐ (a) `요청이 너무 많습니다. 40초 후 다시 시도해 주세요.` (b) `ERROR_MESSAGES.RATE_LIMITED`, 둘 다 `warning`. 입력값 유지 ⓑ `onAuthFailure` 0회(전환 대상 아님) ⓒ 저장 1회
- 스펙: `SettingsSave.test.tsx`

### TC-ST-015 · 저장 네트워크·서버 오류 · 종류: 자동 · 요구: R-SET-005 · 설계: §7 NETWORK·CONFIG_INVALID·INTERNAL · F-ST-10 · Rq §5.7 · 토큰: 있음(주인)
- Given 유효 dirty, 저장 → `NETWORK` · `INTERNAL` · `CONFIG_INVALID` 각각
- When 「저장」
- Then ⓐ 토스트 `서버에 연결할 수 없습니다.` · `ERROR_MESSAGES.INTERNAL` · `ERROR_MESSAGES.CONFIG_INVALID`(모두 `danger`), `SERVER-RAW-MESSAGE` 없음, 입력값 유지 ⓑ `onAuthFailure`·`onLeave` 0회 ⓒ 저장 1회
- 스펙: `SettingsSave.test.tsx`

### TC-ST-016 · 저장 중 인증 실패 → stale · 종류: 자동 · 요구: R-SET-011 · R-SET-007 · R-CHAT-011 · 설계: §2.2 stale · §10 마지막 행 · §11 D-ST-2·D-ST-8 · T-10 · S-11·S-12·S-14 stale · F-ST-10 · F §3.3 · C §3.6 StaleNotice · C §3.7 `isImportDisabled` · Rq §5.3 `statusStale` · §5.6 `staleNotice` · 토큰: 있음 → 만료
- Given 유효 dirty(말투 `바뀐 말투`), 저장 → `TOKEN_INVALID` · `LEVEL_TOO_LOW` · `TOKEN_REQUIRED` 각각
- When 「저장」 → 응답 뒤 말투에 더 입력 → ⋯ 를 연다
- Then ⓐ `role=alert`는 1개뿐 = `인증이 만료되었습니다. 내보내기로 변경을 보관한 뒤 새로 고쳐 주세요.`(토스트 없음), D `인증 만료`(`danger`), 「저장」·「되돌리기」 disabled, 말투 = `바뀐 말투` 유지·`readOnly` 아님·추가 입력 반영(그래도 「저장」 disabled), ① 시트 `가져오기` disabled·`내보내기` enabled ⓑ `onAuthFailure` 1회(App 읽기 전용 전환), `onLeave`·`onOwnerLost` 0회, 초안 보존 ⓒ 저장 1회(재시도 없음)
- 스펙: `SettingsSave.test.tsx`

### TC-ST-017 · 저장 OWNER_ONLY · 종류: 자동 · 요구: R-SET-010 · R-SET-001 · 설계: §7 OWNER_ONLY · §11 D-ST-7 · L-ST-1 · F-ST-10 · Rq §5.7 `ownerOnly` · 토큰: 있음(주인 → 주인 아님)
- Given 유효 dirty, 저장 → `OWNER_ONLY`
- When 「저장」
- Then ⓐ 화면 안 토스트·alert 없음(rooms가 띄운다) ⓑ `onOwnerLost` 1회가 `onLeave({ message: '캐릭터 설정은 갠홈 주인만 열 수 있습니다.', tone: 'warning' })` 1회보다 먼저, `onAuthFailure` 0회(초안 버림) ⓒ 저장 1회
- 스펙: `SettingsSave.test.tsx`

### TC-ST-018 · 열기 인증 실패 · 종류: 자동 · 요구: R-CHAT-011 · R-SET-010 · 설계: §7 인증 3코드(열기) · F-ST-05 · F §3.2 · Rq §5.7 `authText` · 토큰: 있음 → 만료
- Given GET → `TOKEN_INVALID` · `TOKEN_REQUIRED` · `LEVEL_TOO_LOW` 각각
- When 마운트한다
- Then ⓐ error 판 없음(`alert` 없음) ⓑ `onAuthFailure` 1회가 `onLeave({ message, tone: 'warning' })` 1회보다 먼저. message = `인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.` · `로그인 정보가 없어 열람 전용으로 바뀌었습니다.` · `대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.`. `onOwnerLost` 0회 ⓒ GET 1회, 저장 0회
- 스펙: `SettingsScreen.test.tsx`

### TC-ST-019 · 열기 OWNER_ONLY · 종류: 자동 · 요구: R-SET-010 · R-SET-001 · 설계: §7 OWNER_ONLY · F-ST-05(순서: OWNER_ONLY 먼저) · 토큰: 있음(주인 → 주인 아님)
- Given GET → `OWNER_ONLY`
- When 마운트한다
- Then ⓐ error 판 없음 ⓑ `onOwnerLost` 1회가 `onLeave({ message: '캐릭터 설정은 갠홈 주인만 열 수 있습니다.', tone: 'warning' })` 1회보다 먼저, `onAuthFailure` 0회 ⓒ GET 1회
- 스펙: `SettingsScreen.test.tsx`

### TC-ST-020 · 되돌리기 · 종류: 자동 · 요구: R-SET-009 · 설계: F-ST-11 · T-05 · F §3.5 마지막 단락(confirm 없음) · 토큰: 있음(주인)
- Given ready, 세계관 `고친 세계`
- When 「되돌리기」
- Then ⓐ 세계관 = 기준값, D `v3 저장됨 10.06 14:20`, `dialog`·`alertdialog` 없음 ⓑ 초안 = `draftFromSettings(base.settings)` ⓒ 저장 0회
- 스펙: `SettingsScreen.test.tsx`

### TC-ST-021 · 기본값 표시 · 종류: 자동 · 요구: R-SET-003 · R-SET-009 · 설계: S-14 default·saved · F-ST-20 · Rq §5.3 `statusDefault`·`statusSaved` · 토큰: 있음(주인)
- Given (a) GET → `DEFAULT_RESPONSE` (b) 같은 화면에서 유효 수정, 저장 → `ok(version 1, updatedAt 10.06 15:30)`
- When (a) 마운트 (b) 「저장」
- Then ⓐ (a) D `기본값 사용 중`, 두 버튼 disabled (b) D `v1 저장됨 10.06 15:30` ⓑ (b) 기준값 = 응답(`isDefault` false) ⓒ (a) 저장 0회 (b) 저장 1회
- 스펙: `SettingsScreen.test.tsx`(a) · `SettingsSave.test.tsx`(b)

### TC-ST-022 · 내보내기 · 종류: 자동 · 요구: R-SET-007 · R-NFR-004 · 설계: §10 · F-ST-12·13·14 · S-13 · SF-01~03 · C §3.7·§3.8·§3.10 · F §3.4 · A §2.4 · Rq §5.4·§5.6 `fileSaveFailed` · 토큰: 있음(주인)
- Given (a) 시각 2026-10-06 09:05(로컬, Date만 고정), 세계관 `고친 세계(미저장)`로 dirty, `URL.createObjectURL` → `'blob:settings-1'` (b) clean, `URL.createObjectURL`이 throw
- When ⋯ → `내보내기` → 「파일로 저장」
- Then ⓐ (a) ② `dialog "내보내기"`, 첫 포커스 = 읽기 전용 `내보낼 설정 JSON`, 그 값을 파싱하면 최상위 키 `format·formatVersion·exportedAt·settings`, `settings` = 기준값(초안 아님), `exportedAt` = 고정 시각 ISO, 문자열에 `apiKey|API_KEY|SECRET|token|version"|updatedAt|isDefault` 0건, 안내 `저장하지 않은 변경은 포함되지 않습니다.`. 저장 뒤 시트 유지 (b) 안내 없음, 시트 닫힘 → 토스트 `파일로 저장하지 못했습니다. 위 글을 복사해 주세요.`(`warning`) ⓑ (a) a 요소 `download = london-dispatch-characters-20261006-0905.json`·`href = blob:settings-1`·`rel = noopener`, 이어서 `revokeObjectURL('blob:settings-1')`. Blob type `application/json`, 내용 = 텍스트 영역 값 ⓒ (a) `createObjectURL` 1회. 저장 래퍼 0회, GET 1회
- 스펙: `ui/src/settings/test/SettingsFile.test.tsx`

### TC-ST-023 · stale 내보내기 · 종류: 자동 · 요구: R-SET-007 · R-SET-011 · 설계: S-13 · §11 D-ST-2 · F-ST-13 · C §3.8 note · Rq §5.4 `exportStaleNote` · 토큰: 있음 → 만료
- Given 말투 `'  보관할 말투  '` 저장 → `TOKEN_INVALID`(stale), 이어서 외형 801자 입력
- When ⋯ → `내보내기`
- Then ⓐ 텍스트 `settings` = 정규화 초안(말투 `보관할 말투`, 외형 801자 그대로), 안내 `인증이 만료되어 현재 초안을 내보냅니다.`, dirty 안내 없음 ⓑ stale 초안은 상한을 넘었어도 그대로 내보낸다 ⓒ 저장 1회(stale 만든 호출뿐)
- 스펙: `SettingsFile.test.tsx`

### TC-ST-024 · 가져오기(파일) · 종류: 자동 · 요구: R-SET-008 · 설계: §11 D-ST-11 · F-ST-15·17 · T-06 · SF-05 · C §3.9 · F §3.4 · Rq §5.6 `importSummary` · 토큰: 있음(주인)
- Given (a) 자체 형식 파일(세계관 `가져온 세계`, 시엘 말투 `가져온 반말`, 나머지 기준값) (b) 시엘 말투를 801자로 미저장 입력, 파일 = 자체 형식 `{ world: '가져온 세계' }`만
- When ⋯ → `가져오기` → 파일 선택 → (읽기 끝나 「불러오기」 enabled) → 「불러오기」 → (a) 「되돌리기」
- Then ⓐ (a) 시트 닫힘, 토스트 `가져왔습니다(공통 1·세바스찬 11·시엘 11). 저장해야 반영됩니다.`(`success`), 세계관 `가져온 세계`, D `저장하지 않은 변경 있음` → 되돌리기 뒤 세계관·시엘 말투 = 기준값 (b) 시트 닫힘, 토스트 `가져왔습니다(공통 1). 저장해야 반영됩니다.`, 시엘 말투 801자 그대로, D `시엘 · 말투는 1~800자여야 합니다.`, 「저장」 disabled ⓑ 초안만 바뀐다(후보 위치만) ⓒ `saveCharacterSettings` 0회(가져오기는 저장하지 않음)
- 스펙: `SettingsFile.test.tsx`

### TC-ST-025 · 가져오기(붙여넣기 · E.No.S) · 종류: 자동 · 요구: R-SET-008 · R-NFR-004 · 설계: SF-08·09 · F-ST-16·17 · api.md §16.3 · Rq §5.6 · 토큰: 있음(주인)
- Given (a) E.No.S 백업(`SETTINGS.apiKey`·`DB.chats` 포함, 세바스찬·시엘 모두 매핑 출처 문자열) (b) 백업, 세바스찬만 `age: 13`·`gender: {}`·`sample_dialogue: ['a', 1]`
- When ③ 붙여넣기 → 「불러오기」
- Then ⓐ (a) 토스트 `가져왔습니다(공통 1·세바스찬 8·시엘 8). 저장해야 반영됩니다.`, 세계관 `안개 낀 런던(E)`, 세바스찬 말투 `낮고 부드러운 존댓말(E)`·샘플 대사 `예.\n알겠습니다.`·외형 `키가 크다\n흑발\n붉은 눈\n흰 장갑`, 성격·배경·관계 메모·규칙·금기 = 기준값, 화면 텍스트에 `sk-SHOULD-NOT-LEAK`·`SHOULD-NOT-READ` 0건 (b) `가져왔습니다(공통 1·세바스찬 6). 무시한 항목 2개. 저장해야 반영됩니다.` ⓑ 저장소 키 0개 ⓒ 저장 0회
- 스펙: `SettingsFile.test.tsx`

### TC-ST-026 · 가져오기 거부 · 종류: 자동 · 요구: R-SET-008 · 설계: SF-05 ①~⑤ · S-15 · F-ST-15·17 · §11 D-ST-11 · C §3.9 오류 줄 · A §4 · Rq §5.5 · 토큰: 있음(주인)
- Given 붙여넣기 입력: `not json` · `{"foo":1}` · 자체 형식 `formatVersion: 2` · 맞는 world 없는 백업 · 자체 형식 `characters.ciel.speech` 801자 · 자체 형식 `world: ''` · 자체 형식 `characters.sebastian.speech: ''` / 파일: `size` = 5MB+1 / 파일: `FileReader` onerror
- When 「불러오기」(파일 두 건은 선택만)
- Then ⓐ ③ 안 `role=alert` 문구: `알 수 없는 파일 형식입니다.` ×2 · `지원하지 않는 파일 버전입니다.` · `세바스찬·시엘이 들어 있는 세계를 찾지 못했습니다.` · `시엘 · 말투는 1~800자여야 합니다.` · `공통 · 세계관은 1~2000자여야 합니다.` · `세바스찬 · 말투는 1~800자여야 합니다.`(모두 `checkCharacterSettings` 첫 위반 문장 그대로) · `파일이 5MB를 넘어 읽지 않았습니다.`(파일 이름 `huge.json` 표시, 「불러오기」 disabled) · `파일을 읽지 못했습니다.`. 시트 유지 ⓑ 취소 뒤 세계관 = 기준값, D `v3 저장됨 10.06 14:20`(초안 불변). 5MB 초과는 `FileReader.readAsText` 0회 ⓒ 저장 0회
- 스펙: `SettingsFile.test.tsx`

### TC-ST-027 · 가져오기 입력 규칙 · 종류: 자동 · 요구: R-SET-008 · 설계: §11 D-ST-9 · F-ST-15·16 · S §1 ③ 로컬·`readerActiveRef` · C §3.9 `isDisabled` · Rq §5.4 `noFileChosen`·`importNote` · 토큰: 있음(주인)
- Given ③ 시트 / (b) `readAsText`가 끝나지 않는 spy
- When (a) 빈 상태 → 붙여넣기 `'   '` → `not json` 불러오기(오류) → 파일 `mine.json` 선택 → 붙여넣기 `{` (b) 파일 선택 → 「취소」 → 늦은 `load` 이벤트 → ③ 다시 열기
- Then ⓐ (a) 처음 「불러오기」 disabled·`선택한 파일 없음`·안내 `초안에만 반영되고 저장은 따로 합니다.` · 공백만이면 disabled · 파일 선택 뒤 붙여넣기 값 `''`·오류 줄 사라짐·`mine.json` 표시·읽기 끝나면 enabled · 붙여넣기 입력 뒤 `선택한 파일 없음` (b) 읽는 중 「불러오기」 disabled, 늦은 onload 뒤에도 시트 없음, 다시 연 ③은 `선택한 파일 없음` ⓑ (b) `console.error` 0회(닫힌 시트의 리더 결과 무시) ⓒ 저장 0회
- 스펙: `SettingsFile.test.tsx`

### TC-ST-028 · 미저장 이탈 · 종류: 자동 · 요구: R-SET-009 · 설계: F-ST-18·19 · F §3.5 · C §1 시트 `'leave'` · A §2.4·§3 Esc · Rq §5.4 `leave*` · 토큰: 있음(주인)
- Given (a) clean ready / loading 중 (b) dirty (c) stale + dirty
- When (a) ‹ (b) 화면 Esc → ‹ → 「취소」 → ‹ → Esc → ‹ → 「나가기」 (c) ‹
- Then ⓐ (a) 확인 없이 진행 (b) 화면 Esc는 무동작. ‹ → `alertdialog "저장하지 않은 변경이 있습니다"`(설명 `나가면 고친 내용이 사라집니다. 나갈까요?`, 첫 포커스 「취소」) → 취소·Esc면 닫히고 입력값 유지 (c) ④ 표시 ⓑ (a) `onLeave()` 인자 없이 1회 (b) 나가기 전까지 `onLeave` 0회 → 「나가기」 뒤 `onLeave()` 인자 없이 1회 (c) `onLeave` 0회 ⓒ 저장 0회((c)는 stale 만든 1회뿐)
- 스펙: `SettingsScreen.test.tsx`(a)(b) · `SettingsSave.test.tsx`(c)

### TC-ST-029 · 시트 포커스 · 종류: 자동 · 요구: R-SET-009 · R-SET-007 · R-SET-008 · 설계: F-ST-12 · S §1 `fileMenuButtonRef`·`backButtonRef` · A §2.4·§2.5 · C §3.7~§3.9 · 토큰: 있음(주인)
- Given ready
- When ⋯ → Esc / ① → 내보내기 → ②에서 「파일로 저장」에 포커스 후 Tab → 「닫기」 / ① → 가져오기 → 「취소」 / ① → 「취소」 / dirty → ‹ → ④ 「취소」
- Then ⓐ ① 첫 포커스 `내보내기` · Esc 뒤 시트 없음·포커스 ⋯ · ②에서 Tab이 끝 → 처음(텍스트 영역)으로 순환 · ② 닫기 뒤 ⋯ · ③ 첫 포커스 `파일 선택` → 취소 뒤 ⋯ · ① 취소 뒤 ⋯ · ④ 취소 뒤 ‹ ⓑ 시트 상태 `'none'` 복귀(시트 DOM 없음) ⓒ api 호출 없음
- 스펙: `SettingsFile.test.tsx`

### TC-ST-030 · 역할·이름 · 종류: 자동 · 요구: R-SET-009 · R-ROOMS-005 · 설계: A §1 · A §2.2 · C §3.5 `aria-live` · Rq §5.1 `screenTitle`·`tabListAriaLabel` · 토큰: 있음(주인)
- Given ready, 포커스를 ‹ 에 둔다
- When 역할을 조회하고 Tab 3회
- Then ⓐ `main "캐릭터 설정"`, h1 `캐릭터 설정`(`tabIndex=-1`), tab 3개, tabpanel `aria-labelledby=settings-tab-world`, D `role=status`·`aria-live=polite`. Tab → `설정 파일 메뉴` → `공통 세계관` 탭 → `세계관, 필수` ⓑ 해당 없음(조회만) ⓒ api 추가 호출 없음
- 스펙: `SettingsScreen.test.tsx`

### TC-ST-031 · 라벨 단일 소스 · 종류: 자동 · 요구: R-SET-009 · R-SET-002 · R-CHAT-011 · 설계: §8 · C §3.4 · Rq §5 머리말·§5.1 `tabLabel`·§5.7 마지막 줄(인증 3문구 = rooms) · 토큰: 있음(주인)
- Given ready
- When 시엘 탭을 연다
- Then ⓐ 세계관 입력 이름 = `${WORLD_FIELD_SPEC.label}, 필수`(`세계관`), 탭 `공통 세계관`, 캐릭터 탭 이름 = `CHARACTERS[id].shortName`, 11필드 입력 이름 = `CHARACTER_FIELD_SPECS[key].label`(필수면 `, 필수`) ⓑ rooms `writeErrorText`의 `TOKEN_INVALID`·`TOKEN_REQUIRED`·`LEVEL_TOO_LOW` 문구 = 이 화면 열기 실패 문구(TC-ST-018과 같은 문장) ⓒ api 추가 호출 없음
- 스펙: `SettingsScreen.test.tsx`

### TC-ST-032 · state/settings.ts 단위 · 종류: 자동 · 요구: R-SET-002 · R-SET-009 · R-SET-011 · 설계: S §2.1~§2.4(S-01~S-15 · T-01~T-10 · 불변식) · S §3.3 V-4·V-6 · 토큰: 무관
- Given 순수 함수, 입력은 깊게 얼린 객체(`Object.freeze`)
- When 각 함수·리듀서 전이를 부른다
- Then ⓐ 해당 없음(순수) ⓑ S-01 `['a','b']`↔`a\nb` · S-02 `' x \r\n\n y '`→`['x','y']` · S-03 키 순서 = `CHARACTER_FIELD_KEYS`, 새 객체, 입력 불변 · S-04 trim·목록 분해·801자 그대로 · S-05 키 순서 무관·목록 비교 · S-06 공백만 = false, 줄바꿈 든 저장 항목도 열자마자 false · S-07 통과 값 = 정규화, 실패 문장 = `시엘 · 말투는 1~800자여야 합니다.`/`공통 · 세계관은 1~2000자여야 합니다.` · S-08 required/tooLong(800·801·이모지 800·나이 41)/tooManyLines(10·11)/lineTooLong(lineNo 2) · S-09·S-10 · S-11·S-12 조합 · S-13 평소 `base.settings` 같은 참조, stale = 정규화 초안 · S-14 순서 saving > stale > invalid > dirty > default(`isDefault` 또는 `updatedAt null`) > saved · **S-15** V-4 → `{ ok: false }`·`시엘 · 말투는 1~800자여야 합니다.`, V-6 world만 → ok·나머지 = base, 자체 형식 빈 필수 world·speech → 필수 문장, base 불변 · 불변식 경계 14벡터에서 `precheckDraft(d).ok === !anyFieldIssue(d)` · T-01~T-10 표 그대로, 그 밖 조합(loading+편집·error+reverted·ready+loadSucceeded·ready+saveFailed·!saving+saveSucceeded·stale+reverted/imported/saveStarted·saving+편집/reverted)은 같은 참조 · `SETTINGS_TABS = ['world','sebastian','ciel']` ⓒ api 호출 없음(모듈이 `@/api`를 import하지 않는다)
- 스펙: `ui/src/settings/test/state/settings.test.ts`

### TC-ST-033 · download.ts 단위 · 종류: 자동 · 요구: R-SET-007 · 설계: C §3.10 `downloadText` · L-ST-2 · 토큰: 무관
- Given 전체 가짜 시계, `createObjectURL` → `'blob:settings-1'` / (b) `createObjectURL` throw (c) `Blob` 생성자 throw
- When `downloadText('{"a":1}', 'x.json')` / (b)(c) `downloadText('x', 'x.json')`
- Then ⓐ a 요소 클릭 1회(`download = x.json`·`rel = noopener`), 클릭 뒤 문서에 `a` 0개 ⓑ 반환 `true` → 타이머 실행 전 `revokeObjectURL` 0회, 실행 뒤 `('blob:settings-1')` 1회 / (b)(c) 반환 `false`, `a` 0개, `console.error`·`console.log` 0회 ⓒ `createObjectURL` 1회, Blob type `application/json`
- 스펙: `SettingsFile.test.tsx`

### TC-ST-034 · toExportFile · 종류: 자동 · 요구: R-SET-007 · R-NFR-004 · 설계: SF-01~SF-04 · api.md §16.1·§16.4 · 토큰: 무관
- Given `now = 2026-10-06 09:05`(로컬) / (b) 입력에 `apiKey`·`version`·`updatedAt`·`isDefault`·`token`·`outputRules`·`grell` 캐릭터를 섞은 객체
- When `toExportFile` · `serializeExportFile` · `exportFileName` · `utf8ByteLength`
- Then ⓐ 해당 없음 ⓑ 최상위 키 = `format·formatVersion·exportedAt·settings`(4개, 순서), settings 키 = `world·characters`, 캐릭터 `sebastian·ciel` × `CHARACTER_FIELD_KEYS` 순서, 목록은 복사(다른 참조), `exportedAt = now.toISOString()` · (b) 직렬화 문자열 = 깨끗한 입력의 직렬화와 같음, `apiKey|API_KEY|SECRET|token` 0건, `LEAK|version|updatedAt|isDefault|updatedBy|outputRules|grell` 0건 · 파일명 `…-20261006-0905.json`·`…-20260101-0000.json`·`…-20261231-2359.json` · 바이트 `a`=1·`가`=3·`😀`=4 ⓒ api 호출 없음
- 스펙: `ui/src/settings/test/state/settingsFile.test.ts`

### TC-ST-035 · parseImportFile 벡터 · 종류: 자동 · 요구: R-SET-008 · R-NFR-004 · R-SET-012 · 설계: SF-05~SF-10 · S §3 확정 규칙(분류 3종) · S §3.3 V-1~V-6 · api.md §16.2·§16.3 · 토큰: 무관
- Given base = 기준값. 각 벡터 아래. 모든 호출 동안 `console.log/warn/error` spy
- When `parseImportFile(JSON.stringify(root), base)` · `detectImportSource(root)`
- Then ⓐ 해당 없음 ⓑ **판별**: self · `formatVersion 2` → unsupportedVersion · `DB.worlds` 배열 → enosBackup · `characters` 배열 + `description` 문자열 → enosWorld · `description: 5`·`DB.worlds: {}`·`{foo}` → unknownFormat. **거부**: `not json`·`[1,2]`·`"text"` → notJson · `{foo}` → unknownFormat · 버전 2 → unsupportedVersion · 맞는 world 없음 → noMatchingWorld · 5MB+1 바이트 → tooLarge(정확히 5MB는 크기 통과 → notJson). **자체**: 전 필드 후보 → `applied {world: true, sebastian: 11, ciel: 11}`, 정규화 값(`'  새 세계  '`→`새 세계`, `[' a ','','b']`→`['a','b']`), 값이 기준과 같아도 applied 그대로(다시 세지 않음) · `speech: 3`·`rules: 'x'` → 무시 2 · 키 생략·`null`·화이트리스트 밖 키(`apiKey`·`extra`·`token`·`grell`) → 0, 결과 문자열에 그 키 0건 · 배열에 문자열 아닌 항목 → 1 · `characters`·`settings`가 객체 아님 → 그 아래 없음(0) · 후보 0개 → ok, patch 필드 0, applied 0·false · 빈 필수 world·speech → invalid(필수 문장). **E.No.S**: V-1 첫 맞는 world·매핑 8필드(정확한 값 표)·persona·relationships·rules 없음·무시 0·결과에 `sk-SHOULD-NOT-LEAK`·`SHOULD-NOT-READ`·`apiKey`·`API_KEY`·`SECRET` 0건 · 맞는 world 둘이면 앞, 같은 이름 캐릭터 둘이면 첫 항목 · V-2 `age '13'`·무시 2·gender·sampleDialogue 없음 · V-3 speech·role 없음·무시 0·applied.sebastian 6 · `voice: 5`·`hair_style: []` → 무시 2, 빈 `eyes`는 제외(무시 아님), `personality_tags` 문자열 그대로 · world 단독(캐릭터 있음 → 그 캐릭터만, 없음 → world만, 무시 0). **보정**: V-4 `{ ok: false, reason: 'invalid', message: '시엘 · 말투는 1~800자여야 합니다.' }` · V-5 무시 1, `applied {true, 10, 11}`, sebastian `rules` 없음 · V-6 patch = world만·무시 0 → 리듀서 `imported` 뒤 801자 외형 유지·`precheckDraft` 실패 `세바스찬 · 외형은 800자 이하여야 합니다.` ⓒ api 호출 없음. `console` 0회(R-SET-012)
- 스펙: `ui/src/settings/test/state/settingsFile.test.ts`

### TC-ST-036 · 리뷰 grep · 종류: 수동 · 요구: R-NFR-004 · R-CHAT-009 · R-SET-012 · 설계: §10 마지막 단락 · F §2 마지막 단락 · S §3 머리말 · 토큰: 무관
- Given `ui/src/settings/**`(test 제외) · `ui/src/state/settings.ts` · `ui/src/state/settingsFile.ts` · 빌드 산출 `ui/dist`
- When grep: `fetch(` · `localStorage` · `sessionStorage` · `document.cookie` · `getToken` · `console.` / `ui/dist`에서 비밀값 패턴
- Then ⓐ 해당 없음(코드 리뷰) ⓑ 각 패턴 0건, `ui/dist`에 API 키·SECRET 실값 0건 ⓒ api 접근은 `@/api` 래퍼 import뿐 — 수동 확인표 `MC-ST-01`
- 스펙: `ui/src/settings/test/manual-checklist.md`

### TC-ST-037 · 스크린샷(수동) · 종류: 수동 · 요구: R-SET-009 · R-ROOMS-005 · R-SET-007 · 설계: §2.1·§2.2 · C §4 · A §5 · §12 차이 1~3 · 토큰: 있음(주인)
- Given 개발 서버, 뷰포트 390×565, 주인 토큰 주소
- When 세 탭 · ①②③④ 시트 · stale · loading · error · 토스트를 캡처한다
- Then ⓐ 가로 스크롤 없음, A 44 · B 40 · D 36(stale이면 F 40), 나이·성별 같은 줄, 필수 `*` danger, 카운터 over 색, 탭 `!` danger, 시트 높이 약 188 · 280 · 324/360 · 148 ⓑ 해당 없음 ⓒ 해당 없음 — 수동 확인표 `MC-ST-02`
- 스펙: `manual-checklist.md`

### TC-ST-038 · 실제 iframe 파일 저장(수동, S5 이후) · 종류: 수동 · 요구: R-SET-007 · 설계: L-ST-2 · C §3.10 마지막 줄 · api.md §16.1 · 토큰: 있음(주인)
- Given 갠홈 패널 안 iframe(실제 sandbox 속성), 주인 토큰
- When ② 「파일로 저장」을 누르고, 막히면 텍스트 영역을 길게 눌러 복사한다
- Then ⓐ 파일이 내려받아지거나, 막히면 복사 경로로 같은 JSON을 얻는다 ⓑ 내려받은 파일 이름 `london-dispatch-characters-YYYYMMDD-HHmm.json` ⓒ 해당 없음 — 수동 확인표 `MC-ST-03`
- 스펙: `manual-checklist.md`

### TC-ST-039 · 가져올 항목 없음 · 종류: 자동 · 요구: R-SET-008 · 설계: §11 D-ST-11 끝 · F-ST-17 반영 0 분기 · Rq §5.6 `importNothing` · 토큰: 있음(주인)
- Given 세계관 `고친 세계`로 dirty / 붙여넣기 (a) 자체 형식 `settings: {}` (b) 자체 형식 `{ world: 5 }`
- When 「불러오기」
- Then ⓐ 시트 닫힘, 토스트 (a) `가져올 항목이 없습니다.`(`warning`) (b) `가져올 항목이 없습니다. 무시한 항목 1개.` ⓑ 세계관 `고친 세계` 유지, D `저장하지 않은 변경 있음` 유지(초안·dirty 불변) ⓒ 저장 0회
- 스펙: `SettingsFile.test.tsx`

### TC-ST-040 · 저장 뒤 포커스 · 종류: 자동 · 요구: R-SET-009 · 설계: F-ST-09·10 포커스 · S §1 `focusTargetRef`·`saveButtonRef` · A §2.6 · 토큰: 있음(주인 → 만료)
- Given 유효 dirty. 저장 응답 차례로 `INTERNAL` → `ok(version 4)` → `TOKEN_INVALID`
- When 「저장」 3회(사이에 말투 수정)
- Then ⓐ 1회째 뒤 포커스 「저장」, 2회째 뒤 D `v4 저장됨 10.06 15:30`·포커스 h1, 3회째 뒤 stale 안내·포커스 h1 ⓑ 해당 없음(포커스만) ⓒ 저장 3회
- 스펙: `SettingsSave.test.tsx`

### TC-ST-041 · 가져오기 화면 통합(벡터 ④·⑥) · 종류: 자동 · 요구: R-SET-008 · 설계: S §3.3 V-4·V-6 · F-ST-17 · §11 D-ST-11 · api.md §16.3 벡터 4·6행 · 토큰: 있음(주인)
- Given (④) 자체 형식 파일 `characters.ciel.speech` 801자 (⑥) 세바스찬 외형 801자 미저장 입력 + E.No.S world 단독 파일(`description`만 유효)
- When ③ 파일 선택 → 「불러오기」
- Then ⓐ (④) 오류 줄 `role=alert` `시엘 · 말투는 1~800자여야 합니다.`, 취소 뒤 시엘 말투 = 기준값, D `v3 저장됨 10.06 14:20` (⑥) 시트 닫힘, 토스트 `가져왔습니다(공통 1). 저장해야 반영됩니다.`, 외형 801자 그대로, D `세바스찬 · 외형은 800자 이하여야 합니다.`, 「저장」 disabled, 세계관 `안개 낀 런던(E)` ⓑ (④) 초안 불변 (⑥) 세계관만 바뀜 ⓒ 저장 0회
- 스펙: `SettingsFile.test.tsx`

## TC-FLOW

표기: `A → B`는 순차 인계(A의 결과가 B의 Given), `분기:`는 같은 지점의 독립 대안. ⓒ 호출 횟수는 단계 증분으로 읽는다(rooms 규약과 같음).

### TC-FLOW-ST-01 · U-ST-01 읽기 전용 방문자 · Steps: TC-RM-035(a) → TC-RM-035(b)
- 토큰 없이 App 시작(→ 판정 GET 없음, ⚙·「+ 새 방」 없음) → RoomsScreen 단위에서 읽기 전용이면 `isOwner`가 true여도 ⚙ 없음

### TC-FLOW-ST-02 · U-ST-02 등급 회원(주인 아님) · Steps: TC-RM-034 → TC-RM-035(b)
- 토큰 있음 + 판정 403·401·네트워크·5xx(→ ⚙ 없음, 「+ 새 방」·토큰 유지, 안내 없음) → 비주인 분기 렌더 확인

### TC-FLOW-ST-03 · U-ST-03 주인이 설정을 고쳐 저장 · Steps: TC-RM-033(a) → TC-RM-036 → TC-ST-001 → TC-ST-003 → TC-ST-004 → TC-ST-010 → TC-ST-011 → TC-ST-040
- 판정 200(→ ⚙) → ⚙ 진입(→ 설정 화면, GET 2회째) → 로딩 → 공통 세계관 탭부터(→ ready) → 탭 오가며 편집(→ 초안 유지) → dirty 표시 → 저장 성공(→ vN 저장됨, 토스트) → 포커스 h1

### TC-FLOW-ST-04 · U-ST-04 상한·필수 위반 · Steps: TC-ST-003 → TC-ST-008 → TC-ST-009 · 분기: TC-ST-032(불변식)
- ready → 상한 초과(→ 카운터·안내·탭 !·저장 비활성·D 첫 위반) → 필수 빈 칸(→ 같은 표시). 분기: 필드 안내와 하단 줄 판정이 어긋나지 않음

### TC-FLOW-ST-05 · U-ST-05 되돌리기 · Steps: TC-ST-010 → TC-ST-020
- dirty(→ 되돌리기 활성) → 되돌리기(→ 기준값, 확인 시트 없음)

### TC-FLOW-ST-06 · U-ST-06 저장 안 하고 뒤로 · Steps: TC-ST-010 → TC-ST-028(b) → TC-RM-036 · 분기: TC-ST-028(a) | TC-ST-029(④ 취소 포커스)
- dirty → ‹(→ ④, 취소면 머묾, 나가기면 `onLeave()`) → rooms 재마운트·목록 재로드. 분기: clean이면 바로 나감 | ④ 취소 뒤 ‹ 포커스

### TC-FLOW-ST-07 · U-ST-07 내보내기 · Steps: TC-ST-022 → TC-ST-034 · 시각: TC-ST-037 · 실기: TC-ST-038 · 분기: TC-ST-033
- ⋯ → ① → ②(기준값 JSON, 파일로 저장 → Blob 다운로드) → 내용이 화이트리스트·비밀값 0. 분기: 다운로드 유틸 단위

### TC-FLOW-ST-08 · U-ST-08 가져오기 후 저장 · Steps: TC-ST-027 → TC-ST-024(a) → TC-ST-011 · 분기: TC-ST-025 | TC-ST-026 | TC-ST-039 | TC-ST-041 | TC-ST-024(b) | TC-ST-035
- ③ 입력 규칙(→ 파일 하나) → 불러오기(→ 초안 반영·요약 토스트, 저장 안 함) → 사용자가 저장(→ 성공). 분기: E.No.S 붙여넣기 | 거부 사유별 | 반영 0 | 벡터 ④·⑥ 화면 | 후보 밖 초안 오류 | 순수 벡터

### TC-FLOW-ST-09 · U-ST-09 인증 만료 중 저장 · Steps: TC-ST-010 → TC-ST-016 → TC-ST-023 → TC-ST-028(c)
- dirty → 저장 401·403(→ stale, 초안 보존, App 전환 1회, 안내 줄) → 내보내기(→ 초안 JSON) → ‹(→ ④)

### TC-FLOW-ST-10 · U-ST-10 주인에서 빠짐 · Steps: TC-RM-036 → TC-ST-019 → TC-RM-037(a) · 분기: TC-ST-017
- ⚙ 진입 → 열기 OWNER_ONLY(→ `onOwnerLost` → `onLeave(ownerOnly)`) → rooms 토스트 1회·⚙ 없음·「+ 새 방」 유지. 분기: 저장 중 OWNER_ONLY

### TC-FLOW-ST-11 · U-ST-11 서버 불통 · Steps: TC-ST-001 → TC-ST-002
- 로딩 → 오류 + 다시 시도(→ GET 2회째 → ready)

### TC-FLOW-ST-12 · U-ST-12 저장 거절 · Steps: TC-ST-010 → 분기: TC-ST-014 | TC-ST-015 | TC-ST-013
- dirty → 429(→ warning, 초안 유지) | 네트워크·5xx(→ danger) | 400(→ 서버 문장)

## 추적표

### 요구 ↔ TC

| 요구ID | TC | 비고 |
|---|---|---|
| R-SET-007 🔒 | TC-ST-016 · 022 · 023 · 029 · 033 · 034 · 037 · 038 | 수용 기준 "출력 키 집합·금지 패턴 0건" = 034 |
| R-SET-008 | TC-ST-024 · 025 · 026 · 027 · 029 · 035 · 039 · 041 | 수용 기준 "변환 벡터 5종" = 035(자체·백업·world 단독·잘못된 형식·apiKey 포함) |
| R-SET-009 🔒 | TC-ST-001 ~ 012 · 020 · 021 · 028 ~ 031 · 037 · 040 · TC-RM-033 · 035(b) · 036 · 039 · 040 | 수용 기준 "비주인·읽기 전용 ⚙ DOM 부재" = TC-RM-034·035, "3탭·시트 스크린샷" = 037 |
| R-SET-010 | TC-ST-017 · 019 · TC-RM-033 · 034 · 035 · 037 · 038 | 수용 기준 "403·401 수신 후에도 canWrite 유지" = TC-RM-034 |
| R-SET-011 | TC-ST-016 · 023 · 028(c) · 032(T-10·S-13) | |
| R-SET-001 🔒(참조) | TC-ST-017 · 019 · TC-RM-037 | |
| R-SET-002 🔒(참조) | TC-ST-006 · 007 · 008 · 009 · 031 · 032 | |
| R-SET-003 🔒(참조) | TC-ST-011 · 021 | |
| R-SET-004 🔒(참조) | TC-ST-001 · 002 · 003 · TC-RM-036 | 들어올 때마다 다시 GET = 003·RM-036 |
| R-SET-005 🔒(참조) | TC-ST-007 · 011 · 012 · 013 · 014 · 015 | |
| R-SET-006 🔒(참조) | TC-ST-006 | outputRules 입력 없음 |
| R-SET-012(참조) | TC-ST-035 · 036 | console 0회 · grep |
| R-ROOMS-002 🔒(영향) | TC-RM-033 · 034 · 035 | |
| R-ROOMS-005 🔒(영향) | TC-ST-030 · 037 · TC-RM-040 | |
| R-CHAT-011(영향) | TC-ST-014 · 016 · 018 · 031 · TC-RM-034 · 038 | 판정에는 미적용 = RM-034 |
| R-CHAT-009 🔒(참조) | TC-ST-036 · TC-RM-034 | 화면이 토큰을 읽지 않음 |
| R-NFR-004 🔒(영향) | TC-ST-022 · 025 · 034 · 035 · 036 | |

### 설계 항목 ↔ TC

| 설계 항목 | TC |
|---|---|
| design §2.1 ready 판 · §2.2 상태 변형 8행(loading · error · clean · dirty · saving · stale · 토스트 · 시트) | 001 · 002 · 003 · 010 · 012 · 016 · 011 · 029 · 037 |
| design §7 계약 사용표(E15 판정·열기 · E16 · isAuthFailure) · 에러 코드 표 9행 | 003 · 011 · 013 ~ 019 · 002 · TC-RM-033 · 034 |
| design §10 토큰·주인 분기 4행 | TC-RM-033 · 034 · 035 · 038 · 016 · 023 |
| design §11 D-ST-1 처음 탭 · 2 stale 비활성 · 3 하단 36 · 4 400 탭 유지 · 5 다시 GET · 6 저장 중 잠금 · 7 OWNER_ONLY 초안 버림 · 8 stale 토스트 없음 · 9 하나만 · 10 안내 문구 2종 · 11 후보 검사 | 003 · 016 · 037 · 013 · 003/RM-036 · 012 · 017 · 016 · 027 · 008 · 024/026/035/039/041 |
| design §11 L-ST-1 · L-ST-2 · L-ST-3 | 017 · 038 · 032(S-06) |
| design §12 차이 1~3 · 계약 보정 · Toast success | 037(시각) · 035 · 011 |
| design §13 공용화 후보 | 비행동 항목 — TC 대상 아님 |
| C §1 트리(⋯ ready 때만 · 시트 하나) | 001 · 029 |
| C §3.1 SettingsScreen props | 017 · 018 · 019 · 028 |
| C §3.2 Tabs | 005 · 008 · 009 · 030 |
| C §3.3 FormField · §3.4 WorldForm·CharacterForm | 006 · 007 · 008 · 009 · 031 |
| C §3.5 StatusBar | 003 · 010 · 012 · 021 · 030 |
| C §3.6 StaleNotice | 016 |
| C §3.7 FileMenuSheet · §3.8 ExportSheet · §3.9 ImportSheet·FilePicker | 016 · 022 · 023 · 024 ~ 027 · 029 |
| C §3.10 downloadText | 022 · 033 · 038 |
| C §4 스타일·세로 배분 | 037 |
| S §1 화면 상태(activeTab · sheet · toast · isActiveRef · saveInFlightRef · titleRef · fileMenuButtonRef · ③ 로컬 · readerActiveRef · focusTargetRef · backButtonRef·saveButtonRef · ② 로컬) | 003 · 029 · 011 · 001 · 012 · 003/040 · 029 · 027 · 027 · 040 · 029/040 · 022 |
| S §2.2 S-01 ~ S-15 · 불변식 | 032(전부) · 007 · 008 · 009 · 010 · 021 · 023 |
| S §2.3 T-01 ~ T-10 · 그 밖 조합 | 032 · 002 · 004 · 011 · 016 · 020 · 024 |
| S §3 분류 3종 · SF-01 ~ SF-10 · V-1 ~ V-6 | 034 · 035 · 041 · 025 · 026 · 039 |
| F-ST-01 ~ 04 | 001 · 002 · 003 |
| F-ST-05 handleLoadFailure | 002 · 018 · 019 |
| F-ST-06 · 07 · 08 | 004 · 005 · 008 · 009 · 010 |
| F-ST-09 · 10 | 007 · 011 ~ 017 · 040 |
| F-ST-11 · 12 · 13 · 14 | 020 · 029 · 022 · 023 |
| F-ST-15 · 16 · 17 | 024 ~ 027 · 039 · 041 |
| F-ST-18 · 19 · 20 · 21 | 028 · 021 · 003 · 011 · 024 · 025 · 026 · 039 |
| F §3.1 ~ §3.5 파이프라인 | 003 · 002/018/019 · 011 ~ 017 · 022 ~ 027 · 028 |
| A §1 랜드마크·이름 · §2 포커스 순서 7항 · §3 키보드 · §4 상태 알림 · §5 색·터치 | 030 · 003 · 029 · 040 · 005 · 028 · 016 · 026 · 037 |
| Rq §5.1 · §5.2 · §5.3 · §5.4 · §5.5 · §5.6 · §5.7 문구 | 006/030/031 · 008/009 · 003/010/012/016/021 · 022/023/027/028/029 · 026/041 · 002/011/022/024/025/039/016 · 013 ~ 019/031 |

### 사용자행 ↔ TC-FLOW

| 사용자행 | TC-FLOW |
|---|---|
| U-ST-01 | TC-FLOW-ST-01 |
| U-ST-02 | TC-FLOW-ST-02 |
| U-ST-03 | TC-FLOW-ST-03 |
| U-ST-04 | TC-FLOW-ST-04 |
| U-ST-05 | TC-FLOW-ST-05 |
| U-ST-06 | TC-FLOW-ST-06 |
| U-ST-07 | TC-FLOW-ST-07 |
| U-ST-08 | TC-FLOW-ST-08 |
| U-ST-09 | TC-FLOW-ST-09 |
| U-ST-10 | TC-FLOW-ST-10 |
| U-ST-11 | TC-FLOW-ST-11 |
| U-ST-12 | TC-FLOW-ST-12 |

## 설계 확인 필요 (ui-designer에 돌릴 것 — 스펙은 아래 가정으로 작성)

| # | 위치 | 내용 | 스펙의 가정 |
|---|---|---|---|
| Q1 | state.md 머리말 | 단위 테스트 경로가 `ui/src/state/__tests__/settings*.test.ts`로 적혀 있다. 이번 위임 자원 경계는 `ui/src/settings/test/**`다 | `ui/src/settings/test/state/`에 둠. 설계 경로를 고치거나 구현자가 옮긴다 |
| Q2 | design.md §7 끝에서 3번째 줄 | "테스트는 `vi.mock('@/api')`로 두 래퍼를 모킹한다". barrel 전체를 mock하면 `isAuthFailure`·`configureClient` 실물을 못 쓴다. 기존 관례·api.md §11.13은 모듈 `ui/src/api/settings.ts` | `vi.mock('@/api/settings')` |
| Q3 | functions.md F-ST-05·10·15·17·21 | labels 함수 위치가 섞여 있다(`labels.authText`·`labels.saveErrorText`·`labels.importSummary` 객체 멤버 vs `importFailureText(…)` 단독). rooms는 `writeErrorText`가 단독 export | 스펙은 settings labels를 import하지 않고 문구 원문을 비교한다 |
| Q4 | a11y.md §1 입력 행 | 목록 필드 입력 `ariaLabel`에 `listHint`가 들어가는지 불명 | `샘플 대사`·`규칙·금기`(hint 제외) |
| Q5 | components.md §3.7 | FileMenuSheet 「가져오기」 `isDisabled`가 `button[disabled]`로 렌더된다는 전제(SheetItem 정의는 rooms C §1.15) | `getByRole('button', { name: '가져오기' }).disabled` |
| Q6 | design §14 RTM ↔ rooms design §14 | R-SET-010 예정 TC가 settings는 RM-033·034·035·037, rooms는 RM-034·035·037·038로 다르다 | 추적표는 합집합 |
| Q7 | Rq §5.6 `importSummary` | 범위 구분자 `·` 앞뒤 공백 여부 | 공백 없음: `공통 1·세바스찬 8·시엘 8` |

## 변경 대기열(미검증)

| Q-nn | 일자 | CR-ID | 변경 요약 | 변경 파일 | 영향 TC 후보 | 신규 TC 필요 | 상태 |
|---|---|---|---|---|---|---|---|
| (없음) | | | | | | | |

## 변경이력

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v0.1 | 2026-10-06 | 최초 작성(신규 모드). TC-ST-001 ~ 041(자동 38 · 수동 3), TC-FLOW-ST-01 ~ 12, 추적표 3종, 설계 확인 필요 Q1 ~ Q7. 스펙 초안 `SettingsScreen`·`SettingsSave`·`SettingsFile`·`state/settings`·`state/settingsFile` + 픽스처, 수동 확인표 | S3c, settings design.md v1.2 §14.1 · rooms CR-001 |
