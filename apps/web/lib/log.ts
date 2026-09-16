// apps/web/lib/log.ts
//
// The only logging in this repository (CONTRACTS.md §7.8 -- packages/** has
// none by design; the engine is pure and prints nothing). This wrapper is a
// no-op in production and writes to the console in development, so a local
// dev session sees what happened without shipping a logger to prod.

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function logError(message: string, error?: unknown): void {
  if (isProduction()) return;
  // eslint-disable-next-line no-console -- this file is the one sanctioned logger.
  console.error(`[shelter-sim] ${message}`, error);
}

export function logInfo(message: string): void {
  if (isProduction()) return;
  // eslint-disable-next-line no-console -- this file is the one sanctioned logger.
  console.info(`[shelter-sim] ${message}`);
}
