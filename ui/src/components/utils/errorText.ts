/**
 * 화면 공용 오류 문구 — rooms · chat · settings labels 가 같은 문장을 쓴다(CR-002 중복 제거).
 * 화면별 문구(방 제목 검증, NOT_FOUND 등)는 각 labels.ts 에 남는다.
 */
import type { ApiErrorCode } from '@/api'

export const NETWORK_TEXT = '서버에 연결할 수 없습니다.'

/** 인증 실패 3종 — 읽기 전용으로 바뀌었음을 알린다(R-CHAT-011) */
export const AUTH_FAILURE_TEXT: Partial<Record<ApiErrorCode, string>> = {
  TOKEN_REQUIRED: '로그인 정보가 없어 열람 전용으로 바뀌었습니다.',
  TOKEN_INVALID: '인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.',
  LEVEL_TOO_LOW: '대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.',
}
