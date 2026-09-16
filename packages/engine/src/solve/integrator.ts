/**
 * The time loop. WORKERS.md W-09. THE HARD GATE (validation Tests 1, 2, 4).
 *
 * Backward Euler on C dT/dt = sum_j U_ij (T_j - T_i) + Q_i, giving
 *
 *     (C/dt + sum U) T^{k+1} - sum U_ij T_j^{k+1} = (C/dt) T^k + Q + sum U_ib T_b
 *
 * Backward Euler is unconditionally stable, which matters because the node
 * capacitances span several orders of magnitude (a 400 mm earth slice vs. a 20 mm
 * plaster skin). An explicit scheme would need an impossibly small timestep.
 *
 * ---------------------------------------------------------------------------
 * THE REFACTORISATION FIX (AUDIT.md F-1).
 *
 * The convection and linearised-radiation coefficients depend on temperature and
 * wind, so the matrix is not truly constant. Refactorising the LU every timestep
 * costs O(n^3) x 1440 steps and takes ~20 s -- the defect AUDIT.md found.
 *
 * Instead, coefficients are FROZEN PER WEATHER-HOUR: the matrix is refactorised
 * ~24-72 times per run, and every timestep in between costs only two O(n^2) back
 * substitutions. Within one hour the surface temperatures move a degree or two,
 * which perturbs the T^3 radiation linearisation by well under 2%.
 * ---------------------------------------------------------------------------
 */

import { C_P_AIR, T_MAX_PLAUSIBLE, T_MIN_PLAUSIBLE } from '../constants.js';
import { effectiveAirCapacitance, infiltration } from '../loads/infiltration.js';
import { scheduleAt } from '../loads/internal.js';
import { SLAB_SOIL_CONDUCTANCE } from '../loads/ground.js';
import { effectiveWindowU, shutterClosed, transmittedSolar } from '../loads/windows.js';
import { hConvExterior, hRadSky, skyTemperature } from '../surfaces/exterior.js';
import {
  SOLAR_TO_AIR_FRACTION,
  SOLAR_TO_FLOOR_FRACTION,
  hConvInterior,
  hRadInterior,
} from '../surfaces/interior.js';
import { decompose } from '../solar/decomposition.js';
import { sunPosition } from '../solar/geometry.js';
import { albedoAt, transpose } from '../solar/transposition.js';
import { EngineError } from '../types.js';
import type { Operation, SimulationRequest } from '../types.js';
import { AIR_NODE, STAR_NODE, type Model } from './assemble.js';
import { factorArrow, solveArrow, type ArrowFactors } from './schur.js';

/** Everything recorded at one timestep. Accumulated into the result arrays. */
export interface StepRecord {
  T: Float64Array;
  T_amb: number;
  T_sky: number;
  T_mrt: number;
  Q1: number;
  Q2: number;
  Q3: number;
  Q4: number;
  Q5: number;
  Q6: number;
  Q7: number;
  Q8: number;
  Q9: number;
  Q10: number;
  Q11: number;
  Qaux: number;
  incident: Float64Array;
  absorbedOpaque: number;
  /**
   * The floor's boundary node temperature -- the fabric node adjoining the
   * ground, i.e. `T[sn.first]` for the surface with `boundary === 'ground'`.
   * Surfaced by T-22 for `SimulationResult.temperatures.ground` (CONTRACTS.md
   * 7.7); the solver already computed this node, it was simply never read back
   * out. Falls back to the deep-soil boundary condition `env.T_ground` when the
   * building has no ground-boundary surface at all (the fully-adiabatic
   * validation fixture, Test 4).
   */
  T_groundNode: number;
}

