# chat 상세 설계 — S6 방 비밀번호 잠금 (분할 문서, v2.3.2)

> 주 문서: `ui/src/chat/design.md`(RTM은 `design/rtm.md` S6 행). S6 델타 본문은 이 파일, 예정 TC·기존 TC 영향·인계는 `design/lock-tests.md`. 절 표기 `LK` = 이 파일, `LT` = lock-tests.md.
> 요구: `ui/src/chat/requirements.md` **v2.2** §1 R-CHAT-001 🔒(S6 개정) · R-CHAT-010(S6 개정) · §6.1 R-LOCK-002 · 004 · 005 · 006 · 007 · 009(chat 몫, 원문 전사).
> 구성안: `doc/200_설계/architecture/ui-layout-04-room-lock.md` §5.1~§5.4 · §8-5~7 · §12 — **수용, 구조 변경 없음**. §8 주의점 5·6·7은 LK §10 D-46~48에서 확정.
> 계약: `doc/200_설계/contract/api.md` **v0.9** §2.8(증명·관문·화면 보관·주인) · §4.20(E18) · §4.21(E19) · §4.19(E17, 입장 시트 경유) · §5.10 · §11.18 · 「ui 인계 메모」 S6 — 확정. **인용만 한다.**
> 공용 델타(단일 정의 — 여기서 재정의하지 않는다): `ui/src/rooms/design/components.md` §1.7(storage `ld:roomKeys`) · §1.11(limits `isRoomPasswordSettable`·`countPasswordChars`) · §1.12(TextInput `type`) · §1.17(PromptSheet `inputType`·`placeholder`) · §1.21(roomKeys `getRoomKey`·`saveRoomKey`·`forgetRoomKey`) · §1.22(`components/roomEntry/` `useRoomEntry`·`RoomEntrySheet`) · §1.23(`roomEntryText`) · `ui/src/rooms/design/lock.md` F-RM-34~44 · §8.2 · §13.
> 구현 선행 조건: contract S6 구현(`ui/src/api` `setRoomPassword`·`clearRoomPassword`·`enterRoom` · 메시지 id 래퍼 마지막 인자 `roomId`) · rooms S6 공용 델타 구현(roomKeys · roomEntry · TextInput · PromptSheet · limits).

비유: 잠긴 방 안에 앉아 있다가 누가 자물쇠 번호를 바꾸면, 손에 든 도장(입장 증명)이 그 자리에서 무효가 된다. 그때 화면은 하던 일을 모두 내려놓고(진행 중인 요청·입력·시트 폐기) 문 앞으로 나가 번호를 다시 묻는다. 맞히면 방에 처음 들어올 때와 똑같이 다시 들어온다.

---

## 0. 레이아웃 [확정 — 구성안 §5]

### 0.1 ⋯ 방 메뉴 5항목 (토큰 있을 때만, 약 292px)

```
+----------------------------------------------+
| 방 메뉴 . 티타임                             |  머리 40
| 이름 변경                                    |  44
| 장기기억                                     |  44
| 잠금                                         |  44  (S6 신규, 장기기억과 방 삭제 사이)
| 방 삭제                                      |  44  danger
| 취소                                         |  44
+----------------------------------------------+
```

- `.` = 머리 구분점 `·`(ASCII 표기). 「잠금」 항목 이름은 방 상태와 무관하게 같다. 선택 → 안 잠긴 방 §0.2 / 잠긴 방 §0.3(F-CH-74).

### 0.2 「비밀번호 걸기」 · 「비밀번호 바꾸기」 (PromptSheet, 약 160~185px)

```
+----------------------------------------------+
| 비밀번호 걸기                                |  제목 h2 (바꾸기 판: 비밀번호 바꾸기)
| [6자 이상 권장                         0/32] |  TextInput password · placeholder
| (실패 문구 한 줄 — 있을 때만)                |  role=alert
| [  취소  ]                        [ 잠그기 ] |  Button lg 44 x 2 (바꾸기 판: 바꾸기)
+----------------------------------------------+
```

### 0.3 잠금 시트 (잠긴 방, 약 204px) · 잠금 풀기 확인 (약 148px)

```
+----------------------------------------------+
| 잠금 . 티타임                                |  머리 40
| 비밀번호 바꾸기                              |  44 → §0.2 바꾸기 판
| 잠금 풀기                                    |  44 → 확인 (default 톤, danger 아님)
| 취소                                         |  44
+----------------------------------------------+

+----------------------------------------------+
| 잠금을 풀까요?                               |  h2
| 잠금을 풀면 누구나 이 방 대화를 볼 수        |  p
| 있습니다.                                    |
| [  취소  ]                        [  풀기  ] |  ConfirmDialog 공용 그대로
+----------------------------------------------+
```

### 0.4 입장 재요구 판 (`ROOM_LOCKED` 수신 뒤)

```
+----------------------------------------------+
| <  비밀 다과회                10.05          |  A 44 (... 미렌더)
+----------------------------------------------+
|                                              |
|                잠긴 방입니다                 |  B StateView empty (말풍선 DOM 없음)
|                                              |
+----------------------------------------------+
| 비밀번호                                     |  입장 시트(rooms와 같은 RoomEntrySheet)
| [                                      0/64] |
| [  취소  ]                        [  입장  ] |  취소 → 목록(lastRoomId 지움)
+----------------------------------------------+
```

| 영역 | 토큰 있음 | 토큰 없음 | 근거 |
|---|---|---|---|
| A ‹ · 제목 · 생성일 | 렌더 | 렌더 | 구성안 §12 Q2(날짜 그대로) |
| A ⋯ | **미렌더** | 미렌더(원래 없음) | D-46 |
| B | StateView `잠긴 방입니다` | 같음 | 구성안 §5.4 |
| C 하단 바 | **미렌더** | 미렌더(원래 없음) | D-46 |
| D 열람 안내 | 미렌더 | **렌더**(불변) | 구성안 §5.4 D 행 |
| E 토스트 | 없음 | 없음 | 잠긴 판은 토스트 경로가 없다 |
| 입장 시트 | 조용한 시도(E17 비밀번호 없음)가 `ROOM_LOCKED`·오류일 때 | 바로 | rooms lock.md F-RM-41 ③④ |

- 넣지 않는 것: 상단 바 자물쇠 · 비밀번호 확인 칸 · 보기 토글 · 시트 제목의 방 이름(구성안 §9).

| 조각 | 상태 |
|---|---|
| 메뉴 항목 순서 · 잠금 시트 항목 · 시트 틀 · 입장 재요구 판 | **확정**(구성안 §5 · R-CHAT-001 🔒 S6 개정) |
| 높이 | 근삿값(구성안 §5), 실측 ±16px |

---

## 1. 컴포넌트

### 1.1 트리 델타

```
App → ChatScreen (index.tsx, S6: 잠금 관문 껍데기)                key={room.id} (불변)
├─ gate.isLocked === false → ChatRoomView key={gate.epoch}        (옛 ChatScreen 본문 그대로, 이름만 바뀜)
│   ├─ ChatTopBar … ⋯ → RoomMenuSheet (+ 「잠금」)
│   └─ ChatSheets (+ lockMenu · password · confirmUnlock)
│       ├─ LockMenuSheet [chat 로컬 신규] → BottomSheet + SheetItem × 3
│       ├─ PromptSheet [공용, inputType='password' · placeholder]
│       └─ ConfirmDialog [공용] (잠금 풀기)
└─ gate.isLocked === true → LockedRoomView [chat 로컬 신규]
    ├─ ChatTopBar (onOpenMenu 없음 → ⋯ 미렌더)
    ├─ <section> StateView [공용] kind='empty'
    ├─ !viewer.canWrite && ReadOnlyNotice
    └─ gate.sheet && RoomEntrySheet [지역 공용 components/roomEntry]
훅: useRoomLockGate(신규) → useRoomEntry(지역 공용)
```

