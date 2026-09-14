/**
 * Where is the sun? ENGINE_BLUEPRINT.md 5.3, BLUEPRINT.md 5.3. WORKERS.md W-11.
 * Pure astronomy: deterministic, no data source, same answer forever.
 * Reference: Duffie & Beckman, Solar Engineering of Thermal Processes, ch. 1.
 *
 * Convention used throughout: azimuth is measured FROM SOUTH,
 * negative = East, positive = West. Tilt is degrees from horizontal.
 *
 * ---------------------------------------------------------------------------
 * CORRECTION vs ENGINE_BLUEPRINT.md 5.3, which prints
 *     t_sol = t_local + 4*(L_st - L_loc) + E
 * That sign is inverted. Duffie & Beckman is stated in WEST-positive longitude;
 * converted to the east-positive convention this file uses it becomes
 *     t_sol = t_local + 4*(L_loc - L_st) + E
 * which is what BLUEPRINT.md 5.3 has, and what its own worked example requires:
 * Leh sits at 77.58E, west of the 82.5E IST meridian, so the sun reaches Leh's
 * meridian ~19.7 min AFTER clock noon. Solar noon in Leh is ~12:20 IST, not 11:40.
 *
 * Note the "peak altitude = 32.4 deg on 21 Dec" self-check both documents give
 * CANNOT catch this: it is evaluated at solar noon, so it passes either way.
 * See solarNoonClockHour() and the sunrise/sunset test, which do catch it.
 * ---------------------------------------------------------------------------
 */

import { rad, deg } from '../units.js';

export interface SunPosition {
  /** Degrees above the horizon. Negative when the sun is down. */
  altitude: number;
  /** Degrees from vertical (90 - altitude). */
  zenith: number;
  /** Degrees from south, negative = East, positive = West. */
  azimuth: number;
  /** cos(zenith), clamped to >= 0. Convenient for irradiance maths. */
  cosZenith: number;
  /** Solar time in hours, for diagnostics. */
  solarHour: number;
}

/**
 * Equation of time, minutes. Spencer (1971) via Duffie & Beckman eq. 1.5.3.
 * The Earth's orbit is elliptical and its axis tilted, so clock noon is not
 * solar noon; this is that correction, worth up to ~16 minutes.
 */
export function equationOfTime(dayOfYear: number): number {
  const B = rad((360 * (dayOfYear - 1)) / 365);
  return (
    229.2 *
    (0.000075 +
      0.001868 * Math.cos(B) -
      0.032077 * Math.sin(B) -
      0.014615 * Math.cos(2 * B) -
      0.04089 * Math.sin(2 * B))
  );
}

/** Solar declination, degrees. Cooper (1969). Ranges +/-23.45 across the year. */
export function declination(dayOfYear: number): number {
  return 23.45 * Math.sin(rad((360 * (284 + dayOfYear)) / 365));
}

/** Local clock time -> solar time, hours. See the sign note at the top of this file. */
export function solarTimeHours(
  clockHour: number,
  dayOfYear: number,
  longitude: number,
  standardMeridian: number,
): number {
  const minutes = 4 * (longitude - standardMeridian) + equationOfTime(dayOfYear);
  return clockHour + minutes / 60;
}

/** Hour angle, degrees. 15 deg per hour, negative before solar noon. */
export function hourAngle(solarHour: number): number {
  return 15 * (solarHour - 12);
}

/** Sun position for a site at a local clock time. */
export function sunPosition(
  latitude: number,
  longitude: number,
  standardMeridian: number,
  dayOfYear: number,
  clockHour: number,
): SunPosition {
  const solarHour = solarTimeHours(clockHour, dayOfYear, longitude, standardMeridian);
  const omega = rad(hourAngle(solarHour));
  const delta = rad(declination(dayOfYear));
  const phi = rad(latitude);

  const sinAlt = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(omega);
  const altitude = deg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
  const zenith = 90 - altitude;

  // atan2 form: robust at the poles and across noon, unlike the arccos form.
  const azimuth = deg(
    Math.atan2(
      Math.sin(omega),
      Math.cos(omega) * Math.sin(phi) - Math.tan(delta) * Math.cos(phi),
    ),
  );

  return { altitude, zenith, azimuth, cosZenith: Math.max(0, sinAlt), solarHour };
}

/**
 * cos of the angle of incidence on a surface. Duffie & Beckman eq. 1.6.3.
 * This is the only question the rest of the engine actually asks of this module:
 * how square-on is the sun to this particular wall right now? 1 = straight on,
 * 0 = edge-on. Clamped at 0 -- a surface facing away receives no beam radiation.
 */
export function cosIncidence(sun: SunPosition, tilt: number, surfaceAzimuth: number): number {
  const thetaZ = rad(sun.zenith);
  const beta = rad(tilt);
  const gammaDiff = rad(sun.azimuth - surfaceAzimuth);
  const c =
    Math.cos(thetaZ) * Math.cos(beta) + Math.sin(thetaZ) * Math.sin(beta) * Math.cos(gammaDiff);
  return Math.max(0, c);
}

/** Half-day length in hours: hour angle at sunrise/sunset. 0 for polar night. */
export function halfDayHours(latitude: number, dayOfYear: number): number {
  const x = -Math.tan(rad(latitude)) * Math.tan(rad(declination(dayOfYear)));
  if (x <= -1) return 12; // midnight sun
  if (x >= 1) return 0; // polar night
  return deg(Math.acos(x)) / 15;
}

/** Local CLOCK hour of solar noon. This is the value the sign error above corrupts. */
export function solarNoonClockHour(
  dayOfYear: number,
  longitude: number,
  standardMeridian: number,
): number {
  return 12 - (4 * (longitude - standardMeridian) + equationOfTime(dayOfYear)) / 60;
}

/** Local clock hours of sunrise and sunset. */
export function sunriseSunset(
  latitude: number,
  longitude: number,
  standardMeridian: number,
  dayOfYear: number,
): { sunrise: number; sunset: number } {
  const noon = solarNoonClockHour(dayOfYear, longitude, standardMeridian);
  const half = halfDayHours(latitude, dayOfYear);
  return { sunrise: noon - half, sunset: noon + half };
}
