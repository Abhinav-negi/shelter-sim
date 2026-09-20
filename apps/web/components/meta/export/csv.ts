// apps/web/components/meta/export/csv.ts
//
// T-52(c) CSV export: "every timestep and every term, headers matching the
// heatFlows field names exactly" (acceptance test 6). LOG.md's T-49 entry:
// "CSV export of every timestep and every term is handed to T-52's exporter
// -- do not reimplement it here", so this is the ONE place it is built.
//
// Pure string-building, no DOM -- `download.ts` is the (untestable
// headlessly, see its own header) browser glue that turns this string into
// a file.

import type { SimulationResult } from '@shelter/engine';

/** The exact HeatFlows field names, in disk order (packages/engine/src/
 * types.ts). `dailyTotalsKWh` is excluded: it is a period TOTAL (one number
 * per pathway), not a per-timestep series, so it has no column here. */
const HEAT_FLOW_FIELDS = [
  'Q1_solarOpaque',
  'Q2_solarGlazed',
  'Q3_extConvection',
  'Q4_skyRadiation',
  'Q5_envelopeConduction',
  'Q6_intConvection',
  'Q7_interiorLongwave',
  'Q8_windowConduction',
  'Q9_infiltration',
  'Q10_ground',
  'Q11_internalGains',
  'Qaux',
  'storageRate',
  'deltaT',
] as const;

const TEMPERATURE_FIELDS = ['indoorAir', 'ambient', 'sky', 'meanRadiant'] as const;

export const CSV_HEADER = [
  'time',
  ...TEMPERATURE_FIELDS.map((f) => `temperatures.${f}`),
  ...HEAT_FLOW_FIELDS,
];

/** One row per timestep, one column per series -- acceptance test 6. */
export function buildCsv(result: SimulationResult): string {
  const n = result.time.length;
  const lines = [CSV_HEADER.join(',')];
  for (let i = 0; i < n; i++) {
    const row: (number | string)[] = [result.time[i]!];
    for (const f of TEMPERATURE_FIELDS) row.push(result.temperatures[f][i]!);
    for (const f of HEAT_FLOW_FIELDS) row.push(result.heatFlows[f][i]!);
    lines.push(row.join(','));
  }
  return lines.join('\n') + '\n';
}
