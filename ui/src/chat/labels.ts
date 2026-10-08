/**
 * chat 화면 확정 문구·라벨 — 단일 소스 설계 chat/design.md §8.1 · §8.1.1 · §8.2 · §8.3 · design/actions.md §8(S3e 버튼 줄 라벨) · design/memory.md §6(S4 장기기억) · design/lock.md §6(S6 방 잠금)
 * JSX·유틸에 한글 문구 리터럴을 직접 쓰지 않는다(aria-label · 오류 문구 포함).
 * 캐릭터 이름은 여기가 아니라 CHARACTERS[id].shortName(shared)이 단일 소스다(R-LLM-002).
 */
import { USER_DISPLAY_NAME } from '@shared/characters'
import { ERROR_MESSAGES } from '@shared/errors'
import {
  MEMORY_SUMMARY_MAX,
  MESSAGE_TEXT_MAX,
  ROOM_PASSWORD_MAX,
  ROOM_PASSWORD_MIN,
  ROOM_TITLE_MAX,
} from '@shared/limits'
import type { ApiError, ApiErrorCode } from '@/api'
import { AUTH_FAILURE_TEXT, NETWORK_TEXT } from '@/components/utils/errorText'

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
  newMessages: '새 메시지',
  newMessagesAriaLabel: '새 메시지 보기, 맨 아래로 이동',
  readOnlyNotice: '열람 전용 - 대화 참여는 등급 회원만',
  // ── S2 (§8.1.1) ──
  moreAriaLabel: '방 메뉴 열기',
  composerAriaLabel: '메시지 작성',
  inputAriaLabel: '메시지 입력',
  inputPlaceholder: '대사나 지시를 입력',
  send: '전송',
  oocAriaLabel: 'OOC 지시 모드',
  oocOn: 'OOC 켬',
  oocOff: 'OOC 끔',
  edit: '수정',
  delete: '삭제',
  cancel: '취소',
  save: '저장',
  editAriaLabel: '메시지 수정',
  editInputAriaLabel: '수정할 내용',
  deleteMessageTitle: '이 메시지를 삭제할까요?',
  deleteMessageBody: '삭제한 메시지는 되돌릴 수 없습니다.',
  roomMenuAriaLabel: '방 메뉴',
  roomMenuHeader: (title: string): string => `방 메뉴 · ${title}`,
  rename: '이름 변경',
  deleteRoom: '방 삭제',
  renameTitle: '방 이름 변경',
  renameInputAriaLabel: '방 이름',
  deleteRoomTitle: '이 방을 삭제할까요?',
  deleteRoomBody: '메시지와 장기기억이 함께 지워지며 되돌릴 수 없습니다.',
  // ── S3 (§8.1.2) ──
  speakAriaLabel: (name: string): string => `${name} 대사 생성`,
  pendingDots: '…',
  pendingStatus: (name: string): string => `${name} 대사를 만드는 중`,
  speakRetry: '재시도',
  speakRetryAriaLabel: (name: string): string => `${name} 대사 재시도`,
  regenerate: '재작성',
  regeneratingNote: '다시 쓰는 중…',
  // ── S3d (design/auto.md §6) ──
  /** 중립 "…" 말풍선 생성 중 role=status 숨은 안내 */
  autoPendingStatus: '응답을 만드는 중',
  /** 중립 실패 「재시도」 접근 이름(보이는 글자 `재시도` 포함) */
  autoRetryAriaLabel: '응답 재시도',
  /** 생성 중 잠긴 인라인 수정 저장 버튼의 숨은 안내(aria-describedby) */
  editSaveLockedNote: '응답을 만드는 중에는 저장할 수 없습니다',
  // ── S3e (design/actions.md §8) ──
  /** 말풍선 버튼 줄 group. 이름 = 캐릭터 짧은 이름 · 유저 표기(userAuthorLabel) · [지시] */
  bubbleActionsAriaLabel: (name: string): string => `${name} 말풍선 작업`,
  /** 「수정」 접근 이름(보이는 글자 `수정` 포함) */
  editActionAriaLabel: (name: string): string => `${name} 대사 수정`,
  /** 「재작성」 접근 이름(보이는 글자 `재작성` 포함) */
  regenerateActionAriaLabel: (name: string): string => `${name} 대사 재작성`,
  /** 「삭제」 접근 이름(보이는 글자 `삭제` 포함) */
  deleteActionAriaLabel: (name: string): string => `${name} 대사 삭제`,
  // ── S4 (design/memory.md §6) ──
  /** 방 메뉴 항목 · 시트 제목 h2 · 시트 aria-label */
  memory: '장기기억',
  memoryClose: '닫기',
  memoryGuide: 'AI가 긴 대화를 요약해 기억합니다. 직접 고칠 수 있어요.',
  /** 갱신 줄 앞말. 뒤에 `<time>` `MM.DD HH:mm` */
  memoryUpdatedAtPrefix: '마지막 갱신',
  memoryInputAriaLabel: '장기기억 요약',
  memoryPlaceholder: '아직 요약이 없습니다',
  memoryLoading: '장기기억을 불러오는 중',
  memoryLoadError: '장기기억을 불러오지 못했습니다',
  /** 초과 안내 줄 · 저장 버튼 aria-describedby */
  memoryOverNote: `${MEMORY_SUMMARY_MAX}자 이하로 줄여 주세요.`,
  /** 저장 성공 토스트(success) */
  memorySaved: '장기기억을 저장했습니다',
  memoryDiscardTitle: '고친 내용을 버릴까요?',
  memoryDiscardBody: '저장하지 않은 내용은 사라집니다.',
  memoryDiscardConfirm: '버리기',
  /** 버림 확인의 취소 쪽(첫 포커스) */
  memoryKeepEditing: '계속 고치기',
  // ── S6 (design/lock.md §6) ──
  /** 방 메뉴 항목 */
  lock: '잠금',
  lockMenuAriaLabel: '잠금 메뉴',
  lockMenuHeader: (title: string): string => `잠금 · ${title}`,
  changePassword: '비밀번호 바꾸기',
  unlock: '잠금 풀기',
  setPasswordTitle: '비밀번호 걸기',
  setPasswordSave: '잠그기',
  changePasswordTitle: '비밀번호 바꾸기',
  changePasswordSave: '바꾸기',
  passwordInputAriaLabel: '새 비밀번호',
  passwordPlaceholder: '6자 이상 권장',
  unlockTitle: '잠금을 풀까요?',
  unlockBody: '잠금을 풀면 누구나 이 방 대화를 볼 수 있습니다.',
  unlockConfirm: '풀기',
  /** 성공 토스트(success) 셋 */
  roomLockedNotice: '방을 잠갔습니다.',
  passwordChanged: '비밀번호를 바꿨습니다.',
  unlockedNotice: '잠금을 풀었습니다.',
  /** 입장 재요구 판 StateView(role=status) */
  lockedRoom: '잠긴 방입니다',
} as const

