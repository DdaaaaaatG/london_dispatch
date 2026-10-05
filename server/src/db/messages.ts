/**
 * [목적] messages 테이블 접근 함수(S1은 페이지 조회만). author_mb_id 는 조회하지 않는다 (R-DB-005, D-DB-5). 설계 db.md §2.1
 * [공개 API] createMessagesRepo(binding) -> MessagesRepo { pageDesc }, toMessage(row)
 * [비동기] D1 prepare().bind().all() await
 * [에러] D1 오류 전파. speaker·kind 좁히기 실패 → AppError INTERNAL
 * [설정] 없음
 * [테스트] server/test/db.test.ts (SRV-T-028·029)
 */
import type { D1Database } from '@cloudflare/workers-types'
import { SQL_MESSAGES_PAGE_BEFORE, SQL_MESSAGES_PAGE_LATEST } from './sql'
import { toKind, toSpeaker, type Message, type MessageRow } from './types'

export type MessagesRepo = {
  /** room 의 메시지를 id 내림차순으로 take 건. beforeId 가 있으면 id < beforeId 만 */
  pageDesc: (roomId: string, take: number, beforeId?: number) => Promise<Message[]>
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
})
