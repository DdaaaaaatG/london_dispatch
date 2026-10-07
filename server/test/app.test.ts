// SRV-T-080~089, 160~162, 327 - doc/200_설계/server/index.md 8, 13.3
import { createExecutionContext, env } from 'cloudflare:test'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { describe, expect, it } from 'vitest'
import { AppError } from '../src/app-error'
import { createApp, buildCsp } from '../src/app'
import { createDb, type Db } from '../src/db'
import { parseEnv, type Env } from '../src/env'
import { FAKE_DEFAULT_TEXT } from '../src/llm'
import { insertLines, insertRoom, resetDb } from './helpers'
import { createLogger, type LogLevel } from '../src/logger'
import { APP_VERSION, createServices, type AppEnv } from '../src/services'

const ANCESTORS = 'http://london-gossip.my https://london-gossip.my'
const NOW = 1_700_000_000_000

type LogLine = { level: LogLevel; line: string }

const collector = () => {
  const lines: LogLine[] = []
  return { lines, sink: (level: LogLevel, line: string) => void lines.push({ level, line }) }
}

const fakeAssets = (respond: (path: string) => Response = () => new Response('<html></html>')) => {
  const requested: string[] = []
  const fetcher = {
    fetch: async (input: string | Request | URL) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
      requested.push(url.pathname + url.search)
      return respond(url.pathname)
    },
  }
  return { requested, fetcher: fetcher as unknown as Fetcher }
}

const testRoutes = new Hono<AppEnv>()
testRoutes.get('/t/ok', c => c.json({ ok: true }))
testRoutes.get('/t/conflict', () => {
  throw new AppError('SPEAK_IN_PROGRESS')
})
testRoutes.get('/t/room-missing', () => {
  throw new AppError('NOT_FOUND', '방을 찾을 수 없습니다.')
})
testRoutes.get('/t/boom', () => {
  throw new Error('SENTINEL_DETAIL')
})
testRoutes.get('/t/http400', () => {
  throw new HTTPException(400, { message: 'bad json' })
})
testRoutes.get('/t/health', c => c.json(c.get('services').getHealth()))

const baseEnv = (overrides: Record<string, unknown> = {}): Env =>
  ({
    DB: env.DB,
    ASSETS: fakeAssets().fetcher,
    TOKEN_SECRET: 'test-secret-0123456789-abcdefghijklmnop',
    ...overrides,
  }) as unknown as Env

const call = (
  app: ReturnType<typeof createApp>,
  path: string,
  e: Env = baseEnv(),
): Promise<Response> =>
  Promise.resolve(app.fetch(new Request(`http://test${path}`), e, createExecutionContext()))

const makeApp = () => {
  const log = collector()
  return { log, app: createApp({ routes: testRoutes, logSink: log.sink, now: () => NOW }) }
}

