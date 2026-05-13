import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI, Type, type Content } from '@google/genai';

export type AnalysisSuggestion = {
  type: string;
  suggestedPrompt: string;
};

export type GeminiAnalysisResult = {
  hasPerson: boolean;
  personCount: number;
  composition: { score: number };
  sharpness: { score: number };
  suggestedEnhancements: AnalysisSuggestion[];
};

export type GeminiEnhancementResult = {
  buffer: Buffer;
  mimeType: string;
};

const ANALYSIS_MODEL = 'gemini-2.5-flash';
const ENHANCEMENT_MODEL = 'gemini-2.5-flash-image';
const ANALYSIS_TIMEOUT_MS = 45_000;
const ENHANCEMENT_TIMEOUT_MS = 150_000;

const ANALYSIS_SYSTEM_INSTRUCTION = `You are a Korean-speaking photo coach for a wedding album app.
Inspect the photo and return a JSON object that strictly matches the schema.
- composition.score: integer 0-100 grading framing/balance, mapped later to a 0-10 scale.
- sharpness.score: integer 0-100 grading focus/sharpness.
- hasPerson: true if any person is visible.
- personCount: 0 if hasPerson is false, otherwise the visible person count.
- suggestedEnhancements: 2-4 concrete edit suggestions tailored to this photo.
  Each "type" is a SHORT Korean noun phrase (≤ 6 chars when possible) such as
  "꽃 추가", "아웃포커스", "조명 보정", "배경 흐리게".
  Each "suggestedPrompt" is a single Korean imperative sentence that can be sent
  directly to an image-edit model.
Respond ONLY with the JSON object, no commentary.`;

const ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    hasPerson: { type: Type.BOOLEAN },
    personCount: { type: Type.INTEGER },
    composition: {
      type: Type.OBJECT,
      properties: { score: { type: Type.INTEGER } },
      required: ['score'],
    },
    sharpness: {
      type: Type.OBJECT,
      properties: { score: { type: Type.INTEGER } },
      required: ['score'],
    },
    suggestedEnhancements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          suggestedPrompt: { type: Type.STRING },
        },
        required: ['type', 'suggestedPrompt'],
      },
    },
  },
  required: [
    'hasPerson',
    'personCount',
    'composition',
    'sharpness',
    'suggestedEnhancements',
  ],
};

function normalizeScore(raw: unknown): number {
  if (typeof raw !== 'number' || Number.isNaN(raw)) return 0;
  const clamped = Math.max(0, Math.min(100, raw));
  const tenScale = clamped / 10;
  return Math.round(tenScale * 10) / 10;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenAI | null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY not set — Photo AI workers will use mock fallbacks.',
      );
      this.client = null;
      return;
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }

  async analyzeImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<GeminiAnalysisResult> {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const contents: Content[] = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBuffer.toString('base64'),
            },
          },
          { text: '이 사진을 분석하고 추천 보정 옵션을 JSON으로 반환해줘.' },
        ],
      },
    ];

    const response = await withTimeout(
      this.client.models.generateContent({
        model: ANALYSIS_MODEL,
        contents,
        config: {
          systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseJsonSchema: ANALYSIS_RESPONSE_SCHEMA,
          temperature: 0.4,
        },
      }),
      ANALYSIS_TIMEOUT_MS,
      'Gemini analysis',
    );

    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned empty analysis response');
    }

    const parsed = JSON.parse(text) as Record<string, unknown>;
    const composition = parsed.composition as { score?: unknown } | undefined;
    const sharpness = parsed.sharpness as { score?: unknown } | undefined;
    const rawSuggestions = Array.isArray(parsed.suggestedEnhancements)
      ? (parsed.suggestedEnhancements as Array<Record<string, unknown>>)
      : [];

    return {
      hasPerson: Boolean(parsed.hasPerson),
      personCount:
        typeof parsed.personCount === 'number' && parsed.personCount > 0
          ? Math.floor(parsed.personCount)
          : 0,
      composition: { score: normalizeScore(composition?.score) },
      sharpness: { score: normalizeScore(sharpness?.score) },
      suggestedEnhancements: rawSuggestions
        .map((entry) => ({
          type: typeof entry.type === 'string' ? entry.type.trim() : '',
          suggestedPrompt:
            typeof entry.suggestedPrompt === 'string'
              ? entry.suggestedPrompt.trim()
              : '',
        }))
        .filter((s) => s.type.length > 0 && s.suggestedPrompt.length > 0)
        .slice(0, 4),
    };
  }

  async enhanceImage(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
  ): Promise<GeminiEnhancementResult> {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const contents: Content[] = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBuffer.toString('base64'),
            },
          },
          { text: prompt },
        ],
      },
    ];

    const response = await withTimeout(
      this.client.models.generateContent({
        model: ENHANCEMENT_MODEL,
        contents,
      }),
      ENHANCEMENT_TIMEOUT_MS,
      'Gemini enhancement',
    );

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (inline?.data) {
        return {
          buffer: Buffer.from(inline.data, 'base64'),
          mimeType: inline.mimeType ?? 'image/png',
        };
      }
    }
    throw new Error('Gemini did not return an image in its response');
  }
}
