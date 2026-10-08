# 세 화면 공통 스타일 정본 — 갠홈 "estate" 톤 (분할 문서, v2.2)

> 주 문서: `ui/src/chat/design.md`(§11.1이 이 문서를 가리킨다). rooms `design/components.md` §3, settings `design/components.md` §4는 **이 문서의 §2 토큰 표·§4 규칙 표를 참조**하고 화면별 차이만 적는다.
> 근거: 사용자 2026-10-08 "갠홈 디자인에 맞춰야" · 승인 5항목("진행", 2026-10-08) · 참조 `doc/300_검증/screenshots/20261008-design-ref/`(gansite-panel-user.jpg · gansite-home.png · gansite-login.png · rosebell-global.css · rosebell-hud.css · rosebell-fonts.css). 저쪽 패널 CSS(head.php 36~70행) 실측값.
> 요구: 신설 없음. R-ROOMS-005 🔒 · R-CHAT-013 🔒 · R-SET-009 🔒의 "Rosebell 계열 토큰" 조항을 갠홈 실측 톤으로 맞추는 **시각 보강**. R-CHAT-002 🔒 배치 불변. CR: rooms CR-002 · chat CR-004 · settings CR-002.
> 상태: **설계 확정·미구현.** 구현자는 이 문서 §2·§4·§7만 보고 CSS를 고친다.

비유: 집의 구조(방 배치·문 위치)는 그대로 두고 벽지·문틀·손잡이만 저쪽 저택과 같은 재료로 바꾸는 공사다. 재료 목록이 §2(토큰), 어느 벽에 무엇을 바르는지가 §4(규칙)다.

---

## 1. 불변 조건 (이 보강이 건드리지 않는 것)

| 항목 | 규칙 |
|---|---|
| 레이아웃·영역 크기 | 상단 바 44px · 행 56px · 새 방 행 52px · settings A44/B40/D36/F40 · chat C 96~136px · 말풍선 최대 폭(78%/85%/86%) 전부 그대로. 선 두께 1px 유지(박스 크기 불변) |
| DOM·순서·`aria-*`·문구 | 바꾸지 않는다. TSX 파일 수정 0건. 장식 라벨도 CSS 생성 내용으로만(§5) |
| 상태·라우팅·api | 무관 |
| 패키지·폰트 | 설치 없음. 새 외부 CDN 없음(Google Fonts Noto Serif KR 기존 `<link>`만) |
| 토큰 단일 소스 | `ui/src/styles/global.css` `:root`. 컴포넌트 CSS는 변수만 참조(하드코딩 색 금지). 기존 변수명은 삭제하지 않는다 |
| 영향 TC | 없음 — 문구·역할·이름·DOM이 같아 vitest(jsdom) 기대가 바뀌지 않는다. 확인은 §8 수동 항목 |

## 2. 공통 토큰 표 (`ui/src/styles/global.css` `:root`) [확정]

"변경 전"은 2026-10-08 global.css 실물. "유지"는 값 그대로. **신규**는 `:root`에 행을 더한다(자리: 같은 묶음 끝).

### 2.1 색

