---
name: tech-research
description: 기술/라이브러리 조사 및 추천 — npm 패키지, Fastify 플러그인, AI 제공사 SDK. 조사 절차(공식 문서 → npm 지표 → 라이선스 → Node 22·Railway 지원 → 유지보수 상태 → 확정사항 충돌 검사), 비교표·추천 보고 양식, 설치 허가제(설치는 사용자 승인 후 메인 세션에서)를 정의한다. "라이브러리 검색", "패키지 추천", "SDK 비교", "기술 조사", "tech research" 요청 시 참조한다.
---

# 기술 조사 (Tech Research)

- 목적: 필요한 기능을 **어떤 npm 패키지·플러그인·SDK로** 해결할지 근거와 함께 추천한다.
- 적용: 메인 세션(WebSearch·WebFetch 사용). 서브에이전트는 이 스킬로 조사하되 **설치하지 않는다**.
- 제품 규격은 `doc/000_프로젝트_확정사항.md`. 확정사항과 충돌하는 후보(예: 서버 없는 브라우저 직접 LLM 호출, ORM으로 SQLite 대체, 관리 화면 프레임워크)는 추천하지 않는다.

## 1. 조사 절차

| 단계 | 내용 | 확인 지점 |
|---|---|---|
| 1 | **요구 정리** | 무엇을(기능), 어디서(server/contract/ui), 제약(Railway 단일 인스턴스·번들 크기·iframe·요금) |
| 2 | **기존 보유 확인** | 각 `package.json`·Node 22 내장(`fetch`, `crypto`, `AbortSignal.timeout`)·Fastify 내장으로 이미 되는지. 되면 조사 종료 |
| 3 | **후보 수집** | 공식 문서(npmjs, fastify.dev, 제공사 API 문서) 우선. 블로그·SO는 보조 |
| 4 | **지표** | npm 주간 다운로드·최근 릴리스 일자·open issue·TypeScript 타입 제공·ESM 지원·Node 22 호환 |
| 5 | **라이선스** | MIT/Apache-2.0/BSD 선호. 그 외는 표기 |
| 6 | **런타임 지원** | Node 22 ESM, Railway Nixpacks 빌드(네이티브 모듈이면 prebuild 유무 — `better-sqlite3`는 prebuild 제공), 브라우저 번들 크기(ui) |
| 7 | **확정사항 충돌** | env 단일 진입을 깨는가(패키지가 `process.env`를 직접 읽는가 — 허용하되 env.ts에서 값을 넘기는 방식으로 쓸 수 있는지), 비밀값을 브라우저로 보내는가, 관리 화면·DB 종류 변경 유발 |
| 8 | **결론** | 후보 ≤ 3개 비교표 + 추천 1개 + 근거 + 설치 명령(실행하지 않음) |

## 2. 자주 나오는 영역과 기본 방향

| 영역 | 기본 방향 | 비고 |
|---|---|---|
| HTTP 서버 | `fastify` 5 + `@fastify/cors`(필요 시)·`@fastify/helmet`·`@fastify/rate-limit`·`@fastify/static` | 🔒 확정. express 등으로 바꾸지 않는다 |
| SQLite | `better-sqlite3` (동기, prebuild) | ORM(prisma·drizzle) 도입은 요구 입증 후 |
| 스키마 검증 | `zod` (env·서비스 입력) + Fastify JSON Schema(라우트) | 변환 도구(`zod-to-json-schema`)는 contract-designer 결정 |
| 로그 | `pino` (Fastify 내장) | 별도 로거 불필요 |
| 토큰 서명 | Node 내장 `crypto`(`createHmac`, `timingSafeEqual`) | jsonwebtoken 등 불필요(갠홈 PHP와 맞추기 위해 단순 HMAC) |
| LLM 호출 | 후보: `@anthropic-ai/sdk` · `openai` · `@google/genai`. 제공사 미정 → `llm/` 어댑터 인터페이스 뒤에 하나만 설치 | 승인 전엔 `fetch` 직접 호출 어댑터 허용 |
| 식별자 | Node 내장 `crypto.randomUUID()` | nanoid 불필요 |
| 화면 | `react` 18 + `react-dom` + `vite` 6 + `@vitejs/plugin-react` | 라우터·상태 라이브러리 불필요(화면 2개) |
| 스타일 | CSS Modules(Vite 내장) | Tailwind·UI 킷 금지(확정사항) |
| 아이콘 | 인라인 SVG | 아이콘 라이브러리는 필요 입증 후 |
| 테스트 | `vitest` + `@testing-library/react` + `@testing-library/user-event` + `jsdom` / 서버 `supertest` 또는 Fastify `inject`(추가 설치 없음) | `inject` 우선 |
| 린트 | `eslint` 9(flat config) + `typescript-eslint` + `prettier` + `eslint-plugin-react-hooks` | |
| 개발 실행 | `tsx watch`(server) + `vite`(ui) + `concurrently`(루트) | |
| 배포 | Railway CLI(`@railway/cli`, 전역 설치는 메인 세션·사용자 승인) | `railway.json` 사용 |
| 스크린샷 | 브라우저 MCP(puppeteer) 우선, 없으면 PowerShell 캡처 | `puppeteer` npm 설치는 승인 후 |

## 3. 보고 양식

```
[기술 조사] {주제}
■ 요구: … (계층: server/contract/ui, 제약: …)
■ 기존 보유로 해결 가능? 예/아니오 (근거)
■ 후보 비교
| 후보 | 버전·최근 릴리스 | 라이선스 | Node22/ESM/Railway | 다운로드/이슈 | 확정사항 충돌 | 비고 |
■ 추천: {후보} — 근거 3줄
■ 설치 명령(실행 안 함): npm install -w server … / npm install -w ui -D …
■ 도입 시 영향: package.json(워크스페이스)·env 키·번들 크기·네이티브 빌드
■ 출처: (URL 목록)
```

## 4. 설치 허가제

- 조사와 설치는 분리한다. **설치는 메인 세션에서 사용자 승인 후**에만 실행한다. 서브에이전트의 `npm install <pkg>`·`npx <미허용 도구>`는 훅이 차단한다.
- 설치는 워크스페이스를 명시한다(`npm install -w server zod`). 루트에 설치하지 않는다(루트 devDependencies는 `concurrently`·`prettier`·`eslint` 계열만).
- 승인 후 설치했으면 `doc/state.json` `dependencies_approved`(구축 중) 또는 완료 보고에 기록한다.
