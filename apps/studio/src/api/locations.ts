// Location search is P3's to implement (API.md §7); shape follows the
// Open-Meteo geocoding response PLAN.md names as the data source.
import { get } from './client';

export interface LocationSearchResult {
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  country?: string;
}

export const searchLocations = (q: string) =>
  get<LocationSearchResult[]>(`/locations/search?q=${encodeURIComponent(q)}`);
