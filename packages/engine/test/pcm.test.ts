/**
 * T-19 acceptance tests for the PCM apparent-heat-capacity module.
 * LOG.md "### [~] T-19 -- Phase-change materials: apparent heat capacity".
 * Reference material: paraffin RT25, BLUEPRINT.md Appendix B --
 * L_f = 200000 J/kg, melt range 3 K, c_base = 2000 J/(kg*K), melts near 25 degC.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { apparentHeatCapacity, pcmEnthalpy } from '../src/storage/pcm.js';
import { EngineError } from '../src/types.js';
import { toK, asK } from '../src/units.js';
import type { Kelvin } from '../src/units.js';

const PCM_SRC = fileURLToPath(new URL('../src/storage/pcm.ts', import.meta.url));

const L_F = 200000; // J/kg
const RANGE = 3; // K
const C_BASE = 2000; // J/(kg*K)
const MELT_POINT: Kelvin = toK(25); // paraffin RT25, ~298.15 K

describe('Test 1 -- the spike', () => {
  it('is ~68,667 J/(kg*K) inside the band, and exactly cBase 5 K below/above', () => {
    const inside = apparentHeatCapacity(C_BASE, L_F, MELT_POINT, RANGE, MELT_POINT);
    const below = apparentHeatCapacity(C_BASE, L_F, MELT_POINT, RANGE, asK((MELT_POINT as number) - 5));
    const above = apparentHeatCapacity(C_BASE, L_F, MELT_POINT, RANGE, asK((MELT_POINT as number) + 5));

    // eslint-disable-next-line no-console
    console.log(`T-19 Test 1: inside=${inside}  below(-5K)=${below}  above(+5K)=${above}`);

    expect(inside).toBeCloseTo(2000 + 200000 / 3, 2); // ~= 68666.67
    expect(inside).toBeGreaterThan(68666);
    expect(inside).toBeLessThan(68667);
    expect(below).toBe(2000);
    expect(above).toBe(2000);
  });
});

describe('Test 2 -- latent-heat conservation', () => {
  it('numerically integrating apparentHeatCapacity across the full melt band recovers latentHeat + cBase*meltRangeK', () => {
    const a = (MELT_POINT as number) - RANGE / 2;
    const b = (MELT_POINT as number) + RANGE / 2;
    const N = 200000;
    const h = (b - a) / N;
    let integral = 0;
    for (let i = 0; i < N; i++) {
      const t0 = asK(a + i * h);
      const t1 = asK(a + (i + 1) * h);
      const c0 = apparentHeatCapacity(C_BASE, L_F, MELT_POINT, RANGE, t0);
      const c1 = apparentHeatCapacity(C_BASE, L_F, MELT_POINT, RANGE, t1);
      integral += (h * (c0 + c1)) / 2; // trapezoidal rule
    }
    const expected = L_F + C_BASE * RANGE;

    // eslint-disable-next-line no-console
    console.log(`T-19 Test 2: computed integral=${integral}  expected=${expected}`);

    expect(Math.abs(integral - expected) / expected).toBeLessThan(0.001);
  });
});

describe('Test 3 -- pcmEnthalpy monotonicity', () => {
  it('never decreases across a 40 K sweep in 0.1 K steps', () => {
    const start = (MELT_POINT as number) - 20;
    let prev = pcmEnthalpy(C_BASE, L_F, MELT_POINT, RANGE, asK(start), MELT_POINT);
    for (let i = 1; i <= 400; i++) {
      const t = asK(start + i * 0.1);
      const h = pcmEnthalpy(C_BASE, L_F, MELT_POINT, RANGE, t, MELT_POINT);
      expect(h).toBeGreaterThanOrEqual(prev);
      prev = h;
    }
  });
});

describe('Test 4 -- pcmEnthalpy derivative matches apparentHeatCapacity', () => {
  it('central finite difference matches within 1% at 50 sampled temperatures below/inside/above the band', () => {
    const h = 1e-3;
    const N = 50;
    let maxRelErr = 0;
    for (let i = 0; i < N; i++) {
      // Spread samples over +/- 20 K, offset so none land exactly on the band edges.
      const offset = -20 + (40 * (i + 0.37)) / N;
      const t = (MELT_POINT as number) + offset;
      const plus = pcmEnthalpy(C_BASE, L_F, MELT_POINT, RANGE, asK(t + h), MELT_POINT);
      const minus = pcmEnthalpy(C_BASE, L_F, MELT_POINT, RANGE, asK(t - h), MELT_POINT);
      const derivative = (plus - minus) / (2 * h);
      const expected = apparentHeatCapacity(C_BASE, L_F, MELT_POINT, RANGE, asK(t));
      const relErr = Math.abs(derivative - expected) / expected;
      maxRelErr = Math.max(maxRelErr, relErr);
    }

    // eslint-disable-next-line no-console
    console.log(`T-19 Test 4: max relative error over 50 samples = ${maxRelErr}`);

    expect(maxRelErr).toBeLessThan(0.01);
  });
});

describe('Test 5 -- latentHeat = 0 degenerates to plain specific heat', () => {
  it('apparentHeatCapacity is exactly cBase everywhere, pcmEnthalpy is exactly cBase*(t-tRef)', () => {
    const temps = [-40, -5, 0, 5, 40].map((d) => asK((MELT_POINT as number) + d));
    for (const t of temps) {
      expect(apparentHeatCapacity(C_BASE, 0, MELT_POINT, RANGE, t)).toBe(C_BASE);
    }
    const tRef = asK((MELT_POINT as number) - 30);
    for (const t of temps) {
      const expected = C_BASE * ((t as number) - (tRef as number));
      expect(pcmEnthalpy(C_BASE, 0, MELT_POINT, RANGE, t, tRef)).toBeCloseTo(expected, 6);
    }
  });
});

describe('Test 6 -- symmetry about meltPoint', () => {
  it('apparentHeatCapacity(meltPoint + x) === apparentHeatCapacity(meltPoint - x) for 20 sampled x', () => {
    for (let i = 1; i <= 20; i++) {
      const x = i * 0.5; // 0.5 K .. 10 K, straddles the 1.5 K half-band
      const plus = apparentHeatCapacity(C_BASE, L_F, MELT_POINT, RANGE, asK((MELT_POINT as number) + x));
      const minus = apparentHeatCapacity(C_BASE, L_F, MELT_POINT, RANGE, asK((MELT_POINT as number) - x));
      expect(plus).toBe(minus);
    }
  });
});

describe('Tests 7/8 -- meltRangeK guard', () => {
  it('meltRangeK = 0 throws EngineError(INVALID_INPUT)', () => {
    expect(() => apparentHeatCapacity(C_BASE, L_F, MELT_POINT, 0, MELT_POINT)).toThrow(EngineError);
    try {
      apparentHeatCapacity(C_BASE, L_F, MELT_POINT, 0, MELT_POINT);
    } catch (e) {
      expect((e as EngineError).code).toBe('INVALID_INPUT');
    }
  });

  it('meltRangeK = -1 throws EngineError(INVALID_INPUT)', () => {
    expect(() => apparentHeatCapacity(C_BASE, L_F, MELT_POINT, -1, MELT_POINT)).toThrow(EngineError);
    expect(() => pcmEnthalpy(C_BASE, L_F, MELT_POINT, -1, MELT_POINT, MELT_POINT)).toThrow(EngineError);
    try {
      apparentHeatCapacity(C_BASE, L_F, MELT_POINT, -1, MELT_POINT);
    } catch (e) {
      expect((e as EngineError).code).toBe('INVALID_INPUT');
    }
  });
});

describe('Tests 9/10 -- naming and documentation contract, checked against the file on disk', () => {
  const src = readFileSync(PCM_SRC, 'utf8');

  it('never names the method "enthalpy method" -- one name only, "apparent heat capacity"', () => {
    const matches = src.match(/enthalpy method/g);
    expect(matches ? matches.length : 0).toBe(0);
  });

  it('documents the refresh-cadence consequence and that the cadence must not change', () => {
    expect(/refresh.cadence/i.test(src)).toBe(true);
    expect(/not.{0,15}(be )?changed/i.test(src)).toBe(true);
  });
});
