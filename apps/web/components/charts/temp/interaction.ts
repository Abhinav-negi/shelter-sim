// apps/web/components/charts/temp/interaction.ts
//
// T-47. Pure logic behind the two interactive features -- the hover tooltip
// (acceptance test 7) and the per-variant toggle (acceptance test 4) -- kept
// out of TempChart.tsx's JSX so both are unit-testable without a DOM. This
// environment has no jsdom (see components/house/house.test.tsx's header),
// so TempChart.tsx's `onMouseMove`/`onChange` handlers call these exact
// functions and nothing else; the test file calls them directly, the same
// workaround components/house/HouseView.tsx's `activateSurface` already
// established for click-without-a-real-DOM-event.

import type { HourPoint } from './series';

/** Index of the point closest to `hour` (wrap-aware: 23.9 and 0.1 are 0.2 h
 * apart, not 23.8). `-1` for an empty series. */
export function nearestPointIndex(points: HourPoint[], hour: number): number {
  if (points.length === 0) return -1;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const raw = Math.abs(points[i]!.hour - hour);
    const dist = Math.min(raw, 24 - raw);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

export interface VariantSeries {
  id: string;
  label: string;
  color: string;
  points: HourPoint[];
}

export interface TooltipEntry {
  id: string;
  label: string;
  color: string;
  indoorC: number;
}

export interface TooltipData {
  hour: number;
  ambientC: number;
  entries: TooltipEntry[];
}

/** What the hover layer shows: the clock hour nearest the pointer, the
 * shared ambient reading at that hour (taken from the first RENDERABLE
 * variant -- ambient is common weather context, not something that varies
 * per compared design), and every visible variant's indoor reading at that
 * same hour. `null` when there is nothing to show a tooltip for. */
export function tooltipDataAt(variants: VariantSeries[], hour: number): TooltipData | null {
  if (variants.length === 0) return null;
  const idx0 = nearestPointIndex(variants[0]!.points, hour);
  if (idx0 < 0) return null;
  const anchor = variants[0]!.points[idx0]!;
  return {
    hour: anchor.hour,
    ambientC: anchor.ambientC,
    entries: variants.map((v) => {
      const idx = nearestPointIndex(v.points, hour);
      return {
        id: v.id,
        label: v.label,
        color: v.color,
        indoorC: idx >= 0 ? v.points[idx]!.indoorC : NaN,
      };
    }),
  };
}

/** Toggling variant `id` in/out of the visible set. A fresh `Set` (never a
 * mutation of `current`) so React's `useState` setter sees a new reference. */
export function toggleVariantVisibility(current: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
