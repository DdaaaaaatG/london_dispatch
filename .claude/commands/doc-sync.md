---
description: 문서 동기화 배치 — 마지막 동기화 이후 수정된 화면·server 모듈·contract를 git history로 찾아 문서(requirements/design/scenarios/manual, server 설계 md, api.md·handoff)를 단일 소유 에이전트에 위임해 맞추고 마커를 전진시킨다
---

# Doc Sync (배치 문서 동기화)

규칙의 단일 소스는 **`doc-sync` 스킬**이다. 이 명령은 그 절차를 언제·어떤 순서로 돌리는지만 정한다.

> 프로젝트 루트가 작업 디렉터리다. 절대 경로를 쓰지 않는다.

## 사용법

- `/doc-sync` — 마커 이후 수정된 모든 대상을 동기화
- `/doc-sync rooms` · `/doc-sync chat` — 화면 하나만
- `/doc-sync server` · `/doc-sync contract` — 계층 하나만
- `/doc-sync --since <ref>` — 마커 대신 기준 커밋 지정
- `/doc-sync --dry-run` — 대상 식별까지만 하고 위임하지 않는다

## 0. 마커 읽기

마커 파일: `doc/doc-sync-state.json`

```json
{ "lastSyncedSha": "<커밋>", "syncedAt": "YYYY-MM-DD", "syncedTargets": [], "openItems": {} }
```

- 없으면 첫 실행이다. **기준 커밋을 추측하지 않고 사용자에게 `--since <ref>`를 묻는다**(`AskUserQuestion`). 최초 커밋을 기준으로 삼으면 구축 파이프라인이 이미 맞춘 문서까지 전부 대상이 된다.

## 1. 대상 식별 (git history가 변경의 원천)

```bash
git diff --name-only <lastSyncedSha>..HEAD -- server shared ui doc/handoff
```

| 변경 경로 | 대상 | 맞출 문서 | 위임 에이전트 |
|---|---|---|---|
| `ui/src/rooms/**`(문서·test 제외) | 화면 rooms | `requirements.md` → `design.md` → `test/scenarios.md` → `manual.md` | ui-designer → ui-test-designer → ui-manual-writer |
| `ui/src/chat/**` | 화면 chat | 위와 같음 | 위와 같음 |
| `ui/src/state/**` | 화면 chat 몫 | chat의 `design.md` 상태 절 | ui-designer(chat) |
| `ui/src/components/**` | 공용 컴포넌트 | `component-catalog` 스킬 인벤토리, `COMPONENT.md` | ui-component-designer |
| `server/src/{env,db,auth,rooms,messages,memory,llm}/**` | server 모듈 | `doc/200_설계/server/{모듈}.md` | server-designer |
| `shared/**` · `server/src/routes/**` · `ui/src/api/**` · `doc/handoff/**` | contract | `doc/200_설계/contract/api.md` + 4자 대조 | contract-analyst (불일치는 contract-manager 세션으로 인계) |

- 마커 이후 **새로 생긴** 화면·모듈은 제외한다(구축 파이프라인이 문서를 함께 만든다). 마커 이전에 존재했던 것만 대상.
- 대상 목록과 각 대상의 변경 파일 수를 표로 제시한다. `--dry-run`이면 여기서 끝.

## 2. 위임 (문서는 직접 쓰지 않는다)

- 화면: **순서대로** ui-designer(요구·설계 델타) → ui-test-designer(시나리오·스펙) → ui-manual-writer(매뉴얼·스크린샷). 각 위임문에 변경 파일 목록·CR 대장(`test/change-requests.md`)의 「적용·미검증」 항목을 넣는다.
- server: server-designer에 변경 파일 목록과 현재 문서 경로를 넣어 델타를 반영하게 한다. 코드가 설계를 위반했다고 보이면 「확인 필요」로 보고받는다.
- contract: contract-analyst가 api.md ↔ shared ↔ routes ↔ ui/api ↔ handoff를 대조한다. 불일치는 고치지 않고 contract-manager 세션 인계 명세로 보고한다.
- 서로 다른 대상은 병렬 위임 가능. 같은 대상의 세 단계는 순차.

## 3. 전체 테스트 재수행

`/test` 전체, **직렬**. 실패가 있으면 동기화를 마무리하지 않고 라우팅(ui-debug / contract-manager / server-manager) 후 재실행한다.

## 4. 마커 전진·기록

- `lastSyncedSha`를 `git rev-parse HEAD`로, `syncedAt`을 오늘로, `syncedTargets`에 이번 대상을 기록한다.
- 미해결 항목(수동 확인 필요 TC, LLM 키가 없어 못 돌린 확인)은 `openItems`에 남긴다.
- 화면의 CR 대장에서 「적용·미검증」 → 「검증됨」으로 마킹한다(전체 PASS일 때만).
- 완료 보고: 대상 수 · 갱신 문서 목록 · 테스트 결과 · 남은 항목.
