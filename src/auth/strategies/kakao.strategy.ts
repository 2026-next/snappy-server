import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-kakao';
import { AuthService } from '../auth.service';
import { OAuthProvider } from '@prisma/client';

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.KAKAO_CLIENT_ID,
      clientSecret: process.env.KAKAO_CLIENT_SECRET,
      callbackURL:
        process.env.KAKAO_CALLBACK_URL ??
        'http://localhost:3000/auth/oauth/kakao/callback',
      scope: ['account_email', 'profile_nickname', 'profile_image'],
    } as any);
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    const profilePayload = {
      providerUserId: String(profile.id),
      email: profile._json?.kakao_account?.email ?? null,
      displayName: profile.displayName ?? null,
      profileImageUrl:
        profile._json?.kakao_account?.profile?.profile_image_url ?? null,
      accessToken,
      refreshToken: refreshToken ?? null,
    };

    return this.authService.oauthLoginWithProfile(
      OAuthProvider.KAKAO,
      profilePayload,
    );
  }
}
