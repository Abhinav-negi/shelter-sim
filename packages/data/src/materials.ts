/**
 * The material catalogue. LOG.md 7.11 ("Material property values, BLUEPRINT.md
 * Appendix B") is the authoritative table this file loads -- every k/rho/c below
 * is copied from it, not re-derived.
 *
 * `Material` is redefined locally rather than imported from
 * `@shelter/engine/types.js` -- see .work/T-24.md, Deviations, for why. The
 * shape below is identical field-for-field to `packages/engine/src/types.ts`
 * (same names, same optionality), so any object here is structurally
 * assignable wherever the engine's own `Material` is expected.
 */
import { EngineError } from './errors.js';

export const SCHEMA_VERSION = 1;

export interface Material {
  id: string;
  name: string;
  nameHi?: string;
  category: 'structural' | 'insulation' | 'finish' | 'storage';
  /** Thermal conductivity, W/(m*K). */
  k: number;
  /** Density, kg/m^3. */
  rho: number;
  /** Specific heat capacity, J/(kg*K). */
  c: number;
  /** Solar absorptivity, 0-1. */
  alphaSolar: number;
  /** Thermal (longwave) emissivity, 0-1. */
  emissivity: number;
  costPerM3?: number;
  locallyAvailableLadakh: boolean;
  embodiedCarbon?: number;
  /** MANDATORY, non-empty. A real citation. */
  source: string;
  /** One plain sentence for the UI card. No physics jargon. */
  blurb?: string;
}

// Surface-finish alphaSolar/emissivity pairs, BLUEPRINT.md Appendix B "Surface
// optical properties" table, LOG.md 7.11. Kept as one lookup so a finish value
// used on several material rows (e.g. grey concrete on both dense concrete and
// RCC) is written once, not retyped per row.
const FINISH = {
  blackPaint: { alphaSolar: 0.95, emissivity: 0.9 },
  darkMudEarth: { alphaSolar: 0.7, emissivity: 0.9 },
  redBrick: { alphaSolar: 0.68, emissivity: 0.9 },
  greyConcrete: { alphaSolar: 0.65, emissivity: 0.88 },
  galvanisedWeathered: { alphaSolar: 0.6, emissivity: 0.28 },
  galvanisedBright: { alphaSolar: 0.35, emissivity: 0.13 },
  whitewashLime: { alphaSolar: 0.25, emissivity: 0.9 },
  whitePaint: { alphaSolar: 0.2, emissivity: 0.9 },
} as const;

const FINISH_SOURCE_NOTE = 'solar absorptance/emissivity: BLUEPRINT.md Appendix B surface finish table';