| 변수 | 변경 전 | 변경 후 | 용도 · 근거 |
|---|---|---|---|
| `--color-bg` | `#0b1828` | `#0b1828` (유지) | 화면 바탕. head.php iframe 배경 `#0b1828`와 같아 패널과 이음매가 없다. 갠홈 deep `#0b1221`로 바꾸면 iframe 경계에 색 띠가 생겨 유지 |
| `--color-bg-elevated` | `#102339` | `#112337` | 시트·토스트·배지 바탕. 패널 그라데이션 시작색 `rgba(17,35,55)` |
| `--color-bg-sunken` | `#081220` | `#050d18` | 입력창 바탕. 패널 그라데이션 끝색 `rgba(5,13,24)` |
| `--color-overlay` | `rgba(4, 10, 20, 0.6)` | `rgba(5, 7, 13, 0.72)` | 시트 덮개. 갠홈 ink `#05070d` |
| `--color-fg` | `#e6edf6` | `#d9e3f2` | 본문. 갠홈 ivory |
| `--color-fg-muted` | `#9fb2c9` | `#8492aa` | 보조 글자(시각·이름·안내·유저 발화). 갠홈 muted `#7c88a0`은 elevated 위 4.46:1로 AA 미달 → 같은 색상각에서 한 단계 밝힘(§3) |
| `--color-fg-disabled` | `#5d6f86` | `#4a5872` | 비활성(대비 예외) |
| `--color-border` | `rgba(153, 185, 221, 0.22)` | `rgba(114, 155, 208, 0.32)` | 기본 1px 선(상단 바 아래·C 위·입력창·탭 줄). 갠홈 선 |
| `--color-border-strong` | `rgba(180, 205, 235, 0.45)` | `var(--color-line-bright)` | 강한 선(기존 참조처 유지용) |
| `--color-line-faint` **신규** | — | `rgba(168, 176, 192, 0.14)` | 방 목록 행 구분선. 갠홈 연한 선 |
| `--color-line-bright` **신규** | — | `rgba(171, 198, 230, 0.55)` | 밝은 선(보조 버튼 선·시트 위 선). head.php 패널 테두리 |
| `--color-primary` | `#b4cdeb` | `#aebfd8` | 주 강조: 주 버튼 선, 선택 탭 밑줄, 라디오 `accent-color` |
| `--color-primary-fg` | `#0b1828` | `#0b1828` (유지) | 채움 버튼이 없어져 사용처 0이 된다(Toggle on 변경, §4.1). 기존 변수 삭제 금지 원칙으로 남긴다 |
| `--color-primary-hover` | `#cfe0f4` | `#d9e3f2` | 기존 참조처 유지용(ivory) |
| `--color-accent` | `#c3d2e7` | `#c4cfdf` | TopBar 화면 제목(`.screen`). 갠홈 paper |
| `--color-success` | `#7fc8a3` | `#aebfd8` | Toast success 막대. 초록 → 계열 안 은청색으로 흡수 |
| `--color-warning` | `#d9b86a` | `#bcae8c` | Toast warning 막대 · settings 하단 줄 경고 글자. **계열 밖 1색 허용(낮은 채도 황동)** — 근거: 경고는 정상(ivory/muted)·성공(은청)·오류(적갈)와 글자색만으로 구별돼야 하는데(StatusBar `.warning`은 아이콘 없이 글자색으로 상태를 보인다) 남색 계열 안에는 남은 구별 축이 없다. 채도를 낮춰(약 20%) 화면 안 유일한 따뜻한 색 2개(황동·적갈)가 같은 톤으로 묶인다 |
| `--color-danger` | `#d97b73` | `#b97a6e` | 오류·삭제·필수 표시. 채도 낮은 적갈색 1개 |
| `--color-info` | `#8ab4ff` | `#729bd0` | 열람 안내 줄·새 메시지 배지. 갠홈 강조(강청) |
| `--color-focus` | `#b4cdeb` | `#b4cdeb` (유지) | 포커스 링. 갠홈 포커스와 같음 |
| `color-scheme` **신규** | — | `dark` | 네이티브 폼 컨트롤(라디오·체크박스)·스크롤바 다크화. 선택 안 된 라디오가 흰 원으로 보이던 것 해소(캡처 후속 수정, chat CR-004) |

### 2.2 말풍선 · 아바타

| 변수 | 변경 전 | 변경 후 | 용도 · 근거 |
|---|---|---|---|
| `--bubble-ciel-bg` | `#16304d` | `rgba(114, 155, 208, 0.12)` | 시엘 본문 바탕(강청 옅은 바탕) — 승인 1 |
| `--bubble-ciel-fg` | `#e6edf6` | `var(--color-fg)` | 시엘 본문 글자 |
| `--bubble-ciel-accent` | `#6f9ad1` | `#729bd0` | 시엘 아바타 테두리(이름 글자는 muted로 바뀜 — 승인 3) |
| `--bubble-ciel-border` **신규** | — | `rgba(114, 155, 208, 0.6)` | 시엘 본문 1px 선 |
| `--bubble-sebastian-bg` | `#2a1f33` | `rgba(174, 191, 216, 0.07)` | 세바스찬 본문 바탕(은청, 시엘보다 옅게) — 승인 1. 보라 제거 |
| `--bubble-sebastian-fg` | `#efe6f2` | `var(--color-fg)` | 세바스찬 본문 글자 |
| `--bubble-sebastian-accent` | `#a98bc4` | `#aebfd8` | 세바스찬 아바타 테두리 |
| `--bubble-sebastian-border` **신규** | — | `rgba(174, 191, 216, 0.45)` | 세바스찬 본문 1px 선 |
| `--bubble-user-bg` | `var(--color-bg-elevated)` | `transparent` | 유저 가운데 말풍선 바탕 없음 — 승인 1 |
| `--bubble-user-border` **신규** | — | `transparent` | 유저 본문 선 없음(1px 자리는 유지 → 크기 불변) |
| `--bubble-user-text` **신규** | — | `var(--color-fg-muted)` | 유저 본문 글자 muted — 승인 1 |
| `--bubble-user-fg` | `#9fb2c9` | `var(--color-fg-muted)` | 유저 작성자명 |
| `--bubble-ooc-fg` | `#7f93ab` | `var(--color-fg-muted)` | OOC 한 줄(선·바탕 없음 유지) |
| `--bubble-pending-fg` | `#7f93ab` | `var(--color-fg-muted)` | 임시 말풍선 `…` |
| `--bubble-error-border` | `#d97b73` | `var(--color-danger)` | 실패 말풍선 선 |
| `--bubble-busy-opacity` | `0.55` | `0.55` (유지) | 재작성 중 흐림 |
| `--bubble-max-width` · `--bubble-user-max-width` | `78%`(≤360 `85%`) · `86%` | 유지 | 크기 불변 |
| `--avatar-ciel-bg` **신규** | — | `rgba(114, 155, 208, 0.24)` | 시엘 아바타 원 placeholder 바탕(인장 이미지 자리, 이미지가 투명·로드 실패여도 원이 보인다). 플레이스홀더 PNG는 투명(64×64 RGBA) — `ui/public/img/{sebastian,ciel}.png`, 같은 경로에 인장 이미지를 덮어쓴다 |
| `--avatar-sebastian-bg` **신규** | — | `rgba(174, 191, 216, 0.16)` | 세바스찬 아바타 원 placeholder 바탕 |
| `--radius-bubble` **신규** | — | `10px 2px 10px 2px` | 말풍선 모서리(세바스찬·유저·임시) |
| `--radius-bubble-mirror` **신규** | — | `2px 10px 2px 10px` | 시엘 말풍선(오른쪽 거울) |

