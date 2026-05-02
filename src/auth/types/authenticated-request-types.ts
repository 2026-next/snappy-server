import type { Request } from 'express';
import { AccessTokenPayload } from './token-payload.types';

export interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
}
