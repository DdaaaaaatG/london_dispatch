# TSX(React 18 + TypeScript) 파일 작성 규칙

React 화면·컴포넌트 구현 규칙. 기본 TS 규칙은 [ts-rules](ts-rules.md), 디자인 토큰·스타일 시스템은 [ui_design_concept](ui_design_concept.md) 참조.

## 역할 구분
이 파일은 React **구현 패턴(HOW)**을 정의한다: 컴포넌트 구조, Hook 규칙, 데이터 흐름, 대화 화면 처리, 테스트 규약.
**무엇을 만들지(WHAT)**는 화면 `design.md`·`COMPONENT.md`, **시각(Visual)**은 `ui_design_concept.md`.

---

## 1. 컴포넌트 구조

### 네이밍
- 컴포넌트·타입: PascalCase / 함수·변수: camelCase / 상수: UPPER_SNAKE_CASE / 파일: 컴포넌트명과 동일(`Bubble.tsx`).

### 화살표 함수 + Props 타입 export + 기본값 구조분해
```tsx
export type ToggleProps = {
  value: boolean
  onChange: (value: boolean) => void
  label: string
  size?: 'sm' | 'md' | 'lg'
  isDisabled?: boolean
}

export const Toggle = ({ value, onChange, label, size = 'md', isDisabled = false }: ToggleProps) => (
  <button role="switch" aria-checked={value} aria-label={label} disabled={isDisabled}
    className={cx(styles.root, styles[size])} onClick={() => onChange(!value)} />
)
```
- `props ?? {}` 패턴은 쓰지 않는다 — TS가 필수 props를 보장한다. 선택 props만 기본값을 준다.
- `React.FC` 사용 안 함. `children`이 필요하면 Props에 `children?: ReactNode`를 명시한다.

### 조건부 렌더링 (순서 고정: error → loading → data → empty)
```tsx
export const RoomList = ({ error, isLoading, rooms }: RoomListProps) =>
  error ? <ErrorNotice message={error} /> :
  isLoading ? <Spinner /> :
  rooms.length > 0 ? <ul>{rooms.map(r => <ListRow key={r.id} room={r} />)}</ul> :
  <EmptyState text={labels.rooms.empty} />
```

### 토큰 분기는 미렌더
```tsx
// Good — DOM에 없어야 한다
{viewer.canWrite && <Composer onSpeak={speak} onSend={send} />}
// Bad — 숨기기·비활성화는 분기가 아니다
<Composer hidden={!viewer.canWrite} />   ❌
```

### Props Spread
```tsx
const textAreaProps = { value: draft, onChange: setDraft, maxLength: 2000, submitOnEnter: true }
return <TextArea {...textAreaProps} />
```

### 순수 컴포넌트
- 같은 props → 같은 렌더. `window`·`location`·모듈 전역·`Date.now()`를 렌더 중에 읽지 않는다. 토큰은 `api/client.ts`가 기동 시 읽고 `viewer` 상태로 내려온다.

### 불변성
```tsx
const replacePending = (messages: Message[], tempId: string, next: Message) =>
  messages.map(m => (m.id === tempId ? next : m))
// Bad: messages[i].text = next.text  ❌
```

## 2. Hook 규칙
- 최상위 레벨에서만 호출, 조건문·반복문 안 금지.
- `useEffect`는 **구독·타이머·외부 동기화**(스크롤 위치·`localStorage` 저장·`IntersectionObserver`)에만. 파생 값은 `useMemo` 또는 그냥 계산. cleanup 필수.
```tsx
useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadOlder())
  if (topSentinel.current) observer.observe(topSentinel.current)
  return () => observer.disconnect()
}, [loadOlder])
```
- 커스텀 훅은 `use{Name}`, 하나의 관심사만. api 호출 훅은 **화면 폴더 또는 `components/hooks`**에 두되 내부에서는 `@/api` 래퍼만 호출한다.
- `localStorage`는 전용 훅(`useLocalValue`)에서 try/catch로만 접근한다. 실패하면 메모리 값으로 동작한다.

## 3. 상태 관리 원칙
- **최소화·최상위 집중**: 화면이 공유하는 상태는 `index.tsx`에 모은다. 하위 전용 상태만 하위에.
- **대화 상태는 `ui/src/state/chat.ts`의 순수 리듀서**를 `useReducer`로 감싼다. 컴포넌트 안에 전이 규칙(잠금 해제 조건·커서 갱신·임시 말풍선 교체)을 다시 쓰지 않는다.
- **서버가 단일 진실**: 낙관적 갱신 금지. 응답을 받은 뒤 리듀서에 반영한다. 임시 말풍선(`pending`)은 상태의 일부이지 서버 데이터가 아니다.
- props가 3단계 이상 깊어지면 Context(`ViewerContext`만 허용). Context 값은 `useMemo`로 감싼다.

## 4. 데이터 흐름 (contract 경계)
```
화면 핸들러 ─call→ @/api/*.ts (Result<T>) ─dispatch→ state 리듀서 ─props→ Bubble·ListRow
```
- 화면·컴포넌트·state에서 `fetch` 직접 사용 금지. 래퍼 함수 이름은 `api.md`와 동일하게.
- 래퍼는 `Result<T>`를 반환한다. 화면은 `result.ok` 분기로 오류 문구(`labels.errors[code]`)를 보여준다. `try/catch` 없음.
- 에러 코드별 처리는 design.md 계약 사용표가 정한다. 특히 `TOKEN_INVALID`(만료 포함)·`TOKEN_REQUIRED`·`LEVEL_TOO_LOW`는 쓰기 UI 미렌더 전환, `SPEAK_IN_PROGRESS`는 실패 말풍선 + 「재시도」(자동 해제 타이머 없음, S3 D-16), `RATE_LIMITED`는 `retryAfterSec` 안내.

