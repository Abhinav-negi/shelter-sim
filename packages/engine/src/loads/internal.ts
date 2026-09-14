/**
 * Internal gains. BLUEPRINT.md 5.12. WORKERS.md W-20.
 *
 * Small in an office model, SIGNIFICANT in a small Ladakhi shelter.
 */

/** Indicative sensible heat, W. Exposed so the UI assumptions panel can show them. */
export const GAIN_WATTS = {
  adultSeated: 85,
  adultActive: 175,
  bukhariStove: 2500,
  keroseneHeater: 1800,
  cooking: 1000,
  lightingLed: 25,
  /**
   * Traditional Ladakhi houses stable animals on the ground floor directly under
   * the living space, where they act as a distributed biological heater. This is a
   * real vernacular passive strategy, not a curiosity.
   */
  livestockPerAnimal: 500,
} as const;

/** Read an hourly schedule at a fractional hour, wrapping past midnight. */
export function scheduleAt(schedule: number[], hourOfDay: number): number {
  if (schedule.length === 0) return 0;
  const i = Math.floor(hourOfDay) % schedule.length;
  return schedule[(i + schedule.length) % schedule.length] ?? 0;
}
