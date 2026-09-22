'use client';

// apps/web/app/(workspace)/workspace-shell.tsx
//
// The ONE hydration point for the whole app now: `layout.tsx` (a Server
// Component) resolves the default preset once and hands it here. The lazy
// useState initializer runs synchronously in THIS component's own render,
// before React renders any of its children -- including `OfflineBanner`/
// `LocaleSwitch` rendered right below, both of which call `useStore()`
// unconditionally and throw if hydrateStore() hasn't run yet. Hydrating
// here (the common ancestor) instead of separately per page is what
// guarantees that ordering for every route, including a direct hit on
// /setup or /compare (previously each page tried to hydrate itself, but
// since OfflineBanner/LocaleSwitch live in the *layout*, a sibling
// ancestor, they rendered first and crashed -- this fixes it at the root
// instead of patching every call site).

import { useState, type ReactNode } from 'react';
import type { SimulationRequest, SimulationResult } from '@shelter/engine';
import { hydrateStore } from '../../lib/store';
import { OfflineBanner, LocaleSwitch } from '../../components/meta';
import { PrimaryNav } from '../../components/nav/PrimaryNav';

export interface WorkspaceShellProps {
  initialRequest: SimulationRequest;
  initialResult: SimulationResult;
  initialPresetId: string;
  children: ReactNode;
}

export function WorkspaceShell({
  initialRequest,
  initialResult,
  initialPresetId,
  children,
}: WorkspaceShellProps) {
  useState(() => {
    hydrateStore({ request: initialRequest, result: initialResult, presetId: initialPresetId });
    return null;
  });

  return (
    <>
      <OfflineBanner />
      <PrimaryNav right={<LocaleSwitch />} />
      {children}
    </>
  );
}
