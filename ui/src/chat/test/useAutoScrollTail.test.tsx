/**
 * useAutoScroll tailKey 스펙 초안(TDD Red) — 단일 소스 ui/src/chat/test/scenarios.md (TC-CH-091)
 * 대상: ui/src/components/hooks/useAutoScroll.ts 옵션 tailKey (design/components.md §3 v1.7 행 · F-CH-40)
 * - 하네스·스크롤 수치는 useAutoScroll.test.tsx 와 같다(scrollHeight 변수 · clientHeight 493 · scrollTop 비클램프).
 * - 훅은 api 를 모른다 → api 래퍼 호출 없음.
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
  for (const key of ['scrollHeight', 'clientHeight', 'scrollTop'])
    Reflect.deleteProperty(HTMLElement.prototype, key)
})

type HarnessProps = UseAutoScrollOptions & { resultRef: { current: UseAutoScrollResult | null } }

const Harness = ({ resultRef, ...options }: HarnessProps) => {
  const result = useAutoScroll(options)
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
    tailKey: null,
    ...over,
  }
  const view = render(<Harness {...options} resultRef={resultRef} />)
  const el = screen.getByRole('log')
  const rerenderWith = (next: Partial<UseAutoScrollOptions>) => {
    Object.assign(options, next)
    view.rerender(<Harness {...options} resultRef={resultRef} />)
  }
  return { el, rerenderWith }
}

beforeEach(() => {
  box.scrollHeight = 3000
  box.clientHeight = 493
})

afterEach(() => {
  cleanup()
})

describe('useAutoScroll tailKey (R-CHAT-003 · R-CHAT-005)', () => {
  it('TC-CH-091: null → "sebastian:generating" 이고 맨 아래 근처였으면 scrollTop = scrollHeight', () => {
    const { el, rerenderWith } = setup()
    expect(el.scrollTop).toBe(2507)
    box.scrollHeight = 3100
    rerenderWith({ tailKey: 'sebastian:generating' })
    expect(el.scrollTop).toBe(3100)
  })

  it('TC-CH-091: 위쪽(거리 > 120)을 보는 중이면 tailKey 가 바뀌어도 scrollTop 그대로', () => {
    const { el, rerenderWith } = setup()
    el.scrollTop = 1000
    fireEvent.scroll(el)
    box.scrollHeight = 3100
    rerenderWith({ tailKey: 'sebastian:generating' })
    expect(el.scrollTop).toBe(1000)
  })

  it('TC-CH-091: "generating" → "failed" 도 새 값 — 맨 아래 근처면 다시 맨 아래', () => {
    const { el, rerenderWith } = setup()
    box.scrollHeight = 3100
    rerenderWith({ tailKey: 'ciel:generating' })
    expect(el.scrollTop).toBe(3100)
    box.scrollHeight = 3150
    rerenderWith({ tailKey: 'ciel:failed' })
    expect(el.scrollTop).toBe(3150)
  })

  it('TC-CH-091: 값 → null 은 아무것도 하지 않는다', () => {
    const { el, rerenderWith } = setup()
    box.scrollHeight = 3100
    rerenderWith({ tailKey: 'ciel:failed' })
    expect(el.scrollTop).toBe(3100)
    el.scrollTop = 2900
    box.scrollHeight = 3000
    rerenderWith({ tailKey: null })
    expect(el.scrollTop).toBe(2900)
  })

  it('TC-CH-091: 첫 배치 전(firstId=null)에는 tailKey 변화를 무시하고, 첫 배치가 맨 아래로 놓는다', () => {
    const { el, rerenderWith } = setup({ firstId: null, lastId: null })
    expect(el.scrollTop).toBe(0)
    box.scrollHeight = 2300
    rerenderWith({ tailKey: 'sebastian:generating' })
    expect(el.scrollTop).toBe(0)
    box.scrollHeight = 2400
    rerenderWith({ firstId: 105, lastId: 105, tailKey: null })
    expect(el.scrollTop).toBe(2400 - 493)
  })
})
