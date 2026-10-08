/**
 * [목적] AI 모델 키(pro·flash) → 모델명 상수표, 모델명 → 단가표, 해석 순수 함수 (R-LLM-009, R-LLM-007 개정, R-SET-013). 설계 llm.md §15
 * [공개 API] LLM_MODEL_OPTIONS, LLM_MODEL_PRICES, modelKeyOf(model), resolveLlmModel(stored, fallback), 타입 ModelPricing
 * [비동기] 없음(순수 함수)
 * [에러] 없음(throw 하지 않는다). 표 밖 저장값 판정·로그는 settings 모듈 몫
 * [설정] 없음. env 모델·단가는 컨테이너가 fallback 값으로 전달
 * [테스트] server/test/llm-models.test.ts (SRV-T-334~339)
 */
import type { LlmModelKey } from '@shared/types'

/** 100만 토큰당 USD(입력·출력). 환율·월 상한은 env 그대로 */
export type ModelPricing = { priceInputUsdPerM: number; priceOutputUsdPerM: number }

/** 키 → 실제 모델명. 모델명은 이 표 한 곳에만 있다(화면·응답·D1은 키만). 제공사 자동 전환 없음 */
export const LLM_MODEL_OPTIONS: { readonly [K in LlmModelKey]: { readonly model: string } } = {
  pro: { model: 'gemini-3.1-pro-preview' },
  flash: { model: 'gemini-3.8-flash' },
}

// 출처: Google AI 가격표(https://ai.google.dev/gemini-api/docs/pricing) · 확인일 2026-10-07
// 구간: 프롬프트 20만 토큰 이하. 출력 단가는 사고(thinking) 토큰을 포함한다
// 값을 고치면 확인일도 같이 고친다. 예고된 가격은 주석으로만 적고 날짜로 단가를 고르는 코드는 두지 않는다
/** 모델명 → 단가. 모델명으로 찾으므로 env LLM_MODEL 이 표 안 모델이면 표 단가가 쓰인다 */
export const LLM_MODEL_PRICES: Readonly<Record<string, ModelPricing>> = {
  'gemini-3.1-pro-preview': { priceInputUsdPerM: 2.0, priceOutputUsdPerM: 12.0 },
  // 2027-01-01부터 입력 1.50 / 출력 7.50 예정(가격표 고지). 그날 이후 값과 확인일을 함께 고친다
  'gemini-3.8-flash': { priceInputUsdPerM: 0.75, priceOutputUsdPerM: 3.75 },
}

/** 상수표에서 모델명이 정확히 같은 키. 없으면 null(정규화 없음) */
export const modelKeyOf = (model: string): LlmModelKey | null => {
  for (const key of Object.keys(LLM_MODEL_OPTIONS) as LlmModelKey[]) {
    if (LLM_MODEL_OPTIONS[key].model === model) return key
  }
  return null
}

/** 해석 결과 */
export type ResolvedLlmModel = {
  key: LlmModelKey | null
  model: string
  pricing: ModelPricing
  source: 'saved' | 'env'
}

/** 저장 키(없으면 null)와 env 폴백에서 모델·단가를 정한다. 단가는 모델명으로 찾고 표 밖이면 폴백 단가 */
export const resolveLlmModel = (
  stored: LlmModelKey | null,
  fallback: { model: string; pricing: ModelPricing },
): ResolvedLlmModel => {
  const saved = stored !== null
  const model = saved ? LLM_MODEL_OPTIONS[stored].model : fallback.model
  return {
    key: saved ? stored : modelKeyOf(fallback.model),
    model,
    pricing: LLM_MODEL_PRICES[model] ?? fallback.pricing,
    source: saved ? 'saved' : 'env',
  }
}
