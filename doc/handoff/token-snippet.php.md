# 토큰 PHP 조각 (갠홈 `rosebell-chatbot.php`에 붙일 코드)

> 실값 없음 · 작성 2026-10-07 · 갱신 2026-10-08(완성 파일 1개 덮어쓰기로 전달 방식 변경 — 조각 코드·토큰 형식 불변) · **개정 2026-10-08 저녁(등급 개편, 🔒 사용자 결정)** · 소유 contract-designer · 요구 R-TOKEN-001 🔒 · R-HANDOFF-002 🔒 · R-AUTH-001 🔒 · R-AUTH-002 🔒
> **2026-10-08 저녁 개정 사유**: 갠홈 등급이 방문자(비로그인)·가입만 한 회원 = 1 이하 / 일반 회원 = 2 / 관리자(갠홈 주인) = 10으로 정해졌다(지인 피드백 → 사용자 결정). ① 글쓰기(토큰 발급) 등급 5 → **10**(서버 `TOKEN_MIN_LEVEL`과 양쪽 10) ② 등급 2 이상 10 미만은 지금처럼 토큰 없이 **읽기 전용** ③ 등급 2 미만·비로그인은 **대화창을 띄우지 않고** 패널에 **가입 안내 문구**를 보인다(새 상수 `RB_CHATBOT_VIEW_LEVEL = 2`). 바뀐 곳: §1 조립 순서(자리표시 글자 3줄 치환 추가) · §2 조각 전문 · §2.1 · §3 · §6 · §7. 토큰 형식·payload·서명·`?t=`·교차 벡터(§4·§5)는 **그대로**다. 지인은 새 완성 파일을 같은 자리에 다시 덮어쓰기만 한다.
> SECRET은 `{{SECRET}}` 자리표시로만 적는다. 실제 값은 우리가 조각을 넣어 만든 **완성 파일(카톡)** 안에만 들어간다([secret-handover.md](secret-handover.md) §2).
> 계약 원본: `doc/200_설계/contract/api.md` §2.3(형식)·§2.5(교차 벡터)·§2.6(조각이 지킬 것). 이 문서와 api.md가 어긋나면 api.md가 맞다.

> **지인용 요약**
> - **지인은 이 문서로 할 일이 없다.** 아래 조각은 우리가 보내는 완성 `rosebell-chatbot.php` 안에 이미 들어 있다. 지인은 그 파일을 같은 자리에 덮어쓰기만 한다([embed-guide.md](embed-guide.md) 맨 위 요약).
> - 아래 본문은 **우리가 완성 파일을 만들 때 따르는 조립 규칙**(§1 위치·§2 전문)과 등급 변경·점검·실수 대처(§3 이후)다.

이 조각은 보는 사람의 갠홈 등급으로 세 갈래를 나눈다.

| 보는 사람 | 조각이 하는 일 | 갠홈 패널에 보이는 것 |
|---|---|---|
| 비로그인 · 등급 `VIEW_LEVEL`(2) 미만 | 대화창 주소를 **비운다**(`$rb_chatbot_embed_url = ''`) + 자리표시 문구를 가입 안내로 바꾼다 | 대화창(iframe) 없음. 「회원 전용 / 가입하고 승인을 받으면 대화를 열람할 수 있습니다. / MEMBERS ONLY」 |
| 등급 2 이상 `LEVEL`(10) 미만 | 주소만 둔다(`?t=` 없음) | 대화창 **읽기 전용**(글쓰기 칸·캐릭터 버튼 없음) |
| 로그인 회원 · 등급 `LEVEL`(10) 이상 | 출입증(토큰)을 만들어 주소 뒤에 `?t=…`로 붙인다 | 대화창 **글쓰기 가능** |

- 말풍선 버튼은 갠홈 `head.php`가 그리므로 세 경우 모두 그대로 보인다. 등급 2 미만은 버튼을 눌러도 패널에 안내만 나온다.
- 열람 등급(`VIEW_LEVEL`)은 **갠홈 PHP만** 안다. 서버는 이 값을 모르고 바뀌지 않는다(api.md §2.6·§7). 임베드 주소를 아는 사람이 브라우저 새 탭으로 직접 열면 지금처럼 읽기 전용으로 열린다 — 이 분기는 갠홈 패널에 무엇을 보이느냐의 문제이지 서버 접근 차단이 아니다.

