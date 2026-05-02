import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuthProvider, SessionType } from '@prisma/client';
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
    // Validate that the event exists
    const event = await this.authRepository.findEventById(dto.eventId);

    if (!event) {
      throw new UnprocessableEntityException('Event not found');
    }

    const existingGuest = await this.authRepository.findGuestByEventIdAndName(dto.eventId, dto.name);

    // If guest exists, verify password; if not, create new guest with hashed password
    const guest = existingGuest ?? (await this.authRepository.createGuest({
      eventId: dto.eventId,
      name: dto.name,
      passwordHash: await bcrypt.hash(dto.password, 10),
    }));

    const isPasswordValid = existingGuest
      ? await bcrypt.compare(dto.password, guest.passwordHash)
      : true;

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

  // Google OAuth
  //
  getGoogleOAuthAuthorizationUrl(redirectUri?: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new InternalServerErrorException('Google OAuth is not configured');
    }

    throw new InternalServerErrorException('Google authorization URL is not available; use Passport endpoints');
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
      throw new NotFoundException('Session not found');
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

  // Similar to `oauthLogin` but accepts an already-fetched profile object
  async oauthLoginWithProfile(provider: OAuthProvider, profile: {
    providerUserId: string;
    email?: string | null;
    displayName?: string | null;
    profileImageUrl?: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;
  }) {
    const user = await this.authRepository.upsertOAuthUser(provider, profile);

    const refreshTokenExpiresInSeconds = this.getRefreshTokenExpiresInSeconds();
    const session = await this.authRepository.createAuthSession({
      sessionType: SessionType.USER,
      userId: user.id,
      expiresAt: new Date(Date.now() + refreshTokenExpiresInSeconds * 1000),
    });

    return this.issueTokenPair({
      subjectId: user.id,
      sessionId: session.id,
      sessionType: SessionType.USER,
      displayName: user.name ?? (profile.displayName ?? null),
    });
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
    return Number(process.env.JWT_REFRESH_EXPIRES_IN_SECONDS ?? 604800);
  }
}
