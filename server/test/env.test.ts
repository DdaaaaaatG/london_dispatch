// SRV-T-001~011 — doc/200_설계/server/env.md §8
import { describe, expect, it } from 'vitest'
import devVarsExample from '../.dev.vars.example?raw'
import wranglerToml from '../wrangler.toml?raw'
import { ConfigError, ENV_KEYS, parseEnv, requireLlmApiKey, type Config } from '../src/env'

const SENTINEL = 'SENTINEL_SECRET_9f2c_0123456789abcdefgh'
const fakeDb = { prepare: () => ({}) }
const fakeAssets = { fetch: async () => new Response() }
const TEST_SECRET = 'test-secret-0123456789-abcdefghijklmnop'
const base = { TOKEN_SECRET: TEST_SECRET, DB: fakeDb, ASSETS: fakeAssets }

const keysOf = (raw: Record<string, unknown>): readonly string[] => {
  try {
    parseEnv(raw)
  } catch (e) {
    if (e instanceof ConfigError) return e.keys
    throw e
  }
  return []
}

describe('parseEnv', () => {
  it('SRV-T-001 parseEnv_applies_defaults_when_only_required_present', () => {
    const c = parseEnv(base)
    expect(c).toEqual({
      tokenSecret: TEST_SECRET,
      tokenMinLevel: 5,
      llmProvider: 'google',
      llmModel: 'gemini-3.1-pro-preview',
      llmTimeoutMs: 60000,
      allowedFrameAncestors: ['http://london-gossip.my', 'https://london-gossip.my'],
      rateLimitPerMin: 20,
      contextMessages: 40,
      memorySummaryThreshold: 60,
      llmMonthlyBudgetKrw: 100000,
      llmPriceInputUsdPerM: 0.3,
      llmPriceOutputUsdPerM: 2.5,
      krwPerUsd: 1400,
      ownerMbIds: [],
    })
    expect(c.llmApiKey).toBeUndefined()
  })

  it('SRV-T-002 parseEnv_converts_numeric_strings_and_numbers', () => {
    for (const v of ['7', 7, ' 7 ']) {
      expect(parseEnv({ ...base, TOKEN_MIN_LEVEL: v }).tokenMinLevel).toBe(7)
    }
  })

  it.each([
    ['TOKEN_SECRET', { TOKEN_SECRET: undefined }],
    ['TOKEN_SECRET', { TOKEN_SECRET: '' }],
    ['DB', { DB: undefined }],
    ['ASSETS', { ASSETS: undefined }],
  ])('SRV-T-003 parseEnv_throws_CONFIG_INVALID_when_required_missing %s', (key, patch) => {
    let caught: unknown
    try {
      parseEnv({ ...base, ...patch })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ConfigError)
    const err = caught as ConfigError
    expect(err.code).toBe('CONFIG_INVALID')
    expect(err.status).toBe(500)
    expect(err.keys).toEqual([key])
  })

  it('SRV-T-290 parseEnv_rejects_TOKEN_SECRET_shorter_than_32_chars_without_echoing_it', () => {
    const short = 'x'.repeat(31)
    expect(keysOf({ ...base, TOKEN_SECRET: short })).toEqual(['TOKEN_SECRET'])
    expect(() => parseEnv({ ...base, TOKEN_SECRET: short })).toThrow(ConfigError)
    let dump = ''
    try {
      parseEnv({ ...base, TOKEN_SECRET: short })
    } catch (e) {
      dump = JSON.stringify(e, Object.getOwnPropertyNames(e))
    }
    expect(dump).not.toContain(short)
    expect(parseEnv({ ...base, TOKEN_SECRET: 'x'.repeat(32) }).tokenSecret).toBe('x'.repeat(32))
  })

  it.each([
    ['TOKEN_MIN_LEVEL', 0],
    ['TOKEN_MIN_LEVEL', 11],
    ['LLM_TIMEOUT_MS', 999],
    ['LLM_TIMEOUT_MS', 60001],
    ['RATE_LIMIT_PER_MIN', 0],
    ['RATE_LIMIT_PER_MIN', 601],
    ['CONTEXT_MESSAGES', 0],
    ['CONTEXT_MESSAGES', 101],
    ['MEMORY_SUMMARY_THRESHOLD', 1],
    ['MEMORY_SUMMARY_THRESHOLD', 1001],
    ['TOKEN_MIN_LEVEL', '5.0'],
    ['TOKEN_MIN_LEVEL', '1e3'],
    ['TOKEN_MIN_LEVEL', '-1'],
  ])('SRV-T-004 parseEnv_throws_when_number_out_of_range %s=%s', (key, value) => {
    expect(keysOf({ ...base, [key]: value })).toContain(key)
  })

  it('SRV-T-005 parseEnv_throws_when_threshold_not_greater_than_context', () => {
    expect(keysOf({ ...base, CONTEXT_MESSAGES: 60, MEMORY_SUMMARY_THRESHOLD: 60 })).toEqual([
      'CONTEXT_MESSAGES',
      'MEMORY_SUMMARY_THRESHOLD',
    ])
  })

  it.each([
    ['LLM_PROVIDER', 'openai'],
    ['LLM_MODEL', 'a/b'],
    ['LLM_MODEL', 'x:y'],
  ])('SRV-T-006 parseEnv_throws_when_provider_or_model_invalid %s=%s', (key, value) => {
    expect(keysOf({ ...base, [key]: value })).toEqual([key])
  })

  it('SRV-T-007 parseEnv_validates_frame_ancestors', () => {
    const ok = parseEnv({
      ...base,
      ALLOWED_FRAME_ANCESTORS:
        'http://london-gossip.my https://london-gossip.my http://london-gossip.my',
    })
    expect(ok.allowedFrameAncestors).toEqual([
      'http://london-gossip.my',
      'https://london-gossip.my',
    ])
    for (const bad of [
      'london-gossip.my',
      'https://a.my; script-src *',
      "'self'",
      'https://a.my/path',
    ]) {
      expect(keysOf({ ...base, ALLOWED_FRAME_ANCESTORS: bad })).toEqual(['ALLOWED_FRAME_ANCESTORS'])
    }
    expect(
      parseEnv({ ...base, ALLOWED_FRAME_ANCESTORS: '   ' }).allowedFrameAncestors,
    ).toHaveLength(2)
  })

  it('SRV-T-008 parseEnv_allows_missing_llm_api_key', () => {
    expect(parseEnv({ ...base }).llmApiKey).toBeUndefined()
    expect(parseEnv({ ...base, LLM_API_KEY: '' }).llmApiKey).toBeUndefined()
    expect(parseEnv({ ...base, LLM_API_KEY: 'k' }).llmApiKey).toBe('k')
  })

  it('SRV-T-009 ConfigError_never_contains_values', () => {
    let caught: unknown
    try {
      parseEnv({ ...base, TOKEN_SECRET: SENTINEL, LLM_PROVIDER: 'SENTINEL_PROVIDER' })
    } catch (e) {
      caught = e
    }
    const err = caught as ConfigError
    expect(err).toBeInstanceOf(ConfigError)
    const dump = [JSON.stringify(err), err.message, String(err.keys)].join('|')
    expect(dump).not.toContain('SENTINEL')
    expect(err.cause).toBeUndefined()
  })
})

