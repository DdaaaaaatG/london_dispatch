/**
 * [목적] SQL 문자열 상수(S1 조회 + S2 쓰기·레이트리밋). 문자열 연결·보간 금지, 값은 전부 bind (R-DB-003). 설계 db.md §3.1·§3.2
 * [공개 API] S4 SQL_MEMORY_STATE_BY_ROOM·PUT_SUMMARY·ADVANCE, SQL_MESSAGES_COUNT_AFTER·LIST_AFTER / S3c SQL_CHARACTER_SETTINGS_GET·UPSERT / S3b SQL_LLM_USAGE_ADD·BY_MONTH / S3 SQL_ROOMS_ACQUIRE_SPEAK_LOCK·RELEASE_SPEAK_LOCK, SQL_MESSAGES_BY_ID, SQL_MEMORY_SUMMARY_BY_ROOM / S1 SQL_ROOMS_LIST_SUMMARIES·EXISTS·TOUCH, SQL_MESSAGES_PAGE_LATEST·BEFORE / S2 SQL_ROOMS_INSERT·UPDATE_TITLE·SUMMARY_BY_ID·DELETE·TOUCH_BY_MESSAGE, SQL_MEMORY_DELETE_BY_ROOM, SQL_MESSAGES_DELETE_BY_ROOM·INSERT_IF_ROOM·UPDATE_TEXT·DELETE, SQL_RATE_LIMITS_HIT·PURGE_BEFORE
 * [비동기] 없음
 * [에러] 없음
 * [설정] 없음
 * [테스트] server/test/db.test.ts (SRV-T-024~029, 121~128, 187~190, 322~325)
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

// ---- S2 ----
const MESSAGE_COLUMNS = 'id, room_id, speaker, kind, text, author_name, created_at'

export const SQL_ROOMS_INSERT =
  'INSERT INTO rooms (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)'

export const SQL_ROOMS_UPDATE_TITLE = 'UPDATE rooms SET title = ?1 WHERE id = ?2'

export const SQL_ROOMS_SUMMARY_BY_ID = `SELECT r.id, r.title, r.created_at, r.updated_at,
       (SELECT COUNT(*) FROM messages m WHERE m.room_id = r.id) AS message_count
FROM rooms r
WHERE r.id = ?1`

export const SQL_MEMORY_DELETE_BY_ROOM = 'DELETE FROM memory WHERE room_id = ?1'
export const SQL_MESSAGES_DELETE_BY_ROOM = 'DELETE FROM messages WHERE room_id = ?1'
export const SQL_ROOMS_DELETE = 'DELETE FROM rooms WHERE id = ?1'

/** 방이 있을 때만 INSERT. 없으면 0행 */
export const SQL_MESSAGES_INSERT_IF_ROOM = `INSERT INTO messages (room_id, speaker, kind, text, author_mb_id, author_name, created_at)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ?1)
RETURNING ${MESSAGE_COLUMNS}`

export const SQL_MESSAGES_UPDATE_TEXT = `UPDATE messages SET text = ?1 WHERE id = ?2
RETURNING ${MESSAGE_COLUMNS}`

/** 메시지가 없으면 0행 */
export const SQL_ROOMS_TOUCH_BY_MESSAGE =
  'UPDATE rooms SET updated_at = ?1 WHERE id = (SELECT room_id FROM messages WHERE id = ?2)'

export const SQL_MESSAGES_DELETE = 'DELETE FROM messages WHERE id = ?1'

export const SQL_RATE_LIMITS_HIT = `INSERT INTO rate_limits (mb_id, window_start, count) VALUES (?1, ?2, 1)
ON CONFLICT (mb_id, window_start) DO UPDATE SET count = count + 1 WHERE count < ?3
RETURNING count`

export const SQL_RATE_LIMITS_PURGE_BEFORE = 'DELETE FROM rate_limits WHERE window_start < ?1'

// ---- S3 ----
/** 비었거나 만료(≤ ?3)일 때만 선점. 선점하면 1행 RETURNING */
export const SQL_ROOMS_ACQUIRE_SPEAK_LOCK = `UPDATE rooms SET speaking_until = ?1
WHERE id = ?2 AND (speaking_until IS NULL OR speaking_until <= ?3)
RETURNING id`