### 2.3 행 · 버튼 · 입력 · 시트 · 상단 바

| 변수 | 변경 전 | 변경 후 | 용도 · 근거 |
|---|---|---|---|
| `--row-hover-bg` | `var(--color-bg-elevated)` | `var(--btn-hover-bg)` | 행·IconButton·ghost·SheetItem·탭 hover. 아주 옅은 푸른 바탕 |
| `--row-divider` | `var(--color-border)` | `var(--color-line-faint)` | 방 목록 행·새 방 행 아래선 |
| `--btn-bg` | `var(--color-primary)` | `transparent` | 주 버튼 바탕 없음 — 승인 2 |
| `--btn-fg` | `var(--color-primary-fg)` | `var(--color-fg)` | 주 버튼 글자 ivory(더 밝게) |
| `--btn-hover` | `var(--color-primary-hover)` | `var(--btn-hover-bg)` | 주 버튼 hover 바탕 |
| `--btn-secondary-bg` | `var(--color-bg-elevated)` | `transparent` | 보조 버튼 바탕 없음 |
| `--btn-danger-bg` | `var(--color-danger)` | `transparent` | 위험 버튼 바탕 없음 |
| `--btn-busy-opacity` | `0.55` | `0.4` | 비활성 시 선·글자를 함께 흐리게(투명 버튼은 0.55로는 활성과 구별이 약하다) |
| `--btn-border` **신규** | — | `var(--color-line-bright)` | 보조 버튼 1px 선 |
| `--btn-border-primary` **신규** | — | `var(--color-primary)` | 주 버튼 1px 선(불투명 `#aebfd8` — 보조보다 밝다) |
| `--btn-secondary-fg` **신규** | — | `#c4cfdf` | 보조 버튼 글자(paper — 주 버튼 ivory보다 한 단계 어둡게) |
| `--btn-hover-bg` **신규** | — | `rgba(114, 155, 208, 0.10)` | 공통 hover 옅은 푸른 바탕 |
| `--btn-danger-hover-bg` **신규** | — | `rgba(185, 122, 110, 0.10)` | 위험 버튼 hover |
| `--glow` **신규** | — | `drop-shadow(0 0 5px rgba(166, 202, 241, 0.55))` | `filter` 값. 주 버튼 hover·Toggle on에만(그림자 대신 글로우) |
| `--input-bg` · `--input-fg` · `--input-border` · `--input-placeholder` | `var(--color-bg-sunken)` · `var(--color-fg)` · `var(--color-border)` · `var(--color-fg-muted)` | 유지(참조값이 바뀌어 따라감) | 입력창 — 승인 5 |
| `--sheet-bg` | `var(--color-bg-elevated)` | 유지 | 시트 바탕 |
| `--sheet-radius` | `var(--radius-lg) var(--radius-lg) 0 0` | `var(--radius-panel)` | 바텀시트 비대칭 모서리 — 승인 5 |
| `--sheet-shadow` | `0 -12px 24px rgba(4, 10, 20, 0.45)` | `inset 0 1px 0 var(--color-line-bright)` | 바깥 그림자 제거, 위쪽 1px 밝은 선을 **inset 그림자로**(border를 더하면 시트 높이가 1px 늘어 크기 불변 조건 위반) |
| `--z-sheet` | `10` | 유지 | |
| `--topbar-band` **신규** | — | `linear-gradient(90deg, rgba(88, 122, 166, 0.17), transparent)` | 상단 바 90도 머리띠(head.php 머리띠 값) — 승인 4 |
| `--label-size` **신규** | — | `7px` | 장식 라벨 글자 크기(head.php 6px, 390 폭 가독 위해 +1) |
| `--label-tracking` **신규** | — | `0.22em` | 장식 라벨 자간 |
| `--label-color` **신규** | — | `#91a9c7` | 장식 라벨 색(head.php 값) |

