---
name: tech-research
description: 기술/라이브러리 조사 및 추천 — npm 패키지, Hono 미들웨어, Cloudflare Workers 호환 라이브러리, AI 제공사 SDK. 조사 절차(공식 문서 → npm 지표 → 라이선스 → Workers 호환(네이티브 모듈 없음·fetch 기반)·workerd 지원 → 유지보수 상태 → 확정사항 충돌 검사), 비교표·추천 보고 양식, 설치 허가제(설치는 사용자 승인 후 메인 세션에서)를 정의한다. "라이브러리 검색", "패키지 추천", "SDK 비교", "기술 조사", "tech research" 요청 시 참조한다.
---

# 기술 조사 (Tech Research)

- 목적: 필요한 기능을 **어떤 npm 패키지·플러그인·SDK로** 해결할지 근거와 함께 추천한다.
- 적용: 메인 세션(WebSearch·WebFetch 사용). 서브에이전트는 이 스킬로 조사하되 **설치하지 않는다**.
- 제품 규격은 `doc/000_프로젝트_확정사항.md`. 확정사항과 충돌하는 후보(예: 서버 없는 브라우저 직접 LLM 호출, D1 대신 외부 DB·ORM, Node 전용 서버 프레임워크, 관리 화면 프레임워크)는 추천하지 않는다.

## 1. 조사 절차

| 단계 | 내용 | 확인 지점 |
|---|---|---|
| 1 | **요구 정리** | 무엇을(기능), 어디서(server/contract/ui), 제약(Workers — 네이티브 모듈 불가·인스턴스 여럿·요청당 CPU 10ms·번들 크기·iframe·요금) |
| 2 | **기존 보유 확인** | 각 `package.json`·Workers 내장 Web API(`fetch`, `crypto.subtle`, `crypto.randomUUID`, `AbortSignal.timeout`, `TextEncoder`)·Hono 내장 미들웨어(`secureHeaders`, `logger`, `cors`)·D1 바인딩으로 이미 되는지. 되면 조사 종료 |
| 3 | **후보 수집** | 공식 문서(npmjs, hono.dev, developers.cloudflare.com/workers, 제공사 API 문서) 우선. 블로그·SO는 보조 |
| 4 | **지표** | npm 주간 다운로드·최근 릴리스 일자·open issue·TypeScript 타입 제공·ESM 지원·Workers 호환 명시 |
| 5 | **라이선스** | MIT/Apache-2.0/BSD 선호. 그 외는 표기 |
| 6 | **런타임 지원** | Workers 호환(네이티브 모듈 없음·`fetch` 기반·`node:` 모듈 의존 여부 — `nodejs_compat`로 되는지 workerd에서 확인), `wrangler dev`에서 동작, 번들 크기(Workers 1MB/3MB 한도), 브라우저 번들 크기(ui) |
| 7 | **확정사항 충돌** | env 단일 진입을 깨는가(패키지가 `process.env`를 직접 읽는가 — Workers에는 없으니 옵션으로 값을 넘길 수 있어야 한다), 프로세스 메모리 상태에 의존하는가(인스턴스 여럿), 비밀값을 브라우저로 보내는가, 관리 화면·DB 종류 변경 유발 |
| 8 | **결론** | 후보 ≤ 3개 비교표 + 추천 1개 + 근거 + 설치 명령(실행하지 않음) |

## 2. 자주 나오는 영역과 기본 방향

