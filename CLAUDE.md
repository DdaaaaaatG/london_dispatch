# 런던_디스패치 (london_dispatch)

흑집사 자캐 커뮤니티 갠홈 `http://london-gossip.my/`(그누보드5 + 아보카도 에디션)에 **iframe으로 끼워 넣는 AI 캐릭터 대화창**. 세바스찬·시엘 버튼을 누르면 해당 캐릭터가 방 대화를 보고 한 턴 말한다. 서버는 **Cloudflare Workers**(서버리스, 별도 서버 컴퓨터 없음)에서 돌고, 화면은 서버가 `/embed`로 내려준다.

> **단일 소스: `doc/000_프로젝트_확정사항.md`.** 제품 동작·스택·계층·폴더·API·토큰·에이전트 목록이 거기 있다. 이 파일은 요약과 정책만 담는다. 두 문서가 어긋나면 확정사항 문서가 맞다.

---

## 1. 스택 요약

| 항목 | 값 |
|---|---|
| 서버 실행 환경 | **Cloudflare Workers**(workerd, `nodejs_compat`) 🔒. 로컬 도구는 Node 22+ + TypeScript 5, npm workspaces(`server/` `ui/` `shared/`) |
| 서버 | Hono 4 + zod. DB는 **Cloudflare D1**(SQLite 호환, 바인딩 `DB`, `server/migrations/*.sql`) |
| 설정·비밀값 | Secrets(`wrangler secret put`) · 로컬 `server/.dev.vars` · 비밀 아닌 설정은 `wrangler.toml [vars]`. 코드는 `server/src/env.ts`에서만 바인딩 파싱 |
| 화면 | Vite 8 + React 19 + TS 5.9(설치 기준 2026-10-05), CSS Modules + 변수 토큰. `/embed`는 Workers Static Assets(`ui/dist`, Vite base `/embed/`) |
| AI | **Google Gemini**(확정, 지인 키 발급). `server/src/llm/` 어댑터 뒤에 격리(교체 가능). `fetch` REST. 키는 Secrets `LLM_API_KEY`만 |
| 테스트 | vitest 4.x(루트 projects: shared·server·ui). 서버 `@cloudflare/vitest-pool-workers`(workerd + D1), 화면 jsdom + @testing-library/react. `npx vitest run --project <이름>` |
| 린트 | eslint · prettier |
| 배포 | `wrangler deploy`(지인 Cloudflare 계정). `*.workers.dev` https. 갠홈 PHP가 https 주소만 받는다 |
| Git | GitHub 단일 저장소, `main`, 1인 개발 |
| 화면 확인 | 브라우저 MCP(puppeteer) 있으면 사용, 없으면 PowerShell 캡처 |

## 2. 폴더 구조 요약

```
shared/src/     types.ts · errors.ts · endpoints.ts   (contract 타입 단일 소스의 코드판)
server/         wrangler.toml · .dev.vars.example · migrations/*.sql
server/src/     index.ts(Hono 앱, fetch/scheduled) · env.ts · db/ auth/ rooms/ messages/ memory/ llm/ · routes/(contract 소유)
ui/src/         main.tsx · api/(contract 소유) · rooms/ · chat/ · components/ · state/ · styles/
doc/            000_프로젝트_확정사항.md · 100_요구조건/ · 200_설계/{server,contract,architecture}/ · 300_검증/ · handoff/
.claude/        agents/ skills/ commands/ hooks/ scripts/ rules/ reports/ agent-memory/
```

- 화면은 둘뿐이다: `ui/src/rooms/`(방 목록), `ui/src/chat/`(대화). 각 화면 폴더에 `requirements.md`, `design.md`, `manual.md`, `test/scenarios.md`, `test/change-requests.md`(CR 대장), 소스.
- 설정·비밀값 읽기는 `server/src/env.ts`에서만(Workers `env` 바인딩을 `parseEnv`로 파싱해 값으로 전달). 다른 파일의 `process.env`·`import.meta.env`는 훅이 차단한다.

## 3. 계층 위상과 경계

```
ui (React, iframe)  →  contract (api.md · shared/ · routes/ · ui/src/api/ · handoff/)  →  server (Node 서비스)
```

- **단방향.** ui는 `ui/src/api/` 래퍼만 호출한다. 화면 코드에서 `fetch` 직접 사용 금지.
- `doc/200_설계/contract/api.md`가 `shared/src/types.ts`·`server/src/routes/*`·`ui/src/api/*`·`doc/handoff/*`(갠홈 토큰 PHP 조각)의 단일 소스다. 어긋나면 contract 결함.
- server는 ui를 모른다. 라우트는 얇게(검증 → 서비스 → 응답), 30줄 초과면 로직을 server 서비스로.
- 계층을 넘는 변경이 필요하면 고치지 말고 **요구 명세를 만들어 사용자에게 보고**한다. 허락 후 해당 계층 매니저 세션으로 인계. 예외는 구축 모드의 task-manager(세 계층을 한 흐름으로).

## 4. 진입점 선택표

