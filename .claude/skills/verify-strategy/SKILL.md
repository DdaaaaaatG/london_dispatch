---
name: verify-strategy
description: 배포 전 통합 검증 전략. 프로젝트 타입검사+린트+테스트+빌드(verify-loop — tsc --noEmit 세 워크스페이스·npm run lint·vitest run·npm run build), 보안(외부 공개 웹 서비스 위협 모델 — 토큰·비밀값·CSP·레이트리밋·입력 검증·프롬프트 주입)·코드(ts/tsx/golden·api 경계)·server(모듈 경계·에러·비동기·D1·LLM 어댑터) 3대 리뷰를 병렬로 수행하고, PASS/WARN/FAIL/ERROR 게이트로 배포(커밋·푸시·wrangler deploy) 가능 여부를 판정한다. 검증은 읽기 전용이며 수정은 생산 에이전트(ui-debug/contract-manager/server-manager)로 라우팅한다. 검증·리뷰·배포 전 게이트를 다룰 때 참조한다.
---

# 배포 전 통합 검증 전략

- 배포(커밋·푸시·Cloudflare `wrangler deploy`) 직전 통합 검증의 **단일 기준**. verify 4종(verify-manager / verify-security-reviewer / verify-code-reviewer / verify-server-reviewer)이 이 규칙으로 판단한다.
- server/contract/ui=생산(설계→구현→테스트), verify=세 계층 산출물을 가로지르는 횡단 게이트. 각 매니저 내부 게이트는 *자기 산출물 완전성*, verify는 *전체 코드베이스의 품질·보안·빌드 건전성*을 본다.

## 0. 핵심 원칙

1. **읽기 전용.** 검증·리뷰는 읽고 측정·판정만 한다. 소스(.ts/.tsx)·설정 수정 금지 — 수정은 생산 에이전트의 일(§5).
2. **증거 기반.** "통과할 것" 금지. 실제 실행 결과(exit code·테스트 PASS 수·리뷰 이슈 목록)로만 판정한다(golden-principles 5).
3. **게이트.** 결과는 **PASS / WARN / FAIL / ERROR** 4단계로 닫는다. FAIL=배포 차단.
4. **수정은 생산자에게.** 발견 이슈는 원인 계층 에이전트로 라우팅한다.
5. **배포 전 단일 관문.** 이 검증 통과 후에만 `/sync`(커밋·푸시) → `/deploy`(Cloudflare Workers).

## 0-A. 도구 선확인

- `node --version`·`npm --version`을 먼저 보고 `node_modules`가 있는지 확인한다. 없으면 해당 항목은 `SKIP(도구 없음)`이고 판정은 **ERROR**(측정 불가)다. `npm ci`는 메인 세션 몫.
- 리뷰어 위임 전 `.claude/agents/{name}.md`의 `tools:` 줄을 확인한다.
- 다른 세션이 테스트·dev 서버 실행 중이면 verify-loop를 시작하지 않는다(R6·R7).

## 1. verify-loop — 타입·린트·테스트·빌드 (기계적 검증)

verify-manager가 직접 실행한다. 변경 범위에 따라 워크스페이스를 가른다.

### 1.1 범위 결정
| 변경(`git status --porcelain`·`git diff --name-only HEAD`) | 범위 |
|---|---|
| `ui/**` | ui |
| `server/**` | server |
| `shared/**` | 전체(둘 다 의존) |
| 루트 `package.json`, `tsconfig*`, `server/wrangler.toml`, `server/.dev.vars.example`, `server/migrations/**` | 전체 |
| 변경 없음 | 전체 |

### 1.2 항목 (모두 비변경 모드 — 소스 미수정)
| 범위 | 검증 | 명령 (프로젝트 루트 기준) | 성공 기준 |
|---|---|---|---|
| 전체 | 타입 | `npx tsc --noEmit -p shared` · `npx tsc --noEmit -p server` · `npx tsc --noEmit -p ui` | exit 0 ×3 |
| 전체 | 린트 | `npm run lint` | exit 0 |
| 범위 | 테스트 | `npx vitest run server` · `npx vitest run ui`(순차 — R6) | 전체 PASS |
| 전체 | 빌드 | `npm run build` | exit 0 |

- 항목은 **순차** 실행(테스트 직렬 R6). 각 항목 exit code·출력 기록.
- 즉시 중단하지 않고 모든 항목 실행 후 종합. SKIP 규칙: `tsc` FAIL → 해당 워크스페이스 테스트·빌드 SKIP.
- **자동 수정 금지.** 포맷 불일치·미사용 import 등 Fixable 이슈는 고치지 않고 `ui-postprocessor`(ui) / `server-manager`(server) 라우팅 대상으로 기록한다.
- 결과는 **PASS / FAIL**로 닫는다.

