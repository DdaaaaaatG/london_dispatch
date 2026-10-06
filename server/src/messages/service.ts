/**
 * [목적] 히스토리 조회(R-MSG-001)와 유저 발화·지시 저장, 수정, 삭제 서비스(R-MSG-002·004·005·008), S3 speak·regenerate 위임(generate.ts). S1·S2 함수는 LLM 을 부르지 않는다. 설계 messages.md §2·§4
 * [공개 API] createMessagesService(deps) -> MessagesService { listMessages, addUserMessage, editMessage, deleteMessage, speak(S3), regenerate(S3) }, 타입 MessagesDeps·MessagesService·MessageAuthor·UserMessageInput·MessageTextInput
 * [비동기] 조회는 Promise.all(exists ∥ pageDesc). 쓰기는 db 함수 1회(내부 batch 에 방 updated_at 포함). 잠금 없음
 * [에러] VALIDATION_ERROR(조회 쿼리·본문, DB 접근 전), NOT_FOUND(방·메시지 없음, 메시지 id 형식 위반). D1 장애는 전파
 * [설정] 없음. now 는 컨테이너가 주입하는 시계
 * [테스트] server/test/messages.test.ts (SRV-T-066~070·140~150), messages-generate.test.ts (SRV-T-191~209)
 */
import { AppError } from '../app-error'
import type { Db, Message } from '../db'
import type { Llm } from '../llm'
import type { Logger } from '../logger'
import type { Principal } from '../auth'
import { normalizePageQuery, toPage, type MessagePage, type MessagePageQuery } from './page'
import {
  createGenerateOps,
  type AfterSpeakHook,
  type Background,
  type SpeakInput,
} from './generate'
import { isMessageId, normalizeMessageText } from './text'

/** 작성자 기록에 필요한 Principal 의 일부. 라우트는 getPrincipal(c) 를 그대로 넘긴다 */
export type MessageAuthor = Pick<Principal, 'mbId' | 'displayName'>
export type UserMessageInput = { text: string; ooc: boolean }
export type MessageTextInput = { text: string }

export type MessagesService = {
  /** 방 히스토리 한 페이지 */
  listMessages: (roomId: string, query: MessagePageQuery) => Promise<MessagePage>
  /** 유저 발화(line)·지시(ooc)를 저장. LLM 을 부르지 않는다 */
  addUserMessage: (
    roomId: string,
    input: UserMessageInput,
    author: MessageAuthor,
  ) => Promise<Message>
  /** 본문만 바꾼다. speaker·kind·작성자·createdAt 유지 */
  editMessage: (messageId: number, input: MessageTextInput) => Promise<Message>
  /** 실삭제 */
  deleteMessage: (messageId: number) => Promise<void>
  /** 캐릭터 1턴 생성·저장 (S3) */
  speak: (roomId: string, input: SpeakInput, background: Background) => Promise<Message>
  /** 마지막 캐릭터 메시지를 같은 캐릭터로 다시 생성 (S3) */
  regenerate: (messageId: number) => Promise<Message>
}

export type MessagesDeps = {
  db: Db
  now: () => number
  /** S3 */
  logger: Logger
  /** S3. config.contextMessages (1~100) */
  contextMessages: number
  /** S3. 지연 생성 — 부를 때 키를 확인한다(google + 키 없음 → ConfigError CONFIG_INVALID) */
  llm: () => Llm
  /** S3 자리. 없으면 no-op. S4 memory 가 채운다 */
  afterSpeak?: AfterSpeakHook
}

const ROOM_NOT_FOUND_MESSAGE = '방을 찾을 수 없습니다.'
const MESSAGE_NOT_FOUND_MESSAGE = '메시지를 찾을 수 없습니다.'

const messageNotFound = (): AppError => new AppError('NOT_FOUND', MESSAGE_NOT_FOUND_MESSAGE)

/** messages 서비스를 만든다 */
export const createMessagesService = (deps: MessagesDeps): MessagesService => {
  const { db, now } = deps
  return {
    ...createGenerateOps(deps),
    listMessages: async (roomId, query) => {
      const { limit, before } = normalizePageQuery(query)
      const [exists, rowsDesc] = await Promise.all([
        db.rooms.exists(roomId),
        db.messages.pageDesc(roomId, limit + 1, before),
      ])
      if (!exists) throw new AppError('NOT_FOUND', ROOM_NOT_FOUND_MESSAGE)
      return toPage(rowsDesc, limit)
    },
    addUserMessage: async (roomId, input, author) => {
      const text = normalizeMessageText(input.text)
      const saved = await db.messages.insert(
        {
          roomId,
          speaker: 'user',
          kind: input.ooc ? 'ooc' : 'line',
          text,
          authorMbId: author.mbId,
          authorName: author.displayName,
        },
        now(),
      )
      if (saved === null) throw new AppError('NOT_FOUND', ROOM_NOT_FOUND_MESSAGE)
      return saved
    },
    editMessage: async (messageId, input) => {
      if (!isMessageId(messageId)) throw messageNotFound()
      const text = normalizeMessageText(input.text)
      const saved = await db.messages.updateText(messageId, text, now())
      if (saved === null) throw messageNotFound()
      return saved
    },
    deleteMessage: async messageId => {
      if (!isMessageId(messageId)) throw messageNotFound()
      const deleted = await db.messages.deleteById(messageId, now())
      if (!deleted) throw messageNotFound()
    },
  }
}