### 1.2 배치 3단계 분류

| 컴포넌트·모듈 | 위치 | 분류 | 상세 |
|---|---|---|---|
| `PromptSheet`(`inputType`·`placeholder`) · `ConfirmDialog` · `BottomSheet`·`SheetItem` · `StateView` | `ui/src/components/ui/` | ① 공용 재사용(델타는 rooms 정의) | rooms components.md §1.15~§1.17 · §1.4 |
| `useRoomEntry` · `RoomEntrySheet` | `ui/src/components/roomEntry/` | 지역 공용 재사용 | rooms components.md §1.22 |
| `getRoomKey`·`saveRoomKey`·`forgetRoomKey` | `ui/src/state/roomKeys.ts` | 상태 모듈 재사용 | rooms components.md §1.21 |
| `isRoomPasswordSettable` · `ROOM_PASSWORD_MAX`(`@shared/limits`) | `ui/src/state/limits.ts` | 재사용 | rooms components.md §1.11 |
| **`useRoomLockGate`** | `ui/src/chat/useRoomLockGate.ts` | 화면 로컬 훅 신규 | LK §3 F-CH-63~66 |
| **`LockedRoomView`** | `ui/src/chat/components/LockedRoomView.tsx` | ④ chat 로컬 신규 | LK §1.3 |
| **`LockMenuSheet`** | `ui/src/chat/components/LockMenuSheet.tsx` | ④ chat 로컬 신규 | LK §1.4 |
| `ChatRoomView` | `ui/src/chat/index.tsx`(같은 파일, 옛 `ChatScreen` 본문) | ④ 이름 변경 | LK §1.3 |

- 새 표준 HTML 원소 없음. 새 라이브러리 없음. 공용 컴포넌트 변경 없음(rooms 정의 델타만 사용).

### 1.3 `ChatScreen`(껍데기) · `ChatRoomView` · `LockedRoomView`

```ts
// index.tsx
export type ChatScreenProps = { room; viewer; onBack; onAuthFailure; onRoomRenamed }   // 불변 — App 수정 없음
type ChatRoomViewProps = ChatScreenProps & { onRoomLocked: () => void; onRoomOpened: () => void }   // onRoomOpened = D-55 카운터 리셋
export const ChatScreen = (props: ChatScreenProps) => {
  const gate = useRoomLockGate({ room: props.room, viewer: props.viewer, onBack: props.onBack, onRoomUpdated: props.onRoomRenamed })
  return gate.isLocked
    ? <LockedRoomView room={props.room} viewer={props.viewer} gate={gate} />
    : <ChatRoomView key={gate.epoch} {...props} onRoomLocked={gate.onRoomLocked} onRoomOpened={gate.onRoomOpened} />
}

// components/LockedRoomView.tsx
export type LockedRoomViewProps = { room: RoomSummary; viewer: Viewer; gate: UseRoomLockGateResult }
```

- `ChatRoomView` = 지금 `ChatScreen` 본문 그대로 + `useChatScreen(props)`에 `onRoomLocked` 전달(F-CH-69·70). DOM 불변.
- `LockedRoomView` 렌더: `<main className={styles.root} aria-label={labels.screenAriaLabel(room.title)}>` · `<ChatTopBar room={room} onBack={gate.back} backButtonRef={backButtonRef} />`(`onOpenMenu` 생략 → ⋯ DOM 없음) · `<section className={styles.history}><StateView kind="empty" message={labels.lockedRoom} /></section>` · `{!viewer.canWrite && <ReadOnlyNotice text={labels.readOnlyNotice} />}` · `{gate.sheet && <RoomEntrySheet sheet={gate.sheet} onSubmit={gate.submitPassword} onCancel={gate.cancelLockedEntry} />}`. 스타일은 `styles/ChatScreen.module.css` 재사용(새 클래스 없음).
- `ChatRoomView` = 지금 본문 + `useChatScreen(props)`에 `onRoomLocked`·`onRoomOpened` 전달. `onRoomOpened`는 `useChatLoader`의 `loadInitial`이 `initialLoadSucceeded`를 dispatch한 직후 1회 부른다(F-CH-70).
- **포커스 규칙(확정).** `LockedRoomView` 마운트 `useLayoutEffect([])`: **`gate.sheet !== null`이면 아무것도 하지 않는다**(같은 커밋에 열린 입장 시트의 입력 포커스를 유지 — 자식 BottomSheet의 layout effect가 먼저 돌아 입력에 포커스를 준 뒤다). **`gate.sheet === null`일 때만** `backButtonRef.current?.focus()`. 그래서 토큰 없음(④, 같은 커밋에 시트) = 시트 입력 포커스 / 토큰 있음(③ 조용한 시도 중, 시트 없음) = ‹ 포커스 → 시트가 나중에 열리면 BottomSheet가 ‹를 복귀 대상으로 기억하고 입력에 포커스.

### 1.4 `LockMenuSheet`

```ts
export type LockMenuSheetProps = { roomTitle: string; onChangePassword: () => void; onUnlock: () => void; onClose: () => void }
```

- 렌더: `<BottomSheet ariaLabel={labels.lockMenuAriaLabel} header={<p className={styles.menuHeader}>{labels.lockMenuHeader(roomTitle)}</p>} onClose={onClose}>` · `SheetItem label={labels.changePassword}` · `SheetItem label={labels.unlock}`(**tone 생략 = default**, D-47) · `SheetItem label={labels.cancel} onSelect={onClose}`. 스타일 `MenuSheets.module.css`의 `menuHeader` 재사용.

### 1.5 `RoomMenuSheet` · `ChatSheets` 델타

| 위치 | 변경 |
|---|---|
| `RoomMenuSheetProps` | **추가** `onLock: () => void`. 항목 순서: 이름 변경 → 장기기억 → **`SheetItem label={labels.lock} onSelect={onLock}`** → 방 삭제(danger) → 취소 |
| `ChatSheet` | **추가** `\| { kind: 'lockMenu' } \| { kind: 'password'; mode: 'set' \| 'change'; errorText: string \| null } \| { kind: 'confirmUnlock' }` |
| `ChatSheetsProps.roomBusy` | 타입 `RoomBusy`(LK §2)로 |
| `ChatSheetsProps` | **추가** `onAskLock` · `onAskChangePassword` · `onAskUnlock` · `onSavePassword: (password: string) => void` · `onConfirmUnlock: () => void` |
| `renderRoomSheet` | `roomMenu` → `onLock={props.onAskLock}` |
| `renderLockSheet`(신규 지역 함수) | `lockMenu` → `LockMenuSheet roomTitle={room.title} onChangePassword={props.onAskChangePassword} onUnlock={props.onAskUnlock} onClose={props.onClose}` · `password` → 아래 PromptSheet · `confirmUnlock` → `ConfirmDialog title={labels.unlockTitle} message={labels.unlockBody} confirmLabel={labels.unlockConfirm} cancelLabel={labels.cancel} onConfirm={props.onConfirmUnlock} onCancel={props.onClose} isBusy={props.roomBusy === 'clearPassword'}` |

