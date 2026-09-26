// Shared debounce + stale-response-discard for anything driven by fast user
// edits: the preview simulation (F3.md condition 2, 400 ms) and the location
// search box. `fn` is called `delayMs` after the last `input` change; an
// AbortController tracks which call is current so a slow, superseded
// response is dropped when it eventually resolves.
//
// Note: apps/studio/src/api/client.ts's `post`/`get` (frozen — F3.md "May
// touch / must not touch") take no `signal`, so the AbortController here
// cannot cancel the in-flight network request itself — only the two
// frozen-file authors could wire that through. What it does guarantee is the
// condition's actual requirement: a stale response is never applied over a
// newer one.
import { useEffect, useRef, useState } from 'react';

export type RequestStatus = 'idle' | 'pending' | 'loading' | 'done' | 'error';

export interface DebouncedRequestState<R> {
  status: RequestStatus;
  data: R | null;
  error: string | null;
}

export function useDebouncedRequest<T, R>(
  input: T | null,
  delayMs: number,
  fn: (input: T, signal: AbortSignal) => Promise<R>,
): DebouncedRequestState<R> & { retry: () => void } {
  const [state, setState] = useState<DebouncedRequestState<R>>({ status: 'idle', data: null, error: null });
  const controllerRef = useRef<AbortController | null>(null);
  const lastInputRef = useRef<T | null>(null);

  function run(value: T) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    fn(value, controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setState({ status: 'done', data, error: null });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setState((s) => ({ status: 'error', data: s.data, error: err instanceof Error ? err.message : 'Request failed' }));
      },
    );
  }

  useEffect(() => {
    lastInputRef.current = input;
    if (input === null) {
      controllerRef.current?.abort();
      setState({ status: 'idle', data: null, error: null });
      return;
    }
    setState((s) => ({ ...s, status: 'pending' }));
    const timer = setTimeout(() => run(input), delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, delayMs]);

  return {
    ...state,
    retry: () => {
      if (lastInputRef.current !== null) run(lastInputRef.current);
    },
  };
}
