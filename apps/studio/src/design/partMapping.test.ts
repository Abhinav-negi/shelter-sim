import { describe, expect, it } from 'vitest';
import { mapPartToField } from './partMapping';

describe('mapPartToField', () => {
  it('maps every wall orientation to Materials / walls', () => {
    for (const o of ['S', 'E', 'W', 'N'] as const) {
      expect(mapPartToField(`wall:${o}`)).toEqual({ section: 'materials', field: 'walls' });
    }
  });

  it('maps each window orientation to Openings / its own field', () => {
    for (const o of ['S', 'E', 'W', 'N'] as const) {
      expect(mapPartToField(`window:${o}`)).toEqual({ section: 'openings', field: `window:${o}` });
    }
  });

  it('maps roof to Materials / roof', () => {
    expect(mapPartToField('roof')).toEqual({ section: 'materials', field: 'roof' });
  });

  it('maps floor to Materials / floor', () => {
    expect(mapPartToField('floor')).toEqual({ section: 'materials', field: 'floor' });
  });
});
