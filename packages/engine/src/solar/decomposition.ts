/**
 * Splitting GHI into beam and diffuse. BLUEPRINT.md 5.4. WORKERS.md W-12.
 *
 * Weather APIs most reliably give GHI (what lands on a flat horizontal surface).
 * But a vertical south wall responds very differently to direct beam sunlight than
 * to diffuse sky light, so the split has to be recovered before transposition.
 *
 *   GHI = DNI * cos(zenith) + DHI
 */

import { G_SC } from '../constants.js';
import { rad } from '../units.js';

export interface Irradiance {
  /** Global horizontal, W/m^2. */
  GHI: number;
  /** Direct normal, W/m^2. */
  DNI: number;
  /** Diffuse horizontal, W/m^2. */
  DHI: number;
  /** Clearness index, 0-1. ~0.8 on a very clear Ladakh day. */
  kt: number;
}

/** Extraterrestrial normal irradiance: what you would get with no atmosphere. W/m^2. */
export function extraterrestrialNormal(dayOfYear: number): number {
  return G_SC * (1 + 0.033 * Math.cos(rad((360 * dayOfYear) / 365)));
}

/**
 * Erbs correlation: diffuse fraction as a function of clearness index.
 * Empirical, widely used, well validated. BLUEPRINT.md 5.4 step 3.
 */
export function erbsDiffuseFraction(kt: number): number {
  if (kt <= 0.22) return 1 - 0.09 * kt;
  if (kt <= 0.8) {
    return (
      0.9511 - 0.1604 * kt + 4.388 * kt * kt - 16.638 * kt ** 3 + 12.336 * kt ** 4
    );
  }
  return 0.165;
}

/**
 * Recover (DNI, DHI) from GHI.
 *
 * When the weather source already carries DNI and DHI directly -- NASA POWER
 * supplies both -- pass them in and they are used unchanged. Erbs is the fallback.
 */
export function decompose(
  GHI: number,
  cosZenith: number,
  dayOfYear: number,
  known?: { DNI?: number | undefined; DHI?: number | undefined },
): Irradiance {
  // Below ~5 degrees altitude the cos(zenith) division is numerically hostile and
  // the irradiance is negligible anyway. Treat everything as diffuse there.
  const COS_Z_FLOOR = 0.0872; // cos(85 deg)

  const I0n = extraterrestrialNormal(dayOfYear);
  const I0h = I0n * cosZenith;
  const kt = I0h > 1 ? Math.max(0, Math.min(1, GHI / I0h)) : 0;

  if (known?.DNI !== undefined && known.DHI !== undefined) {
    return { GHI, DNI: Math.max(0, known.DNI), DHI: Math.max(0, known.DHI), kt };
  }

  if (GHI <= 0 || cosZenith < COS_Z_FLOOR) {
    return { GHI: Math.max(0, GHI), DNI: 0, DHI: Math.max(0, GHI), kt };
  }

  const DHI = GHI * erbsDiffuseFraction(kt);
  // Cap DNI at the extraterrestrial value: no atmosphere can amplify sunlight.
  const DNI = Math.max(0, Math.min(I0n, (GHI - DHI) / cosZenith));
  return { GHI, DNI, DHI, kt };
}