/** Coefficients held constant across one weather hour. */
interface FrozenCoefficients {
  /** Per surface: exterior convection conductance, W/K. */
  hoA: Float64Array;
  /** Per surface: sky radiation conductance, W/K. */
  hrSkyA: Float64Array;
  /** Per surface: interior convection conductance to the air node, W/K. */
  hiA: Float64Array;
  /** Per surface: interior radiation conductance to the star node, W/K. */
  hrIA: Float64Array;
  /** Ground conductance for floor surfaces, W/K. */
  groundA: Float64Array;
  /** Infiltration conductance, W/K. */
  infiltrationG: number;
  /** Window conduction conductance, W/K. */
  windowG: number;
  /** True if any ACH in this hour was raised to the safety floor. */
  achClamped: boolean;
  /**
   * Indoor-air capacitance, J/K, frozen for this hour.
   *
   * It MUST be the identical value on both sides of the implicit step. The air
   * density depends on temperature, so recomputing it for the right-hand side
   * while the matrix still holds the hour-start value makes the step create or
   * destroy energy at a rate of (C_b - C_A)*T/dt -- hundreds of watts for a
   * fraction of a percent of mismatch. Store it once, use it in both places.
   */
  airCapacitance: number;
  factors: ArrowFactors;
  /** Response of every node to 1 W injected at the air node. */
  unitAuxResponse: Float64Array;
}

export interface RunOutput {
  records: StepRecord[];
  /**
   * Node temperatures at the instant the reported period BEGINS, i.e. before the
   * first recorded step is taken.
   *
   * This must not be confused with records[0].T, which is the state AFTER that
   * step. Using records[0].T as the baseline counts one timestep's flux without
   * its corresponding change in storage, which puts an error of exactly Q*dt
   * into the energy balance -- an error linear in the timestep, invisible at
   * dt = 60 s and over the 0.1% limit at dt = 300 s.
   */
  initialT: Float64Array;
  finalT: Float64Array;
  warnings: string[];
  spinUpDaysUsed: number;
}

const HOURS = 3600;

/** Read a weather array at a fractional index with linear interpolation. */
function sample(arr: Float64Array, idx: number): number {
  const i = Math.floor(idx);
  const f = idx - i;
  const a = arr[Math.min(i, arr.length - 1)] ?? 0;
  const b = arr[Math.min(i + 1, arr.length - 1)] ?? a;
  return a + (b - a) * f;
}

function optional(arr: Float64Array | undefined, idx: number): number | undefined {
  return arr ? sample(arr, idx) : undefined;
}

/**
 * Integrate the model forward. Returns one StepRecord per reported timestep.
 *
 * Spin-up is convergence-based rather than a fixed window (WORKERS.md A9): the
 * design day is repeated until the day-over-day maximum node change falls below
 * tolerance. A fixed 72 h is not enough for a heavy wall, whose time constant can
 * exceed three days.
 */
