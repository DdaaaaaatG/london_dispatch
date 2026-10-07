/**
 * [목적] `npm run token:test -w server -- <명령>` CLI 진입. 로컬에서 갠홈 PHP 조각과 서버 검증을 대조한다(R-TOKEN-001 🔒).
 * [공개 API] 명령 3종
 *   sign     --secret <S> --mb-id <id> [--nick <n>] [--ch-name <c>] [--level <n=5>] [--hours <h=12>]  → stdout 에 토큰 1줄(payload 요약은 stderr)
 *   verify   --secret <S> --token <t> [--min-level <n=5>]                                              → ok/실패 사유, mb_id·level·exp
 *   vectors  --secret <S>                                                                              → auth.md §2.6 V1~V8 입력·기대 토큰
 *   --secret 이 없으면 사용법 출력, exit 2. (환경변수 폴백은 없다: 설정 읽기는 env.ts 전용이라 secret-scope 훅이 막는다)
 * [비동기] crypto.subtle 만 await
 * [에러] 인자 오류 exit 2, verify 실패 exit 1, 성공 exit 0
 * [설정] --secret(로컬 시험값만. 운영 SECRET 사용 금지). 32자 미만이면 경고
 * [테스트] 핵심 함수는 server/test/token-test-script.test.ts, CLI 는 수동 실행 증거
 * [주의] SECRET 은 어떤 출력에도 싣지 않는다(R-AUTH-006 🔒). 새 패키지 없이 Node 네이티브 type stripping 으로 실행한다.
 * 이 파일은 Node 전용이라 server tsconfig 에 포함하지 않는다(타입 점검은 token-tool.ts 가 맡는다).
 */
import {
  formatVerify,
  renderVectors,
  SECRET_MIN_LENGTH,
  signToken,
  TOKEN_TEST_DEFAULTS,
  verifyTokenCli,
} from './token-tool'

declare const process: {
  argv: string[]
  exitCode?: number
}

const USAGE = `사용법: npm run token:test -w server -- <명령> [옵션]
  sign    --secret <S> --mb-id <id> [--nick <n>] [--ch-name <c>] [--level <n=5>] [--hours <h=12>]
  verify  --secret <S> --token <t> [--min-level <n=5>]
  vectors --secret <S>`

const EXIT_FAIL = 1
const EXIT_USAGE = 2
const MS_PER_SEC = 1000

type Flags = Record<string, string>

const parseFlags = (args: string[]): Flags => {
  const flags: Flags = {}
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i]
    const value = args[i + 1]
    if (name?.startsWith('--') && value !== undefined) flags[name.slice(2)] = value
  }
  return flags
}

const usageError = (message: string): void => {
  console.error(`${message}\n${USAGE}`)
  process.exitCode = EXIT_USAGE
}

const toNumber = (value: string | undefined, fallback: number): number =>
  value === undefined ? fallback : Number(value)

/** workerd 전용 timingSafeEqual 이 Node 에는 없다. 서버 verifyToken 을 그대로 쓰려고 같은 의미로 채운다 */
const installTimingSafeEqual = (): void => {
  const subtle = crypto.subtle as unknown as { timingSafeEqual?: unknown }
  if (typeof subtle.timingSafeEqual === 'function') return
  subtle.timingSafeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
    return diff === 0
  }
}

const runSign = async (flags: Flags, secret: string): Promise<void> => {
  const mbId = flags['mb-id']
  if (!mbId) return usageError('--mb-id 가 필요하다')
  const level = toNumber(flags.level, TOKEN_TEST_DEFAULTS.level)
  const hours = toNumber(flags.hours, TOKEN_TEST_DEFAULTS.hours)
  if (!Number.isFinite(level) || !Number.isFinite(hours)) {
    return usageError('--level·--hours 는 숫자여야 한다')
  }
  const { token, json, expSec } = await signToken({
    secret,
    mbId,
    level,
    hours,
    ...(flags.nick === undefined ? {} : { nick: flags.nick }),
    ...(flags['ch-name'] === undefined ? {} : { chName: flags['ch-name'] }),
  })
  console.error(`payload: ${json}\nexp: ${new Date(expSec * MS_PER_SEC).toISOString()}`)
  console.log(token)
}

const runVerify = async (flags: Flags, secret: string): Promise<void> => {
  const token = flags.token
  if (!token) return usageError('--token 이 필요하다')
  const minLevel = toNumber(flags['min-level'], TOKEN_TEST_DEFAULTS.minLevel)
  if (!Number.isFinite(minLevel)) return usageError('--min-level 은 숫자여야 한다')
  const report = await verifyTokenCli({ secret, token, minLevel })
  console.log(formatVerify(report).join('\n'))
  if (!report.ok) process.exitCode = EXIT_FAIL
}

const main = async (): Promise<void> => {
  const [command, ...rest] = process.argv.slice(2)
  const flags = parseFlags(rest)
  const secret = flags.secret
  if (command !== 'sign' && command !== 'verify' && command !== 'vectors') {
    return usageError('명령이 필요하다(sign | verify | vectors)')
  }
  if (!secret) return usageError('--secret 이 필요하다')
  if (secret.length < SECRET_MIN_LENGTH) {
    console.error(
      `경고: SECRET 이 ${SECRET_MIN_LENGTH}자 미만이다. 서버(parseEnv)는 이런 SECRET 을 거부한다.`,
    )
  }
  installTimingSafeEqual()
  if (command === 'sign') return runSign(flags, secret)
  if (command === 'verify') return runVerify(flags, secret)
  console.log((await renderVectors(secret)).join('\n'))
}

await main()
