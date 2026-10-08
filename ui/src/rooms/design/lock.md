# rooms 상세 설계 — S6 방 비밀번호 잠금 (분할 문서)

> 주 문서: `ui/src/rooms/design.md`(RTM §14 · S6 행 포함). 이 파일은 S6 묶음의 레이아웃·컴포넌트·상태·기능·파이프라인·계약·문구·읽기 전용 분기·결정의 상세다. 예정 TC(TC-RM-041~066)는 `design/tc.md` §14.2.
> 요구: `ui/src/rooms/requirements.md` v1.7 §1(R-ROOMS-001·002·004 S6 개정) · §1.2(R-LOCK-001·003·004·005·006·007·008·009).
> 구성안: `doc/200_설계/architecture/ui-layout-04-room-lock.md` §2(B 2줄 판) · §3(입장 시트) · §4(ListRow 잠긴 변형) · §12(메인 결정 Q1·Q2) — **수용, 구조 변경 없음**. §8 주의점은 이 문서 §11에서 확정한다.
> 계약: `doc/200_설계/contract/api.md` **v0.9** §2.8(입장 증명·관문·화면 보관) · §4.2(E3 `locked`) · §4.6(E4 `password?`/`entryKey`) · §4.19(E17) · §5.10(shared 타입·상수) · §11.18(ui/api) · 「ui 인계 메모」 S6 — 확정. 인용만 한다(재정의 아님).
> 근거: `doc/200_설계/architecture/s6-02-전반설계.md` §2.3 · §6.1 · §6.2 · §6.4 · §8.1(U1~U10). 공용 요소 시그니처의 단일 정의는 `design/components.md` §1(S6 델타 §1.7 · §1.12 · §1.17 · §1.21~§1.23).

비유: 잠긴 방은 문에 번호 자물쇠가 달린 열람실이다. 안내판(목록)에는 방 이름과 자물쇠만 보이고 마지막으로 쓴 날짜는 가린다. 문 앞에서 번호를 맞히면 그 방 전용 도장(입장 증명)을 받아 수첩(`localStorage` `ld:roomKeys`)에 적어 두고, 다음에는 도장만 보여 주고 들어간다. 회원 출입증(토큰)은 여전히 주머니(메모리)에만 있다.

---

## 1. 레이아웃 [확정 — 구성안 ui-layout-04 §2~§4, 메인 결정 Q1 채택안 B]

### 1.1 토큰 있음 판 — 「+ 새 방」을 누른 뒤 (B 2줄)

```
+----------------------------------------------+
| ROOMS                              [+ 새 방] |  A 상단 바 44 (주인이면 [*] 추가 — 불변)
+----------------------------------------------+
| [새 방 제목 입력              0/60] [ 취소 ] |  B1 36 (B 위 padding 8)
| [비밀번호(선택,6자 이상 권장) 0/32] [만들기] |  B2 36 (줄 간격 8, 아래 padding 8)
+----------------------------------------------+
| 티타임                                 10.05 |  C 방 목록 flex 425 (행 56)
+----------------------------------------------+
| [L] 비밀 다과회                              |  잠긴 행(§1.4)
+----------------------------------------------+
| 체스 대결                              10.03 |
+----------------------------------------------+
```

`[L]` = 16px 자물쇠 그림(ASCII 표기용, 실제는 인라인 SVG). B2 placeholder 실제 문구는 `비밀번호(선택, 6자 이상 권장)`(§8).

| 상태 | A | B | C | E' 토스트 |
|---|---|---|---|---|
| B 닫힘 | 44 | — | 521 | — |
| **B 열림(S6)** | 44 | **96**(8 + 36 + 8 + 36 + 8) | **425** | — |
| B 열림 + 토스트 | 44 | 96 | 397 | 28 |

- B 안의 두 줄은 한 덩어리다. 구분선은 B 아래 한 줄(지금 `border-bottom` 그대로).
- 각 줄 = 입력(flex 1, `min-width: 0`) + 버튼 1개. 버튼은 **Button `size='md'`(36)**, 두 버튼 최소 폭 72px로 맞춰 두 입력의 오른쪽 끝이 한 세로선에 선다(구성안 §2.1 · §6 ③). 줄 안 간격 `--space-2`(8), B 좌우 padding `--space-4`(16).
- 폭 < 354px 패널이면 B2 placeholder 끝이 잘린다(구성안 §7). 입력값에는 영향 없다.

### 1.2 읽기 전용 판 (잠긴 방이 섞인 목록)

```
+----------------------------------------------+
| ROOMS                                        |  A 44
+----------------------------------------------+
| 티타임                                 10.05 |  C 521 (행 56)
+----------------------------------------------+
| [L] 비밀 다과회                              |  잠긴 행 — 날짜 DOM 없음
+----------------------------------------------+
| 체스 대결                              10.03 |
+----------------------------------------------+
```

- A 버튼 없음 · B 없음 · C 521px — S2 읽기 전용 판과 같다. 잠긴 행 표시(§1.4)와 입장 시트(§1.3)만 더해진다.

### 1.3 입장 시트 (PromptSheet 재사용 — 잠긴 행 탭 · rooms·chat 공용)

```
+----------------------------------------------+
| (뒤 화면: 반투명 덮개, 탭하면 닫힘)          |
|                                              |
+----------------------------------------------+
| 비밀번호                                     |  제목 h2
| [****                                  4/64] |  TextInput password 36
| 비밀번호가 맞지 않습니다.                    |  role=alert 한 줄(있을 때만)
| [  취소  ]                        [  입장  ] |  Button lg 44 x 2
+----------------------------------------------+
```

- 높이: 문구 없음 약 160px, 문구 1줄 약 185px, 2줄 약 202px(최대 70% 안). 덮개는 화면 루트(`position: relative`) 전체.
- 카운터 상한은 **64**(계약 `ROOM_ENTER_PASSWORD_MAX`, §11 D-L2). 시트 제목에 방 이름은 넣지 않는다(구성안 §9 추가 후보, 요구 없음).

