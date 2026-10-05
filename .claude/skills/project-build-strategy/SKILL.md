---
name: project-build-strategy
description: 초기 요구조건을 받아 server(Cloudflare Workers 서비스)→contract(API 계약)→ui(iframe 화면)를 한 흐름으로 구축하는 구축(build) 파이프라인의 단일 소스. 구축/보강 판별과 정지·라우팅, 요구 정규화(요구ID·🔒 사용자 지정), 화면 2개·모듈 6개 분해와 범위 상한, 종단간 RTM 양식, 계층 실행 순서, 승인 게이트 2회(요구확정·설계묶음), 진행 상태 파일(doc/state.json)과 재개 절차, 완료 정의를 정의한다. 계층 세부 규칙은 server/contract/ui-design-strategy를 참조하며 재정의하지 않는다. task-manager가 preload한다. "처음부터 만들어줘", "요구조건으로 기능 구축" 시 참조한다.
---

# 구축(build) 파이프라인 전략

- 목적: **초기 요구조건 1건**을 받아 server→contract→ui→테스트→매뉴얼까지 한 흐름으로 완결한다.
- 적용: `task-manager`(메인 세션). 계층 규칙은 `server-design-strategy`·`contract-design-strategy`·`ui-design-strategy`·`verify-strategy`를 **참조**한다(재정의 금지). 제품 규격은 `doc/000_프로젝트_확정사항.md`.
- 이 스킬이 정의하는 것은 **순서·게이트·추적**뿐이다.

## 1. 구축/보강 판별 (최우선)

| 신호 | 판정 |
|---|---|
| 대상 모듈(`server/src/{env.ts,db,auth,rooms,messages,memory,llm}`)·계약(`doc/200_설계/contract/api.md`)·화면(`ui/src/rooms`,`ui/src/chat`)이 **없다** · "새로 만들어/구축해줘" | **구축(build)** → 이 파이프라인 |
| 대상이 **이미 있다** · 버그·동작 개선·기능 추가·계약 변경 반영 | **보강(maintain)** → **정지·라우팅** |

**보강 라우팅 표**

| 요구 | 라우팅 |
|---|---|
| 기존 화면 버그·"고쳐줘" | `ui-debug` |
| 기존 화면 개선·화면 추가·컴포넌트 | `ui-manager` |
| 엔드포인트·토큰·handoff 계약 변경 | `contract-manager` |
| 서비스·DB·LLM 어댑터·프롬프트 | `server-manager` |
| 두 계층 이상·speak 파이프라인·계약 파괴 변경 | `system-architect` |
| 문서 동기화 | `/doc-sync` |

- 애매하면 **추측 금지** — "신규 구축인가요, 기존 보강인가요?"로 확정한다.
- 판별 결과·근거를 작업 개시 보고에 명시한다.

## 2. 범위 상한

- 한 실행 = **요구 1건(피처) 단위**. 예: "방·메시지 저장과 읽기 전용 대화 화면", "토큰 쓰기 권한 + speak".
- 화면은 **rooms·chat 2개**가 전부다. 모듈은 **env·db·auth·rooms·messages·memory·llm 6개**(env는 진입점이라 모듈 수에서 뺀다)가 상한. 요구가 이 밖의 화면·모듈을 만들려 하면 확정사항 §4 위반 — 사용자에게 확정사항 변경을 먼저 묻는다.
- 여러 피처 요구가 들어오면 목록화 → 우선순위 확인 → **한 건씩** 실행한다. 권장 순서: ① env·db·rooms·messages 저장 + 읽기 전용 화면(rooms·chat 히스토리) ② auth 토큰 + 쓰기 엔드포인트(user·방 생성·수정·삭제) + 쓰기 UI ③ llm·speak·regenerate ④ memory 요약 + 편집 UI ⑤ handoff·배포.

## 3. 요구 정규화

