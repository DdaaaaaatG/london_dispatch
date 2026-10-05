/// <reference types="vitest/config" />
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 화면 빌드·개발 서버 설정.
// - base '/embed/': Worker 가 ui/dist 를 /embed 아래로 서빙한다 (doc/200_설계/server/index.md §3.2·§9.4)
// - dev: /api 를 wrangler dev(3000) 로 프록시한다 (CLAUDE.md §6)
// - test: jsdom, 화면 테스트는 @/api 래퍼를 vi.mock 으로 대체한다 (api.md §14)
export default defineConfig({
  base: '/embed/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@shared': path.resolve(import.meta.dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  test: {
    name: 'ui',
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./test-setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