/** 유저 말풍선·버튼 줄 이름의 작성자 표기(F-CH-43). 받은 값을 그대로 쓰고, 비었을 때만 고정 명칭(R-CHAT-002 · R-AUTH-004) */
export const userAuthorLabel = (authorName: string | null): string =>
  authorName === null || authorName === '' ? USER_DISPLAY_NAME : authorName

const ROOM_NOT_FOUND_TEXT = '방을 찾을 수 없습니다. 목록으로 돌아가 주세요.'

/**
 * 오류 코드별 상세 문구(읽기). 서버 error.message 는 화면에 쓰지 않는다(api.md §3.1).
 * 쓰기 실패 문구는 writeErrorText 가 정한다.
 */
export const errorDetail = (code: ApiErrorCode): string => {
  if (code === 'NETWORK') return NETWORK_TEXT
  if (code === 'NOT_FOUND') return ROOM_NOT_FOUND_TEXT
  return ERROR_MESSAGES[code]
}

/**
 * 쓰기 6종 중 화면이 실패를 안내하는 동작(deleteMessage·deleteRoom 의 NOT_FOUND 는 실패로 보지 않는다).
 * S4: 'memory' = 장기기억 조회·저장(시트 안 문구와 전환 문구가 같은 표를 쓴다)
 * S6: 'setRoomPassword' · 'clearRoomPassword' = 방 비밀번호 걸기·바꾸기(E18)와 풀기(E19)
 */