### 1.4 ListRow 잠긴 변형

```
+----------------------------------------------+
| 티타임                                 10.05 |  안 잠김 — 지금 그대로(제목 · MM.DD)
+----------------------------------------------+
| [L] 비밀 다과회                              |  잠김 — 자물쇠 16 + 간격 8 + 제목
+----------------------------------------------+
```

| 항목 | 안 잠김(불변) | 잠김 |
|---|---|---|
| 자식 | 제목(flex 1) · `<time>`(flex none) | 묶음 `.titleGroup`(flex 1, `gap: var(--space-2)`) = 자물쇠 SVG(16×16, `aria-hidden`, `--color-fg-muted`) + 제목 |
| 날짜 | `<time dateTime>MM.DD</time>` | **DOM에 없음**(`display:none` 금지) |
| 행 높이 | 56 | 56 |
| 제목 말줄임 폭 390px | 316 | 334 |
| 제목 말줄임 폭 328px 패널 | 254 | 272 |
| 접근성 이름 | `{제목}, 마지막 갱신 {MM.DD}`(불변) | `{제목}, 잠긴 방`(날짜 없음) |

- 잠긴 행 제목 시작선은 24px 오른쪽이다. 안 잠긴 행에 빈 자리를 두지 않는다(구성안 §4).
- 목록 순서는 서버 순서 그대로(`updatedAt` 내림차순, 화면 재정렬 없음). 잠긴 방의 `updatedAt`은 받되 그리지 않는다(U8 — 화면 표시 규칙, 계약 불변).
- **넣지 않는 것**: 상단 바 자물쇠 · 비밀번호 확인 칸 · 비밀번호 보기 토글(s6-02 §15, 인계 §3.6).

---

## 2. 컴포넌트

### 2.1 트리 델타

```
RoomsScreen (ui/src/rooms/index.tsx)
├─ TopBar …                                        (불변)
├─ NewRoomRow [rooms 로컬, S6 2줄]                 viewer.canWrite && create.isOpen
│   ├─ 줄 B1: TextInput(제목) · Button md secondary 「취소」
│   └─ 줄 B2: TextInput type='password'(비밀번호) · Button md primary 「만들기」
├─ <section> ListArea → RoomList → ListRow × n     ListRow 잠긴 변형(isLocked)
├─ entry.sheet && RoomEntrySheet [지역 공용 components/roomEntry, S6]   토큰과 무관
│   └─ PromptSheet [공용 ui, S6 델타 inputType·placeholder] → TextInput type='password'
└─ Toast …                                         (불변)
훅: useRoomsLoader(S6: 자동 진입 조건) · useNewRoomUi/useCreateRoom(S6: 비밀번호·증명 저장) · useRoomEntry(S6 신규, 지역 공용)
```

- `RoomEntrySheet`는 `<section>` 다음, `Toast` 앞에 렌더한다(시트 덮개가 목록·B 위에 덮인다, 토스트 줄은 시트 밖 맨 아래).

### 2.2 배치 3단계 분류

| 컴포넌트·모듈 | 위치 | 분류 | 근거 | 쓰는 화면 | 상세 |
|---|---|---|---|---|---|
| `TextInput` `type` 델타 | `ui/src/components/ui/TextInput/` | ① 공용 ui 델타 | s6-02 §6.4 | rooms B2 · 입장 시트 · chat 잠금 시트 | components.md §1.12 |
| `PromptSheet` `inputType`·`placeholder` 델타 | `ui/src/components/ui/PromptSheet/` | ① 공용 ui 델타 | s6-02 §6.4 · 구성안 §8-1 | 입장 시트 · chat 잠금 설정·변경 | components.md §1.17 |
| `roomKeys` | `ui/src/state/roomKeys.ts` | 상태 모듈(순수 함수 + 메모리 슬롯) | s6-02 §2.3 · api.md §2.8.2 | rooms · chat · `main.tsx` | components.md §1.21 · §4 F-RM-30~37 |
| `storage` 증명 키 3함수 | `ui/src/components/utils/storage.ts` | ③ 공용 유틸 델타 | 저장소 단일 접근 지점 | `roomKeys`만 | components.md §1.7 |
| `limits` 비밀번호 3함수 | `ui/src/state/limits.ts` | 상태 모듈 델타 | R-LOCK-001 (trim 없음) | rooms B2 · 입장 시트 · chat | components.md §1.11 |
| `useRoomEntry` · `RoomEntrySheet` · `roomEntryText` | `ui/src/components/roomEntry/` | **지역 공용**(rooms·chat 둘이 쓰는 기능 묶음, `components/ui` 아님) | 아래 D-L8 | rooms 행 탭 · chat 입장 재요구 | components.md §1.22 · §1.23 |
| `ListRow` 잠긴 변형 · `LockGlyph` | `ui/src/rooms/components/ListRow.tsx` | ④ rooms 로컬(`LockGlyph`는 같은 파일 지역 컴포넌트, 승격 안 함) | s6-02 §6.4 | rooms | components.md §2.1 |
| `RoomList` · `NewRoomRow` | `ui/src/rooms/components/` | ④ rooms 로컬 | — | rooms | components.md §2.2 · §2.4 |

- 새 표준 HTML 원소 직접 사용 없음. 자물쇠 `<svg>`는 `ListRow` 안(이미 `<button>`·`<time>`을 품은 로컬 원소 컴포넌트)에만 있다.
- 새 라이브러리 없음.

---

## 3. 상태

