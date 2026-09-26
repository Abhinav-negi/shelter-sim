// Shared number formatting for the results panel. Everything the engine
// reports in Kelvin is shown to the person in °C (API.md: "the client never
// converts [temperature] itself" refers to DesignInput fields — result/kpi
// temperatures ARE Kelvin on the wire and this is where they become °C).

export const kToC = (k: number): number => k - 273.15;

/** °C to one decimal, "-0.0" folded to "0.0" so a near-freezing reading never
 *  prints a confusing negative zero. */
export function fmtC(kelvin: number): string {
  const c = kToC(kelvin);
  return (Math.abs(c) < 0.05 ? 0 : c).toFixed(1);
}

export function fmtHour(hour: number): string {
  const h = Math.round(hour) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}

export function fmt1(value: number): string {
  return value.toFixed(1);
}

export function fmt0(value: number): string {
  return value.toFixed(0);
}
