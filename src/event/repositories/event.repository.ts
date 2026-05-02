import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from '../dto/create-event.dto';

@Injectable()
export class EventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(createEventDto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        name: createEventDto.name,
        eventDate: new Date(createEventDto.eventDate),
        ownerId: createEventDto.ownerId,
      },
    });
  }

  async findAll() {
    return this.prisma.event.findMany({
      include: { owner: true },
    });
  }

  async findOne(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
      include: {
        owner: true,
        photos: true,
        messages: true,
      },
    });
  }
}