| 상태 | 용도 | 타입 | 초기값 | 소유 |
|---|---|---|---|---|
| `create` (S6 확장) | 새 방 입력 | `CreateState = { isOpen: boolean; title: string; password: string; isSubmitting: boolean }` | `{ isOpen: false, title: '', password: '', isSubmitting: false }` | `useCreateRoom` 내부 `useState`. 닫기·취소·전환·성공 언마운트로 `password`가 사라진다 |
| `passwordInputRef` | B1 Enter → B2 포커스 대상 | `RefObject<HTMLInputElement>` | `null` | `NewRoomRow` 내부 `useRef`(외부 노출 없음) |
| `sheet` | 입장 시트 상태 | `EntrySheet = { room: RoomSummary; isBusy: boolean; error: ApiError \| null } \| null` | `null` | `useRoomEntry` 내부 `useState` |
| `quietInFlightRef` | 조용한 입장 시도(③) 중 탭 무시 | `MutableRefObject<boolean>` | `false` | `useRoomEntry` 내부 |
| `submitInFlightRef` | 시트 제출 같은 틱 연타 방지 | `MutableRefObject<boolean>` | `false` | `useRoomEntry` 내부 |
| `isActiveRef` · `latestRef` | 언마운트 뒤 응답 무시 · 최신 콜백 | `MutableRefObject<boolean>` · `MutableRefObject<UseRoomEntryOptions>` | `false`(마운트 effect에서 true) · 첫 options(매 렌더 `useLayoutEffect` 갱신) | `useRoomEntry` 내부(useRoomsLoader와 같은 방식) |
| 증명 캐시 | 방 id → 증명. 저장소 실패 시에도 같은 세션 동작 | `readonly RoomKeyEntry[] \| null` | `null`(첫 접근 때 저장소에서 1회 읽음) | `ui/src/state/roomKeys.ts` 모듈 슬롯 |

- **비밀번호 원문은 `useRoomEntry`·저장소·App 어디에도 두지 않는다.** 입장 시트 입력값은 `PromptSheet` 로컬 `value`에만 있고 시트가 언마운트되면 사라진다. 새 방 비밀번호는 `create.password`에만 있고 입력 행이 닫히면 `''`가 된다.
- 토큰 상태·`viewer`는 불변(components.md §1.8 · §1.10). 화면은 주인 여부를 이 흐름에 쓰지 않는다(api.md §2.8.4).

---

## 4. 기능 명세 (F-RM-30~)

