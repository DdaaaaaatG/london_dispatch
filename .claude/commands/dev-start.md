---
description: 개발 환경 시작 — Node 툴체인 확인 → npm run dev(server+ui) 백그라운드 기동(이미 떠 있으면 재사용) → 상태 보고
---

# 개발 환경 시작

`npm run dev`로 서버(Fastify, 기본 3000)와 화면(Vite, 기본 5173)을 함께 띄운다. Vite가 `/api`를 서버로 프록시한다.

> 프로젝트 루트가 작업 디렉터리다. 절대 경로를 쓰지 않는다.

## 0. 툴체인·환경 확인 (실패하면 여기서 중단)

```bash
node --version && npm --version
```

- Node 22 이상이 아니면 **설치는 사용자 몫**이다. 안내하고 멈춘다. 이 세션에서 설치 명령을 실행하지 않는다(라이브러리 설치 허가제).
  - https://nodejs.org (LTS) 또는 `winget install OpenJS.NodeJS.LTS`
- `node_modules`가 없으면 `npm ci`(기존 의존성 복원 — 허가제 대상 아님). `package-lock.json`이 없으면 `npm install`(인자 없음).
- `.env`가 없으면 **사용자에게 안내**하고 멈춘다. 자동으로 만들지 않는다.
  - `.env.example`을 `.env`로 복사하고 값을 채운다. 비밀값(`LLM_API_KEY`, `TOKEN_SECRET`)은 사용자가 넣는다.
  - dev용 `TOKEN_SECRET`은 아무 문자열이어도 된다(운영값과 달라야 한다).
  - `LLM_API_KEY`가 비어 있으면 `speak`는 실패하지만 나머지 화면·API는 동작한다.
- `.env`는 Read 도구로 열지 않는다(`settings.json` deny). 존재 여부만 `ls -la .env`로 본다.

## 1. 이미 떠 있는지 확인

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || echo "server not running"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ || echo "vite not running"
```

- 둘 다 `200`이면 이미 실행 중 → 재시작하지 않고 3단계로.
- 하나라도 응답 없음 → 2단계. 포트가 다르면 `server/src/env.ts`의 `PORT`·`ui/vite.config.ts`의 `server.port`를 본다.

## 2. 백그라운드 시작

```bash
npm run dev > .dev.log 2>&1 &
```

- Bash 도구의 `run_in_background`로 실행한다(포그라운드는 세션이 막힌다).
- 로그: `.dev.log`(루트, `.gitignore` 대상). server(`tsx watch`)와 ui(`vite`)가 concurrently로 한 로그에 섞여 나온다.
- 기동 확인은 1단계 curl 재시도로 한다. **15초 간격 최대 10회.**
- 서버 기동 오류(`Error:` / `ZodError` / `SQLITE_`)가 나면 로그 줄을 그대로 보고하고 `/dev-build`로 원인을 좁힌다. `.env` 누락 키는 `env.ts` 검증 메시지가 알려준다.

## 3. 상태 보고

| 항목 | 확인 |
|---|---|
| server (`:3000/api/health`) | curl 200 + 응답 본문(`{"ok":true,...}`) |
| vite (`:5173/`) | curl 200 |
| DB | 로그의 `database ready` 줄 또는 `ls data/` |
| 로그 | `.dev.log` 마지막 20줄 |

## 이후 — 소스 수정 시

- `ui/**` 수정: Vite HMR이 자동 반영한다.
- `server/**`·`shared/**` 수정: `tsx watch`가 서버를 재시작한다(수 초). 로그로 완료 확인.
- 화면을 눈으로 확인하려면 `/run-app`(스크린샷 저장). 쓰기 권한 화면은 테스트 토큰이 필요하다(`/run-app` 2단계).