describe('보안 헤더', () => {
  it('SRV-T-080 every_response_has_csp_and_no_x_frame_options', async () => {
    const { app } = makeApp()
    const assets = fakeAssets(() => new Response('x', { headers: { 'X-Frame-Options': 'DENY' } }))
    const e = baseEnv({ ASSETS: assets.fetcher })
    const expected = `frame-ancestors ${ANCESTORS}`
    const cases: [string, number][] = [
      ['/t/ok', 200],
      ['/nope', 404],
      ['/t/conflict', 409],
      ['/embed', 200],
    ]
    for (const [path, status] of cases) {
      const res = await call(app, path, e)
      expect(res.status, path).toBe(status)
      expect(res.headers.get('Content-Security-Policy'), path).toBe(expected)
      expect(res.headers.get('X-Frame-Options'), path).toBeNull()
    }
    const broken = await call(app, '/t/ok', baseEnv({ TOKEN_SECRET: undefined }))
    expect(broken.status).toBe(500)
    expect(broken.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'")
  })

  it('SRV-T-291 api_responses_deny_framing_and_set_secure_headers_but_embed_keeps_ancestors', async () => {
    const routes = new Hono<AppEnv>()
    routes.get('/api/t/ok', c => c.json({ ok: true }))
    routes.get('/api/t/conflict', () => {
      throw new AppError('SPEAK_IN_PROGRESS')
    })
    const app = createApp({ routes, logSink: () => {}, now: () => NOW })
    for (const [path, status] of [
      ['/api/t/ok', 200],
      ['/api/t/conflict', 409],
      ['/api/nope', 404],
    ] as const) {
      const res = await call(app, path)
      expect(res.status, path).toBe(status)
      expect(res.headers.get('Content-Security-Policy'), path).toBe("frame-ancestors 'none'")
      expect(res.headers.get('X-Content-Type-Options'), path).toBe('nosniff')
      expect(res.headers.get('Referrer-Policy'), path).toBe('no-referrer')
      expect(res.headers.get('X-Frame-Options'), path).toBeNull()
    }
    const embed = await call(
      app,
      '/embed',
      baseEnv({ ASSETS: fakeAssets(() => new Response('x')).fetcher }),
    )
    expect(embed.headers.get('Content-Security-Policy')).toBe(`frame-ancestors ${ANCESTORS}`)
    expect(embed.headers.get('Referrer-Policy')).toBeNull()
  })

  it('buildCsp 는 설정이 없으면 none', () => {
    expect(buildCsp()).toBe("frame-ancestors 'none'")
    expect(buildCsp(['https://a.my'])).toBe('frame-ancestors https://a.my')
  })
})

describe('에러 응답', () => {
  it('SRV-T-081 config_invalid_returns_500_and_logs_key_names_only', async () => {
    const { app, log } = makeApp()
    const res = await call(app, '/t/ok', baseEnv({ TOKEN_SECRET: undefined }))
    expect(res.status).toBe(500)
    const body = await res.text()
    expect(JSON.parse(body).error.code).toBe('CONFIG_INVALID')
    expect(body).not.toContain('TOKEN_SECRET')

    const second = makeApp()
    const res2 = await call(second.app, '/t/ok', baseEnv({ LLM_MODEL: 'SENTINEL/x' }))
    expect(res2.status).toBe(500)
    const logs = second.log.lines.map(l => l.line).join('\n')
    expect(logs).toContain('LLM_MODEL')
    expect(logs).not.toContain('SENTINEL')
    expect(await res2.text()).not.toContain('LLM_MODEL')
    expect(log.lines.some(l => l.level === 'error')).toBe(true)
  })

  it('SRV-T-082 onError_maps_AppError_status_and_body', async () => {
    const { app } = makeApp()
    const res = await call(app, '/t/room-missing')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: '방을 찾을 수 없습니다.' },
    })
  })

  it('SRV-T-083 onError_hides_unknown_error_details', async () => {
    const { app, log } = makeApp()
    const res = await call(app, '/t/boom')
    expect(res.status).toBe(500)
    const body = await res.text()
    expect(JSON.parse(body).error.code).toBe('INTERNAL')
    expect(body).not.toContain('SENTINEL_DETAIL')
    expect(body).not.toContain('stack')
    const entry = log.lines
      .map(l => JSON.parse(l.line) as Record<string, unknown>)
      .find(l => l.event === 'unhandled_error')
    expect(entry?.errName).toBe('Error')
  })

  it('SRV-T-084 http_exception_400_maps_to_VALIDATION_ERROR', async () => {
    const { app } = makeApp()
    const res = await call(app, '/t/http400')
    expect(res.status).toBe(400)
    expect((await res.json<{ error: { code: string } }>()).error.code).toBe('VALIDATION_ERROR')
  })

  it('SRV-T-085 notFound_returns_NOT_FOUND_json', async () => {
    const { app } = makeApp()
    for (const path of ['/nope', '/index.html']) {
      const res = await call(app, path)
      expect(res.status, path).toBe(404)
      expect((await res.json<{ error: { code: string } }>()).error.code).toBe('NOT_FOUND')
    }
  })
})

