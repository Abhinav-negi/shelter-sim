// apps/studio-server/src/weather/geocode.ts — Open-Meteo geocoding
// (condition 1). Pure URL builder + parser, network call injectable for
// tests (global `fetch`, Node 24, no install).

import { UpstreamUnavailableError } from './errors.js';

const GEOCODING_DEFAULT_BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const MAX_RESULTS = 8;

export interface LocationSearchResult {
  name: string;
  country: string;
  admin1?: string;
  lat: number;
  lon: number;
  elevation: number;
}

export function geocodeUrl(q: string, baseUrl: string = GEOCODING_DEFAULT_BASE_URL): string {
  const params = new URLSearchParams({
    name: q,
    count: String(MAX_RESULTS),
    language: 'en',
    format: 'json',
  });
  return `${baseUrl}?${params.toString()}`;
}

interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  country?: string;
  admin1?: string;
}

export function parseGeocodingResponse(json: unknown): LocationSearchResult[] {
  const root = json as { results?: GeocodingResult[] };
  const results = root?.results ?? [];
  return results.slice(0, MAX_RESULTS).map((r) => ({
    name: r.name,
    country: r.country ?? '',
    ...(r.admin1 !== undefined ? { admin1: r.admin1 } : {}),
    lat: r.latitude,
    lon: r.longitude,
    elevation: r.elevation,
  }));
}

export async function searchLocations(
  q: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LocationSearchResult[]> {
  let res: Response;
  try {
    res = await fetchImpl(geocodeUrl(q));
  } catch (err) {
    throw new UpstreamUnavailableError(
      `Open-Meteo geocoding request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new UpstreamUnavailableError(`Open-Meteo geocoding responded ${res.status}`);
  }
  const json = await res.json();
  return parseGeocodingResponse(json);
}
