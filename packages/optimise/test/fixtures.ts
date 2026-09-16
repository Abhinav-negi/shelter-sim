/**
 * Self-contained test apparatus for `@shelter/optimise`. Deliberately NOT
 * imported from `packages/engine/test/fixtures.ts` -- that file lives outside
 * this package's `dist` boundary and outside packages/optimise's own allow
 * list, and a package whose only approved runtime dependency is
 * `@shelter/engine` (CONTRACTS.md §7.13) should not lean on another
 * package's test-only exports either.
 */

import { toK, type Glazing, type Material, type SimulationRequest, type Surface } from '@shelter/engine';

export const MAT: Record<string, Material> = {
  stone: {
    id: 'stone', name: 'Stone masonry (granite)', category: 'structural',
    k: 2.8, rho: 2600, c: 820, alphaSolar: 0.65, emissivity: 0.88,
    locallyAvailableLadakh: true, costPerM3: 4500, embodiedCarbon: 60,
    source: 'BLUEPRINT.md Appendix B (test fixture)',
  },
  rammedEarth: {
    id: 'rammedEarth', name: 'Rammed earth', category: 'structural',
    k: 1.0, rho: 1900, c: 880, alphaSolar: 0.7, emissivity: 0.9,
    locallyAvailableLadakh: true, costPerM3: 1800, embodiedCarbon: 45,
    source: 'BLUEPRINT.md Appendix B (test fixture)',
  },
  firedBrick: {
    id: 'firedBrick', name: 'Fired clay brick', category: 'structural',
    k: 0.72, rho: 1920, c: 835, alphaSolar: 0.68, emissivity: 0.9,
    locallyAvailableLadakh: false, costPerM3: 5200, embodiedCarbon: 240,
    source: 'BLUEPRINT.md Appendix B (test fixture)',
  },
  mudBrick: {
    id: 'mudBrick', name: 'Mud brick / adobe', category: 'structural',
    k: 0.75, rho: 1700, c: 880, alphaSolar: 0.7, emissivity: 0.9,
    locallyAvailableLadakh: true, costPerM3: 1200, embodiedCarbon: 25,
    source: 'BLUEPRINT.md Appendix B (test fixture)',
  },
  denseConcrete: {
    id: 'denseConcrete', name: 'Dense concrete', category: 'structural',
    k: 1.75, rho: 2400, c: 880, alphaSolar: 0.65, emissivity: 0.88,
    locallyAvailableLadakh: false, costPerM3: 6800, embodiedCarbon: 290,
    source: 'BLUEPRINT.md Appendix B (test fixture)',
  },
  eps: {
    id: 'eps', name: 'EPS (thermocol)', category: 'insulation',
    k: 0.036, rho: 20, c: 1400, alphaSolar: 0.6, emissivity: 0.9,
    locallyAvailableLadakh: false, costPerM3: 8500, embodiedCarbon: 90,
    source: 'BLUEPRINT.md Appendix B (test fixture)',
  },
  cementPlaster: {
    id: 'cementPlaster', name: 'Cement plaster', category: 'finish',
    k: 0.72, rho: 1860, c: 840, alphaSolar: 0.65, emissivity: 0.88,
    locallyAvailableLadakh: true, costPerM3: 3200, embodiedCarbon: 180,
    source: 'BLUEPRINT.md Appendix B (test fixture)',
  },
  water: {
    id: 'water', name: 'Water (drum storage)', category: 'storage',
    k: 0.6, rho: 1000, c: 4186, alphaSolar: 0.9, emissivity: 0.9,
    locallyAvailableLadakh: true, costPerM3: 50, embodiedCarbon: 1,
    source: 'BLUEPRINT.md Appendix B (test fixture)',
  },
  pcmRt25: {
    id: 'pcmRt25', name: 'PCM paraffin RT25', category: 'storage',
    k: 0.2, rho: 880, c: 2000, alphaSolar: 0.8, emissivity: 0.9,
    locallyAvailableLadakh: false, costPerM3: 45000, embodiedCarbon: 400,
    source: 'BLUEPRINT.md Appendix B (test fixture)',
  },
};

