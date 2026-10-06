/**
 * [목적] 결정적 각본을 재생하는 가짜 제공사(R-LLM-001). 키 없는 로컬 개발·통합 테스트용. 설계 llm.md §2.2
 * [공개 API] FakeProvider, FAKE_DEFAULT_TEXT, 타입 FakeStep
 * [비동기] generate 는 각본 함수가 있으면 그것을 await, 아니면 즉시 resolve
 * [에러] 각본의 LlmError 를 그대로 throw
 * [설정] 없음(fake 는 LLM_API_KEY 를 쓰지 않는다)
 * [테스트] server/test/llm-gemini.test.ts (SRV-T-185·186), llm-client.test.ts
 */
import type { GenerateInput, GenerateOutput, LlmProvider } from './provider'
import type { LlmError } from './provider'

/** 한 번의 호출에 대한 각본. 함수형은 입력을 보고 결과를 정한다 */
export type FakeStep =
  | { readonly text: string }
  | { readonly error: LlmError }
  | ((input: GenerateInput) => Promise<GenerateOutput>)

export const FAKE_DEFAULT_TEXT = '(가짜 응답) 잠시 생각에 잠긴다.'

/** steps[n] 이 n번째 호출 결과. 각본이 떨어지면 FAKE_DEFAULT_TEXT */
export class FakeProvider implements LlmProvider {
  readonly name = 'fake'
  /** 받은 입력을 순서대로 기록한다(테스트 단언용) */
  readonly calls: GenerateInput[] = []
  private readonly steps: readonly FakeStep[]

  constructor(steps: readonly FakeStep[] = []) {
    this.steps = steps
  }

  /** 각본 n번째를 재생한다 */
  async generate(input: GenerateInput): Promise<GenerateOutput> {
    const step = this.steps[this.calls.length]
    this.calls.push(input)
    if (step === undefined) return { text: FAKE_DEFAULT_TEXT }
    if (typeof step === 'function') return step(input)
    if ('error' in step) throw step.error
    return { text: step.text }
  }
}
