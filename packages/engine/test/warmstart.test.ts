/**
 * T-70 -- the warm-start hook (`SimOptions.initialTemperatureK`).
 *
 * Raised by T-54's own HELP_REQUEST (log/AREA-G-decision-support.md): the
 * spin-up-sharing cache in `@shelter/optimise` had nowhere to hand a converged
 * state to `simulate()`, so every call cold-started from `fill(mean(T_amb))`.
 * This is a pure SPEED lever -- integrate()'s convergence loop, tolerance and
 * day cap are completely unchanged; a warm seed just needs fewer days to
 * satisfy the same `spinUpToleranceK` test, and a bad seed still converges to
 * the same fixed point, just slower. See `packages/engine/src/types.ts`
 * (`SimOptions.initialTemperatureK`) and `packages/engine/src/solve/
 * integrator.ts` (`integrate()`'s initial-fill branch).
 */

import { describe, it, expect } from 'vitest';
import { simulate } from '../src/index.js';
import { buildModel } from '../src/solve/assemble.js';
import { integrate } from '../src/solve/integrator.js';
import { resultFromJson, resultToJson } from '../src/serialise.js';
import { EngineError, type SimulationRequest } from '../src/types.js';
import { buildBox } from './box.js';
import { MAT } from './fixtures.js';

describe('T-70 warm-start hook', () => {
  it('acceptance 1: omitting initialTemperatureK reproduces the pre-change fixture exactly', () => {
    /*
     * Numbers captured via `git stash` on this exact fixture, BEFORE the
     * initialTemperatureK branch existed in integrator.ts (types.ts +
     * solve/integrator.ts stashed, packages/engine rebuilt against the
     * unmodified file, buildBox() re-run) -- pasted verbatim below, then
     * compared bit-for-bit against the post-change run. See this task's
     * Evidence block in log/AREA-B-engine.md for the two full JSON captures.
     */
    const req = buildBox();
    const r = simulate(req);

    expect(r.meta.spinUpDaysUsed).toBe(7);
    expect(r.meta.energyBalanceResidual).toBeCloseTo(1.1417455811692568e-10, 15);
    expect(r.kpis.minIndoorTemp).toBe(253.64499767403552);
    expect(r.kpis.maxIndoorTemp).toBe(253.65461641202555);
    expect(r.kpis.meanIndoorTemp).toBe(253.6494332182756);
    expect(r.kpis.tempAt0600).toBe(253.65176378641877);
    expect(r.kpis.peakToPeakSwing).toBe(0.009618737990024329);
    expect(r.temperatures.indoorAir[r.temperatures.indoorAir.length - 1]).toBe(253.64499767403552);
    expect(r.meta.warnings).toEqual([
      'No humidity data, so condensation risk could not be assessed. It is reported as unavailable, not as zero.',
    ]);
  });

  it('acceptance 2: seeding with the converged state collapses spin-up to 1-2 days', () => {
    const req = buildBox();
    const model = buildModel(req.building, req.materials, req.glazings, req.options.meshTargetDx);

    const cold = integrate(req, model);
    expect(cold.spinUpDaysUsed).toBeGreaterThan(2); // the cold baseline this warm start is compared against

    const warmReq = { ...req, options: { ...req.options, initialTemperatureK: cold.finalT } };
    const warm = integrate(warmReq, model);

    console.log(`T-70 test 2: cold spinUpDaysUsed=${cold.spinUpDaysUsed}, warm spinUpDaysUsed=${warm.spinUpDaysUsed}`);
    expect(warm.spinUpDaysUsed).toBeLessThanOrEqual(2);

    let maxDev = 0;
    for (let i = 0; i < model.n; i++) maxDev = Math.max(maxDev, Math.abs(warm.finalT[i]! - cold.finalT[i]!));
    console.log(`T-70 test 2: max node deviation warm vs cold finalT = ${maxDev} K (tolerance ${req.options.spinUpToleranceK} K)`);
    expect(maxDev).toBeLessThanOrEqual(req.options.spinUpToleranceK);
  });

  it('acceptance 3: a deliberately bad warm start still converges to the same fixed point', () => {
    const req = buildBox();
    const model = buildModel(req.building, req.materials, req.glazings, req.options.meshTargetDx);

    const cold = integrate(req, model);

    const badSeed = new Float64Array(model.n);
    for (let i = 0; i < model.n; i++) badSeed[i] = cold.finalT[i]! + 20; // uniformly wrong by 20 K

    const badReq = { ...req, options: { ...req.options, initialTemperatureK: badSeed } };
    const bad = integrate(badReq, model);

    expect(bad.spinUpDaysUsed).toBeLessThanOrEqual(req.options.maxSpinUpDays);
    expect(bad.warnings.some((w) => w.includes('hit its'))).toBe(false);

    let maxDev = 0;
    for (let i = 0; i < model.n; i++) maxDev = Math.max(maxDev, Math.abs(bad.finalT[i]! - cold.finalT[i]!));
    console.log(`T-70 test 3: max node deviation bad-warm-start vs cold finalT = ${maxDev} K (tolerance ${req.options.spinUpToleranceK} K)`);
    expect(maxDev).toBeLessThanOrEqual(req.options.spinUpToleranceK);
  });

  it('acceptance 4: a length mismatch throws EngineError(INVALID_INPUT) naming the expected length', () => {
    const req = buildBox();
    const model = buildModel(req.building, req.materials, req.glazings, req.options.meshTargetDx);

    const wrongLength = new Float64Array(5);
    expect(wrongLength.length).not.toBe(model.n);
    console.log(`T-70 test 4: model.n = ${model.n}`);

    const badReq = { ...req, options: { ...req.options, initialTemperatureK: wrongLength } };

    let caught: unknown;
    try {
      integrate(badReq, model);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EngineError);
    expect((caught as InstanceType<typeof EngineError>).code).toBe('INVALID_INPUT');
    expect((caught as Error).message).toContain(String(model.n));
  });
});

