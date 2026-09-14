/**
 * Test materials. Deliberately NOT imported from the production catalogue: a
 * validation test whose expected values move when someone edits a catalogue
 * entry is not a validation test. Values are from BLUEPRINT.md Appendix B.
 */

import type { Glazing, Layer, Material, Site, Surface, SimulationRequest, WeatherSeries } from '../src/types.js';
import { toK } from '../src/units.js';
import { buildWallMesh, constructionUValue } from '../src/envelope/mesh.js';
import { hConvExterior } from '../src/surfaces/exterior.js';
import { hConvInterior } from '../src/surfaces/interior.js';

const base = { category: 'structural', alphaSolar: 0.7, emissivity: 0.9, locallyAvailableLadakh: true, source: 'BLUEPRINT.md Appendix B (test fixture)' } as const;

export const M: Record<string, Material> = {
  denseConcrete: { ...base, id: 'denseConcrete', name: 'Dense concrete', k: 1.75, rho: 2400, c: 880 },
  rammedEarth: { ...base, id: 'rammedEarth', name: 'Rammed earth', k: 1.0, rho: 1900, c: 880 },
  firedBrick: { ...base, id: 'firedBrick', name: 'Fired clay brick', k: 0.72, rho: 1920, c: 835 },
  mudBrick: { ...base, id: 'mudBrick', name: 'Mud brick', k: 0.75, rho: 1700, c: 880 },
  granite: { ...base, id: 'granite', name: 'Stone masonry', k: 2.8, rho: 2600, c: 820 },
  eps: { ...base, id: 'eps', category: 'insulation', name: 'EPS', k: 0.036, rho: 20, c: 1400 },
  cementPlaster: { ...base, id: 'cementPlaster', category: 'finish', name: 'Cement plaster', k: 0.72, rho: 1860, c: 840 },
  steelSheet: { ...base, id: 'steelSheet', name: 'CGI steel sheet', k: 50, rho: 7800, c: 480, alphaSolar: 0.6, emissivity: 0.28 },
};

export const G: Record<string, Glazing> = {
  single: { id: 'single', name: 'Single glazing', U: 5.8, SHGC: 0.86, tauVis: 0.9, b0: 0.04, source: 'BLUEPRINT.md Appendix B (test fixture)' },
  double: { id: 'double', name: 'Double glazing', U: 2.8, SHGC: 0.76, tauVis: 0.78, b0: 0.05, source: 'BLUEPRINT.md Appendix B (test fixture)' },
};

// =========================================================================
// T-07 -- canonical apparatus for every validation task from here down.
// Everything below is ADDITIVE: M and G above are untouched, 65+ existing
// tests keep importing them unchanged.
// =========================================================================

/**
 * The catalogue every validation task keys off, values taken EXACTLY from
 * `BLUEPRINT.md` Appendix B as restated in `LOG.md` SS7.11. Deliberately a
 * separate record from `M` above (different key names, e.g. `stone` not
 * `granite`) -- `M` is the pre-existing general-purpose test catalogue, `MAT`
 * is the frozen, citation-carrying set this task was asked to add.
 *
 * Optical properties (alphaSolar/emissivity) come from the same appendix's
 * surface-optical-properties table: dark mud (0.70/0.90) for earthen
 * materials, grey concrete (0.65/0.88) for masonry/concrete, weathered
 * galvanised steel (0.60/0.28) for steel. Storage materials (water, PCM) are
 * never an exposed finish in this model, so their optical numbers are inert
 * placeholders, not measured quantities.
 */
