// apps/web/test/db.test.ts
//
// T-30 acceptance tests 1-8 (see log/AREA-D-database-tier.md). Test 9 is a
// grep run outside vitest; test 10 is `npx vitest run` itself passing.
//
// Every test that varies DATABASE_URL imports lib/db.ts fresh via
// vi.resetModules() -- the module memoises a client on globalThis exactly
// like Next.js's dev hot-reload pattern, so tests must clear that stash
// themselves the same way a real reload would replace it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

// Points at a directory that cannot exist -- SQLite fails to open the file
// fast and deterministically (no network/DNS involved, so this is reliable
// even in a network-isolated sandbox). The locally generated Prisma client is
// SQLite (see apps/web/prisma/README.md), so a postgresql:// URL would only
// ever hit an instant provider-mismatch validation error rather than
// exercising a real "can't reach the database" path -- this does.
const BOGUS_DATABASE_URL = 'file:/nonexistent-t30-test-dir-dbd41f/dev.db';
// Resolved relative to apps/web/prisma/schema.generated.prisma at generate
// time (see apps/web/prisma/README.md); created by `npm run db:migrate`.
const LIVE_DATABASE_URL = 'file:./dev.db';

function globalStash(): PrismaClient | undefined {
  return (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

async function disconnectStash(): Promise<void> {
  const existing = globalStash();
  if (existing) await existing.$disconnect().catch(() => {});
  delete (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

/** Fresh import of lib/db.ts with no leaked client from a previous case. */
async function freshDb() {
  await disconnectStash();
  vi.resetModules();
  return import('../lib/db.js');
}

beforeEach(async () => {
  delete process.env.DATABASE_URL;
  await disconnectStash();
});

afterEach(async () => {
  await disconnectStash();
  delete process.env.DATABASE_URL;
  vi.doUnmock('../lib/log.js');
  vi.restoreAllMocks();
});

describe('T-30 db.ts', () => {
  it('1. getDb() returns null and does not throw when DATABASE_URL is unset', async () => {
    const { getDb } = await freshDb();
    expect(() => getDb()).not.toThrow();
    expect(getDb()).toBeNull();
  });

  it('2. withDb() resolves to null and does not throw when DATABASE_URL is unset', async () => {
    const { withDb } = await freshDb();
    const result = await withDb(async (db) => db.material.count());
    expect(result).toBeNull();
  });

  it(
    '3. withDb() resolves to null within 5s for a bogus DATABASE_URL',
    async () => {
      process.env.DATABASE_URL = BOGUS_DATABASE_URL;
      const { withDb } = await freshDb();
      const start = Date.now();
      const result = await withDb(async (db) => db.material.count());
      const elapsedMs = Date.now() - start;
      expect(result).toBeNull();
      expect(elapsedMs).toBeLessThan(5000);
      // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
      console.log(`T-30 test 3: withDb(bogus) resolved null in ${elapsedMs}ms`);
    },
    7000,
  );

  it('4. withDb() resolves to a number when DATABASE_URL is set correctly', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { withDb } = await freshDb();
    const result = await withDb(async (db) => db.material.count());
    expect(typeof result).toBe('number');
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(`T-30 test 4: withDb(live) material.count() = ${result}`);
  });

  it(
    '5. dbHealthy() is false unset, false within 3s bogus, true live',
    async () => {
      {
        const { dbHealthy } = await freshDb();
        expect(await dbHealthy()).toBe(false);
      }
      {
        process.env.DATABASE_URL = BOGUS_DATABASE_URL;
        const { dbHealthy } = await freshDb();
        const start = Date.now();
        const healthy = await dbHealthy();
        const elapsedMs = Date.now() - start;
        expect(healthy).toBe(false);
        expect(elapsedMs).toBeLessThan(3000);
        // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
        console.log(`T-30 test 5: dbHealthy(bogus) resolved false in ${elapsedMs}ms`);
      }
      {
        process.env.DATABASE_URL = LIVE_DATABASE_URL;
        const { dbHealthy } = await freshDb();
        expect(await dbHealthy()).toBe(true);
      }
    },
    7000,
  );

  it('6. getDb() called 100 times creates exactly one client (identity)', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { getDb } = await freshDb();
    const first = getDb();
    expect(first).not.toBeNull();
    for (let i = 0; i < 99; i++) {
      expect(getDb()).toBe(first);
    }
  });

  it('7. an error thrown inside withDb() is logged once and not re-thrown', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const logError = vi.fn();
    vi.doMock('../lib/log.js', () => ({ logError, logInfo: vi.fn() }));
    const { withDb } = await freshDb();

    const result = await withDb(async () => {
      throw new Error('boom');
    });

    expect(result).toBeNull();
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it('8. log.ts produces no output when NODE_ENV is production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    vi.resetModules();
    const { logError, logInfo } = await import('../lib/log.js');
    logError('should not print', new Error('x'));
    logInfo('should not print either');

    expect(errorSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    process.env.NODE_ENV = originalNodeEnv;
  });
});
