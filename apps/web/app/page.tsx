// apps/web/app/page.tsx
//
// Server Component, deliberately NOT 'use client'. `/` has no content of its
// own any more -- the app now has two real destinations, `/setup` and
// `/results` (see `app/(workspace)/`), each of which does its own
// server-side default-preset resolution via `app/lib/resolveInitialState.ts`
// so it works standalone on a direct URL hit. `/` just sends a first-time
// visitor to the more useful of the two.

import { redirect } from 'next/navigation';

// `@shelter/data` (via the externals workaround in `next.config.mjs`) is an
// awaited dynamic `import()` at runtime -- Next's build-time static-page
// worker sandbox does not resolve that reliably (observed: it hangs and
// times out after 3 retries during `next build`'s "Generating static pages"
// step). Rendering on every request instead of prerendering at build time
// sidesteps that sandbox entirely. `/setup` and `/results` carry the same
// `dynamic = 'force-dynamic'` for the same reason.
export const dynamic = 'force-dynamic';

export default function Page(): never {
  redirect('/results');
}
