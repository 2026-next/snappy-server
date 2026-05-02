import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. 이벤트 생성하기
  async create(createEventDto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        name: createEventDto.name,
        eventDate: new Date(createEventDto.eventDate),
        ownerId: createEventDto.ownerId,
      },
    });
  }

  // 2. 모든 이벤트 가져오기
  async findAll() {
    return this.prisma.event.findMany({
      include: { owner: true } // 만든 사람 정보도 같이 가져오고 싶을 때
    });
  }

  // 3. 특정 이벤트 하나만 가져오기
  async findOne(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
      include: { 
        owner: true,
        photos: true, // 사진 목록도 같이 확인 가능
        messages: true // 메시지 목록도 같이 확인 가능
      }
    });
  }
}