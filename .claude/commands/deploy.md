---
description: Railway 배포 — verify PASS·clean tree·환경변수 확인 → 사용자 확인 후 railway up → 도메인·헬스체크 → doc/300_검증/deploy-*.md 기록. 메인 세션 전용
---

# /deploy — Railway 배포

운영 서버에 올린다. 갠홈 패널이 바로 이 주소를 iframe으로 띄우므로, 올라간 순간 지인·방문자에게 보인다.

> 프로젝트 루트가 작업 디렉터리다. 절대 경로를 쓰지 않는다. **메인 세션에서만** 실행한다(서브에이전트의 `railway up`은 가드가 막는다).

## 0. 선행 확인 (하나라도 어긋나면 중단)

```bash
git status --porcelain
git log -1 --format=%h
railway status
railway variables --kv | cut -d= -f1
```

| 확인 | 기준 |
|---|---|
| verify | 최신 `doc/300_검증/verify-*.md`가 **PASS**이고 그 뒤로 소스 커밋이 없다. 없으면 `claude --agent verify-manager` 안내 후 중단 |
| 작업 트리 | `git status --porcelain` 비어 있음. 미커밋이면 `/sync` 먼저 |
| Railway 연결 | `railway status`에 프로젝트·서비스·환경이 나온다. 안 나오면 `railway login` → `railway link`는 **사용자가** 한다 |
| 환경변수 | 아래 키가 모두 존재(**값은 출력하지 않는다** — `--kv` 출력을 `cut -d= -f1`로 키만 본다) |

필수 키: `PORT` `DATABASE_PATH` `TOKEN_SECRET` `LLM_PROVIDER` `LLM_API_KEY` `LLM_MODEL` `ALLOWED_FRAME_ANCESTORS` `TOKEN_MIN_LEVEL` `RATE_LIMIT_PER_MIN`

- 빠진 키는 이름만 보고하고 멈춘다. 값은 사용자가 Railway 대시보드나 `railway variables --set`으로 넣는다(이 세션은 비밀값을 받지 않는다).
- `DATABASE_PATH`는 Volume 마운트(`/app/data/london_dispatch.sqlite`)여야 한다. Volume이 없으면 재배포 때 DB가 사라진다 — 사용자에게 확인.
- 버전은 루트 `package.json`의 `version`. 올릴 내용이 기능 추가면 버전 올림을 제안한다(사용자 확인).

## 1. 배포 (사용자 확인 필수)

`AskUserQuestion`으로 「버전 X.Y.Z, 커밋 abc1234를 Railway {환경}에 배포할까요?」를 받는다. 승인 없이 실행하지 않는다.

```bash
railway up --detach 2>&1 | tail -30
railway logs --lines 60
```

- 빌드는 `railway.json`(`npm ci` → `npm run build` → `npm start`)을 따른다.
- 빌드 실패는 `/dev-build` 라우팅 표를 따른다. 이 명령은 고치지 않는다.

## 2. 도메인·헬스체크

```bash
railway domain
curl -s -o /dev/null -w "%{http_code}" https://<domain>/api/health
curl -s -o /dev/null -w "%{http_code}" https://<domain>/embed
curl -s -I https://<domain>/embed | grep -i content-security-policy
```

- `/api/health` 200, `/embed` 200, CSP 헤더에 `frame-ancestors http://london-gossip.my`가 있어야 한다.
- 도메인이 처음 생겼거나 바뀌었으면 4단계 handoff 갱신이 필요하다.

## 3. 포함·제외 확인 (⛔)

배포물에 들어가면 안 되는 것: `.claude/` · `doc/` · `.env` · `data/` · `.git/` · 스크린샷. `.railwayignore`가 있으면 그 내용을, 없으면 `.gitignore` 기반 Nixpacks 기본 동작임을 확인한다. `railway logs`의 빌드 단계에서 위 폴더가 복사되는 줄이 보이면 중단하고 `.railwayignore`를 추가한다(사용자 확인).

## 4. 기록·handoff

`doc/300_검증/deploy-{YYYYMMDD-HHMM}.md`:

```
# 배포 {YYYY-MM-DD HH:MM}
- 버전: {package.json version} · 커밋: {sha7}
- 환경: {railway environment} · 서비스: {service}
- 도메인: https://{domain}
- 헬스: /api/health {code} · /embed {code} · CSP frame-ancestors {있음|없음}
- verify: doc/300_검증/verify-{…}.md (PASS)
- 비고: {Volume 확인 · 버전 올림 · 문제}
```

- 임베드 주소가 바뀌었거나 처음이면 **contract-designer에 `doc/handoff/` 갱신을 위임**하도록 안내한다(메인 세션이 직접 쓰지 않는다). 저쪽이 `rosebell-chatbot.php`의 `$rb_chatbot_embed_url`에 넣을 값은 `https://{domain}/embed`.
- `TOKEN_SECRET`을 바꿨으면 저쪽 PHP 조각의 SECRET도 같이 바꿔야 한다. handoff 문서에 "값은 별도 채널로 전달"만 적고 실값은 쓰지 않는다.

## 5. 보고

```
배포: 완료 | 실패
- 버전 {X.Y.Z} · 커밋 {sha7} → https://{domain}
- 헬스 /api/health {code} · /embed {code}
- 기록: doc/300_검증/deploy-{STAMP}.md
- handoff 갱신 필요: 예(contract-designer 위임 안내) | 아니오
```
