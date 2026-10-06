# chat 상세 설계 — S3d 전송 뒤 자동 응답 · 중립 말풍선 · 고정 명칭 (분할 문서, v1.9)

> 주 문서: `ui/src/chat/design.md`(RTM §15 포함). 40KB 한계 때문에 S3d 델타 본문은 이 파일 하나에 모은다. 다른 분할 문서에는 이 파일을 가리키는 짧은 줄만 넣는다. 절 표기 `AU` = 이 파일.
> 요구: R-CHAT-014 🔒(신규) · R-CHAT-006 🔒(개정) · R-CHAT-002 🔒(개정) · 영향 R-CHAT-005 · 004 · 011 · 013 · 008 · 데이터 R-MSG-009 🔒 · R-MSG-003 🔒(개정) · R-AUTH-004 🔒(개정). 요구 원문 `ui/src/chat/requirements.md` v1.9.
> 구성안: `doc/200_설계/architecture/ui-layout-03-chat-auto.md` — **수용, 구조 변경 없음**(§7 구조 제안 2건은 미채택 유지). 전반 설계 `s3d-02-전반설계.md` §5·§6 · 인계 패킷 `s3d-03-인계패킷.md` §3.
> 계약: `doc/200_설계/contract/api.md` **v0.6** §4.9 · §4.13 · §5.2 · §5.5 · §11.15 · 「ui 인계 메모」(S3d) — 확정. 새 엔드포인트·래퍼·에러 코드 없음. **contract 구현 대기**(`shared/src/types.ts` `SpeakTarget` · `shared/src/characters.ts` `USER_DISPLAY_NAME` — api.md §12.5 "미구현"). 이 둘이 들어온 뒤에 ui 구현을 시작한다(ui 구현 선행 조건).
> CR: `ui/src/chat/test/change-requests.md` CR-002.

비유: 누가 대답할지 정해지기 전에는 무대 한가운데에 빈 자막 상자만 띄워 둔다. 화자가 정해지면 그 상자를 치우고 화자 자리(왼쪽·오른쪽)에 대사를 건다. 접수 창구(쓰기 팻말)는 손님이 낸 쪽지를 받은 뒤 문을 닫지 않고 그대로 주방에 주문을 넣는다. 그래서 그 사이에 다른 손님이 끼어들 틈이 없다.

---

## 0. 레이아웃 [확정 — 구성안 ui-layout-03 §1~§4 수용]

ASCII·치수·전이 그림은 구성안 문서를 그대로 쓴다(재작성하지 않는다). 이 설계가 확정하는 것은 구성안이 ui-designer에게 넘긴 두 가지다.

| 구성안이 넘긴 것 | 확정 |
|---|---|
| 클래스 이름·구현 방식(§1.2 끝) | 같은 `PendingBubble` 컴포넌트의 `'auto'` 변형. 지역 클래스 **`neutral`** 1개 추가(AU §2) |
| "유저 말풍선 즉시 표시"의 시점(§10) | **저장 201 직후**(낙관 표시 없음, s3d-02 §5 그대로) |

| 조각 | 확정 상태 |
|---|---|
| S1 저장 중(구성안 §2.1) | 확정 — 그림은 입력 상태와 같다. 잠금만 다르다 |
| S2 생성 중 중립 "…"(§2.2) | 확정 |
| 결과 교체(§2.3) | 확정 — 기존 Bubble, 교체 1회, 이동 효과 없음 |
| 중립 실패(§2.4) | 확정 |
| 유저 작성자 줄 「어떠한 의지」(§3) | 확정 |
| 하단 바(§4) | 확정 — 구조 불변 |

---

## 1. 상태 모델 — `ui/src/state/chat.ts` 델타

### 1.1 타입 (계약 `SpeakTarget`을 그대로 import — 화면 전용 동의어 타입을 만들지 않는다, 「ui 인계 메모」 S3d 「타입」 행)

```ts
import type { CharacterId, Message, MessagesPage, SpeakTarget } from '@shared/types'

export type MessageWrite =
  | { readonly kind: 'send' }
  | { readonly kind: 'edit'; readonly messageId: number }
  | { readonly kind: 'delete'; readonly messageId: number }
  | { readonly kind: 'speak'; readonly character: SpeakTarget }        // S3d: CharacterId → SpeakTarget
  | { readonly kind: 'regenerate'; readonly messageId: number }

export type PendingSpeak = {
  readonly character: SpeakTarget       // S3d: 'auto' = 중립(가운데, 이름·아바타 없음). 캐릭터면 S3 그대로(그 캐릭터 쪽)
  readonly status: 'generating' | 'failed'
  readonly error: ApiError | null
}

export type ChatAction =
  | …S1·S2·S3 그대로…
  | { type: 'speakStarted'; character: SpeakTarget }                          // S3d: 인자 타입만 넓힘. 캐릭터 버튼 · 「재시도」(캐릭터·중립)
  | { type: 'sendSucceeded'; message: Message; isNearBottom: boolean }        // S3d 신규(T35): 저장 201 → 자동 응답 시작, 원자 1회
```

- 필드 이름은 바꾸지 않는다(`character`). 값 `'auto'`가 "중립 = 화자 미정"을 뜻한다. 그래서 `ChatState`·`initialChatState`는 **그대로**(필드 추가 없음, 초기값 10필드 유지 — TC-CH-015·053 불변).
- `speakSucceeded`·`speakFailed`·`speakDiscarded`의 **시그니처는 그대로**다.
  - `speakSucceeded { message, isNearBottom }` — 결과 말풍선의 자리는 `message.speaker`(서버가 고른 캐릭터)로 Bubble이 정한다. 리듀서는 `pending`을 비우고 메시지를 붙일 뿐이라 `'auto'`를 알 필요가 없다(Q7).
  - `speakFailed { error }` — `pending.character`는 `writing.character`를 그대로 옮기므로 `'auto'`면 중립 실패로 남는다.
- 새 순수 함수 1개(같은 파일):

