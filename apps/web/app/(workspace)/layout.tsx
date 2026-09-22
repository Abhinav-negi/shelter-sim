// apps/web/app/(workspace)/layout.tsx
//
// Server Component -- the ONE place that resolves the default preset for
// every route under /setup, /results, /compare (see
// `app/lib/resolveInitialState.ts` for why this has to run server-side).
// Hands it to `WorkspaceShell`, the client boundary that hydrates the store
// before rendering the offline banner / nav / locale switch / whichever
// page is active. This also means individual pages no longer need their
// own resolution + hydration dance: they're plain client components now.

import { resolveInitialState } from '../lib/resolveInitialState';
import { WorkspaceShell } from './workspace-shell';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { request, result, presetId } = resolveInitialState();
  return (
    <WorkspaceShell initialRequest={request} initialResult={result} initialPresetId={presetId}>
      {children}
    </WorkspaceShell>
  );
}