export function integrate(req: SimulationRequest, model: Model): RunOutput {
  const { options, weather, operation, site, building } = req;
  const dt = options.timestepSeconds;
  const stepsPerDay = Math.round(86400 / dt);
  const n = model.n;
  const warnings: string[] = [];

  // Initial condition: everything at the mean ambient temperature.
  let meanAmb = 0;
  for (let i = 0; i < weather.T_amb.length; i++) meanAmb += weather.T_amb[i]!;
  meanAmb /= Math.max(1, weather.T_amb.length);

  let T: Float64Array = new Float64Array(n).fill(meanAmb);
  const Tprev = new Float64Array(n);
  const series = precomputeEnvironment(req, model, stepsPerDay);

  // --- spin-up -------------------------------------------------------------
  /*
   * Find the PERIODIC STEADY STATE: the fabric temperatures that reproduce
   * themselves after one design day. A fixed 72 h window (BLUEPRINT.md) is far
   * too short for a heavy wall, so WORKERS.md A9 replaced it with iterating to
   * convergence -- but plain iteration needs ~25 days for an insulated
   * rammed-earth wall, and that spin-up then dominates the entire runtime.
   *
   * Because the model is linear over a day, the day-to-day map is affine
   *     T_{k+1} = M T_k + c
   * so the error decays geometrically with the spectral radius of M. Three
   * successive iterates are enough to estimate that ratio and extrapolate
   * straight to the fixed point (Aitken / Delta-squared). Convergence is still
   * VERIFIED by running another real day afterwards -- the extrapolation only
   * supplies a better starting guess, it is never trusted on its own.
   */
  let spinUpDaysUsed = 0;
  let converged = false;
  let prev: Float64Array | null = null;
  let prevDelta: Float64Array | null = null;

  for (let day = 0; day < options.maxSpinUpDays; day++) {
    const before = Float64Array.from(T);
    T = runOneDay(req, model, T, series, null);
    spinUpDaysUsed = day + 1;

    let maxChange = 0;
    for (let i = 0; i < n; i++) maxChange = Math.max(maxChange, Math.abs(T[i]! - before[i]!));
    if (maxChange < options.spinUpToleranceK) {
      converged = true;
      break;
    }

    const delta = new Float64Array(n);
    for (let i = 0; i < n; i++) delta[i] = T[i]! - before[i]!;

    if (prevDelta) {
      // Least-squares scalar contraction ratio between successive error vectors.
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        num += delta[i]! * prevDelta[i]!;
        den += prevDelta[i]! * prevDelta[i]!;
      }
      const rho = den > 0 ? num / den : 0;
      // Only extrapolate on a clean geometric contraction. Outside that range the
      // estimate is unreliable and a bad jump costs more days than it saves.
      if (rho > 0.05 && rho < 0.999) {
        const scale = rho / (1 - rho);
        for (let i = 0; i < n; i++) {
          const guess = T[i]! + delta[i]! * scale;
          // Never extrapolate outside the physically plausible band.
          if (guess > T_MIN_PLAUSIBLE && guess < T_MAX_PLAUSIBLE) T[i] = guess;
        }
        /*
         * Keep the delta history rather than discarding it. The next iteration
         * measures a fresh ratio from the extrapolated point, so extrapolation
         * can fire on consecutive days instead of needing two plain iterations
         * to rebuild history each time. The real day that follows always
         * verifies the jump, so an over-eager extrapolation self-corrects.
         */
        prevDelta = delta;
        continue;
      }
    }

    prev = before;
    prevDelta = delta;
    void prev;
  }
  if (!converged) {
    warnings.push(
      `Spin-up hit its ${options.maxSpinUpDays}-day cap without settling below ${options.spinUpToleranceK} K. The fabric is very heavy; results may still be drifting.`,
    );
  }

  // --- reported period -----------------------------------------------------
  const initialT = Float64Array.from(T);
  const records: StepRecord[] = [];
  for (let day = 0; day < options.simulationDays; day++) {
    T = runOneDay(req, model, T, series, records);
  }

  Tprev.set(T);
  void site;
  void building;
  void operation;
  return { records, initialT, finalT: T, warnings, spinUpDaysUsed };
}

/** One 24 h pass. When `records` is null this is a spin-up day and nothing is kept. */
function runOneDay(
  req: SimulationRequest,
  model: Model,
  T0: Float64Array,
  series: EnvironmentSeries,
  records: StepRecord[] | null,
): Float64Array {
  const { options } = req;
  const dt = options.timestepSeconds;
  const n = model.n;
  const stepsPerDay = series.steps;

  let coeffs: FrozenCoefficients | null = null;
  let frozenHour = -1;

  const b = new Float64Array(n);
  const baseSolution = new Float64Array(n);
  // Two buffers, swapped each step. Allocating a fresh Float64Array per timestep
  // is ~29k short-lived allocations per run and the GC cost is not small.
  let T = new Float64Array(n);
  let next = new Float64Array(n);
  T.set(T0);

  for (let step = 0; step < stepsPerDay; step++) {
    const secondsIntoDay = step * dt;
    const env = envAt(series, step);
    const hourOfDay = env.hourOfDay;

    // Refresh and refactorise only when the weather hour rolls over.
    const hourIndex = Math.floor(secondsIntoDay / HOURS);
    if (coeffs === null || hourIndex !== frozenHour) {
      coeffs = freezeCoefficients(req, model, T, env, dt);
      frozenHour = hourIndex;
    }

    buildRhs(req, model, T, env, coeffs, dt, b);
    solveArrow(coeffs.factors, b, AIR_NODE, STAR_NODE, baseSolution);

    // Auxiliary heating, exploiting linearity: the response to Q_aux watts is
    // exactly Q_aux times the response to 1 W, so no extra factorisation and no
    // iteration is needed -- two back substitutions give the exact answer.
    let qAux = 0;
    const aux = req.operation.auxHeating;
    const allowed = aux.enabled && (aux.schedule ? aux.schedule[Math.floor(hourOfDay) % 24] !== false : true);
    if (allowed && baseSolution[AIR_NODE]! < aux.setpoint) {
      const sensitivity = coeffs.unitAuxResponse[AIR_NODE]!;
      if (sensitivity > 1e-12) {
        qAux = Math.max(0, Math.min(aux.maxPower, ((aux.setpoint as number) - baseSolution[AIR_NODE]!) / sensitivity));
      }
    }

    for (let i = 0; i < n; i++) next[i] = baseSolution[i]! + qAux * coeffs.unitAuxResponse[i]!;

    for (let i = 0; i < n; i++) {
      const v = next[i]!;
      if (!Number.isFinite(v) || v < T_MIN_PLAUSIBLE || v > T_MAX_PLAUSIBLE) {
        throw new EngineError(
          'SOLVER_DIVERGED',
          `Node ${i} reached ${v.toFixed(1)} K at step ${step}. A plausible-looking wrong number is worse than a crash, so the run is aborted.`,
        );
      }
    }

    if (records) records.push(record(req, model, T, next, env, coeffs, qAux));

    const swap = T;
    T = next;
    next = swap;
  }
  return T;
}

