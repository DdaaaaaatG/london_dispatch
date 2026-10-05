---
description: 검증 빌드 — npm run typecheck(server·shared·ui tsc --noEmit) + npm run build(ui vite build + wrangler deploy --dry-run --outdir dist). 배포가 아니라 "컴파일·번들이 되는가"만 본다
---

# 검증 빌드

소스가 컴파일·번들되는지 두 단계로 확인한다. 배포는 하지 않는다(그건 `/deploy`).

> 프로젝트 루트가 작업 디렉터리다. 절대 경로를 쓰지 않는다.

## 실행 단계 (모두 실행한 뒤 종합 — 중간에 멈추지 않는다)

1. **타입 검사 (세 워크스페이스)**
   ```bash
   npm run typecheck 2>&1 | tail -40
   ```
   `shared` → `server` → `ui` 순으로 `tsc --noEmit`을 돈다. `shared`가 깨지면 나머지 둘도 같은 원인으로 깨지므로 첫 오류를 먼저 본다.

2. **빌드**
   ```bash
   npm run build 2>&1 | tail -40
   ```
   - ui: `vite build` → `ui/dist/` (Workers Static Assets `[assets]`가 `/embed`로 서빙)
   - server: `wrangler deploy --dry-run --outdir dist` → `server/dist/` (Workers 번들만 만들고 **배포하지 않는다**. `--dry-run`이 빠지면 실배포라 훅이 경고한다)
   - 둘 다 `.gitignore` 대상. 번들 단계는 `server/wrangler.toml`(nodejs_compat·바인딩·`[assets]` 경로)을 읽으므로 ui 빌드가 먼저다.

## 결과 보고 형식

```
검증 빌드: PASS | FAIL
- typecheck shared : exit 0 | 오류 n건 (파일:라인 첫 3건)
- typecheck server : exit 0 | 오류 n건
- typecheck ui     : exit 0 | 오류 n건
- build ui         : exit 0 | 오류 요약
- build server(dry-run) : exit 0 | 오류 요약
```

## 실패 라우팅

| 실패 위치 | 라우팅 |
|---|---|
| `shared/**` · `server/src/routes/**` · `ui/src/api/**` | contract-manager 세션 (계약↔타입↔라우트↔래퍼 불일치 포함) |
| `server/src/**`(routes 제외) · `server/wrangler.toml` · `server/migrations/**` | server-manager 세션 |
| `ui/src/**`(api 제외) | ui-debug 세션 |
| Workers 호환 오류(`node:` 모듈·네이티브 의존성·`process.env`) | server-manager 세션 — `nodejs_compat`로 되는지, 어댑터를 `fetch` 기반으로 바꿀지 판단 |

- 자동 수정하지 않는다. 이 명령은 측정만 한다.
- 경고(warning)는 보고에 포함하되 PASS 판정을 막지 않는다. `npm run lint`는 verify-manager 몫이다.
