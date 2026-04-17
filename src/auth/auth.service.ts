import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { GuestLoginDto } from './dto/guest-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './types/token-payload.types';
import { AuthRepository } from './repositories/auth.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  // Guest login with event ID, name, and password
  //
  async guestLogin(dto: GuestLoginDto) {
    const guest = await this.authRepository.findGuestByEventIdAndName(dto.eventId, dto.name);

    if (!guest) {
      throw new UnauthorizedException('Invalid guest credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, guest.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid guest credentials');
    }

    const refreshTokenExpiresInSeconds = this.getRefreshTokenExpiresInSeconds();
    const session = await this.authRepository.createAuthSession({
      sessionType: SessionType.GUEST,
      guestId: guest.id,
      expiresAt: new Date(Date.now() + refreshTokenExpiresInSeconds * 1000),
    });

    return this.issueTokenPair({
      subjectId: guest.id,
      sessionId: session.id,
      sessionType: SessionType.GUEST,
      displayName: guest.name,
    });
  }

  // Refresh access token using a valid refresh token
  //
  async refresh(dto: RefreshTokenDto) {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(dto.refreshToken, {
        secret: this.getRefreshTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.authRepository.findAuthSessionByIdWithRelations(payload.sessionId);

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    if (!session.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token not set');
    }

    const isRefreshTokenValid = await bcrypt.compare(dto.refreshToken, session.refreshTokenHash);
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const subjectId = this.getSessionSubjectId(session.sessionType, session.userId, session.guestId);
    const displayName = session.sessionType === SessionType.GUEST ? session.guest?.name ?? null : session.user?.name ?? null;

    return this.issueTokenPair({
      subjectId,
      sessionId: session.id,
      sessionType: session.sessionType,
      displayName,
    });
  }

  async me(payload: AccessTokenPayload) {
    const session = await this.authRepository.findAuthSessionByIdWithRelations(payload.sessionId);

    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Session is invalid');
    }

    if (payload.sessionType === SessionType.GUEST) {
      return {
        sessionType: SessionType.GUEST,
        guest: session.guest,
      };
    }

    return {
      sessionType: SessionType.USER,
      user: session.user,
    };
  }

  async logout(payload: AccessTokenPayload) {
    await this.authRepository.revokeAuthSession(payload.sessionId);
    return { success: true };
  }

  private async issueTokenPair(params: {
    subjectId: string;
    sessionId: string;
    sessionType: SessionType;
    displayName: string | null;
  }) {
    const accessPayload: AccessTokenPayload = {
      sub: params.subjectId,
      sessionId: params.sessionId,
      sessionType: params.sessionType,
      displayName: params.displayName,
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: params.subjectId,
      sessionId: params.sessionId,
      sessionType: params.sessionType,
      tokenType: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.getAccessTokenSecret(),
        expiresIn: this.getAccessTokenExpiresInSeconds(),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.getRefreshTokenSecret(),
        expiresIn: this.getRefreshTokenExpiresInSeconds(),
      }),
    ]);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.authRepository.updateAuthSessionRefreshToken(
      params.sessionId,
      refreshTokenHash,
      new Date(Date.now() + this.getRefreshTokenExpiresInSeconds() * 1000),
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
    };
  }

  private getSessionSubjectId(
    sessionType: SessionType,
    userId: string | null,
    guestId: string | null,
  ) {
    if (sessionType === SessionType.USER && userId) {
      return userId;
    }

    if (sessionType === SessionType.GUEST && guestId) {
      return guestId;
    }

    throw new UnprocessableEntityException('Session subject is invalid');
  }

  private getAccessTokenSecret() {
    return process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me';
  }

  private getRefreshTokenSecret() {
    return process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me';
  }

  private getAccessTokenExpiresInSeconds() {
    return Number(process.env.JWT_ACCESS_EXPIRES_IN_SECONDS ?? 900);
  }

  private getRefreshTokenExpiresInSeconds() {
    return Number(process.env.JWT_REFRESH_EXPIRES_IN_SECONDS);
  }
}
