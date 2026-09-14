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

import { effectiveAirCapacitance } from './loads/infiltration.js';
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

  const model = buildModel(req.building, req.materials, req.glazings, req.options.meshTargetDx);
  const { records, initialT, warnings, spinUpDaysUsed } = integrate(req, model);

  if (records.length === 0) {
    throw new Error('The integrator produced no timesteps; check simulationDays and timestepSeconds.');
  }

  const dt = req.options.timestepSeconds;
  const first = records[0]!;
  const last = records[records.length - 1]!;

  const airC = effectiveAirCapacitance(req.building.volume, req.site.elevation, last.T[AIR_NODE]!);
  // Baseline is the state BEFORE the first recorded step, not records[0].T.
  const balance = energyBalance(records, model.C, airC, initialT, last.T, dt);

  const time = new Float64Array(records.length);
  const indoorAir = new Float64Array(records.length);
  const ambient = new Float64Array(records.length);
  const sky = new Float64Array(records.length);
  const meanRadiant = new Float64Array(records.length);
  const absorbedOpaque = new Float64Array(records.length);
  const transmittedGlazed = new Float64Array(records.length);

  for (let i = 0; i < records.length; i++) {
    const r = records[i]!;
    time[i] = i * dt;
    indoorAir[i] = r.T[AIR_NODE]!;
    ambient[i] = r.T_amb;
    sky[i] = r.T_sky;
    meanRadiant[i] = r.T[STAR_NODE]!;
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
    temperatures: { indoorAir, ambient, sky, meanRadiant, surfaces },
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
