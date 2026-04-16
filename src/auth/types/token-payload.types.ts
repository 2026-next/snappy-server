import { SessionType } from '@prisma/client';

export type AccessTokenPayload = {
  sub: string;
  sessionId: string;
  sessionType: SessionType;
  displayName: string | null;
};

export type RefreshTokenPayload = {
  sub: string;
  sessionId: string;
  sessionType: SessionType;
  tokenType: 'refresh';
};
