import type { Request } from 'express';
import type { PublicUser } from '../users/public-user.js';

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
  sessionId?: string;
}

export interface ClientMeta {
  userAgent?: string;
  ip?: string;
}
