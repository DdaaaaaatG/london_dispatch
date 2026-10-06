// SRV-T-240~249·259·260 — doc/200_설계/server/settings.md §8. 회원 ID 는 자리표시자만 쓴다
import { createExecutionContext, env } from 'cloudflare:test'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import { CHARACTERS } from '@shared/characters'
import {
  CHARACTER_FIELD_KEYS,
  CHARACTER_FIELD_SPECS,
  SETTINGS_CHARACTER_IDS,
  WORLD_FIELD_SPEC,
  checkCharacterSettings,
} from '@shared/settings'
import type { CharacterSettings } from '@shared/types'
import { SETTINGS_VECTORS, validSettings } from '../../shared/test/settings-vectors'
import { createApp } from '../src/app'
import { AppError } from '../src/app-error'
import type { Principal } from '../src/auth'
import { requireOwner, requireToken } from '../src/auth'
import { createDb, type Db } from '../src/db'
import type { Env } from '../src/env'
import { parseEnv } from '../src/env'
import { DEFAULT_PROMPT_SETTINGS, OUTPUT_RULES, DEFAULT_CHARACTER_SETTINGS } from '../src/llm'
import { createLogger } from '../src/logger'
import {
  characterSettingsSchema,
  createSettingsService,
  parseCharacterSettings,
} from '../src/settings'
import type { AppEnv } from '../src/services'
import { createServices } from '../src/services'
import { insertRoom, resetDb } from './helpers'
import { signTestToken } from './token'

const NOW = 1_700_000_000_000
const OWNER: Principal = {
  mbId: 'owner_test',
  nick: '주인',
  chName: '',
  level: 5,
  displayName: '주인',
}
const SENTINEL = 'SENTINEL_VALUE_7c1'

type Log = { level: string; event: string; [k: string]: unknown }

const setup = (dbOverride?: (db: Db) => Db, now = () => NOW) => {
  const lines: string[] = []
  const logs: Log[] = []
  const logger = createLogger((_l, line) => {
    lines.push(line)
    logs.push(JSON.parse(line) as Log)
  })
  const baseDb = createDb(env.DB)
  const db = dbOverride === undefined ? baseDb : dbOverride(baseDb)
  return { svc: createSettingsService({ db, logger, now }), db, logs, lines }
}

const insertRow = async (json: string, version = 3): Promise<void> => {
  await env.DB.prepare('DELETE FROM character_settings').run()
  await env.DB.prepare(
    "INSERT INTO character_settings (id, json, version, updated_at, updated_by) VALUES (1, ?1, ?2, 1, 'owner_test')",
  )
    .bind(json, version)
    .run()
}

/** 테스트가 임의로 망가뜨리는 본체 모양 */
type Draft = {
  world: unknown
  characters: Record<string, Record<string, unknown>> & {
    sebastian: Record<string, unknown>
    ciel: Record<string, unknown>
  }
  [key: string]: unknown
}

const clone = (): CharacterSettings =>
  JSON.parse(JSON.stringify(validSettings())) as CharacterSettings

const filledAtLimit = (): unknown => {
  const s = clone()
  s.world = `  ${'😀'.repeat(WORLD_FIELD_SPEC.max)} \n`
  for (const id of SETTINGS_CHARACTER_IDS) {
    const fields = s.characters[id] as unknown as Record<string, unknown>
    for (const key of CHARACTER_FIELD_KEYS) {
      const spec = CHARACTER_FIELD_SPECS[key]
      fields[key] =
        spec.kind === 'text'
          ? ` ${'😀'.repeat(spec.max)} `
          : [
              ...Array.from({ length: spec.maxItems }, () => ` ${'😀'.repeat(spec.itemMax)} `),
              '',
              '   ',
              '\n',
            ]
    }
  }
  return s
}

beforeEach(resetDb)

