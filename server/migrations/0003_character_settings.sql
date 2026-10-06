-- 0003_character_settings.sql — 캐릭터 설정 1행 문서 (R-SET-003). 설계 doc/200_설계/server/db.md §2.5·§7.6
-- 본체 JSON 은 settings 모듈이 zod 로 검증·정규화해 쓰고, 읽을 때 다시 검증한다(훼손 행 → 시드 대체)
-- 시각은 epoch ms INTEGER(R-DB-001 규칙). updated_by 는 mb_id 만(R-AUTH-006)
CREATE TABLE IF NOT EXISTS character_settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  json        TEXT    NOT NULL CHECK (length(json) BETWEEN 2 AND 200000),
  version     INTEGER NOT NULL CHECK (version >= 1),
  updated_at  INTEGER NOT NULL,
  updated_by  TEXT    NOT NULL CHECK (length(updated_by) BETWEEN 1 AND 20)
);
-- 인덱스 없음: 조회·갱신 모두 PK(id = 1)
