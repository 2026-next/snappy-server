import { Injectable, NotFoundException } from '@nestjs/common';
import { CheckGuestNameDto } from './dto/check-name.dto';
import { GuestRepository } from './repositories/guest.repository';
import { EventRepository } from '../event/repositories/event.repository';

@Injectable()
export class GuestService {
  constructor(
    private readonly guestRepository: GuestRepository,
    private readonly eventRepository: EventRepository,
  ) {}

  async checkNameExists(dto: CheckGuestNameDto) {
    const guest = await this.guestRepository.findByEventIdAndName(
      dto.eventId,
      dto.name,
    );
    return { available: !guest };
  }

  async getEventByAccessCode(accessCode: string) {
    const event = await this.eventRepository.findEventByAccessCode(accessCode);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }
}
