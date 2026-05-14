import { Module } from '@nestjs/common';
import { PhotoService } from './photo.service';
import { PhotoController } from './photo.controller';
import { PhotoGroupsController } from './photo-groups.controller';
import { PhotoViewsController } from './photo-views.controller';
import { PhotoAiController } from './photo-ai.controller';
import { PhotoAiService } from './photo-ai.service';
import { PhotoRepository } from './repositories/photo.repository';
import { PhotoAiRepository } from './repositories/photo-ai.repository';
import { AnalysisWorkerService } from './workers/analysis-worker.service';
import { EnhancementWorkerService } from './workers/enhancement-worker.service';
import { ExifWorkerService } from './workers/exif-worker.service';
import { GeminiService } from './ai/gemini.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [
    PhotoController,
    PhotoViewsController,
    PhotoGroupsController,
    PhotoAiController,
  ],
  providers: [
    PhotoService,
    PhotoAiService,
    PhotoRepository,
    PhotoAiRepository,
    AnalysisWorkerService,
    EnhancementWorkerService,
    ExifWorkerService,
    GeminiService,
  ],
  exports: [PhotoService],
})
export class PhotoModule {}
