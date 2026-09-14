#!/usr/bin/env node
/**
 * THE ENERGY-BALANCE CI GATE. LOG.md T-04 / §7.4.
 *
 * Runs the built engine's `simulate()` over a set of fixtures and asserts
 * `result.meta.energyBalanceResidual` stays below the 1e-3 (0.1%) contract
 * limit from LOG.md §7.4. Threshold is a DIMENSIONLESS FRACTION -- do not
 * convert to a percentage here; that is the UI's job.
 *
 * ponytail: packages/engine/test/fixtures.ts today (before T-07) exports only
 * material/glazing catalogues (M, G), not runnable SimulationRequest fixtures
 * -- those are added by T-07 and T-28. This file may not touch fixtures.ts
 * (T-04's allow-list is CI files only), so it defines its own small,
 * self-contained fixtures below using the same proven shape as
 * packages/engine/test/box.ts. Upgrade path: once T-07/T-28 land, add their
 * exports to FIXTURES (import them from the built test output, or extend this
 * list) -- the gate logic below does not need to change.
 */
import { simulate } from '../packages/engine/dist/index.js';

const toK = (c) => c + 273.15;

const MATERIALS = {
  rammedEarth: {
    id: 'rammedEarth',
    name: 'Rammed earth',
    category: 'structural',
    k: 1.0,
    rho: 1900,
    c: 880,
    alphaSolar: 0.7,
    emissivity: 0.9,
    locallyAvailableLadakh: true,
    source: 'BLUEPRINT.md Appendix B (CI energy-balance fixture)',
  },
  denseConcrete: {
    id: 'denseConcrete',
    name: 'Dense concrete',
    category: 'structural',
    k: 1.75,
    rho: 2400,
    c: 880,
    alphaSolar: 0.7,
    emissivity: 0.9,
    locallyAvailableLadakh: true,
    source: 'BLUEPRINT.md Appendix B (CI energy-balance fixture)',
  },
  eps: {
    id: 'eps',
    name: 'EPS',
    category: 'insulation',
    k: 0.036,
    rho: 20,
    c: 1400,
    alphaSolar: 0.7,
    emissivity: 0.9,
    locallyAvailableLadakh: false,
    source: 'BLUEPRINT.md Appendix B (CI energy-balance fixture)',
  },
};

const GLAZINGS = {
  single: {
    id: 'single',
    name: 'Single glazing',
    U: 5.8,
    SHGC: 0.86,
    tauVis: 0.9,
    b0: 0.04,
    source: 'BLUEPRINT.md Appendix B (CI energy-balance fixture)',
  },
};

/** Same box shape as packages/engine/test/box.ts's buildBox, plain-JS. */
function buildBox({
  construction,
  windows = [],
  ach = 0.5,
  internalGainsW = 300,
  ambient = toK(-10),
}) {
  const side = 4;
  const area = side * side;

  const face = (id, type, tilt, azimuth) => ({
    id,
    type,
    area,
    tilt,
    azimuth,
    construction,
    boundary: 'exterior',
    exteriorAbsorptivity: 0.7,
    exteriorEmissivity: 0.9,
    interiorEmissivity: 0.9,
  });

  const surfaces = [
    face('south', 'wall', 90, 0),
    face('east', 'wall', 90, -90),
    face('west', 'wall', 90, 90),
    face('north', 'wall', 90, 180),
    face('roof', 'roof', 0, 0),
    face('floor', 'floor', 180, 0),
  ];

  const steps = 24;
  const T_amb = new Float64Array(steps).fill(ambient);
  const GHI = new Float64Array(steps);
  const v_wind = new Float64Array(steps).fill(2);
  for (let h = 0; h < steps; h++) {
    GHI[h] = h >= 6 && h <= 18 ? 400 * Math.sin(((h - 6) / 12) * Math.PI) : 0;
  }

  return {
    site: {
      id: 'ci',
      name: 'CI test site',
      latitude: 34.15,
      longitude: 77.58,
      elevation: 3500,
      standardMeridian: 82.5,
      groundAlbedo: 0.3,
      groundTempMeanAnnual: toK(5),
    },
    building: {
      floorArea: area,
      volume: area * side,
      azimuth: 0,
      surfaces,
      windows,
      thermalBridgeFactor: 1.05,
    },
    operation: {
      internalGainsSchedule: new Array(24).fill(internalGainsW),
      achSchedule: new Array(24).fill(ach),
      auxHeating: { enabled: false, setpoint: toK(18), maxPower: 0 },
      comfortBand: { lower: toK(18), upper: toK(26) },
    },
    weather: {
      stepSeconds: 3600,
      startDayOfYear: 355,
      startHour: 0,
      T_amb,
      GHI,
      v_wind,
      provenance: {
        source: 'synthetic',
        label: 'CI energy-balance fixture',
        sourceElevation: null,
        lapseCorrectionK: 0,
        notes: [],
      },
    },
    materials: MATERIALS,
    glazings: GLAZINGS,
    options: {
      timestepSeconds: 300,
      meshTargetDx: 0.02,
      simulationDays: 1,
      spinUpToleranceK: 0.02,
      maxSpinUpDays: 30,
      skyModel: 'isotropic',
      integrationTheta: 1,
      keepSurfaceProfiles: false,
      allowUnsafeVentilation: false,
    },
  };
}

const FIXTURES = [
  {
    name: 'rammed-earth-300mm',
    request: buildBox({ construction: [{ materialId: 'rammedEarth', thickness: 0.3 }] }),
  },
  {
    name: 'concrete-eps-insulated-glazed',
    request: buildBox({
      construction: [
        { materialId: 'denseConcrete', thickness: 0.15 },
        { materialId: 'eps', thickness: 0.08 },
      ],
      windows: [{ id: 'w1', hostSurfaceId: 'south', area: 2, glazingId: 'single' }],
      ambient: toK(-20),
      internalGainsW: 600,
    }),
  },
];

const THRESHOLD = 1e-3; // dimensionless fraction, i.e. 0.1% -- LOG.md §7.4. Do not change here.

let maxResidual = 0;
let failed = false;

for (const { name, request } of FIXTURES) {
  const result = simulate(request);
  const residual = result.meta.energyBalanceResidual;
  console.log(`${name}: residual ${residual}`);
  if (residual > maxResidual) maxResidual = residual;
  if (residual >= THRESHOLD) failed = true;
}

console.log(`MAX RESIDUAL: ${maxResidual}`);

if (failed) {
  console.error(
    `Energy-balance gate FAILED: a fixture's residual reached or exceeded ${THRESHOLD}.`,
  );
  process.exit(1);
}
