import { describe, expect, it } from 'vitest';
import { dayOfYear, sunAngle, sunDirection } from './solar';

describe('dayOfYear', () => {
  it('counts from day 1 on Jan 1', () => {
    expect(dayOfYear('2023-01-01')).toBe(1);
    expect(dayOfYear('2023-12-31')).toBe(365);
  });
});

describe('sunAngle', () => {
  // Leh (34.1642N, 77.5771E), winter solstice. Chosen over the F2.md example's
  // "mid-January" because the winter solstice altitude is the one figure this
  // implementation can be checked against an independent, already-verified
  // source: packages/engine/src/solar/geometry.ts's own doc comment states
  // "peak altitude = 32.4 deg on 21 Dec" for this site (Duffie & Beckman ch. 1)
  // — mid-January (e.g. Jan 15) actually peaks noticeably higher (~34.6 deg,
  // the sun is already climbing back from the solstice), so asserting "~32 deg"
  // for a January date would either be wrong or need a tolerance wide enough
  // to hide a real bug. Solar noon (clockHour chosen so the hour angle is ~0)
  // still exercises the same declination + hour-angle formulas the F2.md
  // condition asks for.
  it('solar noon at Leh on the winter solstice: sun due south, altitude ~32.4 deg', () => {
    const lat = 34.1642;
    const lon = 77.5771;
    const date = '2023-12-21';

    // Scan near clock noon for the peak (solar noon isn't exactly clock noon —
    // the equation of time and longitude-vs-meridian offset shift it by tens
    // of minutes) rather than assuming a fixed clock hour.
    let peak = sunAngle(lat, lon, date, 11);
    for (let h = 11; h <= 13; h += 1 / 60) {
      const a = sunAngle(lat, lon, date, h);
      if (a.altitude > peak.altitude) peak = a;
    }

    expect(peak.altitude).toBeCloseTo(32.4, 0); // within 0.5 deg
    expect(peak.azimuth).toBeCloseTo(0, 0); // due south
  });

  it('the sun is down at midnight', () => {
    const { altitude } = sunAngle(34.1642, 77.5771, '2023-12-21', 0);
    expect(altitude).toBeLessThan(0);
  });
});

describe('sunDirection', () => {
  it('points up and toward +Z (south) at solar noon in the northern hemisphere winter', () => {
    const dir = sunDirection(34.1642, 77.5771, '2023-12-21', 12);
    expect(dir.y).toBeGreaterThan(0); // above the horizon
    expect(dir.z).toBeGreaterThan(0); // toward south
    expect(Math.abs(dir.x)).toBeLessThan(0.1); // ~due south, negligible E/W component
    // unit vector
    expect(Math.hypot(dir.x, dir.y, dir.z)).toBeCloseTo(1, 5);
  });
});
