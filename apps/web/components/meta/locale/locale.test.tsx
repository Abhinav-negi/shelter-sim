// apps/web/components/meta/locale/locale.test.tsx
//
// T-52 acceptance tests 10, 11, 12 (log/AREA-F-frontend.md). Same
// no-jsdom/no-testing-library environment as components/kpis/
// KpiColumn.test.tsx -- DOM structure verified via renderToStaticMarkup.

import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { glazingById, materialById, PRESETS, tmyById } from '@shelter/data';
import { simulate } from '@shelter/engine';
import type { Glazing, Material, Preset, SimulationRequest } from '@shelter/engine';
import { actions, hydrateStore } from '../../../lib/store';
import { t, registerMessages } from '../../../lib/i18n';
import { OfflineBanner } from './OfflineBanner';
import { LocaleSwitch } from './LocaleSwitch';

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
hydrateStore({ request, result, presetId: lehPreset.id });

describe('T-52(d) offline banner and locale switch', () => {
  it('test 10 -- offline banner shows the exact literal text when store.online is false', () => {
    actions.setOnline(false);
    const html = renderToStaticMarkup(React.createElement(OfflineBanner));
    console.log('T-52 test 10 evidence -- rendered offline banner html:', html);
    expect(html).toContain('Offline — showing 1 scenario, AI advice unavailable.');
    expect(html).toContain('data-testid="offline-banner"');
    actions.setOnline(true);
    const htmlOnline = renderToStaticMarkup(React.createElement(OfflineBanner));
    expect(htmlOnline).toBe('');
    console.log(
      'T-52 test 10 evidence -- online again, banner renders nothing:',
      JSON.stringify(htmlOnline),
    );
  });

  it("test 11 (PARTIAL -- scoped to this task's own components) -- switching to Hindi changes every label this task renders; no key renders as raw text", () => {
    actions.setLocale('hi');
    const bannerWasOnline = true;
    actions.setOnline(!bannerWasOnline); // force banner visible to check its Hindi text too
    const bannerHtml = renderToStaticMarkup(React.createElement(OfflineBanner));
    const switchHtml = renderToStaticMarkup(React.createElement(LocaleSwitch));
    console.log('T-52 test 11 evidence -- Hindi offline banner:', bannerHtml);
    console.log('T-52 test 11 evidence -- Hindi locale switch:', switchHtml);
    expect(bannerHtml).toContain('ऑफ़लाइन');
    expect(switchHtml).toContain('भाषा');
    expect(switchHtml).toContain('हिन्दी');
    // no raw key renders anywhere
    expect(bannerHtml).not.toContain('meta.offline.banner');
    expect(switchHtml).not.toContain('meta.locale.label');
    actions.setOnline(true);
    actions.setLocale('en');
  });

  it('test 12 -- a missing translation falls back to English, never to the raw key', () => {
    // A key registered ONLY for 'en' -- exactly the "partially translated"
    // case lib/i18n.ts's own `t()` fallback (registry[locale] ?? registry.en
    // ?? key) exists to handle.
    registerMessages('en', { 'meta.__test.onlyEnglish': 'English-only fallback text' });
    const hiValue = t('meta.__test.onlyEnglish', 'hi');
    const missingEverywhere = t('meta.__test.totally.unregistered', 'hi');
    console.log('T-52 test 12 evidence -- hi lookup of an en-only key:', hiValue);
    console.log(
      'T-52 test 12 evidence -- hi lookup of a key registered nowhere:',
      missingEverywhere,
    );
    expect(hiValue).toBe('English-only fallback text');
    expect(hiValue).not.toBe('meta.__test.onlyEnglish');
    // A key that exists NOWHERE still never renders undefined/blank -- it
    // renders the key itself (lib/i18n.ts's own documented contract), which
    // is the honest "developer left a key unregistered" signal, distinct
    // from "translation missing but English exists".
    expect(missingEverywhere).toBe('meta.__test.totally.unregistered');
  });
});
