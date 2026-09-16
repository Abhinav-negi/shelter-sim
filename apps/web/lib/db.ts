// apps/web/lib/db.ts
//
// DB-OFF CONTRACT: the database is a cache and a share layer, never a
// dependency. Every feature on the demo path must work with this returning
// null. A null check here that escalates into a thrown error is always a
// bug, no matter how it is spelled -- treat a missing database exactly like
// a cache miss, not a failure.
//
// LOG.md global rule 18. Every repository (T-31 onward) calls withDb() --
// never `new PrismaClient()` directly -- so this is the one place "the
// database is not there" is a normal condition rather than an error.

import { PrismaClient } from '@prisma/client';
import { logError } from './log.js';

/** dbHealthy()'s query budget. LOG.md rule 14: named constant, not a magic number. */
const HEALTH_CHECK_TIMEOUT_MS = 2000;

declare global {
  // eslint-disable-next-line no-var -- required shape for globalThis augmentation.
  var __sheltersimDb: PrismaClient | undefined;
}

// Module-scope fallback used in production, where the process is not
// hot-reloaded and a plain module-scope singleton is enough on its own.
let prodClient: PrismaClient | undefined;

function memoizedClient(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    if (!prodClient) prodClient = new PrismaClient();
    return prodClient;
  }
  // Next.js dev-mode hot reload re-evaluates this module on every edit; stash
  // the client on globalThis so a reload reuses the same instance instead of
  // leaking a new connection pool each time. Standard Next.js + Prisma pattern.
  if (!globalThis.__sheltersimDb) {
    globalThis.__sheltersimDb = new PrismaClient();
  }
  return globalThis.__sheltersimDb;
}

/** null when DATABASE_URL is unset or the database is unreachable. Callers MUST handle null. */
export function getDb(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  try {
    return memoizedClient();
  } catch (err) {
    logError('getDb: failed to construct PrismaClient', err);
    return null;
  }
}

/**
 * The only call shape repositories use. Returns null when there is no
 * database, and catches every database error, logs it once, and returns null
 * rather than propagating -- a cache miss and a dead database are the same
 * thing to a caller. That equivalence is the whole design.
 */
export async function withDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T | null> {
  const db = getDb();
  if (!db) return null;
  try {
    return await fn(db);
  } catch (err) {
    logError('withDb: database operation failed', err);
    return null;
  }
}

/** Runs a trivial query with a 2-second timeout. Never throws. */
export async function dbHealthy(): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const check = (async () => {
    try {
      await db.$queryRaw`SELECT 1`;
      return true;
    } catch (err) {
      logError('dbHealthy: query failed', err);
      return false;
    }
  })();
  const timeout = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), HEALTH_CHECK_TIMEOUT_MS);
  });
  return Promise.race([check, timeout]);
}
