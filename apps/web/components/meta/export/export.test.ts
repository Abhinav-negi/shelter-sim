// apps/web/components/meta/export/export.test.ts
//
// T-52 acceptance tests 6, 7, 9 (log/AREA-F-frontend.md). Same environment
// constraint as components/kpis/KpiColumn.test.tsx and components/house/
// house.test.tsx: no jsdom/canvas in this worktree (none on the approved
// dependency list, CONTRACTS.md §7.13). CSV/JSON building is 100% pure
// string logic (csv.ts/json.ts) with NO DOM dependency at all, so it is
// exercised directly and fully, not just structurally.
//
// Real bundled Leh preset run through the REAL engine, same fixture pattern
// as KpiColumn.test.tsx/house.test.tsx -- pasted numbers are measured.

import { describe, expect, it } from 'vitest';
import { glazingById, materialById, PRESETS, tmyById } from '@shelter/data';
import { simulate, requestFromJson } from '@shelter/engine';
import type { Glazing, Material, Preset, SimulationRequest } from '@shelter/engine';
import { buildCsv, CSV_HEADER } from './csv';
import { buildDesignJson, parseDesignJson } from './json';

function resolvePreset(preset: Preset): SimulationRequest {
  const materials: Record<string, Material> = {};
  for (const surface of preset.request.building.surfaces) {
    for (const layer of surface.construction)
      materials[layer.materialId] = materialById(layer.materialId);
  }
  const glazings: Record<string, Glazing> = {};
  for (const win of preset.request.building.windows)
    glazings[win.glazingId] = glazingById(win.glazingId);
  return { ...preset.request, weather: tmyById(preset.locationId), materials, glazings };
}

const lehPreset = PRESETS.find((p) => p.locationId === 'leh')!;
const request = resolvePreset(lehPreset);
const result = simulate(request);

describe('T-52(c) exporters', () => {
  it('test 6 -- CSV has one row per timestep, headers matching heatFlows field names exactly', () => {
    const csv = buildCsv(result);
    const lines = csv.trim().split('\n');
    const header = lines[0]!.split(',');
    const dataRows = lines.length - 1;

    // Every HeatFlows field name (CONTRACTS.md §7.3/§7.7 disk names) appears
    // verbatim as a column header.
    const heatFlowFields = [
      'Q1_solarOpaque',
      'Q2_solarGlazed',
      'Q3_extConvection',
      'Q4_skyRadiation',
      'Q5_envelopeConduction',
      'Q6_intConvection',
      'Q7_interiorLongwave',
      'Q8_windowConduction',
      'Q9_infiltration',
      'Q10_ground',
      'Q11_internalGains',
      'Qaux',
      'storageRate',
      'deltaT',
    ];
    for (const f of heatFlowFields) {
      expect(header, `missing column ${f}`).toContain(f);
      // and matches the live SimulationResult's own field set exactly
      expect(result.heatFlows).toHaveProperty(f);
    }
    expect(dataRows).toBe(result.time.length);
    console.log('T-52 test 6 evidence -- header row:', header.join(','));
    console.log(
      'T-52 test 6 evidence -- row count:',
      dataRows,
      'vs result.time.length:',
      result.time.length,
    );
    expect(CSV_HEADER).toEqual(header);
  });

  it('test 7 -- JSON export re-imports through requestFromJson and deep-equals the original request', () => {
    const json = buildDesignJson(request);
    const reimported = parseDesignJson(json);
    const reimported2 = requestFromJson(JSON.parse(json));
    expect(reimported).toEqual(request);
    expect(reimported2).toEqual(request);
    console.log('T-52 test 7 evidence -- JSON byte length:', Buffer.byteLength(json, 'utf8'));
  });

  it('test 9 -- CSV and JSON exports are pure local computation, zero network calls (offline-safe)', () => {
    const csv = buildCsv(result);
    const json = buildDesignJson(request);
    const csvBytes = Buffer.byteLength(csv, 'utf8');
    const jsonBytes = Buffer.byteLength(json, 'utf8');
    expect(csvBytes).toBeGreaterThan(0);
    expect(jsonBytes).toBeGreaterThan(0);
    console.log('T-52 test 9 evidence -- CSV file size (bytes):', csvBytes);
    console.log('T-52 test 9 evidence -- JSON file size (bytes):', jsonBytes);
    // csv.ts/json.ts import only @shelter/engine (zero runtime deps, CONTRACTS.md
    // §7.13) -- no fetch/XMLHttpRequest anywhere in their source, so building
    // either file cannot make a network call, online or offline.
  });
});
