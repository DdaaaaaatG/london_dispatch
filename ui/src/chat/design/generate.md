# chat 상세 설계 — S3 생성(speak · 재작성) 흐름·에러·결정 (분할 문서, v1.7)

> 주 문서: `ui/src/chat/design.md`(RTM 포함). v1.7에서 40KB 한계로 주 문서의 S3 본문을 이 파일로 옮겼다.
> 옛 절 번호 대응: 주 문서 §6.8 → §1 · §6.9 → §2 · §8.4 → §3 · §11.2 D-11~D-15·A-6 → §4 · §13.1 → §5 · functions.md §4.3 잠금 표·쓰기 팻말 → §6(v1.7.1).
> 상태·전이(T27~T34)·기능(F-CH-31~40)은 `design/functions.md` §1·§4.3, 컴포넌트는 `design/components.md` §2.11·§2.12, TC는 `design/tc.md` §3.

비유: 캐릭터 버튼은 주방에 주문서를 넣는 일이다. 주문이 들어가면 식탁 끝에 빈 접시("…")를 먼저 놓고, 요리가 나오면 그 접시를 요리로 바꾼다. 실패하면 빈 접시 자리에 "실패" 쪽지와 「재시도」 벨을 둔다.

## 0. S3 히스토리 조각 [확정] — 옛 주 문서 §2.2 하단

```
실패 말풍선(임시 자리 그대로)              재작성 중(대상 말풍선)
| (o) 세바스찬                         |   | (o) 세바스찬  16:41  다시 쓰는 중…   |
|  +--------------------------------+  |   |     예, 도련님.   (본문 흐리게 0.55) |
|  | ! 생성에 실패했습니다.         |  |   |     기존 텍스트 유지, aria-busy      |
|  |                       [재시도] |  |
|  +--------------------------------+  |   (모든 실패 코드에 [재시도] 있음)
   테두리 --bubble-error-border, role=alert
```

## 1. 캐릭터 1턴 = speak (R-CHAT-005 🔒 · 004 · 003 · 011) — 옛 §6.8

```
[세바스찬]/[시엘] 클릭(canSpeak) → speakStarted(T27): writing=speak · pending=generating
 → 같은 커밋: 목록 끝 임시 말풍선 "…"(눌린 캐릭터 쪽) · 두 버튼·전송 disabled · 입력 타이핑 가능 · ⋯ disabled
 → tailKey 변경 → 맨 아래 근처였으면 맨 아래로
 → speak(room.id, { character })   // Bearer 는 래퍼, 화면 타이머 없음(최대 70초, 서버 종결)
 ├ 201 → isNearBottom 측정 → speakSucceeded(T29): 임시 말풍선 → 결과 Message 말풍선(교체), 잠금 해제
 │        ├ 맨 아래 근처 → 맨 아래로 · 위쪽이면 B1 「새 메시지」(S2 전송과 같은 규칙)
 │        └ 누른 버튼이 포커스를 잃었으면 그 버튼으로(F-CH-38)
 ├ 인증 3종 → speakDiscarded(임시 말풍선 제거) → handleWriteFailure(전환 · 토스트 · ‹ 포커스)
 ├ NOT_FOUND(방 사라짐) → speakDiscarded → clearLastRoomId → onBack → 목록 재로드
 └ 그 밖 → speakFailed(T31): 같은 자리 실패 말풍선(문구 §3, role=alert) + 「재시도」(모든 코드), 토스트 없음
        → 「재시도」 = 같은 캐릭터로 speakStarted … (위 흐름 반복)
        → 다른 캐릭터 버튼 = 실패 말풍선 사라지고 새 임시 말풍선(T27)
        → ‹ 뒤로 = 버린다(언마운트, 서버에 저장된 것 없음)
```

## 2. 재작성 = regenerate (R-CHAT-007 🔒 · 011) — 옛 §6.9

