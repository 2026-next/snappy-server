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
