---
name: ui-design-strategy
description: 런던_디스패치 화면(ui 계층, React+TypeScript, 390px iframe) 개발 표준. 화면 폴더 구조(ui/src/rooms·ui/src/chat)와 문서 4종(requirements.md·design.md·manual.md·test/scenarios.md), 문서↔소스 양방향 일치, 요구 추적 매트릭스(RTM)·요구 범위 준수·구현 충분성 체크리스트, 컴포넌트 재사용 우선순위, 데이터 계층 경계(ui/src/api 래퍼만 호출, fetch 직접 사용 금지, 계약 변경은 contract 인계), 대화 화면 특수 규칙(390×565·토큰 분기 미렌더·생성 중 상태·페이지네이션·자동 스크롤·말풍선 액션 버튼·토큰 메모리 보관), 방 목록 규칙, 캐릭터 설정 화면(주인 전용) 규칙, TDD 원칙, 스타일(CSS Modules), 파괴 조작 confirm을 정의한다. 화면을 설계·구현·검토할 때 반드시 참조한다.
---

# ui 계층 개발 표준

- 단일 기준: `doc/000_프로젝트_확정사항.md`(제품 동작·권한·화면 규격·API 요약·계층 위상). 이 스킬은 그 위에서 **화면을 어떻게 만들 것인가**만 정한다.
- 적용 대상: ui-manager · ui-layout-designer · ui-designer · ui-design-checker · ui-test-designer · ui-test-checker · ui-test-conflict-checker · ui-implementer · ui-tester · ui-fixer · ui-debug · ui-error-analyst · ui-postprocessor · ui-manual-writer · ui-component-designer · ui-component-implementer.
- 화면은 셋이다: **rooms**(방 목록) · **chat**(대화) · **settings**(캐릭터 설정, S3c — 갠홈 주인 전용. 토큰 `mbId`가 `OWNER_MB_IDS`에 있을 때만 진입, rooms 상단 ⚙에서 연다. 진입 시 `getCharacterSettings` 1회 탐침으로 주인 판정, `OWNER_ONLY`면 안내 후 되돌아간다). 셋은 한 SPA 안의 뷰이고 `ui/src/App.tsx`가 내부 상태(`{ screen: 'rooms' } | { screen: 'chat', room } | { screen: 'settings' }`)로 분기한다. `ui/src/main.tsx`는 App만 렌더한다(라우터 라이브러리 없음, URL은 `?t=`만 읽는다).
- 이 화면은 **저쪽 패널(390×640, 헤더 75px) 안의 iframe**에서만 산다. 독립 페이지로 보일 일은 없다.

---

## 1. 화면 폴더 표준 구조

### 1.1 폴더

```
ui/src/{screen}/                   screen ∈ { rooms, chat, settings }
├─ index.tsx                       화면 진입 컴포넌트(조립·상태·핸들러만 — 얇게)
├─ components/                     화면 로컬 컴포넌트 (다른 화면에서 쓰지 않는 것)
├─ labels.ts                       확정 문구·aria-label의 단일 소스
├─ styles/                         CSS Modules (*.module.css)
├─ requirements.md                 요구 baseline (요구ID R-xx, 확정 상태)
├─ design.md                       상세 설계 (RTM 포함)
├─ manual.md                       사용 매뉴얼 (스크린샷 포함)
├─ screenshots/                    manual·테스트 증거 이미지
└─ test/
   ├─ scenarios.md                 BDD 시나리오 (TC-ID, 추적표, TC-FLOW)
   ├─ manual-checklist.md          자동화 불가 항목 수동 확인표
   ├─ *.test.tsx / *.test.ts       vitest 스펙
   ├─ change-requests.md           CR 대장 (보강 모드에서 첫 기록 시 생성)
   └─ result.md                    최근 실행 결과 (ui-tester가 기록)
```

