---
name: component-catalog
description: 공용 컴포넌트(ui/src/components — ui·hooks·utils) 인벤토리/요약 카탈로그. 각 컴포넌트·훅·유틸의 import 경로·분류·용도·핵심 props/시그니처·대표 사용 패턴·테스트 파일을 한눈에 본다. ui-implementer·ui-component-implementer는 구현 전 "무엇이 이미 있고 어떻게 쓰는가"를 이 카탈로그로 확인해 재사용하고, ui-debug·ui-error-analyst는 대상 컴포넌트의 계약을 빠르게 조회한다. 화면/컴포넌트 구현·디버그 시 참조한다.
---

# 공용 컴포넌트 카탈로그 (Inventory — 무엇이 있고 어떻게 쓰나)

`ui/src/components` 아래 **공용** 컴포넌트·훅·유틸의 요약 인벤토리. "이미 있는 것을 다시 만들지 않도록", "쓰려는 것의 import·props·패턴을 즉시 알도록" 돕는다. (짝 문서: `component-usage-lessons` = 오용 경고 카탈로그.)

## 역할 분담 (읽기 / 쓰기)

| 주체 | 동작 |
|---|---|
| **읽기 — ui-implementer · ui-component-implementer** | 구현 전, 필요한 UI/기능을 이 카탈로그에서 **먼저 찾아 재사용**. 없을 때만 신규 생성(ui-component-designer 설계 경유). |
| **읽기 — ui-debug · ui-error-analyst · ui-fixer** | 수정 대상 컴포넌트의 import·props·패턴을 조회해 오용 없이 고친다. |
| **쓰기 — ui-component-implementer** | 새 공용 컴포넌트 구현 완료 시 해당 그룹에 1항목 append(Phase 4). |
| **쓰기 — ui-postprocessor** | 화면 로컬 컴포넌트를 `ui/src/components/ui`로 **승격**하거나 유틸을 추출했을 때 1항목 append. 오래된 항목 정리(옵트인). |
| **쓰기 — ui-component-designer** | `/doc-sync`에서 변경된 컴포넌트의 인벤토리 행만 갱신. |

## 경계 (중복 금지 — 무엇을 어디서 보나)

| 알고 싶은 것 | 보는 곳 |
|---|---|
| **무엇이 있고 어떻게 쓰나** (import·props·패턴) | **이 카탈로그** |
| **하지 말 것 → 올바른 사용** (알려진 오용) | `component-usage-lessons` |
| **Props 전체 계약·접근성·variant 상세** | 각 컴포넌트의 `COMPONENT.md`·`Demo.tsx` |
| **재사용 우선순위·api 경계·문서 규칙** | `ui-design-strategy` |
| **색·간격·타이포 토큰** | `ui_design_concept.md` |

## 조회·기록 규약

- 컴포넌트명 = **`### {Name}` 헤더** → grep으로 바로 조회 (예: `grep -n "### Bubble" SKILL.md`).
- import 경로 컨벤션: **`@/components/ui/{Name}`** (vite alias) 또는 배럴 `@/components/ui`에서 named import.
- 각 항목 5줄: `import / 분류·용도 / 핵심 props·시그니처 / 패턴 / 테스트`.

```
### {Name}
- import: `import { {Name} } from '@/components/ui/{Name}'`
- 분류·용도: {Primitive|Complex|Container} — {한 줄}
- 핵심 props: `value({타입})`; `onChange(value)`; `size('sm'|'md'|'lg')`; …
- 패턴: `<{Name} value={v} onChange={setV} />`
- 테스트: `ui/src/components/ui/{Name}/{Name}.test.tsx` (TC-C-001~)
```

---

## 1. UI 컴포넌트 (`components/ui`)

> 현재 등록 항목: **없음** (프로젝트 초기 상태). 첫 컴포넌트가 구현되면 위 형식으로 append한다.

## 2. 훅 (`components/hooks`)

> 현재 등록 항목: **없음**.
> 예상 형식: `### use{Name}` — import / 용도 / 시그니처 `(args) => { … }` / 패턴 / 테스트.

## 3. 유틸 (`components/utils`)

> 현재 등록 항목: **없음**.
> 대화 상태 전이 규칙은 여기가 아니라 `ui/src/state/`에 둔다(순수 함수·vitest 대상). utils는 화면·상태 무관 순수 계산(클래스 조합·날짜 표기·스크롤 보정 계산 등)만.

---

## 미구현 후보 (설계 착수 시 참고 — 등록 항목이 아님)

요구조건과 화면 규격(`doc/000_프로젝트_확정사항.md` §5.1)에서 예상되는 공용 컴포넌트다. **실제로 필요해졌을 때** ui-component-designer가 COMPONENT.md로 설계하고, 구현 완료 후 위 1절에 등록한다. 미리 만들지 않는다.

| 후보 | 분류 | 예상 용도 | 예상 사용처 |
|---|---|---|---|
| Button | Primitive | primary/secondary/danger/ghost, 잠금(`isBusy`) 상태, `ariaDescribedBy`(aria-describedby) | 두 화면 전부 |
| Bubble | Complex | 화자(세바스찬/시엘/유저/OOC)별 말풍선. 아바타·시각·`aria-busy` 임시 상태·오류 상태 | chat — 히스토리 |
| BottomSheet | Container | 하단에서 올라오는 메뉴/확인 시트. `Esc`·바깥 탭 닫기, 포커스 트랩 | chat — 방 메뉴 ⋯·confirm, settings — 「설정 파일」 메뉴 (메시지 메뉴 시트는 S3e에서 제거) |
| ConfirmDialog | Complex | BottomSheet 안 2버튼 확인(파괴 조작) | 메시지·방 삭제 (재작성은 confirm 없음) |
| TextArea | Primitive | 자동 높이, `Enter` 전송/`Shift+Enter` 줄바꿈 옵션, maxLength 표시 | chat 입력창·인라인 수정·메모리 편집 |
| Toggle | Primitive | OOC on/off | chat 하단 바 |
| ListRow | Primitive | 제목·부제·날짜 한 행(탭/Enter 진입, 롱프레스 메뉴 없음) | rooms |
| useAutoScroll | hook | 맨 아래 근접 판정·자동 스크롤·위치 보존 | chat 히스토리 |
| cx | util | 클래스 조합 | 전부 |
| formatDate | util | `MM.DD`·`HH:mm` 표기 | rooms·chat |

- 비고(S3e): 말풍선 아래 「수정」「삭제」「재작성」 버튼 줄은 **`BubbleActions`(`ui/src/chat/components/BubbleActions.tsx`, chat 지역 컴포넌트)**가 맡는다. 공용 `Button size='sm' variant='ghost'` 3개를 조립한 것이라 **공용 카탈로그 등록 대상이 아니다**(승격 후보도 아님). 글자색 톤 prop 부재는 `component-usage-lessons`에 코어 결함 후보(Button ghost `tone`)로 남아 있다(후작업 보류: BubbleActions 테스트가 `.danger` 래퍼를 단언). `MessageMenuSheet`는 S3e에서 삭제됐다.

## 변경 이력

| 날짜 | 변경 | 주체 |
|---|---|---|
| 2026-10-05 | 초판(빈 인벤토리 + 미구현 후보) | 자산 변환 |
| 2026-10-07 | S3e 반영: useLongPress 사용처 0(정리 후보), 메시지 메뉴 시트 제거, BubbleActions 비고(chat 지역) | 메인 세션 대행(문서 배치) |
| 2026-10-07 | 후작업: useLongPress 삭제(S3e, 사용처 0), Button `ariaDescribedBy` 추가 | ui-postprocessor |
