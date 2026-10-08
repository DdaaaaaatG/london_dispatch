# rooms 상세 설계 — 컴포넌트·스타일 (분할 문서)

> 주 문서: `ui/src/rooms/design.md`(RTM 포함). 이 파일은 주 문서 §3의 상세다.
> 이 파일 §1은 두 화면이 함께 쓰는 공용 요소의 **단일 정의**다. chat 설계(`ui/src/chat/design/components.md` §1)는 이 값을 그대로 인용한다.
> **export 규칙(공통, v1.3):** 모든 컴포넌트·훅·유틸·상태 모듈은 **named export**만 쓴다. `export default` 금지. 대상: `App`, `RoomsScreen`, `ChatScreen`, `TopBar`·`Button`·`IconButton`·`StateView`, `RoomList`·`ListRow`, `useAutoScroll`·`useChatLoader`, `cx`·`formatDate`·`storage` 함수, `viewer`·`chat`·`scroll` 상태 모듈, 화면 `labels`. S2 추가분(§1.10~§1.19, §2.3~§2.4)도 같다. 테스트는 `import { App } from '@/App'`처럼 이름으로 가져온다. 공용 컴포넌트 폴더의 `index.ts`도 named 재노출만 한다. Props 타입도 `export type {Name}Props`로 이름 export한다.
> **v1.5(검증 DC-09):** 사용처 없는 표면을 뺐다 — `useToast.dismissToast`, `--btn-busy-opacity`, TextInput·TextArea·Toggle의 `isDisabled`. IconButton `isDisabled`는 사용처(chat ⋯, 쓰기 대기 중)가 있어 추가했다.

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
- 렌더: `<header>` 44px. `left` → `title`(flex 1, ellipsis) → `subtitle` → `right` 순서. 값이 없는 슬롯은 렌더하지 않는다(거짓 값이면 감싸는 `div`도 없다).
- `variant='screen'`: 제목 serif xl(18px), uppercase, `letter-spacing: .08em`, `--color-accent`(rooms `ROOMS`). `variant='room'`: 제목 serif lg(16px) `--color-fg`(chat 방 제목).
- 배경 `--color-bg`, 아래 1px `--color-border`.
- 폭 ≤ 360이면 `subtitle`을 CSS로 감춘다(구성안 §4).
- S2 변경 없음. 쓰기 분기는 호출 쪽이 `right`를 넘기느냐로만 한다.

### 1.2 Button (`ui/src/components/ui/Button/`)

```ts
export type ButtonProps = {
  children: ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'   // 기본 'secondary'
  size?: 'sm' | 'md' | 'lg'                               // 기본 'md'
  isDisabled?: boolean                                    // 기본 false
  ariaLabel?: string                                      // 보이는 글자와 다를 때만
  buttonRef?: Ref<HTMLButtonElement>                      // S2 추가: 포커스 복귀 대상(「+ 새 방」·ConfirmDialog 취소)
  ariaDescribedBy?: string                                // 후작업 2026-10-07 추가: aria-describedby 로 그대로 전달, 생략하면 속성 없음(잠금 안내 연결 — chat 인라인 수정 저장 버튼)
}
```
- 클래스 키(v1.5, 확정): 루트에 `cx(styles.root, styles[variant], styles[size])` → 변형 클래스명은 `primary`·`secondary`·**`danger`**·`ghost`, 크기는 `sm`·`md`·`lg` 그대로다. CSS Modules가 non-scoped라 테스트는 `toHaveClass('danger')`로 단언한다.
- 렌더: `<button type="button">`. `isDisabled`면 `disabled`(모양은 `--color-fg-disabled` 글자). 높이 sm 28 / md 36 / lg 44. 터치 영역 44 미만이면 padding으로 확보. `buttonRef`는 `<button ref>`에 그대로 건다.
- S1 사용처: StateView 「다시 시도」(md secondary), chat B0 「다시 시도」(sm secondary), chat 새 메시지 배지(sm primary).
- S2 사용처: rooms 「+ 새 방」(md primary)·B 행 취소(sm secondary)·만들기(sm primary), chat 전송(md primary)·인라인 수정 취소/저장(sm), PromptSheet·ConfirmDialog 버튼(lg).

### 1.3 IconButton (`ui/src/components/ui/IconButton/`)

