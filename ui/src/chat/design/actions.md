# chat 상세 설계 — S3e 말풍선 액션 버튼 (분할 문서, v2.0)

> 주 문서: `ui/src/chat/design.md`(RTM은 `design/rtm.md`). 40KB 한계 때문에 S3e 델타 본문은 이 파일 하나에 모은다. 다른 분할 문서에는 이 파일을 가리키는 짧은 줄과 삭제 표시만 둔다. 절 표기 `AC` = 이 파일.
> 요구: **R-CHAT-007 🔒(2026-10-07 개정, S3e)** · R-CHAT-002 🔒(배치 유지) · R-CHAT-005(재작성 흐름·잠금 재사용) · R-CHAT-008 🔒(토큰 없으면 미렌더) · R-CHAT-013 🔒(접근성 레이블·390px) · 데이터 R-MSG-004 · 005 · 006 🔒(동작 그대로). 요구 원문 `ui/src/chat/requirements.md` **v2.0**.
> 계약: **변경 없음.** `editMessage`·`deleteMessage`·`regenerate` 래퍼 재사용(api.md §4.10 · §4.11 · §4.14). 새 엔드포인트·래퍼·에러 코드 없음. 권한 규칙 불변(R-MSG-008).
> 구성안: 별도 구성안 없음. 메인 세션 사전 확정 1~7과 참고 캡처(말풍선 아래 테두리 없는 작은 글자 「수정 재작성」)를 레이아웃 입력으로 수용한다.
> CR: `ui/src/chat/test/change-requests.md` **CR-003**(기록은 ui-implementer). 이 문서는 인용만 한다.

비유: 지금까지는 말풍선을 길게 눌러야 서랍(바텀시트)이 열렸다. 이제 서랍을 없애고, 자주 쓰는 도구 세 개를 말풍선 바로 아래 선반에 늘 꺼내 둔다. 선반은 출입증이 있는 사람에게만 보이고, 주방(쓰기 팻말)이 바쁜 동안에는 도구가 잠긴다.

---

## 0. 레이아웃 [확정 — 사전 확정 1 · 캡처 수용]

390px 기준 약 48칸. 쓰기 판의 히스토리 조각이다. `[ ]`는 버튼 경계 표시일 뿐이고 실제 버튼에는 테두리·배경이 없다(ghost).

```
+----------------------------------------------+
| (o) 세바스찬                           16:40 |
|     도련님, 홍차입니다.                      |
|     [수정] [삭제]                            |  버튼 줄 28px. 세바스찬 = 왼쪽, 본문 시작선(아바타 28 + 8px)에 맞춤
|                 미샤 · 16:42                 |
|           [ 나도 한 잔 부탁해요. ]           |
|                [수정] [삭제]                 |  유저 = 가운데
|         - [지시] 둘이 체스를 둔다 -    16:43 |
|                [수정] [삭제]                 |  OOC = 가운데
| 16:44                              시엘 (o) |
|                   다 됐어, 세바스찬.        |
|                  [수정] [재작성] [삭제]     |  시엘 = 오른쪽, 본문 끝선에 맞춤. 마지막 캐릭터 메시지라 재작성
|                     …                        |  (pending) 임시·실패 말풍선 = 버튼 줄 없음
+----------------------------------------------+
```

| 조각 | 상태 |
|---|---|
| 버튼 줄 위치·정렬·순서 | **확정** — 말풍선 바로 아래, 말풍선과 같은 쪽, 「수정」→(「재작성」)→「삭제」 |
| 버튼 줄 높이 | **확정** — 28px(공용 Button `sm`) + 위 여백 `--space-1`. 말풍선 한 개당 히스토리 높이가 약 32px 늘어난다 |
| 390px 한 줄 | **확정** — 세 버튼 합계 약 160px + 들여쓰기 36px = 약 196px < 358px(좌우 여백 `--space-4` 제외 폭) |
| 바텀시트 말풍선 메뉴 | **삭제**(`design/layout.md` §0의 말풍선 메뉴 그림은 폐기 표시) |

---

## 1. 컴포넌트 — `BubbleActions` (`ui/src/chat/components/BubbleActions.tsx`, chat 로컬 신규)

분류: ④ chat 로컬. 메시지·화자 의미를 안다. 공용 `Button`만 조립한다. 표준 `<button>`을 직접 쓰지 않는다.

```ts
export type BubbleActionHandlers = {
  onEdit: (message: Message) => void           // F-CH-46 startEdit
  onRegenerate: (message: Message) => void     // F-CH-48 regenerateFromActions
  onDelete: (message: Message) => void         // F-CH-47 askDeleteMessage
}
export type BubbleActionsProps = BubbleActionHandlers & {
  message: Message
  canRegenerate: boolean        // message.id === regenerateTargetId (F-CH-52)
  isDisabled: boolean           // isActionLocked (AC §4)
  shouldFocusEdit: boolean      // message.id === editFocusId (F-CH-50)
  onEditFocusDone: (isFocused: boolean) => void
}
export const BubbleActions = memo(BubbleActionsView)   // named export만
```

**DOM(F-CH-45).**

