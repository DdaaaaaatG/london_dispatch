// 교차 테스트 벡터 — doc/200_설계/server/auth.md §2.6 (R-AUTH-001 · R-TOKEN-001)
// 이 값이 기준이다. 테스트 안에서 재계산해 대조하지 않는다.

/** 테스트 전용 SECRET. 운영 SECRET 이 아니다 */
export const VECTOR_SECRET = 'london-dispatch-test-secret-v1'
/** 기준 시각 2026-01-01T00:00:00Z (epoch ms) */
export const VECTOR_NOW_MS = 1_767_225_600_000
/** exp = 기준 + 12h (epoch 초) */
export const VECTOR_EXP_SEC = 1_767_268_800
export const VECTOR_MIN_LEVEL = 5

export const TOKEN_VECTORS = {
  V1: 'eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Iu2FjOyKpO2EsCIsImNoX25hbWUiOiLsi5zsl5gg7Yys7YWA7ZWY7J2067iMIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.EWYxcZixnZzWnIjEmFZFc1-_DrqQ8gfOQEOFm3xzMu4',
  V2: 'eyJtYl9pZCI6InRlc3RlcjAyIiwibmljayI6IuuLieuEpOyehCIsImNoX25hbWUiOiIiLCJsZXZlbCI6MTAsImV4cCI6MTc2NzI2ODgwMH0.jWSaBGh1d4nF9M5kKORFq2V2sss6O2YWTGvAGi4C15s',
  V3: 'eyJtYl9pZCI6InRlc3RlcjAzIiwibmljayI6Iu2VmOq4iSIsImNoX25hbWUiOiIiLCJsZXZlbCI6NCwiZXhwIjoxNzY3MjY4ODAwfQ.X3DOlOqHWy4fJbzpuYxO1TKYegyRQj2Q9udNSsagvXI',
  V4: 'eyJtYl9pZCI6ImFzY2lpX29ubHkiLCJuaWNrIjoiVGVzdGVyIiwiY2hfbmFtZSI6IkNpZWwiLCJsZXZlbCI6NSwiZXhwIjoxNzY3MjY4ODAwfQ.bZ5o0FN-_veyz6bFb6gbVejYdIpqhkehp2XuzudLahI',
  V6: 'eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Iu2FjOyKpO2EsCIsImNoX25hbWUiOiLsi5zsl5gg7Yys7YWA7ZWY7J2067iMIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.3xEoW7yPl5OjkrJJqXh6huMbZ4p1Lzk55AVgoBtyWX8',
  V7: 'eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Ilx1ZDE0Y1x1YzJhNFx1ZDEzMCIsImNoX25hbWUiOiJcdWMyZGNcdWM1ZDggXHVkMzJjXHVkMTQwXHVkNTU4XHVjNzc0XHViZTBjIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.Ppc6_c3yRi28H05QHEZ_gvQMF-neidGMOwQ3a6ukWKs',
} as const

/** V5: V1 seg2 첫 글자 E→F */
export const TOKEN_V5 = TOKEN_VECTORS.V1.replace('.EWYx', '.FWYx')
/** V5b: V1 seg2 마지막 글자 4→5 (패딩 비트만 다름) */
export const TOKEN_V5B = `${TOKEN_VECTORS.V1.slice(0, -1)}5`
