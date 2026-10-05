// 테스트 setup: 각 테스트 파일 시작 전에 D1 마이그레이션을 적용한다 (db.md §8)
import { applyD1Migrations, env } from 'cloudflare:test'

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
