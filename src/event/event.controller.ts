import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionType } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request-types';

@ApiTags('Event')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @ApiOperation({ summary: 'Create an event' })
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
        accessCode: 'access_event-uuid',
        thumbnailObjectKey: 'events/event-uuid/thumbnail/photo-uuid',
        qrLink: 'https://snappyku.site/guest/access_event-uuid/onboarding',
        thumbnailUpload: {
          uploadUrl: 'https://storage.googleapis.com/signed-upload-url',
          fileKey: 'events/event-uuid/thumbnail/photo-uuid',
        },
      },
    },
  })
  @Post('create')
  create(
    @Req() req: AuthenticatedRequest,
    @Body() createEventDto: CreateEventDto,
  ) {
    this.assertUser(req);
    return this.eventService.createEvent(req.user.sub, createEventDto);
  }

  @ApiOperation({ summary: 'Get all of my events' })
  @ApiOkResponse({
    description: 'A list of events created by the authenticated user.',
    schema: {
      example: [
        {
          id: 'event-uuid',
          name: 'event name',
          eventDate: '2026-05-20T10:00:00.000Z',
          createdAt: '2024-06-01T12:00:00.000Z',
          updatedAt: '2024-06-01T12:00:00.000Z',
          ownerId: 'user-uuid',
          accessCode: 'access_event-uuid',
          thumbnailObjectKey: 'events/event-uuid/thumbnail/photo-uuid',
          qrLink: 'https://snappyku.site/guest/access_event-uuid/onboarding',
          thumbnailUrl: 'https://storage.googleapis.com/signed-read-url',
        },
      ],
    },
  })
  @Get('my-events')
  findMyEvents(@Req() req: AuthenticatedRequest) {
    this.assertUser(req);
    return this.eventService.getEventsByOwnerId(req.user.sub);
  }

  @ApiOperation({
    summary: 'Rename an album (event)',
    description:
      'Updates the `name` of an album. The caller must be the event owner ' +
      '(USER session). All other event fields (eventDate, accessCode, ' +
      'thumbnail, owner) are left untouched. Trims surrounding whitespace ' +
      'and rejects empty / >100-char names.',
  })
  @ApiParam({
    name: 'eventId',
    description: 'ID of the event to rename.',
    example: 'event-uuid',
  })
  @ApiOkResponse({
    description: 'Renamed event with refreshed qrLink and thumbnailUrl.',
    schema: {
      example: {
        id: 'event-uuid',
        name: 'updated event name',
        eventDate: '2026-05-20T10:00:00.000Z',
        createdAt: '2024-06-01T12:00:00.000Z',
        updatedAt: '2026-05-14T12:00:00.000Z',
        ownerId: 'user-uuid',
        accessCode: 'access_event-uuid',
        thumbnailObjectKey: 'events/event-uuid/thumbnail/photo-uuid',
        qrLink: 'https://snappyku.site/guest/access_event-uuid/onboarding',
        thumbnailUrl: 'https://storage.googleapis.com/signed-read-url',
      },
    },
  })
  @ApiForbiddenResponse({
    description:
      'Caller is not authenticated as a host (USER session) or does not own the event.',
  })
  @Patch(':eventId')
  rename(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    this.assertUser(req);
    return this.eventService.renameEvent(
      req.user.sub,
      eventId,
      updateEventDto.name,
    );
  }

  @ApiOperation({
    summary: 'Delete an album (event)',
    description:
      'Permanently deletes the album. Cascades through every related row in ' +
      'the database — guests, photos (incl. AI jobs and versions), photo ' +
      'groups, messages, and the host/guest auth sessions tied to this event ' +
      '— and then issues a best-effort cleanup of the corresponding storage ' +
      'objects (event thumbnail, photo originals, AI enhancement outputs). ' +
      'Storage cleanup failures are logged but do NOT roll back the database ' +
      'delete, so a subsequent retry would 404. Only the event owner (USER ' +
      'session) may call this endpoint.',
  })
  @ApiParam({
    name: 'eventId',
    description: 'ID of the event to delete.',
    example: 'event-uuid',
  })
  @ApiNoContentResponse({
    description: 'Album and all related data permanently removed.',
  })
  @ApiForbiddenResponse({
    description:
      'Caller is not authenticated as a host (USER session) or does not own the event.',
  })
  @HttpCode(204)
  @Delete(':eventId')
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ): Promise<void> {
    this.assertUser(req);
    await this.eventService.deleteEvent(req.user.sub, eventId);
  }

  private assertUser(req: AuthenticatedRequest) {
    if (req.user.sessionType !== SessionType.USER) {
      throw new UnauthorizedException('User access token is required');
    }
  }
}