/** 내가 건 잠금일 때만 해제 */
export const SQL_ROOMS_RELEASE_SPEAK_LOCK =
  'UPDATE rooms SET speaking_until = NULL WHERE id = ?1 AND speaking_until = ?2'

export const SQL_MESSAGES_BY_ID = `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?1`

export const SQL_MEMORY_SUMMARY_BY_ROOM = 'SELECT summary FROM memory WHERE room_id = ?1'

// ---- S3b ----
/** 월 행에 1회분 가산. 조건 없는 UPSERT — 이미 쓴 비용은 항상 기록한다(D-DB-20) */
export const SQL_LLM_USAGE_ADD = `INSERT INTO llm_usage (month, calls, prompt_tokens, output_tokens, est_krw, updated_at)
VALUES (?1, 1, ?2, ?3, ?4, ?5)
ON CONFLICT (month) DO UPDATE SET
  calls = calls + 1,
  prompt_tokens = prompt_tokens + excluded.prompt_tokens,
  output_tokens = output_tokens + excluded.output_tokens,
  est_krw = est_krw + excluded.est_krw,
  updated_at = excluded.updated_at
RETURNING month, calls, prompt_tokens, output_tokens, est_krw`

export const SQL_LLM_USAGE_BY_MONTH =
  'SELECT month, calls, prompt_tokens, output_tokens, est_krw FROM llm_usage WHERE month = ?1'

// ---- S3c ----
export const SQL_CHARACTER_SETTINGS_GET =
  'SELECT json, version, updated_at FROM character_settings WHERE id = 1'

/** 1행 문서 UPSERT. 조건 없음 — 마지막 쓰기 승리(settings.md D-SET-5) */
export const SQL_CHARACTER_SETTINGS_UPSERT = `INSERT INTO character_settings (id, json, version, updated_at, updated_by)
VALUES (1, ?1, 1, ?2, ?3)
ON CONFLICT (id) DO UPDATE SET
  json = excluded.json,
  version = character_settings.version + 1,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by
RETURNING version, updated_at`

// ---- S4 ----
export const SQL_MEMORY_STATE_BY_ROOM =
  'SELECT summary, source_until_id, updated_at FROM memory WHERE room_id = ?1'

/** 방이 있을 때만. 새 행은 source_until_id 0. 기존 행은 summary·updated_at 을 바꾸고, 빈 요약('')이면 source_until_id 를 0 으로 되돌린다(다시 요약, R-MEM-001) */
export const SQL_MEMORY_PUT_SUMMARY = `INSERT INTO memory (room_id, summary, source_until_id, updated_at)
SELECT ?1, ?2, 0, ?3
WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ?1)
ON CONFLICT (room_id) DO UPDATE SET
  summary = excluded.summary,
  source_until_id = CASE WHEN excluded.summary = '' THEN 0 ELSE memory.source_until_id END,
  updated_at = excluded.updated_at
RETURNING summary, source_until_id, updated_at`

/** 낙관적 잠금. 행이 없으면 넣고, 있으면 기대값(?5 source_until_id, ?6 summary)과 같을 때만 바꾼다 */
export const SQL_MEMORY_ADVANCE = `INSERT INTO memory (room_id, summary, source_until_id, updated_at)
SELECT ?1, ?2, ?3, ?4
WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ?1)
ON CONFLICT (room_id) DO UPDATE SET
  summary = excluded.summary,
  source_until_id = excluded.source_until_id,
  updated_at = excluded.updated_at
WHERE memory.source_until_id = ?5 AND memory.summary = ?6
RETURNING room_id`

/** cap 이상은 세지 않는다(읽기 행 수 상한) */
export const SQL_MESSAGES_COUNT_AFTER = `SELECT COUNT(*) AS n FROM (
  SELECT 1 FROM messages WHERE room_id = ?1 AND id > ?2 LIMIT ?3
)`

export const SQL_MESSAGES_LIST_AFTER = `SELECT ${MESSAGE_COLUMNS}
FROM messages
WHERE room_id = ?1 AND id > ?2
ORDER BY id ASC
LIMIT ?3`
