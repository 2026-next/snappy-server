import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { EventRepository } from './repositories/event.repository';

@Injectable()
export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  // 1. 이벤트 생성하기
  async createEvent(ownerId: string, createEventDto: CreateEventDto) {
    // DB에 이벤트 저장 (accessCode는 자동으로 생성되어 저장됨)
    const event = await this.eventRepository.createEvent(ownerId, createEventDto);
    
    // 환경변수에서 프론트엔드 주소 가져오기 (일단localhost 사용)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // 생성된 이벤트 정보와 함께 qrLink를 조합하여 반환
    return {
      ...event,
      qrLink: `${baseUrl}/guest/join/${event.accessCode}`,
    };
  }

  // 2. 특정 유저가 생성한 이벤트 모두 가져오기
  async getEventsByOwnerId(ownerId: string) {
    return this.eventRepository.findAllEventsByOwnerId(ownerId);
  }
}
