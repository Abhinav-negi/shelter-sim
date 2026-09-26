// Pure KPI-delta-table logic for the Compare page (F4.md condition 4: "a KPI
// table with deltas vs the first design. No scores or rankings."). Split out
// from Compare.tsx so it's independently unit-testable, no React involved.
//
// The row list/labels intentionally mirror results/Kpis.tsx's nine fields —
// that file has no exported form to import (it's must-not-touch, import-only
// per F4.md), so the label strings are necessarily re-declared here rather
// than shared. Numeric formatting (`kToC`) IS imported, not copied.
import type { SimulationKpis } from '@shelter/engine';
import { kToC } from '../../results/format';

export interface CompareDesign {
  id: string;
  name: string;
  kpis: SimulationKpis;
}

interface KpiDef {
  key: keyof SimulationKpis;
  label: string;
  unit: string;
  decimals: number;
  /** Kelvin on the wire -> °C for display. A delta between two Kelvin values
   * equals the delta between their °C values (the conversion is a constant
   * offset), so this only affects the absolute value's formatting. */
  kelvin?: boolean;
}

const KPI_DEFS: KpiDef[] = [
  { key: 'tempAt0600', label: 'Dawn temperature (06:00)', unit: '°C', decimals: 1, kelvin: true },
  { key: 'minIndoorTemp', label: 'Min indoor', unit: '°C', decimals: 1, kelvin: true },
  { key: 'maxIndoorTemp', label: 'Max indoor', unit: '°C', decimals: 1, kelvin: true },
  { key: 'hoursBelowFreezing', label: 'Hours below 0°C', unit: 'h', decimals: 1 },
  { key: 'hoursBelow5C', label: 'Hours below 5°C', unit: 'h', decimals: 1 },
  { key: 'decrementFactor', label: 'Decrement factor', unit: '', decimals: 2 },
  { key: 'timeLagHours', label: 'Time lag', unit: 'h', decimals: 1 },
  { key: 'auxEnergyKWhPerDay', label: 'Auxiliary heat', unit: 'kWh/day', decimals: 1 },
  { key: 'keroseneEquivalentLitresPerYear', label: 'Kerosene equivalent', unit: 'L/yr', decimals: 0 },
];

export interface KpiCell {
  value: string;
  /** null for the baseline (first) design's own column. */
  delta: string | null;
}

export interface KpiTableRow {
  label: string;
  unit: string;
  cells: KpiCell[];
}

function rawValue(kpis: SimulationKpis, def: KpiDef): number {
  const v = kpis[def.key] as number;
  return def.kelvin ? kToC(v) : v;
}

/** Round first, then fold -0 to 0 (`-0 || 0` is 0), so a value that rounds to
 *  zero never prints "-0.0" (same rule as results/format.ts's `fmtC`). */
function fixed(n: number, decimals: number): number {
  return Number(n.toFixed(decimals)) || 0;
}

/** Explicit "+"/"-" sign, never a bare positive number, so a delta always
 * reads as a delta and not an absolute value at a glance. */
function fmtDelta(n: number, decimals: number): string {
  const r = fixed(n, decimals);
  const s = r.toFixed(decimals);
  return r > 0 ? `+${s}` : s;
}

/** designs[0] is the baseline every delta is computed against — never a
 * ranking, just "how does this differ from the first one". */
export function buildKpiTable(designs: CompareDesign[]): KpiTableRow[] {
  return KPI_DEFS.map((def) => {
    const values = designs.map((d) => rawValue(d.kpis, def));
    const baseline = values[0] ?? 0;
    return {
      label: def.label,
      unit: def.unit,
      cells: values.map((v, i) => ({
        value: fixed(v, def.decimals).toFixed(def.decimals),
        delta: i === 0 ? null : fmtDelta(v - baseline, def.decimals),
      })),
    };
  });
}
