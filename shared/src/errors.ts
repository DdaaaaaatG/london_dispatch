/**
 * 에러 코드 — 단일 소스 doc/200_설계/contract/api.md §3.2 (R-API-002)
 * 코드 1개 = HTTP status 1개. ERROR_MESSAGES 는 기본 문구(서버는 상황별 문구를 쓸 수 있다)
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'TOKEN_REQUIRED',
  'TOKEN_INVALID',
  'LEVEL_TOO_LOW',
  'RATE_LIMITED',
  'NOT_FOUND',
  'SPEAK_IN_PROGRESS',
  'NOT_LAST_MESSAGE',
  'NOT_CHARACTER_MESSAGE',
  'LLM_FAILED',
  'LLM_EMPTY',
  'LLM_BUDGET_EXCEEDED',
  'CONFIG_INVALID',
  'INTERNAL',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502

/** 코드별 HTTP status */
export const ERROR_STATUS: Readonly<Record<ErrorCode, ErrorStatus>> = {
  VALIDATION_ERROR: 400,
  TOKEN_REQUIRED: 401,
  TOKEN_INVALID: 401,
  LEVEL_TOO_LOW: 403,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  SPEAK_IN_PROGRESS: 409,
  NOT_LAST_MESSAGE: 409,
  NOT_CHARACTER_MESSAGE: 400,
  LLM_FAILED: 502,
  LLM_EMPTY: 502,
  LLM_BUDGET_EXCEEDED: 429,
  CONFIG_INVALID: 500,
  INTERNAL: 500,
}

/** 코드별 기본 한국어 문구 */
export const ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  VALIDATION_ERROR: '요청 형식이 올바르지 않습니다.',
  TOKEN_REQUIRED: '로그인한 회원만 사용할 수 있습니다.',
  TOKEN_INVALID: '인증 정보가 올바르지 않거나 만료되었습니다. 페이지를 새로 고쳐 주세요.',
  LEVEL_TOO_LOW: '대화에 참여할 수 있는 회원 등급이 아닙니다.',
  RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  NOT_FOUND: '요청한 대상을 찾을 수 없습니다.',
  SPEAK_IN_PROGRESS: '이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요.',
  NOT_LAST_MESSAGE: '방의 마지막 메시지만 다시 생성할 수 있습니다.',
  NOT_CHARACTER_MESSAGE: '캐릭터 메시지만 다시 생성할 수 있습니다.',
  LLM_FAILED: 'AI 응답을 받지 못했습니다. 다시 시도해 주세요.',
  LLM_EMPTY: 'AI 응답이 비어 있습니다. 다시 시도해 주세요.',
  LLM_BUDGET_EXCEEDED: '이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.',
  CONFIG_INVALID: '서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요.',
  INTERNAL: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
}

/** 값이 계약 에러 코드인지 (화면이 응답 본문을 정규화할 때 쓴다) */
export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value)
