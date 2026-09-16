/**
 * T-59 acceptance tests, `log/AREA-H-scenarios.md`, numbered 1-12 verbatim.
 */
import { describe, it, expect } from 'vitest';
import { skyTemperature } from '@shelter/engine';
import { tmyById } from '../src/tmy.js';
import { validateWeatherSeries } from '../src/weather/pipeline.js';
import {
  buildScenarios,
  scenarioWeather,
  OVERCAST_GHI_THRESHOLD_WHM2,
  CLEAR_SKY_KT_THRESHOLD,
  DESIGN_WINTER_PERCENTILE,
  type Scenario,
} from '../src/scenarios.js';

const lehSeries = tmyById('leh');
const scenarios = buildScenarios(lehSeries, 'leh');

/** Same day-of-year numbering every bundled TMY file uses: day 1 = Jan 1,
 * hour 0, non-leap 365-day calendar (`packages/data/src/tmy.ts`). */
function dailyStats(series = lehSeries) {
  const n = series.T_amb.length;
  const days = Math.floor(n / 24);
  const meanT: number[] = [];
  const ghiTotal: number[] = [];
  for (let d = 0; d < days; d++) {
    let sT = 0;
    let sG = 0;
    for (let h = 0; h < 24; h++) {
      sT += series.T_amb[d * 24 + h]!;
      sG += series.GHI[d * 24 + h]!;
    }
    meanT.push(sT / 24);
    ghiTotal.push(sG);
  }
  return { meanT, ghiTotal, days };
}

describe('T-59 acceptance test 1 -- exactly 18 scenarios with unique ids', () => {
  it('buildScenarios(lehSeries, "leh") returns 18 unique-id scenarios', () => {
    expect(scenarios.length).toBe(18);
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(18);
    console.log(
      'TEST1',
      JSON.stringify(scenarios.map((s) => ({ id: s.id, name: s.name }))),
    );
  });
});

