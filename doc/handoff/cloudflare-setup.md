# Cloudflare·Google 셋팅 안내

> 실값 없음 · 작성 2026-10-07 · 갱신 2026-10-08(AI 모델 선택) · 소유 contract-designer · 근거 확정사항 §6·§9-8, R-ENV-002 🔒 · R-SET-001 🔒 · R-LLM-007 🔒 · R-LLM-009 🔒 · R-API-006 🔒
> 이 문서에는 키·비밀번호·계정 아이디·회원 아이디 실값이 없다. `{{…}}`는 자리표시다.
> 2026-10-07 사용자 결정: 지인은 개발을 모른다. **지인이 할 일은 최소로, 나머지는 전부 우리가 한다.**

대화창 서버는 **지인의 Cloudflare 계정**에서 돈다(서버 컴퓨터 없음). 계정 주인은 지인이고, 셋팅·배포·운영은 **우리가** 한다(확정사항 §9-8).

---

## 0. 한눈에

**지인이 할 일 (Cloudflare·Google)**

| 할 일 | 필수 | 절 |
|---|---|---|
| Cloudflare 계정이 없으면 만들고, 우리를 **구성원으로 초대**한다 | 필수 | §1 |
| Google 결제에 **월 10만원 예산 알림**을 건다 | 선택 | §2 |

- 갠홈 테마 파일에 할 일은 [embed-guide.md](embed-guide.md) 맨 위 요약에 따로 있다.

**우리가 할 일 (지인은 읽지 않아도 된다)**

| 할 일 | 절 |
|---|---|
| 플랜: Free로 시작(필요하면 나중에 Paid) | §3 |
| D1 데이터베이스 만들기 → `wrangler.toml` 반영 | §4 |
| Secrets 3개 입력(`TOKEN_SECRET`·`LLM_API_KEY`·`OWNER_MB_IDS`) | §5 |
| 비밀 아닌 설정(`[vars]`) 확인 | §6 |
| 데이터베이스 표 만들기(마이그레이션 0001~0004) | §7 |
| 배포 → 임베드 주소 줄을 지인에게 보냄 | §8 |
| 배포 뒤 확인 | §10 |

---

## 1. 지인: 우리를 Cloudflare 구성원으로 초대 (필수)

**계정이 없으면 먼저 만든다.** `https://dash.cloudflare.com/sign-up`에서 이메일로 가입한다(무료). 가입 뒤 2단계 인증을 켜 두면 더 안전하다.

**초대 순서 (클릭만 하면 된다)**

1. `https://dash.cloudflare.com`에 로그인한다.
2. 왼쪽 메뉴에서 **Manage Account**(계정 관리) → **Members**(구성원)를 누른다.
3. **Invite**(초대)를 누른다.
4. 이메일 칸에 **우리가 따로 알려 주는 이메일 주소**를 넣는다.
5. 역할(Role)에서 **Administrator**를 고른다. **Super Administrator는 고르지 않는다.**
6. **Continue** → **Invite**(보내기)를 누른다.
7. 우리에게 "초대 보냈어요"라고만 알려 준다. 우리가 메일을 수락하면 끝이다.

- 화면 이름은 조금 다를 수 있다. 막히면 화면을 찍어 보내 주거나 화면 공유로 같이 한다.
- 운영 중 배포·고장 수리도 우리가 하므로 초대는 계속 둔다. 그만 맡길 때는 Members에서 우리를 지우면 바로 끊긴다.
- 비밀번호·2단계 인증 코드는 우리에게 알려 주지 않는다. 초대만으로 충분하다.

---

## 2. 지인: Google 예산 알림 (선택)

서버의 월 10만원 한도는 **추정치**라 실제 청구와 다를 수 있다([embed-guide.md](embed-guide.md) §7). Google 쪽에서도 알림 메일을 받아 두면 안심이다.