```
<div role="group" aria-label={labels.bubbleActionsAriaLabel(name)}
     className={cx(styles.actions, styles[bubbleVariantOf(message)])}>
  <Button size="sm" variant="ghost" ariaLabel={labels.editActionAriaLabel(name)}
          isDisabled={isDisabled} buttonRef={editRef} onClick={() => onEdit(message)}>{labels.edit}</Button>
  {canRegenerate && (
    <Button size="sm" variant="ghost" ariaLabel={labels.regenerateActionAriaLabel(name)}
            isDisabled={isDisabled} buttonRef={regenerateRef} onClick={pressRegenerate}>{labels.regenerate}</Button>)}
  <span className={styles.danger}>
    <Button size="sm" variant="ghost" ariaLabel={labels.deleteActionAriaLabel(name)}
            isDisabled={isDisabled} onClick={() => onDelete(message)}>{labels.delete}</Button>
  </span>
</div>
```

- `name = nameOf(message)` — 이 파일 지역 함수. 삭제되는 `MessageMenuSheet.tsx`의 `nameOf`를 **그대로 옮긴다**: 변형 `sebastian`·`ciel` → `CHARACTERS[variant].shortName` · `user` → `userAuthorLabel(message.authorName)`(「어떠한 의지」) · `ooc` → `labels.oocPrefix`(`[지시]`). `excerptOf`는 옮기지 않는다(삭제).
- `pressRegenerate = () => { regeneratePressedRef.current = true; onRegenerate(message) }`(F-CH-51).
- `canRegenerate`가 false면 「재작성」은 **DOM에 없다**(비활성 아님).
- 지역 훅 2개: `useEditFocus(editRef, shouldFocusEdit, onEditFocusDone)`(F-CH-50) · `useRefocusAfterUnlock(isDisabled, regenerateRef, regeneratePressedRef)`(F-CH-51).
- **(v2.0.1 실물)** 버튼 하나는 지역 부품 **`ActionButton`**(props `{ label; ariaLabel; isDisabled; buttonRef?; onClick }`)이 그린다 — 안은 `Button size='sm' variant='ghost'` 그대로. 위 DOM의 세 `Button`은 `ActionButton` 세 번 호출이고 DOM은 같다(50줄 한계 분리). 파일 157줄.
- `memo`: 같은 props면 다시 그리지 않는다. `isDisabled`가 바뀌면 모든 버튼 줄이 다시 그려진다(Bubble은 다시 그려지지 않는다 — props 불변). 한 페이지 30~100개 수준이라 허용.

**스타일(`BubbleActions.module.css`, 토큰만).**

| 선택자 | 규칙 | 근거 |
|---|---|---|
| `.actions` | `display: flex; align-items: center; gap: var(--space-1); margin-top: var(--space-1)` | 간격 좁게(사전 확정 1) |
| `.sebastian` | `justify-content: flex-start; padding-left: calc(28px + var(--space-2))` | 본문 시작선 = 아바타 28px + Bubble `.character` gap `--space-2` |
| `.ciel` | `justify-content: flex-end; padding-right: calc(28px + var(--space-2))` | 시엘 거울(본문 끝선). DOM 순서는 그대로 수정→재작성→삭제 |
| `.user` · `.ooc` | `justify-content: center` | CR-001 가운데 배치 |
| `.actions button` | `color: var(--color-fg-muted)` | 수정·재작성 보조색(D-25 지역 덧칠) |
| `.danger button` | `color: var(--color-danger)` | 삭제 danger 톤. `.actions button`보다 **뒤에** 둔다(같은 특이도, 뒤가 이긴다) |
| `.danger` | `display: inline-flex` | 래퍼가 줄 높이를 바꾸지 않게 |

- 공용 Button이 그대로 주는 것: 높이 28px · 글자 `--text-sm` · 좌우 패딩 10px · 터치 영역 위아래 8px 확장(44px, ui_design_concept §6) · `:focus-visible` 포커스 링 · 비활성 `--btn-busy-opacity` · ghost 호버 배경 `--row-hover-bg`.
- 테스트 클래스 키(non-scoped): 그룹 루트 `actions` + 변형 키 하나(`sebastian`·`ciel`·`user`·`ooc`).

---

## 2. 배선 델타

