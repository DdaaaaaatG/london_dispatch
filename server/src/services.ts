/**
 * [목적] 서비스 컨테이너와 Hono 타입(AppEnv). 라우트(contract)는 c.get('services') 로 접근 (R-ENV-001 값 주입, R-API-005). 설계 index.md §2.3
 * [공개 API] createServices(deps) -> Services { auth, rooms, messages, settings(S3c), memory(S4), getHealth }, APP_VERSION, 타입 AppEnv·Services·ServiceDeps·HealthStatus
 * [비동기] 없음(팩토리 클로저 생성뿐). getHealth 는 DB·외부 호출 없는 동기 함수
 * [에러] 없음
 * [설정] deps.config(parseEnv 결과)에서 auth 팩토리에 tokenSecret·tokenMinLevel·rateLimitPerMin·ownerMbIds(S3c) 만 골라 넘긴다. Config 를 Services·Variables 에 싣지 않는다
 * [테스트] server/test/app.test.ts (SRV-T-087·161·327)
 */
import type { HealthResponse } from '@shared/types'
import pkg from '../package.json'
import { createAuthService, type AuthService, type Principal } from './auth'
import type { Db } from './db'
import { requireLlmApiKey, type Config, type Env } from './env'
import type { Logger } from './logger'
import {
  createLlm,
  createProvider,
  createUsageMeter,
  modelKeyOf,
  resolveLlmModel,
  type Llm,
} from './llm'
import { createMemoryService, type MemoryService } from './memory'
import { createMessagesService, type MessagesService } from './messages'
import { createRoomsService, type RoomsService } from './rooms'
import { createSettingsService, type SettingsService } from './settings'

/** 계약 타입 HealthResponse 와 같다 */
export type HealthStatus = HealthResponse

export type ServiceDeps = {
  db: Db
  logger: Logger
  now: () => number
  /** parseEnv 결과. 각 팩토리에 필요한 필드만 골라 넘긴다(통째로 넘기지 않는다) */
  config: Config
}

export type Services = {
  /** 라우트는 직접 호출하지 않는다 — auth 미들웨어만 쓴다 */
  auth: AuthService
  rooms: RoomsService
  messages: MessagesService
  /** S3c. 캐릭터 설정 GET/PUT(라우트)과 speak·regenerate 의 설정 읽기 */
  settings: SettingsService
  /** S4. 장기기억 GET/PUT(라우트)과 speak 뒤 자동 요약 */
  memory: MemoryService
  /** DB·외부 호출 없이 상태를 돌려준다 (R-API-005) */
  getHealth: () => HealthStatus
}

/** 라우트(contract)가 쓰는 Hono 타입 */
export type AppEnv = {
  Bindings: Env
  Variables: {
    services: Services
    cspFrameAncestors: string
    /** requireToken 이 넣는다. 읽기는 getPrincipal(c) 로만 */
    principal?: Principal
  }
}

/** server/package.json 의 version */
export const APP_VERSION: string = pkg.version

/** 서비스 컨테이너를 만든다. 요청마다 부트스트랩이 호출 */
export const createServices = (deps: ServiceDeps): Services => {
  const settings = createSettingsService({
    db: deps.db,
    logger: deps.logger,
    now: deps.now,
    // S3f: 저장값이 없을 때 응답 model = env 모델의 키(두 후보 밖이면 null) — llm.md §15.4
    fallbackModelKey: modelKeyOf(deps.config.llmModel),
  })
  // S3f: 요청마다 D1에서 모델을 읽어 해석한다(캐시 없음). messages·memory 가 같은 함수를 쓴다(상태 없음)
  // 순서: 키 확인(R-ENV-003, D1 읽기 전) → 저장 키 읽기 → 해석 → 생성. 실패해도 다른 모델로 바꾸지 않는다(R-LLM-009)
  const llm = async (): Promise<Llm> => {
    const apiKey = requireLlmApiKey(deps.config)
    const stored = await settings.loadModelKey()
    const { model, pricing } = resolveLlmModel(stored, {
      model: deps.config.llmModel,
      pricing: {
        priceInputUsdPerM: deps.config.llmPriceInputUsdPerM,
        priceOutputUsdPerM: deps.config.llmPriceOutputUsdPerM,
      },
    })
    return createLlm({
      provider: createProvider({ provider: deps.config.llmProvider, apiKey, model }),
      timeoutMs: deps.config.llmTimeoutMs,
      logger: deps.logger,
      now: deps.now,
      modelName: model,
      // S3b: 월 비용 상한. db.llmUsage 가 UsageStore 포트를 구조적으로 만족한다
      meter: createUsageMeter({
        store: deps.db.llmUsage,
        config: {
          monthlyBudgetKrw: deps.config.llmMonthlyBudgetKrw,
          priceInputUsdPerM: pricing.priceInputUsdPerM,
          priceOutputUsdPerM: pricing.priceOutputUsdPerM,
          krwPerUsd: deps.config.krwPerUsd,
        },
        logger: deps.logger,
        now: deps.now,
      }),
    })
  }
  const memory = createMemoryService({
    db: deps.db,
    now: deps.now,
    logger: deps.logger,
    contextMessages: deps.config.contextMessages,
    summaryThreshold: deps.config.memorySummaryThreshold,
    llm,
  })
  return {
    auth: createAuthService({
      db: deps.db,
      logger: deps.logger,
      now: deps.now,
      config: {
        tokenSecret: deps.config.tokenSecret,
        tokenMinLevel: deps.config.tokenMinLevel,
        rateLimitPerMin: deps.config.rateLimitPerMin,
        ownerMbIds: deps.config.ownerMbIds,
      },
    }),
    rooms: createRoomsService({ db: deps.db, now: deps.now }),
    messages: createMessagesService({
      db: deps.db,
      now: deps.now,
      logger: deps.logger,
      contextMessages: deps.config.contextMessages,
      // S3c: 캐시 없음, 부를 때마다 D1
      loadPromptSettings: settings.loadForPrompt,
      llm,
      // S4: speak 성공 뒤 waitUntil 로 실행(messages.md §13). messages 는 memory 를 import 하지 않는다
      afterSpeak: async ({ roomId }) => {
        await memory.summarizeIfNeeded(roomId)
      },
    }),
    settings,
    memory,
    getHealth: () => ({ ok: true, version: APP_VERSION }),
  }
}
