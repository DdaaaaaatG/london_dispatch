import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineProject } from 'vitest/config'

// server 워크스페이스 테스트 — workerd 안에서 D1 바인딩과 함께 실행한다.
// 설계: doc/200_설계/server/db.md §8 (마이그레이션은 test/apply-migrations.ts setup 파일이 적용)
// @cloudflare/vitest-pool-workers 0.22(vitest 4)부터 `./config`의 defineWorkersProject 대신
// 루트 export의 Vite 플러그인 `cloudflareTest` 를 쓴다.
const here = import.meta.dirname

export default defineProject(async () => {
  const migrations = await readD1Migrations(path.join(here, 'migrations'))
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations, TOKEN_SECRET: 'test-secret' },
        },
      }),
    ],
    resolve: {
      alias: { '@shared': path.resolve(here, '../shared/src') },
    },
    test: {
      name: 'server',
      include: ['test/**/*.test.ts'],
      setupFiles: ['./test/apply-migrations.ts'],
    },
  }
})
