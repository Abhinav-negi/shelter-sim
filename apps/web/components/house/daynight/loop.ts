// apps/web/components/house/daynight/loop.ts
//
// T-53. The requestAnimationFrame driver, isolated from React so it can be
// exercised directly in this worktree's no-jsdom test suite -- the same
// "export the exact function a real event/effect calls" pattern
// `house.test.tsx`/T-46 established for `activateSurface`/`nextScrubberHour`.
// ACCEPTANCE TESTS 9 and 12 need real requestAnimationFrame/
// cancelAnimationFrame call-count assertions, which a component mounted only
// via `react-dom/server` (no effects ever run under SSR) cannot provide --
// `attachDayNightLoop` below is the thing under test, and the component's own
// `useEffect` is a thin, untested-by-necessity wrapper around it.

export type RafFn = (cb: (t: number) => void) => number;
export type CafFn = (handle: number) => void;

export interface AnimationLoopHandle {
  stop(): void;
}

/** Calls `onFrame` once per animation frame, via the injected `raf`, until
 * `.stop()` runs (which calls `caf` exactly once on the outstanding handle,
 * never again after -- ACCEPTANCE TEST 12: no leaked handle after unmount). */
export function startAnimationLoop(onFrame: (t: number) => void, raf: RafFn, caf: CafFn): AnimationLoopHandle {
  let stopped = false;
  let handle: number | null = null;
  function tick(t: number): void {
    if (stopped) return;
    onFrame(t);
    if (!stopped) handle = raf(tick);
  }
  handle = raf(tick);
  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      if (handle !== null) caf(handle);
      handle = null;
    },
  };
}

/** Only starts the loop when `shouldAnimate` is true; otherwise `raf` is
 * never called at all (ACCEPTANCE TEST 9: reduced motion / not running ->
 * requestAnimationFrame is not called in a loop). `.stop()` is always safe
 * to call, even on the no-op path. */
export function attachDayNightLoop(
  shouldAnimate: boolean,
  onFrame: (t: number) => void,
  raf: RafFn,
  caf: CafFn,
): AnimationLoopHandle {
  if (!shouldAnimate) return { stop(): void {} };
  return startAnimationLoop(onFrame, raf, caf);
}

/** SSR/no-`window`-safe: returns false (motion allowed) when `matchMedia` is
 * unavailable (this test environment, or any SSR pass) -- never crashes,
 * never silently assumes reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
