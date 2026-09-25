// apps/studio-server/src/db.ts — Mongoose connection lifecycle (P2).
//
// Wraps mongoose's default connection (P3 uses that same default connection
// for its own collections, e.g. weatherCache -- PLAN.md §Server -- so this
// file does not create a second connection). Models (auth/designs/
// simulations) register themselves against mongoose's default connection
// via `mongoose.model(...)`, independent of when connectDb() is called --
// tests call connectDb() with a mongodb-memory-server URI in beforeAll.

import mongoose from 'mongoose';

export async function connectDb(uri: string): Promise<void> {
  await mongoose.connect(uri);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