```tsx
<PromptSheet key={sheet.mode}
  title={sheet.mode === 'set' ? labels.setPasswordTitle : labels.changePasswordTitle}
  inputAriaLabel={labels.passwordInputAriaLabel} initialValue="" maxChars={ROOM_PASSWORD_MAX}
  canSave={isRoomPasswordSettable}
  saveLabel={sheet.mode === 'set' ? labels.setPasswordSave : labels.changePasswordSave}
  cancelLabel={labels.cancel} onSave={props.onSavePassword} onCancel={props.onClose}
  isBusy={props.roomBusy === 'setPassword'} errorText={sheet.errorText}
  inputType="password" placeholder={labels.passwordPlaceholder} />
```

- 실패 문구가 바뀌어도 같은 `kind`·`mode`라 같은 인스턴스 → 입력값 유지(이름 변경과 같은 원리). 입력값은 PromptSheet 로컬에만 있고 시트가 닫히면 사라진다(R-LOCK-007).

---

## 2. 상태

리듀서(`ChatState`)는 바꾸지 않는다. 잠금 관문 상태는 껍데기(`ChatScreen`)에, 잠금 요청 중 표시는 `useRoomActions`에 둔다.

| 상태 | 용도 | 타입 | 초기값 | 소유 |
|---|---|---|---|---|
| `isLocked` | 입장 재요구 판 표시 중 | `boolean` | `false` | `useRoomLockGate` `useState` |
| `isLockedRef` | 같은 틱의 두 번째 `ROOM_LOCKED` 무시 | `MutableRefObject<boolean>` | `false` | `useRoomLockGate` `useRef` |
| `epoch` | 재입장 때 `ChatRoomView`를 새로 마운트하는 key | `number` | `0` | `useRoomLockGate` `useState` |
| `quietReentryCount` | 한 `ROOM_LOCKED` 에피소드 안에서 조용한 시도로 재입장한 연속 횟수(D-55) | `number` | `0` | **껍데기 `ChatScreen`의 상태** — `useRoomLockGate` 안 `useState`(ref 아님: 렌더 중 읽어 `canWrite`를 계산하므로 상태여야 재렌더된다, eslint `react-hooks/refs`). 조용한 재입장 시 `setQuietReentryCount(n => n + 1)`, 재입장 뒤 첫 정상 첫 로드(`onRoomOpened`)에 `setQuietReentryCount(0)` |
| `quietAttemptRef` | 이번 재입장이 조용한 시도로 왔는가(D-55 카운터 판별) | `MutableRefObject<boolean>` | `false` | `useRoomLockGate` `useRef`. `onRoomLocked`(조용한 시도 시작 직전)에서 true, `submitPassword`에서 false, `onEntered`가 읽고 false로. **콜백 안에서만 읽고 쓴다(렌더 중 읽기 없음)** |
| `latestRef` | 비동기 콜백이 최신 `room`·`viewer`·`onBack`·`onRoomUpdated`를 읽게 | `MutableRefObject<UseRoomLockGateOptions>` | 첫 options(매 렌더 `useLayoutEffect` 갱신) | `useRoomLockGate` |
| `latestLockedRef` | `handleWriteFailure`가 최신 `onRoomLocked`를 부르게 | `MutableRefObject<() => void>` | 첫 `onRoomLocked`(매 렌더 `useLayoutEffect` 갱신, `latestRef` 선례) | `useWriteFailure` |
| `backButtonRef` | 잠긴 판 ‹ 포커스 대상 | `RefObject<HTMLButtonElement>` | `null` | `LockedRoomView` `useRef`(ChatTopBar `backButtonRef`로 전달) |
| `entry.sheet` | 입장 시트 | `EntrySheet`(rooms §1.22) | `null` | `useRoomEntry` 내부 |
| `roomBusy` (확장) | 방 쪽 요청 중 | `RoomBusy = 'rename' \| 'delete' \| 'setPassword' \| 'clearPassword' \| null` | `null` | `useRoomActions` `useRoomBusy`(기존 상태 + ref) |
| `sheet` (확장) | 열린 시트 | `ChatSheet \| null`(LK §1.5 세 종 추가) | `null` | `useChatSheets` |
| 증명 | 방별 입장 증명 | rooms §1.21 | — | `state/roomKeys.ts`(화면은 `saveRoomKey`·`forgetRoomKey`·`getRoomKey`(재입장 뒤 `locked` 복귀 판정, F-CH-65)만 부른다) |

- 비밀번호 원문은 어떤 상태에도 없다(PromptSheet·RoomEntrySheet 로컬 `value`뿐). 토큰도 없다(R-CHAT-009 🔒).
- `roomBusy !== null`이면 기존 규칙대로 ⋯ 비활성(`isMenuDisabled`)·말풍선 버튼 줄 잠금(`isActionLocked`)이 함께 걸린다(D-51).

```ts
export type UseRoomLockGateOptions = { room: RoomSummary; viewer: Viewer; onBack: () => void; onRoomUpdated: (room: RoomSummary) => void }
export type UseRoomLockGateResult = {
  isLocked: boolean; epoch: number; sheet: EntrySheet
  onRoomLocked: () => void; onRoomOpened: () => void; submitPassword: (password: string) => void
  cancelLockedEntry: () => void; back: () => void
}
```

---

## 3. 기능 명세 (F-CH-63~85)

