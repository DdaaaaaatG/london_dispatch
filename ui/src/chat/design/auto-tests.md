# chat 상세 설계 — S3d 기존 TC 영향 · 신규 TC (분할 문서, v1.9.1)

> 옛 `design/auto.md` §9. v1.9.1(2026-10-07)에 auto.md가 40KB 한계에 가까워 이 파일로 옮기고, 표를 **구현·스펙 실물**(ui 660/660)에 맞췄다. 절 번호는 auto.md 시절 그대로 §9.x로 둔다. 상세 시나리오는 ui-test-designer 소관(`ui/src/chat/test/scenarios.md` v0.8)이다. 이 파일은 설계가 정한 영향 범위와 실물 위치만 적는다.
> 요구·설계 정본: `ui/src/chat/requirements.md` v1.9 · `design/auto.md`(절 표기 `AU`). CR: `test/change-requests.md` CR-002.

---

## 9.1 기존 TC 변경 목록 (s3d-02 §6 확정 → scenarios.md 「변경 대기열」 Q-08 → 실물 반영)

| TC | S3d 전 단언 | S3d 단언(실물) | 스펙 파일(실물) |
|---|---|---|---|
| TC-CH-008 | `authorName=null` → `이름 없음` | `null`·`''` 두 값(`it.each`) → `어떠한 의지`(`USER_DISPLAY_NAME` import로 비교), `이름 없음` 없음 | `Bubble.test.tsx` |
| TC-CH-033 | `appendUser` 외 호출 0회(AI 호출 없음) | `appendUser('r1', { 안녕, false })` 1회 → **`speak('r1', { character: 'auto' })` 1회**. 가운데 유저 말풍선 `어떠한 의지` + 목록 끝 중립 "…" · 입력 비움·포커스 | `Composer.test.tsx` |
| TC-CH-034 | OOC 전송 → `appendUser(…, { ooc: true })` | 같음 + 목록 끝 중립 "…" · 전송 뒤에도 OOC 켬 · `speak('auto')` 1회(R-MSG-009) | `Composer.test.tsx` |
| TC-CH-036 | 응답 뒤 해제 | 저장 대기 중 전송 `disabled`·입력 `readOnly`·`aria-busy`, 클릭·Enter 연타 1회 → 저장 응답 뒤 `readOnly`·`aria-busy` 해제, **잠금은 유지** → speak 결과 뒤 해제. 같은 틱 클릭 2회 행은 불변 | `Composer.test.tsx` |
| TC-CH-038 | 전송 성공 → 맨 아래 / 배지 | 같음(T35가 T9 규칙). (a) 맨 아래 · (b) 위쪽 배지 두 행. speak는 영원히 대기 | `Composer.test.tsx` |
| TC-CH-063 | 늦은 쓰기 응답 무시 | **S3d 추가분**: 저장 대기 중 언마운트 → 저장 201 도착 → `speak` 0회, 콜백·`console.error` 0 | **`AutoReply.test.tsx`**(시나리오 작성자 결정. 기존 063 행은 원래 스펙 그대로) |
| TC-CH-075 | (b) 실패 말풍선 상태에서 유저 전송 성공 → 실패 말풍선 남음 | (b)만 변경: 실패 말풍선이 **사라지고 목록 끝은 중립 "…"**(T35 교체). (a)·(c) 불변 | `SpeakFlow.test.tsx` |
| TC-CH-088 | 전송은 AI 호출 없음 | **폐기 → TC-CH-098로 대체.** 스펙 자리에 폐기 주석만 남는다(클릭·Enter·OOC 켬 세 경로를 098이 맡는다) | `Composer.test.tsx`(주석) → `AutoReply.test.tsx` |
| TC-CH-090 | 실패 말풍선 중 전송 대기 → 「재시도」 disabled, 응답 뒤 활성 | 전송 대기 중 「재시도」·캐릭터 버튼 `disabled` → **저장 응답 뒤에도 캐릭터 버튼 `disabled`**(자동 응답 중) · 실패 말풍선이 중립 "…"로 바뀌어 「재시도」 없음 · `speak` 총 2회 | `SpeakFlow.test.tsx`. 부품 행(`isRetryDisabled` → 클릭 0회)은 `PendingBubble.test.tsx` 불변 |
| TC-CH-033 · 034 · 038 | 목록 `items()` 길이 5 | **6**(T35 중립 "…" `li` 1개 — speak 영원히 대기) | `Composer.test.tsx` |
| MessageList 부품 | 기본 props | 기본 props에 **`isEditSaveLocked: false`** 추가(필수 prop, AU §2.3). 단언 변경 없음 | `MessageList.test.tsx` |
| TC-CH-094 | 편집 중 버튼·재시도 disabled, 전송 활성 | 불변. 편집 중 전송의 결과는 TC-CH-107 | — |
| TC-CH-053 | T13~T16 | 기존 단언 불변 + **(S3d) 2행**: T13 `writeStarted send`는 이전 pending(중립·캐릭터 실패)을 같은 참조로 둔다 · T15 send 실패 `writeFinished` → 이전 pending 그대로 | `ui/src/state/chat.test.ts` |
| TC-CH-085 | T27~T34 | 기존 단언 불변 + **(S3d) 6행**: T27 `'auto'` · T27 이전 실패(캐릭터·중립) 교체 · T28 `'auto'` 거절 · T29 auto 생성 중 성공(`speaker=ciel`) · T31 중립 실패 · T33·T25 정리 · `canSpeak`(중립 실패만 있으면 true) | `ui/src/state/chat.test.ts` |
| 전송 경로 스펙 공통 | — | `@/api` mock의 `speak` 기본값 = **영원히 대기**(Promise 미해결) 헬퍼. **`Composer.test.tsx`·`SpeakFlow.test.tsx`에만** 둔다(시나리오 작성자 결정 — `AuthTransition`·`BubbleMenu`·`Regenerate`·`ChatScreen` 스펙에는 저장 성공 TC가 없어 불필요) | `Composer.test.tsx` · `SpeakFlow.test.tsx` |
| TC-CH-040 · 079 | 메뉴 머리 이름 | fixture `authorName`이 값이라 불변(스펙 변경 없음). `null` 케이스는 TC-CH-108이 맡는다 | `BubbleMenu.test.tsx`(변경 없음) |

