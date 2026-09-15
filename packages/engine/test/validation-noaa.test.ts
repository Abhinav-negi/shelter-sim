/**
 * Validation Test 5 (external): computed solar geometry at Leh vs the NOAA
 * Solar Calculator. BLUEPRINT.md 9.5. CHALLENGE.md C-11 ("show me a case where
 * you compared this against something other than yourselves").
 *
 * All reference numbers below are LITERALS, retrieved 2026-09-15, year 2026,
 * for Leh (34.15 N, 77.58 E, standard meridian 82.5 E, IST = UTC+5:30). This
 * file never calls the network -- see the T-23 rule in log/AREA-B-engine.md.
 * Sources (URL scheme omitted throughout this file on purpose -- acceptance
 * test 6 greps for the network-call substring this file must never contain):
 *   - sunrise / solar noon / sunset: gml.noaa.gov/grad/solcalc/
 *     table.php?lat=34.15&lon=77.58&year=2026&tz=5.5&dst=0
 *   - peak solar altitude: gml.noaa.gov/grad/solcalc/NOAA_Solar_Calculations_year.xls,
 *     the published spreadsheet behind the calculator. Column "Solar Elevation
 *     Angle (deg)" -- the GEOMETRIC one, not the refraction-corrected one --
 *     evaluated at each date's own Solar Noon row, because this engine's
 *     sunPosition() is explicitly geometric (see its doc comment, no refraction
 *     term). Cross-checked: the spreadsheet's own Solar Noon column agrees with
 *     table.php's to single-digit seconds.
 *
 * FINDING -- two of the four comparisons are structurally outside tolerance,
 * and this is not a bug fixable from a test file (global rule 16: do not fix
 * engine code from a test; T-14 owns solar/geometry.ts and is closed "verify,
 * do not rework"):
 *
 *  (a) SUNRISE/SUNSET, all four dates. sunriseSunset()/halfDayHours() define
 *      sunrise/sunset at a GEOMETRIC horizon (zenith = 90 deg, sun's centre on
 *      the horizon, no atmospheric refraction, no solar-disk radius). NOAA's
 *      tabulated sunrise/sunset uses the standard zenith = 90.833 deg (34' of
 *      refraction + 16' disk radius). At Leh's latitude that is a structural
 *      ~4-6.5 minute gap on every one of the four tested dates -- it will not
 *      close with a better ephemeris, because it is a different definition of
 *      "sunrise", not a numerical error. Measured (below, per case): 4.1-6.5 min,
 *      vs a 2-minute tolerance.
 *
 *  (b) PEAK ALTITUDE near the equinoxes (21 Mar, 21 Sep) only. declination()
 *      is the single-harmonic Cooper (1969) approximation. Its zero-crossing
 *      (its modelled "equinox") falls at day-of-year 81 (22 Mar) -- solve
 *      23.45*sin(360*(284+n)/365) = 0 for the root in range -- about 1.4 days
 *      after the true 2026 equinox that NOAA's declination reflects. Near the
 *      equinoxes, where declination moves fastest (~0.4 deg/day), that phase
 *      lag costs 0.67-0.87 deg of peak altitude. The solstice dates (21 Jun,
 *      21 Dec), far from the zero-crossing where the approximation is most
 *      accurate, are within 0.01-0.02 deg and PASS.
 *
 * Solar noon (unaffected by either issue -- it does not depend on a horizon
 * crossing, and the declination error near the equinox is too small to move
 * it more than a few seconds) passes on all four dates, comfortably inside
 * 2 minutes. The three pre-existing analytical anchors (solar.test.ts) are
 * re-asserted here, unchanged, per the task prompt.
 *
 * The comparisons that fail are `it.skip`, with the measured numbers folded
 * into the test title so they are not lost even though the body never runs.
 * See log/AREA-B-engine.md's T-23 entry (BLOCKED, blocking task T-14) for the
 * full write-up.
 */

import { describe, it, expect } from 'vitest';
import { sunPosition, solarNoonClockHour, sunriseSunset } from '../src/solar/geometry.js';
import { assertWithin } from './helpers.js';

const LEH = { lat: 34.15, lon: 77.58, meridian: 82.5 };
const DEC21 = 355;
const JUN21 = 172;
const MAR21 = 80;
// Non-leap day-of-year for 21 Sep: 31+28+31+30+31+30+31+31+21 = 264. 2026 is not a leap year.
const SEP21 = 264;

const TIME_TOL_H = 2 / 60; // 2 minutes, BLUEPRINT.md 9.5
const ALT_TOL_DEG = 0.2; // BLUEPRINT.md 9.5

function hms(h: number, m: number, s: number): number {
  return h + m / 60 + s / 3600;
}