| # | 시그니처(위치) | 입력 | 출력·상태 변경 | 동작 | 예외·분기 | 요구ID |
|---|---|---|---|---|---|---|
| **F-CH-63** | `useRoomLockGate(options): UseRoomLockGateResult` (`useRoomLockGate.ts`) | LK §2 | LK §2 | `const entry = useRoomEntry({ canWrite: viewer.canWrite && quietReentryCount < QUIET_REENTRY_MAX, onEntered: enterAgain, onRoomGone: leave })`(**상태 `quietReentryCount`를 읽는다 — 렌더 중 ref 읽기 금지**)(`QUIET_REENTRY_MAX = 2`, 파일 지역 상수 — D-55. rooms 공용 시그니처 불변: `canWrite` 값만 좁힌다). 반환 매핑: `sheet = entry.sheet` · **`submitPassword = (pw) => { quietAttemptRef.current = false; entry.submitPassword(pw) }`**(시트 경로 표시 후 그대로 전달). `onRoomLocked`(F-CH-64)는 `requestEntry(room, 'locked')` 호출 **직전**, 넘기는 `canWrite`(= `viewer.canWrite && quietReentryCount < QUIET_REENTRY_MAX`)가 참이면 `quietAttemptRef.current = true`, 거짓이면 false로 둔다. 조용한 시도가 `ROOM_LOCKED`·오류로 시트를 열어도 플래그는 시트 제출 때 false가 된다 · `onRoomLocked`(F-CH-64) · `onRoomOpened = () => setQuietReentryCount(0)`(setter는 안정 참조라 `useCallback` 없이도 `ChatRoomView`에 넘겨도 되고, 호출하면 껍데기가 재렌더된다. 값이 이미 0이면 React가 재렌더를 생략) · `cancelLockedEntry`·`back`(F-CH-66). 콜백은 `latestRef`로 최신 `room`·`viewer`·`onBack`·`onRoomUpdated`를 읽는다 | 50줄 넘으면 F-CH-64·66을 같은 파일 함수로 | R-LOCK-004 · 006 |
| **F-CH-64** | `onRoomLocked(): void` | — | `isLocked = true` · 증명 삭제 · 판정 | `isLockedRef.current`면 무시 → `isLockedRef = true` → `setIsLocked(true)` → `room.locked === false`면 `onRoomUpdated({ ...room, locked: true })`(서버가 잠김을 알려 줬다 — 메뉴 분기 일치, D-48) → `entry.requestEntry(room, 'locked')`(**증명 삭제는 이 호출이 한다** — `forgetRoomKey` 직접 호출 없음. `quietReentryCount ≥ 2`면 `canWrite`가 false로 들어가 조용한 시도 없이 바로 시트 — D-55). 포커스는 LK §1.3 규칙(시트가 같은 커밋에 열렸으면 ‹ 포커스 생략). 같은 커밋에 `ChatRoomView`가 언마운트 → 진행 중 요청·시트·편집·임시 말풍선 폐기(`isActive`), **실패한 쓰기 자동 재시도 없음** | 토스트·읽기 전용 전환 없음(`isAuthFailure` false, api.md §2.8.5) | R-LOCK-006 · 004 · R-CHAT-010 |
| **F-CH-65** | `enterAgain(): void` (useRoomEntry `onEntered`) | 입장 성공(증명 저장은 useRoomEntry가 마침) | `isLocked = false` · `epoch + 1` · (조건부) 방 정보 · 카운터 | ① **`quietAttemptRef.current`가 true면**(조용한 시도로 들어옴) `setQuietReentryCount(n => n + 1)`(재렌더 → 다음 판정의 `canWrite` 재계산) 후 `quietAttemptRef.current = false`. false면(시트 `submitPassword`로 들어옴) 카운터 그대로. `entry.sheet` 값으로 판별하지 않는다(F-RM-43이 `setSheet(null)` 뒤 `onEntered`를 불러 일괄 처리 여부에 따라 값이 달라진다 — 메인 결정) ② **`getRoomKey(room.id) === null`이면**(= E17 `entryKey: null`, 그사이 잠금이 풀린 방) **`onRoomUpdated({ ...room, locked: false })`**(F-CH-64의 `locked: true`를 되돌림 — D-48) ③ `isLockedRef = false` → `setIsLocked(false)` → `setEpoch(n => n + 1)` → 새 `ChatRoomView` 마운트 = 첫 진입 F-CH-02 그대로(`saveLastRoomId` · ‹ 포커스 · `listMessages`가 새 증명 헤더로) | `entryKey: null`(그사이 잠금 해제)도 같은 경로 | R-LOCK-004 · 005 |
| **F-CH-66** | `cancelLockedEntry(): void` · `leave(): void` · `back(): void` | 시트 취소·Esc·덮개 / `NOT_FOUND` / ‹ | 목록 | `cancelLockedEntry`: `sheet?.isBusy`면 무시 → `entry.cancelEntry()` → `leave()`. `leave` = `back` = `clearLastRoomId()` → `onBack()` | — | R-LOCK-004 · R-ROOMS-004 |
| **F-CH-67** | `LockedRoomView(props)` (`components/LockedRoomView.tsx`) | LK §1.3 | 판 렌더 | LK §1.3 | — | R-LOCK-004 · 006 · R-CHAT-001 |
| **F-CH-68** | `ChatScreen`(껍데기, F-CH-01 개정) · `ChatRoomView` (`index.tsx`) | `ChatScreenProps` | LK §1.3 | 옛 본문 = `ChatRoomView`. 판정 `gate.isLocked` 하나 | — | R-LOCK-006 |
| **F-CH-69** | `useWriteFailure(onAuthFailure, onRoomLocked)` (F-CH-16 개정) | 실패 | — | `handleWriteFailure` 첫 줄: `error.code === 'ROOM_LOCKED'`면 `latestLockedRef.current()` 후 **return**(토스트 없음, `revokedRef` 불변). 그 밖 불변. `useChatScreen` 옵션에 `onRoomLocked` 추가해 넘긴다 | 모든 쓰기 실패 경로(send · edit · delete · regenerate · rename · deleteRoom · memory · setRoomPassword · clearRoomPassword)가 여기로 모인다(D-45) | R-LOCK-006 · R-CHAT-011 |
| **F-CH-70** | `useChatLoader(roomId, { onRoomLocked, onRoomOpened })` (F-CH-03·05 개정) | 읽기 실패 | — | `loadInitial`·`loadOlder`: `!result.ok && result.error.code === 'ROOM_LOCKED'`면 `onRoomLocked()` 후 return(`initialLoadFailed`·`olderLoadFailed` dispatch 없음). `loadInitial` 성공이면 `initialLoadSucceeded` dispatch 직후 `onRoomOpened()`(D-55 카운터 리셋 — 시그니처 `useChatLoader(roomId, { onRoomLocked, onRoomOpened })`). 그 밖 불변 | 읽기 전용 열람자도 이 경로(E7) | R-LOCK-006 · R-MSG-001 |
| **F-CH-71** | `settleSpeakFailure` (F-CH-42 개정, useMessageWrites) | speak 실패 | — | 첫 분기 조건을 `isAuthFailure(error) \|\| error.code === 'ROOM_LOCKED'`로: `speakDiscarded` → `onFailure(error, 'speak')`(실패 말풍선·「재시도」 없음) | 전송 뒤 자동 응답(`'auto'`)도 같다 | R-LOCK-006 · R-CHAT-005 |
| **F-CH-72** | 메시지 id 래퍼 호출에 `roomId` (F-CH-20·23·34 개정, `useMessageWrites.ts`) | `options.roomId` | 요청 헤더 `X-Room-Key`(래퍼가 `getRoomKey(roomId)`로) | `editMessage(messageId, { text }, roomId)` · `deleteMessage(messageId, roomId)` · `regenerate(messageId, roomId)`. 그 밖 래퍼(`listMessages`·`appendUser`·`speak`·`renameRoom`·`deleteRoom`·`getMemory`·`putMemory`)는 호출 모양 불변(래퍼가 첫 인자 `roomId`로 헤더를 붙인다, api.md §11.18) | 빠뜨리면 tsc 오류 | R-LOCK-006 · R-MSG-004·005·006 |
| **F-CH-73** | `useMemoryLoad` · `useMemorySave` 떠남 조건 (F-CH-56·57 개정) | E13·E14 실패 | `onLeave(error)` | 조건 `isAuthFailure(e) \|\| e.code === 'NOT_FOUND' \|\| e.code === 'ROOM_LOCKED'`. `memoryLeft`는 불변(`NOT_FOUND` 외 → `handleWriteFailure` → F-CH-69) | — | R-LOCK-006 |
| **F-CH-74** | `openLock(): void` (`useRoomMenuHandlers`) | 방 메뉴 「잠금」 | `sheet` | F-CH-24 가드(`writing !== null \|\| isRoomBusy()`면 무시 — **UI로는 도달 불가, 방어적 비행동**: ⋯는 쓰기 대기·방 요청 중 `disabled`라 그때 메뉴가 열리지 않고, 메뉴 시트가 열린 동안은 덮개·포커스 트랩이 하단 바·말풍선 버튼을 막아 새 쓰기가 시작되지 않는다. 기존 F-CH-24·53 가드와 동일) → `room.locked ? { kind: 'lockMenu' } : { kind: 'password', mode: 'set', errorText: null }` | `room` = App이 보는 방(E18·E19·F-CH-64로 갱신) | R-CHAT-001 · R-LOCK-002 |
| **F-CH-75** | `askChangePassword(): void` · `askUnlock(): void` | 잠금 시트 항목 | `sheet` | `{ kind: 'password', mode: 'change', errorText: null }` · `{ kind: 'confirmUnlock' }` | — | R-LOCK-002 |
| **F-CH-76** | `setPassword(password: string): Promise<void>` (`useRoomActions`) | 시트 입력값 | `roomBusy` | `isRoomBusy()`면 무시 → `const wasLocked = room.locked` → `setBusy('setPassword')` → `await setRoomPassword(roomId, password)` → `!isActive()`면 종료 → `setBusy(null)` → ok: `onPasswordSet(r.value, wasLocked)` / 실패: `onFailure(r.error, 'setRoomPassword')`. `password`를 상태·로그에 두지 않는다 | `useChatSheets`의 `savePassword = (pw) => void setPassword(pw)` | R-LOCK-002 · 007 |
| **F-CH-77** | `onPasswordSet(result: SetRoomPasswordResponse, wasLocked: boolean): void` (`useRoomSheets`) | E18 200 | 증명·방·시트·토스트 | `saveRoomKey(room.id, result.entryKey)` → `onRoomRenamed(result.room)`(= `App.replaceRoomInView`) → `setSheet(null)` → `showNotice(wasLocked ? labels.passwordChanged : labels.roomLockedNotice, 'success')` | 포커스: 시트가 닫히며 BottomSheet가 ⋯로 | R-LOCK-002 · 004 · R-CHAT-010 |
| **F-CH-78** | `clearPassword(): Promise<void>` (`useRoomActions`) | 확인 「풀기」 | `roomBusy` | `isRoomBusy()`면 무시 → `setBusy('clearPassword')` → `await clearRoomPassword(roomId)` → `!isActive()`면 종료 → `setBusy(null)` → ok: `onPasswordCleared(r.value)` / 실패: `onFailure(r.error, 'clearRoomPassword')` | `useChatSheets`의 `confirmUnlock = () => void clearPassword()` | R-LOCK-002 |
| **F-CH-79** | `onPasswordCleared(room: RoomSummary): void` (`useRoomSheets`) | E19 200 | 증명·방·시트·토스트 | `forgetRoomKey(room.id)` → `onRoomRenamed(room)`(`locked: false`) → `setSheet(null)` → `showNotice(labels.unlockedNotice, 'success')` | 이미 풀린 방도 200(멱등) — 같은 처리 | R-LOCK-002 · 004 |
| **F-CH-80** | `onFailure(error, action)` (`useRoomSheets`, F-CH-26 개정) | 방 쪽 실패 | 시트·공통 처리 | 순서: ① `error.code === 'ROOM_LOCKED'` → `setSheet(null)` → `handleWriteFailure`(→ F-CH-69 관문) ② 인증 3종 → `setSheet(null)` → `handleWriteFailure`(전환) ③ `action === 'renameRoom'` → `{ kind: 'rename', errorText }`(불변) ④ `action === 'setRoomPassword'` → 열린 password 시트에 `errorText = writeErrorText(error, action)`(mode 유지, 입력 유지) ⑤ 그 밖(`deleteRoom`·`clearRoomPassword`) → `setSheet(null)` → `handleWriteFailure`(토스트) | ④의 `NOT_FOUND`도 시트 안 문구(이름 변경과 같음, D-50) | R-LOCK-002 · 006 · R-CHAT-011 |
| **F-CH-81** | 방 삭제 성공 (F-CH-27 개정, `useRoomSheets` `onDeleted`) | 204 · `NOT_FOUND` | 증명 삭제 | `forgetRoomKey(room.id)` → `clearLastRoomId()` → `onBack()` | 증명 없으면 저장소 쓰기 없음(F-RM-36) | R-CHAT-010 · R-LOCK-004 |
| **F-CH-82** | `LockMenuSheet(props)` | LK §1.4 | 시트 | LK §1.4 | — | R-CHAT-001 · R-LOCK-002 |
| **F-CH-83** | `RoomMenuSheet` `onLock` · `ChatSheets` 델타 · `SheetLayer` 배선 | LK §1.5 | — | `SheetLayer`가 `onAskLock={sheets.openLock}` · `onAskChangePassword={sheets.askChangePassword}` · `onAskUnlock={sheets.askUnlock}` · `onSavePassword={sheets.savePassword}` · `onConfirmUnlock={sheets.confirmUnlock}`를 넘긴다. `viewer.canWrite && <SheetLayer/>` 불변 | — | R-CHAT-001 · 008 |
| **F-CH-84** | `useRoomActions` 옵션·반환 확장 | — | — | 옵션 추가 `onPasswordSet` · `onPasswordCleared`. 반환 추가 `setPassword` · `clearPassword`. `RoomBusy` 확장(LK §2) | — | R-LOCK-002 |
| **F-CH-85** | labels 델타 | — | — | `WriteAction`에 `'setRoomPassword' \| 'clearRoomPassword'`. `validationText('setRoomPassword')` = `` `비밀번호는 ${ROOM_PASSWORD_MIN}~${ROOM_PASSWORD_MAX}자로 입력해 주세요.` ``(api.md §4.20 문구와 같은 글자). `validationText('clearRoomPassword')`는 기존 기본 분기(메시지 문구)를 그대로 둔다 — E19는 본문이 없어 `VALIDATION_ERROR`를 내지 않는다(정상 경로 없음). `NOT_FOUND`는 기본 방 문구. 새 키는 LK §6 | — | R-CHAT-011 |