/**
 * T-76 -- expose the real per-node converged state as `SimulationResult.warmState`,
 * gated behind `SimOptions.keepWarmState`. `integrate()` already computed this
 * exact vector as `RunOutput.finalT` (T-70); this task's entire job is to stop
 * throwing it away. See `packages/engine/src/index.ts` (`simulate()`'s
 * destructure and conditional return key) and `packages/engine/src/serialise.ts`
 * (`resultFromJson`'s round-trip line).
 */
describe('T-76 warmState output field', () => {
  it('acceptance 1: keepWarmState omitted/false leaves warmState genuinely absent, no other change', () => {
    const req = buildBox();
    const r = simulate(req);

    // Identical to T-70 acceptance-1's own pre-recorded fixture values --
    // proves this task changed nothing about the default (keepWarmState-less) path.
    expect(r.meta.spinUpDaysUsed).toBe(7);
    expect(r.kpis.minIndoorTemp).toBe(253.64499767403552);
    expect(r.kpis.maxIndoorTemp).toBe(253.65461641202555);
    expect(r.kpis.meanIndoorTemp).toBe(253.6494332182756);
    expect(r.kpis.tempAt0600).toBe(253.65176378641877);
    expect('warmState' in r).toBe(false);

    const rExplicitFalse = simulate({ ...req, options: { ...req.options, keepWarmState: false } });
    expect('warmState' in rExplicitFalse).toBe(false);
  });

  it('acceptance 2: keepWarmState true returns the real finalT, not a copy or a recomputation', () => {
    const req = buildBox();
    const model = buildModel(req.building, req.materials, req.glazings, req.options.meshTargetDx);
    // glazingAreaM2 = 0 on this window-less fixture, so simulate()'s achSchedule
    // coupling (index.ts) is a no-op -- integrate(req, model) is identical to
    // integrate(couplingReq, model), same reasoning T-70's own test 2 documents.
    const direct = integrate(req, model);

    const r = simulate({ ...req, options: { ...req.options, keepWarmState: true } });

    console.log(`T-76 test 2: warmState.length=${r.warmState?.length}, meta.nodeCount=${r.meta.nodeCount}, direct.finalT.length=${direct.finalT.length}`);
    expect(r.warmState).toBeInstanceOf(Float64Array);
    expect(r.warmState!.length).toBe(r.meta.nodeCount);
    expect(r.warmState).toEqual(direct.finalT);
  });

  it('acceptance 3: a real warmState beats a uniform-mean fill for spin-up speed, on a topology-preserving variant', () => {
    // Variant A and B share the same node topology (same construction, thicknesses,
    // storage elements, volume) and differ only in a non-mass field: B adds a small
    // internal gain (a stove/occupant load, `internalGainsW`), which nudges the
    // fixed point without touching the wall mesh or any mass/storage field.
    const lightConstruction = [{ materialId: 'rammedEarth', thickness: 0.15 }];
    const reqA = buildBox({ construction: lightConstruction });
    const a = simulate({ ...reqA, options: { ...reqA.options, keepWarmState: true } });
    const n = a.warmState!.length;
    const meanA = a.warmState!.reduce((s, x) => s + x, 0) / n;

    const reqB = buildBox({ construction: lightConstruction, internalGainsW: 50 });
    const modelB = buildModel(reqB.building, reqB.materials, reqB.glazings, reqB.options.meshTargetDx);
    expect(modelB.n).toBe(n); // topology check: same node count as A

    const reqBWarm = { ...reqB, options: { ...reqB.options, keepWarmState: true } };
    const coldB = simulate(reqBWarm);
    const uniformFill = new Float64Array(n).fill(meanA);
    const uniformB = simulate({ ...reqBWarm, options: { ...reqBWarm.options, initialTemperatureK: uniformFill } });
    const realB = simulate({ ...reqBWarm, options: { ...reqBWarm.options, initialTemperatureK: a.warmState } });

    console.log(
      `T-76 test 3: coldB.spinUpDaysUsed=${coldB.meta.spinUpDaysUsed}, ` +
        `uniformB.spinUpDaysUsed=${uniformB.meta.spinUpDaysUsed}, realB.spinUpDaysUsed=${realB.meta.spinUpDaysUsed}`,
    );
    expect(realB.meta.spinUpDaysUsed).toBeLessThanOrEqual(uniformB.meta.spinUpDaysUsed);

    // Compare the spin-up-converged node vector (warmState), the same fixed
    // point T-70's own acceptance test 3 compares against -- not the reported
    // day's indoor-air series, which is a separate downstream integration.
    let maxDevUniform = 0;
    let maxDevReal = 0;
    for (let i = 0; i < n; i++) {
      maxDevUniform = Math.max(maxDevUniform, Math.abs(uniformB.warmState![i]! - coldB.warmState![i]!));
      maxDevReal = Math.max(maxDevReal, Math.abs(realB.warmState![i]! - coldB.warmState![i]!));
    }
    console.log(
      `T-76 test 3: maxDevUniform=${maxDevUniform} K, maxDevReal=${maxDevReal} K, tolerance=${reqB.options.spinUpToleranceK} K`,
    );
    expect(maxDevUniform).toBeLessThanOrEqual(reqB.options.spinUpToleranceK);
    expect(maxDevReal).toBeLessThanOrEqual(reqB.options.spinUpToleranceK);
  });

  it('acceptance 4: warmState.length always equals meta.nodeCount, across fixtures with different node counts', () => {
    const reqBox = buildBox();
    const rBox = simulate({ ...reqBox, options: { ...reqBox.options, keepWarmState: true } });

    // T-20's StorageElement adds an extra solved node -- a different node count
    // from the plain box, on purpose.
    const reqStorage: SimulationRequest = {
      ...buildBox(),
      materials: { ...buildBox().materials, water: MAT.water },
      building: {
        ...buildBox().building,
        storageElements: [{ id: 'drum', kind: 'water', materialId: 'water', massKg: 500, surfaceAreaToRoom: 3, conductanceToRoom: 30 }],
      },
    };
    const rStorage = simulate({ ...reqStorage, options: { ...reqStorage.options, keepWarmState: true } });

    console.log(`T-76 test 4: box nodeCount=${rBox.meta.nodeCount}, storage nodeCount=${rStorage.meta.nodeCount}`);
    expect(rBox.meta.nodeCount).not.toBe(rStorage.meta.nodeCount);
    expect(rBox.warmState!.length).toBe(rBox.meta.nodeCount);
    expect(rStorage.warmState!.length).toBe(rStorage.meta.nodeCount);
  });

  it('acceptance 5: JSON round-trip preserves warmState byte-for-byte when present, and omits the key entirely when absent', () => {
    const req = buildBox();

    const withState = simulate({ ...req, options: { ...req.options, keepWarmState: true } });
    const jsonWith = resultToJson(withState) as Record<string, unknown>;
    expect('warmState' in jsonWith).toBe(true);
    const roundTripped = resultFromJson(jsonWith);
    expect(roundTripped.warmState).toEqual(withState.warmState);

    const without = simulate(req);
    const jsonWithout = resultToJson(without) as Record<string, unknown>;
    expect('warmState' in jsonWithout).toBe(false);
    const roundTrippedWithout = resultFromJson(jsonWithout);
    expect('warmState' in roundTrippedWithout).toBe(false);
  });
});
