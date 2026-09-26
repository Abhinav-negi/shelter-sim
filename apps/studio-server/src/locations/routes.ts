// apps/studio-server/src/locations/routes.ts — GET /api/locations/search
// (condition 1). Registered as a Fastify plugin from app.ts.

import type { FastifyInstance } from 'fastify';
import { searchLocations } from '../weather/geocode.js';

export interface LocationsRoutesOptions {
  /** Injected for tests; defaults to global `fetch` inside `searchLocations`. */
  fetchImpl?: typeof fetch;
}

export async function locationsRoutes(
  app: FastifyInstance,
  opts: LocationsRoutesOptions,
): Promise<void> {
  app.get('/api/locations/search', async (req) => {
    const q = ((req.query as { q?: string }).q ?? '').trim();
    if (!q) return [];
    return opts.fetchImpl ? searchLocations(q, opts.fetchImpl) : searchLocations(q);
  });
}
