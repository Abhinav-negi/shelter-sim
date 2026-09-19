// apps/web/components/kpis/cards.ts
//
// T-51. "Compute nothing" (this task's own prompt) -- the one exception is
// this file, and even it computes nothing new: it locates an already-
// computed sample.
//
// `result.heatFlows.deltaT` is `indoorAir - ambient` in Kelvin-degrees,
// assembled by the engine (packages/engine/src/types.ts, T-22). The 06:00
// card's "delta versus the baseline" (this task's prompt) is that same
// series read at the 06:00 sample -- how many degrees warmer the shelter is
// than outside at the coldest hour, the entire point of a passive shelter.
//
// ponytail: the index is found by matching `temperatures.indoorAir` against
// `kpis.tempAt0600` by value (first match) rather than re-deriving the
// engine's own weatherStartHour arithmetic (packages/engine/src/post/kpis.ts
// `idx0600`) -- `SimulationResult` carries no `weather.startHour` for this
// component to repeat that formula with, and re-deriving it independently is
// exactly the kind of second, drifting convention `components/house/time.ts`
// warns against. Safe because `computeKpis` sets `tempAt0600 =
// indoor[idx0600]` verbatim, so an exact-value search always finds a
// same-valued sample; it can only disagree from the literal engine index if
// the 24h indoor curve revisits the exact same float twice, which a
// continuously-varying temperature series does not do. Known ceiling: a
// perfectly flat/periodic multi-day steady state could match an earlier
// day's identical sample instead of the final day's. Upgrade path: have the
// engine expose `kpis.idx0600` directly if that ever needs to be exact.

import type { SimulationResult } from '@shelter/engine';

/** Kelvin-degrees the shelter was warmer (positive) or colder (negative)
 * than outside ambient at the 06:00 sample. `null` if the sample cannot be
 * located (e.g. an empty series). */
export function deltaVsAmbientAt0600(result: SimulationResult): number | null {
  const idx = result.temperatures.indoorAir.indexOf(result.kpis.tempAt0600);
  if (idx < 0) return null;
  return result.heatFlows.deltaT[idx] ?? null;
}
