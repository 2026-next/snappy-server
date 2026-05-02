import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { EventRepository } from './repositories/event.repository';

@Injectable()
export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  // 1. 이벤트 생성하기
  async createEvent(ownerId: string, createEventDto: CreateEventDto) {
    return this.eventRepository.createEvent(ownerId, createEventDto);
  }

  // 2. 특정 유저가 생성한 이벤트 모두 가져오기
  async getEventsByOwnerId(ownerId: string) {
    return this.eventRepository.findAllEventsByOwnerId(ownerId);
  }
}
