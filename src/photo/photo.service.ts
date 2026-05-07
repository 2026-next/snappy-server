import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { PhotoRepository } from './repositories/photo.repository';
import { StorageService } from '../storage/storage.service';

const PAGE_SIZE = 20;
const COMPOSITION_THRESHOLD = 0.85;
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

type CompositionPhoto = Awaited<
  ReturnType<PhotoRepository['findEmbeddingsByEvent']>
>[number];

@Injectable()
export class PhotoService {
  constructor(
    private readonly photoRepository: PhotoRepository,
    private readonly storageService: StorageService,
  ) {}

  async getSignedUrls(guestId: string, mimeType: string, fileCount: number) {
    const guest = await this.getGuestOrThrow(guestId);
    this.assertSupportedMimeType(mimeType);

    return {
      uploadUrls: await this.storageService.createUploadSignedUrls(
        guest.eventId,
        guestId,
        mimeType,
        fileCount,
      ),
    };
  }

  async create(guestId: string, createPhotoDto: CreatePhotoDto) {
    const guest = await this.getGuestOrThrow(guestId);
    this.assertValidGuestFileKey(
      createPhotoDto.fileKey,
      guest.eventId,
      guestId,
    );

    if (createPhotoDto.mimeType) {
      this.assertSupportedMimeType(createPhotoDto.mimeType);
    }

    try {
      return this.photoRepository.createPhoto({
        eventId: guest.eventId,
        guestId,
        originalObjectKey: createPhotoDto.fileKey,
        mimeType: createPhotoDto.mimeType,
        fileSizeBytes: createPhotoDto.fileSizeBytes,
        width: createPhotoDto.width,
        height: createPhotoDto.height,
        exifTakenAt: createPhotoDto.exifTakenAt
          ? new Date(createPhotoDto.exifTakenAt)
          : undefined,
        embedding: createPhotoDto.embedding ?? [],
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Photo metadata already exists');
      }

      throw error;
    }
  }

  async findAllByGuest(guestId: string) {
    const guest = await this.getGuestOrThrow(guestId);
    return this.photoRepository.findPhotosByGuest(guestId, guest.eventId);
  }

  async remove(photoId: string, guestId: string) {
    const guest = await this.getGuestOrThrow(guestId);
    const photo = await this.photoRepository.findGuestPhoto(
      photoId,
      guestId,
      guest.eventId,
    );

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    if (photo.isDownloaded) {
      return {
        photo,
        deleted: false,
        warning: '신랑/신부가 이미 사진을 다운받았을 수도 있습니다.',
      };
    }

    await this.photoRepository.softDeletePhoto(photoId);
    await this.storageService.deleteObject(photo.originalObjectKey);
  }

  async getFullAlbum(
    userId: string,
    eventId: string,
    offset: number,
    page: number,
    order: 'asc' | 'desc',
  ) {
    await this.assertEventOwner(eventId, userId);
    const skip = offset + (page - 1) * PAGE_SIZE;
    const { photos, total } =
      await this.photoRepository.findAllByEventPaginated(
        eventId,
        skip,
        PAGE_SIZE,
        order,
      );

    return { photos, pagination: { total, offset, page, pageSize: PAGE_SIZE } };
  }

  async getTimeline(userId: string, eventId: string) {
    await this.assertEventOwner(eventId, userId);
    return this.photoRepository.findTimelineByEvent(eventId);
  }

  async getGroupedByUploader(userId: string, eventId: string) {
    await this.assertEventOwner(eventId, userId);
    const photos = await this.photoRepository.findAllByEvent(eventId);
    return this.groupByUploader(photos);
  }

  async getGroupedByComposition(userId: string, eventId: string) {
    await this.assertEventOwner(eventId, userId);
    const photos = await this.photoRepository.findEmbeddingsByEvent(eventId);
    return this.groupByComposition(photos);
  }

  async getDetail(userId: string, photoId: string) {
    const photo = await this.photoRepository.findPhotoDetailForOwner(
      photoId,
      userId,
    );

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    return {
      ...photo,
      originalPhotoUrl: await this.storageService.getReadUrl(
        photo.originalObjectKey,
      ),
    };
  }

  async searchUploader(userId: string, eventId: string, name: string) {
    await this.assertEventOwner(eventId, userId);
    const photos = await this.photoRepository.searchUploaders(eventId, name);
    return this.groupByUploader(photos);
  }

  async toggleFavorite(userId: string, photoId: string) {
    const photo = await this.photoRepository.findPhotoForOwner(photoId, userId);

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    return this.photoRepository.toggleFavorite(photoId, !photo.isFavorite);
  }

  private async assertEventOwner(eventId: string, userId: string) {
    const event = await this.photoRepository.findEventOwnedByUser(
      eventId,
      userId,
    );
    if (!event) {
      throw new ForbiddenException('Event access is denied');
    }
  }

  private async getGuestOrThrow(guestId: string) {
    const guest = await this.photoRepository.findGuestById(guestId);
    if (!guest) {
      throw new ForbiddenException('Guest event access is denied');
    }

    return guest;
  }

  private assertValidGuestFileKey(
    fileKey: string,
    eventId: string,
    guestId: string,
  ) {
    const expectedPrefix = `events/${eventId}/${guestId}/`;
    if (!fileKey.startsWith(expectedPrefix)) {
      throw new UnprocessableEntityException('Invalid photo file key');
    }
  }

  private assertSupportedMimeType(mimeType: string) {
    if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new UnprocessableEntityException('Unsupported image MIME type');
    }
  }

  private groupByUploader<
    T extends {
      uploadedByGuest: { name: string } | null;
    },
  >(photos: T[]) {
    return photos.reduce<Record<string, T[]>>((groups, photo) => {
      const uploaderName = photo.uploadedByGuest?.name ?? '익명';
      groups[uploaderName] = [...(groups[uploaderName] ?? []), photo];
      return groups;
    }, {});
  }

  private groupByComposition(photos: CompositionPhoto[]) {
    const groups: Record<string, CompositionPhoto[]> = {};
    const visited = new Set<string>();
    let groupCount = 1;

    for (let i = 0; i < photos.length; i += 1) {
      if (visited.has(photos[i].id)) {
        continue;
      }

      const currentGroup = [photos[i]];
      visited.add(photos[i].id);

      for (let j = i + 1; j < photos.length; j += 1) {
        if (visited.has(photos[j].id)) {
          continue;
        }

        const similarity = this.calculateCosineSimilarity(
          photos[i].embedding,
          photos[j].embedding,
        );

        if (similarity > COMPOSITION_THRESHOLD) {
          currentGroup.push(photos[j]);
          visited.add(photos[j].id);
        }
      }

      groups[`구도 ${groupCount}`] = currentGroup;
      groupCount += 1;
    }

    return groups;
  }

  private calculateCosineSimilarity(vecA: number[], vecB: number[]) {
    if (vecA.length === 0 || vecA.length !== vecB.length) {
      return 0;
    }

    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    if (magA === 0 || magB === 0) {
      return 0;
    }

    return dotProduct / (magA * magB);
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
