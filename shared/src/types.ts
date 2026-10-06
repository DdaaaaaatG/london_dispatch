/**
 * 계약 타입 — 단일 소스 doc/200_설계/contract/api.md §5
 * server(routes·서비스)와 ui(api 래퍼·화면)가 함께 import 한다 (R-API-008)
 * 규칙: camelCase · 시각 epoch ms · room id 문자열 · message id 정수 · 없음은 null (R-API-004)
 */
import type { ErrorCode } from './errors'

/** 캐릭터 id. 두 명 고정 (확정사항 §1, R-LLM-002) */
export type CharacterId = 'sebastian' | 'ciel'

/** 메시지 화자 */
export type Speaker = CharacterId | 'user'

/** 메시지 종류. ooc = 유저의 지시 */
export type MessageKind = 'line' | 'ooc'

/** 방 목록 한 줄 — GET /api/rooms (R-ROOM-001) */
export type RoomSummary = {
  id: string
  title: string
  /** epoch ms */
  createdAt: number
  /** epoch ms. 메시지 추가·수정·삭제·재작성 시 갱신 (R-ROOM-005) */
  updatedAt: number
  messageCount: number
}

/** 메시지 한 건 (R-MSG-001). 작성자 로그인 id 는 싣지 않는다 */
export type Message = {
  id: number
  roomId: string
  speaker: Speaker
  kind: MessageKind
  text: string
  /** 유저 메시지의 작성자 표시 이름. 캐릭터 메시지는 null */
  authorName: string | null
  /** epoch ms */
  createdAt: number
}

/** GET /api/rooms/:id/messages 쿼리. 생략 시 최신부터 30건 */
export type MessagesQuery = {
  /** 이 id 보다 작은(더 오래된) 메시지만. 1 이상 정수 */
  before?: number | undefined
  /** 1~100 정수 */
  limit?: number | undefined
}

/** 히스토리 한 페이지. messages 는 오래된→새 순. 다음 페이지 before = messages[0].id */
export type MessagesPage = {
  messages: Message[]
  hasMore: boolean
}

/** GET /api/health (R-API-005) */
export type HealthResponse = {
  ok: true
  version: string
}

/** POST /api/rooms 본문 (R-ROOM-002). trim·1~60자 판정은 서버 (S2) */
export type CreateRoomBody = {
  title: string
}

/** PATCH /api/rooms/:id 본문 (R-ROOM-003). 규칙은 CreateRoomBody 와 같다 (S2) */
export type RenameRoomBody = {
  title: string
}

/** POST /api/rooms/:id/user 본문 (R-MSG-002). ooc = true 이면 지시(kind 'ooc'). 둘 다 필수 (S2) */
export type UserMessageBody = {
  text: string
  ooc: boolean
}

/** PATCH /api/messages/:id 본문 (R-MSG-004). trim·1~2000자 판정은 서버 (S2) */
export type EditMessageBody = {
  text: string
}

/** POST /api/rooms/:id/speak 본문 (R-MSG-003). 두 값 밖이면 400 VALIDATION_ERROR (S3) */
export type SpeakBody = {
  character: CharacterId
}

/** 모든 실패 응답 본문 (R-API-002) */
export type ApiErrorBody = {
  error: {
    code: ErrorCode
    message: string
    /** RATE_LIMITED 에만 붙는다. 다음 분 창까지 남은 초(정수 ≥ 1). 같은 값이 Retry-After 헤더에도 실린다 (R-AUTH-005, S2) */
    retryAfterSec?: number
  }
}
