-- 0004_llm_model.sql — 주인이 고른 AI 모델 키 (R-SET-003 개정 · R-SET-013 · R-LLM-009). 설계 doc/200_설계/server/db.md §14
-- 키('pro'·'flash')만 저장한다. 실제 모델명은 server/src/llm/models.ts 상수표에만 있다
-- 키 목록은 CHECK 에 박지 않는다(코드 LLM_MODEL_KEYS 가 판정 — 키를 빼도 마이그레이션 불필요, 표 밖 값은 env 폴백)
-- NULL = 고른 적 없음 → env LLM_MODEL. 기존 행은 NULL 로 남는다(본체·version 보존)
ALTER TABLE character_settings ADD COLUMN llm_model TEXT
  CHECK (llm_model IS NULL OR length(llm_model) BETWEEN 1 AND 20);
