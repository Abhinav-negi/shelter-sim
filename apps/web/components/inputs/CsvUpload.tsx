'use client';

// apps/web/components/inputs/CsvUpload.tsx
//
// The user-CSV weather upload control (T-44's prompt, not one of the ten
// first-paint controls -- see SimpleForm.tsx's control-count comment). Wired
// to this directory's own `csv.ts` parser (see that file's header for why it
// is a local mirror of T-25's parser rather than an import of it). A
// malformed file's errors are shown per-row and `onWeatherParsed` is never
// called for it, so the caller's previous weather is left untouched --
// acceptance test 8.

import React, { useRef, useState } from 'react';
import type { WeatherSeries } from '@shelter/engine';
import { type CsvRowError, parseWeatherCsv } from './csv';

export interface CsvUploadProps {
  startDayOfYear: number;
  site: { latitude: number; longitude: number; standardMeridian: number };
  onWeatherParsed: (series: WeatherSeries) => void;
}

export function CsvUpload({ startDayOfYear, site, onWeatherParsed }: CsvUploadProps) {
  const [rowErrors, setRowErrors] = useState<CsvRowError[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputId = 'csv-upload-input';
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    const text = await file.text();
    const outcome = parseWeatherCsv(text, { startDayOfYear, site });
    if (outcome.rowErrors.length > 0 || !outcome.series) {
      setRowErrors(outcome.rowErrors);
      return; // previous weather left untouched -- nothing is dispatched
    }
    setRowErrors([]);
    onWeatherParsed(outcome.series);
  }

  return (
    <div data-testid="csv-upload">
      <label htmlFor={inputId}>
        Or upload your own weather CSV (columns: T_amb_C, GHI, v_wind)
      </label>
      <input
        id={inputId}
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {fileName && rowErrors.length === 0 && (
        <p style={{ fontSize: 12, color: '#166534' }}>Loaded {fileName}.</p>
      )}
      {rowErrors.length > 0 && (
        <div role="alert" data-testid="csv-errors" style={{ fontSize: 12, color: '#991b1b' }}>
          <p>
            {fileName} could not be used ({rowErrors.length} problem
            {rowErrors.length === 1 ? '' : 's'}). The weather already loaded is unchanged.
          </p>
          <ul>
            {rowErrors.slice(0, 20).map((e, i) => (
              <li key={i} data-testid="csv-error-row">
                Row {e.row}, column &quot;{e.column}&quot;: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
