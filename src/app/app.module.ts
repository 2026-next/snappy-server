import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MessageModule } from '../message/message.module';
import { UserModule } from '../user/user.module';
import { GuestModule } from '../guest/guest.module';
import { EventModule } from '../event/event.module';
import { PhotoModule } from '../photo/photo.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EventModule,
    MessageModule,
    UserModule,
    GuestModule,
    PhotoModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
