/**
 * [목적] Workers env 바인딩을 유일하게 읽어 검증·정규화한다 (R-ENV-001·002·003). 설계 env.md
 * [공개 API] parseEnv(raw) -> Config, requireLlmApiKey(config), ENV_KEYS, ROOM_ENTER_LIMIT_PER_MIN_DEFAULT(S6), ConfigError, LLM_PROVIDERS, 타입 Env·Config
 * [비동기] 없음(동기 순수 함수). 요청마다 1회 호출, 요청 간 캐시 없음
 * [에러] ConfigError{ code: CONFIG_INVALID, keys } — 키 이름만 담고 값·zod 메시지·cause 는 싣지 않는다
 * [설정] TOKEN_SECRET(32자 이상, SEC-001), LLM_API_KEY, TOKEN_MIN_LEVEL, LLM_PROVIDER, LLM_MODEL, LLM_TIMEOUT_MS,
 *        ALLOWED_FRAME_ANCESTORS, RATE_LIMIT_PER_MIN, CONTEXT_MESSAGES, MEMORY_SUMMARY_THRESHOLD,
 *        LLM_MONTHLY_BUDGET_KRW, LLM_PRICE_INPUT_USD_PER_M, LLM_PRICE_OUTPUT_USD_PER_M, KRW_PER_USD, OWNER_MB_IDS(S3c), ROOM_ENTER_LIMIT_PER_MIN(S6), DB, ASSETS
 * [테스트] server/test/env.test.ts (SRV-T-001~011, 231·232, 234·235, 400)
 */
import type { D1Database, Fetcher } from '@cloudflare/workers-types'
import { z } from 'zod'
import { AppError } from './app-error'

/** Hono Bindings 타입. 리소스 바인딩만 노출 — 설정 키 직접 접근은 컴파일 에러 */
export type Env = {
  DB: D1Database
  ASSETS: Fetcher
}

export const LLM_PROVIDERS = ['google', 'fake'] as const
export type LlmProviderName = (typeof LLM_PROVIDERS)[number]

/** S6. 스키마 기본값과 auth 폴백이 같은 값을 쓰도록 내보낸다(바인딩을 읽지 않는 상수) */
export const ROOM_ENTER_LIMIT_PER_MIN_DEFAULT = 5

/** parseEnv 결과. 비밀값을 담으므로 통째로 로그·응답에 넣지 않는다 */
export type Config = {
  readonly tokenSecret: string
  readonly llmApiKey?: string
  readonly tokenMinLevel: number
  readonly llmProvider: LlmProviderName
  readonly llmModel: string
  readonly llmTimeoutMs: number
  readonly allowedFrameAncestors: readonly string[]
  readonly rateLimitPerMin: number
  readonly contextMessages: number
  readonly memorySummaryThreshold: number
  /** S3b. 원, 정수 1~10000000 */
  readonly llmMonthlyBudgetKrw: number
  /** S3b. 입력 토큰 100만 개당 USD, 소수 0~100 */
  readonly llmPriceInputUsdPerM: number
  /** S3b. 출력(+사고) 토큰 100만 개당 USD, 소수 0~100 */
  readonly llmPriceOutputUsdPerM: number
  /** S3b. 원/USD, 소수 100~10000 */
  readonly krwPerUsd: number
  /** S3c. 갠홈 주인 회원 ID 목록(중복 제거, 입력 순서 유지). 빈 배열 = 주인 없음(설정 엔드포인트 전원 403) */
  readonly ownerMbIds: readonly string[]
  /** S6. 방 단위 비밀번호 입장 시도 분당 상한(1~60) */
  readonly roomEnterLimitPerMin: number
}

/** 바인딩 키 이름 전체(설정 16 + 리소스 2) */
export const ENV_KEYS: readonly string[] = [
  'TOKEN_SECRET',
  'LLM_API_KEY',
  'TOKEN_MIN_LEVEL',
  'LLM_PROVIDER',
  'LLM_MODEL',
  'LLM_TIMEOUT_MS',
  'ALLOWED_FRAME_ANCESTORS',
  'RATE_LIMIT_PER_MIN',
  'CONTEXT_MESSAGES',
  'MEMORY_SUMMARY_THRESHOLD',
  'LLM_MONTHLY_BUDGET_KRW',
  'LLM_PRICE_INPUT_USD_PER_M',
  'LLM_PRICE_OUTPUT_USD_PER_M',
  'KRW_PER_USD',
  'OWNER_MB_IDS',
  'ROOM_ENTER_LIMIT_PER_MIN',
  'DB',
  'ASSETS',
]

const CONFIG_INVALID_MESSAGE = '서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요.'

/** CONFIG_INVALID 전용 에러. keys 에는 문제 키 이름만 담는다 */
export class ConfigError extends AppError {
  readonly keys: readonly string[]

  constructor(keys: readonly string[]) {
    super('CONFIG_INVALID', CONFIG_INVALID_MESSAGE)
    this.name = 'ConfigError'
    this.keys = keys
  }
}

const DEFAULT_ANCESTORS = 'http://london-gossip.my https://london-gossip.my'
const ANCESTOR_PATTERN = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/
const MODEL_PATTERN = /^[A-Za-z0-9._-]{1,64}$/

const blankToUndefined = (v: unknown): unknown => {
  const t = typeof v === 'string' ? v.trim() : v
  return t === '' ? undefined : t
}

const intVar = (min: number, max: number, dflt: number) =>
  z.preprocess(
    blankToUndefined,
    z
      .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
      .pipe(z.number().int().min(min).max(max))
      .default(dflt),
  )

