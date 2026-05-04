import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMessageDto } from '../dto/update-message.dto';

type MessageCreateData = {
  content: string;
  eventId: string;
  authorGuestId: string;
};

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findGuestById(guestId: string) {
    return this.prisma.guest.findUnique({
      where: { id: guestId },
      select: {
        id: true,
        eventId: true,
      },
    });
  }

  async create(data: MessageCreateData) {
    return this.prisma.message.create({
      data,
    });
  }

  async findMyMessage(guestId: string) {
    return this.prisma.message.findFirst({
      where: { authorGuestId: guestId },
    });
  }

  async update(id: string, updateMessageDto: UpdateMessageDto) {
    return this.prisma.message.update({
      where: { id },
      data: {
        content: updateMessageDto.content,
      },
    });
  }
}