```ts
export type IconButtonProps = {
  icon: 'back' | 'more' | 'settings'   // S2 에서 'more'(⋯), S3c 에서 'settings'(톱니, rooms ⚙) 추가
  ariaLabel: string            // 필수
  onClick: () => void
  buttonRef?: Ref<HTMLButtonElement>
  isDisabled?: boolean         // v1.5: chat ⋯ 를 쓰기 대기 중 비활성(chat design.md §11.2 D-10). 기본 false
}
```
- 렌더: `<button type="button" aria-label disabled={isDisabled}>` 안에 인라인 SVG(`viewBox 0 0 24 24`, 20×20, `aria-hidden="true"`). 44×44 터치 영역, ghost 톤. 비활성이면 글자색 `--color-fg-disabled`.
- `back`: path `M15 5l-7 7 7 7`, stroke 1.25. `more`: 가로 점 3개 — `<circle cx=6|12|18 cy=12 r=1.5 fill=currentColor>`, stroke 없음.
- (S3c) `settings`(톱니, 단순형): 가운데 `<circle cx=12 cy=12 r=3 fill=none>` + 바깥 `<circle cx=12 cy=12 r=6.5 fill=none>` + 톱니 8개 = 중심에서 반지름 6.5→9 짧은 선 8개(0°·45°·…·315°, `path d="M12 3v2.5 M12 18.5V21 M3 12h2.5 M18.5 12H21 M5.6 5.6l1.8 1.8 M16.6 16.6l1.8 1.8 M5.6 18.4l1.8-1.8 M16.6 7.4l1.8-1.8"`). 모두 `stroke=currentColor` 1.25, `stroke-linecap=round`, fill 없음. 사용처: rooms 상단 바 ⚙(F-RM-28). 새 패키지·이미지 파일 없음.

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
- 테스트 입력은 `new Date(2026, 9, 5, 16, 40).getTime()`처럼 로컬 생성자로 만든다.

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
- 모든 함수는 `window.localStorage` 접근 전체를 `try/catch`로 감싼다. 읽기 실패·값 없음 → `null`. 쓰기·삭제 실패 → 조용히 무시.
- `loadLastRoomId`: 빈 문자열이면 `null`. `loadScrollOffset`: 0 이상 유한수가 아니면 `null`. `saveScrollOffset`: `Math.max(0, Math.round(d))`를 문자열로.
- **토큰은 어떤 키로도 저장하지 않는다**(R-API-003·R-CHAT-009). S2에서도 키를 늘리지 않는다. 토큰은 §1.10 메모리 슬롯에만 있다.
- **(S6) 입장 증명 키 추가** — `STORAGE_KEYS.roomKeys = 'ld:roomKeys'`와 원문 3함수. 해석(JSON·상한·중복)은 §1.21 `roomKeys`가 하고 여기는 문자열만 읽고 쓴다. 증명은 토큰이 아니다(api.md §2.8.2, R-CHAT-009 🔒 불변).
  ```ts
  export const loadRoomKeysRaw = (): string | null      // read('ld:roomKeys'), 빈 문자열이면 null
  export const saveRoomKeysRaw = (json: string): void    // write
  export const clearRoomKeysRaw = (): void               // remove
  ```
- 다른 파일에서 `localStorage`·`sessionStorage`를 직접 쓰지 않는다(리뷰 grep 대상).

### 1.8 viewer (`ui/src/state/viewer.ts`)

```ts
export type Viewer = { readonly canWrite: boolean }
export const READ_ONLY_VIEWER: Viewer = Object.freeze({ canWrite: false })
export const WRITER_VIEWER: Viewer = Object.freeze({ canWrite: true })        // S2
export const viewerFromToken = (token: string | null): Viewer =>              // S2
  token !== null ? WRITER_VIEWER : READ_ONLY_VIEWER
```
- S2: `App`이 첫 렌더 1회 `useState(() => viewerFromToken(getToken()))`로 정한다. 인증 실패면 `App.revokeWrite`가 `READ_ONLY_VIEWER`로 바꾼다. 되돌아가는 경로는 없다(새로 고침뿐, api.md §2.4).
- 화면은 `viewer.canWrite`만 본다. 토큰 값·표시 이름은 viewer에 두지 않는다(작성자명은 서버 응답 `authorName`, R-AUTH-004).

### 1.9 공통 파일 규칙

- 공용 컴포넌트 폴더: `{Name}.tsx` · `{Name}.module.css` · `{Name}.test.tsx` · `index.ts`(재노출). 구현 후 ui-component-implementer가 `component-catalog`에 등록한다.
- 공용 컴포넌트는 **언어 문구**를 갖지 않는다. 문구는 화면 `labels.ts`에서 props로 받는다. 숫자 카운터(`12/60`)는 문구가 아니므로 컴포넌트가 만든다.

### 1.10 token (`ui/src/state/token.ts`) — S2, R-CHAT-009 · R-API-003 🔒

비유: 갠홈이 써 준 출입증을 주머니(메모리)에만 넣어 둔다. 서랍(저장소)에는 넣지 않는다. 출입이 거절되면 주머니를 비운다.

```ts
export const readTokenFromSearch = (search: string): string | null
  // new URLSearchParams(search).get('t') → null 이면 null. trim 후 '' 이면 null. 아니면 trim 한 값
export const initToken = (search: string): void   // main.tsx 가 렌더 전 1회. 슬롯 = readTokenFromSearch(search)
export const getToken = (): string | null         // 슬롯 값. configureClient({ getToken }) 에 그대로 넘긴다
export const clearToken = (): void                // 슬롯 = null (인증 실패 전환, 테스트 정리)
```
- 보관: 모듈 클로저 변수 하나(`createTokenSlot()` 안). `localStorage`·`sessionStorage`·쿠키·IndexedDB·`window` 전역 금지.
- URL은 고치지 않는다(`history.replaceState` 없음). 디코드·검사하지 않는다. `console`·문구·에러에 토큰을 넣지 않는다(R-AUTH-006).
- `ui/src/main.tsx`(S2 순서): `import '@/styles/global.css'` → `initToken(window.location.search)` → `configureClient({ getToken })`(`@/api`) → `createRoot(container).render(<App />)`. 그 밖의 파일은 `initToken`·`configureClient`를 부르지 않는다.

