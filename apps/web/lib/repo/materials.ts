// apps/web/lib/repo/materials.ts
//
// T-34. The material catalogue is served from the database when there is one,
// and from the code catalogue (@shelter/data) when there is not. The code
// catalogue is always the source of truth (LOG.md §9); the database is a
// served copy so the browser does not ship the whole thing in its bundle.
//
// LOG.md global rule 18: the database is a cache and a share layer, never a
// dependency. Every call here goes through lib/db.ts's withDb(), which
// already resolves to null -- never throws, never hangs past its own
// internal error path -- for "no DATABASE_URL" and "database unreachable"
// alike. See apps/web/test/db.test.ts T-30 test 3: a bad DATABASE_URL
// resolves null well under 5s, so no extra timeout is needed in this file.

import type { PrismaClient } from '@prisma/client';
import { MATERIALS, type Material } from '@shelter/data';
import { withDb } from '../db.js';
import { logError } from '../log.js';

type MaterialRow = Awaited<ReturnType<PrismaClient['material']['findMany']>>[number];

/**
 * Prisma's nullable columns come back as `null`; Material's optional fields
 * want the key omitted entirely, not set to `undefined` --
 * `exactOptionalPropertyTypes` (tsconfig.base.json) treats those as different.
 */
function rowToMaterial(row: MaterialRow): Material {
  return {
    id: row.id,
    name: row.name,
    ...(row.nameHi !== null && { nameHi: row.nameHi }),
    category: row.category as Material['category'],
    k: row.k,
    rho: row.rho,
    c: row.c,
    alphaSolar: row.alphaSolar,
    emissivity: row.emissivity,
    ...(row.costPerM3 !== null && { costPerM3: row.costPerM3 }),
    locallyAvailableLadakh: row.locallyAvailableLadakh,
    ...(row.embodiedCarbon !== null && { embodiedCarbon: row.embodiedCarbon }),
    source: row.source,
    ...(row.blurb !== null && { blurb: row.blurb }),
  };
}

// Logged at most once per process -- "on the first call" per the T-34 prompt.
let stalenessChecked = false;

function warnIfStale(rowCount: number): void {
  if (stalenessChecked) return;
  stalenessChecked = true;
  if (rowCount !== MATERIALS.length) {
    logError(
      `listMaterials: database has ${rowCount} material rows, code catalogue has ${MATERIALS.length} -- seed is stale, run npm run db:seed (still serving the database rows)`,
    );
  }
}

export async function listMaterials(): Promise<Material[]> {
  const rows = await withDb((db) => db.material.findMany());

  // THE MOST IMPORTANT LINE IN THIS FILE: with no database (unset DATABASE_URL,
  // or one that is unreachable), withDb() resolves to null and we fall back to
  // the code catalogue -- not an empty array, not an error. This fallback is
  // the entire reason the material list still renders offline.
  if (rows === null) return [...MATERIALS];

  warnIfStale(rows.length);
  return rows.map(rowToMaterial);
}

export async function getMaterial(id: string): Promise<Material | null> {
  const row = await withDb((db) => db.material.findUnique({ where: { id } }));

  // withDb() also returns null when the id is legitimately absent from a live
  // database, so this fallback covers both "no database" and "not found" --
  // and the code catalogue gives the correct answer (null) in the second case
  // too, since a seeded id that is missing from the DB is also a real id in
  // the catalogue only if the seed is stale, which is a warning, not this call's
  // problem.
  if (row === null) return MATERIALS.find((m) => m.id === id) ?? null;
  return rowToMaterial(row);
}
