# 토큰 PHP 조각 (갠홈 `rosebell-chatbot.php`에 붙일 코드)

> 실값 없음 · 작성 2026-10-07 · 소유 contract-designer · 요구 R-TOKEN-001 🔒 · R-HANDOFF-002 🔒 · R-AUTH-001 🔒 · R-AUTH-002 🔒
> SECRET은 `{{SECRET}}` 자리표시로만 적는다. 실제 값은 우리가 채운 덩어리로 비밀 링크를 통해 보낸다([secret-handover.md](secret-handover.md) §2).
> 계약 원본: `doc/200_설계/contract/api.md` §2.3(형식)·§2.5(교차 벡터)·§2.6(조각이 지킬 것). 이 문서와 api.md가 어긋나면 api.md가 맞다.

> **지인용 요약 (이것만 하면 된다)**
> 1. 우리가 보낸 비밀 링크를 열어 「런던_디스패치 토큰 조각 시작」 줄부터 「런던_디스패치 토큰 조각 끝」 줄까지 **한 덩어리를 통째로** 복사한다.
> 2. `theme/victorian/inc/rosebell-chatbot.php`의 **12번째 줄(`}` 한 글자만 있는 줄) 바로 아래, 13번째 줄 `?>` 바로 위**에 붙여 넣는다.
> 3. **UTF-8**로 저장해 같은 자리에 올리고 `Ctrl+F5`. 아래 본문은 우리(개발자)용 설명이라 읽지 않아도 된다.

이 조각은 **로그인 회원이고 갠홈 등급이 LEVEL 이상일 때만** 출입증(토큰)을 만들어 대화창 주소 뒤에 `?t=…`로 붙인다. 비회원·등급 미달이면 아무것도 붙이지 않는다. 그러면 대화창은 읽기 전용으로 열린다.

---

## 1. 붙이는 위치

파일: `theme/victorian/inc/rosebell-chatbot.php` (갠홈 테마 패치에 들어 있는 33줄짜리 파일)

```text
 1  <?php
 2  if (!defined('_GNUBOARD_')) exit;
 …
 5  $rb_chatbot_embed_url = '…주소…';          ← 임베드 주소 (embed-guide.md §2)
 …
 8  $rb_chatbot_url_parts = parse_url($rb_chatbot_embed_url);
 9  if (!$rb_chatbot_url_parts || … !== 'https') {
11      $rb_chatbot_embed_url = '';
12  }
        ★ 여기에 §2 조각 전체를 붙인다 (12번째 줄 `}` 바로 아래, 13번째 줄 `?>` 바로 위)
13  ?>
14  <section id="rb-chatbot-panel" …
```

- 반드시 **https 검사(8~12줄) 아래**에 붙인다. 위에 붙이면 검사가 토큰 붙은 주소를 다시 보게 되고, 주소가 비었을 때도 토큰을 만들게 된다.
- `?>` 줄 **위**여야 한다. `?>` 아래에 붙이면 코드가 화면에 글자로 찍힌다.
- 나머지 줄(14번째 줄 `<section …>` 이하)은 고치지 않는다. 24번째 줄이 주소를 `data-embed-url`에 넣고, 테마 JS가 그 값으로 iframe을 만든다.

---

## 2. 조각 전문 (우리가 보내는 덩어리의 원본)

지인에게 보내는 덩어리는 아래 전문에서 `{{SECRET}}` 자리만 실제 값으로 채운 것이다(LEVEL 5 그대로). 이 문서의 전문을 그대로 붙이면 SECRET이 비어 있어 모두 읽기 전용이 된다.

