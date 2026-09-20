// apps/web/components/meta/assumptions/limitations.data.ts
//
// T-52(b). "An explicit limitations list, stated as deliberate choices with
// their consequences named, not as apologies." CHALLENGE.md C-20: "a
// simplification volunteered is engineering judgement; the same one
// discovered by an evaluator is a gap." LOG.md rule 13.
//
// Acceptance test 4 greps this whole directory for a specific incorrect
// antonym of "well-mixed" that BLUEPRINT.md 1.4 uses by mistake arguing for
// the single-air-node assumption; that word must appear NOWHERE below (or
// anywhere else this task touches) -- "well-mixed" is the correct term and
// the only one used throughout this file.

export interface LimitationEntry {
  id: string;
  choice: string;
  consequence: string;
}

export const LIMITATIONS: LimitationEntry[] = [
  {
    id: 'single-air-node',
    choice: 'No air stratification: the indoor air is modelled as a single well-mixed node.',
    consequence:
      'A real room is warmer near the ceiling and colder near the floor. This model cannot show that ' +
      'gradient, and a design that relies on stratification (e.g. a tall clerestory venting hot air) ' +
      'is not distinguishable from one that does not.',
  },
  {
    id: 'uniform-surface-temperature',
    choice: 'Each wall/roof/floor surface has one uniform temperature across its area.',
    consequence:
      'Local cold spots (a thermal bridge at a corner, a lintel, a frame) are not resolved below the ' +
      'lumped thermal-bridge factor. A whole-surface condensation risk can be assessed; a specific ' +
      'corner cannot.',
  },
  {
    id: 'no-moisture-transport',
    choice:
      'No moisture transport model -- only a condensation-risk CHECK against surface temperature and dew point.',
    consequence:
      'The tool can flag hours where a surface is likely below dew point; it cannot model how much ' +
      'moisture accumulates, migrates through the wall, or drives material degradation over a season.',
  },
  {
    id: 'simplified-wind',
    choice:
      'Wind enters only as a single scalar speed in the exterior convection coefficient -- no direction-dependent pressure field, no wind-driven infiltration model.',
    consequence:
      'A windward wall and a leeward wall get the same convective coefficient for the same wind speed. ' +
      'Site-specific wind channelling (a valley funnel, a windbreak) is not captured.',
  },
  {
    id: 'lumped-thermal-bridging',
    choice:
      'No 3-D thermal bridging beyond a single lumped thermalBridgeFactor multiplier on envelope UA.',
    consequence:
      'Corner, junction and penetration losses are represented as one multiplier on the whole envelope, ' +
      'not as a per-detail calculation. Two designs with the same lumped factor but very different ' +
      'junction detailing are reported identically.',
  },
  {
    id: 'single-zone',
    choice: 'The whole shelter is one thermal zone with one air node -- no room-to-room modelling.',
    consequence:
      'A multi-room shelter with a closed, unheated back room cannot be distinguished from a single ' +
      'open-plan space of the same volume; door/partition effects are not modelled.',
  },
  {
    id: 'beam-only-shading',
    choice:
      'Overhang and shading geometry (loads/windows.ts) shades only the direct-beam solar component; diffuse and ground-reflected components are not geometrically shaded.',
    consequence:
      'An overhang sized against beam radiation slightly over-predicts the actual reduction in total ' +
      'transmitted solar on an overcast or diffuse-heavy day. T-18’s documented ceiling.',
  },
  {
    id: 'no-cfd',
    choice:
      'No CFD, no ray-traced shading, no multi-zone airflow network, no HVAC equipment models, no 3-D FEA (LOG.md global rule 12, the binding cut list).',
    consequence:
      'Airflow patterns, self-shading from complex geometry, and duct/equipment losses are out of scope ' +
      'entirely -- not approximated, simply not modelled.',
  },
  {
    id: 'one-representative-day',
    choice:
      'A single simulated design day (or a small monthly scenario set) is scaled to an annual figure via the annualisation method shown in the assumptions panel, not a full 8760-hour annual run.',
    consequence:
      'Annual fuel/cost/CO2 numbers are only as representative as the chosen design day(s); an unusually ' +
      'mild or severe year is not captured. The UI never hides this -- `meta.annualisationMethod` is ' +
      'shown verbatim, always.',
  },
];