- 공용 컴포넌트는 `ui/src/components/{ui,hooks,utils}/`, 대화·토큰 상태는 `ui/src/state/`, api 래퍼는 `ui/src/api/`(contract 소유). 화면 폴더 안에서 이들을 **import만** 한다.
- 화면 폴더 밖 수정(공용 컴포넌트·state)은 **사용자 확인 후**에만. `ui/src/api/`는 ui 에이전트가 쓰지 않는다(contract 인계).

### 1.2 문서 규칙

- 문서는 **마크다운**. 한국어. 자기완결형(다른 문서를 읽지 않아도 그 문서의 목적을 달성).
- 표는 GFM 표, 레이아웃은 ASCII 코드 블록. ASCII 정렬 불변식: 한글·전각은 2칸, ASCII·박스 문자는 1칸, 이모지 금지, 박스 안 모든 줄의 표시폭 동일. 폭은 **390px 기준 약 48칸**으로 그린다.
- `design.md`가 40KB를 넘으면 `design/components.md` · `design/functions.md` · `design/a11y.md`로 분할한다. **RTM은 항상 `design.md` 본문**에 둔다.
- 문서 4종의 소유자: requirements·design = ui-designer, scenarios = ui-test-designer, manual = ui-manual-writer. 소유자 외 수정 금지(CR 대장·result.md·lessons 카탈로그는 기록물 예외).

### 1.3 requirements.md 필수 섹션

1. 헤더: 화면명 · 요구 확정 상태(`미확정` / `확정`) · 확정일 · 변경이력
2. **요구 목록**: `R-ROOMS-001`/`R-CHAT-001`… 안정 ID. 원문 그대로 전사(재해석·추가·삭제 금지). 사용자가 확정한 항목은 🔒 표기.
3. **사용자·이용 시나리오 명세**: `대상 사용자(방문자 / 등급 통과 회원) × 상황 × 사용 기능` 표. 모든 요구ID가 ≥1행에 매핑. **토큰 유무 두 경우를 반드시 분리**한다.
4. **데이터 계약 요구 명세**: 이 화면이 필요로 하는 엔드포인트 목록(경로·입력·출력·재사용/신규). 계약의 실체는 `doc/200_설계/contract/api.md`가 소유한다.
5. **확보한 기술 기능**: 필요한 라이브러리와 설치 승인 여부.

### 1.4 design.md 필수 섹션

1. 개요 · 레이아웃 확정 상태 · 변경이력
2. **레이아웃(ASCII)** — ui-layout-designer 구성안을 수용해 확정 표기. 토큰 있음/없음 두 판
3. **컴포넌트 설계** — 배치 3단계 분류(§4) · 각 컴포넌트의 출처·props·이벤트
4. **상태** — 상태명 · 용도 · 타입 · **초기값** · 소유(로컬/`ui/src/state`)
5. **기능 명세** — function 단위: 시그니처 · 입력 · 출력(반환/상태 변경) · 동작 · 예외 · 관련 요구ID
6. **파이프라인** — 정상 흐름 · 오류 흐름(각 에러 코드별 표시) · 파괴 조작 confirm · 생성 중 상태
7. **api 계약 사용표** — 엔드포인트 · 래퍼 함수 · 요청/응답 타입(`shared/src/types.ts` 기준) · 호출 위치 · 에러 코드별 처리
8. **확정 문구·라벨 표** — 사용자에게 보이는 모든 문구·aria-label. `labels.ts`로 전사되는 단일 소스
9. **접근성** — 포커스 순서 · 키보드 조작 · 라벨 · 상태 알림(`aria-live`)
10. **RTM** — 요구ID → 설계 섹션 → 계약 → 예정 TC → 상태(✅/부분/❌)
11. (chat만) **스크롤·페이지네이션·낙관적 갱신 명세** — §6

---

## 2. 문서↔소스 양방향 일치

- 설계 없는 소스 없음, 소스 없는 설계 없음. `design.md`에 적힌 컴포넌트·상태·function·계약은 소스에 존재해야 하고, 소스에 추가된 것은 `design.md`에 반영돼야 한다.
- 소스를 바꾼 주체(ui-implementer·ui-fixer·ui-debug·메인 세션)는 같은 패스에 CR 대장(`change-request-tracking` 스킬)에 엔트리를 남긴다. design 델타는 ui-designer(동기화 모드) 또는 `/doc-sync` 배치가 닫는다.
- 문서가 영구 미동기화되는 것은 금지. 지연은 허용하되 `/doc-sync`에서 반드시 닫는다.

