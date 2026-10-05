/**
 * 보는 사람 — 설계 rooms/design/components.md §1.8 · 요구 R-CHAT-008 · R-NFR-004
 * S1 은 토큰을 읽지 않으므로 App 은 항상 READ_ONLY_VIEWER 를 내려준다.
 * S2 에서 토큰 상태(ui/src/state/token.ts)로 canWrite 를 계산하도록 바뀐다. 화면은 canWrite 만 본다.
 */
export type Viewer = { readonly canWrite: boolean }

export const READ_ONLY_VIEWER: Viewer = Object.freeze({ canWrite: false })
