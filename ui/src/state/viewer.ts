/**
 * 보는 사람 — 설계 rooms/design/components.md §1.8 · F-RM-21 · 요구 R-CHAT-008 · R-ROOMS-002 · R-NFR-004
 * App 이 첫 렌더 1회 viewerFromToken(getToken()) 으로 정하고, 인증 실패면 READ_ONLY_VIEWER 로 한 방향 전환한다.
 * 화면은 canWrite 만 본다. 토큰 값·표시 이름은 viewer 에 두지 않는다(작성자명은 서버 응답 authorName, R-AUTH-004).
 */
export type Viewer = { readonly canWrite: boolean }

export const READ_ONLY_VIEWER: Viewer = Object.freeze({ canWrite: false })

export const WRITER_VIEWER: Viewer = Object.freeze({ canWrite: true })

/** 토큰이 있으면 쓰기 가능, 없으면 읽기 전용 */
export const viewerFromToken = (token: string | null): Viewer =>
  token !== null ? WRITER_VIEWER : READ_ONLY_VIEWER
