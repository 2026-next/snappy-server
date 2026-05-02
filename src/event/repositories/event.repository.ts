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
      select: {
        name: true,
        eventDate: true,
        owner: {
          select: {
            name: true,
          },
        },
      },
    });
  }
}
