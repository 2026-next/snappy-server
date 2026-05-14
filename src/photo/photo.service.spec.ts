import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SessionType } from '@prisma/client';
import { PhotoService } from './photo.service';
import { PhotoRepository } from './repositories/photo.repository';
import { PhotoAiRepository } from './repositories/photo-ai.repository';
import { StorageService } from '../storage/storage.service';
import { AnalysisWorkerService } from './workers/analysis-worker.service';
import { ExifWorkerService } from './workers/exif-worker.service';

jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

type GuestLookup = {
  id: string;
  name: string;
  eventId: string;
};

type Uploader = {
  id: string;
  name: string;
  relation: string;
};

type GuestPhoto = {
  id: string;
  eventId: string;
  uploadedByGuestId: string;
  originalObjectKey: string;
};

type UploaderMessage = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

type UploaderWithMessages = Uploader & { messages?: UploaderMessage[] };

type OwnerPhoto = {
  id: string;
  originalObjectKey: string;
  uploadedAt: Date;
  exifTakenAt: Date | null;
  uploadedByGuest: UploaderWithMessages | null;
  embedding: number[];
  isFavorite: boolean;
};

type PhotoGroupLookup = {
  id: string;
  eventId: string;
};

describe('PhotoService', () => {
  let service: PhotoService;
  const photoRepository = {
    findGuestById: jest.fn<(guestId: string) => Promise<GuestLookup | null>>(),
    findPhotosByGuest:
      jest.fn<(guestId: string, eventId: string) => Promise<GuestPhoto[]>>(),
    findEventOwnedByUser:
      jest.fn<
        (eventId: string, userId: string) => Promise<{ id: string } | null>
      >(),
    findAllByEventOrdered:
      jest.fn<
        (eventId: string, order: 'asc' | 'desc') => Promise<OwnerPhoto[]>
      >(),
    findTimelineByEvent: jest.fn<(eventId: string) => Promise<OwnerPhoto[]>>(),
    findAllByEvent:
      jest.fn<
        (eventId: string, onlyFavorites?: boolean) => Promise<OwnerPhoto[]>
      >(),
    findEmbeddingsByEvent:
      jest.fn<(eventId: string) => Promise<OwnerPhoto[]>>(),
    searchUploaders:
      jest.fn<(eventId: string, name: string) => Promise<OwnerPhoto[]>>(),
    searchPhotosByEvent:
      jest.fn<
        (params: {
          eventId: string;
          query: string;
          includeName: boolean;
          includeMessage: boolean;
          order: 'asc' | 'desc';
        }) => Promise<OwnerPhoto[]>
      >(),
    findPhotoDetailForOwner:
      jest.fn<
        (photoId: string, userId: string) => Promise<OwnerPhoto | null>
      >(),
    findPhotoGroupForOwner:
      jest.fn<
        (groupId: string, userId: string) => Promise<PhotoGroupLookup | null>
      >(),
    findPhotoGroupPhotosPaginated:
      jest.fn<
        (
          groupId: string,
          skip: number,
          take: number,
          order: 'asc' | 'desc',
        ) => Promise<{ photos: OwnerPhoto[]; total: number }>
      >(),
    findPhotoForHostIncludingHidden:
      jest.fn<
        (
          photoId: string,
          userId: string,
        ) => Promise<{ id: string; hiddenByHostAt: Date | null } | null>
      >(),
    markPhotoHiddenByHost:
      jest.fn<
        (
          photoId: string,
          hiddenAt?: Date,
        ) => Promise<{ id: string; hiddenByHostAt: Date }>
      >(),
    findPhotoForHostReplacement:
      jest.fn<
        (
          photoId: string,
          userId: string,
        ) => Promise<{
          id: string;
          eventId: string;
          originalObjectKey: string;
        } | null>
      >(),
    replacePhotoFile:
      jest.fn<
        (
          photoId: string,
          data: {
            originalObjectKey: string;
            mimeType: string;
            fileSizeBytes: number | null;
            width: number | null;
            height: number | null;
          },
        ) => Promise<{ id: string; originalObjectKey: string }>
      >(),
  };
  const storageService = {
    getReadUrl: jest.fn<(fileKey: string) => Promise<string | null>>(),
    deleteObject: jest.fn<(fileKey: string) => Promise<void>>(),
  };
  const photoAiRepository = {
    createPhotoVersion: jest.fn(),
    createAnalysisJob: jest.fn(),
  };
  const analysisWorker = {
    start: jest.fn(),
  };
  const exifWorker = {
    start: jest.fn(),
  };

  const uploader: Uploader = {
    id: 'guest-1',
    name: 'Guest',
    relation: 'FRIEND',
  };

  const createPhoto = (
    id: string,
    originalObjectKey: string,
    overrides: Partial<OwnerPhoto> = {},
  ): OwnerPhoto => ({
    id,
    originalObjectKey,
    uploadedAt: new Date('2026-05-12T08:30:00.000Z'),
    exifTakenAt: null,
    uploadedByGuest: uploader,
    embedding: [1, 0],
    isFavorite: false,
    ...overrides,
  });

  const signedUrlFields = (url: string) => ({
    originalPhotoUrl: url,
    url,
    signedUrl: url,
  });

  const uploaderAliasFields = (
    uploaderId: string,
    uploaderName: string,
    uploaderRelation: number,
  ) => ({
    uploaderId,
    uploaderName,
    uploaderRelation,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    photoRepository.findEventOwnedByUser.mockResolvedValue({ id: 'event-1' });
    storageService.getReadUrl.mockImplementation((fileKey) =>
      Promise.resolve(`https://signed.example/${fileKey}`),
    );
    storageService.deleteObject.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        PhotoService,
        { provide: PhotoRepository, useValue: photoRepository },
        { provide: PhotoAiRepository, useValue: photoAiRepository },
        { provide: StorageService, useValue: storageService },
        { provide: AnalysisWorkerService, useValue: analysisWorker },
        { provide: ExifWorkerService, useValue: exifWorker },
      ],
    }).compile();

    service = moduleRef.get(PhotoService);
  });

  it('adds compatible signed URL fields to guest photos', async () => {
    photoRepository.findGuestById.mockResolvedValue({
      id: 'guest-1',
      name: 'Guest',
      eventId: 'event-1',
    });
    photoRepository.findPhotosByGuest.mockResolvedValue([
      {
        id: 'photo-1',
        eventId: 'event-1',
        uploadedByGuestId: 'guest-1',
        originalObjectKey: 'events/event-1/guest-1/photo-1',
      },
    ]);

    const photos = await service.findAllByGuest('guest-1');

    expect(photoRepository.findPhotosByGuest).toHaveBeenCalledWith(
      'guest-1',
      'event-1',
    );
    expect(storageService.getReadUrl).toHaveBeenCalledWith(
      'events/event-1/guest-1/photo-1',
    );
    expect(storageService.getReadUrl).toHaveBeenCalledTimes(1);
    expect(photos).toEqual([
      {
        id: 'photo-1',
        eventId: 'event-1',
        uploadedByGuestId: 'guest-1',
        originalObjectKey: 'events/event-1/guest-1/photo-1',
        ...signedUrlFields(
          'https://signed.example/events/event-1/guest-1/photo-1',
        ),
      },
    ]);
  });

  it('returns every event photo with signed URL fields and no pagination envelope', async () => {
    const photo = createPhoto('photo-1', 'album/photo-1');
    photoRepository.findAllByEventOrdered.mockResolvedValue([photo]);

    const album = await service.getFullAlbum('user-1', 'event-1', 'desc');

    expect(photoRepository.findAllByEventOrdered).toHaveBeenCalledWith(
      'event-1',
      'desc',
    );
    expect(album).toEqual([
      {
        ...photo,
        ...uploaderAliasFields('guest-1', 'Guest', 2),
        ...signedUrlFields('https://signed.example/album/photo-1'),
      },
    ]);
  });

  it('returns timeline buckets with signed photo URLs', async () => {
    const firstPhoto = createPhoto('photo-1', 'timeline/photo-1', {
      exifTakenAt: new Date('2026-05-10T01:02:00.000Z'),
    });
    const secondPhoto = createPhoto('photo-2', 'timeline/photo-2', {
      uploadedAt: new Date('2026-05-11T03:04:00.000Z'),
    });
    photoRepository.findTimelineByEvent.mockResolvedValue([
      firstPhoto,
      secondPhoto,
    ]);

    const timeline = await service.getTimeline('user-1', 'event-1');

    expect(timeline).toEqual([
      {
        date: '2026-05-10',
        time: '01:02',
        photos: [
          {
            ...firstPhoto,
            ...uploaderAliasFields('guest-1', 'Guest', 2),
            ...signedUrlFields('https://signed.example/timeline/photo-1'),
          },
        ],
        totalCount: 1,
      },
      {
        date: '2026-05-11',
        time: '03:04',
        photos: [
          {
            ...secondPhoto,
            ...uploaderAliasFields('guest-1', 'Guest', 2),
            ...signedUrlFields('https://signed.example/timeline/photo-2'),
          },
        ],
        totalCount: 1,
      },
    ]);
  });

  it('adds compatible signed URL fields to favorites', async () => {
    const photo = createPhoto('photo-1', 'favorite/photo-1', {
      isFavorite: true,
    });
    photoRepository.findAllByEvent.mockResolvedValue([photo]);

    const favorites = await service.getFavoritePhotos('user-1', 'event-1');

    expect(photoRepository.findAllByEvent).toHaveBeenCalledWith(
      'event-1',
      true,
    );
    expect(favorites).toEqual([
      {
        ...photo,
        ...uploaderAliasFields('guest-1', 'Guest', 2),
        ...signedUrlFields('https://signed.example/favorite/photo-1'),
      },
    ]);
  });

  it('returns uploader buckets with metadata and signed photo URLs', async () => {
    const namedPhoto = createPhoto('photo-1', 'uploader/photo-1');
    const anonymousPhoto = createPhoto('photo-2', 'uploader/photo-2', {
      uploadedByGuest: null,
    });
    photoRepository.findAllByEvent.mockResolvedValue([
      namedPhoto,
      anonymousPhoto,
    ]);

    const groups = await service.getGroupedByUploader('user-1', 'event-1');

    expect(groups).toEqual([
      {
        id: 'guest-1',
        uploaderId: 'guest-1',
        name: 'Guest',
        uploaderName: 'Guest',
        relation: 2,
        uploaderRelation: 2,
        uploader,
        photos: [
          {
            ...namedPhoto,
            ...uploaderAliasFields('guest-1', 'Guest', 2),
            ...signedUrlFields('https://signed.example/uploader/photo-1'),
          },
        ],
        totalCount: 1,
      },
      {
        id: null,
        uploaderId: null,
        name: '익명',
        uploaderName: '익명',
        relation: null,
        uploaderRelation: null,
        uploader: { id: null, name: '익명', relation: null },
        photos: [
          {
            ...anonymousPhoto,
            ...signedUrlFields('https://signed.example/uploader/photo-2'),
          },
        ],
        totalCount: 1,
      },
    ]);
  });

  it('returns similar composition buckets with signed photo URLs', async () => {
    const firstPhoto = createPhoto('photo-1', 'composition/photo-1', {
      embedding: [1, 0],
    });
    const similarPhoto = createPhoto('photo-2', 'composition/photo-2', {
      embedding: [0.9, 0.1],
    });
    const differentPhoto = createPhoto('photo-3', 'composition/photo-3', {
      embedding: [0, 1],
    });
    photoRepository.findEmbeddingsByEvent.mockResolvedValue([
      firstPhoto,
      similarPhoto,
      differentPhoto,
    ]);

    const groups = await service.getGroupedByComposition('user-1', 'event-1');

    expect(groups).toEqual([
      {
        groupName: '구도 1',
        photos: [
          {
            ...firstPhoto,
            ...uploaderAliasFields('guest-1', 'Guest', 2),
            ...signedUrlFields('https://signed.example/composition/photo-1'),
          },
          {
            ...similarPhoto,
            ...uploaderAliasFields('guest-1', 'Guest', 2),
            ...signedUrlFields('https://signed.example/composition/photo-2'),
          },
        ],
        totalCount: 2,
      },
      {
        groupName: '구도 2',
        photos: [
          {
            ...differentPhoto,
            ...uploaderAliasFields('guest-1', 'Guest', 2),
            ...signedUrlFields('https://signed.example/composition/photo-3'),
          },
        ],
        totalCount: 1,
      },
    ]);
  });

  it('returns deduped uploader autocomplete results', async () => {
    const repeatedUploader = createPhoto('photo-1', 'search/photo-1');
    const repeatedUploaderLater = createPhoto('photo-2', 'search/photo-2');
    const otherUploader = createPhoto('photo-3', 'search/photo-3', {
      uploadedByGuest: {
        id: 'guest-2',
        name: 'Guest Two',
        relation: 'SIBLING',
      },
    });
    photoRepository.searchUploaders.mockResolvedValue([
      repeatedUploader,
      repeatedUploaderLater,
      otherUploader,
    ]);

    const uploaders = await service.searchUploader(
      'user-1',
      'event-1',
      'Guest',
    );

    expect(uploaders).toEqual([
      {
        id: 'guest-1',
        uploaderId: 'guest-1',
        name: 'Guest',
        uploaderName: 'Guest',
        relation: 2,
        uploaderRelation: 2,
      },
      {
        id: 'guest-2',
        uploaderId: 'guest-2',
        name: 'Guest Two',
        uploaderName: 'Guest Two',
        relation: 3,
        uploaderRelation: 3,
      },
    ]);
    expect(storageService.getReadUrl).not.toHaveBeenCalled();
  });

  it('adds compatible signed URL fields while preserving photo group pagination', async () => {
    const photo = createPhoto('photo-1', 'group/photo-1');
    photoRepository.findPhotoGroupForOwner.mockResolvedValue({
      id: 'group-1',
      eventId: 'event-1',
    });
    photoRepository.findPhotoGroupPhotosPaginated.mockResolvedValue({
      photos: [photo],
      total: 7,
    });

    const groupPhotos = await service.getPhotoGroupPhotos(
      'user-1',
      'group-1',
      0,
      1,
      'asc',
    );

    expect(groupPhotos).toEqual({
      photos: [
        {
          ...photo,
          ...uploaderAliasFields('guest-1', 'Guest', 2),
          ...signedUrlFields('https://signed.example/group/photo-1'),
        },
      ],
      pagination: { total: 7, offset: 0, page: 1, pageSize: 20 },
    });
  });

  it('keeps photo detail compatible with signed URL aliases', async () => {
    const photo = createPhoto('photo-1', 'detail/photo-1');
    photoRepository.findPhotoDetailForOwner.mockResolvedValue(photo);

    const detail = await service.getDetail('user-1', 'photo-1');

    expect(detail).toEqual({
      ...photo,
      ...uploaderAliasFields('guest-1', 'Guest', 2),
      ...signedUrlFields('https://signed.example/detail/photo-1'),
      uploaderMessage: null,
    });
    expect(storageService.getReadUrl).toHaveBeenCalledTimes(1);
  });

  it('includes uploader message when uploader has authored one', async () => {
    const messageRecord: UploaderMessage = {
      id: 'message-1',
      content: '결혼 축하합니다!',
      createdAt: new Date('2026-05-12T08:30:00.000Z'),
      updatedAt: new Date('2026-05-12T08:30:00.000Z'),
    };
    const uploaderWithMessage: UploaderWithMessages = {
      ...uploader,
      messages: [messageRecord],
    };
    const photo = createPhoto('photo-1', 'detail/photo-1', {
      uploadedByGuest: uploaderWithMessage,
    });
    photoRepository.findPhotoDetailForOwner.mockResolvedValue(photo);

    const detail = await service.getDetail('user-1', 'photo-1');

    expect(detail).toEqual({
      ...photo,
      uploadedByGuest: uploader,
      ...uploaderAliasFields('guest-1', 'Guest', 2),
      ...signedUrlFields('https://signed.example/detail/photo-1'),
      uploaderMessage: messageRecord,
    });
  });

  it('returns null uploaderMessage when uploader is missing', async () => {
    const photo = createPhoto('photo-1', 'detail/photo-1', {
      uploadedByGuest: null,
    });
    photoRepository.findPhotoDetailForOwner.mockResolvedValue(photo);

    const detail = await service.getDetail('user-1', 'photo-1');

    expect(detail).toEqual({
      ...photo,
      uploadedByGuest: null,
      ...signedUrlFields('https://signed.example/detail/photo-1'),
      uploaderMessage: null,
    });
  });

  describe('searchPhotos', () => {
    const principalUser = { sub: 'user-1', sessionType: SessionType.USER };
    const principalGuest = { sub: 'guest-1', sessionType: SessionType.GUEST };

    it('returns photos matching by uploader name with null matchedMessage', async () => {
      const photo = createPhoto('photo-1', 'search/photo-1');
      photoRepository.searchPhotosByEvent.mockResolvedValue([photo]);

      const result = await service.searchPhotos(principalUser, {
        eventId: 'event-1',
        query: 'guest',
        fields: ['name'],
        order: 'desc',
      });

      expect(result).toEqual([
        {
          ...photo,
          ...uploaderAliasFields('guest-1', 'Guest', 2),
          ...signedUrlFields('https://signed.example/search/photo-1'),
          matchedMessage: null,
        },
      ]);
      expect(photoRepository.searchPhotosByEvent.mock.calls[0][0]).toEqual({
        eventId: 'event-1',
        query: 'guest',
        includeName: true,
        includeMessage: false,
        order: 'desc',
      });
    });

    it('returns matchedMessage when message field matched and truncates to 200 chars', async () => {
      const longMessage = 'A'.repeat(250);
      const photo = createPhoto('photo-1', 'search/photo-1', {
        uploadedByGuest: {
          ...uploader,
          messages: [
            {
              id: 'msg-1',
              content: longMessage,
              createdAt: new Date('2026-05-12T08:30:00.000Z'),
              updatedAt: new Date('2026-05-12T08:30:00.000Z'),
            },
          ],
        },
      });
      photoRepository.searchPhotosByEvent.mockResolvedValue([photo]);

      const result = await service.searchPhotos(principalUser, {
        eventId: 'event-1',
        query: 'A',
        fields: ['name', 'message', 'tags'],
        order: 'desc',
      });

      expect(result[0].matchedMessage).toBe('A'.repeat(200));
      expect(result[0]).not.toHaveProperty('uploadedByGuest.messages');
    });

    it('limits matching to name when fields=[name]', async () => {
      photoRepository.searchPhotosByEvent.mockResolvedValue([]);

      await service.searchPhotos(principalUser, {
        eventId: 'event-1',
        query: 'q',
        fields: ['name'],
        order: 'desc',
      });

      expect(
        photoRepository.searchPhotosByEvent.mock.calls[0][0],
      ).toMatchObject({ includeName: true, includeMessage: false });
    });

    it('escapes LIKE wildcards (%, _, backslash) and single quote in query', async () => {
      photoRepository.searchPhotosByEvent.mockResolvedValue([]);

      await service.searchPhotos(principalUser, {
        eventId: 'event-1',
        query: "100%_a\\b'c",
        fields: ['name', 'message'],
        order: 'desc',
      });

      expect(photoRepository.searchPhotosByEvent.mock.calls[0][0].query).toBe(
        "100\\%\\_a\\\\b'c",
      );
    });

    it('returns empty result when only tags field requested (tag schema not yet modeled)', async () => {
      const result = await service.searchPhotos(principalUser, {
        eventId: 'event-1',
        query: 'q',
        fields: ['tags'],
        order: 'desc',
      });

      expect(result).toEqual([]);
      expect(photoRepository.searchPhotosByEvent).not.toHaveBeenCalled();
    });

    it('returns all matching photos without any pagination params', async () => {
      const photo = createPhoto('photo-1', 'search/photo-1');
      photoRepository.searchPhotosByEvent.mockResolvedValue([photo]);

      const result = await service.searchPhotos(principalUser, {
        eventId: 'event-1',
        query: 'guest',
        fields: ['name', 'message', 'tags'],
        order: 'asc',
      });

      const repoCall = photoRepository.searchPhotosByEvent.mock.calls[0][0];
      expect(repoCall).not.toHaveProperty('skip');
      expect(repoCall).not.toHaveProperty('take');
      expect(repoCall.order).toBe('asc');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('rejects empty/whitespace-only query', async () => {
      await expect(
        service.searchPhotos(principalUser, {
          eventId: 'event-1',
          query: '   ',
          fields: ['name'],
          order: 'desc',
        }),
      ).rejects.toThrow(/empty/i);
    });

    it('allows guest principal that belongs to the event', async () => {
      photoRepository.findGuestById.mockResolvedValue({
        id: 'guest-1',
        name: 'Guest',
        eventId: 'event-1',
      });
      photoRepository.searchPhotosByEvent.mockResolvedValue([]);

      const result = await service.searchPhotos(principalGuest, {
        eventId: 'event-1',
        query: 'q',
        fields: ['name'],
        order: 'desc',
      });

      expect(result).toEqual([]);
      expect(photoRepository.findEventOwnedByUser).not.toHaveBeenCalled();
    });

    it('rejects guest principal that belongs to a different event', async () => {
      photoRepository.findGuestById.mockResolvedValue({
        id: 'guest-1',
        name: 'Guest',
        eventId: 'event-other',
      });

      await expect(
        service.searchPhotos(principalGuest, {
          eventId: 'event-1',
          query: 'q',
          fields: ['name'],
          order: 'desc',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects user principal that does not own the event', async () => {
      photoRepository.findEventOwnedByUser.mockResolvedValueOnce(null);

      await expect(
        service.searchPhotos(principalUser, {
          eventId: 'event-1',
          query: 'q',
          fields: ['name'],
          order: 'desc',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('hidePhotoForHost', () => {
    it('marks the photo hidden when host owns the event and photo is visible', async () => {
      photoRepository.findPhotoForHostIncludingHidden.mockResolvedValue({
        id: 'photo-1',
        hiddenByHostAt: null,
      });
      photoRepository.markPhotoHiddenByHost.mockResolvedValue({
        id: 'photo-1',
        hiddenByHostAt: new Date('2026-05-13T12:00:00.000Z'),
      });

      await service.hidePhotoForHost('user-1', 'photo-1');

      expect(
        photoRepository.findPhotoForHostIncludingHidden,
      ).toHaveBeenCalledWith('photo-1', 'user-1');
      expect(photoRepository.markPhotoHiddenByHost).toHaveBeenCalledWith(
        'photo-1',
      );
    });

    it('is idempotent when the photo is already hidden', async () => {
      photoRepository.findPhotoForHostIncludingHidden.mockResolvedValue({
        id: 'photo-1',
        hiddenByHostAt: new Date('2026-05-12T00:00:00.000Z'),
      });

      await service.hidePhotoForHost('user-1', 'photo-1');

      expect(photoRepository.markPhotoHiddenByHost).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when photo is missing or not in an event the host owns', async () => {
      photoRepository.findPhotoForHostIncludingHidden.mockResolvedValue(null);

      await expect(
        service.hidePhotoForHost('user-1', 'photo-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(photoRepository.markPhotoHiddenByHost).not.toHaveBeenCalled();
    });

    it('does not touch storage', async () => {
      photoRepository.findPhotoForHostIncludingHidden.mockResolvedValue({
        id: 'photo-1',
        hiddenByHostAt: null,
      });
      photoRepository.markPhotoHiddenByHost.mockResolvedValue({
        id: 'photo-1',
        hiddenByHostAt: new Date('2026-05-13T12:00:00.000Z'),
      });

      await service.hidePhotoForHost('user-1', 'photo-1');

      expect(storageService.getReadUrl).not.toHaveBeenCalled();
    });
  });

  describe('replacePhotoFile', () => {
    const replacementDto = {
      fileKey: 'events/event-1/edits/new-photo',
      mimeType: 'image/jpeg',
      fileSizeBytes: 4096,
      width: 1920,
      height: 1080,
    };

    const mockReplacedPhoto = createPhoto('photo-1', replacementDto.fileKey);

    beforeEach(() => {
      photoRepository.findPhotoForHostReplacement.mockResolvedValue({
        id: 'photo-1',
        eventId: 'event-1',
        originalObjectKey: 'events/event-1/guest-1/old-photo',
      });
      photoRepository.replacePhotoFile.mockResolvedValue({
        id: 'photo-1',
        originalObjectKey: replacementDto.fileKey,
      });
      photoRepository.findPhotoDetailForOwner.mockResolvedValue(
        mockReplacedPhoto,
      );
    });

    it('updates file fields, deletes old object, and returns refreshed detail', async () => {
      const result = await service.replacePhotoFile(
        'user-1',
        'photo-1',
        replacementDto,
      );

      expect(photoRepository.findPhotoForHostReplacement).toHaveBeenCalledWith(
        'photo-1',
        'user-1',
      );
      expect(photoRepository.replacePhotoFile).toHaveBeenCalledWith('photo-1', {
        originalObjectKey: replacementDto.fileKey,
        mimeType: replacementDto.mimeType,
        fileSizeBytes: replacementDto.fileSizeBytes,
        width: replacementDto.width,
        height: replacementDto.height,
      });
      expect(storageService.deleteObject).toHaveBeenCalledWith(
        'events/event-1/guest-1/old-photo',
      );
      expect(result).toMatchObject({
        id: 'photo-1',
        originalObjectKey: replacementDto.fileKey,
        ...signedUrlFields(`https://signed.example/${replacementDto.fileKey}`),
        uploaderMessage: null,
      });
    });

    it('coerces missing dimensions and size to null when sending to repo', async () => {
      await service.replacePhotoFile('user-1', 'photo-1', {
        fileKey: replacementDto.fileKey,
        mimeType: replacementDto.mimeType,
      });

      expect(photoRepository.replacePhotoFile).toHaveBeenCalledWith('photo-1', {
        originalObjectKey: replacementDto.fileKey,
        mimeType: replacementDto.mimeType,
        fileSizeBytes: null,
        width: null,
        height: null,
      });
    });

    it('throws NotFoundException when host does not own the photo', async () => {
      photoRepository.findPhotoForHostReplacement.mockResolvedValue(null);

      await expect(
        service.replacePhotoFile('user-1', 'photo-1', replacementDto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(photoRepository.replacePhotoFile).not.toHaveBeenCalled();
      expect(storageService.deleteObject).not.toHaveBeenCalled();
    });

    it('rejects fileKey outside the photo event prefix with 422', async () => {
      await expect(
        service.replacePhotoFile('user-1', 'photo-1', {
          ...replacementDto,
          fileKey: 'events/other-event/edits/new-photo',
        }),
      ).rejects.toMatchObject({ status: 422 });
      expect(photoRepository.replacePhotoFile).not.toHaveBeenCalled();
    });

    it('rejects unsupported MIME types with 422', async () => {
      await expect(
        service.replacePhotoFile('user-1', 'photo-1', {
          ...replacementDto,
          mimeType: 'image/gif',
        }),
      ).rejects.toMatchObject({ status: 422 });
      expect(photoRepository.replacePhotoFile).not.toHaveBeenCalled();
    });

    it('rejects when new fileKey matches the current originalObjectKey', async () => {
      photoRepository.findPhotoForHostReplacement.mockResolvedValue({
        id: 'photo-1',
        eventId: 'event-1',
        originalObjectKey: replacementDto.fileKey,
      });

      await expect(
        service.replacePhotoFile('user-1', 'photo-1', replacementDto),
      ).rejects.toMatchObject({ status: 422 });
      expect(photoRepository.replacePhotoFile).not.toHaveBeenCalled();
    });

    it('does not roll back the swap when old-object deletion fails', async () => {
      storageService.deleteObject.mockRejectedValueOnce(
        new Error('GCS object deletion failed'),
      );

      const result = await service.replacePhotoFile(
        'user-1',
        'photo-1',
        replacementDto,
      );

      expect(photoRepository.replacePhotoFile).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ id: 'photo-1' });
    });
  });
});
