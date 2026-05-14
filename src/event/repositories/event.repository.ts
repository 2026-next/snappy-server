import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from '../dto/create-event.dto';

@Injectable()
export class EventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(ownerId: string, createEventDto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        name: createEventDto.name,
        eventDate: new Date(createEventDto.eventDate),
        ownerId,
      },
    });
  }

  async findAllEventsByOwnerId(ownerId: string) {
    return this.prisma.event.findMany({
      where: { ownerId },
    });
  }

  async findEventByAccessCode(accessCode: string) {
    return this.prisma.event.findUnique({
      where: { accessCode },
    });
  }

  async updateThumbnailObjectKey(eventId: string, thumbnailObjectKey: string) {
    return this.prisma.event.update({
      where: { id: eventId },
      data: { thumbnailObjectKey },
    });
  }

  async findEventOwnedByUser(eventId: string, ownerId: string) {
    return this.prisma.event.findFirst({
      where: { id: eventId, ownerId },
    });
  }

  async renameEvent(eventId: string, name: string) {
    return this.prisma.event.update({
      where: { id: eventId },
      data: { name },
    });
  }

  /**
   * Returns every storage object key that belongs to the event so the caller
   * can issue best-effort deletes against object storage before the cascade
   * removes the rows from the database. Includes the event thumbnail, all
   * photo originals, and every PhotoVersion file key (covering AI enhancement
   * outputs).
   */
  async findEventStorageKeys(eventId: string) {
    const [event, photos] = await this.prisma.$transaction([
      this.prisma.event.findUnique({
        where: { id: eventId },
        select: { thumbnailObjectKey: true },
      }),
      this.prisma.photo.findMany({
        where: { eventId },
        select: {
          originalObjectKey: true,
          versions: { select: { fileKey: true } },
        },
      }),
    ]);

    const keys = new Set<string>();
    if (event?.thumbnailObjectKey) {
      keys.add(event.thumbnailObjectKey);
    }
    for (const photo of photos) {
      keys.add(photo.originalObjectKey);
      for (const version of photo.versions) {
        keys.add(version.fileKey);
      }
    }
    return [...keys];
  }

  async deleteEvent(eventId: string) {
    return this.prisma.event.delete({
      where: { id: eventId },
    });
  }
}