---

## 3. 요구 추적 · 요구 범위 · 구현 충분성

### 3.1 RTM (요구 추적 매트릭스)

| 요구ID | 설계 섹션 | api 계약 | 예정 TC | 상태 |
|---|---|---|---|---|

- `requirements.md`의 **모든** 요구ID가 행으로 존재. `✅`는 가리킨 섹션에 **실체**가 있어야 한다(제목만 있는 행은 허위 커버 = 결함).
- `부분`/`❌`가 하나라도 있으면 설계 미완.

### 3.2 요구 범위 준수 (과잉 금지)

- design.md의 모든 버튼·필드·영역·기능·상태는 요구ID로 **역추적**되어야 한다. 역추적 실패 = 과잉 = 결함.
- 예외는 채택한 레이아웃 패턴의 기본 요소뿐(예: 대화형의 뒤로 버튼·입력바). 요구와 무관한 별도 기능(테마 전환·이모지 피커·검색·내보내기 등)은 예외가 아니다.
- 필요해 보이면 직접 넣지 말고 「추가 후보(이유)」로 보고 → 사용자 승인 시 requirements.md에 새 요구ID로 승격한 뒤에만 설계.

### 3.3 구현 충분성 체크리스트 (9항목)

"ui-implementer가 이 문서만 읽고 추측 없이 만들 수 있는가"의 기준. `미정(확인 필요)`은 그대로 미충족이다.

| # | 항목 | 채워야 하는 것 |
|---|---|---|
| 1 | 컴포넌트 출처·props | 공용(`ui/src/components/ui`)인지 로컬인지, 필수 props·이벤트 |
| 2 | 상태 초기값 | 모든 상태의 타입·초기값·소유 위치. 토큰 상태 포함 |
| 3 | function 시그니처 | 이름·인자·반환·예외·부작용(상태 변경·api 호출) |
| 4 | api 계약 인자·반환·에러 | 래퍼 이름·입력 타입·출력 타입·**에러 코드별** 사용자 표시 |
| 5 | 파이프라인 정상·오류 | 각 기능의 정상 흐름과 실패 분기(무엇을 보여주고 어디로 돌아가는가). 생성 중·재시도 포함 |
| 6 | 라벨 단일 소스 | 확정 문구·aria-label 표가 완결되어 `labels.ts`로 전사 가능 |
| 7 | 접근성 | 포커스 순서·키보드 조작·역할(role)·상태 알림 |
| 8 | 진입 분기 등록 | `ui/src/App.tsx`의 뷰 분기(방 미선택 → rooms, 선택 → chat)에 이 화면이 등록되는가 |
| 9 | 라이브러리 설치 확인 | 필요한 라이브러리가 `ui/package.json`에 있는가, 없으면 승인 여부 |

### 3.4 독립 검증 전제

- `design.md`는 작성 직후 ui-design-checker가 **문서만 보고** 검증한다. 설계자의 설명은 전달되지 않는다. "말로 하면 통하는" 설계는 FAIL.
- 검증자(checker·tester·reviewer)에게는 「적용 메모리」를 전달하지 않는다.

---

## 4. 컴포넌트 재사용 우선순위

```
① ui/src/components/ui      공용 UI (버튼·입력·말풍선·시트·확인 대화상자 …)
② ui/src/components/hooks   공용 훅 (useLongPress·useAutoScroll·useViewer …)
③ ui/src/components/utils   공용 유틸 (cx·날짜 표기·커서 계산 …)
④ 화면 로컬 components/     이 화면 전용
⑤ 외부 라이브러리           사용자 승인 후에만 설치
```

