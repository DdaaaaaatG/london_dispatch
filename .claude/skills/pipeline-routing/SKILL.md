---
name: pipeline-routing
description: 런던_디스패치 에이전트·스킬 구성과 라우팅의 단일 소스. 작업 모드 판별(구축 build vs 보강 maintain)과 모드별 규칙, 계층 위상(ui→contract→server 단방향)과 인계 허락 게이트, 횡단 사전설계(system-architect) 진입 기준, 진입점 매니저 선택표, 에이전트 30종 목록, 전략 스킬 목록, 에이전트 모델·사고량(effort) 4등급 정책, 위임 전 경합 사전 분석(공유 자원표 7종·순차/병렬 판정·실행 절차표), 도구 선확인·「적용 메모리」 동봉 규칙·예산과 진행 보고 처리·소요시간 통보를 정의한다. 어느 매니저·에이전트로 보낼지 정하거나 새 에이전트의 model을 지정할 때 참조한다.
---

# 파이프라인 라우팅 (단일 소스)

- 제품 규격·폴더·계층은 `doc/000_프로젝트_확정사항.md`가 단일 기준이다. 이 스킬은 **누가·어떤 순서로·어떤 모델로** 일하는지만 정한다.
- 3계층 `server(Node 서비스) · contract(API 계약) · ui(iframe 화면)` + 횡단 2종 + 배포 전 `verify` 게이트를 **매니저(오케스트레이터) + 리프 에이전트** 패키지로 처리한다.

## 1. 작업 모드 — 구축(build) vs 보강(maintain) ★모든 작업의 첫 판별

별도 플래그 없음 — **요구조건 자체로 판단**한다. 의심스러우면 사용자 인터뷰로 확정(추측 금지). 판별 결과·근거를 작업 개시 보고에 명시한다.

| 모드 | 정의 | 판별 신호 |
|---|---|---|
| **구축(build)** | 초기 요구조건으로 server→contract→ui를 **한 흐름으로 새로 구현** | 대상 모듈·계약·화면이 **아직 없음**(Glob/Grep 확인), "처음부터 만들어줘" |
| **보강(maintain)** | 이미 구현된 것을 **개별 확인하며 디버깅·보강** | 대상이 **이미 있음** — 버그·동작 개선·기능 추가·계약 변경 반영 |

| 규칙 | 구축(build) — 통합 흐름 | 보강(maintain) — 계층 분리 |
|---|---|---|
| 진입점 | `task-manager`(리프 직접 위임) | 계층 매니저 또는 `ui-debug` |
| contract-manager의 server 변경 | server 리프(designer/implementer) **직접 위임**, server+contract 묶음 **단일 승인 1회** | server 변경 요구 명세 → 사용자 보고 → **허락 후 별도 server-manager 세션** |
| ui-manager의 계약 변경 | task-manager가 처리(ui-manager 미사용) | contract 요구 명세 → 사용자 보고 → 허락 후 별도 contract-manager 세션 |
| server-manager 완료 후 | 다음 계층 연쇄 안내 | 순수 server(화면·계약 불고려), 완료 보고에 인계 안내 한 줄 |
| 문서 | 파이프라인이 동시에 만듦 | `/doc-sync` 배치로 일치 |

## 2. 계층 위상 — ui → contract → server (단방향)

```
ui (ui/src/rooms, ui/src/chat, ui/src/state, ui/src/components)
  │ 호출: ui/src/api/*.ts 래퍼만 (fetch 직접 사용 금지)
  ▼
contract (doc/200_설계/contract/api.md ↔ shared/src/* ↔ server/src/routes/* ↔ ui/src/api/* ↔ doc/handoff/*)
  │ 호출: server 서비스 공개 함수
  ▼
server (server/src/{env,db,auth,rooms,messages,memory,llm})   ← ui를 모른다
```

- **구축 순서는 반대(server→contract→ui)**. 깊은 계층부터.
- **왕복 금지.** ui 작업 중 계약 변경이 필요하면 ui는 멈추고 요구 명세를 만들어 위(contract)로 인계한다. contract 작업이 끝나면 ui로 되돌아오되, contract가 ui에게 새 요구를 되걸지 않는다.
- **그룹 경계 허락 게이트(보강 모드).** 한 매니저가 다른 계층을 바꾸려면 사용자 허락이 필요하다. 매니저는 인계 명세를 보고하고 멈춘다. 사용자가 세션을 열어 넘긴다.
- **갠홈(저쪽)은 contract의 외부 당사자다.** 토큰 형식·임베드 주소가 바뀌면 `doc/handoff/` 전달물도 contract 변경이다.