```php
/* ===== 런던_디스패치 토큰 조각 시작 (doc/handoff/token-snippet.php.md) ===== */
/* 아래 두 줄만 고칩니다. SECRET은 따옴표 안에, LEVEL은 따옴표 없이 숫자로 씁니다. */
if (!defined('RB_CHATBOT_SECRET')) define('RB_CHATBOT_SECRET', '{{SECRET}}');
if (!defined('RB_CHATBOT_LEVEL')) define('RB_CHATBOT_LEVEL', 5);

if (!function_exists('rb_chatbot_b64u')) {
    function rb_chatbot_b64u($bytes) {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }
}
if (!function_exists('rb_chatbot_make_token')) {
    function rb_chatbot_make_token($payload, $secret) {
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) return '';
        return rb_chatbot_b64u($json) . '.' . rb_chatbot_b64u(hash_hmac('sha256', $json, $secret, true));
    }
}

if ($rb_chatbot_embed_url !== ''
    && !empty($is_member) && !empty($member['mb_id'])
    && (int)$member['mb_level'] >= (int)RB_CHATBOT_LEVEL
    && strlen(RB_CHATBOT_SECRET) >= 32) {
    $rb_chatbot_ch_name = '';
    if (!empty($member['ch_id']) && function_exists('get_character')) {
        $rb_chatbot_ch = get_character($member['ch_id']);
        if (is_array($rb_chatbot_ch) && isset($rb_chatbot_ch['ch_name'])) {
            $rb_chatbot_ch_name = (string)$rb_chatbot_ch['ch_name'];
        }
    }
    $rb_chatbot_token = rb_chatbot_make_token(array(
        'mb_id'   => (string)$member['mb_id'],
        'nick'    => (string)$member['mb_nick'],
        'ch_name' => $rb_chatbot_ch_name,
        'level'   => (int)$member['mb_level'],
        'exp'     => time() + 43200,
    ), RB_CHATBOT_SECRET);
    if ($rb_chatbot_token !== '') {
        $rb_chatbot_embed_url = $rb_chatbot_embed_url . '?t=' . $rb_chatbot_token;
    }
}
/* ===== 런던_디스패치 토큰 조각 끝 ===== */
```

### 2.1 줄마다 하는 일

| 부분 | 하는 일 | 서버와의 약속(api.md §2.3) |
|---|---|---|
| `RB_CHATBOT_SECRET` | 도장 비밀번호. 서버 Secrets `TOKEN_SECRET`과 **글자 하나까지 같아야** 한다 | HMAC-SHA256 키 |
| `RB_CHATBOT_LEVEL` | 이 등급 이상만 토큰 발급 | 서버 `TOKEN_MIN_LEVEL`과 같은 숫자 |
| `rb_chatbot_b64u` | base64url(패딩 `=` 없음, `+`→`-`, `/`→`_`) | 형식 `seg1.seg2` |
| `json_encode(… JSON_UNESCAPED_UNICODE \| JSON_UNESCAPED_SLASHES)` | 회원 정보를 JSON 글자로. 한글을 그대로 둔다 | 키 순서 `mb_id, nick, ch_name, level, exp` 고정 |
| `hash_hmac('sha256', $json, SECRET, true)` | **JSON 글자 자체**에 도장을 찍는다(32바이트) | 서명 입력 = JSON 바이트 |
| `strlen(SECRET) >= 32` | SECRET 자리를 안 채웠거나 짧으면 토큰을 만들지 않는다(읽기 전용으로 열림) | 서버도 32자 미만 SECRET을 거부한다 |
| `get_character($member['ch_id'])` | 회원 대표 캐릭터 이름. 상단 프로필(head.php 32~33줄)과 같은 방식. 없으면 `''` | `ch_name` 키는 늘 넣는다 |
| `(int)$member['mb_level']` | 그누보드는 등급을 글자 `"5"`로 준다. 숫자로 바꾼다 | `level`은 정수여야 통과 |
| `time() + 43200` | 지금부터 12시간 뒤(초) | `exp` = epoch 초 정수 |
| `'?t=' . $token` | 주소 뒤에 붙인다 | 파라미터 이름 `t` |

- 회원 정보(아이디·닉네임·캐릭터명·등급)는 서명돼 있어 바꿀 수 없을 뿐 **암호화되지 않는다.** 비밀값은 payload에 넣지 않는다.

---

## 3. LEVEL 바꾸는 법

1. 지인은 **원하는 등급 숫자만 우리에게 알려 준다.**
2. 우리가 서버 설정 `TOKEN_MIN_LEVEL`(`server/wrangler.toml [vars]`)을 같은 값으로 바꿔 배포한다.
3. 우리가 덩어리의 아래 줄 숫자(따옴표 없이)를 바꾼 **새 덩어리**를 비밀 링크로 보낸다. 지인은 「시작」 줄부터 「끝」 줄까지 지우고 새 덩어리를 붙여 넣는다.

```php
if (!defined('RB_CHATBOT_LEVEL')) define('RB_CHATBOT_LEVEL', 5);
```

