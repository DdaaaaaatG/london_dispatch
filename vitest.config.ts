import { defineConfig } from 'vitest/config'

// 루트: 세 워크스페이스를 projects 로 묶는다.
//   npm test                → 전체
//   npx vitest run --project server | ui | shared → 범위 지정 (/test 명령)
// server 프로젝트는 @cloudflare/vitest-pool-workers(workerd + D1) 로 돈다 — server/vitest.config.ts 참조.
export default defineConfig({
  test: {
    projects: ['shared', 'server', 'ui'],
  },
})