### 1.11 글자 수·한도 (`ui/src/state/limits.ts`) — S2

```ts
export const ROOM_TITLE_MAX_CHARS = 60      // R-ROOM-002 · api.md §4.6
export const MESSAGE_TEXT_MAX_CHARS = 2000  // R-MSG-002 · api.md §4.9
export const countChars = (value: string): number          // Array.from(value.trim()).length — trim 후 코드 포인트
export const isRoomTitleValid = (value: string): boolean   // 1 ≤ countChars ≤ 60
export const isMessageTextValid = (value: string): boolean // 1 ≤ countChars ≤ 2000
```
- 이모지 1개 = 1자. `maxLength` 속성은 쓰지 않는다(UTF-16 단위라 어긋나고, 붙여넣기를 말없이 자른다).
- 한도 숫자는 계약 값이다. shared 상수가 생기면 재노출한다(주 문서 §12 CR-C-2).
- **(S6) 비밀번호 — trim 없음**(R-LOCK-001). 상수는 `@shared/limits`(api.md §5.10.4)에서 import한다(이 파일에 숫자를 다시 쓰지 않는다).
  ```ts
  import { ROOM_PASSWORD_MIN, ROOM_PASSWORD_MAX, ROOM_ENTER_PASSWORD_MAX } from '@shared/limits'   // 4 · 32 · 64
  export const countPasswordChars = (value: string): number         // Array.from(value).length — trim 없이 코드 포인트
  export const isRoomPasswordSettable = (value: string): boolean    // 4 ≤ n ≤ 32 (chat 잠금 설정·변경)
  export const isRoomPasswordValid = (value: string): boolean       // value === '' || isRoomPasswordSettable(value) (새 방 — 빈칸 = 잠그지 않음)
  export const isEnterPasswordValid = (value: string): boolean      // 1 ≤ n ≤ 64 (입장 시트)
  ```

### 1.12 TextInput (`ui/src/components/ui/TextInput/`) — S2

```ts
export type TextInputProps = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
  maxChars?: number                 // 있으면 오른쪽 안에 `${countChars(value)}/${maxChars}` 카운터
  inputRef?: Ref<HTMLInputElement>
  onEnter?: () => void              // Enter(IME 조합 중 제외) → preventDefault 후 호출
  onEscape?: () => void             // Esc → 호출
  isReadOnly?: boolean              // 요청 중. 포커스는 유지, 편집만 막는다
}
```
- 렌더: `<div class=wrap>` 안에 `<input type="text" aria-label autoComplete="off">` + 카운터 `<span aria-hidden="true">`(xs `tabular-nums`). 한도 초과면 카운터 클래스 `over`(`--color-danger`)·`<input aria-invalid="true">`.
- 높이 36, 배경 `--input-bg`, 글자 `--input-fg`, 테두리 1px `--input-border`, placeholder `--input-placeholder`, 반경 `--radius-md`.
- IME 판정: `event.nativeEvent.isComposing === true` 또는 `event.keyCode === 229`이면 Enter를 무시한다.
- **(S6 델타) `type?: 'text' | 'password'`**(기본 `'text'` — 지금 동작 그대로). `'password'`면:
  - `<input type="password" autoComplete="new-password" autoCapitalize="off" spellCheck={false}>`(브라우저 저장 비밀번호 자동 채움·저장 제안 차단 — 갠홈 로그인 비밀번호와 섞이지 않게, lock.md D-L6)
  - 카운터·`over` 판정 수 = `countPasswordChars(value)`(**trim 없음**, §1.11). `'text'`는 기존대로 `countChars`(trim 후)
  - 그 밖(높이·Enter·Esc·IME·readOnly·aria-invalid)은 같다. 보기 토글 없음(요구 없음)
  - 사용처: rooms B2 · 입장 시트(PromptSheet 경유) · chat 잠금 설정·변경 시트

### 1.13 TextArea (`ui/src/components/ui/TextArea/`) — S2

```ts
export type TextAreaProps = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
  maxRows?: number                         // 기본 3. 넘으면 내부 스크롤
  maxChars?: number
  counterMode?: 'always' | 'overflow'      // 기본 'overflow' = 한도를 넘었을 때만 카운터 표시. maxChars 없으면 무시
  textareaRef?: Ref<HTMLTextAreaElement>
  onEnter?: () => void                     // 주면 Enter = onEnter, Shift+Enter = 줄바꿈. 안 주면 Enter = 줄바꿈
  onEscape?: () => void
  isReadOnly?: boolean
}
```
- 렌더: `<textarea rows={1} aria-label>` + (조건부) 카운터. 한도 초과 시 `aria-invalid="true"`·카운터 `over`.
- 자동 높이: `useLayoutEffect([value])`에서 `el.style.height = 'auto'` → `max = lineHeight × maxRows + 위아래 padding` → `el.style.height = min(el.scrollHeight, max) + 'px'`, `overflow-y = scrollHeight > max ? 'auto' : 'hidden'`. 1줄 36px, 3줄 76px.
- IME 판정은 §1.12와 같다. 높이 ≤ 480 화면이면 `window.matchMedia('(max-height: 480px)')`일 때 1줄 고정.
- `counterMode='always'`는 사용처가 없지만 TC-CH-058에서 검증하는 표시 방식이라 남긴다(PromptSheet·TextInput 카운터와 같은 규칙의 TextArea판).

