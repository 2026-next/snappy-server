import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GuestService } from './guest.service';
import { CheckGuestNameDto } from './dto/check-name.dto';

@ApiTags('Guest')
@Controller('guest')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @ApiOperation({ summary: 'Check whether guest name is available' })
  @ApiBody({ type: CheckGuestNameDto })
  @ApiCreatedResponse({ description: 'Name availability returned' })
  @Post('check-name')
  checkName(@Body() checkGuestNameDto: CheckGuestNameDto) {
    return this.guestService.checkNameExists(checkGuestNameDto);
  }

  @ApiOperation({ summary: 'Get event info by access code for guest login' })
  @ApiOkResponse({
    description: 'Event information retrieved successfully',
    schema: {
      example: {
        id: 'event-uuid',
        name: 'event name',
        eventDate: '2026-05-20T10:00:00.000Z',
        createdAt: '2024-06-01T12:00:00.000Z',
        updatedAt: '2024-06-01T12:00:00.000Z',
        ownerId: 'user-uuid',
        accessCode: 'unique-access-code',
        thumbnailObjectKey: 'events/event-uuid/thumbnail/photo-uuid',
        qrLink: 'https://snappyku.site/guest/access_event-uuid/onboarding',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  @Get(':accessCode/join')
  async joinByAccessCode(@Param('accessCode') accessCode: string) {
    return this.guestService.getEventByAccessCode(accessCode);
  }
}