상세 규칙은 `pipeline-routing` 스킬. 먼저 **작업 모드**를 판별한다: 구축(build, 대상이 아직 없음) vs 보강(maintain, 이미 구현된 것의 수정·추가).

| 요구 유형 | 진입점 |
|---|---|
| 처음부터 기능 구축(server→contract→ui 한 흐름) | `claude --agent task-manager` |
| 여러 계층을 동시에 건드리는 재설계·종단간 점검 | `claude --agent system-architect` |
| server 모듈 신규·변경·감사 | `claude --agent server-manager` |
| API 계약·토큰 형식·handoff 신규·변경·감사 | `claude --agent contract-manager` |
| 화면 신규·개선(구축) | `claude --agent ui-manager` |
| 기존 화면 버그·동작 수정 | `claude --agent ui-debug` |
| 배포 전 통합 검증 | `claude --agent verify-manager` |
| 개발 서버 / 검증 빌드 / 테스트 / 화면 확인 | `/dev-start` `/dev-build` `/test` `/run-app` |
| 커밋·푸시 / 문서 동기화 / 배포 | `/sync` `/doc-sync` `/deploy` |

## 5. 필수 정책 (모든 작업에 걸린다)

0. **위임 원칙 (🔒 사용자 지정).** 메인 세션은 소스(`server/`·`shared/`·`ui/`)와 산출 문서(화면 문서 4종·CR 대장·`doc/200_설계/**`·`doc/handoff/**`)를 **직접 수정하지 않는다.** 담당 리프 에이전트에 위임한다. 어느 에이전트인지는 §4 진입점 표와 `pipeline-routing` 스킬로 정한다.
   - 메인 세션이 직접 하는 일: 요구 인터뷰, 위임문 작성, 결과 대조·종합, 사용자 보고, `doc/000_프로젝트_확정사항.md`·`doc/next-session.md` 갱신, 사용자가 승인한 의존성 설치, 앱 실행·스크린샷 확인, Cloudflare 배포(`wrangler deploy`, 사용자 확인 후·배포 주체가 우리일 때만).
   - 에이전트가 가드에 막히면 **메인 세션이 대신 쓰지 않는다.** 막힌 이유를 사용자에게 알리고 결정을 받는다(가드 우회 금지).
   - 사용자가 "직접 고쳐"라고 명시한 건만 예외로 메인 세션이 직접 수정하고, 그 사실을 완료 보고에 적는다.
1. **작업 모드 판별.** 작업 수신 시 구축/보강을 먼저 정하고 개시 보고에 근거를 적는다. 애매하면 사용자에게 묻는다.
2. **라이브러리 설치 허가제.** `npm install <pkg>`·`npm i -g`·`npx <새 도구>`·`winget` 등 새 의존성은 **사용자 승인 후 메인 세션에서만**. 서브에이전트는 가드가 차단한다. `npm install`(인자 없음, 기존 복원)·`npm ci`는 대상이 아니다.
3. **도구 선확인.** 위임 전 대상 에이전트의 `tools:` 줄을 본다. 설명이 아니라 `tools:`가 사실이다.
4. **증거 기반 완료.** "될 것이다" 금지. vitest 결과, `tsc --noEmit` exit code, 빌드 exit code, `curl` 응답, 스크린샷 경로로 증명한다.
5. **요구 범위 준수.** 요구ID(`R-xx`)로 역추적되지 않는 기능·필드·버튼·엔드포인트를 만들지 않는다. 필요해 보이면 보고만 하고, 승인되면 요구로 승격한 뒤 만든다.
6. **비밀값 격리.** 설정·비밀값 읽기는 `server/src/env.ts`에서만. API 키·SECRET 실값은 `server/.dev.vars`(로컬, git 제외)와 Cloudflare Secrets(운영)에만. 로그·응답·화면·문서·커밋에 실값 금지. 훅이 차단한다.
7. **검증자 독립성.** checker·tester·reviewer·analyst에는 「적용 메모리」나 설계 의도를 전달하지 않는다.
8. **보고 채널은 하나.** 서브에이전트는 최종 응답 1회로 보고한다. SendMessage 중간 보고 금지.
9. **실행 예산.** 위임문에 `예산: 도구 호출 N회 · 벽시계 M분`. 기본값 구현 80/30, 설계 50/20, 검증·분석 30/10.
10. **파괴적 명령 금지.** `git reset --hard`·`push --force`·`clean -fd`·`wrangler delete`·`wrangler d1 delete`·`wrangler secret delete`·`wrangler d1 execute --remote`(DROP/DELETE)는 훅이 차단한다. `wrangler deploy`·`d1 migrations apply --remote`는 `/deploy` 안에서만. 되돌리기는 `git revert`·파일 단위 복원으로.
11. **절대 경로 금지.** `CLAUDE.md`·`.claude/**/*.md`의 명령은 프로젝트 루트 기준 상대 경로. `.claude/rules/claude-doc-paths.md`.
12. **외부 전달물은 handoff로.** 갠홈 저쪽에 줄 것(임베드 주소, 토큰 PHP 조각, SECRET 전달 방법)은 `doc/handoff/`에만 쓰고, contract-designer가 소유한다. 채팅으로만 전달하고 문서에 없는 상태를 만들지 않는다.