- 배치 3단계 분류: 공용 ui → 화면 로컬 → (여러 화면 재발 시) 공용 승격 후보. 승격은 ui-postprocessor 옵트인 흐름으로만.
- 표준 HTML 원소를 화면 코드에 직접 쓰지 않는다(`<button>` → `Button`, `<textarea>` → `TextArea`). 공용에 없으면 로컬 컴포넌트로 감싸고 승격 후보로 표시.
- 컴포넌트 계약은 `component-catalog` 스킬, 알려진 오용은 `component-usage-lessons` 스킬을 구현 전에 조회한다.
- 같은 패턴 3회 이상 반복 → 추출. TSX 파일 400줄 초과 → 분리(golden-principles).

---

## 5. 데이터 계층 경계 (contract)

- 화면은 **`ui/src/api/` 래퍼만** 호출한다. `fetch`·`XMLHttpRequest`를 화면·컴포넌트·state에서 직접 쓰지 않는다.
- 래퍼 예: `api/rooms.ts`(`listRooms()`, `createRoom(title)`, `renameRoom(id, title)`, `deleteRoom(id)`), `api/messages.ts`(`listMessages(roomId, before?)`, `appendUser(roomId, text, ooc)`, `speak(roomId, character)`, `editMessage(id, text)`, `deleteMessage(id)`, `regenerate(id)`), `api/memory.ts`, `api/client.ts`(토큰 보관·헤더). 전부 `Result<T>`를 반환하고 throw하지 않는다.
- 계약의 단일 소스는 `doc/200_설계/contract/api.md`. design.md의 계약 사용표는 이를 **인용**한다(재정의 금지).
- 필요한 엔드포인트가 계약에 없으면: 화면 설계는 `미확정 계약(contract 인계 필요)`로 표기 → ui-manager가 **contract 요구 명세**를 만들어 사용자 보고 → 허락 후 contract-manager 세션 인계. 계약 확정 전 구현 금지.
  - 예외: 사용자가 "한 번에 생성"을 옵트인하면 잠정 계약으로 래퍼 시그니처를 정하고 mock으로 구현·테스트를 진행한다. 코드에 `// TODO(contract): {엔드포인트} — 계약 확정 필요` 표기 필수.
- 테스트에서 api는 항상 mock(`vi.mock('@/api/messages')`). 실제 서버에 의존하는 단위 테스트 금지.
- **토큰은 화면이 만지지 않는다.** `api/client.ts`가 `location.search`의 `t`를 1회 읽어 메모리에 보관한다. 화면은 `viewer.canWrite`(래퍼가 주는 불린)만 본다. `localStorage`·쿠키 저장 금지.

---

## 6. 대화 화면(chat) 특수 규칙

### 6.1 크기·배치 (확정사항 §5.1)

- 가용 영역 **390×약565**(패널 640 − 저쪽 헤더 75). 세로는 `100%` flex로 채우고 고정 px를 쓰지 않는다(모바일은 패널이 가로 전체).
- 3단: 상단 바(뒤로·방제·날짜·⋯) / 히스토리(스크롤 영역, `flex: 1; min-height: 0`) / 하단 바(캐릭터 버튼 2 + OOC 토글 + 입력창 + 전송).
- 가로 스크롤 금지. 긴 단어는 `overflow-wrap: anywhere`.

### 6.2 토큰 분기 — 미렌더

- `viewer.canWrite === false`면 하단 바 전체·⋯ 메뉴·말풍선 액션 버튼 줄을 **렌더하지 않는다**(`display:none`·`disabled` 금지 — DOM에 없어야 한다). 히스토리 하단에 한 줄 안내(`labels.readOnlyNotice`)만.
- `canWrite`는 앱 기동 시 1회 결정되고 쓰기 가능 → 읽기 전용 한 방향으로만 바뀐다. 쓰기 요청이 `TOKEN_REQUIRED`·`TOKEN_INVALID`(만료 포함)·`LEVEL_TOO_LOW`를 받으면 토큰을 버리고 안내 1회 + 쓰기 UI DOM 제거로 전환한다(api.md v0.3 §2 `isAuthFailure`). `RATE_LIMITED`는 안내만(`retryAfterSec`).

