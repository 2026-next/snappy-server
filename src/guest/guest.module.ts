import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GuestService } from './guest.service';
import { GuestController } from './guest.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GuestRepository } from './repositories/guest.repository';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [GuestController],
  providers: [GuestService, GuestRepository],
  exports: [GuestService],
})
export class GuestModule {}
