// apps/studio-server/test/shapes.test.ts — G2 (V2.md §G2, ledger/tasks/G2.md
// condition 8). Pure closed-form checks on `cylinderGeometry`/`domeGeometry`,
// plus end-to-end checks that every shape/storeys combination assembles into
// a request the (frozen) engine actually accepts and simulates.

import { describe, expect, it } from 'vitest';
import { canonicalRequestHash, simulate } from '@shelter/engine';
import type { Surface } from '@shelter/engine';
import { buildApp } from '../src/app.js';
import { assemble, cylinderGeometry, domeGeometry, type ShapeTemplates } from '../src/design/assemble.js';
import { buildOptions } from '../src/options.js';
import type { ShelterDesign } from '../src/design/types.js';

const EPS = 1e-9;

function fakeSurface(type: Surface['type'], overrides: Partial<Surface> = {}): Surface {
  return {
    id: 'template',
    type,
    area: 1,
    tilt: type === 'wall' ? 90 : type === 'roof' ? 0 : 180,
    azimuth: 0,
    construction: [{ materialId: 'rammedEarth', thickness: 0.4 }],
    boundary: type === 'floor' ? 'ground' : 'exterior',
    exteriorAbsorptivity: 0.7,
    exteriorEmissivity: 0.9,
    interiorEmissivity: 0.9,
    ...overrides,
  };
}

const templates: ShapeTemplates = {
  wall: fakeSurface('wall'),
  roof: fakeSurface('roof'),
  floor: fakeSurface('floor'),
};

function totalArea(surfaces: Surface[], type: Surface['type']): number {
  return surfaces.filter((s) => s.type === type).reduce((sum, s) => sum + s.area, 0);
}

describe('cylinderGeometry (pure, closed forms)', () => {
  const diameterM = 6;
  const heightM = 2.6;

  it('12 wall facets, each pi*D*h/12; roof/floor each pi*r^2; volume pi*r^2*h (storeys 1)', () => {
    const g = cylinderGeometry(templates, diameterM, heightM, 1);
    const r = diameterM / 2;
    const expectedWallEach = (Math.PI * diameterM * heightM) / 12;
    const expectedFootprint = Math.PI * r * r;

    const walls = g.surfaces.filter((s) => s.type === 'wall');
    expect(walls).toHaveLength(12);
    for (const w of walls) expect(Math.abs(w.area - expectedWallEach)).toBeLessThan(EPS);
    expect(Math.abs(totalArea(g.surfaces, 'roof') - expectedFootprint)).toBeLessThan(EPS);
    expect(Math.abs(totalArea(g.surfaces, 'floor') - expectedFootprint)).toBeLessThan(EPS);
    expect(Math.abs(g.floorArea - expectedFootprint)).toBeLessThan(EPS);
    expect(Math.abs(g.volume - expectedFootprint * heightM)).toBeLessThan(EPS);

    // ids unique, azimuths cover -150..180 step 30
    const ids = new Set(g.surfaces.map((s) => s.id));
    expect(ids.size).toBe(g.surfaces.length);
    const azimuths = walls.map((w) => w.azimuth).sort((a, b) => a - b);
    expect(azimuths).toEqual([-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180]);
  });

  it('2 storeys doubles wall area and volume; footprint unchanged', () => {
    const g1 = cylinderGeometry(templates, diameterM, heightM, 1);
    const g2 = cylinderGeometry(templates, diameterM, heightM, 2);
    expect(Math.abs(totalArea(g2.surfaces, 'wall') - 2 * totalArea(g1.surfaces, 'wall'))).toBeLessThan(EPS);
    expect(Math.abs(g2.volume - 2 * g1.volume)).toBeLessThan(EPS);
    expect(g2.floorArea).toBe(g1.floorArea);
  });
});

describe('domeGeometry (pure, closed forms)', () => {
  const diameterM = 6;
  const r = diameterM / 2;

  it('3 bands x 12 sectors; band area 2*pi*r*dz/12; floor pi*r^2; volume 2/3*pi*r^3', () => {
    const g = domeGeometry(templates, diameterM);
    const dz = r / 3;
    const expectedSectorArea = (2 * Math.PI * r * dz) / 12;

    // 36 band facets (wall+roof) + 1 floor
    expect(g.surfaces).toHaveLength(37);
    // every non-floor facet has the same sector area (Archimedes hat-box)
    for (const s of g.surfaces.filter((s) => s.id !== 'floor')) {
      expect(Math.abs(s.area - expectedSectorArea)).toBeLessThan(EPS);
    }

    expect(Math.abs(g.floorArea - Math.PI * r * r)).toBeLessThan(EPS);
    expect(Math.abs(g.volume - (2 / 3) * Math.PI * r ** 3)).toBeLessThan(EPS);

    // total curved-surface area equals the hemisphere's own closed form 2*pi*r^2
    const curvedTotal = g.surfaces.filter((s) => s.id !== 'floor').reduce((sum, s) => sum + s.area, 0);
    expect(Math.abs(curvedTotal - 2 * Math.PI * r * r)).toBeLessThan(EPS);
  });

  it('tilt >= 60 deg is a wall (can host windows); steeper-than-60 bands are the lower two', () => {
    const g = domeGeometry(templates, diameterM);
    const walls = g.surfaces.filter((s) => s.type === 'wall');
    const roofs = g.surfaces.filter((s) => s.type === 'roof');
    expect(walls).toHaveLength(24); // bands 0,1 (12 sectors each)
    expect(roofs).toHaveLength(12); // band 2
    for (const w of walls) expect(w.tilt).toBeGreaterThanOrEqual(60);
    for (const rf of roofs) expect(rf.tilt).toBeLessThan(60);

    const ids = new Set(g.surfaces.map((s) => s.id));
    expect(ids.size).toBe(g.surfaces.length);
  });
});

