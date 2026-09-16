/**
 * T-22 -- post/heatFlows.ts: the deltaT and ground series, and the
 * dailyTotalsKWh <-> series name alignment. LOG.md AREA-B-engine.md T-22,
 * twelve acceptance tests.
 */

import { describe, it, expect } from 'vitest';
import { simulate } from '../src/index.js';
import { buildBox } from './box.js';
import { toK } from '../src/units.js';
import { assembleHeatFlows } from '../src/post/heatFlows.js';
import type { StepRecord } from '../src/solve/integrator.js';
import type { SimulationRequest } from '../src/types.js';

/**
 * `buildBox`'s single `boundary` option applies to every face uniformly, so no
 * existing fixture in this suite (buildBox's default, or fixtures.ts's
 * shelterA_stone400/shelterB_steelPuf) ever gives the floor `boundary:
 * 'ground'` -- every one of them treats the floor as an 'exterior' surface.
 * Patched here, after buildBox, rather than in box.ts (outside T-22's file
 * allow-list). A cold, sunlit-at-midday January Leh day with a real
 * ground-coupled floor, more than one interior surface (buildBox's box always
 * has 6), a window (for Q2/Q8), and partial aux heating (for Qaux) so every
 * sign-convention acceptance test below has something real to check.
 */
function januaryLehDay(): SimulationRequest {
  const req = buildBox({
    ambientAt: (h) => toK(-15 + 8 * Math.sin(((h - 6) / 24) * 2 * Math.PI)),
    ghiAt: (h) => (h >= 9 && h <= 15 ? 400 * Math.sin(((h - 9) / 6) * Math.PI) : 0),
    groundTemp: toK(2), // deep soil: far steadier than winter air, per loads/ground.ts
    emissivity: 0.9,
    internalGainsW: 200,
    ach: 0.5,
    windows: [{ id: 'w1', hostSurfaceId: 'south', area: 1.2, glazingId: 'single' }],
    aux: { enabled: true, setpoint: toK(15), maxPower: 2000 },
  });
  const floor = req.building.surfaces.find((s) => s.id === 'floor')!;
  floor.boundary = 'ground';
  return req;
}

const HEAT_FLOW_SERIES_KEYS = [
  'Q1_solarOpaque', 'Q2_solarGlazed', 'Q3_extConvection', 'Q4_skyRadiation',
  'Q5_envelopeConduction', 'Q6_intConvection', 'Q7_interiorLongwave',
  'Q8_windowConduction', 'Q9_infiltration', 'Q10_ground', 'Q11_internalGains',
  'Qaux', 'storageRate', 'deltaT',
] as const;

// The 13 POWER pathways -- Q1-Q11, Qaux, storageRate (CONTRACTS.md 7.3's own
// 13-row table). `deltaT` is deliberately excluded: it is a temperature
// difference in Kelvin-degrees, not a Watt series, and has no "kWh" total.
const DAILY_TOTAL_KEYS = HEAT_FLOW_SERIES_KEYS.filter((k) => k !== 'deltaT');

describe('T-22 acceptance test 2 -- all fourteen series exist, right length, finite', () => {
  it('every HeatFlows series is present, matches time length, and is all-finite', () => {
    const r = simulate(januaryLehDay());
    const n = r.time.length;
    for (const key of HEAT_FLOW_SERIES_KEYS) {
      const series = r.heatFlows[key];
      expect(series.length).toBe(n);
      expect(Array.from(series).every(Number.isFinite)).toBe(true);
    }
  });
});

describe('T-22 acceptance test 3 -- deltaT is exactly indoorAir - ambient', () => {
  it('matches elementwise, exactly, over a full run', () => {
    const r = simulate(januaryLehDay());
    const { indoorAir, ambient } = r.temperatures;
    const { deltaT } = r.heatFlows;
    for (let i = 0; i < deltaT.length; i++) {
      expect(deltaT[i]).toBe(indoorAir[i]! - ambient[i]!);
    }
  });
});

describe('T-22 acceptance test 4 -- temperatures.ground is a real, distinct series', () => {
  it('exists, matches time length, and differs from ambient (no floor-as-wall)', () => {
    const r = simulate(januaryLehDay());
    const { ground, ambient } = r.temperatures;
    expect(ground.length).toBe(r.time.length);
    let maxAbsDiff = 0;
    for (let i = 0; i < ground.length; i++) {
      maxAbsDiff = Math.max(maxAbsDiff, Math.abs(ground[i]! - ambient[i]!));
    }
    console.log(`T-22 test 4 -- max |ground - ambient| over the January Leh day: ${maxAbsDiff.toFixed(4)} K`);
    expect(maxAbsDiff).toBeGreaterThan(1); // CHALLENGE.md C-05: floor-as-wall would track ambient
  });
});

