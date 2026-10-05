# chat 상세 설계 — 컴포넌트·훅·스타일 (분할 문서)

> 주 문서: `ui/src/chat/design.md`(RTM 포함). 이 파일은 주 문서 §3·§11의 상세다.
> **export 규칙(공통, v1.3):** 모든 컴포넌트·훅·순수 함수는 **named export**만 쓴다. `export default` 금지. 대상: `ChatScreen`, `MessageList`, `Bubble`·`bubbleVariantOf`, `InlineStatus`, `NewMessageBadge`, `ReadOnlyNotice`, `useAutoScroll`, `useChatLoader`, `chatReducer`·`initialChatState` 외 `ui/src/state/chat.ts`·`scroll.ts`의 함수와 상수, `labels`. Props 타입은 `export type {Name}Props`. 규칙 원문은 `ui/src/rooms/design/components.md` 머리말.

---

## 1. 공용 요소 시그니처 (인용 — 단일 정의는 `ui/src/rooms/design/components.md` §1)

```ts
TopBarProps     = { title: string; subtitle?: { text: string; dateTime: string; ariaLabel: string };
                    left?: ReactNode; right?: ReactNode; titleRef?: Ref<HTMLHeadingElement>;
                    variant?: 'screen' | 'room' }
ButtonProps     = { children: ReactNode; onClick: () => void; variant?: 'primary'|'secondary'|'danger'|'ghost';
                    size?: 'sm'|'md'|'lg'; isDisabled?: boolean; ariaLabel?: string }
IconButtonProps = { icon: 'back'; ariaLabel: string; onClick: () => void; buttonRef?: Ref<HTMLButtonElement> }
StateViewProps  = { kind: 'loading'|'empty'|'error'; message: string; detail?: string;
                    actionLabel?: string; onAction?: () => void }
formatMonthDay(ms): 'MM.DD' · formatTime(ms): 'HH:mm' · toIsoDate(ms) · toIsoDateTime(ms)   // 로컬 시간대
loadLastRoomId() · saveLastRoomId(id) · clearLastRoomId()
loadScrollOffset(roomId): number | null · saveScrollOffset(roomId, distanceFromBottom): void  // try/catch, throw 없음
Viewer = { readonly canWrite: boolean } · READ_ONLY_VIEWER = { canWrite: false }
```

chat 사용: TopBar `variant='room'`(방 제목 serif lg), IconButton `icon='back'`, StateView(첫 로드 3상태), Button(B0 「다시 시도」 sm secondary · 배지 sm primary).

---

## 2. chat 로컬 컴포넌트 (`ui/src/chat/components/`)

### 2.1 MessageList

```ts
export type MessageListProps = {
  messages: readonly Message[]               // id 오름차순
  containerRef: RefObject<HTMLDivElement>    // useAutoScroll 이 준 ref
  onScroll: () => void                       // useAutoScroll 이 준 핸들러
  isLoadingOlder: boolean
  olderError: ApiError | null
  onRetryOlder: () => void
  unseenCount: number
  onShowNewest: () => void
}
```
- 렌더: 래퍼 `<div class=wrap>`(`position: relative; flex: 1; min-height: 0`) 안에
  1. 스크롤 박스 `<div ref={containerRef} role="log" aria-live="polite" aria-busy={isLoadingOlder} aria-label={labels.historyAriaLabel} tabIndex={0} onScroll={onScroll}>`(`overflow-y: auto; height: 100%`)
     - 맨 위: `isLoadingOlder` → `InlineStatus kind='loading' message={labels.olderLoading}`. 아니고 `olderError` → `InlineStatus kind='error' message={labels.olderError} actionLabel={labels.retry} onAction={onRetryOlder}`. 둘 다 아니면 없음.
     - `<ol>` → `messages.map(m => <li key={m.id}><Bubble message={m} /></li>)`.
  2. `unseenCount > 0`이면 `NewMessageBadge label={labels.newMessages} ariaLabel={labels.newMessagesAriaLabel} onClick={onShowNewest}`(스크롤 박스 밖, `position: absolute; right: var(--space-4); bottom: var(--space-2)`).
- `Bubble`은 `React.memo`. key는 서버 id.

### 2.2 Bubble

```ts
export type BubbleProps = { message: Message }
export type BubbleVariant = 'character' | 'user' | 'ooc'
export const bubbleVariantOf = (m: Message): BubbleVariant =>
  m.kind === 'ooc' ? 'ooc' : m.speaker === 'user' ? 'user' : 'character'
```
판정 순서는 위 함수 그대로(OOC가 먼저). 변형별 렌더:

| 변형 | 정렬 | DOM 순서 | 내용 |
|---|---|---|---|
| `character` | 왼쪽 | 아바타 → 이름 → 시각 → 본문 | `meta = CHARACTERS[speaker]`. `<img src={meta.avatar} alt="" width={28} height={28}>`(이름이 옆에 있어 장식) · 이름 `meta.shortName`(sm, 캐릭터 accent) · `<time dateTime={toIsoDateTime(createdAt)}>{formatTime(createdAt)}</time>`(xs muted, 머리 줄 오른쪽 끝) · 본문(serif base, 캐릭터 배경 말풍선) |
| `user` | 오른쪽 | 작성자명 → 시각 → 본문 | 작성자명 `authorName ?? labels.unknownAuthor`(sm) · 시각(xs). 머리 줄은 CSS `flex-direction: row-reverse`라 화면에는 "시각 작성자명" 순서(구성안) · 본문(serif base, `--bubble-user-bg` 말풍선, 오른쪽 정렬) |
| `ooc` | 중앙 | 장식 → 접두 → 본문 → 장식 → 시각 | `<span aria-hidden="true">{labels.oocDecor}</span> {labels.oocPrefix} {text} <span aria-hidden="true">{labels.oocDecor}</span>` sm `--bubble-ooc-fg`(줄바꿈 허용) + 시각 xs. 배경 없음. 작성자명 표시 안 함(구성안) |

- **클래스명(확정, v1.3).** Bubble 루트 요소에 아래 클래스를 붙인다. Vite 설정에서 CSS Modules가 non-scoped라 테스트는 클래스명을 그대로 단언한다(`toHaveClass('character')` 등).

| 클래스 | 붙는 조건 | 역할 |
|---|---|---|
| `character` | `bubbleVariantOf(m) === 'character'` | 왼쪽 정렬·아바타 행 형태 |
| `user` | `=== 'user'` | 오른쪽 정렬·말풍선 형태 |
| `ooc` | `=== 'ooc'` | 중앙 한 줄·배경 없음 |
| `ciel` | 변형이 `character`이고 `speaker === 'ciel'` | 색(`--bubble-ciel-*`) |
| `sebastian` | 변형이 `character`이고 `speaker === 'sebastian'` | 색(`--bubble-sebastian-*`) |

  - 조합: 캐릭터 말풍선은 `character` + `ciel`(또는 `sebastian`) 두 개. 유저는 `user` 하나. OOC는 `ooc` 하나(speaker가 캐릭터여도 색 클래스 없음). CSS 파일 `Bubble.module.css`의 선택자 이름도 이 다섯 개와 같다. 조합은 `cx(styles.character, styles.ciel)`.
- 본문은 **일반 텍스트**(React 이스케이프). `dangerouslySetInnerHTML`·마크다운 해석 금지. `white-space: pre-wrap; overflow-wrap: anywhere`.
- S1에서는 `onContextMenu`·포인터 롱프레스 핸들러를 **붙이지 않는다**(주 문서 §10).

### 2.3 InlineStatus

```ts
export type InlineStatusProps = {
  kind: 'loading' | 'error'
  message: string
  actionLabel?: string
  onAction?: () => void
}
```
- 렌더: 가운데 한 줄(loading 24px, error 28px). loading `role="status"`, error `role="alert"`. error이고 `actionLabel`·`onAction`이 둘 다 있으면 `Button size='sm' variant='secondary'`.

### 2.4 NewMessageBadge

```ts
export type NewMessageBadgeProps = { label: string; ariaLabel: string; onClick: () => void }
```
- 렌더: `Button size='sm' variant='primary' ariaLabel={ariaLabel}` 안에 `label` + 아래 방향 인라인 SVG(`aria-hidden`). info 톤(ui_design_concept §3 상태 색 "안내").

### 2.5 ReadOnlyNotice

```ts
export type ReadOnlyNoticeProps = { text: string }
```
- 렌더: `<p role="note">` 28px 한 줄 가운데, sm `--font-ui`, `--color-info`, 위 1px `--color-border`.

---

## 3. 공용 훅 `useAutoScroll` (`ui/src/components/hooks/useAutoScroll.ts`)

```ts
export type UseAutoScrollOptions = {
  firstId: number | null                    // 현재 목록 첫 메시지 id (없으면 null)
  lastId: number | null                     // 현재 목록 끝 메시지 id
  initialDistanceFromBottom: number | null  // 복원할 거리(px). null = 맨 아래
  canAutoLoadOlder: boolean                 // 위 끝 도달 시 onReachTop 을 불러도 되는가
  onReachTop: () => void
  onReachBottom: () => void                 // 맨 아래 근처 도달(배지 해제)
}
export type UseAutoScrollResult = {
  containerRef: RefObject<HTMLDivElement>
  onScroll: () => void
  isNearBottom: () => boolean               // S2·S3 의 메시지 추가 시점에 쓴다
  scrollToBottom: () => void
  getDistanceFromBottom: () => number | null  // 첫 배치 전이면 null. 언마운트 뒤에도 마지막 값
}
```