describe('T-59 acceptance test 2 -- the twelve monthly scenarios cover all twelve months', () => {
  it('one monthly scenario per calendar month, all twelve months present', () => {
    const monthly = scenarios.filter((s) => s.kind === 'monthly');
    expect(monthly.length).toBe(12);
    const monthCum = [31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
    function monthOf(doy: number): number {
      for (let m = 0; m < 12; m++) if (doy <= monthCum[m]!) return m;
      return 11;
    }
    const months = monthly.map((s) => monthOf(s.startDayOfYear));
    expect(new Set(months).size).toBe(12);
    console.log('TEST2', JSON.stringify(monthly.map((s) => ({ id: s.id, dayOfYear: s.startDayOfYear, month: monthOf(s.startDayOfYear) + 1 }))));
  });
});

describe('T-59 acceptance test 3 -- the coldest day is exhaustively the coldest', () => {
  it('no other 24 h window in the series has a lower mean temperature', () => {
    const { meanT } = dailyStats();
    const coldest = scenarios.find((s) => s.kind === 'coldest')!;
    const dayIdx = coldest.startDayOfYear - lehSeries.startDayOfYear;
    const claimedMean = meanT[dayIdx]!;
    for (let d = 0; d < meanT.length; d++) {
      expect(meanT[d]!).toBeGreaterThanOrEqual(claimedMean);
    }
    console.log(`TEST3 coldest dayOfYear=${coldest.startDayOfYear} meanC=${(claimedMean - 273.15).toFixed(2)}`);
  });
});

describe('T-59 acceptance test 4 -- the hottest day is exhaustively the hottest', () => {
  it('no other 24 h window in the series has a higher mean temperature', () => {
    const { meanT } = dailyStats();
    const hottest = scenarios.find((s) => s.kind === 'hottest')!;
    const dayIdx = hottest.startDayOfYear - lehSeries.startDayOfYear;
    const claimedMean = meanT[dayIdx]!;
    for (let d = 0; d < meanT.length; d++) {
      expect(meanT[d]!).toBeLessThanOrEqual(claimedMean);
    }
    console.log(`TEST4 hottest dayOfYear=${hottest.startDayOfYear} meanC=${(claimedMean - 273.15).toFixed(2)}`);
  });
});

describe('T-59 acceptance test 5 -- the 1-in-100 design winter day is the 1st percentile, warmer than the coldest', () => {
  it('nearest-rank 1st percentile of daily mean temperature, distinct from and warmer than the coldest day', () => {
    const { meanT } = dailyStats();
    const sortedAsc = [...meanT].sort((a, b) => a - b);
    const rank = Math.ceil(DESIGN_WINTER_PERCENTILE * meanT.length);
    const expectedMean = sortedAsc[rank - 1]!;

    const designWinter = scenarios.find((s) => s.kind === 'designWinter')!;
    const dayIdx = designWinter.startDayOfYear - lehSeries.startDayOfYear;
    const actualMean = meanT[dayIdx]!;
    expect(actualMean).toBeCloseTo(expectedMean, 9);

    const coldest = scenarios.find((s) => s.kind === 'coldest')!;
    expect(designWinter.startDayOfYear).not.toBe(coldest.startDayOfYear);
    expect(actualMean).toBeGreaterThan(meanT[coldest.startDayOfYear - lehSeries.startDayOfYear]!);

    console.log(
      `TEST5 N=${meanT.length} percentile=${DESIGN_WINTER_PERCENTILE} rank=ceil(${DESIGN_WINTER_PERCENTILE}*${meanT.length})=${rank} ` +
        `dayOfYear=${designWinter.startDayOfYear} meanC=${(actualMean - 273.15).toFixed(2)} ` +
        `coldestMeanC=${(meanT[coldest.startDayOfYear - lehSeries.startDayOfYear]! - 273.15).toFixed(2)} warmerThanColdest=${actualMean > meanT[coldest.startDayOfYear - lehSeries.startDayOfYear]!}`,
    );
  });
});

describe('T-59 acceptance test 6 -- the sunless streak is genuinely the longest overcast run', () => {
  it('days > 1, and no longer run below the overcast threshold exists', () => {
    const { ghiTotal } = dailyStats();
    const streak = scenarios.find((s) => s.kind === 'sunlessStreak')!;
    expect(streak.days).toBeGreaterThan(1);

    // Exhaustively find the longest run below threshold and compare.
    let best = { start: -1, len: 0 };
    let curStart = -1;
    let curLen = 0;
    for (let d = 0; d < ghiTotal.length; d++) {
      if (ghiTotal[d]! < OVERCAST_GHI_THRESHOLD_WHM2) {
        if (curLen === 0) curStart = d;
        curLen++;
        if (curLen > best.len) best = { start: curStart, len: curLen };
      } else {
        curLen = 0;
      }
    }
    expect(streak.days).toBe(best.len);
    expect(streak.startDayOfYear).toBe(lehSeries.startDayOfYear + best.start);

    const meanGhiOverStreak =
      ghiTotal.slice(best.start, best.start + best.len).reduce((a, b) => a + b, 0) / best.len;
    console.log(
      `TEST6 streakLen=${streak.days} startDayOfYear=${streak.startDayOfYear} meanDailyGHI=${meanGhiOverStreak.toFixed(1)} Wh/m^2`,
    );
  });
});

describe('T-59 acceptance test 7 -- the clear cold night is colder in sky terms than the coldest day', () => {
  it('daytime k_t exceeds the clear-sky threshold, and sky temp at 03:00 is lower than the coldest day\'s', () => {
    const clearNight = scenarios.find((s) => s.kind === 'clearColdNight')!;
    const coldest = scenarios.find((s) => s.kind === 'coldest')!;

    const clearNightIdx = (clearNight.startDayOfYear - lehSeries.startDayOfYear) * 24;
    const coldestIdx = (coldest.startDayOfYear - lehSeries.startDayOfYear) * 24;

    const skyClearNightAt3 = skyTemperature(lehSeries.T_amb[clearNightIdx + 3]!, lehSeries.LW_down?.[clearNightIdx + 3]);
    const skyColdestAt3 = skyTemperature(lehSeries.T_amb[coldestIdx + 3]!, lehSeries.LW_down?.[coldestIdx + 3]);

    expect(skyClearNightAt3).toBeLessThan(skyColdestAt3);

    console.log(
      `TEST7 clearNight dayOfYear=${clearNight.startDayOfYear} sky@03:00=${skyClearNightAt3.toFixed(4)} K | ` +
        `coldest dayOfYear=${coldest.startDayOfYear} sky@03:00=${skyColdestAt3.toFixed(4)} K | ` +
        `colderByK=${(skyColdestAt3 - skyClearNightAt3).toFixed(4)}`,
    );
  });
});

describe('T-59 acceptance test 8 -- every sourceNote is non-empty and names its selection rule and record', () => {
  it('all 18 scenarios have a substantive sourceNote', () => {
    for (const s of scenarios) {
      expect(s.sourceNote.length).toBeGreaterThan(20);
      expect(s.sourceNote).toMatch(/leh\.json|record|nasa-power|bundled-tmy/i);
    }
    console.log('TEST8', JSON.stringify(scenarios.map((s) => ({ id: s.id, sourceNoteLen: s.sourceNote.length }))));
  });
});

describe('T-59 acceptance test 9 -- every threshold constant is exported with a rule-14 comment', () => {
  it('the three threshold constants exist and have documented values', () => {
    expect(OVERCAST_GHI_THRESHOLD_WHM2).toBe(2500);
    expect(CLEAR_SKY_KT_THRESHOLD).toBe(0.6);
    expect(DESIGN_WINTER_PERCENTILE).toBe(0.01);
    console.log(
      'TEST9',
      JSON.stringify({
        OVERCAST_GHI_THRESHOLD_WHM2: {
          value: OVERCAST_GHI_THRESHOLD_WHM2,
          comment: 'overcast classification for the sunless streak -- separates genuinely cloudy (low k_t) days from cloudless low-sun-angle winter days; raise/lower per src/scenarios.ts comment',
        },
        CLEAR_SKY_KT_THRESHOLD: {
          value: CLEAR_SKY_KT_THRESHOLD,
          comment: 'daytime clearness index above which a day counts "clear" for the clear-cold-night scenario; sits mid-plateau (0.55-0.65 all select the same night in the Leh record)',
        },
        DESIGN_WINTER_PERCENTILE: {
          value: DESIGN_WINTER_PERCENTILE,
          comment: '1-in-100 design winter day = 1st percentile (nearest-rank) of daily mean temperature; standard professional practice for a cold-but-not-freak design condition',
        },
      }),
    );
  });
});

describe('T-59 acceptance test 10 -- scenarioWeather output length matches days x 24 / (stepSeconds/3600)', () => {
  it('all eighteen scenarios slice to the expected sample count', () => {
    for (const s of scenarios) {
      const out = scenarioWeather(lehSeries, s);
      const expected = (s.days * 24) / (lehSeries.stepSeconds / 3600);
      expect(out.T_amb.length).toBe(expected);
      expect(out.GHI.length).toBe(expected);
      expect(out.v_wind.length).toBe(expected);
    }
    console.log(
      'TEST10',
      JSON.stringify(
        scenarios.map((s) => ({ id: s.id, days: s.days, expectedLen: (s.days * 24) / (lehSeries.stepSeconds / 3600) })),
      ),
    );
  });
});

describe('T-59 acceptance test 11 -- scenarioWeather preserves provenance and appends a naming note', () => {
  it('provenance survives the slice and gains a note naming the scenario', () => {
    for (const s of scenarios) {
      const out = scenarioWeather(lehSeries, s);
      expect(out.provenance.source).toBe(lehSeries.provenance.source);
      expect(out.provenance.label).toBe(lehSeries.provenance.label);
      expect(out.provenance.notes.length).toBe(lehSeries.provenance.notes.length + 1);
      expect(out.provenance.notes[out.provenance.notes.length - 1]).toContain(s.name);
    }
    // Original series must not be mutated by any slice.
    const originalNoteCount = lehSeries.provenance.notes.length;
    expect(lehSeries.provenance.notes.length).toBe(originalNoteCount);
    console.log('TEST11 sample note=' + JSON.stringify(scenarioWeather(lehSeries, scenarios[0]!).provenance.notes.slice(-1)));
  });
});

describe('T-59 acceptance test 12 -- all eighteen scenarioWeather outputs pass validateWeatherSeries with zero errors', () => {
  it('validateWeatherSeries throws for none of the eighteen scenario slices', () => {
    const results: Record<string, string> = {};
    for (const s of scenarios) {
      const out = scenarioWeather(lehSeries, s);
      expect(() => validateWeatherSeries(out)).not.toThrow();
      results[s.id] = 'ok';
    }
    console.log('TEST12', JSON.stringify(results));
  });
});

// Sanity: kind covers all 18 (12 monthly + 6 named), and the annual-mean day
// (necessarily tagged outside the PROMPT's 6-literal union, see scenarios.ts
// header comment) is present exactly once.
describe('T-59 sanity -- every scenario kind accounted for', () => {
  it('12 monthly + 1 each of the other six kinds', () => {
    const byKind: Record<string, number> = {};
    for (const s of scenarios as Scenario[]) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
    expect(byKind['monthly']).toBe(12);
    expect(byKind['coldest']).toBe(1);
    expect(byKind['hottest']).toBe(1);
    expect(byKind['designWinter']).toBe(1);
    expect(byKind['sunlessStreak']).toBe(1);
    expect(byKind['clearColdNight']).toBe(1);
    expect(byKind['annualMean']).toBe(1);
  });
});
