/**
 * ui vitest 공통 setup.
 * @testing-library/react 의 asyncWrapper 는 전역 `jest` 가 있을 때만 가짜 시계를 0ms 전진시킨다.
 * vitest 에는 `jest` 전역이 없어 `vi.useFakeTimers()` 아래에서 `userEvent.pointer` 가 멈춘다
 * (TC-CH-039·054·060). vitest 의 advanceTimersByTime 을 같은 이름으로 노출해 보정한다.
 * `vi.stubGlobal` 이 아니라 직접 대입이어야 한다 — 일부 스펙의 afterEach 가 `vi.unstubAllGlobals()` 를 부른다.
 */
import { vi } from 'vitest'

;(globalThis as unknown as { jest: unknown }).jest = {
  advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
}
