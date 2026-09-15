/**
 * The glazing catalogue. LOG.md 7.11 "Glazing" table (BLUEPRINT.md Appendix B).
 *
 * `Glazing` is redefined locally for the same reason as `Material` -- see
 * materials.ts's header comment and .work/T-24.md, Deviations. Same field
 * names/optionality as `packages/engine/src/types.ts`, capital `U`/`SHGC`
 * included, so it is structurally assignable to the engine's own `Glazing`.
 */
import { EngineError } from './errors.js';

export const SCHEMA_VERSION = 1;

export interface Glazing {
  id: string;
  name: string;
  nameHi?: string;
  /** Overall heat transfer coefficient, W/(m^2*K). */
  U: number;
  /** Solar heat gain coefficient, 0-1. */
  SHGC: number;
  /** Visible transmittance, 0-1. */
  tauVis: number;
  /** Incidence angle modifier coefficient. */
  b0: number;
  costPerM2?: number;
  source: string;
  blurb?: string;
}

const GLAZING_TABLE_SOURCE =
  'BLUEPRINT.md Appendix B glazing table (U, SHGC, b0), compiled from ASHRAE Handbook of Fundamentals Ch. 15 (Fenestration) typical values per product class';

// tauVis (visible transmittance) has no value in the LOG.md 7.11 table -- it is
// filled here from the same generic ASHRAE Ch. 15 / NFRC-typical range per
// product class, since no source document states one. Flagged so a real
// product datasheet can replace it later without hunting for where it came
// from.
const TAU_VIS_NOTE =
  'tauVis has no source-document value; filled from typical NFRC-rated values for this glazing class, ASHRAE Handbook of Fundamentals Ch. 15 Table 4';

export const GLAZING: readonly Glazing[] = [
  {
    id: 'singleGlazing',
    name: 'Single glazing',
    U: 5.8,
    SHGC: 0.86,
    tauVis: 0.9,
    b0: 0.04,
    source: `${GLAZING_TABLE_SOURCE}; ${TAU_VIS_NOTE}`,
    blurb: 'Single glazing: one sheet of glass, the cheapest window but loses heat fast.',
  },
  {
    id: 'doubleAirFilled',
    name: 'Double glazing, air-filled',
    U: 2.8,
    SHGC: 0.76,
    tauVis: 0.8,
    b0: 0.05,
    source: `${GLAZING_TABLE_SOURCE}; ${TAU_VIS_NOTE}`,
    blurb: 'Double glazing: two panes with an air gap between, a big step up from a single pane.',
  },
  {
    id: 'doubleArgonLowE',
    name: 'Double glazing, argon + low-E',
    U: 1.6,
    SHGC: 0.6,
    tauVis: 0.7,
    b0: 0.06,
    source: `${GLAZING_TABLE_SOURCE}; ${TAU_VIS_NOTE}`,
    blurb: 'Double glazing with argon gas and a low-emissivity coating: keeps in much more heat than plain double glazing.',
  },
  {
    id: 'tripleGlazing',
    name: 'Triple glazing',
    U: 0.9,
    SHGC: 0.5,
    tauVis: 0.6,
    b0: 0.07,
    source: `${GLAZING_TABLE_SOURCE}; ${TAU_VIS_NOTE}`,
    blurb: 'Triple glazing: three panes, the warmest window available here, but also the most expensive.',
  },
  {
    id: 'polycarbonateTwinWall',
    name: 'Polycarbonate twin-wall',
    U: 3.0,
    SHGC: 0.7,
    tauVis: 0.78,
    b0: 0.05,
    source: `${GLAZING_TABLE_SOURCE}; typical structured-polycarbonate sheet datasheet range (e.g. Danpalon / Palram twin-wall polycarbonate technical data sheet)`,
    blurb: 'Twin-wall polycarbonate: a light plastic sheeting material, cheaper and tougher than glass for a Trombe wall or greenhouse face.',
  },
  {
    // Headline anchor, LOG.md 7.10 "Windows": single glazing with a closed
    // night shutter (R_sh = 0.4 m^2*K/W, the table's own midpoint of its
    // 0.3-0.5 range) gives U_eff = 1.75 +/- 0.01. Stored as its own catalogue
    // row -- a shutter is normally a per-window schedule (WindowSpec.
    // shutterResistance), not a distinct product, but the closed-shutter
    // state is common enough in a Ladakh night-time preset to be worth
    // offering directly, and its U comes straight from the formula in
    // LOG.md 7.10 rather than a new number.
    id: 'singleGlazingNightShutter',
    name: 'Single glazing + night shutter (closed)',
    U: 1 / (1 / 5.8 + 0.4),
    SHGC: 0.86, // unchanged -- LOG.md 7.11 table note: an opaque shutter changes U only
    tauVis: 0.9,
    b0: 0.04,
    source: `${GLAZING_TABLE_SOURCE}. U from LOG.md 7.10: U_eff = 1/(1/U + R_shutter), R_shutter = 0.4 m^2*K/W (midpoint of the table's 0.3-0.5 range); SHGC/tauVis/b0 copied unchanged from singleGlazing per the table's own "unchanged" note.`,
    blurb: 'Single glazing with a wooden night shutter closed: shuts most of the heat loss without buying new glass.',
  },
] as const;

const BY_ID = new Map(GLAZING.map((g) => [g.id, g] as const));

export function glazingById(id: string): Glazing {
  const g = BY_ID.get(id);
  if (!g) throw new EngineError('UNKNOWN_GLAZING', `No glazing with id "${id}".`, { id });
  return g;
}