## 3. 횡단 사전설계 — system-architect 진입 기준

| 신호 | 횡단(system-architect 먼저) | 단일(계층 매니저) |
|---|---|---|
| 계층 수 | 2개 이상 동시 변경 | 1개 |
| 데이터 흐름 | speak 파이프라인(요청→프롬프트 조립→LLM→저장→요약) 구조 변경 | 한 지점의 버그·파라미터 |
| 계약 | 기존 엔드포인트의 필드 제거·의미 변경·토큰 형식 변경(파괴 변경) | 필드 추가·새 엔드포인트 |
| DB | 스키마 마이그레이션이 데이터 의미를 바꿈(speaker 종류 추가 등) | 컬럼 1개 추가(기본값 있음) |
| 캐릭터 | 캐릭터 수·구조 변경(3명째, 관리 화면) | 프롬프트 문구 수정 |

횡단이면 `claude --agent system-architect`로 분석·설계·패킷을 먼저 받고, 패킷을 server→contract→ui 매니저 세션으로 넘긴다.

## 4. 진입점 선택표

| 요구 유형 | 진입점 | 비고 |
|---|---|---|
| 새 기능을 server·contract·ui까지 한 번에 | `task-manager` | 구축 전용 |
| 기존 화면 버그·"이거 고쳐줘" | `ui-debug` | 원인 분석은 ui-error-analyst |
| 화면 추가·개선·컴포넌트 | `ui-manager` | |
| API 계약·토큰 형식·handoff 설계·확장·감사 | `contract-manager` | |
| 서버 모듈(env·db·auth·rooms·messages·memory·llm) | `server-manager` | |
| 여러 계층·speak 파이프라인·계약 파괴 변경 | `system-architect` | 분석·설계만 |
| 배포 전 검증 | `verify-manager` | 읽기 전용 게이트 |
| 문서 동기화 | `/doc-sync` | 메인 세션 |
| 커밋·푸시 / 배포 | `/sync` / `/deploy` | verify PASS 후 |

## 5. 에이전트 30종

| 계층 | 에이전트 | 역할 | model / effort | 유형 |
|---|---|---|---|---|
| server | server-manager | server 총괄 오케스트레이터 | opus / medium | 인터뷰 |
| server | server-designer | server 모듈 설계 (`doc/200_설계/server/*.md`) | opus / xhigh | 기준 설정 |
| server | server-implementer | Node/TS 구현 + vitest | sonnet / medium | 생성 |
| server | server-analyst | server 현황 감사 (읽기 전용, `.claude/reports`) | opus / high | 판정 |
| contract | contract-manager | contract 총괄 오케스트레이터 | opus / medium | 인터뷰 |
| contract | contract-designer | API 계약·토큰 형식·handoff 설계 (`api.md`) | opus / xhigh | 기준 설정 |
| contract | contract-implementer | `shared/` · `server/src/routes/` · `ui/src/api/` 구현 | sonnet / medium | 생성 |
| contract | contract-analyst | 계약↔shared↔routes↔api 래퍼 일치 감사 | opus / high | 판정 |
| ui | ui-manager | ui 총괄 오케스트레이터 | opus / medium | 인터뷰 |
| ui | ui-layout-designer | 화면 구성안(ASCII) | opus / medium | 기준 설정 |
| ui | ui-designer | requirements.md·design.md 작성·동기화 | opus / medium | 기준 설정 |
| ui | ui-design-checker | 설계 독립 검증 | opus / high | 판정 |
| ui | ui-test-designer | test/scenarios.md + vitest 스펙 | opus / xhigh | 기준 설정 |
| ui | ui-test-checker | 시나리오 독립 검증 | opus / high | 판정 |
| ui | ui-test-conflict-checker | 시나리오 모순 검증 | opus / high | 판정 |
| ui | ui-implementer | React 화면 구현 | sonnet / max | 생성 |
| ui | ui-tester | vitest 실행 + 브라우저 스크린샷 | sonnet / low | 실행 |
| ui | ui-fixer | 테스트 실패 최소 수정 | opus / high | 생성 |
| ui | ui-debug | 기존 화면 버그 수정 미니 오케스트레이터 | opus / medium | 인터뷰 |
| ui | ui-error-analyst | 오류 원인 분석 전담 | opus / medium | 판정 |
| ui | ui-postprocessor | 공용화·분리·정리 (옵트인) | sonnet / medium | 생성 |
| ui | ui-manual-writer | manual.md + 스크린샷 | sonnet / medium | 생성 |
| ui | ui-component-designer | 공용 컴포넌트 인터페이스 설계 | opus / xhigh | 기준 설정 |
| ui | ui-component-implementer | 공용 컴포넌트 TDD 구현 | sonnet / max | 생성 |
| 횡단 | task-manager | 구축 총괄: server→contract→ui 한 흐름 | opus / xhigh | 인터뷰 |
| 횡단 | system-architect | 횡단 분석·전반 설계 | opus / xhigh | 기준 설정 |
| verify | verify-manager | 배포 전 통합 검증 게이트 | opus / high | 판정 |
| verify | verify-code-reviewer | TS/React 코드 리뷰 | opus / high | 판정 |
| verify | verify-security-reviewer | 웹 서비스 보안 검토 | opus / high | 판정 |
| verify | verify-server-reviewer | 서버 리뷰 | opus / high | 판정 |

