// GET /api/locations/search, API.md §4b. Shape typed from
// @shelter/studio-server (LocationSearchResult), never hand-copied.
import type { LocationSearchResult } from '@shelter/studio-server';
import { get } from './client';

export const searchLocations = (q: string) =>
  get<LocationSearchResult[]>(`/locations/search?q=${encodeURIComponent(q)}`);
