# UI Design Concept (런던_디스패치)

## 역할 구분
이 파일은 **UI 디자인 시스템(Visual HOW)**을 정의한다: 색·타이포·스페이싱·컨트롤 크기·컴포넌트 톤·상태 색·화면별 원칙.
**무엇을 만들지(WHAT)**는 `design.md`, **React 구현 패턴(Code HOW)**은 `tsx-rules.md`.

---

## 1. 개요

| 항목 | 기술 |
|------|------|
| 스타일 | CSS Modules + CSS 변수 토큰 (전역 `ui/src/styles/global.css`) |
| 프레임워크 | 없음(Tailwind·UI 라이브러리 미사용). 필요 시 사용자 승인 후 도입 |
| 클래스 조합 | `cx()` (`@/components/utils/cx`) |
| 아이콘 | 인라인 SVG(stroke 1.25, 저쪽 헤더 아이콘과 같은 선 굵기). 아이콘 라이브러리는 승인 후 |
| 폰트 | `Noto Serif KR`(Google Fonts, `index.html` `<link>`) + 시스템 sans 폴백 |
| 테마 | **다크 단일**(저쪽 패널이 남색 반투명이라 라이트 없음). `data-theme` 없음 |
| 환경 | 폭 390px 패널 안 iframe. 배경은 저쪽 패널과 이어지는 남색 |

## 2. 화면별 원칙

| 화면 | 원칙 |
|---|---|
| **rooms(방 목록)** | 상단 바 + 리스트. 장식 최소. 행 구분은 1px 라인. 새 방은 상단 바 오른쪽 작은 버튼 |
| **chat(대화)** | 메신저형. 세바스찬은 왼쪽, 시엘은 오른쪽(각각 아바타·이름, 캐릭터별 accent 색), 유저 발화는 가운데(작성자명, 말풍선 배경), OOC 지시는 가운데 회색 한 줄·배경 없음(R-CHAT-002 🔒, 2026-10-05 지인 지정). 하단 바는 패널과 같은 남색에 위쪽 1px 라인. 토큰 없으면 하단 바 자체가 없다 |
| **시트·메모리 편집** | 화면을 덮는 레이어는 조금 더 어두운 남색 + 위쪽 둥근 모서리. 저쪽 패널 모서리(`16px 0 16px 0`)와 충돌하지 않게 시트만 둥글게 |

## 3. 색상 시스템 (CSS 변수)

### 기본 토큰
```css
:root {
  --color-bg: #0b1828;            --color-bg-elevated: #102339;    --color-bg-sunken: #081220;
  --color-overlay: rgba(4, 10, 20, .6);                             /* 시트 뒤 덮개 */
  --color-fg: #e6edf6;            --color-fg-muted: #9fb2c9;       --color-fg-disabled: #5d6f86;
  --color-border: rgba(153, 185, 221, .22);   --color-border-strong: rgba(180, 205, 235, .45);
  --color-primary: #b4cdeb;       --color-primary-fg: #0b1828;     --color-primary-hover: #cfe0f4;
  --color-accent: #c3d2e7;        /* 제목·소제목 */
  --color-success: #7fc8a3;       --color-warning: #d9b86a;        --color-danger: #d97b73;
  --color-info: #8ab4ff;
  --color-focus: #b4cdeb;

  /* 화자별 말풍선 */
  --bubble-ciel-bg: #16304d;      --bubble-ciel-fg: #e6edf6;       --bubble-ciel-accent: #6f9ad1;
  --bubble-sebastian-bg: #2a1f33; --bubble-sebastian-fg: #efe6f2;  --bubble-sebastian-accent: #a98bc4;
  --bubble-user-fg: #9fb2c9;      --bubble-ooc-fg: #7f93ab;        /* OOC는 배경 없음·중앙 한 줄. 유저 발화는 중앙 말풍선(배경 있음) */
  --bubble-pending-fg: #7f93ab;   --bubble-error-border: #d97b73;
}
```

- 시엘 = 푸른 남색 계열, 세바스찬 = 자줏빛 어두운 계열. 두 말풍선 모두 바탕(`--color-bg`)과 대비가 낮지 않게(경계선 1px `--color-border` 병행).
- 저쪽 테마 색을 그대로 복사하지 않는다 — 톤만 맞춘다. 저쪽 CSS 변수(`--rb-*`)는 iframe 안에서 보이지 않는다.

### 컴포넌트별 변수
| 접두사 | 용도 |
|--------|------|
| `--btn-*` | 버튼(bg, fg, hover, secondary-bg, danger-bg, busy-opacity) |
| `--input-*` | 입력(bg, fg, border, focus-ring, placeholder) |
| `--bubble-*` | 말풍선(화자별 bg/fg/accent, radius, max-width) |
| `--sheet-*` | 바텀시트(bg, radius, shadow) |
| `--row-*` | 목록 행(hover-bg, divider) |

### 상태 색 사용 규칙
| 상태 | 색 | 예 |
|---|---|---|
| 정상·저장됨 | success | 메모리 저장 토스트 |
| 주의 | warning | 토큰 만료 안내, 레이트리밋 대기 |
| 오류·거부 | danger | 생성 실패 말풍선 테두리, 삭제 버튼 |
| 안내 | info | 열람 전용 안내, 새 메시지 배지 |

## 4. 타이포그래피

```css
font-family: 'Noto Serif KR', 'Nanum Myeongjo', serif;          /* 제목·말풍선 본문 */
--font-ui: 'Malgun Gothic', '맑은 고딕', 'Segoe UI', system-ui, sans-serif;   /* 버튼·메타·입력 */
```
- 말풍선·방 제목은 serif, 버튼·시각·입력창·오류 문구는 `--font-ui`. 섞어 쓰되 한 요소 안에서는 하나.

