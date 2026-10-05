import { defineProject } from 'vitest/config'

// shared 워크스페이스 테스트(순수 TS). 루트 vitest.config.ts의 projects로 묶인다.
export default defineProject({
  test: {
    name: 'shared',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
})
