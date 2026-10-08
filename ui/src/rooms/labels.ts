/**
 * rooms 화면 확정 문구·라벨 — 단일 소스 설계 rooms/design.md §8.1 · §8.2 · §8.3 · design/lock.md §8.1(S6)
 * JSX·유틸에 한글 문구 리터럴을 직접 쓰지 않는다(aria-label · 오류 문구 포함).
 */
import { ERROR_MESSAGES } from '@shared/errors'
import { ROOM_PASSWORD_MAX, ROOM_PASSWORD_MIN, ROOM_TITLE_MAX } from '@shared/limits'
import type { ApiError, ApiErrorCode } from '@/api'
import { AUTH_FAILURE_TEXT, NETWORK_TEXT } from '@/components/utils/errorText'

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
  // ── S6 (lock.md §8.1) ──
  /** 잠긴 ListRow aria-label — 날짜 없음 */
  lockedRowAriaLabel: (title: string): string => `${title}, 잠긴 방`,
  /** B2 비밀번호 입력 aria-label */
  newRoomPasswordAriaLabel: '새 방 비밀번호',
  /** B2 비밀번호 입력 placeholder(정하는 곳에만 「6자 이상 권장」) */
  newRoomPasswordPlaceholder: '비밀번호(선택, 6자 이상 권장)',
} as const

/** 오류 코드별 상세 문구. 서버 error.message 는 화면에 쓰지 않는다(api.md §3.1) */
export const errorDetail = (code: ApiErrorCode): string =>
  code === 'NETWORK' ? NETWORK_TEXT : ERROR_MESSAGES[code]

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
      return `방 제목(1~${ROOM_TITLE_MAX}자)과 비밀번호(${ROOM_PASSWORD_MIN}~${ROOM_PASSWORD_MAX}자)를 확인해 주세요.`
    case 'NETWORK':
      return NETWORK_TEXT
    default:
      return ERROR_MESSAGES[error.code]
  }
}
