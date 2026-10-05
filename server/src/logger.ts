/**
 * [목적] JSON 한 줄 구조화 로거. 금지 키 값은 redact (R-AUTH-006, R-NFR-004). 설계 index.md §2.5·§3.3
 * [공개 API] createLogger(sink?) -> Logger, 타입 LogLevel·LogFields·Logger·LogSink
 * [비동기] 없음. 출력은 동기 sink 호출
 * [에러] 없음
 * [설정] 없음
 * [테스트] server/test/app.test.ts (SRV-T-088)
 */
export type LogLevel = 'info' | 'warn' | 'error'
/** 원시값만 허용 — 객체를 통째로 넘길 수 없게 타입으로 막는다 */
export type LogFields = Readonly<Record<string, string | number | boolean | null | undefined>>
export type Logger = {
  info: (event: string, fields?: LogFields) => void
  warn: (event: string, fields?: LogFields) => void
  error: (event: string, fields?: LogFields) => void
}
export type LogSink = (level: LogLevel, line: string) => void

const REDACTED = '[redacted]'
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(
  [
    'token',
    'authorization',
    'secret',
    'tokenSecret',
    'apiKey',
    'llmApiKey',
    'payload',
    'prompt',
    'text',
    'summary',
    'query',
  ].map((k) => k.toLowerCase()),
)

/** 프로젝트에서 console 이 허용되는 유일한 지점 */
const consoleSink: LogSink = (level, line) => {
  console[level](line)
}

const redact = (fields: LogFields): LogFields =>
  Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, FORBIDDEN_KEYS.has(k.toLowerCase()) ? REDACTED : v]),
  )

/** JSON 한 줄 로거를 만든다 */
export const createLogger = (sink: LogSink = consoleSink): Logger => {
  const write = (level: LogLevel) => (event: string, fields?: LogFields) => {
    sink(level, JSON.stringify({ level, event, ...redact(fields ?? {}) }))
  }
  return { info: write('info'), warn: write('warn'), error: write('error') }
}