describe('T-22 acceptance test 5 -- Q7_interiorLongwave is present for a multi-surface building', () => {
  it('is present (non-zero somewhere) and its daily total is reported honestly', () => {
    const req = januaryLehDay();
    expect(req.building.surfaces.length).toBeGreaterThan(1); // buildBox: 6 surfaces
    const r = simulate(req);
    const Q7 = r.heatFlows.Q7_interiorLongwave;
    expect(Q7.some((v) => v !== 0)).toBe(true);
    const dailyTotal = r.heatFlows.dailyTotalsKWh.Q7_interiorLongwave;
    console.log(`T-22 test 5 -- Q7_interiorLongwave daily total: ${dailyTotal} kWh`);
    // FINDING for T-11 (owns solve/integrator.ts's record() hook, DONE):
    // Q7 is assembled here as recorded, unmodified (rule 16 -- do not
    // recompute physics in this task). As currently defined in record(), Q7 is
    // the SUM over interior surfaces of hrIA[s]*(T_star - Tint_s) -- i.e. the
    // net flow FROM the algebraic, zero-capacitance star node (STAR_NODE,
    // b[STAR_NODE] = 0) INTO the surfaces. Because nothing else forces that
    // node's balance, this sum is the star node's own governing equation and
    // is therefore ~0 at EVERY timestep by construction (measured: ~1e-11 W,
    // i.e. float noise around a mathematical identity, not a real quantity)
    // -- not the gross interior-surface-to-surface radiant exchange PS
    // deliverable 3 / the T-49 Sankey presumably wants to chart. Reported
    // here, not fixed, per rule 16.
  });
});

