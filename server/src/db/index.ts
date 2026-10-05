/**
 * [목적] D1 바인딩을 감싼 접근 객체. 서비스는 이 모듈만 통해 DB 에 닿는다 (R-DB-003·005). 설계 db.md
 * [공개 API] createDb(binding) -> Db { rooms, messages, rateLimits(S2), batch }, 타입 Db·RoomsRepo·MessagesRepo·RateLimitsRepo·NewMessage·RoomSummary·Message·Speaker·MessageKind
 * [비동기] 전부 async. 여러 문장은 batch(원자적, 하나라도 실패하면 전부 롤백)
 * [에러] D1 오류 전파, 행 좁히기 실패는 AppError INTERNAL
 * [설정] 없음. DB 바인딩을 인자로 받는다(부트스트랩이 c.env.DB 전달)
 * [테스트] server/test/db.test.ts (SRV-T-020~031, 121~128)
 */
import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types'
import { createMessagesRepo, type MessagesRepo } from './messages'
import { createRateLimitsRepo, type RateLimitsRepo } from './rate-limits'
import { createRoomsRepo, type RoomsRepo } from './rooms'

export type { Message, MessageKind, NewMessage, RoomSummary, Speaker } from './types'
export type { MessagesRepo, RateLimitsRepo, RoomsRepo }

export type Db = {
  readonly rooms: RoomsRepo
  readonly messages: MessagesRepo
  /** S2 */
  readonly rateLimits: RateLimitsRepo
  /** 여러 문장을 원자적으로 실행 */
  readonly batch: (stmts: readonly D1PreparedStatement[]) => Promise<D1Result[]>
}

/** D1 바인딩을 감싼 접근 객체를 만든다. 요청마다 부트스트랩이 호출 */
export const createDb = (binding: D1Database): Db => ({
  rooms: createRoomsRepo(binding),
  messages: createMessagesRepo(binding),
  rateLimits: createRateLimitsRepo(binding),
  batch: stmts => binding.batch([...stmts]),
})
