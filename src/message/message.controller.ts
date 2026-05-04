import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { UpdateMessageDto } from './dto/update-message.dto';

import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request-types';

@ApiTags('Message')
@Controller('message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @ApiOperation({ summary: 'Write a new message' })
  @ApiBearerAuth('access-token')
  @UseGuards(AccessTokenGuard)
  @ApiConflictResponse({
    description: 'You can only create one message. Please update your existing message instead.',
  })
  @ApiCreatedResponse({
    description: 'Message created successfully',
    schema: {
      example: {
        id: 'message-uuid',
        content: 'Content',
        createdAt: '2024-06-01T12:00:00.000Z',
        updatedAt: '2024-06-01T12:00:00.000Z',
        eventId: 'event-uuid',
        authorGuestId: 'guest-uuid',
      },
    },
  })
  @Post('create')
  create(
    @Body() createMessageDto: CreateMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const guestId = req.user.sub;
    return this.messageService.createMessage(createMessageDto, guestId);
  }

  @ApiOperation({ summary: 'Find my message' })
  @ApiBearerAuth('access-token')
  @UseGuards(AccessTokenGuard)
  @ApiNotFoundResponse({ description: 'Message not found' })
  @ApiOkResponse({
    description: 'Message retrieved successfully',
    schema: {
      example: {
        id: 'message-uuid',
        content: 'Content',
        createdAt: '2024-06-01T12:00:00.000Z',
        updatedAt: '2024-06-01T12:00:00.000Z',
        eventId: 'event-uuid',
        authorGuestId: 'guest-uuid',
      },
    },
  })
  @Get('my')
  findMyMessage(@Req() req: AuthenticatedRequest) {
    const guestId = req.user.sub;
    return this.messageService.findMyMessage(guestId);
  }

  @ApiOperation({ summary: 'Update my message' })
  @ApiBearerAuth('access-token')
  @UseGuards(AccessTokenGuard)
  @ApiOkResponse({
    description: 'Message updated successfully',
    schema: {
      example: {
        id: 'message-uuid',
        content: 'Updated content',
        createdAt: '2024-06-01T12:00:00.000Z',
        updatedAt: '2024-06-01T12:30:00.000Z',
        eventId: 'event-uuid',
        authorGuestId: 'guest-uuid',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Message not found' })
  @Patch('my')
  update(@Body() updateMessageDto: UpdateMessageDto, @Req() req: AuthenticatedRequest) {
    const guestId = req.user.sub;
    return this.messageService.updateMyMessage(updateMessageDto, guestId);
  }
}
