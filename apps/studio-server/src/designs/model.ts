// apps/studio-server/src/designs/model.ts — `designs` collection (PLAN.md
// §Server: `designs{ownerId,name,design,createdAt,updatedAt}` idx
// `{ownerId,updatedAt:-1}`). `design` is a whole ShelterDesign (design/
// types.ts), stored as-is (Mixed) -- it's already validated against the
// ShelterDesign ajv schema at the route before it reaches here.

import mongoose, { Schema, Types, type InferSchemaType, type Model } from 'mongoose';
import type { ShelterDesign } from '../design/types.js';

const { model, models } = mongoose;

const designSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    design: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
designSchema.index({ ownerId: 1, updatedAt: -1 });

export type DesignDoc = Omit<InferSchemaType<typeof designSchema>, 'design'> & {
  design: ShelterDesign;
  _id: Types.ObjectId;
};

export const Design: Model<DesignDoc> =
  (models['Design'] as Model<DesignDoc>) ?? model<DesignDoc>('Design', designSchema);
