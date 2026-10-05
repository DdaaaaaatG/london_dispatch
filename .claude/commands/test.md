---
description: 전체 테스트 — npm test(vitest run). 인자로 server / contract / ui / <파일경로> 범위 지정 가능. 결과 요약과 실패 라우팅
---

# 테스트 실행

`/test` 뒤의 인자로 범위를 정한다. 인자가 없으면 전체.

> 프로젝트 루트가 작업 디렉터리다. 절대 경로를 쓰지 않는다.

| 인자 | 실행 |
|---|---|
| (없음) | `npm test` (= `npx vitest run`) |
| `server` | `npx vitest run server` |
| `contract` | `npx vitest run server/test/routes ui/src/api shared` |
| `ui` | `npx vitest run ui` |
| `<파일경로>` | `npx vitest run <파일경로>` |

## 실행

```bash
npx vitest run 2>&1 | tail -40
```

- **직렬 실행만.** 범위를 여러 개 돌릴 때도 한 번에 하나씩(공유 자원 R6 — SQLite 임시 파일·포트 충돌).
- `vitest`를 `run` 없이 실행하면 watch 모드로 세션이 막힌다.
- 서버 테스트는 임시 SQLite(`:memory:` 또는 tmp 파일)를 쓴다. `data/`의 실파일을 건드리면 설정 결함이다.
- LLM 호출은 테스트에서 항상 mock이다. 네트워크가 필요한 테스트가 있으면 결함으로 보고한다.

## 결과 보고 형식

```
테스트: PASS | FAIL
- vitest : N passed / M failed / K skipped  (실패: 파일 > 테스트명 …)
```

실패한 테스트는 **이름·파일·첫 단언 메시지**까지 적는다. "몇 개 실패"만 적지 않는다.

## 실패 라우팅 (이 명령은 고치지 않는다)

| 실패 위치 | 라우팅 |
|---|---|
| `server/test/**`(routes 제외) · `server/src/{db,auth,rooms,messages,memory,llm}` | server-manager 세션 |
| `server/test/routes/**` · `ui/src/api/**` · `shared/**` | contract-manager 세션 |
| `ui/src/rooms/**` · `ui/src/chat/**` · `ui/src/components/**` · `ui/src/state/**` | ui-debug 세션 (기존 화면) / ui-manager (구축 중) |

- 같은 테스트가 원인 수정 없이 2회 이상 실패하면 멈추고 보고한다.
- 전체 PASS는 `/sync` 전 verify-manager 게이트의 입력이 된다.
