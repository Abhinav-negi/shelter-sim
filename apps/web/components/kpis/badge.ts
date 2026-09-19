// apps/web/components/kpis/badge.ts
//
// T-51. Pure derivation for the energy-balance integrity badge -- the
// dimensional-error finding CONTRACTS.md §7.4 settles: the pass threshold is
// `< 0.001` (a dimensionless FRACTION), and the UI renders
// `(residual * 100).toFixed(3) + '%'`, so a stored `0.0002` displays as
// `0.020%`. `formatPercent` (lib/units.ts) already implements that exact
// string; this file only decides the colour, kept separate so the threshold
// branch has one plain-assertion test without needing a DOM renderer.

import { formatPercent } from '../../lib/units';

export interface BadgeInfo {
  /** true = green (residual < 0.001, CONTRACTS.md §7.4's pass threshold). */
  ok: boolean;
  /** e.g. "0.020%" -- the exact §7.4 UI display-rule string. */
  text: string;
}

export function badgeFor(residual: number): BadgeInfo {
  return { ok: residual < 0.001, text: formatPercent(residual) };
}
