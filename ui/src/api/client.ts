/**
 * fetch 래퍼 — 단일 소스 doc/200_설계/contract/api.md §3.4 · §11.3
 * 모든 래퍼는 throw 하지 않고 Result<T> 를 돌려준다 (ts-rules 에러 처리)
 * 화면·컴포넌트·state 는 fetch 를 직접 쓰지 않는다 (확정사항 §3)
 */
import { ERROR_MESSAGES, isErrorCode, type ErrorCode } from '@shared/errors'

export type ApiErrorCode = ErrorCode | 'NETWORK'
export type ApiError = { code: ApiErrorCode; message: string }
export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError }

/** 서버가 내지 않는 클라이언트 전용 실패 (api.md §3.3) */
export const NETWORK_ERROR: ApiError = { code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }
const INTERNAL_ERROR: ApiError = { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL }

/** 동일 출처. 화면은 서버가 /embed 로 내려주고, dev 는 Vite 가 /api 를 프록시한다 */
const BASE_URL = ''

// TODO(R-API-003): S2 상세 예정 — 토큰은 ui/src/state/token.ts 가 보관한다. client.ts 는 getter 를 주입받아
//   쓰기 요청에 Authorization: Bearer 헤더만 붙인다(토큰을 직접 읽거나 저장하지 않는다). S1 은 읽기뿐이라 헤더 없음
const buildHeaders = (): Headers => new Headers({ Accept: 'application/json' })

const readJson = async (res: Response): Promise<unknown> => {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

/** 실패 응답 본문을 계약 형식으로 맞춘다. 계약 형식이 아니면 INTERNAL (api.md §3.4) */
export const toApiError = (body: unknown): ApiError => {
  const error = (body as { error?: { code?: unknown; message?: unknown } } | null | undefined)?.error
  const code = error?.code
  if (!isErrorCode(code)) return INTERNAL_ERROR
  const message = error?.message
  return { code, message: typeof message === 'string' && message !== '' ? message : ERROR_MESSAGES[code] }
}

/** 계약 경로로 GET 요청을 보내고 Result 로 정규화한다. S2 에서 method·body 옵션을 추가한다 */
export const request = async <T>(path: string): Promise<Result<T>> => {
  let res: Response
  try {
    res = await fetch(BASE_URL + path, { method: 'GET', headers: buildHeaders() })
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }
  const body = await readJson(res)
  if (!res.ok) return { ok: false, error: toApiError(body) }
  return body === undefined ? { ok: false, error: INTERNAL_ERROR } : { ok: true, value: body as T }
}
