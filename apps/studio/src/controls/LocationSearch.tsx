// Custom-location search box (F3.md condition 1/layout guidance): debounced
// GET /api/locations/search, selection sets `location: {kind:'custom', ...}`.
import { useId, useState } from 'react';
import type { LocationSearchResult } from '@shelter/studio-server';
import { searchLocations } from '../api/locations';
import { Input } from '../components/ui';
import { useDebouncedRequest } from './useDebouncedRequest';

export interface LocationSearchProps {
  onSelect: (result: LocationSearchResult) => void;
}

export function LocationSearch({ onSelect }: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const search = useDebouncedRequest(query.trim() || null, 300, (q) => searchLocations(q));

  return (
    <div className="flex flex-col gap-2">
      <Input
        id={inputId}
        type="text"
        placeholder="Search for a place…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search for a location"
      />
      {search.status === 'loading' && <p className="text-xs text-ink-muted">Searching…</p>}
      {search.status === 'error' && <p className="text-xs text-thermal-hottest">Could not search locations. {search.error}</p>}
      {search.status === 'done' && search.data && search.data.length === 0 && (
        <p className="text-xs text-ink-muted">No matches.</p>
      )}
      {search.data && search.data.length > 0 && (
        <ul className="flex flex-col divide-y divide-hairline border border-hairline">
          {search.data.map((r, i) => (
            <li key={`${r.name}-${r.lat}-${r.lon}-${i}`}>
              <button
                type="button"
                onClick={() => onSelect(r)}
                className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface"
              >
                {r.name}
                <span className="text-ink-muted">
                  {r.admin1 ? `, ${r.admin1}` : ''}, {r.country}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
