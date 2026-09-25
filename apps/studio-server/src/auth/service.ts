// apps/studio-server/src/auth/service.ts — register/login logic. Routes
// call these functions; no Mongoose calls in route handlers (P2 rules).

import type { Types } from 'mongoose';
import { User } from './model.js';
import { hashPassword, verifyPassword } from './password.js';

export class EmailTakenError extends Error {
  readonly code = 'EMAIL_TAKEN' as const;
  constructor(message = 'An account with this email already exists.') {
    super(message);
    this.name = 'EmailTakenError';
  }
}

export class InvalidCredentialsError extends Error {
  readonly code = 'INVALID_CREDENTIALS' as const;
  constructor(message = 'Invalid email or password.') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

function toPublicUser(user: { _id: Types.ObjectId; email: string; name: string }): PublicUser {
  return { id: user._id.toString(), email: user.email, name: user.name };
}

export async function registerUser(
  email: string,
  name: string,
  password: string,
): Promise<PublicUser> {
  const normalisedEmail = email.toLowerCase();
  const existing = await User.findOne({ email: normalisedEmail });
  if (existing) throw new EmailTakenError();
  const passwordHash = await hashPassword(password);
  const user = await User.create({ email: normalisedEmail, name, passwordHash });
  return toPublicUser(user);
}

export async function authenticateUser(email: string, password: string): Promise<PublicUser> {
  const user = await User.findOne({ email: email.toLowerCase() });
  // Same INVALID_CREDENTIALS message/status for an unknown email as for a
  // wrong password (condition 1) -- don't leak which one it was.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new InvalidCredentialsError();
  }
  return toPublicUser(user);
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = await User.findById(id);
  return user ? toPublicUser(user) : null;
}
