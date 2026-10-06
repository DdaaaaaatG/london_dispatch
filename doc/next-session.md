# 다음 세션 인계 (2026-10-06 갱신 · S3 완료 반영)

- 결정은 `doc/000_프로젝트_확정사항.md`가 단일 소스다. 이 문서는 **지금 상태 · 남은 일 · 결정 대기 · 꼭 지킬 것**만 담는다. 항목을 끝내면 지우고, 새 일은 해당 절에 짧게 추가한다.

## 0. 시작 확인
- 세션은 **프로젝트 루트**(`london_dispatch/`)에서 연다. `.claude` 폴더나 상위 폴더에서 열면 가드 경로가 어긋나 에이전트 Bash·Write가 막힌다.
- 진행 방식: 메인 세션은 소스·산출 문서를 직접 고치지 않고 리프 에이전트에 위임한다(CLAUDE.md §5-0). S1~S3은 메인 세션이 task-manager 역할을 대행했다(사용자 지시 2026-10-05). task-manager 에이전트에는 Bash·ui-fixer·ui-test-conflict-checker가 없어 메인 대행이 실제로 더 낫다.
- `server/.dev.vars`는 Read로 열지 않는다. 없으면 `npx wrangler dev --port 3000 --var TOKEN_SECRET:<로컬 임의값> --var LLM_PROVIDER:fake --var OWNER_MB_IDS:<테스트 주인 ID>`로 띄운다(키 없이 speak까지 동작). 로컬 테스트 토큰(.ld-token.local, git 제외)은 같은 TOKEN_SECRET 값으로 서명해야 하며, 비밀값 실값은 문서에 적지 않는다(SEC-002).
- **새 클론이면** `npm install`(잠금 복원) → `cd server && npx wrangler d1 migrations apply DB --local` → `npx wrangler d1 execute DB --local --file=test/fixtures/seed-s1.sql` → `npm run build -w ui`(wrangler dev가 `ui/dist`를 요구) 순서. 2026-10-06 세션이 이 상태에서 시작해 전부 재구성했다.
- contract-implementer 위임문에는 **"미리보기 생략 — 사용자 승인된 확정 계약, 순수 추가"** 를 명시한다. 없으면 미리보기에서 멈춘다.
- **server-implementer도 같다**(2026-10-06 S3c에서 미리보기 정지 1회): 기존 시그니처·스키마 변경이 섞인 작업은 위임문에 "사용자 승인 ② {날짜} 완료 — 미리보기 생략, 바로 적용"을 적는다.

## 1. 현재 상태 (2026-10-06)
- **S1(저장+읽기 전용) · S2(토큰+쓰기) · S3(AI 발화) · S3b(월 비용 상한) 완료.** 증거: vitest **763/763**(shared 25·server 276·ui 462), typecheck·lint 0, 빌드 dry-run 0, `ui/src/chat/test/result.md` S3 절, 캡처 `doc/300_검증/screenshots/20261006-1318/`(7장), 매뉴얼 S3 절, RTM S3 행 완료. 종단 curl(fake 제공사): speak 201 · 무토큰 401 · regenerate 200.
- S3 산출: `server/src/llm/`(Gemini REST + Fake, 캐릭터 JSON `server/characters/{ciel,sebastian,common}.json` 임시 문구, 프롬프트·후처리·재시도) · `messages.speak/regenerate` + 방 잠금 · api.md **v0.4**(E9·E12) · chat 화면 v1.7(캐릭터 버튼·임시/실패 말풍선·재시도·재작성). 요약 훅(`afterSpeak`)은 자리만, S4에서 채운다.
- 승인 ②(S3) 결정 로그는 `doc/state.json` decisions(2026-10-06). 요구 개정: R-LLM-005(로그에 제공사 상태 코드만).
- 스크린샷 폴더는 `.gitignore` 대상이라 git에 올라가지 않는다(의도). 매뉴얼 이미지(`ui/src/*/manual/img/`)만 추적된다.
- 이 세션의 dev 서버는 백그라운드 한도(1~2시간)로 자동 종료된다. 종료 후 **고아 workerd/Vite 프로세스가 포트 3000·5173을 잡고 옛 설정으로 응답**할 수 있다 — 이상하면 `netstat -ano | findstr :3000`으로 PID 확인 후 taskkill(/T /F).
- 브라우저 MCP(Chrome 확장) 미연결 시 캡처는 Chrome 헤드리스 + CDP 스크립트(세션 스크래치패드 `shoot.mjs`·`shoot-s3.mjs`, Node 22 내장 WebSocket, 추가 설치 없음)로 했다. 스크립트는 저장소 밖이라 다음 세션엔 없다 — 필요하면 같은 방식으로 다시 만든다(약 100줄).
- prettier `--check`가 23개 미변경 파일을 지적한다: 새 클론이 `core.autocrlf=true`라 CRLF로 체크아웃된 산물(`.prettierrc` `endOfLine: lf`). 코드 문제 아님. §3-9 결정 대기.
- git: `main` 단일 브랜치, 원격 `origin`. S3 커밋 3건 푸시 완료(bc5776d). S3b 커밋·푸시 완료(290f5c4). S3c는 승인 ①까지(아키텍처 문서 커밋).