| 두 값이 다를 때 | 결과 |
|---|---|
| PHP LEVEL < 서버 값 | 그 사이 등급 회원은 글쓰기 칸이 보였다가, 처음 쓰는 순간 거절(`403 LEVEL_TOO_LOW`)되고 읽기 전용으로 바뀐다 |
| PHP LEVEL > 서버 값 | 그 사이 등급 회원은 처음부터 읽기 전용이다 |

- 값은 양쪽 모두 **5**로 유지한다(2026-10-07 사용자 결정, 갠홈 등급 1~10). 바꿀 일이 생길 때만 위 1~3을 한다.

---

## 4. 교차 테스트 벡터 (같은 입력이면 같은 토큰이 나와야 한다)

아래는 **테스트 전용** 값이다. 운영 SECRET이 아니다. 서버 테스트(api.md §2.5 · server auth.md §2.6)가 쓰는 것과 같은 입력·같은 기대 토큰이다.

- 테스트 SECRET: `london-dispatch-test-secret-v1` (30자 — 서버는 32자 미만을 운영 값으로 받지 않으므로 **절대 실제 SECRET으로 쓰지 않는다**)
- 공통: `exp = 1767268800`(2026-01-01 00:00 UTC + 12시간), `level`·`exp`는 정수, 키 순서 `mb_id, nick, ch_name, level, exp`

| ID | 입력 payload JSON | 기대 토큰 | 서버 판정(최소 등급 5) |
|---|---|---|---|
| V1 (필수) | `{"mb_id":"tester01","nick":"테스터","ch_name":"시엘 팬텀하이브","level":5,"exp":1767268800}` (101바이트) | 아래 V1 | 통과. 표시 이름 「시엘 팬텀하이브」 |
| V4 (영문만) | `{"mb_id":"ascii_only","nick":"Tester","ch_name":"Ciel","level":5,"exp":1767268800}` (82바이트) | 아래 V4 | 통과 |
| V7 (참고) | V1과 같은 값을 **플래그 없는** `json_encode`로 만든 것(한글이 `테…`로 바뀜, 131바이트) | 아래 V7 | 통과(서버는 V1·V7 둘 다 받는다) |
| V3 (등급 미달) | `{"mb_id":"tester03","nick":"하급","ch_name":"","level":4,"exp":1767268800}` (76바이트) | 아래 V3 | `403 LEVEL_TOO_LOW`. 실제 조각은 LEVEL 5면 이 회원에게 토큰을 만들지 않는다 |

```text
V1  eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Iu2FjOyKpO2EsCIsImNoX25hbWUiOiLsi5zsl5gg7Yys7YWA7ZWY7J2067iMIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.EWYxcZixnZzWnIjEmFZFc1-_DrqQ8gfOQEOFm3xzMu4
V4  eyJtYl9pZCI6ImFzY2lpX29ubHkiLCJuaWNrIjoiVGVzdGVyIiwiY2hfbmFtZSI6IkNpZWwiLCJsZXZlbCI6NSwiZXhwIjoxNzY3MjY4ODAwfQ.bZ5o0FN-_veyz6bFb6gbVejYdIpqhkehp2XuzudLahI
V7  eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Ilx1ZDE0Y1x1YzJhNFx1ZDEzMCIsImNoX25hbWUiOiJcdWMyZGNcdWM1ZDggXHVkMzJjXHVkMTQwXHVkNTU4XHVjNzc0XHViZTBjIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.Ppc6_c3yRi28H05QHEZ_gvQMF-neidGMOwQ3a6ukWKs
V3  eyJtYl9pZCI6InRlc3RlcjAzIiwibmljayI6Iu2VmOq4iSIsImNoX25hbWUiOiIiLCJsZXZlbCI6NCwiZXhwIjoxNzY3MjY4ODAwfQ.X3DOlOqHWy4fJbzpuYxO1TKYegyRQj2Q9udNSsagvXI
```

- V1·V4·V7은 2026-10-07에 §2 조각과 같은 계산(JSON 바이트 → HMAC-SHA256 → base64url)을 Node로 다시 돌려 위 문자열과 한 글자도 다르지 않음을 확인했다. PHP 실행 확인은 §5 자가 점검으로 저쪽 서버에서 한다.

---

## 5. 자가 점검 (우리용·선택 — 지인은 하지 않아도 된다)

갠홈 서버의 PHP가 우리와 같은 토큰을 만드는지 본다. 실제 화면 확인(§7 2번)에서 원인을 못 가릴 때만, 지인과 화면 공유로 같이 한다. **테스트 값만** 쓰고, 확인이 끝나면 파일을 지운다.

