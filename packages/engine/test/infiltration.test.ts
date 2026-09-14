/**
 * T-21 -- couples infiltration to opening area (closes AUDIT F-6).
 * BLUEPRINT.md 5.10; LOG.md Section 7.10, T-21.
 */

import { describe, it, expect } from 'vitest';
import { effectiveAch, ACH_PER_GLAZING_FRACTION } from '../src/loads/infiltration.js';
import { simulate, ACH_MIN, ACH_MIN_COMBUSTION_ALLOWANCE, EngineError } from '../src/index.js';
import { toK } from '../src/units.js';
import { buildBox } from './box.js';
import { shelterA_stone400, shelterB_steelPuf, adiabaticBox, steadyStateBox } from './fixtures.js';
import type { SimulationRequest } from '../src/types.js';

describe('effectiveAch -- the opening-area coupling', () => {
  it('acceptance 1: is strictly increasing in glazing area over 50 samples, everything else fixed', () => {
    const envelopeAreaM2 = 100;
    const baseAch = 0.6; // above ACH_MIN across the whole swept range -- no clamp to confound monotonicity
    let previous = -Infinity;
    for (let i = 0; i <= 50; i++) {
      const glazingAreaM2 = (i / 50) * 40; // up to 40% of the envelope
      const { ach } = effectiveAch(baseAch, glazingAreaM2, envelopeAreaM2, false);
      expect(ach).toBeGreaterThan(previous);
      previous = ach;
    }
  });

  it('acceptance 2: sweeping glazing 0% -> 50% of a 60 m^2 envelope raises ACH by exactly 1.2 x 0.5', () => {
    const envelopeAreaM2 = 60;
    const baseAch = 0.6;
    const at0 = effectiveAch(baseAch, 0, envelopeAreaM2, false).ach;
    const at50 = effectiveAch(baseAch, 0.5 * envelopeAreaM2, envelopeAreaM2, false).ach;
    const delta = at50 - at0;
    console.log(`T-21 acceptance 2: delta ACH over 0%->50% glazing of 60 m^2 = ${delta}`);
    expect(Math.abs(delta - 1.2 * 0.5)).toBeLessThan(1e-9);
  });

  it('acceptance 3: effectiveAch(0.1, 0, A, false) returns exactly 0.35, clamped', () => {
    const r = effectiveAch(0.1, 0, 60, false);
    expect(r.ach).toBe(0.35);
    expect(r.ach).toBe(ACH_MIN);
    expect(r.clampedBySafetyFloor).toBe(true);
  });

  it('acceptance 4: effectiveAch(0.1, 0, A, true) returns exactly 0.70 -- the bukhari case', () => {
    const r = effectiveAch(0.1, 0, 60, true);
    expect(r.ach).toBe(0.7);
    expect(r.ach).toBe(ACH_MIN + ACH_MIN_COMBUSTION_ALLOWANCE);
    expect(r.clampedBySafetyFloor).toBe(true);
  });

  it('acceptance 5: effectiveAch(2.0, 0, A, false) returns exactly 2.0 -- a leaky building is never corrected upward', () => {
    const r = effectiveAch(2.0, 0, 60, false);
    expect(r.ach).toBe(2.0);
    expect(r.clampedBySafetyFloor).toBe(false);
  });

  it('acceptance 6: envelopeAreaM2 <= 0 throws EngineError(INVALID_INPUT)', () => {
    let threw: unknown;
    try {
      effectiveAch(0.5, 2, 0, false);
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(EngineError);
    expect((threw as EngineError).code).toBe('INVALID_INPUT');
  });
});

describe('T-21 acceptance 7 -- the K-05 curve, end to end', () => {
  /*
   * FINDING, not tuned away (per this acceptance test's own instruction): across
   * every configuration tried -- shelterA_stone400 as-is and a more realistic
   * long/low shed proportion; single and double glazing; with and without a
   * night shutter (R_shutter = 0.4); direct-Ladakh-winter DNI/DHI swept from
   * 150 to 800 W/m^2 peak; setpoints from 10-18 degC -- the swept
   * (glazing %, auxEnergyKWhPerDay) curve on a SOUTH-WALL-ONLY sweep never
   * produced an interior MINIMUM (improves-then-degrades). It is either
   * monotonic throughout (window always a net loss, or always a net win over
   * the swept range), or -- in the narrow crossover band between those regimes
   * -- an interior MAXIMUM (degrades-then-improves), the mirror image of what
   * K-05 wants.
   *
   * Root cause, algebraically: effectiveAch's coupling term is
   * ACH_PER_GLAZING_FRACTION * glazingAreaM2 / (envelopeAreaM2_opaque + glazingAreaM2),
   * per this task's own spec (SS7.9/T-21 PROMPT: envelopeAreaM2 is the exterior
   * envelope INCLUDING the glazing being swept). As a function of glazing area
   * alone this is a saturating (concave, diminishing-marginal-rate) curve --
   * its marginal ACH penalty is LARGEST at the first m^2 of glass and falls off
   * as glazing grows. Q2 (solar gain) and Q8 (window conduction) are each
   * approximately linear in window area. A linear term plus a concave term is
   * itself concave, and a concave function has at most an interior MAXIMUM,
   * never an interior MINIMUM. So no choice of glazing, shading or climate can
   * turn this specific coupling into a K-05 hump on a single-wall sweep: with
   * ACH_PER_GLAZING_FRACTION = 1.2, the coupling's magnitude at 50% south-wall
   * glazing on shelterA_stone400 is only +0.09 ACH (glazing is at most
   * 8 / 104 = 7.7% of the total 6-face envelope for a south-only sweep) --
   * an order of magnitude too small to flip a well-designed (shuttered) window
   * from "always wins" to "wins then loses" within the swept range.
   *
   * This is "the coupling is too weak" (one of the two outcomes this
   * acceptance test explicitly names as a reportable finding), not a bug in
   * `effectiveAch()` or in the index.ts wiring -- both match the T-21 PROMPT's
   * formula exactly, and `solar/`, `surfaces/` (the "gain side") are out of
   * this task's file allow-list to change. Full sweep data is in this task's
   * LOG.md Evidence block. T-21 is therefore reported BLOCKED on acceptance
   * test 7 specifically; every other numbered acceptance test passes.
   *
   * The assertions below verify what IS true end-to-end: the coupling is
   * WIRED (infiltration loss measurably grows with glazing fraction) and the
   * run completes safely -- without asserting the false claim that a K-05
   * optimum appears on this fixture.
   */
  it('the infiltration loss channel measurably grows with south glazing fraction (coupling is wired end to end)', () => {
    const southWall = shelterA_stone400.building.surfaces.find((s) => s.id === 'south')!;
    const southWallAreaM2 = southWall.area;
    const nightShutter = Array.from({ length: 24 }, (_, h) => h < 8 || h >= 16);

    const withGlazingFraction = (frac: number): SimulationRequest => ({
      ...shelterA_stone400,
      building: {
        ...shelterA_stone400.building,
        windows:
          frac === 0
            ? []
            : [
                {
                  id: 'sweepWindow',
                  hostSurfaceId: 'south',
                  area: frac * southWallAreaM2,
                  glazingId: 'double',
                  shadingSchedule: nightShutter,
                  shutterResistance: 0.4,
                },
              ],
      },
      operation: {
        ...shelterA_stone400.operation,
        // A thermostat generous enough never to saturate, so auxEnergyKWhPerDay
        // tracks the actual heat balance rather than a heater power ceiling.
        auxHeating: { enabled: true, setpoint: toK(18), maxPower: 50_000 },
      },
    });

    const fractions = Array.from({ length: 11 }, (_, i) => i * 0.05); // 0% .. 50%, step 5%
    const series = fractions.map((f) => {
      const r = simulate(withGlazingFraction(f));
      return {
        glazingPct: Math.round(f * 100),
        auxEnergyKWhPerDay: r.kpis.auxEnergyKWhPerDay,
        infiltrationKWhPerDay: r.heatFlows.dailyTotalsKWh.infiltration,
      };
    });

    console.log('T-21 acceptance 7 -- measured (glazing %, auxEnergyKWhPerDay, infiltration kWh/day):');
    for (const p of series) {
      console.log(`  ${p.glazingPct}%  aux=${p.auxEnergyKWhPerDay.toFixed(4)}  infiltration=${p.infiltrationKWhPerDay.toFixed(4)}`);
    }
    const auxValues = series.map((p) => p.auxEnergyKWhPerDay);
    const minIdx = auxValues.indexOf(Math.min(...auxValues));
    const isMonotonic = minIdx === 0 || minIdx === auxValues.length - 1;
    console.log(
      `T-21 acceptance 7 FINDING: ${isMonotonic ? 'MONOTONIC, no interior optimum -- see LOG.md Evidence and the comment above.' : `interior optimum at ${series[minIdx]!.glazingPct}%`}`,
    );

    // What IS demonstrated: infiltration loss (magnitude) grows monotonically
    // with glazing fraction -- the coupling is live end to end, not a no-op.
    const infiltrationLossMagnitude = series.map((p) => Math.abs(p.infiltrationKWhPerDay));
    for (let i = 1; i < infiltrationLossMagnitude.length; i++) {
      expect(infiltrationLossMagnitude[i]!).toBeGreaterThan(infiltrationLossMagnitude[i - 1]!);
    }
    // Every run in the sweep completes and stays inside the energy-balance contract.
    for (const f of fractions) {
      expect(simulate(withGlazingFraction(f)).meta.energyBalanceResidual).toBeLessThan(1e-3);
    }
  });
});

describe('T-21 acceptance 8 -- floor-trip warning', () => {
  it('a run that trips the safety floor warns about carbon monoxide / ventilation', () => {
    const r = simulate(buildBox({ ach: 0.05, ambient: toK(-20), internalGainsW: 400 }));
    const hit = r.meta.warnings.filter((w) => /carbon monoxide|ventilation/i.test(w));
    expect(hit.length).toBeGreaterThan(0);
    console.log('T-21 acceptance 8: warning ->', hit[0]);
  });
});

describe('T-21 acceptance 9 -- ACH_PER_GLAZING_FRACTION is declared exactly once', () => {
  it('exports the calibration constant from loads/infiltration.ts only', () => {
    expect(ACH_PER_GLAZING_FRACTION).toBe(1.2);
  });
});

describe('T-21 acceptance 11 -- energy balance residual unaffected', () => {
  it('meta.energyBalanceResidual < 1e-3 on every fixture, with and without the coupling active', () => {
    const residuals: Record<string, number> = {};
    residuals['buildBox default'] = simulate(buildBox()).meta.energyBalanceResidual;
    residuals['buildBox with glazing'] = simulate(
      buildBox({ windows: [{ id: 'w1', hostSurfaceId: 'south', area: 4, glazingId: 'double' }] }),
    ).meta.energyBalanceResidual;
    residuals['shelterA_stone400'] = simulate(shelterA_stone400).meta.energyBalanceResidual;
    residuals['shelterB_steelPuf'] = simulate(shelterB_steelPuf).meta.energyBalanceResidual;
    // An adiabatic box never reaches a periodic steady state -- it just keeps
    // warming -- so spin-up must be skipped or it runs to the day cap and
    // exceeds T_MAX_PLAUSIBLE (integrator.test.ts's own adiabaticRun() does the
    // same). Not a T-21 defect: this fixture is simply not periodic.
    const adiabaticReq = adiabaticBox(500);
    adiabaticReq.options.maxSpinUpDays = 0;
    residuals['adiabaticBox(500)'] = simulate(adiabaticReq).meta.energyBalanceResidual;
    residuals['steadyStateBox(300)'] = simulate(steadyStateBox(300)).meta.energyBalanceResidual;

    const max = Math.max(...Object.values(residuals));
    console.log('T-21 acceptance 11: residuals ->', residuals, 'max =', max);
    for (const [label, residual] of Object.entries(residuals)) {
      expect(residual, label).toBeLessThan(1e-3);
    }
  });
});
