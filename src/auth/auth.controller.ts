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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GuestLoginDto } from './dto/guest-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import type { AuthenticatedRequest } from './types/authenticated-request-types';
import {
  LogoutResponseDto,
  MeResponseDto,
  TokenPairResponseDto,
} from './dto/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Guest login' })
  @ApiBody({ type: GuestLoginDto })
  @ApiOkResponse({
    description: 'Guest login succeeded and token issued',
    type: TokenPairResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid guest credentials' })
  @Post('guest/login')
  guestLogin(@Body() guestLoginDto: GuestLoginDto) {
    return this.authService.guestLogin(guestLoginDto);
  }

  @ApiOperation({ summary: 'Refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: 'New token issued from refresh token',
    type: TokenPairResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid or expired' })
  @Post('refresh')
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
  @UseGuards(AccessTokenGuard)
  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    if (!req.user) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.authService.me(req.user);
  }

  @ApiOperation({ summary: 'Logout' })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
  @UseGuards(AccessTokenGuard)
  @Post('logout')
  logout(@Req() req: AuthenticatedRequest) {
    return this.authService.logout(req.user);
  }
}
