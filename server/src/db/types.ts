/**
 * [목적] db 모듈의 도메인 타입과 행 타입, 유니온 좁히기. 설계 db.md §2.1·§3.2
 * [공개 API] Speaker, MessageKind, RoomSummary, Message (@shared/types 재노출), NewMessage(S2), RoomSummaryRow, MessageRow, RateLimitRow(S2), toSpeaker, toKind
 * [비동기] 없음
 * [에러] 좁히기 실패 → AppError INTERNAL(500)
 * [설정] 없음
 * [테스트] server/test/db.test.ts (SRV-T-029·031)
 */
import type { Message, MessageKind, RoomSummary, Speaker } from '@shared/types'
import { AppError } from '../app-error'

export type { Message, MessageKind, RoomSummary, Speaker }

/** 메시지 INSERT 입력(S2). 유저 메시지는 author 둘 다 문자열, 캐릭터 메시지는 둘 다 null (CHECK 가 강제) */
export type NewMessage = {
  roomId: string
  speaker: Speaker
  kind: MessageKind
  text: string
  authorMbId: string | null
  authorName: string | null
}

/** rate_limits UPSERT RETURNING 행(S2) */
export type RateLimitRow = { count: number }

/** rooms 목록 쿼리 행(snake_case) */
export type RoomSummaryRow = {
  id: string
  title: string
  created_at: number
  updated_at: number
  message_count: number
}

/** messages 조회 행(author_mb_id 는 조회하지 않는다) */
export type MessageRow = {
  id: number
  room_id: string
  speaker: string
  kind: string
  text: string
  author_name: string | null
  created_at: number
}

const BAD_DATA_MESSAGE = '저장된 데이터 형식이 올바르지 않습니다.'

/** 행의 speaker 문자열을 유니온으로 좁힌다 */
export const toSpeaker = (value: string): Speaker => {
  if (value === 'sebastian' || value === 'ciel' || value === 'user') return value
  throw new AppError('INTERNAL', BAD_DATA_MESSAGE)
}

/** 행의 kind 문자열을 유니온으로 좁힌다 */
export const toKind = (value: string): MessageKind => {
  if (value === 'line' || value === 'ooc') return value
  throw new AppError('INTERNAL', BAD_DATA_MESSAGE)
}

/** llm_usage 조회 행(S3b) */
export type LlmUsageRow = {
  month: string
  calls: number
  prompt_tokens: number
  output_tokens: number
  est_krw: number
}
