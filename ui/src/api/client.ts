/**
 * fetch 래퍼 — 단일 소스 doc/200_설계/contract/api.md §2.4 · §3.4 · §11.6
 * 모든 래퍼는 throw 하지 않고 Result<T> 를 돌려준다 (ts-rules 에러 처리)
 * 토큰은 보관하지 않는다. main.tsx 가 configureClient 로 넘긴 getter 를 쓰기 요청 때만 부른다 (R-API-003)
 * 화면·컴포넌트·state 는 fetch 를 직접 쓰지 않는다 (확정사항 §3)
 */
import { ROOM_KEY_HEADER } from '@shared/endpoints'
import { ERROR_MESSAGES, isErrorCode, type ErrorCode } from '@shared/errors'

export type ApiErrorCode = ErrorCode | 'NETWORK'
export type ApiError = {
  code: ApiErrorCode
  message: string
  /** RATE_LIMITED 에만. 다음 시도까지 기다릴 초(정수 ≥ 1) (api.md §3.4) */
  retryAfterSec?: number
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError }

/**
 * getter 주입. 토큰 보관은 ui/src/state/token.ts (api.md §2.4), 입장 증명 보관은 state/roomKeys.ts (api.md §2.8.2)
 * getRoomKey 가 없으면 항상 null — 증명을 보관·로그하지 않고 요청 때마다 getter 로 읽는다
 */
export type ClientConfig = {
  getToken: () => string | null
  getRoomKey?: (roomId: string) => string | null
}

/** 서버가 내지 않는 클라이언트 전용 실패 (api.md §3.3) */
export const NETWORK_ERROR: ApiError = { code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }
const INTERNAL_ERROR: ApiError = { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL }

/** 동일 출처. 화면은 서버가 /embed 로 내려주고, dev 는 Vite 가 /api 를 프록시한다 */
const BASE_URL = ''

/** getter 슬롯. 바꾸는 곳은 configureClient 뿐이다 (ts-rules 클로저 캡슐화) */
const createSlots = () => {
  let getToken: ClientConfig['getToken'] = () => null
  let getRoomKey: NonNullable<ClientConfig['getRoomKey']> = () => null
  return {
    set: (config: ClientConfig): void => {
      getToken = config.getToken
      getRoomKey = config.getRoomKey ?? ((): null => null)
    },
    readToken: (): string | null => getToken(),
    readRoomKey: (roomId: string): string | null => getRoomKey(roomId),
  }
}
const slots = createSlots()

/** main.tsx 가 렌더 전에 한 번 부른다 (api.md §2.4). 테스트는 매번 다시 불러 바꾼다 */
export const configureClient = (config: ClientConfig): void => slots.set(config)

/** 읽기 전용으로 전환해야 하는 인증 실패인가 (api.md §2.4, R-CHAT-011) */
const AUTH_FAILURE_CODES: readonly ApiErrorCode[] = [
  'TOKEN_REQUIRED',
  'TOKEN_INVALID',
  'LEVEL_TOO_LOW',
]
export const isAuthFailure = (error: ApiError): boolean => AUTH_FAILURE_CODES.includes(error.code)

/** api 폴더 내부 전용. auth = 토큰 헤더 부착(쓰기 + 설정 GET). index 에서 내보내지 않는다 */
export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  auth?: boolean
  /** 방 경로 요청에만. 있으면 getRoomKey(roomId) 가 비어 있지 않을 때 X-Room-Key 를 붙인다. auth 와 독립 (api.md §11.18) */
  roomId?: string
}

const buildHeaders = ({ body, auth, roomId }: RequestOptions): Headers => {
  const headers = new Headers({ Accept: 'application/json' })
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  const token = auth === true ? slots.readToken() : null
  if (token !== null && token !== '') headers.set('Authorization', `Bearer ${token}`)
  const roomKey = roomId === undefined ? null : slots.readRoomKey(roomId)
  if (roomKey !== null && roomKey !== '') headers.set(ROOM_KEY_HEADER, roomKey)
  return headers
}

const readJson = async (res: Response): Promise<unknown> => {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

/** RATE_LIMITED 이고 1 이상 정수일 때만 retryAfterSec 를 싣는다 (api.md §3.4) */
const toRetryAfter = (code: ErrorCode, value: unknown): { retryAfterSec?: number } =>
  code === 'RATE_LIMITED' && typeof value === 'number' && Number.isInteger(value) && value >= 1
    ? { retryAfterSec: value }
    : {}

/** 실패 응답 본문을 계약 형식으로 맞춘다. 계약 형식이 아니면 INTERNAL (api.md §3.4) */
export const toApiError = (body: unknown): ApiError => {
  const error = (
    body as
      { error?: { code?: unknown; message?: unknown; retryAfterSec?: unknown } } | null | undefined
  )?.error
  const code = error?.code
  if (!isErrorCode(code)) return INTERNAL_ERROR
  const message = error?.message
  return {
    code,
    message: typeof message === 'string' && message !== '' ? message : ERROR_MESSAGES[code],
    ...toRetryAfter(code, error?.retryAfterSec),
  }
}

/** 계약 경로로 요청을 보내고 Result 로 정규화한다. 204 는 value undefined (api.md §3.4) */
export const request = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<Result<T>> => {
  const { method = 'GET', body } = options
  let res: Response
  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers: buildHeaders(options),
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }
  if (!res.ok) return { ok: false, error: toApiError(await readJson(res)) }
  if (res.status === 204) return { ok: true, value: undefined as T }
  const parsed = await readJson(res)
  return parsed === undefined
    ? { ok: false, error: INTERNAL_ERROR }
    : { ok: true, value: parsed as T }
}