| 함수 | 시그니처 | 규칙 |
|---|---|---|
| `speakingCharacterOf` | `(s: ChatState) => CharacterId \| null` | `s.writing?.kind === 'speak' && s.writing.character !== 'auto' ? s.writing.character : null`. Composer·SpeakButtons의 `speakingCharacter` prop 값(포커스 복귀 F-CH-38 대상). 중립 생성은 누른 캐릭터 버튼이 없으므로 null — 버튼으로 포커스를 끌어오지 않는다(s3d-02 §5 "자동 생성은 포커스를 옮기지 않는다") |

### 1.2 전이표 델타 (functions.md §1.1에 이어 붙는 행. 각 행 vitest ≥1)

| # | 액션 | 조건 | 다음 상태 |
|---|---|---|---|
| T27 (S3d 개정) | `speakStarted` | `canSpeak(state)` | S3 그대로. `character`가 `'auto'`면 `writing={ kind:'speak', character:'auto' }`, `pending={ character:'auto', status:'generating', error:null }`. 이전 `pending`이 캐릭터·중립 실패 어느 쪽이든 이것으로 바뀐다 |
| T31 (S3d 개정) | `speakFailed` | `writing?.kind==='speak'` | S3 그대로. `writing.character`가 `'auto'`면 중립 실패(`pending.character='auto'`) |
| **T35** | **`sendSucceeded`** | **`writing?.kind==='send'`**(ready에서만 걸리는 팻말이라 `phase==='ready'` 포함) | **한 번에:** T9와 같은 규칙으로 `messages`·`unseenCount`(`[action.message]`, `action.isNearBottom`) + `writing={ kind:'speak', character:'auto' }` + `pending={ character:'auto', status:'generating', error:null }`. 이전 `pending`(캐릭터·중립 실패)은 **이것으로 바뀐다**(구성안 §2.4 "새 전송 201 → 실패 말풍선 교체"). `editingId`는 건드리지 않는다(AU §8 D-17) |
| **T36** | `sendSucceeded` | 아니면 | 그대로 |

- T35는 `canSpeak`를 보지 않는다. 요구가 "저장 성공 → 곧바로"이고(R-CHAT-006 🔒·014 🔒) 팻말이 이미 `send`로 걸려 있어 다른 쓰기와 겹칠 수 없기 때문이다.
- `messagesAppended`(T9·T10)는 액션으로 남는다(기존 리듀서 TC 유지). 다만 S3d부터 **전송 경로는 이 액션을 쓰지 않는다**. 리듀서 내부에서 T29·T35가 같은 함수(`onMessagesAppended`)를 재사용한다.
- functions.md §1.1 아래 문장 "실패 말풍선은 유저 전송 … 성공에도 그대로 목록 끝에 남는다"는 S3d에서 **전송만 예외**가 된다(T35가 교체). 수정·삭제·재작성 성공에는 그대로 남는다.

### 1.3 화면 상태 5단계 ↔ 리듀서 (s3d-02 §5)

| 화면 상태 | `writing` | `pending` | 들어오는 액션 |
|---|---|---|---|
| 입력 | `null` | 없음 · 캐릭터/중립 실패 | — |
| S1 저장 중 | `{send}` | 이전 값 그대로 | `writeStarted{send}`(T13) |
| S2 생성 중(중립) | `{speak,'auto'}` | `{auto,generating}` | `sendSucceeded`(T35) · 중립 「재시도」 `speakStarted{'auto'}`(T27) |
| 결과 | `null` | `null` | `speakSucceeded`(T29) |
| 중립 실패 | `null` | `{auto,failed,error}` | `speakFailed`(T31) |
| (이탈) 인증 3종·방 없음 | `null` | `null` | `speakDiscarded`(T33) |
| (이탈) S1 저장 실패 | `null` | 이전 값 그대로 | `writeFinished`(T15) |

---

## 2. 컴포넌트 델타

### 2.1 PendingBubble — `'auto'` 중립 변형 (`ui/src/chat/components/PendingBubble.tsx`, chat 로컬)

```ts
export type PendingBubbleProps = {
  pending: PendingSpeak                        // character: SpeakTarget(AU §1.1)
  isRetryDisabled: boolean                     // !canSpeak(state) — S3 그대로
  onRetry: (target: SpeakTarget) => void       // S3d: CharacterId → SpeakTarget(F-CH-32 개정)
}
```

- **판정: 같은 컴포넌트의 변형**(인계 패킷 §3 표). 별도 `NeutralPendingBubble` 컴포넌트를 공개하지 않는다. 파일 안에서 `pending.character === 'auto'`면 지역 서브 컴포넌트 `NeutralPending`을, 아니면 지역 `CharacterPending`(현 본문 그대로 이동)을 렌더한다. 근거: 상태 판정(`status`)·실패 문구(`speakErrorText`)·「재시도」 배선·`srOnly`가 같고, 다른 것은 바깥 틀뿐이다(구성안 §1.2 결론). 함수 50줄 한계 때문에 두 서브 컴포넌트로 나눈다. 파일은 약 120줄(400줄 안).
- **`NeutralPending` DOM(구성안 §1.1·§1.2).**
  - 루트 `<div className={cx(styles.pending, styles.neutral, isFailed && styles.failed)}>` · 생성 중이면 `role="status" aria-live="polite"`, 실패면 role 없음(S3 그대로). **`bubbleStyles.root`·`character`·`sebastian`·`ciel`·`user` 클래스를 붙이지 않는다**(화자 배경·유저 배경이 붙으면 화자가 정해진 것처럼 보인다).
  - 아바타 `<img>` 없음 · 머리 줄(`head`·`name`) 없음 · 시각 없음.
  - 본문 `<div className={cx(bubbleStyles.body, styles.bodyBox)}>` — S3 본문 상자 그대로(padding `--space-3` · 1px 테두리 · `--radius-lg`).
  - 생성 중: 본문 안 `<span className={styles.dots} aria-hidden="true">{labels.pendingDots}</span>`(`…`) + `<span className={styles.srOnly}>{labels.autoPendingStatus}</span>`(`응답을 만드는 중`).
  - 실패: 본문 안 `<p role="alert" className={styles.errorText}><span className={styles.errorMark} aria-hidden="true">!</span> {speakErrorText(error)}</p>` + `<div className={styles.retryRow}>` 안 **항상** `Button variant='secondary' size='sm' ariaLabel={labels.autoRetryAriaLabel} isDisabled={isRetryDisabled} onClick={() => onRetry('auto')}` → `labels.speakRetry`(`재시도`). 코드와 무관하게 렌더(S3 DC-02 규칙 그대로).
  - 메뉴 핸들러·`tabIndex` 없음(S3 D-11 그대로).
