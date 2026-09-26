// Results: "what happened, why, how the design performed" for the latest
// preview (F3.md condition 4). Pure props in — Studio.tsx owns the debounced
// preview request and passes its state down.
import type { PreviewResponse } from '@shelter/studio-server';
import { Button } from '../components/ui';
import { explain, type Severity } from './explain';
import { HeatFlowChart } from './HeatFlowChart';
import { Kpis } from './Kpis';
import { TemperatureChart } from './TemperatureChart';
import type { ResultJson } from './types';

export type PreviewStatus = 'idle' | 'pending' | 'loading' | 'done' | 'error';

export interface ResultsPanelProps {
  status: PreviewStatus;
  data: PreviewResponse | null;
  error: string | null;
  onRetry: () => void;
}

const severityBorder: Record<Severity, string> = {
  good: 'border-hairline',
  warn: 'border-thermal-warm',
  danger: 'border-thermal-hottest',
};

function Insights({ kpis }: { kpis: PreviewResponse['kpis'] }) {
  const insights = explain(kpis);
  return (
    <div className="flex flex-col gap-2">
      {insights.map((insight, i) => (
        <p key={i} className={`border-l-2 py-0.5 pl-3 text-sm text-ink ${severityBorder[insight.severity]}`}>
          {insight.text}
        </p>
      ))}
    </div>
  );
}

function StatusLine({
  status,
  hasData,
  error,
  onRetry,
}: {
  status: PreviewStatus;
  hasData: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (status === 'error') {
    return (
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-thermal-hottest">
          {hasData ? 'Preview update failed — showing the last successful result.' : 'Preview failed.'} {error}
        </span>
        <Button variant="secondary" onClick={onRetry} className="shrink-0 px-2 py-1 text-xs">
          Retry
        </Button>
      </div>
    );
  }
  if (status === 'pending') return <p className="text-xs text-ink-muted">Preparing…</p>;
  if (status === 'loading') {
    return <p className="text-xs text-ink-muted">{hasData ? 'Updating…' : 'Running thermal model…'}</p>;
  }
  return null;
}

export function ResultsPanel({ status, data, error, onRetry }: ResultsPanelProps) {
  if (!data) {
    return (
      <div className="px-4 py-6">
        <StatusLine status={status} hasData={false} error={error} onRetry={onRetry} />
      </div>
    );
  }

  const result = data.result as ResultJson;

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <StatusLine status={status} hasData error={error} onRetry={onRetry} />
      <Insights kpis={data.kpis} />
      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Indoor vs outdoor — 24 h
        </h3>
        <TemperatureChart result={result} />
      </section>
      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">Heat-flow pathways</h3>
        <HeatFlowChart result={result} />
      </section>
      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">Key figures</h3>
        <Kpis kpis={data.kpis} />
      </section>
      {data.weatherProvenance ? (
        <p className="text-xs text-ink-muted">{data.weatherProvenance.notes.join(' ')}</p>
      ) : null}
    </div>
  );
}