| 위치 | 변경 |
|---|---|
| `MessageList.tsx` `MessageListProps` | **삭제** `onOpenMenu?`. **추가** `actions?: BubbleActionHandlers \| undefined`(쓰기 가능일 때만, 없으면 버튼 줄 DOM 없음) · `isActionLocked: boolean` · `regenerateTargetId: number \| null` · `editFocusId: number \| null` · `onEditFocusDone: (isFocused: boolean) => void` |
| `MessageList.tsx` 지역 `MessageItem` | 수정 중이면 `InlineEditor`(그대로). 아니면 `<Bubble message isRegenerating />` 뒤에 `actions !== undefined`일 때만 `<BubbleActions message={message} canRegenerate={message.id === regenerateTargetId} isDisabled={isActionLocked} shouldFocusEdit={message.id === editFocusId} onEditFocusDone={onEditFocusDone} {...actions} />`. 둘 다 같은 `<li>` 안(형제, D-28). pending `<li>`에는 넣지 않는다. **(v2.0.1 실물)** 버튼 줄 조건부 렌더는 지역 부품 **`ActionsLine`**(props = `actions`·`isActionLocked`·`regenerateTargetId`·`editFocusId`·`onEditFocusDone` + `message`, `actions === undefined`면 `null`)이 맡고 `MessageItem`은 `<ActionsLine/>`만 둔다. DOM 같음 |
| `Bubble.tsx` | `onOpenMenu` prop 삭제. props = `{ message; isRegenerating? }`. AC §3 삭제 목록 |
| `index.tsx` `HistoryProps` | **삭제** `onOpenMenu`. **추가** `actions: BubbleActionHandlers` · `isRoomBusy: boolean` · `editFocusId: number \| null` · `onEditFocusDone` |
| `index.tsx` `renderHistory`(F-CH-39) | `actions={canWrite ? props.actions : undefined}` · `isActionLocked={!canSpeak(state) \|\| props.isRoomBusy}` · `regenerateTargetId={canWrite ? regenerateTargetIdOf(state) : null}` · `editFocusId={canWrite ? props.editFocusId : null}` · `onEditFocusDone={props.onEditFocusDone}` |
| `index.tsx` `ChatScreen` | `renderHistory({ …, actions: sheets.messageActions, isRoomBusy: sheets.roomBusy !== null, editFocusId: write.editFocus.editFocusId, onEditFocusDone: write.editFocus.onEditFocusDone })`. `SheetLayer`는 `onStartEdit`·`onRegenerate`·`onAskDeleteMessage`를 넘기지 않는다 |
| `ChatSheets.tsx` | `ChatSheet`에서 `{ kind: 'messageMenu'; … }` 삭제. `ChatSheetsProps`에서 `onStartEdit`·`onRegenerate`·`onAskDeleteMessage` 삭제(세 개 모두 메뉴 항목 전용이었다). `renderMessageSheet`는 `confirmDeleteMessage`(ConfirmDialog) 하나만 |
| `useChatSheets.ts` | `openMessageMenu` 삭제 · `useRegenerateFromMenu` → `useRegenerateAction`(F-CH-48) · `startEdit`·`askDeleteMessage`에 가드(F-CH-46·47) · `cancelEdit`(F-CH-49) · 옵션 추가 `requestEditFocus: (messageId: number) => void` · 반환 추가 **`messageActions: BubbleActionHandlers`**(`useMemo(() => ({ onEdit: startEdit, onRegenerate: regenerateFromActions, onDelete: askDeleteMessage }), [...])`, 참조 안정 — memo 격리). 반환에서 `openMessageMenu`·`regenerateFromMenu` 삭제. **(v2.0.1 실물)** 지역 훅 **`useIsActionLocked(getState, isRoomBusy)`**(`useCallback(() => !canSpeak(getState()) \|\| isRoomBusy())` — F-CH-46·47·48 가드 공용, D-27 식) · **`useConfirmDeleteMessage({ removeMessage, loadInitial, focusLog, setSheet })`**(F-CH-23 본체 그대로)로 분리. `useRegenerateAction`은 옵션으로 `isLocked`를 받는다 |
| `useChatScreen.ts` | 지역 훅 **`useEditFocusReturn(focusLog)`**(F-CH-50) 추가. `useSaveEditAndFocus`의 성공 처리 `focusLog()` → `requestEditFocus(messageId)`. `useChatSheets`에 `requestEditFocus` 전달. `write`에 `editFocus: { editFocusId, onEditFocusDone }` 추가. **(v2.0.1 실물)** 읽기 전용 전환 정리(F-CH-29: `closeSheet` → `writeAccessRevoked` → ‹ 포커스)를 지역 훅 **`useRevokeCleanup(canWrite, closeSheet, dispatch, backButtonRef)`**(`useAccessRevoked` 래핑)로 뺐다. 동작 같음 |
| `state/chat.ts` | 순수 함수 **`regenerateTargetIdOf(s): number \| null`** 추가(F-CH-52). 리듀서·전이표·`ChatState` 불변 |
| `labels.ts` | AC §8 |

**상태 추가(로컬 1개).**

| 상태 | 용도 | 타입 | 초기값 | 소유 |
|---|---|---|---|---|
| `editFocusId` | 편집기가 닫힌 뒤 포커스를 보낼 「수정」 버튼의 메시지 id | `number \| null` | `null` | `useChatScreen` 지역 훅 `useEditFocusReturn` 내부 `useState` |
| `regeneratePressedRef` | 이 버튼 줄에서 「재작성」을 눌렀는가(잠금 해제 뒤 포커스 복귀 대상) | `MutableRefObject<boolean>` | `false` | `BubbleActions` 내부 |

`ChatState`·`initialChatState`는 그대로다(초기값 TC-CH-015·053 불변). `sheet`의 종류가 하나 줄 뿐 초기값 `null`은 같다.

---

## 3. 메뉴 제거 델타 (파일·심볼별)

공용 부품(`BottomSheet`·`SheetItem`·`ConfirmDialog`·`PromptSheet`)은 **건드리지 않는다**(제약). `useLongPress`도 S3e에서는 남겼으나 후작업(2026-10-07)이 삭제했다(D-32). 방 메뉴(⋯ `RoomMenuSheet`)·메시지 삭제 확인·이름 변경·방 삭제 확인은 그대로다.

