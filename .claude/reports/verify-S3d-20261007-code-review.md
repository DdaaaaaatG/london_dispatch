# S3d code 리뷰 (verify-code-reviewer 최종 보고 원문) — 2026-10-07

> 메인 세션이 리뷰어 transcript(agent-af9a01a499585f16b.jsonl)에서 최종 보고를 그대로 옮긴 기록. 판정은 리뷰어의 것이다.

판정: APPROVE (C 0 / H 0 / M 0 / L 3). LOW 3건은 COMMENT로 첨부한다.

S3d 미커밋 화면 변경은 ui/src/chat/design/auto.md를 빠짐없이 구현했고, 요구 범위를 넘는 기능도 없다. 리뷰는 소스와 문서를 읽어서만 했다. tsc·lint·vitest·build는 다시 돌리지 않았고, 위임문이 전한 결과(모두 exit 0, vitest 1143/1143)를 그대로 받았다.

■ Stage1: 누락 0, 과잉 0, 계약 불일치 0
- **RTM:** R-CHAT-014·006·002가 소스와 TC-CH-098~108로 이어진다. 테스트 위치는 AutoReply.test.tsx·state/chat.test.ts·PendingBubble.test.tsx·Composer.test.tsx·Bubble.test.tsx다. TC-CH-109는 수동 항목(MC-CH-19)이다.
- **계약:** ui/src/api/messages.ts:39 speak가 보내는 SpeakBody.character가 SpeakTarget(CharacterId | 'auto')으로 넓어져 api.md §4.13·§5.2와 일치한다. USER_DISPLAY_NAME은 §5.5와 같다.
- **sendSucceeded 원자성: 통과.**
  - onSendSucceeded가 메시지 추가, writing을 speak('auto')로, pending을 중립 생성 중으로 바꾸는 일을 한 번의 상태 갱신으로 처리한다.
  - useSend는 성공 경로에서 release()를 부르지 않고, useRunSpeak가 응답 뒤에 잠금을 푼다.
  - 그 사이 쓰기는 begin(useMessageWrites.ts:76)과 메뉴 가드(useChatSheets.ts:47·146)에서 거절된다. 끼어들 경로는 0이다.
- **pending('auto') 공존: 통과.**
  - 캐릭터 버튼과 재시도는 canSpeak로 잠긴다.
  - 편집 시작은 canSend가 필요해 생성 중에는 막힌다.
  - 재작성·삭제는 begin에서 거절된다.
  - 성공·실패·폐기 전이는 'auto'여도 같은 규칙으로 동작한다.
  - 읽기 전용이면 렌더하지 않는다.
- **InlineEditor isSaveLocked: 통과.**
  - 저장 버튼만 disabled다.
  - 취소·입력·Esc는 활성이다.
  - 숨은 안내가 useId로 aria-describedby와 연결되고, TC-CH-107이 이를 확인한다.

■ Stage2: ts 1 / tsx 1 / golden 0 / 경계 0 / 토큰 0 / 390px 0 / 접근성 0
- 화면 소스에서 fetch 직접 호출, '/api/' 조립, 토큰 저장, console, any 모두 0건이다.
- 파일은 최대 302줄, 함수는 최대 48줄이다. 상태는 전개 복사로만 바꾼다.

■ 이슈
[LOW] CR-001 shared/src/types.ts · shared/src/characters.ts — 작업 트리 줄바꿈이 CRLF다(git ls-files --eol 결과 i/lf w/crlf, .gitattributes 없음)
  실제 변경은 7줄인데 diff에서는 파일 전체가 바뀐 것으로 나온다. 커밋 전에 LF로 되돌려야 한다. manual.md도 같은 상태다(참고).
  라우팅: contract-manager

[LOW] CR-002 ui/src/chat/components/InlineEditor.tsx:32-41 useDescribedBy — 공용 Button에 prop이 없어 ref로 aria-describedby를 직접 거는 우회
  결함이 아니라 부채다. Button은 늘 같은 <button> 하나를 그리고, React가 이 속성을 관리하지 않으며, layout effect에서 걸고 cleanup에서 지운다. 테스트가 있고 설계 D-23에 기록돼 있다.
  조치 방향: Button에 ariaDescribedBy?를 추가한 뒤 이 훅을 제거한다.
  라우팅: ui-postprocessor

[LOW] CR-003 ui/src/chat/index.tsx:82 — 저장 중(send)과 재작성 중에는 편집 저장 버튼이 활성으로 보이지만 눌러도 begin이 조용히 거절한다
  설계 D-17대로라 결함은 아니고 관찰이다. 잠금 범위를 넓힐지는 사용자 결정이 필요하다.
  라우팅: (결정 시) ui-designer → ui-debug

■ False Positive 제외
- useSend의 사전 계산: 네트워크 대기 뒤에 실행되므로 그때 상태가 최신이다.
- useRetrySpeak의 포커스 선이동: 거절 경로에서는 「재시도」 버튼이 disabled다.
- ld:lastRoomId·ld:scroll 저장: R-CHAT-010이 허용한 것이고 토큰이 아니다.
- api.test.ts:349: @ts-expect-error를 쓴 의도된 음성 테스트다.
- 서버는 verify-server-reviewer, 보안은 verify-security-reviewer 참조.

파일: D:\woon\pr\bbs_action_sample\london_dispatch\ui\src\state\chat.ts, ...\ui\src\chat\useMessageWrites.ts, ...\ui\src\chat\index.tsx, ...\ui\src\chat\components\InlineEditor.tsx, ...\shared\src\types.ts, ...\shared\src\characters.ts
상태: 완료
