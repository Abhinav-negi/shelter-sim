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
//
// `@shelter/data` is externalised in `next.config.mjs` as an awaited
// `import()` (it's a native ESM package -- Node can't `require()` that).
// A plain top-level `import ... from '@shelter/data'` here made webpack mark
// this whole module -- and, transitively, every module that statically
// imports from it, including `app/(workspace)/layout.tsx` -- as an "async
// module". `layout.tsx`'s default export is a Server Component Next expects
// to resolve as a plain sync function, so once its own module became async
// too, `WorkspaceShell`'s import broke ("Element type is invalid. Received a
// promise that resolves to: undefined"). Loading `@shelter/data` via a
// dynamic `import()` inside this (now async) function instead keeps the
// promise local to a function body, which doesn't trigger that webpack
// module-level transform -- callers just need to `await` this function,
// which `layout.tsx` already does as a normal async Server Component.
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
function resolvePreset(preset: Preset, data: typeof import('@shelter/data')): SimulationRequest {
  const materials: Record<string, Material> = {};
  for (const surface of preset.request.building.surfaces) {
    for (const layer of surface.construction)
      materials[layer.materialId] = data.materialById(layer.materialId);
  }
  const glazings: Record<string, Glazing> = {};
  for (const win of preset.request.building.windows)
    glazings[win.glazingId] = data.glazingById(win.glazingId);
  return { ...preset.request, weather: data.tmyById(preset.locationId), materials, glazings };
}

function defaultPreset(data: typeof import('@shelter/data')): Preset {
  return data.PRESETS.find((p) => p.locationId === DEFAULT_LOCATION) ?? data.PRESETS[0]!;
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
export async function resolveInitialState(): Promise<InitialState> {
  const data = await import('@shelter/data');
  const preset = defaultPreset(data);
  const request = resolvePreset(preset, data);
  const result = simulate(request);
  return { request, result, presetId: preset.id };
}
