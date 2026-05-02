import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionType } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request-types';

@ApiTags('Event')
@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @ApiOperation({ summary: 'Create an event' })
  @ApiBearerAuth('access-token')
  @ApiCreatedResponse({
    description: 'The event has been successfully created.',
    schema: {
      example: {
        id: 'event-uuid',
        name: 'event name',
        eventDate: '2026-05-20T10:00:00.000Z',
        createdAt: '2024-06-01T12:00:00.000Z',
        updatedAt: '2024-06-01T12:00:00.000Z',
        ownerId: 'user-uuid',
      },
    },
  })
  @UseGuards(AccessTokenGuard)
  @Post('create')
  create(
    @Req() req: AuthenticatedRequest,
    @Body() createEventDto: CreateEventDto,
  ) {
    if (req.user.sessionType !== SessionType.USER) {
      throw new UnauthorizedException('User access token is required');
    }

    return this.eventService.createEvent(req.user.sub, createEventDto);
  }

  @ApiOperation({ summary: 'Get all of my events' })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({
    description: 'A list of events created by the authenticated user.',
    schema: {
      example: [
        {
          name: 'event name',
          eventDate: '2026-05-20T10:00:00.000Z',
          owner: {
            name: 'owner name',
          },
        }
      ],
    },
  })
  @UseGuards(AccessTokenGuard)
  @Get('my-events')
  findMyEvents(@Req() req: AuthenticatedRequest) {
    if (req.user.sessionType !== SessionType.USER) {
      throw new UnauthorizedException('User access token is required');
    }

    return this.eventService.getEventsByOwnerId(req.user.sub);
  }
}
