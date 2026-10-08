/**
 * [목적] 방 비밀번호 규칙·해시·검증 순수 함수(R-LOCK-001·007). PBKDF2-SHA256 + 호출마다 새 salt, 원문은 어디에도 남기지 않는다. 설계 rooms.md §12.2·§12.3
 * [공개 API] PASSWORD_HASH_ITERATIONS, ROOM_PASSWORD_RULE_MESSAGE, checkPasswordRule(raw), hashPassword(password), verifyPassword(password, stored), parsePasswordHash(stored)(모듈 내부용)
 * [비동기] hashPassword·verifyPassword 만 Web Crypto(deriveBits) await. 나머지는 동기 순수
 * [에러] checkPasswordRule: AppError VALIDATION_ERROR('비밀번호는 4~32자로 입력해 주세요.'). verifyPassword: throw 하지 않는다(형식 깨짐 = false)
 * [설정] 없음(DB·env·로그 없음). 반복 수는 아래 상수
 * [테스트] server/test/rooms-password.test.ts (SRV-T-360~365)
 */
import { countCodePoints, ROOM_PASSWORD_MAX, ROOM_PASSWORD_MIN } from '@shared/limits'
import { AppError } from '../app-error'
import { decodeBase64Url, encodeBase64Url } from '../base64url'

/**
 * 반복 수 20_000 — Free 기준 운영 여유, Paid 확인 시 상향(rooms.md §12.3.3, U10).
 * 로컬 실측(Node v24.18.0, AMD Ryzen 7 9800X3D, deriveBits PBKDF2 SHA-256 8자, 워밍업 3회 뒤 20회 중앙값):
 *   5_000 → 0.53ms · 10_000 → 1.02 · 20_000 → 2.00 · 50_000 → 4.91~4.93 · 100_000 → 9.78.
 * 엣지 CPU 는 로컬보다 2~3배 느리고 Free 요청당 CPU 10ms 에 HMAC·D1·JSON 도 들어가므로 5ms 한계값(50_000) 대신 20_000 을 쓴다(메인 결정).
 * 상한 100_000(workerd PBKDF2 한도). 저장 문자열에 반복 수가 있어 상수를 바꿔도 옛 해시는 옛 값으로 검증, 마이그레이션 없음.
 * 운영 확인: 배포 뒤 대시보드 CPU 시간(E17·E18), 1102 오류가 보이면 내린다.
 */
export const PASSWORD_HASH_ITERATIONS = 20_000

/** 규칙 위반 문구(화면 카운터와 같은 4~32) */
export const ROOM_PASSWORD_RULE_MESSAGE = `비밀번호는 ${ROOM_PASSWORD_MIN}~${ROOM_PASSWORD_MAX}자로 입력해 주세요.`

const HASH_SCHEME = 'pbkdf2-sha256'
const HASH_SEPARATOR = '$'
const HASH_PART_COUNT = 4
const SALT_BYTES = 16
const DERIVED_BITS = 256
const DERIVED_BYTES = DERIVED_BITS / 8
/** workerd PBKDF2 반복 수 상한 */
const ITERATIONS_MAX = 100_000
const ITERATIONS_PATTERN = /^[1-9][0-9]{0,5}$/

type ParsedPasswordHash = { iterations: number; salt: Uint8Array; derived: Uint8Array }

/** 코드 포인트 4~32면 raw 를 그대로(trim·정규화 없음), 아니면 AppError VALIDATION_ERROR */
export const checkPasswordRule = (raw: string): string => {
  const length = countCodePoints(raw)
  if (length < ROOM_PASSWORD_MIN || length > ROOM_PASSWORD_MAX) {
    throw new AppError('VALIDATION_ERROR', ROOM_PASSWORD_RULE_MESSAGE)
  }
  return raw
}

const derive = async (
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    DERIVED_BITS,
  )
  return new Uint8Array(bits)
}

/** 'pbkdf2-sha256$<반복 수>$<salt base64url 16바이트>$<유도값 base64url 32바이트>'. salt 는 호출마다 새로 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const derived = await derive(password, salt, PASSWORD_HASH_ITERATIONS)
  return [
    HASH_SCHEME,
    String(PASSWORD_HASH_ITERATIONS),
    encodeBase64Url(salt),
    encodeBase64Url(derived),
  ].join(HASH_SEPARATOR)
}

/** 저장 문자열을 해석한다. 형식이 하나라도 어긋나면 null (모듈 내부용 — entry.ts 가 room_pass_hash_invalid 로그를 가르는 데 쓴다) */
export const parsePasswordHash = (stored: string): ParsedPasswordHash | null => {
  const parts = stored.split(HASH_SEPARATOR)
  const [scheme, iterText, saltText, derivedText] = parts
  if (parts.length !== HASH_PART_COUNT) return null
  if (scheme !== HASH_SCHEME || iterText === undefined || !ITERATIONS_PATTERN.test(iterText)) {
    return null
  }
  const iterations = Number(iterText)
  if (iterations > ITERATIONS_MAX) return null
  const salt = saltText === undefined ? null : decodeBase64Url(saltText)
  const derived = derivedText === undefined ? null : decodeBase64Url(derivedText)
  if (salt === null || salt.length !== SALT_BYTES) return null
  if (derived === null || derived.length !== DERIVED_BYTES) return null
  return { iterations, salt, derived }
}

/** 저장된 반복 수·salt 로 다시 유도해 상수 시간 비교. 형식이 깨졌으면 false(throw 없음) */
export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const parsed = parsePasswordHash(stored)
  if (parsed === null) return false
  const actual = await derive(password, parsed.salt, parsed.iterations)
  return crypto.subtle.timingSafeEqual(actual, parsed.derived)
}