describe('requireLlmApiKey', () => {
  const cfg = (patch: Partial<Config>): Config => ({ ...parseEnv(base), ...patch })

  it('SRV-T-010 requireLlmApiKey_throws_when_google_without_key', () => {
    expect(() => requireLlmApiKey(cfg({ llmProvider: 'google' }))).toThrow(ConfigError)
    try {
      requireLlmApiKey(cfg({ llmProvider: 'google' }))
    } catch (e) {
      expect((e as ConfigError).keys).toEqual(['LLM_API_KEY'])
    }
    expect(requireLlmApiKey(cfg({ llmProvider: 'google', llmApiKey: 'k' }))).toBe('k')
    expect(requireLlmApiKey(cfg({ llmProvider: 'fake' }))).toBe('')
  })
})

describe('키 대조', () => {
  const activeKeys = (text: string): string[] =>
    text.split('\n').flatMap(l => (/^[A-Z][A-Z0-9_]*\s*=/.test(l) ? [l.split('=')[0]!.trim()] : []))
  const commentKeys = (text: string): string[] =>
    text
      .split('\n')
      .flatMap(l =>
        /^#\s+[A-Z][A-Z0-9_]*=/.test(l) ? [l.replace(/^#\s+/, '').split('=')[0]!] : [],
      )

  it('SRV-T-011 env_keys_match_wrangler_vars_and_dev_vars_example', () => {
    const secrets = ['TOKEN_SECRET', 'LLM_API_KEY', 'OWNER_MB_IDS']
    const settingKeys = ENV_KEYS.filter(k => k !== 'DB' && k !== 'ASSETS')
    const varsSection = wranglerToml.split('[vars]')[1]!.split(/\n\[/)[0]!
    const varsKeys = activeKeys(varsSection)
    const nonSecret = settingKeys.filter(k => !secrets.includes(k)).sort()
    expect([...varsKeys].sort()).toEqual(nonSecret)
    expect(activeKeys(devVarsExample).sort()).toEqual([...secrets].sort())
    const commented = [...new Set(commentKeys(devVarsExample))].sort()
    expect(commented).toEqual(nonSecret)
  })
})

// ---- S3b (SRV-T-231·232) — doc/200_설계/server/env.md §8 ----
describe('S3b 예산·단가 키', () => {
  it('SRV-T-231 parseEnv_reads_budget_and_price_keys_with_decimals', () => {
    const pick = (c: Config) => [
      c.llmMonthlyBudgetKrw,
      c.llmPriceInputUsdPerM,
      c.llmPriceOutputUsdPerM,
      c.krwPerUsd,
    ]
    expect(pick(parseEnv(base))).toEqual([100000, 0.3, 2.5, 1400])
    expect(
      pick(
        parseEnv({
          ...base,
          LLM_MONTHLY_BUDGET_KRW: '50000',
          LLM_PRICE_INPUT_USD_PER_M: '0.075',
          LLM_PRICE_OUTPUT_USD_PER_M: '0',
          KRW_PER_USD: '1385.5',
        }),
      ),
    ).toEqual([50000, 0.075, 0, 1385.5])
    expect(parseEnv({ ...base, LLM_PRICE_INPUT_USD_PER_M: 0.3 }).llmPriceInputUsdPerM).toBe(0.3)
    expect(parseEnv({ ...base, LLM_PRICE_OUTPUT_USD_PER_M: ' 2.5 ' }).llmPriceOutputUsdPerM).toBe(
      2.5,
    )
  })

  it.each([
    ['LLM_MONTHLY_BUDGET_KRW', 0],
    ['LLM_MONTHLY_BUDGET_KRW', 10_000_001],
    ['LLM_MONTHLY_BUDGET_KRW', '1e5'],
    ['LLM_MONTHLY_BUDGET_KRW', '5.5'],
    ['LLM_MONTHLY_BUDGET_KRW', '-1'],
    ['LLM_PRICE_INPUT_USD_PER_M', '-0.1'],
    ['LLM_PRICE_INPUT_USD_PER_M', '.3'],
    ['LLM_PRICE_OUTPUT_USD_PER_M', '1e-1'],
    ['LLM_PRICE_OUTPUT_USD_PER_M', '100.1'],
    ['LLM_PRICE_OUTPUT_USD_PER_M', '0.1234567'],
    ['KRW_PER_USD', '99'],
    ['KRW_PER_USD', '10000.5'],
    ['KRW_PER_USD', 'abc'],
    ['KRW_PER_USD', Number.NaN],
  ])('SRV-T-232 parseEnv_rejects_invalid_budget_and_price_keys %s=%s', (key, value) => {
    expect(keysOf({ ...base, [key]: value })).toEqual([key])
    try {
      parseEnv({ ...base, [key]: value })
    } catch (e) {
      expect(JSON.stringify(e) + String((e as Error).message)).not.toContain('abc')
    }
  })
})

describe('OWNER_MB_IDS (S3c)', () => {
  it('SRV-T-234 parseEnv_parses_owner_mb_ids_list', () => {
    const owners = (v: unknown): readonly string[] =>
      parseEnv({ ...base, ...(v === undefined ? {} : { OWNER_MB_IDS: v }) }).ownerMbIds
    for (const v of [undefined, '', '   ', ',']) expect(owners(v)).toEqual([])
    expect(owners('owner_a')).toEqual(['owner_a'])
    expect(owners(' owner_a, owner_b  owner_c,,owner_a ')).toEqual([
      'owner_a',
      'owner_b',
      'owner_c',
    ])
    expect(owners('x'.repeat(20))).toEqual(['x'.repeat(20)])
    expect(owners('a1,a2,a3,a4,a5')).toHaveLength(5)
  })

  it('SRV-T-235 parseEnv_rejects_invalid_owner_mb_ids_without_value', () => {
    const SENTINEL = 'SENTINEL_OWNER_ID_'.padEnd(21, 'z')
    for (const v of [SENTINEL, 'a1,a2,a3,a4,a5,a6']) {
      let caught: unknown
      try {
        parseEnv({ ...base, OWNER_MB_IDS: v })
      } catch (e) {
        caught = e
      }
      expect(caught).toBeInstanceOf(ConfigError)
      expect((caught as ConfigError).keys).toEqual(['OWNER_MB_IDS'])
      expect(JSON.stringify(caught)).not.toContain('SENTINEL_OWNER_ID_')
      expect((caught as ConfigError).message).not.toContain('SENTINEL_OWNER_ID_')
    }
  })
})

describe('S3f LLM_MODEL 기본값 (env.md §12)', () => {
  it('SRV-T-354 parseEnv_llm_model_default_is_pro_and_table_names_pass', () => {
    const c = parseEnv(base)
    expect(c.llmModel).toBe('gemini-3.1-pro-preview')
    expect(c.llmPriceInputUsdPerM).toBe(0.3)
    expect(c.llmPriceOutputUsdPerM).toBe(2.5)
    for (const m of ['gemini-3.8-flash', 'gemini-3.1-pro-preview']) {
      expect(parseEnv({ ...base, LLM_MODEL: m }).llmModel).toBe(m)
    }
    // 기본값 세 곳(스키마·wrangler.toml·.dev.vars.example)이 같다
    expect(wranglerToml).toMatch(/^LLM_MODEL = "gemini-3\.1-pro-preview"/m)
    expect(devVarsExample).toMatch(/^# LLM_MODEL=gemini-3\.1-pro-preview\b/m)
  })
})