1. 아래 내용을 `rb-chatbot-selftest.php`라는 새 파일로 **UTF-8**(BOM 없음)로 저장한다.
2. 갠홈 웹 루트(`theme` 폴더가 있는 곳)에 올린다.
3. 브라우저로 `{{갠홈주소}}/rb-chatbot-selftest.php`를 연다.
4. 세 줄이 모두 `OK`면 통과다. 바로 파일을 **지운다.**

```php
<?php
/* 런던_디스패치 토큰 자가 점검. 테스트 값만 들어 있다. 실제 SECRET을 넣지 않는다. 확인 후 지운다. */
function rb_chatbot_b64u($bytes) {
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}
function rb_chatbot_make_token($payload, $secret) {
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) return '';
    return rb_chatbot_b64u($json) . '.' . rb_chatbot_b64u(hash_hmac('sha256', $json, $secret, true));
}
$secret = 'london-dispatch-test-secret-v1';
$v1 = rb_chatbot_make_token(array('mb_id' => 'tester01', 'nick' => '테스터', 'ch_name' => '시엘 팬텀하이브', 'level' => (int)'5', 'exp' => (int)'1767268800'), $secret);
$v4 = rb_chatbot_make_token(array('mb_id' => 'ascii_only', 'nick' => 'Tester', 'ch_name' => 'Ciel', 'level' => 5, 'exp' => 1767268800), $secret);
$v7json = json_encode(array('mb_id' => 'tester01', 'nick' => '테스터', 'ch_name' => '시엘 팬텀하이브', 'level' => 5, 'exp' => 1767268800));
$v7 = rb_chatbot_b64u($v7json) . '.' . rb_chatbot_b64u(hash_hmac('sha256', $v7json, $secret, true));
$want = array(
    'V1' => 'eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Iu2FjOyKpO2EsCIsImNoX25hbWUiOiLsi5zsl5gg7Yys7YWA7ZWY7J2067iMIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.EWYxcZixnZzWnIjEmFZFc1-_DrqQ8gfOQEOFm3xzMu4',
    'V4' => 'eyJtYl9pZCI6ImFzY2lpX29ubHkiLCJuaWNrIjoiVGVzdGVyIiwiY2hfbmFtZSI6IkNpZWwiLCJsZXZlbCI6NSwiZXhwIjoxNzY3MjY4ODAwfQ.bZ5o0FN-_veyz6bFb6gbVejYdIpqhkehp2XuzudLahI',
    'V7' => 'eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Ilx1ZDE0Y1x1YzJhNFx1ZDEzMCIsImNoX25hbWUiOiJcdWMyZGNcdWM1ZDggXHVkMzJjXHVkMTQwXHVkNTU4XHVjNzc0XHViZTBjIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.Ppc6_c3yRi28H05QHEZ_gvQMF-neidGMOwQ3a6ukWKs',
);
$got = array('V1' => $v1, 'V4' => $v4, 'V7' => $v7);
header('Content-Type: text/plain; charset=utf-8');
foreach ($want as $id => $w) {
    echo $id . ' ' . ($got[$id] === $w ? 'OK' : 'NG') . "\n";
}
```

| 결과 | 뜻 | 할 일 |
|---|---|---|
| 셋 다 OK | 갠홈 PHP가 서버와 같은 토큰을 만든다 | 파일 지우고 §2 조각을 붙인다 |
| V4만 OK, V1·V7 NG | 파일이 UTF-8이 아니다(한글 바이트가 다름) | 편집기에서 "UTF-8(BOM 없음)"으로 다시 저장 |
| 셋 다 NG | 복사 중 글자가 빠졌거나 PHP가 아주 오래됨(5.4 미만) | 다시 복사. 그래도 NG면 화면을 찍어 우리에게 보낸다 |

---

## 6. 흔한 실수