## 2. 남은 일

### 2-1. 우선
1. (완료) S3 푸시 2026-10-06 — 원격 main = bc5776d. 자격 증명 캐시 정리 후 성공. 참고: 전역 `.gitconfig`에 `http.sslVerify=false`(TLS 검증 꺼짐) — 사용자에게 복구 권고함.
2. (완료) **S3b 월 AI 비용 상한** 2026-10-06 — 구현·테스트(763/763)·종단 확인 끝. 커밋은 사용자 확인 후 `/sync`. 운영 전 지인이 `wrangler.toml [vars]`의 단가·환율·예산을 확인하고, Google Cloud 예산 알림(10만원)을 걸도록 S5 handoff에 포함.
3a. **S3d(고정 명칭 「어떠한 의지」 + 전송 시 자동 응답) — 완료 2026-10-07(승인 ① 22:35·② 23:12).** 증거: shared 140 · server 343 · ui 660 · verify PASS `doc/300_검증/verify-S3d-20261007-0029.md` · 캡처 `doc/300_검증/screenshots/20261007-0004/` · chat manual 4.5·FAQ·img 4장. 결정: 모델 변경 금지(🔒) · 이름 지목 규칙 + 선택 15초 · 저장만 전송 없음 · 생성 중 편집 저장 잠김. 남은 것: Button `ariaDescribedBy` 추가 후 InlineEditor 지역 ref 제거(ui-postprocessor, component-usage-lessons 코어 결함 후보) · 편집기 열린 채 재작성 중 저장 버튼 활성(CR 후보) · 테스트 메시지가 로컬 D1 방 2곳에 남음(「안개 낀 런던의 아침」·「아직 아무도 없는 방」) · 실제 Gemini 응답 16~30초(느린 시간대) 관찰. verify 후속은 next-session §2-1a.
3. **S3c(캐릭터 설정 화면) — 구현·테스트·문서 완료 2026-10-06(승인 ② 19:36).** 증거: shared 138 · server 318 · ui 592 · lint·typecheck·build 0 · 캡처 `doc/300_검증/screenshots/20261006-2033/` · settings manual img 14장. 남은 것: verify 판정 반영 → `/sync` 커밋(사용자 확인) · 수동 TC-ST-036~038·TC-RM-040(실제 iframe 파일 저장·스크린리더) · 운영 Secrets `OWNER_MB_IDS`(지인 ID, 사용자 전달 대기) · S5 embed-guide에 iframe sandbox 시 `allow-downloads` · chat 스펙 3개 격리 mock(rooms Q-02, 보강 CR 후보). 로컬 테스트: `.ld-token.local`(owner01·tester, 12h) + wrangler `--var OWNER_MB_IDS:owner01` — 토큰 만료 시 같은 방식으로 재발급(스크래치패드 스크립트, HMAC-SHA256·payload {mb_id,nick,ch_name,level,exp}). 산출: `doc/200_설계/architecture/s3c-01-구조분석.md`·`s3c-02-전반설계.md`·`s3c-03-인계패킷.md`. 다음 세션 할 일 순서:
   1. (완료 2026-10-06) 메인 세션: 요구 문서에 R-SET-001~012 등록(02 §8 초안 전사, 🔒 유지) + 🔒 개정 7건 반영(문안 02 §7): 확정사항 §5·§9-3a·CLAUDE.md §9("관리 화면 없음"→"캐릭터 설정 화면 1개") · R-API-001(+GET/PUT `/api/settings/characters`) · R-API-002(15종 `OWNER_ONLY` 403) · R-LLM-002(D1 저장, JSON은 시드)·R-LLM-003(조립 확장) · R-AUTH-003(설정 GET 토큰 필요 예외) · 확정사항 §4 폴더(server/src/settings/, ui/src/settings/) · rtm.md S3c 행.
   2. (설계 완료 2026-10-06 — server-designer·contract-designer·ui-layout-designer·ui-designer·ui-design-checker 3차 PASS) 03 인계패킷 §1부터 위임: server-designer ∥ contract-designer → ui-layout-designer → ui-designer → ui-design-checker → 승인 ②(S3c) → contract-impl(shared) → server-impl ∥ ui-test-designer → contract-impl(routes·ui/api, client에 PUT 추가) → ui-impl → ui-tester → manual → verify. 예상 약 3시간.
   3. 사용자 결정 확정분: 주인 식별 = 토큰 mbId ↔ `OWNER_MB_IDS`(Secrets, 로컬은 `.dev.vars`; 비우면 전원 403; **지인 ID만 — 사용자 본인 ID 제외, 2026-10-06 결정으로 02 §11 Q2 권고 「지인+사용자」 대체**) · 출력 규칙 편집 안 함 · 주인 판정은 화면 시작 시 GET 1회 탐침 · 가져오기 상한 초과 거부 · 내보내기는 저장값 · 필드 상한 02 §8 · 복원 버튼 없음. **주인 회원 ID는 사용자가 알려 줘야 함**(갠홈 그누보드 mb_id).
   4. 확인 필요: 갠홈 iframe `sandbox` 속성 유무(있으면 `allow-downloads` 필요 — S5 embed-guide에 포함). 내보내기는 Blob 다운로드 + 복사용 텍스트 영역 병행 설계.
