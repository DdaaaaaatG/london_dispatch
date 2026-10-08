/**
 * settings 화면 확정 문구·라벨 — 단일 소스 settings/requirements.md §5 (design.md §8)
 * JSX·유틸에 한글 문구 리터럴을 직접 쓰지 않는다(aria-label · 오류 문구 포함).
 * 필드 라벨은 여기 없다: CHARACTER_FIELD_SPECS[key].label · WORLD_FIELD_SPEC.label 이 단일 소스다(서버 400 문구와 같은 이름).
 * 캐릭터 이름은 CHARACTERS[id].shortName 이 단일 소스다(R-LLM-002). 사전 검사·400·가져오기 거부 문장은 checkCharacterSettings 의 것을 그대로 쓴다.
 */
import { CHARACTERS } from '@shared/characters'
import { ERROR_MESSAGES } from '@shared/errors'
import type { ApiError, ApiErrorCode } from '@/api'
import { AUTH_FAILURE_TEXT, NETWORK_TEXT } from '@/components/utils/errorText'
import { formatMonthDay, formatTime } from '@/components/utils/formatDate'
import type { FieldIssue, SettingsStatus } from '@/state/settings'
import type { ImportApplied, ImportFailure, ImportSuccess } from '@/state/settingsFile'

/** 코드별 기본 문구. 서버 error.message 는 쓰지 않는다(VALIDATION_ERROR 저장 토스트만 예외) */
const errorText = (code: ApiErrorCode): string =>
  code === 'NETWORK' ? NETWORK_TEXT : ERROR_MESSAGES[code]

/** 설정 열 때 rooms 로 넘기는 인증 실패 안내 */
const authText = (code: ApiErrorCode): string => AUTH_FAILURE_TEXT[code] ?? errorText(code)

/** 저장 실패 토스트 문구(requirements.md §5.7). 인증 실패·OWNER_ONLY 는 토스트가 아니라 stale·rooms 안내로 간다 */
const saveErrorText = (error: ApiError): string => {
  switch (error.code) {
    case 'RATE_LIMITED':
      return error.retryAfterSec === undefined
        ? ERROR_MESSAGES.RATE_LIMITED
        : `요청이 너무 많습니다. ${error.retryAfterSec}초 후 다시 시도해 주세요.`
    case 'VALIDATION_ERROR':
      return error.message === '' ? ERROR_MESSAGES.VALIDATION_ERROR : error.message
    default:
      return authText(error.code)
  }
}

/** 하단 줄 D 문구(requirements.md §5.3) */
const statusText = (status: SettingsStatus): string => {
  switch (status.kind) {
    case 'saving':
      return '저장 중...'
    case 'stale':
      return '인증 만료'
    case 'invalid':
      return status.message
    case 'dirty':
      return '저장하지 않은 변경 있음'
    case 'default':
      return '기본값 사용 중'
    case 'saved':
      return `v${status.version} 저장됨 ${formatMonthDay(status.updatedAt)} ${formatTime(status.updatedAt)}`
  }
}

/** 필드 아래 안내 한 줄(requirements.md §5.2) */
const fieldIssueText = (issue: FieldIssue): string => {
  switch (issue.kind) {
    case 'required':
      return '필수 항목입니다.'
    case 'tooLong':
      return `${issue.max}자 이하로 줄여 주세요.`
    case 'tooManyLines':
      return `${issue.maxItems}줄 이하로 줄여 주세요.`
    case 'lineTooLong':
      return `${issue.lineNo}번째 줄이 ${issue.itemMax}자를 넘습니다.`
  }
}

/** 가져오기 거부 사유(requirements.md §5.5). invalid 는 후보 검사 문장 그대로 */
const importFailureText = (failure: ImportFailure): string => {
  switch (failure.reason) {
    case 'tooLarge':
      return '파일이 5MB를 넘어 읽지 않았습니다.'
    case 'readFailed':
      return '파일을 읽지 못했습니다.'
    case 'notJson':
    case 'unknownFormat':
      return '알 수 없는 파일 형식입니다.'
    case 'unsupportedVersion':
      return '지원하지 않는 파일 버전입니다.'
    case 'noMatchingWorld':
      return '세바스찬·시엘이 들어 있는 세계를 찾지 못했습니다.'
    case 'invalid':
      return failure.message
  }
}

const ignoredNote = (ignoredCount: number): string =>
  ignoredCount > 0 ? ` 무시한 항목 ${ignoredCount}개.` : ''

