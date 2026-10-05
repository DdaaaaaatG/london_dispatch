/**
 * [목적] 히스토리 페이지 조회 서비스(R-MSG-001). 입력 검증 → (방 존재 확인 ∥ 페이지 조회) → 조립. 설계 messages.md §4
 * [공개 API] createMessagesService({ db }) -> MessagesService { listMessages }
 * [비동기] Promise.all 로 exists 와 pageDesc 병렬. 쓰기·잠금 없음
 * [에러] VALIDATION_ERROR(400, DB 접근 전), NOT_FOUND(404, 방 없음). D1 장애는 전파
 * [설정] 없음
 * [테스트] server/test/messages.test.ts (SRV-T-066~070)
 */
import { AppError } from '../app-error'
import type { Db } from '../db'
import { normalizePageQuery, toPage, type MessagePage, type MessagePageQuery } from './page'

export type MessagesService = {
  /** 방 히스토리 한 페이지 */
  listMessages: (roomId: string, query: MessagePageQuery) => Promise<MessagePage>
}

export type MessagesDeps = { db: Db }

const ROOM_NOT_FOUND_MESSAGE = '방을 찾을 수 없습니다.'

/** messages 서비스를 만든다 */
export const createMessagesService = ({ db }: MessagesDeps): MessagesService => ({
  listMessages: async (roomId, query) => {
    const { limit, before } = normalizePageQuery(query)
    const [exists, rowsDesc] = await Promise.all([
      db.rooms.exists(roomId),
      db.messages.pageDesc(roomId, limit + 1, before),
    ])
    if (!exists) throw new AppError('NOT_FOUND', ROOM_NOT_FOUND_MESSAGE)
    return toPage(rowsDesc, limit)
  },
})
