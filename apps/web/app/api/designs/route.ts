// apps/web/app/api/designs/route.ts
//
// T-41: POST /api/designs -- create a share link (log/AREA-E-server-tier.md).
//
// DB-OFF CONTRACT (LOG.md global rule 18): sharing is a share layer, never a
// dependency. saveDesign() (T-32) already folds "no database" and "database
// unreachable" into a single `null`, so this handler cannot and must not try
// to tell those two apart -- both surface as 503 SHARE_UNAVAILABLE with the
// verbatim download-instead message the UI shows.
//
// Validation happens HERE, via requestFromJson, before saveDesign is ever
// called -- this is what lets a schema failure (422) be told apart from a
// database failure (503): saveDesign() also validates internally (defence in
// depth, matching its own doc comment), but by the time it is called this
// handler already knows the request is well-formed, so a null back from it
// can only mean "no database".

import { NextResponse, type NextRequest } from 'next/server';
import { EngineError, requestFromJson, type SimulationRequest } from '@shelter/engine';
import { saveDesign } from '../../../lib/repo/designs';

interface PostBody {
  request?: unknown;
  label?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ code: 'INVALID_INPUT', message: 'request body must be JSON' }, { status: 400 });
  }

  let validated: SimulationRequest;
  try {
    validated = requestFromJson(body?.request);
  } catch (err) {
    if (err instanceof EngineError) {
      // requestFromJson only ever throws DATA_SCHEMA_MISMATCH (T-06), but the
      // task prompt allows for an engine validator rejecting with a different
      // code (INVALID_INPUT) -- mapped to 400 here rather than assumed away.
      const status = err.code === 'DATA_SCHEMA_MISMATCH' ? 422 : 400;
      return NextResponse.json({ code: err.code, message: err.message }, { status });
    }
    throw err;
  }

  const label = typeof body?.label === 'string' ? body.label : undefined;

  let saved: { shareId: string } | null;
  try {
    saved = await saveDesign(validated, label);
  } catch (err) {
    // saveDesign/withDb already swallow database errors into null; a throw
    // here is a genuine bug elsewhere, not a DB-off condition. Surface it as
    // JSON, never let a default Next error page (HTML) escape (acceptance
    // test 12).
    return NextResponse.json(
      { code: 'INTERNAL', message: 'internal error while saving the design' },
      { status: 500 },
    );
  }

  if (saved === null) {
    return NextResponse.json(
      { code: 'SHARE_UNAVAILABLE', message: 'Sharing needs the server. Download the design as a file instead.' },
      { status: 503 },
    );
  }

  const url = new URL(`/api/designs/${saved.shareId}`, req.nextUrl.origin).toString();
  return NextResponse.json({ shareId: saved.shareId, url }, { status: 201 });
}