---

## 1. 붙이는 위치 (완성 파일 조립 규칙 — 우리용)

**조립 순서**

| 순서 | 할 일 |
|---|---|
| 1 | **기준 파일**: 갠홈 테마 패치 원본 `theme/victorian/inc/rosebell-chatbot.php`(33줄, 5번째 줄 주소가 빈 값, 저장소 밖 `../chatbot update/theme/victorian/inc/`). **언제나 이 원본에서 새로 조립한다.** 갠홈에 지금 올라가 있는 파일은 이미 SECRET이 들어 있으므로 지인에게 받아 기준으로 쓰지 않는다. 갠홈 `theme/victorian/head.php`(2026-10-08 지인 제공본 342~343줄)는 이 파일이 있으면 그것만 include하므로, 이 파일 하나로 주소·토큰·자리표시 문구를 모두 정한다(head.php는 고치지 않는다) |
| 2 | 5번째 줄을 [embed-guide.md](embed-guide.md) §2의 운영 주소 줄로 바꾼다 |
| 3 | **자리표시 글자 3줄 치환**(원본 28·29·30번째 줄, 줄 수 그대로): 아래 「자리표시 3줄」 표의 원본 줄을 바꾼 줄로 한 줄씩 바꾼다. 줄 번호가 밀리지 않도록 **4번보다 먼저** 한다 |
| 4 | 아래 그림의 ★ 자리(12번째 줄 `}` 아래, 13번째 줄 `?>` 위)에 §2 전문을 「시작」 줄부터 「끝」 줄까지 통째로 넣는다(55줄). 조립 뒤 파일은 **88줄**이고, 3번에서 바꾼 줄은 83·84·85번째 줄이 된다 |
| 5 | `{{SECRET}}` 자리만 운영 SECRET으로 바꾼다. **SECRET 원본을 가진 사람(사용자)이 메모장으로 직접** 바꾸기를 권한다 — 그러면 Claude 세션에 값이 지나가지 않는다(`LLM_API_KEY` 입력과 같은 방식, [secret-handover.md](secret-handover.md) §5). 값은 Cloudflare `TOKEN_SECRET`에 들어 있는 **지금 값 그대로**다(등급 개편으로 SECRET을 바꾸지 않는다). 원본 메모를 이미 지웠다면 [secret-handover.md](secret-handover.md) §6 교체 절차로 새 값을 만들어 Cloudflare와 이 파일을 함께 바꾼다. `LEVEL` 10 · `VIEW_LEVEL` 2는 그대로 |
| 6 | **UTF-8(BOM 없음)**, 파일 이름 `rosebell-chatbot.php`로 저장한다. 저장은 **저장소 밖 로컬 임시 폴더**에서만 한다(`doc/`·`server/` 등 저장소 안에 두지 않는다) |
| 7 | 보내기 전 점검: ① 파일 안에 `{{`가 남아 있지 않다(SECRET 채움) ② 「시작」·「끝」 줄이 둘 다 있다 ③ 「끝」 줄 바로 다음 줄이 `?>` 한 줄이고, 「시작」 줄 바로 위가 https 검사의 `}` 줄이다 ④ 5번째 줄 주소가 `https://`로 시작한다 ⑤ 83·84·85번째 줄이 `$rb_chatbot_notice_title`·`$rb_chatbot_notice_body`·`$rb_chatbot_notice_small`을 찍는 줄이고, `<strong>대화 준비 중</strong>` 글자는 파일에 **없다**(그 글자는 조각 안 기본값 줄에만 있다) ⑥ 전체 88줄 |
| 8 | 카톡으로 파일을 보낸다([secret-handover.md](secret-handover.md) §2 카톡 전달 규칙). 지인 확인이 끝나면 로컬 사본을 지운다 |

파일: `theme/victorian/inc/rosebell-chatbot.php` (갠홈 테마 패치에 들어 있는 33줄짜리 파일. 아래 줄 번호는 조립 전 원본 기준)

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
 …