describe('/embed', () => {
  it('SRV-T-086 embed_maps_paths_to_assets_and_drops_query', async () => {
    const { app } = makeApp()
    const assets = fakeAssets(p =>
      p === '/missing.js' ? new Response('nf', { status: 404 }) : new Response('ok'),
    )
    const e = baseEnv({ ASSETS: assets.fetcher })
    for (const path of ['/embed', '/embed/', '/embed?t=abc']) {
      expect((await call(app, path, e)).status, path).toBe(200)
    }
    expect(assets.requested).toEqual(['/', '/', '/'])
    await call(app, '/embed/assets/a.js', e)
    expect(assets.requested.at(-1)).toBe('/assets/a.js')
    const missing = await call(app, '/embed/missing.js', e)
    expect(missing.status).toBe(404)
    expect((await missing.json<{ error: { code: string } }>()).error.code).toBe('NOT_FOUND')
  })
})

describe('서비스·로그', () => {
  it('SRV-T-087 getHealth_returns_ok_and_version_without_db', () => {
    const trap = new Proxy(
      {},
      {
        get: () => () => {
          throw new Error('db touched')
        },
      },
    ) as unknown as Db
    const services = createServices({
      db: trap,
      logger: createLogger(() => {}),
      now: () => NOW,
      config: parseEnv(baseEnv()),
    })
    expect(services.getHealth()).toEqual({ ok: true, version: APP_VERSION })
    expect(APP_VERSION).not.toBe('')
  })

  it('SRV-T-088 logs_never_contain_query_token_or_forbidden_fields', async () => {
    const { app, log } = makeApp()
    await call(app, '/embed?t=SENTINEL_TOKEN')
    const all = log.lines.map(l => l.line).join('\n')
    expect(all).not.toContain('SENTINEL_TOKEN')
    const req = log.lines
      .map(l => JSON.parse(l.line) as Record<string, unknown>)
      .find(l => l.event === 'request')
    expect(req?.path).toBe('/embed')

    const direct = collector()
    createLogger(direct.sink).info('x', { token: 'S1', text: 'S2', apiKey: 'S3', roomId: 'r' })
    const out = JSON.parse(direct.lines[0]!.line) as Record<string, unknown>
    expect([out.token, out.text, out.apiKey]).toEqual(['[redacted]', '[redacted]', '[redacted]'])
    expect(out.roomId).toBe('r')
  })

  it('SRV-T-089 bootstrap_parses_env_on_every_request', async () => {
    const { app } = makeApp()
    const a = await call(app, '/t/ok', baseEnv({ ALLOWED_FRAME_ANCESTORS: 'https://a.my' }))
    const b = await call(app, '/t/ok', baseEnv({ ALLOWED_FRAME_ANCESTORS: 'https://b.my' }))
    expect(a.headers.get('Content-Security-Policy')).toBe('frame-ancestors https://a.my')
    expect(b.headers.get('Content-Security-Policy')).toBe('frame-ancestors https://b.my')
  })
})