export const GLAZ: Record<string, Glazing> = {
  single: { id: 'single', name: 'Single glazing', U: 5.8, SHGC: 0.86, tauVis: 0.9, b0: 0.04, costPerM2: 1500, source: 'BLUEPRINT.md Appendix B (test fixture)' },
  double: { id: 'double', name: 'Double glazing', U: 2.8, SHGC: 0.76, tauVis: 0.78, b0: 0.05, costPerM2: 3800, source: 'BLUEPRINT.md Appendix B (test fixture)' },
  triple: { id: 'triple', name: 'Triple glazing', U: 0.9, SHGC: 0.5, tauVis: 0.7, b0: 0.07, costPerM2: 7200, source: 'BLUEPRINT.md Appendix B (test fixture)' },
};

/**
 * A 4x4 m single-storey box with windows on all four cardinal walls (so a
 * `wwr` spec on any orientation, or a `buildingAzimuth`/`aspectRatio` sweep,
 * always has something real to act on), a rammed-earth + EPS + plaster wall
 * assembly, and a synthetic January design day. Every field is a plain
 * `SimulationRequest` -- callers may swap in `MAT`/`GLAZ` entries at will.
 */
export function baseRequest(wallMaterialId = 'rammedEarth'): SimulationRequest {
  const side = 4;
  const area = side * side;
  const construction = [
    { materialId: wallMaterialId, thickness: 0.3 },
    { materialId: 'eps', thickness: 0.08 },
    { materialId: 'cementPlaster', thickness: 0.02 },
  ];
  const opaque = (id: string, type: Surface['type'], tilt: number, azimuth: number): Surface => ({
    id, type, area, tilt, azimuth, construction,
    boundary: 'exterior', exteriorAbsorptivity: 0.7, exteriorEmissivity: 0.9, interiorEmissivity: 0.9,
  });
  const surfaces: Surface[] = [
    opaque('wallSouth', 'wall', 90, 0),
    opaque('wallEast', 'wall', 90, -90),
    opaque('wallWest', 'wall', 90, 90),
    opaque('wallNorth', 'wall', 90, 180),
    opaque('roof', 'roof', 0, 0),
    { ...opaque('floor', 'floor', 180, 0), boundary: 'ground' },
  ];

  const steps = 24;
  const T_amb = new Float64Array(steps);
  const GHI = new Float64Array(steps);
  const v_wind = new Float64Array(steps).fill(2);
  for (let h = 0; h < steps; h++) {
    T_amb[h] = toK(-18 + 10 * Math.sin(((h - 9) / 24) * 2 * Math.PI));
    GHI[h] = h > 7 && h < 17 ? 800 * Math.sin(((h - 7) / 10) * Math.PI) : 0;
  }

  return {
    site: {
      id: 'leh', name: 'Leh test site', latitude: 34.15, longitude: 77.58, elevation: 3500,
      standardMeridian: 82.5, groundAlbedo: 0.3, groundTempMeanAnnual: toK(6),
    },
    building: {
      floorArea: area,
      volume: area * side,
      azimuth: 0,
      surfaces,
      windows: [
        { id: 'winSouth', hostSurfaceId: 'wallSouth', area: 2, glazingId: 'double' },
        { id: 'winEast', hostSurfaceId: 'wallEast', area: 1, glazingId: 'double' },
        { id: 'winWest', hostSurfaceId: 'wallWest', area: 1, glazingId: 'double' },
        { id: 'winNorth', hostSurfaceId: 'wallNorth', area: 0.5, glazingId: 'double' },
      ],
      thermalBridgeFactor: 1.1,
    },
    operation: {
      internalGainsSchedule: new Array(24).fill(300),
      achSchedule: new Array(24).fill(0.5),
      auxHeating: { enabled: false, setpoint: toK(18), maxPower: 0 },
      comfortBand: { lower: toK(15), upper: toK(24) },
    },
    weather: {
      stepSeconds: 3600, startDayOfYear: 15, startHour: 0, T_amb, GHI, v_wind,
      provenance: { source: 'synthetic', label: 'optimise test fixture', sourceElevation: null, lapseCorrectionK: 0, notes: [] },
    },
    materials: MAT,
    glazings: GLAZ,
    options: {
      timestepSeconds: 300, meshTargetDx: 0.02, simulationDays: 1,
      spinUpToleranceK: 0.02, maxSpinUpDays: 30, skyModel: 'hdkr',
      integrationTheta: 1, keepSurfaceProfiles: false, allowUnsafeVentilation: false,
    },
  };
}
