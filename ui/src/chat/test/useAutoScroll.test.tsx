/**
 * useAutoScroll 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md
 * 대상: ui/src/components/hooks/useAutoScroll.ts (chat design/components.md §3, F-CH-14)
 * - 테스트 하네스 컴포넌트가 훅을 부르고 role="log" div 에 containerRef·onScroll 을 연결한다(하네스는 테스트 코드).
 * - 스크롤 수치는 ChatScroll.test.tsx 와 같은 방식으로 고정한다: scrollHeight 3000 · clientHeight 493.
 * - 훅은 api 를 모른다(id 두 개와 스크롤 박스만 안다) → api 래퍼 호출 없음.
 */
import { useEffect } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  type UseAutoScrollOptions,
  type UseAutoScrollResult,
  useAutoScroll,
} from '@/components/hooks/useAutoScroll'

const box = { scrollHeight: 3000, clientHeight: 493 }
const scrollTops = new WeakMap<Element, number>()
const isScrollBox = (el: Element): boolean => el.getAttribute('role') === 'log'

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isScrollBox(this) ? box.scrollHeight : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isScrollBox(this) ? box.clientHeight : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get(this: HTMLElement) {
      return scrollTops.get(this) ?? 0
    },
    set(this: HTMLElement, value: number) {
      scrollTops.set(this, value)
    },
  })
})

afterAll(() => {
  for (const key of ['scrollHeight', 'clientHeight', 'scrollTop']) Reflect.deleteProperty(HTMLElement.prototype, key)
})

type HarnessProps = UseAutoScrollOptions & { resultRef: { current: UseAutoScrollResult | null } }

const Harness = ({ resultRef, ...options }: HarnessProps) => {
  const result = useAutoScroll(options)
  // 렌더 중 ref 대입 금지(react-hooks/refs) → 커밋 뒤 effect 에서 최신 결과를 넘긴다.
  // 의존 배열 없음 = 매 렌더 뒤 갱신. render/rerender 는 act 로 감싸져 effect 까지 끝난 뒤 돌아온다.
  useEffect(() => {
    resultRef.current = result
  })
  return <div ref={result.containerRef} role="log" onScroll={result.onScroll} />
}

const setup = (over: Partial<UseAutoScrollOptions> = {}) => {
  const resultRef: { current: UseAutoScrollResult | null } = { current: null }
  const options: UseAutoScrollOptions = {
    firstId: 31,
    lastId: 60,
    initialDistanceFromBottom: null,
    canAutoLoadOlder: false,
    onReachTop: vi.fn(),
    onReachBottom: vi.fn(),
    ...over,
  }
  const view = render(<Harness {...options} resultRef={resultRef} />)
  const el = screen.getByRole('log')
  const rerenderWith = (next: Partial<UseAutoScrollOptions>) => {
    Object.assign(options, next)
    view.rerender(<Harness {...options} resultRef={resultRef} />)
  }
  return { ...view, el, options, resultRef, rerenderWith }
}

const userScrollTo = (el: HTMLElement, top: number) => {
  el.scrollTop = top
  fireEvent.scroll(el)
}

beforeEach(() => {
  box.scrollHeight = 3000
  box.clientHeight = 493
})

afterEach(() => {
  cleanup()
})

describe('useAutoScroll 첫 배치 (R-CHAT-010 복원 · R-CHAT-003)', () => {
  it('TC-CH-025: 저장 거리 null → 맨 아래, 300 → 2207, 내용보다 큰 값 → 0(클램프)', () => {
    expect(setup({ initialDistanceFromBottom: null }).el.scrollTop).toBe(2507)
    cleanup()
    expect(setup({ initialDistanceFromBottom: 300 }).el.scrollTop).toBe(2207)
    cleanup()
    expect(setup({ initialDistanceFromBottom: 99999 }).el.scrollTop).toBe(0)
  })

  it('TC-CH-025: firstId=null 이면 아무것도 하지 않고 getDistanceFromBottom()=null, 이후 id 가 생기면 그때 배치', () => {
    const { el, resultRef, rerenderWith, options } = setup({ firstId: null, lastId: null, initialDistanceFromBottom: 300 })
    expect(el.scrollTop).toBe(0)
    expect(resultRef.current?.getDistanceFromBottom()).toBeNull()
    expect(options.onReachTop).not.toHaveBeenCalled()

    rerenderWith({ firstId: 31, lastId: 60 })
    expect(el.scrollTop).toBe(2207)
    expect(resultRef.current?.getDistanceFromBottom()).toBe(300)
  })

  it('TC-CH-025: 언마운트 뒤에도 getDistanceFromBottom() 은 마지막 값', () => {
    const { el, resultRef, unmount } = setup()
    userScrollTo(el, 1000)
    unmount()
    expect(resultRef.current?.getDistanceFromBottom()).toBe(1507)
  })

  it('TC-CH-011: 첫 배치가 맨 위 근처이고 canAutoLoadOlder 면 onReachTop 1회, 아니면 0회', () => {
    box.scrollHeight = 400
    const auto = setup({ canAutoLoadOlder: true })
    expect(auto.options.onReachTop).toHaveBeenCalledTimes(1)
    cleanup()
    const manual = setup({ canAutoLoadOlder: false })
    expect(manual.options.onReachTop).not.toHaveBeenCalled()
  })
})

