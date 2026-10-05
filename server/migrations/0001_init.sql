-- 0001_init.sql — 런던_디스패치 초기 스키마
-- 근거: 확정사항 §5.4, R-DB-001(테이블·CHECK·epoch ms) · R-DB-004(인덱스)
-- 이 파일은 적용 후 수정하지 않는다. 변경은 0002_*.sql 추가로만(R-DB-002).
-- 시각 컬럼은 전부 epoch 밀리초 INTEGER. 값은 서비스가 넣는다(DEFAULT·CURRENT_TIMESTAMP 없음).

-- 방(에피소드)
CREATE TABLE IF NOT EXISTS rooms (
  id              TEXT    PRIMARY KEY,                                   -- crypto.randomUUID() (R-ROOM-002)
  title           TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 60), -- trim 후 1~60자 (R-ROOM-002)
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  speaking_until  INTEGER                                                -- speak 잠금 만료 시각, NULL = 잠금 없음 (R-MSG-007)
);

-- 메시지
CREATE TABLE IF NOT EXISTS messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,                      -- 삭제 후 id 재사용 금지(페이지 커서·"마지막 메시지" 판정 안정)
  room_id       TEXT    NOT NULL REFERENCES rooms (id),
  speaker       TEXT    NOT NULL CHECK (speaker IN ('sebastian', 'ciel', 'user')),
  kind          TEXT    NOT NULL CHECK (kind IN ('line', 'ooc')),
  text          TEXT    NOT NULL CHECK (length(text) >= 1),
  author_mb_id  TEXT,                                                   -- 유저 메시지 작성자 mb_id (R-MSG-002)
  author_name   TEXT,                                                   -- 표시 이름 (R-AUTH-004)
  created_at    INTEGER NOT NULL,
  CHECK (speaker = 'user' OR kind = 'line'),                            -- OOC 는 유저만 (R-MSG-002·003)
  CHECK (speaker <> 'user' OR (author_mb_id IS NOT NULL AND author_name IS NOT NULL))
);

-- 방 단위 장기기억
CREATE TABLE IF NOT EXISTS memory (
  room_id          TEXT    PRIMARY KEY REFERENCES rooms (id),
  summary          TEXT    NOT NULL DEFAULT '' CHECK (length(summary) <= 4000), -- 0~4000자 (R-MEM-001)
  source_until_id  INTEGER NOT NULL DEFAULT 0 CHECK (source_until_id >= 0),     -- 요약에 반영된 마지막 messages.id, 0 = 없음
  updated_at       INTEGER NOT NULL
);

-- 쓰기 레이트리밋 분 창 카운터
CREATE TABLE IF NOT EXISTS rate_limits (
  mb_id         TEXT    NOT NULL,
  window_start  INTEGER NOT NULL,                                       -- 분 창 시작 epoch ms = floor(now/60000)*60000
  count         INTEGER NOT NULL CHECK (count >= 1),
  PRIMARY KEY (mb_id, window_start)
);

-- 인덱스 (R-DB-004)
CREATE INDEX IF NOT EXISTS idx_messages_room_id_id ON messages (room_id, id);
CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms (updated_at);
