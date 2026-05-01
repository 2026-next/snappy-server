import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UserRepository } from './repositories/user.repository';

@Module({
  imports: [PrismaModule, AuthModule, JwtModule.register({})],
  controllers: [UserController],
  providers: [UserService, UserRepository],
})
export class UserModule {}
