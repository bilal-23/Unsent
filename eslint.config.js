import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    // Layering: UI never touches IndexedDB directly (PRD §7.2). Only db/, repositories/ and services/ may.
    files: ['src/{app,components,features,hooks,lib,domain,i18n}/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/lib/zod.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'dexie', message: 'Use the repository layer (src/repositories) instead of Dexie.' },
            { name: 'zod', message: "Import z from 'src/lib/zod' so the CSP-safe config applies." },
          ],
          patterns: [{ group: ['**/db/database', '**/db/schema', '**/db/encryption'], message: 'Use the repository layer instead.' }],
        },
      ],
    },
  },
  {
    files: ['src/services/**/*.ts', 'src/repositories/**/*.ts', 'src/db/**/*.ts'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: 'zod', message: "Import z from 'src/lib/zod' so the CSP-safe config applies." }] }],
    },
  },
  {
    files: ['src/test/**', 'src/**/*.test.{ts,tsx}', 'tests/**', 'scripts/**', '*.config.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
