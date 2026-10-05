# TypeScript 코드 작성 규칙

`server/**`·`shared/**`·`ui/**`의 모든 `.ts`·`.tsx`에 적용한다. React 전용 규칙은 [tsx-rules](tsx-rules.md), 서버 관례는 [server-rules](server-rules.md), 디자인 토큰은 [ui_design_concept](ui_design_concept.md) 참조.

## 변수 선언
- `const` 기본, 변경 필요 시 `let`. `var` 금지.

## 세미콜론
- 사용 안 함(prettier `semi: false`).

## 문자열 따옴표
- 기본 `'`. 내부에 `'`가 있을 때만 `"`. 보간은 템플릿 리터럴.

## 들여쓰기
- 2칸, 최대 3레벨. 넘으면 함수로 뺀다.

## 괄호 최소화
```typescript
// Bad
const double = (x: number) => x * 2   // 단일 인자면 괄호 생략 가능 — 단, 타입 주석이 있으면 유지
// Good (타입 없이 추론될 때)
const ids = list.map(item => item.id)
```

## 선언형 코드
```typescript
// Bad
const page = toPage(sortByIdAsc(rows))
// Good
const ordered = sortByIdAsc(rows)
const page = toPage(ordered)
```

## 타입 규칙 (핵심)
- **명시적 타입은 경계에만**: 계약 타입(`shared/src/types.ts`), 컴포넌트 `Props`, `ui/src/state` 입출력, 서비스 export 함수 시그니처, `env` 스키마. 지역 변수는 추론에 맡긴다.
- **`any` 금지.** 외부 입력(HTTP body·DB row·LLM 응답·`localStorage`)은 `unknown`으로 받고 narrowing(타입 가드·zod)으로 좁힌다.
- **유니온·리터럴 타입**으로 상태를 표현한다. 문자열 enum 대신 `as const` 객체 + `keyof typeof`.
  ```typescript
  export const Speaker = { sebastian: 'sebastian', ciel: 'ciel', user: 'user' } as const
  export type Speaker = (typeof Speaker)[keyof typeof Speaker]
  ```
- `interface`는 확장·구현이 필요한 객체 형태(`LlmProvider`)에, 그 외는 `type`.
- 옵셔널은 `?`로 표기하고 `undefined` 유니온을 중복해서 쓰지 않는다.
- `null`은 계약 응답에서만 허용(`summary: string | null`, `nextBefore: number | null`). 화면 내부·서비스 내부에서는 `undefined`.
- 타입 단언(`as`)은 테스트·narrowing 불가 지점에만. `!` non-null 단언 금지.
- 판별 유니온에는 `switch`와 `never` 체크로 완전성을 보장한다.

## 구조분해 할당
```typescript
const { roomId, character } = input
const [items, nextBefore] = page
```

## 함수
- 화살표 함수 기본. 순수 함수 우선(`ui/src/state`·`components/utils`·`server/src/llm/prompt.ts`·`postprocess.ts`는 부수효과 금지).
- 단일 책임, 함수 50줄 한계.
```typescript
const clampLimit = (v: number, max = 100) => Math.min(Math.max(v, 1), max)

const isNearBottom = (el: HTMLElement, threshold = 120) =>
  el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
```

## Array 메서드
- `for` 루프 최소화. `map`/`filter`/`reduce`/`find`/`some`. 대량 행 변환이 프로파일로 증명될 때만 예외.

## 클로저로 스코프 최소화
```typescript
// Bad — 모듈 전역 가변 상태
let speakLocks = new Set<string>()
// Good — 팩토리로 캡슐화
export const createSpeakLock = () => {
  const locked = new Set<string>()
  return {
    acquire: (roomId: string) => (locked.has(roomId) ? false : (locked.add(roomId), true)),
    release: (roomId: string) => { locked.delete(roomId) },
  }
}
```

## Import 규칙
자신의 폴더 외 참조 시 alias 사용(`tsconfig.paths`·vite alias 동일):
- ui: `@/*`(ui/src 루트), `@shared/*`(shared/src)
- server: `@shared/*`(shared/src). 서버 내부는 상대 경로(모듈 `index.ts` 경유)
```typescript
import { Bubble } from '@/components/ui/Bubble'        // ui 다른 폴더 → alias
import type { Message } from '@shared/types'            // 계약 타입
import { reduceChat } from '@/state/chat'
import { helper } from './helper'                       // 같은 폴더 → 상대 경로
```
- `fetch`는 **`ui/src/api/` 안에서만** 호출한다. 화면·컴포넌트·state에서 직접 사용 금지.
- Workers `env` 바인딩의 설정 키·`process.env`·`import.meta.env` 읽기는 **`server/src/env.ts`의 `parseEnv`에서만**. 다른 서버 모듈은 `parseEnv` 결과(`Env` 값)를 팩토리 인자로 받는다. 바인딩 객체를 직접 import·접근하지 않는다.
- 제공사 SDK(`@anthropic-ai/sdk`·`openai`·`@google/genai`)는 **`server/src/llm/` 안에서만** import.
- `import type`으로 타입만 가져온다(런타임 번들 제외).

### 저장 시 정리
- 미사용 import·변수 제거(eslint `@typescript-eslint/no-unused-vars`).

## 주석
- 복잡한 로직의 의도·전략·알고리즘 핵심만. 무엇을 하는지는 코드가 말한다.
- export 함수는 JSDoc 한 줄(`/** 스크롤 위치를 보존하며 앞쪽에 메시지를 붙인다 */`).
- TODO는 `// TODO(요구ID): 내용` 또는 `// TODO(contract): …`. 요구ID 없는 TODO 금지.

## 논리 연산자

| 연산자 | 용도 |
|--------|------|
| `&&` | 조건 true 시 렌더링/실행 |
| `??` | null/undefined 시 기본값 (`\|\|`는 0·''를 삼키므로 숫자·문자열 기본값에 쓰지 않는다) |
| `?.` | 안전한 프로퍼티 접근 |
| 삼항 | 두 갈래 값 선택. 중첩 삼항 금지 |

## 코드 최소화
```typescript
input.onblur = () => commit(input.value)                     // 단일 표현식: 중괄호 제거
const toggle = (id: string) => (isSelected(id) ? deselect(id) : select(id))
```

## 에러 처리
- **api 래퍼(`ui/src/api/`)는 throw하지 않는다.** 모든 함수는 `Promise<Result<T>>`를 반환한다.
  ```typescript
  export type Result<T> =
    | { ok: true; value: T }
    | { ok: false; error: { code: ErrorCode | 'NETWORK'; message: string } }
  ```
  HTTP 에러 응답(`{ error: { code, message } }`)은 그대로 `error`로, 네트워크 실패는 `{ code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }`로 정규화한다. 화면은 `result.ok` 분기로 처리하고 `try/catch`를 쓰지 않는다. (contract-design-strategy §11과 같은 규칙)
- 사용자에게 보이는 오류 문구는 `labels.ts` 키로만(`labels.errors[code]`, 없으면 `labels.errors.default`).
- 서버 서비스는 `AppError`만 throw한다(server-rules.md).
