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
