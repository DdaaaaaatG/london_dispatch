// 테스트 공용 도우미: D1 초기화·시드 삽입
import { env } from 'cloudflare:test'
import { createAuthService } from '../src/auth'
import { createDb } from '../src/db'
import type { Logger } from '../src/logger'
import { createRoomsService, deriveEntrySecret, type RoomsDeps } from '../src/rooms'

/** 모든 테이블을 비운다(자식 먼저) */
export const resetDb = async (): Promise<void> => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM memory'),
    env.DB.prepare('DELETE FROM messages'),
    env.DB.prepare('DELETE FROM rooms'),
    env.DB.prepare('DELETE FROM rate_limits'),
    env.DB.prepare('DELETE FROM llm_usage'),
    env.DB.prepare('DELETE FROM character_settings'),
  ])
}

export const insertRoom = async (
  id: string,
  title: string,
  createdAt: number,
  updatedAt: number,
): Promise<void> => {
  await env.DB.prepare(
    'INSERT INTO rooms (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)',
  )
    .bind(id, title, createdAt, updatedAt)
    .run()
}

/** 캐릭터(sebastian) 메시지 1건을 넣고 id 를 돌려준다 */
export const insertLine = async (roomId: string, text: string, createdAt = 1): Promise<number> => {
  const row = await env.DB.prepare(
    "INSERT INTO messages (room_id, speaker, kind, text, created_at) VALUES (?1, 'sebastian', 'line', ?2, ?3) RETURNING id",
  )
    .bind(roomId, text, createdAt)
    .first<{ id: number }>()
  if (row === null) throw new Error('insert failed')
  return row.id
}

/** 한 방에 n 건 넣고 id 배열(오래된→새)을 돌려준다 */
export const insertLines = async (roomId: string, n: number): Promise<number[]> => {
  const ids: number[] = []
  for (let i = 1; i <= n; i += 1) ids.push(await insertLine(roomId, `m${i}`, i))
  return ids
}

/** S3 deps 를 쓰지 않는 테스트용: llm() 을 부르면 즉시 실패한다(SRV-T-145·209 의 "LLM 미사용" 보증을 겸한다) */
export const IDLE_GENERATE_DEPS = {
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  contextMessages: 40,
  llm: (): never => {
    throw new Error('llm must not be created')
  },
}

/** S3b: 월 사용량 행을 직접 시드한다(예산 상태 만들기). month 는 KST 'YYYY-MM' */
export const insertUsage = async (month: string, estKrw: number, calls = 1): Promise<void> => {
  await env.DB.prepare(
    'INSERT INTO llm_usage (month, calls, prompt_tokens, output_tokens, est_krw, updated_at) VALUES (?1, ?2, 0, 0, ?3, 1)',
  )
    .bind(month, calls, estKrw)
    .run()
}

/** S3b: 월 사용량 행(없으면 null) */
export const usageRow = async (
  month: string,
): Promise<{ calls: number; est_krw: number; updated_at: number } | null> =>
  env.DB.prepare('SELECT calls, est_krw, updated_at FROM llm_usage WHERE month = ?1')
    .bind(month)
    .first<{ calls: number; est_krw: number; updated_at: number }>()

// ---- S6: rooms 서비스 조립 도우미 (rooms.md §12.10) ----
/** 32자 이상 시험용 SECRET (실값 아님) */
export const TEST_SECRET = 'test-secret-0123456789-abcdefghijklmnop'

export type CollectedLog = { level: string; event: string; [k: string]: unknown }

/** 로그를 모아 두는 로거. 테스트가 필드를 단언한다 */
export const collectLogger = () => {
  const logs: CollectedLog[] = []
  const push = (level: string) => (event: string, fields?: Record<string, unknown>) =>
    void logs.push({ level, event, ...fields })
  return {
    logs,
    logger: { info: push('info'), warn: push('warn'), error: push('error') } as Logger,
  }
}

/** 실제 D1 + 실제 auth 계수기(hitEnterLimit)로 RoomsDeps 를 만든다. now 는 가변 시계 */
export const makeRoomsDeps = (opts: { now?: () => number; limit?: number } = {}) => {
  const now = opts.now ?? ((): number => 1_800_000_000_000)
  const { logs, logger } = collectLogger()
  const db = createDb(env.DB)
  const auth = createAuthService({
    db,
    logger,
    now,
    config: {
      tokenSecret: TEST_SECRET,
      tokenMinLevel: 5,
      rateLimitPerMin: 20,
      roomEnterLimitPerMin: opts.limit ?? 5,
    },
  })
  const deps: RoomsDeps = {
    db,
    now,
    logger,
    entrySecret: () => deriveEntrySecret(TEST_SECRET),
    hitEnterLimit: auth.hitEnterLimit,
  }
  return { deps, db, logs, logger }
}

/** makeRoomsDeps 로 만든 rooms 서비스 */
export const makeRooms = (opts: { now?: () => number; limit?: number } = {}) => {
  const made = makeRoomsDeps(opts)
  return { ...made, rooms: createRoomsService(made.deps) }
}