- **지역 CSS(`PendingBubble.module.css`) 추가: `neutral` 하나.**

| 선택자 | 규칙 | 근거 |
|---|---|---|
| `.neutral` | `display: flex; flex-direction: column; align-items: center; width: 100%` | 유저 말풍선과 같은 가운데 세로 축(구성안 §1.2). `.user` 클래스 자체는 쓰지 않는다 |
| `.neutral .bodyBox` | `background: transparent` · `max-width: var(--bubble-max-width)`. 테두리는 재정의하지 않는다(`Bubble.module.css` `.body`의 1px 테두리 규칙이 그대로 걸린다) | 테두리만, 배경 없음(구성안 §1.1 표) · 실패 최대 폭 78%(≤360px 85%는 기존 미디어 규칙) |
| `.neutral .retryRow` | `justify-content: center` | 「재시도」 가운데(구성안 §6 ⑥) |
| `.failed .bodyBox` | (S3 그대로) 테두리 `--bubble-error-border` | 중립 실패에도 같은 규칙이 걸린다 |

  - 높이(근삿값, 실측 우선): 생성 중 약 48px(본문 1줄 상자) · 실패 약 90px(구성안 §1.1).
  - 테스트 클래스 키(non-scoped): 중립은 루트 `pending`·`neutral`, 실패면 `failed` 추가. `character`·`sebastian`·`ciel`·`user`는 **없음**. `img` 0개.
- `CharacterPending`(캐릭터 변형)은 S3 그대로다. 「재시도」 `onClick={() => onRetry(character)}` — 타입만 `SpeakTarget`으로 받아 넘긴다.

### 2.2 Bubble · MessageMenuSheet — 유저 작성자 표기 (R-CHAT-002 🔒 · Q6)

- 결정: **`authorName`을 그대로 표시한다.** 화면은 값을 「어떠한 의지」로 바꿔 쓰지 않는다(옛 메시지도 서버가 투영해 준다 — api.md §4.3 v0.6 값 규칙). 대체 표시는 `authorName`이 `null` 또는 빈 문자열일 때만이고 값은 `USER_DISPLAY_NAME`(`@shared/characters`)이다(「ui 인계 메모」 S3d `authorName` 행).
- `labels.unknownAuthor`(`이름 없음`)는 **삭제**한다(인계 패킷 §3). 대체 값을 계약 상수로 바꾸는 것이라 화면 문구 키가 필요 없다.
- 단일 판정 함수(`ui/src/chat/labels.ts`, 두 컴포넌트가 같이 쓴다):

```ts
import { USER_DISPLAY_NAME } from '@shared/characters'
/** 유저 말풍선·메뉴 머리의 작성자 표기. 받은 값을 그대로 쓰고, 비었을 때만 고정 명칭 */
export const userAuthorLabel = (authorName: string | null): string =>
  authorName === null || authorName === '' ? USER_DISPLAY_NAME : authorName
```

| 위치 | 현재 | S3d |
|---|---|---|
| `Bubble.tsx` `UserBubble` 작성자 줄 | `message.authorName ?? labels.unknownAuthor` | `userAuthorLabel(message.authorName)` |
| `MessageMenuSheet.tsx` `nameOf` user 분기 | `message.authorName ?? labels.unknownAuthor` | `userAuthorLabel(message.authorName)` |
| `MessageMenuSheet.tsx` 머리 주석 | "유저 = authorName(없으면 이름 없음)" | "유저 = authorName(비었으면 어떠한 의지)" |

- OOC 말풍선은 작성자명이 없다(S1 그대로). 메뉴 머리의 OOC 이름은 `labels.oocPrefix` 그대로.
- 폭 영향 없음(구성안 §3).

### 2.3 Composer · SpeakButtons · MessageList · ChatScreen 배선

| 위치 | 변경 | 근거 |
|---|---|---|
| `index.tsx` `Footer` | `speakingCharacter={speakingCharacterOf(state)}`(AU §1.1). 그 밖 props 그대로(`canSend`·`isSending = writing?.kind==='send'`·`canSpeak`) | 타입이 `SpeakTarget`으로 넓어져 직접 넘기면 `CharacterId \| null`에 맞지 않는다 |
| `Composer` | **변경 없음**. `submit`은 `await onSend(text, ooc)`가 `true`면 입력 비움 + 입력 포커스(S2 그대로). `onSend`(= F-CH-17)가 **T35 직후** `true`로 끝나므로(자동 응답을 기다리지 않는다) 입력 비움이 S2 진입과 같은 흐름에서 일어난다 | 구성안 §2.2 "입력 비움 · 타이핑 가능 · 포커스는 입력창" |
| `SpeakButtons` | **변경 없음**(props 타입 `CharacterId \| null` 그대로). `isDisabled = !canSpeak` 이 S1·S2 내내 true | 잠금은 `writing`에서 저절로 나온다(AU §4) |
| `MessageList` | `onRetrySpeak: (target: SpeakTarget) => void`(타입만). `pending`을 `PendingBubble`에 그대로 넘긴다 | AU §2.1 |
| `renderHistory`(F-CH-39) | 그대로. `pending={canWrite ? state.pending : null}` — 중립도 같은 필터로 전환 커밋에서 바로 사라진다 | R-CHAT-008 |
| `ChatScreen` `onRetrySpeak` | `write.speakAs` 직결 → **`write.retrySpeak`**(F-CH-32 개정, AU §3) | 중립 재시도의 포커스 목적지 |
| `useAutoScroll` `tailKey`(F-CH-40) | 그대로 — `${pending.character}:${pending.status}`가 `auto:generating`·`auto:failed`가 된다 | 기존 규칙 재사용(TC-CH-072·091) |
| `renderHistory` → `MessageList` | 새 prop **`isEditSaveLocked={state.writing?.kind === 'speak'}`**(필수). `isEditSaving`(= `writing?.kind==='edit'`)은 그대로 | D-17: 생성 중 편집 저장을 **보이게 비활성**(메인 세션 결정) |
| `MessageList` → `InlineEditor` | `<InlineEditor … isSaving={isEditSaving} isSaveLocked={isEditSaveLocked} …/>` | 같음 |
| `InlineEditor` | 새 prop **`isSaveLocked: boolean`**. `canSave = !isSaving && !isSaveLocked && isMessageTextValid(text) && text !== message.text` → **저장 버튼만** `disabled`. 취소 버튼·입력창은 활성(`isSaving`을 재사용하지 않는다 — `isSaving`은 둘 다 잠근다). `isSaveLocked`이면 저장 버튼 `aria-describedby`가 가리키는 숨은 안내 `labels.editSaveLockedNote` 1줄을 렌더 | components.md §2.7 · AU §6·§7 |

