// apps/web/app/api/materials/route.ts
//
// T-41: GET /api/materials -- the material catalogue (log/AREA-E-server-tier.md).
//
// listMaterials() (T-34) already falls back to the code catalogue
// (@shelter/data) when there is no database, so this route can never render
// an empty dropdown -- if it ever gets an empty array, that is a T-34 defect,
// not a "no materials" state, and is surfaced as 500 rather than passed
// through (per this task's own prompt).

import { NextResponse } from 'next/server';
import { listMaterials } from '../../../lib/repo/materials';
import { dbHealthy } from '../../../lib/db';

// The catalogue changes when the code ships, not between requests.
const CACHE_CONTROL = 'public, max-age=3600';

// ponytail: listMaterials() (T-34) does not report which path it served from,
// and lib/repo/materials.ts is off this task's allow-list, so servedFrom is
// approximated with a second, independent health check (dbHealthy, already
// exported by lib/db.ts for exactly this purpose) run in parallel with the
// real fetch. This can theoretically mislabel a database-reachable-but-query-
// broken row as 'database'; if that ever needs to be exact, T-34 should have
// listMaterials return its own source tag instead.
export async function GET(): Promise<NextResponse> {
  const [healthy, materials] = await Promise.all([dbHealthy(), listMaterials()]);

  if (materials.length === 0) {
    return NextResponse.json(
      { code: 'INTERNAL', message: 'material catalogue is empty' },
      { status: 500 },
    );
  }

  const body = {
    materials,
    schemaVersion: 1,
    servedFrom: healthy ? ('database' as const) : ('code' as const),
  };

  return NextResponse.json(body, { status: 200, headers: { 'Cache-Control': CACHE_CONTROL } });
}