describe('스키마 (R-SET-002)', () => {
  it('SRV-T-240 schema_accepts_boundary_and_normalizes_like_shared', () => {
    const input = filledAtLimit()
    const zod = characterSettingsSchema.safeParse(input)
    const shared = checkCharacterSettings(input)
    const parsed = parseCharacterSettings(input)
    expect(zod.success && shared.ok && parsed.ok).toBe(true)
    if (!zod.success || !shared.ok || !parsed.ok) return
    expect(zod.data).toEqual(shared.value)
    expect(parsed.value).toEqual(shared.value)
    expect(Object.keys(shared.value.characters).sort()).toEqual([...SETTINGS_CHARACTER_IDS].sort())
    for (const id of SETTINGS_CHARACTER_IDS) {
      expect(Object.keys(zod.data.characters[id]).sort()).toEqual([...CHARACTER_FIELD_KEYS].sort())
    }
    expect(shared.value.characters.ciel.rules).toHaveLength(CHARACTER_FIELD_SPECS.rules.maxItems)
    const again = parseCharacterSettings(shared.value)
    expect(again.ok && again.value).toEqual(shared.value)
  })

  it('SRV-T-241 schema_and_shared_agree_on_vectors', () => {
    for (const v of SETTINGS_VECTORS) {
      const shared = checkCharacterSettings(v.input)
      expect(characterSettingsSchema.safeParse(v.input).success, v.name).toBe(shared.ok)
      const parsed = parseCharacterSettings(v.input)
      expect(parsed, v.name).toEqual(shared)
    }
  })

  it('SRV-T-242 schema_rejects_missing_optional_keys_and_blank_required', () => {
    const fail = (fn: (s: Draft) => void): boolean => {
      const s = clone() as unknown as Draft
      fn(s)
      return characterSettingsSchema.safeParse(s).success
    }
    expect(fail(s => delete s.characters.sebastian.age)).toBe(false)
    for (const blank of ['', '   ']) {
      expect(fail(s => (s.world = blank))).toBe(false)
      expect(fail(s => (s.characters.ciel.persona = blank))).toBe(false)
      expect(fail(s => (s.characters.ciel.speech = blank))).toBe(false)
    }
    expect(fail(s => (s.characters.ciel.appearance = ''))).toBe(true)
    expect(fail(s => (s.characters.ciel.persona = 5))).toBe(false)
    expect(fail(s => (s.characters.ciel.appearance = null))).toBe(false)
    expect(fail(s => (s.characters.ciel.rules = 'x'))).toBe(false)
  })

  it('SRV-T-243 schema_is_strict_on_keys_and_ids', () => {
    const cases: [(s: Draft) => void, string[], string][] = [
      [s => (s.outputRules = ['x']), [], '공통 · 알 수 없는 항목이 있습니다.'],
      [
        s => (s.characters.sebastian.name = 'x'),
        ['characters', 'sebastian'],
        '세바스찬 · 알 수 없는 항목이 있습니다.',
      ],
      [
        s => (s.characters.sebastian.id = 'x'),
        ['characters', 'sebastian'],
        '세바스찬 · 알 수 없는 항목이 있습니다.',
      ],
      [
        s => (s.characters.sebastian.avatar = 'x'),
        ['characters', 'sebastian'],
        '세바스찬 · 알 수 없는 항목이 있습니다.',
      ],
      [s => (s.characters.claude = {}), ['characters'], '공통 · 알 수 없는 캐릭터가 있습니다.'],
      [
        s => Reflect.deleteProperty(s.characters, 'ciel'),
        ['characters', 'ciel'],
        '시엘 · 설정 형식이 올바르지 않습니다.',
      ],
    ]
    for (const [mutate, path, message] of cases) {
      const s = clone() as unknown as Draft
      mutate(s)
      expect(characterSettingsSchema.safeParse(s).success).toBe(false)
      const r = parseCharacterSettings(s)
      expect(r).toEqual({ ok: false, issue: { path, message } })
    }
  })

  it('SRV-T-244 parseCharacterSettings_matches_api_table_and_never_echoes_values', () => {
    for (const v of SETTINGS_VECTORS) {
      if (v.expect.ok) continue
      const r = parseCharacterSettings(v.input)
      expect(r.ok, v.name).toBe(false)
      if (r.ok) continue
      expect({ path: [...r.issue.path], message: r.issue.message }, v.name).toEqual({
        path: v.expect.path,
        message: v.expect.message,
      })
    }
    const probes: ((s: Draft) => void)[] = [
      s => (s[SENTINEL] = 1),
      s => (s.world = { [SENTINEL]: SENTINEL }),
      s => (s.characters.ciel[SENTINEL] = SENTINEL),
      s => (s.characters.ciel.speech = [SENTINEL]),
      s => (s.characters[SENTINEL] = {}),
    ]
    for (const probe of probes) {
      const s = clone() as unknown as Draft
      probe(s)
      const r = parseCharacterSettings(s)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(JSON.stringify(r.issue)).not.toContain(SENTINEL)
    }
  })
})

