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

      select: {
        id: true,
        name: true,
        eventDate: true,
        accessCode: true,
        thumbnailObjectKey: true, 
      }
    });
  }

  async updateThumbnailObjectKey(eventId: string, thumbnailObjectKey: string) {
    return this.prisma.event.update({
      where: { id: eventId },
      data: { thumbnailObjectKey },
    });
  }
}
