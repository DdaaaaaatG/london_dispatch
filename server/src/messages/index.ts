/**
 * [목적] messages 모듈 공개 진입. 히스토리 조회(R-MSG-001)와 유저 발화·지시 저장·수정·삭제(R-MSG-002·004·005·008). 설계 messages.md
 * [공개 API] createMessagesService(speak·regenerate 포함), SPEAK_LOCK_MS, normalizePageQuery, toPage, normalizeMessageText, isMessageId, MESSAGE_PAGE_LIMIT_DEFAULT·_MAX, MESSAGE_TEXT_MAX, 타입 Message·MessagePage·MessagePageQuery·MessagesService·MessageAuthor 등
 * [비동기] 모든 서비스 함수 async
 * [에러] VALIDATION_ERROR, NOT_FOUND, SPEAK_IN_PROGRESS, NOT_LAST_MESSAGE, NOT_CHARACTER_MESSAGE (D1 장애는 전파). LLM 에러는 그대로 전파
 * [설정] 없음
 * [테스트] server/test/messages.test.ts, messages-page.test.ts (SRV-T-060~070·140~150·191~209)
 */
export type { Message } from '../db'
export {
  MESSAGE_PAGE_LIMIT_DEFAULT,
  MESSAGE_PAGE_LIMIT_MAX,
  normalizePageQuery,
  toPage,
} from './page'
export type { MessagePage, MessagePageQuery, NormalizedPageQuery } from './page'
export {
  createGenerateOps,
  SPEAK_LOCK_MS,
  type AfterSpeakEvent,
  type AfterSpeakHook,
  type Background,
  type GenerateDeps,
  type GenerateOps,
  type SpeakInput,
} from './generate'
export { createMessagesService } from './service'
export type {
  MessageAuthor,
  MessageTextInput,
  MessagesDeps,
  MessagesService,
  UserMessageInput,
} from './service'
export { isMessageId, MESSAGE_TEXT_MAX, normalizeMessageText } from './text'
