/**
 * 경로 상수 — 단일 소스 doc/200_설계/contract/api.md §4 (R-API-001 · R-API-008)
 * PATHS = 서버 등록용 패턴(Hono), endpoints = 화면 호출용 빌더. 경로 리터럴은 이 파일에만 둔다
 */
import type { MessagesQuery } from './types'

const API = '/api'

export const PATHS = {
  /** 화면(정적). server 진입점이 처리하며 routes 에 등록하지 않는다 (R-API-006) */
  embed: '/embed',
  health: `${API}/health`,
  rooms: `${API}/rooms`,
  roomMessages: `${API}/rooms/:id/messages`,
} as const

/** :id 자리에 인코딩한 값을 넣는다 */
const withId = (pattern: string, id: string): string =>
  pattern.replace(':id', encodeURIComponent(id))

/** 쿼리 객체 → '?a=1&b=2'. undefined 는 뺀다. 값이 숫자뿐이라 인코딩하지 않는다 */
const toQueryString = (query: Readonly<Record<string, number | undefined>>): string => {
  const pairs = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
  return pairs.length === 0 ? '' : `?${pairs.join('&')}`
}

export const endpoints = {
  health: (): string => PATHS.health,
  rooms: (): string => PATHS.rooms,
  roomMessages: (roomId: string, query: MessagesQuery = {}): string =>
    withId(PATHS.roomMessages, roomId) + toQueryString(query),
} as const