## 6. 전략 스킬 (preload 열은 에이전트 frontmatter `skills:`와 일치해야 한다)

| 스킬 | preload 주체 | 내용 |
|---|---|---|
| server-design-strategy | server 4종 | 모듈 경계 6종·env 단일 진입·에러·비동기·SQLite·LLM 어댑터·프롬프트·테스트 |
| contract-design-strategy | contract 4종 | 엔드포인트·JSON·에러코드·토큰·호환성·4자 동기화·handoff |
| ui-design-strategy | ui 16종 | 화면 폴더·문서 4종·RTM·컴포넌트 재사용·api 경계·대화 화면 규칙·TDD |
| verify-strategy | verify 4종 | verify-loop·3대 리뷰·게이트 |
| project-build-strategy | task-manager | 구축 파이프라인·게이트·state.json |
| system-architecture-strategy | system-architect | 횡단 3단계·패킷 |
| change-request-tracking | ui-debug · ui-fixer · ui-implementer | CR 대장 |
| component-catalog | ui-implementer · ui-component-designer · ui-component-implementer · ui-debug · ui-fixer · ui-error-analyst · ui-postprocessor | 공용 컴포넌트 인벤토리 |
| component-usage-lessons | ui-implementer · ui-component-implementer · ui-debug · ui-fixer | 오용 카탈로그 |
| layout-templates | ui-layout-designer | 390px 패널 레이아웃 패턴 |
| pipeline-routing · doc-sync · tech-research | 메인 세션(preload 없음) | 라우팅 · 문서 동기화 · 패키지 조사 |
| server-rules.md / ts-rules.md / tsx-rules.md / ui_design_concept.md | 구현자·리뷰어가 본문에서 경로로 참조 | 코드·디자인 규칙(루트 파일, preload 아님) |

- verify-server-reviewer는 `server-design-strategy` §13 체크리스트를 **본문에서 경로로 참조**한다(preload는 verify-strategy만).

## 7. 모델·사고량 4등급 정책

| 유형 | model | effort | 예 |
|---|---|---|---|
| 인터뷰(사용자와 요구 확정, 오케스트레이션) | opus | medium~xhigh | 매니저, task-manager |
| 기준 설정(설계·계약·시나리오 — 뒤 단계의 기준이 됨) | opus | xhigh | designer, test-designer, architect |
| 판정(독립 검증·감사·리뷰) | opus | high | checker, analyst, reviewer |
| 생성(설계를 코드로 옮김) | sonnet | medium~max | implementer, fixer(예외: opus high — 원인 추론 필요) |
| 실행·검색 | sonnet | low | tester |

- 새 에이전트를 만들 때 이 표로 `model`·`effort`를 정한다. 근거 없이 opus를 생성 역할에 쓰지 않는다.
- **Sonnet 강등 판단**: 산출물이 명세로 완전히 결정되면(계약 확정 후 구현 등) sonnet. 판단·추론이 필요하면 opus.

## 8. 위임 전 경합 사전 분석 — 필수