describe('서비스 (R-SET-003)', () => {
  it('SRV-T-245 get_returns_seed_when_no_row', async () => {
    const { svc, logs } = setup()
    expect(await svc.get()).toEqual({
      settings: DEFAULT_CHARACTER_SETTINGS,
      version: 0,
      updatedAt: null,
      isDefault: true,
    })
    expect(logs).toHaveLength(0)
  })

  it('SRV-T-246 put_upserts_increments_version_and_returns_normalized', async () => {
    const { svc, logs } = setup()
    const input = filledAtLimit()
    const first = await svc.put(input as CharacterSettings, OWNER)
    const second = await svc.put(input as CharacterSettings, OWNER)
    const expected = checkCharacterSettings(input)
    expect(expected.ok).toBe(true)
    if (!expected.ok) return
    expect(first).toEqual({
      settings: expected.value,
      version: 1,
      updatedAt: NOW,
      isDefault: false,
    })
    expect(second.version).toBe(2)
    expect(await svc.get()).toEqual(second)
    const row = await env.DB.prepare('SELECT updated_by FROM character_settings').first<{
      updated_by: string
    }>()
    expect(row?.updated_by).toBe('owner_test')
    const saved = logs.filter(l => l.event === 'settings_saved')
    expect(saved).toHaveLength(2)
    expect(saved[0]).toMatchObject({ level: 'info', mbId: 'owner_test', version: 1 })
  })

  it('SRV-T-247 put_rejects_invalid_when_called_directly', async () => {
    const { svc, logs } = setup()
    const bad = clone()
    bad.world = 'ㄱ'.repeat(WORLD_FIELD_SPEC.max + 1)
    const expected = checkCharacterSettings(bad)
    let caught: unknown
    try {
      await svc.put(bad, OWNER)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(AppError)
    expect((caught as AppError).code).toBe('VALIDATION_ERROR')
    expect((caught as AppError).status).toBe(400)
    expect(!expected.ok && (caught as AppError).message).toBe(
      !expected.ok && expected.issue.message,
    )
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM character_settings').first<{
      n: number
    }>()
    expect(n?.n).toBe(0)
    expect(logs.some(l => l.event === 'settings_saved')).toBe(false)
  })

  it('SRV-T-248 get_falls_back_to_seed_when_row_corrupted', async () => {
    const mut = (fn: (s: Draft) => void): string => {
      const s = clone() as unknown as Draft
      fn(s)
      return JSON.stringify(s)
    }
    const table: [string, string, string][] = [
      ['{{', '(json)', 'bad-json'],
      ['[]', '(root)', 'array'],
      [mut(s => (s.world = '')), 'world', 'world-empty'],
      [mut(s => (s.characters.ciel.zzz = 'q')), 'characters.ciel', 'unknown-key'],
      [mut(s => (s.characters.third = {})), 'characters', 'third-id'],
    ]
    for (const [json, field] of table) {
      await insertRow(json, 7)
      const { svc, logs, lines } = setup()
      const res = await svc.get()
      expect(res).toEqual({
        settings: DEFAULT_CHARACTER_SETTINGS,
        version: 0,
        updatedAt: null,
        isDefault: true,
      })
      const errs = logs.filter(l => l.event === 'character_settings_invalid')
      expect(errs).toHaveLength(1)
      expect(errs[0]).toMatchObject({ level: 'error', field })
      expect(lines.join('\n')).not.toContain('zzz')
      const saved = await svc.put(clone(), OWNER)
      expect(saved.version).toBe(8)
    }
  })

  it('SRV-T-249 loadForPrompt_matches_get_source', async () => {
    const empty = setup()
    expect(await empty.svc.loadForPrompt()).toEqual(DEFAULT_PROMPT_SETTINGS)
    await insertRow('{{')
    expect(await setup().svc.loadForPrompt()).toEqual(DEFAULT_PROMPT_SETTINGS)
    await env.DB.prepare('DELETE FROM character_settings').run()
    const saved = setup()
    const input = clone()
    await saved.svc.put(input, OWNER)
    const loaded = await saved.svc.loadForPrompt()
    const norm = checkCharacterSettings(input)
    if (!norm.ok) throw new Error('fixture invalid')
    for (const id of SETTINGS_CHARACTER_IDS) {
      expect(loaded.profiles[id]).toMatchObject({
        id,
        name: CHARACTERS[id].name,
        ...norm.value.characters[id],
      })
    }
    expect(loaded.common.world).toBe(norm.value.world)
    expect(loaded.common.outputRules).toBe(OUTPUT_RULES)
  })
})

