---
description: Cloudflare Workers 배포 — verify PASS·clean tree·Secrets 키 확인 → npm run build → 사용자 확인 후 wrangler d1 migrations apply --remote → 사용자 확인 후 wrangler deploy → /api/health 헬스체크 → doc/300_검증/deploy-*.md 기록. 배포 주체가 지인이면 절차서만 산출. 메인 세션 전용
---

# /deploy — Cloudflare Workers 배포

운영 Worker에 올린다. 갠홈 패널이 바로 이 주소를 iframe으로 띄우므로, 올라간 순간 지인·방문자에게 보인다.

> 프로젝트 루트가 작업 디렉터리다. 절대 경로를 쓰지 않는다. **메인 세션에서만** 실행한다(서브에이전트의 `wrangler deploy`·`--remote`는 가드가 막는다). wrangler는 전역 설치가 아니라 `server/` devDependency라 `npx wrangler …`로 부른다. 모든 wrangler 명령은 `server/wrangler.toml`을 읽어야 하므로 `--config server/wrangler.toml`(또는 `npm run -w server …`)로 지정한다.

## -1. 배포 주체 확인 (확정사항 §9-8)

| 주체 | 이 명령이 하는 일 |
|---|---|
| 지인이 직접 배포(접근 권한을 못 받았을 때) | 0단계 선행 확인과 `npm run build`까지만 실행하고, 1~3단계는 **절차서**로 써서 `doc/300_검증/deploy-{STAMP}.md`에 남긴다. `wrangler deploy`·`--remote`는 실행하지 않는다 |
| **우리가 지인 계정으로 배포(기본값 — 확정사항 §9-8. 접근은 지인이 Cloudflare 구성원으로 초대(Administrator) → 우리 PC에서 `npx wrangler login`; API 토큰은 대안 — 2026-10-07, handoff/cloudflare-setup.md)** | 0~5단계 전부 실행. 토큰은 환경변수 `CLOUDFLARE_API_TOKEN`으로만 받고 파일·문서·보고에 값을 남기지 않는다 |

어느 쪽인지 `doc/000_프로젝트_확정사항.md` §9-8을 보고, 미결이면 `AskUserQuestion`으로 묻는다.

## 0. 선행 확인 (하나라도 어긋나면 중단)

```bash
git status --porcelain
git log -1 --format=%h
npx wrangler --config server/wrangler.toml whoami
npx wrangler --config server/wrangler.toml secret list
npx wrangler --config server/wrangler.toml d1 migrations list <DB> --remote
```

| 확인 | 기준 |
|---|---|
| verify | 최신 `doc/300_검증/verify-*.md`가 **PASS**이고 그 뒤로 소스 커밋이 없다. 없으면 `claude --agent verify-manager` 안내 후 중단 |
| 작업 트리 | `git status --porcelain` 비어 있음. 미커밋이면 `/sync` 먼저 |
| Cloudflare 로그인 | `wrangler whoami`에 계정이 나온다. 안 나오면 `npx wrangler login`(브라우저) 또는 `CLOUDFLARE_API_TOKEN` 설정은 **사용자가** 한다 |
| Secrets | `wrangler secret list`는 **이름만** 출력한다(값은 서버에만 있다). 필수 Secret이 모두 있어야 한다 |
| 비밀 아닌 설정 | `server/wrangler.toml [vars]`에 필수 키가 있고, 비밀값(`TOKEN_SECRET`·`LLM_API_KEY`·`OWNER_MB_IDS`)이 `[vars]`에 **없어야** 한다 |
| D1 | `[[d1_databases]]`의 `binding = "DB"`·`database_id`가 운영 DB를 가리킨다. `migrations list --remote`로 미적용 마이그레이션 목록을 본다 |
| 정적 화면 | `[assets] directory = "../ui/dist"`, `/embed`로 서빙 |

필수 Secret: `TOKEN_SECRET`(32자 이상) `LLM_API_KEY` `OWNER_MB_IDS`(지인 회원 ID 1개 — 비우면 설정 화면 전원 403)
필수 `[vars]`: `LLM_PROVIDER` `LLM_MODEL` `ALLOWED_FRAME_ANCESTORS` `TOKEN_MIN_LEVEL` `RATE_LIMIT_PER_MIN`

- 빠진 Secret은 이름만 보고하고 멈춘다. 값은 지인(또는 사용자)이 `npx wrangler --config server/wrangler.toml secret put <NAME>`로 넣는다(이 세션은 비밀값을 받지 않는다). `server/.dev.vars.example`이 키 목록의 단일 소스다.
- `TOKEN_SECRET`은 갠홈 PHP 조각의 SECRET과 같은 값이어야 한다(`doc/handoff/`). 값 전달 방법은 handoff 문서에 적힌 별도 채널.
- 버전은 루트 `package.json`의 `version`. 올릴 내용이 기능 추가면 버전 올림을 제안한다(사용자 확인).

### 0-1. 빌드

```bash
npm run build 2>&1 | tail -40
```