### 2.4 타이포 · 반경

| 변수 | 변경 전 | 변경 후 | 용도 · 근거 |
|---|---|---|---|
| `--font-serif` | `'Noto Serif KR', 'Nanum Myeongjo', serif` | 유지 | 한글 본문·말풍선 |
| `--font-display` **신규** | — | `'Times New Roman', 'Noto Serif KR', serif` | 화면 제목(`.screen`). 갠홈 Saol 대체 폴백. 라틴 글자는 Times, 한글은 Noto Serif KR로 떨어진다 |
| `--font-ui` | `'Malgun Gothic', '맑은 고딕', 'Segoe UI', system-ui, sans-serif` | `Pretendard, 'Malgun Gothic', '맑은 고딕', 'Segoe UI', system-ui, sans-serif` | UI 글자. Pretendard는 **로드하지 않는다**(설치·CDN 없음) — 이용자 기기에 있을 때만 쓰인다 |
| `--text-display` **신규** | — | `22px` | 화면 제목 크기(기존 xl 18px → 큰 세리프) |
| `--text-xs` ~ `--text-xl` | 11 · 12 · 13 · 14 · 16 · 18px | 유지 | |
| `--radius-sm` | `4px` | `0` | 직각 — 승인 2·5 |
| `--radius-md` | `8px` | `0` | Button·IconButton·SheetItem 직각(이 변수 하나로 반영) |
| `--radius-lg` | `16px` | `0` | 큰 둥근 모서리 금지. 기존 사용처(Bubble·sheet)는 아래 신규 변수로 옮긴다 |
| `--radius-field` **신규** | — | `7px 1px 7px 1px` | TextInput·TextArea 비대칭 모서리(갠홈 작은 패턴) |
| `--radius-panel` **신규** | — | `16px 0 0 0` | 바텀시트(왼쪽 위만 둥근 비대칭) |
| `--space-*` | 4 · 8 · 12 · 16 · 24px | 유지 | 크기 불변 |

## 3. 대비 근거 (WCAG 2.x 상대 휘도 공식으로 계산, 반투명 바탕은 `#0b1828` 위 합성값)

| 글자/요소 | 바탕 | 대비 | 판정 |
|---|---|---|---|
| `--color-fg` `#d9e3f2` | `--color-bg` `#0b1828` | 13.8:1 | AA ✓ |
| `--color-fg` | `--color-bg-elevated` `#112337` | 12.3:1 | ✓ |
| `--color-fg` | 시엘 본문(합성 ≈ `#17283c`) | 11.5:1 | ✓ |
| `--color-fg` | 세바스찬 본문(합성 ≈ `#162434`) | 12.1:1 | ✓ |
| `--color-fg-muted` `#8492aa` | bg / elevated / sunken `#050d18` | 5.68 / 5.06 / 6.19:1 | ✓ (갠홈 원값 `#7c88a0`은 elevated 4.46:1 ✗ → 조정 근거) |
| 보조 버튼 글자 `#c4cfdf` | bg / elevated | 11.3 / 10.1:1 | ✓ |
| 주 버튼 글자 `#d9e3f2` | bg / elevated | 13.8 / 12.3:1 | ✓ |
| `--color-danger` `#b97a6e` | bg / elevated / sunken | 5.17 / 4.60 / 5.64:1 | ✓ (elevated 위가 최저 — StaleNotice·ConfirmDialog 「삭제」) |
| `--color-warning` `#bcae8c` | bg / elevated | 8.14 / 7.25:1 | ✓ |
| `--color-info` `#729bd0` | bg / elevated(배지) | 6.22 / 5.54:1 | ✓ |
| 선택 탭 밑줄·주 버튼 선 `#aebfd8` | bg | 9.57:1 | 비텍스트 3:1 ✓ |
| 포커스 링 `#b4cdeb` 2px | bg | 약 10:1 | 비텍스트 3:1 ✓ |
| 장식 라벨 `#91a9c7` | bg(머리띠 합성 포함) | 약 7.4:1 | 장식(보조기기 숨김)이라 예외지만 충족 |
| 비활성(`opacity .4`, `--color-fg-disabled`) | — | — | 예외(WCAG 1.4.3 비활성 컴포넌트) |

