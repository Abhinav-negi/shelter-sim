// apps/web/lib/repo/runs.ts
//
// The simulation-run cache. LOG.md CONTRACTS.md §7.12 (SimulationRun) / T-33.
//
// The eighteen-scenario survival grid and the design sweep re-ask the same
// questions constantly. A hash-keyed cache makes a repeat ask free.
//
// VERSION GATING IS THE WHOLE POINT OF THIS FILE: a row whose stored
// engineVersion differs from the running engine's is ALWAYS a miss, never a
// hit -- physics changes invalidate the cache, and serving a pre-fix number
// after a physics fix is the worst failure this whole project can have.
//
// Every function goes through withDb() (T-30) and degrades to a harmless
// no-op/miss with no database -- LOG.md global rule 18.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Prisma } from '@prisma/client';
import type { SimulationRequest, SimulationResult, SimulationKpis } from '@shelter/engine';
import { canonicalRequestHash, resultToJson, resultFromJson } from '@shelter/engine';
import { withDb } from '../db.js';

/**
 * The running engine's version, read from packages/engine/package.json at
 * module load time -- never hardcoded, per T-33's brief. Resolved by file
 * path (not a package import) so it is unaffected by @shelter/engine's
 * restrictive "exports" map.
 */
function readEngineVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, '../../../../packages/engine/package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
  return pkg.version;
}

export const ENGINE_VERSION: string = readEngineVersion();

// Prisma's `Json` column on SQLite loses precision on numbers that need the
// full 17 significant digits to round-trip exactly -- measured directly:
// 267.77519906129874 written and read back as 267.7751990612987 (last digit
// gone), independent of anything in this file or in @shelter/engine's own
// resultToJson/resultFromJson (packages/engine/test/serialise.test.ts's
// plain in-memory round trip is unaffected; this is specific to Prisma's
// SQLite JSON storage). A simulated run's timeseries is full of computed
// floats that legitimately need that last digit, so this cache must not
// silently truncate them. Fix: encode every number as a marked string before
// writing, decode it back on read -- SQLite's JSON formatter never
// reformats string content, so the original bits survive untouched.
// Built with fromCharCode rather than a literal escape so the source file
// itself stays plain ASCII text (a raw NUL byte in the file -- not just in
// the runtime string -- makes git and some editors treat it as binary).
const NUM_MARKER = String.fromCharCode(0) + 'n:';

function encodeNumbers(v: unknown): unknown {
  if (typeof v === 'number') return NUM_MARKER + v.toString();
  if (Array.isArray(v)) return v.map(encodeNumbers);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = encodeNumbers(val);
    return out;
  }
  return v;
}

function decodeNumbers(v: unknown): unknown {
  if (typeof v === 'string' && v.startsWith(NUM_MARKER)) return Number(v.slice(NUM_MARKER.length));
  if (Array.isArray(v)) return v.map(decodeNumbers);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = decodeNumbers(val);
    return out;
  }
  return v;
}

/** Marker appended to `meta.warnings` on every cache hit -- LOG.md rule 15 / T-33's brief. */
const SERVED_FROM_CACHE = 'served from cache';

/**
 * A cache read never changes the answer. `wallClockMs` from a hit is
 * meaningless (nothing was recomputed) and is left exactly as it was
 * written -- the caller already knows it came from cache from the marker
 * below, not from an altered number. Warnings about the *run* are still
 * valid on a hit; the only thing added is this literal marker, so the UI can
 * say so and a developer reading a residual knows where it came from.
 */
function markServedFromCache(meta: SimulationResult['meta']): SimulationResult['meta'] {
  return { ...meta, warnings: [...meta.warnings, SERVED_FROM_CACHE] };
}

export async function readRun(
  request: SimulationRequest,
): Promise<{ kpis: SimulationKpis; meta: SimulationResult['meta'] } | null> {
  const requestHash = canonicalRequestHash(request);
  return withDb(async (db) => {
    const row = await db.simulationRun.findUnique({ where: { requestHash } });
    if (!row) return null;
    // Version gate: a row from a different engine version is always a miss.
    if (row.engineVersion !== ENGINE_VERSION) return null;
    return {
      kpis: decodeNumbers(row.kpis) as unknown as SimulationKpis,
      meta: markServedFromCache(decodeNumbers(row.meta) as unknown as SimulationResult['meta']),
    };
  });
}

export async function readFullRun(request: SimulationRequest): Promise<SimulationResult | null> {
  const requestHash = canonicalRequestHash(request);
  return withDb(async (db) => {
    const row = await db.simulationRun.findUnique({ where: { requestHash } });
    if (!row || row.engineVersion !== ENGINE_VERSION || row.fullResult == null) return null;
    const result = resultFromJson(decodeNumbers(row.fullResult));
    return { ...result, meta: markServedFromCache(result.meta) };
  });
}

/**
 * `storeFull`. The KPI/meta rows are small (a few hundred bytes of JSON); a
 * full `SimulationResult` carries a per-timestep series for every surface and
 * is two to three orders of magnitude larger (measured in this task's
 * Evidence block, test 13). Store the full result only when the caller asks
 * for it -- the survival grid wants KPIs only, the main chart wants
 * everything.
 *
 * Upsert semantics (not create-then-catch): a duplicate `requestHash` is the
 * expected, common case (a repeat ask for the same scenario), not an error,
 * and upserting is also what keeps ten simultaneous writers of the same
 * request from tripping SQLite's single-writer lock into a hard failure
 * (acceptance test 12).
 */
export async function writeRun(
  request: SimulationRequest,
  result: SimulationResult,
  storeFull: boolean,
): Promise<void> {
  const requestHash = canonicalRequestHash(request);
  const kpis = encodeNumbers(result.kpis) as Prisma.InputJsonValue;
  const meta = encodeNumbers(result.meta) as Prisma.InputJsonValue;
  // Only ever produced (and only ever written) when the caller asks; when a
  // later write for the same request doesn't ask for it, the field is simply
  // left out of `update` below so a previously-cached full result is not
  // discarded by a cheaper follow-up write.
  const fullResult = storeFull
    ? (encodeNumbers(resultToJson(result)) as Prisma.InputJsonValue)
    : undefined;

  await withDb(async (db) => {
    await db.simulationRun.upsert({
      where: { requestHash },
      create: {
        requestHash,
        kpis,
        meta,
        engineVersion: ENGINE_VERSION,
        ...(fullResult !== undefined ? { fullResult } : {}),
      },
      update: {
        kpis,
        meta,
        engineVersion: ENGINE_VERSION,
        computedAt: new Date(),
        ...(fullResult !== undefined ? { fullResult } : {}),
      },
    });
  });
}

export async function purgeRunsForOtherVersions(): Promise<number> {
  const removed = await withDb(async (db) => {
    const { count } = await db.simulationRun.deleteMany({
      where: { engineVersion: { not: ENGINE_VERSION } },
    });
    return count;
  });
  return removed ?? 0;
}
