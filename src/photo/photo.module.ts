import { Module } from '@nestjs/common';
import { PhotoService } from './photo.service';
import { PhotoController } from './photo.controller';
import { PhotoRepository } from './repositories/photo.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [PhotoController],
  providers: [PhotoService, PhotoRepository],
  exports: [PhotoService],
})
export class PhotoModule {}
