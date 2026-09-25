// Small pure solar-position function: declination + hour angle from date,
// latitude/longitude and a local clock hour -> a unit direction vector in
// the same world frame as geometry.ts (+X = East, +Z = South, Y = up).
//
// Deliberately NOT imported from @shelter/engine, even though
// packages/engine/src/solar/geometry.ts implements the identical textbook
// formulas (Duffie & Beckman, ch. 1) — the client only imports *types* from
// @shelter/engine (API.md §0, SUBAGENT RULES §2), so this is an independent
// second implementation of the same public-domain astronomy, not a shared
// runtime dependency. It uses the engine's own documented sign convention
// ("azimuth measured from south, negative = East, positive = West") so a
// sun azimuth and a building/surface azimuth (geometry.ts) agree.

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** ISO 'YYYY-MM-DD' -> day of year (1-365/366), evaluated in UTC so the
 *  result doesn't depend on the browser's local timezone. */
export function dayOfYear(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - startOfYear) / 86_400_000) + 1;
}

/** Spencer (1971) equation of time, minutes — clock noon vs. solar noon. */
function equationOfTime(doy: number): number {
  const B = ((360 * (doy - 1)) / 365) * DEG2RAD;
  return (
    229.2 *
    (0.000075 +
      0.001868 * Math.cos(B) -
      0.032077 * Math.sin(B) -
      0.014615 * Math.cos(2 * B) -
      0.04089 * Math.sin(2 * B))
  );
}

/** Cooper (1969) solar declination, degrees. Ranges +/-23.45 across the year. */
function declination(doy: number): number {
  return 23.45 * Math.sin(((360 * (284 + doy)) / 365) * DEG2RAD);
}

/** Nearest 15-degree standard meridian to a longitude.
 *  ponytail: a light approximation — the real value is the site's actual
 *  UTC-offset meridian (which the browser doesn't have for a bundled preset
 *  location without a server round trip); fine for a decorative sun-angle
 *  preview since it only shifts *when* solar noon falls within an hour or
 *  so, not the noon altitude itself. Not fed back into the physics engine —
 *  upgrade to the real meridian (studio-server's `standardMeridian`, API.md
 *  §3's custom-location weather resolution) if the preview needs to match
 *  clock-hour exactly. */
function approximateStandardMeridian(longitude: number): number {
  return Math.round(longitude / 15) * 15;
}

export interface SunAngle {
  /** Degrees above the horizon, negative when the sun is down. */
  altitude: number;
  /** Degrees from south, negative = East, positive = West. */
  azimuth: number;
}

/** Sun position for a site at a local clock hour (0-24, fractional allowed). */
export function sunAngle(
  latitude: number,
  longitude: number,
  isoDate: string,
  clockHour: number,
): SunAngle {
  const doy = dayOfYear(isoDate);
  const standardMeridian = approximateStandardMeridian(longitude);
  const solarHour = clockHour + (4 * (longitude - standardMeridian) + equationOfTime(doy)) / 60;
  const omega = 15 * (solarHour - 12) * DEG2RAD;
  const delta = declination(doy) * DEG2RAD;
  const phi = latitude * DEG2RAD;

  const sinAlt = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(omega);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * RAD2DEG;

  // atan2 form: robust at the poles and across solar noon.
  const azimuth =
    Math.atan2(
      Math.sin(omega),
      Math.cos(omega) * Math.sin(phi) - Math.tan(delta) * Math.cos(phi),
    ) * RAD2DEG;

  return { altitude, azimuth };
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Unit vector from the scene origin toward the sun (world frame: +X = East,
 *  +Z = South, Y = up — matches geometry.ts). Use it as a directional
 *  light's position (scaled by some distance); the light then shines back
 *  toward the origin, matching the physical sun direction. */
export function sunDirection(
  latitude: number,
  longitude: number,
  isoDate: string,
  clockHour: number,
): Vec3 {
  const { altitude, azimuth } = sunAngle(latitude, longitude, isoDate, clockHour);
  const altRad = altitude * DEG2RAD;
  const azRad = azimuth * DEG2RAD;
  const horizontal = Math.cos(altRad);
  return {
    x: -Math.sin(azRad) * horizontal,
    y: Math.sin(altRad),
    z: Math.cos(azRad) * horizontal,
  };
}
