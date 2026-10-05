/**
 * [목적] base64url(RFC 4648 §5, 패딩 없음) 인코드·디코드. 비정규 인코딩은 거부한다 (R-AUTH-001, D-AUTH-3). 설계 auth.md §3
 * [공개 API] decodeBase64Url(s) -> Uint8Array | null, encodeBase64Url(bytes) -> string
 * [비동기] 없음(동기 순수 함수)
 * [에러] throw 하지 않는다. 형식 위반은 decodeBase64Url 이 null 을 돌려준다
 * [설정] 없음
 * [테스트] server/test/auth.test.ts (SRV-T-104, V5b)
 */
const ALPHABET = /^[A-Za-z0-9_-]+$/
const BASE64_BLOCK = 4
const BASE64_INVALID_REMAINDER = 1

/** 바이트를 base64url(무패딩) 문자열로 */
export const encodeBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

/** 알파벳·길이·정규형을 모두 만족할 때만 바이트로. 아니면 null */
export const decodeBase64Url = (s: string): Uint8Array | null => {
  if (!ALPHABET.test(s) || s.length % BASE64_BLOCK === BASE64_INVALID_REMAINDER) return null
  const padded = s.padEnd(Math.ceil(s.length / BASE64_BLOCK) * BASE64_BLOCK, '=')
  let binary: string
  try {
    binary = atob(padded.replaceAll('-', '+').replaceAll('_', '/'))
  } catch {
    return null
  }
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0))
  return encodeBase64Url(bytes) === s ? bytes : null
}