1. Gemini 키를 만든 Google 계정으로 `https://console.cloud.google.com`에 들어간다.
2. 왼쪽 메뉴 **결제**(Billing) → **예산 및 알림**(Budgets & alerts) → **예산 만들기**.
3. 범위는 키가 속한 프로젝트, 금액은 **월 100,000원**(결제 통화가 달러면 그에 맞는 금액).
4. 알림 기준 50%·90%·100%, 받는 사람은 지인 메일(원하면 우리 메일도).
5. 저장.

- 예산 알림은 **메일만 보내고 사용을 막지 않는다.** 실제 차단은 우리 서버의 월 한도가 한다.
- 알림 메일이 오면 우리에게도 알려 준다.
- 어려우면 건너뛰어도 된다. 화면 공유로 같이 해도 된다.

---

## 3. 우리: 플랜

- **Free로 시작한다.** Free는 하루 요청 수와 요청당 CPU 시간에 상한이 있다(공개 값 하루 10만 건·10ms, 바뀔 수 있으니 요금 페이지에서 확인).
- 서버 로그(`wrangler tail`)에 CPU·요청 한도 초과 오류가 보이면 Paid(월 5달러)로 바꾸자고 지인에게 알린다. 결제 카드가 필요해 그때만 지인에게 부탁한다. 바꿔도 셋팅은 그대로다.
- AI 비용(Google)은 Cloudflare 요금과 **별개**다.

---

## 4. 우리: D1 데이터베이스

대화방·메시지·장기기억·캐릭터 설정·월 AI 사용액을 담는다.

```bash
npx wrangler login
npx wrangler --config server/wrangler.toml d1 create london-dispatch --location apac
```

- 우리 로그인에 계정이 여러 개 보이면 환경변수 `CLOUDFLARE_ACCOUNT_ID`로 지인 계정을 고른다(계정 ID는 비밀값이 아니다).
- 나온 `database_id`로 `server/wrangler.toml` `[[d1_databases]]`의 자리표시(`00000000-…`)를 바꾸고 커밋한다. 이름 `london-dispatch`, 바인딩 `DB`는 그대로 둔다.

---

## 5. 우리: Secrets 3개

상세는 [secret-handover.md](secret-handover.md) §2·§5. 지인이 할 일은 없다.

| 이름 | 값 | 비우면 |
|---|---|---|
| `TOKEN_SECRET` | 우리가 만든 32자 이상 무작위 값(갠홈 PHP 덩어리와 같은 값) | 모든 요청 `500` |
| `LLM_API_KEY` | 지인이 발급해 준 Gemini API 키 | 캐릭터 버튼만 실패 |
| `OWNER_MB_IDS` | 지인(갠홈 주인) 회원 아이디 **1개**(2026-10-07 사용자 결정). 값은 전달받았고 문서에는 쓰지 않는다 | 설정 화면 전원 `403` |

```bash
npx wrangler --config server/wrangler.toml secret put TOKEN_SECRET
npx wrangler --config server/wrangler.toml secret put LLM_API_KEY
npx wrangler --config server/wrangler.toml secret put OWNER_MB_IDS
```

- 값은 명령이 물어볼 때 붙여 넣는다(명령줄에 값을 치지 않는다).
- 비밀 아닌 설정을 Cloudflare 화면에서 "Text"로 넣지 않는다. 다음 배포 때 `wrangler.toml` 값으로 덮인다.

---

## 6. 우리: 비밀 아닌 설정 (`server/wrangler.toml [vars]`)

갠홈 쪽은 고칠 것이 없다(등급만 예외 — 바꾸면 PHP 덩어리도 새로 보낸다).

