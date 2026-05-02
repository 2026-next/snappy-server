import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import { OAuthProvider } from '@prisma/client';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ??
        'http://localhost:3000/auth/oauth/google/callback',
      passReqToCallback: false,
      scope: ['openid', 'email', 'profile'],
    } as any);
  }

  // passport will call this with the OAuth profile and tokens
  async validate(accessToken: string, refreshToken: string, profile: any) {
    const profilePayload = {
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      displayName: profile.displayName ?? null,
      profileImageUrl: profile.photos?.[0]?.value ?? null,
      accessToken,
      refreshToken: refreshToken ?? null,
    };

    return this.authService.oauthLoginWithProfile(
      OAuthProvider.GOOGLE,
      profilePayload,
    );
  }
}
