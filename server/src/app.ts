/**
 * [목적] Hono 앱 조립: 요청 로그 → 보안 헤더(CSP) → 부트스트랩(parseEnv) → /embed → routes, notFound·onError (R-ENV-001·003, R-API-002·006). 설계 index.md §2.2·§3
 * [공개 API] createApp(options?) -> Hono<AppEnv>, buildCsp(frameAncestors?), 타입 CreateAppOptions
 * [비동기] 모든 미들웨어 async. /embed 는 await env.ASSETS.fetch. 요청 간 공유 상태 없음
 * [에러] ConfigError→500 CONFIG_INVALID, AppError→자기 status, HTTPException 400→VALIDATION_ERROR, 그 외→500 INTERNAL, 매칭 없음→404 NOT_FOUND
 * [설정] parseEnv 결과의 allowedFrameAncestors 만 CSP 에 쓴다. 다른 설정 키는 읽지 않는다
 * [테스트] server/test/app.test.ts (SRV-T-080~089)
 */
import { PATHS } from '@shared/endpoints'
import type { ErrorCode } from '@shared/errors'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Context, MiddlewareHandler } from 'hono'
import { AppError, isAppError, toErrorBody } from './app-error'
import { createDb } from './db'
import { ConfigError, parseEnv } from './env'
import { createLogger, type LogSink, type Logger } from './logger'
import { createServices, type AppEnv } from './services'

export type CreateAppOptions = {
  /** contract 의 apiRoutes. 테스트는 시험용 라우트를 넣는다 */
  routes?: Hono<AppEnv>
  /** 로그 출력 대상. 기본은 console(logger.ts 안에서만 사용) */
  logSink?: LogSink
  /** 시계. 기본 Date.now */
  now?: () => number
}

const MSG_NOT_FOUND = '요청한 주소를 찾을 수 없습니다.'
const MSG_VALIDATION = '요청 형식이 올바르지 않습니다.'
const MSG_INTERNAL = '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
const CSP_NONE = "'none'"
const ERR_MESSAGE_LOG_MAX = 300

/** CSP frame-ancestors 헤더 값을 만든다. 설정이 없으면 'none' */
export const buildCsp = (frameAncestors?: readonly string[]): string =>
  `frame-ancestors ${frameAncestors && frameAncestors.length > 0 ? frameAncestors.join(' ') : CSP_NONE}`

const requestLog = (logger: Logger, now: () => number): MiddlewareHandler<AppEnv> => async (c, next) => {
  const start = now()
  await next()
  logger.info('request', {
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    status: c.res.status,
    ms: now() - start,
  })
}

const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next()
  const ancestors = c.get('cspFrameAncestors')
  // serveEmbed 가 이미 다시 감싼 Response 라 헤더 변경 가능. c.res 재할당은 이전 헤더를 병합해 삭제를 되살리므로 쓰지 않는다
  c.res.headers.set('Content-Security-Policy', buildCsp(ancestors ? ancestors.split(' ') : undefined))
  c.res.headers.delete('X-Frame-Options')
}

const bootstrap = (logger: Logger, now: () => number): MiddlewareHandler<AppEnv> => async (c, next) => {
  const config = parseEnv(c.env)
  c.set('cspFrameAncestors', config.allowedFrameAncestors.join(' '))
  c.set('services', createServices({ db: createDb(c.env.DB), logger, now }))
  await next()
}

/** /embed 요청 경로를 ASSETS 경로로 바꾼다. /embed·/embed/ → / */
const toAssetPath = (pathname: string): string => {
  const rest = pathname.slice(PATHS.embed.length)
  return rest === '' || rest === '/' ? '/' : rest
}

const serveEmbed = async (c: Context<AppEnv>): Promise<Response> => {
  const url = new URL(c.req.url)
  const res = await c.env.ASSETS.fetch(new URL(toAssetPath(url.pathname), url.origin).toString())
  if (res.status === 404) throw new AppError('NOT_FOUND', MSG_NOT_FOUND)
  return new Response(res.body, res)
}

const errorResponse = (c: Context<AppEnv>, code: ErrorCode, status: AppError['status'], message: string) =>
  c.json(toErrorBody(code, message), status)

const handleError = (logger: Logger) => (err: Error, c: Context<AppEnv>): Response => {
  if (err instanceof ConfigError) {
    logger.error('config_invalid', { keys: err.keys.join(',') })
    return errorResponse(c, err.code, err.status, err.message)
  }
  if (isAppError(err)) {
    if (err.status >= 500) logger.error('app_error', { code: err.code })
    return errorResponse(c, err.code, err.status, err.message)
  }
  if (err instanceof HTTPException && err.status === 400) {
    return errorResponse(c, 'VALIDATION_ERROR', 400, MSG_VALIDATION)
  }
  logger.error('unhandled_error', {
    errName: err.name,
    errMessage: err.message.slice(0, ERR_MESSAGE_LOG_MAX),
  })
  return errorResponse(c, 'INTERNAL', 500, MSG_INTERNAL)
}

/** Hono 앱을 만든다 */
export const createApp = (options: CreateAppOptions = {}): Hono<AppEnv> => {
  const logger = createLogger(options.logSink)
  const now = options.now ?? Date.now
  const app = new Hono<AppEnv>()

  app.use('*', requestLog(logger, now))
  app.use('*', securityHeaders)
  app.use('*', bootstrap(logger, now))
  app.get(PATHS.embed, serveEmbed)
  app.get(`${PATHS.embed}/*`, serveEmbed)
  if (options.routes) app.route('/', options.routes)
  app.notFound((c) => errorResponse(c, 'NOT_FOUND', 404, MSG_NOT_FOUND))
  app.onError(handleError(logger))
  return app
}