| 실수 | 증상 | 바로잡기 |
|---|---|---|
| 우리가 보낸 덩어리 대신 이 문서의 전문(`'{{SECRET}}'`)을 붙임 / SECRET 32자 미만 | 모두 읽기 전용(토큰을 안 만듦) | 비밀 링크의 덩어리로 바꿔 붙이기([secret-handover.md](secret-handover.md) §2) |
| 덩어리 일부만 복사함(「시작」·「끝」 줄 중 하나가 빠짐) | PHP 오류로 페이지가 깨지거나 코드가 화면에 찍힘 | 「시작」 줄부터 「끝」 줄까지 통째로 다시 붙이기 |
| SECRET 따옴표를 지움, 앞뒤 공백·줄바꿈이 들어감 | PHP 오류로 페이지가 깨지거나, 글쓰기 칸이 보였다가 첫 글에서 읽기 전용으로 바뀜(`401 TOKEN_INVALID`) | `'값'` 형태, 따옴표 안에는 SECRET 글자만 |
| 서버 `TOKEN_SECRET`과 한 글자라도 다름 | 위와 같음(`TOKEN_INVALID`) | 양쪽을 같은 원본에서 복사 |
| `(int)` 캐스트를 지움 | 등급이 글자 `"5"`로 들어가 모든 토큰 거부 | §2 원문 그대로 |
| `LEVEL`에 따옴표(`'5'`) | 비교는 되지만 실수 유발 | 숫자만 |
| 조각을 https 검사 위나 `?>` 아래에 붙임 | 주소가 지워지거나 코드가 화면에 찍힘 | §1 위치 |
| 주소가 `http://`이거나 끝에 `?`가 있음 | 「대화 준비 중」 또는 깨진 주소 | `https://…/embed`만 |
| 파일을 ANSI/EUC-KR로 저장 | 한글 캐릭터명 회원만 실패할 수 있음 | UTF-8(BOM 없음) |
| 호스팅 서버 시계가 많이 틀림 | 토큰이 일찍 만료되거나 늦게 만료 | 호스팅 시간이 맞는지 확인(서버는 여유 시간 없이 `exp`를 본다) |
| `?t=` 이름을 바꿈(`?token=` 등) | 모두 읽기 전용 | 이름은 `t` 고정(바꾸면 양쪽 동시 변경 필요) |

---

## 7. 확인 방법

1. **자가 점검(선택, 우리용)**: §5 셋 다 OK.
2. **실제 화면**: 조각을 붙이고 등급 LEVEL 이상 회원으로 대화창을 연다 → 글쓰기 칸·캐릭터 버튼이 보이고 한 줄 써진다([embed-guide.md](embed-guide.md) §6).
3. **등급 미달·비회원**: 읽기 전용.
4. **우리 쪽 대조 (개발자용 도구 `server/scripts/token-test.ts`)**: 프로젝트 루트에서 실행한다. 세 가지 명령이 있다.

```bash
# 표 확인: §4 교차 벡터(V1~V8 + V5b)를 출력한다. 테스트 SECRET으로만 돌린다
npm run token:test -w server -- vectors --secret london-dispatch-test-secret-v1

# 토큰 검사: 저쪽 PHP가 만든 토큰이 서버 규칙(서명 → 만료 → 등급)을 통과하는지 본다
npm run token:test -w server -- verify --secret {{SECRET}} --token {{토큰}} --min-level 5

# 토큰 만들기: 개발·시험용 토큰을 만든다(exp = 지금 + hours)
npm run token:test -w server -- sign --secret {{SECRET}} --mb-id {{아이디}} --nick {{닉네임}} --ch-name {{캐릭터명}} --level 5 --hours 12
```

- `--secret`은 매번 명령에 직접 준다(환경변수로 대신 받지 않는다). 도구는 SECRET을 화면에 찍지 않고, 32자 미만이면 경고만 한다.
- **대조 흐름**: 갠홈 PHP가 만든 토큰을 받아(등급 5 이상 회원으로 로그인한 페이지 소스의 `data-embed-url` 안 `t=` 뒤 값 — 우리 회원 계정으로 직접 꺼내거나 지인과 화면 공유로 꺼낸다) 우리가 `verify`로 같은 SECRET에서 통과하는지 대조한다.
- 운영 SECRET으로 `verify`·`sign`을 돌리면 그 값이 셸 명령 기록에 남는다. 대조가 끝나면 기록을 지운다. 기본 방식에서는 우리가 SECRET을 만들므로 `verify`를 쓸 수 있다. 지인이 직접 만든 경우([secret-handover.md](secret-handover.md) §7 대안)에는 우리가 값을 모르므로 2번 실제 화면 확인으로 대신한다.

- 실제 회원 토큰은 채팅·메일 본문에 붙이지 않는다. 대조용으로 보낼 때도 한 번 열면 사라지는 링크로 보내고, 대조가 끝나면 지운다. 12시간 동안 그 회원 이름으로 글을 쓸 수 있는 출입증이다.
