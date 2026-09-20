// apps/web/components/meta/export/share.ts
//
// T-52(c) "a share link via T-41 when the database is up". POSTs to
// /api/designs (T-41, app/api/designs/route.ts), which already folds
// "no database" and "database unreachable" into one 503 SHARE_UNAVAILABLE
// with a verbatim download-instead message (LOG.md global rule 18: the
// database is a cache and share layer, never a dependency). This module
// only calls that contract; it never re-derives share-link logic.

import { requestToJson, type SimulationRequest } from '@shelter/engine';

export interface ShareResult {
  ok: true;
  shareId: string;
  url: string;
}
export interface ShareUnavailable {
  ok: false;
  message: string;
}

/** Offline-aware by construction: the caller (ExportPanel) never invokes
 * this when `store.online === false` -- the share button is disabled with
 * an explanation instead (acceptance test 10), so this function does not
 * need its own offline branch. */
export async function shareDesign(
  request: SimulationRequest,
  label?: string,
): Promise<ShareResult | ShareUnavailable> {
  const res = await fetch('/api/designs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ request: requestToJson(request), label }),
  });
  if (res.status === 503) {
    const body = (await res.json()) as { message: string };
    return { ok: false, message: body.message };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ message: `share failed (${res.status})` }))) as {
      message: string;
    };
    return { ok: false, message: body.message };
  }
  const body = (await res.json()) as { shareId: string; url: string };
  return { ok: true, shareId: body.shareId, url: body.url };
}
