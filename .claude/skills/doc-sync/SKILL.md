---
name: doc-sync
description: 배치 문서 동기화 전략. 마지막 /doc-sync 이후 git history로 수정된 기존 화면(ui/src/rooms·ui/src/chat)·server 모듈·contract 계약을 찾아, 화면은 requirements→scenarios→manual 동기화와 design.md 델타 대조·backfill을 단일 소유 에이전트(ui-designer/ui-test-designer/ui-manual-writer)에 위임하고, server 모듈은 문서주석↔doc/200_설계/server/*.md 대조를 server-designer에, contract는 api.md↔shared↔routes↔ui/api↔handoff 대조를 contract-analyst에 위임한 뒤, 전체 테스트를 재수행하고 CR을 「검증됨」으로 마킹하고 마커(doc/doc-sync-state.json)를 전진시킨다. 스킬 자체는 문서를 직접 쓰지 않는다. "문서 동기화", "doc-sync" 요청 또는 /doc-sync 명령 시 참조한다.
---

# 배치 문서 동기화 전략 (Doc-Sync)

- 소스 수정은 빠르게 하되(ui-debug 1단계·직접 수정), 문서는 **git history 기준으로 한꺼번에** 맞춘다. 기준은 *누가 고쳤는가*가 아니라 **무엇이 바뀌었는가**다.
- 이 문서가 그 절차의 **단일 소스**다. `/doc-sync` 명령은 언제·어떤 순서로 돌리는지만 정한다.

## 0. 전제 — 실행 위치

- **`Agent` 툴이 있는 메인 세션**에서 실행한다(문서 갱신을 단일 소유 에이전트에 위임해야 하므로).
- **문서를 직접 쓰지 않는다.** 화면 requirements/design=`ui-designer`, scenarios=`ui-test-designer`, manual=`ui-manual-writer`, server 설계 md=`server-designer`, 계약 대조=`contract-analyst`, 전체 테스트=`ui-tester`(+`vitest run`은 메인 세션 직접). doc-sync는 **오케스트레이션 + git 분석 + 마커 관리**만 한다.

## 1. 변경 범위 산출 (git 기반)

1. **마커 읽기.** `doc/doc-sync-state.json`:
   ```json
   { "lastSyncedSha": "…", "syncedAt": "yyyy-mm-dd", "syncedTargets": [], "openItems": {} }
   ```
   **마커가 없으면(최초) 사용자에게 기준 ref/날짜를 묻는다**(`/doc-sync --since <ref>`). 추측 금지. 최초 커밋을 임의로 기준 삼지 않는다 — 명령 문서도 같은 규칙이다.
2. **변경 파일 수집.** `git diff <lastSyncedSha>..HEAD --name-status` + 미커밋 작업트리(`git status --porcelain`).
3. **영역 분류.**

| 경로 | 영역 | 문서 | 위임 |
|---|---|---|---|
| `ui/src/rooms/**` | 화면 rooms | 화면 폴더 `requirements.md`·`design.md`·`test/scenarios.md`·`manual.md` | ui-designer → ui-test-designer → ui-manual-writer |
| `ui/src/chat/**`, `ui/src/state/**` | 화면 chat | 같음 (`ui/src/state`는 chat에 귀속) | 같음 |
| `ui/src/components/**` | 공용 컴포넌트 | `component-catalog` 스킬 인벤토리 | ui-component-designer |
| `server/src/{env.ts,db,auth,rooms,messages,memory,llm}/**` | server 모듈 | `doc/200_설계/server/{module}.md` | server-designer |
| `shared/**`, `server/src/routes/**`, `ui/src/api/**`, `doc/handoff/**` | contract | `doc/200_설계/contract/api.md` | contract-analyst(불일치는 contract-manager 인계) |
| `server/.dev.vars.example`, `server/wrangler.toml`, `server/migrations/**`, 루트 `package.json` | 설정 | server `env.md`·`db.md`·api.md §7의 해당 절 | server-designer / contract-analyst |

4. **변경 의도 수집.** `git log <lastSyncedSha>..HEAD --format='%h %s%n%b'` — 🔒 사용자 지정·변경 이유·CR-ID를 여기서 읽는다.

## 2. 대상 선별 — 수정된 기존 것만

- **신규 생성 제외.** 마커 이후 폴더·모듈이 새로 생겼고 `design.md`(또는 `doc/200_설계/server/{module}.md`)도 같은 구간에 추가(A)됐으면 생성 파이프라인이 문서를 함께 만든 것 — 제외하고 리포트에 「생성 — 제외」로만 표기.
- **기존 것의 수정(M)만 포함.** 기존 화면 안의 하위 컴포넌트 파일 추가는 그 화면의 *수정*이다.
- `ui/src/state/**` 변경은 **chat 화면**에 귀속한다(대화 상태 리듀서는 chat 설계의 일부).

## 3. 변경 요약 생성 (위임 입력)

- 대상마다 `git diff`/`git log`로 **사람이 읽는 변경 요약**을 만든다 — 소유 에이전트는 git을 읽지 않으므로 이 요약이 위임의 명시적 입력이다. 내용: 무엇이 바뀌었나(컴포넌트·상태·전이·api 호출·문구·서비스 시그니처·env 키·엔드포인트), 관련 커밋 메시지, 🔒 단서.
- **CR 대장 대조(backfill).** 화면 `test/change-requests.md`를 git history와 대조한다 — 소스 수정은 있는데 CR 엔트리가 없으면 커밋 메시지·diff로 엔트리를 보완하고, 조치 컬럼이 비어 있으면 채운다(과거 엔트리 삭제·재작성 금지 — append·상태 마킹만).
- **2단계 미완료 감지.** `test/scenarios.md` 「변경 대기열(미검증)」에 「대기」 행 또는 CR 「적용·미검증」이 있으면 ui-debug 2단계가 끝나지 않은 것 — 위임문에 「2단계 미완료: Q-nn…/CR-nnn… — design·requirements 델타를 이 배치가 대신 닫는다」를 명시한다. ui-debug 2단계를 먼저 돌리라고 되돌리지 않는다.

## 4. 문서 동기화 위임 (순서 중요)

### 4.1 화면 (대상 화면마다)
1. **requirements.md / design.md → `ui-designer`.** 컴포넌트·레이아웃·상태·api 호출·기능 명세에 영향을 준 변경이면 본문 + 변경이력 + RTM 갱신. 2단계 미완료 화면은 델타를 **신규 작성**(CR-ID별 변경이력 행 append, 요구가 바뀐 CR은 requirements 행도 함께 — 옛 요구는 「폐기(CR-nnn으로 대체)」 마킹). CSS·문구만 바뀌면 변경이력만.
2. **test/scenarios.md + vitest 스펙 → `ui-test-designer`.** TC 번호 보존, 추가·수정만. 대기열 「대기」 행이 있으면 `대기열: Q-nn…`으로 소진 모드 호출(행마다 TC ≥ 1, 상태 「전환됨(TC-nnn)」). 대기열이 전부 「검증됨」이고 대기열 밖 변경이 없으면 생략.
3. **manual.md → `ui-manual-writer`.** 사용법·외형·스크린샷이 어긋난 경우만.

### 4.2 server 모듈 (대상 모듈마다)
- `server-designer`에 위임: 모듈 `index.ts` 문서주석·공개 함수 시그니처·의존 ↔ `doc/200_설계/server/{module}.md` 대조, 어긋난 절 갱신 + 변경이력 행. 코드는 건드리지 않는다(문서를 코드에 맞춘다 — 코드가 설계를 위반했다고 판단되면 「확인 필요」로 리포트).

### 4.3 contract
- `contract-analyst`에 위임: `api.md` ↔ `shared/src/*` ↔ `server/src/routes/*` ↔ `ui/src/api/*` ↔ `doc/handoff/*` 대조 리포트. 불일치는 문서 수정이 아니라 **contract-manager 인계 항목**으로 리포트에 남긴다(계약 문서·handoff 소유는 contract-designer).

### 4.4 공용 컴포넌트
- 변경된 컴포넌트의 props·시그니처를 `component-catalog` 스킬에 반영하도록 `ui-component-designer`에 위임(인벤토리 행 갱신만).

## 5. 전체 테스트 재수행

- 메인 세션이 직접(순차, R6): `npx vitest run server`, `npx vitest run ui`, `npx tsc --noEmit`(shared·server·ui).
- `ui-tester`에 위임: 대상 화면 시나리오 전건 + 브라우저 스크린샷 → `test/result.md`.
- 실패는 고치지 않는다 — 리포트에 실패 TC·원인 후보를 남기고 `ui-debug`(화면) / `server-manager`(서비스) / `contract-manager`(계약) 라우팅.

## 6. 마킹·마커 전진

- 전건 PASS인 화면의 대기열 행·CR 엔트리를 「검증됨(yyyy-mm-dd, TC-nnn)」으로 마킹(`ui-test-designer`·`ui-designer` 위임 또는 메인 세션이 상태 컬럼만 편집).
- `doc/doc-sync-state.json` 갱신: `lastSyncedSha`=HEAD, `syncedAt`, `syncedTargets`, 미해결은 `openItems`에.
- 미커밋 산출물은 `/sync` 대상임을 보고에 명시한다.

## 7. 리포트 양식 (최종 응답)

```
[doc-sync] 기준 {sha7} → HEAD
■ 대상: 화면 N(rooms, chat) / server 모듈 N / contract 변경 여부 / 공용 컴포넌트 N
■ 제외: 생성 — …
■ 위임 결과: designer ✅ | test-designer ✅(TC +3) | manual ✅ | server-designer ✅ | contract-analyst 불일치 2건 → contract-manager
■ 테스트: vitest server N/N | vitest ui N/N | tsc ✅ | 화면 TC N/N (FAIL: TC-…, → ui-debug)
■ 마킹: CR-… 검증됨 / 대기열 Q-… 검증됨
■ 마커: lastSyncedSha {old} → {new}
■ 미해결(openItems): …
```