### 1.14 Toggle (`ui/src/components/ui/Toggle/`) — S2

```ts
export type ToggleProps = {
  isOn: boolean
  onChange: (next: boolean) => void
  onLabel: string                // 켜짐일 때 보이는 글자
  offLabel: string               // 꺼짐일 때 보이는 글자
  ariaLabel: string              // 스위치 이름(상태는 aria-checked 가 말한다)
}
```
- 렌더: `<button type="button" role="switch" aria-checked={isOn} aria-label={ariaLabel}>{isOn ? onLabel : offLabel}</button>`. 클릭·Space·Enter → `onChange(!isOn)`.
- 캡슐 28px(터치 영역 44 padding), sm. 꺼짐: 테두리 `--color-border`, 글자 `--color-fg-muted`. 켜짐: 배경 `--color-primary`, 글자 `--color-primary-fg`. 상태는 색 + 글자로 전한다.

### 1.15 BottomSheet + SheetItem (`ui/src/components/ui/BottomSheet/`) — S2

비유: 화면 위에 반투명 천을 덮고, 아래에서 쟁반을 밀어 올린다. 쟁반을 내려놓기 전에는 천 아래를 만질 수 없다.

```ts
export type BottomSheetProps = {
  ariaLabel: string
  role?: 'dialog' | 'alertdialog'                 // 기본 'dialog'
  header?: ReactNode                              // 머리 줄(40px). 없으면 렌더 안 함
  children: ReactNode
  onClose: () => void                             // Esc · 덮개 탭
  isDismissDisabled?: boolean                     // true 면 Esc·덮개로 닫히지 않는다(요청 중)
  initialFocusRef?: RefObject<HTMLElement | null> // 없으면 시트 안 첫 포커스 가능 요소
}
export type SheetItemProps = {
  label: string
  onSelect: () => void
  tone?: 'default' | 'danger'                     // 기본 'default'
  isDisabled?: boolean                            // 사용처: chat 말풍선 메뉴(쓰기 대기 중)
}
```
- 렌더(포털 없음): `<div class=overlay>`(`position: absolute; inset: 0; z-index: var(--z-sheet)`, 배경 `--color-overlay`, 덮개 클릭 → `onClose`) 안에 `<div class=panel role aria-modal="true" aria-label>`(아래 붙음, 폭 100%, 최대 높이 70%, `--sheet-bg`, 위 모서리 `--sheet-radius`, `--sheet-shadow`, 내부 여백 `--space-4`, 넘치면 내부 스크롤). 패널 클릭은 덮개로 전파하지 않는다.
- 시트를 쓰는 화면 루트는 `position: relative`다.
- 포커스: 마운트 layout effect에서 `document.activeElement`를 기억 → `initialFocusRef ?? 첫 포커스 가능 요소`에 포커스. 언마운트 cleanup에서 기억한 요소가 `isConnected`면 되돌린다(아니면 아무것도 하지 않는다).
- 포커스 트랩: Tab/Shift+Tab에서 패널 안 포커스 가능 요소(`button:not([disabled])`, `input:not([disabled])`, `textarea:not([disabled])`, `[tabindex="0"]`)의 처음↔끝을 순환한다.
- Esc: `isDismissDisabled`가 아니면 `onClose()`. 이벤트 전파를 멈춘다.
- 모션: 열림 160ms ease-out translateY, 덮개 fade 120ms. `prefers-reduced-motion: reduce`면 0ms.
- SheetItem: `<button type="button">` 폭 100%, 높이 44, md `--font-ui`, 왼쪽 정렬. `danger`면 `--color-danger`. `isDisabled`면 `disabled`. 클래스 키(v1.5, 확정): 루트 `cx(styles.item, tone === 'danger' && styles.danger)` → danger 항목의 클래스명은 **`danger`**(테스트 `toHaveClass('danger')`).

### 1.16 ConfirmDialog (`ui/src/components/ui/ConfirmDialog/`) — S2

```ts
export type ConfirmDialogProps = {
  title: string            // 한 줄 질문
  message: string          // 결과 설명
  confirmLabel: string     // 파괴 버튼(오른쪽, danger)
  cancelLabel: string      // 취소(왼쪽, secondary)
  onConfirm: () => void
  onCancel: () => void
  isBusy?: boolean         // 요청 중: 두 버튼 disabled, Esc·덮개 닫힘 막음
}
```
- 렌더: `BottomSheet role="alertdialog" ariaLabel={title} onClose={onCancel} isDismissDisabled={isBusy} initialFocusRef={cancelRef}` 안에 `<h2>`(md serif) · `<p>`(sm) · 버튼 줄(취소 `Button lg secondary buttonRef={cancelRef}` 왼쪽, 확인 `Button lg danger` 오른쪽). 약 148px.
- 첫 포커스는 **취소**. `window.confirm` 금지(ui-design-strategy §11).
- 클래스 키(v1.5, 확정): 확인 버튼은 `Button variant='danger'`이므로 클래스명 **`danger`**(§1.2). ConfirmDialog가 따로 danger 클래스를 만들지 않는다.

### 1.17 PromptSheet (`ui/src/components/ui/PromptSheet/`) — S2

