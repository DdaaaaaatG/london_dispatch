/**
 * [목적] 방 입장 증명 발급·검증 순수 함수(R-LOCK-004). 증명 = HMAC(K, 방 id + 현재 해시)라 비밀번호 변경·해제·TOKEN_SECRET 교체 시 저절로 무효가 된다. 저장하지 않는다(무상태). 설계 rooms.md §12.2·§12.3.4
 * [공개 API] ENTRY_KEY_PURPOSE, ENTRY_KEY_PREFIX, deriveEntrySecret(tokenSecret), issueEntryKey(secret, roomId, passHash), verifyEntryKey(secret, roomId, passHash, presented), hasEntryKeyShape(presented)
 * [비동기] Web Crypto(HMAC importKey·sign) await 만
 * [에러] 없음(검증 실패 = false)
 * [설정] 없음. TOKEN_SECRET 은 services.ts 가 config.tokenSecret 값으로 deriveEntrySecret 에 넘긴다(여기서 바인딩을 읽지 않는다)
 * [테스트] server/test/rooms-password.test.ts (SRV-T-366·367)
 */
import { ROOM_KEY_MAX_LENGTH } from '@shared/limits'
import { decodeBase64Url, encodeBase64Url } from '../base64url'

/** 파생 용도 문자열(버전 포함) */
export const ENTRY_KEY_PURPOSE = 'london_dispatch/room-entry/v1'
/** 증명 접두사 */
export const ENTRY_KEY_PREFIX = 'e1.'
const HMAC_BYTES = 32
const ID_SEPARATOR = '\n'

const encoder = new TextEncoder()
const HMAC_ALGO = { name: 'HMAC', hash: 'SHA-256' } as const

/** K = HMAC-SHA256(key = UTF-8(tokenSecret), msg = UTF-8(ENTRY_KEY_PURPOSE)) 를 서명 전용(추출 불가) 키로 import */
export const deriveEntrySecret = async (tokenSecret: string): Promise<CryptoKey> => {
  const base = await crypto.subtle.importKey('raw', encoder.encode(tokenSecret), HMAC_ALGO, false, [
    'sign',
  ])
  const derived = await crypto.subtle.sign('HMAC', base, encoder.encode(ENTRY_KEY_PURPOSE))
  return crypto.subtle.importKey('raw', derived, HMAC_ALGO, false, ['sign'])
}

const mac = async (secret: CryptoKey, roomId: string, passHash: string): Promise<Uint8Array> =>
  new Uint8Array(
    await crypto.subtle.sign('HMAC', secret, encoder.encode(`${roomId}${ID_SEPARATOR}${passHash}`)),
  )

/** 'e1.' + base64url(HMAC(K, roomId + '\n' + passHash)) — 46자 */
export const issueEntryKey = async (
  secret: CryptoKey,
  roomId: string,
  passHash: string,
): Promise<string> => `${ENTRY_KEY_PREFIX}${encodeBase64Url(await mac(secret, roomId, passHash))}`

/** 값이 있고 128자 이하이며 접두사가 맞는지 — 키 파생·HMAC 전에 거르는 값싼 검사 */
export const hasEntryKeyShape = (presented: string | null): presented is string =>
  presented !== null &&
  presented !== '' &&
  presented.length <= ROOM_KEY_MAX_LENGTH &&
  presented.startsWith(ENTRY_KEY_PREFIX)

/** 형식 불일치·디코드 실패·32바이트 아님 = false(그 전에는 HMAC 계산 없음). 그 밖은 다시 계산해 상수 시간 비교 */
export const verifyEntryKey = async (
  secret: CryptoKey,
  roomId: string,
  passHash: string,
  presented: string | null,
): Promise<boolean> => {
  if (!hasEntryKeyShape(presented)) return false
  const given = decodeBase64Url(presented.slice(ENTRY_KEY_PREFIX.length))
  if (given === null || given.length !== HMAC_BYTES) return false
  return crypto.subtle.timingSafeEqual(await mac(secret, roomId, passHash), given)
}