/** S3b 소수 변환기: 유한 number 이거나 ^\d+(\.\d{1,6})?$ 문자열만 받는다 */
const decimalVar = (min: number, max: number, dflt: number) =>
  z.preprocess(
    blankToUndefined,
    z
      .union([
        z.number(),
        z
          .string()
          .regex(/^\d+(\.\d{1,6})?$/)
          .transform(Number),
      ])
      .pipe(z.number().finite().min(min).max(max))
      .default(dflt),
  )

/** SEC-001: HMAC SECRET 최소 길이. 짧은 값은 무차별 대입에 약하다 */
const TOKEN_SECRET_MIN_LENGTH = 32
const secret = z.preprocess(
  v => (v === '' ? undefined : v),
  z.string().min(TOKEN_SECRET_MIN_LENGTH),
)
const optionalSecret = z.preprocess(v => (v === '' ? undefined : v), z.string().optional())
const resource = (method: string) =>
  z.custom<object>(
    v =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as Record<string, unknown>)[method] === 'function',
  )

const ancestors = z.preprocess(
  blankToUndefined,
  z
    .string()
    .default(DEFAULT_ANCESTORS)
    .transform(s => s.split(/\s+/).filter(x => x !== ''))
    .pipe(z.array(z.string().regex(ANCESTOR_PATTERN)).min(1))
    .transform(list => [...new Set(list)]),
)

/** S3c. 그누보드 mb_id 길이 상한 · 목록 개수 상한 */
const OWNER_MB_ID_MAX = 20
const OWNER_MB_IDS_MAX = 5

const ownerMbIds = z.preprocess(
  blankToUndefined,
  z
    .string()
    .default('')
    .transform(s => [...new Set(s.split(/[\s,]+/).filter(x => x !== ''))])
    .pipe(z.array(z.string().min(1).max(OWNER_MB_ID_MAX)).max(OWNER_MB_IDS_MAX)),
)

const schema = z.object({
  TOKEN_SECRET: secret,
  LLM_API_KEY: optionalSecret,
  TOKEN_MIN_LEVEL: intVar(1, 10, 5),
  LLM_PROVIDER: z.preprocess(blankToUndefined, z.enum(LLM_PROVIDERS).default('google')),
  LLM_MODEL: z.preprocess(
    blankToUndefined,
    z.string().regex(MODEL_PATTERN).default('gemini-3.1-pro-preview'),
  ),
  LLM_TIMEOUT_MS: intVar(1000, 60000, 60000),
  ALLOWED_FRAME_ANCESTORS: ancestors,
  RATE_LIMIT_PER_MIN: intVar(1, 600, 20),
  CONTEXT_MESSAGES: intVar(1, 100, 40),
  MEMORY_SUMMARY_THRESHOLD: intVar(2, 1000, 60),
  LLM_MONTHLY_BUDGET_KRW: intVar(1, 10_000_000, 100_000),
  LLM_PRICE_INPUT_USD_PER_M: decimalVar(0, 100, 0.3),
  LLM_PRICE_OUTPUT_USD_PER_M: decimalVar(0, 100, 2.5),
  KRW_PER_USD: decimalVar(100, 10_000, 1400),
  OWNER_MB_IDS: ownerMbIds,
  ROOM_ENTER_LIMIT_PER_MIN: intVar(1, 60, ROOM_ENTER_LIMIT_PER_MIN_DEFAULT),
  DB: resource('prepare'),
  ASSETS: resource('fetch'),
})

const issueKeys = (error: z.ZodError): string[] =>
  [...new Set(error.issues.map(i => String(i.path[0] ?? '')).filter(k => k !== ''))].sort()

/** Workers env 바인딩을 검증·정규화한다. 실패 시 ConfigError(키 이름만) */
export const parseEnv = (raw: unknown): Config => {
  const result = schema.safeParse(raw ?? {})
  if (!result.success) throw new ConfigError(issueKeys(result.error))
  const v = result.data
  if (v.MEMORY_SUMMARY_THRESHOLD <= v.CONTEXT_MESSAGES) {
    throw new ConfigError(['CONTEXT_MESSAGES', 'MEMORY_SUMMARY_THRESHOLD'])
  }
  return {
    tokenSecret: v.TOKEN_SECRET,
    ...(v.LLM_API_KEY !== undefined ? { llmApiKey: v.LLM_API_KEY } : {}),
    tokenMinLevel: v.TOKEN_MIN_LEVEL,
    llmProvider: v.LLM_PROVIDER,
    llmModel: v.LLM_MODEL,
    llmTimeoutMs: v.LLM_TIMEOUT_MS,
    allowedFrameAncestors: v.ALLOWED_FRAME_ANCESTORS,
    rateLimitPerMin: v.RATE_LIMIT_PER_MIN,
    contextMessages: v.CONTEXT_MESSAGES,
    memorySummaryThreshold: v.MEMORY_SUMMARY_THRESHOLD,
    llmMonthlyBudgetKrw: v.LLM_MONTHLY_BUDGET_KRW,
    llmPriceInputUsdPerM: v.LLM_PRICE_INPUT_USD_PER_M,
    llmPriceOutputUsdPerM: v.LLM_PRICE_OUTPUT_USD_PER_M,
    krwPerUsd: v.KRW_PER_USD,
    ownerMbIds: v.OWNER_MB_IDS,
    roomEnterLimitPerMin: v.ROOM_ENTER_LIMIT_PER_MIN,
  }
}

/** speak(S3)용. google 이고 키가 없으면 ConfigError(['LLM_API_KEY']), fake 면 빈 문자열 */
export const requireLlmApiKey = (config: Config): string => {
  if (config.llmProvider !== 'google') return config.llmApiKey ?? ''
  if (config.llmApiKey === undefined) throw new ConfigError(['LLM_API_KEY'])
  return config.llmApiKey
}
