# S6 서버 리뷰 (verify-server-reviewer) — 2026-10-09

- 대상: c6a5531~1..09ae730 server 변경(방 비밀번호 잠금 S6 + TOKEN_MIN_LEVEL 2) — src·migrations/0005·wrangler.toml·.dev.vars.example
- 요약: `SRV: C0 H0 M1 L3` — 배포 차단 결함 없음
- Phase: 경계 0 / 비동기 0 / 에러 0 / DB 0 / LLM 0 / 공통(크기·문서) 4

## 이슈
| 심각도 | 코드 | 위치 | 내용 | 라우팅 |
|---|---|---|---|---|
| MEDIUM | SRV-001 | server/src/services.ts:67-157 | `createServices` 91줄 > 50줄 한계. S6 이전 약 78줄에서 15줄 증가(auth 분리·entrySecretMemo·rooms deps). llm 팩토리(77-106)·auth/rooms 조립을 이름 붙은 함수로 분리 | server-manager |
| LOW | SRV-002 | server/wrangler.toml:10-11, server/src/env.ts:163, doc/200_설계/server/env.md:329 | 머리 주석 "값은 env.ts 기본값과 같다"인데 TOKEN_MIN_LEVEL [vars]=2, env.ts 기본=5, env.md 표 "5". 운영 동작 영향 없음 | server-manager |
| LOW | SRV-003 | doc/handoff/cloudflare-setup.md:152-169 | §7 마이그레이션 표가 0001~0004만, 0005 누락. 0005 없이 배포하면 방 목록·방 생성·관문 붙은 모든 방/메시지/memory 라우트 500 | contract-manager |
| LOW | SRV-004 | server/src/rooms/entry.ts:15 | `ROOM_NOT_FOUND_MESSAGE`가 rooms/service.ts:67과 중복 정의 | server-manager |

## 문제없음 확인
- 경계: ROOM_ENTER_LIMIT_PER_MIN이 env.ts·ENV_KEYS·Config·[vars]·.dev.vars.example 일치. tokenSecret 값 주입. rooms→auth 직접 import 없음(hitEnterLimit 주입). auth/room-entry→rooms는 type import만. llm 변경 없음.
- 비동기: enter ①~⑦ 설계 순서 그대로, 비밀번호 없음(④) 미계수, 계수(⑤)가 해시(⑥) 앞. D1 rate_limits 조건부 UPSERT(`enter:{roomId}`). entrySecretMemo는 요청 지역. 미처리 promise 없음. speak·regenerate 관문이 잠금 선점 앞.
- 에러: optionalToken은 TOKEN_REQUIRED·TOKEN_INVALID·LEVEL_TOO_LOW만 삼킴, next()는 try 밖. 새 코드 전부 AppError. 라우트 30줄 이하.
- D1: 새 SQL 전부 `?N` 바인딩. setPassHash 한 batch. 새 조회 PK 기준(인덱스 불필요). 0005는 ADD COLUMN … CHECK, 기존 행 NULL 통과. 관문 누락 라우트 없음(PATHS 전수 대조).

## 운영 D1 마이그레이션 · 되돌리기 경고
- 운영 D1에 0005 적용 필요. **`wrangler d1 migrations apply --remote` → `wrangler deploy` 순서 필수.**
- 0005 적용 뒤 이전 코드로 롤백(Cloudflare 버전 롤백 포함)하면 잠긴 방이 모두 열린다(칸·해시는 남아 재배포 시 복구). 버전 롤백은 [vars]도 되돌려 TOKEN_MIN_LEVEL이 10으로 돌아가므로, 그 사이 PHP가 2면 등급 2~9 회원 쓰기가 403. DROP COLUMN 금지.
- 새 PHP(RB_CHATBOT_LEVEL 2)는 S6 배포 확인 뒤 전달.

## security 참조
- E17 입장 상한이 방 단위·토큰 없이 호출 가능 → 익명 5회/분으로 해당 방 정상 입장 방해 가능(판정은 security).
