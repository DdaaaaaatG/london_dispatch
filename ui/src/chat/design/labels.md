# chat 상세 설계 — 확정 문구·라벨 표 (분할 문서, v1.7 · §8.1.3 S3d v1.9.1 실물 동기화 2026-10-07)

> 주 문서: `ui/src/chat/design.md`(RTM 포함). 이 파일은 주 문서 §8의 상세다(v1.7에서 40KB 한계로 이전, 절 번호는 그대로 §8.1~§8.3).
> 단일 소스 코드는 `ui/src/chat/labels.ts`. S3 생성 실패 문구(옛 §8.4)는 `design/generate.md` §3.

## 8.1 문구 (S1)

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `screenAriaLabel(title)` | `` `대화: ${title}` `` | `<main aria-label>` |
| `backAriaLabel` | `방 목록으로 돌아가기` | ‹ |
| `createdAtAriaLabel(dateText)` | `` `방 생성일 ${dateText}` `` | 생성일 `<time>` |
| `historyAriaLabel` | `대화 기록` | `role="log"` |
| `loading` · `empty` · `loadError` · `retry` | `대화를 불러오는 중` · `아직 대화가 없습니다` · `대화를 불러오지 못했습니다` · `다시 시도` | 첫 로드 StateView · 「다시 시도」 |
| `olderLoading` · `olderError` | `이전 대화 불러오는 중` · `이전 대화를 불러오지 못했습니다` | B0 |
| `oocPrefix` · `oocDecor` | `[지시]` · `—` | OOC 말풍선·메뉴 머리 |
| ~~`unknownAuthor`~~ | ~~`이름 없음`~~ **삭제(S3d, CR-002)** — 대체 표시는 `userAuthorLabel(authorName)` → `USER_DISPLAY_NAME`. S3d 새 키 3개와 함수 `userAuthorLabel`은 아래 §8.1.3 | — |
| `newMessages` · `newMessagesAriaLabel` | `새 메시지` · `새 메시지 보기, 맨 아래로 이동` | B1 |
| `readOnlyNotice` | `열람 전용 - 대화 참여는 등급 회원만` | D |

## 8.1.1 문구 (S2)

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `moreAriaLabel` | `방 메뉴 열기` | ⋯ IconButton |
| `composerAriaLabel` | `메시지 작성` | C `role="group"` |
| `inputAriaLabel` | `메시지 입력` | 입력창 |
| `inputPlaceholder` | `대사나 지시를 입력` | 입력창(구성안 §2) |
| `send` | `전송` | 전송 버튼 |
| `oocAriaLabel` · `oocOn` · `oocOff` | `OOC 지시 모드` · `OOC 켬` · `OOC 끔` | Toggle |
| ~~`messageMenuAriaLabel`~~ · ~~`messageMenuHeader(name, time, excerpt)`~~ | **삭제(S3e, CR-003)** — 말풍선 메뉴 제거 | — |
| `edit` · `delete` · `cancel` · `save` | `수정` · `삭제` · `취소` · `저장` | (S3e) 말풍선 버튼 줄 글자 · 확인 시트·편집기 버튼 |
| `editAriaLabel` · `editInputAriaLabel` | `메시지 수정` · `수정할 내용` | InlineEditor 그룹·입력 |
| `deleteMessageTitle` · `deleteMessageBody` | `이 메시지를 삭제할까요?` · `삭제한 메시지는 되돌릴 수 없습니다.` | 메시지 삭제 확인(구성안 §2-4 "같은 틀", 문구는 이 설계가 정함) |
| `roomMenuAriaLabel` · `roomMenuHeader(title)` | `방 메뉴` · `` `방 메뉴 · ${title}` `` | 방 메뉴 시트 |
| `rename` · `deleteRoom` | `이름 변경` · `방 삭제` | 방 메뉴 항목 |
| `renameTitle` · `renameInputAriaLabel` | `방 이름 변경` · `방 이름` | PromptSheet |
| `deleteRoomTitle` · `deleteRoomBody` | `이 방을 삭제할까요?` · `메시지와 장기기억이 함께 지워지며 되돌릴 수 없습니다.` | 방 삭제 확인(구성안 §2-4 원문) |

- 캐릭터 이름은 labels가 아니라 `CHARACTERS[id].shortName`이 단일 소스다.

## 8.1.2 문구 (S3)

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `speakAriaLabel(name)` | `` `${name} 대사 생성` `` | 캐릭터 버튼 aria-label(보이는 글자는 `CHARACTERS[c].shortName`) |
| `pendingDots` | `…` | 임시 말풍선 본문(`aria-hidden`) |
| `pendingStatus(name)` | `` `${name} 대사를 만드는 중` `` | 임시 말풍선 `role=status` 숨은 글자 |
| `speakRetry` | `재시도` | 실패 말풍선 버튼 글자(요구 원문 「재시도」) |
| `speakRetryAriaLabel(name)` | `` `${name} 대사 재시도` `` | 실패 말풍선 버튼 aria-label |
| `regenerate` | `재작성` | (S3e) 「재작성」 버튼 글자(요구 원문). 옛 말풍선 메뉴 항목 |
| `regeneratingNote` | `다시 쓰는 중…` | 재작성 중 대상 머리 줄 `role=status` |

