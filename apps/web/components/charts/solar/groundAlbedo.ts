// apps/web/components/charts/solar/groundAlbedo.ts
//
// T-48 View 4 -- "raising ground albedo 0.20 -> 0.80 multiplies the
// ground-reflected component by exactly 4" (CONTRACTS.md 7.10 / the T-48
// task prompt). `SimulationResult.solar` never isolates the ground-reflected
// term -- `incidentBySurface` is beam + diffuse + ground-reflected already
// summed (`solar/transposition.ts`'s own `total` field) -- so proving the
// x4 claim needs the isolated term, not just the total.
//
// This does NOT reimplement `solar/transposition.ts`'s formula: it calls
// the package's own exported `skyViewFactor` (CONTRACTS.md 7.10:
// `skyViewFactor(tilt) = (1+cos(tilt))/2`) and combines it with `GHI`
// straight off the request's own weather record, exactly the way
// `transpose()` itself does (`groundReflected = GHI * groundAlbedo *
// (1 - skyViewFactor(tilt))`) -- one multiplication of two real,
// already-canonical values, not a new correlation.
import { skyViewFactor, type SimulationRequest } from '@shelter/engine';

const J_TO_KWH = 1 / 3.6e6;

/**
 * The ground-reflected component only, integrated over the REPORTED window
 * (the same one-day slice `simulate()` actually reports on, per
 * `options.simulationDays` -- `request.weather` itself may carry a whole
 * year, as `app/page.tsx` hands it over), for a surface of the given tilt.
 * Units: kWh/m^2 -- an intensity, not multiplied by any surface's area,
 * because this function does not know which real Surface (if any) it is
 * being asked about.
 */
export function groundReflectedKWhPerM2(request: SimulationRequest, tiltDeg: number, groundAlbedo: number): number {
  const { weather, options } = request;
  const samplesPerDay = Math.round(86400 / weather.stepSeconds); // scenarioWeather's own convention, @shelter/data
  const windowSamples = Math.min(weather.GHI.length, options.simulationDays * samplesPerDay);
  const groundViewFactor = 1 - skyViewFactor(tiltDeg);

  let joulesPerM2 = 0;
  for (let i = 0; i < windowSamples; i++) {
    joulesPerM2 += weather.GHI[i]! * groundAlbedo * groundViewFactor * weather.stepSeconds;
  }
  return joulesPerM2 * J_TO_KWH;
}
