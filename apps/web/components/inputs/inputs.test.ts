// apps/web/components/inputs/inputs.test.ts
//
// T-44's 12 acceptance tests. Same environment constraints T-45/T-46
// documented: no jsdom/@testing-library on the approved dependency list
// (CONTRACTS.md §7.13), so DOM structure is verified with
// `react-dom/server`'s `renderToStaticMarkup` (plain Node, no real DOM) and
// interaction is verified by calling the exact pure functions the component
// wires to its event handlers -- not a simulated click. Where a real browser
// measurement is required (test 10) a real headless Chrome instance is
// used, exactly like T-45's own test 10.
//
// `@shelter/data` is imported here (a plain Node test file, never part of
// the browser bundle) purely as a REALISTIC FIXTURE SOURCE -- the same
// pattern `apps/web/components/house/house.test.tsx` uses -- never by any
// file under `components/inputs/**` itself (see catalog.ts's header for why
// that file cannot).

import { describe, expect, it, vi, beforeAll } from 'vitest';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { glazingById, materialById, MATERIALS, PRESETS, tmyById } from '@shelter/data';
import { simulate } from '@shelter/engine';
import type { Glazing, Material, Preset, SimulationRequest } from '@shelter/engine';
import { __debugDispatchCount, actions, getStoreState, hydrateStore } from '../../lib/store';
import {
  PRESET_SUMMARIES,
  GLAZINGS as GLAZING_SUMMARIES,
  TMY_LOCATIONS,
} from './catalog';
import {
  applyPresetSummary,
  currentFloorMaterialId,
  currentRoofMaterialId,
  currentWallMaterialId,
  currentWwr,
  dayOfYearToIsoDate,
  isoDateToDayOfYear,
  rebuildGlazingsRecord,
  rebuildMaterialsRecord,
  setGlazingType,
  setWallMaterial,
  setWwr,
  sliceWeatherToDay,
} from './requestOps';
import { parseWeatherCsv } from './csv';
import { SimpleForm, CONTROL_NAMES } from './SimpleForm';
import { fetchMaterials, __resetMaterialsCacheForTest } from './materialsApi';

// ---- shared fixture: the real bundled Leh preset, resolved exactly the way
// `app/page.tsx` does (same helper T-46's own test file inlines, since
// `app/page.tsx` is off every Area F task's allow-list to import from). ----
function resolvePreset(preset: Preset): SimulationRequest {
  const materials: Record<string, Material> = {};
  for (const surface of preset.request.building.surfaces) {
    for (const layer of surface.construction) materials[layer.materialId] = materialById(layer.materialId);
  }
  const glazings: Record<string, Glazing> = {};
  for (const win of preset.request.building.windows) glazings[win.glazingId] = glazingById(win.glazingId);
  return { ...preset.request, weather: tmyById(preset.locationId), materials, glazings };
}

const lehPreset = PRESETS.find((p) => p.locationId === 'leh')!;
const baseRequest = resolvePreset(lehPreset);
const catalogue = MATERIALS.slice() as Material[];

hydrateStore({ request: baseRequest, result: simulate(baseRequest), presetId: lehPreset.id });

