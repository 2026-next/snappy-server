import { Injectable, Logger } from '@nestjs/common';
import exifr from 'exifr';
import { PhotoRepository } from '../repositories/photo.repository';
import { StorageService } from '../../storage/storage.service';

/**
 * Number of bytes pulled from object storage to read EXIF/IPTC/XMP metadata.
 * JPEG EXIF headers live in the first few KB of the file — 256 KB is a wide
 * safety margin (handles re-saved JPEGs with bulky XMP packets, HEIC items,
 * and PNG chunks) that still keeps egress per upload at <0.3 MB instead of
 * the full multi-MB image.
 */
const EXIF_HEADER_BYTES = 256 * 1024;

const EXIF_PARSE_OPTIONS = {
  tiff: true,
  exif: true,
  xmp: true,
  iptc: true,
  gps: false,
  interop: false,
  ihdr: false,
  mergeOutput: true,
} as const;

type Maybe<T> = T | null | undefined;
type ExifTagBag = Record<string, unknown>;

const TAKEN_AT_TAG_PRIORITY = [
  'DateTimeOriginal',
  'CreateDate',
  'DateTimeDigitized',
  'DateTime',
];

function pickTakenAt(tags: Maybe<ExifTagBag>): Date | null {
  if (!tags) {
    return null;
  }
  for (const tag of TAKEN_AT_TAG_PRIORITY) {
    const value = tags[tag];
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    if (typeof value === 'string' && value.length > 0) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }
  return null;
}

@Injectable()
export class ExifWorkerService {
  private readonly logger = new Logger(ExifWorkerService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly photoRepository: PhotoRepository,
  ) {}

  /**
   * Fire-and-forget entry point invoked right after a photo row is created.
   * Errors are caught and logged at warn level — EXIF extraction is a
   * best-effort enrichment, never a blocker for the upload pipeline.
   */
  start(photoId: string, fileKey: string): void {
    setImmediate(() => {
      this.run(photoId, fileKey).catch((error) => {
        this.logger.warn(
          `EXIF worker fatal error for photo=${photoId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    });
  }

  private async run(photoId: string, fileKey: string): Promise<void> {
    let buffer: Buffer;
    try {
      buffer = await this.storage.downloadObjectPrefix(
        fileKey,
        EXIF_HEADER_BYTES,
      );
    } catch (error) {
      this.logger.warn(
        `EXIF download failed for photo=${photoId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    let tags: ExifTagBag | undefined;
    try {
      tags = (await exifr.parse(buffer, EXIF_PARSE_OPTIONS)) as
        | ExifTagBag
        | undefined;
    } catch (error) {
      this.logger.warn(
        `EXIF parse failed for photo=${photoId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    const takenAt = pickTakenAt(tags);
    if (!takenAt) {
      this.logger.debug(
        `EXIF extracted but no shutter timestamp found for photo=${photoId}`,
      );
      return;
    }

    try {
      const result = await this.photoRepository.updateExifTakenAt(
        photoId,
        takenAt,
      );
      if (result.count === 0) {
        this.logger.debug(
          `EXIF photo=${photoId} was deleted before back-fill completed`,
        );
        return;
      }
      this.logger.log(
        `EXIF back-fill complete for photo=${photoId}: ${takenAt.toISOString()}`,
      );
    } catch (error) {
      this.logger.warn(
        `EXIF DB update failed for photo=${photoId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

export { pickTakenAt };