내부 ref: `metricsRef: ScrollMetrics | null`(마지막 측정) · `prevIdsRef: { firstId, lastId }` · `positionedRef: boolean`(첫 배치 완료) · `lastDistanceRef: number | null` · 최신 `canAutoLoadOlder`·콜백을 담는 ref(오래된 클로저 방지). 계산 함수는 `ui/src/state/scroll.ts`(functions.md §2).

| 시점 | 동작 |
|---|---|
| `useLayoutEffect([firstId, lastId])`, 요소 없음 또는 `firstId === null` | 아무것도 안 함 |
| 같은 effect, `positionedRef === false` | `el.scrollTop = restoreScrollTop(el, initialDistanceFromBottom)` → `positionedRef = true` → 측정 기록 → `isNearTop` && `canAutoLoadOlder`면 `onReachTop()` 1회 |
| 같은 effect, `firstId < prev.firstId`(앞에 붙음) | `el.scrollTop = anchorScrollTop(metricsRef, el.scrollHeight)` |
| 같은 effect, `lastId > prev.lastId`(뒤에 붙음) | 붙기 **전** 측정(`metricsRef`)이 `isNearBottom`이면 `el.scrollTop = el.scrollHeight`. 아니면 그대로 |
| effect 끝 | `metricsRef`·`lastDistanceRef`·`prevIdsRef` 갱신 |
| `onScroll()` | 측정 기록·`lastDistanceRef` 갱신 → `isNearTop` && `canAutoLoadOlder` → `onReachTop()` · `isNearBottom` → `onReachBottom()` |
| `scrollToBottom()` | `el.scrollTop = el.scrollHeight` 후 측정 기록 |

- 앞·뒤가 한 번에 바뀌면 앞붙임 보정 → 뒤붙임 판정 순서로 둘 다 적용한다.
- 애니메이션 없음(즉시 이동). `IntersectionObserver` 미사용(jsdom 테스트 단순화).
- 훅은 메시지 타입을 모른다(id 두 개와 스크롤 박스만 안다) → 화면 비종속.

---

## 4. 스타일 토큰

| 대상 | 토큰(`.claude/skills/ui_design_concept.md`) |
|---|---|
| 배경 | `--color-bg`. 상단 바 아래·D 위 1px `--color-border` |
| 방 제목 | serif lg(16px) `--color-fg`, 한 줄 말줄임 |
| 생성일 | `--font-ui` xs `--color-fg-muted`, `tabular-nums` |
| 시엘 말풍선 | 배경 `--bubble-ciel-bg`, 글자 `--bubble-ciel-fg`, 이름 `--bubble-ciel-accent`, 1px `--color-border` |
| 세바스찬 말풍선 | `--bubble-sebastian-bg` · `-fg` · `-accent`, 1px `--color-border` |
| 유저 말풍선 | 배경 `--bubble-user-bg`, 본문 `--color-fg`, 작성자명 `--bubble-user-fg` |
| OOC | `--bubble-ooc-fg`, sm, 배경 없음 |
| 말풍선 공통 | 반경 `--radius-lg`, 패딩 `--space-3`, 말풍선 사이 `--space-2`, 최대 폭 `--bubble-max-width` |
| 아바타 | 28px 원형 |
| 시각·B0 | `--font-ui` xs/sm, `--color-fg-muted` |
| D 열람 안내 | sm `--color-info` |
| 배지 | Button sm primary, info 톤 |
| 화면 좌우 여백 | `--space-4` |
| 컴포넌트 변수 값(ui_design_concept §3은 접두사만 정함) | `--bubble-user-bg: var(--color-bg-elevated)` · `--bubble-max-width: 78%`(폭 ≤ 360px에서 85%) — `global.css` `:root`·미디어 쿼리에 정의 |
| 파일 | `ui/src/chat/styles/ChatScreen.module.css`, 컴포넌트별 `{Name}.module.css`. 하드코딩 색 금지 |

- 아바타 파일 `ui/public/img/ciel.png`·`sebastian.png`(S1은 플레이스홀더). 경로는 `CHARACTERS.*.avatar`(`/embed/img/{id}.png`, Vite `base: '/embed/'`).
- `prefers-reduced-motion: reduce`면 B0·배지 페이드 0ms(ui_design_concept §8).
