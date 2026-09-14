/** Physical constants. ENGINE_BLUEPRINT.md §5.1. */

/** Stefan-Boltzmann constant, W/(m^2*K^4). */
export const SIGMA = 5.670374419e-8;
/** Solar constant, W/m^2. */
export const G_SC = 1367;
/** Specific heat capacity of air at constant pressure, J/(kg*K). */
export const C_P_AIR = 1005;
/** Specific gas constant for dry air, J/(kg*K). */
export const R_AIR = 287.05;
/** Sea-level standard atmospheric pressure, Pa. */
export const P0 = 101325;

/**
 * Hard ventilation safety floor, air changes per hour.
 * WORKERS.md 1.5 rule 7. The thermally optimal shelter is a sealed one; a sealed
 * shelter with a bukhari inside is a carbon-monoxide fatality. Never optimise below this.
 */
export const ACH_MIN = 0.35;

/** Environmental lapse rate, K per metre. Used for elevation correction of weather data. */
export const LAPSE_RATE = 6.5e-3;

/** Solver sanity bounds. A node outside these means the integrator has diverged. */
export const T_MIN_PLAUSIBLE = 173; // K, -100 degC
export const T_MAX_PLAUSIBLE = 373; // K, +100 degC

// ============================== RANKING & HONESTY (added by T-06, LOG.md 7.9) ==============================

/** The design-search primary ranking metric. Lower is better. */
export const PRIMARY_METRIC = 'auxEnergyKWhPerDay';
/** Secondary metric, used as a tie-break. Higher is better. */
export const SECONDARY_METRIC = 'tempAt0600';
/** kWh/day. Variants closer than this on PRIMARY_METRIC are TIED, never ordered. */
export const RANK_NOISE_FLOOR = 0.05;

/**
 * Combustion allowance added on top of ACH_MIN when a design has unvented
 * combustion (e.g. a bukhari stove), so ACH_MIN + this floors the bukhari case
 * at 0.70 ACH. See LOG.md rule 10 -- the ventilation safety floor is not negotiable.
 */
export const ACH_MIN_COMBUSTION_ALLOWANCE = 0.35;

// ============================== FUEL, COST & CARBON (added by T-06 for T-24, LOG.md 7.9) ==============================
// Editable; surfaced in the assumptions panel; never inlined. T-24 must reconcile
// with CONVERSIONS / keroseneLitres() in post/conversions.ts rather than duplicate them.

/** kWh of chemical energy per litre of kerosene (~37.6 MJ/L). TECH.md 10.4. */
export const KEROSENE_KWH_PER_L = 10.4;
/** Typical unvented kerosene heater, delivered/chemical. TECH.md 10.4. */
export const KEROSENE_STOVE_EFFICIENCY = 0.55;
/** kg CO2 per litre of kerosene burned. TECH.md 10.4. */
export const KEROSENE_CO2_KG_PER_L = 2.5;
// WARNING: no source document states a kerosene price. This figure is an ASSUMPTION.
// It must be editable in the UI and the PPT must cite whatever value is used.
export const KEROSENE_INR_PER_L = 80;
