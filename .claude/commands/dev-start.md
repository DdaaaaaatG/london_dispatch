---
description: 개발 환경 시작 — Node 툴체인·server/.dev.vars 확인 → 로컬 D1 마이그레이션 적용 → npm run dev(wrangler dev :3000 + vite :5173) 백그라운드 기동(이미 떠 있으면 재사용) → 상태 보고
---

# 개발 환경 시작

`npm run dev`로 서버(`wrangler dev --port 3000`, 로컬 workerd + 로컬 D1)와 화면(Vite, 기본 5173)을 함께 띄운다. Vite가 `/api`를 서버로 프록시한다. Node는 로컬 도구일 뿐이고 서버 코드는 workerd 안에서 돈다.

> 프로젝트 루트가 작업 디렉터리다. 절대 경로를 쓰지 않는다.

## 0. 툴체인·환경 확인 (실패하면 여기서 중단)

```bash
node --version && npm --version
```

- Node 22 이상이 아니면 **설치는 사용자 몫**이다. 안내하고 멈춘다. 이 세션에서 설치 명령을 실행하지 않는다(라이브러리 설치 허가제).
  - https://nodejs.org (LTS) 또는 `winget install OpenJS.NodeJS.LTS`
- `node_modules`가 없으면 `npm ci`(기존 의존성 복원 — 허가제 대상 아님). `package-lock.json`이 없으면 `npm install`(인자 없음). wrangler는 `server/` devDependency라 같이 복원된다(`npx wrangler --version`으로 확인).
- `server/.dev.vars`가 없으면 **사용자에게 안내**하고 멈춘다. 자동으로 만들지 않는다.
  - `server/.dev.vars.example`을 `server/.dev.vars`로 복사하고 값을 채운다. 비밀값(`LLM_API_KEY`, `TOKEN_SECRET`)은 사용자가 넣는다. 비밀 아닌 설정은 `server/wrangler.toml [vars]`에 이미 있다.
  - dev용 `TOKEN_SECRET`은 아무 문자열이어도 된다(운영 Secrets 값과 달라야 한다).
  - `LLM_API_KEY`가 비어 있으면 `speak`는 실패하지만 나머지 화면·API는 동작한다.
- `server/.dev.vars`는 Read 도구로 열지 않는다. 존재 여부만 `ls -la server/.dev.vars`로 본다.

## 0-1. 로컬 D1 마이그레이션 적용

```bash
npx wrangler --config server/wrangler.toml d1 migrations apply <DB> --local
```

- `<DB>`는 `server/wrangler.toml [[d1_databases]]`의 `database_name`. `--local`을 꼭 붙인다(`--remote`는 운영 DB — 가드가 막는다).
- 로컬 D1 상태는 `server/.wrangler/`(git 제외)에 생긴다. 이미 적용된 마이그레이션은 건너뛴다(멱등).
- 미적용이 없다는 출력이면 그대로 다음 단계로.

## 1. 이미 떠 있는지 확인

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || echo "server not running"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ || echo "vite not running"
```

- 둘 다 `200`이면 이미 실행 중 → 재시작하지 않고 3단계로.
- 하나라도 응답 없음 → 2단계. 포트가 다르면 루트 `package.json`의 dev 스크립트(`wrangler dev --port 3000`)·`ui/vite.config.ts`의 `server.port`·프록시 대상을 본다.

## 2. 백그라운드 시작

```bash
npm run dev > .dev.log 2>&1 &
```

- Bash 도구의 `run_in_background`로 실행한다(포그라운드는 세션이 막힌다).
- 로그: `.dev.log`(루트, `.gitignore` 대상). server(`wrangler dev`)와 ui(`vite`)가 concurrently로 한 로그에 섞여 나온다.
- 기동 확인은 1단계 curl 재시도로 한다. **15초 간격 최대 10회.**
- 서버 기동 오류(`Error:` / `ZodError` / `D1_ERROR` / `no such table`)가 나면 로그 줄을 그대로 보고하고 `/dev-build`로 원인을 좁힌다. `no such table`은 0-1단계 마이그레이션 미적용이다. `server/.dev.vars` 누락 키는 `env.ts`의 `parseEnv` 검증 메시지가 알려준다.

## 3. 상태 보고

| 항목 | 확인 |
|---|---|
| server (`:3000/api/health`) | curl 200 + 응답 본문(`{"ok":true,...}`) |
| vite (`:5173/`) | curl 200 |
| DB | 0-1단계 `migrations apply --local` 출력, `ls server/.wrangler/state` |
| 로그 | `.dev.log` 마지막 20줄 |

## 이후 — 소스 수정 시

- `ui/**` 수정: Vite HMR이 자동 반영한다.
- `server/**`·`shared/**` 수정: `wrangler dev`가 Worker를 다시 번들해 재기동한다(수 초). 로그로 완료 확인. `server/migrations/*.sql` 추가는 0-1단계를 다시 돌린다. `server/wrangler.toml` 변경은 dev 재시작이 필요하다.
- 화면을 눈으로 확인하려면 `/run-app`(스크린샷 저장). 쓰기 권한 화면은 테스트 토큰이 필요하다(`/run-app` 2단계).