---

## 4. 파이프라인

### 4.1 잠그기 (안 잠긴 방)

```
⋯ → 방 메뉴 → 잠금 → (room.locked false) 「비밀번호 걸기」 시트 · 입력 포커스 · 0/32
 입력 4~32자(trim 없음, 코드 포인트) → 「잠그기」 활성 / 1~3자·33자 이상 비활성(33+ 카운터 over · aria-invalid)
 잠그기 · Enter → setRoomPassword(room.id, pw) · 입력 readOnly · 두 버튼 disabled · Esc·덮개 막힘 · ⋯·버튼 줄 잠금
  ├ 200 → ld:roomKeys 에 [id, entryKey] → App 방 갱신(locked true) → 시트 닫힘 → ⋯ 포커스 → 토스트 「방을 잠갔습니다.」
  ├ ROOM_LOCKED → 시트 닫힘 → 입장 재요구(§4.4)
  ├ 인증 3종 → 시트 닫힘 → 읽기 전용 전환(F-CH-16)
  └ 그 밖(VALIDATION_ERROR · RATE_LIMITED · NOT_FOUND · NETWORK · INTERNAL · CONFIG_INVALID) → 시트 유지 · 입력 유지 · 시트 안 role=alert
```

### 4.2 비밀번호 바꾸기 (잠긴 방)

```
⋯ → 방 메뉴 → 잠금 → (room.locked true) 잠금 시트 → 비밀번호 바꾸기 → 「비밀번호 바꾸기」 시트(저장 = 바꾸기)
 → 이후 §4.1 과 같다. 200 → 새 증명으로 덮어씀(옛 증명은 서버에서 무효) → 토스트 「비밀번호를 바꿨습니다.」
```

