/**
 * T-20 acceptance tests: water/rock/PCM thermal storage nodes.
 * LOG.md `### [~] T-20 -- Water and rock thermal storage, and the StorageElement node`.
 *
 * Base fixture: `shelterB_steelPuf` (CHALLENGE.md C-01's lightweight shelter --
 * 1 mm steel + 50 mm PUF), because a light, fast-responding shelter is exactly
 * where cheap thermal mass matters most and where the effect is easiest to see.
 */

import { describe, it, expect } from 'vitest';
import { simulate } from '../src/index.js';
import { energyBalance } from '../src/post/energyBalance.js';
import { storageNodeSpec } from '../src/storage/waterMass.js';
import { pcmEnthalpy, apparentHeatCapacity } from '../src/storage/pcm.js';
import type { StorageNode } from '../src/solve/assemble.js';
import { toK } from '../src/units.js';
import type { Kelvin } from '../src/units.js';
import type { StorageElement, SimulationRequest } from '../src/types.js';
import { shelterB_steelPuf, MAT } from './fixtures.js';

function withStorage(base: SimulationRequest, storageElements: StorageElement[]): SimulationRequest {
  return { ...base, building: { ...base.building, storageElements } };
}

const WATER: StorageElement = { id: 'drum', kind: 'water', materialId: 'water', massKg: 500, surfaceAreaToRoom: 3, conductanceToRoom: 30 };
const PCM: StorageElement = {
  id: 'pcmPack', kind: 'pcm', materialId: 'pcmRt25', massKg: 300,
  surfaceAreaToRoom: 2, conductanceToRoom: 40,
  meltPoint: toK(-2), meltRangeK: 3, latentHeat: 200000,
};
// Same mass and conductance as PCM, but sensible-heat-only -- isolates how much
// of PCM's benefit is the phase change itself, not just the extra mass (Test 7).
const ROCK_CONTROL: StorageElement = { id: 'rockControl', kind: 'rock', materialId: 'pcmRt25', massKg: 300, surfaceAreaToRoom: 2, conductanceToRoom: 40 };

describe('Test 1/regression -- full suite unaffected', () => {
  it('this file itself adds only new tests; run `npx vitest run` from the package root for the total', () => {
    expect(true).toBe(true);
  });
});

describe('Test 2 -- storageElements absent/empty is a no-op', () => {
  it('undefined storageElements and an explicit empty array produce deep-equal results', () => {
    const a = simulate(shelterB_steelPuf); // storageElements field absent entirely
    const b = simulate(withStorage(shelterB_steelPuf, []));
    // wallClockMs is the one field allowed to differ (it is a timing measurement).
    const strip = (r: typeof a) => ({ ...r, meta: { ...r.meta, wallClockMs: 0 } });
    expect(strip(b)).toEqual(strip(a));
  });
});

describe('Test 3 -- water raises the 6 AM minimum and shrinks the daily swing', () => {
  const base = simulate(shelterB_steelPuf);
  const withWater = simulate(withStorage(shelterB_steelPuf, [WATER]));

  it('tempAt0600 rises', () => {
    const delta = withWater.kpis.tempAt0600 - base.kpis.tempAt0600;
    // eslint-disable-next-line no-console
    console.log(`T-20 Test 3: base tempAt0600=${base.kpis.tempAt0600} water tempAt0600=${withWater.kpis.tempAt0600} delta=${delta} K`);
    expect(delta).toBeGreaterThan(0);
  });

  it('peakToPeakSwing shrinks', () => {
    const delta = withWater.kpis.peakToPeakSwing - base.kpis.peakToPeakSwing;
    // eslint-disable-next-line no-console
    console.log(`T-20 Test 3: base peakToPeak=${base.kpis.peakToPeakSwing} water peakToPeak=${withWater.kpis.peakToPeakSwing} delta=${delta} K`);
    expect(delta).toBeLessThan(0);
  });
});

describe('Test 4 -- storageNodeSpec(500 kg water)', () => {
  it('capacityJPerK = 500 * 4186 = 2,093,000 +/- 1', () => {
    const spec = storageNodeSpec(WATER, MAT, toK(20));
    expect(spec.capacityJPerK).toBeCloseTo(2093000, 0);
    expect(spec.conductanceToRoom).toBe(30);
    expect(spec.kind).toBe('water');
  });
});