| 키 | 지금 값 | 메모 |
|---|---|---|
| `TOKEN_MIN_LEVEL` | `5` (유지, 2026-10-07 사용자 결정) | 갠홈 등급 1~10. PHP 덩어리의 `RB_CHATBOT_LEVEL`과 같은 숫자([token-snippet.php.md](token-snippet.php.md) §3) |
| `LLM_MODEL` | `gemini-3.1-pro-preview` (Pro) | **주인이 설정 화면에서 AI 모델을 고르기 전에 쓰는 기본 모델.** 주인이 「공통」 탭에서 Pro / Flash를 고르면 그 선택이 우선하고, 이 값은 고르기 전에만 쓰인다 |
| `LLM_PRICE_INPUT_USD_PER_M` | `0.3` | **예비 단가(입력).** Pro·Flash 단가는 서버 안 단가표에 따로 있어 이 값을 쓰지 않는다. 기본 모델을 단가표에 없는 모델로 바꿨을 때만 쓴다 |
| `LLM_PRICE_OUTPUT_USD_PER_M` | `2.5` | **예비 단가(출력, 사고 토큰 포함).** 위와 같음 |
| `KRW_PER_USD` | `1400` | 원/달러 환율. 자동 갱신 없음 |
| `LLM_MONTHLY_BUDGET_KRW` | `100000` | 월 AI 비용 상한(추정, 원) |
| `ALLOWED_FRAME_ANCESTORS` | `http://london-gossip.my https://london-gossip.my` | 대화창을 넣을 사이트 주소. 다른 주소가 있으면 더한다([embed-guide.md](embed-guide.md) §5.1) |
| 그 밖(`LLM_PROVIDER`·`LLM_TIMEOUT_MS`·`RATE_LIMIT_PER_MIN`·`CONTEXT_MESSAGES`·`MEMORY_SUMMARY_THRESHOLD`) | 기본값 | 바꿀 일이 생기면 사용자에게 묻는다 |

---

## 7. 우리: 데이터베이스 표 만들기 (마이그레이션)

배포 절차(`/deploy`) 안에서 사용자 확인을 받고 운영 D1에 적용한다.

```bash
npx wrangler --config server/wrangler.toml d1 migrations apply london-dispatch --remote
```

| 파일 | 만드는 것 |
|---|---|
| `0001_init.sql` | 대화방·메시지·장기기억·쓰기 횟수 제한 표 |
| `0002_llm_usage.sql` | 월 AI 사용액 누적 표 |
| `0003_character_settings.sql` | 캐릭터 설정 표 |
| `0004_llm_model.sql` | 캐릭터 설정 표에 「AI 모델」 칸 추가(주인이 고른 Pro / Flash) |

- 파일 번호 순서대로 한 번씩만 적용된다. 이미 적용된 파일은 건너뛴다.
- 넷 중 하나라도 빠지면 일부 기능이 `500`으로 실패한다(§10 표).
- **0004는 새 서버 코드를 배포하기 전에 적용한다.** 순서가 바뀌면 설정 화면과 캐릭터 버튼이 `500`이다. `/deploy`가 이 순서를 지킨다.

---

## 8. 우리: 배포·임베드 주소

1. 빌드·검증을 마치고 사용자 확인을 받아 배포한다.
2. 이 계정에서 Workers를 처음 쓰면 `*.workers.dev` **하위 주소 이름**을 한 번 정한다. 대화창 주소에 그대로 드러나니 무난한 이름으로 정하고, 정하기 전에 지인에게 기본 이름을 써도 되는지 묻는다.
3. 배포가 끝나면 주소는 아래 모양이다.

```text
https://london-dispatch.{{계정-하위주소}}.workers.dev/embed
```

4. 지인에게는 이 주소를 넣은 **완성된 한 줄**을 보낸다([embed-guide.md](embed-guide.md) §2). 비밀값이 아니므로 채팅으로 보내도 된다.

- 되돌리기가 필요하면 이전 버전으로 되돌린다(`wrangler rollback`, 사용자 확인 후).

---

## 9. 대안 — API 토큰 (기본 아님)