/** 반영된 것만 `공통 1` · `세바스찬 k` · `시엘 k` 를 `·` 로 잇는다 */
const importRange = (applied: ImportApplied): string =>
  [
    applied.world ? '공통 1' : null,
    applied.sebastian > 0 ? `${CHARACTERS.sebastian.shortName} ${applied.sebastian}` : null,
    applied.ciel > 0 ? `${CHARACTERS.ciel.shortName} ${applied.ciel}` : null,
  ]
    .filter(part => part !== null)
    .join('·')

export const labels = {
  // ── 화면·탭·필드 (§5.1) ──
  screenTitle: '캐릭터 설정',
  backAriaLabel: '뒤로',
  fileMenuAriaLabel: '설정 파일 메뉴',
  tabListAriaLabel: '설정 묶음',
  tabLabel: {
    world: '공통',
    sebastian: CHARACTERS.sebastian.shortName,
    ciel: CHARACTERS.ciel.shortName,
  },
  tabIssueSuffix: ', 확인할 항목 있음',
  // (S3f) 「공통」 탭 맨 위 AI 모델 묶음(§5.1). 모델명·가격 숫자는 화면에 없다(R-SET-013 · R-LLM-009)
  modelLegend: 'AI 모델',
  modelOption: {
    pro: { name: 'Pro', description: '더 정교하지만 느리고 비용이 큼' },
    flash: { name: 'Flash', description: '빠르고 비용이 적음' },
  },
  modelNoteSelected: '저장하면 다음 대답부터 이 모델을 씁니다.',
  modelNoteUnset: '아직 고르지 않았습니다. 지금은 서버 기본 모델을 씁니다.',
  groupBasic: '기본 정보',
  groupPersona: '인물',
  groupSpeech: '말투·규칙',
  requiredMark: '*',
  requiredAria: (label: string): string => `${label}, 필수`,
  listHint: (maxItems: number): string => `(한 줄에 하나, 최대 ${maxItems})`,
  lineCounter: (count: number, max: number): string => `${count}/${max}줄`,
  fieldIssueText,
  // ── 하단 줄 D (§5.3) ──
  statusText,
  revert: '되돌리기',
  save: '저장',
  // ── 시트 (§5.4) ──
  fileMenuTitle: '설정 파일',
  exportItem: '내보내기',
  importItem: '가져오기',
  cancel: '취소',
  exportTitle: '내보내기',
  exportDirtyNote: '저장하지 않은 변경은 포함되지 않습니다.',
  exportStaleNote: '인증이 만료되어 현재 초안을 내보냅니다.',
  exportTextAriaLabel: '내보낼 설정 JSON',
  close: '닫기',
  saveFile: '파일로 저장',
  importTitle: '가져오기',
  chooseFile: '파일 선택',
  noFileChosen: '선택한 파일 없음',
  pasteLabel: '또는 JSON 붙여넣기',
  importNote: '초안에만 반영되고 저장은 따로 합니다.',
  importSubmit: '불러오기',
  leaveTitle: '저장하지 않은 변경이 있습니다',
  leaveMessage: '나가면 고친 내용이 사라집니다. 나갈까요?',
  leaveConfirm: '나가기',
  // ── 가져오기 거부 · 토스트 · 안내 (§5.5 ~ §5.6) ──
  importFailureText,
  saved: '저장했습니다. 다음 대사부터 반영됩니다.',
  importSummary: (result: ImportSuccess): string =>
    `가져왔습니다(${importRange(result.applied)}).${ignoredNote(result.ignoredCount)} 저장해야 반영됩니다.`,
  importNothing: (ignoredCount: number): string =>
    `가져올 항목이 없습니다.${ignoredNote(ignoredCount)}`,
  fileSaveFailed: '파일로 저장하지 못했습니다. 위 글을 복사해 주세요.',
  loadError: '설정을 불러오지 못했습니다',
  loadErrorDetail: errorText,
  loading: '설정을 불러오는 중',
  retry: '다시 시도',
  staleNotice: '인증이 만료되었습니다. 내보내기로 변경을 보관한 뒤 새로 고쳐 주세요.',
  // ── 오류 코드별 안내 (§5.7) ──
  ownerOnly: '캐릭터 설정은 갠홈 주인만 열 수 있습니다.',
  authText,
  saveErrorText,
} as const
