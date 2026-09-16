/**
 * T-24 acceptance tests, LOG.md, numbered 1-14 verbatim.
 *
 * Test 10 needs the engine's real `buildWallMesh`/`constructionUValue` to
 * prove the two EPS-position constructions share a steady-state U-value --
 * that is the one place this package reaches across to `@shelter/engine`,
 * as a devDependency only (see .work/T-24.md, Deviations). `packages/data`'s
 * own `src/` never imports it.
 */
import { describe, it, expect } from 'vitest';
import { buildWallMesh, constructionUValue } from '@shelter/engine';
import { MATERIALS, materialById, SCHEMA_VERSION as MATERIALS_SCHEMA_VERSION } from '../src/materials.js';
import { GLAZING, glazingById } from '../src/glazing.js';
import { CONSTRUCTIONS } from '../src/constructions.js';
import { EngineError } from '../src/errors.js';
import { assertSchemaVersion } from '../src/index.js';

const PHYSICS_TOKENS = /(^|[^a-z])(k|ρ|c|α|ε)($|[^a-z])/i;

describe('T-24 acceptance test 1 -- mandatory citation', () => {
  it('every MATERIALS row has a non-empty source', () => {
    expect(MATERIALS.every((m) => m.source.trim().length > 0)).toBe(true);
  });
  it('every GLAZING row has a non-empty source', () => {
    expect(GLAZING.every((g) => g.source.trim().length > 0)).toBe(true);
  });
  it('every CONSTRUCTIONS row has a non-empty source', () => {
    expect(CONSTRUCTIONS.every((c) => c.source.trim().length > 0)).toBe(true);
  });
});

