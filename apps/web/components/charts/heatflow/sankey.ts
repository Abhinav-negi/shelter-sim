// apps/web/components/charts/heatflow/sankey.ts
//
// T-49(b). "The Sankey is the most persuasive single image in the app... you
// can point at the widest outgoing stream and say 'that's your problem.'"
// Pure graph-building logic -- no JSX, no DOM -- so the layout numbers
// (node/link positions, the inflow/outflow balance) are unit-testable with
// plain vitest.
//
// WHICH TERMS APPEAR, AND WHY: CONTRACTS.md §7.4 already draws exactly the
// line this diagram needs. `BOUNDARY_KEYS` (Q1,Q2,Q3,Q4,Q8,Q9,Q10,Q11,Qaux)
// cross the system boundary; `storageRate` is the fabric's own accumulation;
// together `Σ boundary - storageRate ≈ 0` is the energy-balance identity
// already asserted (residual < 0.1%) elsewhere in the engine. `Q5`, `Q6`,
// `Q7` are internal redistribution between solved nodes (they move energy,
// they do not add or remove it) and are excluded here -- which is also the
// sensible handling of T-22's finding that `Q7_interiorLongwave` carries
// ~1e-11 W of solver float noise: it is excluded on physical grounds (it
// never crossed the boundary to begin with), so the noise never reaches
// this diagram to mis-scale it. It still appears in the stacked-area chart
// (acceptance test 1 requires that), just not here.
//
// SIGN HANDLING, GENERIC BY CONSTRUCTION: every term in `dailyTotalsKWh` for
// the ten keys above is classified purely by ITS OWN daily-total sign, never
// by a hardcoded "this one is always a gain" table (`Q3`/`Q10` can go
// either way per CONTRACTS.md §7.2, and even `storageRate` can be a net
// SOURCE on a day the walls give back more than they took). A positive term
// is a GAIN (flows source -> hub); a negative term is a LOSS (flows
// hub -> sink), using |value| as the flow's width. This makes the identity
// "inflow total = outflow total" hold by construction, up to the same
// residual the energy-balance test already bounds -- see `checkBalance`.

import { sankey, sankeyLinkHorizontal, type SankeyGraph, type SankeyLink, type SankeyNode } from 'd3-sankey';
import { BOUNDARY_KEYS, PATHWAY_META, type BoundaryKey } from './pathways';

/** Below this, a term is indistinguishable from float noise (kWh) and is
 * dropped rather than drawn as a zero-width or near-invisible link --
 * acceptance test 7 ("no negative-width link and no NaN node"). Real
 * pathway totals in every bundled preset are on the order of 0.1-300 kWh;
 * this floor is far below any real signal and exists only to catch the
 * Q7-style noise class if it were ever handed to this function by mistake. */
const MIN_FLOW_KWH = 1e-6;

export const HUB_ID = 'shelter';

export interface FlowTerm {
  key: BoundaryKey | 'storageRate';
  label: string;
  kWh: number;
}

/** Classifies every boundary + storage term by its own sign. Exported so the
 * test file (and `SankeyDiagram.tsx`'s tooltip text) can label a term
 * "released from the walls overnight" vs "stored in the walls" from the
 * same one source of truth as the diagram itself. */
export function classifyFlows(dailyTotalsKWh: Record<string, number>): { gains: FlowTerm[]; losses: FlowTerm[] } {
  const gains: FlowTerm[] = [];
  const losses: FlowTerm[] = [];

  const push = (key: BoundaryKey | 'storageRate', value: number, label: string) => {
    if (Math.abs(value) < MIN_FLOW_KWH) return;
    if (value >= 0) gains.push({ key, label, kWh: value });
    else losses.push({ key, label, kWh: -value });
  };

  for (const key of BOUNDARY_KEYS) push(key, dailyTotalsKWh[key] ?? 0, PATHWAY_META[key].label);
  // storageRate > 0: energy went INTO the fabric that day (a sink, drawn on
  // the loss/right side as "stored in the walls"). storageRate < 0: the
  // fabric was a net SOURCE that day (drawn on the gain/left side as
  // "released from the walls").
  const storage = dailyTotalsKWh.storageRate ?? 0;
  push('storageRate', -storage, storage >= 0 ? 'Stored in the walls' : 'Released from the wall storage');

  return { gains, losses };
}

