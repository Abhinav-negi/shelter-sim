// A tiny cached hook around src/api/options.ts's GET /api/options fetch, so
// the viewer (F2) and future controls (F3) share one request instead of each
// firing their own on mount.

import { useEffect, useState } from 'react';
import type { Options } from '@shelter/studio-server';
import { getOptions } from '../api/options';

let cached: Promise<Options> | null = null;

function fetchOptions(): Promise<Options> {
  cached ??= getOptions().catch((err: unknown) => {
    cached = null; // allow a retry on the next mount after a failure
    throw err;
  });
  return cached;
}

export interface UseOptionsResult {
  options: Options | null;
  error: string | null;
}

export function useOptions(): UseOptionsResult {
  const [state, setState] = useState<UseOptionsResult>({ options: null, error: null });

  useEffect(() => {
    let cancelled = false;
    fetchOptions().then(
      (options) => {
        if (!cancelled) setState({ options, error: null });
      },
      (err: unknown) => {
        if (!cancelled) {
          setState({ options: null, error: err instanceof Error ? err.message : 'Failed to load options' });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
