import { describe, expect, it } from 'vitest';
import { fmtC, fmtHour, kToC } from './format';

describe('kToC', () => {
  it('converts Kelvin to Celsius', () => {
    expect(kToC(273.15)).toBeCloseTo(0);
    expect(kToC(0)).toBeCloseTo(-273.15);
  });
});

describe('fmtC', () => {
  it('formats to one decimal', () => {
    expect(fmtC(283.15)).toBe('10.0');
  });

  it('folds a near-freezing negative zero to a plain 0.0', () => {
    expect(fmtC(273.151)).toBe('0.0');
    expect(fmtC(273.14)).toBe('0.0');
  });

  it('keeps a real negative reading negative', () => {
    expect(fmtC(268.15)).toBe('-5.0');
  });
});

describe('fmtHour', () => {
  it('pads to HH:00', () => {
    expect(fmtHour(6)).toBe('06:00');
    expect(fmtHour(18)).toBe('18:00');
  });

  it('wraps 24 to 00:00', () => {
    expect(fmtHour(24)).toBe('00:00');
  });
});