### 6.3 생성 중 상태

- 캐릭터 버튼 클릭(또는 전송 — S3d부터 전송은 저장 + 자동 응답) → 즉시 임시 말풍선(`PendingBubble`, `role="status"`; 캐릭터 지정이면 그 캐릭터 판, 자동 응답이면 중립 "…" 판) 추가 + 캐릭터 버튼 2개·전송·재작성·인라인 수정 저장 **잠금**(네이티브 `disabled`). 입력창은 타이핑 허용(전송만 잠금). 버튼 묶음 `aria-busy`는 쓰지 않는다(S3 결정 D-16 ②).
- 성공 → 임시 말풍선을 응답 메시지로 교체. 실패 → 임시 말풍선 자리에 **실패 말풍선**(코드별 `labels.errors[code]`) + 「재시도」 버튼. **`409 SPEAK_IN_PROGRESS`도 같은 실패 말풍선 + 「재시도」**다 — "3초 뒤 자동 해제" 같은 화면 타이머는 두지 않는다(R-CHAT-005 🔒·R-CHAT-011, D-16 ①). `CONFIG_INVALID`도 「재시도」 유지(승인 ②(S3) ①).
- 재작성은 별도 임시 말풍선을 만들지 않는다. **대상 말풍선을 흐리게** + `다시 쓰는 중…` 표시로 진행을 보이고, 응답이 오면 같은 id 자리에서 교체한다(api.md §4.14, D-16 ③).
- 화면 타이머 없음: 서버가 70초 안에 끝낸다는 계약(R-NFR-001)을 믿는다. 래퍼 타임아웃을 두면 75초 이상(api.md §4.12).
- 중복 클릭 방지는 상태 기반(리듀서 `pending` + 쓰기 팻말 `useWriteGate`)으로. `setTimeout` 디바운스로 때우지 않는다.

### 6.4 페이지네이션·스크롤

- 첫 로드: `listMessages(roomId)` 최신 30개(limit 미지정 = 계약 기본값, R-MSG-001) → 렌더 후 **맨 아래로** 즉시 스크롤(애니메이션 없음). 다음 페이지는 `hasMore`가 true일 때 `before = messages[0].id`.
- 위로 스크롤해 상단 80px 이내 진입 → `listMessages(roomId, nextBefore)` → 앞에 붙이고 **스크롤 위치 보존**(이전 `scrollHeight` 차이만큼 보정). `nextBefore === null`이면 더 요청하지 않는다.
- 새 메시지 추가 시: 사용자가 맨 아래 근처(≤ 120px)에 있었을 때만 자동 스크롤. 위에 있었으면 「새 메시지 ↓」 배지.
- 스크롤 상태·마지막 본 방은 `localStorage`에 try/catch로 저장. 없거나 실패해도 동작은 같다.

### 6.5 말풍선 액션 버튼 (수정·재작성·삭제)

- **S3e(2026-10-07, R-CHAT-007 🔒 개정)부터 chat은 말풍선 아래 항상 보이는 액션 버튼 줄(`BubbleActions`, chat 지역 컴포넌트)로 한다. 롱프레스/우클릭/`Shift+F10` 바텀시트 메뉴는 없다.** 옛 규칙(롱프레스 500ms → S1 시트)은 chat에 적용하지 않는다(actions.md D-24·D-29).
- 버튼: 모든 메시지에 「수정」「삭제」, **마지막 캐릭터 메시지**에만 「재작성」이 DOM에 더 있다(조건 안 맞으면 미렌더, 비활성이 아님). 형태는 공용 `Button size='sm' variant='ghost'` 3개, 글자색만 지역 CSS 덧칠(D-25).
- 토큰 있을 때만 렌더(§6.2). 잠금은 `isActionLocked = !canSpeak(state) || roomBusy !== null`(쓰기 대기·생성 중·인라인 수정 중·방 이름 변경·삭제 중) → 네이티브 `disabled`(D-27). 버튼 줄은 `Bubble` 안이 아니라 `MessageItem`에서 `Bubble`의 형제로 둔다(D-28 — Bubble은 `memo` 격리 유지).
- 수정은 말풍선 자리에서 인라인 textarea → 저장/취소. 편집기가 닫히면 포커스는 같은 말풍선의 「수정」으로(D-26). 삭제는 confirm(§11, S1 확인 시트 유지). 재작성은 confirm 없음.
- 낙관적 갱신 금지 — 응답을 받은 뒤 반영한다(서버가 단일 진실).

