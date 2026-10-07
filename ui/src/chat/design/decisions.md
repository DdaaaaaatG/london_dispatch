# chat 상세 설계 — 설계 결정·가정 · 공용화 후보 · contract 변경 요청 (분할 문서, v2.0.3)

> 주 문서: `ui/src/chat/design.md`. v1.7에서 40KB 한계로 주 문서 §11.2 · §13을, v2.0.3(2026-10-07)에서 §12 공용화 후보를 이 파일로 옮겼다(주 문서 실측 41,569바이트). 절 번호는 그대로 쓴다.
> S3 결정 D-11~D-15·A-6과 S3 한계 L-1~L-3은 `design/generate.md` §4·§5.

## 11.2 설계 결정·가정 · S1 실물 소급 델타 (v1.4)

| # | 내용 |
|---|---|
| C-1 | 상단 바 조립을 로컬 컴포넌트 `ChatTopBar`로 분리(components.md §2.0). S2 `onOpenMenu`·`menuButtonRef` 추가 |
| C-2 | 스크롤 저장 effect를 `useScrollMemory(roomId, getDistanceFromBottom)`로 분리(F-CH-09). 의존 `[roomId, getDistanceFromBottom]` |
| C-3 | 마운트 effect는 `useLayoutEffect([room.id, loadInitial])`(설계 v1.3은 `useEffect([])`). 자동 진입 커밋 직후 요청이 나가게 한다(F-CH-02) |
| C-4 | `useChatLoader`의 `stateRef` 갱신·활성 플래그는 `useLayoutEffect`(설계 v1.3은 `useEffect`). 첫 로드보다 먼저 활성이 켜져야 한다 |
| C-5 | `renderHistory`는 props 객체 `HistoryProps`를 받는다. 오류 상세는 `errorDetail(state.error?.code ?? 'INTERNAL')` |
| C-6 | ref 타입은 React 19 `RefObject<HTMLDivElement \| null>`(MessageList·useAutoScroll) |
| C-7 | `useAutoScroll.isNearBottom()`은 측정 전(metrics null)이면 `true` |
| C-8 | Bubble은 지역 컴포넌트 `CharacterBubble`·`UserBubble`·`OocBubble`·`SentTime`, MessageList는 지역 `OlderStatus`로 나뉜다(출력 동일). `nextBefore`는 `hasMore ? (messages[0]?.id ?? null) : null` |
| D-5(결정, S2) | 메시지 쓰기는 `writing` 하나로 직렬화한다. 전송·수정 저장·삭제가 동시에 나가지 않는다. 디바운스 없음, 상태 기반 |
| D-6(결정, S2) | 메시지·방 삭제의 `NOT_FOUND`는 "이미 없음 = 목표 상태"로 보고 성공과 같은 흐름을 탄다 |
| D-7(결정, S2) | 시트가 열린 채로 토스트를 띄우지 않는다. 이름 변경의 비인증 실패는 시트 안 문구, 확인 시트 실패는 시트를 닫은 뒤 토스트 |
| D-8(결정, S2) | 인증 실패 전환 안내 = E 토스트 1회(2초, `role=alert`) + D 상시. 되돌리기는 새로 고침뿐 |
| A-4(가정, S2) | E 줄은 in-flow라 토스트가 있는 2초 동안 히스토리가 28px 줄어든다(구성안 "하단 바 바로 위 28px" 그대로). 맨 아래 내용이 그만큼 가려졌다가 돌아온다 |
| D-9(결정, v1.5) | 읽기 전용 **전환 직후** E 토스트 1회는 허용한다. 구성안 §2 "읽기 전용 DOM 부재: E"는 **토큰 없이 시작한 경우**로 한정한다(그 경우 E 발생 경로가 없다). 구성안 파일 주석은 메인 세션 몫. 근거: 메인 세션 결정 DC-01 |
| D-10(결정, v1.5) | 메시지 쓰기(`writing`)나 방 쓰기(`roomBusy`)가 대기 중이면 말풍선 메뉴·⋯ 메뉴를 열지 않는다(⋯는 `isDisabled`, 말풍선 메뉴는 F-CH-18이 무시). 그래서 쓰기는 화면 전체에서 한 번에 하나다. 인증 실패 처리(F-CH-16)는 멱등이라 늦게 온 두 번째 인증 실패도 전환·안내를 다시 하지 않는다. 근거: 검증 DC-05 |
| D-11~D-15 · A-6(S3) | `design/generate.md` §4 — PendingBubble 분리 · speak 실패는 말풍선 하나 · 재작성 실패는 토스트 · 잠금은 `canSend`(전송)·`canSpeak`(생성) · `NOT_LAST_MESSAGE` 재조회는 `loadInitial` · 화면 타이머 없음 |
| A-5(가정, S2) | 방 삭제 뒤 언마운트 저장으로 `ld:scroll:{지운 방 id}`가 남을 수 있다. UUID라 재사용되지 않아 무해하다. 정리 함수는 요구가 없어 만들지 않는다 |

