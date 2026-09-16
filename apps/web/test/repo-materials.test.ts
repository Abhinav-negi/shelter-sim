// apps/web/test/repo-materials.test.ts
//
// T-34 acceptance tests (see log/AREA-D-database-tier.md). Tests 1-3 are run
// directly via `npm run db:seed` -- paste-the-numbers evidence, not something
// a unit test spawns -- and pasted into T-34's Evidence block. Test 4 (the
// source-citation rule enforced at write time) is exercised here via
// `validateSources`, exported from prisma/seed.ts for exactly this reason:
// packages/data/src is off-limits to this task, even temporarily, so a test
// cannot blank a real material's source on disk to prove it. Test 10 is
// `npx vitest run` itself passing.
//
// Same freshDb()-with-vi.resetModules() pattern as apps/web/test/db.test.ts
// (T-30): lib/db.ts memoises a client on globalThis, so each case that varies
// DATABASE_URL must clear that stash and re-import, same as a real reload would.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { MATERIALS } from '@shelter/data';
import { validateSources, seedMaterials } from '../prisma/seed.js';

// See apps/web/test/db.test.ts for why these two forms of "bad database" are
// used: a nonexistent directory fails fast and deterministically (no
// network/DNS), and is what the locally generated SQLite client actually hits.
const BOGUS_DATABASE_URL = 'file:/nonexistent-t34-test-dir-dbd41f/dev.db';
const LIVE_DATABASE_URL = 'file:./dev.db';

function globalStash(): PrismaClient | undefined {
  return (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

async function disconnectStash(): Promise<void> {
  const existing = globalStash();
  if (existing) await existing.$disconnect().catch(() => {});
  delete (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

/** Fresh import of lib/repo/materials.ts with no leaked client or stale-check flag. */
async function freshRepo() {
  await disconnectStash();
  vi.resetModules();
  return import('../lib/repo/materials.js');
}

beforeEach(async () => {
  delete process.env.DATABASE_URL;
  await disconnectStash();
});

afterEach(async () => {
  await disconnectStash();
  delete process.env.DATABASE_URL;
  vi.restoreAllMocks();
});

describe('T-34 prisma/seed.ts validateSources', () => {
  it('4. throws naming the offending id when a source is blank, leaves the rest alone', () => {
    const materials = [
      { id: 'mudBrickAdobe', source: 'IS 3792:1978, Table 1' },
      { id: 'rammedEarth', source: '' },
      { id: 'stoneMasonryGranite', source: 'ASHRAE Ch. 26 Table 4' },
    ];
    expect(() => validateSources(materials)).toThrow(/rammedEarth/);
    expect(() => validateSources(materials)).toThrow(/empty source/);
  });

  it('4b. does not throw when every source is non-empty', () => {
    expect(() => validateSources(MATERIALS)).not.toThrow();
  });
});

describe('T-34 lib/repo/materials.ts', () => {
  it('5. listMaterials() live returns MATERIALS.length rows, each with a non-empty source', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { listMaterials } = await freshRepo();
    const rows = await listMaterials();
    expect(rows.length).toBe(MATERIALS.length);
    for (const r of rows) expect(r.source.trim().length).toBeGreaterThan(0);
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(`T-34 test 5: listMaterials(live) returned ${rows.length} rows, all with non-empty source`);
  });

  it('6. DB OFF: listMaterials() returns the code catalogue, same length and ids', async () => {
    delete process.env.DATABASE_URL;
    const { listMaterials } = await freshRepo();
    const rows = await listMaterials();
    expect(rows.length).toBe(MATERIALS.length);
    expect(rows.map((r) => r.id).sort()).toEqual(MATERIALS.map((m) => m.id).sort());
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(`T-34 test 6: listMaterials(DB off) returned ${rows.length} rows, ids match the code catalogue`);
  });

  it(
    '7. DB UNREACHABLE: listMaterials() falls back to the code catalogue within 5s',
    async () => {
      process.env.DATABASE_URL = BOGUS_DATABASE_URL;
      const { listMaterials } = await freshRepo();
      const start = Date.now();
      const rows = await listMaterials();
      const elapsedMs = Date.now() - start;
      expect(rows.length).toBe(MATERIALS.length);
      expect(elapsedMs).toBeLessThan(5000);
      // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
      console.log(`T-34 test 7: listMaterials(unreachable) fell back in ${elapsedMs}ms`);
    },
    7000,
  );

  it('8. getMaterial("nope") returns null in all three modes', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    {
      const { getMaterial } = await freshRepo();
      expect(await getMaterial('nope')).toBeNull();
    }
    delete process.env.DATABASE_URL;
    {
      const { getMaterial } = await freshRepo();
      expect(await getMaterial('nope')).toBeNull();
    }
    process.env.DATABASE_URL = BOGUS_DATABASE_URL;
    {
      const { getMaterial } = await freshRepo();
      expect(await getMaterial('nope')).toBeNull();
    }
  });

  it('9. a partially-deleted table logs a staleness warning but still returns what it has, without throwing', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const all = await prisma.material.findMany({ orderBy: { id: 'asc' } });
      const toDelete = all.slice(0, Math.floor(all.length / 2)).map((m) => m.id);
      await prisma.material.deleteMany({ where: { id: { in: toDelete } } });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { listMaterials } = await freshRepo();
      const rows = await listMaterials();

      expect(rows.length).toBe(all.length - toDelete.length);
      expect(errorSpy).toHaveBeenCalled();
      const loggedStaleness = errorSpy.mock.calls.some((args) => String(args[0]).includes('stale'));
      expect(loggedStaleness).toBe(true);
      // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
      console.log(
        `T-34 test 9: after deleting ${toDelete.length} rows, listMaterials() returned ${rows.length} without throwing, staleness warning logged: ${loggedStaleness}`,
      );
    } finally {
      // Restore the table to full strength via the real seed path so later
      // tests/evidence in this file and elsewhere see the intended 27 rows.
      await seedMaterials(prisma, MATERIALS);
      await prisma.$disconnect();
    }
  });
});
