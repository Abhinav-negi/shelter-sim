// apps/web/components/charts/solar/orientation.ts
//
// T-48 -- pure helpers, no JSX, independently testable without a DOM
// (this environment has no jsdom, see solar.test.ts's own header).
//
// CONTRACTS.md 7.5: `Surface.azimuth` is "deg from south, before building
// rotation. -90 = east, 0 = south, 90 = west, 180 = north" -- i.e. it is the
// wall's own NAMED identity in the building's design ("the wall I'm putting
// my glazing on"), and `Building.azimuth` ("whole-building rotation from
// due south") is applied ON TOP of that, for the physics only, when the
// engine computes each surface's actual sun exposure
// (`solve/assemble.ts`'s own `azimuth: normaliseAzimuth(s.azimuth +
// building.azimuth)`).
//
// Bars here are labelled by `surface.azimuth` ALONE, deliberately not
// adding `building.azimuth` back in: this is what makes acceptance test 7
// ("rotating the building 180 degrees visibly redistributes the bars")
// possible at all. CHALLENGE.md C-04's own framing is exactly this: "one
// shelter with substantial glazing on a single wall... rotate the entire
// building 180 degrees" -- the wall keeps its name (the S bar keeps its
// label), but that SAME bar's value collapses once the whole building
// physically turns it away from the sun, and the N bar's value rises to
// take its place. Labelling by the rotated (compass-true) azimuth instead
// would make the S bar stay large and the N bar stay small no matter how
// the building is rotated -- true, but it would make the rotation
// demonstration this deliverable exists for invisible. Every bundled preset
// (`packages/data/src/presets.ts`) sets `building.azimuth: 0`, so this
// distinction is invisible until a caller actually rotates the building --
// exactly the control this view is meant to react to.
import type { SimulationRequest, SimulationResult, Surface } from '@shelter/engine';

export type Orientation = 'S' | 'E' | 'W' | 'N' | 'Roof' | 'Floor';

/** Display order for the bar chart -- floor is never rendered as a bar
 * (it is ground-coupled, not orientation-facing) but is kept as a real
 * category in `surfaceCaptures` so the sum-to-total invariant (acceptance
 * test 1) holds over EVERY surface, not just the ones drawn. */
export const BAR_ORIENTATIONS: readonly Orientation[] = ['S', 'E', 'W', 'N', 'Roof'];

export const ORIENTATION_LABELS: Record<Orientation, string> = {
  S: 'South',
  E: 'East',
  W: 'West',
  N: 'North',
  Roof: 'Roof',
  Floor: 'Floor',
};

/** Wrap to (-180, 180]. */
function wrap180(a: number): number {
  const w = ((a % 360) + 360) % 360; // [0, 360)
  return w > 180 ? w - 360 : w;
}

/** Classifies a surface into a compass octant/roof/floor by its OWN NAMED
 * azimuth (see the file header for why `building.azimuth` is deliberately
 * NOT added back in here). A flat-ish surface (tilt <= 10 deg, i.e. facing
 * mostly skyward) is "Roof" regardless of its nominal azimuth -- a roof's
 * azimuth is not meaningful. */
export function classifySurface(surface: Surface): Orientation {
  if (surface.type === 'floor') return 'Floor';
  if (surface.type === 'roof' || surface.tilt <= 10) return 'Roof';
  const az = wrap180(surface.azimuth);
  if (az > -45 && az <= 45) return 'S';
  if (az > 45 && az <= 135) return 'W';
  if (az > 135 || az <= -135) return 'N';
  return 'E';
}

export interface SurfaceCapture {
  surfaceId: string;
  orientation: Orientation;
  /** kWh, exactly `dailyTotalKWh.bySurface[surfaceId]` -- opaque absorption, untouched. */
  opaqueKWh: number;
  /** kWh, this surface's share of `dailyTotalKWh.glazed` -- see the header
   * comment on `surfaceCaptures` for how the share is computed and its
   * documented ceiling. */
  glazedKWh: number;
  totalKWh: number;
}

