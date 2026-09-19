// apps/web/components/kpis/KpiColumn.test.tsx
//
// T-51's 12 acceptance tests (log/AREA-F-frontend.md). This environment has
// no jsdom/happy-dom and no @testing-library (neither is on the approved
// dependency list, CONTRACTS.md §7.13, and neither is installed in this
// worktree) -- the same constraint `components/house/house.test.tsx`
// documents. This file follows its precedent: DOM STRUCTURE (testids,
// labels, values, presence/absence of elements) is verified via
// `react-dom/server`'s `renderToStaticMarkup`, which runs in plain Node, no
// real DOM required, and the 400px layout rule (test 11) is verified by
// reading the CSS module's own source, the only way to check a media query
// exists without a real viewport to resize.
//
// Tests 1, 2, 3, 4, 6, 7 and 8 run the REAL bundled Leh preset through the
// REAL engine (`simulate()`), the same fixture pattern
// `apps/web/components/house/house.test.tsx` and
// `apps/web/components/grid/SurvivalGrid.test.ts` both use, so the numbers
// pasted into this task's Evidence block are measured, not synthetic.
// Tests 2/3 (the badge) and 4 (the safety warning) additionally need a
// *deliberately broken* `meta` -- built by cloning a real result and
// overriding just the field under test, exactly as this task's own
// acceptance test 3 asks for ("demonstrated with a deliberately broken
// fixture").

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { glazingById, materialById, PRESETS, tmyById } from '@shelter/data';
import { simulate, T0 } from '@shelter/engine';
import type { Glazing, Material, Preset, SimulationRequest, SimulationResult } from '@shelter/engine';
import { actions, hydrateStore } from '../../lib/store';
import { formatTempC } from '../../lib/units';
import { badgeFor } from './badge';
import { deltaVsAmbientAt0600 } from './cards';
import { KpiColumn } from './KpiColumn';

// ---- fixture: the real bundled Leh preset, resolved exactly the way
// `app/page.tsx` does (mirrors house.test.tsx's `resolvePreset`, inlined
// since `app/page.tsx` is off this task's allow-list to import from). ----
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
const request = resolvePreset(lehPreset);
const result = simulate(request);

hydrateStore({ request, result, presetId: lehPreset.id });

function render(): string {
  return renderToStaticMarkup(React.createElement(KpiColumn));
}

/** Extracts a card's VALUE text (not the outer card div, which would swallow
 * the label's own nested `</div>` on a naive non-greedy match). Cards render
 * their value in a dedicated `data-testid="<testId>-value"` leaf with no
 * nested elements, so the first closing `</div>` is unambiguous. */
function cardValueText(html: string, testId: string): string {
  const re = new RegExp(`data-testid="${testId}-value"[^>]*>([\\s\\S]*?)</div>`);
  const m = html.match(re);
  if (!m) throw new Error(`testid ${testId}-value not found`);
  return m[1]!.replace(/<[^>]+>/g, '');
}

