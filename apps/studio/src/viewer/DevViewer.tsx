// Dev-only route (`/dev/viewer`) to preview ShelterViewer against real
// GET /api/options data, without needing the rest of the Studio page (F3).
// Not linked from any nav — reached by typing the URL. Query-param overrides
// for visual QA: ?lengthM=&widthM=&heightM=&azimuthDeg=&wallThicknessM=&hour=

import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { ShelterDesign } from '@shelter/studio-server';
import { useOptions } from '../design/useOptions';
import { ShelterViewer } from './ShelterViewer';

function numberParam(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function DevViewer() {
  const { options, error } = useOptions();
  const [params] = useSearchParams();

  const design = useMemo<ShelterDesign | null>(() => {
    if (!options) return null;
    const d = options.defaults;
    const wallThicknessM = numberParam(params, 'wallThicknessM');
    return {
      ...d,
      lengthM: numberParam(params, 'lengthM') ?? d.lengthM,
      widthM: numberParam(params, 'widthM') ?? d.widthM,
      heightM: numberParam(params, 'heightM') ?? d.heightM,
      azimuthDeg: numberParam(params, 'azimuthDeg') ?? d.azimuthDeg,
      wallConstruction:
        wallThicknessM !== undefined
          ? {
              materialId: d.wallConstruction?.materialId ?? options.materials[0]?.id ?? 'unknown',
              thicknessM: wallThicknessM,
            }
          : d.wallConstruction,
    };
  }, [options, params]);

  const hour = numberParam(params, 'hour') ?? 12;

  if (error) return <p style={{ padding: 16 }}>Failed to load options: {error}</p>;
  if (!design || !options) return <p style={{ padding: 16 }}>Loading…</p>;

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <ShelterViewer design={design} options={options} hour={hour} />
    </div>
  );
}
