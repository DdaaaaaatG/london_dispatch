# 다음 세션 인계 (2026-10-05 작성)

- 결정은 `doc/000_프로젝트_확정사항.md`가 단일 소스다. 이 문서는 **지금 상태 · 남은 일 · 결정 대기 · 꼭 지킬 것**만 담는다. 항목을 끝내면 지우고, 새 일은 해당 절에 짧게 추가한다.

## 0. 시작 확인
- 세션은 **프로젝트 루트**(`london_dispatch/`)에서 연다. `.claude` 폴더나 상위 폴더에서 열면 가드 경로가 어긋나 에이전트 Bash·Write가 막힌다.
- 진행 방식: 메인 세션은 소스·산출 문서를 직접 고치지 않고 리프 에이전트에 위임한다(CLAUDE.md §5-0).
- `.env`는 Read로 열지 않는다. 없으면 `.env.example`을 복사해 사용자가 채운다.

## 1. 현재 상태 (2026-10-05)
- **`.claude` 자산 생성 완료** — kuro_keyviewer 자산을 server / contract / ui 3계층으로 옮겨 만들었다. 에이전트 30·스킬·명령 7·훅·스크립트·rules. 확정사항 §7이 목록이다.
- **소스 미구축.** `server/` `shared/` `ui/` 폴더와 `package.json`이 아직 없다. git 저장소도 아직 아니다(`git init` 전).
- 갠홈 쪽 준비는 끝나 있다: `http://london-gossip.my/` 헤더에 말풍선 버튼 + 오른쪽 패널(390×640)이 올라가 있고 `rosebell-chatbot.php`의 `$rb_chatbot_embed_url`이 비어 있다. 우리 https 주소와 토큰 PHP 조각을 주면 끝난다. 저쪽 파일 사본은 `../chatbot update/theme/victorian/`(저장소 밖, 참조용).

## 2. 남은 일

### 2-1. 우선
1. **미결 사항 확보** — 확정사항 §9 중 최소 **1번(버튼 허용 등급 숫자)**과 **4번(AI 제공사·키 발급자)**을 지인에게 받는다. 없으면 기본값(5 / 제공사 미정·어댑터만)으로 구축을 시작하고 「확인 필요」로 남긴다.
2. **구축 시작** — `claude --agent task-manager`. 승인 ①(요구·RTM) → 승인 ②(설계 묶음 + **초기 의존성 목록 승인**) → 구현 자동. 범위 상한: 화면 2(rooms·chat), server 모듈 6.
3. 초기 의존성(승인 ②에서 한 번에): `fastify` `@fastify/cors` `@fastify/helmet` `@fastify/rate-limit` `@fastify/static` `better-sqlite3` `zod` `dotenv` / `react` `react-dom` `vite` `@vitejs/plugin-react` / `typescript` `tsx` `vitest` `@testing-library/react` `jsdom` `supertest` `eslint` `prettier` `concurrently`. AI SDK는 제공사 확정 후.
4. `git init` → 첫 커밋(자산만) → `/sync`는 원격 생성 후.

### 2-2. 구축 뒤
- `server/scripts/token-test.ts`(`npm run token:test`) — `/run-app` 쓰기 화면 캡처에 필요.
- Railway 프로젝트 생성·Volume(`/app/data`)·환경변수는 **사용자가** 한다. `/deploy`는 그 뒤.
- `doc/handoff/`(contract-designer): 임베드 안내 + 토큰 PHP 조각. 저쪽에 전달.

## 3. 결정 대기 (확정사항 §9)
| # | 항목 | 기본값 |
|---|---|---|
| 1 | 버튼 허용 등급 | 5 |
| 2 | 지시자 표시 이름 | 캐릭터명 우선, 없으면 닉네임 |
| 3 | 캐릭터 프롬프트 작성자 | 우리 임시 작성 |
| 4 | AI 제공사·모델·키 | 미정 |
| 5 | 방 이름 변경·삭제 권한 | 등급 통과자 누구나 |
| 6 | 쓰기 레이트리밋 | 토큰당 분당 20 |
| 7 | 임베드 허용 출처 | `http://london-gossip.my`, `https://london-gossip.my` |

## 4. 꼭 지킬 것
- 아보카도 본체·그누보드 코어는 건드리지 않는다. 저쪽이 하는 수정은 테마 파일 안의 주소 한 줄 + 토큰 몇 줄뿐이다.
- 메인 화면 대사창(캐릭터 옆 말풍선) 연동 **안 함**.
- `process.env`는 `server/src/env.ts`에서만. 비밀값 실값은 `.env`·Railway Variables에만.
- 저쪽 PHP는 **https 주소만** 받는다. http 임베드 주소를 주지 않는다.
- 새 의존성은 사용자 승인 후 메인 세션에서만 설치한다.
- 참조 원본(kuro_keyviewer·아보카도 샘플·DDB ABC)의 개념을 이 프로젝트 문서에 옮겨 적지 않는다.