- 보조 버튼 선 `--color-line-bright`(반투명 .55)는 버튼 경계를 이루지만 버튼은 글자로 식별되므로 1.4.11 경계 대비는 요구되지 않는다. 입력창 선 `--color-border`도 같다(바탕 sunken과 화면 bg의 명도차 + 포커스 링으로 식별).
- 수치는 설계 계산값이다. 구현 뒤 수동 항목 §8-③으로 실측 확인한다.

## 4. 컴포넌트별 시각 규칙 표 [확정]

표기: `속성: 전 → 후`. "무수정"은 CSS 파일을 고치지 않고 §2 변수 값만으로 바뀌는 것. 승인 항목 번호를 끝에 적는다.

### 4.1 공용 `ui/src/components/ui/*`

| 파일 | 클래스 | 규칙 | 승인 |
|---|---|---|---|
| `Button/Button.module.css` | `.root` | 변경 없음(`border: 1px solid transparent` · `border-radius: var(--radius-md)` → 값 0으로 직각 · `font-family: var(--font-ui)`) | 2 |
| 〃 | `.primary` | `background: var(--btn-bg)`(→ 투명) · `color: var(--btn-fg)`(→ ivory) 유지 + **추가** `border-color: var(--btn-border-primary)` | 2 |
| 〃 | `.primary:hover:not(:disabled)` | `background: var(--btn-hover)` 유지 + **추가** `filter: var(--glow)` | 2 |
| 〃 | `.secondary` | `color: var(--color-fg)` → `var(--btn-secondary-fg)` · `border-color: var(--color-border)` → `var(--btn-border)` · `background` 유지(→ 투명) | 2 |
| 〃 | `.secondary:hover:not(:disabled)` | `border-color: var(--color-border-strong)` → `var(--btn-border-primary)` + **추가** `background: var(--btn-hover-bg)` | 2 |
| 〃 | `.danger` | `color: var(--color-bg)` → `var(--color-danger)` + **추가** `border-color: var(--color-danger)` · `background` 유지(→ 투명) | 2 |
| 〃 | `.danger:hover:not(:disabled)` **신규 규칙** | `background: var(--btn-danger-hover-bg)` | 2 |
| 〃 | `.ghost` · `.ghost:hover` | 무수정(선 없는 글자형 유지. hover는 `--row-hover-bg` 값 변경으로 옅은 푸른 바탕) | 3 |
| 〃 | `.root:disabled` | 무수정(`opacity: var(--btn-busy-opacity)` → 0.4로 선·글자 함께 흐림) | 2 |
| `IconButton/IconButton.module.css` | `.root` · `:hover` · `:disabled` | 무수정(선 없음 유지 · 반경 0 · hover 옅은 푸른 바탕 · 비활성 `--color-fg-disabled`) | 2 |
| `TopBar/TopBar.module.css` | `.root` | `background: var(--color-bg)` → `var(--topbar-band), var(--color-bg)`(그라데이션 위층 + 색 아래층) · `border-bottom` 무수정(값 변경) · 높이 44 유지 | 4 |
| 〃 | `.screen` | `font-size: var(--text-xl)` → `var(--text-display)` · `letter-spacing: 0.08em` → `0.05em` · **추가** `font-family: var(--font-display)` · `font-weight: 400` · `line-height: 1.1` · `color`·`text-transform` 유지 | 4 |
| 〃 | `.screen::before` **신규 규칙** | `content: 'THE PHANTOMHIVE ESTATE' / '';` · `display: block` · `margin-bottom: 2px` · `font-family: var(--font-ui)` · `font-size: var(--label-size)` · `line-height: 1.5` · `font-weight: 400` · `letter-spacing: var(--label-tracking)` · `color: var(--label-color)` · `text-transform: uppercase`. 방식 결정은 §5 | 4 |
| 〃 | `.room` · `.subtitle` | 무수정(chat 방 제목 serif lg, 라벨 없음 — §5 ③) | 4 |
| `BottomSheet/BottomSheet.module.css` | `.overlay` · `.panel` · `.header` | 무수정(`--color-overlay` · `--sheet-bg` · `--sheet-radius`(→ `16px 0 0 0`) · `--sheet-shadow`(→ inset 위 1px 밝은 선) 값 변경) | 5 |
| `BottomSheet/SheetItem.module.css` | `.item` · `.danger` · `:disabled` | 무수정(반경 0 · hover 옅은 바탕 · danger 적갈) | 5 |
| `TextInput/TextInput.module.css` | `.input` | `border-radius: var(--radius-md)` → `var(--radius-field)`. 나머지(`--input-*`, 1px 선, invalid 적갈, 포커스 링) 무수정 | 5 |
| `TextArea/TextArea.module.css` | `.input` | `border-radius: var(--radius-md)` → `var(--radius-field)`. 선 두께·패딩 불변이라 높이 공식 영향 없음 | 5 |
| `Toggle/Toggle.module.css` | `.root` | `border-radius: 14px` → `0`(손잡이 없는 글자 캡슐이라 원형이 기능상 필요 없음). 선 `--color-border` · 글자 muted 유지 | 2 |
| 〃 | `.on` | `border-color: transparent` → `var(--btn-border-primary)` · `background: var(--color-primary)` → `var(--btn-hover-bg)` · `color: var(--color-primary-fg)` → `var(--color-fg)` · **추가** `filter: var(--glow)`. 꺼짐(어두운 선·muted 글자)과 켜짐(밝은 선·ivory 글자·옅은 바탕·글로우)이 선·글자·바탕 세 축으로 구별된다 | 2 |
| `Toast/Toast.module.css` | `.root` · `.warning` · `.danger` · `.success` | 무수정(바탕 elevated · 왼쪽 3px 막대 색이 §2.1 값으로 바뀜) | 1 |
| `ConfirmDialog/ConfirmDialog.module.css` · `PromptSheet/PromptSheet.module.css` | 전부 | 무수정(제목 serif · 설명 muted · 오류 적갈. 버튼은 Button 규칙을 따름 — 확인은 danger 선형) | 2·5 |
| `StateView/StateView.module.css` | 전부 | 무수정(muted 글자) | 1 |

