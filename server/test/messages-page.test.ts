// SRV-T-060~065 — doc/200_설계/server/messages.md §8 (순수 함수 단위)
import { describe, expect, it } from 'vitest'
import { AppError } from '../src/app-error'
import type { Message } from '../src/db'
import { normalizePageQuery, toPage } from '../src/messages'

const msg = (id: number): Message => ({
  id,
  roomId: 'r',
  speaker: 'ciel',
  kind: 'line',
  text: `m${id}`,
  authorName: null,
  createdAt: id,
})

const expectValidation = (fn: () => unknown): void => {
  let caught: unknown
  try {
    fn()
  } catch (e) {
    caught = e
  }
  expect(caught).toBeInstanceOf(AppError)
  expect((caught as AppError).code).toBe('VALIDATION_ERROR')
  expect((caught as AppError).status).toBe(400)
}

describe('normalizePageQuery', () => {
  it('SRV-T-060 normalizePageQuery_applies_default_limit_30', () => {
    expect(normalizePageQuery({})).toEqual({ limit: 30 })
    expect(normalizePageQuery({ before: 5 })).toEqual({ limit: 30, before: 5 })
  })

  it('SRV-T-061 normalizePageQuery_rejects_limit_out_of_range', () => {
    expectValidation(() => normalizePageQuery({ limit: 0 }))
    expectValidation(() => normalizePageQuery({ limit: 101 }))
    expect(normalizePageQuery({ limit: 1 }).limit).toBe(1)
    expect(normalizePageQuery({ limit: 100 }).limit).toBe(100)
  })

  it('SRV-T-062 normalizePageQuery_rejects_non_integer_limit', () => {
    for (const limit of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectValidation(() => normalizePageQuery({ limit }))
    }
  })

  it('SRV-T-063 normalizePageQuery_rejects_before_not_positive', () => {
    expectValidation(() => normalizePageQuery({ before: 0 }))
    expectValidation(() => normalizePageQuery({ before: -1 }))
  })

  it('SRV-T-064 normalizePageQuery_rejects_non_safe_integer_before', () => {
    for (const before of [1.5, Number.NaN, 2 ** 53]) {
      expectValidation(() => normalizePageQuery({ before }))
    }
  })
})

describe('toPage', () => {
  it('SRV-T-065 toPage_returns_ascending_messages_and_hasMore', () => {
    const rows = [5, 4, 3, 2].map(msg)
    const more = toPage(rows, 3)
    expect(more.messages.map((m) => m.id)).toEqual([3, 4, 5])
    expect(more.hasMore).toBe(true)
    const exact = toPage([3, 2, 1].map(msg), 3)
    expect(exact.messages.map((m) => m.id)).toEqual([1, 2, 3])
    expect(exact.hasMore).toBe(false)
    expect(toPage([], 3)).toEqual({ messages: [], hasMore: false })
  })
})
