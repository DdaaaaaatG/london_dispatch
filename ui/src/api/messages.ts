import { endpoints } from '@shared/endpoints'
import type { MessagesPage, MessagesQuery } from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.3 · [요구] R-MSG-001 · R-CHAT-003 — 히스토리 한 페이지(오래된→새 순) */
export const listMessages = (
  roomId: string,
  query: MessagesQuery = {},
): Promise<Result<MessagesPage>> => request<MessagesPage>(endpoints.roomMessages(roomId, query))