// ---- S2 (SRV-T-160~162) — doc/200_설계/server/index.md §8 ----
describe('S2 앱 계층', () => {
  it('SRV-T-160 onError_adds_retryAfterSec_body_and_header', async () => {
    const routes = new Hono<AppEnv>()
    routes.get('/t/limited', () => {
      throw new AppError('RATE_LIMITED', undefined, { retryAfterSec: 45 })
    })
    routes.get('/t/plain', () => {
      throw new AppError('NOT_FOUND')
    })
    const app = createApp({ routes, logSink: () => {}, now: () => NOW })
    const limited = await call(app, '/t/limited')
    expect(limited.status).toBe(429)
    expect(limited.headers.get('Retry-After')).toBe('45')
    expect(limited.headers.get('Content-Security-Policy')).toBe(`frame-ancestors ${ANCESTORS}`)
    expect(await limited.json()).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
        retryAfterSec: 45,
      },
    })
    const plain = await call(app, '/t/plain')
    const body = (await plain.json()) as { error: Record<string, unknown> }
    expect('retryAfterSec' in body.error).toBe(false)
    expect(plain.headers.get('Retry-After')).toBeNull()
  })

  it('SRV-T-233 onError_maps_LLM_BUDGET_EXCEEDED_to_429_with_retry_after', async () => {
    const routes = new Hono<AppEnv>()
    routes.get('/t/budget', () => {
      throw new AppError('LLM_BUDGET_EXCEEDED', undefined, { retryAfterSec: 2678400 })
    })
    const app = createApp({ routes, logSink: () => {}, now: () => NOW })
    const res = await call(app, '/t/budget')
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('2678400')
    expect(res.headers.get('Content-Security-Policy')).toBe(`frame-ancestors ${ANCESTORS}`)
    expect(await res.json()).toEqual({
      error: {
        code: 'LLM_BUDGET_EXCEEDED',
        message: '이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.',
        retryAfterSec: 2678400,
      },
    })
  })

  it('SRV-T-161 createServices_wires_auth_with_config_without_exposing_secret', () => {
    const trap = new Proxy(
      {},
      {
        get: () => () => {
          throw new Error('db touched')
        },
      },
    ) as unknown as Db
    const config = parseEnv(baseEnv({ TOKEN_SECRET: 'SENTINEL_SECRET_VALUE_0123456789abcdef' }))
    const services = createServices({
      db: trap,
      logger: createLogger(() => {}),
      now: () => NOW,
      config,
    })
    expect(services.auth).toBeDefined()
    expect(services.getHealth()).toEqual({ ok: true, version: APP_VERSION })
    expect(JSON.stringify(services)).not.toContain('SENTINEL_SECRET_VALUE')
    expect(Object.keys(services.auth).sort()).toEqual(
      ['assertOwner', 'authenticate', 'hitRateLimit', 'isOwner'].sort(),
    )
    expect(Object.keys(services.auth).join()).not.toContain('tokenSecret')
  })

  it('SRV-T-162 request_log_never_contains_authorization_header', async () => {
    const routes = new Hono<AppEnv>()
    routes.get('/t/read', c => c.json({ ok: true }))
    routes.post('/t/write', c => c.json({ ok: true }))
    const log = collector()
    const app = createApp({ routes, logSink: log.sink, now: () => NOW })
    const headers = { Authorization: 'Bearer SENTINEL_BEARER' }
    await Promise.resolve(
      app.fetch(
        new Request('http://test/t/read', { headers }),
        baseEnv(),
        createExecutionContext(),
      ),
    )
    await Promise.resolve(
      app.fetch(
        new Request('http://test/t/write', { method: 'POST', headers }),
        baseEnv(),
        createExecutionContext(),
      ),
    )
    expect(log.lines.length).toBeGreaterThan(0)
    expect(log.lines.map(l => l.line).join('\n')).not.toContain('SENTINEL_BEARER')
  })
})

describe('S4 memory 배선 (index.md §13.3)', () => {
  const quiet = createLogger(() => {})

  it('SRV-T-327 memory_service_wired_and_speak_triggers_summary', async () => {
    // ① 생성 시 db 미접촉
    const trap = new Proxy(
      {},
      {
        get: () => () => {
          throw new Error('db touched')
        },
      },
    ) as unknown as Db
    const idle = createServices({
      db: trap,
      logger: quiet,
      now: () => NOW,
      config: parseEnv(baseEnv()),
    })
    expect(typeof idle.memory.get).toBe('function')
    expect(typeof idle.memory.put).toBe('function')
    expect(typeof idle.memory.summarizeIfNeeded).toBe('function')

    // ② 실제 D1 + fake 제공사: speak → 훅 → 요약
    await resetDb()
    await insertRoom('r', 'R', 1, 100)
    const ids = await insertLines('r', 60)
    const services = createServices({
      db: createDb(env.DB),
      logger: quiet,
      now: () => NOW,
      config: parseEnv(baseEnv({ LLM_PROVIDER: 'fake' })),
    })
    const tasks: Promise<unknown>[] = []
    const saved = await services.messages.speak(
      'r',
      { character: 'ciel' },
      { waitUntil: t => void tasks.push(t) },
    )
    expect(saved.speaker).toBe('ciel')
    expect(tasks).toHaveLength(1)
    await Promise.all(tasks)
    const row = await env.DB.prepare(
      "SELECT summary, source_until_id FROM memory WHERE room_id = 'r'",
    ).first<{ summary: string; source_until_id: number }>()
    expect(row).toEqual({ summary: FAKE_DEFAULT_TEXT, source_until_id: ids[20] })
    expect(await services.memory.get('r')).toMatchObject({
      summary: FAKE_DEFAULT_TEXT,
      sourceUntilId: ids[20],
      updatedAt: NOW,
    })
  })
})
