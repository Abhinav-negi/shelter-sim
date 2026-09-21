// apps/web/app/page.tsx
//
// Server Component, deliberately NOT 'use client'. This is where the default
// preset is resolved and simulated -- see `lib/store.ts`'s file-header
// gotcha for why: `@shelter/data`'s TMY loader reads bundled JSON off disk
// via `node:fs`, which only Server Components (never bundled for the
// browser) can safely import. `simulate()` (CONTRACTS.md architecture
// diagram) is pure and I/O-free, so running it once per request here is
// cheap and correct on the server; the interactive client tree is
// `AppShell`, seeded with the result as plain serializable props.
//
// This is also the "app opens on a loaded preset" requirement (CHALLENGE.md
// C-19 / T-36 acceptance test 9): first paint already carries a real result.

import { glazingById, materialById, PRESETS, tmyById } from '@shelter/data';
import {
  simulate,
  type Glazing,
  type Material,
  type Preset,
  type SimulationRequest,
} from '@shelter/engine';
import { AppShell } from './app-shell';

// `@shelter/data` (via the externals workaround in `next.config.mjs`) is an
// awaited dynamic `import()` at runtime -- Next's build-time static-page
// worker sandbox does not resolve that reliably (observed: it hangs and
// times out after 3 retries during `next build`'s "Generating static pages"
// step). Rendering on every request instead of prerendering at build time
// sidesteps that sandbox entirely; `simulate()` is ~32 ms (CONTRACTS.md
// §10), so per-request rendering costs nothing worth optimising away here.
export const dynamic = 'force-dynamic';

// Deliberately NOT imported from `lib/store.ts`: that module (transitively,
// via `useStore`) imports `useSyncExternalStore`, which Next.js refuses to
// let a Server Component module graph touch at all, even for an unrelated
// named export. One line, duplicated in exactly two places (here and
// `lib/store.ts`) rather than adding a third shared module for a single
// env-var default.
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

export default function Page() {
  const preset = defaultPreset();
  const request = resolvePreset(preset);
  const result = simulate(request);

  return <AppShell initialRequest={request} initialResult={result} initialPresetId={preset.id} />;
}
