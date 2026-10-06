/**
 * rooms 화면 확정 문구·라벨 — 단일 소스 설계 rooms/design.md §8.1 · §8.2 · §8.3
 * JSX·유틸에 한글 문구 리터럴을 직접 쓰지 않는다(aria-label · 오류 문구 포함).
 */
import { ERROR_MESSAGES } from '@shared/errors'
import { ROOM_TITLE_MAX } from '@shared/limits'
import type { ApiError, ApiErrorCode } from '@/api'

export const labels = {
  /** TopBar 제목(h1) */
  screenTitle: 'ROOMS',
  /** 화면 루트 main aria-label. ul 에는 aria-label 을 두지 않는다(이름이 겹치지 않게) */
  screenAriaLabel: '방 목록',
  /** ListRow aria-label */
  rowAriaLabel: (title: string, dateText: string): string => `${title}, 마지막 갱신 ${dateText}`,
  loading: '불러오는 중',
  empty: '아직 방이 없습니다',
  loadError: '목록을 불러오지 못했습니다',
  retry: '다시 시도',
  // ── S2 (§8.1) ──
  /** 상단 바 오른쪽 버튼 글자 */
  newRoom: '+ 새 방',
  newRoomAriaLabel: '새 방 만들기',
  /** B 행 role=group 이름 */
  newRoomGroupAriaLabel: '새 방 만들기',
  newRoomInputAriaLabel: '새 방 제목',
  newRoomPlaceholder: '새 방 제목 입력',
  cancel: '취소',
  create: '만들기',
  // ── S3c (설정 진입) ──
  /** 상단 바 ⚙ IconButton(갠홈 주인만 렌더) */
  settingsAriaLabel: '캐릭터 설정',
} as const

const NETWORK_TEXT = '서버에 연결할 수 없습니다.'

/** 오류 코드별 상세 문구. 서버 error.message 는 화면에 쓰지 않는다(api.md §3.1) */
export const errorDetail = (code: ApiErrorCode): string =>
  code === 'NETWORK' ? NETWORK_TEXT : ERROR_MESSAGES[code]

/** 인증 실패 3종 — 읽기 전용으로 바뀌었음을 알린다(R-CHAT-011). chat 화면 labels 와 같은 문구 */
const AUTH_FAILURE_TEXT: Partial<Record<ApiErrorCode, string>> = {
  TOKEN_REQUIRED: '로그인 정보가 없어 열람 전용으로 바뀌었습니다.',
  TOKEN_INVALID: '인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.',
  LEVEL_TOO_LOW: '대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.',
}

/**
 * 방 생성 실패 문구(설계 §8.3). 문구는 code 로 정한다 — 서버 error.message 는 쓰지 않는다.
 * RATE_LIMITED 는 retryAfterSec 가 있으면 초를 넣는다.
 */
export const writeErrorText = (error: ApiError): string => {
  const authText = AUTH_FAILURE_TEXT[error.code]
  if (authText !== undefined) return authText
  switch (error.code) {
    case 'RATE_LIMITED':
      return error.retryAfterSec === undefined
        ? ERROR_MESSAGES.RATE_LIMITED
        : `요청이 너무 많습니다. ${error.retryAfterSec}초 후 다시 시도해 주세요.`
    case 'VALIDATION_ERROR':
      return `방 제목은 1~${ROOM_TITLE_MAX}자로 입력해 주세요.`
    case 'NETWORK':
      return NETWORK_TEXT
    default:
      return ERROR_MESSAGES[error.code]
  }
}