| 파일 | 삭제 | 남김 |
|---|---|---|
| `components/MessageMenuSheet.tsx` | **파일 삭제**(`MessageMenuSheet` · `MessageMenuSheetProps` · `excerptOf` · `EXCERPT_MAX_CHARS`). `nameOf`는 BubbleActions로 이동 | — |
| `components/MenuSheets.module.css` | `.menuHeader`는 `RoomMenuSheet`가 계속 쓰면 남긴다. 말풍선 메뉴 전용 클래스가 있으면 삭제(구현자 실물 확인) | 방 메뉴 클래스 |
| `components/Bubble.tsx` | `onOpenMenu` prop · `useMenuAttributes` · `isMenuKey` · `RootAttributes` 타입 · `VariantProps.rootProps`·`menuClass` · `useLongPress`·`HTMLAttributes`·`KeyboardEvent` import · 머리 주석 S2 줄. 루트에 `tabIndex`·`aria-haspopup`·`aria-keyshortcuts`·`onKeyDown`·포인터 핸들러·`onContextMenu`가 **붙지 않는다**(읽기·쓰기 모두) | 변형 4종 · `bubbleVariantOf` · 재작성 중 표시 · `memo` |
| `components/Bubble.module.css` | `.menuEnabled` · `.menuEnabled:focus-visible`(말풍선은 더 이상 포커스를 받지 않는다) | 나머지 |
| `components/ChatSheets.tsx` | `messageMenu` kind · `MessageMenuSheet` import · `onStartEdit`·`onRegenerate`·`onAskDeleteMessage` props · `renderMessageSheet`의 메뉴 분기 | 확인·방 시트 4종 |
| `components/MessageList.tsx` | `onOpenMenu` prop·전달 · 머리 주석 "onOpenMenu" 줄 | — |
| `useChatSheets.ts` | `openMessageMenu`(F-CH-18·35) · `useRegenerateFromMenu`(F-CH-36) · `startEdit`의 `setSheet(null)` · `isRegenerateTarget` import(쓰지 않으면) | 방 시트 · 삭제 확인 |
| `index.tsx` | `HistoryProps.onOpenMenu` · `onOpenMenu: sheets.openMessageMenu` · `SheetLayer`의 `onStartEdit`·`onRegenerate`·`onAskDeleteMessage` | — |
| `labels.ts` | `messageMenuAriaLabel` · `messageMenuHeader` | `edit`·`delete`·`regenerate`·`cancel`(버튼 글자·확인 시트) |

- 쓰기 판에서 말풍선 우클릭·길게 누르기는 **브라우저 기본 동작**이 된다(읽기 전용 판과 같다).
- `useLongPress`는 chat 사용처가 0이 된다(rooms도 쓰지 않는다). → **삭제됨(S3e 후작업 2026-10-07)** — 훅·스펙 모두 지워졌다(D-32).

---

## 4. 표시 · 비활성 규칙

| 요소 | 렌더 조건 | 비활성 조건 |
|---|---|---|
| 버튼 줄(group) | `viewer.canWrite`(= `actions !== undefined`) ∧ 그 메시지가 수정 중이 아님(`editingId !== message.id`) ∧ 서버 메시지(pending `<li>` 아님) | — |
| 「수정」 | 버튼 줄과 같음(모든 메시지 — 세바스찬·시엘·유저·OOC) | `isActionLocked` |
| 「재작성」 | 버튼 줄 ∧ `message.id === regenerateTargetIdOf(state)`(캐릭터 `line` ∧ 화면 목록 마지막) | `isActionLocked` |
| 「삭제」 | 버튼 줄과 같음 | `isActionLocked` |

**`isActionLocked = !canSpeak(state) || roomBusy !== null`**(D-27). `canSpeak(s) = s.phase === 'ready' && s.writing === null && s.editingId === null`(functions.md §1.2)이므로 아래가 모두 잠금이다.

| 상황 | `writing` · `editingId` | 버튼 3종 |
|---|---|---|
| 평상시 · 캐릭터/중립 실패 말풍선만 있음 | `null` · `null` | 활성 |
| 전송 저장 중 · 자동 응답 생성 중 · 캐릭터 생성 중 | `send` · `speak` | `disabled` |
| 수정 저장 · 삭제 · 재작성 요청 중 | `edit` · `delete` · `regenerate` | `disabled` |
| 다른 말풍선 인라인 수정 중 | `editingId !== null` | **모든** 말풍선 `disabled`. 수정 중인 말풍선은 버튼 줄 자체가 없다 |
| 방 이름 변경·삭제 요청 중 | `roomBusy !== null` | `disabled`(기존 D-10 메뉴 가드 유지) |
| 첫 로드 중·실패 | `phase !== 'ready'` | 목록이 없어 렌더되지 않는다 |

- 생성 중 잠금은 S3d `isSaveLocked`(`writing.kind === 'speak'`)와 일관된다. 버튼 줄은 저장·생성·다른 편집 어느 쪽이든 잠근다(쓰기는 한 번에 하나).
- 잠금은 네이티브 `disabled`만 쓴다(공용 Button `isDisabled`). 숨기지 않는다.

---

## 5. 기능 명세 (function 단위)

