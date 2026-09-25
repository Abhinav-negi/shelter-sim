// apps/studio-server/src/design/prepare.ts — ShelterDesign -> SimulationRequest,
// including the async half of custom-location weather. The ONE path every
// route that simulates goes through (preview and persisted runs), so a saved
// run of a custom-location design resolves weather exactly like its preview.
// assemble()'s weatherFor seam is sync; the fetch/cache behind it is not, so
// weather is resolved first and handed over as a closure.

import type { SimulationRequest } from '@shelter/engine';
import { resolveCustomWeather, type WeatherProvenanceSummary } from '../weather/resolve.js';
import { assemble, type WeatherFor } from './assemble.js';
import type { ShelterDesign } from './types.js';

export interface PreparedRequest {
  request: SimulationRequest;
  /** Present only for custom locations: where the weather came from + assumptions. */
  weatherProvenance?: WeatherProvenanceSummary;
}

export async function prepareRequest(
  design: ShelterDesign,
  fetchImpl?: typeof fetch,
): Promise<PreparedRequest> {
  if (design.location.kind !== 'custom') return { request: assemble(design) };
  const resolved = await resolveCustomWeather(design.location, fetchImpl);
  const weatherFor: WeatherFor = () => ({ weather: resolved.weather, site: resolved.site });
  return { request: assemble(design, weatherFor), weatherProvenance: resolved.provenance };
}