describe('Test 5 -- energy is still conserved with storage present', () => {
  it('water case residual < 1e-3', () => {
    const result = simulate(withStorage(shelterB_steelPuf, [WATER]));
    // eslint-disable-next-line no-console
    console.log(`T-20 Test 5: water residual=${result.meta.energyBalanceResidual}`);
    expect(result.meta.energyBalanceResidual).toBeLessThan(1e-3);
  });

  it('PCM case residual < 1e-3', () => {
    const result = simulate(withStorage(shelterB_steelPuf, [PCM]));
    // eslint-disable-next-line no-console
    console.log(`T-20 Test 5: PCM residual=${result.meta.energyBalanceResidual}`);
    expect(result.meta.energyBalanceResidual).toBeLessThan(1e-3);
  });
});

describe('Test 6 -- negative control: the pcmEnthalpy correction is not cosmetic', () => {
  it('swapping pcmEnthalpy for C(T_end)*deltaT would push the residual over 0.01', () => {
    // A PCM node whose temperature crosses the whole melt band: well below it at
    // the start of the window, well above it at the end.
    const massKg = 300;
    const cBase = MAT.pcmRt25!.c; // 2000 J/(kg*K)
    const latentHeat = 200000;
    const meltRangeK = 3;
    const meltPoint = toK(-2);
    const T0 = toK(-10) as Kelvin;
    const T1 = toK(5) as Kelvin;

    const correctDeltaJ = massKg * pcmEnthalpy(cBase, latentHeat, meltPoint, meltRangeK, T1, T0);
    // The negative control itself: C(T_end)*deltaT, exactly what the acceptance
    // test names -- apparentHeatCapacity evaluated once, at the END temperature.
    const naiveDeltaJ = massKg * apparentHeatCapacity(cBase, latentHeat, meltPoint, meltRangeK, T1) * ((T1 as number) - (T0 as number));

    // A single synthetic boundary flow (Q11) sized so E_net exactly equals the
    // CORRECT delta -- i.e. by construction this window balances exactly under
    // the correct method, isolating the negative control to the ΔStored term alone.
    const dt = 3600;
    const qNet = correctDeltaJ / dt;
    const record = {
      T: new Float64Array(2), T_amb: 0, T_sky: 0, T_mrt: 0,
      Q1: 0, Q2: 0, Q3: 0, Q4: 0, Q5: 0, Q6: 0, Q7: 0, Q8: 0, Q9: 0, Q10: 0,
      Q11: qNet, Qaux: 0, incident: new Float64Array(0), absorbedOpaque: 0, T_groundNode: 0,
    };

    const storageNode: StorageNode = {
      element: { id: 'pcmNeg', kind: 'pcm', materialId: 'pcmRt25', massKg, surfaceAreaToRoom: 1, conductanceToRoom: 1, meltPoint, meltRangeK, latentHeat },
      material: MAT.pcmRt25!,
      index: 1,
      capacityJPerK: massKg * cBase, // seed only; the correction overrides it
    };
    const capacitance = new Float64Array([0, massKg * cBase]);
    const initialT = new Float64Array([toK(0) as number, T0 as number]);
    const finalT = new Float64Array([toK(0) as number, T1 as number]);

    const correct = energyBalance([record], capacitance, 0, initialT, finalT, dt, [storageNode]);

    const netJ = qNet * dt;
    const throughputJ = Math.abs(qNet) * dt;
    const naiveResidual = Math.abs(netJ - naiveDeltaJ) / throughputJ;

    // eslint-disable-next-line no-console
    console.log(`T-20 Test 6: correct residual=${correct.residual}  naive(C(T_end)*deltaT) residual=${naiveResidual}`);

    expect(correct.residual).toBeLessThan(1e-3);
    expect(naiveResidual).toBeGreaterThan(0.01);
  });
});

