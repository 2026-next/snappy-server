import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SessionType, type Photo } from '@prisma/client';
import { CreateHostPhotoDto } from './dto/create-host-photo.dto';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { CreatePhotoGroupDto } from './dto/create-photo-group.dto';
import type { PhotoSortBy } from './dto/photo-query.dto';
import { PhotoGroupPhotosDto } from './dto/photo-group-photos.dto';
import { ReplacePhotoFileDto } from './dto/replace-photo-file.dto';
import type { SearchField } from './dto/search-photos.dto';
import { PhotoRepository } from './repositories/photo.repository';
import { PhotoAiRepository } from './repositories/photo-ai.repository';
import { StorageService } from '../storage/storage.service';
import { AnalysisWorkerService } from './workers/analysis-worker.service';
import { ExifWorkerService } from './workers/exif-worker.service';

const PAGE_SIZE = 20;
const MATCHED_MESSAGE_MAX_LENGTH = 200;
const COMPOSITION_THRESHOLD = 0.85;
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

type CompositionPhoto = Omit<
  Awaited<ReturnType<PhotoRepository['findEmbeddingsByEvent']>>[number],
  'versions'
>;

type PhotoWithObjectKey = {
  originalObjectKey: string;
};

type UploaderMetadata = {
  id: string | null;
  name: string;
  relation: string | null;
};

type RelationCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type UploaderAliases = {
  uploaderId: string | null;
  uploaderName: string;
  uploaderRelation: RelationCode | null;
};

type PhotoWithUploader = {
  uploadedByGuest: UploaderMetadata | null;
};

type PhotoWithVersions = {
  versions?: {
    isOriginal: boolean;
    sourceJobId: string | null;
  }[];
};

const RELATION_CODES: Record<string, RelationCode> = {
  PARENT: 1,
  FRIEND: 2,
  SIBLING: 3,
  RELATIVE: 4,
  COWORKER: 5,
  ACQUAINTANCE: 6,
  OTHER: 7,
};

type PhotoWithTakenAt = PhotoWithVersions & {
  exifTakenAt: Date | null;
  uploadedAt: Date;
};

