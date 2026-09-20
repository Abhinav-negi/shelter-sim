'use strict';

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
// eslint-config-next (Next 16, root node_modules via workspace hoisting from
// apps/web/package.json -- already an approved dependency, CONTRACTS.md
// 7.13) ships a native flat-config export at its "." entry point: an array
// of Linter.Config objects, no @eslint/eslintrc / FlatCompat shim needed.
// (Confirmed: @eslint/eslintrc is not installed anywhere in this tree --
// `npm ls @eslint/eslintrc` -> empty -- so FlatCompat was never an option
// here, and wasn't needed anyway.)
const nextConfig = require('eslint-config-next');

// LOG.md global rules 4 and 17: the engine (packages/**) is a pure package
// with zero runtime dependencies -- no React, no Prisma, no Next.
const BOUNDARY_REASON =
  'packages/** must stay pure: no React, no Prisma, no Next. LOG.md global rules 17 and 4.';

// T-72: eslint-config-next's own blocks ship with repo-wide `files` globs
// (e.g. `**/*.{js,jsx,...}`) because it assumes it runs from inside a single
// Next app, not a monorepo root. Re-scope every file-matching block to
// apps/web only, so it can never leak onto packages/** and weaken/replace
// the boundary rules above. Ignore-only blocks (build output dirs) are
// re-rooted under apps/web/ the same way.
const APPS_WEB_GLOB = 'apps/web/**/*.{ts,tsx}';
// eslint-plugin-react (nested under eslint-config-next) ships settings.react.version:
// 'detect', which calls context.getFilename() to locate node_modules/react and read its
// version. That method does not exist on ESLint 10's rule context object (verified: it
// throws "contextOrFilename.getFilename is not a function" from eslint-plugin-react's own
// version.js, crashing every apps/web lint run) -- an upstream eslint-config-next /
// eslint-plugin-react incompatibility with this installed ESLint version, not a config
// mistake here. Pinning the version explicitly (read from the installed react package, the
// same one apps/web/package.json depends on) skips the broken detection call entirely and
// needs no new dependency and no node_modules edit.
const REACT_VERSION = require('react/package.json').version;
const nextConfigForWeb = nextConfig.map((block) => {
  const scoped = block.files ? { ...block, files: [APPS_WEB_GLOB] } : { ...block };
  if (scoped.ignores && !scoped.files) {
    scoped.ignores = scoped.ignores.map((pattern) => `apps/web/${pattern}`);
  }
  if (scoped.settings && scoped.settings.react) {
    scoped.settings = {
      ...scoped.settings,
      react: { ...scoped.settings.react, version: REACT_VERSION },
    };
  }
  return scoped;
});

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
    files: ['packages/engine/test/**/*.ts', 'packages/data/test/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  // T-72: apps/web/**, scoped copy of eslint-config-next's flat config (see above).
  ...nextConfigForWeb,
  {
    // apps/web/test/** and a couple of lib files carry pre-existing
    // `// eslint-disable-next-line no-console` comments (added before this task wired lint
    // into apps/web at all). no-console is a packages/**-only rule (LOG.md rule 17 / T-03
    // item 3) and is not part of eslint-config-next's ruleset, so ESLint's default
    // reportUnusedDisableDirectives now flags every one of those comments as unused across
    // ~15 files. Turning that check off here (apps/web/** only) avoids mass-editing those
    // files to strip harmless leftover comments, per this task's own scoping instruction;
    // it does not disable any actual rule or hide a real violation.
    files: [APPS_WEB_GLOB],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
];