---

## 3. 기능 명세 (function 단위)

| # | 시그니처(위치) | 입력 | 출력·상태 변경 | 동작 | 예외·분기 | 요구ID |
|---|---|---|---|---|---|---|
| F-CH-17 (S3d 개정) | `send(text: string, ooc: boolean): Promise<boolean>` (`useMessageWrites` 지역 `useSend`) | 입력값·토글 | 저장 여부(`true` = 저장됨) · T13 → T35 / T15 | ① `!isMessageTextValid(text)`면 `false` ② `begin({ type:'writeStarted', write:{ kind:'send' } })`가 false면 `false` ③ `const r = await appendUser(roomId, { text, ooc })` ④ **비활성이면** `release()` → `false`(speak 0회) ⑤ **실패**: `release()` → `dispatch(writeFinished)` → `onFailure(r.error, 'send')` → `false`(AI 호출 0회, 입력 유지 — Composer가 비우지 않는다) ⑥ **성공**: `release()`를 **부르지 않는다**(팻말 유지). `const action = { type:'sendSucceeded', message: r.value, isNearBottom: isNearBottom() }` → `const next = chatReducer(getState(), action)`(F-CH-23과 같은 순수 선계산) → `next.writing?.kind !== 'speak'`면(T36, 도달 불가 방어) `release()` → `dispatch(writeFinished)` → **`false`**(Composer는 입력을 비우지 않는다 · 토스트 없음 · speak 0회. 서버에는 저장됐으므로 다음 첫 로드·재조회에서 보인다) → 아니면 `dispatch(action)`(T35) → `void runSpeak('auto')`(F-CH-42) → `true` | `isNearBottom`은 붙이기 전 측정(S2 그대로). `send`는 자동 응답의 끝을 기다리지 않는다 — Composer가 바로 입력을 비운다. 팻말은 F-CH-42가 내린다 | R-CHAT-006 🔒 · 014 🔒 · 004 · R-MSG-002 · R-CHAT-003 |
| F-CH-31 (S3d 개정) | `speakAs(target: SpeakTarget): Promise<void>` (`useMessageWrites` 지역 `useSpeak`) | 캐릭터 버튼(`CharacterId`) · 「재시도」(캐릭터·`'auto'`) | T27 → F-CH-42 | `!canSpeak(getState())`면 종료 → `begin({ type:'speakStarted', character: target })`가 false면 종료 → `await runSpeak(target)` | S3 그대로(편집 중 거절 DC-10). 인자 타입만 넓힘 | R-CHAT-005 🔒 · 014 🔒 · 004 |
| **F-CH-42** | `runSpeak(target: SpeakTarget): Promise<void>` (`useMessageWrites.ts` 지역 훅 `useRunSpeak(options, gate)`가 `useCallback`으로 만들어 돌려준다. `useMessageWrites`가 한 번 만들어 `useSend`·`useSpeak`에 인자로 넘겨 공유) | 팻말이 이미 걸린 상태 | T29 / T31 / T33 · 팻말 해제 | `const r = await speak(roomId, { character: target })`(`@/api` — 래퍼 추가 없음, 본문은 이것뿐) → `release()` → 비활성이면 종료 → 성공: `dispatch(speakSucceeded { message: r.value, isNearBottom: isNearBottom() })` → 실패: `settleSpeakFailure(deps, r.error)`(S3 함수 그대로 — ① 인증 3종 `speakDiscarded` + `onFailure(error,'speak')` ② `NOT_FOUND` `speakDiscarded` + `onRoomGone()` ③ 그 밖 `speakFailed`) | 자동 재시도·화면 타이머 없음(R-NFR-001). 결과 자리는 `r.value.speaker`(Bubble이 정함) | R-CHAT-014 🔒 · 005 · 011 · R-MSG-009 🔒 |
| F-CH-32 (S3d 개정) | `retrySpeak(target: SpeakTarget): void` (`useChatScreen` — `useCallback([speakAs, focusLog])`. **`useChatScreen` 반환 타입의 `write`에 `retrySpeak: (target: SpeakTarget) => void`를 추가**하고, `index.tsx`는 `onRetrySpeak: write.speakAs` 직결을 `onRetrySpeak: write.retrySpeak`로 바꾼다. `write.speakAs`(Footer 캐릭터 버튼용)는 그대로 남는다) | 실패 말풍선의 `pending.character` | 포커스 · F-CH-31 | `target === 'auto'`면 **먼저** `focusLog()`(F-CH-30 — 히스토리 log, 없으면 ‹) → `void speakAs(target)`. 캐릭터면 S3 그대로 `void speakAs(target)`(포커스는 F-CH-38이 같은 캐릭터 버튼으로) | 「재시도」 버튼이 T27 커밋에서 언마운트되어 포커스가 `body`로 빠지는 것을 막는다. 중립에는 돌아갈 캐릭터 버튼이 없으므로, 새 "…"가 있는 히스토리로 옮긴다(AU §8 D-19) | R-CHAT-014 🔒 · 013 |
| F-CH-37 (불변) | `speakErrorText(error)` | — | — | 중립 실패에도 같은 표(generate.md §3)를 쓴다. 새 문구 없음 | — | R-CHAT-011 |
| **F-CH-43** | `userAuthorLabel(authorName: string \| null): string` (`labels.ts`) | 메시지 `authorName` | 표기 | AU §2.2 | — | R-CHAT-002 🔒 · R-AUTH-004 🔒 |
| **F-CH-44** | `speakingCharacterOf(s: ChatState): CharacterId \| null` (`state/chat.ts`) | 상태 | 값 | AU §1.1 | — | R-CHAT-013 · 005 |

