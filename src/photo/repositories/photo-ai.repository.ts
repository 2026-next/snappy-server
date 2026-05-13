import { Injectable } from '@nestjs/common';
import type { JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreatePhotoVersionData = {
  photoId: string;
  fileKey: string;
  width?: number | null;
  height?: number | null;
  prompt?: string | null;
  isOriginal?: boolean;
  sourceJobId?: string | null;
};

export type UpdateAnalysisJobData = {
  status?: JobStatus;
  resultJson?: Prisma.InputJsonValue;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type UpdateEnhancementJobData = {
  status?: JobStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
};

@Injectable()
export class PhotoAiRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAnalysisJob(photoId: string) {
    return this.prisma.photoAnalysisJob.create({
      data: { photoId },
    });
  }

  async findAnalysisJobByPhotoId(photoId: string) {
    return this.prisma.photoAnalysisJob.findUnique({
      where: { photoId },
    });
  }

  async findAnalysisJobById(jobId: string) {
    return this.prisma.photoAnalysisJob.findUnique({
      where: { id: jobId },
    });
  }

  async updateAnalysisJob(jobId: string, data: UpdateAnalysisJobData) {
    return this.prisma.photoAnalysisJob.update({
      where: { id: jobId },
      data,
    });
  }

  async createEnhancementJob(photoId: string, prompt: string) {
    return this.prisma.enhancementJob.create({
      data: { photoId, prompt },
    });
  }

  async findEnhancementJob(jobId: string) {
    return this.prisma.enhancementJob.findUnique({
      where: { id: jobId },
      include: { resultVersion: true },
    });
  }

  async updateEnhancementJob(jobId: string, data: UpdateEnhancementJobData) {
    return this.prisma.enhancementJob.update({
      where: { id: jobId },
      data,
    });
  }

  async createPhotoVersion(data: CreatePhotoVersionData) {
    return this.prisma.photoVersion.create({
      data: {
        photoId: data.photoId,
        fileKey: data.fileKey,
        width: data.width ?? null,
        height: data.height ?? null,
        prompt: data.prompt ?? null,
        isOriginal: data.isOriginal ?? false,
        sourceJobId: data.sourceJobId ?? null,
      },
    });
  }

  async findPhotoVersionsByPhotoId(photoId: string) {
    return this.prisma.photoVersion.findMany({
      where: { photoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOriginalVersion(photoId: string) {
    return this.prisma.photoVersion.findFirst({
      where: { photoId, isOriginal: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findPhotoForOwner(photoId: string, userId: string) {
    return this.prisma.photo.findFirst({
      where: { id: photoId, isDeleted: false, event: { ownerId: userId } },
    });
  }

  async findPhotoMetadata(photoId: string) {
    return this.prisma.photo.findUnique({
      where: { id: photoId },
      select: {
        id: true,
        eventId: true,
        originalObjectKey: true,
        mimeType: true,
        width: true,
        height: true,
      },
    });
  }
}