- 다른 브라우저의 기억은 모두 무효 → 그쪽은 다음 요청에서 `ROOM_LOCKED` → §4.4(R-LOCK-004).

### 4.3 잠금 풀기 (잠긴 방)

```
잠금 시트 → 잠금 풀기 → 확인 「잠금을 풀까요?」(alertdialog, 첫 포커스 취소)
 ├ 취소 · Esc · 덮개 → 닫힘(요청 없음)
 └ 풀기 → clearRoomPassword(room.id) · 두 버튼 disabled · Esc·덮개 막힘
     ├ 200 → ld:roomKeys 에서 그 방 삭제 → App 방 갱신(locked false) → 시트 닫힘 → 토스트 「잠금을 풀었습니다.」
     ├ ROOM_LOCKED → 시트 닫힘 → §4.4
     ├ 인증 3종 → 시트 닫힘 → 전환
     └ 그 밖 → 시트 닫힘 → E 토스트(코드 문구)
```

- 데이터 삭제가 아니라 confirm 문구에 "되돌릴 수 없음"을 넣지 않는다(다시 잠글 수 있다). 노출 범위가 넓어지는 조작이라 confirm은 둔다(구성안 §5.3).

### 4.4 입장 재요구 (`ROOM_LOCKED` — 어느 요청에서든)

```
E7(첫 로드·이전 페이지) · E8~E14 · E5·E6 · E18·E19 응답 ROOM_LOCKED
 → onRoomLocked(F-CH-64): 이미 잠긴 판이면 무시
 → (room.locked false 면) App 방 갱신 locked true
 → ChatRoomView 언마운트(진행 중 응답 폐기, 하단 바 입력·임시 말풍선·편집기·시트 사라짐, 자동 재시도 없음)
 → LockedRoomView: ‹ 포커스(시트 없을 때만, §1.3) · 「잠긴 방입니다」 · ⋯·하단 바 없음
 → requestEntry(room, 'locked'): forgetRoomKey(room.id)
     ├ 토큰 있음 → enterRoom(room.id)(비밀번호 없음, 진행 표시 없음)
     │   ├ 200 문자열 → saveRoomKey → 재입장(F-CH-65)   ← 주인(R-LOCK-005)
     │   ├ 200 null(그사이 해제) → 재입장
     │   ├ ROOM_LOCKED → 입장 시트(문구 없음)
     │   ├ NOT_FOUND → 목록(lastRoomId 지움)
     │   └ 그 밖 → 입장 시트 + 코드 문구
     └ 토큰 없음 → 입장 시트(요청 없음)
 입장 시트 → enterRoom(room.id, pw) → 200 → 재입장 / 틀림·429·NETWORK → 시트 안 문구(rooms lock.md §8.2) / NOT_FOUND → 목록
 취소 · Esc · 덮개 → clearLastRoomId → onBack(목록)
 재입장 = 새 ChatRoomView 마운트 → saveLastRoomId → ‹ 포커스 → listMessages(새 증명 헤더) → 맨 아래 배치
```

- 입장 시트 상태·문구·연타 방지는 rooms 정의 그대로(F-RM-41~44, rooms lock.md §6.8). chat이 더하는 것은 `onEntered` = 재입장, `onRoomGone`·취소 = 목록 복귀뿐.

---

## 5. contract 계약 사용표 (api.md v0.9 인용)

| 엔드포인트 | 요청 | 응답 타입(`shared/src/types.ts`) | 래퍼(`@/api`) | 호출 위치 | 토큰 | `X-Room-Key` | 실패 시 표시 |
|---|---|---|---|---|---|---|---|
| E18 `PUT /api/rooms/:id/password` (§4.20) | `SetRoomPasswordBody = { password: string }`(4~32, trim 없음) | `200` `SetRoomPasswordResponse = { room: RoomSummary; entryKey: string }`(`room.locked` true, `updatedAt` 불변) | `setRoomPassword(roomId: string, password: string): Promise<Result<SetRoomPasswordResponse>>` | F-CH-76 | ○ | 래퍼(잠긴 방이면 필요) | LK §4.1 · §6.2 |
| E19 `DELETE /api/rooms/:id/password` (§4.21) | 없음 | `200` `RoomSummary`(`locked: false`, 멱등) | `clearRoomPassword(roomId: string): Promise<Result<RoomSummary>>` | F-CH-78 | ○ | 래퍼 | LK §4.3 · §6.2 |
| E17 `POST /api/rooms/:id/enter` (§4.19) | `EnterRoomBody` | `EnterRoomResponse = { entryKey: string \| null }` | `enterRoom(roomId, password?)` | `useRoomEntry`(F-RM-42·43) — chat은 직접 부르지 않는다 | 선택 | 없음 | rooms lock.md §8.2 |
| 관문 E5·E6 · E7 · E8·E9 · E13·E14 (§2.8.3) | 불변 | 불변 | `renameRoom`·`deleteRoom`·`listMessages`·`appendUser`·`speak`·`getMemory`·`putMemory` — **호출 모양 불변** | 기존 | 기존 | 래퍼가 첫 인자 `roomId`로 | `ROOM_LOCKED` → §4.4 |
| 관문 E10·E11·E12 (§2.8.3, 메시지 id 경로) | 불변 | 불변 | `editMessage(messageId, body, roomId)` · `deleteMessage(messageId, roomId)` · `regenerate(messageId, roomId)` — **마지막 인자 필수** | F-CH-72 | ○ | 래퍼가 `roomId`로 | `ROOM_LOCKED` → §4.4 |
| (엔드포인트 아님) | — | `ROOM_LOCKED`(403) · `ROOM_PASSWORD_WRONG`(403) — `isAuthFailure` false | `@/api` · `@shared/errors` | F-CH-69~71·73·80 | — | — | — |

- E18·E19가 낼 수 있는 코드: 공통 `TOKEN_REQUIRED`·`TOKEN_INVALID`·`LEVEL_TOO_LOW`·`RATE_LIMITED`(+`retryAfterSec`)·`ROOM_LOCKED`·`CONFIG_INVALID`·`INTERNAL` · E18 `VALIDATION_ERROR`(화면이 4~32를 먼저 막아 정상 경로 없음) · `NOT_FOUND` · 클라이언트 `NETWORK`.
- 주인 프리패스(R-LOCK-005)는 서버 판정이다. 화면은 주인 여부를 쓰지 않는다(api.md §2.8.4). 비주인 글쓰기 권한자는 증명이 있는 방만 바꾸거나 풀 수 있고, 증명이 없으면 `ROOM_LOCKED` → §4.4.
- 화면은 `fetch`·헤더·증명 해석을 하지 않는다. 증명 값을 로그·문구에 넣지 않는다(R-LOCK-007).
- 미확정 계약 없음.

---

## 6. 확정 문구·라벨 (`ui/src/chat/labels.ts` 추가)

