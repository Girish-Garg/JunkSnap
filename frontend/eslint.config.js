import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// docs/working.md section 4: file limits skip blanks and comments; function limits measure the span.
const fileLimit = (max) => ['error', { max, skipBlankLines: true, skipComments: true }];

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      'max-lines': fileLimit(250),
      'max-lines-per-function': ['error', { max: 30 }],
      complexity: ['error', 8],
      'max-params': ['error', 4],
      'max-depth': ['error', 3],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.tsx'],
    rules: { 'max-lines': fileLimit(150) },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: { 'max-lines': fileLimit(400) },
  },
]);
