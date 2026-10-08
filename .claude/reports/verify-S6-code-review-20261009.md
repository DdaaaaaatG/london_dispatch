# S6 코드 리뷰 (verify-code-reviewer) — 2026-10-09

- 대상: c6a5531~1..09ae730 화면 변경(방 비밀번호 잠금 S6) — ui/src/{rooms,chat,components/roomEntry,components/ui/{PromptSheet,TextInput},components/utils/storage.ts,state/{roomKeys,limits}.ts,api/*,main.tsx}, shared/src/*
- 근거 문서: ui/src/rooms/design.md·design/lock.md, ui/src/chat/design.md·design/lock.md, doc/200_설계/contract/api.md
- 판정: **APPROVE** — `CR: C0 H0 M0 L0`

## Stage1 (design.md 대비): 누락 0 · 과잉 0 · 계약 불일치 0
- rooms F-RM-30~52, chat F-CH-63~85 전부 소스 대응. ROOM_LOCKED 수렴 경로(읽기 2·쓰기 전부·speak·장기기억·방 쪽 실패 갈래), 조용한 재입장 상한 2(D-55), 잠금 걸기/바꾸기/풀기, 방 삭제 뒤 증명 삭제(F-CH-81).
- api 래퍼 시그니처가 api.md §11.18·§2.8.5·shared/src/types.ts와 일치(enterRoom auth:true, 메시지 id 래퍼 roomId 필수, CreateRoomResponse·SetRoomPasswordResponse).

## Stage2 (품질): ts 0 / tsx 0 / golden 0 / 경계 0 / 토큰 0 / 390px 0 / 접근성 0
- eslint ui/src shared/src(--fix 없음) 출력 0줄 — react-hooks/refs 0.
- fetch는 ui/src/api/client.ts:118 1곳. 화면 '/api/' 조립 0. state 순수 TS.
- localStorage 접근은 components/utils/storage.ts:15,23,31뿐. 신규 키 `ld:roomKeys`(입장 증명, R-LOCK-007 허용). 토큰 저장 0, console 0. X-Room-Key는 client.ts:75-76 헤더로만.
- 토큰 없으면 쓰기 UI 미렌더(rooms/index.tsx:189-194, chat/index.tsx:189,217, LockedRoomView.tsx:35,39).
- ref는 useLayoutEffect에서만 갱신, 렌더 중 ref 접근 0. 최대 파일 useChatSheets.ts 304줄, 50줄 초과 함수 0.
- 390px: 고정 폭 > 390 없음. 접근성: 자물쇠 SVG aria-hidden, 비밀번호 aria-label·aria-invalid, 실패 role=alert.

## 이슈
없음.