## 5. 대화 화면 처리 규칙 (ui/src/chat 전용)
- **생성 중 잠금은 상태**(`pending !== null`)로. `setTimeout` 디바운스·`disabled` 플래그를 따로 두지 않는다.
- **스크롤 보존**: 과거 로드 전 `scrollHeight`를 ref에 저장 → 렌더 후 `useLayoutEffect`에서 차이만큼 `scrollTop` 보정. 새 메시지는 맨 아래 근접(≤120px)일 때만 `scrollIntoView({ block: 'end' })`.
- **말풍선 액션 버튼**(S3e, 2026-10-07): 수정·삭제·재작성은 말풍선 아래 `BubbleActions`(chat 지역 컴포넌트, 공용 `Button sm ghost` 3개)로 늘 보인다. 롱프레스/우클릭 메뉴는 없다. 공용 `useLongPress`는 사용처 0(정리 후보)이며 새 화면에서 메뉴 트리거로 되살리지 않는다. 잠금은 `isActionLocked`(`!canSpeak || roomBusy !== null`) → 네이티브 `disabled`.
- **인라인 수정**: 말풍선 자리에서 `TextArea` 전환, `Esc` 취소, 저장은 응답 후 반영. 생성 중에는 저장 버튼만 `disabled`(취소·입력은 활성, S3d).
- 히스토리 컨테이너 `role="log" aria-live="polite"`. 생성 중 표시는 임시 말풍선 `role="status"` + 버튼 네이티브 `disabled`(`aria-busy` 묶음 없음, S3 D-16).
- 말풍선 목록은 `memo`로 격리하고 key는 서버 id(임시는 `temp-{n}`).

## 6. CSS Modules 규약
- 파일: `{Name}.module.css`, import: `import styles from './{Name}.module.css'`.
- 클래스 조합은 `cx(...)`(`@/components/utils/cx`, 없으면 배열 `filter(Boolean).join(' ')`).
- 색·간격·폰트·반경은 `ui_design_concept.md`의 CSS 변수만(`var(--color-bg)`). 하드코딩 색상 금지.
- 전역 스타일은 `ui/src/styles/global.css` 한 곳. 컴포넌트에서 전역 선택자(`:global`)를 만들지 않는다.
- 높이는 `height: 100%` 체인(`html, body, #root`)으로 부모 iframe을 따른다. `100vh`·`100dvh` 금지.

## 7. 접근성
- 시맨틱 태그 우선(`button`·`label`·`ul/li`·`textarea`). 클릭 가능한 `div` 금지.
- 아이콘 버튼은 `aria-label`(문구는 `labels.ts`). 입력은 `<label htmlFor>` + `id`.
- 오류는 `role="alert"`, 동적 갱신 영역은 `aria-live="polite"`, 생성 중은 `aria-busy`.
- 키보드: Tab 순서 자연스럽게, `Esc`로 시트·수정 닫기, `Enter` 전송 / `Shift+Enter` 줄바꿈. 말풍선 액션은 Tab으로 닿는 버튼(메뉴 키 없음, S3e). 포커스 링은 `:focus-visible`.
- 바텀시트는 포커스 트랩 + 닫힐 때 트리거로 복귀.

## 8. 파일 크기·분리
- TSX 400줄 한계. 넘으면 서브 컴포넌트로 분리. `index.tsx`는 조립·상태·핸들러 중심.
- 같은 JSX 패턴 3회 이상이면 컴포넌트로 추출(화면 로컬 `components/`, 두 화면이 쓰면 승격 후보).

## 9. 테스트 규약 (vitest + @testing-library/react)
- 파일: 컴포넌트 옆 `{Name}.test.tsx`, 리듀서는 `ui/src/state/{name}.test.ts`.
- 케이스 이름은 시나리오 TC-ID로 시작: `it('TC-CH-015 세바스찬 버튼 클릭 시 speak를 호출하고 버튼을 잠근다', …)`.
- 조회는 `getByRole`(name 지정) 우선 → `getByLabelText` → `getByText`. `data-testid`는 role이 없을 때만.
- 사용자 조작은 `@testing-library/user-event`. 타이머가 있는 코드(토스트 등)는 `vi.useFakeTimers()`로 결정적으로 만든다(생성 중 상태에는 타이머가 없다 — 응답으로만 풀린다).
- **api mock 패턴**: `vi.mock('@/api/messages')`·`vi.mock('@/api/rooms')`로 래퍼를 모킹한다. `fetch`를 직접 모킹하지 않는다.
  ```tsx
  vi.mock('@/api/messages', () => ({
    speak: vi.fn(async () => ({ ok: true, value: fixtureMessage })),
  }))
  ```
- `viewer.canWrite` 두 경우를 각각 렌더해 쓰기 UI가 DOM에 **없음/있음**을 `queryByRole`로 단언한다.
- 렌더 스냅샷 테스트 금지. 동작·표시 결과를 단언한다.
- `IntersectionObserver`·`scrollIntoView`는 `vi.stubGlobal`로 고정한다.