// -------------------- markup helper: fetch is mocked so SimpleForm's --------------------
// -------------------- useMaterialsCatalogue() hook resolves synchronously in --------------
// -------------------- structural render tests below. --------------------------------------
function mockMaterialsFetchOnce() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/materials') {
        return new Response(JSON.stringify({ materials: catalogue, schemaVersion: 1, servedFrom: 'code' }), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

// `renderToStaticMarkup` never runs effects (it is server-side, one-shot
// markup), so `useMaterialsCatalogue()`'s own `useEffect` fetch would never
// resolve inside a synchronous render -- every structural render test below
// needs the module-level cache in `materialsApi.ts` already warm, done ONCE
// here rather than per test.
beforeAll(async () => {
  __resetMaterialsCacheForTest();
  mockMaterialsFetchOnce();
  await fetchMaterials();
});

describe('T-44 simple form', () => {
  it('test 2 -- at most 10 controls visible at first paint', () => {
    mockMaterialsFetchOnce();
    const markup = renderToStaticMarkup(React.createElement(SimpleForm));
    const found = [...markup.matchAll(/data-testid="control-([a-zA-Z]+)"/g)].map((m) => m[1]);
    const unique = [...new Set(found)];
    expect(unique.length).toBeLessThanOrEqual(10);
    expect(unique.sort()).toEqual([...CONTROL_NAMES].sort());
    console.log('T-44 test 2 evidence -- control count:', unique.length, 'list:', unique);
  });

  it('test 3 -- no rendered label uses a standalone physics symbol', () => {
    mockMaterialsFetchOnce();
    const markup = renderToStaticMarkup(React.createElement(SimpleForm));
    const text = markup.replace(/<[^>]+>/g, ' ');
    const forbidden = ['k', 'ρ', 'c', 'α', 'ε', 'U', 'SHGC', 'ACH', 'θ'];
    const hits: string[] = [];
    for (const symbol of forbidden) {
      const re = new RegExp(`(^|[^A-Za-z])${symbol}([^A-Za-z]|$)`, 'g');
      if (re.test(text)) hits.push(symbol);
    }
    expect(hits).toEqual([]);
  });

  it('test 4 -- loading any of the six presets populates every control with no empty required field', () => {
    for (const p of PRESET_SUMMARIES) {
      const next = applyPresetSummary(baseRequest, p.id, catalogue);
      const walls = next.building.surfaces.filter((s) => s.type === 'wall');
      const roof = next.building.surfaces.find((s) => s.type === 'roof')!;
      const floor = next.building.surfaces.find((s) => s.type === 'floor')!;
      for (const w of walls) expect(w.construction.length).toBeGreaterThan(0);
      expect(roof.construction.length).toBeGreaterThan(0);
      expect(floor.construction.length).toBeGreaterThan(0);
      expect(next.building.windows.length).toBeGreaterThan(0);
      expect(next.operation.internalGainsSchedule).toHaveLength(24);
      expect(next.operation.achSchedule).toHaveLength(24);
      // Every id actually referenced resolves in the rebuilt records -- no
      // empty/undefined slot for the engine to choke on.
      for (const w of next.building.surfaces) {
        for (const layer of w.construction) expect(next.materials[layer.materialId]).toBeDefined();
      }
      for (const win of next.building.windows) expect(next.glazings[win.glazingId]).toBeDefined();
      // And the resulting request is actually simulatable, not just shaped right.
      expect(() => simulate(next)).not.toThrow();
    }
    console.log('T-44 test 4 evidence -- all 6 presets populate every control and simulate cleanly:', PRESET_SUMMARIES.map((p) => p.id));
  });

  it('test 5 -- changing wall material triggers exactly one re-simulation after the debounce', async () => {
    hydrateStore({ request: baseRequest, result: simulate(baseRequest), presetId: lehPreset.id }); // no-op if already hydrated
    actions.setRequest(() => baseRequest); // settle any pending timer from a previous test
    await new Promise((r) => setTimeout(r, 200));
    const before = __debugDispatchCount();
    actions.setRequest((req) => setWallMaterial(req, 'firedClayBrick', catalogue));
    await new Promise((r) => setTimeout(r, 250));
    const after = __debugDispatchCount();
    expect(after - before).toBe(1);
    expect(currentWallMaterialId(getStoreState().request.building)).toBe('firedClayBrick');
    console.log('T-44 test 5 evidence -- dispatch count delta:', after - before);
  });

  it('test 6 -- material dropdown shows name and a one-click citation; rammed earth text pasted below', () => {
    mockMaterialsFetchOnce();
    const req = setWallMaterial(baseRequest, 'rammedEarth', catalogue);
    hydrateStore({ request: req, result: simulate(req), presetId: lehPreset.id });
    actions.setRequest(() => req); // ensure the live store reflects it for the render below
    const markup = renderToStaticMarkup(React.createElement(SimpleForm));
    expect(markup).toContain('<summary');
    expect(markup).toContain('citation-input-wall-material');
    const rammedEarth = materialById('rammedEarth');
    expect(markup).toContain(rammedEarth.name);
    console.log('T-44 test 6 evidence -- rammed earth citation text:', rammedEarth.source);
    // restore
    hydrateStore({ request: baseRequest, result: simulate(baseRequest), presetId: lehPreset.id });
    actions.setRequest(() => baseRequest);
  });

  it('test 7 -- clicking a wall (store.selectedSurfaceId) opens the stack editor', () => {
    mockMaterialsFetchOnce();
    actions.setSelectedSurfaceId('wallSouth');
    const openMarkup = renderToStaticMarkup(React.createElement(SimpleForm));
    expect(openMarkup).toContain('data-testid="stack-editor"');
    expect(openMarkup).toContain('wallSouth');

    actions.setSelectedSurfaceId(null);
    const closedMarkup = renderToStaticMarkup(React.createElement(SimpleForm));
    expect(closedMarkup).not.toContain('data-testid="stack-editor"');
  });

  it('test 8 -- a malformed CSV shows a row-level error and never returns a series (previous weather stays)', () => {
    const csv = ['T_amb_C,GHI,v_wind', '-10,200,2', '-12,not-a-number,3', '-9,150'].join('\n');
    const outcome = parseWeatherCsv(csv, {
      startDayOfYear: 15,
      site: { latitude: 34.15, longitude: 77.58, standardMeridian: 82.5 },
    });
    expect(outcome.series).toBeUndefined();
    expect(outcome.rowErrors.length).toBeGreaterThan(0);
    const row2 = outcome.rowErrors.find((e) => e.row === 2 && e.column === 'GHI');
    expect(row2).toBeDefined();
    const row3 = outcome.rowErrors.find((e) => e.row === 3 && e.column === 'v_wind');
    expect(row3).toBeDefined();
    console.log('T-44 test 8 evidence -- error text for row 2:', row2!.message, '| row 3:', row3!.message);
  });

  it('test 9 -- grep for the Kelvin-Celsius offset constant in this directory returns nothing (checked again via a real grep)', () => {
    const dir = path.resolve(__dirname);
    // Built by concatenation on purpose: this test file itself lives inside
    // the directory the grep scans, and the offset constant's own digits
    // must not appear anywhere in this directory, including in this file's
    // own source text -- see requestOps.ts's header note.
    const offsetLiteral = ['273', '15'].join('.');
    let output = '';
    try {
      output = execFileSync('grep', ['-rn', offsetLiteral.replace('.', '\\.'), dir], { encoding: 'utf8' });
    } catch (err: unknown) {
      // grep exits 1 (not an error here) when there are zero matches.
      output = (err as { stdout?: string }).stdout ?? '';
    }
    expect(output.trim()).toBe('');
    console.log('T-44 test 9 evidence -- grep output (expect empty):', JSON.stringify(output));
  });

  it(
    'test 10 -- at 400px width every control is reachable with no horizontal scroll (real headless Chrome measurement)',
    async () => {
      const execFileP = promisify(execFile);
      // esbuild resolves bare specifiers ("react", ...) by walking UP from
      // the entry file's own directory looking for node_modules -- an
      // os.tmpdir() location has no such ancestor, so the scratch directory
      // is created INSIDE the repo instead (never committed: created fresh
      // and removed in `finally` below, and nothing here is `git add`ed).
      const repoRoot = path.resolve(__dirname, '../../../..');
      const dir = mkdtempSync(path.join(repoRoot, '.t44-width-'));
      try {
        // esbuild bundles the REAL component tree (SimpleForm + its store/
        // engine imports) -- same one-off-harness technique as T-45's own
        // test 10 (esbuild is already a transitive devDependency here, used
        // only as a build tool, never added to any package.json).
        const entry = path.join(dir, 'entry.tsx');
        writeFileSync(
          entry,
          `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { hydrateStore, actions } from '${path.resolve(__dirname, '../../lib/store.ts')}';
import { SimpleForm } from '${path.resolve(__dirname, 'SimpleForm.tsx')}';
import fixture from './fixture.json';

// @ts-ignore -- test harness stub, not the real network.
window.fetch = async (url) => {
  if (url === '/api/materials') {
    return new Response(JSON.stringify({ materials: fixture.materials, schemaVersion: 1, servedFrom: 'code' }));
  }
  throw new Error('unexpected fetch: ' + url);
};

hydrateStore({ request: fixture.request, result: fixture.result, presetId: fixture.presetId });
actions.setSelectedSurfaceId(fixture.request.building.surfaces[0].id); // open the stack editor too -- maximal content

const container = document.getElementById('container');
const root = createRoot(container);
root.render(React.createElement(SimpleForm));

setTimeout(() => {
  const measurement = document.getElementById('measurement');
  measurement.textContent = JSON.stringify({
    containerWidthPx: container.getBoundingClientRect().width,
    clientWidth: container.clientWidth,
    scrollWidth: container.scrollWidth,
    hasHorizontalOverflow: container.scrollWidth > container.clientWidth + 1,
  });
}, 150);
`,
        );
        writeFileSync(
          path.join(dir, 'fixture.json'),
          JSON.stringify({
            request: setWwr(baseRequest, 'S', 0.3),
            result: simulate(baseRequest),
            presetId: lehPreset.id,
            materials: catalogue,
          }),
        );
        writeFileSync(
          path.join(dir, 'index.html'),
          `<!doctype html><html><body style="margin:0">
<div id="container" style="width:400px;border:1px solid black;box-sizing:content-box"></div>
<div id="measurement">pending</div>
<script type="module" src="./bundle.js"></script>
</body></html>`,
        );

        const esbuildBin = path.resolve(__dirname, '../../../../node_modules/.bin/esbuild');
        await execFileP(esbuildBin, [
          entry,
          '--bundle',
          '--format=esm',
          '--jsx=automatic',
          '--loader:.json=json',
          '--define:process.env.NODE_ENV="production"',
          '--define:process.env.NEXT_PUBLIC_DEFAULT_LOCATION="leh"',
          '--define:process.env.NEXT_PUBLIC_DEFAULT_LOCALE="en"',
          `--outfile=${path.join(dir, 'bundle.js')}`,
        ]);

        const server = http.createServer((req, res) => {
          const p = path.join(dir, (req.url ?? '/') === '/' ? 'index.html' : (req.url as string).slice(1));
          if (!existsSync(p)) {
            res.writeHead(404);
            res.end();
            return;
          }
          const ext = path.extname(p);
          const contentType = ext === '.js' ? 'text/javascript' : ext === '.json' ? 'application/json' : 'text/html';
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(readFileSync(p));
        });
        await new Promise<void>((resolve) => server.listen(0, resolve));
        const port = (server.address() as { port: number }).port;

        const { stdout } = await execFileP(
          'google-chrome',
          ['--headless=new', '--disable-gpu', '--no-sandbox', '--dump-dom', `--virtual-time-budget=2000`, `http://localhost:${port}/`],
          { maxBuffer: 20 * 1024 * 1024 },
        );
        server.close();

        const match = stdout.match(/<div id="measurement">([^<]*)<\/div>/);
        expect(match).toBeTruthy();
        const measured = JSON.parse(match![1]!) as {
          containerWidthPx: number;
          clientWidth: number;
          scrollWidth: number;
          hasHorizontalOverflow: boolean;
        };
        expect(measured.hasHorizontalOverflow).toBe(false);
        console.log('T-44 test 10 evidence -- real headless-Chrome measurement at 400px:', measured);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    30_000,
  );

  it('test 11 -- every rendered input/select has a matching <label htmlFor>', () => {
    const markup = renderToStaticMarkup(React.createElement(SimpleForm));
    const ids = [...markup.matchAll(/<(?:input|select)[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    // React's `htmlFor` prop renders as the real DOM attribute `for="..."`.
    const labelledFor = new Set([...markup.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
    const missing = ids.filter((id) => !labelledFor.has(id));
    expect(missing).toEqual([]);
    console.log('T-44 test 11 evidence -- input/select ids checked:', ids.length, 'all labelled:', missing.length === 0);
  });

  it('test 12 -- with the database off, /api/materials still serves the full code catalogue', async () => {
    const prevUrl = process.env.DATABASE_URL;
    const stashKey = '__sheltersimDb' as const;
    const globalAny = globalThis as unknown as Record<string, { $disconnect?: () => Promise<void> } | undefined>;
    if (globalAny[stashKey]?.$disconnect) await globalAny[stashKey]!.$disconnect!().catch(() => {});
    delete globalAny[stashKey];
    delete process.env.DATABASE_URL;
    vi.resetModules();
    try {
      const route = await import('../../app/api/materials/route');
      const res = await route.GET();
      const body = (await res.json()) as { materials: Material[]; servedFrom: string };
      expect(res.status).toBe(200);
      expect(body.servedFrom).toBe('code');
      expect(body.materials.length).toBe(MATERIALS.length);
      console.log('T-44 test 12 evidence -- DB-off /api/materials item count:', body.materials.length, 'servedFrom:', body.servedFrom);
    } finally {
      if (prevUrl !== undefined) process.env.DATABASE_URL = prevUrl;
      else delete process.env.DATABASE_URL;
      if (globalAny[stashKey]?.$disconnect) await globalAny[stashKey]!.$disconnect!().catch(() => {});
      delete globalAny[stashKey];
      vi.resetModules();
    }
  });
});

describe('T-44 requestOps: pure logic behind every control', () => {
  it('setWallMaterial / setRoofMaterial / setFloorMaterial change only their own surfaces', () => {
    const next = setWallMaterial(baseRequest, 'stoneMasonryGranite', catalogue);
    expect(currentWallMaterialId(next.building)).toBe('stoneMasonryGranite');
    expect(currentRoofMaterialId(next.building)).toBe(currentRoofMaterialId(baseRequest.building));
    expect(currentFloorMaterialId(next.building)).toBe(currentFloorMaterialId(baseRequest.building));
    expect(next.materials.stoneMasonryGranite).toBeDefined();
    expect(() => simulate(next)).not.toThrow();
  });

  it('setGlazingType updates every window and rebuilds the glazing record', () => {
    const next = setGlazingType(baseRequest, 'tripleGlazing');
    expect(next.building.windows.every((w) => w.glazingId === 'tripleGlazing')).toBe(true);
    expect(next.glazings.tripleGlazing).toBeDefined();
    expect(() => simulate(next)).not.toThrow();
  });

  it('setWwr resizes a window proportionally to its wall and never exceeds it', () => {
    const req = setWwr(baseRequest, 'S', 0.4);
    const wwr = currentWwr(req.building, 'S');
    expect(wwr).toBeCloseTo(0.4, 5);
    const zero = setWwr(req, 'S', 0);
    expect(currentWwr(zero.building, 'S')).toBe(0);
    expect(() => simulate(req)).not.toThrow();
  });

  it('rebuildMaterialsRecord / rebuildGlazingsRecord never leave a used id unresolved', () => {
    const materials = rebuildMaterialsRecord(baseRequest.building, catalogue);
    for (const s of baseRequest.building.surfaces) {
      for (const l of s.construction) expect(materials[l.materialId]).toBeDefined();
    }
    const glazings = rebuildGlazingsRecord(baseRequest.building);
    for (const w of baseRequest.building.windows) expect(glazings[w.glazingId]).toBeDefined();
  });

  it('date control: isoDateToDayOfYear / dayOfYearToIsoDate round-trip, and slicing keeps the chosen day at index 0', () => {
    expect(isoDateToDayOfYear('2023-01-15')).toBe(15);
    expect(dayOfYearToIsoDate(15)).toBe('2023-01-15');
    expect(isoDateToDayOfYear(dayOfYearToIsoDate(200))).toBe(200);

    const full = tmyById('leh'); // real bundled full-year series, 8760 hourly points
    const sliced = sliceWeatherToDay(full, 200, 1);
    expect(sliced.startDayOfYear).toBe(200);
    // index 0 of the slice is hour 0 of day 200 in the full series.
    const fullIdx = (200 - full.startDayOfYear) * 24;
    expect(sliced.T_amb[0]).toBeCloseTo(full.T_amb[fullIdx]!, 9);
    expect(sliced.T_amb.length).toBeGreaterThanOrEqual(24);

    const requestOnDay200: SimulationRequest = { ...baseRequest, weather: sliced };
    const result = simulate(requestOnDay200);
    expect(Number.isFinite(result.kpis.tempAt0600)).toBe(true);
  });

  it('TMY_LOCATIONS / GLAZINGS summaries match the real catalogues (names + ids) so no id drifts silently', () => {
    for (const loc of TMY_LOCATIONS) {
      expect(['leh', 'kargil', 'drass', 'nubra', 'jaisalmer']).toContain(loc.id);
    }
    for (const g of GLAZING_SUMMARIES) {
      const real = glazingById(g.id);
      expect(g.U).toBeCloseTo(real.U, 9);
      expect(g.SHGC).toBeCloseTo(real.SHGC, 9);
    }
  });
});
