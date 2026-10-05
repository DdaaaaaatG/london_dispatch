---
paths:
  - "server/**"
  - "shared/**"
  - "ui/**"
---

# Golden Principles (런던_디스패치 적용)

> 코드를 읽거나 쓸 때 항상 걸리는 원칙. 다른 규칙 문서에 있는 것은 중복하지 않는다.
> 불변성·컴포넌트 규칙 → tsx-rules.md | 서버 관례 → server-rules.md | TDD 절차 → ui-design-strategy / server-design-strategy

## 1. 작은 파일, 작은 함수

한계를 넘으면 분리한다. "조금 넘었다"는 예외가 아니다.

| 대상 | 파일 한계 | 함수 한계 |
|---|---|---|
| 서버 TS 모듈 (`server/src/**/*.ts`) | 400줄 | 50줄 |
| React 컴포넌트 (`.tsx`) | 400줄 | 50줄 |
| 공용 TS 모듈 (`shared/`, `ui/src/**/*.ts`) | 400줄 | 50줄 |

- 예외: Vite 산출물, 테스트 픽스처·스냅샷, 데이터 상수 파일(`characters.ts`, 프롬프트 텍스트).
- 서버에서 함수가 길어지면 서비스 함수를 쪼갠다. React에서는 서브 컴포넌트나 커스텀 훅으로 뺀다. 라우트 핸들러는 30줄 — 넘으면 로직이 서비스로 가야 할 신호.

## 2. 결론 먼저, 근거 나중

첫 문장에 결론. 그 다음에 "왜냐하면"을 붙인다. 보고·리뷰·설계 문서 모두 같다.

## 3. 비유로 설명

기술 개념을 설명할 때는 일상 비유 1~2문장을 먼저 두고 기술 설명을 뒤에 둔다.
예: "토큰은 갠홈이 써 준 출입증이다. 서버는 도장(서명)이 진짜인지, 유효기간이 지났는지만 본다. 회원 명부는 갠홈이 갖고 있다."

## 4. 컨텍스트 50% 규칙

대형 작업은 단계별로 나누어 새 세션에서 실행한다.
- server 모듈 1개의 설계 + 구현 + 테스트를 한 세션에 몰지 않는다.
- 화면 1개(rooms 또는 chat)의 설계 + 구현 + 테스트도 마찬가지다.
- 검증(verify-manager)은 별도 세션을 권장한다.

## 5. 증거 기반 완료

"이렇게 하면 작동할 것입니다"는 금지. 추측성 완료 선언은 거짓이다.
완료 보고에는 실행 증거를 붙인다.

| 계층 | 증거 |
|---|---|
| server | `npx vitest run server` 결과(테스트 수·PASS — `@cloudflare/vitest-pool-workers`, workerd 안에서 D1 바인딩 포함), `npx tsc --noEmit -p server` exit 0, 필요 시 `wrangler dev` 상대로 `curl` 응답 본문 |
| contract | api.md ↔ `shared/src/types.ts` ↔ `server/src/routes/*` ↔ `ui/src/api/*` 대조표, `npx tsc --noEmit` 세 워크스페이스 exit 0 |
| ui | `npx vitest run ui` 결과, `npm run build`(vite build + `wrangler deploy --dry-run`) exit 0, 스크린샷 경로(`doc/300_검증/screenshots/…`) |

## 6. 비밀값 격리

- 설정·비밀값은 `server/src/env.ts`에서만 읽는다. Workers에는 `process.env`가 없고 요청마다 `env` 바인딩 객체가 들어오므로, `index.ts`가 받은 바인딩을 `parseEnv(raw)`로 한 번 검증해 서비스에 **값으로 전달**한다. 다른 모듈은 바인딩 키(`TOKEN_SECRET`, `LLM_API_KEY` 등)를 직접 읽지 않으며, `process.env`·`import.meta.env`가 env.ts 밖에 있으면 훅(`ld-secret-scope-guard.sh`)이 차단한다.
- API 키·HMAC SECRET 실값은 운영은 Cloudflare Secrets(`wrangler secret put`), 로컬은 `server/.dev.vars`(git 제외)에만. `server/.dev.vars.example`에는 키 이름과 설명만. 비밀 아닌 설정만 `wrangler.toml [vars]`에 둔다.
- 로그·에러 메시지·HTTP 응답·화면·문서·커밋 메시지에 실값을 넣지 않는다. 토큰 payload도 로그에 통째로 찍지 않는다(mb_id만).
- 화면은 토큰을 URL(`?t=`)에서 읽어 **메모리에만** 둔다. `localStorage`·쿠키 저장 금지.

## 합리화 방지

| 원칙 | 변명 | 현실 |
|---|---|---|
| 파일 크기 | "나눌 만큼 크지 않다" | 400줄 넘으면 분리 |
| 함수 크기 | "한 곳에 있어야 읽기 편하다" | 50줄 넘으면 이름 붙은 함수로 추출 |
| 결론 먼저 | "맥락 없이 결론이 어렵다" | 결론 한 줄 먼저, 맥락은 그 다음 |
| 컨텍스트 | "아직 여유 있다" | 대형 작업은 세션 분리 |
| 증거 기반 | "이미 잘 작동한다" | 실행 결과 없이 완료 = 거짓 |
| TDD | "너무 단순해서 테스트 불필요" | 토큰 검증·프롬프트 조립·페이지네이션·상태 전이는 테스트 100% |
| 비밀값 | "여기서 한 줄만 읽으면 편하다" | env.ts 밖 `process.env`·바인딩 직접 읽기는 훅이 차단. parseEnv 결과를 값으로 받는다 |
| 불변성 | "성능 때문에 mutation 필요" | 프로파일링 증명 후에만 허용 |
