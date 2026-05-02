import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MessageModule } from '../message/message.module';
import { UserModule } from '../user/user.module';
import { GuestModule } from '../guest/guest.module';
import { EventModule } from '../event/event.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EventModule,
    MessageModule,
    UserModule,
    GuestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
