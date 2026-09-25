// apps/studio-server/src/simulations/model.ts — `simulations` collection
// (PLAN.md §Server: `simulations{ownerId,designId,provider,engineVersion,
// requestHash,inputSnapshot,kpis,result(inline ~250KB),createdAt}` idx
// `{designId,createdAt:-1}`). No `updatedAt` -- a simulation is a frozen
// snapshot, never edited (condition 3).

import mongoose, { Schema, Types, type InferSchemaType, type Model } from 'mongoose';
import type { SimulationKpis } from '@shelter/engine';
import type { ShelterDesign } from '../design/types.js';
import type { WeatherProvenanceSummary } from '../weather/resolve.js';

const { model, models } = mongoose;

const simulationSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    designId: { type: Schema.Types.ObjectId, ref: 'Design', required: true },
    provider: { type: String, required: true },
    engineVersion: { type: String, required: true },
    requestHash: { type: String, required: true },
    inputSnapshot: { type: Schema.Types.Mixed, required: true },
    kpis: { type: Schema.Types.Mixed, required: true },
    weatherProvenance: { type: Schema.Types.Mixed },
    result: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
simulationSchema.index({ designId: 1, createdAt: -1 });

export type SimulationDoc = Omit<
  InferSchemaType<typeof simulationSchema>,
  'inputSnapshot' | 'kpis' | 'result' | 'weatherProvenance'
> & {
  weatherProvenance?: WeatherProvenanceSummary;
  inputSnapshot: ShelterDesign;
  kpis: SimulationKpis;
  result: unknown;
  _id: Types.ObjectId;
};

export const Simulation: Model<SimulationDoc> =
  (models['Simulation'] as Model<SimulationDoc>) ?? model<SimulationDoc>('Simulation', simulationSchema);
