-- 0005_room_password.sql — 방 비밀번호 잠금 (R-LOCK-001·007·009 · R-DB-001 개정). 설계 doc/200_설계/server/db.md §15
-- pass_hash: NULL = 잠기지 않음. 값 = 'pbkdf2-sha256$<반복 수>$<salt>$<유도값>'(server/src/rooms/password.ts). 비밀번호 원문은 어디에도 저장하지 않는다
-- 기존 방은 NULL(잠기지 않음)로 남는다. 이관 없음. 인덱스 없음(PK 조회뿐)
-- 되돌리기 경고: 이 마이그레이션 뒤 이전 코드로 되돌리면 이전 코드는 이 칸을 모르므로 잠긴 방이 모두 열린다. DROP COLUMN 금지
ALTER TABLE rooms ADD COLUMN pass_hash TEXT
  CHECK (pass_hash IS NULL OR length(pass_hash) BETWEEN 20 AND 200);
