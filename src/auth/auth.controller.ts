import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { GuestLoginDto } from './dto/guest-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import { AccessTokenPayload } from './types/token-payload.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('guest/login')
  guestLogin(@Body() guestLoginDto: GuestLoginDto) {
    return this.authService.guestLogin(guestLoginDto);
  }

  @Post('refresh')
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }

  @UseGuards(AccessTokenGuard)
  @Get('me')
  me(@Req() req: Request) {
    const payload = req.user as AccessTokenPayload | undefined;

    if (!payload) {
      throw new UnauthorizedException('Invalid access token');
    }

    return this.authService.me(payload);
  }

  @UseGuards(AccessTokenGuard)
  @Post('logout')
  logout(@Req() req: Request) {
    const payload = req.user as AccessTokenPayload | undefined;

    if (!payload) {
      throw new UnauthorizedException('Invalid access token');
    }

    return this.authService.logout(payload);
  }
}
