import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-constant-condition': 'warn',
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'runs/',
      'test-results/',
      'playwright-report/',
      'blob-report/',
      'iphone-catalog/node_modules/',
      'iphone-catalog/dist/',
    ],
  },
];
