import path from 'node:path'
import { defineWorkersProject, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'

// server 워크스페이스 테스트 — workerd 안에서 D1 바인딩과 함께 실행한다.
// 설계: doc/200_설계/server/db.md §8 (마이그레이션은 test/apply-migrations.ts setup 파일이 적용)
export default defineWorkersProject(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'))
  return {
    resolve: {
      alias: { '@shared': path.resolve(__dirname, '../shared/src') },
    },
    test: {
      name: 'server',
      include: ['test/**/*.test.ts'],
      setupFiles: ['./test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            bindings: { TEST_MIGRATIONS: migrations, TOKEN_SECRET: 'test-secret' },
          },
        },
      },
    },
  }
})