export const MAT: Record<string, Material> = Object.freeze({
  stone: {
    id: 'stone', name: 'Stone masonry (granite)', category: 'structural',
    k: 2.8, rho: 2600, c: 820, alphaSolar: 0.65, emissivity: 0.88,
    locallyAvailableLadakh: true,
    source: 'BLUEPRINT.md Appendix B / ASHRAE Handbook of Fundamentals Ch. 26',
  },
  denseConcrete: {
    id: 'denseConcrete', name: 'Dense concrete', category: 'structural',
    k: 1.75, rho: 2400, c: 880, alphaSolar: 0.65, emissivity: 0.88,
    locallyAvailableLadakh: false,
    source: 'BLUEPRINT.md Appendix B / ASHRAE Handbook of Fundamentals Ch. 26',
  },
  rammedEarth: {
    id: 'rammedEarth', name: 'Rammed earth', category: 'structural',
    k: 1.0, rho: 1900, c: 880, alphaSolar: 0.7, emissivity: 0.9,
    locallyAvailableLadakh: true,
    source: 'BLUEPRINT.md Appendix B / IS 3792',
  },
  firedBrick: {
    id: 'firedBrick', name: 'Fired clay brick', category: 'structural',
    k: 0.72, rho: 1920, c: 835, alphaSolar: 0.68, emissivity: 0.9,
    // Firing needs kiln fuel that is scarce at altitude -- bricks are
    // typically trucked in, unlike raw earth/stone dug on site.
    locallyAvailableLadakh: false,
    source: 'BLUEPRINT.md Appendix B / ASHRAE Handbook of Fundamentals Ch. 26',
  },
  eps: {
    id: 'eps', name: 'EPS (thermocol)', category: 'insulation',
    k: 0.036, rho: 20, c: 1400, alphaSolar: 0.6, emissivity: 0.9,
    // Crosses the Zoji La like every manufactured insulation product.
    locallyAvailableLadakh: false,
    source: 'BLUEPRINT.md Appendix B',
  },
  puf: {
    id: 'puf', name: 'PUF / PIR', category: 'insulation',
    k: 0.025, rho: 35, c: 1400, alphaSolar: 0.6, emissivity: 0.9,
    locallyAvailableLadakh: false,
    source: 'BLUEPRINT.md Appendix B',
  },
  steel: {
    id: 'steel', name: 'Steel (CGI sheet)', category: 'structural',
    k: 50, rho: 7800, c: 480, alphaSolar: 0.6, emissivity: 0.28,
    locallyAvailableLadakh: false,
    source: 'BLUEPRINT.md Appendix B (weathered galvanised steel optical row)',
  },
  mudPlaster: {
    id: 'mudPlaster', name: 'Mud plaster', category: 'finish',
    k: 0.75, rho: 1600, c: 880, alphaSolar: 0.7, emissivity: 0.9,
    locallyAvailableLadakh: true,
    source: 'BLUEPRINT.md Appendix B',
  },
  water: {
    id: 'water', name: 'Water (drum storage)', category: 'storage',
    k: 0.6, rho: 1000, c: 4186, alphaSolar: 0.9, emissivity: 0.9,
    locallyAvailableLadakh: true,
    source: 'BLUEPRINT.md Appendix B',
  },
  pcmRt25: {
    id: 'pcmRt25', name: 'PCM paraffin RT25', category: 'storage',
    k: 0.2, rho: 880, c: 2000, alphaSolar: 0.8, emissivity: 0.9,
    // PCMs are a manufactured import, same as EPS/XPS/PUF.
    locallyAvailableLadakh: false,
    source: 'BLUEPRINT.md Appendix B (Rubitherm RT25-class datasheet values)',
  },
});

const SYNTHETIC_PROVENANCE = {
  source: 'synthetic' as const,
  label: 'synthetic test fixture',
  sourceElevation: null,
  lapseCorrectionK: 0,
  notes: [] as string[],
};

/** A constant-temperature `WeatherSeries` of `steps` hourly samples. */
export function constantWeather(tK: number, steps: number): WeatherSeries {
  return {
    stepSeconds: 3600,
    startDayOfYear: 15,
    startHour: 0,
    T_amb: new Float64Array(steps).fill(tK),
    GHI: new Float64Array(steps),
    v_wind: new Float64Array(steps),
    provenance: { ...SYNTHETIC_PROVENANCE },
  };
}

/** A sinusoidal `WeatherSeries`: mean +/- amplitude, one hourly sample per step. */
export function sineWeather(meanK: number, amplitudeK: number, periodS: number, steps: number): WeatherSeries {
  const dt = 3600;
  const omega = (2 * Math.PI) / periodS;
  const T_amb = new Float64Array(steps);
  for (let i = 0; i < steps; i++) T_amb[i] = meanK + amplitudeK * Math.sin(omega * (i + 1) * dt);
  return {
    stepSeconds: dt,
    startDayOfYear: 15,
    startHour: 0,
    T_amb,
    GHI: new Float64Array(steps),
    v_wind: new Float64Array(steps),
    provenance: { ...SYNTHETIC_PROVENANCE },
  };
}