export type WriteAction =
  | 'send'
  | 'editMessage'
  | 'deleteMessage'
  | 'renameRoom'
  | 'deleteRoom'
  | 'speak'
  | 'regenerate'
  | 'memory'
  | 'setRoomPassword'
  | 'clearRoomPassword'

const rateLimitedText = (retryAfterSec: number | undefined): string =>
  retryAfterSec === undefined
    ? ERROR_MESSAGES.RATE_LIMITED
    : `요청이 너무 많습니다. ${retryAfterSec}초 후 다시 시도해 주세요.`

const LLM_FAILED_SPEAK_TEXT = '생성에 실패했습니다.'
/** S3e 개정(D-30): 메뉴가 없어져 "메뉴에서 다시 시도" 안내를 "재작성을 다시 눌러"로 바꿨다(design/actions.md §8) */
const LLM_FAILED_REGENERATE_TEXT = '대사를 다시 만들지 못했습니다. 재작성을 다시 눌러 주세요.'
const NOT_LAST_MESSAGE_TEXT =
  '다른 메시지가 먼저 이어져 재작성할 수 없습니다. 대화를 새로 불러옵니다.'

/** NOT_FOUND: 메시지 수정·재작성이면 메시지, 그 밖에는 방을 못 찾은 것이다 */
const notFoundText = (action: WriteAction): string =>
  action === 'editMessage' || action === 'regenerate'
    ? '메시지를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.'
    : ROOM_NOT_FOUND_TEXT

const validationText = (action: WriteAction): string => {
  if (action === 'renameRoom') return `방 제목은 1~${ROOM_TITLE_MAX}자로 입력해 주세요.`
  if (action === 'memory') return `장기기억은 0~${MEMORY_SUMMARY_MAX}자로 입력해 주세요.`
  if (action === 'setRoomPassword') {
    return `비밀번호는 ${ROOM_PASSWORD_MIN}~${ROOM_PASSWORD_MAX}자로 입력해 주세요.`
  }
  if (action === 'speak' || action === 'regenerate') return ERROR_MESSAGES.VALIDATION_ERROR
  return `메시지는 1~${MESSAGE_TEXT_MAX}자로 입력해 주세요.`
}

/**
 * 쓰기 실패 문구(R-CHAT-011, 설계 §8.3). 문구는 code 와 동작으로 정한다 — 서버 error.message·토큰 값은 쓰지 않는다.
 * 인증 3종은 전환 안내, RATE_LIMITED 는 retryAfterSec 가 있으면 초를 넣는다.
 */
export const writeErrorText = (error: ApiError, action: WriteAction): string => {
  const authText = AUTH_FAILURE_TEXT[error.code]
  if (authText !== undefined) return authText
  switch (error.code) {
    case 'RATE_LIMITED':
      return rateLimitedText(error.retryAfterSec)
    case 'VALIDATION_ERROR':
      return validationText(action)
    case 'NOT_FOUND':
      return notFoundText(action)
    case 'NETWORK':
      return NETWORK_TEXT
    case 'LLM_FAILED':
    case 'LLM_EMPTY':
      return action === 'regenerate' ? LLM_FAILED_REGENERATE_TEXT : LLM_FAILED_SPEAK_TEXT
    case 'NOT_LAST_MESSAGE':
      return NOT_LAST_MESSAGE_TEXT
    default:
      return ERROR_MESSAGES[error.code]
  }
}

/** 실패 말풍선 문구(F-CH-37, generate.md §3). 인증 3종·NOT_FOUND 는 말풍선에 오지 않지만 와도 표의 같은 행을 쓴다 */
export const speakErrorText = (error: ApiError): string => writeErrorText(error, 'speak')