describe('T-51 KPI column', () => {
  it('test 1 -- every §7.7 kpis field appears on a card with a unit and a plain-language label', () => {
    actions.setResult(result);
    const html = render();
    // §7.7's 14 scalar kpis fields (tempAt0600PerDay is optional/disk-only,
    // not in CONTRACTS.md's §7.7 listing, and is a per-day array, not a
    // single-value card -- excluded per CONTRACTS.md being authoritative).
    const expected: [string, string][] = [
      ['kpi-0600', formatTempC(result.kpis.tempAt0600)],
      ['kpi-hours-comfort', `${result.kpis.hoursInComfort.toFixed(1)} h`],
      ['kpi-aux', `${result.kpis.auxEnergyKWhPerDay.toFixed(2)} kWh/day`],
      ['kpi-fuel', `${result.kpis.keroseneEquivalentLitresPerYear.toFixed(1)} L/yr`],
      ['kpi-cost', `${result.kpis.costPerYearINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`],
      ['kpi-co2', `${result.kpis.co2EquivalentKgPerYear.toFixed(1)} kg/yr`],
      ['kpi-min', formatTempC(result.kpis.minIndoorTemp)],
      ['kpi-max', formatTempC(result.kpis.maxIndoorTemp)],
      ['kpi-mean', formatTempC(result.kpis.meanIndoorTemp)],
      ['kpi-swing', `${result.kpis.peakToPeakSwing.toFixed(1)} K`],
      ['kpi-decrement', `${result.kpis.decrementFactor.toFixed(3)} (dimensionless)`],
      ['kpi-lag', `${result.kpis.timeLagHours.toFixed(1)} h`],
      ['kpi-below5', `${result.kpis.hoursBelow5C.toFixed(1)} h`],
      ['kpi-freezing', `${result.kpis.hoursBelowFreezing.toFixed(1)} h`],
      // RH is present in the bundled Leh TMY, so this run's condensation
      // risk is a real number, not the null case (that's test 6).
      ['kpi-condensation', `${(result.kpis.condensationRiskHours ?? 0).toFixed(1)} h`],
    ];
    const found: Record<string, string> = {};
    for (const [testId, expectedValue] of expected) {
      found[testId] = cardValueText(html, testId);
      expect(html).toContain(`data-testid="${testId}"`);
      expect(found[testId]).toContain(expectedValue);
    }
    console.log('T-51 test 1 evidence -- rendered kpi cards vs §7.7 fields:', found);
    // every field has a unit or an explicit "(dimensionless)" label
    expect(found['kpi-decrement']).toContain('dimensionless');
  });

  it('test 2 -- the badge shows 0.020% for a stored residual of 0.0002', () => {
    const broken: SimulationResult = { ...result, meta: { ...result.meta, energyBalanceResidual: 0.0002 } };
    actions.setResult(broken);
    const html = render();
    const badge = badgeFor(0.0002);
    console.log('T-51 test 2 evidence -- stored residual 0.0002, rendered:', badge.text);
    expect(badge.text).toBe('0.020%');
    expect(html).toContain('0.020%');
    expect(html).toContain('data-status="ok"');
  });

  it('test 3 -- the badge turns red when the residual reaches 0.001 (deliberately broken fixture)', () => {
    const broken: SimulationResult = { ...result, meta: { ...result.meta, energyBalanceResidual: 0.001 } };
    actions.setResult(broken);
    const html = render();
    const badge = badgeFor(0.001);
    console.log('T-51 test 3 evidence -- stored residual 0.001, rendered text:', badge.text, 'status:', badge.ok ? 'ok(green)' : 'bad(red)');
    expect(badge.ok).toBe(false);
    expect(html).toContain('data-status="bad"');
    expect(html).not.toContain('data-status="ok"');
  });

  it('test 4/7 -- a design clamped by the ventilation floor shows the warning naming carbon monoxide; every meta.warnings entry is visible', () => {
    // achSchedule far below ACH_MIN (0.35) on every hour of the real Leh
    // request forces the engine's own safety-floor clamp
    // (packages/engine/src/index.ts's `achClampedBySafetyFloor`).
    const clampedRequest: SimulationRequest = {
      ...request,
      operation: { ...request.operation, achSchedule: request.operation.achSchedule.map(() => 0.05) },
    };
    const clampedResult = simulate(clampedRequest);
    actions.setResult(clampedResult);
    const html = render();

    const clampWarning = clampedResult.meta.warnings.find((w) => w.includes('carbon monoxide'));
    console.log('T-51 test 4 evidence -- warning text verbatim:', clampWarning);
    console.log('T-51 test 7 evidence -- meta.warnings count:', clampedResult.meta.warnings.length, 'rendered <li> count:', (html.match(/data-testid="kpi-warning"/g) ?? []).length);
    expect(clampWarning).toBeDefined();
    expect(clampWarning).toContain('carbon monoxide');
    expect(html).toContain(clampWarning);

    // every warning string is present, and the count matches exactly
    for (const w of clampedResult.meta.warnings) expect(html).toContain(w);
    const renderedCount = (html.match(/data-testid="kpi-warning"/g) ?? []).length;
    expect(renderedCount).toBe(clampedResult.meta.warnings.length);
  });

  it('test 5 -- the warning cannot be dismissed into invisibility: no dismiss affordance exists to exercise', () => {
    const clampedRequest: SimulationRequest = {
      ...request,
      operation: { ...request.operation, achSchedule: request.operation.achSchedule.map(() => 0.05) },
    };
    const clampedResult = simulate(clampedRequest);
    actions.setResult(clampedResult);
    const html = render();
    // There is no <button>, no dismiss/close control anywhere in this
    // component's markup -- the only "dismiss affordance" a user could try
    // to exercise does not exist, so the warning is structurally permanent.
    expect(html).not.toMatch(/<button/);
    expect(html).not.toMatch(/dismiss|close/i);
    expect(html).toContain('data-testid="kpi-warnings"');
  });

  it('test 6 -- condensationRiskHours === null renders as text, never "0 hours"', () => {
    // Destructure RH out entirely rather than setting it to `undefined` --
    // `exactOptionalPropertyTypes` (apps/web/tsconfig.json) treats an
    // explicit `undefined` value as distinct from an absent key for an
    // optional field.
    const { RH: _omittedRH, ...noRhWeather } = request.weather;
    const noRhResult = simulate({ ...request, weather: noRhWeather });
    console.log('T-51 test 6 evidence -- kpis.condensationRiskHours:', noRhResult.kpis.condensationRiskHours);
    expect(noRhResult.kpis.condensationRiskHours).toBeNull();
    actions.setResult(noRhResult);
    const html = render();
    const rendered = cardValueText(html, 'kpi-condensation');
    console.log('T-51 test 6 evidence -- rendered string:', rendered);
    expect(rendered).toBe('not available — no humidity data');
    expect(rendered).not.toContain('0 hours');
  });

  it('test 8 -- the 06:00 card uses the same formatter T-47\'s chart annotation must use (lib/units.ts is the only Celsius boundary)', () => {
    // T-47 (log/AREA-F-frontend.md) is still "[~]" claimed and not merged
    // into this worktree -- there is no chart component here to literally
    // diff against (rule 16: report, don't fabricate). What CAN be verified
    // honestly: CONTRACTS.md §7.1 makes `lib/units.ts` the ONLY file allowed
    // to convert Kelvin -> Celsius, so any correctly-built T-47 annotation
    // is required to call the same `formatTempC`/`toC` this card calls --
    // there is no second, independently-invented rounding rule available to
    // it. Precision equality therefore follows from the shared contract, not
    // from this test alone.
    actions.setResult(result);
    const html = render();
    const rendered = cardValueText(html, 'kpi-0600');
    const expected = formatTempC(result.kpis.tempAt0600);
    console.log('T-51 test 8 evidence -- kpi card rendered:', rendered, '| formatTempC(kpis.tempAt0600):', expected, '| T-47 chart: NOT PRESENT in this worktree (still [~]), see note above');
    expect(rendered).toContain(expected);
  });

  it('test 9 -- the column renders with result === null showing empty states, not NaN', () => {
    actions.setResult(null);
    const html = render();
    console.log('T-51 test 9 evidence -- rendered with null result:', html);
    expect(html).toContain('data-testid="kpi-column-empty"');
    expect(html).not.toContain('NaN');
  });

  it('test 12 -- every KPI shows its unit (°C, h, kWh/day, L/yr, kg/yr, ₹/yr, dimensionless)', () => {
    actions.setResult(result);
    const html = render();
    const units = ['°C', ' h', 'kWh', 'L/yr', 'kg/yr', '₹', 'dimensionless'];
    for (const u of units) expect(html).toContain(u);
  });
});

