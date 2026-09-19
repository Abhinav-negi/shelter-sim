// apps/web/components/charts/temp/format.ts
//
// T-47. Tiny display-only helpers local to this chart. Deliberately NOT in
// `lib/units.ts` -- this task's allow-list is `apps/web/components/charts/
// temp/**` only, and neither of these needs the unit boundary (a clock-hour
// label carries no Kelvin/Celsius value at all).

/** `6.5` -> `"06:30"`. Rounds to the nearest minute so a mid-timestep hour
 * (e.g. a 300 s step lands on 6.0833...) never prints a spurious 06:04:59. */
export function formatHourLabel(hour: number): string {
  const totalMinutes = Math.round(hour * 60) % (24 * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