| # | 시그니처(위치) | 입력 | 출력·상태 변경 | 동작 | 예외·분기 | 요구ID |
|---|---|---|---|---|---|---|
| F-RM-30 | `parseRoomKeys(raw: string \| null): readonly RoomKeyEntry[]` (`state/roomKeys.ts`, 순수) | 저장소 원문 | 쌍 배열 | `null`·`''` → `[]`. `JSON.parse`를 try/catch. 배열이 아니면 `[]`. 원소는 **정확히 길이 2인 배열이고 두 값이 모두 빈 문자열이 아닌 string인 것만** 채택한다(길이 1·3 이상·비문자열·빈 문자열은 버림). 같은 방 id가 여러 번이면 **마지막 쌍이 이기고 그 쌍은 맨 뒤(최신) 자리에 둔다**(앞선 쌍은 제거). 길이가 50을 넘으면 뒤쪽 50개 | throw 없음 | R-LOCK-004 · R-LOCK-007 |
| F-RM-31 | `upsertRoomKey(entries, roomId: string, entryKey: string): readonly RoomKeyEntry[]` (순수) | 배열·방·증명 | 새 배열 | 같은 방 쌍을 빼고 맨 뒤에 `[roomId, entryKey]`를 붙인다. 길이 > `ROOM_KEYS_MAX`(50)면 앞(가장 오래 저장한 것)부터 버린다. 입력 배열을 바꾸지 않는다 | — | R-LOCK-004 |
| F-RM-32 | `removeRoomKey(entries, roomId): readonly RoomKeyEntry[]` · `findRoomKey(entries, roomId): string \| null` (순수) | — | 새 배열 · 증명 | 해당 방 쌍 제거 / 찾기(없으면 `null`) | — | R-LOCK-004 |
| F-RM-33 | `serializeRoomKeys(entries): string \| null` (순수) | 배열 | JSON 또는 `null` | 빈 배열이면 `null`(= 저장소 키 삭제), 아니면 `JSON.stringify(entries)` | — | R-LOCK-009(저장소 불변) |
| F-RM-34 | `getRoomKey(roomId: string): string \| null` (`roomKeys.ts`) | 방 id | 증명 | 캐시가 `null`이면 `parseRoomKeys(loadRoomKeysRaw())`로 채운 뒤 `findRoomKey`. `main.tsx`가 `configureClient`에 그대로 넘기는 getter다 | 저장소 실패 = `[]` | R-LOCK-004 · R-LOCK-006 |
| F-RM-35 | `saveRoomKey(roomId: string, entryKey: string): void` | 방·증명 | 캐시·저장소 | `entryKey === ''`이면 무시. 캐시 = `upsertRoomKey(…)` → `commit`(아래). **증명을 해석·검사하지 않는다**(불투명 문자열, api.md §2.8.1) | 저장 실패는 storage가 삼킨다 → 캐시만으로 이번 세션 동작 | R-LOCK-004 · R-LOCK-007 |
| F-RM-36 | `forgetRoomKey(roomId: string): void` | 방 | 캐시·저장소 | 캐시에 그 방이 **없으면 아무것도 하지 않는다**(저장소 쓰기 없음). 있으면 `removeRoomKey` → `commit` | — | R-LOCK-004 |
| — | `commit(next)` (모듈 내부) | 새 배열 | 캐시·저장소 | 캐시 = `next` → `serializeRoomKeys(next)`가 `null`이면 `clearRoomKeysRaw()`, 아니면 `saveRoomKeysRaw(json)` | — | R-LOCK-009 |
| F-RM-37 | `resetRoomKeyCache(): void` | — | 캐시 = `null` | **테스트 정리 전용**(token.ts `clearToken`과 같은 성격). 화면 코드는 부르지 않는다 | — | — |
| F-RM-38 | `main.tsx` 주입 (S6) | — | client getter 2개 | `import '@/styles/global.css'` → `initToken(window.location.search)` → `configureClient({ getToken, getRoomKey })` → render. 그 밖의 파일은 `configureClient`를 부르지 않는다 | — | R-LOCK-006 · R-LOCK-007 |
| F-RM-39 | `countPasswordChars(value) · isRoomPasswordSettable(value) · isRoomPasswordValid(value) · isEnterPasswordValid(value)` (`state/limits.ts`, 순수) | 문자열 | 수·불리언 | `countPasswordChars = Array.from(value).length`(**trim 없음**, 코드 포인트). `isRoomPasswordSettable = ROOM_PASSWORD_MIN ≤ n ≤ ROOM_PASSWORD_MAX`(chat 설정 시트). `isRoomPasswordValid = value === '' \|\| isRoomPasswordSettable(value)`(새 방 — 빈칸 = 잠그지 않음). `isEnterPasswordValid = 1 ≤ n ≤ ROOM_ENTER_PASSWORD_MAX`. 상수는 `@shared/limits` import(4·32·64) | — | R-LOCK-001 · R-ROOMS-002 |
| F-RM-40 | `useRoomEntry(options: UseRoomEntryOptions): UseRoomEntryResult` (`components/roomEntry/useRoomEntry.ts`) | `{ canWrite: boolean; onEntered: (room: RoomSummary) => void; onRoomGone: (room: RoomSummary) => void }` | `{ sheet; requestEntry; submitPassword; cancelEntry }` | 판정 ①~④와 시트 상태를 소유한다. 화면은 결과 콜백만 받는다. 콜백은 `latestRef`로 읽는다 | — | R-LOCK-004 · 005 · 006 · R-ROOMS-001 |
| F-RM-41 | `requestEntry(room: RoomSummary, reason?: 'tap' \| 'locked'): void` (useRoomEntry) | 방, 이유(기본 `'tap'`) | 아래 | **순서 확정: `reason === 'locked'`이면 가드보다 먼저 `forgetRoomKey(room.id)`를 실행한다(증명 무효는 항상 반영), 그다음 가드에 걸리면 시트를 열지 않고 끝낸다.** 가드 = `quietInFlightRef` true 또는 `sheet !== null`이면 무시. `reason === 'tap'`: ① `!room.locked` → `onEntered(room)` ② `getRoomKey(room.id) !== null` → `onEntered(room)`. `reason === 'locked'`(chat이 `ROOM_LOCKED`를 받음): (증명은 위에서 이미 삭제) ①② 건너뜀. 그다음 ③ `canWrite` → `quietEnter(room)` ④ 아니면 `setSheet({ room, isBusy: false, error: null })` | `enterRoom` 호출은 ③에서만(①②④는 api 호출 0회) | R-LOCK-004 · 005 · 006 · R-ROOMS-001 |
| F-RM-42 | `quietEnter(room): Promise<void>` (useRoomEntry 내부) | 잠긴 방 | 아래 | `quietInFlightRef = true` → `const r = await enterRoom(room.id)`(비밀번호 인자 없음 → 본문 `{}`) → `quietInFlightRef = false` → 언마운트면 종료. 성공: `r.value.entryKey`가 문자열이면 `saveRoomKey(room.id, …)` → `onEntered(room)`(`null`이면 저장 없이 진입). 실패: `ROOM_LOCKED` → 시트(오류 없음) · `NOT_FOUND` → `onRoomGone(room)` · 그 밖(`NETWORK`·`INTERNAL`·`CONFIG_INVALID`·`VALIDATION_ERROR`) → 시트 + `error` | 진행 표시 없음(D-L9). `isAuthFailure` 코드는 E17이 내지 않는다(api.md §2.8.5) — 와도 시트로 간다(읽기 전용 전환 안 함) | R-LOCK-005 |
| F-RM-43 | `submitPassword(password: string): void` (useRoomEntry — components.md §1.22와 같다. 본체는 내부 `run(password): Promise<void>`이고 `submitPassword`는 `void run(password)`만 한다) | 시트 입력값 | 아래 | `sheet === null`·`sheet.isBusy`·`submitInFlightRef` 또는 `!isEnterPasswordValid(password)`면 종료. `submitInFlightRef = true`, `sheet = { …, isBusy: true, error: null }` → `enterRoom(room.id, password)` → `submitInFlightRef = false` → 언마운트면 종료. 성공: 문자열이면 `saveRoomKey` → `sheet = null` → `onEntered(room)`. `NOT_FOUND` → `sheet = null` → `onRoomGone(room)`. 그 밖 → `sheet = { room, isBusy: false, error }`(입력값은 PromptSheet 로컬이라 유지) | password를 상태·로그에 남기지 않는다(인자로 받아 래퍼에 넘기고 끝) | R-LOCK-004 · R-LOCK-007 · R-LOCK-008 |
| F-RM-44 | `cancelEntry(): void` (useRoomEntry) | — | `sheet = null` | 시트 「취소」·Esc·덮개. `sheet.isBusy`면 무시(PromptSheet도 막는다). 포커스는 BottomSheet가 열기 전 요소(탭한 행)로 되돌린다 | — | R-LOCK-004 |
| F-RM-45 | `enterErrorText(error: ApiError): string` (`components/roomEntry/roomEntryText.ts`) | 실패 | 문구 | §8.2 표 | 서버 `message`는 쓰지 않는다 | R-LOCK-004 · 008 |
| F-RM-46 | `RoomEntrySheet(props)` (`components/roomEntry/RoomEntrySheet.tsx`) | `{ sheet: NonNullable<EntrySheet>; onSubmit: (password: string) => void; onCancel: () => void }` | PromptSheet 렌더 | components.md §1.22 | — | R-LOCK-004 · 006 |
| F-RM-47 | 행 선택 (S6, F-RM-09 개정) | 행의 방 | `entry.requestEntry(room)` | RoomsScreen이 `ListArea onSelect={entry.requestEntry}`로 넘긴다(옛 `onOpenRoom` 직접 전달 대체). `useRoomEntry({ canWrite: viewer.canWrite, onEntered: onOpenRoom, onRoomGone: retry })` | — | R-ROOMS-001 · R-LOCK-004 |
| F-RM-48 | `onRoomGone` = `retry` (rooms) | — | `load = loading` → `listRooms()` | 시트가 닫힌 뒤 목록을 새로 받는다. 토스트 없음(D-L10) | — | R-LOCK-004 |
| F-RM-49 | `changePassword(value: string): void` (`useCreateRoom`) | 입력 | `create.password = value` | 잘라 내지 않는다 | — | R-ROOMS-002 · R-LOCK-001 |
| F-RM-50 | `submitCreate` (S6, F-RM-17 개정) | — | 아래 | 가드: `submitInFlightRef` · `!isRoomTitleValid(title)` · **`!isRoomPasswordValid(password)`** 이면 종료. 본문 = `password === '' ? { title } : { title, password }`(빈칸이면 `password` 키 없음). `createRoom(body)` → 성공: `const { entryKey, ...room } = r.value` → `entryKey`가 문자열이면 `saveRoomKey(room.id, entryKey)` → `onCreated(room)`(view에 `entryKey`를 싣지 않는다). 실패: `isSubmitting = false`, **title·password 유지** → `onFailure` | `VALIDATION_ERROR` 문구는 주 문서 §8.3 개정 행 | R-ROOMS-002 · R-LOCK-001 · 004 |
| F-RM-51 | `cancelCreate` · `resetCreate` (S6) | — | `password = ''` 포함 초기값 | F-RM-15·19와 같고 초기값에 `password: ''`가 들어갈 뿐 | — | R-LOCK-007 |
| F-RM-52 | `resolveAutoOpen` (S6, F-RM-08 개정) | 목록·handlers | 아래 | 대상 방을 찾은 뒤 **`target.locked && getRoomKey(target.id) === null`이면 `clearLastRoomId()` → `onAutoOpenSettled()`(진입 없음, 시트도 열지 않음, `enterRoom` 호출 없음)**. 그 밖은 기존 F-RM-08 그대로 | 토큰 유무와 무관(조용한 시도도 하지 않는다 — s6-02 §6.1 자동 진입 행) | R-ROOMS-004 |
| F-RM-53 | B1 Enter (NewRoomRow) | — | 포커스 이동 | 제목 `TextInput onEnter={() => passwordInputRef.current?.focus()}`(제출하지 않음). B2 `onEnter={onSubmit}`. 두 입력 모두 `onEscape={onCancel}` | IME 조합 중 Enter 무시(TextInput 규칙) | R-ROOMS-002 |
| F-RM-54 | 잠긴 행 매핑 (RoomList) | `room` | ListRow props | `room.locked` → `{ isLocked: true, title, ariaLabel: labels.lockedRowAriaLabel(room.title) }`(날짜 계산 자체를 하지 않는다). 아니면 기존(`formatMonthDay`·`toIsoDate`·`rowAriaLabel`) | — | R-LOCK-003 · R-ROOMS-001 |

