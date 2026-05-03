import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { EventRepository } from './repositories/event.repository';

@Injectable()
export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  async createEvent(ownerId: string, createEventDto: CreateEventDto) {
    const event = await this.eventRepository.createEvent(ownerId, createEventDto);
    
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    return {
      ...event,
      qrLink: `${baseUrl}/guest/join/${event.accessCode}`,
    };
  }

  async getEventsByOwnerId(ownerId: string) {
    return this.eventRepository.findAllEventsByOwnerId(ownerId);
  }
}