4. **S4(장기기억) 설계부터**: server-designer(memory.md 신규 — `summarizeIfNeeded`·`afterSpeak` 훅 연결·`source_until_id` 전진·중복 방지 R-MEM-003·`memory.get/put`) → contract-designer(E13·E14 GET/PUT memory, api.md v0.5) → ui-designer(chat ⋯ 메뉴 "장기기억" 항목 + M1 MemorySheet, R-CHAT-012) → ui-design-checker → 승인 ②(S4) → 구현(shared → server → routes/api ∥ 시나리오 → 화면 → 테스트 → 매뉴얼).
5. **S5(전달·배포)**: `doc/handoff/`(contract-designer: 임베드 안내·토큰 PHP 조각·SECRET 전달 절차) · `server/scripts/token-test.ts`(`npm run token:test`, server-manager) · Cloudflare 지인 계정 셋팅(D1 생성·Secrets `TOKEN_SECRET`·`LLM_API_KEY`·플랜) · `/deploy`.

### 2-1a. S3c verify 후속(PASS 2026-10-06, `doc/300_검증/verify-S3c-20261006-2059.md`) — 사용자 허락 후 계층 매니저로
- **server-manager(보강)**: SEC-001(MEDIUM) `env.ts` TOKEN_SECRET 길이 하한(min 32, 최소 LLM_PROVIDER=google일 때) — **운영 배포 전 처리 권고** · SEC-003 `/api/*` 보안 헤더(frame-ancestors 'none' + secure-headers) · SEC-004 설정 텍스트 줄 머리 `[` 무력화(선택) · SRV-001 잠금 안 설정 읽기 D1 실패 speak 테스트 · SRV-002 schema.ts 이중 단언 → satisfies · SRV-003 auth/index.ts 문서주석 ownerMbIds.
- **contract-manager(S5 handoff)**: 운영 SECRET은 개발 값과 달라야 함 문구 · iframe sandbox 시 allow-downloads · OWNER_MB_IDS 운영 Secrets 절차.
- **ui 후속**: CR-001 settingsCandidate.ts:50 주석↔export 불일치(ui-postprocessor) · CR-002 settings/labels.ts 인증 문구 rooms와 중복(공용화 후보) · chat 스펙 3개 getCharacterSettings 격리 mock(rooms Q-02).
- **S3d verify PASS 후속(2026-10-07, `doc/300_검증/verify-S3d-20261007-0029.md`)**: server-manager — SRV-001(MEDIUM) `server/src/llm/client.ts` complete 55줄 → 50줄 분해 · SRV-002/SEC-001(LOW) 지목·defang NFC 정규화 · SRV-003(LOW) generate `let pick` 초기값 정리 / contract-manager — SEC-002(LOW) "auto는 제공사 호출 최대 3회" 문구(api.md §4.13·주석) / ui-postprocessor — Button `ariaDescribedBy` 추가 후 InlineEditor 지역 ref 제거 / 사용자 결정 — 잠금 중 편집 저장 버튼 표시(설계대로 비활성 vs 현 활성·클릭 거절).
- **운영 배포 주의**: 0003 마이그레이션을 운영 D1에 먼저 적용(안 하면 speak 500) · Secrets `OWNER_MB_IDS`(지인 ID만, 비우면 설정 화면 전원 403).