- 타입 export: `RoomKeyEntry = readonly [roomId: string, entryKey: string]` · `ROOM_KEYS_MAX = 50`(roomKeys.ts) · `EntrySheet` · `UseRoomEntryOptions` · `UseRoomEntryResult`(useRoomEntry.ts).
- 함수 50줄·파일 400줄 한계. `useRoomEntry`가 길어지면 `quietEnter`·`submitPassword`를 같은 파일 모듈 함수로 뺀다.

---

## 5. 번호 규칙

이 묶음은 rooms 화면에 새 리듀서를 두지 않는다. 방 접근 판정 규칙은 F-RM-41 한 곳이다. 파이프라인 절 번호는 `design/pipeline.md` §6.1~§6.6에 이어 §6.7부터 쓴다.

---

## 6. 파이프라인

### 6.7 잠긴 행 탭 — 방 접근 판정 (s6-02 §6.1)

```
행 탭/Enter/Space → requestEntry(room)
 ├ ① room.locked === false ─────────────→ onOpenRoom(room) → chat
 ├ ② getRoomKey(id) 있음 ───────────────→ onOpenRoom(room) → chat (헤더는 래퍼가 붙인다)
 ├ ③ viewer.canWrite ── enterRoom(id) ──┬ 200 entryKey 문자열 → saveRoomKey → chat
 │                                       ├ 200 entryKey null  → chat(저장 없음)
 │                                       ├ 403 ROOM_LOCKED    → 입장 시트(문구 없음)
 │                                       ├ 404 NOT_FOUND      → 목록 다시 받기
 │                                       └ 그 밖              → 입장 시트 + 코드 문구
 └ ④ 읽기 전용 ─────────────────────────→ 입장 시트(문구 없음, 요청 없음)
```

- ③에서 주인이면 서버가 200을 준다. 화면은 주인인지 묻지 않는다(api.md §2.8.4).
- 판정 ②의 증명이 이미 무효(비밀번호 변경·해제 후 재잠금)면 chat 첫 로드가 `ROOM_LOCKED`를 받고 chat 쪽이 `requestEntry(room, 'locked')`로 다시 판정한다(chat 설계 몫).

### 6.8 입장 시트 제출

