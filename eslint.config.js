// ESLint flat config — TypeScript + React Hooks. 규칙 출처: .claude/skills/ts-rules.md · tsx-rules.md
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.wrangler/**',
      'server/worker-configuration.d.ts',
      'doc/**',
      '.claude/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'prefer-const': 'error',
      'no-var': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // 화면: 브라우저 전역 + Hook 규칙. fetch 직접 사용은 ui/src/api 안에서만 (api.md §2)
    files: ['ui/src/**/*.ts', 'ui/src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // 테스트 하네스는 훅 반환값(ref 포함)을 렌더에서 그대로 전달한다 — react-hooks/refs(React Compiler 규칙)가 오탐
    files: ['ui/src/**/*.test.tsx'],
    rules: { 'react-hooks/refs': 'off' },
  },
  {
    files: ['ui/src/**/*.ts', 'ui/src/**/*.tsx'],
    ignores: ['ui/src/api/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: '화면은 @/api 래퍼만 호출한다 (api.md §2).' },
      ],
    },
  },
  {
    // 서버: Workers 런타임. process.env 는 env.ts 에서도 쓰지 않는다(바인딩 파싱) — 훅이 별도 차단
    files: ['server/**/*.ts'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  {
    files: ['**/*.config.ts', '**/*.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
)
