/**
 * roomEntryText — 입장 시트 확정 문구의 단일 소스(rooms·chat 공용). 설계 rooms/design/components.md §1.23 · design/lock.md §8.2
 * 요구: R-LOCK-004 · R-LOCK-008
 * 서버 error.message 는 화면에 쓰지 않는다(api.md §3.1) — 문구는 코드로 정한다.
 * NETWORK 문구는 components/utils/errorText.ts 의 NETWORK_TEXT 를 그대로 쓴다(문장 중복 금지).
 */
import { ERROR_MESSAGES } from '@shared/errors'
import type { ApiError } from '@/api'
import { NETWORK_TEXT } from '@/components/utils/errorText'

export const ROOM_ENTRY_TEXT = {
  /** 시트 h2 · 시트 aria-label */
  title: '비밀번호',
  /** 시트 입력 aria-label */
  inputAriaLabel: '방 비밀번호',
  /** 오른쪽 primary 버튼 */
  submit: '입장',
  /** 왼쪽 secondary 버튼 */
  cancel: '취소',
} as const

const WRONG_PASSWORD_TEXT = '비밀번호가 맞지 않습니다.'
const TOO_OFTEN_TEXT = '비밀번호를 너무 자주 입력했습니다.'

/** 입장 실패 코드별 시트 안내 문구(F-RM-45). 조용한 시도의 ROOM_LOCKED 는 문구 없이 시트만 연다 — 호출 쪽이 error 를 null 로 둔다 */
export const enterErrorText = (error: ApiError): string => {
  switch (error.code) {
    case 'ROOM_PASSWORD_WRONG':
      return WRONG_PASSWORD_TEXT
    case 'RATE_LIMITED':
      return error.retryAfterSec === undefined
        ? `${TOO_OFTEN_TEXT} 잠시 후 다시 시도해 주세요.`
        : `${TOO_OFTEN_TEXT} ${error.retryAfterSec}초 후 다시 시도해 주세요.`
    case 'NETWORK':
      return NETWORK_TEXT
    default:
      return ERROR_MESSAGES[error.code]
  }
}
