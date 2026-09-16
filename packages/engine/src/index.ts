/**
 * The engine's entire public surface.
 *
 *     simulate(request) -> result
 *
 * One pure function. No state, no side effects, no I/O, no network, no logging.
 * Same inputs always give the same outputs, which is what makes it testable,
 * portable, safe to run in many worker threads at once, and cheap enough to call
 * thousands of times for the design search.
 *
 * See ENGINE_BLUEPRINT.md for the physics.
 */

import { effectiveAch, effectiveAirCapacitance } from './loads/infiltration.js';
import { buildModel, AIR_NODE, STAR_NODE } from './solve/assemble.js';
import { integrate } from './solve/integrator.js';
import { energyBalance } from './post/energyBalance.js';
import { assembleHeatFlows, computeKpis } from './post/kpis.js';
import { validateRequest } from './validate.js';
import type { SimulationRequest, SimulationResult } from './types.js';

/**
 * Recommended defaults. Every field is overridable per request.
 *
 * TIMESTEP: 300 s, not the 60 s BLUEPRINT.md suggests. Backward Euler is
 * unconditionally stable, so the timestep is an ACCURACY choice, and the
 * timestep-independence study (test/integrator.test.ts, validation Test 7)
 * measured the cost directly. Against a 30 s reference, 300 s moves the 6 AM
 * temperature by under 0.01 K and the daily swing by under 0.5% -- for the
 * LIGHTEST building in the catalogue, a bare tin shed, which has the fastest
 * dynamics and is therefore the worst case. It buys a 5x speedup, which is what
 * makes a 2000-variant design search practical rather than theoretical.
 *
 * Anyone who wants 60 s can still ask for it.
 */
export const DEFAULT_SIM_OPTIONS = {
  timestepSeconds: 300,
  meshTargetDx: 0.02,
  simulationDays: 1,
  spinUpToleranceK: 0.02,
  maxSpinUpDays: 30,
  skyModel: 'hdkr',
  integrationTheta: 1,
  keepSurfaceProfiles: false,
  allowUnsafeVentilation: false,
} as const satisfies SimulationRequest['options'];

