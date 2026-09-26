import { describe, expect, it } from 'vitest';
import type { Kelvin, SimulationKpis } from '@shelter/engine';
import { buildKpiTable, type CompareDesign } from './kpiTable';

// `Kelvin` is a branded number (engine's units.ts) — a plain type-only cast,
// no runtime import from @shelter/engine, same pattern as results/explain.test.ts.
const K = (n: number): Kelvin => n as Kelvin;

function kpis(overrides: Partial<SimulationKpis>): SimulationKpis {
  return {
    minIndoorTemp: K(270),
    maxIndoorTemp: K(285),
    meanIndoorTemp: K(277),
    tempAt0600: K(271.15), // -2 °C
    hoursInComfort: 4,
    hoursBelow5C: 10,
    hoursBelowFreezing: 6,
    peakToPeakSwing: 15,
    decrementFactor: 0.4,
    timeLagHours: 5,
    auxEnergyKWhPerDay: 3,
    keroseneEquivalentLitresPerYear: 100,
    co2EquivalentKgPerYear: 50,
    costPerYearINR: 1000,
    condensationRiskHours: null,
    ...overrides,
  };
}

describe('buildKpiTable', () => {
  it('never prints a negative zero (value or delta)', () => {
    const rows = buildKpiTable([
      { id: 'a', name: 'A', kpis: kpis({ minIndoorTemp: K(273.14) }) }, // -0.01 °C
      { id: 'b', name: 'B', kpis: kpis({ minIndoorTemp: K(273.12) }) }, // delta -0.02
    ]);
    const min = rows.find((r) => r.label === 'Min indoor')!;
    expect(min.cells[0]!.value).toBe('0.0');
    expect(min.cells[1]!.delta).toBe('0.0');
  });

  const baseline: CompareDesign = { id: 'a', name: 'Baseline', kpis: kpis({}) };
  const warmer: CompareDesign = {
    id: 'b',
    name: 'Warmer',
    kpis: kpis({ tempAt0600: K(274.15), auxEnergyKWhPerDay: 1, decrementFactor: 0.3 }),
  };

  it('has one row per KPI, in a fixed order, with no delta for the baseline column', () => {
    const rows = buildKpiTable([baseline, warmer]);
    expect(rows.map((r) => r.label)).toEqual([
      'Dawn temperature (06:00)',
      'Min indoor',
      'Max indoor',
      'Hours below 0°C',
      'Hours below 5°C',
      'Decrement factor',
      'Time lag',
      'Auxiliary heat',
      'Kerosene equivalent',
    ]);
    const dawn = rows[0]!;
    expect(dawn.cells[0]!.delta).toBeNull();
  });

  it('converts Kelvin KPIs to °C and computes the delta vs the first design', () => {
    const rows = buildKpiTable([baseline, warmer]);
    const dawn = rows.find((r) => r.label === 'Dawn temperature (06:00)')!;
    expect(dawn.cells[0]!.value).toBe('-2.0'); // 271.15 K -> -2.00 °C
    expect(dawn.cells[1]!.value).toBe('1.0'); // 274.15 K -> 1.00 °C
    expect(dawn.cells[1]!.delta).toBe('+3.0'); // a Kelvin-or-Celsius delta is identical either way
  });

  it('signs deltas explicitly, including negative ones', () => {
    const rows = buildKpiTable([baseline, warmer]);
    const aux = rows.find((r) => r.label === 'Auxiliary heat')!;
    expect(aux.cells[1]!.delta).toBe('-2.0');
  });

  it('supports 2-4 designs, each column delta-ing against designs[0]', () => {
    const third: CompareDesign = { id: 'c', name: 'Third', kpis: kpis({ tempAt0600: K(269.15) }) };
    const rows = buildKpiTable([baseline, warmer, third]);
    const dawn = rows.find((r) => r.label === 'Dawn temperature (06:00)')!;
    expect(dawn.cells).toHaveLength(3);
    expect(dawn.cells[2]!.delta).toBe('-2.0'); // 269.15 K -> -4.0 °C, baseline -2.0 °C
  });
});