## 9.2 신규 TC (TC-CH-098 ~ 109) — 실물 위치

| TC | 이름 | 요구 | 종류 | 핵심 단언 | 스펙 파일(실물) |
|---|---|---|---|---|---|
| TC-CH-098 | 전송 → 자동 응답 호출 | R-CHAT-006 🔒 · 014 🔒 | 자동 | 클릭·Enter·OOC 켬 각각: `appendUser` 1회 resolve **뒤에만** `speak('r1', { character: 'auto' })` 1회. 캐릭터 값 speak·regenerate 0회 | `AutoReply.test.tsx` |
| TC-CH-099 | T35 한 커밋 | R-CHAT-014 🔒 · 002 🔒 · 013 | 자동 | S1 잠금·`readOnly`·`aria-busy` → 저장 201 한 커밋에 유저 말풍선(`어떠한 의지`) + 중립 "…"(`pending`·`neutral`, 화자 클래스·`img`·이름·시각 없음, `role=status` 숨은 안내 `응답을 만드는 중`) · 잠금 속성 변화 0회 · 입력 비움·타이핑 가능. **부품**: 중립 생성 중 DOM 2행. **순수**: T35 4행 · T36 · T35 직후 `canSend`·`canSpeak` false · `speakingCharacterOf` | `AutoReply.test.tsx` · `PendingBubble.test.tsx`(부품) · `state/chat.test.ts`(순수) |
| TC-CH-100 | 결과 자리 2종 | R-CHAT-014 🔒 · 002 🔒 · R-MSG-009 | 자동 | `speaker:'sebastian'` → `character sebastian` · `'ciel'` → `character ciel` · `.pending` 0 · 잠금 해제 · 포커스 이동 없음. (c) 자동으로 고른 대사도 메뉴 「재작성」 = `regenerate(그 id)` 1회 | `AutoReply.test.tsx` |
| TC-CH-101 | 저장 실패 → AI 0회 | R-CHAT-006 🔒 · 011 | 자동 | 저장 실패 코드별 → `speak` 0회 · 입력 유지 · S2 규칙(토스트·`TOKEN_INVALID` 전환) · 중립 없음. 이전 캐릭터 실패 말풍선은 그대로(교체 없음) | `AutoReply.test.tsx` |
| TC-CH-102 | 중립 실패 | R-CHAT-014 🔒 · 011 · 005 | 자동 | speak(auto) 실패 코드별 → 같은 자리 `pending neutral failed` · `role=alert` = `speakErrorText` · 「재시도」(이름 `응답 재시도`) · 유저 말풍선 남음 · 토스트 없음 · 잠금 해제 · 포커스 이동 없음. **부품**: 코드별 DOM · `isRetryDisabled` → 클릭 0회 | `AutoReply.test.tsx` · `PendingBubble.test.tsx`(부품) |
| TC-CH-103 | 중립 재시도 | R-CHAT-014 🔒 · 013 | 자동 | 「재시도」 → 포커스 히스토리 log → `speak('r1', {auto})` 2번째 · 같은 자리 중립 "…" · 유저 말풍선 추가 0 → 응답 뒤에도 포커스 log | `AutoReply.test.tsx` |
| TC-CH-104 | 끼어들기 0회 | R-CHAT-014 🔒 | 자동 | 저장 대기(같은 act 클릭 포함) · 저장 응답 직후 같은 act · 생성 대기 중 캐릭터 버튼·전송·Enter → `speak` 총 1회(`'auto'`) · `appendUser` 1회 | `AutoReply.test.tsx` |
| TC-CH-105 | 중립 실패에서 나가는 길 | R-CHAT-014 🔒 · 005 | 자동 | (a) 중립 실패 → 「시엘」 → 시엘 임시 말풍선 · (b) 새 전송: 저장 대기 중 중립 실패 유지·「재시도」 disabled → 201 → 새 유저 말풍선 + 새 중립 "…" | `AutoReply.test.tsx` |
| TC-CH-106 | 자동 응답 인증·방 없음 · 토큰 없음 | R-CHAT-014 🔒 · 011 · 008 | 자동 | speak(auto) 인증 실패 → 읽기 전용 전환 · `NOT_FOUND` → `ld:lastRoomId` 삭제 후 `onBack` 1회 · 토큰 없음 → 하단 바·중립·「응답 재시도」 DOM 없음, 호출 0회 | `AutoReply.test.tsx` |
| TC-CH-107 | 편집 중 전송(D-17) | R-CHAT-006 🔒 · 014 🔒 · 007 | 자동 | 편집기 열린 채 전송 → speak(auto) 1회 · 편집기 유지 · 생성 중 **저장만 `disabled` + `aria-describedby` 안내** · 취소·입력 활성 → 생성 끝 저장 활성·안내 미렌더 · 편집기 열린 동안 캐릭터 버튼 계속 `disabled`(DC-10). 생성 중 「취소」 행. **부품**: InlineEditor `isSaveLocked` true/false 쌍 | `AutoReply.test.tsx`(부품 행 포함) |
| TC-CH-108 | 작성자 표기 | R-CHAT-002 🔒 · R-AUTH-004 🔒 | 자동 | 순수 `userAuthorLabel` 4케이스 · 말풍선·메뉴 머리 같은 규칙 · 토큰 없음에서도 같은 규칙 | `AutoReply.test.tsx` |
| TC-CH-109 | 390×565 스크린샷 2종 | R-CHAT-013 · 014 🔒 | 수동 | 자동 생성 중 · 자동 실패. 구성안 §2.2·§2.4와 대조 | `test/manual-checklist.md` MC-CH-19 |