describe('assemble(): shape/storeys end to end', () => {
  const { defaults } = buildOptions();

  it('shape/storeys absent === explicit shape:"box", storeys:1 (condition 3)', () => {
    const implicit: ShelterDesign = { ...defaults };
    delete implicit.shape;
    delete implicit.storeys;
    const explicit: ShelterDesign = { ...defaults, shape: 'box', storeys: 1 };
    expect(canonicalRequestHash(assemble(explicit))).toBe(canonicalRequestHash(assemble(implicit)));
  });

  it.each([
    ['cylinder', 1],
    ['cylinder', 2],
    ['dome', 1],
    ['box', 2],
  ] as const)('shape=%s storeys=%s assembles to a request the engine accepts, finite KPIs', (shape, storeys) => {
    const design: ShelterDesign = { ...defaults, shape, storeys };
    const request = assemble(design);
    const result = simulate(request); // throws EngineError if validateRequest rejects it
    expect(Number.isFinite(result.kpis.meanIndoorTemp)).toBe(true);
    expect(Number.isFinite(result.kpis.minIndoorTemp)).toBe(true);
    expect(Number.isFinite(result.kpis.tempAt0600)).toBe(true);
  });

  it('a cylinder with the same floor area and height as a box has less total wall area', () => {
    const boxDesign: ShelterDesign = { ...defaults, shape: 'box', lengthM: 5, widthM: 5, heightM: 2.6 };
    const boxFloorArea = boxDesign.lengthM * boxDesign.widthM;
    const cylinderDiameterM = 2 * Math.sqrt(boxFloorArea / Math.PI); // same floor area
    const cylinderDesign: ShelterDesign = {
      ...defaults,
      shape: 'cylinder',
      lengthM: cylinderDiameterM,
      heightM: boxDesign.heightM,
    };

    const boxRequest = assemble(boxDesign);
    const cylinderRequest = assemble(cylinderDesign);
    expect(Math.abs(boxRequest.building.floorArea - cylinderRequest.building.floorArea)).toBeLessThan(1e-6);

    const boxWallArea = totalArea(boxRequest.building.surfaces, 'wall');
    const cylinderWallArea = totalArea(cylinderRequest.building.surfaces, 'wall');
    expect(cylinderWallArea).toBeLessThan(boxWallArea);
  });
});

describe('POST /api/simulate/preview: shape/storeys validation + defaults (condition 2)', () => {
  const { defaults } = buildOptions();

  it('GET /api/options defaults include shape:"box", storeys:1', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/options' });
    const body = res.json();
    expect(body.defaults.shape).toBe('box');
    expect(body.defaults.storeys).toBe(1);
  });

  it('shape:"pyramid" -> 400 VALIDATION_ERROR field shape', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, shape: 'pyramid' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.field).toBe('shape');
  });

  it('storeys:3 -> 400 VALIDATION_ERROR field storeys', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, storeys: 3 },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.field).toBe('storeys');
  });

  it('shape:"dome" + storeys:2 -> 400 VALIDATION_ERROR (dome must be 1 storey)', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, shape: 'dome', storeys: 2 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('shape:"dome" alone (storeys absent) is accepted -> 200', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, shape: 'dome' },
    });
    expect(res.statusCode).toBe(200);
  });

  it.each(['cylinder', 'dome'] as const)('shape:%s -> 200 with finite KPIs', async (shape) => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, shape },
    });
    expect(res.statusCode).toBe(200);
    expect(Number.isFinite(res.json().kpis.meanIndoorTemp)).toBe(true);
  });

  it('shape:"cylinder", storeys:2 -> 200 with finite KPIs', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, shape: 'cylinder', storeys: 2 },
    });
    expect(res.statusCode).toBe(200);
    expect(Number.isFinite(res.json().kpis.meanIndoorTemp)).toBe(true);
  });

  it('shape/storeys absent -> 200, same kpis as explicit box/1 (box path untouched)', async () => {
    const app = buildApp();
    const withoutFields = { ...defaults };
    delete (withoutFields as Partial<ShelterDesign>).shape;
    delete (withoutFields as Partial<ShelterDesign>).storeys;
    const a = await app.inject({ method: 'POST', url: '/api/simulate/preview', payload: withoutFields });
    const b = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, shape: 'box', storeys: 1 },
    });
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(a.json().kpis).toEqual(b.json().kpis);
  });
});
