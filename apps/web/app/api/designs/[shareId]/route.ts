// apps/web/app/api/designs/[shareId]/route.ts
//
// T-41: GET /api/designs/[shareId] -- resolve a share link (log/AREA-E-server-tier.md).
//
// loadDesign() (T-32) already collapses "unknown id", "expired id" and
// "no database" into a single null (see designs.ts's own header comment) --
// exactly the "must not distinguish between them" contract this route's own
// acceptance tests ask for. This handler adds nothing on top of that null
// check; it must not, or it would reintroduce the distinction T-32 deliberately
// erased.

import { NextResponse } from 'next/server';
import { requestToJson } from '@shelter/engine';
import { loadDesign } from '../../../../lib/repo/designs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ shareId: string }> },
): Promise<NextResponse> {
  const { shareId } = await params;

  const design = await loadDesign(shareId);
  if (design === null) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'design not found' }, { status: 404 });
  }

  // requestToJson is the one sanctioned Float64Array -> plain-array boundary
  // (CONTRACTS.md §7.14); returning `design` directly would let
  // NextResponse.json's JSON.stringify serialise each Float64Array as an
  // object of numeric keys instead of an array, breaking the round trip.
  return NextResponse.json(requestToJson(design), { status: 200 });
}
