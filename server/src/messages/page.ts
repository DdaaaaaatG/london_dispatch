/**
 * [목적] 히스토리 페이지 규칙 순수 함수(기본값·검증·페이지 조립). 설계 messages.md §2.1 (R-MSG-001)
 * [공개 API] normalizePageQuery(query), toPage(rowsDesc, limit), 상수 MESSAGE_PAGE_LIMIT_DEFAULT·_MAX, 타입
 * [비동기] 없음(순수)
 * [에러] AppError VALIDATION_ERROR(limit·before 위반)
 * [설정] 없음. 30·100 은 요구 상수라 모듈 상수
 * [테스트] server/test/messages-page.test.ts (SRV-T-060~065)
 */
import type { MessagesPage } from '@shared/types'
import { AppError } from '../app-error'
import type { Message } from '../db'

export const MESSAGE_PAGE_LIMIT_DEFAULT = 30
export const MESSAGE_PAGE_LIMIT_MAX = 100

/** 라우트가 쿼리 문자열을 숫자로 바꿔 넘긴다. 범위·정수 판정은 서비스가 한다 */
export type MessagePageQuery = {
  before?: number
  limit?: number
}

/** messages 는 오래된→새 순. 다음 페이지 before 는 messages[0].id (계약 타입 MessagesPage 와 같다) */
export type MessagePage = MessagesPage

export type NormalizedPageQuery = { limit: number; before?: number }

const LIMIT_MESSAGE = `불러올 개수(limit)는 1~${MESSAGE_PAGE_LIMIT_MAX} 사이의 정수여야 합니다.`
const BEFORE_MESSAGE = '기준 메시지 번호(before)가 올바르지 않습니다.'

/** 기본값 적용 + 검증. 실패 시 AppError VALIDATION_ERROR */
export const normalizePageQuery = (query: MessagePageQuery): NormalizedPageQuery => {
  const limit = query.limit ?? MESSAGE_PAGE_LIMIT_DEFAULT
  if (!Number.isInteger(limit) || limit < 1 || limit > MESSAGE_PAGE_LIMIT_MAX) {
    throw new AppError('VALIDATION_ERROR', LIMIT_MESSAGE)
  }
  if (query.before === undefined) return { limit }
  if (!Number.isSafeInteger(query.before) || query.before < 1) {
    throw new AppError('VALIDATION_ERROR', BEFORE_MESSAGE)
  }
  return { limit, before: query.before }
}

/** id 내림차순 행(limit + 1 건까지)을 오래된→새 순 페이지로 바꾼다 */
export const toPage = (rowsDesc: readonly Message[], limit: number): MessagePage => ({
  messages: rowsDesc.slice(0, limit).reverse(),
  hasMore: rowsDesc.length > limit,
})
