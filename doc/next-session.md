# 다음 세션 인계 (2026-10-06 갱신 · S3 완료 반영)

- 결정은 `doc/000_프로젝트_확정사항.md`가 단일 소스다. 이 문서는 **지금 상태 · 남은 일 · 결정 대기 · 꼭 지킬 것**만 담는다. 항목을 끝내면 지우고, 새 일은 해당 절에 짧게 추가한다.

## 0. 시작 확인
- 세션은 **프로젝트 루트**(`london_dispatch/`)에서 연다. `.claude` 폴더나 상위 폴더에서 열면 가드 경로가 어긋나 에이전트 Bash·Write가 막힌다.
- 진행 방식: 메인 세션은 소스·산출 문서를 직접 고치지 않고 리프 에이전트에 위임한다(CLAUDE.md §5-0). S1~S3은 메인 세션이 task-manager 역할을 대행했다(사용자 지시 2026-10-05). task-manager 에이전트에는 Bash·ui-fixer·ui-test-conflict-checker가 없어 메인 대행이 실제로 더 낫다.
- `server/.dev.vars`는 Read로 열지 않는다. 없으면 `npx wrangler dev --port 3000 --var TOKEN_SECRET:local-dev-secret --var LLM_PROVIDER:fake`로 띄운다(키 없이 speak까지 동작).
- **새 클론이면** `npm install`(잠금 복원) → `cd server && npx wrangler d1 migrations apply DB --local` → `npx wrangler d1 execute DB --local --file=test/fixtures/seed-s1.sql` → `npm run build -w ui`(wrangler dev가 `ui/dist`를 요구) 순서. 2026-10-06 세션이 이 상태에서 시작해 전부 재구성했다.
- contract-implementer 위임문에는 **"미리보기 생략 — 사용자 승인된 확정 계약, 순수 추가"** 를 명시한다. 없으면 미리보기에서 멈춘다.

## 1. 현재 상태 (2026-10-06)
- **S1(저장+읽기 전용) · S2(토큰+쓰기) · S3(AI 발화) · S3b(월 비용 상한) 완료.** 증거: vitest **763/763**(shared 25·server 276·ui 462), typecheck·lint 0, 빌드 dry-run 0, `ui/src/chat/test/result.md` S3 절, 캡처 `doc/300_검증/screenshots/20261006-1318/`(7장), 매뉴얼 S3 절, RTM S3 행 완료. 종단 curl(fake 제공사): speak 201 · 무토큰 401 · regenerate 200.
- S3 산출: `server/src/llm/`(Gemini REST + Fake, 캐릭터 JSON `server/characters/{ciel,sebastian,common}.json` 임시 문구, 프롬프트·후처리·재시도) · `messages.speak/regenerate` + 방 잠금 · api.md **v0.4**(E9·E12) · chat 화면 v1.7(캐릭터 버튼·임시/실패 말풍선·재시도·재작성). 요약 훅(`afterSpeak`)은 자리만, S4에서 채운다.
- 승인 ②(S3) 결정 로그는 `doc/state.json` decisions(2026-10-06). 요구 개정: R-LLM-005(로그에 제공사 상태 코드만).
- 스크린샷 폴더는 `.gitignore` 대상이라 git에 올라가지 않는다(의도). 매뉴얼 이미지(`ui/src/*/manual/img/`)만 추적된다.
- 이 세션의 dev 서버는 백그라운드 한도(1~2시간)로 자동 종료된다. 종료 후 **고아 workerd/Vite 프로세스가 포트 3000·5173을 잡고 옛 설정으로 응답**할 수 있다 — 이상하면 `netstat -ano | findstr :3000`으로 PID 확인 후 taskkill(/T /F).
- 브라우저 MCP(Chrome 확장) 미연결 시 캡처는 Chrome 헤드리스 + CDP 스크립트(세션 스크래치패드 `shoot.mjs`·`shoot-s3.mjs`, Node 22 내장 WebSocket, 추가 설치 없음)로 했다. 스크립트는 저장소 밖이라 다음 세션엔 없다 — 필요하면 같은 방식으로 다시 만든다(약 100줄).
- prettier `--check`가 23개 미변경 파일을 지적한다: 새 클론이 `core.autocrlf=true`라 CRLF로 체크아웃된 산물(`.prettierrc` `endOfLine: lf`). 코드 문제 아님. §3-9 결정 대기.
- git: `main` 단일 브랜치, 원격 `origin`. S3 커밋 3건 푸시 완료(bc5776d). S3b 완료(커밋 대기 — 사용자 확인 후 /sync).

## 2. 남은 일

