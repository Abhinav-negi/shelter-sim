/**
 * T-18: mountain horizon and window overhangs.
 * Leh: 34.15 N, 77.58 E, IST standard meridian 82.5 E (same fixture as solar.test.ts).
 */

import { describe, it, expect } from 'vitest';
import { sunPosition, sunriseSunset, solarNoonClockHour } from '../src/solar/geometry.js';
import type { SunPosition } from '../src/solar/geometry.js';
import { horizonBlockFactor, overhangSunlitFraction } from '../src/solar/shading.js';
import { EngineError } from '../src/types.js';

const LEH = { lat: 34.15, lon: 77.58, meridian: 82.5 };
const DEC21 = 355;
const JUN21 = 172;

function sunAt(hour: number, doy = DEC21): SunPosition {
  return sunPosition(LEH.lat, LEH.lon, LEH.meridian, doy, hour);
}

describe('horizonBlockFactor -- no profile (flat plain)', () => {
  it('is 1 whenever the sun is up and 0 whenever it is not, over a full day at Leh on 21 Dec', () => {
    const { sunrise, sunset } = sunriseSunset(LEH.lat, LEH.lon, LEH.meridian, DEC21);
    // sunrise/sunset are logged in the Evidence block.
    for (let h = 0; h <= 24; h += 0.05) {
      const sun = sunAt(h);
      const expected = sun.altitude > 0 ? 1 : 0;
      expect(horizonBlockFactor(sun)).toBe(expected);
    }
    expect(sunrise).toBeGreaterThan(0);
    expect(sunset).toBeGreaterThan(sunrise);
  });
});

describe('horizonBlockFactor -- flat 20 deg horizon in every direction', () => {
  const FLAT_20 = new Array(36).fill(20);

  it('blocks the sun exactly while altitude < 20 deg, matching sunPosition directly', () => {
    for (let h = 0; h <= 24; h += 0.02) {
      const sun = sunAt(h);
      const expected = sun.altitude >= 20 ? 1 : 0;
      expect(horizonBlockFactor(sun, FLAT_20)).toBe(expected);
    }
  });

  it('finds the morning and evening transition hours (pasted into Evidence)', () => {
    // Fine-grained scan for the altitude === 20 deg crossings.
    let morning = NaN;
    let evening = NaN;
    let prevAlt = sunAt(0).altitude;
    for (let h = 0.001; h <= 24; h += 0.001) {
      const alt = sunAt(h).altitude;
      if (prevAlt < 20 && alt >= 20 && Number.isNaN(morning)) morning = h;
      if (prevAlt >= 20 && alt < 20 && !Number.isNaN(morning) && Number.isNaN(evening)) evening = h;
      prevAlt = alt;
    }
    expect(morning).toBeGreaterThan(0);
    expect(evening).toBeGreaterThan(morning);
    // Cross-check: horizonBlockFactor agrees at points straddling each transition.
    expect(horizonBlockFactor(sunAt(morning - 0.01), FLAT_20)).toBe(0);
    expect(horizonBlockFactor(sunAt(morning + 0.01), FLAT_20)).toBe(1);
    expect(horizonBlockFactor(sunAt(evening - 0.01), FLAT_20)).toBe(1);
    expect(horizonBlockFactor(sunAt(evening + 0.01), FLAT_20)).toBe(0);
  });
});

describe('horizonBlockFactor -- 36 zeros reproduces the no-profile result exactly', () => {
  it('matches at every sampled hour of the day', () => {
    const ZEROS = new Array(36).fill(0);
    for (let h = 0; h <= 24; h += 0.05) {
      const sun = sunAt(h);
      expect(horizonBlockFactor(sun, ZEROS)).toBe(horizonBlockFactor(sun));
    }
  });
});

describe('horizonBlockFactor -- input validation', () => {
  it('throws EngineError(INVALID_INPUT) for a 35-value profile', () => {
    const sun = sunAt(12);
    const bad = new Array(35).fill(10);
    expect(() => horizonBlockFactor(sun, bad)).toThrow(EngineError);
    try {
      horizonBlockFactor(sun, bad);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(EngineError);
      expect((e as EngineError).code).toBe('INVALID_INPUT');
    }
  });
});