### 1.3 배포 전 추가 확인 (verify-manager 직접, 읽기만)

| 항목 | 확인 | 실패 시 |
|---|---|---|
| env 키 일치 | `server/.dev.vars.example`(비밀값) ∪ `server/wrangler.toml [vars]`(설정) 키 집합 = `server/src/env.ts` `parseEnv` zod 스키마 키 집합. 비밀값 키(`TOKEN_SECRET`·`LLM_API_KEY`)가 `[vars]`에 **없음** | HIGH, server-manager |
| 번들 비밀값 grep(R-NFR-004) | `npm run build -w ui` 뒤 `grep -rE "TOKEN_SECRET|LLM_API_KEY|Authorization" ui/dist` 0건, `server/dist`(dry-run 산출)에서 비밀값 실값 패턴 0건. 화면 수동 확인표 MC-RM-06을 대체하는 자동 검사 | HIGH, verify-security-reviewer |
| D1·자산 바인딩 | `wrangler.toml`의 `[[d1_databases]] binding = "DB"`·`[assets] directory = "../ui/dist"`·`nodejs_compat`가 env.ts 바인딩 타입과 일치, 미적용 마이그레이션(`wrangler d1 migrations list <DB> --local`) 없음 | HIGH, server-manager |
| frame-ancestors | `env.ts` 기본값·`wrangler.toml [vars]`·api.md §7이 `http://london-gossip.my https://london-gossip.my`로 일치 | HIGH, contract-manager |
| 레이트리밋 기본값 | `env.ts` 기본값 = 확정사항 §5.2(20/min) = api.md §6 | MEDIUM, contract-manager |
| 토큰 조각 | `doc/handoff/token-snippet.php.md`의 payload 필드 = `shared/src/types.ts` `TokenPayload` | HIGH, contract-manager |
| 비밀값 커밋 | `git ls-files` 에 `server/.dev.vars`·`server/.wrangler/`·`*.sqlite` 없음, `git grep -n "sk-\|TOKEN_SECRET=" -- ':!server/.dev.vars.example'` 결과 없음, `wrangler.toml [vars]`에 비밀값 없음 | CRITICAL, 즉시 사용자 보고 |

## 2. 3대 리뷰 (병렬, 읽기 전용)

verify-manager가 세 리뷰어를 **한 번에 병렬 위임**한다. 각 리뷰어는 심각도(CRITICAL/HIGH/MEDIUM/LOW) + 이슈코드로 보고한다. 리뷰어에는 「적용 메모리」를 넣지 않는다.

### 2.1 보안 리뷰 (verify-security-reviewer) — 외부 공개 웹 서비스 위협 모델
대상: `server/src/**`, `shared/src/**`, `ui/src/api/**`, `server/wrangler.toml`, `server/.dev.vars.example`, `server/migrations/**`, `.gitignore`, `doc/handoff/**`. 이슈코드 `SEC-NNN`.
- 위협 모델: 토큰 없는/위조한 쓰기 요청(API 요금 남용) / 비밀값 노출(로그·응답·레포) / 유저 텍스트를 통한 프롬프트 주입 / 다른 사이트가 iframe으로 끼움(클릭재킹) / 과도한 요청(레이트리밋 우회) / SQL·입력 검증 우회 / 제공사 에러 원문 노출.
- 항목: HMAC 검증이 타이밍 안전인가(Web Crypto `crypto.subtle.verify` 또는 상수 시간 비교), `exp`·`level` 검사 순서, 바인딩 설정 키·`process.env` 직접 읽기가 `env.ts` 밖에 없는가, 로그 금지 필드(토큰·키·프롬프트·유저 텍스트), 파라미터 바인딩, 요청 zod 스키마 `max`·enum, 레이트리밋이 D1 행 기반이고 키가 토큰 기준인가(메모리 카운터면 우회 가능), speak 잠금이 D1 조건부 UPDATE인가, `frame-ancestors` 값, `/api/*`에 `frame-ancestors 'none'`, Hono `secureHeaders()` 기본 헤더, 유저 입력이 시스템 프롬프트에 섞이지 않는가, 에러 응답에 스택·경로·SQL 없음, `server/.dev.vars`·`server/.wrangler/` git 제외, `wrangler.toml [vars]`에 비밀값 없음, handoff 문서에 실값 없음, dev 전용 라우트가 production에서 꺼지는가.