- ui `vite build` → `ui/dist/`, server `wrangler deploy --dry-run --outdir dist` → `server/dist/` 번들. 둘 다 exit 0이어야 한다. 실패는 `/dev-build` 라우팅 표를 따른다. 이 명령은 고치지 않는다.
- 번들에 들어가면 안 되는 것: `.claude/` · `doc/` · `server/.dev.vars` · `server/.wrangler/` · `.git/` · 스크린샷. Workers 번들은 import된 모듈과 `[assets]` 폴더만 올리므로 `ui/dist/` 안에 위 폴더가 복사되지 않았는지 `ls ui/dist`로 본다.

## 1. 마이그레이션 (사용자 확인 필수)

미적용 마이그레이션이 있을 때만. `AskUserQuestion`으로 「`server/migrations/NNNN_*.sql` {목록}을 운영 D1 `<DB>`에 적용할까요?」를 받는다. 승인 없이 실행하지 않는다.

```bash
npx wrangler --config server/wrangler.toml d1 migrations apply <DB> --remote
```

- 되돌리기 마이그레이션은 없다(D1은 트랜잭션 롤백만). 스키마를 지우는 SQL(`DROP`·`DELETE`)이 들어 있으면 멈추고 사용자에게 보인다 — 훅(`ld-destructive-guard.sh`)도 `--remote` 파괴 SQL을 막는다.
- 코드가 새 스키마를 전제하면 **마이그레이션 → 배포** 순서를 지킨다. 반대면 구 코드가 새 컬럼을 모를 뿐 깨지지 않는다.

## 2. 배포 (사용자 확인 필수)

`AskUserQuestion`으로 「버전 X.Y.Z, 커밋 abc1234를 Cloudflare Worker `{name}`에 배포할까요?」를 받는다. 승인 없이 실행하지 않는다.

```bash
npx wrangler --config server/wrangler.toml deploy 2>&1 | tail -30
npx wrangler --config server/wrangler.toml deployments list | head -10
```

- 출력 마지막의 `https://{name}.{account}.workers.dev` 가 임베드 도메인이다(커스텀 도메인이면 `[routes]`의 값).
- 배포는 수 초 안에 전 세계에 반영된다. 되돌리기는 `wrangler rollback`(사용자 확인) 또는 이전 커밋 재배포.

## 3. 헬스체크

```bash
curl -s -o /dev/null -w "%{http_code}" https://<domain>/api/health
curl -s -o /dev/null -w "%{http_code}" https://<domain>/embed
curl -s -I https://<domain>/embed | grep -i content-security-policy
npx wrangler --config server/wrangler.toml tail --format pretty --once 2>&1 | head -20
```

- `/api/health` 200, `/embed` 200, CSP 헤더에 `frame-ancestors http://london-gossip.my`가 있어야 한다.
- 500이면 `wrangler tail`로 첫 오류 줄을 본다. Secret 누락은 `parseEnv` 검증 메시지로 드러난다(값은 찍히지 않는다).
- 도메인이 처음 생겼거나 바뀌었으면 4단계 handoff 갱신이 필요하다.

## 4. 기록·handoff

`doc/300_검증/deploy-{YYYYMMDD-HHMM}.md`:

```
# 배포 {YYYY-MM-DD HH:MM}
- 주체: 우리(API 토큰) | 지인(절차서)
- 버전: {package.json version} · 커밋: {sha7}
- Worker: {name} · D1: {database_name} · 마이그레이션 적용: {NNNN…|없음}
- 도메인: https://{domain}
- 헬스: /api/health {code} · /embed {code} · CSP frame-ancestors {있음|없음}
- verify: doc/300_검증/verify-{…}.md (PASS)
- 비고: {버전 올림 · 문제 · 지인이 실행할 명령 목록}
```

- 지인이 배포하는 경우 위 문서의 「비고」에 1~3단계 명령을 **그대로** 적어 절차서로 만든다(Secret 값은 적지 않는다).
- 임베드 주소가 바뀌었거나 처음이면 **contract-designer에 `doc/handoff/` 갱신을 위임**하도록 안내한다(메인 세션이 직접 쓰지 않는다). 저쪽이 `rosebell-chatbot.php`의 `$rb_chatbot_embed_url`에 넣을 값은 `https://{domain}/embed`.
- `TOKEN_SECRET`을 바꿨으면 저쪽 PHP 조각의 SECRET도 같이 바꿔야 한다. handoff 문서에 "값은 별도 채널로 전달"만 적고 실값은 쓰지 않는다.

## 5. 보고

```
배포: 완료 | 실패 | 절차서 산출(지인 배포)
- 버전 {X.Y.Z} · 커밋 {sha7} → https://{domain}
- 마이그레이션 {적용 NNNN… | 없음}
- 헬스 /api/health {code} · /embed {code}
- 기록: doc/300_검증/deploy-{STAMP}.md
- handoff 갱신 필요: 예(contract-designer 위임 안내) | 아니오
```
