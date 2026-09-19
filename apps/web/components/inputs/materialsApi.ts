// apps/web/components/inputs/materialsApi.ts
//
// Fetches the material catalogue from T-41's `GET /api/materials` -- the
// browser-safe path to `@shelter/data`'s material rows (see catalog.ts's
// header for why this component tree cannot import `@shelter/data`
// directly). That route already falls back to the code catalogue when the
// database is off (T-34), so acceptance test 12 ("with the database off,
// the material dropdown still lists the full catalogue") is really a claim
// about the route, exercised here by calling it the same way the browser
// does.

import { useEffect, useState } from 'react';
import type { Material } from '@shelter/engine';

export interface MaterialsResponse {
  materials: Material[];
  schemaVersion: number;
  servedFrom: 'database' | 'code';
}

let cached: MaterialsResponse | null = null;
let inFlight: Promise<MaterialsResponse> | null = null;

/** Exposed for tests: forces the next call to refetch instead of reusing a cached response. */
export function __resetMaterialsCacheForTest(): void {
  cached = null;
  inFlight = null;
}

export async function fetchMaterials(): Promise<MaterialsResponse> {
  if (cached) return cached;
  if (inFlight) return inFlight;
  inFlight = fetch('/api/materials')
    .then(async (res) => {
      if (!res.ok) throw new Error(`GET /api/materials -> ${res.status}`);
      const body = (await res.json()) as MaterialsResponse;
      cached = body;
      return body;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export type MaterialsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; materials: Material[]; servedFrom: MaterialsResponse['servedFrom'] };

/** The one hook every basic-panel material dropdown shares. */
export function useMaterialsCatalogue(): MaterialsState {
  const [state, setState] = useState<MaterialsState>(() =>
    cached ? { status: 'ready', materials: cached.materials, servedFrom: cached.servedFrom } : { status: 'loading' },
  );

  useEffect(() => {
    let cancelled = false;
    if (cached) return;
    fetchMaterials()
      .then((body) => {
        if (!cancelled) setState({ status: 'ready', materials: body.materials, servedFrom: body.servedFrom });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function materialById(materials: Material[], id: string): Material | undefined {
  return materials.find((m) => m.id === id);
}