## 6. 개발 명령

| 명령 | 실제 셸 | 설명 |
|---|---|---|
| `/dev-start` | `npm run dev`(백그라운드, 로그 `.dev.log`) | server(`wrangler dev --port 3000`, 로컬 D1) + ui(Vite 5173, `/api` 프록시) |
| `/dev-build` | `npm run typecheck` · `npm run build` | 컴파일·번들 확인(ui vite build + `wrangler deploy --dry-run`). 배포 아님 |
| `/test` | `npm test`(= `vitest run`) | 전체 또는 `server`/`contract`/`ui`/`<파일>` |
| `/run-app` | dev 기동 + 스크린샷 | `doc/300_검증/screenshots/{YYYYMMDD-HHMM}/` |
| `/sync` | `git add -A` · `git commit` · `git push origin main` | 변경 목록 확인 후 커밋. verify PASS 후 권고 |
| `/doc-sync` | git history 기준 문서 동기화 위임 | 마커 `doc/doc-sync-state.json` |
| `/deploy` | `npm run build` → `wrangler d1 migrations apply --remote` → `wrangler deploy` → 헬스체크 | verify PASS + 사용자 확인 후. 배포 주체가 지인이면 절차서만 산출. 산출 `doc/300_검증/deploy-*.md` |

- `vitest`를 `run` 없이 실행하면 watch 모드로 세션이 막힌다. 항상 `vitest run`.
- 서버는 `ui/dist`를 Workers Static Assets로 `/embed`에 서빙한다. dev에서는 Vite가 `/api`를 `wrangler dev`(3000)로 프록시한다. 로컬 D1은 `server/.wrangler/`에 생긴다.

## 7. 문서 규칙

- 모든 문서는 **마크다운**, 한국어.
- 화면 문서 4종(`requirements.md` · `design.md` · `manual.md` · `test/scenarios.md`)은 화면 폴더 안에. 소유자는 각각 ui-designer · ui-designer · ui-manual-writer · ui-test-designer.
- `design.md`에는 요구 추적 매트릭스(RTM)가 있어야 한다. 요구ID → 설계 섹션 → TC.
- 보강 모드에서 화면을 고치면 `test/change-requests.md`에 CR 엔트리를 남긴다(`change-request-tracking` 스킬). 기록 없이 완료 보고 금지.
- server 설계는 `doc/200_설계/server/{모듈}.md`, 계약은 `doc/200_설계/contract/api.md`, 외부 전달물은 `doc/handoff/`.
- 소스가 바뀌면 문서를 같이 맞춘다. 훅이 화면·contract 소스 수정 시 세션당 1회 알린다. 배치 정리는 `/doc-sync`.

## 8. 코드 규칙

| 파일 | 대상 |
|---|---|
| `.claude/skills/server-rules.md` | Workers/Hono 관례(모듈 경계, 에러 타입, 비동기·waitUntil, D1, 로그, env 바인딩 단일 진입) |
| `.claude/skills/ts-rules.md` | TypeScript 규칙(const 기본, 세미콜론 없음, alias import, Result 정규화) |
| `.claude/skills/tsx-rules.md` | React 규칙(불변성, 단방향 흐름, Hook 규칙, 400줄 한계) |
| `.claude/skills/ui_design_concept.md` | UI 디자인 시스템(Rosebell 계열 색·타이포·스페이싱, 390px) |
| `.claude/rules/golden-principles.md` | 파일·함수 한계, 결론 먼저, 증거 기반 완료, 비밀값 격리 |

## 9. 확정된 제품 규격 (요약 — 상세는 확정사항 §1·§5)

- 캐릭터 2명 고정(세바스찬·시엘). 버튼 = 해당 캐릭터 1턴 생성. 입력창 = 유저 발화/OOC 지시, AI 호출 없음.
- 방 여러 개. 메시지 수정·재작성·삭제. 방 단위 장기기억(요약).
- 보기는 누구나. 쓰기는 갠홈 등급 N 이상 — 갠홈 PHP가 HMAC 토큰을 `?t=`로 발급, 서버가 검증. 토큰 없으면 읽기 전용 화면(쓰기 UI 미렌더).
- 화면 폭 390px. 저쪽 패널 안 iframe. `frame-ancestors`로 갠홈만 허용.
- 메인 화면 대사창 연동 안 함. 관리 화면 없음(캐릭터 설정은 코드 상수).

## 10. 참조 원본

이 `.claude` 자산은 `kuro_keyviewer`(Tauri 앱) 자산 구조를 옮겨 만들었다. 원본 개념(Rust·Tauri·core/bridge·unsafe·후킹·오버레이)은 이 프로젝트 문서에 옮겨 적지 않는다. 아보카도 에디션 모듈 샘플(`../bbs_action_sample`)과 저쪽 테마 패치(`../chatbot update`)는 참조용이며 이 저장소에 포함하지 않는다.