| # | 시그니처(위치) | 입력 | 출력·상태 변경 | 동작 | 예외·분기 | 요구ID |
|---|---|---|---|---|---|---|
| **F-CH-45** | `BubbleActions(props: BubbleActionsProps): JSX.Element` (`components/BubbleActions.tsx`) | AC §1 | 버튼 줄 | AC §1 DOM. 클릭 = 핸들러에 `message`를 넘긴다. 상태를 바꾸지 않는다 | `isDisabled`면 네이티브 `disabled`라 클릭이 오지 않는다 | R-CHAT-007 🔒 · 002 🔒 · 013 🔒 |
| **F-CH-46** (F-CH-19 대체) | `startEdit(message: Message): void` (`useChatSheets`) | 「수정」 | T21 `editStarted` | `!canSpeak(getState()) \|\| isRoomBusy()`면 무시 → `dispatch({ type: 'editStarted', messageId: message.id })`. 같은 커밋에서 말풍선 자리에 InlineEditor가 마운트되어 입력으로 포커스를 가져간다(S2 그대로). `setSheet` 호출 없음 | 잠금 중이면 버튼이 `disabled`라 정상 경로에서는 오지 않는다(가드는 같은 틱 방어) | R-CHAT-007 🔒 · R-MSG-004 |
| **F-CH-47** (F-CH-22 대체) | `askDeleteMessage(message: Message): void` (`useChatSheets`) | 「삭제」 | `sheet = { kind: 'confirmDeleteMessage', message }` | F-CH-46과 같은 가드 → 확인 시트(ConfirmDialog, 첫 포커스 취소, confirm 필수 — 스킬 §11). 이후 F-CH-23 `confirmDeleteMessage` **그대로** | 취소·Esc·덮개 → `closeSheet`(F-CH-28) → BottomSheet가 열기 전 요소 = 「삭제」 버튼으로 포커스 복귀 | R-CHAT-007 🔒 · R-MSG-005 |
| **F-CH-48** (F-CH-36 대체) | `regenerateFromActions(message: Message): Promise<void>` (`useChatSheets` 지역 `useRegenerateAction`) | 「재작성」 | F-CH-34 결과 | 가드(`!canSpeak \|\| isRoomBusy()`면 종료) → confirm 없이 `const r = await regenerateMessage(message.id)`(F-CH-34 그대로) → `'replaced'`·`'failed'`·`'rejected'`: 더 하지 않는다(포커스는 F-CH-51) · `'removed'`: `isEmptyWithMore`면 `void loadInitial()` → `requestLogFocus()` · `'stale'`: `void loadInitial()` → `requestLogFocus()`(F-CH-41 그대로) | 토스트는 F-CH-16. 옛 F-CH-36과 다른 점은 `setSheet(null)`이 없는 것뿐 | R-CHAT-007 🔒 · 005 · 011 · R-MSG-006 |
| **F-CH-49** (F-CH-21 개정) | `cancelEdit(): void` (`useChatSheets`) | 편집기 취소·Esc | T23 / T24 · 포커스 요청 | `const s = getState()` · `const id = s.editingId` · `const next = chatReducer(s, { type: 'editCancelled' })` → `dispatch({ type: 'editCancelled' })` → `id !== null && next.editingId === null`이면 `requestEditFocus(id)`. 옛 `focusLog()` 호출은 없앤다 | T24(저장 중 취소 무시)면 포커스 요청 없음 | R-CHAT-007 🔒 · 013 |
| F-CH-20 (포커스만 개정) | `useSaveEditAndFocus` (`useChatScreen`) | 저장 결과 | 포커스 요청 | `saveEdit(id, text)`가 `true`면 `focusLog()` 대신 **`requestEditFocus(id)`**. 실패면 그대로(편집기 유지) | — | R-CHAT-007 🔒 · 013 |
| **F-CH-50** | `useEditFocusReturn(focusLog): { editFocusId, requestEditFocus, onEditFocusDone }` (`useChatScreen` 지역 훅) + `BubbleActions` 지역 훅 `useEditFocus` | 메시지 id | `editFocusId` | `requestEditFocus = useCallback((id) => setEditFocusId(id), [])` · `onEditFocusDone = useCallback((isFocused) => { if (!isFocused) focusLog(); setEditFocusId(null) }, [focusLog])`. BubbleActions `useLayoutEffect([shouldFocusEdit, onEditFocusDone])`: `shouldFocusEdit`이면 `editRef.current?.focus()` → `onEditFocusDone(editRef.current !== null && document.activeElement === editRef.current)` | 「수정」이 `disabled`라 포커스를 못 받으면(예: 자동 응답 생성 중 편집 취소 — S3d D-17) `focusLog()`(F-CH-30 — 히스토리 log, 없으면 ‹)로 대신한다. 요청이 소비되지 않고 남아도(대상 말풍선이 렌더되지 않음 — 정상 경로 없음) 동작 영향 없음 | R-CHAT-013 🔒 · 007 |
| **F-CH-51** | `useRefocusAfterUnlock(isDisabled, regenerateRef, pressedRef)` (`BubbleActions` 지역 훅, `useEffect([isDisabled])`) | `isDisabled` true → false | 포커스 | `isDisabled`가 false인 렌더에서 `pressedRef.current`가 true면: `pressedRef.current = false` → `document.activeElement`가 `null` 또는 `document.body`이고 `regenerateRef.current`가 있으면 `focus()`. 그 밖에는 아무것도 하지 않는다 | 재작성 요청 동안 누른 버튼이 `disabled`가 되어 포커스를 잃는다 → 성공·실패 뒤 같은 「재작성」으로 돌린다. 사용자가 그사이 다른 곳으로 옮겼으면 건드리지 않는다. 버튼이 사라졌으면(제거·재조회·전환) F-CH-41·F-CH-29 몫. F-CH-38과 같은 규칙 | R-CHAT-013 🔒 · 005 |
| **F-CH-52** | `regenerateTargetIdOf(s: ChatState): number \| null` (`state/chat.ts`, 순수) | 상태 | id | `const last = s.messages[s.messages.length - 1]` → `last !== undefined && isRegenerateTarget(s, last.id) ? last.id : null` | 빈 목록 null. pending은 보지 않는다(TC-CH-079 규칙 유지) | R-CHAT-007 🔒 · R-MSG-006 |
| 삭제 | ~~F-CH-18 `openMessageMenu`~~ · ~~F-CH-35~~ · ~~F-CH-36 `regenerateFromMenu`~~ | — | — | **삭제(S3e)** — AC §3 | — | — |
| 불변 | F-CH-20(저장 본체) · F-CH-23 · F-CH-28 · F-CH-34 · F-CH-41 | — | — | 그대로 재사용 | — | R-MSG-004·005·006 |

