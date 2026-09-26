import { describe, expect, it } from 'vitest';
import { sampleAtHour } from './sampleAtHour';
import type { ResultJson } from '../../results/types';

const result: ResultJson = {
  time: [0, 3600, 7200],
  temperatures: {
    indoorAir: [273.15, 283.15, 293.15], // 0, 10, 20 degC
    ambient: [263.15, 273.15, 283.15], // -10, 0, 10 degC
  },
  heatFlows: { dailyTotalsKWh: {} },
};

describe('sampleAtHour', () => {
  it('returns the exact sample at an exact hour', () => {
    expect(sampleAtHour(result, 1)).toEqual({ indoorC: 10, outdoorC: 0 });
  });

  it('interpolates linearly between two bracketing samples', () => {
    const sample = sampleAtHour(result, 1.5)!;
    expect(sample.indoorC).toBeCloseTo(15, 5);
    expect(sample.outdoorC).toBeCloseTo(5, 5);
  });

  it('wraps hour 24 to hour 0 and clamps past the last sample to it', () => {
    expect(sampleAtHour(result, 24)).toEqual({ indoorC: 0, outdoorC: -10 });
    // -0.5 wraps to 23.5h, past the last (2h) sample -> clamps to it, not hour 0.
    expect(sampleAtHour(result, -0.5)).toEqual({ indoorC: 20, outdoorC: 10 });
  });

  it('returns null for an empty result', () => {
    expect(sampleAtHour({ ...result, time: [] }, 5)).toBeNull();
  });
});
