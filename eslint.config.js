'use strict';

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

// LOG.md global rules 4 and 17: the engine (packages/**) is a pure package
// with zero runtime dependencies -- no React, no Prisma, no Next.
const BOUNDARY_REASON =
  'packages/** must stay pure: no React, no Prisma, no Next. LOG.md global rules 17 and 4.';

module.exports = [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.d.ts'],
  },
  {
    files: ['packages/**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: BOUNDARY_REASON },
            { name: 'react-dom', message: BOUNDARY_REASON },
            { name: '@prisma/client', message: BOUNDARY_REASON },
            { name: 'prisma', message: BOUNDARY_REASON },
            { name: 'next', message: BOUNDARY_REASON },
          ],
          patterns: [
            { group: ['react/*'], message: BOUNDARY_REASON },
            { group: ['next/*'], message: BOUNDARY_REASON },
          ],
        },
      ],
      'no-console': 'error',
    },
  },
  {
    // The engine has no logger by design -- everything it wants to say comes
    // back in the return value or an EngineError. Tests legitimately print
    // measured numbers, which the ledger depends on.
    files: ['packages/engine/test/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
