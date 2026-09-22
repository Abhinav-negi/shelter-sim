// apps/web/app/lib/resolveInitialState.ts
//
// Server-only. Extracted from `app/page.tsx` (was duplicated as soon as a
// second route needed the same default-preset resolution) -- see that
// file's original header for the underlying reason this must run
// server-side: `@shelter/data`'s TMY loader uses `node:fs` and is not
// browser-bundle-safe, so the default preset can only be resolved from a
// Server Component. `next.config.mjs`'s `serverExternalPackages` workaround
// matches by package path, not by which file imports it, so this module is
// covered the same way `page.tsx` was.

import { glazingById, materialById, PRESETS, tmyById } from '@shelter/data';
import {
  simulate,
  type Glazing,
  type Material,
  type Preset,
  type SimulationRequest,
  type SimulationResult,
} from '@shelter/engine';

const DEFAULT_LOCATION = process.env.NEXT_PUBLIC_DEFAULT_LOCATION ?? 'leh'; // CONTRACTS.md §7.16

/** Resolve a `Preset.request` (which omits weather/materials/glazings by
 * design, CONTRACTS.md §7.11) into a runnable `SimulationRequest`, exactly
 * the way `packages/data/test/presets.test.ts` documents as "the way a real
 * caller is expected to". */
function resolvePreset(preset: Preset): SimulationRequest {
  const materials: Record<string, Material> = {};
  for (const surface of preset.request.building.surfaces) {
    for (const layer of surface.construction)
      materials[layer.materialId] = materialById(layer.materialId);
  }
  const glazings: Record<string, Glazing> = {};
  for (const win of preset.request.building.windows)
    glazings[win.glazingId] = glazingById(win.glazingId);
  return { ...preset.request, weather: tmyById(preset.locationId), materials, glazings };
}

function defaultPreset(): Preset {
  return PRESETS.find((p) => p.locationId === DEFAULT_LOCATION) ?? PRESETS[0]!;
}

export interface InitialState {
  request: SimulationRequest;
  result: SimulationResult;
  presetId: string;
}

/** Runs the default preset through the engine, server-side. Cheap (~32ms,
 * CONTRACTS.md §10) -- every route that can be a first-hit URL calls this
 * itself rather than sharing a cached result, so each one works standalone
 * on a direct URL hit or hard refresh. */
export function resolveInitialState(): InitialState {
  const preset = defaultPreset();
  const request = resolvePreset(preset);
  const result = simulate(request);
  return { request, result, presetId: preset.id };
}
