// apps/web/lib/repo/designs.ts
//
// T-32: design snapshots and share links -- the "OR get a link" half of
// "designs download as files OR get a link" (log/AREA-D-database-tier.md).
//
// DB-OFF CONTRACT (LOG.md global rule 18): this is a share layer, never a
// dependency. Every call goes through lib/db.ts's withDb(), which already
// collapses "no DATABASE_URL", "unreachable database" and "query threw" into
// a single null (see db.ts's own header comment) -- that is exactly the
// "unknown id / expired id / no database are the same to a caller" contract
// this file's own PROMPT asks for, so loadDesign does not need to special-case
// any of the three itself.

import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  EngineError,
  requestFromJson,
  requestToJson,
  type SimulationRequest,
} from '@shelter/engine';
import { withDb } from '../db.js';
import { logError } from '../log.js';

// Base32-SIZED alphabet (32 symbols = 2^5), with the ambiguous characters
// removed: no 0/O, no 1/l/I. Because the size is exactly a power of two, the
// low 5 bits of a random byte map onto it with NO modulo bias and no
// rejection sampling needed -- simplest possible unbiased generator.
const SHARE_ID_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
// 10 chars * log2(32) = 50 bits of entropy. State the reasoning (T-32 prompt).
const SHARE_ID_LENGTH = 10;
// Collision handling: retry up to 5 times on a unique-constraint violation,
// then give up (T-32 prompt).
const MAX_SHARE_ID_ATTEMPTS = 5;

function generateShareId(): string {
  const bytes = randomBytes(SHARE_ID_LENGTH);
  let id = '';
  for (let i = 0; i < SHARE_ID_LENGTH; i++) {
    id += SHARE_ID_ALPHABET[bytes[i]! & 0x1f];
  }
  return id;
}

function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * Validates `request` through T-06's requestFromJson BEFORE writing -- a
 * malformed request must never reach the table, because loadDesign would
 * then hand a broken design to the engine. Returns the JSON form to store
 * (via requestToJson) on success, or null on a schema mismatch.
 *
 * CHOICE (T-32 acceptance test 6 offers either behaviour): this returns null
 * rather than letting EngineError('DATA_SCHEMA_MISMATCH') propagate, so
 * saveDesign's return type stays a plain `{ shareId } | null` with no
 * separate throw path for callers to handle -- consistent with db.ts's own
 * "a bad outcome is null, never a thrown error" convention.
 */
function toValidatedJson(request: SimulationRequest): unknown | null {
  try {
    const json = requestToJson(request);
    requestFromJson(json); // throws EngineError('DATA_SCHEMA_MISMATCH') on malformed input
    return json;
  } catch (err) {
    if (err instanceof EngineError) {
      logError('saveDesign: request failed schema validation, not written', err);
      return null;
    }
    throw err;
  }
}

export async function saveDesign(
  request: SimulationRequest,
  label?: string,
): Promise<{ shareId: string } | null> {
  const json = toValidatedJson(request);
  if (json === null) return null;

  return withDb(async (db) => {
    for (let attempt = 0; attempt < MAX_SHARE_ID_ATTEMPTS; attempt++) {
      const shareId = generateShareId();
      try {
        await db.designSnapshot.create({
          data: { shareId, request: json as Prisma.InputJsonValue, label: label ?? null },
        });
        return { shareId };
      } catch (err) {
        if (isUniqueConstraintViolation(err)) continue; // regenerate and retry
        throw err; // withDb's own catch logs it once and resolves null
      }
    }
    return null; // exhausted MAX_SHARE_ID_ATTEMPTS
  });
}

export async function loadDesign(shareId: string): Promise<SimulationRequest | null> {
  const row = await withDb(async (db) => db.designSnapshot.findUnique({ where: { shareId } }));
  // Unknown id, expired id, and no database all collapse to null here: `row`
  // is already null for "no db" (withDb) and "unknown id" (findUnique), and
  // the expiry check below folds "expired" into the same return.
  if (!row) return null;
  if (row.expiresAt !== null && row.expiresAt.getTime() <= Date.now()) return null;

  try {
    return requestFromJson(row.request);
  } catch (err) {
    // A schema change since the row was saved. Never hand a half-built
    // object to the engine -- log once and treat it exactly like a miss.
    logError('loadDesign: stored request failed schema validation', err);
    return null;
  }
}

/** No cleanup job exists yet (T-32 scope); this is what it will call. */
export async function purgeExpiredDesigns(): Promise<number> {
  const result = await withDb(async (db) =>
    db.designSnapshot.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
  );
  return result?.count ?? 0;
}
