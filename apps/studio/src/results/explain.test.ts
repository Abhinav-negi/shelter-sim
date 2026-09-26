import type { Kelvin, SimulationKpis } from '@shelter/engine';
import { describe, expect, it } from 'vitest';
import { explain } from './explain';

// `Kelvin` is a branded number (engine's units.ts) — a plain type-only cast,
// no runtime import from @shelter/engine (SUBAGENT RULES §2: client imports
// types only).
const K = (n: number): Kelvin => n as Kelvin;

const baseKpis: SimulationKpis = {
  minIndoorTemp: K(280),
  maxIndoorTemp: K(295),
  meanIndoorTemp: K(287),
  tempAt0600: K(283.15), // 10°C
  hoursInComfort: 18,
  hoursBelow5C: 0,
  hoursBelowFreezing: 0,
  peakToPeakSwing: 8,
  decrementFactor: 0.3,
  timeLagHours: 6,
  auxEnergyKWhPerDay: 0,
  keroseneEquivalentLitresPerYear: 0,
  co2EquivalentKgPerYear: 0,
  costPerYearINR: 0,
  condensationRiskHours: null,
};

describe('explain', () => {
  it('reports a comfortable dawn temperature as good, no aux-heat sentence when unneeded', () => {
    const insights = explain(baseKpis);
    expect(insights[0]?.severity).toBe('good');
    expect(insights[0]?.text).toContain('10.0°C');
    expect(insights.some((i) => i.text.includes('auxiliary heating'))).toBe(false);
  });

  it('flags a below-freezing dawn as danger and mentions hours below freezing', () => {
    const kpis: SimulationKpis = { ...baseKpis, tempAt0600: K(268.15), hoursBelowFreezing: 8 };
    const insights = explain(kpis);
    expect(insights[0]?.severity).toBe('danger');
    expect(insights[0]?.text).toContain('-5.0°C');
    const hoursInsight = insights.find((i) => i.text.includes('hours below freezing'));
    expect(hoursInsight?.severity).toBe('danger'); // >6h
  });

  it('flags a mild dawn (0-5°C) as warn', () => {
    const kpis: SimulationKpis = { ...baseKpis, tempAt0600: K(274.15) };
    expect(explain(kpis)[0]?.severity).toBe('warn');
  });

  it('mentions kerosene only when aux heat and kerosene are both positive', () => {
    const kpis: SimulationKpis = {
      ...baseKpis,
      auxEnergyKWhPerDay: 2.5,
      keroseneEquivalentLitresPerYear: 120,
    };
    const insights = explain(kpis);
    const auxInsight = insights.find((i) => i.text.includes('auxiliary heating'));
    expect(auxInsight?.text).toContain('120 L of kerosene');
  });

  it('caps at three insights, dropping the decrement-factor sentence last', () => {
    const kpis: SimulationKpis = {
      ...baseKpis,
      tempAt0600: K(268.15),
      hoursBelowFreezing: 8,
      auxEnergyKWhPerDay: 3,
      decrementFactor: 0.9, // would be 'danger' severity if it made the cut
    };
    const insights = explain(kpis);
    expect(insights).toHaveLength(3);
    expect(insights.some((i) => i.text.includes('decrement factor'))).toBe(false);
  });

  it('includes the decrement-factor sentence when the other three do not fill the quota', () => {
    const insights = explain(baseKpis);
    expect(insights.some((i) => i.text.includes('decrement factor'))).toBe(true);
  });
});
