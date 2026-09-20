// apps/web/components/meta/assumptions/constants.data.test.ts
//
// T-52 acceptance test 1: "Every constant exported from
// packages/engine/src/constants.ts appears in the assumptions panel with a
// value, a unit and a source. Diff the two lists mechanically and paste the
// diff -- it must be empty."
//
// Reads the ground truth (constants.ts's own `export const NAME` lines) off
// disk with a regex and diffs it against ENGINE_CONSTANTS's declared
// `constantsTsExportName` set -- no hand-typed list to drift from the source.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ENGINE_CONSTANTS, UNEXPORTED_CALIBRATION_KNOBS } from './constants.data';

const here = path.dirname(fileURLToPath(import.meta.url));
// apps/web/components/meta/assumptions -> repo root is 5 levels up.
const constantsTsPath = path.resolve(here, '../../../../../packages/engine/src/constants.ts');

function namesInConstantsTs(): string[] {
  const src = readFileSync(constantsTsPath, 'utf8');
  const names: string[] = [];
  for (const m of src.matchAll(/^export const (\w+)/gm)) {
    names.push(m[1]!);
  }
  return names.sort();
}

describe('assumptions panel mechanically matches packages/engine/src/constants.ts', () => {
  it('lists every export with a value, unit and source; the diff is empty', () => {
    const groundTruth = namesInConstantsTs();
    const panelNames = ENGINE_CONSTANTS.map((e) => e.constantsTsExportName).filter(
      (n): n is string => n !== undefined,
    );

    expect(groundTruth.length).toBeGreaterThan(0); // sanity: the regex actually matched something

    const missingFromPanel = groundTruth.filter((n) => !panelNames.includes(n));
    const extraInPanel = panelNames.filter((n) => !groundTruth.includes(n));

    expect({ missingFromPanel, extraInPanel }).toEqual({ missingFromPanel: [], extraInPanel: [] });

    // Every entry that claims to be a constants.ts export must carry a
    // non-empty value, unit and source (test 1's own "with a value, a unit
    // and a source").
    for (const entry of ENGINE_CONSTANTS) {
      expect(entry.value, `${entry.id} value`).not.toBe('');
      expect(entry.unit, `${entry.id} unit`).not.toBe('');
      expect(entry.source, `${entry.id} source`).not.toBe('');
    }
  });

  it('ACH_PER_GLAZING_FRACTION and the M=4 multiplier each carry a calibration note (test 2)', () => {
    const ach = UNEXPORTED_CALIBRATION_KNOBS.find((e) => e.id === 'ACH_PER_GLAZING_FRACTION');
    const m = UNEXPORTED_CALIBRATION_KNOBS.find((e) => e.id === 'AIR_CAPACITANCE_MULTIPLIER_M');
    expect(ach?.calibrationNote).toBeTruthy();
    expect(m?.calibrationNote).toBeTruthy();
  });
});
