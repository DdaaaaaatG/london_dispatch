# doc/ 폴더 지도

| 경로 | 내용 | 소유 |
|---|---|---|
| `000_프로젝트_확정사항.md` | 제품·스택·계층·API·토큰·에이전트 구성의 **단일 기준** | 메인 세션(사용자 확인 후) |
| `next-session.md` | 지금 상태 · 남은 일 · 결정 대기 · 꼭 지킬 것 | 메인 세션 |
| `state.json` | 구축(task-manager) 진행 상태·재개 | task-manager |
| `doc-sync-state.json` | `/doc-sync` 마커 | 메인 세션(`/doc-sync`) |
| `100_요구조건/requirements.md` · `rtm.md` | 프로젝트 요구(요구ID `R-…`, 🔒 사용자 지정) · 종단간 RTM | task-manager |
| `200_설계/server/{모듈}.md` | server 모듈 설계(env·db·auth·rooms·messages·memory·llm) | server-designer |
| `200_설계/contract/api.md` | API 계약·에러코드·토큰 형식·임베드 규약 — shared·routes·ui/api·handoff의 단일 소스 | contract-designer |
| `200_설계/architecture/{slug}-0N-*.md` | 횡단 기능 분석·전반 설계·계층별 인계 패킷 | system-architect |
| `300_검증/verify-*.md` · `deploy-*.md` | 배포 전 검증 리포트 · 배포 기록 | verify-manager · 메인 세션(`/deploy`) |
| `300_검증/screenshots/{STAMP}/` | `/run-app` 캡처(git 제외) | 메인 세션 |
| `handoff/` | 갠홈 저쪽 전달물 — 임베드 안내, 토큰 PHP 조각(SECRET 실값 없음) | contract-designer |

화면 단위 문서(`requirements.md` · `design.md` · `manual.md` · `test/`)는 여기가 아니라 소스 옆 `ui/src/rooms/`·`ui/src/chat/`에 있다.
