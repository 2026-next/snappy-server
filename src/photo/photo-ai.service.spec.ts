import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { PhotoAiService } from './photo-ai.service';
import { PhotoAiRepository } from './repositories/photo-ai.repository';
import { StorageService } from '../storage/storage.service';
import { AnalysisWorkerService } from './workers/analysis-worker.service';
import { EnhancementWorkerService } from './workers/enhancement-worker.service';

jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('PhotoAiService', () => {
  let service: PhotoAiService;

  const repository = {
    findPhotoForOwner: jest.fn(),
    findAnalysisJobByPhotoId: jest.fn(),
    createEnhancementJob: jest.fn(),
    findEnhancementJob: jest.fn(),
    findPhotoVersionsByPhotoId: jest.fn(),
  } as unknown as jest.Mocked<PhotoAiRepository>;

  const storageService = {
    getReadUrl: jest.fn(),
  } as unknown as jest.Mocked<StorageService>;

  const enhancementWorker = {
    start: jest.fn(),
  } as unknown as jest.Mocked<EnhancementWorkerService>;

  const analysisWorker = {
    start: jest.fn(),
  } as unknown as jest.Mocked<AnalysisWorkerService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PhotoAiService,
        { provide: PhotoAiRepository, useValue: repository },
        { provide: StorageService, useValue: storageService },
        { provide: AnalysisWorkerService, useValue: analysisWorker },
        { provide: EnhancementWorkerService, useValue: enhancementWorker },
      ],
    }).compile();

    service = moduleRef.get(PhotoAiService);
  });

  it('throws NotFound when photo is not owned by user (analysis)', async () => {
    (repository.findPhotoForOwner as jest.Mock).mockResolvedValue(
      null as never,
    );
    await expect(service.getAnalysis('photo-1', 'user-x')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns analysis result when SUCCEEDED', async () => {
    (repository.findPhotoForOwner as jest.Mock).mockResolvedValue({
      id: 'photo-1',
    } as never);
    (repository.findAnalysisJobByPhotoId as jest.Mock).mockResolvedValue({
      id: 'job-1',
      status: JobStatus.SUCCEEDED,
      resultJson: { hasPerson: true, personCount: 1 },
      errorCode: null,
      errorMessage: null,
      createdAt: new Date('2026-05-13T00:00:00Z'),
      updatedAt: new Date('2026-05-13T00:00:01Z'),
    } as never);

    const result = await service.getAnalysis('photo-1', 'user-1');
    expect(result.status).toBe(JobStatus.SUCCEEDED);
    expect(result.result).toEqual({ hasPerson: true, personCount: 1 });
    expect(result.error).toBeNull();
  });

  it('creates enhancement job and starts worker', async () => {
    (repository.findPhotoForOwner as jest.Mock).mockResolvedValue({
      id: 'photo-1',
    } as never);
    (repository.createEnhancementJob as jest.Mock).mockResolvedValue({
      id: 'job-2',
      status: JobStatus.PENDING,
      createdAt: new Date('2026-05-13T00:00:00Z'),
    } as never);

    const out = await service.createEnhancement(
      'photo-1',
      'user-1',
      '배경에 꽃 추가',
    );

    expect(out.jobId).toBe('job-2');
    expect(out.status).toBe(JobStatus.PENDING);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const startSpy = enhancementWorker.start;
    expect(startSpy).toHaveBeenCalledWith('job-2', 'photo-1', '배경에 꽃 추가');
  });

  it('rejects empty prompt', async () => {
    (repository.findPhotoForOwner as jest.Mock).mockResolvedValue({
      id: 'photo-1',
    } as never);
    await expect(
      service.createEnhancement('photo-1', 'user-1', '   '),
    ).rejects.toThrow();
  });

  it('returns 404 when enhancement job belongs to another photo', async () => {
    (repository.findPhotoForOwner as jest.Mock).mockResolvedValue({
      id: 'photo-1',
    } as never);
    (repository.findEnhancementJob as jest.Mock).mockResolvedValue({
      id: 'job-3',
      photoId: 'photo-other',
      status: JobStatus.PENDING,
      prompt: 'x',
      resultVersion: null,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await expect(
      service.getEnhancement('photo-1', 'user-1', 'job-3'),
    ).rejects.toThrow(NotFoundException);
  });
});