/**
 * The C-01 shelter pair's shared scaffold: everything held IDENTICAL between
 * the two shelters except `construction`, per CHALLENGE.md C-01. Self
 * contained (does not import test/box.ts's buildBox) so this file's most
 * safety-critical fixture never shifts under an edit to that helper.
 */
function buildC01Shelter(construction: Layer[]): SimulationRequest {
  const side = 4;
  const area = side * side;
  const opaque = (id: string, type: Surface['type'], tilt: number, azimuth: number): Surface => ({
    id, type, area, tilt, azimuth, construction,
    boundary: 'exterior',
    exteriorAbsorptivity: 0.7,
    exteriorEmissivity: 0.9,
    interiorEmissivity: 0.9,
  });
  const surfaces: Surface[] = [
    opaque('south', 'wall', 90, 0),
    opaque('east', 'wall', 90, -90),
    opaque('west', 'wall', 90, 90),
    opaque('north', 'wall', 90, 180),
    opaque('roof', 'roof', 0, 0),
    opaque('floor', 'floor', 180, 0),
  ];

  const site: Site = {
    id: 'c01', name: 'C-01 kill-shot test site',
    latitude: 34.15, longitude: 77.58, elevation: 3500, standardMeridian: 82.5,
    groundAlbedo: 0.3, groundTempMeanAnnual: toK(6),
  };

  const steps = 24;
  const T_amb = new Float64Array(steps);
  const GHI = new Float64Array(steps);
  const v_wind = new Float64Array(steps).fill(2);
  for (let h = 0; h < steps; h++) {
    T_amb[h] = toK(-8 + 6 * Math.sin(((h - 15) / 24) * 2 * Math.PI));
    GHI[h] = h >= 8 && h <= 16 ? 500 * Math.sin(((h - 8) / 8) * Math.PI) : 0;
  }

  return {
    site,
    building: {
      floorArea: area,
      volume: area * side,
      azimuth: 0,
      surfaces,
      windows: [{ id: 'southWindow', hostSurfaceId: 'south', area: 1.5, glazingId: 'single' }],
      thermalBridgeFactor: 1.1,
    },
    operation: {
      internalGainsSchedule: new Array(24).fill(150),
      achSchedule: new Array(24).fill(0.5),
      auxHeating: { enabled: false, setpoint: toK(18), maxPower: 0 },
      comfortBand: { lower: toK(15), upper: toK(24) },
    },
    weather: {
      stepSeconds: 3600,
      startDayOfYear: 15,
      startHour: 0,
      T_amb, GHI, v_wind,
      provenance: {
        source: 'synthetic', label: 'C-01 kill-shot synthetic weather',
        sourceElevation: null, lapseCorrectionK: 0, notes: [],
      },
    },
    materials: MAT,
    glazings: G,
    options: {
      timestepSeconds: 300, meshTargetDx: 0.02, simulationDays: 2,
      spinUpToleranceK: 0.02, maxSpinUpDays: 30, skyModel: 'isotropic',
      integrationTheta: 1, keepSurfaceProfiles: false, allowUnsafeVentilation: false,
    },
  };
}

const STONE_400_CONSTRUCTION: Layer[] = [{ materialId: 'stone', thickness: 0.4 }];
const STEEL_PUF_CONSTRUCTION: Layer[] = [
  { materialId: 'steel', thickness: 0.001 },
  { materialId: 'puf', thickness: 0.05 },
];

/** `CHALLENGE.md` C-01, shelter A: 400 mm stone masonry, uninsulated. */
export const shelterA_stone400: SimulationRequest = buildC01Shelter(STONE_400_CONSTRUCTION);
/** `CHALLENGE.md` C-01, shelter B: 1 mm steel skin + 50 mm PUF. */
export const shelterB_steelPuf: SimulationRequest = buildC01Shelter(STEEL_PUF_CONSTRUCTION);

