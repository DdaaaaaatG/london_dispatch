// 테스트 전용 바인딩 타입. 운영 Env(src/env.ts)에는 TEST_MIGRATIONS 가 없다
/// <reference types="@cloudflare/vitest-pool-workers/types" />
import type { D1Migration } from 'cloudflare:test'

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database
      ASSETS: Fetcher
      TOKEN_SECRET: string
      TEST_MIGRATIONS: D1Migration[]
    }
  }
}