/** Acceptance test 6. Returns both totals (kWh) and the relative deviation,
 * mirroring CONTRACTS.md §7.4's own `E_net = ΔStored` identity restated in
 * terms of gains/losses: inflow (gains) should equal outflow (losses) --
 * `classifyFlows` already folds `storageRate` into whichever side its sign
 * puts it on, so "inflow = outflow" here already IS "inflow = outflow +
 * storage change" (storage is on one side or the other, never double
 * counted). */
export function checkBalance(dailyTotalsKWh: Record<string, number>): { inflowKWh: number; outflowKWh: number; deviation: number } {
  const { gains, losses } = classifyFlows(dailyTotalsKWh);
  const inflowKWh = gains.reduce((s, g) => s + g.kWh, 0);
  const outflowKWh = losses.reduce((s, l) => s + l.kWh, 0);
  const denom = Math.max(inflowKWh, outflowKWh, MIN_FLOW_KWH);
  const deviation = Math.abs(inflowKWh - outflowKWh) / denom;
  return { inflowKWh, outflowKWh, deviation };
}

export interface SankeyNodeDatum {
  id: string;
  label: string;
  color: string;
}
export interface SankeyLinkDatum {
  source: string;
  target: string;
  value: number;
  color: string;
  label: string;
  kWh: number;
}

export type LaidOutNode = SankeyNode<SankeyNodeDatum, SankeyLinkDatum>;
export type LaidOutLink = SankeyLink<SankeyNodeDatum, SankeyLinkDatum>;

/** Builds the {gain sources} -> hub -> {loss sinks} graph and runs d3-sankey's
 * layout. Returns plain laid-out nodes/links (x0/x1/y0/y1, all finite
 * numbers) -- acceptance test 7 ("no NaN node"). */
export function buildSankeyLayout(dailyTotalsKWh: Record<string, number>, width: number, height: number): SankeyGraph<SankeyNodeDatum, SankeyLinkDatum> {
  const { gains, losses } = classifyFlows(dailyTotalsKWh);

  const nodes: SankeyNodeDatum[] = [
    ...gains.map((g) => ({ id: g.key, label: g.label, color: PATHWAY_META[g.key].color })),
    { id: HUB_ID, label: 'The shelter', color: '#333333' },
    ...losses.map((l) => ({ id: l.key, label: l.label, color: PATHWAY_META[l.key].color })),
  ];

  const links: SankeyLinkDatum[] = [
    ...gains.map((g) => ({ source: g.key, target: HUB_ID, value: g.kWh, color: PATHWAY_META[g.key].color, label: g.label, kWh: g.kWh })),
    ...losses.map((l) => ({ source: HUB_ID, target: l.key, value: l.kWh, color: PATHWAY_META[l.key].color, label: l.label, kWh: l.kWh })),
  ];

  const layout = sankey<SankeyNodeDatum, SankeyLinkDatum>()
    .nodeId((d) => d.id)
    .nodeWidth(16)
    .nodePadding(18)
    .extent([
      [1, 1],
      [width - 1, height - 1],
    ]);

  return layout({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) });
}

/** SVG path `d` string for one laid-out link, via d3-sankey's own generator. */
export function linkPath(link: LaidOutLink): string {
  return sankeyLinkHorizontal()(link as never) ?? '';
}

/** Acceptance test 7: no negative-width link, no NaN anywhere in the layout. */
export function isLayoutValid(graph: SankeyGraph<SankeyNodeDatum, SankeyLinkDatum>): boolean {
  for (const n of graph.nodes as LaidOutNode[]) {
    if ([n.x0, n.x1, n.y0, n.y1].some((v) => v === undefined || !Number.isFinite(v))) return false;
  }
  for (const l of graph.links as LaidOutLink[]) {
    const width = (l.width ?? -1) as number;
    if (!Number.isFinite(width) || width < 0) return false;
  }
  return true;
}
