# 다음 세션 인계 (2026-10-08 저녁 갱신 · S5 2차 배포 완료 반영)

- 결정은 `doc/000_프로젝트_확정사항.md`가 단일 소스다. 이 문서는 **지금 상태 · 남은 일 · 결정 대기 · 꼭 지킬 것**만 담는다. 항목을 끝내면 지우고, 새 일은 해당 절에 짧게 추가한다.

## 0-00. 2026-10-08 저녁 — **S5 2차(운영 배포) 완료** · 지인 파일 전달 대기

- **배포 완료 19:30 KST.** 운영 주소 `https://london-dispatch.pora.workers.dev`(임베드 `/embed`). 기록 `doc/300_검증/deploy-20261008-1930.md`. D1 `london-dispatch`(APAC) 생성 + 0001~0004 적용 · Secrets 3개(`TOKEN_SECRET` 44자 영숫자 우리 생성 · `LLM_API_KEY` 지인 키를 **사용자가 별도 터미널에서 직접 입력**(세션 미열람) · `OWNER_MB_IDS`) · `wrangler.toml` database_id 기입(커밋 `9836fcc`). 헬스 전부 정상, 주인 토큰으로 `/api/settings/characters` 200 확인(= Cloudflare TOKEN_SECRET과 PHP 파일 SECRET 일치).
- **사용자 결정(2026-10-08 저녁)**: ① Cloudflare는 구성원 초대 대신 **사용자가 지인 계정(pora__)으로 직접 `wrangler login`**(이 PC에 자격 저장됨, 재로그인 불필요). ② 지인 Gemini 키는 **선불 결제(Pro 가능)** → 기본 모델 Pro 유지. ③ 갠홈 패치(head.php·css·js)는 **이미 설치돼 있음**(main.php 확인) → 지인에게는 **완성 `rosebell-chatbot.php` 1개**(주소+토큰 조각+SECRET, 75줄)만 카톡으로, 같은 자리 덮어쓰기. 1회성 링크·head.php 교체 안내 폐기.
- **저장소 밖 로컬 파일(`D:\pr\dispatch\`, git 무관)**: `london-dispatch-TOKEN_SECRET.txt`(운영 SECRET 원본 — Cloudflare는 값을 다시 안 보여 주므로 이것이 유일한 사본) · `rosebell-chatbot.php`(지인 전달용 완성본) · `owner-token.txt`·`owner-url.txt`(주인 계정 12h 테스트 토큰, 2026-10-09 07:30 KST 만료). 지인 확인 끝나면 php·토큰 파일은 지운다. SECRET 파일은 보관(재발급 시 양쪽 동시 교체 필요).
- **운영 첫 장애·해결(19:40~20:05)**: HKG 실행 시 Gemini 400 FAILED_PRECONDITION(홍콩 미지원) → `[placement] region = "gcp:asia-northeast1"` 고정(커밋 `505e0a5`, Smart Placement는 효과 없어 폐기). HKG 유입 speak 201 확인. 상세 deploy-20261008-1930.md 후속 절. **지인 Pro 키 정상 확인됨**(세바스찬·시엘 실응답).
- **등급 규칙(🔒)**: 20:30 글쓰기 10만으로 배포(`55ff6c9`) → **2026-10-08 밤 지인 요청으로 글쓰기 2(일반 회원 이상)로 재개정**(`cf0dc56`, `TOKEN_MIN_LEVEL` 2 — 운영 반영은 S6 배포와 함께) · 열람 2 이상 · 2 미만은 PHP 조각이 iframe 안 띄우고 「회원 전용」 안내 · 관리자(10)는 설정·잠금 프리패스만 추가. 지인은 등급 5판 PHP를 올려 운영 중 → **3판(`RB_CHATBOT_LEVEL` 2, `D:\pr\dispatch\rosebell-chatbot.php`)을 S6 배포 직후 전달**(백업 `.v1-level5`·`.v2-level10`). handoff 5문서·api.md v0.9.1 개정 완료(`d304bc8`).
- **S6 방 비밀번호 잠금(🔒 2026-10-08 밤)**: 승인 ① → 설계 전부 완료·독립 검증 PASS(rooms 1차 PASS+MINOR 6 반영, chat 3차 PASS) → **승인 ② 2026-10-08 완료 → 구현 진행 중**. 문서: `doc/200_설계/architecture/s6-0{1,2,3}-*.md`·`ui-layout-04-room-lock.md`, server 7문서 S6 절, api.md **v0.9**, rooms design v1.8.3+`design/lock.md`, chat design v2.3.2+`design/lock.md`·`lock-tests.md`. 결정: 목록 제목+자물쇠(날짜 숨김) · 입장 증명 브라우저 기억(`ld:roomKeys`) · 주인 프리패스 · 4~32자 · 분당 5회 · Free 기준 PBKDF2 · 풀기 확인 danger 유지 · D-55 조용한 재입장 2회 상한. 구현 순서 s6-03 §0: shared → server ∥ 시나리오 → routes·ui/api → rooms → chat → tester → manual → verify → **배포는 0005 `--remote` 먼저**(코드만 되돌리면 잠긴 방 전부 열림 — 주의). 가드 메모: ui-layout-designer는 `doc/`에 못 써서 메인이 대리 저장(사용자 허락), server-designer·contract-designer·architect 메모리 쓰기도 훅에 막힘(결정 대기).
- **다음 할 일**: ① 사용자가 운영 화면(owner-url)에서 캐릭터 버튼 재시도(지역 고정 뒤 실패 0 확인) ② 완성 php 카톡 전달 → 지인 덮어쓰기 → 갠홈에서 확인표(embed-guide §6) ③ contract-designer handoff 갱신 결과 커밋·푸시 ④ 로컬 키(`.dev.vars`)는 사용자 본인 키 — 운영과 다름(정상).
- 로컬 키 = 사용자 키(Pro·Flash 둘 다 200 확인). 아래 §0-0의 "운영 키 전달" 항목은 끝났다.

## 0-0. 2026-10-08 상태 — S3f 완료(verify PASS, 커밋됨 `36e6e7c`~`ba619af`) · (기록)

- **디자인 보강(갠홈 estate 톤) 완료 2026-10-08 오후** — 사용자 "갠홈 디자인에 맞춰야" → 참조 `doc/300_검증/screenshots/20261008-design-ref/`(갠홈 홈·로그인·패널 캡처·테마 CSS) → 승인 5항목(팔레트·선형 버튼·말풍선·상단 바·입력) → ui-manager 보강: CSS 8개+토큰(`global.css`)·아바타 PNG 투명화, 정본 `ui/src/chat/design/style.md` v2.2.1, CR rooms-002·chat-004·settings-002, 캡처 `doc/300_검증/screenshots/20261008-estate/`. `ui_design_concept.md` §1·§3·§4 동기화(메인). 가드 `validate-doc-write.py` SCREENS에 settings 추가(사용자 승인). 결정: 아바타 원 자리 유지 → **지인이 그릴 인장 이미지**로 교체 예정(`ui/public/img/{sebastian,ciel}.png` 같은 경로 덮어쓰기, 요구 후보 — 설정 화면 업로드는 미정). 유저 가운데 말풍선(선 없음) 실물 확인은 유저 발화 있는 방에서 수동 TC 보류.
- **S3f(설정 화면 AI 모델 Pro/Flash 선택, 🔒) 완료 2026-10-08**(승인 ① 02:00 · ② 02:20). 증거: vitest **1368/1368**(shared 145·server 439·ui 784) · typecheck·lint·build 0 · verify PASS `doc/300_검증/verify-S3f-20261008-1217.md`(C/H/M 0, LOW 5) · 캡처 `doc/300_검증/screenshots/20261008-1210/`(공통 탭 Pro·Flash dirty·미선택 3장) · 종단 curl E15/E16(pro v0 → flash v1 → 생략 유지 v2 → `turbo` 400 문구 → pro v3 · 무토큰 401 · 로그 `settings_saved{model}`). 산출: 0004 `llm_model` · `server/src/llm/models.ts`(상수표 Pro `gemini-3.1-pro-preview`/Flash `gemini-3.8-flash`, 단가표 $2/$12·$0.75/$3.75) · 비동기 `llm` 공장 · api.md **v0.8** · 공통 탭 `ModelChoice` · 매뉴얼 5.7 · CR-001. env `LLM_MODEL` 기본값 Pro(3곳). **커밋 안 됨 — 사용자 확인 후 `/sync`**(server·contract·ui·docs 분할 권고).
- **사용자 결정(2026-10-08)**: 운영 Gemini 키는 로컬 키와 **다른 값**을 나중에 전달(배포 때 Secrets 입력). 미선택 안내는 응답 `model: null`일 때만(effectiveKey, R-SET-013 개정).
- **verify LOW 후속 5건**: SEC-001/SRV-001 `llm/models.ts` 단가표 `Object.hasOwn`·폴백 단가 로그(server-manager) · SRV-002 `env.md` 2.5-flash 잔재(이 세션에서 server-designer 수정) · SRV-003 `messages/generate.ts`·`service.ts` 주석(server-manager) · CR-001 `ui/src/state/settings.ts` 391줄 → 다음 변경 전 분할(ui-debug).
- 로컬 환경: dev 서버는 내렸다. **포트 5173은 다른 프로젝트(pasfa Vite)가 점유** → 이 PC에서는 `cd ui && npx vite --port 5174 --strictPort`로 띄운다. 로컬 D1에 `character_settings` 행(v3, model pro)이 생겼다(지워도 됨). 테스트 토큰 `.ld-token.local` 재발급됨(12h, 2026-10-08 12:xx KST 만료; 서명은 **JSON 바이트**에 HMAC — base64url 문자열 아님). 브라우저 MCP 미연결 → Chrome 헤드리스 CDP 스크립트(스크래치패드, 저장소 밖). 이 PC Node 22.20.
- **사용자 결정(2026-10-08 오후)**: SECRET·PHP 덩어리는 **카톡으로 전달**(1회성 링크 절차 폐기 → `doc/handoff/secret-handover.md` 전달 방법 절을 배포 전에 contract-designer가 간소화). 대화창 주소는 workers.dev 기본 이름(질문 제외). 지인 질문은 3개(계정·사이트 주소/www·테마 파일 직접 수정). 사용자용 메모 `doc/사용자_할일.md`(터미널 안 보고도 읽는 용도, 메인 세션이 갱신). 아바타 인장: 지인이 그린 PNG 2개(정사각·투명 권장)를 `ui/public/img/{sebastian,ciel}.png`에 덮어쓰기 → 커밋 → 재배포(코드 변경 0).
- **S5 2차(배포) 선행 조건**은 아래 §0-1과 같다(지인 답 5 → Cloudflare 초대 → `/deploy`: **0004 `--remote` 먼저** → deploy → 헬스체크 → PHP 덩어리 1회성 링크). 기본 모델이 Pro라 월 상한 도달이 빨라질 수 있음(handoff 명시).

## 0-1. 2026-10-07 저녁 상태 — S5 1차 완료 (기록)

- **S5(전달·배포) 1차 완료·커밋(`136a25e`)**: `doc/handoff/` 4문서(embed-guide · token-snippet.php · secret-handover · cloudflare-setup, 실값 0) + 토큰 대조 도구 `npm run token:test -w server -- sign|verify|vectors --secret <32자+>`(`7c84fa7`). 전체 1289/1289.
- **사용자 결정(2026-10-07)**: 지인 ID 전달됨(실값은 Secrets·.dev.vars·메모리에만) · 등급 5 유지 · **지인은 비개발자** → SECRET은 우리가 생성해 Cloudflare에 입력, 지인은 ① Cloudflare 구성원 초대(Administrator) ② 완성된 PHP 덩어리 붙여넣기(1회성 링크)만 · Cloudflare Free로 시작, 접근은 초대 → `wrangler login`.
- **S3f** — 승인 ①·② 2026-10-08 완료, §0-0 참조. (기록) 횡단 설계 3문서 완료(`doc/200_설계/architecture/s3f-0{1,2,3}-*.md`). **승인 ① 사용자 대기** — 기본값: 미선택 시 Pro · 공통 탭 상단 라디오 + 기존 저장 버튼 · 탭 이름 「공통」 · 설명에 가격 숫자 없음. 가격(Google 2026-10-07): Pro \$2/\$12, Flash \$0.75/\$3.75(2027-01-01부터 \$1.50/\$7.50) per 1M. 승인 뒤: server-designer ∥ contract-designer → ui-designer → checker → 승인 ② → 구현(0004 마이그레이션 포함) → verify → 커밋. 약 2.5시간.
- **S5 2차(배포) 선행 조건**: 지인 답(아래 질문 5) → Cloudflare 초대 수락 → `/deploy`(D1 생성·Secrets 3개 `TOKEN_SECRET`·`LLM_API_KEY`·`OWNER_MB_IDS`·vars 확인·0001~0004 적용·deploy·헬스체크) → 지인에게 임베드 주소 한 줄 + SECRET 채운 PHP 덩어리(1회성 링크) 전달 → 확인표. 운영 Gemini 키가 로컬 키와 같은지 사용자 확인.
- **지인 질문(최종)**: ① Cloudflare 계정 있나/만들 수 있나 ② 사이트 주소 london-gossip.my 하나뿐인가·www도 쓰나 ③ 대화창 주소 workers.dev 기본 이름 OK? ④ 테마 파일 직접 고쳐 올릴 수 있나 ⑤ 파일 고칠 날·시간(1회성 링크).
- 테스트 토큰(.ld-token.local)은 만료됨 → `npm run token:test -w server -- sign --secret <.dev.vars의 TOKEN_SECRET> --mb-id owner01 --level 10`로 재발급(TOKEN_SECRET은 32자 이상이어야 서버가 기동).

### (기록) 2026-10-07 아침 보고 (자동 마감)

- **S3d(고정 명칭 「어떠한 의지」 + 전송 시 자동 응답) 완료·커밋·푸시.** 원격 main = `b10694c`(커밋 4개: contract `b5bb893` · server `9f94741` · chat `a15cb6e` · docs `b10694c`). verify **PASS**(`doc/300_검증/verify-S3d-20261007-0029.md`, CRITICAL·HIGH 0, MEDIUM 1·LOW 7은 후속 §2-1a).
- 증거: shared 140 · server 343 · ui 660(2회) · 전체 1143/1143 · tsc·lint·build 0 · 캡처 `doc/300_검증/screenshots/20261007-0004/` 6장 · 실키 종단(이름 지목 0ms·모델 선택·자동 응답 201).
- 모델은 그대로(Pro, 사용자 지정 🔒). 이름 지목 규칙 + 선택 15초 적용.
- 개발 서버는 내렸고 PC는 종료 예약했다. 다시 보려면 `/dev-start`(또는 `server`에서 `npx wrangler dev --port 3000` + `npm run dev -w ui`) 후 주인 주소로 접속. **테스트 토큰(.ld-token.local)은 2026-10-07 08:31 KST 만료** → 같은 방식(HMAC-SHA256, payload {mb_id,nick,ch_name,level,exp}, .dev.vars의 TOKEN_SECRET)으로 재발급.
- 로컬 D1 방 2곳(「안개 낀 런던의 아침」·「아직 아무도 없는 방」)에 테스트 메시지가 남아 있다(지워도 됨).
- 다음 할 일: §2-1a 후속 → S4 장기기억 설계 → S5 전달·배포(지인 결정: 운영 모델명·단가·회원 ID).

## 0. 시작 확인
- 세션은 **프로젝트 루트**(`london_dispatch/`)에서 연다. `.claude` 폴더나 상위 폴더에서 열면 가드 경로가 어긋나 에이전트 Bash·Write가 막힌다.
- 진행 방식: 메인 세션은 소스·산출 문서를 직접 고치지 않고 리프 에이전트에 위임한다(CLAUDE.md §5-0). S1~S3은 메인 세션이 task-manager 역할을 대행했다(사용자 지시 2026-10-05). task-manager 에이전트에는 Bash·ui-fixer·ui-test-conflict-checker가 없어 메인 대행이 실제로 더 낫다.
- `server/.dev.vars`는 Read로 열지 않는다. 없으면 `npx wrangler dev --port 3000 --var TOKEN_SECRET:<로컬 임의값 32자 이상> --var LLM_PROVIDER:fake --var OWNER_MB_IDS:<테스트 주인 ID>`(2026-10-07부터 TOKEN_SECRET 32자 미만은 CONFIG_INVALID)로 띄운다(키 없이 speak까지 동작). 로컬 테스트 토큰(.ld-token.local, git 제외)은 같은 TOKEN_SECRET 값으로 서명해야 하며, 비밀값 실값은 문서에 적지 않는다(SEC-002).
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
- git: `main` 단일 브랜치, 원격 `origin`. S3 커밋 3건 푸시 완료(bc5776d). S3~S4 전부 커밋·푸시 완료(S4는 2026-10-07 커밋).

## 2. 남은 일

### 2-1. 우선
1. (완료) S3 푸시 2026-10-06 — 원격 main = bc5776d. 자격 증명 캐시 정리 후 성공. 참고: 전역 `.gitconfig`에 `http.sslVerify=false`(TLS 검증 꺼짐) — 사용자에게 복구 권고함.
2. (완료) **S3b 월 AI 비용 상한** 2026-10-06 — 구현·테스트(763/763)·종단 확인 끝. 커밋은 사용자 확인 후 `/sync`. 운영 전 지인이 `wrangler.toml [vars]`의 단가·환율·예산을 확인하고, Google Cloud 예산 알림(10만원)을 걸도록 S5 handoff에 포함.
3a. **S3d(고정 명칭 「어떠한 의지」 + 전송 시 자동 응답) — 완료 2026-10-07(승인 ① 22:35·② 23:12).** 증거: shared 140 · server 343 · ui 660 · verify PASS `doc/300_검증/verify-S3d-20261007-0029.md` · 캡처 `doc/300_검증/screenshots/20261007-0004/` · chat manual 4.5·FAQ·img 4장. 결정: 모델 변경 금지(🔒) · 이름 지목 규칙 + 선택 15초 · 저장만 전송 없음 · 생성 중 편집 저장 잠김. 남은 것: Button `ariaDescribedBy` 추가 후 InlineEditor 지역 ref 제거(ui-postprocessor, component-usage-lessons 코어 결함 후보) · 편집기 열린 채 재작성 중 저장 버튼 활성(CR 후보) · 테스트 메시지가 로컬 D1 방 2곳에 남음(「안개 낀 런던의 아침」·「아직 아무도 없는 방」) · 실제 Gemini 응답 16~30초(느린 시간대) 관찰. verify 후속은 next-session §2-1a.
3b. **S3e(말풍선 액션 버튼 — 메뉴 대체) 완료 2026-10-07(사용자 지정 🔒, 보강 CR-003).** 말풍선 아래 「수정」「삭제」 항상 표시, 마지막 캐릭터 대사에 「재작성」, 롱프레스/우클릭 메뉴·MessageMenuSheet 제거, 권한 규칙 불변(등급 통과자). 증거: ui 686/686 · 루트 1169/1169 · typecheck·lint·build 0 · `doc/300_검증/screenshots/20261007-1453/` 5장 · chat manual 갱신 · CR-003 검증됨. 설계 `ui/src/chat/design/actions.md` v2.0(.1). 후속: 스킬 문구 갱신(tsx-rules·component-catalog·layout-templates·ui-design-strategy §6.5) · 공용 `useLongPress` 사용처 0 정리(ui-postprocessor) · Button 글자색 톤 코어 결함 후보(component-usage-lessons) · 실기기 터치 44px·스크린리더 MC-CH-17 미실행.
3. **S3c(캐릭터 설정 화면) — 구현·테스트·문서 완료 2026-10-06(승인 ② 19:36).** 증거: shared 138 · server 318 · ui 592 · lint·typecheck·build 0 · 캡처 `doc/300_검증/screenshots/20261006-2033/` · settings manual img 14장. 남은 것: verify 판정 반영 → `/sync` 커밋(사용자 확인) · 수동 TC-ST-036~038·TC-RM-040(실제 iframe 파일 저장·스크린리더) · 운영 Secrets `OWNER_MB_IDS`(지인 ID, 사용자 전달 대기) · S5 embed-guide에 iframe sandbox 시 `allow-downloads` · chat 스펙 3개 격리 mock(rooms Q-02, 보강 CR 후보). 로컬 테스트: `.ld-token.local`(owner01·tester, 12h) + wrangler `--var OWNER_MB_IDS:owner01` — 토큰 만료 시 같은 방식으로 재발급(스크래치패드 스크립트, HMAC-SHA256·payload {mb_id,nick,ch_name,level,exp}). 산출: `doc/200_설계/architecture/s3c-01-구조분석.md`·`s3c-02-전반설계.md`·`s3c-03-인계패킷.md`. 다음 세션 할 일 순서:
   1. (완료 2026-10-06) 메인 세션: 요구 문서에 R-SET-001~012 등록(02 §8 초안 전사, 🔒 유지) + 🔒 개정 7건 반영(문안 02 §7): 확정사항 §5·§9-3a·CLAUDE.md §9("관리 화면 없음"→"캐릭터 설정 화면 1개") · R-API-001(+GET/PUT `/api/settings/characters`) · R-API-002(15종 `OWNER_ONLY` 403) · R-LLM-002(D1 저장, JSON은 시드)·R-LLM-003(조립 확장) · R-AUTH-003(설정 GET 토큰 필요 예외) · 확정사항 §4 폴더(server/src/settings/, ui/src/settings/) · rtm.md S3c 행.
   2. (설계 완료 2026-10-06 — server-designer·contract-designer·ui-layout-designer·ui-designer·ui-design-checker 3차 PASS) 03 인계패킷 §1부터 위임: server-designer ∥ contract-designer → ui-layout-designer → ui-designer → ui-design-checker → 승인 ②(S3c) → contract-impl(shared) → server-impl ∥ ui-test-designer → contract-impl(routes·ui/api, client에 PUT 추가) → ui-impl → ui-tester → manual → verify. 예상 약 3시간.
   3. 사용자 결정 확정분: 주인 식별 = 토큰 mbId ↔ `OWNER_MB_IDS`(Secrets, 로컬은 `.dev.vars`; 비우면 전원 403; **지인 ID만 — 사용자 본인 ID 제외, 2026-10-06 결정으로 02 §11 Q2 권고 「지인+사용자」 대체**) · 출력 규칙 편집 안 함 · 주인 판정은 화면 시작 시 GET 1회 탐침 · 가져오기 상한 초과 거부 · 내보내기는 저장값 · 필드 상한 02 §8 · 복원 버튼 없음. **주인 회원 ID는 사용자가 알려 줘야 함**(갠홈 그누보드 mb_id).
   4. 확인 필요: 갠홈 iframe `sandbox` 속성 유무(있으면 `allow-downloads` 필요 — S5 embed-guide에 포함). 내보내기는 Blob 다운로드 + 복사용 텍스트 영역 병행 설계.
4. (완료 2026-10-07) **S4 장기기억** — server memory 모듈(speak 뒤 waitUntil 자동 요약: 미요약 > 60이면 오래된 구간(최근 40 제외, 1회 100개·2만 자·LLM 25초) 요약·합본·source_until_id 전진, 조건부 UPSERT 중복 방지, Cron 미도입) · 계약 v0.7 E13/E14 · chat ⋯ 메뉴 「장기기억」 시트(보기·편집 4000자·저장·버림 확인, 저장 실패는 시트 안 문구). 증거: vitest 1274/1274 · typecheck·lint·build 0 · 캡처 `doc/300_검증/screenshots/20261007-1817/` · 실키 종단(70개 방 speak → 11.6초 뒤 31개 요약) · 매뉴얼 4.15. 설계 결정(승인 ② 생략, 사용자 포괄 지시): 요약 기준 = 미요약 수 · 편집 경합은 마지막 저장 우선(409 없음) · 요약 목표 2000/상한 4000(문장 경계 절단) · rooms.updated_at 불변. **후속 완료(2026-10-07)**: 사용자 지정 🔒 ① 「어떠한 의지」=장면 밖 서술자(R-LLM-003 개정: 캐릭터가 말 걸지 않음·요약에 행위자로 등장 안 함, 실키 재확인) ② 요약을 비워 저장하면 처음부터 재요약(R-MEM-001 개정 "다시요약", PUT '' → sourceUntilId 0). **보류**: 공용화 후보 TextArea ariaDescribedBy·BottomSheet ariaLabelledBy · 끝 공백만 바뀐 편집은 저장 비활성(정규화 비교).
4a. (기록) 이전 S4 계획: **S4(장기기억) 설계부터**: server-designer(memory.md 신규 — `summarizeIfNeeded`·`afterSpeak` 훅 연결·`source_until_id` 전진·중복 방지 R-MEM-003·`memory.get/put`) → contract-designer(E13·E14 GET/PUT memory, api.md v0.5) → ui-designer(chat ⋯ 메뉴 "장기기억" 항목 + M1 MemorySheet, R-CHAT-012) → ui-design-checker → 승인 ②(S4) → 구현(shared → server → routes/api ∥ 시나리오 → 화면 → 테스트 → 매뉴얼).
5. **S5(전달·배포)** — 1차 완료 2026-10-07(handoff 4문서 · token:test 도구 · deploy.md 정정, `136a25e`). 2차(실제 배포)는 §0-0 선행 조건 뒤 `/deploy`. **S3f(모델 선택)를 먼저 끝내고 배포**하는 것을 권고(LLM_MODEL 기본값 `gemini-2.5-flash`는 404 — S3f에서 Pro 폴백으로 개정).
6. **S3f(설정 화면 모델 선택, 🔒 2026-10-07)** — 설계 3문서 완료, 승인 ① 대기(§0-0).

### 2-1a. (완료 2026-10-07) S3c·S3d verify 후속 — server 9건(TOKEN_SECRET≥32·/api/* 보안 헤더·함수 분해·NFC 정규화 등, server 349) · ui 후작업 4건(Button ariaDescribedBy·useLongPress 삭제·errorText 공용화·주석) · 계약 v0.6.1 · 스킬 6파일 · 설계 문서 동기화. 전체 1165/1165. 보류: Button tone prop(시나리오 선행) · /embed Referrer-Policy(S5) · SEC-004 줄 머리 `[` 무력화(요구 미승격). 아래는 당시 기록.

#### (기록) S3c verify 후속(PASS 2026-10-06, `doc/300_검증/verify-S3c-20261006-2059.md`) — 사용자 허락 후 계층 매니저로
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
