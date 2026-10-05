/**
 * chat 화면 확정 문구·라벨 — 단일 소스 설계 chat/design.md §8.1 · §8.2
 * JSX·유틸에 한글 문구 리터럴을 직접 쓰지 않는다(aria-label · 오류 문구 포함).
 * 캐릭터 이름은 여기가 아니라 CHARACTERS[id].shortName(shared)이 단일 소스다(R-LLM-002).
 */
import { ERROR_MESSAGES } from '@shared/errors'
import type { ApiErrorCode } from '@/api'

export const labels = {
  /** 화면 루트 main aria-label */
  screenAriaLabel: (title: string): string => `대화: ${title}`,
  backAriaLabel: '방 목록으로 돌아가기',
  createdAtAriaLabel: (dateText: string): string => `방 생성일 ${dateText}`,
  historyAriaLabel: '대화 기록',
  loading: '대화를 불러오는 중',
  empty: '아직 대화가 없습니다',
  loadError: '대화를 불러오지 못했습니다',
  retry: '다시 시도',
  olderLoading: '이전 대화 불러오는 중',
  olderError: '이전 대화를 불러오지 못했습니다',
  oocPrefix: '[지시]',
  /** OOC 앞뒤 장식(aria-hidden) */
  oocDecor: '—',
  /** 유저 말풍선 authorName 이 null 일 때 */
  unknownAuthor: '이름 없음',
  newMessages: '새 메시지',
  newMessagesAriaLabel: '새 메시지 보기, 맨 아래로 이동',
  readOnlyNotice: '열람 전용 - 대화 참여는 등급 회원만',
} as const

/**
 * 오류 코드별 상세 문구. 서버 error.message 는 화면에 쓰지 않는다(api.md §3.1).
 * S2·S3 코드별 안내(R-CHAT-011)는 이 함수에 행을 더하는 방식으로 확장한다.
 */
export const errorDetail = (code: ApiErrorCode): string => {
  if (code === 'NETWORK') return '서버에 연결할 수 없습니다.'
  if (code === 'NOT_FOUND') return '방을 찾을 수 없습니다. 목록으로 돌아가 주세요.'
  return ERROR_MESSAGES[code]
}
