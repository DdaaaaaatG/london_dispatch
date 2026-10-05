# 다음 세션 인계 (2026-10-05 작성 · 2026-10-05 Cloudflare 전환 반영)

- 결정은 `doc/000_프로젝트_확정사항.md`가 단일 소스다. 이 문서는 **지금 상태 · 남은 일 · 결정 대기 · 꼭 지킬 것**만 담는다. 항목을 끝내면 지우고, 새 일은 해당 절에 짧게 추가한다.

## 0. 시작 확인
- 세션은 **프로젝트 루트**(`london_dispatch/`)에서 연다. `.claude` 폴더나 상위 폴더에서 열면 가드 경로가 어긋나 에이전트 Bash·Write가 막힌다.
- 진행 방식: 메인 세션은 소스·산출 문서를 직접 고치지 않고 리프 에이전트에 위임한다(CLAUDE.md §5-0).
- `server/.dev.vars`는 Read로 열지 않는다. 없으면 `server/.dev.vars.example`을 복사해 사용자가 채운다.

## 1. 현재 상태 (2026-10-05)
- **서버 실행 환경이 Cloudflare Workers로 확정**(지인 결정, 🔒). Railway·Fastify·better-sqlite3·`.env`·`data/`는 쓰지 않는다. 대체: Hono 4 · Cloudflare D1 · Workers Static Assets · Secrets(`.dev.vars`) · `@cloudflare/vitest-pool-workers` · `wrangler deploy`. 확정사항 §2 개정판이 기준.
- **`.claude` 자산 생성 완료**, Cloudflare 기준으로 일괄 갱신함(에이전트 30·스킬·명령 7·훅·스크립트·rules). 확정사항 §7이 목록이다. 갱신 뒤 `grep -ri railway`로 잔존 0건을 확인했다.
- **소스 미구축.** `server/src` `shared/` `ui/` `package.json` `server/wrangler.toml`이 아직 없다. `server/.dev.vars.example`만 있다.
- git 저장소 초기화 완료(`main`). 첫 커밋 = Cloudflare 전환 전 자산 스냅샷. 원격은 아직 없다.
- 갠홈 쪽 준비는 끝나 있다: `http://london-gossip.my/` 헤더에 말풍선 버튼 + 오른쪽 패널(390×640)이 올라가 있고 `rosebell-chatbot.php`의 `$rb_chatbot_embed_url`이 비어 있다. 우리 https 주소와 토큰 PHP 조각을 주면 끝난다. 저쪽 파일 사본은 `../chatbot update/theme/victorian/`(저장소 밖, 참조용).

## 2. 남은 일

### 2-1. 우선
1. **미결 사항 상태(2026-10-05 사용자 전달)** — 4번 AI는 **Gemini 확정**(키는 지인이 발급해 전달). 8번은 **지인 Cloudflare 계정에 우리가 접근해 직접 셋팅·배포**로 확정(접근 방식·플랜은 미정). 1번 등급 숫자는 지인이 셋팅 중 → 기본값 5로 구축하고 확정되면 `wrangler.toml [vars] TOKEN_MIN_LEVEL`만 변경. 3번 캐릭터 설정은 **JSON 파일 방식 확정**(§9-3a). **구축 시작됨**: 2026-10-05 task-manager 0단계(요구 확정) 착수. 진행 상태는 `doc/state.json`.
2. **구축 시작** — `claude --agent task-manager`. 승인 ①(요구·RTM) → 승인 ②(설계 묶음 + **초기 의존성 목록 승인**) → 구현 자동. 범위 상한: 화면 2(rooms·chat), server 모듈 6.
3. 초기 의존성(승인 ②에서 한 번에):
   - server: `hono` `@hono/zod-validator` `zod` / dev: `wrangler` `@cloudflare/workers-types` `@cloudflare/vitest-pool-workers`
   - ui: `react` `react-dom` `vite` `@vitejs/plugin-react` / dev: `jsdom` `@testing-library/react`
   - 공통 dev: `typescript` `vitest` `eslint` `prettier` `concurrently`
   - AI SDK는 제공사 확정 후(Workers 호환 `fetch` 기반이어야 함).
4. 로컬 Cloudflare 준비(메인 세션): `npx wrangler login`은 **사용자가** 수행. 로컬 dev·테스트는 로그인 없이도 된다(로컬 D1).
5. 원격 저장소 생성 후 `/sync`.

### 2-2. 구축 뒤
- `server/scripts/token-test.ts`(`npm run token:test`) — `/run-app` 쓰기 화면 캡처에 필요.
- Cloudflare 쪽(지인 계정): D1 생성(`wrangler d1 create`), Secrets(`TOKEN_SECRET` `LLM_API_KEY`) 입력, 플랜 선택. `/deploy`는 그 뒤. 배포 주체가 지인이면 `/deploy`는 절차서만 산출한다.
- `doc/handoff/`(contract-designer): 임베드 안내 + 토큰 PHP 조각. 저쪽에 전달.

## 3. 결정 대기 (확정사항 §9)
| # | 항목 | 기본값 |
|---|---|---|
| 1 | 버튼 허용 등급 | 5 (지인 셋팅 중, 확정 시 [vars]만 변경) |
| 2 | 지시자 표시 이름 | 캐릭터명 우선, 없으면 닉네임 |
| 3 | 캐릭터 프롬프트 | **JSON 파일 방식 확정**(`server/characters/*.json`). 내용은 사용자·지인이 작성, 전까지 임시 문구 |
| 4 | AI 제공사·모델·키 | **Gemini 확정**. 모델 기본 gemini-2.5-flash. 키는 지인 발급 |
| 5 | 방 이름 변경·삭제 권한 | 등급 통과자 누구나 |
| 6 | 쓰기 레이트리밋 | 토큰당 분당 20 |
| 7 | 임베드 허용 출처 | `http://london-gossip.my`, `https://london-gossip.my` |
| 8 | Cloudflare 계정·배포 주체·플랜 | 지인 계정 · **우리가 직접 셋팅·배포(확정)** · 접근 방식·플랜 미정 |

## 4. 꼭 지킬 것
- 아보카도 본체·그누보드 코어는 건드리지 않는다. 저쪽이 하는 수정은 테마 파일 안의 주소 한 줄 + 토큰 몇 줄뿐이다.
- 메인 화면 대사창(캐릭터 옆 말풍선) 연동 **안 함**.
- 설정·비밀값 읽기는 `server/src/env.ts`에서만(Workers `env` 바인딩 파싱). 비밀값 실값은 `server/.dev.vars`(로컬)·Cloudflare Secrets(운영)에만.
- 저쪽 PHP는 **https 주소만** 받는다. http 임베드 주소를 주지 않는다.
- 새 의존성은 사용자 승인 후 메인 세션에서만 설치한다.
- `wrangler deploy`·`d1 migrations apply --remote`·`wrangler delete`는 `/deploy` 절차 밖에서 실행하지 않는다.
- 참조 원본(kuro_keyviewer·아보카도 샘플·DDB ABC)의 개념을 이 프로젝트 문서에 옮겨 적지 않는다.
