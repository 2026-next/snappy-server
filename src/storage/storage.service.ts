import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor() {
    this.storage = new Storage();
    this.bucketName = process.env.GCP_STORAGE_BUCKET || '';
  }

  async createUploadSignedUrls(
    eventId: string,
    guestId: string,
    mimeType: string,
    fileCount: number,
  ) {
    if (!this.bucketName) {
      throw new InternalServerErrorException('GCS bucket is not configured');
    }

    try {
      const uploadUrls = await Promise.all(
        Array.from({ length: fileCount }, async () => {
          const fileKey = `events/${eventId}/${guestId}/${uuidv4()}`;
          const [uploadUrl] = await this.storage
            .bucket(this.bucketName)
            .file(fileKey)
            .getSignedUrl({
              version: 'v4',
              action: 'write',
              expires: Date.now() + 5 * 60 * 1000,
              contentType: mimeType,
            });

          return { uploadUrl, fileKey };
        }),
      );

      return uploadUrls;
    } catch {
      throw new InternalServerErrorException('GCS signed URL creation failed');
    }
  }

  /**
   * Host-side signed-upload URLs used by the host edit flow ("기본 사진으로 저장"
   * and "새로운 사진으로 저장" buttons). Keys live under
   * `events/{eventId}/host-edits/{uuid}` so the host-only replace and create
   * endpoints can validate the event prefix without conflicting with the
   * guest `events/{eventId}/{guestId}/...` prefix.
   */
  async createHostEditUploadSignedUrls(
    eventId: string,
    mimeType: string,
    fileCount: number,
  ) {
    if (!this.bucketName) {
      throw new InternalServerErrorException('GCS bucket is not configured');
    }

    try {
      return await Promise.all(
        Array.from({ length: fileCount }, async () => {
          const fileKey = `events/${eventId}/host-edits/${uuidv4()}`;
          const [uploadUrl] = await this.storage
            .bucket(this.bucketName)
            .file(fileKey)
            .getSignedUrl({
              version: 'v4',
              action: 'write',
              expires: Date.now() + 5 * 60 * 1000,
              contentType: mimeType,
            });
          return { uploadUrl, fileKey };
        }),
      );
    } catch {
      throw new InternalServerErrorException('GCS signed URL creation failed');
    }
  }

  async createEventThumbnailUploadSignedUrl(eventId: string, mimeType: string) {
    if (!this.bucketName) {
      throw new InternalServerErrorException('GCS bucket is not configured');
    }

    try {
      const fileKey = `events/${eventId}/thumbnail/${uuidv4()}`;
      const [uploadUrl] = await this.storage
        .bucket(this.bucketName)
        .file(fileKey)
        .getSignedUrl({
          version: 'v4',
          action: 'write',
          expires: Date.now() + 5 * 60 * 1000,
          contentType: mimeType,
        });

      return { uploadUrl, fileKey };
    } catch {
      throw new InternalServerErrorException('GCS signed URL creation failed');
    }
  }

  async getReadUrl(fileKey: string) {
    if (!this.bucketName) {
      return null;
    }

    try {
      const [url] = await this.storage
        .bucket(this.bucketName)
        .file(fileKey)
        .getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 15 * 60 * 1000,
        });

      return url;
    } catch {
      throw new InternalServerErrorException('GCS read URL creation failed');
    }
  }

  async deleteObject(fileKey: string) {
    if (!this.bucketName) {
      return;
    }

    try {
      await this.storage.bucket(this.bucketName).file(fileKey).delete({
        ignoreNotFound: true,
      });
    } catch {
      throw new InternalServerErrorException('GCS object deletion failed');
    }
  }

  /**
   * Downloads only the first N bytes of the object as a Buffer. Used by the
   * EXIF extractor — JPEG EXIF/IPTC metadata is almost always within the first
   * 64 KB, so we avoid pulling the whole multi-MB image just to read the
   * shutter timestamp.
   */
  async downloadObjectPrefix(
    fileKey: string,
    byteCount: number,
  ): Promise<Buffer> {
    if (!this.bucketName) {
      throw new InternalServerErrorException('GCS bucket is not configured');
    }

    try {
      const stream = this.storage
        .bucket(this.bucketName)
        .file(fileKey)
        .createReadStream({ start: 0, end: Math.max(0, byteCount - 1) });
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }
      return Buffer.concat(chunks);
    } catch {
      throw new InternalServerErrorException('GCS prefix download failed');
    }
  }

  async downloadObject(
    fileKey: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    if (!this.bucketName) {
      throw new InternalServerErrorException('GCS bucket is not configured');
    }

    try {
      const file = this.storage.bucket(this.bucketName).file(fileKey);
      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();
      const contentType =
        typeof metadata.contentType === 'string' &&
        metadata.contentType.length > 0
          ? metadata.contentType
          : 'application/octet-stream';
      return { buffer, contentType };
    } catch {
      throw new InternalServerErrorException('GCS object download failed');
    }
  }

  async uploadEnhancedObject(
    eventId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    if (!this.bucketName) {
      throw new InternalServerErrorException('GCS bucket is not configured');
    }

    try {
      const fileKey = `events/${eventId}/enhanced/${uuidv4()}`;
      await this.storage.bucket(this.bucketName).file(fileKey).save(buffer, {
        contentType: mimeType,
        resumable: false,
      });
      return fileKey;
    } catch {
      throw new InternalServerErrorException('GCS object upload failed');
    }
  }
}