구성원 초대(§1)가 어려울 때만 쓴다. 지인이 할 일이 늘어난다.

| 비교 | 구성원 초대(기본) | API 토큰(대안) |
|---|---|---|
| 지인이 할 일 | 이메일 넣고 역할 고르기 | 토큰 만들기·권한 고르기·한 번만 보이는 값을 비밀 링크로 보내기 |
| 우리가 보는 것 | Cloudflare 화면과 명령 모두 | 명령만(화면 없음) |
| 권한 범위 | 역할 단위(Administrator) | Workers·D1 편집만으로 좁힐 수 있다 |
| 끊기 | Members에서 삭제 | API Tokens에서 Delete |

**지인이 토큰을 만드는 법** (화면 공유로 같이 하는 것을 권한다)

1. 오른쪽 위 프로필 → My Profile → API Tokens → Create Token.
2. 템플릿 **Edit Cloudflare Workers**를 고르고 권한에 **Account · D1 · Edit**를 한 줄 더한다.
3. Account Resources는 이 계정만, TTL(만료일)은 셋팅 기간 + 1개월쯤.
4. 만든 토큰은 한 번만 보인다. [secret-handover.md](secret-handover.md) §2의 링크 규칙대로 우리에게 보낸다. 계정 ID(비밀값 아님)도 함께 알려 준다.

- 우리는 토큰을 환경변수 `CLOUDFLARE_API_TOKEN`으로만 쓰고 파일·문서에 적지 않는다.

---

## 10. 배포 뒤 확인

| 확인 | 기대 결과 |
|---|---|
| `https://london-dispatch.{{계정-하위주소}}.workers.dev/api/health` | 정상 응답(상태 200) |
| 같은 주소의 `/embed` | 방 목록이 보이는 **읽기 전용** 화면(글쓰기·버튼 없음) |
| 갠홈에서 등급 5(LEVEL) 이상 회원으로 대화창 | 글쓰기 칸·캐릭터 버튼이 보이고 한 줄 써진다 |
| 캐릭터 버튼 | 캐릭터가 한 턴 대답한다 |
| 갠홈 주인 계정으로 ⋯ 메뉴 → 캐릭터 설정 | 열린다(주인만) |

**문제가 보일 때**

| 증상 | 흔한 원인 | 고치는 곳 |
|---|---|---|
| 모든 화면·요청이 `500` | `TOKEN_SECRET`이 없거나 32자 미만, 설정 값 형식 오류 | Secrets·`[vars]` |
| 캐릭터 버튼만 `500` | `0003`·`0004` 마이그레이션 미적용, 또는 `LLM_API_KEY` 없음 | §7 · §5 |
| 캐릭터 버튼이 AI 응답 실패 안내(서버 `502 LLM_FAILED`) | 기본 모델 이름이 틀렸거나(Google `404`) 키 문제·Google 장애 | §6 `LLM_MODEL` · §5 |
| 캐릭터 버튼이 "이번 달 AI 사용 한도" | 월 한도 도달(정상 동작) | 다음 달 자동 해제. 늘리려면 `LLM_MONTHLY_BUDGET_KRW` |
| 설정 화면을 아무도 못 염(전원 `403`) | `OWNER_MB_IDS`가 비었거나 아이디 오타(대소문자) | §5 |
| 갠홈 패널 안이 빈 칸 | 갠홈 주소가 허용 출처에 없음, 또는 PHP 주소가 https가 아님 | `ALLOWED_FRAME_ANCESTORS` · [embed-guide.md](embed-guide.md) §2 |
| 회원인데 글쓰기 칸이 없음 / 쓰자마자 사라짐 | 덩어리 미적용, SECRET 불일치, 등급 미달 | [token-snippet.php.md](token-snippet.php.md) §6 |

- 원인 확인은 서버 로그(`wrangler tail`)로 한다. 로그에는 키 **이름**만 찍히고 값은 찍히지 않는다.
