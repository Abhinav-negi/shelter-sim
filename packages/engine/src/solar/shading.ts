/**
 * Shading: mountain horizon and window overhangs. T-18. TECH.md 5.
 *
 * Two independent, pure questions:
 *  - horizonBlockFactor: is the sun above the surrounding terrain at all, right now?
 *  - overhangSunlitFraction: of a window with a horizontal overhang above it, what
 *    fraction of its height still sees direct sun, right now?
 *
 * Neither function does any I/O and neither is wired into index.ts -- that is a
 * separate concern (see .work/T-18.md for the forcing-hook note).
 *
 * NOTE ON SunPosition FIELD NAMES: the PROMPT for this task was written against
 * `sun.altitudeDeg` / `sun.azimuthDeg` / `sun.isUp`. The `SunPosition` interface
 * actually on disk (solar/geometry.ts, done, not to be edited by this task) uses
 * `altitude` and `azimuth` (already in degrees, per the file's own convention) and
 * has no `isUp` field. Per LOG.md's own rule ("this section wins... it describes
 * the code that is actually on disk"), disk wins: this file reads `sun.altitude`
 * and `sun.azimuth`, and treats "the sun is up" as `sun.altitude > 0`.
 *
 * SIMPLIFICATION: both functions gate the BEAM component only. Diffuse and
 * ground-reflected irradiance are left untouched by design (global rule 13).
 * Ceiling: this overestimates gain on a deeply overhung or steeply
 * horizon-blocked surface, because a blocked horizon or a deep overhang also
 * blocks part of the sky dome the surface would otherwise see, not just the sun's
 * disc. Upgrade path: a sky-dome view-factor reduction applied to the diffuse
 * term (e.g. a horizon-corrected isotropic sky-view factor), tracked for
 * EQUATIONS.md / the limitations list (T-64).
 */

import { rad } from '../units.js';
import { EngineError } from '../types.js';
import type { SunPosition } from './geometry.js';

/** Normalise an azimuth (south = 0, east negative, west positive) to [0, 360). */
function azimuthTo360(azimuthDeg: number): number {
  const a = azimuthDeg % 360;
  return a < 0 ? a + 360 : a;
}

/** Normalise an azimuth difference to (-180, 180]. */
function normaliseRelativeAzimuth(deltaDeg: number): number {
  let d = deltaDeg % 360;
  if (d <= -180) d += 360;
  if (d > 180) d -= 360;
  return d;
}

/**
 * Linear interpolation of a 36-value horizon profile (blocking altitude in
 * degrees, one value per 10 deg sector) at an arbitrary azimuth. Anchor i sits
 * at azimuth i*10 deg (0, 10, ..., 350) in the 0-360 convention; the profile
 * wraps from anchor 35 back to anchor 0 across due-south.
 */
function interpolateHorizonProfile(profile: number[], azimuthDeg: number): number {
  const az = azimuthTo360(azimuthDeg);
  const posInSectors = az / 10;
  const i0 = Math.floor(posInSectors) % 36;
  const i1 = (i0 + 1) % 36;
  const frac = posInSectors - Math.floor(posInSectors);
  return profile[i0] * (1 - frac) + profile[i1] * frac;
}

/**
 * Is the sun above the local terrain horizon? `Site.horizonProfile` is 36
 * values -- the blocking altitude in degrees for each 10 deg sector of azimuth,
 * same convention as the rest of the engine (south = 0, east negative, west
 * positive). With no profile, the terrain is flat: the only question is whether
 * the sun is above the astronomical horizon at all.
 */
export function horizonBlockFactor(sun: SunPosition, horizonProfile?: number[]): 0 | 1 {
  if (horizonProfile === undefined) {
    return sun.altitude > 0 ? 1 : 0;
  }
  if (horizonProfile.length !== 36) {
    throw new EngineError(
      'INVALID_INPUT',
      `horizonProfile must have exactly 36 values (one per 10 deg sector), got ${horizonProfile.length}`,
    );
  }
  const blockingAltitude = interpolateHorizonProfile(horizonProfile, sun.azimuth);
  return sun.altitude < blockingAltitude ? 0 : 1;
}

/**
 * Fraction (0-1) of a window's height still sunlit given a horizontal overhang
 * above it. Duffie & Beckman ch. 14 "profile angle" construction: the solar
 * altitude projected into the vertical plane perpendicular to the wall.
 *
 *   tan(profileAngle) = tan(altitude) / cos(wallRelativeAzimuth)
 *   y = overhangDepth * tan(profileAngle)                    shadow depth down the wall
 *   shadedHeight = clamp(y - overhangHeightAbove, 0, windowHeight)
 *   sunlitFraction = 1 - shadedHeight / windowHeight
 */
export function overhangSunlitFraction(
  sun: SunPosition,
  surfaceAzimuthDeg: number,
  windowHeight: number,
  overhangDepth: number,
  overhangHeightAbove: number,
): number {
  if (windowHeight <= 0) {
    throw new EngineError('INVALID_INPUT', `windowHeight must be > 0, got ${windowHeight}`);
  }
  if (overhangDepth === 0) return 1;
  // Strictly below, not <=: at altitude === 0 the geometric formula already
  // gives shadedHeight === 0 (tan(0) === 0), so treating exactly-grazing sun
  // as "below the horizon" would introduce a spurious discontinuity right at
  // the horizon instead of the fraction rising smoothly from 0 deg upward.
  if (sun.altitude < 0) return 0;

  const wallRelativeAzimuth = normaliseRelativeAzimuth(sun.azimuth - surfaceAzimuthDeg);
  if (Math.abs(wallRelativeAzimuth) >= 90) return 0;

  const profileAngleRad = Math.atan(
    Math.tan(rad(sun.altitude)) / Math.cos(rad(wallRelativeAzimuth)),
  );
  const y = overhangDepth * Math.tan(profileAngleRad);
  const shadedHeight = Math.min(Math.max(y - overhangHeightAbove, 0), windowHeight);
  const fraction = 1 - shadedHeight / windowHeight;
  return Math.min(1, Math.max(0, fraction));
}
