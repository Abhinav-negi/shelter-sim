// apps/studio-server/src/designs/service.ts — design CRUD. Routes call
// these functions; no Mongoose calls in route handlers (P2 rules).

import { Types, type HydratedDocument } from 'mongoose';
import type { ShelterDesign } from '../design/types.js';
import { Design, type DesignDoc } from './model.js';

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  constructor(message = 'Not found.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export interface DesignSummary {
  id: string;
  name: string;
  design: ShelterDesign;
  ansysStartedAt: string | null; // ISO
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

function toSummary(doc: HydratedDocument<DesignDoc>): DesignSummary {
  return {
    id: doc._id.toString(),
    name: doc.name,
    design: doc.design,
    ansysStartedAt: doc.ansysStartedAt ? (doc.ansysStartedAt as unknown as Date).toISOString() : null,
    createdAt: (doc.createdAt as unknown as Date).toISOString(),
    updatedAt: (doc.updatedAt as unknown as Date).toISOString(),
  };
}

export async function createDesign(
  ownerId: string,
  name: string,
  design: ShelterDesign,
): Promise<DesignSummary> {
  const doc = await Design.create({ ownerId: new Types.ObjectId(ownerId), name, design });
  return toSummary(doc);
}

export async function listDesigns(ownerId: string): Promise<DesignSummary[]> {
  const docs = await Design.find({ ownerId: new Types.ObjectId(ownerId) }).sort({ updatedAt: -1 });
  return docs.map(toSummary);
}

/** Owner-checked lookup used by both the design routes and simulations/
 * service.ts (POST/GET .../:id/simulations). A design that doesn't exist OR
 * belongs to another user is the same 404 (condition 2). */
export async function getOwnedDesignDoc(
  ownerId: string,
  id: string,
): Promise<HydratedDocument<DesignDoc>> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError();
  const doc = await Design.findOne({ _id: id, ownerId: new Types.ObjectId(ownerId) });
  if (!doc) throw new NotFoundError();
  return doc;
}

export async function getDesign(ownerId: string, id: string): Promise<DesignSummary> {
  return toSummary(await getOwnedDesignDoc(ownerId, id));
}

export async function updateDesign(
  ownerId: string,
  id: string,
  name: string,
  design: ShelterDesign,
): Promise<DesignSummary> {
  const doc = await getOwnedDesignDoc(ownerId, id);
  doc.name = name;
  doc.design = design;
  await doc.save();
  return toSummary(doc);
}

export async function deleteDesign(ownerId: string, id: string): Promise<void> {
  const doc = await getOwnedDesignDoc(ownerId, id);
  await doc.deleteOne();
}

/** Placeholder "run on ANSYS" (A1.md): idempotent — a design that's already
 * running keeps its original `ansysStartedAt`. `{ timestamps: false }` so
 * this never bumps `updatedAt`. */
export async function startAnsys(ownerId: string, id: string): Promise<DesignSummary> {
  const doc = await getOwnedDesignDoc(ownerId, id);
  if (!doc.ansysStartedAt) {
    doc.ansysStartedAt = new Date();
    await doc.save({ timestamps: false });
  }
  return toSummary(doc);
}

export async function cancelAnsys(ownerId: string, id: string): Promise<DesignSummary> {
  const doc = await getOwnedDesignDoc(ownerId, id);
  doc.ansysStartedAt = null;
  await doc.save({ timestamps: false });
  return toSummary(doc);
}