| 결과 | 화면 | 상태·저장 | 다음 |
|---|---|---|---|
| 요청 중 | 입력 readOnly · 두 버튼 disabled · Esc·덮개 막힘 | `sheet.isBusy = true` | — |
| `200` 문자열 | 시트 닫힘 | `ld:roomKeys`에 `[id, entryKey]` | chat 진입 |
| `200` `null`(그사이 잠금 해제) | 시트 닫힘 | 저장 없음 | chat 진입 |
| `ROOM_PASSWORD_WRONG` | alert `비밀번호가 맞지 않습니다.` | 입력값 유지 | 다시 입력 |
| `RATE_LIMITED` | alert 초 포함 문구(§8.2) | — | 시간이 지난 뒤 다시 |
| `NETWORK` · 5xx · 그 밖 | alert 코드 문구 | — | 다시 시도 |
| `NOT_FOUND` | 시트 닫힘 | — | 목록 다시 받기(F-RM-48) |
| 취소 · Esc · 덮개 | 시트 닫힘, 포커스 = 탭한 행 | 비밀번호 폐기 | 목록 |

- 자동 재시도·화면 타이머 없음. 429 남은 초를 세는 카운트다운도 없다(문구에 한 번 표시).

### 6.9 새 방 + 비밀번호 (S2 §6.5 확장)

1. 「+ 새 방」 → B 열림, 제목 입력에 포커스.
2. 제목 입력 → Enter 또는 Tab → 비밀번호 칸(선택).
3. 「만들기」 활성 = `!isSubmitting && isRoomTitleValid(title) && isRoomPasswordValid(password)`. 비밀번호 1~3자·33자 이상이면 비활성(33자 이상은 카운터 `over`·`aria-invalid`).
4. 만들기(버튼 · 비밀번호 칸 Enter) → `createRoom({ title })` 또는 `createRoom({ title, password })` → `201` → (잠갔으면) 증명 저장 → chat 진입(목록 재요청 없음, D-3 불변).
5. 실패 → B·입력값 유지 + 토스트(주 문서 §8.3). 인증 실패 → 읽기 전용 전환(F-RM-12, 불변). B가 사라지며 비밀번호도 사라진다.

### 6.10 자동 진입 (R-ROOMS-004 개정)

| `lastRoomId` 방 | 증명 | 결과 |
|---|---|---|
| 목록에 없음 | — | 기록 삭제, 목록(불변) |
| 안 잠김 | — | 자동 진입(불변) |
| 잠김 | 있음 | 자동 진입 |
| 잠김 | 없음 | **기록 삭제, 목록에 머묾.** 시트를 스스로 열지 않고 `enterRoom`도 부르지 않는다 |

### 6.11 저장소 실패

- `localStorage` 읽기·쓰기가 throw하면 storage가 삼키고 `roomKeys` 캐시만으로 같은 세션은 같은 동작이다(같은 방을 다시 탭하면 묻지 않는다). 새로 열면 다시 묻는다.
- 잠긴 방을 한 번도 열지 않은 사용자의 저장소 키 목록은 S5와 같다(`ld:roomKeys` 없음 — F-RM-33·36).

---

## 7. contract 계약 사용표 (S6 — api.md v0.9 인용)

| 엔드포인트 | 요청 | 응답 타입(`shared/src/types.ts`) | 래퍼(`@/api`) | 호출 위치 | 토큰 헤더 | `X-Room-Key` | 실패 시 표시 |
|---|---|---|---|---|---|---|---|
| E3 `GET /api/rooms` (§4.2) | 없음 | `RoomSummary[]` — `locked: boolean` 추가 | `listRooms()` 불변 | F-RM-06 | 불필요 | 없음 | 불변(주 문서 §8.2) |
| E4 `POST /api/rooms` (§4.6) | `CreateRoomBody = { title: string; password?: string }` — 빈칸이면 키 없음 | `201` `CreateRoomResponse = RoomSummary & { entryKey: string \| null }` | `createRoom(body): Promise<Result<CreateRoomResponse>>` | F-RM-50 | 필요(래퍼) | 없음 | 토스트 주 문서 §8.3 |
| E17 `POST /api/rooms/:id/enter` (§4.19) | `EnterRoomBody = { password?: string }` — 래퍼가 `password === undefined`면 `{}` | `200` `EnterRoomResponse = { entryKey: string \| null }` | `enterRoom(roomId: string, password?: string): Promise<Result<EnterRoomResponse>>` | F-RM-42(인자 1개) · F-RM-43(인자 2개) | 래퍼 `auth: true` — 토큰 있으면 붙고 없으면 없음. 실패해도 익명 처리(401·`LEVEL_TOO_LOW` 없음) | 붙지 않음(관문 없음) | §6.7 · §6.8 · §8.2 |
| (엔드포인트 아님) getter 주입 | `configureClient({ getToken, getRoomKey })` | `ClientConfig.getRoomKey?: (roomId: string) => string \| null` | `configureClient` | `main.tsx` F-RM-38 | — | 래퍼가 `roomId` 있는 요청마다 조회 | — |

- `enterRoom`이 낼 수 있는 코드: `ROOM_LOCKED`(403, 비밀번호 없이) · `ROOM_PASSWORD_WRONG`(403) · `RATE_LIMITED`(429 + `retryAfterSec`) · `NOT_FOUND`(404) · `VALIDATION_ERROR`(400 — 화면이 64자를 먼저 막아 정상 경로 없음) · `CONFIG_INVALID`·`INTERNAL`(500) · 클라이언트 `NETWORK`.
- `ROOM_LOCKED`·`ROOM_PASSWORD_WRONG`는 `isAuthFailure`가 `false`다 — 읽기 전용 전환 경로(F-RM-12)를 타지 않는다.
- rooms는 E18·E19·메시지 래퍼를 부르지 않는다(chat 몫). 테스트는 `vi.mock('@/api/rooms')`(관례)에 `enterRoom`을 더하고 `RoomSummary` 픽스처에 `locked`를 넣는다.

