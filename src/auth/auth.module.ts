import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AccessTokenGuard } from './guards/access-token.guard';
import { AuthRepository } from './repositories/auth.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleStrategy } from './strategies/google.strategy';
import { KakaoStrategy } from './strategies/kakao.strategy';

@Module({
  imports: [PassportModule.register({}), JwtModule.register({}), PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenGuard, AuthRepository, GoogleStrategy, KakaoStrategy],
  exports: [AccessTokenGuard, JwtModule],
})
export class AuthModule {}
