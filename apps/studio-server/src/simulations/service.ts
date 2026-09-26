// apps/studio-server/src/simulations/service.ts — run + persist a
// simulation (condition 3), list/read (condition 4). Routes call these
// functions; no Mongoose calls in route handlers (P2 rules). No DB calls
// inside the design/simulation assembly either -- `assemble`/`fastPhysics`
// are pure (P1).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Types } from 'mongoose';
import { canonicalRequestHash, resultToJson } from '@shelter/engine';
import type { SimulationKpis } from '@shelter/engine';
import { prepareRequest } from '../design/prepare.js';
import type { WeatherProvenanceSummary } from '../weather/resolve.js';
import type { ShelterDesign } from '../design/types.js';
import { fastPhysics } from '../providers/index.js';
import { getOwnedDesignDoc, NotFoundError } from '../designs/service.js';
import { Simulation, type SimulationDoc } from './model.js';

// Same pattern as apps/web/lib/repo/runs.ts's ENGINE_VERSION: read from
// packages/engine/package.json at module load, never hardcoded.
function readEngineVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, '../../../../packages/engine/package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
  return pkg.version;
}
const ENGINE_VERSION = readEngineVersion();

export interface SimulationSummary {
  id: string;
  designId: string;
  provider: string;
  engineVersion: string;
  requestHash: string;
  inputSnapshot: ShelterDesign;
  kpis: SimulationKpis;
  /** Custom locations only: weather source + assumptions this run used. */
  weatherProvenance?: WeatherProvenanceSummary;
  createdAt: string; // ISO
}
export interface SimulationFull extends SimulationSummary {
  result: unknown;
}

function toSummary(doc: SimulationDoc): SimulationSummary {
  return {
    id: doc._id.toString(),
    designId: doc.designId.toString(),
    provider: doc.provider,
    engineVersion: doc.engineVersion,
    requestHash: doc.requestHash,
    inputSnapshot: doc.inputSnapshot,
    kpis: doc.kpis,
    ...(doc.weatherProvenance ? { weatherProvenance: doc.weatherProvenance } : {}),
    createdAt: (doc.createdAt as unknown as Date).toISOString(),
  };
}

function toFull(doc: SimulationDoc): SimulationFull {
  return { ...toSummary(doc), result: doc.result };
}

/** Runs the design's CURRENT state through the provider and freezes it.
 * `inputSnapshot` is a deep copy, so editing the design afterward leaves
 * this row untouched (condition 3). */
export async function runSimulation(
  ownerId: string,
  designId: string,
  fetchImpl?: typeof fetch,
): Promise<SimulationFull> {
  const designDoc = await getOwnedDesignDoc(ownerId, designId);
  const inputSnapshot: ShelterDesign = structuredClone(designDoc.design);
  const { request, weatherProvenance } = await prepareRequest(inputSnapshot, fetchImpl);
  const { kpis, result } = await fastPhysics.run(request);
  const doc = await Simulation.create({
    ownerId: new Types.ObjectId(ownerId),
    designId: designDoc._id,
    provider: fastPhysics.id,
    engineVersion: ENGINE_VERSION,
    requestHash: canonicalRequestHash(request),
    inputSnapshot,
    kpis,
    ...(weatherProvenance ? { weatherProvenance } : {}),
    result: resultToJson(result),
  });
  return toFull(doc);
}

/** Newest first, WITHOUT `result` (condition 4). 404s if the design isn't
 * owned by `ownerId`. */
export async function listSimulations(
  ownerId: string,
  designId: string,
): Promise<SimulationSummary[]> {
  const designDoc = await getOwnedDesignDoc(ownerId, designId);
  const docs = await Simulation.find({ designId: designDoc._id }).sort({ createdAt: -1 });
  return docs.map(toSummary);
}

/** Full record including `result` (condition 4). 404s for another user's
 * simulation id, same as designs (condition 2). */
export async function getSimulation(ownerId: string, id: string): Promise<SimulationFull> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError();
  const doc = await Simulation.findOne({ _id: id, ownerId: new Types.ObjectId(ownerId) });
  if (!doc) throw new NotFoundError();
  return toFull(doc);
}
