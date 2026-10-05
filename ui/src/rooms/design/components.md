# rooms 상세 설계 — 컴포넌트·스타일 (분할 문서)

> 주 문서: `ui/src/rooms/design.md`(RTM 포함). 이 파일은 주 문서 §3의 상세다.
> 이 파일 §1은 두 화면이 함께 쓰는 공용 요소의 **단일 정의**다. chat 설계(`ui/src/chat/design/components.md` §1)는 이 값을 그대로 인용한다.

---

## 1. 공용 요소 Props·시그니처 (단일 정의)

### 1.1 TopBar (`ui/src/components/ui/TopBar/`)

```ts
export type TopBarProps = {
  title: string                 // 한 줄 말줄임. <h1 tabIndex={-1}> 로 렌더
  subtitle?: { text: string; dateTime: string; ariaLabel: string }  // 오른쪽 작은 날짜. <time>
  left?: ReactNode              // 뒤로 버튼 자리
  right?: ReactNode             // 메뉴·새 방 버튼 자리
  titleRef?: Ref<HTMLHeadingElement>  // 포커스 이동용
  variant?: 'screen' | 'room'   // 기본 'screen'
}
```
- 렌더: `<header>` 44px. `left` → `title`(flex 1, ellipsis) → `subtitle` → `right` 순서. 값이 없는 슬롯은 렌더하지 않는다.
- `variant='screen'`: 제목 serif xl(18px), uppercase, `letter-spacing: .08em`, `--color-accent`(rooms `ROOMS`). `variant='room'`: 제목 serif lg(16px) `--color-fg`(chat 방 제목).
- 배경 `--color-bg`, 아래 1px `--color-border`.
- 폭 ≤ 360이면 `subtitle`을 CSS로 감춘다(구성안 §4. 날짜는 부가 정보라 정보 손실이 아니다).

### 1.2 Button (`ui/src/components/ui/Button/`)

```ts
export type ButtonProps = {
  children: ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'   // 기본 'secondary'
  size?: 'sm' | 'md' | 'lg'                               // 기본 'md'
  isDisabled?: boolean                                    // 기본 false
  ariaLabel?: string                                      // 보이는 글자와 다를 때만
}
```
- 렌더: `<button type="button">`. `isDisabled`면 `disabled`. 높이 sm 28 / md 36 / lg 44. 터치 영역 44 미만이면 padding으로 확보(ui_design_concept §6).
- S1 사용처: StateView 「다시 시도」(md secondary), chat B0 「다시 시도」(sm secondary), chat 새 메시지 배지(sm primary).

### 1.3 IconButton (`ui/src/components/ui/IconButton/`)

```ts
export type IconButtonProps = {
  icon: 'back'                 // S1 은 'back' 하나. S2 에서 'more' 추가
  ariaLabel: string            // 필수
  onClick: () => void
  buttonRef?: Ref<HTMLButtonElement>
}
```
- 렌더: `<button type="button" aria-label>` 안에 인라인 SVG(stroke 1.25, `aria-hidden="true"`). 44×44 터치 영역, ghost 톤.

### 1.4 StateView (`ui/src/components/ui/StateView/`)

```ts
export type StateViewProps = {
  kind: 'loading' | 'empty' | 'error'
  message: string               // 한 줄 제목
  detail?: string               // error 상세 한 줄
  actionLabel?: string          // error 버튼 글자
  onAction?: () => void
}
```
- 렌더: 영역 가운데 블록. `loading`·`empty` → `role="status"`, `error` → `role="alert"`. `actionLabel`과 `onAction`이 **둘 다** 있을 때만 `Button`(md secondary).
- message md `--color-fg-muted`, detail sm(`--font-ui`). 위아래 `--space-5`.

### 1.5 cx (`ui/src/components/utils/cx.ts`)

```ts
export const cx = (...names: ReadonlyArray<string | false | null | undefined>): string
```
- 거짓 값을 빼고 공백으로 잇는다.

### 1.6 formatDate (`ui/src/components/utils/formatDate.ts`)

```ts
export const formatMonthDay = (epochMs: number): string   // 'MM.DD'  예: 10.05
export const formatTime = (epochMs: number): string       // 'HH:mm'  예: 16:40 (24시간)
export const toIsoDate = (epochMs: number): string        // 'YYYY-MM-DD'
export const toIsoDateTime = (epochMs: number): string    // 'YYYY-MM-DDTHH:mm'
```
- 브라우저 **로컬 시간대**의 `Date` 게터로 만들고 두 자리 0 채움. 외부 라이브러리 없음.
- 테스트 입력은 `new Date(2026, 9, 5, 16, 40).getTime()`처럼 로컬 생성자로 만들어 시간대에 의존하지 않는다.

### 1.7 storage (`ui/src/components/utils/storage.ts`) — localStorage 단일 접근 지점

비유: 책갈피 서랍. 서랍이 잠겨 있어도(사생활 모드·iframe 저장 차단) 열람은 계속된다. 서랍을 여는 손은 이 파일 하나뿐이다.