| 이름 | 크기 | 용도 |
|------|------|------|
| xs | 11px | 시각·배지·글자 수 |
| sm | 12px | 메타·OOC·열람 안내 |
| **base** | **13px** | 말풍선 본문·입력·목록 부제(기본) |
| md | 14px | 버튼·목록 제목 |
| lg | 16px | 방 제목(상단 바) |
| xl | 18px | 화면 제목(ROOMS) |

- line-height 1.55(말풍선), 1.4(UI). 영문 소제목(`ROOMS`, `CONVERSATION` 느낌)은 `letter-spacing: .08em; text-transform: uppercase; font-size: xs`.
- 숫자는 `font-variant-numeric: tabular-nums`(시각·글자 수).

## 5. 스페이싱 (8px 기준)

| 토큰 | 값 | 대상 |
|---|---|---|
| `--space-1` | 4px | 아이콘·배지 내부 |
| `--space-2` | 8px | 말풍선 사이·컨트롤 사이 |
| `--space-3` | 12px | 말풍선 내부 패딩·행 좌우 |
| `--space-4` | 16px | 화면 좌우 여백·시트 내부 |
| `--space-5` | 24px | 섹션 사이(빈 상태 등) |

```
<화면 px:space-4>
  <영역 gap:space-3>
    <말풍선 p:space-3 gap:space-2>
      <아이콘 p:space-1>
```

## 6. 컨트롤 크기 3단 (터치 우선)

| size | 높이 | 폰트 | 패딩 | 용도 |
|---|---|---|---|---|
| sm | 28px | 12px | 0 10px | 시트 안 보조·배지 버튼 |
| **md** | **36px** | **13px** | 0 14px | 기본(캐릭터 버튼·전송·새 방) |
| lg | 44px | 14px | 0 16px | 확인 시트의 주요 버튼·목록 행 |

- 터치 타깃 최소 44×44(시각 크기가 작아도 padding으로 확보).
- 반경 `--radius-sm: 4px` / `--radius-md: 8px` / `--radius-lg: 16px`(시트 위 모서리·말풍선). 패널 외곽은 저쪽 것이므로 iframe 루트에 반경·테두리·그림자 없음.
- 테두리 1px `--color-border`, 포커스 링 2px `--color-focus` 바깥(`:focus-visible`).

## 7. 컴포넌트 톤

| 컴포넌트 | 톤 |
|---|---|
| Button | primary(전송·저장·새 방) / secondary(취소·뒤로) / danger(삭제·재작성 확인) / ghost(아이콘·⋯). 텍스트 1~2어절. 잠금 중 `opacity: var(--btn-busy-opacity)` + 커서 기본 |
| Bubble | 캐릭터: 아바타 28px 원형 + 이름(sm, accent) + 시각(xs, muted) + 본문(base, serif). 최대 폭 78%. 세바스찬 왼쪽 / 시엘 오른쪽(accent 색·아바타로 구분). 유저: 중앙 정렬, 작성자명(sm)·시각(xs) 위, 본문 말풍선(배경 있음, 최대 폭 86%). OOC: 중앙 정렬 sm 한 줄, 앞뒤 `—`, 배경 없음. 임시: 본문 자리에 "…" 점 애니메이션. 오류: danger 테두리 + 재시도 sm 버튼 |
| TextArea | 입력 bg `--input-bg`(`--color-bg-sunken`), 자동 높이 1~3줄, placeholder muted |
| Toggle(OOC) | 작은 캡슐 `OOC` 텍스트 토글, 켜짐 primary 배경 |
| ListRow | 56px, 제목 md serif + 부제 sm muted + 날짜 xs 우상단. hover/active `--row-hover-bg` |
| BottomSheet | `--sheet-bg`(`--color-bg-elevated`), 위 모서리 lg, 그림자 위쪽 12px, 항목 lg 높이, danger 항목 danger 색 |
| 알림 | 히스토리 안 인라인 한 줄(`role=alert`, info/warning). 토스트는 하단 바 위 2초. 모달 없음 |

## 8. 모션
- 시트 열림 160ms ease-out(translateY), 덮개 fade 120ms. 새 메시지 삽입 fade 120ms. 임시 말풍선 점 애니메이션 1.2s 반복.
- 그 외 애니메이션 금지. `prefers-reduced-motion: reduce`면 전부 0ms.

## 9. 반응형·크기
- 기준 390×565. 세로는 부모 iframe 100%(`100vh` 금지).
- 폭 ≤ 360: 말풍선 최대 폭 85%, 캐릭터 버튼 라벨 축약(`세바스찬`→`세바`, `시엘` 유지), 상단 바 날짜 숨김.
- 폭 ≥ 480(저쪽 패널이 모바일 전체폭일 때): 콘텐츠 최대 폭 480 중앙 정렬.
- 높이 ≤ 480: 입력창 1줄 고정, 시트 최대 높이 70%.

## 10. 대비·검증 체크
- 텍스트 대비 4.5:1 이상(`--color-fg-muted` 포함, 말풍선 바탕 위에서도).
- 상태 색만으로 의미를 전달하지 않는다(아이콘·문구 병행). 화자 구분도 색 + 이름 + 정렬 세 가지로.
- 저쪽 패널 안에 실제로 띄운 스크린샷(`/run-app`)으로 경계·여백이 패널과 어긋나지 않는지 확인한다.