/**
 * Attributes each window's transmitted solar gain to its host surface.
 *
 * KNOWN CEILING (LOG.md global rule 13/14 -- documented, not hidden, upgrade
 * path stated). `SimulationResult.solar` reports exactly ONE aggregate
 * `transmittedGlazed` series for the whole building (CONTRACTS.md 7.7) --
 * there is no per-window or per-host-surface breakdown to read off, and
 * `dailyTotalKWh.bySurface` (packages/engine/src/index.ts) covers ONLY each
 * surface's own opaque absorption, never the glazed contribution of a window
 * it hosts (verified directly against a real run, see solar.test.ts). Adding
 * a per-window breakdown is an engine change (`packages/engine/**`), outside
 * this task's `apps/web/components/charts/solar/**` allow-list.
 *
 * Rather than recompute the transmission physics ourselves -- the task
 * prompt's explicit "recompute nothing", and doing so would mean
 * reimplementing `loads/windows.ts`'s SHGC/IAM formula here, a second
 * implementation that can drift (LOG.md rule 16) -- the aggregate `glazed`
 * total is split across host surfaces IN PROPORTION TO each surface's own
 * `incidentBySurface` integral times its hosted window area. Both of those
 * are already-computed engine output (`incidentBySurface`) or plain request
 * geometry (`WindowSpec.area`); no new solar correlation is introduced. A
 * window shares its host wall's tilt and azimuth, so `incidentBySurface
 * [hostId]` IS that window's own plane-of-array irradiance, not a proxy for
 * it -- the only approximation this carries is that it does not distinguish
 * differing SHGC/IAM between windows of different glazing types on
 * different walls. It is therefore EXACT whenever a building has windows on
 * only one surface (3 of the 6 bundled presets: traditional, Trombe,
 * insulated-brick) and an irradiance-weighted estimate otherwise. Upgrade
 * path: have the engine report `transmittedGlazed` per window or per host
 * surface, then delete this function and read the field directly.
 */
export function surfaceCaptures(
  result: SimulationResult,
  request: SimulationRequest,
): SurfaceCapture[] {
  const dt = request.options.timestepSeconds;

  const weightOf: Record<string, number> = {};
  let totalWeight = 0;
  for (const surface of request.building.surfaces) {
    const windowArea = request.building.windows
      .filter((w) => w.hostSurfaceId === surface.id)
      .reduce((sum, w) => sum + w.area, 0);
    if (windowArea <= 0) {
      weightOf[surface.id] = 0;
      continue;
    }
    const incident = result.solar.incidentBySurface[surface.id];
    let integral = 0;
    if (incident) for (let i = 0; i < incident.length; i++) integral += incident[i]! * dt;
    const weight = integral * windowArea;
    weightOf[surface.id] = weight;
    totalWeight += weight;
  }

  return request.building.surfaces.map((surface: Surface) => {
    const opaqueKWh = result.solar.dailyTotalKWh.bySurface[surface.id] ?? 0;
    const share = totalWeight > 0 ? (weightOf[surface.id] ?? 0) / totalWeight : 0;
    const glazedKWh = share * result.solar.dailyTotalKWh.glazed;
    return {
      surfaceId: surface.id,
      orientation: classifySurface(surface),
      opaqueKWh,
      glazedKWh,
      totalKWh: opaqueKWh + glazedKWh,
    };
  });
}

/** Collapses per-surface rows to one total per orientation (S/E/W/N/Roof/
 * Floor) -- the shared building geometry has exactly one surface per
 * octant, but the type does not guarantee that in general. */
export function byOrientation(rows: SurfaceCapture[]): Record<Orientation, number> {
  const out: Record<Orientation, number> = { S: 0, E: 0, W: 0, N: 0, Roof: 0, Floor: 0 };
  for (const r of rows) out[r.orientation] += r.totalKWh;
  return out;
}