- `useMessageWrites` 결과 타입: `speakAs: (target: SpeakTarget) => Promise<void>`. 옵션은 그대로(`onRoomGone` 포함). 파일은 현재 약 256줄 → `runSpeak` 추출로 `useSpeak`가 줄고 `useSend`가 약 15줄 늘어 **약 275줄**(400줄 안). `useSend` 콜백은 50줄 안(선계산·분기 포함 약 30줄).
- 파일 머리 주석의 "전송은 appendUser 한 곳뿐이다 — AI 를 부르지 않는다(R-CHAT-006)"는 S3d 문구로 바꾼다: "전송 = appendUser → 저장 성공이면 같은 팻말로 speak('auto')(R-CHAT-006 · 014)".

---

## 4. 잠금 · 끼어들기 0회 보장

### 4.1 잠금 표 델타 (generate.md §6 표에 더하는 행·열 해석)

| 진행 중 `writing` | 캐릭터 버튼 2 | 「재시도」(캐릭터·중립) | 전송 | 입력창 | 말풍선 메뉴 · ⋯ |
|---|---|---|---|---|---|
| `send`(S1 저장 중) | `disabled` | `disabled` | `disabled` | **`readOnly`**(글자 유지) | 안 열림 · ⋯ `disabled` |
| `speak` + `'auto'`(S2 생성 중) | `disabled` | (중립 임시 — 버튼 없음) | `disabled` | **타이핑 가능** | 안 열림 · ⋯ `disabled` |
| `null`(결과 · 중립 실패) | 활성 | 활성 | 내용 있으면 활성 | 가능 | 열림 |

- 표의 값은 새 판정 함수 없이 기존 식에서 나온다: 캐릭터 버튼·「재시도」 = `canSpeak`, 전송 = `canSend`, 입력 `readOnly` = `writing?.kind==='send'`, ⋯ = `writing !== null || roomBusy !== null`(D-10). 구성안 §4 표와 일치.

### 4.2 끼어들기 0회 조건 (R-CHAT-014 🔒 "원자 전이 1회")

1. **상태(렌더) 쪽.** `writing`이 `send` → (T35 한 액션) → `speak`로 바뀌고, 그 사이에 `null`인 상태가 **커밋되지 않는다**. 그래서 저장 응답 직후 커밋을 포함한 모든 커밋에서 `canSend`·`canSpeak`가 false이고 버튼은 `disabled`다.
2. **호출(이벤트) 쪽.** `useWriteGate`의 `inFlightRef`를 `appendUser` 시작부터 `speak` 응답까지 **한 번도 내리지 않는다**(F-CH-17 ⑥ · F-CH-42). 같은 틱 연타·`disabled` 반영 전 클릭·Enter·「재시도」 모두 `begin`에서 거절된다.
3. 1과 2가 함께 있어야 한다. 1만 있으면 저장 응답과 T35 dispatch 사이 마이크로태스크에서 ref 해제 → 버튼 클릭이 `begin`을 통과할 여지가 있다. 2만 있으면 `disabled`가 풀린 커밋이 한 번 보인다.
4. 이탈 경로: 저장 실패 · 비활성(언마운트) · T36은 팻말을 바로 내린다(speak 0회). 자동 응답의 결과·실패·인증·방 없음은 F-CH-42가 `release()` 뒤 정리한다.

---

## 5. 파이프라인 (정상·오류)

```
입력 → 전송(클릭 · Enter, IME 조합 중 제외) → canSend && 1~2000자
 → writeStarted(send) [S1]: 전송·두 버튼·⋯ disabled · 입력 readOnly · 하단 바 aria-busy · 유저 말풍선 아직 없음
 → appendUser(room.id, { text, ooc })                       // E8, AI 호출 없음(R-MSG-002)
 ├ 실패 → writeFinished · 팻말 해제 → 입력 유지 → handleWriteFailure(주 문서 §6.6) · speak 0회
 │        (인증 3종 = 읽기 전용 전환 / RATE_LIMITED = 초 문구 / 그 밖 = 토스트) · 이전 실패 말풍선은 그대로
 ├ 비활성(‹ 뒤로 · 방 전환) → 팻말 해제 · 아무것도 안 함 · speak 0회
 └ 201 → isNearBottom 측정 → sendSucceeded(T35) [S2] — 한 커밋:
          유저 말풍선(「어떠한 의지」 · 시각) + 목록 끝 중립 "…"(가운데, role=status "응답을 만드는 중")
          + 두 버튼·전송·⋯ disabled (이전 실패 말풍선은 이것으로 교체)
        → send() true → Composer 입력 비움 · 입력 포커스 유지(타이핑 가능, readOnly 해제)
        → tailKey 'auto:generating' · lastId 증가 → 맨 아래 근처면 맨 아래로 / 위쪽이면 B1 배지(T9 규칙)
        → speak(room.id, { character: 'auto' })              // E9, 팻말 유지, 최대 70초, 화면 타이머 없음
          ├ 201 → isNearBottom 측정 → speakSucceeded(T29) [결과]: 중립 "…" 제거 · 결과 Bubble 1회 교체
          │        자리 = 응답 speaker(세바스찬 왼쪽 · 시엘 오른쪽) · 잠금 해제 · 포커스 이동 없음
          ├ 인증 3종 → speakDiscarded(T33) → 전환(주 문서 §6.6) · 유저 말풍선은 남는다(이미 저장)
          ├ NOT_FOUND → speakDiscarded → onRoomGone(clearLastRoomId · onBack)
          └ 그 밖(SPEAK_IN_PROGRESS · LLM_FAILED · LLM_EMPTY · CONFIG_INVALID · RATE_LIMITED
                  · LLM_BUDGET_EXCEEDED · NETWORK · INTERNAL · VALIDATION_ERROR)
                → speakFailed(T31) [중립 실패]: 같은 자리 가운데 오류 테두리 · role=alert 문구(generate.md §3)
                  · 「재시도」(aria "응답 재시도") · 잠금 해제 · 토스트 없음 · 유저 말풍선 남음
[중립 실패] ├ 「재시도」 → retrySpeak('auto'): focusLog → speakAs('auto') → T27 → 같은 자리 중립 "…" → speak('auto')(선택부터)
           ├ 「세바스찬」·「시엘」 → T27 → 중립 실패 사라짐 · 그 캐릭터 쪽 임시 말풍선(S3 흐름, generate.md §1)
           ├ 새 전송 201 → T35 → 중립 실패 사라짐 · 새 유저 말풍선 + 새 중립 "…"
           └ ‹ 뒤로 → 버린다(언마운트. 서버에 저장된 생성 결과 없음)
```

