# S3d server 리뷰 (verify-server-reviewer 최종 보고 원문) — 2026-10-07

> 메인 세션이 리뷰어 transcript(agent-a9a6950e3dd19f480.jsonl)에서 최종 보고를 그대로 옮긴 기록. 판정은 리뷰어의 것이다.

서버 리뷰: C 0 / H 0 / M 1 / L 3. S3d server 변경에 배포를 막을 결함은 없다. 판정 근거는 diff·소스·설계 대조이고, vitest·tsc·build는 다시 돌리지 않았다(기존 exit 0, 1143/1143 인용).

■ Phase 요약: 경계 0 / 비동기 1 / 에러 0 / DB 0 / LLM 2 / 기타 1

■ 중점 점검 8개 — 모두 설계와 일치
- select.ts는 순수 함수다. 외부 호출은 client.ts selectSpeaker 한 곳뿐이다.
- 예산 게이트(generate.ts:139)가 잠금·선택보다 먼저 실행된다.
- 화자 선택은 잠금 안에서 한다. 409면 AI 호출 0회다.
- 선택 실패는 기본 화자로 넘어가고 throw하지 않는다.
- 시간 합계는 15 + 51 = 66초다(LLM_TIMEOUT_MS 60000 기준). 70초 상한과 잠금 90초 안이다.
- toMessage는 응답만 투영하고 D1에는 실명을 그대로 저장한다.
- 기존 테스트 변경은 설계 범위 안이다.
- 에러 코드 추가 0건.

■ 이슈
[MEDIUM] SRV-001 server/src/llm/client.ts:148-202 — complete 함수가 55줄로 50줄 한계를 넘는다. 수정: server-manager.
[LOW] SRV-002 server/src/llm/select.ts:118 — mentionedSpeaker가 설계의 NFC 정규화 대신 trim()을 쓴다. NFD 한글은 이름 지목을 놓치고 모델 선택으로 넘어간다. 수정: server-manager.
[LOW] SRV-003 server/src/messages/generate.ts:141 — let pick에 가짜 초기값을 넣고 클로저에서 재대입한다. 경로가 바뀌면 오로그가 생길 수 있다. 수정: server-manager.
[LOW] SRV-004 shared/src/characters.ts, shared/src/types.ts — 작업 트리가 CRLF라 파일 전체가 diff로 잡힌다. 커밋 전 LF로 복원한다. 수정: contract-manager.

보안 관점은 security 리뷰어 참조.