**도구 확인 다음, 위임문을 쓰기 전에** 위임 후보마다 `작업 | 읽음 R? | 씀/잠금 R? | 파일` 한 줄을 쓴다(매니저 자신의 확인 명령 포함). 같은 자원에 (쓰기,쓰기)·(쓰기,읽기)가 있으면 **경합**으로 판정해 ① 자원 분리 → ② 순서화 → ③ 직렬화 → ④ 직접 수행 순으로 없앤다. **기본값은 순차**, 병렬은 자원표로 증명될 때만.

### 공유 자원표

| 자원 | 내용 | 규칙 |
|---|---|---|
| R1 | `package.json`(루트·각 워크스페이스), `railway.json`, `tsconfig*.json`, `vite.config.ts` | 쓰기는 한 번에 하나. 의존성 추가는 메인 세션만 |
| R2 | 계약 4종 + handoff: `doc/200_설계/contract/api.md`, `shared/src/*`, `server/src/routes/*`, `ui/src/api/*`, `doc/handoff/*` | contract-designer(문서·handoff)·contract-implementer(코드)만 쓴다. ui·server는 읽기만 |
| R3 | 화면 폴더 `ui/src/rooms/`, `ui/src/chat/` | 한 화면 = 한 시점에 한 에이전트. 두 화면은 병렬 가능 |
| R4 | `ui/src/state/` (대화 상태·토큰 상태) | ui-implementer(chat)와 ui-component-implementer가 동시에 쓰지 않는다 |
| R5 | `server/src/db/` (스키마·마이그레이션·접근 함수) | server-implementer 모듈별 위임은 **순차**(마이그레이션 번호 충돌 방지) |
| R6 | 테스트 실행(`vitest run`) | **직렬** — 동시 실행 금지(임시 SQLite 파일·포트 충돌). `/test`도 워크스페이스를 순차로 돈다 |
| R7 | dev 서버(`npm run dev`, 포트 3000·5173) | 한 번에 하나 |

### 실행 절차표 양식

```
| 단계 | 위임 | 순차/병렬 | 착수 조건 | 근거 |
|---|---|---|---|---|
| 1 | server-implementer(db) | 순차 | — | R5 |
| 2 | server-implementer(auth) ∥ server-designer(llm 문서) | 병렬 | 1 완료 | 자원 분리(server/src/auth vs doc) |
```

위임문에 **「자원 경계」 절**(하지 말아야 할 것)을 넣는다. 경합이 드러난 뒤 "예상된 경합이라 기다린다"는 금지 — 즉시 직렬화하고 절차표를 고친다.

## 9. 도구 선확인 · 위임 판별

1. **`tools:` 줄이 사실이다.** 위임 전 `.claude/agents/{name}.md`의 `tools:`를 본다. 설명문에 적힌 능력이 실제 도구에 없을 수 있다.
2. **Edit 없는 에이전트**는 전체 `Write`만 가능 → 큰 문서는 절 단위로 분할 위임한다.
3. **「없다 = 불가」로 단정하지 않는다.** ① 도구 목록 → ② 프로젝트 의존성(`node_modules`·`package-lock.json`) → ③ 시스템(전역 설치) 순으로 확인. 기존 설치물을 Bash로 부르는 것은 설치 허가제 위반이 아니다.
4. **좁은 조회는 직접.** 파일 1~2개 읽기·grep 1회로 끝나는 확인은 위임하지 않는다. 위임은 10분 이상 걸리거나 여러 파일을 읽어야 하는 산출물이 있을 때.
5. **진행 판별은 산출물 실물로.** 파일 존재·크기·내용 마커(grep)로 확인한다. 상태 문의로 확인하지 않는다.

## 10. 「적용 메모리」 동봉 규칙

- 분석·설계·디버깅·구현 에이전트 위임문에는 `MEMORY.md`에서 고른 관련 항목의 `How to apply` 줄(최대 5건)을 「적용 메모리」 절로 동봉한다.
- **checker·tester·reviewer·analyst(독립 조사)에는 넣지 않는다** — 독립 검증 근거가 오염된다. 이들은 위임문에 그 절이 있어도 판정 근거로 쓰지 않는다.

## 11. 예산과 진행 보고