/** Weather- and sun-derived quantities at one timestep. */
interface Environment {
  T_amb: number;
  T_sky: number;
  T_ground: number;
  windSpeed: number;
  /** Incident total irradiance per surface, W/m^2. */
  incident: Float64Array;
  /** cos(incidence) per surface. */
  cosTheta: Float64Array;
  hourOfDay: number;
}

/**
 * The whole day's environment, precomputed once.
 *
 * Nothing in here depends on the solution state -- only on the weather arrays and
 * the site's solar geometry -- so it is identical on every spin-up pass. Since
 * spin-up replays the same design day 10-30 times, computing sun position,
 * Erbs decomposition and per-surface transposition inside the timestep loop
 * repeats the same trigonometry tens of thousands of times for no reason.
 * Hoisting it out is the single largest saving in the engine.
 */
interface EnvironmentSeries {
  steps: number;
  surfaces: number;
  T_amb: Float64Array;
  T_sky: Float64Array;
  windSpeed: Float64Array;
  hourOfDay: Float64Array;
  /** Flat [step * surfaces + s]. */
  incident: Float64Array;
  cosTheta: Float64Array;
  T_ground: number;
  /** Scratch views handed to consumers, refilled per step. */
  scratchIncident: Float64Array;
  scratchCosTheta: Float64Array;
}

function precomputeEnvironment(
  req: SimulationRequest,
  model: Model,
  stepsPerDay: number,
): EnvironmentSeries {
  const { weather, site, options } = req;
  const S = model.surfaces.length;
  const dt = options.timestepSeconds;

  const out: EnvironmentSeries = {
    steps: stepsPerDay,
    surfaces: S,
    T_amb: new Float64Array(stepsPerDay),
    T_sky: new Float64Array(stepsPerDay),
    windSpeed: new Float64Array(stepsPerDay),
    hourOfDay: new Float64Array(stepsPerDay),
    incident: new Float64Array(stepsPerDay * S),
    cosTheta: new Float64Array(stepsPerDay * S),
    T_ground: site.groundTempMeanAnnual as number,
    scratchIncident: new Float64Array(S),
    scratchCosTheta: new Float64Array(S),
  };

  for (let step = 0; step < stepsPerDay; step++) {
    const secondsIntoDay = step * dt;
    const hourOfDay = (weather.startHour + secondsIntoDay / HOURS) % 24;
    const weatherIdx = (secondsIntoDay / weather.stepSeconds) % weather.T_amb.length;
    const dayOfYear =
      weather.startDayOfYear + Math.floor((weather.startHour + secondsIntoDay / HOURS) / 24);

    const T_amb = sample(weather.T_amb, weatherIdx);
    out.T_amb[step] = T_amb;
    out.windSpeed[step] = sample(weather.v_wind, weatherIdx);
    out.hourOfDay[step] = hourOfDay;
    out.T_sky[step] = skyTemperature(T_amb, optional(weather.LW_down, weatherIdx));

    const sun = sunPosition(site.latitude, site.longitude, site.standardMeridian, dayOfYear, hourOfDay);
    const irr = decompose(sample(weather.GHI, weatherIdx), sun.cosZenith, dayOfYear, {
      DNI: optional(weather.DNI, weatherIdx),
      DHI: optional(weather.DHI, weatherIdx),
    });
    const albedo = albedoAt(site.groundAlbedo, Math.floor(weatherIdx));

    for (let s = 0; s < S; s++) {
      const sn = model.surfaces[s]!;
      if (sn.surface.boundary !== 'exterior') continue;
      const t = transpose(irr, sun, sn.surface.tilt, sn.azimuth, albedo, options.skyModel);
      out.incident[step * S + s] = t.total;
      out.cosTheta[step * S + s] = t.cosTheta;
    }
  }
  return out;
}