## 9.3 시나리오 작성자 결정 · 설계 대조 (v1.9.1)

| 결정(시나리오 작성자) | 설계 쪽 판단 |
|---|---|
| T36(`sendSucceeded`가 send 중이 아닐 때 같은 참조)은 **순수 함수 행으로만** 검증한다 | 설계와 일치. F-CH-17 ⑥의 T36 분기는 도달 불가 방어(AU §3)라 화면 TC로 재현할 경로가 없다 |
| 편집기가 열린 채 **S1 저장 대기 중**의 편집 저장 버튼 상태는 단언하지 않는다 | 설계 값은 `design/generate.md` §6 「편집 버튼 잠금」 표 `send` 행이다: 저장 버튼은 내용이 유효·변경이면 **활성으로 보이고, 눌러도 `begin`이 거절**한다. 숨은 안내는 없다(`isEditSaveLocked` = `writing?.kind === 'speak'`이므로 S1에서는 false). 실물(`InlineEditor` `canSave` 식 · `useWriteGate.begin`)이 이 값과 같다. 미단언은 설계 결함이 아니다 |
| "영원히 대기" 헬퍼는 Composer·SpeakFlow에만 | 위 9.1 공통 행에 반영 |
| TC-CH-063 S3d 추가분은 `AutoReply.test.tsx` | 위 9.1 TC-CH-063 행에 반영 |

## 변경이력

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v1.9.1 | 2026-10-07 | auto.md §9에서 분리. 9.1 스펙 파일 열을 실물로(TC-CH-063 → AutoReply · 038 Composer만 · 공통 헬퍼 Composer·SpeakFlow만 · MessageList 기본 prop 행 추가 · 053·085 S3d 추가 행 실물). 9.2에 실물 위치 열. 9.3 시나리오 작성자 결정 대조 신설 | S3d 구현 완료(ui 660/660) · 시나리오 v0.8 |