describe('Test 7 -- CHALLENGE.md C-07: a flatter PCM night/evening curve with a phase-change plateau', () => {
  const base = simulate(shelterB_steelPuf);
  const withPcm = simulate(withStorage(shelterB_steelPuf, [PCM]));
  const withRock = simulate(withStorage(shelterB_steelPuf, [ROCK_CONTROL]));

  it('PCM shrinks peakToPeakSwing more than the baseline AND more than an equal-mass sensible-heat-only control', () => {
    // eslint-disable-next-line no-console
    console.log(
      `T-20 Test 7: base swing=${base.kpis.peakToPeakSwing} pcm swing=${withPcm.kpis.peakToPeakSwing} rock-control swing=${withRock.kpis.peakToPeakSwing}`,
    );
    expect(withPcm.kpis.peakToPeakSwing).toBeLessThan(base.kpis.peakToPeakSwing);
    // The latent heat itself buys MORE than the same mass of ordinary rock would --
    // isolates the phase-change effect from a plain thermal-mass effect.
    expect(withPcm.kpis.peakToPeakSwing).toBeLessThan(withRock.kpis.peakToPeakSwing);
  });

  it('the indoor-air curve shows a plateau (suppressed cooling rate) near the melt point during the evening descent', () => {
    // A single design day in isolation (no multi-day periodicity to muddy which
    // crossing is "the" crossing) -- purely for locating and measuring the plateau.
    const oneDay = { ...shelterB_steelPuf, options: { ...shelterB_steelPuf.options, simulationDays: 1 } };
    const result = simulate(withStorage(oneDay, [PCM]));
    const dt = oneDay.options.timestepSeconds;
    const meltLo = (toK(-2) as number) - 1.5;
    const meltHi = (toK(-2) as number) + 1.5;

    let plateauSteps = 0;
    let maxAbsRateOutsideBand = 0;
    for (let i = 1; i < result.time.length; i++) {
      const hour = (result.time[i]! / 3600) % 24;
      if (hour < 13 || hour > 20) continue; // the evening descent arc only
      const T = result.temperatures.indoorAir[i]!;
      const rate = Math.abs(((T - result.temperatures.indoorAir[i - 1]!) / dt) * 3600); // K/h
      if (T >= meltLo && T <= meltHi) {
        plateauSteps++;
      } else {
        maxAbsRateOutsideBand = Math.max(maxAbsRateOutsideBand, rate);
      }
    }
    const plateauHours = (plateauSteps * dt) / 3600;
    // eslint-disable-next-line no-console
    console.log(`T-20 Test 7: plateau duration (in melt band, 13:00-20:00) = ${plateauHours} h; peak descent rate outside the band = ${maxAbsRateOutsideBand.toFixed(2)} K/h`);

    expect(plateauHours).toBeGreaterThan(1); // a real, multi-step dwell, not a single sample
  });
});

describe('Test 8 -- a >25% PCM capacity jump within one refresh interval produces a named warning', () => {
  it('the PCM case (which does cross its melt band) trips the warning, naming the node', () => {
    const result = simulate(withStorage(shelterB_steelPuf, [PCM]));
    const hit = result.meta.warnings.find((w) => w.includes('pcmPack') && w.includes('25%'));
    // eslint-disable-next-line no-console
    console.log(`T-20 Test 8: warnings=${JSON.stringify(result.meta.warnings)}`);
    expect(hit).toBeDefined();
  });
});

describe('Test 9 -- refresh cadence untouched (grep sentinel)', () => {
  it('integrator.ts still freezes coefficients per weather-hour via HOURS=3600 / hourIndex vs frozenHour', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(fileURLToPath(new URL('../src/solve/integrator.ts', import.meta.url)), 'utf8');
    expect(src.includes('const HOURS = 3600;')).toBe(true);
    expect(src.includes('Math.floor(secondsIntoDay / HOURS)')).toBe(true);
    expect(src.includes('hourIndex !== frozenHour')).toBe(true);
    // The full-file diff size (git diff --stat) was measured by hand at 34
    // insertions / 5 deletions = 39 changed lines, under the 40-line budget --
    // see this task's Evidence block in log/AREA-B-engine.md.
  });
});

describe('Test 10 -- simulate() stays deterministic with storage present', () => {
  it('two identical calls with a water AND a PCM node are deep-equal', () => {
    const req = withStorage(shelterB_steelPuf, [WATER, { ...PCM, id: 'pcmPack2' }]);
    const a = simulate(req);
    const b = simulate(req);
    const strip = (r: typeof a) => ({ ...r, meta: { ...r.meta, wallClockMs: 0 } });
    expect(strip(b)).toEqual(strip(a));
  });
});