### 2-1. 우선
1. (완료) S3 푸시 2026-10-06 — 원격 main = bc5776d. 자격 증명 캐시 정리 후 성공. 참고: 전역 `.gitconfig`에 `http.sslVerify=false`(TLS 검증 꺼짐) — 사용자에게 복구 권고함.
2. (완료) **S3b 월 AI 비용 상한** 2026-10-06 — 구현·테스트(763/763)·종단 확인 끝. 커밋은 사용자 확인 후 `/sync`. 운영 전 지인이 `wrangler.toml [vars]`의 단가·환율·예산을 확인하고, Google Cloud 예산 알림(10만원)을 걸도록 S5 handoff에 포함.
3. **S3c(캐릭터 설정 화면, 사용자 지정 🔒 2026-10-06)** — 캐릭터 관련 항목만(나이·장르/원작·말투·성격·샘플 대사 등), **갠홈 주인만** 보고 편집, JSON 내보내기/가져오기(비밀값 미포함, E.No.S 구조 호환 부분집합), 저장 D1. 관리 화면·엔드포인트 고정(R-API-001)·§9-3a 개정이 걸리는 횡단 건이라 `system-architect`로 구조 분석·전반 설계·계층 패킷을 먼저 받는다. 참고 원본 `C:/Users/Woon/Documents/카카오톡 받은 파일/json/E.No.S v2.51.html`(저장소 밖, 읽기만).
4. **S4(장기기억) 설계부터**: server-designer(memory.md 신규 — `summarizeIfNeeded`·`afterSpeak` 훅 연결·`source_until_id` 전진·중복 방지 R-MEM-003·`memory.get/put`) → contract-designer(E13·E14 GET/PUT memory, api.md v0.5) → ui-designer(chat ⋯ 메뉴 "장기기억" 항목 + M1 MemorySheet, R-CHAT-012) → ui-design-checker → 승인 ②(S4) → 구현(shared → server → routes/api ∥ 시나리오 → 화면 → 테스트 → 매뉴얼).
5. **S5(전달·배포)**: `doc/handoff/`(contract-designer: 임베드 안내·토큰 PHP 조각·SECRET 전달 절차) · `server/scripts/token-test.ts`(`npm run token:test`, server-manager) · Cloudflare 지인 계정 셋팅(D1 생성·Secrets `TOKEN_SECRET`·`LLM_API_KEY`·플랜) · `/deploy`.

### 2-2. 문서 동기화 잔여(`/doc-sync` 또는 개별 위임) — `doc/state.json` `todo_docsync`
- 스킬 문구 갱신(메인 세션 배치): server-design-strategy §3 에러코드명·§6 어댑터 인터페이스·429 재시도·§7.2 요약 위치·§7.5·§8 / server-rules AppError 예시 / ui-design-strategy §6.3·§7(D-16). 근거는 llm.md 「메인 세션 보고 사항」4·generate.md D-16.
- messages.md S3-R1(내부 id 노출 문구)·S3-R2(Number(id) → 10진 규칙) · api.md §4.12·§15.10 결정 4건 "사용자 승인 2026-10-06" 마킹 · index.md 머리말.
- CR 후보: chat S2 F-CH-23(메시지 삭제로 방이 비면 포커스 시점) → S3의 F-CH-41 방식으로 통일 검토(ui-debug, 보강 모드).

## 3. 결정 대기 (확정사항 §9 + 이번 세션 추가)
| # | 항목 | 기본값 |
|---|---|---|
| 1 | 버튼 허용 등급 | 5 (지인 셋팅 중, 확정 시 `wrangler.toml [vars] TOKEN_MIN_LEVEL`만 변경) |
| 3 | 캐릭터 프롬프트 | JSON 임시 문구 적용됨(`server/characters/*.json`). 사용자·지인이 내용 교체 → 재배포 |
| 4 | Gemini 키·모델 | 키는 지인 발급 대기. 모델 gemini-2.5-flash. **generationConfig 미설정** — 실키로 수동 확인(llm.md §8.1) 뒤 필요 시 요구 승격 |
| 8 | Cloudflare 계정·배포 | 지인 계정, 우리가 직접 셋팅·배포(접근 방식·플랜 미정) |
| 9 | 줄바꿈 정책 | `.gitattributes`(`* text=auto eol=lf`) 추가 여부 — prettier 23파일 지적 해소용 |
| 10 | 스크린샷 추적 | `.gitignore`에서 `doc/300_검증/screenshots/` 제외를 풀지 여부(현재는 로컬만) |

## 4. 꼭 지킬 것
- 아보카도 본체·그누보드 코어는 건드리지 않는다. 저쪽이 하는 수정은 테마 파일 안의 주소 한 줄 + 토큰 몇 줄뿐이다.
- 메인 화면 대사창(캐릭터 옆 말풍선) 연동 **안 함**.
- 설정·비밀값 읽기는 `server/src/env.ts`에서만. 비밀값 실값은 `server/.dev.vars`(로컬)·Cloudflare Secrets(운영)에만. 로그에는 제공사 상태 코드·분류만(R-LLM-005 개정).
- 저쪽 PHP는 **https 주소만** 받는다.
- 새 의존성은 사용자 승인 후 메인 세션에서만 설치한다(S3는 추가 패키지 0).
- 운영 배포·원격 마이그레이션·Worker 삭제 계열 명령은 `/deploy` 절차 밖에서 실행하지 않는다(훅이 차단).
- 캐릭터 JSON `name`은 `shared/src/characters.ts` 표시명과 같아야 한다(불일치 시 Worker 로드 실패). avatar는 JSON에 없다.
