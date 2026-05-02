import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { EventRepository } from './repositories/event.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [EventController],
  providers: [EventService, EventRepository, AccessTokenGuard],
})
export class EventModule {}
