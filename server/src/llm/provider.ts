/**
 * [목적] LLM 제공사 어댑터 인터페이스와 내부 실패 분류(R-LLM-001, R-LLM-005). 설계 llm.md §2.1
 * [공개 API] 타입 LlmTurn·GenerateInput·GenerateOutput·Prompt·LlmProvider·LlmFailReason, 클래스 LlmError
 * [비동기] generate 는 Promise. 시도 1회의 타임아웃은 input.timeoutMs(재시도 예산은 client 가 계산)
 * [에러] LlmError{ reason, retryable, httpStatus?, providerStatus?, finishReason?, usage?(S3b) } — 모듈 밖으로 나가지 않는다
 * [설정] 없음
 * [테스트] server/test/llm-gemini.test.ts, llm-client.test.ts (SRV-T-174~186)
 */
import type { LlmProviderName } from '../env'
import type { LlmUsage } from './usage'

/** 대화 한 턴. 제공사 고유 역할명(Gemini 'model')은 어댑터가 바꾼다 */
export type LlmTurn = { readonly role: 'user' | 'assistant'; readonly text: string }

/** 어댑터 1회 호출 입력. timeoutMs 는 이번 시도의 상한 */
export type GenerateInput = {
  readonly system: string
  readonly turns: readonly LlmTurn[]
  readonly timeoutMs: number
}

/** S3b: usage 는 선택(하위 호환). Gemini 200 응답이면 항상 채운다(llm.md §12.5) */
export type GenerateOutput = { readonly text: string; readonly usage?: LlmUsage }

/** 조립된 프롬프트(타임아웃 제외). buildSpeakPrompt 결과 */
export type Prompt = { readonly system: string; readonly turns: readonly LlmTurn[] }

export interface LlmProvider {
  readonly name: LlmProviderName
  /** 실패는 LlmError 로 throw 한다(AppError 아님 — client 가 변환) */
  generate(input: GenerateInput): Promise<GenerateOutput>
}

/** 어댑터 실패 분류. retryable 은 reason 에서 정해진다 */
export type LlmFailReason =
  'network' | 'timeout' | 'http_5xx' | 'http_429' | 'http_4xx' | 'bad_response' | 'blocked'

const RETRYABLE_REASONS: ReadonlySet<LlmFailReason> = new Set(['network', 'timeout', 'http_5xx'])

export type LlmErrorOptions = {
  httpStatus?: number
  providerStatus?: string
  finishReason?: string
  cause?: unknown
  usage?: LlmUsage
}

/** llm 모듈 내부 에러. 메시지에는 분류 이름만 담는다(제공사 문장 금지) */
export class LlmError extends Error {
  readonly reason: LlmFailReason
  /** network · timeout · http_5xx 만 true */
  readonly retryable: boolean
  readonly httpStatus?: number
  /** ^[A-Z_]{1,40}$ enum 만 */
  readonly providerStatus?: string
  /** blocked 일 때 blockReason·finishReason enum */
  readonly finishReason?: string
  /** S3b. 실패했어도 제공사가 사용량을 돌려준 경우(200 + 차단·형식 불일치) */
  readonly usage?: LlmUsage

  constructor(reason: LlmFailReason, options?: LlmErrorOptions) {
    super(`llm_${reason}`, options?.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'LlmError'
    this.reason = reason
    this.retryable = RETRYABLE_REASONS.has(reason)
    if (options?.httpStatus !== undefined) this.httpStatus = options.httpStatus
    if (options?.providerStatus !== undefined) this.providerStatus = options.providerStatus
    if (options?.finishReason !== undefined) this.finishReason = options.finishReason
    if (options?.usage !== undefined) this.usage = options.usage
  }
}
