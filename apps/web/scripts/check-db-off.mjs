#!/usr/bin/env node
// apps/web/scripts/check-db-off.mjs
//
// T-35 -- a human runs this before a demo to confirm the app still works
// with no database, per LOG.md global rule 18 ("the database is a cache and
// a share layer, never a dependency. Every feature on the demo path must
// work with the database stopped.").
//
// T-35's own PROMPT says "boot the app, hit the main page". As of this task
// there is no Next.js app to boot yet -- apps/web has no app/ directory, no
// `next` dependency and no dev/build/start script (Area F / T-36 is 0/11,
// not started). "The main page" does not exist. Adapted to present reality:
// this unsets DATABASE_URL and runs the DATABASE_URL-unset half of
// apps/web/test/db-off.integration.test.ts (the "unset" describe block),
// which is the real six-exercise DB-off matrix -- listMaterials, tmyById +
// simulate, weather cache, designs, run cache, and the eighteen-scenario
// matrix -- with the same 5-second-per-call / zero-exception hard rule this
// task's acceptance tests 4 and 5 require. Reusing that suite rather than
// re-deriving a second, less-trusted check is deliberate: one proof, one
// place. Once T-36 ships a real page this script should be extended (or
// replaced) to also boot the server and hit it with a real HTTP request.
//
// Usage: node apps/web/scripts/check-db-off.mjs
// Exits 0 and prints one PASS line on success; exits 1 and prints one FAIL
// line (plus the suite's own output, for debugging) on failure.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..'); // apps/web/scripts -> apps/web -> apps -> repo root
const testFile = join(here, '..', 'test', 'db-off.integration.test.ts');

// Defensive: guarantee the mode this script claims to check, regardless of
// whatever the caller's shell happened to have set.
const env = { ...process.env };
delete env.DATABASE_URL;

const start = Date.now();
// "DATABASE_URL absent" is this test file's exact describe-block title for
// the unset mode and appears nowhere else in the file (unlike the bare word
// "unset", which also matches two cross-mode comparison tests further down
// that need all three modes' reports and would fail when run alone).
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vitest', 'run', testFile, '-t', 'DATABASE_URL absent'],
  {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  },
);
const elapsedMs = Date.now() - start;

if (result.status === 0) {
  console.log(`PASS -- db-off mode (DATABASE_URL unset): six-exercise matrix green in ${elapsedMs}ms`);
  process.exit(0);
} else {
  console.log(`FAIL -- db-off mode (DATABASE_URL unset): suite failed after ${elapsedMs}ms (exit ${result.status})`);
  console.log('--- vitest output, for debugging ---');
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  process.exit(1);
}
