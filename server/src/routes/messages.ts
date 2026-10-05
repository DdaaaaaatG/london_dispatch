import { PATHS } from '@shared/endpoints'
import type { MessagesPage, MessagesQuery } from '@shared/types'
import { Hono } from 'hono'
import type { AppEnv } from '../services'
import { messagesQuery, roomIdParam, toPageQuery } from './schemas'
import { validate } from './validate'

/// [계약] api.md §4.3 · [요구] R-MSG-001 · R-CHAT-003 · R-AUTH-003(읽기 토큰 불필요)
/// [에러] VALIDATION_ERROR 400 · NOT_FOUND 404 · CONFIG_INVALID · INTERNAL · [부수효과] 없음
export const messagesRoutes = new Hono<AppEnv>().get(
  PATHS.roomMessages,
  validate('param', roomIdParam),
  validate('query', messagesQuery),
  async (c) => {
    const { id } = c.req.valid('param')
    const query: MessagesQuery = c.req.valid('query')
    const page: MessagesPage = await c.get('services').messages.listMessages(id, toPageQuery(query))
    return c.json(page, 200)
  },
)