---

## 8. 확정 문구·라벨

### 8.1 `ui/src/rooms/labels.ts` 추가

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `lockedRowAriaLabel(title)` | `` `${title}, 잠긴 방` `` | 잠긴 ListRow `aria-label`(날짜 없음) |
| `newRoomPasswordAriaLabel` | `새 방 비밀번호` | B2 입력 `aria-label` |
| `newRoomPasswordPlaceholder` | `비밀번호(선택, 6자 이상 권장)` | B2 입력 placeholder |

### 8.2 `ui/src/components/roomEntry/roomEntryText.ts` (rooms·chat 공용 단일 소스)

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `ROOM_ENTRY_TEXT.title` | `비밀번호` | 입장 시트 h2 · 시트 `aria-label` |
| `ROOM_ENTRY_TEXT.inputAriaLabel` | `방 비밀번호` | 시트 입력 `aria-label` |
| `ROOM_ENTRY_TEXT.submit` | `입장` | 시트 오른쪽 primary |
| `ROOM_ENTRY_TEXT.cancel` | `취소` | 시트 왼쪽 secondary |
| `enterErrorText`: `ROOM_PASSWORD_WRONG` | `비밀번호가 맞지 않습니다.` | 시트 alert |
| `enterErrorText`: `RATE_LIMITED` + `retryAfterSec` | `` `비밀번호를 너무 자주 입력했습니다. ${retryAfterSec}초 후 다시 시도해 주세요.` `` | 시트 alert |
| `enterErrorText`: `RATE_LIMITED` 값 없음 | `비밀번호를 너무 자주 입력했습니다. 잠시 후 다시 시도해 주세요.` | 시트 alert |
| `enterErrorText`: `NETWORK` | `NETWORK_TEXT`(= `서버에 연결할 수 없습니다.`, `components/utils/errorText.ts`) | 시트 alert |
| `enterErrorText`: 그 밖 | `ERROR_MESSAGES[code]`(`@shared/errors`) | 시트 alert |
| (문구 없음) 조용한 시도의 `ROOM_LOCKED` | — | 시트를 문구 없이 연다 |

- 시트 입력에는 placeholder를 두지 않는다(입장은 이미 정해진 비밀번호를 넣는 곳이다). 「6자 이상 권장」은 비밀번호를 **정하는** 곳(B2 · chat 잠금 설정 시트)에만.
- 카운터(`n/64`·`n/32`)는 문구가 아니라 TextInput이 만든다.

---

## 9. 접근성 → `design/a11y.md` S6 행

요약: 잠긴 행 이름 `{제목}, 잠긴 방`, 자물쇠 `aria-hidden`. B 포커스 순서 제목 → 취소 → 비밀번호 → 만들기, 제목 Enter = 비밀번호로, 비밀번호 Enter = 만들기. 입장 시트 `role=dialog` `aria-modal`, 열리면 입력 포커스, 실패 문구 `role=alert`, 닫히면 탭한 행으로 포커스 복귀.

---

## 10. 읽기 전용 분기 (S6)

"미렌더" = DOM에 없음. 판정은 `viewer.canWrite` 하나(불변).

| 요소 | 토큰 없음 · 전환 후 | 토큰 있음 | 방식 | 요구ID |
|---|---|---|---|---|
| B2 비밀번호 칸 · 「만들기」 | **미렌더**(B 전체가 없음) | B 열렸을 때만 | `viewer.canWrite && create.isOpen && <NewRoomRow/>`(불변) | R-ROOMS-002 · R-LOCK-001 |
| 잠긴 행 자물쇠·날짜 미표시 | 렌더(같음) | 렌더(같음) | 토큰과 무관 | R-LOCK-003 |
| 입장 시트 | **동작**(④ — 바로 시트) | 동작(③ 조용한 시도 실패 시) | 토큰과 무관. `canWrite`는 ③/④ 분기에만 쓴다 | R-LOCK-004 · 006 |
| 조용한 입장 시도(E17 비밀번호 없음) | 하지 않음 | 함 | F-RM-41 ③ | R-LOCK-005 |

- 시트가 열린 채 읽기 전용 전환(F-RM-12)이 일어나도 시트는 그대로다(시트는 쓰기 UI가 아니다). **포커스 규칙: 시트가 열려 있으면(`entry.sheet !== null`) F-RM-19의 h1 포커스 이동을 건너뛰고 포커스는 시트 안에 남는다(`aria-modal` 트랩 유지). 시트가 닫힐 때 복귀 대상은 BottomSheet 기존 규칙(열기 전 요소가 `isConnected`면 그 요소, 아니면 이동 없음).** B 영역·비밀번호 칸 DOM은 사라지고, 시트 입력값은 유지되며, 제출하면 `enterRoom(id, pw)`가 정상 호출된다. TC-RM-067.

---

## 11. 결정 (구성안 §8 주의점 확정 포함)

