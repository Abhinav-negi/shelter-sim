// apps/web/components/charts/heatflow/pathways.ts
//
// T-49. Shared metadata for every one of the thirteen `HeatFlows` series
// (Q1-Q11, `Qaux`, `storageRate`) so the stacked-area legend, the Sankey
// labels and the scatter's series picker all read off ONE table instead of
// three ad-hoc lists -- `AUDIT.md` found `Q7_interiorLongwave` dropped from
// the frontend heat-flow list once already (CONTRACTS.md §7.3) precisely
// because it lived in a list that a later edit forgot to update. There is
// exactly one list here, and it is exhaustive by construction (`keyof
// HeatFlows` minus `deltaT`/`dailyTotalsKWh`, enforced by
// `pathways.test.ts`'s own type-level check in `heatflow.test.ts`).

import type { HeatFlows } from '@shelter/engine';

/** Every pathway key EXCEPT `deltaT` (a temperature difference, not a power
 * series -- CONTRACTS.md §7.7) and `dailyTotalsKWh` (a derived summary, not
 * a series). Order is deliberate: gains first, then the sign-varying
 * boundary terms, then the three INTERNAL terms (§7.2), then storage --
 * this is also the stacking order used by the stacked-area chart. */
export const PATHWAY_KEYS = [
  'Q1_solarOpaque',
  'Q2_solarGlazed',
  'Q11_internalGains',
  'Qaux',
  'Q3_extConvection',
  'Q8_windowConduction',
  'Q9_infiltration',
  'Q10_ground',
  'Q4_skyRadiation',
  'Q5_envelopeConduction',
  'Q6_intConvection',
  'Q7_interiorLongwave',
  'storageRate',
] as const;

export type PathwayKey = (typeof PATHWAY_KEYS)[number];

/** The nine boundary terms plus storage -- CONTRACTS.md §7.4's own set,
 * `{Q1,Q2,Q3,Q4,Q8,Q9,Q10,Q11,Qaux}` (crosses the system boundary) with
 * `storageRate` (energy retained in the fabric) added. `Q5`/`Q6`/`Q7` are
 * internal redistribution -- they move energy between solved nodes and
 * cross no boundary, so they are excluded from the Sankey, which answers
 * "where does the energy that ENTERS OR LEAVES this shelter go" (`sankey.ts`
 * uses exactly this set, never the internal three). This is also the
 * sensible fix for `Q7_interiorLongwave` carrying ~1e-11 W of solver float
 * noise (T-22's finding, `log/AREA-B-engine.md`): the noise term never
 * reaches the Sankey at all, because it was never a boundary term to begin
 * with -- excluded on physical grounds, which happens to also excludes the
 * noise. See `heatflow.test.ts`'s note on this. */
export const BOUNDARY_KEYS = [
  'Q1_solarOpaque',
  'Q2_solarGlazed',
  'Q3_extConvection',
  'Q4_skyRadiation',
  'Q8_windowConduction',
  'Q9_infiltration',
  'Q10_ground',
  'Q11_internalGains',
  'Qaux',
] as const;

export type BoundaryKey = (typeof BOUNDARY_KEYS)[number];

export interface PathwayMeta {
  /** Plain-language name for a non-technical viewer. Never "Q4" (acceptance
   * test 8) -- the Qn code appears only in a parenthetical, for the reader
   * who already knows CONTRACTS.md's table. */
  label: string;
  /** One fixed colour per pathway, assigned by identity (never re-cycled --
   * dataviz skill's categorical rule), used by both the stacked-area legend
   * and the Sankey link/node fills so the same pathway reads as the same
   * colour in every view on the panel. */
  color: string;
}

export const PATHWAY_META: Record<PathwayKey, PathwayMeta> = {
  Q1_solarOpaque: { label: 'Sunlight on the walls & roof (Q1)', color: '#e8a33d' },
  Q2_solarGlazed: { label: 'Sunlight through the windows (Q2)', color: '#f4c542' },
  Q11_internalGains: { label: 'Body heat, stove & livestock (Q11)', color: '#d1495b' },
  Qaux: { label: 'Auxiliary heater (Qaux)', color: '#c1440e' },
  Q3_extConvection: { label: 'Convection with outside air (Q3)', color: '#5b8dd6' },
  Q8_windowConduction: { label: 'Conduction through the windows (Q8)', color: '#4fb0c6' },
  Q9_infiltration: { label: 'Carried away by draughts (Q9)', color: '#7a5ea8' },
  Q10_ground: { label: 'Conducted to/from the ground (Q10)', color: '#8a5a3c' },
  Q4_skyRadiation: { label: 'Radiated to the night sky (Q4)', color: '#1f3a5f' },
  Q5_envelopeConduction: { label: 'Conduction inside the walls (Q5, internal)', color: '#b0b0b0' },
  Q6_intConvection: { label: 'Convection to the indoor air (Q6, internal)', color: '#8f8f8f' },
  Q7_interiorLongwave: { label: 'Interior surface-to-surface radiation (Q7, internal)', color: '#6f6f6f' },
  storageRate: { label: 'Stored in / released from the walls', color: '#2f9e44' },
};

/** Reads one pathway's value at timestep `i` off a real `HeatFlows` object. */
export function pathwayValue(heatFlows: HeatFlows, key: PathwayKey, i: number): number {
  return heatFlows[key][i]!;
}