- **요구ID**: `R-{영역}-{일련}`. 영역 = `ENV`·`DB`·`AUTH`·`ROOM`·`MSG`·`MEM`·`LLM`(server) · `API`·`TOKEN`·`HANDOFF`(contract) · `ROOMS`·`CHAT`(ui). 예: `R-MSG-003`, `R-CHAT-007`.
- **`🔒 사용자 지정`**: 사용자가 직접 말한 요구는 표시해 최우선 보존한다(임의 삭제 금지). 확정사항 문서의 §1·§3·§4·§5 값은 전부 🔒다.
- **분해**: 요구 → 화면 요소(rooms/chat) × 엔드포인트 × server 모듈 × env 키. 하나로 뭉개지 않는다.
- **비기능 요구**도 ID를 받는다(speak 응답 ≤ 70초 타임아웃 포함, 히스토리 첫 로드 ≤ 1초, 동시 생성 거절 등). 측정 방법을 함께 적는다.
- 산출: `doc/100_요구조건/requirements.md`.

## 4. 종단간 RTM 양식

| 요구ID | 요구 요약 | ui(화면·요소) | contract(엔드포인트) | server(모듈·함수) | env 키 | 테스트ID | 상태 |
|---|---|---|---|---|---|---|---|
| R-MSG-002 | 🔒 세바스찬 버튼 → 세바스찬 1턴 생성 | chat: SpeakButton | `POST /api/rooms/:id/speak` | messages.speak · llm.prompt | LLM_PROVIDER, LLM_API_KEY | SRV-T-012, API-T-008, TC-CH-015 | 설계/구현/완료 |

- Phase 1에서 초안, Phase 2에서 확정, Phase 4에서 **전건 충족 대조표**로 닫는다.
- 요구ID가 어느 열에서든 끊기면 미완이다(빈 칸 금지 — 해당 없음은 `-`).
- 산출: `doc/100_요구조건/rtm.md`.

## 5. 실행 순서와 승인 게이트

| Phase | 내용 | 위임 | 게이트 |
|---|---|---|---|
| 0 | 진입 판별(구축/보강·범위·재개) | — | 보강이면 정지 |
| 1 | 요구 확정·분해·RTM 초안 | — (직접 작성) | **승인 ①** |
| 2 | 설계 묶음 | `server-designer` → `contract-designer` → `ui-layout-designer` → `ui-designer` → `ui-design-checker` | **승인 ②** |
| 3 | 구현·테스트 | `server-implementer`(모듈별 순차) → `contract-implementer` → `ui-test-designer`(+`ui-test-checker`) → `ui-implementer` → `ui-tester` | 없음(자동) |
| 4 | 마감 | `ui-manual-writer` + 대조표 | 없음 |

- **승인은 2회뿐이다.** 계층별 개별 승인을 받지 않는다(핑퐁 방지 — server+contract+ui 설계를 한 묶음으로 확정).
- 승인 ② 미리보기 구성: **server 모듈 요약(공개 함수·env 키) → 계약(엔드포인트 표·에러 코드) → 토큰 형식·handoff 전달물 → 화면 레이아웃·api 호출 → 필요 의존성 목록 → RTM → 예상 소요시간**.
- 깊은 계층 먼저(server→contract→ui). 왕복 금지.
- Phase 3 테스트 실패 → `ui-implementer` 재호출(실패 TC·원인 명시) 후 `ui-tester` 재검증, **같은 TC 3회 실패면 중단·보고**.
- Phase 4 이후 `verify-manager`는 **별도 세션**으로 안내한다.

## 6. 문서 소유 경계

