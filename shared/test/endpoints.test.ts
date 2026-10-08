/** [계약] api.md §14.2 API-T-042 · [요구] R-API-001, R-API-008 */
import { describe, expect, it } from 'vitest'
import { endpoints, PATHS, ROOM_KEY_HEADER } from '../src/endpoints'
import type {
  ApiErrorBody,
  CreateRoomBody,
  EditMessageBody,
  MessagesQuery,
  RenameRoomBody,
  SpeakBody,
  UserMessageBody,
} from '../src/types'

describe('API-T-042 endpoints_build_paths_and_queries', () => {
  it('PATHS 값 13개가 계약과 같다', () => {
    expect(PATHS).toEqual({
      embed: '/embed',
      health: '/api/health',
      rooms: '/api/rooms',
      roomMessages: '/api/rooms/:id/messages',
      room: '/api/rooms/:id',
      roomUser: '/api/rooms/:id/user',
      message: '/api/messages/:id',
      roomSpeak: '/api/rooms/:id/speak',
      messageRegenerate: '/api/messages/:id/regenerate',
      characterSettings: '/api/settings/characters',
      roomMemory: '/api/rooms/:id/memory',
      roomEnter: '/api/rooms/:id/enter',
      roomPassword: '/api/rooms/:id/password',
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
    expect(endpoints.roomMessages('r1', { limit: undefined } as unknown as MessagesQuery)).toBe(
      '/api/rooms/r1/messages',
    )
  })
})

describe('API-T-045 endpoints_build_write_paths', () => {
  it('쓰기 경로 패턴', () => {
    expect(PATHS.room).toBe('/api/rooms/:id')
    expect(PATHS.roomUser).toBe('/api/rooms/:id/user')
    expect(PATHS.message).toBe('/api/messages/:id')
  })

  it('빌더가 id를 채우고 인코딩한다', () => {
    expect(endpoints.room('a b/c')).toBe('/api/rooms/a%20b%2Fc')
    expect(endpoints.roomUser('r1')).toBe('/api/rooms/r1/user')
    expect(endpoints.message(41)).toBe('/api/messages/41')
  })

  it('타입: 본문 타입이 계약 모양이고 retryAfterSec는 선택이다', () => {
    const a: CreateRoomBody = { title: 't' }
    const b: RenameRoomBody = { title: 't' }
    const c: UserMessageBody = { text: 'x', ooc: false }
    const d: EditMessageBody = { text: 'x' }
    const e: ApiErrorBody = { error: { code: 'RATE_LIMITED', message: 'm', retryAfterSec: 5 } }
    const f: ApiErrorBody = { error: { code: 'NOT_FOUND', message: 'm' } }
    expect([a, b, c, d, e, f]).toHaveLength(6)
  })
})

describe('API-T-047 endpoints_build_generate_paths', () => {
  it('생성 경로 패턴', () => {
    expect(PATHS.roomSpeak).toBe('/api/rooms/:id/speak')
    expect(PATHS.messageRegenerate).toBe('/api/messages/:id/regenerate')
  })

  it('빌더가 id를 채우고 인코딩한다', () => {
    expect(endpoints.roomSpeak('a b/c')).toBe('/api/rooms/a%20b%2Fc/speak')
    expect(endpoints.messageRegenerate(72)).toBe('/api/messages/72/regenerate')
  })

  it('타입: SpeakBody 는 character 하나', () => {
    const a: SpeakBody = { character: 'ciel' }
    expect(a.character).toBe('ciel')
  })
})

describe('API-T-104 endpoints_build_settings_path', () => {
  it('설정 경로는 GET·PUT 공용 한 개', () => {
    expect(PATHS.characterSettings).toBe('/api/settings/characters')
    expect(endpoints.characterSettings()).toBe('/api/settings/characters')
  })
})

describe('API-T-124 room_memory_builder_encodes_id', () => {
  it('장기기억 경로는 방 id 를 인코딩한다', () => {
    expect(endpoints.roomMemory('r1')).toBe('/api/rooms/r1/memory')
    expect(endpoints.roomMemory('a b/c')).toBe('/api/rooms/a%20b%2Fc/memory')
  })
})

describe('API-T-042b room_lock_builders_and_header (S6, R-LOCK-004 · R-LOCK-007)', () => {
  it('roomEnter·roomPassword 빌더가 id를 인코딩한다', () => {
    expect(endpoints.roomEnter('r1')).toBe('/api/rooms/r1/enter')
    expect(endpoints.roomEnter('a b/c')).toBe('/api/rooms/a%20b%2Fc/enter')
    expect(endpoints.roomPassword('r1')).toBe('/api/rooms/r1/password')
    expect(endpoints.roomPassword('a b/c')).toBe('/api/rooms/a%20b%2Fc/password')
  })

  it('ROOM_KEY_HEADER 는 X-Room-Key', () => {
    expect(ROOM_KEY_HEADER).toBe('X-Room-Key')
  })
})
