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
  /** PATCH·DELETE 방 (S2) */
  room: `${API}/rooms/:id`,
  /** POST 유저 발화·지시 (S2) */
  roomUser: `${API}/rooms/:id/user`,
  /** PATCH·DELETE 메시지 (S2). :id 는 메시지 id(정수) */
  message: `${API}/messages/:id`,
  /** POST 캐릭터 1턴 생성 (S3, R-MSG-003) */
  roomSpeak: `${API}/rooms/:id/speak`,
  /** POST 메시지 재작성 (S3, R-MSG-006). :id 는 메시지 id(정수) */
  messageRegenerate: `${API}/messages/:id/regenerate`,
  /** GET · PUT 캐릭터 설정 (S3c, R-SET-004 · R-SET-005). 갠홈 주인 전용 */
  characterSettings: `${API}/settings/characters`,
  /** GET · PUT 장기기억 (S4, R-MEM-001). GET 도 토큰 필요 */
  roomMemory: `${API}/rooms/:id/memory`,
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
  /** (S2) */
  room: (roomId: string): string => withId(PATHS.room, roomId),
  /** (S2) */
  roomUser: (roomId: string): string => withId(PATHS.roomUser, roomId),
  /** (S2) 메시지 id 는 정수라 String() 으로 넣는다 */
  message: (messageId: number): string => withId(PATHS.message, String(messageId)),
  /** (S3) */
  roomSpeak: (roomId: string): string => withId(PATHS.roomSpeak, roomId),
  /** (S3) 메시지 id 는 정수라 String() 으로 넣는다 */
  messageRegenerate: (messageId: number): string =>
    withId(PATHS.messageRegenerate, String(messageId)),
  /** (S3c) GET · PUT 이 같이 쓴다 */
  characterSettings: (): string => PATHS.characterSettings,
  /** (S4) GET · PUT 이 같이 쓴다 */
  roomMemory: (roomId: string): string => withId(PATHS.roomMemory, roomId),
} as const
