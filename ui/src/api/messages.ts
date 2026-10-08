import { endpoints } from '@shared/endpoints'
import type {
  EditMessageBody,
  Message,
  MessagesPage,
  MessagesQuery,
  SpeakBody,
  UserMessageBody,
} from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.3 · [요구] R-MSG-001 · R-CHAT-003 — 히스토리 한 페이지(오래된→새 순) */
export const listMessages = (
  roomId: string,
  query: MessagesQuery = {},
): Promise<Result<MessagesPage>> =>
  request<MessagesPage>(endpoints.roomMessages(roomId, query), { roomId })

/** [계약] api.md §4.9 · [요구] R-MSG-002 · R-CHAT-004 · R-CHAT-006 — 유저 발화·지시 저장(201 Message). AI 호출 없음 */
export const appendUser = (roomId: string, body: UserMessageBody): Promise<Result<Message>> =>
  request<Message>(endpoints.roomUser(roomId), {
    method: 'POST',
    body: { text: body.text, ooc: body.ooc },
    auth: true,
    roomId,
  })

/** [계약] api.md §4.10 · [요구] R-MSG-004 · R-CHAT-007 — 메시지 수정(200 Message) */
export const editMessage = (
  messageId: number,
  body: EditMessageBody,
  roomId: string,
): Promise<Result<Message>> =>
  request<Message>(endpoints.message(messageId), {
    method: 'PATCH',
    body: { text: body.text },
    auth: true,
    roomId,
  })

/** [계약] api.md §4.11 · [요구] R-MSG-005 · R-CHAT-007 — 메시지 삭제(204 → value undefined) */
export const deleteMessage = (messageId: number, roomId: string): Promise<Result<void>> =>
  request<void>(endpoints.message(messageId), { method: 'DELETE', auth: true, roomId })

/** [계약] api.md §4.13 · [요구] R-MSG-003 · R-CHAT-005 — 캐릭터 1턴 생성(201 Message). 최대 70초, 타임아웃 없음 */
export const speak = (roomId: string, body: SpeakBody): Promise<Result<Message>> =>
  request<Message>(endpoints.roomSpeak(roomId), {
    method: 'POST',
    body: { character: body.character },
    auth: true,
    roomId,
  })

/** [계약] api.md §4.14 · [요구] R-MSG-006 · R-CHAT-007 — 같은 캐릭터로 재생성(200 Message). 본문 없음. 최대 70초 */
export const regenerate = (messageId: number, roomId: string): Promise<Result<Message>> =>
  request<Message>(endpoints.messageRegenerate(messageId), { method: 'POST', auth: true, roomId })
