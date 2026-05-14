import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ExifWorkerService, pickTakenAt } from './exif-worker.service';
import { PhotoRepository } from '../repositories/photo.repository';
import { StorageService } from '../../storage/storage.service';

jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

jest.mock('exifr', () => ({
  __esModule: true,
  default: {
    parse: jest.fn(),
  },
}));

import exifr from 'exifr';
type ParseFn = (input: unknown, options?: unknown) => Promise<unknown>;
const mockedParse = exifr.parse as unknown as jest.Mock<ParseFn>;

const flushSetImmediate = () => new Promise<void>((r) => setImmediate(r));

describe('pickTakenAt', () => {
  const earlier = new Date('2025-08-01T00:00:00.000Z');
  const later = new Date('2026-05-12T08:30:00.000Z');

  it('returns null when tags are nullish', () => {
    expect(pickTakenAt(null)).toBeNull();
    expect(pickTakenAt(undefined)).toBeNull();
    expect(pickTakenAt({})).toBeNull();
  });

  it('prefers DateTimeOriginal over CreateDate / DateTime', () => {
    expect(
      pickTakenAt({
        DateTimeOriginal: later,
        CreateDate: earlier,
        DateTime: earlier,
      }),
    ).toEqual(later);
  });

  it('falls back to CreateDate when DateTimeOriginal is missing', () => {
    expect(
      pickTakenAt({
        CreateDate: later,
        DateTime: earlier,
      }),
    ).toEqual(later);
  });

  it('parses ISO string timestamps', () => {
    const result = pickTakenAt({
      DateTimeOriginal: '2026-05-12T08:30:00.000Z',
    });
    expect(result?.toISOString()).toBe('2026-05-12T08:30:00.000Z');
  });

  it('ignores invalid date strings and falls through to the next tag', () => {
    expect(
      pickTakenAt({
        DateTimeOriginal: 'not a date',
        CreateDate: later,
      }),
    ).toEqual(later);
  });

  it('ignores Invalid Date values', () => {
    expect(pickTakenAt({ DateTimeOriginal: new Date('garbage') })).toBeNull();
  });
});

describe('ExifWorkerService', () => {
  let service: ExifWorkerService;
  const storage = {
    downloadObjectPrefix:
      jest.fn<(fileKey: string, byteCount: number) => Promise<Buffer>>(),
  };
  const photoRepository = {
    updateExifTakenAt:
      jest.fn<(photoId: string, takenAt: Date) => Promise<{ count: number }>>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockedParse.mockReset();
    storage.downloadObjectPrefix.mockResolvedValue(Buffer.from('jpeg-bytes'));
    photoRepository.updateExifTakenAt.mockResolvedValue({ count: 1 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExifWorkerService,
        { provide: StorageService, useValue: storage },
        { provide: PhotoRepository, useValue: photoRepository },
      ],
    }).compile();

    service = moduleRef.get(ExifWorkerService);
  });

  it('downloads the object prefix, parses EXIF, and back-fills exifTakenAt', async () => {
    const takenAt = new Date('2026-05-12T08:30:00.000Z');
    mockedParse.mockResolvedValue({ DateTimeOriginal: takenAt });

    service.start('photo-1', 'events/event-1/guest-1/uuid');
    await flushSetImmediate();

    expect(storage.downloadObjectPrefix).toHaveBeenCalledWith(
      'events/event-1/guest-1/uuid',
      256 * 1024,
    );
    expect(mockedParse).toHaveBeenCalled();
    expect(photoRepository.updateExifTakenAt).toHaveBeenCalledWith(
      'photo-1',
      takenAt,
    );
  });

  it('does not write to DB when no timestamp tag is present', async () => {
    mockedParse.mockResolvedValue({ Make: 'Canon' });

    service.start('photo-1', 'key');
    await flushSetImmediate();

    expect(photoRepository.updateExifTakenAt).not.toHaveBeenCalled();
  });

  it('does not throw when the photo was deleted before extraction completes', async () => {
    mockedParse.mockResolvedValue({
      DateTimeOriginal: new Date('2026-05-12T08:30:00.000Z'),
    });
    photoRepository.updateExifTakenAt.mockResolvedValue({ count: 0 });

    service.start('photo-1', 'key');
    await flushSetImmediate();

    expect(photoRepository.updateExifTakenAt).toHaveBeenCalledTimes(1);
  });

  it('logs and exits cleanly when GCS download fails', async () => {
    storage.downloadObjectPrefix.mockRejectedValue(new Error('gcs 500'));

    service.start('photo-1', 'key');
    await flushSetImmediate();

    expect(mockedParse).not.toHaveBeenCalled();
    expect(photoRepository.updateExifTakenAt).not.toHaveBeenCalled();
  });

  it('logs and exits cleanly when EXIF parsing fails', async () => {
    mockedParse.mockRejectedValue(new Error('corrupt header'));

    service.start('photo-1', 'key');
    await flushSetImmediate();

    expect(photoRepository.updateExifTakenAt).not.toHaveBeenCalled();
  });

  it('does not propagate DB errors out of the fire-and-forget worker', async () => {
    mockedParse.mockResolvedValue({
      DateTimeOriginal: new Date('2026-05-12T08:30:00.000Z'),
    });
    photoRepository.updateExifTakenAt.mockRejectedValue(new Error('pg down'));

    expect(() => service.start('photo-1', 'key')).not.toThrow();
    await flushSetImmediate();
    // No assertion needed — test passes if no unhandled rejection.
  });
});
