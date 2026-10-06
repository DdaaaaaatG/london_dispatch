// 테스트 공용 도우미: D1 초기화·시드 삽입
import { env } from 'cloudflare:test'

/** 모든 테이블을 비운다(자식 먼저) */
export const resetDb = async (): Promise<void> => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM memory'),
    env.DB.prepare('DELETE FROM messages'),
    env.DB.prepare('DELETE FROM rooms'),
    env.DB.prepare('DELETE FROM rate_limits'),
    env.DB.prepare('DELETE FROM llm_usage'),
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