| 산출물 | 소유 |
|---|---|
| `doc/100_요구조건/requirements.md`·`rtm.md`·`doc/state.json` | **task-manager** |
| `doc/200_설계/server/{module}.md` | `server-designer` |
| `doc/200_설계/contract/api.md`·`doc/handoff/*` | `contract-designer` |
| `ui/src/{screen}/requirements.md`·`design.md` | `ui-designer` (단일 소유 — 침범 금지) |
| `ui/src/{screen}/test/scenarios.md` + vitest 스펙 | `ui-test-designer` |
| `ui/src/{screen}/manual.md` | `ui-manual-writer` |
| TS 소스, `server/wrangler.toml`·`server/migrations/*.sql`·`server/.dev.vars.example` | 각 implementer (server 설정 3종은 server-implementer) |
| 루트 `package.json`·tsconfig·의존성 설치 | 메인 세션 (task-manager는 훅이 차단) |

## 7. 진행 상태 파일 (재개용)

경로: `doc/state.json`

```json
{
  "slug": "chat-readonly",
  "phase": "3-implement",
  "scope": { "requirements": ["R-DB-001", "R-ROOM-001", "R-CHAT-001"], "screens": ["rooms", "chat"], "modules": ["db", "rooms", "messages"] },
  "approvals": { "requirements": "2026-10-06T10:00:00", "design": "2026-10-06T11:20:00" },
  "completed": { "server": ["db", "rooms"], "contract": "pending", "ui": [] },
  "dependencies_approved": ["hono@4", "@hono/zod-validator", "zod@3", "wrangler", "@cloudflare/workers-types", "@cloudflare/vitest-pool-workers", "vitest@2"],
  "next": "server-implementer 위임(messages)",
  "blockers": [],
  "estimate_min": 90, "actual_min": null
}
```

- 각 Phase·각 모듈·각 화면 종료 시 갱신한다.
- **새 세션 진입 시 이 파일을 먼저 읽어 이어받는다** — 한 세션에 다 담지 못할 때의 표준 재개 수단(골든 원칙 컨텍스트 50% 규칙).
- 중단·실패도 `blockers`에 남긴다(조용한 종료 금지).

## 8. 완료 정의 (Definition of Done)

다음이 **모두** 증거와 함께 있어야 완료다.

| 항목 | 증거 |
|---|---|
| RTM 전 요구 ✅ | `rtm.md` 대조표 |
| server 테스트 | `npx vitest run server` 출력(실패 0) |
| contract 테스트 | `npx vitest run server/test/routes ui/src/api` 출력(실패 0) + 4자 대조표 |
| ui 테스트 | `npx vitest run ui` 출력(실패 0) |
| 화면 시나리오 | `ui/src/{screen}/test/result.md` 전건 PASS(스크린샷 경로 포함) |
| 빌드 | `npx tsc --noEmit`(shared·server·ui)·`npm run build` exit 0 |
| 매뉴얼 | `ui/src/{screen}/manual.md` 존재 + 스크린샷 |
| handoff | `doc/handoff/embed-guide.md`·`token-snippet.php.md`·`secret-handover.md` 존재(실값 없음) |
| 상태 | `doc/state.json` `phase: "done"` |

## 9. 실패·롤백

| 상황 | 처리 |
|---|---|
| 계약이 화면 요구와 어긋남 | Phase 2로 되돌려 `contract-designer` 재위임, **승인 ②를 다시** 받는다 |
| 새 npm 패키지가 필요 | 리프는 설치 불가(훅 차단). 승인 ② 목록에 넣어 사용자 승인 후 메인 세션에서 설치 요청 |
| 테스트 3회 실패 | 중단·보고. `state.json`에 실패 지점·원인 기록 |
| 확정사항(§1·§3·§5)과 충돌 | 정지 — 사용자에게 확정사항 변경 여부를 묻고, 변경 시 `000_프로젝트_확정사항.md`를 먼저 고친다 |
| 툴체인 없음(node·npm·node_modules) | 정지 — 설치·`npm ci`는 사용자 몫. 설치 후 재개 |
| LLM 키 없음 | 정지하지 않는다 — `FakeProvider`로 구현·테스트를 끝내고 실키 확인은 `/run-app` 수동 항목으로 남긴다 |
