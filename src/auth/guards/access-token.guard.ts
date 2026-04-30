import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AccessTokenPayload } from '../types/token-payload.types';
import type { AuthenticatedRequest } from '../types/authenticated-request-types';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      select: {
        id: true,
        revokedAt: true,
        sessionType: true,
        userId: true,
        guestId: true,
      },
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Session is invalid');
    }

    const isSubjectValid =
      (session.sessionType === SessionType.USER && session.userId === payload.sub) ||
      (session.sessionType === SessionType.GUEST && session.guestId === payload.sub);

    if (!isSubjectValid) {
      throw new UnauthorizedException('Session subject mismatch');
    }

    request.user = payload;
    return true;
  }

  private extractBearerToken(request: AuthenticatedRequest) {
    const authorization = request.headers['authorization'];

    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