---

## 6. 파이프라인

```
[수정] 「수정」(활성) → startEdit → editStarted → 그 말풍선 자리 InlineEditor(원문, 입력 포커스) · 모든 버튼 줄 disabled
  ├ 저장 → saveEdit → editMessage(id, { text })
  │    ├ 200 → messageReplaced(편집 닫힘) → writeFinished → requestEditFocus(id) → 그 말풍선 「수정」 포커스
  │    └ 실패 → 편집기·입력 유지 → handleWriteFailure(인증이면 전환)
  └ 취소 · Esc → editCancelled → 원문 말풍선 → 「수정」 포커스 (disabled면 히스토리 log)
[삭제] 「삭제」 → askDeleteMessage → 확인 시트 「이 메시지를 삭제할까요?」(첫 포커스 취소)
  ├ 취소 · Esc · 덮개 → 시트 닫힘 → 「삭제」 버튼 포커스(BottomSheet 복귀) · deleteMessage 0회
  └ 삭제 → deleteMessage(id) (두 버튼·모든 버튼 줄 disabled)
       ├ 204 · NOT_FOUND → messageRemoved → 시트 닫힘 → 히스토리 log 포커스 (0건 + hasMore → loadInitial)
       └ 실패 → 시트 닫힘 → 토스트 → 「삭제」 버튼 포커스(BottomSheet 복귀)
[재작성] 「재작성」(마지막 캐릭터 line만) → confirm 없음 → regenerate(id)
  → 대상 흐림 + aria-busy + "다시 쓰는 중…" · 모든 버튼·캐릭터 버튼·전송 disabled (입력 타이핑 가능)
  ├ 200 → 같은 id 본문 교체 → 잠금 해제 → 「재작성」 포커스(F-CH-51)
  ├ NOT_LAST_MESSAGE → 토스트 → loadInitial → ready 뒤 log 포커스(F-CH-41)
  ├ NOT_FOUND → 제거 → 토스트 → log(없으면 ‹) 포커스
  ├ 인증 3종 → 전환(버튼 줄 전부 미렌더) → ‹ 포커스
  └ 그 밖 → 원 대사 그대로 → 토스트(AC §8 개정 문구) → 「재작성」 포커스
```

- 파괴 조작 confirm: 메시지 삭제만 confirm(스킬 §11, 요구 🔒 "삭제는 confirm 유지"). 재작성은 confirm 없음(요구 🔒). 수정 취소는 confirm 없음.
- 낙관적 갱신 없음(서버 응답 뒤 반영, S2 그대로).

---

## 7. 포커스 · 접근성

| 항목 | 규칙 |
|---|---|
| 그룹 | 버튼 줄 `role="group"` · `aria-label="{이름} 말풍선 작업"`. 이름 = AC §1 `nameOf`(세바스찬·시엘·「어떠한 의지」·`[지시]`) |
| 버튼 이름 | `"{이름} 대사 수정"` · `"{이름} 대사 재작성"` · `"{이름} 대사 삭제"`. 보이는 글자(`수정`·`재작성`·`삭제`)가 이름 끝에 들어간다(label-in-name) |
| 같은 화자 여러 말풍선 | 이름이 같다. 버튼 줄이 DOM에서 그 말풍선 바로 뒤에 있어 읽는 순서로 구분된다. 시각을 이름에 넣지 않는다(사전 확정 6 문안 유지, D-31) |
| Tab 순서(쓰기 판) | ‹ → ⋯ → 히스토리 스크롤 박스 → (B0 「다시 시도」) → 말풍선마다 위→아래 「수정」→(「재작성」)→「삭제」 → (실패 「재시도」) → B1 → 세바스찬 → 시엘 → OOC → 입력창 → 전송. **말풍선 자체는 Tab을 받지 않는다**(옛 `tabIndex=0` 삭제) |
| 키보드 | 버튼은 Enter·Space(네이티브). 옛 Shift+F10·메뉴 키 단축 **삭제**. 확인 시트 Esc·Tab 순환은 BottomSheet 그대로 |
| 잠금 | 네이티브 `disabled`만(`aria-disabled` 따로 없음 — a11y.md S3 규칙과 같음) |
| 포커스 목적지 | 수정 저장 성공·취소 → 그 말풍선 「수정」(disabled면 log) · 삭제 취소·실패 → 「삭제」 · 삭제 성공 → log · 재작성 성공·일반 실패 → 「재작성」(포커스를 잃었을 때만) · 재작성 제거·재조회 → log(F-CH-41) · 전환 → ‹(F-CH-29) |
| 임시·실패 말풍선 | 버튼 줄 없음. 「재시도」만(S3·S3d 그대로) |
| 포커스 링 | 공용 Button `:focus-visible` 2px `--color-focus` |
| 대비 | 보조색 `--color-fg-muted`·`--color-danger` 글자가 `--color-bg` 위 4.5:1 이상인지 수동 확인(TC-CH-121) |