### 2.2 코드 리뷰 (verify-code-reviewer) — 2-Stage
대상: 변경된 `ui/src/**/*.ts`·`*.tsx`, `shared/src/**`, `ui/src/api/**`. 이슈코드 `CR-NNN`. 판정 `APPROVE / REQUEST CHANGES / COMMENT`.
- **Stage 1 (Spec 준수):** 화면 `design.md` 대비 누락·과잉, `ui/src/api/*` 호출이 `api.md`와 일치. design.md 없으면 SKIP.
- **Stage 2 (품질):** `ts-rules`·`tsx-rules`·`golden-principles`(TSX 400줄·함수 50줄), **계층 경계**(화면에서 `fetch` 직접 사용 금지, `ui/src/state`는 순수 TS, 래퍼는 throw 금지·`Result` 반환), **토큰 취급**(localStorage·쿠키 저장 금지, 쓰기 UI 미렌더 분기), 접근성(aria-label·role=log·키보드), 스크롤 보존·중복 요청 잠금.

### 2.3 server 리뷰 (verify-server-reviewer) — 5-Phase
대상: 변경된 `server/src/**/*.ts`, `server/test/**`, `server/package.json`. 이슈코드 `SRV-NNN`. 기준은 `server-design-strategy` §15 체크리스트.
- Phase 1 모듈 경계·의존 방향·env 단일 진입(`parseEnv` 값 주입) / Phase 2 비동기·동시성(speak D1 조건부 UPDATE 잠금·만료, `ctx.waitUntil` 요약 에러 포착, 미처리 promise, 메모리 상태 없음) / Phase 3 에러 처리(AppError·코드·단일 `app.onError`·cause 보존) / Phase 4 D1(파라미터 바인딩·`batch` 원자성·조건부 UPDATE·마이그레이션 불변·기동 시 자동 마이그레이션 없음) / Phase 5 LLM 어댑터·프롬프트(`fetch` 기반·타임아웃·재시도·후처리·순수 함수·FakeProvider 주입).

> **False Positive 금지(공통):** 프레임워크가 이미 보호하는 항목, 테스트 코드의 단순화, 정상 코드 나열은 보고 금지. 역할을 넘지 않는다(보안=security, 품질=code, 서버=server).

## 3. 게이트 판정

| verify-loop | 리뷰 종합 | 판정 | 행동 |
|---|---|---|---|
| PASS | CRITICAL 0 + HIGH 0 | **PASS** | `/sync` → `/deploy` 연결 제안 |
| PASS | CRITICAL 0 + HIGH 있음 | **WARN** | 사용자 선택(수정 후 재검증 / 인지 후 진행 / 취소) |
| PASS | CRITICAL 있음 | **FAIL** | 배포 차단 — CRITICAL 즉시 수정 |
| FAIL | (리뷰 생략) | **FAIL** | 배포 차단 — 타입/테스트/빌드부터 |
| 도구 없음 또는 리뷰어 2개 이상 실패 | — | **ERROR** | 설치·재실행 |

- verify-loop FAIL이면 리뷰 생략, 즉시 FAIL. §1.3의 비밀값 커밋 CRITICAL도 즉시 FAIL.
- 리뷰어 1개 실패 → 나머지로 판정 진행 + 실패 표기. 2개 이상 실패 → ERROR.
- 동일 파일:라인의 유사 이슈는 더 높은 심각도로 중복 제거한다.

## 4. 워크플로우 위치

```
[생산]  server / contract / ui (설계→구현→테스트, 각 패키지 내부 게이트 통과)
   ↓
[검증]  verify-manager ──┬─ verify-loop (tsc·lint·vitest·build) + 배포 전 추가 확인
                         ├─ 병렬 리뷰: security · code · server
                         └─ 게이트: PASS / WARN / FAIL / ERROR
   ↓ PASS
[배포]  /sync (커밋·푸시)  →  /deploy (wrangler d1 migrations apply --remote → wrangler deploy → 헬스체크)
```

- 단독 실행 가능("배포 전 검증해줘", "보안 검토", "코드 리뷰", "서버 리뷰").
- 리포트는 `doc/300_검증/verify-{YYYYMMDD-HHMM}.md`.

## 5. 수정 라우팅 (verify는 고치지 않는다)

| 이슈 원인 | 라우팅 대상 |
|---|---|
| 화면(.tsx)·대화 상태(ui/src/state) 버그·품질·경계 위반 | `ui-debug` |
| 포맷·미사용 코드 정리(ui) | `ui-postprocessor`(옵트인) |
| 계약(api.md·shared·routes·ui/src/api·handoff) 불일치, 토큰·CSP·레이트리밋 | `contract-manager` 세션 |
| 서비스(env·db·auth·rooms·messages·memory·llm)·서버 포맷 | `server-manager` 세션 |
| `server/wrangler.toml`·`server/.dev.vars.example`·`server/migrations/**` | `server-manager` 세션 |
| 루트 `package.json`·tsconfig·의존성 | 메인 세션(사용자 승인) |

- 수정 후 **재검증**으로 닫는다(수정→재검증 반복, 같은 실패 3회면 멈추고 보고).
- 완료(PASS) 보고에 **단계 체크리스트 + 실행 증거** 포함 필수.