describe('useAutoScroll 앞붙임·뒤붙임 (R-CHAT-003)', () => {
  it('TC-CH-012: firstId 감소(앞붙임) → scrollTop = 이전 scrollTop + Δ scrollHeight', () => {
    const { el, rerenderWith } = setup()
    userScrollTo(el, 40)
    box.scrollHeight = 6000
    rerenderWith({ firstId: 1 })
    expect(el.scrollTop).toBe(3040)
  })

  it('TC-CH-012: 앞·뒤가 한 번에 바뀌고 맨 아래 근처였으면 → 앞붙임 보정 후 맨 아래', () => {
    const { el, rerenderWith } = setup() // 2507, 맨 아래
    box.scrollHeight = 6200
    rerenderWith({ firstId: 1, lastId: 61 })
    expect(el.scrollTop).toBe(6200)
  })

  it('TC-CH-012: 앞·뒤가 한 번에 바뀌고 위쪽을 보던 중이면 → 앞붙임 보정만', () => {
    const { el, rerenderWith } = setup()
    userScrollTo(el, 1000)
    box.scrollHeight = 6200
    rerenderWith({ firstId: 1, lastId: 61 })
    expect(el.scrollTop).toBe(4200) // 1000 + 3200
  })

  it('TC-CH-018: 뒤붙임 + 붙기 전 맨 아래 근처 → scrollTop = scrollHeight', () => {
    const { el, rerenderWith, resultRef } = setup()
    expect(resultRef.current?.isNearBottom()).toBe(true)
    box.scrollHeight = 3200
    rerenderWith({ lastId: 61 })
    expect(el.scrollTop).toBe(3200)
  })

  it('TC-CH-018: 뒤붙임 + 위쪽을 보는 중 → scrollTop 그대로', () => {
    const { el, rerenderWith, resultRef } = setup()
    userScrollTo(el, 1000)
    expect(resultRef.current?.isNearBottom()).toBe(false)
    box.scrollHeight = 3200
    rerenderWith({ lastId: 61 })
    expect(el.scrollTop).toBe(1000)
  })
})

describe('useAutoScroll onScroll·scrollToBottom (R-CHAT-003)', () => {
  it('TC-CH-020: 맨 아래 근처(거리 ≤ 120)로 스크롤 → onReachBottom, 121 이면 호출 안 함', () => {
    const { el, options } = setup()
    userScrollTo(el, 1000)
    userScrollTo(el, 2386) // 거리 121
    expect(options.onReachBottom).not.toHaveBeenCalled()
    userScrollTo(el, 2387) // 거리 120
    expect(options.onReachBottom).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-020: 맨 위 도달 시 canAutoLoadOlder 가 false 면 onReachTop 없음, true 로 바뀌면 호출(최신 값 사용)', () => {
    const { el, options, rerenderWith } = setup({ canAutoLoadOlder: false })
    userScrollTo(el, 0)
    expect(options.onReachTop).not.toHaveBeenCalled()
    rerenderWith({ canAutoLoadOlder: true })
    userScrollTo(el, 10)
    expect(options.onReachTop).toHaveBeenCalledTimes(1)
  })

  it('TC-CH-019: scrollToBottom() → scrollTop = scrollHeight, 이후 isNearBottom() true', () => {
    const { el, resultRef } = setup()
    userScrollTo(el, 500)
    resultRef.current?.scrollToBottom()
    expect(el.scrollTop).toBe(3000)
    expect(resultRef.current?.isNearBottom()).toBe(true)
  })
})
