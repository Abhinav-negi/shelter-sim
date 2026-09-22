'use client';

// apps/web/app/(workspace)/setup/page.tsx
//
// The store is already hydrated by the time this renders -- see
// `app/(workspace)/workspace-shell.tsx`, the one hydration point shared by
// every route in this layout.

import { SimpleForm } from '../../../components/inputs';
import { AdvancedPanel } from '../../../components/advanced/AdvancedPanel';

export default function SetupPage() {
  return (
    <div className="page">
      <h1>Setup</h1>
      <SimpleForm />
      <AdvancedPanel />
    </div>
  );
}