@Injectable()
export class PhotoService {
  constructor(
    private readonly photoRepository: PhotoRepository,
    private readonly photoAiRepository: PhotoAiRepository,
    private readonly storageService: StorageService,
    private readonly analysisWorker: AnalysisWorkerService,
    private readonly exifWorker: ExifWorkerService,
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

    let photo: Photo;
    try {
      photo = await this.photoRepository.createPhoto({
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

    let analysisJobId: string | null = null;
    try {
      await this.photoAiRepository.createPhotoVersion({
        photoId: photo.id,
        fileKey: photo.originalObjectKey,
        width: photo.width ?? null,
        height: photo.height ?? null,
        prompt: null,
        isOriginal: true,
      });

      const analysisJob = await this.photoAiRepository.createAnalysisJob(
        photo.id,
      );
      analysisJobId = analysisJob.id;
      this.analysisWorker.start(analysisJob.id, photo.id);
    } catch {
      // Analysis bootstrap failure must not block photo creation
      analysisJobId = null;
    }

    // Best-effort EXIF back-fill. Runs out-of-band in setImmediate; the
    // request response is unaffected. Any client-supplied exifTakenAt is
    // overwritten once the BE extraction succeeds (BE is the source of truth).
    this.exifWorker.start(photo.id, photo.originalObjectKey);

    return { ...photo, analysisJobId };
  }

  /**
   * Host-side counterpart of {@link getSignedUrls}. Used by the host edit flow
   * ("기본 사진으로 저장" / "새로운 사진으로 저장") to obtain signed PUT URLs
   * under `events/{eventId}/host-edits/...` after asserting the caller owns
   * the event.
   */
  async getHostSignedUrls(
    userId: string,
    eventId: string,
    mimeType: string,
    fileCount: number,
  ) {
    await this.assertEventOwner(eventId, userId);
    this.assertSupportedMimeType(mimeType);

    return {
      uploadUrls: await this.storageService.createHostEditUploadSignedUrls(
        eventId,
        mimeType,
        fileCount,
      ),
    };
  }

  /**
   * Host-side counterpart of {@link create}. Creates a new photo record in an
   * event the host owns — used by the "새로운 사진으로 저장" save mode where the
   * host's edited bytes become a brand-new photo (no `uploadedByGuestId`).
   * The supplied `fileKey` must live under the event prefix, which is the
   * invariant established by `getHostSignedUrls`.
   */
  async createHostPhoto(userId: string, dto: CreateHostPhotoDto) {
    await this.assertEventOwner(dto.eventId, userId);
    this.assertValidEventFileKey(dto.fileKey, dto.eventId);
    this.assertSupportedMimeType(dto.mimeType);

    // Inherit uploader + taken-at from the source photo when provided so
    // the host's edited copy doesn't lose attribution. Caller-supplied
    // exifTakenAt still wins if both are present.
    let inheritedGuestId: string | null = null;
    let inheritedExifTakenAt: Date | undefined;
    if (dto.sourcePhotoId) {
      const source = await this.photoRepository.findPhotoMetadataForHost(
        dto.sourcePhotoId,
        userId,
      );
      if (source && source.eventId === dto.eventId) {
        inheritedGuestId = source.uploadedByGuestId ?? null;
        inheritedExifTakenAt = source.exifTakenAt ?? undefined;
      }
    }

    let photo: Photo;
    try {
      photo = await this.photoRepository.createPhoto({
        eventId: dto.eventId,
        guestId: inheritedGuestId,
        originalObjectKey: dto.fileKey,
        mimeType: dto.mimeType,
        fileSizeBytes: dto.fileSizeBytes,
        width: dto.width,
        height: dto.height,
        exifTakenAt: dto.exifTakenAt
          ? new Date(dto.exifTakenAt)
          : inheritedExifTakenAt,
        embedding: [],
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Photo metadata already exists');
      }
      throw error;
    }

    let analysisJobId: string | null = null;
    try {
      await this.photoAiRepository.createPhotoVersion({
        photoId: photo.id,
        fileKey: photo.originalObjectKey,
        width: photo.width ?? null,
        height: photo.height ?? null,
        prompt: null,
        isOriginal: true,
      });

      const analysisJob = await this.photoAiRepository.createAnalysisJob(
        photo.id,
      );
      analysisJobId = analysisJob.id;
      this.analysisWorker.start(analysisJob.id, photo.id);
    } catch {
      analysisJobId = null;
    }

    this.exifWorker.start(photo.id, photo.originalObjectKey);

    return { ...photo, analysisJobId };
  }

  async findAllByGuest(guestId: string) {
    const guest = await this.getGuestOrThrow(guestId);
    const photos = await this.photoRepository.findPhotosByGuest(
      guestId,
      guest.eventId,
    );

    return this.withOriginalPhotoUrls(photos);
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
    sortBy: PhotoSortBy = 'uploadedAt',
    order: 'asc' | 'desc' = 'desc',
  ) {
    await this.assertEventOwner(eventId, userId);
    const photos = await this.photoRepository.findAllByEventOrdered(
      eventId,
      sortBy,
      order,
    );
    const sortedPhotos =
      sortBy === 'takenAt' ? this.sortPhotosByTakenAt(photos, order) : photos;
    return this.withOriginalPhotoUrls(sortedPhotos);
  }

  async getTimeline(userId: string, eventId: string) {
    await this.assertEventOwner(eventId, userId);
    const photos = await this.photoRepository.findTimelineByEvent(eventId);
    return this.groupByTimeline(await this.withOriginalPhotoUrls(photos));
  }

  async getFavoritePhotos(userId: string, eventId: string) {
    await this.assertEventOwner(eventId, userId);
    const photos = await this.photoRepository.findAllByEvent(eventId, true);
    return this.withOriginalPhotoUrls(photos);
  }

  async getGroupedByUploader(userId: string, eventId: string) {
    await this.assertEventOwner(eventId, userId);
    const photos = await this.photoRepository.findAllByEvent(eventId);
    return this.groupByUploader(await this.withOriginalPhotoUrls(photos));
  }

  async getGroupedByComposition(userId: string, eventId: string) {
    await this.assertEventOwner(eventId, userId);
    const photos = await this.photoRepository.findEmbeddingsByEvent(eventId);
    return this.groupByComposition(await this.withOriginalPhotoUrls(photos));
  }

  async getDetail(userId: string, photoId: string) {
    const photo = await this.photoRepository.findPhotoDetailForOwner(
      photoId,
      userId,
    );

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    const originalPhotoUrl = await this.storageService.getReadUrl(
      photo.originalObjectKey,
    );

    const uploaderMessageRecord = photo.uploadedByGuest?.messages?.[0] ?? null;
    const uploaderMessage = uploaderMessageRecord
      ? {
          id: uploaderMessageRecord.id,
          content: uploaderMessageRecord.content,
          createdAt: uploaderMessageRecord.createdAt,
          updatedAt: uploaderMessageRecord.updatedAt,
        }
      : null;
    const uploadedByGuest = photo.uploadedByGuest
      ? {
          id: photo.uploadedByGuest.id,
          name: photo.uploadedByGuest.name,
          relation: photo.uploadedByGuest.relation,
        }
      : null;

    const { versions, ...photoWithoutVersions } = photo;
    void versions;
    const photoWithoutMessages = { ...photoWithoutVersions, uploadedByGuest };

    return {
      ...photoWithoutMessages,
      ...this.getPhotoUploaderAliases(photoWithoutMessages),
      ...this.getRetouchFlags(photo),
      originalPhotoUrl,
      url: originalPhotoUrl,
      signedUrl: originalPhotoUrl,
      uploaderMessage,
    };
  }

  async searchUploader(userId: string, eventId: string, name: string) {
    await this.assertEventOwner(eventId, userId);
    const photos = await this.photoRepository.searchUploaders(eventId, name);
    return this.getUniqueUploaders(photos);
  }

  async searchPhotos(
    principal: { sub: string; sessionType: SessionType },
    params: {
      eventId: string;
      query: string;
      fields: SearchField[];
      order: 'asc' | 'desc';
    },
  ) {
    await this.assertEventAccess(params.eventId, principal);

    const trimmedQuery = params.query.trim();
    if (trimmedQuery.length === 0) {
      throw new UnprocessableEntityException(
        'Search query must not be empty or whitespace only',
      );
    }

    const escapedQuery = this.escapeLikePattern(trimmedQuery);
    const includeName = params.fields.includes('name');
    const includeMessage = params.fields.includes('message');

    if (!includeName && !includeMessage) {
      // Only `tags` requested but tag schema not yet modeled — return empty.
      return [];
    }

    const photos = await this.photoRepository.searchPhotosByEvent({
      eventId: params.eventId,
      query: escapedQuery,
      includeName,
      includeMessage,
      order: params.order,
    });

    const signedPhotos = await this.withOriginalPhotoUrls(photos);
    return signedPhotos.map((photo) => {
      const messages =
        (
          photo as {
            uploadedByGuest?: { messages?: { content: string }[] } | null;
          }
        ).uploadedByGuest?.messages ?? [];
      const firstMatch = includeMessage ? messages[0] : undefined;
      const matchedMessage = firstMatch
        ? this.truncateMatchedMessage(firstMatch.content)
        : null;

      const { uploadedByGuest, ...rest } = photo;
      const cleanedUploadedByGuest = uploadedByGuest
        ? {
            id: uploadedByGuest.id,
            name: uploadedByGuest.name,
            relation: uploadedByGuest.relation,
          }
        : null;

      return {
        ...rest,
        uploadedByGuest: cleanedUploadedByGuest,
        matchedMessage,
      };
    });
  }

  async toggleFavorite(userId: string, photoId: string) {
    const photo = await this.photoRepository.findPhotoForOwner(photoId, userId);

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    return this.photoRepository.toggleFavorite(photoId, !photo.isFavorite);
  }

  /**
   * Host (event owner) soft-hides a photo from every host-facing query.
   * The underlying object in storage is intentionally kept — the uploader
   * guest still sees the photo in their own /photo/my listing. Idempotent:
   * calling it on a photo that is already hidden is a no-op success.
   */
  async hidePhotoForHost(userId: string, photoId: string) {
    const photo = await this.photoRepository.findPhotoForHostIncludingHidden(
      photoId,
      userId,
    );

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    if (photo.hiddenByHostAt) {
      return;
    }

    await this.photoRepository.markPhotoHiddenByHost(photoId);
  }

  /**
   * Host overrides a photo's underlying file with edited bytes. The Photo row
   * stays in place (same id, uploader, message, favorites, group memberships,
   * uploadedAt/createdAt/exifTakenAt) — only the object key and derived file
   * metadata change, and updatedAt advances. Old object is best-effort deleted.
   */
  async replacePhotoFile(
    userId: string,
    photoId: string,
    dto: ReplacePhotoFileDto,
  ) {
    const existing = await this.photoRepository.findPhotoForHostReplacement(
      photoId,
      userId,
    );

    if (!existing) {
      throw new NotFoundException('Photo not found');
    }

    this.assertSupportedMimeType(dto.mimeType);
    this.assertValidEventFileKey(dto.fileKey, existing.eventId);

    if (dto.fileKey === existing.originalObjectKey) {
      throw new UnprocessableEntityException(
        'New fileKey must differ from the current originalObjectKey',
      );
    }

    try {
      await this.photoRepository.replacePhotoFile(photoId, {
        originalObjectKey: dto.fileKey,
        mimeType: dto.mimeType,
        fileSizeBytes: dto.fileSizeBytes ?? null,
        width: dto.width ?? null,
        height: dto.height ?? null,
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Another photo already references that fileKey',
        );
      }
      throw error;
    }

    // Best-effort cleanup of the prior file. Failure here must not roll back
    // the replace — the metadata swap has already committed.
    try {
      await this.storageService.deleteObject(existing.originalObjectKey);
    } catch {
      // ignored — leaving an orphan object is preferable to surfacing a
      // 500 after the DB swap already succeeded.
    }

    return this.getDetail(userId, photoId);
  }

  async createPhotoGroup(userId: string, dto: CreatePhotoGroupDto) {
    await this.assertEventOwner(dto.eventId, userId);
    const photoIds = this.getUniquePhotoIds(dto.photoIds ?? []);
    await this.assertPhotosBelongToEvent(dto.eventId, photoIds);

    try {
      return await this.photoRepository.createPhotoGroup({
        eventId: dto.eventId,
        userId,
        name: dto.name,
        photoIds,
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Photo group name already exists');
      }

      throw error;
    }
  }

  async getPhotoGroups(userId: string, eventId: string) {
    await this.assertEventOwner(eventId, userId);
    return this.photoRepository.findPhotoGroupsByEvent(eventId);
  }

  async getPhotoGroupPhotos(
    userId: string,
    groupId: string,
    offset: number,
    page: number,
    order: 'asc' | 'desc',
  ) {
    await this.getPhotoGroupForOwnerOrThrow(groupId, userId);
    const skip = offset + (page - 1) * PAGE_SIZE;
    const { photos, total } =
      await this.photoRepository.findPhotoGroupPhotosPaginated(
        groupId,
        skip,
        PAGE_SIZE,
        order,
      );

    return {
      photos: await this.withOriginalPhotoUrls(photos),
      pagination: { total, offset, page, pageSize: PAGE_SIZE },
    };
  }

  async addPhotosToGroup(
    userId: string,
    groupId: string,
    dto: PhotoGroupPhotosDto,
  ) {
    const group = await this.getPhotoGroupForOwnerOrThrow(groupId, userId);
    const photoIds = this.getUniquePhotoIds(dto.photoIds);
    await this.assertPhotosBelongToEvent(group.eventId, photoIds);
    return this.photoRepository.addPhotosToGroup(groupId, photoIds);
  }

  async replaceGroupPhotos(
    userId: string,
    groupId: string,
    dto: PhotoGroupPhotosDto,
  ) {
    const group = await this.getPhotoGroupForOwnerOrThrow(groupId, userId);
    const photoIds = this.getUniquePhotoIds(dto.photoIds);
    await this.assertPhotosBelongToEvent(group.eventId, photoIds);
    return this.photoRepository.replaceGroupPhotos(groupId, photoIds);
  }

  async removePhotoFromGroup(userId: string, groupId: string, photoId: string) {
    await this.getPhotoGroupForOwnerOrThrow(groupId, userId);
    const result = await this.photoRepository.removePhotoFromGroup(
      groupId,
      photoId,
    );

    if (result.count === 0) {
      throw new NotFoundException('Photo group membership not found');
    }

    return { removed: true };
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

  private async assertEventAccess(
    eventId: string,
    principal: { sub: string; sessionType: SessionType },
  ) {
    if (principal.sessionType === SessionType.USER) {
      await this.assertEventOwner(eventId, principal.sub);
      return;
    }

    if (principal.sessionType === SessionType.GUEST) {
      const guest = await this.photoRepository.findGuestById(principal.sub);
      if (!guest || guest.eventId !== eventId) {
        throw new ForbiddenException('Event access is denied');
      }
      return;
    }

    throw new ForbiddenException('Event access is denied');
  }

  private escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
  }

  private truncateMatchedMessage(content: string): string {
    if (content.length <= MATCHED_MESSAGE_MAX_LENGTH) {
      return content;
    }
    return content.slice(0, MATCHED_MESSAGE_MAX_LENGTH);
  }

  private async getGuestOrThrow(guestId: string) {
    const guest = await this.photoRepository.findGuestById(guestId);
    if (!guest) {
      throw new ForbiddenException('Guest event access is denied');
    }

    return guest;
  }

  private async getPhotoGroupForOwnerOrThrow(groupId: string, userId: string) {
    const group = await this.photoRepository.findPhotoGroupForOwner(
      groupId,
      userId,
    );

    if (!group) {
      throw new NotFoundException('Photo group not found');
    }

    return group;
  }

  private async assertPhotosBelongToEvent(eventId: string, photoIds: string[]) {
    if (photoIds.length === 0) {
      return;
    }

    const photos = await this.photoRepository.findPhotosByIdsForEvent(
      eventId,
      photoIds,
    );

    if (photos.length !== photoIds.length) {
      throw new UnprocessableEntityException(
        'One or more photos do not belong to the event',
      );
    }
  }

  private getUniquePhotoIds(photoIds: string[]) {
    return [...new Set(photoIds)];
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

  private assertValidEventFileKey(fileKey: string, eventId: string) {
    const expectedPrefix = `events/${eventId}/`;
    if (!fileKey.startsWith(expectedPrefix)) {
      throw new UnprocessableEntityException('Invalid photo file key');
    }
  }

  private assertSupportedMimeType(mimeType: string) {
    if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new UnprocessableEntityException('Unsupported image MIME type');
    }
  }

  private async withOriginalPhotoUrls<T extends PhotoWithObjectKey>(
    photos: (T & PhotoWithVersions)[],
  ) {
    return Promise.all(
      photos.map(async (photo) => {
        const { versions, ...photoWithoutVersions } = photo;
        void versions;
        const originalPhotoUrl = await this.storageService.getReadUrl(
          photo.originalObjectKey,
        );

        return {
          ...photoWithoutVersions,
          ...this.getPhotoUploaderAliases(photo),
          ...this.getRetouchFlags(photo),
          originalPhotoUrl,
          url: originalPhotoUrl,
          signedUrl: originalPhotoUrl,
        };
      }),
    );
  }

  private getRetouchFlags(photo: PhotoWithVersions) {
    const isRetouched = (photo.versions ?? []).some(
      (version) => version.isOriginal === false || version.sourceJobId != null,
    );

    return {
      isRetouched,
      retouched: isRetouched,
    };
  }

  private sortPhotosByTakenAt<T extends PhotoWithTakenAt>(
    photos: T[],
    order: 'asc' | 'desc',
  ) {
    const direction = order === 'asc' ? 1 : -1;
    return [...photos].sort((a, b) => {
      const aTakenAt = a.exifTakenAt ?? a.uploadedAt;
      const bTakenAt = b.exifTakenAt ?? b.uploadedAt;
      return (aTakenAt.getTime() - bTakenAt.getTime()) * direction;
    });
  }

  private groupByTimeline<T extends PhotoWithTakenAt>(photos: T[]) {
    const groups = new Map<string, T[]>();

    for (const photo of photos) {
      const takenAt = photo.exifTakenAt ?? photo.uploadedAt;
      const key = this.formatTimelineKey(takenAt);
      groups.set(key, [...(groups.get(key) ?? []), photo]);
    }

    return [...groups.entries()].map(([key, groupedPhotos]) => {
      const [date, time] = key.split(' ');
      return {
        date,
        time,
        photos: groupedPhotos,
        totalCount: groupedPhotos.length,
      };
    });
  }

  private formatTimelineKey(date: Date) {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }

  private groupByUploader<T extends PhotoWithUploader>(photos: T[]) {
    const groups = new Map<
      string,
      { uploader: UploaderMetadata; photos: T[] }
    >();

    for (const photo of photos) {
      const uploader = this.getUploaderMetadata(photo);
      const key = uploader.id ?? 'anonymous';
      const group = groups.get(key) ?? { uploader, photos: [] };
      groups.set(key, { ...group, photos: [...group.photos, photo] });
    }

    return [...groups.values()].map(({ uploader, photos: groupedPhotos }) => {
      const aliases = this.getUploaderAliases(uploader);
      return {
        id: uploader.id,
        uploaderId: aliases.uploaderId,
        name: uploader.name,
        uploaderName: aliases.uploaderName,
        relation: aliases.uploaderRelation,
        uploaderRelation: aliases.uploaderRelation,
        uploader,
        photos: groupedPhotos,
        totalCount: groupedPhotos.length,
      };
    });
  }

  private getUniqueUploaders<T extends PhotoWithUploader>(photos: T[]) {
    const uploaders = new Map<string, UploaderMetadata>();

    for (const photo of photos) {
      if (photo.uploadedByGuest?.id) {
        uploaders.set(
          photo.uploadedByGuest.id,
          this.getUploaderMetadata(photo),
        );
      }
    }

    return [...uploaders.values()].map((uploader) => {
      const aliases = this.getUploaderAliases(uploader);
      return {
        id: uploader.id,
        uploaderId: aliases.uploaderId,
        name: uploader.name,
        uploaderName: aliases.uploaderName,
        relation: aliases.uploaderRelation,
        uploaderRelation: aliases.uploaderRelation,
      };
    });
  }

  private getPhotoUploaderAliases(photo: PhotoWithObjectKey) {
    if (!this.hasUploaderMetadata(photo) || !photo.uploadedByGuest) {
      return {};
    }

    return this.getUploaderAliases(photo.uploadedByGuest);
  }

  private hasUploaderMetadata(
    photo: PhotoWithObjectKey,
  ): photo is PhotoWithObjectKey & PhotoWithUploader {
    return 'uploadedByGuest' in photo;
  }

  private getUploaderMetadata(photo: PhotoWithUploader): UploaderMetadata {
    return (
      photo.uploadedByGuest ?? {
        id: null,
        name: '익명',
        relation: null,
      }
    );
  }

  private getUploaderAliases(uploader: UploaderMetadata): UploaderAliases {
    return {
      uploaderId: uploader.id,
      uploaderName: uploader.name,
      uploaderRelation: this.getRelationCode(uploader.relation),
    };
  }

  private getRelationCode(relation: string | null): RelationCode | null {
    if (!relation) {
      return null;
    }

    return RELATION_CODES[relation] ?? null;
  }

  private groupByComposition<T extends CompositionPhoto>(photos: T[]) {
    const groups: { groupName: string; photos: T[]; totalCount: number }[] = [];
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

      groups.push({
        groupName: `구도 ${groupCount}`,
        photos: currentGroup,
        totalCount: currentGroup.length,
      });
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
