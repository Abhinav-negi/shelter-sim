// apps/web/prisma/seed.ts
//
// T-34. Upserts every row of the code catalogue (@shelter/data MATERIALS)
// into the Material table, keyed by id -- idempotent, safe to re-run.
//
// Run directly with a real DATABASE_URL (this is an operator command, not a
// request-path call, so it uses PrismaClient directly rather than
// lib/db.ts's withDb(), which is for graceful degradation, not for a script
// whose entire job is to write to the database).
//
// LOG.md global rule 20: every material row must carry a non-empty `source`.
// Enforced HERE, at the point of writing, not trusted from the code
// catalogue -- validated in full before a single row is written, so a bad
// row aborts the whole seed rather than leaving a half-written table.

import { PrismaClient } from '@prisma/client';
import { MATERIALS, type Material } from '@shelter/data';

/**
 * Exported (not just inlined into main()) so a test can feed it a deliberately
 * broken row without touching the real code catalogue -- packages/data/src is
 * off-limits to this task even temporarily (see T-34 Evidence).
 */
export function validateSources(materials: readonly Pick<Material, 'id' | 'source'>[]): void {
  for (const m of materials) {
    if (!m.source || !m.source.trim()) {
      throw new Error(`db:seed: material "${m.id}" has an empty source -- LOG.md rule 20. Refusing to seed.`);
    }
  }
}

/** Upserts every material by id. Idempotent: same id twice updates, never duplicates. */
export async function seedMaterials(prisma: PrismaClient, materials: readonly Material[]): Promise<number> {
  validateSources(materials);
  for (const m of materials) {
    const { id, ...fields } = m;
    await prisma.material.upsert({
      where: { id },
      create: { id, ...fields },
      update: fields,
    });
  }
  return prisma.material.count();
}

// CLI entrypoint. Guarded so `import`ing this module (e.g. from a test) never
// runs it -- only `node prisma/seed.ts` does.
if (import.meta.url === `file://${process.argv[1]}`) {
  const prisma = new PrismaClient();
  seedMaterials(prisma, MATERIALS)
    .then((count) => {
      console.log(`db:seed: upserted ${MATERIALS.length} materials from the code catalogue, table now has ${count} rows.`);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