/** View the precomputed series at one step. Reuses scratch buffers, no allocation. */
function envAt(series: EnvironmentSeries, step: number): Environment {
  const S = series.surfaces;
  for (let s = 0; s < S; s++) {
    series.scratchIncident[s] = series.incident[step * S + s]!;
    series.scratchCosTheta[s] = series.cosTheta[step * S + s]!;
  }
  return {
    T_amb: series.T_amb[step]!,
    T_sky: series.T_sky[step]!,
    T_ground: series.T_ground,
    windSpeed: series.windSpeed[step]!,
    incident: series.scratchIncident,
    cosTheta: series.scratchCosTheta,
    hourOfDay: series.hourOfDay[step]!,
  };
}

/** Build and factorise the system matrix for the current weather hour. */
function freezeCoefficients(
  req: SimulationRequest,
  model: Model,
  T: Float64Array,
  env: Environment,
  dt: number,
): FrozenCoefficients {
  const { site, building, operation } = req;
  const n = model.n;
  const S = model.surfaces.length;

  const hoA = new Float64Array(S);
  const hrSkyA = new Float64Array(S);
  const hiA = new Float64Array(S);
  const hrIA = new Float64Array(S);
  const groundA = new Float64Array(S);

  const bridge = building.thermalBridgeFactor;
  const h_o = hConvExterior(env.windSpeed, site.elevation);

  for (let s = 0; s < S; s++) {
    const sn = model.surfaces[s]!;
    const area = sn.opaqueArea;
    if (sn.surface.boundary === 'exterior') {
      hoA[s] = h_o * area;
      hrSkyA[s] = hRadSky(sn.surface.exteriorEmissivity, T[sn.first]!, env.T_sky) * sn.skyViewFactor * area;
    } else if (sn.surface.boundary === 'ground') {
      groundA[s] = SLAB_SOIL_CONDUCTANCE * area * bridge;
    }
    hiA[s] = hConvInterior(sn.surface.type, T[sn.last]!, T[AIR_NODE]!, site.elevation) * area;
    hrIA[s] = hRadInterior(sn.surface.interiorEmissivity, T[sn.last]!, T[STAR_NODE]!) * area;
  }

  const ach = scheduleAt(operation.achSchedule, env.hourOfDay);
  const inf = infiltration(ach, building.volume, site.elevation, T[AIR_NODE]!, req.options.allowUnsafeVentilation);

  let windowG = 0;
  for (const sn of model.surfaces) {
    for (const w of sn.windows) {
      const g = model.glazings[w.glazingId]!;
      windowG += effectiveWindowU(g, w, shutterClosed(w, env.hourOfDay)) * w.area;
    }
  }

  // ---- assemble the bordered block-tridiagonal system -----------------------
  const cAir = effectiveAirCapacitance(building.volume, site.elevation, T[AIR_NODE]!);

  let totalRadiantG = 0;
  let totalConvectiveG = 0;
  for (let s = 0; s < S; s++) {
    totalRadiantG += hrIA[s]!;
    totalConvectiveG += hiA[s]!;
  }
  /*
   * The star node carries no capacitance, so its row is an algebraic balance --
   * singular if nothing connects to it. That happens for a legitimate input:
   * interior emissivity of exactly 0, which the validation suite uses to isolate
   * convection from radiation. Rather than regularise with a fudge conductance,
   * tie the radiant temperature to the air temperature, which is the correct
   * degenerate answer when no surface radiates.
   */
  const tieStarToAir = totalRadiantG <= 0;

  const chains = model.surfaces.map((sn, s) => {
    const nS = sn.mesh.n;
    const area = sn.opaqueArea;
    const sub = new Float64Array(nS);
    const diag = new Float64Array(nS);
    const sup = new Float64Array(nS);

    for (let i = 0; i < nS; i++) diag[i] = model.C[sn.first + i]! / dt;

    for (let i = 0; i < nS - 1; i++) {
      // The thermal-bridge factor scales FABRIC conductance -- bridges live at
      // construction junctions, not in the surface air films or the glazing unit.
      const u = sn.mesh.U[i]! * area * bridge;
      diag[i] = diag[i]! + u;
      diag[i + 1] = diag[i + 1]! + u;
      sup[i] = -u;
      sub[i + 1] = -u;
    }

    if (sn.surface.boundary === 'exterior') {
      diag[0] = diag[0]! + hoA[s]! + hrSkyA[s]!;
    } else if (sn.surface.boundary === 'ground') {
      diag[0] = diag[0]! + groundA[s]!;
    }
    diag[nS - 1] = diag[nS - 1]! + hiA[s]! + (tieStarToAir ? 0 : hrIA[s]!);

    return {
      offset: sn.first,
      sub,
      diag,
      sup,
      hiA: hiA[s]!,
      hrIA: tieStarToAir ? 0 : hrIA[s]!,
    };
  });

  const dAir = cAir / dt + inf.conductance + windowG + totalConvectiveG;
  const dStar = totalRadiantG;

  const factors = factorArrow(chains, dAir, dStar, n, tieStarToAir);

  // Unit auxiliary-heat response: 1 W injected at the air node. Solved once per
  // refresh; linearity then gives the exact aux power without extra solves.
  const unit = new Float64Array(n);
  unit[AIR_NODE] = 1;
  const unitAuxResponse = solveArrow(factors, unit, AIR_NODE, STAR_NODE, new Float64Array(n));

  return {
    hoA,
    hrSkyA,
    hiA,
    hrIA,
    groundA,
    infiltrationG: inf.conductance,
    windowG,
    achClamped: inf.clampedToSafetyFloor,
    airCapacitance: cAir,
    factors,
    unitAuxResponse,
  };
}

