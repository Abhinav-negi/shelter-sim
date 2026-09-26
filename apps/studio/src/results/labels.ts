// Port of apps/client/src/features/results/labels.ts (F3.md ## Read), trimmed
// to the heat-flow pathway breakdown this page shows (F3.md condition 4).
// Excluded from the chart, same reasoning as the original: Q5_envelopeConduction,
// Q6_intConvection, Q7_interiorLongwave redistribute energy between solved
// nodes INSIDE the envelope and never cross the shelter's boundary — plotting
// them alongside the boundary terms would double count. `deltaT` is a
// temperature difference, not a flow. `storageRate` is kept: it's how the
// energy balance closes (heat retained in / released from the fabric across
// the day) — exactly what shows thick walls "buffering" the night.
export const HEAT_FLOW_KEYS = [
  'Q1_solarOpaque',
  'Q2_solarGlazed',
  'Q11_internalGains',
  'Qaux',
  'Q3_extConvection',
  'Q8_windowConduction',
  'Q9_infiltration',
  'Q10_ground',
  'Q4_skyRadiation',
  'storageRate',
] as const;

export type HeatFlowKey = (typeof HEAT_FLOW_KEYS)[number];

export const HEAT_FLOW_LABELS: Record<HeatFlowKey, string> = {
  Q1_solarOpaque: 'Sun on walls & roof',
  Q2_solarGlazed: 'Sun through windows',
  Q11_internalGains: 'Body heat, stove & livestock',
  Qaux: 'Auxiliary heater',
  Q3_extConvection: 'Convection with outside air',
  Q8_windowConduction: 'Conduction through windows',
  Q9_infiltration: 'Draughts & ventilation',
  Q10_ground: 'Conducted to/from ground',
  Q4_skyRadiation: 'Radiated to night sky',
  storageRate: 'Stored in / released from walls',
};
