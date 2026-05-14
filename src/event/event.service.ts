import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { EventRepository } from './repositories/event.repository';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

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

  async renameEvent(ownerId: string, eventId: string, name: string) {
    await this.assertEventOwner(eventId, ownerId);
    const renamed = await this.eventRepository.renameEvent(eventId, name);
    return {
      ...renamed,
      qrLink: this.buildGuestOnboardingLink(renamed.accessCode),
      thumbnailUrl: renamed.thumbnailObjectKey
        ? await this.storageService.getReadUrl(renamed.thumbnailObjectKey)
        : null,
    };
  }

  /**
   * Hard-deletes the event and every cascading row (guests, photos, photo
   * groups, messages, AI jobs, sessions). Storage objects are removed on a
   * best-effort basis after the database delete succeeds — individual storage
   * failures are logged but do not roll back the DB delete because that would
   * leave the album half-removed.
   */
  async deleteEvent(ownerId: string, eventId: string) {
    await this.assertEventOwner(eventId, ownerId);
    const storageKeys =
      await this.eventRepository.findEventStorageKeys(eventId);
    await this.eventRepository.deleteEvent(eventId);
    await this.cleanupStorageBestEffort(storageKeys);
  }

  private async assertEventOwner(eventId: string, ownerId: string) {
    const event = await this.eventRepository.findEventOwnedByUser(
      eventId,
      ownerId,
    );
    if (!event) {
      throw new ForbiddenException('Event access is denied');
    }
    return event;
  }

  private async cleanupStorageBestEffort(keys: string[]) {
    if (keys.length === 0) {
      return;
    }
    const results = await Promise.allSettled(
      keys.map((key) => this.storageService.deleteObject(key)),
    );
    const failures = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (failures.length > 0) {
      this.logger.warn(
        `Storage cleanup partial failure: ${failures.length}/${keys.length} objects could not be deleted`,
      );
    }
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