/** Right-hand side for one timestep. Cheap: sources and boundary temperatures only. */
function buildRhs(
  req: SimulationRequest,
  model: Model,
  T: Float64Array,
  env: Environment,
  c: FrozenCoefficients,
  dt: number,
  b: Float64Array,
): void {
  const { operation } = req;
  b.fill(0);
  const n = model.n;

  // Use the SAME capacitance the matrix was built with -- see FrozenCoefficients.
  for (let i = 0; i < n; i++) b[i] = (model.C[i]! / dt) * T[i]!;
  b[AIR_NODE] = (c.airCapacitance / dt) * T[AIR_NODE]!;
  b[STAR_NODE] = 0;

  // Air node boundary couplings and gains.
  b[AIR_NODE] = b[AIR_NODE]! + (c.infiltrationG + c.windowG) * env.T_amb;
  b[AIR_NODE] = b[AIR_NODE]! + scheduleAt(operation.internalGainsSchedule, env.hourOfDay);

  // Solar: absorbed on opaque exterior faces, and transmitted through glazing.
  let transmitted = 0;
  for (let s = 0; s < model.surfaces.length; s++) {
    const sn = model.surfaces[s]!;
    if (sn.surface.boundary === 'exterior') {
      b[sn.first] = b[sn.first]! + sn.surface.exteriorAbsorptivity * env.incident[s]! * sn.opaqueArea;
      b[sn.first] = b[sn.first]! + c.hoA[s]! * env.T_amb + c.hrSkyA[s]! * env.T_sky;
    } else if (sn.surface.boundary === 'ground') {
      b[sn.first] = b[sn.first]! + c.groundA[s]! * env.T_ground;
    }
    for (const w of sn.windows) {
      const g = model.glazings[w.glazingId]!;
      transmitted += transmittedSolar(g, w, env.incident[s]!, env.cosTheta[s]!, shutterClosed(w, env.hourOfDay));
    }
  }

  distributeTransmittedSolar(model, transmitted, b);
}