describe('T-24 acceptance test 2 -- unique ids', () => {
  it('MATERIALS ids are unique', () => {
    const ids = MATERIALS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('GLAZING ids are unique', () => {
    const ids = GLAZING.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('CONSTRUCTIONS ids are unique', () => {
    const ids = CONSTRUCTIONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('T-24 acceptance test 3 -- physical plausibility', () => {
  it('every k, rho, c is strictly positive; alphaSolar/emissivity in [0,1]', () => {
    for (const m of MATERIALS) {
      expect(m.k).toBeGreaterThan(0);
      expect(m.rho).toBeGreaterThan(0);
      expect(m.c).toBeGreaterThan(0);
      expect(m.alphaSolar).toBeGreaterThanOrEqual(0);
      expect(m.alphaSolar).toBeLessThanOrEqual(1);
      expect(m.emissivity).toBeGreaterThanOrEqual(0);
      expect(m.emissivity).toBeLessThanOrEqual(1);
    }
  });
});

describe('T-24 acceptance test 4 -- spot values match 7.11 exactly', () => {
  it('rammed earth / EPS / single glazing / water / steel', () => {
    const rammedEarth = materialById('rammedEarth');
    expect(rammedEarth.k).toBe(1.0);
    expect(rammedEarth.rho).toBe(1900);
    expect(rammedEarth.c).toBe(880);

    const eps = materialById('eps');
    expect(eps.k).toBe(0.036);
    expect(eps.rho).toBe(20);
    expect(eps.c).toBe(1400);

    const single = glazingById('singleGlazing');
    expect(single.U).toBe(5.8);
    expect(single.SHGC).toBe(0.86);
    expect(single.b0).toBe(0.04);

    const water = materialById('water');
    expect(water.c).toBe(4186);

    const steel = materialById('steelCGI');
    expect(steel.k).toBe(50);
    expect(steel.rho).toBe(7800);
    expect(steel.c).toBe(480);
  });
});

describe('T-24 acceptance test 5 -- diffusivity anchors', () => {
  const diffusivity = (m: { k: number; rho: number; c: number }) => m.k / (m.rho * m.c);
  it('dense concrete, rammed earth, fired brick', () => {
    expect(diffusivity(materialById('denseConcrete'))).toBeCloseTo(8.29e-7, 8);
    expect(diffusivity(materialById('rammedEarth'))).toBeCloseTo(5.98e-7, 8);
    expect(diffusivity(materialById('firedClayBrick'))).toBeCloseTo(4.49e-7, 8);
  });
});

describe('T-24 acceptance test 6 -- throws on unknown id', () => {
  it('materialById throws EngineError UNKNOWN_MATERIAL', () => {
    expect(() => materialById('nope')).toThrow(EngineError);
    try {
      materialById('nope');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EngineError);
      expect((e as EngineError).code).toBe('UNKNOWN_MATERIAL');
    }
  });
  it('glazingById throws EngineError UNKNOWN_GLAZING', () => {
    try {
      glazingById('nope');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EngineError);
      expect((e as EngineError).code).toBe('UNKNOWN_GLAZING');
    }
  });
});

describe('T-24 acceptance test 7 -- every category represented', () => {
  it('structural, insulation, finish, storage all have at least one row', () => {
    for (const category of ['structural', 'insulation', 'finish', 'storage'] as const) {
      expect(MATERIALS.some((m) => m.category === category)).toBe(true);
    }
  });
});

describe('T-24 acceptance test 8 -- local-materials search space', () => {
  it('at least 6 materials are locallyAvailableLadakh', () => {
    const local = MATERIALS.filter((m) => m.locallyAvailableLadakh);
    expect(local.length).toBeGreaterThanOrEqual(6);
    // Evidence: count and ids logged to LOG.md / .work/T-24.md, not asserted
    // here beyond the >= 6 the test requires.
    void local.map((m) => m.id);
  });
});

describe('T-24 acceptance test 9 -- construction layers resolve', () => {
  it('every CONSTRUCTIONS layer materialId resolves through materialById', () => {
    for (const c of CONSTRUCTIONS) {
      for (const layer of c.layers) {
        expect(() => materialById(layer.materialId)).not.toThrow();
      }
    }
  });
});

describe('T-24 acceptance test 10 -- EPS position changes dynamics, not U-value', () => {
  it('rammedEarth350EpsOutside and rammedEarth350EpsInside share the same U-value', () => {
    const materials = Object.fromEntries(MATERIALS.map((m) => [m.id, m]));
    const outside = CONSTRUCTIONS.find((c) => c.id === 'rammedEarth350EpsOutside')!;
    const inside = CONSTRUCTIONS.find((c) => c.id === 'rammedEarth350EpsInside')!;
    const hOuter = 20; // arbitrary but identical for both -- only relative equality matters
    const hInner = 8;
    const uOutside = constructionUValue(buildWallMesh(outside.layers, materials), hOuter, hInner);
    const uInside = constructionUValue(buildWallMesh(inside.layers, materials), hOuter, hInner);
    expect(uOutside).toBeCloseTo(uInside, 9);
    // Evidence numbers pasted into .work/T-24.md / LOG.md at measurement time.
  });
});

describe('T-24 acceptance test 11 -- plain-language blurbs', () => {
  it('every material has a non-empty blurb with no standalone physics-glossary symbol', () => {
    for (const m of MATERIALS) {
      expect(m.blurb, `material "${m.id}" has no blurb`).toBeTruthy();
      expect(PHYSICS_TOKENS.test(m.blurb!), `material "${m.id}" blurb contains a physics symbol: ${m.blurb}`).toBe(
        false,
      );
    }
  });
});

describe('T-24 acceptance test 12 -- schema version mismatch throws', () => {
  it('assertSchemaVersion(2) throws EngineError DATA_SCHEMA_MISMATCH', () => {
    try {
      assertSchemaVersion(2);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EngineError);
      expect((e as EngineError).code).toBe('DATA_SCHEMA_MISMATCH');
    }
  });
  it('assertSchemaVersion(1) does not throw', () => {
    expect(() => assertSchemaVersion(MATERIALS_SCHEMA_VERSION)).not.toThrow();
  });
});

describe('T-24 acceptance test 14 -- runtime dependencies match CONTRACTS.md 7.13', () => {
  // Originally asserted `dependencies` was absent entirely (true when T-24 measured it).
  // CONTRACTS.md D-10 (added for T-25) deliberately supersedes that: @shelter/data is now
  // allowed exactly one runtime dependency, @shelter/engine, so packages/data/src/weather
  // can import Erbs/Swinbank/barometric correlations instead of reimplementing them. See
  // D-10 and log/AREA-C-data-layer.md's T-24 addendum for the full reasoning.
  it('packages/data/package.json depends on exactly @shelter/engine, nothing else', async () => {
    const fs = await import('node:fs/promises');
    const url = await import('node:url');
    const path = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(await fs.readFile(url.fileURLToPath(path), 'utf8'));
    expect(pkg.dependencies).toEqual({ '@shelter/engine': '0.1.0' });
  });
});
