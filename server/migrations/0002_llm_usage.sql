-- 0002_llm_usage.sql — 월 AI 사용량 누적 (R-LLM-007). 설계 doc/200_설계/server/db.md §2.4·§7.5
-- month 는 KST 'YYYY-MM'(llm 모듈이 계산). 시각은 epoch ms INTEGER(R-DB-001 규칙)
CREATE TABLE IF NOT EXISTS llm_usage (
  month          TEXT    PRIMARY KEY
                         CHECK (length(month) = 7 AND month GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'),
  calls          INTEGER NOT NULL CHECK (calls >= 1),
  prompt_tokens  INTEGER NOT NULL CHECK (prompt_tokens >= 0),
  output_tokens  INTEGER NOT NULL CHECK (output_tokens >= 0),
  est_krw        REAL    NOT NULL CHECK (est_krw >= 0),
  updated_at     INTEGER NOT NULL
);
-- 인덱스 없음: 조회·갱신 모두 PK(month)
