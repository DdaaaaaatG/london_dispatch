/**
 * [목적] S1 SQL 문자열 상수. 문자열 연결·보간 금지, 값은 전부 bind (R-DB-003). 설계 db.md §3.1
 * [공개 API] SQL_ROOMS_LIST_SUMMARIES, SQL_ROOMS_EXISTS, SQL_ROOMS_TOUCH, SQL_MESSAGES_PAGE_LATEST, SQL_MESSAGES_PAGE_BEFORE
 * [비동기] 없음
 * [에러] 없음
 * [설정] 없음
 * [테스트] server/test/db.test.ts (SRV-T-024~029)
 */
export const SQL_ROOMS_LIST_SUMMARIES = `SELECT r.id, r.title, r.created_at, r.updated_at,
       (SELECT COUNT(*) FROM messages m WHERE m.room_id = r.id) AS message_count
FROM rooms r
ORDER BY r.updated_at DESC, r.id ASC`

export const SQL_ROOMS_EXISTS = 'SELECT 1 AS found FROM rooms WHERE id = ?1 LIMIT 1'

export const SQL_ROOMS_TOUCH = 'UPDATE rooms SET updated_at = ?1 WHERE id = ?2'

export const SQL_MESSAGES_PAGE_LATEST = `SELECT id, room_id, speaker, kind, text, author_name, created_at
FROM messages
WHERE room_id = ?1
ORDER BY id DESC
LIMIT ?2`

export const SQL_MESSAGES_PAGE_BEFORE = `SELECT id, room_id, speaker, kind, text, author_name, created_at
FROM messages
WHERE room_id = ?1 AND id < ?2
ORDER BY id DESC
LIMIT ?3`