```ts
export const STORAGE_KEYS = {
  lastRoomId: 'ld:lastRoomId',
  scrollOffset: (roomId: string) => `ld:scroll:${roomId}`,
} as const

export const loadLastRoomId = (): string | null
export const saveLastRoomId = (roomId: string): void
export const clearLastRoomId = (): void
export const loadScrollOffset = (roomId: string): number | null
export const saveScrollOffset = (roomId: string, distanceFromBottom: number): void
```
- 모든 함수는 `window.localStorage` 접근 전체를 `try/catch`로 감싼다. 읽기 실패·값 없음 → `null`. 쓰기·삭제 실패 → 조용히 무시(throw 없음, 로그 없음).
- `loadLastRoomId`: 빈 문자열이면 `null`.
- `loadScrollOffset`: `Number()` 결과가 0 이상 유한수가 아니면 `null`.
- `saveScrollOffset`: `Math.max(0, Math.round(distanceFromBottom))`를 문자열로 저장.
- **토큰은 어떤 키로도 저장하지 않는다**(R-API-003·R-CHAT-009, 확정사항 §5.2). 토큰 관련 키를 두지 않는다.
- 다른 파일에서 `localStorage`·`sessionStorage`를 직접 쓰지 않는다(리뷰 grep 대상).

### 1.8 viewer (`ui/src/state/viewer.ts`)

```ts
export type Viewer = { readonly canWrite: boolean }
export const READ_ONLY_VIEWER: Viewer = { canWrite: false }
```
- S1은 토큰을 읽지 않으므로 `App`은 항상 `READ_ONLY_VIEWER`를 내려준다. S2에서 토큰 상태(`ui/src/state/token.ts`, `doc/state.json` 결정)로 `canWrite`를 계산하도록 바뀐다. 화면은 `viewer.canWrite`만 본다.

### 1.9 공통 파일 규칙

- 공용 컴포넌트 폴더: `{Name}.tsx` · `{Name}.module.css` · `{Name}.test.tsx` · `index.ts`(재노출). 구현 후 ui-component-implementer가 `component-catalog`에 등록한다.
- 공용 컴포넌트는 문구를 갖지 않는다. 모든 문구는 화면 `labels.ts`에서 props로 받는다.

---

## 2. rooms 로컬 컴포넌트

### 2.1 ListRow (`ui/src/rooms/components/ListRow.tsx`) — 공용 승격 후보

```ts
export type ListRowProps = {
  title: string
  dateText: string             // 'MM.DD'
  dateTime: string             // 'YYYY-MM-DD'
  ariaLabel: string            // labels.rowAriaLabel(title, dateText)
  onSelect: () => void
}
```
- 렌더: `<button type="button" aria-label={ariaLabel}>` 한 개가 행 전체(56px). 안: 제목(md serif, 한 줄 말줄임) + `<time dateTime>`(xs muted, 오른쪽).
- hover·active `--row-hover-bg`, 아래 1px `--row-divider`.
- 키보드: 버튼이라 Tab 포커스, Enter·Space → `onSelect`.
- 롱프레스 메뉴 없음(구성안 §5 미채택 확정).

### 2.2 RoomList (`ui/src/rooms/components/RoomList.tsx`)

```ts
export type RoomListProps = {
  rooms: readonly RoomSummary[]
  onSelect: (room: RoomSummary) => void
}
```
- 렌더: `<ul>`(aria-label 없음. 화면 루트 `<main aria-label="방 목록">`과 이름이 겹치지 않게 한다) → 방마다 `<li key={room.id}><ListRow …/></li>`. 순서는 받은 배열 그대로(서버가 `updatedAt` 내림차순 보장, 화면은 다시 정렬하지 않는다 — api.md §4.2).
- `dateText = formatMonthDay(room.updatedAt)`, `dateTime = toIsoDate(room.updatedAt)`(R-ROOMS-001 마지막 갱신 날짜).

---

## 3. 스타일 토큰

| 대상 | 토큰(`.claude/skills/ui_design_concept.md`) |
|---|---|
| 화면 배경 | `--color-bg` |
| 상단 바 아래선·행 구분선 | `--color-border` · `--row-divider` |
| 행 제목 | serif md(14px) `--color-fg` |
| 행 날짜 | `--font-ui` xs(11px) `--color-fg-muted`, `tabular-nums` |
| 행 hover·active | `--row-hover-bg` |
| 간격 | 행 좌우 `--space-4`, 상태 블록 위아래 `--space-5` |
| 포커스 링 | `:focus-visible` 2px `--color-focus` 바깥 |
| 컴포넌트 변수 값(ui_design_concept §3은 접두사만 정함) | `--row-hover-bg: var(--color-bg-elevated)` · `--row-divider: var(--color-border)` — `global.css` `:root`에 정의 |
| 파일 | `ui/src/rooms/styles/RoomsScreen.module.css`, 컴포넌트별 `{Name}.module.css`. 하드코딩 색 금지 |

- 전역 `ui/src/styles/global.css`(하나뿐): 리셋, `html, body, #root { height: 100% }`, ui_design_concept §3 색·§4 타이포·§5 간격·§6 반경 토큰, `prefers-reduced-motion`.
- Noto Serif KR은 `ui/index.html`의 `<link rel="preconnect">` + `<link>`로 불러온다. 폴백 serif.
- Vite `base: '/embed/'`(api.md §7). 정적 파일은 `ui/public/`.