- 레이트리밋: 전송 1회 = 2회 소모(「ui 인계 메모」 S3d). 저장은 성공하고 이어진 speak만 `RATE_LIMITED`일 수 있다 → 중립 실패 + 초 문구 + 「재시도」.
- `NETWORK`·`INTERNAL`이면 서버에 대사가 저장됐을 수 있다(generate.md §5 L-1과 같은 한계 — 「재시도」가 대사를 하나 더 만들 수 있다). 새 처리 없음.
- 파괴 조작 없음 → confirm 없음(스킬 §11). 메시지 삭제·방 삭제 confirm은 S2 그대로.
- 재작성: 자동으로 고른 대사도 메뉴 「재작성」 = `regenerate(id)` 그대로(저장된 speaker로 다시 씀, 「ui 인계 메모」 S3d).

---

## 6. 확정 문구·라벨 (`ui/src/chat/labels.ts` 단일 소스 — labels.md §8.1.3)

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `pendingDots`(S3 재사용) | `…` | 중립 "…" 본문(`aria-hidden`) |
| **`autoPendingStatus`** | `응답을 만드는 중` | 중립 생성 중 `role=status` 숨은 글자 |
| `speakRetry`(S3 재사용) | `재시도` | 중립 실패 버튼 글자 |
| **`autoRetryAriaLabel`** | `응답 재시도` | 중립 실패 버튼 aria-label |
| `speakErrorText(error)`(S3 재사용) | generate.md §3 표 | 중립 실패 `role=alert` 문구 |
| **`userAuthorLabel(authorName)`**(함수) | 받은 값 / 비었으면 `USER_DISPLAY_NAME`(`어떠한 의지`) | 유저 말풍선 작성자 줄 · 말풍선 메뉴 머리 |
| ~~`unknownAuthor`~~ | ~~`이름 없음`~~ **삭제** | — |
| **`editSaveLockedNote`** | `응답을 만드는 중에는 저장할 수 없습니다` | 인라인 수정 저장 버튼이 생성 중 잠겼을 때의 숨은 안내(`aria-describedby`, `.srOnly` 계열 지역 클래스). 잠금이 풀리면 미렌더 |

- 캐릭터 이름은 계속 `CHARACTERS[id].shortName`이 단일 소스다. 「어떠한 의지」 리터럴은 labels에 두지 않는다 — 단일 소스는 `shared/src/characters.ts` `USER_DISPLAY_NAME`(api.md §5.5).

---

## 7. 접근성 · 읽기 전용 분기

| 항목 | 규칙 |
|---|---|
| 중립 생성 중 | 루트 `role="status" aria-live="polite"`, 숨은 안내 `응답을 만드는 중`. "…"은 `aria-hidden`. 진행률·타이머·애니메이션 없음 |
| 중립 실패 | 문구 `<p role="alert">`. 「재시도」 접근 이름 `응답 재시도`, 네이티브 `disabled`로 잠금 |
| 잠긴 저장 버튼(D-17) | 생성 중 인라인 수정 저장 버튼은 네이티브 `disabled` + `aria-describedby` → 숨은 안내 `labels.editSaveLockedNote`(`응답을 만드는 중에는 저장할 수 없습니다`). 잠금이 풀리면 안내 미렌더. 취소·입력은 활성 |
| 잠금 표시 | 네이티브 `disabled`만. 보이는 요소 없음, 숨은 안내 1줄(잠긴 저장 버튼, 위 행)(구성안 §4). S1 동안 하단 바 `aria-busy=true`(S2 그대로), S2 동안은 중립 `role=status`가 상태를 알린다 |
| 포커스 | 전송 뒤 입력창 유지(Composer S2 규칙). 자동 생성 시작·결과·실패 모두 포커스를 옮기지 않는다(s3d-02 §5). 중립 「재시도」만 히스토리 log로(F-CH-32) |
| 키보드 | Enter 전송·Shift+Enter 줄바꿈·IME 가드 그대로. S1·S2 중 Enter는 `begin` 거절로 무시 |
| 읽기 전용(토큰 없음 · 전환 후) | 중립 생성 중·중립 실패 **미렌더**(DOM에 없음 — `display:none`·`hidden` 아님). 구현은 F-CH-39 `pending={canWrite ? state.pending : null}` + T25가 `pending` 정리. C 하단 바 전체 미렌더(S2 그대로). 읽기 전용에 보이는 S3d 변화는 유저 작성자 표기 하나뿐 |

---

## 8. 설계 결정 (S3d) — 주 문서 §12 결정 표의 본문

