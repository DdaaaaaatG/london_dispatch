/** [계약] api.md §14.2 API-T-042 · [요구] R-API-001, R-API-008 */
import { describe, expect, it } from 'vitest'
import { endpoints, PATHS } from '../src/endpoints'
import type { MessagesQuery } from '../src/types'

describe('API-T-042 endpoints_build_paths_and_queries', () => {
  it('PATHS 값 4개가 계약과 같다', () => {
    expect(PATHS).toEqual({
      embed: '/embed',
      health: '/api/health',
      rooms: '/api/rooms',
      roomMessages: '/api/rooms/:id/messages',
    })
  })

  it('고정 경로 빌더', () => {
    expect(endpoints.health()).toBe('/api/health')
    expect(endpoints.rooms()).toBe('/api/rooms')
  })

  it('roomMessages는 id를 인코딩한다', () => {
    expect(endpoints.roomMessages('a b/c')).toBe('/api/rooms/a%20b%2Fc/messages')
  })

  it('쿼리를 붙인다', () => {
    expect(endpoints.roomMessages('r1', { before: 41 })).toBe('/api/rooms/r1/messages?before=41')
    expect(endpoints.roomMessages('r1', { before: 41, limit: 30 })).toBe(
      '/api/rooms/r1/messages?before=41&limit=30',
    )
  })

  it('빈 쿼리·undefined 값은 물음표를 붙이지 않는다', () => {
    expect(endpoints.roomMessages('r1', {})).toBe('/api/rooms/r1/messages')
    expect(endpoints.roomMessages('r1', { limit: undefined } as unknown as MessagesQuery)).toBe('/api/rooms/r1/messages')
  })
})