export function simulate(req: SimulationRequest): SimulationResult {
  const started = Date.now();
  validateRequest(req);

  // T-21 (AUDIT F-6): couple the achSchedule actually used to the opening area,
  // computed once here rather than inside the solver's per-hour coefficient
  // refresh, so `solve/` stays untouched and the coupling is a single, auditable
  // step ahead of the physics.
  //
  // envelopeAreaM2 is the FIXED total exterior envelope area -- every exterior
  // Surface's area, opaque and glazed alike -- and it must NOT also add
  // glazingAreaM2 on top. Each Surface.area is already GROSS: it is the whole
  // host wall/roof region, and any window on it is carved OUT of that area, not
  // added beside it (solve/assemble.ts computes `opaqueArea = surface.area -
  // windowArea` on exactly this assumption, and rejects a window that would
  // exceed its host surface's area). So summing exterior surface areas already
  // counts every m^2 of glazing once. Adding glazingAreaM2 again double-counted
  // it, which made this denominator grow as E_true + glazingAreaM2 instead of
  // staying fixed at the building's true total envelope area E_true. That bug
  // made the coupling term ACH_PER_GLAZING_FRACTION * glazingAreaM2 /
  // envelopeAreaM2 concave (saturating) in glazing area instead of linear,
  // which is algebraically incapable of producing the interior MINIMUM the K-05
  // diagnostic requires (closes T-21's block on acceptance test 7 -- see
  // LOG.md T-21 Evidence and infiltration.ts's effectiveAch()/
  // ACH_PER_GLAZING_FRACTION docs for the full derivation).
  const glazingAreaM2 = req.building.windows.reduce((sum, w) => sum + w.area, 0);
  const envelopeAreaM2 = req.building.surfaces
    .filter((s) => s.boundary === 'exterior')
    .reduce((sum, s) => sum + s.area, 0);
  const hasUnventedCombustion = req.operation.hasUnventedCombustion ?? false;
  let achClampedBySafetyFloor = false;
  /*
   * envelopeAreaM2 <= 0 means there is no exterior envelope at all to compute an
   * opening-area FRACTION against -- only the fully-adiabatic capacitance fixture
   * (validation Test 4, `boundary: 'adiabatic'` on every surface) does this, and
   * it also has zero windows. The coupling is inapplicable there, not invalid, so
   * the schedule passes through unchanged; `loads/infiltration.ts`'s
   * `infiltration()` still enforces ACH_MIN independently downstream (defence in
   * depth, global rule 10) for every real building, which always has a positive
   * envelope area. `effectiveAch()` itself keeps throwing on envelopeAreaM2 <= 0
   * when it IS asked to compute a fraction (see its own tests) -- this guard only
   * decides whether to ask it.
   */
  const achSchedule =
    envelopeAreaM2 <= 0
      ? req.operation.achSchedule
      : req.operation.achSchedule.map((baseAch) => {
          const coupled = effectiveAch(
            baseAch,
            glazingAreaM2,
            envelopeAreaM2,
            hasUnventedCombustion,
            req.options.allowUnsafeVentilation,
          );
          if (coupled.clampedBySafetyFloor) achClampedBySafetyFloor = true;
          return coupled.ach;
        });
  const couplingReq: SimulationRequest = { ...req, operation: { ...req.operation, achSchedule } };

  const model = buildModel(couplingReq.building, couplingReq.materials, couplingReq.glazings, couplingReq.options.meshTargetDx);
  const { records, initialT, warnings, spinUpDaysUsed } = integrate(couplingReq, model);

  if (records.length === 0) {
    throw new Error('The integrator produced no timesteps; check simulationDays and timestepSeconds.');
  }

  const dt = req.options.timestepSeconds;
  const first = records[0]!;
  const last = records[records.length - 1]!;

  const airC = effectiveAirCapacitance(req.building.volume, req.site.elevation, last.T[AIR_NODE]!);
  // Baseline is the state BEFORE the first recorded step, not records[0].T.
  // T-20: model.storageNodes is derived straight from building.storageElements;
  // energyBalance needs it only for the PCM ΔStored correction (CONTRACTS.md 7.4).
  const balance = energyBalance(records, model.C, airC, initialT, last.T, dt, model.storageNodes);

  const time = new Float64Array(records.length);
  const indoorAir = new Float64Array(records.length);
  const ambient = new Float64Array(records.length);
  const sky = new Float64Array(records.length);
  const meanRadiant = new Float64Array(records.length);
  // T-22: the floor's boundary node, which the integrator already solves and
  // now surfaces on StepRecord.T_groundNode (CONTRACTS.md 7.7).
  const ground = new Float64Array(records.length);
  const absorbedOpaque = new Float64Array(records.length);
  const transmittedGlazed = new Float64Array(records.length);

  for (let i = 0; i < records.length; i++) {
    const r = records[i]!;
    time[i] = i * dt;
    indoorAir[i] = r.T[AIR_NODE]!;
    ambient[i] = r.T_amb;
    sky[i] = r.T_sky;
    meanRadiant[i] = r.T[STAR_NODE]!;
    ground[i] = r.T_groundNode;
    absorbedOpaque[i] = r.absorbedOpaque;
    transmittedGlazed[i] = r.Q2;
  }

  const surfaces: SimulationResult['temperatures']['surfaces'] = {};
  const incidentBySurface: Record<string, Float64Array> = {};
  const solarBySurface: Record<string, number> = {};
  const J_TO_KWH = 1 / 3.6e6;

  for (let s = 0; s < model.surfaces.length; s++) {
    const sn = model.surfaces[s]!;
    const ext = new Float64Array(records.length);
    const int = new Float64Array(records.length);
    const inc = new Float64Array(records.length);
    let solarJ = 0;
    for (let i = 0; i < records.length; i++) {
      const r = records[i]!;
      ext[i] = r.T[sn.first]!;
      int[i] = r.T[sn.last]!;
      inc[i] = r.incident[s]!;
      solarJ += r.incident[s]! * sn.opaqueArea * sn.surface.exteriorAbsorptivity * dt;
    }
    surfaces[sn.surface.id] = { exterior: ext, interior: int };
    incidentBySurface[sn.surface.id] = inc;
    solarBySurface[sn.surface.id] = solarJ * J_TO_KWH;
  }

  const days = (records.length * dt) / 86400;
  const heatFlows = assembleHeatFlows(records, dt);
  const kpis = computeKpis(req, records, dt);

  /*
   * T-61: `computeKpis` (post/kpis.ts, off-limits to this task) locates 06:00
   * by an index that is only ever within DAY ONE of the reported period, which
   * is exactly right for the long-standing "one design day, repeated" contract
   * (a weather series of one day or less -- see `integrate()`'s identical
   * `multiDay` test) and wrong for a GENUINE multi-day run of differing
   * weather, which must report the final day's value (CONTRACTS.md 7.7) plus
   * one entry per day. Only recomputed when that genuine-multi-day condition
   * holds, so every pre-existing (single-design-day) request, including
   * `shelterA_stone400`'s own `simulationDays: 2`, is untouched.
   */
  const availableSeconds = req.weather.T_amb.length * req.weather.stepSeconds;
  if (availableSeconds > 86400 && req.options.simulationDays > 1) {
    const stepsPerDay = Math.round(86400 / dt);
    const numDays = Math.max(1, Math.round(records.length / stepsPerDay));
    const idx0600Local = Math.round((((6 - req.weather.startHour + 24) % 24) * 3600) / dt) % stepsPerDay;
    const tempAt0600PerDay = Array.from(
      { length: numDays },
      (_, d) => records[Math.min(d * stepsPerDay + idx0600Local, records.length - 1)]!.T[AIR_NODE]!,
    );
    kpis.tempAt0600PerDay = tempAt0600PerDay;
    kpis.tempAt0600 = tempAt0600PerDay[tempAt0600PerDay.length - 1] as SimulationResult['kpis']['tempAt0600'];
  }

  const allWarnings = [...warnings];
  if (balance.residual >= 1e-3) {
    allWarnings.push(
      `Energy balance residual is ${(balance.residual * 100).toFixed(3)}%, above the 0.1% contract limit. Treat these results as unreliable.`,
    );
  }
  if (req.options.allowUnsafeVentilation) {
    allWarnings.push(
      'Ventilation safety floor DISABLED. This run may model an air-change rate below the 0.35 ACH minimum. Never present such a design as a recommendation: with any unvented combustion appliance it is a carbon-monoxide hazard.',
    );
  }
  if (req.weather.RH === undefined) {
    allWarnings.push('No humidity data, so condensation risk could not be assessed. It is reported as unavailable, not as zero.');
  }
  if (achClampedBySafetyFloor) {
    allWarnings.push(
      'Ventilation was raised to the safety floor for at least one hour: the requested design was sealed tighter than is safe. This prevents a carbon monoxide build-up from any unvented combustion appliance (a bukhari stove); do not seal this shelter any tighter than shown.',
    );
  }

  return {
    meta: {
      nodeCount: model.n,
      timesteps: records.length,
      wallClockMs: Date.now() - started,
      spinUpDaysUsed,
      energyBalanceResidual: balance.residual,
      annualisationMethod:
        'Annual fuel, cost and CO2 figures scale this single simulated day by 365. That is only valid for a genuinely representative day -- use the twelve-monthly-day scenario set for a defensible annual total.',
      warnings: allWarnings,
    },
    time,
    temperatures: { indoorAir, ambient, sky, meanRadiant, ground, surfaces },
    solar: {
      incidentBySurface,
      absorbedOpaque,
      transmittedGlazed,
      dailyTotalKWh: {
        opaque: (absorbedOpaque.reduce((a, b) => a + b, 0) * dt * J_TO_KWH) / days,
        glazed: (transmittedGlazed.reduce((a, b) => a + b, 0) * dt * J_TO_KWH) / days,
        bySurface: solarBySurface,
      },
    },
    heatFlows,
    kpis,
  };
}

export * from './types.js';
export * from './units.js';
export * from './constants.js';
export { airDensity, densityRatio, pressureAtAltitude } from './air.js';
export * from './solar/geometry.js';
export * from './solar/decomposition.js';
export * from './solar/transposition.js';
export * from './envelope/mesh.js';
export * from './envelope/response.js';
export { CONVERSIONS, keroseneLitres } from './post/conversions.js';
export { skyTemperature, hConvExterior, skyViewFactor } from './surfaces/exterior.js';
export { hConvInterior } from './surfaces/interior.js';
export { infiltration, effectiveAirCapacitance } from './loads/infiltration.js';
export { GAIN_WATTS } from './loads/internal.js';
export { soilTemperature } from './loads/ground.js';
export { iam, effectiveWindowU } from './loads/windows.js';
export {
  seriesToJson,
  seriesFromJson,
  requestToJson,
  requestFromJson,
  resultToJson,
  resultFromJson,
  canonicalRequestHash,
} from './serialise.js';