describe('overhangSunlitFraction -- overhangDepth = 0 always returns 1', () => {
  it('holds for 200 sampled sun positions, including ones below the horizon', () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 200; i++) {
      const sun: SunPosition = {
        altitude: rand() * 180 - 90,
        zenith: 0,
        azimuth: rand() * 360 - 180,
        cosZenith: 0,
        solarHour: 12,
      };
      const result = overhangSunlitFraction(sun, rand() * 360 - 180, 1.2, 0, 0.3);
      expect(result).toBe(1.0);
    }
  });
});

describe('overhangSunlitFraction -- the classic Leh overhang design check', () => {
  // South window, 1.2 m tall. A 1.0 m deep overhang, mounted 1.0 m above the
  // window top, fully shades the window at the (near-79 deg) June noon sun and
  // lets the (near-32 deg) December noon sun clear it completely.
  const WINDOW_HEIGHT = 1.2;
  const OVERHANG_DEPTH = 1.0;
  const OVERHANG_HEIGHT_ABOVE = 1.0;
  const SOUTH = 0;

  it('fully shades the window at solar noon on 21 Jun', () => {
    const noon = solarNoonClockHour(JUN21, LEH.lon, LEH.meridian);
    const sun = sunAt(noon, JUN21);
    const fraction = overhangSunlitFraction(
      sun,
      SOUTH,
      WINDOW_HEIGHT,
      OVERHANG_DEPTH,
      OVERHANG_HEIGHT_ABOVE,
    );
    expect(fraction).toBeCloseTo(0.0, 9);
  });

  it('fully sunlit at solar noon on 21 Dec', () => {
    const noon = solarNoonClockHour(DEC21, LEH.lon, LEH.meridian);
    const sun = sunAt(noon, DEC21);
    const fraction = overhangSunlitFraction(
      sun,
      SOUTH,
      WINDOW_HEIGHT,
      OVERHANG_DEPTH,
      OVERHANG_HEIGHT_ABOVE,
    );
    expect(fraction).toBeCloseTo(1.0, 9);
  });
});

describe('overhangSunlitFraction -- bounds and continuity', () => {
  it('stays within [0, 1] for 1000 randomly sampled sun positions and surface azimuths', () => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 1000; i++) {
      const sun: SunPosition = {
        altitude: rand() * 180 - 90,
        zenith: 0,
        azimuth: rand() * 360 - 180,
        cosZenith: 0,
        solarHour: 12,
      };
      const surfaceAzimuth = rand() * 360 - 180;
      const windowHeight = 0.5 + rand() * 2;
      const overhangDepth = rand() * 2;
      const overhangHeightAbove = rand() * 1;
      const result = overhangSunlitFraction(
        sun,
        surfaceAzimuth,
        windowHeight,
        overhangDepth,
        overhangHeightAbove,
      );
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    }
  });

  it('has no jump greater than 0.05 sweeping altitude 0-80 deg in 0.1 deg steps', () => {
    const surfaceAzimuth = 0;
    const windowHeight = 1.2;
    const overhangDepth = 0.5;
    const overhangHeightAbove = 0.3;
    let prev: number | null = null;
    let maxJump = 0;
    for (let alt = 0; alt <= 80; alt += 0.1) {
      const sun: SunPosition = { altitude: alt, zenith: 90 - alt, azimuth: 0, cosZenith: 0, solarHour: 12 };
      const fraction = overhangSunlitFraction(
        sun,
        surfaceAzimuth,
        windowHeight,
        overhangDepth,
        overhangHeightAbove,
      );
      if (prev !== null) maxJump = Math.max(maxJump, Math.abs(fraction - prev));
      prev = fraction;
    }
    expect(maxJump).toBeLessThanOrEqual(0.05);
  });

  it('returns 0 when the sun is directly behind the wall (wallRelativeAzimuth = 150 deg)', () => {
    const sun: SunPosition = { altitude: 45, zenith: 45, azimuth: 150, cosZenith: 0.7, solarHour: 12 };
    expect(overhangSunlitFraction(sun, 0, 1.2, 1.0, 0.3)).toBe(0);
  });
});

describe('overhangSunlitFraction -- input validation', () => {
  it('throws EngineError(INVALID_INPUT) for windowHeight <= 0', () => {
    const sun = sunAt(12);
    expect(() => overhangSunlitFraction(sun, 0, 0, 1, 0.3)).toThrow(EngineError);
    expect(() => overhangSunlitFraction(sun, 0, -1, 1, 0.3)).toThrow(EngineError);
  });
});
