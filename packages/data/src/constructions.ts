/**
 * Named wall/roof/floor assemblies. LOG.md 7.11 + the T-24 PROMPT's own list.
 * This is what a sweep's `wallConstruction`/`roofConstruction` variables select
 * from, and what the UI's material dropdown lists.
 *
 * `NamedConstruction` is defined locally here, per the PROMPT -- it is not
 * added to `packages/engine/src/types.ts`. `Layer` is likewise redefined
 * locally (same two fields as the engine's own `Layer`) so this file has no
 * import from `@shelter/engine`.
 */
import { materialById } from './materials.js';

export const SCHEMA_VERSION = 1;

export interface Layer {
  materialId: string;
  /** Metres. */
  thickness: number;
}

export interface NamedConstruction {
  id: string;
  name: string;
  nameHi?: string;
  /** Ordered EXTERIOR -> INTERIOR, same convention as Surface.construction. */
  layers: Layer[];
  blurb: string;
  source: string;
}

export const CONSTRUCTIONS: readonly NamedConstruction[] = [
  {
    id: 'stoneMasonry400',
    name: '400 mm stone masonry',
    layers: [{ materialId: 'stoneMasonryGranite', thickness: 0.4 }],
    source:
      'BLUEPRINT.md Appendix B; a single-leaf 400 mm granite wall, a common heavy Ladakhi wall type.',
    blurb: 'A thick, single-leaf wall of local stone. Heavy and slow to change temperature.',
  },
  {
    id: 'rammedEarth400',
    name: '400 mm rammed earth',
    layers: [{ materialId: 'rammedEarth', thickness: 0.4 }],
    source:
      'BLUEPRINT.md Appendix B; a single-leaf 400 mm rammed-earth wall, the classic Ladakhi wall type.',
    blurb: 'A thick wall of packed earth. The benchmark heavy wall this tool is built around.',
  },
  {
    id: 'rammedEarth350EpsOutside',
    name: '350 mm rammed earth + 100 mm EPS (outside)',
    layers: [
      { materialId: 'eps', thickness: 0.1 },
      { materialId: 'rammedEarth', thickness: 0.35 },
    ],
    source:
      'BLUEPRINT.md Appendix B, insulation-position comparison pair (see rammedEarth350EpsInside): same materials and thicknesses, insulation on the outside face.',
    blurb:
      'A rammed-earth wall wrapped in foam insulation on the outside, keeping the earth mass warm and close to room temperature.',
  },
  {
    id: 'rammedEarth350EpsInside',
    name: '350 mm rammed earth + 100 mm EPS (inside)',
    layers: [
      { materialId: 'rammedEarth', thickness: 0.35 },
      { materialId: 'eps', thickness: 0.1 },
    ],
    source:
      'BLUEPRINT.md Appendix B, insulation-position comparison pair (see rammedEarth350EpsOutside): identical layer list, reversed order -- same steady-state U-value, different dynamic response (LOG.md 7.11 / acceptance test 10).',
    blurb:
      'The same rammed-earth wall with the foam insulation moved to the inside face instead. Same total insulation, different behaviour, because the earth mass now sits outside the insulation and tracks outdoor swings more.',
  },
  {
    id: 'firedBrick230',
    name: '230 mm fired brick',
    layers: [{ materialId: 'firedClayBrick', thickness: 0.23 }],
    source:
      'BLUEPRINT.md Appendix B; a standard one-brick-thick (230 mm) fired-clay wall, IS 1077 modular brick coursing.',
    blurb:
      'A wall built from kiln-fired brick, one brick thick. Sturdy, but not as good at storing heat as a thicker earth wall.',
  },
  {
    id: 'rcc150',
    name: '150 mm RCC',
    layers: [{ materialId: 'rcc', thickness: 0.15 }],
    source:
      'BLUEPRINT.md Appendix B; a 150 mm reinforced-concrete slab, the common flat-roof/floor thickness in IS 456 practice.',
    blurb:
      'A plain reinforced-concrete slab, most often used as a flat roof or floor rather than a wall.',
  },
  {
    id: 'cgiPuf50',
    name: 'CGI sheet + 50 mm PUF',
    layers: [
      { materialId: 'steelCGI', thickness: 0.0006 },
      { materialId: 'puf', thickness: 0.05 },
    ],
    source:
      'BLUEPRINT.md Appendix B; a 0.6 mm corrugated galvanised-iron sheet (typical CGI gauge, IS 277) factory-bonded to 50 mm PUF board, the common insulated-metal-roof product sold in the region.',
    blurb:
      'A light metal roof sheet with a foam insulation layer bonded underneath it. Quick to build, insulates much better than bare metal alone.',
  },
  {
    id: 'mudPoplarRoof',
    name: 'Mud-and-poplar roof',
    layers: [
      { materialId: 'mudPlaster', thickness: 0.08 },
      { materialId: 'timberPoplarWillow', thickness: 0.05 },
    ],
    source:
      'SP:41 (Handbook on Functional Requirements of Buildings) general roof build-up guidance, combined with typical Ladakhi vernacular roof practice (BLUEPRINT.md / TECH.md): compacted mud over a poplar-branch and timber deck. Thicknesses are representative of vernacular practice, not a single manufacturer figure.',
    blurb:
      'The traditional Ladakhi roof: a layer of packed mud over a deck of poplar branches and timber. Simple and local, but a poor insulator.',
  },
  {
    id: 'insulatedRoof',
    name: 'Insulated RCC roof',
    layers: [
      { materialId: 'xps', thickness: 0.075 },
      { materialId: 'rcc', thickness: 0.12 },
    ],
    source:
      'ASHRAE Handbook of Fundamentals Ch. 26 slab/roof insulation practice: rigid board insulation laid above a structural RCC deck, under the waterproofing (an "inverted" or "protected membrane" roof detail) -- XPS is the usual choice here for its resistance to moisture and foot traffic (manufacturer datasheet, e.g. Dow STYROFOAM).',
    blurb:
      'A concrete roof slab with a layer of foam board insulation on top of it. Much warmer than bare concrete alone.',
  },
  {
    id: 'earthFloor',
    name: 'Earth floor',
    layers: [
      { materialId: 'gravelSoilFill', thickness: 0.1 },
      { materialId: 'rammedEarth', thickness: 0.05 },
    ],
    source:
      'IS 2720 (Methods of test for soils) sub-base practice combined with SP:41 floor build-up guidance: a compacted gravel sub-base under a rammed-earth wearing layer, the traditional unfinished floor.',
    blurb:
      'A simple floor of packed earth over a bed of gravel. Cheap and traditional, with no added insulation.',
  },
  {
    id: 'insulatedSlabFloor',
    name: 'Insulated slab floor',
    layers: [
      { materialId: 'xps', thickness: 0.05 },
      { materialId: 'rcc', thickness: 0.1 },
    ],
    source:
      'ASHRAE Handbook of Fundamentals Ch. 26 slab-on-grade insulation practice: rigid board insulation laid beneath a concrete slab.',
    blurb:
      'A concrete floor slab with foam insulation underneath it, cutting the steady heat loss straight down into the ground.',
  },
] as const;

// Every layer's materialId must resolve. Fail fast at module load, not at
// first use deep inside a sweep. (Not a numbered acceptance test itself --
// test 9 checks the same property from the test file -- but a broken id here
// would otherwise surface only when someone builds a sweep, far from the typo.)
for (const c of CONSTRUCTIONS) {
  for (const layer of c.layers) materialById(layer.materialId);
}