| 역할 | 기본 예산(도구 호출 / 벽시계) |
|---|---|
| 구현(implementer·fixer·postprocessor) | 80회 / 30분 |
| 설계(designer·layout·test-designer·manual) | 50회 / 20분 |
| 검증·분석(checker·analyst·reviewer·tester·error-analyst) | 30회 / 10분 |
| 매니저 자체 | 60~120회 / 40~90분 (에이전트 파일에 명시) |

- 위임문에 `예산: 도구 호출 N회 · 벽시계 M분`을 쓴다. 미명시면 위 기본값.
- 리프는 초과 시 **진행 중인 원자 단계(파일 1개 저장)까지만 마치고** `상태: 예산 초과 | 완료 | 미완료 | 막힌 지점·원인 | 잔여 예상 | 권고: 계속/전환/중단`으로 반환한다. `maxTurns`는 하드 퓨즈다.
- 매니저는 ① 계속(`SendMessage` "예산 +N, 이어서" — 재브리핑 없음) ② 전환(좁힌 지시 1회) ③ 중단(직접 수행·재위임) 중 하나를 정해 완료 보고에 기록한다. M+5분이 지나도 산출물이 없으면 `TaskStop` 후 실물 확인.
- **보고 채널은 하나.** 리프의 보고는 최종 응답 1회. 위임문에 `SendMessage`로 답하라는 지시를 넣지 않는다.

## 12. 위임문 표준 양식 (모든 매니저 공통)

```
[작업] {한 문장}
[요구ID] R-… (🔒 유지)          [모드] 구축 | 보강
[입력 파일] 경로 목록 (요약 대신 경로 — 리프가 직접 읽는다)
[산출물] 경로 — 완료 마커(파일·테스트 이름)
[제약] 확정사항 §n / {계층}-design-strategy / 설치 금지 / 비밀값 격리
[자원 경계] 만지지 말 것 (§8 자원표 기준)
[적용 메모리] (생성·설계·디버깅 에이전트만, ≤5줄)
[예산] 도구 호출 N회 · 벽시계 M분
[보고] 최종 응답 1회 — 요구ID별 ✅/❌ + 실행 증거
```

## 13. 세션 시작 체크리스트 (매니저 공통)

1. `doc/000_프로젝트_확정사항.md`를 읽었는가(규격을 다시 묻지 않기 위해).
2. 모드(구축/보강)를 판별하고 개시 보고에 적었는가.
3. 진입점이 맞는가(§4). 아니면 올바른 진입점을 안내하고 멈춘다.
4. 툴체인(`node`·`npm`)이 있고 `node_modules`가 복원돼 있는가. 없으면 사용자에게 요청한다(에이전트는 설치하지 않는다 — `npm ci`는 메인 세션).
5. 재개 파일(`doc/state.json`·화면 CR 대장·`doc/doc-sync-state.json`)이 있는가.
6. 위임 전 도구 확인(§9)·경합 분석(§8)·예산(§11)을 했는가.

## 14. 명령(슬래시) 목록

| 명령 | 내용 | 실행 위치 |
|---|---|---|
| `/dev-start` | `npm run dev`(server+ui) 백그라운드 시작·상태 보고 | 메인 세션 |
| `/dev-build` | `npm run typecheck` + `npm run build` 검증 빌드 | 메인 세션 |
| `/test` | `npx vitest run` (인자 `server`/`contract`/`ui`/`<파일>`) | 메인 세션 |
| `/run-app` | dev 기동 후 `/embed`·`/embed?t=` 스크린샷 | 메인 세션 |
| `/sync` | commit + push (verify PASS 후) | 메인 세션 |
| `/doc-sync` | 문서 동기화 배치 | 메인 세션 |
| `/deploy` | `railway up` → 헬스체크 → `doc/300_검증/deploy-*.md` | 메인 세션 |

## 15. 적용 소요시간 통보

- 분석이 끝나 실행 절차표가 서면, 설계·구현 위임을 시작하기 **전에** 예상 소요시간을 한 줄 통보하고 곧바로 착수한다.
- 산정 = Σ(단계별 예산 M분, 병렬은 긴 쪽) + 매니저 종합 5분 + 승인 게이트 대기(사용자 개입 횟수만 표기).
- 승인 게이트가 남은 작업은 **미리보기 제시문에 예상 시간을 함께** 넣어 왕복을 만들지 않는다.
- 완료 보고에 `예상 {M}분 → 실측 {M}분` 한 줄을 남긴다.
