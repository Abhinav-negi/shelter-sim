// Samples a real preview's 24h indoor/outdoor curve at a given clock hour —
// the hero's live temperature strip (G5 condition 1) tracks the animated sun
// hour, so the strip's numbers are read off the *same* real
// `POST /api/simulate/preview` response the chart section shows, never a
// separate/invented value. Linear interpolation between the two bracketing
// samples keeps the numbers moving as smoothly as the sun does.
import { kToC } from '../../results/format';
import type { ResultJson } from '../../results/types';

export interface HourSample {
  indoorC: number;
  outdoorC: number;
}

export function sampleAtHour(result: ResultJson, hour: number): HourSample | null {
  const { time, temperatures } = result;
  if (time.length === 0) return null;

  const targetSec = (((hour % 24) + 24) % 24) * 3600;
  const hi = time.findIndex((t) => t >= targetSec);

  if (hi <= 0) {
    const i = hi === 0 ? 0 : time.length - 1;
    return { indoorC: kToC(temperatures.indoorAir[i] ?? 0), outdoorC: kToC(temperatures.ambient[i] ?? 0) };
  }

  const lo = hi - 1;
  const span = time[hi]! - time[lo]!;
  const frac = span > 0 ? (targetSec - time[lo]!) / span : 0;
  const lerp = (a: number, b: number) => a + (b - a) * frac;
  return {
    indoorC: kToC(lerp(temperatures.indoorAir[lo] ?? 0, temperatures.indoorAir[hi] ?? 0)),
    outdoorC: kToC(lerp(temperatures.ambient[lo] ?? 0, temperatures.ambient[hi] ?? 0)),
  };
}
