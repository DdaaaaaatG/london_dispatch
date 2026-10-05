/**
 * [목적] 서비스·모듈이 throw 하는 유일한 에러와 에러 응답 본문 생성기 (R-API-002). 설계 index.md §2.4
 * [공개 API] AppError, isAppError, toErrorBody, AppErrorStatus
 * [비동기] 없음(동기 순수 코드)
 * [에러] AppError{ code: ErrorCode, status: ERROR_STATUS[code] }
 * [설정] 없음
 * [테스트] server/test/app.test.ts (SRV-T-082·083), db.test.ts (SRV-T-031)
 */
import { ERROR_MESSAGES, ERROR_STATUS, type ErrorCode, type ErrorStatus } from '@shared/errors'

export type AppErrorStatus = ErrorStatus

/** 서비스가 throw 하는 에러. status 는 코드에서, message 기본값은 ERROR_MESSAGES 에서 정한다 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: AppErrorStatus

  constructor(code: ErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? ERROR_MESSAGES[code], options)
    this.name = 'AppError'
    this.code = code
    this.status = ERROR_STATUS[code]
  }
}

/** AppError 여부 */
export const isAppError = (e: unknown): e is AppError => e instanceof AppError

/** onError·notFound 가 쓰는 응답 본문 `{ error: { code, message } }` */
export const toErrorBody = (
  code: ErrorCode,
  message: string,
): { error: { code: ErrorCode; message: string } } => ({ error: { code, message } })