### 6.1 키

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `lock` | `잠금` | 방 메뉴 항목 |
| `lockMenuAriaLabel` | `잠금 메뉴` | 잠금 시트 `aria-label` |
| `lockMenuHeader(title)` | `` `잠금 · ${title}` `` | 잠금 시트 머리 줄 |
| `changePassword` | `비밀번호 바꾸기` | 잠금 시트 항목 |
| `unlock` | `잠금 풀기` | 잠금 시트 항목 |
| `setPasswordTitle` | `비밀번호 걸기` | 걸기 시트 h2 · `aria-label` |
| `setPasswordSave` | `잠그기` | 걸기 시트 저장 버튼 |
| `changePasswordTitle` | `비밀번호 바꾸기` | 바꾸기 시트 h2 · `aria-label` |
| `changePasswordSave` | `바꾸기` | 바꾸기 시트 저장 버튼 |
| `passwordInputAriaLabel` | `새 비밀번호` | 두 시트 입력 `aria-label` |
| `passwordPlaceholder` | `6자 이상 권장` | 두 시트 입력 placeholder |
| `unlockTitle` | `잠금을 풀까요?` | 확인 h2 · `aria-label` |
| `unlockBody` | `잠금을 풀면 누구나 이 방 대화를 볼 수 있습니다.` | 확인 설명 |
| `unlockConfirm` | `풀기` | 확인 버튼 |
| `cancel`(재사용) | `취소` | 각 시트 |
| `roomLockedNotice` | `방을 잠갔습니다.` | 토스트(success) |
| `passwordChanged` | `비밀번호를 바꿨습니다.` | 토스트(success) |
| `unlockedNotice` | `잠금을 풀었습니다.` | 토스트(success) |
| `lockedRoom` | `잠긴 방입니다` | 입장 재요구 판 StateView |
| (입장 시트) | `roomEntryText` 그대로 — `비밀번호` · `방 비밀번호` · `입장` · `취소` · 오류 문구 | rooms lock.md §8.2(chat은 재정의하지 않는다) |

### 6.2 E18·E19 실패 문구 (`writeErrorText(error, 'setRoomPassword' \| 'clearRoomPassword')`)

| code | 문구 | 표시 |
|---|---|---|
| `ROOM_LOCKED` | (없음) | 입장 재요구 판 |
| 인증 3종 | L §8.3 전환 문구 | E 토스트(warning) + 전환 |
| `VALIDATION_ERROR` | `비밀번호는 4~32자로 입력해 주세요.` | 걸기·바꾸기 시트 안 |
| `RATE_LIMITED` | `요청이 너무 많습니다. {n}초 후 다시 시도해 주세요.` · 값 없음 `ERROR_MESSAGES.RATE_LIMITED` | 시트 안(E18) · 토스트(E19) |
| `NOT_FOUND` | `ROOM_NOT_FOUND_TEXT`(기존 방 문구) | 시트 안(E18) · 토스트(E19) |
| `NETWORK` | `NETWORK_TEXT` | 같음 |
| 그 밖 | `ERROR_MESSAGES[code]` | 같음 |

---

## 7. 접근성

| 항목 | 규칙 |
|---|---|
| 메뉴 항목 | 보이는 글자가 이름(`잠금` · `비밀번호 바꾸기` · `잠금 풀기`). 잠금 시트 `role=dialog` `aria-label="잠금 메뉴"` |
| 걸기·바꾸기 시트 | `role=dialog` 이름 = 제목. 열리면 입력 포커스. Enter = 저장(활성일 때) · Esc = 취소(요청 중 무시). 카운터 `aria-hidden`, 33자 이상 `aria-invalid`. 실패 문구 `role=alert` |
| 풀기 확인 | `role=alertdialog` 이름 `잠금을 풀까요?` · 첫 포커스 취소 |
| 포커스 복귀 | 시트가 닫히면 BottomSheet 규칙(⋯). 전환 → ‹(F-CH-29) |
| 입장 재요구 판 | 마운트 시 **시트가 같은 커밋에 열렸으면(토큰 없음) 시트 입력 포커스 유지, 시트가 없으면(토큰 있음·조용한 시도 중) ‹ 포커스** → 시트가 나중에 열리면 입력 포커스, 닫힘 복귀 대상 ‹(LK §1.3). StateView `role=status`가 `잠긴 방입니다`를 읽는다. 입장 시트 `role=dialog` 이름 `비밀번호` · 입력 포커스 · 실패 `role=alert`(rooms a11y S6 행) |
| 재입장 | 새 `ChatRoomView` 마운트 → ‹ 포커스(F-CH-02 불변) |
| 탭 순서(잠긴 판) | ‹ → (시트가 열리면 시트 안 순환) |

---

## 8. 읽기 전용 분기 (S6)

"미렌더" = DOM에 없음. 판정은 `viewer.canWrite` 하나.

| 요소 | 토큰 없음 · 전환 후 | 토큰 있음 | 구현 |
|---|---|---|---|
| 방 메뉴 「잠금」 · 잠금 시트 · 걸기/바꾸기 시트 · 풀기 확인 | **미렌더**(⋯ 자체가 없다) · E18·E19 0회 | 렌더 | `onOpenMenu={canWrite ? … : undefined}` · `canWrite && <SheetLayer/>`(불변) |
| 입장 재요구 판 · 입장 시트 | **동작**(바로 시트) | 동작(조용한 시도 실패 시 시트) | `useRoomLockGate` — 토큰과 무관, `canWrite`는 ③/④ 분기에만 |
| 잠긴 판의 ⋯ · 하단 바 | 원래 없음 | **미렌더**(D-46) | `LockedRoomView`가 그리지 않는다 |
| 잠긴 판의 D 열람 안내 | **렌더** | 미렌더 | `!viewer.canWrite && <ReadOnlyNotice/>` |
| 메시지 id 래퍼 `roomId` | 호출 경로 없음 | F-CH-72 | — |

- 전환(인증 실패)은 `ROOM_LOCKED`와 독립이다. 잠긴 판에서 전환이 일어나도 판·시트는 그대로다(입장 시트는 쓰기 UI가 아니다).

---

## 9. 저장소·비밀값

- 증명 쓰기·삭제 시점(chat): E18 성공 `saveRoomKey` · E19 성공 `forgetRoomKey` · 방 삭제 성공(·`NOT_FOUND`) `forgetRoomKey` · `ROOM_LOCKED` → `requestEntry(room, 'locked')`가 `forgetRoomKey` · 입장 성공 → `useRoomEntry`가 `saveRoomKey`. 그 밖 경로는 저장소를 건드리지 않는다.
- 잠금을 쓰지 않는 사용자의 `localStorage` 키 목록은 S5와 같다(`ld:roomKeys` 없음 — rooms F-RM-33·36). 토큰·비밀번호 원문은 어떤 키에도 없다(R-CHAT-009 🔒 · R-LOCK-007 🔒).
- 호환(R-LOCK-009): 안 잠긴 방의 chat 동작·DOM은 메뉴 항목 1개 추가 말고 불변. 기존 TC는 픽스처 `locked: false` · mock 래퍼 추가 · 메시지 id 래퍼 인자 단언 외 무수정(LT §2).

---

## 10. 설계 결정 (S6)

