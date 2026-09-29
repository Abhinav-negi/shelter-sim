// "Run on ANSYS" placeholder (A1.md): shared by the Studio header and the
// Dashboard's design rows. Ticks every second, H:MM:SS elapsed since
// `startedAt`, hours unbounded (a real run can run past 99 hours).
import { useEffect, useState } from 'react';
import { Button } from './ui';

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function AnsysTimer({
  startedAt,
  onCancel,
  cancelling,
}: {
  startedAt: string; // ISO
  onCancel: () => void;
  cancelling?: boolean;
}) {
  const startMs = new Date(startedAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
      <span className="font-mono tabular-nums">ANSYS running · {formatElapsed(now - startMs)}</span>
      <Button variant="ghost" onClick={onCancel} disabled={cancelling} className="px-2 py-1 text-xs">
        {cancelling ? 'Cancelling…' : 'Cancel'}
      </Button>
    </span>
  );
}