### 6.6 상태 소유 (`ui/src/state/`)

- 대화 상태(`messages`, `nextBefore`, `pending`, `error`)는 순수 리듀서 `chatReducer`로 `ui/src/state/chat.ts`에 둔다. React·DOM 의존 금지, 시간은 인자로 주입. 전이표 각 행에 vitest ≥1.
- 뷰어 상태(`canWrite`, `displayName`)는 `ui/src/state/viewer.ts`(읽기 전용 값).
- 컴포넌트 안에 전이 규칙(잠금 해제 조건·커서 갱신)을 다시 쓰지 않는다.

### 6.7 접근성

- 캐릭터 버튼은 `aria-label`(`labels.speakAs.sebastian`), 생성 중은 네이티브 `disabled` + 임시 말풍선 `role="status"`(§6.3). 히스토리 컨테이너 `role="log" aria-live="polite"`.
- 입력창 `Enter` 전송 / `Shift+Enter` 줄바꿈. `Esc`는 시트·인라인 수정 닫기. 말풍선 액션은 Tab으로 닿는 버튼이라 별도 메뉴 키가 없다(S3e).
- 포커스 순서: 뒤로 → ⋯ → 히스토리 → 캐릭터 버튼 → OOC → 입력창 → 전송.

---

## 7. 방 목록 화면(rooms) 규칙

- 목록은 `updatedAt` 내림차순. 각 행: 제목 · 날짜(`MM.DD`) · 마지막 발화 한 줄(있으면). 탭/Enter로 진입.
- 「+ 새 방」은 `canWrite`일 때만 렌더. 제목 입력은 인라인(기본값 날짜) → 생성 후 바로 chat 진입.
- 이름 변경·삭제는 방 목록 행이 아니라 대화 화면의 ⋯ 메뉴 시트에서 한다(구성안 미채택: 행 롱프레스 메뉴, R-CHAT-001). 삭제는 confirm.
- 빈 목록: `labels.rooms.empty` 한 줄 + (canWrite면) 새 방 유도.
- 로딩·오류: 순서 error → loading → data → empty(tsx-rules).
- 상단 ⚙(캐릭터 설정 진입, R-SET-009)은 「+ 새 방」 왼쪽, `canWrite`일 때만 렌더. 주인 여부는 설정 화면 진입 시 `getCharacterSettings` 1회로 판정한다(rooms는 판정 결과를 들고 있지 않는다).

### 7.1 캐릭터 설정 화면(settings, S3c — 갠홈 주인 전용)

- 요구 R-SET-001~012. 탭 셋(공통 세계관 · 세바스찬 · 시엘), 처음 탭은 공통 세계관. 저장은 `putCharacterSettings`(D1), 내보내기/가져오기는 상단 ⋯ 「설정 파일」 메뉴 시트(S1). 비밀값(API 키 등)은 어떤 파일에도 들어가지 않는다.
- 입력 검사의 단일 소스는 shared `checkCharacterSettings`(contract 소유). 화면은 문구를 따로 조립하지 않고 첫 위반 `message`를 보인다.
- `OWNER_ONLY`(403)·인증 실패면 안내 후 rooms로 되돌아간다. 주인이 아닌 토큰에는 설정 UI가 DOM에 없다(§6.2와 같은 미렌더 원칙).
- 상세는 `ui/src/settings/design.md`·`design/*`와 `doc/200_설계/architecture/` S3c 문서.

---

## 8. 레이아웃 패턴