24      <div class="rb-chatbot-body" … data-embed-url="<?php echo htmlspecialchars($rb_chatbot_embed_url, …); ?>">
25          <div class="rb-chatbot-placeholder"<?php if ($rb_chatbot_embed_url) { ?> hidden<?php } ?>>
 …
28              <strong>대화 준비 중</strong>          ← 자리표시 3줄 (조립 순서 3번에서 바꾼다)
29              <p>곧 이곳에서 만나겠습니다.</p>
30              <small>COMING SOON</small>
 …
33  </section>
```

**자리표시 3줄** (앞의 공백 12칸은 원본 그대로 둔다)

| 원본 줄 | 원본 | 바꾼 줄 |
|---|---|---|
| 28 | `<strong>대화 준비 중</strong>` | `<strong><?php echo htmlspecialchars($rb_chatbot_notice_title, ENT_QUOTES, 'UTF-8'); ?></strong>` |
| 29 | `<p>곧 이곳에서 만나겠습니다.</p>` | `<p><?php echo htmlspecialchars($rb_chatbot_notice_body, ENT_QUOTES, 'UTF-8'); ?></p>` |
| 30 | `<small>COMING SOON</small>` | `<small><?php echo htmlspecialchars($rb_chatbot_notice_small, ENT_QUOTES, 'UTF-8'); ?></small>` |

- 반드시 **https 검사(8~12줄) 아래**에 붙인다. 위에 붙이면 검사가 토큰 붙은 주소를 다시 보게 되고, 주소가 비었을 때도 토큰을 만들게 된다.
- `?>` 줄 **위**여야 한다. `?>` 아래에 붙이면 코드가 화면에 글자로 찍힌다.
- 14번째 줄 `<section …>` 이하는 **28~30번째 줄의 글자 자리만** 바꾸고 나머지는 고치지 않는다. 24번째 줄이 주소를 `data-embed-url`에 넣고, 테마 JS가 그 값이 있을 때만 iframe을 만든다. 25번째 줄은 주소가 비었을 때만 자리표시를 보인다 — 그래서 조각이 주소를 비우면 iframe 대신 3줄 문구가 나온다.
- 3줄은 조각이 정한 변수를 찍기만 한다. 주소가 https가 아니어서 비었을 때(조립 실수)는 조각의 기본값인 원본 문구 「대화 준비 중」이 그대로 나온다.

---

## 2. 조각 전문 (완성 파일에 넣는 조각의 원본)

완성 파일에 넣는 조각은 아래 전문에서 `{{SECRET}}` 자리만 실제 값으로 채운 것이다(`LEVEL` 10 · `VIEW_LEVEL` 2 그대로). 이 문서의 전문을 그대로 넣으면 SECRET이 비어 있어 등급 10도 읽기 전용이 된다(등급 2 미만 가입 안내는 SECRET과 무관하게 동작한다).

```php
/* ===== 런던_디스패치 토큰 조각 시작 (doc/handoff/token-snippet.php.md) ===== */
/* SECRET·등급은 아래 세 줄에서 고칩니다. SECRET은 따옴표 안에, 등급은 따옴표 없이 숫자로 씁니다. */
if (!defined('RB_CHATBOT_SECRET')) define('RB_CHATBOT_SECRET', '{{SECRET}}');
if (!defined('RB_CHATBOT_LEVEL')) define('RB_CHATBOT_LEVEL', 10);         /* 이 등급 이상: 글쓰기(토큰 발급) */
if (!defined('RB_CHATBOT_VIEW_LEVEL')) define('RB_CHATBOT_VIEW_LEVEL', 2); /* 이 등급 미만·비로그인: 대화창 대신 가입 안내 */

/* 패널 자리표시 문구(아래 section의 strong·p·small에 찍힌다). 기본은 테마 원본 문구다. */
$rb_chatbot_notice_title = '대화 준비 중';
$rb_chatbot_notice_body = '곧 이곳에서 만나겠습니다.';
$rb_chatbot_notice_small = 'COMING SOON';

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

$rb_chatbot_viewer_level = (!empty($is_member) && !empty($member['mb_id'])) ? (int)$member['mb_level'] : 0;

