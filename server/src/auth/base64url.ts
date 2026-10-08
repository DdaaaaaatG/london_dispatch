/**
 * [목적] base64url 공통 구현(server/src/base64url.ts)의 재노출. 기존 import 경로(auth/token.ts·테스트·scripts) 유지 (rooms.md D-ROOM-13)
 * [공개 API] decodeBase64Url, encodeBase64Url
 * [비동기] 없음
 * [에러] 없음(원본과 같다: 형식 위반은 decode 가 null)
 * [설정] 없음
 * [테스트] server/test/auth.test.ts (SRV-T-104, V5b)
 */
export { decodeBase64Url, encodeBase64Url } from '../base64url'
