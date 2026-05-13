import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { PhotoAiRepository } from './repositories/photo-ai.repository';
import { StorageService } from '../storage/storage.service';
import { AnalysisWorkerService } from './workers/analysis-worker.service';
import { EnhancementWorkerService } from './workers/enhancement-worker.service';

type SerializedJobError = { code: string; message: string } | null;

@Injectable()
export class PhotoAiService {
  constructor(
    private readonly repository: PhotoAiRepository,
    private readonly storageService: StorageService,
    private readonly analysisWorker: AnalysisWorkerService,
    private readonly enhancementWorker: EnhancementWorkerService,
  ) {}

  async getAnalysis(photoId: string, userId: string) {
    await this.assertPhotoOwnership(photoId, userId);
    const job = await this.repository.findAnalysisJobByPhotoId(photoId);
    if (!job) {
      throw new NotFoundException('Analysis job not found');
    }

    return {
      analysisJobId: job.id,
      status: job.status,
      result:
        job.status === JobStatus.SUCCEEDED && job.resultJson
          ? job.resultJson
          : null,
      error: this.serializeJobError(job.errorCode, job.errorMessage),
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  async createEnhancement(photoId: string, userId: string, prompt: string) {
    await this.assertPhotoOwnership(photoId, userId);
    const trimmed = prompt.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('prompt must not be empty');
    }

    const job = await this.repository.createEnhancementJob(photoId, trimmed);
    this.enhancementWorker.start(job.id, photoId, trimmed);

    return {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
    };
  }

  async getEnhancement(photoId: string, userId: string, jobId: string) {
    await this.assertPhotoOwnership(photoId, userId);
    const job = await this.repository.findEnhancementJob(jobId);
    if (!job || job.photoId !== photoId) {
      throw new NotFoundException('Enhancement job not found');
    }

    return {
      jobId: job.id,
      status: job.status,
      prompt: job.prompt,
      resultVersion: job.resultVersion
        ? await this.serializeVersion(job.resultVersion)
        : null,
      error: this.serializeJobError(job.errorCode, job.errorMessage),
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  async listVersions(photoId: string, userId: string) {
    await this.assertPhotoOwnership(photoId, userId);
    const versions = await this.repository.findPhotoVersionsByPhotoId(photoId);
    const serialized = await Promise.all(
      versions.map((v) => this.serializeVersion(v)),
    );
    return { versions: serialized };
  }

  private async assertPhotoOwnership(photoId: string, userId: string) {
    const photo = await this.repository.findPhotoForOwner(photoId, userId);
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }
    return photo;
  }

  private async serializeVersion(version: {
    id: string;
    fileKey: string;
    width: number | null;
    height: number | null;
    prompt: string | null;
    isOriginal: boolean;
    createdAt: Date;
  }) {
    return {
      versionId: version.id,
      fileKey: version.fileKey,
      url: await this.storageService.getReadUrl(version.fileKey),
      width: version.width,
      height: version.height,
      prompt: version.prompt,
      isOriginal: version.isOriginal,
      createdAt: version.createdAt.toISOString(),
    };
  }

  private serializeJobError(
    code: string | null,
    message: string | null,
  ): SerializedJobError {
    if (!code && !message) return null;
    return {
      code: code ?? 'UNKNOWN',
      message: message ?? '',
    };
  }
}
