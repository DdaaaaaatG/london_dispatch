/**
 * [목적] messages 테이블 접근 함수(S1 페이지 조회 + S2 쓰기: 모두 방 updated_at 갱신을 같은 batch 에 포함). author_mb_id 는 조회하지 않는다 (R-DB-005, D-DB-5). 설계 db.md §2.1
 * [공개 API] createMessagesRepo(binding) -> MessagesRepo { pageDesc, insert(S2), updateText(S2), deleteById(S2) }, toMessage(row)
 * [비동기] D1 prepare().bind().all() await. 쓰기는 batch(원자적, 왕복 1회)
 * [에러] D1 오류 전파. speaker·kind 좁히기 실패 → AppError INTERNAL
 * [설정] 없음
 * [테스트] server/test/db.test.ts (SRV-T-028·029, 124·125·128)
 */
import type { D1Database, D1Result } from '@cloudflare/workers-types'
import {
  SQL_MESSAGES_DELETE,
  SQL_MESSAGES_INSERT_IF_ROOM,
  SQL_MESSAGES_PAGE_BEFORE,
  SQL_MESSAGES_PAGE_LATEST,
  SQL_MESSAGES_UPDATE_TEXT,
  SQL_ROOMS_TOUCH,
  SQL_ROOMS_TOUCH_BY_MESSAGE,
} from './sql'
import { toKind, toSpeaker, type Message, type MessageRow, type NewMessage } from './types'

export type MessagesRepo = {
  /** room 의 메시지를 id 내림차순으로 take 건. beforeId 가 있으면 id < beforeId 만 */
  pageDesc: (roomId: string, take: number, beforeId?: number) => Promise<Message[]>
  /** S2. 방이 있을 때만 INSERT + 그 방 updated_at = nowMs 를 한 batch 로. 방이 없으면 null(아무것도 쓰지 않음) */
  insert: (m: NewMessage, nowMs: number) => Promise<Message | null>
  /** S2. text 교체 + 그 메시지의 방 updated_at = nowMs 를 한 batch 로. 메시지가 없으면 null */
  updateText: (id: number, text: string, nowMs: number) => Promise<Message | null>
  /** S2. 그 메시지의 방 updated_at = nowMs → DELETE 를 한 batch 로. 메시지가 없었으면 false */
  deleteById: (id: number, nowMs: number) => Promise<boolean>
}

/** 행(snake_case)을 도메인 객체로 변환 */
export const toMessage = (row: MessageRow): Message => ({
  id: row.id,
  roomId: row.room_id,
  speaker: toSpeaker(row.speaker),
  kind: toKind(row.kind),
  text: row.text,
  authorName: row.author_name,
  createdAt: row.created_at,
})

const firstMessage = (result: D1Result<MessageRow> | undefined): Message | null => {
  const row = result?.results[0]
  return row === undefined ? null : toMessage(row)
}

/** messages 저장소를 만든다 */
export const createMessagesRepo = (binding: D1Database): MessagesRepo => ({
  pageDesc: async (roomId, take, beforeId) => {
    const stmt =
      beforeId === undefined
        ? binding.prepare(SQL_MESSAGES_PAGE_LATEST).bind(roomId, take)
        : binding.prepare(SQL_MESSAGES_PAGE_BEFORE).bind(roomId, beforeId, take)
    const result = await stmt.all<MessageRow>()
    return result.results.map(toMessage)
  },
  insert: async (m, nowMs) => {
    const results = await binding.batch<MessageRow>([
      binding
        .prepare(SQL_MESSAGES_INSERT_IF_ROOM)
        .bind(m.roomId, m.speaker, m.kind, m.text, m.authorMbId, m.authorName, nowMs),
      binding.prepare(SQL_ROOMS_TOUCH).bind(nowMs, m.roomId),
    ])
    return firstMessage(results[0])
  },
  updateText: async (id, text, nowMs) => {
    const results = await binding.batch<MessageRow>([
      binding.prepare(SQL_MESSAGES_UPDATE_TEXT).bind(text, id),
      binding.prepare(SQL_ROOMS_TOUCH_BY_MESSAGE).bind(nowMs, id),
    ])
    return firstMessage(results[0])
  },
  deleteById: async (id, nowMs) => {
    // touch 가 먼저 — 삭제 뒤에는 room_id 를 찾을 수 없다
    const results = await binding.batch([
      binding.prepare(SQL_ROOMS_TOUCH_BY_MESSAGE).bind(nowMs, id),
      binding.prepare(SQL_MESSAGES_DELETE).bind(id),
    ])
    return (results[1]?.meta.changes ?? 0) > 0
  },
})
