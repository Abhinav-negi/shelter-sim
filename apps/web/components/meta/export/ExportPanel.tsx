'use client';

// apps/web/components/meta/export/ExportPanel.tsx
//
// T-52(c): CSV of every timestep/term, the design as shareable JSON, a share
// link via T-41 when the database is up, and a PDF report via the browser's
// own print pipeline. Reads `useStore()` (read-only) for `request`/`result`/
// `online`; never mutates it beyond the store's own existing `setShareId`
// action.

import React, { useState } from 'react';
import { useStore, actions } from '../../../lib/store';
import { t } from '../../../lib/i18n';
import '../messages';
import { buildCsv } from './csv';
import { buildDesignJson } from './json';
import { downloadTextFile } from './download';
import { triggerPrint } from './print';
import { shareDesign } from './share';

export function ExportPanel() {
  const { request, result, online, shareId, locale } = useStore();
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  function onDownloadCsv() {
    if (!result) return;
    downloadTextFile('sheltersim-timeseries.csv', buildCsv(result), 'text/csv');
  }

  function onDownloadJson() {
    downloadTextFile('sheltersim-design.json', buildDesignJson(request), 'application/json');
  }

  async function onShare() {
    setSharing(true);
    setShareMessage(null);
    try {
      const res = await shareDesign(request);
      if (res.ok) {
        actions.setShareId(res.shareId);
        setShareMessage(res.url);
      } else {
        setShareMessage(res.message);
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <div data-testid="export-panel">
      <h2>{t('meta.export.title', locale)}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button type="button" data-testid="export-csv" onClick={onDownloadCsv} disabled={!result}>
          {t('meta.export.csv', locale)}
        </button>
        {!result && <span data-testid="export-csv-hint">{t('meta.export.noResult', locale)}</span>}

        <button type="button" data-testid="export-json" onClick={onDownloadJson}>
          {t('meta.export.json', locale)}
        </button>

        <button
          type="button"
          data-testid="export-share"
          data-print-hide="true"
          onClick={onShare}
          disabled={!online || sharing}
          title={!online ? t('meta.export.shareUnavailable', locale) : undefined}
        >
          {t('meta.export.share', locale)}
        </button>
        {!online && (
          <span data-testid="export-share-offline-reason">
            {t('meta.export.shareUnavailable', locale)}
          </span>
        )}
        {shareMessage && <span data-testid="export-share-result">{shareMessage}</span>}
        {shareId && <span data-testid="export-share-id">{shareId}</span>}

        <button
          type="button"
          data-testid="export-print"
          data-print-hide="true"
          onClick={triggerPrint}
        >
          {t('meta.export.print', locale)}
        </button>
      </div>
    </div>
  );
}
