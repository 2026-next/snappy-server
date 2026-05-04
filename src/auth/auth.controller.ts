import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GuestLoginDto } from './dto/guest-login.dto';
import { GuestRegisterDto } from './dto/guest-register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import type { AuthenticatedRequest } from './types/authenticated-request-types';
import { MeResponseDto, TokenPairResponseDto } from './dto/auth-response.dto';

type OAuthProviderCallback = 'google' | 'kakao';

interface OAuthCallbackRequest extends Request {
  user: TokenPairResponseDto;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Guest registration' })
  @ApiBody({ type: GuestRegisterDto })
  @ApiCreatedResponse({
    description: 'Guest account created and token issued',
    type: TokenPairResponseDto,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Event not found or guest name already exists',
  })
  @Post('guest/register')
  guestRegister(@Body() guestRegisterDto: GuestRegisterDto) {
    return this.authService.guestRegister(guestRegisterDto);
  }

  @ApiOperation({ summary: 'Guest login' })
  @ApiBody({ type: GuestLoginDto })
  @ApiCreatedResponse({
    description: 'Guest login succeeded and token issued',
    type: TokenPairResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid guest credentials' })
  @ApiUnprocessableEntityResponse({ description: 'Event not found' })
  @Post('guest/login')
  guestLogin(@Body() guestLoginDto: GuestLoginDto) {
    return this.authService.guestLogin(guestLoginDto);
  }

  @ApiOperation({ summary: 'Google OAuth로 들어가는 endpoint' })
  @Get('oauth/google')
  @UseGuards(AuthGuard('google'))
  googleAuthStart() {
    // Guard will redirect to Google OAuth consent screen
  }

  @ApiOperation({ summary: 'Google OAuth callback(나오는 endpoint)' })
  @Get('oauth/google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthPassportCallback(
    @Req() req: OAuthCallbackRequest,
    @Res() res: Response,
  ): void {
    this.redirectOAuthCallback('google', req.user, res);
  }

  @ApiOperation({ summary: 'Kakao OAuth로 들어가는 endpoint' })
  @Get('oauth/kakao')
  @UseGuards(AuthGuard('kakao'))
  kakaoAuthStart() {
    // Guard will redirect to Kakao OAuth consent screen
  }

  @ApiOperation({ summary: 'Kakao OAuth callback(나오는 endpoint)' })
  @Get('oauth/kakao/callback')
  @UseGuards(AuthGuard('kakao'))
  kakaoAuthPassportCallback(
    @Req() req: OAuthCallbackRequest,
    @Res() res: Response,
  ): void {
    this.redirectOAuthCallback('kakao', req.user, res);
  }

  @ApiOperation({ summary: 'Refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: 'New token issued from refresh token',
    type: TokenPairResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token is invalid or expired',
  })
  @Post('refresh')
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing or invalid',
  })
  @UseGuards(AccessTokenGuard)
  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    if (!req.user) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.authService.me(req.user);
  }

  private redirectOAuthCallback(
    provider: OAuthProviderCallback,
    tokens: TokenPairResponseDto,
    res: Response,
  ): void {
    const frontendOrigin =
      process.env.FRONTEND_ORIGIN ?? 'http://localhost:5174';
    const redirectUrl = new URL(
      `/auth/oauth/${provider}/callback`,
      frontendOrigin,
    );

    redirectUrl.search = new URLSearchParams({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
    }).toString();

    res.redirect(303, redirectUrl.toString());
  }
}