### 2-2. 문서 동기화 잔여(`/doc-sync` 또는 개별 위임) — `doc/state.json` `todo_docsync`
- 스킬 문구 갱신(메인 세션 배치): server-design-strategy §3 에러코드명·§6 어댑터 인터페이스·429 재시도·§7.2 요약 위치·§7.5·§8 / server-rules AppError 예시 / ui-design-strategy §6.3·§7(D-16). 근거는 llm.md 「메인 세션 보고 사항」4·generate.md D-16.
- messages.md S3-R1(내부 id 노출 문구)·S3-R2(Number(id) → 10진 규칙) · api.md §4.12·§15.10 결정 4건 "사용자 승인 2026-10-06" 마킹 · index.md 머리말.
- CR 후보: chat — 인라인 편집기 열린 채 재작성(regenerate) 진행 중 저장 버튼이 활성으로 보이고 클릭은 거절됨(S3부터, S3d 검증 중 관찰 2026-10-06) → S3d의 isSaveLocked를 재작성에도 적용 검토(ui-debug, 보강).
- CR 후보: chat S2 F-CH-23(메시지 삭제로 방이 비면 포커스 시점) → S3의 F-CH-41 방식으로 통일 검토(ui-debug, 보강 모드).

## 3. 결정 대기 (확정사항 §9 + 이번 세션 추가)
| # | 항목 | 기본값 |
|---|---|---|
| 1 | 버튼 허용 등급 | 5 (지인 셋팅 중, 확정 시 `wrangler.toml [vars] TOKEN_MIN_LEVEL`만 변경) |
| 3 | 캐릭터 프롬프트 | JSON 임시 문구 적용됨(`server/characters/*.json`). 사용자·지인이 내용 교체 → 재배포 |
| 4 | Gemini 키·모델 | 키는 로컬 `server/.dev.vars`에 입력됨(2026-10-06, 사용자). **`gemini-2.5-flash`는 Google이 신규 사용자에게 막음(404)** — 로컬은 `.dev.vars`의 `LLM_MODEL=gemini-3.1-pro-preview`로 시험 중(종단 speak 201). 운영 모델명(Pro vs 3.8-flash)과 단가(`LLM_PRICE_*`)는 **지인 결정 후 wrangler.toml [vars] 갱신**(server-implementer, 배포 전 필수). generationConfig 미설정 |
| 8 | Cloudflare 계정·배포 | 지인 계정, 우리가 직접 셋팅·배포(접근 방식·플랜 미정) |
| 9 | 줄바꿈 정책 | `.gitattributes`(`* text=auto eol=lf`) 추가 여부 — prettier 23파일 지적 해소용 |
| 10 | 스크린샷 추적 | `.gitignore`에서 `doc/300_검증/screenshots/` 제외를 풀지 여부(현재는 로컬만) |

## 4. 꼭 지킬 것
- **문서 편집 스크립트 사고 재발 방지(2026-10-06)**: api.md 꼬리 325줄이 `indexOf`가 -1인데도 `slice`한 스크립트로 잘려 커밋됐다. 에이전트가 Bash node/python로 문서를 고칠 때는 앵커 미발견 시 반드시 중단(throw)하고, 고친 뒤 헤딩 수·줄 수를 전후 비교해 증거로 남긴다. 위임문에 이 조건을 적는다. 복원 재료는 세션 jsonl(subagents/*.jsonl)의 Edit 본문·Read 결과.
- 아보카도 본체·그누보드 코어는 건드리지 않는다. 저쪽이 하는 수정은 테마 파일 안의 주소 한 줄 + 토큰 몇 줄뿐이다.
- 메인 화면 대사창(캐릭터 옆 말풍선) 연동 **안 함**.
- 설정·비밀값 읽기는 `server/src/env.ts`에서만. 비밀값 실값은 `server/.dev.vars`(로컬)·Cloudflare Secrets(운영)에만. 로그에는 제공사 상태 코드·분류만(R-LLM-005 개정).
- 저쪽 PHP는 **https 주소만** 받는다.
- 새 의존성은 사용자 승인 후 메인 세션에서만 설치한다(S3는 추가 패키지 0).
- 운영 배포·원격 마이그레이션·Worker 삭제 계열 명령은 `/deploy` 절차 밖에서 실행하지 않는다(훅이 차단).
- 캐릭터 JSON `name`은 `shared/src/characters.ts` 표시명과 같아야 한다(불일치 시 Worker 로드 실패). avatar는 JSON에 없다.