```ts
export type PromptSheetProps = {
  title: string                          // 시트 제목(h2), 시트 aria-label 도 같은 값
  inputAriaLabel: string
  initialValue: string
  maxChars: number
  canSave: (value: string) => boolean    // 호출 쪽 검증(예: 유효 && 바뀜)
  saveLabel: string
  cancelLabel: string
  onSave: (value: string) => void
  onCancel: () => void
  isBusy?: boolean                       // 요청 중: 입력 readOnly, 두 버튼 disabled, Esc·덮개 닫힘 막음
  errorText?: string | null              // 있으면 입력 아래 `<p role="alert">` 한 줄(danger)
}
```
- 로컬 상태 `value`(초기 `initialValue`). 렌더: `BottomSheet ariaLabel={title} onClose={onCancel} isDismissDisabled={isBusy} initialFocusRef={inputRef}` 안에 h2 · `TextInput maxChars onEnter={submit} isReadOnly={isBusy}` · (errorText) · 버튼 줄(취소 lg secondary, 저장 lg primary `isDisabled = isBusy || !canSave(value)`). 약 180px.
- `submit`: `!isBusy && canSave(value)`일 때만 `onSave(value)`. 마운트 시 입력에 포커스, 커서 끝.
- 사용처: chat 방 이름 변경 하나. 공용 근거는 구성안 §3 "공용 후보"와 비종속성(주 문서 §13).
- **(S6 델타) props 2개 추가**(둘 다 선택 — 생략하면 지금과 같다):
  ```ts
  inputType?: 'text' | 'password'   // 기본 'text'. 내부 TextInput 의 type 으로 그대로 전달(§1.12)
  placeholder?: string              // 내부 TextInput 의 placeholder 로 그대로 전달. 문구는 호출 쪽 labels
  ```
  - 사용처 추가: rooms·chat 입장 시트(`inputType='password'`, placeholder 없음, `maxChars` 64) · chat 「비밀번호 걸기」·「비밀번호 바꾸기」(`inputType='password'`, placeholder 「6자 이상 권장」 계열 — chat labels, `maxChars` 32). 근거 lock.md D-L1·D-L2.

### 1.18 Toast + useToast — S2

```ts
// ui/src/components/ui/Toast/
export type ToastTone = 'warning' | 'danger' | 'success'   // S3c 'success' 추가(설정 저장 성공·가져오기 요약) — 메인 세션 승인 2026-10-06
export type ToastProps = { message: string; tone: ToastTone }

// ui/src/components/hooks/useToast.ts
export const TOAST_DURATION_MS = 2000
export type ToastState = { readonly id: number; readonly message: string; readonly tone: ToastTone } | null
export type UseToastResult = {
  toast: ToastState
  showToast: (message: string, tone: ToastTone) => void   // 지금 것을 바꾸고 타이머를 2초로 다시 건다. id 는 1씩 증가
}
export const useToast = (): UseToastResult
```
- Toast 렌더: `<p role="alert" class={cx(root, tone)}>{message}</p>`. 최소 높이 28px, 두 줄까지 줄바꿈, sm `--font-ui`, 배경 `--color-bg-elevated`, 글자 `--color-fg`, 왼쪽 3px 막대 `--color-warning`/`--color-danger`, 좌우 `--space-4`. 화면은 `<Toast key={toast.id} …/>`로 렌더해 같은 문구도 다시 읽히게 한다.
- useToast: 타이머 `setTimeout` 하나(ref). 새 `showToast`면 이전 타이머 해제. 언마운트 시 해제. 시간 경과 → `toast = null`. 수동 닫기는 요구가 없어 두지 않는다(v1.5).
- 위치는 화면이 정한다(rooms 맨 아래 줄, chat E 줄). 시트가 열린 동안에는 토스트를 띄우지 않도록 화면 기능 명세가 경로를 나눈다.
- (S3c) `success` 톤: 왼쪽 3px 막대 `--color-success`(ui_design_concept §3 "정상·저장됨"). 그 밖 모양은 같다. 사용처는 settings(저장 성공·가져오기 요약)뿐이고 rooms·chat 동작 변경 없음. `toastToneOf`(F-RM-22)는 `success`를 내지 않는다(실패 전용). 메인 세션 승인(2026-10-06, 디자인 컨셉 상태 색 규칙 · R-SET-009 범위). rooms CR-001 공용 변경 2건 중 하나.

### 1.19 ~~useLongPress~~ — **삭제됨(S3e 후작업 2026-10-07)**

`ui/src/components/hooks/useLongPress.ts`와 스펙은 지워졌다. 유일한 사용처였던 chat 말풍선 메뉴가 S3e(R-CHAT-007 🔒 개정, chat CR-003)로 말풍선 액션 버튼으로 바뀌어 사용처가 0이 됐기 때문이다(rooms는 처음부터 쓰지 않았다). 옛 정의(500ms·10px 허용·contextmenu 통합)는 git 이력에 있다.

### 1.20 S2 전역 토큰 추가 (`ui/src/styles/global.css` `:root`, 없으면 추가)

| 변수 | 값 |
|---|---|
| `--input-bg` · `--input-fg` · `--input-border` · `--input-placeholder` | `var(--color-bg-sunken)` · `var(--color-fg)` · `var(--color-border)` · `var(--color-fg-muted)` |
| `--sheet-bg` · `--sheet-radius` · `--sheet-shadow` | `var(--color-bg-elevated)` · `var(--radius-lg) var(--radius-lg) 0 0` · `0 -12px 24px rgba(4, 10, 20, .45)` |
| `--z-sheet` | `10` |