```
말풍선 메뉴(isRegenerateTarget = 캐릭터 line + 화면 목록 마지막) → 「재작성」 → 시트 닫힘(confirm 없음) → 말풍선 포커스
 → writeStarted{ regenerate, id }: 대상 본문 흐리게 + aria-busy + "다시 쓰는 중…" · 두 버튼·전송 disabled
 → regenerate(id)                    // 본문 없음, 최대 70초
 ├ 200 → messageReplaced(같은 id 본문 교체) → writeFinished
 ├ NOT_LAST_MESSAGE → writeFinished → 토스트 → loadInitial(첫 페이지 재조회) → ready 커밋 뒤 히스토리 포커스(F-CH-41)
 ├ NOT_FOUND → messageRemoved → writeFinished → 토스트 → (남은 0건 + hasMore면 loadInitial) → 다음 ready 커밋 뒤 히스토리 포커스, log 없으면 ‹(F-CH-41)
 ├ 인증 3종 → writeFinished → 전환(주 문서 §6.6)
 └ 그 밖(SPEAK_IN_PROGRESS · LLM_FAILED · LLM_EMPTY · CONFIG_INVALID · NOT_CHARACTER_MESSAGE · RATE_LIMITED · NETWORK · INTERNAL)
        → writeFinished → 원 대사 그대로 → 토스트(§3). 재시도 버튼 없음 — 메뉴에서 다시 누른다
```

## 3. 생성 실패 문구 (R-CHAT-011 · R-CHAT-005) — 옛 §8.4

`speakErrorText(error: ApiError): string`(실패 말풍선) · `writeErrorText(error, 'regenerate')`(토스트). 실패 말풍선의 「재시도」는 **코드와 무관하게 항상** 렌더한다(사용자 결정 2026-10-06: 요구 원문 유지 — R-CHAT-005 🔒 "실패 시 임시 자리에 오류 문구 + 「재시도」". DC-02. `canRetrySpeak`는 두지 않는다). `WriteAction`에 `'speak' | 'regenerate'`를 더한다. 원문은 api.md 「ui 인계 메모」. 공통 행(인증·`RATE_LIMITED`·`NETWORK`)은 `design/labels.md` §8.3.

| code | speak — 실패 말풍선 문구 · 「재시도」 | regenerate — E 토스트 문구 | 화면 처리 |
|---|---|---|---|
| `SPEAK_IN_PROGRESS` | `ERROR_MESSAGES.SPEAK_IN_PROGRESS`(`이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요.`) · ○ | 같은 문구 | 잠시 후 다시 — 다른 탭·다른 사람의 생성 중 |
| `LLM_FAILED` · `LLM_EMPTY` | `생성에 실패했습니다.`(구성안 §2 원문, 두 코드 같음) · ○ | `대사를 다시 만들지 못했습니다. 메뉴에서 다시 시도해 주세요.`(두 코드 같음) | 저장 없음. regenerate는 원 대사 유지 |
| `CONFIG_INVALID` | `ERROR_MESSAGES.CONFIG_INVALID`(`서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요.`) · ○(사용자 결정 2026-10-06: 요구 원문 유지) | 같은 문구 | 관리자 안내. 서버 설정이 고쳐지면 「재시도」가 성공한다. 읽기·유저 발화는 계속 된다 |
| `NOT_LAST_MESSAGE` | (오지 않음) | `다른 메시지가 먼저 이어져 재작성할 수 없습니다. 대화를 새로 불러옵니다.` | 토스트 → 첫 페이지 재조회(F-CH-36) |
| `NOT_CHARACTER_MESSAGE` | (오지 않음) | `ERROR_MESSAGES.NOT_CHARACTER_MESSAGE` | 화면 결함(메뉴가 캐릭터에만 보이므로). 토스트만 |
| `NOT_FOUND` | (말풍선 없음 — 방 사라짐: `onRoomGone` 목록 복귀, 토스트 없음) | `메시지를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.`(§8.3 `editMessage`와 같은 문구) | regenerate: 목록에서 제거 |
| `RATE_LIMITED` | §8.3과 같은 문구(`retryAfterSec` 있으면 초) · ○ | §8.3과 같은 문구 | 전환 없음 |
| 인증 3종 | (말풍선 없음 — 제거 후 §8.3 전환 문구 토스트) | §8.3 전환 문구 | 읽기 전용 전환(주 문서 §6.6) |
| `NETWORK` | `서버에 연결할 수 없습니다.` · ○ | 같은 문구 | speak는 서버에 저장됐을 수 있다(§5 L-1) |
| 그 밖(`INTERNAL`·`VALIDATION_ERROR`) | `ERROR_MESSAGES[code]` · ○ | `ERROR_MESSAGES[code]` | — |

