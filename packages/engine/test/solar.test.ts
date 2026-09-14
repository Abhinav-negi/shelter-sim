/**
 * Validation Test 5: solar geometry against known references.
 * BLUEPRINT.md 9.5. Leh: 34.15 N, 77.58 E, IST standard meridian 82.5 E.
 *
 * "Every downstream number depends on this module" -- BLUEPRINT.md 5.3.
 */

import { describe, it, expect } from 'vitest';
import {
  declination,
  sunPosition,
  cosIncidence,
  equationOfTime,
  solarNoonClockHour,
  sunriseSunset,
  halfDayHours,
} from '../src/solar/geometry.js';

const LEH = { lat: 34.15, lon: 77.58, meridian: 82.5 };
// Day-of-year for the solstices and equinoxes (non-leap).
const DEC21 = 355;
const JUN21 = 172;
const MAR21 = 80;

describe('declination', () => {
  it('reaches -23.45 at the winter solstice and +23.45 at the summer solstice', () => {
    expect(declination(DEC21)).toBeCloseTo(-23.45, 0);
    expect(declination(JUN21)).toBeCloseTo(23.45, 0);
  });

  it('is near zero at the equinox', () => {
    expect(Math.abs(declination(MAR21))).toBeLessThan(1.0);
  });
});

describe('peak solar altitude at Leh (the analytically known check)', () => {
  // 90 - latitude + declination, evaluated at solar noon.
  const cases: Array<[string, number, number]> = [
    ['winter solstice', DEC21, 32.4],
    ['equinox', MAR21, 55.85],
    ['summer solstice', JUN21, 79.3],
  ];

  for (const [label, doy, expected] of cases) {
    it(`${label} -> ${expected} deg`, () => {
      const noon = solarNoonClockHour(doy, LEH.lon, LEH.meridian);
      const sun = sunPosition(LEH.lat, LEH.lon, LEH.meridian, doy, noon);
      expect(sun.altitude).toBeCloseTo(expected, 0);
    });
  }
});

describe('solar noon clock time (catches the ENGINE_BLUEPRINT sign error)', () => {
  /*
   * Leh is 4.92 deg WEST of the IST meridian, so the sun arrives ~19.7 min LATE.
   * With the equation-of-time term, solar noon sits between about 12:05 and 12:35 IST
   * across the year. The inverted sign would place it between 11:25 and 11:55,
   * which this test rejects. The peak-altitude tests above pass under BOTH signs,
   * which is exactly why this test has to exist.
   */
  it('is always after 12:00 IST at Leh, never before', () => {
    for (let doy = 1; doy <= 365; doy++) {
      const noon = solarNoonClockHour(doy, LEH.lon, LEH.meridian);
      expect(noon).toBeGreaterThan(12.0);
      expect(noon).toBeLessThan(12.6);
    }
  });

  it('isolates the pure longitude offset on a day when the equation of time is ~0', () => {
    /*
     * Around 15 April (doy 105) the equation of time passes through zero, so solar
     * noon there is the longitude term alone: 4*(82.5 - 77.58) = 19.68 min late.
     * 12 + 19.68/60 = 12.328. The inverted sign would give 11.672.
     */
    const APR15 = 105;
    expect(equationOfTime(APR15)).toBeCloseTo(0, 0);
    expect(solarNoonClockHour(APR15, LEH.lon, LEH.meridian)).toBeCloseTo(12.328, 2);
  });

  it('the equation of time stays within its textbook +/-16 minute envelope', () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let doy = 1; doy <= 365; doy++) {
      const e = equationOfTime(doy);
      lo = Math.min(lo, e);
      hi = Math.max(hi, e);
    }
    expect(lo).toBeGreaterThan(-15);
    expect(lo).toBeLessThan(-13);
    expect(hi).toBeGreaterThan(15);
    expect(hi).toBeLessThan(17);
  });
});

describe('sunrise and sunset at Leh', () => {
  it('gives a short winter day and a long summer day', () => {
    const winter = sunriseSunset(LEH.lat, LEH.lon, LEH.meridian, DEC21);
    const summer = sunriseSunset(LEH.lat, LEH.lon, LEH.meridian, JUN21);
    const winterLength = winter.sunset - winter.sunrise;
    const summerLength = summer.sunset - summer.sunrise;
    // Leh at 34 N: roughly 9.8 h in midwinter, 14.4 h in midsummer.
    expect(winterLength).toBeGreaterThan(9.3);
    expect(winterLength).toBeLessThan(10.3);
    expect(summerLength).toBeGreaterThan(13.9);
    expect(summerLength).toBeLessThan(14.9);
  });

  it('day length is symmetric about solar noon', () => {
    const noon = solarNoonClockHour(DEC21, LEH.lon, LEH.meridian);
    const { sunrise, sunset } = sunriseSunset(LEH.lat, LEH.lon, LEH.meridian, DEC21);
    expect((sunrise + sunset) / 2).toBeCloseTo(noon, 6);
  });

  it('equinox day length is ~12 h at every latitude', () => {
    for (const lat of [0, 15, 34.15, 55, 70]) {
      expect(halfDayHours(lat, MAR21) * 2).toBeCloseTo(12, 0);
    }
  });
});

describe('azimuth convention (south = 0, east negative, west positive)', () => {
  it('is due south at solar noon in the northern hemisphere', () => {
    const noon = solarNoonClockHour(DEC21, LEH.lon, LEH.meridian);
    const sun = sunPosition(LEH.lat, LEH.lon, LEH.meridian, DEC21, noon);
    expect(Math.abs(sun.azimuth)).toBeLessThan(0.5);
  });

  it('is east of south in the morning and west of south in the afternoon', () => {
    const noon = solarNoonClockHour(MAR21, LEH.lon, LEH.meridian);
    const morning = sunPosition(LEH.lat, LEH.lon, LEH.meridian, MAR21, noon - 3);
    const afternoon = sunPosition(LEH.lat, LEH.lon, LEH.meridian, MAR21, noon + 3);
    expect(morning.azimuth).toBeLessThan(0);
    expect(afternoon.azimuth).toBeGreaterThan(0);
  });
});

describe('incidence angle -- why orientation matters', () => {
  it('a south wall in midwinter beats a north wall, which sees no beam at all', () => {
    const noon = solarNoonClockHour(DEC21, LEH.lon, LEH.meridian);
    const sun = sunPosition(LEH.lat, LEH.lon, LEH.meridian, DEC21, noon);
    const south = cosIncidence(sun, 90, 0);
    const north = cosIncidence(sun, 90, 180);
    expect(south).toBeGreaterThan(0.8);
    expect(north).toBe(0);
  });

  it('a horizontal surface sees exactly cos(zenith)', () => {
    const sun = sunPosition(LEH.lat, LEH.lon, LEH.meridian, JUN21, 12);
    expect(cosIncidence(sun, 0, 0)).toBeCloseTo(sun.cosZenith, 10);
  });

  it('north-facing walls receive zero beam all winter (BLUEPRINT 9.8 symmetry check)', () => {
    for (let h = 0; h <= 24; h += 0.25) {
      const sun = sunPosition(LEH.lat, LEH.lon, LEH.meridian, DEC21, h);
      if (sun.altitude <= 0) continue;
      expect(cosIncidence(sun, 90, 180)).toBe(0);
    }
  });
});