| 영역 | 기본 방향 | 비고 |
|---|---|---|
| HTTP 서버 | `hono` 4 (Workers 네이티브) + 내장 미들웨어(`secureHeaders`·`logger`·`cors` 필요 시) | 🔒 확정. express·Node 전용 프레임워크로 바꾸지 않는다 |
| 런타임·배포 | Cloudflare Workers(`nodejs_compat`) + `wrangler`(devDependency) + `@cloudflare/workers-types` | 🔒 확정 |
| DB | Cloudflare D1(바인딩 `DB`, `prepare/bind/run/first/all/batch`) + `server/migrations/*.sql` | ORM(drizzle 등) 도입은 요구 입증 후. 동기 SQLite 드라이버·네이티브 모듈 불가 |
| 정적 화면 | Workers Static Assets(`wrangler.toml [assets]`) | 별도 static 미들웨어 불필요 |
| 스키마 검증 | `zod` (env·서비스 입력) + `@hono/zod-validator`(라우트) | JSON Schema 변환 도구 불필요 |
| 로그 | Workers `console`을 감싼 얇은 JSON 로거(index.ts) + `wrangler tail` | 별도 로거 패키지 불필요 |
| 토큰 서명 | Web Crypto `crypto.subtle`(HMAC-SHA256 `sign`/`verify`) | jsonwebtoken 등 불필요(갠홈 PHP와 맞추기 위해 단순 HMAC) |
| 레이트리밋·잠금 | D1 테이블(`rate_limits`·`rooms.speaking_until`) 조건부 UPDATE | 메모리 기반 레이트리밋 패키지 불가(인스턴스 여럿) |
| LLM 호출 | 후보: `@anthropic-ai/sdk` · `openai` · `@google/genai`. 제공사 미정 → `llm/` 어댑터 인터페이스 뒤에 하나만 설치 | 승인 전엔 `fetch` 직접 호출 어댑터 허용 |
| 식별자 | Web Crypto `crypto.randomUUID()` | nanoid 불필요 |
| 화면 | `react` 18 + `react-dom` + `vite` 6 + `@vitejs/plugin-react` | 라우터·상태 라이브러리 불필요(화면 2개) |
| 스타일 | CSS Modules(Vite 내장) | Tailwind·UI 킷 금지(확정사항) |
| 아이콘 | 인라인 SVG | 아이콘 라이브러리는 필요 입증 후 |
| 테스트 | `vitest` + `@testing-library/react` + `@testing-library/user-event` + `jsdom` / 서버 `@cloudflare/vitest-pool-workers`(workerd + D1 바인딩, 라우트는 Hono `app.request()`) | HTTP 테스트 패키지 추가 불필요 |
| 린트 | `eslint` 9(flat config) + `typescript-eslint` + `prettier` + `eslint-plugin-react-hooks` | |
| 개발 실행 | `wrangler dev --port 3000`(server, 로컬 D1) + `vite`(ui) + `concurrently`(루트) | |
| 배포 | `wrangler deploy`(devDependency, 전역 설치 없음) · Secrets는 `wrangler secret put` | `server/wrangler.toml` 사용. `/deploy` 전용 |
| 스크린샷 | 브라우저 MCP(puppeteer) 우선, 없으면 PowerShell 캡처 | `puppeteer` npm 설치는 승인 후 |

## 3. 보고 양식

```
[기술 조사] {주제}
■ 요구: … (계층: server/contract/ui, 제약: …)
■ 기존 보유로 해결 가능? 예/아니오 (근거)
■ 후보 비교
| 후보 | 버전·최근 릴리스 | 라이선스 | Workers 호환/ESM/nodejs_compat 의존 | 다운로드/이슈 | 확정사항 충돌 | 비고 |
■ 추천: {후보} — 근거 3줄
■ 설치 명령(실행 안 함): npm install -w server … / npm install -w ui -D …
■ 도입 시 영향: package.json(워크스페이스)·env 키·번들 크기·네이티브 빌드
■ 출처: (URL 목록)
```

## 4. 설치 허가제

- 조사와 설치는 분리한다. **설치는 메인 세션에서 사용자 승인 후**에만 실행한다. 서브에이전트의 `npm install <pkg>`·`npx <미허용 도구>`는 훅이 차단한다.
- 설치는 워크스페이스를 명시한다(`npm install -w server zod`). 루트에 설치하지 않는다(루트 devDependencies는 `concurrently`·`prettier`·`eslint` 계열만).
- 승인 후 설치했으면 `doc/state.json` `dependencies_approved`(구축 중) 또는 완료 보고에 기록한다.
