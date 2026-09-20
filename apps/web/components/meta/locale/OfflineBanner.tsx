'use client';

// apps/web/components/meta/locale/OfflineBanner.tsx
//
// T-52(d): "When store.online === false, show 'Offline — showing 1
// scenario, AI advice unavailable.' -- honest, specific, and never silently
// pretending to be fully functional." Acceptance test 10's literal English
// string is the DEFAULT-locale value of `meta.offline.banner` in
// `../messages.ts`; it is asserted verbatim (not just "some banner text")
// so a future edit to the wording is a deliberate, visible change, not a
// silent drift.

import React from 'react';
import { useStore } from '../../../lib/store';
import { t } from '../../../lib/i18n';
import './aggregator';

export function OfflineBanner() {
  const { online, locale } = useStore();
  if (online) return null;
  return (
    <div role="status" data-testid="offline-banner" data-print-hide="true">
      {t('meta.offline.banner', locale)}
    </div>
  );
}
