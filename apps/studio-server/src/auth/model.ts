// apps/studio-server/src/auth/model.ts — `users` collection (PLAN.md
// §Server: `users{email↑unique,name,passwordHash}`).

import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const { model, models } = mongoose;

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

// `models['User'] ?? model(...)` avoids OverwriteModelError when buildApp()
// (and this module) is imported more than once in the same process, e.g.
// across test files sharing mongoose's default connection.
export const User: Model<UserDoc> = (models['User'] as Model<UserDoc>) ?? model('User', userSchema);