// The C-01 validity condition: B must be the better-insulated shelter, or the
// pair proves nothing (B could then win on insulation alone). Surface films
// (h_o, h_i) are identical for both, so this is a fair, hand-checkable
// steady-state U-value comparison of the fabric alone.
const C01_H_OUTER = hConvExterior(2, 3500);
const C01_H_INNER = hConvInterior('wall', 0, 0, 3500);
/** Shelter A's steady-state envelope U-value, W/(m^2*K). Exported for the evidence trail. */
export const C01_U_A = constructionUValue(buildWallMesh(STONE_400_CONSTRUCTION, MAT), C01_H_OUTER, C01_H_INNER);
/** Shelter B's steady-state envelope U-value, W/(m^2*K). Exported for the evidence trail. */
export const C01_U_B = constructionUValue(buildWallMesh(STEEL_PUF_CONSTRUCTION, MAT), C01_H_OUTER, C01_H_INNER);
if (!(C01_U_B <= C01_U_A)) {
  throw new Error(
    `C-01 fixture is invalid: shelterB_steelPuf U=${C01_U_B} W/(m^2K) must be <= shelterA_stone400 U=${C01_U_A} W/(m^2K), ` +
      'otherwise B could win the comparison on insulation alone.',
  );
}

/**
 * Validation Test 2's apparatus: one homogeneous wall, thick enough that a
 * fixed far-face temperature cannot influence the near-exterior response, so
 * it stands in for the semi-infinite solid the closed form assumes. Drive it
 * with `driveWall` (sinusoidal `exteriorTemp`, constant `interiorTemp`, no
 * solar) from `envelope/response.ts`, then read `probeNode` back with
 * `nodeSeries` and compare to `analyticalDecrementLag` via `decrementAndLag`.
 */
export function singleWallSemiInfinite(materialKey: keyof typeof MAT, thicknessM: number) {
  const material = MAT[materialKey]!;
  const a = material.k / (material.rho * material.c);
  // >= 4 penetration depths of dead stock beyond the probe point so the
  // Dirichlet far boundary cannot contaminate the probed node.
  const domainDepth = thicknessM + 4 * Math.sqrt((a * 86400) / Math.PI);
  const mesh = buildWallMesh([{ materialId: material.id, thickness: domainDepth }], { [material.id]: material }, 0.005);
  let probeNode = 0;
  let bestErr = Infinity;
  for (let i = 0; i < mesh.n; i++) {
    const err = Math.abs(mesh.x[i]! - thicknessM);
    if (err < bestErr) {
      bestErr = err;
      probeNode = i;
    }
  }
  return { material, mesh, probeNode, domainDepth };
}

/**
 * Validation Test 4's apparatus: every exterior conductance zero (adiabatic
 * boundary on every surface) and a constant internal gain, so at steady state
 * all of `gainW` must appear as auxiliary-free indoor heating -- the simplest
 * possible check that the solver conserves energy at all.
 *
 * `allowUnsafeVentilation: true` is required here -- an adiabatic box with the
 * normal ACH_MIN floor still loses heat through infiltration, which is not
 * adiabatic. This is the ONE legitimate use of that flag (LOG.md SS7.5 /
 * rule 10); never copy this pattern into a production code path.
 */
export function adiabaticBox(gainW: number): SimulationRequest {
  const req = buildC01Shelter([{ materialId: 'rammedEarth', thickness: 0.3 }]);
  for (const s of req.building.surfaces) s.boundary = 'adiabatic';
  req.building.windows = [];
  req.operation.internalGainsSchedule = new Array(24).fill(gainW);
  req.operation.achSchedule = new Array(24).fill(0);
  req.weather = constantWeather(toK(-10), 24);
  req.options = { ...req.options, allowUnsafeVentilation: true, simulationDays: 3 };
  return req;
}

/**
 * Validation Test 1's apparatus: constant ambient, zero solar, a known
 * auxiliary heat input pinned to exactly `qAuxW` by setting an unreachably
 * high setpoint -- the heater then saturates at `maxPower` every hour, and
 * the steady-state indoor temperature must satisfy `T_in = T_amb + qAux/UA`.
 */
export function steadyStateBox(qAuxW: number): SimulationRequest {
  const req = buildC01Shelter([{ materialId: 'rammedEarth', thickness: 0.3 }]);
  req.building.windows = [];
  req.operation.internalGainsSchedule = new Array(24).fill(0);
  req.operation.achSchedule = new Array(24).fill(0.5);
  req.operation.auxHeating = { enabled: true, setpoint: toK(60), maxPower: qAuxW };
  req.weather = constantWeather(toK(-10), 24);
  req.options = { ...req.options, simulationDays: 10 };
  return req;
}
