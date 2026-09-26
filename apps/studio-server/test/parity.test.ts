// apps/studio-server/test/parity.test.ts — condition 3. Converting
// apps/server/test/fixtures/leh-default.json `.input` to a ShelterDesign
// (preset location, azimuth 0, constructions null) and assembling it must
// give a canonicalRequestHash equal to the OLD apps/server/src/assemble.ts
// `assemble(input)`, imported by relative path, read-only (apps/server is
// frozen for this task).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalRequestHash } from '@shelter/engine';
import { assemble as oldAssemble, type DesignInput } from '../../server/src/assemble.js';
import { assemble } from '../src/design/assemble.js';
import type { ShelterDesign } from '../src/design/types.js';

const FIXTURE_PATH = fileURLToPath(
  new URL('../../server/test/fixtures/leh-default.json', import.meta.url),
);

describe('parity: design/assemble.ts vs apps/server/src/assemble.ts', () => {
  it('matches canonicalRequestHash for the leh-default fixture', () => {
    const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as { input: DesignInput };
    const input = fixture.input;

    const design: ShelterDesign = {
      location: { kind: 'preset', id: input.locationId },
      date: input.date,
      presetId: input.presetId,
      lengthM: input.lengthM,
      widthM: input.widthM,
      heightM: input.heightM,
      azimuthDeg: 0,
      wallConstruction: null,
      roofConstruction: null,
      floorConstruction: null,
      windowWwr: input.windowWwr,
      glazingId: input.glazingId,
      nightShutters: input.nightShutters,
      occupancyPresetId: input.occupancyPresetId,
    };

    const oldRequest = oldAssemble(input);
    const newRequest = assemble(design);

    expect(canonicalRequestHash(newRequest)).toBe(canonicalRequestHash(oldRequest));
  });
});
