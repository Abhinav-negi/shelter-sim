/**
 * A minimal box builder for the validation suite. Deliberately plain: a cube with
 * configurable construction, so the analytical expectations stay hand-checkable.
 */

import type { Operation, SimOptions, SimulationRequest, Site, Surface, WindowSpec, Layer } from '../src/types.js';
import { toK, type Kelvin } from '../src/units.js';
import { G, M } from './fixtures.js';

export interface BoxOptions {
  side?: number;
  construction?: Layer[];
  boundary?: Surface['boundary'];
  /** Constant ambient temperature, K. Overridden by ambientAt. */
  ambient?: number;
  ambientAt?: (hour: number) => number;
  ghiAt?: (hour: number) => number;
  windSpeed?: number;
  ach?: number;
  internalGainsW?: number;
  absorptivity?: number;
  emissivity?: number;
  windows?: WindowSpec[];
  altitude?: number;
  allowUnsafeVentilation?: boolean;
  simulationDays?: number;
  aux?: Operation['auxHeating'];
  groundTemp?: number;
}

export function buildBox(o: BoxOptions = {}): SimulationRequest {
  const side = o.side ?? 4;
  const area = side * side;
  const construction = o.construction ?? [{ materialId: 'rammedEarth', thickness: 0.3 }];
  const boundary = o.boundary ?? 'exterior';
  const absorptivity = o.absorptivity ?? 0.7;
  const emissivity = o.emissivity ?? 0.9;

  const face = (id: string, type: Surface['type'], tilt: number, azimuth: number): Surface => ({
    id,
    type,
    area,
    tilt,
    azimuth,
    construction,
    boundary,
    exteriorAbsorptivity: absorptivity,
    exteriorEmissivity: emissivity,
    interiorEmissivity: emissivity,
  });

  const surfaces: Surface[] = [
    face('south', 'wall', 90, 0),
    face('east', 'wall', 90, -90),
    face('west', 'wall', 90, 90),
    face('north', 'wall', 90, 180),
    face('roof', 'roof', 0, 0),
    face('floor', 'floor', 180, 0),
  ];

  const site: Site = {
    id: 'test',
    name: 'Test site',
    latitude: 34.15,
    longitude: 77.58,
    elevation: o.altitude ?? 3500,
    standardMeridian: 82.5,
    groundAlbedo: 0.3,
    groundTempMeanAnnual: (o.groundTemp ?? o.ambient ?? toK(5)) as Kelvin,
  };

  const steps = 24;
  const T_amb = new Float64Array(steps);
  const GHI = new Float64Array(steps);
  const v_wind = new Float64Array(steps).fill(o.windSpeed ?? 0);
  for (let h = 0; h < steps; h++) {
    T_amb[h] = o.ambientAt ? o.ambientAt(h) : (o.ambient ?? toK(-10));
    GHI[h] = o.ghiAt ? o.ghiAt(h) : 0;
  }

  const operation: Operation = {
    internalGainsSchedule: new Array(24).fill(o.internalGainsW ?? 0),
    achSchedule: new Array(24).fill(o.ach ?? 0.5),
    auxHeating: o.aux ?? { enabled: false, setpoint: toK(18), maxPower: 0 },
    comfortBand: { lower: toK(18), upper: toK(26) },
  };

  const options: SimOptions = {
    timestepSeconds: 300,
    meshTargetDx: 0.02,
    simulationDays: o.simulationDays ?? 1,
    spinUpToleranceK: 0.02,
    maxSpinUpDays: 30,
    skyModel: 'isotropic',
    integrationTheta: 1,
    keepSurfaceProfiles: false,
    allowUnsafeVentilation: o.allowUnsafeVentilation ?? false,
  };

  return {
    site,
    building: {
      floorArea: area,
      volume: area * side,
      azimuth: 0,
      surfaces,
      windows: o.windows ?? [],
      thermalBridgeFactor: 1.0,
    },
    operation,
    weather: {
      stepSeconds: 3600,
      startDayOfYear: 355,
      startHour: 0,
      T_amb,
      GHI,
      v_wind,
      provenance: { source: 'synthetic', label: 'Test fixture', sourceElevation: null, lapseCorrectionK: 0, notes: [] },
    },
    materials: M,
    glazings: G,
    options,
  };
}