### 4.2 chat `ui/src/chat/**`

| 파일 | 클래스 | 규칙 | 승인 |
|---|---|---|---|
| `components/Bubble.module.css` | `.body` | `border-radius: var(--radius-lg)` → `var(--radius-bubble)`. `border: 1px solid var(--color-border)` 유지(화자별로 덮음) | 3 |
| 〃 | `.name` | **추가** `color: var(--color-fg-muted)` · `font-size: var(--text-sm)` → `var(--text-xs)` · **추가** `letter-spacing: 0.05em` | 3 |
| 〃 | `.sebastian .name` · `.ciel .name` | `color: var(--bubble-*-accent)` 줄 **삭제**(공통 `.name` muted 적용) | 3 |
| 〃 | `.avatar` | **추가** `border: 1px solid var(--color-border)`(box-sizing border-box라 28px 유지). `border-radius: 50%` **유지** — 인장 이미지 자리(기능상 원) | 3 |
| 〃 | `.sebastian .avatar` **신규 규칙** | `background: var(--avatar-sebastian-bg)` · `border-color: var(--bubble-sebastian-accent)` | 3 |
| 〃 | `.ciel .avatar` **신규 규칙** | `background: var(--avatar-ciel-bg)` · `border-color: var(--bubble-ciel-accent)` | 3 |
| 〃 | `.sebastian .body` | `background` · `color` 유지(값 변경) + **추가** `border-color: var(--bubble-sebastian-border)` | 1·3 |
| 〃 | `.ciel .body` | `background` · `color` · `text-align` 유지 + **추가** `border-color: var(--bubble-ciel-border)` · `border-radius: var(--radius-bubble-mirror)` | 1·3 |
| 〃 | `.user .body` | `background: var(--bubble-user-bg)` 유지(→ 투명) · `color: var(--color-fg)` → `var(--bubble-user-text)` + **추가** `border-color: var(--bubble-user-border)` | 1 |
| 〃 | `.author` · `.time` · `.oocText` · `.regenerating*` | 무수정(muted 값 변경) | 1·3 |
| `components/PendingBubble.module.css` | 전부 | 무수정. 임시·실패 말풍선은 `Bubble.module.css` 클래스를 import하므로 화자별 선·모서리·바탕을 그대로 받는다. `.failed .bodyBox` 선 = 적갈. `.neutral .bodyBox` 바탕 투명 유지(선은 `.body` 기본 `--color-border`) | 3 |
| `components/BubbleActions.module.css` | 전부 | 무수정(글자형 ghost 그대로, 색만 muted·적갈 값 변경) | 3 |
| `components/NewMessageBadge.module.css` | `.root` | `--btn-bg: var(--color-info)` → `var(--color-bg-elevated)` · `--btn-hover: var(--color-info)` → `var(--color-bg-elevated)` · **추가** `--btn-fg: var(--color-info)` · `--btn-border-primary: var(--color-info)`. 배지는 히스토리 글자 위에 떠 있어 투명 바탕이면 아래 글자와 겹쳐 읽히지 않으므로 **불투명 elevated 바탕 + 강청 선·글자**(§6 차이 ①) | 2 |
| `components/ReadOnlyNotice.module.css` | `.root` | 무수정(위 1px 선 · info 글자 강청) | 1 |
| `components/Composer.module.css` · `SpeakButtons.module.css` · `InlineEditor.module.css` · `InlineStatus.module.css` · `MessageList.module.css` · `MenuSheets.module.css` · `styles/ChatScreen.module.css` | 전부 | 무수정. 캐릭터 버튼(secondary)·전송(primary)·OOC(Toggle)·편집 저장/취소·재시도(secondary)는 §4.1 Button·Toggle 규칙으로 바뀐다. 입력창은 TextArea 규칙 | 2·5 |

