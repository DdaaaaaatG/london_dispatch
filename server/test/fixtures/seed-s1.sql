-- seed-s1.sql — S1 읽기 전용 화면 확인용 로컬 시드. 운영(--remote) 적용 금지.
-- 주의: 아래 DELETE 가 로컬 D1(server/.wrangler/)의 기존 방·메시지·장기기억을 모두 지운다.
-- 적용: (server/ 에서) npx wrangler d1 execute DB --local --file=test/fixtures/seed-s1.sql
-- 시각 기준 1767225600000 = 2026-01-01T00:00:00Z
DELETE FROM memory;
DELETE FROM messages;
DELETE FROM rooms;

INSERT INTO rooms (id, title, created_at, updated_at, speaking_until) VALUES
  ('00000000-0000-4000-8000-000000000001', '안개 낀 런던의 아침', 1767225600000, 1767229800000, NULL),
  ('00000000-0000-4000-8000-000000000002', '팬텀하이브 저택의 저녁', 1767225600000, 1767226800000, NULL),
  ('00000000-0000-4000-8000-000000000003', '아직 아무도 없는 방', 1767225600000, 1767225600000, NULL);

-- 방 1: 70건(4종 순환 — 세바스찬 · 시엘 · 유저 발화 · 유저 지시)
INSERT INTO messages (room_id, speaker, kind, text, author_mb_id, author_name, created_at)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 70)
SELECT '00000000-0000-4000-8000-000000000001',
       CASE n % 4 WHEN 1 THEN 'sebastian' WHEN 2 THEN 'ciel' ELSE 'user' END,
       CASE n % 4 WHEN 0 THEN 'ooc' ELSE 'line' END,
       CASE n % 4
         WHEN 1 THEN '도련님, 홍차를 준비해 두었습니다. (' || n || ')'
         WHEN 2 THEN '늦었군, 세바스찬. 오늘 일정부터 말해. (' || n || ')'
         WHEN 3 THEN '창밖으로 안개가 한층 짙어진다. (' || n || ')'
         ELSE '분위기를 조금 더 어둡게 이어 가 줘. (' || n || ')'
       END,
       CASE WHEN n % 4 IN (0, 3) THEN 'seed_user' END,
       CASE WHEN n % 4 IN (0, 3) THEN '시드 유저' END,
       1767225600000 + n * 60000
FROM seq;

-- 방 2: 2건
INSERT INTO messages (room_id, speaker, kind, text, author_mb_id, author_name, created_at) VALUES
  ('00000000-0000-4000-8000-000000000002', 'ciel', 'line', '오늘 저녁은 조용히 보내고 싶군.', NULL, NULL, 1767226740000),
  ('00000000-0000-4000-8000-000000000002', 'sebastian', 'line', '분부대로, 도련님.', NULL, NULL, 1767226800000);