- 톤: 토스트는 S2 `toastToneOf` 그대로(인증·`RATE_LIMITED` = warning, 그 밖 danger). 실패 말풍선은 톤 구분 없이 danger 테두리 하나.

## 4. 설계 결정·가정 (S3) — 옛 §11.2 D-11~D-15 · A-6

| # | 내용 |
|---|---|
| D-11(결정) | 임시·실패 말풍선은 Bubble 변형이 아니라 별도 로컬 `PendingBubble`. Bubble은 서버 `Message`만 그린다. 모양은 `Bubble.module.css`를 import해 같은 클래스·같은 DOM 구조로(composes 아님 — 자손 선택자 때문, components.md §2.12 DC-01) |
| D-12(결정) | speak 실패 안내는 실패 말풍선 **하나**(토스트 없음). 예외는 인증 3종(전환 + 토스트, 말풍선 제거)과 `NOT_FOUND`(방 사라짐 → 목록 복귀). `RATE_LIMITED`도 실패 말풍선에 S2 문구 + 「재시도」로 둔다(요구 "실패 시 임시 자리에 오류 문구 + 재시도") |
| D-13(결정) | 재작성 실패는 토스트 하나, 별도 재시도 버튼 없음. 진행 중 대상은 기존 텍스트 유지 + 흐리게 + `다시 쓰는 중…` |
| D-14(결정, v1.7 DC-10 개정) | 쓰기 잠금 기본은 `canSend`(전송·수정·삭제·재작성). 캐릭터 버튼·「재시도」는 `canSpeak = canSend && editingId === null` — 인라인 수정이 열려 있으면 생성하지 않는다. 입력창 `readOnly`는 S2대로 전송 중에만 |
| D-15(결정) | `NOT_LAST_MESSAGE` 재조회는 S1 `loadInitial`을 그대로 쓴다. 재조회 동안 히스토리가 잠깐 "대화를 불러오는 중"으로 바뀌고, 끝나면 맨 아래에 놓인다(이전 페이지로 불러온 부분은 사라진다). 새 병합 함수는 만들지 않는다. 재조회 뒤 포커스는 `await` 직후 동기 호출이 아니라 **재조회가 ready로 커밋된 뒤** layout effect가 요청을 소비해 옮긴다. 요청은 ref 플래그가 아니라 **카운터 state**(요청이 재렌더를 일으켜 커밋 순서와 무관하게 소비, v1.7.1 실물 동기화)다(F-CH-41, CF-01 — loading 커밋에서는 log가 없다) |
| A-6(가정) | 화면 타이머가 없으므로 서버가 70초 안에 끝낸다는 계약(R-NFR-001)을 믿는다. 연결이 끊겨 응답이 끝내 오지 않으면 임시 말풍선이 남는다. 이때는 ‹ 뒤로·새로 고침으로 벗어난다 |
| D-16(결정, DC-04) | **스킬 문구와 다름, 요구 우선.** ui-design-strategy §6.3·§7과 다른 결정 3건: ① `SPEAK_IN_PROGRESS`는 "3초 뒤 자동 해제" 대신 실패 말풍선 + 「재시도」(R-CHAT-005 🔒 "실패 시 임시 자리에 오류 문구 + 재시도", R-CHAT-011) ② 생성 중 상태는 버튼 묶음 `aria-busy` 대신 임시 말풍선 `role=status` + 버튼 네이티브 `disabled`(R-CHAT-005 "두 버튼·전송 잠금", a11y.md) ③ 재작성 진행은 별도 임시 말풍선 대신 대상 말풍선을 흐리게 + `다시 쓰는 중…`(같은 id를 제자리에서 교체하는 계약 api.md §4.14 · 사전 확정 3). 스킬 문구 갱신은 메인 세션 몫 |