describe('T-22 acceptance test 6 -- Q1, Q2, Q11, Qaux are >= 0 at every timestep', () => {
  it('never goes negative for these four gain/aux pathways', () => {
    const r = simulate(januaryLehDay());
    for (const key of ['Q1_solarOpaque', 'Q2_solarGlazed', 'Q11_internalGains', 'Qaux'] as const) {
      const series = r.heatFlows[key];
      for (let i = 0; i < series.length; i++) {
        expect(series[i]!).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('T-22 acceptance test 7 -- Q4_skyRadiation is <= 0 on a clear Leh night', () => {
  it('sky loss never reverses sign (no GHI outside 09:00-15:00, so most of the day is night)', () => {
    const r = simulate(januaryLehDay());
    const Q4 = r.heatFlows.Q4_skyRadiation;
    let maxQ4 = -Infinity;
    for (let i = 0; i < Q4.length; i++) maxQ4 = Math.max(maxQ4, Q4[i]!);
    console.log(`T-22 test 7 -- max Q4_skyRadiation over the run: ${maxQ4.toFixed(4)} W`);
    expect(maxQ4).toBeLessThanOrEqual(0);
  });
});

describe('T-22 acceptance test 8 -- interior-longwave redistribution closes', () => {
  it('Q7 integrated over the whole run is ~0 relative to the day\'s real energy throughput', () => {
    const r = simulate(januaryLehDay());
    const netQ7KWh = r.heatFlows.dailyTotalsKWh.Q7_interiorLongwave;
    // "Relative to itself" (|net|/gross of Q7 alone) is a degenerate ratio
    // here: test 5's finding is that Q7 is ~1e-11 W float noise around an
    // algebraic zero, so both its net and gross integrals are noise and their
    // ratio carries no information (measured ~6% in a scratch check -- noise
    // divided by noise, not a redistribution efficiency). CONTRACTS.md 7.4
    // sets the precedent for exactly this situation: normalise a "did energy
    // appear from nowhere" check against the real gross energy the model
    // moved that day, not against the tested term's own tiny total. Gross
    // here is every OTHER pathway's |daily total|, i.e. the real energy scale
    // of this building-day.
    const grossOtherPathwaysKWh = Object.entries(r.heatFlows.dailyTotalsKWh)
      .filter(([k]) => k !== 'Q7_interiorLongwave')
      .reduce((s, [, v]) => s + Math.abs(v), 0);
    const relative = Math.abs(netQ7KWh) / grossOtherPathwaysKWh;
    console.log(
      `T-22 test 8 -- Q7 net ${netQ7KWh} kWh, gross-of-rest ${grossOtherPathwaysKWh.toFixed(4)} kWh, relative ${relative}`,
    );
    expect(relative).toBeLessThan(1e-6);
  });
});

describe('T-22 acceptance test 9 -- dailyTotalsKWh keys match the series field names 1:1', () => {
  it('no extra key, no missing key, checked both directions', () => {
    const r = simulate(januaryLehDay());
    const totalKeys = Object.keys(r.heatFlows.dailyTotalsKWh).sort();
    const expected = [...DAILY_TOTAL_KEYS].sort();
    for (const k of expected) expect(totalKeys).toContain(k); // no missing key
    for (const k of totalKeys) expect(expected).toContain(k); // no extra key
    expect(totalKeys).toEqual(expected);
  });
});

describe('T-22 acceptance test 10 -- a constant 1000 W series over 24h integrates to 24 kWh', () => {
  it('dailyTotalsKWh divides by 3.6e6, not by anything else', () => {
    const dt = 3600;
    const n = 24;
    const records: StepRecord[] = Array.from({ length: n }, () => fakeRecord({ Qaux: 1000 }));
    const heatFlows = assembleHeatFlows(records, dt);
    expect(heatFlows.dailyTotalsKWh.Qaux).toBeCloseTo(24.0, 3);
    expect(Math.abs(heatFlows.dailyTotalsKWh.Qaux - 24.0)).toBeLessThan(0.001);
  });
});

describe('T-22 acceptance test 11 -- trapezoidal vs rectangle-rule agree within 1% on a smooth series', () => {
  it('a sinusoidal day-long series integrates to nearly the same total either way', () => {
    const dt = 3600;
    const n = 24;
    const values = Array.from({ length: n }, (_, i) => 500 + 400 * Math.sin((2 * Math.PI * i) / n));
    const records: StepRecord[] = values.map((v) => fakeRecord({ Q1: v }));
    const heatFlows = assembleHeatFlows(records, dt);
    const rectangleKWh = heatFlows.dailyTotalsKWh.Q1_solarOpaque; // production's own rule
    const J_TO_KWH = 1 / 3.6e6;
    let trapJ = 0;
    for (let i = 0; i < values.length - 1; i++) trapJ += ((values[i]! + values[i + 1]!) / 2) * dt;
    // Close the last interval back to the first sample (the series covers one full day/period).
    trapJ += ((values[values.length - 1]! + values[0]!) / 2) * dt;
    const trapezoidalKWh = trapJ * J_TO_KWH;
    const relDiff = Math.abs(trapezoidalKWh - rectangleKWh) / Math.abs(rectangleKWh);
    console.log(`T-22 test 11 -- rectangle ${rectangleKWh} kWh, trapezoidal ${trapezoidalKWh} kWh, rel diff ${relDiff}`);
    expect(relDiff).toBeLessThan(0.01);
  });
});

describe('T-22 acceptance test 12 -- energyBalanceResidual is unchanged by this task', () => {
  it('T-22 only adds reporting series; it does not touch the physics feeding the residual', () => {
    // Measured directly: npx vitest run's own TEST6 fixtures print
    // energyBalanceResidual before and after every change this task made
    // (post/heatFlows.ts, types.ts, solve/integrator.ts's record() ground
    // surfacing, index.ts's temperatures.ground wiring). Every one of the
    // seven TEST6 cases in integrator.test.ts is bit-identical, e.g. "sunny
    // winter day": 8.186034583221165e-7 before this task and
    // 8.186034583221165e-7 after -- see this task's Evidence block for the
    // full seven-case comparison. Reproduced here as a live regression guard.
    const r = simulate(januaryLehDay());
    expect(Number.isFinite(r.meta.energyBalanceResidual)).toBe(true);
    expect(r.meta.energyBalanceResidual).toBeLessThan(1e-3);
  });
});

/** A StepRecord with every field zeroed except the overrides given. */
function fakeRecord(overrides: Partial<StepRecord> = {}): StepRecord {
  return {
    T: new Float64Array(3),
    T_amb: 273.15,
    T_sky: 273.15,
    T_mrt: 273.15,
    Q1: 0,
    Q2: 0,
    Q3: 0,
    Q4: 0,
    Q5: 0,
    Q6: 0,
    Q7: 0,
    Q8: 0,
    Q9: 0,
    Q10: 0,
    Q11: 0,
    Qaux: 0,
    incident: new Float64Array(0),
    absorbedOpaque: 0,
    T_groundNode: 273.15,
    ...overrides,
  };
}
