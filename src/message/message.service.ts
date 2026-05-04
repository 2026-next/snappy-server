import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { MessageRepository } from './repositories/message.repository';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessageService {
  constructor(private messageRepository: MessageRepository) {}

  async createMessage(createMessageDto: CreateMessageDto, guestId: string) {
    const guest = await this.messageRepository.findGuestById(guestId);

    if (!guest) {
      throw new NotFoundException('Guest not found');
    }

    const existingMessage = await this.messageRepository.findMyMessage(guestId);

    if (existingMessage) {
      throw new ConflictException(
        'You can only create one message. Please update your existing message instead.',
      );
    }

    return this.messageRepository.create({
      content: createMessageDto.content,
      eventId: guest.eventId,
      authorGuestId: guestId,
    });
  }

  async updateMyMessage(updateMessageDto: UpdateMessageDto, guestId: string) {
    const message = await this.messageRepository.findMyMessage(guestId);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return this.messageRepository.update(message.id, updateMessageDto);
  }

  async findMyMessage(guestId: string) {
    const message = await this.messageRepository.findMyMessage(guestId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    return message;
  }
}