## 5. 알려진 한계 (요구 승격 후보는 보고만) — 옛 §13.1

| # | 한계 | 현재 처리 | 승격 후보 |
|---|---|---|---|
| L-1 | speak가 `NETWORK`·`INTERNAL`로 실패하면 서버에는 저장됐을 수 있다(응답만 못 받음, api.md 「ui 인계 메모」). 「재시도」가 대사를 하나 더 만들 수 있다 | 단순 재호출(중복 가능성 수용). 다음 첫 로드·재조회 때 저장된 대사가 보인다 | 「재시도」 전에 첫 페이지를 재조회해 끝 메시지가 그 캐릭터의 새 대사면 재호출하지 않기 — **추가 후보**(요구 없음, 설계하지 않음) |
| L-2 | regenerate가 `NETWORK`·`INTERNAL`이면 서버에서는 교체됐을 수 있다 | 원 대사를 보여 준다. 다음 재조회 때 맞춰진다 | 없음(중복이 생기지 않는다) |
| L-3 | 응답이 끝내 오지 않는 연결 끊김 | 임시 말풍선이 남는다(A-6) | 없음(타이머 금지 — 계약 75초 조건, api.md §4.12) |

## 6. 잠금 표 — 옛 `design/functions.md` §4.3(v1.7.1 이전)

**쓰기 팻말(S3).** `useMessageWrites` 내부 `useWriteGate.begin`의 인자는 `MessageWrite`가 아니라 **시작 액션** `ChatAction`(`writeStarted` 또는 `speakStarted`)이다. 규칙은 그대로: `inFlightRef.current || !canSend(getState())`면 `false`, 아니면 in-flight true → `dispatch(start)` → `true`. 전송·수정·삭제·speak·재작성이 **같은 팻말 하나**를 쓴다(같은 틱 연타가 종류를 넘어 막힌다). speak는 시작 전 `canSpeak`도 본다(F-CH-31).

잠금 표(캐릭터 버튼·「재시도」 = `canSpeak`, 전송·메뉴 = `canSend`. 함수 정의는 functions.md §1.2):

| 진행 중 `writing` | 캐릭터 버튼 2 | 「재시도」 | 전송 | 입력창 타이핑 | 말풍선 메뉴 · ⋯ |
|---|---|---|---|---|---|
| `null`(ready) | 활성 | 활성 | 내용 있으면 활성 | 가능 | 열림 |
| `null` + 인라인 수정 열림(`editingId` 있음, DC-10) | **`disabled`** | **`disabled`** | 내용 있으면 활성(S2 그대로) | 가능 | 열림(S2 그대로) |
| `speak` | `disabled` | (실패 말풍선 없음 — 임시 말풍선) | `disabled` | **가능** | 안 열림(D-10) · ⋯ `disabled` |
| `regenerate` | `disabled` | `disabled` | `disabled` | **가능** | 안 열림 · ⋯ `disabled` |
| `send` | `disabled` | `disabled` | `disabled` | `readOnly`(S2 그대로) | 안 열림 · ⋯ `disabled` |
| `edit`·`delete` | `disabled` | `disabled` | `disabled` | 가능 | 안 열림 · ⋯ `disabled` |
