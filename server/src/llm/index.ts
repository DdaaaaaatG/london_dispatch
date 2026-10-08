/**
 * [목적] llm 모듈 공개 진입. 제공사 어댑터 뒤에 숨은 AI 발화 생성(프롬프트 조립·재시도·후처리·캐릭터 상수). 요구 R-LLM-001~006, R-ENV-003, R-NFR-001. 설계 llm.md
 * [공개 API] createProvider, createLlm, createUsageMeter(S3b), LLM_MODEL_OPTIONS·LLM_MODEL_PRICES·modelKeyOf·resolveLlmModel(S3f), buildSelectPrompt·parseSpeakerChoice·fallbackSpeaker(S3d), withRetry, planRetryTimeout, buildSpeakPrompt, postprocessLine, buildSummaryPrompt·postprocessSummary·SUMMARY_*(S4), CHARACTER_PROFILES, COMMON_PROMPT, isCharacterId, parseCharacterFiles, DEFAULT_CHARACTER_SETTINGS·toPromptSettings·DEFAULT_PROMPT_SETTINGS(S3c), FakeProvider 등(아래 export)
 * [비동기] Llm.complete 만 await(제공사 fetch). 1차 실패(network·timeout·5xx) 시 1초 뒤 1회 재시도, LLM 단계 ≤ 66초
 * [에러] AppError LLM_FAILED·LLM_EMPTY(502). 키 누락 CONFIG_INVALID 는 호출 전 requireLlmApiKey(env 모듈)가 낸다. LlmError 는 모듈 밖으로 나가지 않는다
 * [설정] provider·apiKey·model·timeoutMs 를 컨테이너가 Config 에서 골라 값으로 전달(바인딩 직접 읽기 없음)
 * [테스트] server/test/llm-prompt.test.ts, llm-gemini.test.ts, llm-client.test.ts (SRV-T-163~186, 250~255, 261~268), llm-select.test.ts, llm-summary.test.ts (SRV-T-316~318)
 */
export type { LlmTurn, GenerateInput, GenerateOutput, LlmProvider, Prompt } from './provider'
export { createProvider, type ProviderConfig } from './factory'
// S3f 모델 선택(llm.md §15)
export {
  LLM_MODEL_OPTIONS,
  LLM_MODEL_PRICES,
  modelKeyOf,
  resolveLlmModel,
  type ModelPricing,
  type ResolvedLlmModel,
} from './models'
export {
  createLlm,
  withRetry,
  planRetryTimeout,
  LLM_BUDGET_MS,
  RETRY_BACKOFF_MS,
  MIN_RETRY_TIMEOUT_MS,
  type Llm,
  type LlmDeps,
  type RetryClock,
  type CompleteOptions,
  type SelectSpeakerInput,
} from './client'
// S3d 화자 선택(llm.md §13)
export {
  buildSelectPrompt,
  parseSpeakerChoice,
  fallbackSpeaker,
  mentionedSpeaker,
  SELECT_TIMEOUT_MS,
  SELECT_HISTORY_MESSAGES,
  type SelectPromptInput,
  type SelectFallbackReason,
  type SpeakerChoice,
} from './select'
export { buildSpeakPrompt, type SpeakPromptInput, type PromptMessage } from './prompt'
export { postprocessLine } from './postprocess'
// S4 장기기억 요약(llm.md §14)
export {
  buildSummaryPrompt,
  postprocessSummary,
  SUMMARY_BUDGET_MS,
  SUMMARY_SYSTEM,
  SUMMARY_TARGET_CHARS,
  type SummaryPromptInput,
} from './summary'
export {
  CHARACTER_PROFILES,
  COMMON_PROMPT,
  DEFAULT_CHARACTER_SETTINGS,
  DEFAULT_PROMPT_SETTINGS,
  OUTPUT_RULES,
  isCharacterId,
  parseCharacterFiles,
  toPromptSettings,
  type CharacterProfile,
  type CommonPrompt,
  type PromptSettings,
} from './characters'
// 테스트·컨테이너 편의로 FakeProvider 만 재노출. GeminiProvider·LlmError 는 파일 경로로 import(테스트 전용)
export { FakeProvider, FAKE_DEFAULT_TEXT, FAKE_USAGE, type FakeStep } from './fake'
// S3b 월 비용 상한(llm.md §12)
export {
  createUsageMeter,
  kstMonthKey,
  nextKstMonthStartMs,
  budgetRetryAfterSec,
  estimateKrw,
  KST_OFFSET_MS,
  type LlmUsage,
  type UsagePricing,
  type UsageMeterConfig,
  type UsageTotals,
  type UsageDelta,
  type UsageStore,
  type UsageMeter,
  type UsageMeterDeps,
} from './usage'