### 4.3 rooms `ui/src/rooms/**`

| 파일 | 클래스 | 규칙 | 승인 |
|---|---|---|---|
| `components/ListRow.module.css` | `.root` · `.title` · `.date` | 무수정(아래선 `--row-divider` → 연한 선 · hover 옅은 푸른 바탕 · 제목 serif md ivory · 날짜 muted) | 1 |
| `components/NewRoomRow.module.css` | `.root` | 무수정(입력은 TextInput, 버튼은 Button 규칙) | 2·5 |
| `components/RoomList.module.css` · `styles/RoomsScreen.module.css` | 전부 | 무수정. 상단 「+ 새 방」 = Button primary 선형, ⚙ = IconButton 선 없음 | 2 |

### 4.4 settings `ui/src/settings/**`

| 파일 | 클래스 | 규칙 | 승인 |
|---|---|---|---|
| `components/Tabs.module.css` | `.root` · `.tab` · `.selected` | 무수정. 밑줄형 유지, 선택 밑줄 2px `--color-primary` → `#aebfd8` · 줄 아래선 `--color-border` · hover 옅은 바탕 | 5 |
| `components/StatusBar.module.css` | `.bar` · `.muted` · `.warning` · `.danger` | 무수정(위 1px 그림자 선 값 변경 · 경고 황동 · 오류 적갈). 「되돌리기」 secondary · 「저장」 primary 선형 | 2 |
| `components/StaleNotice.module.css` | `.root` | 무수정(왼쪽 3px 적갈 막대 · elevated 바탕 · 적갈 글자 4.60:1) | 1 |
| `components/ModelChoice.module.css` | `.radio` | 무수정. `accent-color: var(--color-primary)` → 은청. 네이티브 라디오 원은 **유지**(기능상 원형) | 1 |
| `components/FormField.module.css` · `CharacterForm.module.css` · `WorldForm.module.css` · `FilePicker.module.css` · `Sheets.module.css` · `ReadyBody.module.css` · `styles/SettingsScreen.module.css` | 전부 | 무수정. 입력은 TextInput/TextArea 비대칭 모서리, 파일 선택·시트 버튼은 Button 규칙, 필수 표시·오류 적갈 | 5 |

## 5. 장식 라벨 "THE PHANTOMHIVE ESTATE" — 방식 결정

**결론: TopBar `.screen::before { content: 'THE PHANTOMHIVE ESTATE' / ''; }`(CSS 생성 내용 + 빈 대체 텍스트).** DOM 추가 없음, h1 텍스트·접근성 이름 불변.

| # | 근거 |
|---|---|
| ① 보조기기 | CSS 생성 내용은 접근성 이름 계산(accname)에 들어가 h1 이름이 "THE PHANTOMHIVE ESTATE ROOMS"가 될 수 있다. `content: "…" / ""`(CSS Generated Content Level 3 대체 텍스트)는 대체 텍스트를 빈 문자열로 줘 접근성 트리에서 뺀다(Chromium 77+ · Safari 17.4+ · Firefox 128+) |
| ② 미지원 브라우저 | 슬래시 문법을 모르는 엔진은 선언 전체를 버린다 → 라벨이 **안 보일 뿐** 읽히지도 않는다(안전한 쪽으로 실패). 대체 선언(슬래시 없는 `content`)을 앞에 두지 않는다 — 그러면 구형 엔진에서 읽힌다 |
| ③ 적용 범위 | `variant='screen'`(rooms "ROOMS" · settings "캐릭터 설정")에만. chat은 `variant='room'`(긴 방 제목 + 날짜)이라 라벨 없이 머리띠만 — 승인 4 "chat·settings 상단 바도 같은 머리띠"와 일치. `::before`가 block이라 제목 줄의 말줄임은 짧은 고정 제목에서만 안전하므로 room 변형에 넣지 않는다 |
| ④ 세로 맞춤 | 라벨 7px × 1.5 = 10.5px + 2px + 제목 22px × 1.1 ≈ 24px → 약 37px < 상단 바 44px. 바 높이 불변 |
| ⑤ 문구 소스 | 사용자에게 읽히는 문구가 아닌 장식 무늬라 `labels.ts`에 두지 않는다(CSS 안 고정 문자열). jsdom은 의사 요소 `content`를 접근성 이름에 넣지 않아 기존 `getByRole('heading', { name })` 기대가 바뀌지 않는다 |

