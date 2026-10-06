/**
 * [목적] env 값(LLM_PROVIDER)으로 제공사 어댑터를 고른다(R-LLM-001). 제공사 추가 = 어댑터 1파일 + switch 한 줄. 설계 llm.md §2.2
 * [공개 API] createProvider(config, deps?), 타입 ProviderConfig
 * [비동기] 없음(생성만)
 * [에러] 없음 — 키 누락 판정은 호출 전 requireLlmApiKey(env 모듈)
 * [설정] provider·apiKey·model (컨테이너가 Config 에서 골라 값으로 전달)
 * [테스트] server/test/llm-gemini.test.ts (SRV-T-185)
 */
import type { LlmProviderName } from '../env'
import { FakeProvider } from './fake'
import { GeminiProvider } from './gemini'
import type { LlmProvider } from './provider'

export type ProviderConfig = {
  /** env 값 'google' | 'fake' */
  readonly provider: LlmProviderName
  /** requireLlmApiKey(config) 결과. fake 면 '' */
  readonly apiKey: string
  /** config.llmModel */
  readonly model: string
}

/** env 값으로 어댑터를 고른다. fetchFn 은 테스트 주입용(기본 globalThis.fetch) */
export const createProvider = (
  config: ProviderConfig,
  deps?: { fetchFn?: typeof fetch },
): LlmProvider => {
  switch (config.provider) {
    case 'google':
      return new GeminiProvider({ apiKey: config.apiKey, model: config.model }, deps?.fetchFn)
    case 'fake':
      return new FakeProvider()
    default: {
      const unreachable: never = config.provider
      throw new Error(`unknown llm provider: ${String(unreachable)}`)
    }
  }
}
