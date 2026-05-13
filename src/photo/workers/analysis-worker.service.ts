import { Injectable, Logger } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { PhotoAiRepository } from '../repositories/photo-ai.repository';
import { resolveEnhancementIconUrl } from '../constants/enhancement-icons';
import { GeminiService } from '../ai/gemini.service';
import { StorageService } from '../../storage/storage.service';

const ANALYSIS_TIMEOUT_MS = 60_000;
const ANALYSIS_PROCESS_DELAY_MS = 250;

const SUGGESTION_TEMPLATES: Array<{ type: string; prompt: string }> = [
  { type: '꽃 추가', prompt: '배경에 화사한 꽃들을 자연스럽게 추가해줘' },
  { type: '아웃포커스', prompt: '인물 뒤 배경을 부드럽게 흐려줘' },
  { type: '풀 추가', prompt: '아래쪽 빈 공간에 푸른 풀을 자연스럽게 추가해줘' },
  { type: '나무 추가', prompt: '배경에 큰 나무를 자연스럽게 추가해줘' },
  { type: '조명 보정', prompt: '인물에게 부드럽고 따뜻한 조명을 더해줘' },
  { type: '색감 보정', prompt: '전체적인 색감을 따뜻하고 화사하게 보정해줘' },
];

export type AnalysisResult = {
  hasPerson: boolean;
  personCount: number;
  composition: { score: number };
  sharpness: { score: number };
  suggestedEnhancements: Array<{
    type: string;
    iconUrl: string;
    suggestedPrompt: string;
  }>;
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function deterministicScore(seed: number, min: number, max: number): number {
  const ratio = (seed % 1000) / 1000;
  const raw = min + (max - min) * ratio;
  return Math.round(raw * 10) / 10;
}

function buildMockAnalysisResult(photoId: string): AnalysisResult {
  const seed = hashString(photoId);
  const hasPerson = seed % 4 !== 0;
  const personCount = hasPerson ? (seed % 4) + 1 : 0;
  const compositionScore = deterministicScore(seed, 5.5, 9.4);
  const sharpnessScore = deterministicScore(seed >> 1, 6.0, 9.6);

  const startIndex = seed % SUGGESTION_TEMPLATES.length;
  const suggestions = [0, 1, 2].map((offset) => {
    const tpl =
      SUGGESTION_TEMPLATES[(startIndex + offset) % SUGGESTION_TEMPLATES.length];
    return {
      type: tpl.type,
      iconUrl: resolveEnhancementIconUrl(tpl.type),
      suggestedPrompt: tpl.prompt,
    };
  });

  return {
    hasPerson,
    personCount,
    composition: { score: compositionScore },
    sharpness: { score: sharpnessScore },
    suggestedEnhancements: suggestions,
  };
}

@Injectable()
export class AnalysisWorkerService {
  private readonly logger = new Logger(AnalysisWorkerService.name);

  constructor(
    private readonly repository: PhotoAiRepository,
    private readonly storage: StorageService,
    private readonly gemini: GeminiService,
  ) {}

  start(jobId: string, photoId: string): void {
    setImmediate(() => {
      this.run(jobId, photoId).catch((error) => {
        this.logger.error(
          `Analysis worker fatal error for job=${jobId}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
    });
  }

  private async run(jobId: string, photoId: string): Promise<void> {
    try {
      await this.repository.updateAnalysisJob(jobId, {
        status: JobStatus.PROCESSING,
      });

      const result = await this.withTimeout(
        this.computeResult(photoId),
        ANALYSIS_TIMEOUT_MS,
      );

      await this.repository.updateAnalysisJob(jobId, {
        status: JobStatus.SUCCEEDED,
        resultJson: result,
        errorCode: null,
        errorMessage: null,
      });
      this.logger.log(`Analysis job ${jobId} succeeded`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.repository.updateAnalysisJob(jobId, {
        status: JobStatus.FAILED,
        errorCode: 'AI_ANALYSIS_FAILED',
        errorMessage: message,
      });
      this.logger.warn(`Analysis job ${jobId} failed: ${message}`);
    }
  }

  private async computeResult(photoId: string): Promise<AnalysisResult> {
    if (!this.gemini.isEnabled) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, ANALYSIS_PROCESS_DELAY_MS),
      );
      return buildMockAnalysisResult(photoId);
    }

    const photo = await this.repository.findPhotoMetadata(photoId);
    if (!photo) {
      this.logger.warn(
        `Analysis for photo=${photoId}: photo metadata not found, using mock`,
      );
      return buildMockAnalysisResult(photoId);
    }

    try {
      const { buffer, contentType } = await this.storage.downloadObject(
        photo.originalObjectKey,
      );
      const mimeType = photo.mimeType ?? contentType;
      const raw = await this.gemini.analyzeImage(buffer, mimeType);
      return {
        hasPerson: raw.hasPerson,
        personCount: raw.personCount,
        composition: raw.composition,
        sharpness: raw.sharpness,
        suggestedEnhancements: raw.suggestedEnhancements.map((s) => ({
          type: s.type,
          iconUrl: resolveEnhancementIconUrl(s.type),
          suggestedPrompt: s.suggestedPrompt,
        })),
      };
    } catch (error) {
      this.logger.warn(
        `Gemini analysis failed for photo=${photoId}, falling back to mock: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return buildMockAnalysisResult(photoId);
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Analysis timed out after ${ms}ms`)),
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
