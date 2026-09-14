/**
 * Irradiance on a tilted, oriented surface. BLUEPRINT.md 5.5. WORKERS.md W-13.
 *
 *   I_T = beam + diffuse-from-sky + reflected-from-ground
 *
 * This module is where ORIENTATION stops being a word and becomes a number.
 */

import { rad } from '../units.js';
import type { Irradiance } from './decomposition.js';
import type { SunPosition } from './geometry.js';
import { cosIncidence } from './geometry.js';

export interface SurfaceIrradiance {
  /** Total incident, W/m^2. */
  total: number;
  beam: number;
  diffuse: number;
  groundReflected: number;
  /** cos of the incidence angle, needed by the window IAM. */
  cosTheta: number;
}

export type SkyModel = 'isotropic' | 'hdkr';

/**
 * Ground albedo. The textbook default of 0.2 is BADLY wrong for Ladakh.
 *
 * For a vertical south wall the ground-reflected term is GHI * rho * 0.5, so going
 * from bare rock (0.30) to fresh snow (0.80) nearly triples it -- in midwinter,
 * exactly when the shelter needs heat most. Snow albedo is a genuinely
 * region-specific piece of physics, which is why it is a time series, not a constant.
 */
export const ALBEDO = {
  genericGround: 0.2,
  dryDesertRock: 0.32,
  freshSnow: 0.8,
  agedSnow: 0.55,
} as const;

export function transpose(
  irr: Irradiance,
  sun: SunPosition,
  tilt: number,
  surfaceAzimuth: number,
  groundAlbedo: number,
  model: SkyModel = 'hdkr',
): SurfaceIrradiance {
  const beta = rad(tilt);
  const cosTheta = cosIncidence(sun, tilt, surfaceAzimuth);

  const beam = irr.DNI * cosTheta;

  // Sky view factor: the fraction of the hemisphere above this surface that is sky.
  // Horizontal roof -> 1.0 (sees the whole sky). Vertical wall -> 0.5.
  const skyViewFactor = (1 + Math.cos(beta)) / 2;
  const groundViewFactor = (1 - Math.cos(beta)) / 2;

  let diffuse: number;
  if (model === 'isotropic' || irr.GHI <= 0 || sun.cosZenith <= 0) {
    // Liu & Jordan: diffuse light arrives uniformly from the whole sky dome.
    diffuse = irr.DHI * skyViewFactor;
  } else {
    /*
     * HDKR: real skies are brighter near the sun (circumsolar) and near the
     * horizon. Isotropic underestimates gain on sun-facing surfaces on clear days
     * -- which is the Ladakh case ~300 days a year.
     */
    const I0n = irr.DNI + 1e-9;
    const Ai = Math.min(1, irr.DNI / Math.max(I0n, extraterrestrialGuard(irr)));
    const Rb = sun.cosZenith > 1e-6 ? cosTheta / sun.cosZenith : 0;
    const f = Math.sqrt(Math.max(0, (irr.DNI * sun.cosZenith) / irr.GHI));
    const horizonBrightening = 1 + f * Math.sin(beta / 2) ** 3;
    diffuse = irr.DHI * (Ai * Rb + (1 - Ai) * skyViewFactor * horizonBrightening);
  }

  const groundReflected = irr.GHI * groundAlbedo * groundViewFactor;
  const total = Math.max(0, beam + Math.max(0, diffuse) + groundReflected);
  return { total, beam, diffuse: Math.max(0, diffuse), groundReflected, cosTheta };
}

/** Anisotropy index denominator; kept separate so the HDKR branch stays readable. */
function extraterrestrialGuard(irr: Irradiance): number {
  // kt already encodes GHI/I0h; recover I0n conservatively so Ai stays in [0,1].
  return irr.kt > 1e-6 ? irr.GHI / irr.kt : irr.DNI + irr.DHI + 1e-9;
}

/** Resolve a scalar-or-series albedo at a timestep. */
export function albedoAt(albedo: number | number[], index: number): number {
  if (typeof albedo === 'number') return albedo;
  return albedo[Math.min(index, albedo.length - 1)] ?? ALBEDO.genericGround;
}
