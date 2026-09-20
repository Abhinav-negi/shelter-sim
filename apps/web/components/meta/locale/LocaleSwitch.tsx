'use client';

// apps/web/components/meta/locale/LocaleSwitch.tsx
//
// T-52(d): the locale switch. Importing `./aggregator` (a side effect) is
// what guarantees every registered messages.ts module has run before this
// renders -- see aggregator.ts's own header for why that indirection exists.

import React from 'react';
import { useStore, actions } from '../../../lib/store';
import { t, type Locale } from '../../../lib/i18n';
import './aggregator';

const LOCALES: Locale[] = ['en', 'hi'];

export function LocaleSwitch() {
  const { locale } = useStore();
  return (
    <div data-testid="locale-switch">
      <label htmlFor="locale-switch-select">{t('meta.locale.label', locale)}</label>
      <select
        id="locale-switch-select"
        data-testid="locale-switch-select"
        value={locale}
        onChange={(e) => actions.setLocale(e.target.value as Locale)}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {t(`meta.locale.${l}`, locale)}
          </option>
        ))}
      </select>
    </div>
  );
}