## 12. 공용화 후보 (v2.0.3 주 문서에서 이전)

| 후보 | 현재 위치 | 판정 |
|---|---|---|
| `useAutoScroll` | 공용 훅 | 화면 비종속. 공용 |
| S2 공용 부품(TextArea·Toggle·BottomSheet·ConfirmDialog·PromptSheet·Toast·useToast) | 공용 | rooms design.md §13 판정 인용. `useLongPress`는 삭제됨(S3e 후작업 2026-10-07) |
| `InlineStatus` | chat 로컬 | 사용처 chat뿐. 후보 아님 |
| `Composer`·`InlineEditor`·`RoomMenuSheet`·`ChatSheets`·`NewMessageBadge`·`ReadOnlyNotice`·`Bubble`·`MessageList`·`ChatTopBar` | chat 로컬 | chat 전용(메시지·방 의미를 안다). 후보 아님 |
| `writeErrorText` 인증·`NETWORK` 행 | **공용 `ui/src/components/utils/errorText.ts`** | **공용화 완료(후작업 2026-10-07)** — rooms design.md §13. 레이트리밋 행은 chat `labels.ts`에 남는다 |
| (S3) `SpeakButtons`·`PendingBubble`·`speakErrorText` | chat 로컬 | 캐릭터·생성을 안다, 사용처 chat뿐. 후보 아님 |
| (S3) `useAutoScroll` `tailKey` | 공용 훅 | 메시지 타입을 모르는 문자열 키라 비종속 유지 |
| (S3d) 공용 `Button`에 `ariaDescribedBy?: string` prop 추가 | 공용(`ui/src/components/ui/Button`) | **해소 2026-10-07(후작업).** 공용 Button에 `ariaDescribedBy?: string`이 생겼다(rooms components.md §1.2). `InlineEditor.tsx`는 지역 훅 `useDescribedBy`를 지우고 저장 버튼에 `ariaDescribedBy={isSaveLocked ? noteId : undefined}`를 넘긴다(AU §8 D-23 해소) |
| (S3d) `.srOnly` 규칙 | `PendingBubble.module.css` · `InlineEditor.module.css` 지역 | 같은 규칙이 두 모듈에 있다. 사용처 chat뿐이라 지금은 후보 표시만(전역 유틸 없음, components.md §2.12) |
| (S3e) 공용 `Button` ghost 글자색 톤(`tone?: 'muted' \| 'danger'` 등) | 공용(`ui/src/components/ui/Button`) | **후보(후작업 ui-postprocessor).** 지금은 `BubbleActions.module.css`가 자손 선택자로 덧칠한다(AC §10 D-25 「우회」). prop이 생기면 덧칠·`danger` 래퍼를 지운다 |
| (S3e) `useLongPress` | 공용 훅 | **삭제됨(S3e 후작업 2026-10-07).** S3e로 사용처 0(chat 삭제, rooms 미사용)이 되어 후작업이 훅과 스펙을 지웠다(AC D-32). `component-catalog` 사용처 표기는 메인 세션 몫(AC D-29) |
| (S3e) `BubbleActions` | chat 로컬 | 메시지·화자를 안다, 사용처 chat뿐. 후보 아님 |

## 13. contract 변경 요청 (설계에 끼워 넣지 않음)

| # | 대상 | 요청 | 이유 | 막는 것 |
|---|---|---|---|---|
| CR-C-1 | api.md §5.5 `shortName` | (S1) | R-LLM-002 개정 | **반영 완료**(v0.2) |
| CR-C-2 | api.md §5.2 · `shared/src/` | 길이 한도(60·2000)와 trim 후 코드 포인트 세기를 shared 상수·함수로 | ui `ui/src/state/limits.ts`와 서버가 같은 숫자를 따로 가진다 | **없음**(권고, rooms design.md §12와 같은 건) |
| (S3) | — | **계약 변경 요청 없음.** v0.4 E9·E12·§11.9 래퍼로 S3 요구를 다 담는다 | — | — |

### 13.1 S3 알려진 한계 → `design/generate.md` §5

L-1 speak `NETWORK`·`INTERNAL` 뒤 「재시도」 중복 가능(수용, 재조회 후 재시도는 추가 후보) · L-2 regenerate 같은 경우 화면 본문이 늦게 맞춰짐 · L-3 응답이 끝내 오지 않으면 임시 말풍선이 남음.