- 패턴 카탈로그와 선택 가이드는 `layout-templates` 스킬(L1 목록형 · C1 대화형 · S1 바텀시트 · M1 메모리 편집). 레이아웃 선정·다듬기·풀 관리는 ui-layout-designer 단독.
- 재사용 풀: `.claude/skills/layout-pool/SKILL.md`(있으면). 사용자 승인 후에만 저장.

---

## 9. TDD 원칙

- **테스트 스펙 없는 구현 금지.** 순서: design.md 확정 → `test/scenarios.md` + vitest 스펙 초안 → ui-test-checker·ui-test-conflict-checker PASS → 구현 → 실행.
- 커버 기준 세 축: ① design.md 모든 항목(컴포넌트·function·상태·계약·파이프라인·접근성·스크롤) → TC ≥1 ② 모든 요구ID → TC ≥1 ③ 사용자·이용 시나리오 모든 행(토큰 있음/없음 각각) → `TC-FLOW` ≥1.
- 기대 결과는 **3단**(화면에 보이는 것 · 상태/저장 값 · api 호출 인자)으로 쓴다. "정상 동작한다"는 기대가 아니다.
- 자동화 불가(실제 iframe 안 표시·저쪽 패널과의 높이 맞춤·실제 LLM 응답·모바일 터치 영역 실측)는 `test/manual-checklist.md`에 수동 항목으로 분리한다. 리듀서·컴포넌트는 vitest로 100% 자동화.
- 보강(maintain) 모드에서는 변경에 걸리는 TC만 돌린다. 전건은 `/doc-sync`·verify-manager.
- 실행 증거(`test/result.md`: 일자·명령·PASS/FAIL 수·실패 사유·스크린샷 경로) 없는 완료 보고 금지.

---

## 10. 스타일

- **CSS Modules(`*.module.css`)** 기본. 전역 스타일은 `ui/src/styles/global.css` 하나(리셋·토큰·폰트).
- 색·간격·타이포·컴포넌트 시각 규칙은 `ui_design_concept.md`(스킬 루트) 참조. 코드 규칙은 `ts-rules.md`·`tsx-rules.md`.
- 배경은 저쪽 패널(남색 반투명)과 이어지게 **불투명 남색 계열**. iframe 자체 테두리·그림자 없음.
- 폰트는 Google Fonts Noto Serif KR을 `global.css`에서 `<link>` 대신 `@import`하지 않고 `index.html` `<link rel="preconnect">` + `<link>`로(FOUT 최소화). 폴백은 시스템 serif.

---

## 11. 파괴 조작 confirm

| 조작 | confirm | 문구 위치 |
|---|---|---|
| 메시지 삭제 | 필수 | labels.ts |
| 방 삭제 | 필수 (메시지·장기기억 함께 삭제됨 명시, 되돌릴 수 없음) | labels.ts |
| 재작성 | 불필요 (R-CHAT-007 🔒: 마지막 캐릭터 메시지만 대상, 액션 버튼 「재작성」으로 confirm 없이 즉시. 대상 말풍선을 흐리게 해 진행을 보임, §6.3) | — |
| 장기기억 직접 편집 저장 | 불필요 | — |
| 수정 취소 | 불필요 | — |

- confirm 컴포넌트는 공용 `ConfirmDialog`(바텀시트 안 2버튼). 브라우저 `window.confirm` 금지(iframe 안에서 모양·포커스가 깨진다).

---

## 12. 후작업·문서 동기화 진입 조건

- **후작업(ui-postprocessor)**: 사용자가 명시적으로 요청할 때만. 미리보기 → 승인 → 적용. 대상: 공용 승격·유틸 추출·400줄 초과 분리·미사용 코드 제거·포맷. 후작업으로 바뀐 소스는 ui-designer 동기화 모드로 design.md에 반영.
- **문서 동기화(`/doc-sync`)**: 마지막 동기화 이후 수정된 기존 화면을 git history로 찾아 requirements·scenarios·manual을 소유자에게 위임하고 design 델타 누락을 대조·backfill한 뒤 전건 테스트.
- **CR 대장**: 보강 모드의 모든 화면 변경은 `change-request-tracking` 스킬을 따른다.