/**
 * Deposit transmitted sunlight where it physically lands.
 *
 * Putting it on the AIR node instead would overheat the room at noon and leave it
 * cold by 8 PM -- the classic direct-gain failure. Landing it on a massive floor
 * is what lets the floor store it and release it overnight, which is the entire
 * effect the tool exists to demonstrate.
 */
function distributeTransmittedSolar(model: Model, transmitted: number, b: Float64Array): void {
  if (transmitted <= 0) return;
  b[AIR_NODE] = b[AIR_NODE]! + SOLAR_TO_AIR_FRACTION * transmitted;

  const hasFloor = model.floorArea > 0;
  const floorShare = hasFloor ? SOLAR_TO_FLOOR_FRACTION * transmitted : 0;
  const spreadShare = transmitted - floorShare - SOLAR_TO_AIR_FRACTION * transmitted;

  for (const sn of model.surfaces) {
    if (hasFloor && sn.surface.type === 'floor') {
      b[sn.last] = b[sn.last]! + (floorShare * sn.opaqueArea) / model.floorArea;
    }
    b[sn.last] = b[sn.last]! + (spreadShare * sn.opaqueArea) / model.totalInteriorArea;
  }
}

/** Capture every heat-flow term for this step, using the solved temperatures. */
function record(
  req: SimulationRequest,
  model: Model,
  Tprev: Float64Array,
  T: Float64Array,
  env: Environment,
  c: FrozenCoefficients,
  qAux: number,
): StepRecord {
  const S = model.surfaces.length;
  let Q1 = 0;
  let Q2 = 0;
  let Q3 = 0;
  let Q4 = 0;
  let Q5 = 0;
  let Q6 = 0;
  let Q7 = 0;
  let Q10 = 0;
  let absorbedOpaque = 0;
  // Falls back to the deep-soil boundary condition when no surface actually
  // borders the ground (the fully-adiabatic fixture has none) -- see the
  // StepRecord.T_groundNode doc comment.
  let T_groundNode = env.T_ground;

  for (let s = 0; s < S; s++) {
    const sn = model.surfaces[s]!;
    const Text = T[sn.first]!;
    const Tint = T[sn.last]!;
    if (sn.surface.boundary === 'exterior') {
      const abs = sn.surface.exteriorAbsorptivity * env.incident[s]! * sn.opaqueArea;
      Q1 += abs;
      absorbedOpaque += abs;
      Q3 += c.hoA[s]! * (env.T_amb - Text);
      Q4 += c.hrSkyA[s]! * (env.T_sky - Text);
    } else if (sn.surface.boundary === 'ground') {
      Q10 += c.groundA[s]! * (env.T_ground - Text);
      T_groundNode = Text;
    }
    // Conduction into the innermost fabric node from its neighbour.
    if (sn.mesh.n > 1) {
      const u = sn.mesh.U[sn.mesh.n - 2]! * sn.opaqueArea;
      Q5 += u * (T[sn.last - 1]! - Tint);
    }
    Q6 += c.hiA[s]! * (Tint - T[AIR_NODE]!);
    Q7 += c.hrIA[s]! * (T[STAR_NODE]! - Tint);
  }

  let transmitted = 0;
  for (let s = 0; s < S; s++) {
    const sn = model.surfaces[s]!;
    for (const w of sn.windows) {
      const g = model.glazings[w.glazingId]!;
      transmitted += transmittedSolar(g, w, env.incident[s]!, env.cosTheta[s]!, shutterClosed(w, env.hourOfDay));
    }
  }
  Q2 = transmitted;

  const Q8 = c.windowG * (env.T_amb - T[AIR_NODE]!);
  const Q9 = c.infiltrationG * (env.T_amb - T[AIR_NODE]!);
  const Q11 = scheduleAt(req.operation.internalGainsSchedule, env.hourOfDay);

  void Tprev;
  void C_P_AIR;

  return {
    T: Float64Array.from(T),
    T_amb: env.T_amb,
    T_sky: env.T_sky,
    T_mrt: T[STAR_NODE]!,
    Q1,
    Q2,
    Q3,
    Q4,
    Q5,
    Q6,
    Q7,
    Q8,
    Q9,
    Q10,
    Q11,
    Qaux: qAux,
    incident: Float64Array.from(env.incident),
    absorbedOpaque,
    T_groundNode,
  };
}