| # | 결정 | 근거 |
|---|---|---|
| D-44 | **잠금 관문 = `ChatScreen` 껍데기 + `ChatRoomView key={epoch}`**. 잠기면 본문을 언마운트하고, 입장 성공이면 epoch를 올려 새로 마운트한다 | 진행 중 요청·임시 말풍선·편집기·시트·쓰기 팻말을 한 번에 버린다(리듀서 액션 추가 없음, 전이표 불변). 재입장이 첫 진입(F-CH-02)과 같은 경로라 새 증명으로 첫 로드·스크롤 복원이 그대로 된다. App·`ChatScreenProps` 불변 |
| D-45 | `ROOM_LOCKED` 수렴점 = `handleWriteFailure`(쓰기 전부) + `useChatLoader`(읽기 2곳) + `settleSpeakFailure`(말풍선 대신). 토스트·전환 없음 | 인계 메모 "어느 래퍼에서든 → 증명 삭제 → 입장 재요구, 전환 아님, 재시도 없음". 경로마다 처리를 흩지 않는다 |
| D-46 | 입장 재요구 판에서 ⋯·하단 바 **미렌더 채택**(메인 권고 ⑤), 상단 바 날짜 유지 | 입장 전 메뉴·쓰기는 모두 관문에 걸려 실패만 만든다(구성안 §6 ⑥). R-CHAT-001·004 "토큰 있을 때만 렌더"의 반대 방향 조건이 아니라 추가 조건이라 요구와 충돌 없음 |
| D-47 | 「잠금 풀기」 항목 = default 톤(메인 권고 ⑥). **확인 버튼은 공용 `ConfirmDialog` 그대로 danger 모양 — 메인 승인(2026-10-08), 공용 델타 없음** | `ConfirmDialog` 확인 버튼은 danger 고정(rooms components.md §1.16). 풀기는 대화를 누구에게나 여는 조작이라 주의 색이 어긋나지 않는다 |
| D-48 | 「잠금」 분기 = App이 보는 `room.locked`. E18·E19 응답 · `ROOM_LOCKED` 수신(`locked: true`, F-CH-64) · **재입장 뒤 `getRoomKey(room.id) === null`(E17 `entryKey: null` = 안 잠긴 방)이면 `locked: false`로 되돌림(F-CH-65)** 으로 갱신. rooms 공용 시그니처는 바꾸지 않는다 | 단건 조회 엔드포인트가 없다. 서버가 알려 준 순간 표시를 맞추면 재입장 뒤 메뉴가 「걸기」/잠금 시트 중 잘못된 쪽으로 열리지 않는다 |
| D-49 | 바꾸기 판 저장 버튼 `바꾸기` · 입력 이름 `새 비밀번호` · 확인 제목 `잠금을 풀까요?` · 토스트 `비밀번호를 바꿨습니다.`·`잠금을 풀었습니다.` | 요구·구성안에 없는 자리(구성안 §5.2 "제목·저장 버튼 문구만 다르다", ConfirmDialog는 제목 필수). `방을 잠갔습니다.`(s6-02 §6.3)와 같은 꼴 |
| D-50 | E18 실패 = 이름 변경과 같은 규칙(비인증·비잠김은 시트 안, 입력 유지). E19 실패 = 방 삭제와 같은 규칙(시트 닫고 토스트) | 입력이 있는 시트는 입력 보존(D-7·D-37), 확인 시트는 입력이 없다 |
| D-51 | 잠금 요청 중 표시는 `RoomBusy` 확장 | ⋯ 비활성·버튼 줄 잠금·메뉴 가드가 그대로 따라온다 |
| D-52 | 잠긴 판 전환 때 하단 바 입력 중이던 글은 사라진다 | 실패한 쓰기 자동 재시도 없음(인계 메모). 입력 보존을 위해 상태를 들고 있으면 D-44의 일괄 폐기가 깨진다. **매뉴얼 기재로 충분 — 메인 결정(2026-10-08)** |
| D-53 | 주인이 증명을 잃으면 조용한 시도 동안 `잠긴 방입니다`가 잠깐 보였다 바로 재입장 | 진행 표시를 더하지 않는다(rooms D-L9). 화면은 주인 여부를 모른다 |
| D-54 | 걸기·바꾸기 시트 카운터 상한 32, placeholder `6자 이상 권장` | rooms D-L1 · D-L2 · 사용자 결정 U6 |
| D-55 | **조용한 재입장은 한 `ROOM_LOCKED` 에피소드당 연속 2회까지, 3회째는 조용한 시도 없이 입장 시트.** 카운터 = 껍데기 `ChatScreen`의 **상태** `quietReentryCount` 1개(`useState`, ref 아님 — 렌더 중 읽어 `useRoomEntry`의 `canWrite = viewer.canWrite && quietReentryCount < 2`를 계산): 조용한 시도로 재입장할 때 +1(F-CH-65 — 판별은 gate 지역 플래그 `quietAttemptRef`: 조용한 시도 시작 직전 true, 시트 제출 false, `onEntered`에서 읽은 뒤 false. `entry.sheet` 판별 금지), 재입장 뒤 첫 정상 첫 로드(`onRoomOpened`, F-CH-70)에 0. 시트로 들어오면 늘지 않는다 | 서버 이상(E17은 200을 주는데 E7이 계속 `ROOM_LOCKED`)일 때 조용한 시도 ↔ 재입장 무한 반복을 막는다. rooms `useRoomEntry`의 `canWrite` 값만 좁혀 공용 시그니처를 건드리지 않는다 |

구성안·메인 권고와 다른 것: 없음(D-47은 메인 승인).

---

## 11. 공용화 후보 (보고만)

| 후보 | 판단 |
|---|---|
| 공용 `ConfirmDialog` `confirmVariant?: 'danger' \| 'primary'` | **채택 안 함**(D-47 메인 승인 — danger 유지). 사용처 1곳 |
| `LockMenuSheet`·`RoomMenuSheet` 틀 | 같은 화면 2회 — 3회 미만, 추출 안 함 |

---

## 12. 예정 TC → `design/lock-tests.md`

TC-CH-140~163 · 기존 TC 영향표 · 인계(ui-implementer 파일 표 · ui-test-designer mock·픽스처).

---

## 13. 변경이력 (이 분할 문서)

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v2.3 | 2026-10-08 | 최초 작성(S6 chat 델타): 레이아웃 4판 · 관문 구조 · LockedRoomView · LockMenuSheet · RoomMenuSheet·ChatSheets 델타 · 상태 · F-CH-63~85 · 파이프라인 4종 · 계약 E18·E19·관문 · 문구 · 접근성 · 읽기 전용 · 저장소 · D-44~54 | 승인 ① 2026-10-08 · s6-03 §3.3 · 구성안 ui-layout-04 §5 · api.md v0.9 |
| v2.3.1 | 2026-10-08 | 검증 반영: §1.3·§7·F-CH-64 잠긴 판 포커스 규칙(시트 있으면 ‹ 생략) · F-CH-65·D-48 재입장 뒤 증명 없음 → `locked: false` · F-CH-85 `clearRoomPassword` 문구 · §2 `quietReentryCount`·`latestRef`·`latestLockedRef`·`backButtonRef` · F-CH-63 `submitPassword` 매핑·`canWrite` 좁힘 · F-CH-70 `onRoomOpened` · D-55 신설 · D-47·D-52 메인 승인 표기 · §11 | ui-design-checker FAIL(HIGH 1·MEDIUM 2·LOW 5) · 메인 결정 |
| v2.3.2 | 2026-10-08 | 재검증 반영: D-55 카운터 = 껍데기 상태(`useState`) · §4.4 ‹ 포커스 조건 · §2 증명 행 `getRoomKey` · F-CH-70 시그니처 통일 · F-CH-74 가드 = 도달 불가·방어적 비행동 명시 · 제목 버전 v2.3.2 · 자동 흐름 번호 TC-FLOW-CH-22(LT) | ui-design-checker 재검증 · 시나리오 검증 설계 몫 2건 |