| # | 결정 | 근거 |
|---|---|---|
| D-17(메인 세션 승인 2026-10-06) | 인라인 수정이 열린 채 전송해도(S2 허용) 저장 성공 뒤 자동 응답을 시작한다(T35는 `canSpeak`가 아니라 `writing==='send'`만 본다). 편집기는 열린 채 남는다. **전송 뒤 자동 응답 중에는 열린 편집기의 취소만 가능하다. 편집 저장은 생성이 끝날 때까지 잠기고(`canSend` false — 쓰기는 한 번에 하나, S3 잠금 표 `speak` 행), 캐릭터 버튼은 잠긴다(`canSpeak` false — S3 규칙 그대로).** 생성이 끝난 뒤 편집기가 아직 열려 있으면 캐릭터 버튼은 DC-10대로 계속 잠긴다 | R-CHAT-006 🔒 "저장 성공하면 곧바로" — 예외 없음. DC-10(편집 중 캐릭터 버튼 잠금)은 사용자가 고르는 생성에 대한 규칙이고, 전송은 이미 편집 대상 뒤에 새 메시지를 붙이는 동작이다 |
| D-18 | 자동 응답 시작은 새 리듀서 액션 `sendSucceeded`(T35) 하나로, 팻말은 저장 시작부터 생성 끝까지 한 번도 내리지 않는다 | AU §4.2. 기존 `messagesAppended` + `writeFinished` + `speakStarted` 3액션으로는 사이 커밋에서 잠금이 풀린다 |
| D-19 | 중립 「재시도」의 포커스 목적지 = 히스토리 log(F-CH-30). 캐릭터 「재시도」는 S3 그대로 같은 캐릭터 버튼 | 중립에는 대응하는 버튼이 없다. 새 "…"(`role=status`)가 log 안에 있다 |
| D-20 | 상태 필드를 늘리지 않고 `PendingSpeak.character`·`MessageWrite.speak.character`의 타입을 `SpeakTarget`으로 넓힌다 | 계약 「ui 인계 메모」 "화면 상태의 생성 대상은 `SpeakTarget`" · 초기값 TC 불변 |
| D-21 | 유저 작성자 표기는 받은 값 그대로, 비었을 때만 `USER_DISPLAY_NAME`. `unknownAuthor` 삭제 | Q6 · 「ui 인계 메모」 S3d · 인계 패킷 §3 |
| D-22 | 구성안 §7 구조 제안 2건(보이는 "누가 대답할지 고르는 중" 문구 · 선택 순간 미리 옮기기)은 **미채택** | 요구 밖 · 계층 횡단(위임문 제약) |

구성안·계약과 다르게 정한 것: **없음.** 구성안이 ui-designer에게 맡긴 두 점(클래스 이름 · 유저 말풍선 표시 시점)만 AU §0에서 정했다.

---

## 9. 기존 TC 영향 · 신규 TC (TC-CH-098~) — 상세 시나리오는 ui-test-designer 소관

### 9.1 기존 TC 변경 목록 (s3d-02 §6 확정 — scenarios.md 「변경 대기열」 Q-08로 넘김)

| TC | 지금 단언 | S3d 단언 | 스펙 파일 |
|---|---|---|---|
| TC-CH-008 | `authorName=null` → `이름 없음` | `null`·`''` → `어떠한 의지`(`USER_DISPLAY_NAME` import로 비교) | `Bubble.test.tsx` |
| TC-CH-033 | `appendUser` 외 호출 0회(AI 호출 없음) | `appendUser` 1회 → **`speak(room.id, { character: 'auto' })` 1회**, 그 밖 쓰기·`regenerate` 0회. 응답 fixture `authorName` = `어떠한 의지`로 표시 그대로 | `Composer.test.tsx`(필터 283·309행 조정) |
| TC-CH-034 | OOC 전송 → `appendUser(…, { ooc: true })` | 같음 + `speak('auto')` 1회(OOC 뒤에도 같은 동작, R-MSG-009) | `Composer.test.tsx` |
| TC-CH-036 | 응답 뒤 해제 | 저장 응답 뒤에도 잠금 유지 → **speak 결과 뒤 해제**. 입력 `readOnly`는 저장 응답에서 풀림 | `Composer.test.tsx` |
| TC-CH-038 | 전송 성공 → 맨 아래 / 배지 | 같음(T35가 T9 규칙). speak mock은 대기 상태로 둔다 | `Composer.test.tsx` · `ChatScroll` |
| TC-CH-063 | 늦은 쓰기 응답 무시 | + 언마운트 뒤 `appendUser` 응답이면 **`speak` 0회** | `AuthTransition` 또는 해당 스펙 |
| TC-CH-075 | 실패 말풍선 상태에서 유저 전송 성공 → 실패 말풍선 남음 | → 실패 말풍선 **사라지고 중립 "…"**(T35 교체). 다른 두 단언 불변 | `SpeakFlow.test.tsx` |
| TC-CH-088 | 전송은 AI 호출 없음(speak·regenerate 0회) | **폐기 → TC-CH-098로 대체**(speak `'auto'` 1회, 캐릭터 값 speak 0회, regenerate 0회) | `Composer.test.tsx` |
| TC-CH-090 | 실패 말풍선 중 전송 대기 → 「재시도」 disabled, 응답 뒤 활성 | 전송 대기 중 disabled는 같음. **저장 응답 뒤에도 세바스찬 버튼 `disabled` 유지**(자동 응답 중), 실패 말풍선은 중립 "…"로 바뀌어 「재시도」가 없다. `speak` 호출 **총 2회**(처음 실패한 세바스찬 1 + 자동 `'auto'` 1)로 단언 변경 | `SpeakFlow.test.tsx` |
| TC-CH-033 · 034 · 038 · 088 | 목록 `items()` 길이 5 | **6**(T35의 중립 "…" `li` 1개 추가 — speak mock 대기 상태). 088은 폐기 → 098로 옮길 때 같은 보정 | `Composer.test.tsx` |
| TC-CH-094 | 편집 중 버튼·재시도 disabled, 전송 활성 | 불변. 편집 중 전송의 결과는 신규 TC-CH-107 | — |
| TC-CH-053 · 085 | T13~T16 · T27~T34 | `SpeakTarget` 값 `'auto'` 케이스 추가(T27·T31). 기존 단언 불변 | `state/chat.test.ts` |
| 전송 경로가 있는 스펙 공통 | — | `@/api` mock에 `speak` 기본값 = **영원히 대기**(Promise 미해결) 헬퍼. 전송 TC가 의도치 않게 결과·실패로 진행하지 않게 한다 | `AuthTransition` · `BubbleMenu` · `Regenerate` · `ChatScreen` |
| TC-CH-040 · 079 | 메뉴 머리 이름 | fixture `authorName`이 값이면 불변. `null` fixture면 `어떠한 의지` | `BubbleMenu.test.tsx` |

