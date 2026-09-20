// apps/web/components/meta/export/json.ts
//
// T-52(c) "the design as shareable JSON". Uses the engine's OWN
// requestToJson/requestFromJson (packages/engine/src/serialise.ts, exported
// off @shelter/engine's public barrel) rather than `JSON.stringify` directly
// on a `SimulationRequest` -- a raw `Float64Array` does not round-trip
// through `JSON.stringify`/`JSON.parse` (it serialises as `{}`), which is
// exactly the bug `requestToJson` exists to prevent (CONTRACTS.md §7.6).

import { requestFromJson, requestToJson, type SimulationRequest } from '@shelter/engine';

/** Pretty JSON string of a design, re-importable through `requestFromJson`
 * (acceptance test 7: parse it back and it must deep-equal the original). */
export function buildDesignJson(request: SimulationRequest): string {
  return JSON.stringify(requestToJson(request), null, 2);
}

/** The re-import half of the round trip -- throws EngineError('DATA_SCHEMA_MISMATCH')
 * on a malformed file, exactly like the /api/designs POST route (T-41) does. */
export function parseDesignJson(json: string): SimulationRequest {
  return requestFromJson(JSON.parse(json));
}
