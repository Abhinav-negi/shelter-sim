/**
 * Fuel, money and carbon conversions. BLUEPRINT.md Part 10.
 *
 * These are EDITABLE CONSTANTS, not magic numbers buried in a formula, and the UI
 * must show them in an assumptions panel. A judge who wants to know what stove
 * efficiency was assumed should be able to see it and change it.
 */

export const CONVERSIONS = {
  /** kWh of chemical energy per litre of kerosene (~37.6 MJ/L). */
  keroseneKWhPerLitre: 10.4,
  /** Typical unvented kerosene heater, delivered/chemical. */
  keroseneStoveEfficiency: 0.55,
  /** kg CO2 per litre of kerosene burned. */
  keroseneCo2KgPerLitre: 2.5,
  /** INR per litre. Regional retail price; edit for the site. */
  kerosenePriceInrPerLitre: 80,
  /** kWh per kg of dung cake (~12 MJ/kg). */
  dungCakeKWhPerKg: 3.33,
  /** Dung-cake stove efficiency -- very low, which is the point. */
  dungStoveEfficiency: 0.12,
} as const;

/** Litres of kerosene needed to deliver a given amount of useful heat. */
export function keroseneLitres(usefulKWh: number): number {
  return usefulKWh / (CONVERSIONS.keroseneKWhPerLitre * CONVERSIONS.keroseneStoveEfficiency);
}