### 9.2 신규 TC 예약 (TC-CH-098 ~ 109)

| TC | 이름 | 요구 | 종류 | 핵심 단언 |
|---|---|---|---|---|
| TC-CH-098 | 전송 → 자동 응답 호출 | R-CHAT-006 🔒 · 014 🔒 | 자동 | `appendUser` 1회 resolve **뒤에** `speak(room.id, { character: 'auto' })` 1회. 캐릭터 값 speak 0회, regenerate 0회. Enter 전송도 같음 |
| TC-CH-099 | T35 한 커밋 | R-CHAT-014 🔒 | 자동 | 저장 resolve 직후 같은 화면에서: 유저 말풍선(`user`, 작성자 `어떠한 의지`) + 목록 끝 `.pending.neutral` 1개(`img` 0 · `character`/`sebastian`/`ciel`/`user` 클래스 없음 · role=status 이름 `응답을 만드는 중`) + 두 캐릭터 버튼·전송·⋯ `disabled` · 입력 비움·`readOnly` 아님 |
| TC-CH-100 | 결과 자리 2종 | R-CHAT-014 🔒 · 002 🔒 · R-MSG-009 | 자동 | speak 응답 `speaker:'sebastian'` → `character sebastian`(왼쪽) · `'ciel'` → `character ciel`(오른쪽). `.pending` 0개 · 잠금 해제 · 포커스 이동 없음(입력창 유지) |
| TC-CH-101 | 저장 실패 → AI 0회 | R-CHAT-006 🔒 · 011 | 자동 | `appendUser` 실패(`INTERNAL`·`RATE_LIMITED`·`TOKEN_INVALID` 각 1) → `speak` 0회 · 입력 유지 · 토스트/전환은 S2 규칙 · 중립 없음 |
| TC-CH-102 | 중립 실패 | R-CHAT-014 🔒 · 011 · 005 | 자동 | speak(auto) `LLM_FAILED`·`SPEAK_IN_PROGRESS`·`RATE_LIMITED`(retryAfterSec 초 문구)·`LLM_BUDGET_EXCEEDED`·`NETWORK` → 같은 자리 `.pending.neutral.failed` · role=alert 문구 = `speakErrorText` · 「재시도」(이름 `응답 재시도`) · 유저 말풍선 남음 · 토스트 없음 · 잠금 해제 |
| TC-CH-103 | 중립 재시도 | R-CHAT-014 🔒 | 자동 | 「재시도」 → `speak(room.id, { character: 'auto' })` 추가 1회 · 같은 자리 중립 "…" · 유저 말풍선 추가 0 · 포커스 = 히스토리 log |
| TC-CH-104 | 끼어들기 0회 | R-CHAT-014 🔒 | 자동 | `appendUser` 대기 중 · 저장 resolve 직후(같은 틱) · speak 대기 중에 캐릭터 버튼 클릭(`disabled` 우회 `fireEvent` 포함)·Enter → `speak` 총 1회(`'auto'`), `appendUser` 1회 |
| TC-CH-105 | 중립 실패에서 나가는 길 | R-CHAT-014 🔒 · 005 | 자동 | 중립 실패 → 「시엘」 → 중립 없음 · 시엘 임시 말풍선 · 새 전송 201 → 중립 실패 사라짐 · 새 유저 말풍선 + 새 중립 "…" |
| TC-CH-106 | 자동 응답 인증·방 없음 | R-CHAT-014 🔒 · 011 · 008 | 자동 | speak(auto) `TOKEN_INVALID` → 중립 제거 · 읽기 전용 전환(하단 바·`.pending` DOM에 없음) · 유저 말풍선 남음 / `NOT_FOUND` → `clearLastRoomId`·`onBack` |
| TC-CH-107 | 편집 중 전송(D-17) | R-CHAT-006 🔒 · 014 🔒 · 007 | 자동 | 편집기 열림 → 전송 → speak(auto) 1회 · 편집기 유지 · 생성 중(`isEditSaveLocked`=true): 편집기 **저장 버튼만 `disabled`** + `aria-describedby` 안내 `응답을 만드는 중에는 저장할 수 없습니다` · **취소 버튼·입력창 활성**(입력 가능, 취소 누르면 편집기 닫힘) · 캐릭터 버튼 disabled · 생성 결과 뒤 저장 버튼 활성(내용 바뀌었으면)·안내 미렌더 · 편집기가 열려 있으면 캐릭터 버튼 계속 disabled(DC-10). 부품 단위: InlineEditor `isSaveLocked` true/false 쌍 |
| TC-CH-108 | 작성자 표기 | R-CHAT-002 🔒 · R-AUTH-004 🔒 | 자동(부품) | `authorName` `'어떠한 의지'` → 그대로 · 다른 값(옛 데이터 가정 `'미샤'`) → **그대로**(치환 금지) · `null`·`''` → `어떠한 의지`. 말풍선 메뉴 머리도 같은 규칙 · 순수 `userAuthorLabel` 4케이스 |
| TC-CH-109 | 390×565 스크린샷 2종 | R-CHAT-013 · 014 🔒 | 수동 | 자동 생성 중(유저 말풍선 + 중립 "…") · 자동 실패(중립 실패 + 「재시도」). 구성안 §2.2·§2.4와 대조 |
| (리듀서) | T35·T36 · T27·T31 `'auto'` · `speakingCharacterOf` | R-CHAT-014 🔒 | 자동(순수) | TC-CH-085 확장 또는 TC-CH-099 순수 행으로 — 번호는 ui-test-designer가 정한다 |
