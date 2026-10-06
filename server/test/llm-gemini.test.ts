// SRV-T-174~179·185·186 — doc/200_설계/server/llm.md §8 (제공사 어댑터)
import { describe, expect, it } from 'vitest'
import { createProvider, FAKE_DEFAULT_TEXT, FakeProvider } from '../src/llm'
import { GEMINI_BASE_URL, GeminiProvider } from '../src/llm/gemini'
import { LlmError, type GenerateInput } from '../src/llm/provider'

const KEY = 'SENTINEL_KEY_x9'
const MESSAGE_SENTINEL = 'SENTINEL_PROVIDER_MESSAGE_z3'
const INPUT: GenerateInput = { system: 'S', turns: [{ role: 'user', text: 'U' }], timeoutMs: 1234 }

type Recorded = { url: string; init: RequestInit }

/** 준비한 응답을 순서대로 돌려주고 호출 인자를 기록하는 가짜 fetch */
const fakeFetch = (respond: () => Response | Promise<Response>) => {
  const calls: Recorded[] = []
  const fetchFn: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} })
    return respond()
  }
  return { fetchFn, calls }
}

const json = (body: unknown, status = 200): Response =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

const makeGemini = (fetchFn: typeof fetch) =>
  new GeminiProvider({ apiKey: KEY, model: 'gemini-2.5-flash' }, fetchFn)

const failure = async (p: Promise<unknown>): Promise<LlmError> => {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(LlmError)
    return e as LlmError
  }
  throw new Error('expected LlmError')
}

