import {
  Body,
  Controller,
  Get,
  Post,
  Req,
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
import { AuthService } from './auth.service';
import { GuestLoginDto } from './dto/guest-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import type { AuthenticatedRequest } from './types/authenticated-request-types';
import { MeResponseDto, TokenPairResponseDto } from './dto/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  googleAuthPassportCallback(@Req() req: any) {
    return req.user;
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
  kakaoAuthPassportCallback(@Req() req: any) {
    return req.user;
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
}