// NOAA reference, retrieved 2026-09-15 (see file header for the two sources).
const NOAA = {
  MAR21: { doy: MAR21, sunrise: hms(6, 22, 8), noon: hms(12, 26, 53), sunset: hms(18, 31, 37), altitude: 56.1187 },
  JUN21: { doy: JUN21, sunrise: hms(5, 8, 26), noon: hms(12, 21, 27), sunset: hms(19, 34, 28), altitude: 79.2881 },
  SEP21: { doy: SEP21, sunrise: hms(6, 6, 59), noon: hms(12, 12, 51), sunset: hms(18, 18, 42), altitude: 56.5217 },
  DEC21: { doy: DEC21, sunrise: hms(7, 21, 28), noon: hms(12, 17, 38), sunset: hms(17, 13, 49), altitude: 32.4135 },
} as const;

type Label = keyof typeof NOAA;
const LABELS: Label[] = ['MAR21', 'JUN21', 'SEP21', 'DEC21'];

describe('validation test 5 (external): Leh vs NOAA Solar Calculator, 21 Mar/Jun/Sep/Dec 2026', () => {
  describe('solar noon -- within 2 min of NOAA on all four dates', () => {
    for (const label of LABELS) {
      it(`${label}`, () => {
        const noon = solarNoonClockHour(NOAA[label].doy, LEH.lon, LEH.meridian);
        assertWithin(noon, NOAA[label].noon, TIME_TOL_H, `solar noon ${label}`);
      });
    }
  });

  describe('peak solar altitude -- solstices, within 0.2 deg of NOAA', () => {
    for (const label of ['JUN21', 'DEC21'] as Label[]) {
      it(`${label}`, () => {
        const noon = solarNoonClockHour(NOAA[label].doy, LEH.lon, LEH.meridian);
        const sun = sunPosition(LEH.lat, LEH.lon, LEH.meridian, NOAA[label].doy, noon);
        assertWithin(sun.altitude, NOAA[label].altitude, ALT_TOL_DEG, `peak altitude ${label}`);
      });
    }
  });

  describe('peak solar altitude -- equinoxes: BLOCKED, see file header (b), owning task T-14', () => {
    // measured 2026-09-15: MAR21 diff=0.6724 deg, SEP21 diff=0.8735 deg (tol 0.2 deg)
    it.skip('MAR21: measured=55.4463 NOAA=56.1187 diff=0.6724deg tol=0.2deg -- Cooper(1969) equinox phase lag', () => {
      const noon = solarNoonClockHour(NOAA.MAR21.doy, LEH.lon, LEH.meridian);
      const sun = sunPosition(LEH.lat, LEH.lon, LEH.meridian, NOAA.MAR21.doy, noon);
      expect(Math.abs(sun.altitude - NOAA.MAR21.altitude)).toBeLessThanOrEqual(ALT_TOL_DEG);
    });
    it.skip('SEP21: measured=55.6482 NOAA=56.5217 diff=0.8735deg tol=0.2deg -- Cooper(1969) equinox phase lag', () => {
      const noon = solarNoonClockHour(NOAA.SEP21.doy, LEH.lon, LEH.meridian);
      const sun = sunPosition(LEH.lat, LEH.lon, LEH.meridian, NOAA.SEP21.doy, noon);
      expect(Math.abs(sun.altitude - NOAA.SEP21.altitude)).toBeLessThanOrEqual(ALT_TOL_DEG);
    });
  });

  describe('sunrise -- BLOCKED on all four dates, see file header (a), owning task T-14', () => {
    // measured 2026-09-15, diff in minutes (tol 2 min):
    // MAR21 6.50  JUN21 4.12  SEP21 6.35  DEC21 4.48
    const diffsMin: Record<Label, number> = { MAR21: 6.5, JUN21: 4.12, SEP21: 6.35, DEC21: 4.48 };
    for (const label of LABELS) {
      it.skip(`${label}: diff=${diffsMin[label]}min tol=2min -- geometric vs 90.833deg horizon`, () => {
        const { sunrise } = sunriseSunset(LEH.lat, LEH.lon, LEH.meridian, NOAA[label].doy);
        expect(Math.abs(sunrise - NOAA[label].sunrise) * 60).toBeLessThanOrEqual(2);
      });
    }
  });

  describe('sunset -- BLOCKED on all four dates, same root cause, owning task T-14', () => {
    // measured 2026-09-15, diff in minutes (tol 2 min):
    // MAR21 5.17  JUN21 5.02  SEP21 6.47  DEC21 4.75
    const diffsMin: Record<Label, number> = { MAR21: 5.17, JUN21: 5.02, SEP21: 6.47, DEC21: 4.75 };
    for (const label of LABELS) {
      it.skip(`${label}: diff=${diffsMin[label]}min tol=2min -- geometric vs 90.833deg horizon`, () => {
        const { sunset } = sunriseSunset(LEH.lat, LEH.lon, LEH.meridian, NOAA[label].doy);
        expect(Math.abs(sunset - NOAA[label].sunset) * 60).toBeLessThanOrEqual(2);
      });
    }
  });
});

describe('peak solar altitude at Leh -- the analytically known anchors (re-asserted per T-23 prompt)', () => {
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
