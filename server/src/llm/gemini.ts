/**
 * [목적] Google Gemini REST(generateContent) 어댑터(R-LLM-001, R-LLM-005). 키는 x-goog-api-key 헤더. 설계 llm.md §4.3
 * [공개 API] GeminiProvider, GEMINI_BASE_URL
 * [비동기] fetch 1회 + 응답 본문 읽기. AbortSignal.timeout(input.timeoutMs)가 본문 읽기까지 덮는다
 * [에러] LlmError{ network | timeout | http_5xx | http_429 | http_4xx | bad_response | blocked } — 제공사 오류 문장은 담지 않는다
 * [설정] apiKey(Secrets, 값으로 전달)·model(LLM_MODEL). URL·본문·로그에 키 없음
 * [테스트] server/test/llm-gemini.test.ts (SRV-T-174~179)
 */
import { z } from 'zod'
import { LlmError, type GenerateInput, type GenerateOutput, type LlmProvider } from './provider'

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

const ENUM_PATTERN = /^[A-Z_]{1,40}$/
/** 텍스트 없이 끝나도 차단으로 보지 않는 finishReason */
const NON_BLOCK_FINISH: ReadonlySet<string> = new Set(['STOP', 'MAX_TOKENS'])

const responseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z
              .array(z.object({ text: z.string().optional(), thought: z.boolean().optional() }))
              .optional(),
          })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
})
const errorBodySchema = z.object({ error: z.object({ status: z.string().optional() }).optional() })

/** enum 형태(^[A-Z_]{1,40}$)만 통과시킨다. 자유 문장은 버린다 */
const enumOnly = (value: string | undefined): string | undefined =>
  value !== undefined && ENUM_PATTERN.test(value) ? value : undefined

const isTimeout = (e: unknown): boolean =>
  typeof e === 'object' &&
  e !== null &&
  'name' in e &&
  (e.name === 'TimeoutError' || e.name === 'AbortError')

/** fetch·본문 읽기 중 던져진 값을 timeout / network 로 분류한다 */
const toTransportError = (e: unknown): LlmError =>
  new LlmError(isTimeout(e) ? 'timeout' : 'network', { cause: e })

const buildBody = (input: GenerateInput) => ({
  systemInstruction: { parts: [{ text: input.system }] },
  contents: input.turns.map(t => ({
    role: t.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: t.text }],
  })),
})

/** 본문 읽기 실패는 무시하고 status enum 만 꺼낸다(timeout 도 분류에 영향 없음) */
const readProviderStatus = async (res: Response): Promise<string | undefined> => {
  try {
    const parsed = errorBodySchema.safeParse(await res.json())
    return parsed.success ? enumOnly(parsed.data.error?.status) : undefined
  } catch {
    return undefined
  }
}

const classifyHttp = async (res: Response): Promise<LlmError> => {
  const providerStatus = await readProviderStatus(res)
  const opts = {
    httpStatus: res.status,
    ...(providerStatus !== undefined ? { providerStatus } : {}),
  }
  if (res.status >= 500) return new LlmError('http_5xx', opts)
  if (res.status === 429) return new LlmError('http_429', opts)
  return new LlmError('http_4xx', opts)
}

/** 200 응답을 { text } 로 바꾼다. 차단·후보 없음은 blocked */
const extractText = (data: z.infer<typeof responseSchema>): GenerateOutput => {
  const blockReason = data.promptFeedback?.blockReason
  if (blockReason !== undefined) {
    const finishReason = enumOnly(blockReason)
    throw new LlmError('blocked', finishReason !== undefined ? { finishReason } : undefined)
  }
  const first = data.candidates?.[0]
  if (first === undefined) throw new LlmError('blocked')
  const text = (first.content?.parts ?? [])
    .filter(p => p.thought !== true && typeof p.text === 'string')
    .map(p => p.text)
    .join('')
  if (text !== '') return { text }
  const finish = first.finishReason
  if (finish === undefined || NON_BLOCK_FINISH.has(finish)) return { text: '' }
  const finishReason = enumOnly(finish)
  throw new LlmError('blocked', finishReason !== undefined ? { finishReason } : undefined)
}

const readSuccess = async (res: Response): Promise<GenerateOutput> => {
  let json: unknown
  try {
    json = await res.json()
  } catch (e) {
    throw isTimeout(e)
      ? new LlmError('timeout', { cause: e })
      : new LlmError('bad_response', { cause: e })
  }
  const parsed = responseSchema.safeParse(json)
  if (!parsed.success) throw new LlmError('bad_response')
  return extractText(parsed.data)
}

export class GeminiProvider implements LlmProvider {
  readonly name = 'google'
  private readonly apiKey: string
  private readonly model: string
  private readonly fetchFn: typeof fetch | undefined

  constructor(config: { apiKey: string; model: string }, fetchFn?: typeof fetch) {
    this.apiKey = config.apiKey
    this.model = config.model
    this.fetchFn = fetchFn
  }

  /** generateContent 1회 호출. 실패는 LlmError */
  async generate(input: GenerateInput): Promise<GenerateOutput> {
    const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(this.model)}:generateContent`
    const doFetch =
      this.fetchFn ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args))
    let res: Response
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify(buildBody(input)),
        signal: AbortSignal.timeout(input.timeoutMs),
      })
    } catch (e) {
      throw toTransportError(e)
    }
    if (!res.ok) throw await classifyHttp(res)
    return readSuccess(res)
  }
}