| # | 결정 | 근거 |
|---|---|---|
| D-L1 | **PromptSheet 공용 델타 = `inputType?`와 `placeholder?` 둘 다**(components.md §1.17). rooms 입장 시트는 `placeholder`를 쓰지 않고, chat 잠금 설정·변경 시트가 쓴다 | 메인 세션 위임문 권고 ①(2026-10-08) 채택, 구성안 §8 주의점 1 대응. 안 넣으면 chat 시트에 「6자 이상 권장」 자리가 없다 |
| D-L2 | 카운터 상한: 입장 시트 **64**(`ROOM_ENTER_PASSWORD_MAX`), B2·chat 설정 시트 **32** | 메인 세션 위임문 권고 ②(2026-10-08) 채택, 구성안 §8 주의점 2 대응. 입장은 4~32를 보지 않고 틀림으로 판정된다(api.md §4.19) |
| D-L3 | B1 Enter = 비밀번호 칸으로 포커스(제출 안 함), B2 Enter = 만들기(빈 비밀번호면 잠그지 않고 만든다) | 메인 세션 위임문 권고 ③(2026-10-08) 채택, 구성안 §8 주의점 3 대응. S2의 "제목 Enter = 만들기"(TC-RM-026)는 개정된다 — `design/tc.md` TC-RM-054 |
| D-L4 | 잠긴 행 접근성 이름 `"{제목}, 잠긴 방"`, 날짜 DOM 없음, 자물쇠 장식 `aria-hidden` | 메인 세션 위임문 권고 ④(2026-10-08) 채택, 구성안 §8 주의점 4 대응 · U8 |
| D-L5 | 비밀번호 칸 카운터·검사는 **trim 없이** 코드 포인트(`countPasswordChars`). TextInput `type='password'`일 때 카운터도 trim하지 않는다 | R-LOCK-001 "trim 없음". 제목 규칙(trim 후)을 그대로 쓰면 `" ab "`가 카운터 2인데 서버는 4자로 받는다 |
| D-L6 | 비밀번호 입력 `autoComplete="new-password"` · `autoCapitalize="off"` · `spellCheck={false}` | 갠홈 로그인 비밀번호 자동 채움 방지(방 비밀번호와 회원 비밀번호 혼동 차단). 저장 제안 끔은 s6-02 §6.4 |
| D-L7 | 생성 응답에서 `entryKey`를 떼고 `RoomSummary`만 view·chat에 넘긴다 | 증명은 `roomKeys` 한 곳에만 둔다 |
| D-L8 | 입장 시트 묶음 위치 = **`ui/src/components/roomEntry/`**(지역 공용: `useRoomEntry` · `RoomEntrySheet` · `roomEntryText`). `components/ui`로 승격하지 않는다 | 두 화면이 같은 판정·같은 문구를 쓴다(중복 금지). 그러나 공용 ui는 문구를 갖지 않는다(components.md §1.9) → 문구를 품은 기능 묶음은 `components/ui` 밖에 둔다. 공용 문구 선례 `components/utils/errorText.ts`. 공용 델타(TextInput·PromptSheet)·새 폴더 `components/roomEntry/`·storage/limits 변경은 **승인 ① 2026-10-08(s6-02 §6.4)** 사용자 확인 범위다. 최소 4자 안내 문구는 두지 않는다(요구 없음 — 「만들기」 비활성만). 구현 순서는 s6-03 §0(contract-implementer 선행) |
| D-L9 | 조용한 시도(③) 중 진행 표시 없음. 같은 시도 중 다른 행 탭은 무시 | 요구에 없는 표시를 더하지 않는다. 짧은 요청(해시 계산 없음, api.md §4.19 ③④) |
| D-L10 | `NOT_FOUND`는 시트를 닫고 목록만 다시 받는다(토스트 없음) | 인계 메모 S6 "목록 새로 고침" 그대로. 사라진 방은 새 목록에서 빠져 보인다 |
| D-L11 | 자동 진입 보류 시 `ld:lastRoomId`를 지운다 | 마지막으로 보인 화면이 목록이다(R-ROOMS-004 기록 삭제 원칙과 같음). 다음 열기도 목록 |
| D-L12 | 방 생성 `VALIDATION_ERROR` 토스트 문구를 `방 제목(1~60자)과 비밀번호(4~32자)를 확인해 주세요.`로 바꾼다(주 문서 §8.3) | 서버가 제목·비밀번호 어느 쪽이든 같은 코드를 낸다. 화면이 둘 다 먼저 막아 정상 경로에서는 나오지 않는다 |
| D-L13 | 구성안 §8-5(chat 입장 재요구 판 ⋯·하단 바 미렌더) · §8-6(풀기 danger 여부) · §8-7(잠금 메뉴 토큰 분기)은 **chat 설계 몫** | rooms 화면 요소가 아니다 |

---

## 12. 예정 TC (S6 — ui-test-designer가 시나리오로 확정)

예정 TC-RM-041~066 표와 기존 TC 영향은 **`design/tc.md` §14.2(S6)**로 옮겼다(v1.8.3, 40KB 한계).

---

## 13. chat 설계로 넘기는 공용 델타 (단일 정의 위치)

| 대상 | 정의 위치 | chat 사용처 |
|---|---|---|
| `TextInput.type` | components.md §1.12 | 잠금 설정·변경 시트 입력 |
| `PromptSheet.inputType` · `placeholder` | components.md §1.17 | 「비밀번호 걸기」·「비밀번호 바꾸기」 시트(placeholder 「6자 이상 권장」은 chat labels) |
| `roomKeys` `getRoomKey`·`saveRoomKey`·`forgetRoomKey` | components.md §1.21 · 이 문서 F-RM-34~36 | `setRoomPassword` 응답 저장 · `clearRoomPassword`·방 삭제 성공 시 삭제 |
| `useRoomEntry` · `requestEntry(room, 'locked')` | components.md §1.22 · F-RM-40~44 | 모든 요청의 `ROOM_LOCKED` → 입장 재요구(증명 삭제는 훅이 한다). **chat은 이 훅을 호출만 한다. 훅 동작 TC(TC-RM-065)는 rooms 소유** — chat TC는 호출 여부·인자만 단언 |
| `RoomEntrySheet` · `roomEntryText` | components.md §1.22 · §1.23 · §8.2 | 입장 재요구 판 시트(같은 문구) |
| `limits` `isRoomPasswordSettable`(4~32, 빈칸 불가) · `countPasswordChars` | components.md §1.11 · F-RM-39 | 「잠그기」·「바꾸기」 활성 조건 |
| `main.tsx` `configureClient({ getToken, getRoomKey })` | F-RM-38 | 메시지 id 래퍼 마지막 인자 `room.id` |
