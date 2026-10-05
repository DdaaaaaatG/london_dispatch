/**
 * [목적] 서비스·모듈이 throw 하는 유일한 에러와 에러 응답 본문 생성기 (R-API-002). 설계 index.md §2.4
 * [공개 API] AppError, isAppError, toErrorBody, 타입 AppErrorStatus·AppErrorOptions
 * [비동기] 없음(동기 순수 코드)
 * [에러] AppError{ code: ErrorCode, status: ERROR_STATUS[code], retryAfterSec?: RATE_LIMITED 전용(S2, R-AUTH-005) }
 * [설정] 없음
 * [테스트] server/test/app.test.ts (SRV-T-082·083), db.test.ts (SRV-T-031)
 */
import { ERROR_MESSAGES, ERROR_STATUS, type ErrorCode, type ErrorStatus } from '@shared/errors'

export type AppErrorStatus = ErrorStatus

export type AppErrorOptions = {
  cause?: unknown
  /** RATE_LIMITED 전용. 정수 ≥ 1. onError 가 본문·Retry-After 헤더로 옮긴다 (S2) */
  retryAfterSec?: number
}

/** 서비스가 throw 하는 에러. status 는 코드에서, message 기본값은 ERROR_MESSAGES 에서 정한다 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: AppErrorStatus
  /** RATE_LIMITED 전용(S2) */
  readonly retryAfterSec?: number

  constructor(code: ErrorCode, message?: string, options?: AppErrorOptions) {
    super(
      message ?? ERROR_MESSAGES[code],
      options?.cause === undefined ? undefined : { cause: options.cause },
    )
    this.name = 'AppError'
    this.code = code
    this.status = ERROR_STATUS[code]
    if (options?.retryAfterSec !== undefined) this.retryAfterSec = options.retryAfterSec
  }
}

/** AppError 여부 */
export const isAppError = (e: unknown): e is AppError => e instanceof AppError

/** onError·notFound 가 쓰는 응답 본문. extra.retryAfterSec 가 있으면 error 안에 싣는다(S2) */
export const toErrorBody = (
  code: ErrorCode,
  message: string,
  extra?: { retryAfterSec?: number },
): { error: { code: ErrorCode; message: string; retryAfterSec?: number } } => ({
  error: {
    code,
    message,
    ...(extra?.retryAfterSec !== undefined ? { retryAfterSec: extra.retryAfterSec } : {}),
  },
})
