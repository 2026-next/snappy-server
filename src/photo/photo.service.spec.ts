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

type GuestPhoto = {
  id: string;
  eventId: string;
  uploadedByGuestId: string;
  originalObjectKey: string;
};

describe('PhotoService', () => {
  let service: PhotoService;
  const photoRepository = {
    findGuestById: jest.fn<(guestId: string) => Promise<GuestLookup | null>>(),
    findPhotosByGuest:
      jest.fn<(guestId: string, eventId: string) => Promise<GuestPhoto[]>>(),
  };
  const storageService = {
    getReadUrl: jest.fn<(fileKey: string) => Promise<string | null>>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PhotoService,
        { provide: PhotoRepository, useValue: photoRepository },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = moduleRef.get(PhotoService);
  });

  it('adds a readable originalPhotoUrl to guest photos', async () => {
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
    storageService.getReadUrl.mockResolvedValue(
      'https://signed.example/photo-1',
    );

    const photos = await service.findAllByGuest('guest-1');

    expect(photoRepository.findPhotosByGuest).toHaveBeenCalledWith(
      'guest-1',
      'event-1',
    );
    expect(storageService.getReadUrl).toHaveBeenCalledWith(
      'events/event-1/guest-1/photo-1',
    );
    expect(photos).toEqual([
      {
        id: 'photo-1',
        eventId: 'event-1',
        uploadedByGuestId: 'guest-1',
        originalObjectKey: 'events/event-1/guest-1/photo-1',
        originalPhotoUrl: 'https://signed.example/photo-1',
      },
    ]);
  });
});