## 6. 승인 5항목과 달라진 점 (설계와 달리한 점)

| # | 승인 내용 | 이 설계 | 이유 |
|---|---|---|---|
| ① | 버튼 전부 투명 + 1px 선 | 새 메시지 배지(Button primary)는 **불투명 elevated 바탕** + 강청 선·글자 | 히스토리 위에 떠 있는 버튼이라 투명이면 아래 말풍선 글자와 겹쳐 읽을 수 없다 |
| ② | 버튼 전부 1px 선(Button 전 variant) | `ghost`는 선 없는 글자형 유지 | 승인 3 "말풍선 아래 액션 버튼은 글자형 그대로"가 ghost를 쓴다(장기기억 시트 닫기도 ghost). ghost에 선을 넣으면 승인 3과 충돌 |
| ③ | 갠홈 muted `#7c88a0` | `#8492aa` | elevated(시트·토스트) 위 4.46:1로 AA 미달 |
| ④ | 팔레트 교체(deep `#0b1221`) | `--color-bg`는 `#0b1828` 유지 | 저쪽 iframe 배경(head.php)이 `#0b1828`이라 이음매가 생긴다 |
| ⑤ | 상단 바 장식 라벨 | rooms·settings(`screen` 변형)에만, chat은 머리띠만 | §5 ③ |
| ⑥ | 바텀시트 위 선 | border가 아닌 inset 그림자 | 시트 높이 1px 증가 방지(크기 불변) |
| ⑦ | 이름 muted | 화자 구분은 위치·선 색·아바타 테두리 색으로 유지 | R-CHAT-002 🔒 배치 불변 + 승인 3 |
| ⑧ | warning 처리 | 낮은 채도 황동 `#bcae8c` 1색 허용 | §2.1 `--color-warning` 근거 |

## 7. 구현 대상 파일 (8개, 전부 CSS)

1. `ui/src/styles/global.css` — §2 전체(`:root` 값 교체 + 신규 변수)
2. `ui/src/components/ui/Button/Button.module.css` — §4.1
3. `ui/src/components/ui/TopBar/TopBar.module.css` — §4.1 · §5
4. `ui/src/components/ui/TextInput/TextInput.module.css` — 반경 1줄
5. `ui/src/components/ui/TextArea/TextArea.module.css` — 반경 1줄
6. `ui/src/components/ui/Toggle/Toggle.module.css` — §4.1
7. `ui/src/chat/components/Bubble.module.css` — §4.2
8. `ui/src/chat/components/NewMessageBadge.module.css` — §4.2

- TSX·labels·state·api 수정 0건. 위 파일 머리 주석의 설계 참조는 이 문서(`chat/design/style.md`)로 갱신한다.
- `.claude/skills/ui_design_concept.md`는 이 설계가 쓰지 않는다(디자인 컨셉 문서 갱신 여부는 메인 세션 판단).

## 8. 검증 (자동 TC 영향 없음 · 수동 확인)

| # | 확인 | 방법 |
|---|---|---|
| ① | 기존 vitest 전건 그대로 통과(문구·역할·DOM 불변) | `npx vitest run --project ui` |
| ② | 390×565에서 세 화면 영역 높이·폭이 이전 캡처와 같음, 가로 스크롤 없음 | `/run-app` 캡처, 이전 `ours-*-now.png`와 비교 |
| ③ | §3 주요 대비 실측(본문·muted·danger on elevated·info 배지) | 캡처 색 추출 |
| ④ | rooms·settings 상단 바에 라벨이 보이고, 스크린리더/접근성 트리의 h1 이름에 라벨이 없음 | Chrome DevTools 접근성 패널 |
| ⑤ | 세바스찬 왼쪽·시엘 오른쪽(거울 모서리)·유저 가운데 선 없음·OOC 한 줄 | 캡처 |

---

## 변경이력

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v2.2 | 2026-10-08 | 최초 작성. 세 화면 시각 보강 정본(토큰 표 · 대비 · 컴포넌트 규칙 · 장식 라벨 · 차이 · 구현 파일) | 사용자 2026-10-08 승인 5항목 · rooms CR-002 · chat CR-004 · settings CR-002 |
| v2.2.1 | 2026-10-08 | 캡처 후속 수정: §2.1 `color-scheme: dark` 행 추가 · §2.2 아바타 플레이스홀더 PNG 투명(64×64 RGBA) 명시 | chat CR-004 캡처 판정(ui-fixer) |
