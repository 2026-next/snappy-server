import { Injectable } from '@nestjs/common';
import { CheckGuestNameDto } from './dto/check-name.dto';
import { GuestRepository } from './repositories/guest.repository';

@Injectable()
export class GuestService {
  constructor(private readonly guestRepository: GuestRepository) {}

  async checkNameExists(dto: CheckGuestNameDto) {
    const guest = await this.guestRepository.findByEventIdAndName(
      dto.eventId,
      dto.name,
    );
    return { available: !guest };
  }
}
