// 테스트 토큰 생성기 — doc/200_설계/server/auth.md §3. 서명은 맞고 payload 가 깨진 경우도 만든다
import { encodeBase64Url } from '../src/auth/base64url'

/** payload(객체 → JSON, 문자열 → UTF-8 바이트, Uint8Array → 그대로)를 secret 으로 서명한 `seg1.seg2` 토큰 */
export const signTestToken = async (
  payload: Record<string, unknown> | string | Uint8Array,
  secret: string,
): Promise<string> => {
  const data =
    payload instanceof Uint8Array
      ? payload
      : new TextEncoder().encode(typeof payload === 'string' ? payload : JSON.stringify(payload))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, data))
  return `${encodeBase64Url(data)}.${encodeBase64Url(signature)}`
}