### 1.21 roomKeys (`ui/src/state/roomKeys.ts`) — S6, R-LOCK-004 · R-LOCK-007

비유: 방마다 받은 도장을 적는 수첩. 서랍(저장소)이 잠겨 있어도 이번에 열어 둔 수첩(메모리)으로 계속 쓴다. 출입증(토큰)은 이 수첩에 적지 않는다.

```ts
export const ROOM_KEYS_MAX = 50
export type RoomKeyEntry = readonly [roomId: string, entryKey: string]
// 순수
export const parseRoomKeys = (raw: string | null): readonly RoomKeyEntry[]
export const upsertRoomKey = (entries: readonly RoomKeyEntry[], roomId: string, entryKey: string): readonly RoomKeyEntry[]
export const removeRoomKey = (entries: readonly RoomKeyEntry[], roomId: string): readonly RoomKeyEntry[]
export const findRoomKey = (entries: readonly RoomKeyEntry[], roomId: string): string | null
export const serializeRoomKeys = (entries: readonly RoomKeyEntry[]): string | null   // 빈 배열 = null(키 삭제)
// 메모리 슬롯 + storage(§1.7) 경유
export const getRoomKey = (roomId: string): string | null      // main.tsx 가 configureClient({ getToken, getRoomKey }) 로 넘긴다
export const saveRoomKey = (roomId: string, entryKey: string): void
export const forgetRoomKey = (roomId: string): void
export const resetRoomKeyCache = (): void                      // 테스트 정리 전용
```
- 동작 상세: `design/lock.md` F-RM-30~37. 저장 형식은 `[roomId, entryKey]` 쌍 배열 JSON, 순서 = 저장한 순서(오래된 것이 앞), 상한 50.
- 캐시는 첫 접근 때 1회 저장소를 읽고, 이후 읽기는 캐시만 본다. 쓰기는 캐시 → 저장소 순(저장소 실패는 storage가 삼킨다).
- 증명은 불투명 문자열이다. 해석·형식 검사·로그 출력 금지(api.md §2.8.1). 비밀번호·토큰은 이 모듈에 들어오지 않는다.

### 1.22 roomEntry 묶음 (`ui/src/components/roomEntry/`) — S6, 지역 공용(rooms·chat)

`components/ui`가 아니다(문구를 품는다, §1.9). 위치 결정 근거는 `design/lock.md` D-L8. 폴더: `useRoomEntry.ts` · `RoomEntrySheet.tsx` · `roomEntryText.ts` · `index.ts`(named 재노출) · 각 테스트.

```ts
// useRoomEntry.ts
export type EntrySheet = { room: RoomSummary; isBusy: boolean; error: ApiError | null } | null
export type UseRoomEntryOptions = {
  canWrite: boolean                               // viewer.canWrite — ③ 조용한 시도 여부에만 쓴다
  onEntered: (room: RoomSummary) => void          // 들어가도 된다(rooms: onOpenRoom · chat: 첫 로드 다시)
  onRoomGone: (room: RoomSummary) => void         // 방이 없어졌다(NOT_FOUND)
}
export type UseRoomEntryResult = {
  sheet: EntrySheet
  requestEntry: (room: RoomSummary, reason?: 'tap' | 'locked') => void   // 'locked' = ROOM_LOCKED 수신(증명 삭제 후 ③④)
  submitPassword: (password: string) => void      // 내부에서 Promise 를 void 로 버린다
  cancelEntry: () => void
}
export const useRoomEntry = (options: UseRoomEntryOptions): UseRoomEntryResult

// RoomEntrySheet.tsx
export type RoomEntrySheetProps = {
  sheet: NonNullable<EntrySheet>
  onSubmit: (password: string) => void
  onCancel: () => void
}
export const RoomEntrySheet = (props: RoomEntrySheetProps): JSX.Element
```
- `RoomEntrySheet` 렌더: `<PromptSheet key={sheet.room.id} title={ROOM_ENTRY_TEXT.title} inputAriaLabel={ROOM_ENTRY_TEXT.inputAriaLabel} initialValue="" maxChars={ROOM_ENTER_PASSWORD_MAX} canSave={isEnterPasswordValid} saveLabel={ROOM_ENTRY_TEXT.submit} cancelLabel={ROOM_ENTRY_TEXT.cancel} onSave={onSubmit} onCancel={onCancel} isBusy={sheet.isBusy} errorText={sheet.error === null ? null : enterErrorText(sheet.error)} inputType="password" />`. placeholder 없음.
- `useRoomEntry`는 `@/api`의 `enterRoom`과 §1.21 `getRoomKey`·`saveRoomKey`·`forgetRoomKey`만 부른다. 판정 상세 `design/lock.md` F-RM-40~44 · §6.7 · §6.8.

### 1.23 roomEntryText (`ui/src/components/roomEntry/roomEntryText.ts`) — S6

