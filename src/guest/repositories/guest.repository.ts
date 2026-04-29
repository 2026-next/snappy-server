import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GuestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEventIdAndName(eventId: string, name: string) {
    return this.prisma.guest.findUnique({
      where: {
        eventId_name: {
          eventId,
          name,
        },
      },
      select: { id: true },
    });
  }
}