export const MATERIALS: readonly Material[] = [
  // ---------------------------------------------------------------- structural & mass
  {
    id: 'mudBrickAdobe',
    name: 'Mud brick / adobe',
    nameHi: 'मिट्टी की ईंट',
    category: 'structural',
    k: 0.75,
    rho: 1700,
    c: 880,
    ...FINISH.darkMudEarth,
    locallyAvailableLadakh: true,
    source: `IS 3792:1978, Guide for heat insulation of non-industrial buildings, Table 1 (mud/adobe masonry); ${FINISH_SOURCE_NOTE}`,
    blurb: 'Mud brick: cheap, made locally, good at holding daytime heat overnight.',
  },
  {
    id: 'rammedEarth',
    name: 'Rammed earth',
    nameHi: 'कूट-मिट्टी',
    category: 'structural',
    k: 1.0,
    rho: 1900,
    c: 880,
    ...FINISH.darkMudEarth,
    locallyAvailableLadakh: true,
    source: `IS 3792:1978 Table 1 (rammed earth); ASHRAE Handbook of Fundamentals Ch. 26 Table 4 (earthen materials); ${FINISH_SOURCE_NOTE}`,
    blurb: 'Rammed earth: thick packed-earth walls, the classic heavy Ladakhi wall that stays warm all night.',
  },
  {
    id: 'stoneMasonryGranite',
    name: 'Stone masonry (granite)',
    nameHi: 'पत्थर की चिनाई',
    category: 'structural',
    k: 2.8,
    rho: 2600,
    c: 820,
    alphaSolar: 0.55,
    emissivity: 0.9,
    locallyAvailableLadakh: true,
    source:
      'ASHRAE Handbook of Fundamentals Ch. 26, Table 4 (stone, granite); no matching row in the finish table, so absorptance/emissivity are the ASHRAE Ch. 26 Table 14 default for rough natural stone, not a fabricated finish match.',
    blurb: 'Stone masonry: heavy local stone walls, plentiful in Ladakh and excellent at storing heat.',
  },
  {
    id: 'firedClayBrick',
    name: 'Fired clay brick',
    nameHi: 'पकी ईंट',
    category: 'structural',
    k: 0.72,
    rho: 1920,
    c: 835,
    ...FINISH.redBrick,
    locallyAvailableLadakh: false,
    source: `IS 3792:1978 Table 1 (burnt clay brick); ASHRAE Handbook of Fundamentals Ch. 26 Table 4 (brick, common); ${FINISH_SOURCE_NOTE}. Not locally fired in Ladakh -- brought in from lower-altitude kilns.`,
    blurb: 'Fired brick: kiln-baked brick, sturdy and widely used, but trucked in rather than made on site.',
  },
  {
    id: 'denseConcrete',
    name: 'Dense concrete',
    category: 'structural',
    k: 1.75,
    rho: 2400,
    c: 880,
    ...FINISH.greyConcrete,
    locallyAvailableLadakh: false,
    source: `ASHRAE Handbook of Fundamentals Ch. 26, Table 4 (concrete, sand and gravel aggregate, dense); ${FINISH_SOURCE_NOTE}`,
    blurb: 'Dense concrete: heavy, strong and a good heat store, but cement has to be brought over the passes.',
  },
  {
    id: 'rcc',
    name: 'RCC (reinforced cement concrete)',
    category: 'structural',
    k: 2.1,
    rho: 2400,
    c: 880,
    ...FINISH.greyConcrete,
    locallyAvailableLadakh: false,
    source: `ASHRAE Handbook of Fundamentals Ch. 26, Table 4 (concrete, reinforced, with 1% steel); ${FINISH_SOURCE_NOTE}`,
    blurb: 'RCC: reinforced concrete slab, mainly used for roofs and floors rather than walls.',
  },
  {
    id: 'aacBlock',
    name: 'AAC block',
    category: 'structural',
    k: 0.16,
    rho: 600,
    c: 1000,
    alphaSolar: 0.4,
    emissivity: 0.9,
    locallyAvailableLadakh: false,
    source:
      'IS 2185 (Part 3), Concrete masonry units -- Autoclaved aerated concrete blocks; manufacturer datasheet range (e.g. Aerocon / Siporex technical data sheet). Usually rendered light-coloured in practice; absorptance/emissivity given here are the ASHRAE Ch. 26 Table 14 default for a light-grey masonry surface, since AAC has no row of its own in the finish table.',
    blurb: 'AAC block: light factory-made block, insulates better than ordinary concrete but has to be shipped in.',
  },
  {
    id: 'timberPoplarWillow',
    name: 'Timber (poplar / willow)',
    nameHi: 'लकड़ी',
    category: 'structural',
    k: 0.14,
    rho: 500,
    c: 1600,
    alphaSolar: 0.55,
    emissivity: 0.9,
    locallyAvailableLadakh: true,
    source:
      'IS 3629, Specification for structural timber in building; ASHRAE Handbook of Fundamentals Ch. 26 Table 4 (wood, softwood, low density). No dedicated finish-table row for bare wood; absorptance/emissivity are the ASHRAE Ch. 26 Table 14 default for a natural, unfinished wood surface.',
    blurb: 'Poplar and willow timber: locally grown, used for roof beams and lattice, insulates fairly well on its own.',
  },
  {
    id: 'compressedEarthBlock',
    name: 'Compressed earth block',
    category: 'structural',
    k: 0.9,
    rho: 1800,
    c: 880,
    ...FINISH.darkMudEarth,
    locallyAvailableLadakh: true,
    source: `IS 1725:2013, Specification for stabilised soil blocks used in general building construction; ${FINISH_SOURCE_NOTE}`,
    blurb: 'Compressed earth block: machine-pressed earth block, a more uniform cousin of mud brick.',
  },
  {
    id: 'mudPlaster',
    name: 'Mud plaster',
    category: 'finish',
    k: 0.75,
    rho: 1600,
    c: 880,
    ...FINISH.darkMudEarth,
    locallyAvailableLadakh: true,
    source: `IS 3792:1978 Table 1 (mud plaster); ${FINISH_SOURCE_NOTE}`,
    blurb: 'Mud plaster: thin earthen render put over a wall, cheap and easy to redo every year.',
  },
  {
    id: 'cementPlaster',
    name: 'Cement plaster',
    category: 'finish',
    k: 0.72,
    rho: 1860,
    c: 840,
    ...FINISH.greyConcrete,
    locallyAvailableLadakh: false,
    source: `IS 3792:1978 Table 1 (cement plaster); ASHRAE Handbook of Fundamentals Ch. 26 Table 4; ${FINISH_SOURCE_NOTE}`,
    blurb: 'Cement plaster: modern smooth render coat, more durable than mud plaster but needs bought-in cement.',
  },

  // ---------------------------------------------------------------- insulation
  // Every insulation row below is a hidden layer sandwiched inside a
  // construction in every assembly this catalogue ships (see constructions.ts):
  // even the one assembly that puts EPS on the outside face relies on an
  // external render/cladding over it in real construction, never bare foam in
  // the weather. alphaSolar/emissivity are therefore placeholders (ASHRAE Ch.
  // 26 Table 14 default for a mid-grey non-metallic surface) rather than a
  // claim about measured foam optical properties -- nothing in the solver
  // currently reads Material.alphaSolar/emissivity (only Surface's own
  // exteriorAbsorptivity/exteriorEmissivity are used), so this cannot silently
  // bias a simulation.
  {
    id: 'eps',
    name: 'EPS (thermocol)',
    category: 'insulation',
    k: 0.036,
    rho: 20,
    c: 1400,
    alphaSolar: 0.5,
    emissivity: 0.9,
    locallyAvailableLadakh: false,
    source:
      'IS 4671:1984, Specification for expanded polystyrene for thermal insulation purposes; typical manufacturer datasheet value for 20 kg/m^3 grade (e.g. Beardsell / BASF Styropor technical data sheet).',
    blurb: 'EPS foam board: light insulation board, very effective but shipped in from outside Ladakh.',
  },
  {
    id: 'xps',
    name: 'XPS',
    category: 'insulation',
    k: 0.033,
    rho: 35,
    c: 1400,
    alphaSolar: 0.5,
    emissivity: 0.9,
    locallyAvailableLadakh: false,
    source: 'Manufacturer datasheet, extruded polystyrene board (e.g. Dow STYROFOAM / Supreme XPS technical data sheet).',
    blurb: 'XPS foam board: denser cousin of EPS, holds up better under load or damp, also shipped in.',
  },
  {
    id: 'puf',
    name: 'PUF / PIR',
    category: 'insulation',
    k: 0.025,
    rho: 35,
    c: 1400,
    alphaSolar: 0.5,
    emissivity: 0.9,
    locallyAvailableLadakh: false,
    source: 'Manufacturer datasheet, rigid polyurethane foam board (e.g. Kingspan / Supreme PUF technical data sheet).',
    blurb: 'PUF board: the best-insulating foam board available, often bonded straight onto a metal roof sheet.',
  },
  {
    id: 'glassWool',
    name: 'Glass wool',
    category: 'insulation',
    k: 0.04,
    rho: 24,
    c: 840,
    alphaSolar: 0.5,
    emissivity: 0.9,
    locallyAvailableLadakh: false,
    source: 'IS 8183:1993, Specification for bonded mineral wool; manufacturer datasheet (e.g. UP Twiga / Owens Corning glass wool technical data sheet).',
    blurb: 'Glass wool: fluffy insulation batt, common and inexpensive, but needs to be kept dry.',
  },
  {
    id: 'rockWool',
    name: 'Rock wool',
    category: 'insulation',
    k: 0.038,
    rho: 100,
    c: 840,
    alphaSolar: 0.5,
    emissivity: 0.9,
    locallyAvailableLadakh: false,
    source: 'IS 8183:1993, Specification for bonded mineral wool (rock wool); manufacturer datasheet (e.g. Rockwool India technical data sheet).',
    blurb: 'Rock wool: denser mineral-fibre batt, also fireproof, a heavier alternative to glass wool.',
  },
  {
    id: 'strawBale',
    name: 'Straw bale',
    category: 'insulation',
    k: 0.06,
    rho: 110,
    c: 2000,
    alphaSolar: 0.4,
    emissivity: 0.9,
    locallyAvailableLadakh: true,
    source: 'ASHRAE Handbook of Fundamentals Ch. 26, Table 4 (straw, agricultural material), cross-checked against published straw-bale construction literature.',
    blurb: 'Straw bale: baled farm straw used as a thick wall infill, insulates well and is grown right on the farm.',
  },
  {
    id: 'sheepWool',
    name: 'Sheep wool',
    category: 'insulation',
    k: 0.04,
    rho: 25,
    c: 1800,
    alphaSolar: 0.4,
    emissivity: 0.9,
    locallyAvailableLadakh: true,
    source: 'Manufacturer datasheet, sheep-wool insulation batt (e.g. Thermafleece / Black Mountain sheep wool technical data sheet).',
    blurb: "Sheep wool: insulation felted from local sheep's wool, renewable and simple to install by hand.",
  },
  {
    id: 'airGap25mm',
    name: 'Air gap, 25 mm unventilated',
    category: 'insulation',
    // R = 0.18 m^2*K/W at the nominal 25 mm thickness -> an equivalent k so the
    // gap slots into the same mesh code as every solid layer. Comment required
    // by the PROMPT: k = thickness / R.
    k: 0.025 / 0.18,
    rho: 1.2,
    c: 1005,
    alphaSolar: 0.5,
    emissivity: 0.9,
    locallyAvailableLadakh: true,
    source:
      'ASHRAE Handbook of Fundamentals Ch. 26, Table 2 (thermal resistance of plane air spaces, 25 mm, non-reflective, winter, R ~= 0.18 m^2*K/W); density/specific heat are standard air properties, ASHRAE Handbook of Fundamentals Ch. 33.',
    blurb: 'Sealed air gap: a still 25 millimetre pocket of trapped air left inside a wall, a free layer of insulation.',
  },

  // ---------------------------------------------------------------- other
  {
    id: 'steelCGI',
    name: 'Steel (CGI sheet)',
    category: 'structural',
    k: 50,
    rho: 7800,
    c: 480,
    ...FINISH.galvanisedWeathered,
    locallyAvailableLadakh: false,
    source: `ASHRAE Handbook of Fundamentals Ch. 26, Table 4 (steel, mild); ${FINISH_SOURCE_NOTE} (weathered galvanised finish assumed as the default condition after one season)`,
    blurb: 'Corrugated steel sheet: the common lightweight roofing sheet, cheap and quick to put up but a poor insulator on its own.',
  },
  {
    id: 'cgiBright',
    name: 'Steel (CGI sheet), bright new galvanised',
    category: 'finish',
    k: 50,
    rho: 7800,
    c: 480,
    ...FINISH.galvanisedBright,
    locallyAvailableLadakh: false,
    source: `Same base material as steelCGI; ${FINISH_SOURCE_NOTE} (freshly galvanised, bright finish)`,
    blurb: 'Freshly galvanised roofing sheet: shiny when new, reflects most sunlight until it starts to weather.',
  },
  {
    id: 'water',
    name: 'Water (drum storage)',
    nameHi: 'पानी',
    category: 'storage',
    k: 0.6,
    rho: 1000,
    c: 4186,
    alphaSolar: 0.9,
    emissivity: 0.9,
    locallyAvailableLadakh: true,
    source: 'ASHRAE Handbook of Fundamentals Ch. 33, Table 2 (physical properties of water); a matte dark drum surface is assumed for the absorptance value.',
    blurb: 'Water in drums: the simplest heat battery, soaks up sun through the day and gives it back at night.',
  },
  {
    id: 'gravelSoilFill',
    name: 'Gravel / soil fill',
    category: 'storage',
    k: 1.4,
    rho: 2050,
    c: 1840,
    alphaSolar: 0.6,
    emissivity: 0.9,
    locallyAvailableLadakh: true,
    source: 'IS 3792:1978 Table 1 (soil, gravel fill); ASHRAE Handbook of Fundamentals Ch. 26 Table 4 (soil).',
    blurb: 'Gravel or soil fill: packed earth or stone chips under a floor, adds cheap mass that steadies the temperature.',
  },
  {
    id: 'pcmParaffinRT25',
    name: 'PCM paraffin (RT25)',
    category: 'storage',
    k: 0.2,
    rho: 880,
    c: 2000,
    alphaSolar: 0.3,
    emissivity: 0.9,
    locallyAvailableLadakh: false,
    source:
      'Manufacturer datasheet, Rubitherm RT25 paraffin-based phase change material (melts near room temperature, latent heat approx. 200 kJ/kg -- see the PCM module, T-19, for how the melting behaviour itself is modelled; this row is the sensible-heat portion only).',
    blurb: 'Paraffin wax heat pack: melts and re-freezes near room warmth, storing a lot of heat in a small, light package, but it is a manufactured import.',
  },

  // ---------------------------------------------------------------- finishes (standalone)
  {
    id: 'whitewashLime',
    name: 'Whitewash (lime wash)',
    category: 'finish',
    k: 0.7,
    rho: 1600,
    c: 840,
    ...FINISH.whitewashLime,
    locallyAvailableLadakh: true,
    source: `IS 712:1984, Specification for building limes; ASHRAE Handbook of Fundamentals Ch. 26 Table 4 (plaster, lime), used as the bulk properties for a lime-wash coat; ${FINISH_SOURCE_NOTE}`,
    blurb: 'Whitewash: traditional lime coating brushed onto a wall every year, keeps walls bright and bounces away summer sun.',
  },
  {
    id: 'whitePaint',
    name: 'White paint',
    category: 'finish',
    k: 0.2,
    rho: 1200,
    c: 1000,
    ...FINISH.whitePaint,
    locallyAvailableLadakh: false,
    source: `Typical exterior acrylic emulsion paint film, manufacturer datasheet range (e.g. Asian Paints Apex / Berger WeatherCoat technical data sheet); ${FINISH_SOURCE_NOTE}`,
    blurb: 'White paint: a modern painted finish, longer-lasting than whitewash and just as good at reflecting sunlight.',
  },
  {
    id: 'blackPaint',
    name: 'Black paint',
    category: 'finish',
    k: 0.2,
    rho: 1200,
    c: 1000,
    ...FINISH.blackPaint,
    locallyAvailableLadakh: false,
    source: `Typical matte black solar-absorptive paint film, manufacturer datasheet range (e.g. Asian Paints / Berger technical data sheet), the usual coating for a solar-absorber or Trombe-wall surface; ${FINISH_SOURCE_NOTE}`,
    blurb: 'Black paint: a dark coating used on a sun-facing storage wall or water drum to pull in as much heat as possible.',
  },
] as const;

const BY_ID = new Map(MATERIALS.map((m) => [m.id, m] as const));

export function materialById(id: string): Material {
  const m = BY_ID.get(id);
  if (!m) throw new EngineError('UNKNOWN_MATERIAL', `No material with id "${id}".`, { id });
  return m;
}
