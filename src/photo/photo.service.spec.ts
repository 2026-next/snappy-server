import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { PhotoService } from './photo.service';
import { PhotoRepository } from './repositories/photo.repository';
import { StorageService } from '../storage/storage.service';

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

type OwnerPhoto = {
  id: string;
  originalObjectKey: string;
  uploadedAt: Date;
  exifTakenAt: Date | null;
  uploadedByGuest: Uploader | null;
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
    findAllByEventPaginated:
      jest.fn<
        (
          eventId: string,
          skip: number,
          take: number,
          order: 'asc' | 'desc',
        ) => Promise<{ photos: OwnerPhoto[]; total: number }>
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
  };
  const storageService = {
    getReadUrl: jest.fn<(fileKey: string) => Promise<string | null>>(),
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
    storageService.getReadUrl.mockImplementation(async (fileKey) => {
      return `https://signed.example/${fileKey}`;
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PhotoService,
        { provide: PhotoRepository, useValue: photoRepository },
        { provide: StorageService, useValue: storageService },
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

  it('adds compatible signed URL fields while preserving album pagination', async () => {
    const photo = createPhoto('photo-1', 'album/photo-1');
    photoRepository.findAllByEventPaginated.mockResolvedValue({
      photos: [photo],
      total: 42,
    });

    const album = await service.getFullAlbum('user-1', 'event-1', 5, 2, 'desc');

    expect(photoRepository.findAllByEventPaginated).toHaveBeenCalledWith(
      'event-1',
      25,
      20,
      'desc',
    );
    expect(album).toEqual({
      photos: [
        {
          ...photo,
          ...uploaderAliasFields('guest-1', 'Guest', 2),
          ...signedUrlFields('https://signed.example/album/photo-1'),
        },
      ],
      pagination: { total: 42, offset: 5, page: 2, pageSize: 20 },
    });
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
    });
    expect(storageService.getReadUrl).toHaveBeenCalledTimes(1);
  });
});