describe('GeminiProvider 요청·응답', () => {
  it('SRV-T-174 gemini_request_matches_snapshot', async () => {
    const { fetchFn, calls } = fakeFetch(() =>
      json({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
    )
    await makeGemini(fetchFn).generate(INPUT)
    expect(calls).toHaveLength(1)
    const { url, init } = calls[0] as Recorded
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    )
    expect(url.startsWith(GEMINI_BASE_URL)).toBe(true)
    expect(url).not.toContain('?')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'content-type': 'application/json', 'x-goog-api-key': KEY })
    expect(JSON.parse(String(init.body))).toEqual({
      systemInstruction: { parts: [{ text: 'S' }] },
      contents: [{ role: 'user', parts: [{ text: 'U' }] }],
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(url).not.toContain(KEY)
    expect(String(init.body)).not.toContain(KEY)
  })

  it('SRV-T-175 gemini_joins_text_parts_and_maps_roles', async () => {
    const parts = [{ thought: true, text: '생각' }, { text: '가' }, { text: '나' }]
    const a = fakeFetch(() => json({ candidates: [{ content: { parts } }] }))
    expect(await makeGemini(a.fetchFn).generate(INPUT)).toEqual({ text: '가나' })
    const b = fakeFetch(() => json({ candidates: [{ content: { parts: [{ text: 'x' }] } }] }))
    await makeGemini(b.fetchFn).generate({
      ...INPUT,
      turns: [
        { role: 'user', text: 'u' },
        { role: 'assistant', text: 'a' },
      ],
    })
    const body = JSON.parse(String((b.calls[0] as Recorded).init.body)) as {
      contents: { role: string }[]
    }
    expect(body.contents.map(c => c.role)).toEqual(['user', 'model'])
  })

  it.each([
    ['500', 500, { error: { status: 'INTERNAL' } }, 'http_5xx', true, 'INTERNAL'],
    [
      '503',
      503,
      { error: { status: 'UNAVAILABLE', message: MESSAGE_SENTINEL } },
      'http_5xx',
      true,
      'UNAVAILABLE',
    ],
    [
      '429',
      429,
      { error: { status: 'RESOURCE_EXHAUSTED' } },
      'http_429',
      false,
      'RESOURCE_EXHAUSTED',
    ],
    [
      '400',
      400,
      { error: { status: 'INVALID_ARGUMENT', message: MESSAGE_SENTINEL } },
      'http_4xx',
      false,
      'INVALID_ARGUMENT',
    ],
    [
      '403',
      403,
      { error: { status: 'PERMISSION_DENIED' } },
      'http_4xx',
      false,
      'PERMISSION_DENIED',
    ],
    ['500 비JSON', 500, 'plain text', 'http_5xx', true, undefined],
    [
      'status 패턴 불일치',
      400,
      { error: { status: 'bad status!', message: MESSAGE_SENTINEL } },
      'http_4xx',
      false,
      undefined,
    ],
  ])(
    'SRV-T-176 gemini_classifies_http_errors: %s',
    async (_n, status, body, reason, retryable, providerStatus) => {
      const { fetchFn } = fakeFetch(() => json(body, status))
      const err = await failure(makeGemini(fetchFn).generate(INPUT))
      expect(err.reason).toBe(reason)
      expect(err.retryable).toBe(retryable)
      expect(err.httpStatus).toBe(status)
      expect(err.providerStatus).toBe(providerStatus)
      const dump = [
        err.message,
        String(err),
        JSON.stringify({ ...err }),
        err.cause === undefined ? '' : 'cause',
      ]
      expect(dump.join('|')).not.toContain(MESSAGE_SENTINEL)
    },
  )

  it('SRV-T-177 gemini_classifies_network_and_timeout', async () => {
    const net = makeGemini(async () => {
      throw new TypeError('fetch failed')
    })
    const e1 = await failure(net.generate(INPUT))
    expect([e1.reason, e1.retryable]).toEqual(['network', true])

    const abort = makeGemini(async () => {
      throw new DOMException('timed out', 'TimeoutError')
    })
    const e2 = await failure(abort.generate(INPUT))
    expect([e2.reason, e2.retryable]).toEqual(['timeout', true])

    const bodyTimeout = makeGemini(
      async () =>
        ({
          ok: true,
          status: 200,
          json: () => Promise.reject(new DOMException('timed out', 'TimeoutError')),
        }) as unknown as Response,
    )
    const e3 = await failure(bodyTimeout.generate(INPUT))
    expect([e3.reason, e3.retryable]).toEqual(['timeout', true])
  })

  it('SRV-T-178 gemini_maps_blocked_and_empty_candidates', async () => {
    const run = (body: unknown) => makeGemini(fakeFetch(() => json(body)).fetchFn).generate(INPUT)
    const e1 = await failure(run({ promptFeedback: { blockReason: 'SAFETY' } }))
    expect([e1.reason, e1.retryable, e1.finishReason]).toEqual(['blocked', false, 'SAFETY'])
    const e2 = await failure(run({ candidates: [] }))
    expect([e2.reason, e2.retryable]).toEqual(['blocked', false])
    const e3 = await failure(run({ candidates: [{ finishReason: 'SAFETY', content: {} }] }))
    expect([e3.reason, e3.retryable, e3.finishReason]).toEqual(['blocked', false, 'SAFETY'])
    expect(await run({ candidates: [{ finishReason: 'STOP', content: { parts: [] } }] })).toEqual({
      text: '',
    })
  })

  it('SRV-T-179 gemini_rejects_bad_200_response', async () => {
    for (const body of ['not json', { candidates: 'x' }]) {
      const err = await failure(makeGemini(fakeFetch(() => json(body)).fetchFn).generate(INPUT))
      expect([err.reason, err.retryable]).toEqual(['bad_response', false])
    }
  })
})

describe('createProvider · FakeProvider', () => {
  it('SRV-T-185 createProvider_selects_implementation_by_env_value', () => {
    let fetchCalls = 0
    const fetchFn: typeof fetch = async () => {
      fetchCalls += 1
      return json({})
    }
    const google = createProvider({ provider: 'google', apiKey: KEY, model: 'm' }, { fetchFn })
    expect(google).toBeInstanceOf(GeminiProvider)
    expect(google.name).toBe('google')
    const fake = createProvider({ provider: 'fake', apiKey: '', model: 'm' }, { fetchFn })
    expect(fake).toBeInstanceOf(FakeProvider)
    expect(fake.name).toBe('fake')
    expect(fetchCalls).toBe(0)
  })

  it('SRV-T-186 FakeProvider_records_calls_and_plays_steps_deterministically', async () => {
    const fake = new FakeProvider([{ text: 'a' }, { error: new LlmError('timeout') }])
    const inputs: GenerateInput[] = [1, 2, 3].map(n => ({
      system: `s${n}`,
      turns: [],
      timeoutMs: n * 1000,
    }))
    expect(await fake.generate(inputs[0] as GenerateInput)).toEqual({ text: 'a' })
    const err = await failure(fake.generate(inputs[1] as GenerateInput))
    expect(err.reason).toBe('timeout')
    expect(await fake.generate(inputs[2] as GenerateInput)).toEqual({ text: FAKE_DEFAULT_TEXT })
    expect(fake.calls).toEqual(inputs)
  })
})
