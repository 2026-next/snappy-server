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
      qrLink: this.buildGuestOnboardingLink(event.accessCode),
      ...(thumbnailUpload && { thumbnailUpload }),
    };
  }

  async getEventsByOwnerId(ownerId: string) {
    const events = await this.eventRepository.findAllEventsByOwnerId(ownerId);
    return Promise.all(
      events.map(async (event) => ({
        ...event,
        qrLink: this.buildGuestOnboardingLink(event.accessCode),
        thumbnailUrl: event.thumbnailObjectKey
          ? await this.storageService.getReadUrl(event.thumbnailObjectKey)
          : null,
      })),
    );
  }

  private buildGuestOnboardingLink(accessCode: string) {
    const frontendOrigin = this.getFrontendOrigin();
    return `${frontendOrigin}/guest/${accessCode}/onboarding`;
  }

  private getFrontendOrigin() {
    const origin = process.env.FRONTEND_ORIGIN ?? process.env.LOCALHOST_ORIGIN;

    return origin!.replace(/\/$/, '');
  }
}
