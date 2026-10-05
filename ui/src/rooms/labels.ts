/**
 * rooms 화면 확정 문구·라벨 — 단일 소스 설계 rooms/design.md §8.1 · §8.2
 * JSX·유틸에 한글 문구 리터럴을 직접 쓰지 않는다(aria-label · 오류 문구 포함).
 */
import { ERROR_MESSAGES } from '@shared/errors'
import type { ApiErrorCode } from '@/api'

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
} as const

/** 오류 코드별 상세 문구. 서버 error.message 는 화면에 쓰지 않는다(api.md §3.1) */
export const errorDetail = (code: ApiErrorCode): string =>
  code === 'NETWORK' ? '서버에 연결할 수 없습니다.' : ERROR_MESSAGES[code]
