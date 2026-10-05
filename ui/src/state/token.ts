/**
 * 토큰 메모리 슬롯 — 설계 rooms/design/components.md §1.10 · F-RM-20 · 요구 R-CHAT-009 · R-API-003 · R-NFR-004
 * 비유: 갠홈이 써 준 출입증을 주머니(메모리)에만 넣어 둔다. 서랍(저장소)에는 넣지 않는다. 출입이 거절되면 주머니를 비운다.
 * 보관은 모듈 클로저 변수 하나뿐이다. localStorage · sessionStorage · 쿠키 · window 전역에 두지 않는다.
 * URL 은 고치지 않고, 디코드·검사하지 않으며, console · 문구 · 에러에 토큰을 넣지 않는다.
 * initToken 은 main.tsx 가 렌더 전 한 번만 부른다. 그 밖의 파일은 getToken 값을 읽을 뿐 파싱하지 않는다.
 */

/** 클로저로 캡슐화한 슬롯. 바꾸는 곳은 initToken · clearToken 뿐이다 */
const createTokenSlot = () => {
  let token: string | null = null
  return {
    read: (): string | null => token,
    write: (next: string | null): void => {
      token = next
    },
  }
}

const slot = createTokenSlot()

/** `?t=` 값을 trim 해 돌려준다. 없거나 공백뿐이면 null */
export const readTokenFromSearch = (search: string): string | null => {
  const raw = new URLSearchParams(search).get('t')
  if (raw === null) return null
  const trimmed = raw.trim()
  return trimmed === '' ? null : trimmed
}

/** main.tsx 가 렌더 전 1회 부른다. 슬롯 = readTokenFromSearch(search) */
export const initToken = (search: string): void => slot.write(readTokenFromSearch(search))

/** 슬롯 값. configureClient({ getToken }) 에 그대로 넘긴다 */
export const getToken = (): string | null => slot.read()

/** 인증 실패 전환 · 테스트 정리. 슬롯 = null */
export const clearToken = (): void => slot.write(null)
