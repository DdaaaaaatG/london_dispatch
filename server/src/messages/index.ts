/**
 * [목적] messages 모듈 공개 진입. 히스토리 페이지 조회(R-MSG-001). 설계 messages.md
 * [공개 API] createMessagesService, normalizePageQuery, toPage, MESSAGE_PAGE_LIMIT_DEFAULT·_MAX, 타입 Message·MessagePage·MessagePageQuery·MessagesService
 * [비동기] listMessages 는 async
 * [에러] VALIDATION_ERROR, NOT_FOUND (D1 장애는 전파)
 * [설정] 없음
 * [테스트] server/test/messages.test.ts, messages-page.test.ts (SRV-T-060~070)
 */
export type { Message } from '../db'
export {
  MESSAGE_PAGE_LIMIT_DEFAULT,
  MESSAGE_PAGE_LIMIT_MAX,
  normalizePageQuery,
  toPage,
} from './page'
export type { MessagePage, MessagePageQuery, NormalizedPageQuery } from './page'
export { createMessagesService } from './service'
export type { MessagesDeps, MessagesService } from './service'