---

## 8. 확정 문구 · 라벨 (`ui/src/chat/labels.ts` 단일 소스)

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `edit` · `regenerate` · `delete`(재사용) | `수정` · `재작성` · `삭제` | 버튼 글자 |
| **`bubbleActionsAriaLabel(name)`** | `` `${name} 말풍선 작업` `` | 버튼 줄 group |
| **`editActionAriaLabel(name)`** | `` `${name} 대사 수정` `` | 「수정」 aria-label |
| **`regenerateActionAriaLabel(name)`** | `` `${name} 대사 재작성` `` | 「재작성」 aria-label |
| **`deleteActionAriaLabel(name)`** | `` `${name} 대사 삭제` `` | 「삭제」 aria-label |
| `deleteMessageTitle` · `deleteMessageBody` · `cancel`(재사용) | `이 메시지를 삭제할까요?` · `삭제한 메시지는 되돌릴 수 없습니다.` · `취소` | 확인 시트 그대로 |
| 재작성 실패 토스트 `LLM_FAILED`·`LLM_EMPTY`(`writeErrorText(…, 'regenerate')`, 상수 `LLM_FAILED_REGENERATE_TEXT`) — **개정** | `대사를 다시 만들지 못했습니다. 재작성을 다시 눌러 주세요.` (이전: `… 메뉴에서 다시 시도해 주세요.`) | E 토스트(D-30) |
| ~~`messageMenuAriaLabel`~~ · ~~`messageMenuHeader(name, time, excerpt)`~~ | **삭제** | — |

- 이름 단일 소스는 그대로다: 캐릭터 `CHARACTERS[id].shortName`, 유저 `USER_DISPLAY_NAME`(`userAuthorLabel`), OOC `labels.oocPrefix`.

---

## 9. 읽기 전용 분기

"미렌더" = DOM에 없음(`display:none`·`hidden`·`disabled`·`aria-hidden` 금지). 판정은 `viewer.canWrite` 하나.

| 요소 | 토큰 없음 · 전환 후 | 토큰 있음 | 구현 |
|---|---|---|---|
| 버튼 줄(수정·재작성·삭제) | **미렌더** | 렌더(AC §4) | `renderHistory`가 `actions={canWrite ? … : undefined}` — 전환 커밋에서 바로 사라진다 |
| 말풍선 메뉴(롱프레스·우클릭·Shift+F10) | 없음 | **없음(S3e 삭제)** | 핸들러 자체가 없다 |
| 메시지 삭제 확인 시트 | 미렌더 | `sheet`가 있을 때 | `canWrite && sheet && <ChatSheets/>` + 전환 effect `sheet=null`(그대로) |
| `editFocusId` 포커스 요청 | 소비되지 않음(버튼 줄 없음) | 소비 | `editFocusId={canWrite ? … : null}` |

- 읽기 전용 판의 DOM은 S3d와 같다(말풍선에 원래 핸들러가 없었다). 토큰은 화면이 읽지도 저장하지도 않는다(R-CHAT-009 그대로).

---

## 10. 설계 결정 (S3e)

