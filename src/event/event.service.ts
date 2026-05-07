import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { EventRepository } from './repositories/event.repository';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class EventService {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly storageService: StorageService,
  ) {}

  async createEvent(ownerId: string, createEventDto: CreateEventDto) {
    const event = await this.eventRepository.createEvent(
      ownerId,
      createEventDto,
    );

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const thumbnailUpload = createEventDto.thumbnailMimeType
      ? await this.storageService.createEventThumbnailUploadSignedUrl(
          event.id,
          createEventDto.thumbnailMimeType,
        )
      : null;
    const eventWithThumbnail = thumbnailUpload
      ? await this.eventRepository.updateThumbnailObjectKey(
          event.id,
          thumbnailUpload.fileKey,
        )
      : event;

    return {
      ...eventWithThumbnail,
      qrLink: `${baseUrl}/guest/${event.accessCode}/onboarding`,
      ...(thumbnailUpload && { thumbnailUpload }),
    };
  }

  async getEventsByOwnerId(ownerId: string) {
    const events = await this.eventRepository.findAllEventsByOwnerId(ownerId);
    return Promise.all(
      events.map(async (event) => ({
        ...event,
        thumbnailUrl: event.thumbnailObjectKey
          ? await this.storageService.getReadUrl(event.thumbnailObjectKey)
          : null,
      })),
    );
  }
}
