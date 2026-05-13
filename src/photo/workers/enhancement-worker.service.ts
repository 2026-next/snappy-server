import { Injectable, Logger } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { PhotoAiRepository } from '../repositories/photo-ai.repository';
import { GeminiService } from '../ai/gemini.service';
import { StorageService } from '../../storage/storage.service';

const ENHANCEMENT_TIMEOUT_MS = 180_000;
const ENHANCEMENT_PROCESS_DELAY_MS = 400;

@Injectable()
export class EnhancementWorkerService {
  private readonly logger = new Logger(EnhancementWorkerService.name);

  constructor(
    private readonly repository: PhotoAiRepository,
    private readonly storage: StorageService,
    private readonly gemini: GeminiService,
  ) {}

  start(jobId: string, photoId: string, prompt: string): void {
    setImmediate(() => {
      this.run(jobId, photoId, prompt).catch((error) => {
        this.logger.error(
          `Enhancement worker fatal error for job=${jobId}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
    });
  }

  private async run(
    jobId: string,
    photoId: string,
    prompt: string,
  ): Promise<void> {
    try {
      await this.repository.updateEnhancementJob(jobId, {
        status: JobStatus.PROCESSING,
      });

      const original = await this.repository.findOriginalVersion(photoId);
      if (!original) {
        throw new Error('Original version not found for photo');
      }

      const photo = await this.repository.findPhotoMetadata(photoId);
      if (!photo) {
        throw new Error('Photo metadata not found');
      }

      const result = await this.withTimeout(
        this.produceEnhancedVersion(photo, original.fileKey, prompt),
        ENHANCEMENT_TIMEOUT_MS,
      );

      await this.repository.createPhotoVersion({
        photoId,
        fileKey: result.fileKey,
        width: original.width,
        height: original.height,
        prompt,
        isOriginal: false,
        sourceJobId: jobId,
      });

      await this.repository.updateEnhancementJob(jobId, {
        status: JobStatus.SUCCEEDED,
        errorCode: null,
        errorMessage: null,
      });
      this.logger.log(`Enhancement job ${jobId} succeeded`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.repository.updateEnhancementJob(jobId, {
        status: JobStatus.FAILED,
        errorCode: 'AI_ENHANCEMENT_FAILED',
        errorMessage: message,
      });
      this.logger.warn(`Enhancement job ${jobId} failed: ${message}`);
    }
  }

  private async produceEnhancedVersion(
    photo: {
      eventId: string;
      originalObjectKey: string;
      mimeType: string | null;
    },
    originalFileKey: string,
    prompt: string,
  ): Promise<{ fileKey: string }> {
    if (!this.gemini.isEnabled) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, ENHANCEMENT_PROCESS_DELAY_MS),
      );
      return { fileKey: originalFileKey };
    }

    try {
      const { buffer, contentType } = await this.storage.downloadObject(
        photo.originalObjectKey,
      );
      const mimeType = photo.mimeType ?? contentType;
      const edited = await this.gemini.enhanceImage(buffer, mimeType, prompt);
      const fileKey = await this.storage.uploadEnhancedObject(
        photo.eventId,
        edited.buffer,
        edited.mimeType,
      );
      return { fileKey };
    } catch (error) {
      this.logger.warn(
        `Gemini enhancement failed, falling back to original-clone: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { fileKey: originalFileKey };
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Enhancement timed out after ${ms}ms`)),
        ms,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
