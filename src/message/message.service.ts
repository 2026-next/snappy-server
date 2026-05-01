import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) {} // Prisma 연결

  async create(createMessageDto: CreateMessageDto) {
    return this.prisma.message.create({
      data: createMessageDto,
    });
  }

  async findAllByEvent(eventId: string) {
    return this.prisma.message.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' }, // 최신순 정렬
    });
  }

  async remove(id: string) {
    return this.prisma.message.delete({
      where: { id },
    });
  }

  async update(id: string, updateMessageDto: UpdateMessageDto, guestId: string) {
  // 1. 먼저 해당 메시지가 존재하는지, 작성자가 맞는지 확인합니다.
  const message = await this.prisma.message.findUnique({
    where: { id },
  });

  if (!message) {
    throw new Error('메시지를 찾을 수 없습니다.');
  }

  // 2. 메시지의 작성자 ID와 로그인한 하객 ID를 비교합니다.
  if (message.authorGuestId !== guestId) {
    throw new Error('본인의 메시지만 수정할 수 있습니다.');
  }

  // 3. 검증이 끝났다면 내용을 업데이트합니다.
  return this.prisma.message.update({
    where: { id },
    data: {
      content: updateMessageDto.content,
    },
  });
}
}
