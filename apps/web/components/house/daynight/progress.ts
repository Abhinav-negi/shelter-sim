// apps/web/components/house/daynight/progress.ts
//
// T-53. A dedicated local progress channel for the waiting-mode ring.
//
// GOTCHA / DECISION NOTE for whoever wires T-39 (`/api/optimise`'s SSE
// progress events -- NOT yet built, LOG.md §5 marks it `[ ]`) or surfaces the
// T-43 worker client's `runScenarios(reqs, onProgress)` (already built,
// `apps/web/lib/workerClient.ts`) into the running UI: `lib/store.ts` (T-36)
// has NO `progress` field -- `AppState` carries only `status:
// 'idle'|'running'|'error'`. There is nowhere in the shared store for a real
// done/total count to live, and this task may not add one: `lib/store.ts` is
// explicitly on this task's OWN "files you may NOT touch" list.
//
// So progress state lives HERE instead, inside this task's own directory, as
// a tiny hand-rolled pub/sub -- the same non-library pattern `store.ts`
// itself already uses for the exact same reason (CONTRACTS.md §7.13 has no
// state-management dependency on the approved list). Whoever wires a real SSE
// stream or a `runScenarios` `onProgress` callback into the UI calls
// `setProgress(done, total)` from here; `<DayNightAnimation/>` subscribes and
// renders the real numbers. Until that wiring exists, `getProgress()` stays
// `null` and the ring correctly renders its INDETERMINATE state
// (ACCEPTANCE TEST 7) instead of a fabricated percentage.

export interface Progress {
  done: number;
  total: number;
}

type Listener = () => void;

let current: Progress | null = null;
const listeners = new Set<Listener>();

export function getProgress(): Progress | null {
  return current;
}

/** `null` resets to the indeterminate state -- e.g. a new run starting
 * before its first event, or the event source going away mid-run. Never left
 * showing a stale count. */
export function setProgress(progress: Progress | null): void {
  current = progress;
  for (const l of listeners) l();
}

export function subscribeProgress(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test-only reset, mirroring `store.ts`'s own `__debugDispatchCount`
 * convention for module state that must not leak between test cases. */
export function __resetProgressForTest(): void {
  current = null;
  listeners.clear();
}