```ts
export const ROOM_ENTRY_TEXT = { title: '비밀번호', inputAriaLabel: '방 비밀번호', submit: '입장', cancel: '취소' } as const
export const enterErrorText = (error: ApiError): string   // 표: design/lock.md §8.2
```
- `NETWORK` 문구는 `components/utils/errorText.ts`의 `NETWORK_TEXT`를 import한다(문장 중복 금지). 그 밖 코드는 `ERROR_MESSAGES[code]`.

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
- hover·active `--row-hover-bg`, 아래 1px `--row-divider`. Tab 포커스, Enter·Space → `onSelect`.
- 롱프레스 메뉴 없음(구성안 §5 미채택 확정). S2에서도 없다.
- **(S6) 잠긴 변형 — props를 판별 유니온으로 바꾼다**(기존 호출은 `isLocked`를 생략해도 그대로 컴파일된다):
  ```ts
  type ListRowBase = { title: string; ariaLabel: string; onSelect: () => void }
  export type ListRowProps =
    | (ListRowBase & { isLocked?: false; dateText: string; dateTime: string })   // 안 잠김(지금 그대로)
    | (ListRowBase & { isLocked: true })                                          // 잠김: 날짜 props 자체가 없다
  ```
  - 잠김 렌더: `<button aria-label={ariaLabel}>` 안에 `<span class=titleGroup>`(flex 1, `gap: var(--space-2)`, `min-width: 0`) = `<LockGlyph />` + 제목(한 줄 말줄임). **`<time>`을 만들지 않는다**(숨김 CSS 금지, U8).
  - `LockGlyph`: 같은 파일 지역 컴포넌트. `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">`(자물쇠 몸통 사각형 + 고리 경로, `fill`/`stroke` = `currentColor`), 색 `--color-fg-muted`, `flex: none`. 이모지 금지. 공용 승격 안 함(IconButton 아이콘 목록과 무관).
  - 폭·말줄임: `design/lock.md` §1.4.

### 2.2 RoomList (`ui/src/rooms/components/RoomList.tsx`)

```ts
export type RoomListProps = {
  rooms: readonly RoomSummary[]
  onSelect: (room: RoomSummary) => void
}
```
- 렌더: `<ul>`(aria-label 없음) → `<li key={room.id}><ListRow …/></li>`. 순서는 받은 배열 그대로(api.md §4.2).
- `dateText = formatMonthDay(room.updatedAt)`, `dateTime = toIsoDate(room.updatedAt)`.
- **(S6)** `room.locked`면 `<ListRow isLocked title={room.title} ariaLabel={labels.lockedRowAriaLabel(room.title)} onSelect />` — 날짜를 계산하지도 넘기지도 않는다(lock.md F-RM-54). `onSelect`는 RoomsScreen이 넘긴 `entry.requestEntry`(F-RM-47).

### 2.3 ListArea (`ui/src/rooms/index.tsx` 안 지역 컴포넌트) — S1 실물 소급(v1.4)

```ts
type ListAreaProps = { load: RoomsLoad; onRetry: () => void; onSelect: (room: RoomSummary) => void }
```
- 설계 v1.3의 지역 함수 `renderListArea(load)`를 S1 구현이 지역 컴포넌트로 만들었다. 판정 순서(error → loading → data → empty)와 출력은 같다.

### 2.4 NewRoomRow (`ui/src/rooms/components/NewRoomRow.tsx`) — S2, 구성안 §1 B

```ts
export type NewRoomRowProps = {
  title: string
  onChangeTitle: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  isSubmitting: boolean
  inputRef: Ref<HTMLInputElement>
}
```
- 렌더: `<div role="group" aria-label={labels.newRoomGroupAriaLabel}>` 52px 한 줄(좌우 `--space-4`, 사이 `--space-2`, 아래 1px `--row-divider`):
  1. `TextInput`(flex 1) `value={title}` `ariaLabel={labels.newRoomInputAriaLabel}` `placeholder={labels.newRoomPlaceholder}` `maxChars={ROOM_TITLE_MAX_CHARS}` `inputRef` `onEnter={onSubmit}` `onEscape={onCancel}` `isReadOnly={isSubmitting}`
  2. `Button size='sm' variant='secondary' isDisabled={isSubmitting} onClick={onCancel}` → `labels.cancel`
  3. `Button size='sm' variant='primary' isDisabled={isSubmitting || !isRoomTitleValid(title)} onClick={onSubmit}` → `labels.create`
