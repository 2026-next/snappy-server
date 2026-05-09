import { Module } from '@nestjs/common';
import { GuestService } from './guest.service';
import { GuestController } from './guest.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GuestRepository } from './repositories/guest.repository';
import { EventModule } from '../event/event.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, AuthModule, EventModule, StorageModule],
  controllers: [GuestController],
  providers: [GuestService, GuestRepository],
  exports: [GuestService],
})
export class GuestModule {}