describe('T-51 cards.ts / badge.ts -- pure logic', () => {
  it('deltaVsAmbientAt0600 reads heatFlows.deltaT at the same sample tempAt0600 came from', () => {
    const delta = deltaVsAmbientAt0600(result);
    const idx = result.temperatures.indoorAir.indexOf(result.kpis.tempAt0600);
    console.log('T-51 evidence -- delta vs ambient at 06:00:', delta, 'K, idx', idx);
    expect(delta).not.toBeNull();
    expect(delta).toBeCloseTo(result.heatFlows.deltaT[idx]!, 9);
    expect(delta).toBeCloseTo(result.kpis.tempAt0600 - result.temperatures.ambient[idx]!, 6);
  });

  it('badgeFor: ok exactly below 0.001, not ok at or above it', () => {
    expect(badgeFor(0.0009999).ok).toBe(true);
    expect(badgeFor(0.001).ok).toBe(false);
    expect(badgeFor(0.002).ok).toBe(false);
  });
});

describe('T-51 acceptance test 10 -- no Celsius arithmetic in this directory', () => {
  it('no source file under components/kpis does its own Kelvin<->Celsius offset', () => {
    // The forbidden literal is built at runtime from the engine's own T0
    // constant, deliberately never spelled out as source text in this file:
    // acceptance test 10's grep runs over this whole directory too, and a
    // literal copy of the offset here would be exactly the defect it hunts
    // for (LOG.md global rule 5), even inside a comment.
    const kelvinOffset = String(T0);
    const files = ['KpiColumn.tsx', 'badge.ts', 'cards.ts'].map((f) => fileURLToPath(new URL(`./${f}`, import.meta.url)));
    for (const f of files) expect(readFileSync(f, 'utf8')).not.toContain(kelvinOffset);
  });
});

describe('T-51 acceptance test 11 -- 400px stacks to one column', () => {
  it('the CSS module collapses .grid to a single column at/under 480px (covers the 400px test point)', () => {
    const css = readFileSync(fileURLToPath(new URL('./KpiColumn.module.css', import.meta.url)), 'utf8');
    const mediaMatch = css.match(/@media \(max-width:\s*480px\)\s*{\s*\.grid\s*{\s*grid-template-columns:\s*1fr;/);
    console.log('T-51 test 11 evidence -- media query present:', !!mediaMatch);
    expect(mediaMatch).not.toBeNull();
  });
});
