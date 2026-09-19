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
import { EngineError } from '../src/types.js';
import { buildBox } from './box.js';

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
