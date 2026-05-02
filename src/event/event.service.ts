import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { EventRepository } from './repositories/event.repository';

@Injectable()
export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  // 1. 이벤트 생성하기
  async createEvent(createEventDto: CreateEventDto) {
    return this.eventRepository.create(createEventDto);
  }

  // 2. 모든 이벤트 가져오기
  async getCurrentEvents() {
    return this.eventRepository.findAll();
  }

  // 3. 특정 이벤트 하나만 가져오기
  async findEventById(id: string) {
    return this.eventRepository.findOne(id);
  }
}
