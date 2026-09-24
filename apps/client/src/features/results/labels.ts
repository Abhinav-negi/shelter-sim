// Plain-language labels for chart series shown on the Results page.
// Pathway list/labels adapted from (read-only reference)
// apps/web/components/charts/heatflow/pathways.ts, trimmed to what this
// tab needs.
//
// Excluded from the heat-flow chart: Q5_envelopeConduction,
// Q6_intConvection, Q7_interiorLongwave — these redistribute energy
// between solved nodes INSIDE the envelope and never cross the shelter's
// boundary, so plotting them alongside the boundary terms would double
// count and confuse a "where does the heat go" reading. Also excluded:
// `deltaT` (a temperature difference, not a flow) and the raw
// `dailyTotalsKWh` container. `storageRate` is kept — it's how the energy
// balance closes (heat retained in / released from the fabric across the
// day), which is exactly what shows thick adobe walls "buffering" the
// night.
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
] as const

export type HeatFlowKey = (typeof HEAT_FLOW_KEYS)[number]

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
}

export const SURFACE_LABELS: Record<string, string> = {
  wallSouth: 'South wall',
  wallEast: 'East wall',
  wallWest: 'West wall',
  wallNorth: 'North wall',
  roof: 'Roof',
  floor: 'Floor',
}

export function surfaceLabel(id: string): string {
  return SURFACE_LABELS[id] ?? id
}
