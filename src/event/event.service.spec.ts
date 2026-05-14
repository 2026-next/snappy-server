import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { EventService } from './event.service';
import { EventRepository } from './repositories/event.repository';
import { StorageService } from '../storage/storage.service';

jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

type EventRecord = {
  id: string;
  name: string;
  eventDate: Date;
  ownerId: string;
  accessCode: string;
  thumbnailObjectKey: string | null;
};

describe('EventService (rename + delete)', () => {
  let service: EventService;
  const eventRepository = {
    findEventOwnedByUser:
      jest.fn<
        (eventId: string, ownerId: string) => Promise<EventRecord | null>
      >(),
    renameEvent:
      jest.fn<(eventId: string, name: string) => Promise<EventRecord>>(),
    findEventStorageKeys: jest.fn<(eventId: string) => Promise<string[]>>(),
    deleteEvent: jest.fn<(eventId: string) => Promise<EventRecord>>(),
  };
  const storageService = {
    getReadUrl: jest.fn<(fileKey: string) => Promise<string | null>>(),
    deleteObject: jest.fn<(fileKey: string) => Promise<void>>(),
  };

  const baseEvent: EventRecord = {
    id: 'event-1',
    name: 'Wedding',
    eventDate: new Date('2026-05-20T10:00:00.000Z'),
    ownerId: 'user-1',
    accessCode: 'access_event-1',
    thumbnailObjectKey: 'events/event-1/thumbnail/x.jpg',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.FRONTEND_ORIGIN = 'https://snappy.test';
    delete process.env.LOCALHOST_ORIGIN;
    storageService.getReadUrl.mockImplementation((key) =>
      Promise.resolve(`https://signed.example/${key}`),
    );
    storageService.deleteObject.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: EventRepository, useValue: eventRepository },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = moduleRef.get(EventService);
  });

  describe('renameEvent', () => {
    it('renames the event and returns it with qrLink + signed thumbnail', async () => {
      eventRepository.findEventOwnedByUser.mockResolvedValue(baseEvent);
      eventRepository.renameEvent.mockResolvedValue({
        ...baseEvent,
        name: 'Renamed',
      });

      const result = await service.renameEvent('user-1', 'event-1', 'Renamed');

      expect(eventRepository.renameEvent).toHaveBeenCalledWith(
        'event-1',
        'Renamed',
      );
      expect(result).toMatchObject({
        id: 'event-1',
        name: 'Renamed',
        qrLink: 'https://snappy.test/guest/access_event-1/onboarding',
        thumbnailUrl: 'https://signed.example/events/event-1/thumbnail/x.jpg',
      });
    });

    it('returns null thumbnailUrl when event has no thumbnail object', async () => {
      eventRepository.findEventOwnedByUser.mockResolvedValue({
        ...baseEvent,
        thumbnailObjectKey: null,
      });
      eventRepository.renameEvent.mockResolvedValue({
        ...baseEvent,
        thumbnailObjectKey: null,
        name: 'Renamed',
      });

      const result = await service.renameEvent('user-1', 'event-1', 'Renamed');

      expect(result.thumbnailUrl).toBeNull();
      expect(storageService.getReadUrl).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when caller does not own the event', async () => {
      eventRepository.findEventOwnedByUser.mockResolvedValue(null);

      await expect(
        service.renameEvent('user-1', 'event-1', 'Renamed'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(eventRepository.renameEvent).not.toHaveBeenCalled();
    });
  });

  describe('deleteEvent', () => {
    it('cascades DB delete and best-effort cleans storage', async () => {
      eventRepository.findEventOwnedByUser.mockResolvedValue(baseEvent);
      eventRepository.findEventStorageKeys.mockResolvedValue([
        'events/event-1/thumbnail/x.jpg',
        'events/event-1/guest-1/photo-1.jpg',
        'events/event-1/guest-2/photo-2.jpg',
      ]);
      eventRepository.deleteEvent.mockResolvedValue(baseEvent);

      await service.deleteEvent('user-1', 'event-1');

      expect(eventRepository.deleteEvent).toHaveBeenCalledWith('event-1');
      expect(storageService.deleteObject).toHaveBeenCalledTimes(3);
    });

    it('still resolves successfully when storage cleanup partially fails', async () => {
      eventRepository.findEventOwnedByUser.mockResolvedValue(baseEvent);
      eventRepository.findEventStorageKeys.mockResolvedValue([
        'key-1',
        'key-2',
      ]);
      eventRepository.deleteEvent.mockResolvedValue(baseEvent);
      storageService.deleteObject.mockImplementation((key) =>
        key === 'key-2'
          ? Promise.reject(new Error('gcs 500'))
          : Promise.resolve(),
      );

      await expect(
        service.deleteEvent('user-1', 'event-1'),
      ).resolves.toBeUndefined();
      expect(eventRepository.deleteEvent).toHaveBeenCalled();
    });

    it('skips storage cleanup when there are no keys', async () => {
      eventRepository.findEventOwnedByUser.mockResolvedValue(baseEvent);
      eventRepository.findEventStorageKeys.mockResolvedValue([]);
      eventRepository.deleteEvent.mockResolvedValue(baseEvent);

      await service.deleteEvent('user-1', 'event-1');

      expect(storageService.deleteObject).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException without touching DB or storage when caller does not own the event', async () => {
      eventRepository.findEventOwnedByUser.mockResolvedValue(null);

      await expect(
        service.deleteEvent('user-1', 'event-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(eventRepository.findEventStorageKeys).not.toHaveBeenCalled();
      expect(eventRepository.deleteEvent).not.toHaveBeenCalled();
      expect(storageService.deleteObject).not.toHaveBeenCalled();
    });
  });
});