if ($rb_chatbot_viewer_level < (int)RB_CHATBOT_VIEW_LEVEL) {
    /* 비로그인·열람 등급 미만: 대화창을 띄우지 않고 가입 안내만 보인다. 문구는 따옴표 안만 고칩니다. */
    $rb_chatbot_embed_url = '';
    $rb_chatbot_notice_title = '회원 전용';
    $rb_chatbot_notice_body = '가입하고 승인을 받으면 대화를 열람할 수 있습니다.';
    $rb_chatbot_notice_small = 'MEMBERS ONLY';
} elseif ($rb_chatbot_embed_url !== ''
    && !empty($is_member) && !empty($member['mb_id'])
    && $rb_chatbot_viewer_level >= (int)RB_CHATBOT_LEVEL
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
| `RB_CHATBOT_LEVEL` | 이 등급 이상만 토큰 발급(지금 10 = 관리자) | 서버 `TOKEN_MIN_LEVEL`과 같은 숫자(양쪽 10) |
| `RB_CHATBOT_VIEW_LEVEL` | 이 등급 미만·비로그인은 대화창 주소를 비우고 가입 안내를 보인다(지금 2 = 일반 회원부터 열람). `LEVEL` 이하로 둔다 | **서버와 무관**(갠홈 PHP만 쓴다. 서버는 이 값을 모른다) |
| `$rb_chatbot_notice_title` · `_body` · `_small` | 패널 자리표시의 큰 글 · 설명 · 작은 글. 기본은 원본 문구(「대화 준비 중」…), 열람 등급 미만이면 가입 안내(「회원 전용」…)로 바뀐다. §1 「자리표시 3줄」이 이 변수를 `htmlspecialchars`로 찍는다 | 서버와 무관 |
| `$rb_chatbot_viewer_level` | 보는 사람 등급. 비로그인(`$is_member` 비어 있음)이면 `0`, 로그인이면 `(int)$member['mb_level']` | 서버와 무관(분기용) |
| `if (… < VIEW_LEVEL)` → `$rb_chatbot_embed_url = ''` | 주소를 비운다. 그러면 테마 JS가 iframe을 만들지 않고, 자리표시 칸이 보인다 | 서버로 요청이 가지 않는다 |
| `elseif (…)` 토큰 블록 | 그 밖(등급 2 이상)에서, 주소가 있고 로그인 회원이고 등급이 `LEVEL` 이상이고 SECRET이 32자 이상일 때만 토큰을 만든다. 조건은 개정 전과 같다 | §2.3 형식 그대로 |
| `rb_chatbot_b64u` | base64url(패딩 `=` 없음, `+`→`-`, `/`→`_`) | 형식 `seg1.seg2` |
| `json_encode(… JSON_UNESCAPED_UNICODE \| JSON_UNESCAPED_SLASHES)` | 회원 정보를 JSON 글자로. 한글을 그대로 둔다 | 키 순서 `mb_id, nick, ch_name, level, exp` 고정 |
| `hash_hmac('sha256', $json, SECRET, true)` | **JSON 글자 자체**에 도장을 찍는다(32바이트) | 서명 입력 = JSON 바이트 |
| `strlen(SECRET) >= 32` | SECRET 자리를 안 채웠거나 짧으면 토큰을 만들지 않는다(읽기 전용으로 열림) | 서버도 32자 미만 SECRET을 거부한다 |
| `get_character($member['ch_id'])` | 회원 대표 캐릭터 이름. 상단 프로필(head.php 32~33줄)과 같은 방식. 없으면 `''` | `ch_name` 키는 늘 넣는다 |
| `(int)$member['mb_level']` | 그누보드는 등급을 글자 `"10"`처럼 준다. 숫자로 바꾼다 | `level`은 정수여야 통과 |
| `time() + 43200` | 지금부터 12시간 뒤(초) | `exp` = epoch 초 정수 |
| `'?t=' . $token` | 주소 뒤에 붙인다 | 파라미터 이름 `t` |

- 회원 정보(아이디·닉네임·캐릭터명·등급)는 서명돼 있어 바꿀 수 없을 뿐 **암호화되지 않는다.** 비밀값은 payload에 넣지 않는다.

---

## 3. LEVEL · VIEW_LEVEL 바꾸는 법

등급 숫자는 두 개다. 바꾸는 곳이 다르다.

| 상수 | 뜻 | 지금 값 | 바꿀 때 고치는 곳 |
|---|---|---|---|
| `RB_CHATBOT_LEVEL` | 글쓰기(토큰 발급) 최소 등급 | **10** | 갠홈 PHP **와** 서버 `TOKEN_MIN_LEVEL` — 양쪽 같은 숫자 |
| `RB_CHATBOT_VIEW_LEVEL` | 대화창 열람 최소 등급(미만은 가입 안내) | **2** | 갠홈 PHP **만**(서버 배포 없음) |

**LEVEL을 바꿀 때**

1. 지인은 **원하는 등급 숫자만 우리에게 알려 준다.**
2. 우리가 서버 설정 `TOKEN_MIN_LEVEL`(`server/wrangler.toml [vars]`)을 같은 값으로 바꿔 배포한다.
3. 우리가 조각의 아래 줄 숫자(따옴표 없이)를 바꿔 **새 완성 파일**을 만들어(§1 조립 순서) 카톡으로 보낸다. 지인은 같은 자리에 덮어쓰기만 한다.

```php
if (!defined('RB_CHATBOT_LEVEL')) define('RB_CHATBOT_LEVEL', 10);         /* 이 등급 이상: 글쓰기(토큰 발급) */
```

| 두 값이 다를 때 | 결과 |
|---|---|
| PHP LEVEL < 서버 값 | 그 사이 등급 회원은 글쓰기 칸이 보였다가, 처음 쓰는 순간 거절(`403 LEVEL_TOO_LOW`)되고 읽기 전용으로 바뀐다 |
| PHP LEVEL > 서버 값 | 그 사이 등급 회원은 처음부터 읽기 전용이다 |

- 2·3번 순서는 어느 쪽이 먼저여도 위 표처럼 읽기 전용으로 닫힐 뿐 글이 잘못 써지지는 않는다. 서버 값을 바꾸기 전에 받은 출입증(최대 12시간)도 서버가 매 요청 등급을 다시 보므로 새 값으로 막힌다.

**VIEW_LEVEL을 바꿀 때**

1. 지인이 원하는 숫자를 알려 주면, 우리가 아래 줄 숫자만 바꿔 새 완성 파일을 보낸다(§1). 서버는 고치지 않는다.
2. `VIEW_LEVEL`은 `LEVEL` **이하**로 둔다. `LEVEL`보다 크면 그 사이 등급(글쓰기 등급인데 열람 등급 미만)은 글쓰기 대신 가입 안내만 본다.
3. 비로그인에게도 읽기 전용 대화창을 다시 보이려면 `0`으로 둔다(개정 전 동작).

```php
if (!defined('RB_CHATBOT_VIEW_LEVEL')) define('RB_CHATBOT_VIEW_LEVEL', 2); /* 이 등급 미만·비로그인: 대화창 대신 가입 안내 */
```

- 가입 안내 **문구**만 바꿀 때도 같다: 조각의 `if (… < (int)RB_CHATBOT_VIEW_LEVEL) {` 블록 안 세 줄(`'회원 전용'`·`'가입하고 …'`·`'MEMBERS ONLY'`)의 따옴표 안만 바꿔 새 완성 파일을 보낸다. 작은따옴표(`'`)는 문구에 넣지 않는다(넣으면 PHP 오류).
- 값은 **LEVEL 양쪽 10 · VIEW_LEVEL 2**로 둔다(2026-10-08 저녁 사용자 결정. 갠홈 등급: 방문자·가입만 1 이하 / 일반 회원 2 / 관리자 10).
- §4 교차 벡터의 「서버 판정」 열은 **테스트 기준(최소 등급 5, auth.md §2.6)** 이다. 운영 값과 무관하게 그대로 둔다.

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
| 셋 다 OK | 갠홈 PHP가 서버와 같은 토큰을 만든다 | 점검 파일을 지운다(완성 파일은 그대로 둔다) |
| V4만 OK, V1·V7 NG | 파일이 UTF-8이 아니다(한글 바이트가 다름) | 편집기에서 "UTF-8(BOM 없음)"으로 다시 저장 |
| 셋 다 NG | 복사 중 글자가 빠졌거나 PHP가 아주 오래됨(5.4 미만) | 다시 복사. 그래도 NG면 화면을 찍어 우리에게 보낸다 |

---

## 6. 흔한 실수

완성 파일을 만들 때(우리)와 올릴 때(지인) 나는 실수다. 바로잡은 뒤에는 새 완성 파일을 다시 보내고 지인은 같은 자리에 덮어쓴다.

| 실수 | 증상 | 바로잡기 |
|---|---|---|
| SECRET 자리를 안 채움(`'{{SECRET}}'`이 남음) / SECRET 32자 미만 | 등급 10도 읽기 전용(토큰을 안 만듦). 등급 2 미만 가입 안내는 정상 | §1 조립 순서 5·7번 다시. SECRET을 채운 완성 파일을 다시 보낸다([secret-handover.md](secret-handover.md) §2) |
| 조각 일부만 넣음(「시작」·「끝」 줄 중 하나가 빠짐) | PHP 오류로 페이지가 깨지거나 코드가 화면에 찍힘 | 「시작」 줄부터 「끝」 줄까지 통째로 다시 넣기 |
| 자리표시 3줄을 안 바꿈(§1 조립 순서 3번 빠짐) | 비로그인·등급 1에게 대화창은 안 뜨지만 안내 대신 「대화 준비 중 / COMING SOON」이 보인다 | §1 「자리표시 3줄」 표대로 28~30번째 줄을 바꾼 새 완성 파일 |
| 자리표시 3줄만 바꾸고 조각을 안 넣음 | 패널 안내 칸 글자가 비거나 PHP 경고가 찍힌다 | 조각을 「시작」~「끝」 통째로 넣기(§1 조립 순서 4번) |
| 가입 안내 문구에 작은따옴표(`'`)를 넣음 | PHP 오류로 페이지가 깨진다 | 문구에서 `'`를 빼거나 다른 문장부호로 |
| `VIEW_LEVEL`을 `LEVEL`보다 크게 둠 | 그 사이 등급은 글쓰기 대신 가입 안내만 본다 | `VIEW_LEVEL` ≤ `LEVEL`(§3) |
| 지인 쪽에서 다른 폴더에 올림 / 파일 이름이 `rosebell-chatbot (1).php`처럼 바뀜 | 옛 파일이 계속 쓰인다 — 비로그인·등급 1에게도 가입 안내 대신 읽기 전용 대화창이 열린다(옛 파일이 원본이면 「대화 준비 중」) | `theme/victorian/inc/`에 이름 `rosebell-chatbot.php`로 다시 덮어쓰기 |
| UTF-8 **BOM 있음**으로 저장 | 패널 근처에 보이지 않는 글자가 끼어 모양이 어긋날 수 있다 | UTF-8(BOM 없음)으로 다시 저장 |
| SECRET 따옴표를 지움, 앞뒤 공백·줄바꿈이 들어감 | PHP 오류로 페이지가 깨지거나, 글쓰기 칸이 보였다가 첫 글에서 읽기 전용으로 바뀜(`401 TOKEN_INVALID`) | `'값'` 형태, 따옴표 안에는 SECRET 글자만 |
| 서버 `TOKEN_SECRET`과 한 글자라도 다름 | 위와 같음(`TOKEN_INVALID`) | 양쪽을 같은 원본에서 복사 |
| `(int)` 캐스트를 지움 | 등급이 글자 `"10"`으로 들어가 모든 토큰 거부 | §2 원문 그대로 |
| `LEVEL`·`VIEW_LEVEL`에 따옴표(`'10'`·`'2'`) | 비교는 되지만 실수 유발 | 숫자만 |
| 조각을 https 검사 위나 `?>` 아래에 붙임 | 주소가 지워지거나 코드가 화면에 찍힘 | §1 위치 |
| 주소가 `http://`이거나 끝에 `?`가 있음 | 등급 2 이상에게 「대화 준비 중」 또는 깨진 주소 | `https://…/embed`만 |
| 파일을 ANSI/EUC-KR로 저장 | 한글 캐릭터명 회원만 실패할 수 있음 | UTF-8(BOM 없음) |
| 호스팅 서버 시계가 많이 틀림 | 토큰이 일찍 만료되거나 늦게 만료 | 호스팅 시간이 맞는지 확인(서버는 여유 시간 없이 `exp`를 본다) |
| `?t=` 이름을 바꿈(`?token=` 등) | 모두 읽기 전용 | 이름은 `t` 고정(바꾸면 양쪽 동시 변경 필요) |

---

## 7. 확인 방법

1. **자가 점검(선택, 우리용)**: §5 셋 다 OK.
2. **실제 화면 — 세 계정으로** (지인이 완성 파일을 덮어쓰고 `Ctrl+F5` 한 뒤, [embed-guide.md](embed-guide.md) §6과 같은 표):

| 계정 | 말풍선 버튼을 눌렀을 때 | 페이지 소스 `data-embed-url` |
|---|---|---|
| 비로그인 · 등급 1(가입만) | 대화창(iframe) **없음**. 패널에 「회원 전용 / 가입하고 승인을 받으면 대화를 열람할 수 있습니다. / MEMBERS ONLY」 | `""`(빈 값) |
| 등급 2(일반 회원) | 방 목록이 뜨고 **읽기 전용**(글쓰기 칸·캐릭터 버튼 없음) | 주소만(`…/embed`, `?t=` 없음) |
| 등급 10(관리자·갠홈 주인) | 글쓰기 칸·캐릭터 버튼이 보이고 한 줄 써진다. ⋯ 메뉴에 캐릭터 설정(주인만) | `…/embed?t=…` |

3. **우리 쪽 대조 (개발자용 도구 `server/scripts/token-test.ts`)**: 프로젝트 루트에서 실행한다. 세 가지 명령이 있다.

```bash
# 표 확인: §4 교차 벡터(V1~V8 + V5b)를 출력한다. 테스트 SECRET으로만 돌린다
npm run token:test -w server -- vectors --secret london-dispatch-test-secret-v1

# 토큰 검사: 저쪽 PHP가 만든 토큰이 서버 규칙(서명 → 만료 → 등급)을 통과하는지 본다
npm run token:test -w server -- verify --secret {{SECRET}} --token {{토큰}} --min-level 10

# 토큰 만들기: 개발·시험용 토큰을 만든다(exp = 지금 + hours)
npm run token:test -w server -- sign --secret {{SECRET}} --mb-id {{아이디}} --nick {{닉네임}} --ch-name {{캐릭터명}} --level 10 --hours 12
```

- `--secret`은 매번 명령에 직접 준다(환경변수로 대신 받지 않는다). 도구는 SECRET을 화면에 찍지 않고, 32자 미만이면 경고만 한다.
- **대조 흐름**: 갠홈 PHP가 만든 토큰을 받아(등급 10 회원으로 로그인한 페이지 소스의 `data-embed-url` 안 `t=` 뒤 값) 우리가 `verify`로 같은 SECRET에서 통과하는지 대조한다. 2026-10-08 저녁부터 토큰은 **관리자(등급 10)만** 받는다. 사용자 본인 계정은 일반 회원(등급 2)이라 토큰이 나오지 않으므로, 지인과 화면 공유로 꺼내는 것이 기본이다.
- 운영 SECRET으로 `verify`·`sign`을 돌리면 그 값이 셸 명령 기록에 남는다. 대조가 끝나면 기록을 지운다. 기본 방식에서는 우리가 SECRET을 만들므로 `verify`를 쓸 수 있다. 지인이 직접 만든 경우([secret-handover.md](secret-handover.md) §7 대안)에는 우리가 값을 모르므로 2번 실제 화면 확인으로 대신한다.

- 실제 회원 토큰은 채팅·메일 본문에 붙이지 않는다. 지인에게 받아야 하면 화면 공유로 보거나 파일로 받아 대조가 끝나면 양쪽에서 지운다. 12시간 동안 그 회원 이름으로 글을 쓸 수 있는 출입증이고, 등급 10 토큰이면 갠홈 주인 아이디로 캐릭터 설정까지 바꿀 수 있다.