- `onSubmit`을 Enter로 불러도 유효성·중복은 F-RM-17이 다시 막는다.
- **(S6) 2줄 판으로 바꾼다**(구성안 ui-layout-04 §2, lock.md §1.1). 위 S2 한 줄 렌더를 대체한다.
  ```ts
  export type NewRoomRowProps = {
    title: string
    onChangeTitle: (value: string) => void
    password: string                              // S6
    onChangePassword: (value: string) => void     // S6
    onSubmit: () => void
    onCancel: () => void
    isSubmitting: boolean
    inputRef: Ref<HTMLInputElement>               // 제목 입력(불변)
  }
  ```
  - 루트 `<div role="group" aria-label={labels.newRoomGroupAriaLabel}>` = 세로 flex(padding `--space-2` `--space-4`, 줄 간격 `--space-2`, 아래 1px `--row-divider`), 높이 96. 줄 2개는 각각 `<div class=line>`(가로 flex, `gap: var(--space-2)`, `align-items: center`). 버튼 슬롯 `<div class=action>`의 자식 `button`에 `min-width: 72px`(로컬 CSS 자식 선택자 — Button에 className prop이 없다).
  - B1: `TextInput`(제목, 위 S2 props 그대로, 단 **`onEnter={() => passwordInputRef.current?.focus()}`**) · `Button size='md' variant='secondary' isDisabled={isSubmitting} onClick={onCancel}` → `labels.cancel`
  - B2: `TextInput type='password' value={password} onChange={onChangePassword} ariaLabel={labels.newRoomPasswordAriaLabel} placeholder={labels.newRoomPasswordPlaceholder} maxChars={ROOM_PASSWORD_MAX} inputRef={passwordInputRef} onEnter={onSubmit} onEscape={onCancel} isReadOnly={isSubmitting}` · `Button size='md' variant='primary' isDisabled={isSubmitting || !isRoomTitleValid(title) || !isRoomPasswordValid(password)} onClick={onSubmit}` → `labels.create`
  - `passwordInputRef`는 컴포넌트 내부 `useRef`. DOM 순서 = 제목 → 취소 → 비밀번호 → 만들기(포커스 순서와 같다).
  - 버튼 크기는 S2의 `sm`에서 `md`(36)로 바뀐다 — 입력 높이 36과 맞추는 구성안 §2.1 폭 예산 기준.

---

## 3. 스타일 토큰

> **v1.7(2026-10-08, CR-002) 갠홈 estate 톤 보강:** 세 화면 공통 토큰 **값**(전/후 표)과 공용·화면 컴포넌트별 시각 규칙의 정본은 **`ui/src/chat/design/style.md`** §2 · §4다. 아래 표의 변수 이름·배치는 유효하고, 값이 다르면 style.md가 우선한다. §1.20 S2 토큰 중 `--sheet-radius`(→ `var(--radius-panel)` = `16px 0 0 0`) · `--sheet-shadow`(→ `inset 0 1px 0 var(--color-line-bright)`)도 style.md 값으로 바뀐다.
>
> **rooms 화면별 차이(이것만 rooms 고유):**
> | 대상 | 규칙 |
> |---|---|
> | 상단 바 제목 "ROOMS" | TopBar `variant='screen'` → 큰 세리프 `--font-display` 22px(`--text-display`) · 자간 .05em · `--color-accent`, 위에 장식 라벨 `THE PHANTOMHIVE ESTATE`(7px · .22em · `--label-color`, CSS `::before` + 빈 대체 텍스트 — 보조기기에 읽히지 않음, style.md §5). 바 배경 90도 머리띠 `--topbar-band` + 아래 1px `--color-border` |
> | 행 구분선 | `--row-divider` → `--color-line-faint`(연한 선). 행 hover `--row-hover-bg` → 옅은 푸른 바탕 `--btn-hover-bg` |
> | 「+ 새 방」 | Button md primary → 투명 바탕 + 1px `--btn-border-primary`(`#aebfd8`) + ivory 글자, 직각 |
> | ⚙ | IconButton → 선 없음 유지, 직각 hover |
> | 새 방 입력 행 | TextInput 비대칭 모서리 `--radius-field` · 바탕 `--input-bg`(sunken) · 「취소」 secondary 선형 · 「만들기」 primary 선형 |
> | rooms CSS 파일 | `ListRow`·`NewRoomRow`·`RoomList`·`RoomsScreen` `.module.css` **무수정**(변수 값 변경만으로 반영). 고치는 파일은 style.md §7의 공용 CSS |

| 대상 | 토큰(`.claude/skills/ui_design_concept.md`) |
|---|---|
| 화면 배경 | `--color-bg` |
| 상단 바 아래선·행 구분선 | `--color-border` · `--row-divider` |
| 행 제목 | serif md(14px) `--color-fg` |
| 행 날짜 | `--font-ui` xs(11px) `--color-fg-muted`, `tabular-nums` |
| 행 hover·active | `--row-hover-bg` |
| 간격 | 행 좌우 `--space-4`, 상태 블록 위아래 `--space-5` |
| 포커스 링 | `:focus-visible` 2px `--color-focus` 바깥 |
| 컴포넌트 변수 값 | `--row-hover-bg: var(--color-bg-elevated)` · `--row-divider: var(--color-border)` — `global.css`. S2 추가분은 §1.20 |
| (S2) 「+ 새 방」 | Button md primary, 상단 바 오른쪽 여백 `--space-4` |
| (S2) B 새 방 입력 행 | 52px, 배경 `--color-bg`, 아래 `--row-divider` |
| (S2) 토스트 줄 | 화면 맨 아래 in-flow(§1.18). 목록(C) 높이가 그만큼 줄어든다 |
| (S2) 화면 루트 | `.root { position: relative }`(두 화면 규칙 통일) |
| 파일 | `ui/src/rooms/styles/RoomsScreen.module.css`, 컴포넌트별 `{Name}.module.css`. 하드코딩 색 금지 |

- 전역 `ui/src/styles/global.css`(하나뿐): 리셋, `html, body, #root { height: 100% }`, ui_design_concept §3~§6 토큰, `prefers-reduced-motion`.
- Noto Serif KR은 `ui/index.html`의 `<link>`로. Vite `base: '/embed/'`. 정적 파일은 `ui/public/`.
