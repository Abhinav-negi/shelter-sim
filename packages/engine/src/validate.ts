/**
 * Input validation at the top of simulate(). WORKERS.md 3.15.
 *
 * Collects EVERY problem before throwing, so a user with three bad fields sees
 * three messages rather than being made to fix them one at a time.
 */

import { ACH_MIN } from './constants.js';
import { EngineError } from './types.js';
import type { SimulationRequest } from './types.js';

export interface Problem {
  path: string;
  message: string;
}

export function validateRequest(req: SimulationRequest): void {
  const p: Problem[] = [];
  const bad = (path: string, message: string) => p.push({ path, message });

  const { site, building, operation, weather, options } = req;

  if (!Number.isFinite(site.latitude) || Math.abs(site.latitude) > 90) bad('site.latitude', 'Latitude must be between -90 and 90.');
  if (!Number.isFinite(site.longitude) || Math.abs(site.longitude) > 180) bad('site.longitude', 'Longitude must be between -180 and 180.');
  if (!(site.elevation >= -500 && site.elevation < 9000)) bad('site.elevation', 'Elevation must be between -500 m and 9000 m.');

  if (!(building.volume > 0)) bad('building.volume', 'Room volume must be positive.');
  if (!(building.floorArea > 0)) bad('building.floorArea', 'Floor area must be positive.');
  if (!(building.thermalBridgeFactor >= 1 && building.thermalBridgeFactor <= 2)) {
    bad('building.thermalBridgeFactor', 'Thermal bridge factor should be between 1.0 and 2.0 (typically 1.05-1.20).');
  }
  if (building.surfaces.length === 0) bad('building.surfaces', 'The building needs at least one surface.');

  for (const s of building.surfaces) {
    if (!(s.area > 0)) bad(`surface[${s.id}].area`, 'Surface area must be positive.');
    if (!(s.tilt >= 0 && s.tilt <= 180)) bad(`surface[${s.id}].tilt`, 'Tilt must be 0-180 degrees.');
    if (s.construction.length === 0) bad(`surface[${s.id}].construction`, 'A surface needs at least one material layer.');
    for (const [f, v] of [['exteriorAbsorptivity', s.exteriorAbsorptivity], ['exteriorEmissivity', s.exteriorEmissivity], ['interiorEmissivity', s.interiorEmissivity]] as const) {
      if (!(v >= 0 && v <= 1)) bad(`surface[${s.id}].${f}`, `${f} must be between 0 and 1.`);
    }
  }

  if (operation.achSchedule.length !== 24) bad('operation.achSchedule', 'The air-change schedule must have exactly 24 hourly values.');
  if (operation.internalGainsSchedule.length !== 24) bad('operation.internalGainsSchedule', 'The internal-gains schedule must have exactly 24 hourly values.');
  if (operation.achSchedule.some((a) => a < 0)) bad('operation.achSchedule', 'Air-change rates cannot be negative.');
  if ((operation.comfortBand.lower as number) >= (operation.comfortBand.upper as number)) {
    bad('operation.comfortBand', 'The comfort band lower bound must be below its upper bound.');
  }

  const len = weather.T_amb.length;
  if (len === 0) bad('weather', 'The weather series is empty.');
  for (const [name, arr] of [['GHI', weather.GHI], ['v_wind', weather.v_wind]] as const) {
    if (arr.length !== len) bad(`weather.${name}`, `Weather arrays must all be the same length (T_amb has ${len}, ${name} has ${arr.length}).`);
  }
  for (let i = 0; i < len; i++) {
    if (!Number.isFinite(weather.T_amb[i]!)) { bad('weather.T_amb', `Non-finite temperature at index ${i}.`); break; }
    if (weather.T_amb[i]! < 173 || weather.T_amb[i]! > 343) { bad('weather.T_amb', `Temperature at index ${i} is ${weather.T_amb[i]!.toFixed(1)} K, outside any plausible range. Is it in Celsius by mistake?`); break; }
    if (weather.GHI[i]! < 0) { bad('weather.GHI', `Negative irradiance at index ${i}.`); break; }
  }

  if (!(options.timestepSeconds > 0 && options.timestepSeconds <= 3600)) bad('options.timestepSeconds', 'Timestep must be between 1 s and 3600 s.');
  if (86400 % options.timestepSeconds !== 0) bad('options.timestepSeconds', 'Timestep must divide 86400 s exactly so a day contains a whole number of steps.');
  if (!(options.simulationDays >= 1)) bad('options.simulationDays', 'Must simulate at least one day.');

  if (p.length > 0) {
    throw new EngineError('INVALID_INPUT', `${p.length} problem(s) with the simulation request.`, p);
  }

  // Non-fatal, but the caller should know: ACH below the safety floor is silently raised.
  void ACH_MIN;
}