| # | 결정 | 근거 |
|---|---|---|
| D-24 | **메뉴 제거 범위**: 말풍선 메뉴의 트리거(롱프레스·우클릭·Shift+F10)·시트(`MessageMenuSheet`)·시트 종류(`messageMenu`)·여는 함수(`openMessageMenu`)·문구 2키·`menuEnabled` 스타일을 지운다. 공용 `BottomSheet`·`SheetItem`·`ConfirmDialog`는 남긴다(`useLongPress`는 후작업 2026-10-07 삭제됨, D-32) | 요구 🔒 "롱프레스/우클릭 메뉴는 제거(버튼으로 대체)". 방 메뉴·확인 시트가 공용 부품을 계속 쓴다. 공용 부품 변경 금지 |
| D-25(**우회 — 지역 덧칠**) | 버튼 형태 = 공용 `Button size='sm' variant='ghost'` 3개. 색은 BubbleActions 지역 CSS가 자손 선택자로 덧칠한다(수정·재작성 `--color-fg-muted`, 삭제 `--color-danger`, 삭제는 `<span class=danger>` 래퍼) | ① `sm`이 이미 28px 높이·44px 터치 영역·포커스 링·네이티브 `disabled`를 준다 ② `variant='danger'`는 채운 빨간 버튼이라 "작은 텍스트 버튼"(캡처)과 맞지 않는다 ③ 전용 경량 버튼은 화면 코드의 `<button>` 직접 사용 금지에 걸린다 ④ 공용 Button에 글자색 톤 prop이 없다 → D-23과 같은 방식으로 우회하고 공용화 후보(Button ghost `tone`)로 올린다(주 문서 §12) |
| D-26 | **포커스**: 편집기가 닫히면(저장 성공·취소) 같은 말풍선의 「수정」으로 보낸다(옛 "히스토리 log"에서 변경, 사전 확정 4). 「수정」이 `disabled`면 log. 재작성은 잠금이 풀릴 때 같은 「재작성」(포커스를 잃었을 때만). 삭제 취소·실패는 BottomSheet 복귀 규칙이 「삭제」로 돌린다 | 사용자가 작업을 시작한 자리로 돌아간다. 말풍선이 더 이상 포커스를 받지 않으므로 옛 목적지("말풍선 루트")가 없다. 잠긴 버튼은 포커스를 못 받아 body로 빠지므로 대체 목적지가 필요하다 |
| D-27 | 비활성 판정 `isActionLocked = !canSpeak(state) \|\| roomBusy !== null`. 새 판정 함수를 만들지 않는다 | 사전 확정 3(쓰기 대기 · 생성 중 · 인라인 수정 중)이 `canSpeak`의 정의(`ready ∧ writing=null ∧ editingId=null`)와 같다. `roomBusy`는 옛 메뉴 가드(D-10)를 그대로 옮긴 것이다(새 규칙 아님). 옛 메뉴는 인라인 수정 중에도 열렸으나(generate.md §6 표 2행) 사전 확정 3에 따라 버튼 줄은 편집 중 잠근다 |
| D-28 | 버튼 줄은 `Bubble` 안이 아니라 `MessageItem`에서 `Bubble`의 **형제**로 둔다 | Bubble은 서버 메시지 표시 전용·`memo` 격리를 유지한다(잠금이 바뀌어도 말풍선은 다시 그리지 않음). 읽기 전용 판 Bubble DOM이 불변이라 S1 TC가 그대로다 |
| D-29(**스킬 문구와 다름, 요구 우선**) | `ui-design-strategy` §6.5 "말풍선 메뉴 — 롱프레스/우클릭 → 바텀시트"를 chat에서는 **적용하지 않는다**. `tsx-rules.md` 롱프레스 줄·`component-catalog` `useLongPress` 사용처(`Bubble·ListRow`)·`layout-templates` "말풍선 롱프레스/우클릭 → S1"도 chat 기준으로는 낡는다 | R-CHAT-007 🔒 개정(2026-10-07). 스킬·카탈로그 갱신은 메인 세션 몫(보고) |
| D-30 | 재작성 실패 토스트 `LLM_FAILED`·`LLM_EMPTY` 문구의 "메뉴에서"를 "재작성을 다시 눌러"로 바꾼다 | 메뉴가 없어져 안내가 틀린다. 설계가 정한 문구(generate.md §3)라 요구 원문 변경이 아니다 |
| D-31 | 같은 화자의 버튼 이름이 겹쳐도 시각을 넣지 않는다 | 사전 확정 6 문안 · 버튼 줄이 말풍선 바로 뒤라 읽는 순서로 구분된다 |

| D-32(v2.0.1, 결정 노트) | 공용 `useLongPress`는 S3e 뒤 **사용처 0**(chat 삭제, rooms 미사용)이다. S3e에서는 지우지 않고 공용 정리 후보로 뒀다. → **삭제됨(S3e 후작업 2026-10-07, 사용자 승인)**: 훅·스펙 삭제, TC-CH-060 폐기 대상 | 공용 부품 변경 금지(화면 작업). 정리는 후작업(ui-postprocessor)이 했다 |
| D-25 보충(v2.0.1) | Button 글자색 톤 부재는 구현자가 `component-usage-lessons`에 **코어 결함 후보**로 기록했다(지역 덧칠 우회, D-23과 같은 처리) | 구현 보고 |

구성안·계약과 다르게 정한 것: 없음. 스킬과 다른 것: D-29 하나.

---

## 11. TC

v2.0.1(2026-10-07)에 40KB 한계 때문에 이 절 전체(§11.1 신규 TC-CH-110~121 · §11.2 기존 TC 영향표)를 **`design/actions-tests.md`**로 옮겼다. 그 파일이 스펙 전제(같은 이름 그룹은 `within(li)`로 범위 축소 · 포커스는 태그 `BUTTON` 판별)와 TC-CH-086 개정 행까지 담는다. 요약: 폐기 2 · 대체 4 · 개정 27 · 유지 명시 4.

---

## 12. 변경이력 (이 분할 문서)

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v2.0 | 2026-10-07 | 최초 작성(S3e 전체 델타): BubbleActions · 배선 · 메뉴 제거 · 표시/비활성 · F-CH-45~52 · 파이프라인 · 접근성 · 문구 · 읽기 전용 · D-24~31 · TC-CH-110~121 · 기존 TC 영향표 | R-CHAT-007 🔒 개정 · CR-003 · 메인 세션 사전 확정 1~7 |
| v2.0.1 | 2026-10-07 | **구현 동기화**: §1 `ActionButton` · §2 `ActionsLine` · `useIsActionLocked` · `useConfirmDeleteMessage` · `useRevokeCleanup`(모두 50줄 한계 분리, DOM 같음) · §10 D-32 · D-25 보충 · §11 → `design/actions-tests.md` 분리(TC-CH-086 개정 행 · 스펙 전제 2건) | S3e 구현 보고 · 테스트 설계자 지적 |