- (S3b) `LLM_BUDGET_EXCEEDED`는 **새 labels 키를 두지 않는다.** `speakErrorText`·`writeErrorText(…, 'regenerate')` 둘 다 "그 밖" 분기 `ERROR_MESSAGES[code]`로 `ERROR_MESSAGES.LLM_BUDGET_EXCEEDED`(요구 원문 `이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.`)를 쓴다. 이 문구는 서버 응답 `message`와 같은 요구 원문이지만(api.md §3.2 — 서버는 기본 문구만 보낸다), **화면은 응답 `error.message` 필드를 읽지 않고 `code` → `ERROR_MESSAGES`로 정한다**(§8.3 규칙 유지). 래퍼가 `message`를 비워 받으면 같은 `ERROR_MESSAGES` 값으로 채우므로(API-T-UI-022) 결과 문구는 같다. 초 값(`retryAfterSec`)은 넣지 않는다(래퍼가 버린다). 표는 `design/generate.md` §3

## 8.1.3 문구 (S3d, CR-002 — v1.9.1 `labels.ts` 실물 대조 일치)

설계 본문은 `design/auto.md` §6. 아래는 `labels.ts`에 실제로 있는 키다.

| 키 | 문구 | 쓰는 곳 |
|---|---|---|
| `autoPendingStatus` | `응답을 만드는 중` | 중립 "…" `role=status` 숨은 안내(PendingBody `statusText`) |
| `autoRetryAriaLabel` | `응답 재시도` | 중립 실패 「재시도」 aria-label |
| `editSaveLockedNote` | `응답을 만드는 중에는 저장할 수 없습니다` | 생성 중 잠긴 인라인 수정 저장 버튼의 숨은 안내(`aria-describedby`, InlineEditor 지역 `.srOnly`) |
| `userAuthorLabel(authorName)`(함수, `labels` 객체 밖 named export) | 받은 값 그대로 · `null`·`''`이면 `USER_DISPLAY_NAME`(`어떠한 의지`, `@shared/characters`) | Bubble `UserBubble` 작성자 줄 · MessageMenuSheet `nameOf` user 분기 |

- `unknownAuthor` 키는 `labels.ts`에서 삭제됐다(실물 확인). 「어떠한 의지」 리터럴은 `labels.ts`에 없다.

## 8.1.4 문구 (S3e, CR-003) → `design/actions.md` §8

새 키 4개(함수): `bubbleActionsAriaLabel(name)` = `{이름} 말풍선 작업` · `editActionAriaLabel(name)` = `{이름} 대사 수정` · `regenerateActionAriaLabel(name)` = `{이름} 대사 재작성` · `deleteActionAriaLabel(name)` = `{이름} 대사 삭제`. 개정 1개: 재작성 실패 토스트 `LLM_FAILED`·`LLM_EMPTY` = `대사를 다시 만들지 못했습니다. 재작성을 다시 눌러 주세요.`(generate.md §3). 삭제 2개: `messageMenuAriaLabel` · `messageMenuHeader`.

## 8.2 오류 상세 `errorDetail(code)` (읽기, S1)

| code | 문구 |
|---|---|
| `NETWORK` | `서버에 연결할 수 없습니다.` |
| `NOT_FOUND` | `방을 찾을 수 없습니다. 목록으로 돌아가 주세요.` |
| 그 밖 | `ERROR_MESSAGES[code]` |

## 8.3 쓰기 실패 문구 `writeErrorText(error: ApiError, action: WriteAction): string` (S2, R-CHAT-011)

| 조건 | 문구 | 톤 | 전환 |
|---|---|---|---|
| `TOKEN_REQUIRED` | `로그인 정보가 없어 열람 전용으로 바뀌었습니다.` | warning | ○ |
| `TOKEN_INVALID` | `인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.` | warning | ○ |
| `LEVEL_TOO_LOW` | `대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.` | warning | ○ |
| `RATE_LIMITED` + `retryAfterSec` | `` `요청이 너무 많습니다. ${retryAfterSec}초 후 다시 시도해 주세요.` `` | warning | ✕ |
| `RATE_LIMITED` 값 없음 | `ERROR_MESSAGES.RATE_LIMITED` | warning | ✕ |
| `VALIDATION_ERROR` + `send`·`editMessage` | `메시지는 1~2000자로 입력해 주세요.` | danger | ✕ |
| `VALIDATION_ERROR` + `renameRoom` | `방 제목은 1~60자로 입력해 주세요.` | danger | ✕ |
| `NOT_FOUND` + `send`·`renameRoom` | `방을 찾을 수 없습니다. 목록으로 돌아가 주세요.` | danger | ✕ |
| `NOT_FOUND` + `editMessage` | `메시지를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.` | danger | ✕ |
| `NETWORK` | `서버에 연결할 수 없습니다.` | danger | ✕ |
| 그 밖(`INTERNAL`·`CONFIG_INVALID` 등) | `ERROR_MESSAGES[code]` | danger | ✕ |

- `deleteMessage`·`deleteRoom`의 `NOT_FOUND`는 실패로 보지 않는다(F-CH-23·27). 인증·레이트리밋 행은 rooms §8.3과 같은 문구다.
- S3 생성 코드는 `design/generate.md` §3(옛 §8.4). 이 표의 행은 `speak`·`regenerate` 동작에도 그대로 걸린다(인증 3종·`RATE_LIMITED`·`NETWORK`·그 밖).
- 서버 `error.message`·토큰 값은 표시하지 않는다.
