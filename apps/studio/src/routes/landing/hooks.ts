// Landing-only motion/visibility helpers (G5). No animation library — plain
// `matchMedia`, `IntersectionObserver` and `requestAnimationFrame`, same
// spirit as viewer/useThemeColors.ts's own native-API approach.

import { useEffect, useRef, useState, type RefObject } from 'react';
import { readStoredTheme } from '../../lib/theme';

/** Tracks `prefers-reduced-motion`, live (a user can flip it while the tab is
 *  open). Every G5 motion — hero auto-rotate, the dawn->dusk sun sweep, the
 *  scroll-reveal transition — is gated on this being false (condition 3). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reduced;
}

/** Whether `ref`'s element has any part in the viewport. Powers both the
 *  shape strip's lazy mount and the stages' scroll reveal. */
export function useInView<T extends Element>(threshold = 0): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView((was) => was || (entry?.isIntersecting ?? false)), {
      threshold,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}

/** Slowly sweeps a clock hour dawn -> dusk -> dawn (a triangle wave), so the
 *  hero's sun crosses the sky instead of sitting static. Off (fixed at
 *  `from`) when `active` is false — reduced motion, or options not loaded
 *  yet. `cycleMs` is the full dawn->dusk->dawn period: slow and purposeful,
 *  not a spinner. */
export function useAnimatedHour(active: boolean, from: number, to: number, cycleMs = 90_000): number {
  const [hour, setHour] = useState(from);

  useEffect(() => {
    if (!active) {
      setHour(from);
      return;
    }
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = ((now - start) % cycleMs) / cycleMs; // 0..1
      const tri = t < 0.5 ? t * 2 : 2 - t * 2; // 0 -> 1 -> 0
      setHour(from + tri * (to - from));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, from, to, cycleMs]);

  return hour;
}

/** G5 condition 1: "dark tokens regardless of theme" for the hero — including
 *  the *embedded* ShelterViewer, whose colours come from `useThemeColors()`
 *  reading `getComputedStyle(document.documentElement)` (viewer/useThemeColors.ts,
 *  not a file this task may touch). A plain scoped CSS class can't reach that
 *  call — custom properties only cascade to descendants, and that hook always
 *  reads the root, not its caller's subtree.
 *
 *  So this reuses the exact mechanism `lib/theme.ts`'s own toggle drives —
 *  the `data-theme` attribute on `<html>`, which tokens.css already has a
 *  `[data-theme='dark']` block for — pinning it to `'dark'` for as long as
 *  the hero is anywhere in the viewport, and restoring whatever it was the
 *  moment it isn't (at that point the hero, and the non-sticky header above
 *  it, are scrolled out of view anyway, so the rest of the page is free to
 *  keep following the real toggle). Reusing the attribute (rather than
 *  poking `--paper` etc. via inline style directly) matters, not just
 *  economy: it's exactly what `useThemeColors`'s own `MutationObserver`
 *  watches, so every mounted ShelterViewer (the hero's, and any shape-strip
 *  card that happens to mount mid-transition) actually re-reads colours and
 *  re-renders when this flips — inline custom properties alone changed the
 *  cascade but never told anything already-rendered to look again, which
 *  left a demand-frameloop canvas that mounted mid-transition frozen on
 *  whichever colours happened to be in effect at that instant. */
export function useForceDarkTokens(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => root.setAttribute('data-theme', 'dark');
    // Restore the user's SAVED preference, not a mount-time snapshot: the theme
    // toggle sits in the header, visible alongside the hero, so a snapshot would
    // silently undo a choice made while the hero is in view (orchestrator fix).
    const restore = () => {
      const theme = readStoredTheme();
      if (theme === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', theme);
    };

    apply(); // assume visible at mount — the hero is the top of the page

    const el = ref.current;
    if (!el) return restore;
    const observer = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? apply() : restore()));
    observer.observe(el);
    return () => {
      observer.disconnect();
      restore();
    };
  }, [ref]);
}