describe('로그·장애 (R-SET-012 · N5)', () => {
  it('SRV-T-259 settings_logs_never_contain_field_values', async () => {
    const lines: string[] = []
    const logs: Log[] = []
    const logger = createLogger((_l, line) => {
      lines.push(line)
      logs.push(JSON.parse(line) as Log)
    })
    const config = parseEnv({
      DB: env.DB,
      ASSETS: { fetch: async () => new Response('x') },
      TOKEN_SECRET: 'test-secret',
      LLM_PROVIDER: 'fake',
      OWNER_MB_IDS: 'owner_test',
    })
    const services = createServices({ db: createDb(env.DB), logger, now: () => NOW, config })
    const body = clone() as unknown as Draft
    body.world = `${SENTINEL} world`
    for (const id of SETTINGS_CHARACTER_IDS) {
      body.characters[id].persona = `${SENTINEL} persona`
      body.characters[id].speech = `${SENTINEL} speech`
      body.characters[id].rules = [`${SENTINEL} rule`]
    }
    await services.settings.put(body as CharacterSettings, OWNER)
    await services.settings.get()
    await insertRow(JSON.stringify({ ...body, extra: SENTINEL }))
    await services.settings.get()
    expect(() => services.auth.assertOwner({ ...OWNER, mbId: 'member_test' })).toThrow()
    await insertRoom('r1', 't', 1, 1)
    await services.messages.speak('r1', { character: 'sebastian' }, { waitUntil: () => undefined })
    expect(lines.join('\n')).not.toContain(SENTINEL)
    const keysOf = (event: string): string[] =>
      Object.keys(logs.find(l => l.event === event) ?? {}).filter(
        k => !['level', 'event', 'ts', 'time', 'msg'].includes(k),
      )
    expect(keysOf('settings_saved').sort()).toEqual(['mbId', 'version'])
    expect(keysOf('owner_denied')).toEqual(['mbId'])
    expect(keysOf('character_settings_invalid')).toEqual(['field'])
  })

  const failingDb = (db: Db): Db => ({
    ...db,
    characterSettings: {
      get: async () => {
        throw new Error('d1 down')
      },
      upsert: db.characterSettings.upsert,
    },
  })

  it('SRV-T-260 get_and_loadForPrompt_propagate_d1_failure', async () => {
    const { svc, logs } = setup(failingDb)
    await expect(svc.get()).rejects.toThrow('d1 down')
    await expect(svc.loadForPrompt()).rejects.toThrow('d1 down')
    expect(logs.some(l => l.event === 'character_settings_invalid')).toBe(false)

    const routes = new Hono<AppEnv>()
    routes.get('/t/settings', requireToken, requireOwner, async c =>
      c.json(await setup(failingDb).svc.get()),
    )
    const app = createApp({ routes, logSink: () => undefined, now: () => NOW })
    const e = {
      DB: env.DB,
      ASSETS: { fetch: async () => new Response('x') },
      TOKEN_SECRET: 'test-secret',
      OWNER_MB_IDS: 'owner_test',
    } as unknown as Env
    const t = await signTestToken(
      { mb_id: 'owner_test', nick: '주인', ch_name: '', level: 5, exp: NOW / 1000 + 43200 },
      'test-secret',
    )
    const res = await app.fetch(
      new Request('http://test/t/settings', { headers: { Authorization: `Bearer ${t}` } }),
      e,
      createExecutionContext(),
    )
    expect([res.status, await res.clone().text()]).toEqual([500, expect.anything()])
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('INTERNAL')
  })
})
