// apps/studio-server/test/index-startup.test.ts — condition 5: the real
// process entry point fails fast with a clear message when MONGODB_URI or
// JWT_SECRET is missing. buildApp() itself is exempt (every other test in
// this package calls it directly, without a DB/secret, same as P1).

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function runIndexWithout(...missingVars: string[]) {
  const env = { ...process.env };
  for (const v of missingVars) delete env[v];
  return spawnSync('npx', ['tsx', 'src/index.ts'], {
    cwd: PACKAGE_DIR,
    env,
    timeout: 20_000,
    encoding: 'utf8',
  });
}

describe('index.ts startup', () => {
  it('exits non-zero with a clear message when MONGODB_URI is missing', () => {
    const result = runIndexWithout('MONGODB_URI');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/MONGODB_URI/);
  });

  it('exits non-zero with a clear message when JWT_SECRET is missing', () => {
    const result = runIndexWithout('JWT_SECRET');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/JWT_SECRET/);
  });
});
