// SRV-T-334~339 — doc/200_설계/server/llm.md §15 (모델 상수표·단가표·해석 순수 함수)
import { LLM_MODEL_KEYS } from '@shared/settings'
import { describe, expect, it } from 'vitest'
import {
  estimateKrw,
  LLM_MODEL_OPTIONS,
  LLM_MODEL_PRICES,
  modelKeyOf,
  resolveLlmModel,
  type LlmUsage,
} from '../src/llm'

const PRO = 'gemini-3.1-pro-preview'
const FLASH = 'gemini-3.8-flash'
const OFF_TABLE = 'gemini-2.5-flash'
const ENV_PRICING = { priceInputUsdPerM: 0.3, priceOutputUsdPerM: 2.5 }

describe('상수표·단가표 (R-LLM-009)', () => {
  it('SRV-T-334 tables_match_shared_keys_and_each_other', () => {
    expect(Object.keys(LLM_MODEL_OPTIONS).sort()).toEqual([...LLM_MODEL_KEYS].sort())
    expect(LLM_MODEL_OPTIONS.pro.model).toBe(PRO)
    expect(LLM_MODEL_OPTIONS.flash.model).toBe(FLASH)
    for (const key of LLM_MODEL_KEYS) {
      expect(LLM_MODEL_PRICES[LLM_MODEL_OPTIONS[key].model]).toBeDefined()
    }
    expect(Object.keys(LLM_MODEL_PRICES)).toHaveLength(2)
    expect(LLM_MODEL_PRICES[PRO]).toEqual({ priceInputUsdPerM: 2.0, priceOutputUsdPerM: 12.0 })
    expect(LLM_MODEL_PRICES[FLASH]).toEqual({ priceInputUsdPerM: 0.75, priceOutputUsdPerM: 3.75 })
  })

  it('SRV-T-335 modelKeyOf_matches_exact_names_only', () => {
    expect(modelKeyOf(PRO)).toBe('pro')
    expect(modelKeyOf(FLASH)).toBe('flash')
    expect(modelKeyOf(OFF_TABLE)).toBeNull()
    expect(modelKeyOf('')).toBeNull()
    expect(modelKeyOf(` ${PRO}`)).toBeNull()
  })
})

describe('resolveLlmModel (llm.md §15.4)', () => {
  it('SRV-T-336 saved_key_wins_V1_V2', () => {
    const fallback = { model: OFF_TABLE, pricing: ENV_PRICING }
    expect(resolveLlmModel('pro', fallback)).toEqual({
      key: 'pro',
      model: PRO,
      pricing: LLM_MODEL_PRICES[PRO],
      source: 'saved',
    })
    expect(resolveLlmModel('flash', fallback)).toEqual({
      key: 'flash',
      model: FLASH,
      pricing: LLM_MODEL_PRICES[FLASH],
      source: 'saved',
    })
  })

  it('SRV-T-337 null_uses_env_model_with_table_price_V3', () => {
    const r = resolveLlmModel(null, { model: PRO, pricing: ENV_PRICING })
    expect(r).toEqual({ key: 'pro', model: PRO, pricing: LLM_MODEL_PRICES[PRO], source: 'env' })
  })

  it('SRV-T-338 null_with_off_table_env_model_uses_env_price_V5', () => {
    const r = resolveLlmModel(null, { model: OFF_TABLE, pricing: ENV_PRICING })
    expect(r).toEqual({ key: null, model: OFF_TABLE, pricing: ENV_PRICING, source: 'env' })
  })

  it('SRV-T-339 price_vectors_estimateKrw', () => {
    const usage: LlmUsage = {
      promptTokens: 1_000_000,
      outputTokens: 600_000,
      thoughtsTokens: 400_000,
    }
    const krw = (model: string): number =>
      estimateKrw(usage, {
        ...resolveLlmModel(null, { model, pricing: ENV_PRICING }).pricing,
        krwPerUsd: 1400,
      })
    expect(krw(PRO)).toBeCloseTo(19_600, 6)
    expect(krw(FLASH)).toBeCloseTo(6_300, 6)
    expect(krw(OFF_TABLE)).toBeCloseTo(3_920, 6)
  })
})
