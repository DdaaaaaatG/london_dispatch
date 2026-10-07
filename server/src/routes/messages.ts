import { PATHS } from '@shared/endpoints'
import type {
  EditMessageBody,
  Message,
  MessagesPage,
  MessagesQuery,
  SpeakBody,
  UserMessageBody,
} from '@shared/types'
import { Hono } from 'hono'
import { getPrincipal, rateLimitWrites, requireToken } from '../auth'
import type { AppEnv } from '../services'
import {
  editMessageBody,
  messageIdParam,
  messagesQuery,
  roomIdParam,
  speakBody,
  toPageQuery,
  userMessageBody,
} from './schemas'
import { validate } from './validate'

export const messagesRoutes = new Hono<AppEnv>()
  /// [계약] api.md §4.3 · [요구] R-MSG-001 · R-CHAT-003 · R-AUTH-003(읽기 토큰 불필요)
  /// [에러] VALIDATION_ERROR 400 · NOT_FOUND 404 · CONFIG_INVALID · INTERNAL · [부수효과] 없음
  .get(
    PATHS.roomMessages,
    validate('param', roomIdParam),
    validate('query', messagesQuery),
    async c => {
      const { id } = c.req.valid('param')
      const query: MessagesQuery = c.req.valid('query')
      const page: MessagesPage = await c
        .get('services')
        .messages.listMessages(id, toPageQuery(query))
      return c.json(page, 200)
    },
  )
  /// [계약] api.md §4.9 · [요구] R-MSG-002 · R-AUTH-004 · [에러] §4.5 공통 + VALIDATION_ERROR · NOT_FOUND · [부수효과] messages 1행 + 방 updatedAt · AI 호출 없음 · 레이트리밋 1회
  .post(
    PATHS.roomUser,
    requireToken,
    rateLimitWrites,
    validate('param', roomIdParam),
    validate('json', userMessageBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: UserMessageBody = c.req.valid('json')
      const message: Message = await c
        .get('services')
        .messages.addUserMessage(id, body, getPrincipal(c))
      return c.json(message, 201)
    },
  )
  /// [계약] api.md §4.10 · [요구] R-MSG-004 · R-MSG-008 · [에러] §4.5 공통 + VALIDATION_ERROR · NOT_FOUND · [부수효과] text 갱신 + 방 updatedAt · 레이트리밋 1회
  .patch(
    PATHS.message,
    requireToken,
    rateLimitWrites,
    validate('param', messageIdParam),
    validate('json', editMessageBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: EditMessageBody = c.req.valid('json')
      const message: Message = await c.get('services').messages.editMessage(id, body)
      return c.json(message, 200)
    },
  )
  /// [계약] api.md §4.11 · [요구] R-MSG-005 · R-MSG-008 · [에러] §4.5 공통 + NOT_FOUND · [부수효과] 실삭제 + 방 updatedAt · 레이트리밋 1회
  .delete(
    PATHS.message,
    requireToken,
    rateLimitWrites,
    validate('param', messageIdParam),
    async c => {
      const { id } = c.req.valid('param')
      await c.get('services').messages.deleteMessage(id)
      return c.body(null, 204)
    },
  )
  /// [계약] api.md §4.13 · [요구] R-MSG-003 · R-MSG-007 · R-NFR-001 · [에러] §4.5·§4.12 공통 + VALIDATION_ERROR · NOT_FOUND · [부수효과] messages 1행 + 방 updatedAt · 잠금 · 제공사 호출 최대 3회(선택 1 + 생성 1~2) · 레이트리밋 1회
  .post(
    PATHS.roomSpeak,
    requireToken,
    rateLimitWrites,
    validate('param', roomIdParam),
    validate('json', speakBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: SpeakBody = c.req.valid('json')
      const message: Message = await c
        .get('services')
        .messages.speak(id, body, { waitUntil: task => c.executionCtx.waitUntil(task) })
      return c.json(message, 201)
    },
  )
  /// [계약] api.md §4.14 · [요구] R-MSG-006 · R-MSG-007 · R-NFR-001 · [에러] §4.5·§4.12 공통 + NOT_FOUND · NOT_CHARACTER_MESSAGE · NOT_LAST_MESSAGE · [부수효과] text 교체 + 방 updatedAt · 잠금 · AI 1~2회 · 레이트리밋 1회
  .post(
    PATHS.messageRegenerate,
    requireToken,
    rateLimitWrites,
    validate('param', messageIdParam),
    async c => {
      const { id } = c.req.valid('param')
      const message: Message = await c.get('services').messages.regenerate(id)
      return c.json(message, 200)
    },
  )
